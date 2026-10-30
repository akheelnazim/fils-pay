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
| R2 | Duplicate acquirer callback notes (FP-201) | `apps/api/src/acquirer/callbacks.ts` | fixed | `fix(R2)` |
| R3 | Duplicate payout notifications (2026-08-21) | `apps/settlement/internal/settlement/payout_notify.go` | fixed | `fix(R3)` |
| R5 | Adjustment CSV importable twice | `apps/api/src/admin/adjustmentImport.ts` | fixed | `fix(R5)` |

### Money correctness (M)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| M1 | CSV import reads BD as cents (10x) | `apps/api/src/admin/adjustmentCsvParsing.ts` | fixed | `fix(M1)` |
| M2 | Scheme statement always a few fils high | `apps/settlement/internal/settlement/batch.go` | fixed | `fix(M2)` |
| M3 | Split payouts short every batch | `apps/settlement/internal/splits/allocate.go` | fixed | `fix(M3)` |
| M4 | Net payout computed in float32 | `apps/settlement/internal/settlement/payable.go` | fixed | `fix(M4)` |
| M5 | Lifetime payout estimate drifts (REAL) | `apps/settlement/internal/settlement/payout_estimate.go` | fixed | `fix(M5)` |
| M6 | Platform volume counter overflows int32 | `apps/settlement/internal/settlement/platform_volume.go` | fixed | `fix(M6)` |
| M7 | Dashboard fee 245 vs charged 225 bps | `apps/api/src/fees/currentFeeScheduleDisplay.ts` | fixed | `fix(M7)` |
| M8 | MDR recalculation rewrites paid batches | `apps/settlement/internal/settlement/recalculate_mdr.go` | fixed | `fix(M8)` |
| M9 | Recalculate balances button 135K → 7K (FP-203) | `apps/settlement/internal/ledger/refresh.go` | fixed | `fix(M9)` |
| M10 | Settlement summary double-counts multi-capture | `apps/api/src/settlement/query.ts` | fixed | `fix(M10)` |
| M11 | Reconciliation pending uses `merchants.mdr_bps` | `apps/api/src/settlement/query.ts` | fixed | `fix(M11)` |
| M12 | `parsePromotionalDiscountFils` uses float × 100 | `apps/api/src/payments/discountAdjustment.ts` | fixed | `fix(M12)` |
| M13 | Reconciliation pending fee uses float rates (`fees/estimate.ts`) | `apps/api/src/fees/estimate.ts` | fixed | `fix(M13)` |
| M14 | Scheme residue never journaled (ADR-0002) | `apps/settlement/internal/settlement/batch.go` | fixed | `fix(M14)` |
| M15 | Balance rebuild can overwrite a concurrent batch-close cache update (YA's TODO in rebuild.go) | `apps/settlement/internal/ledger/rebuild.go` | fixed | `fix(M15)` |

### Settlement timing and test merchants (T)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| T1 | Daily close runs 03:00 Bahrain, not midnight | `apps/settlement/internal/scheduler/daemon.go` | fixed | `fix(T1)` |
| T2 | Admin tool flips test merchants into settlement | `apps/api/src/routes/adminMerchantsRecompute.ts` | fixed | `fix(T2)` |
| T3 | Recompute statuses reports `openAuthorizations` as always 0 (its query excludes `authorized` rows) | `apps/api/src/admin/transactionStatusRecompute.ts` | fixed | `fix(T3)` |

### Scripts and other (X)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| X1 | `expire_holds.ts` can delete every hold | `scripts/expire_holds.ts` | fixed | `fix(X1)` |
| X2 | March sweep script not idempotent | `scripts/reconcile_march.ts` | fixed | `fix(X2)` |
| X3 | Large export can OOM the API | `apps/api/src/routes/transactions.ts` | fixed | `fix(X3)` |
| X4 | Credit threshold can be split around | `apps/api/src/admin/creditThreshold.ts` | fixed | `fix(X4)` |
| X5 | March sweep debits merchants, not scheme clearing (ADR-0002) | `scripts/reconcile_march.ts` | fixed | `fix(X5)` |
| X6 | Reporting consumer stops on one malformed event (whole batch fails, pipeline stuck) | `apps/reporting/src/consumer/runConsumerPass.ts` | fixed | `fix(X6)` |
| X8 | Reporting parity check crashes when a batch closes for a day with captures but no rollup row | `apps/reporting/src/consumer/applyEvent.ts` | fixed | `fix(X8)` |
| X9 | Reconciliation page crashes when the calculated gap is negative | `apps/web/src/format.ts`, `apps/web/src/pages/settlement/ReconciliationPage.tsx` | fixed | `fix(X9)` |
| X10 | Merchant dashboard browser tab is titled "FilsPay Checkout" | `apps/web/index.html`, `apps/web/src/pages/checkout/CheckoutPage.tsx` | fixed | `fix(X10)` |
| X11 | Merchant UI root URL renders React Router's unexpected application 404 | `apps/web/src/router.tsx` | fixed | `fix(X11)` |
| X12 | Merchant analytics accepts impossible dates and can return a database error | `apps/api/src/routes/analytics.ts` | fixed | `fix(X12)` |

### Deploy and setup (D)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| D1 | Migration 0054 references missing table | `db/migrations/` | fixed | `fix(D1)` |
| D2 | Migration 0055 uses non-existent columns | `db/migrations/` | fixed | `fix(D2)` |
| D3 | Dev webhook key fallback is 34 bytes, not 32 | `apps/api/src/config.ts` | fixed | `fix(D3)` |
| D4 | API has no CORS; dashboard can't call it | `apps/api/src/plugins/cors.ts` | fixed | `fix(D4)` |
| D5 | Dockerfiles referenced by compose are missing; settlement compose startup misconfigured | `ops/Dockerfile.node`, `ops/Dockerfile.go`, `ops/docker-compose.yml` | fixed | `fix(D5)` |

### FP-300 refunds (feature, last) (F)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| FP-300 | Refunds (F1–F13) | open | |
| F14 | Every refund crashes on insert: `reason` NULL vs 0070 CHECK | `apps/api/src/payments/processRefund.ts` | fixed | `feat(FP-300/F14)` |
| F1 | Refundable is authorized − refunded, so a partial capture can refund money never charged | `apps/api/src/payments/processRefund.ts` | fixed | `feat(FP-300/F1)` |
| F2 | Refund another merchant's transaction (IDOR) | `apps/api/src/refunds/initiateMerchantRefund.ts` | fixed | `feat(FP-300/F2)` |
| F3 | Concurrent refunds both pass (FP-209) and one overwrites the other's total | `apps/api/src/payments/processRefund.ts` | fixed | `feat(FP-300/F3)` |
| F6 | Refund route was a 501 stub at a different address than the dashboard posts to | `apps/api/src/routes/refunds.ts` | fixed | `feat(FP-300/F6)` |
| F13 | `transactions.test.ts` asserted the refund 501 | `apps/api/src/routes/transactions.test.ts` | fixed | `feat(FP-300/F6)` |

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

#### R2 Duplicate acquirer callback notes (FP-201)
- Where: `apps/api/src/acquirer/callbacks.ts`
- Clue: "The bank sent the same callback twice and we saved two identical notes on one payment."
- What's wrong: a redelivered acquirer callback with the same `callbackId` appends another note; five concurrent deliveries append five.
- Why: plain `INSERT` with no uniqueness constraint on `acquirer_callback_notes.callback_id`; the claimed `processed_events` table and FP-238 index were never built.
- What it breaks: duplicate rows corrupt the persisted acquirer callback history used for support and data review. No application reader or UI for these notes was found. Current code only appends a fraud-review note; it does not capture funds or change transaction state, despite the older postmortem's attribution of duplicate captures to this path.
- Fix: migration `0079_acquirer_callback_note_idempotency.sql` archives all but the earliest note per callback ID and adds a unique index. The insert uses `ON CONFLICT (callback_id) DO NOTHING`. Acquirer comparison docs confirm IDs remain stable across retries. · Proper fix: same; the database index is the concurrency backstop.
- Test: `apps/api/src/acquirer/callbacks.fix.test.ts` (2 notes on replay and 5 on concurrent deliveries failed before; one note after each, distinct callbacks still record separately) · ADR: none

#### R3 Duplicate settlement.paid notifications (2026-08-21)
- Where: `apps/settlement/internal/settlement/payout_notify.go`
- What's wrong: when the daemon and the CLI run together, both pass the `NOT EXISTS` check and each inserts a `settlement.paid` outbox event, so the merchant gets two payout webhooks and the dispatcher writes a second disbursement record.
- Why: check-then-insert with no unique index on `outbox_events`; the FP-208 advisory lock listed as "Done" does not exist.
- Fix: migration `0078_settlement_paid_event_idempotency.sql` archives later duplicate events and their referencing deliveries, and archives any extra disbursement rows per batch, before creating a partial unique index on `outbox_events(aggregate_id)` for `settlement.paid`. The enqueue uses `ON CONFLICT ... DO NOTHING` and counts only inserted rows. The local database had 44 duplicate event groups and no duplicate disbursement batches; removed rows are retained in reversible archives. · Proper fix: this is the database backstop plus atomic insert; the earlier `NOT EXISTS` remains a scan optimization.
- Test: `apps/settlement/internal/settlement/payout_notify_fix_test.go` starts concurrent scans and checks one event per batch, returned count matches inserted rows, and a sequential rerun adds zero. Failed before (stress run observed two events per batch); passes after, including 20 repetitions.

#### R5 Adjustment CSV can be imported twice
- Where: `apps/api/src/admin/adjustmentImport.ts`
- What's wrong: finance could apply the same balance-adjustment CSV twice, and every row was posted again.
- Why: nothing identified an import. There is no unique filename (the `am:` comment claiming one is false) and no content check; the route's own comment admitted "uploading the same csv twice posts it twice".
- What it breaks: a double click or a re-upload doubles every adjustment in the ledger and the cached balances (e.g. +4.750 / −1.250 BD applied twice).
- Fix: migration `0075_adjustment_import_content_hash.sql` adds `content_hash` with a unique index; the import hashes its parsed rows (merchant, amount in fils, reason, in order, as JSON) and answers 409 `duplicate_import` on a repeat, whatever the filename. Earlier imports keep NULL. Removed the two false comments. · Proper fix (if different): a preview / dry-run step and an explicit "apply again" override for a file that is meant to repeat (identical content is now always refused).
- Test: `admin/adjustmentImport.fix.test.ts` (same rows refused and nothing posted, renamed file refused, different amount/reason/order allowed, a reason with separators can't collide; two failed before) · ADR: 0005 (0075 is allowed)

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

#### M5 Lifetime payout estimate drifts
- Where: `apps/settlement/internal/settlement/payout_estimate.go`
- What's wrong: the merchant's lifetime net payout figure (ops dashboard) and the 30-day payout estimate drifted from the real totals.
- Why: the column was `REAL` (0040) and Go added each payout as `float32`; float32 is exact only up to 2^24 fils (16,777.216 BD). `EstimateMonthlyPayout` also summed in `float32`. Comments said "nobody reads it", but ops do (the seed even copied the float rounding with `Math.fround`).
- What it breaks: past 16,777.216 BD single fils vanish (16,777,216 + 1 + 1 + 1 stayed 16,777,216); 9,987,654,451 fils was stored as 9,987,654,656; the 30-day estimate (no caller yet) would flag payouts against a wrong figure.
- Fix: migration `0074_lifetime_payout_estimate_bigint.sql` (BIGINT, existing values rounded to whole fils); Go passes and sums `int64`/`money.Fils`; `EstimateMonthlyPayout` returns `money.Fils` (no callers); the seed sums integers. Widened the old test's read-back to `int64`. · Proper fix (if different): also recompute existing totals from paid batches (they keep their old drift); split payouts (`splits/allocate.go`) mark batches paid without bumping the estimate.
- Test: `settlement/payout_estimate_fix_test.go` (+1 fils above 2^24, a 9.98-billion-fil total, the 30-day estimate; all three failed before) · ADR: 0001, 0005 (0074 is allowed)

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

#### M10 Settlement summary double-counts multi-capture transactions
- Where: `apps/api/src/settlement/query.ts`
- What's wrong: `GET /v1/settlement/summary` overstated captured volume for merchants who capture in parts (Delta Wholesale about 38% over the batches, `docs/perf/2026-07-settlement-summary-slow.md`; single-capture merchants matched).
- Why: the query joined every capture event but summed `transactions.captured_fils`, the running total, once per event; and it counted the whole total even when only one part was captured in the window.
- What it breaks: a 5.000 BD transaction captured as 3.000 + 2.000 showed 10.000 BD; merchants and finance see a summary that disagrees with their payouts (the "timing difference" was double counting).
- Fix: sum `te.amount_fils`, the amount of each capture event in the window. · Proper fix (if different): same.
- Test: `settlement/summary.fix.test.ts` (two-part capture 5000 not 10000, only the in-window part, mixed single and three-part, empty; three failed before) · ADR: none

#### M11 Reconciliation pending figure uses the merchant's base rate
- Where: `apps/api/src/settlement/query.ts`
- What's wrong: the reconciliation report's "pending, not yet batched" net took each capture's fee from `merchants.mdr_bps`.
- Why: a comment said a "0046 trigger" keeps `mdr_bps` in sync with `fee_schedules`; 0046 is splits and no such trigger exists. Capture charges the effective-dated schedule rate minus the volume-tier bonus, so the two differ for any merchant with a schedule or in the tier, though the function's own docstring promises the capture rate.
- What it breaks: a 10.000 BD capture charged at a scheduled 200 bps showed 9.750 BD pending instead of 9.800 (or 9.765 in the tier), so the report showed an unexplained gap for exactly the merchants finance re-priced.
- Fix: use the fee each capture event recorded (`metadata.feeFils`, written by capture with the rate, schedule and tier of that moment) minus the discount adjustment; for events without it, the schedule in force at the event's time, else `mdr_bps`. Removed the false comment. · Proper fix (if different): store the fee as a column on `transaction_events` instead of reading JSON metadata.
- Test: `settlement/reconciliationPending.fix.test.ts` (recorded scheduled fee, recorded tier fee, schedule at event time ignoring a future one, no schedule → `mdr_bps`, discount off a recorded fee; three failed before) · ADR: none

#### M12 Unused promotional-discount parser reads BD as cents
- Where: `apps/api/src/payments/discountAdjustment.ts`
- What's wrong: `parsePromotionalDiscountFils` parsed a BD string with `parseFloat` and multiplied by 100.
- Why: cents arithmetic on a 3-decimal currency, through a float (breaks ADR-0001).
- What it breaks: nothing yet (no caller), but wired up it would book "1.250" BD as 125 fils, a tenth of the discount.
- Fix: deleted it (and its now-unused `BadRequestError` import), as the audit says; `parseBhdToFils` in `packages/money` is the parser to use. · Proper fix (if different): same.
- Test: `payments/discountAdjustment.fix.test.ts` (the export is gone, failed before; `parseBhdToFils` gives 1250 for "1.250", 1 for "0.001", rejects 4 decimals) · ADR: 0001

#### M13 Reconciliation pending fee uses float rates
- Where: `apps/api/src/fees/estimate.ts`
- What's wrong: the reconciliation report's "pending, not yet batched" figure estimated each capture's fee with float rates and `Math.round`.
- Why: `estimateFeeFils` computed `amount × mdr/10000 − that × discount/10000` in floats and rounded half up once; capture charges `applyRateFils(amount, rate)` (integer, banker's rounding) and the discount adjustment gives back `applyRateFils(fee, discountBps)`, each rounded on its own. Breaks ADR-0001.
- What it breaks: on .5 boundaries the estimate is a fil off per capture (20 fils at 250 bps: estimate 1, charged 0; 10.200 BD at 250 bps with 10% discount: 230 vs 229), so the report shows a gap that isn't there.
- Fix: integer `applyRateFils` for the fee and for the discount, the same two steps capture and the adjustment take. The rate it is given is still `merchants.mdr_bps`; that is M11.
- Test: `fees/estimate.fix.test.ts` (half-fil fee, discount rounding, ordinary/zero/large amounts all equal what capture + adjustment charge; two failed before) · ADR: 0001

#### M14 Scheme rounding residue never journaled
- Where: `apps/settlement/internal/settlement/batch.go`
- What's wrong: each scheme export line is truncated to 10 fils, but the 0–9 fils dropped per line were never booked.
- Why: ADR-0002 (status "implemented") says CloseBatch posts credit `card_scheme_clearing` / debit `scheme_rounding_residue` per line; no code did. Only the one-off March sweep ever posted residue (X2/X5).
- What it breaks: from April on the ledger, the settlement report and the scheme statement can't agree; a batch of 47.59 + 13.33 + 9.99 + 50.00 BD exports 120.70 BD against 120.91 BD gross with the 21 fils nowhere in the ledger, so finance has nothing to clear against the statement.
- Fix: in CloseBatch's export loop, each line with residue gets a balanced group (`card_scheme_clearing` credit / `scheme_rounding_residue` debit, with the transaction and batch ids), in the same transaction. Merchants' payable is untouched (the legs do show in the merchant's recent ledger activity, like capture's clearing legs). · Proper fix (if different): same; April–now batches already closed still lack their residue and need a one-off catch-up with finance (not done: never run scripts against data).
- Test: `settlement/residue_fix_test.go` (legs per line for 9 and 3 fils, none for round amounts, export + residue = gross, no merchant_payable leg; two failed before) · ADR: 0002 (now true)

#### M15 Balance rebuild can overwrite a concurrent batch close
- Where: `apps/settlement/internal/ledger/rebuild.go`
- What's wrong: the `rebuild-balances` CLI could leave a merchant's cached balance missing a batch close that ran at the same time.
- Why: `RebuildAllBalances` read the ledger total, then upserted `cached_payable_fils = total`. A batch close committing its ledger legs and cache increment in between was overwritten with the stale total (YA's TODO said so; nothing locked).
- What it breaks: a merchant with 5.000 BD settled and a 1.000 BD batch closing during the rebuild ends at 5.000 instead of 6.000 until the next rebuild; payouts read the cache.
- Fix: per merchant, make sure the cache row exists, lock it `FOR UPDATE`, then read the ledger: a batch close holding the row commits first and the ledger read then includes it. · Proper fix (if different): lock merchants in a fixed order (or one at a time in separate transactions) so a long rebuild can't deadlock with a multi-merchant split payout; today a deadlock just fails the manual CLI run.
- Test: `ledger/rebuild_fix_test.go` (a batch close holding the row while the rebuild runs; 5000 instead of 6000 before, 6000 now) · ADR: 0004 unchanged (the console button is M9's settled-data path)

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

#### T3 Recompute statuses always reports 0 open authorizations
- Where: `apps/api/src/admin/transactionStatusRecompute.ts`
- What's wrong: the console's "Recompute statuses" result said every merchant had 0 open authorizations.
- Why: the counter counted `authorized` rows inside a scan whose query excludes `status IN ('authorized', 'voided')`, so it could never count one. (It also drove the sandbox-flag clearing that T2 removed.)
- What it breaks: staff can't see a merchant's outstanding authorizations from this tool; anything trusting the number (as T2's flag logic did) acts on a false 0.
- Fix: count `status = 'authorized'` with its own query after the scan; the scan and its updates are unchanged.
- Test: `admin/transactionStatusRecompute.fix.test.ts` (two open authorizations counted, failed before with 0; none → 0; authorized and voided rows still neither scanned nor rewritten) · ADR: none

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

#### X4 Credit approval threshold can be split around
- Where: `apps/api/src/admin/creditThreshold.ts`
- What's wrong: manual credits above 50.000 BD need a second approver (ARCHITECTURE "maker-checker"), but one operator could credit more alone.
- Why: the check compared only the base amount, not base + the MDR reversal the merchant also receives (the FH/MK comment disagreed; the audit sides with FH), and judged each request alone, so 2 × 30.000 BD to one merchant posted with no second approver.
- What it breaks: the four-eyes control on money leaving the platform: 49.000 BD + 1.225 BD reversal (50.225 BD) or any number of smaller credits posted with one operator.
- Fix: compare base + reversal plus the merchant's other credits posted without a second approver in the last 24 hours (not rejected); the merchant row is locked `FOR NO KEY UPDATE` so two concurrent requests are judged in turn (review: `FOR UPDATE` would block FK inserts on the merchant and could deadlock with a balance adjustment). Credits that already had a second approval don't count. · Proper fix (if different): agree the window with finance (rolling 24h chosen here) and decide whether pending requests should count too.
- Test: `admin/credits.x4.fix.test.ts` (base + reversal over the limit, exactly 50.000 BD still one operator, a 30 + 30 split by one or two operators, other merchants, approved credits and >24h-old credits not counted, two concurrent 30.000 BD requests → one posts; four failed before) · ADR: none

#### X5 March sweep charges merchants the scheme residue
- Where: `scripts/reconcile_march.ts`
- What's wrong: the March residue sweep debited `merchant_payable` and credited `scheme_rounding_residue`, so merchants paid for the scheme's 2-decimal truncation.
- Why: the legs were the reverse of ADR-0002, which books residue as credit `card_scheme_clearing` / debit `scheme_rounding_residue` and never touches the merchant.
- What it breaks: each merchant's March payable was cut by its residue (70 fils across 13 lines in production, twice per X2), and the residue account moved the wrong way, so finance's monthly clearing against the scheme statement can't tie out.
- Fix: the sweep posts credit `card_scheme_clearing` / debit `scheme_rounding_residue` (same amounts, still one group per merchant). X2's test helper now reads the residue debit instead of the merchant debit. · Proper fix (if different): with finance, reverse the production postings already made (each run's merchant_payable debit and residue credit) and post the ADR-0002 legs once; not done here (never run scripts against data). Residue for April onward is M14.
- Test: `scripts/reconcile_march.x5.fix.test.ts` (no merchant_payable leg; legs are clearing credit / residue debit of 9 fils; both failed before; rolled back) · ADR: 0002

#### X6 Reporting stops for good on one malformed event
- Where: `apps/reporting/src/consumer/runConsumerPass.ts`
- What's wrong: a single outbox event the consumer can't apply (e.g. a `transaction.voided` payload with no `merchantId`) stopped all reporting permanently.
- Why: the whole batch runs in one transaction; the bad event's NOT NULL violation rolled back the pass, the watermark never moved, and every later pass re-selected the same event and failed again. The existing atomicity test locked this in (its "fix" was to delete the outbox row by hand). Seen in practice with Q2's test rows.
- What it breaks: dashboards and rollups freeze at the bad event for every merchant until someone edits `outbox_events`.
- Fix: each event runs in a SAVEPOINT. A data error (Postgres 22xxx/23xxx, JS TypeError/RangeError) rolls back only that event, records it in the new `reporting_dead_letter_events` (migration 0076), logs it, and the pass continues; any other error (connection, serialization, missing table) still rolls back the whole pass for a retry. Updated the atomicity test to prove that with an injected connection error (`runConsumerPass` takes an optional `apply` for this). · Proper fix (if different): an admin view and replay for dead-lettered events, and validating payloads when they are enqueued. Tradeoff: a TypeError/RangeError from a code bug (not the payload) also sets the event aside rather than blocking; it is logged and recorded for replay.
- Test: `consumer/runConsumerPass.x6.fix.test.ts` (bad event between two good ones: both apply, watermark moves, event recorded; not re-recorded next pass; the error classifier; first two failed before with the not-null violation) · ADR: 0005 (0076 is allowed)

#### X8 Reporting crashes on its own lag check
- Where: `apps/reporting/src/consumer/applyEvent.ts`
- What's wrong: when a settlement batch closes for a day that has captures but no reporting rollup row, the reporting worker throws and stops.
- Why: the "rollup lags ground truth" check read `captured_count` from a row it assumed exists; a missing row is exactly the lag it is meant to detect.
- What it breaks: the reporting pass rolls back and retries the same event forever, so every dashboard total stops updating for all merchants.
- Fix: treat a missing rollup row as 0 and log the lag warning.
- Test: `reporting/consumer/applyEvent.fix.test.ts` (crashed before, warns and records the payout trend now); reporting suite 12/12 · ADR: none

### Merchant UI findings (X)

#### X12 Analytics accepts impossible calendar dates
- Where: `apps/api/src/routes/analytics.ts`
- Clue: the `isValidDateString` comment promises invalid calendar dates are rejected, but it only checks whether `Date.parse` returns `NaN`.
- What's wrong: JavaScript normalizes dates such as `2026-02-30` to March 2, so the validator accepts the impossible date and passes the original string to PostgreSQL.
- Why: `Date.parse` validates parseability, not an exact calendar-date round trip.
- What it breaks: analytics and overview requests using an impossible `from` or `to` can fail as a server error instead of returning the documented 400 validation error.
- Fix: validate year, month, and day bounds directly, including leap-year month lengths, before querying.
- Test: `apps/api/src/routes/analytics.x12.fix.test.ts` (impossible February dates and month 13 rejected; valid leap day accepted); failed before because 2026-02-30 returned true · ADR: none · Commit: `fix(X12)`

#### X11 Merchant UI root URL has no route
- Where: `apps/web/src/router.tsx`
- Clue: browser output showed React Router's default "Unexpected Application Error! 404 Not Found" and its generic ErrorBoundary guidance.
- What's wrong: the router defines checkout and `/dashboard/*` paths but no `/` route or catch-all route.
- Why: the root path falls through React Router's default unmatched-route error screen.
- What it breaks: opening the merchant UI at its base URL displays a developer error instead of taking the user to login or the dashboard.
- Fix: add a root redirect to `/dashboard` (which already routes to transactions and enforces authentication).
- Test: `apps/web/src/router.x11.fix.test.ts` (failed before because root had no redirect; passes now) · ADR: none · Commit: `fix(X11)`

#### X9 Reconciliation page crashes when gapFils is negative
- Where: `apps/web/src/format.ts`, `apps/web/src/pages/settlement/ReconciliationPage.tsx`
- Clue: `format.ts` comment says `toFils` throws for negative values; reconciliation comments say nonzero gaps can be real.
- What's wrong: the reconciliation report renders `gapFils` through `bhd()`, which calls `toFils()` with negative values disabled.
- Why: a negative reconciliation difference is valid, but the shared display helper only accepts nonnegative amounts.
- What it breaks: loading a report with a negative gap throws during render, so the merchant cannot view the reconciliation report.
- Fix: allow signed fils in the display-only formatter; input validation still rejects negative payable amounts.
- Test: `apps/web/src/format.x9.fix.test.ts` (negative one fil and negative 1,234 fils); failed before with RangeError · ADR: 0001 · Commit: `fix(X9)`

#### X10 Merchant dashboard has checkout page title
- Where: `apps/web/index.html`
- Clue: `fix-docs/merchant-ui-comment-leads.md` retains the source comment: "title says Checkout but this is the whole dashboard too."
- What's wrong: all merchant UI routes used the document title `FilsPay Checkout`.
- Why: the title is hard-coded in the shared SPA HTML entry point.
- What it breaks: browser tabs/history label the merchant dashboard as checkout, making multiple FilsPay pages hard to distinguish and presenting the wrong page identity.
- Fix: set the base title to `FilsPay Dashboard`; the public checkout route temporarily sets `FilsPay Checkout` and restores the dashboard title on unmount.
- Test: `apps/web/src/documentTitle.x10.fix.test.ts` (fails against the old title, passes with dashboard title) · ADR: none · Commit: `fix(X10)`

### Deploy and setup (D)

#### D5 Compose services cannot build or start
- Where: `ops/Dockerfile.node`, `ops/Dockerfile.go`, `ops/docker-compose.yml`
- What's wrong: Compose referenced missing Dockerfiles; once added, settlement received an invalid subcommand and lacked its required internal token.
- Why: the image build definitions were absent and compose's command/environment disagreed with the binary entrypoint and daemon config.
- What it breaks: the documented Docker startup cannot build or keep settlement running, preventing local use of the API's settlement functions.
- Fix: add Node and Go multi-stage Dockerfiles; pass `daemon` to the Go entrypoint and provide the local `dev-token`.
- Test: `docker compose -f ops/docker-compose.yml config`, image build, migrations through 0077, seed, and all core containers running · ADR: none · Commit: pending
- Conflicts: squash merge overlapped D4/D5 tracker rows; kept main's fixed D4 row and D5's new fixed row.

#### D1 Migration 0054 breaks a fresh database (and uses a reserved number)
- Where: `db/migrations/`
- What's wrong: `npm run migrate` on an empty database stopped at `0054_views.sql`; 0054–0056 also use numbers ADR-0005 reserves for settlement v2.
- Why: 0054 created `v_unbatched_capture_events` on `settlement_batch_events`, a table no migration creates (existing databases only got past it by having that table from elsewhere).
- What it breaks: every new environment (the new deployment server, a new developer, CI) cannot be built from migrations.
- Fix: per the owner decision (ADR-0005 wins), deleted `0054_views.sql` and `0056_api_keys_revoke_after.sql` and added `0077_views_and_revoke_after.sql`, idempotent so old and fresh databases end the same: keeps `v_active_api_keys` and `api_keys.revoke_after`, drops `v_unbatched_capture_events` (never worked) and `merchant_payable_position` (the decision kept it because M9's button read it; since M9 nothing does, and it summed gross export lines, a wrong figure). Old filenames stay recorded in `schema_migrations`, which the runner ignores. 0055 is D2. · Proper fix (if different): same.
- Test: `db/migrate.fix.test.ts` (a fresh migrate on a throwaway database no longer stops on `settlement_batch_events`, failed before; no 0054/0056 files; an already-migrated database has 0077's objects) · ADR: 0005, 0004 (no reader of the dropped view)

#### D2 Migration 0055 uses columns that don't exist
- Where: `db/migrations/`
- What's wrong: after D1, a fresh `npm run migrate` stopped at `0055_chart_of_accounts_suspense.sql`.
- Why: it inserted `(code, name, account_type, description)` into `chart_of_accounts`, whose columns are `(id, name, kind)`, with kind `'suspense'`, which its CHECK (`asset`/`liability`/`revenue`) rejects. It also used a number ADR-0005 reserves.
- What it breaks: same as D1, no new environment can be built from migrations.
- Fix: deleted it (the owner decision allowed "fix or drop"). Its two accounts (`fx_rounding_difference`, `chargeback_suspense`) are used nowhere and had no valid kind. A fresh migrate now runs to the end. · Proper fix (if different): add the accounts in a new migration if a chargeback or FX lane is ever built, with a kind the CHECK allows.
- Test: `db/migrate.d2.fix.test.ts` (a fresh migrate on a throwaway database runs to the end, failed before at 0055; no 0054–0056 files; the fresh database has 0077's objects and the ledger accounts) · ADR: 0005

#### D3 Dev webhook key fallback is 34 bytes
- Where: `apps/api/src/config.ts`
- What's wrong: outside production, an API started without `WEBHOOK_SECRET_ENCRYPTION_KEY` refused to boot.
- Why: the built-in development fallback `DEV_FALLBACK_WEBHOOK_KEY_B64` decoded to 34 bytes ("test-key-for-dev-only-not-for-prod"); `loadConfig` requires exactly 32 (AES-256), so it rejected its own fallback.
- What it breaks: a fresh dev or test setup fails at start with "must base64-decode to exactly 32 bytes, got 34" until someone generates a key by hand.
- Fix: the fallback is a 32-byte dev-only string. Production still requires the variable. Nothing was ever encrypted with the old value (it could not load), so no stored secrets change.
- Test: `config.fix.test.ts` (development and test boot with a 32-byte key, failed before with "got 34"; production still refuses; an explicit key wins) · ADR: none

#### D4 API sends no CORS headers; the dashboard can't call it
- Where: `apps/api/src/plugins/cors.ts`
- What's wrong: the merchant dashboard (`apps/web`, :5173) and the ops console (`apps/admin`, :5174) call the API on :3000 with `credentials: "include"`, but the API answered no CORS, so the browser blocked every call (the MK comment "CORS is locked to the two origins in config" was false: there was no CORS at all).
- Why: no CORS handling was ever registered (`@fastify/cors` isn't a dependency).
- What it breaks: neither screen works in a browser unless served from the API's own origin.
- Fix: a small `corsPlugin` (no new dependency) allows exactly `config.corsOrigins` with credentials, `Vary: Origin`, and answers preflights 204 with the methods and the requested headers. `CORS_ORIGINS` (comma-separated) sets the list; default is the two local dev origins outside production and none in production. Documented in ARCHITECTURE's settings table. · Proper fix (if different): `@fastify/cors`, or serve web/admin and the API from one origin behind the deployment's reverse proxy (no CORS needed).
- Test: `plugins/cors.fix.test.ts` (dashboard and console origins allowed with credentials, preflight 204 with methods/headers, other origins get nothing, `CORS_ORIGINS` replaces defaults, production empty by default; five failed before) · ADR: none
- Follow-up (2026-10-30): `ops/.env.docker.example` now lists `CORS_ORIGINS=http://localhost:5173,http://localhost:5174` with a note. Local-testing values only; the deployment server must set the real web and admin origins (unknown yet). Checked with `docker compose config`: compose has no `env_file`, so `ops/.env.docker` never reaches the containers (the compose comment saying it is "picked up automatically" is wrong). The Docker API runs in development mode, where these origins are already the default, so D4 never blocked local Docker testing. The same means that file's `NODE_ENV=production` and acquirer secret aren't applied either.

### FP-300 refunds (feature, last) (F)

Plan: `docs/superpowers/plans/2026-10-30-fp-300-refunds.md`.

#### F6 Refund route: 501 stub, and two addresses (F13 included)
- Where: `apps/api/src/routes/refunds.ts`
- What's wrong: `POST /v1/refunds` answered 501; the dashboard's (commented-out) RefundDrawer posted to `/v1/merchants/:id/refunds`, which didn't exist.
- Why: the feature was never wired; comments disagreed on which address was right.
- What it breaks: no refunds at all, from the API or the dashboard.
- Fix: user decision (2026-10-30): keep the documented `/v1/refunds` for API-key integrations and add `/v1/merchants/:merchantId/refunds` for the dashboard; one handler. `requireMerchantAuth` + `requireMerchantRole("owner","finance")` (API keys pass by design); `Idempotency-Key` required (≤ 255 chars); body `{ transactionId (uuid), amountFils? (positive whole fils), reason? (≤ 500 chars, no NUL) }`; the merchant always comes from the login, and the scoped address also checks the path (`assertRefundRequestScope`). Review: validation errors came back as `{ ok:false, code }` with no `error`, so the drawer showed nothing; `processRefund` now answers `{ error, ...details }` like the rest of the API (three existing tests updated). Long keys and NUL reasons gave 500s; now 400. RefundDrawer restored on the transaction detail page, also for `partially_refunded`. ONBOARDING's refund table updated. F13: the 501 test in `routes/transactions.test.ts` now checks the route answers (400 on an empty body); its cross-tenant comment points at the new tests. · Proper fix (if different): same; the drawer could map error codes to friendly text.
- Test: `routes/refunds.fix.test.ts` (43 cases, run against both addresses: API key, owner and finance sessions refund; support 403; no login 401; missing key 400; replay returns the same body and refunds once; another merchant's transaction 404; refunds on hold 403; bad bodies 400; over-long key and bad reasons 400; over-limit refund gives `{ error, refundableFils }`; impersonation 403; scoped address with a foreign path merchant 403). 29 failed before (the route was a stub) · ADR: none

#### F3 Concurrent refunds both pass (FP-209)
- Where: `apps/api/src/payments/processRefund.ts`
- What's wrong: two refunds of 6 000 fils on a 10 000 capture, sent together, both succeeded; two that fit (3 000 + 4 000) left `refunded_fils` at 4 000.
- Why: step 1 read the transaction without a lock and committed before the acquirer call, so both refunds validated against the same total; step 3 then wrote `refunded_fils` as an absolute value.
- What it breaks: more money back than was captured, and a `refunded_fils` that understates what went back (so a further refund is allowed too).
- Fix: step 1 `SELECT … FOR UPDATE` (now also `AND merchant_id = $2`, the F2 follow-up) and reserves the amount (`refunded_fils + amount`) before the acquirer call; step 3 releases it on a decline or error and recomputes status; on success it sets only `status`, from `refunded_fils` and `captured_fils` re-read under the lock (review: a capture can land during the acquirer call). · Proper fix (if different): a `pending` refund row written in step 1, so a crash between steps 1 and 3 can't strand a reservation and in-flight amounts are visible as such.
- Known limits while another refund is in flight (record, not fixed): the status, event type and webhook `refundedTotalFils` include the other refund's reservation; if that one is then declined, the release corrects the status but not the event already emitted. `admin/transactionStatusRecompute.ts` can likewise see a reservation; the next refund step corrects it.
- Test: `payments/processRefund.f3.fix.test.ts` (a gated fake acquirer makes the race deterministic: 6 000 + 6 000 gives one 200 and one 422, `refunded_fils` 6 000, one refund row; 3 000 + 4 000 both count, 7 000; declined and errored refunds release the reservation and a retry works; another merchant's id is a 404 in `processRefund` itself; a capture during the acquirer call is used for the status). The race and scope tests failed before · ADR: 0001

#### F2 Refund another merchant's transaction
- Where: `apps/api/src/refunds/initiateMerchantRefund.ts`
- What's wrong: merchant B sending merchant A's transaction id got the refund processed against A's payment.
- Why: the lookup was `WHERE id = $1` and the refund then ran under the row's own `merchant_id`, never the caller's.
- What it breaks: any merchant could push money out of any other merchant's payments (once the route is wired, F6).
- Fix: `WHERE id = $1 AND merchant_id = $2` with the caller's merchant; a foreign id is a 404 `transaction_not_found`, same as a missing one, so it doesn't reveal the id exists. · Proper fix (if different): also scope `processRefund`'s own lookup by merchant (done in F3, which rewrites that query).
- Test: `refunds/initiateMerchantRefund.f2.fix.test.ts` (B refunding A's transaction is a 404 and nothing changes, failed before; A's own refund works) · ADR: none

#### F1 Refund more than was captured
- Where: `apps/api/src/payments/processRefund.ts`
- What's wrong: on a payment authorized for 10 000 fils and captured for 4 000, a refund of 5 000 succeeded, and a refund with no amount returned 10 000.
- Why: the refundable amount was `amount_fils` (authorized) − `refunded_fils` instead of `captured_fils` − `refunded_fils`.
- What it breaks: merchants could send cardholders money that was never taken from the card; the platform pays the difference.
- Fix: `subtractFils(capturedFils, refundedFils)`. `refundValidation.test.ts` built its sample data the old way and called it "by design"; corrected. · Proper fix (if different): same.
- Test: `payments/processRefund.f1.fix.test.ts` (5 000 on a 4 000 capture gives 422 with `refundableFils: 4000`; exactly 4 000 works and then nothing is left; no amount refunds 4 000). All three failed before · ADR: 0001

#### F14 Every refund crashes on insert
- Where: `apps/api/src/payments/processRefund.ts`
- What's wrong: every refund without a reason failed with `violates check constraint "chk_refunds_reason_not_null"`.
- Why: the insert passed `reason` as an explicit `NULL`; 0070's column `DEFAULT 'unspecified'` only applies when the column is left out, and its CHECK rejects NULL.
- What it breaks: no refund could ever be recorded (the 11 baseline refund test failures).
- Fix: insert `input.reason ?? "unspecified"`. The idempotency request hash still uses the reason as given. · Proper fix (if different): same.
- Test: `payments/processRefund.f14.fix.test.ts` (no reason stores `unspecified`, failed before with the CHECK error; a given reason is kept). Shared setup for the FP-300 tests lives in `payments/refundTestSupport.ts`. The 11 refund baseline failures pass now · ADR: none

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
