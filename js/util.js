// Shared helpers: randomness, math, number formatting and the global power curve.

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function weighted(list, weightFn = (x) => x.weight) {
  let total = 0;
  for (const it of list) total += Math.max(0, weightFn(it));
  let r = Math.random() * total;
  for (const it of list) {
    r -= Math.max(0, weightFn(it));
    if (r <= 0) return it;
  }
  return list[list.length - 1];
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// The power curve every flat number in the game scales with (monster HP/damage,
// weapon damage, armor, flat life...). Gentle polynomial times mild exponential
// so progression never tops out.
export function power(level) {
  const l = Math.max(1, level);
  return (1 + 0.08 * l) * Math.pow(1.04, l);
}
// Monsters get a little extra HP to keep pace with linear primary-stat growth.
export const monsterHpPower = (l) => power(l) * (1 + 0.035 * l);

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  const neg = n < 0; n = Math.abs(n);
  let s;
  if (n < 1000) s = n < 10 && n % 1 ? n.toFixed(1) : Math.round(n).toString();
  else {
    let i = 0;
    while (n >= 1000 && i < SUFFIXES.length - 1) { n /= 1000; i++; }
    s = (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.round(n).toString()) + SUFFIXES[i];
  }
  return (neg ? '-' : '') + s;
}
export const fmtPct = (n, d = 1) => (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)) + '%';

export function angleTo(ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); }
