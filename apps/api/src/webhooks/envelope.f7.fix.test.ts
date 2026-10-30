/**
 * F7: processRefund wrote a refund.succeeded outbox event, but buildEnvelope
 * had no case for it and the dispatcher's eligible list left it out, so a
 * merchant's webhook never heard about a refund.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import { buildEnvelope } from "./envelope.js";
import { createWebhookEndpoint } from "./create.js";
import { runDispatchPass } from "./dispatcher.js";
import { verifySignature } from "./sign.js";
import { WEBHOOK_DELIVERY_ID_HEADER, WEBHOOK_SIGNATURE_HEADER } from "./headers.js";
import type { WebhookTransport, WebhookTransportRequest } from "./transport.js";
import { processRefund } from "../payments/processRefund.js";
import { createRefundTestKit, fixedAcquirer } from "../payments/refundTestSupport.js";

const kit = createRefundTestKit("webhooks/envelope.f7.fix.test.ts");
after(() => kit.close());

test("F7: refund.succeeded maps to the public data shape", () => {
  const deliveryEventId = randomUUID();
  const transactionId = randomUUID();
  const merchantId = randomUUID();
  const refundId = randomUUID();

  const envelope = buildEnvelope(deliveryEventId, {
    eventType: "refund.succeeded",
    aggregateId: transactionId,
    payload: {
      merchantId,
      refundId,
      amountFils: 2_500,
      feeReversedFils: 62,
      refundedTotalFils: 2_500,
      newStatus: "partially_refunded",
    },
    createdAt: new Date("2026-10-30T09:00:00.000Z"),
  });

  assert.deepEqual(envelope, {
    id: deliveryEventId,
    type: "refund.succeeded",
    createdAt: "2026-10-30T09:00:00.000Z",
    data: {
      transactionId,
      merchantId,
      refundId,
      amountFils: 2_500,
      feeReversedFils: 62,
      // "newStatus" is internal; the public name is "status", as for captures.
      status: "partially_refunded",
      refundedTotalFils: 2_500,
    },
  });
});

test("F7: a refund reaches the merchant's webhook, signed", async () => {
  const m = await kit.createMerchant("f7-webhook");
  const url = `http://fake-receiver.test/f7-${randomUUID()}`;
  const endpoint = await createWebhookEndpoint(kit.pool, kit.config, {
    merchantId: m.merchantId,
    url,
    createdByType: "merchant_session",
    createdById: randomUUID(),
  });
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000);

  const result = await processRefund(kit.pool, fixedAcquirer("approved"), {
    transactionId: txnId,
    merchantId: m.merchantId,
    amountFils: toFils(4_000),
    idempotencyKey: randomUUID(),
    actor: m.actor,
  });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  const refundId = (result.body as { id: string }).id;

  const sent: WebhookTransportRequest[] = [];
  const transport: WebhookTransport = async (req) => {
    if (req.url === url) sent.push(req);
    return { statusCode: 200, body: "ok" };
  };
  await runDispatchPass(kit.pool, transport, kit.config);

  const refunds = sent.filter((req) => (JSON.parse(req.body) as { type: string }).type === "refund.succeeded");
  assert.equal(refunds.length, 1, "one refund.succeeded delivery");
  const req = refunds[0]!;
  const body = JSON.parse(req.body) as { id: string; type: string; data: Record<string, unknown> };
  assert.equal(body.id, req.headers[WEBHOOK_DELIVERY_ID_HEADER]);
  assert.deepEqual(body.data, {
    transactionId: txnId,
    merchantId: m.merchantId,
    refundId,
    amountFils: 4_000,
    feeReversedFils: 100, // 250 bps of 10 000 = 250; 4 000 / 10 000 of it
    status: "partially_refunded",
    refundedTotalFils: 4_000,
  });
  assert.deepEqual(verifySignature(body, req.headers[WEBHOOK_SIGNATURE_HEADER]!, endpoint.secret), { valid: true });
});
