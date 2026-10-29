// Stat aggregation: race + class + level + allocated points + gear + buffs -> final stats.
import { classById } from './data/classes.js';
import { raceById } from './data/races.js';
import { powerById } from './data/items.js';
import { power, clamp, fmt } from './util.js';

export const PRIMS = ['str', 'dex', 'int', 'vit', 'spi', 'lck'];
export const PRIM_NAMES = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence', vit: 'Vitality', spi: 'Spirit', lck: 'Luck' };
export const PRIM_DESC = {
  str: '+armor. Main stat for Warrior, Paladin, Berserker (+1% damage each).',
  dex: '+evasion, +crit chance. Main stat for Rogue, Ranger, Monk.',
  int: '+mana, +resistances. Main stat for Mage, Necromancer, Stormcaller, Warlock.',
  vit: '+5 life per point (scaled by level).',
  spi: '+mana, +mana regen, +healing. Main stat for Cleric, Druid.',
  lck: '+crit chance, +magic find, +gold find.',
};
export const ELEMENTS = ['phys', 'fire', 'cold', 'light', 'poison', 'holy', 'shadow'];
export const ELEM_NAMES = { phys: 'Physical', fire: 'Fire', cold: 'Cold', light: 'Lightning', poison: 'Poison', holy: 'Holy', shadow: 'Shadow' };
export const ELEM_COLORS = { phys: 0xdddddd, fire: 0xff6a20, cold: 0x70d0ff, light: 0xfff060, poison: 0x70ff40, holy: 0xffe8a0, shadow: 0xb050ff };

// Labels for affix/stat display. pct => show "%", flat values are formatted with fmt().
export const STAT_LABELS = {
  str: ['Strength', ''], dex: ['Dexterity', ''], int: ['Intelligence', ''], vit: ['Vitality', ''], spi: ['Spirit', ''], lck: ['Luck', ''],
  allStats: ['All Attributes', ''],
  hp: ['Maximum Life', ''], hpPct: ['Maximum Life', '%'], hpRegen: ['Life per Second', ''], hpRegenPct: ['Life Regeneration', '%'],
  lifeOnHit: ['Life on Hit', ''], lifeOnKill: ['Life on Kill', ''], lifeSteal: ['Life Steal', '%'],
  mana: ['Maximum Mana', ''], manaPct: ['Maximum Mana', '%'], manaRegen: ['Mana per Second', ''], manaRegenPct: ['Mana Regeneration', '%'],
  manaOnKill: ['Mana on Kill', ''], costRed: ['Resource Cost Reduction', '%'],
  armor: ['Armor', ''], armorPct: ['Armor', '%'], evasion: ['Evasion', ''], evasionPct: ['Evasion', '%'], block: ['Block Chance', '%'],
  dr: ['Damage Reduction', '%'], thorns: ['Thorns', ''], thornsPct: ['Thorns Damage', '%'],
  resFire: ['Fire Resistance', '%'], resCold: ['Cold Resistance', '%'], resLight: ['Lightning Resistance', '%'],
  resPoison: ['Poison Resistance', '%'], resShadow: ['Shadow Resistance', '%'], resAll: ['All Resistances', '%'],
  dmgPct: ['Damage', '%'], physPct: ['Physical Damage', '%'], firePct: ['Fire Damage', '%'], coldPct: ['Cold Damage', '%'],
  lightPct: ['Lightning Damage', '%'], poisonPct: ['Poison Damage', '%'], holyPct: ['Holy Damage', '%'], shadowPct: ['Shadow Damage', '%'],
  elemPct: ['Elemental Damage', '%'],
  addPhys: ['Physical Damage to Hits', ''], addFire: ['Fire Damage to Hits', ''], addCold: ['Cold Damage to Hits', ''],
  addLight: ['Lightning Damage to Hits', ''], addPoison: ['Poison Damage to Hits', ''],
  critChance: ['Critical Chance', '%'], critDmg: ['Critical Damage', '%'], atkSpd: ['Attack Speed', '%'], cdr: ['Cooldown Reduction', '%'],
  skillDmg: ['Skill Damage', '%'], aoe: ['Area of Effect', '%'], projCount: ['Projectiles', ''], pierce: ['Pierce', ''],
  eliteDmg: ['Damage to Elites', '%'], execute: ['Damage to Low-Life Enemies', '%'],
  burnChance: ['Chance to Burn', '%'], chillChance: ['Chance to Chill', '%'], shockChance: ['Chance to Shock', '%'],
  poisonChance: ['Chance to Poison', '%'], bleedChance: ['Chance to Bleed', '%'], stunChance: ['Chance to Stun', '%'],
  dotPct: ['Damage over Time', '%'], moveSpd: ['Movement Speed', '%'], mf: ['Magic Find', '%'], gf: ['Gold Find', '%'],
  xp: ['Experience Gained', '%'], pickup: ['Pickup Radius', '%'], minionDmg: ['Minion Damage', '%'], minionHp: ['Minion Life', '%'],
  healPct: ['Healing Received', '%'], potionPct: ['Potion Healing', '%'],
};

export function fmtStatLine(stat, value) {
  const [label, unit] = STAT_LABELS[stat] || [stat, ''];
  const sign = value >= 0 ? '+' : '';
  if (unit === '%') return `${sign}${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10}% ${label}`;
  return `${sign}${Number.isInteger(value) || Math.abs(value) >= 10 ? fmt(value) : value.toFixed(1)} ${label}`;
}

// Value of an affix/implicit after mythic boost and forge upgrades.
export function itemMult(item) { return (item.boost || 1) * (1 + 0.07 * (item.upg || 0)); }

export function weaponDamage(item) {
  const m = 1 + 0.07 * (item.upg || 0);
  return [item.dmg[0] * m, item.dmg[1] * m];
}

export function computeStats(hero, buffs = [], runtime = {}) {
  const cls = classById(hero.cls), race = raceById(hero.race);
  const m = Object.create(null);
  const add = (mods, mult = 1) => { for (const k in mods) m[k] = (m[k] || 0) + mods[k] * mult; };
  const g = (k) => m[k] || 0;
  const lvl = hero.level;
  for (const k of PRIMS) m[k] = cls.base[k] + (cls.growth[k] || 0) * (lvl - 1) + (hero.alloc[k] || 0);
  add(race.mods); add(cls.passive);

  const powers = new Set();
  let armorBase = 0, evasionBase = 0, weapon = null;
  for (const slot in hero.equipped) {
    const it = hero.equipped[slot];
    if (!it) continue;
    const mult = itemMult(it);
    if (it.implicit) add(it.implicit, it.upg ? 1 + 0.07 * it.upg : 1);
    for (const a of it.affixes) m[a.stat] = (m[a.stat] || 0) + (a.stat === 'projCount' || a.stat === 'pierce' ? a.value : a.value * mult);
    if (it.armor) armorBase += it.armor * (1 + 0.07 * (it.upg || 0));
    if (it.evasion) evasionBase += it.evasion * (1 + 0.07 * (it.upg || 0));
    if (it.power) { powers.add(it.power); const p = powerById(it.power); if (p && p.mods) add(p.mods); }
    if (slot === 'weapon') weapon = it;
  }
  for (const b of buffs) if (b.mods) add(b.mods, b.scale || 1);
  if (m.allStats) for (const k of PRIMS) m[k] += m.allStats;
  for (const k of PRIMS) m[k] = Math.max(0, m[k]);

  const P = power(lvl);
  const s = { raw: m, powers, level: lvl };
  s.main = cls.main; s.mainVal = m[cls.main];
  for (const k of PRIMS) s[k] = m[k];

  // Offense
  if (weapon) {
    const [a, b] = weaponDamage(weapon);
    s.wMin = a; s.wMax = b; s.wSpeed = weapon.speed; s.wType = weapon.type;
  } else { s.wMin = 2 * P; s.wMax = 4 * P; s.wSpeed = 1.3; s.wType = 'fists'; }
  s.wMin += g('addPhys') * 0.75; s.wMax += g('addPhys') * 1.25;
  s.favored = cls.favored.includes(s.wType);
  s.dmgMult = 1 + s.mainVal / 100 + g('dmgPct') / 100 + (s.favored ? 0.15 : 0);
  s.elemPct = {
    phys: g('physPct'), fire: g('firePct') + g('elemPct'), cold: g('coldPct') + g('elemPct'), light: g('lightPct') + g('elemPct'),
    poison: g('poisonPct'), holy: g('holyPct'), shadow: g('shadowPct'),
  };
  s.added = { fire: g('addFire'), cold: g('addCold'), light: g('addLight'), poison: g('addPoison') };
  s.critChance = clamp(5 + s.lck * 0.05 + s.dex * 0.03 + g('critChance'), 0, 85);
  s.critDmg = 50 + g('critDmg') + s.lck * 0.1;
  s.atkSpd = clamp(g('atkSpd'), -50, 250);
  s.attacksPerSec = s.wSpeed * (1 + s.atkSpd / 100);
  s.cdr = clamp(g('cdr'), 0, 60);
  s.skillDmg = g('skillDmg');
  s.aoe = clamp(g('aoe'), -50, 200);
  s.projCount = Math.floor(g('projCount'));
  s.pierce = Math.floor(g('pierce'));
  s.eliteDmg = g('eliteDmg'); s.execute = g('execute');
  s.dotPct = g('dotPct');
  s.status = { burn: g('burnChance'), chill: g('chillChance'), shock: g('shockChance'), poison: g('poisonChance'), bleed: g('bleedChance'), stun: g('stunChance') };
  s.lifeSteal = clamp(g('lifeSteal'), 0, 25);
  s.lifeOnHit = g('lifeOnHit') + (cls.passive.lifeOnHit ? cls.passive.lifeOnHit * (P - 1) : 0);
  s.lifeOnKill = g('lifeOnKill') + (cls.passive.lifeOnKill ? cls.passive.lifeOnKill * (P - 1) : 0);
  s.manaOnKill = g('manaOnKill');
  s.minionDmg = g('minionDmg'); s.minionHp = g('minionHp');

  // Defense
  s.maxHp = Math.max(1, ((40 + s.vit * 5) * P + g('hp')) * (1 + g('hpPct') / 100));
  s.maxMana = Math.max(10, (40 + s.int + s.spi * 2 + lvl * 1.5 + g('mana')) * (1 + g('manaPct') / 100));
  s.healMult = Math.max(0, 1 + (g('healPct') + s.spi * 0.1) / 100);
  s.hpRegen = (s.maxHp * 0.004 + g('hpRegen')) * (1 + g('hpRegenPct') / 100);
  s.manaRegen = (2.5 + s.spi * 0.08 + g('manaRegen')) * (1 + g('manaRegenPct') / 100);
  s.costMult = clamp(1 - g('costRed') / 100, 0.3, 1);
  s.armor = (armorBase + g('armor') + s.str * 0.3 * P) * (1 + g('armorPct') / 100);
  s.evasion = (evasionBase + g('evasion') + s.dex * 0.3 * P) * (1 + g('evasionPct') / 100);
  s.block = clamp(g('block'), 0, 70);
  s.dr = clamp(g('dr'), -50, 60);
  s.thorns = (g('thorns') + s.str * 0.05 * P) * (1 + g('thornsPct') / 100);
  const ra = g('resAll') + s.int * 0.04;
  s.res = {
    phys: 0, fire: clamp(g('resFire') + ra, -100, 75), cold: clamp(g('resCold') + ra, -100, 75), light: clamp(g('resLight') + ra, -100, 75),
    poison: clamp(g('resPoison') + ra, -100, 75), shadow: clamp(g('resShadow') + ra, -100, 75), holy: clamp(ra, -100, 75),
  };

  // Utility
  s.moveSpeed = 6 * (1 + clamp(g('moveSpd'), -50, 100) / 100);
  s.mf = g('mf') + s.lck * 0.3;
  s.gf = g('gf') + s.lck * 0.4;
  s.xpMult = 1 + g('xp') / 100;
  s.pickup = 2.2 * (1 + g('pickup') / 100);
  s.potionMult = 1 + g('potionPct') / 100;
  return s;
}

// Armor/evasion become percentages relative to the attacker's level.
export const armorDR = (armor, lvl) => clamp(armor / (armor + 60 * power(lvl)), 0, 0.8);
export const dodgeChance = (ev, lvl) => clamp(ev / (ev + 90 * power(lvl)), 0, 0.5);

// Approximate DPS for the character sheet / item comparison.
export function estimateDps(s) {
  const avg = (s.wMin + s.wMax) / 2 + Object.values(s.added).reduce((a, b) => a + b, 0);
  const crit = 1 + (s.critChance / 100) * (s.critDmg / 100);
  return avg * s.dmgMult * crit * s.attacksPerSec;
}

export function xpToNext(level) { return Math.round(260 * power(level) * (1 + level * 0.06)); }
