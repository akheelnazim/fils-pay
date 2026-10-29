/**
 * S10: two-person control on credits must compare who the operators are
 * (admin user id), not what they are called (display name).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { assertDistinctApprover } from "./creditApproval.js";

test("S10: the same operator under a different display name cannot approve their own credit", () => {
  const id = randomUUID();
  assert.throws(() =>
    assertDistinctApprover({ adminUserId: id, displayName: "Dana Finance" }, { adminUserId: id, displayName: "D. Finance" }),
  );
});

test("S10: two different operators who share a display name can approve each other's credits", () => {
  assert.doesNotThrow(() =>
    assertDistinctApprover(
      { adminUserId: randomUUID(), displayName: "Ali Hassan" },
      { adminUserId: randomUUID(), displayName: "Ali Hassan" },
    ),
  );
});
