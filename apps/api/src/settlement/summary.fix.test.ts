/**
 * M10: the settlement summary summed transactions.captured_fils (the running
 * total) once per capture event, so a transaction captured in parts was
 * counted once per part.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { getSettlementSummary } from "./query.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("summary.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 3 });
after(async () => {
  await pool.end();
});

async function createMerchant(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name) VALUES ($1) RETURNING id`,
    [`M10 merchant ${randomUUID()}`],
  );
  return r.rows[0]!.id;
}

/** A transaction with one capture event per entry of `captures` ([amount, occurred_at]). */
async function insertCaptured(merchantId: string, amountFils: number, captures: [number, string][]): Promise<void> {
  const total = captures.reduce((s, [a]) => s + a, 0);
  const ref = `M10-${randomUUID()}`;
  const txn = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, reference, acquirer_reference, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $5, $6) RETURNING id`,
    [merchantId, total === amountFils ? "captured" : "partially_captured", amountFils, total, ref, captures[0]![1]],
  );
  let running = 0;
  for (const [amount, at] of captures) {
    running += amount;
    await pool.query(
      `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, occurred_at)
       VALUES ($1, $2, $3, 'system', $4)`,
      [txn.rows[0]!.id, running === amountFils ? "captured" : "partially_captured", amount, at],
    );
  }
}

// Bahrain day 2026-06-10 = 2026-06-09T21:00Z .. 2026-06-10T21:00Z.
const FROM = "2026-06-10";
const TO = "2026-06-11";

test("M10: a transaction captured in two parts is counted once", async () => {
  const merchantId = await createMerchant();
  await insertCaptured(merchantId, 5000, [
    [3000, "2026-06-10T08:00:00Z"],
    [2000, "2026-06-10T09:00:00Z"],
  ]);

  const s = await getSettlementSummary(pool, { merchantId, from: FROM, to: TO });

  assert.equal(s.totalCapturedFils, 5000);
  assert.equal(s.transactionCount, 1);
});

test("M10: only the part captured inside the window counts", async () => {
  const merchantId = await createMerchant();
  await insertCaptured(merchantId, 5000, [
    [3000, "2026-06-10T08:00:00Z"],
    [2000, "2026-06-11T08:00:00Z"],
  ]);

  const s = await getSettlementSummary(pool, { merchantId, from: FROM, to: TO });

  assert.equal(s.totalCapturedFils, 3000);
});

test("M10: single captures and mixed merchants add up", async () => {
  const merchantId = await createMerchant();
  await insertCaptured(merchantId, 1234, [[1234, "2026-06-10T01:00:00Z"]]);
  await insertCaptured(merchantId, 9000, [
    [1000, "2026-06-10T02:00:00Z"],
    [1000, "2026-06-10T03:00:00Z"],
    [7000, "2026-06-10T04:00:00Z"],
  ]);

  const s = await getSettlementSummary(pool, { merchantId, from: FROM, to: TO });

  assert.equal(s.totalCapturedFils, 1234 + 9000);
  assert.equal(s.transactionCount, 2);
});

test("M10: no captures gives zero", async () => {
  const merchantId = await createMerchant();
  const s = await getSettlementSummary(pool, { merchantId, from: FROM, to: TO });
  assert.equal(s.totalCapturedFils, 0);
  assert.equal(s.transactionCount, 0);
});
