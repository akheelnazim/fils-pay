/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { yesterdayIso } from "./businessDate.js";

test("T5: yesterday follows Bahrain's calendar across midnight and year boundaries", () => {
  const cases: Array<[string, string]> = [
    ["2026-10-29T20:59:59Z", "2026-10-28"],
    ["2026-10-29T21:00:00Z", "2026-10-29"],
    ["2024-02-29T21:00:00Z", "2024-02-29"],
    ["2025-12-31T21:00:00Z", "2025-12-31"],
  ];
  for (const [instant, expected] of cases) {
    assert.equal(yesterdayIso(new Date(instant)), expected, instant);
  }
});
