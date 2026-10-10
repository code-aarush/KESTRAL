# Rule: Gate Discipline and Acceptance Protocol

**Scope:** This rule applies to every agent in this repository at all times.

---

## Gate Lifecycle States

A gate must be in exactly one of the following states at all times:

| Status | Meaning |
|--------|---------|
| `OPEN` | Work not yet started or in progress; criteria not yet met |
| `IN REVIEW` | Developer has submitted results; independent review in progress |
| `PASS` | All criteria verified, independent review complete, owner approved |
| `FAIL` | One or more criteria failed; returned to developer for correction |
| `BLOCKED` | Cannot proceed due to unresolved dependency or unresolved decision |

---

## Gate Document Required Sections

Every gate document in `docs/gates/GATE-NN.md` must contain:

1. Gate ID, title, purpose, and current status.
2. Prerequisites and gate dependencies.
3. Scope (what is included) and explicit exclusions.
4. Relevant architecture decisions (ADR references).
5. Numbered acceptance criteria with stable criterion IDs (e.g., `GATE-04-AC-03`).
6. Planned implementation files and test files.
7. Required test commands and expected observable properties.
8. Actual evidence and test results (populated during/after execution).
9. Independent reviewer findings.
10. Outstanding defects and risks.
11. Final decision and authorised next step.
12. Owner approval record.

---

## Criterion Statuses

Each acceptance criterion must receive exactly one status:

- `PASS` — verified with sufficient reproducible evidence. Evidence must be recorded.
- `FAIL` — evidence demonstrates a violation. The failure must be described.
- `NOT TESTED` — evidence is missing or verification has not been performed.
  A NOT TESTED criterion is a blocking condition for gate PASS.

---

## Non-Negotiable PASS Protocol

A gate may be set to PASS **only** when all of the following are true:

1. Every mandatory acceptance criterion is individually marked `PASS`.
2. Required tests have actually been executed and their raw results recorded.
3. Regression tests relevant to the changes pass.
4. The actual Git diff has been inspected and verified clean of unrelated changes.
5. No unresolved blocker or critical defect violates any criterion.
6. An independent reviewer (the Tester) has verified the evidence separately from the developer.
7. The project owner has explicitly confirmed approval in the gate document.

**Compilation alone is not sufficient. Test existence alone is not sufficient.
A developer's claim is not independent evidence.**

---

## Gate Failure Protocol

When a criterion is FAIL:

1. The gate status is set to FAIL and the gate is returned to the developer.
2. The developer performs a focused correction addressing only the failed criterion.
3. The Tester re-runs the relevant verification independently.
4. If correction passes, the Tester updates the criterion status to PASS.
5. If all criteria are now PASS, the gate transitions to IN REVIEW for owner approval.

The developer must not modify acceptance criteria to resolve a failure.
The Tester must not waive defects or modify source code during review
(unless separately authorised by the owner as a distinct fix task).

---

## Change Control on Acceptance Criteria

Acceptance criteria are established before implementation begins.
If a criterion proves impossible to test or is found to be incorrect:

1. The issue must be documented in the gate file with a full explanation.
2. A proposed change must be presented to the project owner.
3. The criterion may only be modified with explicit owner approval.
4. The approval must be recorded in the gate document before any change is made.

Never rewrite a criterion silently to pass it.

---

## Reviewer Independence

The Tester role must act independently of the Developer:

- The Tester reads criteria before examining developer claims.
- The Tester inspects the actual diff and runs tests independently.
- The Tester does not accept the developer's report as evidence.
- The Tester reports PASS, FAIL, or NOT TESTED with their own evidence.
- The Tester does not modify source files during review.

---

## Owner Approval

- Only the project owner may approve a gate.
- No agent may self-approve or approve on behalf of the owner.
- Owner approval must be recorded explicitly in the gate document.
- A gate that looks complete but lacks owner approval remains IN REVIEW, not PASS.

---

## Gate Sequencing

- Gates must be worked in order unless a dependency analysis explicitly justifies
  parallel work on non-overlapping scope.
- Do not begin implementation for Gate N+1 while Gate N is OPEN, IN REVIEW, or FAIL.
- Do not claim a later gate is unblocked until its prerequisites are PASS.
