import * as THREE from 'three';
import { PLACES, PATH, WEND_TRAIL, zoneAt, ZONE_NAMES } from './world/terrain.js';
import { fishById } from './fish.js';
import { habitsOf } from './guide.js';

// The map (M): the whole coast as you've seen it. Water you've crossed and shores you've
// walked are drawn in; the rest stays blank paper until you go there. Places you've found are
// marked, with the camps you can head to, where your boats are, and where your best fish came from.

const $ = (id) => document.getElementById(id);

// The part of the world the map covers (metres), and the grid of 20 m cells it remembers.
export const SHEET = { x: -560, z: -720, w: 1400, h: 2000 };
const CELL = 20;
export const COLS = SHEET.w / CELL, ROWS = SHEET.h / CELL;

// Which cells you've seen, kept in the save as a short base64 string.
export class Explored {
  constructor(saved = '') {
    this.bits = new Uint8Array(Math.ceil((COLS * ROWS) / 8));
    this.version = 0;
    if (typeof saved === 'string' && saved) {
      try {
        const raw = atob(saved);
        for (let i = 0; i < Math.min(raw.length, this.bits.length); i++) this.bits[i] = raw.charCodeAt(i);
      } catch {
        // A damaged string: start the map afresh rather than trust it.
      }
    }
  }

  has(i, j) {
    if (i < 0 || j < 0 || i >= COLS || j >= ROWS) return false;
    const k = j * COLS + i;
    return (this.bits[k >> 3] >> (k & 7)) & 1;
  }

  // Everything within r metres of (x, z) has been seen. Says whether anything was new.
  reveal(x, z, r) {
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
    return n / (COLS * ROWS);
  }

  toString() {
    let s = '';
    for (const b of this.bits) s += String.fromCharCode(b);
    return btoa(s);
  }
}

const BOAT_COLORS = { row: '#b5532f', skiff: '#2f4f7a', kayak: '#e8742a', bass: '#7a2430' };
const canvas2 = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const INK = '#3a2e26';
const half = THREE.DataUtils.fromHalfFloat;

export class MapSheet {
  // height: { data, width, height, rect } from the baked terrain texture (half floats, RGBA:
  // height and freshness first). hooks: travel(dest), travelInfo(), close().
  constructor(state, explored, height, hooks) {
    this.state = state;
    this.explored = explored;
    this.height = height;
    this.hooks = hooks;
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
    this.bindPointer();
    addEventListener('resize', () => { if (this.isOpen) this.draw(); });
  }

  get isOpen() { return !this.el.hidden; }

  // Where a species can live, as cells of the map: its waters, at depths that suit it. (From
  // the simulation's own habitat data, so it never shows a fish where the game has none.)
  suitability(id) {
    this.masks = this.masks || new Map();
    if (this.masks.has(id)) return this.masks.get(id);
    const sp = fishById[id], L = sp.life, H = habitsOf(sp);
    const mask = new Uint8Array(COLS * ROWS);
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const x = SHEET.x + (i + 0.5) * CELL, z = SHEET.z + (j + 0.5) * CELL;
        const depth = -this.sample(x, z)[0];
        if (depth < 0.3) continue;
        if (!L.zones.includes(zoneAt(x, z))) continue;
        if (depth < Math.max(0.3, H.depth[0] * 0.6)) continue;
        if ((L.bottom || L.flat) && depth > H.depth[1] + 3) continue;
        mask[j * COLS + i] = 1;
      }
    }
    this.masks.set(id, mask);
    return mask;
  }

  // The suitable water as a soft overlay, in a canvas the size of the base map.
  overlay(id) {
    const mask = this.suitability(id);
    const m = canvas2(COLS, ROWS), mctx = m.getContext('2d'), img = mctx.createImageData(COLS, ROWS);
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
  // suits a species shaded over it.
  miniMap(cv, id) {
    if (!this.base) this.bake();
    if (this.fogVersion !== this.explored.version || !this.fog) this.buildFog();
    const ctx = cv.getContext('2d');
    ctx.drawImage(this.base, 0, 0, cv.width, cv.height);
    ctx.drawImage(this.fog, 0, 0, cv.width, cv.height);
    ctx.globalAlpha = 0.6;
    ctx.drawImage(this.overlay(id), 0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(58, 46, 38, 0.5)';
    ctx.strokeRect(0.5, 0.5, cv.width - 1, cv.height - 1);
  }

  // where = { player: { x, z, heading }, onFoot, boats, boat (the one you're in or last used) }
  // highlight: a species id, to shade the water that suits it.
  open(where, highlight = null) {
    this.where = where;
    this.highlight = highlight;
    this.highlightImg = highlight ? this.overlay(highlight) : null;
    this.el.hidden = false;
    if (!this.base) this.bake();
    this.fit();
    // Start a little zoomed in, around you; showing a species' water, take in the nearest of it
    // too.
    this.view.zoom = this.fitZoom * 2.2;
    const near = highlight && this.nearestSuitable(highlight, where.player);
    if (near) {
      const p = where.player, m = 1.5 * CELL;
      const w = Math.abs(near.x - p.x) + 2 * m, h = Math.abs(near.z - p.z) + 2 * m;
      this.view.zoom = Math.max(this.fitZoom, Math.min(this.view.zoom, (this.canvas.width * 0.8) / w, (this.canvas.height * 0.8) / h));
      this.centre({ x: (p.x + near.x) / 2, z: (p.z + near.z) / 2 });
    } else this.centre(where.player);
    this.renderSide();
  }

  // The middle of the suitable cell nearest a point.
  nearestSuitable(id, p) {
    const mask = this.suitability(id);
    let best = null, bd = Infinity;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        if (!mask[j * COLS + i]) continue;
        const x = SHEET.x + (i + 0.5) * CELL, z = SHEET.z + (j + 0.5) * CELL, d = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (d < bd) {
          bd = d;
          best = { x, z };
        }
      }
    }
    return best;
  }

  close() {
    this.el.hidden = true;
  }

  /* ---------------- drawing ---------------- */

  // The land and water, drawn once: shoreline in ink, hills in contours, water by depth.
  bake() {
    const BW = 700, BH = 1000;
    const c = document.createElement('canvas');
    c.width = BW;
    c.height = BH;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(BW, BH);
    const d = img.data;
    const H = this.height;
    const hs = new Float32Array(BW * BH), fr = new Float32Array(BW * BH);
    for (let j = 0; j < BH; j++) {
      const z = SHEET.z + ((j + 0.5) / BH) * SHEET.h;
      for (let i = 0; i < BW; i++) {
        const x = SHEET.x + ((i + 0.5) / BW) * SHEET.w;
        const s = this.sample(x, z);
        hs[j * BW + i] = s[0];
        fr[j * BW + i] = s[1];
      }
    }
    const band = (h, step) => Math.floor(h / step);
    for (let j = 1; j < BH - 1; j++) {
      for (let i = 1; i < BW - 1; i++) {
        const k = j * BW + i, h = hs[k], o = k * 4;
        const nb = [hs[k - 1], hs[k + 1], hs[k - BW], hs[k + BW]];
        let r, g, b;
        if (h > 0) {
          if (nb.some((n) => n <= 0)) [r, g, b] = [74, 58, 44];
          else if (nb.some((n) => n > 0 && band(n, 8) !== band(h, 8))) [r, g, b] = [150, 128, 92];
          else if (h < 2.5) [r, g, b] = [226, 208, 166];
          else if (h < 14) [r, g, b] = [205, 200, 150];
          else [r, g, b] = [196, 178, 132];
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
    this.base = c;
  }

  // Height and freshness at (x, z) from the baked texture (bilinear).
  sample(x, z) {
    const H = this.height, W = H.width, Hh = H.height;
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
    return out;
  }

  // Blank paper over everything you haven't seen yet, with soft edges.
  buildFog() {
    const m = document.createElement('canvas');
    m.width = COLS;
    m.height = ROWS;
    const mctx = m.getContext('2d');
    const img = mctx.createImageData(COLS, ROWS);
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) img.data[(j * COLS + i) * 4 + 3] = this.explored.has(i, j) ? 255 : 0;
    }
    mctx.putImageData(img, 0, 0);
    const f = this.fog || document.createElement('canvas');
    f.width = 350;
    f.height = 500;
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
    this.fitZoom = Math.min(this.canvas.width / SHEET.w, this.canvas.height / SHEET.h);
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
    v.zoom = Math.max(this.fitZoom, Math.min(this.fitZoom * 8, v.zoom * k));
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
    v.x = SHEET.w / 2 < hw ? SHEET.x + SHEET.w / 2 : Math.max(SHEET.x + hw, Math.min(SHEET.x + SHEET.w - hw, v.x));
    v.z = SHEET.h / 2 < hh ? SHEET.z + SHEET.h / 2 : Math.max(SHEET.z + hh, Math.min(SHEET.z + SHEET.h - hh, v.z));
  }

  bindPointer() {
    const cv = this.canvas, pts = new Map();
    let pinch = 0;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
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
    const [x0, y0] = this.toPx(SHEET.x, SHEET.z);
    const w = SHEET.w * this.view.zoom, h = SHEET.h * this.view.zoom;
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
    if (st.places.camp) trail(PATH);
    if (st.places.quay || st.places.boathouse) trail(WEND_TRAIL);

    ctx.drawImage(this.fog, x0, y0, w, h);
    if (this.highlightImg) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.highlightImg, x0, y0, w, h);
      ctx.globalAlpha = 1;
    }

    // Edge of the sheet.
    ctx.strokeStyle = 'rgba(58, 46, 38, 0.5)';
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(x0, y0, w, h);

    this.labels = [];
    // Big waters: their names written across them.
    for (const p of PLACES) {
      if (!p.area || !st.places[p.id]) continue;
      const [x, y] = this.toPx(p.x, p.z);
      ctx.save();
      ctx.globalAlpha = 0.5;
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
    const near = this.view.zoom > this.fitZoom * 3;
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
      } else {
        ctx.beginPath();
        ctx.moveTo(x - 5 * s, y - 5 * s);
        ctx.lineTo(x + 5 * s, y + 5 * s);
        ctx.moveTo(x + 5 * s, y - 5 * s);
        ctx.lineTo(x - 5 * s, y + 5 * s);
        ctx.stroke();
      }
      ctx.restore();
      this.label(ctx, p.name, x + 12 * s, y - 2 * s, p.camp ? 19 : 17, INK, p.camp || p.dock ? 0.95 : 0.85);
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

  /* ---------------- the list beside it ---------------- */

  renderSide() {
    const st = this.state, info = this.hooks.travelInfo();
    const found = PLACES.filter((p) => st.places[p.id]);
    $('map-sub').textContent = this.highlight
      ? `Shaded: water that suits ${fishById[this.highlight].name.toLowerCase()} (${[...new Set(fishById[this.highlight].life.zones.map((z) => ZONE_NAMES[z] || z))].join(', ')}). It shows where to look, not where each fish is.`
      : `${found.length} of ${PLACES.length} places found · ${Math.round(this.explored.fraction * 100)}% of the coast explored`;

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
      go.disabled = !info.camps || info.here === p.id;
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
    $('map-camps').replaceChildren(...rows, boatRow);
    $('map-note').textContent = info.note || '';

    const others = found.filter((p) => !p.camp);
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
