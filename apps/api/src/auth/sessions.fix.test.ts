/**
 * S1: a session that passed the password step but not the OTP step must
 * not count as signed in. Requires DATABASE_URL to point at a migrated
 * Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { lookupSession } from "./sessions.js";
import { randomToken, sha256Hex } from "../lib/crypto.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("sessions.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 2 });

test.after(async () => {
  await pool.end();
});

async function insertSession(authenticated: boolean): Promise<string> {
  const suffix = randomUUID();
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`S1 fix ${suffix.slice(0, 8)}`],
  );
  const user = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, password_hash, role)
     VALUES ($1, $2, 'unused', 'owner') RETURNING id`,
    [merchant.rows[0]!.id, `s1-${suffix}@sessions.fix.test`],
  );
  const rawToken = randomToken(32);
  await pool.query(
    `INSERT INTO sessions (merchant_user_id, token_hash, authenticated, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 hour')`,
    [user.rows[0]!.id, sha256Hex(rawToken), authenticated],
  );
  return rawToken;
}

test("S1: a pending session (password ok, OTP not verified) is not signed in", async () => {
  const rawToken = await insertSession(false);
  assert.equal(await lookupSession(pool, rawToken), null);
});

test("S1: a session promoted after OTP is still signed in", async () => {
  const rawToken = await insertSession(true);
  assert.notEqual(await lookupSession(pool, rawToken), null);
});
