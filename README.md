<div align="center">

# 🛰️ KESTREL

### **K**epler **E**xploration — **S**patial **T**ree for **R**isk **E**valuation and **L**ocalization

[![Language: C++17](https://img.shields.io/badge/Language-C%2B%2B17-blue.svg)](https://en.cppreference.com/w/cpp/17)
[![CTest: 13/13 Passing](https://img.shields.io/badge/CTest-13%2F13%20Passing-brightgreen.svg)](tests/)
[![Python Tests: 77/77 Passing](https://img.shields.io/badge/Python%20Tests-77%2F77%20Passing-brightgreen.svg)](tests/)
[![Status: MVP Complete](https://img.shields.io/badge/Status-MVP%20Complete-success.svg)](PROJECT_SSOT.md)

An academic C++17 project investigating a custom, dynamically updated two-dimensional R-tree for spatial indexing and hazard assessment in a simulated deep-space environment.

</div>

---

## 🔬 Research Question

> *"How effectively can a dynamic spatial index (R-tree) support continuous region monitoring and hazard detection in a simulated deep-space environment?"*

---

## 🌌 Project Overview & Current MVP State

KESTREL builds a complete spatial-indexing and hazard-assessment pipeline around a **hand-written, zero-dependency 2D dynamic R-tree** (Guttman quadratic split, $M=4, m=2$) with no third-party spatial libraries.

The simulation models fictional Kepler Belt entities (asteroids, probes, navigational hazards) moving deterministically through 2D space. Mission queries perform broad-phase bounding-box filtering via the R-tree followed by narrow-phase geometric verification.

### What is Implemented in the MVP
- 🌲 **Native C++17 R-Tree Core:** Complete node splitting (quadratic algorithm), area/perimeter minimization, recursive MBR propagation, dynamic insertion, deletion with underflow re-insertion, and window pruning.
- ☄️ **Two-Phase Hazard Assessment Pipeline:** Broad-phase spatial candidate retrieval combined with narrow-phase geometric checks (corridors, distance radii, region bounds).
- 🪐 **Deterministic Simulation Engine:** Kepler Belt orbital motion model with seeded deterministic pseudo-random entity lifecycles.
- ✅ **Rigorous Verification:** 13 automated CTest regression suites and 76 Python unit/browser tests (100% pass rate) covering geometry, node structure, insertions, splits, deletions, stress loads, and full pipeline integration.
- 📊 **Empirical Benchmarking Engine:** Scalability evaluation comparing R-tree queries against linear brute-force baseline across entity scales ($N = 100$ to $100{,}000$).
- 🖥️ **Mission Control Frontend:** A decoupled HTML5 Canvas visualizer rendering radar grids, entity markers, dynamic leaf/internal MBR hierarchies, query windows, and glowing hazard alerts.
- 🎯 **Interactive User-Defined Spatial Queries:** Users can draw arbitrary spatial query bounding rectangles on the live radar canvas; requests are evaluated by a persistent native C++ query service (`kestrel_query.exe`) over high-speed IPC with sub-millisecond response times.
- 🔬 **Traversal Replay (Step-Through Debugger):** Mission Control can step through the *actual* recorded C++ R-tree range-query traversal for both initial and user-defined queries — node visits, MBR tests, pruning decisions, leaf matches, and accepted results — with synchronised map highlighting, per-event explanations, and canonical hierarchy node linking.
- 🚀 **Single-Command Demo Orchestrator (`run_demo.py`):** An end-to-end Python launcher that verifies the toolchain, builds stale targets, runs the simulation, exports the R-tree state to JSON, hosts a local server, and launches Mission Control in the browser. See the [Live Demo Walkthrough](docs/DEMO_WALKTHROUGH.md).


---
## 🛠️ Tech Stack
 
<p align="center">
  <img src="https://cdn.simpleicons.org/cplusplus" width="50" alt="C++17"/>
  &nbsp;&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/cmake" width="50" alt="CMake"/>
  &nbsp;&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/python" width="50" alt="Python"/>
</p>
<p align="center">
  <strong>C++17</strong> •
  <strong>CMake / CTest</strong> •
  <strong>Python</strong>
</p>
 
---

## Implemented Architecture

```
                      +-----------------------------+
                      |    Kepler Belt Simulator    |
                      |  (Seeded motion & lifecycle)|
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |        Entity Store         |
                      | std::unordered_map<int,Ent> |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |     2D Dynamic R-tree       |
                      |   (Guttman Quadratic Split) |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Hazard Assessment Layer   |
                      |  Broad phase: R-tree search |
                      |  Narrow phase: Exact geom   |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
+-----------------------------+             +-----------------------------+
|    State Exporter (CLI)     |             |    Deterministic Testing    |
|   (Exports to state.json)   |             |   & Benchmark Suite (CTest) |
+--------------+--------------+             +-----------------------------+
               |
               v
+-----------------------------+
|   Mission Control Visual    |
| (HTML5 Canvas / Vanilla JS) |
+-----------------------------+
```

---

## Quick Start — Single-Command Demo Launcher

The primary and recommended way to build, execute, and view the KESTREL demo:

```bash
python run_demo.py
```

### What this Command Does Automatically
1. **Preflight:** Validates environment dependencies (CMake 3.20+, C++17 compiler, Python 3.8+).
2. **Build Check:** Builds `kestrel_demo`, `kestrel_export`, and `kestrel_query` using CMake if binaries are missing or source code has been modified.
3. **Simulation:** Runs the native C++ Kepler Belt demo (`kestrel_demo.exe`) and verifies output.
4. **State Export:** Executes `kestrel_export.exe` to serialize entities, R-tree MBR bounding boxes, and active query results to `build/state.json` (tracked fixtures `state.json` and `frontend/state.json` remain untouched).
5. **JSON Schema & Traversal Validation:** Verifies schema integrity (entities, leaf MBRs, internal MBRs, query matches, and recorded traversal trace).
6. **Query Service Worker:** Spawns `kestrel_query.exe` as a persistent subprocess for real-time native range query evaluation.
7. **Local Server & Launch:** Starts an HTTP server on port 8000 with no-cache headers (with automatic port conflict resolution), routes `/api/query` and `/api/scene` to the native query worker, serves `build/state.json`, and opens the **Mission Control visualizer** in your default web browser (`http://127.0.0.1:8000/frontend/index.html`). See the [Live Demo Walkthrough](docs/DEMO_WALKTHROUGH.md).

### Launcher Options & Flags

```bash
python run_demo.py --help
```

| Flag | Description |
|------|-------------|
| *(none)* | Full demo launch: preflight, build check, run, export, validate, serve, and open browser. |
| `--rebuild` | Force a clean CMake configuration and target rebuild before execution. |
| `--port <PORT>` | Specify a custom HTTP port (default: `8000`). Automatically falls back if port is occupied. |
| `--host <HOST>` | Bind to a custom host interface (default: `127.0.0.1`). |
| `--no-browser` | Launch HTTP server without automatically opening the browser (useful for remote/WSL). |
| `--once` | Run preflight, simulation, state export, and validation, then exit without launching the server. |

### Troubleshooting
- **Compiler/CMake Not Found:** Ensure CMake 3.20+ and a C++17 compiler (GCC/MinGW, Clang, or MSVC) are on your system `PATH`.
- **Port Conflict:** If port 8000 is occupied, `run_demo.py` automatically detects active KESTREL servers or safely shifts to the next open port (8001–8010).
- **Graceful Shutdown:** Press `Ctrl+C` in the terminal to terminate the launcher. Only launcher-spawned servers are stopped.

---

## Manual Build and Test Workflow

If you prefer building and running individual C++ components manually:

### Prerequisites

| Tool | Minimum Version | Tested With | Status |
|------|-----------------|-------------|--------|
| **C++ Compiler** | C++17 compatible | GCC 16.1.0 (MSYS2 UCRT64) / MSVC 2022 | Available |
| **CMake** | 3.20+ | CMake 4.4.0 | Available |
| **Python** | 3.8+ | Python 3.13.0 | Available |

### 1. Build the Entire Solution

```bash
cmake -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Debug
cmake --build build
```

### 2. Run All Unit & Integration Tests

**C++ Core & Traversal Tests (CTest):**
```bash
ctest --test-dir build --output-on-failure
```
*Expected output: `100% tests passed out of 13`.*

**Python API, Launcher Safety, Hierarchy, and Viewport Tests:**
```bash
python -m unittest tests/test_launcher_safety.py tests/test_hierarchy_validation.py tests/test_viewport_math.py tests/test_query_api.py -v
```
*Expected output: `Ran 76 tests ... OK` (0 errors, 0 skips).*

**End-to-End Live Browser Demonstration Validation:**
```bash
python tests/test_live_demo.py
# or: python -m unittest tests/test_live_demo.py -v
```
*Validates all 8 Stage B scenarios and Stage C responsive viewports (1920x1080, 1440x900, 1280x720 across 1x, 1.25x, and 2x DPR) against the live running application, capturing verified screenshots to `docs/reports/screenshots/`.*

### 3. Run Scaling Benchmarks

```bash
./build/benchmarks/kestrel_benchmark.exe
```

*Generates query performance metrics and outputs `benchmark_results.csv` comparing linear scan vs. R-tree spatial index across $N=100$ to $N=100{,}000$ entities.*

### 4. Run State Exporter Directly

```bash
./build/src/kestrel_export.exe build/state.json
```

---

## Repository Structure

```text
KESTREL/
|-- run_demo.py                   # Automated single-command demo orchestrator
|-- CMakeLists.txt                # Root CMake project configuration
|-- PROJECT_SSOT.md               # Single Source of Truth & gate governance
|-- AGENTS.md                     # Agent operating guidelines and entry point
|-- README.md                     # Project documentation and quick start
|-- state.json                    # Exported spatial state fallback
|-- benchmark_results.csv         # Empirically measured R-tree scaling data
|
|-- src/                          # Native C++17 Engine Core
|   |-- geometry.h / .cpp         # Point, BoundingBox (AABB), geometric intersection algorithms
|   |-- rtree_node.h / .cpp       # Node representation, Guttman quadratic split, MBR updates
|   |-- rtree.h / .cpp            # 2D R-tree insert, delete, search, range query, pruning
|   |-- entity.h / .cpp           # Kepler Belt entity model (position, velocity, bounding box)
|   |-- entity_store.h / .cpp     # Map-based entity ownership store
|   |-- simulator.h / .cpp        # Deterministic orbital motion simulation & entity lifecycle
|   |-- mission.h / .cpp          # Broad-phase/narrow-phase corridor & hazard queries
|   |-- main.cpp                  # CLI simulation demonstration executable (kestrel_demo)
|   +-- export.cpp                # JSON state exporter executable (kestrel_export)
|
|-- tests/                        # Deterministic Regression Test Suites
|   |-- test_entity.cpp           # Entity properties and store operations
|   |-- test_rtree.cpp            # Structural R-tree invariant tests
|   |-- test_rtree_insert.cpp     # Insertion correctness and quadratic split validation
|   |-- test_rtree_query.cpp      # Spatial range queries and pruning verification
|   |-- test_rtree_trace.cpp      # Recorded traversal trace: ordering, pruning, result parity
|   +-- test_export_trace.cpp     # Exported trace + hierarchy share one canonical identity
|   |-- test_rtree_delete.cpp     # Deletion, node underflow, and re-insertion tests
|   |-- test_simulator.cpp        # Deterministic simulation physics and reproducibility
|   |-- test_mission.cpp          # Region, nearby, and corridor hazard assessment
|   +-- test_stress.cpp           # Large-scale load and boundary condition stress tests
|
|-- benchmarks/                   # Empirical Evaluation Suite
|   +-- benchmark_main.cpp        # Microbenchmarks: R-tree vs Brute Force (kestrel_benchmark)
|
|-- frontend/                     # Mission Control Web Visualizer
|   |-- index.html                # 2D radar interface markup and control panel
|   |-- app.js                    # Canvas visualizer, hierarchy explorer, traversal replay
|   |-- test_hierarchy.html       # Browser harness: hierarchy validation/selection
|   |-- test_viewport.html        # Browser harness: viewport/coordinate maths
|   |-- test_traversal.html       # Browser harness: traversal replay behaviour
|   +-- css/style.css             # Glassmorphism dark-mode mission dashboard styling
|
+-- docs/                         # Specifications, Decisions, and Academic Reports
    |-- architecture/             # ARCHITECTURE.md (detailed subsystem blueprints)
    |-- decisions/                # Architecture Decision Records (ADR-001 through ADR-005)
    |-- gates/                    # Gate evidence files (GATE-00 through GATE-11)
    +-- reports/                  # BENCHMARK-REPORT.md, FINAL-VERIFICATION-REPORT.md, DEFENCE-PREPARATION.md
```

---

## Roadmap & Planned Features

While the core C++17 engine, test suites, exporter, and baseline Mission Control visualizer are fully operational as an MVP, future iterations are planned to extend user interactivity and telemetry:

```
[Current MVP]                                    [Planned Future Enhancements]
Static JSON State Visualizer  ─────────────>  Interactive Dynamic Spatial Map
All MBR Levels Overlaid       ─────────────>  Interactive R-tree Hierarchy Visualizer
Pre-programmed Demo Query     ─────────────>  Custom User-Drawn Spatial Queries
Single-Step State Snapshot    ─────────────>  Interactive Traversal & Pruning Step-Through
Static Terminal Benchmarks    ─────────────>  Real-Time Query Metrics Dashboard
Hardcoded Simulation Seed     ─────────────>  Configurable / Live Simulation Control
```

> **Delivered since this roadmap was written:** *Interactive Dynamic Spatial Map* (pan / zoom / fit)
> and *Interactive Traversal & Pruning Step-Through* are now implemented. The traversal debugger is
> described in [Traversal Replay](#traversal-replay-step-through-debugger) below.

### 1. Interactive Spatial Map
- **Smooth Pan & Zoom:** Canvas navigation with mouse-drag panning, pinch-to-zoom, and mini-map navigation.
- **Entity Inspection Tooltips:** Hover over and click asteroids, probes, or debris to inspect real-time position, velocity vectors, entity IDs, and bounding coordinates.

### 2. R-Tree Hierarchy Visualizer
- **Level-by-Level Filtering:** Toggle visibility of specific tree depths (Root $\rightarrow$ Internal Levels $\rightarrow$ Leaf MBRs).
- **Subtree Highlighting:** Click any bounding box to isolate and highlight its parent-child lineage and enclosed entities.

### 3. Custom Dynamic Spatial Queries
- **User-Drawn Query Windows:** Click-and-drag bounding rectangles directly on the radar grid to trigger live range queries.
- **Trajectory Corridor Generation:** Define origin and destination waypoints to dynamically visualize swept corridors and hazard intersections.

### 4. Traversal & Pruning Step-Through Mode
- **Visual Branch-and-Bound Debugger:** Step-by-step visual animation demonstrating how the R-tree searches for hazards:
  - Yellow: Nodes currently evaluated.
  - Red: Pruned subtrees (MBR does not intersect query window).
  - Green: Accepted candidate leaves proceeding to narrow-phase geometry checks.

### 5. Real-Time Query Performance & Metrics Dashboard
- **Telemetry Overlay:** Real-time HUD showing:
  - Candidates evaluated vs. total entity count.
  - Pruning efficiency percentage ($\frac{\text{Pruned Nodes}}{\text{Total Nodes}} \times 100$).
  - Broad-phase vs. narrow-phase execution time breakdown.
  - Theoretical speedup factor over naive $O(N)$ linear scan.

### 6. Configurable Simulation Environment
- **Live Parameter Controls:** UI sliders to adjust entity density ($N = 10$ to $10{,}000$), velocity ranges, and hazard generation frequencies without recompilation.
- **Interactive Hazard Injection:** Manual placement of high-risk obstacles into trajectory paths to test real-time avoidance responses.

---

## Traversal Replay (Step-Through Debugger)

Mission Control can replay the **real** range-query traversal that the C++ R-tree performed. The
animation is not reconstructed from the result set — every step is recorded inside `RTree::search()`
at the exact point where the search makes a decision.

### Recorded events

| Event | Recorded when |
|-------|---------------|
| `node_visited` | A node is dequeued and its entries are about to be examined. |
| `mbr_tested` | An entry MBR (a child node MBR or a leaf entry MBR) is tested against the query region. |
| `branch_pruned` | The tested MBR does not intersect the query, so the subtree is abandoned. |
| `child_entered` | The tested MBR intersects the query, so the traversal descends into the child. |
| `leaf_entry_examined` | A leaf entry matched the query region. |
| `entity_accepted` | The entity was added to the result set. |
| `traversal_completed` | The traversal finished. |

Each event carries the identifiers involved (`node_id`, `child_node_id`, `entity_id`), the MBR that
was tested, and the outcome of the intersection test.

Node references use the **canonical hierarchy identifiers** (`node_0`, `node_1`, …) — the very same
identifiers the R-tree Hierarchy panel uses — so a traversal event always resolves to the node it
actually refers to. Entity references use the numeric entity id, which is the identifier used by
`query.results` and by the exported entity list.

### Backend API

```cpp
RTreeTrace trace;
RTree::QueryMetrics metrics;
std::vector<int> hits = tree.search(query, metrics, &trace);   // traced
std::vector<int> hits2 = tree.search(query, metrics);           // identical, untraced
```

`MissionControl::region_scan(region, metrics, &trace)` exposes the same trace through the mission
query interface. Passing `nullptr` (or omitting the argument) keeps the previous behaviour exactly:
the search algorithm, the visited-node count and the returned entity IDs are unchanged.

The recorder is bounded (`RTreeTrace::max_events`, 20 000 by default). When the bound is reached the
trace is flagged `truncated` and the terminal `traversal_completed` marker is still written.

### Exported scene format

`kestrel_export` writes the scene, the R-tree hierarchy, the query and the trace into `state.json`.
The hierarchy schema is authoritative; the trace is added next to it and references the same nodes.

```jsonc
{
  "scene_id": 4978692356078348,        // content fingerprint of scene + query
  "entities": [ /* ... */ ],
  "rtree": {
    "height": 2,
    "size": 11,
    "internal_mbrs": [ /* ... */ ],    // legacy arrays (kept for existing consumers)
    "leaf_mbrs": [ /* ... */ ],
    "root": {                         // authoritative nested hierarchy
      "id": "node_0", "parent_id": null, "type": "root", "is_root": true,
      "is_leaf": false, "depth": 0, "bounds": [/* ... */],
      "children": [
        { "id": "node_1", "parent_id": "node_0", "type": "leaf", /* ... */,
          "children": [
            { "id": "entity_31", "parent_id": "node_1", "entity_id": 31,
              "type": "entity", "bounds": [/* ... */] }
          ] }
      ]
    }
  },
  "query": { "query_id": 1, "bounds": [/* ... */], "results": [31, 30] },
  "trace": {
    "scene_id": 4978692356078348,
    "query_id": 1,
    "query_bounds": [/* ... */],
    "truncated": false,
    "total_events": 19,
    "events": [ { "type": "node_visited", "node_id": "node_0", "child_node_id": null,
                  "entity_id": -1, "mbr": [/* ... */], "intersects": true } ]
  }
}
```

The exporter resolves the R-tree's internal node identifiers to the canonical hierarchy identifiers
while it writes the hierarchy, so the trace references exactly the nodes that were exported.

### Frontend behaviour

- **Controls:** Start, Previous step, Next step, Play, Pause, Restart, Clear Trace.
  Keyboard: `N` next, `B` back, `P` play/pause, `Shift+R` restart.
- **Step readout:** `STEP 7 / 19` plus a progress bar; the recorded event log is clickable.
- **Map highlighting:** visited nodes (solid outline, `●`), entered branches (dotted outline, `▼`),
  pruned branches (dashed outline, `✕`), accepted results (ringed box, `✓`) and the current event
  (highlighted outline, `◆`). Line style and glyph accompany every colour so the event kind is never
  communicated by colour alone.
- **Hierarchy synchronisation:** stepping the replay selects the corresponding node in the
  R-tree Hierarchy panel (expanding its ancestor path) and the Node Inspector shows the same node.
  A pruned branch is shown as pruned and is never counted as a visited node. Selecting a node in the
  hierarchy panel by hand pauses an auto-advancing replay.
- **Explanations:** every displayed sentence is derived from the event that is currently shown.
- **Trace lifecycle:** the replay only ever uses the trace of the scene and query that are loaded.
  A trace whose `scene_id`, `query_id`, query bounds, event shape or recorded results disagree with
  the loaded scene is discarded, and loading a new scene always clears the previous replay.

### Scope of the replayed query

The replay engine supports both the predefined demo query and live user-defined spatial queries:
1. **Initial Demo Query:** Traversal of the baseline range query (`200, 200 → 600, 400`) produced by `kestrel_export`.
2. **Interactive User Queries:** When a user draws a new query region on the canvas, the bounding box is sent to `POST /api/query`. The persistent C++ worker (`kestrel_query.exe`) executes the query on the identical R-tree, recording the new traversal decisions and returning them in the JSON response. The frontend seamlessly installs this trace into the replay engine, allowing immediate step-through and inspection of the user's custom query.

For full contract specifications, see [`docs/api/QUERY_API.md`](docs/api/QUERY_API.md).
For a guided demonstration walkthrough, see [`docs/DEMO_WALKTHROUGH.md`](docs/DEMO_WALKTHROUGH.md).

---

## Gate Progression & Verification Status

KESTREL follows strict **Gate Discipline**, where each stage must meet defined formal acceptance criteria before progression.

| Gate | Title | Focus Area | Status |
|:---:|:---|:---|:---:|
| **GATE-00** | Repository Reconnaissance & Specification | Baseline repository setup & SSOT | **PASS** |
| **GATE-01** | Geometry Primitives | Point, BoundingBox (AABB), intersection | **PASS** |
| **GATE-02** | Entity Model and Store | Entity records & `EntityStore` map | **PASS** |
| **GATE-03** | R-Tree Structural Foundation | Node memory model, invariants, capacity $M=4, m=2$ | **PASS** |
| **GATE-04** | Insertion and Splitting | Guttman quadratic split, area minimization | **PASS** |
| **GATE-05** | Range Queries and Pruning | Bounding-box search & subtree pruning | **PASS** |
| **GATE-06** | Deletion and Dynamic Updates | Leaf deletion, underflow handling, re-insertion | **PASS** |
| **GATE-07** | Kepler Belt Simulation | Deterministic orbital motion & lifecycle | **PASS** |
| **GATE-08** | Mission Queries & Hazard Assessment | Broad/narrow hazard detection pipeline | **PASS** |
| **GATE-09** | Benchmarking & Research Evaluation | Scaling benchmarks ($N=100$ to $100{,}000$) vs baseline | **PASS** |
| **GATE-10** | Mission-Control Visualization | Decoupled HTML5 Canvas radar frontend & exporter | **PASS** |
| **GATE-11** | Final Verification & Academic Defence | End-to-end integration, audit report, defence slides | **IN REVIEW** |

*Note: GATE-00 through GATE-10 are formally verified and closed. GATE-11 technical verification is complete (12/12 CTests passing, benchmark reports published, defence notes finalized) and submitted for Project Owner sign-off.*

---

## Key Documents & References

- **[PROJECT_SSOT.md](PROJECT_SSOT.md)** — Authoritative Single Source of Truth for architecture, terminology, and scope.
- **[ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)** — In-depth architectural design and data flow specifications.
- **[COMMANDS.md](docs/COMMANDS.md)** — Reusable build, test, and verification command reference.
- **Architectural Decision Records (ADRs):**
  - [ADR-001: R-Tree Variant Selection (Standard Guttman Quadratic)](docs/decisions/ADR-001-rtree-variant.md)
  - [ADR-002: Geometry & Coordinate Representation](docs/decisions/ADR-002-geometry.md)
  - [ADR-003: Entity Storage Model (`std::unordered_map`)](docs/decisions/ADR-003-entity-storage.md)
  - [ADR-004: Benchmarking Methodology & Baselines](docs/decisions/ADR-004-benchmarks.md)
  - [ADR-005: Decoupled Frontend Visualization Architecture](docs/decisions/ADR-005-frontend-stack.md)
- **Academic & Verification Reports:**
  - [Final Verification Report](docs/reports/FINAL-VERIFICATION-REPORT.md)
  - [Benchmark & Load Evaluation Report](docs/reports/BENCHMARK-REPORT.md)
  - [Academic Defence Preparation Guide](docs/reports/DEFENCE-PREPARATION.md)
