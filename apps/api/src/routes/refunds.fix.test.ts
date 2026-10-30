/**
 * F6 + F13: the refund route returned 501 and sat at /v1/refunds while the
 * dashboard's RefundDrawer posts to /v1/merchants/:id/refunds. Both
 * addresses now work (user decision 2026-10-30: keep the documented
 * /v1/refunds for API-key integrations), with the same checks.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { sha256Hex, randomToken } from "../lib/crypto.js";
import { startImpersonation } from "../admin/impersonation.js";
import { createRefundTestKit } from "../payments/refundTestSupport.js";

const kit = createRefundTestKit("routes/refunds.fix.test.ts");
after(() => kit.close());

async function sessionCookie(merchantId: string, role: "owner" | "finance" | "support") {
  const user = await kit.pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash)
     VALUES ($1, $2, $3, 'unused-in-these-tests') RETURNING id`,
    [merchantId, `${role}-${randomUUID()}@example.test`, role],
  );
  const raw = randomToken(32);
  await kit.pool.query(
    `INSERT INTO sessions (merchant_user_id, token_hash, authenticated, expires_at)
     VALUES ($1, $2, true, now() + interval '1 hour')`,
    [user.rows[0]!.id, sha256Hex(raw)],
  );
  return `${kit.config.cookieName}=${raw}`;
}

type Address = "api" | "merchant";
const ADDRESSES: Address[] = ["api", "merchant"];
const urlFor = (address: Address, merchantId: string) =>
  address === "api" ? "/v1/refunds" : `/v1/merchants/${merchantId}/refunds`;

function post(url: string, headers: Record<string, string>, payload: unknown) {
  return kit.app.inject({ method: "POST", url, headers, payload: payload as object });
}

async function refundedFils(txnId: string): Promise<number> {
  const r = await kit.pool.query<{ refunded_fils: string }>(`SELECT refunded_fils FROM transactions WHERE id = $1`, [txnId]);
  return Number(r.rows[0]!.refunded_fils);
}

for (const address of ADDRESSES) {
  test(`F6 [${address}]: an API key refunds its own payment`, async () => {
    const m = await kit.createMerchant(`f6-key-${address}`);
    const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
    const res = await post(
      urlFor(address, m.merchantId),
      { authorization: `Bearer ${m.rawKey}`, "idempotency-key": randomUUID() },
      { transactionId: txnId, amountFils: 2_500, reason: "returned item" },
    );
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json() as { amountFils: number; transactionId: string; status: string };
    assert.equal(body.amountFils, 2_500);
    assert.equal(body.transactionId, txnId);
    assert.equal(body.status, "succeeded");
    assert.equal(await refundedFils(txnId), 2_500);
  });

  for (const role of ["owner", "finance"] as const) {
    test(`F6 [${address}]: a ${role} session can refund`, async () => {
      const m = await kit.createMerchant(`f6-${role}-${address}`);
      const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
      const res = await post(
        urlFor(address, m.merchantId),
        { cookie: await sessionCookie(m.merchantId, role), "idempotency-key": randomUUID() },
        { transactionId: txnId },
      );
      assert.equal(res.statusCode, 200, res.body);
      assert.equal(await refundedFils(txnId), 10_000);
    });
  }

  test(`F6 [${address}]: a support session is forbidden`, async () => {
    const m = await kit.createMerchant(`f6-support-${address}`);
    const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
    const res = await post(
      urlFor(address, m.merchantId),
      { cookie: await sessionCookie(m.merchantId, "support"), "idempotency-key": randomUUID() },
      { transactionId: txnId },
    );
    assert.equal(res.statusCode, 403, res.body);
    assert.equal(await refundedFils(txnId), 0);
  });

  test(`F6 [${address}]: no login is 401`, async () => {
    const m = await kit.createMerchant(`f6-anon-${address}`);
    const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
    const res = await post(urlFor(address, m.merchantId), { "idempotency-key": randomUUID() }, { transactionId: txnId });
    assert.equal(res.statusCode, 401, res.body);
  });

  test(`F6 [${address}]: the Idempotency-Key header is required`, async () => {
    const m = await kit.createMerchant(`f6-nokey-${address}`);
    const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
    const res = await post(urlFor(address, m.merchantId), { authorization: `Bearer ${m.rawKey}` }, { transactionId: txnId });
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(res.json().error, "idempotency_key_required");
  });

  test(`F6 [${address}]: a replayed key returns the same body and refunds once`, async () => {
    const m = await kit.createMerchant(`f6-replay-${address}`);
    const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
    const headers = { authorization: `Bearer ${m.rawKey}`, "idempotency-key": randomUUID() };
    const first = await post(urlFor(address, m.merchantId), headers, { transactionId: txnId, amountFils: 1_000 });
    const second = await post(urlFor(address, m.merchantId), headers, { transactionId: txnId, amountFils: 1_000 });
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(second.statusCode, 200, second.body);
    assert.deepEqual(second.json(), first.json());
    assert.equal(await refundedFils(txnId), 1_000);
  });

  test(`F6 [${address}]: another merchant's transaction is a 404`, async () => {
    const owner = await kit.createMerchant(`f6-victim-${address}`);
    const intruder = await kit.createMerchant(`f6-intruder-${address}`);
    const txnId = await kit.capturedTransaction(owner.rawKey, 10_000);
    const res = await post(
      urlFor(address, intruder.merchantId),
      { authorization: `Bearer ${intruder.rawKey}`, "idempotency-key": randomUUID() },
      { transactionId: txnId, merchantId: owner.merchantId },
    );
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(await refundedFils(txnId), 0);
  });

  test(`F6 [${address}]: refunds on hold are refused`, async () => {
    const m = await kit.createMerchant(`f6-hold-${address}`);
    const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
    await kit.pool.query(`UPDATE merchants SET refunds_enabled = false WHERE id = $1`, [m.merchantId]);
    const res = await post(
      urlFor(address, m.merchantId),
      { authorization: `Bearer ${m.rawKey}`, "idempotency-key": randomUUID() },
      { transactionId: txnId },
    );
    assert.equal(res.statusCode, 403, res.body);
    assert.equal(res.json().error, "refunds_on_hold");
  });

  for (const [label, payload] of [
    ["no transactionId", { transactionId: undefined }],
    ["a transactionId that isn't an id", { transactionId: "abc" }],
    ["a fractional amount", { amountFils: 10.5 }],
    ["a zero amount", { amountFils: 0 }],
    ["a negative amount", { amountFils: -100 }],
    ["an amount sent as text", { amountFils: "100" }],
  ] as const) {
    test(`F6 [${address}]: ${label} is a 400`, async () => {
      const m = await kit.createMerchant(`f6-bad-${address}`);
      const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
      const res = await post(
        urlFor(address, m.merchantId),
        { authorization: `Bearer ${m.rawKey}`, "idempotency-key": randomUUID() },
        Object.assign({ transactionId: txnId }, payload),
      );
      assert.equal(res.statusCode, 400, res.body);
      assert.equal(await refundedFils(txnId), 0);
    });
  }
}

test("F6 [merchant]: a path merchant other than the login is 403", async () => {
  const m = await kit.createMerchant("f6-path");
  const other = await kit.createMerchant("f6-path-other");
  const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
  const res = await post(
    `/v1/merchants/${other.merchantId}/refunds`,
    { authorization: `Bearer ${m.rawKey}`, "idempotency-key": randomUUID() },
    { transactionId: txnId },
  );
  assert.equal(res.statusCode, 403, res.body);
  assert.equal(await refundedFils(txnId), 0);
});

// Review follow-ups: inputs that used to reach Postgres and fail with a 500,
// the error body shape the drawer and integrations read, and impersonation.
for (const address of ADDRESSES) {
  test(`F6 [${address}]: an over-long Idempotency-Key is a 400, not a 500`, async () => {
    const m = await kit.createMerchant(`f6-longkey-${address}`);
    const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
    const res = await post(
      urlFor(address, m.merchantId),
      { authorization: `Bearer ${m.rawKey}`, "idempotency-key": "k".repeat(4_000) },
      { transactionId: txnId },
    );
    assert.equal(res.statusCode, 400, res.body);
  });

  for (const [label, reason] of [
    ["a reason with a NUL character", "bad\u0000reason"],
    ["a reason over 500 characters", "r".repeat(501)],
    ["a reason that isn't text", 42],
  ] as const) {
    test(`F6 [${address}]: ${label} is a 400, not a 500`, async () => {
      const m = await kit.createMerchant(`f6-reason-${address}`);
      const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
      const res = await post(
        urlFor(address, m.merchantId),
        { authorization: `Bearer ${m.rawKey}`, "idempotency-key": randomUUID() },
        { transactionId: txnId, reason },
      );
      assert.equal(res.statusCode, 400, res.body);
      assert.equal(await refundedFils(txnId), 0);
    });
  }

  test(`F6 [${address}]: a refund over the limit answers with an error code the client can show`, async () => {
    const m = await kit.createMerchant(`f6-over-${address}`);
    const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
    const res = await post(
      urlFor(address, m.merchantId),
      { authorization: `Bearer ${m.rawKey}`, "idempotency-key": randomUUID() },
      { transactionId: txnId, amountFils: 10_001 },
    );
    assert.equal(res.statusCode, 422, res.body);
    assert.deepEqual(res.json(), { error: "refund_exceeds_refundable", refundableFils: 10_000 });
  });

  test(`F6 [${address}]: staff viewing as the merchant cannot refund`, async () => {
    const m = await kit.createMerchant(`f6-imp-${address}`);
    const txnId = await kit.capturedTransaction(m.rawKey, 10_000);
    const admin = await kit.pool.query<{ id: string }>(
      `INSERT INTO admin_users (email, password_hash, display_name, role)
       VALUES ($1, 'unused', 'F6 Fix', 'super_admin') RETURNING id`,
      [`f6-${randomUUID()}@admin.test`],
    );
    const grant = await startImpersonation(kit.pool, { adminUserId: admin.rows[0]!.id, merchantId: m.merchantId, ttlMinutes: 15 });
    const res = await post(
      urlFor(address, m.merchantId),
      { cookie: `${kit.config.impersonationCookieName}=${grant.rawToken}`, "idempotency-key": randomUUID() },
      { transactionId: txnId },
    );
    assert.equal(res.statusCode, 403, res.body);
    assert.equal(await refundedFils(txnId), 0);
  });
}
