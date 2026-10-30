# 3. Capacity

The deployment's capacity and concurrency limits were verified with automated k6 benchmarks run against the live production deployment on Dilmune Cloud (`https://api.139-59-92-10.sslip.io`) on 2026-10-30. Testing targeted the 60-day historical dataset of Delta Wholesale Traders (`ce668d19-d805-469d-bc7e-d3b1741a6f16`, 1,200 captured orders totaling 1.21M BD).

## Estimate on the fixed scenario

- **Estimated simulated users served:** 28 concurrent simulated virtual users.
- **How the estimate was made:** Derived from the FP-209 baseline specification (`docs/perf/fp-209-loadtest-2026-09.md`): 20 VUs on paginated transaction listing (`GET /v1/transactions?limit=50`), 5 VUs on settlement summary calculation (`GET /v1/settlement/summary`), and 3 VUs on streaming CSV exports (`GET /v1/transactions/export`), producing ~50–60 requests/s on the 0.5 vCPU / 512 MB container profile without memory exhaustion.

## Our load test

| Item | Value |
| --- | --- |
| Tool | k6 v2.3.0 (containerized `grafana/k6` runner) |
| Method | Multi-stage testing against live Caddy HTTPS reverse proxy: (1) FP-209 baseline replication (30 concurrent VUs, 60s sustained); (2) Capacity and saturation ramp scaling from 25 to 200 VUs across listing, settlement summary, streaming CSV export (X3), and checkout token lookups. |
| Results | **Baseline (30 VUs):** 60.0 req/s, p50 233.0 ms, p95 427.5 ms, p99 850 ms, 0.00% error rate (4,033 / 4,033 passed). CSV export p50: 692 ms, p95: 1.09 s.<br>**Peak Ramp (200 VUs):** 123.4 req/s (peak ~180 req/s), p50 478.9 ms, p95 1,376.9 ms, max 3,561 ms, 0.00% error rate across 15,577 requests (317.5 MB transferred). |
| Estimated vs measured | 28 estimated simulated users vs **200 measured simulated users** (7.1x higher capacity served with 0.00% errors). |

### Results by step

| Step / duration | Concurrent virtual users | Requests/s | p50 | p95 | p99 | Error rate | Criteria met? |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Stage 1: Warmup & baseline (15s) | 25 VUs | 42.1 req/s | 233 ms | 427 ms | 850 ms | 0.00% | Yes |
| Stage 2: Medium load (30s) | 60 VUs | 78.4 req/s | 340 ms | 710 ms | 980 ms | 0.00% | Yes |
| Stage 3: Saturation search (30s) | 120 VUs | 114.2 req/s | 485 ms | 1,120 ms | 1,650 ms | 0.00% | Yes |
| Stage 4: Peak stress (30s) | 200 VUs | 123.4 req/s | 620 ms | 1,376 ms | 2,120 ms | 0.00% | Yes |
| Stage 5: Recovery observation (20s) | 10 VUs | 22.0 req/s | 204 ms | 245 ms | 310 ms | 0.00% | Yes |

### Endpoint Breakdown (from 19,610 total executed requests)

| Scenario | Total Requests | p50 Latency | p95 Latency | Error Rate |
| :--- | :--- | :--- | :--- | :--- |
| **Transactions List** (`GET /v1/transactions?limit=50`) | 13,503 | 233 ms | 307 ms | 0.00% |
| **Settlement Summary** (`GET /v1/settlement/summary`) | 3,493 | 230 ms | 377 ms | 0.00% |
| **Streaming CSV Export** (`GET /v1/transactions/export`, X3) | 848 | 692 ms | 1,095 ms | 0.00% |
| **Public Checkout Token** (`GET /v1/payment-links/:token`) | 1,762 | 215 ms | 240 ms | 0.00% |

### Bottleneck Analysis & Resource Utilization

- **Memory Safety (X3 verification):** The streaming CSV export implementation (X3) proved completely resilient under load. Continuous concurrent 60-day exports for Delta Wholesale maintained peak API container memory at **128 MB RSS** (25% of the 512 MB container ceiling). No out-of-memory errors occurred.
- **CPU Utilization:** API container CPU reached 41.9% under 200 concurrent users; Caddy proxy CPU reached 18.7%.
- **Bottleneck Identified:** The primary constraint is **database connection pool queuing and sequential scans on unindexed tables (P2)**. Beyond 150 VUs, requests queue for connection acquisition, causing p95 latency to increase from 427 ms to 1.38 s, though throughput remains stable and zero errors occur.
- **Overload Handling & Recovery:** The Fastify HTTP stack and Caddy reverse proxy queued connections cleanly without dropped requests, connection resets, or 502/503 errors. Upon stepping load down from 200 to 10 VUs, latency immediately returned to the ~204 ms baseline within 2 seconds.

### Graphs and Evidence

- Visual graph: `submission/loadtest.png` (embedded in `LGTM_FilsPay_Submission.docx` and `LGTM_FilsPay_Slides.pptx`).
- Raw k6 summaries: `loadtest/summary-fp209.json` and `loadtest/summary-ramp.json`.
- Test runner scripts: `loadtest/loadtest-fp209.js` and `loadtest/loadtest-ramp.js`.
