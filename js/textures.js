// Procedural canvas textures for each dungeon theme: floors, walls and optional glow (emissive) maps.
// Everything is drawn tile-able by wrapping strokes around the edges. Cached per theme.
import * as THREE from 'three';
import { rand, randi, chance, pick } from './util.js';

const S = 256;
const cache = new Map();

function canvas() { const c = document.createElement('canvas'); c.width = c.height = S; return c; }
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function shade(hexColor, k) {
  const c = new THREE.Color(hexColor).multiplyScalar(k);
  return `rgb(${Math.min(255, c.r * 255) | 0},${Math.min(255, c.g * 255) | 0},${Math.min(255, c.b * 255) | 0})`;
}
// draw fn at (x,y) and its wrapped copies so the texture tiles seamlessly
function wrap(x, y, r, fn) {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    if (x + ox + r < 0 || x + ox - r > S || y + oy + r < 0 || y + oy - r > S) continue;
    fn(x + ox, y + oy);
  }
}
function speckle(g, n, colors, rMin = 0.5, rMax = 2, alpha = 0.35) {
  for (let i = 0; i < n; i++) {
    const x = rand(0, S), y = rand(0, S), r = rand(rMin, rMax);
    g.globalAlpha = alpha * rand(0.4, 1); g.fillStyle = pick(colors);
    wrap(x, y, r, (px, py) => { g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill(); });
  }
  g.globalAlpha = 1;
}
function blotches(g, n, colors, rMin, rMax, alpha) {
  for (let i = 0; i < n; i++) {
    const x = rand(0, S), y = rand(0, S), r = rand(rMin, rMax);
    const col = pick(colors);
    wrap(x, y, r, (px, py) => {
      const gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = alpha; g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  g.globalAlpha = 1;
}
function crack(g, x, y, len, color, width = 1.2) {
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round';
  let a = rand(0, Math.PI * 2);
  const pts = [[x, y]];
  for (let i = 0; i < len; i++) { a += rand(-0.7, 0.7); x += Math.cos(a) * rand(4, 9); y += Math.sin(a) * rand(4, 9); pts.push([x, y]); }
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy))); g.stroke();
  }
}
// grid of slabs with grout and bevel; `cells` per side
function slabs(g, cells, base, grout, varyK = 0.12, bevel = true) {
  const c = S / cells;
  g.fillStyle = grout; g.fillRect(0, 0, S, S);
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const k = 1 + rand(-varyK, varyK);
    g.fillStyle = shade(base, k);
    const inset = 3;
    g.fillRect(i * c + inset, j * c + inset, c - inset * 2, c - inset * 2);
    if (bevel) {
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(i * c + inset, j * c + inset, c - inset * 2, 3);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(i * c + inset, (j + 1) * c - inset - 3, c - inset * 2, 3);
    }
  }
}
function bricks(g, rows, perRow, base, mortar) {
  const h = S / rows, w = S / perRow;
  g.fillStyle = mortar; g.fillRect(0, 0, S, S);
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? w / 2 : 0;
    for (let i = -1; i < perRow + 1; i++) {
      const x = i * w + off;
      g.fillStyle = shade(base, 1 + rand(-0.15, 0.12));
      g.fillRect(x + 2, r * h + 2, w - 4, h - 4);
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + 2, r * h + 2, w - 4, 2);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 2, r * h + h - 4, w - 4, 2);
    }
  }
}

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

// Returns { floor, floorGlow?, wall, wallGlow? } textures for a theme.
export function themeTextures(theme) {
  if (cache.has(theme.id)) return cache.get(theme.id);
  const fC = canvas(), fg = fC.getContext('2d');
  const wC = canvas(), wg = wC.getContext('2d');
  let fGlowC = null, wGlowC = null;
  const glowCanvas = () => { const c = canvas(); const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, S, S); return c; };
  const F = theme.floor, Wl = theme.wall;

  switch (theme.id) {
    case 'crypt':
      slabs(fg, 2, F, shade(F, 0.45), 0.14);
      speckle(fg, 500, [shade(F, 0.6), shade(F, 1.3)], 0.4, 1.6);
      for (let i = 0; i < 5; i++) crack(fg, rand(0, S), rand(0, S), randi(3, 7), 'rgba(0,0,0,0.45)');
      blotches(fg, 6, ['rgba(70,110,50,1)'], 10, 26, 0.18);
      bricks(wg, 6, 3, Wl, shade(Wl, 0.4));
      speckle(wg, 400, [shade(Wl, 0.6), shade(Wl, 1.25)], 0.4, 1.5);
      blotches(wg, 5, ['rgba(60,100,40,1)'], 12, 30, 0.2);
      break;
    case 'caves':
      fg.fillStyle = hex(F); fg.fillRect(0, 0, S, S);
      blotches(fg, 40, [shade(F, 0.7), shade(F, 1.25), shade(F, 0.9)], 12, 40, 0.5);
      speckle(fg, 900, [shade(F, 0.5), shade(F, 1.4), '#2a2018'], 0.5, 2.4, 0.5);
      for (let i = 0; i < 30; i++) { const x = rand(0, S), y = rand(0, S), r = rand(2, 6); wrap(x, y, r, (px, py) => { fg.fillStyle = shade(F, rand(0.8, 1.4)); fg.beginPath(); fg.ellipse(px, py, r, r * 0.7, rand(0, 3), 0, 7); fg.fill(); fg.fillStyle = 'rgba(0,0,0,0.3)'; fg.beginPath(); fg.ellipse(px + 1, py + 1.5, r, r * 0.5, 0, 0, 7); fg.fill(); }); }
      wg.fillStyle = hex(Wl); wg.fillRect(0, 0, S, S);
      blotches(wg, 50, [shade(Wl, 0.6), shade(Wl, 1.3)], 10, 36, 0.55);
      for (let y = 0; y < S; y += randi(14, 26)) { wg.fillStyle = 'rgba(0,0,0,0.18)'; wg.fillRect(0, y, S, rand(2, 5)); }
      speckle(wg, 600, [shade(Wl, 0.5), shade(Wl, 1.4)], 0.5, 2);
      break;
    case 'nest':
      fg.fillStyle = hex(F); fg.fillRect(0, 0, S, S);
      blotches(fg, 40, [shade(F, 0.6), shade(F, 1.3), 'rgb(60,40,60)'], 10, 34, 0.5);
      speckle(fg, 500, [shade(F, 0.4), 'rgb(200,200,180)'], 0.4, 1.4, 0.3);
      fg.strokeStyle = 'rgba(220,220,210,0.22)'; fg.lineWidth = 0.8;
      for (let i = 0; i < 14; i++) { const x = rand(0, S), y = rand(0, S), r = rand(20, 60); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; fg.beginPath(); fg.moveTo(x, y); fg.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); fg.stroke(); } for (let q = 1; q < 4; q++) { fg.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2, rr = (r * q) / 4; k ? fg.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : fg.moveTo(x + rr, y); } fg.stroke(); } }
      wg.fillStyle = hex(Wl); wg.fillRect(0, 0, S, S);
      blotches(wg, 45, [shade(Wl, 0.5), shade(Wl, 1.3)], 10, 40, 0.55);
      speckle(wg, 500, [shade(Wl, 0.5), 'rgb(190,190,170)'], 0.4, 1.6, 0.25);
      break;
    case 'frozen':
      fg.fillStyle = hex(F); fg.fillRect(0, 0, S, S);
      blotches(fg, 30, ['rgb(200,230,255)', shade(F, 0.8), shade(F, 1.3)], 14, 50, 0.35);
      for (let i = 0; i < 14; i++) crack(fg, rand(0, S), rand(0, S), randi(4, 10), 'rgba(230,250,255,0.55)', 1);
      for (let i = 0; i < 8; i++) crack(fg, rand(0, S), rand(0, S), randi(3, 6), 'rgba(20,40,70,0.4)', 1.4);
      speckle(fg, 400, ['rgb(255,255,255)'], 0.4, 1.2, 0.5);
      wg.fillStyle = hex(Wl); wg.fillRect(0, 0, S, S);
      blotches(wg, 40, ['rgb(220,240,255)', shade(Wl, 0.7)], 14, 44, 0.45);
      for (let i = 0; i < 20; i++) { const x = rand(0, S); wg.fillStyle = 'rgba(255,255,255,0.18)'; wg.fillRect(x, 0, rand(1, 3), S); }
      for (let i = 0; i < 10; i++) crack(wg, rand(0, S), rand(0, S), randi(4, 9), 'rgba(40,70,110,0.4)', 1.2);
      break;
    case 'hell': {
      slabs(fg, 2, F, 'rgb(20,8,6)', 0.18, false);
      speckle(fg, 700, ['rgb(30,10,8)', shade(F, 1.4)], 0.5, 2, 0.45);
      fGlowC = glowCanvas(); const gg = fGlowC.getContext('2d');
      gg.shadowColor = '#ff6a10'; gg.shadowBlur = 6;
      for (let i = 0; i < 2; i++) { const x = rand(0, S), y = rand(0, S), n = randi(10, 16); crack(gg, x, y, n, 'rgb(255,110,25)', rand(1.4, 2.2)); }
      // grout seams glow faintly
      gg.shadowBlur = 0; gg.fillStyle = 'rgb(70,16,0)'; gg.fillRect(0, 0, S, 3); gg.fillRect(0, S / 2 - 2, S, 4); gg.fillRect(0, 0, 3, S); gg.fillRect(S / 2 - 2, 0, 4, S);
      bricks(wg, 6, 3, Wl, 'rgb(25,8,4)');
      speckle(wg, 500, ['rgb(20,6,4)', shade(Wl, 1.3)], 0.5, 2, 0.4);
      wGlowC = glowCanvas(); const wgg = wGlowC.getContext('2d');
      wgg.shadowColor = '#ff5010'; wgg.shadowBlur = 5;
      for (let i = 0; i < 4; i++) crack(wgg, rand(0, S), rand(0, S), randi(3, 6), 'rgb(255,90,20)', 1.6);
      break;
    }
    case 'storm': {
      slabs(fg, 2, F, 'rgb(25,28,40)', 0.06);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const x0 = i * 128, y0 = j * 128;
        fg.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let k = 0; k < 40; k++) { const y = y0 + 6 + rand(0, 116); fg.beginPath(); fg.moveTo(x0 + 6, y); fg.lineTo(x0 + 122, y); fg.stroke(); }
        for (const [rx, ry] of [[12, 12], [116, 12], [12, 116], [116, 116]]) { fg.fillStyle = 'rgb(150,160,190)'; fg.beginPath(); fg.arc(x0 + rx, y0 + ry, 3, 0, 7); fg.fill(); fg.fillStyle = 'rgba(0,0,0,0.5)'; fg.beginPath(); fg.arc(x0 + rx + 1, y0 + ry + 1, 2, 0, 7); fg.fill(); }
      }
      fGlowC = glowCanvas(); const gg = fGlowC.getContext('2d');
      gg.fillStyle = 'rgb(20,55,140)'; gg.fillRect(0, 0, S, 2); gg.fillRect(0, S / 2 - 1, S, 2); gg.fillRect(0, 0, 2, S); gg.fillRect(S / 2 - 1, 0, 2, S);
      slabs(wg, 4, Wl, 'rgb(20,22,34)', 0.08);
      for (let i = 0; i < 16; i++) { wg.fillStyle = 'rgba(160,170,200,0.6)'; wg.beginPath(); wg.arc((i % 4) * 64 + 8, Math.floor(i / 4) * 64 + 8, 2, 0, 7); wg.fill(); }
      wGlowC = glowCanvas(); const wgg = wGlowC.getContext('2d');
      wgg.fillStyle = 'rgb(60,140,255)'; for (let k = 0; k < 2; k++) wgg.fillRect(0, 60 + k * 128, S, 3);
      break;
    }
    case 'swamp':
      fg.fillStyle = hex(F); fg.fillRect(0, 0, S, S);
      blotches(fg, 40, [shade(F, 0.6), shade(F, 1.35), 'rgb(50,60,20)'], 12, 40, 0.5);
      blotches(fg, 6, ['rgb(20,40,25)'], 18, 34, 0.7);
      speckle(fg, 600, ['rgb(110,140,50)', shade(F, 0.5)], 0.5, 2.2, 0.4);
      wg.fillStyle = hex(Wl); wg.fillRect(0, 0, S, S);
      blotches(wg, 50, [shade(Wl, 0.6), shade(Wl, 1.3), 'rgb(70,100,30)'], 10, 36, 0.55);
      for (let i = 0; i < 40; i++) { const x = rand(0, S), y = rand(0, S); wg.strokeStyle = 'rgba(40,80,20,0.5)'; wg.lineWidth = 2; wg.beginPath(); wg.moveTo(x, y); wg.lineTo(x + rand(-4, 4), y + rand(10, 30)); wg.stroke(); }
      break;
    case 'abyss': {
      slabs(fg, 2, F, 'rgb(10,6,18)', 0.1);
      speckle(fg, 500, ['rgb(10,5,20)', shade(F, 1.5)], 0.5, 1.8, 0.4);
      fGlowC = glowCanvas(); const gg = fGlowC.getContext('2d');
      gg.strokeStyle = 'rgb(150,60,255)'; gg.lineWidth = 2; gg.shadowColor = '#a040ff'; gg.shadowBlur = 6;
      // a faint rune on one slab out of four
      const cx = 64 + 128 * randi(0, 1), cy = 64 + 128 * randi(0, 1);
      gg.beginPath(); gg.arc(cx, cy, 30, 0, 7); gg.stroke();
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2, b = ((k + 2) / 5) * Math.PI * 2; gg.beginPath(); gg.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); gg.lineTo(cx + Math.cos(b) * 30, cy + Math.sin(b) * 30); gg.stroke(); }
      gg.shadowBlur = 0; gg.fillStyle = 'rgb(26,8,48)'; gg.fillRect(0, 0, S, 3); gg.fillRect(0, S / 2 - 1, S, 3); gg.fillRect(0, 0, 3, S); gg.fillRect(S / 2 - 1, 0, 3, S);
      bricks(wg, 5, 2, Wl, 'rgb(12,6,22)');
      speckle(wg, 400, ['rgb(15,8,30)', shade(Wl, 1.4)], 0.5, 1.8);
      wGlowC = glowCanvas(); const wgg = wGlowC.getContext('2d');
      wgg.fillStyle = 'rgb(120,40,220)'; for (let i = 0; i < 6; i++) wgg.fillRect(rand(0, S), rand(0, S), 3, 3);
      break;
    }
    default:
      slabs(fg, 2, F, shade(F, 0.5)); bricks(wg, 6, 3, Wl, shade(Wl, 0.4));
  }
  const out = { floor: tex(fC), wall: tex(wC), floorGlow: fGlowC ? tex(fGlowC) : null, wallGlow: wGlowC ? tex(wGlowC) : null };
  cache.set(theme.id, out);
  return out;
}

// Soft round blob for character contact shadows.
let blobTex = null;
export function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (blobTex = new THREE.CanvasTexture(c));
}
