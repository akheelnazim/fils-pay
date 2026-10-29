/**
 * S2: logging in to merchant B must create the session for merchant B's
 * user, even when the same email also exists under merchant A.
 * Requires DATABASE_URL to point at a migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { hashPassword } from "../auth/passwords.js";
import { sha256Hex } from "../lib/crypto.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("auth.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
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

async function createMerchantWithUser(email: string, passwordHash: string): Promise<{ merchantId: string; userId: string }> {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, status) VALUES ($1, 250, 'active') RETURNING id`,
    [`S2 fix ${randomUUID().slice(0, 8)}`],
  );
  const user = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, password_hash, role)
     VALUES ($1, $2, $3, 'owner') RETURNING id`,
    [merchant.rows[0]!.id, email, passwordHash],
  );
  return { merchantId: merchant.rows[0]!.id, userId: user.rows[0]!.id };
}

test("S2: login to merchant B issues the session to merchant B's user, not another merchant's", async () => {
  const email = `shared-${randomUUID()}@auth.fix.test`;
  const password = "S2-fix-password!";
  const passwordHash = await hashPassword(password, config);
  await createMerchantWithUser(email, passwordHash); // merchant A, same email, created first
  const b = await createMerchantWithUser(email, passwordHash);

  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { merchantId: b.merchantId, email, password },
  });
  assert.equal(res.statusCode, 200);

  const cookie = res.cookies.find((c) => c.name === config.cookieName);
  assert.ok(cookie, "login should set the session cookie");
  const session = await pool.query<{ merchant_user_id: string }>(
    `SELECT merchant_user_id FROM sessions WHERE token_hash = $1`,
    [sha256Hex(cookie.value)],
  );
  assert.equal(session.rows[0]?.merchant_user_id, b.userId);
});
