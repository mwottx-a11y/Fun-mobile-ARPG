// DOM UI: title, character creation, HUD, menus (hero / gear / skills / forge / settings), toasts.
import { RACES, raceById } from './data/races.js';
import { CLASSES, classById, UNLOCK_LEVELS } from './data/classes.js';
import { RARITIES, rarityIndex, EQUIP_SLOTS, SLOT_NAMES, SLOT_ICONS, powerById, affixById } from './data/items.js';
import { computeStats, itemReqs, reqDeficit, baseAttrs, PRIMS, PRIM_NAMES, PRIM_DESC, STAT_LABELS, fmtStatLine, weaponDamage, estimateDps, xpToNext, ELEM_NAMES, armorDR, dodgeChance } from './stats.js';
import { salvageValue, upgradeCost, rerollCost, rerollAffix, temperCost, temperItem, itemScore } from './loot.js';
import { loadHeroes, saveHero, deleteHero, newHero } from './save.js';
import { skillCost, effectiveSkill, augmentSlots, comboCap } from './skills.js';
import { fmt, pick, clamp, power } from './util.js';

// Respecs are meant to be nearly free: about one gold pile at your level.
export const respecCost = (lvl) => Math.round(power(lvl) * 10);
import { INV_SIZE } from './game.js';
import { setMuted, sfx } from './sfx.js';
import { buyPrice, sellPrice, gamblePrice, potionPrice, refreshPrice, ensureShop, rollStock, gambleItem, GAMBLE_SLOTS } from './shop.js';

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') el.className = attrs[k];
    else if (k === 'html') el.innerHTML = attrs[k];
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), attrs[k]);
    else if (k === 'style') el.style.cssText = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};
const rarity = (it) => RARITIES[rarityIndex(it.rarity)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const NAME_A = ['Ar', 'Bel', 'Cor', 'Dra', 'El', 'Fen', 'Gor', 'Hal', 'Ith', 'Kael', 'Lor', 'Mor', 'Nym', 'Or', 'Pyr', 'Quel', 'Ryn', 'Syl', 'Thal', 'Ul', 'Vor', 'Wy', 'Xan', 'Zel'];
const NAME_B = ['adan', 'wen', 'ric', 'thas', 'ion', 'mir', 'gash', 'dor', 'ara', 'veth', 'uin', 'oth', 'ys', 'ak', 'iel', 'gar', 'is', 'en', 'rok', 'mar'];
const randomName = () => pick(NAME_A) + pick(NAME_B);

// Fullscreen API (prefixed on older Safari/iPad). iPhone Safari has none: there, Add to Home Screen is the route.
const docEl = document.documentElement;
export const fsAvailable = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
export async function setFullscreen(on) {
  try {
    if (on && !isFullscreen()) await (docEl.requestFullscreen ? docEl.requestFullscreen({ navigationUI: 'hide' }) : docEl.webkitRequestFullscreen());
    else if (!on && isFullscreen()) await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
    return true;
  } catch { return false; }
}

// Two-tap confirmation (native confirm() is unavailable in embedded viewers and awkward on phones).
function confirmTap(btn, label, fn) {
  if (btn.dataset.armed) { delete btn.dataset.armed; fn(); return; }
  const old = btn.textContent;
  btn.dataset.armed = '1'; btn.textContent = label; btn.classList.add('armed');
  setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = old; btn.classList.remove('armed'); } }, 3000);
}

export class UI {
  constructor() {
    this.dmgLayer = $('#dmg-layer');
    this.game = null;
    this.menuTab = 'gear';
    this.sel = null; // selected item context
    this.hudCache = {};
    this.mapCanvas = document.createElement('canvas');
    $('#menu-close').onclick = () => this.closeMenu();
    $('#btn-menu').onclick = () => this.openMenu(this.menuTab);
    if (fsAvailable()) {
      for (const id of ['#btn-fs', '#btn-fs-title']) $(id).hidden = false;
      const sync = () => { $('#btn-fs').textContent = isFullscreen() ? '🗗' : '⛶'; $('#btn-fs-title').textContent = isFullscreen() ? '🗗 Exit fullscreen' : '⛶ Play fullscreen'; };
      const toggle = async () => { if (!(await setFullscreen(!isFullscreen()))) this.toast('Fullscreen was blocked by the browser', 'warn'); };
      $('#btn-fs').onclick = toggle; $('#btn-fs-title').onclick = toggle;
      document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
    }
    for (const b of document.querySelectorAll('#menu-tabs button')) b.onclick = () => this.openMenu(b.dataset.tab);
    $('#minimap').onclick = () => $('#minimap').classList.toggle('big');
    $('#descend').onclick = () => this.game && this.game.descend();
    $('#trade').onclick = () => this.openMenu('shop');
    $('#sheet-bg').onclick = () => this.closeSheet();
    addEventListener('keydown', (e) => {
      if (!this.game || !this.game.running) return;
      if (e.code === 'KeyI' && e.shiftKey || e.code === 'KeyB') this.toggleMenu('gear');
      if (e.code === 'KeyC') this.toggleMenu('hero');
      if (e.code === 'KeyT') this.toggleMenu('skills');
      if (e.code === 'Escape') { if (!$('#sheet').hidden) this.closeSheet(); else this.toggleMenu(this.menuTab); }
      if ((e.code === 'KeyE' || e.code === 'Enter') && $('#menu').hidden) { if (this.game.nearMerchant) this.openMenu('shop'); else if (this.game.nearStairs) this.game.descend(); }
    });
  }

  attach(game) {
    this.game = game;
    const inp = game.input;
    inp.bindJoystick($('#joyzone'), $('#joybase'), $('#joyknob'));
    inp.bindButton($('#btn-potion'), () => { game.usePotion(); });
  }

  // ---------------- title & creation ----------------
  showTitle() {
    this.hideAll();
    const scr = $('#screen-title');
    scr.hidden = false;
    const list = $('#hero-list');
    list.innerHTML = '';
    const heroes = loadHeroes().sort((a, b) => (b.updated || 0) - (a.updated || 0));
    if (!heroes.length) list.append(h('p', { class: 'muted center' }, 'No heroes yet. Create one to begin your descent.'));
    for (const hero of heroes) {
      const r = raceById(hero.race), c = classById(hero.cls);
      list.append(h('div', { class: 'hero-card' },
        h('div', { class: 'hero-card-icon' }, c.icon),
        h('div', { class: 'hero-card-info' },
          h('b', {}, hero.name), h('span', {}, `Lv ${hero.level} ${r.name} ${c.name}`),
          h('small', { class: 'muted' }, `Floor ${hero.floor} · Deepest ${hero.maxFloor} · ${fmt(hero.kills || 0)} kills`)),
        h('div', { class: 'hero-card-btns' },
          h('button', { class: 'btn primary', onclick: () => this.play(hero) }, 'Play'),
          h('button', { class: 'btn small danger', onclick: (e) => confirmTap(e.currentTarget, 'Delete?', () => { deleteHero(hero.id); this.showTitle(); }) }, '✕'))));
    }
    $('#btn-new').onclick = () => this.showCreate();
  }

  hideAll() { for (const s of document.querySelectorAll('.screen')) s.hidden = true; $('#hud').hidden = true; $('#menu').hidden = true; this.closeSheet(); }

  showCreate() {
    this.hideAll();
    $('#screen-create').hidden = false;
    const st = this.create = { race: pick(RACES).id, cls: pick(CLASSES).id };
    const nameIn = $('#hero-name');
    nameIn.value = randomName();
    $('#btn-rand-name').onclick = () => (nameIn.value = randomName());
    const races = $('#race-grid'), classes = $('#class-grid');
    const render = () => {
      races.innerHTML = ''; classes.innerHTML = '';
      for (const r of RACES) races.append(h('button', { class: 'pick' + (st.race === r.id ? ' on' : ''), onclick: () => { st.race = r.id; render(); } }, h('span', { class: 'pick-icon' }, r.icon), h('span', {}, r.name)));
      for (const c of CLASSES) classes.append(h('button', { class: 'pick' + (st.cls === c.id ? ' on' : ''), onclick: () => { st.cls = c.id; render(); } }, h('span', { class: 'pick-icon' }, c.icon), h('span', {}, c.name)));
      const r = raceById(st.race), c = classById(st.cls);
      const fake = { race: r.id, cls: c.id, level: 1, alloc: {}, equipped: {} };
      const s = computeStats(fake);
      const modLines = (mods) => Object.entries(mods).map(([k, v]) => `<li>${fmtStatLine(k, v)}</li>`).join('');
      $('#create-summary').innerHTML = `
        <div class="sum-head"><span class="big-icon">${r.icon}${c.icon}</span><div><b>${r.name} ${c.name}</b><br><small class="muted">Main stat: ${PRIM_NAMES[c.main]}</small></div></div>
        <p>${esc(r.desc)}</p><p>${esc(c.desc)}</p>
        <div class="cols"><div><h4>Racial traits</h4><ul>${modLines(r.mods)}</ul></div><div><h4>Class passive</h4><ul>${modLines(c.passive)}</ul></div></div>
        <h4>Skills</h4><div class="skill-preview">${c.skills.map((sk, i) => `<span title="${esc(sk.desc)}">${sk.icon} ${sk.name}<small> Lv${UNLOCK_LEVELS[i]}</small></span>`).join('')}</div>
        <h4>Starting attributes</h4><div class="prim-row">${PRIMS.map((k) => `<span><small>${k.toUpperCase()}</small><b>${Math.round(s[k])}</b></span>`).join('')}</div>
        <p class="muted small">Life ${fmt(s.maxHp)} · Mana ${fmt(s.maxMana)} · Crit ${s.critChance.toFixed(1)}% · Speed ${s.moveSpeed.toFixed(1)}</p>`;
    };
    render();
    $('#btn-create').onclick = () => {
      const name = nameIn.value.trim().slice(0, 18) || randomName();
      const hero = newHero(name, st.race, st.cls);
      saveHero(hero);
      this.play(hero);
    };
    $('#btn-create-back').onclick = () => this.showTitle();
  }

  play(hero) {
    if (hero.settings && hero.settings.fullscreen && fsAvailable()) setFullscreen(true);
    this.hideAll();
    $('#hud').hidden = false;
    this.game.startHero(hero);
    document.body.classList.toggle('lefty', !!hero.settings.lefty);
    this.buildSkillButtons();
    if (!hero.tipShown) { hero.tipShown = true; setTimeout(() => this.toast('Tip: drag a skill button to aim it'), 4000); }
    this.markAlerts();
  }

  // ---------------- HUD ----------------
  buildSkillButtons() {
    const g = this.game, cls = g.cls;
    const wrap = $('#actions');
    g.input.held.fill(false);
    wrap.querySelectorAll('.skill').forEach((b) => b.remove());
    cls.skills.forEach((sk, i) => {
      const unlocked = !!g.hero.skillRanks[i];
      const b = h('button', { class: `skill s${i}` + (unlocked ? '' : ' locked'), 'aria-label': sk.name },
        h('span', { class: 'ico' }, sk.icon), h('span', { class: 'cd' }), h('span', { class: 'cdt' }),
        unlocked ? null : h('span', { class: 'lock' }, `Lv${UNLOCK_LEVELS[i]}`));
      wrap.append(b);
      g.input.bindSkill(b, i, i > 0 && !['buff', 'summon'].includes(sk.type));
    });
    this.hudCache = {};
  }

  updateHud(g) {
    const p = g.player, s = g.stats, hero = g.hero, c = this.hudCache;
    const set = (key, val, fn) => { if (c[key] !== val) { c[key] = val; fn(val); } };
    set('hp', Math.round(p.hp / s.maxHp * 1000), (v) => { $('#hp-fill').style.width = v / 10 + '%'; });
    set('hpt', `${fmt(Math.max(0, p.hp))} / ${fmt(s.maxHp)}`, (v) => { $('#hp-text').textContent = v; });
    set('mp', Math.round(p.mana / s.maxMana * 1000), (v) => { $('#mp-fill').style.width = v / 10 + '%'; });
    set('mpt', `${Math.floor(p.mana)} / ${Math.round(s.maxMana)}`, (v) => { $('#mp-text').textContent = v; });
    set('xp', Math.round(hero.xp / xpToNext(hero.level) * 1000), (v) => { $('#xp-fill').style.width = v / 10 + '%'; });
    set('lvl', hero.level, (v) => { $('#lvl').textContent = v; });
    set('gold', fmt(hero.gold), (v) => { $('#gold').textContent = v; });
    set('ess', fmt(hero.essence), (v) => { $('#essence').textContent = v; });
    set('pot', hero.potions, (v) => { $('#pot-count').textContent = v; $('#btn-potion').classList.toggle('empty', v <= 0); });
    set('lowhp', p.hp < s.maxHp * 0.3, (v) => $('#vignette').classList.toggle('low', v));
    set('merchant', !!g.nearMerchant, (v) => { $('#trade').hidden = !v; document.querySelector('#menu-tabs [data-tab=shop]').hidden = !v; });
    set('stairs', !!g.nearStairs, (v) => { $('#descend').hidden = !v; $('#descend').textContent = `⬇ Descend to Floor ${hero.floor + 1}`; });
    // skills
    for (let i = 0; i < 5; i++) {
      const b = document.querySelector(`#actions .s${i}`);
      if (!b) continue;
      const sk = effectiveSkill(g, i);
      const cdMax = (sk.cd || 0) * (1 - s.cdr / 100);
      const frac = i === 0 || !cdMax ? 0 : clamp(p.cds[i] / cdMax, 0, 1);
      set('cd' + i, Math.round(frac * 50), (v) => { b.style.setProperty('--cd', v * 2 + '%'); b.classList.toggle('cooling', v > 0); });
      set('cdt' + i, frac > 0 ? (p.cds[i] < 1 ? p.cds[i].toFixed(1) : Math.ceil(p.cds[i])) : '', (v) => { b.querySelector('.cdt').textContent = v; });
      const cost = skillCost(g, sk);
      set('nm' + i, cost > p.mana && !s.powers.has('bloodpact'), (v) => b.classList.toggle('nomana', v));
    }
    // buffs
    const bkey = p.buffs.map((b) => b.id + Math.ceil(b.t)).join() + (p.souls || 0);
    set('buffs', bkey, () => {
      $('#buffs').innerHTML = p.buffs.map((b) => `<span class="buff" title="${esc(b.name)}">${b.icon || '✦'}<small>${Math.ceil(b.t)}</small></span>`).join('') + (p.souls ? `<span class="buff">👻<small>${p.souls}</small></span>` : '');
    });
    // boss
    if (g.boss && !g.boss.dead && g.boss.aggro) this.bossBar(g.boss); else if (c.boss) this.bossBar(null);
    $('#vignette').classList.toggle('hit', p.hurtFlash > 0);
  }

  bossBar(e) {
    const el = $('#bossbar');
    if (!e) { el.hidden = true; this.hudCache.boss = false; return; }
    this.hudCache.boss = true;
    el.hidden = false;
    $('#boss-name').textContent = e.name + (e.phase === 2 ? ' (Enraged)' : '');
    $('#boss-fill').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
  }

  updateMinimap(g) {
    const d = g.dungeon, cv = $('#minimap'), ctx = cv.getContext('2d');
    const big = cv.classList.contains('big');
    const size = big ? Math.min(innerWidth, innerHeight) * 0.8 : 120;
    if (cv.width !== Math.round(size)) { cv.width = cv.height = Math.round(size); }
    const mc = this.mapCanvas;
    if (mc.width !== d.W) { mc.width = d.W; mc.height = d.H; this.mapImg = mc.getContext('2d').createImageData(d.W, d.H); }
    const img = this.mapImg.data;
    for (let i = 0; i < d.W * d.H; i++) {
      const o = i * 4;
      if (d.explored[i] && d.grid[i]) { img[o] = 120; img[o + 1] = 110; img[o + 2] = 95; img[o + 3] = 220; }
      else if (d.explored[i]) { img[o] = 30; img[o + 1] = 26; img[o + 2] = 24; img[o + 3] = 200; }
      else img[o + 3] = 0;
    }
    mc.getContext('2d').putImageData(this.mapImg, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    const sc = cv.width / Math.max(d.W, d.H);
    ctx.drawImage(mc, 0, 0, d.W * sc, d.H * sc);
    const dot = (x, z, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc((x / 2) * sc, (z / 2) * sc, r, 0, Math.PI * 2); ctx.fill(); };
    for (const e of g.enemies) {
      if (e.dead) continue;
      const tx = Math.floor(e.pos.x / 2), ty = Math.floor(e.pos.z / 2);
      if (!d.explored[ty * d.W + tx]) continue;
      dot(e.pos.x, e.pos.z, e.boss ? '#ff8020' : e.elite === 2 ? '#ffd040' : e.elite ? '#4a8cff' : '#e03030', e.boss ? 4 : e.elite ? 2.5 : 1.6);
    }
    for (const dr of g.drops) if (dr.item && rarityIndex(dr.item.rarity) >= 2) dot(dr.pos.x, dr.pos.z, rarity(dr.item).color, 2);
    for (const pr of g.props) if (!pr.used && pr.kind !== 'pot') { const tx = Math.floor(pr.x / 2), ty = Math.floor(pr.z / 2); if (d.explored[ty * d.W + tx]) dot(pr.x, pr.z, pr.kind === 'chest' ? '#d0a040' : '#c060ff', 2.2); }
    if (g.merchant) dot(g.merchant.x, g.merchant.z, '#ffd040', 3.5);
    const sp = g.world.stairsPos, stx = Math.floor(sp.x / 2), sty = Math.floor(sp.z / 2);
    if (g.world.stairs.visible && d.explored[sty * d.W + stx]) dot(sp.x, sp.z, '#60a0ff', 3.5);
    dot(g.player.pos.x, g.player.pos.z, '#ffffff', 2.8);
  }

  onFloorLoaded(floor, theme, isBoss) {
    $('#floor-label').textContent = `F${floor} · ${theme.displayName}`;
    const b = $('#banner');
    b.innerHTML = `<small>Floor ${floor}</small><b>${esc(theme.displayName)}</b>${isBoss ? `<em>⚠ ${esc(theme.boss)} awaits</em>` : ''}`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    this.bossBar(null);
    $('#descend').hidden = true; this.hudCache.stairs = false;
  }

  toast(msg, kind = '') {
    const wrap = $('#toasts');
    const t = h('div', { class: 'toast ' + kind }, msg);
    wrap.prepend(t);
    while (wrap.children.length > 4) wrap.lastChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3200);
  }
  lootFeed(name, rar, salvaged = false) {
    const wrap = $('#lootfeed');
    const r = RARITIES[rarityIndex(rar)];
    const t = h('div', { class: 'loot' + (salvaged ? ' salv' : ''), style: `color:${r.color}` }, salvaged ? name : '+ ' + name);
    wrap.prepend(t);
    while (wrap.children.length > 5) wrap.lastChild.remove();
    setTimeout(() => t.classList.add('out'), 2500);
    setTimeout(() => t.remove(), 3100);
  }
  hurtVignette() { /* handled via hurtFlash in updateHud */ }
  flashMana() { const el = $('#mp-bar'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  markAlerts() {
    const hero = this.game.hero;
    $('#btn-menu').classList.toggle('alert', hero.statPoints > 0 || hero.skillPoints > 0);
    document.querySelector('#menu-tabs [data-tab=hero]').classList.toggle('alert', hero.statPoints > 0);
    const pendingAug = augmentSlots(this.game).some((a) => a.unlocked && !a.chosen);
    document.querySelector('#menu-tabs [data-tab=skills]').classList.toggle('alert', hero.skillPoints > 0 || pendingAug);
    $('#btn-menu').classList.toggle('alert', hero.statPoints > 0 || hero.skillPoints > 0 || pendingAug);
  }
  comboPop(n) {
    const el = $('#combo');
    el.innerHTML = `<b>×${n}</b><small>COMBO +${(n - 1) * 8}%</small>`;
    el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(this.comboTimer);
    this.comboTimer = setTimeout(() => { el.hidden = true; }, 3000);
  }

  showDeath(lost) {
    const g = this.game, hero = g.hero;
    const cp = Math.max(1, Math.floor((hero.floor - 1) / 5) * 5 + 1);
    const d = $('#screen-death');
    d.hidden = false;
    $('#death-info').textContent = `Slain on floor ${hero.floor}. You dropped ${fmt(lost)} gold.`;
    const btns = $('#death-btns'); btns.innerHTML = '';
    btns.append(h('button', { class: 'btn primary', onclick: () => { d.hidden = true; g.respawn(hero.floor); } }, `Retry Floor ${hero.floor}`));
    if (cp !== hero.floor) btns.append(h('button', { class: 'btn', onclick: () => { d.hidden = true; g.respawn(cp); } }, `Checkpoint: Floor ${cp}`));
    btns.append(h('button', { class: 'btn', onclick: () => { d.hidden = true; this.openMenu('gear'); g.respawn(hero.floor); } }, 'Retry & manage gear'));
  }

  // ---------------- menu ----------------
  toggleMenu(tab) { if ($('#menu').hidden) this.openMenu(tab); else this.closeMenu(); }
  openMenu(tab) {
    const g = this.game;
    if (tab === 'shop' && !g.nearMerchant) tab = 'gear';
    this.menuTab = tab;
    g.paused = true;
    $('#menu').hidden = false;
    for (const b of document.querySelectorAll('#menu-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    this.renderMenu();
  }
  closeMenu() {
    $('#menu').hidden = true; this.closeSheet();
    if (this.game) { this.game.paused = false; this.game.recompute(); this.game.clock.getDelta(); saveHero(this.game.hero); }
    this.markAlerts();
  }
  renderMenu() {
    const body = $('#menu-body');
    body.innerHTML = '';
    ({ hero: () => this.renderHero(body), gear: () => this.renderGear(body), skills: () => this.renderSkills(body), forge: () => this.renderForge(body), shop: () => this.renderShop(body), settings: () => this.renderSettings(body) })[this.menuTab]();
    this.markAlerts();
  }

  renderHero(body) {
    const g = this.game, hero = g.hero, s = computeStats(hero, g.player.buffs);
    const r = raceById(hero.race), c = classById(hero.cls);
    body.append(h('div', { class: 'hero-head' },
      h('span', { class: 'big-icon' }, r.icon + c.icon),
      h('div', {}, h('b', {}, hero.name), h('div', {}, `Level ${hero.level} ${r.name} ${c.name}`),
        h('small', { class: 'muted' }, `XP ${fmt(hero.xp)} / ${fmt(xpToNext(hero.level))} · Deepest floor ${hero.maxFloor} · ${fmt(hero.kills || 0)} kills · ${Math.floor((hero.playTime || 0) / 60)} min`))));
    const pts = h('div', { class: 'section' }, h('p', { class: 'muted small' }, 'Equipment requires attributes. Only your own attributes count (the big number); gear bonuses are shown in green.'), h('h3', {}, `Attributes `, hero.statPoints ? h('span', { class: 'pill' }, `${hero.statPoints} points`) : null));
    for (const k of PRIMS) {
      const add = (n) => { n = Math.min(n, hero.statPoints); if (n <= 0) return; hero.alloc[k] = (hero.alloc[k] || 0) + n; hero.statPoints -= n; g.recompute(); this.renderMenu(); };
      pts.append(h('div', { class: 'prim' + (k === c.main ? ' main' : '') },
        h('div', {}, h('b', {}, PRIM_NAMES[k]), h('small', { class: 'muted' }, PRIM_DESC[k])),
        h('span', { class: 'val' }, Math.round(s.own[k]), s[k] - s.own[k] >= 1 ? h('small', { class: 'gear-bonus' }, ` +${Math.round(s[k] - s.own[k])}`) : null),
        hero.statPoints ? h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => add(1) }, '+1'), h('button', { class: 'btn small', onclick: () => add(5) }, '+5')) : null));
    }
    if (hero.statPoints) pts.append(h('button', { class: 'btn primary wide', onclick: () => {
      // first cover requirements of equipped gear, then split the rest 2:1 main stat / vitality
      for (const it of Object.values(hero.equipped)) {
        const miss = reqDeficit(hero, it), need = Object.values(miss).reduce((a, b) => a + b, 0);
        if (need && need <= hero.statPoints) { for (const k in miss) hero.alloc[k] += miss[k]; hero.statPoints -= need; }
      }
      const n = hero.statPoints, main = Math.ceil(n * 2 / 3);
      hero.alloc[c.main] += main; hero.alloc.vit += n - main; hero.statPoints = 0; g.recompute(); this.renderMenu();
    } }, `Auto-assign (gear requirements, then ${PRIM_NAMES[c.main]} + Vitality)`));
    if (Object.values(hero.alloc).some((v) => v > 0)) pts.append(h('button', { class: 'btn small wide', onclick: (ev) => {
      const cost = respecCost(hero.level);
      if (hero.gold < cost) return this.toast(`Respec costs ${fmt(cost)} gold`, 'warn');
      confirmTap(ev.currentTarget, `Tap again to reset points for ${fmt(cost)} gold`, () => {
      hero.gold -= cost; for (const k of PRIMS) { hero.statPoints += hero.alloc[k]; hero.alloc[k] = 0; } g.recompute(); this.renderMenu();
      });
    } }, `Respec attributes (${fmt(respecCost(hero.level))} gold)`));
    body.append(pts);

    const lvl = hero.floor;
    const grp = (title, rows) => h('div', { class: 'section' }, h('h3', {}, title), h('div', { class: 'stat-grid' }, rows.map(([k, v]) => h('div', { class: 'stat' }, h('span', {}, k), h('b', {}, v)))));
    const pc = (v) => (Math.round(v * 10) / 10) + '%';
    body.append(grp('Offense', [
      ['Est. DPS', fmt(estimateDps(s))], ['Weapon damage', `${fmt(s.wMin)}–${fmt(s.wMax)}`], ['Attacks / sec', s.attacksPerSec.toFixed(2)],
      ['Damage bonus', pc((s.dmgMult - 1) * 100)], ['Critical chance', pc(s.critChance)], ['Critical damage', pc(s.critDmg)],
      ['Skill damage', pc(s.skillDmg)], ['Cooldown reduction', pc(s.cdr)], ['Area of effect', pc(s.aoe)],
      ['Extra projectiles', s.projCount], ['Pierce', s.pierce], ['Damage vs elites', pc(s.eliteDmg)],
      ['Execute bonus', pc(s.execute)], ['Damage over time', pc(s.dotPct)], ['Favored weapon', s.favored ? 'Yes (+15%)' : 'No'],
      ...Object.keys(ELEM_NAMES).map((k) => [ELEM_NAMES[k] + ' dmg', pc(s.elemPct[k])]),
      ...['fire', 'cold', 'light', 'poison'].filter((k) => s.added[k] > 0).map((k) => [`+${ELEM_NAMES[k]} to hits`, fmt(s.added[k])]),
      ...Object.entries(s.status).map(([k, v]) => [`${k[0].toUpperCase() + k.slice(1)} chance`, pc(v)]),
    ]));
    body.append(grp('Defense', [
      ['Life', fmt(s.maxHp)], ['Life / sec', fmt(s.hpRegen)], ['Mana', fmt(s.maxMana)], ['Mana / sec', s.manaRegen.toFixed(1)],
      ['Armor', `${fmt(s.armor)} (${pc(armorDR(s.armor, lvl) * 100)})`], ['Evasion', `${fmt(s.evasion)} (${pc(dodgeChance(s.evasion, lvl) * 100)})`],
      ['Block chance', pc(s.block)], ['Damage reduction', pc(s.dr)], ['Thorns', fmt(s.thorns)],
      ['Fire res', pc(s.res.fire)], ['Cold res', pc(s.res.cold)], ['Lightning res', pc(s.res.light)], ['Poison res', pc(s.res.poison)], ['Shadow res', pc(s.res.shadow)],
      ['Life steal', pc(s.lifeSteal)], ['Life on hit', fmt(s.lifeOnHit)], ['Life on kill', fmt(s.lifeOnKill)], ['Healing received', pc((s.healMult - 1) * 100)],
    ]));
    body.append(grp('Utility', [
      ['Movement speed', s.moveSpeed.toFixed(2)], ['Magic find', pc(s.mf)], ['Gold find', pc(s.gf)], ['Experience', pc((s.xpMult - 1) * 100)],
      ['Pickup radius', s.pickup.toFixed(1)], ['Minion damage', pc(s.minionDmg)], ['Minion life', pc(s.minionHp)], ['Cost reduction', pc((1 - s.costMult) * 100)],
      ['Potion healing', pc((s.potionMult - 1) * 100 + 45)], ['Mana on kill', fmt(s.manaOnKill)],
    ]));
    const powers = [...s.powers].map(powerById);
    if (powers.length) body.append(h('div', { class: 'section' }, h('h3', {}, 'Legendary Powers'), powers.map((p) => h('p', { class: 'power' }, h('b', {}, p.name + ': '), p.desc))));
  }

  renderGear(body) {
    const g = this.game, hero = g.hero;
    const doll = h('div', { class: 'doll' });
    for (const slot of EQUIP_SLOTS) {
      const it = hero.equipped[slot];
      doll.append(this.slotEl(it, SLOT_ICONS[slot], SLOT_NAMES[slot], () => it && this.openItem(it, { equippedSlot: slot })));
    }
    body.append(doll);
    const inactive = computeStats(hero, g.player.buffs).inactive;
    if (inactive.length) body.append(h('p', { class: 'warn-line' }, `⚠ ${inactive.map((s) => SLOT_NAMES[s]).join(', ')} inactive: attribute requirements not met. Spend points in Hero.`));
    const bar = h('div', { class: 'inv-bar' },
      h('span', {}, `Bag ${hero.inventory.length}/${INV_SIZE}`),
      h('span', { class: 'gold' }, `💰 ${fmt(hero.gold)}`), h('span', { class: 'ess' }, `✦ ${fmt(hero.essence)}`));
    body.append(bar);
    const grid = h('div', { class: 'bag' });
    hero.inventory.forEach((it) => grid.append(this.slotEl(it, SLOT_ICONS[it.slot], '', () => this.openItem(it, {}), this.upgradeArrow(it))));
    for (let i = hero.inventory.length; i < INV_SIZE; i++) grid.append(h('div', { class: 'slot empty' }));
    body.append(grid);
    const tools = h('div', { class: 'row wrap' },
      h('button', { class: 'btn small', onclick: () => { hero.inventory.sort((a, b) => rarityIndex(b.rarity) - rarityIndex(a.rarity) || a.slot.localeCompare(b.slot) || b.ilvl - a.ilvl); this.renderMenu(); } }, 'Sort'),
      ...[1, 2, 3].map((r) => h('button', { class: 'btn small', onclick: () => this.bulkSalvage(r) }, `Salvage ≤ ${RARITIES[r - 1].name}`)));
    body.append(tools);
  }

  upgradeArrow(it) {
    const g = this.game, hero = g.hero;
    const slots = it.slot === 'ring' ? ['ring1', 'ring2'] : [it.slot];
    const cur = Math.min(...slots.map((s) => (hero.equipped[s] ? itemScore(hero.equipped[s]) : -1)));
    if (Object.keys(reqDeficit(hero, it)).length) return null;
    return itemScore(it) > cur ? h('span', { class: 'up' }, '▲') : null;
  }

  slotEl(it, icon, label, onclick, extra = null) {
    if (!it) return h('div', { class: 'slot empty', onclick }, h('span', { class: 'ico dim' }, icon), label ? h('small', {}, label) : null);
    const r = rarity(it);
    const bad = Object.keys(reqDeficit(this.game.hero, it)).length > 0;
    return h('div', { class: `slot r-${it.rarity}` + (it.locked ? ' locked' : '') + (bad ? ' unusable' : ''), style: `--rc:${r.color}`, onclick },
      bad ? h('span', { class: 'req-x' }, '!') : null,
      h('span', { class: 'ico' }, SLOT_ICONS[it.slot]), h('small', { class: 'il' }, it.ilvl + (it.upg ? `+${it.upg}` : '')), extra,
      it.locked ? h('span', { class: 'lk' }, '🔒') : null);
  }

  bulkSalvage(maxR) {
    const hero = this.game.hero;
    let ess = 0, gold = 0, n = 0;
    hero.inventory = hero.inventory.filter((it) => {
      if (it.locked || rarityIndex(it.rarity) >= maxR) return true;
      const v = salvageValue(it); ess += v.essence; gold += v.gold; n++; return false;
    });
    hero.essence += ess; hero.gold += gold;
    this.toast(n ? `Salvaged ${n} items: +${fmt(ess)} essence, +${fmt(gold)} gold` : 'Nothing to salvage');
    this.renderMenu();
  }

  itemHtml(it) {
    const r = rarity(it);
    const lines = [];
    lines.push(`<div class="it-name" style="color:${r.color}">${esc(it.name)}${it.upg ? ` +${it.upg}` : ''}</div>`);
    lines.push(`<div class="it-sub">${r.name} ${esc(it.baseName)} · ${SLOT_NAMES[it.slot]} · iLvl ${it.ilvl}</div>`);
    const req = itemReqs(it), miss = reqDeficit(this.game.hero, it);
    if (Object.keys(req).length) lines.push(`<div class="it-req">Requires ${Object.entries(req).map(([k, v]) => `<span class="${miss[k] ? 'bad' : ''}">${v} ${k.toUpperCase()}</span>`).join(' · ')}</div>`);
    if (Object.keys(miss).length) lines.push(`<div class="it-req bad">Not usable: needs ${Object.entries(miss).map(([k, v]) => `${v} more ${PRIM_NAMES[k]}`).join(', ')}. Gear bonuses don't count toward requirements.</div>`);
    if (it.dmg) { const [a, b] = weaponDamage(it); lines.push(`<div class="it-base"><b>${fmt(a)}–${fmt(b)}</b> damage · <b>${it.speed.toFixed(2)}</b> attacks/s</div>`); }
    const um = 1 + 0.07 * (it.upg || 0);
    if (it.armor) lines.push(`<div class="it-base"><b>${fmt(it.armor * um)}</b> armor</div>`);
    if (it.evasion) lines.push(`<div class="it-base"><b>${fmt(it.evasion * um)}</b> evasion</div>`);
    if (it.implicit) for (const k in it.implicit) lines.push(`<div class="it-imp">${fmtStatLine(k, it.implicit[k] * um)}</div>`);
    const m = (it.boost || 1) * um;
    for (const a of it.affixes) {
      const v = a.stat === 'projCount' || a.stat === 'pierce' ? a.value : a.value * m;
      lines.push(`<div class="it-aff"><span>${fmtStatLine(a.stat, v)}</span><small class="q q${a.q >= 90 ? 3 : a.q >= 60 ? 2 : 1}">${a.q}%</small></div>`);
    }
    if (it.power) { const p = powerById(it.power); lines.push(`<div class="it-pow"><b>${esc(p.name)}</b> — ${esc(p.desc)}</div>`); }
    return lines.join('');
  }

  compareHtml(it, slot) {
    const g = this.game, hero = g.hero;
    const before = computeStats(hero, g.player.buffs);
    const eq = { ...hero.equipped, [slot]: it };
    // for gear you can't wear yet, compare as if the missing points were spent
    const miss = reqDeficit(hero, it), alloc = { ...hero.alloc };
    for (const k in miss) alloc[k] = (alloc[k] || 0) + miss[k];
    const after = computeStats({ ...hero, alloc, equipped: eq }, g.player.buffs);
    const rows = [
      ['DPS', estimateDps(before), estimateDps(after), true],
      ['Life', before.maxHp, after.maxHp], ['Mana', before.maxMana, after.maxMana],
      ['Armor', before.armor, after.armor], ['Evasion', before.evasion, after.evasion],
      ['Avg Res', avgRes(before), avgRes(after)], ['Crit', before.critChance, after.critChance],
      ['Move', before.moveSpeed, after.moveSpeed], ['Magic Find', before.mf, after.mf],
    ];
    const out = rows.filter(([, a, b]) => Math.abs(b - a) > 0.05).map(([k, a, b, pct]) => {
      const d = b - a, cls = d > 0 ? 'pos' : 'neg';
      const txt = pct ? `${d > 0 ? '+' : ''}${(d / Math.max(1, a) * 100).toFixed(1)}%` : `${d > 0 ? '+' : ''}${Math.abs(d) < 10 ? d.toFixed(1) : fmt(d)}`;
      return `<span class="${cls}">${k} ${txt}</span>`;
    });
    const lbl = Object.keys(miss).length ? 'If equipped (after spending points):' : 'If equipped:';
    return out.length ? `<div class="compare"><small>${lbl}</small> ${out.join(' ')}</div>` : '<div class="compare"><small>No major stat change</small></div>';
  }

  openItem(it, { equippedSlot, shop }) {
    const g = this.game, hero = g.hero;
    const sheet = $('#sheet-body');
    sheet.innerHTML = '';
    const card = h('div', { class: 'item-card', style: `--rc:${rarity(it).color}`, html: this.itemHtml(it) });
    sheet.append(card);
    if (shop) {
      const slots = it.slot === 'ring' ? ['ring1', 'ring2'] : [it.slot];
      for (const s of slots) sheet.append(h('div', { html: this.compareHtml(it, s) }));
      const price = buyPrice(it);
      sheet.append(h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary' + (hero.gold >= price ? '' : ' disabled'), onclick: () => {
          if (hero.gold < price) return this.toast(`You need ${fmt(price - hero.gold)} more gold`, 'warn');
          if (hero.inventory.length >= INV_SIZE) return this.toast('Bag is full', 'warn');
          hero.gold -= price; hero.inventory.push(it); hero.shop.items.splice(hero.shop.items.indexOf(it), 1);
          sfx('gold'); this.toast(`Bought ${it.name}`, it.rarity); this.closeSheet(); this.renderMenu(); saveHero(hero);
        } }, `Buy for 💰${fmt(price)}`),
        h('button', { class: 'btn', onclick: () => this.closeSheet() }, 'Close')));
      $('#sheet').hidden = false; $('#sheet-bg').hidden = false;
      return;
    }
    if (equippedSlot) {
      sheet.append(h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: () => { if (hero.inventory.length >= INV_SIZE) return this.toast('Bag is full', 'warn'); delete hero.equipped[equippedSlot]; hero.inventory.push(it); g.recompute(); this.closeSheet(); this.renderMenu(); } }, 'Unequip'),
        h('button', { class: 'btn', onclick: () => { this.closeSheet(); this.forgeItem = it; this.openMenu('forge'); } }, '⚒ Forge'),
        h('button', { class: 'btn', onclick: () => this.closeSheet() }, 'Close')));
    } else {
      const slots = it.slot === 'ring' ? ['ring1', 'ring2'] : [it.slot];
      for (const s of slots) {
        const cur = hero.equipped[s];
        if (cur) sheet.append(h('div', { class: 'equipped-cmp' }, h('small', { class: 'muted' }, `Currently equipped (${s === 'ring2' ? 'right ring' : s === 'ring1' ? 'left ring' : SLOT_NAMES[s]}):`), h('div', { class: 'item-card mini', style: `--rc:${rarity(cur).color}`, html: this.itemHtml(cur) })));
        sheet.append(h('div', { html: this.compareHtml(it, s) }));
      }
      const equip = (slot) => {
        const old = hero.equipped[slot];
        hero.inventory.splice(hero.inventory.indexOf(it), 1);
        hero.equipped[slot] = it;
        if (old) hero.inventory.push(old);
        g.recompute(); this.closeSheet(); this.renderMenu();
      };
      const v = salvageValue(it);
      const miss = reqDeficit(hero, it), need = Object.values(miss).reduce((a, b) => a + b, 0);
      const spendAndEquip = (slot) => { for (const k in miss) hero.alloc[k] = (hero.alloc[k] || 0) + miss[k]; hero.statPoints -= need; equip(slot); this.toast(`Spent ${need} attribute points`); };
      const equipBtns = need === 0
        ? slots.map((s) => h('button', { class: 'btn primary', onclick: () => equip(s) }, slots.length > 1 ? (s === 'ring1' ? 'Equip Left' : 'Equip Right') : 'Equip'))
        : hero.statPoints >= need
          ? slots.map((s) => h('button', { class: 'btn primary', onclick: () => spendAndEquip(s) }, `Spend ${need} pts & equip${slots.length > 1 ? (s === 'ring1' ? ' L' : ' R') : ''}`))
          : [h('button', { class: 'btn disabled', onclick: () => this.toast(`Needs ${need} more attribute points than you have`, 'warn') }, `Can't equip (need ${need} pts)`)];
      sheet.append(h('div', { class: 'row wrap' },
        ...equipBtns,
        h('button', { class: 'btn', onclick: () => { it.locked = !it.locked; this.openItem(it, {}); this.renderMenu(); } }, it.locked ? '🔓 Unlock' : '🔒 Lock'),
        h('button', { class: 'btn', onclick: () => { this.closeSheet(); this.forgeItem = it; this.openMenu('forge'); } }, '⚒ Forge'),
        h('button', { class: 'btn danger', onclick: () => {
          if (it.locked) return this.toast('Item is locked', 'warn');
          hero.inventory.splice(hero.inventory.indexOf(it), 1); hero.essence += v.essence; hero.gold += v.gold;
          this.toast(`Salvaged: +${v.essence} essence, +${fmt(v.gold)} gold`); this.closeSheet(); this.renderMenu();
        } }, `Salvage (+${v.essence}✦)`),
        g.nearMerchant ? h('button', { class: 'btn', onclick: () => {
          if (it.locked) return this.toast('Item is locked', 'warn');
          const gold = sellPrice(it);
          hero.inventory.splice(hero.inventory.indexOf(it), 1); hero.gold += gold;
          sfx('gold'); this.toast(`Sold for ${fmt(gold)} gold`); this.closeSheet(); this.renderMenu();
        } }, `Sell (+💰${fmt(sellPrice(it))})`) : null,
        h('button', { class: 'btn', onclick: () => this.closeSheet() }, 'Close')));
    }
    $('#sheet').hidden = false; $('#sheet-bg').hidden = false;
  }
  closeSheet() { $('#sheet').hidden = true; $('#sheet-bg').hidden = true; }

  renderSkills(body) {
    const g = this.game, hero = g.hero, cls = g.cls, s = g.stats;
    body.append(h('div', { class: 'section' }, h('h3', {}, 'Skills ', hero.skillPoints ? h('span', { class: 'pill' }, `${hero.skillPoints} points`) : null),
      h('p', { class: 'muted small' }, 'Each rank adds +15% damage (buffs +10% potency). Ranks are unlimited.')));
    const cap = comboCap(hero.level);
    body.append(h('div', { class: 'section' }, h('h3', {}, '⚡ Combo Chain'),
      h('p', { class: 'small' }, cap ? `Cast a different skill than your last one within 3s to build a chain (max ×${cap}). Each step adds +8% damage and refunds 6% of the cast's mana. Repeating a skill restarts the chain; basic attacks don't break it.` : 'Unlocks at level 11: chain different skills together for bonus damage and mana refunds.'),
      cap ? h('p', { class: 'muted small' }, `Chain cap grows at level 25 (×6) and 50 (×8).`) : null));
    const slots = augmentSlots(g);
    cls.skills.forEach((base, i) => {
      const sk = effectiveSkill(g, i);
      const rank = hero.skillRanks[i] || 0;
      const unlocked = rank > 0;
      const info = [];
      if (sk.mult) info.push(`${Math.round(sk.mult * (1 + 0.15 * Math.max(0, rank - 1)) * 100)}% weapon dmg${sk.hits ? ` ×${sk.hits}` : ''}${sk.count > 1 ? ` ×${sk.count + s.projCount}` : ''}`);
      if (sk.elem) info.push(ELEM_NAMES[sk.elem]);
      if (sk.cost) info.push(`${Math.round(skillCost(g, sk))} mana`);
      if (sk.cd) info.push(`${(sk.cd * (1 - s.cdr / 100)).toFixed(1)}s cd`);
      if (sk.duration) info.push(`${sk.duration}s`);
      body.append(h('div', { class: 'skill-row' + (unlocked ? '' : ' locked') },
        h('span', { class: 'big-icon' }, sk.icon),
        h('div', { class: 'grow' }, h('b', {}, sk.name), unlocked ? h('span', { class: 'pill' }, `Rank ${rank}`) : h('span', { class: 'pill dim' }, `Unlocks at level ${UNLOCK_LEVELS[i]}`),
          h('div', { class: 'small' }, sk.desc), h('div', { class: 'muted small' }, info.join(' · '))),
        unlocked && hero.skillPoints > 0 ? h('button', { class: 'btn small primary', onclick: () => { hero.skillRanks[i]++; hero.skillPoints--; this.renderMenu(); } }, '+1') : null));
      // augment tiers for this skill: tap an option to choose (free to swap any time)
      const mine = slots.filter((a) => a.idx === i);
      const augWrap = h('div', { class: 'aug-wrap' });
      for (const a of mine) {
        const row = h('div', { class: 'aug-tier' + (a.unlocked ? '' : ' locked') }, h('small', { class: 'aug-label' }, `Tier ${a.tier ? 'II' : 'I'} · Lv ${a.level}`));
        for (const o of a.options) row.append(h('button', {
          class: 'aug-opt' + (a.chosen === o.id ? ' on' : '') + (a.unlocked && !a.chosen ? ' pending' : ''),
          onclick: () => {
            if (!a.unlocked) return this.toast(`Unlocks at level ${a.level}`, 'warn');
            hero.augments = hero.augments || {}; hero.augments[`${a.idx}_${a.tier}`] = o.id; g.recompute(); this.renderMenu();
          } }, h('b', {}, o.name), h('small', {}, o.desc)));
        augWrap.append(row);
      }
      body.append(augWrap);
    });
    // skill ranks can be reset too, for the same nominal price
    const spent = hero.skillRanks.reduce((a, r) => a + Math.max(0, (r || 0) - 1), 0);
    if (spent > 0) body.append(h('button', { class: 'btn small wide', onclick: (ev) => {
      const cost = respecCost(hero.level);
      if (hero.gold < cost) return this.toast(`Resetting skills costs ${fmt(cost)} gold`, 'warn');
      confirmTap(ev.currentTarget, `Tap again to refund ${spent} skill points for ${fmt(cost)} gold`, () => {
        hero.gold -= cost;
        hero.skillRanks = hero.skillRanks.map((r) => (r ? 1 : 0));
        hero.skillPoints += spent; g.recompute(); this.renderMenu();
      });
    } }, `Reset skill ranks (${fmt(respecCost(hero.level))} gold)`));
    body.append(h('p', { class: 'muted small' }, i18nControls()));
  }

  renderShop(body) {
    const g = this.game, hero = g.hero, floor = hero.floor;
    if (!g.nearMerchant) { body.append(h('p', { class: 'muted' }, 'Walk up to the merchant to trade.')); return; }
    const shop = ensureShop(hero, floor);
    const pay = (cost) => { if (hero.gold < cost) { this.toast(`You need ${fmt(cost - hero.gold)} more gold`, 'warn'); return false; } hero.gold -= cost; sfx('gold'); return true; };
    body.append(h('div', { class: 'section shop-head' },
      h('h3', {}, '🛒 Travelling Merchant'),
      h('p', { class: 'muted small' }, 'Fresh wares on every 5th floor. Half the stock is picked for your class. Tap an item to inspect it. Selling from your bag (tap an item in Gear) pays 3× salvage gold but gives no essence.'),
      h('div', { class: 'inv-bar' }, h('span', { class: 'gold' }, `💰 ${fmt(hero.gold)}`), h('span', {}, `Bag ${hero.inventory.length}/${INV_SIZE}`))));
    const wares = h('div', { class: 'section' }, h('h4', {}, 'Wares'));
    const grid = h('div', { class: 'shop-grid' });
    shop.items.forEach((it) => {
      const price = buyPrice(it);
      grid.append(h('div', { class: 'shop-item' + (hero.gold >= price ? '' : ' poor') },
        this.slotEl(it, SLOT_ICONS[it.slot], '', () => this.openItem(it, { shop: true }), this.upgradeArrow(it)),
        h('small', { class: 'price' }, `💰${fmt(price)}`)));
    });
    if (!shop.items.length) grid.append(h('p', { class: 'muted small' }, 'Sold out.'));
    wares.append(grid);
    const rc = refreshPrice(floor, shop.refreshes);
    wares.append(h('button', { class: 'btn small wide', onclick: () => { if (!pay(rc)) return; shop.items = rollStock(hero, floor); shop.refreshes++; this.renderMenu(); } }, `↻ New stock — 💰${fmt(rc)}`));
    body.append(wares);

    const gp = gamblePrice(floor);
    const gam = h('div', { class: 'section' }, h('h4', {}, `🎲 Gamble — 💰${fmt(gp)} each`), h('p', { class: 'muted small' }, 'Buy a sealed item for a slot you choose. At least Magic, with much better odds of Rare, Epic and Legendary.'));
    const row = h('div', { class: 'gamble-row' });
    for (const slot of GAMBLE_SLOTS) row.append(h('button', { class: 'btn gamble', onclick: () => {
      if (hero.inventory.length >= INV_SIZE) return this.toast('Bag is full', 'warn');
      if (!pay(gp)) return;
      const it = gambleItem(floor, slot);
      hero.inventory.push(it);
      const ri = rarityIndex(it.rarity);
      if (ri >= 4) sfx('epic');
      this.toast(`🎲 ${RARITIES[ri].name}: ${it.name}`, ri >= 3 ? it.rarity : '');
      this.renderMenu(); saveHero(hero);
    } }, h('span', {}, SLOT_ICONS[slot]), h('small', {}, SLOT_NAMES[slot])));
    gam.append(row);
    body.append(gam);

    const pp = potionPrice(floor), maxP = g.maxPotions();
    body.append(h('div', { class: 'section' }, h('h4', {}, `🧪 Potions (${hero.potions}/${maxP})`),
      h('button', { class: 'btn wide' + (hero.potions >= maxP ? ' disabled' : ''), onclick: () => {
        if (hero.potions >= maxP) return this.toast('Potion belt is full', 'warn');
        if (!pay(pp)) return; hero.potions++; this.renderMenu();
      } }, `Buy a potion — 💰${fmt(pp)}`),
      h('button', { class: 'btn wide' + (hero.potions >= maxP ? ' disabled' : ''), onclick: () => {
        const n = maxP - hero.potions; if (n <= 0) return this.toast('Potion belt is full', 'warn');
        if (!pay(pp * n)) return; hero.potions = maxP; this.renderMenu();
      } }, `Fill the belt — 💰${fmt(pp * Math.max(0, maxP - hero.potions))}`)));
  }

  renderForge(body) {
    const g = this.game, hero = g.hero;
    const it = this.forgeItem && (Object.values(hero.equipped).includes(this.forgeItem) || hero.inventory.includes(this.forgeItem)) ? this.forgeItem : null;
    body.append(h('div', { class: 'section' }, h('h3', {}, '⚒ The Forge'),
      h('p', { class: 'muted small' }, 'Upgrade items without limit, reroll single affixes, or temper all affix rolls. Salvage unwanted gear for essence ✦.'),
      h('div', { class: 'inv-bar' }, h('span', { class: 'gold' }, `💰 ${fmt(hero.gold)}`), h('span', { class: 'ess' }, `✦ ${fmt(hero.essence)}`))));
    const pickWrap = h('div', { class: 'section' }, h('h4', {}, 'Choose an item'));
    const row = h('div', { class: 'doll' });
    for (const slot of EQUIP_SLOTS) { const e = hero.equipped[slot]; row.append(this.slotEl(e, SLOT_ICONS[slot], SLOT_NAMES[slot], () => { if (e) { this.forgeItem = e; this.renderMenu(); } })); }
    pickWrap.append(row, h('small', { class: 'muted' }, 'Tip: tap a bag item in Gear and choose ⚒ Forge.'));
    body.append(pickWrap);
    if (!it) return;
    const card = h('div', { class: 'item-card', style: `--rc:${rarity(it).color}`, html: this.itemHtml(it) });
    body.append(card);
    const afford = (c) => hero.gold >= c.gold && hero.essence >= c.essence;
    const pay = (c) => { hero.gold -= c.gold; hero.essence -= c.essence; };
    const costTxt = (c) => `💰${fmt(c.gold)} ✦${fmt(c.essence)}`;
    const up = upgradeCost(it);
    const actions = h('div', { class: 'section' });
    actions.append(h('button', { class: 'btn primary wide' + (afford(up) ? '' : ' disabled'), onclick: () => {
      if (!afford(up)) return this.toast('Not enough resources', 'warn');
      pay(up); it.upg = (it.upg || 0) + 1; g.recompute(); this.toast(`${it.name} upgraded to +${it.upg}!`, 'epic'); this.renderMenu();
    } }, `Upgrade to +${(it.upg || 0) + 1} (+7% all stats) — ${costTxt(up)}`));
    if (it.affixes.length) {
      const tc = temperCost(it);
      actions.append(h('button', { class: 'btn wide' + (afford(tc) ? '' : ' disabled'), onclick: () => {
        if (!afford(tc)) return this.toast('Not enough resources', 'warn');
        pay(tc); temperItem(it); g.recompute(); this.renderMenu();
      } }, `Temper: reroll all affix values — ${costTxt(tc)}`));
      const rc = rerollCost(it);
      actions.append(h('h4', {}, `Reroll one affix — ${costTxt(rc)}`));
      it.affixes.forEach((a, i) => {
        const m = (it.boost || 1) * (1 + 0.07 * (it.upg || 0));
        actions.append(h('button', { class: 'btn small wide' + (afford(rc) ? '' : ' disabled'), onclick: () => {
          if (!afford(rc)) return this.toast('Not enough resources', 'warn');
          pay(rc); rerollAffix(it, i); g.recompute(); this.renderMenu();
        } }, `↻ ${fmtStatLine(a.stat, a.stat === 'projCount' || a.stat === 'pierce' ? a.value : a.value * m)}`));
      });
    }
    body.append(actions);
  }

  renderSettings(body) {
    const g = this.game, hero = g.hero, st = hero.settings;
    const sec = h('div', { class: 'section' }, h('h3', {}, 'Settings'));
    const sel = (label, key, options, onchange) => {
      const s = h('select', { onchange: (e) => { st[key] = isNaN(+e.target.value) ? e.target.value : +e.target.value; onchange && onchange(); } });
      for (const [v, t] of options) { const o = h('option', { value: v }, t); if (String(st[key]) === String(v)) o.selected = true; s.append(o); }
      return h('label', { class: 'setting' }, h('span', {}, label), s);
    };
    const tog = (label, key, onchange) => h('label', { class: 'setting' }, h('span', {}, label), h('input', { type: 'checkbox', ...(st[key] ? { checked: '' } : {}), onchange: (e) => { st[key] = e.target.checked; onchange && onchange(); } }));
    sec.append(
      sel('Auto-salvage on pickup', 'autoSalvage', [[0, 'Off'], [1, 'Common'], [2, 'Common + Magic'], [3, 'Up to Rare'], [4, 'Up to Epic']]),
      tog('Auto-attack nearby enemies when not moving', 'autoAttack'),
      tog('Left-handed controls', 'lefty', () => document.body.classList.toggle('lefty', !!st.lefty)),
      tog('Vibration', 'vibrate'),
      fsAvailable() ? tog('Go fullscreen when I press Play', 'fullscreen') : h('p', { class: 'muted small' }, 'Fullscreen isn\'t available in this browser. On iPhone, open the game\'s web address in Safari and use Share → Add to Home Screen.'),
      sel('Camera zoom', 'zoom', [[0.75, 'Close'], [1, 'Normal'], [1.25, 'Far'], [1.5, 'Very far']], () => (g.zoom = st.zoom)),
      sel('Render quality', 'quality', [['auto', 'Auto (adapts to device)'], [0.75, 'Low (fast)'], [1, 'Medium'], [1.5, 'High'], [2, 'Ultra']], () => g.applySettings()),
      sel('Monster density', 'density', [['normal', 'Normal'], ['high', 'High (default)'], ['swarm', 'Swarm']]),
      tog('Screen shake', 'shake'),
      tog('Sound effects', 'sound', () => setMuted(!st.sound)));
    body.append(sec);

    const wp = h('div', { class: 'section' }, h('h3', {}, '🌀 Waypoints'), h('p', { class: 'muted small' }, 'Every 5th floor is guarded by a boss. Waypoints unlock at the floor after each boss.'));
    const row = h('div', { class: 'row wrap' });
    for (let f = 1; f <= hero.maxFloor; f += 5) row.append(h('button', { class: 'btn small' + (f === hero.floor ? ' primary' : ''), onclick: () => { if (g.player.dead) return this.toast('You are dead', 'warn'); this.closeMenu(); g.loadFloor(f); } }, `Floor ${f}`));
    wp.append(row);
    body.append(wp);
    body.append(h('div', { class: 'section' },
      h('button', { class: 'btn wide', onclick: () => { saveHero(hero); g.running = false; this.closeMenu(); this.showTitle(); } }, 'Save & return to title'),
      h('p', { class: 'muted small' }, 'Touch: drag the left side to move · tap Attack to strike the nearest enemy (hold to keep attacking) · tap a skill to auto-aim, or drag it to aim by hand.'),
      h('p', { class: 'muted small' }, i18nControls())));
  }
}

function avgRes(s) { return (s.res.fire + s.res.cold + s.res.light + s.res.poison + s.res.shadow) / 5; }
function i18nControls() { return 'Keyboard: WASD move · Space attack · 1–4 skills · F potion · B gear · C hero · T skills · E descend · Esc close'; }
