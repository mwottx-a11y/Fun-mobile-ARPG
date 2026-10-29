// Generic skill engine: turns class skill definitions into gameplay.
import { ELEM_COLORS } from './stats.js';
import { playerHit, healPlayer } from './combat.js';
import { dist2, rand, clamp } from './util.js';
import { hasLOS, moveWithCollision } from './dungeon.js';
import { sfx } from './sfx.js';
import { augmentTiers, AUG_LEVELS } from './data/augments.js';

// The skill as the hero actually has it: base definition + chosen augments (cached per choice set).
const effCache = new Map();
export function effectiveSkill(G, idx) {
  const base = G.cls.skills[idx], aug = (G.hero && G.hero.augments) || {};
  const key = `${G.cls.id}${idx}:${aug[idx + '_0'] || ''}:${aug[idx + '_1'] || ''}`;
  let sk = effCache.get(key);
  if (!sk) {
    sk = JSON.parse(JSON.stringify(base));
    sk.flags = {};
    augmentTiers(base).forEach((tier, t) => {
      const opt = tier.find((o) => o.id === aug[`${idx}_${t}`]);
      if (opt) { opt.apply(sk); Object.assign(sk.flags, opt.flags); }
    });
    effCache.set(key, sk);
  }
  return sk;
}

// Combo chain (unlocks at level 11): casting a different skill than the last one within 3s
// builds the chain; repeating a skill or pausing restarts it. Each step: +8% damage, 6% cost refund.
export const comboCap = (lvl) => (lvl < 11 ? 0 : lvl >= 50 ? 8 : lvl >= 25 ? 6 : 4);
function comboStep(G, idx) {
  const p = G.player, cap = comboCap(G.hero.level), now = G.hero.playTime;
  if (!cap) return 0;
  if (p.comboLast === idx || now - (p.comboAt || -9) > 3) p.combo = 1;
  else p.combo = Math.min(cap, (p.combo || 0) + 1);
  p.comboLast = idx; p.comboAt = now;
  return p.combo - 1;
}

const DEG = Math.PI / 180;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };

export function skillRange(sk) {
  switch (sk.type) {
    case 'melee': return sk.range;
    case 'proj': return sk.range || 14;
    case 'chain': return sk.range || 12;
    case 'ground': return 12;
    case 'dash': return (sk.dist || 8) + 2;
    case 'nova': return sk.radius;
    default: return 10;
  }
}

export function skillCost(G, sk) {
  const s = G.stats;
  let c = (sk.cost || 0) * s.costMult * s.costScale;
  if (s.powers.has('overcharge') && c > 0) c *= 1.5;
  return c;
}

// Returns true if cast. idx = skill slot index (0 = basic attack)
export function castSkill(G, idx, target) {
  const sk = effectiveSkill(G, idx), F = sk.flags;
  const p = G.player, s = G.stats;
  const rank = G.hero.skillRanks[idx] || 1;
  const aoe = 1 + s.aoe / 100;
  const color = ELEM_COLORS[sk.elem || 'phys'];
  const step = idx > 0 ? comboStep(G, idx) : 0;
  const base = { mult: sk.mult * (1 + 0.08 * step), elem: sk.elem, skill: sk.id, isBasic: idx === 0, status: sk.status, statusChance: sk.statusChance, rank, bleedAmp: F.bleedAmp };
  if (step > 0) {
    p.mana = Math.min(s.maxMana, p.mana + skillCost(G, sk) * 0.06 * step);
    G.ui.comboPop(p.combo);
  }

  // aim
  let ang = p.facing;
  if (target) ang = Math.atan2(target.pos.x - p.pos.x, target.pos.z - p.pos.z);
  else if (G.input.moveLen > 0.2) ang = Math.atan2(G.input.mx, G.input.mz);
  p.facing = ang;
  const fx = Math.sin(ang), fz = Math.cos(ang);
  p.swing = 0.25;
  sfx(sk.type === 'melee' ? 'swing' : 'cast');

  switch (sk.type) {
    case 'melee': {
      const range = sk.range * aoe;
      const hits = sk.hits || 1;
      const swing = (opts, delay0) => { for (let h = 0; h < hits; h++) G.schedule(delay0 + h * (sk.interval || 0), () => {
        const a = sk.arc >= 360 ? 0 : p.facing;
        G.fx.arc(p.pos.x, p.pos.z, a, range, sk.arc, color);
        let connected = false;
        for (const e of G.activeEnemies) {
          if (e.dead) continue;
          const d2 = dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z), rr = range + e.radius;
          if (d2 > rr * rr) continue;
          if (sk.arc < 360 && d2 > (p.radius + e.radius + 0.5) ** 2 && angDiff(Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z), p.facing) > sk.arc * DEG / 2) continue;
          playerHit(G, e, opts);
          G.fx.burst(e.pos.x, 0.9, e.pos.z, color, 4, 3, 0.3);
          connected = true;
          if (!e.boss && e.elite < 2 && !e.dead) {
            const d = Math.sqrt(d2) || 1;
            moveWithCollision(G.dungeon, e.pos, ((e.pos.x - p.pos.x) / d) * 0.35, ((e.pos.z - p.pos.z) / d) * 0.35, e.radius * 0.8);
          }
        }
        if (connected) { G.hitStop(hits > 1 ? 0.02 : 0.05); G.shake(0.06); G.vibrate(8); }
        if (idx === 0 && s.powers.has('echo') && Math.random() < 0.35 && h === 0) G.schedule(0.12, () => {
          G.fx.arc(p.pos.x, p.pos.z, p.facing, range, sk.arc, 0xffffff);
          for (const e of G.activeEnemies) if (!e.dead && dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z) < (range + e.radius) ** 2) playerHit(G, e, { ...base, proc: true });
        });
      }); };
      swing(base, 0);
      if (F.echo) swing({ ...base, mult: base.mult * F.echo }, 0.3 + hits * (sk.interval || 0));
      break;
    }
    case 'proj': {
      let count = (sk.count || 1) + s.projCount;
      let spread = sk.spread || 0;
      if (!spread && count > 1) spread = Math.min(60, (count - 1) * 12);
      const echo = idx === 0 && s.powers.has('echo') && Math.random() < 0.35;
      const fire = (offset) => {
        for (let i = 0; i < count; i++) {
          const a = count === 1 ? ang : spread >= 360 ? ang + (i / count) * Math.PI * 2 : ang - (spread * DEG) / 2 + (spread * DEG) * (i / (count - 1));
          G.spawnProjectile({
            owner: 'player', x: p.pos.x + Math.sin(a) * 0.5, z: p.pos.z + Math.cos(a) * 0.5, ang: a + offset,
            speed: sk.speed || 20, range: sk.range || 14, size: sk.size || 0.25, elem: sk.elem, color,
            pierce: (sk.pierce || 0) + s.pierce, explode: sk.explode ? sk.explode * aoe : 0,
            homing: sk.homing || s.powers.has('seeker'), wobble: sk.wobble, hitOpts: base, split: s.powers.has('splitting'),
          });
        }
      };
      fire(0);
      if (echo) G.schedule(0.12, () => fire(0.05));
      break;
    }
    case 'nova': {
      const r = sk.radius * aoe;
      const rings = sk.rings || 1;
      const pulseAt = (delay, opts) => { for (let k = 0; k < rings; k++) G.schedule(delay + k * (sk.interval || 0), () => {
        if (F.pull) pullIn(G, p.pos, r, F.pull);
        G.fx.ring(p.pos.x, p.pos.z, r, color, 0.4); sfx('boom');
        G.fx.flash(p.pos.x, p.pos.z, r, color, 0.3, 0.35);
        G.fx.scatter(p.pos.x, p.pos.z, r, color, 24, 0.5);
        G.aoePlayer(p.pos.x, p.pos.z, r, opts);
      }); };
      pulseAt(0, base);
      if (F.echo) pulseAt(0.5 + rings * (sk.interval || 0), { ...base, mult: base.mult * F.echo });
      if (sk.heal) healPlayer(G, s.maxHp * sk.heal);
      G.shake(0.15);
      break;
    }
    case 'ground': {
      let tx, tz;
      if (sk.self) { tx = p.pos.x; tz = p.pos.z; }
      else if (target) { tx = target.pos.x; tz = target.pos.z; }
      else { tx = p.pos.x + fx * 6; tz = p.pos.z + fz * 6; }
      const r = sk.radius * aoe;
      const spots = [[tx, tz]];
      if (F.twin) { const ox = Math.cos(ang) * r * 1.4, oz = -Math.sin(ang) * r * 1.4; spots.push([tx + ox, tz + oz]); }
      for (const [tx, tz] of spots) if (sk.duration) {
        G.addHazard({ owner: 'player', x: tx, z: tz, radius: r, duration: sk.duration, tick: sk.tick || 0.5, hitOpts: base, color, follow: false });
      } else {
        const delay = sk.delay || 0.3;
        G.fx.telegraph(tx, tz, r, delay, color);
        if (sk.id === 'meteor') G.spawnMeteorVisual(tx, tz, delay);
        G.schedule(delay, () => {
          G.fx.flash(tx, tz, r, color, 0.4, 0.8); G.fx.burst(tx, 0.5, tz, color, 30, 9, 0.7); G.shake(0.25); sfx('boom');
          G.aoePlayer(tx, tz, r, base);
          if (sk.burnGround) G.addHazard({ owner: 'player', x: tx, z: tz, radius: r * 0.8, duration: 3, tick: 0.5, hitOpts: { ...base, mult: sk.mult * 0.12, status: 'burn', statusChance: 0.5 }, color });
        });
      }
      break;
    }
    case 'dash': {
      let dist = sk.dist || 8;
      let dx = fx, dz = fz;
      if (!sk.mult || sk.blink) {
        // evasive dashes go where the stick points, or directly away from the threat
        if (G.input.moveLen > 0.2) { const l = Math.hypot(G.input.mx, G.input.mz); dx = G.input.mx / l; dz = G.input.mz / l; }
        else if (target && target.fake) { dist = Math.min(dist, Math.max(1.5, Math.sqrt(dist2(target.pos.x, target.pos.z, p.pos.x, p.pos.z)))); }
        else if (target) { dx = -fx; dz = -fz; }
        p.facing = Math.atan2(dx, dz);
      } else if (target && !sk.path) dist = Math.min(dist, Math.sqrt(dist2(target.pos.x, target.pos.z, p.pos.x, p.pos.z)));
      const sx = p.pos.x, sz = p.pos.z, kills0 = G.hero.kills || 0;
      if (F.afterimage) G.schedule(0.05, () => { G.fx.ring(sx, sz, 3 * aoe, color, 0.4); G.fx.burst(sx, 0.5, sz, color, 16, 5, 0.5); G.aoePlayer(sx, sz, 3 * aoe, { ...base, mult: Math.max(1, sk.mult || 0) * 1.2 }); });
      const done = () => {
        if (F.momentum) G.schedule(0.05, () => { if ((G.hero.kills || 0) > kills0) { p.cds[idx] = 0; G.fx.text(p.pos.x, 2.4, p.pos.z, 'Reset!', 'heal'); } });
        if (F.fortify) G.addBuff({ id: 'fortify', name: 'Fortify', icon: '🛡️', duration: 3, mods: { dr: 30 } });
        if (sk.radius && sk.mult && !sk.blink) {
          const r = sk.radius * aoe;
          G.fx.ring(p.pos.x, p.pos.z, r, color, 0.4); G.fx.burst(p.pos.x, 0.4, p.pos.z, color, 18, 6, 0.5);
          G.aoePlayer(p.pos.x, p.pos.z, r, base); G.shake(0.2);
        }
        if (sk.buff) G.addBuff({ id: sk.id, name: sk.name, icon: sk.icon, duration: sk.buff.duration, mods: sk.buff.mods, scale: 1 + 0.1 * (rank - 1) });
      };
      if (sk.blink) {
        if (sk.mult) { G.fx.ring(sx, sz, sk.radius * aoe, color, 0.4); G.aoePlayer(sx, sz, sk.radius * aoe, base); }
        G.fx.burst(sx, 1, sz, color, 16, 4, 0.4);
        G.dashPlayer(dx, dz, dist, 0.01, null);
        G.fx.burst(p.pos.x, 1, p.pos.z, color, 16, 4, 0.4);
        done();
      } else {
        G.dashPlayer(dx, dz, dist, sk.id === 'leap' ? 0.35 : 0.2, sk.path ? base : null, done, sk.id === 'leap');
      }
      break;
    }
    case 'buff': {
      if (sk.heal) healPlayer(G, s.maxHp * sk.heal * (1 + 0.05 * (rank - 1)));
      const amp = 1 + (F.buffAmp || 0);
      G.addBuff({ id: sk.id, name: sk.name, icon: sk.icon, duration: sk.duration, mods: sk.mods, scale: (1 + 0.1 * (rank - 1)) * amp,
        pulse: sk.pulse ? { ...sk.pulse, mult: sk.pulse.mult * amp * (1 + 0.08 * step), rank, t: 0, pull: F.pull, echo: F.echo } : null });
      G.fx.ring(p.pos.x, p.pos.z, 2.5, sk.pulse ? ELEM_COLORS[sk.pulse.elem] : 0xffe080, 0.5);
      G.fx.burst(p.pos.x, 1, p.pos.z, 0xffe080, 16, 4, 0.6, -2);
      break;
    }
    case 'summon': {
      for (let i = 0; i < sk.count; i++) G.spawnMinion(sk.minion, sk, rank, F);
      G.fx.ring(p.pos.x, p.pos.z, 2.5, 0x80ff80, 0.5);
      break;
    }
    case 'chain': {
      let cur = target && !target.fake ? target : G.findTarget(sk.range || 12);
      if (!cur) { G.fx.bolt([[p.pos.x, 1.2, p.pos.z], [p.pos.x + fx * 6, 1, p.pos.z + fz * 6]], color, 0.15); break; }
      const hit = new Set();
      const pts = [[p.pos.x, 1.2, p.pos.z]];
      const jumps = (sk.jumps || 0) + s.projCount;
      for (let j = 0; j <= jumps && cur; j++) {
        hit.add(cur);
        pts.push([cur.pos.x, 1, cur.pos.z]);
        const dmg = playerHit(G, cur, F.amp ? { ...base, mult: base.mult * (1 + F.amp * j) } : base);
        if (sk.drain) healPlayer(G, dmg * sk.drain, true);
        if (F.siphon) p.mana = Math.min(s.maxMana, p.mana + s.maxMana * F.siphon);
        G.fx.burst(cur.pos.x, 1, cur.pos.z, color, 5, 3, 0.3);
        let best = null, bd = 7 * 7;
        for (const e of G.activeEnemies) {
          if (e.dead || hit.has(e)) continue;
          const d = dist2(e.pos.x, e.pos.z, cur.pos.x, cur.pos.z);
          if (d < bd && hasLOS(G.dungeon, cur.pos.x, cur.pos.z, e.pos.x, e.pos.z)) { bd = d; best = e; }
        }
        cur = best;
      }
      G.fx.bolt(pts, color, 0.22);
      if (idx === 0 && s.powers.has('echo') && Math.random() < 0.35 && hit.size) {
        const first = [...hit][0];
        G.schedule(0.12, () => { if (!first.dead) { G.fx.bolt([[p.pos.x, 1.2, p.pos.z], [first.pos.x, 1, first.pos.z]], 0xffffff, 0.15); playerHit(G, first, { ...base, proc: true }); } });
      }
      break;
    }
    case 'orbit': {
      G.addOrbit({ id: sk.id, count: sk.count, radius: sk.radius * aoe, duration: sk.duration, hitOpts: base, color, hitInterval: F.spin ? 0.3 : 0.45 });
      break;
    }
  }
  if (sk.gain) p.mana = Math.min(s.maxMana, p.mana + sk.gain * s.costScale);
  if (sk.mana) { p.mana = Math.min(s.maxMana, p.mana + s.maxMana * sk.mana); G.fx.text(p.pos.x, 2.4, p.pos.z, '+' + Math.round(s.maxMana * sk.mana) + ' mana', 'cold'); }
  return true;
}

// Vortex augment: drag nearby enemies toward a point.
export function pullIn(G, at, r, strength) {
  for (const e of G.activeEnemies) {
    if (e.dead || e.boss) continue;
    const dx = at.x - e.pos.x, dz = at.z - e.pos.z, d = Math.hypot(dx, dz);
    if (d > r + 1 || d < 1) continue;
    const k = Math.min(strength, d - 0.8) / d;
    moveWithCollision(G.dungeon, e.pos, dx * k, dz * k, e.radius * 0.8);
  }
}

// Augment choices available to this hero now: [{ idx, tier, level, unlocked, chosen, options }]
export function augmentSlots(G) {
  const out = [];
  for (const idx of [1, 2, 3, 4, 0]) {
    const tiers = augmentTiers(G.cls.skills[idx]);
    tiers.forEach((options, tier) => {
      const level = AUG_LEVELS[idx][tier];
      out.push({ idx, tier, level, unlocked: G.hero.level >= level, chosen: (G.hero.augments || {})[`${idx}_${tier}`], options });
    });
  }
  return out;
}
