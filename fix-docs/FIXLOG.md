# Fix log

One row per bug. One bug = one commit (test + fix + this log), made on its own branch and
squash-merged into an up-to-date `main`. IDs come from
`filspay-audit-findings.md`. Classes: S security · R races · M money · T timing · X scripts/other · D deploy · F FP-300 · Q test suite.
Status: `open` · `test` (failing test added) ·
`fixed` · `wontfix` (say why).

## Tracker

Grouped by bug class (prefix = audit section; new finds go at the end of their class).

### Security (S)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| S1 | Login works without OTP | `apps/api/src/auth/sessions.ts` | fixed | `fix(S1)` |
| S2 | OTP/session issued to another merchant's user | `apps/api/src/routes/auth.ts` | fixed | `fix(S2)` |
| S3 | Cancel another merchant's payment link (IDOR) | `apps/api/src/paymentLinks/cancel.ts` | fixed | `fix(S3)` |
| S4 | Expired payment link still payable (FP-187) | `apps/api/src/paymentLinks/pay.ts` | fixed | `fix(S4)` |
| S5 | Outbound webhook signature mismatch (FP-240) | `apps/api/src/webhooks/dispatcher.ts` | fixed | `fix(S5)` |
| S6 | Inbound acquirer signature check weak (FP-240) | `apps/api/src/webhooks/inboundVerify.ts` | fixed | `fix(S6)` |
| S7 | Rotated API key keeps working | `apps/api/src/admin/apiKeys.ts` | fixed | `fix(S7)` |
| S8 | Impersonation gets write access | `apps/api/src/admin/impersonation.ts` | fixed | `fix(S8)` |
| S9 | Weak, brute-forceable OTP | `apps/api/src/lib/random.ts` | fixed | `fix(S9)` |
| S10 | Credit self-approval compares display name | `apps/api/src/admin/creditApproval.ts` | fixed | `fix(S10)` |
| S11 | Secret committed in `ops/.env.docker` | `ops/.env.docker` | fixed (rotate still needed) | `fix(S11)` |
| S12 | Any admin (incl. support) can issue merchant credits; no role check on create | `apps/api/src/routes/adminCredits.ts` | fixed | `fix(S12)` |

### Races and duplicates (R)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| R1 | Payment link charged twice (2026-05-14) | `apps/api/src/paymentLinks/pay.ts` | fixed | `fix(R1)` |
| R2 | Duplicate acquirer callback notes (FP-201) | `apps/api/src/acquirer/callbacks.ts` | on hold (fix proposed) | |
| R3 | Duplicate payout notifications (2026-08-21) | `apps/settlement/internal/settlement/payout_notify.go` | on hold (fix proposed) | |
| R5 | Adjustment CSV importable twice | open | |

### Money correctness (M)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| M1 | CSV import reads BD as cents (10x) | `apps/api/src/admin/adjustmentCsvParsing.ts` | fixed | `fix(M1)` |
| M2 | Scheme statement always a few fils high | `apps/settlement/internal/settlement/batch.go` | fixed | `fix(M2)` |
| M3 | Split payouts short every batch | `apps/settlement/internal/splits/allocate.go` | fixed | `fix(M3)` |
| M4 | Net payout computed in float32 | `apps/settlement/internal/settlement/payable.go` | fixed | `fix(M4)` |
| M5 | Lifetime payout estimate drifts (REAL) | open | |
| M6 | Platform volume counter overflows int32 | `apps/settlement/internal/settlement/platform_volume.go` | fixed | `fix(M6)` |
| M7 | Dashboard fee 245 vs charged 225 bps | `apps/api/src/fees/currentFeeScheduleDisplay.ts` | fixed | `fix(M7)` |
| M8 | MDR recalculation rewrites paid batches | `apps/settlement/internal/settlement/recalculate_mdr.go` | fixed | `fix(M8)` |
| M9 | Recalculate balances button 135K → 7K (FP-203) | `apps/settlement/internal/ledger/refresh.go` | fixed | `fix(M9)` |
| M10 | Settlement summary double-counts multi-capture | open | |
| M11 | Reconciliation pending uses `merchants.mdr_bps` | open | |
| M12 | `parsePromotionalDiscountFils` uses float × 100 | open | |
| M13 | Reconciliation pending fee uses float rates (`fees/estimate.ts`) | open | |
| M14 | Scheme residue never journaled (ADR-0002) | open | |
| M15 | Balance rebuild can overwrite a concurrent batch-close cache update (YA's TODO in rebuild.go) | open | |

### Settlement timing and test merchants (T)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| T1 | Daily close runs 03:00 Bahrain, not midnight | `apps/settlement/internal/scheduler/daemon.go` | fixed | `fix(T1)` |
| T2 | Admin tool flips test merchants into settlement | `apps/api/src/routes/adminMerchantsRecompute.ts` | fixed | `fix(T2)` |
| T3 | Recompute statuses reports `openAuthorizations` as always 0 (its query excludes `authorized` rows) | `apps/api/src/admin/transactionStatusRecompute.ts` | open | |

### Scripts and other (X)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| X1 | `expire_holds.ts` can delete every hold | `scripts/expire_holds.ts` | fixed | `fix(X1)` |
| X2 | March sweep script not idempotent | `scripts/reconcile_march.ts` | fixed | `fix(X2)` |
| X3 | Large export can OOM the API | `apps/api/src/routes/transactions.ts` | fixed | `fix(X3)` |
| X4 | Credit threshold can be split around | open | |
| X5 | March sweep debits merchants, not scheme clearing (ADR-0002) | open | |
| X6 | Reporting consumer stops on one malformed event (whole batch fails, pipeline stuck) | open | |
| X8 | Reporting parity check crashes when a batch closes for a day with captures but no rollup row | `apps/reporting/src/consumer/applyEvent.ts` | fixed | `fix(X8)` |

### Deploy and setup (D)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| D1 | Migration 0054 references missing table | open | |
| D2 | Migration 0055 uses non-existent columns | open | |
| D3 | Dev webhook key fallback is 34 bytes, not 32 | open | |
| D4 | API has no CORS; dashboard can't call it | open | |
| D5 | Dockerfiles referenced by compose are missing | open | |

### FP-300 refunds (feature, last) (F)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| FP-300 | Refunds (F1–F13) | open | |
| F14 | Every refund crashes on insert: `reason` NULL vs 0070 CHECK | open | |

### Test suite (Q)

#### Q1 Flaky webhook backoff test
- What's wrong: "failing endpoint: backoff/exhaustion…" failed on almost every run.
- Why: it asserted `backoffDelayMs(1, config) === 1000` while the function applies random ±10% jitter by default.
- What it breaks: the suite was never green, hiding real regressions in the webhook dispatcher.
- Fix: the test passes a fixed jitter (0.5) for the expected value; the existing ±3 s tolerance on the stored delay absorbs the real jitter. No product code changed.
- Test: `webhooks/backoff.fix.test.ts` (edge cases: jitter 0 / 0.5 / ~1 → 900 / 1000 / 1100 ms; 200 random draws stay in range; cap honoured) · ADR: none

#### Q2 Archive replay test pollutes the shared database
- What's wrong: the 4 reporting tests failed whenever the API tests ran first against the same database.
- Why: `archiveReplay.test.ts` inserted real `transaction.captured`/`voided` outbox events with `{}` payloads; the reporting consumer later read them and crashed on the missing `merchantId`.
- What it breaks: a red suite that hides real reporting regressions.
- Fix: the fixture uses an inert, already-processed event type (`archive.test_fixture`); the archive code only reads `webhook_deliveries`, so its tests are unaffected. Local polluted rows cleaned in the dev DB only.
- Test: full suite run: no new empty-payload events; archive tests pass. The reporting tests then exposed a real bug, **X8** · ADR: none

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| Q1 | Dispatcher backoff test asserts an exact delay that carries random jitter (flaky) | `apps/api/src/webhooks/dispatcher.test.ts` | fixed | `fix(Q1)` |
| Q2 | `archiveReplay.test.ts` seeds real event types with empty payloads into the shared DB, breaking reporting tests | `apps/api/src/webhooks/archiveReplay.test.ts` | fixed | `fix(Q2)` |
| Q3 | Go test packages run in parallel against one DB and deadlock in `RebuildAllBalances`; run with `-p 1` | `apps/settlement/ (go test)` | fixed | `fix(Q3)` |

## Audit check (2026-10-29)

All audit claims hold in the code. S1, S2 reproduced on the running API; M1 by calling the parser.

Corrections:
- R1: finalize and release both key only on status, so either buyer can finish or release the other's hold.
- M4: real error is 3 fils at 123,456.789 BD.
- M7: wrong rate shows in the staff console, not the merchant dashboard.
- X1: the expire-not-delete fix needs `scripts/expire_holds.test.ts` updated.

## Against the ADRs (rules the code must follow)

- ADR-0001 (integer fils, BIGINT, `parseBhdToFils`, no floats): backs M1, M4, M5, M6, M12, M13.
  The audit's M2 fix still sends a `float64` (`SchemeAmountBD`); ADR-safe version computes
  `amount_fils::numeric / 1000` in SQL. Other `toFixed`/float hits are rate labels and progress
  bars, not money. Audit fixes for M3 (`allocateRemainder`) and F5 (`bankersRoundDiv`) comply.
- ADR-0002 (residue journaled in CloseBatch, "implemented"): no code posts it → **M14**. Also says
  the scheme `amount` must be exactly `amount_fils / 1000`, which is M2's fix. The March script
  books residue as debit `merchant_payable` / credit `scheme_rounding_residue`; ADR-0002 says
  credit `card_scheme_clearing` / debit residue → **X5** (merchants were charged the residue).
- ADR-0003 (calendar-month scripts use the UTC month): the March script's UTC month is **correct**.
  X2 fix = idempotency guard + dry run only; don't change the window.
- ADR-0004 (console button rebuilds from settled data, not the ledger): the audit's M9 swap to
  the ledger is **rejected** (code follows the ADR). Fix the settled-data path instead.
  Done: `RefreshBalanceCache` now reads closed-batch net payouts, so nothing reads
  `merchant_payable_position` any more; D1 may drop it instead of moving it.
- ADR-0005 (migrations 0054–0056 reserved for settlement v2, never reuse): 0054, 0055, 0056 in
  this repo break it. Move them to 0073+: keep `merchant_payable_position` (M9 reads it) and
  `v_active_api_keys`, drop `v_unbatched_capture_events`, fix or drop 0055, keep `revoke_after`.
- ADR-0006 (Adjust balance is cache-only; rebuild resets it): by design, not a bug. Code matches
  (cache + audit row; journaled variant exists, not exposed).
- New migrations (R2, R3, M5, M6) start at 0073, which ADR-0005 allows. 0073 is now M6's;
  the next fix (and D1/D2 moving 0054–0056 content) takes the next free number.

## Entries

Keep each entry short. One per bug, under its class heading:

```markdown
#### <ID> <title>
- Where: <primary file or directory>
- Clue: <matching symptom from the evidence transcript; omit if none>
- What's wrong: <one line>
- Why: <root cause, one line>
- What it breaks: <who loses what, fils example>
- Fix: <change> · Proper fix (if different): <one line>
- Test: <file> · ADR: <number, if any> · Commit: <sha>
```


### Security (S)

#### S1 Login works without OTP
- Where: `apps/api/src/auth/sessions.ts`
- Clue: "Login works without entering the OTP code?"
- What's wrong: the cookie issued after the password step (before the OTP) works on every merchant route.
- Why: `lookupSession` reads the `live_sessions` view, which drops revoked/expired sessions but not unverified ones.
- What it breaks: anyone with a merchant user's password reads and acts on that merchant's money (reproduced on the running API).
- Fix: `AND s.authenticated = true` in `lookupSession` (`auth/sessions.ts`).
- Test: `auth/sessions.fix.test.ts` (pending session returned a row before, null now) · ADR: none

#### S2 OTP/session issued to another merchant's user
- Where: `apps/api/src/routes/auth.ts`
- What's wrong: logging in to merchant B can create the session (and send the OTP) for merchant A's user with the same email.
- Why: login looked the user up again by email across all merchants (`findOtpRecipient`, `LIMIT 1`) instead of using the user it had just checked.
- What it breaks: a user of two merchants signs in to one and lands in the other's account and money (reproduced on the running API: Beta login → Alpha data).
- Fix: use the verified `user` as the OTP recipient; delete the unused `auth/users.ts`.
- Test: `routes/auth.fix.test.ts` (session went to merchant A's user before, merchant B's now) · ADR: none

#### S3 Cancel another merchant's payment link
- Where: `apps/api/src/paymentLinks/cancel.ts`
- Clue: "I cancelled merchant B's payment link from merchant A's dashboard"
- What's wrong: any merchant can cancel any other merchant's payment link by its id.
- Why: the route only checks the merchant in the URL is the caller; `cancelPaymentLink` updates by link id alone.
- What it breaks: a competitor or a leaked key can kill another shop's live links, so its customers can't pay.
- Fix: `cancelPaymentLink` takes the merchant id and both its queries add `AND merchant_id = $2`; another merchant's link answers 404.
- Test: `routes/paymentLinks.fix.test.ts` (cross-merchant cancel gave 204 before, 404 now) · ADR: none

#### S4 Expired payment link still payable (FP-187)
- Where: `apps/api/src/paymentLinks/pay.ts`
- Clue: "the link showed 'expired', but the payment still went through. The checkout page sends something that the server shouldn't trust."
- What's wrong: an expired link is charged if the request carries an old `submittedAt`.
- Why: `payPaymentLink` judged expiry against the client-sent `submittedAt` (any value, unauthenticated public route).
- What it breaks: shoppers pay stale links (old prices, cancelled orders); anyone can revive any expired link.
- Fix: expiry uses the server clock (`new Date()`) in `pay.ts`; `submittedAt` is ignored. Proper fix: also drop `submittedAt` from the API body and checkout page and delete `expiryReferenceTime` + its unit tests in `pay.test.ts` (which assert the client time is honoured); not done here because it changes the public request shape and an existing test file.
- Test: `paymentLinks/pay.fix.test.ts` (expired link with old `submittedAt` paid 200 before, 410 now) · ADR: none

#### S5 Outbound webhook signature mismatch (FP-240)
- Where: `apps/api/src/webhooks/dispatcher.ts`
- Clue: "The part that signs the message and the part that sends it don't agree on what it looks like."
- What's wrong: merchants can't verify our webhook signatures against the bytes they receive.
- Why: `signPayload` signs sorted-key JSON (`canonicalJson`); the dispatcher and "send test event" sent `JSON.stringify` (original key order), so the signed and sent bytes differ.
- What it breaks: merchants following standard HMAC verification reject every webhook (payment and payout notices), or turn verification off.
- Fix: dispatcher and test-send now send `canonicalJson(payload)`, the exact string that was signed. Proper fix: serialise once and sign that string (signer takes raw bytes), so the two can never drift.
- Test: `webhooks/sign.fix.test.ts` (raw-bytes HMAC failed before for both senders, passes now) · ADR: none

#### S6 Inbound acquirer signature check weak (FP-240)
- Where: `apps/api/src/webhooks/inboundVerify.ts`
- Clue: "someone said the incoming signature check has its own problems."
- What's wrong: unsigned acquirer callbacks were accepted, a captured genuine callback could be replayed forever, and the compare wasn't constant-time.
- Why: `ACQUIRER_CALLBACK_REQUIRE_SIGNATURE` and the verifier both defaulted to "optional"; no timestamp check; homemade `Buffer.compare`.
- What it breaks: anyone can post fake fraud-review results onto any payment, or replay old ones.
- Fix: signatures required by default (config and verifier), 300 s timestamp tolerance, `timingSafeEqualHex`, `v1` must be exactly 64 hex chars. Replays inside the 5-minute window are left to R2 (dedupe on `callback_id`). Updated two existing tests that locked in the old behaviour (fixed 2025 timestamps; "accepts unsigned callback"). Proper fix: verify the raw request bytes instead of `JSON.stringify` of the parsed body (needs raw-body capture on the route).
- Test: `webhooks/inboundVerify.fix.test.ts` (unsigned, default config and replayed cases failed before, pass now) · ADR: none

#### S7 Rotated API key keeps working
- Where: `apps/api/src/admin/apiKeys.ts`
- Clue: "there's a key rotation flow that doesn't do what you'd expect"
- What's wrong: after staff rotate a merchant's API key, the old key keeps working forever.
- Why: `rotateApiKeyAsAdmin` issues the new key but never sets `revoked_at` on the old one (0037's own design says rotation revokes it with reason 'rotated'); no sweep job exists.
- What it breaks: rotating a leaked key does nothing; whoever holds it keeps full API access.
- Fix: revoke the old key (`revoked_at = now()`, `revoked_reason = 'rotated'`) in the same transaction. Updated `routes/admin.test.ts`, which asserted the old key stayed active. Alternative (not done): a short grace period via `revoke_after` + a sweep job; needs new code and the 0056 column (number reserved by ADR-0005).
- Test: `admin/apiKeys.fix.test.ts` (old key still verified after rotation before, null now) · ADR: none

#### S8 Impersonation gets write access
- Where: `apps/api/src/admin/impersonation.ts`
- Clue: "some admin actions don't seem to have the right role checks"
- What's wrong: "view as merchant" lets staff change the merchant's data; a super_admin acts as the merchant's owner.
- Why: impersonation maps super_admin → owner and finance → finance; and capture, void and saved-filter routes have no role check at all, so even "support" could write.
- What it breaks: staff can create/cancel links, change webhooks, capture or void payments as the merchant, and those writes are recorded as the merchant's own session.
- Fix: every admin role maps to `support`, and `requireMerchantAuth` refuses any non-GET/HEAD request made under impersonation (403 `forbidden`). The audit's role-mapping alone would not have closed the role-free write routes. Proper fix: record impersonated writes as `admin_impersonation` in the writer-actor columns (needs a schema change), and add role checks to capture/void.
- Test: `admin/impersonation.fix.test.ts` (owner role, link creation and saved-filter write all succeeded before, refused now; reads still work) · ADR: none

#### S9 Weak, brute-forceable OTP
- Where: `apps/api/src/lib/random.ts`
- Clue: "the OTP implementation changed at some point. is it still safe?"
- What's wrong: OTP codes came from `Math.random`, and parallel wrong guesses all got checked (20 of 20 on the admin login, 11 on merchant) despite a limit of 5.
- Why: `lib/random.ts` used `Math.random`; both verify routes read `attempt_count`, compared, then incremented, so concurrent requests all saw the same count.
- What it breaks: an attacker with a password can predict or brute-force the second factor; the same weak generator made payment link tokens guessable.
- Fix: `lib/random.ts` uses `crypto.randomInt` (covers OTP, admin OTP, payment link tokens, display refs) and admin invite codes now use it too; both verify routes claim an attempt with one atomic `UPDATE … WHERE attempt_count < max_attempts AND consumed_at IS NULL AND expires_at > now() RETURNING` before comparing; resend locks the old challenge and copies its `attempt_count` to the new one (it used to reset to 0, giving 5 fresh guesses every 30 s).
- Test: `auth/otp.fix.test.ts` (Math.random-derived codes and invite codes, over-limit parallel guesses on both logins, and resend resetting the budget all failed before, pass now) · ADR: none

#### S10 Credit self-approval compares display name
- Where: `apps/api/src/admin/creditApproval.ts`
- What's wrong: the "second approver must be a different person" check on merchant credits compares display names.
- Why: `assertDistinctApprover` compared `displayName`; names aren't unique, and the requester's name is snapshotted at request time while the approver's is current.
- What it breaks: one operator can approve their own large credit after changing their display name; two different people with the same name can't approve each other.
- Fix: compare `adminUserId`.
- Test: `admin/creditApproval.fix.test.ts` (same id/different name and different ids/same name both wrong before, right now) · ADR: none

#### S11 Secret committed in `ops/.env.docker`
- Where: `ops/.env.docker`
- What's wrong: the acquirer callback signing secret was committed (and pushed) in `ops/.env.docker`.
- Why: `.gitignore` only covered `.env` and `.env.local`; a comment wrongly claimed `.env` matched `.env.docker` as a prefix.
- What it breaks: anyone with repo access can forge acquirer callbacks (S6 makes signatures mandatory, so the secret is now the only gate).
- Fix: untracked `ops/.env.docker` (local copy kept), ignore `.env.*` except `*.example`, added `ops/.env.docker.example` with placeholders, README updated. **Still needed outside git:** rotate the secret with the acquirer; it remains in past commits on GitHub (purging needs a history rewrite + force-push, not done).
- Test: `scripts/committed_secrets.fix.test.ts` (tracked .env file and secret value found before, none now) · ADR: none

#### S12 Any admin can issue merchant credits
- Where: `apps/api/src/routes/adminCredits.ts`
- Clue: "some admin actions don't seem to have the right role checks"
- What's wrong: a support admin can issue a credit to any merchant; ones under the threshold post to the ledger at once.
- Why: `POST /v1/admin/merchants/:id/credits` sits in the route group that only requires an admin session; approve/reject are in the group that also requires finance/super_admin. The UI hides the form from support, but the server never checked.
- What it breaks: any support login can move money to a merchant (up to 50.000 BD per credit without a second approver).
- Fix: `requireAdminRole("finance", "super_admin")` on the create route.
- Test: `routes/adminCredits.fix.test.ts` (support create returned 201 before, 403 now; finance still 201) · ADR: none

### Races and duplicates (R)

#### R1 Payment link charged twice (incident 2026-05-14)
- Where: `apps/api/src/paymentLinks/pay.ts`
- What's wrong: two buyers paying one link could both be charged, and a buyer could be told "paid" for a link recorded against someone else's transaction.
- Why: a link `reserved` past the timeout can be re-claimed; finalize and release only checked `status = 'reserved'` (not whose reservation), so buyer A could finalize buyer B's claim; and a finalize that matched 0 rows still answered 200 "paid". The postmortem blamed callbacks; FP-202's constraint was never added.
- What it breaks: double charges on one invoice (the May incident), and links whose recorded payment is not the one the buyer was told succeeded.
- Fix: the claim returns `reserved_at::text` as a reservation token; release and finalize match it; before capture the payer refreshes its own reservation and, if it has been taken over, voids its authorization and answers 409 (nobody charged); a finalize miss after capture answers 409 `payment_link_reservation_lost` with the transaction id and logs it for a refund. `voidTransaction` accepts a `system` actor (as capture does). Checkout shows a terminal "charged, contact the merchant" message for that error. · Proper fix (if different): refund the lost capture automatically once FP-300 works; a `reservation_id` column instead of the timestamp token; a unique index so a link has at most one captured transaction (FP-202).
- Test: `paymentLinks/pay.r1.fix.test.ts` (lost during authorize → voided + 409, lost during capture → 409 not "paid", no cross-finalize, normal path; three failed before) · ADR: none

#### R2 Duplicate acquirer callback notes (FP-201) — on hold, fix proposed
- Where: `apps/api/src/acquirer/callbacks.ts`
- What's wrong: a redelivered acquirer callback (same `callbackId`) writes a second note; five concurrent deliveries write five.
- Why: plain `INSERT` and no unique index on `acquirer_callback_notes.callback_id`. The "`processed_events`" dedupe in the postmortem and 0051's "FP-238 unique index — done" were never built.
- What it breaks: duplicate verdicts on the transaction timeline (the May incident started from two notes on one link).
- Proposed fix (owner chose: archive duplicates, reversible): next free migration (0074+):
  1. `CREATE TABLE acquirer_callback_notes_duplicates (LIKE acquirer_callback_notes INCLUDING DEFAULTS, archived_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  2. move every row after the earliest per `callback_id` (`row_number() OVER (PARTITION BY callback_id ORDER BY created_at, id) > 1`) with `WITH moved AS (DELETE … RETURNING *) INSERT INTO …_duplicates SELECT *, now() FROM moved`;
  3. `CREATE UNIQUE INDEX acquirer_callback_notes_callback_id_key ON acquirer_callback_notes (callback_id)`;
  4. header comment with the undo: `DROP INDEX …; INSERT INTO acquirer_callback_notes SELECT <columns> FROM …_duplicates; DROP TABLE …_duplicates`.
  Code: `INSERT … ON CONFLICT (callback_id) DO NOTHING` (redelivery returns normally, no throw).
- Test (written, parked): `fix-docs/pending/R2/callbacks.fix.test.ts` → move to `apps/api/src/acquirer/`. Fails today 2 ≠ 1 (redelivery) and 5 ≠ 1 (concurrent); distinct callbacks still give 2.

#### R3 Duplicate settlement.paid notifications (2026-08-21) — on hold, fix proposed
- Where: `apps/settlement/internal/settlement/payout_notify.go`
- What's wrong: when the daemon and the CLI run together, both pass the `NOT EXISTS` check and each inserts a `settlement.paid` outbox event, so the merchant gets two payout webhooks and the dispatcher writes a second disbursement record.
- Why: check-then-insert with no unique index on `outbox_events`; the FP-208 advisory lock listed as "Done" does not exist.
- Proposed fix (archive duplicates, reversible): next free migration after R2's:
  1. side tables `outbox_events_duplicates` and `webhook_deliveries_duplicates` (`LIKE … INCLUDING DEFAULTS` + `archived_at`);
  2. for `event_type = 'settlement.paid'`, keep the earliest event per `aggregate_id`; move the later events' `webhook_deliveries` rows first (FK from 0022), then the events (also check `webhook_delivery_archives` from 0068 and disbursement rows from 0057 for references, and archive the same way);
  3. `CREATE UNIQUE INDEX outbox_events_settlement_paid_once ON outbox_events (aggregate_id) WHERE event_type = 'settlement.paid'`;
  4. undo SQL in the header (re-insert deliveries after events, drop the index).
  Code: `INSERT … ON CONFLICT (aggregate_id) WHERE event_type = 'settlement.paid' DO NOTHING`, and only `count++` when a row was inserted (`RowsAffected() == 1`).
- Test to write: Go `payout_notify_fix_test.go`: two concurrent `EnqueuePayoutNotifications` over one paid batch → exactly one event, combined count = 1; a second sequential run enqueues 0.

### Money correctness (M)

#### M1 CSV import reads BD as cents (10x)
- Where: `apps/api/src/admin/adjustmentCsvParsing.ts`
- Clue: "I uploaded 4.755 BD and the ledger shows 4.750. I uploaded 4.75 BD and it shows 0.475" (also #fp-finance: a 4,141.90 BD sheet posted as 414,190 fils)
- What's wrong: the manual-adjustment CSV import posts every amount at a tenth of its value and drops the third decimal.
- Why: `parseAdjustmentAmountFils` used `parseDecimalMinor(raw, 2)` (cents logic) instead of `parseBhdToFils`.
- What it breaks: finance corrections post 10x too small (4.75 BD → 475 fils = 0.475 BD); 4.755 BD loses 5 fils; >3 decimals silently truncated.
- Fix: `parseBhdToFils` (ADR-0001 rule 3); deleted the now-unused cents helper `lib/decimal.ts`; updated the import tests that asserted cents (475/600/125/350/500 → 4750/6000/1250/3500/5000).
- Test: `admin/adjustmentCsvParsing.fix.test.ts` (2- and 3-decimal, whole, negative, 0.005, spaces; >3 decimals and junk rejected) · ADR: 0001

#### M2 Scheme statement always a few fils high
- Where: `apps/settlement/internal/settlement/batch.go`
- Clue: "The scheme statement total is always a few fils higher than ours. It's always over, never under" (and #fp-finance: file line 93.28 vs amount_fils 93,270)
- What's wrong: each scheme file line was the gross amount rounded half-up to 2 decimals, while our ledger uses the truncated `amount_fils`.
- Why: `CloseBatch` stored `amount = SchemeAmountBD(grossFils)` (untruncated, float64) into `NUMERIC(10,2)`, which rounds; the file reads `amount` first.
- What it breaks: the scheme is told up to 9 fils more per line than we book, every day (0.077 BD on Delta Wholesale on 14 Sep); finance can't tie out and blamed Visa.
- Fix: store `formatFilsAsTwoDecimalString(truncated)` as an exact numeric string, so `amount` = `amount_fils / 1000` (ADR-0002) with no float (ADR-0001); deleted the float helper `SchemeAmountBD`. Rows already exported keep their old values (files already sent).
- Test: `settlement/batch_fix_test.go` (4750, 4747, 4755, 93276, 9 fils; four were rounded up before, all exact now) · ADR: 0001, 0002

#### M3 Split payouts short every batch
- Where: `apps/settlement/internal/splits/allocate.go`
- Clue: "the three child payouts don't add up to the parent's total. It's small, a few tens of fils each batch, but it happens every batch since launch."
- What's wrong: a marketplace parent's payout split across sub-merchants did not add up to the batch's net payout.
- Why: each child's share was rounded on its own (`ApplyRateFils`, banker's rounding) and the difference was never paid; the tested helper `ChildShares` only had amounts that divide evenly and was not even used.
- What it breaks: children short by up to a few fils every batch (10001 fils in thirds paid 10000), the remainder stuck in the parent's payable and cache; in other cases shares rounded up and overpaid (3 fils in halves paid 4).
- Fix: `ChildShares` uses largest remainders (round every share down, then give the fils still owed one at a time to the largest dropped fractions), so shares are never negative and total exactly the payout their weights cover; `PayoutSplitBatch` uses it. The ledger legs, `settlement_batch_splits` and the cache reduction now equal the net payout. (A first version put the whole difference on the largest share; review showed five 20% shares of 3 fils drove one share to −1, so it was replaced.) · Proper fix (if different): validate that a parent's weights total 10000 when splits are configured; weights over 10000 still overpay, as before.
- Test: `splits/shares_fix_test.go` (odd thirds/halves, 1 fil, 0, large, weights under 100%, five shares each rounding up) and `splits/allocate_fix_test.go` (database: split rows, ledger debits and cache all match net; exact division unchanged); both failed before · ADR: 0001 (integer fils)

#### M4 Net payout computed in float32
- Where: `apps/settlement/internal/settlement/payable.go`
- What's wrong: a batch's net payout (gross − fee) was computed through `float32` BD values.
- Why: `NetPayableFils` converted both totals to `float32` BD, subtracted, then rounded back to fils; float32 has ~7 significant digits.
- What it breaks: merchants are paid a few fils off on bigger batches (20,000.123 BD gross − 500.003 BD fee paid 1 fil short), growing with size (22,739 fils off on a 9-billion-fil batch). Breaks ADR-0001.
- Fix: `return grossFils - feeFils`.
- Test: `settlement/payable_fix_test.go` (empty, ordinary, 123,456.789 BD, odd fils, very large; three were wrong before) · ADR: 0001

#### M6 Platform volume counter overflows int32
- Where: `apps/settlement/internal/settlement/platform_volume.go`
- What's wrong: the platform-wide processed-volume counter wrapped negative shortly after reaching the volume tier.
- Why: `platform_stats.total_processed_fils` was `INTEGER` (0049) and Go added in `int32`; the tier starts at 2,000,000,000 fils, only 147 M under the int32 max. Comments claiming BIGINT were false.
- What it breaks: 2,100,000,000 + a 100,000,000-fil batch was stored as −2,094,967,296, so the 15 bps tier discount silently switched off for every merchant (and a value written from TS past the limit errored).
- Fix: migration `0073_platform_stats_bigint.sql` (`BIGINT`); Go `int64` throughout; TS reads the BIGINT string with `Number()`. Widened the old test's read-back to `int64`.
- Note: the tier itself never had finance sign-off (HANDOVER, MK's comment); not changed here.
- Test: `settlement/platform_volume_fix_test.go` (crossing, at and one past the int32 max) and `fees/platformVolumeTier.fix.test.ts` (2^31−1, 2^31, 9e9); both failed before · ADR: 0005 (0073 is allowed)

#### M7 Fee shown 245 bps, charged 225 bps
- Where: `apps/api/src/fees/currentFeeScheduleDisplay.ts`
- Clue: "It shows 245bps, but payments go through at 225bps. The two fee tables have different dates, and one was a backfill fix."
- What's wrong: the staff console's merchant page showed the most recently *typed-in* fee schedule, not the one in force.
- Why: `getCurrentFeeScheduleForDisplay` ordered by `created_at`; billing (`feeSchedule.ts`) uses `effective_from <= now()` ordered by `effective_from DESC, created_at DESC`. The Go twin `LoadFeeSchedules` had no tie-break on same-day rates.
- What it breaks: staff quote merchants the wrong rate (a March correction keyed in August showed 245 while 225 is charged); future-dated rates showed early; on a same-day tie settlement could pick the older entry.
- Fix: display uses billing's rule; Go orders `effective_from ASC, created_at ASC` so its "last applicable" matches billing. Updated the test that asserted the backfilled row wins.
- Test: `fees/currentFeeScheduleDisplay.fix.test.ts` (backdated, future-dated, same-day tie, only-future → none; display = billing) and `settlement/fee_schedule_fix_test.go` (tie) · ADR: none

#### M8 MDR recalculation rewrites paid batches
- Where: `apps/settlement/internal/settlement/recalculate_mdr.go`
- Clue: "MDR recalculation changed batches that were already paid out. Those should never change."
- What's wrong: finance's "Recalculate MDR" rewrote the fee and net payout of batches that had already been paid.
- Why: `RecalculateMDR` selects `status <> 'open'`, which includes `paid`, and then updated every batch's `fee_fils`/`net_payout_fils` and moved the payable cache by the difference, whatever the batch's status. Its own docstring says paid figures stay as they were paid.
- What it breaks: after a rate rise from 250 to 300 bps, a paid batch's record changed from 177 fee / 6905 net to 212 / 6870 (no longer what the bank paid), and the merchant's cached payable dropped 35 fils for money that was no longer in it.
- Fix: for a `paid` batch, skip the batch UPDATE and the cache delta. The ledger adjustment and the result row are still posted, so finance sees and books the difference; since the paid fee no longer moves, the pass first counts the MDR adjustments already posted on that batch after `paid_at` (review: without this every re-run posted the difference again). Limit: a `paid` row with `paid_at` NULL books 0 and still re-posts; both payout paths set `paid_at`. Closed (unpaid) batches are updated as before. Removed the false comments in `balances/cache.go` and `routes/admin.ts` ("only touches open batches"). · Proper fix (if different): post a paid batch's adjustment into the merchant's next payout batch so the difference is actually collected or refunded (today it sits on the old batch id and only the ledger carries it). The recalculation also ignores `fee_schedules` and the volume tier, using only `merchants.mdr_bps`.
- Test: `settlement/recalculate_mdr_fix_test.go` (paid batch figures and cache unchanged, failed before: fee 177→212, cache 6905→6870; paid batch still journaled; closed batch still updated; re-run posts nothing, failed before: 70 booked instead of 35; a second rate change posts only the gap; closed-then-paid not double-counted) · ADR: none

#### M9 Rebuild cached balances gives the wrong figure (FP-203)
- Where: `apps/settlement/internal/ledger/refresh.go`
- Clue: "I pressed it last Thursday and Alpha Retail's balance went from 135K to 7K. Yousif had to run the CLI rebuild to fix it."
- What's wrong: the console's "Rebuild cached balances" overwrote every merchant's cached balance with an unrelated number.
- Why: `RefreshBalanceCache` read view `merchant_payable_position` (0054), which sums **gross** scheme export lines over **every** batch, paid ones included. The cache it rebuilds is the net of batches closed but not yet paid (`ApplyBatchClose` adds net, `ApplyPayout` subtracts it), so fees, payouts and Recalculate MDR were all ignored. History without export lines (as in production) undercounts the same way the clue shows.
- What it breaks: a closed 100.000 BD batch with a 2.250 BD fee showed 100.000 BD payable instead of 97.750; an already-paid batch kept showing as owed. Support then "fixed" balances with Adjust (FP-203), which the next rebuild wiped.
- Fix: rebuild from `SUM(net_payout_fils)` of `settlement_batches` with `status = 'closed'`, still settled data as ADR-0004 requires (the audit's swap to the ledger walk is rejected by the ADR). Updated `internalapi/server_test.go`, which asserted the gross 12000 instead of the net 11700. The 0054 view is now unused. · Proper fix (if different): same; the incremental cache's own drift (paid batches in Recalculate MDR, split payouts) is M8/M3/M15.
- Test: `ledger/refresh_fix_test.go` (net not gross, paid and open excluded, all-paid = 0, recalculated fee, two batches with no cache row; five failed before) · ADR: 0004, 0006 unchanged

### Settlement timing and test merchants (T)

#### T1 Daily close runs at 03:00 Bahrain, not midnight
- Where: `apps/settlement/internal/scheduler/daemon.go`
- What's wrong: the daemon closed each business day at about 03:15 Bahrain instead of 00:15 (midnight + `DaemonRunDelayMinutes`).
- Why: `runIfDue` passed `time.Now().UTC()` to `BusinessDayWindow`, which takes the calendar date in the argument's own zone. From 00:00 to 03:00 Bahrain the UTC date is still yesterday, so it re-targeted the day before yesterday (already closed).
- What it breaks: every daily close and payout runs three hours late; anything scheduled after "midnight close" (finance checks, scheme files) sees the previous day still open.
- Fix: pull the due decision into `dueBusinessDate(now, delay)` and convert `now` with new `settlement.InBusinessDayZone` before `BusinessDayWindow`. Removed the false "UTC here is fine" comments. · Proper fix (if different): convert inside `BusinessDayWindow` (`date.In(businessDayLocation).Date()`); it would break `window_utc_compat_test.go`, which locks today's behaviour, and change the CLI/API callers that pass a parsed date, so it is left for later.
- Note: `DaemonRunDelayMinutes` has no range check (config.go); 1440 or more means the close is never due. Separate hardening, not T1.
- Test: `scheduler/daemon_fix_test.go` (00:10 not due, 00:15/00:20 due, delay 0, 02:59, 03:15, 23:59, year end; the 00:00–03:00 cases failed before) · ADR: none

#### T2 Admin tool moves test merchants into real settlement
- Where: `apps/api/src/routes/adminMerchantsRecompute.ts`
- What's wrong: "Recompute transaction statuses" quietly set `test_mode = false` on a sandbox merchant.
- Why: the route called `reconcileSandboxFlag`, which cleared the flag whenever the recompute found no open authorizations; and since the recompute's query skips `authorized` rows (T3), that was every merchant with any non-authorized transaction.
- What it breaks: Go settlement (`CloseBatch` filters `test_mode = false`) then batches the sandbox merchant's test captures and pays them out as real money.
- Fix: drop the call; the route still returns and audits `flagsUpdated: []` so the API and admin type keep their shape; deleted `admin/merchantFlags.ts` (its only caller). · Proper fix (if different): also remove `flagsUpdated` from the response, the audit metadata and `apps/admin/src/types.ts` (nothing reads it).
- Test: `routes/adminMerchantsRecompute.fix.test.ts` (test merchant stays test, live stays live, with an authorization; the first failed before) · ADR: none

### Scripts and other (X)

#### X1 Nightly hold clean-up can delete every hold
- Where: `scripts/expire_holds.ts`
- What's wrong: on a night with no expired holds the cron ran `DELETE FROM holds` with no WHERE; on other nights it deleted the expired holds instead of marking them.
- Why: it read the expired ids, then built the DELETE with `lib/sqlFilter.ts` `buildWhere`, which silently drops a filter whose array is empty. HANDOVER says the script flips `active` to `expired` with one UPDATE and holds are never deleted.
- What it breaks: every hold (and with it every open authorization's reserved amount and history) wiped on a quiet night; on busy nights hold history lost, and a hold captured between the SELECT and the DELETE could still be deleted.
- Fix: one `UPDATE holds SET status = 'expired' WHERE status = 'active' AND expires_at < now()`; deleted `lib/sqlFilter.ts` and `expire_holds.test.ts`, which only served the DELETE (the latter asserted its SQL text). · Smallest alternative (not used): return early on an empty list; it would still delete holds against HANDOVER and keep the read-then-delete gap.
- Note: the `MK` comment in `db/migrations/0005_holds.sql` (script deletes rows, 'expired' is transient) is false; left as is because the migration has applied.
- Test: `scripts/expire_holds.fix.test.ts` (quiet night changes nothing, expired hold marked not deleted, other statuses untouched, count never drops; all in a rolled-back transaction; three failed before) · ADR: none

#### X2 March sweep script not idempotent
- Where: `scripts/reconcile_march.ts`
- Clue: "someone ran it twice on staging and the gap doubled. Nobody knows if it ran more than once on production. The log file only has one timestamp."
- What's wrong: every run of the March 2026 residue sweep posted the whole residue again.
- Why: each run posted with a fresh `randomUUID()` group and nothing checked for an earlier run (the `am:` comment "entry_group_id dedupes it" and RUNBOOK's "checks for an existing posting… a second run is a no-op" were both false). There was no dry-run flag, so FH's 3 July "dry run" (13 lines, 70 fils "identical") posted a second time. The log has one timestamp because `>` overwrites it.
- What it breaks: each extra run takes the March residue (70 fils across 13 lines in production) out of merchant payables again, doubling finance's gap; production has likely been posted at least twice.
- Fix: the sweep is `runSweep(client, { dryRun })` inside the caller's transaction. `--dry-run` computes and reports, writes nothing. A real run takes an advisory lock on the sweep's description, then refuses ("REFUSED", exit 1) if any ledger entry with that description exists. Window left on the UTC month (ADR-0003); the posting direction is X5. RUNBOOK's claim is now true; its copy-for-next-month step now also says to rename `SWEEP_DESCRIPTION` and dry-run first. The test hides any committed sweep rows inside its own transaction, so it also runs on a DB where March was posted. · Proper fix (if different): a unique key on the sweep (e.g. a `ledger_postings` row per sweep + month) instead of a description match, and month-end residue automated (RUNBOOK). Production clean-up: count `ledger_entries WHERE description LIKE 'March 2026 scheme rounding residue%'` (2 legs per merchant per run) and reverse the extra runs with finance; not done here (never run scripts against data).
- Test: `scripts/reconcile_march.fix.test.ts` (first run posts once, second run posts nothing, `--dry-run` writes nothing, dry run after a real run writes nothing, round merchant untouched; rolled back; three failed before: second run and dry runs posted) · ADR: 0003 (window unchanged)

#### X3 Large export can run the API out of memory
- Where: `apps/api/src/routes/transactions.ts`
- What's wrong: `GET /v1/transactions/export` built the whole CSV in memory; `from`/`to` are optional, so one call could export a merchant's entire history.
- Why: the route used `buildTransactionsExportCsv` (all rows, one string). The paged `streamTransactionsExportCsv` existed but was unused (CHANGELOG 1.8.0 claims the export streams), and its own cursor (`occurred_at >` a JS Date) skipped rows sharing a timestamp at a page boundary (1000 of 1002 exported) and repeated rows that differ below the millisecond.
- What it breaks: a large merchant's full export can exhaust the 512 MB API and take it down for every merchant.
- Fix: `streamTransactionsExportCsv` is an async generator paging 1000 rows by `(occurred_at, id)` with the timestamp as exact text; the route sends it with `Readable.from` (backpressure, one page in memory). The body is the same as before (rows sharing an instant now come in id order). CHANGELOG 1.8.0's streaming claim is now true. A database error mid-export now ends a 200 response early (headers already sent). `buildTransactionsExportCsv` is left for its tests but no longer used by the route. · Proper fix (if different): also require and cap the date range (the audit's other option), which changes the API for callers that omit `from`/`to`.
- Test: `transactions/exportCsv.fix.test.ts` (1002 rows at one instant, sub-millisecond rows at a boundary, same rows as the in-memory export, empty export, the route streams with no content-length; the route test failed before with content-length 108600) · ADR: none

#### X8 Reporting crashes on its own lag check
- Where: `apps/reporting/src/consumer/applyEvent.ts`
- What's wrong: when a settlement batch closes for a day that has captures but no reporting rollup row, the reporting worker throws and stops.
- Why: the "rollup lags ground truth" check read `captured_count` from a row it assumed exists; a missing row is exactly the lag it is meant to detect.
- What it breaks: the reporting pass rolls back and retries the same event forever, so every dashboard total stops updating for all merchants.
- Fix: treat a missing rollup row as 0 and log the lag warning.
- Test: `reporting/consumer/applyEvent.fix.test.ts` (crashed before, warns and records the payout trend now); reporting suite 12/12 · ADR: none

### Deploy and setup (D)

### FP-300 refunds (feature, last) (F)

### Test suite (Q)

#### Q3 Go tests deadlock when packages run in parallel
- Where: `apps/settlement/ (go test)`
- What's wrong: `TestRebuildAllBalances_OverwritesDriftedCache` failed with `deadlock detected` on a plain `go test ./...`.
- Why: Go runs test packages in parallel; ledger, internalapi and settlement tests all write `merchant_balances` in the same database, in different row orders.
- What it breaks: a red Go suite that isn't a product failure.
- Fix: run Go tests with `go test -p 1` (skill updated); all Go packages pass that way. Related real issue logged as M15.
- Test: `go test -p 1 ./...` all ok · ADR: none

## Baseline before any fix (2026-10-29, commit ee6be80 code)

TS suite against a freshly migrated + seeded local DB: api 350/362, reporting 7/11,
all other workspaces green; `scripts/` 5/5 (run separately: `npm test` stops before them while
the API has failures). Go suite not yet run (Go not installed; use Docker).
These failed **before** any change, so a fix must not add to this list:

- a full refund of a fully captured transaction lands on refunded
- the refund's ledger group balances and reverses the fee that was charged
- a partial refund lands on partially_refunded with a refund_partial event
- a second partial refund completing the captured total lands on refunded
- replaying the same idempotency key returns the first body and writes nothing new
- an acquirer transport error answers 502 and leaves the key retryable
- a successful refund enqueues exactly one refund.succeeded outbox event
- a full refund of the caller's own transaction succeeds
- a partial refund of the caller's own transaction succeeds
- replaying an idempotency key returns the same body and writes one refund
- a refund succeeds when refunds_enabled is explicitly true
- failing endpoint: backoff/exhaustion sequence across repeated runDispatchPass calls, next_attempt_at progresses correctly, exhausted at webhookMaxAttempts
- runRebuild: replays to an identical rollup state as incremental processing had already produced, and prints a before/after diff
- runConsumerPass: end-to-end over real events with the producers' exact payload shapes populates merchant_daily_volume and advances the watermark
- runConsumerPass: end-to-end settlement.batch_closed populates merchant_payout_trends
- runConsumerPass: atomicity — an apply failure partway through a multi-event batch rolls back the WHOLE pass, neither watermark nor any rollup write from that batch persists

Why they fail (checked 2026-10-30):
- 11 refund tests → **F14**: `processRefund` inserts `reason` as an explicit `NULL`; 0070's
  column default only applies when the column is omitted, so its `CHECK (reason IS NOT NULL)`
  rejects every refund. A real FP-300 bug, not a test problem.
- 1 dispatcher test → **Q1**: asserts `backoffDelayMs(1) === 1000`, but the function applies a random
  ±10% jitter by default, so it fails almost every run. Test bug.
- 4 reporting tests → **Q2** (and X6): `webhooks/archiveReplay.test.ts` inserts real event types
  (`transaction.captured`/`voided`) with `{}` payloads into the shared DB; the reporting consumer
  later reads them and crashes on the missing `merchantId`. With those rows neutralised in a DB
  copy, reporting passes 11/11. It also shows **X6**: one bad event stops the consumer for good.
