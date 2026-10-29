// Touch joystick + action buttons + keyboard fallback.
export class Input {
  constructor() {
    this.mx = 0; this.mz = 0; this.moveLen = 0;
    this.held = [false, false, false, false, false];
    this.potion = false;
    this.keys = new Set();
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.enabled = true;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT')) return;
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.held.fill(false); this.joy.id = null; });
  }

  bindJoystick(zone, baseEl, knobEl) {
    const R = 56;
    this.joyBase = baseEl; this.joyKnob = knobEl;
    zone.addEventListener('pointerdown', (e) => {
      if (this.joy.id !== null) return;
      this.joy.id = e.pointerId; this.joy.ox = e.clientX; this.joy.oy = e.clientY; this.joy.x = this.joy.y = 0;
      zone.setPointerCapture(e.pointerId);
      baseEl.style.display = 'block';
      baseEl.style.left = e.clientX + 'px'; baseEl.style.top = e.clientY + 'px';
      knobEl.style.transform = 'translate(-50%, -50%)';
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joy.id) return;
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const l = Math.hypot(dx, dy);
      if (l > R) {
        // drag the base along so direction changes stay responsive
        this.joy.ox += (dx / l) * (l - R); this.joy.oy += (dy / l) * (l - R);
        baseEl.style.left = this.joy.ox + 'px'; baseEl.style.top = this.joy.oy + 'px';
        dx = (dx / l) * R; dy = (dy / l) * R;
      }
      this.joy.x = dx / R; this.joy.y = dy / R;
      knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    const end = (e) => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.id = null; this.joy.x = this.joy.y = 0;
      baseEl.style.display = 'none';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  bindButton(el, onDown, onUp) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); el.classList.add('down'); onDown(); });
    const up = (e) => { el.classList.remove('down'); onUp && onUp(); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update() {
    const k = this.keys;
    let kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let kz = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    let x = this.joy.x + kx, z = this.joy.y + kz;
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    this.mx = x; this.mz = z; this.moveLen = Math.min(1, l);
    this.kbHeld = [k.has('Space') || k.has('KeyJ'), k.has('Digit1') || k.has('KeyK'), k.has('Digit2') || k.has('KeyL'), k.has('Digit3') || k.has('KeyU'), k.has('Digit4') || k.has('KeyI')];
    this.kbPotion = k.has('KeyF') || k.has('KeyQ');
  }
  isHeld(i) { return this.held[i] || (this.kbHeld && this.kbHeld[i]); }
}
