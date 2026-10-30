/**
 * F4: the fee a refund reverses was read as the sum of the transaction's
 * platform_fee_revenue *credits* only. The negotiated-discount adjustment
 * capture posts is a debit on that account, so a discounted merchant got
 * back more fee than they ever paid.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import { processRefund } from "./processRefund.js";
import { createRefundTestKit, fixedAcquirer } from "./refundTestSupport.js";

const kit = createRefundTestKit("processRefund.f4.fix.test.ts");
after(() => kit.close());

/** platform_fee_revenue credits minus debits for one transaction. */
async function feeRevenueNet(txnId: string): Promise<number> {
  const r = await kit.pool.query<{ net: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_fils ELSE -amount_fils END), 0)::text AS net
       FROM ledger_entries WHERE transaction_id = $1 AND account_id = 'platform_fee_revenue'`,
    [txnId],
  );
  return Number(r.rows[0]!.net);
}

async function refund(merchantId: string, actor: { type: "merchant_api_key"; id: string }, txnId: string, amount: number) {
  const result = await processRefund(kit.pool, fixedAcquirer("approved"), {
    transactionId: txnId,
    merchantId,
    amountFils: toFils(amount),
    idempotencyKey: randomUUID(),
    actor,
  });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  return (result.body as { feeReversedFils: number }).feeReversedFils;
}

test("F4: a full refund reverses the fee net of the negotiated discount", async () => {
  // 250 bps on 10 200 = 255; a 10 % discount gives back 26, so 229 was kept.
  const m = await kit.createMerchant("f4-discount", { mdrBps: 250, discountBps: 1_000 });
  const txnId = await kit.capturedTransaction(m.rawKey, 10_200);
  assert.equal(await feeRevenueNet(txnId), 229, "setup: capture keeps 229 net");

  assert.equal(await refund(m.merchantId, m.actor, txnId, 10_200), 229);
  assert.equal(await feeRevenueNet(txnId), 0);
});

test("F4: a half refund reverses half the net fee", async () => {
  const m = await kit.createMerchant("f4-half", { mdrBps: 250, discountBps: 1_000 });
  const txnId = await kit.capturedTransaction(m.rawKey, 10_200);

  // 229 * 5 100 / 10 200 = 114.5, ties to even -> 114 (calculateRefundFee).
  assert.equal(await refund(m.merchantId, m.actor, txnId, 5_100), 114);
});

test("F4: a merchant without a discount is unchanged", async () => {
  const m = await kit.createMerchant("f4-no-discount", { mdrBps: 250 });
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000);

  assert.equal(await refund(m.merchantId, m.actor, txnId, 10_000), 250);
  assert.equal(await feeRevenueNet(txnId), 0);
});

test("F4: an earlier refund's reversal doesn't shrink the fee the next one is measured against", async () => {
  const m = await kit.createMerchant("f4-second", { mdrBps: 250, discountBps: 1_000 });
  const txnId = await kit.capturedTransaction(m.rawKey, 10_200);

  // Each quarter is 229 * 2 550 / 10 200 = 57.25 -> 57, both times.
  assert.equal(await refund(m.merchantId, m.actor, txnId, 2_550), 57);
  assert.equal(await refund(m.merchantId, m.actor, txnId, 2_550), 57);
  assert.equal(await feeRevenueNet(txnId), 229 - 114);
});
