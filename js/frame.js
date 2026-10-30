// An ornate gilt picture frame painted on canvases, used as a CSS border-image (9-slice).
// Profile from the outer edge inward: dark lip, gilt torus, bead-and-reel, egg-and-dart cavetto,
// bright ogee, burnished fillet, and a shadowed sight edge. Corners carry acanthus rosettes;
// the top and bottom carry scallop-shell cartouches.

const T = 128; // slice size in canvas pixels

// warm old gold leaf, not bright brass
const SHADOW = [52, 26, 4], MID = [170, 112, 30], LIGHT = [232, 186, 92], HI = [255, 232, 168];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
function goldAt(k) { // k: 0 = deep shadow, 1 = highlight
  if (k < 0.5) return mix(SHADOW, MID, k * 2);
  if (k < 0.85) return mix(MID, LIGHT, (k - 0.5) / 0.35);
  return mix(LIGHT, HI, (k - 0.85) / 0.15);
}
// colour of the molding at depth d (0 = outer edge, T = picture edge)
function profile(d) {
  if (d < 5) return [26, 12, 4];
  if (d < 38) { const t = (d - 5) / 33; return goldAt(0.15 + 0.85 * Math.pow(Math.sin(t * Math.PI), 0.7) * (t < 0.4 ? 1 : 0.92)); }
  if (d < 41) return [40, 20, 4];
  if (d < 62) return mix([90, 60, 18], [120, 84, 26], (d - 41) / 21);
  if (d < 64) return [40, 20, 4];
  if (d < 94) return goldAt(0.18 + 0.45 * ((d - 64) / 30));
  if (d < 96) return [44, 22, 6];
  if (d < 114) { const t = (d - 96) / 18; return goldAt(0.3 + 0.7 * Math.sin(t * Math.PI * 0.9)); }
  if (d < 120) return [246, 212, 130];
  return mix([60, 30, 8], [12, 5, 2], (d - 120) / 8);
}

function ellipse(x, cx, cy, rx, ry, rot = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); }
function gildedFill(x, cx, cy, r) {
  const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, rgb(HI)); g.addColorStop(0.35, rgb(LIGHT)); g.addColorStop(0.75, rgb(MID)); g.addColorStop(1, rgb(SHADOW));
  return g;
}

// One straight run of molding, length T along x, depth T along y (outer edge at y = 0).
function drawEdge(x) {
  for (let d = 0; d < T; d++) { x.fillStyle = rgb(profile(d)); x.fillRect(0, d, T, 1); }
  // bead and reel
  for (let i = 0; i < 4; i++) {
    const cx = (i + 0.5) * (T / 4);
    ellipse(x, cx, 51.5, 11, 8); x.fillStyle = gildedFill(x, cx, 51.5, 11); x.fill();
    x.lineWidth = 1.5; x.strokeStyle = 'rgba(40,18,2,0.8)'; x.stroke();
    const rx = i * (T / 4);
    ellipse(x, rx, 51.5, 3, 6); x.fillStyle = gildedFill(x, rx, 51.5, 6); x.fill(); x.stroke();
  }
  // egg and dart
  for (let i = 0; i < 2; i++) {
    const cx = (i + 0.5) * (T / 2);
    ellipse(x, cx, 79, 21, 13); x.fillStyle = 'rgba(30,14,2,0.9)'; x.fill();
    ellipse(x, cx, 78, 17, 11); x.fillStyle = gildedFill(x, cx, 78, 17); x.fill();
    const dx = i * (T / 2);
    x.beginPath(); x.moveTo(dx - 4, 66); x.lineTo(dx + 4, 66); x.lineTo(dx, 92); x.closePath(); x.fillStyle = rgb(LIGHT); x.fill();
    x.strokeStyle = 'rgba(40,18,2,0.8)'; x.lineWidth = 1; x.stroke();
  }
  // fine ribbing on the torus
  x.strokeStyle = 'rgba(60,30,4,0.18)'; x.lineWidth = 1;
  for (let i = 0; i < T; i += 8) { x.beginPath(); x.moveTo(i, 8); x.lineTo(i + 6, 36); x.stroke(); }
}

// Acanthus leaf: a curved, lobed blade from (0,0) pointing up, length L.
function leaf(x, L, w) {
  x.beginPath(); x.moveTo(0, 0);
  x.bezierCurveTo(-w, -L * 0.25, -w * 0.9, -L * 0.6, -w * 0.25, -L * 0.82);
  x.quadraticCurveTo(-w * 0.45, -L * 0.92, 0, -L);
  x.quadraticCurveTo(w * 0.45, -L * 0.92, w * 0.25, -L * 0.82);
  x.bezierCurveTo(w * 0.9, -L * 0.6, w, -L * 0.25, 0, 0);
  x.closePath();
}

// A corner block: mitred molding plus a carved acanthus rosette with a ruby boss.
function drawCorner(x) {
  for (let d = 0; d < T; d++) { x.fillStyle = rgb(profile(d)); x.fillRect(d, d, T - d, 1); x.fillRect(d, d, 1, T - d); }
  const cx = T * 0.47, cy = T * 0.47, R = T * 0.44;
  x.save(); x.translate(cx, cy);
  ellipse(x, 0, 0, R * 0.92, R * 0.92); x.fillStyle = 'rgba(30,14,2,0.85)'; x.fill();
  for (let k = 0; k < 8; k++) {
    x.save(); x.rotate((k / 8) * Math.PI * 2 + Math.PI / 8);
    leaf(x, R, R * 0.32); x.fillStyle = gildedFill(x, 0, -R * 0.55, R * 0.6); x.fill();
    x.strokeStyle = 'rgba(40,18,2,0.9)'; x.lineWidth = 1.6; x.stroke();
    x.beginPath(); x.moveTo(0, -R * 0.1); x.lineTo(0, -R * 0.85); x.strokeStyle = 'rgba(70,36,4,0.6)'; x.lineWidth = 1.2; x.stroke(); // midrib
    x.restore();
  }
  for (let k = 0; k < 8; k++) { x.save(); x.rotate((k / 8) * Math.PI * 2); leaf(x, R * 0.62, R * 0.2); x.fillStyle = gildedFill(x, 0, -R * 0.3, R * 0.4); x.fill(); x.strokeStyle = 'rgba(40,18,2,0.8)'; x.lineWidth = 1.2; x.stroke(); x.restore(); }
  ellipse(x, 0, 0, R * 0.24, R * 0.24); x.fillStyle = gildedFill(x, 0, 0, R * 0.26); x.fill(); x.strokeStyle = '#2a1004'; x.lineWidth = 2; x.stroke();
  const gem = x.createRadialGradient(-R * 0.05, -R * 0.06, 1, 0, 0, R * 0.15);
  gem.addColorStop(0, '#ffb0b8'); gem.addColorStop(0.4, '#d01830'); gem.addColorStop(1, '#4a0410');
  ellipse(x, 0, 0, R * 0.14, R * 0.14); x.fillStyle = gem; x.fill();
  x.restore();
}

let cached = null;
export function frameImage() {
  if (cached) return cached;
  const c = document.createElement('canvas'); c.width = c.height = T * 3;
  const x = c.getContext('2d');
  const tile = document.createElement('canvas'); tile.width = tile.height = T;
  const tx = tile.getContext('2d'); drawEdge(tx);
  const corner = document.createElement('canvas'); corner.width = corner.height = T;
  drawCorner(corner.getContext('2d'));
  // place a slice rotated by `turns` quarter-turns into the 3x3 grid cell (col,row)
  const place = (img, col, row, turns) => {
    x.save(); x.translate(col * T + T / 2, row * T + T / 2); x.rotate((turns * Math.PI) / 2); x.drawImage(img, -T / 2, -T / 2); x.restore();
  };
  place(tile, 1, 0, 0); place(tile, 2, 1, 1); place(tile, 1, 2, 2); place(tile, 0, 1, 3);
  place(corner, 0, 0, 0); place(corner, 2, 0, 1); place(corner, 2, 2, 2); place(corner, 0, 2, 3);
  cached = { url: c.toDataURL(), slice: T };
  return cached;
}

// Scallop-shell cartouche with C-scrolls, crowning the top and bottom of the frame.
let shell = null;
export function cartoucheImage() {
  if (shell) return shell;
  const W = 520, H = 200, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const cx = W / 2, base = H * 0.86;
  // C-scrolls either side
  for (const s of [-1, 1]) {
    x.save(); x.translate(cx + s * 150, base - 40); x.scale(s, 1);
    x.lineCap = 'round';
    for (const [lw, col] of [[26, '#2a1004'], [20, null]]) {
      x.beginPath(); x.moveTo(-60, 30); x.bezierCurveTo(-10, 40, 60, 10, 70, -30); x.bezierCurveTo(78, -62, 40, -70, 30, -46); x.bezierCurveTo(24, -32, 40, -24, 48, -32);
      x.lineWidth = lw; x.strokeStyle = col || (() => { const g = x.createLinearGradient(0, -70, 0, 40); g.addColorStop(0, rgb(HI)); g.addColorStop(0.5, rgb(MID)); g.addColorStop(1, rgb(SHADOW)); return g; })(); x.stroke();
    }
    x.restore();
    // a trailing acanthus leaf off each scroll
    x.save(); x.translate(cx + s * 200, base - 4); x.rotate(s * 1.7); leaf(x, 70, 20); x.fillStyle = gildedFill(x, 0, -35, 40); x.fill(); x.strokeStyle = '#2a1004'; x.lineWidth = 2; x.stroke(); x.restore();
  }
  // the shell: radiating ribs fanning up from the hinge
  const R = 118, ribs = 11;
  x.save(); x.translate(cx, base);
  x.beginPath(); x.arc(0, 0, R + 6, Math.PI, 0); x.closePath(); x.fillStyle = '#2a1004'; x.fill();
  for (let i = 0; i < ribs; i++) {
    const a0 = Math.PI + (i / ribs) * Math.PI, a1 = Math.PI + ((i + 1) / ribs) * Math.PI, am = (a0 + a1) / 2;
    x.beginPath(); x.moveTo(0, 0);
    x.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
    x.quadraticCurveTo(Math.cos(am) * (R + 16), Math.sin(am) * (R + 16), Math.cos(a1) * R, Math.sin(a1) * R);
    x.closePath();
    const g = x.createLinearGradient(Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R);
    g.addColorStop(0, rgb(SHADOW)); g.addColorStop(0.45, rgb(HI)); g.addColorStop(1, rgb(MID));
    x.fillStyle = g; x.fill(); x.strokeStyle = 'rgba(40,18,2,0.85)'; x.lineWidth = 2; x.stroke();
  }
  // hinge boss with a ruby
  x.beginPath(); x.arc(0, -6, 30, 0, Math.PI * 2); x.fillStyle = gildedFill(x, 0, -6, 30); x.fill(); x.strokeStyle = '#2a1004'; x.lineWidth = 3; x.stroke();
  const gem = x.createRadialGradient(-5, -12, 2, 0, -6, 18); gem.addColorStop(0, '#ffb0b8'); gem.addColorStop(0.45, '#d01830'); gem.addColorStop(1, '#4a0410');
  x.beginPath(); x.arc(0, -6, 16, 0, Math.PI * 2); x.fillStyle = gem; x.fill();
  x.restore();
  shell = c.toDataURL();
  return shell;
}
