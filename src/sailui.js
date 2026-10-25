// The sailing panel on screen (bottom right, where the throttle lever goes in a motorboat), shown
// while you're aboard the sailing boat. A little chart of her from above, bow up: the wind (where
// it truly blows from, faint; and as she feels it, bold), the no-go zone either side of it where
// no sail can drive her, and the boom out to leeward. Under it the mainsheet, hauled in to the
// left and let out to the right, with a faint mark where it would draw best; her speed; and
// buttons to haul in or ease (hold them) and to raise or lower the sail.
//
// Like the lever, it never takes the keyboard's focus and its presses stay on it. The keys, the
// controller and the touch stick work the same sheet (see main.js): this shows it, and asks.

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const TAU = Math.PI * 2;

export class SailUI {
  // hooks: { toggle() } — raise or lower the sail; outboard() — put the outboard down (she
  // motors). this.hold: −1 while Haul in is held, +1 Ease.
  constructor(root, hooks) {
    this.root = root;
    this.h = hooks;
    this.hold = 0;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Sail');
    const head = el('div', 'lv-head');
    this.title = el('span', 'lv-title', 'Sail');
    this.now = el('b', 'lv-now', '');
    head.append(this.title, this.now);
    this.canvas = el('canvas', 'sl-chart');
    this.canvas.width = this.canvas.height = 264;
    this.sheetRow = el('div', 'sl-sheet');
    this.track = el('div', 'sl-track');
    this.best = el('div', 'sl-best');
    this.mark = el('div', 'sl-mark');
    this.track.append(this.best, this.mark);
    this.sheetRow.append(el('span', 'sl-end', 'in'), this.track, el('span', 'sl-end', 'out'));
    this.speed = el('div', 'sl-speed');
    const btns = el('div', 'sl-btns');
    this.inBtn = el('button', 'lv-motor', 'Haul in');
    this.outBtn = el('button', 'lv-motor', 'Ease');
    this.upBtn = el('button', 'lv-motor sl-up', 'Raise sail');
    this.motorBtn = el('button', 'lv-motor sl-up', 'Outboard down');
    for (const b of [this.inBtn, this.outBtn, this.upBtn, this.motorBtn]) b.type = 'button';
    btns.append(this.inBtn, this.outBtn);
    this.keys = el('div', 'lv-keys');
    root.append(head, this.canvas, this.sheetRow, this.speed, btns, this.upBtn, this.motorBtn, this.keys);
    const hold = (b, v) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hold = v;
        b.setPointerCapture?.(e.pointerId);
      });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { if (this.hold === v) this.hold = 0; });
    };
    hold(this.inBtn, -1);
    hold(this.outBtn, 1);
    this.upBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.h.toggle();
    });
    this.motorBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.h.outboard?.();
    });
    for (const ev of ['contextmenu', 'selectstart']) root.addEventListener(ev, (e) => e.preventDefault());
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'click']) root.addEventListener(ev, (e) => e.stopPropagation());
  }

  // s: { show, up, sheet, best, words, knots, awa, twa, side, boom, keys, touch }
  //   awa/twa: where the apparent and true wind come from, off the bow (rad, signed: + over the
  //   right side); boom: how far out it lies (rad, to leeward).
  update(s) {
    this.root.hidden = !s.show;
    if (!s.show) {
      this.hold = 0;
      return;
    }
    this.now.textContent = s.words;
    this.upBtn.textContent = s.up ? 'Lower sail' : 'Raise sail';
    // (A windsurf board's rig is always up, and it has no outboard.)
    this.upBtn.hidden = this.motorBtn.hidden = !!s.board;
    this.inBtn.hidden = this.outBtn.hidden = !s.up;
    this.sheetRow.hidden = !s.up;
    this.mark.style.left = `${(s.sheet * 100).toFixed(1)}%`;
    this.best.style.left = `${(s.best * 100).toFixed(1)}%`;
    this.best.hidden = s.best == null;
    this.speed.textContent = `${s.knots.toFixed(1)} knots`;
    this.keys.innerHTML = s.keys || '';
    this.draw(s);
  }

  draw(s) {
    const c = this.canvas, ctx = c.getContext('2d'), W = c.width, cx = W / 2, cy = W / 2, R = W * 0.42;
    ctx.clearRect(0, 0, W, W);
    // (Bow up: an angle off the bow, a on the right, is drawn clockwise from the top.)
    const at = (a, r) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
    ctx.lineWidth = 2;
    // The ring, and the no-go zone: forty degrees either side of the true wind.
    ctx.strokeStyle = 'rgba(255, 249, 239, 0.22)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 154, 130, 0.18)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, s.twa - Math.PI / 2 - 0.7, s.twa - Math.PI / 2 + 0.7); ctx.closePath(); ctx.fill();
    // The boat from above: bow up, and the boom to leeward.
    ctx.fillStyle = 'rgba(255, 249, 239, 0.9)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 46); ctx.quadraticCurveTo(cx + 22, cy - 6, cx + 15, cy + 40); ctx.lineTo(cx - 15, cy + 40); ctx.quadraticCurveTo(cx - 22, cy - 6, cx, cy - 46);
    ctx.fill();
    if (s.up) {
      const mast = [cx, cy - 18], b = s.side > 0 ? s.boom : -s.boom;
      ctx.strokeStyle = '#c4774a';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(...mast); ctx.lineTo(mast[0] + Math.sin(Math.PI + b) * 52, mast[1] - Math.cos(Math.PI + b) * 52); ctx.stroke();
    }
    // The wind: true (faint) and apparent (bold), arrows blowing in towards her.
    const arrow = (a, color, w, len) => {
      const [x0, y0] = at(a, R + 2), [x1, y1] = at(a, R - len);
      ctx.strokeStyle = ctx.fillStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      ctx.beginPath(); ctx.moveTo(x1 + ux * 10, y1 + uy * 10); ctx.lineTo(x1 - uy * 9, y1 + ux * 9); ctx.lineTo(x1 + uy * 9, y1 - ux * 9); ctx.closePath(); ctx.fill();
    };
    arrow(s.twa, 'rgba(147, 220, 205, 0.45)', 3, 34);
    arrow(s.awa, '#93dccd', 6, 46);
  }
}
