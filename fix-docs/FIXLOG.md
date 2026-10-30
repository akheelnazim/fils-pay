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
| R6 | A payment link reservation can expire during capture, allowing another charge | `apps/api/src/paymentLinks/pay.ts` | fixed | `fix(R6)` |
| R7 | Uncertain payment-link captures require manual reconciliation | `apps/api/src/paymentLinks/recover.ts`, `apps/api/src/routes/adminPaymentLinks.ts`, `docs/RUNBOOK.md` | fixed | `fix(R7)` |

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
| M16 | Scheme export stores a duplicate decimal amount instead of integer fils | `db/migrations/0050_scheme_export_lines_acquirer_amount.sql`, `apps/settlement/internal/settlement/` | fixed | `fix(M16)` |
| M17 | Go rate and split calculations can overflow before division | `apps/settlement/internal/money/fils.go`, `apps/settlement/internal/splits/shares.go` | fixed | `fix(M17)` |
| M18 | Split payouts do not update the lifetime payout estimate | `apps/settlement/internal/splits/allocate.go` | fixed | `fix(M18)` |
| M19 | Historical lifetime payout estimates retain drift and missing split payouts | `apps/settlement/internal/settlement/payout_estimate.go` | partly fixed: report added, correction waits on Finance | `fix(M19)` |
| M20 | Monthly payout estimate overstates partially allocated split payouts | `apps/settlement/internal/settlement/payout_estimate.go` | fixed | `fix(M20)` |

### Settlement timing and test merchants (T)

| ID | Bug | Where | Status | Commit |
| --- | --- | --- | --- | --- |
| T1 | Daily close runs 03:00 Bahrain, not midnight | `apps/settlement/internal/scheduler/daemon.go` | fixed | `fix(T1)` |
| T2 | Admin tool flips test merchants into settlement | `apps/api/src/routes/adminMerchantsRecompute.ts` | fixed | `fix(T2)` |
| T3 | Recompute statuses reports `openAuthorizations` as always 0 (its query excludes `authorized` rows) | `apps/api/src/admin/transactionStatusRecompute.ts` | fixed | `fix(T3)` |
| T4 | Invalid settlement polling interval crashes the daemon | `apps/settlement/internal/config/config.go` | fixed | `fix(T4)` |

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
| X13 | A request body that isn't valid JSON gets 500 `internal_error` instead of 400 (every route) | `apps/api/src/plugins/errorHandler.ts` | fixed | `fix(X13)` |
| X14 | March sweep production postings need Finance reconciliation | `production ledger / scripts/reconcile_march.ts` | open | |

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
| FP-300 | Refunds (F1–F15), closed by one end-to-end test | `apps/api/src/refunds/refund.e2e.fix.test.ts` | fixed | `test(FP-300)` |
| F14 | Every refund crashes on insert: `reason` NULL vs 0070 CHECK | `apps/api/src/payments/processRefund.ts` | fixed | `feat(FP-300/F14)` |
| F1 | Refundable is authorized − refunded, so a partial capture can refund money never charged | `apps/api/src/payments/processRefund.ts` | fixed | `feat(FP-300/F1)` |
| F2 | Refund another merchant's transaction (IDOR) | `apps/api/src/refunds/initiateMerchantRefund.ts` | fixed | `feat(FP-300/F2)` |
| F3 | Concurrent refunds both pass (FP-209) and one overwrites the other's total | `apps/api/src/payments/processRefund.ts` | fixed | `feat(FP-300/F3)` |
| F4 | Refund fee reversal ignores the negotiated discount (reverses more than was kept) | `apps/api/src/payments/processRefund.ts` | fixed | `feat(FP-300/F4)` |
| F5 | Partial refunds' fee reversals can exceed the fee, or fall short when everything is returned | `apps/api/src/payments/processRefund.ts` | fixed | `feat(FP-300/F5)` |
| F6 | Refund route was a 501 stub at a different address than the dashboard posts to | `apps/api/src/routes/refunds.ts` | fixed | `feat(FP-300/F6)` |
| F13 | `transactions.test.ts` asserted the refund 501 | `apps/api/src/routes/transactions.test.ts` | fixed | `feat(FP-300/F6)` |
| F7 | `refund.succeeded` never sent to webhooks (no envelope case, not in the eligible list) | `apps/api/src/webhooks/dispatcher.ts` | fixed | `feat(FP-300/F7)` |
| F8 | Settlement ignores refunds: the payout isn't reduced | `apps/settlement/internal/settlement/batch.go` | fixed | `feat(FP-300/F8)` |
| F9 | Reporting has no refund case; the daily rollup has no refund columns and buckets by UTC | `apps/reporting/src/consumer/applyEvent.ts` | fixed | `feat(FP-300/F9)` |
| F15 | `refund_merchant_summary` joined on the wrong id, so it was always empty | `db/migrations/0083_refund_merchant_summary_join.sql` | fixed | `feat(FP-300/F15)` |
| F10 | Reconciliation's pending figure leaves out refunds, so they show as a gap | `apps/api/src/settlement/query.ts` | fixed | `feat(FP-300/F10)` |
| F11 | Transaction responses lack `refundedFils` | `apps/api/src/transactions/serialize.ts` | fixed | `feat(FP-300/F11)` |
| F12 | A full refund of a partial capture stayed `partially_captured` | `apps/api/src/payments/refundState.ts` | fixed | `feat(FP-300/F12)` |
| F16 | Fee recalculation can push a refunded batch's net payout below zero | `apps/settlement/internal/settlement/recalculate_mdr.go` | fixed | `feat(FP-300/F16)` |
| F17 | A refund's status, event and webhook count other refunds still in flight | `apps/api/src/payments/processRefund.ts` | fixed | `feat(FP-300/F17)` |

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

## Findings and follow-ups from later review

#### R6 Reservation can expire while a payment-link capture is in progress
- Where: `apps/api/src/paymentLinks/pay.ts`
- What's wrong: after R1 refreshed the reservation, a capture could outlast the timeout and another buyer could claim the link. Both captures could succeed; the first buyer received a 409 after being charged.
- What it breaks: one link could charge two buyers; the losing capture was logged for a refund but not automatically refunded.
- Fix: migration 0081 records the capture transaction on the reserved link before capture; a marked reservation cannot expire or be reclaimed. Definite declines release it; uncertain outcomes and crashes keep it for review. Public status remains processing, and checkout tells the buyer to contact the merchant when the outcome is uncertain. Existing R1 tests expecting takeover during capture were updated. · Proper fix: automated, idempotent recovery after checking the acquirer outcome (R7). Rollout must drain old API workers and reconcile pre-migration reservations; see `docs/RUNBOOK.md`.
- Test: `paymentLinks/pay.r6.fix.test.ts` (slow capture allowed the second buyer to pay before: `200 !== 409`; now blocked; uncertain and thrown errors stay locked; definite decline releases) and `checkout/checkoutError.r6.fix.test.ts` (uncertain outcomes do not invite retry).

#### R7 Uncertain payment-link captures need a recovery workflow
- Where: `apps/api/src/paymentLinks/pay.ts`, `docs/RUNBOOK.md`
- What's wrong: R6 keeps a link processing after an uncertain capture outcome or crash, but the application has no automated resolution or operator interface.
- What it breaks: an affected link remains unavailable until support and Finance reconcile its transaction and acquirer outcome.
- Next: add audited, idempotent recovery that checks the acquirer before finalizing or releasing the link. Never clear a marker or retry a charge based only on the local transaction status.
- Fix (user decision 2026-10-30: operator-attested recovery): the acquirer interface has no lookup and the simulator keeps no state, so "check the acquirer" cannot be automatic. New `POST /v1/admin/payment-links/:id/recover-capture` (finance / super_admin), body `{ attestedOutcome: "captured" | "not_captured", reason (5–500 chars) }`, where the operator reports what they verified at the acquirer. `recoverPaymentLinkCapture` locks the link and its marked transaction and acts only if the local books agree: `captured` finalizes the link as paid only when the transaction is captured here for the full link amount (else 409 `ledger_not_reconciled`: Finance books the capture first); `not_captured` releases the link and voids the dangling authorization (after commit, best effort) only when no capture is recorded here (else 409 `local_books_show_capture`). One `admin_audit_log` row (`payment_link_capture_recovery`, target `payment_link`) in the same transaction; repeating the same report is a 200 no-op with no second row, a different later report is 409. Never retries a charge and never clears the marker on local status alone. RUNBOOK updated. · Proper fix (if different): a real acquirer inquiry (`lookup` on the acquirer interface) so the check is automatic, with the operator route as the fallback; reservations created before migration 0081 have no marker and still need the manual path.
- Follow-up (Opus overall review): a recovery run while a payment is still in flight could release the link and then let that payment capture, charging the card with the link open again. Recovery is now refused (409 `recently_reserved`) until the reservation is 15 minutes old. Known: a repeat of an earlier `not_captured` report on a link later paid normally still answers `alreadyResolved` (accurate status, loose wording); "Finance books the capture first" is a ledger correction outside this route.
- Test: `paymentLinks/recover.r7.fix.test.ts` (a reservation under 15 minutes old is refused; captured with agreeing books → paid, audit row, repeat is a no-op; captured with no local capture → 409, untouched; not captured → released, authorization voided, repeat no-op, opposite report 409; not captured with a local capture → 409; healthy link, unknown link, bad bodies, no login, support role all refused). The route did not exist before · ADR: none

#### M17 Integer overflow in Go rate and split calculations
- Where: `apps/settlement/internal/money/fils.go`, `apps/settlement/internal/splits/shares.go`
- What's wrong: multiplication occurs in `int64` before division; a valid large fils amount can overflow even when the final result would fit. For example, 1,000,000,000,000,000 fils at 10,000 bps overflows the intermediate product.
- What it breaks: extreme-value fees or split shares can be incorrect. Establish supported limits and check both shared rate calculation and split allocation before fixing.
- Fix: exact integer intermediates preserve half-to-even rounding and split remainders; checked results and totals return errors through batch close, MDR recalculation, and split payout rather than silently overflowing. Unrepresentable calculations roll back.
- Test: `money/rate_m17_fix_test.go`, `splits/shares_m17_fix_test.go`, and `settlement/discounted_fee_m17_fix_test.go` cover large rates and splits, unrepresentable values, and database rollback. Before fixing, 1,000,000,000,000,000 fils at 10,000 bps returned -844,674,407,370,955; the large split lost a fil. Full Go suite passed.

#### M18 Split payouts do not update the lifetime payout estimate
- Where: `apps/settlement/internal/settlement/payout_estimate.go`, `apps/settlement/internal/splits/allocate.go`
- What's wrong: split payout processing marked batches paid without updating the parent merchant's lifetime payout estimate.
- What it breaks: the monitoring estimate omits split payouts, even after M5 fixed its arithmetic.
- Fix: increment the estimate by the amount actually allocated to children in the payout transaction; the existing paid-state check prevents replay from adding it twice. · Proper fix: share the update helper between ordinary and split payout paths instead of duplicating its SQL.
- Test: `splits/payout_estimate_m18_fix_test.go` (full, partial and zero allocation; replay). Before the fix a 10,001-fils split left an estimate of 100 rather than 10,101.

#### M19 Historical lifetime payout estimates need reconciliation
- Where: `apps/settlement/internal/settlement/payout_estimate.go`
- What's wrong: M5 converted old float estimates to integer fils without rebuilding drifted historical totals; past split payouts were also omitted before M18.
- Next: reconcile historical actual payouts with Finance before any correction. Do not blindly sum batch net payouts: a split can allocate less than its batch net.
- Done (report only): `settlement payout-estimate-report` (`LifetimePayoutEstimateDrift`) lists every merchant whose stored estimate differs from the payout legs in the ledger (`platform_cash` credits described `settlement payout:%`, which covers whole-batch payouts and split payouts, so a split that allocates less than its batch net is counted at what was paid). Read-only; nothing is written. Finance can run it, agree each figure, and only then correct the stored values. Not done: the correction itself (a data change on production totals, by the item's own note a Finance decision). Run it only against a database you intend to read; it does not modify data. · Proper fix (if different): once Finance agrees, a one-off audited correction migration, or derive the estimate from the ledger instead of keeping a running total.
- Test: `settlement/payout_estimate_m19_fix_test.go` (stored 5 000 vs 6 200 paid is reported as −1 200 including a split payout; matching and empty merchants are not reported; the report writes nothing). Failed before: build error, no report existed · ADR: none

#### M20 Monthly payout estimate overstates partially allocated splits
- Where: `apps/settlement/internal/settlement/payout_estimate.go`
- What's wrong: `EstimateMonthlyPayout` sums the full net amount of paid batches even when only part of a split batch was allocated to children. No production caller was found in the M5 audit.
- What it breaks: a monitoring estimate can report more than the amount actually paid when split weights total less than 100%.
- Fix: sum recognized payout ledger credits for paid batches; retain zero-valued split audit rows so zero allocations can be distinguished from missing history. Ambiguous historical rows return an error rather than silently reporting zero. · Proper fix: use a durable typed payout record instead of matching ledger descriptions and reconcile legacy history.
- Test: `settlement/payout_estimate_m20_fix_test.go` covers ordinary, full, partial, zero and historical payouts; before the fix the estimate was 30,001 instead of 22,500 fils. Updated M5's fixture to include the payout ledger entries it represents.
- Conflicts: `fix-docs/FIXLOG.md`: main recorded M19's read-only report while M20 marked its estimate fix complete; kept both status updates.

#### T4 Invalid settlement polling interval crashes the daemon
- Where: `apps/settlement/internal/config/config.go`, `apps/settlement/internal/scheduler/daemon.go`
- What's wrong: zero, negative and excessively large polling intervals pass config parsing but `time.NewTicker` panics after duration conversion.
- What it breaks: the settlement daemon cannot start with those settings; daily close stops until configuration is corrected.
- Fix: reject intervals outside the positive whole-second range representable by `time.Duration`. Config loading also applies this check to one-shot commands.
- Test: `config/poll_interval_fix_test.go` covers zero, negative, overflow boundary and valid values; zero and negative failed before with `poll interval 0 must be rejected` / `poll interval -1 must be rejected`.

## Audit check (2026-10-29)

All audit claims hold in the code. S1, S2 reproduced on the running API; M1 by calling the parser.

Corrections:
- R1: finalize and release both key only on status, so either buyer can finish or release the other's hold.
- M4: real error is 3 fils at 123,456.789 BD.
- M7: wrong rate shows in the staff console, not the merchant dashboard.
- X1: the expire-not-delete fix needs `scripts/expire_holds.test.ts` updated.

## Against the ADRs (rules the code must follow)

- ADR-0001 (integer fils, BIGINT, `parseBhdToFils`, no floats): backs M1, M4, M5, M6, M12, M13,
  and M16. M16 removes the decimal scheme amount and stores the export snapshot as integer
  `exported_amount_fils`; two decimals are formatted only at the file boundary. Other `toFixed`/float
  hits are rate labels and progress bars, not money. Audit fixes for M3 (`allocateRemainder`) and
  F5 (`bankersRoundDiv`) comply.
- ADR-0002 (residue journaled in CloseBatch): M14 now posts each residue in a balanced ledger group.
  New scheme rows export the amount truncated to 10 fils (M2); M16 keeps historical export snapshots
  in integer fils so rerunning old batches retains the original file amount. X5 is fixed: the March
  script books residue between `card_scheme_clearing` and `scheme_rounding_residue`.
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
- Fix: migration `0074_lifetime_payout_estimate_bigint.sql` (BIGINT, existing values rounded to whole fils); Go passes and sums `int64`/`money.Fils`; `EstimateMonthlyPayout` returns `money.Fils` (no callers); the seed sums integers. Widened the old test's read-back to `int64`. · Proper fix (if different): historical totals retain old drift and need reconciliation (M19); split payouts now update the estimate (M18).
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

#### M16 Scheme export stores a decimal amount instead of integer fils
- Where: `db/migrations/0050_scheme_export_lines_acquirer_amount.sql`, `apps/settlement/internal/settlement/`
- What's wrong: `scheme_export_lines.amount` stores a BD decimal alongside `amount_fils`, contrary to ADR-0001.
- Why: migration 0050 added a persisted decimal copy of each scheme-format amount.
- What it breaks: the database contains a decimal money value, contrary to the integer-fils storage rule.
- Fix: migration 0080 backfills `exported_amount_fils` from the old decimal snapshot (or from `amount_fils` when NULL), then drops `amount`. New close batches and seed data store both integer-fils values; the exporter formats the saved export fils at the file boundary, preserving historical re-exports. · Proper fix (if different): none.
- Test: `settlement/scheme_export_m16_fix_test.go` (schema has no decimal amount; exact file formatting and a historic rounded export snapshot preserved; failed before) · ADR: 0001, 0002 · Commit: `fix(M16)`

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
- What it breaks: each extra run takes the March residue (70 fils across 13 lines) out of merchant payables again, doubling finance's gap. Staging was run twice; production's run count is unverified and is tracked as X14.
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
- What it breaks: each run cut merchant payables by the residue (70 fils across 13 lines) and moved the residue account the wrong way. Whether production has duplicate postings is unverified; see X14.
- Fix: the sweep posts credit `card_scheme_clearing` / debit `scheme_rounding_residue` (same amounts, still one group per merchant). X2's test helper now reads the residue debit instead of the merchant debit. · Proper fix (if different): with finance, reverse the production postings already made (each run's merchant_payable debit and residue credit) and post the ADR-0002 legs once; not done here (never run scripts against data). Residue for April onward is M14.
- Test: `scripts/reconcile_march.x5.fix.test.ts` (no merchant_payable leg; legs are clearing credit / residue debit of 9 fils; both failed before; rolled back) · ADR: 0002

#### X13 Malformed JSON returns an internal server error
- Where: `apps/api/src/plugins/errorHandler.ts`
- What's wrong: malformed or empty JSON is reported as a 500 rather than a client error.
- Why: Fastify's JSON parser errors have codes but no schema validation property, so they fell through to the generic error handler.
- What it breaks: clients receive a misleading server error for invalid input and the server logs it as an unhandled failure.
- Fix: map Fastify's invalid and empty JSON error codes to 400 `validation_error`; unrelated errors still return 500.
- Test: `plugins/errorHandler.x13.fix.test.ts` (malformed JSON failed before with `500 !== 400`; empty and valid JSON and an unrelated server error are covered) · ADR: none

#### X14 March sweep production postings need Finance reconciliation
- Where: production `ledger_entries`; `scripts/reconcile_march.ts`
- Clue: "Nobody knows if it ran more than once on production. The log file only has one timestamp."
- What's wrong: the number and direction of March sweep postings in production have not been established; the old log overwrote prior output, so one timestamp is not proof of one run.
- Why: the old script had no idempotency guard and staging was run twice. The current X2 guard prevents another posting with the same description, but does not identify or reverse historical duplicates or wrong-direction legs.
- What it breaks: duplicate or incorrectly directed entries can leave March merchant payables and scheme rounding residue misstated.
- Fix: read-only reconcile March sweep ledger entries by exact description, merchant, entry group, account, and direction; compare the totals with the March source residue (70 fils across 13 lines); ask Finance to determine whether any entries require reversal/correction. Do not rerun the sweep until this review is complete. `--dry-run` reports the calculated residue but does not check prior postings. No production data was accessed or changed. · Proper fix (if different): Finance-approved, auditable corrections for confirmed duplicate or wrong-direction postings.
- Test: not applicable (production ledger review; no data touched) · ADR: 0002 · Commit: `docs(X14)`

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

#### FP-300 End-to-end refund test
- Where: `apps/api/src/refunds/refund.e2e.fix.test.ts`
- What it covers: authorize 10 000 fils → capture → `POST /v1/refunds` of 3 000 → a blank-amount refund of the remaining 7 000 → a third refund answers 409. Checks: every ledger entry group balances; `merchant_payable` and `platform_fee_revenue` both net to 0 for the payment; refunds sum to 10 000 and the fee reversed to 250 (the whole fee); the transaction is `refunded` with `refundedFils 10 000`; two `refund.succeeded` outbox rows, delivered to the merchant's endpoint with signatures that verify (`partially_refunded` then `refunded`, totals 3 000 and 10 000); the reconciliation report has gap 0.
- Payout reduction is the Go side (F8, `settlement/refund_fix_test.go`): a TS test can't run `CloseBatch`.
- Test result: passes on first complete run against the fixed code · ADR: none

#### F17 Refund status and webhook run ahead of in-flight refunds
- Where: `apps/api/src/payments/processRefund.ts`
- What's wrong: 4 000 captured, two refunds of 2 000 at once; the first to finish reported status `refunded`, event `refunded`, total 4 000. If the second was then declined, the status fell back but the merchant had already been sent a false `refunded` webhook. (Found in the Opus review; F3 had recorded it as a known limit.)
- Why: step 3 read `transactions.refunded_fils`, which also holds other in-flight refunds' reservations, to derive the status, event type and `refundedTotalFils`.
- What it breaks: a webhook and event that state a refunded total that never happened; recompute and dashboards disagree with it.
- Fix: `current()` now returns the sum of succeeded `refunds` rows (read under the same transaction lock), and a succeeding refund uses that plus its own amount; the decline and error paths recompute the status from the succeeded sum too. `refunded_fils` stays the reservation counter used to validate new refunds (F3), and F11's `refundedFils` still shows it (in-flight amounts included, as documented). The F3 "known limit" about statuses and totals no longer applies. · Proper fix (if different): a `pending` refund row (F3's proper fix) so in-flight amounts are visible as such everywhere.
- Test: `payments/processRefund.f17.fix.test.ts` (A approved while B is held and then declined: A's event says `partially_refunded`, total 2 000; after B's decline the status is still `partially_refunded` and `refunded_fils` 2 000). Failed before: `expected 'partially_refunded', actual 'refunded'` · ADR: 0001

#### F16 RecalculateMDR can make a refunded batch's net negative
- Where: `apps/settlement/internal/settlement/recalculate_mdr.go`
- What's wrong: capture 10 000 at 250 bps (net 9 750), refund all of it the same day (batch net 0), raise the rate to 300 bps and recalculate: the stored net became −50 and the payable cache moved by −50. (Found in the Opus review of the refund work; I had noted a milder form of it as an "extreme edge" under F8.)
- Why: after F8 the stored net is no longer `gross − fee`; `recomputeBatchFee` charges every capture at the new rate and ignores refunds (whose fee reversal stays at the old rate), and the net was moved by the fee difference with only an overflow check.
- What it breaks: a negative `net_payout_fils` that nothing prevents, and a payable cache that no longer matches the batch.
- Fix: for unpaid batches the new net is floored at 0 and the cache moves by the real change in net (`new − old`, which equals `−diff` whenever nothing was clamped). Known limit: the MDR adjustment ledger entry is still posted for the full difference (50 fils here), so the merchant's `merchant_payable` ledger is 50 below what the batch pays; reconciliation shows it. · Proper fix (if different): recompute the fee on captures net of refunds, using each refund's fee reversal, so a full refund leaves nothing to re-rate.
- Test: `settlement/refund_fix_test.go` `TestF16_…` (full refund, rate 250 → 300, recalculate: net stays 0 and the cache doesn't move). Failed before: `net after recalculation = -50` · ADR: none

#### F12 Full refund of a partial capture never says refunded
- Where: `apps/api/src/payments/refundState.ts`
- What's wrong: capture 4 000 of a 10 000 authorization, refund all 4 000: the status stayed `partially_captured`.
- Why: the function returned `partially_captured` for any capture below the authorization before looking at refunds. Its comments claim finance wanted the headroom kept open; the audit and plan state the opposite rule ("a transaction is refunded when every fils we captured went back") and no document in `docs/` records the comment's claim.
- What it breaks: a fully returned payment looks still open in the dashboard, webhook (`status`) and recompute tool.
- Fix: when something was captured and `refunded ≥ captured` the status is `refunded`, whatever the authorization; otherwise the old order (partial capture stays `partially_captured`, nothing refunded `captured`, else `partially_refunded`). Comment rewritten. Consequence to know: a `refunded` row can't be captured further (capture accepts only `authorized`/`partially_captured`), so the leftover authorization headroom is released only by expiry. · Proper fix (if different): track "refunded" and "authorization still open" separately instead of one status.
- Test: `payments/refundState.f12.fix.test.ts` (4 000 of 10 000 refunded in full → refunded; partial returns never refunded; nothing refunded stays partially_captured; full capture unchanged; `processRefund` stores `refunded`). 2 failed before · ADR: none

#### F11 Transaction responses lack refundedFils
- Where: `apps/api/src/transactions/serialize.ts`, `apps/web/src/types.ts`, `RefundDrawer.tsx`
- What's wrong: no response carried how much of a payment was already refunded, so clients (and the dashboard drawer, which capped the amount at `capturedFils`) could not tell what is still refundable.
- Why: `serializeTransaction` left the field out ("TODO add once 0043 is applied everywhere"); the web DTO comment claiming it existed was wrong.
- What it breaks: after a partial refund the drawer offered the full captured amount; the API then answered 422.
- Fix: `refundedFils` added to `TransactionRow`/`TransactionDto`/`serializeTransaction`; every route shares it (authorize, capture, void, detail and list all use `SELECT *`/`RETURNING *`, no query change). Web DTO gets the field; the drawer's cap and label use `capturedFils − refundedFils`. Note: `refundedFils` includes a refund still waiting on the acquirer (F3 reserves it up front). · Proper fix (if different): same.
- Test: `transactions/serialize.f11.fix.test.ts` (string and number mapping; authorize, detail and list responses carry it, 4 000 after a refund of 4 000). Failed before: `undefined !== 0` · ADR: none

#### F10 Reconciliation shows every refund as a gap
- Where: `apps/api/src/settlement/query.ts`
- What's wrong: capture 10 000 fils (fee 250), refund 4 000 (fee reversed 100), nothing batched: the report said `gapFils −3900`, `explained false`. Its own doc comment claimed refund legs were already in pending.
- Why: the ledger figure (`merchant_payable`) includes the refund's legs, but pending only summed unbatched captures.
- What it breaks: finance sees a false gap after every refund ("reconciliation still ties out after refunds" was Huda's rule).
- Fix: pending also subtracts `SUM(amount_fils − fee_reversed_fils)` of the merchant's succeeded refunds in the window that no batch has taken (`settlement_batch_id IS NULL`); once a batch takes a refund (F8) its net carries the reduction instead. Doc comment corrected. The web `ReconciliationPage` only displays the fields. Known limit: a refund and the batch that takes it can fall in different report windows, which shows a gap in one of them (the capture and its batch already behave this way). · Proper fix (if different): same.
- Test: `settlement/reconciliationRefunds.fix.test.ts` (refund with nothing batched: pending 5 850, gap 0; capture and refund both batched: gap 0; a refund outside the window isn't counted). The first failed before: `gapFils −3900` · ADR: 0003

#### F15 Refund summary view is always empty
- Where: `db/migrations/0083_refund_merchant_summary_join.sql` (replaces the view from 0072)
- What's wrong: `refund_merchant_summary` returned no rows at all, however many refunds existed.
- Why: 0072 joined `transactions t ON t.id = r.id`, a refund's own id; no transaction has that id, and the inner join dropped every refund. (The plan said `original_captured_fils` would be NULL; it was the whole row that was missing.)
- What it breaks: the admin refund dashboard would show nothing; once the join is fixed, summing `captured_fils` per refund would also count a capture twice when one payment is refunded in parts on the same day.
- Fix: new migration 0083 drops and recreates the view joining on `r.transaction_id`, with `original_captured_fils` counted once per transaction per Bahrain day (`ROW_NUMBER` filter); same columns and unique index. 0072 stays as applied. Review: no code, grant or other migration references the view; nothing in the code refreshes it either, despite 0072's comment that the reporting worker does, so the numbers only update on a manual `REFRESH MATERIALIZED VIEW` (not fixed). · Proper fix (if different): refresh it from the reporting worker (or make it a plain view / read `merchant_daily_volume`).
- Test: `payments/refundSummary.f15.fix.test.ts` (3 refunds across two payments, two on one payment: 3 rows' worth of count, 3 500 refunded, captures 16 000 counted once each, fee summed). Failed before: no row for the merchant · ADR: 0003 (Bahrain day), 0005 (migration number clear of 0054–0056)

#### F9 Refunds never reach the reporting rollup
- Where: `apps/reporting/src/consumer/applyEvent.ts`, `runConsumerPass.ts`, `apps/api/src/admin/reportingRebuild.ts`, new `db/migrations/0082_merchant_daily_volume_refunds.sql`
- What's wrong: `merchant_daily_volume` never counted refunds; a refund made at 01:30 Bahrain on the 16th would have been filed under the 15th.
- Why: `refund.succeeded` was not in the consumer's list or switch; `applyDailySummaryRollup` (never called) used the UTC date; the table had no `refund_count`/`refund_gross_fils` columns at all (the audit's "just add a case" missed this); the API's admin rebuild reads only `transaction_events`, so a rebuild would have wiped refund counts.
- What it breaks: daily volume reports show gross captures with no refunds; a rebuild loses them; refunds near midnight land on the wrong day (ADR-0003).
- Fix: migration 0082 adds the two columns (default 0); the consumer subscribes to `refund.succeeded` and applies it through `applyDailySummaryRollup`, now bucketing with `toBahrainDateString` (event time = the outbox row's `created_at`, as for captures); `refreshAnalyticsRollups` folds succeeded `refunds` (Bahrain date of `occurred_at`) into the rebuild. The CLI `reporting rebuild` replays the outbox through `applyEvent`, so it follows. The plan numbered the migration 0080; 0080 and 0081 were taken. Not done: the reporting/analytics read endpoints don't expose the new columns yet. · Proper fix (if different): same; expose refunds in `routes/reporting.ts`/`analytics/query.ts`.
- Test: `reporting/consumer/applyEvent.f9.fix.test.ts` (subscription; 22:30Z lands on the next Bahrain day; 20:59Z and 21:00Z split across two days and same-day refunds add up) and `api/admin/reportingRebuild.f9.fix.test.ts` (rebuild keeps both days' refund counts, run in a rolled-back transaction). Failed before: `unhandled event_type refund.succeeded`, `column "refund_count" does not exist` · ADR: 0003

#### F8 Settlement ignores refunds
- Where: `apps/settlement/internal/settlement/batch.go`, `recalculate_mdr.go`
- What's wrong: a merchant who captured 10 000 fils (fee 250) and refunded 4 000 (fee reversed 100) was still paid 9 750 instead of 5 850.
- Why: `CloseBatch` only read `transaction_events`; nothing in `apps/settlement` knew the `refunds` table.
- What it breaks: the platform pays out money the merchant already gave back; the payout cache and reconciliation overstate what is owed.
- Fix: after the net is computed, `CloseBatch` locks the merchant's succeeded, unbatched refunds with `occurred_at` before the end of the Bahrain day and takes each (in time order) off `net_payout_fils` by `amount − fee_reversed`, marking it with the batch id; a refund the remaining net can't cover is skipped and stays unbatched for a later batch (payout never negative, debt not lost). Re-closing is a no-op. Review find: `RecalculateMDR` rebuilt an unpaid batch's net as `gross − fee`, which would put refunds back into the payout (and left the cache out of step); it now moves the stored net by the fee difference (same result when there are no refunds). Checked: `PayoutBatch`, `splits` and the payable cache read the stored `net_payout_fils`, so they follow; batch `gross_fils`/`fee_fils` and the scheme export are unchanged. · Proper fix (if different): skipping a too-big refund also lets a later, smaller one jump ahead of it; strict order would hold all later refunds back. A refund-specific column on `settlement_batches` would show refunds separately from the fee. Known limits (record, not fixed): `gross − fee = net` no longer holds on days with refunds (the `settlement.batch_closed` payload and reporting copy the three values as stored); `RecalculateMDR` on an unpaid batch with refunds could write a negative net if the fee rose by more than the net (extreme edge); the ledger refund debit and the batch deduction can fall in different reconciliation windows (F10 covers reconciliation).
- Test: `settlement/refund_fix_test.go` (capture 10 000 + refund 4 000 pays 5 850 and marks the refund; re-close no-op; a refund bigger than the day's net waits and is taken the next day; 23:30 Bahrain refund in that day's batch, 00:01 in the next; recalculating the fee keeps the refund deducted). 4 failed before (`net payout = 9750, want 5850`) · ADR: 0003 (Bahrain day)

#### F7 Refunds never reach the merchant's webhook
- Where: `apps/api/src/webhooks/envelope.ts`, `apps/api/src/webhooks/dispatcher.ts`
- What's wrong: `processRefund` writes a `refund.succeeded` outbox event, but no webhook was ever sent for it.
- Why: the dispatcher's eligible list left the type out, and `buildEnvelope` had no case for it (adding only the list entry would have thrown in Step A and stalled every delivery).
- What it breaks: integrations never learn of a refund, so their books disagree with FilsPay's.
- Fix: `buildEnvelope` case and `WebhookEventType` entry first, then the list entry. Public data `{ transactionId, merchantId, refundId, amountFils, feeReversedFils, status, refundedTotalFils }` (`status` from the payload's `newStatus`, as for captures). No backlog flood: every refund crashed before F14, so no older `refund.succeeded` events exist, and Step A only sends events newer than the endpoint. Removed the comment in `packages/events/src/outbox.ts` claiming the dispatcher already handled it; ONBOARDING updated. · Proper fix (if different): same.
- Test: `webhooks/envelope.f7.fix.test.ts` (the envelope shape; a real refund delivered once to the merchant's endpoint with the exact data and a signature that verifies). Failed before: `buildEnvelope: unsupported event type "refund.succeeded"` · ADR: none

#### F5 Partial refunds' fee reversals don't add up to the fee
- Where: `apps/api/src/payments/processRefund.ts`
- What's wrong: on a 1 000 fils capture with a 25 fils fee, 33 refunds of 30 reversed 33 fils of fee; ten refunds of 100 reversed only 20.
- Why: each refund's share (`calculateRefundFee`, banker's rounding) was rounded on its own, with no running total and no cap.
- What it breaks: fee revenue for a payment goes negative (more given back than charged), or a merchant who returned everything keeps paying part of the fee.
- Fix: in step 3, under the transaction lock, read the succeeded refunds' `SUM(amount_fils)` and `SUM(fee_reversed_fils)`; reverse the proportional share capped at the fee left, and the refund that brings refunds up to the capture reverses all the fee left (0 if none is left). The final-refund check uses the refunds table, not `refunded_fils`, which also holds other in-flight reservations (F3). Review: nothing else depends on per-refund shares (settlementClient passes the value through, 0072 view sums it). · Proper fix (if different): derive each reversal from the cumulative total (`round(fee × refunded ÷ captured)` minus what's already reversed), which spreads rounding evenly instead of loading it on the last refund.
- Test: `payments/processRefund.f5.fix.test.ts` (33×30 never exceeds 25 and the final 10 brings it to exactly 25; ten 100s reverse 25; 333/333/334 reverse 8/8/9; discounted 3×3 400 reverse 229 net; a single 4 000 still 100; one full refund 250; a no-fee payment 0). Failed before: `reversed 33 of a 25 fee`, `20 !== 25`, `8 !== 9`, `228 !== 229` · ADR: none

#### F4 Fee reversal ignores the negotiated discount
- Where: `apps/api/src/payments/processRefund.ts`
- What's wrong: a full refund of 10 200 fils for a merchant on 250 bps with a 10 % discount reversed 255 fils of fee, though capture kept only 229 (255 credit, 26 discount debit).
- Why: the fee charged was read as `SUM(amount_fils)` of the transaction's `platform_fee_revenue` *credits*; the discount is a debit on the same account.
- What it breaks: discounted merchants got back more fee than they paid (26 fils here); platform fee revenue for the payment went negative.
- Fix: read the net (credits − debits) on `platform_fee_revenue` for the transaction, leaving out legs whose description starts `refund:` (earlier refunds' reversals), so each refund is still measured against the fee charged at capture. Review: no other leg on that account carries a `transaction_id` (Go MDR recalculation and manual credits don't; M14 residue uses other accounts); the net can't go below 0 because the discount is at most 100 % of the fee. · Proper fix (if different): an `entry_type` column on `ledger_entries` (or the capture's fee and discount stored on the transaction) instead of matching on the description.
- Test: `payments/processRefund.f4.fix.test.ts` (full refund of a discounted 10 200 reverses 229 and nets fee revenue to 0; half reverses 114; no discount still 250; two quarters reverse 57 each). Failed before: `255 !== 229` · ADR: none

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
