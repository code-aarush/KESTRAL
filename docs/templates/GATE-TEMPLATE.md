# GATE-NN — [Gate Title]

**Gate ID:** GATE-NN
**Status:** OPEN
**Created:** YYYY-MM-DD
**Last updated:** YYYY-MM-DD

---

## Purpose

One paragraph describing what this gate establishes, why it is needed in this position
in the gate sequence, and what research or engineering objective it advances.

---

## Prerequisites

| Prerequisite | Gate | Status |
|-------------|------|--------|
| [Required prior gate] | GATE-XX | OPEN / PASS |

This gate must not begin implementation until all prerequisites are PASS.

---

## Scope

### Included in this gate
- Bullet list of what this gate explicitly covers.

### Excluded from this gate (do not implement here)
- Bullet list of what this gate explicitly defers or excludes.

---

## Relevant Architecture Decisions

| ADR | Title | Status |
|-----|-------|--------|
| ADR-00N | [Title] | Proposed / Accepted |

If any referenced ADR is still Proposed, owner acceptance is required before
implementation of the criteria that depend on it.

---

## Planned Implementation Files

| File | Action | Purpose |
|------|--------|---------|
| `src/example.h` | Create | [Reason] |
| `tests/test_example.cpp` | Create | [Reason] |

---

## Required Test Commands

```bash
# Example using direct g++ (before CMake is available):
g++ -std=c++17 -Wall -Wextra -o test_example tests/test_example.cpp src/example.cpp
./test_example

# Example using CMake (when available):
cmake -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Debug
cmake --build build
cd build && ctest --output-on-failure
```

---

## Acceptance Criteria

Each criterion must have a stable ID. Do not change IDs after gate planning begins.

### GATE-NN-AC-01 — [Criterion title]

**Requirement:** One sentence describing what must be true.
**Verification:** How to verify it: exact command, output property, or observable behaviour.
**Status:** NOT TESTED
**Evidence:** [To be populated during/after implementation]

---

### GATE-NN-AC-02 — [Criterion title]

**Requirement:** ...
**Verification:** ...
**Status:** NOT TESTED
**Evidence:** [To be populated]

---

### GATE-NN-AC-03 — [Criterion title]

**Requirement:** ...
**Verification:** ...
**Status:** NOT TESTED
**Evidence:** [To be populated]

---

*(Add additional criteria as needed. Each must be independently verifiable.)*

---

## Actual Evidence and Test Results

*Populated by the Developer after implementation.*

```
[Paste actual test output here. Do not paraphrase.]
```

---

## Independent Reviewer Findings

*Populated by the Tester after independent review.*

| Criterion | Reviewer Status | Reviewer Evidence |
|-----------|----------------|-----------------|
| GATE-NN-AC-01 | NOT TESTED | — |
| GATE-NN-AC-02 | NOT TESTED | — |
| GATE-NN-AC-03 | NOT TESTED | — |

**Reviewer notes:**

[Scope violations, unexpected additions, regression findings, etc.]

---

## Outstanding Defects and Risks

| ID | Description | Severity | Status |
|----|-------------|---------|--------|
| — | None identified | — | — |

---

## Final Decision

**Gate status:** OPEN
**Authorised next step:** [Describe what happens next — e.g., "Plan Gate NN+1 only after owner approval."]

---

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | PENDING | — | — |
| Gate PASS approved | PENDING | — | — |
