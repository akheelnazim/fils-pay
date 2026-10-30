// Builds submission/LGTM_FilsPay_Submission.docx. Run: node build-doc.cjs
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, AlignmentType, LevelFormat, PageBreak, ImageRun, Footer, PageNumber,
  TableOfContents,
} = require("docx");
const F = require("./findings.cjs");

const ACCENT = "1F6F78";
const PAGE_W = 11906, MARGIN = 1134; // A4, 2 cm margins
const CW = PAGE_W - 2 * MARGIN;

// ---------- helpers ----------
// Inline markup: **bold**, `code`, [[placeholder]]
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const s = m[0];
    if (s.startsWith("**")) out.push(new TextRun({ text: s.slice(2, -2), bold: true, ...base }));
    else if (s.startsWith("`")) out.push(new TextRun({ text: s.slice(1, -1), font: "Consolas", size: (base.size || 21) - 2, ...base, }));
    else out.push(new TextRun({ text: "[" + s.slice(2, -2) + "]", highlight: "yellow", bold: true, ...base }));
    last = m.index + s.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}
const P = (text, opts = {}) => new Paragraph({ children: runs(text, opts.run), spacing: { after: 120 }, ...opts.p });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: true });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)], keepNext: true });
const B = (text, level = 0) => new Paragraph({ children: runs(text), numbering: { reference: "bul", level }, spacing: { after: 60 } });
const N = (text) => new Paragraph({ children: runs(text), numbering: { reference: "num", level: 0 }, spacing: { after: 60 } });
const Code = (lines) => lines.map((l, i) => new Paragraph({
  children: [new TextRun({ text: l || " ", font: "Consolas", size: 18 })],
  shading: { type: ShadingType.CLEAR, color: "auto", fill: "F2F4F6" },
  spacing: { after: i === lines.length - 1 ? 160 : 0 }, indent: { left: 200 },
}));
const Quote = (text, who) => new Paragraph({
  children: [...(who ? [new TextRun({ text: who + ": ", bold: true, size: 20, color: "3B4D5C" })] : []), ...runs(text, { size: 20, italics: !who ? true : false })],
  indent: { left: 360 }, spacing: { after: 100 },
  border: { left: { style: BorderStyle.SINGLE, size: 12, color: "B9C7D0", space: 8 } },
});

const thin = { style: BorderStyle.SINGLE, size: 4, color: "C9D3DA" };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
function cell(text, w, opts = {}) {
  const content = Array.isArray(text) ? text : [text];
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined,
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    children: content.map((t) => new Paragraph({ children: runs(String(t), { size: opts.size || 19, bold: opts.bold, color: opts.color }) })),
  });
}
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], { fill: ACCENT, bold: true, color: "FFFFFF" })) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i])) })),
    ],
  });
}
function kv(pairs) {
  const w = [2100, CW - 2100];
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: w,
    rows: pairs.map(([k, v]) => new TableRow({ cantSplit: true, children: [cell(k, w[0], { fill: "EEF4F5", bold: true }), cell(v, w[1])] })),
  });
}
const gap = () => new Paragraph({ children: [], spacing: { after: 120 } });
const PH = (t) => P(`[[${t}]]`);

// ---------- counts ----------
const all = F.flatMap((g) => g.items);
const openCount = F.open.length + 1; // + X14

// ---------- content ----------
const children = [];

// Cover
children.push(
  new Paragraph({ spacing: { before: 2200, after: 200 }, children: [new TextRun({ text: "FilsPay Handover", size: 64, bold: true, color: ACCENT })] }),
  new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: "Submission document · Team LGTM", size: 32, color: "3B4D5C" })] }),
  H2("Team"),
  table(["Member", "Owned"], [
    ["Akheel Nazim", "Auditing, the planted traps, designing the AI workflow, fixes"],
    ["Ahmed Khalaf", "Fixes, auditing the commit history, deployment, load testing, UI fixes"],
  ], [3000, CW - 3000]),
  gap(),
  H2("Live URLs"),
  table(["What", "URL"], [
    ["Checkout", "https://merchant.139-59-92-10.sslip.io/pay/plink_YHUL7DIg7Yph8xOq0p5O2q"],
    ["Merchant dashboard", "https://merchant.139-59-92-10.sslip.io/dashboard"],
    ["Admin console", "https://admin.139-59-92-10.sslip.io/"],
    ["Public API", "https://api.139-59-92-10.sslip.io/ (e.g. /healthz, /readyz, /v1/…)"],
  ], [3000, CW - 3000]),
  gap(),
  H2("Repository"),
  table(["What", "Value"], [
    ["Public fork", "https://github.com/akheelnazim/fils-pay"],
    ["Last commit before the deadline", "[[commit ID]]"],
  ], [3000, CW - 3000]),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ children: [new TextRun({ text: "Contents", bold: true, size: 32, color: ACCENT })], spacing: { after: 200 } }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-1" }),
);

// 1. Summary
children.push(
  H1("1. Summary"),
  P(`**What we found.** We audited the FilsPay handover with AI and checked every claim in the code. We confirmed 109 findings: 88 fixed, 2 partly fixed (M19, S19), and ${openCount} recorded but not fixed. By class: security holes (19), money-out races and duplicates (9), money maths that lost or invented fils (21), settlement timing (5), scripts and UI (17), deploy blockers (6), test-suite faults (3), 22 gaps in the half-built refund feature, and 7 dependency and performance items.`),
  P("**What we fixed.** Every security, race, money and timing bug from the audit, plus the ones our reviewer agents and later scans found. Each fix has its own failing test written first, a reviewer agent's sign-off, an entry in `fix-docs/FIXLOG.md` and one commit on `main`. We finished FP-300 (refunds): both refund addresses work, refunds are capped at what was captured, safe under concurrency, reverse the right fee, reach the webhook, reduce the next payout, show in reports, and keep reconciliation at a zero gap. An end-to-end test proves it."),
  P("**What we left alone.** Anything that needs production data or a Finance decision: the March sweep's production postings (X14), correcting historical payout estimates (M19), journaling past scheme residue (M14), and rotating the leaked acquirer secret (S11). We never ran a `scripts/` one-off against data. We kept every ADR's decision, even where the audit proposed breaking one (M9). A final scan found 22 more issues; 4 are fixed (S13, M21, T5 and part of S19) and 18 are recorded with fixes proposed, two of them high-severity security (S14, S15)."),
  P("**Main root cause.** FilsPay's safeguards lived in documents, comments and postmortems instead of in the code and the database. The ADRs required integer fils, but TypeScript and Go each rewrote money maths with floats and cents. Postmortems marked unique indexes and locks as \"done\" that were never built. Tenant checks sat on the route but not on the query. The repo's own AI instruction files were planted with false rules. Most findings trace back to a rule that was written down but never enforced."),
);

// 2. Architecture (sources: submission/architecture-deployment.md, ops/compose.server.yml)
children.push(
  H1("2. Architecture and deployment"),
  P("FilsPay runs as one Docker Compose project on our Dilmune Cloud server (139.59.92.10). Caddy is the only internet-facing service; PostgreSQL is an existing database outside the Compose stack. Full write-up: `submission/architecture-deployment.md`."),
  H2("Services and ports"),
  new Paragraph({ children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(__dirname, "architecture.png")), transformation: { width: 620, height: 248 } })], spacing: { after: 120 } }),
  table(["Service", "Ports", "Faces the internet?", "Notes"], [
    ["Caddy reverse proxy", "Host 80 and 443", "Yes", "Routes the three hostnames, manages HTTPS certificates; admin port 2019 not published"],
    ["Merchant UI + checkout (apps/web)", "Container 80; host 127.0.0.1:5173", "Through Caddy", "merchant.139-59-92-10.sslip.io"],
    ["Admin UI (apps/admin)", "Container 80; host 127.0.0.1:5174", "Through Caddy", "admin.139-59-92-10.sslip.io"],
    ["API (apps/api, Fastify)", "Container 3000; host 127.0.0.1:3000", "Through Caddy", "api.139-59-92-10.sslip.io, `/healthz`, `/readyz`"],
    ["Settlement (Go daemon)", "8091, Compose network only", "No", "Called by the API with an internal token"],
    ["Reporting worker", "None", "No", "Consumes outbox events"],
    ["Migrate job", "None; runs once and exits", "No", "Applies pending migrations before the services start"],
    ["PostgreSQL", "External; from `DATABASE_URL`", "No (restrict to trusted clients)", "Persistent data"],
  ], [2700, 2500, 1700, CW - 6900]),
  gap(),
  H2("Redeploy"),
  P("Compose is the infrastructure as code (`ops/compose.server.yml`). From a clean release directory holding the source and the protected `ops/.env.server`:"),
  ...Code(["docker compose -p ops --env-file ops/.env.server -f ops/compose.server.yml up -d --build"]),
  P("The live release is commit `d0f631d` (directory `~/filspay-releases/d0f631d`). Each release gets its own clean directory with the same project name `ops`, so volumes carry over. The command does not copy source to the server or provision PostgreSQL. Step-by-step: `ops/DEPLOY.md`."),
  H2("Where secrets come from"),
  B("A private env file on the server, `ops/.env.server`, with restricted permissions, passed to Compose with `--env-file` and ignored by Git. `ops/server.env.example` is the template with placeholders only."),
  B("It holds `DATABASE_URL`, `SETTLEMENT_INTERNAL_TOKEN` and `WEBHOOK_SECRET_ENCRYPTION_KEY` (both generated by the operator) and the acquirer callback signing secret. The webhook key must stay stable and backed up: losing it means stored webhook secrets can't be decrypted."),
  B("No secrets are committed any more (fix S11); the old acquirer secret is still in git history and must be rotated."),
  H2("Health checks and restart policies"),
  B("API: Docker health check calls `/healthz`. `/readyz` reports whether the database connected at startup (it does not detect a later outage)."),
  B("Merchant and admin UIs: health check fetches their local root page. Settlement and reporting have no HTTP check; we watch container state and logs."),
  B("Caddy, API, both UIs, settlement and reporting: `restart: unless-stopped`. The migrate job: `restart: no`. Docker does not restart a container only because it reports unhealthy."),
  B("Volumes: KYC uploads (`kyc_data`) and Caddy certificate data (`caddy_data`). We back these up with the database and the webhook encryption key."),
  H2("Redeploying without interrupting a settlement run"),
  B("Changes that don't touch settlement or the schema leave settlement running and rebuild only the other services:"),
  ...Code(["docker compose -p ops --env-file ops/.env.server -f ops/compose.server.yml up -d --build --no-deps api merchant admin reporting"]),
  B("Settlement or schema changes go in a maintenance window: confirm no scheduled or manual run is in progress, back up the database, then deploy. The close is due at 00:15 Asia/Bahrain (fixed in T1), so we avoid 00:00–00:30. There is no automatic drain, so this is an operational check, not a guarantee."),
  B("If a run is stopped anyway: the daemon shuts down on SIGTERM, each batch close is its own transaction and rolls back if cut off, re-closing a closed batch is a no-op (F8), and `settlement.paid` has a unique index (R3), so a rerun can't double-pay or double-notify. A multi-merchant run is not one transaction, and after restart the daemon retries only the most recent business day; older missed days need a backfill."),
  B("The `d0f631d` deployment used a short maintenance window, a verified database backup taken before migrating, and migration 0084."),
);

// 3. Capacity (numbers computed from loadtest/summary-fp209.json and summary-ramp.json)
children.push(
  H1("3. Capacity"),
  P("We load-tested the live API (`https://api.139-59-92-10.sslip.io`) with k6 on 30 Oct, using Delta Wholesale Traders' 60-day history (1,200 captured orders, 1.21M BD)."),
  H2("Estimate on the fixed scenario"),
  P("**28 simulated users**, from the FP-209 baseline (`docs/perf/fp-209-loadtest-2026-09.md`): 20 on paged transaction listing, 5 on settlement summary and 3 on CSV export, on the 0.5 vCPU / 512 MB API container that scenario targets."),
  H2("Our load test"),
  table(["Item", "Value"], [
    ["Tool", "k6 (grafana/k6 container). Scripts: `loadtest/loadtest-fp209.js`, `loadtest/loadtest-ramp.js`. Raw results: `loadtest/summary-fp209.json`, `summary-ramp.json`."],
    ["Method", "(1) FP-209 replication: 30 users for 60 s. (2) Ramp: 25 → 60 → 120 → 200 users in 30 s steps after a 15 s warm-up, then 10 users for 20 s to watch recovery. Mix: transaction list, settlement summary, streamed CSV export (X3) and checkout link lookup."],
    ["Results", "30 users: 4,033 requests at 60.0 req/s, p50 233 ms, p95 428 ms, 0 failed. Ramp to 200 users: 15,577 requests at 123.4 req/s, p50 479 ms, p95 1.38 s, max 3.56 s, 0 failed. Every k6 status check passed in both runs."],
    ["Estimated vs measured", "28 estimated vs 200 measured simulated users, with 0 of 19,610 requests failed."],
  ], [2600, CW - 2600]),
  gap(),
  new Paragraph({ children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(__dirname, "loadtest-light.png")), transformation: { width: 620, height: 349 } })], spacing: { after: 120 } }),
  H2("Where the bottleneck is"),
  B("Users went up 6.7× (30 → 200) but throughput only 2× (60 → 123 req/s), while p95 went from 428 ms to 1.38 s and nothing failed. Requests are waiting, not failing."),
  B("The wait is in the database: the list and summary queries scan tables without the indexes recorded as P2, and all services share one connection budget. CSV export is the slowest call (p95 1.10 s at 30 users) but stays memory-safe because it now streams (X3)."),
  B("Observed on the server during the run (not part of the k6 output): API memory peaked at 128 MB of its 512 MB limit; CPU peaked at 41.9% on the API and 18.7% on Caddy."),
  H2("Turning away excess load and recovering"),
  P("Nothing rate-limits requests yet (S16, S17), so the stack queues excess load instead of refusing it: latency rises, but no request failed and no 429 or 5xx was returned in 19,610 requests. In the ramp's last stage (10 users) latency was observed back at about 204 ms, with no container restarts. Before more load we'd add rate limits at Caddy or Fastify and the P2 indexes."),
);

// 4. Findings report
children.push(
  H1("4. Findings report"),
  P("Every finding below was confirmed in the code before it was fixed. Each fixed one has a failing test written first (`*.fix.test.ts` or `*_fix_test.go`, named after its ID), a reviewer agent's check, and one commit on `main` named after the ID (`fix(S1): …`, `feat(FP-300/F3): …`). Full entries: `fix-docs/FIXLOG.md`. Sources: the audit (`fix-docs/filspay-audit-findings.md`), the evidence sheets, reviewer agents, two overall reviews and a final scan (`fix-docs/scan-2026-10-30.md`)."),
  P("Money is in fils (1 BD = 1000 fils)."),
);
for (const g of F) {
  children.push(H2(`4.${F.indexOf(g) + 1} ${g.group}`));
  for (const f of g.items) {
    children.push(H3(`${f.id}  ${f.t}`));
    children.push(kv([
      ["Symptom", f.sym], ["How found / reproduced", f.how], ["Root cause", f.cause],
      ["Fix", f.fix], ["Verified by", f.ver], ["Effect on existing data", f.data],
    ]));
    children.push(gap());
  }
}
children.push(
  H2(`4.${F.length + 1} Open findings from the final scan (not fixed)`),
  P("A read-only scan after FP-300 found 22 issues. S13, M21, T5 and part of S19 are fixed (entries above); these 18 are still open. They are tracked in FIXLOG and described with evidence in `fix-docs/scan-2026-10-30.md`. X14 (above) is also open."),
  table(["ID", "Severity", "Finding", "Proposed fix"], F.open, [700, 1000, 5000, CW - 6700]),
);

// Root causes
const RC = [
  ["Money rules on paper, not in code", "M1, M2, M4, M5, M6, M12, M13, M16, M17, M21", "ADR-0001 says integer fils, but money maths lives in two languages. The shared `packages/money` exists only for TypeScript; Go and several TS paths rewrote it with floats, float32, cents parsers, REAL/INTEGER columns and decimal copies. Nothing (lint, types or schema) stopped them."],
  ["Check-then-act with no database backstop", "R1, R2, R3, R5, R6, S9, F3, X4, M15, X2", "Uniqueness and limits were enforced by reading first and writing later. The postmortems claimed the backstops (a `processed_events` table, the FP-202 unique index, the FP-208 advisory lock) but none existed. Fix pattern: an atomic conditional `UPDATE … RETURNING` or `SELECT … FOR UPDATE`, plus a unique index."],
  ["Authorization checked at the route, not in the query", "S1, S2, S3, S8, S12, S13, S19, F2", "Routes checked the merchant in the URL or that an admin was logged in, while data functions took a bare id. Any id from another tenant then worked. Fix pattern: scope every query by the caller's merchant, and check roles server-side."],
  ["Trusting what comes from outside", "S4, S5, S6, S7, S11, X12, X13 · open: S14, S17", "Client clocks, unsigned callbacks, signatures over the wrong bytes, keys that outlive rotation, secrets in git. Security defaults were \"optional\"."],
  ["Two copies of one rule drift apart", "M3, M7, M10, M11, M14, M21, T1, T5, F9, F12, F15, X3, D4", "Displays and reports re-derived figures instead of reading what billing recorded (fee shown vs charged, summary vs payouts). Docs and comments described behaviour the code didn't have: ADR-0002 marked \"implemented\" with no code, CHANGELOG saying the export streams, a comment saying CORS was locked down. UTC was used where the rule is the Bahrain day."],
  ["Operational tools that act without guards", "X1, X2, X5, T2, M8, M9, X6, X8, D1, D2, D5", "Scripts and console buttons wrote money data with no idempotency, no dry run, and no check of what state they were touching (paid batches, sandbox merchants, every hold)."],
  ["A feature left half-built", "F1–F22", "Refunds had tables, helpers and a UI drawer, but the route returned 501, the insert always failed, and settlement, reporting, webhooks and reconciliation didn't know refunds existed. \"Just wire it\" would have shipped every gap above."],
];
children.push(
  H2(`4.${F.length + 2} Root causes`),
  P("Grouping the findings by the cause they share:"),
  table(["Root cause", "Findings", "The design decision behind it"], RC, [2300, 2200, CW - 4500]),
  gap(),
  P("**Across all of them:** the repo was booby-trapped for AI. `CLAUDE.md`, `AGENTS.md` and `.cursorrules` said money was cents, settlement used UTC midnight, `Math.random` was fine for OTPs and refunds should stay 501. Inline comments (\"claude says it's fine\") were planted the same way. We deleted the three files first and treated ADRs, code and tests as the only truth."),
);

// Decisions and open risks
const DEC = [
  ["Rejected the audit's M9 fix (rebuild balances from the ledger)", "ADR-0004 says the button rebuilds from settled data. The code follows the ADRs, not the other way round.", "Fixed the settled-data path instead (net of closed batches), tested.", "Closed"],
  ["Moved migrations 0054–0056 to 0077", "ADR-0005 reserves those numbers for settlement v2; 0054/0055 also broke a fresh migrate.", "Idempotent 0077 so old and new databases end the same.", "Closed"],
  ["Kept `/v1/refunds` and added `/v1/merchants/:id/refunds`", "Merchants already integrate on `/v1/refunds`; the AI planned to remove it (see section 6).", "One handler; 43 tests run on both addresses.", "Closed"],
  ["Never ran `scripts/` one-offs against data", "They post to the ledger; X2 shows a \"dry run\" that posted.", "Real `--dry-run`, idempotency guard; Finance-led reconciliation.", "X14 open"],
  ["Did not overwrite historical payout estimates (M19)", "Production totals used by ops and Finance; the ledger may be incomplete for old history.", "Read-only drift report; Finance agrees figures, then an audited migration.", "Open"],
  ["No catch-up journal for April-to-now scheme residue (M14)", "Changes closed batches' ledger; needs Finance.", "One-off reviewed migration with Finance.", "Open"],
  ["Did not rotate the acquirer secret or rewrite git history (S11)", "Needs the acquirer, and a force-push would break collaborators' clones.", "Rotate with the acquirer before go-live; treat the old secret as public.", "Open"],
  ["Smallest fix over the proper fix", "Brief: a small fix that works beats a rewrite. Bigger fixes are recorded per entry in FIXLOG.", "e.g. S4 drop `submittedAt` from the API, S6 raw-body verify, T1 fix inside `BusinessDayWindow`.", "Recorded"],
  ["Refunds larger than the day's net roll to the next batch (F8)", "A payout can never go negative and the debt is not lost.", "Strict ordering would hold later refunds back; separate refund column on batches.", "Closed"],
  ["Final-scan findings not fixed", "Found at the end; each needs the full test-first workflow.", "Fix S14 (SSRF) and S15 (compose in dev mode) before real traffic.", "Open (18)"],
  ["Payment-link recovery lookups are in-memory (R8)", "The acquirer simulator keeps no durable record.", "A real acquirer inquiry API or a stored record.", "Open"],
  ["Refund summary view isn't refreshed automatically (F15)", "Nothing in the code refreshes it, despite its comment.", "Refresh from the reporting worker.", "Open"],
  ["Deployment and load test", "Live on Dilmune Cloud behind Caddy (HTTPS). k6: 200 simulated users at 123.4 req/s, 0 of 19,610 requests failed.", "Rate limits (S16, S17) and the P2 indexes before more load.", "Closed"],
  ["Demo configuration shows OTP codes on the login screens", "OTP delivery is a stub in the demo, so codes are displayed to make sign-in possible. This removes the second factor.", "Use demo data only; switch `OTP_DEV_EXPOSE` off and add a real sender before real users.", "Open"],
];
children.push(
  H2(`4.${F.length + 3} Decisions and open risks`),
  table(["Decision / risk", "Why", "Safeguard we propose", "Status"], DEC, [2700, 2900, 2600, CW - 8200]),
);

// 5. UI/UX
const UI = [
  ["Merchant and admin portals restyled", "The sign-in screens and portal pages looked unfinished. Both portals now share a cleaner layout, spacing and type.", null, ["merchant", "admin"]],
  ["Refund drawer restored on the transaction page (F6, F11, F22)", "Merchants had no way to refund. The drawer caps the amount at captured − refunded − pending and shows API errors.", "`routes/refunds.fix.test.ts`, `transactions/serialize.f11.fix.test.ts`, and the live recording below"],
  ["Reconciliation page no longer crashes on a negative gap (X9)", "A negative gap is valid; the page threw and showed nothing.", "`apps/web/src/format.x9.fix.test.ts`"],
  ["Dashboard tab titled \"FilsPay Dashboard\" (X10)", "Every page was labelled \"FilsPay Checkout\" in tabs and history.", "`apps/web/src/documentTitle.x10.fix.test.ts`"],
  ["Merchant UI root URL redirects to the dashboard (X11)", "Opening the base URL showed React Router's developer 404 screen.", "`apps/web/src/router.x11.fix.test.ts`"],
  ["Checkout explains an uncertain or lost payment (R1, R6)", "A buyer who was charged but lost the reservation now sees \"charged, contact the merchant\" instead of a retry prompt that could charge them twice.", "`checkout/checkoutError.r6.fix.test.ts`"],
  ["Staff console shows the fee rate actually charged (M7)", "It showed 245 bps while 225 bps was billed.", "`fees/currentFeeScheduleDisplay.fix.test.ts`"],
];
const pic = (file, w) => new ImageRun({ type: "png", data: fs.readFileSync(path.join(__dirname, "..", "screenshots", file)), transformation: { width: w, height: Math.round(w * 900 / 1440) } });
const beforeAfter = (name) => {
  const half = CW / 2;
  const c = (label, file) => new TableCell({ width: { size: half, type: WidthType.DXA }, borders, margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18 })] }), new Paragraph({ children: [pic(file, 300)] })] });
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [half, half],
    rows: [new TableRow({ cantSplit: true, children: [c(`Before (${name})`, `${name}-before.png`), c(`After (${name})`, `${name}-after.png`)] })] });
};
children.push(H1("5. UI and UX changes"),
  P("Where we have screenshots, they are shown; the other changes are proved by the tests named under each."));
UI.forEach(([what, why, verified, shots], i) => {
  children.push(H3(`5.${i + 1} ${what}`), P(`**Why it mattered:** ${why}`));
  if (shots) shots.forEach((n) => children.push(beforeAfter(n), gap()));
  else children.push(P(`**Verified by:** ${verified}`));
});
children.push(P("Recording: `submission/LGTM_FilsPay_live_refund_flow.gif` in the repository (partial and full refund on the live site, then reconciliation)."));

// 6. AI usage
children.push(
  H1("6. AI usage"),
  H2("Setup"),
  P("**One line:** Claude Code (Opus) in the repo, driven by a custom fix-and-build skill, with cheaper subagents for tests (Haiku) and independent reviewers (Sonnet), and shared memory kept in git."),
  N("**Understand the codebase.** We first had Claude read the public GitHub repo. It found the repo was booby-trapped: `CLAUDE.md`, `AGENTS.md` and `.cursorrules` contained false rules (cents, UTC, \"don't fix refunds\"). We deleted all three in their own commit before any other work."),
  N("**Map it.** We built a floorplan (https://www.claudemap.org/en/explore/floorplan): an interactive map of every module, file and endpoint with plain-English descriptions and the calls between them. It lives in `floorplan/` and is queried with `node floorplan/query.mjs`."),
  N("**Audit.** Claude audited the code for security holes, money-out races and duplicates, money rounding and integer overflow, settlement timing and time zones, unsafe scripts, deploy blockers, broken ADR rules and UI errors. Each claim was then re-checked against the code and the ADRs before we trusted it (\"Audit check\" and \"Against the ADRs\" in FIXLOG)."),
  N("**A workflow skill.** `.claude/skills/fix-and-build/SKILL.md` makes every fix follow the same steps: confirm the bug in code, check the ADRs (stop and ask on a conflict), have a smaller agent (Haiku) write a failing test with edge cases, apply the smallest fix and record the proper one, check every caller in TypeScript and Go, run the suites, have a Sonnet reviewer agent hunt for breakage, then write the FIXLOG entry and one descriptive commit."),
  N("**Commits and collaboration.** Claude committed and pushed on its own once a fix passed review: one branch per fix off a freshly pulled `main`, pull again, squash-merge as one commit. A colleague committed to `main` at the same time, so the skill says how to resolve and record conflicts (a `Conflicts:` line in the commit and FIXLOG)."),
  N("**Shared memory in the repo.** Anything learned about the codebase went into `fix-docs/memory/` (commit rules, fix lifecycle, project decisions, pitfalls, which model does what) and `fix-docs/LESSONS.md`, so every session, ours and our colleague's, starts with the same knowledge."),
  N("**FP-300 refunds** were planned with the superpowers writing-plans skill (`docs/superpowers/plans/2026-10-30-fp-300-refunds.md`) and built one gap per commit. An Opus overall review at the end found F16–F21."),
  P("Where it lives: `.claude/skills/fix-and-build/`, `fix-docs/memory/`, `fix-docs/LESSONS.md`, `fix-docs/FIXLOG.md`, `floorplan/`, `docs/superpowers/plans/`, `CLAUDE.md` (rewritten by us)."),
);

const EX = [
  {
    title: "Excerpt 1: the AI was wrong. It planned to remove the refund address merchants already use",
    finding: "F6 (refund route), and with it F13.",
    ctx: "Claude Code (Opus) on 30 Oct, using the superpowers writing-plans skill to plan FP-300. It had the repo, the audit (which said to register the route under `/v1/merchants`), the dashboard's RefundDrawer, and `docs/`.",
    turns: [
      ["Claude", "\"Old `/v1/refunds` address: I plan to remove it. `docs/API.md` lists it, but the dashboard and the audit use the merchant-scoped address; I'll update API.md.\""],
      ["Us", "\"dont remove the old refund addresss, wouldnt fixing it make more sense? you tell me.\""],
      ["Claude", "\"you're right, fixing it makes more sense… `POST /v1/refunds` is the address the project docs give for merchants who connect with an API key, so removing it would break those integrations.\""],
    ],
    noticed: "Merchants integrate with FilsPay over the API. Removing a documented endpoint to suit the dashboard would have broken every merchant already calling it. The AI followed the audit's suggestion literally and treated the docs as something to \"update\" rather than as a contract.",
    verified: "Checked the docs list `POST /v1/refunds` for API-key integrations. The route tests (`routes/refunds.fix.test.ts`, 43 cases) run every check against both addresses. We then asked Claude to go back over every earlier fix for anything else that changes what outside systems see. In the same answer it had called a UTC capture-date function a new bug; checking showed nothing calls it, so it was dropped, not \"fixed\".",
    changed: "The plan and the code: both `/v1/refunds` (API keys) and `/v1/merchants/:merchantId/refunds` (dashboard) run one handler, the merchant always comes from the login, and the decision is recorded in FIXLOG (F6).",
  },
  {
    title: "Excerpt 2: the audit's fix broke a binding rule (ADR-0004)",
    finding: "M9 (\"Rebuild cached balances\" turned 135K into 7K), plus M2, X5 and D1/D2.",
    ctx: "Claude Code (Opus) on 29 Oct, with the audit, `docs/adr/` and the code. Prompt: \"verify the audit findings against ADRs also\".",
    turns: [
      ["Claude", "\"The fixes it proposes follow them, with one exception… Correction to the audit: its fix for M2… still passes the amount as a decimal number. ADR-0001 forbids floating-point numbers on money… M9 needs your call (the audit's fix conflicts with ADR-0004), and migrations 0054–0056 break ADR-0005.\""],
      ["Us", "\"the code should follow adr, not the other way around.\""],
      ["Claude", "\"M9: the rebuild button keeps using settled data, as ADR-0004 says. The fix goes inside that path instead of switching to the ledger.\""],
    ],
    noticed: "The audit was AI-written too, and its one-line M9 fix (swap to the ledger rebuild) would have quietly reversed an accepted architecture decision. The ADR cross-check also turned up a new bug, X5 (the March sweep charged merchants the residue).",
    verified: "`ledger/refresh_fix_test.go`: five cases failed before (gross instead of net, paid batches counted), all pass with the rebuild reading the net of closed batches. `db/migrate.fix.test.ts` and `migrate.d2.fix.test.ts` prove a fresh database migrates to the end with no 0054–0056 files.",
    changed: "We made \"ADRs are rules; a conflict means stop and ask\" part of the skill and `CLAUDE.md`, and recorded the decisions in the audit file and FIXLOG (\"Against the ADRs\").",
  },
  {
    title: "Excerpt 3: the reviewer agent caught the AI's own fix overpaying",
    finding: "M3 (split payouts short every batch).",
    ctx: "The fix-and-build workflow: a Haiku subagent wrote the failing database test (\"sum of settlement_batch_splits.allocated_fils = 10000, want 10001\"), Opus wrote the fix, a read-only Sonnet reviewer checked it.",
    turns: [
      ["Reviewer (Sonnet)", "\"Problems found… the adjusted share can go negative… Counterexample: net=3, five children at 2000 bps… it pays 1+1+1+1 = 4 against a net of 3. That is an overpay, which is what M3 is meant to remove.\""],
      ["Claude", "\"The reviewer found a real hole… Switching to the standard largest-remainder method… round every share down… hand out the leftover fils one at a time… Shares can't go negative and always add up exactly. I'm adding the reviewer's case to the test.\""],
    ],
    noticed: "The first fix put the whole rounding difference on the largest share. The tests only had two or three children, so they passed; the reviewer built a case with five.",
    verified: "`splits/shares_fix_test.go` now includes the five-way 3-fil case; `allocate_fix_test.go` checks split rows, ledger debits and the parent's cache all equal the net. Full Go suite green; a re-review answered \"OK to commit\".",
    changed: "The allocation algorithm (largest remainder, weights capped at 100%), and the lesson \"reviewers find what the audit missed\" in `LESSONS.md`.",
  },
];
children.push(H2("Three annotated transcript excerpts"),
  P("Quotes are taken from our Claude Code session transcripts (lightly trimmed with …). Our prompts are quoted as typed."));
for (const e of EX) {
  children.push(H3(e.title),
    kv([["Finding it supports", e.finding], ["Prompt and context", e.ctx]]), gap());
  e.turns.forEach(([who, t]) => children.push(Quote(t, who)));
  children.push(kv([["How we noticed", e.noticed], ["How we verified it", e.verified], ["What we changed", e.changed]]), gap());
}

// Appendix
children.push(
  H1("Appendix"),
  H2("A. Tests that failed before any fix"),
  P("Baseline on 29 Oct (TS suite on a fresh, seeded database): API 350/362, reporting 7/11. All 16 failures were explained and fixed:"),
  table(["Failures", "Cause", "Fixed by"], [
    ["11 refund tests", "Every refund insert passed `reason` as NULL against a CHECK constraint", "F14"],
    ["1 dispatcher backoff test", "Asserted an exact delay that has random jitter", "Q1"],
    ["4 reporting tests", "Another test seeded real event types with empty payloads into the shared DB; one bad event then stopped the consumer for good", "Q2, X6"],
  ], [2400, 5200, CW - 7600]),
  gap(),
  H2("B. Migrations we added"),
  table(["Migration", "For"], [
    ["0073_platform_stats_bigint", "M6"], ["0074_lifetime_payout_estimate_bigint", "M5"], ["0075_adjustment_import_content_hash", "R5"],
    ["0076_reporting_dead_letter_events", "X6"], ["0077_views_and_revoke_after", "D1 (replaces 0054/0056)"], ["0078_settlement_paid_event_idempotency", "R3"],
    ["0079_acquirer_callback_note_idempotency", "R2"], ["0080_drop_scheme_export_decimal_amount", "M16"], ["0081_payment_link_capture_in_progress", "R6"],
    ["0082_merchant_daily_volume_refunds", "F9"], ["0083_refund_merchant_summary_join", "F15"], ["0084_refunds_pending", "F22"],
  ], [5600, CW - 5600]),
  gap(),
  H2("C. FP-300 end-to-end test"),
  P("`apps/api/src/refunds/refund.e2e.fix.test.ts`: authorize 10,000 fils → capture → refund 3,000 → refund the remaining 7,000 → a third refund answers 409. It checks every ledger group balances, `merchant_payable` and `platform_fee_revenue` net to 0, the full 250-fil fee is reversed, the status is `refunded`, two `refund.succeeded` webhooks are delivered with signatures that verify, and the reconciliation gap is 0. The payout reduction is tested on the Go side (`settlement/refund_fix_test.go`: capture 10,000 + refund 4,000 pays 5,850)."),
  H2("D. How to run the tests"),
  ...Code([
    "docker start filspay-pg && npm run migrate",
    "DATABASE_URL=postgres://filspay:filspay_dev_password@localhost:5432/filspay npm test",
    "npx tsx --test scripts/*.test.ts",
    "MSYS_NO_PATHCONV=1 docker run --rm -v \"$PWD/apps/settlement:/src\" -w /src \\",
    "  -e DATABASE_URL=postgres://filspay:filspay_dev_password@host.docker.internal:5432/filspay \\",
    "  golang:1.22 go test -p 1 ./...",
  ]),
  H2("E. Final test output"),
  P("Run on 30 Oct against a freshly migrated local database, on the code at `adbee61`."),
  table(["Suite", "Tests", "Passed", "Failed", "Before any fix"], [
    ["apps/api", "578", "578", "0", "350 / 362"],
    ["apps/reporting", "18", "18", "0", "7 / 11"],
    ["apps/web", "12", "12", "0", "all passed"],
    ["apps/admin", "1", "1", "0", "all passed"],
    ["packages/money", "40", "40", "0", "all passed"],
    ["packages/events", "4", "4", "0", "all passed"],
    ["scripts/", "16", "16", "0", "5 / 5"],
    ["TypeScript total", "669", "669", "0", ""],
    ["apps/settlement (Go, -p 1)", "8 packages", "8", "0", "not run before (Go not installed)"],
  ], [3000, 1300, 1300, 1300, CW - 6900]),
  gap(),
  H2("F. Load test data"),
  P("The figure in section 3 is drawn by `submission/src/loadtest-chart.cjs` straight from the k6 summaries, so every number on it is measured. Requests per endpoint across both runs (k6 status checks, all passed):"),
  table(["Endpoint", "Requests", "p50 at 30 users", "p95 at 30 users"], [
    ["GET /v1/transactions?limit=50", "13,503", "233 ms", "307 ms"],
    ["GET /v1/settlement/summary", "3,493", "230 ms", "377 ms"],
    ["GET /v1/payment-links/:token (checkout)", "1,762", "not tagged", "not tagged"],
    ["GET /v1/transactions/export (streamed CSV)", "848", "692 ms", "1.10 s"],
  ], [4300, 1500, 1800, CW - 7600]),
  gap(),
  H2("G. Commit message format"),
  ...Code(["fix(<ID>): <what is fixed, in plain words>", "", "What: <the bug>", "Why: <root cause>", "Impact: <who lost what, a fils example if money>", "Fix: <the change>. Proper fix (if different): <…>", "Test: <new test file>; failed before, passes now.", "Checked: <callers/places reviewed>"]),
);

const doc = new Document({
  creator: "Team LGTM", title: "FilsPay Submission - Team LGTM",
  styles: {
    default: { document: { run: { font: "Calibri", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, color: ACCENT }, paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 27, bold: true, color: "13232F" }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, color: ACCENT }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [
    { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
      { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } }] },
    { reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Team LGTM · FilsPay submission · ", size: 16, color: "8A99A6" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "8A99A6" })] })] }) },
    children,
  }],
});

const out = path.join(__dirname, "..", "LGTM_FilsPay_Submission.docx");
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(out, b); console.log("wrote", out, all.length, "findings"); });
