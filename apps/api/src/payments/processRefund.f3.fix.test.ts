/**
 * F3 (FP-209): two refunds on one transaction at the same moment both
 * passed validation (no lock, refundable read before the acquirer call) and
 * step 3 then overwrote refunded_fils with an absolute value, so more than
 * was captured went back while refunded_fils showed only one of them.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import type { AcquirerRefundResult, AcquirerSimulator } from "../acquirer/types.js";
import { processRefund } from "./processRefund.js";
import { createRefundTestKit, fixedAcquirer } from "./refundTestSupport.js";

const kit = createRefundTestKit("processRefund.f3.fix.test.ts");
after(() => kit.close());

/** Approves, but holds each refund until `expected` calls have arrived (or
 *  300 ms pass), so two refunds are both past validation before either is
 *  journaled: the race, made deterministic. */
function gatedAcquirer(expected: number): AcquirerSimulator {
  let arrived = 0;
  let open!: () => void;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
    setTimeout(resolve, 300);
  });
  return {
    authorize() {
      throw new Error("gatedAcquirer: authorize unused");
    },
    capture() {
      throw new Error("gatedAcquirer: capture unused");
    },
    async refund(req): Promise<AcquirerRefundResult> {
      if (++arrived >= expected) open();
      await gate;
      return { outcome: "approved", acquirerReference: req.acquirerReference, latencyMs: 0 };
    },
  };
}

async function state(txnId: string) {
  const t = await kit.pool.query<{ refunded_fils: string; status: string }>(
    `SELECT refunded_fils, status FROM transactions WHERE id = $1`,
    [txnId],
  );
  const r = await kit.pool.query<{ n: string; total: string }>(
    `SELECT count(*)::text AS n, COALESCE(SUM(amount_fils), 0)::text AS total FROM refunds WHERE transaction_id = $1`,
    [txnId],
  );
  return {
    refundedFils: Number(t.rows[0]!.refunded_fils),
    status: t.rows[0]!.status,
    refunds: Number(r.rows[0]!.n),
    refundRowsTotal: Number(r.rows[0]!.total),
  };
}

async function setup(name: string) {
  const m = await kit.createMerchant(name);
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
  const refund = (acquirer: AcquirerSimulator, amount: number, merchantId = m.merchantId) =>
    processRefund(kit.pool, acquirer, {
      transactionId: txnId,
      merchantId,
      amountFils: toFils(amount),
      idempotencyKey: randomUUID(),
      actor: m.actor,
    });
  return { m, txnId, refund };
}

test("F3: two concurrent refunds cannot together exceed the capture", async () => {
  const { txnId, refund } = await setup("f3-race");
  const acquirer = gatedAcquirer(2);

  const results = await Promise.all([refund(acquirer, 6_000), refund(acquirer, 6_000)]);
  const codes = results.map((r) => r.statusCode).sort();

  assert.deepEqual(codes, [200, 422], JSON.stringify(results.map((r) => r.body)));
  assert.deepEqual(await state(txnId), {
    refundedFils: 6_000,
    status: "partially_refunded",
    refunds: 1,
    refundRowsTotal: 6_000,
  });
});

test("F3: two concurrent refunds that fit both succeed and both count", async () => {
  const { txnId, refund } = await setup("f3-both-fit");
  const acquirer = gatedAcquirer(2);

  const results = await Promise.all([refund(acquirer, 3_000), refund(acquirer, 4_000)]);

  assert.deepEqual(results.map((r) => r.statusCode), [200, 200], JSON.stringify(results.map((r) => r.body)));
  const s = await state(txnId);
  assert.equal(s.refundedFils, 7_000);
  assert.equal(s.refundRowsTotal, 7_000);
  assert.equal(s.refunds, 2);
});

test("F3: a declined refund releases its reservation, and a retry works", async () => {
  const { txnId, refund } = await setup("f3-declined");

  const declined = await refund(fixedAcquirer("declined"), 10_000);
  assert.equal(declined.statusCode, 402, JSON.stringify(declined.body));
  assert.equal((await state(txnId)).refundedFils, 0);

  const retry = await refund(fixedAcquirer("approved"), 10_000);
  assert.equal(retry.statusCode, 200, JSON.stringify(retry.body));
  assert.equal((await state(txnId)).refundedFils, 10_000);
});

test("F3: an acquirer error releases its reservation", async () => {
  const { txnId, refund } = await setup("f3-error");

  const failed = await refund(fixedAcquirer("error"), 4_000);
  assert.equal(failed.statusCode, 502, JSON.stringify(failed.body));
  assert.equal((await state(txnId)).refundedFils, 0);
});

test("F3 (F2 follow-up): processRefund itself refuses another merchant's transaction", async () => {
  const { txnId, refund } = await setup("f3-scope");
  const other = await kit.createMerchant("f3-other");

  const result = await refund(fixedAcquirer("approved"), 1_000, other.merchantId);
  assert.equal(result.statusCode, 404, JSON.stringify(result.body));
  assert.equal((await state(txnId)).refundedFils, 0);
});

test("F3 (review): a capture that lands during the acquirer call is used for the status", async () => {
  const m = await kit.createMerchant("f3-capture-midflight");
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000, 4_000);
  // The acquirer, while "processing" the refund, lets the rest of the
  // authorization be captured: captured goes 4 000 -> 10 000 mid-refund.
  const acquirer: AcquirerSimulator = {
    ...fixedAcquirer("approved"),
    async refund(req): Promise<AcquirerRefundResult> {
      const res = await kit.app.inject({
        method: "POST",
        url: `/v1/transactions/${txnId}/capture`,
        headers: { authorization: `Bearer ${m.rawKey}`, "idempotency-key": randomUUID() },
        payload: { amountFils: 6_000 },
      });
      assert.equal(res.statusCode, 200, res.body);
      return { outcome: "approved", acquirerReference: req.acquirerReference, latencyMs: 0 };
    },
  };

  const result = await processRefund(kit.pool, acquirer, {
    transactionId: txnId,
    merchantId: m.merchantId,
    amountFils: toFils(1_000),
    idempotencyKey: randomUUID(),
    actor: m.actor,
  });

  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  const s = await state(txnId);
  assert.equal(s.refundedFils, 1_000);
  assert.equal(s.status, "partially_refunded"); // fully captured now, part refunded
});
