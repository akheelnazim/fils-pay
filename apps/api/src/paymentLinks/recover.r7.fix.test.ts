/**
 * R7: a payment link left "processing" after an uncertain capture had no way
 * out except hand-edited SQL. An admin (finance / super_admin) who has checked
 * the acquirer outside the system reports what happened; the link is then
 * finalized or released once, with an audit row, and only when the local books
 * agree with that report. The charge is never retried and nothing is cleared
 * on the local transaction status alone.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { createAcquirerSimulator } from "../acquirer/simulator.js";
import type { AcquirerSimulator } from "../acquirer/types.js";
import { hashPassword } from "../adminAuth/passwords.js";
import { captureTransaction } from "../payments/capture.js";
import { payPaymentLink } from "./pay.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("recover.r7.fix.test.ts requires DATABASE_URL");
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
const acquirer = createAcquirerSimulator(config);
const card = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };
test.after(async () => {
  await app.close();
  await pool.end();
});

const ADMIN_PASSWORD = "R7-recovery-password-9000!";
let passwordHash: string | null = null;

async function signedInAdmin(role: "finance" | "support"): Promise<{ cookie: string; adminUserId: string }> {
  passwordHash ??= await hashPassword(ADMIN_PASSWORD, config);
  const email = `r7-${randomUUID()}@admin.test`;
  const user = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, $2, 'R7', $3) RETURNING id`,
    [email, passwordHash, role],
  );
  const login = await app.inject({ method: "POST", url: "/v1/admin/auth/login", payload: { email, password: ADMIN_PASSWORD } });
  assert.equal(login.statusCode, 200, login.body);
  const setCookie = login.headers["set-cookie"];
  const header = (Array.isArray(setCookie) ? setCookie : [setCookie]).find((h) => h?.startsWith(`${config.adminCookieName}=`));
  const cookie = header!.split(";")[0]!;
  const verify = await app.inject({
    method: "POST",
    url: "/v1/admin/auth/otp/verify",
    headers: { cookie },
    payload: { code: (login.json() as { devOtpCode: string }).devOtpCode },
  });
  assert.equal(verify.statusCode, 200, verify.body);
  return { cookie, adminUserId: user.rows[0]!.id };
}

/** A link left processing by an uncertain capture (R6): the acquirer answered "error". */
async function stuckLink() {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, onboarding_status) VALUES ($1, 250, 'approved') RETURNING id`,
    [`R7 ${randomUUID()}`],
  );
  const merchantId = merchant.rows[0]!.id;
  const token = randomUUID();
  const link = await pool.query<{ id: string }>(
    `INSERT INTO payment_links (merchant_id, token, amount_fils, expires_at, created_by_type, created_by_id)
     VALUES ($1, $2, 4750, now() + interval '1 hour', 'merchant_api_key', $3) RETURNING id`,
    [merchantId, token, randomUUID()],
  );
  const uncertain: AcquirerSimulator = {
    authorize: (req) => acquirer.authorize(req),
    capture: async (req) => ({ outcome: "error", acquirerReference: req.acquirerReference, latencyMs: 0 }),
    refund: (req) => acquirer.refund(req),
  };
  const paid = await payPaymentLink(pool, uncertain, { paymentLinkReservationTimeoutSeconds: 0 }, { token, card, idempotencyKey: randomUUID() });
  assert.equal(paid.statusCode, 502);
  const marker = await pool.query<{ capture_transaction_id: string }>(`SELECT capture_transaction_id FROM payment_links WHERE id = $1`, [link.rows[0]!.id]);
  return { merchantId, token, linkId: link.rows[0]!.id, txnId: marker.rows[0]!.capture_transaction_id };
}

const recoverUrl = (linkId: string) => `/v1/admin/payment-links/${linkId}/recover-capture`;
const REASON = "Acquirer portal shows the capture settled, ticket FIN-123";

async function linkState(linkId: string) {
  const r = await pool.query(`SELECT status, transaction_id, capture_transaction_id, reserved_at FROM payment_links WHERE id = $1`, [linkId]);
  return r.rows[0];
}
async function auditRows(linkId: string) {
  const r = await pool.query(`SELECT admin_user_id, metadata FROM admin_audit_log WHERE action = 'payment_link_capture_recovery' AND target_id = $1`, [linkId]);
  return r.rows;
}

test("R7: reported captured and the books agree: the link is finalized as paid, once, with an audit row", async () => {
  const { cookie, adminUserId } = await signedInAdmin("finance");
  const { merchantId, linkId, txnId } = await stuckLink();
  // The capture did land locally; only the link was left unfinalized.
  const captured = await captureTransaction(pool, acquirer, {
    transactionId: txnId, merchantId, idempotencyKey: randomUUID(), actor: { type: "system", id: linkId },
  });
  assert.equal(captured.statusCode, 200);

  const res = await app.inject({ method: "POST", url: recoverUrl(linkId), headers: { cookie }, payload: { attestedOutcome: "captured", reason: REASON } });
  assert.equal(res.statusCode, 200, res.body);
  const state = await linkState(linkId);
  assert.equal(state.status, "paid");
  assert.equal(state.transaction_id, txnId);
  assert.equal(state.capture_transaction_id, null);
  assert.equal(state.reserved_at, null);

  const rows = await auditRows(linkId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].admin_user_id, adminUserId);
  assert.equal(rows[0].metadata.attestedOutcome, "captured");
  assert.equal(rows[0].metadata.reason, REASON);

  const again = await app.inject({ method: "POST", url: recoverUrl(linkId), headers: { cookie }, payload: { attestedOutcome: "captured", reason: REASON } });
  assert.equal(again.statusCode, 200, again.body);
  assert.equal(again.json().alreadyResolved, true);
  assert.equal((await auditRows(linkId)).length, 1, "a repeat writes no second audit row");
});

test("R7: reported captured but the local books show no capture: refused, nothing changes", async () => {
  const { cookie } = await signedInAdmin("finance");
  const { linkId, txnId } = await stuckLink();
  const res = await app.inject({ method: "POST", url: recoverUrl(linkId), headers: { cookie }, payload: { attestedOutcome: "captured", reason: REASON } });
  assert.equal(res.statusCode, 409, res.body);
  assert.equal(res.json().error, "ledger_not_reconciled");
  const state = await linkState(linkId);
  assert.equal(state.status, "reserved");
  assert.equal(state.capture_transaction_id, txnId);
  assert.equal((await auditRows(linkId)).length, 0);
});

test("R7: reported not captured: the link is released for a new attempt and the authorization is voided", async () => {
  const { cookie } = await signedInAdmin("finance");
  const { linkId, txnId } = await stuckLink();
  const res = await app.inject({ method: "POST", url: recoverUrl(linkId), headers: { cookie }, payload: { attestedOutcome: "not_captured", reason: "Acquirer portal shows no capture, ticket FIN-124" } });
  assert.equal(res.statusCode, 200, res.body);
  const state = await linkState(linkId);
  assert.equal(state.status, "active");
  assert.equal(state.capture_transaction_id, null);
  const txn = await pool.query(`SELECT status FROM transactions WHERE id = $1`, [txnId]);
  assert.equal(txn.rows[0].status, "voided");
  assert.equal((await auditRows(linkId)).length, 1);

  const again = await app.inject({ method: "POST", url: recoverUrl(linkId), headers: { cookie }, payload: { attestedOutcome: "not_captured", reason: "second call, same report" } });
  assert.equal(again.statusCode, 200);
  assert.equal(again.json().alreadyResolved, true);
  const conflicting = await app.inject({ method: "POST", url: recoverUrl(linkId), headers: { cookie }, payload: { attestedOutcome: "captured", reason: REASON } });
  assert.equal(conflicting.statusCode, 409, "a different outcome after resolution is refused");
});

test("R7: reported not captured but the local books show a capture: refused, the link stays locked", async () => {
  const { cookie } = await signedInAdmin("finance");
  const { merchantId, linkId, txnId } = await stuckLink();
  await captureTransaction(pool, acquirer, { transactionId: txnId, merchantId, idempotencyKey: randomUUID(), actor: { type: "system", id: linkId } });
  const res = await app.inject({ method: "POST", url: recoverUrl(linkId), headers: { cookie }, payload: { attestedOutcome: "not_captured", reason: REASON } });
  assert.equal(res.statusCode, 409, res.body);
  assert.equal(res.json().error, "local_books_show_capture");
  assert.equal((await linkState(linkId)).status, "reserved");
  assert.equal((await auditRows(linkId)).length, 0);
});

test("R7: a link that is not stuck, an unknown link, bad bodies, no login and the wrong role are all refused", async () => {
  const finance = await signedInAdmin("finance");
  const support = await signedInAdmin("support");
  const { linkId } = await stuckLink();
  const healthy = await pool.query<{ id: string }>(
    `INSERT INTO payment_links (merchant_id, token, amount_fils, expires_at, created_by_type, created_by_id)
     SELECT merchant_id, $1, 1000, now() + interval '1 hour', 'merchant_api_key', $2 FROM payment_links WHERE id = $3 RETURNING id`,
    [randomUUID(), randomUUID(), linkId],
  );
  const post = (url: string, cookie: string | undefined, payload: unknown) =>
    app.inject({ method: "POST", url, headers: cookie ? { cookie } : {}, payload: payload as object });

  assert.equal((await post(recoverUrl(healthy.rows[0]!.id), finance.cookie, { attestedOutcome: "not_captured", reason: REASON })).statusCode, 409);
  assert.equal((await post(recoverUrl(randomUUID()), finance.cookie, { attestedOutcome: "captured", reason: REASON })).statusCode, 404);
  assert.equal((await post(recoverUrl("not-a-uuid"), finance.cookie, { attestedOutcome: "captured", reason: REASON })).statusCode, 404);
  assert.equal((await post(recoverUrl(linkId), finance.cookie, { attestedOutcome: "maybe", reason: REASON })).statusCode, 400);
  assert.equal((await post(recoverUrl(linkId), finance.cookie, { attestedOutcome: "captured" })).statusCode, 400);
  assert.equal((await post(recoverUrl(linkId), finance.cookie, { attestedOutcome: "captured", reason: "x" })).statusCode, 400);
  assert.equal((await post(recoverUrl(linkId), undefined, { attestedOutcome: "captured", reason: REASON })).statusCode, 401);
  assert.equal((await post(recoverUrl(linkId), support.cookie, { attestedOutcome: "captured", reason: REASON })).statusCode, 403);
  assert.equal((await linkState(linkId)).status, "reserved");
  assert.equal((await auditRows(linkId)).length, 0);
});
