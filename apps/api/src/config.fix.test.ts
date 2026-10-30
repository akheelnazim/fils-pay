/**
 * D3: outside production the API falls back to a built-in webhook encryption
 * key when WEBHOOK_SECRET_ENCRYPTION_KEY is unset, but that key decoded to 34
 * bytes, so loadConfig rejected its own fallback and dev boot failed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "./config.js";

const base = {
  DATABASE_URL: "postgres://filspay:filspay_dev_password@localhost:5432/filspay",
  INTERNAL_API_TOKEN: "test-internal-token",
};

test("D3: development boots with the built-in webhook key, and it is 32 bytes", () => {
  const config = loadConfig({ ...base, NODE_ENV: "development" });
  assert.equal(Buffer.from(config.webhookSecretEncryptionKey, "base64").length, 32);
});

test("D3: test env also falls back to a 32-byte key", () => {
  const config = loadConfig({ ...base, NODE_ENV: "test" });
  assert.equal(Buffer.from(config.webhookSecretEncryptionKey, "base64").length, 32);
});

test("D3: production still refuses to boot without a key", () => {
  assert.throws(() => loadConfig({ ...base, NODE_ENV: "production", SETTLEMENT_INTERNAL_TOKEN: "t", ACQUIRER_CALLBACK_SIGNING_SECRET: "s" }), /WEBHOOK_SECRET_ENCRYPTION_KEY/);
});

test("D3: an explicit key wins over the fallback", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  assert.equal(loadConfig({ ...base, NODE_ENV: "development", WEBHOOK_SECRET_ENCRYPTION_KEY: key }).webhookSecretEncryptionKey, key);
});
