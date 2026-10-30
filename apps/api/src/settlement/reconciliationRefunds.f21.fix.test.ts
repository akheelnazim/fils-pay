/**
 * F21: a refund that a later day's batch takes (F8: it didn't fit the day it
 * happened) made the reconciliation report show a gap on both days, -3 900 on
 * the refund's day and +3 900 on the batch's day, because "pending" only
 * asked whether the refund was batched at all, not by a batch in the window.
 *
 * Day 1 (2026-03-10): capture 1 000 (fee 25), batch net 975; a refund of
 * 4 000 (fee reversed 100) of an older payment, too big for day 1's net.
 * Day 2 (2026-03-11): capture 10 000 (fee 250); its batch takes the refund,
 * net 9 750 - 3 900 = 5 850.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { getReconciliationReport } from "./query.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("reconciliationRefunds.f21.fix.test.ts requires DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
after(() => pool.end());

let merchantId = "";

async function txn(capturedFils: number, at: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, occurred_at)
     VALUES ($1, 'captured', $2, $2, $3, $4) RETURNING id`,
    [merchantId, capturedFils, `f21-${randomUUID()}`, at],
  );
  return r.rows[0]!.id;
}

async function legs(txnId: string, credit: number, debit: number, at: string): Promise<void> {
  const group = randomUUID();
  if (credit > 0) {
    await pool.query(
      `INSERT INTO ledger_entries (entry_group_id, merchant_id, transaction_id, account_id, direction, amount_fils, occurred_at, description)
       VALUES ($1, $2, $3, 'merchant_payable', 'credit', $4, $5, 'f21'), ($1, $2, $3, 'card_scheme_clearing', 'debit', $4, $5, 'f21')`,
      [group, merchantId, txnId, credit, at],
    );
  }
  if (debit > 0) {
    await pool.query(
      `INSERT INTO ledger_entries (entry_group_id, merchant_id, transaction_id, account_id, direction, amount_fils, occurred_at, description)
       VALUES ($1, $2, $3, 'merchant_payable', 'debit', $4, $5, 'f21'), ($1, $2, $3, 'platform_fee_revenue', 'credit', $4, $5, 'f21')`,
      [randomUUID(), merchantId, txnId, debit, at],
    );
  }
}

async function batch(date: string, gross: number, fee: number, net: number): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
     VALUES ($1, $2, 'closed', $3, $4, $5, now()) RETURNING id`,
    [merchantId, date, gross, fee, net],
  );
  return r.rows[0]!.id;
}

async function batchedCapture(txnId: string, amount: number, fee: number, at: string, batchId: string): Promise<void> {
  await pool.query(
    `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, metadata, occurred_at, settlement_batch_id)
     VALUES ($1, 'captured', $2, 'system', $3, $4, $5)`,
    [txnId, amount, JSON.stringify({ feeFils: fee }), at, batchId],
  );
}

before(async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`F21 ${randomUUID()}`],
  );
  merchantId = m.rows[0]!.id;

  // An older payment (outside every window below) that is refunded on day 1.
  const old = await txn(4_000, "2026-03-01T10:00:00Z");

  const day1 = await batch("2026-03-10", 1_000, 25, 975);
  const a = await txn(1_000, "2026-03-10T10:00:00Z");
  await batchedCapture(a, 1_000, 25, "2026-03-10T10:00:00Z", day1);
  await legs(a, 1_000, 25, "2026-03-10T10:00:00Z");

  const day2 = await batch("2026-03-11", 10_000, 250, 5_850);
  const b = await txn(10_000, "2026-03-11T10:00:00Z");
  await batchedCapture(b, 10_000, 250, "2026-03-11T10:00:00Z", day2);
  await legs(b, 10_000, 250, "2026-03-11T10:00:00Z");

  // The refund happens on day 1 (ledger: -4 000 + 100) but day 2's batch takes it.
  await pool.query(
    `INSERT INTO refunds (transaction_id, merchant_id, amount_fils, fee_reversed_fils, status, acquirer_reference,
                          reason, created_by_type, created_by_id, occurred_at, settlement_batch_id)
     VALUES ($1, $2, 4000, 100, 'succeeded', $3, 'unspecified', 'merchant_session', $4, '2026-03-10T12:00:00Z', $5)`,
    [old, merchantId, `f21-ref-${randomUUID()}`, randomUUID(), day2],
  );
  const g = randomUUID();
  await pool.query(
    `INSERT INTO ledger_entries (entry_group_id, merchant_id, transaction_id, account_id, direction, amount_fils, occurred_at, description)
     VALUES ($1, $2, $3, 'merchant_payable', 'debit', 4000, '2026-03-10T12:00:00Z', 'refund: gross'),
            ($1, $2, $3, 'card_scheme_clearing', 'credit', 4000, '2026-03-10T12:00:00Z', 'refund: gross'),
            ($1, $2, $3, 'platform_fee_revenue', 'debit', 100, '2026-03-10T12:00:00Z', 'refund: MDR fee reversal'),
            ($1, $2, $3, 'merchant_payable', 'credit', 100, '2026-03-10T12:00:00Z', 'refund: MDR fee reversal')`,
    [g, merchantId, old],
  );
});

test("F21: the refund's own day ties out although a later batch took the refund", async () => {
  const r = await getReconciliationReport(pool, { merchantId, from: "2026-03-10", to: "2026-03-11" });
  assert.equal(r.gapFils, 0, JSON.stringify(r));
});

test("F21: the day whose batch took an earlier day's refund ties out", async () => {
  const r = await getReconciliationReport(pool, { merchantId, from: "2026-03-11", to: "2026-03-12" });
  assert.equal(r.gapFils, 0, JSON.stringify(r));
});

test("F21: a window holding both days ties out, as it did before", async () => {
  const r = await getReconciliationReport(pool, { merchantId, from: "2026-03-10", to: "2026-03-12" });
  assert.equal(r.gapFils, 0, JSON.stringify(r));
  assert.equal(r.pendingUnbatchedFils, 0);
});
