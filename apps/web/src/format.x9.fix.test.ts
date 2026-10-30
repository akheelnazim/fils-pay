import assert from "node:assert/strict";
import test from "node:test";
import { bhd } from "./format.js";

test("X9: reconciliation amounts format a negative gap without throwing", () => {
  assert.equal(bhd(-1), "-0.001 BHD");
  assert.equal(bhd(-1234), "-1.234 BHD");
});
