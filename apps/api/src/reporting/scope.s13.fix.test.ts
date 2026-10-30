import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { resolveReportMerchantId } from "./scope.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
after(async () => { await pool.end(); });

test("S13: report scope permits only the caller's own split children", async () => {
  const ids = Array.from({ length: 5 }, () => randomUUID());
  for (const id of ids) {
    await pool.query("INSERT INTO merchants (id, display_name, mdr_bps) VALUES ($1, $2, 250)", [id, `S13 ${id}`]);
  }
  const [parent, child, otherParent, otherChild, unrelated] = ids as [string, string, string, string, string];
  await pool.query(
    "INSERT INTO merchant_split_children (parent_merchant_id, child_merchant_id, split_weight_bps) VALUES ($1, $2, 10000), ($3, $4, 10000)",
    [parent, child, otherParent, otherChild],
  );
  assert.equal(await resolveReportMerchantId(pool, parent), parent);
  assert.equal(await resolveReportMerchantId(pool, parent, parent), parent);
  assert.equal(await resolveReportMerchantId(pool, parent, child), child);
  assert.equal(await resolveReportMerchantId(pool, parent, otherChild), parent);
  assert.equal(await resolveReportMerchantId(pool, parent, unrelated), parent);
});
