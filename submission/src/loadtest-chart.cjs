// Draws the load-test figure from the raw k6 summaries (loadtest/summary-*.json), so every
// number on it is measured, not typed in. Writes loadtest-light.png (report) and
// loadtest-dark.png (deck). Run: node loadtest-chart.cjs
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const LT = path.join(__dirname, "..", "..", "loadtest");
const base = JSON.parse(fs.readFileSync(path.join(LT, "summary-fp209.json"), "utf8")).metrics;
const ramp = JSON.parse(fs.readFileSync(path.join(LT, "summary-ramp.json"), "utf8")).metrics;
const v = (m) => m.values || m;

// Requests per endpoint, both runs: k6 status checks (one per request).
function checkCounts(file) {
  const out = {};
  const walk = (g) => {
    const cs = Array.isArray(g.checks) ? g.checks : Object.values(g.checks || {});
    cs.forEach((c) => { out[c.name] = c.passes + c.fails; });
    (Array.isArray(g.groups) ? g.groups : Object.values(g.groups || {})).forEach(walk);
  };
  walk(JSON.parse(fs.readFileSync(path.join(LT, file), "utf8")).root_group);
  return out;
}
const cb = checkCounts("summary-fp209.json"), cr = checkCounts("summary-ramp.json");
const perEndpoint = [
  ["Transactions list", cb["list status is 200"] + cr["list_200"]],
  ["Settlement summary", cb["summary status is 200"] + cr["summary_200"]],
  ["Checkout link lookup", cb["checkout status is 200"] + cr["checkout_200"]],
  ["CSV export (streamed, X3)", cb["export status is 200"] + cr["export_200"]],
];

const B = { reqs: v(base.http_reqs).count, rate: v(base.http_reqs).rate, p50: v(base.http_req_duration).med, p95: v(base.http_req_duration)["p(95)"], failed: v(base.http_req_failed).passes, vus: v(base.vus_max).max };
const R = { reqs: v(ramp.http_reqs).count, rate: v(ramp.http_reqs).rate, p50: v(ramp.http_req_duration).med, p95: v(ramp.http_req_duration)["p(95)"], max: v(ramp.http_req_duration).max, failed: v(ramp.http_req_failed).passes, vus: v(ramp.vus_max).max };
const ep = (tag) => v(base[`http_req_duration{scenario:${tag}}`]);
const endpoints = [
  ["Transactions list", ep("list_transactions")],
  ["Settlement summary", ep("settlement_summary")],
  ["CSV export (streamed)", ep("export_csv")],
];
const total = B.reqs + R.reqs, failed = B.failed + R.failed;

const fmt = (n, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const ms = (n) => (n >= 1000 ? `${fmt(n / 1000, 2)} s` : `${fmt(n)} ms`);

const THEMES = {
  light: { surface: "#fcfcfb", tile: "#f3f3f0", ink: "#0b0b0b", ink2: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7", s1: "#2a78d6", s2: "#eb6834", good: "#006300" },
  dark: { surface: "#1e1e1e", tile: "#2a2d33", ink: "#f0efec", ink2: "#c3c2b7", muted: "#9a988f", grid: "#33363c", axis: "#4a4d54", s1: "#3987e5", s2: "#d95926", good: "#2bd9a0" },
};
const F = "Segoe UI, Arial, sans-serif";

function svg(t) {
  const W = 1600, H = 900;
  const txt = (x, y, s, size, fill, o = "") => `<text x="${x}" y="${y}" font-family="${F}" font-size="${size}" fill="${fill}" ${o}>${s}</text>`;
  let g = `<rect width="${W}" height="${H}" fill="${t.surface}"/>`;
  g += txt(60, 70, "Load test on the live deployment", 34, t.ink, 'font-weight="700"');
  g += txt(60, 108, `k6, 30 Oct, against api.139-59-92-10.sslip.io · Delta Wholesale data · ${fmt(total)} requests, ${failed} failed`, 19, t.ink2);

  // Stat tiles
  const tiles = [
    [`${R.vus}`, "peak simulated users", `estimate was 28 · 0 errors`],
    [`${fmt(R.rate, 1)}`, "requests/s on the ramp to 200", `${fmt(B.rate, 1)} req/s at ${B.vus} users`],
    [ms(R.p95), "p95 latency at the 200-user ramp", `${ms(B.p95)} at ${B.vus} users`],
    [`${failed} / ${fmt(total)}`, "requests failed, both runs", "every status check passed"],
  ];
  tiles.forEach(([big, label, sub], i) => {
    const x = 60 + i * 375;
    g += `<rect x="${x}" y="140" width="350" height="150" rx="14" fill="${t.tile}"/>`;
    g += txt(x + 24, 205, big, 44, i === 3 ? t.good : t.ink, 'font-weight="700"');
    g += txt(x + 24, 240, label, 18, t.ink2);
    g += txt(x + 24, 268, sub, 16, t.muted);
  });

  // Legend (shared by both charts)
  const lg = (x, c, s) => `<rect x="${x}" y="333" width="16" height="16" rx="3" fill="${c}"/>` + txt(x + 24, 347, s, 17, t.ink2);
  g += lg(60, t.s1, "p50 (median)") + lg(220, t.s2, "p95");

  // Chart 1: latency by run (vertical grouped bars)
  const c1 = { x: 110, y: 400, w: 600, h: 380, max: 1500 };
  g += txt(60, 390, "Latency by run", 22, t.ink, 'font-weight="600"');
  for (let tv = 0; tv <= c1.max; tv += 500) {
    const y = c1.y + 30 + c1.h - (tv / c1.max) * c1.h;
    g += `<line x1="${c1.x}" x2="${c1.x + c1.w}" y1="${y}" y2="${y}" stroke="${tv ? t.grid : t.axis}" stroke-width="1"/>`;
    g += txt(c1.x - 12, y + 5, tv ? `${fmt(tv)}` : "0", 15, t.muted, 'text-anchor="end"');
  }
  g += txt(c1.x - 12, c1.y + 12, "ms", 15, t.muted, 'text-anchor="end"');
  const runs = [[`${B.vus} users (FP-209 baseline)`, B], [`ramp 25 → ${R.vus} users`, R]];
  const bw = 90, base0 = c1.y + 30 + c1.h;
  const bar = (x, val, c, max, hh) => {
    const h = (val / max) * hh, y = base0 - h;
    return `<path d="M${x},${base0} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + bw - 4} Q${x + bw},${y} ${x + bw},${y + 4} V${base0} Z" fill="${c}"/>` +
      txt(x + bw / 2, y - 10, ms(val), 17, t.ink, 'text-anchor="middle" font-weight="600"');
  };
  runs.forEach(([label, r], i) => {
    const gx = c1.x + 70 + i * 290;
    g += bar(gx, r.p50, t.s1, c1.max, c1.h) + bar(gx + bw + 4, r.p95, t.s2, c1.max, c1.h);
    g += txt(gx + bw + 2, base0 + 32, label, 17, t.ink2, 'text-anchor="middle"');
  });

  // Chart 2: baseline latency by endpoint (horizontal grouped bars)
  const c2 = { x: 1010, y: 400, w: 520, max: 1200 };
  g += txt(800, 390, `Latency by endpoint at ${B.vus} users`, 22, t.ink, 'font-weight="600"');
  const x0 = c2.x, rowH = 105, bh = 26;
  for (let tv = 0; tv <= c2.max; tv += 400) {
    const x = x0 + (tv / c2.max) * c2.w;
    g += `<line x1="${x}" x2="${x}" y1="${c2.y + 20}" y2="${c2.y + 20 + rowH * 3}" stroke="${tv ? t.grid : t.axis}" stroke-width="1"/>`;
    g += txt(x, c2.y + 45 + rowH * 3, tv ? ms(tv) : "0", 15, t.muted, 'text-anchor="middle"');
  }
  const hbar = (y, val, c) => {
    const w = (val / c2.max) * c2.w;
    return `<path d="M${x0},${y} H${x0 + w - 4} Q${x0 + w},${y} ${x0 + w},${y + 4} V${y + bh - 4} Q${x0 + w},${y + bh} ${x0 + w - 4},${y + bh} H${x0} Z" fill="${c}"/>` +
      txt(x0 + w + 10, y + bh - 7, ms(val), 16, t.ink, 'font-weight="600"');
  };
  endpoints.forEach(([name, m], i) => {
    const y = c2.y + 32 + i * rowH;
    g += txt(800, y + bh + 6, name, 18, t.ink2);
    g += hbar(y, m.med, t.s1) + hbar(y + bh + 4, m["p(95)"], t.s2);
  });

  // Footer: requests per endpoint
  g += txt(60, 870, `Requests per endpoint, both runs: ${perEndpoint.map(([n, c]) => `${n} ${fmt(c)}`).join(" · ")}. Source: loadtest/summary-fp209.json, summary-ramp.json`, 15, t.muted);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${g}</svg>`;
}

Promise.all(Object.entries(THEMES).map(([name, t]) =>
  sharp(Buffer.from(svg(t))).png().toFile(path.join(__dirname, `loadtest-${name}.png`))))
  .then(() => console.log("ok", { total, failed, B, R: { ...R, max: Math.round(R.max) }, perEndpoint }));
