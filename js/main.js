import { UI } from './ui.js';
import { Game } from './game.js';
import { initAudio } from './sfx.js';
import { saveHero } from './save.js';

addEventListener('pointerdown', initAudio);
addEventListener('keydown', initAudio);

const ui = new UI();
try {
  const game = new Game(document.getElementById('c'), ui);
  ui.attach(game);
  window.__game = game;
  const flush = () => { if (game.running && game.hero) saveHero(game.hero); };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flush(); if (game.running && document.getElementById('menu').hidden && !game.player.dead) ui.openMenu(ui.menuTab); }
    else if (game.running) game.keepAwake();
  });
  addEventListener('pagehide', flush);
  ui.showTitle();
  document.getElementById('loading').remove();
} catch (e) {
  console.error(e);
  document.getElementById('loading').textContent = 'Failed to start: ' + e.message;
}
// prevent pinch-zoom / double-tap zoom on iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
