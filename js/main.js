import { UI } from './ui.js';
import { Game } from './game.js';
import { initAudio } from './sfx.js';

addEventListener('pointerdown', initAudio);
addEventListener('keydown', initAudio);

const ui = new UI();
try {
  const game = new Game(document.getElementById('c'), ui);
  ui.attach(game);
  window.__game = game;
  ui.showTitle();
  document.getElementById('loading').remove();
} catch (e) {
  console.error(e);
  document.getElementById('loading').textContent = 'Failed to start: ' + e.message;
}
// prevent pinch-zoom / double-tap zoom on iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
