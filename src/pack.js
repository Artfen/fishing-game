import { RODS, TACKLE, ROD_IDS, ITEM_IDS, PACK, TYPE_NAMES, KIND_NAMES, SETUPS, castRange, currentRig, fits } from './tackle.js';
import { fishById } from './fish.js';

const $ = (id) => document.getElementById(id);

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

// The backpack: what you carry away from camp. Two rods and six bits of tackle, plus a
// creel for fish you keep. At camp it opens next to the tackle box so you can swap things.
// Picking tackle is one click; anything that won't work with a rod says so.
export class PackUI {
  // travel(dest) heads back to 'camp' or 'boat'; travelInfo() says which are possible right now.
  constructor(state, { onChange, onClose, travel, travelInfo }) {
    this.state = state;
    this.onChange = onChange;
    this.onCloseCb = onClose;
    this.travelInfo = travelInfo;
    this.el = $('pack');
    this.atCamp = false;
    $('pack-close').addEventListener('click', () => this.onCloseCb());
    $('travel-camp').addEventListener('click', () => travel('camp'));
    $('travel-boat').addEventListener('click', () => travel('boat'));
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.onCloseCb(); });
  }

  get isOpen() { return !this.el.hidden; }
  get gear() { return this.state.gear; }

  open(atCamp) {
    this.atCamp = atCamp;
    this.render();
    this.el.hidden = false;
  }

  close() {
    this.el.hidden = true;
  }

  changed(msg) {
    this.onChange(msg);
    this.render();
  }

  useRod(id) {
    this.gear.rod = id;
    this.changed(`${RODS[id].name} in hand`);
  }

  tieOn(itemId) {
    const it = TACKLE[itemId];
    let rod = RODS[this.gear.rod];
    if (!fits(rod, it)) {
      const other = this.gear.pack.rods.map((r) => RODS[r]).find((r) => fits(r, it));
      if (!other) return;
      this.gear.rod = other.id;
      rod = other;
    }
    this.gear.rig[rod.id] = itemId;
    this.changed(`${it.name} on the ${rod.short.toLowerCase()}`);
  }

  // Swap between the backpack and the tackle box (only at camp).
  moveRod(id, toPack) {
    const rods = this.gear.pack.rods;
    if (toPack) {
      if (rods.length >= PACK.rods) return;
      rods.push(id);
    } else {
      if (rods.length <= 1) return;
      rods.splice(rods.indexOf(id), 1);
      if (this.gear.rod === id) this.gear.rod = rods[0];
    }
    this.changed(toPack ? `Packed the ${RODS[id].short.toLowerCase()}` : `Left the ${RODS[id].short.toLowerCase()} at camp`);
  }

  moveItem(id, toPack) {
    const items = this.gear.pack.items;
    if (toPack) {
      if (items.length >= PACK.items) return;
      items.push(id);
    } else items.splice(items.indexOf(id), 1);
    this.changed(toPack ? `Packed: ${TACKLE[id].name}` : `Left at camp: ${TACKLE[id].name}`);
  }

  // Swap everything in the backpack for a ready-made setup (only at camp, by the tackle box).
  packSetup(s) {
    const g = this.gear;
    g.pack.rods = [...s.rods];
    g.pack.items = [...s.items];
    g.rod = s.rod;
    for (const r of s.rods) {
      const first = s.items.find((i) => fits(RODS[r], TACKLE[i]));
      if (first && !s.items.includes(g.rig[r])) g.rig[r] = first;
    }
    this.changed(`Packed for ${s.name.toLowerCase()}: ${s.rods.map((r) => RODS[r].short.toLowerCase()).join(' and ')}`);
  }

  setupButtons() {
    const g = this.gear;
    return SETUPS.map((s) => {
      const on = s.rods.every((r) => g.pack.rods.includes(r)) && s.items.every((i) => g.pack.items.includes(i));
      const b = button(s.name, () => this.packSetup(s), on ? 'quiet on' : '');
      b.title = s.note;
      b.setAttribute('aria-pressed', on);
      const wrap = el('div', 'pk-setup');
      wrap.append(b, el('span', 'pk-note', s.note));
      return wrap;
    });
  }

  rodCard(rod, inPack) {
    const g = this.gear;
    const active = inPack && g.rod === rod.id;
    const card = el('article', `pk-card pk-rod${active ? ' active' : ''}${inPack ? '' : ' boxed'}`);
    const top = el('div', 'pk-top');
    top.append(el('strong', '', rod.name), el('span', 'pk-tag', KIND_NAMES[rod.kind]));
    card.append(top);
    const rig = inPack ? currentRig({ ...g, rod: rod.id }).item : null;
    const [mn, mx] = castRange(rod, rig);
    const stats = el('dl', 'pk-stats');
    for (const [k, v] of [['Line', rod.line.name], ['Casts', `${mn}–${mx} m`], ['Takes', TYPE_NAMES[rod.accepts].toLowerCase()]]) stats.append(el('dt', '', k), el('dd', '', v));
    card.append(stats);
    card.append(el('p', 'pk-good', rod.strengths), el('p', 'pk-bad', rod.limits));
    const acts = el('div', 'pk-acts');
    if (inPack) {
      if (active) acts.append(el('span', 'pk-on', rig ? `In hand · ${rig.short}` : 'In hand · nothing tied on'));
      else acts.append(button('Use this rod', () => this.useRod(rod.id)));
      if (this.atCamp && g.pack.rods.length > 1) acts.append(button('Leave at camp', () => this.moveRod(rod.id, false), 'quiet'));
    } else if (g.pack.rods.length < PACK.rods) acts.append(button('Pack it', () => this.moveRod(rod.id, true)));
    else acts.append(el('span', 'pk-note', 'Backpack holds two rods: leave one here first'));
    card.append(acts);
    return card;
  }

  itemCard(it, inPack) {
    const g = this.gear;
    const rod = RODS[g.rod];
    const tied = inPack && currentRig(g).item?.id === it.id;
    const card = el('article', `pk-card pk-item${tied ? ' active' : ''}${inPack ? '' : ' boxed'}`);
    const top = el('div', 'pk-top');
    top.append(el('strong', '', it.name));
    const forRods = ROD_IDS.map((r) => RODS[r]).filter((r) => fits(r, it)).map((r) => r.short);
    top.append(el('span', 'pk-tag', forRods.join(', ')));
    card.append(top, el('p', 'pk-desc', it.desc));
    if (it.type === 'lure') card.append(el('p', 'pk-meta', `${it.weight} g · ${it.dive ? `dives to ~${it.dive} m` : it.suspend ? `hangs at ~${it.suspend} m` : 'sinks while you wait'}`));
    const acts = el('div', 'pk-acts');
    if (inPack) {
      if (tied) acts.append(el('span', 'pk-on', `Tied on the ${rod.short.toLowerCase()}`));
      else if (fits(rod, it)) acts.append(button('Tie on', () => this.tieOn(it.id)));
      else if (g.pack.rods.some((r) => fits(RODS[r], it))) acts.append(button(`Use with ${RODS[g.pack.rods.find((r) => fits(RODS[r], it))].short.toLowerCase()}`, () => this.tieOn(it.id)));
      else acts.append(el('span', 'pk-note', `Needs the ${forRods[0].toLowerCase()} (at camp)`));
      if (this.atCamp) acts.append(button('Leave at camp', () => this.moveItem(it.id, false), 'quiet'));
    } else if (g.pack.items.length < PACK.items) acts.append(button('Pack it', () => this.moveItem(it.id, true)));
    else acts.append(el('span', 'pk-note', 'Backpack full'));
    card.append(acts);
    return card;
  }

  renderTravel() {
    const info = this.travelInfo();
    $('travel-camp').disabled = !info.camp;
    $('travel-boat').disabled = !info.boat;
    $('travel-note').textContent = info.note || '';
  }

  render() {
    this.renderTravel();
    const g = this.gear;
    $('pack-title').textContent = this.atCamp ? 'Backpack & tackle box' : 'Backpack';
    $('pack-where').textContent = this.atCamp
      ? 'At camp: pick a ready-made setup, or swap single rods and tackle with the tackle box.'
      : 'What you carry. Back at camp you can pack a ready-made setup or swap things with the tackle box.';
    $('pack-rod-count').textContent = `${g.pack.rods.length} of ${PACK.rods}`;
    $('pack-item-count').textContent = `${g.pack.items.length} of ${PACK.items}`;
    $('pack-rods').replaceChildren(...g.pack.rods.map((r) => this.rodCard(RODS[r], true)));
    const items = [...g.pack.items].sort((a, b) => ITEM_IDS.indexOf(a) - ITEM_IDS.indexOf(b));
    $('pack-items').replaceChildren(...items.map((i) => this.itemCard(TACKLE[i], true)));
    const keep = this.state.keep || [];
    const creel = keep.length
      ? keep.map((f) => el('span', 'pk-fish', `${fishById[f.id]?.name || f.id} · ${f.size} cm`))
      : [el('span', 'pk-note', 'Empty. Keep a fish from the catch card to cook it at camp.')];
    $('pack-fish').replaceChildren(...creel);
    $('pack-fish-count').textContent = `${keep.length} of ${PACK.fish}`;
    $('pack-setups-section').hidden = !this.atCamp;
    if (this.atCamp) $('pack-setups').replaceChildren(...this.setupButtons());
    const boxSection = $('pack-box-section');
    boxSection.hidden = !this.atCamp;
    if (this.atCamp) {
      const rods = ROD_IDS.filter((r) => !g.pack.rods.includes(r)).map((r) => this.rodCard(RODS[r], false));
      const its = ITEM_IDS.filter((i) => !g.pack.items.includes(i)).map((i) => this.itemCard(TACKLE[i], false));
      $('pack-box').replaceChildren(...rods, ...its);
      if (!rods.length && !its.length) $('pack-box').replaceChildren(el('p', 'pk-note', 'Empty: everything is in your backpack.'));
    }
  }
}
