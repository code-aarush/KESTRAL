# KESTREL — System Architecture

**Status:** Target architecture specification. Components marked PLANNED do not yet exist.
**Last updated:** 2026-10-09
**See also:** `PROJECT_SSOT.md`, ADR-001, ADR-002, ADR-003

> This document describes the target architecture. It does not assert that any component
> other than the repository structure currently exists. Do not assume a component is
> implemented because it appears in a diagram here.

---

## Architectural Principles

1. **Separation of concerns.** The entity store owns entity data. The R-tree owns spatial
   indexing. The mission layer owns query logic. These three layers are distinct.
2. **Broad/narrow phase separation.** The R-tree is a broad-phase filter only. It returns
   candidates. A narrow-phase geometry check must classify each candidate before any
   hazard or collision determination is made.
3. **Correctness before performance.** Every component must be verified against a brute-force
   tests must provide exact expected results before benchmarking. Benchmark measurements are valid only on a correct implementation.
4. **Determinism.** All simulation runs and tests use fixed seeds. Results must be reproducible.
5. **Minimum Necessary Implementation.** Every component is as small as it needs to be to
   satisfy the currently approved gate criteria.

---

## System Overview

```
+-------------------------------------------------------------+
¦                    KESTREL System                           ¦
¦                                                             ¦
¦  +------------------------------------------------------+   ¦
¦  ¦            Kepler Belt Simulator  [PLANNED]          ¦   ¦
¦  ¦  - Seeded, deterministic entity generation           ¦   ¦
¦  ¦  - Entity movement, appearance, disappearance        ¦   ¦
¦  ¦  - Simple documented physics (not realistic)         ¦   ¦
¦  +------------------------------------------------------+   ¦
¦              ¦ Entity events (insert/move/remove)           ¦
¦              ?                                              ¦
¦  +------------------------------------------------------+   ¦
¦  ¦           Entity Store  [PLANNED]                    ¦   ¦
¦  ¦  std::unordered_map<int, Entity>                     ¦   ¦
¦  ¦  - Owns entity records                               ¦   ¦
¦  ¦  - Source of truth for entity state                  ¦   ¦
¦  +------------------------------------------------------+   ¦
¦              ¦ (id, bounding_box) index entries             ¦
¦              ?                                              ¦
¦  +------------------------------------------------------+   ¦
¦  ¦       R-tree Spatial Index  [PLANNED]                ¦   ¦
¦  ¦  - Custom 2D dynamic R-tree (from scratch)           ¦   ¦
¦  ¦  - Quadratic split strategy                          ¦   ¦
¦  ¦  - Configurable node capacity (m, M)                 ¦   ¦
¦  ¦  - Indexes (bounding_box, entity_id) pairs           ¦   ¦
¦  ¦  - Broad-phase candidate retrieval only              ¦   ¦
¦  +------------------------------------------------------+   ¦
¦              ¦ Candidate entity IDs                        ¦
¦              ?                                              ¦
¦  +------------------------------------------------------+   ¦
¦  ¦   Mission Query / Hazard Assessment  [PLANNED]       ¦   ¦
¦  ¦  Broad phase: R-tree candidate retrieval             ¦   ¦
¦  ¦  Narrow phase: precise geometry check per candidate  ¦   ¦
¦  ¦  - Region scan                                       ¦   ¦
¦  ¦  - Nearby-object retrieval                           ¦   ¦
¦  ¦  - Trajectory-corridor query                         ¦   ¦
¦  ¦  - Hazard/collision classification                   ¦   ¦
¦  +------------------------------------------------------+   ¦
¦                                                             ¦
¦                                          Test Suite            ¦
¦                                                             ¦
¦  +------------------------------------------------------+   ¦
¦  ¦   2D Visualization Frontend  [PLANNED - Gate 10]     ¦   ¦
¦  ¦  Stack: TBD (requires owner approval at Gate 10)     ¦   ¦
¦  ¦  Shows: entities, query regions, R-tree MBRs,        ¦   ¦
¦  ¦         trajectories, hazard results                 ¦   ¦
¦  ¦  Decoupled from core index and tests                 ¦   ¦
¦  +------------------------------------------------------+   ¦
+-------------------------------------------------------------+
```

---

## Component Descriptions

### 1. Kepler Belt Simulator (PLANNED — Gate 07)

Generates and manages a population of fictional Kepler Belt objects in 2D space.

**Responsibilities:**
- Seeded, deterministic random entity generation.
- Entity movement along simple documented trajectories.
- Entity appearance (insertion) and disappearance (removal) over simulation steps.
- Triggering entity-store and R-tree updates on every change.

**Constraints:**
- Physics must be deliberately simple and documented. No elaborate simulation engine.
- Must produce reproducible output for the same seed.
- Must not contain any query or spatial-indexing logic.

### 2. Entity Model and Entity Store (PLANNED — Gate 02)

The entity store is the authoritative record of all entities in the simulation.

**Entity attributes (minimum — exact set defined at Gate 02):**
- `id` (int) — unique, positive identifier.
- `position` — a 2D point.
- `bounding_box` — an axis-aligned bounding box enclosing the entity.
- Type or classification field (asteroid, probe, etc.) — details at Gate 02.

**Entity Store:**
- `std::unordered_map<int, Entity>` (proposed — see ADR-003).
- Owns entity records. Provides insert, update, remove, and lookup by ID.
- Does not perform spatial queries.

**Consistency invariant (Gate 02+):**
Every active entity in the store must have a corresponding entry in the R-tree.
Removal from the store must trigger removal from the R-tree. The store and index
must never be inconsistent.

### 3. Custom R-tree Spatial Index (PLANNED — Gates 03–06)

The core research data structure. Must be implemented from scratch.

**Implementation decisions (see ADR-001 — Proposed):**
- 2D, dynamic, in-memory R-tree.
- Quadratic split strategy (Guttman 1984).
- Configurable node capacity: minimum occupancy `m`, maximum occupancy `M`
  (exact values are owner decision OD-003).
- Each leaf entry: `(bounding_box, entity_id)`.
- Each internal entry: `(mbr, child_node_pointer)`.

**Key operations:**
- `insert(bounding_box, entity_id)` — insert a new entry.
- `remove(bounding_box, entity_id)` — remove an entry (underflow handling required).
- `search(query_box)` ? list of entity IDs — range search.
- `update(old_box, new_box, entity_id)` — move an entity.

**Invariants:**
- Every node except root has between `m` and `M` entries.
- Root has at least 2 entries if tree height > 1.
- Every internal node MBR is the exact MBR of its children.
- No stale entries after removal or update.

**Explicitly excluded (without further owner approval):**
R*-tree or R+-tree, 3D indexing, nearest-neighbour queries, concurrency.

### 4. Mission Query and Hazard Assessment Layer (PLANNED — Gate 08)

Implements application-level spatial queries using the R-tree as a broad-phase filter.

**Query types:**
- **Region scan:** return all entities whose bounding boxes overlap a query region.
- **Nearby-object retrieval:** return entities within a distance threshold (approximated
  via bounding box expansion or exact distance check — narrow phase).
- **Trajectory-corridor query:** return entities that may intersect a trajectory corridor
  (broad phase on corridor bounding box; narrow phase on exact corridor geometry).

**Hazard assessment pipeline:**
1. Broad phase: R-tree returns candidate entity IDs within a query region.
2. Narrow phase: For each candidate, perform a precise geometry check.
3. Classification: Only candidates passing the narrow-phase check are classified as hazards.

The R-tree must not contain hazard-classification logic. That belongs in the mission layer.


A linear scan over the entity store that answers the same spatial queries as the R-tree.
Used exclusively for differential correctness testing.


### 6. Benchmark Engine (PLANNED — Gate 09)

Measures native R-tree performance under structural load.

**Metrics:**
- Query latency (nanoseconds or microseconds per query).
- Index build and update time.
- Nodes visited per query (R-tree internal metric).
- Exact matches (narrow-phase checks performed).
- Memory usage where measurable.

**Methodology requirements:**
- Fixed seeds for all random inputs.
- Warm-up runs before measurement.
- Multiple measurement runs; report min/mean/max or percentiles.
- Vary: object count, spatial distribution, query size, movement rate.
- Raw result files (CSV or similar) committed to `docs/reports/`.
- Do not fabricate or extrapolate measurements.

### 6. 2D Visualization Frontend (PLANNED — Gate 10)

An interactive 2D display of the simulation state and query results.

**Displays:**
- Entity positions and bounding boxes.
- R-tree node MBRs (internal and leaf levels).
- Query regions and query results.
- Trajectory corridors and hazard candidates.

**Constraints:**
- Technology stack must be selected and approved by the owner at Gate 10.
- Must be completely decoupled from core C++ index and test code.
- Core tests must remain runnable without the frontend.
- `frontend/` is a placeholder until Gate 10 planning begins.

---

## File Structure (Target — Gates 01–11)

```
src/
+-- geometry.h / geometry.cpp         (Gate 01) Point, BoundingBox
+-- entity.h / entity.cpp             (Gate 02) Entity model
+-- entity_store.h / entity_store.cpp (Gate 02) Entity Store
+-- rtree_node.h                      (Gate 03) Node types and entries
+-- rtree.h / rtree.cpp               (Gates 03–06) R-tree implementation
+-- simulator.h / simulator.cpp       (Gate 07) Kepler Belt Simulator
+-- mission.h / mission.cpp           (Gate 08) Mission queries
+-- main.cpp                          (Demo executable, Gate 08+)

tests/
+-- test_geometry.cpp                 (Gate 01)
+-- test_entity.cpp                   (Gate 02)
+-- test_rtree_structure.cpp          (Gate 03)
+-- test_rtree_insert.cpp             (Gate 04)
+-- test_rtree_query.cpp              (Gate 05)
+-- test_rtree_delete.cpp             (Gate 06)
+-- test_simulator.cpp                (Gate 07)
+-- test_mission.cpp                  (Gate 08)
+-- test_runner.cpp                   (Minimal test harness — if needed)

benchmarks/
+-- benchmark_main.cpp                (Gate 09)
+-- results/                          (Raw benchmark output)

frontend/                             (Gate 10 — stack TBD)
```

---

## Interface Contracts (Draft — subject to Gate-by-Gate refinement)

### Geometry (Gate 01)
```cpp
namespace kestrel {
    struct Point { double x, y; };
    struct BoundingBox { double min_x, min_y, max_x, max_y; };

    bool is_valid(BoundingBox b);               // min_x <= max_x && min_y <= max_y
    double area(BoundingBox b);
    BoundingBox union_of(BoundingBox a, BoundingBox b);
    bool intersects(BoundingBox a, BoundingBox b); // boundary semantics: see ADR-002
    bool contains(BoundingBox outer, BoundingBox inner);
    double enlargement(BoundingBox base, BoundingBox addition);
}
```

These are draft interfaces. Final interfaces are defined at Gate 01 implementation.

### Entity Store (Gate 02)
```cpp
namespace kestrel {
    class EntityStore {
    public:
        void insert(Entity e);
        void update(int id, Entity updated);
        void remove(int id);
        const Entity& get(int id) const;
        bool contains(int id) const;
        // iteration support for simulation consistency checks
    };
}
```

### R-tree (Gates 03–06)
```cpp
namespace kestrel {
    class RTree {
    public:
        void insert(BoundingBox bb, int entity_id);
        void remove(BoundingBox bb, int entity_id);
        std::vector<int> search(BoundingBox query) const;
        // structural validation for testing
        bool validate_structure() const;
    };
}
```

---

## Deferred Decisions

| Decision | Reference | Status |
|---------|-----------|--------|
| R-tree node capacity (m, M) | OD-003 | Pending owner decision |
| Frontend technology stack | OD-002 | Pending — Gate 10 |
| CMake vs Makefile build | OD-001 | Pending — affects Gate 01 |
| ADR-001 formal acceptance | ADR-001 | Proposed |
| ADR-002 formal acceptance | ADR-002 | Proposed |
| ADR-003 formal acceptance | ADR-003 | Proposed |
