/**
 * X1: expire_holds must flip expired 'active' holds to 'expired' with one UPDATE.
 * It must never delete a holds row. Before the fix it SELECTed the expired ids and
 * ran buildDelete("holds", { id: ids }); with an empty list the filter was dropped
 * and the DELETE had no WHERE, which removed every hold.
 *
 * SAFETY: the test DB is shared. Every test runs inside a transaction that is
 * ROLLED BACK. Nothing is ever committed.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";
import { expireHolds } from "./expire_holds.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("expire_holds.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

type HoldStatus = "active" | "released" | "expired";

async function inRolledBackTx(body: (client: Client, merchantId: string) => Promise<void>): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    const merchant = await client.query<{ id: string }>(
      `INSERT INTO merchants (display_name) VALUES ($1) RETURNING id`,
      [`X1 test merchant ${randomUUID()}`],
    );
    await body(client, merchant.rows[0]!.id);
  } finally {
    try {
      await client.query("ROLLBACK");
    } finally {
      await client.end();
    }
  }
}

/** Inserts a hold (with its own transaction for the FK) that expires `offset` from now, e.g. '-1 hour'. */
async function insertHold(
  client: Client,
  merchantId: string,
  status: HoldStatus,
  offset: string,
): Promise<string> {
  const ref = `X1-${randomUUID()}`;
  const tx = await client.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, reference, acquirer_reference)
     VALUES ($1, 'authorized', 1000, $2, $2) RETURNING id`,
    [merchantId, ref],
  );
  const hold = await client.query<{ id: string }>(
    `INSERT INTO holds (merchant_id, transaction_id, amount_fils, status, expires_at)
     VALUES ($1, $2, 1000, $3, now() + $4::interval) RETURNING id`,
    [merchantId, tx.rows[0]!.id, status, offset],
  );
  return hold.rows[0]!.id;
}

async function holdStatus(client: Client, id: string): Promise<string | undefined> {
  const r = await client.query<{ status: string }>(`SELECT status FROM holds WHERE id = $1`, [id]);
  return r.rows[0]?.status;
}

async function holdCount(client: Client): Promise<number> {
  const r = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM holds`);
  return Number(r.rows[0]!.count);
}

test("X1: a quiet night deletes nothing", async () => {
  await inRolledBackTx(async (client, merchantId) => {
    // Neutralise any pre-existing expired active holds in the shared DB (rolled back at the end).
    await client.query(
      `UPDATE holds SET expires_at = now() + interval '1 day' WHERE status = 'active' AND expires_at < now()`,
    );
    const holdId = await insertHold(client, merchantId, "active", "1 day");

    const before = await holdCount(client);
    const changed = await expireHolds(client);
    const after = await holdCount(client);

    assert.equal(after, before, "hold count changed on a quiet night");
    assert.equal(await holdStatus(client, holdId), "active");
    assert.equal(changed, 0);
  });
});

test("X1: an expired active hold is marked expired, not deleted", async () => {
  await inRolledBackTx(async (client, merchantId) => {
    const holdId = await insertHold(client, merchantId, "active", "-1 hour");

    await expireHolds(client);

    assert.equal(await holdStatus(client, holdId), "expired");
  });
});

test("X1: released, already-expired and future holds are untouched", async () => {
  await inRolledBackTx(async (client, merchantId) => {
    // Quiet night apart from these rows, so the empty-list path runs (rolled back at the end).
    await client.query(
      `UPDATE holds SET expires_at = now() + interval '1 day' WHERE status = 'active' AND expires_at < now()`,
    );
    const releasedId = await insertHold(client, merchantId, "released", "-1 hour");
    const expiredId = await insertHold(client, merchantId, "expired", "-1 hour");
    const futureId = await insertHold(client, merchantId, "active", "1 day");

    await expireHolds(client);

    assert.equal(await holdStatus(client, releasedId), "released");
    assert.equal(await holdStatus(client, expiredId), "expired");
    assert.equal(await holdStatus(client, futureId), "active");
  });
});

test("X1: the hold count never drops", async () => {
  await inRolledBackTx(async (client, merchantId) => {
    await insertHold(client, merchantId, "active", "-1 hour");
    await insertHold(client, merchantId, "active", "-2 hours");
    await insertHold(client, merchantId, "active", "1 day");

    const before = await holdCount(client);
    const changed = await expireHolds(client);
    const after = await holdCount(client);

    assert.equal(after, before, "holds were deleted");
    assert.ok(changed >= 2, `expected at least 2 holds expired, got ${changed}`);
  });
});
