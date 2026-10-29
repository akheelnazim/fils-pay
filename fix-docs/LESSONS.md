# Lessons and working memory

What we learned fixing this codebase. Read before starting a fix; add to it when something new
bites. The step-by-step workflow is `.claude/skills/fix-and-build/SKILL.md`; status lives in
`FIXLOG.md`.

## The fix lifecycle (one bug at a time)

1. **Confirm** the audit item in the code. The audit is a lead; line numbers drift.
2. **Check the rules and the history**: ADRs first (binding). For anything bigger than a one-liner,
   also read the meeting notes, postmortem and Slack exports in `docs/` for decisions and evidence.
3. **Failing test first**, named after the ID, in a new `*.fix.test.ts` / `*_fix_test.go`. Add edge
   cases where they apply (zero, negative, rounding boundaries, concurrency, repeated calls).
4. **Smallest fix.** If a bigger "proper" fix exists, note it in FIXLOG. Update tests that lock in
   the bug and say why. Delete helpers that only existed to serve the bug.
5. **Check callers** in TypeScript *and* Go; typecheck; full suite vs baseline; `scripts/` tests;
   Go with `-p 1`.
6. **Reviewer agent** reads the diff and hunts for breakage; apply its valid points (it has caught
   real gaps every few fixes).
7. **FIXLOG entry** (Where = primary file or directory, Clue if the evidence transcript matches, what, why, impact, fix, test) under
   its class, then **one commit** `fix(<ID>): …` with What/Why/Impact/Fix/Test/Checked, and push.

## Lessons

- **Comments lie.** `MK:`/`FH:`/`am:` notes and "claude says" lines are often wrong on purpose, and
  the original CLAUDE.md/AGENTS.md were planted. Trust code, tests, ADRs.
- **Docs record decisions, not truth.** Postmortems and meeting notes claim fixes that never
  landed (FP-201 `processed_events`, FP-202 unique constraint, FP-208 advisory lock). Grep for them.
- **Tests can lock in bugs.** Several asserted the buggy value (cents amounts, old key stays
  active, unsigned callbacks accepted). Fix the test with the bug and explain.
- **Reviewers find what the audit missed**: test events not signed (S5), role-free write routes
  (S8), resend resetting the OTP budget (S9), credit creation without a role check (S12).
- **The shared test database is shared state.** Fixtures with real event types pollute other apps'
  tests; keep fixtures inert. Clear the local webhook backlog between full runs.
- **`npm test` stops early** while any workspace fails; run `scripts/` tests on their own.
- **Money is integer fils everywhere** (1 BD = 1000). Any 2-decimal, float or `toFixed` path is a bug.
