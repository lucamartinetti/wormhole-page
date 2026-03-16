"""Streaming request handling for wormhole-web send path."""

import io
from collections import deque

from twisted.internet import defer
from twisted.web import server


class ChunkQueue:
    """Bounded async queue with backpressure for streaming uploads.

    Connects handleContentChunk (producer) to wormhole transit (consumer).
    """

    def __init__(self, max_chunks=16, transport=None):
        self._queue = deque()
        self._max_chunks = max_chunks
        self._transport = transport
        self._waiting = None  # Deferred waiting for data
        self._finished = False
        self._paused = False
        self._error = None

    def put(self, data: bytes):
        """Add a chunk. Pauses transport if queue is full."""
        if self._waiting is not None:
            # Consumer is waiting — deliver directly
            d, self._waiting = self._waiting, None
            d.callback(data)
            return

        self._queue.append(data)
        if len(self._queue) >= self._max_chunks and not self._paused:
            if self._transport:
                self._transport.pauseProducing()
                self._paused = True

    def get(self):
        """Get next chunk. Returns Deferred[bytes | None].

        Returns None for EOF. Resumes transport if queue drops below limit.
        """
        if self._queue:
            data = self._queue.popleft()
            # Resume transport if we dropped below the limit
            if self._paused and len(self._queue) < self._max_chunks:
                if self._transport:
                    self._transport.resumeProducing()
                    self._paused = False
            return defer.succeed(data)

        if self._error is not None:
            return defer.fail(self._error)

        if self._finished:
            return defer.succeed(None)

        # No data available — return a Deferred that waits
        self._waiting = defer.Deferred()
        return self._waiting

    def finish(self):
        """Signal EOF. Pending get() fires with None."""
        self._finished = True
        if self._waiting is not None:
            d, self._waiting = self._waiting, None
            d.callback(None)

    def error(self, reason):
        """Signal error. Pending get() errbacks."""
        self._error = reason
        self._finished = True
        if self._waiting is not None:
            d, self._waiting = self._waiting, None
            d.errback(reason)
