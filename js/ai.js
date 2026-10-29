// Monster creation and behaviour.
import * as THREE from 'three';
import { ARCHETYPES, ELITE_MODS, BOSS_ABILITIES } from './data/enemies.js';
import { GEO, basic } from './models.js';
import { buildMonster, tickBlink } from './characters.js';
import { hurtPlayer, tickStatuses, monsterDamage, killEnemy } from './combat.js';
import { moveWithCollision, hasLOS, TS } from './dungeon.js';
import { monsterHpPower, rand, randi, pick, shuffle, dist2, chance } from './util.js';
import { ELEM_COLORS } from './stats.js';

const barGeo = new THREE.PlaneGeometry(1, 0.13).translate(0.5, 0, 0);
const barBg = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false });
const barFill = { 0: new THREE.MeshBasicMaterial({ color: 0xe03030, depthWrite: false }), 1: new THREE.MeshBasicMaterial({ color: 0x4a8cff, depthWrite: false }), 2: new THREE.MeshBasicMaterial({ color: 0xffd040, depthWrite: false }) };

export function createEnemy(G, archId, x, z, { elite = 0, mods = [], boss = false, minionOf = null } = {}) {
  const def = ARCHETYPES[archId];
  const theme = G.theme, lvl = G.floorLevel;
  let hp = 22 * monsterHpPower(lvl) * def.hp;
  let dmg = monsterDamage(lvl) * def.dmg;
  let scale = 1, speed = def.speed;
  const modSet = new Set(mods);
  if (elite === 1) { hp *= 3; dmg *= 1.25; scale = 1.1; }
  if (elite === 2) { hp *= 5; dmg *= 1.4; scale = 1.2; }
  if (boss) { hp *= 34; dmg *= 2.0; scale = 2.3; speed *= 0.95; }
  if (modSet.has('huge')) { hp *= 1.8; dmg *= 1.2; scale *= 1.35; }
  if (modSet.has('mighty')) dmg *= 1.5;
  if (modSet.has('fast')) speed *= 1.4;
  const mesh = buildMonster(boss ? 'brute' : archId, theme, boss);
  mesh.scale.setScalar(scale);
  mesh.position.set(x, 0, z);
  if (elite || boss) {
    const ring = new THREE.Mesh(GEO.ring(), basic(boss ? 0xff6020 : elite === 1 ? 0x4a8cff : 0xffd040, 0.8, true));
    ring.scale.setScalar(def.size * 1.6);
    ring.position.y = 0.05;
    mesh.add(ring);
  }
  // hp bar
  const bar = new THREE.Group();
  const bg = new THREE.Mesh(barGeo, barBg), fill = new THREE.Mesh(barGeo, barFill[boss ? 2 : elite]);
  bg.position.x = fill.position.x = -0.5; fill.position.z = 0.01;
  bar.add(bg, fill); bar.visible = false;
  bar.position.y = (archId === 'brute' || boss ? 2.4 : 1.9);
  bar.scale.setScalar(1 / scale * (boss ? 1.4 : 1));
  mesh.add(bar);
  G.scene.add(mesh);

  const name = boss ? theme.boss : (elite ? [...modSet].map((m) => ELITE_MODS.find((x) => x.id === m).name).join(' ') + ' ' : '') + theme.names[archId];
  const elem = archId === 'caster' ? theme.casterElem : archId === 'bomber' ? (theme.elem === 'phys' ? 'fire' : theme.elem) : theme.elem;
  const e = {
    arch: archId, def, name, pos: mesh.position, mesh, bar, barFill: fill, radius: def.size * scale, scale,
    hp, maxHp: hp, dmg, speed, level: lvl, elite, boss, mods: modSet, elem,
    state: 'idle', t: 0, atkT: rand(0.5, 1.5), aggro: !!minionOf, facing: rand(0, Math.PI * 2),
    st: { burn: 0, burnDps: 0, poison: 0, poisonStacks: 0, poisonDps: 0, bleed: 0, bleedDps: 0, chill: 0, freeze: 0, shock: 0, stun: 0, freezeImmune: 0, stunImmune: 0, shieldT: 0 },
    hitFlash: 0, modT: rand(0, 3), losT: 0, target: null, retarget: 0, summoned: 0, minionOf,
    xp: def.xp * (elite === 1 ? 3 : elite === 2 ? 6 : 1) * (boss ? 40 : 1) * (minionOf ? 0.3 : 1),
    abilities: boss ? shuffle([...BOSS_ABILITIES]).slice(0, 3) : null, abilT: 4, phase: 1,
  };
  G.enemies.push(e);
  return e;
}

export function rollEliteMods(n) { return shuffle(ELITE_MODS.map((m) => m.id)).slice(0, n); }

// Damage of an attack being created now (berserk enrage applies to all attack types).
const atk = (e, mult = 1) => e.dmg * mult * (e.mods.has('berserk') && e.hp < e.maxHp * 0.5 ? 1.8 : 1);

function hurtTarget(G, e, tgt, dmg, elem) {
  if (tgt === G.player) hurtPlayer(G, dmg, elem, e, e.level);
  else G.hurtMinion(tgt, dmg);
}

const angTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);

export function updateEnemy(G, e, dt) {
  tickStatuses(G, e, dt);
  if (e.dead) return;
  const p = G.player;
  const body = e.mesh.userData.body;
  if (e.hitFlash > 0) e.hitFlash -= dt;
  if (e.hp < e.maxHp && !e.boss) { e.bar.visible = true; e.barFill.scale.x = Math.max(0.001, e.hp / e.maxHp); e.bar.quaternion.copy(e.mesh.quaternion).invert().multiply(G.camera.quaternion); }
  if (e.mods.has('regen') && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.015 * dt);

  // target selection: player or nearest minion
  e.retarget -= dt;
  if (e.retarget <= 0 || !e.target || e.target.dead) {
    e.retarget = 0.5;
    let best = p.dead ? null : p, bd = p.dead ? Infinity : dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z);
    for (const m of G.minions) { const d = dist2(e.pos.x, e.pos.z, m.pos.x, m.pos.z) * 1.4; if (d < bd) { bd = d; best = m; } }
    e.target = best;
  }
  const tgt = e.target;
  if (!tgt) return;
  const dx = tgt.pos.x - e.pos.x, dz = tgt.pos.z - e.pos.z;
  const d = Math.hypot(dx, dz) || 0.001;

  // aggro
  if (!e.aggro) {
    e.losT -= dt;
    if (e.losT <= 0) {
      e.losT = 0.3;
      if (d < 12 && hasLOS(G.dungeon, e.pos.x, e.pos.z, tgt.pos.x, tgt.pos.z)) {
        G.onAggro(e, true);
        for (const o of G.activeEnemies) if (!o.aggro && dist2(o.pos.x, o.pos.z, e.pos.x, e.pos.z) < 64) G.onAggro(o, false);
      }
    }
    wander(G, e, dt);
    return;
  }
  if (e.hp < e.maxHp || e.aggro) e.mesh.visible = true;

  const stunned = e.st.stun > 0 || e.st.freeze > 0;
  if (stunned) { if (e.state === 'charging') e.state = 'idle'; return; }
  const slow = e.st.chill > 0 ? 0.55 : 1;
  const fast = e.mods.has('fast');

  // elite modifiers
  e.modT += dt;
  if (e.elite || e.boss) eliteTick(G, e, tgt, d, dt);

  if (e.boss) { bossTick(G, e, tgt, d, dt, slow); return; }

  e.atkT -= dt * (fast ? 1.3 : 1);
  const def = e.def;
  const face = (a) => { e.facing = a; e.mesh.rotation.y = a; };

  if (e.state === 'windup') {
    e.t -= dt;
    if (e.t <= 0) { performAttack(G, e, tgt, d); e.state = e.state === 'charging' ? 'charging' : 'recover'; if (e.state === 'recover') e.t = 0.3; e.atkT = def.atkCd * rand(0.85, 1.15) * (fast ? 0.75 : 1); }
    return;
  }
  if (e.state === 'charging') {
    e.t -= dt;
    const sp = 17 * dt;
    const ox = e.pos.x, oz = e.pos.z;
    moveWithCollision(G.dungeon, e.pos, Math.sin(e.facing) * sp, Math.cos(e.facing) * sp, e.radius);
    if (!e.chargeHit && dist2(e.pos.x, e.pos.z, tgt.pos.x, tgt.pos.z) < (e.radius + 0.8) ** 2) { e.chargeHit = true; hurtTarget(G, e, tgt, e.dmg * 1.3, 'phys'); G.shake(0.2); }
    if (e.t <= 0 || (Math.abs(e.pos.x - ox) + Math.abs(e.pos.z - oz) < sp * 0.3)) { e.state = 'recover'; e.t = 0.6; }
    return;
  }
  if (e.state === 'recover') { e.t -= dt; if (e.t > 0) return; e.state = 'chase'; }

  const los = d < 14 ? hasLOSCached(G, e, tgt, dt) : false;
  const inRange = d <= def.range + (tgt.radius || 0.4) && (def.ai === 'melee' || def.ai === 'brute' || def.ai === 'bomber' || los);
  if (inRange && e.atkT <= 0) {
    face(angTo(e.pos, tgt.pos));
    e.state = 'windup'; e.t = def.windup * (fast ? 0.7 : 1);
    startAttack(G, e, tgt);
    return;
  }
  // movement
  let mx = 0, mz = 0;
  if ((def.ai === 'ranged' || def.ai === 'caster') && los && d < def.keep) { mx = -dx / d; mz = -dz / d; }
  else if (!inRange || def.ai === 'melee' || def.ai === 'bomber') {
    if (d > (def.ai === 'ranged' || def.ai === 'caster' ? def.range * 0.8 : def.range * 0.7) || !los) {
      if (los || tgt !== p) { mx = dx / d; mz = dz / d; }
      else { const f = G.flowDir(e.pos.x, e.pos.z); mx = f[0]; mz = f[1]; }
    }
  }
  if (mx || mz) {
    const sp = e.speed * slow * dt;
    moveWithCollision(G.dungeon, e.pos, mx * sp, mz * sp, e.radius * 0.8);
    face(Math.atan2(mx, mz));
  } else if (d < 15) face(angTo(e.pos, tgt.pos));
}

function hasLOSCached(G, e, tgt, dt) {
  e.losCacheT = (e.losCacheT || 0) - dt;
  if (e.losCacheT <= 0 || e.losCache === undefined) { e.losCacheT = 0.2; e.losCache = hasLOS(G.dungeon, e.pos.x, e.pos.z, tgt.pos.x, tgt.pos.z); }
  return e.losCache;
}

function startAttack(G, e, tgt) {
  const def = e.def;
  const fx = Math.sin(e.facing), fz = Math.cos(e.facing);
  switch (def.ai) {
    case 'brute': {
      const cx = e.pos.x + fx * 1.4 * e.scale, cz = e.pos.z + fz * 1.4 * e.scale;
      G.enemyAoe(cx, cz, def.radius * e.scale, atk(e), e.elem, e.state === 'windup' ? e.t : 0.6, e);
      break;
    }
    case 'caster': G.enemyAoe(tgt.pos.x, tgt.pos.z, def.radius, atk(e), e.elem, e.t + 0.9, e); break;
    case 'bomber': G.fx.flash(e.pos.x, e.pos.z, def.radius, 0xff4020, e.t, 0.4); G.fx.telegraph(e.pos.x, e.pos.z, def.radius, e.t); break;
    case 'charger': G.fx.telegraph(e.pos.x + fx * 4, e.pos.z + fz * 4, 1.2, e.t, 0xff8040); break;
  }
}

function performAttack(G, e, tgt, d) {
  const def = e.def;
  switch (def.ai) {
    case 'melee':
      G.fx.arc(e.pos.x, e.pos.z, e.facing, def.range + 0.3, 90, 0xff4040, 0.15);
      if (dist2(e.pos.x, e.pos.z, tgt.pos.x, tgt.pos.z) <= (def.range + (tgt.radius || 0.4) + 0.6) ** 2) hurtTarget(G, e, tgt, atk(e), e.elem);
      break;
    case 'ranged': {
      const a = angTo(e.pos, tgt.pos);
      G.spawnProjectile({ owner: 'enemy', x: e.pos.x, z: e.pos.z, ang: a, speed: def.projSpeed, range: def.range + 3, size: 0.22, color: ELEM_COLORS[e.elem], dmg: atk(e), elem: e.elem, src: e });
      break;
    }
    case 'bomber':
      G.fx.flash(e.pos.x, e.pos.z, def.radius, ELEM_COLORS[e.elem], 0.4, 0.9);
      G.fx.burst(e.pos.x, 0.6, e.pos.z, ELEM_COLORS[e.elem], 30, 8, 0.6);
      G.enemyAoe(e.pos.x, e.pos.z, def.radius, atk(e), e.elem, 0, e);
      G.shake(0.25);
      e.suicide = true;
      killEnemy(G, e);
      break;
    case 'charger':
      e.state = 'charging'; e.t = 0.55; e.chargeHit = false;
      e.facing = angTo(e.pos, tgt.pos); e.mesh.rotation.y = e.facing;
      return;
  }
}

function eliteTick(G, e, tgt, d, dt) {
  if (e.mods.has('teleporter') && e.modT > 5 && d > 5) {
    e.modT = 0;
    const a = rand(0, Math.PI * 2);
    const nx = tgt.pos.x + Math.sin(a) * 2.5, nz = tgt.pos.z + Math.cos(a) * 2.5;
    if (G.fits(nx, nz, e.radius)) { G.fx.burst(e.pos.x, 1, e.pos.z, 0xc060ff, 14, 4, 0.4); e.pos.x = nx; e.pos.z = nz; G.fx.burst(nx, 1, nz, 0xc060ff, 14, 4, 0.4); }
  }
  if (e.mods.has('arcane') && e.modT > 4) {
    e.modT = 0;
    for (let i = 0; i < 8; i++) G.spawnProjectile({ owner: 'enemy', x: e.pos.x, z: e.pos.z, ang: (i / 8) * Math.PI * 2 + rand(0, 0.5), speed: 7, range: 12, size: 0.3, color: 0xc060ff, dmg: atk(e, 0.6), elem: 'shadow', src: e });
  }
  if (e.mods.has('summoner') && e.modT > 7 && e.summoned < 6) {
    e.modT = 0;
    for (let i = 0; i < 2; i++) {
      const a = rand(0, Math.PI * 2), nx = e.pos.x + Math.sin(a) * 1.5, nz = e.pos.z + Math.cos(a) * 1.5;
      if (G.dungeon.walkable(nx, nz)) { createEnemy(G, 'swarmer', nx, nz, { minionOf: e }); e.summoned++; G.fx.burst(nx, 0.5, nz, 0x80ff80, 8, 3, 0.4); }
    }
  }
}

function bossTick(G, e, tgt, d, dt, slow) {
  const face = (a) => { e.facing = a; e.mesh.rotation.y = a; };
  const enraged = e.hp < e.maxHp * 0.5;
  if (enraged && e.phase === 1) {
    e.phase = 2; G.ui.toast(`${e.name} becomes enraged!`, 'boss');
    G.fx.ring(e.pos.x, e.pos.z, 8, 0xff3020, 0.8); e.speed *= 1.25;
  }
  if (e.state === 'charging') {
    e.t -= dt;
    const sp = 19 * dt;
    moveWithCollision(G.dungeon, e.pos, Math.sin(e.facing) * sp, Math.cos(e.facing) * sp, e.radius * 0.6);
    if (!e.chargeHit && dist2(e.pos.x, e.pos.z, tgt.pos.x, tgt.pos.z) < (e.radius + 0.8) ** 2) { e.chargeHit = true; hurtTarget(G, e, tgt, e.dmg * 1.4, 'phys'); G.shake(0.35); }
    if (e.t <= 0) { e.state = 'recover'; e.t = 0.8; }
    return;
  }
  if (e.state === 'cast' || e.state === 'recover' || e.state === 'windup') {
    e.t -= dt;
    if (e.t <= 0) {
      if (e.state === 'windup' && e.pending) { const f = e.pending; e.pending = null; f(); }
      if (e.state !== 'charging') e.state = 'chase';
    }
    return;
  }
  e.abilT -= dt * (enraged ? 1.4 : 1);
  e.atkT -= dt;
  if (e.abilT <= 0) {
    e.abilT = rand(3.5, 5);
    const ab = pick(e.abilities);
    const el = e.elem === 'phys' ? G.theme.casterElem : e.elem;
    const col = ELEM_COLORS[el];
    face(angTo(e.pos, tgt.pos));
    switch (ab) {
      case 'slam': G.enemyAoe(e.pos.x, e.pos.z, 6, e.dmg * 1.4, e.elem, 1.3, e); e.state = 'cast'; e.t = 1.4; break;
      case 'ring':
        for (let w = 0; w < (enraged ? 4 : 3); w++) G.schedule(w * 0.4, () => {
          if (e.dead) return;
          for (let i = 0; i < 14; i++) G.spawnProjectile({ owner: 'enemy', x: e.pos.x, z: e.pos.z, ang: (i / 14) * Math.PI * 2 + w * 0.22, speed: 8, range: 16, size: 0.32, color: col, dmg: e.dmg * 0.55, elem: el, src: e });
        });
        e.state = 'cast'; e.t = 1.2; break;
      case 'summon': {
        const arch = pick(['grunt', 'runner', 'swarmer', 'archer']);
        for (let i = 0; i < (enraged ? 6 : 4); i++) {
          const a = (i / 4) * Math.PI * 2, nx = e.pos.x + Math.sin(a) * 3, nz = e.pos.z + Math.cos(a) * 3;
          if (G.dungeon.walkable(nx, nz)) { createEnemy(G, arch, nx, nz, { minionOf: e }); G.fx.burst(nx, 0.6, nz, col, 10, 3, 0.4); }
        }
        G.ui.toast(`${e.name} summons minions!`, 'boss');
        e.state = 'cast'; e.t = 0.8; break;
      }
      case 'charge':
        G.fx.telegraph(e.pos.x + Math.sin(e.facing) * 5, e.pos.z + Math.cos(e.facing) * 5, 2, 0.8, 0xff8040);
        e.state = 'windup'; e.t = 0.8;
        e.pending = () => { e.facing = angTo(e.pos, tgt.pos); e.mesh.rotation.y = e.facing; e.state = 'charging'; e.t = 0.7; e.chargeHit = false; };
        break;
      case 'rain':
        for (let i = 0; i < (enraged ? 9 : 6); i++) {
          const a = rand(0, Math.PI * 2), r = i === 0 ? 0 : rand(1, 6);
          G.enemyAoe(tgt.pos.x + Math.sin(a) * r, tgt.pos.z + Math.cos(a) * r, 2.2, e.dmg * 0.9, el, 1.2 + i * 0.1, e);
        }
        e.state = 'cast'; e.t = 0.8; break;
      case 'beam': {
        // rotating spiral of projectiles
        const base = rand(0, Math.PI * 2);
        for (let k = 0; k < 24; k++) G.schedule(k * 0.08, () => {
          if (e.dead) return;
          for (let s = 0; s < 3; s++) G.spawnProjectile({ owner: 'enemy', x: e.pos.x, z: e.pos.z, ang: base + k * 0.28 + (s * Math.PI * 2) / 3, speed: 9, range: 15, size: 0.28, color: col, dmg: e.dmg * 0.4, elem: el, src: e });
        });
        e.state = 'cast'; e.t = 2; break;
      }
    }
    return;
  }
  // melee slam when close
  if (d < 3.2 + e.radius * 0.5 && e.atkT <= 0) {
    e.atkT = enraged ? 1.6 : 2.2;
    face(angTo(e.pos, tgt.pos));
    G.enemyAoe(e.pos.x + Math.sin(e.facing) * 2, e.pos.z + Math.cos(e.facing) * 2, 3, e.dmg, e.elem, 0.7, e);
    e.state = 'cast'; e.t = 0.8;
    return;
  }
  if (d > 2.5) {
    const los = hasLOSCached(G, e, tgt, dt);
    let mx, mz;
    if (los || tgt !== G.player) { mx = (tgt.pos.x - e.pos.x) / d; mz = (tgt.pos.z - e.pos.z) / d; }
    else [mx, mz] = G.flowDir(e.pos.x, e.pos.z);
    const sp = e.speed * slow * dt;
    moveWithCollision(G.dungeon, e.pos, mx * sp, mz * sp, Math.min(e.radius * 0.5, 0.8));
    face(Math.atan2(mx, mz));
  }
}

// Cartoon motion, purely visual: hop and waddle while moving, crouch before attacking,
// stretch on release, squash when hit, dizzy wobble when stunned, rigid when frozen, blink.
export function animateEnemy(G, e, dt) {
  const u = e.mesh.userData, body = u.body;
  const t = performance.now() / 1000 + e.modT;
  const lx = e.lx ?? e.pos.x, lz = e.lz ?? e.pos.z;
  const sp = Math.hypot(e.pos.x - lx, e.pos.z - lz) / Math.max(dt, 1e-4);
  e.lx = e.pos.x; e.lz = e.pos.z;
  let sx = 1, sy = 1, y = 0, rz = 0, rx = 0;
  const bouncy = e.arch === 'swarmer' || e.arch === 'bomber';
  if (e.st.freeze > 0) { /* frozen solid */ }
  else if (e.st.stun > 0) { rz = Math.sin(t * 9) * 0.18; rx = Math.cos(t * 9) * 0.1; }
  else if (e.state === 'windup') { sy = 0.8; sx = 1.14; }
  else if (e.state === 'charging') { rx = 0.25; sy = 0.92; sx = 1.05; }
  else if (e.state === 'recover' || e.state === 'cast') { sy = 1.08; sx = 0.96; }
  else if (sp > 0.6) {
    const ph = t * (bouncy ? 14 : 10), b = Math.abs(Math.sin(ph));
    y = b * (bouncy ? 0.28 : e.boss ? 0.1 : 0.15);
    sy = 1 + b * 0.08; sx = 1 - b * 0.04;
    rz = Math.sin(ph) * (e.boss ? 0.04 : 0.12);
  } else { sy = 1 + Math.sin(t * 2.6) * 0.035; sx = 1 - Math.sin(t * 2.6) * 0.015; }
  if (e.hitFlash > 0) { const k = e.hitFlash / 0.12; sx *= 1 + k * 0.22; sy *= 1 - k * 0.22; }
  body.position.y = y; body.scale.set(sx, sy, sx); body.rotation.set(rx, 0, rz);
  if (e.st.freeze <= 0) tickBlink(e.mesh, dt);
  if (e.arch === 'bomber' && e.aggro) {
    e.sparkT = (e.sparkT || 0) - dt;
    if (e.sparkT <= 0) { e.sparkT = 0.08; G.fx.burst(e.pos.x + Math.sin(e.facing + 1.5) * 0.1 * e.scale, (1.24 * sy + y) * e.scale, e.pos.z + Math.cos(e.facing + 1.5) * 0.1 * e.scale, 0xffc040, 2, 2.5, 0.3, 4); }
  }
}

// Unaware monsters aren't statues: roamers walk room to room along a distance map,
// everyone else shuffles around near where they spawned.
function wander(G, e, dt) {
  const d = G.dungeon;
  let mx = 0, mz = 0;
  if (e.roam) {
    if (e.roamRoom < 0 || e.roamWait > 0) {
      e.roamWait = (e.roamWait || 0) - dt;
      if (e.roamWait <= 0 && e.roamRoom < 0) { e.roamRoom = Math.floor(Math.random() * d.rooms.length); }
    }
    if (e.roamRoom >= 0) {
      const f = G.roomFlow(e.roamRoom), tx = Math.floor(e.pos.x / TS), ty = Math.floor(e.pos.z / TS);
      const here = f[ty * d.W + tx];
      if (here <= 2) { e.roamRoom = -1; e.roamWait = 2 + Math.random() * 4; return; }
      let best = null, bv = here < 0 ? 1e9 : here;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const v = f[(ty + dy) * d.W + tx + dx];
        if (v >= 0 && v < bv && (!(dx && dy) || (d.isFloor(tx + dx, ty) && d.isFloor(tx, ty + dy)))) { bv = v; best = [tx + dx, ty + dy]; }
      }
      if (best) { const [cx, cz] = d.tileCenter(best[0], best[1]); const l = Math.hypot(cx - e.pos.x, cz - e.pos.z) || 1; mx = (cx - e.pos.x) / l; mz = (cz - e.pos.z) / l; }
    }
  } else {
    e.wanderT = (e.wanderT ?? Math.random() * 3) - dt;
    if (e.wanderT <= 0) {
      e.wanderT = 2 + Math.random() * 4;
      e.home = e.home || { x: e.pos.x, z: e.pos.z };
      const a = Math.random() * Math.PI * 2, r = Math.random() * 3;
      e.wanderTo = Math.random() < 0.4 ? null : { x: e.home.x + Math.sin(a) * r, z: e.home.z + Math.cos(a) * r };
    }
    if (e.wanderTo) {
      const dx = e.wanderTo.x - e.pos.x, dz = e.wanderTo.z - e.pos.z, l = Math.hypot(dx, dz);
      if (l < 0.3) e.wanderTo = null; else { mx = dx / l; mz = dz / l; }
    }
  }
  if (mx || mz) {
    const sp = e.speed * (e.roam ? 0.55 : 0.3) * dt;
    moveWithCollision(d, e.pos, mx * sp, mz * sp, e.radius * 0.8);
    e.facing = Math.atan2(mx, mz); e.mesh.rotation.y = e.facing;
  }
}
