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

  meter(visible, outer = 0, inner = -1, warm = 0, label = '') {
    this.el.meter.hidden = !visible;
    if (!visible) return;
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
