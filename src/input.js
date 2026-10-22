// Movement uses physical key positions (e.code), so WASD works on AZERTY and other layouts too.
// One-letter shortcuts use the printed letter (e.key), so J is always the key marked J.
const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Input {
  constructor(canvas) {
    this.codes = new Set();
    this.keys = new Set();
    this.handlers = { press: [], release: [], pointer: [] };
    this.drag = { dx: 0, dy: 0 };
    this.wheel = 0;
    this.pointers = new Map();
    this.pinch = 0;
    // The touch controls write here (see touch.js).
    this.virtual = { throttle: 0, steer: 0, rest: false };
    this.labels = { KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D' };

    addEventListener('keydown', (e) => {
      if (BLOCK.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      const key = (e.key || '').toLowerCase();
      this.codes.add(e.code);
      this.keys.add(key);
      this.emit('press', e.code, key);
    });
    addEventListener('keyup', (e) => {
      const key = (e.key || '').toLowerCase();
      this.codes.delete(e.code);
      this.keys.delete(key);
      this.emit('release', e.code, key);
    });
    addEventListener('blur', () => {
      for (const c of this.codes) this.emit('release', c, '');
      this.codes.clear();
      this.keys.clear();
    });

    // One pointer drags the view; two pointers pinch to zoom.
    canvas.addEventListener('pointerdown', (e) => {
      try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.pinch = this.pinchDistance();
      canvas.classList.add('dragging');
      this.emit('pointer', e.pointerType, '');
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 1) {
        this.drag.dx += dx;
        this.drag.dy += dy;
      } else if (this.pointers.size === 2) {
        const d = this.pinchDistance();
        if (this.pinch) this.wheel += (this.pinch - d) * 4;
        this.pinch = d;
      }
    });
    const end = (e) => {
      this.pointers.delete(e.pointerId);
      this.pinch = this.pinchDistance();
      if (!this.pointers.size) canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += e.deltaY;
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Show the letters printed on this keyboard (e.g. Z Q S D on AZERTY).
    try {
      navigator.keyboard?.getLayoutMap?.().then((map) => {
        for (const code of Object.keys(this.labels)) {
          const k = map.get(code);
          if (k) this.labels[code] = k.toUpperCase();
        }
      }).catch(() => {});
    } catch {
      // Not available in some embedded frames; keep the WASD labels.
    }
  }

  on(evt, fn) { this.handlers[evt].push(fn); }
  emit(evt, code, key) { for (const fn of this.handlers[evt] || []) fn(code, key); }
  hasCode(...codes) { return codes.some((c) => this.codes.has(c)); }
  hasKey(k) { return this.keys.has(k); }

  pinchDistance() {
    if (this.pointers.size < 2) return 0;
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // On-screen buttons press keys the same way the keyboard does.
  pressVirtual(code) {
    if (this.codes.has(code)) return;
    this.codes.add(code);
    this.emit('press', code, '');
  }

  releaseVirtual(code) {
    if (!this.codes.has(code)) return;
    this.codes.delete(code);
    this.emit('release', code, '');
  }

  get throttle() {
    const k = (this.hasCode('KeyW', 'ArrowUp') ? 1 : 0) - (this.hasCode('KeyS', 'ArrowDown') ? 1 : 0);
    return k || this.virtual.throttle;
  }

  get steer() {
    const k = (this.hasCode('KeyA', 'ArrowLeft') ? 1 : 0) - (this.hasCode('KeyD', 'ArrowRight') ? 1 : 0);
    return k || this.virtual.steer;
  }

  get action() { return this.codes.has('Space'); }
  get resting() { return this.keys.has('t') || this.virtual.rest; }

  takeDrag() {
    const d = { x: this.drag.dx, y: this.drag.dy };
    this.drag.dx = this.drag.dy = 0;
    return d;
  }

  takeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  label(code) { return this.labels[code] || code; }
}
