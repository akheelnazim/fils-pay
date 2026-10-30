/**
 * D4: the dashboard (apps/web, :5173) and the ops console (apps/admin, :5174)
 * call the API on :3000 with credentials: "include", but the API sent no CORS
 * headers, so every browser call from either screen was blocked.
 */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://filspay:filspay_dev_password@localhost:5432/filspay";
const base = {
  DATABASE_URL: databaseUrl,
  INTERNAL_API_TOKEN: "test-internal-token",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
};

const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const devApp = buildApp(loadConfig({ ...base, NODE_ENV: "development" }), pool);
const configuredApp = buildApp(
  loadConfig({ ...base, NODE_ENV: "development", CORS_ORIGINS: "https://dash.filspay.example" }),
  pool,
);
after(async () => {
  await devApp.close();
  await configuredApp.close();
  await pool.end();
});

test("D4: a GET from the dashboard origin is allowed with credentials", async () => {
  const res = await devApp.inject({ method: "GET", url: "/healthz", headers: { origin: "http://localhost:5173" } });
  assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
  assert.equal(res.headers["access-control-allow-credentials"], "true");
  assert.match(String(res.headers["vary"]), /Origin/i);
});

test("D4: the ops console origin is allowed too", async () => {
  const res = await devApp.inject({ method: "GET", url: "/healthz", headers: { origin: "http://localhost:5174" } });
  assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5174");
});

test("D4: a preflight for a JSON POST is answered 204 with the allowed methods and headers", async () => {
  const res = await devApp.inject({
    method: "OPTIONS",
    url: "/v1/auth/login",
    headers: {
      origin: "http://localhost:5173",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,idempotency-key",
    },
  });
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
  assert.match(String(res.headers["access-control-allow-methods"]), /POST/);
  assert.match(String(res.headers["access-control-allow-headers"]), /content-type/i);
  assert.match(String(res.headers["access-control-allow-headers"]), /idempotency-key/i);
});

test("D4: any other origin gets no CORS headers", async () => {
  const res = await devApp.inject({ method: "GET", url: "/healthz", headers: { origin: "https://evil.example" } });
  assert.equal(res.headers["access-control-allow-origin"], undefined);
  assert.equal(res.headers["access-control-allow-credentials"], undefined);
});

test("D4: CORS_ORIGINS replaces the dev defaults", async () => {
  const ok = await configuredApp.inject({
    method: "GET",
    url: "/healthz",
    headers: { origin: "https://dash.filspay.example" },
  });
  assert.equal(ok.headers["access-control-allow-origin"], "https://dash.filspay.example");
  const dev = await configuredApp.inject({ method: "GET", url: "/healthz", headers: { origin: "http://localhost:5173" } });
  assert.equal(dev.headers["access-control-allow-origin"], undefined);
});

test("D4: production allows no origin unless CORS_ORIGINS is set", () => {
  const prod = loadConfig({
    ...base,
    NODE_ENV: "production",
    SETTLEMENT_INTERNAL_TOKEN: "t",
    ACQUIRER_CALLBACK_SIGNING_SECRET: "s",
  });
  assert.deepEqual(prod.corsOrigins, []);
});
