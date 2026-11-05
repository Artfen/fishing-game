// The fish finder as a head unit (see sonar.js): the screen of a modern marine sonar, drawn from
// the same pings. Three pages: the traditional 2D sonar (echoes coloured by how strong they come
// back, the bottom a hard band, fish as arches or as fish symbols with their depths, and a
// flasher strip at the right edge showing the ping going out now), a down view (the same echoes
// drawn the way a high-frequency imaging transducer shows them: almost a photograph of the
// bottom, with fish as bright little dashes), and the two side by side. Readouts along the top:
// the depth, the water's temperature, your speed. Colour palettes, gain, range and zoom, as on
// the real thing. (An original design: no maker's name, look or screens copied.)

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const PAGES = ['sonar', 'down', 'split'];
export const PAGE_NAMES = { sonar: '2D sonar', down: 'Down view', split: 'Split' };
export const ZOOMS = ['Off', '2×', 'Bottom lock'];

// Palettes: the screen's colour ramp from no return to the strongest (each [r, g, b] stops),
// the water's background, and the down view's tint.
export const PALETTES = [
  { id: 'classic', name: 'Classic blue', bg: ['#0b2a8a', '#06145a'], ramp: [[40, 120, 255], [40, 200, 240], [60, 220, 90], [250, 235, 60], [255, 140, 30], [235, 40, 30]], ink: '#e9f3ff', down: [[8, 6, 4], [255, 196, 120]] },
  { id: 'amber', name: 'Amber', bg: ['#050505', '#000000'], ramp: [[60, 30, 0], [140, 70, 0], [220, 120, 0], [255, 170, 20], [255, 210, 80], [255, 245, 190]], ink: '#ffd38a', down: [[4, 3, 0], [255, 200, 90]] },
  { id: 'daylight', name: 'Daylight', bg: ['#f4f7fb', '#dfe7f0'], ramp: [[170, 200, 235], [90, 140, 220], [40, 80, 190], [30, 40, 120], [90, 20, 60], [10, 10, 20]], ink: '#10203a', down: [[236, 241, 246], [20, 34, 60]] },
  { id: 'night', name: 'Night red', bg: ['#000000', '#000000'], ramp: [[50, 0, 0], [110, 0, 0], [170, 10, 10], [220, 30, 20], [255, 70, 50], [255, 150, 120]], ink: '#ff6a5a', down: [[0, 0, 0], [255, 70, 50]] },
];

// The palette's colour for a return of strength k (0 … 1), as [r, g, b].
export function rampAt(P, k) {
  const R = P.ramp, x = clamp(k, 0, 1) * (R.length - 1), i = Math.min(R.length - 2, Math.floor(x)), u = x - i;
  return [0, 1, 2].map((c) => Math.round(R[i][c] + (R[i + 1][c] - R[i][c]) * u));
}
const css = (c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

// The depths on screen: { top, bottom } (m), and lock (true: each reading drawn with its own
// bottom at the same height, as bottom lock does). range: the scale (m); zoom: 0 off, 1 2×
// (half the range, following the bottom), 2 bottom lock (the few metres above the bottom).
export function depthWindow(range, zoom, bottom) {
  if (zoom === 1) {
    const span = range / 2, top = clamp(bottom + 0.6 - span, 0, Math.max(0, range - span));
    return { top, bottom: top + span, lock: false };
  }
  if (zoom === 2) {
    const span = clamp(range / 3, 2, 6);
    return { top: -span, bottom: 0.8, lock: true };
  }
  return { top: 0, bottom: range, lock: false };
}

// Fish worth a label: a fair-sized, firm echo, and not one labelled just before at about the same
// depth (one fish crossing the beam makes an arch over several pings: one label for it). Marks
// ping.labels (depths) on the newest ping.
export function labelFish(pings) {
  const p = pings[pings.length - 1];
  if (!p) return;
  p.labels = [];
  for (const f of p.fish) {
    if (f.size < 0.35 || f.strength < 0.3) continue;
    let seen = false;
    for (let i = pings.length - 2; i >= Math.max(0, pings.length - 14) && !seen; i--) seen = (pings[i].labels || []).some((d) => Math.abs(d - f.depth) < 0.9);
    if (!seen && !p.labels.some((d) => Math.abs(d - f.depth) < 0.9)) p.labels.push(f.depth);
  }
}

// A little hash for steady speckle (the same reading always looks the same as it scrolls).
const hash = (a, b) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// Draw the unit's screen on ctx (W × H). U: { pings, history, range, opts (the finder's settings:
// page, pal, gain, zoom, symbols), read: { depth, type, temp, speed, ball, mode } }, message:
// words across the screen instead.
export function drawUnit(ctx, W, H, U, message) {
  const o = U.opts, P = PALETTES[o.pal] || PALETTES[0];
  const bar = Math.round(H * 0.12);
  const R = U.read || {};
  // The data bar along the top.
  ctx.fillStyle = '#05080c';
  ctx.fillRect(0, 0, W, bar);
  ctx.fillStyle = '#e9f3ff';
  ctx.textBaseline = 'middle';
  const big = Math.round(bar * 0.62), small = Math.round(bar * 0.3);
  ctx.textAlign = 'left';
  ctx.font = `800 ${big}px Nunito, system-ui, sans-serif`;
  const depthText = R.depth != null ? R.depth.toFixed(1) : '–';
  ctx.fillText(depthText, 10, bar / 2);
  const dw = ctx.measureText(depthText).width;
  ctx.font = `700 ${small}px Nunito, system-ui, sans-serif`;
  ctx.fillText('m', 14 + dw, bar / 2 + big * 0.18);
  ctx.globalAlpha = 0.7;
  ctx.fillText(R.type ? R.type.toUpperCase() : '', 14 + dw + small * 1.6, bar / 2 + big * 0.18);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'right';
  ctx.font = `800 ${Math.round(bar * 0.42)}px Nunito, system-ui, sans-serif`;
  const sp = R.speed != null ? `${(R.speed * 1.944).toFixed(1)}` : '–', tp = R.temp != null ? `${R.temp.toFixed(1)}°` : '–';
  ctx.fillText(sp, W - 10 - small * 1.6, bar * 0.5);
  ctx.font = `700 ${small}px Nunito, system-ui, sans-serif`;
  ctx.fillText('kn', W - 10, bar * 0.5 + small * 0.25);
  ctx.textAlign = 'center';
  ctx.font = `800 ${Math.round(bar * 0.42)}px Nunito, system-ui, sans-serif`;
  ctx.fillText(tp, W * 0.56, bar * 0.5);
  ctx.font = `700 ${Math.round(small * 0.8)}px Nunito, system-ui, sans-serif`;
  ctx.globalAlpha = 0.65;
  ctx.fillText('WATER', W * 0.56, bar * 0.88);
  ctx.textAlign = 'right';
  ctx.fillText('SPEED', W - 10, bar * 0.88);
  ctx.globalAlpha = 1;

  // The screen below it.
  const y0 = bar, h = H - bar;
  const last = U.pings[U.pings.length - 1];
  const win = depthWindow(U.range, o.zoom, last ? last.bottom : U.range * 0.7);
  if (o.page === 'split') {
    const half = Math.round(W * 0.5);
    drawDown(ctx, 0, y0, half - 1, h, U, P, win, false);
    ctx.fillStyle = '#05080c';
    ctx.fillRect(half - 1, y0, 2, h);
    drawSonar(ctx, half + 1, y0, W - half - 1, h, U, P, win);
  } else if (o.page === 'down') drawDown(ctx, 0, y0, W, h, U, P, win, true);
  else drawSonar(ctx, 0, y0, W, h, U, P, win);

  // A word across it (a castable sonar not in the water yet).
  if (message) {
    ctx.fillStyle = 'rgba(5, 8, 12, 0.78)';
    ctx.fillRect(0, y0 + h / 2 - 34, W, 68);
    ctx.fillStyle = '#e9f3ff';
    ctx.font = `600 ${Math.round(H * 0.045)}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message.length > 60 ? `${message.slice(0, 58)}…` : message, W / 2, y0 + h / 2);
  }
}

// Depth to height within a page (with bottom lock, measured from the reading's own bottom).
const yFor = (win, y0, h) => (d, p) => {
  const dd = win.lock ? d - p.bottom : d;
  return y0 + ((dd - win.top) / (win.bottom - win.top)) * h;
};

function drawSonar(ctx, x0, y0, w, h, U, P, win) {
  const o = U.opts, pings = U.pings, n = pings.length;
  const scaleW = Math.round(w * 0.1), flashW = Math.round(w * 0.06);
  const histW = w - scaleW - flashW;
  const colW = histW / U.history;
  const yOf = yFor(win, y0, h);
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, P.bg[0]);
  g.addColorStop(1, P.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, w, h);
  const gain = o.gain / 10;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, histW + flashW, h);
  ctx.clip();
  for (let i = 0; i < n; i++) {
    const p = pings[i], x = x0 + histW - (n - i) * colW, cw = colW + 0.6;
    const yb = yOf(p.bottom, p);
    // Noise: at high gain the water fills with faint speckle.
    if (gain > 0.55) {
      const k = (gain - 0.55) * 2;
      for (let j = 0; j < 6; j++) {
        const r = hash(i + p.seed, j);
        if (r > k * 0.7) continue;
        const yy = y0 + hash(p.seed, j * 7.1) * Math.max(0, yb - y0);
        ctx.fillStyle = css(rampAt(P, 0.12), 0.7);
        ctx.fillRect(x, yy, cw, 1.5);
      }
    }
    // Surface clutter, then the drifting specks.
    for (const d of p.clutter) {
      ctx.fillStyle = css(rampAt(P, 0.25 + 0.3 * gain), 0.8);
      ctx.fillRect(x, yOf(d, p), cw, 2);
    }
    // The bottom: the strongest band at the top line, fading down through the mud or rock below.
    const hard = p.rock;
    const band = Math.max(3, h * (0.035 + 0.05 * hard));
    const bg = ctx.createLinearGradient(0, yb, 0, yb + band * 3.5);
    bg.addColorStop(0, css(rampAt(P, 1)));
    bg.addColorStop(0.25, css(rampAt(P, 0.8 + 0.2 * hard)));
    bg.addColorStop(0.6, css(rampAt(P, 0.45 + 0.2 * hard)));
    bg.addColorStop(1, css(rampAt(P, 0.15), 0.9));
    ctx.fillStyle = bg;
    ctx.fillRect(x, yb, cw, y0 + h - yb);
    // (Hard bottom: a second echo at twice the depth.)
    if (hard > 0.45 && !win.lock) {
      const y2 = yOf(p.bottom * 2, p);
      if (y2 < y0 + h) {
        ctx.fillStyle = css(rampAt(P, 0.35), 0.8);
        ctx.fillRect(x, y2, cw, 2);
      }
    }
    // Weed: ragged strands standing up off the bottom, stronger at their roots, with gaps.
    if (p.weed > 0.15 && hash(p.seed, 3.3) < 0.35 + 0.6 * p.weed) {
      const wh = Math.min(1.8, p.bottom * 0.4) * p.weed * p.weedH;
      const yt = yOf(p.bottom - wh, p);
      const wg = ctx.createLinearGradient(0, yt, 0, yb);
      wg.addColorStop(0, css(rampAt(P, 0.3), 0.35));
      wg.addColorStop(1, css(rampAt(P, 0.5), 0.9));
      ctx.fillStyle = wg;
      ctx.fillRect(x, yt, cw, yb - yt);
    }
    // Fish: arches coloured by strength (or, with fish symbols on, the symbols drawn below).
    for (const f of p.fish) {
      const fy = yOf(f.depth, p);
      const k = clamp(f.size * 1.1 * f.strength + gain * 0.15, 0, 1);
      if (o.symbols && f.size >= 0.35) continue;
      if (f.size < 0.3) {
        ctx.fillStyle = css(rampAt(P, f.bait && p.ball ? 0.5 : 0.3 + 0.3 * k));
        ctx.fillRect(x, fy, Math.max(cw, 2), 2);
      } else {
        const fh = Math.max(3, Math.min(16, f.size * 10)) * (h / 300);
        ctx.fillStyle = css(rampAt(P, 0.45 + 0.55 * k));
        ctx.fillRect(x, fy - fh / 2, Math.max(cw, 2.2), fh);
      }
    }
    if (p.bait != null) {
      const by = yOf(p.bait, p);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, by - 1, Math.max(cw, 2), 2);
    }
  }
  // Fish symbols, with the depth each was seen at.
  if (o.symbols) {
    ctx.font = `800 ${Math.round(h * 0.05)}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const p = pings[i];
      if (!p.labels?.length) continue;
      const x = x0 + histW - (n - i) * colW;
      for (const d of p.labels) {
        const fy = yOf(d, p), s = Math.round(h * 0.035);
        const f = p.fish.reduce((a, q) => (Math.abs(q.depth - d) < Math.abs(a.depth - d) ? q : a), p.fish[0] || { size: 0.5 });
        const big = f.size > 0.9;
        ctx.fillStyle = css(rampAt(P, big ? 1 : 0.75));
        fishIcon(ctx, x, fy, s * (big ? 1.3 : 1));
        ctx.fillStyle = P.ink;
        ctx.fillText(d.toFixed(1), x + s * 1.9, fy);
      }
    }
  }
  // The flasher: the ping going out now, its returns by depth in a strip at the right.
  const fx = x0 + histW;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(fx, y0, flashW, h);
  if (n) {
    const p = pings[n - 1];
    const seg = (d, k, len = 3) => {
      ctx.fillStyle = css(rampAt(P, k));
      ctx.fillRect(fx + 2, yOf(d, p) - len / 2, flashW - 4, len);
    };
    for (const d of p.clutter) seg(d, 0.35, 2);
    for (const f of p.fish) seg(f.depth, clamp(0.4 + f.size * f.strength, 0, 1), Math.max(2, f.size * 6));
    const yb = yOf(p.bottom, p);
    ctx.fillStyle = css(rampAt(P, 1));
    ctx.fillRect(fx + 2, yb, flashW - 4, Math.max(4, h * 0.05));
    if (p.bait != null) seg(p.bait, 0.9, 2);
  }
  ctx.restore();
  // The depth scale.
  const sx = x0 + w - scaleW;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(sx, y0, scaleW, h);
  ctx.fillStyle = P.ink;
  ctx.font = `700 ${Math.round(h * 0.055)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const span = win.bottom - win.top, step = span <= 4 ? 1 : span <= 8 ? 2 : span <= 20 ? 5 : 10;
  const ref = win.lock ? (pings[n - 1]?.bottom ?? 0) : 0;
  for (let d = Math.ceil(win.top / step) * step; d <= win.bottom + 1e-6; d += step) {
    const y = y0 + ((d - win.top) / span) * h;
    if (y < y0 + 8 || y > y0 + h - 6) continue;
    ctx.fillRect(sx, y - 0.75, 5, 1.5);
    ctx.fillText(win.lock ? `${Math.max(0, ref + d).toFixed(0)}` : `${d}`, x0 + w - 4, y);
  }
  ctx.textBaseline = 'bottom';
  ctx.globalAlpha = 0.8;
  ctx.fillText(win.lock ? 'BTM' : o.zoom === 1 ? '2×' : `${U.range}m`, x0 + w - 4, y0 + h - 2);
  ctx.globalAlpha = 1;
}

// A fish symbol: a little body and tail, facing left (the way the screen scrolls).
function fishIcon(ctx, x, y, s) {
  ctx.beginPath();
  ctx.ellipse(x, y, s, s * 0.55, 0, 0, Math.PI * 2);
  ctx.moveTo(x + s * 0.8, y);
  ctx.lineTo(x + s * 1.6, y - s * 0.6);
  ctx.lineTo(x + s * 1.6, y + s * 0.6);
  ctx.closePath();
  ctx.fill();
}

// The down view: a near-photographic picture of what's under the boat, in one tint.
function drawDown(ctx, x0, y0, w, h, U, P, win, scale) {
  const o = U.opts, pings = U.pings, n = pings.length;
  const scaleW = scale ? Math.round(w * 0.08) : 0;
  const histW = w - scaleW, colW = histW / U.history;
  const [dark, light] = P.down, yOf = yFor(win, y0, h);
  const tint = (k, a = 1) => css([0, 1, 2].map((c) => Math.round(dark[c] + (light[c] - dark[c]) * clamp(k, 0, 1))), a);
  ctx.fillStyle = tint(0.04);
  ctx.fillRect(x0, y0, w, h);
  const gain = o.gain / 10;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, histW, h);
  ctx.clip();
  for (let i = 0; i < n; i++) {
    const p = pings[i], x = x0 + histW - (n - i) * colW, cw = colW + 0.6;
    const yb = yOf(p.bottom, p);
    // The water: dark, faintly grainy; brighter near the surface where it's stirred.
    ctx.fillStyle = tint(0.08 + 0.05 * gain);
    ctx.fillRect(x, y0, cw, Math.max(0, yb - y0));
    for (const d of p.clutter) {
      ctx.fillStyle = tint(0.35 + 0.3 * gain, 0.8);
      ctx.fillRect(x, yOf(d, p), cw, 1.5);
    }
    // Weed: wispy strands, bright at their tips.
    if (p.weed > 0.15) {
      const wh = Math.min(1.8, p.bottom * 0.4) * p.weed * p.weedH;
      const yt = yOf(p.bottom - wh, p);
      ctx.fillStyle = tint(0.35, 0.9);
      ctx.fillRect(x, yt, cw * 0.5, yb - yt);
      ctx.fillStyle = tint(0.7);
      ctx.fillRect(x, yt, cw * 0.5, 2);
    }
    // The bottom: a bright, grainy surface (harder brighter, rock lumpy and broken), then its
    // shadow fading into the ground below.
    const hard = p.rock, rows = 10;
    const th = Math.max(4, h * (0.04 + 0.05 * hard));
    for (let j = 0; j < rows; j++) {
      const r = hash(p.seed, j * 3.7), yy = yb + (j / rows) * th * (1 + hard * hash(p.seed + 1, j));
      const k = (0.55 + 0.45 * hard) * (1 - j / rows) * (0.65 + 0.35 * r) + gain * 0.1;
      ctx.fillStyle = tint(k);
      ctx.fillRect(x, yy, cw, th / rows + 1);
    }
    const sh = ctx.createLinearGradient(0, yb + th, 0, yb + th * 4);
    sh.addColorStop(0, tint(0.3));
    sh.addColorStop(1, tint(0.02));
    ctx.fillStyle = sh;
    ctx.fillRect(x, yb + th, cw, y0 + h - yb - th);
    // Fish: bright dashes, longer for bigger fish; a bait ball a bright cloud.
    for (const f of p.fish) {
      const fy = yOf(f.depth, p), len = Math.max(2, f.size * 4);
      ctx.fillStyle = tint(f.bait && p.ball ? 0.8 : 0.75 + 0.25 * f.strength);
      ctx.fillRect(x, fy - len * 0.25, Math.max(cw, 1.6), Math.max(1.5, len * 0.5));
    }
    if (p.bait != null) {
      ctx.fillStyle = tint(1);
      ctx.fillRect(x, yOf(p.bait, p) - 1, Math.max(cw, 2), 2);
    }
  }
  ctx.restore();
  if (scale) {
    const sx = x0 + w - scaleW;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(sx, y0, scaleW, h);
    ctx.fillStyle = tint(0.9);
    ctx.font = `700 ${Math.round(h * 0.05)}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const span = win.bottom - win.top, step = span <= 4 ? 1 : span <= 8 ? 2 : span <= 20 ? 5 : 10;
    const ref = win.lock ? (pings[n - 1]?.bottom ?? 0) : 0;
    for (let d = Math.ceil(win.top / step) * step; d <= win.bottom + 1e-6; d += step) {
      const y = y0 + ((d - win.top) / span) * h;
      if (y < y0 + 8 || y > y0 + h - 6) continue;
      ctx.fillText(win.lock ? `${Math.max(0, ref + d).toFixed(0)}` : `${d}`, x0 + w - 4, y);
    }
  }
}
