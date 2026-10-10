# GATE-09 — Benchmarking and Research Evaluation

**Gate ID:** GATE-09  
**Status:** OPEN  
**Created:** 2026-10-09  
**Last updated:** 2026-10-09  

---

## Purpose

Compare R-tree spatial queries against brute-force linear scans on identical datasets.
Measure and record query latency, build/update time, nodes visited, and memory where
measurable. Produce reproducible benchmark results that support (or honestly qualify)
the research question. Introduce the `kestrel_benchmark` executable.

---

## Prerequisites

| Prerequisite | Gate | Status |
|-------------|------|--------|
| Mission queries and hazard assessment | GATE-08 | OPEN |

---

## Scope

### Included
- `kestrel_benchmark` executable: runs controlled experiments.
- Varied parameters: object count (at least 3 levels), spatial distribution (at least 2),
  query region size (at least 3), movement rate (at least 2).
- Metrics: query latency (per query, in ns or µs), index build time, update time,
  nodes visited per query (R-tree), exact narrow-phase checks performed.
- Memory usage: document method and limitations honestly.
- Methodology: fixed seeds, warm-up runs, multiple measurement runs (at least 5).
- Raw result files: CSV or similar, committed to `docs/reports/` or `benchmarks/results/`.
- Analysis: summarise results in `docs/reports/BENCHMARK-REPORT.md`.

### Excluded
- Claims of universal performance superiority without data.
- Fabricated or extrapolated measurements.
- Visualization of results (plot generation is optional and must be clearly labelled as such).

---

## Relevant Architecture Decisions

None specifically for benchmarking. Depends on all prior gates being PASS.

---

## Planned Implementation Files

| File | Action |
|------|--------|
| `benchmarks/benchmark_main.cpp` | Create |
| `benchmarks/results/` | Populated by running the benchmark |
| `docs/reports/BENCHMARK-REPORT.md` | Create |

---

## Acceptance Criteria

### GATE-09-AC-01 — kestrel_benchmark compiles and runs to completion

**Requirement:** `kestrel_benchmark` compiles and runs without crashing for all configured
parameter combinations, producing output for each combination.  
**Verification:** Build and run; confirm it completes and produces output.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-09-AC-02 — Benchmark results are reproducible with fixed seeds

**Requirement:** Running `kestrel_benchmark` twice with the same parameters produces
latency results within measurement noise (< 5% coefficient of variation expected for
repeated-run averages on the same machine). Raw outputs match.  
**Verification:** Run benchmark twice; compare average latencies for each configuration.
Document the machine and configuration.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-09-AC-03 — All parameter combinations are measured

**Requirement:** Object counts, spatial distributions, query sizes, and movement rates
as specified in the approved plan are all represented in the raw result files.  
**Verification:** Check raw result files cover all planned parameter combinations.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-09-AC-04 — R-tree results match brute-force during benchmarking

**Requirement:** During the benchmark, a correctness check confirms that R-tree query results
match the brute-force oracle for at least one query per configuration. Benchmarking an incorrect
implementation is not acceptable.  
**Verification:** Correctness check output in benchmark log; zero discrepancies.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-09-AC-05 — Results are reported honestly without fabrication

**Requirement:** The benchmark report accurately reflects the recorded raw results. If the
R-tree does not outperform brute-force in some configurations, this is reported honestly
and discussed. No measurement is invented or extrapolated.  
**Verification:** Cross-check report figures against raw result files.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-09-AC-06 — Nodes-visited metric is recorded per query

**Requirement:** For each R-tree query during the benchmark, the nodes-visited count is
recorded and included in the raw results.  
**Verification:** Check raw result CSV for nodes-visited column.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

### GATE-09-AC-07 — Compilation succeeds with required flags

**Requirement:** `benchmarks/benchmark_main.cpp` compiles without errors or warnings.  
**Verification:** Compile output; zero warnings.  
**Status:** NOT TESTED  
**Evidence:** [To be populated]

---

## Actual Evidence and Test Results

*To be populated after implementation. Raw result files will be in `docs/reports/` or `benchmarks/results/`.*

---

## Independent Reviewer Findings

| Criterion | Reviewer Status | Evidence |
|-----------|----------------|---------|
| GATE-09-AC-01 | NOT TESTED | — |
| GATE-09-AC-02 | NOT TESTED | — |
| GATE-09-AC-03 | NOT TESTED | — |
| GATE-09-AC-04 | NOT TESTED | — |
| GATE-09-AC-05 | NOT TESTED | — |
| GATE-09-AC-06 | NOT TESTED | — |
| GATE-09-AC-07 | NOT TESTED | — |

---

## Final Decision

**Gate status:** OPEN  

## Owner Approval Record

| Action | Owner | Date | Notes |
|--------|-------|------|-------|
| Plan approved | PENDING | — | OD-004 (benchmark thresholds and dataset sizes) must be resolved first |
| Gate PASS approved | PENDING | — | — |
