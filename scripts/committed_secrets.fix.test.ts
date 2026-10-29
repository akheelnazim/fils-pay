/**
 * S11: no environment file or acquirer signing secret may be committed.
 * Only `*.example` templates with placeholder values belong in git.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const tracked = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" }).split("\n").filter(Boolean);

test("S11: no .env file other than *.example templates is tracked", () => {
  const envFiles = tracked.filter((p) => /(^|\/)\.env(\.|$)/.test(p) && !p.endsWith(".example"));
  assert.deepEqual(envFiles, []);
});

test("S11: no tracked file contains a real acquirer signing secret", () => {
  const leaks = tracked.filter((p) => {
    let text: string;
    try {
      text = readFileSync(`${repoRoot}/${p}`, "utf8");
    } catch {
      return false;
    }
    return /ACQUIRER_CALLBACK_SIGNING_SECRET=acqsec_[A-Za-z0-9_]+/.test(text);
  });
  assert.deepEqual(leaks, []);
});
