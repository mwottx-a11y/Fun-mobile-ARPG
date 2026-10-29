// Random item generation.
import { RARITIES, WEAPONS, BASES, AFFIXES, POWERS, MATERIALS, SLOT_WEIGHTS, RARE_NAMES_A, RARE_NAMES_B, affixById, powerById, rarityIndex } from './data/items.js';
import { power, rand, randi, pick, weighted, uid, clamp } from './util.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function materialName(mat, ilvl) {
  const list = MATERIALS[mat];
  const idx = Math.floor(ilvl / 10);
  if (idx < list.length) return list[idx];
  const over = idx - list.length + 2;
  return list[list.length - 1] + ' ' + (ROMAN[over] || over);
}

export function rollRarity(floor, mf = 0, minRarity = 0) {
  const list = RARITIES.filter((r, i) => i >= minRarity && (!r.minFloor || floor >= r.minFloor));
  const depth = 1 + Math.min(floor, 300) * 0.015;
  return weighted(list, (r) => r.weight * (1 + (mf / 100) * r.mfk) * (r.mfk >= 1 ? depth : 1));
}

function affixValue(def, ilvl, q) {
  const [a, b] = def.r;
  const base = a + (b - a) * q;
  switch (def.kind) {
    case 'flat': return base * power(ilvl);
    case 'lin': return Math.max(1, Math.round(base * (1 + ilvl * 0.12)));
    case 'pct': return Math.round(base * (1 + 0.35 * Math.log2(1 + ilvl / 8)) * 10) / 10;
    case 'int': return 1;
  }
  return base;
}

export function rollAffix(slotType, ilvl, exclude = []) {
  const pool = AFFIXES.filter((a) => a.slots.includes(slotType) && !exclude.includes(a.id));
  const def = weighted(pool, (a) => a.w);
  const q = Math.pow(Math.random(), 0.85);
  return { id: def.id, stat: def.stat, value: affixValue(def, ilvl, q), q: Math.round(q * 100) };
}

export function generateItem({ ilvl, floor = ilvl, mf = 0, slot = null, rarity = null, minRarity = 0 }) {
  ilvl = Math.max(1, Math.round(ilvl));
  const slotType = slot || weighted(Object.keys(SLOT_WEIGHTS), (k) => SLOT_WEIGHTS[k]);
  const rar = rarity ? RARITIES[rarityIndex(rarity)] : rollRarity(floor, mf, minRarity);
  const P = power(ilvl);
  const item = { id: uid(), slot: slotType, rarity: rar.id, ilvl, upg: 0, affixes: [] };
  if (rar.boost) item.boost = rar.boost;

  let base;
  if (slotType === 'weapon') {
    base = pick(WEAPONS);
    const roll = rand(0.9, 1.1);
    item.dmg = [base.dmg[0] * P * roll, base.dmg[1] * P * roll];
    item.speed = Math.round(base.speed * rand(0.95, 1.05) * 100) / 100;
  } else {
    base = pick(BASES[slotType]);
    if (base.armor) item.armor = base.armor * P * rand(0.9, 1.15);
    if (base.evasion) item.evasion = base.evasion * P * rand(0.9, 1.15);
  }
  item.type = base.type;
  item.baseName = `${materialName(base.mat, ilvl)} ${base.name}`;
  if (base.implicit && Object.keys(base.implicit).length) item.implicit = { ...base.implicit };

  const n = randi(rar.affixes[0], rar.affixes[1]);
  for (let i = 0; i < n; i++) item.affixes.push(rollAffix(slotType, ilvl, item.affixes.map((a) => a.id)));
  if (rar.power) item.power = pick(POWERS).id;
  item.name = makeName(item);
  return item;
}

function makeName(item) {
  switch (item.rarity) {
    case 'common': return item.baseName;
    case 'magic': {
      const a = item.affixes[0] && affixById(item.affixes[0].id), b = item.affixes[1] && affixById(item.affixes[1].id);
      return `${a ? a.pre + ' ' : ''}${item.baseName}${b ? ' ' + b.suf : ''}`;
    }
    case 'rare': case 'epic': return `${pick(RARE_NAMES_A)} ${pick(RARE_NAMES_B)}`;
    case 'legendary': return powerById(item.power).name;
    case 'mythic': return `Ancient ${powerById(item.power).name}`;
  }
  return item.baseName;
}

// Rough desirability score used for auto-compare arrows.
export function itemScore(item) {
  const r = rarityIndex(item.rarity);
  let s = item.ilvl * 2 + r * 12 + (item.upg || 0) * 3 + item.affixes.reduce((a, x) => a + x.q / 50, 0);
  if (item.power) s += 15;
  return s;
}

export function salvageValue(item) {
  const r = rarityIndex(item.rarity);
  return {
    gold: Math.round(power(item.ilvl) * 4 * (1 + r)),
    essence: [1, 2, 5, 12, 30, 80][r] * (1 + Math.floor(item.ilvl / 25)),
  };
}
export function sellValue(item) { return salvageValue(item).gold; }

// Forge costs
export function upgradeCost(item) {
  const u = item.upg || 0, r = rarityIndex(item.rarity);
  return { gold: Math.round(power(item.ilvl) * 30 * Math.pow(1.35, u) * (1 + r * 0.5)), essence: Math.round((3 + r * 3) * Math.pow(1.25, u)) };
}
export function rerollCost(item) {
  const r = rarityIndex(item.rarity);
  return { gold: Math.round(power(item.ilvl) * 20 * (1 + r)), essence: 4 + r * 6 + Math.floor(item.ilvl / 10) };
}
export function rerollAffix(item, index) {
  const others = item.affixes.filter((_, i) => i !== index).map((a) => a.id);
  item.affixes[index] = rollAffix(item.slot, item.ilvl, others);
}
// Re-roll the quality of every affix keeping its type ("temper").
export function temperCost(item) { const c = rerollCost(item); return { gold: Math.round(c.gold * 0.6), essence: Math.ceil(c.essence * 0.6) }; }
export function temperItem(item) {
  for (const a of item.affixes) {
    const def = affixById(a.id);
    const q = Math.pow(Math.random(), 0.7);
    a.value = affixValue(def, item.ilvl, q); a.q = Math.round(q * 100);
  }
}

export const clampIlvl = (v) => clamp(Math.round(v), 1, 100000);
