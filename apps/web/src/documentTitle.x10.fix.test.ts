import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("X10: the merchant dashboard's default document title identifies the dashboard", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<title>FilsPay Dashboard<\/title>/);
});
