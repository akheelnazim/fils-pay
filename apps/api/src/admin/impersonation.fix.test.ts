/**
 * S8: "view as merchant" is read-only. An impersonating admin, of any role,
 * must not be able to change a merchant's data. Requires DATABASE_URL to
 * point at a migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { lookupImpersonationGrant, startImpersonation } from "./impersonation.js";
import { recordKycReview } from "../onboarding/review.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("impersonation.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
}

const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
});
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);

test.after(async () => {
  await app.close();
  await pool.end();
});

async function superAdminImpersonating(): Promise<{ merchantId: string; cookie: string; rawToken: string }> {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`S8 fix ${randomUUID().slice(0, 8)}`],
  );
  const merchantId = merchant.rows[0]!.id;
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const admin = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role)
     VALUES ($1, 'unused', 'S8 Fix', 'super_admin') RETURNING id`,
    [`s8-${randomUUID()}@admin.test`],
  );
  const grant = await startImpersonation(pool, { adminUserId: admin.rows[0]!.id, merchantId, ttlMinutes: 15 });
  return { merchantId, rawToken: grant.rawToken, cookie: `${config.impersonationCookieName}=${grant.rawToken}` };
}

test("S8: impersonation always carries the read-only support role", async () => {
  const { rawToken } = await superAdminImpersonating();
  const grant = await lookupImpersonationGrant(pool, rawToken);
  assert.equal(grant?.merchantRole, "support");
});

test("S8: an impersonating super_admin cannot create a payment link", async () => {
  const { merchantId, cookie } = await superAdminImpersonating();
  const res = await app.inject({
    method: "POST",
    url: `/v1/merchants/${merchantId}/payment-links`,
    headers: { cookie },
    payload: { amountFils: 4_750, reference: "s8", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  });
  assert.equal(res.statusCode, 403, res.body);
});

test("S8: an impersonating admin cannot write through routes that have no role check", async () => {
  const { cookie } = await superAdminImpersonating();
  const res = await app.inject({
    method: "POST",
    url: "/v1/reporting/saved-filters",
    headers: { cookie },
    payload: { name: "s8", filter: { status: ["captured"] } },
  });
  assert.equal(res.statusCode, 403, res.body);
});

test("S8: an impersonating admin can still read the merchant's data", async () => {
  const { cookie } = await superAdminImpersonating();
  const res = await app.inject({ method: "GET", url: "/v1/transactions", headers: { cookie } });
  assert.equal(res.statusCode, 200, res.body);
});
