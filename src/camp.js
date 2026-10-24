import * as THREE from 'three';
import { fishById, buildFishGeometry, fishMaterial } from './fish.js';
import { formatClock } from './world/sky.js';
import { clamp, smoothstep } from './util.js';

const $ = (id) => document.getElementById(id);
const COOK_HOURS = 0.5;       // half an hour on the grill (20 real seconds)
const DRAIN_AWAKE = 3.8;      // fullness lost per in-game hour awake (a full belly lasts about a day)
const DRAIN_ASLEEP = 1.4;
const WELL_FED_HOURS = 6;
export const WAKE_TIMES = [
  { h: 5.5, name: 'Dawn' },
  { h: 8, name: 'Morning' },
  { h: 12, name: 'Midday' },
  { h: 15, name: 'Afternoon' },
  { h: 18.5, name: 'Golden hour' },
  { h: 22, name: 'Night' },
];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function button(text, onClick, cls = '') {
  const b = el('button', `pk-btn ${cls}`.trim(), text);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

// Camp life: the fire, the grill, food and sleep. Hunger is gentle on purpose: it never
// hurts you. An empty stomach only makes your legs a little slower and grumbles now and
// then; a cooked fish makes you "well fed", and steady hands make fights easier for a while.
// There are always oatcakes in the tent.
export class Camp {
  constructor(state, scene, world, hooks) {
    this.state = state;
    state.food = { full: 80, wellFedUntil: 0, ...(state.food || {}) };
    state.camp = { fireUntil: 0, cooking: null, ready: [], ...(state.camp || {}) };
    this.world = world;
    this.hooks = hooks;
    this.el = $('camp');
    this.tab = 'cook';
    this.grillFish = {};
    this.shownFish = null;
    this.lastHunger = this.hunger;
    this.renderT = 0;
    this.scene = scene;
    $('camp-close').addEventListener('click', () => hooks.close());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) hooks.close(); });
    for (const b of this.el.querySelectorAll('[data-tab]')) {
      b.addEventListener('click', () => {
        if (b.dataset.tab === 'tackle') hooks.openTackle();
        else this.show(b.dataset.tab);
      });
    }
  }

  get isOpen() { return !this.el.hidden; }
  abs() { return this.state.day * 24 + this.state.hour; }
  get food() { return this.state.food; }
  get wellFed() { return this.abs() < this.food.wellFedUntil; }
  get hunger() {
    const f = this.food.full;
    return f >= 40 ? null : f >= 15 ? 'peckish' : 'hungry';
  }

  // 1 burning, fading to glowing embers, then cold.
  get fireLevel() {
    const a = this.abs(), f = this.state.camp.fireUntil;
    if (a < f) return 0.4 + 0.6 * smoothstep(0, 0.6, f - a);
    if (a < f + 1.5) return 0.3 * (1 - (a - f) / 1.5);
    return 0;
  }

  get cooking() { return this.state.camp.cooking; }

  lightFire(hours = 3) {
    const c = this.state.camp;
    const was = this.fireLevel > 0.35;
    c.fireUntil = Math.max(c.fireUntil, this.abs()) + hours;
    c.fireUntil = Math.min(c.fireUntil, this.abs() + 5);
    this.hooks.audio.crackle?.(0.12);
    this.hooks.toast(was ? 'You add a couple of logs. The fire settles in.' : 'You strike a match. The kindling catches, and the fire takes.');
    this.render();
  }

  cook(i) {
    const c = this.state.camp;
    if (c.cooking) return;
    const f = this.state.keep.splice(i, 1)[0];
    if (!f) return;
    if (this.fireLevel < 0.4) this.lightFire(2.5);
    c.cooking = { id: f.id, size: f.size, logId: f.logId || null, start: this.abs(), dur: COOK_HOURS };
    this.hooks.toast(`The ${fishById[f.id].name.toLowerCase()} goes on the grill. It will take about half an hour.`);
    this.hooks.changed();
    this.render();
  }

  eat(i) {
    const m = this.state.camp.ready.splice(i, 1)[0];
    if (!m) return;
    this.hooks.outcome?.(m.logId, 'eaten');
    const sp = fishById[m.id];
    const k = (m.size - sp.size[0]) / Math.max(1, sp.size[1] - sp.size[0]);
    this.food.full = Math.min(100, this.food.full + sp.meal.fill * (0.6 + 0.6 * k));
    this.food.wellFedUntil = this.abs() + WELL_FED_HOURS;
    this.hooks.audio.chime();
    this.hooks.toast(`${sp.meal.name}. Warm, smoky and delicious. You feel well fed: steady hands for a few hours.`, 6);
    this.state.meals = (this.state.meals || 0) + 1;
    this.hooks.changed();
    this.render();
  }

  oatcake() {
    this.food.full = Math.min(100, this.food.full + 22);
    this.hooks.toast('An oatcake from the tin. It keeps you going, but a hot meal would be nicer.');
    this.hooks.changed();
    this.render();
  }

  // Hours of game time passed this frame. Called every frame, awake or asleep.
  update(dt, hours, asleep = false) {
    const f = this.food;
    f.full = clamp(f.full - hours * (asleep ? DRAIN_ASLEEP : DRAIN_AWAKE), 0, 100);
    const h = this.hunger;
    if (h !== this.lastHunger && !asleep) {
      if (h === 'peckish') this.hooks.toast('You’re getting peckish. A fish from the grill at camp would be lovely.', 5);
      if (h === 'hungry') this.hooks.toast('Your stomach rumbles, and your legs feel slow. There’s food at camp: grill a fish, or have an oatcake.', 6);
    }
    this.lastHunger = h;
    const c = this.state.camp;
    if (c.cooking && this.abs() >= c.cooking.start + c.cooking.dur) {
      c.ready.push({ id: c.cooking.id, size: c.cooking.size, logId: c.cooking.logId || null });
      this.hooks.outcome?.(c.cooking.logId, 'cooked');
      c.cooking = null;
      if (!asleep) this.hooks.toast('Something smells wonderful: your fish is cooked. Eat it at camp.', 5);
      this.hooks.changed();
    }
    this.updateGrill();
    if (this.isOpen) {
      this.renderT -= dt;
      if (this.renderT <= 0) {
        this.renderT = 0.5;
        this.render();
      }
    }
  }

  // The fish on the grill, browning as it cooks.
  updateGrill() {
    const c = this.state.camp;
    const show = c.cooking || c.ready[0] || null;
    const id = show?.id || null;
    if (this.shownFish && this.shownFish !== id) this.grillFish[this.shownFish].visible = false;
    this.shownFish = id;
    if (!id) return;
    let m = this.grillFish[id];
    if (!m) {
      const sp = fishById[id];
      m = new THREE.Mesh(buildFishGeometry(sp), fishMaterial(sp, false));
      m.rotation.set(0, Math.PI / 2, Math.PI / 2);
      m.castShadow = true;
      this.scene.add(m);
      this.grillFish[id] = m;
    }
    const sp = fishById[id];
    m.visible = true;
    m.position.copy(this.world.grillPos);
    m.position.y += 0.04;
    m.scale.setScalar(Math.min((show.size / 100) * sp.visual, 0.75));
    const done = c.cooking ? clamp((this.abs() - c.cooking.start) / c.cooking.dur, 0, 1) : 1;
    m.material.color.setRGB(1 - done * 0.42, 1 - done * 0.55, 1 - done * 0.7);
  }

  open(tab = 'cook') {
    this.el.hidden = false;
    this.show(tab);
  }

  close() {
    this.el.hidden = true;
  }

  show(tab) {
    this.tab = tab;
    for (const b of this.el.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
    for (const p of this.el.querySelectorAll('[data-pane]')) p.hidden = p.dataset.pane !== tab;
    this.render();
  }

  render() {
    if (!this.isOpen) return;
    $('camp-sub').textContent = `${formatClock(this.state.hour)} · day ${this.state.day}`;
    if (this.tab === 'cook') this.renderCook();
    else this.renderSleep();
  }

  renderCook() {
    const c = this.state.camp, f = this.food;
    const out = [];
    const fire = this.fireLevel;
    const left = c.fireUntil - this.abs();
    const fireRow = el('div', 'cp-row');
    fireRow.append(el('span', `cp-fire ${fire > 0.35 ? 'lit' : fire > 0 ? 'embers' : ''}`), el('p', '', fire > 0.35 ? `The fire is burning: about ${Math.max(1, Math.round(left))} h left.` : fire > 0 ? 'Just embers now, still warm.' : 'The fire ring is cold.'));
    fireRow.append(button(fire > 0.35 ? 'Add a log' : 'Light the fire', () => this.lightFire(fire > 0.35 ? 1.5 : 3)));
    out.push(fireRow);

    const belly = el('div', 'cp-row');
    const word = f.full > 80 ? 'Full' : f.full >= 40 ? 'Content' : f.full >= 15 ? 'Peckish' : 'Hungry';
    const bar = el('span', 'cp-bar');
    const fill = el('i');
    fill.style.width = `${Math.round(f.full)}%`;
    bar.append(fill);
    belly.append(el('strong', '', word), bar, el('span', 'cp-soft', this.wellFed ? 'Well fed: steady hands' : ''));
    out.push(belly);

    out.push(el('h3', '', 'On the grill'));
    if (c.cooking) {
      const done = clamp((this.abs() - c.cooking.start) / c.cooking.dur, 0, 1);
      const row = el('div', 'cp-row');
      const pb = el('span', 'cp-bar warm');
      const pf = el('i');
      pf.style.width = `${Math.round(done * 100)}%`;
      pb.append(pf);
      row.append(el('p', '', `${fishById[c.cooking.id].name}, sizzling.`), pb, el('span', 'cp-soft', 'Hold T to wait'));
      out.push(row);
    }
    c.ready.forEach((m, i) => {
      const sp = fishById[m.id];
      const row = el('div', 'cp-row');
      row.append(el('p', '', `${sp.meal.name} (${m.size} cm), ready.`), button('Eat', () => this.eat(i)));
      out.push(row);
    });
    if (!c.cooking && !c.ready.length) out.push(el('p', 'cp-soft', 'Nothing cooking.'));

    out.push(el('h3', '', 'Your creel'));
    const keep = this.state.keep || [];
    if (!keep.length) out.push(el('p', 'cp-soft', 'No fish kept. When you land one you’d like to eat, press K (or tap Keep) on the catch card.'));
    keep.forEach((k, i) => {
      const sp = fishById[k.id];
      const row = el('div', 'cp-row');
      row.append(el('p', '', `${sp.name}, ${k.size} cm`), el('span', 'cp-soft', sp.meal.name));
      const b = button('Grill it', () => this.cook(i));
      b.disabled = !!c.cooking;
      if (c.cooking) b.title = 'The grill is busy';
      row.append(b);
      out.push(row);
    });
    const oat = el('div', 'cp-row');
    oat.append(el('p', 'cp-soft', 'A tin of oatcakes lives in the tent.'), button('Have an oatcake', () => this.oatcake(), 'quiet'));
    out.push(oat);
    $('camp-cook').replaceChildren(...out);
  }

  renderSleep() {
    const out = [];
    out.push(el('p', 'cp-lead', 'Crawl into the tent and sleep until…'));
    const grid = el('div', 'cp-wake');
    const now = this.state.hour;
    for (const w of WAKE_TIMES) {
      let hrs = w.h - now;
      if (hrs <= 0.5) hrs += 24;
      const b = button(`${w.name}`, () => this.hooks.sleep(w.h), 'wake');
      b.append(el('small', '', `${formatClock(w.h)} · ${Math.round(hrs)} h`));
      grid.append(b);
    }
    out.push(grid);
    out.push(el('p', 'cp-soft', 'While you sleep the world goes on: the light changes, the weather may turn, the fire burns down and the fish move to where the new hour suits them.'));
    $('camp-sleep').replaceChildren(...out);
  }
}
