# PROJECT SSOT — KESTREL Single Source of Truth

**Document version:** 0.1.0
**Last updated:** 2026-10-10
**Maintained by:** Project Owner

> This document is the authoritative reference for every agent, developer, and reviewer.
> All decisions, gate statuses, and invariants recorded here supersede any conflicting content
> in other files. If a contradiction is found, update this document and notify the project owner.

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| Codename | KESTREL |
| Full form | Kepler Exploration — Spatial Tree for Risk Evaluation and Localization |
| Formal title | Kepler Belt Mission Backend — Dynamic Spatial Indexing and Hazard Detection Using R-Trees |
| Repository folder | `kestrel/` |
| C++ namespace | `kestrel` |
| Demo executable | `kestrel_demo` |
| Academic context | Independent research / coursework project |

---

## 2. Research Question

> **"How effectively can a dynamic spatial index (R-tree) support continuous region monitoring
> and hazard detection in a simulated deep-space environment?"**

The answer must be supported by verifiable deterministic test suites and documented load characteristics,
not by assertion or theoretical argument alone.

---

## 3. Problem Statement and Academic Objective

KESTREL investigates a custom, dynamically updated, two-dimensional R-tree for spatial
indexing in a fictional Kepler Belt exploration simulation.

**Academic objectives:**
- Implement an R-tree spatial index from scratch (no third-party spatial-indexing libraries).
- Demonstrate correctness via direct deterministic unit testing.
- Produce a clean, explainable codebase that a student can defend in a viva.

---

## 4. Scope

### In scope
- 2D R-tree with quadratic split, dynamic insertion, deletion, and range queries.
- Kepler Belt simulation: deterministic, seeded, entity movement and lifecycle.
- Mission queries: region scan, nearby-object retrieval, trajectory-corridor queries.
- Hazard assessment: broad-phase (R-tree) + narrow-phase (geometry) pipeline.
- 2D mission-control visualization (frontend, stack TBD at Gate 10).
- C++ implementation with standard library containers and RAII.

### Explicitly out of scope
- R*-tree or R+-tree optimizations (deferred to future decision).
- 3D spatial indexing.
- Nearest-neighbour queries (not required by current gates).
- Concurrency or thread safety.
- Third-party spatial-indexing library as a substitute for the core R-tree.
- Database backends, distributed architectures, or plugin systems.
- Elaborate physics engine (simulation physics must be deliberately simple).
- Custom testing framework (use standard C++ test approach).

---

## 5. Agreed Architecture and Terminology

See `docs/architecture/ARCHITECTURE.md` for the full architecture document.

**Key terminology (use these terms consistently):**

| Term | Definition |
|------|-----------|
| Entity | A simulated Kepler Belt object (asteroid, probe, etc.) with an ID, position, and bounding box |
| Entity Store | A `std::unordered_map<int, Entity>` that owns entity records |
| Bounding Box (BB) | An axis-aligned rectangle enclosing an entity or subtree |
| MBR | Minimum Bounding Rectangle — the tightest AABB enclosing a set of entries |
| R-tree Node | A tree node containing up to `M` entries (leaf or internal) |
| Leaf Node | An R-tree node whose entries point to entity IDs and their bounding boxes |
| Internal Node | An R-tree node whose entries point to child nodes and their MBRs |
| Broad Phase | R-tree candidate retrieval — returns a superset of query results |
| Narrow Phase | Precise geometry check applied to broad-phase candidates |
| Hazard | An entity whose narrow-phase check confirms a trajectory intersection |
| Gate | A verified development milestone with explicit acceptance criteria |
| SSOT | This document — Single Source of Truth |
| MNI | Minimum Necessary Implementation — the engineering doctrine |

---

## 6. Current Gate and Status

| Gate | Title | Status |
|------|-------|--------|
| GATE-00 | Repository Reconnaissance and Specification | **PASS** |
| GATE-01 | Geometry Primitives | **PASS** |
| GATE-02 | Entity Model and Store | **PASS** |
| GATE-03 | R-tree Structural Foundation | **PASS** |
| GATE-04 | Insertion and Splitting | **PASS** |
| GATE-05 | Range Queries and Pruning | **PASS** |
| GATE-06 | Deletion and Dynamic Updates | **PASS** |
| GATE-07 | Kepler Belt Simulation | **PASS** |
| GATE-08 | Mission Queries and Hazard Assessment | **PASS** |
| GATE-09 | Benchmarking and Research Evaluation | **PASS** |
| GATE-10 | Mission-Control Visualization | **PASS** |
| GATE-11 | Final Verification and Academic Defence | **IN REVIEW** |

**Active gate:** GATE-11
**Gate status note:** GATE-11 verification complete (7 PASS, 2 UNVERIFIED toolchain-constrained, 1 PENDING owner approval). Submitted for Project Owner review.

---

## 7. Links

### Gate Specifications
- [GATE-00](docs/gates/GATE-00.md) — Repository Reconnaissance and Specification
- [GATE-01](docs/gates/GATE-01.md) — Geometry Primitives
- [GATE-02](docs/gates/GATE-02.md) — Entity Model and Store
- [GATE-03](docs/gates/GATE-03.md) — R-tree Structural Foundation
- [GATE-04](docs/gates/GATE-04.md) — Insertion and Splitting
- [GATE-05](docs/gates/GATE-05.md) — Range Queries and Pruning
- [GATE-06](docs/gates/GATE-06.md) — Deletion and Dynamic Updates
- [GATE-07](docs/gates/GATE-07.md) — Kepler Belt Simulation
- [GATE-08](docs/gates/GATE-08.md) — Mission Queries and Hazard Assessment
- [GATE-09](docs/gates/GATE-09.md) — Benchmarking and Research Evaluation
- [GATE-10](docs/gates/GATE-10.md) — Mission-Control Visualization
- [GATE-11](docs/gates/GATE-11.md) — Final Verification and Academic Defence

### Architecture Decision Records
- [ADR-001](docs/decisions/ADR-001-rtree-variant.md) — R-tree variant (Status: Accepted)
- [ADR-002](docs/decisions/ADR-002-geometry.md) — Geometry model (Status: Accepted)
- [ADR-003](docs/decisions/ADR-003-entity-storage.md) — Entity storage and indexing (Status: Accepted)
- [ADR-004](docs/decisions/ADR-004-benchmarks.md) - Benchmark dataset sizes and metrics (Status: Accepted)
- [ADR-005](docs/decisions/ADR-005-frontend-stack.md) — Frontend technology stack (Status: Accepted)

### Agent Procedures
- [Agent Instructions](AGENTS.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Commands](docs/COMMANDS.md)

### Skills
- `.agents/skills/gate-plan/SKILL.md`
- `.agents/skills/gate-implement/SKILL.md`
- `.agents/skills/gate-review/SKILL.md`

---

## 8. Critical Invariants

These invariants must hold at all times once the relevant component is implemented:

1. **Entity Store / R-tree consistency:** Every active indexed entity has exactly one R-tree entry.
   Removal or movement must not leave stale entries.

2. **MBR correctness:** Every internal node MBR is the exact union of all child MBRs or leaf entries
   within its subtree. No entry falls outside its ancestor MBR.

3. **Occupancy bounds:** Every node (except the root) has between `m` and `M` entries, where
   `m <= floor(M/2)`. The root has at least 2 entries when the tree height is > 1.

4. **Broad/narrow phase separation:** The R-tree performs candidate retrieval only. A narrow-phase
   geometry check must be performed before classifying any entity as a hazard or collision.

5. **Determinism:** All tests and benchmarks that claim reproducibility use fixed seeds and produce
   identical results across runs on the same machine.

6. **No fabricated evidence:** Gate criteria are marked PASS only with recorded, reproducible
   test output. No simulated or invented measurements are permitted.

---

## 9. Verification Policy

- A gate is **OPEN** until every mandatory acceptance criterion is PASS with evidence.
- A gate transitions to **IN REVIEW** when the developer submits results for independent review.
- A gate is **PASS** only after: all criteria PASS, independent review complete, owner approval given.
- A gate is **FAIL** if any criterion fails; it returns to the developer for focused correction.
- **NOT TESTED** means evidence is missing; it counts as a blocking condition for PASS.
- Compilation alone is not verification. Test existence alone is not verification.

---

## 10. Toolchain (Verified by Gate-00 Setup Agent)

| Tool | Status | Version / Path |
|------|--------|---------------|
| g++ (C++ compiler) | Available | 16.1.0, MSYS2 UCRT64 (`C:\msys64\ucrt64\bin\g++.exe`) |
| mingw32-make | Available | MSYS2 UCRT64 (`C:\msys64\ucrt64\bin\mingw32-make.exe`) |
| cmake | Available | 4.4.0, MSYS2 UCRT64 (C:\msys64\ucrt64\bin\cmake.exe) |
| git | Available | 2.55.0.windows.4 |
| C++ standard | Target | C++17 (safe with g++ 16.1.0) |

**Important:** CMake is the active build system as per OD-001. The `CMakeLists.txt` is fully activated.

---

## 11. Decisions Requiring Future Owner Approval

| ID | Decision | Status |
|----|---------|--------|
| OD-001 | CMake installation vs Makefile-first build workflow | **Resolved (CMake 4.4.0 adopted)** |
| OD-002 | Frontend visualization technology stack (Gate 10) | **Resolved (ADR-005 Accepted)** |
| OD-003 | Final R-tree node capacity parameters (m, M) | **Pending** |
| OD-004 | Benchmark dataset sizes and performance thresholds | **Resolved (ADR-004 Accepted)** |
| OD-005 | Whether R*-tree is in scope as an extension | **Pending** |
| OD-006 | ADR-001, ADR-002, ADR-003 formal acceptance | **Resolved (ADR-001, 002, 003 Accepted)** |
