// Procedural dungeon layout: rooms + wide corridors on a tile grid.
import { randi, rand, pick, shuffle, chance } from './util.js';
import { themeForFloor } from './data/enemies.js';

// Themes whose rooms are eroded into natural caverns instead of built masonry.
export const ORGANIC = new Set(['caves', 'nest', 'frozen', 'swamp']);

export const TS = 2; // world units per tile
export const WALL = 0, FLOOR = 1;

export function generateDungeon(floor) {
  const isBoss = floor % 5 === 0;
  const W = isBoss ? 44 : 56 + Math.min(20, Math.floor(floor / 4) * 2), H = W;
  const grid = new Uint8Array(W * H);
  const rooms = [];
  const target = isBoss ? 5 : randi(9, 13);
  let tries = 0;
  while (rooms.length < target && tries++ < 600) {
    const w = randi(6, 12), h = randi(6, 12);
    const x = randi(2, W - w - 3), y = randi(2, H - h - 3);
    if (rooms.some((r) => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
  }
  if (isBoss && rooms.length) {
    // enlarge the last room into a boss arena
    const r = rooms[rooms.length - 1];
    const nw = Math.min(16, W - r.x - 3), nh = Math.min(16, H - r.y - 3);
    r.w = Math.max(r.w, nw); r.h = Math.max(r.h, nh); r.cx = Math.floor(r.x + r.w / 2); r.cy = Math.floor(r.y + r.h / 2);
  }
  const set = (x, y) => { if (x > 1 && y > 1 && x < W - 2 && y < H - 2) grid[y * W + x] = FLOOR; };
  const theme = themeForFloor(floor), organic = ORGANIC.has(theme.id);
  for (const r of rooms) {
    // built themes mix rectangular halls with round chambers
    r.round = !organic && !isBoss && chance(0.25) && r.w >= 7 && r.h >= 7;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (r.round) { const dx = (x + 0.5 - (r.x + r.w / 2)) / (r.w / 2), dy = (y + 0.5 - (r.y + r.h / 2)) / (r.h / 2); if (dx * dx + dy * dy > 1.05) continue; }
      set(x, y);
    }
  }

  // connect rooms in a chain sorted by position, plus a few extra loops
  const order = [...rooms].sort((a, b) => a.cx + a.cy * 0.5 - (b.cx + b.cy * 0.5));
  const carve = (a, b) => {
    let x = a.cx, y = a.cy;
    const horizFirst = chance(0.5);
    const stepX = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); set(x, y); set(x, y + 1); } };
    const stepY = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); set(x, y); set(x + 1, y); } };
    if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
  };
  for (let i = 1; i < order.length; i++) carve(order[i - 1], order[i]);
  for (let i = 0; i < Math.floor(order.length / 3); i++) carve(pick(order), pick(order));

  if (organic) {
    // erode room borders into ragged caverns, then fill pockets that are mostly open
    for (const r of rooms) for (let pass = 0; pass < 2; pass++)
      for (let y = r.y - 2; y < r.y + r.h + 2; y++) for (let x = r.x - 2; x < r.x + r.w + 2; x++) {
        if (grid[y * W + x] === FLOOR) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (grid[(y + dy) * W + x + dx] === FLOOR) n++;
        if (n >= 3 && chance(0.28 + n * 0.04)) set(x, y);
      }
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (grid[y * W + x] === FLOOR) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (grid[(y + dy) * W + x + dx] === FLOOR) n++;
      if (n >= 6) set(x, y);
    }
  } else {
    // colonnades in big halls; each room's pillars are reverted if they would cut the map apart
    const countFloor = () => { let n = 0; for (let i = 0; i < grid.length; i++) if (grid[i] === FLOOR) n++; return n; };
    for (const r of rooms) {
      if (r.round || r.w < 9 || r.h < 9 || !(isBoss || chance(0.55))) continue;
      const placed = [];
      const rows = [r.y + 2, r.y + r.h - 3], cols = [r.x + 2, r.x + r.w - 3];
      for (const y of rows) for (let x = r.x + 2; x <= r.x + r.w - 3; x += 3) placed.push([x, y]);
      for (const x of cols) for (let y = r.y + 5; y <= r.y + r.h - 6; y += 3) placed.push([x, y]);
      const keep = placed.filter(([x, y]) => grid[y * W + x] === FLOOR && Math.abs(x - r.cx) > 1 && Math.abs(y - r.cy) > 1);
      const before = countFloor();
      for (const [x, y] of keep) grid[y * W + x] = 0;
      const reach = bfs(grid, W, H, r.cx, r.cy).reduce((a, v) => a + (v >= 0 ? 1 : 0), 0);
      if (reach !== before - keep.length) for (const [x, y] of keep) grid[y * W + x] = FLOOR;
    }
  }

  const start = order[0];
  // Stairs go in the room farthest (by BFS) from the start.
  const distMap = bfs(grid, W, H, start.cx, start.cy);
  let far = order[order.length - 1], best = -1;
  for (const r of rooms) { const d = distMap[r.cy * W + r.cx]; if (d > best) { best = d; far = r; } }
  if (isBoss) far = rooms[rooms.length - 1] === start ? far : rooms[rooms.length - 1];

  // which room each floor tile belongs to (-1 = corridor)
  const roomOf = new Int16Array(W * H).fill(-1);
  rooms.forEach((r, i) => {
    for (let y = r.y - 2; y < r.y + r.h + 2; y++) for (let x = r.x - 2; x < r.x + r.w + 2; x++)
      if (x >= 0 && y >= 0 && x < W && y < H && grid[y * W + x] === FLOOR) roomOf[y * W + x] = i;
  });
  const d = { W, H, grid, rooms, roomOf, start, end: far, isBoss, floor, organic, explored: new Uint8Array(W * H) };
  d.isFloor = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && grid[ty * W + tx] === FLOOR;
  d.walkable = (x, z) => d.isFloor(Math.floor(x / TS), Math.floor(z / TS));
  d.tileCenter = (tx, ty) => [(tx + 0.5) * TS, (ty + 0.5) * TS];
  // random open tile in a room (skips pillars and wall-hugging tiles), falling back to the centre
  d.randomPointInRoom = (r, margin = 1) => {
    for (let t = 0; t < 30; t++) {
      const tx = randi(r.x + margin, r.x + r.w - 1 - margin), ty = randi(r.y + margin, r.y + r.h - 1 - margin);
      if (d.isFloor(tx, ty) && d.isFloor(tx + 1, ty) && d.isFloor(tx - 1, ty) && d.isFloor(tx, ty + 1) && d.isFloor(tx, ty - 1)) return d.tileCenter(tx, ty);
    }
    return d.tileCenter(r.cx, r.cy);
  };
  return d;
}

function bfs(grid, W, H, sx, sy) {
  const dist = new Int32Array(W * H).fill(-1);
  const q = [sy * W + sx]; dist[q[0]] = 0;
  for (let i = 0; i < q.length; i++) {
    const c = q[i], x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || grid[n] !== FLOOR || dist[n] >= 0) continue;
      dist[n] = dist[c] + 1; q.push(n);
    }
  }
  return dist;
}

// Circle-vs-grid collision: slide along walls.
export function moveWithCollision(d, pos, dx, dz, r) {
  const tryAxis = (nx, nz) => {
    const pts = [[nx - r, nz - r], [nx + r, nz - r], [nx - r, nz + r], [nx + r, nz + r]];
    return pts.every(([x, z]) => d.walkable(x, z));
  };
  if (tryAxis(pos.x + dx, pos.z)) pos.x += dx;
  if (tryAxis(pos.x, pos.z + dz)) pos.z += dz;
}

// Line of sight by stepping through the grid.
export function hasLOS(d, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  const steps = Math.ceil(len / (TS * 0.4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!d.walkable(ax + dx * t, az + dz * t)) return false;
  }
  return true;
}
