/**
 * D2: 0055_chart_of_accounts_suspense.sql inserted into columns
 * chart_of_accounts doesn't have (code, account_type, description) with a
 * kind its CHECK rejects, so a fresh migrate failed there. With D1 and D2 a
 * fresh `npm run migrate` must now run to the end.
 *
 * Runs the real runner against a throwaway database created and dropped here.
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
  throw new Error("migrate.d2.fix.test.ts requires DATABASE_URL (used only to create and drop a throwaway database)");
}

const here = dirname(fileURLToPath(import.meta.url));
const throwawayName = `filspay_migrate_d2_test_${process.pid}`;
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

test("D2: npm run migrate runs to the end on an empty database", () => {
  assert.equal(migrate.status, 0, `migrate failed:\n${migrate.stderr}`);
});

test("D2: no migration uses the numbers ADR-0005 reserves (0054–0056)", () => {
  const reserved = readdirSync(join(here, "migrations")).filter((f) => /^005[4-6]_/.test(f));
  assert.deepEqual(reserved, []);
});

test("D2: a fresh database has 0077's objects and the ledger accounts", async () => {
  const c = new Client({ connectionString: throwawayUrl });
  await c.connect();
  try {
    const r = await c.query<{ view: string | null; col: string | null; accounts: string }>(
      `SELECT to_regclass('v_active_api_keys')::text AS view,
              (SELECT column_name FROM information_schema.columns
                WHERE table_name = 'api_keys' AND column_name = 'revoke_after') AS col,
              (SELECT string_agg(id, ',' ORDER BY id) FROM chart_of_accounts) AS accounts`,
    );
    assert.equal(r.rows[0]!.view, "v_active_api_keys");
    assert.equal(r.rows[0]!.col, "revoke_after");
    assert.match(r.rows[0]!.accounts, /merchant_payable/);
    assert.match(r.rows[0]!.accounts, /scheme_rounding_residue/);
  } finally {
    await c.end();
  }
});
