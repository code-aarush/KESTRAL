#!/usr/bin/env python3
"""
Tests for the KESTREL user defined spatial query.

Three layers are covered:

1. The C++ query service (``kestrel_query``) is driven directly over its
   line protocol: the request contract, the validation rules and the returned
   entity ids.
2. The local HTTP API (``query_api``) is exercised through a real HTTP
   request, including the error paths.
3. The browser harness (``frontend/test_query.html``) is executed in a
   headless browser and must pass completely.

The C++ binary is expected in ``build/src``. The binary and the browser tests
are skipped when they are not available, so the pure Python tests always run.
"""

import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, REPO_ROOT)

import query_api  # noqa: E402

QUERY_EXE = os.path.join(REPO_ROOT, 'build', 'src', 'kestrel_query')
QUERY_EXE = QUERY_EXE + '.exe' if os.name == 'nt' else QUERY_EXE
STATE_JSON = os.path.join(REPO_ROOT, 'frontend', 'state.json')


class QueryServiceContractTest(unittest.TestCase):
    """Drives the C++ query service over its line protocol."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(QUERY_EXE):
            raise unittest.SkipTest(f"query service not built: {QUERY_EXE}")
        cls.worker = query_api.start_query_worker(QUERY_EXE)
        if cls.worker is None:
            raise unittest.SkipTest("query service could not be started")

    @classmethod
    def tearDownClass(cls):
        if cls.worker:
            cls.worker.stop()

    def ask(self, payload):
        answer = self.worker.request(payload)
        self.assertIsNotNone(answer, "the query service did not answer")
        return json.loads(answer)

    def test_scene_identity_is_reported(self):
        answer = self.ask('{"op":"scene"}')
        self.assertEqual(answer['status'], 'ok')
        self.assertIn('scene_key', answer)
        self.assertGreater(answer['entity_count'], 0)

    def test_scene_key_matches_the_exported_state(self):
        """The service and the exported scene must describe the same scene."""
        if not os.path.exists(STATE_JSON):
            self.skipTest("state.json not found")
        with open(STATE_JSON, 'r', encoding='utf-8') as fp:
            state = json.load(fp)
        answer = self.ask('{"op":"scene"}')
        self.assertEqual(answer['scene_key'], state['scene_key'])

    def test_query_returns_entity_ids(self):
        answer = self.ask('{"op":"query","bounds":[200,200,600,400]}')
        self.assertIn(answer['status'], ('ok', 'empty'))
        self.assertIsInstance(answer['results'], list)
        self.assertIn('nodes_visited', answer['metrics'])

    def test_empty_region_is_reported_as_empty(self):
        answer = self.ask('{"op":"query","bounds":[-9000,-9000,-8000,-8000]}')
        self.assertEqual(answer['status'], 'empty')
        self.assertEqual(answer['results'], [])

    def test_invalid_requests_are_rejected(self):
        for payload in ('', 'not json', '{}', '{"op":"query","bounds":[1,2,3]}',
                        '{"op":"query","bounds":[1,2,3,NaN]}',
                        '{"op":"query","bounds":[1,2,3,Infinity]}',
                        '{"op":"query","bounds":[10,10,0,0]}',
                        '{"op":"explode"}'):
            answer = self.ask(payload)
            self.assertEqual(answer['status'], 'invalid', f"payload: {payload!r}")
            self.assertIn('message', answer)

    def test_repeated_queries_keep_the_same_scene(self):
        first = self.ask('{"op":"query","bounds":[0,0,800,600]}')
        second = self.ask('{"op":"query","bounds":[0,0,800,600]}')
        self.assertEqual(first['scene_key'], second['scene_key'])
        self.assertEqual(first['results'], second['results'])


class QueryApiHttpTest(unittest.TestCase):
    """Exercises the HTTP endpoints of the local query API."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(QUERY_EXE):
            raise unittest.SkipTest(f"query service not built: {QUERY_EXE}")
        cls.worker = query_api.start_query_worker(QUERY_EXE)
        if cls.worker is None:
            raise unittest.SkipTest("query service could not be started")

        class Handler(query_api.QueryApiMixin, http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=REPO_ROOT, **kwargs)

            def log_message(self, fmt, *args):
                pass

        cls.server = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Handler)
        cls.server.daemon_threads = True
        cls.port = cls.server.server_address[1]
        query_api.QueryApiMixin.worker = cls.worker
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        query_api.QueryApiMixin.worker = None
        cls.server.shutdown()
        cls.server.server_close()
        if cls.worker:
            cls.worker.stop()

    def url(self, path):
        return f"http://127.0.0.1:{self.port}{path}"

    def post(self, path, body):
        request = urllib.request.Request(
            self.url(path),
            data=body.encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as error:
            raw = error.read().decode('utf-8', errors='ignore')
            try:
                return error.code, json.loads(raw)
            except ValueError:
                return error.code, {}

    def test_scene_endpoint(self):
        with urllib.request.urlopen(self.url('/api/scene'), timeout=10) as response:
            payload = json.loads(response.read().decode('utf-8'))
        self.assertEqual(response.status, 200)
        self.assertEqual(payload['status'], 'ok')
        self.assertIn('scene_key', payload)

    def test_query_endpoint_returns_ids(self):
        status, payload = self.post('/api/query', '{"bounds":[200,200,600,400]}')
        self.assertEqual(status, 200)
        self.assertIn(payload['status'], ('ok', 'empty'))
        self.assertIsInstance(payload['results'], list)

    def test_query_endpoint_rejects_invalid_input(self):
        status, payload = self.post('/api/query', '{"bounds":[10,10,0,0]}')
        self.assertEqual(status, 400)
        self.assertEqual(payload['status'], 'invalid')

    def test_query_endpoint_rejects_malformed_body(self):
        status, payload = self.post('/api/query', 'this is not json')
        self.assertEqual(status, 400)
        self.assertEqual(payload['status'], 'invalid')

    def test_query_endpoint_rejects_empty_body(self):
        status, payload = self.post('/api/query', '')
        self.assertEqual(status, 400)
        self.assertEqual(payload['status'], 'invalid')

    def test_unknown_endpoint_is_not_found(self):
        status, payload = self.post('/api/nothing', '{"bounds":[0,0,1,1]}')
        self.assertEqual(status, 404)

    def test_frontend_is_served(self):
        with urllib.request.urlopen(self.url('/frontend/index.html'), timeout=10) as response:
            body = response.read().decode('utf-8', errors='ignore')
        self.assertEqual(response.status, 200)
        self.assertIn('KESTREL', body)
        self.assertIn('btnDrawQuery', body)


class QueryBrowserSuiteTest(unittest.TestCase):
    """Executes frontend/test_query.html in a headless browser."""

    def test_headless_browser_suite(self):
        test_html = os.path.abspath(os.path.join(REPO_ROOT, 'frontend', 'test_query.html'))
        if not os.path.exists(test_html):
            self.skipTest("test_query.html not found")

        if self._run_firefox(test_html):
            return
        if self._run_chromium(test_html):
            return
        self.skipTest("no headless browser (firefox or chromium) found on PATH")

    def _run_firefox(self, test_html):
        """Runs the harness in headless Firefox and returns True when it ran."""
        profile_dir = tempfile.mkdtemp()
        with open(os.path.join(profile_dir, 'user.js'), 'w') as f:
            f.write('user_pref("browser.dom.window.dump.enabled", true);\n')

        cmd = ['firefox', '-headless', '-profile', profile_dir, test_html]
        try:
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            time.sleep(3.0)
            process.terminate()
            stdout, _ = process.communicate(timeout=5)
        except FileNotFoundError:
            return False

        passed = 0
        failed = 0
        for line in stdout.splitlines():
            if 'TOTAL:' in line and 'PASSED:' in line:
                parts = line.split(',')
                passed = int(parts[1].split(':')[1].strip())
                failed = int(parts[2].split(':')[1].split('===')[0].strip())
        self.assertGreater(passed, 0, f"No tests were run in browser: {stdout}")
        self.assertEqual(failed, 0, f"Browser test suite had {failed} failures: {stdout}")
        return True

    def _run_chromium(self, test_html):
        """Runs the harness in headless Chromium and returns True when it ran."""
        binary = None
        for name in ('chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome'):
            binary = shutil.which(name)
            if binary:
                break
        if not binary:
            return False

        cmd = [binary, '--headless', '--disable-gpu', '--no-sandbox', '--dump-dom',
               '--virtual-time-budget=8000', 'file://' + test_html]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        except (OSError, subprocess.TimeoutExpired):
            return False

        dom = result.stdout
        counts = {}
        for key in ('totalCount', 'passCount', 'failCount'):
            match = re.search(r'id="' + key + r'">(\d+)<', dom)
            if not match:
                return False
            counts[key] = int(match.group(1))

        self.assertGreater(counts['totalCount'], 0, f"No tests were run in browser: {dom[:500]}")
        self.assertEqual(counts['failCount'], 0,
                         f"Browser test suite had {counts['failCount']} failures")
        return True


if __name__ == '__main__':
    unittest.main()
