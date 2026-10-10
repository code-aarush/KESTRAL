# ADR-001 - R-tree Variant

**Status:** Accepted  
**Date:** 2026-10-09  
**Last updated:** 2026-10-10  
**Formally approved by Project Owner on 2026-10-10.**

---

## Context

KESTREL requires a 2D spatial index for dynamic entity management in a simulation.
The index must support insertion, deletion, moving entities, and range queries.
It must be implemented from scratch (no third-party spatial-indexing libraries).

The fundamental choice is which variant of the R-tree family to implement.

---

## Decision (Accepted)

Implement a conventional, dynamic, in-memory 2D R-tree using:

- **Split strategy:** Quadratic split (Guttman 1984).
  The quadratic algorithm considers all pairs of entries to seed the two groups,
  then assigns remaining entries by the least-enlargement heuristic.
  It is simpler to implement correctly than the linear split and adequate for
  the research question being investigated.

- **Deterministic tie-breaking:**
  To guarantee identical, reproducible tree structures and benchmark consistency across runs:
  1. *Seed selection ties:* When multiple candidate entry pairs yield identical maximal dead area
     (`d = area(union) - area(E1) - area(E2)`), select the pair with the lowest lexicographical
     entry IDs `(id_1, id_2)`.
  2. *Group assignment ties:* When an entry produces equal enlargement for both groups, assign
     the entry to the group with the smaller area; if areas are equal, assign to the group
     with fewer entries; if group sizes are also equal, assign to the first group (`group_1`).

- **Node capacity:** Configurable parameters `m` (minimum occupancy) and `M`
  (maximum occupancy), where `m <= floor(M/2)`. Exact values are deferred to OD-003.
  Default starting values for investigation: `M = 8`, `m = 2` (subject to owner decision).

- **Storage:** In-memory only. No disk-backed storage.

- **Dimensionality:** 2D only.

---

## Alternatives Considered

### Alternative 1 — Linear Split (Guttman 1984)
- Faster to compute than quadratic (O(n) vs O(n²) per split).
- Produces slightly lower-quality splits on average.
- **Rejected for now:** The performance difference is negligible for the dataset sizes
  in this project, and the quadratic algorithm is better studied and documented
  in primary literature, making it more defensible in an academic context.

### Alternative 2 — R*-tree (Beckmann et al., 1990)
- Significantly better query performance than the original R-tree due to:
  forced reinsertion, overlap minimisation, and margin-based split.
- **Deferred:** Implementing R*-tree requires substantially more complexity.
  The research question focuses on R-tree vs brute-force, not R-tree vs R*-tree.
  If results justify it, R*-tree can be introduced as a later extension with owner approval.

### Alternative 3 — Third-Party Library (e.g., Boost.Geometry, libspatialindex)
- Correct and battle-tested implementations exist.
- **Rejected by project scope:** The academic requirement is to implement the index
  from scratch. Using a library would not satisfy this requirement.

### Alternative 4 — k-d Tree
- Simpler to implement for static datasets.
- Poor performance for dynamic datasets with frequent insertion and deletion.
- **Rejected:** KESTREL's simulation requires dynamic updates; k-d trees require
  rebalancing or degraded performance under dynamic workloads.

---

## Consequences and Trade-offs

**Benefits:**
- Quadratic split is well-documented, teachable, and defensible.
- The implementation is manageable within the project timeline.
- Correctness can be verified against a brute-force oracle at each gate.

**Risks:**
- Quadratic split is slower than R*-tree for large datasets.
  This is acceptable because performance comparison is against brute-force, not against
  an optimised R-tree variant.
- Node capacity (m, M) significantly affects both query performance and tree structure.
  Owner must choose values intentionally (OD-003) rather than arbitrarily.

**Not included in this decision:**
- Nearest-neighbour queries — not required by the current gate plan.
- Concurrency — not required; deferred explicitly.
- 3D indexing — out of scope.
- Bulk loading — not required; dynamic insertion is sufficient.

---

## Validation Plan

Gate 03 will verify that the node and entry data structures satisfy structural invariants.
Gate 04 will verify that insertion and quadratic splitting preserve tree invariants.
Gate 05 will verify that range queries return correct results compared to the brute-force oracle.
Gate 06 will verify that deletion and updates maintain consistency.

---

## Approval Record

| Reviewer | Decision | Date | Notes |
|----------|---------|------|-------|
| Project Owner | ACCEPTED | 2026-10-10 | Formally accepted with deterministic tie-breaking rules |
