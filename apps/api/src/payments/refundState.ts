import { ZERO_FILS, compareFils, type Fils } from "@filspay/money";

/**
 * The `transactions.status` a row should carry once a refund has been
 * applied to it.
 *
 * Status on this platform is derived from the money columns rather than
 * transitioned by hand: `capture.ts` computes it from `captured_fils` against
 * `amount_fils` at the end of every capture, and this is the same idea for
 * the refund side. Deriving it keeps the status and the amounts from ever
 * disagreeing, and keeps the rule in one readable, testable place instead of
 * spread across the endpoints that happen to write the column.
 */

/**
 * "refunded" means refunded_fils === captured_fils (all of what was captured,
 * even if less than the authorization); "partially_refunded" means
 * 0 < refunded_fils < captured_fils on a fully captured transaction. A
 * transaction is never left in a capture status once its full captured
 * amount has been returned.
 */
export type PostRefundStatus = "captured" | "partially_captured" | "partially_refunded" | "refunded";

export interface PostRefundStatusInput {
  /** The authorized amount. */
  amountFils: Fils;
  capturedFils: Fils;
  /** The refunded total *after* the refund being applied, not the delta. */
  refundedTotalFils: Fils;
}

// Finance rule: "a transaction is refunded when every fils we captured went back".
// A transaction that is only part-captured keeps its capture status until then,
// so the authorization headroom stays usable while some of it is still out.
export function nextStatusAfterRefund(input: PostRefundStatusInput): PostRefundStatus {
  if (
    compareFils(input.capturedFils, ZERO_FILS) > 0 &&
    compareFils(input.refundedTotalFils, input.capturedFils) >= 0
  ) {
    return "refunded";
  }
  if (compareFils(input.capturedFils, input.amountFils) < 0) {
    return "partially_captured";
  }
  if (compareFils(input.refundedTotalFils, ZERO_FILS) === 0) {
    return "captured";
  }
  return "partially_refunded";
}
