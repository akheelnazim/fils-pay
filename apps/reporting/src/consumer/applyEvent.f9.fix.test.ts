/**
 * F9: the reporting consumer had no refund.succeeded case, so refunds never
 * reached merchant_daily_volume; applyDailySummaryRollup (never called) also
 * bucketed by UTC date, not the Bahrain day (ADR-0003). Requires DATABASE_URL.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { withTransaction } from "../db/withTransaction.js";
import { applyEvent } from "./applyEvent.js";
import { REPORTING_EVENT_TYPES } from "./runConsumerPass.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("applyEvent.f9.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 3 });

test.after(async () => {
  await pool.end();
});

async function newMerchant(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`F9 fix ${randomUUID().slice(0, 8)}`],
  );
  return r.rows[0]!.id;
}

function refundRow(merchantId: string, createdAt: string, amountFils: number) {
  return {
    id: 1,
    event_type: "refund.succeeded",
    aggregate_id: randomUUID(),
    created_at: new Date(createdAt),
    payload: {
      merchantId,
      refundId: randomUUID(),
      amountFils,
      feeReversedFils: 0,
      refundedTotalFils: amountFils,
      newStatus: "partially_refunded",
    },
  };
}

async function volume(merchantId: string): Promise<Array<{ d: string; refund_count: string; refund_gross_fils: string }>> {
  const r = await pool.query(
    `SELECT volume_date::text AS d, refund_count::text, refund_gross_fils::text
       FROM merchant_daily_volume WHERE merchant_id = $1 ORDER BY volume_date`,
    [merchantId],
  );
  return r.rows;
}

test("F9: the consumer is subscribed to refund.succeeded", () => {
  assert.ok(REPORTING_EVENT_TYPES.includes("refund.succeeded"));
});

test("F9: a refund lands on the Bahrain day (22:30Z is already the next day in Bahrain)", async () => {
  const merchantId = await newMerchant();
  await withTransaction(pool, (client) => applyEvent(client, refundRow(merchantId, "2026-06-15T22:30:00Z", 2_500)));
  assert.deepEqual(await volume(merchantId), [{ d: "2026-06-16", refund_count: "1", refund_gross_fils: "2500" }]);
});

test("F9: refunds on the same Bahrain day add up; 20:59Z and 21:00Z are different days", async () => {
  const merchantId = await newMerchant();
  await withTransaction(pool, async (client) => {
    await applyEvent(client, refundRow(merchantId, "2026-06-15T20:59:00Z", 1_000));
    await applyEvent(client, refundRow(merchantId, "2026-06-15T09:00:00Z", 400));
    await applyEvent(client, refundRow(merchantId, "2026-06-15T21:00:00Z", 300));
  });
  assert.deepEqual(await volume(merchantId), [
    { d: "2026-06-15", refund_count: "2", refund_gross_fils: "1400" },
    { d: "2026-06-16", refund_count: "1", refund_gross_fils: "300" },
  ]);
});
