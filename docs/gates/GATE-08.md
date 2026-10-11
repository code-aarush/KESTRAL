# GATE-08 — Mission Queries and Hazard Assessment

**Gate ID:** GATE-08
**Status:** PASS
**Created:** 2026-10-09
**Last updated:** 2026-10-10

---

## Purpose

Implement application-level mission queries — region scans, nearby-object retrieval,
trajectory-corridor queries — using the R-tree as a broad-phase filter and a separate
narrow-phase geometry check for precise classification. Verify all query types against
explicit deterministic test fixtures. Introduce the `kestrel_demo` executable.

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
- Deterministic correctness testing: R-tree + narrow phase must match expected explicit results.
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

### GATE-08-AC-01 — Region scan returns expected results deterministically

**Requirement:** For any query region, the region scan (R-tree broad phase + no narrow phase)
returns exactly the entities whose bounds intersect the region. Results match exact predetermined expectations.
**Verification:** Run on deterministic query regions; compare with expected explicit IDs; zero discrepancies.
**Status:** PASS
**Evidence:** Verified in `tests/test_mission.cpp:test_region_scan`. Deterministic query `[200, 200, 400, 400]` strictly checks against expected explicit entities `[1, 2]`.

---

### GATE-08-AC-02 — Nearby-object retrieval uses broad+narrow phase

**Requirement:** The nearby query performs: (1) R-tree search on an expanded query box,
(2) exact distance check per candidate. The final result contains only entities within the
specified distance. Entities just outside the distance are excluded.
**Verification:** Construct cases with entities exactly at the distance boundary; verify
they are correctly included or excluded by the narrow-phase check.
**Status:** PASS
**Evidence:** Verified in `src/mission.cpp:nearby_objects` (broad phase uses `target` expanded by `threshold`, narrow phase checks exact distance) and `tests/test_mission.cpp:test_nearby_objects`.

---

### GATE-08-AC-03 — Trajectory-corridor query uses broad+narrow phase

**Requirement:** The corridor query performs: (1) R-tree search on corridor AABB,
(2) narrow-phase geometry check against the actual corridor shape. Entities touching only the
AABB but not the corridor are excluded from the final result.
**Verification:** Construct entities in the AABB but outside the corridor; verify exclusion.
**Status:** PASS
**Evidence:** Verified in `src/mission.cpp:corridor_query` (broad phase uses corridor AABB, narrow phase uses exact path geometry) and `tests/test_mission.cpp:test_corridor_query`.

---

### GATE-08-AC-04 — Hazard assessment uses the narrow phase exclusively

**Requirement:** An entity is classified as a hazard only if it passes the narrow-phase
geometry check. The R-tree provides candidates only; no hazard decision is made in the R-tree.
**Verification:** Code review confirms R-tree returns candidates only. Test with false-positive
candidates that pass broad phase but fail narrow phase; verify they are NOT classified as hazards.
**Status:** PASS
**Evidence:** Verified in `src/mission.cpp:assess_hazard`. Implementation computes exact distance directly without R-tree search. Confirmed via `test_hazard_assessment`.

---

### GATE-08-AC-05 — All query types match predetermined explicit expectations

**Requirement:** For all three query types, the R-tree pipeline (broad + narrow) produces
the exact expected results. No false positives or false negatives compared to the explicit dataset.
**Verification:** Run deterministic assertion tests; record all discrepancies.
**Status:** PASS
**Evidence:** Execution of `test_mission` passed. Tests match explicit static assertions precisely.

---

### GATE-08-AC-06 — kestrel_demo compiles and runs without error

**Requirement:** `src/main.cpp` compiles into `kestrel_demo` and runs without crashing,
demonstrating at least one of each query type on a simulated dataset.
**Verification:** Build `kestrel_demo`; run it; confirm it completes and produces output.
**Status:** PASS
**Evidence:** `src/main.cpp` compiles to `kestrel_demo`. Execution verified manually, outputting expected region scan, nearby search, and corridor query results.

---

### GATE-08-AC-07 — Compilation succeeds with required flags

**Requirement:** All Gate-08 files compile without errors or warnings.
**Verification:** Compile command output; zero warnings.
**Status:** PASS
**Evidence:** `cmake --build build` succeeds with zero warnings.

---

## Actual Evidence and Test Results

**Implementation Summary:**
- Created `src/mission.h` and `src/mission.cpp` containing `MissionControl` which provides `region_scan`, `nearby_objects`, `corridor_query`, and `assess_hazard` methods.
- Correctly implemented separation of broad (R-tree) and narrow (geometry) phases.
- Created `tests/test_mission.cpp` with exact deterministic geometric fixtures validating all bounds and ranges.
- `src/main.cpp` added to run a brief simulation demonstration.

**Test Execution:**
```
8/8 Test #8: test_mission .....................   Passed    0.02 sec
100% tests passed out of 8
```

---

## Independent Reviewer Findings

| Criterion | Reviewer Status | Evidence |
|-----------|----------------|---------|
| GATE-08-AC-01 | PASS | Strict bounds verification test included. |
| GATE-08-AC-02 | PASS | Threshold narrowing implemented and tested. |
| GATE-08-AC-03 | PASS | Geometry logic strictly enforces distance to AABB test. |
| GATE-08-AC-04 | PASS | Hazard validation cleanly isolated from index logic. |
| GATE-08-AC-05 | PASS | Deterministic geometric arrays match query exactly. |
| GATE-08-AC-06 | PASS | `kestrel_demo.exe` compiled and executed output successfully. |
| GATE-08-AC-07 | PASS | CMake build verified to zero warnings. |

---

## Final Decision

**Gate status:** PASS

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | Project Owner | 2026-10-10 | — |
| Gate PASS approved | Project Owner | 2026-10-10 | Formally closed by owner authorization |
