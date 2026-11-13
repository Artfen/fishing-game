import * as THREE from 'three';
import { groundsOf } from './grounds.js';
import { PLACES, PATH, WEND_TRAIL, COAST_PATHS, LANES, HOME, CAR_PARKS, zoneAt, ZONE_NAMES, heightAt } from './world/terrain.js';
import { COLDWATER, TARN, FELL_PATH } from './world/coldwater.js';
import { fishById } from './fish.js';
import { habitsOf } from './guide.js';
import { TENTS } from './campsite.js';
import { ENDS, CROSS_M } from './crossing.js';
import { MARKS } from './chartMarks.js';
import { legsOf, passage, rangeWords, courseWords, timeWords, ROUTES_MAX, POINTS_MAX } from './routes.js';

// The map (M): the whole coast, every shore, path and place from the start (places you haven't
// been yet in fainter ink), or, if you'd rather explore it (Settings), as you've seen it: water
// you've crossed and shores you've walked drawn in, the rest blank paper until you go there. Places
// you've found are marked, with the camps you can head to, where your boats are, and where your
// best fish came from. (What you've explored is remembered either way: the count of it, and of
// places found, stays.)

const $ = (id) => document.getElementById(id);

// The part of the world the map covers (metres), and the grid of 20 m cells it remembers. (It
// grew to take in the Coldwater and Hoarfell; the first sheet, OLD_SHEET, sits inside it.)
export const SHEET = { x: -1400, z: -1800, w: 2240, h: 3080 };
// The open sea between home and Las Brasas (see crossing.js): a chart of its own, both coasts on
// its edges, drawn coarser (px: metres a pixel; grid: of the heights worked out for it), and all
// of it charted from the start (it's the sea: nothing to find).
export const OCEAN_SHEET = { x: -1600, z: 400, w: 3200, h: 5600, px: 10, grid: 24 };
const CELL = 20;
export const COLS = SHEET.w / CELL, ROWS = SHEET.h / CELL;
const OLD_SHEET = { x: -560, z: -720, cols: 70, rows: 100 };
// (Zoom levels were set on the first, smaller sheet: this keeps them where they were.)
const ZOOM = 1.55;

// Which cells you've seen, kept in the save as a short base64 string.
export class Explored {
  // sheet: the part of the world it covers (home's SHEET, or Las Brasas' far to the south).
  constructor(saved = '', sheet = SHEET) {
    this.sheet = sheet;
    this.cols = sheet.w / CELL;
    this.rows = sheet.h / CELL;
    const COLS = this.cols, ROWS = this.rows;
    this.bits = new Uint8Array(Math.ceil((COLS * ROWS) / 8));
    this.version = 0;
    if (typeof saved === 'string' && saved) {
      try {
        const raw = atob(saved);
        if (sheet === SHEET && raw.length === Math.ceil((OLD_SHEET.cols * OLD_SHEET.rows) / 8)) {
          // A map from before the sheet grew: each cell moves to its place on the new one.
          const di = (OLD_SHEET.x - SHEET.x) / CELL, dj = (OLD_SHEET.z - SHEET.z) / CELL;
          for (let k = 0; k < OLD_SHEET.cols * OLD_SHEET.rows; k++) {
            if (!((raw.charCodeAt(k >> 3) >> (k & 7)) & 1)) continue;
            const n = (Math.floor(k / OLD_SHEET.cols) + dj) * COLS + (k % OLD_SHEET.cols) + di;
            this.bits[n >> 3] |= 1 << (n & 7);
          }
        } else for (let i = 0; i < Math.min(raw.length, this.bits.length); i++) this.bits[i] = raw.charCodeAt(i);
      } catch {
        // A damaged string: start the map afresh rather than trust it.
      }
    }
  }

  has(i, j) {
    const COLS = this.cols, ROWS = this.rows;
    if (i < 0 || j < 0 || i >= COLS || j >= ROWS) return false;
    const k = j * COLS + i;
    return (this.bits[k >> 3] >> (k & 7)) & 1;
  }

  // Everything within r metres of (x, z) has been seen. Says whether anything was new.
  reveal(x, z, r) {
    const SHEET = this.sheet, COLS = this.cols, ROWS = this.rows;
    let fresh = false;
    const i0 = Math.floor((x - r - SHEET.x) / CELL), i1 = Math.floor((x + r - SHEET.x) / CELL);
    const j0 = Math.floor((z - r - SHEET.z) / CELL), j1 = Math.floor((z + r - SHEET.z) / CELL);
    for (let j = Math.max(0, j0); j <= Math.min(ROWS - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(COLS - 1, i1); i++) {
        const cx = SHEET.x + (i + 0.5) * CELL, cz = SHEET.z + (j + 0.5) * CELL;
        if (Math.hypot(cx - x, cz - z) > r) continue;
        const k = j * COLS + i;
        if ((this.bits[k >> 3] >> (k & 7)) & 1) continue;
        this.bits[k >> 3] |= 1 << (k & 7);
        fresh = true;
      }
    }
    if (fresh) this.version++;
    return fresh;
  }

  get fraction() {
    let n = 0;
    for (const b of this.bits) for (let v = b; v; v &= v - 1) n++;
    return n / (this.cols * this.rows);
  }

  toString() {
    let s = '';
    for (const b of this.bits) s += String.fromCharCode(b);
    return btoa(s);
  }
}

const BOAT_COLORS = { row: '#b5532f', skiff: '#2f4f7a', kayak: '#e8742a', bass: '#7a2430', cabin: '#1f4e5f', sail: '#c4774a', cruiser: '#1d3b56', console: '#3a8fc4', windsurf: '#f2a32a', jetski: '#e8b820' };
const canvas2 = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const INK = '#3a2e26';
// The home waters' zones (anything else is Las Brasas', far to the south).
const HOME_ZONES = new Set(['bay', 'cove', 'open', 'coast', 'deep', 'estuary', 'lake', 'stream', 'mere', 'river', 'tarn', 'tideway']);
// The sheet a species lives on: 'south' if only round Las Brasas, 'home' if only at home, or null
// for both.
const sheetOf = (id) => {
  const z = fishById[id]?.life.zones || [];
  return z.every((k) => !HOME_ZONES.has(k)) ? 'south' : z.every((k) => HOME_ZONES.has(k)) ? 'home' : null;
};
const half = THREE.DataUtils.fromHalfFloat;

export class MapSheet {
  // height: { data, width, height, rect } from the baked terrain texture (half floats, RGBA:
  // height and freshness first). hooks: travel(dest), travelInfo(), close(), showAll() (the whole
  // chart, or only what you've explored: Settings → The map).
  get showAll() { return this.hooks?.showAll ? this.hooks.showAll() !== false : true; }

  constructor(state, explored, height, hooks) {
    this.state = state;
    this.hooks = hooks;
    // The sheets: home's, and (added later) Las Brasas', far to the south. Each has its own
    // extent, explored memory, baked heights and drawings; useSheet() picks the one to show.
    this.sheets = {};
    this.addSheet('home', SHEET, explored, () => height);
    this.useSheet('home');
    this.el = $('map');
    this.canvas = $('map-canvas');
    this.base = null;
    this.fog = null;
    this.fogVersion = -1;
    this.view = { x: 0, z: 0, zoom: 1 };
    this.where = null;
    $('map-close').addEventListener('click', () => hooks.close());
    $('map-in').addEventListener('click', () => this.zoomBy(1.5));
    $('map-out').addEventListener('click', () => this.zoomBy(1 / 1.5));
    $('map-me').addEventListener('click', () => this.centre(this.where?.player));
    this.el.addEventListener('click', (e) => { if (e.target === this.el) hooks.close(); });
    // Your marks: click "Mark a spot" then the map, or mark where you stand; edit them alongside.
    this.marking = false;
    this.editing = null;
    $('map-mark').addEventListener('click', () => this.setMarking(!this.marking));
    // The chart's layers (buoys and harbours, your catches), and routes planned mark by mark.
    $('map-lay-marks').addEventListener('click', () => this.setLayer('marks'));
    $('map-lay-catch').addEventListener('click', () => this.setLayer('catches'));
    $('map-route').addEventListener('click', () => this.setPlanning(!this.planning));
    this.planning = false;
    this.plan = [];
    this.showRoute = null;
    $('map-mark-here').addEventListener('click', () => {
      const p = this.where?.player;
      if (p) this.addPin(p.x, p.z);
    });
    $('map-pin-edit').addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePin();
    });
    $('mp-cancel').addEventListener('click', () => this.editPin(null));
    // Playing together: send a mark (as it stands in the form) to your friends' maps.
    $('mp-send').addEventListener('click', () => {
      const p = this.editing;
      if (!p) return;
      this.savePin();
      $('map-note').textContent = this.hooks.sharePin?.(p) || '';
    });
    $('mp-delete').addEventListener('click', () => {
      if (!this.editing) return;
      const i = this.state.pins.findIndex((p) => p.id === this.editing.id);
      if (i >= 0) this.state.pins.splice(i, 1);
      this.editPin(null);
      this.hooks.changed?.();
      this.renderSide();
      this.draw();
    });
    this.bindPointer();
    addEventListener('resize', () => { if (this.isOpen) this.draw(); });
  }

  get isOpen() { return !this.el.hidden; }

  // A sheet: its key, the part of the world it covers, its explored memory, and its heights (a
  // function, so they can be baked only when first needed).
  addSheet(key, S, explored, height) {
    this.sheets[key] = { key, S, explored, height, base: null, fog: null, fogVersion: -1, masks: null, areas: null, far: null, heightData: null };
  }

  useSheet(key) {
    const N = this.sheets[key];
    if (!N || this.key === key) return;
    const C = this.sheets[this.key];
    if (C) Object.assign(C, { base: this.base, fog: this.fog, fogVersion: this.fogVersion, masks: this.masks, areas: this.areas, far: this.far });
    this.key = key;
    this.S = N.S;
    this.cols = N.S.w / CELL;
    this.rows = N.S.h / CELL;
    this.explored = N.explored;
    N.heightData = N.heightData || N.height();
    this.height = N.heightData;
    this.base = N.base;
    this.fog = N.fog;
    this.fogVersion = N.fogVersion;
    this.masks = N.masks;
    this.areas = N.areas;
    this.far = N.far;
  }

  // Which sheet a point of the world is on.
  sheetFor(x, z) {
    // (Las Brasas' own chart first; then, between the bottom of home's and the top of the island's,
    // the open sea's.)
    const S = this.sheets.south?.S, O = this.sheets.ocean?.S;
    if (S && x > S.x && x < S.x + S.w && z > S.z && z < S.z + S.h) return 'south';
    if (O && x > O.x && x < O.x + O.w && z > SHEET.z + SHEET.h && z < (S ? S.z : O.z + O.h)) return 'ocean';
    return 'home';
  }

  // Where a species can live, as cells of the map: its waters, at depths that suit it. (From
  // the simulation's own habitat data, so it never shows a fish where the game has none.)
  suitability(id) {
    this.masks = this.masks || new Map();
    if (this.masks.has(id)) return this.masks.get(id);
    const sp = fishById[id], L = sp.life, H = habitsOf(sp);
    const mask = new Uint8Array(this.cols * this.rows);
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const x = this.S.x + (i + 0.5) * CELL, z = this.S.z + (j + 0.5) * CELL;
        const depth = -this.sample(x, z)[0];
        if (depth < 0.3) continue;
        if (!L.zones.includes(zoneAt(x, z))) continue;
        if (depth < Math.max(0.3, H.depth[0] * 0.6)) continue;
        if ((L.bottom || L.flat) && depth > H.depth[1] + 3) continue;
        mask[j * this.cols + i] = 1;
      }
    }
    this.masks.set(id, mask);
    return mask;
  }

  // Whether the water at a point suits a species (its cell of the map, or one beside it: the
  // shading is coarse).
  suitableAt(id, x, z) {
    const mask = this.suitability(id);
    const i0 = Math.floor((x - this.S.x) / CELL), j0 = Math.floor((z - this.S.z) / CELL);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const i = i0 + di, j = j0 + dj;
        if (i >= 0 && j >= 0 && i < this.cols && j < this.rows && mask[j * this.cols + i]) return true;
      }
    }
    return false;
  }

  // The separate stretches of water that suit a species (connected cells of its suitability),
  // largest first: where it could be worth going, for planning a trip. Areas of water, not fish.
  areasFor(id) {
    this.areas = this.areas || new Map();
    if (this.areas.has(id)) return this.areas.get(id);
    const mask = this.suitability(id), seen = new Uint8Array(mask.length), out = [];
    for (let k = 0; k < mask.length; k++) {
      if (!mask[k] || seen[k]) continue;
      const stack = [k], cells = [];
      seen[k] = 1;
      while (stack.length) {
        const c = stack.pop(), i = c % this.cols, j = (c - i) / this.cols;
        cells.push(c);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di, nj = j + dj, n = nj * this.cols + ni;
          if (ni < 0 || nj < 0 || ni >= this.cols || nj >= this.rows || seen[n] || !mask[n]) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      if (cells.length < 2) continue;
      // Its middle (the cell nearest the centroid, so it's always in the water that suits).
      let sx = 0, sz = 0;
      const pts = cells.map((c) => [this.S.x + ((c % this.cols) + 0.5) * CELL, this.S.z + (Math.floor(c / this.cols) + 0.5) * CELL]);
      for (const [x, z] of pts) { sx += x; sz += z; }
      sx /= pts.length;
      sz /= pts.length;
      const mid = pts.reduce((b, p) => (Math.hypot(p[0] - sx, p[1] - sz) < Math.hypot(b[0] - sx, b[1] - sz) ? p : b));
      const zones = {};
      for (const [x, z] of pts) { const zn = zoneAt(x, z); zones[zn] = (zones[zn] || 0) + 1; }
      out.push({ x: mid[0], z: mid[1], r: Math.max(25, Math.sqrt(cells.length / Math.PI) * CELL), cells: cells.length, pts, zone: Object.entries(zones).sort((a, b) => b[1] - a[1])[0][0] });
    }
    out.sort((a, b) => b.cells - a.cells);
    this.areas.set(id, out);
    return out;
  }

  // The suitable water as a soft overlay, in a canvas the size of the base map.
  overlay(id) {
    const mask = this.suitability(id);
    const m = canvas2(this.cols, this.rows), mctx = m.getContext('2d'), img = mctx.createImageData(this.cols, this.rows);
    for (let k = 0; k < mask.length; k++) if (mask[k]) {
      img.data[k * 4] = 32;
      img.data[k * 4 + 1] = 128;
      img.data[k * 4 + 2] = 120;
      img.data[k * 4 + 3] = 255;
    }
    mctx.putImageData(img, 0, 0);
    const o = canvas2(350, 500), ctx = o.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.filter = 'blur(2px)';
    ctx.drawImage(m, 0, 0, o.width, o.height);
    ctx.filter = 'none';
    return o;
  }

  // A small map for the field guide: the coast as far as you've explored it, with the water that
  // suits a species shaded over it (and, planning a trip, the places to choose from ringed).
  miniMap(cv, id, places = null, me = null) {
    // (A fish of Las Brasas is shown on the island's sheet; then back to the one you were on.)
    const was = this.key, there = (this.sheets.south && sheetOf(id)) || (this.sheets[was] ? was : 'home');
    if (there !== was) {
      this.useSheet(there);
      this.miniMap(cv, id, places, me);
      this.useSheet(was);
      return;
    }
    if (!this.base) this.bake();
    if (this.fogVersion !== this.explored.version || !this.fog) this.buildFog();
    // (The canvas takes the sheet's shape: Las Brasas' chart is wider than it is tall.)
    const h = Math.round((cv.width * this.S.h) / this.S.w);
    if (cv.height !== h) cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(this.base, 0, 0, cv.width, cv.height);
    if (!this.showAll) ctx.drawImage(this.fog, 0, 0, cv.width, cv.height);
    ctx.globalAlpha = 0.6;
    ctx.drawImage(this.overlay(id), 0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1;
    const kx = cv.width / this.S.w, kz = cv.height / this.S.h;
    for (const p of places || []) {
      ctx.save();
      ctx.strokeStyle = p.on ? '#b5532f' : 'rgba(58, 46, 38, 0.55)';
      ctx.lineWidth = p.on ? 2.5 : 1.5;
      if (!p.on) ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc((p.x - this.S.x) * kx, (p.z - this.S.z) * kz, Math.max(6, p.r * kx), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // You are here.
    if (me) {
      ctx.fillStyle = '#b5532f';
      ctx.beginPath();
      ctx.arc((me.x - this.S.x) * kx, (me.z - this.S.z) * kz, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(58, 46, 38, 0.5)';
    ctx.strokeRect(0.5, 0.5, cv.width - 1, cv.height - 1);
  }

  // where = { player: { x, z, heading }, onFoot, boats, boat (the one you're in or last used) }
  // highlight: a species id, to shade the water that suits it.
  open(where, highlight = null) {
    // (The sheet you're on: home's, or Las Brasas'; or, showing a fish's water, the one it lives on.)
    this.useSheet((highlight && this.sheets.south && sheetOf(highlight)) || this.sheetFor(where.player.x, where.player.z));
    this.where = where;
    this.highlight = highlight;
    this.highlightImg = highlight ? this.overlay(highlight) : null;
    this.el.hidden = false;
    if (!this.base) this.bake();
    this.fit();
    // Start a little zoomed in, around you; showing a species' water, take in the nearest of it
    // too.
    this.view.zoom = this.fitZoom * 2.2 * ZOOM;
    const here = this.key === this.sheetFor(where.player.x, where.player.z);
    const near = highlight && here && (this.state.trip?.sp === highlight ? this.state.trip : this.nearestSuitable(highlight, where.player));
    if (near) {
      const p = where.player, m = 1.5 * CELL;
      const w = Math.abs(near.x - p.x) + 2 * m, h = Math.abs(near.z - p.z) + 2 * m;
      this.view.zoom = Math.max(this.fitZoom, Math.min(this.view.zoom, (this.canvas.width * 0.8) / w, (this.canvas.height * 0.8) / h));
      this.centre({ x: (p.x + near.x) / 2, z: (p.z + near.z) / 2 });
    } else if (highlight && !here) {
      // (Its water is on the other sheet: show all of it.)
      this.view.zoom = this.fitZoom;
      this.centre({ x: this.S.x + this.S.w / 2, z: this.S.z + this.S.h / 2 });
    } else this.centre(where.player);
    this.renderSide();
  }

  // Keep "You" where you are while the map is open (aboard a boat that's moving, say): your mark
  // follows you, redrawn a few times a second as you go.
  follow(p) {
    const me = this.where?.player;
    if (!this.isOpen || !me || !p?.pos) return;
    if (Math.hypot(p.pos.x - me.x, p.pos.z - me.z) > 0.3 || Math.abs(p.heading - me.heading) > 0.01) {
      me.x = p.pos.x;
      me.z = p.pos.z;
      me.heading = p.heading;
      this.moved = true;
    }
    const now = performance.now();
    if (!this.moved || now - (this.drawnAt || 0) < 250) return;
    this.moved = false;
    this.drawnAt = now;
    this.draw();
  }

  // The middle of the suitable cell nearest a point.
  nearestSuitable(id, p) {
    const mask = this.suitability(id);
    let best = null, bd = Infinity;
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        if (!mask[j * this.cols + i]) continue;
        const x = this.S.x + (i + 0.5) * CELL, z = this.S.z + (j + 0.5) * CELL, d = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (d < bd) {
          bd = d;
          best = { x, z };
        }
      }
    }
    return best;
  }

  close() {
    if (this.editing) this.savePin();
    this.setMarking(false);
    this.el.hidden = true;
  }

  // Open on a particular spot (a mark, a photograph's place), zoomed in.
  openAt(where, x, z) {
    this.open(where);
    if (this.sheetFor(x, z) !== this.key) {
      this.useSheet(this.sheetFor(x, z));
      if (!this.base) this.bake();
      this.fit();
    }
    this.view.zoom = this.fitZoom * 4 * ZOOM;
    this.centre({ x, z });
  }

  /* ---------------- drawing ---------------- */

  // The land and water, drawn once: shoreline in ink, hills in contours, water by depth.
  bake() {
    const PX = this.S.px ?? 2.5; // (2.5 m a pixel, but for the open sea's chart)
    const BW = Math.round(this.S.w / PX), BH = Math.round(this.S.h / PX);
    const c = document.createElement('canvas');
    c.width = BW;
    c.height = BH;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(BW, BH);
    const d = img.data;
    const H = this.height;
    const hs = new Float32Array(BW * BH), fr = new Float32Array(BW * BH);
    for (let j = 0; j < BH; j++) {
      const z = this.S.z + ((j + 0.5) / BH) * this.S.h;
      for (let i = 0; i < BW; i++) {
        const x = this.S.x + ((i + 0.5) / BW) * this.S.w;
        const s = this.sample(x, z);
        hs[j * BW + i] = s[0];
        fr[j * BW + i] = s[1];
      }
    }
    // (Contours every 8 m on the low ground, every 40 m up the fell.)
    const band = (h) => (h < 40 ? Math.floor(h / 8) : 4 + Math.floor((h - 40) / 40));
    for (let j = 1; j < BH - 1; j++) {
      for (let i = 1; i < BW - 1; i++) {
        const k = j * BW + i, h = hs[k], o = k * 4;
        const nb = [hs[k - 1], hs[k + 1], hs[k - BW], hs[k + BW]];
        let r, g, b;
        if (h > 0) {
          if (nb.some((n) => n <= 0)) [r, g, b] = [74, 58, 44];
          else if (nb.some((n) => n > 0 && band(n) !== band(h))) [r, g, b] = h > 330 ? [176, 170, 160] : [150, 128, 92];
          else if (h < 2.5) [r, g, b] = [226, 208, 166];
          else if (h < 14) [r, g, b] = [205, 200, 150];
          else if (h < 130) [r, g, b] = [196, 178, 132];
          else if (h < 260) [r, g, b] = [186, 170, 136];
          else if (h < 330) [r, g, b] = [184, 178, 166];
          else [r, g, b] = [240, 238, 232];
        } else {
          const depth = -h;
          const fresh = fr[k] > 0.5;
          if (nb.some((n) => n < 0 && band(-n, 10) !== band(depth, 10))) [r, g, b] = [96, 132, 150];
          else if (depth < 2) [r, g, b] = fresh ? [170, 204, 180] : [176, 212, 206];
          else if (depth < 8) [r, g, b] = fresh ? [146, 188, 172] : [150, 196, 204];
          else if (depth < 25) [r, g, b] = [118, 166, 194];
          else [r, g, b] = [94, 134, 172];
        }
        // A little paper grain.
        const n = ((i * 73856093) ^ (j * 19349663)) % 7;
        d[o] = r - n; d[o + 1] = g - n; d[o + 2] = b - n; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // The Coldwater above the tide and Hoar Tarn, up on the fell (the land under them is drawn
    // as land, so their water goes on top).
    if (this.key !== 'home') {
      this.base = c;
      return;
    }
    const kx = BW / this.S.w, kz = BH / this.S.h, at = (x, z) => [(x - this.S.x) * kx, (z - this.S.z) * kz];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < COLDWATER.length - 1; i++) {
      const a = COLDWATER[i], b = COLDWATER[i + 1];
      if (a.l <= 0.05) break;
      ctx.strokeStyle = 'rgb(74, 58, 44)';
      ctx.lineWidth = Math.max(2.2, (a.w + b.w) * kx + 1.4);
      ctx.beginPath(); ctx.moveTo(...at(a.x, a.z)); ctx.lineTo(...at(b.x, b.z)); ctx.stroke();
    }
    for (let i = 0; i < COLDWATER.length - 1; i++) {
      const a = COLDWATER[i], b = COLDWATER[i + 1];
      if (a.l <= 0.05) break;
      ctx.strokeStyle = 'rgb(146, 188, 172)';
      ctx.lineWidth = Math.max(1.2, (a.w + b.w) * kx);
      ctx.beginPath(); ctx.moveTo(...at(a.x, a.z)); ctx.lineTo(...at(b.x, b.z)); ctx.stroke();
    }
    const [tx, tz] = at(TARN.x, TARN.z);
    ctx.translate(tx, tz);
    ctx.rotate(-TARN.yaw);
    ctx.fillStyle = 'rgb(118, 166, 170)';
    ctx.strokeStyle = 'rgb(74, 58, 44)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, TARN.rx * kx, TARN.rz * kz, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    this.base = c;
  }

  // Height and freshness at (x, z) from the baked texture (bilinear); beyond it (up the
  // Coldwater and on Hoarfell), from heights worked out afresh on a coarser grid.
  sample(x, z) {
    const H = this.height, W = H.width, Hh = H.height;
    if (x < H.rect.x || z < H.rect.z || x > H.rect.x + H.rect.w || z > H.rect.z + H.rect.h) return [this.beyond(x, z), 0];
    const u = ((x - H.rect.x) / H.rect.w) * W - 0.5, v = ((z - H.rect.z) / H.rect.h) * Hh - 0.5;
    const i = Math.max(0, Math.min(W - 2, Math.floor(u))), j = Math.max(0, Math.min(Hh - 2, Math.floor(v)));
    const fu = Math.max(0, Math.min(1, u - i)), fv = Math.max(0, Math.min(1, v - j));
    const at = (ii, jj, c) => half(H.data[(jj * W + ii) * 4 + c]);
    const out = [0, 0];
    for (let c = 0; c < 2; c++) {
      const a = at(i, j, c) * (1 - fu) + at(i + 1, j, c) * fu;
      const b = at(i, j + 1, c) * (1 - fu) + at(i + 1, j + 1, c) * fu;
      out[c] = a * (1 - fv) + b * fv;
    }
    // (The texture stops at 60 m: higher ground, up the dale, is worked out afresh.)
    if (out[0] > 55) out[0] = Math.max(out[0], this.beyond(x, z));
    return out;
  }

  beyond(x, z) {
    const G = this.S.grid ?? 8, gw = this.S.w / G + 1, gh = this.S.h / G + 1;
    this.far = this.far || new Float32Array(gw * gh).fill(NaN);
    const u = Math.max(0, Math.min(gw - 1.001, (x - this.S.x) / G)), v = Math.max(0, Math.min(gh - 1.001, (z - this.S.z) / G));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const at = (ii, jj) => {
      const k = jj * gw + ii;
      if (Number.isNaN(this.far[k])) this.far[k] = heightAt(this.S.x + ii * G, this.S.z + jj * G);
      return this.far[k];
    };
    return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv;
  }

  // Blank paper over everything you haven't seen yet, with soft edges.
  buildFog() {
    const m = document.createElement('canvas');
    m.width = this.cols;
    m.height = this.rows;
    const mctx = m.getContext('2d');
    const img = mctx.createImageData(this.cols, this.rows);
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) img.data[(j * this.cols + i) * 4 + 3] = this.explored.has(i, j) ? 255 : 0;
    }
    mctx.putImageData(img, 0, 0);
    const f = this.fog || document.createElement('canvas');
    f.width = this.cols * 5;
    f.height = this.rows * 5;
    const ctx = f.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#efe3c6';
    ctx.fillRect(0, 0, f.width, f.height);
    ctx.strokeStyle = 'rgba(110, 92, 73, 0.12)';
    ctx.lineWidth = 1;
    for (let k = -f.height; k < f.width; k += 7) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k + f.height, f.height);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.imageSmoothingEnabled = true;
    ctx.filter = 'blur(3px)';
    ctx.drawImage(m, 0, 0, f.width, f.height);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    this.fog = f;
    this.fogVersion = this.explored.version;
  }

  // The zoom at which the whole sheet fits the frame.
  fit() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.dpr = dpr;
    this.fitZoom = Math.min(this.canvas.width / this.S.w, this.canvas.height / this.S.h);
  }

  // World (x, z) → canvas pixels.
  toPx(x, z) {
    const v = this.view;
    return [this.canvas.width / 2 + (x - v.x) * v.zoom, this.canvas.height / 2 + (z - v.z) * v.zoom];
  }

  centre(p) {
    if (p) {
      this.view.x = p.x;
      this.view.z = p.z;
    }
    this.clampView();
    this.draw();
  }

  zoomBy(k, px, py) {
    const v = this.view;
    const before = px == null ? null : this.toWorld(px, py);
    v.zoom = Math.max(this.fitZoom, Math.min(this.fitZoom * 8 * ZOOM, v.zoom * k));
    if (before) {
      // Keep the point under the pointer where it is.
      const after = this.toWorld(px, py);
      v.x += before[0] - after[0];
      v.z += before[1] - after[1];
    }
    this.clampView();
    this.draw();
  }

  toWorld(px, py) {
    const v = this.view;
    return [v.x + (px - this.canvas.width / 2) / v.zoom, v.z + (py - this.canvas.height / 2) / v.zoom];
  }

  clampView() {
    const v = this.view;
    const hw = this.canvas.width / 2 / v.zoom, hh = this.canvas.height / 2 / v.zoom;
    v.x = this.S.w / 2 < hw ? this.S.x + this.S.w / 2 : Math.max(this.S.x + hw, Math.min(this.S.x + this.S.w - hw, v.x));
    v.z = this.S.h / 2 < hh ? this.S.z + this.S.h / 2 : Math.max(this.S.z + hh, Math.min(this.S.z + this.S.h - hh, v.z));
  }

  bindPointer() {
    const cv = this.canvas, pts = new Map();
    let pinch = 0;
    let down = null;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture?.(e.pointerId);
      down = { x: e.clientX, y: e.clientY, moved: 0 };
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (down) down.moved += Math.abs(dx) + Math.abs(dy);
      if (pts.size === 1) {
        this.view.x -= (dx * this.dpr) / this.view.zoom;
        this.view.z -= (dy * this.dpr) / this.view.zoom;
        this.clampView();
        this.draw();
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()], dd = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoomBy(dd / pinch);
        pinch = dd;
      }
    });
    const end = (e) => { pts.delete(e.pointerId); pinch = 0; };
    // A click (not a drag): on a mark, edit it; in marking mode, put a new one there.
    cv.addEventListener('pointerup', (e) => {
      if (!down || down.moved > 6 || pts.size > 1) return;
      const r = cv.getBoundingClientRect();
      const px = (e.clientX - r.left) * this.dpr, py = (e.clientY - r.top) * this.dpr;
      const hit = this.state.pins.find((p) => {
        const [x, y] = this.toPx(p.x, p.z);
        return Math.hypot(x - px, y - py) < 14 * this.dpr;
      });
      if (this.planning) {
        if (this.plan.length < POINTS_MAX) this.plan.push(this.toWorld(px, py).map(Math.round));
        this.renderPlan();
        this.draw();
      } else if (hit) this.editPin(hit);
      else if (this.marking) {
        const [x, z] = this.toWorld(px, py);
        this.addPin(x, z);
      }
      down = null;
    });
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      this.zoomBy(Math.exp(-e.deltaY * 0.0015), (e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr);
    }, { passive: false });
  }

  draw() {
    if (!this.isOpen || !this.base) return;
    const r = this.canvas.getBoundingClientRect();
    if (Math.abs(r.width * this.dpr - this.canvas.width) > 2 || Math.abs(r.height * this.dpr - this.canvas.height) > 2) {
      const z = this.view.zoom / this.fitZoom;
      this.fit();
      this.view.zoom = this.fitZoom * z;
      this.clampView();
    }
    if (this.fogVersion !== this.explored.version) this.buildFog();
    const cv = this.canvas, ctx = cv.getContext('2d'), s = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#efe3c6';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const [x0, y0] = this.toPx(this.S.x, this.S.z);
    const w = this.S.w * this.view.zoom, h = this.S.h * this.view.zoom;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, x0, y0, w, h);

    // Trails you've walked: the camp path, and the Wend trail once you know either end.
    const st = this.state;
    const trail = (pts) => {
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([3 * s, 5 * s]);
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      pts.forEach(([x, z], i) => {
        const [px, py] = this.toPx(x, z);
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.stroke();
      ctx.restore();
    };
    const all = this.showAll;
    if (all || st.places.camp) trail(PATH);
    if (all || st.places.quay || st.places.boathouse) trail(WEND_TRAIL);
    if (all || st.places.haven || st.places.landing) for (const P of COAST_PATHS) trail(P);
    // The path up the Coldwater to the top of Hoarfell, once you've found its foot or the bothy.
    if (all || st.places.coldfoot || st.places.bothy || st.places.summit) trail(FELL_PATH);
    // The lanes from home (under the fog where you haven't been).
    for (const P of LANES) trail(P);

    if (!all) ctx.drawImage(this.fog, x0, y0, w, h);
    // Your track, where a chartplotter has drawn it (see shipyard.js): a fine dotted line, older
    // stretches fainter.
    const T = st.track || [];
    if (T.length > 1) {
      ctx.save();
      ctx.lineWidth = 1.8 * s;
      ctx.setLineDash([2 * s, 3 * s]);
      ctx.lineCap = 'round';
      for (let i = 1; i < T.length; i++) {
        // (A long gap between points: a fresh trip, not a line across the chart.)
        if (Math.hypot(T[i][0] - T[i - 1][0], T[i][1] - T[i - 1][1]) > 120) continue;
        const [ax, ay] = this.toPx(T[i - 1][0], T[i - 1][1]), [bx, by] = this.toPx(T[i][0], T[i][1]);
        ctx.strokeStyle = `rgba(214, 74, 52, ${0.25 + 0.6 * (i / T.length)})`;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (this.highlightImg) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.highlightImg, x0, y0, w, h);
      ctx.globalAlpha = 1;
    }

    // (Labels don't overlap: each one drawn is remembered for this frame.)
    this.labels = [];
    // A planned trip's destination: a dashed ring round the water, with what you're after.
    const trip = this.state.trip;
    if (trip) {
      const [tx, ty] = this.toPx(trip.x, trip.z);
      ctx.save();
      ctx.strokeStyle = '#2f6f74';
      ctx.lineWidth = 2.5 * s;
      ctx.setLineDash([6 * s, 5 * s]);
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(10 * s, trip.r * this.view.zoom), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      this.label(ctx, `Trip: ${fishById[trip.sp]?.name || trip.sp}`, tx, ty - Math.max(12 * s, trip.r * this.view.zoom) - 8 * s, 17, '#2f6f74', 1);
    }

    // Edge of the sheet.
    ctx.strokeStyle = 'rgba(58, 46, 38, 0.5)';
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(x0, y0, w, h);

    // Big waters: their names written across them.
    for (const p of PLACES) {
      if (!p.area || (!st.places[p.id] && !all)) continue;
      const [x, y] = this.toPx(p.x, p.z);
      ctx.save();
      ctx.globalAlpha = st.places[p.id] ? 0.5 : 0.28;
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(Math.min(46, 14 + this.view.zoom * 26) * s)}px Caveat, cursive`;
      ctx.fillText(p.name, x, y);
      ctx.restore();
    }

    // Where your best fish of each kind came from (zoomed in, with names).
    const best = {};
    for (const e of st.log) if (e.x != null && (!best[e.sp] || e.size > best[e.sp].size)) best[e.sp] = e;
    const near = this.view.zoom > this.fitZoom * 3 * ZOOM;
    for (const e of Object.values(best)) {
      const [x, y] = this.toPx(e.x, e.z);
      ctx.save();
      ctx.fillStyle = '#2f6f74';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(x, y, 4.5 * s, 2.6 * s, 0, 0, Math.PI * 2);
      ctx.moveTo(x - 4 * s, y);
      ctx.lineTo(x - 8 * s, y - 3 * s);
      ctx.lineTo(x - 8 * s, y + 3 * s);
      ctx.fill();
      ctx.restore();
      if (near) this.label(ctx, `${fishById[e.sp]?.name || e.sp} ${e.size} cm`, x + 7 * s, y + 9 * s, 12, '#2f6f74', 1);
    }

    // Places: camps as tents, landings as little piers, the rest as a cross.
    // (On the whole chart, the places you haven't been yet: a faint ring and their name, to go and
    // find.)
    if (all) {
      for (const p of PLACES) {
        if (p.area || st.places[p.id] || p.x < this.S.x || p.x > this.S.x + this.S.w || p.z < this.S.z || p.z > this.S.z + this.S.h) continue;
        const [x, y] = this.toPx(p.x, p.z);
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.arc(x, y, 4 * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        if (this.view.zoom > this.fitZoom * 1.6) this.label(ctx, p.name, x + 7 * s, y + 4 * s, 12, INK, 0.5);
      }
    }
    const order = PLACES.filter((p) => !p.area && st.places[p.id]).sort((a, b) => (b.camp ? 2 : b.dock ? 1 : 0) - (a.camp ? 2 : a.dock ? 1 : 0));
    for (const p of order) {
      const [x, y] = this.toPx(p.x, p.z);
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.lineWidth = 2 * s;
      if (p.camp) {
        ctx.fillStyle = '#7f9a6a';
        ctx.beginPath();
        ctx.moveTo(x - 9 * s, y + 6 * s);
        ctx.lineTo(x, y - 8 * s);
        ctx.lineTo(x + 9 * s, y + 6 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (p.dock) {
        ctx.fillStyle = '#a77746';
        ctx.fillRect(x - 8 * s, y - 2.5 * s, 16 * s, 5 * s);
        ctx.strokeRect(x - 8 * s, y - 2.5 * s, 16 * s, 5 * s);
      } else if (p.dive) {
        // A dive site: a diver-down flag (red, a white stripe across) on a short pole.
        ctx.beginPath();
        ctx.moveTo(x - 5 * s, y + 6 * s);
        ctx.lineTo(x - 5 * s, y - 8 * s);
        ctx.stroke();
        ctx.fillStyle = '#c23b2e';
        ctx.fillRect(x - 5 * s, y - 8 * s, 11 * s, 8 * s);
        ctx.strokeStyle = '#f4efe6';
        ctx.lineWidth = 1.8 * s;
        ctx.beginPath();
        ctx.moveTo(x - 5 * s, y - 8 * s);
        ctx.lineTo(x + 6 * s, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x - 5 * s, y - 5 * s);
        ctx.lineTo(x + 5 * s, y + 5 * s);
        ctx.moveTo(x + 5 * s, y - 5 * s);
        ctx.lineTo(x - 5 * s, y + 5 * s);
        ctx.stroke();
      }
      ctx.restore();
      const dived = p.dive && st.dive?.sites?.[p.id]?.dives;
      this.label(ctx, dived ? `${p.name} ✓` : p.name, x + 12 * s, y - 2 * s, p.camp ? 19 : 17, INK, p.camp || p.dock ? 0.95 : 0.85);
    }

    // Home: a little house; and the car, wherever it's parked.
    {
      const [x, y] = this.toPx(HOME.x, HOME.z);
      ctx.save();
      ctx.fillStyle = '#efe9df';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(x - 8 * s, y + 7 * s);
      ctx.lineTo(x - 8 * s, y - 2 * s);
      ctx.lineTo(x, y - 10 * s);
      ctx.lineTo(x + 8 * s, y - 2 * s);
      ctx.lineTo(x + 8 * s, y + 7 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3e6b6f';
      ctx.fillRect(x - 2 * s, y + 1 * s, 4 * s, 6 * s);
      ctx.restore();
      this.label(ctx, 'Home', x + 12 * s, y + 2 * s, 19, INK, 1);
      const car = st.car;
      if (car && Math.hypot(car.x - CAR_PARKS.home.x, car.z - CAR_PARKS.home.z) > 8) {
        const [cx, cy] = this.toPx(car.x, car.z);
        ctx.save();
        ctx.fillStyle = '#7d9483';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx - 8 * s, cy - 4 * s, 16 * s, 8 * s, 2 * s);
        else ctx.rect(cx - 8 * s, cy - 4 * s, 16 * s, 8 * s);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        this.label(ctx, 'Your car', cx + 11 * s, cy + 4 * s, 16, INK, 0.9);
      }
    }
    // Your camp: a tent in its own colour, with its name.
    for (const c of st.camps || []) {
      if (!c.marked) continue;
      const [x, y] = this.toPx(c.x, c.z);
      ctx.save();
      ctx.fillStyle = TENTS[c.tent]?.fly || '#7f9a6a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(x - 10 * s, y + 7 * s);
      ctx.lineTo(x, y - 9 * s);
      ctx.lineTo(x + 10 * s, y + 7 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffc977';
      ctx.beginPath();
      ctx.arc(x + 13 * s, y - 4 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.label(ctx, c.name, x + 16 * s, y + 4 * s, 18, INK, 1);
    }
    // The chart's marks: buoys (a red can, a green cone, a yellow cross), harbours (an anchor in a
    // circle) and anchorages (an anchor). See chartMarks.js.
    if (st.chart?.marks !== false) {
      for (const m of MARKS) {
        const [x, y] = this.toPx(m.x, m.z);
        if (x < -20 || y < -20 || x > cv.width + 20 || y > cv.height + 20) continue;
        ctx.save();
        ctx.lineWidth = 1.2 * s;
        ctx.strokeStyle = INK;
        if (m.kind === 'port' || m.kind === 'starboard' || m.kind === 'special') {
          ctx.fillStyle = m.kind === 'port' ? '#c23b2e' : m.kind === 'starboard' ? '#2f8a4a' : '#e0c23a';
          ctx.beginPath();
          if (m.kind === 'starboard') { ctx.moveTo(x, y - 6 * s); ctx.lineTo(x + 4.5 * s, y + 3 * s); ctx.lineTo(x - 4.5 * s, y + 3 * s); ctx.closePath(); }
          else if (m.kind === 'port') ctx.rect(x - 3.5 * s, y - 5 * s, 7 * s, 8 * s);
          else { ctx.arc(x, y, 4 * s, 0, Math.PI * 2); }
          ctx.fill();
          ctx.stroke();
          if (m.kind === 'special') {
            ctx.beginPath();
            ctx.moveTo(x - 3 * s, y - 9 * s); ctx.lineTo(x + 3 * s, y - 5 * s);
            ctx.moveTo(x + 3 * s, y - 9 * s); ctx.lineTo(x - 3 * s, y - 5 * s);
            ctx.stroke();
          }
        } else {
          // (An anchor: a ring, a shank, a crown.)
          ctx.strokeStyle = m.kind === 'harbour' ? '#1f4e5f' : '#2f6d5a';
          ctx.lineWidth = 1.6 * s;
          if (m.kind === 'harbour') { ctx.beginPath(); ctx.arc(x, y, 8 * s, 0, Math.PI * 2); ctx.stroke(); }
          ctx.beginPath();
          ctx.arc(x, y - 4 * s, 1.6 * s, 0, Math.PI * 2);
          ctx.moveTo(x, y - 2.4 * s); ctx.lineTo(x, y + 4 * s);
          ctx.moveTo(x - 3 * s, y - 0.5 * s); ctx.lineTo(x + 3 * s, y - 0.5 * s);
          ctx.moveTo(x - 4 * s, y + 1.5 * s); ctx.quadraticCurveTo(x, y + 6.5 * s, x + 4 * s, y + 1.5 * s);
          ctx.stroke();
        }
        ctx.restore();
        if (this.view.zoom > this.fitZoom * 1.6) this.label(ctx, m.name, x + 8 * s, y + 3 * s, 11, INK, 0.75);
      }
    }
    // Your catches, where each was landed (the catch log): a dot each, the colour of its kind's
    // water (sea blue, fresh green).
    if (st.chart?.catches) {
      for (const e of (st.log || []).slice(-400)) {
        if (!Number.isFinite(e.x) || !Number.isFinite(e.z)) continue;
        const [x, y] = this.toPx(e.x, e.z);
        if (x < -10 || y < -10 || x > cv.width + 10 || y > cv.height + 10) continue;
        ctx.save();
        ctx.fillStyle = e.water === 'fresh' ? 'rgba(60,120,60,0.75)' : 'rgba(40,80,140,0.75)';
        ctx.beginPath();
        ctx.arc(x, y, 2.6 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    // Routes: the one being planned (dashed, its marks numbered), the one you're following (solid),
    // and one you've asked to see.
    const drawRoute = (pts, colour, dashed, active) => {
      if (pts.length < 1) return;
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2.2 * s;
      ctx.setLineDash(dashed ? [7 * s, 5 * s] : []);
      ctx.beginPath();
      pts.forEach((p, i) => {
        const [x, y] = this.toPx(p[0], p[1]);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      pts.forEach((p, i) => {
        const [x, y] = this.toPx(p[0], p[1]);
        ctx.fillStyle = active && i === active.leg ? '#e8b440' : '#f6efdc';
        ctx.beginPath();
        ctx.arc(x, y, 6 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = `${10 * s}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x, y + 0.5 * s);
      });
      ctx.restore();
    };
    const active = st.route ? (st.routes || []).find((r) => r.id === st.route.id) : null;
    if (active) drawRoute(active.pts, '#1f4e5f', false, st.route);
    const shown = this.showRoute && this.showRoute !== active?.id ? (st.routes || []).find((r) => r.id === this.showRoute) : null;
    if (shown) drawRoute(shown.pts, '#6b5b8a', false, null);
    if (this.planning && this.plan.length) drawRoute(this.plan, '#b5532f', true, null);
    // Your marks: a star for a favourite spot, a flag for anything else.
    for (const p of st.pins || []) {
      const [x, y] = this.toPx(p.x, p.z);
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6 * s;
      if (p.fav) {
        ctx.fillStyle = '#e8b440';
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2, r = (k % 2 ? 3.4 : 8) * s;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y + 6 * s);
        ctx.lineTo(x, y - 9 * s);
        ctx.stroke();
        // (A friend's mark flies a sea-green flag.)
        ctx.fillStyle = p.from ? '#2f8f8a' : '#b5532f';
        ctx.beginPath();
        ctx.moveTo(x, y - 9 * s);
        ctx.lineTo(x + 9 * s, y - 6 * s);
        ctx.lineTo(x, y - 3 * s);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      if (p.title && (p.fav || this.view.zoom > this.fitZoom * 2 * ZOOM)) this.label(ctx, p.from ? `${p.title} (${p.from})` : p.title, x + 11 * s, y + 3 * s, 15, INK, 0.95);
    }
    // Gulls you've seen diving lately (once you've learned to look for them).
    if (st.unlocks?.birdMarks) {
      for (const f of this.hooks.birds?.() || []) {
        const [x, y] = this.toPx(f.x, f.z);
        ctx.save();
        ctx.globalAlpha = Math.max(0.25, 1 - f.age);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8 * s;
        for (const [dx, dy] of [[-6, -2], [5, -6], [2, 4]]) {
          ctx.beginPath();
          ctx.moveTo(x + (dx - 4) * s, y + (dy - 2) * s);
          ctx.quadraticCurveTo(x + (dx - 2) * s, y + (dy - 4) * s, x + dx * s, y + dy * s);
          ctx.quadraticCurveTo(x + (dx + 2) * s, y + (dy - 4) * s, x + (dx + 4) * s, y + (dy - 2) * s);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // The boats, as arrows in their own paint, and you.
    for (const b of this.where?.boats || []) {
      const [x, y] = this.toPx(b.pos.x, b.pos.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(Math.cos(b.heading), Math.sin(b.heading)));
      ctx.fillStyle = BOAT_COLORS[b.kind] || INK;
      ctx.strokeStyle = '#f6efe2';
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(11 * s, 0);
      ctx.lineTo(-7 * s, 6 * s);
      ctx.lineTo(-3.5 * s, 0);
      ctx.lineTo(-7 * s, -6 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // Jobs you've taken (see contracts.js): each one's next mark, an amber diamond and its name.
    for (const j of this.where?.jobs?.() || []) {
      const [x, y] = this.toPx(j.x, j.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = j.ready ? '#3f9b5a' : '#e0a12f';
      ctx.strokeStyle = '#f6efe2';
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.moveTo(0, -8 * s);
      ctx.lineTo(7 * s, 0);
      ctx.lineTo(0, 8 * s);
      ctx.lineTo(-7 * s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.font = `600 ${Math.round(11 * s)}px sans-serif`;
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.fillText(j.name, 11 * s, 4 * s);
      ctx.restore();
    }
    // Friends you're playing with: a boat arrow (or a dot, ashore) in their own colour, and their name.
    for (const f of this.where?.friends?.() || []) {
      const [x, y] = this.toPx(f.x, f.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = f.colour || INK;
      ctx.strokeStyle = '#f6efe2';
      ctx.lineWidth = 1.6 * s;
      if (f.mode === 'boat') {
        ctx.rotate(Math.atan2(Math.cos(f.heading), Math.sin(f.heading)));
        ctx.beginPath();
        ctx.moveTo(12 * s, 0);
        ctx.lineTo(-8 * s, 7 * s);
        ctx.lineTo(-4 * s, 0);
        ctx.lineTo(-8 * s, -7 * s);
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 6 * s, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      const what = f.on ? ', a fish on!' : f.boat ? `, in the ${f.boat}` : f.mode === 'dive' ? ', diving' : f.mode === 'car' ? ', driving' : '';
      this.label(ctx, `${f.name}${what}`, x + 13 * s, y - 9 * s, 16, f.colour || INK, 0.95);
    }
    // On the open sea's chart: the crossing, Gannet Light to the island, with its length.
    if (this.key === 'ocean') {
      const [ax, ay] = this.toPx(ENDS.home.x, ENDS.home.z), [bx, by] = this.toPx(ENDS.south.x, ENDS.south.z);
      ctx.save();
      ctx.strokeStyle = '#2f6f74';
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2.5 * s;
      ctx.setLineDash([8 * s, 6 * s]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();
      this.label(ctx, 'Gannet Light', ax + 10 * s, ay - 10 * s, 16, INK, 0.9);
      this.label(ctx, 'Las Brasas', bx + 10 * s, by + 14 * s, 18, INK, 0.9);
      this.label(ctx, `${(CROSS_M / 1000).toFixed(1)} km of open sea`, (ax + bx) / 2 + 12 * s, (ay + by) / 2, 16, '#2f6f74', 0.9);
    }
    const me = this.where?.player;
    if (me) {
      const [x, y] = this.toPx(me.x, me.z);
      ctx.save();
      ctx.fillStyle = '#e8b440';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(x, y, 6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, 12 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      this.label(ctx, 'You', x + 12 * s, y + 12 * s, 15, INK, 0.9);
    }

    // Compass
    ctx.save();
    ctx.translate(cv.width - 34 * s, 50 * s);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(0, -20 * s);
    ctx.lineTo(6 * s, 7 * s);
    ctx.lineTo(0, 2 * s);
    ctx.lineTo(-6 * s, 7 * s);
    ctx.closePath();
    ctx.fill();
    ctx.font = `700 ${20 * s}px Caveat, cursive`;
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -25 * s);
    ctx.restore();

    // Scale bar: 100 m (or 500 m when zoomed out).
    const m = this.view.zoom * 100 > 60 * s ? 100 : 500, len = m * this.view.zoom;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 2 * s;
    const bx = 16 * s, by = cv.height - 18 * s;
    ctx.beginPath();
    ctx.moveTo(bx, by - 5 * s);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + len, by);
    ctx.lineTo(bx + len, by - 5 * s);
    ctx.stroke();
    ctx.font = `${14 * s}px Kalam, cursive`;
    ctx.fillText(`${m} m`, bx + len + 6 * s, by);
    ctx.restore();
  }

  // A label, unless it would sit on top of one already drawn.
  label(ctx, text, x, y, size, color, alpha) {
    const s = this.dpr;
    ctx.save();
    ctx.font = `${Math.round(size * s)}px Kalam, cursive`;
    const w = ctx.measureText(text).width, h = size * s;
    let lx = x;
    if (lx + w > this.canvas.width - 6 * s) lx = x - w - 24 * s;
    const box = [lx - 2, y - h / 2 - 2, lx + w + 2, y + h / 2 + 2];
    if (this.labels.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) {
      ctx.restore();
      return;
    }
    this.labels.push(box);
    ctx.globalAlpha = alpha;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = 'rgba(243, 232, 207, 0.85)';
    ctx.strokeText(text, lx, y);
    ctx.fillStyle = color;
    ctx.fillText(text, lx, y);
    ctx.restore();
  }

  /* ---------------- your marks ---------------- */

  // A layer of the chart on or off (marks: buoys and harbours; catches: where you've landed fish).
  setLayer(id) {
    const st = this.state;
    st.chart = { marks: st.chart?.marks !== false, catches: !!st.chart?.catches };
    st.chart[id] = !st.chart[id];
    this.hooks.changed?.();
    this.renderLayers();
    this.draw();
  }
  renderLayers() {
    $('map-lay-marks').setAttribute('aria-pressed', String(this.state.chart?.marks !== false));
    $('map-lay-catch').setAttribute('aria-pressed', String(!!this.state.chart?.catches));
  }

  // Planning a route: each click on the chart a mark, in order (see routes.js).
  setPlanning(on) {
    this.planning = on;
    if (on) {
      this.setMarking(false);
      this.plan = [];
      const B = this.hooks.routeBoat?.();
      if (B?.at) this.plan.push([Math.round(B.at.x), Math.round(B.at.z)]);
    }
    $('map-route').setAttribute('aria-pressed', String(on));
    $('map-route').textContent = on ? 'Planning: click the chart for each mark' : 'Plan a route';
    this.renderPlan();
    this.draw();
  }
  // The route being planned: each leg's course and distance, and the whole of it for the boat
  // you'll take (her cruise and what she burns there).
  renderPlan() {
    const el = $('map-plan');
    el.hidden = !this.planning;
    if (!this.planning) return;
    const B = this.hooks.routeBoat?.(), out = [];
    const { legs } = legsOf(this.plan);
    const p = document.createElement('p');
    p.className = 'map-note';
    p.textContent = this.plan.length < 2 ? 'Click the chart for each mark of your route, in order (it starts where you are).' : `${legs.length} leg${legs.length > 1 ? 's' : ''}:`;
    out.push(p);
    if (legs.length) {
      const ol = document.createElement('ol');
      ol.className = 'map-legs';
      for (const L of legs) {
        const li = document.createElement('li');
        li.textContent = `${courseWords(L.course)} for ${rangeWords(L.m)}`;
        ol.append(li);
      }
      out.push(ol);
      if (B) {
        const P = passage(this.plan, B);
        const t = document.createElement('p');
        t.className = 'map-note';
        t.textContent = `${P.nm.toFixed(1)} nm: about ${timeWords(P.hours)} at the helm, at the ${B.name}'s ${B.knots} knots${B.lph ? `, ${B.battery ? `about ${Math.max(1, Math.round(P.litres))}% of her battery` : `some ${Math.max(1, Math.round(P.litres))} litre${Math.max(1, Math.round(P.litres)) === 1 ? '' : 's'} of her ${Math.round(B.tank)}`}${P.spare < 0 ? (B.battery ? ': more than it holds' : ': more than she carries') : P.fine ? ': cutting it fine' : ''}` : ''}.`;
        out.push(t);
        out.push(...this.dayNotes(this.plan));
      }
    }
    const acts = document.createElement('div');
    acts.className = 'mp-acts';
    const btn = (label, run, quiet = true) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pk-btn${quiet ? ' quiet' : ''}`;
      b.textContent = label;
      b.addEventListener('click', run);
      acts.append(b);
      return b;
    };
    const save = btn('Save it', () => this.saveRoute(), false);
    save.disabled = this.plan.length < 2 || (this.state.routes || []).length >= ROUTES_MAX;
    btn('Back a mark', () => { this.plan.pop(); this.renderPlan(); this.draw(); }).disabled = !this.plan.length;
    btn('Cancel', () => this.setPlanning(false));
    out.push(acts);
    el.replaceChildren(...out);
  }
  saveRoute() {
    const st = this.state;
    st.routes ??= [];
    if (this.plan.length < 2 || st.routes.length >= ROUTES_MAX) return;
    const id = `r${Date.now().toString(36).slice(-6)}`;
    st.routes.push({ id, name: `Route ${st.routes.length + 1}`, pts: this.plan.map((p) => [...p]) });
    this.showRoute = id;
    this.setPlanning(false);
    this.hooks.changed?.();
    this.renderRoutes();
  }
  // (F2d) A route's day, leaving now in the boat you'd take (main.js routeDayLines): when she's in,
  // where she'll be when the sun goes down and whether that's water to lie in for the night, a gale
  // due on the way, and the days of stores and ice it wants.
  dayNotes(pts) {
    return (this.hooks.routeDay?.(pts) || []).map((L) => {
      const p = document.createElement('p');
      p.className = `map-note map-day${L.ok ? '' : ' warn'}`;
      p.textContent = `${L.ok ? '✓' : '!'} ${L.text}`;
      return p;
    });
  }
  // Your routes: each with its length, to follow, see on the chart, or throw away.
  renderRoutes() {
    const st = this.state, B = this.hooks.routeBoat?.();
    const rows = (st.routes || []).map((r) => {
      const li = document.createElement('li');
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'map-name';
      name.textContent = r.name;
      name.addEventListener('click', () => { this.showRoute = r.id; this.centre({ x: r.pts[0][0], z: r.pts[0][1] }); this.draw(); });
      const sub = document.createElement('span');
      const P = B ? passage(r.pts, B) : null;
      sub.textContent = `${r.pts.length} marks · ${(legsOf(r.pts).m / 1852).toFixed(1)} nm${P ? ` · ${timeWords(P.hours)} in the ${B.name}` : ''}`;
      const following = st.route?.id === r.id;
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'pk-btn';
      go.textContent = following ? 'Stop following' : 'Follow';
      go.addEventListener('click', () => {
        if (following) this.hooks.stopRoute?.();
        else this.hooks.followRoute?.(r.id);
        this.renderRoutes();
        this.draw();
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'pk-btn quiet';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        if (st.route?.id === r.id) this.hooks.stopRoute?.();
        st.routes = st.routes.filter((x) => x.id !== r.id);
        this.hooks.changed?.();
        this.renderRoutes();
        this.draw();
      });
      // (F4a) Crewing a friend's boat: navigate for them with this route.
      const skipper = this.hooks.crewSkipper?.();
      let nav = null;
      if (skipper) {
        const navving = this.hooks.navigating?.() === r.id;
        nav = document.createElement('button');
        nav.type = 'button';
        nav.className = 'pk-btn';
        nav.textContent = navving ? 'Stop navigating' : `Navigate for ${skipper}`;
        nav.addEventListener('click', () => {
          if (navving) this.hooks.stopNavigating?.();
          else this.hooks.navigateFor?.(r.id);
          this.renderRoutes();
          this.draw();
        });
      }
      li.append(name, sub, go, ...(nav ? [nav] : []), del);
      if (this.showRoute === r.id) li.append(...this.dayNotes(r.pts));
      return li;
    });
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'faint';
      li.textContent = 'None yet: plan one mark by mark, and a chartplotter steers you round it.';
      rows.push(li);
    }
    $('map-routes').replaceChildren(...rows);
  }

  setMarking(on) {
    this.marking = on;
    $('map-mark').setAttribute('aria-pressed', on);
    $('map-mark').classList.toggle('on', on);
    $('map-mark').textContent = on ? 'Click the map to mark it…' : 'Mark a spot';
    this.canvas.classList.toggle('marking', on);
  }

  addPin(x, z) {
    const st = this.state;
    if (st.pins.length >= 60) {
      $('map-note').textContent = 'You have sixty marks already: delete one to make room.';
      return;
    }
    const p = { id: `pin-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, x: Math.round(x), z: Math.round(z), title: '', note: '', fav: false, day: st.day, hour: Math.round(st.hour * 100) / 100 };
    st.pins.push(p);
    this.setMarking(false);
    this.hooks.changed?.();
    this.editPin(p);
    this.draw();
  }

  editPin(p) {
    this.editing = p;
    const f = $('map-pin-edit');
    f.hidden = !p;
    if (!p) return;
    $('mp-title').value = p.title;
    $('mp-note').value = p.note;
    $('mp-fav').checked = p.fav;
    $('mp-send').hidden = !this.hooks.canShare?.();
    $('mp-title').focus();
  }

  savePin() {
    const p = this.editing;
    if (!p) return;
    p.title = $('mp-title').value.replace(/[<>]/g, '').trim().slice(0, 40);
    p.note = $('mp-note').value.replace(/[<>]/g, '').trim().slice(0, 240);
    p.fav = $('mp-fav').checked;
    this.editPin(null);
    this.hooks.changed?.();
    this.renderSide();
    this.draw();
  }

  renderPins() {
    const pins = [...(this.state.pins || [])].sort((a, b) => b.fav - a.fav);
    $('map-pins').replaceChildren(...pins.map((p) => {
      const li = document.createElement('li');
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'map-name';
      name.textContent = `${p.fav ? '★' : '⚑'} ${p.title || 'A mark'}${p.from ? ` · from ${p.from}` : ''}`;
      name.addEventListener('click', () => this.centre(p));
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'pk-btn quiet';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => this.editPin(p));
      const sub = document.createElement('span');
      sub.textContent = p.note ? p.note.slice(0, 50) : '';
      li.append(name, sub, edit);
      return li;
    }));
  }

  /* ---------------- the list beside it ---------------- */

  renderSide() {
    const st = this.state, info = this.hooks.travelInfo();
    const found = PLACES.filter((p) => st.places[p.id]);
    $('map-sub').textContent = this.highlight
      ? `Shaded: water that suits ${fishById[this.highlight].name.toLowerCase()} (${[...new Set(fishById[this.highlight].life.zones.map((z) => ZONE_NAMES[z] || z))].join(', ')}). It shows where to look, not where each fish is.`
      : this.key === 'ocean' ? `The open Atlantic between Willow Bay and Las Brasas: ${(CROSS_M / 1000).toFixed(1)} km of open sea from Gannet Light to the island.`
        : `${found.length} of ${PLACES.length} places found · ${Math.round(this.explored.fraction * 100)}% of ${this.key === 'south' ? 'Las Brasas' : 'the coast'} explored`;

    // Camps you can head to (the walk or sail there happens in a short fade; time passes).
    const camps = found.filter((p) => p.camp);
    const rows = camps.map((p) => {
      const li = document.createElement('li');
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'map-name';
      name.textContent = p.name;
      name.addEventListener('click', () => this.centre(p));
      const sub = document.createElement('span');
      sub.textContent = p.sub;
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'pk-btn';
      go.textContent = info.here === p.id ? 'You’re here' : 'Go there';
      // (Home's camps from Las Brasas, or its harbour from home: only the long passage.)
      go.disabled = !info.camps || info.here === p.id || !!p.south !== (this.key === 'south');
      go.addEventListener('click', () => this.hooks.travel(p.id === 'camp' ? 'camp' : p.id));
      li.append(name, sub, go);
      return li;
    });
    const boatRow = document.createElement('li');
    const bname = document.createElement('button');
    bname.type = 'button';
    bname.className = 'map-name';
    bname.textContent = `The ${this.where?.boat?.name || 'boat'}`;
    bname.addEventListener('click', () => this.centre(this.where?.boat?.pos));
    const bsub = document.createElement('span');
    bsub.textContent = this.where?.onFoot ? 'where you left it' : 'you’re aboard';
    const bgo = document.createElement('button');
    bgo.type = 'button';
    bgo.className = 'pk-btn';
    bgo.textContent = this.where?.onFoot ? 'Go there' : 'Aboard';
    bgo.disabled = !info.boat;
    bgo.addEventListener('click', () => this.hooks.travel('boat'));
    boatRow.append(bname, bsub, bgo);
    // Your own camp and Willowhaven, to head straight to.
    const row = (title, sub, label, can, dest, at) => {
      const li = document.createElement('li');
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'map-name';
      name.textContent = title;
      name.addEventListener('click', () => this.centre(at));
      const span = document.createElement('span');
      span.textContent = sub;
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'pk-btn';
      go.textContent = label;
      go.disabled = !can;
      go.addEventListener('click', () => this.hooks.travel(dest));
      li.append(name, span, go);
      return li;
    };
    const extra = [];
    extra.push(row('Home', 'your house and garage', info.here === 'home' ? 'You’re here' : 'Go there', info.home, 'home', HOME));
    if (st.car && info.carAway) extra.push(row('Your car', info.carWords || 'parked', 'Go there', info.car, 'car', st.car));
    for (const c of st.camps || []) extra.push(row(c.name, 'your camp', info.here === 'own' ? 'You’re here' : 'Go there', info.own, 'own', c));
    const haven = PLACES.find((p) => p.id === 'haven');
    if (st.places.haven) extra.push(row(haven.name, 'the harbour', info.here === 'haven' ? 'You’re here' : 'Go there', info.haven, 'haven', haven));
    $('map-camps').replaceChildren(...extra, ...rows, boatRow);
    $('map-note').textContent = info.note || '';
    this.renderPins();
    this.renderLayers();
    this.renderRoutes();
    this.renderPlan();

    const others = found.filter((p) => !p.camp);
    // (What you've had at each, from your own catches: see grounds.js.)
    const had = new Map(groundsOf(st.log).map((g) => [g.place, g]));
    const items = others.map((p) => {
      const li = document.createElement('li');
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'map-name';
      name.textContent = p.name;
      name.addEventListener('click', () => this.centre(p));
      const sub = document.createElement('span');
      sub.textContent = p.sub;
      li.append(name, sub);
      const g = had.get(p.name);
      if (g) {
        const k = document.createElement('span');
        k.className = 'map-had';
        k.textContent = `Yours here: ${g.kinds.slice(0, 3).map((K) => `${fishById[K.sp]?.name.toLowerCase() || K.sp} ${K.n}`).join(' · ')}${g.kinds.length > 3 ? ' …' : ''}`;
        li.append(k);
      }
      return li;
    });
    const left = PLACES.length - found.length;
    if (left) {
      const li = document.createElement('li');
      li.className = 'faint';
      li.textContent = `${left} more to find${found.length < 8 ? ': follow the coast, the rivers and the trails' : ''}.`;
      items.push(li);
    }
    $('map-places').replaceChildren(...items);
  }
}
// (Home's sheet unless told otherwise, even for a map made without its window, as the tests do.)
MapSheet.prototype.S = SHEET;
MapSheet.prototype.cols = COLS;
MapSheet.prototype.rows = ROWS;
