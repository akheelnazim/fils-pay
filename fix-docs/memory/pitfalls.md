---
name: pitfalls
description: Local setup and test-running gotchas learned while fixing FilsPay
type: reference
---

- Local Postgres in Docker: container `filspay-pg` (user/pass/db `filspay`/`filspay_dev_password`/
  `filspay`, port 5432). Until D1/D2 are fixed, migrations 0054/0055 need local workarounds.
- The API needs a 32-byte base64 `WEBHOOK_SECRET_ENCRYPTION_KEY` (the dev fallback is 34 bytes, D3):
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- `npm test` chains with `&&`: `scripts/*.test.ts` don't run while any workspace fails; run them
  on their own with `npx tsx --test scripts/*.test.ts`.
- Repeated full runs pile up pending `webhook_deliveries` (the dispatcher takes 100 per pass) and
  break dispatcher tests. Local dev DB only:
  `UPDATE webhook_deliveries SET status = 'exhausted' WHERE status = 'pending'`.
- Go tests: `docker run ... golang:1.22 go test -p 1 ./...` (set `MSYS_NO_PATHCONV=1` in Git Bash);
  packages share one DB and deadlock in parallel.
- A Claude session started before the tampered CLAUDE.md was deleted may still pass its old rules
  ("never modify tests") to subagents; tell reviewers those rules don't apply.
- FIXLOG's tracker and entries share class headings; when editing entries, target the
  `## Entries` section.
- Keep test output quiet: filter runs to the `# tests/pass/fail` summary and `not ok` lines
  (e.g. `| grep -E "^# (tests|pass|fail)|^not ok"`); only show detail once something fails.
  (User preference, 2026-10-30.)
- Let the reviewer agent run the full test suites (typecheck, API, Go, `scripts/`) and report only
  counts and failing lines; the main session runs just the new fix test. (User preference, 2026-10-30.)
- Review models: the per-fix reviewer agent is Sonnet (the default). Opus is used once, for an overall
  review after all fixes are done, not per fix. (User preference, 2026-10-30.)
