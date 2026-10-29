// Theme decorations: each prop is built once from primitive parts, merged into vertex-coloured
// geometry, then drawn with one InstancedMesh per prop type (lit + unlit buckets).
import * as THREE from 'three';
import { part, GEO as G, lambert, basic, mergeGroup, vcLambert, vcBasic } from './models.js';
import { rand, randi, pick, chance, shuffle } from './util.js';

const grp = (...m) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
const tilt = (m, x = 0, z = 0) => { m.rotation.x = x; m.rotation.z = z; return m; };
const BONE = 0xd8cfb4, WOOD = 0x6a4a28, IRON = 0x3a3a40;

// light: colour of a point light this prop can host
export const PROPS = {
  tomb: () => grp(part(G.box(), lambert(0x5e5a52), 0.95, 0.5, 1.9, 0, 0.25, 0), part(G.box(), lambert(0x7a756a), 1.05, 0.14, 2.0, 0, 0.56, 0),
    part(G.box(), lambert(0x4e4a44), 0.12, 0.04, 1.0, 0, 0.65, 0.1), part(G.box(), lambert(0x4e4a44), 0.55, 0.04, 0.12, 0, 0.65, -0.15)),
  candles: () => { const g = grp(); for (let i = 0; i < 5; i++) { const x = rand(-0.4, 0.4), z = rand(-0.4, 0.4), h = rand(0.2, 0.6); g.add(part(G.cyl(), lambert(0xe8dcc0), 0.05, h, 0.05, x, h / 2, z), part(G.lowSphere(), basic(0xffc060), 0.05, 0.08, 0.05, x, h + 0.06, z)); } return g; },
  skulls: () => { const g = grp(); for (let i = 0; i < 6; i++) { const x = rand(-0.4, 0.4), z = rand(-0.4, 0.4), y = i > 3 ? 0.25 : 0.12; g.add(part(G.lowSphere(), lambert(BONE), 0.15, 0.13, 0.17, x, y, z), part(G.box(), basic(0x111111), 0.06, 0.05, 0.03, x - 0.05, y + 0.02, z + 0.14), part(G.box(), basic(0x111111), 0.06, 0.05, 0.03, x + 0.05, y + 0.02, z + 0.14)); } return g; },
  bones: () => grp(tilt(part(G.cyl(), lambert(BONE), 0.04, 0.8, 0.04, 0, 0.05, 0), Math.PI / 2, 0.4), tilt(part(G.cyl(), lambert(BONE), 0.035, 0.6, 0.035, 0.2, 0.05, 0.1), Math.PI / 2, -0.9), part(G.lowSphere(), lambert(BONE), 0.13, 0.11, 0.15, -0.3, 0.1, 0.2)),
  stalagmite: () => grp(part(G.cone(), lambert(0x6a5a44), 0.45, rand(1.4, 2.4), 0.45, 0, 0.9, 0), part(G.cone(), lambert(0x5a4a36), 0.25, 1.0, 0.25, 0.4, 0.5, 0.2), part(G.cone(), lambert(0x7a6a52), 0.2, 0.7, 0.2, -0.35, 0.35, -0.1)),
  boulder: () => grp(part(geoDodeca(), lambert(0x5a4c3c), 0.6, 0.45, 0.55, 0, 0.3, 0), part(geoDodeca(), lambert(0x4a3e30), 0.35, 0.3, 0.35, 0.5, 0.18, 0.2)),
  mushroom: () => { const g = grp(); for (let i = 0; i < 4; i++) { const x = rand(-0.4, 0.4), z = rand(-0.4, 0.4), h = rand(0.25, 0.7), r = rand(0.12, 0.26); g.add(part(G.cyl(), lambert(0xd8d0c0), 0.04, h, 0.04, x, h / 2, z), part(G.lowSphere(), basic(0x40e0c0), r, r * 0.5, r, x, h, z)); } return g; },
  eggsac: () => { const g = grp(); for (let i = 0; i < 5; i++) { const r = rand(0.18, 0.35); g.add(part(G.lowSphere(), basic(0x9ac070), r, r * 1.15, r, rand(-0.4, 0.4), r, rand(-0.4, 0.4))); } g.add(part(G.disc(), lambert(0xc8c8b8), 0.7, 1, 0.7, 0, 0.02, 0)); return g; },
  icecrystal: () => { const g = grp(); for (let i = 0; i < 4; i++) { const h = rand(0.6, 1.8); g.add(tilt(part(G.oct(), basic(0x80d8ff), 0.18, h, 0.18, rand(-0.4, 0.4), h * 0.6, rand(-0.4, 0.4)), rand(-0.3, 0.3), rand(-0.3, 0.3))); } return g; },
  snowdrift: () => grp(part(G.lowSphere(), lambert(0xe8f4ff), 0.9, 0.25, 0.6, 0, 0, 0), part(G.lowSphere(), lambert(0xffffff), 0.5, 0.2, 0.5, 0.4, 0.05, 0.2)),
  brazier: () => grp(part(G.cyl(), lambert(IRON), 0.08, 0.9, 0.08, 0, 0.45, 0), part(G.cyl(), lambert(IRON), 0.4, 0.2, 0.4, 0, 0.95, 0), part(G.cone(), basic(0xff7020), 0.3, 0.6, 0.3, 0, 1.3, 0), part(G.cone(), basic(0xffd060), 0.16, 0.4, 0.16, 0, 1.25, 0)),
  spikes: () => { const g = grp(); for (let i = 0; i < 5; i++) g.add(tilt(part(G.cone(), lambert(0x2a1a18), 0.1, rand(0.6, 1.3), 0.1, rand(-0.4, 0.4), 0.4, rand(-0.4, 0.4)), rand(-0.3, 0.3), rand(-0.3, 0.3))); return g; },
  pylon: () => grp(part(G.box(), lambert(0x50586a), 0.6, 0.3, 0.6, 0, 0.15, 0), part(G.cyl(), lambert(0x707a90), 0.08, 1.6, 0.08, 0, 1.0, 0), part(new THREE.TorusGeometry(0.25, 0.05, 6, 12), lambert(0x9aa0b0), 1, 1, 1, 0, 1.2, 0), part(G.lowSphere(), basic(0x70c0ff), 0.18, 0.18, 0.18, 0, 1.9, 0)),
  crate: () => grp(part(G.box(), lambert(0x7a5a34), 0.8, 0.8, 0.8, 0, 0.4, 0), part(G.box(), lambert(0x5a4024), 0.84, 0.1, 0.84, 0, 0.4, 0), part(G.box(), lambert(0x6a4a2a), 0.5, 0.5, 0.5, 0.2, 1.05, 0.1)),
  gear: () => grp(tilt(part(new THREE.TorusGeometry(0.5, 0.12, 6, 10), lambert(0x6a7080), 1, 1, 1, 0, 0.12, 0), Math.PI / 2), part(G.cyl(), lambert(0x50586a), 0.15, 0.2, 0.15, 0, 0.12, 0)),
  reeds: () => { const g = grp(); for (let i = 0; i < 9; i++) { const h = rand(0.6, 1.5); g.add(tilt(part(G.cyl(), lambert(0x5a7a2a), 0.025, h, 0.025, rand(-0.45, 0.45), h / 2, rand(-0.45, 0.45)), rand(-0.2, 0.2), rand(-0.2, 0.2))); if (chance(0.4)) g.add(part(G.cyl(), lambert(0x5a3a1a), 0.05, 0.2, 0.05, rand(-0.4, 0.4), h, rand(-0.4, 0.4))); } return g; },
  glowshroom: () => { const g = grp(); for (let i = 0; i < 3; i++) { const x = rand(-0.4, 0.4), z = rand(-0.4, 0.4), h = rand(0.3, 0.8), r = rand(0.15, 0.3); g.add(part(G.cyl(), lambert(0xc8c8a0), 0.05, h, 0.05, x, h / 2, z), part(G.lowSphere(), basic(0xc0ff40), r, r * 0.45, r, x, h, z)); } return g; },
  lily: () => grp(part(G.disc(), basic(0x1a3820), 0.9, 1, 0.7, 0, 0.02, 0), part(G.disc(), lambert(0x4a8a30), 0.22, 1, 0.22, 0.2, 0.04, 0.1), part(G.disc(), lambert(0x4a8a30), 0.16, 1, 0.16, -0.3, 0.04, -0.1)),
  voidcrystal: () => grp(part(geoDodeca(), lambert(0x2a2038), 0.4, 0.25, 0.4, 0, 0.12, 0), part(G.oct(), basic(0xb060ff), 0.25, 0.55, 0.25, 0, 1.3, 0), part(G.oct(), basic(0x8040e0), 0.12, 0.25, 0.12, 0.35, 0.9, 0.1)),
  tendril: () => { const g = grp(); for (let i = 0; i < 3; i++) g.add(tilt(part(G.cone(), lambert(0x3a1a4a), 0.12, rand(1, 1.8), 0.12, rand(-0.35, 0.35), 0.6, rand(-0.35, 0.35)), rand(-0.5, 0.5), rand(-0.5, 0.5))); return g; },
  // room centrepieces (flat, walkable)
  carpet: () => grp(part(G.box(), lambert(0x6a1a1a), 3.2, 0.03, 5.2, 0, 0.02, 0), part(G.box(), lambert(0xb08a30), 3.4, 0.02, 5.4, 0, 0.01, 0)),
  campfire: () => { const g = grp(); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; g.add(part(geoDodeca(), lambert(0x5a5048), 0.16, 0.12, 0.16, Math.cos(a) * 0.6, 0.06, Math.sin(a) * 0.6)); } g.add(tilt(part(G.cyl(), lambert(WOOD), 0.07, 0.9, 0.07, 0, 0.1, 0), Math.PI / 2, 0.5), tilt(part(G.cyl(), lambert(WOOD), 0.07, 0.9, 0.07, 0, 0.12, 0), Math.PI / 2, -0.7), part(G.cone(), basic(0xff8020), 0.3, 0.7, 0.3, 0, 0.4, 0), part(G.cone(), basic(0xffd060), 0.15, 0.45, 0.15, 0, 0.35, 0)); return g; },
  webdisc: () => grp(part(G.ring(), basic(0xb8b8a8), 1.2, 1, 1.2, 0, 0.03, 0), part(G.ring(), basic(0xb8b8a8), 2.2, 1, 2.2, 0, 0.03, 0), part(G.ring(), basic(0xb8b8a8), 3.2, 1, 3.2, 0, 0.03, 0), ...[0, 1, 2, 3].map((k) => { const m = part(G.box(), basic(0xb8b8a8), 0.04, 0.01, 6.4, 0, 0.03, 0); m.rotation.y = (k * Math.PI) / 4; return m; })),
  icesheet: () => grp(part(G.disc(), basic(0x6a9ac0), 3.2, 1, 2.6, 0, 0.02, 0), part(G.disc(), basic(0x9ac8e8), 2.2, 1, 1.6, 0.3, 0.03, -0.2)),
  lavapool: () => grp(part(G.disc(), lambert(0x1a0a06), 2.6, 1, 2.2, 0, 0.015, 0), part(G.disc(), basic(0xff5010), 2.2, 1, 1.8, 0, 0.03, 0), part(G.disc(), basic(0xffb030), 1.1, 1, 0.8, 0.2, 0.04, 0.1)),
  grate: () => { const g = grp(part(G.box(), lambert(0x2a2e3a), 3, 0.04, 3, 0, 0.02, 0)); for (let i = -2; i <= 2; i++) g.add(part(G.box(), basic(0x3080ff), 0.06, 0.02, 2.8, i * 0.6, 0.05, 0)); return g; },
  pool: () => grp(part(G.disc(), lambert(0x2a3018), 3, 1, 2.4, 0, 0.015, 0), part(G.disc(), basic(0x1e3a28), 2.6, 1, 2.0, 0, 0.03, 0), part(G.disc(), lambert(0x4a8a30), 0.3, 1, 0.3, 0.8, 0.05, 0.3), part(G.disc(), lambert(0x4a8a30), 0.25, 1, 0.25, -0.6, 0.05, -0.5)),
  runecircle: () => grp(part(G.ring(), basic(0xa050ff), 2.6, 1, 2.6, 0, 0.03, 0), part(G.ring(), basic(0x7030c0), 1.8, 1, 1.8, 0, 0.03, 0), ...[0, 1, 2, 3, 4].map((k) => { const a = (k / 5) * Math.PI * 2, m = part(G.box(), basic(0x9040f0), 0.08, 0.01, 2.5, Math.cos(a) * 0.5, 0.03, Math.sin(a) * 0.5); m.rotation.y = a + 0.3; return m; })),
};
let _dodeca = null;
function geoDodeca() { return _dodeca || (_dodeca = new THREE.DodecahedronGeometry(1, 0)); }

// Lights: [r,g,b] host colours for props that glow.
export const PROP_LIGHT = { mushroom: 0x40e0c0, eggsac: 0x9ac070, icecrystal: 0x70c8ff, brazier: 0xff7020, pylon: 0x60b0ff, glowshroom: 0xb0ff40, voidcrystal: 0xb060ff, campfire: 0xff8030, lavapool: 0xff5010 };

export const THEME_DECOR = {
  crypt:  { wall: [['tomb', 0.05], ['candles', 0.07], ['skulls', 0.05]], floor: [['bones', 0.03]], center: ['carpet', 'candles'], torch: 0xffa040, particles: 'dust' },
  caves:  { wall: [['stalagmite', 0.2], ['boulder', 0.08], ['mushroom', 0.05]], floor: [['bones', 0.01]], center: ['campfire'], particles: 'dust' },
  nest:   { wall: [['eggsac', 0.14], ['stalagmite', 0.06]], floor: [['bones', 0.04]], center: ['webdisc'], particles: 'spores' },
  frozen: { wall: [['icecrystal', 0.16], ['snowdrift', 0.12]], floor: [], center: ['icesheet'], particles: 'snow' },
  hell:   { wall: [['brazier', 0.04], ['spikes', 0.09]], floor: [['skulls', 0.02]], center: ['lavapool'], torch: 0xff6020, particles: 'embers' },
  storm:  { wall: [['pylon', 0.05], ['crate', 0.06], ['gear', 0.05]], floor: [], center: ['grate'], torch: 0x60a0ff, particles: 'sparks' },
  swamp:  { wall: [['reeds', 0.18], ['glowshroom', 0.07]], floor: [['lily', 0.03]], center: ['pool'], particles: 'fireflies' },
  abyss:  { wall: [['voidcrystal', 0.08], ['tendril', 0.09]], floor: [], center: ['runecircle'], torch: 0xb060ff, particles: 'motes' },
};

const kindCache = new Map();
function kind(name) {
  if (!kindCache.has(name)) kindCache.set(name, mergeGroup(PROPS[name]()));
  return kindCache.get(name);
}

// Place decorations on a dungeon. Returns { group, lights: [{x,y,z,color}] }.
export function buildDecor(d, theme, TS) {
  const cfg = THEME_DECOR[theme.id] || THEME_DECOR.crypt;
  const { W, H, grid } = d;
  const isF = (x, y) => x >= 0 && y >= 0 && x < W && y < H && grid[y * W + x] === 1;
  const wallSpots = [], openSpots = [];
  const taken = new Uint8Array(W * H);
  const reserve = new Set();
  // keep start, stairs and room centres clear
  for (const r of d.rooms) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) reserve.add((r.cy + dy) * W + r.cx + dx);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!isF(x, y) || reserve.has(y * W + x)) continue;
    const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !isF(x + dx, y + dy));
    if (walls.length && d.roomOf[y * W + x] >= 0) wallSpots.push([x, y, walls[0]]);
    else if (!walls.length && d.roomOf[y * W + x] >= 0) openSpots.push([x, y]);
  }
  shuffle(wallSpots); shuffle(openSpots);
  const placements = new Map(); // kind -> matrices
  const lights = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  const put = (name, x, z, rot, s, y = 0) => {
    if (!placements.has(name)) placements.set(name, []);
    q.setFromEuler(e.set(0, rot, 0)); pos.set(x, y, z); sc.setScalar(s);
    placements.get(name).push(new THREE.Matrix4().compose(pos, q, sc));
    if (PROP_LIGHT[name]) lights.push({ x, y: 1.4, z, color: PROP_LIGHT[name] });
  };
  let wi = 0;
  for (const [name, density] of cfg.wall) {
    const n = Math.floor(wallSpots.length * density);
    for (let k = 0; k < n && wi < wallSpots.length; k++) {
      const [x, y, [dx, dy]] = wallSpots[wi++];
      if (taken[y * W + x]) continue; taken[y * W + x] = 1;
      const cx = (x + 0.5) * TS + dx * TS * 0.28, cz = (y + 0.5) * TS + dy * TS * 0.28;
      put(name, cx, cz, name === 'tomb' ? Math.atan2(dx, dy) + Math.PI / 2 : rand(0, Math.PI * 2), rand(0.85, 1.2));
    }
  }
  let oi = 0;
  for (const [name, density] of cfg.floor) {
    const n = Math.floor(openSpots.length * density);
    for (let k = 0; k < n && oi < openSpots.length; k++) {
      const [x, y] = openSpots[oi++];
      if (taken[y * W + x]) continue; taken[y * W + x] = 1;
      put(name, (x + rand(0.2, 0.8)) * TS, (y + rand(0.2, 0.8)) * TS, rand(0, Math.PI * 2), rand(0.8, 1.2));
    }
  }
  // centrepieces in some rooms (never the start room); the boss arena always gets one
  d.rooms.forEach((r) => {
    if (r === d.start || (r === d.end && !d.isBoss)) return;
    if (!(d.isBoss && r === d.end) && !chance(0.4)) return;
    const name = cfg.center[0];
    const [x, z] = d.tileCenter(r.cx, r.cy);
    put(name, x + TS / 2, z + TS / 2, name === 'carpet' && r.w > r.h ? Math.PI / 2 : rand(0, Math.PI), d.isBoss && r === d.end ? 1.6 : 1);
    if (cfg.center[1]) for (const [ox, oz] of [[-2.2, -3], [2.2, -3], [-2.2, 3], [2.2, 3]]) put(cfg.center[1], x + TS / 2 + ox, z + TS / 2 + oz, 0, 0.7);
  });

  const group = new THREE.Group();
  const pulse = [];
  for (const [name, mats] of placements) {
    const geos = kind(name);
    for (const bucket of ['lit', 'unlit']) {
      if (!geos[bucket]) continue;
      let mat = bucket === 'lit' ? vcLambert : vcBasic;
      if (bucket === 'unlit' && (name === 'lavapool' || name === 'runecircle' || name === 'grate')) { mat = vcBasic.clone(); pulse.push(mat); }
      const im = new THREE.InstancedMesh(geos[bucket], mat, mats.length);
      mats.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      group.add(im);
    }
  }
  return { group, lights, pulse };
}
