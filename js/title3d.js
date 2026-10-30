// Title screen: a living Renaissance grottesca. A gilded candelabrum rises through the middle;
// mirrored chimeras (one monster's body, another's head) perch on acanthus scrolls around it,
// a grimacing mascaron watches from the base, and putti hold up a fruit garland.
import * as THREE from 'three';
import { part, GEO as G, lambert, basic, mergeGroup } from './models.js';
import { buildChimera, buildMask } from './characters.js';

const GOLD = new THREE.MeshPhongMaterial({ color: 0xc8922e, specular: 0xffe6a0, shininess: 70, emissive: 0x2a1404 });
const GILT_V = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x806030, shininess: 40 });

// Lathe-turned vase / urn profile for the candelabrum.
function lathe(points, segs = 18) { return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segs); }

function candelabrum() {
  const g = new THREE.Group();
  const add = (geo, y) => { const m = new THREE.Mesh(geo, GOLD); m.position.y = y; g.add(m); return m; };
  add(lathe([[0, 0], [1.0, 0], [1.05, 0.12], [0.7, 0.25], [0.45, 0.4], [0.5, 0.55], [0.3, 0.7], [0, 0.72]]), -3.6); // foot
  add(lathe([[0, 0], [0.22, 0], [0.18, 0.6], [0.3, 0.75], [0.18, 0.9], [0.16, 1.5], [0, 1.5]]), -2.9);            // stem
  add(lathe([[0, 0], [0.25, 0], [0.65, 0.3], [0.75, 0.65], [0.55, 0.95], [0.35, 1.05], [0.45, 1.15], [0, 1.15]]), -1.45); // urn
  add(lathe([[0, 0], [0.16, 0], [0.14, 0.9], [0.28, 1.0], [0.14, 1.1], [0.13, 1.7], [0, 1.7]]), -0.3);             // upper stem
  add(lathe([[0, 0], [0.12, 0], [0.5, 0.25], [0.9, 0.42], [0.95, 0.5], [0.4, 0.45], [0, 0.4]]), 1.35);           // dish
  add(lathe([[0, 0], [0.3, 0], [0.42, 0.25], [0.3, 0.4], [0, 0.42]]), 1.8);                                          // knot
  // a pair of handles curling off the urn
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 6, 16, Math.PI * 1.3), GOLD);
    h.position.set(s * 0.78, -0.6, 0); h.rotation.z = s > 0 ? -0.6 : Math.PI + 0.6; g.add(h);
  }
  // flame
  const flame = new THREE.Group();
  flame.add(part(G.cone(), basic(0xff6a10), 0.38, 1.1, 0.38, 0, 0.55, 0), part(G.cone(), basic(0xffb030), 0.24, 0.8, 0.24, 0, 0.45, 0), part(G.cone(), basic(0xfff0a0), 0.12, 0.5, 0.12, 0, 0.35, 0));
  flame.add(part(G.sphere(), basic(0xff8020, 0.25, true), 0.9, 1.1, 0.9, 0, 0.5, 0));
  flame.position.y = 2.2; g.add(flame);
  return { group: g, flame };
}

// Acanthus scroll: a spiral stalk dressed with curling leaves, merged into one mesh.
function acanthus(turns = 1.4, size = 1, flip = 1, color = 0x5a8a3a) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = t * turns * Math.PI * 2, r = size * (1 - t * 0.78);
    pts.push(new THREE.Vector3(flip * (Math.cos(a) * r - size), Math.sin(a) * r + t * 0.4 * size, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.07 * size, 6), lambert(0xb08a3a));
  g.add(tube);
  for (let i = 1; i < 14; i++) {
    const t = i / 14, p = curve.getPoint(t), tan = curve.getTangent(t);
    const leaf = part(G.sphere(), lambert(i % 3 ? color : 0x7aa84a), 0.11 * size, 0.32 * size * (1 - t * 0.5), 0.05 * size, p.x, p.y, p.z);
    leaf.rotation.z = Math.atan2(tan.y, tan.x) + (i % 2 ? 0.9 : -0.9);
    g.add(leaf);
  }
  const geos = mergeGroup(g);
  return new THREE.Mesh(geos.lit, GILT_V);
}

// Flappable wings (kept separate from the merged body so they can move).
function wings(kind, color) {
  const shape = new THREE.Shape();
  if (kind === 'bat') { shape.moveTo(0, 0); shape.lineTo(0.9, 0.5); shape.quadraticCurveTo(0.75, 0.2, 0.9, 0.05); shape.quadraticCurveTo(0.6, -0.05, 0.6, -0.25); shape.quadraticCurveTo(0.35, -0.1, 0.25, -0.35); shape.lineTo(0, 0); }
  else { shape.moveTo(0, 0); shape.bezierCurveTo(0.2, 0.7, 0.9, 0.7, 0.75, 0.15); shape.bezierCurveTo(0.95, -0.15, 0.4, -0.5, 0, 0); }
  const geo = new THREE.ShapeGeometry(shape, 8);
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, emissive: kind === 'bat' ? 0x000000 : color, emissiveIntensity: kind === 'bat' ? 0 : 0.25 });
  const pair = [-1, 1].map((s) => { const piv = new THREE.Group(); const m = new THREE.Mesh(geo, mat); m.scale.set(s, 1, 1); piv.add(m); return piv; });
  return pair;
}


// ---- the wordmark: Macondo lettering painted onto canvases once the font is ready ----
const FONT = '"Macondo Swash Caps", Georgia, serif';
function gildedWord(text, w, h, px) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.font = `${px}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  const gr = x.createLinearGradient(0, h * 0.15, 0, h * 0.85);
  gr.addColorStop(0, '#fff6d0'); gr.addColorStop(0.45, '#f2b540'); gr.addColorStop(0.75, '#c2701a'); gr.addColorStop(1, '#7a3a08');
  x.lineJoin = 'round';
  x.shadowColor = 'rgba(255,140,30,0.7)'; x.shadowBlur = px * 0.16; x.fillStyle = gr; x.fillText(text, w / 2, h * 0.54);
  x.shadowBlur = 0; x.lineWidth = px * 0.05; x.strokeStyle = '#3a1004'; x.strokeText(text, w / 2, h * 0.54);
  x.fillText(text, w / 2, h * 0.54);
  // a glint of gilding along the upper edges
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,255,230,0.35)'; x.fillRect(0, h * 0.18, w, h * 0.08);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function ribbonTexture(text, w, h, px) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const notch = h * 0.5, band = h * 0.72, top = (h - band) / 2;
  // swallowtail ribbon body
  x.beginPath(); x.moveTo(0, top); x.lineTo(w, top); x.lineTo(w - notch, h / 2); x.lineTo(w, top + band); x.lineTo(0, top + band); x.lineTo(notch, h / 2); x.closePath();
  const gr = x.createLinearGradient(0, top, 0, top + band); gr.addColorStop(0, '#fbf0d4'); gr.addColorStop(0.5, '#ecd8a8'); gr.addColorStop(1, '#c8a870');
  x.fillStyle = gr; x.fill();
  x.lineWidth = 6; x.strokeStyle = '#8a1a14'; x.stroke();
  x.lineWidth = 2; x.strokeStyle = '#c8922e'; x.beginPath(); x.moveTo(notch * 1.4, top + 12); x.lineTo(w - notch * 1.4, top + 12); x.moveTo(notch * 1.4, top + band - 12); x.lineTo(w - notch * 1.4, top + band - 12); x.stroke();
  x.font = `${px}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = px * 0.04; x.strokeStyle = '#f4d070'; x.strokeText(text, w / 2, h * 0.53);
  x.fillStyle = '#6a1410'; x.fillText(text, w / 2, h * 0.53);
  for (const fx of [notch * 1.15, w - notch * 1.15]) { x.font = `${h * 0.3}px serif`; x.fillStyle = '#8a1a14'; x.fillText('❦', fx + (fx < w / 2 ? 30 : -30), h * 0.52); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// A banner that bows toward the viewer and curls up at the tails.
function ribbonGeometry(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 48, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getX(i) / (w / 2), a = Math.abs(t);
    p.setY(i, p.getY(i) - 0.28 * t * t + (a > 0.78 ? (a - 0.78) * 1.6 : 0));
    p.setZ(i, 0.55 * (1 - t * t) - (a > 0.78 ? (a - 0.78) * 1.2 : 0));
  }
  g.computeVertexNormals();
  return g;
}
// Swag of leaves and fruit hanging between two points.
function swag(x0, y0, x1, y1, sag, z = 0.1) {
  const g = new THREE.Group();
  const fruit = [0xd03020, 0xf0a020, 0x8a2a8a, 0xe8d040];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * sag;
    g.add(part(G.sphere(), lambert(i % 2 ? 0x4a7a2a : 0x6a9a3a), 0.17, 0.11, 0.11, x, y, z));
    if (i % 3 === 1) g.add(part(G.sphere(), lambert(fruit[i % 4]), 0.11, 0.11, 0.11, x, y - 0.1, z + 0.08));
  }
  return new THREE.Mesh(mergeGroup(g).lit, GILT_V);
}

const PIPES = [
  'Hic sunt monstra!', 'I am mostly leaf.', 'Behold, a goodly chimera!', 'Prithee, delve deeper!', 'Huzzah!', 'Mine other half is a spider.',
  'Wherefore my legs?', 'Tickle not the candelabrum.', 'Forsooth!', 'Anon, adventurer!', 'I was painted by Raphael. Probably.', 'Fie upon thee!',
];

export class TitleScene {
  constructor(el) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1c0b10);
    this.scene.fog = new THREE.Fog(0x1c0b10, 16, 30);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 60);
    this.layer = el;
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xffe0c0, 0x2a0a10, 1.1));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.3); key.position.set(-4, 6, 8); s.add(key);
    this.flameLight = new THREE.PointLight(0xffa040, 25, 12, 1.4); this.flameLight.position.set(0, 3.3, 1.5); s.add(this.flameLight);
    const rim = new THREE.PointLight(0x6080ff, 12, 14, 1.5); rim.position.set(0, -2, -3); s.add(rim);

    const root = this.root = new THREE.Group(); s.add(root);
    // a dim painted ground behind the ornament
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x3a1218 }));
    panel.position.set(0, 0, -1.2); root.add(panel);

    const c = candelabrum(); c.group.position.y = 0.6; root.add(c.group); this.flame = c.flame;
    this.creatures = [];
    const put = (obj, x, y, z, ry = 0, sc = 1, extra = {}) => { obj.position.set(x, y, z); obj.rotation.y = ry; obj.scale.setScalar(sc); root.add(obj); this.creatures.push({ obj, base: { x, y, z, ry, sc }, phase: Math.random() * 6, hop: 0, ...extra }); return obj; };

    // ---- the wordmark, woven through the ornament ----
    // "Endless" on a banner held by the putti; "Delve" as free-standing gilt letters the beasts climb on
    this.ribbonMat = new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, color: 0xffffff });
    this.delveMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.02, depthWrite: false, color: 0xffffff });
    this.ribbon = new THREE.Mesh(ribbonGeometry(6.6, 1.3), this.ribbonMat); this.ribbon.position.set(0, 1.45, 0.85); root.add(this.ribbon);
    this.delve = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 2.56), this.delveMat); this.delve.position.set(0, -0.55, 1.0); this.delve.renderOrder = 3; root.add(this.delve);
    this.ribbon.visible = this.delve.visible = false;
    const paint = () => {
      this.ribbonMat.map = ribbonTexture('Endless', 1400, 280, 170); this.ribbonMat.needsUpdate = true;
      this.delveMat.map = gildedWord('Delve', 1280, 400, 330); this.delveMat.needsUpdate = true;
      this.ribbon.visible = this.delve.visible = true;
    };
    // draw once the swash font has arrived (fall back after a few seconds rather than show nothing)
    Promise.race([document.fonts.load(`170px ${FONT}`), new Promise((r) => setTimeout(r, 4000))]).then(paint, paint);
    this.letters = [{ obj: this.delve, base: { y: -0.55 }, wob: 0 }, { obj: this.ribbon, base: { y: 1.45 }, wob: 0 }];

    // mascaron hanging beneath the letters like a keystone: one eye, goblin ears, a beard of leaves
    const mask = buildMask('abyss', 0.9);
    put(mask, 0, -2.4, 0.9, 0, 0.72, { mask: true });
    for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; const leaf = part(G.sphere(), lambert(i % 2 ? 0x5a8a3a : 0x7aa84a), 0.14, 0.42, 0.06, Math.sin(a) * 0.7, -0.75 - Math.cos(a) * 0.2, 0.55); leaf.rotation.z = a; mask.add(leaf); }
    for (const sx of [-1, 1]) { const ear = part(G.cone(), lambert(0x86b84a), 0.22, 0.8, 0.1, sx * 0.95, 0.2, 0); ear.rotation.z = -sx * 1.25; mask.add(ear); }

    for (const sx of [-1, 1]) {
      const flip = -sx; // creatures face the centre
      // acanthus sprouting from the column: behind the letters, under the banner, and curling round the letter ends in front
      for (const [y, size] of [[-2.2, 1.15], [-0.5, 1.35], [0.9, 0.85]]) { const a = acanthus(1.35, size, sx); a.position.set(sx * 0.2, y, 0); root.add(a); }
      const front = acanthus(1.2, 0.7, -sx); front.position.set(sx * 3.75, -1.55, 1.2); root.add(front);
      // goblin-headed spiders perched on top of the D and the e
      // (the D's top is taller than the e's, so each spider sits at its own letter's height)
      put(buildChimera('spider', 'nest', 'caves', 'angry'), sx < 0 ? -2.62 : 2.78, sx < 0 ? 0.62 : 0.12, 1.0, flip * 0.7, 0.85);
      // snowman-headed bat-hounds peeking over the letters from behind
      const hound = put(buildChimera('hound', 'caves', 'frozen'), sx * 1.55, 0.35, 0.3, flip * 0.9, 1.05);
      this.addWings(hound, 'bat', 0x5a2a3a, 0.55, 0.62, -0.05, 0.7);
      // one-eyed putti with butterfly wings holding up the banner's tails
      const putto = put(buildChimera('biped', 'crypt', 'abyss'), sx * 3.75, 1.35, 0.7, flip * 0.6, 0.85);
      this.addWings(putto, 'butterfly', 0x80c0ff, 0.72, -0.25, 0, 0.9);
      // worried bomber balloons sprouting from stalks at the top corners
      put(buildChimera('bomber', 'hell', 'storm'), sx * 3.85, 3.15, 0, flip * 0.4, 0.75);
      const stalk = acanthus(0.9, 0.7, -sx, 0x4a7a2a); stalk.position.set(sx * 4.25, 2.15, -0.2); stalk.rotation.z = sx * 0.6; root.add(stalk);
      // fruit garlands hanging from the letter ends to the mascaron
      root.add(swag(sx * 3.35, -1.55, sx * 0.75, -2.05, 0.35, 1.05));
      // gremlins sitting on the candelabrum's foot
      put(buildChimera('swarmer', 'swamp', 'hell'), sx * 1.35, -2.95, 0.7, flip * 0.6, 1.2);
    }
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(0, 0);
    this.t = 0;
  }

  addWings(creature, kind, color, y, z, x, size) {
    const [l, r] = wings(kind, color);
    for (const [w, s] of [[l, -1], [r, 1]]) { w.position.set(s * 0.18 + x, y, z); w.scale.setScalar(size); creature.add(w); }
    const c = this.creatures[this.creatures.length - 1];
    c.wings = [l, r]; c.wingKind = kind;
  }

  // The logo owns a band across the top of the screen (LOGO_BAND of the height);
  // the tagline and hero list live entirely below it.
  resize(w, h) {
    const cam = this.camera, aspect = w / h, band = aspect > 1.15 ? 0.62 : 0.56;
    cam.aspect = aspect;
    // fit the ~9.8 x 7.6 logo inside the band, by width or height, whichever is tighter
    // fit inside the picture frame's opening (frame width mirrors --fw in the CSS)
    const fw = Math.min(34, Math.max(20, 0.06 * Math.min(w, h)));
    const visH = Math.max(7.6 / band, 9.8 / (aspect * (1 - (2 * fw + 8) / w)));
    // when width is the limit the logo is shorter than the band: shrink the band to hug it
    const used = Math.min(band, 7.6 / visH + 0.05);
    const top = 0.075; // headroom below the frame's top cartouche
    const dist = visH / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    const centreY = 0.45, lookY = centreY - (0.5 - top - used / 2) * visH;
    cam.position.set(0, lookY - 0.4, dist);
    cam.lookAt(0, lookY, 0);
    cam.clearViewOffset();
    cam.updateProjectionMatrix();
    this.scene.fog.near = dist - 3; this.scene.fog.far = dist + 12;
    document.documentElement.style.setProperty('--logo-band', (used + top) * 100 + 'vh');
  }

  setPointer(nx, ny) { this.pointer.set(nx, ny); }

  // Tap a beast and it hops and pipes up. Returns true if one was hit.
  tap(nx, ny) {
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hits = this.raycaster.intersectObjects([...this.creatures.map((c) => c.obj), this.delve, this.ribbon], true);
    if (!hits.length) return false;
    const letter = this.letters.find((l) => l.obj === hits[0].object);
    if (letter) { letter.wob = 1; return true; }
    let o = hits[0].object;
    const c = this.creatures.find((cc) => { let p = o; while (p) { if (p === cc.obj) return true; p = p.parent; } return false; });
    if (!c) return false;
    c.hop = 0.6;
    this.say(c, PIPES[Math.floor(Math.random() * PIPES.length)]);
    return true;
  }

  say(c, text) {
    const el = document.createElement('div');
    el.className = 'title-pipe'; el.textContent = text;
    this.layer.appendChild(el);
    const v = new THREE.Vector3(c.obj.position.x, c.obj.position.y + 1.4 * c.base.sc, c.obj.position.z).project(this.camera);
    el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px'; el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
    setTimeout(() => el.classList.add('out'), 1600);
    setTimeout(() => el.remove(), 2100);
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    this.flame.scale.set(1 + Math.sin(t * 13) * 0.06, 1 + Math.sin(t * 9) * 0.1, 1);
    this.flameLight.intensity = 25 * (0.9 + Math.sin(t * 11) * 0.08);
    this.root.rotation.y = Math.sin(t * 0.25) * 0.08 + this.pointer.x * 0.06;
    this.root.rotation.x = -this.pointer.y * 0.03;
    for (const l of this.letters) {
      // a gentle float, and a jelly wobble when poked
      l.obj.position.y = l.base.y + Math.sin(t * 1.1 + l.base.y) * 0.04;
      if (l.wob > 0) { l.wob = Math.max(0, l.wob - dt * 1.6); const k = Math.sin((1 - l.wob) * 26) * l.wob; l.obj.scale.set(1 + k * 0.12, 1 - k * 0.12, 1); l.obj.rotation.z = k * 0.06; }
    }
    this.delveMat.color.setScalar(0.93 + Math.sin(t * 2.3) * 0.07);
    for (const c of this.creatures) {
      const b = c.base;
      let y = b.y, spin = 0;
      if (c.mask) {
        // the mascaron's great eye follows your finger
        const eye = c.obj.userData.eyes;
        if (eye) { eye.position.x = this.pointer.x * 0.12; eye.position.y = (c.obj.userData.eyes.userData.y0 ??= eye.position.y) + this.pointer.y * 0.08; }
        c.obj.position.y = b.y + Math.sin(t * 1.3) * 0.03;
      } else {
        y += Math.sin(t * 1.6 + c.phase) * 0.08;
        if (c.hop > 0) { c.hop -= dt; const k = 1 - c.hop / 0.6; y += Math.sin(k * Math.PI) * 0.9; spin = k * Math.PI * 2; }
        c.obj.position.y = y;
        c.obj.rotation.y = b.ry + spin;
        const sq = 1 + Math.sin(t * 3.2 + c.phase) * 0.03;
        c.obj.scale.set(b.sc * (2 - sq), b.sc * sq, b.sc * (2 - sq));
      }
      if (c.wings) {
        const f = c.wingKind === 'bat' ? Math.sin(t * 9 + c.phase) * 0.5 : Math.sin(t * 5 + c.phase) * 0.7;
        c.wings[0].rotation.y = 0.5 + f; c.wings[1].rotation.y = -0.5 - f;
      }
      const u = c.obj.userData;
      if (u.eyes && !c.mask) { u.blinkT -= dt; if (u.blinkT < 0) { u.eyes.scale.y = 0.12; if (u.blinkT < -0.12) { u.blinkT = 2 + Math.random() * 4; u.eyes.scale.y = 1; } } }
    }
  }
}
