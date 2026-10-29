// Game controller: owns the scene, the hero runtime, all entities and the main loop.
import * as THREE from 'three';
import { generateDungeon, moveWithCollision, hasLOS, TS, FLOOR } from './dungeon.js';
import { buildWorld, setupLights, applyTheme } from './world.js';
import { buildHero, setHeroGear, buildMinion, buildDrop, buildGold, buildChest, buildPot, buildShrine, GEO, basic, lambert } from './models.js';
import { FX } from './fx.js';
import { Input } from './input.js';
import { computeStats, xpToNext, ELEM_COLORS } from './stats.js';
import { classById, UNLOCK_LEVELS } from './data/classes.js';
import { raceById } from './data/races.js';
import { themeForFloor, ARCHETYPES } from './data/enemies.js';
import { RARITIES, rarityIndex } from './data/items.js';
import { generateItem, salvageValue } from './loot.js';
import { castSkill, skillCost, skillRange } from './skills.js';
import { playerHit, hurtPlayer, healPlayer, killEnemy } from './combat.js';
import { createEnemy, updateEnemy, rollEliteMods } from './ai.js';
import { rand, randi, pick, chance, dist2, clamp, weighted, power, fmt } from './util.js';
import { saveHero } from './save.js';
import { sfx, setMuted } from './sfx.js';

export const INV_SIZE = 48;
const ACTIVE_R2 = 34 * 34;

const SHRINES = [
  { id: 'power', name: 'Shrine of Power', color: 0xff4040, icon: '💪', mods: { dmgPct: 60 }, desc: '+60% damage' },
  { id: 'haste', name: 'Shrine of Haste', color: 0x40ff80, icon: '⚡', mods: { atkSpd: 40, moveSpd: 30, cdr: 20 }, desc: '+40% attack speed, +30% movement' },
  { id: 'fortune', name: 'Shrine of Fortune', color: 0xffd040, icon: '💰', mods: { mf: 150, gf: 150 }, desc: '+150% magic & gold find' },
  { id: 'protect', name: 'Shrine of Protection', color: 0x4080ff, icon: '🛡️', mods: { dr: 35, resAll: 25 }, desc: '+35% damage reduction' },
  { id: 'wisdom', name: 'Shrine of Wisdom', color: 0xc060ff, icon: '📚', mods: { xp: 75, manaRegenPct: 200 }, desc: '+75% experience' },
  { id: 'carnage', name: 'Shrine of Carnage', color: 0xff8020, icon: '🔥', mods: { critChance: 25, critDmg: 75, aoe: 30 }, desc: '+25% crit chance, +30% area' },
];

export class Game {
  constructor(canvas, ui) {
    this.ui = ui;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 120);
    this.lights = setupLights(this.scene);
    this.fx = new FX(this.scene, this.camera, ui.dmgLayer);
    this.input = new Input();
    this.timers = [];
    this.enemies = []; this.activeEnemies = []; this.projectiles = []; this.projPool = [];
    this.hazards = []; this.minions = []; this.drops = []; this.props = []; this.orbits = [];
    this.running = false; this.paused = false;
    this.camShake = 0; this.zoom = 1;
    this.clock = new THREE.Clock();
    this.saveT = 0; this.mapT = 0; this.hudT = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 62 : 50;
    this.camera.updateProjectionMatrix();
  }
  setQuality(q) { this.renderer.setPixelRatio(Math.min(devicePixelRatio, q)); this.resize(); }

  // ---------- hero lifecycle ----------
  startHero(hero) {
    this.hero = hero;
    this.cls = classById(hero.cls); this.race = raceById(hero.race);
    if (this.player && this.player.mesh) this.scene.remove(this.player.mesh);
    const mesh = buildHero(this.race, this.cls);
    this.scene.add(mesh);
    this.player = {
      pos: mesh.position, mesh, radius: 0.4, hp: 1, mana: 1, facing: 0, atkT: 0, castLock: 0,
      cds: [0, 0, 0, 0, 0], buffs: [], dash: null, invuln: 0, potionCd: 0, chillT: 0, burnT: 0, burnDps: 0,
      poisonT: 0, poisonDps: 0, phoenixCd: 0, secondWindCd: 0, souls: 0, soulT: 0, swing: 0, dead: false, hurtFlash: 0,
      lastTile: -1, trailT: 0, staticT: 0, meteorT: 0,
    };
    this.applySettings();
    this.recompute(true);
    this.loadFloor(hero.floor || 1);
    this.running = true; this.paused = false;
  }

  applySettings() {
    const st = this.hero.settings || (this.hero.settings = {});
    this.zoom = st.zoom || 1;
    if (st.sound === undefined) st.sound = true;
    setMuted(!st.sound);
    this.setQuality(st.quality || 1.5);
  }

  recompute(full = false) {
    const p = this.player;
    const prevMax = this.stats ? this.stats.maxHp : 0, prevMana = this.stats ? this.stats.maxMana : 0;
    this.stats = computeStats(this.hero, p.buffs);
    if (full) { p.hp = this.stats.maxHp; p.mana = this.stats.maxMana; }
    else {
      if (prevMax && this.stats.maxHp > prevMax) p.hp += this.stats.maxHp - prevMax;
      if (prevMana && this.stats.maxMana > prevMana) p.mana += this.stats.maxMana - prevMana;
      p.hp = Math.min(p.hp, this.stats.maxHp); p.mana = Math.min(p.mana, this.stats.maxMana);
    }
    const rh = (it) => RARITIES[rarityIndex(it.rarity)].hex;
    setHeroGear(p.mesh, this.hero.equipped.weapon, this.hero.equipped.offhand, rh);
    if (this.stats.powers.has('orbitblades')) { if (!this.orbits.some((o) => o.id === 'orbitblades')) this.addOrbit({ id: 'orbitblades', count: 3, radius: 2.4, duration: Infinity, hitOpts: { mult: 0.45, elem: 'phys', proc: true }, color: 0xc0d0ff }); }
    else this.removeOrbit('orbitblades');
  }

  get floorLevel() { return this.hero.floor; }

  // ---------- floor management ----------
  clearFloor() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    for (const pr of this.projectiles) this.scene.remove(pr.mesh), this.projPool.push(pr);
    for (const h of this.hazards) this.fx.kill(h.vis);
    for (const m of this.minions) this.scene.remove(m.mesh);
    for (const d of this.drops) this.scene.remove(d.mesh);
    for (const pr of this.props) this.scene.remove(pr.mesh);
    for (const o of this.orbits) for (const m of o.meshes) this.scene.remove(m);
    this.enemies = []; this.activeEnemies = []; this.projectiles = []; this.hazards = []; this.minions = [];
    this.drops = []; this.props = []; this.timers = [];
    this.orbits = [];
    this.fx.clear();
    if (this.world) this.world.dispose();
    this.boss = null;
  }

  loadFloor(floor) {
    this.clearFloor();
    const hero = this.hero;
    hero.floor = floor;
    hero.maxFloor = Math.max(hero.maxFloor || 1, floor);
    this.theme = themeForFloor(floor);
    this.dungeon = generateDungeon(floor);
    this.world = buildWorld(this.scene, this.dungeon, this.theme);
    applyTheme(this.scene, this.lights, this.theme);
    const d = this.dungeon;
    const [sx, sz] = d.tileCenter(d.start.cx, d.start.cy);
    const p = this.player;
    p.pos.set(sx, 0, sz); p.dash = null; p.dead = false; p.buffs = p.buffs.filter((b) => b.shrine);
    p.cds.fill(0);
    hero.potions = this.maxPotions();
    this.flow = new Int32Array(d.W * d.H); p.lastTile = -1;
    this.populate();
    this.recompute();
    p.hp = this.stats.maxHp; p.mana = this.stats.maxMana;
    this.camera.position.set(sx, 16, sz + 10);
    this.ui.onFloorLoaded(floor, this.theme, d.isBoss);
    saveHero(hero);
  }

  maxPotions() { return 4 + Math.floor((this.hero.level || 1) / 15); }

  populate() {
    const d = this.dungeon, floor = this.hero.floor, theme = this.theme;
    const archs = Object.keys(ARCHETYPES);
    for (const room of d.rooms) {
      if (room === d.start) continue;
      if (d.isBoss && room === d.end) continue;
      const area = room.w * room.h;
      const packs = clamp(Math.round(area / 45 + rand(-0.5, 1) + floor * 0.02), 1, 4);
      for (let k = 0; k < packs; k++) {
        const [cx, cz] = d.randomPointInRoom(room, 2);
        const r = Math.random();
        const elite = r < 0.07 + Math.min(0.08, floor * 0.002) ? 2 : r < 0.2 ? 1 : 0;
        const arch = weighted(archs, (a) => ARCHETYPES[a].weight);
        const def = ARCHETYPES[arch];
        let n = def.group ? randi(def.group[0], def.group[1]) : randi(2, 4);
        if (elite === 1) {
          const mods = rollEliteMods(1);
          for (let i = 0; i < Math.min(n, 3); i++) this.spawnAt(arch, cx, cz, 1.6, { elite: 1, mods });
        } else if (elite === 2) {
          this.spawnAt(arch, cx, cz, 0.5, { elite: 2, mods: rollEliteMods(randi(2, Math.min(4, 2 + Math.floor(floor / 15)))) });
          for (let i = 0; i < randi(2, 4); i++) this.spawnAt(weighted(archs, (a) => ARCHETYPES[a].weight), cx, cz, 2);
        } else for (let i = 0; i < n; i++) this.spawnAt(arch, cx, cz, 1.8);
      }
      // props
      if (chance(0.35)) this.addProp('chest', ...d.randomPointInRoom(room, 1));
      for (let i = 0; i < randi(0, 3); i++) this.addProp('pot', ...d.randomPointInRoom(room, 0));
    }
    if (!d.isBoss && chance(0.65)) {
      const room = pick(d.rooms.filter((r) => r !== d.start));
      if (room) this.addProp('shrine', ...d.randomPointInRoom(room, 2));
    }
    if (d.isBoss) {
      const [bx, bz] = d.tileCenter(d.end.cx, d.end.cy);
      this.boss = createEnemy(this, 'brute', bx, bz, { boss: true });
    }
  }

  spawnAt(arch, cx, cz, spread, opts) {
    for (let t = 0; t < 8; t++) {
      const x = cx + rand(-spread, spread), z = cz + rand(-spread, spread);
      if (this.dungeon.walkable(x, z)) return createEnemy(this, arch, x, z, opts);
    }
    return createEnemy(this, arch, cx, cz, opts);
  }

  addProp(kind, x, z) {
    let mesh, data = { kind, x, z, used: false };
    if (kind === 'chest') { mesh = buildChest(); mesh.rotation.y = pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]); }
    else if (kind === 'pot') mesh = buildPot();
    else { data.shrine = pick(SHRINES); mesh = buildShrine(data.shrine.color); }
    mesh.position.set(x, 0, z);
    data.mesh = mesh;
    this.scene.add(mesh);
    this.props.push(data);
  }

  descend() {
    const next = this.hero.floor + 1;
    this.ui.toast(`Descending to floor ${next}...`);
    sfx('stairs');
    this.loadFloor(next);
  }

  // ---------- flow field toward the player ----------
  updateFlow() {
    const d = this.dungeon, p = this.player;
    const tx = Math.floor(p.pos.x / TS), ty = Math.floor(p.pos.z / TS);
    const t = ty * d.W + tx;
    if (t === p.lastTile || !d.isFloor(tx, ty)) return;
    p.lastTile = t;
    const f = this.flow; f.fill(-1);
    const q = new Int32Array(d.W * d.H); let qh = 0, qt = 0;
    q[qt++] = t; f[t] = 0;
    while (qh < qt) {
      const c = q[qh++], x = c % d.W, y = (c / d.W) | 0;
      if (f[c] > 40) continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
        const n = ny * d.W + nx;
        if (nx < 0 || ny < 0 || nx >= d.W || ny >= d.H || d.grid[n] !== FLOOR || f[n] >= 0) continue;
        f[n] = f[c] + 1; q[qt++] = n;
      }
    }
  }
  flowDir(x, z) {
    const d = this.dungeon, tx = Math.floor(x / TS), ty = Math.floor(z / TS);
    const c = this.flow[ty * d.W + tx];
    let best = null, bv = c < 0 ? 1e9 : c;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = tx + dx, ny = ty + dy;
      if (!d.isFloor(nx, ny)) continue;
      if (dx && dy && (!d.isFloor(tx + dx, ty) || !d.isFloor(tx, ty + dy))) continue;
      const v = this.flow[ny * d.W + nx];
      if (v >= 0 && v < bv) { bv = v; best = [nx, ny]; }
    }
    if (!best) return [0, 0];
    const [cx, cz] = d.tileCenter(best[0], best[1]);
    const ddx = cx - x, ddz = cz - z, l = Math.hypot(ddx, ddz) || 1;
    return [ddx / l, ddz / l];
  }

  // ---------- helpers used by skills/combat ----------
  schedule(delay, fn) { this.timers.push({ t: delay, fn }); }
  shake(a) { if (this.hero.settings.shake !== false) this.camShake = Math.max(this.camShake, a); }

  findTarget(range, from = this.player.pos) {
    let best = null, bd = range * range;
    for (const e of this.activeEnemies) {
      if (e.dead) continue;
      const d = dist2(e.pos.x, e.pos.z, from.x, from.z) - (e.radius * e.radius);
      if (d < bd && hasLOS(this.dungeon, from.x, from.z, e.pos.x, e.pos.z)) { bd = d; best = e; }
    }
    return best;
  }

  aoePlayer(x, z, r, opts) {
    for (const e of this.activeEnemies) {
      if (e.dead) continue;
      const rr = r + e.radius;
      if (dist2(e.pos.x, e.pos.z, x, z) <= rr * rr) playerHit(this, e, opts);
    }
  }
  aoeRaw(x, z, r, amount, elem) {
    for (const e of this.activeEnemies) {
      if (e.dead) continue;
      if (dist2(e.pos.x, e.pos.z, x, z) <= (r + e.radius) ** 2) {
        e.hp -= amount; this.fx.text(e.pos.x, 1.5, e.pos.z, fmt(amount), 'fire');
        if (e.hp <= 0) killEnemy(this, e);
      }
    }
  }
  // Telegraphed enemy area attack.
  enemyAoe(x, z, r, dmg, elem, delay, src = null) {
    const col = ELEM_COLORS[elem] || 0xff3020;
    if (delay > 0.05) this.fx.telegraph(x, z, r, delay, elem === 'phys' ? 0xff3020 : col);
    const go = () => {
      if (src && src.dead && src.def.ai !== 'bomber') return;
      this.fx.flash(x, z, r, col, 0.3, 0.6);
      this.fx.burst(x, 0.4, z, col, 14, 5, 0.4);
      const p = this.player;
      if (!p.dead && dist2(p.pos.x, p.pos.z, x, z) <= (r + p.radius) ** 2) hurtPlayer(this, dmg, elem, src, src ? src.level : this.floorLevel);
      for (const m of this.minions) if (dist2(m.pos.x, m.pos.z, x, z) <= (r + 0.4) ** 2) this.hurtMinion(m, dmg);
    };
    if (delay > 0) this.schedule(delay, go); else go();
  }

  spawnProjectile(o) {
    let pr = this.projPool.pop();
    if (!pr) {
      const mesh = new THREE.Mesh(GEO.sphere(), basic(0xffffff));
      pr = { mesh };
    }
    pr.mesh.material = basic(o.color ?? 0xffffff);
    const sz = o.size || 0.25;
    pr.mesh.scale.set(sz, sz, sz);
    if (o.elem === 'phys' && o.owner === 'player' && sz < 0.4) pr.mesh.scale.set(sz * 0.5, sz * 0.5, sz * 2.4);
    Object.assign(pr, { owner: o.owner, x: o.x, z: o.z, ang: o.ang, speed: o.speed, life: (o.range || 14) / o.speed, size: sz,
      elem: o.elem, pierce: o.pierce || 0, explode: o.explode || 0, homing: !!o.homing, wobble: !!o.wobble, hitOpts: o.hitOpts,
      split: o.split, dmg: o.dmg, src: o.src, color: o.color, hit: new Set(), t: 0, noSplit: !!o.noSplit });
    pr.mesh.position.set(o.x, 1, o.z);
    pr.mesh.rotation.y = o.ang;
    this.scene.add(pr.mesh);
    this.projectiles.push(pr);
    return pr;
  }

  addHazard(h) {
    h.t = h.duration; h.tickT = 0;
    h.vis = this.fx.zone(h.x, h.z, h.radius, h.color, 0.14);
    this.hazards.push(h);
  }

  spawnMeteorVisual(x, z, delay) {
    const m = new THREE.Mesh(GEO.sphere(), basic(0xff6020));
    m.scale.setScalar(0.8);
    this.scene.add(m);
    const start = performance.now();
    const step = () => {
      const t = (performance.now() - start) / 1000 / delay;
      if (t >= 1 || !this.running) { this.scene.remove(m); return; }
      m.position.set(x - 6 * (1 - t), 14 * (1 - t) + 0.5, z - 3 * (1 - t));
      this.fx.burst(m.position.x, m.position.y, m.position.z, 0xff8030, 2, 1, 0.3, 0);
      requestAnimationFrame(step);
    };
    step();
  }

  addBuff(b) {
    const p = this.player;
    const ex = p.buffs.find((x) => x.id === b.id);
    if (ex) Object.assign(ex, b, { t: b.duration });
    else p.buffs.push({ ...b, t: b.duration });
    this.recompute();
  }

  addOrbit(o) {
    this.removeOrbit(o.id);
    const meshes = [];
    for (let i = 0; i < o.count; i++) {
      const m = new THREE.Mesh(o.id === 'orbitblades' ? GEO.box() : GEO.oct(), basic(o.color));
      m.scale.set(0.35, 0.12, o.id === 'orbitblades' ? 0.7 : 0.35);
      if (o.id !== 'orbitblades') m.scale.set(0.35, 0.45, 0.35);
      this.scene.add(m); meshes.push(m);
    }
    this.orbits.push({ ...o, t: o.duration, ang: 0, meshes, hitCd: new Map() });
  }
  removeOrbit(id) {
    const i = this.orbits.findIndex((o) => o.id === id);
    if (i >= 0) { for (const m of this.orbits[i].meshes) this.scene.remove(m); this.orbits.splice(i, 1); }
  }

  spawnMinion(kind, sk, rank) {
    const p = this.player, s = this.stats;
    const mine = this.minions.filter((m) => m.kind === kind);
    if (mine.length >= sk.max) { const old = mine[0]; this.removeMinion(old); }
    const mesh = buildMinion(kind);
    const a = rand(0, Math.PI * 2);
    let x = p.pos.x + Math.sin(a) * 1.5, z = p.pos.z + Math.cos(a) * 1.5;
    if (!this.dungeon.walkable(x, z)) { x = p.pos.x; z = p.pos.z; }
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const maxHp = s.maxHp * 0.45 * sk.hpMult * (1 + s.minionHp / 100) * (1 + 0.1 * (rank - 1));
    this.minions.push({ kind, mesh, pos: mesh.position, hp: maxHp, maxHp, radius: 0.4, atkT: 0, target: null,
      ranged: kind === 'imp', speed: kind === 'wolf' ? 7.5 : 5.5, dmgMult: sk.dmgMult * (1 + s.minionDmg / 100) * (1 + 0.15 * (rank - 1)),
      elem: kind === 'imp' ? 'fire' : 'phys', facing: 0, retarget: 0 });
    this.fx.burst(x, 0.5, z, 0x80ff80, 12, 4, 0.5);
  }
  hurtMinion(m, dmg) {
    m.hp -= dmg * 0.6;
    if (m.hp <= 0) this.removeMinion(m);
  }
  removeMinion(m) {
    m.dead = true;
    this.fx.burst(m.pos.x, 0.6, m.pos.z, 0xd0d0d0, 10, 3, 0.4);
    this.scene.remove(m.mesh);
    const i = this.minions.indexOf(m);
    if (i >= 0) this.minions.splice(i, 1);
  }

  dashPlayer(fx, fz, dist, time, pathOpts, onDone, leap = false) {
    const p = this.player;
    if (time <= 0.02) {
      // blink: step along until blocked
      const steps = Math.ceil(dist / 0.3);
      for (let i = 0; i < steps; i++) {
        const nx = p.pos.x + fx * 0.3, nz = p.pos.z + fz * 0.3;
        if (!this.dungeon.walkable(nx, nz)) break;
        p.pos.x = nx; p.pos.z = nz;
      }
      p.invuln = Math.max(p.invuln, 0.2);
      onDone && onDone();
      return;
    }
    p.dash = { vx: (fx * dist) / time, vz: (fz * dist) / time, t: time, total: time, pathOpts, hit: new Set(), onDone, leap };
    p.invuln = Math.max(p.invuln, time + 0.1);
  }

  spawnGold(x, z, lvl, mult = 1) {
    const amt = Math.max(1, Math.round(power(lvl) * rand(3, 8) * mult * (1 + this.stats.gf / 100)));
    const mesh = buildGold();
    mesh.position.set(x + rand(-0.6, 0.6), 0, z + rand(-0.6, 0.6));
    this.scene.add(mesh);
    this.drops.push({ gold: amt, mesh, pos: mesh.position, t: 0 });
  }

  spawnItem(x, z, opts) {
    const s = this.stats;
    const item = generateItem({ ilvl: opts.ilvl ?? this.floorLevel, floor: this.hero.floor, mf: s.mf, minRarity: opts.minRarity || 0, rarity: opts.rarity });
    const rar = RARITIES[rarityIndex(item.rarity)];
    const mesh = buildDrop(item, rar);
    const a = rand(0, Math.PI * 2), r = rand(0.3, 1.4);
    let px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
    if (!this.dungeon.walkable(px, pz)) { px = x; pz = z; }
    mesh.position.set(px, 0, pz);
    this.scene.add(mesh);
    this.drops.push({ item, mesh, pos: mesh.position, t: rand(0, 6), delay: 0.5 });
    if (rarityIndex(item.rarity) >= 4) {
      sfx('epic');
      this.ui.toast(`${rar.name} drop: ${item.name}!`, item.rarity);
      this.fx.burst(px, 1, pz, rar.hex, 30, 6, 0.9);
    }
  }

  onEnemyKilled(e) {
    const hero = this.hero, s = this.stats;
    hero.kills = (hero.kills || 0) + 1;
    this.fx.burst(e.pos.x, 0.8 * e.scale, e.pos.z, this.theme.color, 14, 5, 0.6);
    this.scene.remove(e.mesh);
    this.addXp(22 * power(e.level) * e.xp * s.xpMult);
    const ilvl = e.level + (e.elite ? 1 : 0) + (e.boss ? 2 : 0);
    // loot
    let items = 0, minR = 0;
    if (e.boss) { items = 5 + randi(0, 2); minR = 2; }
    else if (e.elite === 2) { items = randi(2, 3); minR = 1; }
    else if (e.elite === 1) items = chance(0.6) ? 1 : 0;
    else if (chance(e.minionOf ? 0.02 : 0.085)) items = 1;
    if (e.elite && s.powers.has('treasure')) items++;
    for (let i = 0; i < items; i++) this.spawnItem(e.pos.x, e.pos.z, { ilvl, minRarity: minR });
    if (e.boss) {
      this.spawnItem(e.pos.x, e.pos.z, { ilvl: ilvl + 1, minRarity: 4 });
      hero.bossKills = (hero.bossKills || 0) + 1;
      this.world.stairs.visible = true;
      this.ui.toast(`${e.name} has been slain!`, 'legendary');
      this.ui.bossBar(null);
      this.shake(0.5);
      for (let i = 0; i < 8; i++) this.spawnGold(e.pos.x, e.pos.z, e.level, 3);
    }
    if (chance(e.boss ? 1 : e.elite ? 0.8 : 0.3)) this.spawnGold(e.pos.x, e.pos.z, e.level, e.elite ? 3 : 1);
    if (hero.potions < this.maxPotions() && chance(e.elite ? 0.35 : 0.035)) { hero.potions++; this.fx.text(this.player.pos.x, 2.6, this.player.pos.z, '+1 Potion', 'heal'); }
    if (e.minionOf) e.minionOf.summoned = Math.max(0, (e.minionOf.summoned || 1) - 1);
  }

  addXp(amt) {
    const hero = this.hero;
    hero.xp += amt;
    let need = xpToNext(hero.level);
    let leveled = false;
    while (hero.xp >= need) {
      hero.xp -= need; hero.level++; hero.statPoints += 3; hero.skillPoints += 1; leveled = true;
      UNLOCK_LEVELS.forEach((lv, i) => {
        if (hero.level >= lv && !hero.skillRanks[i]) { hero.skillRanks[i] = 1; this.ui.toast(`New skill unlocked: ${this.cls.skills[i].name}!`, 'epic'); this.ui.buildSkillButtons(); }
      });
      need = xpToNext(hero.level);
    }
    if (leveled) {
      this.recompute();
      const p = this.player;
      p.hp = this.stats.maxHp; p.mana = this.stats.maxMana;
      this.fx.ring(p.pos.x, p.pos.z, 4, 0xffe080, 0.8);
      this.fx.burst(p.pos.x, 1, p.pos.z, 0xffe080, 40, 7, 1, -1);
      this.ui.toast(`Level up! You are now level ${hero.level}`, 'levelup');
      sfx('levelup');
      this.ui.markAlerts();
    }
  }

  playerDied() {
    const p = this.player;
    if (p.dead) return;
    p.dead = true; p.hp = 0;
    sfx('death');
    const lost = Math.floor(this.hero.gold * 0.05);
    this.hero.gold -= lost;
    this.hero.deaths = (this.hero.deaths || 0) + 1;
    this.fx.burst(p.pos.x, 1, p.pos.z, 0xff2020, 40, 6, 1);
    saveHero(this.hero);
    setTimeout(() => this.ui.showDeath(lost), 900);
  }

  respawn(floor) {
    this.player.dead = false;
    this.player.buffs = [];
    this.loadFloor(floor);
  }

  usePotion() {
    const p = this.player, hero = this.hero;
    if (p.dead || p.potionCd > 0 || hero.potions <= 0 || p.hp >= this.stats.maxHp) return;
    hero.potions--; p.potionCd = 1.2;
    sfx('potion');
    healPlayer(this, this.stats.maxHp * 0.45 * this.stats.potionMult);
    p.poisonT = p.burnT = 0;
    this.fx.burst(p.pos.x, 1, p.pos.z, 0xff4060, 16, 3, 0.6, -2);
  }

  // ---------- inventory ----------
  pickup(item) {
    const hero = this.hero;
    const auto = hero.settings.autoSalvage || 0;
    if (rarityIndex(item.rarity) < auto) {
      const v = salvageValue(item);
      hero.essence += v.essence; hero.gold += v.gold;
      this.ui.lootFeed(`♻ ${item.name} → ${v.essence} essence`, item.rarity, true);
      return true;
    }
    if (hero.inventory.length >= INV_SIZE) return false;
    hero.inventory.push(item);
    sfx('loot');
    this.ui.lootFeed(item.name, item.rarity);
    this.ui.markAlerts();
    return true;
  }

  // ---------- main loop ----------
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.running && !this.paused) this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    const p = this.player, s = this.stats, hero = this.hero;
    this.input.update();
    hero.playTime = (hero.playTime || 0) + dt;

    // timers
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
    }

    this.updatePlayer(dt);
    this.updateFlow();

    // active enemies
    this.activeEnemies.length = 0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) { this.enemies.splice(i, 1); continue; }
      const d2 = dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z);
      e.mesh.visible = d2 < ACTIVE_R2 * 1.2;
      if (d2 < ACTIVE_R2 || e.boss) this.activeEnemies.push(e);
    }
    for (const e of this.activeEnemies) if (!e.dead) updateEnemy(this, e, dt);
    this.separate();
    this.updateMinions(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updateOrbits(dt);
    this.updateDrops(dt);
    this.updateProps(dt);
    this.fx.update(dt);

    // world anim
    const now = performance.now() / 1000;
    if (this.world.stairs.visible) this.world.stairs.userData.ring.rotation.y = now;
    for (const t of this.world.torches) t.userData.flame.scale.y = 0.2 * (0.85 + Math.sin(now * 12 + t.position.x) * 0.15);

    // camera
    const z = this.zoom * (innerWidth < innerHeight ? 1.4 : 0.88);
    const tx = p.pos.x, tz = p.pos.z + 9.5 * z;
    this.camera.position.x += (tx - this.camera.position.x) * Math.min(1, dt * 8);
    this.camera.position.z += (tz - this.camera.position.z) * Math.min(1, dt * 8);
    this.camera.position.y = 15.5 * z;
    if (this.camShake > 0) {
      this.camShake = Math.max(0, this.camShake - dt);
      this.camera.position.x += rand(-1, 1) * this.camShake * 0.6;
      this.camera.position.z += rand(-1, 1) * this.camShake * 0.6;
    }
    this.camera.lookAt(this.camera.position.x, 0, this.camera.position.z - 9.5 * z);
    const camDist = 18.2 * z;
    this.scene.fog.near = camDist + 2; this.scene.fog.far = camDist + 26;
    this.lights.player.position.set(p.pos.x, 4.5, p.pos.z + 1);

    // HUD
    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = 0.2; this.ui.updateMinimap(this); }
    this.ui.updateHud(this);
    this.saveT += dt;
    if (this.saveT > 20) { this.saveT = 0; saveHero(hero); }
  }

  updatePlayer(dt) {
    const p = this.player, s = this.stats, input = this.input, hero = this.hero;
    if (p.dead) { p.mesh.rotation.z = Math.min(Math.PI / 2, p.mesh.rotation.z + dt * 4); return; }
    p.mesh.rotation.z = 0;

    // regen and timers
    p.hp = Math.min(s.maxHp, p.hp + s.hpRegen * s.healMult * dt);
    p.mana = Math.min(s.maxMana, p.mana + s.manaRegen * dt);
    for (let i = 0; i < 5; i++) if (p.cds[i] > 0) p.cds[i] -= dt;
    p.atkT -= dt; p.castLock -= dt; p.invuln -= dt; p.potionCd -= dt; p.swing -= dt;
    p.phoenixCd -= dt; p.secondWindCd -= dt; p.hurtFlash -= dt;
    if (p.chillT > 0) p.chillT -= dt;
    if (p.burnT > 0) { p.burnT -= dt; p.hp -= p.burnDps * dt * (1 - s.res.fire / 100); }
    if (p.poisonT > 0) { p.poisonT -= dt; p.hp -= p.poisonDps * dt * (1 - s.res.poison / 100); }
    if (p.hp <= 0 && !p.dead) { p.hp = 1; hurtPlayer(this, 2, 'phys'); }
    if (p.soulT > 0) { p.soulT -= dt; if (p.soulT <= 0) p.souls = 0; }

    // buffs
    let changed = false;
    for (let i = p.buffs.length - 1; i >= 0; i--) {
      const b = p.buffs[i];
      b.t -= dt;
      if (b.pulse) {
        b.pulse.t -= dt;
        if (b.pulse.t <= 0) {
          b.pulse.t = b.pulse.interval;
          const r = b.pulse.radius * (1 + s.aoe / 100), col = ELEM_COLORS[b.pulse.elem];
          if (b.id === 'whirlwind') this.fx.arc(p.pos.x, p.pos.z, 0, r, 360, col, 0.2);
          else { this.fx.ring(p.pos.x, p.pos.z, r, col, 0.3); }
          if (b.pulse.elem === 'light') {
            for (const e of this.activeEnemies) if (!e.dead && dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z) < r * r && chance(0.5)) this.fx.bolt([[p.pos.x, 1.2, p.pos.z], [e.pos.x, 1, e.pos.z]], col, 0.12);
          }
          this.aoePlayer(p.pos.x, p.pos.z, r, { mult: b.pulse.mult, elem: b.pulse.elem, skill: b.id, rank: b.pulse.rank });
        }
      }
      if (b.t <= 0) { p.buffs.splice(i, 1); changed = true; }
    }
    if (changed) this.recompute();

    // power ticks
    if (s.powers.has('inferno')) {
      p.trailT -= dt;
      if (p.trailT <= 0 && input.moveLen > 0.2) { p.trailT = 0.35; this.addHazard({ owner: 'player', x: p.pos.x, z: p.pos.z, radius: 1.3, duration: 2.5, tick: 0.5, hitOpts: { mult: 0.25, elem: 'fire', status: 'burn', statusChance: 0.5, proc: true, noText: false }, color: 0xff5010 }); }
    }
    if (s.powers.has('staticfield')) {
      p.staticT -= dt;
      if (p.staticT <= 0) {
        p.staticT = 1;
        let n = 0;
        for (const e of this.activeEnemies) {
          if (e.dead || n >= 3 || dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z) > 49) continue;
          n++;
          this.fx.bolt([[p.pos.x, 1.3, p.pos.z], [e.pos.x, 1, e.pos.z]], 0x80d0ff, 0.15);
          playerHit(this, e, { mult: 0.6, elem: 'light', status: 'shock', statusChance: 0.3, proc: true });
        }
      }
    }
    if (s.powers.has('meteoric')) {
      p.meteorT -= dt;
      if (p.meteorT <= 0) {
        const t = this.findTarget(12);
        if (t) {
          p.meteorT = 4;
          const x = t.pos.x, z = t.pos.z;
          this.fx.telegraph(x, z, 3, 0.8, 0xff6020);
          this.spawnMeteorVisual(x, z, 0.8);
          this.schedule(0.8, () => { this.fx.flash(x, z, 3, 0xff6020, 0.4, 0.8); this.fx.burst(x, 0.5, z, 0xff6020, 24, 8, 0.6); this.aoePlayer(x, z, 3, { mult: 3, elem: 'fire', status: 'burn', statusChance: 1, proc: true }); });
        }
      }
    }

    // dash movement
    if (p.dash) {
      const d = p.dash;
      d.t -= dt;
      moveWithCollision(this.dungeon, p.pos, d.vx * dt, d.vz * dt, p.radius);
      if (d.leap) p.mesh.position.y = Math.sin((1 - d.t / d.total) * Math.PI) * 2.2;
      if (d.pathOpts) for (const e of this.activeEnemies) {
        if (e.dead || d.hit.has(e)) continue;
        if (dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z) < (1.4 + e.radius) ** 2) { d.hit.add(e); playerHit(this, e, d.pathOpts); }
      }
      this.fx.burst(p.pos.x, 0.8, p.pos.z, 0xffffff, 1, 1, 0.3, 0);
      if (d.t <= 0) { p.dash = null; p.mesh.position.y = 0; d.onDone && d.onDone(); }
      return;
    }

    // movement
    const spd = s.moveSpeed * (p.chillT > 0 ? 0.65 : 1);
    let moving = false;
    if (input.moveLen > 0.12 && p.castLock <= 0) {
      moveWithCollision(this.dungeon, p.pos, input.mx * spd * dt * input.moveLen, input.mz * spd * dt * input.moveLen, p.radius);
      if (p.swing <= 0) p.facing = Math.atan2(input.mx, input.mz);
      moving = true;
    }

    // attacks and skills
    const skills = this.cls.skills;
    for (let i = 1; i < 5; i++) {
      if (!input.isHeld(i) || !hero.skillRanks[i] || p.cds[i] > 0 || p.castLock > 0) continue;
      const sk = skills[i];
      const cost = skillCost(this, sk);
      if (s.powers.has('bloodpact')) {
        const hpCost = cost * s.maxHp * 0.004;
        if (p.hp <= hpCost + 1) continue;
        p.hp -= hpCost;
      } else {
        if (p.mana < cost) { this.ui.flashMana(); continue; }
        p.mana -= cost;
      }
      const target = this.findTarget(skillRange(sk) + 2);
      castSkill(this, i, target);
      p.cds[i] = (sk.cd || 0) * (1 - s.cdr / 100);
      p.castLock = 0.12; p.atkT = Math.max(p.atkT, 0.15);
    }
    const sk0 = skills[0];
    const auto = hero.settings.autoAttack && !moving && this.findTarget(skillRange(sk0) + 1);
    if ((input.isHeld(0) || auto) && p.atkT <= 0 && p.castLock <= 0) {
      const range = skillRange(sk0);
      const target = this.findTarget(sk0.type === 'melee' ? 9 : range + 1);
      const reach = target ? Math.sqrt(dist2(target.pos.x, target.pos.z, p.pos.x, p.pos.z)) - target.radius : Infinity;
      if (sk0.type === 'melee' && target && reach > range * 0.9 && !moving) {
        // walk toward target
        const dx = target.pos.x - p.pos.x, dz = target.pos.z - p.pos.z, l = Math.hypot(dx, dz);
        moveWithCollision(this.dungeon, p.pos, (dx / l) * spd * dt, (dz / l) * spd * dt, p.radius);
        p.facing = Math.atan2(dx, dz); moving = true;
      } else {
        castSkill(this, 0, target && reach <= range + 1 ? target : (sk0.type !== 'melee' ? target : null));
        p.atkT = 1 / (s.attacksPerSec * (sk0.speed || 1));
      }
    }
    if (input.potion || input.kbPotion) { this.usePotion(); input.potion = false; }

    // model anim
    p.mesh.rotation.y = p.facing;
    const body = p.mesh.userData.body;
    const now = performance.now() / 1000;
    body.position.y = moving ? Math.abs(Math.sin(now * 11)) * 0.1 : Math.sin(now * 2) * 0.02;
    const rh = p.mesh.userData.rightHand;
    if (p.swing > 0) { rh.rotation.x = -1.6 + (1 - p.swing / 0.25) * 2.4; }
    else rh.rotation.x = moving ? Math.sin(now * 11) * 0.4 : 0;
    p.mesh.userData.leftHand.rotation.x = moving ? -Math.sin(now * 11) * 0.4 : 0;
    p.mesh.visible = !(p.invuln > 0 && p.invuln < 1.5 && !p.dash && Math.floor(now * 20) % 2 === 0 && s.powers.has('phoenix') && p.phoenixCd > 85);

    // reveal map
    const d = this.dungeon, ptx = Math.floor(p.pos.x / TS), pty = Math.floor(p.pos.z / TS);
    for (let y = pty - 7; y <= pty + 7; y++) for (let x = ptx - 7; x <= ptx + 7; x++) if (x >= 0 && y >= 0 && x < d.W && y < d.H) d.explored[y * d.W + x] = 1;

    // stairs
    const st = this.world.stairsPos;
    this.nearStairs = this.world.stairs.visible && dist2(st.x, st.z, p.pos.x, p.pos.z) < 2.6 * 2.6;
  }

  separate() {
    const list = this.activeEnemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const r = (a.radius + b.radius) * 0.9;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r && d2 > 0.0001) {
          const d = Math.sqrt(d2), push = (r - d) * 0.5;
          const nx = dx / d, nz = dz / d;
          const wa = a.boss ? 0 : 1, wb = b.boss ? 0 : 1;
          moveWithCollision(this.dungeon, a.pos, -nx * push * wa, -nz * push * wa, a.radius * 0.8);
          moveWithCollision(this.dungeon, b.pos, nx * push * wb, nz * push * wb, b.radius * 0.8);
        }
      }
      // keep off the player
      const p = this.player;
      const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z, r = a.radius + p.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 0.0001 && !a.boss) { const d = Math.sqrt(d2); moveWithCollision(this.dungeon, a.pos, (dx / d) * (r - d), (dz / d) * (r - d), a.radius * 0.8); }
    }
  }

  updateMinions(dt) {
    const p = this.player;
    for (const m of [...this.minions]) {
      m.atkT -= dt; m.retarget -= dt;
      if (m.retarget <= 0 || !m.target || m.target.dead) { m.retarget = 0.4; m.target = this.findTarget(m.ranged ? 11 : 9, m.pos); }
      const t = m.target;
      let mx = 0, mz = 0;
      const dp = Math.sqrt(dist2(m.pos.x, m.pos.z, p.pos.x, p.pos.z));
      if (dp > 14) { m.pos.x = p.pos.x + rand(-1, 1); m.pos.z = p.pos.z + rand(-1, 1); }
      if (t && dp < 12) {
        const dx = t.pos.x - m.pos.x, dz = t.pos.z - m.pos.z, d = Math.hypot(dx, dz);
        const range = m.ranged ? 8 : 1.3 + t.radius;
        if (d > range) { mx = dx / d; mz = dz / d; }
        m.facing = Math.atan2(dx, dz);
        if (d <= range + 0.2 && m.atkT <= 0) {
          m.atkT = m.ranged ? 1.1 : 0.85;
          if (m.ranged) this.spawnProjectile({ owner: 'player', x: m.pos.x, z: m.pos.z, ang: m.facing, speed: 16, range: 12, size: 0.25, elem: 'fire', color: 0xff6020, hitOpts: { mult: 1, elem: 'fire', minion: m.dmgMult, proc: true } });
          else { playerHit(this, t, { mult: 1, elem: m.elem, minion: m.dmgMult, proc: true }); this.fx.arc(m.pos.x, m.pos.z, m.facing, 1.5, 90, 0xffffff, 0.12); }
        }
      } else if (dp > 2.5) {
        const dx = p.pos.x - m.pos.x, dz = p.pos.z - m.pos.z, d = Math.hypot(dx, dz);
        mx = dx / d; mz = dz / d; m.facing = Math.atan2(dx, dz);
      }
      if (mx || mz) {
        moveWithCollision(this.dungeon, m.pos, mx * m.speed * dt, mz * m.speed * dt, 0.3);
        m.mesh.userData.body.position.y = Math.abs(Math.sin(performance.now() / 90)) * 0.1;
      }
      if (m.kind === 'imp') m.mesh.userData.body.position.y = 0.3 + Math.sin(performance.now() / 200) * 0.15;
      m.mesh.rotation.y = m.facing;
    }
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt; pr.t += dt;
      let dead = pr.life <= 0;
      if (pr.homing && pr.owner === 'player') {
        const t = this.findTargetNoLos(pr.x, pr.z, 7, pr.hit);
        if (t) {
          const want = Math.atan2(t.pos.x - pr.x, t.pos.z - pr.z);
          let da = want - pr.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
          pr.ang += clamp(da, -6 * dt, 6 * dt);
        }
      }
      const wob = pr.wobble ? Math.sin(pr.t * 9) * 0.9 : 0;
      const ang = pr.ang + wob;
      pr.x += Math.sin(ang) * pr.speed * dt; pr.z += Math.cos(ang) * pr.speed * dt;
      pr.mesh.position.set(pr.x, pr.wobble ? 0.8 : 1, pr.z);
      pr.mesh.rotation.y = ang;
      if (pr.wobble) pr.mesh.rotation.x += dt * 12;
      if (!this.dungeon.walkable(pr.x, pr.z)) dead = true;
      if (!dead) {
        if (pr.owner === 'player') {
          for (const e of this.activeEnemies) {
            if (e.dead || pr.hit.has(e)) continue;
            const rr = e.radius + pr.size + 0.15;
            if (dist2(e.pos.x, e.pos.z, pr.x, pr.z) > rr * rr) continue;
            pr.hit.add(e);
            if (pr.explode) {
              this.fx.flash(pr.x, pr.z, pr.explode, pr.color, 0.35, 0.7);
              this.fx.burst(pr.x, 1, pr.z, pr.color, 20, 7, 0.5);
              this.aoePlayer(pr.x, pr.z, pr.explode, pr.hitOpts);
              this.shake(0.12);
              dead = true;
            } else {
              playerHit(this, e, pr.hitOpts);
              this.fx.burst(pr.x, 1, pr.z, pr.color, 5, 3, 0.25);
            }
            if (pr.split && !pr.noSplit) {
              for (const off of [-0.6, 0.6, Math.PI]) {
                const np = this.spawnProjectile({ owner: 'player', x: pr.x, z: pr.z, ang: pr.ang + off, speed: pr.speed, range: 7, size: pr.size * 0.7, elem: pr.elem, color: pr.color, hitOpts: { ...pr.hitOpts, mult: (pr.hitOpts.mult || 1) * 0.5, proc: true }, noSplit: true });
                np.hit.add(e);
              }
            }
            if (!dead) { if (pr.pierce > 0) pr.pierce--; else dead = true; }
            if (dead) break;
          }
        } else {
          const rr = p.radius + pr.size;
          if (!p.dead && dist2(p.pos.x, p.pos.z, pr.x, pr.z) < rr * rr) {
            hurtPlayer(this, pr.dmg, pr.elem, pr.src, pr.src ? pr.src.level : this.floorLevel);
            this.fx.burst(pr.x, 1, pr.z, pr.color, 6, 3, 0.25);
            dead = true;
          } else for (const m of this.minions) {
            if (dist2(m.pos.x, m.pos.z, pr.x, pr.z) < 0.5) { this.hurtMinion(m, pr.dmg); dead = true; break; }
          }
        }
      }
      if (dead) {
        if (pr.explode && pr.life <= 0) { this.fx.flash(pr.x, pr.z, pr.explode, pr.color, 0.35, 0.7); this.aoePlayer(pr.x, pr.z, pr.explode, pr.hitOpts); }
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
        this.projPool.push(pr);
      }
    }
  }
  findTargetNoLos(x, z, r, exclude) {
    let best = null, bd = r * r;
    for (const e of this.activeEnemies) {
      if (e.dead || exclude.has(e)) continue;
      const d = dist2(e.pos.x, e.pos.z, x, z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  updateHazards(dt) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t -= dt; h.tickT -= dt;
      if (h.tickT <= 0) {
        h.tickT = h.tick;
        if (h.owner === 'player') this.aoePlayer(h.x, h.z, h.radius, h.hitOpts);
        this.fx.scatter(h.x, h.z, h.radius, h.color, 6, 0.5);
      }
      if (h.t <= 0) { this.fx.kill(h.vis); this.hazards.splice(i, 1); }
    }
  }

  updateOrbits(dt) {
    const p = this.player;
    for (let i = this.orbits.length - 1; i >= 0; i--) {
      const o = this.orbits[i];
      o.t -= dt; o.ang += dt * 3.2;
      if (o.t <= 0) { for (const m of o.meshes) this.scene.remove(m); this.orbits.splice(i, 1); continue; }
      for (const [e, t] of o.hitCd) if (t - dt <= 0) o.hitCd.delete(e); else o.hitCd.set(e, t - dt);
      o.meshes.forEach((m, k) => {
        const a = o.ang + (k / o.count) * Math.PI * 2;
        const x = p.pos.x + Math.sin(a) * o.radius, z = p.pos.z + Math.cos(a) * o.radius;
        m.position.set(x, 1, z);
        m.rotation.y = a + Math.PI / 2;
        for (const e of this.activeEnemies) {
          if (e.dead || o.hitCd.has(e)) continue;
          if (dist2(e.pos.x, e.pos.z, x, z) < (e.radius + 0.6) ** 2) { o.hitCd.set(e, 0.45); playerHit(this, e, o.hitOpts); this.fx.burst(x, 1, z, o.color, 4, 3, 0.25); }
        }
      });
    }
  }

  updateDrops(dt) {
    const p = this.player, s = this.stats;
    if (p.dead) return;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      if (d.delay > 0) { d.delay -= dt; }
      const d2 = dist2(d.pos.x, d.pos.z, p.pos.x, p.pos.z);
      if (d.gold) {
        if (d2 < (s.pickup * 1.8) ** 2) {
          const dd = Math.sqrt(d2) || 1;
          d.pos.x += ((p.pos.x - d.pos.x) / dd) * 12 * dt; d.pos.z += ((p.pos.z - d.pos.z) / dd) * 12 * dt;
        }
        if (d2 < 0.6) {
          this.hero.gold += d.gold;
          sfx('gold');
          this.fx.text(p.pos.x, 2.2, p.pos.z, '+' + fmt(d.gold) + 'g', 'gold');
          this.scene.remove(d.mesh); this.drops.splice(i, 1);
        }
        continue;
      }
      d.mesh.userData.gem.rotation.y += dt * 2;
      d.mesh.userData.gem.position.y = 0.5 + Math.sin(d.t * 3) * 0.12;
      if (d.delay <= 0 && d2 < s.pickup * s.pickup) {
        if (this.pickup(d.item)) { this.scene.remove(d.mesh); this.drops.splice(i, 1); }
        else if (!this.fullWarnT || performance.now() - this.fullWarnT > 4000) { this.fullWarnT = performance.now(); this.ui.toast('Inventory full! Salvage some items.', 'warn'); }
      }
    }
  }

  updateProps(dt) {
    const p = this.player;
    for (const pr of this.props) {
      if (pr.used) {
        if (pr.kind === 'chest' && pr.mesh.userData.lid.rotation.x > -1.2) pr.mesh.userData.lid.rotation.x -= dt * 5;
        continue;
      }
      const d2 = dist2(pr.x, pr.z, p.pos.x, p.pos.z);
      if (pr.kind === 'shrine') pr.mesh.userData.crystal.rotation.y += dt * 1.5;
      const r = pr.kind === 'pot' ? 1.1 : pr.kind === 'chest' ? 1.7 : 1.9;
      if (d2 > r * r || p.dead) continue;
      pr.used = true;
      if (pr.kind === 'chest') {
        pr.mesh.userData.lid.position.z = -0.2; pr.mesh.userData.lid.position.y = 0.75;
        const n = randi(2, 3) + (chance(0.1) ? 2 : 0);
        for (let i = 0; i < n; i++) this.schedule(i * 0.15, () => this.spawnItem(pr.x, pr.z, { ilvl: this.floorLevel + 1, minRarity: 1 }));
        for (let i = 0; i < 3; i++) this.spawnGold(pr.x, pr.z, this.floorLevel, 1.5);
        this.fx.burst(pr.x, 0.8, pr.z, 0xffd040, 25, 5, 0.7);
        this.ui.toast('Treasure chest opened!');
      } else if (pr.kind === 'pot') {
        this.fx.burst(pr.x, 0.5, pr.z, 0x9a6a40, 14, 4, 0.5);
        this.scene.remove(pr.mesh);
        if (chance(0.45)) this.spawnGold(pr.x, pr.z, this.floorLevel);
        if (chance(0.06)) this.spawnItem(pr.x, pr.z, {});
        if (chance(0.05) && this.hero.potions < this.maxPotions()) { this.hero.potions++; this.fx.text(pr.x, 1.5, pr.z, '+1 Potion', 'heal'); }
      } else {
        const sh = pr.shrine;
        pr.mesh.userData.crystal.visible = false;
        this.addBuff({ id: 'shrine_' + sh.id, name: sh.name, icon: sh.icon, duration: 45, mods: sh.mods, shrine: true });
        this.fx.ring(pr.x, pr.z, 5, sh.color, 0.8);
        this.fx.burst(pr.x, 2, pr.z, sh.color, 40, 6, 1);
        this.ui.toast(`${sh.name}: ${sh.desc}`, 'epic');
        sfx('shrine');
      }
    }
  }
}
