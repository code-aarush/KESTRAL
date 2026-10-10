# ADR-00N — [Short Decision Title]

**Status:** Proposed  
**Date:** YYYY-MM-DD  
**Supersedes:** [ADR-00X if applicable, otherwise "None"]  
**Superseded by:** [ADR-00Y if applicable, otherwise "None"]

---

## Context

Describe the situation, problem, or requirement that necessitates a decision.
Explain what constraints or forces are at play. Be specific about what is known
and what is uncertain. Do not assume the reader knows the project background.

---

## Decision

State the decision clearly and specifically. Use precise technical terms.
If the decision involves a data structure, interface, or algorithm, sketch it here.

The decision must be actionable: a developer reading this must know exactly what to implement.

---

## Alternatives Considered

### Alternative 1 — [Name]

Brief description.

**Reason rejected/deferred:** One or two sentences explaining the trade-off that
led to this alternative not being selected.

### Alternative 2 — [Name]

Brief description.

**Reason rejected/deferred:** ...

*(Add as many alternatives as were genuinely considered.)*

---

## Consequences and Trade-offs

**Benefits of the chosen decision:**
- Bullet list.

**Risks or limitations:**
- Bullet list.

**Items explicitly deferred by this decision:**
- Bullet list of things this decision consciously does not address.

---

## Validation Plan

Describe how the correctness of this decision will be verified.
Cite the gate(s) where validation will occur.

Example:
- Gate 01: implement `BoundingBox::is_valid` and test boundary semantics.
- Gate 04: verify that quadratic split preserves occupancy invariants.

---

## Approval Record

| Reviewer | Decision | Date | Notes |
|----------|---------|------|-------|
| Project Owner | PENDING | — | Decision required before relevant gate begins |
