import { applyRateFils, toFils } from "@filspay/money";

/**
 * Fee left on a single capture after the negotiated discount, computed the
 * way capture.ts charges it (applyRateFils) and the discount adjustment gives
 * part back (applyRateFils on the fee): integer fils, banker's rounding (M13).
 */
export function estimateFeeFils(
  amountFils: number,
  mdrBps: number,
  discountBps: number,
): number {
  const fee = applyRateFils(toFils(amountFils), mdrBps);
  return fee - applyRateFils(fee, discountBps);
}
