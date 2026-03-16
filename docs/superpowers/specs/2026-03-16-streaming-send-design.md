# Streaming Send — Design Spec

True streaming for the send path: upload body flows directly to wormhole transit without buffering to disk. Supports TB-scale transfers with constant memory usage.

## Problem

Twisted's `twisted.web` buffers the entire request body (to RAM for <100KB, to a temp file for larger) before calling `render_PUT`. This means:
- The full file must fit on disk before transfer begins
- TB-scale files require TB of temp disk space
- Upload and wormhole transfer are sequential, not concurrent

## Goal

Body data flows from the HTTP upload directly to the wormhole transit connection via a bounded in-memory queue. Memory usage is constant (~4MB buffer) regardless of file size. Upload and transfer happen concurrently, connected by backpressure.

Also: replace the `PUT /send` redirect with an inline handler that creates the wormhole, returns the code immediately, then streams data — no `-L` flag needed.

## Design

### Custom Request subclass

A `StreamingRequest` subclass of `twisted.web.server.Request` intercepts PUT requests to `/send` and `/send/<code>` before the body is buffered.

**Overridden methods:**

`gotLength(length)` — called after headers are parsed, before any body data. For streaming PUT requests:
- Parses the path to determine if this is `PUT /send` (inline) or `PUT /send/<code>` (two-step)
- Starts the wormhole protocol (code allocation, PAKE)
- Initializes a `ChunkQueue` for body data
- Writes the wormhole code and status to the response immediately
- Does NOT call `super().gotLength()` — prevents Twisted from setting up a content buffer

`handleContentChunk(data)` — called for each chunk of body data as it arrives from the transport. For streaming requests:
- Pushes the chunk to the `ChunkQueue`
- If queue is full, pauses the transport (`self.channel.pauseProducing()`) to apply backpressure
- Does NOT call `super().handleContentChunk()` — prevents buffering

`requestReceived(command, path, version)` — called when the body is complete. For streaming requests:
- Signals EOF to the `ChunkQueue`
- Does NOT call `super().requestReceived()` — the handler was already started from `gotLength`

For all non-streaming requests (GET, POST, other PUTs), all three methods fall through to `super()` — normal Twisted behavior unchanged.

### ChunkQueue

Bounded async queue connecting `handleContentChunk` (producer) to wormhole transit (consumer).

```
ChunkQueue(max_chunks=16, chunk_size_hint=256KB)
  put(data: bytes) -> None
    Appends to internal deque. If full, calls pause_callback().
  get() -> Deferred[bytes | None]
    Returns next chunk. If empty, returns a Deferred that fires when
    data is available. Returns None for EOF.
  finish() -> None
    Signals no more data. Pending get() fires with None.
  set_consumer_ready() -> None
    Called when the consumer (transit) is ready. Resumes transport
    if it was paused.
```

Backpressure flow:
- Queue full → `handleContentChunk` calls `request.channel.pauseProducing()` → TCP stops reading → curl blocks
- Consumer drains queue → calls `request.channel.resumeProducing()` → TCP resumes → curl continues

### Inline PUT /send flow

```
1. curl sends: PUT /send + headers (Content-Length, X-Wormhole-Filename)
2. gotLength fires:
   a. Create wormhole, allocate code (async — yield)
   b. Start PAKE key exchange in background
   c. Initialize ChunkQueue
   d. Write "wormhole receive <code>\n" to response
   e. Write "waiting for receiver...\n"
3. handleContentChunk fires repeatedly:
   - Push chunks to ChunkQueue
   - Backpressure if full
4. PAKE completes (receiver connected):
   a. complete_send finishes → transit connection established
   b. Write "transferring...\n" to response
   c. Start consuming: loop get() from ChunkQueue → send_record to transit
   d. As queue drains, resume transport
5. requestReceived fires (body complete):
   - Signal EOF to ChunkQueue
6. Consumer hits EOF:
   - Wait for receiver ack record
   - Write "transfer complete\n"
   - Finish response
```

### Two-step PUT /send/<code> flow

```
1. curl sends: PUT /send/<code> + headers
2. gotLength fires:
   a. Look up session by code (created by POST /send/new)
   b. Session already has key_exchange_d from session creation
   c. Initialize ChunkQueue
   d. Write "<code>\nwaiting for receiver...\n"
   e. Start complete_send (uses stored key_exchange_d)
3-6. Same as inline flow
```

### Sender module changes

Add a new function:

```
send_data_from_queue(connection, queue, request) -> Deferred
    Reads chunks from ChunkQueue and pipes through transit via send_record.
    After EOF, waits for receiver ack. Writes status to request.
    Handles backpressure: resumes transport when queue space opens.
```

### Server module changes

- `make_site` passes `requestFactory=StreamingRequest`
- Remove `SendResource.render_PUT` (redirect handler) — replaced by inline streaming in `StreamingRequest.gotLength`
- Remove `SendCodeResource` class — streaming PUT is handled in the Request subclass
- Keep `SendNewResource` (`POST /send/new`) — not a streaming endpoint
- Keep `SendResource` as a container for `SendNewResource` child

### What stays the same

- `POST /send/new` — unchanged, returns code
- `GET /receive/<code>` — unchanged, already streams
- `GET /health` — unchanged
- Session management — unchanged
- `start_key_exchange` / `complete_send` — unchanged
- All non-PUT-send requests use normal Twisted buffering

### Error handling

- `gotLength` is synchronous in Twisted's call chain — we can't `yield` Deferreds directly. The async work (wormhole creation, code allocation) must be fired as a background Deferred chain. If it fails, the error is written to the response.
- If the session lookup fails in `gotLength` for `PUT /send/<code>` (expired code), write 404 to the response.
- If the sender disconnects mid-transfer, the ChunkQueue signals error, transit connection is closed.
- If the receiver disconnects mid-transfer, the transit errbacks, the send handler writes an error to the response and finishes it.

### gotLength is synchronous — handling async operations

`gotLength` is called synchronously from Twisted's header parsing. We cannot `yield` inside it. The pattern:

1. `gotLength` sets up the ChunkQueue and marks the request as streaming
2. `gotLength` fires an `@inlineCallbacks` Deferred chain in the background (does not yield it)
3. That chain does the async work: create wormhole, allocate code, write to response, start PAKE, wait for receiver, consume queue
4. `handleContentChunk` and `requestReceived` interact with the queue (synchronous puts and EOF signal)
5. The background chain runs concurrently with body reception

This is safe because everything runs in the same reactor event loop — no threading issues.

## Testing

- Modify `tests/test_integration.py` `TestSendPath::test_send_file` to use inline `PUT /send` (no redirect)
- Add a streaming test: generate data incrementally (not all in memory), verify transfer works
- All existing E2E tests should still pass (two-step flow unchanged, inline flow improved)
- Add a test for the delayed-receiver scenario with the inline flow

## UX improvement

The inline `PUT /send` response now shows a copy-pasteable receive command:

```
$ curl -T huge-file.iso -H "X-Wormhole-Filename: huge-file.iso" http://host/send
wormhole receive 7-guitarist-revenge
waiting for receiver...
transferring...
transfer complete
```
