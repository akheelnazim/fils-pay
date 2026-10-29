/**
 * S9: one-time codes must come from a secure random source, and the
 * attempt limit must hold even when guesses arrive in parallel. Requires
 * DATABASE_URL to point at a migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { hashPassword } from "./passwords.js";
import { generateOtpCode } from "./otp.js";
import { randomFromAlphabet } from "../lib/random.js";
import { sha256Hex } from "../lib/crypto.js";
import { generateInviteCode } from "../admin/inviteCode.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("otp.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
}

const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  OTP_DEV_EXPOSE: "true",
  PG_POOL_MAX: "25",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
});
const pool = new Pool({ connectionString: databaseUrl, max: 25 });
const app = buildApp(config, pool);
const PASSWORD = "S9-fix-password!";
const PARALLEL_GUESSES = 20;

test.after(async () => {
  await app.close();
  await pool.end();
});

test("S9: codes and tokens do not come from Math.random", () => {
  const original = Math.random;
  Math.random = () => 0;
  try {
    const codes = new Set(Array.from({ length: 20 }, () => generateOtpCode(6)));
    const tokens = new Set(Array.from({ length: 20 }, () => randomFromAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ", 8)));
    assert.ok(codes.size > 1, "OTP codes must not depend on Math.random");
    assert.ok(tokens.size > 1, "random strings (payment link tokens) must not depend on Math.random");
  } finally {
    Math.random = original;
  }
});

/** A code guaranteed to differ from the real one. */
function wrongCode(real: string): string {
  return real.split("").map((d) => String((Number(d) + 1) % 10)).join("");
}

async function parallelWrongGuesses(url: string, cookie: string, realCode: string): Promise<number> {
  const responses = await Promise.all(
    Array.from({ length: PARALLEL_GUESSES }, () =>
      app.inject({ method: "POST", url, headers: { cookie }, payload: { code: wrongCode(realCode) } }),
    ),
  );
  return responses.filter((r) => r.statusCode === 401 && r.json().error === "invalid_code").length;
}

function cookieHeader(res: { cookies: Array<{ name: string; value: string }> }, name: string): string {
  const c = res.cookies.find((x) => x.name === name);
  assert.ok(c, `expected cookie ${name}`);
  return `${name}=${c.value}`;
}

test("S9: parallel wrong merchant OTP guesses are capped at max attempts", async () => {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, status) VALUES ($1, 250, 'active') RETURNING id`,
    [`S9 fix ${randomUUID().slice(0, 8)}`],
  );
  const email = `s9-${randomUUID()}@otp.fix.test`;
  await pool.query(
    `INSERT INTO merchant_users (merchant_id, email, password_hash, role) VALUES ($1, $2, $3, 'owner')`,
    [merchant.rows[0]!.id, email, await hashPassword(PASSWORD, config)],
  );
  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { merchantId: merchant.rows[0]!.id, email, password: PASSWORD },
  });
  assert.equal(login.statusCode, 200, login.body);

  const wrong = await parallelWrongGuesses(
    "/v1/auth/otp/verify",
    cookieHeader(login, config.cookieName),
    login.json().devOtpCode,
  );
  assert.ok(wrong <= config.otpMaxAttempts, `${wrong} guesses were checked; limit is ${config.otpMaxAttempts}`);
});

test("S9: admin invite codes do not come from Math.random", () => {
  const original = Math.random;
  Math.random = () => 0;
  try {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    assert.ok(codes.size > 1, "invite codes must not depend on Math.random");
  } finally {
    Math.random = original;
  }
});

test("S9: resending the code does not reset the guess budget", async () => {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, status) VALUES ($1, 250, 'active') RETURNING id`,
    [`S9 resend ${randomUUID().slice(0, 8)}`],
  );
  const email = `s9-resend-${randomUUID()}@otp.fix.test`;
  await pool.query(
    `INSERT INTO merchant_users (merchant_id, email, password_hash, role) VALUES ($1, $2, $3, 'owner')`,
    [merchant.rows[0]!.id, email, await hashPassword(PASSWORD, config)],
  );
  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { merchantId: merchant.rows[0]!.id, email, password: PASSWORD },
  });
  const cookie = cookieHeader(login, config.cookieName);
  const realCode = login.json().devOtpCode as string;

  // Use up all but one guess.
  for (let i = 0; i < config.otpMaxAttempts - 1; i++) {
    await app.inject({ method: "POST", url: "/v1/auth/otp/verify", headers: { cookie }, payload: { code: wrongCode(realCode) } });
  }
  // Get past the 30 s resend throttle, then resend.
  await pool.query(`UPDATE otp_challenges SET created_at = now() - interval '1 minute'
                     WHERE id = (SELECT otp_challenge_id FROM sessions WHERE token_hash = $1)`,
    [sha256Hex(cookie.split("=")[1]!)]);
  const resend = await app.inject({ method: "POST", url: "/v1/auth/otp/resend", headers: { cookie } });
  assert.equal(resend.statusCode, 200, resend.body);
  const newCode = resend.json().devOtpCode as string;

  const errors: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await app.inject({ method: "POST", url: "/v1/auth/otp/verify", headers: { cookie }, payload: { code: wrongCode(newCode) } });
    errors.push(r.json().error);
  }
  // Only guesses that were actually checked answer invalid_code.
  assert.equal(errors.filter((e) => e === "invalid_code").length, 1, `only one guess should remain, got ${errors}`);
});

test("S9: parallel wrong admin OTP guesses are capped at max attempts", async () => {
  const email = `s9-admin-${randomUUID()}@admin.test`;
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, $2, 'S9 Fix', 'support')`,
    [email, await hashPassword(PASSWORD, config)],
  );
  const login = await app.inject({ method: "POST", url: "/v1/admin/auth/login", payload: { email, password: PASSWORD } });
  assert.equal(login.statusCode, 200, login.body);

  const wrong = await parallelWrongGuesses(
    "/v1/admin/auth/otp/verify",
    cookieHeader(login, config.adminCookieName),
    login.json().devOtpCode,
  );
  assert.ok(wrong <= config.adminOtpMaxAttempts, `${wrong} guesses were checked; limit is ${config.adminOtpMaxAttempts}`);
});
