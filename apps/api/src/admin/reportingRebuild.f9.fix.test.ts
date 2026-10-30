/**
 * F9: refreshAnalyticsRollups rebuilt merchant_daily_volume from
 * transaction_events only, so a rebuild wiped every refund count.
 * Runs inside a transaction that is rolled back (the rebuild truncates the
 * rollup tables the other tests share).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { toFils } from "@filspay/money";
import { processRefund } from "../payments/processRefund.js";
import { createRefundTestKit, fixedAcquirer } from "../payments/refundTestSupport.js";
import { refreshAnalyticsRollups } from "./reportingRebuild.js";

const kit = createRefundTestKit("admin/reportingRebuild.f9.fix.test.ts");
after(() => kit.close());

test("F9: a rebuild keeps refund_count and refund_gross_fils on the Bahrain day", async () => {
  const m = await kit.createMerchant("f9-rebuild");
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
  for (const amount of [1_000, 2_500]) {
    const r = await processRefund(kit.pool, fixedAcquirer("approved"), {
      transactionId: txnId,
      merchantId: m.merchantId,
      amountFils: toFils(amount),
      idempotencyKey: randomUUID(),
      actor: m.actor,
    });
    assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  }
  // 23:30 Bahrain on 2026-06-15 is 20:30Z; the UTC date would be the same here,
  // so pin one of them to 22:30Z (01:30 on the 16th in Bahrain).
  await kit.pool.query(
    `UPDATE refunds SET occurred_at = '2026-06-15T22:30:00Z' WHERE transaction_id = $1 AND amount_fils = 2500`,
    [txnId],
  );
  await kit.pool.query(
    `UPDATE refunds SET occurred_at = '2026-06-15T09:00:00Z' WHERE transaction_id = $1 AND amount_fils = 1000`,
    [txnId],
  );

  const client = await kit.pool.connect();
  try {
    await client.query("BEGIN");
    await refreshAnalyticsRollups(client);
    const r = await client.query(
      `SELECT volume_date::text AS d, refund_count::int AS n, refund_gross_fils::int AS gross
         FROM merchant_daily_volume WHERE merchant_id = $1 AND refund_count > 0 ORDER BY volume_date`,
      [m.merchantId],
    );
    assert.deepEqual(r.rows, [
      { d: "2026-06-15", n: 1, gross: 1_000 },
      { d: "2026-06-16", n: 1, gross: 2_500 },
    ]);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
