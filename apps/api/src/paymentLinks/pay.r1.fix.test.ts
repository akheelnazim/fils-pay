/**
 * R1 (incident 2026-05-14): a payment link must be charged to exactly one
 * buyer. A buyer whose reservation was taken over while it was paying must
 * never finalize the link, and must never be told "paid" for it. Requires
 * DATABASE_URL to point at a migrated Postgres.
 *
 * The acquirer is the real simulator wrapped so that a one-shot hook can run
 * another buyer's full payment at a chosen point in buyer A's flow.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { recordKycReview } from "../onboarding/review.js";
import { createAcquirerSimulator } from "../acquirer/simulator.js";
import type { AcquirerSimulator } from "../acquirer/types.js";
import { payPaymentLink, type PayPaymentLinkResult } from "./pay.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("pay.r1.fix.test.ts requires DATABASE_URL to point at a migrated Postgres");
}

const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  ACQUIRER_FAILURE_RATE: "0",
  ACQUIRER_LATENCY_MIN_MS: "0",
  ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
});
const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const app = buildApp(config, pool);
const acquirer: AcquirerSimulator = createAcquirerSimulator(config);

// A zero timeout means any 'reserved' link may be re-claimed straight away.
const payConfig = { paymentLinkReservationTimeoutSeconds: 0 };

test.after(async () => {
  await app.close();
  await pool.end();
});

const APPROVED_CARD = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };

interface PayableLink {
  merchantId: string;
  token: string;
  linkId: string;
}

async function createPayableLink(): Promise<PayableLink> {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`R1 fix ${randomUUID().slice(0, 8)}`],
  );
  const merchantId = merchant.rows[0]!.id;
  const user = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash)
     VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `r1-${randomUUID()}@pay.fix.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: user.rows[0]!.id, label: "r1" });

  const res = await app.inject({
    method: "POST",
    url: `/v1/merchants/${merchantId}/payment-links`,
    headers: { authorization: `Bearer ${rawKey}` },
    payload: { amountFils: 4_750, reference: "r1", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  });
  assert.equal(res.statusCode, 201, res.body);
  const { token } = res.json() as { token: string };
  const row = await pool.query<{ id: string }>(`SELECT id FROM payment_links WHERE token = $1`, [token]);
  return { merchantId, token, linkId: row.rows[0]!.id };
}

/** Makes the link's current reservation look older than any timeout, so another buyer may re-claim it. */
async function makeReservationStale(linkId: string): Promise<void> {
  await pool.query(`UPDATE payment_links SET reserved_at = now() - interval '1 hour' WHERE id = $1`, [linkId]);
}

/**
 * Wraps the real acquirer. The hook runs once, before the FIRST call of the
 * named operation is delegated; every other call goes straight through.
 */
function hookedAcquirer(hooks: {
  beforeAuthorize?: () => Promise<void>;
  beforeCapture?: () => Promise<void>;
}): AcquirerSimulator {
  let authorizeCalls = 0;
  let captureCalls = 0;
  return {
    async authorize(req) {
      if (authorizeCalls++ === 0) await hooks.beforeAuthorize?.();
      return acquirer.authorize(req);
    },
    async capture(req) {
      if (captureCalls++ === 0) await hooks.beforeCapture?.();
      return acquirer.capture(req);
    },
    refund: (req) => acquirer.refund(req),
  };
}

function payAs(link: PayableLink, simulator: AcquirerSimulator): Promise<PayPaymentLinkResult> {
  return payPaymentLink(pool, simulator, payConfig, {
    token: link.token,
    card: APPROVED_CARD,
    idempotencyKey: randomUUID(),
  });
}

async function linkState(linkId: string): Promise<{ status: string; transaction_id: string | null }> {
  const res = await pool.query<{ status: string; transaction_id: string | null }>(
    `SELECT status, transaction_id FROM payment_links WHERE id = $1`,
    [linkId],
  );
  return res.rows[0]!;
}

test("R1: a buyer who loses the reservation during authorize is voided, not charged", async () => {
  const link = await createPayableLink();
  let buyerB: PayPaymentLinkResult | undefined;

  // Buyer A is mid-authorize. Its reservation goes stale and buyer B pays in full.
  const acquirerForA = hookedAcquirer({
    beforeAuthorize: async () => {
      await makeReservationStale(link.linkId);
      buyerB = await payAs(link, acquirer);
    },
  });
  const buyerA = await payAs(link, acquirerForA);

  assert.ok(buyerB, "buyer B's payment must have run inside the hook");
  assert.equal(buyerB.statusCode, 200, JSON.stringify(buyerB.body));
  const bTransactionId = (buyerB.body as { transactionId: string }).transactionId;

  assert.equal(buyerA.statusCode, 409, JSON.stringify(buyerA.body));

  const aTxns = await pool.query<{ status: string; captured_fils: string | number }>(
    `SELECT status, captured_fils FROM transactions WHERE merchant_id = $1 AND id <> $2`,
    [link.merchantId, bTransactionId],
  );
  assert.equal(aTxns.rowCount, 1, "buyer A should have exactly one transaction");
  assert.equal(aTxns.rows[0]!.status, "voided");
  assert.equal(Number(aTxns.rows[0]!.captured_fils), 0, "buyer A must not be captured");

  const state = await linkState(link.linkId);
  assert.equal(state.status, "paid");
  assert.equal(state.transaction_id, bTransactionId);

  const captured = await pool.query(
    `SELECT id FROM transactions WHERE merchant_id = $1 AND captured_fils > 0`,
    [link.merchantId],
  );
  assert.equal(captured.rowCount, 1, "exactly one transaction may be captured for this merchant");
});

test("R6: an in-flight capture keeps its reservation even after the timeout", async () => {
  const link = await createPayableLink();
  let buyerB: PayPaymentLinkResult | undefined;

  // The zero timeout would previously let buyer B re-claim during capture.
  const acquirerForA = hookedAcquirer({
    beforeCapture: async () => {
      buyerB = await payAs(link, acquirer);
    },
  });
  const buyerA = await payAs(link, acquirerForA);

  assert.ok(buyerB, "buyer B's payment must have run inside the hook");
  assert.equal(buyerB.statusCode, 409, JSON.stringify(buyerB.body));
  assert.equal(buyerA.statusCode, 200, JSON.stringify(buyerA.body));
  const aTransactionId = (buyerA.body as { transactionId: string }).transactionId;

  const state = await linkState(link.linkId);
  assert.equal(state.status, "paid");
  assert.equal(state.transaction_id, aTransactionId);
});

test("R1: a buyer cannot finalize a reservation another buyer took over", async () => {
  const link = await createPayableLink();

  // Buyer B re-claims the link while A is mid-capture; B is still paying.
  const acquirerForA = hookedAcquirer({
    beforeCapture: async () => {
      await pool.query(`UPDATE payment_links SET status = 'reserved', reserved_at = now() WHERE id = $1`, [
        link.linkId,
      ]);
    },
  });
  const buyerA = await payAs(link, acquirerForA);

  assert.notEqual(buyerA.statusCode, 200, JSON.stringify(buyerA.body));

  const state = await linkState(link.linkId);
  assert.equal(state.status, "reserved", "buyer A must not mark the link paid");
  assert.equal(state.transaction_id, null, "the link must not point at buyer A's transaction");
  const marked = await pool.query<{ capture_transaction_id: string; captured_fils: string }>(
    `SELECT pl.capture_transaction_id, t.captured_fils FROM payment_links pl JOIN transactions t ON t.id = pl.capture_transaction_id WHERE pl.id = $1`,
    [link.linkId],
  );
  assert.equal(Number(marked.rows[0]!.captured_fils), 4750, "captured transaction must remain available for review");
});

test("R1: the normal single-buyer path still pays", async () => {
  const link = await createPayableLink();

  const buyer = await payAs(link, acquirer);

  assert.equal(buyer.statusCode, 200, JSON.stringify(buyer.body));
  const body = buyer.body as { status: string; transactionId: string };
  assert.equal(body.status, "paid");

  const state = await linkState(link.linkId);
  assert.equal(state.status, "paid");
  assert.equal(state.transaction_id, body.transactionId);
});
