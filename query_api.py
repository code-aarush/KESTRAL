#!/usr/bin/env python3
"""
KESTREL -- Local Query API for Mission Control.

The browser never computes a result set of its own. It posts the world space
bounds of the region the user drew to this endpoint; the endpoint forwards the
request to the C++ query service (``kestrel_query``) and returns the entity
ids that the R-tree actually produced.

The C++ service is a long lived process that builds the demonstration scene
once and then answers one request per line. It therefore queries one and the
same R-tree instance for the whole lifetime of the demo, and it never
regenerates the simulation per query.

Contract (see docs/api/QUERY_API.md):

    POST /api/query   {"bounds": [min_x, min_y, max_x, max_y]}
    GET  /api/scene   -> identity of the scene the service holds
"""

from __future__ import annotations

import json
import queue
import subprocess
import threading
from typing import Optional

# A request body is tiny; anything larger is refused before it reaches the
# C++ service.
MAX_REQUEST_BYTES = 64 * 1024

# Seconds a client waits for the answer of the C++ service.
ANSWER_TIMEOUT_SECONDS = 10.0

# HTTP status codes per outcome reported by the C++ service.
STATUS_CODES = {
    "ok": 200,
    "empty": 200,
    "invalid": 400,
    "error": 500,
}


class QueryWorker:
    """Persistent bridge to the C++ query service process."""

    def __init__(self, process, timeout=ANSWER_TIMEOUT_SECONDS):
        self._process = process
        self._timeout = timeout
        self._lock = threading.Lock()
        self._answers = queue.Queue()
        self._pump = threading.Thread(target=self._read_answers, daemon=True)
        self._pump.start()

    def _read_answers(self):
        """Moves the answers of the service into a queue.

        Reading in a separate thread keeps the request path free of a
        blocking read: a service that stops answering can then be detected
        with a timeout instead of hanging the request.
        """
        for line in self._process.stdout:
            self._answers.put(line)
        self._answers.put(None)  # the service closed its output

    def request(self, payload: str):
        """Sends one request line and returns the response line.

        Returns None when the service is not available any more.
        """
        # Preserve single-line IPC framing by collapsing internal newlines
        sanitized = payload.replace("\r", " ").replace("\n", " ").strip()
        with self._lock:
            if self._process.poll() is not None:
                return None
            try:
                self._process.stdin.write(sanitized + "\n")
                self._process.stdin.flush()
            except (OSError, ValueError):
                return None
            try:
                line = self._answers.get(timeout=self._timeout)
            except queue.Empty:
                return None
            if line is None:
                return None
            return line.strip()

    def stop(self):
        try:
            if self._process.stdin:
                self._process.stdin.close()
        except (OSError, ValueError):
            pass
        try:
            if self._process.stdout:
                self._process.stdout.close()
        except (OSError, ValueError):
            pass
        try:
            self._process.terminate()
            self._process.wait(timeout=2)
        except Exception:
            try:
                self._process.kill()
                self._process.wait(timeout=1)
            except Exception:
                pass


def start_query_worker(executable) -> Optional[QueryWorker]:
    """Starts the C++ query service and returns a handle to it."""
    try:
        process = subprocess.Popen(
            [str(executable)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
    except Exception:
        return None
    return QueryWorker(process)


class QueryApiMixin:
    """Adds the query endpoints to the demo HTTP handler.

    The handler serves the static frontend and forwards the query requests to
    the C++ service. It performs no geometry and no filtering of its own.
    """

    # Set by the launcher once the C++ service is running.
    worker = None

    def _send_json(self, code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _worker(self):
        return type(self).worker

    def _forward(self, payload: str):
        worker = self._worker()
        if worker is None:
            self._send_json(503, {
                "status": "unavailable",
                "message": "The KESTREL query service is not running.",
            })
            return

        response = worker.request(payload)
        if response is None:
            self._send_json(503, {
                "status": "unavailable",
                "message": "The KESTREL query service did not answer.",
            })
            return

        try:
            parsed = json.loads(response)
        except ValueError:
            self._send_json(500, {
                "status": "error",
                "message": "The KESTREL query service returned an unreadable answer.",
            })
            return

        if not isinstance(parsed, dict):
            self._send_json(500, {
                "status": "error",
                "message": "The KESTREL query service returned an unreadable answer.",
            })
            return

        status = parsed.get("status")
        code = STATUS_CODES.get(status, 500)
        self._send_json(code, parsed)

    def do_POST(self):
        path = self.path.split("?")[0]
        if path != "/api/query":
            self.send_error(404, "Unknown endpoint")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0

        if length <= 0:
            self._send_json(400, {
                "status": "invalid",
                "message": "The request body is empty.",
            })
            return
        if length > MAX_REQUEST_BYTES:
            self._send_json(400, {
                "status": "invalid",
                "message": "The request body is too large.",
            })
            return

        body = self.rfile.read(length).decode("utf-8", errors="replace")
        self._forward(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/scene":
            self._forward('{"op":"scene"}')
            return
        super().do_GET()
