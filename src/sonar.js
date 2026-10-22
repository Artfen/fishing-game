import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);

const PING_HZ = 10;
const HISTORY = 160; // pings of history (16 seconds)
const CONE = Math.tan((22 * Math.PI) / 180); // the transducer's beam spreads 22° each side
const RANGES = [3, 5, 10, 15, 20, 30, 40];
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
  scale: 'rgba(233, 244, 240, 0.55)',
  now: 'rgba(233, 244, 240, 0.07)',
};

// A small sonar. In the boat its transducer looks straight down under the hull; on foot it
// works like a castable sonar clipped above your rig, reading the water around it once it's in.
// Every ping reads the real bottom and weeds from the habitat and the real fish in its cone
// from the ecosystem, but like a real one it only shows echoes: arches whose size hints at the
// fish, clouds for small fry, some clutter, and never a name.
export class FishFinder {
  constructor(eco, habitat, state) {
    this.eco = eco;
    this.habitat = habitat;
    this.state = state;
    state.finder = { x: null, y: null, size: 1, ...(state.finder || {}) };
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
    $('sonar-help').addEventListener('click', () => this.toggleLegend());
    $('sonar-size').addEventListener('click', () => this.cycleSize());
    this.setupDrag();
    this.applySize();
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
      this.draw('Cast your rig: from the shore, the sonar reads the water around it.');
      return;
    }
    const x = src.x, z = src.z;
    const s = this.habitat.sample(x, z, this.sample);
    const raw = this.eco.queryCone(x, z, CONE, []);
    // Echoes, not fish: small or off-centre ones are sometimes missed, depths wobble a little.
    const echoes = [];
    for (const f of raw) {
      const detect = clamp(0.3 + f.size * 1.1, 0, 1) * (0.45 + 0.55 * f.strength);
      if (Math.random() > detect) continue;
      echoes.push({
        depth: f.depth * (1 + (Math.random() - 0.5) * 0.06),
        size: f.size * (0.8 + Math.random() * 0.4),
        strength: clamp(f.strength * (0.75 + Math.random() * 0.5), 0.1, 1),
      });
    }
    // Specks of drifting debris, and surface clutter when the water is churned up.
    const clutter = [];
    if (Math.random() < 0.08) clutter.push(Math.random() * s.depth);
    const churn = clamp((src.moving || 0) / 3, 0, 1);
    for (let i = 0; i < 2 + churn * 6; i++) if (Math.random() < 0.5) clutter.push(Math.random() * (0.25 + churn * 0.6));
    let baitDepth = null;
    if (bait.active) {
      const d = -bait.y, r = Math.hypot(bait.x - x, bait.z - z);
      if (d > 0 && r < CONE * d + 0.6) baitDepth = d;
    }
    this.pings.push({
      bottom: s.depth, weed: s.weed, rock: s.rock, fish: echoes, clutter, bait: baitDepth,
      weedH: 0.4 + Math.random() * 0.6,
    });
    if (this.pings.length > HISTORY) this.pings.shift();
    let deepest = 0;
    for (const p of this.pings) deepest = Math.max(deepest, p.bottom);
    this.range = RANGES.find((r) => r >= deepest + 0.6) || RANGES[RANGES.length - 1];
    const type = s.rock > 0.45 ? 'rock' : s.weed > 0.3 ? 'weed' : s.depth < 3 ? 'sand' : 'silt';
    this.depthEl.textContent = `${s.depth.toFixed(1)} m · ${type}`;
    this.draw();
  }

  draw(message) {
    const c = this.canvas, ctx = this.ctx;
    const W = c.width, H = c.height;
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
    const drawColumn = (p, x, w, alpha, big) => {
      const yb = yOf(p.bottom);
      ctx.globalAlpha = alpha;
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
      // Hard bottom: a thick, bright line and a faint second echo at twice the depth.
      const hard = p.rock;
      ctx.fillStyle = hard > 0.4 ? COLORS.bottomHard : COLORS.bottomSoft;
      ctx.fillRect(x, yb - 1, w + 0.5, (big ? 3 : 2) + hard * 4);
      if (hard > 0.45 && p.bottom * 2 < this.range) {
        ctx.globalAlpha = alpha * 0.25;
        ctx.fillRect(x, yOf(p.bottom * 2), w + 0.5, 2);
        ctx.globalAlpha = alpha;
      }
      for (const d of p.clutter) {
        ctx.fillStyle = 'rgba(233, 244, 240, 0.5)';
        ctx.fillRect(x, yOf(d), Math.max(w, 1.5), 1.5);
      }
      for (const f of p.fish) {
        const fy = yOf(f.depth);
        ctx.globalAlpha = alpha * (0.35 + 0.65 * f.strength);
        ctx.fillStyle = echo(clamp(f.size * 1.2 * f.strength, 0, 1));
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
      drawColumn(this.pings[i], x, colW, 0.35 + 0.55 * (i / Math.max(1, n - 1)), false);
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
