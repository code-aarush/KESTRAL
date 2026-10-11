# KESTREL

**Kepler Exploration — Spatial Tree for Risk Evaluation and Localization**

A C++ academic project investigating a custom, dynamically updated, two-dimensional R-tree
for spatial indexing in a fictional Kepler Belt exploration simulation.

---

## Research Question

> *"How effectively can a dynamic spatial index (R-tree) support continuous region monitoring
> and hazard detection in a simulated deep-space environment?"*

---

## Project Overview

KESTREL builds a complete spatial-indexing system around a hand-written R-tree — no
third-party spatial-indexing libraries. The simulation places fictional Kepler Belt objects
(asteroids, probes, hazards) in 2D space. Mission queries search for entities within a region,
near a trajectory corridor, or at risk of collision. Deterministic test suites provide
correctness verification, and load analysis quantifies the R-tree's query-cost advantage.

---

## Planned Architecture

```
Kepler Belt Simulator
    ¦  (seeded, deterministic entity movement and lifecycle)
    ?
Entity Store  ---------------------------------------------+
    ¦  std::unordered_map<int, Entity>                      ¦
    ¦  (owns entity records)                               ¦
    ?                                                       ¦
R-tree Spatial Index                                        ¦
    ¦  2D, dynamic, quadratic split                        ¦
    ¦  (indexes bounding boxes and entity IDs)             ¦
    ?                                                       ¦
Mission Query / Hazard Assessment Layer                     ¦
    ¦  Broad phase: R-tree candidates                      ¦
    ¦  Narrow phase: precise geometry checks               ¦
    ?                                                       ?
                            Test Suite

Frontend Visualization (planned, Gate 10 — stack TBD)
```

---

## Repository Structure

```
kestrel/
+-- AGENTS.md           Agent instruction entry point
+-- PROJECT_SSOT.md     Single Source of Truth — read this first
+-- README.md           This file
+-- CMakeLists.txt      CMake scaffold (CMake not yet on PATH — see SSOT)
+-- .gitignore
+-- .agents/            Rules, agent procedures, and skills
+-- docs/
¦   +-- architecture/   ARCHITECTURE.md
¦   +-- decisions/      ADR-001, ADR-002, ADR-003
¦   +-- gates/          GATE-00 through GATE-11
¦   +-- templates/      Gate and ADR templates
¦   +-- reports/        Benchmark and review reports
¦   +-- COMMANDS.md     Reusable gate invocation commands
+-- src/                C++ implementation (PLANNED — not yet present)
+-- tests/              Test suite (PLANNED — not yet present)
+-- frontend/           2D visualization (PLANNED — stack TBD at Gate 10)
```

---

## Quick Start — Single-Command Demo Launcher

The easiest way to run the entire KESTREL simulation and Mission Control visualizer:

```bash
python run_demo.py
```

This single command automatically:
1. Verifies your toolchain environment (CMake, C++17 compiler, Python).
2. Builds the CMake targets (`kestrel_demo`, `kestrel_export`) if missing or stale.
3. Executes the C++ simulation demo and validates completion.
4. Exports the simulation and R-tree hierarchical MBR state to `build/state.json`.
5. Validates the JSON schema (entities, leaf MBRs, internal MBRs, query results).
6. Starts a local HTTP server and opens **Mission Control** in your default web browser (`http://127.0.0.1:8000/frontend/index.html`).

### Launcher Options & Flags

```bash
python run_demo.py --help
```

- `python run_demo.py`: Standard full demo launch with browser opening.
- `python run_demo.py --rebuild`: Force re-compilation of C++ targets before launching.
- `python run_demo.py --port 8080`: Use a specific port for the local web server (default: 8000).
- `python run_demo.py --no-browser`: Start the server without opening the browser automatically.
- `python run_demo.py --once`: Execute simulation, export, and JSON validation, then exit without running the HTTP server.

### Troubleshooting

- **CMake or Compiler Not Found:** Ensure CMake 3.20+ and a C++17 compiler (e.g. GCC via MSYS2 UCRT64, or Clang) are installed and added to your `PATH`.
- **Port Conflict:** If port 8000 is occupied by another application, `run_demo.py` automatically detects and binds the next available port (e.g. 8001), or reuses an existing active KESTREL instance.
- **Server Shutdown:** Press `Ctrl+C` in the launcher terminal to cleanly shut down only launcher-owned server processes.

---

## Build and Test Workflow

### Prerequisites

| Tool | Required | Status |
|------|----------|--------|
| g++ 11+ / Clang 11+ | Yes | Available (16.1.0, MSYS2 UCRT64) |
| CMake 3.20+ | Yes | Available (4.4.0) |
| Python 3.8+ | Yes | Available (3.13.0) |

### Manual Build Commands

```bash
cmake -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Debug
cmake --build build
```

### Run Core Regression Tests

```bash
cd build && ctest --output-on-failure
```

### Run Benchmarks

```bash
./build/benchmarks/kestrel_benchmark.exe
```

---

## Gate Progression

| Gate | Title | Status |
|------|-------|--------|
| 00 | Repository Reconnaissance and Specification | OPEN |
| 01 | Geometry Primitives | OPEN |
| 02 | Entity Model and Store | OPEN |
| 03 | R-tree Structural Foundation | OPEN |
| 04 | Insertion and Splitting | OPEN |
| 05 | Range Queries and Pruning | OPEN |
| 06 | Deletion and Dynamic Updates | OPEN |
| 07 | Kepler Belt Simulation | OPEN |
| 08 | Mission Queries and Hazard Assessment | OPEN |
| 09 | Benchmarking and Research Evaluation | OPEN |
| 10 | Mission-Control Visualization | OPEN |
| 11 | Final Verification and Academic Defence | OPEN |

---

## Key Documents

- [PROJECT_SSOT.md](PROJECT_SSOT.md) — Authoritative source of truth
- [AGENTS.md](AGENTS.md) — Agent instruction entry point
- [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) — System architecture
- [COMMANDS.md](docs/COMMANDS.md) — Gate invocation commands
- [Gate specifications](docs/gates/) — GATE-00 through GATE-11
- [ADR-001](docs/decisions/ADR-001-rtree-variant.md) — R-tree variant decision
- [ADR-002](docs/decisions/ADR-002-geometry.md) — Geometry model decision
- [ADR-003](docs/decisions/ADR-003-entity-storage.md) — Entity storage decision
