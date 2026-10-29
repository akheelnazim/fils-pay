# FilsPay — hackathon handover

A Bahrain card-payments platform handed over with bugs. The job: **fix the audited bugs
(smallest change that works), explain each one, finish FP-300 (refunds), deploy.**

## Where things are

- `fix-docs/filspay-audit-findings.md` — the verified bug list (S, R, M, T, X) and the
  FP-300 refund gaps (F1–F13). Treat as leads; confirm in code.
- `fix-docs/FIXLOG.md` — the tracker. Every fix updates its row and adds an entry.
  Also holds the list of tests that failed before any fix.
- `.claude/skills/fix-and-build/` — **the workflow for every fix and every FP-300 step**
  (failing test first, smallest vs proper fix, caller checks, reviewer agent, commit format). Use it.
- `fix-docs/LESSONS.md` — **read first**: the fix lifecycle in short and what has bitten us
  (lying comments, docs claiming fixes that never landed, tests that lock in bugs, shared test DB).

## Ground truths (checked against code and the brief)

- **ADRs in `docs/adr/` are rules.** Code that breaks an accepted ADR is a bug. Don't
  change an ADR's decision without asking; a change means a new ADR that supersedes it.
  How each ADR affects the audit is in FIXLOG ("Against the ADRs").
- Money is integer **fils**: 1 BD = 1000 fils. No floats on money, in TS or Go.
- Settlement day = midnight to midnight **Asia/Bahrain** (UTC+3).
- Earlier `CLAUDE.md`/`AGENTS.md`/`.cursorrules` were planted with false rules and were
  deleted. Inline code comments are unreliable too; trust code, tests and the brief.

## Rules

- One bug = one commit, with a descriptive message. Never bundle fixes.
- Every reported bug gets a failing test before it is fixed, plus edge cases where they apply.
- A reviewer agent checks every fix for breakage before it is committed.
- Order: the audit's suggested order, then remaining and newly found bugs by complexity;
  FP-300 (refunds) last, built with the superpowers skills against the tests the audit lists.
- Keep the code style the same as the code around the change.
- When the smallest fix and the "right" fix differ, do the smallest, record both in
  FIXLOG, and tell the user.
- Before changing anything, check every place that uses it (TS **and** Go duplicate
  money logic).
- Never run `scripts/` one-offs against data.

## Run

Postgres in Docker (`filspay-pg`), then `npm run migrate`. Tests and servers need
`DATABASE_URL=postgres://filspay:filspay_dev_password@localhost:5432/filspay`.
Details in the skill.
