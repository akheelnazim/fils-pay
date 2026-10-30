/**
 * F12: Huda's rule: "a transaction is refunded when every fils we captured
 * went back". nextStatusAfterRefund returned partially_captured after a full
 * refund of a partial capture, so the status never said refunded.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import { processRefund } from "./processRefund.js";
import { nextStatusAfterRefund } from "./refundState.js";
import { createRefundTestKit, fixedAcquirer } from "./refundTestSupport.js";

const kit = createRefundTestKit("payments/refundState.f12.fix.test.ts");
after(() => kit.close());

const input = (captured: number, refunded: number) => ({
  amountFils: toFils(10_000),
  capturedFils: toFils(captured),
  refundedTotalFils: toFils(refunded),
});

test("F12: capture 4 000 of a 10 000 authorization, refund all 4 000: refunded", () => {
  assert.equal(nextStatusAfterRefund(input(4_000, 4_000)), "refunded");
});

test("F12: part of a partial capture returned is partially_captured or partially_refunded, never refunded", () => {
  assert.notEqual(nextStatusAfterRefund(input(4_000, 1_000)), "refunded");
  assert.notEqual(nextStatusAfterRefund(input(4_000, 3_999)), "refunded");
});

test("F12: a partial capture with nothing refunded stays partially_captured", () => {
  assert.equal(nextStatusAfterRefund(input(4_000, 0)), "partially_captured");
});

test("F12: a refund of the whole authorization after a full capture is still refunded", () => {
  assert.equal(nextStatusAfterRefund(input(10_000, 10_000)), "refunded");
});

test("F12: processRefund stores refunded after the full refund of a partial capture", async () => {
  const m = await kit.createMerchant("f12-partial");
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000, 4_000);
  const r = await processRefund(kit.pool, fixedAcquirer("approved"), {
    transactionId: txnId,
    merchantId: m.merchantId,
    amountFils: toFils(4_000),
    idempotencyKey: randomUUID(),
    actor: m.actor,
  });
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  const { rows } = await kit.pool.query(`SELECT status FROM transactions WHERE id = $1`, [txnId]);
  assert.equal(rows[0].status, "refunded");
});
