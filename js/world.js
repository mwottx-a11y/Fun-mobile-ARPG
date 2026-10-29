// Builds the three.js representation of a generated dungeon floor: textured instanced floors and walls,
// colonnade pillars, theme decorations, torches with pooled real lights, ambient particles and the exit portal.
import * as THREE from 'three';
import { TS, FLOOR } from './dungeon.js';
import { buildStairs, part, GEO, lambert, basic, mergeGroup, vcLambert, vcBasic } from './models.js';
import { themeTextures } from './textures.js';
import { buildDecor, THEME_DECOR } from './decor.js';
import { rand, chance, dist2 } from './util.js';

export const WALL_H = 1.6;
export const TORCH_LIGHTS = 3;

let columnGeo = null, torchGeo = null;
function getColumn() {
  if (!columnGeo) {
    const g = new THREE.Group();
    g.add(part(GEO.box(), lambert(0x8a8478), 1.7, 0.3, 1.7, 0, 0.15, 0), part(GEO.cyl(), lambert(0xa09a8c), 0.6, WALL_H + 0.6, 0.6, 0, (WALL_H + 0.6) / 2, 0),
      part(GEO.box(), lambert(0x8a8478), 1.5, 0.25, 1.5, 0, WALL_H + 0.65, 0));
    columnGeo = mergeGroup(g).lit;
  }
  return columnGeo;
}
function getTorch() {
  if (!torchGeo) {
    const g = new THREE.Group();
    g.add(part(GEO.box(), lambert(0x3a3a40), 0.14, 0.14, 0.3, 0, 0, -0.1), part(GEO.cyl(), lambert(0x6a4a28), 0.05, 0.5, 0.05, 0, 0.1, 0.05));
    const flame = new THREE.Group();
    flame.add(part(GEO.oct(), basic(0xffffff), 0.13, 0.24, 0.13, 0, 0.42, 0.05), part(GEO.oct(), basic(0xffffff), 0.07, 0.13, 0.07, 0, 0.47, 0.05));
    torchGeo = { body: mergeGroup(g).lit, flame: mergeGroup(flame).unlit };
  }
  return torchGeo;
}

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
let dotTex = null;

const PARTICLES = {
  dust: { color: 0xd8c8a8, n: 110, size: 0.12, vel: [0.15, 0.05, 0.15], opacity: 0.45 },
  spores: { color: 0xb8e080, n: 120, size: 0.14, vel: [0.25, 0.15, 0.25], opacity: 0.6 },
  snow: { color: 0xffffff, n: 220, size: 0.16, vel: [0.3, -1.1, 0.3], opacity: 0.85 },
  embers: { color: 0xff7020, n: 180, size: 0.16, vel: [0.3, 1.4, 0.3], opacity: 0.95, additive: true },
  sparks: { color: 0x80c0ff, n: 90, size: 0.12, vel: [1.6, 0.6, 1.6], opacity: 0.9, additive: true, jitter: true },
  fireflies: { color: 0xd0ff60, n: 70, size: 0.2, vel: [0.5, 0.25, 0.5], opacity: 0.9, additive: true, jitter: true },
  motes: { color: 0xc080ff, n: 140, size: 0.15, vel: [0.15, 0.6, 0.15], opacity: 0.85, additive: true },
};

export function buildWorld(scene, d, theme, lights) {
  const group = new THREE.Group();
  const disposables = [];
  const { W, H, grid } = d;
  const isF = (x, y) => x >= 0 && y >= 0 && x < W && y < H && grid[y * W + x] === FLOOR;
  const tx = themeTextures(theme);
  const cfg = THEME_DECOR[theme.id] || THEME_DECOR.crypt;

  // classify tiles
  const floorTiles = [], wallTiles = [], pillarTiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (grid[y * W + x] === FLOOR) { floorTiles.push([x, y]); continue; }
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && isF(x + dx, y + dy)) n++;
    if (!n) continue;
    if (n === 8 && !d.organic) pillarTiles.push([x, y]); else wallTiles.push([x, y]);
  }

  const m = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();

  // ---- floor: textured slabs, random quarter turns, fake ambient occlusion near walls, darker corridors
  const floorGeo = new THREE.BoxGeometry(TS, 0.2, TS);
  const floorMat = new THREE.MeshLambertMaterial({ map: tx.floor, color: new THREE.Color().setScalar(1.3) });
  if (tx.floorGlow) { floorMat.emissive = new THREE.Color(0xffffff); floorMat.emissiveMap = tx.floorGlow; floorMat.emissiveIntensity = 0.9; }
  const floors = new THREE.InstancedMesh(floorGeo, floorMat, floorTiles.length);
  floorTiles.forEach(([x, y], i) => {
    q.setFromEuler(e.set(0, (Math.floor(rand(0, 4)) * Math.PI) / 2, 0));
    floors.setMatrixAt(i, m.compose(pos.set((x + 0.5) * TS, -0.1, (y + 0.5) * TS), q, sc.set(1, 1, 1)));
    let walls = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!isF(x + dx, y + dy)) walls += dx && dy ? 0.6 : 1;
    const corridor = d.roomOf[y * W + x] < 0 ? 0.82 : 1;
    floors.setColorAt(i, c.setScalar(rand(0.85, 1.08) * corridor * (1 - Math.min(0.42, walls * 0.075))));
  });
  floors.instanceMatrix.needsUpdate = true;
  group.add(floors); disposables.push(floorGeo, floorMat, floors);

  // ---- walls
  const wallMat = new THREE.MeshLambertMaterial({ map: tx.wall, color: 0xffffff, vertexColors: true, flatShading: d.organic });
  if (tx.wallGlow) { wallMat.emissive = new THREE.Color(0xffffff); wallMat.emissiveMap = tx.wallGlow; wallMat.emissiveIntensity = 0.8; }
  let wallGeo;
  if (d.organic) {
    // natural caverns: overlapping boulders instead of bricks
    wallGeo = new THREE.IcosahedronGeometry(1.15, 0);
    const p = wallGeo.attributes.position;
    for (let v = 0; v < p.count; v++) { const k = 1 + Math.sin(p.getX(v) * 3.1 + p.getZ(v) * 2.3) * 0.12; p.setXYZ(v, p.getX(v) * k, p.getY(v), p.getZ(v) * k); }
    wallGeo.computeVertexNormals();
  } else wallGeo = new THREE.BoxGeometry(TS, WALL_H, TS);
  // two-tone: bright caps, dark sides so the walkable floor reads clearly
  const nrm = wallGeo.attributes.normal, wc = new Float32Array(nrm.count * 3);
  for (let v = 0; v < nrm.count; v++) { const k = nrm.getY(v) > 0.6 ? 1.3 : d.organic ? 0.75 + nrm.getY(v) * 0.3 : 0.62; wc[v * 3] = wc[v * 3 + 1] = wc[v * 3 + 2] = k; }
  wallGeo.setAttribute('color', new THREE.BufferAttribute(wc, 3));
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallTiles.length);
  wallTiles.forEach(([x, y], i) => {
    if (d.organic) {
      q.setFromEuler(e.set(rand(-0.2, 0.2), rand(0, Math.PI * 2), rand(-0.2, 0.2)));
      const hgt = rand(0.75, 1.5);
      m.compose(pos.set((x + 0.5) * TS + rand(-0.15, 0.15), hgt * 0.45, (y + 0.5) * TS + rand(-0.15, 0.15)), q, sc.set(rand(0.95, 1.15), hgt, rand(0.95, 1.15)));
    } else {
      const hgt = rand(0.96, 1.06);
      m.compose(pos.set((x + 0.5) * TS, (WALL_H * hgt) / 2, (y + 0.5) * TS), q.identity(), sc.set(1, hgt, 1));
    }
    walls.setMatrixAt(i, m);
    walls.setColorAt(i, c.setScalar(rand(0.85, 1.12)));
  });
  walls.instanceMatrix.needsUpdate = true;
  group.add(walls); disposables.push(wallGeo, wallMat, walls);

  if (!d.organic && wallTiles.length) {
    // dark trim along the top of masonry walls
    const capGeo = new THREE.BoxGeometry(TS * 1.02, 0.14, TS * 1.02), capMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.wall).multiplyScalar(0.55) });
    const caps = new THREE.InstancedMesh(capGeo, capMat, wallTiles.length);
    wallTiles.forEach(([x, y], i) => caps.setMatrixAt(i, m.makeTranslation((x + 0.5) * TS, WALL_H + 0.05, (y + 0.5) * TS)));
    group.add(caps); disposables.push(capGeo, capMat, caps);
  }
  if (pillarTiles.length) {
    const cols = new THREE.InstancedMesh(getColumn(), vcLambert, pillarTiles.length);
    const tint = new THREE.Color(theme.wall).lerp(new THREE.Color(0xffffff), 0.35);
    pillarTiles.forEach(([x, y], i) => { cols.setMatrixAt(i, m.makeTranslation((x + 0.5) * TS, 0, (y + 0.5) * TS)); cols.setColorAt(i, tint); });
    group.add(cols); disposables.push(cols);
  }

  // ---- scattered rubble
  const debrisGeo = new THREE.DodecahedronGeometry(0.16, 0);
  const debrisMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const nDebris = Math.floor(floorTiles.length * 0.1);
  const debris = new THREE.InstancedMesh(debrisGeo, debrisMat, nDebris);
  const dcol = new THREE.Color(theme.wall);
  for (let k = 0; k < nDebris; k++) {
    const [fx, fy] = floorTiles[Math.floor(rand(0, floorTiles.length))];
    q.setFromEuler(e.set(rand(0, 3), rand(0, 3), rand(0, 3)));
    debris.setMatrixAt(k, m.compose(pos.set((fx + rand(0.1, 0.9)) * TS, 0.02, (fy + rand(0.1, 0.9)) * TS), q, sc.set(rand(0.5, 1.4), rand(0.4, 0.9), rand(0.5, 1.4))));
    debris.setColorAt(k, c.copy(dcol).multiplyScalar(rand(0.55, 1)));
  }
  group.add(debris); disposables.push(debrisGeo, debrisMat, debris);

  // ---- theme decorations
  const decor = buildDecor(d, theme, TS);
  group.add(decor.group);
  const lightSpots = [...decor.lights];

  // ---- wall torches (built themes)
  if (cfg.torch) {
    const spots = [];
    for (const [x, y] of wallTiles) {
      if (!chance(0.075)) continue;
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dx, dy]) => isF(x + dx, y + dy));
      if (!dirs.length) continue;
      const [dx, dy] = dirs[0];
      spots.push({ x: (x + 0.5) * TS + dx * (TS / 2 + 0.02), z: (y + 0.5) * TS + dy * (TS / 2 + 0.02), rot: Math.atan2(dx, dy) });
    }
    const tg = getTorch();
    const body = new THREE.InstancedMesh(tg.body, vcLambert, spots.length);
    const flameMat = new THREE.MeshBasicMaterial({ color: cfg.torch, vertexColors: true });
    const flame = new THREE.InstancedMesh(tg.flame, flameMat, spots.length);
    spots.forEach((s, i) => {
      q.setFromEuler(e.set(0, s.rot, 0));
      m.compose(pos.set(s.x, 1.05, s.z), q, sc.set(1, 1, 1));
      body.setMatrixAt(i, m); flame.setMatrixAt(i, m);
      lightSpots.push({ x: s.x + Math.sin(s.rot) * 0.4, y: 1.7, z: s.z + Math.cos(s.rot) * 0.4, color: cfg.torch });
    });
    group.add(body, flame); disposables.push(flameMat, body, flame);
  }

  // ---- exit portal tinted to the theme
  const stairs = buildStairs();
  const [sx, sz] = d.tileCenter(d.end.cx, d.end.cy);
  stairs.position.set(sx, 0, sz);
  stairs.visible = !d.isBoss;
  group.add(stairs);

  // ---- ambient particles around the camera target
  const pcfg = PARTICLES[cfg.particles] || PARTICLES.dust;
  const N = pcfg.n, R = 15;
  const pPos = new Float32Array(N * 3), pVel = new Float32Array(N * 3), pPhase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pPos[i * 3] = rand(-R, R); pPos[i * 3 + 1] = rand(0, 5); pPos[i * 3 + 2] = rand(-R, R);
    pVel[i * 3] = rand(-1, 1) * pcfg.vel[0]; pVel[i * 3 + 1] = pcfg.vel[1] * rand(0.5, 1.3) + (pcfg.vel[1] === 0.05 ? rand(-0.05, 0.05) : 0); pVel[i * 3 + 2] = rand(-1, 1) * pcfg.vel[2];
    pPhase[i] = rand(0, 10);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  const pMat = new THREE.PointsMaterial({ color: pcfg.color, size: pcfg.size * 2.2, map: dotTex || (dotTex = dotTexture()), transparent: true, opacity: pcfg.opacity, depthWrite: false, blending: pcfg.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  group.add(points); disposables.push(pGeo, pMat);
  const origin = { x: sx, z: sz };

  scene.add(group);
  let lightT = 0;
  const torchLights = lights ? lights.torches : [];
  for (const l of torchLights) l.intensity = 0;

  return {
    group, stairs, torches: [], stairsPos: { x: sx, z: sz },
    update(dt, now, player) {
      // particles: wrap around the player so the field never runs out
      const px = player.x, pz = player.z;
      for (let i = 0; i < N; i++) {
        let x = pPos[i * 3] + pVel[i * 3] * dt, y = pPos[i * 3 + 1] + pVel[i * 3 + 1] * dt, z = pPos[i * 3 + 2] + pVel[i * 3 + 2] * dt;
        if (pcfg.jitter) { x += Math.sin(now * 2 + pPhase[i]) * dt * 0.8; y += Math.cos(now * 3 + pPhase[i]) * dt * 0.4; }
        if (y > 5.5) y = 0; if (y < 0) y = 5.5;
        if (x - px > R) x -= 2 * R; else if (x - px < -R) x += 2 * R;
        if (z - pz > R) z -= 2 * R; else if (z - pz < -R) z += 2 * R;
        pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
      }
      pGeo.attributes.position.needsUpdate = true;
      // glowing seams breathe
      if (tx.floorGlow) floorMat.emissiveIntensity = 0.75 + Math.sin(now * 1.7) * 0.25;
      if (tx.wallGlow) wallMat.emissiveIntensity = 0.65 + Math.sin(now * 1.3 + 1) * 0.2;
      for (const mat of decor.pulse) mat.color.setScalar(0.8 + Math.sin(now * 2.2) * 0.2);
      // hand the pooled point lights to the nearest light sources
      lightT -= dt;
      if (lightT <= 0 && torchLights.length) {
        lightT = 0.35;
        const near = lightSpots.map((l) => [dist2(l.x, l.z, px, pz), l]).filter(([dd]) => dd < 22 * 22).sort((a, b) => a[0] - b[0]).slice(0, torchLights.length);
        torchLights.forEach((L, k) => {
          const s = near[k];
          if (!s) { L.userData.on = false; return; }
          L.userData.on = true; L.position.set(s[1].x, s[1].y, s[1].z); L.color.set(s[1].color); L.userData.seed = k * 1.7;
        });
      }
      for (const L of torchLights) {
        const target = L.userData.on ? 16 * (0.85 + Math.sin(now * 9 + L.userData.seed) * 0.08 + Math.sin(now * 23 + L.userData.seed * 3) * 0.05) : 0;
        L.intensity += (target - L.intensity) * Math.min(1, dt * 6);
      }
      if (stairs.visible) { stairs.userData.ring.rotation.y = now; }
    },
    dispose() {
      scene.remove(group);
      for (const x of disposables) x.dispose && x.dispose();
      for (const child of decor.group.children) child.dispose();
      for (const L of torchLights) { L.intensity = 0; L.userData.on = false; }
    },
  };
}

export function setupLights(scene) {
  const hemi = new THREE.HemisphereLight(0xb0b8ff, 0x201810, 0.95);
  const dir = new THREE.DirectionalLight(0xffffff, 0.45);
  dir.position.set(-6, 14, 8);
  const player = new THREE.PointLight(0xffb070, 30, 22, 1.3);
  player.position.set(0, 4, 0);
  // a fixed pool so the shader light count never changes (no recompiles between floors)
  const torches = [];
  for (let i = 0; i < TORCH_LIGHTS; i++) { const l = new THREE.PointLight(0xffa040, 0, 11, 1.6); l.userData = { on: false, seed: i }; torches.push(l); scene.add(l); }
  scene.add(hemi, dir, player);
  return { hemi, dir, player, torches };
}

export function applyTheme(scene, lights, theme) {
  scene.background = new THREE.Color(theme.fog);
  scene.fog = new THREE.Fog(theme.fog, 20, 42);
  lights.player.color.set(theme.light);
  lights.hemi.color.set(theme.light).lerp(new THREE.Color(0xffffff), 0.5);
}
