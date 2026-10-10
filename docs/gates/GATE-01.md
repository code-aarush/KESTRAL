# GATE-01 — Geometry Primitives

**Gate ID:** GATE-01  
**Status:** PASS  
**Created:** 2026-10-09  
**Last updated:** 2026-10-10  

---

## Purpose

Implement the fundamental 2D geometric types (`Point` and `BoundingBox`) and the minimum
required set of geometric operations. Establish and test the boundary semantics that all
subsequent components depend on. No spatial index or entity logic is introduced here.

---

## Prerequisites

| Prerequisite | Gate | Status |
|-------------|------|--------|
| Repository setup | GATE-00 | PASS |
| ADR-002 accepted by owner | ADR-002 | Accepted |
| Build system decision resolved | OD-001 | Resolved (CMake 4.4.0) |

---

## Scope

### Included
- `struct Point` with `double x, y`.
- `struct BoundingBox` with `double min_x, min_y, max_x, max_y`.
- Operations: `is_valid`, `area`, `union_of`, `intersects`, `contains`, `enlargement`.
- Documented NaN/infinity policy.
- Tests for all operations including boundary-touching, disjoint, containment,
  zero-area, and invalid inputs.

### Excluded
- Any entity, R-tree, or simulation code.
- Nearest-neighbour computations.
- 3D geometry.
- Geometry operations not required by any Gate-01 criterion.

---

## Relevant Architecture Decisions

| ADR | Title | Status |
|-----|-------|--------|
| ADR-002 | Geometry model | Accepted (Closed boundary semantics confirmed) |

---

## Planned Implementation Files

| File | Action |
|------|--------|
| `src/geometry.h` | Create |
| `src/geometry.cpp` | Create |
| `tests/test_geometry.cpp` | Create |
| `CMakeLists.txt` | Update (enable src/tests, add geometry target) |

---

## Required Test Commands

*(Exact commands to be confirmed when OD-001 build decision is resolved.)*

**Direct g++ (available now):**
```bash
g++ -std=c++17 -Wall -Wextra -Wpedantic -o test_geometry tests/test_geometry.cpp src/geometry.cpp
./test_geometry
```

**CMake (when CMake is installed):**
```bash
cmake -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Debug
cmake --build build
cd build && ctest --output-on-failure
```

---

## Acceptance Criteria

### GATE-01-AC-01 — Point struct is defined

**Requirement:** `kestrel::Point` has `double x` and `double y` members. It is in `src/geometry.h`.  
**Verification:** Read `geometry.h`; confirm struct definition in `kestrel` namespace.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-01-AC-02 — BoundingBox struct is defined with correct validity semantics

**Requirement:** `kestrel::BoundingBox` has `double min_x, min_y, max_x, max_y`. `is_valid`
returns true iff `min_x <= max_x`, `min_y <= max_y`, and all coordinates are finite.
Degenerate (zero-area) boxes with `min_x == max_x` or `min_y == max_y` are valid.  
**Verification:** Run tests: valid box returns true; box with `min_x > max_x` returns false;
point box (min==max on both axes) returns true; box with NaN coordinate returns false.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-01-AC-03 — area is correct for rectangular and degenerate boxes

**Requirement:** `area(b) == (b.max_x - b.min_x) * (b.max_y - b.min_y)`. Returns 0.0
for a zero-area (degenerate) box.  
**Verification:** Test with a unit square (area=1.0), a non-square rectangle, and a
degenerate box (area=0.0).  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-01-AC-04 — union_of is the correct MBR of two boxes

**Requirement:** `union_of(a, b)` returns the smallest AABB containing both `a` and `b`.
`union_of(a, a) == a`. `union_of` of disjoint boxes contains both.  
**Verification:** Test: two disjoint boxes, two overlapping boxes, a box with itself.
Check all four coordinates of the result.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-01-AC-05 — intersects has documented boundary semantics and correct results

**Requirement:** `intersects(a, b)` implements the boundary semantics documented in ADR-002
(proposed: closed/inclusive). Boxes sharing only an edge or corner return true (if inclusive
semantics are accepted). Disjoint boxes return false.  
**Verification:** Test: overlapping, disjoint, edge-touching (shared left/right edge),
corner-touching, one containing the other, one is a point-box touching the other's boundary.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-01-AC-06 — contains is correct for all cases

**Requirement:** `contains(outer, inner)` returns true iff `inner` is fully within `outer`
(inclusive boundaries as per ADR-002 proposed semantics). A box contains itself.  
**Verification:** Test: outer strictly contains inner; identical boxes (self-containment);
inner extends beyond outer on one side; touching boundary (contained); touching boundary
(not contained — inner is larger).  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-01-AC-07 — enlargement is correct

**Requirement:** `enlargement(base, to_add) == area(union_of(base, to_add)) - area(base)`.
Returns 0.0 when `to_add` is already contained in `base`.  
**Verification:** Test with: `to_add` fully inside `base` (enlargement=0); `to_add` disjoint
from `base` (enlargement = positive value); verify against manual calculation.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-01-AC-08 — NaN and infinity policy is documented and tested

**Requirement:** The behaviour of all geometry operations with NaN or infinite coordinate
values is documented in a code comment or `geometry.h` header comment. At minimum,
`is_valid` returns false for NaN or infinite inputs.  
**Verification:** Test `is_valid` with NaN and infinity inputs; confirm false. Read the
documented policy in the header.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-01-AC-09 — All geometry code is in the kestrel namespace

**Requirement:** All types and functions from Gate-01 are in the `kestrel` namespace.
No global namespace pollution.  
**Verification:** Read `geometry.h`; confirm `namespace kestrel { ... }` wrapper.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-01-AC-10 — Compilation succeeds with required flags

**Requirement:** `src/geometry.cpp` and `tests/test_geometry.cpp` compile without errors
or warnings using `g++ -std=c++17 -Wall -Wextra -Wpedantic`.  
**Verification:** Run the compile command; record exact output. Zero warnings expected.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

## Actual Evidence and Test Results

**Implementation Summary:**
- Created `src/geometry.h` and `src/geometry.cpp` containing `Point` and `BoundingBox` types and associated operations (`is_valid`, `area`, `union_of`, `intersects`, `contains`, `enlargement`).
- All code wrapped in `namespace kestrel`.
- NaN and infinity policy documented in `geometry.h` and enforced in `is_valid`.
- Created `tests/test_geometry.cpp` validating all behaviors, including closed boundary semantics as per ADR-002.
- Updated root `CMakeLists.txt` and created subdirectory `CMakeLists.txt`s to build `kestrel_geometry` static library and `test_geometry` executable.
- Built without warnings and passed all tests.

**Test Execution:**
```
Test project D:/Aarush/Career/Projects/My-Projects/KESTREL/build
    Start 1: test_geometry
1/1 Test #1: test_geometry ....................   Passed    0.02 sec
100% tests passed out of 1
```

---

## Independent Reviewer Findings

| Criterion | Reviewer Status | Evidence |
|-----------|----------------|---------|
| GATE-01-AC-01 | PASS | `Point` struct defined in `src/geometry.h` under `namespace kestrel` with `double x, y`. |
| GATE-01-AC-02 | PASS | `BoundingBox` and `is_valid` implemented; tests confirm correct handling of degenerate, inverted, and NaN/inf inputs. |
| GATE-01-AC-03 | PASS | `area` correctly calculates for standard and zero-area boxes; tests passed. |
| GATE-01-AC-04 | PASS | `union_of` computes MBR correctly for overlapping, disjoint, and identical boxes; tests passed. |
| GATE-01-AC-05 | PASS | `intersects` enforces closed/inclusive semantics; tests confirm touching edges/corners return true. |
| GATE-01-AC-06 | PASS | `contains` correctly evaluates self-containment and boundary-touching limits; tests passed. |
| GATE-01-AC-07 | PASS | `enlargement` computes correct area diff, returning 0.0 for contained additions; tests passed. |
| GATE-01-AC-08 | PASS | NaN/infinity policy documented in `src/geometry.h`; tests confirm `is_valid` rejects non-finite values. |
| GATE-01-AC-09 | PASS | Namespace `kestrel` wraps all code in `src/geometry.h` and `src/geometry.cpp`. |
| GATE-01-AC-10 | PASS | Compilation succeeds with `-Wall -Wextra -Wpedantic` without warnings; CTest reports 100% success. |

---

## Outstanding Defects and Risks

| ID | Description | Severity | Status |
|----|-------------|---------|--------|
| OD-001 | CMake 4.4.0 installed and verified | Low | Resolved |
| OD-ADR002 | ADR-002 closed boundary semantics confirmed and accepted | Low | Resolved |

---

## Final Decision

**Gate status:** PASS  
**Authorised next step:** Owner reviews Gate-01 implementation and approves transition to GATE-02.

---

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | OD-006 | 2026-10-10 | Explicitly authorized in task prompt. |
| Gate PASS approved | PENDING | — | Implementation completed; awaiting review. |
