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

## P3: Send native text-message offers
The browser sends "text" as an in-memory `message.txt` file, which every receiver
understands, but it is not the message offer used by `wormhole send --text`, so a CLI
receiver gets a file instead of printed text. Receiving a CLI's text message already
works: the forked crate (lucamartinetti/magic-wormhole.rs, branch web-text-receive)
accepts message offers. Sending one needs a `send_message` path in the fork
(PeerMessage::Offer(Message(..)), then wait for MessageAck), exposed through the WASM
crate and wasm-client.js.
- Effort: M
- Depends on: upstream text-message API design (magic-wormhole/magic-wormhole.rs#434)

## P3: beforeunload warning during active transfer
Show browser's "Leave site?" dialog when transfer is in progress and user
tries to close tab or navigate away. Prevents accidental transfer abort.
- Effort: S
- Depends on: WASM E2E encryption

## P2: Replace vendored wormhole-rs with git fork
`crates/magic-wormhole-patched/` is 18,000 lines of vendored upstream for a
3-line `#[cfg(not(target_family = "wasm"))]` patch on `std::time::Instant`.
Fork wormhole-rs on GitHub, push just the fix commit, switch Cargo.toml to
a git dependency. Or upstream the patch to magic-wormhole.rs.
- Effort: S
- Depends on: Rust rewrite (clean up during or after)
