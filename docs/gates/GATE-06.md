# GATE-06 — Deletion and Dynamic Updates

**Gate ID:** GATE-06  
**Status:** OPEN  
**Created:** 2026-10-09  
**Last updated:** 2026-10-09  

---

## Purpose

Implement R-tree entry removal with underflow handling using the condensation-and-reinsertion
strategy (Guttman 1984). Implement entity movement (update) as an atomic remove+insert.
Verify that all structural invariants hold and that no stale entries remain after
mixed operation sequences. Continue differential testing against the brute-force oracle.

---

## Prerequisites

| Prerequisite | Gate | Status |
|-------------|------|--------|
| Range queries and pruning | GATE-05 | OPEN |

---

## Scope

### Included
- `remove(BoundingBox, entity_id)` from the R-tree.
- Underflow handling: collect underflowing nodes and reinsert their entries.
- Root adjustment: shrink root when it has one child.
- `update(old_box, new_box, entity_id)` as remove(old) + insert(new).
- `validate_structure()` after every test operation.
- Oracle comparison after mixed insert/remove/update sequences.

### Excluded
- Any entity-store/R-tree consistency enforcement at the application layer
  (the R-tree remove/insert are standalone operations here).
- Simulation integration (Gate 07).

---

## Relevant Architecture Decisions

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | R-tree variant (condensation strategy) | Proposed |
| ADR-002 | Geometry model | Proposed |
| ADR-003 | Entity storage and indexing (consistency invariant) | Proposed |

---

## Planned Implementation Files

| File | Action |
|------|--------|
| `src/rtree.cpp` | Update (add remove, update, underflow handling) |
| `tests/test_rtree_delete.cpp` | Create |

---

## Acceptance Criteria

### GATE-06-AC-01 — Removing the only entry leaves an empty tree

**Requirement:** After inserting 1 entry and removing it, `search(any_box)` returns empty,
size=0, and `validate_structure()` passes.  
**Verification:** Insert 1 entry, remove it, check size and search result.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-06-AC-02 — Removing entries without underflow maintains invariants

**Requirement:** Removing entries from a tree that has more than `m` entries per node does
not trigger reinsertion. `validate_structure()` passes after removal.  
**Verification:** Fill a node to M entries; remove one; validate_structure() passes.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-06-AC-03 — Underflow triggers condensation and reinsertion

**Requirement:** When a node falls below `m` entries after a removal, the node is eliminated
and its remaining entries are reinserted. The tree is still valid after condensation.
`validate_structure()` passes.  
**Verification:** Construct a scenario where removal causes underflow; verify condensation occurs;
validate_structure() passes; all remaining entries are still searchable.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-06-AC-04 — Root adjustment occurs when root has one child

**Requirement:** After a condensation that leaves the root with a single child,
the child becomes the new root and tree height decreases by one.  
**Verification:** Construct a two-level tree; remove entries until root has one child;
confirm height decreases; validate_structure() passes.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-06-AC-05 — Update is atomic: no stale entries remain

**Requirement:** After `update(old_box, new_box, entity_id)`, searching with `old_box` does
not return `entity_id`, and searching with a box overlapping `new_box` returns `entity_id`.  
**Verification:** Insert entry, update it, verify old location does not return it; new location does.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-06-AC-06 — MBRs and parent links are correct after all operations

**Requirement:** After any mixed sequence of insertions, removals, and updates,
`validate_structure()` passes.  
**Verification:** Run a sequence of 50+ mixed operations with fixed seed; validate_structure()
passes after the sequence.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-06-AC-07 — Oracle comparison passes after mixed operations

**Requirement:** After any mixed sequence of operations, the R-tree search results match the
brute-force oracle results for all tested query boxes. No discrepancy is tolerated.  
**Verification:** Mirror all operations in the oracle (a set of active entries); run 20+ queries;
compare results.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-06-AC-08 — Removing a non-existent entry is handled gracefully

**Requirement:** Calling `remove` with an ID or bounding box that does not exist in the tree
does not corrupt the tree. Either an error is returned/thrown, or a no-op with documented
behaviour occurs.  
**Verification:** Remove a non-existent entry; validate_structure() still passes.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-06-AC-09 — Compilation succeeds with required flags

**Requirement:** All Gate-06 files compile without errors or warnings.  
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
| GATE-06-AC-01 | NOT TESTED | — |
| GATE-06-AC-02 | NOT TESTED | — |
| GATE-06-AC-03 | NOT TESTED | — |
| GATE-06-AC-04 | NOT TESTED | — |
| GATE-06-AC-05 | NOT TESTED | — |
| GATE-06-AC-06 | NOT TESTED | — |
| GATE-06-AC-07 | NOT TESTED | — |
| GATE-06-AC-08 | NOT TESTED | — |
| GATE-06-AC-09 | NOT TESTED | — |

---

## Final Decision

**Gate status:** OPEN  

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | PENDING | — | — |
| Gate PASS approved | PENDING | — | — |
