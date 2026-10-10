# GATE-05 — Range Queries and Pruning

**Gate ID:** GATE-05  
**Status:** OPEN  
**Created:** 2026-10-09  
**Last updated:** 2026-10-09  

---

## Purpose

Implement range search on the R-tree with MBR-based subtree pruning. Verify correctness
against a brute-force oracle. Track useful query metrics. This is the first gate to
require differential testing against the oracle.

---

## Prerequisites

| Prerequisite | Gate | Status |
|-------------|------|--------|
| Insertion and splitting | GATE-04 | OPEN |

---

## Scope

### Included
- `search(BoundingBox query)` returning a list of entity IDs whose bounding boxes
  intersect the query box.
- MBR-based subtree pruning (do not descend into subtrees whose MBR does not intersect query).
- Query metrics: nodes visited, leaf entries examined (internal counter, not a performance target).
- Brute-force oracle: linear scan over all inserted entries returning those that intersect query.
- Differential testing: R-tree results vs oracle results for multiple datasets.

### Excluded
- Nearest-neighbour queries.
- Trajectory-corridor queries (Gate 08).
- Any entity store integration (test directly with `(BoundingBox, entity_id)` pairs).
- Deletion or update (Gate 06).

---

## Relevant Architecture Decisions

| ADR | Title | Status |
|-----|-------|--------|
| ADR-002 | Geometry model and boundary semantics | Proposed |

---

## Planned Implementation Files

| File | Action |
|------|--------|
| `src/rtree.cpp` | Update (add search) |
| `tests/test_rtree_query.cpp` | Create |

---

## Acceptance Criteria

### GATE-05-AC-01 — Empty-tree query returns empty result

**Requirement:** `search(any_box)` on an empty tree returns an empty list.  
**Verification:** Construct empty tree; call search; confirm empty result.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-05-AC-02 — Query returns all matching entries

**Requirement:** For any query box, `search` returns exactly the entries whose bounding
boxes intersect the query box (per ADR-002 boundary semantics). No false negatives.  
**Verification:** Compare against brute-force oracle on a deterministic dataset of 20 entries
with 5 different query boxes including boundary-touching cases.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-05-AC-03 — Query returns no false positives

**Requirement:** `search` returns no entity IDs whose bounding boxes do not intersect the
query box.  
**Verification:** Oracle comparison on the same test cases as AC-02. Any ID in R-tree result
not in oracle result is a false positive.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-05-AC-04 — No duplicate IDs in query result

**Requirement:** `search` never returns the same entity ID more than once for a single query.  
**Verification:** Check result list for duplicates on all test datasets.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-05-AC-05 — Query on boundary-touching boxes is correct

**Requirement:** A query box that shares only an edge or corner with an entry's bounding
box returns that entry (per ADR-002 closed boundary semantics).
A query box that does not touch any entry returns an empty result.  
**Verification:** Construct specific boundary-touching cases; verify against oracle.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-05-AC-06 — Oracle comparison passes on randomised seeded dataset

**Requirement:** On a dataset of at least 100 entries with positions generated using a
fixed seed, the R-tree search and the brute-force oracle return identical results for
at least 20 different randomly generated query boxes. No discrepancy is tolerated.  
**Verification:** Run the seeded test; output oracle vs R-tree result comparison; zero discrepancies.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-05-AC-07 — Nodes visited metric is recorded

**Requirement:** The search function tracks the number of nodes visited. This value is
accessible and non-zero for any non-empty tree query that touches at least one node.  
**Verification:** After a successful query, confirm the nodes-visited counter is > 0 and
plausible relative to tree height.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-05-AC-08 — Compilation succeeds with required flags

**Requirement:** All Gate-05 files compile without errors or warnings using
`g++ -std=c++17 -Wall -Wextra -Wpedantic`.  
**Verification:** Compile output; zero warnings expected.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

## Actual Evidence and Test Results

*To be populated after implementation.*

---

## Independent Reviewer Findings

| Criterion | Reviewer Status | Evidence |
|-----------|----------------|---------|
| GATE-05-AC-01 | NOT TESTED | — |
| GATE-05-AC-02 | NOT TESTED | — |
| GATE-05-AC-03 | NOT TESTED | — |
| GATE-05-AC-04 | NOT TESTED | — |
| GATE-05-AC-05 | NOT TESTED | — |
| GATE-05-AC-06 | NOT TESTED | — |
| GATE-05-AC-07 | NOT TESTED | — |
| GATE-05-AC-08 | NOT TESTED | — |

---

## Final Decision

**Gate status:** OPEN  

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | PENDING | — | — |
| Gate PASS approved | PENDING | — | — |
