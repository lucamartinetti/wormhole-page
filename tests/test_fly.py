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


class TestFlyRouterGetMachines(unittest.TestCase):
    @defer.inlineCallbacks
    def test_returns_started_machines(self):
        data = _make_machines_response(
            ["m1", "m2", "m3"], ["started", "stopped", "started"]
        )
        router = FlyRouter("myapp", "m1")
        with mock.patch.object(router, "_fetch_machines_sync", return_value=data):
            machines = yield router.get_machines()

        self.assertEqual(sorted(machines), ["m1", "m3"])

    @defer.inlineCallbacks
    def test_caching_within_ttl(self):
        data = _make_machines_response(["m1", "m2"])
        router = FlyRouter("myapp", "m1", cache_ttl=10)

        fetch_mock = mock.Mock(return_value=data)
        with mock.patch.object(router, "_fetch_machines_sync", fetch_mock):
            yield router.get_machines()
            yield router.get_machines()
            yield router.get_machines()

        # Only one actual API call — subsequent ones are cached.
        self.assertEqual(fetch_mock.call_count, 1)

    @defer.inlineCallbacks
    def test_cache_expires(self):
        data = _make_machines_response(["m1", "m2"])
        router = FlyRouter("myapp", "m1", cache_ttl=10)

        fetch_mock = mock.Mock(return_value=data)
        with mock.patch.object(router, "_fetch_machines_sync", fetch_mock), \
             mock.patch("wormhole_web.fly.time") as mock_time:
            mock_time.monotonic = mock.Mock(side_effect=[0.0, 20.0])

            yield router.get_machines()
            yield router.get_machines()

        self.assertEqual(fetch_mock.call_count, 2)


class TestFlyRouterReplayHeader(unittest.TestCase):
    @defer.inlineCallbacks
    def test_returns_none_when_owning(self):
        data = _make_machines_response(["m1"])
        router = FlyRouter("myapp", "m1")

        with mock.patch.object(router, "_fetch_machines_sync", return_value=data):
            result = yield router.get_replay_header("any-code")

        self.assertIsNone(result)

    @defer.inlineCallbacks
    def test_returns_replay_when_not_owning(self):
        data = _make_machines_response(["m1", "m2", "m3"])
        router = FlyRouter("myapp", "m1")

        with mock.patch.object(router, "_fetch_machines_sync", return_value=data):
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
        router = FlyRouter("myapp", "m1", cache_ttl=10)

        with mock.patch.object(router, "_fetch_machines_sync", return_value=data), \
             mock.patch("wormhole_web.fly.time") as mock_time:
            mock_time.monotonic = mock.Mock(return_value=0.0)
            yield router.get_machines()  # populate cache

        # Now make API fail and expire cache
        with mock.patch.object(router, "_fetch_machines_sync", side_effect=Exception("refused")), \
             mock.patch("wormhole_web.fly.time") as mock_time:
            mock_time.monotonic = mock.Mock(return_value=20.0)
            machines = yield router.get_machines()

        self.assertEqual(sorted(machines), ["m1", "m2"])

    @defer.inlineCallbacks
    def test_falls_back_to_self_without_cache(self):
        router = FlyRouter("myapp", "m1")

        with mock.patch.object(router, "_fetch_machines_sync", side_effect=Exception("refused")):
            machines = yield router.get_machines()

        self.assertEqual(machines, ["m1"])
