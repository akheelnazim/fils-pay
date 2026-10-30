import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { loadConfig } from "../config.js";
import { createAcquirerSimulator } from "../acquirer/simulator.js";
import type { AcquirerSimulator } from "../acquirer/types.js";
import { payPaymentLink, type PayPaymentLinkResult } from "./pay.js";
import { getPublicPaymentLink } from "./read.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("pay.r6.fix.test.ts requires DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", ACQUIRER_FAILURE_RATE: "0", ACQUIRER_LATENCY_MIN_MS: "0", ACQUIRER_LATENCY_MAX_MS: "1", WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=" });
const acquirer = createAcquirerSimulator(config);
const card = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };
test.after(async () => { await pool.end(); });

async function createLink() {
  const merchant = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps, onboarding_status) VALUES ($1, 250, 'approved') RETURNING id`, [`R6 ${randomUUID()}`]);
  const merchantId = merchant.rows[0]!.id;
  const token = randomUUID();
  await pool.query(`INSERT INTO payment_links (merchant_id, token, amount_fils, expires_at, created_by_type, created_by_id) VALUES ($1, $2, 4750, now() + interval '1 hour', 'merchant_api_key', $3)`, [merchantId, token, randomUUID()]);
  const pay = (simulator: AcquirerSimulator) => payPaymentLink(pool, simulator, { paymentLinkReservationTimeoutSeconds: 0 }, { token, card, idempotencyKey: randomUUID() });
  return { merchantId, token, pay };
}

test("R6: a second buyer cannot capture while the first capture exceeds the reservation timeout", async () => {
  const { merchantId, token, pay } = await createLink();
  let second: PayPaymentLinkResult | undefined;
  let status: string | undefined;
  const slow: AcquirerSimulator = {
    authorize: (req) => acquirer.authorize(req),
    capture: async (req) => { second = await pay(acquirer); status = (await getPublicPaymentLink(pool, token, 0))?.status; return acquirer.capture(req); },
    refund: (req) => acquirer.refund(req),
  };
  const first = await pay(slow);
  assert.equal(second?.statusCode, 409, JSON.stringify(second?.body));
  assert.equal(status, "processing");
  assert.equal(first.statusCode, 200, JSON.stringify(first.body));
  const captured = await pool.query(`SELECT id FROM transactions WHERE merchant_id = $1 AND captured_fils > 0`, [merchantId]);
  assert.equal(captured.rowCount, 1);
});

test("R6: an unknown capture outcome remains locked for review", async () => {
  const { token, pay } = await createLink();
  const uncertain: AcquirerSimulator = {
    authorize: (req) => acquirer.authorize(req),
    capture: async (req) => ({ outcome: "error", acquirerReference: req.acquirerReference, latencyMs: 0 }),
    refund: (req) => acquirer.refund(req),
  };
  const result = await pay(uncertain);
  assert.equal(result.statusCode, 502);
  assert.equal((result.body as { error: string }).error, "payment_link_capture_uncertain");
  assert.equal((await pay(acquirer)).statusCode, 409);
  assert.equal((await getPublicPaymentLink(pool, token, 0))?.status, "processing");
  const row = await pool.query<{ capture_transaction_id: string | null }>(`SELECT capture_transaction_id FROM payment_links WHERE token = $1`, [token]);
  assert.ok(row.rows[0]!.capture_transaction_id);
});

test("R6: a thrown capture error leaves the link locked", async () => {
  const { token, pay } = await createLink();
  const failing: AcquirerSimulator = {
    authorize: (req) => acquirer.authorize(req),
    capture: async () => { throw new Error("transport interrupted"); },
    refund: (req) => acquirer.refund(req),
  };
  const result = await pay(failing);
  assert.equal(result.statusCode, 502);
  assert.equal((result.body as { error: string }).error, "payment_link_capture_uncertain");
  assert.equal((await pay(acquirer)).statusCode, 409);
  assert.equal((await getPublicPaymentLink(pool, token, 0))?.status, "processing");
});

test("R6: a definite capture decline releases the link", async () => {
  const { pay } = await createLink();
  const declined: AcquirerSimulator = {
    authorize: (req) => acquirer.authorize(req),
    capture: async (req) => ({ outcome: "declined", acquirerReference: req.acquirerReference, latencyMs: 0 }),
    refund: (req) => acquirer.refund(req),
  };
  assert.equal((await pay(declined)).statusCode, 402);
  assert.equal((await pay(acquirer)).statusCode, 200);
});
