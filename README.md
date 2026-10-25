<div align="center">

# 🛰️ KESTREL

### **K**epler **E**xploration — **S**patial **T**ree for **R**isk **E**valuation and **L**ocalization

[![Language: C++17](https://img.shields.io/badge/Language-C%2B%2B17-blue.svg)](https://en.cppreference.com/w/cpp/17)
[![Build: CMake](https://img.shields.io/badge/Build-CMake%203.20%2B-064F8C.svg)](https://cmake.org/)
[![Runtime: Python](https://img.shields.io/badge/Runtime-Python%203.8%2B-3776AB.svg)](https://www.python.org/)
[![UI: HTML5 Canvas](https://img.shields.io/badge/UI-HTML5%20Canvas%20%2F%20Vanilla%20JS-E34F26.svg)](frontend/)
[![Architecture: Zero External Dependencies](https://img.shields.io/badge/Dependencies-Zero%20External-success.svg)](#core-architectural-decisions)

An academic C++17 project investigating a custom, dynamically updated two-dimensional R-tree for spatial indexing and continuous hazard detection in a simulated deep-space environment.

</div>

---

## 🔬 Research Question & Academic Problem Statement

> **"How effectively can a dynamic spatial index (R-tree) support continuous region monitoring and hazard detection in a simulated deep-space environment?"**

Spatial indexing in astronomical exploration and orbital mission backends requires rapid spatial pruning over dynamic, continuously shifting object fields. Naive linear searches scale as $O(N)$, becoming prohibitive as object counts grow.

KESTREL investigates a **hand-written, zero-dependency 2D dynamic R-tree** implemented entirely from first principles using standard C++17 library containers and RAII, evaluated against a deterministic Kepler Belt simulation and presented through an interactive Mission Control workstation.

---

## 🏛️ Implemented Architecture & Spatial Pipeline

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
                              |      2D Dynamic R-tree      |
                              |  (Guttman Quadratic Split)  |
                              +--------------+--------------+
                                             |
                                             v
                              +-----------------------------+
                              |   Hazard Assessment Layer   |
                              |  Broad phase: R-tree search |
                              |  Narrow phase: Exact geom   |
                              +--------------+--------------+
                                             |
                      +----------------------+----------------------+
                      |                                             |
                      v                                             v
       +-----------------------------+               +-----------------------------+
       |    State Exporter (CLI)     |               |     Query Service (IPC)     |
       |  (kestrel_export -> JSON)   |               |   (kestrel_query worker)    |
       +--------------+--------------+               +--------------+--------------+
                      |                                             |
                      |            +-------------------+            |
                      +----------->|   run_demo.py     |<-----------+
                                   |  (HTTP & Bridge)  |
                                   +---------+---------+
                                             |
                                             v
                              +-----------------------------+
                              |  Mission Control Workstation|
                              | (HTML5 Canvas / Vanilla JS) |
                              +-----------------------------+
```

### Two-Phase Spatial Filtering Pipeline
1. **Broad-Phase Retrieval (R-tree):**
   The R-tree evaluates the query bounding box against hierarchical Minimum Bounding Rectangles (MBRs). Subtrees whose MBRs do not intersect the query envelope are pruned immediately, producing a tight superset of candidate entity IDs.
2. **Narrow-Phase Geometric Verification:**
   Candidate entities returned by the broad phase undergo exact geometric intersection tests (swept trajectory corridors, proximity radius thresholds, exact bounding boxes). Only confirmed intersections are classified as hazards.

### Core Architectural Decisions
- **ADR-001 (R-tree Variant):** Standard Guttman dynamic R-tree with quadratic split algorithm ($M=4, m=2$). Quadratic split strikes an optimal balance between tree balance quality and computational simplicity without heuristic complexity.
- **ADR-002 (Geometry & Coordinates):** Continuous floating-point 2D Cartesian coordinate space using axis-aligned bounding rectangles (AABB) with explicit min/max extents.
- **ADR-003 (Entity Storage):** Map-based ownership model (`std::unordered_map<int, Entity>`). The entity store owns entity records; the R-tree stores only entity IDs and bounding boxes.
- **ADR-005 (Frontend Architecture):** Decoupled static HTML5 Canvas visualizer communicating with the native C++ backend via JSON state files and standard input/output IPC proxying.

---

## 🌟 Key Features & Workstation Capabilities

- 🌲 **Native C++17 Dynamic R-Tree Core:**
  - Standard Guttman quadratic node splitting with seed-pair selection and area enlargement minimization.
  - Recursive bottom-up Minimum Bounding Rectangle (MBR) propagation.
  - Dynamic insertion and deletion with node underflow re-insertion.
  - Spatial range queries with subtree window pruning and real-time traversal event logging.
- ☄️ **Kepler Belt Simulation Engine:**
  - Deterministic orbital motion simulation with reproducible pseudo-random seed generation.
  - Active entity lifecycle management (dynamic entity births, deaths, and trajectory updates).
- 🖥️ **Interactive Mission Control Workstation:**
  - **High-Performance Radar Viewport:** Smooth canvas panning, mouse-wheel zooming, fit-to-view, entity inspection tooltips, and dynamic radar range rings.
  - **Live User-Drawn Spatial Queries:** Click-and-drag arbitrary spatial query boxes directly on the canvas. Queries are evaluated in real time by a persistent native C++ query service (`kestrel_query.exe`) over high-speed IPC with sub-millisecond response times.
  - **Visual Traversal Replay (Step-Through Debugger):** Step forward, back, play, or pause the *actual recorded C++ traversal decisions* (visited nodes, tested MBRs, pruned branches, and accepted candidates) synchronized with map highlighting and the hierarchy tree.
  - **Hierarchical Node Explorer & Inspector:** Expand and collapse tree depths, inspect internal and leaf node boundaries, and view live query performance telemetry.
  - **Adaptive Workstation Shell:** Draggable multi-panel splitters, floating/docking instrument windows, and responsive scaling down to 800×600 displays.

---

## 🛠️ Prerequisites & Environment Setup

| Requirement | Minimum Version | Tested Configuration |
|:---|:---|:---|
| **C++ Compiler** | C++17 compliant | GCC 16.1.0 (MSYS2 UCRT64), Clang 13+, MSVC 2019+ |
| **Build Tool** | CMake 3.20+ | CMake 4.4.0 |
| **Runtime Scripting** | Python 3.8+ (Standard Library only) | Python 3.13.0 |
| **Web Browser** | HTML5 Canvas / ES6 compliant | Chrome, Edge, Firefox |

*Zero external third-party libraries or package-manager installations (pip, npm, vcpkg) are required.*

---

## 🚀 Quick Start — Single-Command Demo Launcher

The recommended way to build, run, and explore KESTREL is the single-command orchestrator:

```bash
python run_demo.py
```

### What this Command Does Automatically
1. **Preflight Environment Check:** Verifies CMake, C++17 compiler, and Python availability.
2. **Automated Incremental Build:** Configures and builds `kestrel_demo`, `kestrel_export`, and `kestrel_query` if binaries are missing or source code has changed.
3. **Simulation Execution:** Runs the native C++ Kepler Belt demo (`kestrel_demo.exe`).
4. **State Export:** Executes `kestrel_export.exe` to serialize active entities, R-tree hierarchy, and traversal trace to `build/state.json`.
5. **Schema Validation:** Verifies the exported JSON structure and trace integrity.
6. **Query Service Worker:** Spawns `kestrel_query.exe` as a persistent background subprocess for real-time range query evaluation.
7. **HTTP Server & Launch:** Starts a local HTTP server with automatic port conflict fallback (ports 8000–8010), establishes the `/api/query` and `/api/scene` IPC proxy, and opens Mission Control in your default browser (`http://127.0.0.1:8000/frontend/index.html`).

### Launcher Options & Flags

```bash
python run_demo.py [OPTIONS]
```

| Flag | Default | Description |
|:---|:---|:---|
| `--port <PORT>` | `8000` | Port to serve frontend on. Automatically falls back if occupied. |
| `--host <HOST>` | `127.0.0.1` | Host address to bind local HTTP server to. |
| `--rebuild` | `False` | Force clean CMake configuration and target rebuild. |
| `--no-browser` | `False` | Run local server and API worker without opening the browser. |
| `--once` | `False` | Run simulation, export, and validation, then exit without starting server. |

---

## ⚙️ Manual C++ Build & CLI Tools (For Developers)

If you prefer building and executing native binaries directly:

### 1. Build via CMake

```bash
# Configure build directory
cmake -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release

# Compile all production executables
cmake --build build --target kestrel_demo kestrel_export kestrel_query
```

### 2. Native CLI Executables

- **CLI Simulation Demo (`kestrel_demo.exe`):**
  Runs the full Kepler Belt simulation, exercises broad/narrow hazard detection along a trajectory, and outputs execution statistics to console:
  ```bash
  ./build/src/kestrel_demo.exe
  ```
- **State & Trace Exporter (`kestrel_export.exe`):**
  Constructs the demonstration scene, executes the baseline range query, records the traversal trace, and writes state JSON to a specified output file:
  ```bash
  ./build/src/kestrel_export.exe state.json
  ```
- **Interactive Query Service (`kestrel_query.exe`):**
  Long-lived worker process reading single-line JSON range queries from standard input and returning JSON results and traversal traces over standard output:
  ```bash
  ./build/src/kestrel_query.exe
  # Send query: {"op":"query","bounds":[200.0,200.0,600.0,400.0]}
  ```

---

## 📄 Runtime Data Specifications & Schemas

The application consumes and produces structured spatial state in `state.json`:

```jsonc
{
  "scene_id": 4978692356078348,        // Content fingerprint of scene & active query
  "entities": [                        // Active simulated objects
    {
      "id": 1,
      "type": "asteroid",
      "position": [450.2, 312.8],
      "velocity": [-1.2, 0.4],
      "bounds": [445.2, 307.8, 455.2, 317.8]
    }
  ],
  "rtree": {
    "height": 2,
    "size": 11,
    "internal_mbrs": [ /* ... */ ],
    "leaf_mbrs": [ /* ... */ ],
    "root": {                          // Authoritative nested hierarchy
      "id": "node_0",
      "type": "root",
      "bounds": [120.0, 150.0, 780.0, 620.0],
      "children": [
        {
          "id": "node_1",
          "type": "leaf",
          "bounds": [120.0, 150.0, 340.0, 390.0],
          "children": [
            { "id": "entity_1", "type": "entity", "entity_id": 1, "bounds": [...] }
          ]
        }
      ]
    }
  },
  "query": {
    "query_id": 1,
    "bounds": [200.0, 200.0, 600.0, 400.0],
    "results": [1, 5, 8]
  },
  "trace": {
    "scene_id": 4978692356078348,
    "query_id": 1,
    "total_events": 18,
    "events": [
      {
        "type": "node_visited",
        "node_id": "node_0",
        "mbr": [120.0, 150.0, 780.0, 620.0],
        "intersects": true
      },
      {
        "type": "branch_pruned",
        "node_id": "node_2",
        "mbr": [650.0, 500.0, 780.0, 620.0],
        "intersects": false
      }
    ]
  }
}
```

---

## 🌐 Native Query API Contract

When running `run_demo.py`, Mission Control communicates with the native C++ query service through two local HTTP endpoints:

### `POST /api/query`
Evaluates a spatial range query against the active R-tree instance.
- **Request Body:**
  ```json
  { "bounds": [min_x, min_y, max_x, max_y] }
  ```
- **Response Payload:**
  ```json
  {
    "status": "ok",
    "query_id": 2,
    "bounds": [250.0, 180.0, 520.0, 410.0],
    "results": [4, 7],
    "trace": {
      "query_id": 2,
      "total_events": 14,
      "events": [ /* recorded traversal decisions */ ]
    }
  }
```

### `GET /api/scene`
Retrieves metadata and identity of the currently held simulation scene.
- **Response Payload:**
  ```json
  {
    "status": "ok",
    "scene_id": 4978692356078348,
    "entities_count": 11,
    "timestamp": 1729864200
  }
  ```

---

## 🧭 Mission Control Walkthrough & User Guide

1. **Initial Radar Ingest:**
   Click **Load state.json** or launch via `run_demo.py`. The canvas renders celestial entities, orbital paths, MBR bounding boxes, and the active query region.
2. **Interactive Viewport Controls:**
   - **Pan:** Click and drag with mouse.
   - **Zoom:** Mouse wheel up/down (centered on cursor).
   - **Auto-Fit:** Click **Reset View** or press `F` to frame all entities and MBRs.
3. **Drawing Custom Spatial Queries:**
   - Click **Draw Query** in the command toolbar.
   - Click and drag a bounding rectangle across any portion of the radar canvas.
   - The query coordinates are dispatched to `/api/query`, evaluated by `kestrel_query.exe`, and matching entities glow red/green with hazard indicators.
4. **Using the Traversal Replay Debugger:**
   - Use the playback controls in the Traversal Replay bar (`▶ Play`, `❚❚ Pause`, `⮜ Step Back`, `⮞ Step Next`, `↺ Restart`).
   - Keyboard shortcuts: `N` (Next event), `B` (Previous event), `P` (Play/Pause), `Shift+R` (Restart).
   - Watch the R-tree search algorithm make decisions step-by-step: yellow outlines denote evaluated nodes, dashed red lines denote pruned subtrees, and green checks denote accepted entities.
5. **Customizing the Workstation Layout:**
   - Drag horizontal and vertical splitters to rebalance canvas and telemetry sizes.
   - Click the window controls on the **R-Tree Hierarchy Explorer** or **Node Inspector** to float them as movable desktop windows. Click dock to snap them back.

---

## 🔧 Troubleshooting & FAQ

- **CMake or Compiler Not Found:**
  Ensure CMake 3.20+ and your C++17 compiler (`g++`, `clang++`, or `cl`) are registered on your system `PATH`. On Windows MSYS2:
  ```bash
  pacman -S mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-cmake
  ```
- **Port Conflict (Port 8000 Occupied):**
  `run_demo.py` automatically detects existing KESTREL servers or occupied ports, automatically selecting the next open port (8001–8010). You can also specify an explicit port via `python run_demo.py --port 8080`.
- **Browser Does Not Launch:**
  If running in headless Linux, Docker, or WSL, use `python run_demo.py --no-browser` and access the displayed URL from your host machine.

---

## 🗄️ Project Archival Notice

In accordance with strict gate discipline, all development-only material—including automated CTest and Python regression test suites, empirical scaling benchmark code, formal gate specifications (`GATE-00` through `GATE-11`), implementation reports, independent review documents, historical screenshots, and AI agent role definitions—has been permanently preserved locally in the project development archive (`non-release/`).
