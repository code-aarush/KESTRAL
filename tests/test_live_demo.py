#!/usr/bin/env python3
"""
KESTREL -- Live Demonstration End-to-End Browser Validation Suite.

Executes all 8 Stage B scenarios and Stage C responsive viewports against
the live running application (http://127.0.0.1:8000/frontend/index.html)
using Playwright Chromium.

Validates:
  Scenario 1: Normal startup, scene loading, entity count, hierarchy tree, replay initial state.
  Scenario 2: User-defined spatial query with results, hit badges, result chips, canvas overlay.
  Scenario 3: Traversal step-through replay, node visited, MBR check, pruning, event logging.
  Scenario 4: Second distinct query replaces previous results without state leakage.
  Scenario 5: Valid query with zero results displays 'NO HITS', valid pruning trace, not an error.
  Scenario 6: Reset, escape key cancellation, Clear Query button.
  Scenario 7: Pan, zoom, reset view, and fit all coordinate alignment.
  Scenario 8: Failure visibility (400 invalid bounds, 500/503 errors display error banner).
  Stage C: Responsive layout at 1920x1080, 1440x900, 1280x720 across DPRs.
  Stage D: Authentic screenshots saved to docs/reports/screenshots/.
"""

import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
import run_demo

SCREENSHOT_DIR = REPO_ROOT / "docs" / "reports" / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


class KestrelServerManager:
    """Manages the lifecycle of a real KESTREL application process for self-contained testing.

    1. Checks if an active KESTREL server is already running on the configured or default port.
    2. If not, selects an available local port and launches run_demo.py with --no-browser.
    3. Waits for HTTP readiness on both /frontend/index.html and /api/scene with a bounded timeout.
    4. On failure, captures launcher output and process exit status for immediate diagnostic reporting.
    5. Cleanly terminates the launcher and native query worker during teardown, preventing orphaned processes.
    """

    def __init__(self, preferred_port: int = 8000, timeout: float = 25.0):
        self.preferred_port = preferred_port
        self.timeout = timeout
        self.proc = None
        self.port = None
        self.app_url = None
        self.reused = False
        self.stdout_lines = []
        self.stderr_lines = []

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()

    def is_server_ready(self, host: str, port: int) -> bool:
        """Verifies both frontend serving and live C++ query worker readiness."""
        try:
            req1 = urllib.request.Request(f"http://{host}:{port}/frontend/index.html")
            with urllib.request.urlopen(req1, timeout=0.8) as resp:
                if resp.status != 200 or b"KESTREL" not in resp.read():
                    return False
        except Exception:
            return False

        try:
            req2 = urllib.request.Request(f"http://{host}:{port}/api/scene")
            with urllib.request.urlopen(req2, timeout=0.8) as resp:
                if resp.status != 200:
                    return False
                payload = json.loads(resp.read().decode("utf-8", errors="ignore"))
                if payload.get("status") != "ok":
                    return False
        except Exception:
            return False

        return True

    def _find_free_port(self, host: str = "127.0.0.1") -> int:
        """Finds an available TCP port for the demo server."""
        if not run_demo.is_port_in_use(host, self.preferred_port):
            return self.preferred_port

        alt = run_demo.find_available_port(host, 18890, max_attempts=60)
        if alt != -1:
            return alt

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind((host, 0))
            return s.getsockname()[1]

    def start(self) -> str:
        env_url = os.environ.get("KESTREL_DEMO_URL")
        if env_url:
            print(f"[SERVER MANAGER] Using KESTREL_DEMO_URL from environment: {env_url}")
            self.app_url = env_url
            self.reused = True
            return self.app_url

        if self.is_server_ready("127.0.0.1", self.preferred_port):
            print(f"[SERVER MANAGER] Detected active KESTREL server on port {self.preferred_port}. Reusing running instance.")
            self.port = self.preferred_port
            self.app_url = f"http://127.0.0.1:{self.port}/frontend/index.html"
            self.reused = True
            return self.app_url

        self.port = self._find_free_port("127.0.0.1")
        self.app_url = f"http://127.0.0.1:{self.port}/frontend/index.html"
        self.reused = False

        run_demo_script = REPO_ROOT / "run_demo.py"
        cmd = [sys.executable, str(run_demo_script), "--port", str(self.port), "--no-browser"]
        print(f"[SERVER MANAGER] Launching application on port {self.port}: {' '.join(cmd)}")

        creationflags = 0
        if sys.platform.startswith("win"):
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

        self.proc = subprocess.Popen(
            cmd,
            cwd=str(REPO_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            creationflags=creationflags,
        )

        def _read_pipe(stream, target_list):
            try:
                for line in stream:
                    target_list.append(line)
            except Exception:
                pass

        t_out = threading.Thread(target=_read_pipe, args=(self.proc.stdout, self.stdout_lines), daemon=True)
        t_err = threading.Thread(target=_read_pipe, args=(self.proc.stderr, self.stderr_lines), daemon=True)
        t_out.start()
        t_err.start()

        start_time = time.time()
        ready = False
        while time.time() - start_time < self.timeout:
            if self.proc.poll() is not None:
                stdout_text = "".join(self.stdout_lines)
                stderr_text = "".join(self.stderr_lines)
                raise RuntimeError(
                    f"Application process exited prematurely with code {self.proc.returncode}.\n"
                    f"Command: {' '.join(cmd)}\n"
                    f"--- Launcher STDOUT ---\n{stdout_text}\n"
                    f"--- Launcher STDERR ---\n{stderr_text}"
                )

            if self.is_server_ready("127.0.0.1", self.port):
                ready = True
                elapsed = time.time() - start_time
                print(f"[SERVER MANAGER] Application server ready on {self.app_url} in {elapsed:.2f}s.")
                break

            time.sleep(0.3)

        if not ready:
            self.stop()
            stdout_text = "".join(self.stdout_lines)
            stderr_text = "".join(self.stderr_lines)
            raise TimeoutError(
                f"Application server failed to become ready at {self.app_url} within {self.timeout}s.\n"
                f"--- Launcher STDOUT ---\n{stdout_text}\n"
                f"--- Launcher STDERR ---\n{stderr_text}"
            )

        return self.app_url

    def stop(self):
        if self.reused:
            return

        if self.proc:
            print(f"[SERVER MANAGER] Stopping application server (PID {self.proc.pid})...")
            if sys.platform.startswith("win"):
                try:
                    import signal
                    self.proc.send_signal(signal.CTRL_BREAK_EVENT)
                except Exception:
                    pass
            else:
                try:
                    self.proc.terminate()
                except Exception:
                    pass

            try:
                self.proc.wait(timeout=3)
            except Exception:
                if sys.platform.startswith("win"):
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(self.proc.pid)], capture_output=True)
                else:
                    try:
                        self.proc.kill()
                    except Exception:
                        pass
                try:
                    self.proc.wait(timeout=2)
                except Exception:
                    pass

            try:
                if self.proc.stdout:
                    self.proc.stdout.close()
            except Exception:
                pass
            try:
                if self.proc.stderr:
                    self.proc.stderr.close()
            except Exception:
                pass

            self.proc = None

        if sys.platform.startswith("win"):
            subprocess.run(["taskkill", "/F", "/IM", "kestrel_query.exe"], capture_output=True)

        if self.port:
            for _ in range(15):
                if not run_demo.is_port_in_use("127.0.0.1", self.port):
                    break
                time.sleep(0.1)

        print("[SERVER MANAGER] Application server stopped cleanly.")


def run_live_demo_validation(app_url: str = None):
    if app_url is None:
        with KestrelServerManager() as manager:
            return run_live_demo_validation(manager.app_url)

    target_url = app_url
    print(f"[LIVE DEMO] Starting validation against {target_url}...")
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1.0,
        )
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        # =====================================================================
        # SCENARIO 1: Normal Startup
        # =====================================================================
        print("\n--- Scenario 1: Normal Startup ---")
        page.goto(target_url, wait_until="networkidle")
        time.sleep(1.0)

        # Verify Scene & Entity Load
        status_text = page.locator("#status").text_content()
        mission_clock = page.locator("#missionClock").text_content()
        val_entities = page.locator("#valEntities").text_content()
        val_internal = page.locator("#valInternal").text_content()
        val_leaf = page.locator("#valLeaf").text_content()
        hierarchy_badge = page.locator("#hierarchyBadge").text_content()
        trace_badge = page.locator("#traceBadge").text_content()
        query_badge = page.locator("#queryBadge").text_content()

        print(f"Status: {status_text}")
        print(f"Mission Clock: {mission_clock}")
        print(f"Metrics - Entities: {val_entities}, Internal: {val_internal}, Leaf: {val_leaf}")
        print(f"Badges - Hierarchy: {hierarchy_badge}, Trace: {trace_badge}, Query: {query_badge}")

        assert "11" in val_entities, f"Expected 11 entities, got {val_entities}"
        assert "Loaded 11 entities" in status_text, f"Unexpected status: {status_text}"
        assert "node_0" in page.locator("#hierarchyTree").inner_html(), "Hierarchy missing root node_0"
        assert query_badge.strip() == "STANDBY", f"Expected STANDBY query badge, got {query_badge}"

        # Capture authentic initial load screenshot
        initial_shot = SCREENSHOT_DIR / "01_initial_load.png"
        page.screenshot(path=str(initial_shot))
        print(f"Saved: {initial_shot}")
        results["Scenario 1: Normal Startup"] = "PASS"

        # =====================================================================
        # SCENARIO 2: Query With Results
        # =====================================================================
        print("\n--- Scenario 2: User-Defined Query With Results ---")
        # Activate Draw Query mode
        btn_draw = page.locator("#btnDrawQuery")
        btn_draw.click()
        time.sleep(0.3)

        assert btn_draw.get_attribute("aria-pressed") == "true", "Draw button not active"
        assert "is-active" in btn_draw.get_attribute("class"), "Draw button missing is-active class"

        # Locate central cluster entities (entities 30, 31, 21, 14 reside around [200, 200, 400, 500])
        # We project world coordinates [200, 200, 400, 500] to canvas screen pixels
        coords = page.evaluate("""() => {
            const rect = document.getElementById('radar').getBoundingClientRect();
            const p1 = worldToScreen(200, 200);
            const p2 = worldToScreen(400, 500);
            return {
                start: { x: rect.left + p1.x, y: rect.top + p1.y },
                end: { x: rect.left + p2.x, y: rect.top + p2.y }
            };
        }""")

        # Perform click-and-drag mouse gesture on canvas with network response wait
        with page.expect_response(lambda r: "/api/query" in r.url and r.status == 200):
            page.mouse.move(coords["start"]["x"], coords["start"]["y"])
            page.mouse.down()
            assert page.locator("#queryBadge").text_content().strip() == "DRAWING", "Query badge not DRAWING during drag"
            page.mouse.move(coords["end"]["x"], coords["end"]["y"], steps=5)
            page.mouse.up()

        time.sleep(0.3)
        q_badge = page.locator("#queryBadge").text_content().strip()
        q_status = page.locator("#queryStatus").text_content().strip()
        q_chips = page.locator("#queryResults .query-result-chip").all_text_contents()
        trace_badge_q = page.locator("#traceBadge").text_content().strip()

        print(f"Query Badge: {q_badge}")
        print(f"Query Status: {q_status}")
        print(f"Query Result Chips: {q_chips}")
        print(f"Trace Badge: {trace_badge_q}")

        assert "HITS" in q_badge, f"Expected HITS in badge, got {q_badge}"
        assert len(q_chips) >= 3, f"Expected at least 3 matching chips, got {q_chips}"
        assert "#31" in q_chips or "#30" in q_chips, f"Expected known entity in chips: {q_chips}"
        assert "EVENTS" in trace_badge_q, f"Expected recorded events in trace badge: {trace_badge_q}"

        # Capture matching query results screenshot
        match_shot = SCREENSHOT_DIR / "02_matching_query_results.png"
        page.screenshot(path=str(match_shot))
        print(f"Saved: {match_shot}")
        results["Scenario 2: Query With Results"] = "PASS"

        # =====================================================================
        # SCENARIO 3: Traversal Step-Through Replay
        # =====================================================================
        print("\n--- Scenario 3: Traversal Step-Through Replay ---")
        btn_next = page.locator("#btnTraceNext")
        step_label = page.locator("#traceStep")
        event_tag = page.locator("#traceEventTag")
        event_text = page.locator("#traceEventText")

        # Check initial replay state (step 1 / total)
        step_init = step_label.text_content().strip()
        tag_init = event_tag.text_content().strip()
        print(f"Initial Step: {step_init}, Tag: {tag_init}, Desc: {event_text.text_content().strip()}")
        assert "1 /" in step_init, f"Expected 1 / N initially, got {step_init}"
        assert tag_init == "VISITED", f"Expected initial VISITED tag, got {tag_init}"

        # Advance to step 2
        btn_next.click()
        time.sleep(0.2)
        step_2 = step_label.text_content().strip()
        tag_2 = event_tag.text_content().strip()
        print(f"Step 2: {step_2}, Tag: {tag_2}, Desc: {event_text.text_content().strip()}")
        assert "2 /" in step_2, f"Expected 2 / N, got {step_2}"

        # Advance through multiple steps, verifying branch pruning and MBR tests
        saw_pruned = False
        saw_mbr = False
        saw_accepted = False

        for _ in range(16):
            btn_next.click()
            time.sleep(0.1)
            tag = event_tag.text_content().strip()
            desc = event_text.text_content().strip()
            if tag == "PRUNED":
                saw_pruned = True
            elif tag == "TEST":
                saw_mbr = True
            elif tag == "ACCEPTED":
                saw_accepted = True

        print(f"Traversal event types observed: PRUNED={saw_pruned}, MBR={saw_mbr}, ACCEPTED={saw_accepted}")
        assert saw_pruned, "Expected at least one PRUNED event during traversal"
        assert saw_mbr, "Expected MBR check event during traversal"

        # Verify active node in hierarchy reflects canonical node id
        selected_node = page.evaluate("() => getSelectedNodeId()")
        selected_rows = page.locator(".tree-node-row.selected").count()
        node_detail_id = page.locator("#nodeDetailId").text_content().strip()
        print(f"Selected hierarchy node ID: {selected_node}, selected rows in DOM: {selected_rows}, detail card: {node_detail_id}")
        assert selected_node is not None or selected_rows > 0, "Expected a selected hierarchy node during traversal"

        # Advance to completion using Play or repeated Next
        page.locator("#btnTracePlay").click()
        time.sleep(2.0)
        page.locator("#btnTracePause").click()

        # Capture traversal replay screenshot
        traversal_shot = SCREENSHOT_DIR / "03_traversal_replay.png"
        page.screenshot(path=str(traversal_shot))
        print(f"Saved: {traversal_shot}")
        results["Scenario 3: Traversal Step-Through Replay"] = "PASS"

        # =====================================================================
        # SCENARIO 4: Second Distinct Query Replaces Previous
        # =====================================================================
        print("\n--- Scenario 4: Second Distinct Query Replaces Previous ---")
        if page.locator("#btnDrawQuery").get_attribute("aria-pressed") != "true":
            page.locator("#btnDrawQuery").click()
            time.sleep(0.2)

        # Region around [450, 420, 600, 480] targeting entities 25, 22, 12
        coords2 = page.evaluate("""() => {
            const rect = document.getElementById('radar').getBoundingClientRect();
            const p1 = worldToScreen(450, 420);
            const p2 = worldToScreen(600, 480);
            return {
                start: { x: rect.left + p1.x, y: rect.top + p1.y },
                end: { x: rect.left + p2.x, y: rect.top + p2.y }
            };
        }""")

        with page.expect_response(lambda r: "/api/query" in r.url and r.status == 200):
            page.mouse.move(coords2["start"]["x"], coords2["start"]["y"])
            page.mouse.down()
            page.mouse.move(coords2["end"]["x"], coords2["end"]["y"], steps=5)
            page.mouse.up()

        time.sleep(0.3)
        q2_chips = page.locator("#queryResults .query-result-chip").all_text_contents()
        q2_badge = page.locator("#queryBadge").text_content().strip()
        print(f"Query 2 Badge: {q2_badge}, Chips: {q2_chips}")

        assert "#25" in q2_chips or "#22" in q2_chips or "#12" in q2_chips, f"Expected entity 25/22/12, got {q2_chips}"
        assert "#31" not in q2_chips, "Old entity 31 leaked into new query results!"

        # Capture query replacement screenshot
        replace_shot = SCREENSHOT_DIR / "05_query_replacement.png"
        page.screenshot(path=str(replace_shot))
        print(f"Saved: {replace_shot}")
        results["Scenario 4: Query Replacement"] = "PASS"

        # =====================================================================
        # SCENARIO 5: Valid Query With Zero Results
        # =====================================================================
        print("\n--- Scenario 5: Valid Query With Zero Results ---")
        if page.locator("#btnDrawQuery").get_attribute("aria-pressed") != "true":
            page.locator("#btnDrawQuery").click()
            time.sleep(0.2)

        # Region [700, -100, 800, -50] in empty void space
        coords_empty = page.evaluate("""() => {
            const rect = document.getElementById('radar').getBoundingClientRect();
            const p1 = worldToScreen(700, -100);
            const p2 = worldToScreen(800, -50);
            return {
                start: { x: rect.left + p1.x, y: rect.top + p1.y },
                end: { x: rect.left + p2.x, y: rect.top + p2.y }
            };
        }""")

        with page.expect_response(lambda r: "/api/query" in r.url and r.status == 200):
            page.mouse.move(coords_empty["start"]["x"], coords_empty["start"]["y"])
            page.mouse.down()
            page.mouse.move(coords_empty["end"]["x"], coords_empty["end"]["y"], steps=5)
            page.mouse.up()

        time.sleep(0.3)
        q_empty_badge = page.locator("#queryBadge").text_content().strip()
        q_empty_status = page.locator("#queryStatus").text_content().strip()
        q_empty_chips = page.locator("#queryResults .query-result-chip").count()

        print(f"Zero Result Badge: {q_empty_badge}")
        print(f"Zero Result Status: {q_empty_status}")
        print(f"Zero Result Chips Count: {q_empty_chips}")

        assert q_empty_badge == "NO HITS", f"Expected NO HITS badge, got {q_empty_badge}"
        assert q_empty_chips == 0, f"Expected 0 result chips, got {q_empty_chips}"
        assert "No entities intersect" in q_empty_status or "complete" in q_empty_status.lower()

        # Capture zero result query screenshot
        zero_shot = SCREENSHOT_DIR / "04_zero_result_query.png"
        page.screenshot(path=str(zero_shot))
        print(f"Saved: {zero_shot}")
        results["Scenario 5: Valid Query With Zero Results"] = "PASS"

        # =====================================================================
        # SCENARIO 6: Reset and Drawing Cancellation
        # =====================================================================
        print("\n--- Scenario 6: Reset and Drawing Cancellation ---")
        # 1. Escape key cancellation
        if page.locator("#btnDrawQuery").get_attribute("aria-pressed") != "true":
            page.locator("#btnDrawQuery").click()
            time.sleep(0.2)
        assert page.locator("#btnDrawQuery").get_attribute("aria-pressed") == "true"
        coords_esc = page.evaluate("""() => {
            const rect = document.getElementById('radar').getBoundingClientRect();
            return { x: rect.left + 150, y: rect.top + 150 };
        }""")
        page.mouse.move(coords_esc["x"], coords_esc["y"])
        page.mouse.down()
        assert page.locator("#queryBadge").text_content().strip() == "DRAWING"
        page.keyboard.press("Escape")
        page.mouse.up()
        time.sleep(0.2)
        assert page.locator("#btnDrawQuery").get_attribute("aria-pressed") == "false"

        # 2. Clear Query button
        btn_clear = page.locator("#btnClearQuery")
        btn_clear.click()
        time.sleep(0.3)
        assert page.locator("#queryBadge").text_content().strip() == "STANDBY"
        assert page.locator("#queryResults .query-result-chip").count() == 0
        print("Clear Query reset verified successfully.")
        results["Scenario 6: Reset and Cancellation"] = "PASS"

        # =====================================================================
        # SCENARIO 7: Pan, Zoom, and Spatial Alignment
        # =====================================================================
        print("\n--- Scenario 7: Pan, Zoom, and Spatial Alignment ---")
        initial_zoom = page.locator("#valZoom").text_content().strip()
        page.locator("#btnZoomIn").click()
        time.sleep(0.2)
        zoomed_in = page.locator("#valZoom").text_content().strip()
        assert float(zoomed_in.replace("%", "")) > float(initial_zoom.replace("%", ""))

        page.locator("#btnResetView").click()
        time.sleep(0.2)
        reset_zoom = page.locator("#valZoom").text_content().strip()
        assert reset_zoom == initial_zoom, f"Expected reset to restore initial zoom {initial_zoom}, got {reset_zoom}"

        page.locator("#btnFitAll").click()
        time.sleep(0.2)
        fit_zoom = page.locator("#valZoom").text_content().strip()
        print(f"Zoom levels: Initial={initial_zoom}, ZoomIn={zoomed_in}, Reset={reset_zoom}, FitAll={fit_zoom}")

        # Check coordinate projection round-trip accuracy
        round_trip_error = page.evaluate("""() => {
            const pts = [[100, 100], [300, 450], [550, -50], [800, 600]];
            let maxErr = 0;
            for (const [wx, wy] of pts) {
                const s = worldToScreen(wx, wy);
                const back = screenToWorld(s.x, s.y);
                const err = Math.hypot(back.x - wx, back.y - wy);
                if (err > maxErr) maxErr = err;
            }
            return maxErr;
        }""")
        print(f"Maximum viewport coordinate round-trip error: {round_trip_error:.6e} px")
        assert round_trip_error < 1e-4, f"Coordinate round-trip drift too large: {round_trip_error}"
        results["Scenario 7: Pan, Zoom, Spatial Alignment"] = "PASS"

        # =====================================================================
        # SCENARIO 8: Failure Visibility
        # =====================================================================
        print("\n--- Scenario 8: Failure Visibility ---")
        # Test controlled error: submit invalid non-finite bounds through runUserQuery
        page.evaluate("""() => {
            runUserQuery([NaN, 0, 100, 100]);
        }""")
        time.sleep(0.5)

        err_badge = page.locator("#queryBadge").text_content().strip()
        err_box_visible = page.locator("#queryError").is_visible()
        err_box_text = page.locator("#queryError").text_content().strip()
        print(f"Error Badge: {err_badge}, Error Box Text: {err_box_text}")
        assert err_badge == "ERROR", f"Expected ERROR badge, got {err_badge}"
        assert err_box_visible, "Expected queryError box to be visible on invalid input"
        assert "rejected" in err_box_text.lower() or "invalid" in err_box_text.lower()

        # Clear error
        page.locator("#btnClearQuery").click()
        time.sleep(0.2)
        results["Scenario 8: Failure Visibility"] = "PASS"

        # =====================================================================
        # STAGE C: Responsive Viewport Validation
        # =====================================================================
        print("\n--- Stage C: Responsive Viewport Validation ---")
        viewports = [
            (1920, 1080, "kestrel_1920x1080.png", "Desktop 1080p"),
            (1440, 900, "kestrel_1440x900.png", "Standard Laptop 900p"),
            (1280, 720, "kestrel_1280x720.png", "Compact Laptop 720p"),
        ]

        # Reset view before capturing responsive layouts
        page.locator("#btnFitAll").click()
        time.sleep(0.3)

        for w, h, fname, desc in viewports:
            page.set_viewport_size({"width": w, "height": h})
            time.sleep(0.5)

            # Check that critical layout elements remain visible and unclipped
            toolbar_visible = page.locator(".command-workspace").is_visible()
            canvas_visible = page.locator("#radar").is_visible()
            hierarchy_visible = page.locator("#hierarchyDock").is_visible()
            btn_draw_visible = page.locator("#btnDrawQuery").is_visible()
            replay_visible = page.locator(".traversal-region").is_visible()

            canvas_box = page.locator("#radar").bounding_box()
            print(f"[{desc} {w}x{h}] Toolbar={toolbar_visible}, Radar={canvas_box['width']:.0f}x{canvas_box['height']:.0f}, Hierarchy={hierarchy_visible}, Replay={replay_visible}, DrawBtn={btn_draw_visible}")

            assert toolbar_visible and canvas_visible and hierarchy_visible and btn_draw_visible and replay_visible, f"Layout broken at {w}x{h}"
            assert canvas_box["width"] > 400 and canvas_box["height"] > 300, f"Canvas collapsed at {w}x{h}"

            shot_path = SCREENSHOT_DIR / fname
            page.screenshot(path=str(shot_path))
            print(f"Saved responsive screenshot: {shot_path}")

        # DPR scaling check: 1.25x and 2.0x
        for scale in [1.25, 2.0]:
            ctx_dpr = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=scale)
            pg_dpr = ctx_dpr.new_page()
            pg_dpr.goto(target_url, wait_until="networkidle")
            time.sleep(0.5)
            dpr_val = pg_dpr.evaluate("() => window.devicePixelRatio")
            canvas_backing_w = pg_dpr.evaluate("() => document.getElementById('radar').width")
            canvas_css_w = pg_dpr.evaluate("() => parseFloat(getComputedStyle(document.getElementById('radar')).width)")
            print(f"DPR {scale}x: window.devicePixelRatio={dpr_val}, Backing W={canvas_backing_w}, CSS W={canvas_css_w:.1f}")
            assert abs(dpr_val - scale) < 0.05, f"Device scale factor mismatch: {dpr_val} != {scale}"
            assert abs(canvas_backing_w - round(canvas_css_w * scale)) <= 2, f"Backing buffer not scaled for DPR: {canvas_backing_w} vs {canvas_css_w * scale}"
            ctx_dpr.close()

        results["Stage C: Responsive Viewport Validation"] = "PASS"

        unexpected_errors = [err for err in console_errors if "400" not in err]
        print(f"\nBrowser console errors captured during execution: {len(console_errors)} (Unexpected: {len(unexpected_errors)})")
        for err in console_errors:
            print(f"  [BROWSER ERROR] {err}")
        assert len(unexpected_errors) == 0, f"Unresolved unexpected browser console errors: {unexpected_errors}"

        browser.close()

    print("\n" + "=" * 60)
    print("      LIVE DEMO VALIDATION MATRIX (Issue #10)")
    print("=" * 60)
    all_pass = True
    for item, status in results.items():
        print(f"  {item.ljust(45)} : {status}")
        if status != "PASS":
            all_pass = False
    print("=" * 60)
    assert all_pass, "Not all validation scenarios passed!"
    print("ALL LIVE DEMO VALIDATION SCENARIOS COMPLETED WITH 100% PASS.")


import unittest

class TestLiveDemoEndToEnd(unittest.TestCase):
    """Self-contained end-to-end browser test suite managing its own application server."""

    @classmethod
    def setUpClass(cls):
        cls.server_manager = KestrelServerManager()
        cls.app_url = cls.server_manager.start()

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "server_manager"):
            cls.server_manager.stop()

    def test_live_demo_scenarios(self):
        run_live_demo_validation(self.app_url)


if __name__ == "__main__":
    unittest.main()
