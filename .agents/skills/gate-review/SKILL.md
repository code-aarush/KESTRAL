---
name: gate-review
description: >-
  Use this skill when independently reviewing a completed KESTREL gate implementation.
  Guides the agent through reading criteria first, independently inspecting the diff,
  running tests, and returning a criterion-by-criterion verdict. Never trust the developer
  report without independent verification. Activate when the user says "review Gate NN"
  or the Orchestrator requests an independent review.
---

# Gate Review Skill

This skill defines the complete independent review procedure for a KESTREL gate.
The Tester must follow every step. Do not modify source files during review.

---

## Step 1 — Read Criteria Before Examining Developer Work

1. Read the gate specification (`docs/gates/GATE-NN.md`) and extract every acceptance criterion
   with its ID. This is the review standard — not the developer's interpretation.
2. Read the relevant ADRs referenced in the gate specification.
3. Read the rules: `minimal-code.md`, `gate-discipline.md`, `cpp-standards.md`.
4. Note what observable properties each criterion requires.

Do NOT read the developer's report or diff first. Establish the standard independently.

## Step 2 — Inspect the Diff

1. Review all files changed since the prior gate or since the known baseline.
2. For each changed file, check:
   - Is this change required by the approved plan and gate criteria?
   - Does it contain unnecessary additions (fails MNI check)?
   - Does it contain any scope creep (implementation from future gates)?
   - Does it contain unrelated refactoring or incidental changes?
3. Flag any unexpected additions as scope violations.

## Step 3 — Inspect Test Coverage

1. Read every test file added or modified.
2. For each acceptance criterion, identify which test(s) verify it.
3. If a criterion has no corresponding test, note it as NOT TESTED.
4. Assess whether each test actually verifies the criterion (not just runs without crashing).
5. Check that edge cases are covered: empty inputs, single elements, max capacity,
   boundary-touching geometries, degenerate cases, invalid inputs.

## Step 4 — Execute Tests Independently

1. Run the test commands listed in the gate specification (not the developer's commands).
   Use the exact commands from the gate document.
2. If the commands differ from what the developer used, note the discrepancy.
3. Record the actual, complete output.
4. If tests cannot be run (environment issue), document exactly why and mark affected
   criteria as NOT TESTED.

## Step 5 — Verify Algorithmic Correctness

For each gate, verify the specific invariants listed in the gate specification:

- **Geometry (Gate 01):** Check that operations on degenerate and boundary inputs produce
  documented results. Verify that union/intersection semantics are consistent.
- **Entity Store (Gate 02):** Check ID uniqueness invariant, update semantics.
- **R-tree Structure (Gate 03):** Check MBR correctness, occupancy bounds, parent links.
- **Insertion/Splitting (Gate 04):** Verify tree invariants hold after multiple insertions.
- **Range Queries (Gate 05):** Run R-tree queries and ensure robust correctness tests.
  Any discrepancy is a FAIL.
- **Deletion (Gate 06):** Verify no stale entries, correct underflow handling.
- **Simulation (Gate 07):** Verify determinism with fixed seeds.
- **Mission Queries (Gate 08):** Verify broad/narrow phase separation, explicit verification.
- **Benchmarks (Gate 09):** Verify raw output files exist and are reproducible.

## Step 6 — Assess Unnecessary Complexity

1. Identify any classes, functions, or files that fail the MNI five-question check.
2. Report these as scope violations even if they do not cause test failures.
3. Do not approve a gate that contains unrequested additions.

## Step 7 — Check Regressions

1. Run any tests from prior gates that are still applicable.
2. Confirm that existing functionality is not broken by the new changes.
3. Report any regression as FAIL on the affected criterion.

## Step 8 — Produce the Review Report

Output a structured report containing:

### 8a. Diff Assessment
- Files reviewed.
- Unexpected additions or scope violations (if any).

### 8b. Test Execution Results
- Commands run.
- Actual output (complete).
- Whether tests could be run independently.

### 8c. Criterion Verdicts
For each acceptance criterion:

| Criterion ID | Status | Evidence |
|-------------|--------|---------|
| GATE-NN-AC-01 | PASS / FAIL / NOT TESTED | One-sentence description of evidence |

### 8d. Algorithmic Correctness
- Invariants verified or not.
### 8e. Required Corrections
For each FAIL criterion: a precise, actionable correction instruction.

### 8f. Overall Recommendation
- `PASS` — all criteria PASS, no scope violations, regressions clear.
- `FAIL` — one or more criteria FAIL; corrections required.
- `BLOCKED` — criteria cannot be tested; reason documented.

Note: This is a recommendation. Only the project owner can approve the gate.

## Step 9 — Stop

Do not modify source files.
Do not approve the gate.
Submit the review report to the Orchestrator.
