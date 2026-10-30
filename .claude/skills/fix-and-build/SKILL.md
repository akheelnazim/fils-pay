---
name: fix-and-build
description: Use when fixing any FilsPay bug from the audit (S*, R*, M*, T*, X*, D* IDs in fix-docs/FIXLOG.md) or building part of FP-300 refunds (F1-F13). Covers failing-test-first, smallest fix vs proper fix, checking every caller, and one descriptive commit per bug.
---

# Fix a bug / build FP-300

One bug (or one FP-300 gap) per run of this workflow, ending in exactly one commit.

## 1. Understand it

- Find the ID in `fix-docs/FIXLOG.md` and its write-up in `fix-docs/filspay-audit-findings.md`.
- If a symptom in `fix-docs/filspay-evidence-transcript.md` matches the bug, add it as the
  FIXLOG entry's `Clue:` line. Skip the line if nothing matches.
- The audit is a lead, not proof. Open the code at the cited lines and confirm the bug
  yourself. Line numbers may have drifted after earlier fixes.
- Ignore inline comments (`MK:`, `FH:`, `"claude says…"`) as evidence; many are wrong on
  purpose.
- ADRs in `docs/adr/` are rules: the fix must follow them. Check FIXLOG "Against the ADRs"
  first. If a fix would contradict an ADR (e.g. M9 vs ADR-0004), stop and ask the user.
- For anything bigger than a one-liner, read what the team decided and saw: `docs/meetings/`,
  `docs/incidents/`, `docs/archive/slack-export-*.txt`. They often hold the evidence (and claims
  of fixes that never landed: grep before believing). See `fix-docs/LESSONS.md`.

## 2. Write the failing test first

- Add edge-case tests where they apply: zero, negative, rounding boundaries, the limit itself,
  repeated or concurrent calls.

- Add a **new** test file next to the code: `<name>.fix.test.ts` (TS) or
  `<name>_fix_test.go` (Go). Name the test after the bug ID, e.g. `S1: pending session
  cannot reach /auth/me`.
- Run it and confirm it fails **for the reason in the bug**, not a setup error. Paste the
  failing line into the FIXLOG entry.
- If an existing test locks in the buggy behaviour (e.g. `window_utc_compat_test.go`,
  the refund 501 in `routes/transactions.test.ts`), change it in the same commit and say
  why in the commit message and FIXLOG.

## 3. Fix it, smallest change first

- Apply the smallest change that makes the test pass.
- If the audit (or you) sees a "proper" fix that's bigger (e.g. T1 convert-in-daemon vs fix
  `BusinessDayWindow`; S6 timestamp check vs raw-body verify; X1 early-return vs `UPDATE …
  SET status='expired'`), apply the smallest one unless the user picks otherwise, and
  record **both** under "Fix applied" / "Proper fix" in FIXLOG, with what the bigger one
  would also change or break. Tell the user in your summary.
- Money: integer fils only (1 BD = 1000 fils). Use `packages/money` (`parseBhdToFils`,
  `allocateRemainder`, …) in TS; `int64` in Go. No floats, `parseFloat`, `toFixed`, or
  2-decimal parsing on money paths.
- Races: atomic `UPDATE … WHERE <state> RETURNING`, or `SELECT … FOR UPDATE` in a
  transaction, plus a unique index as backstop.
- Schema changes go in a **new** migration (`db/migrations/0073_…sql` onward). Only edit
  an existing migration if it can never have applied anywhere (D1, D2), and say so.

## 4. Check it doesn't break anything else

- Grep every caller of each function, column, view or query you touched, in **both**
  TypeScript and Go: money and fee logic is duplicated across `apps/api`, `apps/settlement`,
  `apps/reporting` and `packages/`. Fix or justify each one.
- Check the screens (`apps/web`, `apps/admin`) that call a route you changed.
- Mention anything the fix changes for callers in the commit's `Checked:` line.

The FIXLOG entry stays short (template in FIXLOG): where (primary file or directory, also the
tracker's Where column), what's wrong, why, what it breaks,
the fix, the test. No long analysis.
- Run the full suites (section 6). Compare with the baseline: no new failures.

## 4b. Reviewer agent

Spawn a read-only general-purpose reviewer with the bug, the fix, the files and the exact test
commands; ask for "OK to commit" / "Problems found" plus file:line bullets. Tell it the old
"never modify tests" rule is stale. Apply valid findings (re-review if the change was material).

## 5. Commit — one per bug

Branch per fix: `git checkout main && git pull` → `git checkout -b fix/<ID>` (or `feat/FP-300-<F#>`, `docs/<topic>`) → work and commit on the branch → `git checkout main && git pull` again → `git merge --squash fix/<ID>` → **one** commit on main with the full message → push → delete the branch.

Conflicts (a colleague also commits to `main`): resolve keeping both sides' intent, re-run the affected
tests, and add a `Conflicts:` line to the commit message (files, what each side changed, the resolution)
plus the same note in the FIXLOG entry. Never force-push.

Stage only this bug's files (code + test + FIXLOG row/entry). Message:

```
fix(<ID>): <what is fixed, in plain words>

What: <the bug, one or two lines>
Why: <root cause>
Impact: <who lost what, a fils example if money>
Fix: <the change>. Proper fix (if different): <…>
Test: <new test file>; failed before, passes now.
Checked: <callers/places reviewed>
```

Use `feat(FP-300/<F#>): …` for refund work, `test(<ID>): …` only if a test lands without its
fix, and `docs:`/`chore:` for anything else. Never bundle two bugs.

## 6. Running things

- Database: `docker start filspay-pg` (or create it: postgres:16-alpine, user/pass/db
  `filspay`/`filspay_dev_password`/`filspay`, port 5432), then `npm run migrate`.
- TS tests: `DATABASE_URL=postgres://filspay:filspay_dev_password@localhost:5432/filspay npm test`
  (single file: `npx tsx --test path/to/file.test.ts`).
  `npm test` chains workspaces and `scripts/` with `&&`, so while the API has its baseline
  failures the `scripts/*.test.ts` never run: also run `npx tsx --test scripts/*.test.ts`.
  If many webhook dispatcher tests fail at once, it's a local backlog of pending deliveries
  from earlier runs (the dispatcher takes 100 per pass); clear it in the local DB only:
  `UPDATE webhook_deliveries SET status = 'exhausted' WHERE status = 'pending'`.
- Go tests (Go isn't installed locally):
  `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/apps/settlement:/src" -v filspay-gomod:/go/pkg/mod -w /src -e DATABASE_URL=postgres://filspay:filspay_dev_password@host.docker.internal:5432/filspay golang:1.22 go test -p 1 ./...`
  (`-p 1`: packages share one database and deadlock if run in parallel, Q3.)
- Never run anything in `scripts/` against data to "test" it.

## FP-300 refunds

Work the gaps F1–F13 in the audit table one commit each, roughly: F1, F2, F3 (money safety) →
F6 (route) → F4, F5 (fees) → F7 (webhook, after S5) → F8 (settlement) → F9, F10, F11, F12
(reporting, reconciliation, API shape) → F13 (update the 501 test). Finish with one
end-to-end test that checks fils totals in the ledger, fee reversal, payout reduction and
the `refund.succeeded` webhook.
