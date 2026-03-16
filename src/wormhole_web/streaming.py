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


from wormhole_web.sender import (
    SendError,
    create_send_session,
    start_key_exchange,
    complete_send,
)
from wormhole_web.util import sanitize_filename, WormholeTimeout


class StreamingRequest(server.Request):
    """Custom Request that streams PUT /send bodies without buffering."""

    _streaming = False
    _chunk_queue = None
    _finished_flag = None

    def gotLength(self, length):
        """Called after headers parsed, before body. Start streaming if PUT /send."""
        path = self.channel._path
        command = self.channel._command

        if command != b"PUT" or not path.startswith(b"/send"):
            super().gotLength(length)
            return

        # Determine which send path
        path_str = path.decode("utf-8", errors="replace")
        if path_str == "/send":
            mode = "inline"
            code = None
        elif path_str.startswith("/send/"):
            code = path_str[len("/send/"):]
            if not code or code == "new":
                super().gotLength(length)
                return
            mode = "two-step"
        else:
            super().gotLength(length)
            return

        # Get filesize from Content-Length or X-Wormhole-Filesize
        filesize = None
        if length is not None:
            filesize = length
        else:
            # Check X-Wormhole-Filesize for chunked transfers
            fs_header = self.requestHeaders.getRawHeaders(b"x-wormhole-filesize")
            if fs_header:
                try:
                    filesize = int(fs_header[0])
                except ValueError:
                    pass

        if filesize is None:
            # Can't proceed without filesize — respond 411
            self._streaming = True
            self.content = io.BytesIO()
            self.method = command
            self.uri = path
            self.path = path
            self.setResponseCode(411)
            self.setHeader(b"content-type", b"text/plain")
            self.write(b"Content-Length or X-Wormhole-Filesize header required\n")
            self.finish()
            return

        # Enter streaming mode
        self._streaming = True
        self.content = io.BytesIO()  # sentinel
        self.method = command
        self.uri = path
        self.path = path

        self._finished_flag = [False]
        self._chunk_queue = ChunkQueue(max_chunks=16, transport=self.transport)

        # Wire disconnect detection
        def on_disconnect(reason):
            if not self._finished_flag[0]:
                self._finished_flag[0] = True
                self._chunk_queue.error(
                    Exception("sender disconnected")
                )

        self.notifyFinish().addErrback(on_disconnect)

        # Get filename
        raw_filename = self.requestHeaders.getRawHeaders(b"x-wormhole-filename")
        filename = "upload"
        if raw_filename:
            filename = sanitize_filename(raw_filename[0].decode("utf-8", errors="replace"))

        # Fire background handler (do NOT yield)
        if mode == "inline":
            self._handle_inline_send(filename, filesize)
        else:
            self._handle_twostep_send(code, filename, filesize)

    def handleContentChunk(self, data):
        if self._streaming:
            if self._chunk_queue and not self._finished_flag[0]:
                self._chunk_queue.put(data)
            return
        super().handleContentChunk(data)

    def requestReceived(self, command, path, version):
        if self._streaming:
            if self._chunk_queue:
                self._chunk_queue.finish()
            # Must set _handlingRequest for HTTP/1.1 keep-alive
            self.channel._handlingRequest = True
            return
        super().requestReceived(command, path, version)

    @defer.inlineCallbacks
    def _handle_inline_send(self, filename, filesize):
        """Background chain for PUT /send (inline flow)."""
        finished = self._finished_flag
        queue = self._chunk_queue
        site = self.channel.site
        session_manager = site.resource._session_manager
        reactor = site.resource._reactor
        transfer_timeout = site.resource._transfer_timeout

        try:
            if session_manager.is_full():
                if not finished[0]:
                    self.setResponseCode(503)
                    self.setHeader(b"content-type", b"text/plain")
                    self.write(b"too many active sessions\n")
                    self.finish()
                    finished[0] = True
                return

            code, wormhole = yield create_send_session(reactor)
            session = session_manager.create(code, wormhole)

            # Start PAKE
            d = start_key_exchange(wormhole, reactor)
            d.addErrback(lambda f: f)
            session.key_exchange_d = d

            if finished[0]:
                session_manager.remove(code)
                yield wormhole.close()
                return

            self.setResponseCode(200)
            self.setHeader(b"content-type", b"text/plain")
            self.write(f"wormhole receive {code}\n".encode())
            self.write(b"waiting for receiver...\n")

            connection = yield complete_send(
                wormhole, session.key_exchange_d,
                filename, filesize, reactor,
                timeout=transfer_timeout,
            )

            if finished[0]:
                connection.close()
                session_manager.remove(code)
                yield wormhole.close()
                return

            self.write(b"transferring...\n")

            yield _send_data_from_queue(connection, queue)

            if not finished[0]:
                self.write(b"transfer complete\n")
                self.finish()
                finished[0] = True

            session_manager.remove(code)
            yield wormhole.close()

        except Exception as e:
            if not finished[0]:
                self.write(f"error: {e}\n".encode())
                self.finish()
                finished[0] = True

    @defer.inlineCallbacks
    def _handle_twostep_send(self, code, filename, filesize):
        """Background chain for PUT /send/<code> (two-step flow)."""
        finished = self._finished_flag
        queue = self._chunk_queue
        site = self.channel.site
        session_manager = site.resource._session_manager
        reactor = site.resource._reactor
        transfer_timeout = site.resource._transfer_timeout

        session = session_manager.get(code)
        if session is None:
            if not finished[0]:
                self.setResponseCode(404)
                self.setHeader(b"content-type", b"text/plain")
                self.write(b"unknown or expired code\n")
                self.finish()
                finished[0] = True
            return

        if not session.claim_upload():
            if not finished[0]:
                self.setResponseCode(409)
                self.setHeader(b"content-type", b"text/plain")
                self.write(b"upload already in progress\n")
                self.finish()
                finished[0] = True
            return

        try:
            self.setResponseCode(200)
            self.setHeader(b"content-type", b"text/plain")
            self.write(code.encode() + b"\n")
            self.write(b"waiting for receiver...\n")

            connection = yield complete_send(
                session.wormhole, session.key_exchange_d,
                filename, filesize, reactor,
                timeout=transfer_timeout,
            )

            if finished[0]:
                connection.close()
                session_manager.remove(code)
                yield session.wormhole.close()
                return

            self.write(b"transferring...\n")

            yield _send_data_from_queue(connection, queue)

            if not finished[0]:
                self.write(b"transfer complete\n")
                self.finish()
                finished[0] = True

            session_manager.remove(code)
            yield session.wormhole.close()

        except Exception as e:
            if not finished[0]:
                self.write(f"error: {e}\n".encode())
                self.finish()
                finished[0] = True
            session_manager.remove(code)
            try:
                yield session.wormhole.close()
            except Exception:
                pass


@defer.inlineCallbacks
def _send_data_from_queue(connection, queue):
    """Consume chunks from queue and pipe through wormhole transit."""
    while True:
        chunk = yield queue.get()
        if chunk is None:
            break
        connection.send_record(chunk)

    # Wait for receiver ack
    try:
        yield connection.receive_record()
    except Exception:
        pass
    connection.close()
