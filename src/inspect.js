import { weightOf } from './fish.js';
import { registerFor } from './register.js';
import { species, FAMILIES, ORDERS, IUCN } from './taxonomy.js';
import { studio } from './gearView.js';

// Looking closer at a fish you've just caught (Look closer, on the catch card): the species' own
// model, big, to turn over in your hands; how big this one is against its kind and against your
// best; and how to tell the kind apart (from the sourced register), with what it might be taken for.

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const list = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(/,(?=[A-Z])/) : []).map((s) => String(s).trim()).filter(Boolean);
const kgWords = (kg) => (kg < 1 ? `${Math.round((kg * 1000) / 10) * 10} g` : `${kg.toFixed(kg < 10 ? 1 : 0)} kg`);

// Everything the close look shows, for a fish of species sp, size cm: { name, sci, family,
// familyName, order, orderName, iucn, iucnWords, size, kg, unit, pos (0 … 1 along the kind's
// range), sizeWords, best, bestWords, marks [lines], similar [lines], note }.
export function inspectFacts(sp, size, { kg = null, best = 0, condition = '' } = {}) {
  const e = species().find((x) => x.key === `fish:${sp.id}`);
  const reg = registerFor(sp.id);
  const [lo, hi] = sp.size;
  const pos = Math.max(0, Math.min(1, (size - lo) / Math.max(1, hi - lo)));
  const sizeWords = pos < 0.2 ? 'A small one of its kind' : pos < 0.5 ? 'A middling one of its kind' : pos < 0.8 ? 'A good one of its kind' : pos < 0.97 ? 'One of the biggest the coast holds' : 'As big as they come here';
  const w = kg ?? weightOf(sp, size);
  const bestWords = !best ? 'Your first' : size > best ? `Your biggest yet (your best before: ${best} cm)` : size === best ? 'As big as your best' : `Your best: ${best} cm`;
  const F = e?.family ? FAMILIES[e.family] : null;
  return {
    name: sp.name, sci: e?.sci || '', family: e?.family || '', familyName: F?.[1] || '', order: ORDERS[e?.order]?.sci || '', orderName: ORDERS[e?.order]?.name || '', orderOpen: !!ORDERS[e?.order]?.open,
    iucn: e?.iucn || null, iucnWords: e?.iucn ? IUCN[e.iucn] : '',
    size, unit: sp.creature ? 'cm mantle' : 'cm', kg: w, kgWords: kgWords(w), condition, range: [lo, hi], pos, sizeWords, best, bestWords,
    marks: list(reg?.identification).slice(0, 6), similar: list(reg?.similar).slice(0, 3), note: sp.note,
  };
}

export class CatchInspector {
  // hooks: { onClose }
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.el = $('inspect');
    this.canvas = $('in-canvas');
    this.view = { yaw: 0.6, pitch: 0.12, zoom: 1 };
    this.spin = true;      // turning slowly by itself, until you take hold of it
    this.facts = null;
    this.raf = 0;
    const c = this.canvas;
    let drag = null;
    c.addEventListener('pointerdown', (ev) => {
      drag = { x: ev.clientX, y: ev.clientY };
      this.spin = false;
      c.setPointerCapture?.(ev.pointerId);
    });
    c.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      this.turn(ev.clientX - drag.x, ev.clientY - drag.y);
      drag = { x: ev.clientX, y: ev.clientY };
    });
    const end = () => { drag = null; };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      this.zoomBy(Math.exp(-ev.deltaY * 0.0015));
    }, { passive: false });
    $('in-zin').addEventListener('click', () => this.zoomBy(1.25));
    $('in-zout').addEventListener('click', () => this.zoomBy(1 / 1.25));
    $('in-reset').addEventListener('click', () => {
      this.view = { yaw: 0.6, pitch: 0.12, zoom: 1 };
      this.spin = true;
      this.draw();
    });
    $('in-close').addEventListener('click', () => this.hooks.onClose?.());
    $('in-back').addEventListener('click', () => this.hooks.onClose?.());
  }

  get isOpen() { return !!this.el && !this.el.hidden; }

  // Turn it over (by pixels dragged, or a stick's worth).
  turn(dx, dy) {
    this.spin = false;
    this.view.yaw += dx * 0.01;
    this.view.pitch = Math.max(-1.2, Math.min(1.2, this.view.pitch + dy * 0.01));
    this.draw();
  }

  zoomBy(k) {
    this.view.zoom = Math.max(0.7, Math.min(3.2, this.view.zoom * k));
    this.draw();
  }

  open(sp, size, extra = {}) {
    const F = (this.facts = inspectFacts(sp, size, extra));
    this.sp = sp;
    this.view = { yaw: 0.6, pitch: 0.12, zoom: 1 };
    this.spin = true;
    $('in-name').textContent = F.name;
    $('in-sci').textContent = F.sci;
    const tax = [F.order && (F.orderOpen ? `${F.order}, the perch-like fishes (their orders still being redrawn)` : `Order ${F.order}`), F.family && `family ${F.family}${F.familyName ? ` (${F.familyName.toLowerCase()})` : ''}`].filter(Boolean).join(' · ');
    $('in-tax').textContent = tax + (F.iucn ? ` · IUCN ${F.iucnWords.toLowerCase()}` : '');
    // How big: the fish against its kind's range on the coast, and against your best.
    const box = $('in-size');
    const bar = el('div', 'in-bar');
    const fill = el('span', 'in-fill');
    fill.style.width = `${Math.round(F.pos * 100)}%`;
    const mark = el('span', 'in-mark');
    mark.style.left = `${Math.round(F.pos * 100)}%`;
    bar.append(fill, mark);
    const ends = el('div', 'in-ends');
    ends.append(el('span', '', `${F.range[0]} cm`), el('span', '', `${F.range[1]} cm`));
    box.replaceChildren(
      el('p', 'in-big', `${F.size} ${F.unit} · ${F.kgWords}${F.condition ? ` · ${F.condition}` : ''}`),
      bar, ends,
      el('p', 'in-line', `${F.sizeWords}. ${F.bestWords}.`),
    );
    $('in-marks').replaceChildren(...(F.marks.length ? F.marks : [F.note]).map((m) => el('li', '', m)));
    $('in-similar').replaceChildren(...F.similar.map((m) => el('li', '', m)));
    $('in-similar-h').hidden = !F.similar.length;
    this.el.hidden = false;
    this.loop();
  }

  close() {
    if (this.el) this.el.hidden = true;
    globalThis.cancelAnimationFrame?.(this.raf);
    this.raf = 0;
  }

  loop() {
    if (!globalThis.requestAnimationFrame) return;
    cancelAnimationFrame(this.raf);
    let last = performance.now();
    const step = (now) => {
      if (!this.isOpen) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (this.spin) {
        this.view.yaw += dt * 0.35;
        this.draw();
      }
      this.raf = requestAnimationFrame(step);
    };
    this.draw();
    this.raf = requestAnimationFrame(step);
  }

  draw() {
    const c = this.canvas;
    if (!c || !this.sp) return;
    const r = c.getBoundingClientRect?.();
    if (!r || r.width < 4) return;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    studio().preview(c, { type: 'fish', id: this.sp.id }, this.view);
  }
}
