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
  // hooks: { set(index), stop(), motor(), slideTo(index: fractional, for the smooth lever) }
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
    // (The engine's gauges, in a line: the revs, the trim, anything wrong. See helmGauges.)
    this.gauges = el('div', 'lv-gauges');
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
    // (The outboard's leg right up out of the water, or back down: one press.)
    this.tiltBtn = el('button', 'lv-motor lv-tilt', 'Tilt up');
    this.tiltBtn.type = 'button';
    this.tiltBtn.hidden = true;
    this.keys = el('div', 'lv-keys');
    // (Twin engines: which lever the throttle works, and the other one's notch when they're apart.)
    this.handle2 = el('div', 'lv-handle lv-handle2');
    this.handle2.hidden = true;
    this.track.append(this.handle2);
    this.twins = el('div', 'lv-twins');
    this.twins.hidden = true;
    this.twinBtns = [['both', 'Both'], ['port', 'Port'], ['stbd', 'Stbd']].map(([id, text]) => {
      const b = el('button', 'lv-twin', text);
      b.type = 'button';
      b.dataset.sel = id;
      b.setAttribute('aria-label', id === 'both' ? 'Both levers' : id === 'port' ? 'The port lever' : 'The starboard lever');
      this.twins.append(b);
      return b;
    });
    root.append(head, this.gauges, this.twins, this.body, this.stopBtn, this.tiltBtn, this.motorBtn, this.keys);
    // Buttons press on the way down (no focus left behind, no click lost to a moving finger).
    const press = (b, fn) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
    press(this.stopBtn, () => this.h.stop());
    press(this.motorBtn, () => this.h.motor());
    press(this.tiltBtn, () => this.h.tilt?.());
    for (const b of this.twinBtns) press(b, () => this.h.levers?.(b.dataset.sel));
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

  // Where a pointer is on the track, as a notch (top: full ahead); for the smooth lever, the
  // place between notches too.
  indexAt(y, exact = false) {
    const L = levers(this.kind), r = this.track.getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (y - r.top) / Math.max(1, r.height)));
    const f = (L.length - 1) * (1 - u);
    return exact ? f : Math.round(f);
  }

  // A drag on the track: the notch it's nearest, or (the smooth lever) right where it is.
  dragTo(y) {
    if (this.smooth && this.h.slideTo) this.h.slideTo(this.indexAt(y, true));
    else this.h.set(this.indexAt(y));
  }

  dragStart(e) {
    if (!this.kind) return;
    e.preventDefault();
    e.stopPropagation();
    try { this.track.setPointerCapture(e.pointerId); } catch { /* gone already */ }
    this.drag = e.pointerId;
    this.root.classList.add('lv-dragging');
    this.dragTo(e.clientY);
  }

  dragMove(e) {
    if (this.drag !== e.pointerId) return;
    e.preventDefault();
    this.dragTo(e.clientY);
  }

  dragEnd(e) {
    if (this.drag !== e.pointerId) return;
    this.drag = null;
    this.root.classList.remove('lv-dragging');
  }

  // s: { show, kind, index (fractional for the smooth lever), power (-1 … 1), cap (the highest
  //   notch allowed), words, motor ('down' | 'up' | null: not a kayak), tilt ('up' | 'down': the
  //   outboard's leg, for the tilt button; null: no leg to tilt), keys (a line of controls,
  //   HTML), title, smooth (the real lever, not notches) }
  update(s) {
    const on = !!s.show;
    if (this.root.hidden === on) this.root.hidden = !on;
    document.body.classList.toggle('helm', on);
    if (!on) {
      this.drag = null;
      return;
    }
    if (s.kind !== this.kind) this.build(s.kind);
    this.smooth = !!s.smooth;
    this.root.classList.toggle('lv-smooth', this.smooth);
    this.title.textContent = s.title || 'Throttle';
    this.now.textContent = s.words;
    this.motorBtn.hidden = !s.motor;
    this.motorBtn.textContent = s.motor === 'outboard' ? 'Outboard up · sail or row' : s.motor === 'down' ? 'Raise motor · paddle' : 'Lower motor';
    this.motorBtn.setAttribute('aria-pressed', s.motor === 'down' || s.motor === 'outboard');
    this.stopBtn.hidden = !s.kind;
    if (this.tiltBtn.hidden !== !s.tilt) this.tiltBtn.hidden = !s.tilt;
    const tw = s.tilt === 'up' ? (s.twin ? 'Tilt the outboards down' : 'Tilt the outboard down') : s.twin ? 'Tilt the outboards up' : 'Tilt the outboard up';
    if (s.tilt && this.tiltBtn.textContent !== tw) this.tiltBtn.textContent = tw;
    this.tiltBtn.setAttribute('aria-pressed', s.tilt === 'up');
    this.body.hidden = !s.kind;
    if (this.keys.innerHTML !== (s.keys || '')) this.keys.innerHTML = s.keys || '';
    if (this.gauges.innerHTML !== (s.gauges || '')) this.gauges.innerHTML = s.gauges || '';
    this.gauges.hidden = !s.gauges;
    this.twins.hidden = !s.twins;
    if (s.twins) for (const b of this.twinBtns) b.setAttribute('aria-pressed', b.dataset.sel === s.twins.sel);
    if (!s.kind) return;
    const L = levers(s.kind), n = L.length - 1;
    // The handle sits on the chosen notch; the fill shows what the motor is giving, from neutral.
    const at = (i) => `${((n - i) / n) * 100}%`;
    this.handle.style.top = at(s.index);
    // (Twin levers apart: the other one's handle, smaller, where it is.)
    const other = s.twins?.split ? s.twins.split[s.twins.sel === 'stbd' ? 0 : 1] : null;
    this.handle2.hidden = other == null;
    if (other != null) this.handle2.style.top = at(other);
    this.root.classList.toggle('lv-apart', !!s.twins?.split);
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
    // (The smooth lever lights the notch mark it's on, if it's on one.)
    const mark = Math.abs(s.index - Math.round(s.index)) < 0.08 ? Math.round(s.index) : -1;
    for (const { li, i } of this.items) {
      li.classList.toggle('on', i === mark);
      li.classList.toggle('locked', i > s.cap);
    }
    this.track.setAttribute('aria-valuetext', s.words);
    this.track.setAttribute('aria-valuenow', String(Math.round(s.index * 100) / 100));
  }
}
