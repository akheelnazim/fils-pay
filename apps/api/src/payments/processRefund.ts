import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { ZERO_FILS, addFils, calculateRefundFee, compareFils, subtractFils, toFils, type Fils } from "@filspay/money";
import { enqueueEvent } from "@filspay/events";
import { withTransaction } from "../db/withTransaction.js";
import type { AcquirerSimulator } from "../acquirer/types.js";
import { claimIdempotencyKey, completeIdempotencyKey, failIdempotencyKey, hashRequest } from "./idempotency.js";
import { recordTransactionEvent } from "../transactions/events.js";
import { nextStatusAfterRefund, type PostRefundStatus } from "./refundState.js";
import { validateRefundRequest } from "./refundValidation.js";
import { ConflictError, UnprocessableEntityError } from "../lib/errors.js";

const ENDPOINT = "refunds.create";

export interface ProcessRefundInput {
  transactionId: string;
  merchantId: string;
  amountFils?: Fils;
  idempotencyKey: string;
  actor: { type: "merchant_session" | "merchant_api_key"; id: string };
  reason?: string;
}

export interface ProcessRefundResult {
  statusCode: number;
  body: unknown;
}

interface RefundTransactionRow {
  id: string;
  merchant_id: string;
  status: string;
  amount_fils: string | number;
  captured_fils: string | number;
  refunded_fils: string | number;
  acquirer_reference: string;
}

/** Refund business logic: validate, call the acquirer, then journal the reversal. */
export async function processRefund(
  pool: Pool,
  acquirer: AcquirerSimulator,
  input: ProcessRefundInput,
): Promise<ProcessRefundResult> {
  const requestHash = hashRequest({
    transactionId: input.transactionId,
    amountFils: input.amountFils ?? null,
    reason: input.reason ?? null,
  });

  // 1 validate
  const prepared = await withTransaction(pool, async (client) => {
    const claim = await claimIdempotencyKey(client, {
      merchantId: input.merchantId,
      endpoint: ENDPOINT,
      key: input.idempotencyKey,
      requestHash,
    });

    if (claim.outcome === "conflict_hash_mismatch") {
      throw new UnprocessableEntityError("idempotency_key_reused");
    }
    if (claim.outcome === "conflict_in_progress") {
      throw new ConflictError("request_in_progress");
    }
    if (claim.outcome === "replay") {
      return {
        kind: "settled" as const,
        result: { statusCode: claim.row.responseStatusCode ?? 200, body: claim.row.responseBody },
      };
    }

    // F3: lock the row so a concurrent refund waits and then sees this
    // one's reservation below. F2: scoped to the calling merchant.
    const txnResult = await client.query<RefundTransactionRow>(
      `SELECT id, merchant_id, status, amount_fils, captured_fils, refunded_fils, acquirer_reference
         FROM transactions
        WHERE id = $1 AND merchant_id = $2
        FOR UPDATE`,
      [input.transactionId, input.merchantId],
    );
    const txn = txnResult.rows[0];
    if (!txn) {
      const body = { error: "transaction_not_found" };
      await completeIdempotencyKey(client, claim.row.id, { statusCode: 404, body });
      return { kind: "settled" as const, result: { statusCode: 404, body } };
    }

    const amountAuthorized = toFils(Number(txn.amount_fils));
    const capturedFils = toFils(Number(txn.captured_fils));
    const refundedFils = toFils(Number(txn.refunded_fils));

    // F1: only money actually taken from the card can go back.
    const refundableFils = subtractFils(capturedFils, refundedFils);

    const validation = validateRefundRequest(
      {
        id: txn.id,
        merchantId: txn.merchant_id,
        status: txn.status,
        capturedFils,
        refundableFils,
      },
      input.amountFils,
    );

    if (!validation.ok) {
      const statusCode = validation.code === "transaction_not_refundable" ? 409 : 422;
      // The API's error shape is { error, ... } (F6 review: the drawer and
      // integrations read `error`); the validator's own shape stays internal.
      const { ok: _ok, code, ...details } = validation;
      const body = { error: code, ...details };
      await completeIdempotencyKey(client, claim.row.id, { statusCode, body });
      return { kind: "settled" as const, result: { statusCode, body } };
    }

    // The fee this transaction was actually charged at capture, read from
    // the ledger rather than recomputed from the merchant's current
    // mdr_bps, so a rate change after capture can never retroactively alter
    // what a refund reverses.
    const feeResult = await client.query<{ fee_fils: string }>(
      // F4: net of the negotiated-discount adjustment (a debit on this
      // account), and leaving out earlier refunds' own fee reversals. The
      // filter relies on the 'refund: ...' descriptions written in step 3 below.
      `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_fils ELSE -amount_fils END), 0)::text AS fee_fils
         FROM ledger_entries
        WHERE transaction_id = $1
          AND account_id = 'platform_fee_revenue'
          AND description NOT LIKE 'refund:%'`,
      [txn.id],
    );
    const feeRow = feeResult.rows[0];
    if (!feeRow) {
      throw new Error("processRefund: fee aggregate returned no row");
    }

    // F3: reserve the amount before calling the acquirer, under the lock, so
    // no other refund can validate against the old total. Released in step 3
    // if the acquirer declines or errors.
    // F22: pending_refund_fils says how much of that reservation is still
    // waiting on the acquirer.
    await client.query(
      `UPDATE transactions
          SET refunded_fils = refunded_fils + $2, pending_refund_fils = pending_refund_fils + $2
        WHERE id = $1`,
      [txn.id, validation.amountFils],
    );
    // F22: the refund exists from here on, as 'pending', so a crash before
    // step 3 leaves a visible row instead of an anonymous reservation.
    const pendingRow = await client.query<{ id: string }>(
      `INSERT INTO refunds
         (transaction_id, merchant_id, amount_fils, fee_reversed_fils, status,
          acquirer_reference, reason, created_by_type, created_by_id)
       VALUES ($1, $2, $3, 0, 'pending', $4, $5, $6, $7)
       RETURNING id`,
      [
        txn.id,
        txn.merchant_id,
        validation.amountFils,
        txn.acquirer_reference,
        // F14: an explicit NULL bypasses the column default and fails 0070's CHECK.
        input.reason ?? "unspecified",
        input.actor.type,
        input.actor.id,
      ],
    );

    return {
      kind: "proceed" as const,
      claimId: claim.row.id,
      attemptCount: claim.row.attemptCount,
      refundId: pendingRow.rows[0]!.id,
      transactionId: txn.id,
      merchantId: txn.merchant_id,
      acquirerReference: txn.acquirer_reference,
      amountAuthorized,
      capturedFils,
      refundedFils,
      feeChargedFils: toFils(Number(feeRow.fee_fils)),
      requestedAmount: validation.amountFils,
    };
  });

  if (prepared.kind === "settled") {
    return prepared.result;
  }

  // 2 acquirer
  const acquirerResult = await acquirer.refund({
    acquirerReference: prepared.acquirerReference,
    amountFils: prepared.requestedAmount,
    idempotencyKey: `${prepared.claimId}:${prepared.attemptCount}`,
  });

  // 3 journal
  return withTransaction(pool, async (client) => {
    // F3: the current totals, read under the lock: a capture may have landed
    // during the acquirer call. F17: the refunded total is what has actually
    // succeeded (refunded_fils also holds other in-flight refunds' reservations,
    // which can still be declined), so statuses and events never run ahead.
    const current = async (): Promise<{ refundedFils: Fils; capturedFils: Fils }> => {
      const r = await client.query<{ captured_fils: string; succeeded_fils: string }>(
        `SELECT t.captured_fils,
                (SELECT COALESCE(SUM(amount_fils), 0) FROM refunds
                  WHERE transaction_id = t.id AND status = 'succeeded')::text AS succeeded_fils
           FROM transactions t WHERE t.id = $1 FOR UPDATE`,
        [prepared.transactionId],
      );
      return {
        refundedFils: toFils(Number(r.rows[0]!.succeeded_fils)),
        capturedFils: toFils(Number(r.rows[0]!.captured_fils)),
      };
    };
    const setStatus = async (now: { refundedFils: Fils; capturedFils: Fils }): Promise<PostRefundStatus> => {
      const status = nextStatusAfterRefund({
        amountFils: prepared.amountAuthorized,
        capturedFils: now.capturedFils,
        refundedTotalFils: now.refundedFils,
      });
      await client.query(`UPDATE transactions SET status = $2 WHERE id = $1`, [prepared.transactionId, status]);
      return status;
    };

    if (acquirerResult.outcome !== "approved") {
      // F3: release the reservation made in step 1; F22: the refund failed.
      await client.query(
        `UPDATE transactions
            SET refunded_fils = refunded_fils - $2, pending_refund_fils = pending_refund_fils - $2
          WHERE id = $1`,
        [prepared.transactionId, prepared.requestedAmount],
      );
      await client.query(`UPDATE refunds SET status = 'failed' WHERE id = $1`, [prepared.refundId]);
      await setStatus(await current());
    }
    if (acquirerResult.outcome === "declined") {
      const body = { error: "refund_declined" };
      await completeIdempotencyKey(client, prepared.claimId, { statusCode: 402, body });
      return { statusCode: 402, body };
    }
    if (acquirerResult.outcome === "error") {
      const body = { error: "acquirer_unavailable" };
      await failIdempotencyKey(client, prepared.claimId, { statusCode: 502, body });
      return { statusCode: 502, body };
    }

    // F3/F17: the succeeded refunds so far plus this one (its row is inserted below).
    const before = await current();
    const now = { ...before, refundedFils: addFils(before.refundedFils, prepared.requestedAmount) };
    const newRefundedTotal = now.refundedFils;
    const newStatus = await setStatus(now);
    // F5: each refund's share is rounded on its own, so the shares can add up
    // to more (or less) than the fee charged. Cap the running total at the
    // fee, and the refund that brings the money back to the full capture
    // gives back whatever fee is left. Earlier refunds are read under the
    // transaction lock taken by current() above.
    const earlier = await client.query<{ amount_fils: string; fee_reversed_fils: string }>(
      `SELECT COALESCE(SUM(amount_fils), 0)::text AS amount_fils,
              COALESCE(SUM(fee_reversed_fils), 0)::text AS fee_reversed_fils
         FROM refunds WHERE transaction_id = $1 AND status = 'succeeded'`,
      [prepared.transactionId],
    );
    const earlierRefundedFils = toFils(Number(earlier.rows[0]!.amount_fils));
    const feeLeftFils = subtractFils(
      prepared.feeChargedFils,
      toFils(Number(earlier.rows[0]!.fee_reversed_fils)),
    );
    const share = calculateRefundFee(prepared.capturedFils, prepared.feeChargedFils, prepared.requestedAmount);
    const isFinalRefund = compareFils(addFils(earlierRefundedFils, prepared.requestedAmount), now.capturedFils) >= 0;
    const feeReversedFils =
      compareFils(feeLeftFils, ZERO_FILS) <= 0
        ? ZERO_FILS
        : isFinalRefund || compareFils(share, feeLeftFils) > 0
          ? feeLeftFils
          : share;

    // F22: the pending row from step 1 becomes the succeeded refund; it
    // happened now, when the acquirer approved it.
    const refundResult = await client.query<{ id: string; occurred_at: Date }>(
      `UPDATE refunds
          SET status = 'succeeded', fee_reversed_fils = $2, acquirer_reference = $3, occurred_at = now()
        WHERE id = $1 AND status = 'pending'
        RETURNING id, occurred_at`,
      [prepared.refundId, feeReversedFils, acquirerResult.acquirerReference],
    );
    await client.query(`UPDATE transactions SET pending_refund_fils = pending_refund_fils - $2 WHERE id = $1`, [
      prepared.transactionId,
      prepared.requestedAmount,
    ]);
    const refund = refundResult.rows[0];
    if (!refund) {
      throw new Error("processRefund: the pending refund row was not found");
    }

    // Double-entry reversal, mirroring capture's legs with the directions
    // swapped. ledger_entries has CHECK (amount_fils > 0), so a reversal
    // flips direction and never the sign.
    const entryGroupId = randomUUID();
    await client.query(
      `INSERT INTO ledger_entries
         (entry_group_id, merchant_id, transaction_id, account_id, direction, amount_fils, occurred_at, description)
       VALUES
         ($1, $2, $3, 'merchant_payable',     'debit',  $4, now(), 'refund: gross'),
         ($1, $2, $3, 'card_scheme_clearing', 'credit', $4, now(), 'refund: gross')`,
      [entryGroupId, prepared.merchantId, prepared.transactionId, prepared.requestedAmount],
    );
    if (compareFils(feeReversedFils, ZERO_FILS) > 0) {
      await client.query(
        `INSERT INTO ledger_entries
           (entry_group_id, merchant_id, transaction_id, account_id, direction, amount_fils, occurred_at, description)
         VALUES
           ($1, $2, $3, 'platform_fee_revenue', 'debit',  $4, now(), 'refund: MDR fee reversal'),
           ($1, $2, $3, 'merchant_payable',     'credit', $4, now(), 'refund: MDR fee reversal')`,
        [entryGroupId, prepared.merchantId, prepared.transactionId, feeReversedFils],
      );
    }

    // The timeline records what this refund did to the captured amount, so
    // it stays readable regardless of what the status column ends up
    // saying: everything captured has now gone back, or only part of it has.
    const eventType = compareFils(newRefundedTotal, now.capturedFils) >= 0 ? "refunded" : "refund_partial";

    await recordTransactionEvent(client, {
      transactionId: prepared.transactionId,
      eventType,
      amountFils: toFils(-prepared.requestedAmount, { allowNegative: true }),
      actor: input.actor,
      metadata: {
        refundId: refund.id,
        feeReversedFils,
        acquirerReference: acquirerResult.acquirerReference,
      },
    });

    await enqueueEvent(client, {
      eventType: "refund.succeeded",
      aggregateType: "transaction",
      aggregateId: prepared.transactionId,
      payload: {
        merchantId: prepared.merchantId,
        refundId: refund.id,
        amountFils: prepared.requestedAmount,
        feeReversedFils,
        refundedTotalFils: newRefundedTotal,
        newStatus,
      },
    });

    const body = {
      id: refund.id,
      transactionId: prepared.transactionId,
      merchantId: prepared.merchantId,
      amountFils: prepared.requestedAmount,
      feeReversedFils,
      status: "succeeded",
      transactionStatus: newStatus,
      refundedTotalFils: newRefundedTotal,
      acquirerReference: acquirerResult.acquirerReference,
      occurredAt: refund.occurred_at.toISOString(),
    };
    await completeIdempotencyKey(client, prepared.claimId, {
      statusCode: 200,
      body,
      resourceId: refund.id,
    });
    return { statusCode: 200, body };
  });
}
