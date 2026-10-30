/**
 * T2: POST /v1/admin/merchants/:id/transactions/recompute-statuses must never
 * change merchants.test_mode. Before the fix, reconcileSandboxFlag cleared the
 * flag for a test-mode merchant whenever the recompute scanned at least one
 * transaction and found no open authorizations, so settlement then paid out a
 * sandbox merchant as if it were live.
 *
 * Requires DATABASE_URL to point at a migrated Postgres (the DB is shared, so
 * every fixture uses a fresh merchant and unique labels).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { hashPassword } from "../adminAuth/passwords.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "adminMerchantsRecompute.fix.test.ts requires DATABASE_URL to point at a migrated Postgres",
  );
}

const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  OTP_DEV_EXPOSE: "true",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
});

const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);

test.after(async () => {
  await app.close();
  await pool.end();
});

const ADMIN_PASSWORD = "T2-recompute-password-9000!";
let cachedPasswordHash: string | null = null;

function parseCookie(setCookieHeader: string | string[] | undefined, name: string): string {
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const header of headers) {
    if (header && header.startsWith(`${name}=`)) {
      return header.split(";")[0] as string;
    }
  }
  throw new Error(`expected a Set-Cookie header for ${name}`);
}

/** Creates a finance admin and logs in through password + OTP, returning the authenticated cookie. */
async function signedInFinanceAdmin(label: string): Promise<string> {
  cachedPasswordHash ??= await hashPassword(ADMIN_PASSWORD, config);
  const email = `t2-${label}-${randomUUID()}@admin.test`;
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, $2, $3, 'finance')`,
    [email, cachedPasswordHash, `T2 ${label}`],
  );

  const loginRes = await app.inject({
    method: "POST",
    url: "/v1/admin/auth/login",
    payload: { email, password: ADMIN_PASSWORD },
  });
  assert.equal(loginRes.statusCode, 200, loginRes.body);
  const loginBody = loginRes.json() as { otpRequired: boolean; devOtpCode?: string };
  assert.ok(loginBody.devOtpCode, "OTP_DEV_EXPOSE must surface the dev OTP code");
  const cookie = parseCookie(loginRes.headers["set-cookie"], config.adminCookieName);

  const verifyRes = await app.inject({
    method: "POST",
    url: "/v1/admin/auth/otp/verify",
    headers: { cookie },
    payload: { code: loginBody.devOtpCode },
  });
  assert.equal(verifyRes.statusCode, 200, verifyRes.body);
  return cookie;
}

/** Inserts a merchant with the given test_mode value and returns its id. */
async function createMerchant(label: string, testMode: boolean): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, test_mode) VALUES ($1, $2, $3) RETURNING id`,
    [`T2 ${label} ${randomUUID()}`, 250, testMode],
  );
  return result.rows[0]!.id;
}

async function insertTransaction(merchantId: string, status: "captured" | "authorized"): Promise<void> {
  // Captured rows have captured_fils = amount_fils, so the recompute keeps them as-is.
  await pool.query(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference)
     VALUES ($1, $2, 1000, $3, $4)`,
    [merchantId, status, status === "captured" ? 1000 : 0, `t2-acq-ref-${randomUUID()}`],
  );
}

async function testModeOf(merchantId: string): Promise<boolean> {
  const result = await pool.query<{ test_mode: boolean }>(
    `SELECT test_mode FROM merchants WHERE id = $1`,
    [merchantId],
  );
  return result.rows[0]!.test_mode;
}

function recomputeUrl(merchantId: string): string {
  return `/v1/admin/merchants/${merchantId}/transactions/recompute-statuses`;
}

test("T2: recompute-statuses leaves a test-mode merchant in test mode", async () => {
  const cookie = await signedInFinanceAdmin("testmode");
  const merchantId = await createMerchant("testmode", true);
  await insertTransaction(merchantId, "captured");

  const res = await app.inject({ method: "POST", url: recomputeUrl(merchantId), headers: { cookie } });
  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(res.json().flagsUpdated, []);
  assert.equal(await testModeOf(merchantId), true, "recompute must never clear test_mode");
});

test("T2: recompute-statuses leaves a live merchant live", async () => {
  const cookie = await signedInFinanceAdmin("live");
  const merchantId = await createMerchant("live", false);
  await insertTransaction(merchantId, "captured");

  const res = await app.inject({ method: "POST", url: recomputeUrl(merchantId), headers: { cookie } });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(await testModeOf(merchantId), false);
});

test("T2: recompute-statuses with open authorizations keeps test mode", async () => {
  const cookie = await signedInFinanceAdmin("open");
  const merchantId = await createMerchant("open", true);
  await insertTransaction(merchantId, "authorized");

  const res = await app.inject({ method: "POST", url: recomputeUrl(merchantId), headers: { cookie } });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(await testModeOf(merchantId), true, "an open authorization must keep test_mode");
});
