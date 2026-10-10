# GATE-08 — Mission Queries and Hazard Assessment

**Gate ID:** GATE-08  
**Status:** OPEN  
**Created:** 2026-10-09  
**Last updated:** 2026-10-09  

---

## Purpose

Implement application-level mission queries — region scans, nearby-object retrieval,
trajectory-corridor queries — using the R-tree as a broad-phase filter and a separate
narrow-phase geometry check for precise classification. Verify all query types against
a brute-force oracle. Introduce the `kestrel_demo` executable.

---

## Prerequisites

| Prerequisite | Gate | Status |
|-------------|------|--------|
| Kepler Belt simulation | GATE-07 | OPEN |

---

## Scope

### Included
- Region scan: entities whose bounds overlap a query region.
- Nearby-object retrieval: entities within a specified distance threshold
  (broad phase: expanded bounding box; narrow phase: exact distance check).
- Trajectory-corridor query: entities that may intersect a trajectory corridor
  (broad phase: corridor AABB; narrow phase: exact corridor geometry check).
- Hazard assessment: classify query results as hazard / no hazard per narrow-phase outcome.
- Brute-force oracle for all three query types.
- Oracle comparison: R-tree + narrow phase must match oracle on the same input.
- `src/main.cpp` as `kestrel_demo`: runs a brief simulation and demonstrates each query type.

### Excluded
- Visualization (Gate 10).
- Performance measurement (Gate 09).
- Queries not listed above (e.g., nearest-neighbour, convex hull).

---

## Relevant Architecture Decisions

| ADR | Title | Status |
|-----|-------|--------|
| ADR-002 | Geometry model | Proposed |

---

## Planned Implementation Files

| File | Action |
|------|--------|
| `src/mission.h` | Create |
| `src/mission.cpp` | Create |
| `src/main.cpp` | Create (kestrel_demo) |
| `tests/test_mission.cpp` | Create |

---

## Acceptance Criteria

### GATE-08-AC-01 — Region scan matches brute-force oracle

**Requirement:** For any query region, the region scan (R-tree broad phase + no narrow phase)
returns exactly the entities whose bounds intersect the region. Results match oracle.  
**Verification:** Run on 10+ query regions on a simulated dataset; compare with oracle; zero discrepancies.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-08-AC-02 — Nearby-object retrieval uses broad+narrow phase

**Requirement:** The nearby query performs: (1) R-tree search on an expanded query box,
(2) exact distance check per candidate. The final result contains only entities within the
specified distance. Entities just outside the distance are excluded.  
**Verification:** Construct cases with entities exactly at the distance boundary; verify
they are correctly included or excluded by the narrow-phase check.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-08-AC-03 — Trajectory-corridor query uses broad+narrow phase

**Requirement:** The corridor query performs: (1) R-tree search on corridor AABB,
(2) narrow-phase geometry check against the actual corridor shape. Entities touching only the
AABB but not the corridor are excluded from the final result.  
**Verification:** Construct entities in the AABB but outside the corridor; verify exclusion.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-08-AC-04 — Hazard assessment uses the narrow phase exclusively

**Requirement:** An entity is classified as a hazard only if it passes the narrow-phase
geometry check. The R-tree provides candidates only; no hazard decision is made in the R-tree.  
**Verification:** Code review confirms R-tree returns candidates only. Test with false-positive
candidates that pass broad phase but fail narrow phase; verify they are NOT classified as hazards.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-08-AC-05 — All query types match brute-force oracle

**Requirement:** For all three query types, the R-tree pipeline (broad + narrow) produces
the same final result as the brute-force oracle on at least 20 test cases per type.
No false positives or false negatives compared to the oracle.  
**Verification:** Run oracle comparison tests; record all discrepancies.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-08-AC-06 — kestrel_demo compiles and runs without error

**Requirement:** `src/main.cpp` compiles into `kestrel_demo` and runs without crashing,
demonstrating at least one of each query type on a simulated dataset.  
**Verification:** Build `kestrel_demo`; run it; confirm it completes and produces output.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-08-AC-07 — Compilation succeeds with required flags

**Requirement:** All Gate-08 files compile without errors or warnings.  
**Verification:** Compile command output; zero warnings.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

## Actual Evidence and Test Results

*To be populated after implementation.*

---

## Independent Reviewer Findings

| Criterion | Reviewer Status | Evidence |
|-----------|----------------|---------|
| GATE-08-AC-01 | NOT TESTED | — |
| GATE-08-AC-02 | NOT TESTED | — |
| GATE-08-AC-03 | NOT TESTED | — |
| GATE-08-AC-04 | NOT TESTED | — |
| GATE-08-AC-05 | NOT TESTED | — |
| GATE-08-AC-06 | NOT TESTED | — |
| GATE-08-AC-07 | NOT TESTED | — |

---

## Final Decision

**Gate status:** OPEN  

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | PENDING | — | — |
| Gate PASS approved | PENDING | — | — |
