# Rule: C++ Coding Standards

**Scope:** All C++ source files in `src/`, `tests/`, and `benchmarks/`.
**Verified toolchain:** g++ 16.1.0 (MSYS2 UCRT64), C++17.

---

## Language Standard

- Target **C++17**. This is safe with g++ 16.1.0 (verified at Gate 00).
- Compile with `-std=c++17 -Wall -Wextra -Wpedantic`.
- Do not use compiler extensions (`-std=gnu++17` is prohibited unless explicitly justified).
- Do not use features from C++20 or later without owner approval and toolchain verification.

---

## Standard Library and RAII

- Prefer standard library containers: `std::vector`, `std::unordered_map`, `std::array`, etc.
- Use RAII. Manage resources through constructors, destructors, and smart pointers (`std::unique_ptr`,
  `std::shared_ptr`) where ownership must be explicit. Prefer value semantics where practical.
- Avoid raw `new` / `delete`. If manual allocation is genuinely required, document why.
- Do not use deprecated C-style casts (`(int)x`). Use `static_cast`, `const_cast`, etc.

---

## Naming and Readability

- Use descriptive names. A variable named `bounding_box` is better than `bb` unless the context
  makes the abbreviation universally understood in this codebase.
- Class names: `PascalCase`. Functions and variables: `snake_case`. Constants: `UPPER_SNAKE_CASE`
  or `constexpr` with `snake_case`.
- Namespace: all project code lives in the `kestrel` namespace.
- Do not use single-letter names except for well-understood loop counters.

---

## Control Flow

- Prefer straightforward control flow over clever expressions.
- Avoid deeply nested conditionals. Extract helper functions when nesting exceeds three levels.
- Do not use `goto`.
- Use early returns to reduce nesting where it improves clarity.

---

## Interfaces and Inheritance

- Keep class interfaces small. A class should do one thing well.
- Avoid unnecessary inheritance hierarchies. Prefer composition.
- Do not introduce virtual dispatch without a requirement justifying runtime polymorphism.
- If an interface (pure abstract class) is introduced, document which requirement demands it.

---

## Geometry and Domain Semantics

- Define and document boundary semantics for bounding boxes before implementing dependent code.
  Decide once whether intersection is closed (inclusive) or half-open, and apply consistently.
- Document box validity conditions (e.g., `min_x <= max_x` and `min_y <= max_y`).
- Document and test the degenerate case (zero-area box, point box).
- All spatial operations must have explicit, tested boundary semantics.

---

## Correctness and Safety

- Avoid undefined behaviour. Do not rely on signed integer overflow, out-of-bounds access,
  or uninitialized variables.
- Check preconditions explicitly in debug builds (use `assert` or a simple internal check).
  Document the preconditions in comments.
- Do not use unchecked assumptions about input ranges in core data-structure code.
- Apply `const`-correctness where it improves clarity: `const` references, `const` member
  functions, `const` local variables. Do not apply it mechanically everywhere without judgement.

---

## Comments

- Write comments for:
  - Non-obvious algorithms and their invariants.
  - Design decisions that are not evident from the code structure.
  - Preconditions and postconditions for non-trivial functions.
  - Known limitations and deferred decisions.
- Do not write comments that restate what obvious code does (e.g., `// increment i` before `i++;`).

---

## Testing

- Keep tests deterministic and independent of visualization.
- Use fixed seeds for any random number generation in tests.
- Test invalid inputs and boundary conditions, not just the happy path.
- Tests must not rely on output formatting; check values, not printed strings (where possible).
- Do not weaken, skip, or mock a test to make it pass. Fix the code instead.

---

## Build and Sanitizers

- Enable `-Wall -Wextra -Wpedantic` in all builds.
- In debug or CI builds, enable sanitizers if the toolchain supports them:
  - AddressSanitizer: `-fsanitize=address`
  - UndefinedBehaviorSanitizer: `-fsanitize=undefined`
- Document in the gate evidence whether sanitizers were run and what they reported.
- Do not suppress sanitizer warnings without documented justification.

---

## What NOT to Do

- Do not install or configure formatters (e.g., clang-format), linters, or style tools
  automatically. Use them only if the owner explicitly requests them.
- Do not use third-party spatial-indexing libraries for the core R-tree.
- Do not introduce a custom testing framework (use standard C++ with a minimal test harness).
- Do not use compiler-specific attributes without documenting them and confirming portability
  to the verified toolchain.
