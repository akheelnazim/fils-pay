---
name: project
description: Hackathon goal, sources of truth, decisions already made, and work order
type: project
---

Hackathon handover (started 2026-10-29): fix the audited bugs with the smallest working change,
explain each, then build FP-300 refunds (last), then deploy.

- Sources: `fix-docs/filspay-audit-findings.md` (IDs S/R/M/T/X, F1-F13), `FIXLOG.md` (tracker
  grouped by class, plus D deploy and Q test-suite), the evidence transcript (clues), `LESSONS.md`.
- ADRs are binding: the code follows the ADRs, never the reverse (team decision). So M9 keeps
  ADR-0004's settled-data rebuild path; migrations 0054-0056 move to 0073+ (ADR-0005); the March
  script's UTC month is correct (ADR-0003).
- Order: the audit's suggested order, then remaining and newly found bugs by complexity, then FP-300.

**How to apply:** the FIXLOG tracker is the live status; read it before starting.
