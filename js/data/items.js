// Loot tables: equipment slots, base types, affixes, rarities and legendary powers.

export const EQUIP_SLOTS = ['weapon', 'offhand', 'helm', 'amulet', 'chest', 'gloves', 'ring1', 'ring2', 'belt', 'boots'];
export const SLOT_NAMES = { weapon: 'Weapon', offhand: 'Off-hand', helm: 'Helm', chest: 'Chest', gloves: 'Gloves', boots: 'Boots', belt: 'Belt', amulet: 'Amulet', ring: 'Ring', ring1: 'Ring', ring2: 'Ring' };
export const SLOT_ICONS = { weapon: '⚔️', offhand: '🛡️', helm: '⛑️', chest: '🥋', gloves: '🧤', boots: '👢', belt: '🎗️', amulet: '📿', ring: '💍', ring1: '💍', ring2: '💍' };
// Drop weights per item slot type.
export const SLOT_WEIGHTS = { weapon: 16, offhand: 8, helm: 9, chest: 9, gloves: 9, boots: 9, belt: 7, amulet: 6, ring: 10 };

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#c9c9c9', hex: 0xc9c9c9, affixes: [0, 0], weight: 560, mfk: 0 },
  { id: 'magic', name: 'Magic', color: '#5a8cff', hex: 0x5a8cff, affixes: [1, 2], weight: 300, mfk: 0.4 },
  { id: 'rare', name: 'Rare', color: '#ffd84a', hex: 0xffd84a, affixes: [3, 4], weight: 90, mfk: 1 },
  { id: 'epic', name: 'Epic', color: '#c45cff', hex: 0xc45cff, affixes: [5, 5], weight: 22, mfk: 1.2 },
  { id: 'legendary', name: 'Legendary', color: '#ff8c1a', hex: 0xff8c1a, affixes: [4, 4], weight: 6, mfk: 1.4, power: true },
  { id: 'mythic', name: 'Mythic', color: '#ff3b4e', hex: 0xff3b4e, affixes: [6, 6], weight: 0.7, mfk: 1.6, power: true, boost: 1.5, minFloor: 8 },
];
export const rarityIndex = (id) => RARITIES.findIndex((r) => r.id === id);

// Material names for the item tier (ilvl / 10). Beyond the end, roman numerals keep counting.
export const MATERIALS = {
  metal: ['Rusty', 'Iron', 'Steel', 'Tempered', 'Mithril', 'Elven', 'Dwarven', 'Adamant', 'Obsidian', 'Runic', 'Draconic', 'Celestial', 'Abyssal', 'Voidforged', 'Primordial', 'Eternal'],
  leather: ['Ragged', 'Leather', 'Studded', 'Hardened', 'Wyrmhide', 'Shadowhide', 'Drakescale', 'Demonhide', 'Wraithskin', 'Starhide', 'Titanhide', 'Eternal'],
  cloth: ['Tattered', 'Linen', 'Woolen', 'Silk', 'Mageweave', 'Runecloth', 'Moonweave', 'Spellsilk', 'Starweave', 'Voidweave', 'Eternal'],
  jewel: ['Copper', 'Silver', 'Gold', 'Jade', 'Sapphire', 'Ruby', 'Diamond', 'Starstone', 'Soulgem', 'Eternal'],
  wood: ['Rotten', 'Oak', 'Yew', 'Ironwood', 'Elderwood', 'Ghostwood', 'Dragonbone', 'Worldtree', 'Eternal'],
};

// Weapon base types. dmg is scaled by power(ilvl); speed is attacks per second.
export const WEAPONS = [
  { type: 'sword', name: 'Sword', mat: 'metal', dmg: [5, 9], speed: 1.4, implicit: { critChance: 2 } },
  { type: 'axe', name: 'Axe', mat: 'metal', dmg: [6, 11], speed: 1.25, implicit: { critDmg: 12 } },
  { type: 'mace', name: 'Mace', mat: 'metal', dmg: [7, 10], speed: 1.2, implicit: { stunChance: 4 } },
  { type: 'dagger', name: 'Dagger', mat: 'metal', dmg: [3, 7], speed: 1.7, implicit: { critChance: 4 } },
  { type: 'staff', name: 'Staff', mat: 'wood', dmg: [8, 13], speed: 1.05, implicit: { elemPct: 12 } },
  { type: 'wand', name: 'Wand', mat: 'wood', dmg: [4, 8], speed: 1.5, implicit: { skillDmg: 10 } },
  { type: 'bow', name: 'Bow', mat: 'wood', dmg: [6, 10], speed: 1.3, implicit: { atkSpd: 5 } },
  { type: 'crossbow', name: 'Crossbow', mat: 'wood', dmg: [9, 14], speed: 0.95, implicit: { critDmg: 20 } },
  { type: 'spear', name: 'Spear', mat: 'metal', dmg: [7, 11], speed: 1.2, implicit: { aoe: 10 } },
  { type: 'scythe', name: 'Scythe', mat: 'metal', dmg: [8, 12], speed: 1.1, implicit: { lifeSteal: 1 } },
  { type: 'hammer', name: 'Warhammer', mat: 'metal', dmg: [10, 15], speed: 0.9, implicit: { stunChance: 8 } },
  { type: 'claws', name: 'Claws', mat: 'metal', dmg: [4, 7], speed: 1.8, implicit: { bleedChance: 6 } },
  { type: 'scepter', name: 'Scepter', mat: 'jewel', dmg: [6, 9], speed: 1.3, implicit: { holyPct: 12 } },
];

// Non-weapon bases. armor/evasion are scaled by power(ilvl).
export const BASES = {
  offhand: [
    { type: 'shield', name: 'Shield', mat: 'metal', armor: 6, implicit: { block: 15 } },
    { type: 'orb', name: 'Orb', mat: 'jewel', implicit: { elemPct: 10, manaPct: 10 } },
    { type: 'quiver', name: 'Quiver', mat: 'leather', implicit: { atkSpd: 6, critChance: 2 } },
    { type: 'tome', name: 'Tome', mat: 'cloth', implicit: { cdr: 5, skillDmg: 6 } },
    { type: 'totem', name: 'Totem', mat: 'wood', implicit: { minionDmg: 18, minionHp: 10 } },
  ],
  helm: [
    { type: 'helm', name: 'Helm', mat: 'metal', armor: 4 },
    { type: 'cap', name: 'Cap', mat: 'leather', evasion: 4 },
    { type: 'circlet', name: 'Circlet', mat: 'jewel', armor: 1.5, implicit: { manaPct: 6 } },
  ],
  chest: [
    { type: 'plate', name: 'Plate', mat: 'metal', armor: 10 },
    { type: 'jerkin', name: 'Jerkin', mat: 'leather', evasion: 9 },
    { type: 'robe', name: 'Robe', mat: 'cloth', armor: 4, implicit: { manaPct: 12 } },
  ],
  gloves: [
    { type: 'gauntlets', name: 'Gauntlets', mat: 'metal', armor: 3 },
    { type: 'grips', name: 'Grips', mat: 'leather', evasion: 3, implicit: { atkSpd: 3 } },
    { type: 'wraps', name: 'Wraps', mat: 'cloth', armor: 1, implicit: { cdr: 2 } },
  ],
  boots: [
    { type: 'greaves', name: 'Greaves', mat: 'metal', armor: 3 },
    { type: 'boots', name: 'Boots', mat: 'leather', evasion: 3, implicit: { moveSpd: 4 } },
    { type: 'slippers', name: 'Slippers', mat: 'cloth', armor: 1, implicit: { moveSpd: 6 } },
  ],
  belt: [
    { type: 'girdle', name: 'Girdle', mat: 'metal', armor: 3, implicit: { hpPct: 4 } },
    { type: 'sash', name: 'Sash', mat: 'cloth', evasion: 2, implicit: { potionPct: 15 } },
    { type: 'cord', name: 'Cord', mat: 'leather', evasion: 2, implicit: { manaPct: 6 } },
  ],
  amulet: [
    { type: 'amulet', name: 'Amulet', mat: 'jewel', implicit: { resAll: 5 } },
    { type: 'pendant', name: 'Pendant', mat: 'jewel', implicit: { dmgPct: 6 } },
    { type: 'talisman', name: 'Talisman', mat: 'jewel', implicit: { mf: 10 } },
  ],
  ring: [
    { type: 'ring', name: 'Ring', mat: 'jewel', implicit: {} },
    { type: 'band', name: 'Band', mat: 'jewel', implicit: { hpPct: 3 } },
    { type: 'signet', name: 'Signet', mat: 'jewel', implicit: { critChance: 1.5 } },
  ],
};

// Affix groups. W weapon, O offhand, A armor (helm/chest/gloves/boots/belt), J jewelry.
const W = ['weapon'], O = ['offhand'], ARM = ['helm', 'chest', 'gloves', 'boots', 'belt'], J = ['amulet', 'ring'];
const ANY = [...W, ...O, ...ARM, ...J];
const g = (...lists) => [...new Set(lists.flat())];

// kind: flat (scales with power curve), lin (linear with ilvl), pct (slow log growth), int (+1)
export const AFFIXES = [
  { id: 'str', stat: 'str', kind: 'lin', r: [2, 5], slots: ANY, w: 10, pre: 'Brutal', suf: 'of Strength' },
  { id: 'dex', stat: 'dex', kind: 'lin', r: [2, 5], slots: ANY, w: 10, pre: 'Nimble', suf: 'of Agility' },
  { id: 'int', stat: 'int', kind: 'lin', r: [2, 5], slots: ANY, w: 10, pre: 'Brilliant', suf: 'of the Mind' },
  { id: 'vit', stat: 'vit', kind: 'lin', r: [2, 5], slots: ANY, w: 10, pre: 'Sturdy', suf: 'of the Bear' },
  { id: 'spi', stat: 'spi', kind: 'lin', r: [2, 5], slots: ANY, w: 8, pre: 'Pious', suf: 'of the Spirit' },
  { id: 'lck', stat: 'lck', kind: 'lin', r: [2, 5], slots: ANY, w: 6, pre: 'Lucky', suf: 'of Fortune' },
  { id: 'allStats', stat: 'allStats', kind: 'lin', r: [1, 3], slots: J, w: 3, pre: 'Exalted', suf: 'of the Titan' },
  { id: 'hp', stat: 'hp', kind: 'flat', r: [8, 18], slots: g(ARM, J, O), w: 10, pre: 'Hale', suf: 'of Life' },
  { id: 'hpPct', stat: 'hpPct', kind: 'pct', r: [3, 8], slots: ['chest', 'belt', 'helm', 'amulet', 'offhand'], w: 7, pre: 'Robust', suf: 'of the Colossus' },
  { id: 'hpRegen', stat: 'hpRegen', kind: 'flat', r: [0.4, 1.2], slots: g(ARM, J), w: 6, pre: 'Mending', suf: 'of Renewal' },
  { id: 'lifeOnHit', stat: 'lifeOnHit', kind: 'flat', r: [0.4, 1.2], slots: ['weapon', 'gloves', 'ring'], w: 5, pre: 'Leeching', suf: 'of the Leech' },
  { id: 'lifeOnKill', stat: 'lifeOnKill', kind: 'flat', r: [2, 5], slots: ['weapon', 'ring', 'amulet', 'belt'], w: 5, pre: 'Ghoulish', suf: 'of Feasting' },
  { id: 'lifeSteal', stat: 'lifeSteal', kind: 'pct', r: [0.4, 1.2], slots: ['weapon', 'amulet', 'ring', 'gloves'], w: 4, pre: 'Vampiric', suf: 'of the Vampire' },
  { id: 'mana', stat: 'mana', kind: 'lin', r: [5, 12], slots: g(J, O, ['helm', 'chest']), w: 6, pre: 'Arcane', suf: 'of the Magi' },
  // legacy flat regen (kept so old items still work; no longer drops)
  { id: 'manaRegen', stat: 'manaRegen', kind: 'lin', r: [0.4, 1.0], slots: g(J, O, ['helm', 'chest', 'belt']), w: 0, pre: 'Focused', suf: 'of Meditation' },
  { id: 'manaRegenPct', stat: 'manaRegenPct', kind: 'pct', r: [8, 20], slots: g(J, O, ['helm', 'chest', 'belt']), w: 6, pre: 'Focused', suf: 'of Meditation' },
  { id: 'manaPct', stat: 'manaPct', kind: 'pct', r: [5, 12], slots: g(J, O, ['helm']), w: 4, pre: 'Mystic', suf: 'of the Wellspring' },
  { id: 'manaOnKill', stat: 'manaOnKill', kind: 'lin', r: [1, 3], slots: ['weapon', 'ring', 'amulet'], w: 4, pre: 'Soulsipping', suf: 'of Souls' },
  { id: 'costRed', stat: 'costRed', kind: 'pct', r: [3, 7], slots: ['helm', 'amulet', 'ring', 'offhand'], w: 4, pre: 'Efficient', suf: 'of Efficiency' },
  { id: 'armor', stat: 'armor', kind: 'flat', r: [3, 7], slots: g(ARM, O), w: 9, pre: 'Plated', suf: 'of the Fortress' },
  { id: 'armorPct', stat: 'armorPct', kind: 'pct', r: [6, 15], slots: g(ARM, O), w: 6, pre: 'Ironclad', suf: 'of the Bulwark' },
  { id: 'evasion', stat: 'evasion', kind: 'flat', r: [3, 7], slots: g(ARM, O), w: 7, pre: 'Shifting', suf: 'of the Wind' },
  { id: 'evasionPct', stat: 'evasionPct', kind: 'pct', r: [6, 15], slots: ARM, w: 5, pre: 'Phantom', suf: 'of Shadows' },
  { id: 'block', stat: 'block', kind: 'pct', r: [2, 6], slots: O, w: 6, pre: 'Warding', suf: 'of Deflection' },
  { id: 'dr', stat: 'dr', kind: 'pct', r: [1, 3], slots: ['chest', 'offhand', 'amulet'], w: 2, pre: 'Invulnerable', suf: 'of the Aegis' },
  { id: 'thorns', stat: 'thorns', kind: 'flat', r: [2, 6], slots: ['chest', 'offhand', 'gloves', 'helm'], w: 4, pre: 'Spiked', suf: 'of Thorns' },
  { id: 'resFire', stat: 'resFire', kind: 'pct', r: [5, 12], slots: g(ARM, J, O), w: 5, pre: 'Fireproof', suf: 'of the Salamander' },
  { id: 'resCold', stat: 'resCold', kind: 'pct', r: [5, 12], slots: g(ARM, J, O), w: 5, pre: 'Insulated', suf: 'of the Yeti' },
  { id: 'resLight', stat: 'resLight', kind: 'pct', r: [5, 12], slots: g(ARM, J, O), w: 5, pre: 'Grounded', suf: 'of the Eel' },
  { id: 'resPoison', stat: 'resPoison', kind: 'pct', r: [5, 12], slots: g(ARM, J, O), w: 5, pre: 'Antidotal', suf: 'of the Serpent' },
  { id: 'resShadow', stat: 'resShadow', kind: 'pct', r: [5, 12], slots: g(ARM, J, O), w: 4, pre: 'Hallowed', suf: 'of the Dawn' },
  { id: 'resAll', stat: 'resAll', kind: 'pct', r: [3, 7], slots: g(ARM, J, O), w: 3, pre: 'Prismatic', suf: 'of the Rainbow' },
  { id: 'dmgPct', stat: 'dmgPct', kind: 'pct', r: [4, 10], slots: ['weapon', 'amulet', 'ring', 'gloves', 'offhand'], w: 8, pre: 'Savage', suf: 'of Slaughter' },
  { id: 'physPct', stat: 'physPct', kind: 'pct', r: [6, 15], slots: ['weapon', 'amulet', 'ring', 'offhand', 'helm'], w: 5, pre: 'Honed', suf: 'of Rending' },
  { id: 'firePct', stat: 'firePct', kind: 'pct', r: [6, 15], slots: ['weapon', 'amulet', 'ring', 'offhand', 'helm'], w: 5, pre: 'Blazing', suf: 'of the Inferno' },
  { id: 'coldPct', stat: 'coldPct', kind: 'pct', r: [6, 15], slots: ['weapon', 'amulet', 'ring', 'offhand', 'helm'], w: 5, pre: 'Glacial', suf: 'of Winter' },
  { id: 'lightPct', stat: 'lightPct', kind: 'pct', r: [6, 15], slots: ['weapon', 'amulet', 'ring', 'offhand', 'helm'], w: 5, pre: 'Thundering', suf: 'of Storms' },
  { id: 'poisonPct', stat: 'poisonPct', kind: 'pct', r: [6, 15], slots: ['weapon', 'amulet', 'ring', 'offhand', 'helm'], w: 5, pre: 'Venomous', suf: 'of Venom' },
  { id: 'holyPct', stat: 'holyPct', kind: 'pct', r: [6, 15], slots: ['weapon', 'amulet', 'ring', 'offhand', 'helm'], w: 4, pre: 'Radiant', suf: 'of the Sun' },
  { id: 'shadowPct', stat: 'shadowPct', kind: 'pct', r: [6, 15], slots: ['weapon', 'amulet', 'ring', 'offhand', 'helm'], w: 4, pre: 'Umbral', suf: 'of the Void' },
  { id: 'elemPct', stat: 'elemPct', kind: 'pct', r: [5, 10], slots: ['weapon', 'amulet', 'offhand'], w: 3, pre: 'Elemental', suf: 'of the Elements' },
  { id: 'addPhys', stat: 'addPhys', kind: 'flat', r: [1, 3], slots: ['weapon', 'gloves', 'ring'], w: 7, pre: 'Sharp', suf: 'of Wounding' },
  { id: 'addFire', stat: 'addFire', kind: 'flat', r: [1, 3], slots: ['weapon', 'gloves', 'ring', 'amulet'], w: 5, pre: 'Burning', suf: 'of Embers' },
  { id: 'addCold', stat: 'addCold', kind: 'flat', r: [1, 3], slots: ['weapon', 'gloves', 'ring', 'amulet'], w: 5, pre: 'Freezing', suf: 'of Frost' },
  { id: 'addLight', stat: 'addLight', kind: 'flat', r: [1, 3], slots: ['weapon', 'gloves', 'ring', 'amulet'], w: 5, pre: 'Shocking', suf: 'of Sparks' },
  { id: 'addPoison', stat: 'addPoison', kind: 'flat', r: [1, 3], slots: ['weapon', 'gloves', 'ring', 'amulet'], w: 5, pre: 'Toxic', suf: 'of Blight' },
  { id: 'critChance', stat: 'critChance', kind: 'pct', r: [1, 3], slots: ['weapon', 'gloves', 'ring', 'amulet', 'helm'], w: 7, pre: 'Precise', suf: 'of Precision' },
  { id: 'critDmg', stat: 'critDmg', kind: 'pct', r: [8, 20], slots: ['weapon', 'amulet', 'gloves', 'ring'], w: 7, pre: 'Deadly', suf: 'of Ruin' },
  { id: 'atkSpd', stat: 'atkSpd', kind: 'pct', r: [3, 8], slots: ['weapon', 'gloves', 'ring', 'amulet'], w: 7, pre: 'Swift', suf: 'of Haste' },
  { id: 'cdr', stat: 'cdr', kind: 'pct', r: [2, 5], slots: ['helm', 'amulet', 'offhand', 'ring', 'gloves'], w: 5, pre: 'Timeless', suf: 'of Alacrity' },
  { id: 'skillDmg', stat: 'skillDmg', kind: 'pct', r: [4, 10], slots: ['helm', 'amulet', 'weapon', 'offhand'], w: 6, pre: 'Masterful', suf: 'of Mastery' },
  { id: 'aoe', stat: 'aoe', kind: 'pct', r: [5, 12], slots: ['helm', 'amulet', 'chest', 'weapon'], w: 4, pre: 'Sweeping', suf: 'of Reach' },
  { id: 'projCount', stat: 'projCount', kind: 'int', r: [1, 1], slots: ['weapon', 'amulet', 'offhand'], w: 1.2, pre: 'Splitting', suf: 'of Multitudes' },
  { id: 'pierce', stat: 'pierce', kind: 'int', r: [1, 1], slots: ['weapon', 'offhand', 'gloves'], w: 2, pre: 'Piercing', suf: 'of Impaling' },
  { id: 'eliteDmg', stat: 'eliteDmg', kind: 'pct', r: [6, 15], slots: ANY, w: 4, pre: 'Champion\'s', suf: 'of Kingslaying' },
  { id: 'execute', stat: 'execute', kind: 'pct', r: [8, 20], slots: ['weapon', 'gloves', 'amulet'], w: 3, pre: 'Merciless', suf: 'of Execution' },
  { id: 'burnChance', stat: 'burnChance', kind: 'pct', r: [3, 8], slots: ['weapon', 'gloves', 'ring', 'amulet'], w: 4, pre: 'Scorching', suf: 'of Burning' },
  { id: 'chillChance', stat: 'chillChance', kind: 'pct', r: [3, 8], slots: ['weapon', 'gloves', 'ring', 'amulet'], w: 4, pre: 'Chilling', suf: 'of the Glacier' },
  { id: 'shockChance', stat: 'shockChance', kind: 'pct', r: [3, 8], slots: ['weapon', 'gloves', 'ring', 'amulet'], w: 4, pre: 'Static', suf: 'of Shocking' },
  { id: 'poisonChance', stat: 'poisonChance', kind: 'pct', r: [3, 8], slots: ['weapon', 'gloves', 'ring', 'amulet'], w: 4, pre: 'Septic', suf: 'of Plague' },
  { id: 'bleedChance', stat: 'bleedChance', kind: 'pct', r: [3, 8], slots: ['weapon', 'gloves', 'ring', 'amulet'], w: 4, pre: 'Serrated', suf: 'of Bleeding' },
  { id: 'stunChance', stat: 'stunChance', kind: 'pct', r: [2, 5], slots: ['weapon', 'gloves', 'offhand'], w: 3, pre: 'Concussive', suf: 'of Stunning' },
  { id: 'dotPct', stat: 'dotPct', kind: 'pct', r: [6, 15], slots: ['weapon', 'amulet', 'ring', 'gloves'], w: 4, pre: 'Festering', suf: 'of Affliction' },
  { id: 'moveSpd', stat: 'moveSpd', kind: 'pct', r: [3, 8], slots: ['boots', 'amulet'], w: 8, pre: 'Fleet', suf: 'of the Cheetah' },
  { id: 'mf', stat: 'mf', kind: 'pct', r: [5, 15], slots: ANY, w: 5, pre: 'Treasure-Hunter\'s', suf: 'of Plunder' },
  { id: 'gf', stat: 'gf', kind: 'pct', r: [8, 20], slots: ANY, w: 5, pre: 'Gilded', suf: 'of Greed' },
  { id: 'xp', stat: 'xp', kind: 'pct', r: [3, 8], slots: ['helm', 'amulet', 'ring'], w: 4, pre: 'Scholarly', suf: 'of Learning' },
  { id: 'pickup', stat: 'pickup', kind: 'pct', r: [15, 35], slots: ['boots', 'belt', 'amulet'], w: 3, pre: 'Magnetic', suf: 'of Attraction' },
  { id: 'minionDmg', stat: 'minionDmg', kind: 'pct', r: [8, 18], slots: ['weapon', 'offhand', 'amulet', 'helm'], w: 4, pre: 'Commanding', suf: 'of the Legion' },
  { id: 'minionHp', stat: 'minionHp', kind: 'pct', r: [8, 18], slots: ['offhand', 'amulet', 'chest', 'helm'], w: 3, pre: 'Bonded', suf: 'of the Horde' },
  { id: 'healPct', stat: 'healPct', kind: 'pct', r: [5, 12], slots: ['belt', 'amulet', 'chest'], w: 3, pre: 'Blessed', suf: 'of Mercy' },
  { id: 'potionPct', stat: 'potionPct', kind: 'pct', r: [10, 25], slots: ['belt'], w: 6, pre: 'Alchemist\'s', suf: 'of the Alchemist' },
];
export const affixById = (id) => AFFIXES.find((a) => a.id === id);

// Legendary powers. Static `mods` are added to stats; `hook` powers are handled in combat.js.
export const POWERS = [
  { id: 'stormcaller', name: 'Stormcaller', desc: '20% chance on hit to call down lightning for 150% weapon damage.' },
  { id: 'phoenix', name: 'Phoenix Heart', desc: 'On fatal damage, revive at 50% life. (90s cooldown)' },
  { id: 'vampkiss', name: 'Vampire\'s Kiss', desc: 'Critical hits heal 2% of maximum life.' },
  { id: 'frostbound', name: 'Frostbound', desc: 'Hits chill. Frozen enemies take 40% more damage.' },
  { id: 'inferno', name: 'Inferno Trail', desc: 'You leave burning ground behind you as you move.' },
  { id: 'soulharvest', name: 'Soul Harvest', desc: 'Kills grant +3% damage for 8s, stacking up to 30 times.' },
  { id: 'executioner', name: 'Executioner', desc: 'Deal 100% more damage to enemies below 30% life.' },
  { id: 'glass', name: 'Glass Cannon', desc: '+70% damage, but -30% maximum life.', mods: { dmgPct: 70, hpPct: -30 } },
  { id: 'bulwark', name: 'Bulwark', desc: '+20% block chance. Blocking heals 3% of maximum life.', mods: { block: 20 } },
  { id: 'chainreact', name: 'Chain Reaction', desc: 'Slain enemies explode for 25% of their maximum life.' },
  { id: 'orbitblades', name: 'Orbiting Blades', desc: 'Three spectral blades permanently orbit you.' },
  { id: 'midas', name: 'Midas Touch', desc: '+120% gold find. Hits have a 5% chance to spill gold.', mods: { gf: 120 } },
  { id: 'hoarder', name: 'Hoarder\'s Luck', desc: '+60% magic find.', mods: { mf: 60 } },
  { id: 'timewarp', name: 'Time Warp', desc: '+20% cooldown reduction.', mods: { cdr: 20 } },
  { id: 'splitting', name: 'Splitting Bolts', desc: 'Projectiles split into 3 when they hit an enemy.' },
  { id: 'toxicbloom', name: 'Toxic Bloom', desc: 'Poisoned enemies release a toxic burst when they die.' },
  { id: 'rage', name: 'Berserker\'s Rage', desc: 'Gain 1% damage for every 1% of missing life.' },
  { id: 'manashield', name: 'Mana Shield', desc: '25% of damage taken is drained from mana instead.' },
  { id: 'thornhide', name: 'Thorned Hide', desc: 'Thorns damage is tripled and also applies bleeding.', mods: { thornsPct: 200 } },
  { id: 'overcharge', name: 'Overcharge', desc: 'Skills cost 50% more mana but deal 60% more damage.' },
  { id: 'seeker', name: 'Seeker\'s Eye', desc: 'Your projectiles seek out enemies. +1 pierce.', mods: { pierce: 1 } },
  { id: 'giant', name: 'Giant\'s Grip', desc: '+35% area of effect and +15% damage.', mods: { aoe: 35, dmgPct: 15 } },
  { id: 'windwalker', name: 'Windwalker', desc: '+25% movement speed and +30% evasion.', mods: { moveSpd: 25, evasionPct: 30 } },
  { id: 'bloodpact', name: 'Blood Pact', desc: 'Skills cost life instead of mana and deal 35% more damage.' },
  { id: 'staticfield', name: 'Static Aura', desc: 'Every second, shock up to 3 nearby enemies for 60% weapon damage.' },
  { id: 'secondwind', name: 'Second Wind', desc: 'Dropping below 30% life heals 40% of maximum life. (45s cooldown)' },
  { id: 'prismatic', name: 'Prismatic Core', desc: '+40% to all elemental damage.', mods: { elemPct: 40 } },
  { id: 'echo', name: 'Echoing Strikes', desc: 'Basic attacks have a 35% chance to strike twice.' },
  { id: 'warlord', name: 'Warlord', desc: 'Your minions deal 80% more damage and have 50% more life.', mods: { minionDmg: 80, minionHp: 50 } },
  { id: 'avalanche', name: 'Avalanche', desc: 'Critical hits create a frost explosion around the target.' },
  { id: 'treasure', name: 'Treasure Goblin\'s Bane', desc: 'Elites drop an extra item.' },
  { id: 'colossus', name: 'Colossus', desc: '+40% maximum life and +20% armor.', mods: { hpPct: 40, armorPct: 20 } },
  { id: 'precision', name: 'Assassin\'s Creed', desc: '+12% critical chance and +60% critical damage.', mods: { critChance: 12, critDmg: 60 } },
  { id: 'meteoric', name: 'Meteoric', desc: 'Every 4 seconds, a meteor falls on a nearby enemy.' },
];
export const powerById = (id) => POWERS.find((p) => p.id === id);

export const RARE_NAMES_A = ['Doom', 'Storm', 'Blood', 'Grim', 'Soul', 'Dread', 'Shadow', 'Night', 'Star', 'Bone', 'Rune', 'Ghoul', 'Dragon', 'Wraith', 'Hate', 'Rage', 'Frost', 'Ember', 'Viper', 'Raven', 'Wolf', 'Skull', 'Iron', 'Plague', 'Thunder', 'Void', 'Sun', 'Moon', 'Death', 'Chaos'];
export const RARE_NAMES_B = ['Bane', 'Grasp', 'Whisper', 'Fang', 'Song', 'Ward', 'Bite', 'Mark', 'Hold', 'Crest', 'Veil', 'Spire', 'Brand', 'Shroud', 'Call', 'Gaze', 'Heart', 'Edge', 'Coil', 'Rend', 'Shell', 'Mantle', 'Wish', 'Fury', 'Oath', 'Knell', 'Weaver', 'Breaker', 'Reaver', 'Howl'];

// Attribute requirements by base type: share of the item-level scaling each attribute carries.
// Dual-stat bases make every build spread points beyond its main attribute.
export const REQ_SHARES = {
  sword: { str: 0.6, dex: 0.6 }, axe: { str: 1 }, mace: { str: 0.7, spi: 0.5 }, dagger: { dex: 1 }, staff: { int: 0.6, spi: 0.6 },
  wand: { int: 1 }, bow: { dex: 1 }, crossbow: { dex: 0.7, str: 0.5 }, spear: { str: 0.6, dex: 0.6 }, scythe: { int: 0.6, str: 0.6 },
  hammer: { str: 0.8, vit: 0.4 }, claws: { dex: 0.7, str: 0.4 }, scepter: { spi: 0.7, int: 0.4 },
  shield: { str: 0.6, vit: 0.5 }, orb: { int: 1 }, quiver: { dex: 1 }, tome: { spi: 0.7, int: 0.4 }, totem: { spi: 0.6, str: 0.5 },
  helm: { str: 0.8 }, cap: { dex: 0.8 }, circlet: { int: 0.5, spi: 0.5 },
  plate: { str: 0.7, vit: 0.5 }, jerkin: { dex: 0.7, vit: 0.4 }, robe: { int: 0.5, spi: 0.5 },
  gauntlets: { str: 0.8 }, grips: { dex: 0.8 }, wraps: { int: 0.4, spi: 0.4 },
  greaves: { str: 0.6, vit: 0.4 }, boots: { dex: 0.8 }, slippers: { spi: 0.7 },
  girdle: { str: 0.5, vit: 0.5 }, sash: { spi: 0.6 }, cord: { dex: 0.6 },
  amulet: { vit: 0.4 }, pendant: { lck: 0.45 }, talisman: { lck: 0.6 }, ring: { lck: 0.35 }, band: { vit: 0.35 }, signet: { lck: 0.3, str: 0.2 },
};
