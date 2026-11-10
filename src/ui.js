const $ = (id) => document.getElementById(id);
export const kbd = (k) => `<kbd>${k}</kbd>`;

// How long a message stays up, at least, before another may replace it (s).
export const TOAST_LOOK = 2.5;

// Thin wrapper around the HUD elements in index.html. Only touches the DOM when something changes.

export class HUD {
  constructor() {
    this.toastQ = [];
    this.toastUp = null;
    this.toastWait = 0;
    // Keep quiet for now (the game says when: the title, a question on screen).
    this.quiet = () => false;
    this.el = {
      hud: $('hud'),
      hint: $('hint'),
      prompt: $('prompt'),
      prompt2: $('prompt2'),
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
      coach: $('fight-coach'),
      coachWord: $('fc-word'),
      coachSub: $('fc-sub'),
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
    // The clock grows with the weather, hunger and the offline note; when it would run into
    // the corner buttons, they drop their labels, then their keys, then close up.
    const clock = $('clock');
    const fit = () => this.fitCorner(clock);
    new ResizeObserver(fit).observe(clock);
    addEventListener('resize', fit);
  }

  fitCorner(clock) {
    const corner = $('corner');
    const room = corner.getBoundingClientRect().right - clock.getBoundingClientRect().right - 8;
    for (const fit of ['', 'keys', 'icons', 'tight']) {
      corner.dataset.fit = fit;
      if (corner.offsetWidth <= room) return;
    }
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

  // urgent: what the live hint says matters more just now than any message (a fish surging, the
  // line about to go, a fish at the net): it shows over the message.
  hint(html, now, urgent = false) {
    const text = now < this.flashUntil && !(urgent && html) ? this.flashText : html;
    this.setHTML('hint', this.el.hint, text);
    this.el.hint.classList.toggle('show', !!text);
  }

  prompt(html) {
    this.setHTML('prompt', this.el.prompt, html);
    this.el.prompt.hidden = !html;
  }

  // The mooring prompt beside it (anchor, tie up, cast off, let go a tow), on its own key.
  prompt2(html) {
    this.setHTML('prompt2', this.el.prompt2, html);
    this.el.prompt2.hidden = !html;
    document.body.classList.toggle('moor-prompt', !!html);
  }

  place(name, sub) {
    this.el.placeName.textContent = name;
    this.el.placeSub.textContent = sub;
    this.el.place.classList.add('show');
    clearTimeout(this.placeTimer);
    this.placeTimer = setTimeout(() => this.el.place.classList.remove('show'), 5200);
  }

  // A message at the top of the screen. Each waits its turn: none shows while the game says to
  // keep quiet (the title, or a question waiting for an answer: see quiet), and each one up gets a
  // fair look (TOAST_LOOK seconds, or all its time if that's shorter) before the next replaces it.
  // The same words twice just stay up longer. (A few at most wait; the oldest go first.)
  toast(text, secs = 4.5) {
    // (Time to read it: about fourteen characters a second, in the hand it's written in.)
    secs = Math.max(secs, Math.min(20, String(text).replace(/<[^>]+>/g, '').length / 14));
    const now = performance.now() / 1000, up = this.toastUp;
    if (up && up.text === text && now < up.until) {
      up.until = Math.max(up.until, now + secs);
      this.toastAt(up.until - now);
      return;
    }
    if (this.toastQ.some((q) => q.text === text)) return;
    if (this.quiet() || (up && now < Math.min(up.until, up.at + TOAST_LOOK))) {
      this.toastQ.push({ text, secs });
      if (this.toastQ.length > 6) this.toastQ.shift();
      this.toastLater();
      return;
    }
    this.toastShow(text, secs, now);
  }

  toastShow(text, secs, now) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastUp = { text, at: now, until: now + secs };
    this.toastAt(secs);
  }

  toastAt(secs) {
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.el.toast.classList.remove('show');
      this.toastUp = null;
      this.toastLater();
    }, secs * 1000);
  }

  // Tuck away the message that's up (a question is coming): it comes back, for the rest of its
  // time (a few seconds at least), once the question's answered.
  hush() {
    const up = this.toastUp;
    if (!up) return;
    clearTimeout(this.toastTimer);
    this.el.toast.classList.remove('show');
    this.toastUp = null;
    this.toastQ = this.toastQ.filter((q) => q.text !== up.text);
    this.toastQ.unshift({ text: up.text, secs: Math.max(3, up.until - performance.now() / 1000) });
    this.toastLater();
  }

  // The next waiting message, as soon as it may show.
  toastLater() {
    if (this.toastWait || !this.toastQ.length) return;
    const now = performance.now() / 1000, up = this.toastUp;
    const free = this.quiet() ? 0.5 : up ? Math.max(0.05, Math.min(up.until, up.at + TOAST_LOOK) - now) : 0.05;
    this.toastWait = setTimeout(() => {
      this.toastWait = 0;
      const t = performance.now() / 1000, u = this.toastUp;
      if (this.quiet() || (u && t < Math.min(u.until, u.at + TOAST_LOOK) - 0.01)) return this.toastLater();
      const q = this.toastQ.shift();
      if (q) this.toastShow(q.text, q.secs, t);
      this.toastLater();
    }, free * 1000);
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

  // The fight's word at the top of the screen, where the eye is while a fish is on: what to do
  // now, big (wind! pump! ease off!), and under it what the fish is doing. word '' hides it.
  // alert: the flick before a run and a surge; danger: the line near breaking.
  coach(word, sub = '', alert = false, danger = false) {
    const el = this.el.coach;
    if (!el) return;
    const key = `${word}|${sub}|${alert}|${danger}`;
    if (this.cache.coach === key) return;
    this.cache.coach = key;
    el.hidden = !word;
    document.body.classList.toggle('fighting', !!word);
    if (!word) return;
    this.el.coachWord.textContent = word;
    this.el.coachSub.textContent = sub;
    this.el.coachSub.hidden = !sub;
    el.classList.toggle('alert', alert);
    el.classList.toggle('danger', danger);
  }

  // drag: where the reel's drag gives line, as a fraction of the line's breaking strain (-1: none).
  // alert: the ring pulses (ease off now).
  // danger: the line is near its breaking strain (the tension ring flashes red).
  meter(visible, outer = 0, inner = -1, warm = 0, label = '', drag = -1, alert = false, danger = false) {
    this.el.meter.hidden = !visible;
    if (!visible) return;
    this.el.meter.classList.toggle('alert', alert);
    this.el.meter.classList.toggle('danger', danger);
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

  // The mark over the float (or the line) when there is something to do, with what to do.
  bite(x, y, show, text = '', fishOn = false) {
    this.el.bite.classList.toggle('show', show);
    this.el.bite.classList.toggle('fishon', fishOn);
    if (this.cache.biteText !== text) {
      this.cache.biteText = text;
      $('bite-text').textContent = text;
    }
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
    // (Only what's changed is written: each write has the browser work out the page's style again.)
    if (el.hidden) el.hidden = false;
    const tf = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%, -50%)`;
    if (el._tf !== tf) el.style.transform = el._tf = tf;
    el.classList.toggle('near', near);
    const arrow = el.firstElementChild;
    const at = onScreen ? 'rotate(180deg)' : `rotate(${angle.toFixed(2)}rad)`;
    if (arrow._tf !== at) arrow.style.transform = arrow._tf = at;
    // (A marker for somewhere far off, the crossing's, says how far in kilometres once it's that far;
    // a friend's, to the metre until then.)
    const d = el.dataset.km ? (dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${el.dataset.km === 'exact' ? Math.round(dist) : Math.round(dist / 10) * 10} m`) : String(Math.round(dist));
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
