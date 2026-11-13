import { goalsOf } from './goals.js';
import { FISH, fishById, drawFishSketch, drawLanternSketch, weightOf } from './fish.js';
import { hasAnatomy } from './anatomy.js';
import { studio } from './gearView.js';
import { TACKLE, RODS, KIND_NAMES } from './tackle.js';
import { VESSELS } from './vessels.js';
import { PLACES, MAP_RECT, PATH, ZONE_NAMES, solidHeight } from './world/terrain.js';
import { formatClock } from './world/sky.js';
import { dayPage, dayText, careerOf, CHALLENGES } from './daybook.js';
import { voyageWords } from './voyages.js';
import { groundsOf, groundWords, SIGNS, NATURE, NATURE_IDS } from './grounds.js';
import { SEA_LIFE } from './world/sealife.js';
import { SITE_DETAILS, foundWords } from './world/divesites.js';
import { treeOf, byOrder, recordOf, IUCN, KINGDOMS } from './taxonomy.js';

const $ = (id) => document.getElementById(id);
const ZONE_WORDS = {
  bay: 'in Willow Bay', cove: 'in Driftwood Cove', open: 'out on open water', lake: 'in Reedmere', stream: 'in Fernbeck',
  estuary: 'in the Wend estuary', mere: 'on Longmere', coast: 'off the outer coast', deep: 'out on the Blue Water',
};
const SKY_WORDS = { clear: 'clear sky', partly: 'some cloud', overcast: 'overcast', light: 'light rain', heavy: 'heavy rain' };
// The journal's pages of fish, by where they live (squid get a page of their own: not fish).
const GROUPS = [
  { name: 'Willow Bay and the coves', test: (f) => !f.creature && f.water !== 'fresh' && !f.life.zones.some((z) => ['estuary', 'coast', 'deep'].includes(z)) },
  { name: 'The Wend estuary (brackish water)', test: (f) => !f.creature && f.water !== 'fresh' && f.life.zones.includes('estuary') },
  { name: 'The outer coast and the open sea', test: (f) => !f.creature && f.water !== 'fresh' && !f.life.zones.includes('estuary') && f.life.zones.some((z) => z === 'coast' || z === 'deep') },
  { name: 'Fresh water: the meres and the stream', test: (f) => !f.creature && f.water === 'fresh' },
  { name: 'Not fish', test: (f) => !!f.creature },
];
// A species' picture on a journal page: the same model it has in the water (its silhouette until
// you've caught one), or the older sketch for species without one. Models are photographed a few
// per frame so opening the journal never stalls.
const pending = [];
let pumping = false;
function drawSpecies(cv, f, { unknown = false, len = 0.78 } = {}) {
  if (!hasAnatomy(f.id)) {
    drawFishSketch(cv.getContext('2d'), f, cv.width / 2, cv.height / 2 + 1, cv.width * len, { unknown });
    return;
  }
  pending.push({ cv, f, unknown });
  if (pumping) return;
  pumping = true;
  const step = () => {
    const t0 = performance.now();
    while (pending.length && performance.now() - t0 < 12) {
      const { cv: c, f: sp, unknown: u } = pending.shift();
      if (!c.isConnected) continue;
      const img = new Image();
      img.onload = () => {
        const x = c.getContext('2d');
        x.clearRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        if (u) {
          // Not caught yet: only its shape, in pencil, and a question mark.
          x.globalCompositeOperation = 'source-in';
          x.fillStyle = 'rgba(58, 46, 38, 0.16)';
          x.fillRect(0, 0, c.width, c.height);
          x.globalCompositeOperation = 'source-over';
          x.fillStyle = 'rgba(58, 46, 38, 0.55)';
          x.font = `700 ${Math.round(c.height * 0.32)}px Caveat, cursive`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText('?', c.width / 2, c.height / 2);
        }
      };
      img.src = studio().thumb({ type: 'fish', id: sp.id }, c.width, c.height);
    }
    if (pending.length) requestAnimationFrame(step);
    else pumping = false;
  };
  requestAnimationFrame(step);
}

// Which water each named area is, for what you've caught there.
const AREA_ZONES = { bay: ['bay', 'open'], cove: ['cove'], lake: ['lake'], stream: ['stream'], wend: ['estuary'], mere: ['mere'], gannet: ['coast'], deep: ['deep'] };

// 850 g, 3.4 kg
export function weightText(kg) {
  return kg < 1 ? `${Math.max(5, Math.round((kg * 1000) / 5) * 5)} g` : `${kg < 10 ? kg.toFixed(1) : Math.round(kg)} kg`;
}
const SOMEDAY = ['a softer cushion', 'a potted fern', 'a little cabin by the lake'];
const OUTCOME_WORDS = { released: 'Released', kept: 'Kept', cooked: 'Cooked', eaten: 'Eaten', sold: 'Sold' };
const RAIN_WORDS = ['', 'light rain', 'rain'];
const PAGE = 25;
const BOAT_COLORS = { row: '#b5532f', skiff: '#2f4f7a', kayak: '#e8742a', bass: '#7a2430', cabin: '#1f4e5f', sail: '#c4774a', cruiser: '#1d3b56', console: '#3a8fc4', windsurf: '#f2a32a', jetski: '#e8b820' };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export class Journal {
  constructor(state) {
    this.state = state;
    this.el = $('journal');
    this.fishEl = $('j-fish');
    this.placesEl = $('j-places');
    this.itemsEl = $('j-items');
    this.map = $('j-map');
    this.mapBase = null;
    this.view = 'fish';
    this.shown = PAGE;
    this.el.querySelectorAll('.j-tabs button').forEach((b) => b.addEventListener('click', () => this.show(b.dataset.view)));
    for (const id of ['f-species', 'f-water', 'f-method', 'f-outcome']) {
      $(id).addEventListener('change', () => {
        this.shown = PAGE;
        this.renderList();
      });
    }
    $('log-more').addEventListener('click', () => {
      this.shown += PAGE;
      this.renderList();
    });
  }

  // Switch between the fish & places pages and the catch log.
  show(view) {
    this.view = view;
    this.el.querySelectorAll('.j-tabs button').forEach((b) => {
      b.classList.toggle('on', b.dataset.view === view);
      b.setAttribute('aria-pressed', b.dataset.view === view);
    });
    this.el.querySelectorAll('.j-fish-view').forEach((e) => { e.hidden = view !== 'fish'; });
    this.el.querySelectorAll('.j-log-view').forEach((e) => { e.hidden = view !== 'log'; });
    this.el.querySelectorAll('.j-guide-view').forEach((e) => { e.hidden = view !== 'guide'; });
    this.el.querySelectorAll('.j-mem-view').forEach((e) => { e.hidden = view !== 'memories'; });
    this.el.querySelectorAll('.j-days-view').forEach((e) => { e.hidden = view !== 'days'; });
    this.el.querySelectorAll('.j-voyages-view').forEach((e) => { e.hidden = view !== 'voyages'; });
    this.el.querySelectorAll('.j-notes-view').forEach((e) => { e.hidden = view !== 'notes'; });
    this.el.querySelectorAll('.j-species-view').forEach((e) => { e.hidden = view !== 'species'; });
    this.el.querySelector('.book').dataset.view = view;
    // (On a phone the tabs scroll sideways: keep the one you're on in sight.)
    this.el.querySelector('.j-tabs button.on')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
    if (view === 'log') this.renderLog();
    if (view === 'memories') this.memories?.render();
    if (view === 'days') this.renderDays();
    if (view === 'voyages') this.renderVoyages();
    if (view === 'notes') this.renderNotes();
    if (view === 'species') this.renderSpecies();
    if (view === 'guide') this.guide?.render();
    else this.guide?.close();
    this.el.querySelectorAll('.page').forEach((p) => { p.scrollTop = 0; });
  }

  get isOpen() { return !this.el.hidden; }

  // where = { boats, walker (when ashore), camp }
  open(where) {
    this.render(where);
    this.shown = PAGE;
    this.el.hidden = false;
    this.show(this.view);
  }

  close() {
    this.el.hidden = true;
    this.guide?.close();
  }

  // Straight to a species in the field guide.
  openGuide(where, id) {
    if (id) this.guide.show(id);
    this.view = 'guide';
    this.open(where);
  }

  // The day book (see daybook.js): today so far and the days before, your record, and the
  // harbour's challenges.
  renderDays() {
    const st = this.state;
    const page = (p, today = false) => {
      const d = el('div', `j-day${today ? ' today' : ''}`);
      d.append(el('strong', '', `Day ${p.day} · ${p.season}`), el('p', '', dayText(p) || 'A quiet day.'));
      return d;
    };
    const now = st.today ? dayPage(st, st.today) : null;
    $('days-today-when').textContent = `day ${st.day}, ${formatClock(st.hour)}`;
    $('days-today').replaceChildren(now ? page(now, true) : el('p', 'j-faint', 'Nothing written yet today. Go out, and it will be.'));
    const days = st.days.slice().reverse();
    $('days-list').replaceChildren(...(days.length ? days.map((p) => page(p)) : [el('p', 'j-faint', 'Each day you go out is written up here when it ends: when you sleep, or at midnight.')]));
    const C = careerOf(st);
    // What there is to aim for (see goals.js), under the record.
    {
      let box = $('rec-goals');
      if (!box) {
        box = el('div', 'j-goals');
        box.id = 'rec-goals';
        $('rec-totals').after(box);
      }
      const G = goalsOf(st, { places: [careerOf(st).places, careerOf(st).placesOf] });
      box.replaceChildren(el('h3', '', `Goals · ${G.filter((g) => g.done).length} of ${G.length}`), ...G.map((g) => {
        const r = el('p', `j-goal${g.done ? ' done' : ''}`, `${g.done ? '✓' : '○'} ${g.text}`);
        if (g.of > 1) r.append(el('span', 'j-faint', ` · ${g.n} of ${g.of}`));
        return r;
      }));
    }
    const dl = $('rec-totals');
    const row = (k, v) => [el('dt', '', k), el('dd', '', v)];
    dl.replaceChildren(
      ...row('Days written up', String(C.days)),
      ...row('Fish caught', C.fish ? `${C.fish} (${C.kept} kept, ${C.released} let go)` : 'none yet'),
      ...row('Kinds', String(C.kinds)),
      ...row('Places found', `${C.places} of ${C.placesOf}`),
      ...row('Dives', C.dives ? `${C.dives} · deepest ${C.deepest.toFixed(1)} m${C.longest ? ` · longest breath ${Math.round(C.longest)} s` : ''}` : 'none yet'),
      ...row('Dive sites', `${C.sites} of ${C.sitesOf}`),
      ...row('Sea life seen', `${C.life} kinds`),
    );
    const sp = (id) => fishById[id]?.name || id;
    $('rec-bests').replaceChildren(...(C.bests.length ? C.bests.slice(0, 12).map((b) => {
      const li = el('li', '', `${sp(b.sp)}, ${b.size} cm `);
      li.append(el('small', '', `(${b.count} caught; they grow to ${fishById[b.sp].size[1]} cm here)`));
      return li;
    }) : [el('li', 'j-faint', 'Nothing yet.')]));
    $('rec-notable').replaceChildren(...(C.notable.length ? C.notable.map((e) => {
      const li = el('li', '', `${sp(e.sp)}, ${e.size} cm `);
      li.append(el('small', '', `day ${e.day}${e.place ? `, ${e.place}` : ''}${e.outcome === 'released' ? ', let go' : ''}`));
      return li;
    }) : [el('li', 'j-faint', 'A fish near the top of its size, when you catch one, is remembered here.')]));
    $('rec-challenges').replaceChildren(...CHALLENGES.map((c) => {
      const got = st.badges?.[c.id], p = c.check(st);
      const li = el('li', got ? 'done' : '');
      const dot = el('i', 'rec-badge');
      dot.style.background = c.color;
      li.append(dot, el('b', '', c.name), el('span', '', `${c.text} ${got ? `Done, day ${got.day}.` : p.of > 1 ? `${Math.min(p.n, p.of)} of ${p.of}.` : ''}`));
      return li;
    }));
  }

  // (G1) Voyages (see voyages.js): each one kept, the newest first, with what happened on it and
  // her papers' lines from it; the one under way; and the voyages in all.
  renderVoyages() {
    const st = this.state, list = (st.voyages || []).slice().reverse();
    const names = { boat: (k) => VESSELS[k]?.name || k, life: (k) => (SEA_LIFE[k]?.name || k).split(' ').map((w) => (/^(Atlantic|European|Eurasian|Mediterranean|Canary|Manx)$/.test(w) || /[’']s$/.test(w) ? w : w.toLowerCase())).join(' ') };
    $('voy-count').textContent = list.length ? String(list.length) : '';
    $('voy-list').replaceChildren(...(list.length ? list.map((R) => {
      const W = voyageWords(R, names), d = el('div', 'j-day');
      d.append(el('strong', '', W.title), el('small', 'j-faint', W.when), el('p', '', W.lines.join(' ')));
      if (W.log.length) {
        const ul = el('ul', 'j-voy-log');
        for (const line of W.log) ul.append(el('li', '', line));
        d.append(ul);
      }
      return d;
    }) : [el('p', 'j-faint', 'None yet. Take her out past the bay, stay out a night, or cross to Las Brasas, and when she’s tied up again the voyage is written up here.')]));
    const V = st.voyage;
    $('voy-now').replaceChildren(V ? el('p', '', `Since day ${V.day}, ${formatClock(V.hour)}, from ${V.from}, in ${V.boats.map((k) => `the ${names.boat(k)}`).join(' and ')}: ${(V.m / 1852).toFixed(1)} nm so far${V.far > 400 ? `, ${(V.far / 1000).toFixed(1)} km out at the furthest${V.farAt ? ` (${V.farAt})` : ''}` : ''}${V.fish ? `, ${V.fish} fish` : ''}.`) : el('p', 'j-faint', 'Not under way: she’s at a berth.'));
    const all = st.voyages || [], sum = (f) => all.reduce((s, r) => s + f(r), 0);
    const far = all.reduce((a, r) => (!a || r.far > a.far ? r : a), null), long = all.reduce((a, r) => (!a || r.nm > a.nm ? r : a), null);
    const row = (k, v) => [el('dt', '', k), el('dd', '', v)];
    $('voy-totals').replaceChildren(
      ...row('Voyages', String(all.length)),
      ...row('Sea miles', `${sum((r) => r.nm).toFixed(1)} nm`),
      ...row('Nights out', String(sum((r) => r.nights))),
      ...row('Crossings', String(sum((r) => r.cross.filter((c) => c.stage === 'in').length))),
      ...row('The longest', long ? `${long.title}, ${long.nm} nm` : '—'),
      ...row('The furthest out', far && far.far > 400 ? `${(far.far / 1000).toFixed(1)} km${far.farAt ? `, ${far.farAt}` : ''}` : '—'),
    );
  }

  // The tree of life (see taxonomy.js): every living thing on the coast by kingdom, phylum and
  // class on the left; the chosen group by order and family on the right, each with what you've
  // recorded of it (caught, seen, met on a dive, or heard) or where to look.
  renderSpecies() {
    const st = this.state, tree = treeOf(st);
    const total = tree.reduce((s, k) => s + k.of, 0), got = tree.reduce((s, k) => s + k.n, 0);
    $('sp-count').textContent = `${got} of ${total} recorded`;
    // (The group shown: the one chosen, or the first with something recorded in it.)
    const groups = tree.flatMap((K) => K.phyla.flatMap((P) => [...P.classes.map((C) => ({ key: `cls:${C.id}`, ...C })), ...(P.loose.length ? [{ key: `phy:${P.id}`, ...P, entries: P.loose, of: P.loose.length, n: P.loose.filter((e) => recordOf(st, e)).length }] : [])]));
    if (!groups.some((g) => g.key === this.spSel)) this.spSel = (groups.find((g) => g.n) || groups.find((g) => g.id === 'mammalia') || groups[0]).key;
    const bar = (n, of) => {
      const b = el('span', 'sp-bar');
      const f = el('span', 'sp-fill');
      f.style.width = `${Math.round((100 * n) / Math.max(1, of))}%`;
      b.append(f);
      return b;
    };
    const pick = (g) => {
      const b = el('button', `sp-class${g.key === this.spSel ? ' on' : ''}`);
      b.type = 'button';
      b.setAttribute('aria-pressed', g.key === this.spSel);
      b.append(el('span', 'sp-cname', g.name), el('i', 'sp-sci', g.sci), el('span', 'sp-n', `${g.n} of ${g.of}`), bar(g.n, g.of));
      b.addEventListener('click', () => {
        this.spSel = g.key;
        this.renderSpecies();
        // (Side by side, the right page back to its top; on a phone, where the pages stack, down to it.)
        const page = $('sp-group').closest?.('.page');
        if (globalThis.innerWidth <= 760) $('sp-group').scrollIntoView?.({ block: 'start' });
        else if (page) page.scrollTop = 0;
      });
      return b;
    };
    const out = [];
    for (const K of tree) {
      const head = el('h3', 'sp-kingdom', `${K.name} `);
      head.append(el('i', '', K.sci), el('span', 'count', `${K.n} of ${K.of}`));
      out.push(head);
      if (KINGDOMS[K.id].note) out.push(el('p', 'sp-note', KINGDOMS[K.id].note));
      for (const P of K.phyla) {
        const box = el('div', 'sp-phylum');
        const ph = el('div', 'sp-phead');
        ph.append(el('b', '', P.name), document.createTextNode(' '), el('i', '', P.sci));
        box.append(ph);
        if (P.note) box.append(el('p', 'sp-note', P.note));
        for (const g of groups.filter((g) => (g.key.startsWith('cls:') && g.phylum === P.id) || g.key === `phy:${P.id}`)) box.append(pick(g));
        out.push(box);
      }
    }
    $('sp-tree').replaceChildren(...out);
    $('sp-group').replaceChildren(...this.speciesGroup(groups.find((g) => g.key === this.spSel)));
  }

  speciesGroup(g) {
    const st = this.state, out = [];
    const h = el('h2', '', `${g.name} `);
    h.append(el('i', 'sp-sci', g.sci), el('span', 'count', `${g.n} of ${g.of}`));
    out.push(h);
    if (g.note) out.push(el('p', 'j-faint', g.note));
    for (const O of byOrder(g.entries)) {
      if (O.info) {
        const oh = el('h3', 'sp-order');
        oh.append(el('span', 'sp-rank', O.info.open ? '' : 'Order '), el('i', '', O.info.sci), el('span', 'sp-what', ` · ${O.info.name}`));
        out.push(oh);
      }
      for (const F of O.families) {
        if (F.family) {
          const fh = el('h4', 'sp-family');
          fh.append(el('span', 'sp-rank', 'Family '), el('i', '', F.family), el('span', 'sp-what', F.name ? ` · ${F.name}` : ''));
          out.push(fh);
        }
        for (const e of F.entries) out.push(this.speciesCard(e, recordOf(st, e)));
      }
    }
    return out;
  }

  speciesCard(e, R) {
    const card = el('article', `sp-card${R ? '' : ' faint'}`);
    const top = el('div', 'sp-top');
    top.append(el('b', '', e.name), document.createTextNode(' '), el('i', '', e.sci || ''));
    if (e.rank !== 'species') top.append(el('span', 'sp-rank', ` (${e.rank === 'genus' ? 'a genus: several species' : e.rank === 'family' ? 'a family: several species' : 'a whole phylum'})`));
    if (e.iucn && IUCN[e.iucn]) {
      const b = el('span', `iucn iucn-${e.iucn}`, e.iucn);
      b.title = `IUCN Red List: ${IUCN[e.iucn]}`;
      b.setAttribute('aria-label', `IUCN Red List: ${IUCN[e.iucn]}`);
      top.append(b);
    }
    card.append(top);
    if (R) {
      const n = R.n === 1 ? 'once' : `${R.n} times`;
      const first = R.day ? ` · first on day ${R.day}${R.where ? `, ${R.where}` : ''}` : '';
      const line = R.how === 'caught' ? `Caught ${R.n === 1 ? 'one' : R.n}${R.best ? ` · best ${R.best} cm` : ''}`
        : R.how === 'heard' ? `Heard ${n}${first}, not yet seen`
          : R.how === 'met' ? `Met on ${R.n === 1 ? 'a dive' : `${R.n} dives`}${first}` : `Seen ${n}${first}`;
      card.append(el('p', 'j-seen', line), el('p', 'sp-text', e.note || ''));
    } else card.append(el('p', 'sp-text', e.look ? `Where to look: ${e.look}` : 'Not recorded yet.'));
    if (e.kind === 'fish' && this.guide) {
      const b = el('button', 'sp-guide', 'In the field guide');
      b.type = 'button';
      b.addEventListener('click', () => {
        this.guide.show(e.id);
        this.show('guide');
      });
      card.append(b);
    }
    return card;
  }

  // Notes (see grounds.js): the grounds as your catches tell them, the signs you've read, and the
  // naturalist's field notes.
  renderNotes() {
    const st = this.state, G = st.grounds || { signs: {}, notes: {} };
    const grounds = groundsOf(st.log);
    $('notes-grounds').replaceChildren(...(grounds.length ? grounds.slice(0, 24).map((P) => {
      const d = el('div', 'n-place');
      d.append(el('strong', '', `${P.place} · ${P.n} fish`));
      for (const K of P.kinds.slice(0, 5)) d.append(el('p', '', groundWords(K)));
      if (P.kinds.length > 5) d.append(el('p', 'j-faint', `and ${P.kinds.length - 5} more kind${P.kinds.length - 5 === 1 ? '' : 's'}.`));
      return d;
    }) : [el('p', 'j-faint', 'Nothing yet. Every fish you catch tells you something about where it was: once there are a few from a place, its tides and hours show here.')]));
    $('notes-signs').replaceChildren(...Object.entries(SIGNS).map(([k, S]) => {
      const R = G.signs[k], li = el('li', R?.read ? 'done' : '');
      const under = R && Object.keys(R.sp).length ? ` Under it: ${Object.entries(R.sp).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${fishById[id]?.name.toLowerCase() || id}${n > 1 ? ` (${n})` : ''}`).join(', ')}.` : '';
      li.append(el('i', 'rec-badge'), el('b', '', S.name), el('span', '', R ? `${S.note} Seen ${R.seen === 1 ? 'once' : `${R.seen} times`}${R.read ? `, read ${R.read === 1 ? 'once' : `${R.read} times`}` : ': fish under one soon after you see it, and you’ll find out what it was'}.${under}` : `${S.note} Not seen yet.`));
      return li;
    }));
    const met = NATURE_IDS.filter((k) => G.notes[k]).length;
    $('notes-life-count').textContent = `${met} of ${NATURE_IDS.length}`;
    $('notes-life').replaceChildren(...NATURE_IDS.map((k) => {
      const N = NATURE[k], R = G.notes[k], d = el('div', `n-life${R ? '' : ' faint'}`);
      if (R) {
        d.append(el('b', '', N.name), document.createTextNode(' '), el('i', '', N.latin), el('p', '', N.note), el('p', 'j-seen', `First met day ${R.day}${R.where ? `, ${R.where}` : ''}${R.n > 1 ? `; met on ${R.n} dives` : ''}.`));
      } else d.append(el('b', '', '· · ·'), el('p', '', 'Not met yet: dive, and look closely at the bottom.'));
      return d;
    }));
    const sea = Object.entries(st.seaLife || {}).filter(([k]) => SEA_LIFE[k]);
    $('notes-sea').replaceChildren(...(sea.length ? sea.map(([k, R]) => {
      const d = el('div', 'n-life');
      d.append(el('b', '', SEA_LIFE[k].name), el('p', '', SEA_LIFE[k].note), el('p', 'j-seen', `First ${R.heard ? 'heard' : 'seen'} day ${R.day}${R.where ? `, ${R.where}` : ''}; ${R.heard ? 'heard' : 'seen'} ${R.n === 1 ? 'once' : `${R.n} times`}.`));
      return d;
    }) : [el('p', 'j-faint', 'Dolphins, seals, whales and the gannets: watch from the boat.')]));
  }

  render(where) {
    const st = this.state;
    this.fishEl.replaceChildren(...GROUPS.flatMap((g) => {
      // (Retired fictional fish only if you caught one; protected ones once you've seen one.)
      const list = FISH.filter((f) => g.test(f) && (!f.retired || st.fish[f.id]) && (!f.life.observe || st.observed?.[f.id]));
      const n = list.filter((f) => st.fish[f.id]).length;
      const head = el('h3', 'j-water', g.name);
      head.append(el('span', 'count', `${n} of ${list.length}`));
      return [head, ...list.map((f) => this.fishEntry(f, st.fish[f.id]))];
    }));

    // What lives where: the kinds you've caught in each water you've found.
    const seenIn = {};
    for (const e of st.log) (seenIn[e.zone] = seenIn[e.zone] || new Set()).add(e.sp);
    this.placesEl.replaceChildren(...PLACES.map((p) => {
      const li = el('li', st.places[p.id] ? '' : 'faint');
      if (st.places[p.id]) {
        li.append(el('strong', '', p.name), el('span', '', p.note));
        const kinds = new Set((AREA_ZONES[p.id] || []).flatMap((z) => [...(seenIn[z] || [])]));
        if (kinds.size) li.append(el('span', 'j-seen', `Caught here: ${[...kinds].map((id) => fishById[id]?.name.toLowerCase()).join(', ')}`));
        // A dive site: how often you've been down, and how deep.
        const dv = p.dive && st.dive?.sites?.[p.id];
        if (p.dive) li.append(el('span', 'j-seen', dv?.dives ? `Dived ${dv.dives === 1 ? 'once' : dv.dives === 2 ? 'twice' : `${dv.dives} times`}, down to ${dv.deepest.toFixed(1)} m${dv.vis ? `; the clearest water, about ${dv.vis} m` : ''}.` : 'A dive site: not dived yet.'));
        // What there is to find there (see divesites.js), and how much of it you have.
        const all = SITE_DETAILS[p.id];
        if (p.dive && all && dv?.dives) {
          const got = foundWords(p.id, dv.found || []), left = all.length - all.filter((d) => dv.found?.includes(d.id)).length;
          li.append(el('span', 'j-seen', got ? `Found here: ${got}.${left ? ' There’s more to find.' : ''}` : 'Something here is still to find: look around on your next dive.'));
        }
      } else {
        li.append(el('strong', '', '· · ·'), el('span', '', 'Somewhere not yet found.'));
      }
      return li;
    }));

    const items = [];
    if (st.items.lantern) {
      const row = el('div', 'j-keepsake');
      const cv = el('canvas');
      cv.width = 120;
      cv.height = 120;
      drawLanternSketch(cv.getContext('2d'), 60, 64, 52);
      const txt = el('div');
      txt.append(el('strong', '', 'Old brass lantern'), el('span', '', 'Found tangled in the driftwood of the cove. It glows warm at dusk.'));
      row.append(cv, txt);
      items.push(row);
    } else {
      items.push(el('p', 'j-empty', 'Nothing yet. Pockets full of sand.'));
    }
    items.push(el('p', 'j-someday', `Someday: ${SOMEDAY.join(' · ')}`));
    this.itemsEl.replaceChildren(...items);

    this.drawMap(where);
  }

  fishEntry(f, rec) {
    const seen = f.life.observe ? this.state.observed?.[f.id] : null;
    const art = el('article', rec || seen ? 'j-entry' : 'j-entry unknown');
    const cv = el('canvas');
    cv.width = 320;
    cv.height = 170;
    drawSpecies(cv, f, { unknown: !rec && !seen });
    const text = el('div', 'j-text');
    text.append(el('h3', '', rec || seen ? f.name : 'Unknown fish'), el('p', 'j-note', rec || seen ? f.note : f.hint));
    if (seen) {
      // (Protected, or simply one nobody fishes for: the trumpetfish.)
      text.append(el('p', 'j-meta', `Seen ${seen.count} time${seen.count > 1 ? 's' : ''} · ${f.noSpear && f.watch ? 'to watch, not to catch' : 'protected: to watch, not to catch'} · ${f.where}`));
      art.append(cv, text);
      return art;
    }
    if (rec) {
      text.append(el('p', 'j-meta', `${rec.count} caught · best ${rec.best} cm (${weightText(weightOf(f, rec.best))}) · ${f.where}`));
      text.append(el('p', 'j-meta', `First caught ${ZONE_WORDS[rec.firstZone] || ''} at ${formatClock(rec.firstHour)}${rec.firstRain ? ', in the rain' : ''}`));
      // What has worked: written down as you learn it.
      const on = this.state.caughtOn?.[f.id];
      if (on) {
        const list = Object.entries(on).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${TACKLE[id]?.short.toLowerCase() || id}${n > 1 ? ` (${n})` : ''}`);
        text.append(el('p', 'j-meta j-tackle', `Taken on: ${list.join(', ')}`));
      }
    } else {
      text.append(el('p', 'j-meta', 'Not caught yet'));
    }
    art.append(cv, text);
    return art;
  }

  /* ---------------- the catch log ---------------- */

  // Where a logged fish came from, in words: "Reedmere, the fallen alder".
  static whereText(e) {
    const zone = ZONE_NAMES[e.zone] || '';
    const name = e.place && e.place !== zone ? e.place : '';
    return [name, zone].filter(Boolean).join(', ') || 'somewhere on the water';
  }

  // How it was caught: "Spinning rod, small silver spoon · from the shore".
  static howText(e) {
    if (e.kind === 'spear') return 'Speargun · freediving';
    const rod = RODS[e.rod]?.short || KIND_NAMES[e.kind] || e.kind;
    const item = e.item ? TACKLE[e.item]?.name : null;
    // (E3c) Which boat (yours, or a friend's you were crewing in: aboard on foot, so not 'boat'); how
    // long the fight; a friend at your helm, or with the net.
    const from = e.boat && VESSELS[e.boat] ? VESSELS[e.boat].name : e.from;
    const fight = e.fight >= 90 ? ` · fought ${Math.round(e.fight / 60)} minutes` : e.fight >= 20 ? ` · fought ${e.fight} seconds` : '';
    const help = e.helper ? (e.helped === 'net' ? ` · netted by ${e.helper}` : e.helped === 'leader' ? ` · ${e.helper} took the leader` : ` · ${e.helper} at the helm`) : '';
    return `${rod}${item ? `, ${item.toLowerCase()}` : ''}${e.line ? ` · ${e.line}` : ''} · from the ${from}${fight}${help}`;
  }

  // What the water was like: depth, rain, a hatch. Only what the game knew at the time.
  static conditionsText(e) {
    const bits = [];
    const bottom = e.kind === 'ledger' || e.kind === 'bottom';
    if (e.item && TACKLE[e.item]?.fly === 'dry') bits.push('on the surface');
    else if (e.depth < 0.15 && !bottom) bits.push('just under the surface');
    else if (bottom) bits.push(`on the bottom${e.bottom ? ` in ${e.bottom} m` : ''}`);
    else bits.push(`at ${e.depth} m${e.bottom ? ` in ${e.bottom} m of water` : ''}`);
    if (e.sky) bits.push(SKY_WORDS[e.sky]);
    else if (e.rain) bits.push(RAIN_WORDS[e.rain]);
    if (e.water === 'fresh' && e.hatch >= 0.5) bits.push('flies hatching');
    if (e.tide && e.water !== 'fresh') bits.push({ flood: 'on the flood', ebb: 'on the ebb', high: 'at high water', low: 'at low water' }[e.tide]);
    if (e.season) bits.push(`in ${e.season}`);
    if (e.temp != null) bits.push(`water ${Math.round(e.temp)}°C`);
    return bits.join(' · ');
  }

  static whenText(e) {
    return `Day ${e.day} · ${formatClock(e.hour)}`;
  }

  // The entries the filters let through, newest first.
  filtered() {
    const sp = $('f-species').value, water = $('f-water').value, kind = $('f-method').value, out = $('f-outcome').value;
    const list = [];
    for (let i = this.state.log.length - 1; i >= 0; i--) {
      const e = this.state.log[i];
      if (sp && e.sp !== sp) continue;
      if (water && e.water !== water) continue;
      if (kind && e.kind !== kind) continue;
      if (out && !(out === 'cooked' ? e.outcome === 'cooked' || e.outcome === 'eaten' : e.outcome === out)) continue;
      list.push(e);
    }
    return list;
  }

  renderLog() {
    const st = this.state, log = st.log;
    const logged = {};
    for (const e of log) {
      const r = (logged[e.sp] = logged[e.sp] || { n: 0, best: null });
      r.n++;
      if (!r.best || e.size > r.best.size) r.best = e;
    }
    const total = Object.values(st.fish).reduce((a, f) => a + f.count, 0);
    const species = Object.keys(st.fish).length;
    const kept = log.filter((e) => e.outcome !== 'released').length;
    const summary = [];
    if (!total) summary.push('No catches yet. Every fish you land is written down here: where, when, and what it took.');
    else {
      summary.push(`${total} caught, ${species} of ${FISH.filter((f) => !f.retired && !f.life.observe).length} kinds.`);
      if (log.length) summary.push(`${log.length - kept} released, ${kept} kept for the pot.`);
      const before = total - log.length;
      if (before > 0) summary.push(`${before} earlier catch${before > 1 ? 'es' : ''} from before this log began ${before > 1 ? 'are' : 'is'} counted in the totals, without details.`);
    }
    $('log-summary').textContent = summary.join(' ');

    // The heaviest catch in the log (its weight worked out from its length).
    const kg = (e) => weightOf(fishById[e.sp], e.size);
    const best = log.reduce((b, e) => (!b || kg(e) > kg(b) ? e : b), null);
    const bestEl = $('log-best');
    bestEl.replaceChildren();
    bestEl.className = best ? 'j-best' : '';
    if (best) {
      const f = fishById[best.sp];
      const cv = el('canvas');
      cv.width = 260;
      cv.height = 140;
      drawSpecies(cv, f, { len: 0.8 });
      const txt = el('div');
      txt.append(
        el('span', 'j-label', 'Heaviest catch'),
        el('strong', '', `${f.name}, ${best.size} cm, ${weightText(kg(best))}`),
        el('span', '', `${Journal.whenText(best)} · ${Journal.whereText(best)}`),
        el('span', '', Journal.howText(best)),
      );
      bestEl.append(cv, txt);
    }

    // Totals and personal bests for each kind of fish caught so far.
    const caught = FISH.filter((f) => st.fish[f.id]);
    const rows = caught.map((f) => {
      const rec = st.fish[f.id], lg = logged[f.id];
      const row = el('div', 'j-sp');
      row.append(el('strong', '', f.name), el('span', 'j-n', `${rec.count} caught · best ${rec.best} cm, ${weightText(weightOf(f, rec.best))}`));
      if (lg?.best) {
        const b = lg.best;
        const older = rec && rec.best > b.size ? ` (your ${rec.best} cm best was before the log began)` : '';
        row.append(el('span', 'j-detail', `Biggest logged: ${b.size} cm · ${Journal.whenText(b)} · ${Journal.whereText(b)} · ${Journal.howText(b)}${older}`));
      } else row.append(el('span', 'j-detail', 'Caught before the log began: no details recorded.'));
      return row;
    });
    const left = FISH.length - caught.length;
    if (left) rows.push(el('p', 'j-sp-left', `${left} kind${left > 1 ? 's' : ''} of fish still to find.`));
    $('log-species').replaceChildren(...rows);

    // Species filter: the fish that are actually in the log.
    const sel = $('f-species'), was = sel.value;
    const opts = [el('option', '', 'All')];
    opts[0].value = '';
    for (const f of FISH) {
      if (!logged[f.id]) continue;
      const o = el('option', '', f.name);
      o.value = f.id;
      opts.push(o);
    }
    sel.replaceChildren(...opts);
    sel.value = logged[was] ? was : '';
    this.renderList();
  }

  renderList() {
    const list = this.filtered();
    const items = list.slice(0, this.shown).map((e) => {
      const f = fishById[e.sp];
      const li = el('li');
      const top = el('div', 'l-top');
      const name = el('strong', '', `${f?.name || e.sp} · ${e.size} cm${f ? ` · ${weightText(weightOf(f, e.size))}` : ''}`);
      name.append(el('span', `l-tag ${e.outcome}`, OUTCOME_WORDS[e.outcome]));
      top.append(name, el('span', 'l-when', Journal.whenText(e)));
      li.append(top, el('div', 'l-info', `${Journal.whereText(e)} · ${Journal.howText(e)}`), el('div', 'l-info l-cond', Journal.conditionsText(e)));
      return li;
    });
    if (!items.length) {
      items.push(el('li', 'l-empty', this.state.log.length ? 'No catches match these filters.' : 'Your catches will be listed here, newest first.'));
    }
    $('log-list').replaceChildren(...items);
    const more = $('log-more');
    more.hidden = list.length <= this.shown;
    more.textContent = `Show more (${list.length - this.shown} older)`;
  }

  buildMapBase() {
    const W = 330, H = 250;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    const hs = new Float32Array(W * H);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        hs[j * W + i] = solidHeight(MAP_RECT.x + ((i + 0.5) / W) * MAP_RECT.w, MAP_RECT.z + ((j + 0.5) / H) * MAP_RECT.h);
      }
    }
    const d = img.data;
    for (let j = 1; j < H - 1; j++) {
      for (let i = 1; i < W - 1; i++) {
        const k = j * W + i, h = hs[k], o = k * 4;
        const nb = [hs[k - 1], hs[k + 1], hs[k - W], hs[k + W]];
        let r = 0, g = 0, b = 0, a = 0;
        if (h > 0) {
          if (nb.some((n) => n <= 0)) { r = 74; g = 58; b = 44; a = 235; }
          else if (nb.some((n) => Math.floor(n / 9) !== Math.floor(h / 9))) { r = 120; g = 96; b = 66; a = 120; }
          else if (h > 14) { r = 168; g = 140; b = 96; a = 130; }
          else { r = 196; g = 166; b = 116; a = 105; }
        } else if (h > -1.8) { r = 96; g = 150; b = 164; a = 70; }
        else if (h > -2.4) { r = 96; g = 140; b = 160; a = (i + j) % 3 === 0 ? 60 : 0; }
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.mapBase = c;
  }

  drawMap(where) {
    if (!this.mapBase) this.buildMapBase();
    const cv = this.map, ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const toPx = (x, z) => [((x - MAP_RECT.x) / MAP_RECT.w) * W, ((z - MAP_RECT.z) / MAP_RECT.h) * H];
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mapBase, 0, 0, W, H);

    const ink = '#3a2e26';
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Compass
    ctx.save();
    ctx.translate(W - 40, 46);
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 2);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 22px Caveat, cursive';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -30);
    ctx.restore();

    ctx.textBaseline = 'middle';
    for (const p of PLACES) {
      if (!this.state.places[p.id]) continue;
      const [x, y] = toPx(p.x, p.z);
      if (p.area) {
        // Large bodies of water get their name written across them instead of a mark.
        ctx.globalAlpha = 0.55;
        ctx.textAlign = 'center';
        ctx.font = `700 ${p.size || 40}px Caveat, cursive`;
        ctx.fillText(p.name, x, y);
        continue;
      }
      ctx.font = '22px Kalam, cursive';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 6);
      ctx.lineTo(x + 6, y + 6);
      ctx.moveTo(x + 6, y - 6);
      ctx.lineTo(x - 6, y + 6);
      ctx.stroke();
      const right = !p.labelLeft && x < W - 170;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillText(p.name, x + (right ? 12 : -12), y - 2);
    }

    // The path to camp and up the stream, once you've walked it.
    if (this.state.places.camp) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      PATH.forEach(([x, z], i) => {
        const [px, py] = toPx(x, z);
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.stroke();
      ctx.restore();
    }
    if (where?.camp && this.state.places.camp) {
      // A little tent
      const [cx, cy] = toPx(where.camp.x, where.camp.z);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#7f9a6a';
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy + 6);
      ctx.lineTo(cx, cy - 8);
      ctx.lineTo(cx + 9, cy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (where?.walker) {
      const [wx, wy] = toPx(where.walker.pos.x, where.walker.pos.z);
      ctx.save();
      ctx.fillStyle = '#e8b440';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(wx, wy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // The boats as little arrows pointing where they face, each in its own paint.
    for (const b of where?.boats || []) {
      const color = BOAT_COLORS[b.kind] || '#b5532f';
      const [bx, by] = toPx(b.pos.x, b.pos.z);
      const fx = Math.sin(b.heading), fz = Math.cos(b.heading);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.atan2(fz, fx));
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-8, 7);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, -7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
