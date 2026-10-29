// localStorage persistence for multiple heroes.
import { classById } from './data/classes.js';
import { generateItem } from './loot.js';
import { uid } from './util.js';
import { PRIMS } from './stats.js';

const KEY = 'delvers_heroes_v1';

export function loadHeroes() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
export function saveHero(hero) {
  try {
    const all = loadHeroes();
    const i = all.findIndex((h) => h.id === hero.id);
    hero.updated = Date.now();
    if (i >= 0) all[i] = hero; else all.push(hero);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) { console.warn('save failed', e); }
}
export function deleteHero(id) {
  try { localStorage.setItem(KEY, JSON.stringify(loadHeroes().filter((h) => h.id !== id))); } catch {}
}

export function newHero(name, race, cls) {
  const c = classById(cls);
  const alloc = {}; for (const k of PRIMS) alloc[k] = 0;
  const hero = {
    id: uid(), name, race, cls, level: 1, xp: 0, statPoints: 0, skillPoints: 0, alloc,
    skillRanks: [1, 1, 0, 0, 0], gold: 0, essence: 0, inventory: [], equipped: {},
    floor: 1, maxFloor: 1, potions: 4, kills: 0, created: Date.now(), playTime: 0,
    settings: { autoSalvage: 0, autoAttack: matchMedia('(pointer: coarse)').matches, zoom: 1, quality: 'auto', shake: true, vibrate: true, density: 'high', fullscreen: matchMedia('(pointer: coarse)').matches },
    augments: {},
  };
  // starter weapon of a favored type
  let w;
  for (let i = 0; i < 60; i++) { w = generateItem({ ilvl: 1, slot: 'weapon', rarity: 'common' }); if (c.favored[0] === w.type) break; }
  hero.equipped.weapon = w;
  hero.inventory.push(generateItem({ ilvl: 1, slot: 'chest', rarity: 'magic' }));
  return hero;
}
