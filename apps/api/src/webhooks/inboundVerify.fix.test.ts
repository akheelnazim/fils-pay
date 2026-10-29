/**
 * S6 (FP-240, inbound): acquirer callbacks must be signed, and a captured
 * genuine callback must not be replayable later. Pure unit tests.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifyAcquirerCallbackSignature } from "./inboundVerify.js";
import { loadConfig } from "../config.js";

const SECRET = "acqsec_s6_fix_secret";
const payload = { callbackId: "acqcb_s6", outcome: "cleared" };

function header(timestamp: number): string {
  const v1 = createHmac("sha256", SECRET).update(`${timestamp}.${JSON.stringify(payload)}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

test("S6: an unsigned callback is rejected by default", () => {
  const result = verifyAcquirerCallbackSignature(payload, undefined, SECRET);
  assert.equal(result.valid, false);
});

test("S6: the API requires acquirer signatures unless explicitly turned off", () => {
  const config = loadConfig({
    DATABASE_URL: "postgres://unused/db",
    NODE_ENV: "test",
    WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
  });
  assert.equal(config.acquirerCallbackRequireSignature, true);
});

test("S6: a genuine but old (replayed) callback is rejected", () => {
  const result = verifyAcquirerCallbackSignature(payload, header(nowSeconds() - 3600), SECRET);
  assert.equal(result.valid, false);
});

test("S6: a valid signature with extra characters appended is rejected", () => {
  const result = verifyAcquirerCallbackSignature(payload, `${header(nowSeconds())}zz`, SECRET);
  assert.equal(result.valid, false);
});

test("S6: a fresh, correctly signed callback is accepted", () => {
  const result = verifyAcquirerCallbackSignature(payload, header(nowSeconds()), SECRET);
  assert.deepEqual(result, { valid: true });
});
