import { RODS, TACKLE, KIND_NAMES, PACK, fits } from './tackle.js';
import { FISH, fishById } from './fish.js';
import { setupsFor } from './guide.js';
import { HOME_WORDS } from './trip.js';
import { heightAt, CAR_PARKS, LANES, PLACES } from './world/terrain.js';
import { formatClock } from './world/sky.js';
import {
  KIT, KIT_IDS, CAR_HOLD, DESTS, DEST_IDS, LOADOUT_MAX, statusOf, moveKit, moveToCar, unloadCar, packSetup, loadSetup,
  snapshot, applyLoadout, suggestions, departureCheck, essentials, speciesAt, habitatsAt, driveMinutes, campOfKit,
} from './outing.js';
import { fuelCheck, carNeeds, tankWords, canWords, litres, moveCan, CAN_PLACES } from './fuel.js';

// The workbench in the garage: planning an outing, step by step but never in a fixed order.
// What for (fishing, camping, exploring and photographs), where (the places the car can reach),
// what's there (from the map, the fish actually living there, the boats, the camping, the
// weather right now), the gear (the tackle wall's setups and your own, the camping gear), the
// packing list with a short check, and off you go: drive yourself, or let the drive go by. You
// can skip all of it: "same again" takes last time's place and packing list.
//
// Alongside it, OutingSheet: the smaller sheet for the car's boot, the camping shelf, the wall of
// photographs at home, and the list of places to drive to from the car.

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function btn(text, run, cls = 'pk-btn') {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    run(e);
  });
  return b;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const listWords = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const minsWords = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim());

export const STEPS = [
  { id: 'what', name: 'What for' },
  { id: 'where', name: 'Where' },
  { id: 'about', name: 'About it' },
  { id: 'gear', name: 'Gear' },
  { id: 'list', name: 'Packing list' },
  { id: 'go', name: 'Off you go' },
];

// A little map of a destination: the land and water from the height map, the lanes, the car park
// and the place itself. Not yet explored: faded, with the car park (the way in) still marked.
export function drawDestMap(ctx, w, h, id, { explored = true, camp = null } = {}) {
  const D = DESTS[id], P = CAR_PARKS[id];
  const place = PLACES.find((q) => q.id === D.place);
  const cx = (P.x + place.x) / 2, cz = (P.z + place.z) / 2;
  const span = Math.max(150, Math.hypot(P.x - place.x, P.z - place.z) * 2.6), k = w / span;
  const X = (x) => (x - cx) * k + w / 2, Z = (z) => (z - cz) * k + h / 2;
  const step = 3;
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      const hh = heightAt(cx + (px - w / 2) / k, cz + (py - h / 2) / k);
      ctx.fillStyle = hh < -4 ? '#8fb4bf' : hh < 0 ? '#b3d0d2' : hh < 2 ? '#e6d8b0' : hh < 7 ? '#cfd3a0' : hh < 14 ? '#b9c48c' : '#a9b07a';
      ctx.fillRect(px, py, step, step);
    }
  }
  ctx.strokeStyle = '#8a5a36';
  ctx.lineWidth = 2;
  for (const L of LANES) {
    ctx.beginPath();
    L.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
    ctx.stroke();
  }
  if (!explored) {
    ctx.fillStyle = 'rgba(239,228,201,0.6)';
    ctx.fillRect(0, 0, w, h);
  }
  // The car park (the way in, known either way), the place, and your camp.
  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(X(P.x) - 4, Z(P.z) - 4, 8, 8);
  ctx.fillStyle = '#efe4c9';
  ctx.font = '700 8px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('P', X(P.x), Z(P.z) + 3);
  if (explored) {
    ctx.beginPath();
    ctx.arc(X(place.x), Z(place.z), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#a5482f';
    ctx.fill();
  }
  if (camp) {
    ctx.fillStyle = '#4f6b3a';
    ctx.beginPath();
    ctx.moveTo(X(camp.x), Z(camp.z) - 6);
    ctx.lineTo(X(camp.x) + 5, Z(camp.z) + 4);
    ctx.lineTo(X(camp.x) - 5, Z(camp.z) + 4);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(58,42,28,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}

function mapCanvas(id, w, h, opts) {
  const c = el('canvas', 'wb-map');
  c.width = w;
  c.height = h;
  // (Drawn a moment later, so opening the sheet is instant.)
  requestAnimationFrame(() => drawDestMap(c.getContext('2d'), w, h, id, opts));
  return c;
}

export class Workbench {
  // hooks: { carHome(), carWhere() → words, campDest(camp), boatsNear(id) → [lines], weather(id) →
  //   [lines], openGuide(spId), openPack(), openMap(id), changed(msg), depart(id, how),
  //   close(), eco, habitat }
  constructor(state, hooks) {
    this.state = state;
    this.h = hooks;
    this.step = 'what';
    $('bench-close').addEventListener('click', () => hooks.close());
    $('bench').addEventListener('click', (e) => { if (e.target === $('bench')) hooks.close(); });
  }

  get plan() { return this.state.outing.plan; }
  get isOpen() { return !$('bench').hidden; }

  open(step = null) {
    $('bench').hidden = false;
    this.step = step || (this.plan.dest ? 'list' : 'what');
    this.render();
  }

  close() {
    $('bench').hidden = true;
  }

  go(step) {
    this.step = step;
    this.msg = '';
    this.render();
    $('bench-main').scrollTop = 0;
  }

  changed(msg) {
    this.msg = msg || '';
    this.h.changed(msg);
    this.render();
  }

  render() {
    if (!this.isOpen) return;
    const s = this.state;
    $('bench-sub').textContent = `${formatClock(s.hour)} · day ${s.day} · ${this.h.carHome() ? 'the car is on the drive' : `the car is ${this.h.carWhere()}`}`;
    const nav = $('bench-steps');
    nav.replaceChildren(...STEPS.map((st, i) => {
      const b = btn(`${i + 1}. ${st.name}`, () => this.go(st.id), `wb-step${st.id === this.step ? ' on' : ''}`);
      b.setAttribute('aria-current', st.id === this.step ? 'step' : 'false');
      return b;
    }));
    const main = $('bench-main');
    const out = this[`render_${this.step}`]();
    // Back and on, at the foot of each step.
    const i = STEPS.findIndex((x) => x.id === this.step);
    const foot = el('div', 'wb-foot');
    if (i > 0) foot.append(btn(`← ${STEPS[i - 1].name}`, () => this.go(STEPS[i - 1].id), 'pk-btn quiet'));
    if (i < STEPS.length - 1) foot.append(btn(`${STEPS[i + 1].name} →`, () => this.go(STEPS[i + 1].id)));
    // What the last button did, said aloud for screen readers too.
    const st = el('p', 'wb-status', this.msg || '');
    st.setAttribute('role', 'status');
    main.replaceChildren(...out, st, foot);
    this.renderSide();
  }

  // The plan so far, always in view.
  renderSide() {
    const s = this.state, p = this.plan, D = DESTS[p.dest];
    const side = $('bench-side');
    const acts = [p.fish && 'fishing', p.camp && 'camping overnight', p.explore && 'exploring & photographs'].filter(Boolean);
    const target = p.target?.sp ? fishById[p.target.sp].name : p.target?.kind ? KIND_NAMES[p.target.kind] : null;
    const rows = [
      el('h3', '', 'The plan'),
      el('p', '', acts.length ? cap(listWords(acts)) : 'Nothing chosen yet.'),
    ];
    if (p.fish) rows.push(el('p', 'wb-faint', target ? `For: ${target}` : 'For: whatever’s about'));
    rows.push(el('p', '', D ? `To ${D.name} (${D.drive ? 'drive yourself, or let the drive go by' : 'by road'}: ${minsWords(D.mins)})` : 'Where: not chosen'));
    const g = s.gear, car = s.equip.car;
    rows.push(el('h4', '', 'Backpack'), el('p', 'wb-faint', `${g.pack.rods.map((r) => RODS[r].short.toLowerCase()).join(', ')} · ${g.pack.items.length} of ${PACK.items} tackle${KIT_IDS.filter((k) => s.equip.kit[k] === 'pack').map((k) => ` · ${KIT[k].short}`).join('')}`));
    rows.push(el('h4', '', 'Car'), el('p', 'wb-faint', car.rods.length || car.items.length || KIT_IDS.some((k) => s.equip.kit[k] === 'car')
      ? [car.rods.length && `${car.rods.length} rod${car.rods.length === 1 ? '' : 's'}`, car.items.length && `${car.items.length} tackle`, ...KIT_IDS.filter((k) => s.equip.kit[k] === 'car').map((k) => KIT[k].short)].filter(Boolean).join(' · ')
      : 'Empty'));
    const check = checkAll(s, p, { campDest: this.h.campDest, carHome: this.h.carHome() });
    const warns = check.filter((l) => l.level === 'warn').length;
    rows.push(el('p', warns ? 'wb-warnline' : 'wb-okline', warns ? `${warns} thing${warns === 1 ? '' : 's'} to look at on the packing list` : 'Nothing missing that I can see'));
    side.replaceChildren(...rows);
  }

  /* ---------------- 1. what for ---------------- */
  render_what() {
    const s = this.state, p = this.plan, out = [];
    out.push(el('p', 'wb-lead', 'What’s this outing for? Choose as many as you like.'));
    const cards = el('div', 'wb-acts');
    const card = (key, title, text) => {
      const b = btn('', () => { p[key] = !p[key]; this.changed(); }, `wb-act${p[key] ? ' on' : ''}`);
      b.setAttribute('aria-pressed', p[key]);
      b.append(el('b', '', title), el('span', '', text));
      cards.append(b);
    };
    card('fish', 'Fishing', 'The rods, the tackle and somewhere with fish in it.');
    card('camp', 'Camping overnight', 'Pitch the tent, cook, sleep to the hour you choose, fish at dawn.');
    card('explore', 'Exploring & photographs', 'Landmarks, the notices, the wreck, a picture to keep.');
    out.push(cards);
    if (p.fish) {
      out.push(el('h3', '', 'Fishing for'));
      const chips = el('div', 'cp-choice wb-chips');
      const chip = (text, on, run) => {
        const b = btn(text, () => { run(); this.changed(); }, `chip${on ? ' on' : ''}`);
        b.setAttribute('aria-pressed', on);
        chips.append(b);
      };
      chip('Whatever’s about', !p.target, () => { p.target = null; });
      for (const k of ['lure', 'float', 'bottom', 'jig', 'fly', 'ledger']) chip(KIND_NAMES[k], p.target?.kind === k, () => { p.target = { kind: k }; });
      out.push(chips);
      // A particular fish: the ones you've met (the field guide keeps the rest a surprise).
      const met = FISH.filter((f) => !f.retired && !f.life?.observe && (s.fish[f.id] || s.observed?.[f.id])).sort((a, b) => a.name.localeCompare(b.name));
      const sel = el('select', 'wb-select');
      sel.setAttribute('aria-label', 'A particular fish');
      sel.append(new Option(met.length ? 'Or a particular fish…' : 'Fish you’ve met will be listed here', ''));
      for (const f of met) sel.append(new Option(f.name, f.id, false, p.target?.sp === f.id));
      sel.addEventListener('change', () => {
        p.target = sel.value ? { sp: sel.value } : null;
        this.changed();
      });
      out.push(sel);
      if (p.target?.sp) {
        const rec = setupsFor(fishById[p.target.sp])[0];
        const row = el('div', 'cp-row');
        row.append(el('p', 'wb-faint', rec ? `The field guide suggests ${TACKLE[rec.item].on} on the ${RODS[rec.rod].short.toLowerCase()}.` : 'The field guide has no setup for it.'), btn('Open its page', () => this.h.openGuide(p.target.sp), 'pk-btn quiet'));
        out.push(row);
      }
    }
    // Same again: last time's place and packing list, in one go.
    const o = s.outing;
    if (o.last && o.lastDest) {
      out.push(el('h3', '', 'Same again?'));
      const row = el('div', 'cp-row');
      row.append(el('p', '', `${DESTS[o.lastDest].name}, with what you took last time (${o.last.pack.rods.map((r) => RODS[r].short.toLowerCase()).join(' and ')}${KIT_IDS.some((k) => o.last.kit[k] !== 'home') ? ', and the camping gear' : ''}).`),
        btn('Same again', () => {
          const r = applyLoadout(s, o.last, { carHome: this.h.carHome() });
          p.dest = o.lastDest;
          this.changed(r.notes.length ? r.notes.join(' ') : 'Packed as last time.');
          this.go('list');
        }));
      out.push(row);
    }
    return out;
  }

  /* ---------------- 2. where ---------------- */
  render_where() {
    const s = this.state, p = this.plan, out = [];
    out.push(el('p', 'wb-lead', 'Where the car can take you. The lanes reach the first three (you can drive yourself); the others are by road.'));
    const grid = el('div', 'wb-dests');
    for (const id of DEST_IDS) {
      const D = DESTS[id], explored = !!s.places[D.place];
      const camp = (s.camps || []).find((c) => this.h.campDest(c) === id);
      const card = btn('', () => { p.dest = id; this.changed(); this.go('about'); }, `wb-dest${p.dest === id ? ' on' : ''}`);
      card.append(mapCanvas(id, 220, 130, { explored, camp }));
      const t = el('div', 'wb-dest-t');
      t.append(el('b', '', D.name), el('span', '', `${D.kind} · ${D.drive ? 'drive yourself' : 'by road'}, ${minsWords(driveMinutes('home', id))}`));
      const tags = el('div', 'wb-tags');
      tags.append(el('span', explored ? 'wb-tag' : 'wb-tag new', explored ? 'Explored' : 'Not yet explored'));
      if (camp) tags.append(el('span', 'wb-tag camp', `${camp.name} is here`));
      if (s.car.at === id) tags.append(el('span', 'wb-tag', 'The car is parked here'));
      t.append(tags);
      card.append(t);
      grid.append(card);
    }
    out.push(grid);
    out.push(el('p', 'wb-faint', 'Gannet Isle, Puffin Cove and the open sea are only reached by boat. Your boats stay where you left them (see “About it”).'));
    return out;
  }

  /* ---------------- 3. about it ---------------- */
  render_about() {
    const s = this.state, p = this.plan, D = DESTS[p.dest], out = [];
    if (!D) {
      out.push(el('p', 'wb-lead', 'Choose where to go first.'), btn('Choose a place', () => this.go('where')));
      return out;
    }
    const explored = !!s.places[D.place];
    const camp = (s.camps || []).find((c) => this.h.campDest(c) === p.dest);
    const top = el('div', 'wb-about');
    top.append(mapCanvas(p.dest, 360, 220, { explored, camp }));
    const intro = el('div', '');
    intro.append(el('h3', '', D.name), el('p', 'wb-faint', `${D.kind}${explored ? '' : ' · not yet explored'}`), el('p', '', D.terrain), el('p', '', D.access));
    const mins = driveMinutes(s.car.at || 'home', p.dest);
    intro.append(el('p', 'wb-faint', D.drive
      ? `Drive yourself (the clock runs as you drive), or let the drive go by: about ${minsWords(mins)} pass.`
      : `By road: about ${minsWords(mins)} pass on the way.`));
    top.append(intro);
    out.push(top);

    out.push(el('h3', '', 'The water'));
    const hab = habitatsAt(this.h.habitat, p.dest).map((t) => HOME_WORDS[t] || t).slice(0, 6);
    out.push(el('p', '', `${D.water === 'fresh' ? 'Fresh water' : D.water === 'brackish' ? 'Brackish water (salt and fresh mixing)' : 'Salt water'}${hab.length ? `: ${listWords(hab)}` : ''}.`));
    const sp = speciesAt(this.h.eco, p.dest, { ...(s.observed || {}), ...s.fish });
    if (!explored) out.push(el('p', 'wb-faint', 'You haven’t fished here yet: what lives here is yours to find out.'));
    else {
      if (!sp.named.length) out.push(el('p', 'wb-faint', 'Nothing you’ve met lives here yet.'));
      const list = el('div', 'wb-fish');
      for (const f of sp.named.slice(0, 12)) {
        const rec = setupsFor(f.sp)[0];
        const row = el('div', 'wb-fishrow');
        row.append(el('b', '', f.sp.name), el('span', 'wb-faint', f.act > 0.55 ? 'busy at this hour' : f.act > 0.3 ? 'about' : 'quiet at this hour'));
        if (rec) row.append(el('span', 'wb-faint', `${TACKLE[rec.item].on}, ${RODS[rec.rod].short.toLowerCase()}`));
        row.append(btn('Field guide', () => this.h.openGuide(f.sp.id), 'pk-btn quiet small'), btn('Fish for it', () => { p.fish = true; p.target = { sp: f.sp.id }; this.changed(); }, 'pk-btn quiet small'));
        list.append(row);
      }
      out.push(list);
      if (sp.unknown) out.push(el('p', 'wb-faint', `…and ${sp.unknown} kind${sp.unknown === 1 ? '' : 's'} you haven’t met yet.`));
      out.push(el('p', 'wb-faint', 'Busy or quiet is the fish’s own mood at this hour; it never promises a bite.'));
    }

    out.push(el('h3', '', 'Boats'), el('p', '', D.boats));
    for (const line of this.h.boatsNear(p.dest)) out.push(el('p', 'wb-faint', line));
    out.push(el('h3', '', 'Camping'), el('p', '', D.camp));
    if (camp) out.push(el('p', 'wb-faint', `${camp.name} is pitched here, with ${camp.store.fish.length} fish in the cool box.`));
    out.push(el('h3', '', 'Exploring & photographs'), el('p', '', D.explore));
    out.push(el('h3', '', 'Right now'));
    for (const line of this.h.weather(p.dest)) out.push(el('p', '', line));
    out.push(el('p', 'wb-faint', 'That’s the weather as it is now, not a forecast: it can change while you’re out.'));
    const acts = el('div', 'cp-row cp-acts');
    acts.append(btn('Show it on the map', () => this.h.openMap(p.dest), 'pk-btn quiet'));
    out.push(acts);
    return out;
  }

  /* ---------------- 4. gear ---------------- */
  render_gear() {
    const s = this.state, p = this.plan, out = [];
    const carHome = this.h.carHome();
    out.push(el('p', 'wb-lead', 'Pack your backpack, and load the car with spare tackle and the camping gear. Everything here is yours already; nothing is bought.'));
    // What's carried and loaded now.
    const g = s.gear, car = s.equip.car;
    const tackle = el('div', 'wb-cols');
    const col = (title, rods, items, note) => {
      const c = el('div', 'wb-col');
      c.append(el('h4', '', title));
      if (!rods.length && !items.length) c.append(el('p', 'wb-faint', note));
      for (const r of rods) c.append(el('p', '', `${RODS[r].name}${g.pack.rods.includes(r) && TACKLE[g.rig[r]] && fits(RODS[r], TACKLE[g.rig[r]]) ? ` · ${TACKLE[g.rig[r]].short.toLowerCase()} tied on` : ''}`));
      if (items.length) c.append(el('p', 'wb-faint', items.map((i) => TACKLE[i].short).join(', ')));
      return c;
    };
    tackle.append(col(`Backpack (${g.pack.rods.length}/${PACK.rods} rods, ${g.pack.items.length}/${PACK.items} tackle)`, g.pack.rods, g.pack.items, 'Empty.'));
    tackle.append(col(`In the car (${car.rods.length}/${CAR_HOLD.rods} rods, ${car.items.length}/${CAR_HOLD.items} tackle)`, car.rods, car.items, carHome ? 'Nothing loaded.' : `The car is ${this.h.carWhere()}.`));
    if (p.fish) {
      out.push(el('h3', '', 'Fishing tackle'), tackle);
      const tools = el('div', 'cp-row cp-acts');
      tools.append(btn('Open the tackle wall…', () => this.h.openPack()));
      if (car.rods.length || car.items.length) tools.append(btn('Take the car’s tackle out', () => { unloadTackle(s); this.changed('The car’s tackle is back on the wall.'); }, 'pk-btn quiet'));
      out.push(tools);
      out.push(el('h4', '', 'Setups that suit'));
      const sugg = suggestions(s, p).slice(0, 6);
      if (!sugg.length) out.push(el('p', 'wb-faint', 'Choose a place or a fish, and the setups that suit them show here.'));
      for (const x of sugg) {
        const row = el('div', 'wb-setup');
        const inPack = x.rods.every((r) => g.pack.rods.includes(r)) && x.items.every((i) => g.pack.items.includes(i));
        const t = el('div', '');
        t.append(el('b', '', `${x.name}${x.own ? ' (yours)' : ''}`), el('span', 'wb-faint', x.note || `${x.rods.map((r) => RODS[r].short.toLowerCase()).join(' and ')}: ${x.items.map((i) => TACKLE[i].short.toLowerCase()).join(', ')}`));
        row.append(t);
        const a = el('div', 'wb-setup-acts');
        if (inPack) a.append(el('span', 'wb-tag', 'In your backpack'));
        else a.append(btn('Pack it', () => { packSetup(s, x); this.changed(`Packed ${x.name} in your backpack.`); }, 'pk-btn small'));
        if (carHome) a.append(btn('Load as spare', () => { const r = loadSetup(s, x); this.changed(r.words); }, 'pk-btn quiet small'));
        row.append(a);
        out.push(row);
      }
    } else {
      out.push(el('h3', '', 'Fishing tackle'), el('p', 'wb-faint', 'Not fishing this time. You always carry one rod anyway (it weighs nothing).'), tackle);
    }
    // Camping gear: where each piece is, and where it could go.
    out.push(el('h3', '', 'Camping gear'));
    out.push(kitRows(s, { carHome, here: 'home', changed: (m) => this.changed(m) }));
    out.push(el('h3', '', 'Camera'), el('p', '', 'Always in your pocket: photo mode wherever you are, and a picture of any catch.'));
    out.push(el('p', 'wb-faint', `The backpack carries ${PACK.rods} rods and ${PACK.items} kinds of tackle (and the camping gear); the boot holds ${CAR_HOLD.rods} more rods and ${CAR_HOLD.items} more tackle besides. What’s left stays on the tackle wall.`));
    return out;
  }

  /* ---------------- 5. packing list ---------------- */
  render_list() {
    const s = this.state, p = this.plan, out = [];
    const carHome = this.h.carHome();
    const g = s.gear, car = s.equip.car;
    const cols = el('div', 'wb-cols three');
    const col = (title, lines) => {
      const c = el('div', 'wb-col');
      c.append(el('h4', '', title));
      for (const l of lines.length ? lines : ['Nothing']) c.append(el('p', lines.length ? '' : 'wb-faint', l));
      return c;
    };
    const kitIn = (where) => KIT_IDS.filter((k) => s.equip.kit[k] === where).map((k) => KIT[k].name);
    cols.append(col('Carried (backpack)', [...g.pack.rods.map((r) => `${RODS[r].name}${TACKLE[g.rig[r]] && fits(RODS[r], TACKLE[g.rig[r]]) ? `, ${TACKLE[g.rig[r]].short.toLowerCase()} tied on` : ''}`), ...(g.pack.items.length ? [g.pack.items.map((i) => TACKLE[i].short).join(', ')] : []), ...kitIn('pack'), 'Camera']));
    cols.append(col('Loaded (car)', [...car.rods.map((r) => RODS[r].name), ...(car.items.length ? [car.items.map((i) => TACKLE[i].short).join(', ')] : []), ...kitIn('car')]));
    const pitched = KIT_IDS.filter((k) => s.equip.kit[k].startsWith('camp:')).map((k) => `${KIT[k].name} (at ${campOfKit(s, k)?.name || 'your camp'})`);
    cols.append(col('Staying behind', [...kitIn('home').map((n) => `${n} (garage)`), ...pitched, 'The rest of your tackle (on the wall)']));
    out.push(cols);
    out.push(el('h3', '', 'Before you go'));
    const check = checkAll(s, p, { campDest: this.h.campDest, carHome });
    const ul = el('ul', 'wb-check');
    for (const l of check) {
      const li = el('li', `wb-${l.level}`);
      li.append(el('span', 'wb-mark', l.level === 'ok' ? '✓' : l.level === 'warn' ? '!' : 'i'), el('span', '', l.text));
      ul.append(li);
    }
    out.push(ul);
    out.push(el('p', 'wb-faint', 'Nothing here stops you going: forget something and the tackle boxes round the coast, the chandlery and the drive home are always there.'));
    const acts = el('div', 'cp-row cp-acts');
    if (check.some((l) => l.level === 'warn')) {
      acts.append(btn('Pack the essentials', () => {
        const ch = essentials(s, p, { campDest: this.h.campDest, carHome });
        this.changed(ch.length ? `${listWords(ch)}.` : 'Nothing to add from what you have.');
      }));
    }
    if (s.outing.last) acts.append(btn('Restore last time’s packing', () => { const r = applyLoadout(s, s.outing.last, { carHome }); this.changed(r.notes.length ? r.notes.join(' ') : 'Packed as last time.'); }, 'pk-btn quiet'));
    out.push(acts);
    // Loadouts of your own: names for packing lists (they point at your gear; they never copy it).
    out.push(el('h3', '', `Your loadouts (${s.outing.loadouts.length} of ${LOADOUT_MAX})`));
    s.outing.loadouts.forEach((lo, i) => {
      const row = el('div', 'wb-setup');
      const t = el('div', '');
      t.append(el('b', '', lo.name), el('span', 'wb-faint', `${lo.pack.rods.map((r) => RODS[r].short.toLowerCase()).join(' and ')}, ${lo.pack.items.length} tackle${lo.car.rods.length || lo.car.items.length ? '; spares in the car' : ''}${KIT_IDS.some((k) => lo.kit[k] !== 'home') ? '; camping gear' : ''}`));
      row.append(t);
      const a = el('div', 'wb-setup-acts');
      a.append(btn('Use it', () => { const r = applyLoadout(s, lo, { carHome }); this.changed(r.notes.length ? r.notes.join(' ') : `Packed as “${lo.name}”.`); }, 'pk-btn small'), btn('Forget', () => { s.outing.loadouts.splice(i, 1); this.changed(`Forgot “${lo.name}”.`); }, 'pk-btn quiet small'));
      row.append(a);
      out.push(row);
    });
    const form = el('form', 'gx-save');
    const name = el('input');
    Object.assign(name, { type: 'text', placeholder: 'Name this packing list', maxLength: 30 });
    name.setAttribute('aria-label', 'Name for the loadout');
    const save = el('button', 'pk-btn quiet', s.outing.loadouts.length >= LOADOUT_MAX ? 'Full: forget one first' : 'Save as a loadout');
    save.type = 'submit';
    save.disabled = s.outing.loadouts.length >= LOADOUT_MAX;
    form.append(name, save);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const lo = snapshot(s, name.value.trim() || `Loadout ${s.outing.loadouts.length + 1}`);
      const same = s.outing.loadouts.findIndex((x) => x.name.toLowerCase() === lo.name.toLowerCase());
      if (same >= 0) s.outing.loadouts[same] = lo;
      else s.outing.loadouts.push(lo);
      this.changed(`Saved “${lo.name}”.`);
    });
    out.push(form);
    return out;
  }

  /* ---------------- 6. off you go ---------------- */
  render_go() {
    const s = this.state, p = this.plan, D = DESTS[p.dest], out = [];
    if (!D) {
      out.push(el('p', 'wb-lead', 'Choose where to go first.'), btn('Choose a place', () => this.go('where')));
      return out;
    }
    const carHome = this.h.carHome();
    out.push(el('p', 'wb-lead', `To ${D.name}${p.fish || p.camp || p.explore ? `, ${listWords([p.fish && 'to fish', p.camp && 'to camp the night', p.explore && 'to explore'].filter(Boolean))}` : ''}.`));
    const warns = checkAll(s, p, { campDest: this.h.campDest, carHome }).filter((l) => l.level === 'warn');
    if (warns.length) {
      const ul = el('ul', 'wb-check');
      for (const l of warns) {
        const li = el('li', 'wb-warn');
        li.append(el('span', 'wb-mark', '!'), el('span', '', l.text));
        ul.append(li);
      }
      out.push(ul, el('p', 'wb-faint', 'You can go anyway.'));
    }
    if (!carHome) {
      out.push(el('p', '', `The car is ${this.h.carWhere()}. Walk to it (or use the map) and drive from there.`));
      return out;
    }
    const acts = el('div', 'wb-go');
    if (D.drive) {
      const a = btn('', () => this.h.depart(p.dest, 'drive'), 'wb-go-btn');
      a.append(el('b', '', 'Drive there yourself'), el('span', '', 'The car is on the drive: get in at the driver’s door. The drive goes down to the coast lane: west for Willowhaven, south for Shell Strand, east for Cove Head. The clock runs as you drive.'));
      acts.append(a);
    }
    const b = btn('', () => this.h.depart(p.dest, 'skip'), 'wb-go-btn');
    b.append(el('b', '', D.drive ? 'Let the drive go by' : 'Drive there'), el('span', '', `A short fade, and you’re at the car park with the car (about ${minsWords(driveMinutes('home', p.dest))} pass). Your boats and camp stay where they are.`));
    acts.append(b);
    out.push(acts);
    return out;
  }
}

// The short check before you leave, with a word on the fuel for the trip (from where the car is).
function checkAll(s, p, ctx) {
  const out = departureCheck(s, p, ctx);
  if (p.dest && s.fuel) out.push(...fuelCheck(s.fuel, ctx.carHome ? 'home' : s.car.at || 'home', p.dest));
  return out;
}

// The jerry can: how full, and where it is (the garage, the car, your backpack).
function canRow(s, { carHome, here, changed }) {
  const f = s.fuel, row = el('div', 'wb-kitrow');
  const t = el('div', '');
  const words = { home: 'In the garage', car: 'In the car', pack: 'In your backpack' }[f.can.at];
  t.append(el('b', '', `Jerry can (${canWords(f)})`), el('span', `wb-tag ${f.can.at === 'pack' ? 'carried' : f.can.at === 'car' ? 'loaded' : 'stored'}`, words));
  row.append(t);
  const chips = el('div', 'cp-choice');
  const opts = here === 'home' ? [['home', 'Garage'], ...(carHome ? [['car', 'Car']] : []), ['pack', 'Backpack']] : [['car', 'Boot'], ['pack', 'Backpack']];
  for (const [to, text] of opts.filter(([to]) => CAN_PLACES.includes(to))) {
    const on = f.can.at === to;
    const b = btn(text, () => {
      if (on) return;
      moveCan(f, to);
      changed(`Jerry can: ${to === 'home' ? 'in the garage' : to === 'car' ? 'in the car' : 'in your backpack'}.`);
    }, `chip${on ? ' on' : ''}`);
    b.setAttribute('aria-pressed', on);
    chips.append(b);
  }
  row.append(chips);
  return row;
}

// The car's tackle back on the wall.
function unloadTackle(s) {
  s.equip.car.rods = [];
  s.equip.car.items = [];
}

// Rows for the camping gear: where each piece is, with buttons for where it can go from here.
// here: 'home' (garage: garage, car if it's here, backpack) or 'car' (the boot, away from home).
function kitRows(s, { carHome, here, changed }) {
  const box = el('div', 'wb-kit');
  for (const k of KIT_IDS) {
    const st = statusOf(s, 'kit', k);
    const row = el('div', 'wb-kitrow');
    const t = el('div', '');
    t.append(el('b', '', KIT[k].name), el('span', `wb-tag ${st.state}`, st.words));
    row.append(t);
    const chips = el('div', 'cp-choice');
    if (st.state !== 'pitched') {
      const opts = here === 'home' ? [['home', 'Garage'], ...(carHome ? [['car', 'Car']] : []), ['pack', 'Backpack']] : [['car', 'Boot'], ['pack', 'Backpack']];
      for (const [to, text] of opts) {
        const on = s.equip.kit[k] === to;
        const b = btn(text, () => {
          if (on) return;
          const r = moveKit(s, k, to);
          changed(r.ok ? `${KIT[k].name}: ${to === 'home' ? 'in the garage' : to === 'car' ? 'in the car' : 'in your backpack'}.` : r.why);
        }, `chip${on ? ' on' : ''}`);
        b.setAttribute('aria-pressed', on);
        chips.append(b);
      }
    } else chips.append(el('span', 'wb-faint', 'Pitched: pack the camp up to bring it back'));
    row.append(chips);
    box.append(row);
  }
  return box;
}

// The smaller sheet: the car's boot, the camping shelf, the wall at home, the list of places to
// drive to from the car.
export class OutingSheet {
  // hooks: { close(), changed(msg), carHome(), atHome(), openPack(box), drive(id, how), driveHome(),
  //   photos (PhotoStore), keepsakes(), records(), photoList() }
  constructor(state, hooks) {
    this.state = state;
    this.h = hooks;
    this.mode = null;
    $('out-close').addEventListener('click', () => hooks.close());
    $('outsheet').addEventListener('click', (e) => { if (e.target === $('outsheet')) hooks.close(); });
  }

  get isOpen() { return !$('outsheet').hidden; }

  open(mode) {
    this.mode = mode;
    $('outsheet').hidden = false;
    this.render();
  }

  close() {
    $('outsheet').hidden = true;
    this.mode = null;
  }

  changed(msg) {
    this.h.changed(msg);
    this.render();
    if (msg) $('out-status').textContent = msg;
  }

  render() {
    if (!this.isOpen) return;
    const out = this[`render_${this.mode}`]();
    const st = el('p', 'wb-status');
    st.id = 'out-status';
    st.setAttribute('role', 'status');
    $('out-body').replaceChildren(...out, st);
  }

  // At the car's boot (anywhere).
  render_boot() {
    const s = this.state, home = this.h.carHome(), out = [];
    $('out-title').textContent = 'The car’s boot';
    $('out-sub').textContent = home ? 'on the drive at home' : 'wherever you’ve parked';
    out.push(el('h3', '', 'Camping gear'));
    out.push(kitRows(s, { carHome: home, here: home && this.h.atHome() ? 'home' : 'car', changed: (m) => this.changed(m) }));
    // (The can only moves between the boot and you away from home; at home, the garage too.)
    if (s.fuel.can.at !== 'home' || (home && this.h.atHome())) out.push(canRow(s, { carHome: home, here: home && this.h.atHome() ? 'home' : 'car', changed: (m) => this.changed(m) }));
    out.push(el('p', 'wb-faint', `Fuel: ${tankWords(s.fuel, 'car')}. ${home ? 'The pump is beside the garage.' : 'The pumps are at home and on Willowhaven quay.'}`));
    const car = s.equip.car;
    out.push(el('h3', '', `Spare tackle (${car.rods.length}/${CAR_HOLD.rods} rods, ${car.items.length}/${CAR_HOLD.items} tackle)`));
    if (!car.rods.length && !car.items.length) out.push(el('p', 'wb-faint', 'The rod tube and the tackle bag are empty.'));
    else {
      if (car.rods.length) out.push(el('p', '', car.rods.map((r) => RODS[r].name).join(', ')));
      if (car.items.length) out.push(el('p', 'wb-faint', car.items.map((i) => TACKLE[i].short).join(', ')));
    }
    const acts = el('div', 'cp-row cp-acts');
    acts.append(btn('Swap tackle with the boot…', () => this.h.openPack('car boot')));
    if (home && this.h.atHome()) {
      acts.append(btn('Unload it all into the garage', () => {
        const r = unloadCar(s);
        this.changed(r.rods || r.items || r.kit.length ? `Unloaded: ${listWords([r.rods && `${r.rods} rod${r.rods === 1 ? '' : 's'}`, r.items && `${r.items} tackle`, ...r.kit.map((k) => KIT[k].short)].filter(Boolean))}. All back in the garage.` : 'The boot was already empty.');
      }, 'pk-btn quiet'));
    }
    out.push(acts);
    return out;
  }

  // The shelf in the garage (camping gear between the garage, the car and your backpack).
  render_shelf() {
    const s = this.state, out = [];
    $('out-title').textContent = 'The camping shelf';
    $('out-sub').textContent = 'in the garage';
    out.push(kitRows(s, { carHome: this.h.carHome(), here: 'home', changed: (m) => this.changed(m) }));
    out.push(canRow(s, { carHome: this.h.carHome(), here: 'home', changed: (m) => this.changed(m) }));
    out.push(el('p', 'wb-faint', 'The tent needs to be in your backpack (or the car, close by) to pitch a camp. Without the stove you can’t cook at camp; without the cool box, kept fish stay in your creel.'));
    return out;
  }

  // The wall of photographs at home: chosen by you, or the game's pick from what you've done.
  render_wall() {
    const s = this.state, out = [], H = s.home;
    $('out-title').textContent = 'The wall at home';
    $('out-sub').textContent = 'photographs, a keepsake and a catch to remember';
    const auto = el('div', 'cp-row cp-chips');
    const ch = el('div', 'cp-choice');
    for (const [v, text] of [[true, 'Let the house choose'], [false, 'I’ll choose']]) {
      const b = btn(text, () => { H.auto = v; this.changed(); }, `chip${H.auto === v ? ' on' : ''}`);
      b.setAttribute('aria-pressed', H.auto === v);
      ch.append(b);
    }
    auto.append(el('strong', '', 'On the wall'), ch);
    out.push(auto);
    if (H.auto) {
      out.push(el('p', 'wb-faint', 'Your latest photographs, your best catch and your newest keepsake (only ever things you’ve done).'));
      return out;
    }
    out.push(el('h3', '', `Photographs (${H.photos.length} of 3)`));
    const list = this.h.photoList();
    if (!list.length) out.push(el('p', 'wb-faint', 'No photographs yet: press P anywhere to take one.'));
    const grid = el('div', 'mem-photos');
    for (const p of list.slice().reverse()) {
      const on = H.photos.includes(p.id);
      const f = btn('', () => {
        if (on) H.photos.splice(H.photos.indexOf(p.id), 1);
        else if (H.photos.length < 3) H.photos.push(p.id);
        else return this.changed('Three frames: take one down first.');
        this.changed();
      }, `mem-photo${on ? ' on' : ''}`);
      f.setAttribute('aria-pressed', on);
      const img = el('img');
      img.alt = '';
      this.h.photos.url(p.id, 'thumb').then((u) => { if (u) img.src = u; });
      f.append(img, el('span', '', p.title || `Day ${p.day}`));
      grid.append(f);
    }
    out.push(grid);
    out.push(el('h3', '', 'A keepsake'));
    const keeps = this.h.keepsakes();
    if (!keeps.length) out.push(el('p', 'wb-faint', 'None yet: the adventures round the cove leave you some.'));
    const kc = el('div', 'cp-choice');
    for (const [id, name] of [['', 'None'], ...keeps]) {
      const on = (H.keepsake || '') === id;
      const b = btn(name, () => { H.keepsake = id || null; this.changed(); }, `chip${on ? ' on' : ''}`);
      b.setAttribute('aria-pressed', on);
      kc.append(b);
    }
    out.push(kc);
    out.push(el('h3', '', 'A catch to remember'));
    const recs = this.h.records();
    if (!recs.length) out.push(el('p', 'wb-faint', 'Nothing caught yet.'));
    const rc = el('div', 'wb-kit');
    for (const r of recs.slice(0, 8)) {
      const on = H.catchId === r.id;
      const row = btn('', () => { H.catchId = on ? null : r.id; this.changed(); }, `wb-catch${on ? ' on' : ''}`);
      row.setAttribute('aria-pressed', on);
      row.append(el('b', '', r.title), el('span', 'wb-faint', r.sub));
      rc.append(row);
    }
    out.push(rc);
    return out;
  }

  // From the driver's seat: where to go.
  render_drive() {
    const s = this.state, out = [];
    $('out-title').textContent = 'Where to?';
    $('out-sub').textContent = `from the driver’s seat · fuel ${tankWords(s.fuel, 'car')}`;
    const from = s.car.at || null;
    // (Each drive says roughly what it takes; a drive the tank can't make still goes, at a cost.)
    const fuelFor = (to) => {
      const need = carNeeds(from || 'home', to);
      return `uses about ${litres(need)}${need > s.fuel.car ? ': more than you have' : ''}`;
    };
    const row = (title, sub, acts) => {
      const r = el('div', 'wb-setup');
      const t = el('div', '');
      t.append(el('b', '', title), el('span', 'wb-faint', sub));
      const a = el('div', 'wb-setup-acts');
      a.append(...acts);
      r.append(t, a);
      out.push(r);
    };
    if (from !== 'home') {
      row('Home', `about ${minsWords(driveMinutes(from || 'strand', 'home'))} · ${fuelFor('home')}`, [btn('Let the drive go by', () => this.h.driveHome(), 'pk-btn small')]);
    }
    for (const id of DEST_IDS) {
      if (id === from) continue;
      const D = DESTS[id];
      const acts = [];
      if (D.drive) acts.push(btn('I’ll drive', () => this.h.drive(id, 'drive'), 'pk-btn quiet small'));
      acts.push(btn(D.drive ? 'Let it go by' : 'Drive there', () => this.h.drive(id, 'skip'), 'pk-btn small'));
      row(D.name, `${D.kind.toLowerCase()} · ${s.places[D.place] ? '' : 'not yet explored · '}about ${minsWords(driveMinutes(from || 'home', id))} · ${fuelFor(id)}`, acts);
    }
    out.push(el('p', 'wb-faint', 'Driving yourself, the clock runs as you go; letting a drive go by moves it on by the time the drive takes. Your boats and your camp stay where they are. Run dry on the way and you walk for a can: it costs an hour, never the trip.'));
    return out;
  }
}
