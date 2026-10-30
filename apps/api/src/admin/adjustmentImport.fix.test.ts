/**
 * R5: the same adjustment CSV could be applied twice, posting every row again.
 * Nothing (no unique filename, no content hash) stopped a re-upload.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { AppError } from "../lib/errors.js";
import { applyAdjustmentImport } from "./adjustmentImport.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("adjustmentImport.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 5 });
after(async () => {
  await pool.end();
});

async function createAdminUser(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role)
     VALUES ($1, 'not-a-real-hash', 'R5 test', 'finance') RETURNING id`,
    [`r5-${randomUUID()}@admin.test`],
  );
  return r.rows[0]!.id;
}

async function createMerchant(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, status, test_mode) VALUES ($1, 250, 'active', false) RETURNING id`,
    [`R5 merchant ${randomUUID()}`],
  );
  return r.rows[0]!.id;
}

async function cached(merchantId: string): Promise<number> {
  const r = await pool.query<{ v: string }>(
    `SELECT COALESCE((SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1), 0)::text AS v`,
    [merchantId],
  );
  return Number(r.rows[0]!.v);
}

async function importCount(merchantId: string): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM adjustment_import_rows WHERE merchant_id = $1`,
    [merchantId],
  );
  return Number(r.rows[0]!.n);
}

function isDuplicate(err: unknown): boolean {
  return err instanceof AppError && err.statusCode === 409 && err.code === "duplicate_import";
}

test("R5: re-applying the same rows is refused and posts nothing", async () => {
  const adminUserId = await createAdminUser();
  const merchantId = await createMerchant();
  const rows = [
    { merchantId, amount: "4.750", reason: "statement correction" },
    { merchantId, amount: "-1.250" },
  ];

  await applyAdjustmentImport(pool, { adminUserId, originalFilename: "a.csv", rows });
  const after1 = await cached(merchantId);

  await assert.rejects(applyAdjustmentImport(pool, { adminUserId, originalFilename: "a.csv", rows }), isDuplicate);

  assert.equal(await cached(merchantId), after1, "second import moved the balance");
  assert.equal(await importCount(merchantId), 2);
});

test("R5: renaming the file does not get the same content through", async () => {
  const adminUserId = await createAdminUser();
  const merchantId = await createMerchant();
  const rows = [{ merchantId, amount: "2.000", reason: "fee refund" }];

  await applyAdjustmentImport(pool, { adminUserId, originalFilename: "jan.csv", rows });
  await assert.rejects(
    applyAdjustmentImport(pool, { adminUserId, originalFilename: "jan (1).csv", rows }),
    isDuplicate,
  );
});

test("R5: a different amount, reason or row order is a different import", async () => {
  const adminUserId = await createAdminUser();
  const merchantId = await createMerchant();
  const base = { merchantId, amount: "1.000", reason: "x" };

  await applyAdjustmentImport(pool, { adminUserId, originalFilename: "b.csv", rows: [base] });
  await applyAdjustmentImport(pool, { adminUserId, originalFilename: "b.csv", rows: [{ ...base, amount: "1.001" }] });
  await applyAdjustmentImport(pool, { adminUserId, originalFilename: "b.csv", rows: [{ ...base, reason: "y" }] });
  await applyAdjustmentImport(pool, {
    adminUserId,
    originalFilename: "b.csv",
    rows: [base, { ...base, amount: "2.000" }],
  });
  await applyAdjustmentImport(pool, {
    adminUserId,
    originalFilename: "b.csv",
    rows: [{ ...base, amount: "2.000" }, base],
  });

  assert.equal(await importCount(merchantId), 7);
});

test("R5: a reason that contains the separator cannot fake another file's hash", async () => {
  const adminUserId = await createAdminUser();
  const merchantId = await createMerchant();

  await applyAdjustmentImport(pool, {
    adminUserId,
    originalFilename: "c.csv",
    rows: [{ merchantId, amount: "1.000", reason: "a" }, { merchantId, amount: "1.000" }],
  });
  // Same text if rows were naively joined with commas/newlines.
  await applyAdjustmentImport(pool, {
    adminUserId,
    originalFilename: "c.csv",
    rows: [{ merchantId, amount: "1.000", reason: `a\n${merchantId},1.000,` }],
  });

  assert.equal(await importCount(merchantId), 3);
});
