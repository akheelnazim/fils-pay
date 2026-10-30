/**
 * F11: the transaction response had no refundedFils, so a client could not
 * tell what was still refundable (capturedFils - refundedFils). Every route
 * that returns a transaction shares serializeTransaction.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import { processRefund } from "../payments/processRefund.js";
import { createRefundTestKit, fixedAcquirer } from "../payments/refundTestSupport.js";
import { serializeTransaction } from "./serialize.js";

const kit = createRefundTestKit("transactions/serialize.f11.fix.test.ts");
after(() => kit.close());

test("F11: serializeTransaction maps refunded_fils (string or number) to refundedFils", () => {
  const base = {
    id: randomUUID(),
    merchant_id: randomUUID(),
    status: "partially_refunded",
    amount_fils: "10000",
    captured_fils: "10000",
    pending_refund_fils: "0",
    currency: "BHD",
    reference: null,
    acquirer_reference: "acq",
    occurred_at: new Date("2026-10-30T09:00:00Z"),
    created_at: new Date("2026-10-30T09:00:00Z"),
  };
  assert.equal(serializeTransaction({ ...base, refunded_fils: "4000" }).refundedFils, 4_000);
  assert.equal(serializeTransaction({ ...base, refunded_fils: 0 }).refundedFils, 0);
});

test("F11: capture, detail and list responses carry refundedFils", async () => {
  const m = await kit.createMerchant("f11-serialize");
  const auth = { authorization: `Bearer ${m.rawKey}` };

  const authorized = await kit.app.inject({
    method: "POST",
    url: "/v1/transactions",
    headers: { ...auth, "idempotency-key": randomUUID() },
    payload: {
      amountFils: 10_000,
      card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" },
    },
  });
  assert.equal(authorized.statusCode, 201, authorized.body);
  assert.equal(authorized.json().refundedFils, 0, "authorize response");

  const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
  const r = await processRefund(kit.pool, fixedAcquirer("approved"), {
    transactionId: txnId,
    merchantId: m.merchantId,
    amountFils: toFils(4_000),
    idempotencyKey: randomUUID(),
    actor: m.actor,
  });
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));

  const detail = await kit.app.inject({ method: "GET", url: `/v1/transactions/${txnId}`, headers: auth });
  assert.equal(detail.statusCode, 200, detail.body);
  assert.equal(detail.json().refundedFils, 4_000, "detail response");
  assert.equal(detail.json().capturedFils, 10_000);

  const list = await kit.app.inject({ method: "GET", url: "/v1/transactions", headers: auth });
  const listed = (list.json().transactions as Array<{ id: string; refundedFils: number }>).find((t) => t.id === txnId);
  assert.equal(listed?.refundedFils, 4_000, "list response");
});
