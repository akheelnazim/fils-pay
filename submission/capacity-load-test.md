# 3. Capacity

The current deployment's capacity has not yet been verified from a completed load-test result. The load test is being prepared separately; fill in this section from the completed run and its recorded measurements. Do not treat the number of configured virtual users as proof that all of them were served successfully.

## Estimate on the fixed scenario

- **Estimated simulated users served:** Pending.
- **How the estimate was made:** Pending the agreed workload, target response times and error threshold. State the assumptions, calculation and data source; distinguish concurrent virtual users from throughput and real-world users.

## Our load test

| Item | Value |
| --- | --- |
| Tool | k6 (test scripts prepared; version and execution environment to be recorded with results). |
| Method | Pending final run: document the scenario, ramp or stages, duration, endpoint mix, think times, dataset size, target deployment and whether requests succeeded. |
| Results | Pending: requests/s, p50/p95/p99 latency and error rate for each step and, where available, each endpoint. |
| Estimated vs measured | Pending: compare the estimate with the highest measured concurrency that meets the stated latency and error criteria. |

### Results by step

| Step / duration | Concurrent virtual users | Requests/s | p50 | p95 | p99 | Error rate | Criteria met? |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Pending | — | — | — | — | — | — | — |

### Graphs and evidence

Pending: add the completed load-test graphs here and in the appendix, with links to the raw output and the script or version used. Record the test date and application revision. Explain any generator-side limits and failures before drawing a capacity conclusion.

An earlier report in `docs/perf/fp-209-loadtest-2026-09.md` describes a different September test on a different setup. It is historical context, not a measurement of this deployment; its claims and cited raw output have not been verified for this submission.
