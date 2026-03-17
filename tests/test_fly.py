"""Unit tests for the Fly.io router (mocked API)."""

import time
from unittest import mock

from twisted.internet import defer
from twisted.trial import unittest

from wormhole_web.fly import FlyRouter


def _make_machines_response(machine_ids, states=None):
    """Build a fake Fly Machines API JSON response."""
    if states is None:
        states = ["started"] * len(machine_ids)
    return [
        {"id": mid, "state": state}
        for mid, state in zip(machine_ids, states)
    ]


def _mock_treq_get(response_json, status_code=200):
    """Return a patched ``treq.get`` that resolves to *response_json*."""
    mock_response = mock.Mock()
    mock_response.code = status_code

    async def fake_get(*args, **kwargs):
        return mock_response

    async def fake_json_content(resp):
        return response_json

    return fake_get, fake_json_content


class TestFlyRouterGetMachines(unittest.TestCase):
    @defer.inlineCallbacks
    def test_returns_started_machines(self):
        data = _make_machines_response(
            ["m1", "m2", "m3"], ["started", "stopped", "started"]
        )
        fake_get, fake_json = _mock_treq_get(data)

        with mock.patch("wormhole_web.fly.treq") as mock_treq:
            mock_treq.get = fake_get
            mock_treq.json_content = fake_json
            router = FlyRouter("myapp", "m1")
            machines = yield router.get_machines()

        self.assertEqual(sorted(machines), ["m1", "m3"])

    @defer.inlineCallbacks
    def test_caching_within_ttl(self):
        data = _make_machines_response(["m1", "m2"])
        call_count = [0]

        async def counting_get(*args, **kwargs):
            call_count[0] += 1
            return mock.Mock()

        async def fake_json(resp):
            return data

        with mock.patch("wormhole_web.fly.treq") as mock_treq:
            mock_treq.get = counting_get
            mock_treq.json_content = fake_json
            router = FlyRouter("myapp", "m1", cache_ttl=10)

            yield router.get_machines()
            yield router.get_machines()
            yield router.get_machines()

        # Only one actual API call — subsequent ones are cached.
        self.assertEqual(call_count[0], 1)

    @defer.inlineCallbacks
    def test_cache_expires(self):
        data = _make_machines_response(["m1", "m2"])
        call_count = [0]

        async def counting_get(*args, **kwargs):
            call_count[0] += 1
            return mock.Mock()

        async def fake_json(resp):
            return data

        with mock.patch("wormhole_web.fly.treq") as mock_treq, \
             mock.patch("wormhole_web.fly.time") as mock_time:
            mock_treq.get = counting_get
            mock_treq.json_content = fake_json
            # First get_machines: monotonic()=0.0 → cache miss → API call → cache_time=0.0
            # Second get_machines: monotonic()=20.0 → 20.0-0.0 >= 10 → expired → API call
            mock_time.monotonic = mock.Mock(side_effect=[0.0, 20.0])
            router = FlyRouter("myapp", "m1", cache_ttl=10)

            yield router.get_machines()
            yield router.get_machines()

        self.assertEqual(call_count[0], 2)


class TestFlyRouterReplayHeader(unittest.TestCase):
    @defer.inlineCallbacks
    def test_returns_none_when_owning(self):
        """get_replay_header returns None when this machine owns the code."""
        data = _make_machines_response(["m1"])
        fake_get, fake_json = _mock_treq_get(data)

        with mock.patch("wormhole_web.fly.treq") as mock_treq:
            mock_treq.get = fake_get
            mock_treq.json_content = fake_json
            router = FlyRouter("myapp", "m1")
            result = yield router.get_replay_header("any-code")

        # Only one machine — always owned by m1.
        self.assertIsNone(result)

    @defer.inlineCallbacks
    def test_returns_replay_when_not_owning(self):
        """get_replay_header returns instance=<other> for non-owned codes."""
        data = _make_machines_response(["m1", "m2", "m3"])
        fake_get, fake_json = _mock_treq_get(data)

        with mock.patch("wormhole_web.fly.treq") as mock_treq:
            mock_treq.get = fake_get
            mock_treq.json_content = fake_json
            router = FlyRouter("myapp", "m1")

            # Try many codes; at least one should map to a different machine.
            replayed = False
            for i in range(100):
                result = yield router.get_replay_header(f"code-{i}")
                if result is not None:
                    self.assertTrue(result.startswith("instance="))
                    target = result.split("=", 1)[1]
                    self.assertNotEqual(target, "m1")
                    replayed = True

        self.assertTrue(replayed, "Expected at least one code to be replayed")


class TestFlyRouterAPIFailure(unittest.TestCase):
    @defer.inlineCallbacks
    def test_uses_cached_on_failure(self):
        data = _make_machines_response(["m1", "m2"])
        fake_get, fake_json = _mock_treq_get(data)

        with mock.patch("wormhole_web.fly.treq") as mock_treq, \
             mock.patch("wormhole_web.fly.time") as mock_time:
            mock_treq.get = fake_get
            mock_treq.json_content = fake_json
            mock_time.monotonic = mock.Mock(return_value=0.0)
            router = FlyRouter("myapp", "m1", cache_ttl=10)
            yield router.get_machines()  # populate cache

            # Now make API fail and expire cache
            async def failing_get(*a, **kw):
                raise Exception("connection refused")

            mock_treq.get = failing_get
            mock_time.monotonic = mock.Mock(return_value=20.0)

            machines = yield router.get_machines()

        self.assertEqual(sorted(machines), ["m1", "m2"])

    @defer.inlineCallbacks
    def test_falls_back_to_self_without_cache(self):
        with mock.patch("wormhole_web.fly.treq") as mock_treq:
            async def failing_get(*a, **kw):
                raise Exception("connection refused")

            mock_treq.get = failing_get
            router = FlyRouter("myapp", "m1")
            machines = yield router.get_machines()

        self.assertEqual(machines, ["m1"])
