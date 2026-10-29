// Skill augments: from level 12 each skill unlocks two tiers of upgrades, each a choice of two.
// Augments are generic per skill type so every class gets them; `apply` edits a copy of the
// skill definition and `flags` turn on special behaviour in the skill engine.

// Unlock levels per skill slot (0 = basic attack) for tier I and tier II.
export const AUG_LEVELS = { 1: [12, 25], 2: [14, 30], 3: [16, 35], 4: [18, 40], 0: [20, 45] };

const A = (id, name, desc, apply, flags = {}) => ({ id, name, desc, apply, flags });

export const AUGMENTS = {
  melee: [
    [A('wide', 'Wide Swing', '+60° arc and +20% reach.', (s) => { s.arc = Math.min(360, s.arc + 60); s.range *= 1.2; }),
     A('heavy', 'Heavy Hitter', '+40% damage and a 30% chance to stun.', (s) => { s.mult *= 1.4; if (!s.status) { s.status = 'stun'; s.statusChance = 0.3; } })],
    [A('echo', 'Echo Strike', 'Strikes again a moment later for 60% damage.', () => {}, { echo: 0.6 }),
     A('bleed', 'Bloodletting', 'Always causes bleeding, and bleeding enemies take 25% more from it.', (s) => { s.status = 'bleed'; s.statusChance = 1; }, { bleedAmp: 0.25 })],
  ],
  proj: [
    [A('split', 'Split Shot', '+2 projectiles in a wider fan.', (s) => { s.count = (s.count || 1) + 2; s.spread = Math.max(s.spread || 0, 30); s.mult *= 0.85; }),
     A('volatile', 'Volatile', 'Explodes on impact (bigger blast if it already explodes).', (s) => { s.explode = s.explode ? s.explode * 1.5 : 2.4; })],
    [A('seeker', 'Seeker', 'Homes in on enemies and pierces two more.', (s) => { s.homing = true; s.pierce = (s.pierce || 0) + 2; }),
     A('overload', 'Overload', '+60% damage, but costs 30% more.', (s) => { s.mult *= 1.6; s.cost = (s.cost || 0) * 1.3; })],
  ],
  nova: [
    [A('widen', 'Expanding', '+35% radius.', (s) => { s.radius *= 1.35; }),
     A('vortex', 'Vortex', 'Drags enemies toward you before it hits.', () => {}, { pull: 2.5 })],
    [A('echonova', 'Aftershock', 'A second pulse follows for 70% damage.', () => {}, { echo: 0.7 }),
     A('empower', 'Empowered', '+50% damage and its effect always applies.', (s) => { s.mult *= 1.5; if (s.status) s.statusChance = 1; })],
  ],
  ground: [
    [A('linger', 'Lingering', 'Lasts 50% longer (instant blasts leave a damaging field).', (s) => { if (s.duration) s.duration *= 1.5; else { s.burnGround = true; } }),
     A('twin', 'Twin Cast', 'A second copy lands beside the first.', () => {}, { twin: true })],
    [A('quick', 'Quickened', 'Lands 40% faster and ticks 30% faster.', (s) => { if (s.delay) s.delay *= 0.6; if (s.tick) s.tick *= 0.7; }),
     A('cataclysm', 'Cataclysm', '+40% radius and +25% damage, but costs 25% more.', (s) => { s.radius *= 1.4; s.mult *= 1.25; s.cost = (s.cost || 0) * 1.25; })],
  ],
  dash: [
    [A('afterimage', 'Afterimage', 'Leaves an explosion where you started.', () => {}, { afterimage: true }),
     A('swift', 'Swift Recovery', '40% shorter cooldown.', (s) => { s.cd *= 0.6; })],
    [A('momentum', 'Momentum', 'Kills during the dash reset its cooldown.', () => {}, { momentum: true }),
     A('fortify', 'Fortify', 'Take 30% less damage for 3s after dashing.', () => {}, { fortify: true })],
  ],
  buff: [
    [A('extend', 'Extended', 'Lasts 50% longer.', (s) => { s.duration *= 1.5; }),
     A('rally', 'Rally', 'Also heals 15% life and restores 20% mana.', (s) => { s.heal = (s.heal || 0) + 0.15; s.mana = (s.mana || 0) + 0.2; })],
    [A('overflow', 'Overflow', 'Its bonuses are 30% stronger.', () => {}, { buffAmp: 0.3 }),
     A('recharge', 'Quick Recharge', '30% shorter cooldown.', (s) => { s.cd *= 0.7; })],
  ],
  summon: [
    [A('legion', 'Legion', '+2 maximum and one extra per cast.', (s) => { s.max += 2; s.count += 1; }),
     A('brutes', 'Brutes', 'Minions have +50% damage and life.', (s) => { s.dmgMult *= 1.5; s.hpMult *= 1.5; })],
    [A('martyr', 'Martyrs', 'Minions explode when they die.', () => {}, { martyr: true }),
     A('frenzied', 'Frenzied', 'Minions attack 40% faster.', () => {}, { frenzied: true })],
  ],
  chain: [
    [A('arc', 'Arc', '+3 jumps.', (s) => { s.jumps = (s.jumps || 0) + 3; }),
     A('amplify', 'Amplify', 'Each jump deals 15% more than the last.', () => {}, { amp: 0.15 })],
    [A('overcharge', 'Overcharge', '+30% damage and always shocks.', (s) => { s.mult *= 1.3; s.status = 'shock'; s.statusChance = 1; }),
     A('siphon', 'Siphon', 'Each enemy hit restores 1.5% mana.', () => {}, { siphon: 0.015 })],
  ],
  orbit: [
    [A('more', 'Satellites', '+2 orbiters.', (s) => { s.count += 2; }),
     A('wideorbit', 'Wide Orbit', '+40% radius and +20% damage.', (s) => { s.radius *= 1.4; s.mult *= 1.2; })],
    [A('lasting', 'Lasting', 'Lasts 50% longer.', (s) => { s.duration *= 1.5; }),
     A('spin', 'Spin Cycle', 'Spins faster, hitting 50% more often.', () => {}, { spin: true })],
  ],
};

// The two augment tiers (each [optionA, optionB]) available to a skill.
export function augmentTiers(sk) {
  // buffs with a damaging pulse (Whirlwind, Static Field) use the nova upgrades
  const type = sk.type === 'buff' && sk.pulse ? 'nova' : sk.type;
  return AUGMENTS[type] || AUGMENTS.buff;
}
