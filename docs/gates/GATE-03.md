# GATE-03 — R-tree Structural Foundation

**Gate ID:** GATE-03  
**Status:** OPEN  
**Created:** 2026-10-09  
**Last updated:** 2026-10-09  

---

## Purpose

Define the internal node and entry data structures of the R-tree and establish all
structural invariants. Implement structural validation for use in subsequent gates.
Do not add insertion or query logic in this gate — only the data structure and
its verifiable invariants.

---

## Prerequisites

| Prerequisite | Gate | Status |
|-------------|------|--------|
| Geometry primitives | GATE-01 | OPEN |
| Entity model and store | GATE-02 | OPEN |
| ADR-001 accepted by owner | ADR-001 | Proposed |
| ADR-003 accepted by owner | ADR-003 | Proposed |

---

## Scope

### Included
- Leaf node and internal node type definitions.
- Entry representations: leaf entries `(BoundingBox, entity_id)` and
  internal entries `(MBR, child_node_pointer)`.
- Parent relationship tracking and root handling.
- Occupancy rules: minimum `m`, maximum `M`.
- MBR recomputation from children.
- A structural validation function (used in all subsequent gate tests).
- An empty-tree constructor and basic structural properties (height, size).

### Excluded
- Insertion logic (Gate 04).
- Splitting logic (Gate 04).
- Query logic (Gate 05).
- Deletion logic (Gate 06).
- Any entity or simulation integration.

---

## Relevant Architecture Decisions

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | R-tree variant | Proposed — owner acceptance required |
| ADR-002 | Geometry model | Proposed |

---

## Planned Implementation Files

| File | Action |
|------|--------|
| `src/rtree_node.h` | Create |
| `src/rtree.h` | Create (interface only, no insert/query yet) |
| `src/rtree.cpp` | Create (constructor, structural validation) |
| `tests/test_rtree_structure.cpp` | Create |

---

## Acceptance Criteria

### GATE-03-AC-01 — Leaf and internal node types are defined

**Requirement:** The implementation defines separate representations for leaf nodes
(entries containing `BoundingBox` + `entity_id`) and internal nodes (entries containing
`BoundingBox` MBR + child node pointer). These must be distinct and type-safe.  
**Verification:** Read `rtree_node.h`; confirm separate types or tagged union with
clear distinction.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-03-AC-02 — Occupancy parameters are configurable

**Requirement:** Node capacity `M` (maximum entries) and `m` (minimum entries, `m <= M/2`)
are configurable at R-tree construction time or compile time. Default values are documented.  
**Verification:** Read `rtree.h`; confirm parameter exposure. Verify `m <= floor(M/2)` is
enforced or asserted.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-03-AC-03 — An empty tree satisfies structural invariants

**Requirement:** A newly constructed R-tree has height 0 (or 1 with an empty root),
zero entries, and passes `validate_structure()`.  
**Verification:** Construct empty tree; call `validate_structure()`; check size=0 and height.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-03-AC-04 — MBR recomputation is correct

**Requirement:** A helper function that computes the MBR of a node's entries produces
the correct union of all entry bounding boxes.  
**Verification:** Construct a node manually with known entries; compute MBR; verify against
expected union.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-03-AC-05 — validate_structure detects violations

**Requirement:** `validate_structure()` detects and reports: entries outside their parent's
MBR, occupancy violations (too many or too few entries for non-root nodes), incorrect MBRs,
and broken parent links.  
**Verification:** Construct a structurally valid tree stub; introduce a deliberate violation;
confirm `validate_structure()` returns false or throws. Repeat for each violation type.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-03-AC-06 — All R-tree code is in the kestrel namespace

**Requirement:** All types and functions from Gate-03 are in the `kestrel` namespace.  
**Verification:** Read header files; confirm namespace.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-03-AC-07 — Compilation succeeds with required flags

**Requirement:** All Gate-03 files compile without errors or warnings using
`g++ -std=c++17 -Wall -Wextra -Wpedantic`.  
**Verification:** Compile command output; zero warnings expected.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

## Actual Evidence and Test Results

*To be populated after implementation.*

---

## Independent Reviewer Findings

| Criterion | Reviewer Status | Evidence |
|-----------|----------------|---------|
| GATE-03-AC-01 | NOT TESTED | — |
| GATE-03-AC-02 | NOT TESTED | — |
| GATE-03-AC-03 | NOT TESTED | — |
| GATE-03-AC-04 | NOT TESTED | — |
| GATE-03-AC-05 | NOT TESTED | — |
| GATE-03-AC-06 | NOT TESTED | — |
| GATE-03-AC-07 | NOT TESTED | — |

---

## Final Decision

**Gate status:** OPEN  

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | PENDING | — | — |
| Gate PASS approved | PENDING | — | — |
