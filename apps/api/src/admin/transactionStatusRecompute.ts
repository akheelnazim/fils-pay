import type { PoolClient } from "pg";
import { toFils } from "@filspay/money";
import { nextStatusAfterRefund } from "../payments/refundState.js";

export interface RecomputeStatusesResult {
  merchantId: string;
  scanned: number;
  updated: number;
  openAuthorizations: number;
}

/** BIGINT columns arrive as text and are converted with toFils. */
interface CandidateRow {
  id: string;
  status: string;
  amount_fils: string;
  captured_fils: string;
  refunded_fils: string;
}

/** Backfill transaction statuses from amounts for one merchant. */
export async function recomputeTransactionStatusesForMerchant(
  client: PoolClient,
  merchantId: string,
): Promise<RecomputeStatusesResult> {
  const candidates = await client.query<CandidateRow>(
    // F19: count refunds that succeeded, not refunded_fils (which also holds the
    // amounts of refunds still in flight, F3), as processRefund does since F17.
    `SELECT t.id, t.status, t.amount_fils, t.captured_fils,
            (SELECT COALESCE(SUM(r.amount_fils), 0) FROM refunds r
              WHERE r.transaction_id = t.id AND r.status = 'succeeded') AS refunded_fils
       FROM transactions t
      WHERE t.merchant_id = $1 AND t.status NOT IN ('authorized', 'voided')
      FOR UPDATE OF t`,
    [merchantId],
  );

  let updated = 0;

  for (const row of candidates.rows) {
    const next = nextStatusAfterRefund({
      amountFils: toFils(Number(row.amount_fils)),
      capturedFils: toFils(Number(row.captured_fils)),
      refundedTotalFils: toFils(Number(row.refunded_fils)),
    });
    if (next !== row.status) {
      await client.query(`UPDATE transactions SET status = $2 WHERE id = $1`, [row.id, next]);
      updated += 1;
    }
  }

  // T3: the scan above skips 'authorized' rows, so count them on their own.
  const open = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM transactions WHERE merchant_id = $1 AND status = 'authorized'`,
    [merchantId],
  );
  const openAuthorizations = Number(open.rows[0]!.count);

  return { merchantId, scanned: candidates.rows.length, updated, openAuthorizations };
}
