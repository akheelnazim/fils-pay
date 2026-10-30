/**
 * F10: the reconciliation report's ledger figure includes a refund's
 * merchant_payable legs, but "pending" (not yet batched) counted only
 * captures, so a refund showed up as a gap. An unbatched refund (amount less
 * the fee reversed) comes off pending; once a batch takes it, the batch's net
 * carries it instead (F8).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import { processRefund } from "../payments/processRefund.js";
import { createRefundTestKit, fixedAcquirer } from "../payments/refundTestSupport.js";
import { getReconciliationReport } from "./query.js";

const kit = createRefundTestKit("settlement/reconciliationRefunds.fix.test.ts");
after(() => kit.close());

/** A window of Bahrain dates wide enough to hold "now" whatever the time of day. */
function window() {
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  return { from: day(-1), to: day(2) };
}

async function refundedMerchant() {
  const m = await kit.createMerchant("f10-recon");
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
  const result = await processRefund(kit.pool, fixedAcquirer("approved"), {
    transactionId: txnId,
    merchantId: m.merchantId,
    amountFils: toFils(4_000),
    idempotencyKey: randomUUID(),
    actor: m.actor,
  });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  return { m, txnId, refundId: (result.body as { id: string }).id };
}

test("F10: a refund in the window with nothing batched leaves no gap", async () => {
  const { m } = await refundedMerchant();

  const r = await getReconciliationReport(kit.pool, { merchantId: m.merchantId, ...window() });

  assert.equal(r.gapFils, 0, JSON.stringify(r));
  assert.equal(r.explained, true);
  assert.equal(r.pendingUnbatchedFils, 5_850); // 9 750 - (4 000 - 100)
});

test("F10: once a batch has taken the capture and the refund there is still no gap", async () => {
  const { m, txnId, refundId } = await refundedMerchant();
  const batch = await kit.pool.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
     VALUES ($1, (now() AT TIME ZONE 'Asia/Bahrain')::date, 'closed', 10000, 250, 5850, now()) RETURNING id`,
    [m.merchantId],
  );
  const batchId = batch.rows[0]!.id;
  await kit.pool.query(`UPDATE transaction_events SET settlement_batch_id = $2 WHERE transaction_id = $1`, [txnId, batchId]);
  await kit.pool.query(`UPDATE refunds SET settlement_batch_id = $2 WHERE id = $1`, [refundId, batchId]);

  const r = await getReconciliationReport(kit.pool, { merchantId: m.merchantId, ...window() });

  assert.equal(r.gapFils, 0, JSON.stringify(r));
  assert.equal(r.pendingUnbatchedFils, 0);
});

test("F10: a refund outside the window is not counted", async () => {
  const { m } = await refundedMerchant();

  const r = await getReconciliationReport(kit.pool, { merchantId: m.merchantId, from: "2020-01-01", to: "2020-01-02" });

  assert.equal(r.pendingUnbatchedFils, 0);
});
