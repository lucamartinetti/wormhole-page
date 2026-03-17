# Consistent Hashing for Horizontal Scaling — Design Spec

Route `GET /receive/<code>` to the machine that owns the wormhole code, using consistent hashing. Enables running multiple wormhole-web instances behind Fly.io's proxy.

## Problem

Each wormhole transfer is owned by a single machine — the one that handled the `PUT /send` and holds the live wormhole connection. When multiple instances run, `GET /receive/<code>` must reach the correct machine. Without routing, it hits a random instance that doesn't have the wormhole.

## Solution

Consistent hashing maps each wormhole code to a machine ID. On `GET /receive/<code>`, the instance checks if it owns the code. If not, it returns a `fly-replay: instance=<target>` header, and Fly's proxy transparently re-routes the request to the correct machine.

## Architecture

### Core routing module (`src/wormhole_web/routing.py`)

No Fly-specific code. Pure routing logic using `uhashring` (ketama consistent hashing with virtual nodes).

```python
class CodeRouter:
    def __init__(self, nodes: list[str]):
        """nodes = list of machine/instance IDs"""

    def get_target(self, code: str) -> str:
        """Return the machine ID that owns this code."""

    def should_handle(self, code: str, my_id: str) -> bool:
        """Return True if this machine should handle the code."""

    def update_nodes(self, nodes: list[str]):
        """Update the node list (e.g., after a scale event)."""
```

Uses `uhashring.HashRing` internally. When a node is added or removed, only ~1/N of keys remap (where N is the number of nodes).

### Fly integration module (`src/wormhole_web/fly.py`)

Fly-specific machine discovery and replay header logic.

```python
class FlyRouter:
    def __init__(self, app_name: str, my_machine_id: str, cache_ttl: int = 10):
        """
        app_name: FLY_APP_NAME env var
        my_machine_id: FLY_MACHINE_ID env var
        cache_ttl: seconds to cache the machine list
        """

    async def get_machines(self) -> list[str]:
        """Query Fly Machines API for running machine IDs. Cached."""

    async def should_handle(self, code: str) -> bool:
        """Check if this machine should handle the code."""

    async def get_replay_header(self, code: str) -> str | None:
        """Return 'fly-replay: instance=<id>' value if we should replay,
        or None if we should handle it ourselves."""
```

Machine discovery via Fly's internal API: `http://_api.internal:4280/v1/apps/<app>/machines` — returns JSON list of machines with their IDs and state. Only `started` machines are included in the hash ring.

Cache TTL of 10 seconds balances freshness with API load.

### Server integration

`ReceiveCodeResource.render_GET`:

```python
def render_GET(self, request):
    if self._fly_router:
        replay = yield self._fly_router.get_replay_header(self._code)
        if replay:
            request.setHeader(b"fly-replay", replay.encode())
            request.setResponseCode(200)
            request.finish()
            return
    # Existing receive logic...
```

`PUT /send`: no routing check — always handles locally.

When not on Fly (no `FLY_MACHINE_ID` env var), `fly_router` is `None` and routing is disabled. Single-instance mode works exactly as today.

### Initialization

In `make_site` / `main`:

```python
fly_router = None
if os.environ.get("FLY_MACHINE_ID"):
    fly_router = FlyRouter(
        app_name=os.environ["FLY_APP_NAME"],
        my_machine_id=os.environ["FLY_MACHINE_ID"],
    )
```

Passed through to `RootResource` → `ReceiveResource` → `ReceiveCodeResource`.

## Request flow

### PUT /send (sender uploads)

```
Client → Fly proxy → any machine (round-robin)
Machine creates wormhole, owns the code.
```

### GET /receive/<code> (receiver downloads)

```
Client → Fly proxy → machine A (round-robin)
Machine A: hash("7-guitarist-revenge") → machine B
Machine A: respond with fly-replay: instance=machine-B
Fly proxy: transparently replays request to machine B
Machine B: hash("7-guitarist-revenge") → machine B (match!)
Machine B: handles the wormhole exchange, streams file
Client sees a single response (replay is transparent)
```

### GET /receive/<code> (already on correct machine)

```
Client → Fly proxy → machine B
Machine B: hash("7-guitarist-revenge") → machine B (match!)
Machine B: handles directly, no replay
```

## Tradeoffs and limitations

### Best-effort routing

The consistent hash maps codes to machines based on the current set of running machines. This is **best-effort** — scale events can disrupt in-flight transfers.

**When a machine is replaced (1 of N):**
- ~1/N of codes remap to a different machine
- Receivers for those codes get routed to the wrong machine → 404
- The sender's machine (which owns the wormhole) may be the one being replaced → transfer fails regardless

**When scaling up (N → N+1):**
- ~1/(N+1) of codes remap to the new machine
- Those codes' wormholes still live on the old machine
- Receivers get routed to the new machine → 404
- Window: from scale-up until the affected transfers complete (max: transfer timeout, default 120s)

**When scaling down (N → N-1):**
- The departing machine's codes (~1/N) remap to neighbors
- If the machine is still draining, wormholes are still live there
- Receivers get routed to the wrong neighbor → 404
- Fly supports graceful drain, but in-flight wormhole connections may not survive

**Mitigation:**
- Wormhole codes are short-lived (minutes). The disruption window is bounded by the transfer timeout.
- Scale events during active transfers are rare in practice.
- Worst case: receiver gets 404, retries, or sender re-sends. The protocol is designed for this — wormhole codes are one-shot.
- Future improvement: add a fallback — on 404, try all machines (or the previous hash ring state).

### No split-brain for new codes

Codes allocated after a scale event always map correctly because the sender's machine creates the wormhole AND is the hash target for that code (the hash ring is current by the time the code is allocated). The problem only affects codes allocated before the scale event.

## Dependencies

- `uhashring` — consistent hashing with virtual nodes (ketama algorithm). Pure Python, ~2.4 latest.

## Files

- **Create:** `src/wormhole_web/routing.py` — `CodeRouter` (generic, no Fly dependency)
- **Create:** `src/wormhole_web/fly.py` — `FlyRouter` (Fly-specific discovery + replay)
- **Modify:** `src/wormhole_web/server.py` — pass `fly_router` to receive resources
- **Modify:** `pyproject.toml` — add `uhashring` dependency
- **Create:** `tests/test_routing.py` — unit tests for `CodeRouter`
- **Create:** `tests/test_fly.py` — unit tests for `FlyRouter` (mocked API)

## Testing

### Unit tests for CodeRouter (`tests/test_routing.py`)
- Deterministic: same code always maps to same node
- Consistent: adding a node remaps only ~1/N codes (verify with large sample)
- `should_handle` returns True only for the owning node
- `update_nodes` changes the ring correctly
- Empty node list handling

### Unit tests for FlyRouter (`tests/test_fly.py`)
- Mock the Fly API response
- Verify machine list caching (don't re-query within TTL)
- Verify `get_replay_header` returns correct header for non-owning machine
- Verify `get_replay_header` returns None for owning machine
- Verify behavior when FLY_MACHINE_ID is not set (disabled)

### Manual testing on Fly
- Deploy with 2+ machines
- Send a file, receive from different machine, verify fly-replay routes correctly
- Scale up/down during idle, verify new transfers work

## Out of scope

- Fallback routing (try multiple machines on 404)
- Persistent code → machine mapping
- Non-Fly deployment routing (generic reverse proxy config)
