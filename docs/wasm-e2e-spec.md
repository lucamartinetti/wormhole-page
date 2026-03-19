# WASM E2E Encryption Spec

## Problem

wormhole-web currently acts as a proxy: the server performs the SPAKE2 key
exchange and handles transit encryption on behalf of the browser user. This
means the server sees all file contents in plaintext. Users who want true E2E
encryption must use a CLI client instead.

## Goal

Browser users become full Magic Wormhole peers via a WASM module compiled from
wormhole-rs. The server never touches key material or plaintext — it can't
decrypt anything. Browser↔CLI and browser↔browser transfers are both E2E
encrypted, fully interoperable with the existing wormhole ecosystem.

## Architecture

```
BROWSER (WASM wormhole peer)
  ├── WSS → mailbox relay    (SPAKE2 key exchange, code allocation)
  └── WSS → transit relay    (encrypted file data, SecretBox)

CLI (standard wormhole client)
  ├── WSS → mailbox relay    (SPAKE2 key exchange)
  └── TCP/WSS → transit relay (encrypted file data)

CURL (no crypto — uses server as today)
  └── HTTP → wormhole-web server → wormhole protocol
```

### Key properties

- **Browser users bypass the server entirely** for data transfer. The web UI
  loads the WASM module, connects directly to the public mailbox and transit
  relays, and handles encryption client-side.
- **The server is unchanged** for curl/HTTP users. It continues to proxy
  wormhole on their behalf (not E2E — same trust model as today).
- **The transit relay bridges TCP↔WebSocket**, so browser (WSS) ↔ CLI (TCP)
  transfers work through the same relay.

### Data flow: browser sends file to CLI

```
Browser                     Mailbox Relay               Transit Relay           CLI
  │                         (WSS)                       (WSS↔TCP)               │
  │──allocate_code─────────▶│                                                   │
  │◀─code: "7-guitar-rev"──│                                                   │
  │                         │◀──────────────────────────────────set_code (WSS)──│
  │──SPAKE2 pake_msg───────▶│──────────────────────────────────────────────────▶│
  │◀─SPAKE2 pake_msg───────│◀──────────────────────────────────────────────────│
  │  [both derive session key K]                                                │
  │──transit hints─────────▶│──────────────────────────────────────────────────▶│
  │◀─transit hints──────────│◀──────────────────────────────────────────────────│
  │──file offer────────────▶│──────────────────────────────────────────────────▶│
  │◀─file_ack───────────────│◀──────────────────────────────────────────────────│
  │                         │                                                   │
  │──WSS connect───────────────────────────────▶│                               │
  │                         │                   │◀──────────────TCP connect─────│
  │──handshake (transit key)───────────────────▶│──────────────────────────────▶│
  │◀─handshake──────────────────────────────────│◀─────────────────────────────│
  │                         │                   │                               │
  │──SecretBox(chunk₁)─────────────────────────▶│──────────────────────────────▶│
  │──SecretBox(chunk₂)─────────────────────────▶│──────────────────────────────▶│
  │  ...                                        │                               │
  │──SecretBox(chunkₙ)─────────────────────────▶│──────────────────────────────▶│
  │◀─ack───────────────────────────────────────│◀─────────────────────────────│
```

## WASM module

### Source

Compile from the `magic-wormhole` Rust crate (wormhole-rs) targeting
`wasm32-unknown-unknown`. The crate already supports this target:

- Crypto: `spake2`, `crypto_secretbox`, `hkdf`, `sha2` — all pure Rust
- WebSocket: `ws_stream_wasm` (WASM-specific dep, already in Cargo.toml)
- Random: `getrandom` with `js` feature (already configured)
- Timers: `wasmtimer` (already configured)

### Rust wrapper crate

Create a thin Rust crate (`crates/wormhole-wasm/`) that wraps the
`magic-wormhole` library and exposes a `wasm-bindgen` API:

```rust
#[wasm_bindgen]
pub struct WormholeSender { /* ... */ }

#[wasm_bindgen]
impl WormholeSender {
    /// Allocate a code and connect to the mailbox relay.
    pub async fn new(relay_url: &str, transit_relay_url: &str) -> Result<WormholeSender, JsError>;

    /// Get the allocated wormhole code.
    pub fn code(&self) -> String;

    /// Wait for receiver, do SPAKE2 + transit setup.
    /// Returns when transit connection is established.
    pub async fn negotiate(&mut self, filename: &str, filesize: u64) -> Result<(), JsError>;

    /// Send one encrypted chunk. Returns bytes consumed.
    pub async fn send_chunk(&mut self, data: &[u8]) -> Result<usize, JsError>;

    /// Signal that all data has been sent. Waits for ack.
    pub async fn finish(&mut self) -> Result<(), JsError>;

    /// Close and clean up.
    pub fn close(self);
}

#[wasm_bindgen]
pub struct WormholeReceiver { /* ... */ }

#[wasm_bindgen]
impl WormholeReceiver {
    /// Connect to mailbox relay with the given code.
    pub async fn new(
        code: &str,
        relay_url: &str,
        transit_relay_url: &str,
    ) -> Result<WormholeReceiver, JsError>;

    /// Do SPAKE2 + accept offer + transit setup.
    /// Returns file metadata (name, size).
    pub async fn negotiate(&mut self) -> Result<FileOffer, JsError>;

    /// Receive and decrypt the next chunk.
    /// Returns empty vec when transfer is complete.
    pub async fn receive_chunk(&mut self) -> Result<Vec<u8>, JsError>;

    /// Close and clean up.
    pub fn close(self);
}

#[wasm_bindgen]
pub struct FileOffer {
    pub filename: String,
    pub filesize: u64,
}
```

### Build

```
wasm-pack build crates/wormhole-wasm --target web --release
```

Output: `crates/wormhole-wasm/pkg/` containing `.wasm` + JS glue.

### Size budget

Target: < 500KB gzipped. The crypto crates are small. Main contributor will be
the wormhole protocol + WebSocket code. Tree-shaking via `wasm-opt` and
`wasm-pack` should keep this manageable.

## JS integration

### Loading the WASM module

```javascript
import init, { WormholeSender, WormholeReceiver } from './wormhole_wasm.js';
await init();  // loads and compiles .wasm
```

Served as static files from the existing Python server at `/static/wasm/`.

### Send flow (browser)

```javascript
async function sendFile(file) {
  const sender = await WormholeSender.new(MAILBOX_RELAY, TRANSIT_RELAY);
  displayCode(sender.code());

  await sender.negotiate(file.name, file.size);
  updateStatus('transferring...');

  const reader = file.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await sender.send_chunk(value);
    updateProgress(/* ... */);
  }
  await sender.finish();
  sender.close();
  updateStatus('complete');
}
```

### Receive flow (browser)

```javascript
async function receiveFile(code) {
  const receiver = await WormholeReceiver.new(code, MAILBOX_RELAY, TRANSIT_RELAY);
  const offer = await receiver.negotiate();

  displayFileInfo(offer.filename, offer.filesize);

  const chunks = [];
  let received = 0;
  while (true) {
    const chunk = await receiver.receive_chunk();
    if (chunk.length === 0) break;
    chunks.push(chunk);
    received += chunk.length;
    updateProgress(received, offer.filesize);
  }
  receiver.close();

  // Trigger browser download
  const blob = new Blob(chunks);
  const url = URL.createObjectURL(blob);
  triggerDownload(url, offer.filename);
  URL.revokeObjectURL(url);
}
```

### Large file consideration

For files larger than available RAM, use `StreamSaver.js` or the File System
Access API (`showSaveFilePicker`) to write chunks to disk as they arrive,
instead of accumulating in memory. This is a progressive enhancement — the
basic Blob approach works for typical file sizes.

## Relay configuration

```javascript
const MAILBOX_RELAY = 'wss://mailbox.magic-wormhole.io/v1';
const TRANSIT_RELAY = 'wss://transit.magic-wormhole.io:443/';
```

Both must be WSS (TLS) — browsers refuse non-TLS WebSocket on HTTPS pages.

The public relays operated by magic-wormhole.io support WSS. If they don't,
or for reliability, we can run our own (the relay servers are open source).

## Design system (implicit — from existing UI)

New elements must use these tokens. No new colors, fonts, or spacing values.

```
Font:        system-ui, -apple-system, sans-serif
Mono:        'SF Mono', 'Cascadia Code', 'Fira Code', monospace
Accent:      #228be6 (blue)
Accent hover:#1c7ed6 (darker blue)
Text:        #212529 (near-black)
Muted:       #868e96 (gray)
Border:      #ced4da (light gray)
Background:  #fafafa (off-white)
Surface:     #f8f9fa, #f1f3f5 (light gray cards)
Error:       #e03131 (red)
Success:     #228be6 (same accent — no green)
Radius:      8px (inputs, buttons), 12px (panels), 6px (small controls)
Max width:   480px (container)
Spacing:     4/8/12/14/16/20/24/32/40px (from existing CSS)
```

New elements:
- **E2E badge:** same position as warning, 12px, #868e96 text, no background.
  Just text: "End-to-end encrypted" — no icons, no green, no banner.
  Keeping it muted and factual, not promotional.
- **Emoji pair:** 24px in negotiation state, 16px muted during transfer.
  No decorative container — just the two characters.
- **Speed/connection:** 13px, #868e96, below progress bar. Same as `.status-text`.
- **Error panels:** same `.receive-status` style — border, 12px radius, centered text.
  Error text in #e03131. Retry button uses `.btn` style.

## UI changes

### Screen states: send flow (WASM path)

```
┌─────────────────────┐
│  S0: DROPZONE       │  Same as today. Drag/click to select file.
│  [drop file here]   │  WASM initializing in background.
│  E2E badge visible  │  If WASM failed: old warning banner instead.
└────────┬────────────┘
         │ file selected
         ▼
┌─────────────────────┐
│  S1: CODE ALLOCATED │  File name + size shown.
│  7-guitar-revenge   │  Code box, QR, copy/share buttons.
│  [QR] [Copy] [Share]│  Status: "waiting for receiver..."
│  "waiting..."       │  Identical to current UI at this point.
└────────┬────────────┘
         │ receiver connects (SPAKE2 begins)
         ▼
┌─────────────────────┐
│  S2: NEGOTIATING    │  NEW STATE — 1-3 seconds.
│  🐙 🌺              │  Verification emoji pair appears.
│  "connecting..."    │  Subtle pulse animation on emoji.
│                     │  User can compare emoji with receiver.
└────────┬────────────┘
         │ transit established
         ▼
┌─────────────────────┐
│  S3: TRANSFERRING   │  Progress bar filling.
│  [████████░░] 67%   │  "14.2 MB/s · relayed"
│  14.2 MB/s · relayed│  Speed updates every second.
│  🐙 🌺 verified     │  Emoji stays visible (smaller, muted).
└────────┬────────────┘
         │ all bytes sent + ack
         ▼
┌─────────────────────┐
│  S4: COMPLETE       │  Progress bar full, green.
│  [██████████] 100%  │  "Transfer complete!"
│  "Transfer complete"│  Bold, dark text. Emoji hidden.
│  [Send another]     │  Button to return to S0.
└─────────────────────┘
```

### Screen states: receive flow (WASM path)

```
┌─────────────────────┐
│  R0: CODE INPUT     │  Same as today. Text input + Receive button.
│  [enter code] [Recv]│  Or: code pre-filled from URL → auto-start.
└────────┬────────────┘
         │ code entered / URL auto-start
         ▼
┌─────────────────────┐
│  R1: CONNECTING     │  Spinner + "establishing encrypted
│  ○ encrypting...    │  connection..." (not "connecting to relay"
│                     │  — the user doesn't care about relays,
│                     │  they care about encryption). 1-3 seconds.
└────────┬────────────┘
         │ SPAKE2 complete
         ▼
┌─────────────────────┐
│  R2: NEGOTIATED     │  File name, size, verification emoji shown.
│  📄 report.pdf      │  Auto-starts transfer immediately.
│  2.4 MB  🐙 🌺      │  File System Access: browser save dialog
│  "starting..."      │  appears automatically (user gesture from
│                     │  clicking Receive or page navigation).
│                     │  Blob fallback: no dialog, auto-starts.
└────────┬────────────┘
         │ transfer begins automatically
         ▼
┌─────────────────────┐
│  R3: TRANSFERRING   │  Progress bar filling.
│  [████████░░] 67%   │  "14.2 MB/s · relayed"
│  14.2 MB/s · relayed│  Speed + connection type.
└────────┬────────────┘
         │ all bytes received
         ▼
┌─────────────────────┐
│  R4: COMPLETE       │  "Transfer complete!"
│  ✓ report.pdf saved │  File saved confirmation.
│  "Transfer complete"│  [Receive another] button.
└─────────────────────┘
```

### Error states (all flows)

```
┌─────────────────────┐
│  E1: RELAY ERROR    │  "Can't reach relay server."
│  ✕ Can't connect    │  [Retry] button.
│  [Retry]            │  Shown if WSS to mailbox/transit fails.
└─────────────────────┘

┌─────────────────────┐
│  E2: BAD CODE       │  "Invalid code or no sender found."
│  ✕ Invalid code     │  [Try again] returns to R0.
│  [Try again]        │
└─────────────────────┘

┌─────────────────────┐
│  E3: TIMEOUT        │  "Connection timed out."
│  ✕ Timed out        │  [Retry] button.
│  [Retry]            │
└─────────────────────┘

┌─────────────────────┐
│  E4: TRANSFER LOST  │  "Connection lost during transfer."
│  ✕ Connection lost  │  Shows how much was transferred.
│  67% transferred    │  [Start over] button.
│  [Start over]       │
└─────────────────────┘

┌─────────────────────┐
│  E5: DISK FULL      │  "Not enough disk space."
│  ✕ Disk full        │  [Try again] (user frees space).
│  [Try again]        │
└─────────────────────┘
```

### Warning / E2E badge

Replace the current warning:
> "Not end-to-end encrypted — the server sees file contents."

With a positive badge when WASM loads:
> "End-to-end encrypted" (green lock icon, subtle, same position)

Fall back to the current warning if WASM fails to load.

### WASM loading

WASM loads in the background on page load. No blocking indicator — the
dropzone and receive input are immediately interactive. If WASM isn't ready
when the user triggers a send/receive, show a brief "initializing encryption..."
for up to 3 seconds, then proceed. If WASM never loads, fall back silently.

### Verification emoji

Derived from SPAKE2 verifier. Two emoji side-by-side (e.g., "🐙 🌺").
Displayed during negotiation (S2/R2) at ~24px. During transfer (S3/R3),
shrinks to ~16px and moves to a muted secondary position. Hidden after
completion.

### Interaction state coverage

```
FEATURE          | LOADING              | EMPTY/IDLE         | ERROR                | SUCCESS              | PARTIAL
-----------------|----------------------|--------------------|----------------------|----------------------|---------
WASM init        | (invisible, bg load) | Dropzone ready,    | Old warning shown,   | E2E badge shown      | N/A
                 |                      | E2E badge pending  | fallback mode active |                      |
Send: allocate   | "allocating code..." | Dropzone (S0)      | E1: relay error      | Code shown (S1)      | N/A
Send: negotiate  | "connecting..." +    | Waiting (S1)       | E3: timeout          | Emoji shown (S2)     | N/A
                 | emoji pulse          |                    | E4: transfer lost    |                      |
Send: transfer   | Progress bar + speed | N/A                | E4: connection lost  | "complete!" (S4)     | Progress %
                 |                      |                    |                      |                      | + speed
Receive: connect | Spinner + "connecting| Code input (R0)    | E1: relay error      | File info shown (R2) | N/A
                 | to relay..."         |                    | E2: bad code         |                      |
Receive: transfer| Progress bar + speed | N/A                | E4: connection lost  | "complete!" (R4)     | Progress %
                 |                      |                    | E5: disk full        |                      | + speed
Emoji verify     | Pulse animation      | Hidden             | Hidden               | Static emoji pair    | N/A
Speed indicator  | "calculating..."     | Hidden             | Hidden               | "X.X MB/s"           | Updating/s
Connection type  | Hidden               | Hidden             | Hidden               | "direct"/"relayed"   | N/A
File save (FS    | Browser save dialog  | N/A                | E5: disk full        | "file saved"         | Streaming
  Access API)    |                      |                    |                      |                      | to disk
File save (Blob) | Accumulating chunks  | N/A                | N/A (memory limit)   | Download triggered   | In memory
```

### Speed + connection type

Shown below the progress bar during transfer. Format: "14.2 MB/s · relayed"
or "14.2 MB/s · direct". Uses the existing `.status-text` style (13px,
#868e96). Speed updates every second from a rolling 2-second window.

## Responsive behavior

The existing UI is a single 480px column — it works on all viewports.
New elements follow the same constraint:

- **Emoji pair:** same size on all viewports (24px/16px). No layout change.
- **Speed/connection text:** wraps naturally at narrow widths.
  "14.2 MB/s · relayed" → fits on one line at 320px.
- **Error panels:** same `.receive-status` layout. Full-width within container.
- **File System Access save dialog:** native browser dialog, not our concern.
- **Receive via URL:** works on mobile — user taps QR code link → browser opens
  → WASM loads → receive starts automatically.

No new breakpoints needed. The 480px container handles everything.

## Accessibility

- **Emoji pair:** add `role="img"` and `aria-label="Verification: [emoji names]"`
  so screen readers announce "Verification: octopus, hibiscus" instead of the
  raw emoji characters.
- **E2E badge:** use `aria-live="polite"` so the badge change from "not encrypted"
  to "encrypted" is announced when WASM loads.
- **Progress bar:** existing progress bar needs `role="progressbar"`,
  `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"` attributes
  updated as transfer progresses.
- **Speed text:** `aria-live="off"` — don't announce speed changes, too noisy.
- **Error states:** error text uses `role="alert"` so screen readers announce
  errors immediately.
- **Keyboard navigation:** all buttons (Retry, Cancel, Start over) focusable.
  Dropzone already has keyboard support via the hidden file input.
- **Color contrast:** all text meets WCAG AA. Muted gray (#868e96) on white
  (#fafafa) = 4.6:1 ratio (passes AA for normal text). Error red (#e03131) on
  white = 5.2:1 (passes).

## Fallback

If WASM fails to load (old browser, disabled, etc.), fall back to the current
server-proxied HTTP flow. The UI shows the old "server sees file contents"
warning. This ensures zero regression for existing users.

## Server changes

**None.** The Python server is unchanged. It continues to serve:
- `GET /` — the web UI (now loads WASM)
- `PUT /send` — curl upload proxy (not E2E)
- `GET /receive/<code>` — curl download proxy (not E2E)
- `/static/*` — static files (now includes WASM artifacts)

## Build & deployment changes

- Add `crates/wormhole-wasm/` to the repo (Rust crate with wasm-bindgen)
- Add a build step: `wasm-pack build` → copies output to `src/wormhole_web/static/wasm/`
- Containerfile: add Rust + wasm-pack to the build stage, compile WASM, then
  copy artifacts to the Python image (no Rust in the runtime image)
- CI: add WASM build + size check

## Testing

- **Rust unit tests:** test the wasm-bindgen API surface in isolation
  (mock WebSocket connections)
- **wasm-pack test:** run Rust tests in a headless browser
- **Integration test:** browser↔CLI transfer via real relays (can use
  `wormhole-rs` CLI as the peer in CI)
- **Fallback test:** verify the server-proxied flow still works when WASM
  is unavailable

## Security considerations

- **SPAKE2 is phishing-resistant:** the short code (e.g., "7-guitar-revenge")
  is the shared secret. An attacker who doesn't know the code can't derive the
  session key.
- **Transit encryption:** NaCl SecretBox (XSalsa20-Poly1305) with key derived
  from the SPAKE2 session via HKDF. Same as all other wormhole clients.
- **No server trust required:** the server serves static files but never
  participates in the protocol. A compromised server could serve a malicious
  WASM module, but this is the same trust model as any web application (and
  can be mitigated with SRI hashes, reproducible builds, etc.).
- **Relay trust:** the mailbox and transit relays see encrypted traffic. They
  can observe metadata (connection timing, data volume) but not content. Same
  trust model as the wormhole ecosystem.

## Accepted expansions (from CEO review)

### Verification emoji pair

After SPAKE2 key exchange, both sender and receiver see the same pair of emoji
derived from the SPAKE2 verifier. This lets users visually confirm no MITM
attack — like Signal's safety numbers but friendlier.

The WASM module exposes the verifier via `WormholeSender::verifier()` and
`WormholeReceiver::verifier()` after `negotiate()` completes. JS maps the
first 4 bytes to emoji from a fixed 256-emoji palette.

### Pre-filled receive URLs

When navigating to `/receive/7-guitar-revenge`, JS extracts the code from the
URL path and auto-starts the WASM receive flow. No typing, no button click.
The sender's QR code and share link already point to this URL pattern.

### Transfer speed indicator

Show real-time MB/s alongside the progress bar. Calculate from bytes
transferred over a rolling 2-second window. Display as "14.2 MB/s" updating
every second.

### Connection type indicator

After transit is established, show "direct" or "relayed" in the UI. The WASM
module exposes this via `WormholeSender::connection_type()` and
`WormholeReceiver::connection_type()`.

### Large file streaming to disk

For receives, use the File System Access API (`showSaveFilePicker`) to write
chunks directly to disk as they arrive. Fallback to Blob accumulation for
browsers that don't support it (Firefox, Safari), with a warning for files
>100MB. Handles `QuotaExceededError` by showing "Not enough disk space."

## Out of scope

- **Directory/multi-file transfer:** single file only (matching current behavior)
- **Text message transfer:** file transfer only
- **Custom relay hosting:** use public relays; self-hosting is a future option
- **Peer-to-peer (no relay):** browsers can't do TCP hole-punching; always
  relay via transit server
- **Service Worker offline support:** not needed for a file transfer tool
- **SRI hashes for WASM:** deferred to TODOS.md
- **Configurable relay URLs:** deferred to TODOS.md
- **beforeunload warning:** deferred to TODOS.md
