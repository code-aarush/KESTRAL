# Rule: Minimum Necessary Implementation (MNI)

**Scope:** This rule applies to every agent, developer, and reviewer in this repository at all times.
**Priority:** Highest — supersedes stylistic preferences and convenience.

---

## Policy Statement

Build the smallest complete, correct, readable solution that satisfies the approved requirements.
Every addition must be defensible. If it cannot be defended, it must not be added.

---

## Five-Question Necessity Check

Before adding any class, function, file, dependency, abstraction, configuration option,
or substantial code block, every agent must be able to answer all five questions:

1. **Which explicit requirement or acceptance criterion requires this addition?**
   Cite the gate ID and criterion ID (e.g., GATE-01-AC-02). "It seems useful" is not an answer.

2. **Can an existing implementation be extended instead?**
   Prefer extending existing code to introducing a new abstraction.

3. **Is there a simpler solution that is equally correct and maintainable?**
   The simpler solution wins unless correctness or clarity demands more complexity.

4. **What complexity and maintenance burden does this addition introduce?**
   Be explicit. If the burden is non-trivial, seek owner approval.

5. **Can the student understand, explain, debug, and defend the implementation?**
   If the answer is no, the implementation is too complex regardless of correctness.

If any question cannot be answered satisfactorily, do not add the item.

---

## Prohibited Additions

Do not add any of the following without an explicitly approved, criterion-linked justification:

- Speculative features or pre-emptive generalisation.
- Premature optimisations (micro-optimisations before profiling).
- Unnecessary abstractions: redundant wrappers, factories, managers, interfaces.
- Decorative architecture (design patterns applied for their own sake).
- Unrelated refactoring during an active gate implementation.
- New external dependencies without demonstrated need and owner approval.
- A database, distributed architecture, elaborate physics engine, plugin system,
  or custom testing framework.
- Third-party spatial-indexing library as a substitute for the core R-tree.

---

## Positive Practices

- Implement only the currently authorised gate.
- Prefer straightforward C++ and descriptive names over clever or compressed code.
- Use comments for non-obvious algorithms, invariants, and design decisions —
  not to narrate every line of obvious code.
- Do not duplicate logic that already has a clear, reusable implementation.
- Keep functions short enough to be understandable, not short by an arbitrary line count.
  Judge by necessity, complexity, correctness, and explainability.

---

## Test and Evidence Integrity

- Never weaken, delete, skip, or mock a failing test to achieve a passing result.
- Never fabricate test results, benchmark measurements, or verification evidence.
- Never mark a gate PASS because code was generated, compiles, or looks correct.
- A criterion is PASS only when the evidence demonstrates it, not when the developer
  believes it is correct.

---

## Enforcement

The Tester must independently verify that no unnecessary additions were made during implementation.
The Architect must reject plans that include additions failing the five-question check.
The Orchestrator must not proceed to the next gate if the current gate contains unrequested additions.
