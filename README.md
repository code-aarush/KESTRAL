# KESTREL

**Kepler Exploration — Spatial Tree for Risk Evaluation and Localization**

A C++ academic project investigating a custom, dynamically updated, two-dimensional R-tree
for spatial indexing in a fictional Kepler Belt exploration simulation.

---

## Research Question

> *"How effectively can an R-tree reduce the computational cost of dynamic spatial queries
> compared with brute-force spatial scanning in a simulated deep-space environment?"*

---

## Project Overview

KESTREL builds a complete spatial-indexing system around a hand-written R-tree — no
third-party spatial-indexing libraries. The simulation places fictional Kepler Belt objects
(asteroids, probes, hazards) in 2D space. Mission queries search for entities within a region,
near a trajectory corridor, or at risk of collision. A brute-force oracle provides differential
correctness testing, and reproducible benchmarks quantify the R-tree's query-cost advantage.

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
Benchmark Engine          Brute-Force Oracle
    ¦                          ¦  (differential correctness)
    ?                          ?
 Reports                    Test Suite

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
+-- benchmarks/         Benchmark code (PLANNED — not yet present)
+-- frontend/           2D visualization (PLANNED — stack TBD at Gate 10)
```

---

## Build and Test Workflow

> **Note:** This section documents the intended workflow. No source files exist yet.
> The build system will be activated at Gate 01.

### Prerequisites

| Tool | Required | Status |
|------|----------|--------|
| g++ 11+ | Yes | Available (16.1.0, MSYS2 UCRT64) |
| CMake 3.20+ | Preferred | **Not on PATH** — see SSOT OD-001 |
| mingw32-make | Alternative | Available (MSYS2 UCRT64) |

### Intended build commands (CMake path, pending CMake installation)

```bash
cmake -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Debug
cmake --build build
```

### Intended test command

```bash
cd build && ctest --output-on-failure
```

### Manual build fallback (g++ directly, before CMake is available)

```bash
# Example — exact flags to be defined at Gate 01
g++ -std=c++17 -Wall -Wextra -o kestrel_test tests/test_geometry.cpp src/geometry.cpp
./kestrel_test
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
