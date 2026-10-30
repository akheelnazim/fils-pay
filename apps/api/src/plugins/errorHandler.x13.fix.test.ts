import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { errorHandler } from "./errorHandler.js";

test("X13: malformed JSON receives a client error", async () => {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  app.post("/", async (request) => request.body);
  app.get("/failure", async () => { throw new Error("private detail"); });
  try {
    const invalid = await app.inject({ method: "POST", url: "/", headers: { "content-type": "application/json" }, payload: "{" });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error, "validation_error");
    const empty = await app.inject({ method: "POST", url: "/", headers: { "content-type": "application/json" }, payload: "" });
    assert.equal(empty.statusCode, 400);
    assert.equal(empty.json().error, "validation_error");
    const valid = await app.inject({ method: "POST", url: "/", headers: { "content-type": "application/json" }, payload: { ok: true } });
    assert.equal(valid.statusCode, 200);
    const failure = await app.inject({ method: "GET", url: "/failure" });
    assert.equal(failure.statusCode, 500);
    assert.deepEqual(failure.json(), { error: "internal_error" });
  } finally {
    await app.close();
  }
});
