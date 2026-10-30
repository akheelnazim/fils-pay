/**
 * M11: the reconciliation report's pending (not yet batched) figure took each
 * capture's fee from merchants.mdr_bps, claiming a "0046 trigger" keeps it in
 * sync with fee_schedules. No such trigger exists, so a merchant on a scheduled
 * rate (or in the volume tier) showed a gap that isn't there.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { getReconciliationReport } from "./query.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("reconciliationPending.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 3 });
after(async () => {
  await pool.end();
});

async function createMerchant(mdrBps: number, discountBps = 0): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, negotiated_discount_bps) VALUES ($1, $2, $3) RETURNING id`,
    [`M11 merchant ${randomUUID()}`, mdrBps, discountBps],
  );
  return r.rows[0]!.id;
}

async function addSchedule(merchantId: string, mdrBps: number, effectiveFrom: string): Promise<void> {
  await pool.query(`INSERT INTO fee_schedules (merchant_id, mdr_bps, effective_from) VALUES ($1, $2, $3)`, [
    merchantId,
    mdrBps,
    effectiveFrom,
  ]);
}

/** An unbatched capture event; metadata.feeFils is what capture.ts records, when given. */
async function addCapture(merchantId: string, amountFils: number, at: string, feeFils?: number): Promise<void> {
  const ref = `M11-${randomUUID()}`;
  const txn = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, reference, acquirer_reference, occurred_at)
     VALUES ($1, 'captured', $2, $2, $3, $3, $4) RETURNING id`,
    [merchantId, amountFils, ref, at],
  );
  await pool.query(
    `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, metadata, occurred_at)
     VALUES ($1, 'captured', $2, 'system', $3, $4)`,
    [txn.rows[0]!.id, amountFils, JSON.stringify(feeFils === undefined ? {} : { feeFils }), at],
  );
}

// Bahrain day 2026-06-15.
const WINDOW = { from: "2026-06-15", to: "2026-06-16" };
const AT = "2026-06-15T10:00:00Z";

test("M11: the fee capture recorded is used, not merchants.mdr_bps", async () => {
  const merchantId = await createMerchant(250);
  await addCapture(merchantId, 10_000, AT, 200); // charged at a scheduled 200 bps

  const r = await getReconciliationReport(pool, { merchantId, ...WINDOW });

  assert.equal(r.pendingUnbatchedFils, 9_800);
});

test("M11: the volume-tier fee capture recorded is used", async () => {
  const merchantId = await createMerchant(250);
  await addCapture(merchantId, 10_000, AT, 235); // 250 - 15 bps tier

  const r = await getReconciliationReport(pool, { merchantId, ...WINDOW });

  assert.equal(r.pendingUnbatchedFils, 9_765);
});

test("M11: without a recorded fee, the schedule in force at the capture is used", async () => {
  const merchantId = await createMerchant(250);
  await addSchedule(merchantId, 200, "2026-06-01T00:00:00Z");
  await addSchedule(merchantId, 300, "2026-06-20T00:00:00Z"); // not yet in force
  await addCapture(merchantId, 10_000, AT);

  const r = await getReconciliationReport(pool, { merchantId, ...WINDOW });

  assert.equal(r.pendingUnbatchedFils, 9_800);
});

test("M11: no schedule and no recorded fee falls back to merchants.mdr_bps", async () => {
  const merchantId = await createMerchant(250);
  await addCapture(merchantId, 10_000, AT);

  const r = await getReconciliationReport(pool, { merchantId, ...WINDOW });

  assert.equal(r.pendingUnbatchedFils, 9_750);
});

test("M11: the negotiated discount still comes off the recorded fee", async () => {
  const merchantId = await createMerchant(250, 1_000);
  await addCapture(merchantId, 10_200, AT, 255); // adjustment gives back 26

  const r = await getReconciliationReport(pool, { merchantId, ...WINDOW });

  assert.equal(r.pendingUnbatchedFils, 10_200 - 229);
});
