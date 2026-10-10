# GATE-04 — Insertion and Splitting

**Gate ID:** GATE-04  
**Status:** OPEN  
**Created:** 2026-10-09  
**Last updated:** 2026-10-09  

---

## Purpose

Implement R-tree insertion with subtree selection (least enlargement), leaf-level entry
addition, quadratic node splitting (including root splitting and upward MBR propagation).
Verify that structural invariants hold after multiple insertions including those that
trigger splits.

---

## Prerequisites

| Prerequisite | Gate | Status |
|-------------|------|--------|
| R-tree structural foundation | GATE-03 | OPEN |
| ADR-001 accepted (quadratic split confirmed) | ADR-001 | Proposed |

---

## Scope

### Included
- `insert(BoundingBox, entity_id)` on the R-tree.
- Subtree selection: ChooseLeaf algorithm (least enlargement, ties broken by area).
- Node splitting: QuadraticSplit seed selection and entry assignment.
- Upward MBR propagation (AdjustTree).
- Root splitting: height increase, new root creation.
- `validate_structure()` invoked after each test operation to confirm invariants.

### Excluded
- Deletion (Gate 06).
- Range queries (Gate 05) — except as a correctness check via validate_structure.
- R*-tree forced reinsertion.
- Bulk loading.

---

## Relevant Architecture Decisions

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | R-tree variant (quadratic split) | Proposed |
| ADR-002 | Geometry model | Proposed |

---

## Planned Implementation Files

| File | Action |
|------|--------|
| `src/rtree.cpp` | Update (add insert, choose_leaf, split, adjust_tree) |
| `tests/test_rtree_insert.cpp` | Create |

---

## Acceptance Criteria

### GATE-04-AC-01 — Single insertion into an empty tree succeeds

**Requirement:** After inserting one entry, the tree has 1 entry, height 1 (leaf root),
and passes `validate_structure()`.  
**Verification:** Insert one entry; check size, height, validate_structure().  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-04-AC-02 — Multiple insertions without splits maintain invariants

**Requirement:** Inserting up to `M` entries (no split needed) results in a tree with
correct entry count, correct MBRs, and passes `validate_structure()`.  
**Verification:** Insert M entries; validate_structure() passes; root MBR equals union of all.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-04-AC-03 — Overflow triggers a split and root adjustment

**Requirement:** Inserting `M+1` entries triggers exactly one node split. The resulting tree
has two leaf nodes and a new internal root. All entries are present. `validate_structure()` passes.  
**Verification:** Insert M+1 entries; check height=2; check entry count=M+1; validate_structure().  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-04-AC-04 — Quadratic split distributes entries into two valid groups

**Requirement:** After a split, each of the two resulting nodes has between `m` and `M` entries.
The union of both groups equals the union of all pre-split entries.  
**Verification:** After a split, inspect both nodes' entry counts and MBRs.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-04-AC-05 — MBRs are correct after all insertions

**Requirement:** After any sequence of insertions, every internal node's MBR equals the exact
union of its children's bounding boxes.  
**Verification:** `validate_structure()` checks this. Also spot-check the root MBR against the
union of all inserted entry bounding boxes.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-04-AC-06 — Parent links are correct after splits

**Requirement:** After any insertion or split, every non-root node's parent pointer refers
to the correct parent node.  
**Verification:** `validate_structure()` traverses the tree and verifies parent links.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-04-AC-07 — Deterministic edge cases produce consistent results

**Requirement:** Inserting the same set of entries in the same order produces the same
tree structure on every run (no randomness in the quadratic split).  
**Verification:** Run insertion sequence twice; compare tree structure (height, node count,
entry distribution).  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-04-AC-08 — Compilation succeeds with required flags

**Requirement:** All Gate-04 files compile without errors or warnings using
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
| GATE-04-AC-01 | NOT TESTED | — |
| GATE-04-AC-02 | NOT TESTED | — |
| GATE-04-AC-03 | NOT TESTED | — |
| GATE-04-AC-04 | NOT TESTED | — |
| GATE-04-AC-05 | NOT TESTED | — |
| GATE-04-AC-06 | NOT TESTED | — |
| GATE-04-AC-07 | NOT TESTED | — |
| GATE-04-AC-08 | NOT TESTED | — |

---

## Final Decision

**Gate status:** OPEN  

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | PENDING | — | — |
| Gate PASS approved | PENDING | — | — |
