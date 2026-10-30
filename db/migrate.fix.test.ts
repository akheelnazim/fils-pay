/**
 * D1: a fresh `npm run migrate` must succeed. 0054_views.sql created a view
 * on settlement_batch_events, a table no migration creates, so a new database
 * stopped there. ADR-0005 also reserves 0054–0056 for settlement v2.
 *
 * Runs the real runner against a throwaway database created and dropped here;
 * the shared database is never touched.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("migrate.fix.test.ts requires DATABASE_URL (used only to create and drop a throwaway database)");
}

const here = dirname(fileURLToPath(import.meta.url));
const throwawayName = `filspay_migrate_test_${process.pid}`;
const throwawayUrl = (() => {
  const u = new URL(databaseUrl);
  u.pathname = `/${throwawayName}`;
  return u.toString();
})();

async function admin(sql: string): Promise<void> {
  const c = new Client({ connectionString: databaseUrl });
  await c.connect();
  try {
    await c.query(sql);
  } finally {
    await c.end();
  }
}

let migrate: ReturnType<typeof spawnSync>;

before(async () => {
  await admin(`DROP DATABASE IF EXISTS ${throwawayName}`);
  await admin(`CREATE DATABASE ${throwawayName}`);
  migrate = spawnSync(process.execPath, ["--import", "tsx", join(here, "migrate.ts")], {
    env: { ...process.env, DATABASE_URL: throwawayUrl },
    encoding: "utf8",
  });
});

after(async () => {
  await admin(`DROP DATABASE IF EXISTS ${throwawayName}`);
});

test("D1: a fresh migrate no longer stops on the missing settlement_batch_events table", () => {
  // Full success on a fresh database also needs D2 (0055).
  assert.doesNotMatch(String(migrate.stderr), /settlement_batch_events/);
});

test("D1: 0054 and 0056 no longer use numbers ADR-0005 reserves", () => {
  const reserved = readdirSync(join(here, "migrations")).filter((f) => /^005[46]_/.test(f));
  assert.deepEqual(reserved, []);
});

test("D1: a database that applied the old 0054/0056 ends up with 0077's objects (read-only check)", async () => {
  const c = new Client({ connectionString: databaseUrl });
  await c.connect();
  try {
    const r = await c.query<{ view: string | null; col: string | null; gone1: string | null; gone2: string | null }>(
      `SELECT to_regclass('v_active_api_keys')::text AS view,
              (SELECT column_name FROM information_schema.columns
                WHERE table_name = 'api_keys' AND column_name = 'revoke_after') AS col,
              to_regclass('v_unbatched_capture_events')::text AS gone1,
              to_regclass('merchant_payable_position')::text AS gone2`,
    );
    assert.equal(r.rows[0]!.view, "v_active_api_keys");
    assert.equal(r.rows[0]!.col, "revoke_after");
    assert.equal(r.rows[0]!.gone1, null);
    assert.equal(r.rows[0]!.gone2, null);
  } finally {
    await c.end();
  }
});
