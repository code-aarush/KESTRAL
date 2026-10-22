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


### 5. Interactive Query Service (User Defined Spatial Queries)

The Mission Control frontend can execute a user defined region scan. The
authoritative result set is always produced by the C++ implementation: the
browser draws the region, converts it into world coordinates and asks the
query service, which runs the existing `MissionControl::region_scan`.

**Runtime shape:**

```
frontend (browser)  ──HTTP/JSON──▶  run_demo.py (query_api.py)
                                        │
                                        └──stdin/stdout──▶  kestrel_query (C++ process)
```

* `src/query_service.cpp` — the service. It parses and validates the request,
  runs the R-tree range query and answers with the entity ids and the
  traversal statistics the implementation actually produced. The pure function
  `handle_query_request()` is unit tested without any I/O.
* `src/scene.cpp` — the shared scene builder. The exporter and the service
  build the demonstration scene through the same function, so both observe
  exactly the same tree, and both compute the same query independent
  `scene_key`.
* `query_api.py` — the HTTP layer. It performs no geometry and no filtering;
  it forwards the request body to the service and returns its answer.
* `run_demo.py` — starts the service, serves the frontend and hosts the
  endpoints `/api/query` and `/api/scene`.

**Invariants:**
- The service builds the scene once and keeps that R-tree in memory: the
  simulation is never regenerated per query.
- A request is validated before the tree is touched. A malformed body, a
  non-finite coordinate, a wrong number of coordinates and an unordered region
  are rejected with `status: "invalid"`.
- The returned ids are the ids of the R-tree range query. No result id, no
  traversal count and no execution time is ever invented.
- A result is only displayed when its `scene_key` matches the `scene_key` of
  the loaded scene, so a result of another scene can never be mistaken for a
  fresh one.
- Loading a scene discards the region and the results of the previous scene.

The full request and response contract is documented in
[docs/api/QUERY_API.md](../api/QUERY_API.md).


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

### 6. Interactive Visualization Frontend (IMPLEMENTED — Gate 10)

An interactive 2D display of the simulation state and query results.

**Displays:**
- Entity positions and bounding boxes.
- R-tree node MBRs (internal and leaf levels).
- Query regions and query results.
- Trajectory corridors and hazard candidates.
- A step-through replay of the recorded R-tree range-query traversal (Traversal Replay).

**Scene contract (`state.json`):**

| Key | Meaning |
|-----|---------|
| `scene_id` | Content fingerprint of the scene and its query; changes whenever either changes. |
| `scene_key` | Content fingerprint of the scene alone; independent of the query. A live query service reports the same value for the same scene. |
| `entities[]` | Active entities with their bounding boxes. |
| `rtree.height`, `rtree.size` | Tree topology summary. |
| `rtree.internal_mbrs[]`, `rtree.leaf_mbrs[]` | Legacy flat MBR arrays (kept for existing consumers). |
| `rtree.root` | **Authoritative** nested hierarchy: `id`, `parent_id`, `type`, `is_root`, `is_leaf`, `depth`, `bounds`, `children`. |
| `query` | `query_id`, `bounds`, `results` (the returned entity IDs). |
| `trace` | `scene_id`, `query_id`, `query_bounds`, `truncated`, `total_events`, `events[]`. |

**Canonical identity strategy**

The scene uses exactly two identifier forms, and both are produced by the exporter
(`src/export.cpp`, helpers `hierarchy_node_id()` / `hierarchy_entity_id()`):

| Identifier | Form | Used by |
|------------|------|---------|
| Node | `node_<index>` — assigned by the exporter in DFS pre-order | `rtree.root` hierarchy, hierarchy panel, node inspector, `trace.events[].node_id` / `child_node_id` |
| Entity | numeric entity id | `entities[].id`, `query.results[]`, `trace.events[].entity_id` |

The hierarchy node carries the entity view as `entity_<id>` in its own `id` field plus the numeric
`entity_id`; the trace uses the numeric form, which is the identifier shared with `query.results`.

The R-tree's internal node identifier (1-based, used by the traversal recorder) is **not** exported.
While the hierarchy is written, the exporter resolves every internal identifier to its canonical
`node_<index>` identifier, so a trace event always refers to the node that was actually exported.
The frontend therefore resolves a traversal event with a single lookup
(`hierarchy.nodeMap.get(event.node_id)`) — no format conversion, no ambiguity.

**Frontend Features:**
- **Smooth Pan & Zoom:** Canvas navigation with mouse-drag panning, pinch-to-zoom, and mini-map navigation.
- **Entity Inspection Tooltips:** Hover over and click asteroids, probes, or debris to inspect real-time position, velocity vectors, entity IDs, and bounding coordinates.
- **Level-by-Level Filtering:** Toggle visibility of specific tree depths (Root → Internal Levels → Leaf MBRs).
- **Subtree Highlighting:** Click any bounding box to isolate and highlight its parent-child lineage and enclosed entities.
- **User-Drawn Query Windows:** Click-and-drag bounding rectangles directly on the radar grid to trigger live range queries.
- **Trajectory Corridor Generation:** Define origin and destination waypoints to dynamically visualize swept corridors and hazard intersections.
- **Visual Branch-and-Bound Debugger:** Step-by-step visual animation demonstrating how the R-tree searches for hazards.
- **Real-Time Query Metrics Dashboard:** Telemetry overlay showing candidates evaluated, pruning efficiency, and execution metrics.
- **Configurable Simulation Environment:** Live parameter controls for entity density, velocity ranges, and hazard generation frequencies.

**Trace validation**

The frontend only replays a trace when its `scene_id`, `query_id` and query bounds match the loaded
scene, when every event is well formed, and when the recorded results agree with `query.results`.
Loading a new scene always clears the previous replay, so a trace can never be reused for a different
scene or query.

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

### Traversal Trace (Traversal Replay feature)

`RTree::search` has an optional tracing overload. The trace is produced inside the search loop at
the exact decision points; it is never reconstructed from the result set. The untraced overload
delegates to the traced one with a `nullptr` trace, so both share one implementation and therefore
one result set.

```cpp
namespace kestrel {
    enum class RTreeTraceEventType {
        NodeVisited, MbrTested, BranchPruned, ChildEntered,
        LeafEntryExamined, EntityAccepted, TraversalCompleted
    };

    struct RTreeTraceEvent {
        RTreeTraceEventType type;
        std::size_t node_id;       // internal node id (1-based); 0 = no reference
        std::size_t child_node_id; // internal child node id (0 = none)
        int entity_id;             // entity referenced by the tested entry (-1 = none)
        BoundingBox mbr;           // bounding box that was tested
        bool intersects;            // outcome of the intersection test
    };

    struct RTreeTrace {
        std::vector<RTreeTraceEvent> events;
        std::size_t max_events = 20000;  // bound: the trace is flagged truncated beyond it
        bool truncated = false;
    };

    std::vector<int> search(const BoundingBox& query, QueryMetrics& metrics, RTreeTrace* trace) const;
}
```

The `node_id` / `child_node_id` fields hold the R-tree's **internal** node identifiers. They are
translated to the canonical `node_<index>` hierarchy identifiers by the exporter; they are never
exported as-is.

`MissionControl::region_scan(region, metrics, trace)` forwards the trace so the recorded traversal
belongs to the query that was actually executed.

### Exporter Interface

The exporter is a library (`src/export.h` / `src/export.cpp`) with a `main()` guarded by
`KESTREL_NO_MAIN`, so the export format can be unit tested without producing a second `main()`.

```cpp
namespace kestrel {
    // Canonical identifiers — the single source of truth for scene identifiers.
    std::string hierarchy_node_id(int index);        // "node_<index>"
    std::string hierarchy_entity_id(int entity_id);  // "entity_<id>"

    // Maps the internal R-tree node id to the canonical hierarchy identifier.
    using CanonicalNodeIdMap = std::map<std::size_t, std::string>;

    void export_node_hierarchy(const RTreeNode* node, std::ostream& out, int indent_level,
                               int& next_node_id, const std::string& parent_id, int depth,
                               bool is_root, CanonicalNodeIdMap* canonical_ids = nullptr);

    void export_simulation_state(const RTree& rtree, const EntityStore& store,
                                 const BoundingBox& query_box, const std::vector<int>& query_results,
                                 std::ostream& out, const RTreeTrace* trace = nullptr,
                                 std::uint64_t query_id = 1);
}
```

The optional arguments keep every existing caller valid: `export_node_hierarchy` can still be
called with seven arguments and `export_simulation_state` with five.

**Invariants:**
- The traced and untraced searches return the same entity IDs in the same order.
- A `branch_pruned` event always refers to an MBR that does not intersect the query region.
- A `child_entered` event always refers to an MBR that does intersect the query region.
- Every node reference written into the trace resolves to a node of the exported hierarchy.
- The trace's accepted entity IDs equal the exported `query.results`.
- The last recorded event is always `traversal_completed`, including for truncated traces.

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
