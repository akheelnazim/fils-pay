// Builds submission/LGTM_FilsPay_Slides.pptx. Run: node build-deck.cjs
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const THEME = {
  name: "LGTM FilsPay",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "13232F", lt1: "FFFFFF", dk2: "0E3B43", lt2: "EEF4F5",
    accent1: "1F6F78", accent2: "E07A5F", accent3: "F2CC8F", accent4: "81B29A", accent5: "5B6B78", accent6: "C8553D",
    hlink: "1F6F78", folHlink: "5B6B78",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "FilsPay Handover - Team LGTM";
pres.author = "Team LGTM";
const C = pres.SchemeColor;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "DARK",
  background: { color: C.text2 },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.3, w: 11.7, h: 1.6, fontSize: 48, bold: true, color: C.background1, fontFace: THEME.headFontFace, valign: "bottom", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.05, w: 11.7, h: 1.2, fontSize: 22, color: "B9D3D6", valign: "top" }, text: "" } }],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 12.1, h: 0.9, fontSize: 34, bold: true, color: C.text1, fontFace: THEME.headFontFace, valign: "middle" }, text: "" } },
    { text: { text: "Team LGTM · FilsPay", options: { x: 0.6, y: 7.0, w: 4, h: 0.3, fontSize: 10, color: "8A99A6" } } }],
  slideNumber: { x: 12.2, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: "8A99A6", align: "right" },
});

let n = 0;
const nm = () => `obj${++n}`;
const T = (s, text, o) => s.addText(text, { isTextBox: true, objectName: nm(), margin: 0, fontFace: THEME.bodyFontFace, color: C.text1, ...o });
const card = (s, x, y, w, h, fill = C.background2) =>
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { type: "none" }, rectRadius: 0.12, objectName: nm(),
    shadow: { type: "outer", color: "13232F", opacity: 0.12, blur: 6, offset: 2, angle: 90 } });
const dot = (s, x, y, label, fill = C.accent1, size = 0.62) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: size, h: size, fill: { color: fill }, line: { type: "none" }, objectName: nm() });
  T(s, label, { x, y, w: size, h: size, align: "center", valign: "middle", fontSize: 16, bold: true, color: C.background1 });
};
const ph = (s, x, y, w, h, label) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: "FFF7E0" }, line: { color: HEX.accent3, width: 1.5, dashType: "dash" }, rectRadius: 0.1, objectName: nm() });
  T(s, label, { x: x + 0.2, y, w: w - 0.4, h, align: "center", valign: "middle", fontSize: 14, color: "8A6D1F", italic: true });
};
const content = (sec, title) => { const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: sec }); s.addText(title, { placeholder: "title" }); return s; };

// ---------- 0. Title ----------
pres.addSection({ title: "Pitch" });
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Pitch" });
  s.addText("FilsPay Handover", { placeholder: "title" });
  s.addText("Team LGTM · audit, fix and finish a Bahrain card-payments platform", { placeholder: "body" });
  [["109", "findings confirmed"], ["85", "fixed, test-first"], ["22", "refund gaps closed"]].forEach(([v, l], i) => {
    T(s, v, { x: 0.8 + i * 3.2, y: 5.4, w: 3, h: 0.8, fontSize: 40, bold: true, color: HEX.accent3, fontFace: THEME.headFontFace });
    T(s, l, { x: 0.8 + i * 3.2, y: 6.15, w: 3, h: 0.4, fontSize: 14, color: "B9D3D6" });
  });
  s.addNotes("Open with the three numbers, then the team.");
}

// ---------- 1. Team ----------
{
  const s = content("Pitch", "Team LGTM");
  const people = [["[Member 1]", "[What they owned]"], ["[Member 2]", "[What they owned]"], ["[Member 3]", "[What they owned]"]];
  people.forEach(([name, own], i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 1.6, 3.8, 4.2);
    s.addShape(pres.shapes.OVAL, { x: x + 1.4, y: 2.0, w: 1.0, h: 1.0, fill: { color: C.accent1 }, line: { type: "none" }, objectName: nm() });
    T(s, String(i + 1), { x: x + 1.4, y: 2.0, w: 1.0, h: 1.0, align: "center", valign: "middle", fontSize: 28, bold: true, color: C.background1 });
    T(s, name, { x: x + 0.3, y: 3.25, w: 3.2, h: 0.6, align: "center", fontSize: 22, bold: true, highlight: "FFF2B3" });
    T(s, own, { x: x + 0.3, y: 3.95, w: 3.2, h: 1.5, align: "center", fontSize: 15, color: C.accent5 });
  });
  T(s, "Plus Claude Code: Opus for fixes, Haiku for failing tests, Sonnet as reviewer", { x: 0.6, y: 6.2, w: 12, h: 0.5, fontSize: 15, italic: true, color: C.accent5 });
}

// ---------- 2. Root cause ----------
{
  const s = content("Pitch", "Root cause: the rules lived on paper, not in the code");
  card(s, 0.6, 1.5, 12.1, 1.5, C.text2);
  T(s, "Integer fils, unique payouts and tenant checks were written in ADRs and postmortems, but nothing in the code or the database enforced them.",
    { x: 1.0, y: 1.5, w: 11.3, h: 1.5, valign: "middle", fontSize: 21, color: C.background1, fontFace: THEME.headFontFace });
  const sym = [
    ["Money maths drifted", "TS and Go rewrote fils logic with floats, cents and int32", C.accent1],
    ["\"Fixed\" races weren't", "Postmortems listed unique indexes and locks that never existed", C.accent2],
    ["Checks on the route, not the query", "Any id from another merchant worked", C.accent6],
    ["Even the AI rules were planted", "CLAUDE.md said cents, UTC, \"don't fix refunds\"", C.accent5],
  ];
  sym.forEach(([h, b, col], i) => {
    const x = 0.6 + i * 3.075;
    card(s, x, 3.4, 2.85, 3.2);
    dot(s, x + 0.25, 3.65, String(i + 1), col);
    T(s, h, { x: x + 0.25, y: 4.45, w: 2.4, h: 0.9, fontSize: 17, bold: true });
    T(s, b, { x: x + 0.25, y: 5.35, w: 2.4, h: 1.1, fontSize: 14, color: C.accent5 });
  });
}

// ---------- 3. Key findings ----------
{
  const s = content("Pitch", "Key findings, ranked by impact");
  const rows = [
    ["Money left twice", "Two refunds of 6,000 on a 10,000 capture both succeeded; a payment link charged two buyers", "F3 · R1", C.accent6],
    ["Login skipped the OTP", "The pre-OTP cookie worked on every route, reproduced on the running API", "S1 · S2", C.accent2],
    ["Fils lost or invented", "CSV import booked 4.75 BD as 0.475 BD; volume counter wrapped and switched off the fee tier", "M1 · M6", C.accent1],
    ["Refunds never worked", "Route answered 501 and every insert failed: 22 gaps behind \"just wire it\"", "F1–F22", C.accent5],
  ];
  rows.forEach(([h, ev, id, col], i) => {
    const y = 1.5 + i * 1.32;
    card(s, 0.6, y, 12.1, 1.15);
    dot(s, 0.85, y + 0.26, String(i + 1), col);
    T(s, h, { x: 1.75, y: y + 0.1, w: 3.4, h: 0.95, valign: "middle", fontSize: 19, bold: true });
    T(s, ev, { x: 5.2, y: y + 0.1, w: 5.9, h: 0.95, valign: "middle", fontSize: 15, color: C.accent5 });
    T(s, id, { x: 11.1, y: y + 0.1, w: 1.4, h: 0.95, valign: "middle", align: "right", fontSize: 14, bold: true, color: col });
  });
}

// ---------- 4. Fixes and proof ----------
{
  const s = content("Pitch", "Fixes and proof: a failing test before every fix");
  const steps = ["Confirm in code", "Failing test", "Smallest fix", "Reviewer agent", "One commit"];
  steps.forEach((t, i) => {
    const x = 0.6 + i * 2.45;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.45, w: 2.2, h: 0.7, fill: { color: i === 1 ? C.accent2 : C.accent1 }, line: { type: "none" }, rectRadius: 0.35, objectName: nm() });
    T(s, t, { x, y: 1.45, w: 2.2, h: 0.7, align: "center", valign: "middle", fontSize: 15, bold: true, color: C.background1 });
  });
  const hdr = (t) => ({ text: t, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 }, fontSize: 14 } });
  const r = (a, b, c) => [{ text: a, options: { bold: true } }, { text: b, options: { color: HEX.accent6 } }, { text: c, options: { color: HEX.accent1, bold: true } }];
  s.addTable([
    [hdr("Fix"), hdr("Before"), hdr("After")],
    r("S1 pending session", "Reaches /auth/me", "Refused"),
    r("S4 expired link, old submittedAt", "200, charged", "410"),
    r("M1 CSV \"4.75\" BD", "475 fils", "4,750 fils"),
    r("F8 capture 10,000, refund 4,000", "Paid 9,750", "Paid 5,850"),
    r("Test suite baseline", "16 failing", "0 of those failing"),
  ], { x: 0.6, y: 2.5, w: 8.0, colW: [3.6, 2.2, 2.2], fontSize: 14, fontFace: THEME.bodyFontFace, color: HEX.dk1, border: { type: "solid", pt: 0.75, color: "C9D3DA" }, rowH: 0.52, valign: "middle", objectName: nm() });
  card(s, 9.0, 2.5, 3.7, 3.65, C.background2);
  [["88", "new fix test files"], ["12", "new migrations"], ["1", "commit per bug"]].forEach(([v, l], i) => {
    T(s, v, { x: 9.3, y: 2.65 + i * 1.15, w: 1.4, h: 0.8, fontSize: 36, bold: true, color: C.accent1, fontFace: THEME.headFontFace, valign: "middle" });
    T(s, l, { x: 10.7, y: 2.65 + i * 1.15, w: 1.9, h: 0.8, fontSize: 15, color: C.accent5, valign: "middle" });
  });
  T(s, "Every entry: symptom, cause, fix, test, data effect in fix-docs/FIXLOG.md", { x: 0.6, y: 6.4, w: 12, h: 0.4, fontSize: 13, italic: true, color: C.accent5 });
}

// ---------- 5. Live demo ----------
{
  const s = content("Pitch", "Live demo: a partial and a full refund, end to end");
  const flow = [["Capture", "10.000 BD"], ["Partial refund", "3.000 BD"], ["Full refund", "remaining 7.000 BD"], ["Dashboard", "refunded, 10.000 back"], ["Settlement report", "payout reduced, gap 0"]];
  flow.forEach(([h, b], i) => {
    const x = 0.6 + i * 2.45;
    card(s, x, 1.5, 2.2, 1.5);
    T(s, h, { x: x + 0.15, y: 1.6, w: 1.9, h: 0.6, fontSize: 17, bold: true, align: "center", valign: "middle" });
    T(s, b, { x: x + 0.15, y: 2.2, w: 1.9, h: 0.65, fontSize: 14, color: C.accent1, align: "center", valign: "middle" });
    if (i < flow.length - 1) s.addShape(pres.shapes.RIGHT_TRIANGLE, { x: x + 2.24, y: 2.1, w: 0.18, h: 0.3, rotate: 90, fill: { color: C.accent5 }, line: { type: "none" }, objectName: nm() });
  });
  ph(s, 0.6, 3.35, 3.9, 3.2, "[Screenshot: refund drawer on the transaction]");
  ph(s, 4.7, 3.35, 3.9, 3.2, "[Screenshot: dashboard after full refund]");
  ph(s, 8.8, 3.35, 3.9, 3.2, "[Screenshot: settlement / reconciliation report]");
  s.addNotes("Backup screenshots in case the live demo fails. Fee reversed in full (250 fils), two refund.succeeded webhooks with valid signatures.");
}

// ---------- 6. Under load ----------
{
  const s = content("Pitch", "Under load");
  s.addImage({ path: path.join(__dirname, "architecture.png"), x: 0.6, y: 1.45, w: 7.3, h: 4.1, objectName: nm(), altText: "Architecture: web, admin and API face the internet; settlement, reporting and Postgres are internal" });
  card(s, 8.3, 1.45, 4.4, 2.3);
  T(s, "Simulated users", { x: 8.6, y: 1.6, w: 3.8, h: 0.4, fontSize: 15, bold: true, color: C.accent5 });
  T(s, "Estimated", { x: 8.6, y: 2.1, w: 1.9, h: 0.35, fontSize: 13, color: C.accent5 });
  T(s, "Measured", { x: 10.6, y: 2.1, w: 1.9, h: 0.35, fontSize: 13, color: C.accent5 });
  T(s, "[ ]", { x: 8.6, y: 2.5, w: 1.9, h: 0.9, fontSize: 36, bold: true, color: C.accent1, highlight: "FFF2B3" });
  T(s, "[ ]", { x: 10.6, y: 2.5, w: 1.9, h: 0.9, fontSize: 36, bold: true, color: C.accent2, highlight: "FFF2B3" });
  card(s, 8.3, 3.95, 4.4, 2.6);
  T(s, [
    { text: "Bottleneck: ", options: { bold: true } }, { text: "[measured]", options: { highlight: "FFF2B3", breakLine: true } },
    { text: "Overload: ", options: { bold: true } }, { text: "[proxy limits / 429 / 503]", options: { highlight: "FFF2B3", breakLine: true } },
    { text: "Recovery: ", options: { bold: true } }, { text: "[what happened after]", options: { highlight: "FFF2B3" } },
  ], { x: 8.6, y: 4.1, w: 3.9, h: 2.3, fontSize: 15, valign: "top", paraSpaceAfter: 8 });
  T(s, "Already fixed for load: streamed CSV export (X3). Known: missing ledger indexes (P2), no rate limiting (S16, S17).", { x: 0.6, y: 5.8, w: 7.3, h: 0.8, fontSize: 13, color: C.accent5 });
}

// ---------- 7. How we used AI ----------
{
  const s = content("Pitch", "How we used AI");
  T(s, "Claude Code with a custom fix-and-build skill, cheap test-writer and reviewer agents, and shared memory kept in the repo.", { x: 0.6, y: 1.35, w: 12.1, h: 0.6, fontSize: 17, color: C.accent5 });
  const pipe = [["Floorplan", "map of the code"], ["Audit", "S, R, M, T, X, D"], ["Haiku", "writes failing test"], ["Opus", "smallest fix"], ["Sonnet", "reviews for breakage"], ["Git", "branch, squash, push"]];
  pipe.forEach(([h, b], i) => {
    const x = 0.6 + i * 2.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.15, w: 1.85, h: 1.15, fill: { color: i % 2 ? C.background2 : C.accent1 }, line: { type: "none" }, rectRadius: 0.12, objectName: nm() });
    T(s, h, { x, y: 2.22, w: 1.85, h: 0.5, align: "center", fontSize: 16, bold: true, color: i % 2 ? C.text1 : C.background1 });
    T(s, b, { x: x + 0.1, y: 2.7, w: 1.65, h: 0.5, align: "center", fontSize: 12, color: i % 2 ? C.accent5 : "D8ECEE" });
  });
  card(s, 0.6, 3.65, 12.1, 2.7, C.background2);
  T(s, "When the AI was wrong", { x: 0.95, y: 3.8, w: 6, h: 0.5, fontSize: 19, bold: true, color: C.accent6 });
  T(s, [
    { text: "Claude planned to delete ", options: {} }, { text: "POST /v1/refunds", options: { bold: true } },
    { text: " and keep only the dashboard's merchant-scoped route, as the audit suggested.", options: { breakLine: true } },
    { text: "We stopped it: merchants already integrate on that endpoint, so removing it would break them.", options: { breakLine: true } },
    { text: "Now both addresses run one handler, covered by 43 test cases, and we had it re-check every earlier fix for other integration breaks.", options: {} },
  ], { x: 0.95, y: 4.35, w: 11.4, h: 1.9, fontSize: 18, valign: "top", paraSpaceAfter: 10 });
}

// ---------- 8. Decisions and open risks ----------
{
  const s = content("Pitch", "Decisions and open risks");
  const col = (x, head, colr, items) => {
    card(s, x, 1.45, 5.9, 4.6);
    T(s, head, { x: x + 0.3, y: 1.6, w: 5.3, h: 0.5, fontSize: 19, bold: true, color: colr });
    T(s, items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })),
      { x: x + 0.3, y: 2.25, w: 5.3, h: 3.7, fontSize: 17, valign: "top", paraSpaceAfter: 12 });
  };
  col(0.6, "Chose not to change or run", C.accent1, [
    "Kept ADR-0004: rejected the audit's M9 shortcut and fixed the settled-data path",
    "Never ran scripts/ one-offs against data",
    "Didn't overwrite payout estimates or past ledger entries without Finance (M19, M14, X14)",
    "Smallest fix first; the bigger fix is recorded per bug",
  ]);
  col(6.8, "Still open", C.accent6, [
    "S13 cross-merchant read, S14 SSRF, S15 dev-mode compose: fix before real traffic",
    "Rotate the leaked acquirer secret (S11)",
    "March sweep production postings (X14)",
    "19 more scan items, all recorded with fixes",
    "[Deploy / load-test status]",
  ]);
}

// ---------- Appendix ----------
pres.addSection({ title: "Appendix" });
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Appendix" });
  s.addText("Appendix", { placeholder: "title" });
  s.addText("Not presented. Full detail in LGTM_FilsPay_Submission.pdf and fix-docs/FIXLOG.md", { placeholder: "body" });
}
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Appendix" });
  s.addText("Findings by class", { placeholder: "title" });
  s.addChart(pres.charts.BAR, [
    { name: "Fixed", labels: ["Security", "Races", "Money", "Timing", "Scripts / UI", "Deploy", "Tests", "Refunds", "Final scan"], values: [12, 8, 19, 4, 12, 5, 3, 22, 0] },
    { name: "Open or partly fixed", labels: ["Security", "Races", "Money", "Timing", "Scripts / UI", "Deploy", "Tests", "Refunds", "Final scan"], values: [0, 0, 1, 0, 1, 0, 0, 0, 22] },
  ], { x: 0.6, y: 1.4, w: 12.1, h: 5.3, barDir: "bar", barGrouping: "stacked", chartColors: [HEX.accent1, HEX.accent2],
    showValue: true, dataLabelPosition: "ctr", dataLabelFormatCode: "#;;", dataLabelColor: "FFFFFF", dataLabelFontSize: 12, dataLabelFontFace: "+mn-lt",
    showLegend: true, legendPos: "b", legendFontSize: 13, legendFontFace: "+mn-lt", catAxisLabelFontSize: 14, catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: HEX.accent5,
    valAxisLabelColor: HEX.accent5, valAxisLabelFontFace: "+mn-lt", valGridLine: { color: "E3E8EC", size: 0.5 }, catGridLine: { style: "none" }, catAxisOrientation: "maxMin", objectName: nm() });
}
{
  const s = content("Appendix", "Proof: tests, migrations, end-to-end refund");
  card(s, 0.6, 1.45, 5.9, 5.2);
  T(s, "Baseline: 16 tests failing before any fix", { x: 0.9, y: 1.6, w: 5.4, h: 0.5, fontSize: 17, bold: true });
  T(s, [
    { text: "11 refund tests: every insert failed (F14)", options: { bullet: true, breakLine: true } },
    { text: "1 webhook backoff test: exact assert on random jitter (Q1)", options: { bullet: true, breakLine: true } },
    { text: "4 reporting tests: polluted shared DB, consumer stalled (Q2, X6)", options: { bullet: true, breakLine: true } },
    { text: "End-to-end refund test: ledger balances, full fee reversed, signed webhooks, reconciliation gap 0", options: { bullet: true } },
  ], { x: 0.9, y: 2.2, w: 5.4, h: 3.0, fontSize: 15, valign: "top", paraSpaceAfter: 8 });
  ph(s, 0.9, 5.25, 5.3, 1.2, "[Final test output summary]");
  card(s, 6.8, 1.45, 5.9, 5.2);
  T(s, "12 new migrations (0073–0084)", { x: 7.1, y: 1.6, w: 5.4, h: 0.5, fontSize: 17, bold: true });
  T(s, "BIGINT money columns (M5, M6) · unique indexes against duplicates (R2, R3, R5) · reporting dead letters (X6) · ADR-0005 renumbering (D1) · integer scheme export (M16) · capture marker (R6) · refund columns, view and pending rows (F9, F15, F22)", { x: 7.1, y: 2.2, w: 5.4, h: 2.6, fontSize: 15, color: C.accent5, valign: "top" });
  ph(s, 7.1, 5.25, 5.3, 1.2, "[Load test graphs]");
}

const out = path.join(__dirname, "..", "LGTM_FilsPay_Slides.pptx");
pres.writeFile({ fileName: out }).then(async () => { await applyTheme(out, THEME); console.log("wrote", out); });
