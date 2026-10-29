/**
 * S7: rotating a merchant's API key must stop the old key working.
 * Requires DATABASE_URL to point at a migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { rotateApiKeyAsAdmin } from "./apiKeys.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { verifyApiKey } from "../apiKeys/verify.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("apiKeys.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const config = { nodeEnv: "test" as const };

test.after(async () => {
  await pool.end();
});

test("S7: after rotation the old key no longer authenticates; the new one does", async () => {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`S7 fix ${randomUUID().slice(0, 8)}`],
  );
  const merchantId = merchant.rows[0]!.id;
  const user = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash)
     VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `s7-${randomUUID()}@apikeys.fix.test`],
  );
  const admin = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role)
     VALUES ($1, 'unused', 'S7 Fix', 'finance') RETURNING id`,
    [`s7-admin-${randomUUID()}@admin.test`],
  );

  const oldKey = await issueApiKey(pool, config, { merchantId, createdBy: user.rows[0]!.id, label: "s7" });
  assert.ok(await verifyApiKey(pool, oldKey.rawKey), "old key works before rotation");

  const rotated = await rotateApiKeyAsAdmin(pool, config, {
    merchantId,
    apiKeyId: oldKey.id,
    adminUserId: admin.rows[0]!.id,
  });

  assert.equal(await verifyApiKey(pool, oldKey.rawKey), null, "old key must stop working after rotation");
  assert.ok(await verifyApiKey(pool, rotated.rawKey), "new key works");
});
