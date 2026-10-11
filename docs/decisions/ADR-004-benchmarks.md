# ADR-004 - Benchmark Dataset Sizes and Performance Characterization Metrics (OD-004)

**Status:** Accepted
**Date:** 2026-10-10
**Last updated:** 2026-10-10
**Formally approved by Project Owner on 2026-10-10.**

---

## Context

KESTREL requires a formal characterization of its native 2D R-tree spatial index performance under various structural loads. Previously, this characterization was conflated with a requirement for a brute-force fallback oracle and differential comparisons. The project architecture has since been explicitly constrained to a **native-R-tree-only** methodology.

OD-004 specifies the dataset sizes, metrics to be recorded, and the evaluation policy without inventing arbitrary performance thresholds or reviving the rejected brute-force comparative baseline.

---

## Decision (Accepted)

Implement a benchmarking executable (`kestrel_benchmark`) configured exactly to characterize the native R-tree's behavior.

### Dataset Sizes
The benchmark will evaluate the spatial index over the following entity populations to characterize scaling behavior:
- 100 entities
- 1,000 entities
- 10,000 entities

### Metrics
The following metrics will be instrumented and recorded where measurable without invasive architectural changes:
- **Query latency:** Recorded (e.g. in µs) for region scans, nearby-object queries, and corridor queries.
- **Index build time:** The time taken to construct the tree for the given dataset.
- **Representative update time:** The time to apply modifications/movements.
- **R-tree nodes visited per query:** A measure of the tree's structural pruning efficiency.
- **Narrow-phase geometry checks per query:** The number of exact geometry checks performed on candidates returned from the broad phase.

### Acceptance Policy
- **No arbitrary thresholds:** There are no absolute latency or memory thresholds required for a "pass."
- **No brute-force baselines:** Linear-scan oracles and differential comparisons are strictly forbidden.
- **Honest reporting:** Results must be reproducible and honestly reported, including poor performance or architectural limitations (e.g., quadratic split degradation at scale).
- **Reproducibility:** The benchmark must record the workload, spatial distribution, query parameters, random seeds, trial/repetition procedure, and relevant build configuration.
- **Minimal instrumentation:** Use existing instrumentation where possible. Add only the minimum instrumentation needed to measure the agreed metrics.
- **Focused scope:** Do not create a generalized benchmarking framework or an unrelated performance subsystem.

---

## Alternatives Considered

- **Alternative 1 — Brute-Force Oracle Comparison:** Rejected. Requires maintaining a parallel linear-scan spatial query system, which violates the native-R-tree-only contract and distracts from characterizing the R-tree itself.
- **Alternative 2 — Hard Latency Thresholds:** Rejected. The academic purpose of this project is to investigate and document the R-tree's behavior. Failing a gate because a latency threshold was missed falsifies the research objective.
- **Alternative 3 — Third-Party Benchmark Suites (e.g. Google Benchmark):** Rejected. Introducing heavy third-party dependency frameworks exceeds the Minimum Necessary Implementation (MNI) rule for a simple characterization objective.

---

## Consequences and Trade-offs

**Benefits:**
- Realigns the benchmark with the project's native C++ R-tree focus.
- Avoids the maintenance burden of dual-implementation (oracle vs index).
- Guarantees honest documentation of algorithmic scaling limits.

**Risks:**
- Without an oracle, query *correctness* is not proven by the benchmark. This risk is mitigated because correctness is proven at the unit-test level via explicit deterministic geometry assertions (GATE-08).

---

## Validation Plan

GATE-09 will implement `kestrel_benchmark` adhering to these sizes and metrics. A `BENCHMARK-REPORT.md` will be produced documenting the metrics above, run across fixed seeds and documented configurations.

---

## Approval Record

| Reviewer | Decision | Date | Notes |
|----------|---------|------|-------|
| Project Owner | ACCEPTED | 2026-10-10 | Authorized dataset sizes and native benchmarking metrics without thresholds. |
