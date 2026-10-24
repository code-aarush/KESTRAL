#!/usr/bin/env python3
"""
Tests for the KESTREL user defined spatial query.

Three layers are covered:

1. The C++ query service (``kestrel_query``) is driven directly over its
   line protocol: the request contract, the validation rules, the returned
   entity ids, and the traversal trace.
2. The local HTTP API (``query_api``) is exercised through a real HTTP
   request, including error paths and trace response.
3. The browser harness (``frontend/test_query.html``) is executed in a
   headless browser when available and must pass completely.

The C++ binary is expected in ``build/src`` or ``build``. The binary and browser
tests are skipped when they are not available, so pure Python tests always run.
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

# Locate kestrel_query executable across standard build directory layouts
candidate_paths = [
    os.path.join(REPO_ROOT, 'build', 'src', 'kestrel_query'),
    os.path.join(REPO_ROOT, 'build', 'kestrel_query'),
    os.path.join(REPO_ROOT, 'build', 'src', 'kestrel_query.exe'),
    os.path.join(REPO_ROOT, 'build', 'kestrel_query.exe')
]
QUERY_EXE = None
for p in candidate_paths:
    if os.path.exists(p) and os.path.isfile(p):
        QUERY_EXE = p
        break
if QUERY_EXE is None:
    QUERY_EXE = candidate_paths[2] if os.name == 'nt' else candidate_paths[0]


class QueryServiceProcessTest(unittest.TestCase):
    """Drives the C++ query service directly through stdin/stdout."""

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

    def ask(self, payload: str) -> dict:
        line = self.worker.request(payload)
        self.assertIsNotNone(line, f"service did not answer: {payload!r}")
        try:
            return json.loads(line)
        except ValueError:
            self.fail(f"service produced non-JSON answer: {line!r}")

    def test_scene_operation_returns_identity(self):
        answer = self.ask('{"op":"scene"}')
        self.assertEqual(answer['status'], 'ok')
        self.assertIn('scene_key', answer)
        self.assertIn('entity_count', answer)
        self.assertGreater(answer['entity_count'], 0)

    def test_query_returns_entity_ids(self):
        answer = self.ask('{"op":"query","bounds":[200,200,600,400]}')
        self.assertIn(answer['status'], ('ok', 'empty'))
        self.assertIsInstance(answer['results'], list)
        self.assertIn('nodes_visited', answer['metrics'])

    def test_query_returns_trace_with_canonical_ids(self):
        answer = self.ask('{"op":"query","bounds":[200,200,600,400]}')
        self.assertIn(answer['status'], ('ok', 'empty'))
        self.assertIn('trace', answer)
        trace = answer['trace']
        self.assertIsInstance(trace, dict)
        self.assertIn('total_events', trace)
        self.assertGreater(trace['total_events'], 0)
        self.assertIn('events', trace)
        self.assertIsInstance(trace['events'], list)
        self.assertIn('scene_id', answer)
        self.assertEqual(trace['scene_id'], answer['scene_id'])
        # Check canonical node identifiers
        node_ids = [ev.get('node_id') for ev in trace['events'] if ev.get('node_id')]
        self.assertTrue(any(nid.startswith('node_') for nid in node_ids))

    def test_empty_region_is_reported_as_empty(self):
        answer = self.ask('{"op":"query","bounds":[-9000,-9000,-8000,-8000]}')
        self.assertEqual(answer['status'], 'empty')
        self.assertEqual(answer['results'], [])
        self.assertIn('trace', answer)

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

    def test_repeated_consecutive_queries_stability(self):
        """20 consecutive queries in loop return deterministic results and stable state."""
        baseline = self.ask('{"op":"query","bounds":[270,280,285,295]}')
        self.assertEqual(baseline['status'], 'ok')
        for _ in range(20):
            res = self.ask('{"op":"query","bounds":[270,280,285,295]}')
            self.assertEqual(res['status'], 'ok')
            self.assertEqual(res['results'], baseline['results'])
            self.assertEqual(res['scene_key'], baseline['scene_key'])
            self.assertEqual(res['scene_id'], baseline['scene_id'])
            self.assertEqual(res['metrics']['nodes_visited'], baseline['metrics']['nodes_visited'])


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

    def test_query_endpoint_returns_ids_and_trace(self):
        status, payload = self.post('/api/query', '{"bounds":[200,200,600,400]}')
        self.assertEqual(status, 200)
        self.assertIn(payload['status'], ('ok', 'empty'))
        self.assertIsInstance(payload['results'], list)
        self.assertIn('trace', payload)
        self.assertIsInstance(payload['trace'], dict)
        self.assertIn('events', payload['trace'])

    def test_end_to_end_deliberately_different_queries(self):
        # Query A: matches entity 30 in leaf node 3
        status_a, payload_a = self.post('/api/query', '{"bounds":[270, 280, 285, 295]}')
        self.assertEqual(status_a, 200)
        self.assertEqual(payload_a['status'], 'ok')
        self.assertEqual(payload_a['results'], [30])
        self.assertIn('trace', payload_a)
        trace_a = payload_a['trace']
        self.assertGreater(len(trace_a['events']), 0)
        # Verify canonical hierarchy node IDs in trace events
        visited_nodes_a = [e['node_id'] for e in trace_a['events'] if 'node_id' in e]
        self.assertIn('node_0', visited_nodes_a)

        # Query B: matches entities 20, 21, 14 in leaf node 1
        status_b, payload_b = self.post('/api/query', '{"bounds":[299, 402, 330, 650]}')
        self.assertEqual(status_b, 200)
        self.assertEqual(payload_b['status'], 'ok')
        self.assertEqual(payload_b['results'], [20, 21, 14])
        self.assertIn('trace', payload_b)
        trace_b = payload_b['trace']
        self.assertGreater(len(trace_b['events']), 0)

        # Invariant checks: different results, different queries, same scene_key, distinct scene_id
        self.assertNotEqual(payload_a['results'], payload_b['results'])
        self.assertNotEqual(payload_a['query']['bounds'], payload_b['query']['bounds'])
        self.assertEqual(payload_a['scene_key'], payload_b['scene_key'])
        self.assertNotEqual(payload_a['scene_id'], payload_b['scene_id'])

    def test_end_to_end_empty_query(self):
        status, payload = self.post('/api/query', '{"bounds":[2000,2000,2100,2100]}')
        self.assertEqual(status, 200)
        self.assertEqual(payload['status'], 'empty')
        self.assertEqual(payload['results'], [])
        self.assertIn('trace', payload)
        self.assertGreater(len(payload['trace']['events']), 0)
        self.assertGreaterEqual(payload['metrics']['nodes_visited'], 1)

    def test_end_to_end_boundary_match(self):
        # Exact boundary touch of Entity 30 (min_x = 273.93313238918563)
        status, payload = self.post('/api/query', '{"bounds":[260, 280, 273.93313238918563, 290]}')
        self.assertEqual(status, 200)
        self.assertEqual(payload['status'], 'ok')
        self.assertIn(30, payload['results'])

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

    def test_query_endpoint_rejects_oversized_payload(self):
        huge_body = '{"bounds":[0,0,10,10],"padding":"' + ('x' * (query_api.MAX_REQUEST_BYTES + 100)) + '"}'
        status, payload = self.post('/api/query', huge_body)
        self.assertEqual(status, 400)
        self.assertEqual(payload['status'], 'invalid')
        self.assertIn('too large', payload['message'])

    def test_query_endpoint_sanitizes_multiline_payload(self):
        multiline_body = '{\n"bounds":\n[\n270,\n280,\n285,\n295\n]\n}'
        status, payload = self.post('/api/query', multiline_body)
        self.assertEqual(status, 200)
        self.assertEqual(payload['status'], 'ok')
        self.assertEqual(payload['results'], [30])

    def test_query_endpoint_handles_missing_worker(self):
        orig_worker = query_api.QueryApiMixin.worker
        try:
            query_api.QueryApiMixin.worker = None
            status, payload = self.post('/api/query', '{"bounds":[200,200,600,400]}')
            self.assertEqual(status, 503)
            self.assertEqual(payload['status'], 'unavailable')
        finally:
            query_api.QueryApiMixin.worker = orig_worker

    def test_query_endpoint_handles_unreadable_worker_response(self):
        class BrokenWorker:
            def request(self, payload):
                return "BROKEN NON-JSON RESPONSE"

        orig_worker = query_api.QueryApiMixin.worker
        try:
            query_api.QueryApiMixin.worker = BrokenWorker()
            status, payload = self.post('/api/query', '{"bounds":[200,200,600,400]}')
            self.assertEqual(status, 500)
            self.assertEqual(payload['status'], 'error')
            self.assertIn('unreadable answer', payload['message'])
        finally:
            query_api.QueryApiMixin.worker = orig_worker

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
        binary = None
        for name in (
            'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome', 'msedge',
            r'C:\Program Files\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
            r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
        ):
            if os.path.isabs(name) and os.path.exists(name):
                binary = name
                break
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
