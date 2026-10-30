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

// Swag of leaves and fruit hanging between two points.
function garland(x0, x1, y, sag) {
  const g = new THREE.Group();
  const fruit = [0xd03020, 0xf0a020, 0x8a2a8a, 0xe8d040];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22, x = x0 + (x1 - x0) * t, yy = y - Math.sin(t * Math.PI) * sag;
    g.add(part(G.sphere(), lambert(i % 2 ? 0x4a7a2a : 0x6a9a3a), 0.2, 0.13, 0.13, x, yy, 0.1));
    if (i % 3 === 1) g.add(part(G.sphere(), lambert(fruit[i % 4]), 0.13, 0.13, 0.13, x, yy - 0.12, 0.2));
  }
  for (const xx of [x0, x1]) g.add(part(G.cyl(), lambert(0xc02040), 0.03, 0.9, 0.03, xx, y - 0.45, 0.05)); // ribbons
  return new THREE.Mesh(mergeGroup(g).lit, GILT_V);
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
    // a dim painted ground panel behind the ornament, with gilt border lines
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), new THREE.MeshLambertMaterial({ color: 0x3a1218 }));
    panel.position.set(0, 0.2, -1.2); root.add(panel);
    for (const [w, h] of [[12.6, 10.6], [12.2, 10.2]]) {
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), new THREE.LineBasicMaterial({ color: 0xc8922e }));
      frame.position.set(0, 0.2, -1.15); root.add(frame);
    }

    const c = candelabrum(); root.add(c.group); this.flame = c.flame;
    this.creatures = [];
    const put = (obj, x, y, z, ry = 0, sc = 1, extra = {}) => { obj.position.set(x, y, z); obj.rotation.y = ry; obj.scale.setScalar(sc); root.add(obj); this.creatures.push({ obj, base: { x, y, z, ry, sc }, phase: Math.random() * 6, hop: 0, ...extra }); return obj; };

    // mascaron at the base: one eye, goblin ears, a beard of leaves
    const mask = buildMask('abyss', 0.9);
    put(mask, 0, -2.9, 0.75, 0, 0.8, { mask: true });
    for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; const leaf = part(G.sphere(), lambert(i % 2 ? 0x5a8a3a : 0x7aa84a), 0.14, 0.42, 0.06, Math.sin(a) * 0.7, -0.75 - Math.cos(a) * 0.2, 0.55); leaf.rotation.z = a; mask.add(leaf); }
    for (const sx of [-1, 1]) { const ear = part(G.cone(), lambert(0x86b84a), 0.22, 0.8, 0.1, sx * 0.95, 0.2, 0); ear.rotation.z = -sx * 1.25; mask.add(ear); }

    // mirrored pairs climbing the column
    for (const sx of [-1, 1]) {
      const flip = -sx; // creatures face the centre
      // acanthus brackets
      for (const [y, size] of [[-2.0, 1.25], [0.1, 1.05], [2.0, 0.85]]) { const a = acanthus(1.35, size, sx); a.position.set(sx * 0.2, y, 0); root.add(a); }
      // goblin-headed spiders on the lowest scrolls
      put(buildChimera('spider', 'nest', 'caves', 'angry'), sx * 2.35, -1.95, 0.2, flip * 0.9, 1.25);
      // winged snowman-headed hounds in the middle
      const hound = put(buildChimera('hound', 'caves', 'frozen'), sx * 2.15, 0.15, 0.25, flip * 0.9, 1.15);
      this.addWings(hound, 'bat', 0x5a2a3a, 0.55, 0.62, -0.05, 0.7);
      // one-eyed putti with butterfly wings at the top, holding the garland
      const putto = put(buildChimera('biped', 'crypt', 'abyss'), sx * 1.85, 2.15, 0.25, flip * 0.5, 0.95);
      this.addWings(putto, 'butterfly', 0x80c0ff, 0.72, -0.25, 0, 0.9);
      // worried bomber balloons sprouting from the outer stalks
      put(buildChimera('bomber', 'hell', 'storm'), sx * 4.15, 3.25, 0, flip * 0.4, 0.8);
      const stalk = acanthus(0.9, 0.75, -sx, 0x4a7a2a); stalk.position.set(sx * 4.6, 2.2, -0.2); stalk.rotation.z = sx * 0.6; root.add(stalk);
      // little goblin-zombie gremlins sitting on the foot
      put(buildChimera('swarmer', 'swamp', 'hell'), sx * 1.45, -3.25, 0.6, flip * 0.6, 1.3);
    }
    root.add(garland(-1.75, 1.75, 3.0, 0.75));
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

  resize(w, h) {
    const cam = this.camera, aspect = w / h, wide = aspect > 1.15;
    cam.aspect = aspect;
    // portrait: the ~9.5-unit-tall composition sits between the title and the hero panel;
    // landscape: it fills the left side while the title and panel stack on the right
    const visH = wide ? 10.6 : Math.max(9.5 / 0.36, 11.6 / aspect);
    const dist = visH / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    const lookY = wide ? 0.2 : 0.2 - 0.07 * visH;
    cam.position.set(0, lookY - 0.6, dist);
    cam.lookAt(0, lookY, 0);
    if (wide) cam.setViewOffset(w, h, w * 0.22, 0, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    this.scene.fog.near = dist - 3; this.scene.fog.far = dist + 12;
  }

  setPointer(nx, ny) { this.pointer.set(nx, ny); }

  // Tap a beast and it hops and pipes up. Returns true if one was hit.
  tap(nx, ny) {
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hits = this.raycaster.intersectObjects(this.creatures.map((c) => c.obj), true);
    if (!hits.length) return false;
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
