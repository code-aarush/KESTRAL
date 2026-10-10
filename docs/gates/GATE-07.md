# GATE-07 — Kepler Belt Simulation

**Gate ID:** GATE-07  
**Status:** OPEN  
**Created:** 2026-10-09  
**Last updated:** 2026-10-09  

---

## Purpose

Introduce a deterministic, seeded simulation of Kepler Belt entities (asteroids, probes, etc.)
with entity movement, appearance, and disappearance over simulation steps. Integrate the
entity store and R-tree so they remain consistent through the simulation. The physics
must be deliberately simple and documented — not realistic.

---

## Prerequisites

| Prerequisite | Gate | Status |
|-------------|------|--------|
| Deletion and dynamic updates | GATE-06 | OPEN |
| ADR-003 accepted (consistency invariant confirmed) | ADR-003 | Proposed |

---

## Scope

### Included
- `Simulator` class with seeded random-number generation and configurable parameters.
- Entity generation: random positions and bounding boxes within documented simulation bounds.
- Entity movement: simple documented trajectory (e.g., linear motion per step).
- Entity appearance: new entities added at each step (configurable rate).
- Entity disappearance: entities removed at each step (configurable rate).
- Integration with EntityStore and RTree: every appearance/disappearance/movement updates both.
- Consistency verification: after every simulation step, validate that every entity in the store
  has a corresponding R-tree entry (partial consistency check).
- Determinism: same seed produces same event sequence.

### Excluded
- Realistic orbital mechanics or physics.
- Mission query logic (Gate 08).
- Visualization (Gate 10).
- Performance benchmarking (Gate 09).

---

## Relevant Architecture Decisions

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | R-tree variant | Proposed |
| ADR-002 | Geometry model | Proposed |
| ADR-003 | Entity storage and indexing | Proposed |

---

## Planned Implementation Files

| File | Action |
|------|--------|
| `src/simulator.h` | Create |
| `src/simulator.cpp` | Create |
| `tests/test_simulator.cpp` | Create |

---

## Acceptance Criteria

### GATE-07-AC-01 — Simulation produces deterministic results with fixed seed

**Requirement:** Two simulation runs with the same seed and parameters produce identical
entity event sequences and identical entity populations at each step.  
**Verification:** Run simulation 100 steps twice with the same seed; compare entity store
states at steps 10, 50, and 100.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-07-AC-02 — Entity store and R-tree remain consistent after each step

**Requirement:** After every simulation step, every entity ID in the entity store has
exactly one corresponding R-tree entry with the correct bounding box. No stale entries exist.  
**Verification:** After each of 50 simulation steps, iterate the entity store and verify
each entity's bounds are findable in the R-tree via search. Check entity store size matches
R-tree entry count.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-07-AC-03 — Entity movement updates both the store and the index

**Requirement:** When an entity moves, the entity store record is updated with the new
bounding box, the old R-tree entry is removed, and a new R-tree entry with the new
bounding box is inserted.  
**Verification:** Track a specific entity through movement; verify its bounds in the store
and R-tree match at each step.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-07-AC-04 — Entity appearance and disappearance are handled correctly

**Requirement:** When a new entity appears, it is added to both the store and R-tree.
When an entity disappears, it is removed from both. No orphaned or stale entries remain.  
**Verification:** Confirm entity count in store equals R-tree entry count after a step
that includes both appearances and disappearances.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-07-AC-05 — Simulation physics are documented

**Requirement:** The movement model (e.g., linear velocity per step, random walk, fixed orbit)
is documented in comments in `simulator.h` or a doc section. The documentation is clear enough
that an examiner can understand and evaluate it.  
**Verification:** Read the simulator header and confirm the physics model is documented.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-07-AC-06 — Compilation succeeds with required flags

**Requirement:** All Gate-07 files compile without errors or warnings.  
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
| GATE-07-AC-01 | NOT TESTED | — |
| GATE-07-AC-02 | NOT TESTED | — |
| GATE-07-AC-03 | NOT TESTED | — |
| GATE-07-AC-04 | NOT TESTED | — |
| GATE-07-AC-05 | NOT TESTED | — |
| GATE-07-AC-06 | NOT TESTED | — |

---

## Final Decision

**Gate status:** OPEN  

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | PENDING | — | — |
| Gate PASS approved | PENDING | — | — |
