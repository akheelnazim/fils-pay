import { addFils, applyRateFils, compareFils, toFils, ZERO_FILS, type Fils } from "@filspay/money";

/** The two figures that make up a manual credit: what the operator asked to
 *  credit, and the MDR the platform hands back alongside it. */
export interface CreditAmounts {
  baseAmountFils: Fils;
  feeReversalFils: Fils;
}

/** Credits at or below this need one operator; above it, two. 50.000 BD. */
export const CREDIT_APPROVAL_THRESHOLD_FILS: Fils = toFils(50_000);

/**
 * Maker-checker: does this credit need a second approver? X4: the merchant
 * receives base + reversal, and `recentSingleOperatorFils` (credits to the same
 * merchant posted without a second approver in the last 24 hours) is added so
 * the limit can't be split across requests.
 */
export function creditRequiresSecondApprover(
  draft: CreditAmounts,
  recentSingleOperatorFils: Fils = ZERO_FILS,
): boolean {
  const total = addFils(addFils(draft.baseAmountFils, draft.feeReversalFils), recentSingleOperatorFils);
  return compareFils(total, CREDIT_APPROVAL_THRESHOLD_FILS) > 0;
}

/** Computes the MDR reversal for a manual credit. */
export function calculateCreditFeeReversal(baseAmountFils: Fils, mdrBps: number): Fils {
  return applyRateFils(baseAmountFils, mdrBps);
}
