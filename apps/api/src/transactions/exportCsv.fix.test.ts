/**
 * X3: GET /v1/transactions/export built the whole CSV in memory (all history
 * when from/to are omitted), which can exhaust the 512 MB API. It must stream,
 * page by page, and the paging must never skip or repeat a row.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { recordKycReview } from "../onboarding/review.js";
import { buildTransactionsExportCsv, streamTransactionsExportCsv } from "./exportCsv.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("exportCsv.fix.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  INTERNAL_API_TOKEN: "test-internal-token",
  ACQUIRER_FAILURE_RATE: "0",
  ACQUIRER_LATENCY_MIN_MS: "0",
  ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
});
const app = buildApp(config, pool);

after(async () => {
  await app.close();
  await pool.end();
});

async function createMerchant(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`X3 export ${randomUUID()}`],
  );
  return r.rows[0]!.id;
}

/** Inserts `count` captured rows; occurred_at for row i (0-based) is the SQL expression given. */
async function insertRows(merchantId: string, count: number, occurredAtSql: string): Promise<void> {
  await pool.query(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, reference, acquirer_reference, occurred_at)
     SELECT $1, 'captured', 1000 + i, 1000 + i, 'x3-' || i, 'acq_x3_' || $2 || '_' || i, ${occurredAtSql}
       FROM generate_series(0, $3 - 1) AS i`,
    [merchantId, randomUUID(), count],
  );
}

async function collect(merchantId: string): Promise<string> {
  let body = "";
  for await (const chunk of streamTransactionsExportCsv(pool, { merchantId })) body += chunk;
  return body;
}

function ids(csv: string): string[] {
  return csv.split("\n").slice(1).map((line) => line.split(",")[0]!);
}

test("X3: rows sharing a timestamp across a page boundary are all exported once", async () => {
  const merchantId = await createMerchant();
  // 1002 rows at one instant: the old cursor (occurred_at > last) dropped the last 2.
  await insertRows(merchantId, 1002, `'2026-05-01T10:00:00Z'::timestamptz`);

  const streamed = await collect(merchantId);
  const got = ids(streamed);

  assert.equal(got.length, 1002, "row count");
  assert.equal(new Set(got).size, 1002, "a row was repeated");
});

test("X3: sub-millisecond timestamps at a page boundary are not repeated", async () => {
  const merchantId = await createMerchant();
  // Rows 0..998 one second apart, then rows 999 and 1000 within the same
  // millisecond: a JS Date cursor drops the microseconds and re-reads row 999.
  await insertRows(
    merchantId,
    1001,
    `CASE WHEN i < 999 THEN '2026-05-01T00:00:00Z'::timestamptz + i * interval '1 second'
          WHEN i = 999 THEN '2026-05-02T00:00:00.000500Z'::timestamptz
          ELSE '2026-05-02T00:00:00.000700Z'::timestamptz END`,
  );

  const got = ids(await collect(merchantId));

  assert.equal(got.length, 1001, "row count");
  assert.equal(new Set(got).size, 1001, "a row was repeated");
});

test("X3: the streamed body is identical to the in-memory export", async () => {
  const merchantId = await createMerchant();
  await insertRows(merchantId, 1500, `'2026-05-03T00:00:00Z'::timestamptz + (i / 7) * interval '1 minute'`);

  const streamed = await collect(merchantId);
  const built = await buildTransactionsExportCsv(pool, { merchantId });

  // Same lines; order within one instant may differ (now id order), so sort the data lines.
  const [streamedHeader, ...streamedLines] = streamed.split("\n");
  const [builtHeader, ...builtLines] = built.split("\n");
  assert.equal(streamedHeader, builtHeader, "header");
  assert.deepEqual(streamedLines.sort(), builtLines.sort());
  assert.ok(!streamed.endsWith("\n"), "trailing newline");
});

test("X3: an empty export is just the header", async () => {
  const merchantId = await createMerchant();
  assert.equal(await collect(merchantId), "id,status,amount_bhd,captured_bhd,reference,occurred_at");
});

test("X3: GET /v1/transactions/export streams instead of buffering the whole file", async () => {
  const merchantId = await createMerchant();
  const user = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash)
     VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `x3-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: user.rows[0]!.id, label: "x3" });
  await insertRows(merchantId, 1205, `'2026-05-04T00:00:00Z'::timestamptz + (i / 3) * interval '1 second'`);

  const res = await app.inject({
    method: "GET",
    url: "/v1/transactions/export",
    headers: { authorization: `Bearer ${rawKey}` },
  });

  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers["content-type"]), /^text\/csv/);
  assert.equal(res.headers["content-length"], undefined, "response was buffered (content-length set)");
  const got = ids(res.body);
  assert.equal(got.length, 1205);
  assert.equal(new Set(got).size, 1205);
});
