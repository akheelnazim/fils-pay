---
name: commit-autonomy
description: When to commit and push a fix without asking, and when to stop for a human
type: feedback
---

One commit per fix, after a reviewer agent clears it: work on a `fix/<ID>` branch cut from a freshly
pulled main, pull main again, squash-merge it into main as that one commit, then push. When a human has delegated a batch
("go on", "fix everything", "no need to wait for my approval"), commit and push each fix without
waiting; otherwise leave changes uncommitted and show the diff plus the proposed message.
Always stop and ask before: a fix that would contradict an ADR, or irreversible actions outside the
repo (history rewrite, force-push, secret rotation).

**Why:** the team reviewed early commits by hand, then delegated batches explicitly.
**How to apply:** check whether the current request delegated commits; follow [fix-lifecycle](fix-lifecycle.md).
