---
name: gate-plan
description: >-
  Use this skill when planning the implementation of a specific KESTREL gate.
  Guides the agent through reading all gate context, extracting acceptance criteria,
  identifying the minimum necessary implementation, and producing an actionable plan
  without modifying any source files. Invoke when the user asks to "plan Gate NN".
---

# Gate Plan Skill

This skill defines the complete procedure for planning a KESTREL gate.
The agent must follow every step in order. Do not skip steps. Do not edit source files.

---

## Step 1 — Read Project Context

1. Read `PROJECT_SSOT.md` and identify the active gate number, its status, and the
   current toolchain details (compiler, standard, build tool).
2. Confirm the gate is OPEN. If it is not OPEN, stop and report the current status.
3. Read `docs/architecture/ARCHITECTURE.md`.

## Step 2 — Read the Gate Specification

1. Open `docs/gates/GATE-NN.md` for the active gate.
2. Extract every acceptance criterion verbatim, with its criterion ID (e.g., `GATE-01-AC-03`).
3. Note the gate's prerequisites, dependencies, scope, and explicit exclusions.
4. Note the required test commands and expected observable properties.

## Step 3 — Read Relevant ADRs

1. Identify which ADRs are listed in the gate specification.
2. Read each referenced ADR from `docs/decisions/`.
3. Note any decisions that are still Proposed (not Accepted) — these may require owner
   approval before implementation proceeds.

## Step 4 — Examine Existing Code and Tests

1. List and read all existing files in `src/`, `tests/`, and `benchmarks/`.
2. Identify what already exists that the gate can build on.
3. Identify what must be added or modified to satisfy the acceptance criteria.
4. Note any existing test infrastructure.

## Step 5 — Apply the MNI Five-Question Check

For every proposed file, class, function, or addition:

1. Which explicit criterion requires this? (Cite the criterion ID.)
2. Can existing code be extended instead of adding something new?
3. Is there a simpler solution equally correct and maintainable?
4. What complexity does this introduce?
5. Can the student understand, explain, debug, and defend it?

Only proceed with items that pass all five questions.

## Step 6 — Produce the Implementation Plan

Output a structured plan containing:

### 6a. Criteria Summary
A table with each criterion ID, its one-line summary, and the proposed verification method.

### 6b. Files to Create or Modify
| File | Action | Justification (criterion IDs) |
|------|--------|-----------------------------|
| `src/geometry.cpp` | Create | GATE-01-AC-01, GATE-01-AC-02 |
| ... | ... | ... |

### 6c. Criterion-to-Test Mapping
For each criterion: the test file, test function name, what it checks, and the exact
test command (or the manual command if CMake is not yet available).

### 6d. Edge Cases and Invariants
List edge cases the tests must cover and structural invariants that must hold.

### 6e. Open Questions
List any ambiguity, missing decision, or ADR that is still Proposed and requires
owner approval before implementation. Do not resolve these by assumption.

### 6f. Test Commands
Specify exact commands or documented fallback commands (e.g., direct `g++` invocation).

## Step 7 — Stop

Do not modify any source file, test file, or documentation file.
Submit the plan to the Orchestrator for owner approval.
Implementation begins only after the owner explicitly approves the plan.
