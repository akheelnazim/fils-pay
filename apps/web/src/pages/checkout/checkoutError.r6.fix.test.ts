import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutFailure } from "./checkoutError.js";

test("R6: uncertain capture and lost network responses advise contacting the merchant", () => {
  for (const state of [checkoutFailure(502, { error: "payment_link_capture_uncertain" }), checkoutFailure(500, { error: "internal_error" }), checkoutFailure()]) {
    assert.equal(state.kind, "terminal");
    assert.match(state.message, /may have been charged/);
    assert.match(state.message, /contact the merchant/);
  }
  assert.equal(checkoutFailure(502, { error: "acquirer_unavailable", stage: "authorize" }).kind, "declined");
  assert.equal(checkoutFailure(402, { error: "card_declined" }).kind, "declined");
});
