/**
 * M1: adjustment CSV amounts are BD text and must become fils exactly
 * (1 BD = 1000 fils, ADR-0001), never cents.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAdjustmentAmountFils } from "./adjustmentCsvParsing.js";

test("M1: two-decimal BD amounts become fils, not cents", () => {
  assert.equal(parseAdjustmentAmountFils("4.75"), 4_750);
  assert.equal(parseAdjustmentAmountFils("120.00"), 120_000);
});

test("M1: the third decimal is kept, not truncated", () => {
  assert.equal(parseAdjustmentAmountFils("4.755"), 4_755);
  assert.equal(parseAdjustmentAmountFils("0.005"), 5);
});

test("M1 edge cases: whole BD, negatives and surrounding spaces", () => {
  assert.equal(parseAdjustmentAmountFils("4"), 4_000);
  assert.equal(parseAdjustmentAmountFils("-3.50"), -3_500);
  assert.equal(parseAdjustmentAmountFils(" 4.75 "), 4_750);
});

test("M1 edge cases: more than three decimals or junk is rejected, not rounded", () => {
  assert.throws(() => parseAdjustmentAmountFils("1.2345"), /could not parse amount/);
  assert.throws(() => parseAdjustmentAmountFils("4.75 BD"), /could not parse amount/);
  assert.throws(() => parseAdjustmentAmountFils("4,75"), /could not parse amount/);
});
