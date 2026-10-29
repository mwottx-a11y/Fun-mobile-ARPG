// Enemy archetypes, dungeon themes, elite modifiers and bosses.

export const ARCHETYPES = {
  grunt:   { ai: 'melee',  hp: 1.0,  dmg: 1.0, speed: 3.3, size: 0.55, range: 1.7, atkCd: 1.3, windup: 0.35, xp: 1, weight: 30 },
  runner:  { ai: 'melee',  hp: 0.6,  dmg: 0.7, speed: 5.4, size: 0.45, range: 1.5, atkCd: 0.9, windup: 0.2, xp: 0.8, weight: 16 },
  archer:  { ai: 'ranged', hp: 0.7,  dmg: 0.85, speed: 3.0, size: 0.5, range: 11, keep: 7, atkCd: 2.0, windup: 0.4, projSpeed: 13, xp: 1.1, weight: 16 },
  caster:  { ai: 'caster', hp: 0.8,  dmg: 1.5, speed: 2.8, size: 0.5, range: 10, keep: 6, atkCd: 3.6, windup: 0.3, radius: 2.4, xp: 1.3, weight: 11 },
  brute:   { ai: 'brute',  hp: 2.8,  dmg: 1.8, speed: 2.4, size: 0.95, range: 2.4, atkCd: 2.2, windup: 0.7, radius: 2.4, xp: 2.5, weight: 9 },
  swarmer: { ai: 'melee',  hp: 0.32, dmg: 0.45, speed: 4.9, size: 0.32, range: 1.2, atkCd: 0.8, windup: 0.15, xp: 0.35, weight: 10, group: [3, 6] },
  bomber:  { ai: 'bomber', hp: 0.5,  dmg: 2.4, speed: 4.6, size: 0.45, range: 1.6, atkCd: 9, windup: 0.6, radius: 2.6, xp: 0.9, weight: 7 },
  charger: { ai: 'charger', hp: 1.5, dmg: 1.4, speed: 3.0, size: 0.7, range: 9, atkCd: 3.5, windup: 0.6, xp: 1.6, weight: 8 },
};

export const THEMES = [
  { id: 'crypt', name: 'Forgotten Crypt', floor: 0x4a4740, wall: 0x6b665c, fog: 0x0b0a10, light: 0xffb070, color: 0xd8d0b8, eye: 0x60c0ff, elem: 'phys', casterElem: 'shadow',
    names: { grunt: 'Skeleton', runner: 'Bone Hound', archer: 'Skeleton Archer', caster: 'Bone Mage', brute: 'Bone Golem', swarmer: 'Crawling Skull', bomber: 'Corpse Bloat', charger: 'Death Knight' },
    boss: 'The Bone King' },
  { id: 'caves', name: 'Goblin Warrens', floor: 0x4c3b2a, wall: 0x6a5238, fog: 0x0d0904, light: 0xffa050, color: 0x6aa040, eye: 0xffe040, elem: 'phys', casterElem: 'fire',
    names: { grunt: 'Goblin Grunt', runner: 'Goblin Sneak', archer: 'Goblin Slinger', caster: 'Goblin Shaman', brute: 'Cave Troll', swarmer: 'Gremlin', bomber: 'Goblin Sapper', charger: 'Warg Rider' },
    boss: 'Grubnak the Warlord' },
  { id: 'nest', name: 'Spider Nest', floor: 0x2f3328, wall: 0x464a3a, fog: 0x060805, light: 0xb0ff90, color: 0x3a3040, eye: 0xff3030, elem: 'poison', casterElem: 'poison',
    names: { grunt: 'Cave Spider', runner: 'Skitterling', archer: 'Web Spitter', caster: 'Brood Witch', brute: 'Giant Tarantula', swarmer: 'Spiderling', bomber: 'Egg Sac', charger: 'Hunting Spider' },
    boss: 'Broodmother Xil' },
  { id: 'frozen', name: 'Frozen Depths', floor: 0x5a6a7a, wall: 0x8aa0b8, fog: 0x0a1018, light: 0xa0d0ff, color: 0xb0e0ff, eye: 0x40f0ff, elem: 'cold', casterElem: 'cold',
    names: { grunt: 'Frost Ghoul', runner: 'Ice Wolf', archer: 'Rime Archer', caster: 'Frost Witch', brute: 'Yeti', swarmer: 'Ice Mite', bomber: 'Cryo Bloat', charger: 'Glacial Ram' },
    boss: 'Frost Lich Vaelith' },
  { id: 'hell', name: 'Infernal Forge', floor: 0x4a2420, wall: 0x6a3020, fog: 0x140404, light: 0xff6030, color: 0xc03020, eye: 0xffd020, elem: 'fire', casterElem: 'fire',
    names: { grunt: 'Imp Soldier', runner: 'Hellhound', archer: 'Flame Spitter', caster: 'Pyre Cultist', brute: 'Pit Fiend', swarmer: 'Ember Imp', bomber: 'Magma Bloat', charger: 'Infernal Bull' },
    boss: 'Azgaroth the Burning' },
  { id: 'storm', name: 'Storm Spire', floor: 0x3a3f50, wall: 0x50587a, fog: 0x06081a, light: 0x80a0ff, color: 0x8090c0, eye: 0x80ffff, elem: 'light', casterElem: 'light',
    names: { grunt: 'Clockwork Guard', runner: 'Spark Drone', archer: 'Tesla Turret', caster: 'Storm Mage', brute: 'Iron Colossus', swarmer: 'Volt Mite', bomber: 'Overloaded Core', charger: 'Thunder Construct' },
    boss: 'The Storm Engine' },
  { id: 'swamp', name: 'Plague Bog', floor: 0x34402a, wall: 0x4a5a34, fog: 0x080c04, light: 0xc0ff60, color: 0x7a9a50, eye: 0xd0ff40, elem: 'poison', casterElem: 'poison',
    names: { grunt: 'Plague Zombie', runner: 'Rot Rat', archer: 'Bile Spitter', caster: 'Plague Doctor', brute: 'Abomination', swarmer: 'Maggot', bomber: 'Pus Bloat', charger: 'Swamp Beast' },
    boss: 'Mortis the Plaguebearer' },
  { id: 'abyss', name: 'The Abyss', floor: 0x261c34, wall: 0x3a2a54, fog: 0x07040e, light: 0xc070ff, color: 0x502a80, eye: 0xff40ff, elem: 'shadow', casterElem: 'shadow',
    names: { grunt: 'Void Stalker', runner: 'Shade', archer: 'Void Seer', caster: 'Abyssal Priest', brute: 'Void Behemoth', swarmer: 'Mindling', bomber: 'Rift Bloat', charger: 'Nightmare' },
    boss: 'Herald of the Void' },
];
// Each theme lasts 5 floors, then the next one (cycling forever, with an "Ascended" prefix on later loops).
export function themeForFloor(floor) {
  const idx = Math.floor((floor - 1) / 5);
  const t = THEMES[idx % THEMES.length];
  const loop = Math.floor(idx / THEMES.length);
  return { ...t, loop, displayName: (loop ? ['Ascended ', 'Mythic ', 'Eternal ', 'Primal '][Math.min(loop - 1, 3)] + (loop > 4 ? `${loop} ` : '') : '') + t.name };
}

export const ELITE_MODS = [
  { id: 'fast', name: 'Fast', desc: 'moves and attacks quickly' },
  { id: 'huge', name: 'Huge', desc: 'massive and tough' },
  { id: 'vampiric', name: 'Vampiric', desc: 'heals when hitting' },
  { id: 'molten', name: 'Molten', desc: 'explodes on death' },
  { id: 'frozen', name: 'Frozen', desc: 'attacks chill' },
  { id: 'shielded', name: 'Shielded', desc: 'takes half damage' },
  { id: 'teleporter', name: 'Teleporter', desc: 'blinks to you' },
  { id: 'arcane', name: 'Arcane', desc: 'fires orb rings' },
  { id: 'berserk', name: 'Berserk', desc: 'enrages at low life' },
  { id: 'regen', name: 'Regenerating', desc: 'regenerates life' },
  { id: 'mighty', name: 'Mighty', desc: 'hits much harder' },
  { id: 'summoner', name: 'Summoner', desc: 'calls minions' },
];

export const BOSS_ABILITIES = ['slam', 'ring', 'summon', 'charge', 'rain', 'beam'];
