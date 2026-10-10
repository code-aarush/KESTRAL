# KESTREL — Agent Instructions

> **Read this file first. Then read `PROJECT_SSOT.md` before touching anything else.**

This file is the primary instruction entry point for every AI agent operating in this repository.
It is automatically loaded by Antigravity for any file opened within the `kestrel/` workspace.

---

## Mandatory Pre-Work Protocol

Before modifying any file, every agent must complete the following steps in order:

1. **Read `PROJECT_SSOT.md`** — establishes project identity, research question, active gate,
   architecture, terminology, and critical invariants. Do not proceed without reading it.

2. **Identify the active gate** — check `PROJECT_SSOT.md` for the current gate number and status.
   Do not work on any gate other than the explicitly active one.

3. **Read the gate specification** — open `docs/gates/GATE-NN.md` for the active gate. Extract
   every acceptance criterion. Do not modify or reinterpret them.

4. **Read relevant ADRs** — check which ADRs apply to the active gate (listed in the gate spec)
   and read them from `docs/decisions/`.

5. **Read the relevant skill** — if planning, read `gate-plan/SKILL.md`; if implementing, read
   `gate-implement/SKILL.md`; if reviewing, read `gate-review/SKILL.md`.

6. **Read `docs/architecture/ARCHITECTURE.md`** — understand the target structure without assuming
   unimplemented components exist.

---

## Operating Rules

### Scope Discipline
- Implement **only** what the active gate acceptance criteria require.
- Stop at the authorised scope boundary. Do not begin the next gate.
- Do not add classes, functions, files, or dependencies without a defensible requirement.
- Do not implement future gates speculatively.

### Evidence and Honesty
- Report **actual** test results, not assumptions or expected outcomes.
- Never fabricate test output, benchmark measurements, or verification evidence.
- Never mark a gate PASS without running the required tests and recording real results.
- Distinguish clearly between "created", "executed and verified", and "not tested".

### Preservation of Existing Work
- Inspect the diff before declaring any task complete.
- Do not discard, overwrite, or revert unrelated existing work.
- If a conflict prevents a safe change, document it and continue with independent tasks.

### Gate Approval
- Only the project owner can approve a gate. No agent may self-approve.
- A gate that appears complete must be submitted for independent review before PASS is recorded.
- Do not silently promote a gate status without owner confirmation.

### Communication
- Report blockers immediately rather than inventing decisions.
- Seek owner clarification for any ambiguity that affects acceptance criteria.
- When uncertain about a design decision, list options and ask; do not guess.

---

## Detailed Policies

Full policy text lives in the dedicated rule files loaded automatically:

| Policy | File |
|--------|------|
| Minimum Necessary Implementation | `.agents/rules/minimal-code.md` |
| Gate lifecycle and acceptance protocol | `.agents/rules/gate-discipline.md` |
| C++ coding standards | `.agents/rules/cpp-standards.md` |

---

## Agent Role Definitions

Specialist agent procedures are in `.agents/agents/`:

| Role | File | Summary |
|------|------|---------|
| Architect | `.agents/agents/architect.md` | Read-only technical planner |
| Developer | `.agents/agents/developer.md` | Scoped implementer |
| Tester | `.agents/agents/tester.md` | Independent reviewer and verifier |
| Orchestrator | `.agents/agents/orchestrator.md` | Coordination and gate lifecycle |

---

## Reusable Skills

Skills are discovered automatically from `.agents/skills/`:

| Skill | Trigger |
|-------|---------|
| `gate-plan` | Planning a gate implementation |
| `gate-implement` | Executing an approved gate plan |
| `gate-review` | Independent verification of a completed gate |

Quick invocation commands are in `docs/COMMANDS.md`.

---

## Repository Map

```
kestrel/
+-- AGENTS.md               <- You are here
+-- PROJECT_SSOT.md         <- Read second
+-- README.md               <- Project overview
+-- CMakeLists.txt          <- Build scaffold (CMake not yet on PATH)
+-- .gitignore
+-- .agents/
¦   +-- rules/              <- Always-active rule files
¦   +-- agents/             <- Role procedure documents
¦   +-- skills/             <- On-demand skill procedures
+-- docs/
¦   +-- architecture/       <- ARCHITECTURE.md
¦   +-- decisions/          <- ADR-001 through ADR-003
¦   +-- gates/              <- GATE-00 through GATE-11
¦   +-- templates/          <- GATE-TEMPLATE.md, ADR-TEMPLATE.md
¦   +-- reports/            <- Benchmark and review reports
¦   +-- COMMANDS.md         <- Reusable gate invocation commands
+-- src/                    <- C++ implementation (empty until Gate 01)
+-- tests/                  <- Test files (empty until Gate 01)
+-- benchmarks/             <- Benchmark code (empty until Gate 09)
+-- frontend/               <- Visualization placeholder (Gate 10)
```
