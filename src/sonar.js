import { clamp } from './util.js';
import { rockTopAt } from './world/divesites.js';
import { drawUnit, labelFish, PAGES, PAGE_NAMES, PALETTES, ZOOMS } from './sonarUnit.js';
import { bottomOf, bottomWords, layers } from './sonarRead.js';
import { zoneAt, SOUTH_Z } from './world/terrain.js';

const $ = (id) => document.getElementById(id);

const PING_HZ = 10;
const HISTORY = 160; // pings of history (16 seconds)
const CONE = Math.tan((22 * Math.PI) / 180); // the transducer's beam spreads 22° each side
export const RANGES = [3, 5, 10, 15, 20, 30, 40];
// (G7) With a deep sounder on the boat (shipyard.js deepsonar): the bottom to 200 m.
export const DEEP_RANGES = [60, 80, 120, 160, 200];
export const REACH = 70, DEEP_REACH = 250;
const SIZES = [230, 300, 420];
const COLORS = {
  screenTop: '#12293a',
  screenBottom: '#0a1824',
  ground: '#4f4130',
  bottomSoft: '#c9b48a',
  bottomHard: '#fff1d2',
  weed: '#7fc28a',
  weak: [255, 214, 130],
  strong: [255, 112, 64],
  bait: '#9fe3ff',
  shoal: '#7fe0c8', // a bait ball's cloud
  cline: 'rgba(170, 210, 230, 0.32)', // the thermocline's faint band
  scale: 'rgba(233, 244, 240, 0.55)',
  now: 'rgba(233, 244, 240, 0.07)',
};

// The head unit's settings as the save keeps them (see sonarUnit.js): on or not, its width on
// screen (px), the page, the palette, the gain (0 … 10), the range ('auto' or metres), the zoom
// and whether fish show as symbols.
export const UNIT_DEFAULTS = { unit: false, w: 560, page: 'sonar', pal: 0, gain: 5, range: 'auto', zoom: 0, symbols: true };

// A small sonar. In the boat its transducer looks straight down under the hull; on foot it
// works like a castable sonar clipped above your rig, reading the water around it once it's in.
// Every ping reads the real bottom and weeds from the habitat and the real fish in its cone
// from the ecosystem, but like a real one it only shows echoes: arches whose size hints at the
// fish, clouds for small fry, some clutter, and never a name.
//
// E1 (see sonarRead.js): what the bottom is (rock, gravel, sand, mud, weed over either) and how
// hard it sends the ping back, which the bottom band and its second echo show; the water's
// layers (where the summer's warm top gives way to the cold, a faint band at high enough gain, and
// the temperature at the top and the bottom); each fish's echoes joined into one arch as it
// crosses the beam (a fish holding still under a still boat draws a line); a bait ball's cloud.
// And it tells the game what it has shown (hooks.sighted: an arch, a bait ball, the thermocline,
// rock, a drop-off), so a catch soon after can teach you what the arch was (see grounds.js).
//
// The Unit button turns it into a head unit (see sonarUnit.js): a bezel with keys, the 2D sonar
// with a flasher, a down view and the two split, depth, temperature and speed, palettes, gain,
// range and zoom, fish symbols, and a key that marks the spot on your map. Drag it by its bezel,
// resize it from its corner.
export class FishFinder {
  constructor(eco, habitat, state, hooks = {}) {
    this.eco = eco;
    this.habitat = habitat;
    this.state = state;
    this.hooks = hooks;
    state.finder = { x: null, y: null, size: 1, ...UNIT_DEFAULTS, ...(state.finder || {}) };
    this.el = $('sonar');
    this.canvas = $('sonar-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.depthEl = $('sonar-depth');
    this.whereEl = $('sonar-where');
    this.titleEl = $('sonar-title');
    this.legend = $('sonar-legend');
    this.pings = [];
    this.timer = 0;
    this.range = 10;
    this.visible = false;
    this.mode = null;
    this.sample = {};
    this.read = null;
    this.seed = 0;
    // (The water's layers where the sonar is: worked out every two seconds, or after 8 m.)
    this.col = null;
    this.colT = 0;
    this.wasBall = false;
    this.wasKind = null;
    // An imaging transducer on the boat you're in (see shipyard.js): the down view and the split,
    // ranges past 20 m, and the smaller echoes picked out. Without it, the 2D sonar to 20 m.
    this.imaging = false;
    // (G7) A deep sounder on the boat you're in: the ranges down to 200 m.
    this.deep = false;
    $('sonar-help').addEventListener('click', () => this.toggleLegend());
    $('sonar-size').addEventListener('click', () => this.cycleSize());
    $('sonar-unit')?.addEventListener('click', () => this.setUnit(!this.state.finder.unit));
    for (const b of document.querySelectorAll('#sonar-keys [data-k]')) b.addEventListener('click', () => this.key(b.dataset.k));
    this.setupDrag();
    this.setupResize();
    this.applySize();
    this.showKeys();
  }

  /* ---------- the head unit ---------- */

  get unit() { return !!this.state.finder.unit; }

  setUnit(on) {
    this.state.finder.unit = on;
    this.applySize();
    this.fit();
    this.showKeys();
    this.draw();
  }

  // A key on the unit pressed.
  // The pages and the scales this boat's transducer can give.
  get pages() { return this.imaging ? PAGES : ['sonar']; }
  get ranges() {
    if (this.deep) return [...RANGES, ...DEEP_RANGES];
    return this.imaging ? RANGES : RANGES.filter((r) => r <= 20);
  }
  // (How deep it reads the bottom at all, whatever the scale on the screen: an ordinary
  // transducer to about seventy metres, so the shelf's sixty still reads; the deep sounder past
  // the canyon's floor. Past that, the bottom's lost.)
  get reach() { return this.deep ? DEEP_REACH : REACH; }
  // The page showing (the one chosen, if this transducer can give it).
  get page() { return this.pages.includes(this.state.finder.page) ? this.state.finder.page : 'sonar'; }
  // The next page after this one, or null at the last (see the game's finder button).
  get nextPage() {
    const P = this.pages, i = P.indexOf(this.page);
    return i < P.length - 1 ? P[i + 1] : null;
  }

  key(k) {
    const F = this.state.finder, R = this.ranges;
    if (k === 'page') {
      if (!this.imaging) this.hooks.say?.('The down view and the split screen need an imaging sonar on the boat: the Marine Works fits one.');
      const P = this.pages;
      F.page = P[(P.indexOf(this.page) + 1) % P.length];
    } else if (k === 'deeper' || k === 'shallower') {
      // (Range: auto, then each scale; past the deepest or the shallowest, back to auto.)
      const i = F.range === 'auto' || !R.includes(F.range) ? -1 : R.indexOf(F.range);
      const j = k === 'deeper' ? (i < 0 ? R.findIndex((r) => r > this.range) : i + 1) : (i < 0 ? R.findIndex((r) => r >= this.range) - 1 : i - 1);
      F.range = j < 0 || j >= R.length ? 'auto' : R[j];
      if (k === 'deeper' && F.range === 'auto' && !this.imaging && i === R.length - 1) this.hooks.say?.('Deeper than 20 m wants an imaging sonar on the boat: the Marine Works fits one.');
    } else if (k === 'zoom') F.zoom = (F.zoom + 1) % ZOOMS.length;
    else if (k === 'gainUp') F.gain = Math.min(10, F.gain + 1);
    else if (k === 'gainDown') F.gain = Math.max(0, F.gain - 1);
    else if (k === 'colour') F.pal = (F.pal + 1) % PALETTES.length;
    else if (k === 'fish') F.symbols = !F.symbols;
    else if (k === 'mark') {
      // (A reading with no bottom in it, G7, goes too: the game says why there's nothing to mark.)
      this.hooks.mark?.(this.read || null);
    }
    this.showKeys();
    if (this.read) this.range = this.rangeFor();
    this.draw();
  }

  // What the keys say just now.
  showKeys() {
    const F = this.state.finder, set = (k, t) => { const e = document.querySelector(`#sonar-keys [data-k="${k}"] b`); if (e) e.textContent = t; };
    set('page', PAGE_NAMES[this.page]);
    set('shallower', 'shallower');
    set('deeper', F.range === 'auto' ? 'Auto' : `${F.range} m`);
    set('gainDown', 'less');
    set('zoom', ZOOMS[F.zoom]);
    set('gainUp', `${F.gain}`);
    set('colour', PALETTES[F.pal].name);
    set('fish', F.symbols ? 'Symbols' : 'Arches');
    const u = $('sonar-unit');
    if (u) {
      u.textContent = F.unit ? 'Simple' : 'Unit';
      u.setAttribute('aria-pressed', String(!!F.unit));
      u.setAttribute('aria-label', F.unit ? 'Back to the simple fish finder' : 'Switch to the head unit');
    }
    this.el.classList.toggle('unit', !!F.unit);
    $('sonar-keys').hidden = !F.unit;
  }

  // The scale: the one you've chosen on the unit, or the shallowest that shows the bottom.
  rangeFor() {
    const F = this.state.finder, R = this.ranges;
    if (this.unit && F.range !== 'auto' && R.includes(F.range)) return F.range;
    let deepest = 0;
    for (const p of this.pings) deepest = Math.max(deepest, p.bottom);
    return R.find((r) => r >= deepest + 0.6) || R[R.length - 1];
  }

  // The unit's corner: drag to make it bigger or smaller.
  setupResize() {
    const h = $('sonar-resize');
    if (!h) return;
    let drag = null;
    h.addEventListener('pointerdown', (e) => {
      const r = this.el.getBoundingClientRect();
      drag = { id: e.pointerId, x: e.clientX, w: r.width };
      try { h.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      if (!this.el.classList.contains('floating')) this.float(r.left, r.top);
      e.preventDefault();
      e.stopPropagation();
    });
    h.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      this.state.finder.w = Math.round(drag.w + (e.clientX - drag.x));
      this.applySize();
      const r = this.el.getBoundingClientRect();
      this.float(r.left, r.top);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      const r = this.el.getBoundingClientRect();
      this.state.finder.x = r.left / innerWidth;
      this.state.finder.y = r.top / innerHeight;
    };
    h.addEventListener('pointerup', end);
    h.addEventListener('pointercancel', end);
  }

  /* ---------- placing it on the screen ---------- */

  setupDrag() {
    const head = $('sonar-head');
    let drag = null;
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = this.el.getBoundingClientRect();
      drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { head.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      this.float(r.left, r.top);
      this.el.classList.add('dragging');
      e.preventDefault();
      e.stopPropagation();
    });
    head.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      this.float(e.clientX - drag.dx, e.clientY - drag.dy);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      this.el.classList.remove('dragging');
      const r = this.el.getBoundingClientRect();
      this.state.finder.x = r.left / innerWidth;
      this.state.finder.y = r.top / innerHeight;
    };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
    // Double-click the title bar to tuck it back into its usual corner.
    head.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      this.dock();
    });
  }

  // Free-floating at (x, y) pixels, kept fully on screen.
  float(x, y) {
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    const nx = clamp(x, 6, Math.max(6, innerWidth - w - 6));
    const ny = clamp(y, 6, Math.max(6, innerHeight - h - 6));
    this.el.classList.add('floating');
    this.el.style.left = `${nx}px`;
    this.el.style.top = `${ny}px`;
  }

  dock() {
    this.el.classList.remove('floating');
    this.el.style.left = '';
    this.el.style.top = '';
    this.state.finder.x = null;
    this.state.finder.y = null;
  }

  // After a resize (or on first showing), put a moved panel back where it was, still on screen.
  fit() {
    this.applySize();
    const f = this.state.finder;
    if (f.x == null || !this.visible) return;
    this.float(f.x * innerWidth, f.y * innerHeight);
  }

  cycleSize() {
    this.state.finder.size = (this.state.finder.size + 1) % SIZES.length;
    this.applySize();
    this.fit();
  }

  // Your chosen size, but never so big it swamps a small screen.
  applySize() {
    const roomy = innerWidth >= 1100 && innerHeight >= 600 ? 2 : innerWidth >= 700 && innerHeight >= 460 ? 1 : 0;
    const s = Math.min(this.state.finder.size, roomy);
    this.el.classList.remove('size-0', 'size-1', 'size-2');
    this.el.classList.add(`size-${s}`);
    // The unit: as wide as you've made it (within the screen), its screen drawn sharp at that size.
    const c = this.canvas;
    if (this.unit) {
      const w = clamp(this.state.finder.w, 280, Math.max(280, Math.min(innerWidth - 12, (innerHeight - 120) / 0.62)));
      this.state.finder.w = Math.round(w);
      this.el.style.width = `${Math.round(w)}px`;
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1), cw = Math.round((w - 28) * dpr), ch = Math.round(cw * 0.62);
      if (c.width !== cw || c.height !== ch) {
        c.width = cw;
        c.height = ch;
      }
    } else {
      this.el.style.width = '';
      if (c.width !== 600 || c.height !== 330) {
        c.width = 600;
        c.height = 330;
      }
    }
  }

  setVisible(v) {
    this.visible = v;
    this.el.hidden = !v;
    document.body.classList.toggle('sonar-on', v);
    if (v) {
      this.fit();
      this.draw();
    }
  }

  toggleLegend(force) {
    this.legend.hidden = force === undefined ? !this.legend.hidden : !force;
    requestAnimationFrame(() => this.fit());
  }

  // Clear the screen (stepping ashore, or getting back in the boat).
  reset() {
    this.pings = [];
    this.mode = null;
  }

  /* ---------- pinging ---------- */

  update(dt, src, bait) {
    if (!this.visible) return;
    this.colT -= dt;
    if (src.mode !== this.mode) {
      this.mode = src.mode;
      this.pings = [];
      this.titleEl.textContent = src.mode === 'boat' ? 'Fish finder' : 'Castable sonar';
      this.whereEl.textContent = src.mode === 'boat' ? 'below you' : 'at your rig';
      this.timer = 0;
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1 / PING_HZ;
    if (src.mode === 'none') {
      this.depthEl.textContent = '–';
      this.read = null;
      this.draw('Cast your rig: from the shore, the sonar reads the water around it.');
      return;
    }
    const x = src.x, z = src.z;
    const s = this.habitat.sample(x, z, this.sample);
    // (Over the Hound, the pinnacle's rock comes up under you: hard bottom, ten metres down.)
    const top = rockTopAt(x, z);
    if (top != null && -top < s.depth) {
      s.depth = -top;
      s.rock = 1;
      s.weed = 0;
    }
    const B = bottomOf(s, zoneAt(x, z), z > SOUTH_Z);
    if (src.tempAt && (!this.col || this.colT <= 0 || Math.hypot(x - this.col.x, z - this.col.z) > 8)) {
      this.col = { ...layers(src.tempAt, s.depth), x, z };
      this.colT = 2;
    }
    const L = src.tempAt ? this.col : null;
    const raw = this.eco.queryCone(x, z, CONE, []);
    // Echoes, not fish: small or off-centre ones are sometimes missed, depths wobble a little.
    // (The unit's gain: turned up, it picks out fainter echoes, and more clutter with them.)
    const gain = (this.unit ? this.state.finder.gain / 10 : 0.5) + (this.imaging ? 0.15 : 0);
    const echoes = [];
    for (const f of raw) {
      const detect = clamp((0.3 + f.size * 1.1) * (0.6 + 0.8 * gain), 0, 1) * (0.45 + 0.55 * f.strength);
      if (Math.random() > detect) continue;
      echoes.push({
        depth: f.depth * (1 + (Math.random() - 0.5) * 0.06),
        size: f.size * (0.8 + Math.random() * 0.4),
        strength: clamp(f.strength * (0.75 + Math.random() * 0.5), 0.1, 1),
        bait: f.bait,
        id: f.id,
        sp: f.sp, // (never shown: for the game to tell you what an arch was, after a catch)
      });
    }
    // A bait ball: a dense cloud of small baitfish (sprat, sardine, anchovy), which hunters work
    // from below. Shown in its own colour, and named in the readout while it's under you.
    const baitEchoes = echoes.filter((e) => e.bait), baitBall = baitEchoes.length >= 6;
    // (Its cloud: from the shallowest of them to the deepest.)
    let ballTop = null, ballBot = null;
    if (baitBall) for (const e of baitEchoes) {
      ballTop = ballTop == null ? e.depth : Math.min(ballTop, e.depth);
      ballBot = ballBot == null ? e.depth : Math.max(ballBot, e.depth);
    }
    // Specks of drifting debris, and surface clutter when the water is churned up.
    const clutter = [];
    if (Math.random() < 0.08) clutter.push(Math.random() * s.depth);
    const churn = clamp((src.moving || 0) / 3, 0, 1);
    for (let i = 0; i < (2 + churn * 6) * (0.5 + gain); i++) if (Math.random() < 0.5) clutter.push(Math.random() * (0.25 + churn * 0.6));
    let baitDepth = null;
    if (bait.active) {
      const d = -bait.y, r = Math.hypot(bait.x - x, bait.z - z);
      if (d > 0 && r < CONE * d + 0.6) baitDepth = d;
    }
    // (The thermocline, where it's above the bottom.)
    const cline = L && L.cline != null && L.cline < s.depth - 1 ? L.cline : null;
    const prev = this.pings[this.pings.length - 1];
    this.pings.push({
      bottom: s.depth, weed: s.weed, rock: s.rock, hard: B.hard, kind: B.kind, fish: echoes, clutter, bait: baitDepth, ball: baitBall,
      ballTop, ballBot, cline,
      weedH: 0.4 + Math.random() * 0.6, seed: (this.seed = (this.seed + 1) % 100000),
    });
    if (this.pings.length > HISTORY) this.pings.shift();
    labelFish(this.pings);
    this.range = this.rangeFor();
    const type = bottomWords(B);
    // (What the unit's readouts show, and what a mark records.)
    const near = echoes.filter((e) => e.size >= 0.35).map((e) => e.depth).sort((a, b) => a - b);
    // (G7) Deeper than it reaches: the bottom's lost, and no depth to read.
    const lost = s.depth > this.reach + 0.5;
    this.read = {
      depth: lost ? null : s.depth, lost, type, hard: B.hard, temp: src.temp ?? null, deepTemp: L && L.top - L.bottom >= 1 ? L.bottom : null, cline,
      speed: src.mode === 'boat' ? src.moving || 0 : null, ball: baitBall, fish: near, x, z, mode: src.mode,
    };
    // (And the water's temperature at the surface, when the game gives it: see seatemp.js; and
    // the cold below the summer's warm layer.)
    const temp = src.temp != null ? ` · ${Math.round(src.temp)}°C` : '';
    const cold = cline != null ? ` · ${Math.round(L.bottom)}°C below ${Math.round(cline)} m` : '';
    this.depthEl.textContent = lost ? `no bottom: deeper than ${this.reach} m${this.deep ? '' : ' (a deep sounder reads it)'}${temp}${baitBall ? ' · bait below' : ''}`
      : `${s.depth.toFixed(1)} m · ${type}${temp}${cold}${baitBall ? ' · bait below' : ''}`;
    this.tell(src, s, B, prev, cline, ballTop);
    this.draw();
  }

  // What the screen has just shown, for the game to note and teach (hooks.sighted(kind, info)):
  // each fish's arch once (with what it was, which the screen never says), a bait ball coming
  // under, the thermocline, rock under you, the bottom falling away.
  tell(src, s, B, prev, cline, ballTop) {
    const H = this.hooks.sighted;
    if (!H) return;
    const p = this.pings[this.pings.length - 1];
    for (const d of p.labels || []) {
      const f = p.fish.reduce((a, q) => (Math.abs(q.depth - d) < Math.abs(a.depth - d) ? q : a), p.fish[0]);
      if (f && f.sp) H('arch', { sp: f.sp, depth: d, size: f.size, x: src.x, z: src.z, mode: src.mode });
    }
    if (p.ball && !this.wasBall) H('ball', { depth: ballTop, x: src.x, z: src.z });
    this.wasBall = p.ball;
    if (cline != null) H('cline', { depth: cline, top: this.col.top, bottom: this.col.bottom });
    if (B.kind === 'rock' && this.wasKind && this.wasKind !== 'rock') H('rock', { depth: s.depth });
    this.wasKind = B.kind;
    // (A drop-off: the bottom two metres deeper, and half as deep again, than two seconds ago.)
    const back = this.pings[this.pings.length - 21];
    if (back && (src.moving || 0) > 0.5 && s.depth - back.bottom > Math.max(2, back.bottom * 0.5)) H('drop', { from: back.bottom, to: s.depth });
  }

  draw(message) {
    const c = this.canvas, ctx = this.ctx;
    const W = c.width, H = c.height;
    if (this.unit) {
      drawUnit(ctx, W, H, { pings: this.pings, history: HISTORY, range: this.range, opts: { ...this.state.finder, page: this.page }, read: this.read }, message);
      return;
    }
    const scaleW = 56, nowW = 34, top = 10;
    const screenW = W - scaleW, histW = screenW - nowW;
    const colW = histW / HISTORY;
    const yOf = (d) => top + (d / this.range) * (H - top - 6);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, COLORS.screenTop);
    bg.addColorStop(1, COLORS.screenBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const echo = (k) => {
      const a = COLORS.weak, b = COLORS.strong;
      return `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)}, ${Math.round(a[1] + (b[1] - a[1]) * k)}, ${Math.round(a[2] + (b[2] - a[2]) * k)})`;
    };

    const n = this.pings.length;
    const drawColumn = (p, x, w, alpha, big, before = null) => {
      const yb = yOf(p.bottom);
      ctx.globalAlpha = alpha;
      // The thermocline: a faint, broken band where the warm top water meets the cold.
      if (p.cline != null) {
        ctx.fillStyle = COLORS.cline;
        for (let j = 0; j < 3; j++) if (((p.seed * 7 + j * 13) % 10) < 6) ctx.fillRect(x, yOf(p.cline + (j - 1) * 0.35), w + 0.5, 1.5);
      }
      // A bait ball: its cloud, the specks drawn over it.
      if (p.ball && p.ballTop != null) {
        ctx.globalAlpha = alpha * 0.32;
        ctx.fillStyle = COLORS.shoal;
        ctx.fillRect(x, yOf(p.ballTop) - 2, w + 0.5, yOf(p.ballBot) - yOf(p.ballTop) + 4);
        ctx.globalAlpha = alpha;
      }
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(x, yb, w + 0.5, H - yb);
      // Weed shows as soft, ragged strands standing up off the bottom.
      if (p.weed > 0.15) {
        const wh = Math.min(1.8, p.bottom * 0.4) * p.weed * p.weedH;
        ctx.fillStyle = COLORS.weed;
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillRect(x, yOf(p.bottom - wh), w + 0.5, yb - yOf(p.bottom - wh));
        ctx.globalAlpha = alpha;
      }
      // The bottom by how hard it is: rock a thick, bright line and a second echo at twice the
      // depth; gravel and sand thinner, sand's second echo faint; mud a dim, soft, fuzzy band.
      const hard = p.hard ?? p.rock;
      ctx.fillStyle = hard > 0.55 ? COLORS.bottomHard : COLORS.bottomSoft;
      ctx.globalAlpha = alpha * (0.55 + 0.45 * hard);
      ctx.fillRect(x, yb - 1, w + 0.5, (big ? 3 : 2) + hard * 5);
      if (hard < 0.3) {
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillRect(x, yb + 2, w + 0.5, 5);
      }
      if (hard > 0.4 && p.bottom * 2 < this.range) {
        ctx.globalAlpha = alpha * (hard - 0.3) * 0.5;
        ctx.fillRect(x, yOf(p.bottom * 2), w + 0.5, 2);
      }
      ctx.globalAlpha = alpha;
      for (const d of p.clutter) {
        ctx.fillStyle = 'rgba(233, 244, 240, 0.5)';
        ctx.fillRect(x, yOf(d), Math.max(w, 1.5), 1.5);
      }
      for (const f of p.fish) {
        const fy = yOf(f.depth);
        ctx.globalAlpha = alpha * (0.35 + 0.65 * f.strength);
        ctx.fillStyle = f.bait && p.ball ? COLORS.shoal : echo(clamp(f.size * 1.2 * f.strength, 0, 1));
        // (The same fish in the ping before: joined, so its passage through the beam draws one arch.)
        const was = before && f.size >= 0.3 ? before.fish.find((q) => q.id === f.id) : null;
        if (was) {
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = Math.max(2, Math.min(10, f.size * 6));
          ctx.beginPath();
          ctx.moveTo(x - w * 0.5, yOf(was.depth));
          ctx.lineTo(x + w * 0.5, fy);
          ctx.stroke();
          continue;
        }
        if (f.size < 0.3) {
          // Small fry: a speck. Schools of them build a cloud.
          ctx.fillRect(x, fy, Math.max(w, 2), 2);
        } else {
          const fh = Math.max(2.5, Math.min(13, f.size * 8)) * (big ? 1.4 : 1);
          ctx.beginPath();
          ctx.ellipse(x + w / 2, fy, Math.max(w * 1.3, big ? 6 : 2.2), fh / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (p.bait !== null) {
        const by = yOf(p.bait);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = COLORS.bait;
        const r = big ? 6 : 3.5;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, by - r);
        ctx.lineTo(x + w / 2 + r, by);
        ctx.lineTo(x + w / 2, by + r);
        ctx.lineTo(x + w / 2 - r, by);
        ctx.closePath();
        ctx.fill();
      }
    };

    // History: older readings scroll to the left and fade.
    for (let i = 0; i < n; i++) {
      const x = histW - (n - i) * colW;
      drawColumn(this.pings[i], x, colW, 0.35 + 0.55 * (i / Math.max(1, n - 1)), false, this.pings[i - 1]);
    }
    ctx.globalAlpha = 1;

    // "Now": what is directly beneath at this moment.
    ctx.fillStyle = COLORS.now;
    ctx.fillRect(histW, 0, nowW, H);
    ctx.fillStyle = 'rgba(233, 244, 240, 0.35)';
    ctx.fillRect(histW, 0, 1.5, H);
    if (n) drawColumn(this.pings[n - 1], histW + 4, nowW - 8, 1, true);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(233, 244, 240, 0.85)';
    ctx.font = '700 17px Nunito, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('now', histW + nowW / 2, 4);

    // Depth scale
    ctx.fillStyle = COLORS.scale;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '600 17px Nunito, system-ui, sans-serif';
    const step = this.range <= 5 ? 1 : this.range <= 10 ? 2 : 5;
    for (let d = 0; d <= this.range + 0.01; d += step) {
      const y = Math.min(Math.max(yOf(d), 10), H - 10);
      ctx.fillRect(screenW, yOf(d), 6, 1.5);
      ctx.fillText(`${d}`, screenW + 10, y);
    }
    ctx.fillText('m', screenW + 34, Math.min(yOf(this.range), H - 10));

    if (message) {
      ctx.fillStyle = 'rgba(10, 24, 36, 0.7)';
      ctx.fillRect(0, H / 2 - 34, screenW, 68);
      ctx.fillStyle = 'rgba(233, 244, 240, 0.92)';
      ctx.font = '600 19px Nunito, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const words = message.split(' ');
      const lines = [''];
      for (const w of words) {
        const tryLine = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${w}` : w;
        if (ctx.measureText(tryLine).width > screenW - 30) lines.push(w);
        else lines[lines.length - 1] = tryLine;
      }
      lines.forEach((l, i) => ctx.fillText(l, screenW / 2, H / 2 + (i - (lines.length - 1) / 2) * 22));
    }
  }
}
