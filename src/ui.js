const $ = (id) => document.getElementById(id);
export const kbd = (k) => `<kbd>${k}</kbd>`;

// Thin wrapper around the HUD elements in index.html. Only touches the DOM when something changes.
export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      hint: $('hint'),
      prompt: $('prompt'),
      place: $('place'),
      placeName: $('place-name'),
      placeSub: $('place-sub'),
      toast: $('toast'),
      clockTime: $('clock-time'),
      clockPhase: $('clock-phase'),
      clockWeather: $('clock-weather'),
      clockDot: $('clock-dot'),
      meter: $('meter'),
      meterOuter: $('m-outer'),
      meterInner: $('m-inner'),
      meterLabel: $('meter-label'),
      bite: $('bite-mark'),
      journalBtn: $('journal-btn'),
      veil: $('rest-veil'),
      act: $('act-btn'),
      actLabel: $('act-label'),
      bait: $('bait'),
      baitDepth: $('bait-depth'),
      baitBottom: $('bait-bottom'),
      baitStatus: $('bait-status'),
      baitMark: $('bait-mark'),
      chip: $('view-chip'),
      gear: $('gear'),
      gearRod: $('gear-rod'),
      gearItem: $('gear-item'),
      food: $('clock-food'),
      sleep: $('sleep-veil'),
      sleepText: $('sleep-text'),
    };
    this.chipTimer = 0;
    this.cache = {};
    this.flashText = '';
    this.flashUntil = 0;
    this.placeTimer = 0;
    this.toastTimer = 0;
  }

  setHTML(key, el, html) {
    if (this.cache[key] === html) return;
    this.cache[key] = html;
    el.innerHTML = html;
  }

  flash(html, now, secs = 3.2) {
    this.flashText = html;
    this.flashUntil = now + secs;
  }

  hint(html, now) {
    const text = now < this.flashUntil ? this.flashText : html;
    this.setHTML('hint', this.el.hint, text);
    this.el.hint.classList.toggle('show', !!text);
  }

  prompt(html) {
    this.setHTML('prompt', this.el.prompt, html);
    this.el.prompt.hidden = !html;
  }

  place(name, sub) {
    this.el.placeName.textContent = name;
    this.el.placeSub.textContent = sub;
    this.el.place.classList.add('show');
    clearTimeout(this.placeTimer);
    this.placeTimer = setTimeout(() => this.el.place.classList.remove('show'), 5200);
  }

  toast(text, secs = 4.5) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), secs * 1000);
  }

  clock(time, phase, weather, night) {
    if (this.cache.clock === time + phase + weather + night) return;
    this.cache.clock = time + phase + weather + night;
    this.el.clockTime.textContent = time;
    this.el.clockPhase.textContent = phase;
    this.el.clockWeather.textContent = weather;
    this.el.clockWeather.hidden = !weather;
    this.el.clockDot.classList.toggle('moon', night);
  }

  // drag: where the reel's drag gives line, as a fraction of the line's breaking strain (-1: none).
  meter(visible, outer = 0, inner = -1, warm = 0, label = '', drag = -1) {
    this.el.meter.hidden = !visible;
    if (!visible) return;
    const dm = document.getElementById('m-drag');
    dm.style.display = drag < 0 ? 'none' : '';
    if (drag >= 0) {
      const a = Math.min(drag, 1) * Math.PI * 2;
      dm.setAttribute('cx', (60 + 40 * Math.cos(a)).toFixed(1));
      dm.setAttribute('cy', (60 + 40 * Math.sin(a)).toFixed(1));
      dm.classList.toggle('locked', drag >= 1);
    }
    const C1 = 314.16, C2 = 251.33;
    this.el.meterOuter.style.strokeDashoffset = String(C1 * (1 - outer));
    this.el.meterInner.style.display = inner < 0 ? 'none' : '';
    if (inner >= 0) {
      this.el.meterInner.style.strokeDashoffset = String(C2 * (1 - inner));
      this.el.meterInner.style.stroke = warm > 0.75 ? 'var(--coral)' : warm > 0.45 ? 'var(--lantern)' : 'var(--seaglass)';
    }
    this.setHTML('meterLabel', this.el.meterLabel, label);
  }

  bite(x, y, show) {
    this.el.bite.classList.toggle('show', show);
    if (show) this.el.bite.style.transform = `translate(${x}px, ${y}px)`;
  }

  // The bait panel only appears while the bait is in the water: how deep it hangs,
  // how deep the water is, and what (if anything) is paying attention to it.
  bait(info) {
    const el = this.el;
    el.bait.hidden = !info;
    if (!info) return;
    this.setHTML('baitDepth', el.baitDepth, `${info.depth.toFixed(1)} m`);
    this.setHTML('baitBottom', el.baitBottom, `${info.bottom.toFixed(1)} m`);
    this.setHTML('baitStatus', el.baitStatus, info.text);
    el.bait.dataset.status = info.status;
    const k = Math.min(info.depth / Math.max(info.bottom, 0.5), 1);
    el.baitMark.style.top = `${(k * 100).toFixed(1)}%`;
  }

  // A short-lived note about the current view and its controls.
  chip(html, secs = 4.5) {
    this.el.chip.innerHTML = html;
    this.el.chip.classList.add('show');
    clearTimeout(this.chipTimer);
    this.chipTimer = setTimeout(() => this.el.chip.classList.remove('show'), secs * 1000);
  }

  // The round touch button changes its word with the moment: Cast, Hook!, Reel, Let go…
  action(label, urgent) {
    this.setHTML('act', this.el.actLabel, label);
    this.el.act.classList.toggle('urgent', urgent);
    this.el.act.classList.toggle('quiet', !label);
  }

  // The rod in hand and what's tied on.
  gear(rod, item) {
    this.setHTML('gearRod', this.el.gearRod, rod.short);
    this.setHTML('gearItem', this.el.gearItem, item ? item.short : 'nothing tied on');
    const b = this.el.gear;
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
  }

  food(text, cls) {
    if (this.cache.food === text + cls) return;
    this.cache.food = text + cls;
    this.el.food.textContent = text;
    this.el.food.hidden = !text;
    this.el.food.className = `soft ${cls || ''}`;
  }

  // A label that follows a point in the world, or sits on the screen edge pointing at it.
  marker(el, sx, sy, onScreen, angle, dist, near) {
    if (!el._label) el._label = el.querySelector('b');
    el.hidden = false;
    el.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%, -50%)`;
    el.classList.toggle('near', near);
    const arrow = el.firstElementChild;
    arrow.style.transform = onScreen ? 'rotate(180deg)' : `rotate(${angle.toFixed(2)}rad)`;
    const d = String(Math.round(dist));
    if (el._label.textContent !== d) el._label.textContent = d;
  }

  sleep(on, text) {
    if (text) this.el.sleepText.textContent = text;
    this.el.sleep.classList.toggle('show', on);
  }

  rest(on) {
    this.el.veil.classList.toggle('show', on);
  }

  hidden(off) {
    this.el.hud.classList.toggle('off', off);
  }

  pulseJournal() {
    const b = this.el.journalBtn;
    b.classList.remove('pulse');
    void b.offsetWidth;
    b.classList.add('pulse');
  }
}
