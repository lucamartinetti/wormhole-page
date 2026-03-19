# WASM E2E Encryption — Implementation Plan

Spec: [docs/wasm-e2e-spec.md](./wasm-e2e-spec.md)

## Phase 1: Rust WASM crate (the hard part)

### 1.1 Scaffold the crate

- Create `crates/wormhole-wasm/Cargo.toml` with dependencies:
  - `magic-wormhole = { version = "=0.8.0-alpha.1", features = ["transit", "transfer"] }`
    (pinned alpha — has WASM-specific deps: ws_stream_wasm, wasmtimer, getrandom/js)
  - `wasm-bindgen`, `wasm-bindgen-futures`, `js-sys`, `web-sys`
  - `serde`, `serde-wasm-bindgen`
  - `console_error_panic_hook` (for debugging)
- Create `crates/wormhole-wasm/src/lib.rs` with basic wasm-bindgen skeleton
- Verify it compiles: `wasm-pack build --target web`

### 1.2 Implement WormholeSender

- `WormholeSender::new()` — create wormhole, allocate code, return handle
- `WormholeSender::code()` — return allocated code string
- `WormholeSender::negotiate()` — SPAKE2 exchange, send transit hints + file
  offer, receive file_ack, establish transit connection
- `WormholeSender::send_chunk()` — encrypt chunk with SecretBox, send via
  transit. Handle backpressure from the WebSocket.
- `WormholeSender::finish()` — send final record, wait for ack, close transit
- `WormholeSender::close()` — clean up wormhole + transit resources

Key challenge: wormhole-rs's async API uses `async-std`. In WASM, this needs
to run on the browser's event loop via `wasm-bindgen-futures::spawn_local`.
The crate already handles this (it uses `wasmtimer` and `ws_stream_wasm` on
wasm32 targets), but we need to verify the integration works end-to-end.

### 1.3 Implement WormholeReceiver

- `WormholeReceiver::new()` — create wormhole, set code
- `WormholeReceiver::negotiate()` — SPAKE2, receive offer, send file_ack,
  establish transit, return FileOffer
- `WormholeReceiver::receive_chunk()` — read record from transit, decrypt,
  return plaintext bytes
- `WormholeReceiver::close()` — clean up

### 1.4 Error handling

- Map Rust errors to JS-friendly error types via `JsError`
- Categories: `CodeError` (bad code / PAKE failure), `TransitError` (connection
  failed), `TransferError` (data corruption / protocol error), `TimeoutError`
- Include human-readable messages suitable for display in the UI

### 1.5 Test the WASM module

- `wasm-pack test --headless --chrome` — run Rust tests in a real browser
- Test against a real `wormhole-rs` CLI process:
  - Spawn `wormhole-rs send` in a subprocess
  - WASM module receives the file
  - Compare checksums
  - And vice versa (WASM sends, CLI receives)
- Test error cases: bad code, timeout, peer disconnect mid-transfer

## Phase 2: JS integration

### 2.1 WASM loading

- Add WASM artifacts to `src/wormhole_web/static/wasm/`
- Add a build script or Makefile target:
  `wasm-pack build crates/wormhole-wasm --target web --out-dir ../../src/wormhole_web/static/wasm`
- Load in index.html:
  ```javascript
  let wasmReady = false;
  import('./static/wasm/wormhole_wasm.js')
    .then(mod => mod.default())
    .then(() => { wasmReady = true; updateWarningBanner(); })
    .catch(err => { console.warn('WASM load failed, using server proxy:', err); });
  ```

### 2.2 Send flow (replace current XHR upload)

- When `wasmReady`, `startSend(file)` uses the WASM sender:
  1. `WormholeSender.new(MAILBOX_RELAY, TRANSIT_RELAY)`
  2. Display code, QR, share button (same UI as today)
  3. `sender.negotiate(file.name, file.size)`
  4. Stream file via `file.stream().getReader()`, calling `sender.send_chunk()`
  5. `sender.finish()` — display "complete"
- When `!wasmReady`, fall back to current XHR `PUT /send` flow

### 2.3 Receive flow (replace current anchor download)

- When `wasmReady`, `startReceive(code)` uses the WASM receiver:
  1. `WormholeReceiver.new(code, MAILBOX_RELAY, TRANSIT_RELAY)`
  2. `receiver.negotiate()` — get file offer, display file info
  3. Loop: `receiver.receive_chunk()` → accumulate chunks, update progress
  4. Create Blob, trigger download via `URL.createObjectURL`
- When `!wasmReady`, fall back to current anchor `GET /receive/<code>` flow

### 2.4 Progress tracking

- Send: track bytes read from file stream vs total file size
- Receive: track bytes received vs `offer.filesize`
- Reuse existing progress bar UI (`.progress-track` / `.progress-bar`)

### 2.5 Cancellation

- `cancelSend()` calls `sender.close()` — drops WASM handle, closes WebSocket
- `cancelReceive()` calls `receiver.close()`
- Wire up existing cancel buttons

## Phase 3: UI updates

### 3.1 Warning banner

- Replace static HTML warning with a dynamic element
- WASM loaded: "End-to-end encrypted — your files never touch our server."
- WASM failed: "Not end-to-end encrypted — the server sees file contents."
  (current behavior, with link to CLI)

### 3.2 Receive via URL

- Current flow: `GET /receive/<code>` triggers server-side download
- New flow: when navigating to `/receive/<code>` with WASM available, the JS
  intercepts and does the WASM receive instead of fetching from the server
- The server still handles the route for curl users (no Accept header / no JS)

### 3.3 WASM loading state

- Show a subtle "initializing..." text while WASM loads (typically <1s)
- Don't block the UI — user can still interact, WASM loads in background

## Phase 4: Build pipeline

### 4.1 Makefile / build script

```makefile
.PHONY: wasm
wasm:
	wasm-pack build crates/wormhole-wasm \
		--target web \
		--release \
		--out-dir ../../src/wormhole_web/static/wasm
	wasm-opt -Oz -o src/wormhole_web/static/wasm/wormhole_wasm_bg.wasm \
		src/wormhole_web/static/wasm/wormhole_wasm_bg.wasm
```

### 4.2 Containerfile

```dockerfile
# --- Rust WASM build stage ---
FROM rust:1.86-slim AS wasm-builder
RUN cargo install wasm-pack
WORKDIR /build
COPY crates/ crates/
RUN cd crates/wormhole-wasm && wasm-pack build --target web --release
# wasm-opt for size reduction
RUN apt-get update && apt-get install -y binaryen
RUN wasm-opt -Oz -o crates/wormhole-wasm/pkg/wormhole_wasm_bg.wasm \
    crates/wormhole-wasm/pkg/wormhole_wasm_bg.wasm

# --- Python stage (existing, add COPY) ---
COPY --from=wasm-builder /build/crates/wormhole-wasm/pkg/ src/wormhole_web/static/wasm/
```

### 4.3 CI

- Add a job that builds the WASM crate and checks output size (<500KB gzipped)
- Run `wasm-pack test --headless --chrome`
- Run integration test (WASM ↔ CLI transfer)

## Phase 5: Large file streaming to disk (in scope for v1)

### 5.1 File System Access API for large receives

For files >100MB, accumulating chunks in memory causes OOM. Use the
File System Access API to write directly to disk:

```javascript
if ('showSaveFilePicker' in window) {
  const handle = await showSaveFilePicker({ suggestedName: offer.filename });
  const writable = await handle.createWritable();
  try {
    while (true) {
      const chunk = await receiver.receive_chunk();
      if (chunk.length === 0) break;
      await writable.write(chunk);
    }
    await writable.close();
  } catch (e) {
    await writable.abort();
    if (e.name === 'QuotaExceededError') {
      showError('Not enough disk space');
    } else {
      throw e;
    }
  }
}
```

### 5.2 Blob fallback for unsupported browsers

Firefox and Safari don't support File System Access API. Fall back to Blob
accumulation with a warning for files >100MB:

```javascript
if (offer.filesize > 100 * 1024 * 1024) {
  showWarning('Large file — may use significant memory');
}
```

## Phase 6: Accepted expansions

### 6.1 Verification emoji pair

After `negotiate()`, call `sender.verifier()` / `receiver.verifier()` to get
the SPAKE2 verifier bytes. Map first 4 bytes to emoji from a 256-emoji palette.
Display as two emoji side-by-side (e.g., "🐙 🌺"). Both sides should see the
same pair.

### 6.2 Transfer speed indicator

Track bytes transferred over a rolling 2-second window. Update display every
second with "X.X MB/s". Reset on transfer start. Hide when idle.

### 6.3 Connection type indicator

After transit established, call `sender.connection_type()` /
`receiver.connection_type()`. Display "direct" or "relayed" next to speed.

### 6.4 Pre-filled receive URLs

On page load, check `window.location.pathname` for `/receive/<code>` pattern.
If found and WASM is ready, extract code and auto-start receive flow.
Validate code format (number + dash + words) before starting.

## Implementation order

```
Phase 1.1  ──▶  Phase 1.2  ──▶  Phase 1.3  ──▶  Phase 1.4  ──▶  Phase 1.5
(scaffold)     (sender)        (receiver)      (errors)        (test)
                                                                   │
Phase 2.1  ◀───────────────────────────────────────────────────────┘
(load wasm)
   │
Phase 2.2  ──▶  Phase 2.3  ──▶  Phase 2.4  ──▶  Phase 2.5
(JS send)      (JS receive)   (progress)      (cancel)
                                                   │
Phase 3.1  ◀───────────────────────────────────────┘
(UI banner)
   │
Phase 3.2  ──▶  Phase 3.3  ──▶  Phase 4  ──▶  Phase 5  ──▶  Phase 6
(URL recv)     (loading)       (build)       (streaming)    (expansions)
                                                              │
                                                   6.1 emoji ─┤
                                                   6.2 speed ─┤
                                                   6.3 conn  ─┤
                                                   6.4 URL   ─┘
```

## Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| wormhole-rs doesn't compile cleanly to wasm32 | Blocks phase 1 | Test compilation first (phase 1.1). The crate has WASM deps already; likely works. If not, fork and patch. |
| Public relays reject browser WebSocket | Blocks E2E | Test WSS connectivity early. Fallback: run our own relay (open source). |
| WASM module too large (>1MB gzipped) | Slow first load | wasm-opt -Oz, tree-shaking, lazy loading. Check size in CI. |
| async-std on WASM has bugs | Runtime errors | Test extensively in headless browser. wormhole-rs CI already tests WASM. |
| Browser memory limit for large files | OOM on receive | Phase 5 (StreamSaver.js) — follow-up, not blocking. |

## Definition of done

- [ ] Browser user can send a file, CLI user receives it — file is identical
- [ ] CLI user sends a file, browser user receives it — file is identical
- [ ] Browser ↔ browser transfer works
- [ ] Server never sees plaintext (verified: server logs show no file data)
- [ ] WASM failure falls back to server-proxied flow gracefully
- [ ] UI correctly shows E2E status based on WASM availability
- [ ] WASM module < 500KB gzipped
- [ ] Works in Chrome, Firefox, Safari (latest)
- [ ] Verification emoji pair shown on both sides after key exchange
- [ ] Pre-filled /receive/<code> URLs auto-start WASM receive
- [ ] Transfer speed (MB/s) shown during active transfer
- [ ] Connection type (direct/relayed) shown during transfer
- [ ] Large files (>100MB) stream to disk via File System Access API
- [ ] Blob fallback with warning for browsers without File System Access API
- [ ] QuotaExceededError caught and displayed as "Not enough disk space"
- [ ] Filenames from peer sanitized before display and save dialog
