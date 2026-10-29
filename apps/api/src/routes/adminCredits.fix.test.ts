/**
 * S12: only finance and super_admin may issue a merchant credit; support is
 * refused by the server, not just hidden in the UI. Requires DATABASE_URL to
 * point at a migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { hashPassword } from "../auth/passwords.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("adminCredits.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
}

const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  OTP_DEV_EXPOSE: "true",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
});
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
const PASSWORD = "S12-fix-password!";

test.after(async () => {
  await app.close();
  await pool.end();
});

async function signedInAdmin(role: "support" | "finance"): Promise<string> {
  const email = `s12-${role}-${randomUUID()}@admin.test`;
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, $2, $3, $4)`,
    [email, await hashPassword(PASSWORD, config), `S12 ${role}`, role],
  );
  const login = await app.inject({ method: "POST", url: "/v1/admin/auth/login", payload: { email, password: PASSWORD } });
  const c = login.cookies.find((x) => x.name === config.adminCookieName)!;
  const cookie = `${c.name}=${c.value}`;
  const verify = await app.inject({
    method: "POST",
    url: "/v1/admin/auth/otp/verify",
    headers: { cookie },
    payload: { code: login.json().devOtpCode },
  });
  assert.equal(verify.statusCode, 200, verify.body);
  const promoted = verify.cookies.find((x) => x.name === config.adminCookieName);
  return promoted ? `${promoted.name}=${promoted.value}` : cookie;
}

async function createMerchant(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`S12 fix ${randomUUID().slice(0, 8)}`],
  );
  return r.rows[0]!.id;
}

function issue(cookie: string, merchantId: string) {
  return app.inject({
    method: "POST",
    url: `/v1/admin/merchants/${merchantId}/credits`,
    headers: { cookie },
    payload: { baseAmountFils: 1_000, reasonCode: "goodwill", effectiveDate: new Date().toISOString().slice(0, 10) },
  });
}

test("S12: a support admin cannot issue a merchant credit", async () => {
  const support = await signedInAdmin("support");
  const merchantId = await createMerchant();

  const res = await issue(support, merchantId);

  assert.equal(res.statusCode, 403, res.body);
  const rows = await pool.query(`SELECT 1 FROM credit_requests WHERE merchant_id = $1`, [merchantId]);
  assert.equal(rows.rowCount, 0, "no credit may be created");
});

test("S12: a finance admin can still issue a merchant credit", async () => {
  const finance = await signedInAdmin("finance");
  const res = await issue(finance, await createMerchant());
  assert.equal(res.statusCode, 201, res.body);
});
