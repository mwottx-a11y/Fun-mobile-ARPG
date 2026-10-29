// Visual effects: pooled particles, expanding discs/rings, swing arcs, lightning, telegraphs and floating text.
import * as THREE from 'three';
import { geo, GEO } from './models.js';
import { rand } from './util.js';

const MAX_P = 900;

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class FX {
  constructor(scene, camera, textLayer) {
    this.scene = scene; this.camera = camera; this.layer = textLayer;
    // particles
    this.pPos = new Float32Array(MAX_P * 3); this.pCol = new Float32Array(MAX_P * 3);
    this.pVel = new Float32Array(MAX_P * 3); this.pLife = new Float32Array(MAX_P); this.pMax = new Float32Array(MAX_P);
    this.pGrav = new Float32Array(MAX_P);
    for (let i = 0; i < MAX_P; i++) this.pPos[i * 3 + 1] = -999;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.45, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.pNext = 0;
    this.shapes = []; this.shapePool = [];
    this.lines = []; this.linePool = [];
    this.texts = []; this.textPool = [];
    this.tmpV = new THREE.Vector3(); this.tmpC = new THREE.Color();
  }

  burst(x, y, z, color, count = 12, speed = 4, life = 0.5, grav = 6) {
    const c = this.tmpC.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.pNext; this.pNext = (this.pNext + 1) % MAX_P;
      this.pPos[i * 3] = x; this.pPos[i * 3 + 1] = y; this.pPos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, up = rand(0.2, 1);
      const s = speed * rand(0.4, 1);
      this.pVel[i * 3] = Math.cos(a) * s; this.pVel[i * 3 + 1] = up * s; this.pVel[i * 3 + 2] = Math.sin(a) * s;
      this.pCol[i * 3] = c.r; this.pCol[i * 3 + 1] = c.g; this.pCol[i * 3 + 2] = c.b;
      this.pLife[i] = this.pMax[i] = life * rand(0.6, 1.2);
      this.pGrav[i] = grav;
    }
  }
  // Particles scattered across a disc (ground effects)
  scatter(x, z, radius, color, count = 10, life = 0.6) {
    const c = this.tmpC.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.pNext; this.pNext = (this.pNext + 1) % MAX_P;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
      this.pPos[i * 3] = x + Math.cos(a) * r; this.pPos[i * 3 + 1] = 0.2; this.pPos[i * 3 + 2] = z + Math.sin(a) * r;
      this.pVel[i * 3] = 0; this.pVel[i * 3 + 1] = rand(1, 3); this.pVel[i * 3 + 2] = 0;
      this.pCol[i * 3] = c.r; this.pCol[i * 3 + 1] = c.g; this.pCol[i * 3 + 2] = c.b;
      this.pLife[i] = this.pMax[i] = life * rand(0.5, 1.2); this.pGrav[i] = 0;
    }
  }

  _shape(kind, color, additive = true) {
    let s = this.shapePool.find((p) => p.kind === kind);
    if (s) this.shapePool.splice(this.shapePool.indexOf(s), 1);
    else {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const g = kind === 'ring' ? GEO.ring() : GEO.disc();
      s = { kind, mesh: new THREE.Mesh(g, mat) };
      s.mesh.renderOrder = 2;
    }
    s.mesh.material.color.set(color);
    s.mesh.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    s.mesh.rotation.set(0, 0, 0);
    s.mesh.visible = true;
    this.scene.add(s.mesh);
    this.shapes.push(s);
    return s;
  }

  flash(x, z, radius, color, life = 0.35, opacity = 0.6) {
    const s = this._shape('disc', color);
    Object.assign(s, { x, z, r0: radius * 0.3, r1: radius, life, max: life, op: opacity, mode: 'grow' });
    s.mesh.geometry = GEO.disc();
    s.mesh.position.set(x, 0.07, z);
    return s;
  }
  ring(x, z, radius, color, life = 0.4) {
    const s = this._shape('ring', color);
    Object.assign(s, { x, z, r0: radius * 0.2, r1: radius, life, max: life, op: 0.9, mode: 'grow' });
    s.mesh.position.set(x, 0.09, z);
    return s;
  }
  arc(x, z, angle, range, arcDeg, color, life = 0.18) {
    const s = this._shape('arc', color);
    const deg = Math.min(360, Math.round(arcDeg / 10) * 10);
    s.mesh.geometry = geo('arc' + deg, () => new THREE.RingGeometry(0.3, 1, 24, 1, -THREE.MathUtils.degToRad(deg) / 2, THREE.MathUtils.degToRad(deg)).rotateX(-Math.PI / 2));
    Object.assign(s, { x, z, r0: range * 0.7, r1: range, life, max: life, op: 0.5, mode: 'grow' });
    s.mesh.position.set(x, 0.6, z);
    // geometry's arc is centred on +X; rotate so it faces `angle` (atan2(dx, dz))
    s.mesh.rotation.y = angle - Math.PI / 2;
    return s;
  }
  // Danger zone that fills up until it detonates.
  telegraph(x, z, radius, duration, color = 0xff3020) {
    const outer = this._shape('ring', color, false);
    Object.assign(outer, { x, z, r0: radius, r1: radius, life: duration, max: duration, op: 0.8, mode: 'hold' });
    outer.mesh.position.set(x, 0.08, z);
    const inner = this._shape('disc', color, false);
    inner.mesh.geometry = GEO.disc();
    Object.assign(inner, { x, z, r0: 0.05, r1: radius, life: duration, max: duration, op: 0.3, mode: 'fill' });
    inner.mesh.position.set(x, 0.07, z);
    return [outer, inner];
  }
  // Persistent ground effect visual; caller controls lifetime via kill().
  zone(x, z, radius, color, opacity = 0.28) {
    const s = this._shape('disc', color);
    s.mesh.geometry = GEO.disc();
    Object.assign(s, { x, z, r0: radius, r1: radius, life: 9999, max: 9999, op: opacity, mode: 'hold', pulse: true });
    s.mesh.position.set(x, 0.06, z);
    return s;
  }
  kill(s) { if (s) s.life = Math.min(s.life, 0.15), s.max = s.pulse ? 0.15 : s.max, s.mode = s.pulse ? 'fade' : s.mode; }

  bolt(points, color = 0xfff080, life = 0.2) {
    let l = this.linePool.pop();
    if (!l) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
      l = { line: new THREE.Line(g, new THREE.LineBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })) };
      l.line.frustumCulled = false;
    }
    const arr = l.line.geometry.attributes.position.array;
    let n = 0;
    for (let i = 0; i < points.length - 1 && n < 60; i++) {
      const [ax, ay, az] = points[i], [bx, by, bz] = points[i + 1];
      const segs = 4;
      for (let k = 0; k < segs && n < 60; k++) {
        const t = k / segs, j = k === 0 ? 0 : 0.35;
        arr[n * 3] = ax + (bx - ax) * t + rand(-j, j); arr[n * 3 + 1] = ay + (by - ay) * t + rand(-j, j); arr[n * 3 + 2] = az + (bz - az) * t + rand(-j, j);
        n++;
      }
    }
    const last = points[points.length - 1];
    arr[n * 3] = last[0]; arr[n * 3 + 1] = last[1]; arr[n * 3 + 2] = last[2]; n++;
    l.line.geometry.setDrawRange(0, n);
    l.line.geometry.attributes.position.needsUpdate = true;
    l.line.material.color.set(color);
    l.life = l.max = life;
    this.scene.add(l.line);
    this.lines.push(l);
  }

  text(x, y, z, str, cls = '') {
    if (this.texts.length > 40) { const old = this.texts.shift(); old.el.style.display = 'none'; this.textPool.push(old); }
    let t = this.textPool.pop();
    if (!t) { t = { el: document.createElement('div') }; this.layer.appendChild(t.el); }
    t.el.className = 'dmg ' + cls;
    t.el.textContent = str;
    t.el.style.display = 'block';
    t.x = x + rand(-0.3, 0.3); t.y = y; t.z = z; t.life = t.max = cls.includes('big') ? 1.1 : 0.85;
    this.texts.push(t);
  }

  // Little speech bubble / emoji above a character ("!", one-liners, hearts).
  emote(x, y, z, str, cls = '') {
    this.text(x, y, z, str, 'emote ' + cls);
    const t = this.texts[this.texts.length - 1];
    t.x = x; t.life = t.max = cls.includes('line') ? 1.8 : 1.0; t.emote = true;
  }

  update(dt) {
    // particles
    for (let i = 0; i < MAX_P; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) { this.pPos[i * 3 + 1] = -999; continue; }
      this.pVel[i * 3 + 1] -= this.pGrav[i] * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt; this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt; this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      const f = Math.min(1, this.pLife[i] / this.pMax[i] * 1.5);
      this.pCol[i * 3] *= 0.5 + 0.5 * f; this.pCol[i * 3 + 1] *= 0.5 + 0.5 * f; this.pCol[i * 3 + 2] *= 0.5 + 0.5 * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];
      s.life -= dt;
      if (s.life <= 0) { this.scene.remove(s.mesh); this.shapes.splice(i, 1); this.shapePool.push(s); continue; }
      const t = 1 - s.life / s.max;
      let r = s.r1, op = s.op;
      if (s.mode === 'grow') { r = s.r0 + (s.r1 - s.r0) * Math.min(1, t * 1.6); op = s.op * (1 - t); }
      else if (s.mode === 'fill') r = s.r0 + (s.r1 - s.r0) * t;
      else if (s.mode === 'fade') op = s.op * (s.life / s.max);
      if (s.pulse && s.mode === 'hold') op = s.op * (0.8 + 0.2 * Math.sin(performance.now() / 150));
      s.mesh.scale.set(r, 1, r);
      s.mesh.material.opacity = op;
    }
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.life -= dt;
      if (l.life <= 0) { this.scene.remove(l.line); this.lines.splice(i, 1); this.linePool.push(l); continue; }
      l.line.material.opacity = l.life / l.max;
    }
    const w = innerWidth, h = innerHeight;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { t.el.style.display = 'none'; this.texts.splice(i, 1); this.textPool.push(t); continue; }
      const k = 1 - t.life / t.max;
      this.tmpV.set(t.x, t.y + (t.emote ? Math.min(k * 4, 1) * 0.4 : k * 1.6), t.z).project(this.camera);
      const sx = (this.tmpV.x * 0.5 + 0.5) * w, sy = (-this.tmpV.y * 0.5 + 0.5) * h;
      t.el.style.transform = `translate(${sx | 0}px, ${sy | 0}px) translate(-50%, -50%) scale(${k < 0.15 ? 0.6 + k * 4 : 1})`;
      t.el.style.opacity = Math.min(1, t.life / t.max * 2.5);
    }
  }

  clear() {
    for (const s of this.shapes) { this.scene.remove(s.mesh); this.shapePool.push(s); }
    this.shapes.length = 0;
    for (const l of this.lines) { this.scene.remove(l.line); this.linePool.push(l); }
    this.lines.length = 0;
    for (const t of this.texts) { t.el.style.display = 'none'; this.textPool.push(t); }
    this.texts.length = 0;
    this.pLife.fill(0);
    for (let i = 0; i < MAX_P; i++) this.pPos[i * 3 + 1] = -999;
  }
}
