/**
 * Q1: the webhook retry delay is base × 2^(n-1), capped, with ±10% jitter.
 * Pure unit tests pinning the jitter range and the cap.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { backoffDelayMs } from "./dispatcher.js";

const config = { webhookBackoffBaseMs: 1_000, webhookBackoffCapMs: 60_000 };

test("Q1: jitter stays within ±10% of the un-jittered delay", () => {
  assert.equal(backoffDelayMs(1, config, () => 0), 900);
  assert.equal(backoffDelayMs(1, config, () => 0.5), 1_000);
  assert.equal(backoffDelayMs(1, config, () => 0.999999), 1_100);
  for (let i = 0; i < 200; i++) {
    const d = backoffDelayMs(3, config);
    assert.ok(d >= 3_600 && d <= 4_400, `attempt 3 delay ${d} outside 4000 ±10%`);
  }
});

test("Q1: the delay never exceeds the cap (plus jitter)", () => {
  assert.equal(backoffDelayMs(20, config, () => 0.5), 60_000);
  assert.ok(backoffDelayMs(20, config, () => 0.999999) <= 66_000);
});
