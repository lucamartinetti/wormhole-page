# Wormhole Web — Design Spec

A self-hostable HTTP gateway for the Magic Wormhole protocol. Enables sending and receiving files via `curl` or any HTTP client, interoperable with the standard `wormhole` CLI.

## Problem

Magic Wormhole is a great protocol for secure file transfer, but it requires the `wormhole` CLI on both ends. On servers, VMs, containers, or borrowed machines where you can't install software, you're stuck. This project bridges that gap with a plain HTTP API.

## Core Decisions

- **Server-side wormhole client:** The server completes the SPAKE2 exchange and handles encryption/decryption on behalf of the HTTP user. The server sees plaintext. Users who need E2E encryption should use the CLI directly.
- **Public relay:** Uses the default Magic Wormhole mailbox server (`relay.magic-wormhole.io`) for signaling/PAKE, and the default transit relay for data transfer when direct connections fail. No bundled servers. Note: in containerized deployments, direct transit connections are unlikely — most transfers will go through the transit relay.
- **No browser UI:** Pure HTTP API, curl-friendly. A frontend may be added later.
- **Twisted-native:** Uses `twisted.web` directly with the `magic-wormhole` Python library. No async bridging, no extra framework.
- **File transfer protocol reimplemented:** The `magic-wormhole` library exposes a low-level message pipe (`wormhole.create()`), not a file-transfer API. The file transfer logic (offer/accept JSON exchange, transit negotiation, encrypted record framing) lives in the CLI internals and is not a public API. This project reimplements the file-transfer protocol on top of `wormhole.create()` and `wormhole.transit`, following the [file-transfer protocol spec](https://magic-wormhole.readthedocs.io/en/latest/file-transfer-protocol.html).
- **TLS termination:** The server itself speaks plain HTTP. TLS is handled by a reverse proxy (Caddy, nginx, etc.) in front of it. All `https://` examples in this spec assume such a proxy is in place.

## API

### `GET /receive/<code>`

Completes the wormhole exchange using the provided code and streams the file to the HTTP response.

**Response:**
- `Content-Disposition: attachment; filename="<original-name>"`
- `Content-Type` set from filename where possible
- `Content-Length` set from the file size in the wormhole offer message (enables curl progress bars)
- Body: raw file bytes, streamed

**Example:**
```bash
curl -OJ https://wormhole.example.com/receive/7-guitarist-revenge
```

**Error handling:**
- Errors discovered *before* streaming begins (code lookup, PAKE failure) return an appropriate HTTP status: `404` (invalid/expired code), `408` (timeout), `500` (exchange failure).
- Errors discovered *during* streaming (connection drop, transit failure) cannot change the HTTP status (headers already sent as 200). The server closes the connection abruptly. The client sees an incomplete download (content shorter than `Content-Length`).

### `POST /send/new` (step 1 — get a code)

Creates a wormhole and returns the code. No file data. This is the primary send flow.

**Response:**
- `Content-Type: text/plain`
- Body: the wormhole code (e.g., `7-guitarist-revenge`)

**Example:**
```bash
CODE=$(curl -s https://wormhole.example.com/send/new)
echo "Tell the receiver: $CODE"
```

### `PUT /send/<code>` (step 2 — upload)

Uploads file data for an existing wormhole session. Streams the request body into the wormhole transit connection once a receiver connects.

**Headers:**
- `Content-Type` — preserved for the receiver
- `X-Wormhole-Filename: <name>` — original filename. If omitted, the server falls back to the last path segment of the URL, then to `upload`. The server sanitizes filenames: strips path components (`../`, `/`), removes null bytes, and rejects or replaces characters that are unsafe in `Content-Disposition` headers.

**Response (streaming, text/plain):**
- HTTP `200` on success. `404` if the code is unknown, `409` if an upload is already active, `503` if the server has reached its concurrent session limit.
- Line 1: the wormhole code (repeated for convenience)
- Subsequent lines: status updates (`waiting for receiver...`, `transfer complete`)
- If the wormhole exchange fails after streaming has started, the server closes the connection. The client sees a truncated response.

**Example:**
```bash
CODE=$(curl -s https://wormhole.example.com/send/new)
curl -T myfile.tar.gz -H "X-Wormhole-Filename: myfile.tar.gz" \
  https://wormhole.example.com/send/$CODE
```

### `PUT /send` (convenience redirect)

A best-effort shortcut for clients that support `Expect: 100-continue` and `307` redirects.

1. Client sends `PUT /send` with `Expect: 100-continue`
2. Server creates a wormhole, obtains a code
3. Server responds `307 Temporary Redirect` → `Location: /send/<code>`
4. Client follows redirect, sends file body to `/send/<code>`

**Limitations:** This flow is unreliable. Curl's `Expect: 100-continue` timeout is 1 second — if wormhole code allocation takes longer, curl sends the body before the redirect arrives. For small files (<1KB), curl skips `Expect: 100-continue` entirely. The two-step flow (`POST /send/new` + `PUT /send/<code>`) is the documented primary approach. The redirect is a convenience for when it works, not a guarantee.

**Example:**
```bash
curl -L -T myfile.tar.gz https://wormhole.example.com/send
```

### `GET /health`

Returns `200 OK` with body `ok`. For load balancers and monitoring.

## Streaming Architecture

All transfers are streaming. The server never buffers a full file in memory.

### Receive path

1. HTTP request arrives at `/receive/<code>`
2. Server initiates wormhole exchange with the provided code
3. SPAKE2 key exchange completes with the sender
4. Server receives the file offer (includes filename and size)
5. Server sends `{"answer": {"file_ack": "ok"}}` to accept the offer (required by the file-transfer protocol for interop with the CLI)
6. Server sets response headers (`Content-Disposition`, `Content-Length`, `Content-Type`)
7. As data arrives over the wormhole transit connection, chunks are written directly to the HTTP response via `Request.write(chunk)`. The server tracks bytes received and truncates at the offered file size to guard against malicious senders.
8. Backpressure: the wormhole transit data source is registered as a Twisted `IPushProducer` on the HTTP transport. If the HTTP client reads slowly, Twisted's write buffer triggers `pauseProducing`, which pauses reading from the transit connection.
9. When transfer completes (or offered byte count is reached), `Request.finish()` closes the response. If fewer bytes arrive than offered, the connection closes abruptly (client sees content shorter than `Content-Length`).

### Send path

1. Wormhole is created via `POST /send/new` (or `PUT /send` redirect)
2. Code is returned to the client
3. File upload begins on `PUT /send/<code>`
4. Server sends the file offer message (filename, size) to the wormhole
5. Upload chunks are read from the HTTP request body and held in a bounded in-memory buffer (e.g., 256KB)
6. Backpressure: if the buffer is full, the server pauses reading from the HTTP request (Twisted's `pauseProducing` / `resumeProducing`). This means if no receiver has connected yet, the upload is paused once the buffer fills — the HTTP connection stays open but idle, not consuming memory. The sender's curl effectively blocks.
7. When a receiver connects, PAKE completes, and the receiver sends `file_ack`, data flows from the buffer through the wormhole transit
8. Response completes when the wormhole transfer finishes

### Memory budget

One buffer per active transfer (~256KB). Actual per-connection overhead is higher when accounting for Twisted's internal state, TLS contexts for transit connections, and the wormhole library's state machines — but still small relative to the file sizes being transferred.

## Session Lifecycle and Cleanup

- **Concurrent session limit:** The server enforces a configurable maximum number of concurrent sessions (default: 128). When the limit is reached, `POST /send/new` returns `503 Service Unavailable`.
- **Session TTL:** Wormhole sessions created via `POST /send/new` that receive no upload within 60 seconds are cleaned up (wormhole closed, resources freed).
- **Transfer timeout:** Active transfers that stall (no data for 120 seconds) are aborted.
- **Disconnection:** If the HTTP client disconnects mid-transfer, the wormhole connection is closed immediately. Twisted's `Request.notifyFinish()` is used to detect client disconnection.
- **Duplicate upload:** If a second client tries `PUT /send/<code>` for a code that already has an active upload, the server returns `409 Conflict`.
- **Completed codes:** After a transfer completes (or is cleaned up), the code is no longer valid. Subsequent requests return `404`.

## Project Structure

```
wormhole-web/
├── pyproject.toml          # uv project config, dependencies
├── Containerfile           # Podman/Docker container build
├── src/
│   └── wormhole_web/
│       ├── __init__.py
│       ├── server.py       # Twisted Web resource tree, CLI entry point
│       ├── sender.py       # Wormhole send logic, streaming upload
│       └── receiver.py     # Wormhole receive logic, streaming download
└── tests/
    └── ...
```

## Dependencies

- `magic-wormhole` — the protocol implementation (brings Twisted as a transitive dep)
- `twisted` — listed explicitly for `twisted.web`

No other runtime dependencies.

## Container

- Base image: `python:3.12-slim`
- Uses `uv` for dependency installation
- Exposes port 8080 (configurable)
- Single process, no supervisor

```
podman build -t wormhole-web .
podman run -p 8080:8080 wormhole-web
```

## Running locally

```bash
uv run python -m wormhole_web.server --port 8080
```

## Known Risks

- **Relay abuse:** `POST /send/new` creates a real wormhole session on the public mailbox relay. Without rate limiting, a trivial loop could exhaust relay resources. Rate limiting is out of scope for v1 but should be added before any public deployment.

## Out of scope (for now)

- Browser UI / frontend
- Bundled mailbox relay server
- End-to-end encryption in the browser (WebAssembly wormhole client)
- Authentication / access control
- Rate limiting
