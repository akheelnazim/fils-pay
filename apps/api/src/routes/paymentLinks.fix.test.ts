/**
 * S3: a merchant must not be able to cancel another merchant's payment
 * link. Requires DATABASE_URL to point at a migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { recordKycReview } from "../onboarding/review.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("paymentLinks.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
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

async function createMerchantWithApiKey(label: string): Promise<{ merchantId: string; rawKey: string }> {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`S3 fix ${label} ${randomUUID().slice(0, 8)}`],
  );
  const merchantId = merchant.rows[0]!.id;
  const user = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash)
     VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `s3-${randomUUID()}@paymentlinks.fix.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const issued = await issueApiKey(pool, config, { merchantId, createdBy: user.rows[0]!.id, label });
  return { merchantId, rawKey: issued.rawKey };
}

async function createLink(merchantId: string, rawKey: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: `/v1/merchants/${merchantId}/payment-links`,
    headers: { authorization: `Bearer ${rawKey}` },
    payload: { amountFils: 4_750, reference: "s3", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  });
  assert.equal(res.statusCode, 201, res.body);
  return (res.json() as { id: string }).id;
}

async function linkStatus(id: string): Promise<string | undefined> {
  const r = await pool.query<{ status: string }>(`SELECT status FROM payment_links WHERE id = $1`, [id]);
  return r.rows[0]?.status;
}

test("S3: merchant B cannot cancel merchant A's payment link", async () => {
  const a = await createMerchantWithApiKey("A");
  const b = await createMerchantWithApiKey("B");
  const linkA = await createLink(a.merchantId, a.rawKey);

  const res = await app.inject({
    method: "DELETE",
    url: `/v1/merchants/${b.merchantId}/payment-links/${linkA}`,
    headers: { authorization: `Bearer ${b.rawKey}` },
  });

  assert.equal(res.statusCode, 404, res.body);
  assert.equal(await linkStatus(linkA), "active");
});

test("S3: a merchant can still cancel its own payment link", async () => {
  const a = await createMerchantWithApiKey("own");
  const linkA = await createLink(a.merchantId, a.rawKey);

  const res = await app.inject({
    method: "DELETE",
    url: `/v1/merchants/${a.merchantId}/payment-links/${linkA}`,
    headers: { authorization: `Bearer ${a.rawKey}` },
  });

  assert.equal(res.statusCode, 204, res.body);
  assert.equal(await linkStatus(linkA), "canceled");
});
