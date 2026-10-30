/**
 * F5: each partial refund rounded its share of the fee on its own
 * (calculateRefundFee), so many small refunds could reverse more fee than
 * was ever charged, and a set that returns everything could reverse less.
 * Huda: reversed proportionally, never more than the original fee in total;
 * a full refund gives back the whole fee.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import { processRefund } from "./processRefund.js";
import { createRefundTestKit, fixedAcquirer } from "./refundTestSupport.js";

const kit = createRefundTestKit("processRefund.f5.fix.test.ts");
after(() => kit.close());

async function setup(name: string, amountFils: number, opts: { mdrBps?: number; discountBps?: number } = {}) {
  const m = await kit.createMerchant(name, opts);
  const txnId = await kit.capturedTransaction(m.rawKey, amountFils);
  const refund = async (amount: number): Promise<number> => {
    const result = await processRefund(kit.pool, fixedAcquirer("approved"), {
      transactionId: txnId,
      merchantId: m.merchantId,
      amountFils: toFils(amount),
      idempotencyKey: randomUUID(),
      actor: m.actor,
    });
    assert.equal(result.statusCode, 200, JSON.stringify(result.body));
    return (result.body as { feeReversedFils: number }).feeReversedFils;
  };
  return { txnId, refund };
}

async function totals(txnId: string) {
  const r = await kit.pool.query<{ reversed: string; fee_net: string }>(
    `SELECT (SELECT COALESCE(SUM(fee_reversed_fils), 0) FROM refunds WHERE transaction_id = $1)::text AS reversed,
            (SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_fils ELSE -amount_fils END), 0)
               FROM ledger_entries WHERE transaction_id = $1 AND account_id = 'platform_fee_revenue')::text AS fee_net`,
    [txnId],
  );
  return { reversed: Number(r.rows[0]!.reversed), feeNet: Number(r.rows[0]!.fee_net) };
}

test("F5: many small refunds never reverse more than the fee charged", async () => {
  // 250 bps on 1 000 = 25. A 30-fils refund's share is 0.75, rounded to 1
  // each time, so 33 of them used to reverse 33.
  const { txnId, refund } = await setup("f5-small", 1_000);
  for (let i = 0; i < 33; i++) await refund(30);
  const partway = await totals(txnId);
  assert.ok(partway.reversed <= 25, `reversed ${partway.reversed} of a 25 fee after 990 of 1 000`);
  assert.ok(partway.feeNet >= 0, "fee revenue for the payment went negative");

  await refund(10); // the last 10 fils: everything has gone back
  assert.deepEqual(await totals(txnId), { reversed: 25, feeNet: 0 });
});

test("F5: ten equal partials that return everything reverse exactly the fee", async () => {
  // Each 100 is 2.5, which rounds to even (2): ten of them used to reverse only 20.
  const { txnId, refund } = await setup("f5-tenths", 1_000);
  for (let i = 0; i < 10; i++) await refund(100);
  assert.deepEqual(await totals(txnId), { reversed: 25, feeNet: 0 });
});

test("F5: 333 + 333 + 334 reverse 25 in total, the last one taking the remainder", async () => {
  const { txnId, refund } = await setup("f5-thirds", 1_000);
  assert.equal(await refund(333), 8);
  assert.equal(await refund(333), 8);
  assert.equal(await refund(334), 9);
  assert.deepEqual(await totals(txnId), { reversed: 25, feeNet: 0 });
});

test("F5: with a negotiated discount, a full set of partials reverses exactly the net fee", async () => {
  // 10 200 at 250 bps = 255, discount gives back 26: 229 net (F4).
  const { txnId, refund } = await setup("f5-discount", 10_200, { mdrBps: 250, discountBps: 1_000 });
  await refund(3_400);
  await refund(3_400);
  await refund(3_400);
  assert.deepEqual(await totals(txnId), { reversed: 229, feeNet: 0 });
});

test("F5: a single partial still reverses its proportional share", async () => {
  const { refund } = await setup("f5-single", 10_000);
  assert.equal(await refund(4_000), 100); // 250 * 4 000 / 10 000
});

test("F5: one full refund reverses the whole fee", async () => {
  const { txnId, refund } = await setup("f5-full", 10_000);
  assert.equal(await refund(10_000), 250);
  assert.deepEqual(await totals(txnId), { reversed: 250, feeNet: 0 });
});

test("F5: a payment with no fee reverses nothing, partial or final", async () => {
  const { txnId, refund } = await setup("f5-no-fee", 1_000, { mdrBps: 0 });
  assert.equal(await refund(400), 0);
  assert.equal(await refund(600), 0);
  assert.deepEqual(await totals(txnId), { reversed: 0, feeNet: 0 });
});
