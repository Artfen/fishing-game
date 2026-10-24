import { levers } from './throttle.js';

// The throttle lever on screen (bottom right; above the cast button on a touch screen), shown
// while you're at the helm of a motorboat or have the kayak's motor down. Its notches run from
// full ahead at the top to astern at the bottom: click or tap one, or drag the handle up and down
// (it settles in the nearest notch). A fill beside the track shows what the motor is actually
// giving as it builds up and eases off. Under it a big Stop (neutral), and in the kayak a button
// to lower or raise the motor. Notches out of reach just now (a line out, a fish on) are dimmed.
//
// It never takes the keyboard's focus and its clicks and drags stay on it, so using it never
// casts, steers or turns the camera. The keys, the controller and the touch stick move the same
// lever (see main.js): this only shows it, and asks for changes.

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export class LeverUI {
  // hooks: { set(index), stop(), motor() }
  constructor(root, hooks) {
    this.root = root;
    this.h = hooks;
    this.kind = null;
    this.drag = null;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Throttle lever');
    const head = el('div', 'lv-head');
    this.title = el('span', 'lv-title', 'Throttle');
    this.now = el('b', 'lv-now', 'Neutral');
    head.append(this.title, this.now);
    this.body = el('div', 'lv-body');
    this.track = el('div', 'lv-track');
    this.fill = el('div', 'lv-fill');
    this.handle = el('div', 'lv-handle');
    this.track.append(this.fill, this.handle);
    this.track.setAttribute('role', 'slider');
    this.track.setAttribute('aria-orientation', 'vertical');
    this.list = el('ol', 'lv-notches');
    this.body.append(this.list, this.track);
    this.stopBtn = el('button', 'lv-stop', 'Stop');
    this.stopBtn.type = 'button';
    this.motorBtn = el('button', 'lv-motor', 'Motor');
    this.motorBtn.type = 'button';
    this.keys = el('div', 'lv-keys');
    root.append(head, this.body, this.stopBtn, this.motorBtn, this.keys);
    // Buttons press on the way down (no focus left behind, no click lost to a moving finger).
    const press = (b, fn) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
    press(this.stopBtn, () => this.h.stop());
    press(this.motorBtn, () => this.h.motor());
    this.track.addEventListener('pointerdown', (e) => this.dragStart(e));
    this.track.addEventListener('pointermove', (e) => this.dragMove(e));
    for (const ev of ['pointerup', 'pointercancel']) this.track.addEventListener(ev, (e) => this.dragEnd(e));
    // (Nothing here is for the browser's own menus or text selection.)
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // kind: a lever in throttle.js ('skiff', 'bass', 'cabin', 'kayak'), or null for the kayak with
  // its motor up (only the Motor button shows).
  build(kind) {
    this.kind = kind;
    this.list.replaceChildren();
    this.root.classList.toggle('lv-raised', !kind);
    if (!kind) return;
    const L = levers(kind);
    this.items = [...L].reverse().map((n) => {
      const i = L.indexOf(n);
      const li = el('li', n.id === 'N' ? 'lv-n' : n.v < 0 ? 'lv-r' : n.quiet ? 'lv-q' : '');
      const b = el('button', 'lv-notch', n.id);
      b.type = 'button';
      b.tabIndex = -1;
      b.setAttribute('aria-label', n.name);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.h.set(i);
      });
      li.append(b, el('span', 'lv-name', n.name));
      this.list.append(li);
      return { li, i };
    });
  }

  // Where a pointer is on the track, as a notch (top: full ahead).
  indexAt(y) {
    const L = levers(this.kind), r = this.track.getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (y - r.top) / Math.max(1, r.height)));
    return L.length - 1 - Math.round(u * (L.length - 1));
  }

  dragStart(e) {
    if (!this.kind) return;
    e.preventDefault();
    e.stopPropagation();
    try { this.track.setPointerCapture(e.pointerId); } catch { /* gone already */ }
    this.drag = e.pointerId;
    this.root.classList.add('lv-dragging');
    this.h.set(this.indexAt(e.clientY));
  }

  dragMove(e) {
    if (this.drag !== e.pointerId) return;
    e.preventDefault();
    this.h.set(this.indexAt(e.clientY));
  }

  dragEnd(e) {
    if (this.drag !== e.pointerId) return;
    this.drag = null;
    this.root.classList.remove('lv-dragging');
  }

  // s: { show, kind, index, power (-1 … 1), cap (the highest notch allowed), words, motor
  //   ('down' | 'up' | null: not a kayak), keys (a line of controls, HTML), title }
  update(s) {
    const on = !!s.show;
    if (this.root.hidden === on) this.root.hidden = !on;
    document.body.classList.toggle('helm', on);
    if (!on) {
      this.drag = null;
      return;
    }
    if (s.kind !== this.kind) this.build(s.kind);
    this.title.textContent = s.title || 'Throttle';
    this.now.textContent = s.words;
    this.motorBtn.hidden = !s.motor;
    this.motorBtn.textContent = s.motor === 'down' ? 'Raise motor · paddle' : 'Lower motor';
    this.motorBtn.setAttribute('aria-pressed', s.motor === 'down');
    this.stopBtn.hidden = !s.kind;
    this.body.hidden = !s.kind;
    if (this.keys.innerHTML !== (s.keys || '')) this.keys.innerHTML = s.keys || '';
    if (!s.kind) return;
    const L = levers(s.kind), n = L.length - 1;
    // The handle sits on the chosen notch; the fill shows what the motor is giving, from neutral.
    const at = (i) => `${((n - i) / n) * 100}%`;
    this.handle.style.top = at(s.index);
    const iN = L.findIndex((x) => x.id === 'N');
    const yN = (n - iN) / n;
    const p = s.power || 0;
    // (The power as a position between notches, so the fill grows notch by notch.)
    let k = iN;
    if (p > 0) for (let i = iN; i < n && L[i + 1].v <= p + 1e-6; i++) k = i + 1;
    if (p < 0) k = iN - Math.min(1, -p / -L[0].v);
    const frac = p > 0 && k < n ? (p - L[k].v) / (L[k + 1].v - L[k].v) : 0;
    const yP = (n - (k + frac)) / n;
    this.fill.style.top = `${Math.min(yN, yP) * 100}%`;
    this.fill.style.height = `${Math.abs(yN - yP) * 100}%`;
    this.fill.classList.toggle('astern', p < 0);
    for (const { li, i } of this.items) {
      li.classList.toggle('on', i === s.index);
      li.classList.toggle('locked', i > s.cap);
    }
    this.track.setAttribute('aria-valuetext', s.words);
    this.track.setAttribute('aria-valuenow', String(s.index));
  }
}
