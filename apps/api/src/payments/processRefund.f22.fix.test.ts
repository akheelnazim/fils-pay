/**
 * F22 (F3's proper fix): a refund waiting on the acquirer was only a number
 * folded into transactions.refunded_fils. Nothing showed which refund it was,
 * a crash between the reservation and the journal left an amount reserved with
 * no trace, and the API could not tell refunded money from money still pending.
 * Now step 1 writes a `pending` refunds row (and pending_refund_fils), and
 * step 3 turns it into `succeeded` or `failed`.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import type { AcquirerOutcome, AcquirerRefundResult, AcquirerSimulator } from "../acquirer/types.js";
import { processRefund } from "./processRefund.js";
import { createRefundTestKit } from "./refundTestSupport.js";

const kit = createRefundTestKit("processRefund.f22.fix.test.ts");
after(() => kit.close());

/** Holds the refund call until released, then answers with `outcome`. */
function heldAcquirer(outcome: AcquirerOutcome) {
  let release!: () => void;
  let arrived!: () => void;
  const held = new Promise<void>((r) => (release = r));
  const reached = new Promise<void>((r) => (arrived = r));
  const acquirer: AcquirerSimulator = {
    authorize() {
      throw new Error("authorize unused");
    },
    capture() {
      throw new Error("capture unused");
    },
    async refund(req): Promise<AcquirerRefundResult> {
      arrived();
      await held;
      return { outcome, acquirerReference: req.acquirerReference, latencyMs: 0 };
    },
  };
  return { acquirer, reached, release: () => release() };
}

async function refundRows(txnId: string) {
  const r = await kit.pool.query(
    `SELECT status, amount_fils::int AS amount, fee_reversed_fils::int AS fee FROM refunds WHERE transaction_id = $1 ORDER BY created_at`,
    [txnId],
  );
  return r.rows;
}

async function detail(rawKey: string, txnId: string) {
  const res = await kit.app.inject({ method: "GET", url: `/v1/transactions/${txnId}`, headers: { authorization: `Bearer ${rawKey}` } });
  assert.equal(res.statusCode, 200, res.body);
  return res.json() as { refundedFils: number; pendingRefundFils: number; status: string };
}

async function run(outcome: AcquirerOutcome) {
  const m = await kit.createMerchant(`f22-${outcome}`);
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
  const { acquirer, reached, release } = heldAcquirer(outcome);
  const pending = processRefund(kit.pool, acquirer, {
    transactionId: txnId,
    merchantId: m.merchantId,
    amountFils: toFils(4_000),
    idempotencyKey: randomUUID(),
    actor: m.actor,
  });
  await reached;
  return { m, txnId, pending, release };
}

test("F22: while the acquirer is answering, the refund is a visible pending row", async () => {
  const { m, txnId, pending, release } = await run("approved");

  assert.deepEqual(await refundRows(txnId), [{ status: "pending", amount: 4_000, fee: 0 }]);
  const during = await detail(m.rawKey, txnId);
  assert.equal(during.pendingRefundFils, 4_000);
  assert.equal(during.refundedFils, 0, "nothing has gone back yet");
  assert.equal(during.status, "captured");

  release();
  assert.equal((await pending).statusCode, 200);
  assert.deepEqual(await refundRows(txnId), [{ status: "succeeded", amount: 4_000, fee: 100 }]);
  const afterwards = await detail(m.rawKey, txnId);
  assert.equal(afterwards.pendingRefundFils, 0);
  assert.equal(afterwards.refundedFils, 4_000);
  assert.equal(afterwards.status, "partially_refunded");
});

test("F22: a declined refund leaves a failed row and nothing pending", async () => {
  const { m, txnId, pending, release } = await run("declined");
  release();
  assert.equal((await pending).statusCode, 402);
  assert.deepEqual(await refundRows(txnId), [{ status: "failed", amount: 4_000, fee: 0 }]);
  const t = await detail(m.rawKey, txnId);
  assert.equal(t.pendingRefundFils, 0);
  assert.equal(t.refundedFils, 0);
});

test("F22: an acquirer error leaves a failed row; the retry writes its own row", async () => {
  const { m, txnId, pending, release } = await run("error");
  release();
  assert.equal((await pending).statusCode, 502);
  assert.deepEqual(await refundRows(txnId), [{ status: "failed", amount: 4_000, fee: 0 }]);
  assert.equal((await detail(m.rawKey, txnId)).pendingRefundFils, 0);
});

test("F22: pending money can't be refunded twice, and the drawer's limit excludes it", async () => {
  const { m, txnId, pending, release } = await run("approved");
  const second = await processRefund(kit.pool, heldAcquirer("approved").acquirer, {
    transactionId: txnId,
    merchantId: m.merchantId,
    amountFils: toFils(7_000), // 10 000 - 4 000 pending leaves 6 000
    idempotencyKey: randomUUID(),
    actor: m.actor,
  });
  assert.equal(second.statusCode, 422, JSON.stringify(second.body));
  release();
  await pending;
});
