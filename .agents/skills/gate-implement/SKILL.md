---
name: gate-implement
description: >-
  Use this skill when implementing an explicitly owner-approved plan for a KESTREL gate.
  Guides the agent through safe implementation, targeted testing, diff inspection, and
  evidence reporting. Never invoke this skill without explicit prior owner approval of the
  gate plan. Activate when the user says "implement Gate NN" or "implement the approved plan".
---

# Gate Implement Skill

This skill defines the complete procedure for implementing an approved KESTREL gate.
Follow every step in order. Do not skip steps. Do not begin the next gate.

---

## Step 1 — Confirm Approval and Read Context

1. Confirm that the owner has explicitly approved the implementation plan for the active gate.
   If not confirmed, stop and request approval.
2. Read `PROJECT_SSOT.md` to confirm the active gate and toolchain.
3. Read the gate specification (`docs/gates/GATE-NN.md`) and extract all acceptance criteria.
4. Read the relevant ADRs and rules (`minimal-code.md`, `gate-discipline.md`, `cpp-standards.md`).

## Step 2 — Verify the Working Tree

1. Inspect the current state of all relevant files.
2. Confirm there are no unrelated uncommitted changes that could be accidentally included.
3. Note what already exists in `src/`, `tests/`, and `benchmarks/`.

## Step 3 — Implement Approved Scope Only

1. Create or modify only the files listed in the approved plan.
2. For each addition, apply the MNI five-question check (see `minimal-code.md`).
3. Follow `cpp-standards.md`: C++17, `-Wall -Wextra -Wpedantic`, RAII, descriptive names,
   straightforward control flow, const-correctness, `kestrel` namespace.
4. Document non-obvious algorithms, invariants, and design decisions in comments.
5. Do not add anything not in the approved plan. If an additional item seems necessary,
   stop, document the need, and escalate to the owner before adding it.

## Step 4 — Add Targeted Tests

1. For every new function or behaviour, add at least one positive test and one failure/boundary test.
2. Tests must be deterministic. Use fixed seeds for randomised inputs.
3. Tests must be independent of visualization.
4. Tests must check values, not merely that execution does not crash.
5. Do not weaken or mock tests to produce a pass. Fix the implementation.

## Step 5 — Build and Run Tests

1. Compile using the verified toolchain command from the gate specification or plan.
   If CMake is available: `cmake -B build -G "MinGW Makefiles" && cmake --build build`.
   If CMake is not available: use direct `g++` commands as specified in the plan.
2. Run all required tests using the exact commands from the gate specification.
3. Record the actual, complete test output — do not paraphrase.
4. If a test fails: diagnose the root cause in the implementation and fix it.
   Do not modify the test to suppress the failure.
5. Re-run tests after any fix. Record the new output.

## Step 6 — Inspect the Diff

1. Review all changed files.
2. Confirm the diff contains only changes required by the approved plan.
3. Remove any debug artifacts, commented-out code, or accidental changes.
4. Confirm no unrelated files were modified.

## Step 7 — Report Evidence

Produce a report containing:

- **Gate ID** and the list of criteria addressed.
- **Files created or modified** with a one-line summary of each change.
- **Exact test commands run** (copy-paste ready).
- **Actual test output** (complete, not summarised).
- **Criterion-level statuses:**
  For each criterion: `PASS`, `FAIL`, or `NOT TESTED` with specific evidence.
- **Diff summary:** files changed, lines added/removed.
- **Open issues:** any blockers, ambiguities, or decisions required.

## Step 8 — Stop and Submit

Do not declare the gate PASS.
Do not begin the next gate.
Submit the report to the Orchestrator for independent review by the Tester.
