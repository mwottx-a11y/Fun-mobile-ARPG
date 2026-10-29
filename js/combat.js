// Damage pipeline (player -> enemy, enemy -> player), status effects, kills and power hooks.
import { rand, chance, clamp, dist2, fmt, power } from './util.js';
import { armorDR, dodgeChance, ELEM_COLORS } from './stats.js';
import { sfx } from './sfx.js';

const ELEM_STATUS = { fire: 'burn', cold: 'chill', light: 'shock', poison: 'poison', phys: 'bleed' };
const TEXT_CLASS = { phys: '', fire: 'fire', cold: 'cold', light: 'light', poison: 'poison', holy: 'holy', shadow: 'shadow' };

// opts: { mult, elem, skill, isBasic, status, statusChance, proc, minion, rank, noText, dot }
export function playerHit(G, e, opts) {
  if (e.dead) return 0;
  const s = G.stats, p = G.player;
  const elem = opts.elem || 'phys';
  const mult = opts.mult ?? 1;
  let dmg = rand(s.wMin, s.wMax) * mult * (1 + s.elemPct[elem] / 100);
  for (const k in s.added) if (s.added[k] > 0) dmg += s.added[k] * mult * (1 + s.elemPct[k] / 100);
  dmg *= s.dmgMult * (opts.rank ? 1 + 0.15 * (opts.rank - 1) : 1);
  if (opts.skill && !opts.isBasic) {
    dmg *= 1 + s.skillDmg / 100;
    if (s.powers.has('overcharge')) dmg *= 1.6;
    if (s.powers.has('bloodpact')) dmg *= 1.35;
  }
  if (opts.minion) dmg *= opts.minion;
  if (s.powers.has('soulharvest') && p.souls > 0) dmg *= 1 + 0.03 * p.souls;
  if (s.powers.has('rage')) dmg *= 1 + (1 - p.hp / s.maxHp);
  if (e.elite) dmg *= 1 + s.eliteDmg / 100;
  if (e.hp < e.maxHp * 0.3) dmg *= (1 + s.execute / 100) * (s.powers.has('executioner') ? 2 : 1);
  if (e.st.shock > 0) dmg *= 1.25;
  if (e.st.freeze > 0 && s.powers.has('frostbound')) dmg *= 1.4;
  if (e.mods && e.mods.has('shielded')) dmg *= 0.5;
  const crit = chance(s.critChance / 100);
  if (crit) dmg *= 1 + s.critDmg / 100;
  dmg = Math.max(1, dmg);

  e.hp -= dmg;
  e.hitFlash = 0.12;
  sfx(crit ? 'crit' : 'hit');
  if (!e.aggro) G.onAggro(e, true);
  if (!opts.noText) G.fx.text(e.pos.x, 1.6 * e.scale, e.pos.z, fmt(dmg) + (crit ? '!' : ''), (crit ? 'crit ' : '') + (TEXT_CLASS[elem] || ''));

  // leech
  if (!opts.minion) {
    let heal = s.lifeOnHit;
    if (s.lifeSteal) heal += Math.min(dmg * s.lifeSteal / 100, s.maxHp * 0.04);
    if (crit && s.powers.has('vampkiss')) heal += s.maxHp * 0.02;
    if (heal > 0) healPlayer(G, heal, true);
  }

  // statuses: skill status, element natural chance, and gear chances
  if (opts.status && chance(opts.statusChance ?? 1)) applyStatus(G, e, opts.status, dmg);
  const st = s.status;
  const natural = ELEM_STATUS[elem];
  for (const k in st) {
    const c = st[k] + (k === natural ? 5 : 0);
    if (c > 0 && chance(c / 100)) applyStatus(G, e, k === 'chill' && e.st.chill > 0 && chance(0.25) ? 'freeze' : k, dmg);
  }
  if (s.powers.has('frostbound') && !opts.proc) applyStatus(G, e, 'chill', dmg);

  // on-hit powers
  if (!opts.proc && !opts.minion) {
    if (s.powers.has('stormcaller') && chance(0.2)) {
      G.fx.bolt([[e.pos.x, 9, e.pos.z], [e.pos.x, 0.2, e.pos.z]], 0xfff080, 0.25);
      G.fx.flash(e.pos.x, e.pos.z, 1.5, 0xfff080, 0.3);
      G.schedule(0.01, () => playerHit(G, e, { mult: 1.5, elem: 'light', proc: true }));
    }
    if (s.powers.has('midas') && chance(0.05)) G.spawnGold(e.pos.x, e.pos.z, e.level, 0.3);
    if (crit && s.powers.has('avalanche')) {
      G.fx.flash(e.pos.x, e.pos.z, 3, 0x80e0ff, 0.35);
      G.schedule(0.01, () => G.aoePlayer(e.pos.x, e.pos.z, 3, { mult: 0.8, elem: 'cold', status: 'chill', proc: true }));
    }
  }
  if (e.hp <= 0) killEnemy(G, e);
  return dmg;
}

export function applyStatus(G, e, kind, hitDmg) {
  const s = G.stats;
  const dot = 1 + s.dotPct / 100;
  const st = e.st;
  switch (kind) {
    case 'burn': st.burn = 3; st.burnDps = Math.max(st.burnDps || 0, hitDmg * 0.35 * dot); break;
    case 'poison': st.poison = 4; st.poisonStacks = Math.min(10, (st.poisonStacks || 0) + 1); st.poisonDps = Math.max(st.poisonDps || 0, hitDmg * 0.12 * dot); break;
    case 'bleed': st.bleed = 3; st.bleedDps = Math.max(st.bleedDps || 0, hitDmg * 0.3 * dot); break;
    case 'chill': st.chill = 2.5; break;
    case 'freeze': if (st.freezeImmune <= 0) { st.freeze = e.boss ? 0.4 : 1.3; st.freezeImmune = e.boss ? 4 : 2.5; G.fx.burst(e.pos.x, 1, e.pos.z, 0xa0e8ff, 8, 3, 0.4); } break;
    case 'shock': st.shock = 3; break;
    case 'stun': if (st.stunImmune <= 0) { st.stun = e.boss ? 0.3 : 1.0; st.stunImmune = e.boss ? 5 : 2; } break;
  }
}

// Called every frame per active enemy.
export function tickStatuses(G, e, dt) {
  const st = e.st;
  let dotDmg = 0;
  if (st.burn > 0) { st.burn -= dt; dotDmg += st.burnDps * dt; if (st.burn <= 0) st.burnDps = 0; }
  if (st.poison > 0) { st.poison -= dt; dotDmg += st.poisonDps * st.poisonStacks * dt; if (st.poison <= 0) { st.poisonStacks = 0; st.poisonDps = 0; } }
  if (st.bleed > 0) { st.bleed -= dt; dotDmg += st.bleedDps * dt; if (st.bleed <= 0) st.bleedDps = 0; }
  for (const k of ['chill', 'freeze', 'shock', 'stun', 'freezeImmune', 'stunImmune', 'shieldT']) if (st[k] > 0) st[k] -= dt;
  if (dotDmg > 0) {
    e.hp -= dotDmg;
    e.dotAcc = (e.dotAcc || 0) + dotDmg;
    e.dotTextT = (e.dotTextT || 0) - dt;
    if (e.dotTextT <= 0) {
      e.dotTextT = 0.5;
      G.fx.text(e.pos.x, 1.4 * e.scale, e.pos.z, fmt(e.dotAcc), st.poison > 0 ? 'poison small' : st.burn > 0 ? 'fire small' : 'small');
      e.dotAcc = 0;
    }
    if (e.hp <= 0) killEnemy(G, e);
  }
}

export function healPlayer(G, amount, silent = false) {
  const p = G.player, s = G.stats;
  if (p.dead) return;
  const h = amount * s.healMult;
  const before = p.hp;
  p.hp = Math.min(s.maxHp, p.hp + h);
  if (!silent && p.hp - before > 1) G.fx.text(p.pos.x, 2.2, p.pos.z, '+' + fmt(p.hp - before), 'heal');
}

export function killEnemy(G, e) {
  if (e.dead) return;
  e.dead = true; e.hp = 0;
  sfx('kill');
  const s = G.stats, p = G.player;
  G.onEnemyKilled(e);
  if (e.suicide) return;
  if (s.lifeOnKill > 0) healPlayer(G, s.lifeOnKill, true);
  if (s.manaOnKill > 0) p.mana = Math.min(s.maxMana, p.mana + s.manaOnKill);
  if (s.powers.has('soulharvest')) { p.souls = Math.min(30, (p.souls || 0) + 1); p.soulT = 8; }
  if (s.powers.has('chainreact')) {
    const amt = e.maxHp * 0.25;
    G.fx.flash(e.pos.x, e.pos.z, 3.2, 0xff8030, 0.4);
    G.fx.burst(e.pos.x, 0.8, e.pos.z, 0xff8030, 14, 6, 0.5);
    G.schedule(0.05, () => G.aoeRaw(e.pos.x, e.pos.z, 3.2, amt, 'fire'));
  }
  if (s.powers.has('toxicbloom') && e.st.poison > 0) {
    G.fx.flash(e.pos.x, e.pos.z, 3.5, 0x70ff40, 0.45);
    G.schedule(0.05, () => G.aoePlayer(e.pos.x, e.pos.z, 3.5, { mult: 1.2, elem: 'poison', status: 'poison', proc: true }));
  }
  if (e.mods && e.mods.has('molten')) {
    G.enemyAoe(e.pos.x, e.pos.z, 3, e.dmg * 1.5, 'fire', 1.0);
  }
}

// Enemy (or hazard) damages the player. Returns damage actually taken.
export function hurtPlayer(G, amount, elem, src = null, lvl = G.floorLevel) {
  const p = G.player, s = G.stats;
  if (p.dead || p.invuln > 0 || G.godMode) return 0;
  if (chance(dodgeChance(s.evasion, lvl))) { G.fx.text(p.pos.x, 2.2, p.pos.z, 'Dodge', 'dodge'); return 0; }
  let dmg = amount;
  let blocked = false;
  if (chance(s.block / 100)) {
    blocked = true; dmg *= 0.5;
    if (s.powers.has('bulwark')) healPlayer(G, s.maxHp * 0.03, true);
  }
  if (elem === 'phys') dmg *= 1 - armorDR(s.armor, lvl);
  else dmg *= 1 - (s.res[elem] ?? 0) / 100;
  dmg *= 1 - s.dr / 100;
  if (s.powers.has('manashield') && p.mana > 0) {
    const absorb = Math.min(p.mana, dmg * 0.25);
    p.mana -= absorb; dmg -= absorb;
  }
  dmg = Math.max(0, dmg);
  p.hp -= dmg;
  p.hurtFlash = 0.15;
  sfx('hurt');
  if (dmg > s.maxHp * 0.08) G.vibrate(25);
  G.fx.text(p.pos.x, 2.3, p.pos.z, (blocked ? '🛡' : '') + fmt(dmg), 'hurt');
  G.ui.hurtVignette();
  if (src && !src.dead && s.thorns > 0 && dist2(src.pos.x, src.pos.z, p.pos.x, p.pos.z) < 12) {
    const th = s.thorns;
    src.hp -= th;
    G.fx.text(src.pos.x, 1.5 * src.scale, src.pos.z, fmt(th), 'thorns');
    if (s.powers.has('thornhide')) applyStatus(G, src, 'bleed', th);
    if (src.hp <= 0) killEnemy(G, src);
  }
  if (src && src.mods) {
    if (src.mods.has('vampiric')) src.hp = Math.min(src.maxHp, src.hp + src.maxHp * 0.05);
    if (src.mods.has('frozen')) p.chillT = 2;
  }
  if (elem === 'cold') p.chillT = Math.max(p.chillT, 1);
  if (elem === 'fire' && chance(0.3)) p.burnT = 2, p.burnDps = amount * 0.15;
  if (elem === 'poison' && chance(0.4)) p.poisonT = 3, p.poisonDps = amount * 0.1;

  if (s.powers.has('secondwind') && p.hp > 0 && p.hp < s.maxHp * 0.3 && p.secondWindCd <= 0) {
    p.secondWindCd = 45; healPlayer(G, s.maxHp * 0.4);
    G.fx.ring(p.pos.x, p.pos.z, 3, 0x80ff80, 0.6);
  }
  if (p.hp <= 0) {
    if (s.powers.has('phoenix') && p.phoenixCd <= 0) {
      p.phoenixCd = 90; p.hp = s.maxHp * 0.5; p.invuln = 2;
      G.fx.ring(p.pos.x, p.pos.z, 5, 0xff8020, 0.8); G.fx.burst(p.pos.x, 1, p.pos.z, 0xff8020, 40, 8, 0.9);
      G.ui.toast('🔥 Phoenix Heart revives you!', 'legendary');
    } else G.playerDied();
  }
  return dmg;
}

// Damage scaling for monsters at a given level
export const monsterDamage = (lvl) => 8 * power(lvl) * (1 + 0.012 * lvl);

export { ELEM_COLORS };
