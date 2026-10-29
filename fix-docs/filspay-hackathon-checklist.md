# FilsPay Handover — Hackathon Checklist

Oct 29, 2026

## How to use this

Every clue from the four evidence sheets is below as a checkbox, grouped by source, with my guess at the cause, where to look and the smallest fix. The guesses are written before seeing the code, so treat them as leads to confirm, not answers. Several clues describe the same bug from two angles; those are cross-linked so you fix and explain them once.

Suggested order, biggest money and security impact first:

1. Read `docs/ARCHITECTURE.md`, `docs/HANDOVER.md` and every ADR. Note any ADR the code breaks.
2. Security holes: OTP bypass, cross-merchant link cancel (IDOR), admin role checks, webhook signature checks, expired link paid.
3. Money-out races: concurrent refunds, refund more than charged, payment link charged twice, duplicate payouts.
4. Money rounding: CSV import 10x, scheme over-count, split remainder, fee 245 vs 225bps.
5. Settlement correctness: 3am close, test merchants in the real run, MDR touching closed batches, balance recalc.
6. FP-300 missing feature, then deploy. Leave at least 1.5 hours for the deploy.

Golden rule from the brief: smallest change that works, and a written note per bug (what, why, what it breaks). Do not run the March sweep script or any other one-off script against data to "test" it.

## Rules of the game

FilsPay is a Bahrain payment app: it signs up shops, takes card payments and pays shops out. All money is Bahraini Dinar, and 1 BD = 1000 fils.

**The four jobs**

- [ ] 01 Audit: find security holes, money bugs and anything that breaks
- [ ] 02 Fix: each bug with the smallest change that works
- [ ] 03 Explain: a short note per bug saying what is wrong, why, and what it breaks
- [ ] 04 Build: finish the missing feature (FP-300) and host it on Dilmune Cloud

**Scoring**

- Bigger bugs score more points.
- Clear explanations score more; explaining *why* beats just spotting it.
- A small fix that works beats a big rewrite.
- Implied: nothing else may break, so run existing tests before and after each fix.

**Ground truths the code must follow**

- ADRs in `docs/adr/` are the rules. Any code that disagrees with an ADR is a bug.
- ADR-0001: whole fils only, never decimals. Any float, `parseFloat`, `toFixed`, `float64` or `NUMERIC` with decimals on a money path is suspect.
- Settlement closes every day at midnight Bahrain time (UTC+3), which is 21:00 UTC the previous day.
- `docker compose up` in `ops/` starts everything locally.

**Repo map**

| Path | What it is |
| --- | --- |
| `apps/api/` | TypeScript/Fastify API: auth, payments, webhooks, admin |
| `apps/settlement/` | Go daemon: batch close, scheme export, splits, payouts |
| `apps/reporting/` | TypeScript consumer: outbox events to rollups |
| `apps/web/` | React hosted checkout |
| `apps/admin/` | React admin console |
| `packages/money/` | Shared integer-fils arithmetic |
| `packages/events/` | Outbox event types |
| `db/migrations/` | Postgres schema, numbered 0001 to 0072 |
| `scripts/` | One-off operational scripts |
| `ops/` | Docker compose, env files |
| `docs/` | Architecture, ADRs, runbook, handover notes |

Two languages handle money (TypeScript and Go). Expect bugs where one side reimplements `packages/money` instead of using it.

## Bugs: filed tickets and incidents

Seven filed items, from the support sheet. Four of them are race conditions, so learn the two fix patterns once: an atomic conditional `UPDATE ... WHERE state = 'x' RETURNING`, or `SELECT ... FOR UPDATE` inside a transaction, plus a unique constraint as the backstop.

- [ ] **FP-187 Payment link paid after expiry** (security, money)
  - Clue: the link showed "expired" but payment went through; checkout sends something the server shouldn't trust.
  - Hypothesis: the server trusts a field from `apps/web` (an `expired` flag, `expires_at`, or the amount) instead of re-reading the link from the DB. Or the expiry check compares against the client's clock or uses `>` where it needs `>=`.
  - Look in: the pay-link payment route in `apps/api`, and the checkout request body in `apps/web`.
  - Fix: load the link server-side and reject if `now() >= expires_at` (use the DB clock). Ignore client-sent expiry and amount.
- [ ] **FP-201 Duplicate notes on acquirer callbacks** (REOPENED)
  - Clue: the bank sent the same callback twice and two identical notes were saved; the 1.9.0 postmortem says fixed, it wasn't.
  - Hypothesis: dedupe is check-then-insert (a race), or the unique index covers the wrong columns (e.g. includes `received_at`), or a later migration dropped or never created it.
  - Look in: the callback handler, and migrations around the 1.9.0 fix for the index.
  - Fix: unique constraint on `(payment_id, acquirer_event_id)` plus `INSERT ... ON CONFLICT DO NOTHING`. Explain why the 1.9.0 fix didn't work; that earns the "why" points.
- [ ] **FP-203 Balance cache wrong after admin action**
  - Same bug as Finance item 4 (135K to 7K). See there.
- [ ] **FP-209 Concurrent refund: double money out**
  - Clue: two simultaneous refunds both succeeded; normal payments don't have this.
  - Hypothesis: payments are protected by an idempotency key or a row lock; refunds read "refundable remaining" then insert, with no lock (check-then-act).
  - Look in: the refund route vs the payment route in `apps/api`; compare how each locks.
  - Fix: copy the payment path's protection. Either `SELECT ... FOR UPDATE` on the payment row in the same transaction, or one atomic `UPDATE payments SET refunded = refunded + $x WHERE id = $1 AND refunded + $x <= captured RETURNING`.
  - Related: "can you refund more than charged?" (unfiled list). Likely the same check compares against the authorised amount, ignores earlier partial refunds, or uses `<=` vs `<` wrongly.
- [ ] **FP-240 Webhook signatures rejected by merchants** (security)
  - Clue: the signer and the sender disagree on what the message looks like; the incoming check also has problems.
  - Hypothesis, outgoing: the signer signs `JSON.stringify(obj)` once and the sender serialises again (different key order or spacing), or the timestamp in the signed string differs from the header.
  - Hypothesis, incoming: verifies against the re-serialised parsed body, not the raw bytes; compares with `===` instead of `crypto.timingSafeEqual`; no timestamp tolerance, so replays work; hex vs base64 mix-up.
  - Fix: serialise once, sign those exact bytes, send the same bytes. Incoming: raw body, constant-time compare with a length check, reject old timestamps.
  - Related: "key rotation flow doesn't do what you'd expect" (unfiled list).
- [ ] **INCIDENT 2026-05-14 Payment link charged twice**
  - Clue: a slow payment let a second buyer use the same link before the first finished; code comment says "this IS reachable".
  - Hypothesis: the code checks `status = 'open'`, calls the acquirer, then marks it paid. The gap between check and mark is the race. Someone wrote that comment next to it and left it.
  - Look in: search the repo for `IS reachable`.
  - Fix: claim the link atomically before charging: `UPDATE payment_links SET status = 'processing' WHERE id = $1 AND status = 'open' RETURNING id`. No row back means someone else has it. Release it on failure. A partial unique index on successful payments per single-use link is a good backstop.
- [ ] **INCIDENT 2026-08-21 Duplicate payout notifications**
  - Clue: shops got two "payout on the way" messages; two processes both thought they were first.
  - Hypothesis: two settlement workers read `notified = false`, both send, both set true.
  - Look in: payout notification code in `apps/settlement` (Go), or the outbox publisher.
  - Fix: `UPDATE payouts SET notified_at = now() WHERE id = $1 AND notified_at IS NULL` and only send if one row changed. Or `FOR UPDATE SKIP LOCKED` when picking work, or a unique outbox key per payout event.

## Bugs: finance reconciliation (Fatima's list)

Seven items from the Sep 17 reconciliation review. Most are rounding or integer-division bugs that break ADR-0001 (whole fils only).

- [ ] **1. Scheme statement always a few fils higher, never lower**
  - Hypothesis: the scheme export rounds *each line* up (`math.Ceil`) or half-up and then sums, while the ledger sums first. "Always over, never under" points at ceiling or a float that lands on x.5 and rounds up. A `float64` conversion in Go is a prime suspect.
  - Look in: `apps/settlement` scheme export; check whether it uses `packages/money`'s rule or its own.
  - Fix: use the same integer rounding rule as the ledger (sum in fils, round once, or the rule the ADR states).
- [ ] **2. March sweep script ran twice on staging, gap doubled**
  - Hypothesis: the script is not idempotent; it posts a correcting entry without checking whether it was already posted. The log only shows one timestamp because it opens the log in overwrite mode (`'w'` / `O_TRUNC`) instead of append.
  - Look in: `scripts/` for the March or Q1 sweep.
  - Fix: add a guard (unique reference on the sweep entry, or check-before-post in one transaction) and append to the log. Do NOT run it. Explain how to tell from the ledger if production ran it twice (count entries with its reference).
- [ ] **3. Delta Marketplace split payouts: three children don't add up to the parent** (flagged "!!")
  - Hypothesis: integer division `total / 3` per child drops the remainder (e.g. 1000 fils split 3 ways = 333 x 3 = 999, 1 fils vanishes). Or per-child percentages are rounded down separately. The lost fils never get posted, which is why Fatima can't find them.
  - Look in: splits in `apps/settlement`; check for an `allocate` function in `packages/money` that Go doesn't use.
  - Fix: allocate the remainder (largest-remainder method, or give the remainder to the last child) so children always sum to the parent. Same bug as "settlement splits always a few fils short".
- [ ] **4. "Recalculate cached balances" turned Alpha Retail's 135K into 7K; CLI rebuild is correct** (also FP-203)
  - Hypothesis: the button and the CLI read from different places. The button likely sums a partial source: only one page (`LIMIT`), only the current batch or day, only reporting rollups instead of the ledger, or only one entry type.
  - Look in: the admin recalc endpoint in `apps/api` vs the CLI rebuild; diff their queries.
  - Fix: make the button call the CLI's function (one source of truth, the ledger). Also check the endpoint's role check and what it does to test merchants (both on the unfiled list).
- [ ] **5. MDR recalculation changed already-paid batches**
  - Hypothesis: the `WHERE` clause has an `AND`/`OR` precedence bug, e.g. `status = 'open' AND a OR b` matches closed rows via `b`. Or the filter names a status that doesn't exist (`'paid'` vs `'paid_out'`), or it filters on the wrong table in a join.
  - Look in: MDR recalc in `apps/settlement` or `apps/api`.
  - Fix: parenthesise or tighten the filter to open batches only; optionally add a DB check or trigger that blocks updates to closed batches.
- [ ] **6. Dashboard shows 245bps, payments charge 225bps**
  - Hypothesis: two fee tables (or rows) with different effective dates. The dashboard picks the "latest" by `created_at` (the backfill row is newest) while payments pick by `effective_from <= now()`. Or the dashboard reads a future-dated rate.
  - Look in: fee lookup in the payment path vs the merchant dashboard endpoint; the backfill migration.
  - Fix: both use the same lookup: latest `effective_from <= now()`. Decide which number is correct from the ADR or contract and say so in the note.
- [ ] **7. CSV import reads BD wrong: 4.755 shows 4.750, 4.75 shows 0.475** (flagged "10x??")
  - Hypothesis: two faults. (a) The fraction isn't right-padded to 3 digits, so "4.75" becomes 4 and "75" glued as 475 fils instead of 4750. (b) Something treats amounts as 2-decimal currency (cents logic, or `parseFloat(...).toFixed(2)`), dropping the third decimal from 4.755.
  - Look in: the manual-changes CSV import in `apps/api`; check whether it bypasses `packages/money`.
  - Fix: parse as a string: split on `.`, reject more than 3 fraction digits, `padEnd(3, '0')`, then `whole * 1000 + frac`. Test 4.755, 4.75, 4.7, 4, 0.005, negatives.

**Group-chat items (unchecked by Fatima)**

- [ ] **"Daily close runs at 3am local, not midnight"**
  - Hypothesis: your guess is right. The schedule or cutoff is midnight UTC, which is 03:00 in Bahrain (UTC+3). Correct is 21:00 UTC. Payments between 21:00 and 24:00 UTC land in the wrong day's batch.
  - Second suspect: Go's `time.LoadLocation("Asia/Bahrain")` fails in a slim Docker image with no tzdata and the code falls back to UTC silently. This can work on a laptop and break on Dilmune Cloud.
  - Fix: compute the cutoff in `Asia/Bahrain` and add `import _ "time/tzdata"` (or install tzdata). Also matches "daily close timing doesn't match the docs".
- [ ] **"Lifetime payout estimate drifts for high-volume merchants"**
  - Hypothesis: the estimate accumulates in floating point (JS `Number` or `float64`), or Postgres returns `SUM(bigint)` as a numeric string that gets `parseFloat`ed. Only big totals show the drift. Also check for `int32` / `INTEGER` columns overflowing near 2.1 billion fils (about 2.1M BD).
  - Fix: integer or `BigInt` math end to end.
- [ ] **"Test merchants keep showing up in the real settlement run"**
  - Hypothesis: the settlement query lacks `is_test = false`, or an admin tool (balance recalc, merchant update) rewrites `is_test` to its default `false`.
  - Fix: add the filter and stop the tool from touching the flag. See "what happens to test merchants when certain admin tools run?".
- [ ] **"Login works without entering the OTP code?"** (security)
  - Hypothesis: the OTP check only runs when a code is sent (`if (otp && !valid)`), or the new async verifier isn't `await`ed, so a Promise is always truthy. "The OTP implementation changed at some point" supports the second.
  - Also check: OTP expiry, reuse, attempt limits, constant-time compare.
  - Fix: require the OTP step and `await` the verifier.
- [ ] **"I cancelled merchant B's payment link from merchant A's dashboard"** (security, IDOR)
  - Hypothesis: the cancel route looks up the link by ID only, not by ID and the caller's merchant.
  - Fix: `WHERE id = $1 AND merchant_id = $2`; return 404 if no row. Check sibling routes (get, update, refund) for the same pattern.

## Unfiled suspicions (handwritten list)

Nine hunches with no ticket. Five overlap with items above; four are new.

- [ ] **Refund more than was charged?** Covered under FP-209.
- [ ] **Settlement splits always a few fils short.** Same as Finance item 3.
- [ ] **Some admin actions lack the right role checks** (security)
  - Hypothesis: some admin routes only check "logged in", not role; or the role comes from a client-controlled header or body; or the React admin hides the button but the API never checks.
  - Look in: every route under the admin prefix in `apps/api`; list which have the role `preHandler` and which don't. The balance-recalc and MDR-recalc endpoints are the first to check.
  - Fix: add the missing guard, one line per route.
- [ ] **Key rotation flow doesn't do what you'd expect** (security)
  - Hypothesis: after "rotate", the old webhook or API secret still signs or still verifies forever; or the new key is generated but not saved, or is returned for the wrong merchant.
  - Fix: new key signs immediately; old key accepted for a short grace period only, then revoked.
- [ ] **Daily close timing doesn't match the docs.** Same as the 3am item.
- [ ] **A reporting query is suspiciously slow**
  - Hypothesis: a missing index (check migrations), an N+1 loop, or a function on an indexed column (e.g. `date(created_at AT TIME ZONE ...)`) that stops the index being used. Run `EXPLAIN ANALYZE`.
  - Fix: add an index in a new migration (0073), or rewrite the filter as a range on the raw column.
- [ ] **What happens to test merchants when certain admin tools run?** Same as the test-merchant item.
- [ ] **OTP implementation changed; is it still safe?** Same as the OTP item; check git history for the change.
- [ ] **Has anyone tried uploading a really large export?** (availability)
  - Hypothesis: Fastify's `bodyLimit` raised very high or removed, and the upload is read fully into memory, so one big file takes the API down. Also check the filename for path traversal and the CSV for formula injection.
  - Fix: a sane `bodyLimit` and row cap, streaming parse.

## FP-300: finish the missing feature

The card doesn't name the feature; finding it is part of the task. It is high priority, requested by Product and never shipped. The note says it "touches everything".

**Done when (from the card)**

- [ ] Works from start to end through the API
- [ ] Money is right in the ledger, down to the fils
- [ ] Fees and payouts come out right
- [ ] The shop gets the right webhook
- [ ] Shows up right in the timeline, the reports and reconciliation
- [ ] App is live on Dilmune Cloud

**How to find it**

- [ ] Read `docs/HANDOVER.md` and look for any ADR marked Proposed or Draft.
- [ ] Search for `TODO`, `FIXME`, `not implemented`, `501`, and feature flags.
- [ ] Look in `packages/events/` for event types that nothing emits or consumes.
- [ ] Look in `db/migrations/` for tables or columns no code reads or writes, especially the last few migrations near 0072.
- [ ] Check the admin and web apps for buttons or pages wired to missing endpoints.

**Best guess**

The done-when list (ledger, fees, payouts, webhook, timeline, reports, reconciliation) fits a money-reversal feature: chargebacks/disputes, partial capture, or a payout reversal. Confirm from the repo before building.

**Build checklist once you know**

- [ ] API route with auth, merchant scoping and an idempotency key (avoid repeating the bugs above)
- [ ] Ledger entries in integer fils via `packages/money`, balanced (debits = credits)
- [ ] Fee handling: decide whether the fee is reversed, kept or charged, per ADR
- [ ] Payout impact: open batch only, never closed ones
- [ ] Outbox event in `packages/events`, consumed by reporting
- [ ] Merchant webhook, signed with the fixed signer
- [ ] Timeline entry for the payment
- [ ] Shows correctly in reports and reconciliation
- [ ] One end-to-end test that checks the fils totals

## Deploy to Dilmune Cloud

The sheets don't say how Dilmune Cloud works, so get the organisers' instructions first. The checklist below is platform-neutral, built from what the repo needs.

**Before deploying**

- [ ] Get Dilmune Cloud access, docs and limits from the organisers (containers? compose? managed Postgres?)
- [ ] Everything passes locally with `docker compose up` in `ops/`, plus the test suite
- [ ] Read `ops/` env files: list every variable each service needs
- [ ] Move secrets (DB password, webhook signing key, OTP secret, JWT secret) out of committed env files into platform secrets; generate fresh ones for production

**Services to run**

- [ ] Postgres (managed if offered), with backups on
- [ ] Run migrations 0001 to 0072 (plus any you added) in order, once
- [ ] `apps/api` (Fastify): listen on `0.0.0.0` and the platform's `PORT`, not `localhost`
- [ ] `apps/settlement` (Go daemon): exactly one instance, or the duplicate-payout race comes back
- [ ] `apps/reporting` consumer
- [ ] `apps/web` and `apps/admin`: build with the live API URL, not `localhost`

**Gotchas**

- [ ] Timezone: confirm the settlement container has tzdata or embeds it, or close runs at the wrong hour
- [ ] HTTPS on public URLs; CORS allows only the web and admin origins
- [ ] Admin console not open to the public, or at least behind working role checks
- [ ] Health check endpoint for the API

**Smoke test on the live URL**

- [ ] Login with OTP (and confirm login without OTP fails)
- [ ] Create a payment link, pay it, confirm it can't be paid twice or after expiry
- [ ] Run the FP-300 feature end to end; check ledger fils, fee, payout, webhook, timeline, report
- [ ] Note the live URLs and a test login for the judges

## Bug note template

One per bug, for the Explain step. Keep each to about five lines; the "Why" line is where the points are.

```markdown
### <ID> <short title>
- Where: <file:line>
- What's wrong: <one sentence>
- Why it happens: <root cause, e.g. check-then-act race between read and update>
- What it breaks: <who loses money / what leaks, with an example in fils>
- Fix: <the minimal change, N lines> · Test: <how you proved it>
- ADR broken: <ADR number, if any>
```
