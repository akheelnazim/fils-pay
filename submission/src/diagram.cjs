// Draws the architecture & deployment figure: architecture.png (light, report) and
// architecture-dark.png (deck). Sources: ops/compose.server.yml, ops/Caddyfile, ops/DEPLOY.md,
// submission/architecture-deployment.md. Run: node diagram.cjs
const sharp = require("sharp");
const path = require("path");

const THEMES = {
  light: {
    bg: "#f3f6fb", panel: "#e9eff7", panelLine: "#c6d3e3", net: "#a9b9cc", card: "#ffffff", cardLine: "#d8e1ec",
    title: "#13263f", ink: "#13263f", sub: "#3f5268", label: "#3a5578", arrow: "#6b7a8d",
    amber: "#f2a516", blue: "#2f6fde", purple: "#7c3aed", teal: "#0f766e", purpleText: "#7a3fd0", tealText: "#0f766e",
    cmdBg: "#13263f", cmdHead: "#dbe5f1", cmd: "#ffffff", cmdNote: "#c3d0e0", foot: "#4a5d73",
  },
  dark: {
    bg: "#1e1e1e", panel: "#24272c", panelLine: "#3a3f47", net: "#4a5260", card: "#2a2d33", cardLine: "#3a3f47",
    title: "#ffffff", ink: "#f2f4f7", sub: "#a7b0bc", label: "#8fb3e8", arrow: "#8b95a3",
    amber: "#ffb020", blue: "#3d8bff", purple: "#9b6bff", teal: "#2bd9a0", purpleText: "#b69cff", tealText: "#2bd9a0",
    cmdBg: "#102a52", cmdHead: "#cfe0ff", cmd: "#ffffff", cmdNote: "#a9c2e8", foot: "#8b95a3",
  },
};
const F = "Arial, Helvetica, sans-serif";

function svg(t, W = 1600, H = 640) {
  const txt = (x, y, s, size, fill, o = "") => `<text x="${x}" y="${y}" font-family="${F}" font-size="${size}" fill="${fill}" ${o}>${s}</text>`;
  const card = (x, y, w, h, bar, title, lines) => {
    let g = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${t.card}" stroke="${t.cardLine}" stroke-width="1.5"/>`;
    g += `<rect x="${x}" y="${y}" width="4" height="${h}" fill="${bar}"/>`;
    g += txt(x + 13, y + 24, title, 17, t.ink, 'font-weight="700"');
    lines.forEach((l, i) => { g += txt(x + 13, y + 45 + i * 17, l, 12.5, t.sub); });
    return g;
  };
  const head = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${t.arrow}" stroke-width="3" marker-end="url(#a)"/>`;

  let g = `<defs><marker id="a" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${t.arrow}"/></marker></defs>`;
  g += `<rect width="${W}" height="${H}" fill="${t.bg}"/>`;
  g += txt(46, 58, "FilsPay | Architecture &amp; deployment", 32, t.title, 'font-weight="700"');
  g += txt(46, 86, "Server Compose configuration • public edge and internal services", 15, t.sub);

  // Topology panel
  g += `<rect x="36" y="103" width="1528" height="492" rx="14" fill="${t.panel}" stroke="${t.panelLine}" stroke-width="1.5"/>`;
  g += txt(53, 135, "DEPLOYMENT TOPOLOGY", 13, t.label, 'font-weight="700" letter-spacing="0.5"');
  g += card(55, 178, 185, 72, t.amber, "Internet", ["Browsers / clients", "HTTP :80 • HTTPS :443"]);
  g += head(240, 213, 281, 213);
  g += card(285, 173, 195, 82, t.amber, "Caddy proxy", [":80 redirects to HTTPS", ":443 terminates TLS"]);

  // Compose network
  g += `<rect x="500" y="160" width="740" height="302" rx="12" fill="none" stroke="${t.net}" stroke-width="1.5"/>`;
  g += txt(508, 152, "SERVER / DOCKER COMPOSE NETWORK", 13, t.label, 'font-weight="700" letter-spacing="0.5"');
  g += `<path d="M480,212 H497 V388" fill="none" stroke="${t.arrow}" stroke-width="3"/>`;
  g += head(497, 208, 531, 208) + head(497, 297, 531, 297) + head(497, 388, 531, 388);
  g += card(535, 175, 222, 67, t.blue, "Merchant + checkout", ["container :80 • loopback :5173"]);
  g += card(535, 265, 222, 67, t.blue, "Admin UI", ["container :80 • loopback :5174"]);
  g += card(535, 355, 222, 67, t.blue, "API", ["container :3000 • loopback :3000"]);
  g += `<path d="M757,388 H815 V208 H862" fill="none" stroke="${t.arrow}" stroke-width="3" marker-end="url(#a)"/>`;
  g += txt(770, 268, "API → settlement", 11, t.purpleText) + txt(770, 283, "token-protected", 11, t.purpleText);
  g += card(870, 175, 305, 67, t.purple, "Settlement daemon", ["internal HTTP :8091 • no host port"]);
  g += card(870, 265, 305, 67, t.purple, "Reporting worker", ["no HTTP port • consumes DB outbox"]);
  g += card(870, 355, 305, 67, t.purple, "Migration job", ["no HTTP port • runs once, then exits"]);
  g += head(1175, 298, 1291, 298) + txt(1195, 283, "Database", 11, t.tealText);
  g += card(1295, 255, 235, 87, t.teal, "Existing PostgreSQL", ["Outside Compose; host + port", "in DATABASE_URL (often 5432)"]);
  ["Caddy forwards HTTP inside Compose: merchant :80, admin :80, API :3000.",
    "Browser API calls use public HTTPS. Host app ports bind to loopback only.",
    "API, settlement, reporting and migration connect to the separately configured database."]
    .forEach((l, i) => { g += txt(540, 495 + i * 23, l, 13, t.label); });

  g += txt(45, 622, "Source: ops/compose.server.yml, ops/Caddyfile and ops/DEPLOY.md", 11, t.foot);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${g}</svg>`;
}

Promise.all([
  sharp(Buffer.from(svg(THEMES.light))).png().toFile(path.join(__dirname, "architecture.png")),
  sharp(Buffer.from(svg(THEMES.dark))).png().toFile(path.join(__dirname, "architecture-dark.png")),
]).then(() => console.log("ok"));
