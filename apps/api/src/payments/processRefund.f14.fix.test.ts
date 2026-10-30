/**
 * F14: every refund failed on insert. processRefund passed `reason` as an
 * explicit NULL, and 0070's CHECK (reason IS NOT NULL) rejects it; the
 * column DEFAULT 'unspecified' only applies when the column is omitted.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import { processRefund } from "./processRefund.js";
import { createRefundTestKit, fixedAcquirer } from "./refundTestSupport.js";

const kit = createRefundTestKit("processRefund.f14.fix.test.ts");
after(() => kit.close());

async function storedReason(refundId: string): Promise<string | null> {
  const r = await kit.pool.query<{ reason: string | null }>(`SELECT reason FROM refunds WHERE id = $1`, [refundId]);
  return r.rows[0]!.reason;
}

test("F14: a refund without a reason succeeds and stores 'unspecified'", async () => {
  const m = await kit.createMerchant("f14-no-reason");
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000);

  const result = await processRefund(kit.pool, fixedAcquirer("approved"), {
    transactionId: txnId,
    merchantId: m.merchantId,
    amountFils: toFils(1_000),
    idempotencyKey: randomUUID(),
    actor: m.actor,
  });

  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  assert.equal(await storedReason((result.body as { id: string }).id), "unspecified");
});

test("F14: a refund with a reason keeps it", async () => {
  const m = await kit.createMerchant("f14-reason");
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000);

  const result = await processRefund(kit.pool, fixedAcquirer("approved"), {
    transactionId: txnId,
    merchantId: m.merchantId,
    amountFils: toFils(1_000),
    idempotencyKey: randomUUID(),
    actor: m.actor,
    reason: "damaged",
  });

  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  assert.equal(await storedReason((result.body as { id: string }).id), "damaged");
});
