# Endless Delve

A mobile-friendly three.js dungeon-crawler ARPG with an infinite, procedurally generated dungeon and endless loot-driven progression. No build step — it's plain ES modules with three.js vendored in `vendor/`.

## Play

Serve the folder with any static server and open it in a browser:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

It also works on GitHub Pages as-is. On phones, "Add to Home Screen" for fullscreen.

**Touch:** drag anywhere on the left side to move (floating joystick). Hold the big button to attack (auto-aims; melee classes walk to the nearest target). Hold skill buttons to cast. 🧪 drinks a potion. Walk over loot to pick it up. ☰ opens the menu (the game pauses).

**Keyboard:** WASD move · Space attack · 1–4 skills · F potion · B gear · C hero · T skills · E descend · Esc close.

## What's in it

- **16 races × 12 classes = 192 combinations.** Races carry attribute and secondary-stat traits (Gnome cooldowns, Dhampir life steal, Halfling magic find...). Each class has a main stat, a passive and 5 skills unlocking at levels 1/1/3/6/10 — melee arcs, projectiles, novas, ground AoEs, dashes, buffs, chain lightning, orbiting hammers and summons.
- **~60 secondary stats:** crit chance/damage, attack speed, cooldown reduction, area, extra projectiles, pierce, life steal / on hit / on kill, thorns, block, evasion, armor, 5 resistances, damage reduction, per-element damage, flat added elemental damage, six status-proc chances (burn, chill→freeze, shock, poison, bleed, stun), DoT damage, execute, elite damage, magic/gold find, XP, pickup radius, minion stats, potion and healing bonuses.
- **Loot:** 10 equipment slots, 13 weapon types and 30+ armor/jewelry bases, 70 affixes, 6 rarities (Common → Mythic), 34 legendary powers (Stormcaller, Phoenix Heart, Chain Reaction, Orbiting Blades, Meteoric...). Material names, values and affix tiers scale with item level forever.
- **Endless progression:** levels and skill ranks are uncapped, every flat number follows a single power curve, and the Forge lets you upgrade items without limit (+7% per level), reroll an affix or temper all affix values using gold and salvaged essence.
- **The dungeon:** 8 themes (Crypt, Goblin Warrens, Spider Nest, Frozen Depths, Infernal Forge, Storm Spire, Plague Bog, Abyss) that cycle with "Ascended/Mythic/Eternal" tiers. 8 monster archetypes, champion and rare elite packs with 12 modifiers, a boss every 5 floors with a randomized ability set and an enrage phase. Chests, pots, shrines, waypoints every 5 floors, minimap (tap to enlarge).
- **Saves** to localStorage, multiple heroes, auto-save, auto-salvage and auto-attack options, quality/zoom settings, procedural sound effects.

## Code map

| File | Purpose |
| --- | --- |
| `js/data/*.js` | Races, classes & skills, items/affixes/powers, monsters & themes |
| `js/stats.js` | Stat aggregation and derived formulas |
| `js/loot.js` | Item generation, salvage and forge costs |
| `js/dungeon.js` / `js/world.js` | Layout generation / instanced three.js rendering |
| `js/game.js` | Main loop, player, minions, projectiles, hazards, loot, floors |
| `js/skills.js` / `js/combat.js` / `js/ai.js` | Skill engine / damage pipeline & powers / monster AI |
| `js/ui.js`, `js/input.js`, `js/fx.js`, `js/sfx.js` | UI, touch & keyboard, effects, audio |
