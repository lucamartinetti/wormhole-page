"""Tests for ChunkQueue and StreamingRequest."""

from unittest.mock import MagicMock, call

from twisted.internet import defer, task
from twisted.trial import unittest

from wormhole_web.streaming import ChunkQueue


class TestChunkQueue(unittest.TestCase):
    def test_put_and_get(self):
        q = ChunkQueue(max_chunks=16)
        q.put(b"hello")
        d = q.get()
        self.assertEqual(self.successResultOf(d), b"hello")

    def test_get_before_put_waits(self):
        q = ChunkQueue(max_chunks=16)
        d = q.get()
        self.assertNoResult(d)
        q.put(b"hello")
        self.assertEqual(self.successResultOf(d), b"hello")

    def test_finish_signals_eof(self):
        q = ChunkQueue(max_chunks=16)
        d = q.get()
        q.finish()
        self.assertIsNone(self.successResultOf(d))

    def test_get_after_finish_returns_none(self):
        q = ChunkQueue(max_chunks=16)
        q.put(b"data")
        q.finish()
        d1 = q.get()
        self.assertEqual(self.successResultOf(d1), b"data")
        d2 = q.get()
        self.assertIsNone(self.successResultOf(d2))

    def test_backpressure_pauses_transport(self):
        transport = MagicMock()
        q = ChunkQueue(max_chunks=2, transport=transport)
        q.put(b"a")
        q.put(b"b")  # queue is full
        transport.pauseProducing.assert_called_once()

    def test_get_resumes_transport(self):
        transport = MagicMock()
        q = ChunkQueue(max_chunks=2, transport=transport)
        q.put(b"a")
        q.put(b"b")  # pauses
        transport.pauseProducing.assert_called_once()
        q.get()  # drains one, should resume
        transport.resumeProducing.assert_called_once()

    def test_error_errbacks_pending_get(self):
        q = ChunkQueue(max_chunks=16)
        d = q.get()
        q.error(Exception("boom"))
        f = self.failureResultOf(d)
        self.assertIn("boom", str(f.value))
