# Fix log

One row per bug. One bug = one commit (test + fix + this log). IDs come from
`filspay-audit-findings.md`. Status: `open` · `test` (failing test added) ·
`fixed` · `wontfix` (say why).

## Tracker

| ID | Bug | Status | Commit |
| --- | --- | --- | --- |
| S1 | Login works without OTP | fixed | `fix(S1)` |
| S2 | OTP/session issued to another merchant's user | fixed | `fix(S2)` |
| S3 | Cancel another merchant's payment link (IDOR) | fixed | `fix(S3)` |
| S4 | Expired payment link still payable (FP-187) | fixed | `fix(S4)` |
| S5 | Outbound webhook signature mismatch (FP-240) | fixed | `fix(S5)` |
| S6 | Inbound acquirer signature check weak (FP-240) | fixed | `fix(S6)` |
| S7 | Rotated API key keeps working | fixed | `fix(S7)` |
| S8 | Impersonation gets write access | open | |
| S9 | Weak, brute-forceable OTP | open | |
| S10 | Credit self-approval compares display name | open | |
| S11 | Secret committed in `ops/.env.docker` | open | |
| R1 | Payment link charged twice (2026-05-14) | open | |
| R2 | Duplicate acquirer callback notes (FP-201) | open | |
| R3 | Duplicate payout notifications (2026-08-21) | open | |
| R5 | Adjustment CSV importable twice | open | |
| M1 | CSV import reads BD as cents (10x) | open | |
| M2 | Scheme statement always a few fils high | open | |
| M3 | Split payouts short every batch | open | |
| M4 | Net payout computed in float32 | open | |
| M5 | Lifetime payout estimate drifts (REAL) | open | |
| M6 | Platform volume counter overflows int32 | open | |
| M7 | Dashboard fee 245 vs charged 225 bps | open | |
| M8 | MDR recalculation rewrites paid batches | open | |
| M9 | Recalculate balances button 135K → 7K (FP-203) | open | |
| M10 | Settlement summary double-counts multi-capture | open | |
| M11 | Reconciliation pending uses `merchants.mdr_bps` | open | |
| M12 | `parsePromotionalDiscountFils` uses float × 100 | open | |
| M13 | Reconciliation pending fee uses float rates (`fees/estimate.ts`) | open | |
| M14 | Scheme residue never journaled (ADR-0002) | open | |
| T1 | Daily close runs 03:00 Bahrain, not midnight | open | |
| T2 | Admin tool flips test merchants into settlement | open | |
| X1 | `expire_holds.ts` can delete every hold | open | |
| X2 | March sweep script not idempotent | open | |
| X3 | Large export can OOM the API | open | |
| X4 | Credit threshold can be split around | open | |
| X5 | March sweep debits merchants, not scheme clearing (ADR-0002) | open | |
| D1 | Migration 0054 references missing table | open | |
| D2 | Migration 0055 uses non-existent columns | open | |
| D3 | Dev webhook key fallback is 34 bytes, not 32 | open | |
| D4 | API has no CORS; dashboard can't call it | open | |
| D5 | Dockerfiles referenced by compose are missing | open | |
| FP-300 | Refunds (F1–F13) | open | |

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
- ADR-0005 (migrations 0054–0056 reserved for settlement v2, never reuse): 0054, 0055, 0056 in
  this repo break it. Move them to 0073+: keep `merchant_payable_position` (M9 reads it) and
  `v_active_api_keys`, drop `v_unbatched_capture_events`, fix or drop 0055, keep `revoke_after`.
- ADR-0006 (Adjust balance is cache-only; rebuild resets it): by design, not a bug. Code matches
  (cache + audit row; journaled variant exists, not exposed).
- New migrations (R2, R3, M5, M6) start at 0073, which ADR-0005 allows.

## Entries

Keep each entry short. One per bug, under its ID:

```markdown
### <ID> <title>
- Clue: <matching symptom from the evidence transcript; omit if none>
- What's wrong: <one line>
- Why: <root cause, one line>
- What it breaks: <who loses what, fils example>
- Fix: <change> · Proper fix (if different): <one line>
- Test: <file> · ADR: <number, if any> · Commit: <sha>
```

### S1 Login works without OTP
- Clue: "Login works without entering the OTP code?"
- What's wrong: the cookie issued after the password step (before the OTP) works on every merchant route.
- Why: `lookupSession` reads the `live_sessions` view, which drops revoked/expired sessions but not unverified ones.
- What it breaks: anyone with a merchant user's password reads and acts on that merchant's money (reproduced on the running API).
- Fix: `AND s.authenticated = true` in `lookupSession` (`auth/sessions.ts`).
- Test: `auth/sessions.fix.test.ts` (pending session returned a row before, null now) · ADR: none

### S2 OTP/session issued to another merchant's user
- What's wrong: logging in to merchant B can create the session (and send the OTP) for merchant A's user with the same email.
- Why: login looked the user up again by email across all merchants (`findOtpRecipient`, `LIMIT 1`) instead of using the user it had just checked.
- What it breaks: a user of two merchants signs in to one and lands in the other's account and money (reproduced on the running API: Beta login → Alpha data).
- Fix: use the verified `user` as the OTP recipient; delete the unused `auth/users.ts`.
- Test: `routes/auth.fix.test.ts` (session went to merchant A's user before, merchant B's now) · ADR: none

### S3 Cancel another merchant's payment link
- Clue: "I cancelled merchant B's payment link from merchant A's dashboard"
- What's wrong: any merchant can cancel any other merchant's payment link by its id.
- Why: the route only checks the merchant in the URL is the caller; `cancelPaymentLink` updates by link id alone.
- What it breaks: a competitor or a leaked key can kill another shop's live links, so its customers can't pay.
- Fix: `cancelPaymentLink` takes the merchant id and both its queries add `AND merchant_id = $2`; another merchant's link answers 404.
- Test: `routes/paymentLinks.fix.test.ts` (cross-merchant cancel gave 204 before, 404 now) · ADR: none

### S4 Expired payment link still payable (FP-187)
- Clue: "the link showed 'expired', but the payment still went through. The checkout page sends something that the server shouldn't trust."
- What's wrong: an expired link is charged if the request carries an old `submittedAt`.
- Why: `payPaymentLink` judged expiry against the client-sent `submittedAt` (any value, unauthenticated public route).
- What it breaks: shoppers pay stale links (old prices, cancelled orders); anyone can revive any expired link.
- Fix: expiry uses the server clock (`new Date()`) in `pay.ts`; `submittedAt` is ignored. Proper fix: also drop `submittedAt` from the API body and checkout page and delete `expiryReferenceTime` + its unit tests in `pay.test.ts` (which assert the client time is honoured); not done here because it changes the public request shape and an existing test file.
- Test: `paymentLinks/pay.fix.test.ts` (expired link with old `submittedAt` paid 200 before, 410 now) · ADR: none

### S5 Outbound webhook signature mismatch (FP-240)
- Clue: "The part that signs the message and the part that sends it don't agree on what it looks like."
- What's wrong: merchants can't verify our webhook signatures against the bytes they receive.
- Why: `signPayload` signs sorted-key JSON (`canonicalJson`); the dispatcher and "send test event" sent `JSON.stringify` (original key order), so the signed and sent bytes differ.
- What it breaks: merchants following standard HMAC verification reject every webhook (payment and payout notices), or turn verification off.
- Fix: dispatcher and test-send now send `canonicalJson(payload)`, the exact string that was signed. Proper fix: serialise once and sign that string (signer takes raw bytes), so the two can never drift.
- Test: `webhooks/sign.fix.test.ts` (raw-bytes HMAC failed before for both senders, passes now) · ADR: none

### S6 Inbound acquirer signature check weak (FP-240)
- Clue: "someone said the incoming signature check has its own problems."
- What's wrong: unsigned acquirer callbacks were accepted, a captured genuine callback could be replayed forever, and the compare wasn't constant-time.
- Why: `ACQUIRER_CALLBACK_REQUIRE_SIGNATURE` and the verifier both defaulted to "optional"; no timestamp check; homemade `Buffer.compare`.
- What it breaks: anyone can post fake fraud-review results onto any payment, or replay old ones.
- Fix: signatures required by default (config and verifier), 300 s timestamp tolerance, `timingSafeEqualHex`, `v1` must be exactly 64 hex chars. Replays inside the 5-minute window are left to R2 (dedupe on `callback_id`). Updated two existing tests that locked in the old behaviour (fixed 2025 timestamps; "accepts unsigned callback"). Proper fix: verify the raw request bytes instead of `JSON.stringify` of the parsed body (needs raw-body capture on the route).
- Test: `webhooks/inboundVerify.fix.test.ts` (unsigned, default config and replayed cases failed before, pass now) · ADR: none

### S7 Rotated API key keeps working
- Clue: "there's a key rotation flow that doesn't do what you'd expect"
- What's wrong: after staff rotate a merchant's API key, the old key keeps working forever.
- Why: `rotateApiKeyAsAdmin` issues the new key but never sets `revoked_at` on the old one (0037's own design says rotation revokes it with reason 'rotated'); no sweep job exists.
- What it breaks: rotating a leaked key does nothing; whoever holds it keeps full API access.
- Fix: revoke the old key (`revoked_at = now()`, `revoked_reason = 'rotated'`) in the same transaction. Updated `routes/admin.test.ts`, which asserted the old key stayed active. Alternative (not done): a short grace period via `revoke_after` + a sweep job; needs new code and the 0056 column (number reserved by ADR-0005).
- Test: `admin/apiKeys.fix.test.ts` (old key still verified after rotation before, null now) · ADR: none

## Baseline before any fix (2026-10-29, commit ee6be80 code)

TS suite against a freshly migrated + seeded local DB: api 350/362, reporting 7/11,
all other workspaces and scripts green. Go suite not yet run (Go not installed; use Docker).
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
