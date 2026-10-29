// The travelling merchant found on every 5th floor: stock, gambling and prices.
import { generateItem, salvageValue } from './loot.js';
import { classById } from './data/classes.js';
import { rarityIndex, SLOT_WEIGHTS, REQ_SHARES } from './data/items.js';
import { power, randi } from './util.js';

export const SHOP_SIZE = 8;
export const GAMBLE_SLOTS = Object.keys(SLOT_WEIGHTS);
export const isShopFloor = (floor) => floor % 5 === 0;

export const buyPrice = (item) => Math.round(power(item.ilvl) * 60 * Math.pow(1 + rarityIndex(item.rarity) * 1.2, 1.6) * (1 + 0.15 * (item.upg || 0)));
export const sellPrice = (item) => salvageValue(item).gold * 3;
export const gamblePrice = (floor) => Math.round(power(floor) * 260);
export const potionPrice = (floor) => Math.round(power(floor) * 18);
export const refreshPrice = (floor, n) => Math.round(power(floor) * 80 * (n + 1));

// Half the stock leans toward what this hero's class can use: favoured weapons, armor keyed to the main stat.
function suits(cls, it) {
  if (it.slot === 'weapon') return cls.favored.includes(it.type);
  if (it.slot === 'offhand' || it.slot === 'amulet' || it.slot === 'ring') return true;
  return !!(REQ_SHARES[it.type] || {})[cls.main];
}
export function rollStock(hero, floor) {
  const cls = classById(hero.cls);
  const items = [];
  for (let i = 0; i < SHOP_SIZE; i++) {
    const tailored = i < SHOP_SIZE / 2;
    let it;
    for (let t = 0; t < (tailored ? 40 : 1); t++) {
      it = generateItem({ ilvl: floor + randi(0, 2), floor, mf: 80, minRarity: 1 });
      if (!tailored || suits(cls, it)) break;
    }
    items.push(it);
  }
  return items;
}
// Keep a floor's stock across leaving and returning; new stock on a new shop floor.
export function ensureShop(hero, floor) {
  if (!hero.shop || hero.shop.floor !== floor) hero.shop = { floor, items: rollStock(hero, floor), refreshes: 0 };
  return hero.shop;
}
export const gambleItem = (floor, slot) => generateItem({ ilvl: floor + 1, floor, slot, mf: 250, minRarity: 1 });
