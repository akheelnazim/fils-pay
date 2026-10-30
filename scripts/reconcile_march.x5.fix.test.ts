/**
 * X5: the March residue sweep debited merchant_payable (charging merchants the
 * scheme rounding residue). ADR-0002: residue is credit card_scheme_clearing /
 * debit scheme_rounding_residue; merchants are paid in full.
 *
 * SAFETY: every test runs inside a transaction that is ROLLED BACK.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";
import { runSweep } from "./reconcile_march.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("reconcile_march.x5.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

const SWEEP_LIKE = "March 2026 scheme rounding residue%";

async function withSweep(body: (client: Client, merchantId: string) => Promise<void>): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE ledger_entries SET description = 'X5 test: hidden earlier sweep' WHERE description LIKE $1`,
      [SWEEP_LIKE],
    );
    const m = await client.query<{ id: string }>(`INSERT INTO merchants (display_name) VALUES ($1) RETURNING id`, [
      `X5 merchant ${randomUUID()}`,
    ]);
    const merchantId = m.rows[0]!.id;
    const ref = `X5-${randomUUID()}`;
    await client.query(
      `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, reference, acquirer_reference, occurred_at)
       VALUES ($1, 'captured', 4759, 4759, $2, $2, '2026-03-05T10:00:00Z')`,
      [merchantId, ref],
    );
    await runSweep(client, { dryRun: false });
    await body(client, merchantId);
  } finally {
    try {
      await client.query("ROLLBACK");
    } finally {
      await client.end();
    }
  }
}

async function legs(client: Client, merchantId: string): Promise<string[]> {
  const r = await client.query<{ leg: string }>(
    `SELECT account_id || ':' || direction || ':' || amount_fils AS leg FROM ledger_entries
      WHERE merchant_id = $1 AND description LIKE $2 ORDER BY account_id, direction`,
    [merchantId, SWEEP_LIKE],
  );
  return r.rows.map((x) => x.leg);
}

test("X5: the sweep never touches merchant_payable", async () => {
  await withSweep(async (client, merchantId) => {
    const r = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ledger_entries
        WHERE merchant_id = $1 AND account_id = 'merchant_payable' AND description LIKE $2`,
      [merchantId, SWEEP_LIKE],
    );
    assert.equal(Number(r.rows[0]!.n), 0);
  });
});

test("X5: residue is credit card_scheme_clearing / debit scheme_rounding_residue (ADR-0002)", async () => {
  await withSweep(async (client, merchantId) => {
    assert.deepEqual(await legs(client, merchantId), [
      "card_scheme_clearing:credit:9",
      "scheme_rounding_residue:debit:9",
    ]);
  });
});
