# TODOS

## P2: SRI hashes for WASM module
Add SHA-384 integrity attributes to WASM `<script>` tag so browsers verify the
file hasn't been tampered with. Build step generates hash, injects into HTML.
Mitigates compromised-server attacks.
- Effort: S
- Depends on: WASM E2E encryption (must ship first)

## P2: Configurable relay URLs
Make mailbox and transit relay URLs configurable via JS constants or
server-injected config. Default to public relays. Lets operator switch to
self-hosted relays or failover if public relays go down.
- Effort: S
- Depends on: WASM E2E encryption

## P3: beforeunload warning during active transfer
Show browser's "Leave site?" dialog when transfer is in progress and user
tries to close tab or navigate away. Prevents accidental transfer abort.
- Effort: S
- Depends on: WASM E2E encryption

## P3: Streaming age encryption for files >100MB
Store mode currently caps at 100MB because age-encryption JS loads the entire
file into memory for encryption. To support larger files, need streaming
encryption (age format supports 64KB authenticated chunks natively). Requires
either a ReadableStream-based API in the age-encryption JS lib, or switching
to rage compiled to WASM.
- Effort: M
- Depends on: Store feature (must ship first)

## P2: Replace vendored wormhole-rs with git fork
`crates/magic-wormhole-patched/` is 18,000 lines of vendored upstream for a
3-line `#[cfg(not(target_family = "wasm"))]` patch on `std::time::Instant`.
Fork wormhole-rs on GitHub, push just the fix commit, switch Cargo.toml to
a git dependency. Or upstream the patch to magic-wormhole.rs.
- Effort: S
- Depends on: Rust rewrite (clean up during or after)
