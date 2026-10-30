/**
 * F1: the refundable amount was authorized − refunded, not captured −
 * refunded, so a partly captured payment could refund money that was never
 * taken from the card ("refund more than charged").
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils, type Fils } from "@filspay/money";
import { processRefund } from "./processRefund.js";
import { createRefundTestKit, fixedAcquirer } from "./refundTestSupport.js";

const kit = createRefundTestKit("processRefund.f1.fix.test.ts");
after(() => kit.close());

async function partlyCaptured(name: string) {
  const m = await kit.createMerchant(name);
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000, 4_000); // authorized 10 000, captured 4 000
  const refund = (amountFils?: Fils) =>
    processRefund(kit.pool, fixedAcquirer("approved"), {
      transactionId: txnId,
      merchantId: m.merchantId,
      amountFils,
      idempotencyKey: randomUUID(),
      actor: m.actor,
    });
  return { txnId, refund };
}

async function refundedFils(txnId: string): Promise<number> {
  const r = await kit.pool.query<{ refunded_fils: string }>(`SELECT refunded_fils FROM transactions WHERE id = $1`, [txnId]);
  return Number(r.rows[0]!.refunded_fils);
}

test("F1: cannot refund more than was captured", async () => {
  const { txnId, refund } = await partlyCaptured("f1-over");
  const result = await refund(toFils(5_000));
  assert.equal(result.statusCode, 422, JSON.stringify(result.body));
  assert.deepEqual(result.body, { ok: false, code: "refund_exceeds_refundable", refundableFils: 4_000 });
  assert.equal(await refundedFils(txnId), 0);
});

test("F1: refunding exactly the captured amount works, then nothing is left", async () => {
  const { txnId, refund } = await partlyCaptured("f1-exact");
  const first = await refund(toFils(4_000));
  assert.equal(first.statusCode, 200, JSON.stringify(first.body));
  assert.equal(await refundedFils(txnId), 4_000);

  const second = await refund(toFils(1));
  assert.notEqual(second.statusCode, 200, JSON.stringify(second.body));
  assert.equal(await refundedFils(txnId), 4_000);
});

test("F1: a refund with no amount returns what was captured, not what was authorized", async () => {
  const { txnId, refund } = await partlyCaptured("f1-default");
  const result = await refund();
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  assert.equal((result.body as { amountFils: number }).amountFils, 4_000);
  assert.equal(await refundedFils(txnId), 4_000);
});
