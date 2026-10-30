/**
 * X6: one malformed outbox event (e.g. a payload with no merchantId) made
 * every pass throw and roll back, so the watermark never moved again and
 * reporting stopped for good. A data error in one event must set that event
 * aside (dead letter) and let the rest of the batch apply; other errors (a
 * lost connection) must still roll the whole pass back for a retry.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { enqueueEvent } from "@filspay/events";
import { CONSUMER_NAME, isPoisonEventError, runConsumerPass } from "./runConsumerPass.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("runConsumerPass.x6.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const config = { consumerBatchLimit: 500 };
after(async () => {
  await pool.end();
});

async function createMerchant(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`X6 merchant ${randomUUID()}`],
  );
  return r.rows[0]!.id;
}

async function cursor(): Promise<bigint> {
  const r = await pool.query<{ v: string }>(
    `SELECT last_processed_id::text AS v FROM reporting_outbox_cursor WHERE consumer_name = $1`,
    [CONSUMER_NAME],
  );
  return r.rows[0] ? BigInt(r.rows[0].v) : 0n;
}

function captured(merchantId: string, amount: number) {
  return enqueueEvent(pool, {
    eventType: "transaction.captured",
    aggregateType: "transaction",
    aggregateId: randomUUID(),
    payload: { merchantId, amountCapturedFils: amount, feeFils: 0, newStatus: "captured", capturedTotalFils: amount },
  });
}

test("X6: a malformed event is set aside and the events around it still apply", async () => {
  const merchantId = await createMerchant();
  await captured(merchantId, 1_000);
  const bad = await enqueueEvent(pool, {
    eventType: "transaction.voided",
    aggregateType: "transaction",
    aggregateId: randomUUID(),
    payload: {}, // no merchantId
  });
  const last = await captured(merchantId, 2_000);

  await runConsumerPass(pool, config);

  const vol = await pool.query<{ captured_count: number; captured_gross_fils: string }>(
    `SELECT captured_count, captured_gross_fils::text AS captured_gross_fils
       FROM merchant_daily_volume WHERE merchant_id = $1`,
    [merchantId],
  );
  assert.equal(vol.rows.length, 1);
  assert.equal(vol.rows[0]!.captured_count, 2);
  assert.equal(vol.rows[0]!.captured_gross_fils, "3000");
  assert.ok((await cursor()) >= BigInt(last.id), "watermark moved past the malformed event");

  const dead = await pool.query<{ event_type: string; error: string }>(
    `SELECT event_type, error FROM reporting_dead_letter_events WHERE consumer_name = $1 AND outbox_event_id = $2`,
    [CONSUMER_NAME, bad.id],
  );
  assert.equal(dead.rows.length, 1, "the malformed event is recorded for someone to look at");
  assert.equal(dead.rows[0]!.event_type, "transaction.voided");
  assert.ok(dead.rows[0]!.error.length > 0);
});

test("X6: the next pass does not retry or re-record a set-aside event", async () => {
  const merchantId = await createMerchant();
  const bad = await enqueueEvent(pool, {
    eventType: "transaction.voided",
    aggregateType: "transaction",
    aggregateId: randomUUID(),
    payload: {},
  });
  await captured(merchantId, 500);

  await runConsumerPass(pool, config);
  await runConsumerPass(pool, config);

  const dead = await pool.query(`SELECT 1 FROM reporting_dead_letter_events WHERE outbox_event_id = $1`, [bad.id]);
  assert.equal(dead.rows.length, 1);
});

test("X6: only data errors set an event aside; others roll the pass back", () => {
  const pg = (code: string) => Object.assign(new Error(code), { code });
  assert.equal(isPoisonEventError(pg("23502")), true, "not_null_violation");
  assert.equal(isPoisonEventError(pg("22P02")), true, "invalid_text_representation");
  assert.equal(isPoisonEventError(pg("23503")), true, "foreign_key_violation");
  assert.equal(isPoisonEventError(new TypeError("x")), true, "bad payload shape");
  assert.equal(isPoisonEventError(new RangeError("x")), true, "bad payload value");
  assert.equal(isPoisonEventError(pg("40001")), false, "serialization failure: retry");
  assert.equal(isPoisonEventError(pg("08006")), false, "connection failure: retry");
  assert.equal(isPoisonEventError(pg("42P01")), false, "missing table: deploy problem, retry");
  assert.equal(isPoisonEventError(new Error("boom")), false);
});
