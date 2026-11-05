// The helm panel: every switch for starting and stopping the engine, the gauges and the start-up
// checklist (the full procedure: see engine.js). It opens over the game, which carries on, at the
// helm (the engine key: U, or L3 on a controller); a controller moves round it like any panel
// (the D-pad, A to press, B to close), a mouse or a finger presses its switches.
//
// It only shows the engine room and asks for changes: the game does them (see main.js).

import { PROFILES, checklist, running, cranking, rpmOf, TRIM } from './engine.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const set = (e, text) => {
  if (e.textContent !== text) e.textContent = text;
};

export class HelmUI {
  // hooks: { act(action, which), assist(), trim(dir), close() }
  constructor(root, hooks) {
    this.root = root;
    this.h = hooks;
    this.kind = null;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'The helm');
    root.hidden = true;
  }

  get isOpen() { return !this.root.hidden; }

  open(kind, name) {
    if (kind !== this.kind) this.build(kind, name);
    this.root.hidden = false;
  }

  close() { this.root.hidden = true; }

  build(kind, name) {
    this.kind = kind;
    const P = PROFILES[kind], R = this.root;
    R.replaceChildren();
    const head = el('div', 'hm-head');
    head.append(el('h2', null, `${name} · the helm`));
    const x = el('button', 'hm-close', 'Close');
    x.type = 'button';
    x.addEventListener('click', () => this.h.close());
    head.append(x);
    // The gauges.
    this.g = {};
    const gauges = el('div', 'hm-gauges');
    const gauge = (id, label) => {
      const g = el('div', 'hm-gauge');
      const v = el('b', null, '–');
      g.append(v, el('span', null, label));
      gauges.append(g);
      this.g[id] = { box: g, v };
    };
    gauge('rpm', 'rpm');
    if (P.battery || P.starter === 'key') gauge('battery', 'battery');
    if (P.cooling) gauge('cool', 'cooling');
    if (P.trim) gauge('trim', P.trim === 'tilt' ? 'tilt' : 'trim');
    gauge('fuel', 'fuel');
    gauge('gear', 'gear');
    // The switches.
    this.b = {};
    const row = el('div', 'hm-switches');
    const button = (id, label, run, cls = '') => {
      const b = el('button', `hm-switch ${cls}`.trim());
      b.type = 'button';
      const t = el('span', 'hm-label', label), s = el('b', 'hm-state', '');
      b.append(t, s);
      b.addEventListener('click', run);
      row.append(b);
      this.b[id] = { b, s };
      return b;
    };
    if (P.battery) button('battery', 'Battery switch', () => this.h.act('battery'));
    if (P.cord) button('cord', 'Kill cord', () => this.h.act('cord'));
    if (P.starter === 'key') button('key', P.engines > 1 ? 'Keys' : 'Key', () => this.h.act('key'));
    if (P.diesel) button('glow', 'Glow plugs', () => this.h.act('glow'));
    if (P.starter === 'pull') button('start', 'Pull the cord', () => this.h.act('pull'), 'go');
    else if (P.engines > 1) {
      button('start0', 'Start port', () => this.h.act('start', 0), 'go');
      button('start1', 'Start starboard', () => this.h.act('start', 1), 'go');
    } else button('start', P.starter === 'button' ? 'Start button' : 'Start', () => this.h.act('start'), 'go');
    button('stop', 'Stop', () => this.h.act('stop'), 'stop');
    if (P.trim) {
      button('trimDown', P.trim === 'tilt' ? 'Tilt down' : 'Trim in', () => this.h.trim(-1));
      button('trimUp', P.trim === 'tilt' ? 'Tilt up' : 'Trim out', () => this.h.trim(1));
    }
    const assist = el('button', 'hm-assist', 'Assisted start: do it all for me');
    assist.type = 'button';
    assist.addEventListener('click', () => this.h.assist());
    this.assistBtn = assist;
    this.list = el('ol', 'hm-check');
    this.say = el('p', 'hm-say', '');
    R.append(head, gauges, row, assist, this.list, this.say);
  }

  // ctx: { lever, fuel (litres), gear ('N', 'F', 'R'), message }
  update(E, ctx = {}) {
    if (!this.isOpen || !E) return;
    const P = PROFILES[E.kind];
    const on = running(E), crank = cranking(E);
    set(this.g.rpm.v, on || crank ? `${Math.round(rpmOf(E) / 10) * 10}` : '0');
    if (this.g.battery) {
      set(this.g.battery.v, E.battery || !P.battery ? `${Math.round(E.charge * 100)}%` : 'off');
      this.g.battery.box.classList.toggle('warn', E.charge < 0.25);
    }
    if (this.g.cool) {
      set(this.g.cool.v, !on ? '–' : E.temp >= 1 ? 'HOT' : E.temp >= 0.6 ? 'warm' : 'OK');
      this.g.cool.box.classList.toggle('warn', E.temp >= 0.6);
    }
    if (this.g.trim) {
      set(this.g.trim.v, E.trim > TRIM.max ? 'up' : `${Math.round(E.trim)}°`);
      this.g.trim.box.classList.toggle('warn', E.trim >= TRIM.out);
    }
    set(this.g.fuel.v, `${Math.round(ctx.fuel ?? 0)} L`);
    set(this.g.gear.v, ctx.gear || 'N');
    this.g.gear.box.classList.toggle('warn', !!ctx.lever);
    const state = (id, text, lit) => {
      const s = this.b[id];
      if (!s) return;
      set(s.s, text);
      s.b.classList.toggle('lit', !!lit);
    };
    state('battery', E.battery ? 'ON' : 'OFF', E.battery);
    state('cord', E.cord ? 'clipped on' : 'off', E.cord);
    state('key', E.key ? 'ON' : 'OFF', E.key);
    state('glow', E.glowing > 0 ? `${Math.ceil(E.glowing)} s` : E.glow >= 1 ? 'ready' : '', E.glow >= 1);
    if (P.engines > 1) {
      E.engines.forEach((e, i) => state(`start${i}`, e.run ? 'running' : e.crank > 0 ? 'turning…' : '', e.run));
    } else state('start', on ? 'running' : crank ? 'turning…' : P.starter === 'pull' && E.pulls ? `${E.pulls} pull${E.pulls > 1 ? 's' : ''}` : '', on);
    state('stop', '', false);
    this.assistBtn.disabled = on && E.engines.every((e) => e.run);
    // The checklist.
    const items = checklist(E, ctx);
    if (this.list.children.length !== items.length) this.list.replaceChildren(...items.map(() => el('li')));
    items.forEach((it, i) => {
      const li = this.list.children[i];
      set(li, `${it.ok ? '✓' : '○'} ${it.text}`);
      li.classList.toggle('ok', it.ok);
    });
    set(this.say, ctx.message || '');
  }
}
