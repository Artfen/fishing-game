import { FISH, drawFishSketch, drawLanternSketch } from './fish.js';
import { PLACES, MAP_RECT, solidHeight } from './world/terrain.js';
import { formatClock } from './world/sky.js';

const $ = (id) => document.getElementById(id);
const ZONE_WORDS = { bay: 'in Willow Bay', cove: 'in Driftwood Cove', open: 'out on open water' };
const SOMEDAY = ['a softer cushion', 'a better rod', 'a potted fern', 'a little cabin'];

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
  }

  get isOpen() { return !this.el.hidden; }

  open(boat) {
    this.render(boat);
    this.el.hidden = false;
  }

  close() {
    this.el.hidden = true;
  }

  render(boat) {
    const st = this.state;
    this.fishEl.replaceChildren(...FISH.map((f) => this.fishEntry(f, st.fish[f.id])));

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

    this.drawMap(boat);
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
    } else {
      text.append(el('p', 'j-meta', 'Not caught yet'));
    }
    art.append(cv, text);
    return art;
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

  drawMap(boat) {
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
        ctx.font = '700 40px Caveat, cursive';
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
      const right = x < W - 170;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillText(p.name, x + (right ? 12 : -12), y - 2);
    }

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
