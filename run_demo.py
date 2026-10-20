#!/usr/bin/env python3
"""
KESTREL -- Single-Command Demo Launcher
Orchestrates C++ simulation, R-tree state export, and browser Mission Control frontend.

Usage:
    python run_demo.py [OPTIONS]

Options:
    --port PORT        Port to serve frontend on (default: 8000)
    --host HOST        Host to bind server to (default: 127.0.0.1)
    --rebuild          Force rebuild of C++ demo and exporter targets
    --no-browser       Do not automatically open the default web browser
    --once             Run simulation, export, and exit without starting HTTP server
    --help, -h         Show this help message and exit
"""

import argparse
import http.server
import json
import os
import shutil
import socket
import socketserver
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

# Ensure line-buffered UTF-8 console output
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    except Exception:
        pass

# Paths relative to this script
REPO_ROOT = Path(__file__).resolve().parent
BUILD_DIR = REPO_ROOT / "build"
SRC_DIR = REPO_ROOT / "src"
FRONTEND_DIR = REPO_ROOT / "frontend"

IS_WINDOWS = sys.platform.startswith("win")
EXE_EXT = ".exe" if IS_WINDOWS else ""

DEMO_EXE = BUILD_DIR / "src" / f"kestrel_demo{EXE_EXT}"
EXPORT_EXE = BUILD_DIR / "src" / f"kestrel_export{EXE_EXT}"
STATE_JSON_BUILD = BUILD_DIR / "state.json"
STATE_JSON_ROOT = REPO_ROOT / "state.json"
STATE_JSON_FRONTEND = FRONTEND_DIR / "state.json"


def log(stage: str, msg: str):
    """Format console output with stage headers."""
    print(f"[{stage}] {msg}", flush=True)


def log_err(msg: str):
    """Print an error message to stderr."""
    sys.stderr.write(f"\n[ERROR] {msg}\n")
    sys.stderr.flush()


class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler with no-cache headers to ensure state.json updates reflect immediately."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress routine GET logging to keep console clean
        if args and str(args[1]) in ("404", "500"):
            super().log_message(format, *args)


def preflight_check() -> bool:
    """Check required dependencies and directory structure."""
    log("PREFLIGHT", "Verifying environment and repository dependencies...")

    if not (REPO_ROOT / "CMakeLists.txt").exists():
        log_err(f"Invalid repository root: CMakeLists.txt not found in {REPO_ROOT}")
        return False

    if not FRONTEND_DIR.exists() or not (FRONTEND_DIR / "index.html").exists():
        log_err(f"Frontend directory missing or incomplete: {FRONTEND_DIR}")
        return False

    # Check for CMake on PATH
    cmake_path = shutil.which("cmake")
    if not cmake_path:
        log_err(
            "CMake not found on PATH.\n"
            "Please install CMake 3.20+ or ensure it is added to your PATH environment variable.\n"
            "On Windows (MSYS2): pacman -S mingw-w64-ucrt-x86_64-cmake\n"
            "Or install from https://cmake.org/download/"
        )
        return False

    # Check for a C++ compiler on PATH
    cxx_compilers = ["g++", "clang++", "c++", "cl"]
    found_cxx = any(shutil.which(c) for c in cxx_compilers)
    if not found_cxx:
        log_err(
            "No C++ compiler found on PATH (g++, clang++, c++, or cl).\n"
            "Please ensure a C++17 compliant compiler is installed and available in PATH."
        )
        return False

    log("PREFLIGHT", "All required tools (CMake, C++ compiler, Python) verified.")
    return True


def check_stale_build() -> bool:
    """Determine whether executables are missing or older than any source file."""
    if not DEMO_EXE.exists() or not EXPORT_EXE.exists():
        return True

    exe_mtime = min(DEMO_EXE.stat().st_mtime, EXPORT_EXE.stat().st_mtime)

    # Check all C++ source and header files in src/
    for src_file in SRC_DIR.glob("**/*"):
        if src_file.suffix in (".cpp", ".h", ".hpp"):
            if src_file.stat().st_mtime > exe_mtime:
                return True

    return False


def build_targets(force_rebuild: bool = False) -> bool:
    """Configure and build CMake demo and export executables."""
    needs_build = force_rebuild or check_stale_build()
    if not needs_build:
        log("BUILD", "Executables are up-to-date. Skipping build stage.")
        return True

    log("BUILD", "Configuring and building CMake targets (kestrel_demo, kestrel_export)...")
    BUILD_DIR.mkdir(exist_ok=True)

    # 1. CMake Configure if not already configured
    cmake_cache = BUILD_DIR / "CMakeCache.txt"
    if not cmake_cache.exists() or force_rebuild:
        configure_cmd = ["cmake", "-B", str(BUILD_DIR)]
        if IS_WINDOWS:
            if shutil.which("mingw32-make") or shutil.which("g++"):
                configure_cmd.extend(["-G", "MinGW Makefiles"])
        log("BUILD", f"Running: {' '.join(configure_cmd)}")
        try:
            res = subprocess.run(configure_cmd, cwd=str(REPO_ROOT), capture_output=True, text=True)
            if res.returncode != 0:
                log_err(f"CMake configuration failed:\n{res.stderr or res.stdout}")
                return False
        except Exception as e:
            log_err(f"Failed to execute cmake configure: {e}")
            return False

    # 2. CMake Build targets
    build_cmd = ["cmake", "--build", str(BUILD_DIR), "--target", "kestrel_demo", "kestrel_export"]
    log("BUILD", f"Running: {' '.join(build_cmd)}")
    try:
        res = subprocess.run(build_cmd, cwd=str(REPO_ROOT), capture_output=True, text=True)
        if res.returncode != 0:
            log_err(f"CMake build failed:\n{res.stderr or res.stdout}")
            return False
    except Exception as e:
        log_err(f"Failed to execute cmake build: {e}")
        return False

    if not DEMO_EXE.exists() or not EXPORT_EXE.exists():
        log_err(f"Build succeeded but executables not found:\n  {DEMO_EXE}\n  {EXPORT_EXE}")
        return False

    log("BUILD", "Build completed successfully with 0 errors.")
    return True


def run_simulation() -> bool:
    """Execute the C++ simulation demo and verify successful completion."""
    log("SIMULATION", f"Running C++ simulation demo ({DEMO_EXE.name})...")
    try:
        res = subprocess.run([str(DEMO_EXE)], cwd=str(REPO_ROOT), capture_output=True, text=True)
        if res.returncode != 0:
            log_err(f"Simulation failed with exit code {res.returncode}:\n{res.stderr}")
            return False

        # Output highlights
        for line in res.stdout.strip().splitlines():
            print(f"  | {line}", flush=True)

        if "Completed Successfully" not in res.stdout:
            log_err("Simulation output did not contain expected completion confirmation.")
            return False

        log("SIMULATION", "Simulation completed successfully.")
        return True
    except Exception as e:
        log_err(f"Failed to launch simulation executable: {e}")
        return False


def export_and_validate_state() -> bool:
    """Run exporter and validate generated JSON state schema."""
    log("EXPORT", f"Exporting R-tree and simulation state ({EXPORT_EXE.name})...")
    try:
        # Export directly to build/state.json
        res = subprocess.run([str(EXPORT_EXE), str(STATE_JSON_BUILD)], cwd=str(REPO_ROOT), capture_output=True, text=True)
        if res.returncode != 0:
            log_err(f"Export failed with exit code {res.returncode}:\n{res.stderr}")
            return False

        if not STATE_JSON_BUILD.exists():
            log_err(f"Expected export file not found: {STATE_JSON_BUILD}")
            return False

        # Also sync to repo root state.json for fallback compatibility
        shutil.copyfile(str(STATE_JSON_BUILD), str(STATE_JSON_ROOT))

        # The visualizer resolves "./state.json" relative to the page first, so
        # the copy that ships next to index.html must carry the same scene
        # (including the recorded traversal trace).
        shutil.copyfile(str(STATE_JSON_BUILD), str(STATE_JSON_FRONTEND))

        # Validate JSON content
        with open(STATE_JSON_BUILD, "r", encoding="utf-8") as fp:
            data = json.load(fp)

        # Schema checks
        required_keys = {"entities", "rtree", "query"}
        if not required_keys.issubset(data.keys()):
            log_err(f"Invalid state JSON schema. Missing keys: {required_keys - set(data.keys())}")
            return False

        entities = data.get("entities", [])
        rtree = data.get("rtree", {})
        query = data.get("query", {})

        leaf_mbrs = rtree.get("leaf_mbrs", [])
        internal_mbrs = rtree.get("internal_mbrs", [])
        query_results = query.get("results", [])
        trace = data.get("trace", {})
        trace_events = trace.get("events", []) if isinstance(trace, dict) else []

        if not isinstance(entities, list) or len(entities) == 0:
            log_err("State validation failed: entities list is empty or invalid.")
            return False

        log(
            "VALIDATE",
            f"State JSON verified: {len(entities)} active entities, "
            f"{len(leaf_mbrs)} leaf MBRs, {len(internal_mbrs)} internal MBRs, "
            f"{len(query_results)} query matches, "
            f"{len(trace_events)} recorded traversal events."
        )
        return True

    except json.JSONDecodeError as e:
        log_err(f"Failed to parse exported state JSON: {e}")
        return False
    except Exception as e:
        log_err(f"Error during state export: {e}")
        return False


def is_port_in_use(host: str, port: int) -> bool:
    """Check if a TCP port is in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def is_kestrel_server(host: str, port: int) -> bool:
    """Check if an active server on host:port is already serving KESTREL frontend."""
    url = f"http://{host}:{port}/frontend/index.html"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "KestrelLauncher"})
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            content = resp.read().decode("utf-8", errors="ignore")
            return resp.status == 200 and "KESTREL" in content
    except Exception:
        return False


def find_available_port(host: str, start_port: int, max_attempts: int = 10) -> int:
    """Find the first available port starting from start_port."""
    for p in range(start_port, start_port + max_attempts):
        if not is_port_in_use(host, p):
            return p
    return -1


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def start_server(host: str, port: int) -> tuple[ThreadingHTTPServer | None, int, bool]:
    """
    Start local HTTP server or detect existing KESTREL server.
    Returns (server_instance, effective_port, is_reused).
    """
    if is_port_in_use(host, port):
        if is_kestrel_server(host, port):
            log("SERVER", f"Existing KESTREL server detected on http://{host}:{port}. Reusing active server.")
            return None, port, True
        else:
            log("SERVER", f"Port {port} is occupied by another process. Searching for available port...")
            alt_port = find_available_port(host, port + 1)
            if alt_port == -1:
                log_err(f"Could not find an open port in range {port}-{port+10}.")
                return None, port, False
            port = alt_port

    try:
        server = ThreadingHTTPServer((host, port), NoCacheHTTPRequestHandler)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()

        # Wait until server is listening
        attempts = 0
        while not is_port_in_use(host, port) and attempts < 20:
            time.sleep(0.05)
            attempts += 1

        log("SERVER", f"HTTP server started successfully on http://{host}:{port}")
        return server, port, False
    except Exception as e:
        log_err(f"Failed to start HTTP server on {host}:{port}: {e}")
        return None, port, False


def main():
    parser = argparse.ArgumentParser(
        description="KESTREL Single-Command Demo Launcher -- Orchestrates simulation, export, and UI.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--port", type=int, default=8000, help="Port to serve frontend on (default: 8000)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host address (default: 127.0.0.1)")
    parser.add_argument("--rebuild", action="store_true", help="Force rebuild of C++ binaries")
    parser.add_argument("--no-browser", action="store_true", help="Do not open default web browser")
    parser.add_argument("--once", action="store_true", help="Run simulation, export, and validate state without starting the server")
    args = parser.parse_args()

    print("=" * 68, flush=True)
    print("      KESTREL - Mission Control Demo Launcher (C++17 / HTML5 Canvas)", flush=True)
    print("=" * 68, flush=True)

    # 1. Preflight
    if not preflight_check():
        sys.exit(1)

    # 2. Build
    if not build_targets(force_rebuild=args.rebuild):
        sys.exit(1)

    # 3. Simulation
    if not run_simulation():
        sys.exit(1)

    # 4. Export & Validate
    if not export_and_validate_state():
        sys.exit(1)

    if args.once:
        log("COMPLETE", "Simulation, export, and validation completed (--once specified).")
        return

    # 5. Validate port range
    if not (1 <= args.port <= 65535):
        log_err(f"Invalid port: {args.port}. Port must be between 1 and 65535.")
        sys.exit(1)

    # 6. Serve
    server, effective_port, is_reused = start_server(args.host, args.port)
    if server is None and not is_reused:
        sys.exit(1)

    frontend_url = f"http://{args.host}:{effective_port}/frontend/index.html"

    # 6. Open Browser
    if not args.no_browser:
        log("BROWSER", f"Launching Mission Control in default browser: {frontend_url}")
        webbrowser.open(frontend_url)
    else:
        log("BROWSER", f"Browser launch skipped (--no-browser). URL: {frontend_url}")

    print("-" * 68, flush=True)
    print("  [>] Mission Control is active at:", flush=True)
    print(f"      {frontend_url}", flush=True)
    print("  [>] Controls:", flush=True)
    if is_reused:
        print("      * Reusing background server. You may close this terminal at any time.", flush=True)
        print("      * Press Ctrl+C in this terminal to exit launcher.", flush=True)
    else:
        print("      * Press Ctrl+C in this terminal to stop the local demo server.", flush=True)
    print("-" * 68, flush=True)

    # Wait for Ctrl+C
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        if server:
            print("\n[SHUTDOWN] Received Ctrl+C. Stopping demo server...", flush=True)
            server.shutdown()
            server.server_close()
            print("[SHUTDOWN] Server stopped cleanly. Goodbye.", flush=True)
        else:
            print("\n[SHUTDOWN] Launcher exited cleanly. (Background server remains intact)", flush=True)


if __name__ == "__main__":
    main()
