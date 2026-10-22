const $ = (id) => document.getElementById(id);

const PING_HZ = 10;
const HISTORY = 160; // pings of history (16 seconds)
const CONE = Math.tan((22 * Math.PI) / 180); // the transducer's beam spreads 22° each side
const RANGES = [5, 10, 15, 20, 30, 40];
const COLORS = {
  screenTop: '#12293a',
  screenBottom: '#0a1824',
  ground: '#5c4b33',
  bottomLine: '#ead3a2',
  rockLine: '#fff1d2',
  weed: '#7fc28a',
  fish: '#ffc977',
  bait: '#ff9a82',
  scale: 'rgba(233, 244, 240, 0.55)',
  now: 'rgba(233, 244, 240, 0.07)',
};

// A small boat sonar. Every ping reads the real seabed and weeds beneath the boat
// from the habitat, and the real fish inside its cone from the ecosystem.
export class FishFinder {
  constructor(eco, habitat) {
    this.eco = eco;
    this.habitat = habitat;
    this.el = $('sonar');
    this.canvas = $('sonar-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.depthEl = $('sonar-depth');
    this.legend = $('sonar-legend');
    this.pings = [];
    this.timer = 0;
    this.range = 10;
    this.visible = false;
    this.sample = {};
    $('sonar-help').addEventListener('click', () => this.toggleLegend());
  }

  setVisible(v) {
    this.visible = v;
    this.el.hidden = !v;
    document.body.classList.toggle('sonar-on', v);
    if (v) this.draw();
  }

  toggleLegend(force) {
    this.legend.hidden = force === undefined ? !this.legend.hidden : !force;
  }

  update(dt, boat, bait) {
    if (!this.visible) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1 / PING_HZ;
    const x = boat.pos.x, z = boat.pos.z;
    const s = this.habitat.sample(x, z, this.sample);
    const fish = this.eco.queryCone(x, z, CONE, []);
    let baitDepth = null;
    if (bait.active) {
      const d = -bait.y, r = Math.hypot(bait.x - x, bait.z - z);
      if (d > 0 && r < CONE * d + 0.6) baitDepth = d;
    }
    this.pings.push({ bottom: s.depth, weed: s.weed, rock: s.rock, fish, bait: baitDepth });
    if (this.pings.length > HISTORY) this.pings.shift();
    let deepest = 0;
    for (const p of this.pings) deepest = Math.max(deepest, p.bottom);
    this.range = RANGES.find((r) => r >= deepest + 1) || RANGES[RANGES.length - 1];
    this.depthEl.textContent = `${s.depth.toFixed(1)} m`;
    this.draw();
  }

  draw() {
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

    const n = this.pings.length;
    const drawColumn = (p, x, w, alpha, big) => {
      const yb = yOf(p.bottom);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(x, yb, w + 0.5, H - yb);
      if (p.weed > 0.15) {
        const wh = Math.min(1.6, p.bottom * 0.35) * p.weed;
        ctx.fillStyle = COLORS.weed;
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillRect(x, yOf(p.bottom - wh), w + 0.5, yb - yOf(p.bottom - wh));
        ctx.globalAlpha = alpha;
      }
      ctx.fillStyle = p.rock > 0.4 ? COLORS.rockLine : COLORS.bottomLine;
      ctx.fillRect(x, yb - 1, w + 0.5, (big ? 4 : 2.5) + p.rock * 3);
      ctx.fillStyle = COLORS.fish;
      for (const f of p.fish) {
        const fy = yOf(f.depth);
        const fh = Math.max(2.5, Math.min(14, f.size * 9)) * (big ? 1.4 : 1);
        ctx.globalAlpha = alpha * (0.35 + 0.65 * f.strength);
        ctx.beginPath();
        ctx.ellipse(x + w / 2, fy, Math.max(w * 1.3, big ? 6 : 2.2), fh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
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

    // "Now": what is directly beneath the boat at this moment.
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
    const step = this.range <= 10 ? (this.range <= 5 ? 1 : 2) : 5;
    for (let d = 0; d <= this.range + 0.01; d += step) {
      const y = Math.min(Math.max(yOf(d), 10), H - 10);
      ctx.fillRect(screenW, yOf(d), 6, 1.5);
      ctx.fillText(`${d}`, screenW + 10, y);
    }
    ctx.fillText('m', screenW + 34, Math.min(yOf(this.range), H - 10));
  }
}
