import { FISH, fishById, weightOf } from './fish.js';
import { RODS, TACKLE, TERMS, ROD_IDS, ITEM_IDS, SETUPS, TYPE_NAMES, KIND_NAMES, PACK, fits, checkSetup, castRange, lineOf, termOf } from './tackle.js';
import { REGISTER, REGIONS, registerFor, titleName, LEGACY, FRESHWATER, MACARONESIA, STATUS_WORDS } from './register.js';
import { ZONE_NAMES } from './world/terrain.js';
import { studio } from './gearView.js';
import { HOME_WORDS, tripPlaces, tripSummary, summaryText } from './trip.js';
import { formatClock } from './world/sky.js';

// The Atlantic field guide, inside the journal: every species in the game, with the same model
// it has in the water, how to tell it apart, where it lives in the game (from the simulation's
// own habitat data) and along the real coast (from the sourced register), how to catch it with
// tackle the game will actually accept, and what you've found yourself. Planned species from
// the register can be previewed, clearly marked as not in the game yet.
//
// One source of truth: names and real-world facts come from register.js, behaviour and habitat
// from fish.js, tackle from tackle.js. Nothing here repeats them.

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function btn(text, onClick, cls = 'g-btn') {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

// Text with its web addresses made into links (the register's notes cite their pages inline).
function linked(text) {
  const out = [];
  let at = 0;
  for (const m of text.matchAll(/https?:\/\/[^\s)\];,]+[^\s)\];,.]/g)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    const a = el('a', '', m[0].replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);
    a.href = m[0];
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    out.push(a);
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

const kg = (v) => (v < 1 ? `${Math.round(v * 1000 / 10) * 10} g` : `${v < 10 ? v.toFixed(1) : Math.round(v)} kg`);
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

// What the simulation says about when and where a species lives: depth bands across the day,
// the hours it's most active, and whether rain stirs it. (Read from its own functions.)
export function habitsOf(sp) {
  const L = sp.life;
  const env = (h, rain = 0) => ({ hour: h, rain, cloud: 0.3, daylight: h >= 7 && h < 19 ? 1 : 0.1, night: h >= 21 || h < 5 ? 1 : 0, lanternNear: false, hatch: 0.5 });
  const act = HOURS.map((h) => L.activity(env(h)));
  const best = Math.max(...act);
  const active = HOURS.filter((h, i) => act[i] >= best * 0.8);
  const rainy = L.activity(env(12, 0.8)) > L.activity(env(12, 0)) + 0.05;
  const depths = HOURS.map((h) => L.depth(env(h)));
  const dMin = Math.min(...depths.map((d) => d[0])), dMax = Math.max(...depths.map((d) => d[1]));
  const words = (hs) => {
    const w = new Set();
    for (const h of hs) w.add(h < 5 || h >= 21 ? 'night' : h < 9 ? 'dawn and morning' : h < 17 ? 'the day' : 'dusk');
    return [...w].join(', ');
  };
  return { active: words(active), rainy, depth: [dMin, dMax], allDay: active.length >= 6 };
}

// Which rods are made for the sea and which for fresh water (from what each rod is for, in
// tackle.js); the float and spinning rods do both. Recommendations prefer the right kind.
const SEA_RODS = new Set(['sea', 'boat', 'squid', 'offshore', 'biggame']), FRESH_RODS = new Set(['trout', 'carp', 'fly']);

// Every way the game can catch a species: rod, line, rig or leader, bait or lure, all checked by
// the fishing system's own rules. Best first. (A rod made for the other kind of water is left
// out when there is any other way: a carp rod may land a gilthead, but it's no advice.)
export function setupsFor(sp) {
  const L = sp.life, out = [];
  const sea = sp.water !== 'fresh';
  const wrongWater = (rodId) => (sea ? FRESH_RODS.has(rodId) : SEA_RODS.has(rodId));
  // Shoals of midwater (sardines, sand smelt, salema) and fish of open water swim well above a
  // bait on the bottom.
  const midwater = L.midwater || (!L.bottom && !L.flat && L.homes.every((h) => ['blue', 'tide', 'open', 'deep'].includes(h)));
  for (const rodId of ROD_IDS) {
    const rod = RODS[rodId];
    // (The big game needs a rod whose line can stand up to it at all.)
    if (L.big && !rod.lines.some((l) => l.kg >= sp.pull * 0.4)) continue;
    for (const itemId of ITEM_IDS) {
      const it = TACKLE[itemId], like = sp.food?.[itemId] ?? 0;
      if (like < 0.6 || !fits(rod, it)) continue;
      // Bottom feeders only find a bait lying on the bottom.
      if (L.bottom && it.type === 'bait' && !['bottom', 'ledger'].includes(rod.kind)) continue;
      // Lures only reach a predator if it chases lures.
      if (it.type === 'lure' && !L.strike?.lure) continue;
      // A mouthful it can manage, judged as the fish judge it (a soft bait goes down easier than
      // a hard lure, and the bigger ones of a kind manage more): the share of sizes that can.
      const natural = it.type === 'bait', mouth = sp.mouth ?? 2;
      const takes = 1 - Math.min(1, Math.max(0, ((it.size ?? 0) / mouth - (natural ? 1.05 : 0.7)) / (natural ? 0.4 : 0.5)));
      if (takes <= 0) continue;
      let best = null;
      for (const termId of rod.terms) {
        const term = TERMS[termId];
        if (L.teeth && rod.terms.includes('wire') && termId !== 'wire') continue;
        const problems = checkSetup(rod, it, term);
        if (problems.some((p) => p.level === 'block')) continue;
        let score = like * (problems.length ? 0.8 : 1) * (0.7 + 0.3 * takes);
        if (L.lineShy && term.hides != null) score *= 1.15;
        // A wire trace is for teeth; without them it only puts wary fish off.
        if (term.trace && !L.teeth) score *= 0.9;
        if (midwater && it.type === 'bait' && ['bottom', 'ledger'].includes(rod.kind)) score *= 0.5;
        if (sea ? SEA_RODS.has(rodId) : FRESH_RODS.has(rodId)) score *= 1.15;
        // The big game is trolled on the big-game rod, and fought from the chair.
        if (L.big && rod.chair) score *= 1.12;
        else if (wrongWater(rodId)) score *= 0.8;
        if (!best || score > best.score) best = { rod: rodId, item: itemId, term: termId, score };
      }
      if (!best) continue;
      // The line: strong enough for a big one, and the least visible that is.
      const lines = [...rod.lines].sort((a, b) => a.kg - b.kg);
      const line = lines.find((l) => l.kg >= sp.pull * 0.45) || lines[lines.length - 1];
      out.push({ ...best, line: line.id });
    }
  }
  const right = out.filter((s) => !wrongWater(s.rod));
  return (right.length ? right : out).sort((a, b) => b.score - a.score);
}

export class FieldGuide {
  // hooks: { atBox(), showOnMap(id), rig(setup) → message, openPack(ref), miniMap(canvas, id) }
  constructor(state, hooks) {
    this.state = state;
    this.hooks = hooks;
    this.stage = studio();
    this.ui = { sel: 'seabass', q: '', filter: 'all', planned: false, yaw: 0, pitch: 0, zoom: 1 };
    this.queue = [];
  }

  // The guide's entries: species in the game first (by group), then, if asked, planned ones.
  entries() {
    const out = [];
    const st = this.state;
    for (const f of FISH) {
      const reg = registerFor(f.id);
      const legacy = LEGACY[f.id];
      const fresh = FRESHWATER[f.id];
      // (Las Brasas' own fish, outside the register: their names and ranges.)
      const south = MACARONESIA[f.id];
      // The fictional originals are retired: they only appear if they're in your journal.
      if (legacy && !st.fish[f.id] && !st.observed?.[f.id]) continue;
      const L = f.life;
      const group = legacy ? 'legacy' : fresh ? 'fresh' : f.creature ? 'cephalopods' : L.observe ? 'observe'
        : L.zones[0] === 'estuary' ? 'estuary' : L.flat || L.benthic ? 'sand' : L.school ? 'shoal'
          : L.homes.some((h) => ['reef', 'rock', 'weed', 'quay', 'cove', 'cave', 'wall'].includes(h)) ? 'rocks' : 'sand';
      out.push({ id: f.id, sp: f, reg, legacy, fresh, south, group, status: legacy ? 'retired' : L.observe ? 'observation' : 'catchable' });
    }
    if (this.ui.planned) {
      for (const r of REGISTER) {
        if (r.game) continue;
        out.push({ id: `reg:${r.id}`, sp: null, reg: r, group: r.status === 'verify' ? 'verify' : 'planned', status: r.status });
      }
    }
    return out;
  }

  name(e) {
    return e.sp ? e.sp.name : e.reg?.names?.en ? titleName(e.reg.names.en) : e.reg?.scientific;
  }

  scientific(e) {
    return e.reg?.scientific || e.south?.scientific;
  }

  /* ---------------- the index (left page) ---------------- */

  renderIndex(box) {
    const st = this.state;
    const all = this.entries();
    const q = this.ui.q.trim().toLowerCase();
    const f = this.ui.filter;
    const shown = all.filter((e) => {
      if (q && !`${this.name(e)} ${this.scientific(e) || ''} ${Object.values(e.reg?.names || {}).join(' ')}`.toLowerCase().includes(q)) return false;
      if (f === 'caught') return !!st.fish[e.id];
      if (f === 'notyet') return e.sp && e.status === 'catchable' && !st.fish[e.id];
      if (f === 'sea') return ['estuary', 'rocks', 'sand', 'shoal'].includes(e.group);
      if (f === 'fresh') return e.group === 'fresh';
      if (f === 'cephalopods') return e.group === 'cephalopods';
      return true;
    });
    const inGame = all.filter((e) => e.sp && e.status === 'catchable');
    const head = el('div', 'g-head');
    head.append(el('h2', '', 'Field guide'));
    const caught = inGame.filter((e) => st.fish[e.id]).length;
    head.append(el('p', 'g-sum', `${inGame.length} species to catch · ${caught} caught · ${REGISTER.length} in the Atlantic register so far`));
    const tools = el('div', 'g-tools');
    const search = el('input', 'g-search');
    Object.assign(search, { type: 'search', placeholder: 'Search names, Latin, French, Spanish, Portuguese', value: this.ui.q });
    search.setAttribute('aria-label', 'Search the field guide');
    search.addEventListener('input', () => {
      this.ui.q = search.value;
      this.renderIndex(box);
      const s = box.querySelector('.g-search');
      s.focus();
      s.setSelectionRange(s.value.length, s.value.length);
    });
    tools.append(search);
    const chips = el('div', 'g-chips');
    for (const [v, t] of [['all', 'All'], ['sea', 'Sea & estuary'], ['cephalopods', 'Not fish'], ['fresh', 'Fresh water'], ['caught', 'Caught'], ['notyet', 'Not caught yet']]) {
      const c = btn(t, () => { this.ui.filter = v; this.renderIndex(box); }, `g-chip${f === v ? ' on' : ''}`);
      c.setAttribute('aria-pressed', f === v);
      chips.append(c);
    }
    const pl = btn(this.ui.planned ? 'Hide planned species' : 'Preview planned species', () => { this.ui.planned = !this.ui.planned; this.renderIndex(box); }, `g-chip planned${this.ui.planned ? ' on' : ''}`);
    pl.setAttribute('aria-pressed', this.ui.planned);
    chips.append(pl);
    tools.append(chips);
    const GROUPS = [
      ['estuary', 'The estuary'], ['rocks', 'Rocks, reefs and weed'], ['sand', 'Sand, mud and the seabed'], ['shoal', 'Shoals and open water'],
      ['cephalopods', 'Not fish: cephalopods'], ['observe', 'To watch, not to catch'],
      ['fresh', 'Fresh water (outside the Atlantic catalogue)'], ['legacy', 'Willow Bay originals (fictional, retired)'],
      ['planned', 'Planned: researched, not in the game yet'], ['verify', 'Records needing verification'],
    ];
    const list = el('div', 'g-list');
    list.setAttribute('role', 'list');
    for (const [g, title] of GROUPS) {
      const items = shown.filter((e) => e.group === g);
      if (!items.length) continue;
      list.append(el('h3', 'g-group', title));
      for (const e of items) list.append(this.card(e));
    }
    if (!shown.length) list.append(el('p', 'g-note', 'Nothing matches.'));
    box.replaceChildren(head, tools, list);
    this.pump();
  }

  card(e) {
    const st = this.state;
    const b = el('button', `g-card${this.ui.sel === e.id ? ' on' : ''}${e.sp ? '' : ' plan'}`);
    b.type = 'button';
    b.setAttribute('role', 'listitem');
    b.setAttribute('aria-pressed', this.ui.sel === e.id);
    b.dataset.id = e.id;
    const pic = el('span', 'g-pic');
    if (e.sp) pic.append(this.img(e.id, 180, 110));
    else pic.append(el('span', 'g-nomodel', 'No model yet'));
    const txt = el('span', 'g-ctxt');
    txt.append(el('b', '', this.name(e)));
    if (this.scientific(e)) txt.append(el('i', '', this.scientific(e)));
    const rec = st.fish[e.id], seen = st.observed?.[e.id];
    const status = el('span', `g-status ${e.status}`);
    const plan = e.reg?.planAs?.as;
    status.textContent = e.status === 'retired' ? (rec ? `Retired · caught ${rec.count}` : 'Retired')
      : e.status === 'observation' ? (seen ? `◉ Seen ${seen.count}` : '◎ To watch')
        : e.sp ? (rec ? `✓ Caught ${rec.count}` : seen ? '◉ Seen' : '○ Catchable now')
          : e.status === 'verify' ? '? Needs checking' : `◌ Planned${plan === 'observation' ? ' · to watch only' : plan === 'release' ? ' · catch and release' : ''}`;
    txt.append(status);
    b.append(pic, txt);
    b.addEventListener('click', () => this.select(e.id));
    return b;
  }

  img(id, w, h) {
    const i = el('img');
    i.alt = '';
    const key = `fish:${id}|${w}x${h}|`;
    const url = this.stage.thumbs.get(key);
    if (url) i.src = url;
    else {
      i.dataset.thumb = key;
      i.classList.add('loading');
      this.queue.push({ key, id, w, h });
    }
    return i;
  }

  pump() {
    if (this.pumping || !this.queue.length) return;
    this.pumping = true;
    const step = () => {
      const t0 = performance.now();
      while (this.queue.length && performance.now() - t0 < 12) {
        const j = this.queue.shift();
        const url = this.stage.thumb({ type: 'fish', id: j.id }, j.w, j.h);
        for (const im of document.querySelectorAll(`#journal img[data-thumb="${CSS.escape(j.key)}"]`)) {
          im.src = url;
          im.classList.remove('loading');
          im.removeAttribute('data-thumb');
        }
      }
      if (this.queue.length && !$('journal').hidden) requestAnimationFrame(step);
      else this.pumping = false;
    };
    requestAnimationFrame(step);
  }

  select(id) {
    this.ui.sel = id;
    this.ui.trip = false;
    this.ui.yaw = this.ui.pitch = 0;
    this.ui.zoom = 1;
    for (const c of document.querySelectorAll('#journal .g-card')) {
      const on = c.dataset.id === id;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', on);
    }
    this.renderPage($('g-page'));
    if (matchMedia('(max-width: 760px)').matches) $('journal').querySelector('.book').dataset.gpane = 'page';
  }

  /* ---------------- a species page (right page) ---------------- */

  renderPage(box) {
    const id = this.ui.sel;
    const e = this.entries().find((x) => x.id === id) || this.entries()[0];
    if (!e) return;
    if (this.ui.trip && e.sp && e.status === 'catchable') return this.renderTrip(box, e);
    const kids = [];
    const back = btn('← All species', () => { $('journal').querySelector('.book').dataset.gpane = 'index'; }, 'g-back');
    kids.push(back);
    const title = el('div', 'g-title');
    title.append(el('h2', '', this.name(e)));
    if (this.scientific(e)) {
      const sci = el('p', 'g-sci');
      sci.append(el('i', '', this.scientific(e)));
      if (e.reg?.authority) sci.append(' ', el('span', 'g-auth', e.reg.authority));
      title.append(sci);
    }
    const badge = el('p', `g-badge ${e.status}`, STATUS_WORDS[e.status] || e.status);
    title.append(badge);
    kids.push(title);
    if (e.reg?.nameNote) kids.push(el('p', 'g-note', e.reg.nameNote));
    if (e.reg?.verify) kids.push(el('p', 'g-warn', `To check before it comes into the game: ${e.reg.verify}`));
    const plan = e.reg?.planAs;
    if (plan) kids.push(el('p', 'g-warn', `${plan.as === 'observation' ? 'To come in as one to watch, not to catch' : 'To come in as catch-and-release'}: ${plan.why}`));
    if (e.legacy) {
      const w = el('div', 'g-warn');
      w.append(el('p', '', `A fictional fish from Slow Tide’s first version, now retired: the ${e.legacy.replacementName} has taken its place in the water. Your catches of it stay in your journal as they are.`));
      w.append(btn(`See the ${e.legacy.replacementName.split(',')[0]}`, () => this.select(e.legacy.replacement)));
      kids.push(w);
    }
    // Names in the coast's languages.
    const names = e.reg?.names;
    if (names) {
      const dl = el('dl', 'g-names');
      for (const [k, label] of [['fr', 'French'], ['es', 'Spanish'], ['pt', 'Portuguese']]) {
        if (!names[k]) continue;
        dl.append(el('dt', '', label), el('dd', '', names[k]));
      }
      if (dl.childElementCount) kids.push(dl);
    }
    if (e.sp) kids.push(this.stageBox(e));
    kids.push(...this.identify(e));
    kids.push(...this.where(e));
    if (e.sp && e.status === 'catchable') kids.push(...this.howTo(e));
    if (e.status === 'observation') kids.push(el('h3', '', 'Not to be caught'), el('p', 'g-text', e.sp.watch || 'Protected, and to be watched rather than fished: it ignores every bait in the game. Look for it underwater after dark (the view key), and it goes in your records as seen.'));
    if (e.sp) kids.push(...this.records(e));
    kids.push(...this.sources(e));
    box.replaceChildren(...kids);
    this.drawStage();
    // (Again once the page has been laid out, the first time the journal opens on it.)
    requestAnimationFrame(() => this.drawStage());
    if (!this.resize) {
      this.resize = new ResizeObserver(() => this.queueDraw());
      this.resize.observe(box);
    }
  }

  stageBox(e) {
    const wrap = el('div', 'g-stage');
    const c = el('canvas', 'g-canvas');
    c.tabIndex = 0;
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', `${e.sp.name}, the model used in the water. Drag or use the arrow keys to turn it; + and − zoom.`);
    wrap.append(c);
    const tools = el('div', 'g-stools');
    const zin = btn('+', () => { this.ui.zoom = Math.min(3, this.ui.zoom * 1.25); this.drawStage(); }, 'g-chip');
    zin.setAttribute('aria-label', 'Zoom in');
    const zout = btn('−', () => { this.ui.zoom = Math.max(0.7, this.ui.zoom / 1.25); this.drawStage(); }, 'g-chip');
    zout.setAttribute('aria-label', 'Zoom out');
    const reset = btn('↺', () => { this.ui.yaw = this.ui.pitch = 0; this.ui.zoom = 1; this.drawStage(); }, 'g-chip');
    reset.setAttribute('aria-label', 'Reset the view');
    tools.append(zin, zout, reset);
    wrap.append(tools);
    // Size against a ruler.
    const r = e.reg?.size, sp = e.sp;
    const ruler = el('div', 'g-ruler');
    const maxGame = sp.size[1];
    ruler.append(el('span', '', `In the game ${sp.size[0]}–${maxGame} cm${sp.creature ? ' (mantle)' : ''}, about ${kg(weightOf(sp, sp.size[0]))}–${kg(weightOf(sp, maxGame))}.`));
    if (r?.common || r?.max) ruler.append(el('span', '', `Real fish: ${r.common ? `commonly ${r.common} cm` : ''}${r.common && r.max ? ', ' : ''}${r.max ? `up to ${r.max} cm (${r.maxNote || 'maximum recorded'})` : ''}.`));
    wrap.append(ruler);
    let drag = null;
    c.addEventListener('pointerdown', (ev) => { drag = { x: ev.clientX, y: ev.clientY }; c.setPointerCapture?.(ev.pointerId); });
    c.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      this.ui.yaw += (ev.clientX - drag.x) * 0.01;
      this.ui.pitch = Math.max(-1.2, Math.min(1.2, this.ui.pitch + (ev.clientY - drag.y) * 0.01));
      drag = { x: ev.clientX, y: ev.clientY };
      this.queueDraw();
    });
    c.addEventListener('pointerup', () => { drag = null; });
    c.addEventListener('pointercancel', () => { drag = null; });
    c.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      this.ui.zoom = Math.max(0.7, Math.min(3, this.ui.zoom * Math.exp(-ev.deltaY * 0.0015)));
      this.queueDraw();
    }, { passive: false });
    c.addEventListener('keydown', (ev) => {
      const d = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2] }[ev.key];
      if (ev.key === '+' || ev.key === '=') { this.ui.zoom = Math.min(3, this.ui.zoom * 1.25); this.queueDraw(); ev.preventDefault(); return; }
      if (ev.key === '-') { this.ui.zoom = Math.max(0.7, this.ui.zoom / 1.25); this.queueDraw(); ev.preventDefault(); return; }
      if (!d) return;
      ev.preventDefault();
      this.ui.yaw += d[0];
      this.ui.pitch = Math.max(-1.2, Math.min(1.2, this.ui.pitch + d[1]));
      this.queueDraw();
    });
    return wrap;
  }

  queueDraw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.drawStage(); });
  }

  drawStage() {
    const c = document.querySelector('#journal .g-canvas');
    if (!c) return;
    const r = c.getBoundingClientRect();
    if (r.width < 4) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    this.stage.preview(c, { type: 'fish', id: this.ui.sel }, { yaw: this.ui.yaw, pitch: this.ui.pitch, zoom: this.ui.zoom });
  }

  identify(e) {
    const out = [el('h3', '', 'Identification')];
    const r = e.reg;
    if (e.sp) out.push(el('p', 'g-text', e.sp.note));
    if (r?.identification?.length) {
      const ul = el('ul', 'g-feat');
      for (const t of r.identification) ul.append(el('li', '', t));
      out.push(ul);
    }
    if (r?.similar?.length) {
      out.push(el('h4', '', 'Easily confused with'));
      const ul = el('ul', 'g-feat');
      for (const t of r.similar) ul.append(el('li', '', t));
      out.push(ul);
    }
    if (!e.sp && r) {
      if (r.habitat) out.push(el('p', 'g-text', r.habitat));
      if (r.behaviour) out.push(el('p', 'g-text', r.behaviour));
    }
    return out;
  }

  where(e) {
    const out = [el('h3', '', 'Where to find it')];
    if (e.sp) {
      const L = e.sp.life, H = habitsOf(e.sp);
      const dl = el('dl', 'g-facts');
      const add = (k, v) => dl.append(el('dt', '', k), el('dd', '', v));
      add('In the game', [...new Set(L.zones.map((z) => ZONE_NAMES[z] || z))].join(', '));
      // (A home fish that lives round Las Brasas too: where to look there.)
      if (e.sp.whereSouth) add('At Las Brasas', e.sp.whereSouth);
      add('Habitat', [...new Set(L.homes.map((h) => HOME_WORDS[h] || h))].join(', '));
      add('Depth', L.bottom || L.flat ? `on the bottom, in ${H.depth[0]}–${Math.round(H.depth[1])} m of water` : `about ${H.depth[0]}–${Math.round(H.depth[1])} m down`);
      add('Most active', H.allDay ? 'all day' : H.active);
      if (H.rainy) add('Weather', 'bolder in rain and cloud');
      add('Seasons', 'not simulated yet: the game has no seasons, so it is there all year');
      out.push(dl);
      const map = el('div', 'g-map');
      const cv = el('canvas', 'g-mini');
      cv.width = 280;
      cv.height = 400;
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', `Map of where ${e.sp.name} can live in the game`);
      map.append(cv);
      const side = el('div', 'g-mapside');
      side.append(el('p', 'g-note', 'Shaded: water that suits it (its waters, habitats and depths). It shows where to look, not where each fish is.'));
      side.append(btn('Show on the big map', () => this.hooks.showOnMap(e.id)));
      map.append(side);
      out.push(map);
      requestAnimationFrame(() => this.hooks.miniMap(cv, e.id));
    }
    // Along the real coast, from the register.
    const r = e.reg;
    if (r?.regions) {
      out.push(el('h4', '', 'Along the real coast (Royan to Cádiz)'));
      const tbl = el('table', 'g-regions');
      for (const reg of REGIONS) {
        const d = r.regions[reg.id];
        const tr = el('tr');
        tr.append(el('th', '', reg.name));
        tr.append(el('td', `st-${d?.status || 'unknown'}`, d ? `${d.status}${d.confidence ? ` (${d.confidence} confidence)` : ''}` : 'unknown'));
        tbl.append(tr);
      }
      out.push(tbl);
      // What each region's word rests on.
      const why = el('details', 'g-sources');
      why.append(el('summary', '', 'How sure? The evidence for each region'));
      const ul = el('ul');
      for (const reg of REGIONS) {
        const d = r.regions[reg.id];
        if (!d?.basis) continue;
        const li = el('li');
        li.append(el('b', '', `${reg.name}: `), ...linked(d.basis));
        ul.append(li);
      }
      why.append(ul);
      out.push(why);
      if (r.depth?.usual || r.depth?.range) out.push(el('p', 'g-note', `Real depths: ${r.depth.usual ? `usually ${r.depth.usual[0]}–${r.depth.usual[1]} m` : ''}${r.depth.usual && r.depth.range ? '; ' : ''}${r.depth.range ? `recorded ${r.depth.range[0]}–${r.depth.range[1]} m` : ''}.`));
      if (r.seasonal) out.push(el('p', 'g-note', `In reality: ${r.seasonal}`));
    }
    return out;
  }

  howTo(e) {
    const sp = e.sp, L = sp.life, g = this.state.gear;
    const out = [el('h3', '', 'How to catch it')];
    const setups = setupsFor(sp);
    const trip = this.state.trip;
    const plan = el('div', 'g-acts g-planbar');
    plan.append(btn(trip?.sp === sp.id ? 'Your trip for it: review' : 'Plan a fishing trip for it', () => this.openTrip(e.id), 'g-btn go'));
    if (trip && trip.sp !== sp.id) plan.append(el('span', 'g-note', `(You’re on a trip for ${fishById[trip.sp]?.name.toLowerCase()}.)`));
    out.push(plan);
    if (!setups.length) {
      out.push(el('p', 'g-text', 'Nothing in the game catches it yet.'));
      return out;
    }
    // Methods.
    const kinds = [...new Set(setups.map((s) => RODS[s.rod].kind))];
    out.push(el('p', 'g-text', `Methods: ${kinds.map((k) => KIND_NAMES[k].toLowerCase()).join(', ')}.`));
    // The recommended setup, as rigged.
    const s = setups[0], rod = RODS[s.rod], it = TACKLE[s.item], term = TERMS[s.term];
    const line = rod.lines.find((l) => l.id === s.line);
    const rec = el('div', 'g-rec');
    rec.append(el('h4', '', 'Recommended setup'));
    const chain = el('ol', 'g-chain');
    const parts = [['Rod', rod.name, { type: 'rod', id: rod.id }], ['Reel', rod.reel, null], ['Line', line.name, null], [rod.kind === 'lure' || rod.kind === 'fly' || rod.kind === 'jig' ? 'Leader' : 'Rig', term.name, null], [TYPE_NAMES[it.type].replace(/s$/, ''), it.name, { type: 'item', id: it.id }]];
    for (const [k, v, ref] of parts) {
      const li = el('li');
      if (ref) li.append(this.tackleImg(ref));
      li.append(el('small', '', k), el('b', '', v));
      chain.append(li);
    }
    rec.append(chain);
    const [mn, mx] = castRange(rod, it, term);
    rec.append(el('p', 'g-note', `Casts ${mn}–${mx} m. ${this.presentation(sp, rod, it)}`));
    // What you carry, and what you'd need.
    const carriedRod = g.pack.rods.includes(rod.id), carriedItem = g.pack.items.includes(it.id);
    const missing = [];
    if (!carriedRod) missing.push(rod.name);
    if (!carriedItem) missing.push(it.name);
    const acts = el('div', 'g-acts');
    if (!missing.length) {
      const on = g.rod === rod.id && g.rig[rod.id] === it.id && lineOf(g, rod).id === line.id && termOf(g, rod).id === term.id;
      if (on) acts.append(el('span', 'g-ok', '✓ This is what you’re fishing with'));
      else acts.append(btn('Rig it now', () => { const msg = this.hooks.rig(s); this.renderPage($('g-page')); this.flash(msg); }, 'g-btn go'));
    } else {
      acts.append(el('p', 'g-miss', `Not carried: ${missing.join(' and ')}. ${this.hooks.atBox() ? 'You’re by a tackle box: pack them in the backpack.' : 'Swap them in at a tackle box: at a camp, or a motorboat’s locker.'}`));
      const preset = SETUPS.find((x) => x.rods.includes(rod.id) && x.items.includes(it.id));
      if (preset) acts.append(el('p', 'g-note', `The ready-made “${preset.name}” setup has both.`));
    }
    acts.append(btn('Open in the backpack', () => this.hooks.openPack({ type: 'item', id: it.id })));
    rec.append(acts);
    out.push(rec);
    // Other good options.
    const others = setups.slice(1).filter((x, i, arr) => arr.findIndex((y) => y.rod === x.rod && y.item === x.item) === i).slice(0, 4);
    if (others.length) {
      out.push(el('h4', '', 'Also works'));
      const ul = el('ul', 'g-feat');
      for (const o of others) ul.append(el('li', '', `${RODS[o.rod].name} with ${TACKLE[o.item].on}${TERMS[o.term].id !== 'none' ? ` (${TERMS[o.term].short.toLowerCase()})` : ''}${g.pack.rods.includes(o.rod) && g.pack.items.includes(o.item) ? ' · you carry this' : ''}`));
      out.push(ul);
    }
    // Mistakes worth avoiding, from how it behaves.
    const tips = [];
    if (L.bottom) tips.push('It only finds a bait lying on the bottom: a float set shallow, or a lure, will pass it by.');
    if (L.lineShy) tips.push('It shies from thick, visible line: use the finer line or a fluorocarbon leader.');
    if (L.teeth) tips.push('Its teeth cut line: use a wire trace.');
    if ((L.caution ?? 1) >= 1.3) tips.push('It spooks easily: cast beyond where it lives and bring the bait back to it, and don’t crash the boat in.');
    if (sp.mouth <= 1) tips.push('Its mouth is small: a big bait or lure gets ignored.');
    if (L.likes?.fast < 0.3 && L.strike?.lure) tips.push('Reeled fast, a lure goes past it: slow down and pause.');
    if (L.likes?.still >= 1.2 && !L.strike?.lure) tips.push('Leave the bait still: moving it puts it off.');
    if (L.squid) tips.push('A jig needs the dart-and-pause: let it sink, dart it up, then let it glide down.');
    if (tips.length) {
      out.push(el('h4', '', 'Common mistakes'));
      const ul = el('ul', 'g-feat');
      for (const t of tips) ul.append(el('li', '', t));
      out.push(ul);
    }
    return out;
  }

  presentation(sp, rod, it) {
    const L = sp.life;
    if (rod.kind === 'jig') return 'Let the jig sink to near the bottom, dart it up with a tap, and pause: it takes as the jig glides down.';
    if (rod.kind === 'bottom' || rod.kind === 'ledger') return `Cast to ${L.homes.map((h) => HOME_WORDS[h] || h)[0]} and leave it on the bottom; strike when the rod tip pulls round.`;
    if (rod.kind === 'float') {
      // Near the bottom for fish of the shallows; at its own depth for a fish of open water.
      const d = habitsOf(sp).depth;
      if (L.bottom || d[1] < 3) return 'Set the float so the bait hangs near the bottom, and strike when the float goes under.';
      return `Set the float so the bait hangs ${Math.max(1, Math.round(d[0]))}–${Math.round(Math.min(d[1], 6))} m down, where it swims, and strike when the float goes under.`;
    }
    if (it.type === 'lure') {
      const slow = (L.likes?.slow ?? 0.5) >= (L.likes?.fast ?? 0.5);
      return `Cast past ${L.homes.map((h) => HOME_WORDS[h] || h)[0]} and reel ${slow ? 'slowly, with pauses and twitches' : 'briskly'}${L.likes?.twitch > 1 ? ': a twitch often makes it strike' : ''}.`;
    }
    return '';
  }

  tackleImg(ref) {
    const i = el('img', 'g-timg');
    i.alt = '';
    i.src = this.stage.thumb(ref, 120, 90, ref.type === 'rod' ? { closeUp: true } : {});
    return i;
  }

  records(e) {
    const st = this.state, rec = st.fish[e.id], seen = st.observed?.[e.id];
    const out = [el('h3', '', 'Your records')];
    const dl = el('dl', 'g-facts');
    const add = (k, v) => dl.append(el('dt', '', k), el('dd', '', v));
    add('Seen in the water', seen ? `${seen.count} time${seen.count > 1 ? 's' : ''} · first on day ${seen.day} at ${formatClock(seen.hour)}${seen.zone ? `, ${ZONE_NAMES[seen.zone] || seen.zone}` : ''}` : 'not yet (look underwater with the view key)');
    add('Caught', rec ? `${rec.count} · best ${rec.best} cm (${kg(weightOf(e.sp, rec.best))})` : 'not yet');
    const log = st.log.filter((x) => x.sp === e.id);
    if (log.length) {
      const where = {}, how = {}, sky = {};
      for (const x of log) {
        const w = x.place || ZONE_NAMES[x.zone] || x.zone;
        where[w] = (where[w] || 0) + 1;
        const k = `${RODS[x.rod]?.short || x.rod}${x.item ? `, ${TACKLE[x.item]?.short.toLowerCase()}` : ''}${x.line ? ` · ${x.line}` : ''}`;
        how[k] = how[k] || { n: 0, x };
        how[k].n++;
        const s = x.sky || (x.rain ? 'rain' : '');
        if (s) sky[s] = (sky[s] || 0) + 1;
      }
      const top = (o) => Object.entries(o).sort((a, b) => (b[1].n ?? b[1]) - (a[1].n ?? a[1])).slice(0, 4);
      add('Where', top(where).map(([k, n]) => `${k} (${n})`).join(', '));
      if (Object.keys(sky).length) add('Weather', top(sky).map(([k, n]) => `${k} (${n})`).join(', '));
      out.push(dl);
      out.push(el('h4', '', 'Setups that caught it'));
      const ul = el('ul', 'g-feat');
      for (const [k, { n }] of top(how)) ul.append(el('li', '', `${k} — ${n} fish`));
      out.push(ul);
    } else out.push(dl);
    const trips = (st.trips || []).filter((t) => t.sp === e.id).slice(-4).reverse();
    if (trips.length) {
      out.push(el('h4', '', 'Your trips for it'));
      const ul = el('ul', 'g-feat');
      for (const t of trips) ul.append(el('li', '', `Day ${t.day}, ${t.name}: ${t.hours} h, ${t.target ? `${t.target} caught${t.best ? ` (best ${t.best} cm)` : ''}` : 'none caught'}${t.total > t.target ? `, ${t.total - t.target} other fish` : ''}, on the ${RODS[t.setup.rod]?.short.toLowerCase()} with ${TACKLE[t.setup.item]?.on}`));
      out.push(ul);
    }
    return out;
  }

  /* ---------------- planning a trip ---------------- */

  openTrip(id) {
    this.ui.sel = id;
    this.ui.trip = true;
    this.ui.tripPlace = 0;
    this.ui.tripSetup = 0;
    this.renderPage($('g-page'));
    $('g-page').scrollTop = 0;
  }

  // The trip planner for one species: where to go, what to take, what you carry, rigging up,
  // marking the water, and how the trip went. Everything comes from the same data the game
  // plays by: suitability from the map, setups from the tackle rules, catches from the log.
  renderTrip(box, e) {
    const sp = e.sp, st = this.state, g = st.gear, H = habitsOf(sp);
    const kids = [];
    kids.push(btn(`← Back to the ${sp.name.toLowerCase()}`, () => { this.ui.trip = false; this.renderPage(box); }, 'g-btn g-tripback'));
    const title = el('div', 'g-title');
    title.append(el('h2', '', 'Plan a fishing trip'));
    title.append(el('p', 'g-sci', `For the ${sp.name.toLowerCase()} · most active ${H.allDay ? 'all day' : `at ${H.active}`}${H.rainy ? ', bolder in rain and cloud' : ''}`));
    kids.push(title);
    const step = (n, text) => el('h3', 'g-step', `${n}. ${text}`);

    // A trip already under way: how it's going, and ending it.
    const trip = st.trip;
    if (trip) {
      const sum = tripSummary(st, trip);
      const card = el('div', 'g-rec g-tripnow');
      card.append(el('h4', '', trip.sp === sp.id ? 'Your trip, so far' : `You’re on a trip for ${fishById[trip.sp]?.name.toLowerCase()}`));
      const d = Math.round(Math.hypot(trip.x - this.hooks.where().x, trip.z - this.hooks.where().z));
      card.append(el('p', 'g-text', `${summaryText(trip.sp, sum)} Destination: ${trip.name}${d > trip.r ? `, ${d} m away` : ' (you’re there)'}.`));
      const acts = el('div', 'g-acts');
      acts.append(btn('End the trip', () => { const msg = this.hooks.endTrip(); this.renderPage(box); this.flash(msg); }, 'g-btn'));
      acts.append(btn('Show on the map', () => this.hooks.showOnMap(trip.sp)));
      card.append(acts);
      kids.push(card);
      if (trip.sp !== sp.id) kids.push(el('p', 'g-note', 'Ending it lets you plan a new one for this fish.'));
    }

    // 1–2: where it lives, as stretches of suitable water.
    kids.push(step(1, 'Where to go'));
    const places = tripPlaces(sp, this.hooks.map(), this.hooks.where(), st);
    if (!places.length) kids.push(el('p', 'g-text', 'No water in the game suits it.'));
    this.ui.tripPlace = Math.min(this.ui.tripPlace, Math.max(0, places.length - 1));
    const map = el('div', 'g-map');
    const cv = el('canvas', 'g-mini');
    cv.width = 280;
    cv.height = 400;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', `Map of the water that suits the ${sp.name.toLowerCase()}, with the place you've chosen ringed`);
    map.append(cv);
    const list = el('div', 'g-mapside g-places');
    list.setAttribute('role', 'radiogroup');
    list.setAttribute('aria-label', 'Where to go');
    places.forEach((p, i) => {
      const b = btn('', () => { this.ui.tripPlace = i; this.renderTrip(box, e); }, `g-place${i === this.ui.tripPlace ? ' on' : ''}`);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', i === this.ui.tripPlace);
      b.append(el('b', '', p.name), el('span', '', `${Math.round(p.dist)} m ${p.dir}`));
      list.append(b);
    });
    list.append(el('p', 'g-note', `It keeps to ${H.depth[0]}–${Math.round(H.depth[1])} m down, around ${[...new Set(sp.life.homes.map((h) => HOME_WORDS[h] || h))].join(', ')}. The shading shows water that suits it, not where the fish are: they move, feed and rest as they please.`));
    map.append(list);
    kids.push(map);
    requestAnimationFrame(() => this.hooks.miniMap(cv, sp.id, places.map((p, i) => ({ ...p, on: i === this.ui.tripPlace }))));

    // 3: the setup, from the tackle rules.
    kids.push(step(2, 'What to take'));
    const all = setupsFor(sp), setups = all.filter((x, i) => all.findIndex((y) => y.rod === x.rod && y.item === x.item) === i).slice(0, 3);
    this.ui.tripSetup = Math.min(this.ui.tripSetup, Math.max(0, setups.length - 1));
    const choose = el('div', 'g-chips');
    choose.setAttribute('role', 'radiogroup');
    choose.setAttribute('aria-label', 'Setup');
    setups.forEach((x, i) => {
      const c = btn(`${RODS[x.rod].short} · ${TACKLE[x.item].short}${i === 0 ? ' (best)' : ''}`, () => { this.ui.tripSetup = i; this.renderTrip(box, e); }, `g-chip${i === this.ui.tripSetup ? ' on' : ''}`);
      c.setAttribute('role', 'radio');
      c.setAttribute('aria-checked', i === this.ui.tripSetup);
      choose.append(c);
    });
    kids.push(choose);
    const s = setups[this.ui.tripSetup];
    if (!s) {
      kids.push(el('p', 'g-text', 'Nothing in the game catches it yet.'));
      box.replaceChildren(...kids);
      return;
    }
    const rod = RODS[s.rod], it = TACKLE[s.item], term = TERMS[s.term], line = rod.lines.find((l) => l.id === s.line);
    const rec = el('div', 'g-rec');
    const chain = el('ol', 'g-chain');
    // 4: what you carry and what's in the tackle box.
    const hasRod = g.pack.rods.includes(rod.id), hasItem = g.pack.items.includes(it.id);
    const parts = [
      ['Rod', rod.name, { type: 'rod', id: rod.id }, hasRod ? '✓ carried' : 'in the tackle box'],
      ['Line', line.name, null, 'comes with the rod'],
      [rod.kind === 'lure' || rod.kind === 'fly' || rod.kind === 'jig' ? 'Leader' : 'Rig', term.name, null, 'comes with the rod'],
      [TYPE_NAMES[it.type].replace(/s$/, ''), it.name, { type: 'item', id: it.id }, hasItem ? '✓ carried' : 'in the tackle box'],
    ];
    for (const [k, v, ref, have] of parts) {
      const li = el('li');
      if (ref) li.append(this.tackleImg(ref));
      li.append(el('small', '', k), el('b', '', v), el('span', `g-have${have.startsWith('✓') ? ' ok' : ''}`, have));
      chain.append(li);
    }
    rec.append(chain);
    const [mn, mx] = castRange(rod, it, term);
    rec.append(el('p', 'g-note', `Casts ${mn}–${mx} m. ${this.presentation(sp, rod, it)}`));
    kids.push(rec);

    // 5: rigging up, where the rules allow.
    kids.push(step(3, 'Rig up'));
    const acts = el('div', 'g-acts');
    const rigged = g.rod === rod.id && g.rig[rod.id] === it.id && lineOf(g, rod).id === line.id && termOf(g, rod).id === term.id;
    if (rigged) acts.append(el('span', 'g-ok', '✓ This is what you’re fishing with'));
    else if (hasRod && hasItem) acts.append(btn('Rig it now', () => { const msg = this.hooks.rig(s); this.renderTrip(box, e); this.flash(msg); }, 'g-btn go'));
    else if (this.hooks.atBox()) {
      const room = (hasRod || g.pack.rods.length < PACK.rods) && (hasItem || g.pack.items.length < PACK.items);
      acts.append(btn(room ? 'Pack it and rig it' : 'Pack it and rig it (making room)', () => { const msg = this.hooks.packAndRig(s); this.renderTrip(box, e); this.flash(msg); }, 'g-btn go'));
      if (!room) acts.append(el('p', 'g-note', `Your backpack is full (${PACK.rods} rods, ${PACK.items} baits and lures): the ${!hasRod ? 'rod you aren’t holding' : 'tackle none of your rods uses'} goes back in the tackle box, and you’ll be told what.`));
    } else {
      const missing = [!hasRod && rod.name, !hasItem && it.name].filter(Boolean).join(' and ');
      acts.append(el('p', 'g-miss', `Not carried: ${missing}. You can only swap tackle at a tackle box: at a camp, or in a motorboat’s locker.`));
      const preset = SETUPS.find((x) => x.rods.includes(rod.id) && x.items.includes(it.id));
      if (preset) acts.append(el('p', 'g-note', `The ready-made “${preset.name}” setup has both.`));
    }
    acts.append(btn('Open in the backpack', () => this.hooks.openPack({ type: 'item', id: it.id })));
    kids.push(acts);

    // 6: marking the water, and setting off.
    kids.push(step(4, 'Set off'));
    const place = places[this.ui.tripPlace];
    const go = el('div', 'g-acts');
    if (place && (!trip || trip.sp !== sp.id)) {
      go.append(btn(trip ? 'Start this trip instead' : 'Mark the water and start the trip', () => {
        const msg = this.hooks.startTrip(place, s, sp.id);
        this.renderTrip(box, e);
        this.flash(msg);
      }, 'g-btn go'));
      go.append(el('p', 'g-note', `${place.name}: ${Math.round(place.dist)} m ${place.dir}. A marker shows the way, and the map rings the water. Your catches are counted for the trip until you end it here.`));
    } else if (place) go.append(el('p', 'g-note', 'Under way. Follow the marker; end the trip here when you’re done to keep a record of it.'));
    kids.push(go);
    box.replaceChildren(...kids);
  }

  sources(e) {
    const r = e.reg;
    if (!r?.sources?.length) {
      if (e.legacy || e.fresh) return [el('p', 'g-note', e.fresh ? `Freshwater species: kept apart from the Atlantic register. ${e.fresh.note}` : '')];
      if (e.south) return [el('p', 'g-note', `A fish of Las Brasas, outside the Atlantic register (Royan to Cádiz). In reality: ${e.south.note}`)];
      return [];
    }
    const d = el('details', 'g-sources');
    d.append(el('summary', '', `Sources (${r.sources.length})`));
    const ul = el('ul');
    for (const s of r.sources) {
      const li = el('li');
      const a = el('a', '', s.title || s.url);
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.append(a);
      ul.append(li);
    }
    d.append(ul);
    if (r.uncertain) d.append(el('p', 'g-note', `Uncertain: ${r.uncertain}`));
    return [d];
  }

  flash(msg) {
    const s = document.querySelector('#journal .g-flash');
    if (s) s.textContent = msg || '';
  }

  render() {
    this.renderIndex($('g-index'));
    this.renderPage($('g-page'));
  }

  // Open on a species (from the backpack, a catch card, or anywhere else).
  show(id) {
    if (fishById[id]) this.ui.sel = id;
  }

  close() {
    this.stage.release();
  }
}
