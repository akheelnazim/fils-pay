/**
 * F19 (Opus overall review): the status recompute tool read
 * transactions.refunded_fils, which also holds amounts reserved by refunds
 * still waiting on the acquirer (F3), so it could mark a transaction
 * `refunded` while a refund was pending or later declined. Like F17, it
 * counts only refunds that succeeded.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { recomputeTransactionStatusesForMerchant } from "./transactionStatusRecompute.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("transactionStatusRecompute.f19.fix.test.ts requires DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
after(() => pool.end());

async function merchant(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`F19 ${randomUUID()}`],
  );
  return r.rows[0]!.id;
}

async function transaction(merchantId: string, status: string, refundedFils: number): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, refunded_fils, acquirer_reference)
     VALUES ($1, $2, 4000, 4000, $3, $4) RETURNING id`,
    [merchantId, status, refundedFils, `f19-${randomUUID()}`],
  );
  return r.rows[0]!.id;
}

async function addSucceededRefund(merchantId: string, txnId: string, amountFils: number): Promise<void> {
  await pool.query(
    `INSERT INTO refunds (transaction_id, merchant_id, amount_fils, fee_reversed_fils, status, acquirer_reference,
                          reason, created_by_type, created_by_id)
     VALUES ($1, $2, $3, 0, 'succeeded', $4, 'unspecified', 'merchant_session', $5)`,
    [txnId, merchantId, amountFils, `f19-ref-${randomUUID()}`, randomUUID()],
  );
}

async function recompute(merchantId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await recomputeTransactionStatusesForMerchant(client, merchantId);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const statusOf = async (txnId: string) =>
  (await pool.query(`SELECT status FROM transactions WHERE id = $1`, [txnId])).rows[0].status;

test("F19: a reservation with no succeeded refund does not make a transaction refunded", async () => {
  const merchantId = await merchant();
  const inFlight = await transaction(merchantId, "captured", 4_000); // reserved, refund still pending
  await recompute(merchantId);
  assert.equal(await statusOf(inFlight), "captured");
});

test("F19: succeeded refunds still drive the status", async () => {
  const merchantId = await merchant();
  const full = await transaction(merchantId, "captured", 4_000);
  await addSucceededRefund(merchantId, full, 4_000);
  const part = await transaction(merchantId, "captured", 1_500);
  await addSucceededRefund(merchantId, part, 1_500);
  await recompute(merchantId);
  assert.equal(await statusOf(full), "refunded");
  assert.equal(await statusOf(part), "partially_refunded");
});

test("F19: an in-flight reservation next to a succeeded refund counts only the succeeded one", async () => {
  const merchantId = await merchant();
  const txn = await transaction(merchantId, "partially_refunded", 4_000); // 2 000 done + 2 000 reserved
  await addSucceededRefund(merchantId, txn, 2_000);
  await recompute(merchantId);
  assert.equal(await statusOf(txn), "partially_refunded");
});
