/**
 * R9: links reserved before migration 0081 have no capture marker, so R7/R8
 * recovery refused them and nothing listed stuck links at all. Now
 * GET /v1/admin/payment-links/stuck lists every reservation older than 15
 * minutes, and recovery accepts the transaction the operator found for an
 * unmarked link, if it belongs to the link's merchant, is for the link's
 * amount, and is on no other link.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { hashPassword } from "../adminAuth/passwords.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("recover.r9.fix.test.ts requires DATABASE_URL");
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  OTP_DEV_EXPOSE: "true",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
});
const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

const PASSWORD = "R9-recovery-password-9000!";
let cookie = "";

test.before(async () => {
  const email = `r9-${randomUUID()}@admin.test`;
  await pool.query(`INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, $2, 'R9', 'finance')`, [
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

async function merchant(): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, onboarding_status) VALUES ($1, 250, 'approved') RETURNING id`,
    [`R9 ${randomUUID()}`],
  );
  return r.rows[0]!.id;
}

/** Created 59 minutes ago by default: just after a reservation made an hour ago. */
async function authorizedTxn(merchantId: string, amountFils = 4_750, createdAgo = "59 minutes"): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, created_at)
     VALUES ($1, 'authorized', $2, 0, $3, now() - $4::interval) RETURNING id`,
    [merchantId, amountFils, `acq_r9_${randomUUID()}`, createdAgo],
  );
  return r.rows[0]!.id;
}

/** A reservation as an API worker before 0081 left it: no marker. */
async function unmarkedLink(merchantId: string, reservedAgo = "1 hour", marker: string | null = null): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO payment_links (merchant_id, token, amount_fils, expires_at, created_by_type, created_by_id, status, reserved_at, capture_transaction_id)
     VALUES ($1, $2, 4750, now() + interval '1 day', 'merchant_api_key', $3, 'reserved', now() - $4::interval, $5) RETURNING id`,
    [merchantId, randomUUID(), randomUUID(), reservedAgo, marker],
  );
  return r.rows[0]!.id;
}

const recover = (linkId: string, payload: object) =>
  app.inject({ method: "POST", url: `/v1/admin/payment-links/${linkId}/recover-capture`, headers: { cookie }, payload });
const OPERATOR = { attestedOutcome: "not_captured", reason: "portal shows no capture, OPS-10" };

test("R9: the stuck list shows old reservations with and without a marker, not fresh ones", async () => {
  const m = await merchant();
  const unmarked = await unmarkedLink(m);
  const marked = await unmarkedLink(m, "1 hour", await authorizedTxn(m));
  const fresh = await unmarkedLink(m, "1 minute");
  const res = await app.inject({ method: "GET", url: "/v1/admin/payment-links/stuck", headers: { cookie } });
  assert.equal(res.statusCode, 200, res.body);
  const links = res.json().links as Array<{ id: string; hasMarker: boolean; amountFils: number }>;
  const byId = new Map(links.map((l) => [l.id, l]));
  assert.equal(byId.get(unmarked)?.hasMarker, false);
  assert.equal(byId.get(marked)?.hasMarker, true);
  assert.equal(byId.get(unmarked)?.amountFils, 4_750);
  assert.equal(byId.has(fresh), false);
  assert.equal((await app.inject({ method: "GET", url: "/v1/admin/payment-links/stuck" })).statusCode, 401);
});

test("R9: an unmarked link needs the operator to name its transaction", async () => {
  const m = await merchant();
  const linkId = await unmarkedLink(m);
  const res = await recover(linkId, OPERATOR);
  assert.equal(res.statusCode, 409, res.body);
  assert.equal(res.json().error, "transaction_required");
});

test("R9: an unmarked link with its transaction named is released, audited with who named it", async () => {
  const m = await merchant();
  const txnId = await authorizedTxn(m);
  const linkId = await unmarkedLink(m);
  const res = await recover(linkId, { ...OPERATOR, transactionId: txnId });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal((await pool.query(`SELECT status FROM payment_links WHERE id = $1`, [linkId])).rows[0].status, "active");
  const audit = await pool.query(
    `SELECT metadata FROM admin_audit_log WHERE action = 'payment_link_capture_recovery' AND target_id = $1`,
    [linkId],
  );
  assert.equal(audit.rows[0].metadata.transactionId, txnId);
  assert.equal(audit.rows[0].metadata.transactionNamedBy, "operator");
});

test("R9: a named transaction from another merchant, for another amount, or on another link is refused", async () => {
  const m = await merchant();
  const other = await merchant();
  const linkId = await unmarkedLink(m);

  const foreign = await recover(linkId, { ...OPERATOR, transactionId: await authorizedTxn(other) });
  assert.equal(foreign.statusCode, 409);
  assert.equal(foreign.json().error, "marked_transaction_missing");

  const wrongAmount = await recover(linkId, { ...OPERATOR, transactionId: await authorizedTxn(m, 9_999) });
  assert.equal(wrongAmount.json().error, "transaction_amount_mismatch");

  const taken = await authorizedTxn(m);
  await unmarkedLink(m, "1 hour", taken); // another link already holds it
  const elsewhere = await recover(linkId, { ...OPERATOR, transactionId: taken });
  assert.equal(elsewhere.json().error, "transaction_belongs_elsewhere");

  assert.equal((await pool.query(`SELECT status FROM payment_links WHERE id = $1`, [linkId])).rows[0].status, "reserved");
});

test("R9: on a marked link, naming a different transaction is refused", async () => {
  const m = await merchant();
  const linkId = await unmarkedLink(m, "1 hour", await authorizedTxn(m));
  const res = await recover(linkId, { ...OPERATOR, transactionId: await authorizedTxn(m) });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().error, "transaction_mismatch");
});

test("R9: a malformed transactionId is a 400", async () => {
  const m = await merchant();
  const linkId = await unmarkedLink(m);
  assert.equal((await recover(linkId, { ...OPERATOR, transactionId: "nope" })).statusCode, 400);
});

test("R9: a same-merchant, same-amount transaction from another time is not this link's payment", async () => {
  const m = await merchant();
  const linkId = await unmarkedLink(m); // reserved an hour ago
  const later = await recover(linkId, { ...OPERATOR, transactionId: await authorizedTxn(m, 4_750, "5 minutes") });
  assert.equal(later.statusCode, 409);
  assert.equal(later.json().error, "transaction_not_from_this_reservation");
  const earlier = await recover(linkId, { ...OPERATOR, transactionId: await authorizedTxn(m, 4_750, "2 hours") });
  assert.equal(earlier.json().error, "transaction_not_from_this_reservation");
  assert.equal((await pool.query(`SELECT status FROM payment_links WHERE id = $1`, [linkId])).rows[0].status, "reserved");
});

test("R9: an unmarked link asked to look up the acquirer without a transaction says which is missing", async () => {
  const m = await merchant();
  const linkId = await unmarkedLink(m);
  const res = await recover(linkId, { reason: "automatic check, OPS-11" });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().error, "transaction_required");
});
