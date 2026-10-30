import type { Pool } from "pg";
import { insertAdminAuditLog } from "../adminAudit/log.js";
import { withTransaction } from "../db/withTransaction.js";
import { voidTransaction } from "../payments/void.js";

/** What an operator found at the acquirer, checked outside this system. */
export type AttestedCaptureOutcome = "captured" | "not_captured";

export interface RecoverPaymentLinkInput {
  linkId: string;
  attestedOutcome: AttestedCaptureOutcome;
  reason: string;
  adminUserId: string;
}

export interface RecoverPaymentLinkResult {
  statusCode: number;
  body: Record<string, unknown>;
}

interface LockedLink {
  id: string;
  merchant_id: string;
  status: string;
  amount_fils: string | number;
  capture_transaction_id: string | null;
  /** The reservation is older than RECOVERY_MIN_AGE_MINUTES. */
  stale: boolean;
}

/**
 * A capture in flight keeps its reservation for as long as the acquirer takes
 * to answer. Recovery before that could release a link whose payment then
 * goes through, so it waits until the reservation is clearly abandoned.
 */
const RECOVERY_MIN_AGE_MINUTES = 15;

interface MarkedTransaction {
  status: string;
  captured_fils: string | number;
}

/**
 * R7: resolves a payment link left "processing" by an uncertain capture (R6).
 *
 * The system cannot ask the acquirer what happened, so an authorised operator
 * reports it. The report is acted on only when the local books agree with it,
 * and never on the local transaction status alone:
 *   - "captured": the link becomes paid, but only if the transaction is
 *     captured here for the full link amount; otherwise Finance must book the
 *     capture first (ledger_not_reconciled).
 *   - "not_captured": the link is released for a new attempt and the dangling
 *     authorization is voided, but only if no capture is recorded here
 *     (local_books_show_capture otherwise).
 * No charge is ever retried. One audit row is written in the same transaction
 * as the change; repeating the same report is a no-op.
 */
export async function recoverPaymentLinkCapture(
  pool: Pool,
  input: RecoverPaymentLinkInput,
): Promise<RecoverPaymentLinkResult> {
  let toVoid: { transactionId: string; merchantId: string } | null = null;

  const result = await withTransaction(pool, async (client): Promise<RecoverPaymentLinkResult> => {
    const linkResult = await client.query<LockedLink>(
      `SELECT id, merchant_id, status, amount_fils, capture_transaction_id,
              (reserved_at IS NOT NULL AND reserved_at < now() - ($2 || ' minutes')::interval) AS stale
         FROM payment_links WHERE id = $1 FOR UPDATE`,
      [input.linkId, RECOVERY_MIN_AGE_MINUTES],
    );
    const link = linkResult.rows[0];
    if (!link) return { statusCode: 404, body: { error: "payment_link_not_found" } };

    if (link.status !== "reserved" || link.capture_transaction_id === null) {
      // Not stuck now: a repeat of an earlier report is fine, anything else is not.
      const earlier = await client.query<{ outcome: string }>(
        `SELECT metadata->>'attestedOutcome' AS outcome FROM admin_audit_log
          WHERE action = 'payment_link_capture_recovery' AND target_type = 'payment_link' AND target_id = $1
          ORDER BY created_at DESC LIMIT 1`,
        [input.linkId],
      );
      const outcome = earlier.rows[0]?.outcome;
      if (outcome === input.attestedOutcome) {
        return { statusCode: 200, body: { alreadyResolved: true, status: link.status } };
      }
      return {
        statusCode: 409,
        body: { error: outcome ? "already_resolved_differently" : "not_awaiting_recovery", status: link.status },
      };
    }

    if (!link.stale) return { statusCode: 409, body: { error: "recently_reserved" } };

    const txnResult = await client.query<MarkedTransaction>(
      `SELECT status, captured_fils FROM transactions
        WHERE id = $1 AND merchant_id = $2 FOR UPDATE`,
      [link.capture_transaction_id, link.merchant_id],
    );
    const txn = txnResult.rows[0];
    if (!txn) return { statusCode: 409, body: { error: "marked_transaction_missing" } };
    const capturedHere = txn.status === "captured" && Number(txn.captured_fils) === Number(link.amount_fils);
    const anyCaptureHere = Number(txn.captured_fils) > 0;

    if (input.attestedOutcome === "captured") {
      if (!capturedHere) return { statusCode: 409, body: { error: "ledger_not_reconciled" } };
      await client.query(
        `UPDATE payment_links
            SET status = 'paid', paid_at = now(), transaction_id = $2, reserved_at = NULL, capture_transaction_id = NULL
          WHERE id = $1`,
        [link.id, link.capture_transaction_id],
      );
    } else {
      if (anyCaptureHere) return { statusCode: 409, body: { error: "local_books_show_capture" } };
      await client.query(
        `UPDATE payment_links
            SET status = 'active', reserved_at = NULL, capture_transaction_id = NULL
          WHERE id = $1`,
        [link.id],
      );
      toVoid = { transactionId: link.capture_transaction_id, merchantId: link.merchant_id };
    }

    await insertAdminAuditLog(client, {
      adminUserId: input.adminUserId,
      action: "payment_link_capture_recovery",
      targetType: "payment_link",
      targetId: link.id,
      metadata: {
        attestedOutcome: input.attestedOutcome,
        reason: input.reason,
        transactionId: link.capture_transaction_id,
      },
    });
    return {
      statusCode: 200,
      body: { alreadyResolved: false, status: input.attestedOutcome === "captured" ? "paid" : "active" },
    };
  });

  // Best effort, after the commit: the link is already released, and an
  // authorization the acquirer still holds expires on its own.
  const voidTarget = toVoid as { transactionId: string; merchantId: string } | null;
  if (result.statusCode === 200 && voidTarget) {
    try {
      const voided = await voidTransaction(pool, {
        transactionId: voidTarget.transactionId,
        merchantId: voidTarget.merchantId,
        actor: { type: "system", id: input.linkId },
      });
      result.body.authorizationVoided = voided.statusCode === 200;
    } catch (err) {
      console.error(`recoverPaymentLinkCapture: could not void authorization ${voidTarget.transactionId}`, err);
      result.body.authorizationVoided = false;
    }
  }
  return result;
}
