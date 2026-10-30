/**
 * M12: discountAdjustment.ts exported parsePromotionalDiscountFils, which read a
 * BD string with parseFloat and multiplied by 100 (cents, not fils): "1.250" BD
 * became 125 fils instead of 1250. Nothing called it; it is removed so it can't
 * be wired up. parseBhdToFils (packages/money) is the parser to use.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBhdToFils } from "@filspay/money";
import * as discountAdjustment from "./discountAdjustment.js";

test("M12: the float BD parser is no longer exported", () => {
  assert.equal("parsePromotionalDiscountFils" in discountAdjustment, false);
});

test("M12: parseBhdToFils gives fils for the same inputs", () => {
  assert.equal(parseBhdToFils("1.250"), 1250);
  assert.equal(parseBhdToFils("0.001"), 1);
  assert.equal(parseBhdToFils("0"), 0);
  assert.throws(() => parseBhdToFils("1.2345"));
});
