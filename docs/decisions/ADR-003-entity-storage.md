# ADR-003 � Entity Storage and Indexing

**Status:** Accepted  
**Date:** 2026-10-09  
**Last updated:** 2026-10-10  
**Formally approved by Project Owner on 2026-10-10.**

---

## Context

KESTREL manages a dynamic population of entities (Kepler Belt objects). Each entity
has an ID, spatial coordinates, and a bounding box. The system must:

1. Store and retrieve entity records by ID.
2. Maintain a spatial index (R-tree) over entity bounding boxes.
3. Keep the entity store and the spatial index consistent at all times.
4. Support the brute-force oracle (linear scan over all entities).

The key architectural decision is how to structure entity storage separately from the
spatial index, and how to enforce consistency between them.

---

## Decision (Accepted)

### Entity Representation (minimum viable entity)

```cpp
namespace kestrel {
    struct Entity {
        int id;                // Unique, positive. Assigned at creation; never reused.
        BoundingBox bounds;    // Axis-aligned bounding box. Must be valid (see ADR-002).
        // Additional fields (e.g., entity type, velocity) deferred to Gate 02 planning.
    };
}
```

Exact field set to be finalised at Gate 02, subject to owner approval.
Fields must satisfy the MNI check: only add fields that a Gate 02 criterion requires.

**ID semantics:**
- IDs are positive integers (> 0).
- IDs are unique within the active entity population.
- Once an entity is removed, its ID must not be reused within the same simulation run
  (prevents accidental stale-entry confusion).

**Active vs. inactive semantics:**
- An entity is active if it is present in the entity store.
- An inactive entity has been removed. It must not appear in any query result.
- The entity store does not store inactive entities. Removal deletes the record.

### Entity Store

```cpp
namespace kestrel {
    class EntityStore {
        std::unordered_map<int, Entity> entities_;
    public:
        void insert(Entity e);
        void update(int id, Entity updated);
        void remove(int id);
        const Entity& get(int id) const;  // throws or aborts if not found
        bool contains(int id) const;
        // Iterator access for brute-force oracle
        auto begin() const;
        auto end() const;
        std::size_t size() const;
    };
}
```

- `std::unordered_map<int, Entity>` provides O(1) average lookup, insert, and remove.
- The entity store does not perform spatial queries.
- The entity store is the source of truth for entity data.

**Why not a flat array or vector?**
`std::unordered_map` supports O(1) removal by ID without leaving holes.
A vector would require linear scan for removal or ID-based indexing with tombstones,
adding complexity not justified by any current criterion.

### R-tree and Entity Store Relationship

**Critical separation:**
- The entity store owns entity records.
- The R-tree indexes `(bounding_box, entity_id)` pairs only.
- The R-tree does not store entity data other than ID and bounding box.
- Clients must look up entity data from the entity store using the IDs returned by R-tree queries.

**Consistency invariant (must hold at all times after Gate 02):**

> Every active entity in the entity store has exactly one corresponding entry in the R-tree.
> Every R-tree entry's entity ID refers to an active entity in the entity store.
> There are no stale or orphaned R-tree entries.

Maintaining this invariant is the responsibility of the code that calls both the store
and the R-tree. This coordination logic lives outside both components (in the simulator
or a fa�ade � to be determined at the relevant gate).

**Update consistency:**
When an entity moves, the following must happen atomically from the perspective of the
simulation step:
1. Remove the old R-tree entry `(old_bounds, entity_id)`.
2. Update the entity store record with the new bounding box.
3. Insert the new R-tree entry `(new_bounds, entity_id)`.

If any step fails, the failure must be reported and the system must not be left in a
partial state. The exact mechanism (wrapper function, transaction semantics) will be
defined at Gate 06 or 07, whichever introduces movement.

---

## Alternatives Considered

### Alternative 1 � Embed the R-tree entry in the Entity struct
- Tighter coupling between entity data and spatial index.
- Makes it harder to test the R-tree independently of entity logic.
- **Rejected:** Separation allows the R-tree to be tested with minimal entity objects
  (just IDs and bounding boxes), improving testability.

### Alternative 2 � Intrusive list or array-based store with ID-to-index mapping
- Potentially better cache locality for iteration.
- More complex to implement correctly with dynamic insertions and deletions.
- **Rejected:** The complexity is not justified by any current requirement.
  Cache locality matters at benchmarking time; if it becomes relevant, reconsider at Gate 09.

### Alternative 3 � Store entity records inside R-tree leaf nodes
- Eliminates the separate lookup step after a query.
- Tightly couples R-tree internals to entity representation.
- Complicates node splitting (entity data moves with entries).
- **Rejected:** The R-tree should index spatial extents; entity data belongs in a
  dedicated store. This is consistent with the project architecture.

---

## Consequences and Trade-offs

**Benefits:**
- Clean separation makes both components independently testable.
- The brute-force oracle iterates the entity store directly without touching the R-tree.
- Entity store and R-tree can be modified independently at different gates without
  breaking each other's interface.

**Risks:**
- Consistency between the store and R-tree requires discipline. Every code path that
  modifies one must also update the other. Tests must explicitly verify the invariant.
- `std::unordered_map` has non-deterministic iteration order. **Policy:** All tests and benchmarks comparing R-tree query results with the brute-force oracle MUST sort entity ID lists before asserting equality.

---

## Validation Plan

Gate 02 will:
- Test insert: entity appears in store, is retrievable by ID.
- Test duplicate ID: insertion of a second entity with the same ID is an error.
- Test missing ID: `get` and `remove` with a non-existent ID report an error.
- Test update: entity record is modified; old data is not accessible.
- Test remove: entity is no longer in the store; `contains` returns false.
- Test size: `size()` reflects the correct count after inserts and removes.

Gate 06 will verify the consistency invariant with mixed insert/update/remove sequences.

---

## Approval Record

| Reviewer | Decision | Date | Notes |
|----------|---------|------|-------|
| Project Owner | ACCEPTED | 2026-10-10 | Formally accepted with sorted oracle comparison policy |
