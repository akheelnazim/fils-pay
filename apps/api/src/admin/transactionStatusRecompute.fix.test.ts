/**
 * T3: "Recompute statuses" reports openAuthorizations, but the scan excludes
 * 'authorized' rows, so the count was always 0.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { recomputeTransactionStatusesForMerchant } from "./transactionStatusRecompute.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("transactionStatusRecompute.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 3 });
after(async () => {
  await pool.end();
});

async function createMerchant(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name) VALUES ($1) RETURNING id`,
    [`T3 merchant ${randomUUID()}`],
  );
  return r.rows[0]!.id;
}

async function insertTxn(merchantId: string, status: string, amount: number, captured: number): Promise<string> {
  const ref = `T3-${randomUUID()}`;
  const r = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, reference, acquirer_reference)
     VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`,
    [merchantId, status, amount, captured, ref],
  );
  return r.rows[0]!.id;
}

async function recompute(merchantId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await recomputeTransactionStatusesForMerchant(client, merchantId);
    await client.query("COMMIT");
    return result;
  } finally {
    client.release();
  }
}

test("T3: open authorizations are counted", async () => {
  const merchantId = await createMerchant();
  await insertTxn(merchantId, "authorized", 1000, 0);
  await insertTxn(merchantId, "authorized", 2500, 0);
  await insertTxn(merchantId, "captured", 3000, 3000);
  await insertTxn(merchantId, "voided", 4000, 0);

  const result = await recompute(merchantId);

  assert.equal(result.openAuthorizations, 2);
});

test("T3: a merchant with no authorizations reports 0", async () => {
  const merchantId = await createMerchant();
  await insertTxn(merchantId, "captured", 3000, 3000);

  assert.equal((await recompute(merchantId)).openAuthorizations, 0);
});

test("T3: authorized and voided rows are still not rewritten or scanned", async () => {
  const merchantId = await createMerchant();
  const authId = await insertTxn(merchantId, "authorized", 1000, 0);
  const voidId = await insertTxn(merchantId, "voided", 1000, 0);
  await insertTxn(merchantId, "captured", 3000, 3000);

  const result = await recompute(merchantId);

  assert.equal(result.scanned, 1);
  assert.equal(result.updated, 0);
  const rows = await pool.query<{ id: string; status: string }>(
    `SELECT id, status FROM transactions WHERE id = ANY($1)`,
    [[authId, voidId]],
  );
  const byId = new Map(rows.rows.map((r) => [r.id, r.status]));
  assert.equal(byId.get(authId), "authorized");
  assert.equal(byId.get(voidId), "voided");
});
