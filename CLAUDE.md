# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

wormhole.page is a browser-based end-to-end encrypted file transfer app using the Magic Wormhole protocol. A full Magic Wormhole client is compiled to WebAssembly and runs entirely in the browser. The server is a dumb gateway — it bridges WebSocket connections to the transit relay and serves static files. It cannot decrypt transferred files.

Fully interoperable with the standard `wormhole` and `wormhole-rs` CLI tools.

## Build & Dev Commands

```bash
make build          # Full build: server + wasm + SRI hash injection
make server         # Rust server only (cargo build --release -p wormhole-page-server)
make wasm           # WASM client only (wasm-pack build in crates/wormhole-wasm)
make sri            # Generate SRI hashes and inject into index.html + sw.js
make run            # Build everything, start server on :8080
make clean          # Remove build artifacts

npm test            # Run Playwright e2e tests (auto-starts server via cargo run)
npm run test:headed # Playwright with visible browser
```

**Prerequisites**: Rust 1.94+, `wasm-pack`, Node 20+ (for tests), `wasm32-unknown-unknown` target.

## Architecture

**Cargo workspace** with two crates:
- `crates/server/` — Axum web server (routes, security headers, WebSocket transit bridge, analytics proxy)
- `crates/wormhole-wasm/` — Magic Wormhole client compiled to WASM (sends/receives files via SPAKE2 + NaCl SecretBox)

**Frontend** (`static/`) — Vanilla JS SPA, no framework:
- `app.js` — UI logic, tab switching (Send/Receive), file handling, progress display
- `wasm-client.js` — WASM lifecycle management, integrity verification via Web Crypto SHA-384
- `sw.js` — Service worker: network-first for HTML, cache-first for assets, offline fallback
- `style.css` — Light/dark themes, responsive layout

**Key data flow**: Browser drops file → `WormholeSender` allocates wormhole code → SPAKE2 key exchange over mailbox relay → encrypted chunks sent via transit relay (WebSocket-to-TCP bridge on server) → `WormholeReceiver` decrypts and downloads.

## Server Routes (`crates/server/src/main.rs`)

- `GET /` and `/receive/{code}` — Serve index.html (SPA routing)
- `GET /static/*` — Static files via tower-http
- `GET /sw.js` — Service worker at root scope
- `GET /transit` — WebSocket upgrade → TCP bridge to transit relay
- `GET /health` — Health check
- `GET /a/script.js`, `POST /a/api/send` — Umami analytics proxy

## WASM Client (`crates/wormhole-wasm/src/lib.rs`)

Two exported classes: `WormholeSender` (create → negotiate → send) and `WormholeReceiver` (create → negotiate → receive). Uses `futures::channel::mpsc` to bridge JS promises to Rust async. Depends on a custom fork of magic-wormhole.rs (`wasm-time-fix` branch) for WASM `std::time::Instant` compatibility.

## Build Pipeline & SRI

`make sri` generates SHA-384 hashes of all JS/CSS/WASM files, injects them as `integrity` attributes into `index.html`, and generates a `BUILD_HASH` for service worker cache versioning. The SRI step mutates `static/index.html` and `static/sw.js` in-place — these files contain placeholders that get replaced during build.

## Testing

Playwright e2e tests in `tests/e2e/`. The test server starts automatically via `cargo run` (configured in `playwright.config.ts`). Tests cover: send/receive flows, security headers, service worker, WASM integrity, WebSocket transit, responsive layout, dark mode, analytics proxy.

## Deployment

- **Fly.io**: `fly deploy --remote-only` (Amsterdam, 2×256MB shared-CPU machines, auto-stop)
- **Container**: Multi-stage Dockerfile (`Containerfile`) — builds Rust + WASM, injects SRI, runs single binary
- **CI**: GitHub Actions — `test.yml` on PRs (build + Playwright), `deploy.yml` on push to main
