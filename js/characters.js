// Chibi characters with personality: big heads, big eyes, stubby limbs, silly props.
// Monsters are merged into three meshes (lit body, glowing bits, eyes) so they stay cheap;
// the eyes mesh pivots at eye height so it can blink. Heroes get a real rig for limb animation.
import * as THREE from 'three';
import { part, GEO as G, lambert, basic, mergeGroup, vcLambert, vcBasic } from './models.js';

const P = (geo, mat, sx, sy, sz, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = part(geo, mat, sx, sy, sz, x, y, z); m.rotation.set(rx, ry, rz); return m; };
const eyeTag = (m) => { m.userData.bucket = 'eyes'; return m; };
const dark = (c, k = 0.6) => new THREE.Color(c).multiplyScalar(k).getHex();
const BONE = 0xece2c8, WOOD = 0x7a5530, METAL = 0xb8bcc8, GOLD = 0xe8b840, PINK = 0xff8a9a, BLUSH = 0xff9aa8;

// ---------------- faces ----------------
// Cartoon eyes: white, pupil, highlight. glow = coloured iris with no white (spooky but cute).
function eyes(g, { y, z, sep, r = 0.09, pupil = 0x181818, glow = null, angry = false, worried = false, look = 0, brow = 0x2a2018, mismatch = false }) {
  for (const s of [-1, 1]) {
    const rr = mismatch && s > 0 ? r * 0.6 : r;
    if (glow) {
      g.add(eyeTag(P(G.sphere(), basic(0x0a0a0a), rr * 1.1, rr * 1.2, rr * 0.5, s * sep, y, z)));
      g.add(eyeTag(P(G.sphere(), basic(glow), rr * 0.55, rr * 0.6, rr * 0.4, s * sep, y, z + rr * 0.35)));
    } else {
      g.add(eyeTag(P(G.sphere(), basic(0xffffff), rr, rr * 1.15, rr * 0.6, s * sep, y, z)));
      g.add(eyeTag(P(G.sphere(), basic(pupil), rr * 0.55, rr * 0.62, rr * 0.4, s * sep + look, y - rr * 0.12, z + rr * 0.42)));
      g.add(eyeTag(P(G.sphere(), basic(0xffffff), rr * 0.2, rr * 0.2, rr * 0.15, s * sep + look - rr * 0.18, y + rr * 0.2, z + rr * 0.62)));
    }
    if (angry) g.add(P(G.box(), lambert(brow), rr * 1.7, rr * 0.38, rr * 0.3, s * sep, y + rr * 1.25, z + 0.01, 0, 0, s * 0.5));
    if (worried) g.add(P(G.box(), lambert(brow), rr * 1.5, rr * 0.3, rr * 0.3, s * sep, y + rr * 1.3, z + 0.01, 0, 0, -s * 0.45));
  }
}
const grin = (g, x, y, z, w, teeth = 2, fangs = false) => {
  g.add(P(G.box(), basic(0x3a0a10), w, w * 0.28, 0.04, x, y, z));
  for (let i = 0; i < teeth; i++) g.add(P(fangs ? G.cone() : G.box(), basic(0xffffff), w * 0.14, fangs ? -w * 0.22 : w * 0.16, 0.03, x + (i - (teeth - 1) / 2) * w * 0.32, y + w * 0.05, z + 0.02));
};
const cheeks = (g, y, z, sep, r = 0.05) => { for (const s of [-1, 1]) g.add(P(G.sphere(), lambert(BLUSH), r * 1.3, r * 0.8, r * 0.4, s * sep, y, z)); };

// ---------------- theme kits ----------------
// head: face style; weapon: what grunts carry; skin/cloth/accent palette.
export const KITS = {
  crypt:  { head: 'skull', skin: BONE, cloth: 0x4a3e5a, accent: 0x7a2a2a, weapon: 'sword' },
  caves:  { head: 'goblin', skin: 0x86b84a, cloth: 0x8a5a30, accent: 0xd8a040, weapon: 'club' },
  nest:   { head: 'spider', skin: 0x3a2e48, cloth: 0x5a4a6a, accent: 0xff4a6a, weapon: 'none', spider: true },
  frozen: { head: 'snow', skin: 0xf2f8ff, cloth: 0xd03a3a, accent: 0x2a6ac0, weapon: 'icicle' },
  hell:   { head: 'imp', skin: 0xd8402e, cloth: 0x3a1a14, accent: 0xffc030, weapon: 'fork' },
  storm:  { head: 'robot', skin: 0x9aa4b8, cloth: 0x5a6478, accent: 0x60d0ff, weapon: 'wrench' },
  swamp:  { head: 'zombie', skin: 0x8aaa6a, cloth: 0x5a4a3a, accent: 0x9a3a6a, weapon: 'bone' },
  abyss:  { head: 'cyclops', skin: 0x6a3a9a, cloth: 0x2a1a3a, accent: 0xff60ff, weapon: 'wand' },
};

function head(g, K, cx, cy, cz, r, mood = 'angry') {
  const skin = lambert(K.headSkin || K.skin);
  const angry = mood === 'angry', worried = mood === 'worried';
  switch (K.head) {
    case 'skull':
      g.add(P(G.sphere(), skin, r, r * 0.95, r * 0.95, cx, cy, cz));
      g.add(P(G.box(), skin, r * 1.1, r * 0.42, r * 0.9, cx, cy - r * 0.72, cz + r * 0.08));
      for (let i = 0; i < 4; i++) g.add(P(G.box(), basic(0x202020), 0.012, r * 0.28, 0.02, cx + (i - 1.5) * r * 0.26, cy - r * 0.72, cz + r * 0.54));
      g.add(P(G.oct(), basic(0x202020), r * 0.12, r * 0.16, 0.05, cx, cy - r * 0.25, cz + r * 0.9));
      eyes(g, { y: cy + r * 0.08, z: cz + r * 0.8, sep: r * 0.38, r: r * 0.26, glow: K.eye || 0x60d0ff });
      break;
    case 'goblin':
      g.add(P(G.sphere(), skin, r, r * 0.9, r * 0.95, cx, cy, cz));
      for (const s of [-1, 1]) g.add(P(G.cone(), skin, r * 0.28, r * 1.1, r * 0.12, cx + s * r * 1.15, cy + r * 0.2, cz - r * 0.1, 0, 0, -s * 1.25));
      g.add(P(G.sphere(), lambert(dark(K.skin, 0.85)), r * 0.24, r * 0.2, r * 0.32, cx, cy - r * 0.12, cz + r * 0.95));
      grin(g, cx, cy - r * 0.48, cz + r * 0.86, r * 0.75, 3);
      eyes(g, { y: cy + r * 0.22, z: cz + r * 0.78, sep: r * 0.38, r: r * 0.24, pupil: 0x3a2a00, angry });
      break;
    case 'spider':
      g.add(P(G.sphere(), skin, r, r * 0.95, r, cx, cy, cz));
      eyes(g, { y: cy + r * 0.2, z: cz + r * 0.78, sep: r * 0.32, r: r * 0.26, worried });
      for (const s of [-1, 1]) for (const k of [0, 1]) g.add(eyeTag(P(G.sphere(), basic(0xff3050), r * 0.08, r * 0.08, r * 0.05, cx + s * r * (0.2 + k * 0.32), cy + r * 0.62 - k * 0.08, cz + r * 0.72)));
      for (const s of [-1, 1]) g.add(P(G.cone(), basic(0xf0e8d0), r * 0.08, -r * 0.35, r * 0.08, cx + s * r * 0.18, cy - r * 0.55, cz + r * 0.75));
      g.add(P(G.cone(), lambert(dark(K.skin, 1.4)), r * 0.15, r * 0.4, r * 0.15, cx, cy + r * 1.05, cz, 0.3, 0, 0)); // tuft
      break;
    case 'snow':
      g.add(P(G.sphere(), skin, r, r, r, cx, cy, cz));
      for (const s of [-1, 1]) g.add(eyeTag(P(G.sphere(), basic(0x111111), r * 0.13, r * 0.14, r * 0.08, cx + s * r * 0.34, cy + r * 0.2, cz + r * 0.88)));
      g.add(P(G.cone(), lambert(0xff8a20), r * 0.13, r * 0.7, r * 0.13, cx, cy - r * 0.02, cz + r * 1.25, Math.PI / 2, 0, 0));
      for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; g.add(P(G.sphere(), basic(0x111111), r * 0.06, r * 0.06, r * 0.04, cx + Math.sin(a) * r * 0.5, cy - r * 0.42 - Math.cos(a * 2) * r * 0.05, cz + r * 0.86)); }
      g.add(P(G.cyl(), lambert(0x1a1a1a), r * 0.5, r * 0.55, r * 0.5, cx + r * 0.1, cy + r * 1.15, cz, 0, 0, -0.2), P(G.cyl(), lambert(0x1a1a1a), r * 0.75, r * 0.06, r * 0.75, cx + r * 0.05, cy + r * 0.88, cz, 0, 0, -0.2), P(G.cyl(), lambert(0xc03030), r * 0.52, r * 0.1, r * 0.52, cx + r * 0.08, cy + r * 0.98, cz, 0, 0, -0.2));
      if (angry) for (const s of [-1, 1]) g.add(P(G.box(), lambert(0x6a7a8a), r * 0.35, r * 0.08, r * 0.1, cx + s * r * 0.34, cy + r * 0.45, cz + r * 0.86, 0, 0, s * 0.4));
      break;
    case 'imp':
      g.add(P(G.sphere(), skin, r, r * 0.92, r * 0.95, cx, cy, cz));
      for (const s of [-1, 1]) {
        g.add(P(G.cone(), lambert(0x2a1a14), r * 0.18, r * 0.7, r * 0.18, cx + s * r * 0.55, cy + r * 0.85, cz, 0, 0, -s * 0.5));
        g.add(P(G.cone(), skin, r * 0.2, r * 0.6, r * 0.1, cx + s * r * 1.05, cy + r * 0.15, cz, 0, 0, -s * 1.3));
      }
      grin(g, cx, cy - r * 0.45, cz + r * 0.88, r * 0.8, 2, true);
      eyes(g, { y: cy + r * 0.2, z: cz + r * 0.8, sep: r * 0.36, r: r * 0.24, pupil: 0x401000, angry });
      break;
    case 'robot':
      g.add(P(G.box(), skin, r * 1.9, r * 1.6, r * 1.7, cx, cy, cz));
      g.add(eyeTag(P(G.box(), basic(K.accent), r * 1.5, r * 0.42, 0.04, cx, cy + r * 0.12, cz + r * 0.86)));
      for (const s of [-1, 1]) g.add(eyeTag(P(G.box(), basic(0xffffff), r * 0.2, r * 0.2, 0.03, cx + s * r * 0.4, cy + r * 0.16, cz + r * 0.89)));
      g.add(P(G.box(), basic(0x202838), r * 0.8, r * 0.14, 0.04, cx, cy - r * 0.45, cz + r * 0.86));
      g.add(P(G.cyl(), lambert(METAL), r * 0.05, r * 0.7, r * 0.05, cx, cy + r * 1.15, cz), P(G.sphere(), basic(0xff4040), r * 0.16, r * 0.16, r * 0.16, cx, cy + r * 1.55, cz));
      for (const s of [-1, 1]) g.add(P(G.cyl(), lambert(dark(K.skin, 0.7)), r * 0.22, r * 0.18, r * 0.22, cx + s * r * 1.0, cy, cz, 0, 0, Math.PI / 2));
      break;
    case 'zombie':
      g.add(P(G.sphere(), skin, r, r * 0.95, r * 0.95, cx, cy, cz));
      eyes(g, { y: cy + r * 0.18, z: cz + r * 0.8, sep: r * 0.38, r: r * 0.27, pupil: 0x203010, mismatch: true, look: 0.02 });
      for (let i = 0; i < 3; i++) g.add(P(G.box(), basic(0x2a2018), r * 0.06, r * 0.3, 0.03, cx - r * 0.55 + i * r * 0.12, cy + r * 0.6, cz + r * 0.62, 0, 0, Math.PI / 2 * (i % 2 ? 0.2 : -0.2)));
      g.add(P(G.box(), basic(0x3a0a10), r * 0.6, r * 0.16, 0.04, cx, cy - r * 0.45, cz + r * 0.86), P(G.box(), lambert(PINK), r * 0.2, r * 0.35, r * 0.06, cx + r * 0.15, cy - r * 0.62, cz + r * 0.9, 0.3, 0, 0));
      g.add(P(G.cone(), lambert(0x3a3a2a), r * 0.1, r * 0.5, r * 0.1, cx - r * 0.2, cy + r * 1.05, cz, 0, 0, 0.5), P(G.cone(), lambert(0x3a3a2a), r * 0.08, r * 0.4, r * 0.08, cx + r * 0.05, cy + r * 1.05, cz, 0, 0, -0.3));
      break;
    case 'cyclops':
      g.add(P(G.sphere(), skin, r, r, r, cx, cy, cz));
      g.add(eyeTag(P(G.sphere(), basic(0xffffff), r * 0.55, r * 0.6, r * 0.35, cx, cy + r * 0.12, cz + r * 0.72)));
      g.add(eyeTag(P(G.sphere(), basic(0xd040ff), r * 0.3, r * 0.34, r * 0.2, cx, cy + r * 0.05, cz + r * 0.98)));
      g.add(eyeTag(P(G.sphere(), basic(0x10001a), r * 0.15, r * 0.18, r * 0.1, cx, cy + r * 0.05, cz + r * 1.1)));
      g.add(eyeTag(P(G.sphere(), basic(0xffffff), r * 0.07, r * 0.07, r * 0.05, cx - r * 0.12, cy + r * 0.22, cz + r * 1.12)));
      if (angry) g.add(P(G.box(), lambert(dark(K.skin, 0.5)), r * 0.9, r * 0.12, r * 0.1, cx, cy + r * 0.78, cz + r * 0.72));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(P(G.cone(), lambert(dark(K.skin, 0.8)), r * 0.12, -r * 0.5, r * 0.12, cx + Math.cos(a) * r * 0.6, cy - r * 0.95, cz + Math.sin(a) * r * 0.6)); }
      for (const s of [-1, 1]) g.add(P(G.cone(), lambert(0xffd0ff), r * 0.1, r * 0.35, r * 0.1, cx + s * r * 0.5, cy + r * 0.9, cz, 0, 0, -s * 0.4));
      break;
  }
}

function weapon(g, kind, x, y, z, s = 1) {
  const w = new THREE.Group();
  switch (kind) {
    case 'sword': w.add(P(G.box(), lambert(METAL), 0.07, 0.6, 0.03, 0, 0.35, 0), P(G.box(), lambert(GOLD), 0.24, 0.05, 0.06, 0, 0.05, 0)); break;
    case 'club': w.add(P(G.cyl(), lambert(WOOD), 0.05, 0.6, 0.05, 0, 0.25, 0), P(G.sphere(), lambert(WOOD), 0.13, 0.2, 0.13, 0, 0.55, 0)); break;
    case 'icicle': w.add(P(G.cone(), basic(0xa0e8ff), 0.07, 0.7, 0.07, 0, 0.35, 0)); break;
    case 'fork': w.add(P(G.cyl(), lambert(0x2a1a14), 0.025, 0.8, 0.025, 0, 0.3, 0), ...[-1, 0, 1].map((k) => P(G.cone(), lambert(0x2a1a14), 0.03, 0.15, 0.03, k * 0.07, 0.75, 0))); break;
    case 'wrench': w.add(P(G.box(), lambert(METAL), 0.06, 0.55, 0.04, 0, 0.25, 0), P(G.cyl(), lambert(METAL), 0.1, 0.05, 0.1, 0, 0.55, 0, Math.PI / 2)); break;
    case 'bone': w.add(P(G.cyl(), lambert(BONE), 0.04, 0.5, 0.04, 0, 0.25, 0), P(G.sphere(), lambert(BONE), 0.07, 0.07, 0.07, 0.04, 0.5, 0), P(G.sphere(), lambert(BONE), 0.07, 0.07, 0.07, -0.04, 0.5, 0)); break;
    case 'wand': w.add(P(G.cyl(), lambert(0x2a1a3a), 0.025, 0.5, 0.025, 0, 0.2, 0), P(G.oct(), basic(0xff60ff), 0.08, 0.11, 0.08, 0, 0.5, 0)); break;
  }
  w.position.set(x, y, z); w.rotation.x = 0.5; w.scale.setScalar(s);
  g.add(w);
}

// ---------------- monster body plans ----------------
function biped(g, K, { archer = false, scale = 1 } = {}) {
  const skin = lambert(K.skin), cloth = lambert(K.cloth), shoe = lambert(dark(K.cloth, 0.5));
  for (const s of [-1, 1]) {
    g.add(P(G.cyl(), K.head === 'skull' ? skin : cloth, 0.07, 0.26, 0.07, s * 0.13, 0.2, 0));
    g.add(P(G.sphere(), shoe, 0.1, 0.07, 0.14, s * 0.13, 0.06, 0.04));
  }
  if (K.head === 'skull') { for (let i = 0; i < 3; i++) g.add(P(G.box(), skin, 0.36 - i * 0.04, 0.04, 0.2, 0, 0.45 + i * 0.09, 0)); g.add(P(G.cyl(), skin, 0.04, 0.32, 0.04, 0, 0.55, -0.05)); g.add(P(G.box(), cloth, 0.38, 0.14, 0.26, 0, 0.36, 0)); }
  else if (K.head === 'robot') g.add(P(G.box(), cloth, 0.46, 0.42, 0.34, 0, 0.55, 0), P(G.sphere(), basic(K.accent), 0.06, 0.06, 0.03, 0, 0.6, 0.18));
  else if (K.head === 'snow') g.add(P(G.sphere(), skin, 0.36, 0.33, 0.34, 0, 0.5, 0), P(G.sphere(), basic(0x111111), 0.035, 0.035, 0.02, 0, 0.6, 0.33), P(G.sphere(), basic(0x111111), 0.035, 0.035, 0.02, 0, 0.47, 0.34), P(new THREE.TorusGeometry(0.23, 0.06, 6, 12), lambert(K.cloth), 1, 1, 1, 0, 0.8, 0, Math.PI / 2), P(G.box(), lambert(K.cloth), 0.1, 0.3, 0.04, 0.15, 0.68, 0.2, 0, 0, 0.2));
  else { g.add(P(G.sphere(), cloth, 0.3, 0.3, 0.26, 0, 0.55, 0)); g.add(P(G.box(), lambert(dark(K.cloth, 0.6)), 0.5, 0.06, 0.4, 0, 0.45, 0)); }
  for (const s of [-1, 1]) g.add(P(G.cyl(), skin, 0.05, 0.28, 0.05, s * 0.33, 0.6, 0.04, 0.4, 0, s * 0.35), P(G.sphere(), skin, 0.075, 0.075, 0.075, s * 0.4, 0.47, 0.14));
  const headR = 0.34;
  head(g, K, 0, 1.06, 0.02, headR);
  if (K.head === 'skull') g.add(P(G.cyl(), lambert(0x7a7a80), 0.3, 0.12, 0.3, 0, 1.36, 0), P(G.cone(), lambert(0x7a7a80), 0.3, 0.2, 0.3, 0, 1.5, 0)); // rusty helmet
  if (K.head === 'imp') g.add(P(G.cyl(), lambert(K.skin), 0.025, 0.5, 0.025, 0, 0.42, -0.35, -1.0), P(G.cone(), lambert(K.skin), 0.07, 0.12, 0.03, 0, 0.6, -0.6, -1.0));
  if (archer) {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 4, 10, Math.PI), lambert(WOOD));
    bow.position.set(-0.42, 0.65, 0.2); bow.rotation.set(0, Math.PI / 2, Math.PI / 2); g.add(bow);
    g.add(P(G.cyl(), lambert(0x6a3a1a), 0.07, 0.4, 0.07, 0.12, 0.7, -0.25, 0.3), P(G.cone(), basic(0xffffff), 0.04, 0.1, 0.04, 0.14, 0.95, -0.17));
  } else weapon(g, K.weapon, 0.42, 0.48, 0.16);
  if (K.head === 'goblin') g.add(P(G.box(), lambert(K.accent), 0.12, 0.08, 0.04, 0.15, 0.58, 0.25, 0, 0, 0.3)); // patch
}

function caster(g, K) {
  const robe = lambert(K.cloth);
  g.add(P(G.cone(), robe, 0.42, 1.0, 0.42, 0, 0.5, 0), P(G.cyl(), lambert(K.accent), 0.3, 0.05, 0.3, 0, 0.3, 0));
  head(g, K, 0, 1.12, 0.02, 0.32, 'angry');
  // floppy pointy hat with stars
  const hy = K.head === 'robot' ? 1.48 : 1.38;
  g.add(P(G.cyl(), robe, 0.42, 0.04, 0.42, 0, hy, 0), P(G.cone(), robe, 0.28, 0.6, 0.28, 0.05, hy + 0.3, -0.03, -0.2, 0, -0.25), P(G.sphere(), basic(K.accent), 0.06, 0.06, 0.06, 0.2, hy + 0.58, -0.12));
  for (let i = 0; i < 3; i++) g.add(P(G.oct(), basic(0xffe060), 0.04, 0.04, 0.02, -0.1 + i * 0.1, hy + 0.12 + i * 0.12, 0.2 - i * 0.04));
  g.add(P(G.cyl(), lambert(WOOD), 0.03, 1.2, 0.03, 0.42, 0.65, 0.12), P(G.sphere(), basic(K.accent), 0.11, 0.11, 0.11, 0.42, 1.3, 0.12), P(G.sphere(), basic(K.accent, 0.3, true), 0.22, 0.22, 0.22, 0.42, 1.3, 0.12));
}

function brute(g, K, boss = false) {
  const skin = lambert(K.head === 'snow' ? 0xf4f8ff : K.skin), cloth = lambert(K.cloth);
  for (const s of [-1, 1]) g.add(P(G.cyl(), skin, 0.14, 0.4, 0.14, s * 0.32, 0.2, 0), P(G.sphere(), lambert(dark(K.cloth, 0.5)), 0.18, 0.1, 0.22, s * 0.32, 0.05, 0.06));
  g.add(P(G.sphere(), skin, 0.72, 0.66, 0.6, 0, 0.88, 0)); // big belly
  g.add(P(G.sphere(), lambert(dark(K.skin, 1.15)), 0.5, 0.42, 0.3, 0, 0.78, 0.34));
  g.add(P(G.box(), cloth, 1.0, 0.18, 0.66, 0, 0.42, 0));
  if (!boss) g.add(P(G.box(), lambert(0xe8c8a0), 0.22, 0.08, 0.03, 0.2, 1.0, 0.6, 0, 0, 0.6), P(G.box(), lambert(0xe8c8a0), 0.22, 0.08, 0.03, 0.2, 1.0, 0.6, 0, 0, -0.6)); // band-aid
  for (const s of [-1, 1]) g.add(P(G.cyl(), skin, 0.13, 0.5, 0.13, s * 0.78, 0.95, 0.1, 0.2, 0, s * 0.5), P(G.sphere(), skin, 0.3, 0.28, 0.3, s * 0.92, 0.6, 0.25)); // giant fists
  head(g, K, 0, 1.6, 0.12, 0.3, 'angry');
  if (K.head === 'snow') for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(P(G.cone(), lambert(0xffffff), 0.1, 0.3, 0.1, Math.cos(a) * 0.55, 1.2, Math.sin(a) * 0.45, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)); } // yeti fluff
  if (boss) {
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; g.add(P(G.cone(), lambert(GOLD, 0x403000), 0.07, 0.28, 0.07, Math.cos(a) * 0.26, 2.0, 0.12 + Math.sin(a) * 0.26)); }
    g.add(P(G.cyl(), lambert(GOLD, 0x403000), 0.3, 0.1, 0.3, 0, 1.88, 0.12), P(G.sphere(), basic(0xff3050), 0.06, 0.06, 0.04, 0, 1.9, 0.42));
    g.add(P(G.box(), lambert(K.accent), 1.3, 1.3, 0.06, 0, 0.95, -0.55, 0.12)); // cape
  }
}

function hound(g, K) {
  const skin = lambert(K.head === 'snow' ? 0xdfefff : K.skin), d = lambert(dark(K.skin, 0.75));
  if (K.head === 'robot') { // spark drone: hovering ball with a propeller
    g.add(P(G.sphere(), skin, 0.35, 0.3, 0.35, 0, 0.75, 0), P(G.cyl(), lambert(METAL), 0.03, 0.25, 0.03, 0, 1.1, 0), P(G.box(), lambert(METAL), 0.8, 0.03, 0.1, 0, 1.22, 0));
    g.add(eyeTag(P(G.sphere(), basic(K.accent), 0.14, 0.14, 0.08, 0, 0.78, 0.3)), eyeTag(P(G.sphere(), basic(0x10202a), 0.07, 0.07, 0.04, 0, 0.78, 0.37)));
    return;
  }
  g.add(P(G.sphere(), skin, 0.3, 0.27, 0.48, 0, 0.42, 0));
  for (const [x, z] of [[-0.15, 0.25], [0.15, 0.25], [-0.15, -0.25], [0.15, -0.25]]) g.add(P(G.cyl(), d, 0.06, 0.22, 0.06, x, 0.13, z), P(G.sphere(), d, 0.08, 0.05, 0.1, x, 0.03, z + 0.03));
  g.add(P(G.cyl(), skin, 0.04, 0.35, 0.04, 0, 0.6, -0.5, -0.8)); // perky tail
  g.add(P(G.sphere(), skin, 0.26, 0.24, 0.26, 0, 0.66, 0.42)); // head
  g.add(P(G.sphere(), lambert(dark(K.skin, 1.15)), 0.14, 0.11, 0.16, 0, 0.6, 0.65), P(G.sphere(), basic(0x111111), 0.05, 0.04, 0.04, 0, 0.64, 0.8));
  g.add(P(G.box(), lambert(PINK), 0.08, 0.02, 0.16, 0.04, 0.5, 0.72, 0.6)); // tongue out
  for (const s of [-1, 1]) g.add(P(G.sphere(), d, 0.07, 0.16, 0.05, s * 0.2, 0.8, 0.38, 0, 0, s * 0.6)); // floppy ears
  if (K.head === 'skull' || K.head === 'imp') for (const s of [-1, 1]) g.add(P(G.cone(), lambert(0x2a1a14), 0.04, 0.16, 0.04, s * 0.12, 0.92, 0.42));
  eyes(g, { y: 0.74, z: 0.6, sep: 0.1, r: 0.07, glow: K.head === 'skull' ? 0x60d0ff : null, angry: true });
}

function spider(g, K, big = false) {
  const skin = lambert(K.skin), d = lambert(dark(K.skin, 0.7));
  g.add(P(G.sphere(), skin, 0.42, 0.36, 0.48, 0, 0.5, -0.3)); // abdomen
  g.add(P(G.sphere(), lambert(K.accent), 0.15, 0.04, 0.18, 0, 0.84, -0.32)); // hourglass mark
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = 0.15 - i * 0.16, a = s * (0.7 + i * 0.1);
    g.add(P(G.cyl(), d, 0.03, 0.36, 0.03, s * 0.28, 0.42, z, 0, 0, a), P(G.cyl(), d, 0.03, 0.36, 0.03, s * 0.5, 0.18, z, 0, 0, -s * 0.35));
  }
  head(g, K, 0, 0.5, 0.18, 0.26, big ? 'angry' : 'worried');
}

function swarmer(g, K) {
  const skin = lambert(K.skin);
  g.add(P(G.sphere(), skin, 0.28, 0.24, 0.28, 0, 0.28, 0));
  for (const s of [-1, 1]) g.add(P(G.sphere(), lambert(dark(K.skin, 0.6)), 0.06, 0.04, 0.08, s * 0.12, 0.04, 0.05), P(G.cyl(), lambert(dark(K.skin, 0.7)), 0.015, 0.18, 0.015, s * 0.08, 0.55, 0, 0, 0, -s * 0.4), P(G.sphere(), basic(K.accent), 0.035, 0.035, 0.035, s * 0.12, 0.64, 0));
  eyes(g, { y: 0.32, z: 0.2, sep: 0.1, r: 0.09, look: 0.01 });
  grin(g, 0, 0.18, 0.26, 0.1, 1);
}

function bomber(g, K) {
  g.add(P(G.sphere(), lambert(K.skin), 0.45, 0.43, 0.45, 0, 0.55, 0));
  g.add(P(G.cyl(), lambert(0x2a2a2a), 0.1, 0.1, 0.1, 0, 1.0, 0), P(G.cyl(), lambert(0x6a5a3a), 0.02, 0.25, 0.02, 0.05, 1.13, 0, 0, 0, -0.4));
  g.add(P(G.sphere(), basic(0xffd040), 0.06, 0.06, 0.06, 0.1, 1.24, 0), P(G.sphere(), basic(0xff6020, 0.5, true), 0.12, 0.12, 0.12, 0.1, 1.24, 0));
  for (const s of [-1, 1]) g.add(P(G.sphere(), lambert(dark(K.skin, 0.6)), 0.08, 0.05, 0.11, s * 0.16, 0.06, 0.05));
  eyes(g, { y: 0.66, z: 0.38, sep: 0.15, r: 0.12, worried: true });
  cheeks(g, 0.52, 0.4, 0.27);
  g.add(P(G.box(), basic(0x3a0a10), 0.1, 0.04, 0.03, 0, 0.46, 0.44, 0, 0, 0.3)); // nervous wiggle mouth
}

function charger(g, K) {
  const skin = lambert(K.skin), d = lambert(dark(K.skin, 0.65));
  g.add(P(G.sphere(), skin, 0.45, 0.42, 0.6, 0, 0.6, -0.05));
  for (const [x, z] of [[-0.22, 0.3], [0.22, 0.3], [-0.22, -0.35], [0.22, -0.35]]) g.add(P(G.cyl(), d, 0.09, 0.35, 0.09, x, 0.18, z), P(G.box(), lambert(0x2a2a2a), 0.13, 0.07, 0.15, x, 0.03, z + 0.02));
  g.add(P(G.sphere(), skin, 0.36, 0.33, 0.33, 0, 0.82, 0.52)); // big head
  g.add(P(G.sphere(), lambert(dark(K.skin, 1.25)), 0.24, 0.16, 0.14, 0, 0.7, 0.8));
  for (const s of [-1, 1]) g.add(P(G.sphere(), basic(0x1a1a1a), 0.035, 0.03, 0.02, s * 0.08, 0.72, 0.93), P(G.cone(), lambert(0xf0e6cc), 0.07, 0.4, 0.07, s * 0.36, 1.05, 0.5, 0, 0, -s * 0.9));
  g.add(P(new THREE.TorusGeometry(0.07, 0.018, 6, 10), lambert(GOLD), 1, 1, 1, 0, 0.6, 0.9)); // nose ring
  g.add(P(G.cyl(), skin, 0.03, 0.3, 0.03, 0, 0.75, -0.65, -0.6), P(G.sphere(), d, 0.06, 0.08, 0.06, 0, 0.88, -0.78));
  eyes(g, { y: 0.92, z: 0.75, sep: 0.15, r: 0.08, angry: true });
}

// ---------------- merged monster models ----------------
const cache = new Map();
function merged(key, build) {
  if (!cache.has(key)) {
    const g = new THREE.Group(); build(g);
    const geos = mergeGroup(g);
    if (geos.eyes) { geos.eyes.computeBoundingBox(); const bb = geos.eyes.boundingBox; geos.eyeY = (bb.min.y + bb.max.y) / 2; geos.eyes.translate(0, -geos.eyeY, 0); }
    cache.set(key, geos);
  }
  const geos = cache.get(key);
  // a visual-only size bump so faces read at gameplay camera distance (collision radii unchanged)
  const root = new THREE.Group(), wrap = new THREE.Group(), body = new THREE.Group();
  wrap.scale.setScalar(1.12); root.add(wrap); wrap.add(body);
  if (geos.lit) body.add(new THREE.Mesh(geos.lit, vcLambert));
  if (geos.unlit) body.add(new THREE.Mesh(geos.unlit, vcBasic));
  let eyesMesh = null;
  if (geos.eyes) { eyesMesh = new THREE.Mesh(geos.eyes, vcBasic); eyesMesh.position.y = geos.eyeY; body.add(eyesMesh); }
  root.userData = { body, eyes: eyesMesh, blinkT: Math.random() * 3 };
  return root;
}

// Chimeras for the title screen's grottesca: one monster's body wearing another's head.
// body: biped | caster | brute | hound | spider | swarmer | bomber | charger
export function buildChimera(body, bodyKit, headKit, mood = 'angry') {
  const B = KITS[bodyKit], H = KITS[headKit];
  const K = { ...B, head: H.head, headSkin: H.skin, accent: H.accent };
  return merged(`chim_${body}_${bodyKit}_${headKit}`, (g) => {
    switch (body) {
      case 'caster': return caster(g, K);
      case 'brute': return brute(g, K);
      case 'hound': return hound(g, K);
      case 'spider': return spider(g, K, mood === 'angry');
      case 'swarmer': return swarmer(g, K);
      case 'bomber': return bomber(g, K);
      case 'charger': return charger(g, K);
      default: return biped(g, K);
    }
  });
}
// A lone grotesque mask (mascaron), merged for the title screen.
export function buildMask(headKit, r = 1) {
  const K = KITS[headKit];
  return merged(`mask_${headKit}_${r}`, (g) => head(g, K, 0, 0, 0, r, 'angry'));
}

export function buildMonster(arch, theme, boss = false) {
  const K = KITS[theme.id] || KITS.crypt;
  return merged(`mon_${arch}_${theme.id}_${boss}`, (g) => {
    if (boss) return brute(g, K, true);
    if (K.spider && ['grunt', 'runner', 'brute', 'charger', 'archer'].includes(arch)) return spider(g, K, arch === 'brute' || arch === 'charger');
    switch (arch) {
      case 'runner': return hound(g, K);
      case 'archer': return biped(g, K, { archer: true });
      case 'caster': return caster(g, K);
      case 'brute': return brute(g, K);
      case 'swarmer': return K.spider ? spider(g, K) : swarmer(g, K);
      case 'bomber': return bomber(g, K);
      case 'charger': return charger(g, K);
      default: return biped(g, K);
    }
  });
}

export function buildMinion(kind) {
  return merged('minion_' + kind, (g) => {
    if (kind === 'wolf') return hound(g, { head: 'wolf', skin: 0x9a9aa4, cloth: 0x5a5a66, accent: 0x80ffff });
    if (kind === 'imp') {
      const K = { ...KITS.hell, skin: 0xff9a30 }; // orange, so it never matches the Infernal Forge's red imps
      g.add(P(G.sphere(), lambert(K.skin), 0.22, 0.24, 0.2, 0, 0.75, 0));
      for (const s of [-1, 1]) g.add(P(G.box(), lambert(0x8a1a10), 0.35, 0.22, 0.02, s * 0.28, 0.9, -0.12, 0, s * 0.5, s * 0.3));
      head(g, K, 0, 1.08, 0.02, 0.22, 'happy');
      cheeks(g, 1.02, 0.2, 0.14, 0.035);
      weapon(g, 'fork', 0.25, 0.65, 0.1, 0.6);
      return;
    }
    // skeleton pal, dressed up with a bow tie
    // spectral green bones and eyes so your skeletons never look like the crypt's
    const K = { ...KITS.crypt, head: 'skull', skin: 0x9cf0c0, cloth: 0x1f6a44, eye: 0x50ff90 };
    biped(g, K);
    g.add(P(G.box(), lambert(0xd02040), 0.12, 0.07, 0.05, -0.05, 0.8, 0.2, 0, 0, 0.5), P(G.box(), lambert(0xd02040), 0.12, 0.07, 0.05, 0.05, 0.8, 0.2, 0, 0, -0.5), P(G.sphere(), lambert(0xd02040), 0.03, 0.03, 0.03, 0, 0.8, 0.22));
  });
}

// ---------------- heroes ----------------
// Rig: body (bob/squash) > torso & head, eyes (blink), arms/legs (pivots), cape, floaty accessory.
const HAIR = { human: 0x5a3a20, elf: 0xf0d878, dwarf: 0xc0602a, halfling: 0x6a4020, gnome: 0xf0f0f0, tiefling: 0x2a1a2a, undead: 0x8a8a7a, celestial: 0xfff0c0, vampire: 0x1a1a22, fae: 0x9a70ff, orc: 0x2a2a1a, goblin: 0x2a3a1a };

export function buildHero(race, cls) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const skin = lambert(race.skin), cloth = lambert(cls.color), clothD = lambert(dark(cls.color, 0.6)), shoe = lambert(0x3a2a1a);
  const hair = HAIR[race.id];
  const HY = 1.12, HR = 0.36; // head centre / radius

  // legs
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.13, 0.36, 0);
    pivot.add(P(G.cyl(), clothD, 0.075, 0.28, 0.075, 0, -0.14, 0), P(G.sphere(), shoe, 0.1 * (race.id === 'halfling' ? 1.5 : 1), 0.07, 0.15 * (race.id === 'halfling' ? 1.5 : 1), 0, -0.3, 0.04));
    body.add(pivot); return pivot;
  });
  // torso
  body.add(P(G.sphere(), cloth, 0.3, 0.32, 0.25, 0, 0.6, 0), P(G.box(), lambert(0x3a2a1a), 0.5, 0.07, 0.42, 0, 0.47, 0), P(G.box(), lambert(GOLD), 0.08, 0.07, 0.03, 0, 0.47, 0.21));
  // arms
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.3, 0.78, 0);
    pivot.add(P(G.cyl(), cloth, 0.06, 0.26, 0.06, 0, -0.13, 0), P(G.sphere(), skin, 0.08, 0.08, 0.08, 0, -0.28, 0));
    const hand = new THREE.Group(); hand.position.set(0, -0.28, 0.02); pivot.add(hand);
    pivot.userData.hand = hand;
    pivot.rotation.z = s * 0.15;
    body.add(pivot); return pivot;
  });
  // head and face
  const headG = new THREE.Group(); body.add(headG);
  headG.add(P(G.sphere(), skin, HR, HR * 0.95, HR * 0.95, 0, HY, 0));
  const eyesG = new THREE.Group(); eyesG.position.y = HY + 0.03; body.add(eyesG);
  const glowEyes = race.id === 'undead' ? 0x80ff80 : race.id === 'celestial' ? 0xffe8a0 : cls.id === 'warlock' ? 0xc060ff : null;
  eyes(eyesG, { y: 0, z: HR * 0.82, sep: 0.13, r: 0.085, glow: glowEyes, pupil: 0x1a1410 });
  cheeks(headG, HY - 0.08, HR * 0.84, 0.21);
  headG.add(P(new THREE.TorusGeometry(0.06, 0.014, 4, 10, Math.PI), basic(0x3a1a14), 1, 1, 1, 0, HY - 0.13, HR * 0.9, 0, 0, Math.PI)); // smile
  // race features
  const f = (m) => headG.add(m);
  switch (race.id) {
    case 'elf': case 'fae': for (const s of [-1, 1]) f(P(G.cone(), skin, 0.06, 0.32, 0.04, s * 0.38, HY + 0.08, -0.02, 0, 0, -s * 1.2)); break;
    case 'goblin': for (const s of [-1, 1]) f(P(G.cone(), skin, 0.1, 0.42, 0.04, s * 0.44, HY + 0.05, -0.02, 0, 0, -s * 1.35)); f(P(G.cone(), skin, 0.06, 0.2, 0.06, 0, HY - 0.02, HR + 0.08, Math.PI / 2)); break;
    case 'dwarf': f(P(G.sphere(), lambert(hair), 0.3, 0.32, 0.2, 0, HY - 0.28, 0.16)); f(P(G.cone(), lambert(hair), 0.16, 0.3, 0.12, 0, HY - 0.55, 0.2, Math.PI)); f(P(G.sphere(), lambert(0xe0907a), 0.07, 0.06, 0.07, 0, HY - 0.03, HR + 0.02)); break;
    case 'gnome': f(P(G.sphere(), lambert(0xf09a8a), 0.1, 0.09, 0.1, 0, HY - 0.04, HR + 0.03)); f(P(G.sphere(), lambert(0xf4f4f4), 0.22, 0.16, 0.14, 0, HY - 0.25, 0.2)); break;
    case 'orc': for (const s of [-1, 1]) f(P(G.cone(), lambert(0xf8f0d8), 0.035, 0.12, 0.035, s * 0.1, HY - 0.12, HR * 0.86)); f(P(G.box(), lambert(dark(race.skin, 0.7)), 0.4, 0.06, 0.1, 0, HY + 0.13, HR * 0.78)); break;
    case 'tiefling': for (const s of [-1, 1]) f(P(G.cone(), lambert(0x2a1a2a), 0.07, 0.34, 0.07, s * 0.22, HY + 0.36, 0, -0.3, 0, -s * 0.6)); body.add(P(G.cyl(), skin, 0.025, 0.45, 0.025, 0, 0.42, -0.32, -1.1), P(G.cone(), skin, 0.07, 0.12, 0.03, 0, 0.55, -0.58, -1.1)); break;
    case 'dragonborn': case 'lizard': f(P(G.sphere(), skin, 0.2, 0.15, 0.24, 0, HY - 0.08, HR * 0.72)); for (let i = 0; i < 3; i++) f(P(G.cone(), lambert(dark(race.skin, 0.7)), 0.05, 0.16, 0.05, 0, HY + 0.32 - i * 0.05, -0.08 - i * 0.12, -0.6)); body.add(P(G.cone(), skin, 0.12, 0.55, 0.12, 0, 0.35, -0.38, -1.8)); break;
    case 'minotaur': f(P(G.sphere(), lambert(0xc0a080), 0.2, 0.14, 0.15, 0, HY - 0.1, HR * 0.8)); for (const s of [-1, 1]) f(P(G.cone(), lambert(0xf0e6cc), 0.07, 0.36, 0.07, s * 0.36, HY + 0.2, 0, 0, 0, -s * 1.1)); f(P(new THREE.TorusGeometry(0.05, 0.014, 6, 10), lambert(GOLD), 1, 1, 1, 0, HY - 0.15, HR + 0.03)); break;
    case 'undead': for (let i = 0; i < 3; i++) f(P(G.box(), basic(0x2a2a20), 0.012, 0.08, 0.02, -0.2 + i * 0.05, HY + 0.18, HR * 0.86, 0, 0, Math.PI / 2)); break;
    case 'golem': f(P(G.box(), skin, HR * 1.7, HR * 1.6, HR * 1.6, 0, HY, 0)); f(P(G.sphere(), lambert(0x5a8a3a), 0.14, 0.06, 0.12, 0.1, HY + HR * 0.82, 0)); break;
    case 'vampire': for (const s of [-1, 1]) f(P(G.cone(), basic(0xffffff), 0.02, -0.06, 0.02, s * 0.04, HY - 0.16, HR * 0.9)); body.add(P(G.box(), lambert(0x8a1020), 0.6, 0.35, 0.05, 0, 0.98, -0.18, -0.3)); break;
  }
  if (hair && !['dwarf', 'gnome'].includes(race.id)) for (let i = 0; i < 5; i++) f(P(G.sphere(), lambert(hair), 0.13, 0.1, 0.13, -0.18 + i * 0.09, HY + HR * 0.82, 0.08 - Math.abs(i - 2) * 0.04));
  if (race.id === 'fae') for (const s of [-1, 1]) { body.add(P(G.sphere(), basic(0xe8d8ff, 0.55, true), 0.04, 0.36, 0.22, s * 0.26, 0.82, -0.28, 0, 0, s * 0.5)); f(P(G.cyl(), lambert(0x3a2a5a), 0.012, 0.22, 0.012, s * 0.1, HY + 0.42, 0.05, 0, 0, -s * 0.3)); f(P(G.sphere(), basic(0xffe060), 0.035, 0.035, 0.035, s * 0.14, HY + 0.53, 0.05)); }
  // class outfit
  const hat = (m) => headG.add(m);
  const floaty = new THREE.Group(); floaty.position.y = HY + 0.62; body.add(floaty);
  let capeColor = null;
  switch (cls.id) {
    case 'warrior': hat(P(G.sphere(), lambert(METAL), HR * 1.04, HR * 0.7, HR * 1.04, 0, HY + 0.1, -0.01)); hat(P(G.box(), lambert(METAL), 0.05, 0.16, 0.05, 0, HY + 0.02, HR + 0.01)); hat(P(G.sphere(), lambert(0xd02020), 0.06, 0.18, 0.22, 0, HY + 0.4, -0.06)); for (const s of [-1, 1]) body.add(P(G.sphere(), lambert(METAL), 0.12, 0.08, 0.12, s * 0.3, 0.82, 0)); capeColor = 0x9a2020; break;
    case 'rogue': hat(P(G.sphere(), cloth, HR * 1.08, HR * 1.0, HR * 1.06, 0, HY + 0.04, -0.03)); hat(P(G.cone(), cloth, 0.14, 0.26, 0.14, 0, HY + 0.42, -0.12, -0.6)); hat(P(G.box(), lambert(0x2a1a3a), HR * 1.6, 0.13, 0.1, 0, HY - 0.16, HR * 0.8)); body.add(P(G.box(), lambert(0x6a2a8a), 0.08, 0.35, 0.04, 0.12, 0.85, -0.25, -0.4, 0, 0.3)); break;
    case 'mage': case 'storm': hat(P(G.cyl(), cloth, 0.46, 0.04, 0.46, 0, HY + 0.28, 0)); hat(P(G.cone(), cloth, 0.3, 0.7, 0.3, 0.04, HY + 0.62, -0.04, -0.15, 0, -0.25)); for (let i = 0; i < 4; i++) hat(P(G.oct(), basic(0xffe060), 0.045, 0.045, 0.02, -0.12 + i * 0.07, HY + 0.38 + i * 0.12, 0.21 - i * 0.05)); hat(P(G.sphere(), basic(0xffe060), 0.06, 0.06, 0.06, 0.2, HY + 0.95, -0.18)); capeColor = cls.id === 'mage' ? 0x1a3080 : null;
      if (cls.id === 'storm') { for (const [x, z, r] of [[0, 0, 0.16], [0.15, 0.03, 0.12], [-0.15, 0.02, 0.12], [0.05, -0.08, 0.13]]) floaty.add(P(G.sphere(), lambert(0x8a94a8), r, r * 0.75, r, x, 0.55, z)); floaty.add(P(G.box(), basic(0xfff060), 0.03, 0.18, 0.02, 0.03, 0.38, 0, 0, 0, 0.3), P(G.box(), basic(0xfff060), 0.03, 0.14, 0.02, -0.02, 0.27, 0, 0, 0, -0.3)); } break;
    case 'ranger': hat(P(G.cone(), cloth, HR * 1.05, 0.3, HR * 1.05, 0, HY + 0.34, 0, 0, 0, 0.1)); hat(P(G.box(), lambert(0xd03030), 0.04, 0.32, 0.02, -0.2, HY + 0.5, 0, 0, 0, 0.6)); body.add(P(G.cyl(), lambert(0x6a3a1a), 0.08, 0.42, 0.08, 0.1, 0.78, -0.25, 0.35), ...[0, 1, 2].map((k) => P(G.cone(), basic(0xffffff), 0.03, 0.08, 0.03, 0.06 + k * 0.04, 1.02, -0.17))); capeColor = 0x2a5a2a; break;
    case 'cleric': hat(P(G.box(), lambert(0xf4ecd8), 0.3, 0.42, 0.18, 0, HY + 0.5, 0)); hat(P(G.box(), lambert(GOLD), 0.04, 0.38, 0.19, 0, HY + 0.5, 0)); body.add(P(G.box(), lambert(GOLD), 0.04, 0.16, 0.02, 0, 0.66, 0.26), P(G.box(), lambert(GOLD), 0.11, 0.04, 0.02, 0, 0.7, 0.26)); floaty.add(P(new THREE.TorusGeometry(0.18, 0.025, 6, 16), basic(0xffe080), 1, 1, 1, 0, 0.12, 0, Math.PI / 2)); capeColor = 0xe8e0c0; break;
    case 'necro': hat(P(G.sphere(), lambert(0x2a3a2a), HR * 1.1, HR * 1.02, HR * 1.08, 0, HY + 0.05, -0.04)); hat(P(G.cone(), lambert(0x2a3a2a), 0.16, 0.3, 0.16, 0, HY + 0.44, -0.12, -0.5)); for (const s of [-1, 1]) body.add(P(G.sphere(), lambert(BONE), 0.1, 0.09, 0.1, s * 0.3, 0.86, 0)); floaty.position.set(0.45, HY + 0.2, 0); floaty.add(P(G.sphere(), lambert(BONE), 0.11, 0.1, 0.1, 0, 0, 0), P(G.sphere(), basic(0x40ff80), 0.025, 0.025, 0.02, -0.04, 0.01, 0.09), P(G.sphere(), basic(0x40ff80), 0.025, 0.025, 0.02, 0.04, 0.01, 0.09)); capeColor = 0x1a2a1a; break;
    case 'paladin': hat(P(G.sphere(), lambert(0xe8d070), HR * 1.04, HR * 0.72, HR * 1.04, 0, HY + 0.1, -0.01)); for (const s of [-1, 1]) hat(P(G.box(), lambert(0xffffff), 0.04, 0.2, 0.14, s * 0.36, HY + 0.22, -0.04, 0, 0, -s * 0.5)); capeColor = 0x2040a0; break;
    case 'berserker': hat(P(G.sphere(), lambert(0x8a8a90), HR * 1.04, HR * 0.65, HR * 1.04, 0, HY + 0.12, -0.01)); for (const s of [-1, 1]) hat(P(G.cone(), lambert(0xf0e6cc), 0.07, 0.34, 0.07, s * 0.38, HY + 0.32, 0, 0, 0, -s * 0.7)); for (const s of [-1, 1]) body.add(P(G.sphere(), lambert(0x8a6a4a), 0.14, 0.1, 0.14, s * 0.3, 0.82, 0)); break;
    case 'monk': hat(P(G.cyl(), lambert(0xd03030), HR * 1.02, 0.07, HR * 1.02, 0, HY + 0.12, 0)); body.add(P(G.box(), lambert(0xd03030), 0.05, 0.3, 0.02, 0.08, HY - 0.05, -0.36, 0.4, 0, 0.2), P(G.box(), lambert(0xd03030), 0.05, 0.26, 0.02, -0.06, HY - 0.07, -0.36, 0.5, 0, -0.2)); break;
    case 'warlock': hat(P(G.sphere(), cloth, HR * 1.08, HR * 1.0, HR * 1.06, 0, HY + 0.04, -0.03)); for (const s of [-1, 1]) hat(P(G.cone(), lambert(0x2a1a2a), 0.06, 0.3, 0.06, s * 0.24, HY + 0.4, 0, -0.2, 0, -s * 0.5)); floaty.position.set(-0.5, HY + 0.15, 0.1); floaty.add(P(G.box(), lambert(0x4a1a6a), 0.2, 0.26, 0.06), P(G.box(), basic(0xc060ff), 0.12, 0.04, 0.07, 0, 0.02, 0)); capeColor = 0x3a0a4a; break;
    case 'druid': for (const s of [-1, 1]) { hat(P(G.cyl(), lambert(WOOD), 0.025, 0.36, 0.025, s * 0.18, HY + 0.46, 0, 0, 0, -s * 0.5)); hat(P(G.cyl(), lambert(WOOD), 0.02, 0.18, 0.02, s * 0.3, HY + 0.56, 0.05, 0.6, 0, -s * 0.2)); hat(P(G.sphere(), lambert(0x5ab040), 0.07, 0.04, 0.05, s * 0.32, HY + 0.62, 0.0)); } capeColor = 0x3a7a2a; break;
  }
  if (race.id === 'celestial' && cls.id !== 'cleric') floaty.add(P(new THREE.TorusGeometry(0.18, 0.025, 6, 16), basic(0xffe080), 1, 1, 1, 0, 0.12, 0, Math.PI / 2));
  // cape
  let cape = null;
  if (capeColor) {
    cape = new THREE.Group(); cape.position.set(0, 0.86, -0.2);
    cape.add(P(G.box(), lambert(capeColor), 0.5, 0.62, 0.04, 0, -0.31, 0));
    body.add(cape);
  }
  root.scale.setScalar(race.scale * 1.12);
  const [lArm, rArm] = arms;
  root.userData = { body, arms, legs, cape, eyes: eyesG, floaty, rightHand: rArm.userData.hand, leftHand: lArm.userData.hand, rightArm: rArm, leftArm: lArm, weapon: null, offhand: null, blinkT: 2, floatyY: floaty.position.y };
  return root;
}

// Shared blink timer for any model carrying userData.eyes
export function tickBlink(model, dt) {
  const u = model.userData;
  if (!u.eyes) return;
  u.blinkT -= dt;
  if (u.blinkT < 0) { u.eyes.scale.y = 0.12; if (u.blinkT < -0.12) { u.blinkT = 2 + Math.random() * 3.5; u.eyes.scale.y = 1; } }
}
