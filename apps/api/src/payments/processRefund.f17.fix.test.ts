/**
 * F17 (found in the overall review): a refund's status, outbox event and
 * webhook total were read from transactions.refunded_fils, which also holds
 * the amounts other in-flight refunds have reserved (F3). If the other one
 * was then declined, the merchant had already been told "refunded".
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import type { AcquirerRefundResult, AcquirerSimulator } from "../acquirer/types.js";
import { processRefund } from "./processRefund.js";
import { createRefundTestKit } from "./refundTestSupport.js";

const kit = createRefundTestKit("processRefund.f17.fix.test.ts");
after(() => kit.close());

/** The first refund call is approved once released, the second is declined once released. */
function twoStepAcquirer() {
  const outcomes: Array<"approved" | "declined"> = ["approved", "declined"];
  const releases: Array<() => void> = [];
  const arrivals: Array<() => void> = [];
  const arrived = [new Promise<void>((r) => arrivals.push(r)), new Promise<void>((r) => arrivals.push(r))];
  let calls = 0;
  const acquirer: AcquirerSimulator = {
    authorize() {
      throw new Error("authorize unused");
    },
    capture() {
      throw new Error("capture unused");
    },
    async refund(req): Promise<AcquirerRefundResult> {
      const i = calls++;
      const held = new Promise<void>((r) => releases.push(r));
      arrivals[i]!();
      await held;
      return { outcome: outcomes[i]!, acquirerReference: req.acquirerReference, latencyMs: 0 };
    },
  };
  return { acquirer, arrived, release: (i: number) => releases[i]!() };
}

test("F17: a refund isn't reported as the final one while another refund is still in flight", async () => {
  const m = await kit.createMerchant("f17-inflight");
  const txnId = await kit.capturedTransaction(m.rawKey, 4_000);
  const { acquirer, arrived, release } = twoStepAcquirer();
  const refund = () =>
    processRefund(kit.pool, acquirer, {
      transactionId: txnId,
      merchantId: m.merchantId,
      amountFils: toFils(2_000),
      idempotencyKey: randomUUID(),
      actor: m.actor,
    });

  const a = refund();
  await arrived[0];
  const b = refund(); // reserves the other 2 000 while A is still out
  await arrived[1];

  release(0); // A approved
  const resultA = await a;
  assert.equal(resultA.statusCode, 200, JSON.stringify(resultA.body));

  const event = await kit.pool.query(
    `SELECT event_type, payload FROM outbox_events WHERE event_type = 'refund.succeeded' AND aggregate_id = $1`,
    [txnId],
  );
  assert.equal(event.rows.length, 1);
  assert.equal(event.rows[0].payload.newStatus, "partially_refunded", "B hasn't succeeded, so not refunded");
  assert.equal(event.rows[0].payload.refundedTotalFils, 2_000);
  const during = await kit.pool.query(`SELECT status FROM transactions WHERE id = $1`, [txnId]);
  assert.equal(during.rows[0].status, "partially_refunded");

  release(1); // B declined
  const resultB = await b;
  assert.equal(resultB.statusCode, 402);
  const after = await kit.pool.query(`SELECT status, refunded_fils::int AS refunded FROM transactions WHERE id = $1`, [txnId]);
  assert.equal(after.rows[0].status, "partially_refunded");
  assert.equal(after.rows[0].refunded, 2_000);
});
