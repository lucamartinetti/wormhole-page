# wormhole-web

HTTP gateway for [Magic Wormhole](https://magic-wormhole.readthedocs.io/). Send and receive files via `curl` on machines without a wormhole client installed, interoperable with the standard `wormhole` and `wormhole-rs` CLIs.

## Usage

### Receive a file

Someone sends you a file with `wormhole send`. You receive it with curl:

```bash
curl -OJ http://localhost:8080/receive/7-guitarist-revenge
```

### Send a file

You send a file via the server. Someone receives it with `wormhole receive`:

```bash
# Get a wormhole code
CODE=$(curl -s -X POST http://localhost:8080/send/new)

# Upload the file
curl -T myfile.tar.gz \
  -H "X-Wormhole-Filename: myfile.tar.gz" \
  http://localhost:8080/send/$CODE

# Tell the receiver: wormhole receive $CODE
```

## Install

Requires Python 3.12+.

```bash
# Clone and install
git clone https://github.com/luca/wormhole-web.git
cd wormhole-web
uv sync

# Run
uv run wormhole-web --port 8080
```

### Container

```bash
podman build -t wormhole-web .
podman run -p 8080:8080 wormhole-web
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/receive/<code>` | Receive a file. Streams the file with `Content-Disposition` and `Content-Length`. |
| `POST` | `/send/new` | Create a wormhole session. Returns the wormhole code as plain text. |
| `PUT` | `/send/<code>` | Upload a file for sending. Set `X-Wormhole-Filename` header for the filename. |
| `PUT` | `/send` | Convenience redirect — allocates a code and redirects to `/send/<code>`. Best-effort. |
| `GET` | `/health` | Health check. Returns `ok`. |

## How it works

The server acts as a wormhole client on behalf of the HTTP user. It completes the SPAKE2 key exchange, decrypts/encrypts data, and streams it between the HTTP connection and the wormhole transit connection. The server sees plaintext — if you need end-to-end encryption, use the wormhole CLI directly.

Uses the public Magic Wormhole relay (`relay.magic-wormhole.io`) for signaling and transit. No bundled relay server needed.

## Configuration

```
wormhole-web [OPTIONS]

  --port PORT              Listen port (default: 8080)
  --max-sessions N         Max concurrent send sessions (default: 128)
  --session-ttl SECONDS    TTL for unclaimed sessions (default: 60)
  --transfer-timeout SECONDS  Stall timeout during transfers (default: 120)
```

TLS termination should be handled by a reverse proxy (Caddy, nginx, etc.).

## License

MIT
