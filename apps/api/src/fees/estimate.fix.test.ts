/**
 * M13: the reconciliation pending figure estimated each capture's fee with
 * float rates and Math.round, while capture charges applyRateFils (integer,
 * banker's rounding) and the discount adjustment gives back
 * applyRateFils(fee, discountBps). On .5 boundaries the two disagree by a fil.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { applyRateFils, toFils } from "@filspay/money";
import { estimateFeeFils } from "./estimate.js";

/** What capture + the discount adjustment actually leave as the merchant's fee. */
function chargedFee(amount: number, mdrBps: number, discountBps: number): number {
  const fee = applyRateFils(toFils(amount), mdrBps);
  return fee - applyRateFils(fee, discountBps);
}

test("M13: a half-fil fee rounds like capture (banker's), not Math.round", () => {
  // 20 fils at 250 bps = 0.5 fils: capture charges 0.
  assert.equal(estimateFeeFils(20, 250, 0), chargedFee(20, 250, 0));
  assert.equal(estimateFeeFils(20, 250, 0), 0);
});

test("M13: the discount is rounded on the fee, as the adjustment does", () => {
  // 10200 at 250 bps = 255 fee; 10% discount = 25.5 -> 26 back, so 229 (float said 230).
  assert.equal(estimateFeeFils(10_200, 250, 1_000), chargedFee(10_200, 250, 1_000));
  assert.equal(estimateFeeFils(10_200, 250, 1_000), 229);
});

test("M13: ordinary amounts, zero and no discount still match", () => {
  for (const [amount, mdr, disc] of [
    [0, 250, 0],
    [1, 250, 0],
    [4750, 250, 0],
    [1333, 225, 500],
    [999_999, 300, 2_500],
    [123_456_789, 245, 0],
  ] as const) {
    assert.equal(estimateFeeFils(amount, mdr, disc), chargedFee(amount, mdr, disc), `${amount} @ ${mdr}/${disc}`);
  }
});
