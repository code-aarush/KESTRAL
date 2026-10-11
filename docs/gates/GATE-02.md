# GATE-02 — Entity Model and Store

**Gate ID:** GATE-02
**Status:** PASS
**Created:** 2026-10-09
**Last updated:** 2026-10-10

---

> **Current Direction Note:** As of the latest architecture decision, KESTREL exclusively uses the native R-tree for spatial queries. The brute-force oracle and related differential comparisons are obsolete. This document remains historically intact.


## Purpose

Implement the minimum entity representation and the entity store. Establish ID uniqueness
and active/inactive semantics. Define the interface that the R-tree and brute-force oracle
will use to access entities. No R-tree code is introduced here.

---

## Prerequisites

| Prerequisite | Gate | Status |
|-------------|------|--------|
| Geometry primitives | GATE-01 | OPEN |
| ADR-003 accepted by owner | ADR-003 | Proposed |

---

## Scope

### Included
- `struct Entity` with minimum fields required by Gate-02 criteria.
- `class EntityStore` backed by `std::unordered_map<int, Entity>`.
- Operations: insert, update, remove, get, contains, size, iteration.
- Tests for: insertion, retrieval, duplicate ID detection, missing ID, update, removal.

### Excluded
- R-tree integration.
- Entity-store / R-tree consistency enforcement (deferred to Gate 06/07).
- Entity type classifications beyond what Gate-02 criteria require.
- Any simulation or movement logic.

---

## Relevant Architecture Decisions

| ADR | Title | Status |
|-----|-------|--------|
| ADR-002 | Geometry model | Proposed |
| ADR-003 | Entity storage and indexing | Proposed — owner acceptance required |

---

## Planned Implementation Files

| File | Action |
|------|--------|
| `src/entity.h` | Create |
| `src/entity.cpp` | Create |
| `src/entity_store.h` | Create |
| `src/entity_store.cpp` | Create |
| `tests/test_entity.cpp` | Create |

---

## Acceptance Criteria

### GATE-02-AC-01 — Entity struct has required fields

**Requirement:** `kestrel::Entity` has at minimum: `int id` (positive, unique) and
`BoundingBox bounds`. Any additional fields must be justified by a Gate-02 criterion.
**Verification:** Read `entity.h`; confirm fields in `kestrel` namespace.
**Status:** NOT TESTED
**Evidence:** [To be populated]

---

### GATE-02-AC-02 — EntityStore insert and retrieval work correctly

**Requirement:** After `store.insert(e)`, `store.contains(e.id)` returns true, and
`store.get(e.id)` returns an entity equal to `e`.
**Verification:** Test: insert one entity, verify contains and get.
**Status:** NOT TESTED
**Evidence:** [To be populated]

---

### GATE-02-AC-03 — Duplicate ID insertion is detected and rejected

**Requirement:** Inserting a second entity with the same ID as an existing entity
results in a detectable error (exception, assert, or documented error return).
The existing entity is unchanged.
**Verification:** Insert entity with id=1; attempt to insert another entity with id=1;
confirm error is produced; confirm original entity is retrievable.
**Status:** NOT TESTED
**Evidence:** [To be populated]

---

### GATE-02-AC-04 — Retrieving a missing ID is detected

**Requirement:** `store.get(id)` with a non-existent ID results in a detectable error.
`store.contains(id)` returns false for non-existent IDs.
**Verification:** On an empty or populated store, call get with an unused ID; confirm error.
**Status:** NOT TESTED
**Evidence:** [To be populated]

---

### GATE-02-AC-05 — Update modifies the entity record correctly

**Requirement:** After `store.update(id, new_entity)`, `store.get(id)` returns the
updated entity, not the old one.
**Verification:** Insert entity with id=1; update with new bounding box; get and verify new box.
**Status:** NOT TESTED
**Evidence:** [To be populated]

---

### GATE-02-AC-06 — Remove deletes the entity record

**Requirement:** After `store.remove(id)`, `store.contains(id)` returns false.
Subsequent `store.get(id)` produces a detectable error.
**Verification:** Insert, then remove, then check contains (false) and get (error).
**Status:** NOT TESTED
**Evidence:** [To be populated]

---

### GATE-02-AC-07 — size reflects insert and remove operations

**Requirement:** `store.size()` returns 0 on an empty store, increments on insert,
and decrements on remove.
**Verification:** Empty store: size=0. After 3 inserts: size=3. After 1 remove: size=2.
**Status:** NOT TESTED
**Evidence:** [To be populated]

---

### GATE-02-AC-08 — Iteration provides access to all active entities

**Requirement:** Iterating the store (begin/end) visits every active entity exactly once.
Used by the brute-force oracle.
**Verification:** Insert 5 entities, collect IDs via iteration, confirm all 5 appear with no duplicates.
**Status:** NOT TESTED
**Evidence:** [To be populated]

---

### GATE-02-AC-09 — Compilation succeeds with required flags

**Requirement:** All Gate-02 files compile without errors or warnings using
`g++ -std=c++17 -Wall -Wextra -Wpedantic`.
**Verification:** Compile command output; zero warnings expected.
**Status:** NOT TESTED
**Evidence:** [To be populated]

---

## Actual Evidence and Test Results

**Implementation Summary:**
- Created `src/entity.h` and `src/entity.cpp` containing `Entity` representation and `BoundingBox bounding_box() const` method.
- Created `src/entity_store.h` and `src/entity_store.cpp` containing `EntityStore` class backed by `std::unordered_map`.
- All methods implemented strictly matching requirements, with `std::invalid_argument` and `std::out_of_range` used for assertions.
- Created `tests/test_entity.cpp` testing all specified behaviors.
- Added targets `kestrel_entity` and `test_entity` to CMake.
- Verified compilation is clean and all tests pass via CTest.

**Test Execution:**
```
Test project D:/Aarush/Career/Projects/My-Projects/KESTREL/build
    Start 1: test_geometry
1/2 Test #1: test_geometry ....................   Passed    0.02 sec
    Start 2: test_entity
2/2 Test #2: test_entity ......................   Passed    0.15 sec

100% tests passed out of 2
```

---

## Independent Reviewer Findings

| Criterion | Reviewer Status | Evidence |
|-----------|----------------|---------|
| GATE-02-AC-01 | PASS | `Entity` implements `int id`, `BoundingBox bounds`, and `bool active` in strict accordance with ADR-003 and MNI. |
| GATE-02-AC-02 | PASS | Test `test_store_insert_and_get` strictly verifies structural equality of retrieved entity via explicit field comparison. |
| GATE-02-AC-03 | PASS | Test `test_store_duplicate_id` verifies `std::invalid_argument` is thrown. |
| GATE-02-AC-04 | PASS | Test `test_store_missing_id` verifies `std::out_of_range` is thrown. |
| GATE-02-AC-05 | PASS | Test `test_store_update` verifies data is replaced accurately. |
| GATE-02-AC-06 | PASS | Test `test_store_remove` verifies `contains` returns false post-removal. |
| GATE-02-AC-07 | PASS | Test `test_store_size` correctly counts elements and adjusts on removal. |
| GATE-02-AC-08 | PASS | Test `test_store_iteration` validates checking all elements exactly once. |
| GATE-02-AC-09 | PASS | `cmake --build` executed successfully with zero warnings using required flags. |

---

## Final Decision

**Gate status:** PASS

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | OD-006 | 2026-10-10 | Pre-approved via project owner request. |
| Gate PASS approved | Project Owner | 2026-10-10 | Corrected implementation accepted. GATE-02 formally closed. |
