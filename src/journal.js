import { FISH, fishById, drawFishSketch, drawLanternSketch } from './fish.js';
import { TACKLE, RODS, KIND_NAMES } from './tackle.js';
import { PLACES, MAP_RECT, PATH, ZONE_NAMES, solidHeight } from './world/terrain.js';
import { formatClock } from './world/sky.js';

const $ = (id) => document.getElementById(id);
const ZONE_WORDS = { bay: 'in Willow Bay', cove: 'in Driftwood Cove', open: 'out on open water', lake: 'in Reedmere', stream: 'in Fernbeck' };
const SOMEDAY = ['a softer cushion', 'a potted fern', 'a little cabin by the lake'];
const OUTCOME_WORDS = { released: 'Released', kept: 'Kept', cooked: 'Cooked', eaten: 'Eaten' };
const RAIN_WORDS = ['', 'light rain', 'rain'];
const PAGE = 25;

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
    if (view === 'log') this.renderLog();
    this.el.querySelectorAll('.page').forEach((p) => { p.scrollTop = 0; });
  }

  get isOpen() { return !this.el.hidden; }

  // where = { boat, walker (when ashore), camp }
  open(where) {
    this.render(where);
    this.shown = PAGE;
    this.show(this.view);
    this.el.hidden = false;
  }

  close() {
    this.el.hidden = true;
  }

  render(where) {
    const st = this.state;
    const salt = FISH.filter((f) => f.water !== 'fresh'), fresh = FISH.filter((f) => f.water === 'fresh');
    this.fishEl.replaceChildren(
      el('h3', 'j-water', 'Salt water'), ...salt.map((f) => this.fishEntry(f, st.fish[f.id])),
      el('h3', 'j-water', 'Fresh water'), ...fresh.map((f) => this.fishEntry(f, st.fish[f.id])),
    );

    this.placesEl.replaceChildren(...PLACES.map((p) => {
      const li = el('li', st.places[p.id] ? '' : 'faint');
      if (st.places[p.id]) {
        li.append(el('strong', '', p.name), el('span', '', p.note));
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
    const art = el('article', rec ? 'j-entry' : 'j-entry unknown');
    const cv = el('canvas');
    cv.width = 320;
    cv.height = 170;
    drawFishSketch(cv.getContext('2d'), f, 160, 86, 250, { unknown: !rec });
    const text = el('div', 'j-text');
    text.append(el('h3', '', rec ? f.name : 'Unknown fish'), el('p', 'j-note', rec ? f.note : f.hint));
    if (rec) {
      text.append(el('p', 'j-meta', `${rec.count} caught · best ${rec.best} cm · ${f.where}`));
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
    return `${rod}${item ? `, ${item.toLowerCase()}` : ''} · from the ${e.from}`;
  }

  // What the water was like: depth, rain, a hatch. Only what the game knew at the time.
  static conditionsText(e) {
    const bits = [];
    if (e.item && TACKLE[e.item]?.fly === 'dry') bits.push('on the surface');
    else if (e.depth < 0.15 && e.kind !== 'ledger') bits.push('just under the surface');
    else if (e.kind === 'ledger') bits.push(`on the bottom${e.bottom ? ` in ${e.bottom} m` : ''}`);
    else bits.push(`at ${e.depth} m${e.bottom ? ` in ${e.bottom} m of water` : ''}`);
    if (e.rain) bits.push(RAIN_WORDS[e.rain]);
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
      summary.push(`${total} fish caught, ${species} of ${FISH.length} kinds.`);
      if (log.length) summary.push(`${log.length - kept} released, ${kept} kept for the pot.`);
      const before = total - log.length;
      if (before > 0) summary.push(`${before} earlier catch${before > 1 ? 'es' : ''} from before this log began ${before > 1 ? 'are' : 'is'} counted in the totals, without details.`);
    }
    $('log-summary').textContent = summary.join(' ');

    // The biggest fish in the log (by length: the game measures fish, it doesn't weigh them).
    const best = log.reduce((b, e) => (!b || e.size > b.size ? e : b), null);
    const bestEl = $('log-best');
    bestEl.replaceChildren();
    bestEl.className = best ? 'j-best' : '';
    if (best) {
      const f = fishById[best.sp];
      const cv = el('canvas');
      cv.width = 260;
      cv.height = 140;
      drawFishSketch(cv.getContext('2d'), f, 130, 72, 210);
      const txt = el('div');
      txt.append(
        el('span', 'j-label', 'Biggest catch'),
        el('strong', '', `${f.name}, ${best.size} cm`),
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
      row.append(el('strong', '', f.name), el('span', 'j-n', `${rec.count} caught · best ${rec.best} cm`));
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
      const name = el('strong', '', `${f?.name || e.sp} · ${e.size} cm`);
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
    const boat = where?.boat;
    if (boat) {
      const [bx, by] = toPx(boat.pos.x, boat.pos.z);
      const fx = Math.sin(boat.heading), fz = Math.cos(boat.heading);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.atan2(fz, fx));
      ctx.fillStyle = '#b5532f';
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
