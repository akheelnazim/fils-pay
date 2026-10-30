// Renders the architecture diagram to submission/src/architecture.png.
const sharp = require("sharp");
const path = require("path");

const W = 1600, H = 900;
const box = (x, y, w, h, title, sub, fill, stroke, dash, tc = "#13232F", sc = "#3B4D5C") => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="3" ${dash ? 'stroke-dasharray="10 8"' : ""}/>
  <text x="${x + w / 2}" y="${y + h / 2 - 6}" text-anchor="middle" font-family="Arial" font-size="30" font-weight="bold" fill="${tc}">${title}</text>
  <text x="${x + w / 2}" y="${y + h / 2 + 30}" text-anchor="middle" font-family="Arial" font-size="22" fill="${sc}">${sub}</text>`;
const arrow = (x1, y1, x2, y2, label, lx, ly) => `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3B4D5C" stroke-width="3" marker-end="url(#a)"/>
  ${label ? `<text x="${lx}" y="${ly}" font-family="Arial" font-size="20" fill="#3B4D5C">${label}</text>` : ""}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs><marker id="a" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="#3B4D5C"/></marker></defs>
<rect width="${W}" height="${H}" fill="#FFFFFF"/>

<!-- internet zone -->
<rect x="20" y="20" width="${W - 40}" height="250" rx="18" fill="#FDF1EC" stroke="#C8553D" stroke-width="2"/>
<text x="44" y="58" font-family="Arial" font-size="24" font-weight="bold" fill="#C8553D">INTERNET-FACING  (HTTPS 443 via reverse proxy: *.139-59-92-10.sslip.io)</text>
${box(60, 90, 300, 150, "Buyers", "hosted checkout", "#FFFFFF", "#C8553D")}
${box(420, 90, 300, 150, "Merchants", "dashboard + API keys", "#FFFFFF", "#C8553D")}
${box(780, 90, 300, 150, "Staff", "admin console", "#FFFFFF", "#C8553D")}
${box(1140, 90, 400, 150, "Acquirer", "callbacks in, webhooks out", "#FFFFFF", "#C8553D")}

<!-- app zone -->
<text x="44" y="320" font-family="Arial" font-size="24" font-weight="bold" fill="#1F6F78">SERVICES</text>
${box(60, 340, 420, 140, "apps/web  :5173", "checkout + merchant dashboard", "#E6F2F3", "#1F6F78")}
${box(560, 340, 420, 140, "apps/api  :3000", "Fastify (TypeScript)", "#1F6F78", "#1F6F78", false, "#FFFFFF", "#D8ECEE")}
${box(1060, 340, 480, 140, "apps/admin  :5174", "ops console (React)", "#E6F2F3", "#1F6F78")}

<!-- internal zone -->
<rect x="20" y="540" width="${W - 40}" height="340" rx="18" fill="#F3F5F7" stroke="#8A99A6" stroke-width="2" stroke-dasharray="10 8"/>
<text x="44" y="578" font-family="Arial" font-size="24" font-weight="bold" fill="#5B6B78">INTERNAL ONLY (never published)</text>
${box(60, 610, 440, 150, "apps/settlement  :8091", "Go daemon: close, payouts, scheme file", "#FFFFFF", "#5B6B78")}
${box(580, 610, 440, 150, "PostgreSQL 16  :5432", "ledger, outbox, rollups", "#FFFFFF", "#5B6B78")}
${box(1100, 610, 440, 150, "apps/reporting", "outbox consumer (no port)", "#FFFFFF", "#5B6B78")}
<text x="60" y="830" font-family="Arial" font-size="20" fill="#5B6B78">Arrows: who calls whom. Ports are the compose / dev defaults. Public hosts: merchant., admin., api.139-59-92-10.sslip.io</text>

${arrow(210, 240, 240, 336)}
${arrow(570, 240, 380, 336)}
${arrow(930, 240, 1260, 336)}
${arrow(1340, 240, 880, 336, "", 0, 0)}
${arrow(480, 410, 556, 410)}
${arrow(1060, 410, 984, 410)}
${arrow(700, 480, 380, 606, "internal token", 330, 528)}
${arrow(770, 480, 790, 606)}
${arrow(500, 700, 576, 700)}
${arrow(1100, 690, 1024, 690)}
</svg>`;

// Dark variant for the Tech Innovation deck.
const darkMap = [["#FFFFFF", "#2A2D33"], ["#13232F", "#F2F4F7"], ["#3B4D5C", "#A7B0BC"], ["#FDF1EC", "#162238"], ["#C8553D", "#00D1FF"],
  ["#E6F2F3", "#1A2A44"], ["#1F6F78", "#3D8BFF"], ["#D8ECEE", "#CFE0FF"], ["#F3F5F7", "#24272C"], ["#8A99A6", "#5A6270"], ["#5B6B78", "#A7B0BC"]];
let dark = svg;
for (const [a, b] of darkMap) dark = dark.split(a).join(b);
dark = dark.replace('fill="#2A2D33">apps/api', 'fill="#FFFFFF">apps/api');
dark = dark.replace('<rect width="1600" height="900" fill="#2A2D33"/>', '<rect width="1600" height="900" fill="#1E1E1E"/>');
Promise.all([
  sharp(Buffer.from(svg)).png().toFile(path.join(__dirname, "architecture.png")),
  sharp(Buffer.from(dark)).png().toFile(path.join(__dirname, "architecture-dark.png")),
]).then(() => console.log("ok"));
