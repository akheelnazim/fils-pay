/**
 * M6: the platform volume counter must hold values past the int32 limit
 * (2,147,483,647 fils), and the tier read must still grant the bonus there.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import { getVolumeTierBonusBps } from "./platformVolumeTier.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("platformVolumeTier.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 2 });

test.after(async () => {
  await pool.end();
});

for (const total of [2_147_483_647, 2_147_483_648, 9_000_000_000]) {
  test(`M6: 15bps at a counter of ${total} fils`, async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE platform_stats SET total_processed_fils = $1 WHERE id = 1`, [total]);
      assert.equal(await getVolumeTierBonusBps(client), 15);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
}
