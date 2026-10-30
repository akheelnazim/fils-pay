import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";

const databaseUrl = process.env.DATABASE_URL!;
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=" });
const pool = new Pool({ connectionString: databaseUrl });
const app = buildApp(config, pool);
test.after(async () => { await app.close(); await pool.end(); });

test("S19: export summary requires authentication and scopes results to the merchant", async () => {
  const unauthenticated = await app.inject({ method: "GET", url: "/v1/reporting/export-summary" });
  assert.equal(unauthenticated.statusCode, 401);
  const merchants = await pool.query<{ id: string }>(
    "INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250), ($2, 250) RETURNING id",
    [`S19 ${randomUUID()}`, `S19 ${randomUUID()}`],
  );
  const [own, other] = merchants.rows.map((row) => row.id) as [string, string];
  const user = await pool.query<{ id: string }>(
    "INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id",
    [own, `s19-${randomUUID()}@example.com`],
  );
  const key = await issueApiKey(pool, config, { merchantId: own, createdBy: user.rows[0]!.id, label: "S19" });
  await pool.query("INSERT INTO merchant_daily_volume (merchant_id, volume_date, captured_gross_fils) VALUES ($1, '2026-01-01', 1000), ($2, '2026-01-01', 9000)", [own, other]);
  const response = await app.inject({ method: "GET", url: "/v1/reporting/export-summary", headers: { authorization: `Bearer ${key.rawKey}` } });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json(), { totalDays: 1, grossFils: 1000 });
});
