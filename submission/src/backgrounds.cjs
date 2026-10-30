// Subtle abstract backgrounds for the deck (Tech Innovation dark): bg-cover.png and bg-content.png.
// Run: node backgrounds.cjs
const sharp = require("sharp");
const path = require("path");

const W = 1920, H = 1080, BG = "#1e1e1e", BLUE = "#3d8bff", CYAN = "#00d1ff";
const dots = (x0, y0, cols, rows, gap, op) => {
  let g = "";
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g += `<circle cx="${x0 + c * gap}" cy="${y0 + r * gap}" r="2.2" fill="${CYAN}" opacity="${op}"/>`;
  return g;
};
const ring = (cx, cy, r, color, op, w = 2) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${w}" opacity="${op}"/>`;
const blob = (cx, cy, r, color, op) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}"/>`;

// Content slides: very faint, kept to the edges so text areas stay clean.
const content = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter></defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <g filter="url(#b)">${blob(1880, 1110, 380, BLUE, 0.10)}${blob(-60, -80, 260, CYAN, 0.05)}</g>
  ${ring(1930, -40, 330, CYAN, 0.07)}${ring(1930, -40, 250, BLUE, 0.06)}
  ${ring(-120, 1180, 360, BLUE, 0.06)}
  ${dots(1640, 980, 7, 3, 26, 0.10)}
</svg>`;

// Cover / thank-you: a little more presence on the right, still behind everything.
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="80"/></filter></defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <g filter="url(#b)">${blob(1650, 380, 420, BLUE, 0.16)}${blob(1900, 900, 300, CYAN, 0.08)}</g>
  ${ring(1560, 420, 470, CYAN, 0.08)}${ring(1560, 420, 380, BLUE, 0.07)}${ring(1560, 420, 290, CYAN, 0.05)}
  ${dots(80, 60, 9, 3, 26, 0.10)}
</svg>`;

Promise.all([
  sharp(Buffer.from(content)).png().toFile(path.join(__dirname, "bg-content.png")),
  sharp(Buffer.from(cover)).png().toFile(path.join(__dirname, "bg-cover.png")),
  // The deck shows only the topology half of the architecture figure.
  sharp(path.join(__dirname, "architecture-dark.png")).extract({ left: 45, top: 140, width: 1510, height: 330 }).toFile(path.join(__dirname, "architecture-dark-topology.png")),
]).then(() => console.log("ok"));
