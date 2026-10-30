/**
 * F15: refund_merchant_summary (0072) joined transactions on t.id = r.id, so
 * no refund ever matched a transaction and the view was empty. Joining on
 * transaction_id also must not count a capture twice when one transaction has
 * several refunds on the same day.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import { processRefund } from "./processRefund.js";
import { createRefundTestKit, fixedAcquirer } from "./refundTestSupport.js";

const kit = createRefundTestKit("payments/refundSummary.f15.fix.test.ts");
after(() => kit.close());

test("F15: the summary shows refunds with the captured amount of their transactions", async () => {
  const m = await kit.createMerchant("f15-summary");
  const txn1 = await kit.capturedTransaction(m.rawKey, 10_000);
  const txn2 = await kit.capturedTransaction(m.rawKey, 6_000);
  for (const [txnId, amount] of [[txn1, 1_000], [txn1, 2_000], [txn2, 500]] as const) {
    const r = await processRefund(kit.pool, fixedAcquirer("approved"), {
      transactionId: txnId,
      merchantId: m.merchantId,
      amountFils: toFils(amount),
      idempotencyKey: randomUUID(),
      actor: m.actor,
    });
    assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  }

  await kit.pool.query(`REFRESH MATERIALIZED VIEW refund_merchant_summary`);
  const { rows } = await kit.pool.query(
    `SELECT refund_count::int AS n, total_refunded_fils::int AS refunded,
            total_fee_reversed_fils::int AS fee, original_captured_fils::int AS captured
       FROM refund_merchant_summary WHERE merchant_id = $1`,
    [m.merchantId],
  );
  assert.equal(rows.length, 1, "one row for the merchant's day");
  assert.equal(rows[0].n, 3);
  assert.equal(rows[0].refunded, 3_500);
  // each transaction's capture counted once, not once per refund
  assert.equal(rows[0].captured, 16_000);
  assert.ok(rows[0].fee > 0, "fee reversed is summed");
});
