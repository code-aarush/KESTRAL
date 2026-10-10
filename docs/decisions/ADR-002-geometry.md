# ADR-002 � Geometry Model

**Status:** Accepted  
**Date:** 2026-10-09  
**Last updated:** 2026-10-10  
**Formally approved by Project Owner on 2026-10-10.**

---

## Context

KESTREL operates in a 2D simulated space. All spatial operations � entity bounds,
R-tree MBRs, range queries, and trajectory corridors � depend on a well-defined
geometry model. Inconsistent or undocumented boundary semantics are a common source
of correctness defects in spatial data structures.

The geometry model must be established, documented, and tested before any dependent
component is implemented.

---

## Decision (Accepted)

### Coordinate System
- 2D Cartesian coordinates using `double` for both axes.
- Coordinate range is unbounded (the simulation space bounds are a simulation parameter,
  not a geometry constraint).
- `NaN` and `+/-infinity` are invalid coordinate values. Any geometry operation that
  receives them produces implementation-defined (undefined) results unless otherwise tested.

### Point
```
struct Point { double x; double y; };
```
A point is valid if both `x` and `y` are finite (not NaN, not infinity).

### Bounding Box (Axis-Aligned Bounding Box)
```
struct BoundingBox { double min_x; double min_y; double max_x; double max_y; };
```
A bounding box is **valid** if and only if:
- `min_x <= max_x`
- `min_y <= max_y`
- All four coordinates are finite.

A **degenerate box** (zero-area box / point box) where `min_x == max_x` or
`min_y == max_y` is valid. A point can be represented as a degenerate box.

### Required Operations

The following operations must be implemented at Gate 01. No additional operations
are to be added without a gate criterion requiring them.

| Operation | Signature | Semantics |
|-----------|-----------|----------|
| `is_valid` | `bool is_valid(BoundingBox)` | True iff min <= max and all coords finite |
| `area` | `double area(BoundingBox)` | `(max_x - min_x) * (max_y - min_y)` |
| `union_of` | `BoundingBox union_of(BoundingBox, BoundingBox)` | Smallest AABB containing both |
| `intersects` | `bool intersects(BoundingBox, BoundingBox)` | See boundary semantics below |
| `contains` | `bool contains(BoundingBox outer, BoundingBox inner)` | True iff inner is fully within outer |
| `enlargement` | `double enlargement(BoundingBox base, BoundingBox to_add)` | `area(union_of(base, to_add)) - area(base)` |

### Boundary Intersection Semantics (Critical � must be tested)

**Proposed: closed (inclusive) boundaries.**

Two bounding boxes `A` and `B` intersect if and only if:
```
A.min_x <= B.max_x  AND  B.min_x <= A.max_x
AND
A.min_y <= B.max_y  AND  B.min_y <= A.max_y
```

This means:
- Boxes that share only an edge or a corner are considered to intersect.
- A point-box intersects any box that contains that point (inclusive boundary).

**Semantics confirmed:** Closed (inclusive) boundary semantics are formally accepted.
Two boxes sharing only an edge or a corner intersect. A point box on the boundary of another box intersects it.
Any coordinate containing NaN or infinity is strictly invalid (is_valid returns false).

### Containment Semantics (Proposed)
Box `inner` is contained within `outer` if and only if:
```
outer.min_x <= inner.min_x  AND  inner.max_x <= outer.max_x
AND
outer.min_y <= inner.min_y  AND  inner.max_y <= outer.max_y
```
Boxes with shared edges are considered contained (inclusive).

---

## Alternatives Considered

### Half-open (exclusive) boundaries
- Common in grid-based systems (e.g., `[min_x, max_x)`).
- Makes subdivision logic cleaner but is less natural for geometric overlap queries.
- A query box at the boundary would not match an entity exactly at that boundary.
- **Not proposed for now:** Inclusive semantics are more natural for this application
  and more common in R-tree literature. However, this requires owner confirmation.

### Using `float` instead of `double`
- Less precision; can introduce ordering instabilities in split heuristics.
- **Rejected:** `double` provides adequate precision for 2D simulation coordinates.

### Using integer coordinates
- Eliminates floating-point comparison issues.
- Would require a scale factor for the simulation, adding unnecessary complexity.
- **Rejected:** The simulation does not have a natural integer coordinate system.

---

## Consequences and Trade-offs

**Benefits:**
- A single documented geometry model prevents inconsistencies across components.
- Testing boundary cases before any component depends on them catches defects early.
- Closed boundaries are the conventional choice in R-tree implementations.

**Risks:**
- Floating-point equality comparison (`==`) in `is_valid` and boundary tests
  can cause issues at extreme values. Comparisons should use standard floating-point
  relations (`<=`, `>=`) rather than equality where possible.
- If boundary semantics change after Gate 01, all dependent tests must be revisited.
  This is why owner approval before implementation is required.

---

## Validation Plan

Gate 01 will:
- Test `is_valid` with valid, degenerate, and invalid inputs.
- Test `area` with zero-area, rectangular, and large boxes.
- Test `union_of` with disjoint, overlapping, and containing box pairs.
- Test `intersects` with: disjoint, overlapping, boundary-touching (edge and corner),
  fully contained, and degenerate (point) boxes.
- Test `contains` with the same cases.
- Test `enlargement` with zero enlargement and non-trivial enlargement cases.
- Establish what happens with `NaN` and `infinity` inputs and document the result.

---

## Approval Record

| Reviewer | Decision | Date | Notes |
|----------|---------|------|-------|
| Project Owner | ACCEPTED | 2026-10-10 | Formally accepted with closed (inclusive) boundary semantics |
