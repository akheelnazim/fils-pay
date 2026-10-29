/**
 * X8: the rollup parity check on settlement.batch_closed must warn, not
 * crash, when a day has real captures but no merchant_daily_volume row yet
 * (the very lag it exists to detect). Requires DATABASE_URL.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { withTransaction } from "../db/withTransaction.js";
import { applyEvent } from "./applyEvent.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("applyEvent.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 3 });

test.after(async () => {
  await pool.end();
});

async function merchantWithCaptureButNoRollup(): Promise<{ merchantId: string; batchId: string }> {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`X8 fix ${randomUUID().slice(0, 8)}`],
  );
  const merchantId = merchant.rows[0]!.id;
  const txn = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference)
     VALUES ($1, 'captured', 4750, 4750, $2) RETURNING id`,
    [merchantId, `acq_${randomUUID()}`],
  );
  // 2026-01-05 10:00 UTC is 13:00 in Bahrain, inside the 2026-01-05 business day.
  await pool.query(
    `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, occurred_at)
     VALUES ($1, 'captured', 4750, 'system', '2026-01-05T10:00:00Z')`,
    [txn.rows[0]!.id],
  );
  const batch = await pool.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
     VALUES ($1, '2026-01-05', 'closed', 4750, 119, 4631, now()) RETURNING id`,
    [merchantId],
  );
  return { merchantId, batchId: batch.rows[0]!.id };
}

test("X8: batch_closed for a day with captures but no rollup row warns instead of crashing", async () => {
  const { merchantId, batchId } = await merchantWithCaptureButNoRollup();
  const row = {
    id: 1,
    event_type: "settlement.batch_closed",
    aggregate_id: batchId,
    created_at: new Date("2026-01-06T00:05:00Z"),
    payload: { merchantId, batchId, batchDate: "2026-01-05", grossFils: 4_750, feeFils: 119, netPayoutFils: 4_631 },
  };

  await withTransaction(pool, (client) => applyEvent(client, row));

  const trend = await pool.query(
    `SELECT 1 FROM merchant_payout_trends WHERE merchant_id = $1 AND settlement_batch_id = $2`,
    [merchantId, batchId],
  );
  assert.equal(trend.rowCount, 1, "the payout trend is still recorded");
});
