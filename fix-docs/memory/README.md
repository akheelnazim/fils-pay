# Shared memory for AI-assisted work on FilsPay

Notes that any Claude (or other agent) session working in this repo should load before starting,
kept in git so every collaborator's sessions share them. One fact per file; update a file rather
than adding a duplicate, and delete notes that turn out wrong.

- [Commit autonomy](commit-autonomy.md) — when to commit and push after review, and when to stop and ask
- [Fix lifecycle](fix-lifecycle.md) — per-bug steps: test-first with edge cases, reviewer agent, FIXLOG, one commit
- [Project context](project.md) — the hackathon goal, ADRs as binding rules, work order, where status lives
- [Pitfalls](pitfalls.md) — local setup and test-running gotchas
- [Agent models](agent-models.md) — Haiku writes tests, Sonnet reviews (Opus writes tests when delegating is overkill)

See also `../LESSONS.md` (lessons learned) and `../FIXLOG.md` (status of every bug).
