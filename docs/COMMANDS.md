# KESTREL — Gate Invocation Commands

These three commands are the canonical way to invoke the KESTREL gate workflow.
Each command is self-contained: the agent reads persistent context from `PROJECT_SSOT.md`,
the gate specification, ADRs, rules, and the relevant skill.

You do not need to re-explain the project each time you use these commands.

---

## How to Invoke

Type the command text below directly into the Antigravity chat. Replace `NN` with the
actual two-digit gate number (e.g., `01`, `04`, `11`).

The Antigravity agent will automatically discover and load:
- `.agents/rules/minimal-code.md` — MNI policy
- `.agents/rules/gate-discipline.md` — gate acceptance protocol
- `.agents/rules/cpp-standards.md` — C++ standards
- `.agents/skills/gate-plan/SKILL.md` — on-demand when gate-plan is activated
- `.agents/skills/gate-implement/SKILL.md` — on-demand when gate-implement is activated
- `.agents/skills/gate-review/SKILL.md` — on-demand when gate-review is activated

---

## Command 1 — Plan

```
Plan Gate NN only. Read the SSOT, gate specification, relevant ADRs, existing code, and gate-plan skill. Do not modify source files. Return the minimum implementation plan and criterion-to-test mapping.
```

**What this does:** Invokes the Architect role. The agent reads all gate context,
applies the MNI necessity check to every proposed item, and produces an actionable
implementation plan with a criterion-to-test mapping.

**What this does NOT do:** Modify any source file. Begin implementation. Approve the plan.

**After this command:** Review the plan. If satisfied, explicitly approve it before
issuing the Implement command.

---

## Command 2 — Implement

```
Implement the explicitly approved Gate NN plan only. Follow repository rules and gate-implement skill. Run required tests, inspect the diff, and report actual evidence. Do not begin the next gate or approve the gate.
```

**What this does:** Invokes the Developer role. The agent implements only the approved
scope, runs the required test commands, records actual output, and reports criterion-level
evidence.

**What this does NOT do:** Redefine requirements. Bypass failing tests. Begin Gate NN+1.
Declare the gate PASS.

**Prerequisite:** You must have explicitly approved the Gate NN plan before issuing this command.

**After this command:** Review the developer's evidence report. Issue the Review command.

---

## Command 3 — Review

```
Independently review Gate NN against every acceptance criterion. Follow gate-review skill. Inspect the actual diff and execute relevant tests. Return PASS, FAIL, or NOT TESTED for every criterion with evidence. Do not assume the developer report is correct.
```

**What this does:** Invokes the Tester role. The agent independently reads the criteria,
inspects the diff, runs tests without relying on the developer's report, and returns a
criterion-by-criterion verdict.

**What this does NOT do:** Modify source files. Approve the gate. Trust the developer report
as evidence.

**After this command:** Review the Tester's findings. If all criteria are PASS, provide your
explicit owner approval to close the gate. If any criterion is FAIL, direct the developer to
correct it (re-issue Implement command with corrected scope).

---

## Gate Close Procedure

After a successful Review, to close the gate:

1. Update the gate document status to PASS in `docs/gates/GATE-NN.md`.
2. Record your approval in the Owner Approval Record section.
3. Update `PROJECT_SSOT.md` Gate table to PASS for this gate.
4. Confirm the active gate is now Gate NN+1.

Then you may issue:
```
Plan Gate NN+1 only. Read the SSOT, gate specification, relevant ADRs, existing code, and gate-plan skill. Do not modify source files. Return the minimum implementation plan and criterion-to-test mapping.
```

---

## Manual Invocation Notes

These commands are plain text prompts. No slash-command configuration has been verified
as supported by the current Antigravity IDE installation for custom repository commands.

If the Antigravity IDE adds verified slash-command support for workspace-local commands in
a future version, this file should be updated with the exact configuration syntax.
Until then, copy the command text above into the chat directly.
