/**
 * M7: the fee shown for a merchant must be the fee being charged now: the
 * newest schedule whose effective_from has arrived (same rule as
 * fees/feeSchedule.ts), not the row typed in most recently. Requires
 * DATABASE_URL.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { getCurrentFeeScheduleForDisplay } from "./currentFeeScheduleDisplay.js";
import { getEffectiveMdrBps } from "./feeSchedule.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("currentFeeScheduleDisplay.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 3 });

test.after(async () => {
  await pool.end();
});

async function merchant(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`M7 fix ${randomUUID().slice(0, 8)}`],
  );
  return r.rows[0]!.id;
}

async function schedule(merchantId: string, mdrBps: number, effectiveFrom: Date, createdAt: Date): Promise<void> {
  await pool.query(
    `INSERT INTO fee_schedules (merchant_id, mdr_bps, effective_from, created_at) VALUES ($1, $2, $3, $4)`,
    [merchantId, mdrBps, effectiveFrom, createdAt],
  );
}

/** The rate billing would charge right now (fees/feeSchedule.ts). */
async function billedRate(merchantId: string): Promise<number> {
  const client = await pool.connect();
  try {
    return await getEffectiveMdrBps(client, merchantId, new Date(), 250);
  } finally {
    client.release();
  }
}

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

test("M7: a backdated correction keyed in later does not replace the rate in force (245 vs 225)", async () => {
  const id = await merchant();
  await schedule(id, 225, days(-90), days(-90)); // renegotiation, in force now
  await schedule(id, 245, days(-240), days(-75)); // correction for an older period, entered later

  const shown = await getCurrentFeeScheduleForDisplay(pool, id);
  assert.equal(shown?.mdrBps, 225);
  assert.equal(shown?.mdrBps, await billedRate(id), "display must match billing");
});

test("M7 edge: a future-dated rate is not shown before it starts", async () => {
  const id = await merchant();
  await schedule(id, 200, days(-30), days(-30));
  await schedule(id, 150, days(10), days(-1));

  assert.equal((await getCurrentFeeScheduleForDisplay(pool, id))?.mdrBps, 200);
});

test("M7 edge: two rates starting the same day: the one entered last wins, as in billing", async () => {
  const id = await merchant();
  await schedule(id, 210, days(-20), days(-20));
  await schedule(id, 205, days(-20), days(-5));

  const shown = await getCurrentFeeScheduleForDisplay(pool, id);
  assert.equal(shown?.mdrBps, 205);
  assert.equal(shown?.mdrBps, await billedRate(id));
});

test("M7 edge: only a future rate on file shows no schedule yet", async () => {
  const id = await merchant();
  await schedule(id, 150, days(10), days(-1));
  assert.equal(await getCurrentFeeScheduleForDisplay(pool, id), null);
});
