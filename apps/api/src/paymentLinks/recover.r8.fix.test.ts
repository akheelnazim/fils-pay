/**
 * R8 (R7's proper fix): with no operator report, recovery asks the acquirer
 * what happened to the capture. The answer is still checked against the local
 * books under the lock; an acquirer that can't say leaves the decision to an
 * operator.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { createAcquirerSimulator } from "../acquirer/simulator.js";
import type { AcquirerSimulator } from "../acquirer/types.js";
import { toFils } from "@filspay/money";
import { hashPassword } from "../adminAuth/passwords.js";
import { captureTransaction } from "../payments/capture.js";
import { payPaymentLink } from "./pay.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("recover.r8.fix.test.ts requires DATABASE_URL");
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  OTP_DEV_EXPOSE: "true",
  ACQUIRER_FAILURE_RATE: "0",
  ACQUIRER_LATENCY_MIN_MS: "0",
  ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
});
const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const app = buildApp(config, pool);
const card = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };
test.after(async () => {
  await app.close();
  await pool.end();
});

const PASSWORD = "R8-recovery-password-9000!";
let cookie = "";

test.before(async () => {
  const email = `r8-${randomUUID()}@admin.test`;
  await pool.query(`INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, $2, 'R8', 'finance')`, [
    email,
    await hashPassword(PASSWORD, config),
  ]);
  const login = await app.inject({ method: "POST", url: "/v1/admin/auth/login", payload: { email, password: PASSWORD } });
  const setCookie = login.headers["set-cookie"];
  cookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).find((h) => h?.startsWith(`${config.adminCookieName}=`))!.split(";")[0]!;
  const verify = await app.inject({
    method: "POST",
    url: "/v1/admin/auth/otp/verify",
    headers: { cookie },
    payload: { code: (login.json() as { devOtpCode: string }).devOtpCode },
  });
  assert.equal(verify.statusCode, 200, verify.body);
});

/**
 * A link stuck processing. `acquirerCaptured`: the acquirer took the capture
 * but the answer was lost; otherwise the capture never reached it.
 */
async function stuckLink(simulator: AcquirerSimulator, acquirerCaptured: boolean) {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, onboarding_status) VALUES ($1, 250, 'approved') RETURNING id`,
    [`R8 ${randomUUID()}`],
  );
  const merchantId = merchant.rows[0]!.id;
  const token = randomUUID();
  const link = await pool.query<{ id: string }>(
    `INSERT INTO payment_links (merchant_id, token, amount_fils, expires_at, created_by_type, created_by_id)
     VALUES ($1, $2, 4750, now() + interval '1 hour', 'merchant_api_key', $3) RETURNING id`,
    [merchantId, token, randomUUID()],
  );
  const lossy: AcquirerSimulator = {
    authorize: (req) => simulator.authorize(req),
    capture: async (req) => {
      if (acquirerCaptured) await simulator.capture(req);
      return { outcome: "error", acquirerReference: req.acquirerReference, latencyMs: 0 };
    },
    refund: (req) => simulator.refund(req),
  };
  const paid = await payPaymentLink(pool, lossy, { paymentLinkReservationTimeoutSeconds: 0 }, { token, card, idempotencyKey: randomUUID() });
  assert.equal(paid.statusCode, 502);
  const linkId = link.rows[0]!.id;
  await pool.query(`UPDATE payment_links SET reserved_at = now() - interval '1 hour' WHERE id = $1`, [linkId]);
  const marker = await pool.query<{ capture_transaction_id: string }>(`SELECT capture_transaction_id FROM payment_links WHERE id = $1`, [linkId]);
  return { merchantId, linkId, txnId: marker.rows[0]!.capture_transaction_id };
}

const recover = (linkId: string, payload: object = { reason: "automatic check, ticket OPS-8" }) =>
  app.inject({ method: "POST", url: `/v1/admin/payment-links/${linkId}/recover-capture`, headers: { cookie }, payload });
const linkStatus = async (linkId: string) =>
  (await pool.query(`SELECT status FROM payment_links WHERE id = $1`, [linkId])).rows[0].status;
const auditSource = async (linkId: string) =>
  (await pool.query(`SELECT metadata->>'source' AS s FROM admin_audit_log WHERE action = 'payment_link_capture_recovery' AND target_id = $1`, [linkId])).rows.map((r) => r.s);

test("R8: the simulator answers lookups from what it approved", async () => {
  const sim = createAcquirerSimulator(config);
  const auth = await sim.authorize({ merchantId: randomUUID(), amountFils: toFils(4_750), currency: "BHD", card, idempotencyKey: randomUUID() });
  assert.deepEqual(await sim.lookupCapture!(auth.acquirerReference), { state: "not_captured" });
  await sim.capture({ acquirerReference: auth.acquirerReference, amountFils: toFils(4_750), idempotencyKey: randomUUID() });
  assert.deepEqual(await sim.lookupCapture!(auth.acquirerReference), { state: "captured", capturedFils: 4_750 });
  assert.deepEqual(await sim.lookupCapture!("acq_never_seen"), { state: "unknown" });
});

test("R8: the acquirer says it never captured: the link is released and the authorization voided, audited as a lookup", async () => {
  const { linkId, txnId } = await stuckLink(app.acquirer, false);
  const res = await recover(linkId);
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(await linkStatus(linkId), "active");
  assert.equal((await pool.query(`SELECT status FROM transactions WHERE id = $1`, [txnId])).rows[0].status, "voided");
  assert.deepEqual(await auditSource(linkId), ["acquirer_lookup"]);
  const again = await recover(linkId);
  assert.equal(again.statusCode, 200);
  assert.equal(again.json().alreadyResolved, true);
});

test("R8: the acquirer captured and the books agree: the link is paid", async () => {
  // The capture reached the acquirer once and was booked here; only the link
  // was left unfinalized.
  const { merchantId, linkId, txnId } = await stuckLink(app.acquirer, false);
  await captureTransaction(pool, app.acquirer, { transactionId: txnId, merchantId, idempotencyKey: randomUUID(), actor: { type: "system", id: linkId } });
  const res = await recover(linkId);
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(await linkStatus(linkId), "paid");
});

test("R8: the acquirer captured but the books don't show it: refused until Finance books it", async () => {
  const { linkId } = await stuckLink(app.acquirer, true);
  const res = await recover(linkId);
  assert.equal(res.statusCode, 409, res.body);
  assert.equal(res.json().error, "ledger_not_reconciled");
  assert.equal(await linkStatus(linkId), "reserved");
  assert.deepEqual(await auditSource(linkId), []);
});

test("R8: an acquirer that can't say (no record of the reference) leaves it to an operator", async () => {
  const otherProcess = createAcquirerSimulator(config); // e.g. the API restarted since the payment
  const { linkId } = await stuckLink(otherProcess, false);
  const res = await recover(linkId);
  assert.equal(res.statusCode, 409, res.body);
  assert.equal(res.json().error, "acquirer_outcome_unknown");
  assert.equal(await linkStatus(linkId), "reserved");
  const attested = await recover(linkId, { attestedOutcome: "not_captured", reason: "portal shows no capture, OPS-9" });
  assert.equal(attested.statusCode, 200, attested.body);
  assert.deepEqual(await auditSource(linkId), ["operator"]);
});

test("R8: the acquirer captured a different amount than the link: refused", async () => {
  const { merchantId, linkId, txnId } = await stuckLink(app.acquirer, true); // 4 750 at the acquirer
  // ...and a second capture at the acquirer, so it now holds 9 500 for a 4 750 link
  await captureTransaction(pool, app.acquirer, { transactionId: txnId, merchantId, idempotencyKey: randomUUID(), actor: { type: "system", id: linkId } });
  const res = await recover(linkId);
  assert.equal(res.statusCode, 409, res.body);
  assert.equal(res.json().error, "acquirer_amount_mismatch");
  assert.equal(await linkStatus(linkId), "reserved");
});
