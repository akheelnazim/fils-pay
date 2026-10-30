/**
 * FP-300 end to end: authorize 10 000 fils, capture, refund 3 000, then the
 * rest, through the real routes. Checks the ledger, the fee reversal, the
 * transaction, the outbox and webhook, and reconciliation.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { createWebhookEndpoint } from "../webhooks/create.js";
import { runDispatchPass } from "../webhooks/dispatcher.js";
import { verifySignature } from "../webhooks/sign.js";
import { WEBHOOK_SIGNATURE_HEADER } from "../webhooks/headers.js";
import type { WebhookTransport, WebhookTransportRequest } from "../webhooks/transport.js";
import { getReconciliationReport } from "../settlement/query.js";
import { createRefundTestKit } from "../payments/refundTestSupport.js";

const kit = createRefundTestKit("refunds/refund.e2e.fix.test.ts");
after(() => kit.close());

test("FP-300: capture, partial refund, refund the rest", async () => {
  const m = await kit.createMerchant("e2e");
  const auth = { authorization: `Bearer ${m.rawKey}` };
  const url = `http://fake-receiver.test/e2e-${randomUUID()}`;
  const endpoint = await createWebhookEndpoint(kit.pool, kit.config, {
    merchantId: m.merchantId,
    url,
    createdByType: "merchant_session",
    createdById: randomUUID(),
  });
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000);

  const refund = async (amountFils?: number) =>
    kit.app.inject({
      method: "POST",
      url: "/v1/refunds",
      headers: { ...auth, "idempotency-key": randomUUID() },
      payload: amountFils === undefined ? { transactionId: txnId } : { transactionId: txnId, amountFils },
    });
  const first = await refund(3_000);
  assert.equal(first.statusCode, 200, first.body);
  const second = await refund(); // blank amount = everything still refundable
  assert.equal(second.statusCode, 200, second.body);
  assert.equal(second.json().amountFils, 7_000);

  // transaction
  const detail = await kit.app.inject({ method: "GET", url: `/v1/transactions/${txnId}`, headers: auth });
  assert.equal(detail.json().status, "refunded");
  assert.equal(detail.json().refundedFils, 10_000);
  assert.equal(detail.json().capturedFils, 10_000);

  // a third refund: the payment is already refunded
  assert.equal((await refund(1)).statusCode, 409);

  // ledger: every entry group balances; merchant_payable nets to zero; fee fully reversed
  const groups = await kit.pool.query(
    `SELECT entry_group_id,
            SUM(CASE WHEN direction = 'debit' THEN amount_fils ELSE 0 END)::int AS debits,
            SUM(CASE WHEN direction = 'credit' THEN amount_fils ELSE 0 END)::int AS credits
       FROM ledger_entries WHERE transaction_id = $1 GROUP BY entry_group_id`,
    [txnId],
  );
  assert.ok(groups.rows.length >= 3);
  for (const g of groups.rows) assert.equal(g.debits, g.credits, `group ${g.entry_group_id} balances`);
  const net = async (account: string) =>
    Number(
      (
        await kit.pool.query(
          `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_fils ELSE -amount_fils END), 0) AS n
             FROM ledger_entries WHERE transaction_id = $1 AND account_id = $2`,
          [txnId, account],
        )
      ).rows[0].n,
    );
  assert.equal(await net("merchant_payable"), 0, "the merchant owes and is owed nothing for this payment");
  assert.equal(await net("platform_fee_revenue"), 0, "the whole fee went back");
  const refunds = await kit.pool.query(
    `SELECT amount_fils::int AS a, fee_reversed_fils::int AS f FROM refunds WHERE transaction_id = $1 AND status = 'succeeded'`,
    [txnId],
  );
  assert.equal(refunds.rows.reduce((s, r) => s + r.a, 0), 10_000);
  assert.equal(refunds.rows.reduce((s, r) => s + r.f, 0), 250); // 250 bps of 10 000

  // outbox + webhook: two refund.succeeded events, delivered signed
  const outbox = await kit.pool.query(
    `SELECT payload FROM outbox_events WHERE event_type = 'refund.succeeded' AND aggregate_id = $1 ORDER BY id`,
    [txnId],
  );
  assert.equal(outbox.rows.length, 2);
  const sent: WebhookTransportRequest[] = [];
  const transport: WebhookTransport = async (req) => {
    if (req.url === url) sent.push(req);
    return { statusCode: 200, body: "ok" };
  };
  await kit.pool.query(`UPDATE webhook_deliveries SET status = 'exhausted' WHERE status = 'pending' AND endpoint_id <> $1`, [endpoint.id]);
  await runDispatchPass(kit.pool, transport, kit.config);
  const deliveries = sent
    .map((req) => ({ req, body: JSON.parse(req.body) as { type: string; data: Record<string, unknown> } }))
    .filter((d) => d.body.type === "refund.succeeded");
  assert.equal(deliveries.length, 2);
  for (const d of deliveries) {
    assert.deepEqual(verifySignature(d.body, d.req.headers[WEBHOOK_SIGNATURE_HEADER]!, endpoint.secret), { valid: true });
  }
  assert.deepEqual(deliveries.map((d) => d.body.data.status), ["partially_refunded", "refunded"]);
  assert.deepEqual(deliveries.map((d) => d.body.data.refundedTotalFils), [3_000, 10_000]);

  // reconciliation
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const report = await getReconciliationReport(kit.pool, { merchantId: m.merchantId, from: day(-1), to: day(2) });
  assert.equal(report.gapFils, 0, JSON.stringify(report));
});
