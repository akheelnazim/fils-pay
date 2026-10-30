import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("X11: the merchant app root redirects into the dashboard auth flow", async () => {
  const source = await readFile(new URL("./router.tsx", import.meta.url), "utf8");
  assert.match(source, /\{\s*path:\s*"\/",\s*element:\s*<Navigate to="\/dashboard" replace\s*\/>\s*\}/);
});
