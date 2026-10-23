import {
  RODS, TACKLE, TERMS, ROD_IDS, ITEM_IDS, PACK, TYPE_NAMES, KIND_NAMES, SETUPS,
  castRange, castWeight, checkSetup, currentRig, fits, lineOf, termOf,
} from './tackle.js';
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

function select(options, value, onPick, label) {
  const s = el('select', 'pk-select');
  s.setAttribute('aria-label', label);
  for (const [v, text] of options) {
    const o = el('option', null, text);
    o.value = v;
    if (v === value) o.selected = true;
    s.append(o);
  }
  s.addEventListener('change', () => onPick(s.value));
  s.addEventListener('click', (e) => e.stopPropagation());
  return s;
}

const ACTION_WORDS = {
  flash: 'sinks while you wait, flashes as you reel', wobble: 'floats, dives as you reel', dart: 'hangs still between twitches',
  swim: 'counts down, swims on a slow retrieve', crawl: 'hops along the bottom', pop: 'floats; pops when twitched',
  walk: 'skates across the top', flutter: 'drops fast, flutters back',
};

// The backpack: what you carry. Two rods (each with its line and rig or leader) and eight bits
// of tackle, plus a creel for fish you keep. By a tackle box (at camp, or the locker in a
// motorboat) you can swap things, pack a ready-made setup, or save your own.
export class PackUI {
  // travel(dest) heads back to 'camp' or 'boat'; travelInfo() says which are possible right now.
  constructor(state, { onChange, onClose, travel, travelInfo, openMap }) {
    this.state = state;
    this.onChange = onChange;
    this.onCloseCb = onClose;
    this.travelInfo = travelInfo;
    this.el = $('pack');
    this.atBox = false;
    this.boxName = 'tackle box';
    $('pack-close').addEventListener('click', () => this.onCloseCb());
    $('travel-camp').addEventListener('click', () => travel('camp'));
    $('travel-boat').addEventListener('click', () => travel('boat'));
    $('travel-map').addEventListener('click', () => openMap?.());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.onCloseCb(); });
  }

  get isOpen() { return !this.el.hidden; }
  get gear() { return this.state.gear; }

  // box: false, or the name of the tackle box within reach ('tackle box', 'boat locker').
  open(box) {
    this.atBox = !!box;
    this.boxName = typeof box === 'string' ? box : 'tackle box';
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

  setLine(rodId, lineId) {
    this.gear.line[rodId] = lineId;
    const l = lineOf(this.gear, RODS[rodId]);
    this.changed(`${l.name} on the ${RODS[rodId].short.toLowerCase()}`);
  }

  setTerm(rodId, termId) {
    this.gear.term[rodId] = termId;
    this.changed(`${TERMS[termId].name} on the ${RODS[rodId].short.toLowerCase()}`);
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

  // Swap between the backpack and the tackle box.
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
    this.changed(toPack ? `Packed the ${RODS[id].short.toLowerCase()}` : `Left the ${RODS[id].short.toLowerCase()} in the ${this.boxName}`);
  }

  moveItem(id, toPack) {
    const items = this.gear.pack.items;
    if (toPack) {
      if (items.length >= PACK.items) return;
      items.push(id);
    } else items.splice(items.indexOf(id), 1);
    this.changed(toPack ? `Packed: ${TACKLE[id].name}` : `Left in the ${this.boxName}: ${TACKLE[id].name}`);
  }

  // Swap everything in the backpack for a setup (ready-made or one you saved).
  packSetup(s) {
    const g = this.gear;
    g.pack.rods = [...s.rods];
    g.pack.items = [...s.items];
    g.rod = s.rod;
    for (const r of s.rods) {
      if (s.line?.[r]) g.line[r] = s.line[r];
      if (s.term?.[r]) g.term[r] = s.term[r];
      const want = s.rig?.[r];
      if (want && s.items.includes(want)) g.rig[r] = want;
      else if (!s.items.includes(g.rig[r])) {
        const first = s.items.find((i) => fits(RODS[r], TACKLE[i]));
        if (first) g.rig[r] = first;
      }
    }
    this.changed(`Packed ${s.name}: ${s.rods.map((r) => RODS[r].short.toLowerCase()).join(' and ')}`);
  }

  saveSetup(name) {
    const g = this.gear;
    const s = {
      name: (name || '').trim().slice(0, 30) || `My setup ${g.saved.length + 1}`,
      rods: [...g.pack.rods], items: [...g.pack.items], rod: g.rod, rig: {}, line: {}, term: {},
    };
    for (const r of g.pack.rods) {
      s.rig[r] = g.rig[r];
      s.line[r] = lineOf(g, RODS[r]).id;
      s.term[r] = termOf(g, RODS[r]).id;
    }
    const same = g.saved.findIndex((x) => x.name.toLowerCase() === s.name.toLowerCase());
    if (same >= 0) g.saved[same] = s;
    else if (g.saved.length < PACK.saved) g.saved.push(s);
    else return;
    this.changed(`Saved your setup: ${s.name}`);
  }

  forgetSetup(i) {
    const [s] = this.gear.saved.splice(i, 1);
    this.changed(`Forgot the setup ${s?.name ?? ''}`.trim());
  }

  packed(s) {
    const g = this.gear;
    return s.rods.every((r) => g.pack.rods.includes(r)) && s.items.every((i) => g.pack.items.includes(i))
      && s.rods.every((r) => (!s.line?.[r] || lineOf(g, RODS[r]).id === s.line[r]) && (!s.term?.[r] || termOf(g, RODS[r]).id === s.term[r]));
  }

  setupButtons() {
    return SETUPS.map((s) => {
      const on = this.packed(s);
      const b = button(s.name, () => this.packSetup(s), on ? 'quiet on' : '');
      b.title = s.note;
      b.setAttribute('aria-pressed', on);
      const wrap = el('div', 'pk-setup');
      wrap.append(b, el('span', 'pk-note', s.note));
      return wrap;
    });
  }

  savedRows() {
    const g = this.gear;
    const rows = g.saved.map((s, i) => {
      const wrap = el('div', 'pk-setup');
      const acts = el('div', 'pk-acts');
      acts.append(button(s.name, () => this.packSetup(s), this.packed(s) ? 'quiet on' : ''), button('Forget', () => this.forgetSetup(i), 'quiet'));
      wrap.append(acts, el('span', 'pk-note', `${s.rods.map((r) => RODS[r].short).join(' and ')} · ${s.items.length} items`));
      return wrap;
    });
    const form = el('form', 'pk-save');
    const name = el('input');
    Object.assign(name, { type: 'text', placeholder: 'Name this setup', maxLength: 30 });
    name.setAttribute('aria-label', 'Name for the setup');
    const go = el('button', 'pk-btn', g.saved.length >= PACK.saved ? 'Full: forget one first' : 'Save what I carry');
    go.type = 'submit';
    go.disabled = g.saved.length >= PACK.saved;
    form.append(name, go);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSetup(name.value);
    });
    form.addEventListener('click', (e) => e.stopPropagation());
    return [...rows, form];
  }

  problemsFor(rod, item, term) {
    return checkSetup(rod, item, term).map((p) => el('p', p.level === 'block' ? 'pk-block' : 'pk-warn', p.text));
  }

  rodCard(rod, inPack) {
    const g = this.gear;
    const active = inPack && g.rod === rod.id;
    const card = el('article', `pk-card pk-rod${active ? ' active' : ''}${inPack ? '' : ' boxed'}`);
    const top = el('div', 'pk-top');
    top.append(el('strong', '', rod.name), el('span', 'pk-tag', KIND_NAMES[rod.kind]));
    card.append(top);
    const item = inPack ? currentRig({ ...g, rod: rod.id }).item : null;
    const term = termOf(g, rod);
    const [mn, mx] = castRange(rod, item, term);
    const stats = el('dl', 'pk-stats');
    const add = (k, v) => stats.append(el('dt', '', k), typeof v === 'string' ? el('dd', '', v) : (() => { const d = el('dd'); d.append(v); return d; })());
    add('Line', rod.lines.length > 1 ? select(rod.lines.map((l) => [l.id, `${l.name} (${l.kg} kg)`]), lineOf(g, rod).id, (v) => this.setLine(rod.id, v), `Line on the ${rod.short}`) : `${rod.lines[0].name} (${rod.lines[0].kg} kg)`);
    if (rod.terms.length > 1) add(rod.kind === 'lure' ? 'Leader' : 'Rig', select(rod.terms.map((t) => [t, TERMS[t].name]), term.id, (v) => this.setTerm(rod.id, v), `Rig or leader on the ${rod.short}`));
    else add(rod.kind === 'fly' ? 'Leader' : 'Rig', term.name);
    add('Casting weight', rod.kind === 'fly' ? 'the line carries the fly' : `${rod.weight[0]}–${rod.weight[1]} g`);
    add('Casts', item ? `${mn}–${mx} m with ${item.short.toLowerCase()} (${castWeight(rod, item, term)} g)` : `${rod.cast[0]}–${rod.cast[1]} m`);
    add('Takes', rod.accepts.map((a) => TYPE_NAMES[a].toLowerCase()).join(', '));
    card.append(stats);
    card.append(el('p', 'pk-good', rod.strengths), el('p', 'pk-bad', rod.limits), el('p', 'pk-desc', term.desc));
    if (inPack) card.append(...this.problemsFor(rod, item, term));
    const acts = el('div', 'pk-acts');
    if (inPack) {
      if (active) acts.append(el('span', 'pk-on', item ? `In hand · ${item.short}` : 'In hand · nothing tied on'));
      else acts.append(button('Use this rod', () => this.useRod(rod.id)));
      if (this.atBox && g.pack.rods.length > 1) acts.append(button(`Leave in the ${this.boxName}`, () => this.moveRod(rod.id, false), 'quiet'));
    } else if (g.pack.rods.length < PACK.rods) acts.append(button('Pack it', () => this.moveRod(rod.id, true)));
    else acts.append(el('span', 'pk-note', 'Backpack holds two rods: leave one first'));
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
    const meta = [];
    if (it.weight != null && it.type !== 'fly') meta.push(`${it.weight} g`);
    if (it.type === 'lure') meta.push(it.dive ? `dives to ~${it.dive} m` : it.suspend ? `hangs at ~${it.suspend} m` : ACTION_WORDS[it.action] || '');
    if (it.type === 'jig') meta.push(`sinks ~${it.sink.toFixed(2)} m a second`);
    meta.push(it.water === 'salt' ? 'sea and estuary' : it.water === 'fresh' ? 'fresh water' : 'fresh and salt');
    card.append(el('p', 'pk-meta', meta.filter(Boolean).join(' · ')));
    const acts = el('div', 'pk-acts');
    if (inPack) {
      if (tied) acts.append(el('span', 'pk-on', `Tied on the ${rod.short.toLowerCase()}`));
      else if (fits(rod, it)) {
        const block = checkSetup(rod, it, termOf(g, rod)).find((p) => p.level === 'block');
        if (block) acts.append(el('span', 'pk-block', block.text));
        else acts.append(button('Tie on', () => this.tieOn(it.id)));
      } else if (g.pack.rods.some((r) => fits(RODS[r], it))) acts.append(button(`Use with ${RODS[g.pack.rods.find((r) => fits(RODS[r], it))].short.toLowerCase()}`, () => this.tieOn(it.id)));
      else acts.append(el('span', 'pk-note', `Needs the ${forRods[0].toLowerCase()}`));
      if (this.atBox) acts.append(button(`Leave in the ${this.boxName}`, () => this.moveItem(it.id, false), 'quiet'));
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
    $('pack-title').textContent = this.atBox ? `Backpack & ${this.boxName}` : 'Backpack';
    $('pack-where').textContent = this.atBox
      ? `By the ${this.boxName}: pack a ready-made setup, save your own, or swap single rods and tackle.`
      : 'What you carry. Choose each rod’s line and rig here; at camp, or from a motorboat’s locker, you can swap tackle and pack whole setups.';
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
    $('pack-setups-section').hidden = !this.atBox;
    if (this.atBox) {
      $('pack-setups').replaceChildren(...this.setupButtons());
      $('pack-saved').replaceChildren(...this.savedRows());
    }
    const boxSection = $('pack-box-section');
    boxSection.hidden = !this.atBox;
    $('pack-box-title').textContent = `In the ${this.boxName}`;
    if (this.atBox) {
      const rods = ROD_IDS.filter((r) => !g.pack.rods.includes(r)).map((r) => this.rodCard(RODS[r], false));
      const its = ITEM_IDS.filter((i) => !g.pack.items.includes(i)).map((i) => this.itemCard(TACKLE[i], false));
      $('pack-box').replaceChildren(...rods, ...its);
      if (!rods.length && !its.length) $('pack-box').replaceChildren(el('p', 'pk-note', 'Empty: everything is in your backpack.'));
    }
  }
}
