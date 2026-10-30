/**
 * X2: the March 2026 residue sweep must post once. A second run (or the
 * "dry run" finance did on 3 July) must write nothing, and --dry-run must
 * really be dry.
 *
 * SAFETY: the test DB is shared. Every test runs runSweep inside a transaction
 * that is ROLLED BACK. Nothing is ever committed.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";
import { runSweep } from "./reconcile_march.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("reconcile_march.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

const SWEEP_LIKE = "March 2026 scheme rounding residue%";

async function inRolledBackTx(body: (client: Client, merchantId: string) => Promise<void>): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    // A DB where the real sweep was committed would make every run refuse;
    // hide those rows for this transaction only (rolled back at the end).
    await client.query(
      `UPDATE ledger_entries SET description = 'X2 test: hidden earlier sweep' WHERE description LIKE $1`,
      [SWEEP_LIKE],
    );
    const merchant = await client.query<{ id: string }>(
      `INSERT INTO merchants (display_name) VALUES ($1) RETURNING id`,
      [`X2 test merchant ${randomUUID()}`],
    );
    const merchantId = merchant.rows[0]!.id;
    // 4759 -> 9 fils residue, 1233 -> 3, 5000 -> 0: 12 fils over 2 lines.
    for (const [captured, at] of [
      [4759, "2026-03-05T10:00:00Z"],
      [1233, "2026-03-20T22:30:00Z"],
      [5000, "2026-03-11T08:00:00Z"],
    ] as const) {
      const ref = `X2-${randomUUID()}`;
      await client.query(
        `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, reference, acquirer_reference, occurred_at)
         VALUES ($1, 'captured', $2, $2, $3, $3, $4)`,
        [merchantId, captured, ref, at],
      );
    }
    await body(client, merchantId);
  } finally {
    try {
      await client.query("ROLLBACK");
    } finally {
      await client.end();
    }
  }
}

/** Residue the sweep booked for this merchant (scheme_rounding_residue debit, ADR-0002), in fils. */
async function sweptFor(client: Client, merchantId: string): Promise<number> {
  const r = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount_fils), 0)::text AS total FROM ledger_entries
      WHERE merchant_id = $1 AND account_id = 'scheme_rounding_residue' AND direction = 'debit'
        AND description LIKE $2`,
    [merchantId, SWEEP_LIKE],
  );
  return Number(r.rows[0]!.total);
}

async function sweepLegCount(client: Client): Promise<number> {
  const r = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ledger_entries WHERE description LIKE $1`,
    [SWEEP_LIKE],
  );
  return Number(r.rows[0]!.count);
}

test("X2: the first run posts each merchant's residue once", async () => {
  await inRolledBackTx(async (client, merchantId) => {
    const result = await runSweep(client, { dryRun: false });

    assert.equal(result.posted, true);
    assert.equal(await sweptFor(client, merchantId), 12);
    const mine = result.merchants.find((m) => m.merchantId === merchantId);
    assert.deepEqual(mine && { lineCount: mine.lineCount, residueFils: mine.residueFils }, { lineCount: 2, residueFils: 12 });
  });
});

test("X2: a second run posts nothing and says it already ran", async () => {
  await inRolledBackTx(async (client, merchantId) => {
    await runSweep(client, { dryRun: false });
    const legsAfterFirst = await sweepLegCount(client);

    const second = await runSweep(client, { dryRun: false });

    assert.equal(second.posted, false);
    assert.equal(second.skipped, "already_posted");
    assert.equal(await sweepLegCount(client), legsAfterFirst, "second run wrote ledger entries");
    assert.equal(await sweptFor(client, merchantId), 12, "residue posted twice");
  });
});

test("X2: --dry-run reports the residue and writes nothing", async () => {
  await inRolledBackTx(async (client, merchantId) => {
    const before = await sweepLegCount(client);

    const result = await runSweep(client, { dryRun: true });

    assert.equal(result.posted, false);
    assert.equal(result.skipped, "dry_run");
    assert.equal(await sweepLegCount(client), before, "dry run wrote ledger entries");
    assert.equal(await sweptFor(client, merchantId), 0);
    assert.equal(result.merchants.find((m) => m.merchantId === merchantId)?.residueFils, 12);
  });
});

test("X2: a dry run after the real run still writes nothing", async () => {
  await inRolledBackTx(async (client, merchantId) => {
    await runSweep(client, { dryRun: false });
    const legs = await sweepLegCount(client);

    const dry = await runSweep(client, { dryRun: true });

    assert.equal(dry.posted, false);
    assert.equal(await sweepLegCount(client), legs);
    assert.equal(await sweptFor(client, merchantId), 12);
  });
});

test("X2: a merchant with no March residue gets no entries", async () => {
  await inRolledBackTx(async (client) => {
    const other = await client.query<{ id: string }>(
      `INSERT INTO merchants (display_name) VALUES ($1) RETURNING id`,
      [`X2 round merchant ${randomUUID()}`],
    );
    const ref = `X2-${randomUUID()}`;
    await client.query(
      `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, reference, acquirer_reference, occurred_at)
       VALUES ($1, 'captured', 7000, 7000, $2, $2, '2026-03-15T12:00:00Z')`,
      [other.rows[0]!.id, ref],
    );

    await runSweep(client, { dryRun: false });

    assert.equal(await sweptFor(client, other.rows[0]!.id), 0);
  });
});
