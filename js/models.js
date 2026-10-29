// Procedural low-poly meshes for heroes, monsters, loot and props. Geometries and
// materials are shared and cached to keep mobile draw/alloc costs low.
import * as THREE from 'three';

const geoCache = new Map();
const matCache = new Map();
export function geo(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
export function lambert(color, emissive = 0) {
  const k = `l${color}_${emissive}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: emissive ? 0.6 : 0 }));
  return matCache.get(k);
}
export function basic(color, opacity = 1, additive = false) {
  const k = `b${color}_${opacity}_${additive}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1 || additive, opacity, depthWrite: !(opacity < 1 || additive), blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  return matCache.get(k);
}

const G = {
  capsule: () => geo('capsule', () => new THREE.CapsuleGeometry(0.33, 0.55, 4, 10)),
  sphere: () => geo('sphere', () => new THREE.SphereGeometry(1, 12, 10)),
  lowSphere: () => geo('lowsphere', () => new THREE.SphereGeometry(1, 7, 5)),
  box: () => geo('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: () => geo('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 8)),
  cone: () => geo('cone', () => new THREE.ConeGeometry(1, 1, 8)),
  oct: () => geo('oct', () => new THREE.OctahedronGeometry(1, 0)),
  ring: () => geo('ring', () => new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2)),
  disc: () => geo('disc', () => new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2)),
};
export { G as GEO };

export function part(g, mat, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(g, mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  return m;
}

const METAL = 0xb8bcc8, WOOD = 0x7a5530, GOLD = 0xe0b040;

export function buildWeapon(type, rarityHex = 0xffffff) {
  const g = new THREE.Group();
  const metal = lambert(METAL), wood = lambert(WOOD), glow = basic(rarityHex);
  switch (type) {
    case 'sword': g.add(part(G.box(), metal, 0.08, 0.9, 0.03, 0, 0.55, 0), part(G.box(), lambert(GOLD), 0.3, 0.06, 0.08, 0, 0.1, 0), part(G.box(), wood, 0.06, 0.2, 0.06)); break;
    case 'axe': g.add(part(G.cyl(), wood, 0.04, 0.9, 0.04, 0, 0.4, 0), part(G.box(), metal, 0.35, 0.3, 0.05, 0.15, 0.75, 0)); break;
    case 'mace': g.add(part(G.cyl(), wood, 0.04, 0.7, 0.04, 0, 0.3, 0), part(G.lowSphere(), metal, 0.17, 0.17, 0.17, 0, 0.7, 0)); break;
    case 'dagger': g.add(part(G.box(), metal, 0.07, 0.45, 0.03, 0, 0.3, 0), part(G.box(), wood, 0.06, 0.15, 0.06)); break;
    case 'staff': g.add(part(G.cyl(), wood, 0.045, 1.6, 0.045, 0, 0.5, 0), part(G.sphere(), glow, 0.13, 0.13, 0.13, 0, 1.35, 0)); break;
    case 'wand': g.add(part(G.cyl(), wood, 0.03, 0.5, 0.03, 0, 0.25, 0), part(G.sphere(), glow, 0.07, 0.07, 0.07, 0, 0.52, 0)); break;
    case 'bow': { const t = new THREE.Mesh(geo('bow', () => new THREE.TorusGeometry(0.5, 0.03, 4, 12, Math.PI)), wood); t.rotation.z = -Math.PI / 2; t.position.y = 0.3; g.add(t); break; }
    case 'crossbow': g.add(part(G.box(), wood, 0.08, 0.08, 0.6, 0, 0.2, 0.15), part(G.box(), metal, 0.6, 0.05, 0.05, 0, 0.2, 0.35)); break;
    case 'spear': g.add(part(G.cyl(), wood, 0.035, 1.7, 0.035, 0, 0.55, 0), part(G.cone(), metal, 0.07, 0.3, 0.07, 0, 1.5, 0)); break;
    case 'scythe': g.add(part(G.cyl(), wood, 0.035, 1.6, 0.035, 0, 0.5, 0), part(G.box(), metal, 0.6, 0.08, 0.03, 0.28, 1.25, 0)); break;
    case 'hammer': g.add(part(G.cyl(), wood, 0.045, 1.1, 0.045, 0, 0.45, 0), part(G.box(), metal, 0.42, 0.25, 0.25, 0, 1.0, 0)); break;
    case 'claws': for (let i = -1; i <= 1; i++) g.add(part(G.cone(), metal, 0.03, 0.4, 0.03, i * 0.06, 0.25, 0.05)); break;
    case 'scepter': g.add(part(G.cyl(), lambert(GOLD), 0.035, 0.7, 0.035, 0, 0.3, 0), part(G.oct(), glow, 0.12, 0.15, 0.12, 0, 0.72, 0)); break;
    case 'shield': g.add(part(G.cyl(), metal, 0.35, 0.06, 0.35, 0, 0, 0)); g.children[0].rotation.x = Math.PI / 2; break;
    case 'orb': g.add(part(G.sphere(), glow, 0.14, 0.14, 0.14, 0, 0.1, 0)); break;
    case 'tome': g.add(part(G.box(), lambert(0x6a2020), 0.28, 0.35, 0.08)); break;
    case 'totem': g.add(part(G.box(), wood, 0.14, 0.4, 0.14, 0, 0.1, 0)); break;
    case 'quiver': g.add(part(G.cyl(), lambert(0x6a4a2a), 0.1, 0.5, 0.1, 0, 0.1, 0)); break;
  }
  return g;
}

export function buildHero(race, cls) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const cloth = lambert(cls.color), skin = lambert(race.skin), dark = lambert(0x222222);
  body.add(part(G.capsule(), cloth, 1, 1, 1, 0, 0.62, 0));
  body.add(part(G.box(), dark, 0.62, 0.08, 0.42, 0, 0.55, 0)); // belt
  const head = part(G.sphere(), skin, 0.26, 0.26, 0.26, 0, 1.33, 0); body.add(head);
  body.add(part(G.sphere(), basic(0x111111), 0.04, 0.04, 0.04, -0.09, 1.36, 0.22), part(G.sphere(), basic(0x111111), 0.04, 0.04, 0.04, 0.09, 1.36, 0.22));
  const hatMat = lambert(cls.color);
  switch (cls.hat) {
    case 'helm': body.add(part(G.cyl(), lambert(METAL), 0.28, 0.22, 0.28, 0, 1.45, 0), part(G.box(), lambert(METAL), 0.04, 0.12, 0.3, 0, 1.6, 0)); break;
    case 'hood': body.add(part(G.cone(), hatMat, 0.32, 0.5, 0.32, 0, 1.52, -0.04)); break;
    case 'wizard': body.add(part(G.cone(), hatMat, 0.3, 0.75, 0.3, 0, 1.75, 0), part(G.cyl(), hatMat, 0.42, 0.03, 0.42, 0, 1.48, 0)); break;
    case 'mitre': body.add(part(G.box(), lambert(0xf0e8d0), 0.24, 0.45, 0.12, 0, 1.68, 0), part(G.box(), lambert(GOLD), 0.04, 0.4, 0.13, 0, 1.68, 0)); break;
    case 'horns': { const h1 = part(G.cone(), lambert(0xe8dcc0), 0.06, 0.3, 0.06, -0.2, 1.55, 0), h2 = part(G.cone(), lambert(0xe8dcc0), 0.06, 0.3, 0.06, 0.2, 1.55, 0); h1.rotation.z = 0.5; h2.rotation.z = -0.5; body.add(h1, h2); break; }
    case 'antlers': for (const s of [-1, 1]) { const a = part(G.cyl(), lambert(WOOD), 0.025, 0.4, 0.025, s * 0.17, 1.62, 0); a.rotation.z = -s * 0.5; const b = part(G.cyl(), lambert(WOOD), 0.02, 0.2, 0.02, s * 0.28, 1.72, 0.05); b.rotation.x = 0.6; body.add(a, b); } break;
  }
  if (race.id === 'elf' || race.id === 'fae' || race.id === 'goblin') for (const s of [-1, 1]) { const e = part(G.cone(), skin, 0.05, 0.22, 0.05, s * 0.27, 1.38, 0); e.rotation.z = -s * 1.2; body.add(e); }
  if (race.id === 'tiefling' || race.id === 'minotaur') for (const s of [-1, 1]) { const e = part(G.cone(), lambert(0x302020), 0.06, 0.28, 0.06, s * 0.18, 1.58, 0.05); e.rotation.z = -s * 0.4; body.add(e); }
  if (race.id === 'fae') for (const s of [-1, 1]) { const w = part(G.sphere(), basic(0xe0d0ff, 0.5), 0.05, 0.4, 0.25, s * 0.25, 0.95, -0.28); w.rotation.z = s * 0.4; body.add(w); }
  if (race.id === 'dragonborn' || race.id === 'lizard') body.add(part(G.cone(), skin, 0.1, 0.6, 0.1, 0, 0.4, -0.35)).children.at(-1).rotation.x = -1.2;

  const rightHand = new THREE.Group(); rightHand.position.set(0.42, 0.75, 0.1); body.add(rightHand);
  const leftHand = new THREE.Group(); leftHand.position.set(-0.42, 0.75, 0.1); body.add(leftHand);
  rightHand.add(part(G.sphere(), skin, 0.09, 0.09, 0.09));
  leftHand.add(part(G.sphere(), skin, 0.09, 0.09, 0.09));
  root.scale.setScalar(race.scale);
  root.userData = { body, rightHand, leftHand, weapon: null, offhand: null };
  return root;
}

export function setHeroGear(model, weaponItem, offhandItem, rarityHexOf) {
  const u = model.userData;
  if (u.weapon) u.rightHand.remove(u.weapon);
  if (u.offhand) u.leftHand.remove(u.offhand);
  u.weapon = weaponItem ? buildWeapon(weaponItem.type, rarityHexOf(weaponItem)) : null;
  u.offhand = offhandItem ? buildWeapon(offhandItem.type, rarityHexOf(offhandItem)) : null;
  if (u.weapon) { u.weapon.rotation.x = 0.4; u.rightHand.add(u.weapon); }
  if (u.offhand) { u.offhand.position.z = 0.1; u.leftHand.add(u.offhand); }
}

// Collapse a group of coloured parts into at most two meshes (lit + unlit) with vertex colours.
// Cuts per-monster draw calls from ~8-12 down to 2 for mobile GPUs.
export const vcLambert = new THREE.MeshLambertMaterial({ vertexColors: true });
export const vcBasic = new THREE.MeshBasicMaterial({ vertexColors: true });
const mergedCache = new Map();
export function mergeGroup(group) {
  group.updateMatrixWorld(true);
  const buckets = { lit: [], unlit: [] };
  group.traverse((o) => {
    if (!o.isMesh) return;
    const unlit = o.material.isMeshBasicMaterial;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const col = o.material.color.clone();
    if (o.material.emissive && o.material.emissiveIntensity) col.lerp(o.material.emissive, 0.35).multiplyScalar(1.25);
    const n = g.attributes.position.count, ca = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
    buckets[unlit ? 'unlit' : 'lit'].push({ pos: g.attributes.position.array, nrm: g.attributes.normal.array, col: ca });
  });
  const out = {};
  for (const k in buckets) {
    const list = buckets[k];
    if (!list.length) continue;
    const total = list.reduce((a, b) => a + b.pos.length, 0);
    const P = new Float32Array(total), N = new Float32Array(total), C = new Float32Array(total);
    let off = 0;
    for (const b of list) { P.set(b.pos, off); N.set(b.nrm, off); C.set(b.col, off); off += b.pos.length; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.computeBoundingSphere();
    out[k] = g;
  }
  return out;
}
function mergedModel(key, build) {
  if (!mergedCache.has(key)) mergedCache.set(key, mergeGroup(build()));
  const geos = mergedCache.get(key);
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  if (geos.lit) body.add(new THREE.Mesh(geos.lit, vcLambert));
  if (geos.unlit) body.add(new THREE.Mesh(geos.unlit, vcBasic));
  root.userData = { body };
  return root;
}

export function buildMonster(arch, theme, boss = false) {
  return mergedModel(`m_${arch}_${theme.id}_${boss}`, () => buildMonsterParts(arch, theme, boss).userData.body);
}
function buildMonsterParts(arch, theme, boss) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const c = lambert(theme.color), dark = lambert(new THREE.Color(theme.color).multiplyScalar(0.55).getHex());
  const eye = basic(theme.eye);
  const eyes = (y, z, s = 0.05, sep = 0.1) => body.add(part(G.sphere(), eye, s, s, s, -sep, y, z), part(G.sphere(), eye, s, s, s, sep, y, z));
  switch (arch) {
    case 'runner':
      body.add(part(G.box(), c, 0.4, 0.35, 0.9, 0, 0.45, 0), part(G.box(), dark, 0.32, 0.3, 0.35, 0, 0.6, 0.55));
      for (const [x, z] of [[-0.15, 0.3], [0.15, 0.3], [-0.15, -0.3], [0.15, -0.3]]) body.add(part(G.box(), dark, 0.1, 0.35, 0.1, x, 0.15, z));
      eyes(0.66, 0.73, 0.04); break;
    case 'archer':
      body.add(part(G.capsule(), c, 0.8, 0.9, 0.8, 0, 0.6, 0), part(G.sphere(), dark, 0.22, 0.22, 0.22, 0, 1.25, 0));
      body.add(part(G.box(), lambert(WOOD), 0.05, 0.8, 0.05, 0.35, 0.8, 0.2)); eyes(1.28, 0.18); break;
    case 'caster':
      body.add(part(G.cone(), c, 0.45, 1.2, 0.45, 0, 0.6, 0), part(G.sphere(), dark, 0.22, 0.22, 0.22, 0, 1.3, 0));
      body.add(part(G.sphere(), basic(theme.eye), 0.12, 0.12, 0.12, 0.35, 1.2, 0.2)); eyes(1.32, 0.18); break;
    case 'brute':
      body.add(part(G.box(), c, 1.1, 1.0, 0.75, 0, 0.95, 0), part(G.sphere(), dark, 0.28, 0.28, 0.28, 0, 1.6, 0.15));
      body.add(part(G.box(), dark, 0.32, 0.9, 0.32, -0.75, 0.85, 0.1), part(G.box(), dark, 0.32, 0.9, 0.32, 0.75, 0.85, 0.1));
      body.add(part(G.box(), dark, 0.3, 0.5, 0.3, -0.3, 0.25, 0), part(G.box(), dark, 0.3, 0.5, 0.3, 0.3, 0.25, 0)); eyes(1.65, 0.38, 0.06, 0.12); break;
    case 'swarmer':
      body.add(part(G.lowSphere(), c, 0.32, 0.25, 0.36, 0, 0.3, 0)); eyes(0.38, 0.28, 0.05, 0.1); break;
    case 'bomber':
      body.add(part(G.sphere(), lambert(theme.color, theme.eye), 0.5, 0.45, 0.5, 0, 0.55, 0)); eyes(0.7, 0.45, 0.07, 0.15); break;
    case 'charger':
      body.add(part(G.box(), c, 0.7, 0.7, 1.2, 0, 0.65, 0), part(G.box(), dark, 0.5, 0.45, 0.45, 0, 0.8, 0.75));
      for (const s of [-1, 1]) { const h = part(G.cone(), lambert(0xe8dcc0), 0.07, 0.45, 0.07, s * 0.25, 1.1, 0.85); h.rotation.x = 0.9; body.add(h); }
      for (const [x, z] of [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]]) body.add(part(G.box(), dark, 0.15, 0.4, 0.15, x, 0.2, z));
      eyes(0.88, 0.98, 0.05, 0.14); break;
    default: // grunt
      body.add(part(G.capsule(), c, 1, 1, 1, 0, 0.62, 0), part(G.sphere(), dark, 0.26, 0.26, 0.26, 0, 1.3, 0));
      body.add(part(G.box(), lambert(METAL), 0.06, 0.7, 0.04, 0.42, 0.85, 0.25)); eyes(1.33, 0.22);
  }
  if (boss) for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    body.add(part(G.cone(), lambert(GOLD, 0x402000), 0.06, 0.25, 0.06, Math.cos(a) * 0.22, arch === 'brute' ? 1.95 : 1.62, Math.sin(a) * 0.22));
  }
  root.userData = { body };
  return root;
}

export function buildMinion(kind) {
  return mergedModel('minion_' + kind, () => buildMinionParts(kind).userData.body);
}
function buildMinionParts(kind) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  if (kind === 'wolf') {
    const c = lambert(0x8a8a90), d = lambert(0x5a5a60);
    body.add(part(G.box(), c, 0.38, 0.38, 0.9, 0, 0.45, 0), part(G.box(), d, 0.3, 0.3, 0.38, 0, 0.6, 0.55));
    for (const [x, z] of [[-0.13, 0.3], [0.13, 0.3], [-0.13, -0.3], [0.13, -0.3]]) body.add(part(G.box(), d, 0.09, 0.32, 0.09, x, 0.15, z));
    body.add(part(G.sphere(), basic(0x80ffff), 0.04, 0.04, 0.04, -0.08, 0.66, 0.74), part(G.sphere(), basic(0x80ffff), 0.04, 0.04, 0.04, 0.08, 0.66, 0.74));
  } else if (kind === 'imp') {
    const c = lambert(0xc03020, 0x401000);
    body.add(part(G.sphere(), c, 0.3, 0.32, 0.3, 0, 0.9, 0));
    for (const s of [-1, 1]) { const h = part(G.cone(), lambert(0x301010), 0.05, 0.2, 0.05, s * 0.15, 1.2, 0); h.rotation.z = -s * 0.4; body.add(h); const w = part(G.box(), lambert(0x801010), 0.4, 0.25, 0.03, s * 0.35, 1.0, -0.15); w.rotation.y = s * 0.4; body.add(w); }
    body.add(part(G.sphere(), basic(0xffe020), 0.04, 0.04, 0.04, -0.09, 0.95, 0.26), part(G.sphere(), basic(0xffe020), 0.04, 0.04, 0.04, 0.09, 0.95, 0.26));
  } else {
    const c = lambert(0xe0d8c0);
    body.add(part(G.capsule(), c, 0.8, 0.85, 0.8, 0, 0.55, 0), part(G.sphere(), c, 0.22, 0.22, 0.22, 0, 1.15, 0));
    body.add(part(G.box(), lambert(METAL), 0.05, 0.6, 0.04, 0.35, 0.75, 0.2));
    body.add(part(G.sphere(), basic(0x40ff80), 0.04, 0.04, 0.04, -0.08, 1.18, 0.19), part(G.sphere(), basic(0x40ff80), 0.04, 0.04, 0.04, 0.08, 1.18, 0.19));
  }
  root.userData = { body };
  return root;
}

export function buildDrop(item, rarity) {
  const g = new THREE.Group();
  const gem = part(G.oct(), basic(rarity.hex), 0.22, 0.32, 0.22, 0, 0.5, 0);
  g.add(gem);
  g.add(part(G.disc(), basic(rarity.hex, 0.35, true), 0.6, 1, 0.6, 0, 0.03, 0));
  const ri = ['common', 'magic', 'rare', 'epic', 'legendary', 'mythic'].indexOf(rarity.id);
  if (ri >= 2) g.add(part(G.cyl(), basic(rarity.hex, 0.22 + ri * 0.04, true), 0.1, 6 + ri, 0.1, 0, 3 + ri / 2, 0));
  g.userData.gem = gem;
  return g;
}

export function buildGold() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) g.add(part(G.cyl(), lambert(0xffd040, 0x806000), 0.16, 0.05, 0.16, (i - 1) * 0.12, 0.06 + (i % 2) * 0.05, (i % 2) * 0.1));
  return g;
}

export function buildChest() {
  const g = new THREE.Group();
  g.add(part(G.box(), lambert(0x7a4a20), 1.0, 0.55, 0.7, 0, 0.28, 0));
  const lid = part(G.box(), lambert(0x8a5a28), 1.05, 0.2, 0.75, 0, 0.62, 0); g.add(lid);
  g.add(part(G.box(), lambert(GOLD, 0x403000), 0.15, 0.2, 0.05, 0, 0.45, 0.37));
  g.userData.lid = lid;
  return g;
}
export function buildPot() {
  const g = new THREE.Group();
  g.add(part(G.cyl(), lambert(0x9a6a40), 0.35, 0.7, 0.35, 0, 0.35, 0), part(G.cyl(), lambert(0x7a5030), 0.2, 0.15, 0.2, 0, 0.75, 0));
  return g;
}
export function buildShrine(color) {
  const g = new THREE.Group();
  g.add(part(G.cyl(), lambert(0x707070), 0.5, 0.3, 0.5, 0, 0.15, 0), part(G.cyl(), lambert(0x8a8a8a), 0.2, 1.4, 0.2, 0, 0.9, 0));
  const crystal = part(G.oct(), basic(color), 0.3, 0.45, 0.3, 0, 2.0, 0); g.add(crystal);
  g.add(part(G.disc(), basic(color, 0.3, true), 1.6, 1, 1.6, 0, 0.04, 0));
  g.userData.crystal = crystal;
  return g;
}
export function buildStairs() {
  const g = new THREE.Group();
  g.add(part(G.disc(), basic(0x000000), 1.4, 1, 1.4, 0, 0.02, 0));
  const ring = part(G.ring(), basic(0x60a0ff, 0.9, true), 1.5, 1, 1.5, 0, 0.05, 0); g.add(ring);
  const swirl = part(G.disc(), basic(0x3060ff, 0.35, true), 1.3, 1, 1.3, 0, 0.06, 0); g.add(swirl);
  g.add(part(G.cyl(), basic(0x60a0ff, 0.15, true), 1.2, 4, 1.2, 0, 2, 0));
  g.userData.ring = ring;
  return g;
}
export function buildTorch() {
  const g = new THREE.Group();
  g.add(part(G.cyl(), lambert(WOOD), 0.05, 0.5, 0.05, 0, 0, 0));
  const f = part(G.sphere(), basic(0xffa040), 0.13, 0.2, 0.13, 0, 0.32, 0); g.add(f);
  g.add(part(G.sphere(), basic(0xff8020, 0.25, true), 0.4, 0.4, 0.4, 0, 0.32, 0));
  g.userData.flame = f;
  return g;
}

// Merchant stall: striped awning, crates, and a hooded trader holding a lantern.
export function buildMerchant() {
  const g = new THREE.Group();
  const wood = lambert(0x6a4a28), cloth = [0x8a2a2a, 0xd8c090];
  g.add(part(G.box(), wood, 2.4, 0.12, 1.0, 0, 0.85, -0.9));
  for (const [x, z] of [[-1.1, -1.35], [1.1, -1.35], [-1.1, -0.45], [1.1, -0.45]]) g.add(part(G.box(), wood, 0.1, x < 0 && z < -1 || x > 0 && z < -1 ? 2.3 : 0.85, 0.1, x, z < -1 ? 1.15 : 0.42, z));
  for (let i = 0; i < 6; i++) { const a = part(G.box(), lambert(cloth[i % 2]), 0.42, 0.06, 1.4, -1.05 + i * 0.42, 2.25, -0.75); a.rotation.x = -0.35; g.add(a); }
  g.add(part(G.box(), lambert(0x7a5a34), 0.5, 0.5, 0.5, -1.6, 0.25, -0.6), part(G.box(), lambert(0x7a5a34), 0.4, 0.4, 0.4, -1.55, 0.7, -0.6));
  g.add(part(G.cyl(), lambert(0x5a3a20), 0.25, 0.6, 0.25, 1.6, 0.3, -0.8));
  // wares on the counter
  g.add(part(G.oct(), basic(0xc45cff), 0.12, 0.18, 0.12, -0.6, 1.05, -0.9), part(G.oct(), basic(0xffd84a), 0.12, 0.18, 0.12, 0, 1.05, -0.9), part(G.cyl(), basic(0xff4060), 0.08, 0.2, 0.08, 0.6, 1.02, -0.9));
  // trader
  const robe = lambert(0x3a2a5a);
  g.add(part(G.cone(), robe, 0.45, 1.3, 0.45, 0, 0.65, -1.6), part(G.sphere(), lambert(0xd0a080), 0.22, 0.22, 0.22, 0, 1.45, -1.6), part(G.cone(), robe, 0.3, 0.55, 0.3, 0, 1.68, -1.62));
  const lantern = part(G.sphere(), basic(0xffc860), 0.12, 0.14, 0.12, 0.45, 1.1, -1.35);
  g.add(lantern, part(G.sphere(), basic(0xffa040, 0.25, true), 0.45, 0.45, 0.45, 0.45, 1.1, -1.35));
  g.add(part(G.disc(), basic(0xffc860, 0.18, true), 2.6, 1, 2.0, 0, 0.04, -0.6));
  g.userData.lantern = lantern;
  return g;
}
