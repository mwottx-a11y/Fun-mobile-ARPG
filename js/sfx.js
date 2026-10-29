// Tiny procedural sound effects via WebAudio (no assets). Throttled so swarms don't clip.
let ctx = null, master = null, muted = false;
const last = {};
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  } catch { ctx = null; }
}
export function setMuted(m) { muted = m; }
let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
}
function env(node, t, a, d, peak = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  node.connect(g); g.connect(master); return g;
}
function tone(type, f0, f1, dur, vol = 0.5, delay = 0) {
  const t = ctx.currentTime + delay, o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(o, t, 0.005, dur, vol); o.start(t); o.stop(t + dur + 0.05);
}
function hiss(dur, freq, vol = 0.4, q = 1) {
  const t = ctx.currentTime, n = noise(), f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  n.connect(f); env(f, t, 0.005, dur, vol); n.start(t); n.stop(t + dur + 0.05);
}
const SOUNDS = {
  swing: () => hiss(0.12, 1800, 0.25, 0.8),
  hit: () => { hiss(0.08, 900, 0.35, 1.5); tone('square', 180, 60, 0.08, 0.12); },
  crit: () => { hiss(0.12, 1400, 0.4, 1.2); tone('sawtooth', 400, 90, 0.15, 0.18); },
  cast: () => tone('triangle', 300, 900, 0.18, 0.2),
  boom: () => { hiss(0.4, 300, 0.6, 0.6); tone('sine', 120, 30, 0.4, 0.5); },
  kill: () => tone('square', 220, 80, 0.12, 0.12),
  hurt: () => { tone('sawtooth', 160, 70, 0.15, 0.25); hiss(0.1, 500, 0.2); },
  gold: () => { tone('square', 1300, 1300, 0.05, 0.08); tone('square', 1750, 1750, 0.08, 0.08, 0.05); },
  loot: () => tone('triangle', 600, 900, 0.12, 0.2),
  epic: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.25, 0.22, i * 0.08)); },
  levelup: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.2, 0.12, i * 0.09)); },
  potion: () => { tone('sine', 400, 800, 0.2, 0.3); tone('sine', 600, 1200, 0.2, 0.2, 0.08); },
  stairs: () => tone('sine', 800, 100, 0.8, 0.35),
  shrine: () => { [660, 880, 1100].forEach((f, i) => tone('sine', f, f * 1.01, 0.5, 0.15, i * 0.1)); },
  death: () => tone('sawtooth', 300, 40, 1.2, 0.35),
};
const GAP = { hit: 0.05, crit: 0.06, kill: 0.04, gold: 0.06, swing: 0.06, hurt: 0.12, cast: 0.05, boom: 0.08 };
export function sfx(name) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (last[name] && now - last[name] < (GAP[name] || 0)) return;
  last[name] = now;
  try { SOUNDS[name](); } catch {}
}
