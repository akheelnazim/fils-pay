/**
 * X4: credits above 50.000 BD need a second approver, but (a) only the base
 * amount was compared, not base + the MDR reversal the merchant also receives,
 * and (b) each request was judged alone, so 2 x 30.000 BD to one merchant went
 * through with one operator.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { approveCreditRequest, createCreditRequest } from "./credits.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("credits.x4.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 8 });
after(async () => {
  await pool.end();
});

async function createMerchant(mdrBps = 250): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, $2) RETURNING id`,
    [`X4 merchant ${randomUUID()}`, mdrBps],
  );
  return r.rows[0]!.id;
}

async function createAdmin(): Promise<string> {
  const s = randomUUID();
  const r = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role)
     VALUES ($1, 'unused', $2, 'finance') RETURNING id`,
    [`x4-${s}@admin.test`, `X4 ${s.slice(0, 8)}`],
  );
  return r.rows[0]!.id;
}

const today = () => new Date().toISOString().slice(0, 10);

function credit(merchantId: string, adminUserId: string, baseAmountFils: number, reverseFee = false) {
  return createCreditRequest(pool, {
    merchantId,
    adminUserId,
    body: { baseAmountFils, reasonCode: "goodwill", effectiveDate: today(), reverseFee },
  });
}

test("X4: base under the limit but base + fee reversal over it needs a second approver", async () => {
  const merchantId = await createMerchant(250);
  // 49.000 BD + 2.5% reversal 1.225 BD = 50.225 BD credited.
  const r = await credit(merchantId, await createAdmin(), 49_000, true);
  assert.equal(r.status, "pending_approval");
});

test("X4: exactly 50.000 BD in total still needs one operator", async () => {
  const merchantId = await createMerchant(0);
  const r = await credit(merchantId, await createAdmin(), 50_000, true);
  assert.equal(r.status, "posted");
});

test("X4: two credits to one merchant that together pass the limit: the second waits", async () => {
  const merchantId = await createMerchant();
  const admin = await createAdmin();
  const first = await credit(merchantId, admin, 30_000);
  const second = await credit(merchantId, admin, 30_000);
  assert.equal(first.status, "posted");
  assert.equal(second.status, "pending_approval");
});

test("X4: a split across two operators is caught too", async () => {
  const merchantId = await createMerchant();
  await credit(merchantId, await createAdmin(), 30_000);
  const second = await credit(merchantId, await createAdmin(), 30_000);
  assert.equal(second.status, "pending_approval");
});

test("X4: other merchants' credits don't count", async () => {
  const admin = await createAdmin();
  await credit(await createMerchant(), admin, 40_000);
  const r = await credit(await createMerchant(), admin, 40_000);
  assert.equal(r.status, "posted");
});

test("X4: a credit that had its second approval doesn't count against the next one", async () => {
  const merchantId = await createMerchant();
  const big = await credit(merchantId, await createAdmin(), 60_000);
  assert.equal(big.status, "pending_approval");
  await approveCreditRequest(pool, { creditRequestId: big.id, approver: { adminUserId: await createAdmin(), displayName: "X4 approver" } });
  const next = await credit(merchantId, await createAdmin(), 10_000);
  assert.equal(next.status, "posted");
});

test("X4: credits older than 24 hours don't count", async () => {
  const merchantId = await createMerchant();
  const admin = await createAdmin();
  const old = await credit(merchantId, admin, 40_000);
  await pool.query(`UPDATE credit_requests SET created_at = now() - interval '25 hours' WHERE id = $1`, [old.id]);
  const r = await credit(merchantId, admin, 40_000);
  assert.equal(r.status, "posted");
});

test("X4: two concurrent 30.000 BD credits: exactly one posts without approval", async () => {
  const merchantId = await createMerchant();
  const [a, b] = await Promise.all([
    credit(merchantId, await createAdmin(), 30_000),
    credit(merchantId, await createAdmin(), 30_000),
  ]);
  assert.deepEqual([a.status, b.status].sort(), ["pending_approval", "posted"]);
});
