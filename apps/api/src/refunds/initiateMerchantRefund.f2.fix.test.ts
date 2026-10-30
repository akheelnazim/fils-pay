/**
 * F2: initiateMerchantRefund looked the transaction up by id alone and then
 * refunded it under the transaction's own merchant, so merchant B could
 * refund merchant A's payment by sending A's transaction id (IDOR).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import { NotFoundError } from "../lib/errors.js";
import { createRefundTestKit, fixedAcquirer } from "../payments/refundTestSupport.js";
import { initiateMerchantRefund } from "./initiateMerchantRefund.js";

const kit = createRefundTestKit("initiateMerchantRefund.f2.fix.test.ts");
after(() => kit.close());

async function state(txnId: string) {
  const t = await kit.pool.query<{ refunded_fils: string }>(`SELECT refunded_fils FROM transactions WHERE id = $1`, [txnId]);
  const r = await kit.pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM refunds WHERE transaction_id = $1`, [txnId]);
  return { refundedFils: Number(t.rows[0]!.refunded_fils), refunds: Number(r.rows[0]!.n) };
}

test("F2: a merchant cannot refund another merchant's transaction", async () => {
  const a = await kit.createMerchant("f2-victim");
  const b = await kit.createMerchant("f2-attacker");
  const txnId = await kit.capturedTransaction(a.rawKey, 10_000);

  await assert.rejects(
    initiateMerchantRefund(kit.pool, fixedAcquirer("approved"), {
      merchantId: b.merchantId,
      transactionId: txnId,
      amountFils: toFils(1_000),
      idempotencyKey: randomUUID(),
      actor: b.actor,
    }),
    (err: unknown) => err instanceof NotFoundError && err.code === "transaction_not_found",
  );
  assert.deepEqual(await state(txnId), { refundedFils: 0, refunds: 0 });
});

test("F2: the owner can still refund their own transaction", async () => {
  const a = await kit.createMerchant("f2-owner");
  const txnId = await kit.capturedTransaction(a.rawKey, 10_000);

  const result = await initiateMerchantRefund(kit.pool, fixedAcquirer("approved"), {
    merchantId: a.merchantId,
    transactionId: txnId,
    amountFils: toFils(1_000),
    idempotencyKey: randomUUID(),
    actor: a.actor,
  });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  assert.deepEqual(await state(txnId), { refundedFils: 1_000, refunds: 1 });
});
