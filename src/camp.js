import * as THREE from 'three';
import { fishById, buildFishGeometry, fishMaterial } from './fish.js';
import { formatClock } from './world/sky.js';
import { clamp, smoothstep } from './util.js';
import { PACK } from './tackle.js';
import { COOLBOX, MEALS_MAX, TENTS, DECOR, DECOR_UNLOCK, settleCooking, startCooking, stow, take, packPlan, cleanName } from './campsite.js';

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

// A fish to cook: its own copy of its materials (still, and free to brown without tinting the
// fish swimming in the water), whether its model has one material or several.
export function cookedMaterial(sp) {
  const m = [].concat(fishMaterial(sp, false)).map((x) => x.clone());
  return m.length === 1 ? m[0] : m;
}
export function browned(mesh, done) {
  for (const m of [].concat(mesh.material)) m.color?.setRGB(1 - done * 0.42, 1 - done * 0.55, 1 - done * 0.7);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// (A button only acts while its sheet is open: one left over from an earlier visit does nothing.)
let live = () => true;
function button(text, onClick, cls = '') {
  const b = el('button', `pk-btn ${cls}`.trim(), text);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.isConnected && live(b)) onClick();
  });
  return b;
}

// Camp life: the fire, the grill, food and sleep. Hunger is gentle on purpose: it never
// hurts you. An empty stomach only makes your legs a little slower and grumbles now and
// then; a cooked fish makes you "well fed", and steady hands make fights easier for a while.
// There are always oatcakes in the tent.
//
// The same sheet serves the old camp on the west shore (its fire and grill) and your own camp,
// wherever you've pitched it (a camping stove, a cool box, and its own tab for naming it,
// dressing it up, moving it or packing it away). See campsite.js for the rules.
export class Camp {
  constructor(state, scene, world, hooks) {
    this.state = state;
    state.food = { full: 80, wellFedUntil: 0, ...(state.food || {}) };
    state.camp = { fireUntil: 0, cooking: null, ready: [], ...(state.camp || {}) };
    this.world = world;
    this.hooks = hooks;
    this.el = $('camp');
    this.tab = 'cook';
    this.site = null; // null: the old camp; 'house': home; 'cabin': the cabin boat; 'bothy': the bothy on the fell; 'posada': your room at Bar El Muelle (Las Brasas); otherwise your camp's record
    this.grillFish = {};
    this.shownFish = null;
    this.lastHunger = this.hunger;
    this.renderT = 0;
    this.settleT = 0;
    this.scene = scene;
    this.packing = null; // choosing fish to let go before packing up: Set of cool box indices
    // The sheet must be open, on a camp that's still pitched, and the button in the pane showing.
    live = (b) => this.isOpen && (!this.own || (this.state.camps || []).includes(this.site)) && !b.closest('[data-pane]')?.hidden;
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
  get own() { return !!this.site && this.site !== 'house' && this.site !== 'cabin' && this.site !== 'bothy' && this.site !== 'posada'; }
  // Home, the cabin boat, the bothy and the room at Bar El Muelle work the same way: a kitchen (a
  // galley, a stove) to cook what's in your creel, and a bed (a bunk). (The bothy and the bar have
  // a shelf of tackle too.)
  get house() { return this.site === 'house' || this.site === 'cabin' || this.site === 'bothy' || this.site === 'posada'; }
  get cabin() { return this.site === 'cabin'; }
  get bothy() { return this.site === 'bothy'; }
  get posada() { return this.site === 'posada'; }
  get shelf() { return this.bothy || this.posada; }
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
    const f = this.state.keep[i];
    if (!f || f.cooked) return;
    this.state.keep.splice(i, 1);
    if (this.fireLevel < 0.4) this.lightFire(2.5);
    c.cooking = { id: f.id, size: f.size, logId: f.logId || null, start: this.abs(), dur: COOK_HOURS };
    this.hooks.toast(`The ${fishById[f.id].name.toLowerCase()} goes on the grill. It will take about half an hour.`);
    this.hooks.changed();
    this.render();
  }

  // Eat a cooked fish: from the grill's ready list, your camp's, or wrapped in your creel.
  eatMeal(m) {
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

  eat(i) {
    const m = this.state.camp.ready.splice(i, 1)[0];
    if (m) this.eatMeal(m);
  }

  eatFromCreel(i) {
    const f = this.state.keep[i];
    if (!f?.cooked) return;
    this.state.keep.splice(i, 1);
    this.eatMeal(f);
  }

  oatcake() {
    this.food.full = Math.min(100, this.food.full + 22);
    this.hooks.toast(this.posada ? 'Papas arrugadas: little potatoes boiled in salty water till their skins wrinkle, with a hot red mojo. They keep you going; a fish would be better.' : 'An oatcake from the tin. It keeps you going, but a hot meal would be nicer.');
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
    // Your camps' stoves: looked at now and then (no timer runs for a camp you're far from).
    this.settleT -= dt;
    if (this.settleT <= 0 || hours > 0.2) {
      this.settleT = 1;
      for (const camp of this.state.camps || []) {
        const meal = settleCooking(camp, this.abs());
        if (!meal) continue;
        this.hooks.outcome?.(meal.logId, 'cooked');
        if (!asleep && this.hooks.near?.(camp)) this.hooks.toast(`Your ${fishById[meal.id].name.toLowerCase()} is cooked. It’s waiting by the stove.`, 5);
        this.hooks.changed();
      }
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

  // The fish on the old camp's grill, browning as it cooks.
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
      m = new THREE.Mesh(buildFishGeometry(sp), cookedMaterial(sp));
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
    browned(m, done);
  }

  // site: null for the old camp, 'house' for home, 'cabin' for the cabin boat, 'bothy' for the bothy,
  // or your camp's record.
  open(tab = 'cook', site = null) {
    this.site = site;
    this.packing = null;
    this.el.hidden = false;
    $('camp-title').textContent = this.cabin ? 'The cabin' : this.bothy ? 'The bothy' : this.posada ? 'Bar El Muelle' : this.house ? 'Home' : site ? site.name : 'Camp';
    const tabs = this.el.querySelectorAll('[data-tab]');
    for (const b of tabs) {
      if (b.dataset.tab === 'cook') b.textContent = this.cabin ? 'Galley' : this.bothy ? 'Stove & food' : this.house ? 'Kitchen' : site ? 'Stove & food' : 'Fire & food';
      if (b.dataset.tab === 'sleep') b.textContent = this.cabin || this.bothy ? 'Bunk' : this.posada ? 'Your room' : this.house ? 'Bed' : 'Sleep';
      if (b.dataset.tab === 'own') b.hidden = !this.own;
      if (b.dataset.tab === 'tackle') b.hidden = this.house && !this.shelf;
    }
    this.show((tab === 'own' && !this.own) || (tab === 'tackle' && this.house && !this.shelf) ? 'cook' : tab);
  }

  close() {
    this.el.hidden = true;
    this.packing = null;
  }

  show(tab) {
    this.tab = tab;
    for (const b of this.el.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
    for (const p of this.el.querySelectorAll('[data-pane]')) p.hidden = p.dataset.pane !== tab;
    this.render();
  }

  render() {
    if (!this.isOpen) return;
    // (Your camp may have been packed up from elsewhere.)
    if (this.own && !(this.state.camps || []).includes(this.site)) {
      this.hooks.close();
      return;
    }
    $('camp-sub').textContent = `${formatClock(this.state.hour)} · day ${this.state.day}${this.cabin ? ' · aboard' : this.bothy ? ' · up the Coldwater' : this.posada ? ' · Puerto Brasa' : this.house ? ' · home' : this.site ? ' · your camp' : ''}`;
    if (this.tab === 'cook') {
      if (this.house) this.renderKitchen();
      else if (this.site) this.renderStove();
      else this.renderCook();
    } else if (this.tab === 'own') this.renderOwn();
    else this.renderSleep();
  }

  belly() {
    const f = this.food;
    const belly = el('div', 'cp-row');
    const word = f.full > 80 ? 'Full' : f.full >= 40 ? 'Content' : f.full >= 15 ? 'Peckish' : 'Hungry';
    const bar = el('span', 'cp-bar');
    const fill = el('i');
    fill.style.width = `${Math.round(f.full)}%`;
    bar.append(fill);
    belly.append(el('strong', '', word), bar, el('span', 'cp-soft', this.wellFed ? 'Well fed: steady hands' : ''));
    return belly;
  }

  progress(text, done) {
    const row = el('div', 'cp-row');
    const pb = el('span', 'cp-bar warm');
    const pf = el('i');
    pf.style.width = `${Math.round(done * 100)}%`;
    pb.append(pf);
    row.append(el('p', '', text), pb, el('span', 'cp-soft', 'Hold T to wait'));
    return row;
  }

  renderCook() {
    const c = this.state.camp;
    const out = [];
    const fire = this.fireLevel;
    const left = c.fireUntil - this.abs();
    const fireRow = el('div', 'cp-row');
    fireRow.append(el('span', `cp-fire ${fire > 0.35 ? 'lit' : fire > 0 ? 'embers' : ''}`), el('p', '', fire > 0.35 ? `The fire is burning: about ${Math.max(1, Math.round(left))} h left.` : fire > 0 ? 'Just embers now, still warm.' : 'The fire ring is cold.'));
    fireRow.append(button(fire > 0.35 ? 'Add a log' : 'Light the fire', () => this.lightFire(fire > 0.35 ? 1.5 : 3)));
    out.push(fireRow, this.belly());

    out.push(el('h3', '', 'On the grill'));
    if (c.cooking) out.push(this.progress(`${fishById[c.cooking.id].name}, sizzling.`, clamp((this.abs() - c.cooking.start) / c.cooking.dur, 0, 1)));
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
      if (k.cooked) {
        row.append(el('p', '', `${sp.meal.name}, ${k.size} cm`), el('span', 'cp-soft', 'cooked, wrapped in paper'), button('Eat', () => this.eatFromCreel(i)));
      } else {
        row.append(el('p', '', `${sp.name}, ${k.size} cm`), el('span', 'cp-soft', sp.meal.name));
        const b = button('Grill it', () => this.cook(i));
        b.disabled = !!c.cooking;
        if (c.cooking) b.title = 'The grill is busy';
        row.append(b);
      }
      out.push(row);
    });
    const oat = el('div', 'cp-row');
    oat.append(el('p', 'cp-soft', 'A tin of oatcakes lives in the tent.'), button('Have an oatcake', () => this.oatcake(), 'quiet'));
    out.push(oat);
    $('camp-cook').replaceChildren(...out);
  }

  /* ---------------- your own camp ---------------- */

  act(r, msg) {
    if (!r.ok) {
      this.hooks.toast(r.why, 4);
      return;
    }
    if (msg) this.hooks.toast(msg, 3);
    this.hooks.changed();
    this.render();
  }

  // A piece of camping gear that isn't at this camp: where it is, and a way to set it up here if
  // it's in your backpack.
  missing(camp, k, what) {
    const row = el('div', 'cp-row');
    const where = this.hooks.kit.where(k);
    row.append(el('p', 'cp-soft', `No ${what} here: ${where.charAt(0).toLowerCase()}${where.slice(1)}.`));
    if (this.hooks.kit.at(k) === 'pack') row.append(button('Set it up here', () => this.act(this.hooks.kit.move(k, camp), `The ${what} is set up at ${camp.name}.`), 'quiet'));
    return row;
  }

  renderStove() {
    const camp = this.site, out = [];
    const ck = camp.cooking;
    const hasStove = this.hooks.kit.has(camp, 'stove'), hasBox = this.hooks.kit.has(camp, 'coolbox');
    if (hasStove || ck) {
      const stove = el('div', 'cp-row');
      stove.append(el('span', `cp-stove ${ck ? 'lit' : ''}`), el('p', '', ck ? 'The stove hisses under the pan.' : 'The little gas stove. It lights when something goes in the pan.'));
      out.push(stove);
    } else out.push(this.missing(camp, 'stove', 'stove'));
    out.push(this.belly());

    out.push(el('h3', '', 'In the pan'));
    if (ck) out.push(this.progress(`${fishById[ck.id].name}, sizzling.`, clamp((this.abs() - ck.start) / ck.dur, 0, 1)));
    else out.push(el('p', 'cp-soft', 'Nothing cooking.'));
    camp.store.meals.forEach((m, i) => {
      const sp = fishById[m.id];
      const row = el('div', 'cp-row');
      row.append(el('p', '', `${sp.meal.name} (${m.size} cm), ready.`),
        button('Eat', () => { camp.store.meals.splice(i, 1); this.eatMeal(m); }),
        button('Wrap it for later', () => this.act(take(this.state, camp, i, true), 'Wrapped in paper and into your creel.'), 'quiet'));
      out.push(row);
    });

    const cook = (from, i) => {
      if (!hasStove) return this.act({ ok: false, why: 'There’s no stove at this camp.' });
      const r = startCooking(this.state, camp, from, i, this.abs());
      if (r.ok) {
        this.hooks.audio.sizzleStart?.();
        this.act(r, `The ${fishById[r.fish.id].name.toLowerCase()} goes in the pan. About half an hour.`);
      } else this.act(r);
    };
    out.push(el('h3', '', hasBox ? `Cool box (${camp.store.fish.length} of ${COOLBOX})` : 'Cool box'));
    if (!hasBox) out.push(this.missing(camp, 'coolbox', 'cool box'));
    else if (!camp.store.fish.length) out.push(el('p', 'cp-soft', 'Empty. Fish you keep can wait here on ice, beyond what your creel holds.'));
    camp.store.fish.forEach((f, i) => {
      const sp = fishById[f.id];
      const row = el('div', 'cp-row');
      const b = button('Cook', () => cook('cooler', i));
      b.disabled = !!ck || !hasStove;
      row.append(el('p', '', `${sp.name}, ${f.size} cm`), b, button('To your creel', () => this.act(take(this.state, camp, i)), 'quiet'));
      out.push(row);
    });

    out.push(el('h3', '', `Your creel (${this.state.keep.length} of ${PACK.fish})`));
    if (!this.state.keep.length) out.push(el('p', 'cp-soft', 'Empty.'));
    this.state.keep.forEach((f, i) => {
      const sp = fishById[f.id];
      const row = el('div', 'cp-row');
      if (f.cooked) {
        row.append(el('p', '', `${sp.meal.name}, ${f.size} cm`), el('span', 'cp-soft', 'cooked'), button('Eat', () => this.eatFromCreel(i)));
        if (hasBox || hasStove) row.append(button('Leave it here', () => this.act(stow(this.state, camp, i)), 'quiet'));
      } else {
        const b = button('Cook', () => cook('creel', i));
        b.disabled = !!ck || !hasStove;
        row.append(el('p', '', `${sp.name}, ${f.size} cm`), b);
        if (hasBox) row.append(button('Into the cool box', () => this.act(stow(this.state, camp, i)), 'quiet'));
      }
      out.push(row);
    });
    const oat = el('div', 'cp-row');
    oat.append(el('p', 'cp-soft', 'A tin of oatcakes lives in the tent.'), button('Have an oatcake', () => this.oatcake(), 'quiet'));
    out.push(oat);
    $('camp-cook').replaceChildren(...out);
  }

  renderOwn() {
    const camp = this.site, out = [];
    // Its name.
    const nameRow = el('div', 'cp-row cp-name');
    const input = el('input');
    input.type = 'text';
    input.maxLength = 40;
    input.value = camp.name;
    input.setAttribute('aria-label', 'Your camp’s name');
    const rename = () => {
      const n = cleanName(input.value);
      if (!n || n === camp.name) return;
      camp.name = n;
      $('camp-title').textContent = n;
      this.hooks.changed();
      this.hooks.toast(`Your camp is called ${n} now.`, 3);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') rename(); });
    input.addEventListener('change', rename);
    nameRow.append(el('strong', '', 'Name'), input, button('Rename', rename, 'quiet'));
    out.push(nameRow);

    const chips = (label, opts, current, pick) => {
      const row = el('div', 'cp-row cp-chips');
      row.append(el('strong', '', label));
      const g = el('div', 'cp-choice');
      g.setAttribute('role', 'radiogroup');
      g.setAttribute('aria-label', label);
      for (const [id, text] of opts) {
        const b = button(text, () => { pick(id); this.hooks.changed(); this.render(); }, `chip${id === current ? ' on' : ''}`);
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', id === current);
        g.append(b);
      }
      row.append(g);
      return row;
    };
    out.push(chips('Tent', Object.entries(TENTS).map(([id, t]) => [id, t.name]), camp.tent, (id) => { camp.tent = id; }));
    out.push(chips('Lantern', [['auto', 'After dark'], ['on', 'Always'], ['off', 'Off']], camp.lantern, (id) => { camp.lantern = id; }));
    const deco = el('div', 'cp-row cp-chips');
    deco.append(el('strong', '', 'Put out'));
    const dg = el('div', 'cp-choice');
    for (const [k, text] of Object.entries(DECOR)) {
      if (DECOR_UNLOCK[k] && !this.state.unlocks?.[DECOR_UNLOCK[k]]) continue;
      const b = button(text, () => { camp.deco[k] = !camp.deco[k]; this.hooks.changed(); this.render(); }, `chip${camp.deco[k] ? ' on' : ''}`);
      b.setAttribute('aria-pressed', camp.deco[k]);
      dg.append(b);
    }
    deco.append(dg);
    out.push(deco);
    out.push(chips('On the map', [['yes', 'Marked'], ['no', 'Not marked']], camp.marked ? 'yes' : 'no', (id) => { camp.marked = id === 'yes'; }));

    const p = camp.pitched;
    out.push(el('p', 'cp-soft', `Pitched on day ${p.day} at ${formatClock(p.hour)}${camp.visits ? `; you’ve been back ${camp.visits} time${camp.visits === 1 ? '' : 's'}` : ''}. In the cool box: ${camp.store.fish.length} fish${camp.store.meals.length ? `, and ${camp.store.meals.length} cooked` : ''}.`));
    const row = el('div', 'cp-row cp-acts');
    row.append(button('Open the journal', () => this.hooks.openJournal()), button('Plan a trip', () => this.hooks.planTrip()));
    out.push(row);

    // The camping gear: what's here, and what's in your backpack to set up (or to take away).
    out.push(el('h3', '', 'Camping gear'));
    for (const [k, what] of [['tent', 'tent'], ['stove', 'stove'], ['coolbox', 'cool box']]) {
      const r = el('div', 'cp-row');
      const here = this.hooks.kit.has(camp, k);
      r.append(el('p', '', `${what.charAt(0).toUpperCase()}${what.slice(1)}: ${here ? 'here' : this.hooks.kit.where(k).charAt(0).toLowerCase() + this.hooks.kit.where(k).slice(1)}`));
      if (here && k !== 'tent') r.append(button('Into your backpack', () => this.act(this.hooks.kit.move(k, 'pack'), `The ${what} is in your backpack.`), 'quiet'));
      else if (!here && this.hooks.kit.at(k) === 'pack') r.append(button('Set it up here', () => this.act(this.hooks.kit.move(k, camp), `The ${what} is set up at ${camp.name}.`), 'quiet'));
      out.push(r);
    }

    out.push(el('h3', '', 'Moving on'));
    if (this.packing) out.push(this.renderPacking(camp));
    else {
      const mv = el('div', 'cp-row cp-acts');
      mv.append(
        button('Move this camp…', () => this.hooks.moveCamp(camp)),
        button('Pack it up…', () => this.startPacking(camp), 'quiet'),
      );
      out.push(mv, el('p', 'cp-soft', 'Moving keeps everything just as it is (the cool box comes too). Packing up puts the tent and the rest of the camping gear in your backpack, and the cool box’s fish in your creel.'));
    }
    $('camp-own').replaceChildren(...out);
  }

  startPacking(camp) {
    const plan = packPlan(this.state, camp);
    if (plan.cooking) {
      this.hooks.toast('Something is still in the pan: let it finish (hold T), then pack up.', 5);
      return;
    }
    if (plan.fits) {
      this.hooks.packUp(camp, []);
      return;
    }
    this.packing = new Set();
    this.render();
  }

  // Not everything fits: say so, and let you choose (nothing goes unless you say).
  renderPacking(camp) {
    const box = el('div', 'cp-pack');
    const plan = packPlan(this.state, camp);
    const need = Math.max(0, plan.fish + plan.meals - plan.free - this.packing.size);
    box.append(el('p', '', `Your creel has room for ${plan.free} more fish, and the cool box holds ${plan.fish}${plan.meals ? ` and ${plan.meals} cooked` : ''}. A full cool box is too heavy to carry with the tent, so the fish travel in your creel.`));
    box.append(el('p', 'cp-soft', need ? `Choose ${need} more to let go, cook some here first, or keep the camp where it is.` : 'Ready: the rest will fit in your creel.'));
    camp.store.fish.forEach((f, i) => {
      const lab = el('label', 'cp-check');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = this.packing.has(i);
      cb.addEventListener('change', () => {
        if (cb.checked) this.packing.add(i);
        else this.packing.delete(i);
        this.render();
      });
      lab.append(cb, el('span', '', `Let go: ${fishById[f.id].name}, ${f.size} cm`));
      box.append(lab);
    });
    const acts = el('div', 'cp-row cp-acts');
    const go = button(this.packing.size ? `Let ${this.packing.size} go and pack up` : 'Pack up', () => this.hooks.packUp(camp, [...this.packing]));
    go.disabled = need > 0;
    acts.append(go, button('Cook some here', () => { this.packing = null; this.show('cook'); }, 'quiet'), button('Keep the camp', () => { this.packing = null; this.render(); }, 'quiet'));
    box.append(acts);
    return box;
  }

  // Home's kitchen: cook a fish from your creel and sit down to it, or eat one cooked earlier.
  renderKitchen() {
    const out = [this.belly()];
    out.push(el('h3', '', `Your creel (${this.state.keep.length} of ${PACK.fish})`));
    if (!this.state.keep.length) out.push(el('p', 'cp-soft', this.bothy ? 'Empty. The Coldwater’s trout and grayling are just down the slope.' : this.posada ? 'Empty. Bring in a parrotfish and the kitchen will show you how they cook them here.' : 'Empty. Fish you keep come home in your creel.'));
    this.state.keep.forEach((f, i) => {
      const sp = fishById[f.id];
      const row = el('div', 'cp-row');
      if (f.cooked) row.append(el('p', '', `${sp.meal.name}, ${f.size} cm`), el('span', 'cp-soft', 'cooked earlier'), button('Eat', () => this.eatFromCreel(i)));
      else {
        row.append(el('p', '', `${sp.name}, ${f.size} cm`), el('span', 'cp-soft', sp.meal.name), button('Cook and eat', () => {
          const k = this.state.keep[i];
          if (!k) return;
          this.state.keep.splice(i, 1);
          this.hooks.outcome?.(k.logId, 'cooked');
          this.hooks.passTime?.(COOK_HOURS);
          this.eatMeal(k);
        }));
      }
      out.push(row);
    });
    const oat = el('div', 'cp-row');
    oat.append(el('p', 'cp-soft', this.bothy ? 'Someone has left a tin of oatcakes on the shelf, for whoever comes next.' : this.posada ? 'There’s always a bowl of little wrinkled potatoes and a pot of red mojo on the bar.' : 'The oatcake tin is on the shelf.'), button(this.posada ? 'Have some potatoes' : 'Have an oatcake', () => this.oatcake(), 'quiet'));
    out.push(oat);
    $('camp-cook').replaceChildren(...out);
  }

  renderSleep() {
    const out = [];
    out.push(el('p', 'cp-lead', this.cabin ? 'Turn in to the bunk and sleep until…' : this.bothy ? 'Unroll your bag on the sleeping platform and sleep until…' : this.posada ? 'Climb the stairs to your room over the harbour and sleep until…' : this.house ? 'Go to bed and sleep until…' : 'Crawl into the tent and sleep until…'));
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
    out.push(el('p', 'cp-soft', this.cabin
      ? 'While you sleep the world goes on: the light changes, the weather may turn and the fish move to where the new hour suits them. The boat rides at her anchor (or alongside) through the night, and the battery charges.'
      : `While you sleep the world goes on: the light changes, the weather may turn${this.bothy ? ', the stove burns down' : this.house ? '' : ', the fire burns down'} and the fish move to where the new hour suits them. Your boats${this.house ? ', the car and your camp' : ''} stay where you left them.`));
    $('camp-sleep').replaceChildren(...out);
  }
}

export { COOLBOX, MEALS_MAX };
