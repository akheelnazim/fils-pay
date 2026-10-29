/**
 * S5 (FP-240, outbound): a merchant verifies a webhook by computing
 * HMAC-SHA256(secret, `${t}.${rawBody}`) over the exact bytes received.
 * Both the dispatcher and "send test event" must sign those same bytes.
 * Requires DATABASE_URL to point at a migrated Postgres.
 */
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { enqueueEvent } from "@filspay/events";
import { loadConfig } from "../config.js";
import { createWebhookEndpoint } from "./create.js";
import { runDispatchPass } from "./dispatcher.js";
import { sendTestWebhookEvent } from "./testSend.js";
import { WEBHOOK_SIGNATURE_HEADER } from "./headers.js";
import type { WebhookTransport, WebhookTransportRequest } from "./transport.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("sign.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
}

const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
  WEBHOOK_REQUEST_TIMEOUT_MS: "5000",
});
const pool = new Pool({ connectionString: databaseUrl, max: 3 });

test.after(async () => {
  await pool.end();
});

/** What a merchant's receiver does: HMAC over the raw bytes it was sent. */
function merchantVerifies(req: WebhookTransportRequest, secret: string): boolean {
  const header = req.headers[WEBHOOK_SIGNATURE_HEADER]!;
  const t = /t=(\d+)/.exec(header)![1];
  const v1 = /v1=([0-9a-f]+)/.exec(header)![1];
  const expected = createHmac("sha256", secret).update(`${t}.${req.body}`).digest("hex");
  return expected === v1;
}

async function merchantWithEndpoint(url: string) {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`S5 fix ${randomUUID().slice(0, 8)}`],
  );
  const merchantId = merchant.rows[0]!.id;
  const endpoint = await createWebhookEndpoint(pool, config, {
    merchantId,
    url,
    createdByType: "merchant_session",
    createdById: randomUUID(),
  });
  return { merchantId, endpoint };
}

function capturingTransport(url: string, captured: WebhookTransportRequest[]): WebhookTransport {
  return async (req) => {
    if (req.url === url) captured.push(req);
    return { statusCode: 200, body: "ok" };
  };
}

test("S5: a dispatched webhook's signature verifies against the raw bytes sent", async () => {
  const url = `http://fake-receiver.test/s5-${randomUUID()}`;
  const { merchantId, endpoint } = await merchantWithEndpoint(url);
  await enqueueEvent(pool, {
    eventType: "transaction.captured",
    aggregateType: "transaction",
    aggregateId: randomUUID(),
    payload: { merchantId, amountCapturedFils: 4_750, feeFils: 71, newStatus: "captured", capturedTotalFils: 4_750 },
  });

  const captured: WebhookTransportRequest[] = [];
  await runDispatchPass(pool, capturingTransport(url, captured), config);

  assert.equal(captured.length, 1);
  assert.ok(merchantVerifies(captured[0]!, endpoint.secret), "signature must match the exact body bytes");
});

test("S5: a test event's signature verifies against the raw bytes sent", async () => {
  const url = `http://fake-receiver.test/s5-test-${randomUUID()}`;
  const { merchantId, endpoint } = await merchantWithEndpoint(url);

  const captured: WebhookTransportRequest[] = [];
  await sendTestWebhookEvent(pool, config, capturingTransport(url, captured), { merchantId, endpointId: endpoint.id });

  assert.equal(captured.length, 1);
  assert.ok(merchantVerifies(captured[0]!, endpoint.secret), "signature must match the exact body bytes");
});
