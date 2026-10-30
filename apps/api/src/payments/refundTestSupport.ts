/**
 * Shared setup for the FP-300 refund fix tests: a real app and pool, a
 * merchant with an API key, and transactions authorized and captured through
 * the real routes, so the ledger and fee state is what capture produces.
 * Same helpers as processRefund.test.ts, lifted out so each fix test doesn't
 * copy them. Test-only; nothing in the app imports this.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { recordKycReview } from "../onboarding/review.js";
import type { AcquirerOutcome, AcquirerRefundResult, AcquirerSimulator } from "../acquirer/types.js";

const VALID_CARD = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };

/** An acquirer whose refund outcome is fixed (no simulator RNG). */
export function fixedAcquirer(outcome: AcquirerOutcome): AcquirerSimulator {
  return {
    authorize() {
      throw new Error("fixedAcquirer: authorize is not used by refund tests");
    },
    capture() {
      throw new Error("fixedAcquirer: capture is not used by refund tests");
    },
    refund(req): Promise<AcquirerRefundResult> {
      return Promise.resolve({ outcome, acquirerReference: req.acquirerReference, latencyMs: 0 });
    },
  };
}

export function createRefundTestKit(label: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`${label} requires DATABASE_URL to point at a real, migrated Postgres`);
  }
  const config = loadConfig({
    DATABASE_URL: databaseUrl,
    NODE_ENV: "test",
    INTERNAL_API_TOKEN: "test-internal-token",
    ACQUIRER_FAILURE_RATE: "0",
    ACQUIRER_LATENCY_MIN_MS: "0",
    ACQUIRER_LATENCY_MAX_MS: "1",
    WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
  });
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  const app = buildApp(config, pool);

  async function createMerchant(name: string, opts: { mdrBps?: number; discountBps?: number } = {}) {
    const merchantResult = await pool.query<{ id: string }>(
      `INSERT INTO merchants (display_name, mdr_bps, negotiated_discount_bps) VALUES ($1, $2, $3) RETURNING id`,
      [`Refund Merchant ${name} ${randomUUID()}`, opts.mdrBps ?? 250, opts.discountBps ?? 0],
    );
    const merchantId = merchantResult.rows[0]!.id;
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO merchant_users (merchant_id, email, role, password_hash)
       VALUES ($1, $2, 'owner', 'unused-in-these-tests') RETURNING id`,
      [merchantId, `owner-${randomUUID()}@example.test`],
    );
    const ownerUserId = userResult.rows[0]!.id;
    await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
    const issued = await issueApiKey(pool, config, { merchantId, createdBy: ownerUserId, label: name });
    const key = await pool.query<{ id: string }>(
      `SELECT id FROM api_keys WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [merchantId],
    );
    return {
      merchantId,
      ownerUserId,
      rawKey: issued.rawKey,
      actor: { type: "merchant_api_key" as const, id: key.rows[0]!.id },
    };
  }

  /** Authorizes `amountFils` and captures `captureFils` (all by default). */
  async function capturedTransaction(rawKey: string, amountFils: number, captureFils?: number): Promise<string> {
    const authorizeRes = await app.inject({
      method: "POST",
      url: "/v1/transactions",
      headers: { authorization: `Bearer ${rawKey}`, "idempotency-key": randomUUID() },
      payload: { amountFils, card: VALID_CARD, reference: "refund-fix-test" },
    });
    assert.equal(authorizeRes.statusCode, 201, authorizeRes.body);
    const txnId = (authorizeRes.json() as { id: string }).id;
    const captureRes = await app.inject({
      method: "POST",
      url: `/v1/transactions/${txnId}/capture`,
      headers: { authorization: `Bearer ${rawKey}`, "idempotency-key": randomUUID() },
      payload: captureFils === undefined ? {} : { amountFils: captureFils },
    });
    assert.equal(captureRes.statusCode, 200, captureRes.body);
    return txnId;
  }

  async function close(): Promise<void> {
    await app.close();
    await pool.end();
  }

  return { config, pool, app, createMerchant, capturedTransaction, close };
}
