# Fix log

One row per bug. One bug = one commit (test + fix + this log). IDs come from
`filspay-audit-findings.md`. Status: `open` · `test` (failing test added) ·
`fixed` · `wontfix` (say why).

## Tracker

| ID | Bug | Status | Commit |
| --- | --- | --- | --- |
| S1 | Login works without OTP | fixed | `fix(S1)` |
| S2 | OTP/session issued to another merchant's user | open | |
| S3 | Cancel another merchant's payment link (IDOR) | open | |
| S4 | Expired payment link still payable (FP-187) | open | |
| S5 | Outbound webhook signature mismatch (FP-240) | open | |
| S6 | Inbound acquirer signature check weak (FP-240) | open | |
| S7 | Rotated API key keeps working | open | |
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
