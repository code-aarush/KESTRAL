# KESTREL — Live Demonstration & Verification Walkthrough

This document provides a step-by-step reproducible guide to executing the complete KESTREL live demonstration, exercising user-defined spatial queries, real R-tree traversal replay, and responsive viewport capabilities.

---

## 1. Prerequisites and Setup

Ensure the following tools are available on your system `PATH`:
- **C++17 Compiler:** GCC (MSYS2 UCRT64 / MinGW-w64), Clang, or MSVC.
- **CMake:** Version 3.20 or newer.
- **Python:** Python 3.8 or newer.
- **Web Browser:** Any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox).

---

## 2. Launching the Application

The entire demo is orchestrated via a single command:

```bash
python run_demo.py
```

### What happens automatically:
1. **Preflight:** Validates environment dependencies (CMake, C++ compiler, Python).
2. **Build Check:** Builds `kestrel_demo`, `kestrel_export`, and `kestrel_query` in `build/`.
3. **Simulation:** Runs the Kepler Belt simulation demo.
4. **State Export:** Generates runtime scene and R-tree index state to `build/state.json`. (Note: Tracked repository fixtures `state.json` and `frontend/state.json` remain untouched).
5. **Interactive Query Worker:** Spawns `kestrel_query.exe` as a persistent background subprocess for low-latency native range queries.
6. **Local Server:** Hosts the application at `http://127.0.0.1:8000/frontend/index.html` with no-cache headers.
7. **Browser Launch:** Opens the workstation in your default web browser.

*(To start without automatically opening the browser, pass `--no-browser`).*

---

## 3. Step-by-Step Demonstration Workflow

### Step 1: Initial Scene Ingest
- The application opens at `http://127.0.0.1:8000/frontend/index.html`.
- Upon load, the frontend fetches `/build/state.json`.
- The status bar displays:
  `● Loaded 11 entities (2 matched query) | Tree: 16 nodes (depth 2) from /build/state.json`
- The system clock reads: `SYNC: OK (11 ENTITIES | TREE: 16 NODES)`.
- The canvas renders the spatial radar showing Kepler Belt entities, root/leaf bounding boxes (MBRs), and coordinate axes centered at `(0, 0)`.
- The **R-Tree Hierarchy** panel on the right displays the hierarchical tree topology (`node_0` root with 4 child entries).

![Initial Scene Load](screenshots/01_initial_load.png)

---

### Step 2: Interactive User-Defined Spatial Query (Matching Entities)
1. In the top toolbar, click **Draw Query** (`#btnDrawQuery`).
   - The button becomes active (`aria-pressed="true"`, highlighted in cyan).
   - The spatial query panel status reads: `Dragging region... Release to submit, Esc to cancel.`
2. On the canvas, click and drag a rectangle over the central cluster where entities `#30` and `#31` reside (approx. world coordinates `[160, 200, 600, 390]`).
3. Release the mouse button.
   - The frontend immediately posts `{"bounds": [min_x, min_y, max_x, max_y]}` to `POST /api/query`.
   - `kestrel_query.exe` executes `RTree::search()` against the live 2D R-tree, recording decisions and pruning events.
   - The UI displays:
     - **Spatial Query Panel:** Badge reads `2 HITS`, status reports `Found 2 matching entities`, chips for `#31` and `#30` appear.
     - **Canvas:** Dashed cyan box labeled `USER QUERY RESULT` encloses the region, and matching entities are highlighted in crimson (`Query Hits`).
     - **Traversal Replay:** Badge updates to `18 EVENTS`.

![Matching Query Results](screenshots/02_matching_query_results.png)

---

### Step 3: Traversal Replay (Step-Through Debugger)
1. In the **Traversal Replay** dock, click **Start** or **Next** (`#btnTraceNext`).
2. The progress counter displays `STEP 1 / 18`.
3. The event tag displays `VISITED` and explains: `Visiting node_0.`
4. Click **Next** repeatedly or click **Play** (`#btnTracePlay`):
   - Watch the R-tree search evaluate candidate subtrees.
   - **Pruned Subtrees:** Displayed with dashed borders and `✕` markers.
   - **Entered Branches:** Displayed with dotted borders and `▼` markers.
   - **Accepted Entities:** Displayed with rings and `✓` markers.
   - The active node in the R-Tree Hierarchy panel synchronously highlights as each event executes.

![Traversal Replay](screenshots/03_traversal_replay.png)

---

### Step 4: Submitting a Second, Distinct Query
1. Click **Draw Query** again.
2. Drag a new rectangle in a different area of the canvas.
3. Observe that:
   - Previous query highlights and result chips are immediately cleared.
   - The new query bounds and matching results update cleanly.
   - Traversal replay resets to the new query's recorded events.

![Query Replacement](screenshots/05_query_replacement.png)

---

### Step 5: Valid Query with Zero Results
1. Click **Draw Query**.
2. Drag a rectangle in an empty void region outside all entity bounding boxes (e.g., top-left corner).
3. Observe:
   - Spatial Query badge displays `NO HITS`.
   - Status reports: `Query complete. No entities intersect this region.`
   - This is recognized as a valid empty query, **not an error**.
   - Traversal Replay displays the pruning events that eliminated all subtrees.

![Zero Result Query](screenshots/04_zero_result_query.png)

---

### Step 6: Viewport Navigation and Reset
- **Pan:** Hold <kbd>Space</kbd> and drag, or drag directly when query mode is inactive.
- **Zoom:** Use the mouse scroll wheel or click **Zoom In (+)** and **Zoom Out (−)**.
- **Fit All:** Click **Fit All (F)** or press <kbd>F</kbd> to recalculate bounds and center the entire scene.
- **Reset:** Click **Reset (R)** or press <kbd>R</kbd> to return to standard $1.0\times$ framing.
- **Clear Query:** Click **Clear Query** to discard query overlays and restore default display.

---

### Step 7: Responsive Viewport Verification
The application adapts dynamically across desktop, laptop, and compact resolutions:
- **1920 × 1080 (Desktop):** Expansive radar stage, full hierarchy and telemetry panels.
- **1440 × 900 (Laptop):** Proportional radar scaling, scrollable sidebar docks.
- **1280 × 720 (Compact):** Preserved toolbar controls, responsive text scaling.

![Responsive 1080p Layout](screenshots/kestrel_1920x1080.png)

---

### Step 8: Clean Application Shutdown
To stop the demo server and release background worker processes:
- In the launcher terminal, press <kbd>Ctrl+C</kbd>.
- The launcher cleanly closes worker IPC pipes, terminates `kestrel_query.exe`, shuts down the HTTP server, and exits.

---

## 4. Troubleshooting Guide

| Issue | Root Cause | Solution |
|---|---|---|
| **Port 8000 Occupied** | Another web server or prior instance is running. | `run_demo.py` automatically detects existing KESTREL instances or shifts to an open port (8001–8010). You can also pass `--port 8080`. |
| **CMake / Compiler Missing** | Tools not on system PATH. | Install CMake 3.20+ and GCC/MSVC; ensure their `bin` directories are added to system `PATH`. |
| **Worker Unavailable (503)** | `kestrel_query.exe` binary missing. | Run `cmake --build build --target kestrel_query` or run `python run_demo.py --rebuild`. |
| **Invalid Request (400)** | Malformed JSON or non-array bounds. | Ensure query payload conforms to `{"bounds": [min_x, min_y, max_x, max_y]}`. |
| **Browser Shows Stale State** | Browser cache holding prior JSON. | `run_demo.py` serves all JSON with `Cache-Control: no-cache, no-store`. Perform a hard refresh (<kbd>Ctrl+F5</kbd>) if needed. |
