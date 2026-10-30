---
name: agent-models
description: Which model writes tests and which reviews fixes when work is split across subagents
type: feedback
---

Split per fix (set 2026-10-30): a **Haiku** subagent writes the failing tests, a **Sonnet**
subagent reviews the fix. If handing tests to a subagent costs more than it saves (small,
tightly coupled fixes where the briefing is longer than the test), the main **Opus** session
writes the tests itself and Sonnet still reviews. Deployment targets a new server and is set
aside until the user brings it up.

**Why:** the user wants cheaper models on mechanical work and an independent reviewer.
**How to apply:** every fix in [fix-lifecycle](fix-lifecycle.md); pass `model` on the Agent call.
