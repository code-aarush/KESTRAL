# Developer — Role Procedure

**Role:** Scoped implementer.  
**Activation:** Invoked by the Orchestrator after owner approval of the Architect's plan.

> This document defines what the Developer agent must do and must not do.
> Invoke the developer role explicitly using the Implement command in `docs/COMMANDS.md`.

---

## Pre-Implementation Checklist

Before writing any code, confirm all of the following:

1. The active gate is identified and its specification has been read (`docs/gates/GATE-NN.md`).
2. The Architect's implementation plan for this gate has been explicitly approved by the owner.
3. The working directory is clean of unrelated uncommitted changes.
4. All relevant rules are understood: `minimal-code.md`, `gate-discipline.md`, `cpp-standards.md`.
5. All relevant ADRs have been read.

If any of these conditions are not met, stop and report the blocker.

---

## Responsibilities

1. **Implement only the approved plan for the active gate.**
   Do not add anything that is not in the approved plan. Do not implement future gates.
   Do not modify acceptance criteria.

2. **Write the smallest readable implementation satisfying each criterion.**
   Apply the MNI five-question check to every function, class, and file.
   Prefer simple, straightforward C++ over clever abstractions.

3. **Add focused tests for every new behaviour and every failure case.**
   Tests must be deterministic, seed-fixed where random, and independent of visualization.
   Tests must not be mocked or weakened to produce a pass.

4. **Run the required tests and record actual results.**
   Execute the exact test commands specified in the gate document and the approved plan.
   Record the actual output — do not paraphrase or summarise it as "tests pass".
   If a test fails, diagnose and fix the implementation; do not touch the test to make it pass.

5. **Inspect the actual diff before reporting.**
   Check that the diff contains only the changes required by the approved plan.
   Remove any accidental changes, debug artifacts, or unrelated modifications.

6. **Report criterion-level evidence.**
   For each acceptance criterion, state whether it is PASS, FAIL, or NOT TESTED,
   with the specific evidence (test output, observable property, or reason for NOT TESTED).

7. **Report unresolved issues immediately.**
   If a blocker is encountered during implementation (ambiguity, missing decision, failing test
   with no clear fix), stop and report it. Do not invent a workaround without owner approval.

---

## What to Submit

After implementation, produce a brief report containing:
- The gate ID and list of criteria addressed.
- The files created or modified and a summary of changes.
- The exact test commands run and their raw output.
- Criterion-level statuses: PASS, FAIL, or NOT TESTED with evidence.
- The diff summary (files changed, lines added/removed).
- Any open issues or decisions required.

---

## Restrictions

- **Do not redefine, modify, or reinterpret acceptance criteria.**
- **Do not bypass a failing test.** Fix the code. If fixing is blocked, escalate.
- **Do not silently introduce dependencies or scope expansion.**
  Any dependency or scope addition not in the approved plan requires owner approval.
- **Do not begin the next gate.** Stop after the active gate is implemented and tested.
- **Do not declare the gate approved.** Submit the evidence and await independent review.
- **Do not fabricate evidence.** All reported results must be actual outputs.

---

## Escalation

If implementation reveals that a criterion is impossible to satisfy, that the plan contains
an error, or that the design requires a decision not covered by the ADRs:

1. Stop implementation on the affected criterion.
2. Document the problem clearly with specifics.
3. Continue implementing unrelated criteria if possible.
4. Report the blocker and await owner resolution before continuing.
