// Game controllers (an Xbox controller, or any the browser reports in the standard layout),
// through the browser's Gamepad API. Nothing here plays the game itself: buttons press the same
// actions the keyboard does (see input.js), the left stick writes the same stick the touch
// controls do, and the right stick looks around like dragging the mouse. Which action a button
// presses depends on what you're doing (walking or rowing, a line in the water, a fish on, the
// catch card, photo mode, pitching a camp, driving, a menu), so the hints can name the button.
//
// In menus the D-pad (or the left stick) moves between buttons, A presses, B goes back, the
// bumpers change tabs, and the right stick scrolls. A controller is never needed: keyboard and
// mouse and touch carry on as ever, and whichever you used last is the one the hints show.

export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const NAMES = Object.keys(BTN);
export const GLYPH = {
  A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', VIEW: 'View', MENU: 'Menu',
  L3: 'L3', R3: 'R3', UP: 'D-pad ↑', DOWN: 'D-pad ↓', LEFT: 'D-pad ←', RIGHT: 'D-pad →',
};

// What each button does, by context. 'rodswap' is the other rod (the game says which); a
// button that isn't listed does nothing there.
const PLAY = {
  A: 'interact', B: 'cancel', X: 'anchor', Y: 'pack', LB: 'rodswap', RB: 'tackle', RT: 'cast', LT: 'rest',
  VIEW: 'map', MENU: 'settings', L3: 'jog', R3: 'reset', UP: 'journal', DOWN: 'finder', LEFT: 'view', RIGHT: 'photo',
};
export const MAPS = {
  play: PLAY,
  // Aiming, or a line in the water: the bumpers ask the field guide why nothing's biting and
  // throw loose bait instead of changing rods.
  fish: { ...PLAY, LB: 'advice', RB: 'feed', L3: null },
  // A fish on: RT reels, LT eases the drag off (the game reads the trigger), the left stick
  // sets the drag too.
  fight: { B: 'cancel', RT: 'cast', R3: 'reset', LEFT: 'view', VIEW: 'map', MENU: 'settings' },
  catch: { A: 'cast', X: 'keep', Y: 'photo', MENU: 'settings' },
  photo: { A: 'photo', RT: 'photo', B: 'cancel', R3: 'reset' },
  // Choosing where to pitch: walk with the stick, the bumpers turn it.
  place: { A: 'cast', RT: 'cast', B: 'cancel', LB: 'tackle', RB: 'interact', MENU: 'settings' },
  // At the wheel: RT accelerates and LT brakes (both read as triggers by the game), the left
  // stick steers (and pulled back, reverses).
  drive: { A: 'interact', B: 'cancel', X: 'tackle', Y: 'pack', VIEW: 'map', MENU: 'settings', R3: 'reset', LEFT: 'view', UP: 'journal' },
  // The title screen: A presses the focused button, Menu opens Settings.
  title: { MENU: 'settings' },
  menu: {}, // (moving between buttons: see menu())
  off: {},  // asleep, travelling: nothing
};
// The sticks and triggers, for hints.
const AXES = { forward: 'L-stick', back: 'L-stick', left: 'L-stick', right: 'L-stick', look: 'R-stick', throttle: 'RT', brake: 'LT', ease: 'LT' };

// A round dead zone that eases out from its edge (no drift at rest, no jump past it).
export function deadzone(x, y, dead = 0.2) {
  const m = Math.hypot(x, y);
  if (m < dead) return { x: 0, y: 0 };
  const k = Math.min(1, (m - dead) / (1 - dead)) / m;
  return { x: x * k, y: y * k };
}
const trigger = (b) => (b ? (typeof b.value === 'number' ? b.value : b.pressed ? 1 : 0) : 0);

// The button an action is on in a context ('' if none there). 'rod1'/'rod2' are the swap.
export function buttonFor(ctx, action) {
  if (AXES[action]) return AXES[action];
  const find = (map) => NAMES.find((k) => map[k] === action || (map[k] === 'rodswap' && (action === 'rod1' || action === 'rod2')));
  // (Not on a button just here: where it is when you're walking about, or fishing.)
  const n = find(MAPS[ctx] || PLAY) || find(PLAY) || find(MAPS.fish) || find(MAPS.catch);
  return n ? GLYPH[n] : '';
}

export class Gamepads {
  // hooks: { context() → a name in MAPS, resolve('rodswap') → 'rod1' or 'rod2',
  //          connected(id, standard), disconnected(), focusRoot() → the title screen }
  constructor(input, hooks) {
    this.input = input;
    this.h = hooks;
    this.index = null;      // the controller in use
    this.standard = true;
    this.was = [];          // which buttons were down last time
    this.held = new Map();  // button → the action it pressed (to release the same one)
    this.lt = 0;
    this.rt = 0;
    this.nav = { dir: null, t: 0 };
    this.ctx = 'play';
    this.fresh = true;      // (a menu just opened: put the focus somewhere you can see)
    this.jog = false;       // L3 toggles jogging, until you stop
    this.still = 0;
    addEventListener('gamepadconnected', (e) => this.connect(e.gamepad));
    addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index !== this.index) return;
      this.releaseAll();
      this.index = null;
      this.lt = this.rt = 0;
      this.h.disconnected?.();
    });
  }

  // A controller is plugged in, and it's what you're playing with now.
  get active() { return this.index !== null && this.input.method === 'pad'; }

  connect(gp) {
    if (!gp || this.index !== null) return;
    this.index = gp.index;
    this.standard = gp.mapping === 'standard';
    // (Whatever is held as it connects doesn't count until it's let go.)
    this.was = NAMES.map((n, i) => !!gp.buttons[i]?.pressed);
    this.h.connected?.(gp.id, this.standard);
  }

  pad() {
    let list = [];
    try { list = navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch { return null; }
    if (this.index === null) {
      // A controller already plugged in when the page loaded only shows up once you press
      // something on it (browsers keep controllers hidden until then).
      const gp = list.find((g) => g && g.connected !== false && g.buttons.some((b) => b.pressed));
      if (gp) {
        this.connect(gp);
        this.was = NAMES.map(() => false);
      }
    }
    const gp = this.index !== null ? list[this.index] : null;
    return gp && gp.connected !== false ? gp : null;
  }

  // The button for an action right now (in a menu: where it is when you're playing).
  label(action) {
    const c = this.h.context();
    return buttonFor(c === 'menu' || c === 'title' || c === 'off' ? 'play' : c, action);
  }

  // Once a frame: read the controller, press and release actions, feed the sticks.
  poll(dt) {
    const gp = this.pad();
    if (!gp) return;
    const b = gp.buttons, ax = gp.axes;
    const ctx = this.h.context();
    if (ctx !== this.ctx) {
      // Changing what you're doing lets go of whatever was held for the old one, unless the
      // button does the same here (RT held from aiming the cast on into reeling a fish in).
      const map = MAPS[ctx] || PLAY;
      for (const [i, action] of [...this.held]) {
        const raw = map[NAMES[i]];
        if ((raw === 'rodswap' ? this.h.resolve?.('rodswap') : raw) === action) continue;
        this.release(action);
        this.held.delete(i);
      }
      if (ctx === 'menu' || ctx === 'title' || ctx === 'off') this.input.virtual.throttle = this.input.virtual.steer = 0;
      this.ctx = ctx;
      this.fresh = true;
    }
    const L = deadzone(ax[0] || 0, ax[1] || 0), R = deadzone(ax[2] || 0, ax[3] || 0, 0.18);
    this.lt = trigger(b[BTN.LT]);
    this.rt = trigger(b[BTN.RT]);
    if (this.lt < 0.06) this.lt = 0;
    if (this.rt < 0.06) this.rt = 0;
    const pressed = NAMES.map((n, i) => (i === BTN.LT || i === BTN.RT ? trigger(b[i]) > 0.35 : !!b[i]?.pressed));
    const any = pressed.some(Boolean) || L.x || L.y || R.x || R.y;
    if (any && this.input.method !== 'pad') {
      this.input.use('pad');
      this.fresh = true;
    }
    if (this.input.method !== 'pad') {
      this.was = pressed;
      return;
    }
    if (ctx === 'menu' || ctx === 'title') this.menu(pressed, L, R, dt);
    if (ctx !== 'menu' && ctx !== 'off') {
      const map = MAPS[ctx] || PLAY;
      NAMES.forEach((n, i) => {
        if (pressed[i] === !!this.was[i]) return;
        if (pressed[i] && map[n] === 'jog') {
          this.jog = !this.jog;
          return;
        }
        if (pressed[i]) {
          const raw = map[n];
          const action = raw === 'rodswap' ? this.h.resolve?.('rodswap') : raw;
          if (!action) return;
          this.held.set(i, action);
          this.press(action);
        } else if (this.held.has(i)) {
          this.release(this.held.get(i));
          this.held.delete(i);
        }
      });
      // (Standing still for a moment ends a jog.)
      this.still = L.x || L.y ? 0 : this.still + dt;
      if (this.still > 0.6) this.jog = false;
      if (ctx !== 'title') {
        // The left stick is the same stick the touch controls write; the right one looks round.
        this.input.virtual.throttle = -L.y;
        this.input.virtual.steer = -L.x;
        this.input.drag.dx += R.x * 520 * dt;
        this.input.drag.dy += R.y * 380 * dt;
        // In photo mode the D-pad zooms the lens.
        if (ctx === 'photo') this.input.wheel += ((pressed[BTN.DOWN] ? 1 : 0) - (pressed[BTN.UP] ? 1 : 0)) * 900 * dt;
      }
    }
    this.was = pressed;
  }

  press(action) {
    // (Cancel is Escape to the game, wherever it comes from.)
    const code = action === 'cancel' ? 'Escape' : `Pad:${action}`;
    this.input.codes.add(`Pad:${action}`);
    this.input.emit('press', code, [action]);
  }

  release(action) {
    const code = action === 'cancel' ? 'Escape' : `Pad:${action}`;
    if (!this.input.codes.delete(`Pad:${action}`)) return;
    this.input.emit('release', code, [action]);
  }

  releaseAll() {
    for (const a of this.held.values()) this.release(a);
    this.held.clear();
    this.input.virtual.throttle = 0;
    this.input.virtual.steer = 0;
  }

  // A short buzz (a bite, a run), where the controller can; nothing depends on it.
  rumble(strength = 0.4, ms = 120) {
    if (!this.active) return;
    const gp = this.pad();
    try {
      gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 })?.catch?.(() => {});
    } catch { /* not on this controller */ }
  }

  /* ---------------- menus ---------------- */

  menu(pressed, L, R, dt) {
    const root = this.ctx === 'title' ? this.h.focusRoot?.() : topDialog();
    const edge = (n) => pressed[BTN[n]] && !this.was[BTN[n]];
    if (!root) {
      if (edge('B')) this.input.emit('press', 'Escape', ['cancel']);
      return;
    }
    const inside = () => { const a = document.activeElement; return a && a !== root && root.contains(a); };
    // (A panel opening over another one counts as just opened.)
    if (root !== this.root) {
      this.root = root;
      this.fresh = true;
      this.last = null;
    }
    if (this.fresh) {
      this.fresh = false;
      if (!inside()) firstFocus(root)?.focus();
    }
    // A button that redrew itself as you pressed it (a tab, a step): back onto the new one.
    if (inside()) this.last = document.activeElement.textContent.trim();
    else if (this.last) {
      const again = focusables(root).find((el) => el.textContent.trim() === this.last);
      (again || firstFocus(root))?.focus();
    }
    // Directions: the D-pad, or the left stick pushed well over (repeating while held).
    let dir = pressed[BTN.UP] ? 'up' : pressed[BTN.DOWN] ? 'down' : pressed[BTN.LEFT] ? 'left' : pressed[BTN.RIGHT] ? 'right' : null;
    if (!dir && Math.hypot(L.x, L.y) > 0.6) dir = Math.abs(L.x) > Math.abs(L.y) ? (L.x > 0 ? 'right' : 'left') : (L.y > 0 ? 'down' : 'up');
    if (dir !== this.nav.dir) {
      this.nav = { dir, t: 0.4 };
      if (dir) move(root, dir);
    } else if (dir) {
      this.nav.t -= dt;
      if (this.nav.t <= 0) {
        this.nav.t = 0.12;
        move(root, dir);
      }
    }
    if (edge('A')) {
      const first = firstFocus(root);
      if (inside()) document.activeElement.click();
      else if (first) first.focus();
      // (A card with nothing to choose, like a discovery: A carries on, as Enter does.)
      else this.input.emit('press', 'Enter', []);
    }
    if (this.ctx === 'title') return;
    if (edge('B')) this.input.emit('press', 'Escape', ['cancel']);
    if (edge('LB') || edge('RB')) tabs(root, edge('RB') ? 1 : -1);
    // The buttons that open the map and Settings close them again.
    if (edge('VIEW')) this.input.emit('press', 'Pad:map', ['map']);
    if (edge('MENU')) this.input.emit('press', 'Pad:settings', ['settings']);
    // The right stick scrolls whatever you're in.
    if (R.y) {
      const s = scroller(document.activeElement, root);
      if (s) s.scrollTop += R.y * 900 * dt;
    }
  }
}

/* ---------------- finding your way round a panel ---------------- */

const visible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

// The panel on top: a confirmation over everything, then a photograph waiting to be kept,
// then whichever other panel is open.
export function topDialog() {
  const all = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter((d) => !d.hidden && !d.closest('[hidden]') && visible(d));
  if (!all.length) return null;
  return all.find((d) => d.id === 'confirm') || all.find((d) => d.id === 'photo-card') || all.find((d) => d.id === 'mem-viewer') || all[all.length - 1];
}

export function focusables(root) {
  return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]')]
    .filter((el) => el.tabIndex >= 0 && !el.disabled && !el.closest('[hidden]') && visible(el));
}

// Where the focus starts in a panel: its first button (not a text box: there's no typing here).
export function firstFocus(root) {
  const all = focusables(root);
  return all.find((el) => !el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea')) || all[0];
}

// Move focus the way you pushed: the panel's own arrow keys first (the backpack's grid, its
// tabs), then a range or a list nudged along, then the nearest button in that direction.
function move(root, dir) {
  const a = document.activeElement;
  if (!a || a === root || !root.contains(a)) {
    firstFocus(root)?.focus();
    return;
  }
  const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir];
  const ev = new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true });
  ev.fromPad = true; // (so the game itself doesn't take it for the keyboard: see input.js)
  a.dispatchEvent(ev);
  if (ev.defaultPrevented || document.activeElement !== a) return;
  const step = dir === 'right' ? 1 : dir === 'left' ? -1 : 0;
  if (step && a instanceof HTMLSelectElement && a.options.length) {
    a.selectedIndex = Math.max(0, Math.min(a.options.length - 1, a.selectedIndex + step));
    a.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (step && a instanceof HTMLInputElement && a.type === 'range') {
    if (step > 0) a.stepUp(); else a.stepDown();
    a.dispatchEvent(new Event('input', { bubbles: true }));
    a.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  const r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const vx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0, vy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  let best = null, score = Infinity;
  for (const el of focusables(root)) {
    if (el === a) continue;
    const q = el.getBoundingClientRect();
    const dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
    const along = dx * vx + dy * vy;
    if (along <= 4) continue;
    // (Overlapping rows or columns count as straight ahead; anything well off to the side
    // isn't that way at all, so pushing right at the end of a row stays put.)
    const across = vx ? Math.max(0, Math.abs(dy) - (r.height + q.height) / 2) : Math.max(0, Math.abs(dx) - (r.width + q.width) / 2);
    if (across > along) continue;
    // (Anything in line beats anything off the line, however near.)
    const s = (across > 0 ? 1e5 : 0) + along + across * 3;
    if (s < score) { score = s; best = el; }
  }
  if (best) {
    best.focus();
    best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
}

// The tabs along the top of a panel: the next or previous one.
function tabs(root, step) {
  const list = [...root.querySelectorAll('.wb-step, .j-tabs button, [data-tab]:not([data-tab="tackle"]), [role="tab"]')]
    .filter((el) => !el.disabled && !el.hidden && visible(el));
  if (list.length < 2) return;
  const cur = list.findIndex((el) => el.classList.contains('on') || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-current') === 'step');
  const next = list[(Math.max(0, cur) + step + list.length) % list.length];
  next.click();
  next.focus?.();
}

function scroller(from, root) {
  const scrolls = (el) => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY);
  for (let el = from; el && el !== document.body; el = el.parentElement) {
    if (scrolls(el)) return el;
    if (el === root) break;
  }
  return [root, ...root.querySelectorAll('*')].find(scrolls) || null;
}
