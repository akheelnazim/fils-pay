import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidDateString } from "./analytics.js";

test("X12: analytics date validation rejects impossible calendar dates", () => {
  assert.equal(isValidDateString("2026-02-30"), false);
  assert.equal(isValidDateString("2024-02-29"), true);
  assert.equal(isValidDateString("2025-02-29"), false);
  assert.equal(isValidDateString("2026-13-01"), false);
});
