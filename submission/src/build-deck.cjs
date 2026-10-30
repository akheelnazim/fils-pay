// Builds submission/LGTM_FilsPay_Slides.pptx in the "Tech Innovation" theme. Run: node build-deck.cjs
// (needs PPTX_SKILL pointing at the pptx skill for apply_theme.js, and NODE_PATH=./node_modules)
const path = require("path");
const pptxgen = require("pptxgenjs");
let applyTheme = async () => {};
if (process.env.PPTX_SKILL) {
  try {
    applyTheme = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js").applyTheme;
  } catch (e) {}
}

// Tech Innovation: electric blue, neon cyan, dark gray, white. DejaVu Sans isn't installed here,
// so Segoe UI (ships with Windows) stands in.
const K = {
  bg: "1E1E1E", card: "2A2D33", card2: "24272C", line: "3A3F47",
  text: "FFFFFF", muted: "A7B0BC", blue: "3D8BFF", cyan: "00FFFF", cyanSoft: "00D1FF",
  red: "FF5C5C", amber: "FFB020", green: "2BD9A0",
};
// The theme's electric blue (0066FF) is too dark on the dark background, so shapes use a brighter blue
// and text an even lighter tint.
const ink = (c) => (c === K.blue ? "9CC2FF" : c);
const FONT = "Segoe UI", FONT_B = "Segoe UI Semibold";
const THEME = {
  name: "Tech Innovation", headFontFace: FONT_B, bodyFontFace: FONT,
  colors: { dk1: K.bg, lt1: K.text, dk2: K.card, lt2: K.muted, accent1: K.blue, accent2: K.cyanSoft, accent3: K.amber, accent4: K.red, accent5: K.green, accent6: K.muted, hlink: K.cyanSoft, folHlink: K.muted },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.theme = { headFontFace: FONT_B, bodyFontFace: FONT };
pres.title = "FilsPay Handover - Team LGTM";
pres.author = "Team LGTM";

pres.defineSlideMaster({
  title: "COVER", background: { path: path.join(__dirname, "bg-cover.png") },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.0, w: 11.7, h: 1.5, fontSize: 54, bold: true, color: K.text, fontFace: FONT_B, valign: "bottom", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.6, w: 11.7, h: 0.9, fontSize: 22, color: K.muted, valign: "top", align: "left" }, text: "" } }],
});
pres.defineSlideMaster({
  title: "CONTENT", background: { path: path.join(__dirname, "bg-content.png") },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 12.1, h: 0.9, fontSize: 34, bold: true, color: K.text, fontFace: FONT_B, valign: "middle", align: "left" }, text: "" } },
    // Team mark, top right of every content slide (above the title's text line).
    { text: { text: "TEAM", options: { x: 10.45, y: 0.14, w: 0.95, h: 0.34, fontSize: 11, bold: true, color: K.muted, align: "right", valign: "middle", charSpacing: 3, fontFace: FONT } } },
    { text: { text: "LGTM", options: { x: 11.45, y: 0.1, w: 1.4, h: 0.42, fontSize: 20, bold: true, color: K.cyan, align: "left", valign: "middle", charSpacing: 2, fontFace: FONT_B } } },
    { text: { text: "Team LGTM · FilsPay handover", options: { x: 0.6, y: 7.0, w: 5, h: 0.3, fontSize: 11, bold: true, color: "8A94A1", fontFace: FONT } } }],
  slideNumber: { x: 12.2, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: "6B7480", align: "right", fontFace: FONT },
});

let n = 0;
const nm = () => `obj${++n}`;
const T = (s, text, o) => s.addText(text, { isTextBox: true, objectName: nm(), margin: 0, fontFace: FONT, color: K.text, ...o });
const card = (s, x, y, w, h, fill = K.card, line) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: line ? { color: line, width: 1.25 } : { type: "none" }, rectRadius: 0.12, objectName: nm() });
const pill = (s, x, y, w, text, color, h = 0.36) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color, transparency: 82 }, line: { color, width: 1 }, rectRadius: h / 2, objectName: nm() });
  T(s, text, { x, y, w, h, align: "center", valign: "middle", fontSize: h >= 0.45 ? 14 : 12, bold: true, color: ink(color) });
};
const ring = (s, x, y, d, label, color = K.blue, fs = 16) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color, transparency: 80 }, line: { color, width: 2 }, objectName: nm() });
  T(s, label, { x, y, w: d, h: d, align: "center", valign: "middle", fontSize: fs, bold: true, color: ink(color) });
};
const ph = (s, x, y, w, h, label) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: K.card2 }, line: { color: K.amber, width: 1.25, dashType: "dash" }, rectRadius: 0.1, objectName: nm() });
  T(s, label, { x: x + 0.2, y, w: w - 0.4, h, align: "center", valign: "middle", fontSize: 14, color: K.amber, italic: true });
};
const arrowR = (s, x, y, w = 0.35) => s.addShape(pres.shapes.RIGHT_ARROW, { x, y, w, h: 0.28, fill: { color: K.muted }, line: { type: "none" }, objectName: nm() });
const content = (sec, title) => { const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: sec }); s.addText(title, { placeholder: "title" }); return s; };

// ---------- Title ----------
pres.addSection({ title: "Pitch" });
{
  const s = pres.addSlide({ masterName: "COVER", sectionTitle: "Pitch" });
  // Large, faint wordmark behind the right side.
  T(s, "LGTM", { x: 5.2, y: 0.4, w: 7.9, h: 2.6, fontSize: 150, bold: true, color: K.blue, transparency: 86, align: "right", valign: "middle", fontFace: FONT_B, wrap: false });
  T(s, [{ text: "TEAM ", options: { color: K.muted, fontSize: 20, bold: true } }, { text: "LGTM", options: { color: K.cyan, fontSize: 40, bold: true, fontFace: FONT_B } }],
    { x: 0.8, y: 1.0, w: 6, h: 0.8, valign: "bottom", charSpacing: 2 });
  s.addText("FilsPay Handover", { placeholder: "title" });
  s.addText("Audit, fix and finish a Bahrain card-payments platform, with an AI harness", { placeholder: "body" });
  [["109", "findings confirmed"], ["88", "fixed, test-first"], ["22", "refund gaps closed"]].forEach(([v, l], i) => {
    const x = 0.8 + i * 3.4;
    card(s, x, 4.9, 3.1, 1.6, K.card);
    T(s, v, { x: x + 0.3, y: 5.0, w: 2.6, h: 0.85, fontSize: 44, bold: true, color: i === 1 ? K.cyan : K.text, fontFace: FONT_B });
    T(s, l, { x: x + 0.3, y: 5.85, w: 2.6, h: 0.45, fontSize: 15, color: K.muted });
  });
}

// ---------- Team ----------
{
  const s = content("Pitch", "Team LGTM");
  const people = [
    ["AN", "Akheel Nazim", ["Auditing", "Planted traps", "AI workflow design", "Fixes"]],
    ["AK", "Ahmed Khalaf", ["Fixes", "Commit history audit", "Deployment", "Load testing", "UI fixes"]],
  ];
  people.forEach(([ini, name, owned], i) => {
    const x = 0.6 + i * 6.15;
    const c = i ? K.cyanSoft : K.blue;
    card(s, x, 1.5, 5.95, 4.55);
    ring(s, x + 0.45, 1.9, 1.2, ini, c, 24);
    T(s, name, { x: x + 1.95, y: 2.05, w: 3.8, h: 0.55, fontSize: 26, bold: true, fontFace: FONT_B });
    T(s, "Owned", { x: x + 1.95, y: 2.6, w: 3.8, h: 0.4, fontSize: 14, color: K.muted });
    owned.forEach((o, j) => pill(s, x + 0.45 + (j % 2) * 2.6, 3.45 + Math.floor(j / 2) * 0.8, 2.45, o, c, 0.6));
  });
  T(s, "Plus Claude Code: Opus for fixes, Haiku for failing tests, Sonnet as reviewer", { x: 0.6, y: 6.3, w: 12, h: 0.45, fontSize: 15, italic: true, color: K.muted });
}

// ---------- Root cause ----------
{
  const s = content("Pitch", "Root cause: the rules lived on paper, not in the code");
  card(s, 0.6, 1.5, 12.1, 1.45, K.card, K.blue);
  T(s, "Integer fils, unique payouts and tenant checks were written in ADRs and postmortems, but nothing in the code or the database enforced them.",
    { x: 1.0, y: 1.5, w: 11.3, h: 1.45, valign: "middle", fontSize: 21 });
  const sym = [
    ["Money maths drifted", "TS and Go rewrote fils logic with floats, cents and int32", K.blue],
    ["\"Fixed\" races weren't", "Postmortems listed unique indexes and locks that never existed", K.cyanSoft],
    ["Checks on the route, not the query", "Any id from another merchant worked", K.red],
    ["Even the AI rules were planted", "CLAUDE.md said cents, UTC, \"don't fix refunds\"", K.amber],
  ];
  sym.forEach(([h, b, col], i) => {
    const x = 0.6 + i * 3.075;
    card(s, x, 3.3, 2.85, 3.3);
    ring(s, x + 0.3, 3.55, 0.65, String(i + 1), col);
    T(s, h, { x: x + 0.3, y: 4.4, w: 2.35, h: 0.9, fontSize: 17, bold: true });
    T(s, b, { x: x + 0.3, y: 5.3, w: 2.35, h: 1.1, fontSize: 14, color: K.muted });
  });
}

// ---------- Distribution ----------
{
  const s = content("Pitch", "Where the bugs were: 109 findings by class");
  const labels = ["Security", "Races", "Money", "Timing", "Scripts / UI", "Deploy", "Tests", "Refunds", "Deps / perf"];
  s.addChart(pres.charts.BAR, [
    { name: "Fixed", labels, values: [13, 8, 20, 5, 12, 5, 3, 22, 0] },
    { name: "Partly fixed", labels, values: [1, 0, 1, 0, 0, 0, 0, 0, 0] },
    { name: "Open", labels, values: [5, 1, 0, 0, 5, 1, 0, 0, 7] },
  ], { x: 0.6, y: 1.4, w: 8.4, h: 5.3, barDir: "bar", barGrouping: "stacked", chartColors: [K.blue, K.amber, K.red],
    showValue: true, dataLabelPosition: "ctr", dataLabelFormatCode: "#;;", dataLabelColor: "FFFFFF", dataLabelFontSize: 12, dataLabelFontFace: "+mn-lt",
    showLegend: true, legendPos: "b", legendFontSize: 13, legendFontFace: "+mn-lt", legendColor: K.muted,
    catAxisLabelFontSize: 14, catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: K.muted, catAxisOrientation: "maxMin", catAxisLineShow: false,
    valAxisLabelColor: K.muted, valAxisLabelFontFace: "+mn-lt", valAxisLabelFontSize: 11, valGridLine: { color: K.line, size: 0.5 }, catGridLine: { style: "none" }, objectName: nm() });
  [["88", "fixed", K.blue], ["2", "partly fixed", K.amber], ["19", "open, all recorded", K.red]].forEach(([v, l, c], i) => {
    const y = 1.5 + i * 1.75;
    card(s, 9.4, y, 3.3, 1.5);
    T(s, v, { x: 9.7, y: y + 0.12, w: 2.8, h: 0.8, fontSize: 40, bold: true, color: ink(c), fontFace: FONT_B });
    T(s, l, { x: 9.7, y: y + 0.92, w: 2.8, h: 0.45, fontSize: 15, color: K.muted });
  });
}

// ---------- Key findings ----------
{
  const s = content("Pitch", "Key findings, ranked by impact");
  const rows = [
    ["Money left twice", "Two refunds of 6,000 on a 10,000 capture both succeeded; a payment link charged two buyers", "F3 · R1", K.red],
    ["Login skipped the OTP", "The pre-OTP cookie worked on every route, reproduced on the running API", "S1 · S2", K.amber],
    ["Fils lost or invented", "CSV import booked 4.75 BD as 0.475 BD; volume counter wrapped and switched off the fee tier", "M1 · M6", K.blue],
    ["Refunds never worked", "Route answered 501 and every insert failed: 22 gaps behind \"just wire it\"", "F1–F22", K.cyanSoft],
  ];
  rows.forEach(([h, ev, id, col], i) => {
    const y = 1.5 + i * 1.32;
    card(s, 0.6, y, 12.1, 1.15);
    ring(s, 0.85, y + 0.25, 0.65, String(i + 1), col);
    T(s, h, { x: 1.8, y: y + 0.1, w: 3.4, h: 0.95, valign: "middle", fontSize: 19, bold: true });
    T(s, ev, { x: 5.2, y: y + 0.1, w: 5.8, h: 0.95, valign: "middle", fontSize: 15, color: K.muted });
    T(s, id, { x: 11.0, y: y + 0.1, w: 1.5, h: 0.95, valign: "middle", align: "right", fontSize: 14, bold: true, color: ink(col) });
  });
}

// ---------- Fixes and proof ----------
{
  const s = content("Pitch", "Fixes and proof: a failing test before every fix");
  const steps = ["Confirm in code", "Failing test", "Smallest fix", "Reviewer agent", "One commit"];
  steps.forEach((t, i) => {
    const x = 0.6 + i * 2.45;
    pill(s, x, 1.45, 2.05, t, i === 1 ? K.cyanSoft : K.blue, 0.6);
    if (i < steps.length - 1) arrowR(s, x + 2.08, 1.61, 0.32);
  });
  const hdr = (t) => ({ text: t, options: { bold: true, color: K.text, fill: { color: K.blue }, fontSize: 14 } });
  const r = (a, b, c) => [{ text: a, options: { bold: true, color: K.text } }, { text: b, options: { color: K.red } }, { text: c, options: { color: K.cyan, bold: true } }];
  s.addTable([
    [hdr("Fix"), hdr("Before"), hdr("After")],
    r("S1 pending session", "Reaches /auth/me", "Refused"),
    r("S4 expired link, old submittedAt", "200, charged", "410"),
    r("M1 CSV \"4.75\" BD", "475 fils", "4,750 fils"),
    r("F8 capture 10,000, refund 4,000", "Paid 9,750", "Paid 5,850"),
    r("Test suite baseline", "16 failing", "0 of those failing"),
  ], { x: 0.6, y: 2.45, w: 8.0, colW: [3.6, 2.2, 2.2], fontSize: 14, fontFace: FONT, fill: { color: K.card }, border: { type: "solid", pt: 0.75, color: K.line }, rowH: 0.55, valign: "middle", objectName: nm() });
  card(s, 9.0, 2.45, 3.7, 3.85);
  [["93", "fix test files"], ["12", "new migrations"], ["1", "commit per bug"]].forEach(([v, l], i) => {
    T(s, v, { x: 9.3, y: 2.65 + i * 1.2, w: 1.4, h: 0.85, fontSize: 36, bold: true, color: K.cyan, fontFace: FONT_B, valign: "middle" });
    T(s, l, { x: 10.7, y: 2.65 + i * 1.2, w: 1.9, h: 0.85, fontSize: 15, color: K.muted, valign: "middle" });
  });
  T(s, "Every entry: symptom, cause, fix, test, data effect in fix-docs/FIXLOG.md", { x: 0.6, y: 6.5, w: 12, h: 0.35, fontSize: 13, italic: true, color: K.muted });
}

// ---------- Live demo ----------
{
  const s = content("Pitch", "Live demo: a partial and a full refund, end to end");
  const flow = [["Captured", "389.030 BHD"], ["Partial refund", "100.000 BHD"], ["Full refund", "remaining 289.030 BHD"], ["Dashboard", "status refunded"], ["Reconciliation", "no gap"]];
  flow.forEach(([h, b], i) => {
    const x = 0.6 + i * 2.45;
    card(s, x, 1.45, 2.1, 1.4);
    T(s, h, { x: x + 0.1, y: 1.55, w: 1.9, h: 0.6, fontSize: 16, bold: true, align: "center", valign: "middle" });
    T(s, b, { x: x + 0.1, y: 2.15, w: 1.9, h: 0.55, fontSize: 13, color: K.cyan, align: "center", valign: "middle" });
    if (i < flow.length - 1) arrowR(s, x + 2.12, 2.01, 0.3);
  });
  // Backup screenshots, captured on the live deployment on 30 Oct (submission/LGTM_FilsPay_live_refund_flow.gif).
  const shots = [
    ["1-refund-drawer.jpg", "Drawer caps the refund at what's left: 389.030 BHD"],
    ["4-refunded.jpg", "100.000 then 289.030 BHD back: status refunded"],
    ["5-reconciliation.jpg", "Reconciliation after the refunds: no gap"],
  ];
  shots.forEach(([f, cap], i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 3.1, 3.9, 2.95);
    s.addImage({ path: path.join(__dirname, "demo", f), x: x + 0.1, y: 3.2, w: 3.7, h: 1.665, objectName: nm(), altText: cap });
    T(s, cap, { x: x + 0.2, y: 5.0, w: 3.5, h: 0.9, fontSize: 14, valign: "middle" });
  });
  T(s, "Recorded live on merchant.139-59-92-10.sslip.io (transaction delta-wholesale-txn-0021) · full recording: LGTM_FilsPay_live_refund_flow.gif", { x: 0.6, y: 6.3, w: 12.1, h: 0.45, fontSize: 13, color: K.muted });
  s.addNotes("Backup screenshots from the live site in case the live demo fails. Use a different captured payment for the live demo: txn-0021 is already fully refunded.");
}

// ---------- Under load ----------
// Numbers from loadtest/summary-*.json (see loadtest-chart.cjs); wording matches report section 3.
{
  const s = content("Pitch", "Under load");
  s.addImage({ path: path.join(__dirname, "architecture-dark-topology.png"), x: 0.6, y: 1.3, w: 12.1, h: 2.65, objectName: nm(), altText: "Architecture: Caddy is the only internet-facing service; merchant, admin and API sit behind it on loopback ports; settlement, reporting and migration are internal; PostgreSQL is external" });
  // Estimated vs measured
  card(s, 0.6, 4.2, 3.8, 2.45);
  T(s, "Simulated users", { x: 0.9, y: 4.35, w: 3.3, h: 0.4, fontSize: 15, bold: true, color: K.muted });
  T(s, "28", { x: 0.9, y: 4.85, w: 1.6, h: 0.8, fontSize: 40, bold: true, color: K.text, fontFace: FONT_B });
  T(s, "estimated (FP-209)", { x: 0.9, y: 5.7, w: 1.7, h: 0.6, fontSize: 13, color: K.muted, valign: "top" });
  T(s, "200", { x: 2.6, y: 4.85, w: 1.7, h: 0.8, fontSize: 40, bold: true, color: K.cyan, fontFace: FONT_B });
  T(s, "measured, 0 errors", { x: 2.6, y: 5.7, w: 1.7, h: 0.6, fontSize: 13, color: K.muted, valign: "top" });
  // Measured results
  card(s, 4.6, 4.2, 3.9, 2.45);
  T(s, "At 200 users (k6, live API)", { x: 4.9, y: 4.35, w: 3.4, h: 0.4, fontSize: 15, bold: true, color: K.muted });
  T(s, [
    { text: "123.4", options: { bold: true, color: K.cyan, fontSize: 22 } }, { text: " req/s", options: { color: K.muted, breakLine: true } },
    { text: "1.38 s", options: { bold: true, color: K.cyan, fontSize: 22 } }, { text: " p95 latency", options: { color: K.muted, breakLine: true } },
    { text: "0 of 19,610", options: { bold: true, color: K.green, fontSize: 22 } }, { text: " requests failed", options: { color: K.muted } },
  ], { x: 4.9, y: 4.8, w: 3.4, h: 1.75, fontSize: 15, valign: "top", paraSpaceAfter: 4 });
  // How it behaves
  card(s, 8.7, 4.2, 4.0, 2.45);
  T(s, [
    { text: "Bottleneck: ", options: { bold: true } }, { text: "the database; requests wait on unindexed scans (P2)", options: { color: K.muted, breakLine: true } },
    { text: "Overload: ", options: { bold: true } }, { text: "no rate limits yet, so load queues instead of failing", options: { color: K.muted, breakLine: true } },
    { text: "Recovery: ", options: { bold: true } }, { text: "back to ~204 ms at 10 users, no restarts", options: { color: K.muted } },
  ], { x: 9.0, y: 4.35, w: 3.5, h: 2.2, fontSize: 14, valign: "top", paraSpaceAfter: 8 });
}

// ---------- How we used AI: the cycle ----------
{
  const s = content("Pitch", "How we used AI: one cycle, every bug");
  T(s, "Claude Code ran inside a harness we built: skills, subagents, rules and memory that every session loads.", { x: 0.6, y: 1.3, w: 12.1, h: 0.5, fontSize: 16, color: K.muted });
  const cx = 6.665, cy = 4.35;
  const nodes = [
    ["Audit", "find and confirm the bug in code", cx - 1.6, 1.95, K.blue],
    ["Plan", "check ADRs, failing test first", cx + 2.6, cy - 0.5, K.cyanSoft],
    ["Fix", "smallest change, every caller", cx - 1.6, 5.75, K.blue],
    ["Review", "independent agent, then commit", cx - 5.8, cy - 0.5, K.cyanSoft],
  ];
  // Curved-corner connectors: elbow lines from one stage to the next, clockwise.
  const seg = (x1, y1, x2, y2, arrow) => s.addShape(pres.shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(Math.abs(x2 - x1), 0.001), h: Math.max(Math.abs(y2 - y1), 0.001),
    flipH: x2 < x1, flipV: y2 < y1, line: { color: K.muted, width: 2, endArrowType: arrow ? "triangle" : undefined }, objectName: nm() });
  // Audit -> Plan
  seg(cx + 1.6, 2.45, cx + 4.2, 2.45); seg(cx + 4.2, 2.45, cx + 4.2, cy - 0.5, true);
  // Plan -> Fix
  seg(cx + 4.2, cy + 0.5, cx + 4.2, 6.25); seg(cx + 4.2, 6.25, cx + 1.6, 6.25, true);
  // Fix -> Review
  seg(cx - 1.6, 6.25, cx - 4.2, 6.25); seg(cx - 4.2, 6.25, cx - 4.2, cy + 0.5, true);
  // Review -> Audit (next bug)
  seg(cx - 4.2, cy - 0.5, cx - 4.2, 2.45); seg(cx - 4.2, 2.45, cx - 1.6, 2.45, true);
  nodes.forEach(([h, b, x, y, c]) => {
    card(s, x, y, 3.2, 1.0, K.card, c);
    T(s, h, { x: x + 0.2, y: y + 0.08, w: 2.8, h: 0.45, fontSize: 20, bold: true, color: ink(c), fontFace: FONT_B });
    T(s, b, { x: x + 0.2, y: y + 0.52, w: 2.8, h: 0.4, fontSize: 13, color: K.muted });
  });
  s.addShape(pres.shapes.OVAL, { x: cx - 1.3, y: cy - 0.85, w: 2.6, h: 1.7, fill: { color: K.blue, transparency: 75 }, line: { color: K.cyan, width: 2 }, objectName: nm() });
  T(s, [{ text: "Harness", options: { bold: true, fontSize: 20, color: K.cyan, breakLine: true } }, { text: "skills · agents · memory", options: { fontSize: 12, color: K.text } }],
    { x: cx - 1.3, y: cy - 0.85, w: 2.6, h: 1.7, align: "center", valign: "middle" });
}

// ---------- Inside the harness ----------
{
  const s = content("Pitch", "Inside the harness");
  const tiles = [
    ["Floorplan", "Interactive map of every module, file and endpoint, used to understand the code"],
    ["Clean rules", "Deleted the planted CLAUDE.md, AGENTS.md and .cursorrules; ADRs are binding"],
    ["fix-and-build skill", "Test-first, smallest fix, check TS and Go callers, one commit per bug"],
    ["Right model per job", "Haiku writes failing tests, Opus fixes, Sonnet reviews every fix"],
    ["Shared memory in the repo", "fix-docs/memory: commit rules, decisions, pitfalls, so every session and teammate starts the same"],
    ["Git autonomy", "Branch per fix, pull, squash-merge, push; conflicts with a teammate recorded"],
  ];
  tiles.forEach(([h, b], i) => {
    const x = 0.6 + (i % 3) * 4.07, y = 1.45 + Math.floor(i / 3) * 1.75;
    card(s, x, y, 3.87, 1.55);
    T(s, h, { x: x + 0.25, y: y + 0.15, w: 3.4, h: 0.45, fontSize: 17, bold: true, color: i === 4 ? K.cyan : K.text, fontFace: FONT_B });
    T(s, b, { x: x + 0.25, y: y + 0.62, w: 3.4, h: 0.85, fontSize: 13, color: K.muted, valign: "top" });
  });
  card(s, 0.6, 5.15, 12.1, 1.45, K.card2, K.red);
  T(s, "When the AI was wrong", { x: 0.9, y: 5.27, w: 4, h: 0.4, fontSize: 15, bold: true, color: K.red });
  T(s, "Opus's first fix for split payouts (M3) could pay 4 fils on a 3-fil payout. The Sonnet reviewer built the five-way case that broke it; we switched to largest-remainder allocation and added the case as a test.",
    { x: 0.9, y: 5.67, w: 11.5, h: 0.85, fontSize: 14, valign: "top" });
}

// ---------- Decisions and open risks ----------
{
  const s = content("Pitch", "Decisions and open risks");
  const col = (x, head, colr, items) => {
    card(s, x, 1.45, 5.95, 4.7, K.card, colr);
    T(s, head, { x: x + 0.35, y: 1.65, w: 5.3, h: 0.5, fontSize: 19, bold: true, color: colr });
    T(s, items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })),
      { x: x + 0.35, y: 2.3, w: 5.3, h: 3.7, fontSize: 16, valign: "top", paraSpaceAfter: 12 });
  };
  col(0.6, "Chose not to change or run", K.cyanSoft, [
    "Kept ADR-0004: rejected the audit's M9 shortcut and fixed the settled-data path",
    "Never ran scripts/ one-offs against data",
    "Didn't overwrite payout estimates or past ledger entries without Finance (M19, M14, X14)",
    "Smallest fix first; the bigger fix is recorded per bug",
  ]);
  col(6.75, "Still open", K.red, [
    "S14 SSRF and S15 dev-mode compose: fix before real traffic",
    "Rotate the leaked acquirer secret (S11)",
    "March sweep production postings (X14)",
    "16 more recorded items, mostly dependencies and performance",
    "Demo shows OTP codes on the login screens: demo data only",
  ]);
}

// ---------- Thank you ----------
{
  const s = pres.addSlide({ masterName: "COVER", sectionTitle: "Pitch" });
  T(s, "LGTM", { x: 5.2, y: 0.4, w: 7.9, h: 2.6, fontSize: 150, bold: true, color: K.blue, transparency: 86, align: "right", valign: "middle", fontFace: FONT_B, wrap: false });
  s.addText("Thank you", { placeholder: "title" });
  s.addText([{ text: "Team ", options: { color: K.muted } }, { text: "LGTM", options: { color: K.cyan, bold: true } }, { text: " · Akheel Nazim · Ahmed Khalaf", options: { color: K.muted } }], { placeholder: "body" });
  const links = [["Merchant + checkout", "merchant.139-59-92-10.sslip.io"], ["Admin console", "admin.139-59-92-10.sslip.io"], ["API", "api.139-59-92-10.sslip.io"], ["Code", "github.com/akheelnazim/fils-pay"]];
  links.forEach(([l, u], i) => {
    const x = 0.8 + (i % 2) * 6.0, y = 4.85 + Math.floor(i / 2) * 0.85;
    card(s, x, y, 5.7, 0.7, K.card);
    T(s, l, { x: x + 0.25, y, w: 2.1, h: 0.7, fontSize: 14, color: K.muted, valign: "middle" });
    T(s, u, { x: x + 2.35, y, w: 3.25, h: 0.7, fontSize: 14, color: K.cyan, valign: "middle", bold: true });
  });
}

// ---------- Appendix ----------
pres.addSection({ title: "Appendix" });
{
  const s = pres.addSlide({ masterName: "COVER", sectionTitle: "Appendix" });
  s.addText("Appendix", { placeholder: "title" });
  s.addText("Not presented. Full detail in LGTM_FilsPay_Submission.pdf and fix-docs/FIXLOG.md", { placeholder: "body" });
}
// ---------- Live demo backup: every step ----------
{
  const s = content("Appendix", "Live demo backup: every step, on the deployed site");
  const steps = [
    ["1-refund-drawer.jpg", "1. Refund drawer: 389.030 BHD refundable"],
    ["2-partially-refunded.jpg", "2. Refund 100.000 BHD: partially_refunded"],
    ["3-drawer-remaining.jpg", "3. Drawer now caps it at 289.030 BHD"],
    ["4-refunded.jpg", "4. Blank amount refunds the rest: refunded"],
    ["5-reconciliation.jpg", "5. Reconciliation: gap 0.000 BHD"],
  ];
  steps.forEach(([f, cap], i) => {
    const row = i < 3 ? 0 : 1;
    const x = row === 0 ? 0.6 + i * 4.1 : 2.65 + (i - 3) * 4.1;
    const y = row === 0 ? 1.4 : 4.15;
    card(s, x, y, 3.9, 2.55);
    s.addImage({ path: path.join(__dirname, "demo", f), x: x + 0.1, y: y + 0.1, w: 3.7, h: 1.665, objectName: nm(), altText: cap });
    T(s, cap, { x: x + 0.2, y: y + 1.85, w: 3.5, h: 0.6, fontSize: 14, valign: "middle", color: i === 4 ? K.cyan : K.text });
  });
  s.addNotes("Recorded 30 Oct on merchant.139-59-92-10.sslip.io, transaction delta-wholesale-txn-0021. Present live first; come back here only if the live demo fails.");
}

{
  const s = content("Appendix", "Proof: tests, migrations, end-to-end refund");
  card(s, 0.6, 1.45, 5.95, 5.2);
  T(s, "Baseline: 16 tests failing before any fix", { x: 0.9, y: 1.6, w: 5.4, h: 0.5, fontSize: 17, bold: true });
  T(s, [
    { text: "11 refund tests: every insert failed (F14)", options: { bullet: true, breakLine: true } },
    { text: "1 webhook backoff test: exact assert on random jitter (Q1)", options: { bullet: true, breakLine: true } },
    { text: "4 reporting tests: polluted shared DB, consumer stalled (Q2, X6)", options: { bullet: true, breakLine: true } },
    { text: "End-to-end refund test: ledger balances, full fee reversed, signed webhooks, reconciliation gap 0", options: { bullet: true } },
  ], { x: 0.9, y: 2.2, w: 5.4, h: 3.0, fontSize: 15, valign: "top", paraSpaceAfter: 8, color: K.muted });
  card(s, 0.9, 5.25, 5.35, 1.2, K.card2, K.green);
  T(s, [{ text: "Now: 669 / 669 TypeScript tests pass", options: { bold: true, color: K.green, breakLine: true } },
    { text: "API 578 · money 40 · reporting 18 · web 12 · scripts 16 · Go 8/8 packages", options: { color: K.muted } }],
    { x: 1.1, y: 5.3, w: 5.0, h: 1.1, fontSize: 13, valign: "middle" });
  card(s, 6.75, 1.45, 5.95, 5.2);
  T(s, "12 new migrations (0073–0084)", { x: 7.05, y: 1.6, w: 5.4, h: 0.5, fontSize: 17, bold: true });
  T(s, "BIGINT money columns (M5, M6) · unique indexes against duplicates (R2, R3, R5) · reporting dead letters (X6) · ADR-0005 renumbering (D1) · integer scheme export (M16) · capture marker (R6) · refund columns, view and pending rows (F9, F15, F22)", { x: 7.05, y: 2.2, w: 5.4, h: 2.6, fontSize: 15, color: K.muted, valign: "top" });
}

// ---------- Appendix: load test chart ----------
{
  const s = content("Appendix", "Load test results");
  s.addImage({ path: path.join(__dirname, "loadtest-dark.png"), x: 1.7, y: 1.3, w: 9.95, h: 5.6, objectName: nm(), altText: "Load test: 200 peak users, 123.4 req/s, p95 1.38 s, 0 of 19,610 requests failed; latency by run and by endpoint" });
}

const out = process.env.DECK_OUT || path.join(__dirname, "..", "LGTM_FilsPay_Slides.pptx");
pres.writeFile({ fileName: out }).then(async () => { await applyTheme(out, THEME); console.log("wrote", out); });
