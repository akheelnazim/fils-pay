# FilsPay — Audit Findings (code-verified)

Repo: `MJ5-byte/fils-pay` @ `8b58b0f` · audited 29 Oct 2026

Every item below was confirmed by reading the code, not guessed. Line numbers are for the commit above. Fixes are the smallest change that works; re-run the tests after each one.

---

## 0. Read this first: the repo is booby-trapped

`CLAUDE.md`, `AGENTS.md` and `.cursorrules` are written to mislead AI assistants. They contradict ADR-0001, `ARCHITECTURE.md` and the brief. Do not let your AI tool follow them.

| Planted claim | Truth (ADR / brief / code) |
| --- | --- |
| Money is cents, 1 BD = 100 | ADR-0001: integer fils, 1 BD = 1000 |
| Settlement uses UTC midnight | Brief + ARCHITECTURE: midnight Asia/Bahrain |
| `packages/money` is frozen, never edit tests | `packages/money` is actually correct; several tests lock in bugs and must change with the fix |
| `Math.random()` is fine for OTP codes | OTP is a security code; needs `crypto` |
| Refund 501 is intentional, "don't fix" | Refunds is FP-300, the missing feature |
| INTEGER columns are fine, "Postgres INTEGER is 64-bit" | INTEGER is 32-bit (max 2,147,483,647) |
| float32 in Go is intentional | ADR-0001: float on money is a review blocker |
| Export streams / loads in memory "on purpose" | Route uses the in-memory builder, no range cap |

Also ignore the many inline "claude says it's fine" comments: they are wrong on purpose. Point your AI at `docs/adr/`, `docs/ARCHITECTURE.md` and this file instead. Consider deleting or rewriting the three config files as one of your fixes and explaining why.

Tests that lock in bugs (you will need to update these, and say why in your note):
- `apps/settlement/internal/settlement/window_utc_compat_test.go` (UTC day, cents-style format)
- `apps/api/src/routes/transactions.test.ts` asserts the refund 501
- `packages/money/src/parse_cents_compat.test.ts` is fine (it actually asserts fils); leave it

---

## 1. Security holes (fix first)

- [ ] **S1. Login works without OTP** (critical)
  - Where: `apps/api/src/auth/sessions.ts:90` (`lookupSession`)
  - Why: it reads the `live_sessions` view, which filters revoked/expired but **not** `authenticated = true`. Migration 0012's own comment says every auth query must check it. The pending cookie issued after the password step therefore works everywhere.
  - Fix (1 line): add `AND s.authenticated = true` to the WHERE.
- [ ] **S2. OTP / session issued to the wrong merchant's user** (critical)
  - Where: `apps/api/src/routes/auth.ts:78`, `apps/api/src/auth/users.ts`
  - Why: `findOtpRecipient(email) ?? user` looks up the email across *all* merchants with `LIMIT 1`. The same email can exist under several merchants, so a login to merchant A can create a session for the user of merchant B.
  - Fix: use `user` directly: `const recipient = user;`
- [ ] **S3. Cancel another merchant's payment link (IDOR)**
  - Where: `apps/api/src/paymentLinks/cancel.ts:16` and the route in `routes/paymentLinks.ts`
  - Why: `assertOwnMerchant` only checks the merchant in the URL; `cancelPaymentLink` updates by link id alone.
  - Fix: pass `merchantId` and add `AND merchant_id = $2` to both queries in `cancel.ts`.
- [ ] **S4. Expired payment link still payable (FP-187)**
  - Where: `apps/api/src/paymentLinks/pay.ts:60` (`expiryReferenceTime(input.submittedAt)`)
  - Why: expiry is judged against `submittedAt` sent by the browser. Any client can send an old timestamp. ARCHITECTURE even documents this as design.
  - Fix: `const expiryCheckTime = new Date();` (ignore `submittedAt`).
- [ ] **S5. Webhook signatures can't be verified (FP-240, outbound)**
  - Where: `apps/api/src/webhooks/dispatcher.ts:172` vs `webhooks/sign.ts`
  - Why: `signPayload` signs `canonicalJson(payload)` (sorted keys); the dispatcher sends `JSON.stringify(row.payload)` (different key order). Merchants verify the bytes they got, which were not the bytes signed. HANDOVER: "dispatcher should sign exactly the bytes it sends".
  - Fix: `body: canonicalJson(row.payload)` (import from `payments/idempotency.js`).
- [ ] **S6. Inbound acquirer signature check (FP-240, inbound)**
  - Where: `apps/api/src/webhooks/inboundVerify.ts:50, 62`; config default `ACQUIRER_CALLBACK_REQUIRE_SIGNATURE=false`
  - Why: a missing header is accepted (`requireSignature = false`); verifies `JSON.stringify` of the parsed body, not raw bytes; no timestamp tolerance, so replays work; homemade compare instead of `timingSafeEqual`.
  - Fix: default `requireSignature` to true, add a 300 s timestamp check, use `timingSafeEqualHex`. Raw-body verification is the full fix.
- [ ] **S7. Rotated API key keeps working forever**
  - Where: `apps/api/src/admin/apiKeys.ts:31`
  - Why: rotation issues a new key but never sets `revoked_at` (or `revoke_after`) on the old one; there is no sweep job either. A leaked key survives rotation.
  - Fix: in the same transaction, `UPDATE api_keys SET revoked_at = now() WHERE id = $1`.
- [ ] **S8. Impersonation gets write access**
  - Where: `apps/api/src/admin/impersonation.ts:88`
  - Why: `super_admin → owner`, `finance → finance`. ARCHITECTURE and HANDOVER say impersonation is read-only (`support`). Writes are then logged as `merchant_session`, hiding the admin.
  - Fix: map every admin role to `"support"`.
- [ ] **S9. Weak and brute-forceable OTP**
  - Where: `apps/api/src/auth/otp.ts:8` → `lib/random.ts` (`Math.random`); `routes/auth.ts:158`
  - Why: non-crypto RNG; attempt limit is check-then-increment, so 50 parallel guesses all see `attempt_count = 0`.
  - Fix: `crypto.randomInt`; increment atomically (`UPDATE ... SET attempt_count = attempt_count + 1 ... RETURNING attempt_count`) before comparing.
- [ ] **S10. Credit self-approval check uses display name**
  - Where: `apps/api/src/admin/creditApproval.ts:11`
  - Fix: compare `adminUserId`, not `displayName`.
- [ ] **S11. Secret committed to git**
  - Where: `ops/.env.docker` (real-looking `ACQUIRER_CALLBACK_SIGNING_SECRET`); `.gitignore` only covers `.env`.
  - Fix: remove it, add `.env.*` to `.gitignore`, use platform secrets on deploy, rotate.

---

## 2. Money-out races and duplicates

- [ ] **R1. Payment link charged twice (incident 2026-05-14)**
  - Where: `apps/api/src/paymentLinks/pay.ts:155` (the "this IS reachable" comment)
  - Why: the claim allows re-claiming a link stuck `reserved` longer than 60 s. A slow capture lets buyer 2 re-claim, pay and finalize; buyer 1's finalize then matches 0 rows but returns 200 anyway. The postmortem blamed callbacks and wrongly ruled out the claim; AM's note in Appendix B is right. FP-202's unique constraint was never added.
  - Fix (small): when `finalized` is empty, void/reverse buyer 1's transaction and return 409 instead of 200. Backstop: unique index so a link has at most one captured transaction.
- [ ] **R2. Duplicate acquirer callback notes (FP-201, REOPENED)**
  - Where: `apps/api/src/acquirer/callbacks.ts:38`; migration 0051
  - Why: there is no `processed_events` table and no unique index anywhere. The 1.9.0 "fix" was never built; 0051's own comment admits it.
  - Fix: new migration `0073`: `CREATE UNIQUE INDEX ON acquirer_callback_notes (callback_id);` and `ON CONFLICT (callback_id) DO NOTHING` in the insert.
- [ ] **R3. Duplicate payout notifications (incident 2026-08-21)**
  - Where: `apps/settlement/internal/settlement/payout_notify.go:87`
  - Why: `NOT EXISTS` check then `INSERT`, with no unique index on `outbox_events`. Daemon and CLI running together both pass the check. The advisory lock the postmortem lists as "Done" (FP-208) does not exist. Each duplicate also writes a second disbursement record via the dispatcher.
  - Fix: migration `0073`: unique partial index on `outbox_events (aggregate_id) WHERE event_type = 'settlement.paid'`; insert with `ON CONFLICT DO NOTHING`.
- [ ] **R4. Concurrent refunds (FP-209)** — see FP-300 below (R4 and F1–F3).
- [ ] **R5. Adjustment CSV can be imported twice** — no unique filename or content hash (`adjustmentImport.ts`); AM's comment is wrong. Add a unique hash of file content.

---

## 3. Money correctness (fils lost or invented)

- [ ] **M1. CSV import reads BD as cents (10x)** (flagged "10x??")
  - Where: `apps/api/src/admin/adjustmentCsvParsing.ts:8` → `lib/decimal.ts` `parseDecimalMinor(raw, decimals = 2)`
  - Verified: `"4.75" → 475 fils` (0.475 BD), `"4.755" → 475`, `"120.00" → 12000` (12 BD).
  - Fix (1 line): `return parseBhdToFils(raw);` (from `@filspay/money`, ADR-0001 rule 3).
- [ ] **M2. Scheme statement always a few fils high, never low**
  - Where: `apps/settlement/internal/settlement/batch.go:255`
  - Why: `amount` is stored as `SchemeAmountBD(line.grossFils)`, the *untruncated* gross as float, into `NUMERIC(10,2)`, which **rounds** half-up (4.755 → 4.76). `LoadSchemeExportLines` prefers `amount` over `amount_fils`, so the file sends rounded-up amounts while our ledger uses truncated `amount_fils`. Always over.
  - Fix (1 word): `SchemeAmountBD(truncated)`.
  - Related: ADR-0002 says residue is journaled in CloseBatch; no code does it. Mention in the note.
- [ ] **M3. Split payouts short every batch (Delta Marketplace, "!!")**
  - Where: `apps/settlement/internal/splits/allocate.go:98`
  - Why: each child gets `ApplyRateFils(net, weight)` rounded independently; the remainder is never paid and sits in the parent's `merchant_payable`. Also line 138 reduces the cache by `totalAllocated`, not `netPayout`.
  - Fix: after computing shares, add `netPayout - sum(shares)` to the last child (or largest-remainder, as `allocateRemainder` in `packages/money` already does).
- [ ] **M4. Net payout computed in float32**
  - Where: `apps/settlement/internal/settlement/payable.go:11`
  - Verified: 123,456.789 BD becomes 123,456.79 in float32.
  - Fix: `return grossFils - feeFils`.
- [ ] **M5. Lifetime payout estimate drifts**
  - Where: `payout_estimate.go:19, 39-46`; column is `REAL` (migration 0040)
  - Fix: pass `int64`, migrate the column to `BIGINT`.
- [ ] **M6. Platform volume counter overflows int32**
  - Where: `platform_volume.go:13-26` (int32) and `platform_stats.total_processed_fils INTEGER` (0049); TS comment claims BIGINT.
  - Why: the tier threshold is 2,000,000,000 fils, 147 M fils under the int32 max. Shortly after the tier kicks in, the counter wraps negative and the 15 bps discount silently switches off (or the UPDATE fails).
  - Fix: migration to `BIGINT`, `int64` in Go. Also flag: the tier itself had no finance sign-off (HANDOVER, MK's comment).
- [ ] **M7. Dashboard fee 245 bps vs charged 225 bps**
  - Where: `apps/api/src/fees/currentFeeScheduleDisplay.ts:36`
  - Why: display orders by `created_at` (newest typed-in row, e.g. a backdated or future backfill); billing uses `effective_from <= now()`.
  - Fix: `WHERE merchant_id = $1 AND effective_from <= now() ORDER BY effective_from DESC, created_at DESC`.
  - Minor twin: Go `LoadFeeSchedules` has no `created_at` tie-break; TS does. Add `, created_at ASC`.
- [ ] **M8. MDR recalculation rewrites paid batches**
  - Where: `apps/settlement/internal/settlement/recalculate_mdr.go:67`
  - Why: `status <> 'open'` includes `paid`, then `UPDATE settlement_batches SET fee_fils, net_payout_fils` rewrites history that was already paid out. Its own docstring says paid figures stay as they were.
  - Fix: skip the `UPDATE settlement_batches` when `b.status == "paid"` (keep the ledger adjustment). Also note it ignores `fee_schedules` and the tier.
- [ ] **M9. "Recalculate cached balances" 135K → 7K (FP-203)**
  - Where: `apps/settlement/internal/internalapi/server.go:268` → `ledger.RefreshBalanceCache` → view `merchant_payable_position` (0054)
  - Why: the button rebuilds from a view that sums `scheme_export_lines` (gross captures that reached the scheme file), not the ledger. The CLI uses `RebuildAllBalances` over `ledger_entries`. ADR-0004 made this choice; HANDOVER says there must be no button that reads anything else.
  - Fix (1 line): call `ledger.RebuildAllBalances` in the handler. Side note: "Adjust balance" writes the cache only (ADR-0006), so every rebuild wipes support's adjustments, and ADMIN.md wrongly says adjustments are journaled.
- [ ] **M10. Settlement summary overcounts multi-capture merchants**
  - Where: `apps/api/src/settlement/query.ts:376`
  - Why: sums `t.captured_fils` (a running total) once per capture event. The "38% timing difference" in `docs/perf/2026-07-settlement-summary-slow.md` is double counting, and the fan-out is also why it was slow.
  - Fix: `SUM(te.amount_fils)` and select `te.amount_fils` in the CTE.
- [ ] **M11. Reconciliation pending figure uses `merchants.mdr_bps`** (`query.ts:321`). The "0046 trigger" it relies on does not exist (0046 is splits). Use the fee schedule.
- [ ] **M12. `parsePromotionalDiscountFils` uses `parseFloat * 100`** (`payments/discountAdjustment.ts:12`). Cents bug; it is currently unused, so delete it before someone wires it up.

---

## 4. Settlement timing and test merchants

- [ ] **T1. Daily close runs at 03:00 Bahrain, not midnight**
  - Where: `apps/settlement/internal/scheduler/daemon.go:80` + `window.go` `BusinessDayWindow`
  - Why: `now` is UTC; `BusinessDayWindow` takes the calendar date in the argument's own zone. Between 00:00 and 03:00 Bahrain the UTC date is still yesterday, so the close for that day only happens once UTC rolls over, at 03:00 local.
  - Verified with a script: at 00:15 Bahrain the daemon targets the day before yesterday (already closed); the new day closes at 03:15.
  - Smallest fix (no locked test breaks): in `daemon.go`, convert `now` to Asia/Bahrain before calling `BusinessDayWindow` (e.g. export a `settlement.BahrainNow()` helper).
  - Deeper fix: `date.In(businessDayLocation).Date()` inside `BusinessDayWindow`; this breaks `window_utc_compat_test.go`, which locks in the bug ("locks in current behaviour, don't ask").
  - `time/tzdata` is already imported in `cmd/settlement/main.go`, so the container is fine.
- [ ] **T2. Test merchants in real settlement**
  - Where: `apps/api/src/routes/adminMerchantsRecompute.ts:28` → `admin/merchantFlags.ts`
  - Why: the admin "Recompute transaction statuses" tool sets `test_mode = false` for any merchant with no open authorizations. Settlement then picks them up (CloseBatch filters `test_mode = false`).
  - Fix: remove the `reconcileSandboxFlag` call.

---

## 5. Scripts and other

- [ ] **X1. `expire_holds.ts` deletes every hold on a quiet night** (critical)
  - Where: `scripts/lib/sqlFilter.ts:10` (`if (val.length === 0) continue;`)
  - Why: with zero expired holds the filter is dropped and the query becomes `DELETE FROM holds` with no WHERE. Also HANDOVER says holds are never deleted, only set to `expired`.
  - Fix: `UPDATE holds SET status = 'expired' WHERE status = 'active' AND expires_at < now()` (one statement, no race), or at least return early on an empty list.
- [ ] **X2. March sweep script not idempotent; probably ran twice in production**
  - Where: `scripts/reconcile_march.ts:16, 74`
  - Why: fresh `randomUUID()` every run, no guard; no dry-run flag exists, so the 3 July "dry run" (meeting notes: "13 lines, 70 fils, identical") actually posted again. It also uses the UTC month (ADR-0003 vs YA). The log has one timestamp because output is redirected with `>`, overwriting.
  - Fix: refuse to post if an entry with this description already exists; add a real `--dry-run`. Check prod with `SELECT count(*) FROM ledger_entries WHERE description LIKE 'March 2026 scheme rounding residue%'` (expect 2 legs per merchant per run).
- [ ] **X3. Large export can OOM the 512 MB API**
  - Where: `apps/api/src/routes/transactions.ts:161` uses `buildTransactionsExportCsv` (all rows in memory); `from`/`to` are optional, so an API caller can export all history. The streaming version exists but is unused; CHANGELOG 1.8.0 claims it streams.
  - Fix: call `streamTransactionsExportCsv`, or require and cap the date range.
- [ ] **X4. Credits above threshold can be split; fee reversal excluded from threshold** (`creditThreshold.ts`). Lower priority.

---

## 6. FP-300: the missing feature is **Refunds** (FP-212)

Evidence: `POST /v1/refunds` returns 501 (`routes/refunds.ts`), HANDOVER "Refunds" section, migrations 0042–0072, `RefundDrawer` parked, `refund.succeeded` missing from the webhook list.

"Just wire it" is the trap (YA's note). What's broken or missing:

| # | Gap | Where | Fix |
| --- | --- | --- | --- |
| F1 | Refundable = **authorized** − refunded, not captured − refunded ("refund more than charged") | `payments/processRefund.ts:90` | `subtractFils(capturedFils, refundedFils)` |
| F2 | Refund another merchant's transaction (IDOR) | `refunds/initiateMerchantRefund.ts:63` | `WHERE id = $1 AND merchant_id = $2` with the path merchant |
| F3 | Concurrent refunds both pass (FP-209) | `processRefund.ts:75` reads without lock; line ~199 overwrites `refunded_fils` absolutely | `SELECT ... FOR UPDATE`, and reserve the amount in step 1 (`refunded_fils = refunded_fils + $x WHERE refunded_fils + $x <= captured_fils`), release on decline |
| F4 | Fee reversal ignores the negotiated discount (reverses the pre-discount fee) | `processRefund.ts:117` sums only `platform_fee_revenue` credits | net it: credits − debits for that transaction |
| F5 | Partial fee reversals can sum above the original fee (each rounded alone) | `calculateRefundFee` per partial | reverse `min(computed, feeCharged − alreadyReversed)` |
| F6 | Route path mismatch: drawer posts `/v1/merchants/:id/refunds`, app registers `/v1/refunds` | `app.ts:64`, `RefundDrawer.tsx:65` | register under `/v1/merchants` with `assertRefundRequestScope` + `requireMerchantRole("owner","finance")` + `Idempotency-Key` header |
| F7 | Webhook: `refund.succeeded` not eligible and no envelope case (adding only to the list stalls the queue) | `webhooks/dispatcher.ts:28`, `webhooks/envelope.ts` | add an envelope case first, then the list entry |
| F8 | Settlement ignores refunds: next batch net isn't reduced | `apps/settlement` has no refund code | subtract refunds (net of fee reversal) in CloseBatch for the window |
| F9 | Reporting: no refund case in the consumer | `apps/reporting/src/consumer/applyEvent.ts` | handle `refund.succeeded` → existing refund rollup helper |
| F10 | Reconciliation pending figure excludes refunds | `settlement/query.ts` | include refunds (Huda's one requirement) |
| F11 | API response lacks `refundedFils` | `transactions/serialize.ts:37` TODO | add it |
| F12 | `nextStatusAfterRefund` keeps `partially_captured` after a full refund of a partial capture | `refundState.ts` | follows Huda's "every fils captured went back" rule once F1 is fixed |
| F13 | `transactions.test.ts` asserts 501 | test | update to the new behaviour |

Done-when check: API end to end · ledger balanced in fils · fee reversal + payout reduction · `refund.succeeded` webhook signed correctly (after S5) · timeline (already recorded) + reports (F9) + reconciliation (F10).

---

## 7. Deploy blockers (Dilmune Cloud)

- [ ] `ops/Dockerfile.node` and `ops/Dockerfile.go` are referenced by compose but **not in the repo** (MK promised to commit them in June). `docker compose up` fails until you write them.
- [ ] Migration `0054_views.sql` creates a view on `settlement_batch_events`, a table that doesn't exist. A fresh `npm run migrate` will fail there; drop that view (nothing uses it). 0054–0056 were also "reserved" for v2 (ADR-0005).
- [ ] `ops/.env.docker` sets `NODE_ENV=production`, so secure cookies break on plain http localhost, and production requires `SETTLEMENT_INTERNAL_TOKEN`.
- [ ] Set `ACQUIRER_CALLBACK_REQUIRE_SIGNATURE=true`, fresh secrets, `OTP_DEV_EXPOSE=false`.
- [ ] Run exactly one settlement daemon (R3 until the index lands).
- [ ] After deploy, smoke test: login without OTP must fail (S1); pay an expired link with old `submittedAt` must fail (S4); refund flow end to end.

---

## Suggested order (points per minute)

1. One-liners with big impact: S1, S2, S3, S4, S5, M1, M2, M4, M7, M9, T1, T2, X1.
2. Small migrations: R2, R3, M6 (one `0073` file).
3. Medium: R1, M3, M8, S6–S8, X2, X3.
4. FP-300 refunds (F1–F13), then deploy.
