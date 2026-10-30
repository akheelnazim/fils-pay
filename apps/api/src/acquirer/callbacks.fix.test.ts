/**
 * Regression tests for FP-201 (audit bug R2): a redelivered acquirer callback
 * must record exactly one note. These need DATABASE_URL to point at a real,
 * migrated Postgres (run `npm run migrate` first).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { applyAcquirerCallback, type AcquirerCallbackInput } from "./callbacks.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "callbacks.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres (run `npm run migrate` first)",
  );
}

const pool = new Pool({ connectionString: databaseUrl, max: 5 });

test.after(async () => {
  await pool.end();
});

async function createTransaction(): Promise<{ merchantId: string; transactionId: string }> {
  const merchantResult = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, $2) RETURNING id`,
    [`Acquirer Callback Fix Test Merchant ${randomUUID()}`, 250],
  );
  const merchantId = merchantResult.rows[0]!.id;

  const txnResult = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference)
     VALUES ($1, 'captured', 50000, 50000, $2)
     RETURNING id`,
    [merchantId, `acqref_${randomUUID()}`],
  );

  return { merchantId, transactionId: txnResult.rows[0]!.id };
}

function callbackFor(transactionId: string, callbackId: string): AcquirerCallbackInput {
  return {
    callbackId,
    type: "fraud_review.completed",
    transactionId,
    occurredAt: "2026-09-16T10:00:00.000Z",
    outcome: "cleared",
    note: "Manual review cleared; no further action needed.",
  };
}

async function countNotesForCallback(callbackId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT count(*) FROM acquirer_callback_notes WHERE callback_id = $1`,
    [callbackId],
  );
  return Number(result.rows[0]!.count);
}

test("R2: a redelivered callback records one note", async () => {
  const { transactionId } = await createTransaction();
  const callbackId = `acqcb_${randomUUID()}`;
  const callback = callbackFor(transactionId, callbackId);

  await applyAcquirerCallback(pool, callback);
  await applyAcquirerCallback(pool, callback);

  assert.equal(await countNotesForCallback(callbackId), 1);
});

test("R2: concurrent deliveries of one callback record one note", async () => {
  const { transactionId } = await createTransaction();
  const callbackId = `acqcb_${randomUUID()}`;
  const callback = callbackFor(transactionId, callbackId);

  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => applyAcquirerCallback(pool, callback)),
  );

  for (const result of results) {
    assert.equal(result.status, "fulfilled", `a delivery was rejected: ${String((result as PromiseRejectedResult).reason)}`);
  }
  assert.equal(await countNotesForCallback(callbackId), 1);
});

test("R2: distinct callbacks on one transaction each record a note", async () => {
  const { transactionId } = await createTransaction();

  await applyAcquirerCallback(pool, callbackFor(transactionId, `acqcb_${randomUUID()}`));
  await applyAcquirerCallback(pool, callbackFor(transactionId, `acqcb_${randomUUID()}`));

  const result = await pool.query<{ count: string }>(
    `SELECT count(*) FROM acquirer_callback_notes WHERE transaction_id = $1`,
    [transactionId],
  );
  assert.equal(Number(result.rows[0]!.count), 2);
});
