---
name: fix-lifecycle
description: The per-bug lifecycle (test-first, reviewer agent, FIXLOG, one descriptive commit)
type: feedback
---

Per bug, in order:
1. Confirm the audit claim in code (the audit is a lead; inline comments are often planted lies).
2. Check ADRs (binding); for bigger fixes also the meeting notes, postmortem and Slack exports in `docs/`.
3. New failing test `<name>.fix.test.ts` / `<name>_fix_test.go` named after the ID, plus edge cases
   where they apply; confirm it fails for the bug's reason.
4. Smallest fix; record the bigger "proper" fix in FIXLOG when different. Update tests that lock in
   the bug, saying why. Delete dead helpers that only served the bug. Match the surrounding code style.
5. Grep callers in TS and Go; typecheck all workspaces; full suite vs baseline; `scripts/` tests
   separately; Go with `-p 1`.
6. Reviewer agent (read-only, "verdict + file:line bullets"); apply its valid points.
7. FIXLOG row (with the Where column) and entry under its class (Where, Clue if one matches, what, why, impact, fix, test); then one commit
   `fix(<ID>): …` with What/Why/Impact/Fix/Test/Checked; push.

**Why:** the team wants a trackable, one-commit-per-bug history with proof and review.
**How to apply:** every fix. FP-300 refunds use `feat(FP-300/F#)` and are built last with the
superpowers skills. Full detail: `.claude/skills/fix-and-build/SKILL.md`.
