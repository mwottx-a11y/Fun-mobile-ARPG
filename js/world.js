// Builds the three.js representation of a generated dungeon floor.
import * as THREE from 'three';
import { TS, FLOOR } from './dungeon.js';
import { buildTorch, buildStairs } from './models.js';
import { rand, chance } from './util.js';

export const WALL_H = 1.5;

export function buildWorld(scene, d, theme) {
  const group = new THREE.Group();
  const { W, H, grid } = d;
  let nFloor = 0, nWall = 0;
  const isF = (x, y) => x >= 0 && y >= 0 && x < W && y < H && grid[y * W + x] === FLOOR;
  const wallTiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (grid[y * W + x] === FLOOR) { nFloor++; continue; }
    let adj = false;
    for (let dy = -1; dy <= 1 && !adj; dy++) for (let dx = -1; dx <= 1; dx++) if (isF(x + dx, y + dy)) { adj = true; break; }
    if (adj) { wallTiles.push([x, y]); nWall++; }
  }
  const floorGeo = new THREE.BoxGeometry(TS, 0.2, TS);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const floors = new THREE.InstancedMesh(floorGeo, floorMat, nFloor);
  const wallGeo = new THREE.BoxGeometry(TS, WALL_H, TS);
  // two-tone walls: bright caps, dark sides so the walkable floor reads clearly
  const nrm = wallGeo.attributes.normal, wc = new Float32Array(nrm.count * 3);
  for (let v = 0; v < nrm.count; v++) { const k = nrm.getY(v) > 0.5 ? 1.25 : 0.55; wc[v * 3] = wc[v * 3 + 1] = wc[v * 3 + 2] = k; }
  wallGeo.setAttribute('color', new THREE.BufferAttribute(wc, 3));
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, nWall);
  const m = new THREE.Matrix4(), c = new THREE.Color(), base = new THREE.Color(theme.floor), wbase = new THREE.Color(theme.wall);
  let i = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (grid[y * W + x] !== FLOOR) continue;
    m.makeTranslation((x + 0.5) * TS, -0.1, (y + 0.5) * TS);
    floors.setMatrixAt(i, m);
    const checker = ((x + y) & 1) ? 1.0 : 0.92;
    c.copy(base).multiplyScalar(checker * rand(0.85, 1.12));
    floors.setColorAt(i, c);
    i++;
  }
  i = 0;
  for (const [x, y] of wallTiles) {
    const h = rand(0.95, 1.15);
    m.makeScale(1, h, 1).setPosition((x + 0.5) * TS, (WALL_H * h) / 2, (y + 0.5) * TS);
    walls.setMatrixAt(i, m);
    c.copy(wbase).multiplyScalar(rand(0.8, 1.15));
    walls.setColorAt(i, c);
    i++;
  }
  floors.instanceMatrix.needsUpdate = walls.instanceMatrix.needsUpdate = true;
  group.add(floors, walls);

  // scattered rubble / bones for texture
  const debrisGeo = new THREE.DodecahedronGeometry(0.18, 0);
  const debrisMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const nDebris = Math.floor(nFloor * 0.12);
  const debris = new THREE.InstancedMesh(debrisGeo, debrisMat, nDebris);
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), e = new THREE.Euler();
  const dcol = new THREE.Color(theme.wall), bone = new THREE.Color(0xd8d0b8);
  for (let k = 0; k < nDebris; k++) {
    let tx, ty;
    do { tx = Math.floor(rand(0, W)); ty = Math.floor(rand(0, H)); } while (grid[ty * W + tx] !== FLOOR);
    pos.set((tx + rand(0.1, 0.9)) * TS, 0.02, (ty + rand(0.1, 0.9)) * TS);
    q.setFromEuler(e.set(rand(0, 3), rand(0, 3), rand(0, 3)));
    const isBone = chance(0.25);
    sc.set(isBone ? 0.4 : rand(0.5, 1.4), isBone ? 0.35 : rand(0.4, 0.9), isBone ? 2.2 : rand(0.5, 1.4));
    debris.setMatrixAt(k, m.compose(pos, q, sc));
    debris.setColorAt(k, isBone ? bone : c.copy(dcol).multiplyScalar(rand(0.6, 1)));
  }
  group.add(debris);

  // Torches on walls bordering rooms (decor only, no real lights for mobile perf)
  const torches = [];
  for (const [x, y] of wallTiles) {
    if (!chance(0.06)) continue;
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dx, dy]) => isF(x + dx, y + dy));
    if (!dirs.length) continue;
    const [dx, dy] = dirs[0];
    const t = buildTorch();
    t.position.set((x + 0.5) * TS + dx * (TS / 2 + 0.05), 1.0, (y + 0.5) * TS + dy * (TS / 2 + 0.05));
    group.add(t); torches.push(t);
  }

  const stairs = buildStairs();
  const [sx, sz] = d.tileCenter(d.end.cx, d.end.cy);
  stairs.position.set(sx, 0, sz);
  stairs.visible = !d.isBoss;
  group.add(stairs);

  scene.add(group);
  return {
    group, stairs, torches, stairsPos: { x: sx, z: sz },
    dispose() {
      scene.remove(group);
      floorGeo.dispose(); wallGeo.dispose(); floorMat.dispose(); wallMat.dispose(); debrisGeo.dispose(); debrisMat.dispose();
      floors.dispose(); walls.dispose(); debris.dispose();
    },
  };
}

export function setupLights(scene) {
  const hemi = new THREE.HemisphereLight(0xb0b8ff, 0x201810, 0.9);
  const dir = new THREE.DirectionalLight(0xffffff, 0.55);
  dir.position.set(-6, 14, 8);
  const player = new THREE.PointLight(0xffb070, 30, 22, 1.3);
  player.position.set(0, 4, 0);
  scene.add(hemi, dir, player);
  return { hemi, dir, player };
}

export function applyTheme(scene, lights, theme) {
  scene.background = new THREE.Color(theme.fog);
  scene.fog = new THREE.Fog(theme.fog, 20, 42);
  lights.player.color.set(theme.light);
  lights.hemi.color.set(theme.light).lerp(new THREE.Color(0xffffff), 0.5);
}
