import { FISH, fishById, drawFishSketch, drawLanternSketch, weightOf } from './fish.js';
import { hasAnatomy } from './anatomy.js';
import { studio } from './gearView.js';
import { TACKLE, RODS, KIND_NAMES } from './tackle.js';
import { PLACES, MAP_RECT, PATH, ZONE_NAMES, solidHeight } from './world/terrain.js';
import { formatClock } from './world/sky.js';

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
const OUTCOME_WORDS = { released: 'Released', kept: 'Kept', cooked: 'Cooked', eaten: 'Eaten' };
const RAIN_WORDS = ['', 'light rain', 'rain'];
const PAGE = 25;
const BOAT_COLORS = { row: '#b5532f', skiff: '#2f4f7a', kayak: '#e8742a', bass: '#7a2430', cabin: '#1f4e5f' };

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
    this.el.querySelector('.book').dataset.view = view;
    if (view === 'log') this.renderLog();
    if (view === 'memories') this.memories?.render();
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
      text.append(el('p', 'j-meta', `Seen ${seen.count} time${seen.count > 1 ? 's' : ''} · protected: to watch, not to catch · ${f.where}`));
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
    const rod = RODS[e.rod]?.short || KIND_NAMES[e.kind] || e.kind;
    const item = e.item ? TACKLE[e.item]?.name : null;
    return `${rod}${item ? `, ${item.toLowerCase()}` : ''}${e.line ? ` · ${e.line}` : ''} · from the ${e.from}`;
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
