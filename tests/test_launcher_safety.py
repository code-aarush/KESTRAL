#!/usr/bin/env python3
"""
Regression test suite for KESTREL demo launcher fixture safety and runtime state serving.

Protects against the defect identified in Phase 1 & Phase 2 where normal launcher runs
copied build/state.json over tracked state.json and frontend/state.json fixtures.
"""

import hashlib
import json
import os
import shutil
import socketserver
import tempfile
import threading
import unittest
import urllib.request
from pathlib import Path

import run_demo
import query_api

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_JSON_ROOT = REPO_ROOT / "state.json"
STATE_JSON_FRONTEND = REPO_ROOT / "frontend" / "state.json"
STATE_JSON_BUILD = REPO_ROOT / "build" / "state.json"


def file_sha256(path: Path) -> str:
    """Computes SHA-256 hash of a file on disk."""
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


class LauncherFixtureSafetyTest(unittest.TestCase):
    """Verifies that demo export and launcher execution NEVER modify tracked fixtures."""

    def setUp(self):
        self.assertTrue(STATE_JSON_ROOT.exists(), "Root state.json fixture must exist")
        self.assertTrue(STATE_JSON_FRONTEND.exists(), "Frontend state.json fixture must exist")
        self.initial_root_hash = file_sha256(STATE_JSON_ROOT)
        self.initial_frontend_hash = file_sha256(STATE_JSON_FRONTEND)

    def test_export_and_validate_state_preserves_tracked_fixtures(self):
        """Executing export_and_validate_state() writes build/state.json without touching fixtures."""
        # Ensure build executables are ready
        build_ok = run_demo.build_targets(force_rebuild=False)
        self.assertTrue(build_ok, "build_targets() must succeed")

        success = run_demo.export_and_validate_state()
        self.assertTrue(success, "export_and_validate_state() must succeed")

        # build/state.json must be present and valid
        self.assertTrue(STATE_JSON_BUILD.exists(), "build/state.json must be generated")
        with open(STATE_JSON_BUILD, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("entities", data)
        self.assertIn("rtree", data)
        self.assertIn("query", data)
        self.assertIn("trace", data)

        # Tracked fixtures must be byte-for-byte identical
        final_root_hash = file_sha256(STATE_JSON_ROOT)
        final_frontend_hash = file_sha256(STATE_JSON_FRONTEND)
        self.assertEqual(
            self.initial_root_hash,
            final_root_hash,
            "root state.json was modified by export_and_validate_state()!"
        )
        self.assertEqual(
            self.initial_frontend_hash,
            final_frontend_hash,
            "frontend/state.json was modified by export_and_validate_state()!"
        )

    def test_repeated_exports_are_idempotent_and_safe(self):
        """Repeated export cycles must never accumulate modifications to tracked fixtures."""
        for _ in range(3):
            ok = run_demo.export_and_validate_state()
            self.assertTrue(ok)
            self.assertEqual(self.initial_root_hash, file_sha256(STATE_JSON_ROOT))
            self.assertEqual(self.initial_frontend_hash, file_sha256(STATE_JSON_FRONTEND))

    def test_export_failure_does_not_corrupt_fixtures(self):
        """If export fails, tracked fixtures must remain completely untouched."""
        orig_export_exe = run_demo.EXPORT_EXE
        try:
            # Point to a dummy non-existent executable to simulate failure
            run_demo.EXPORT_EXE = REPO_ROOT / "build" / "nonexistent_exporter_binary"
            res = run_demo.export_and_validate_state()
            self.assertFalse(res, "export_and_validate_state() must fail when binary is missing")

            # Fixtures must remain unchanged
            self.assertEqual(self.initial_root_hash, file_sha256(STATE_JSON_ROOT))
            self.assertEqual(self.initial_frontend_hash, file_sha256(STATE_JSON_FRONTEND))
        finally:
            run_demo.EXPORT_EXE = orig_export_exe


class LauncherServerStateServingTest(unittest.TestCase):
    """Verifies that NoCacheHTTPRequestHandler serves build/state.json without reading stale fixtures."""

    @classmethod
    def setUpClass(cls):
        # Ensure build/state.json exists
        run_demo.export_and_validate_state()

        # Start temporary server on an ephemeral port
        cls.port = run_demo.find_available_port("127.0.0.1", 18880)
        cls.server = run_demo.ThreadingHTTPServer(("127.0.0.1", cls.port), run_demo.NoCacheHTTPRequestHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def url(self, path: str) -> str:
        return f"http://127.0.0.1:{self.port}{path}"

    def test_server_serves_build_state_for_candidate_paths(self):
        """Requests to /frontend/state.json, /state.json, and /build/state.json return build/state.json content."""
        with open(STATE_JSON_BUILD, "rb") as f:
            expected_build_bytes = f.read()

        for path in ("/frontend/state.json", "/state.json", "/build/state.json"):
            req = urllib.request.Request(self.url(path))
            with urllib.request.urlopen(req, timeout=5) as resp:
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.headers.get("Content-Type"), "application/json")
                self.assertIn("no-cache", resp.headers.get("Cache-Control", ""))
                served_bytes = resp.read()
                # Served content must match build/state.json
                self.assertEqual(
                    served_bytes,
                    expected_build_bytes,
                    f"Path {path} did not serve the generated build/state.json!"
                )

    def test_server_handles_scene_endpoint(self):
        """GET /api/scene returns 200 with scene_key when worker is connected."""
        if not run_demo.QUERY_EXE.exists():
            self.skipTest("kestrel_query.exe not built")

        worker = query_api.start_query_worker(run_demo.QUERY_EXE)
        self.assertIsNotNone(worker)
        run_demo.NoCacheHTTPRequestHandler.worker = worker
        try:
            req = urllib.request.Request(self.url("/api/scene"))
            with urllib.request.urlopen(req, timeout=5) as resp:
                self.assertEqual(resp.status, 200)
                payload = json.loads(resp.read().decode("utf-8"))
                self.assertEqual(payload.get("status"), "ok")
                self.assertIn("scene_key", payload)
        finally:
            worker.stop()
            run_demo.NoCacheHTTPRequestHandler.worker = None


if __name__ == "__main__":
    unittest.main()
