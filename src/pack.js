import {
  RODS, TACKLE, TERMS, ROD_IDS, ITEM_IDS, PACK, TYPE_NAMES, KIND_NAMES, SETUPS,
  castRange, castWeight, checkSetup, currentRig, fits, lineOf, termOf, lineInUse,
} from './tackle.js';
import { FISH, fishById } from './fish.js';
import { creelKg, creelLoad, creelWords } from './shop.js';
import { studio, refKey } from './gearView.js';
import { reelOf } from './gearArt.js';
import { CAR_HOLD, moveToCar, packSetup as packInto } from './outing.js';
import { $t } from './i18n.js';

// The backpack: what you carry, laid out like opening your tackle. Three areas work together:
// an equipment browser (categories, filters and a grid of pictures), the selected piece shown
// large with what it does and whether it suits your rod, and your setup as it's rigged (rod →
// reel → line → leader or rig → bait or lure). Two rods, eight bits of tackle and a creel; by a
// tackle box (at a camp, or a motorboat's locker) you can swap things, pack a ready-made setup,
// or save your own. Line, rig and what's tied on can be changed anywhere.
//
// Everything shown comes from tackle.js by id: no second catalogue lives here.

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function btn(text, onClick, cls = 'pk-btn') {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(e);
  });
  return b;
}

const CATS = [
  { id: 'rods', name: $t('Rods & reels') },
  { id: 'lines', name: $t('Lines & leaders') },
  { id: 'rigs', name: $t('Floats & rigs') },
  { id: 'lures', name: $t('Lures') },
  { id: 'baits', name: $t('Baits') },
  { id: 'flies', name: $t('Flies & jigs') },
  { id: 'setups', name: $t('Setups') },
];
const ITEM_CATS = { lures: ['lure'], baits: ['bait'], flies: ['fly', 'jig'] };
const CAT_OF_TYPE = { lure: 'lures', bait: 'baits', fly: 'flies', jig: 'flies' };
// Rigs (floats and bottom rigs) belong to the float, carp and sea bottom rods; the rest are leaders.
const RIG_KINDS = new Set(['float', 'ledger', 'bottom']);
const rigRod = (rod) => RIG_KINDS.has(rod.kind);

const ACTION_WORDS = {
  flash: $t('sinks while you wait, flashes as you reel'), wobble: $t('floats, dives as you reel'), dart: $t('hangs still between twitches'),
  swim: $t('counts down, swims on a slow retrieve'), crawl: $t('hops along the bottom'), pop: $t('floats; pops when twitched'),
  walk: $t('skates across the top'), flutter: $t('drops fast, flutters back'),
};
const WATER_WORDS = { fresh: $t('Fresh water: the lakes and the stream'), salt: $t('Salt and brackish water: the bay, the estuary and the sea'), both: $t('Fresh or salt water') };
const lb = (kg) => Math.round(kg * 2.2046);
const visibility = (t) => (t < 0.3 ? $t('very hard for fish to see') : t < 0.5 ? $t('fine and hard to see') : t < 0.7 ? $t('visible to wary fish') : $t('thick and easy for fish to see'));
const seen = (t) => (t < 0.3 ? $t('near invisible') : t < 0.5 ? 'fine' : t < 0.7 ? 'visible' : 'thick');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// How a cast weight sits against a rod's casting range, in the same terms as checkSetup and
// castRange: { level: 'ok' | 'warn' | 'no', words }.
function weightFit(rod, w) {
  const [w0, w1] = rod.weight, r = `the ${rod.short.toLowerCase()}’s ${w0}–${w1} g`;
  if (w > w1 * 1.25) return { level: 'no', words: $t`far too heavy for ${r}` };
  if (w > w1) return { level: 'warn', words: $t`a little over ${r}: it casts, but not as far or as true` };
  if (w < w0 * 0.6) return { level: 'warn', words: $t`too light to load ${r}: it won’t cast far` };
  if (w < w0) return { level: 'ok', words: $t`just under ${r}: it casts, a little short of the rod’s best` };
  return { level: 'ok', words: $t`inside ${r} casting range` };
}

export class PackUI {
  // travel(dest) heads back to 'camp', 'boat' or a camp; travelInfo() says which are possible.
  constructor(state, { onChange, onClose, travel, travelInfo, openMap, openGuide, kit, wear }) {
    this.openGuide = openGuide;
    this.state = state;
    this.onChange = onChange;
    this.onCloseCb = onClose;
    this.travelInfo = travelInfo;
    this.el = $('pack');
    this.atBox = false;
    this.boxName = 'tackle box';
    this.stage = studio();
    // What you were looking at: kept while the game runs, so reopening picks up where you were.
    this.ui = { cat: 'rods', sel: {}, scroll: {}, filters: { fits: false, water: 'all', where: 'all', q: '' }, pane: 'browse', rodView: 'full', yaw: 0, pitch: 0 };
    this.queue = [];
    this.queued = new Set();
    this.pumping = false;
    $('pack-close').addEventListener('click', () => this.onCloseCb());
    $('pack-guide').addEventListener('click', () => this.openGuide?.());
    this.kit = kit;
    this.wear = wear; // (the clothes, water bottle and rolls: see the game)
    $('travel-camp').addEventListener('click', () => travel('camp'));
    $('travel-own').addEventListener('click', () => travel('own'));
    $('travel-home').addEventListener('click', () => travel('home'));
    $('travel-haven').addEventListener('click', () => travel('haven'));
    $('travel-boat').addEventListener('click', () => travel('boat'));
    $('travel-map').addEventListener('click', () => openMap?.());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.onCloseCb(); });
    for (const b of $('pack-panes').querySelectorAll('button')) b.addEventListener('click', () => this.showPane(b.dataset.pane));
    this.grid = $('pack-grid');
    this.grid.addEventListener('keydown', (e) => this.gridKeys(e));
    this.grid.addEventListener('scroll', () => { this.ui.scroll[this.ui.cat] = this.grid.scrollTop; }, { passive: true });
    this.resize = new ResizeObserver(() => { if (this.isOpen) this.drawPreview(); });
  }

  get isOpen() { return !this.el.hidden; }
  get gear() { return this.state.gear; }
  get rodInHand() { return RODS[this.gear.rod]; }

  // box: false, or the name of the tackle box within reach ('tackle box', 'boat locker', 'tackle
  // wall', or 'car boot': the car's boot holds only what's loaded in it).
  open(box) {
    this.atBox = !!box;
    this.boxName = typeof box === 'string' ? box : 'tackle box';
    this.atCar = box === 'car boot';
    this.el.hidden = false;
    $('pack-status').textContent = '';
    this.render();
    this.grid.scrollTop = this.ui.scroll[this.ui.cat] || 0;
    this.resize.observe($('pack-inspect'));
    // Keyboard users land on what was selected.
    requestAnimationFrame(() => {
      const sel = this.grid.querySelector('.gx-tile.is-sel') || this.grid.querySelector('.gx-tile') || $('pack-close');
      sel.focus({ preventScroll: true });
    });
  }

  close() {
    this.el.hidden = true;
    this.resize.disconnect();
    // Let go of the big preview's model; the little studio and its thumbnails stay for next time.
    this.stage.release();
    this.queue.length = 0;
    this.queued.clear();
  }

  changed(msg, part) {
    this.onChange(msg);
    $('pack-status').textContent = msg;
    this.flashPart = part;
    this.render();
  }

  /* ---------------- what each action does (the rules are the game's own) ---------------- */

  useRod(id) {
    this.gear.rod = id;
    this.changed($t`${RODS[id].name} in hand`, 'rod');
  }

  setLine(rodId, lineId) {
    this.gear.line[rodId] = lineId;
    const l = lineOf(this.gear, RODS[rodId]);
    this.changed($t`Spooled ${l.name} on the ${RODS[rodId].short.toLowerCase()}`, 'line');
  }

  setTerm(rodId, termId) {
    this.gear.term[rodId] = termId;
    this.changed($t`${TERMS[termId].name} on the ${RODS[rodId].short.toLowerCase()}`, 'term');
  }

  tieOn(itemId) {
    const it = TACKLE[itemId];
    let rod = this.rodInHand;
    if (!fits(rod, it)) {
      const other = this.gear.pack.rods.map((r) => RODS[r]).find((r) => fits(r, it));
      if (!other) return;
      this.gear.rod = other.id;
      rod = other;
    }
    this.gear.rig[rod.id] = itemId;
    this.changed($t`Tied on: ${it.name}, on the ${rod.short.toLowerCase()}`, 'item');
  }

  // What the box in reach holds for you: the car's boot only its own; any other box everything
  // that isn't carried or in the car.
  inBox(type, id) {
    const car = this.state.equip?.car;
    const inCar = !!car && (type === 'rod' ? car.rods : car.items).includes(id);
    return this.atCar ? inCar : !inCar;
  }

  // Swap between the backpack and the tackle box.
  moveRod(id, toPack) {
    const rods = this.gear.pack.rods;
    if (this.atCar) {
      // The boot: what comes out goes into your backpack, what goes back goes into the rod tube.
      if (toPack) {
        if (rods.length >= PACK.rods) return;
        this.state.equip.car.rods.splice(this.state.equip.car.rods.indexOf(id), 1);
        rods.push(id);
        this.changed($t`Took the ${RODS[id].short.toLowerCase()} out of the boot`);
      } else {
        const r = moveToCar(this.state, 'rod', id, true);
        this.changed(r.ok ? $t`Put the ${RODS[id].short.toLowerCase()} in the boot` : r.why);
      }
      return;
    }
    if (toPack) {
      if (rods.length >= PACK.rods) return;
      rods.push(id);
    } else {
      if (rods.length <= 1) return;
      rods.splice(rods.indexOf(id), 1);
      if (this.gear.rod === id) this.gear.rod = rods[0];
    }
    this.changed(toPack ? $t`Packed the ${RODS[id].short.toLowerCase()}` : $t`Left the ${RODS[id].short.toLowerCase()} in the ${this.boxName}`);
  }

  moveItem(id, toPack) {
    const items = this.gear.pack.items;
    if (this.atCar) {
      if (toPack) {
        if (items.length >= PACK.items) return;
        this.state.equip.car.items.splice(this.state.equip.car.items.indexOf(id), 1);
        items.push(id);
        this.changed($t`Took out of the boot: ${TACKLE[id].name}`);
      } else {
        const r = moveToCar(this.state, 'item', id, true);
        this.changed(r.ok ? $t`In the boot: ${TACKLE[id].name}` : r.why);
      }
      return;
    }
    if (toPack) {
      if (items.length >= PACK.items) return;
      items.push(id);
    } else items.splice(items.indexOf(id), 1);
    this.changed(toPack ? `Packed: ${TACKLE[id].name}` : $t`Left in the ${this.boxName}: ${TACKLE[id].name}`);
  }

  // Swap everything in the backpack for a setup (ready-made or one you saved). Anything of it in
  // the car comes out of the car (one rod is only ever in one place).
  packSetup(s) {
    if (this.state.equip) packInto(this.state, s);
    else {
      const g = this.gear;
      g.pack.rods = [...s.rods];
      g.pack.items = [...s.items];
      g.rod = s.rod;
    }
    this.changed(`Packed ${s.name}: ${s.rods.map((r) => RODS[r].short.toLowerCase()).join($t(' and '))}`);
  }

  saveSetup(name) {
    const g = this.gear;
    const s = {
      name: (name || '').trim().slice(0, 30) || $t`My setup ${g.saved.length + 1}`,
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
    this.ui.sel.setups = `setup:s${same >= 0 ? same : g.saved.length - 1}`;
    this.changed($t`Saved your setup: ${s.name}`);
  }

  forgetSetup(i) {
    const [s] = this.gear.saved.splice(i, 1);
    delete this.ui.sel.setups;
    this.changed($t`Forgot the setup ${s?.name ?? ''}`.trim());
  }

  packed(s) {
    const g = this.gear;
    return s.rods.every((r) => g.pack.rods.includes(r)) && s.items.every((i) => g.pack.items.includes(i))
      && s.rods.every((r) => (!s.line?.[r] || lineOf(g, RODS[r]).id === s.line[r]) && (!s.term?.[r] || termOf(g, RODS[r]).id === s.term[r]));
  }

  /* ---------------- reading the gear ---------------- */

  carriedRods() {
    const g = this.gear;
    return [g.rod, ...g.pack.rods.filter((r) => r !== g.rod)].filter((r) => g.pack.rods.includes(r)).map((r) => RODS[r]);
  }

  // What's tied on a carried rod (or null).
  itemOn(rod) {
    return currentRig({ ...this.gear, rod: rod.id }).item;
  }

  setupOf(ref) {
    const kind = ref.id[0], i = Number(ref.id.slice(1));
    return kind === 'r' ? SETUPS[i] : this.gear.saved[i];
  }

  // Which carried rod a piece would go on: the one in hand if it can, else another that can.
  targetRod(ref) {
    if (ref.rod) return RODS[ref.rod];
    if (ref.type === 'item') {
      const it = TACKLE[ref.id], hand = this.rodInHand;
      if (fits(hand, it)) return hand;
      return this.carriedRods().find((r) => fits(r, it)) || hand;
    }
    return this.rodInHand;
  }

  // Where a piece is and what it's doing: in hand, on a rod, carried, or in the tackle box.
  status(ref) {
    const g = this.gear, hand = this.rodInHand;
    if (ref.type === 'rod') {
      if (g.rod === ref.id) return { cls: 'on', mark: '✋', text: $t('In hand') };
      if (g.pack.rods.includes(ref.id)) return { cls: 'carried', mark: '✓', text: $t('Carried') };
      if (this.state.equip?.car.rods.includes(ref.id)) return { cls: 'box', mark: '▣', text: $t('In the car') };
      return { cls: 'box', mark: '▣', text: this.atBox && !this.atCar ? $t`In the ${this.boxName}` : $t('At home or a tackle box') };
    }
    if (ref.type === 'line' || ref.type === 'term') {
      const rod = RODS[ref.rod];
      const on = ref.type === 'line' ? lineOf(g, rod).id === ref.id : termOf(g, rod).id === ref.id;
      if (on) return rod.id === hand.id ? { cls: 'on', mark: '●', text: ref.type === 'line' ? $t('On the reel') : $t('On the line') } : { cls: 'other', mark: '◐', text: $t`On the ${rod.short.toLowerCase()}` };
      return { cls: 'fits', mark: '○', text: ref.type === 'line' ? $t('Can spool on') : $t('Can tie on') };
    }
    if (ref.type === 'item') {
      const it = TACKLE[ref.id];
      const carried = g.pack.items.includes(ref.id);
      if (!carried) {
        if (this.state.equip?.car.items.includes(ref.id)) return { cls: 'box', mark: '▣', text: $t('In the car') };
        return { cls: 'box', mark: '▣', text: this.atBox && !this.atCar ? $t`In the ${this.boxName}` : $t('At home or a tackle box') };
      }
      if (this.itemOn(hand)?.id === ref.id) return { cls: 'on', mark: '●', text: $t('On your line') };
      const other = this.carriedRods().find((r) => r.id !== hand.id && this.itemOn(r)?.id === ref.id);
      if (other) return { cls: 'other', mark: '◐', text: $t`On the ${other.short.toLowerCase()}` };
      if (fits(hand, it)) return { cls: 'carried', mark: '✓', text: $t('Carried · fits') };
      if (this.carriedRods().some((r) => fits(r, it))) return { cls: 'carried', mark: '✓', text: $t('Carried · other rod') };
      return { cls: 'no', mark: '✕', text: $t('No rod for it') };
    }
    if (ref.type === 'setup') {
      const s = this.setupOf(ref);
      return s && this.packed(s) ? { cls: 'on', mark: '✓', text: $t('Packed') } : { cls: 'fits', mark: '○', text: $t`${s?.items.length ?? 0} items` };
    }
    return { cls: '', mark: '', text: '' };
  }

  // One or two numbers worth seeing on a tile.
  spec(ref) {
    if (ref.type === 'rod') {
      const r = RODS[ref.id];
      return r.kind === 'fly' ? `${KIND_NAMES[r.kind]} · ${r.cast[0]}–${r.cast[1]} m` : `${r.weight[0]}–${r.weight[1]} g · ${r.cast[0]}–${r.cast[1]} m`;
    }
    if (ref.type === 'line') {
      const l = RODS[ref.rod].lines.find((x) => x.id === ref.id);
      return `${l.kg} kg · ${seen(l.thick)}`;
    }
    if (ref.type === 'term') {
      const t = TERMS[ref.id];
      const bits = [];
      if (t.weight) bits.push(`${t.weight} g`);
      if (t.hook) bits.push($t`size ${t.hook} hook`);
      if (t.selfHook) bits.push('self-hooking');
      if (t.trace) bits.push('bite-proof');
      if (t.hides != null) bits.push($t('hides the line'));
      return bits.join(' · ') || $t('no extra weight');
    }
    if (ref.type === 'item') {
      const it = TACKLE[ref.id];
      if (it.type === 'fly') return it.fly === 'dry' ? 'floats' : it.fly === 'nymph' ? $t('drifts under the surface') : $t('stripped back');
      if (it.type === 'jig') return $t`${it.weight} g · sinks ${it.sink.toFixed(2)} m/s`;
      if (it.type === 'lure') return `${it.weight} g · ${it.dive ? `dives ~${it.dive} m` : it.suspend ? $t`hangs at ~${it.suspend} m` : (ACTION_WORDS[it.action] || '').split(',')[0]}`;
      return `${it.weight} g · ${it.water === 'both' ? $t('fresh & salt') : it.water}`;
    }
    if (ref.type === 'setup') {
      const s = this.setupOf(ref);
      return s ? s.rods.map((r) => RODS[r].short).join(' + ') : '';
    }
    return '';
  }

  nameOf(ref) {
    if (ref.type === 'rod') return RODS[ref.id].name;
    if (ref.type === 'reel') return cap(RODS[ref.rod].reel);
    if (ref.type === 'line') return cap(RODS[ref.rod].lines.find((l) => l.id === ref.id).name);
    if (ref.type === 'term') return TERMS[ref.id].name;
    if (ref.type === 'item') return TACKLE[ref.id].name;
    if (ref.type === 'setup') return this.setupOf(ref)?.name || '';
    return '';
  }

  /* ---------------- the browser ---------------- */

  // The sections of tiles for the current category, after filters.
  sections() {
    const g = this.gear, cat = this.ui.cat, F = this.ui.filters, hand = this.rodInHand;
    const q = F.q.trim().toLowerCase();
    const match = (ref) => !q || this.nameOf(ref).toLowerCase().includes(q) || (ref.type === 'item' && TACKLE[ref.id].desc.toLowerCase().includes(q));
    const boxTitle = this.atCar ? $t`In the boot · ${this.state.equip.car.rods.length} of ${CAR_HOLD.rods} rods, ${this.state.equip.car.items.length} of ${CAR_HOLD.items} tackle`
      : this.atBox ? $t`In the ${this.boxName}` : $t('In your tackle box · swap at home, at camp or a boat locker');
    const out = [];
    if (cat === 'rods') {
      const carried = this.carriedRods().map((r) => ({ type: 'rod', id: r.id }));
      const box = ROD_IDS.filter((r) => !g.pack.rods.includes(r) && (!this.atBox || this.inBox('rod', r))).map((id) => ({ type: 'rod', id }));
      if (F.where !== 'box') out.push({ title: $t`Carried · ${g.pack.rods.length} of ${PACK.rods}`, refs: carried.filter(match) });
      if (F.where !== 'carried') out.push({ title: boxTitle, refs: box.filter(match), box: true });
    } else if (cat === 'lines' || cat === 'rigs') {
      for (const rod of this.carriedRods()) {
        const refs = [];
        if (cat === 'lines') {
          for (const l of rod.lines) refs.push({ type: 'line', id: l.id, rod: rod.id });
          if (!rigRod(rod)) for (const t of rod.terms) refs.push({ type: 'term', id: t, rod: rod.id });
        } else if (rigRod(rod)) for (const t of rod.terms) refs.push({ type: 'term', id: t, rod: rod.id });
        const title = `${rod.name}${rod.id === hand.id ? $t(' · in hand') : ''}`;
        if (refs.length) out.push({ title, refs: refs.filter(match), rod: rod.id });
        else out.push({ title, refs: [], note: $t`The ${rod.short.toLowerCase()} has no float or bottom rig: its ${rod.kind === 'fly' ? $t('leader and tippet are') : $t('leader is')} under Lines & leaders.`, rod: rod.id });
      }
    } else if (cat === 'setups') {
      out.push({ title: $t('Ready-made setups'), refs: SETUPS.map((s, i) => ({ type: 'setup', id: `r${i}` })).filter(match) });
      out.push({ title: $t`Your setups · ${g.saved.length} of ${PACK.saved}`, refs: g.saved.map((s, i) => ({ type: 'setup', id: `s${i}` })).filter(match), note: g.saved.length ? '' : this.atBox ? $t('None yet: save what you carry from the panel beside.') : $t('None yet. By a tackle box you can save what you carry.') });
    } else {
      const types = ITEM_CATS[cat];
      const ok = (id) => {
        const it = TACKLE[id];
        if (!types.includes(it.type)) return false;
        if (F.fits && !fits(hand, it)) return false;
        if (F.water === 'fresh' && it.water === 'salt') return false;
        if (F.water === 'salt' && it.water === 'fresh') return false;
        return match({ type: 'item', id });
      };
      const carried = ITEM_IDS.filter((i) => g.pack.items.includes(i) && ok(i)).map((id) => ({ type: 'item', id }));
      const box = ITEM_IDS.filter((i) => !g.pack.items.includes(i) && (!this.atBox || this.inBox('item', i)) && ok(i)).map((id) => ({ type: 'item', id }));
      if (F.where !== 'box') out.push({ title: $t`In your backpack · ${g.pack.items.length} of ${PACK.items} carried`, refs: carried });
      if (F.where !== 'carried') out.push({ title: boxTitle, refs: box, box: true });
    }
    return out;
  }

  renderCats() {
    const nav = $('pack-cats');
    nav.replaceChildren(...CATS.map((c) => {
      const b = el('button', 'gx-cat', c.name);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', c.id === this.ui.cat);
      b.tabIndex = c.id === this.ui.cat ? 0 : -1;
      b.dataset.cat = c.id;
      b.addEventListener('click', () => this.showCat(c.id));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const i = CATS.findIndex((x) => x.id === c.id), n = CATS[(i + (e.key === 'ArrowRight' ? 1 : CATS.length - 1)) % CATS.length];
        this.showCat(n.id);
        nav.querySelector(`[data-cat="${n.id}"]`)?.focus();
      });
      return b;
    }));
  }

  showCat(id) {
    if (this.ui.cat === id) return;
    this.ui.scroll[this.ui.cat] = this.grid.scrollTop;
    this.ui.cat = id;
    this.ui.yaw = this.ui.pitch = 0;
    this.render();
    this.grid.scrollTop = this.ui.scroll[id] || 0;
    if (this.ui.pane === 'inspect' && matchMedia('(max-width: 819px)').matches) this.showPane('browse');
  }

  showPane(p) {
    this.ui.pane = p;
    $('pack-body').dataset.pane = p;
    for (const b of $('pack-panes').querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.pane === p);
    if (p === 'inspect') this.drawPreview();
  }

  renderFilters() {
    const F = this.ui.filters, cat = this.ui.cat, box = $('pack-filters');
    const parts = [];
    const search = el('input', 'gx-search');
    Object.assign(search, { type: 'search', placeholder: $t('Search'), value: F.q });
    search.setAttribute('aria-label', $t('Search equipment'));
    search.addEventListener('input', () => {
      F.q = search.value;
      this.renderGrid();
    });
    parts.push(search);
    const chip = (label, on, onClick, tip) => {
      const b = btn(label, onClick, `gx-chip${on ? ' on' : ''}`);
      b.setAttribute('aria-pressed', on);
      if (tip) b.dataset.tip = tip;
      return b;
    };
    if (ITEM_CATS[cat]) {
      parts.push(chip($t`Fits the ${this.rodInHand.short.toLowerCase()}`, F.fits, () => { F.fits = !F.fits; this.render(); }, $t('Only what the rod in hand can fish')));
      const water = el('div', 'gx-seg');
      water.setAttribute('role', 'group');
      water.setAttribute('aria-label', $t('Water'));
      for (const [v, t] of [['all', $t('Any water')], ['fresh', $t('Fresh')], ['salt', $t('Salt')]]) water.append(chip(t, F.water === v, () => { F.water = v; this.render(); }));
      parts.push(water);
    }
    if (ITEM_CATS[cat] || cat === 'rods') {
      const where = el('div', 'gx-seg');
      where.setAttribute('role', 'group');
      where.setAttribute('aria-label', $t('Where'));
      for (const [v, t] of [['all', $t('All')], ['carried', $t('Carried')], ['box', this.atBox ? $t('In the box') : $t('At camp')]]) where.append(chip(t, F.where === v, () => { F.where = v; this.render(); }));
      parts.push(where);
    }
    const had = document.activeElement === box.querySelector('.gx-search');
    box.replaceChildren(...parts);
    if (had) {
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }
  }

  renderGrid() {
    const secs = this.sections();
    const sel = this.selected();
    const kids = [];
    for (const s of secs) {
      kids.push(el('h3', `gx-sec${s.box ? ' box' : ''}`, s.title));
      if (s.note) kids.push(el('p', 'gx-note', s.note));
      if (!s.refs.length && !s.note) kids.push(el('p', 'gx-note', this.ui.filters.q ? $t('Nothing matches.') : s.box ? $t('Empty: everything is with you.') : $t('Nothing here.')));
      if (!s.refs.length) continue;
      const wrap = el('div', `gx-tiles${this.ui.cat === 'rods' ? ' wide' : ''}${s.box ? ' box' : ''}`);
      for (const ref of s.refs) wrap.append(this.tile(ref, sel && refKey(sel) === refKey(ref)));
      kids.push(wrap);
    }
    this.grid.replaceChildren(...kids);
    this.pump();
  }

  tile(ref, isSel) {
    const st = this.status(ref);
    const t = el('button', `gx-tile is-${st.cls}${isSel ? ' is-sel' : ''}${ref.type === 'rod' ? ' rod' : ''}`);
    t.type = 'button';
    t.dataset.key = refKey(ref);
    t.setAttribute('aria-pressed', !!isSel);
    t.setAttribute('aria-label', `${this.nameOf(ref)}. ${this.spec(ref)}. ${st.text}.`);
    const pic = el('span', 'gx-pic');
    if (ref.type === 'rod') {
      pic.append(this.img(ref, 240, 180, { closeUp: true }, 'gx-close-img'), this.img(ref, 640, 96, { thick: 3.4 }, 'gx-full-img'));
    } else if (ref.type === 'setup') {
      // Its rods, whole, one above the other.
      const s = this.setupOf(ref);
      pic.classList.add('stack');
      for (const r of s?.rods || []) pic.append(this.img({ type: 'rod', id: r }, 480, 120, { thick: 3.6 }, 'gx-strip'));
    } else pic.append(this.img(ref, 240, 180));
    const name = el('span', 'gx-name', ref.type === 'item' ? TACKLE[ref.id].short : ref.type === 'term' ? TERMS[ref.id].short : this.nameOf(ref));
    const state = el('span', `gx-state ${st.cls}`);
    state.append(el('i', '', st.mark), document.createTextNode(` ${st.text}`));
    t.append(pic, name, el('span', 'gx-spec', this.spec(ref)), state);
    t.addEventListener('click', () => this.select(ref));
    return t;
  }

  // A picture from the studio: from the cache now, or drawn shortly (a few per frame).
  img(ref, w, h, opts = {}, cls = '') {
    const i = el('img', cls);
    i.alt = '';
    i.decoding = 'async';
    const key = `${refKey(ref)}|${w}x${h}|${opts.closeUp ? 'c' : ''}`;
    const cached = this.stage.thumbs.get(key);
    if (cached) i.src = cached;
    else {
      i.classList.add('loading');
      i.dataset.thumb = key;
      if (!this.queued.has(key)) {
        this.queued.add(key);
        this.queue.push({ key, ref, w, h, opts });
      }
    }
    return i;
  }

  pump() {
    if (this.pumping || !this.queue.length) return;
    this.pumping = true;
    const step = () => {
      const t0 = performance.now();
      while (this.queue.length && performance.now() - t0 < 12) {
        const job = this.queue.shift();
        // (Drawn now, its picture encoded off the main thread: see gearView.js thumbAsync.)
        this.stage.thumbAsync(job.ref, job.w, job.h, job.opts).then((url) => {
          this.queued.delete(job.key);
          for (const im of this.el.querySelectorAll(`img[data-thumb="${CSS.escape(job.key)}"]`)) {
            im.src = url;
            im.classList.remove('loading');
            im.removeAttribute('data-thumb');
          }
        });
      }
      if (this.queue.length && this.isOpen) requestAnimationFrame(step);
      else this.pumping = false;
    };
    requestAnimationFrame(step);
  }

  // Arrow keys move between tiles (by where they sit on screen); Enter or Space selects.
  gridKeys(e) {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key) || !e.target.classList.contains('gx-tile')) return;
    e.preventDefault();
    const tiles = [...this.grid.querySelectorAll('.gx-tile')];
    const i = tiles.indexOf(e.target);
    let next = null;
    if (e.key === 'Home') next = tiles[0];
    else if (e.key === 'End') next = tiles[tiles.length - 1];
    else if (e.key === 'ArrowLeft') next = tiles[i - 1];
    else if (e.key === 'ArrowRight') next = tiles[i + 1];
    else {
      const r = e.target.getBoundingClientRect(), cx = r.left + r.width / 2;
      const down = e.key === 'ArrowDown';
      let best = null, bd = Infinity;
      for (const t of tiles) {
        if (t === e.target) continue;
        const q = t.getBoundingClientRect();
        const dy = down ? q.top - r.bottom : r.top - q.bottom;
        if (dy < -4) continue;
        const d = dy * 4 + Math.abs(q.left + q.width / 2 - cx);
        if (d < bd) { bd = d; best = t; }
      }
      next = best;
    }
    if (next) {
      next.focus();
      next.scrollIntoView({ block: 'nearest' });
    }
  }

  /* ---------------- selection and the inspector ---------------- */

  // The selected reference in this category (or the most useful one if none yet).
  selected() {
    const cat = this.ui.cat, key = this.ui.sel[cat];
    if (key) {
      const [type, rest] = key.split(':');
      const [id, rod] = rest.split('@');
      const ref = { type, id, ...(rod ? { rod } : {}) };
      // A setup that's since been forgotten, or a rod's line for a rod no longer carried, lapses.
      const gone = (type === 'setup' && !this.setupOf(ref)) || (rod && !this.gear.pack.rods.includes(rod));
      if (!gone) return ref;
    }
    // Otherwise: what's on the rod in hand.
    const hand = this.rodInHand, g = this.gear;
    if (cat === 'rods') return { type: 'rod', id: hand.id };
    if (cat === 'lines') return { type: 'line', id: lineOf(g, hand).id, rod: hand.id };
    if (cat === 'rigs') {
      const rod = rigRod(hand) ? hand : this.carriedRods().find(rigRod);
      if (rod) return { type: 'term', id: termOf(g, rod).id, rod: rod.id };
    }
    if (ITEM_CATS[cat]) {
      const on = this.itemOn(hand);
      if (on && CAT_OF_TYPE[on.type] === cat) return { type: 'item', id: on.id };
    }
    return this.sections().flatMap((s) => s.refs)[0] || null;
  }

  select(ref) {
    this.ui.sel[this.ui.cat] = refKey(ref);
    this.ui.yaw = this.ui.pitch = 0;
    for (const t of this.grid.querySelectorAll('.gx-tile')) {
      const on = t.dataset.key === refKey(ref);
      t.classList.toggle('is-sel', on);
      t.setAttribute('aria-pressed', on);
    }
    this.renderInspect();
    this.renderSetup();
    if (matchMedia('(max-width: 819px)').matches) this.showPane('inspect');
  }

  // Jump to a part of a rod's setup from the chain.
  goto(cat, ref, rodView) {
    this.ui.scroll[this.ui.cat] = this.grid.scrollTop;
    this.ui.cat = cat;
    if (ref) this.ui.sel[cat] = refKey(ref);
    if (rodView) this.ui.rodView = rodView;
    this.ui.yaw = this.ui.pitch = 0;
    this.render();
    this.grid.querySelector('.gx-tile.is-sel')?.scrollIntoView({ block: 'nearest' });
    if (matchMedia('(max-width: 819px)').matches) this.showPane(ref ? 'inspect' : 'browse');
  }

  renderInspect() {
    const box = $('pack-inspect');
    const ref = this.selected();
    this.previewRef = ref;
    if (!ref) {
      box.replaceChildren(el('p', 'gx-note gx-empty', $t('Pick something to look at it closely.')));
      return;
    }
    const stage = el('div', `gx-stage${ref.type === 'rod' && this.ui.rodView === 'full' ? ' long' : ''}`);
    const canvas = el('canvas', 'gx-canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', $t`${this.nameOf(ref)}, shown large`);
    stage.append(canvas);
    const tools = el('div', 'gx-tools');
    if (ref.type === 'rod') {
      for (const [v, t] of [['full', $t('Whole rod')], ['close', $t('Handle & reel')]]) {
        const b = btn(t, () => {
          this.ui.rodView = v;
          this.ui.yaw = this.ui.pitch = 0;
          this.renderInspect();
        }, `gx-chip${this.ui.rodView === v ? ' on' : ''}`);
        b.setAttribute('aria-pressed', this.ui.rodView === v);
        tools.append(b);
      }
    }
    const turnable = ref.type !== 'setup' && !(ref.type === 'rod' && this.ui.rodView === 'full');
    if (turnable) {
      canvas.tabIndex = 0;
      const reset = btn('↺', () => { this.ui.yaw = this.ui.pitch = 0; this.drawPreview(); }, 'gx-chip gx-icon');
      reset.setAttribute('aria-label', $t('Reset the view'));
      reset.dataset.tip = $t('Reset the view');
      tools.append(reset);
      stage.append(el('span', 'gx-hint', $t('Drag, or focus and use the arrow keys, to turn it')));
      this.bindStage(canvas);
    }
    stage.append(tools);
    const info = el('div', 'gx-info');
    info.append(...this.describe(ref));
    const acts = el('div', 'gx-actions');
    acts.append(...this.actions(ref));
    box.replaceChildren(stage, info, acts);
    this.drawPreview();
  }

  bindStage(canvas) {
    let drag = null, raf = 0;
    const redraw = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; this.drawPreview(); });
    };
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.ui.yaw += (e.clientX - drag.x) * 0.01;
      this.ui.pitch = Math.max(-1.2, Math.min(1.2, this.ui.pitch + (e.clientY - drag.y) * 0.01));
      drag = { x: e.clientX, y: e.clientY };
      redraw();
    });
    const end = () => { drag = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2] }[e.key];
      if (!d) return;
      e.preventDefault();
      this.ui.yaw += d[0];
      this.ui.pitch = Math.max(-1.2, Math.min(1.2, this.ui.pitch + d[1]));
      redraw();
    });
  }

  drawPreview() {
    const ref = this.previewRef;
    const canvas = $('pack-inspect').querySelector('.gx-canvas');
    if (!ref || !canvas || !this.isOpen) return;
    const r = canvas.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (ref.type === 'setup') {
      // A setup: its rods, one above the other.
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      const rods = this.setupOf(ref)?.rods || [];
      rods.forEach((rid, i) => {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, (h / rods.length) * i, w, h / rods.length);
        this.stage.thumbAsync({ type: 'rod', id: rid }, w, Math.round(h / rods.length), { thick: 3 }).then((url) => { img.src = url; });
      });
      return;
    }
    const closeUp = ref.type === 'rod' && this.ui.rodView === 'close';
    const full = ref.type === 'rod' && !closeUp;
    this.stage.preview(canvas, ref, { yaw: full ? 0 : this.ui.yaw, pitch: full ? 0 : this.ui.pitch, closeUp });
  }

  // Name, what it's for, its real numbers, whether it suits your rod, and how it compares.
  describe(ref) {
    const g = this.gear, out = [];
    const rod = this.targetRod(ref);
    const kicker = el('p', 'gx-kicker');
    const title = el('h3', 'gx-title', this.nameOf(ref));
    const specs = el('dl', 'gx-specs');
    const add = (k, v) => specs.append(el('dt', '', k), el('dd', '', v));
    const checks = el('ul', 'gx-checks');
    const check = (level, text) => {
      const li = el('li', level);
      li.append(el('i', '', level === 'ok' ? '✓' : level === 'warn' ? '!' : level === 'no' ? '✕' : '·'), el('span', '', text));
      checks.append(li);
    };
    let desc = '', compare = null;
    const extra = [];

    if (ref.type === 'rod') {
      const r = RODS[ref.id], reel = reelOf(r);
      kicker.textContent = `${KIND_NAMES[r.kind]} · ${r.length}`;
      desc = r.strengths;
      add($t('Fishes'), r.accepts.map((a) => TYPE_NAMES[a].toLowerCase()).join(', '));
      add($t('Reel'), reel.name);
      add($t('Casting weight'), r.kind === 'fly' ? $t('the line carries the fly') : `${r.weight[0]}–${r.weight[1]} g`);
      add($t('Casts'), `${r.cast[0]}–${r.cast[1]} m`);
      add($t('Lines'), r.lines.map((l) => `${l.name} (${l.kg} kg)`).join(' · '));
      add(rigRod(r) ? $t('Rigs') : $t('Leaders'), r.terms.map((t) => TERMS[t].short).join(' · '));
      check('warn', r.limits);
      const fitting = g.pack.items.filter((i) => fits(r, TACKLE[i])).map((i) => TACKLE[i].short.toLowerCase());
      if (fitting.length) check('ok', $t`You carry ${fitting.length} ${fitting.length === 1 ? $t('thing') : $t('things')} it can fish: ${fitting.join(', ')}.`);
      else check('no', $t`Nothing in your backpack fits it: it needs ${r.accepts.map((a) => TYPE_NAMES[a].toLowerCase()).join(' or ')}.`);
      const hand = this.rodInHand;
      if (r.id !== hand.id) {
        compare = [['', hand.short, r.short], [$t('Casting weight'), hand.kind === 'fly' ? '—' : `${hand.weight[0]}–${hand.weight[1]} g`, r.kind === 'fly' ? '—' : `${r.weight[0]}–${r.weight[1]} g`],
          [$t('Casts'), `${hand.cast[0]}–${hand.cast[1]} m`, `${r.cast[0]}–${r.cast[1]} m`],
          [$t('Strongest line'), `${Math.max(...hand.lines.map((l) => l.kg))} kg`, `${Math.max(...r.lines.map((l) => l.kg))} kg`]];
      }
    } else if (ref.type === 'line') {
      const l = rod.lines.find((x) => x.id === ref.id), cur = lineOf(g, rod);
      kicker.textContent = $t`Line · on the ${rod.short.toLowerCase()}`;
      desc = $t`Breaking strain ${l.kg} kg (about ${lb(l.kg)} lb). It is ${visibility(l.thick)}.`;
      add($t('Breaking strain'), `${l.kg} kg`);
      add($t('Seen by fish'), visibility(l.thick));
      add($t('For'), rod.name);
      const use = lineInUse({ ...g, line: { ...g.line, [rod.id]: l.id } }, rod);
      check('ok', $t`With the ${termOf(g, rod).short.toLowerCase()}, fish see ${use.name}.`);
      if (l.id !== cur.id) {
        const tail = l.thick > cur.thick ? $t(', and easier for wary fish to see') : l.thick < cur.thick ? $t(', and harder for wary fish to see') : '';
        check('info', l.kg > cur.kg ? $t`Stronger than your ${cur.name} (${cur.kg} kg)${tail}.` : l.kg < cur.kg ? $t`Lighter than your ${cur.name} (${cur.kg} kg)${tail}.` : $t`As strong as your ${cur.name} (${cur.kg} kg)${tail}.`);
        compare = [['', $t('Now'), $t('This')], [$t('Line'), cur.name, l.name], [$t('Breaking strain'), `${cur.kg} kg`, `${l.kg} kg`], [$t('Seen by fish'), seen(cur.thick), seen(l.thick)]];
      }
    } else if (ref.type === 'term') {
      const t = TERMS[ref.id], cur = termOf(g, rod), item = this.itemOn(rod);
      kicker.textContent = $t`${rigRod(rod) ? $t('Rig') : $t('Leader')} · on the ${rod.short.toLowerCase()}`;
      desc = t.desc;
      if (t.weight) add($t('Adds to the cast'), `${t.weight} g`);
      if (t.hook) add($t('Hook'), `size ${t.hook}`);
      if (t.selfHook) add($t('Hooking'), $t('self-hooking: a running fish hooks itself'));
      if (t.trace) add($t('Teeth'), 'bite-proof wire');
      if (t.hides != null) add($t('Seen by fish'), $t('hides the main line'));
      add($t('For'), rod.name);
      if (rod.kind !== 'fly' && item) {
        const w = castWeight(rod, item, t), fit = weightFit(rod, w);
        check(fit.level, `With ${item.on}, ${RIG_KINDS.has(rod.kind) ? $t('the rig weighs') : $t('the cast carries')} ${w} g: ${fit.words}.`);
        check('info', $t`Casts up to ${castRange(rod, item, t)[1]} m.`);
      }
      const use = lineInUse({ ...g, term: { ...g.term, [rod.id]: t.id } }, rod);
      check('ok', $t`Fish see ${use.name}.`);
      if (t.id !== cur.id && item && rod.kind !== 'fly') {
        compare = [['', cur.short, t.short], [$t('Rig weight'), `${castWeight(rod, item, cur)} g`, `${castWeight(rod, item, t)} g`], [$t('Casts up to'), `${castRange(rod, item, cur)[1]} m`, `${castRange(rod, item, t)[1]} m`]];
      }
    } else if (ref.type === 'item') {
      const it = TACKLE[ref.id];
      kicker.textContent = `${TYPE_NAMES[it.type].replace(/s$/, '')} · ${it.water === 'both' ? $t('fresh and salt') : it.water === 'salt' ? $t('sea and estuary') : $t('fresh water')}`;
      desc = it.desc;
      if (it.weight != null && it.type !== 'fly') add($t('Weight'), `${it.weight} g`);
      if (it.type === 'lure') add($t('In the water'), it.dive ? $t`dives to about ${it.dive} m as you reel` : it.suspend ? $t`hangs at about ${it.suspend} m` : ACTION_WORDS[it.action] || '');
      if (it.type === 'jig') add($t('Sinks'), $t`about ${it.sink.toFixed(2)} m a second`);
      if (it.type === 'fly') add($t('In the water'), it.fly === 'dry' ? $t('floats on the surface') : it.fly === 'nymph' ? $t('drifts just under the surface') : $t('sinks; strip it back in pulls'));
      add($t('Size'), it.size < 1 ? 'tiny' : ['', 'small', 'medium', 'large', 'huge'][it.size] || '');
      add($t('Water'), WATER_WORDS[it.water]);
      // Does the rod fish it, and does it fit the rod's casting weight?
      const hand = this.rodInHand;
      if (fits(rod, it)) {
        if (rod.id !== hand.id) check('info', $t`Fits your ${rod.short.toLowerCase()}: tying it on takes that rod in hand.`);
        else check('ok', $t`The ${rod.short.toLowerCase()} fishes ${TYPE_NAMES[it.type].toLowerCase()}.`);
        if (rod.kind !== 'fly') {
          const term = termOf(g, rod), w = castWeight(rod, it, term), fit = weightFit(rod, w), [w0, w1] = rod.weight;
          const block = checkSetup(rod, it, term).find((p) => p.level === 'block');
          if (block) check('no', block.text);
          else if (RIG_KINDS.has(rod.kind) && term.weight) check(fit.level, $t`With the ${term.short.toLowerCase()} (${term.weight} g), the rig weighs ${w} g: ${fit.words}.`);
          else if (w >= w0 && w <= w1) check('ok', $t`This ${w} g ${it.type === 'jig' ? $t('jig') : $t('lure')} fits your rod’s ${w0}–${w1} g casting range.`);
          else check(fit.level, $t`This ${w} g ${{ jig: $t('jig'), lure: $t('lure'), fly: $t('fly'), bait: $t('bait') }[it.type] || it.type} is ${fit.words}.`);
          check('info', $t`Casts ${castRange(rod, it, term).join('–')} m on the ${rod.short.toLowerCase()}.`);
        }
        this.lineAdvice(it, rod, check);
      } else {
        const need = ROD_IDS.map((r) => RODS[r]).filter((r) => fits(r, it));
        const carried = need.find((r) => g.pack.rods.includes(r.id));
        const what = { jig: $t('a squid jig'), bait: $t('bait'), lure: $t('a lure'), fly: $t('a fly') }[it.type] || it.type;
        check('no', $t`The ${hand.short.toLowerCase()} can’t fish ${what}: ${carried ? $t`your ${carried.short.toLowerCase()} can` : $t`it needs the ${need.slice(0, 2).map((r) => r.short.toLowerCase()).join(' or ')}${this.atBox ? $t` (in the ${this.boxName})` : $t(', at camp or a boat locker')}`}.`);
      }
      // Who takes it, with a link to each one's page in the field guide.
      const takers = FISH.filter((f) => (f.food?.[it.id] ?? 0) >= 0.8).sort((a, b) => b.food[it.id] - a.food[it.id]);
      if (takers.length) {
        const row = el('div', 'gx-targets');
        row.append(el('span', '', $t('Good for')));
        for (const f of takers.slice(0, 8)) {
          const b = btn(`${this.state.fish[f.id] ? '✓ ' : ''}${f.name}`, () => this.openGuide?.(f.id), 'gx-chip gx-target');
          b.setAttribute('aria-label', $t`${f.name}: open its page in the field guide`);
          row.append(b);
        }
        extra.push(row);
      }
      const on = this.itemOn(rod);
      if (on && on.id !== it.id && fits(rod, it) && rod.kind !== 'fly') {
        const term = termOf(g, rod);
        compare = [['', on.short, it.short], [$t('Weight'), `${castWeight(rod, on, term)} g`, `${castWeight(rod, it, term)} g`], [$t('Casts'), `${castRange(rod, on, term).join('–')} m`, `${castRange(rod, it, term).join('–')} m`]];
        if (on.type === 'lure' && it.type === 'lure') compare.push([$t('Runs'), on.dive ? $t`~${on.dive} m deep` : (ACTION_WORDS[on.action] || '').split(',')[0], it.dive ? $t`~${it.dive} m deep` : (ACTION_WORDS[it.action] || '').split(',')[0]]);
      }
    } else if (ref.type === 'setup') {
      const s = this.setupOf(ref);
      kicker.textContent = ref.id[0] === 'r' ? $t('Ready-made setup') : $t('Your setup');
      desc = s.note || $t`${s.rods.map((r) => RODS[r].short).join($t(' and '))}, with ${s.items.length} items.`;
      for (const r of s.rods) {
        const rr = RODS[r];
        const line = rr.lines.find((l) => l.id === s.line?.[r]) || rr.lines[0];
        const term = TERMS[s.term?.[r]] || TERMS[rr.terms[0]];
        add(rr.short, `${line.name} · ${term.short}${s.rig?.[r] && TACKLE[s.rig[r]] ? ` · ${TACKLE[s.rig[r]].short}` : ''}`);
      }
      add($t('Tackle'), s.items.map((i) => TACKLE[i].short).join(', '));
      const row = el('div', 'gx-kit');
      for (const i of s.items) {
        const f = el('figure', 'gx-kit-item');
        f.append(this.img({ type: 'item', id: i }, 160, 120), el('figcaption', '', TACKLE[i].short));
        row.append(f);
      }
      extra.push(row);
      if (!this.atBox) check('warn', $t('Packing a whole setup needs a tackle box: at a camp, or a motorboat’s locker.'));
      else if (this.packed(s)) check('ok', $t('This is what you’re carrying.'));
      else check('info', $t`Packing it swaps your backpack for these ${s.rods.length} rods and ${s.items.length} items (the rest goes in the ${this.boxName}).`);
    }

    // Where it is, and what moving it needs.
    if (ref.type === 'rod' || ref.type === 'item') {
      const carried = ref.type === 'rod' ? g.pack.rods.includes(ref.id) : g.pack.items.includes(ref.id);
      const capN = ref.type === 'rod' ? PACK.rods : PACK.items, n = ref.type === 'rod' ? g.pack.rods.length : g.pack.items.length;
      if (!carried) check(this.atBox ? 'info' : 'warn', this.atBox ? $t`In the ${this.boxName}. ${n >= capN ? $t`Your backpack is full (${n} of ${capN}): leave something first.` : $t`Pack it to take it with you (${n} of ${capN} carried).`}` : $t('In your tackle box. Swap it into your backpack at a camp’s tackle box or a motorboat’s locker.'));
    }

    out.push(kicker, title);
    if (desc) out.push(el('p', 'gx-desc', desc));
    if (specs.childElementCount) out.push(specs);
    out.push(...extra);
    if (checks.childElementCount) out.push(checks);
    if (compare) {
      const tbl = el('table', 'gx-compare');
      tbl.append(el('caption', '', $t('Compared with what you have now')));
      compare.forEach((row, i) => {
        const tr = el('tr');
        row.forEach((c, j) => tr.append(el(i === 0 || j === 0 ? 'th' : 'td', j === 2 && i > 0 ? 'new' : '', c)));
        tbl.append(tr);
      });
      out.push(tbl);
    }
    return out;
  }

  // Line and leader advice for a lure or bait on a rod, from the fish that take it.
  lineAdvice(it, rod, check) {
    const g = this.gear, line = lineInUse(g, rod), term = termOf(g, rod);
    const takers = FISH.filter((f) => (f.food?.[it.id] ?? 0) >= 0.8);
    check('info', $t`On ${line.name} (${line.kg} kg).`);
    if (takers.some((f) => f.life?.teeth) && !term.trace) {
      const who = takers.some((f) => f.life?.teeth && this.state.fish[f.id]) ? $t('Pike') : $t('Toothy fish');
      check('warn', rod.terms.includes('wire') ? $t`${who} take it and bite through line: rig the wire trace (Lines & leaders).` : $t`${who} take it, and this rod has no wire trace.`);
    }
    const shy = takers.filter((f) => f.life?.lineShy && line.thick > f.life.lineShy && this.state.fish[f.id]);
    if (shy.length) check('warn', (shy.length > 1 ? $t`${shy.map((f) => f.name).join($t(' and '))} are shy of line this easy to see: a fluorocarbon leader or finer line helps.` : $t`${shy.map((f) => f.name).join($t(' and '))} is shy of line this easy to see: a fluorocarbon leader or finer line helps.`));
  }

  // The explicit actions, with the reason when one isn't possible here.
  actions(ref) {
    const g = this.gear, out = [];
    const why = (t) => out.push(el('p', 'gx-why', t));
    const primary = (t, f) => out.push(btn(t, f, 'pk-btn gx-go'));
    const done = (t) => {
      const b = btn(t, () => {}, 'pk-btn gx-go');
      b.disabled = true;
      out.push(b);
    };
    const second = (t, f) => out.push(btn(t, f, 'pk-btn quiet'));
    if (ref.type === 'rod') {
      const carried = g.pack.rods.includes(ref.id);
      if (carried) {
        if (g.rod === ref.id) done($t('In hand'));
        else primary($t('Take in hand'), () => this.useRod(ref.id));
        if (this.atBox && g.pack.rods.length > 1) second(this.atCar ? $t('Put it in the boot') : $t`Leave in the ${this.boxName}`, () => this.moveRod(ref.id, false));
      } else if (this.atBox && !this.inBox('rod', ref.id)) {
        done($t('Pack this rod'));
        why(this.atCar ? $t('It isn’t in the car: it’s at home (or a tackle box).') : $t('It’s in the car: take it out at the boot.'));
      } else if (this.atBox) {
        if (g.pack.rods.length < PACK.rods) primary($t('Pack this rod'), () => this.moveRod(ref.id, true));
        else {
          done($t('Pack this rod'));
          why($t`Your backpack holds ${PACK.rods} rods: leave one in the ${this.boxName} first.`);
        }
      } else {
        done($t('Pack this rod'));
        why($t('Rods are swapped at a tackle box: at a camp, or in a motorboat’s locker.'));
      }
    } else if (ref.type === 'line') {
      const rod = RODS[ref.rod];
      if (lineOf(g, rod).id === ref.id) done($t('On the reel'));
      else primary($t`Spool it on the ${rod.short.toLowerCase()}`, () => this.setLine(rod.id, ref.id));
    } else if (ref.type === 'term') {
      const rod = RODS[ref.rod];
      if (termOf(g, rod).id === ref.id) done(rigRod(rod) ? $t('Rigged') : $t('Tied on'));
      else primary(`${rigRod(rod) ? $t('Rig it on') : $t('Tie it on')} the ${rod.short.toLowerCase()}`, () => this.setTerm(rod.id, ref.id));
    } else if (ref.type === 'item') {
      const it = TACKLE[ref.id], carried = g.pack.items.includes(ref.id);
      if (carried) {
        const rod = this.targetRod(ref);
        if (!fits(rod, it)) {
          done($t('Tie on'));
          why($t`Nothing you carry can fish it: pack the ${ROD_IDS.map((r) => RODS[r]).filter((r) => fits(r, it))[0]?.short.toLowerCase()} at a tackle box.`);
        } else if (this.itemOn(rod)?.id === ref.id && rod.id === g.rod) done($t('On your line'));
        else {
          const block = checkSetup(rod, it, termOf(g, rod)).find((p) => p.level === 'block');
          if (block) {
            done($t('Tie on'));
            why(block.text);
          } else primary(rod.id === g.rod ? $t`Tie on the ${rod.short.toLowerCase()}` : $t`Tie on the ${rod.short.toLowerCase()} and take it`, () => this.tieOn(ref.id));
        }
        if (this.atBox) second(this.atCar ? $t('Put it in the boot') : $t`Leave in the ${this.boxName}`, () => this.moveItem(ref.id, false));
      } else if (this.atBox && !this.inBox('item', ref.id)) {
        done($t('Pack it'));
        why(this.atCar ? $t('It isn’t in the car: it’s at home (or a tackle box).') : $t('It’s in the car: take it out at the boot.'));
      } else if (this.atBox) {
        if (g.pack.items.length < PACK.items) primary($t('Pack it'), () => this.moveItem(ref.id, true));
        else {
          done($t('Pack it'));
          why($t`Your backpack is full (${PACK.items} items): leave something in the ${this.boxName} first.`);
        }
      } else {
        done($t('Pack it'));
        why($t('Tackle is swapped at a tackle box: at a camp, or in a motorboat’s locker.'));
      }
    } else if (ref.type === 'setup') {
      const s = this.setupOf(ref);
      if (!this.atBox || this.atCar) {
        done($t('Pack this setup'));
        why(this.atCar ? $t('Whole setups are packed at home or a tackle box: at the boot, swap the pieces one by one.') : $t('Whole setups are packed at a tackle box: at home, at a camp, or in a motorboat’s locker.'));
      } else if (this.packed(s)) done($t('Packed'));
      else primary($t('Pack this setup'), () => this.packSetup(s));
      if (ref.id[0] === 's') second($t('Forget it'), () => this.forgetSetup(Number(ref.id.slice(1))));
    }
    if (this.ui.cat === 'setups' && this.atBox) {
      const form = el('form', 'gx-save');
      const name = el('input');
      Object.assign(name, { type: 'text', placeholder: $t('Name what you carry'), maxLength: 30 });
      name.setAttribute('aria-label', $t('Name for the setup'));
      const go = el('button', 'pk-btn quiet', g.saved.length >= PACK.saved ? $t('Full: forget one first') : $t('Save as a setup'));
      go.type = 'submit';
      go.disabled = g.saved.length >= PACK.saved;
      form.append(name, go);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSetup(name.value);
      });
      out.push(form);
    }
    return out;
  }

  /* ---------------- your setup ---------------- */

  // What the selected piece would change on a carried rod: { rod, part, ref } or null.
  proposal() {
    const ref = this.selected();
    if (!ref || ref.type === 'setup' || ref.type === 'rod') return null;
    const g = this.gear;
    const rod = this.targetRod(ref);
    if (!g.pack.rods.includes(rod.id)) return null;
    if (ref.type === 'line' && lineOf(g, rod).id !== ref.id) return { rod: rod.id, part: 'line', ref };
    if (ref.type === 'term' && termOf(g, rod).id !== ref.id) return { rod: rod.id, part: 'term', ref };
    if (ref.type === 'item' && g.pack.items.includes(ref.id) && fits(rod, TACKLE[ref.id]) && this.itemOn(rod)?.id !== ref.id) return { rod: rod.id, part: 'item', ref };
    return null;
  }

  renderSetup() {
    const g = this.gear, box = $('pack-setup');
    const prop = this.proposal();
    const sel = this.selected();
    const kids = [];
    for (const rod of this.carriedRods()) {
      const hand = rod.id === g.rod;
      const head = el('div', 'gx-rodhead');
      head.append(el('h3', '', hand ? $t('In hand') : $t('Also carried')));
      if (!hand) {
        const slot = g.pack.rods.indexOf(rod.id) + 1;
        const b = btn($t('Take in hand'), () => this.useRod(rod.id), 'gx-chip');
        b.dataset.tip = $t`Or press ${slot}`;
        head.append(b);
      }
      kids.push(head);
      const expanded = hand || prop?.rod === rod.id;
      const item = this.itemOn(rod), line = lineOf(g, rod), term = termOf(g, rod), reel = reelOf(rod);
      const parts = [
        { part: 'rod', label: $t('Rod'), ref: { type: 'rod', id: rod.id }, name: rod.name, spec: rod.kind === 'fly' ? rod.length : `${rod.weight[0]}–${rod.weight[1]} g · ${rod.cast[0]}–${rod.cast[1]} m`, go: () => this.goto('rods', { type: 'rod', id: rod.id }, 'full') },
        { part: 'reel', label: $t('Reel'), ref: { type: 'reel', id: 'reel', rod: rod.id }, name: cap(reel.name), spec: $t('comes with the rod'), go: () => this.goto('rods', { type: 'rod', id: rod.id }, 'close') },
        { part: 'line', label: $t('Line'), ref: { type: 'line', id: line.id, rod: rod.id }, name: cap(line.name), spec: `${line.kg} kg`, go: () => this.goto('lines', { type: 'line', id: line.id, rod: rod.id }) },
        { part: 'term', label: rigRod(rod) ? $t('Rig') : $t('Leader'), ref: { type: 'term', id: term.id, rod: rod.id }, name: term.short, spec: this.spec({ type: 'term', id: term.id }), go: () => this.goto(rigRod(rod) ? 'rigs' : 'lines', { type: 'term', id: term.id, rod: rod.id }) },
        { part: 'item', label: { bait: $t('Bait'), lure: $t('Lure'), fly: $t('Fly'), jig: $t('Jig') }[rod.accepts[0]], ref: item ? { type: 'item', id: item.id } : null, name: item ? item.short : $t('Nothing tied on'), spec: item ? this.spec({ type: 'item', id: item.id }) : `pack ${TYPE_NAMES[rod.accepts[0]].toLowerCase()}`, go: () => this.goto(CAT_OF_TYPE[item ? item.type : rod.accepts[0]], item ? { type: 'item', id: item.id } : null) },
      ];
      const chain = el('ol', `gx-chain${hand ? ' hand' : ''}${expanded ? '' : ' compact'}`);
      chain.setAttribute('aria-label', $t`${rod.name}, as rigged`);
      for (const p of expanded ? parts : [parts[0], parts[4]]) {
        const li = el('li');
        const b = el('button', 'gx-link');
        b.type = 'button';
        b.dataset.part = p.part;
        const viewing = sel && p.ref && p.part !== 'reel' && refKey(sel) === refKey(p.ref);
        const changing = prop?.rod === rod.id && prop.part === p.part;
        if (viewing) b.classList.add('viewing');
        if (changing) b.classList.add('changing');
        if (this.flashPart === p.part && hand) b.classList.add('flash');
        b.setAttribute('aria-label', $t`${p.label}: ${p.name}. ${p.spec}.${changing ? $t` Previewing ${this.nameOf(prop.ref)}.` : ''} Show it.`);
        const pic = el('span', 'gx-lpic');
        if (p.ref) pic.append(this.img(p.ref, 160, 120, p.part === 'rod' ? { closeUp: true } : {}));
        const txt = el('span', 'gx-ltxt');
        txt.append(el('small', '', p.label), el('b', '', p.name), el('span', '', p.spec));
        if (changing) {
          const nx = el('span', 'gx-next');
          nx.append(el('i', '', '→'), document.createTextNode(` ${prop.part === 'item' ? TACKLE[prop.ref.id].short : prop.part === 'term' ? TERMS[prop.ref.id].short : this.nameOf(prop.ref)} (preview)`));
          txt.append(nx);
        }
        b.append(pic, txt);
        b.addEventListener('click', () => p.go());
        li.append(b);
        chain.append(li);
      }
      kids.push(chain);
      if (expanded) {
        // What the rig adds up to, now (and with the piece being looked at).
        const sum = el('p', 'gx-sum');
        if (item && rod.kind !== 'fly') {
          const w = castWeight(rod, item, term), [mn, mx] = castRange(rod, item, term);
          const what = RIG_KINDS.has(rod.kind) ? 'rig' : rod.kind === 'jig' ? 'jig' : 'lure';
          let text = $t`Casts ${mn}–${mx} m · ${what} ${w} g on a ${rod.weight[0]}–${rod.weight[1]} g rod · fish see ${lineInUse(g, rod).name}.`;
          if (prop?.rod === rod.id) {
            if (prop.part === 'line') text += $t` With the change: ${rod.lines.find((l) => l.id === prop.ref.id).kg} kg line.`;
            else {
              const it2 = prop.part === 'item' ? TACKLE[prop.ref.id] : item, t2 = prop.part === 'term' ? TERMS[prop.ref.id] : term;
              const r2 = castRange(rod, it2, t2);
              text += $t` With the change: ${what} ${castWeight(rod, it2, t2)} g, casts ${r2[0]}–${r2[1]} m.`;
            }
          }
          sum.textContent = text;
        } else sum.textContent = item ? $t`Casts ${rod.cast[0]}–${rod.cast[1]} m · fish see ${lineInUse(g, rod).name}.` : $t`Nothing tied on: pack some ${TYPE_NAMES[rod.accepts[0]].toLowerCase()} for it.`;
        kids.push(sum);
        if (hand && item) for (const p of checkSetup(rod, item, term)) kids.push(el('p', `gx-warn ${p.level}`, p.text));
      }
    }
    this.flashPart = null;
    box.replaceChildren(...kids);
    this.pump();
  }

  /* ---------------- the whole thing ---------------- */

  renderHead() {
    const g = this.gear;
    $('pack-title').textContent = this.atBox ? $t`Backpack & ${this.boxName}` : $t('Backpack');
    $('pack-where').textContent = this.atBox
      ? $t`By the ${this.boxName}: swap rods and tackle, pack a setup, or save your own.`
      : $t('What you carry. Line, rig and what’s tied on change anywhere; rods and tackle swap at a camp or a boat’s locker.');
    const keep = this.state.keep || [];
    const load = Math.round(creelLoad(this.state) * 10) / 10;
    const caps = [[$t('Rods'), g.pack.rods.length, PACK.rods], [$t('Tackle'), g.pack.items.length, PACK.items], [$t('Creel'), load, creelKg(this.state), ' kg']];
    $('pack-caps').replaceChildren(...caps.map(([k, n, m, unit = '']) => {
      const li = el('li', n >= m ? 'full' : '');
      li.append(el('span', '', k), el('b', '', `${n}/${m}${unit}`));
      li.setAttribute('aria-label', $t`${k}: ${n} of ${m}${unit}`);
      return li;
    }));
  }

  renderTravel() {
    const info = this.travelInfo();
    $('travel-camp').disabled = !info.camp;
    $('travel-boat').disabled = !info.boat;
    $('travel-own').hidden = !this.state.camps?.length;
    $('travel-own').disabled = !info.own;
    $('travel-own').textContent = this.state.camps?.[0]?.name || $t('Your camp');
    $('travel-home').disabled = !info.home;
    $('travel-haven').hidden = !this.state.places.haven;
    $('travel-haven').disabled = !info.haven;
    $('travel-note').textContent = info.note || '';
    this.kit?.($('pack-kit'));
    this.wear?.($('pack-wear'));
    const keep = this.state.keep || [];
    $('pack-fish').replaceChildren(...(keep.length
      ? keep.map((f) => el('span', 'gx-fish', $t`${fishById[f.id]?.name || f.id} · ${f.size} cm${f.cooked ? $t(' · cooked') : ''}`))
      : [el('span', 'gx-note', $t('Empty. Keep a fish from the catch card to cook it at camp.'))]));
    $('pack-fish-count').textContent = $t`${keep.length} fish · ${creelWords(this.state)}`;
  }

  render() {
    if (!this.isOpen) return;
    // Keep keyboard focus where it was, across the redraw.
    const ae = document.activeElement;
    const inPack = ae?.closest?.('#pack');
    const focusKey = inPack ? (ae.dataset.key || ae.dataset.cat || ae.dataset.part || null) : null;
    const focusAction = inPack && ae.closest('.gx-actions');
    this.renderHead();
    this.renderCats();
    this.renderFilters();
    const scroll = this.grid.scrollTop;
    this.renderGrid();
    this.grid.scrollTop = scroll;
    this.renderInspect();
    this.renderSetup();
    this.renderTravel();
    $('pack-body').dataset.pane = this.ui.pane;
    for (const b of $('pack-panes').querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.pane === this.ui.pane);
    if (focusAction) ($('pack-inspect').querySelector('.gx-actions button:not(:disabled)') || $('pack-inspect').querySelector('.gx-actions button'))?.focus({ preventScroll: true });
    else if (focusKey) this.el.querySelector(`[data-key="${CSS.escape(focusKey)}"], [data-cat="${CSS.escape(focusKey)}"], [data-part="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
  }
}
