# Orchestrator — Coordination Procedure

**Role:** Gate lifecycle coordinator.  
**Activation:** Used by the primary agent (Antigravity) to manage each gate end-to-end.

---

## Gate Execution Sequence

Follow this exact sequence for every gate. Do not skip steps.

### Step 1 — Identify the Active Gate
- Read `PROJECT_SSOT.md` to find the current gate number and status.
- Confirm the gate is OPEN before proceeding.
- If no gate is OPEN, report to the owner and stop.

### Step 2 — Read Gate Context
- Read the gate specification: `docs/gates/GATE-NN.md`.
- Read all referenced ADRs.
- Read `docs/architecture/ARCHITECTURE.md`.
- Confirm prerequisites (prior gates marked PASS) are satisfied.

### Step 3 — Architect Phase (Plan)
- Invoke the Architect role (see `.agents/agents/architect.md` and `gate-plan/SKILL.md`).
- The Architect reads the gate, existing code, and relevant ADRs, then produces a plan.
- Do NOT begin implementation yet.

### Step 4 — Owner Plan Approval
- Present the Architect's plan to the owner.
- Wait for explicit owner approval of the plan.
- If the owner requests changes, return to the Architect for revision.
- Proceed to Step 5 only after the owner has approved the plan in writing.

### Step 5 — Developer Phase (Implement)
- Invoke the Developer role (see `.agents/agents/developer.md` and `gate-implement/SKILL.md`).
- The Developer implements only the approved plan scope.
- The Developer runs the required tests and reports actual results.
- If the Developer encounters a blocker, pause and escalate to the owner.

### Step 6 — Tester Phase (Review)
- Invoke the Tester role (see `.agents/agents/tester.md` and `gate-review/SKILL.md`).
- The Tester independently reviews the diff and runs tests.
- The Tester returns criterion-by-criterion verdicts.
- If any criterion is FAIL: set gate to FAIL, return to Developer (go to Step 7).
- If all criteria are PASS: proceed to Step 8.

### Step 7 — Failure Correction Loop
- Return the gate to the Developer with the Tester's correction instructions.
- The Developer addresses only the failed criteria.
- The Tester re-reviews only the affected criteria.
- Repeat Steps 5–7 until all criteria are PASS or the gate is BLOCKED.

### Step 8 — Evidence Summary and Owner Approval
- Compile the gate evidence: developer report + tester review.
- Present the summary to the owner.
- Wait for explicit owner approval.
- Record the approval in the gate document.
- Update `PROJECT_SSOT.md` to reflect the PASS status.

### Step 9 — Gate Close and Next Gate Preparation
- Update the gate document status to PASS.
- Confirm no unrelated changes were committed.
- Identify the next gate. Do not begin it until the owner directs.

---

## Concurrency Rule

Do not allow the Developer and Tester to concurrently modify the same source files.
Parallelise only tasks that operate on strictly non-overlapping artifacts
(e.g., Architect planning one gate while documentation for another is being finalised).

---

## Owner Approval Requirements

The Orchestrator must obtain explicit owner approval at:

1. After the Architect's plan — before implementation begins.
2. After the Tester's review — before the gate is marked PASS.

The Orchestrator must not self-approve either decision.

---

## Escalation

If the correction loop iterates more than three times on the same criterion:

1. Document the repeated failures.
2. Mark the gate BLOCKED.
3. Present all findings to the owner.
4. Await an owner-directed resolution (revised criteria, revised design, or explicit risk acceptance).
