# GATE-00 — Repository Reconnaissance and Specification

**Gate ID:** GATE-00  
**Status:** OPEN  
**Created:** 2026-10-09  
**Last updated:** 2026-10-09  

---

## Purpose

Establish the repository foundation: directory structure, project identity documentation,
engineering policy rules, gate governance, specialist agent procedures, reusable skills,
and all 12 gate specifications. Identify the actual toolchain and record unresolved decisions.

This gate does not implement the R-tree, simulation, mission logic, or any application feature.
It produces the documentation and process infrastructure that all subsequent gates rely on.

---

## Prerequisites

None. This is the first gate.

---

## Scope

### Included in this gate
- Repository directory structure as specified.
- `AGENTS.md` — agent instruction entry point.
- `PROJECT_SSOT.md` — single source of truth.
- `README.md` — project overview.
- `CMakeLists.txt` — minimal scaffold (not a full build, as CMake is not yet on PATH).
- `.gitignore` — appropriate to the verified toolchain.
- `.agents/rules/` — three rule files: minimal-code, gate-discipline, cpp-standards.
- `.agents/agents/` — four procedure documents: architect, developer, tester, orchestrator.
- `.agents/skills/` — three skills: gate-plan, gate-implement, gate-review.
- `docs/architecture/ARCHITECTURE.md` — target architecture document.
- `docs/decisions/` — ADR-001, ADR-002, ADR-003 (all status: Proposed).
- `docs/gates/` — GATE-00 through GATE-11 (all status: OPEN).
- `docs/templates/` — GATE-TEMPLATE.md, ADR-TEMPLATE.md.
- `docs/COMMANDS.md` — reusable gate invocation commands.
- Toolchain identification: compiler, build tools, C++ standard, git.
- Identification of unresolved decisions (OD-001 through OD-006).

### Excluded from this gate (do not implement here)
- Any C++ source code in `src/`, `tests/`, or `benchmarks/`.
- R-tree implementation or any data structure.
- Entity model or simulation.
- Frontend placeholder content (beyond an empty directory).
- CMake installation or system configuration changes.
- Git repository initialisation (no git init unless owner requests it).
- Performance benchmarks or measurements.

---

## Relevant Architecture Decisions

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | R-tree variant | Proposed |
| ADR-002 | Geometry model | Proposed |
| ADR-003 | Entity storage and indexing | Proposed |

All three ADRs are Proposed. Owner acceptance is not required for Gate-00 itself
(which is documentation-only), but is required before Gates 01–03 begin implementation.

---

## Planned Implementation Files

No source code files. All outputs are documentation and configuration.

| File | Action |
|------|--------|
| `AGENTS.md` | Overwrite empty file |
| `PROJECT_SSOT.md` | Create |
| `README.md` | Create |
| `CMakeLists.txt` | Create (scaffold only) |
| `.gitignore` | Create |
| `.agents/rules/minimal-code.md` | Create |
| `.agents/rules/gate-discipline.md` | Create |
| `.agents/rules/cpp-standards.md` | Create |
| `.agents/agents/architect.md` | Create |
| `.agents/agents/developer.md` | Create |
| `.agents/agents/tester.md` | Create |
| `.agents/agents/orchestrator.md` | Create |
| `.agents/skills/gate-plan/SKILL.md` | Create |
| `.agents/skills/gate-implement/SKILL.md` | Create |
| `.agents/skills/gate-review/SKILL.md` | Create |
| `docs/architecture/ARCHITECTURE.md` | Create |
| `docs/decisions/ADR-001-rtree-variant.md` | Create |
| `docs/decisions/ADR-002-geometry.md` | Create |
| `docs/decisions/ADR-003-entity-storage.md` | Create |
| `docs/gates/GATE-00.md` through `GATE-11.md` | Create |
| `docs/templates/GATE-TEMPLATE.md` | Create |
| `docs/templates/ADR-TEMPLATE.md` | Create |
| `docs/COMMANDS.md` | Create |

---

## Required Verification Commands

There are no test executables for Gate-00 (no C++ source exists).
Verification is by inspection and directory/file existence checks.

```powershell
# Verify directory structure
Get-ChildItem -Path "." -Recurse | Select-Object FullName

# Verify all required files exist and are non-empty
Get-ChildItem -Path "." -Recurse -File | Where-Object { $_.Length -eq 0 }
# Expected: no files listed (all non-empty)

# Verify no C++ source files were created
Get-ChildItem -Path "src", "tests", "benchmarks" -Recurse -Filter "*.cpp" 2>$null
# Expected: no output (no .cpp files)
```

---

## Acceptance Criteria

### GATE-00-AC-01 — Directory structure matches specification

**Requirement:** All required directories exist: `.agents/rules/`, `.agents/agents/`,
`.agents/skills/gate-plan/`, `.agents/skills/gate-implement/`, `.agents/skills/gate-review/`,
`docs/architecture/`, `docs/decisions/`, `docs/gates/`, `docs/templates/`, `docs/reports/`,
`src/`, `tests/`, `benchmarks/`, `frontend/`.  
**Verification:** `Get-ChildItem -Recurse -Directory` output lists all required paths.  
**Status:** NOT TESTED  
**Evidence:** [To be populated by reviewer]

---

### GATE-00-AC-02 — All required documentation files exist and are non-empty

**Requirement:** Every file listed in the Planned Implementation Files table exists
and contains meaningful content (not just a placeholder or blank file).  
**Verification:** `Get-ChildItem -Recurse -File | Where-Object { $_.Length -eq 0 }` returns
no files. Spot-check key files for meaningful content.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-00-AC-03 — AGENTS.md is the instruction entry point and references SSOT

**Requirement:** `AGENTS.md` contains the mandatory pre-work protocol directing agents
to read `PROJECT_SSOT.md` first, identify the active gate, read the gate spec, ADRs,
and relevant skill before modifying anything.  
**Verification:** Read `AGENTS.md` and confirm all six pre-work steps are present.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-00-AC-04 — PROJECT_SSOT.md accurately reflects the verified toolchain

**Requirement:** `PROJECT_SSOT.md` section 10 (Toolchain) accurately records the
verified compiler (g++ 16.1.0, MSYS2 UCRT64), mingw32-make, the absence of CMake
from PATH, and git version. OD-001 (CMake decision) is recorded as Pending.  
**Verification:** Compare SSOT toolchain section against verified tool outputs.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-00-AC-05 — Gate-00 status is OPEN in PROJECT_SSOT.md

**Requirement:** `PROJECT_SSOT.md` lists Gate-00 status as OPEN. No gate is marked
PASS in the SSOT. The SSOT explicitly states that no R-tree implementation has been created.  
**Verification:** Read the gate table in `PROJECT_SSOT.md`.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-00-AC-06 — All 12 gate documents exist with criterion IDs

**Requirement:** `docs/gates/GATE-00.md` through `GATE-11.md` all exist. Each contains
at least three acceptance criteria with stable criterion IDs in the format
`GATE-NN-AC-NN`. All gates are status OPEN.  
**Verification:** List gate files; spot-check three gates for criterion IDs and OPEN status.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-00-AC-07 — Three ADRs exist with status Proposed

**Requirement:** `docs/decisions/ADR-001-rtree-variant.md`, `ADR-002-geometry.md`,
and `ADR-003-entity-storage.md` all exist. Each has status: Proposed and an Approval
Record with PENDING owner decision.  
**Verification:** Read the Status and Approval Record sections of each ADR.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-00-AC-08 — Three skills exist with valid frontmatter

**Requirement:** `.agents/skills/gate-plan/SKILL.md`, `gate-implement/SKILL.md`, and
`gate-review/SKILL.md` all exist. Each starts with YAML frontmatter containing `name`
and `description` fields, conforming to the Antigravity skill format.  
**Verification:** Read the first 10 lines of each SKILL.md and confirm YAML frontmatter.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-00-AC-09 — CMakeLists.txt is a valid scaffold with no application targets

**Requirement:** `CMakeLists.txt` sets `cmake_minimum_required`, project name, C++17 standard,
and compiler warnings. It does not define any executable or library target. It contains a
comment explaining that CMake is not on PATH and referencing OD-001.  
**Verification:** Read `CMakeLists.txt`. Confirm no `add_executable` or `add_library` targets.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-00-AC-10 — No C++ source files were created

**Requirement:** `src/`, `tests/`, and `benchmarks/` contain no `.cpp`, `.h`, or `.hpp` files.  
**Verification:** `Get-ChildItem -Path src,tests,benchmarks -Recurse -Filter "*.cpp"` returns nothing.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-00-AC-11 — COMMANDS.md documents the three gate invocation commands

**Requirement:** `docs/COMMANDS.md` contains the exact Plan, Implement, and Review command
texts. It states that custom slash commands have not been verified as supported and describes
the manual invocation procedure.  
**Verification:** Read `docs/COMMANDS.md` and confirm all three commands are present verbatim.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

## Actual Evidence and Test Results

*To be populated by the Setup Agent after completing file creation.*

**Directory listing:**
```
[Paste Get-ChildItem -Recurse output here]
```

**Empty file check:**
```
[Paste output here — expected: no output]
```

**C++ file check:**
```
[Paste output here — expected: no output]
```

---

## Independent Reviewer Findings

*To be populated by the Tester / project owner during Gate-00 review.*

| Criterion | Reviewer Status | Evidence |
|-----------|----------------|---------|
| GATE-00-AC-01 | NOT TESTED | — |
| GATE-00-AC-02 | NOT TESTED | — |
| GATE-00-AC-03 | NOT TESTED | — |
| GATE-00-AC-04 | NOT TESTED | — |
| GATE-00-AC-05 | NOT TESTED | — |
| GATE-00-AC-06 | NOT TESTED | — |
| GATE-00-AC-07 | NOT TESTED | — |
| GATE-00-AC-08 | NOT TESTED | — |
| GATE-00-AC-09 | NOT TESTED | — |
| GATE-00-AC-10 | NOT TESTED | — |
| GATE-00-AC-11 | NOT TESTED | — |

---

## Outstanding Defects and Risks

| ID | Description | Severity | Status |
|----|-------------|---------|--------|
| OD-001 | CMake not on PATH; build system decision pending | Medium | Open |
| OD-006 | ADR-001/002/003 require owner acceptance before Gates 01–03 | Medium | Open |

---

## Final Decision

**Gate status:** OPEN  
**Note:** This gate was set up by the Repository Setup Agent. It has NOT been passed.
The Setup Agent is not authorised to approve this gate. Owner review and explicit
approval is required after verifying the setup evidence.

---

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | N/A | — | Gate-00 is setup-only; plan approval was implicit in the setup task |
| Gate PASS approved | PENDING | — | Required after reviewing setup evidence |
