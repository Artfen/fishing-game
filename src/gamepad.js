// Game controllers (an Xbox, PlayStation or Nintendo controller, or any the browser reports in the
// standard layout; any other once its buttons are set up in Settings), through the browser's
// Gamepad API. Nothing here plays the game itself: buttons press the same
// actions the keyboard does (see input.js), the left stick writes the same stick the touch
// controls do, and the right stick looks around like dragging the mouse. Which action a button
// presses depends on what you're doing (walking or rowing, a line in the water, a fish on, the
// catch card, photo mode, pitching a camp, driving, a menu), so the hints can name the button.
//
// In menus the D-pad (or the left stick) moves between buttons, A presses, B goes back, the
// bumpers change tabs, and the right stick scrolls. A controller is never needed: keyboard and
// mouse and touch carry on as ever, and whichever you used last is the one the hints show.
//
// The buttons are known by where they are (the standard layout's): A is the bottom face button
// whatever is printed on it. The hints name them as they're printed on the controller in your
// hands (PAD_NAMES: ✕ on a PlayStation controller, B on a Nintendo one).

import { $t } from './i18n.js';
import { isTextBox } from './osk.js';
export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const NAMES = Object.keys(BTN);
export const GLYPH = {
  A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', VIEW: 'View', MENU: 'Menu',
  L3: 'L3', R3: 'R3', UP: 'D-pad ↑', DOWN: 'D-pad ↓', LEFT: 'D-pad ←', RIGHT: 'D-pad →',
};

// The names printed on each kind of controller, button by button (by where it is: A is the bottom
// face button). The game's own names for them are an Xbox controller's (GLYPH).
const DPAD = { UP: 'D-pad ↑', DOWN: 'D-pad ↓', LEFT: 'D-pad ←', RIGHT: 'D-pad →' };
export const PAD_NAMES = {
  xbox: GLYPH,
  playstation: { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', VIEW: 'Create', MENU: 'Options', L3: 'L3', R3: 'R3', ...DPAD },
  // (The PS4's DualShock: its Share button where the PS5's Create is.)
  ps4: { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', VIEW: 'Share', MENU: 'Options', L3: 'L3', R3: 'R3', ...DPAD },
  // (A Nintendo controller has A and B, X and Y the other way round: its B is at the bottom.)
  nintendo: { A: 'B', B: 'A', X: 'Y', Y: 'X', LB: 'L', RB: 'R', LT: 'ZL', RT: 'ZR', VIEW: '−', MENU: '+', L3: 'L3', R3: 'R3', ...DPAD },
};
export const PAD_STYLES = ['auto', 'xbox', 'playstation', 'nintendo'];

// What kind of controller it is, from the name the browser gives it (its maker's USB id among it:
// 054c Sony, 057e Nintendo). Anything else is named as an Xbox controller, as most are laid out.
export function familyOf(id = '') {
  const s = String(id).toLowerCase();
  if (/054c|dualsense|dualshock|playstation|\bps[345]\b/.test(s) || (/^wireless controller/.test(s))) return /05c4|09cc|0ba0|dualshock|\bps4\b/.test(s) ? 'ps4' : 'playstation';
  if (/057e|nintendo|switch|joy-con|pro controller/.test(s)) return 'nintendo';
  return 'xbox';
}
// The names to show: the controller's own (auto), or the kind chosen in Settings.
export function styleFor(setting, family) {
  if (setting === 'playstation') return family === 'ps4' ? 'ps4' : 'playstation';
  return PAD_NAMES[setting] ? setting : PAD_NAMES[family] ? family : 'xbox';
}
let style = 'xbox';
export function setPadStyle(s) { style = PAD_NAMES[s] ? s : 'xbox'; }
export const padStyle = () => style;
// A button's name (as the game calls it, an Xbox controller's: 'LT', 'A', 'D-pad →'), as it's
// printed on the controller in use. Anything else (the sticks) as it is.
const BY_GLYPH = Object.fromEntries(Object.entries(GLYPH).map(([k, v]) => [v, k]));
export function padName(n) {
  const k = BY_GLYPH[n];
  return k ? PAD_NAMES[style][k] : n;
}

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
  fish: { ...PLAY, LB: 'advice', RB: 'feed', L3: 'walkline' },
  // At the helm of a motorboat (or in the kayak): the left stick moves the throttle lever (a
  // notch at a time, or smoothly) and steers, B knocks it into neutral, L3 starts or stops the
  // engine (or lowers or raises the kayak's motor).
  helm: { ...PLAY, B: 'neutral', L3: 'motor' },
  // At the helm of a boat with a powered outboard: the bumpers trim the leg in and out (held), and
  // L3 starts or stops the engine (or opens the helm panel, on the full procedure).
  helmtrim: { ...PLAY, B: 'neutral', L3: 'motor', LB: 'trimDown', RB: 'trimUp' },
  // At the helm of twin engines (the centre console, the yacht): D-pad → picks the lever the
  // stick works (both, the port one, the starboard one), for one ahead and one astern.
  helmtwin: { ...PLAY, B: 'neutral', L3: 'motor', LB: 'trimDown', RB: 'trimUp', RIGHT: 'levers' },
  // At the trawler's helm: the bumpers push her bow thruster to port and starboard, and D-pad →
  // is her autopilot.
  helmpilot: { ...PLAY, B: 'neutral', L3: 'motor', LB: 'trimDown', RB: 'trimUp', RIGHT: 'spotlock' },
  // A line out from a boat under power: the D-pad moves the throttle a notch (the stick is for
  // the lure).
  troll: { ...PLAY, LB: 'advice', RB: 'feed', L3: 'walkline', UP: 'throttleUp', DOWN: 'throttleDown' },
  // Looking down at the dashboard (see dashcontrol.js): the D-pad moves the ring round it, A works
  // what's ringed (held, for the key, the trim and the horn), B (or L3 again) looks up; the stick
  // still steers and works the throttle, and the bumpers still trim.
  dash: { A: 'dashPress', B: 'cancel', L3: 'motor', LB: 'trimDown', RB: 'trimUp', UP: 'dashUp', DOWN: 'dashDown', LEFT: 'dashLeft', RIGHT: 'dashRight', VIEW: 'map', MENU: 'settings' },
  // A fish on: RT reels, LT eases the drag off (the game reads the trigger), the left stick
  // sets the drag too; A follows a running fish with the boat.
  fight: { A: 'interact', B: 'cancel', RT: 'cast', R3: 'reset', LEFT: 'view', VIEW: 'map', MENU: 'settings' },
  // (RB looks closer at it: see inspect.js; there the right stick turns it over, B goes back.)
  // (LB: into the bait bucket, a fish small enough for bait.)
  catch: { A: 'cast', X: 'keep', Y: 'photo', RB: 'interact', LB: 'tackle', MENU: 'settings' },
  inspect: { B: 'cancel', A: 'interact', RB: 'interact' },
  // (Crouched over a rockpool: A turns a stone, X sweeps the net, Y photographs, LB keeps a
  // netted prawn for bait, B leaves.)
  pool: { A: 'interact', X: 'cast', Y: 'photo', LB: 'tackle', B: 'cancel' },
  // (Y raises the binoculars from photo mode; in them, Y or B lowers them again.)
  photo: { A: 'photo', RT: 'photo', B: 'cancel', R3: 'reset', Y: 'binoculars' },
  binocs: { B: 'cancel', Y: 'binoculars', A: 'binoculars', R3: 'reset' },
  // Choosing where to pitch: walk with the stick, the bumpers turn it.
  place: { A: 'cast', RT: 'cast', B: 'cancel', LB: 'tackle', RB: 'interact', MENU: 'settings' },
  // At the wheel: RT accelerates and LT brakes (both read as triggers by the game), the left
  // stick steers (and pulled back, reverses).
  drive: { A: 'interact', B: 'cancel', X: 'tackle', Y: 'pack', VIEW: 'map', MENU: 'settings', R3: 'reset', LEFT: 'view', UP: 'journal' },
  // In the water: the left stick swims where you look, A and RB swim up (and at the surface,
  // A climbs out), LB swims down, RT fires the speargun or takes a photograph, L3 kicks hard.
  dive: { A: 'interact', RB: 'interact', LB: 'tackle', RT: 'cast', B: 'cancel', L3: 'jog', R3: 'reset', LEFT: 'view', RIGHT: 'photo', VIEW: 'map', MENU: 'settings', UP: 'journal' },
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

/* ---------------- a controller the browser doesn't know ---------------- */

// A controller the browser reports in a layout of its own (not 'standard': a DualSense in some
// browsers, an older or unusual pad): which of its buttons and axes is which, learned in Settings
// (Set up the buttons: press each as it's asked for), and kept for it by its name. Each button's
// source is ['b', i] (its button i), ['a', i, sign, rest] (its axis i pushed that way from where it
// rests: a trigger, or anything reported as an axis), or ['h', i, dir] (a hat switch on axis i, the
// way many report a D-pad: one axis, eight directions). A stick's is ['a', i, sign].
export const LEARN = [
  ['A', $t('Press {}, the bottom face button')], ['B', $t('Press {}, the right face button')], ['X', $t('Press {}, the left face button')], ['Y', $t('Press {}, the top face button')],
  ['UP', $t('Press up on the D-pad')], ['DOWN', $t('Press down on the D-pad')], ['LEFT', $t('Press left on the D-pad')], ['RIGHT', $t('Press right on the D-pad')],
  ['LB', $t('Press {}, the left bumper')], ['RB', $t('Press {}, the right bumper')], ['LT', $t('Press {}, the left trigger')], ['RT', $t('Press {}, the right trigger')],
  ['VIEW', $t('Press {}, the small button left of the middle')], ['MENU', $t('Press {}, the small button right of the middle')],
  ['L3', $t('Press the left stick in ({})')], ['R3', $t('Press the right stick in ({})')],
  ['LX', $t('Push the left stick right')], ['LY', $t('Push the left stick up')], ['RX', $t('Push the right stick right')], ['RY', $t('Push the right stick up')],
];
const STICKS = ['LX', 'LY', 'RX', 'RY'];
// (The words for a step, with the button's name as printed on the controller.)
export const learnWords = (i) => (LEARN[i] ? LEARN[i][1].replace('{}', padName(GLYPH[LEARN[i][0]] || '')) : '');

// A hat switch's reading: -1 up, then round clockwise in steps of 2/7 to 1 (up and left); at rest,
// outside that (about 1.29). Its direction, 0 to 7 (0 up, 2 right, 4 down, 6 left), or -1.
export function hatDir(v) {
  if (typeof v !== 'number' || !(Math.abs(v) <= 1.05)) return -1;
  return Math.round(((v + 1) * 7) / 2) & 7;
}

const isSrc = (s) => Array.isArray(s) && Number.isInteger(s[1]) && s[1] >= 0 && s[1] < 64 && (
  s[0] === 'b' ? s.length === 2
    : s[0] === 'h' ? s.length === 3 && Number.isInteger(s[2]) && s[2] >= 0 && s[2] < 8
      : s[0] === 'a' && (s[2] === 1 || s[2] === -1) && (s.length === 3 || (s.length === 4 && [-1, 0, 1].includes(s[3]))));
// A learned layout as kept in the settings, checked (anything odd left out; nothing usable: null).
export function cleanLayout(L) {
  if (!L || typeof L !== 'object') return null;
  const buttons = {}, sticks = {};
  for (const n of NAMES) if (isSrc(L.buttons?.[n])) buttons[n] = L.buttons[n].slice();
  for (const n of STICKS) if (isSrc(L.sticks?.[n]) && L.sticks[n][0] === 'a') sticks[n] = L.sticks[n].slice(0, 3);
  return Object.keys(buttons).length || Object.keys(sticks).length ? { buttons, sticks } : null;
}

// How far one source is pressed, 0 to 1.
function sourceValue(gp, s) {
  if (!s) return 0;
  if (s[0] === 'b') return trigger(gp.buttons[s[1]]);
  const v = gp.axes[s[1]];
  if (typeof v !== 'number') return 0;
  if (s[0] === 'h') {
    const d = hatDir(v);
    // (Its own direction, or either side of it: up counts with up-and-left and up-and-right.)
    return d >= 0 && Math.min((d - s[2] + 8) % 8, (s[2] - d + 8) % 8) <= 1 ? 1 : 0;
  }
  const rest = s[3] || 0;
  return Math.max(0, Math.min(1, (s[2] * (v - rest)) / (1 + Math.abs(rest))));
}

// A controller's state read as the standard layout: its buttons ({ pressed, value } each, in
// BTN's order) and its four stick axes. family: a PlayStation controller's touchpad, pressed,
// counts as its Create (Share) button: the map, as in its own games.
export function readPad(gp, layout = null, family = 'xbox') {
  if (!layout) {
    const sony = family === 'playstation' || family === 'ps4';
    if (sony && gp.buttons[17]?.pressed && !gp.buttons[BTN.VIEW]?.pressed) {
      const b = [...gp.buttons];
      b[BTN.VIEW] = gp.buttons[17];
      return { b, ax: gp.axes };
    }
    return { b: gp.buttons, ax: gp.axes };
  }
  const b = NAMES.map((n) => {
    const v = sourceValue(gp, layout.buttons[n]);
    return { pressed: v > 0.5, value: v };
  });
  const ax = STICKS.map((n) => {
    const s = layout.sticks[n], v = s ? gp.axes[s[1]] : 0;
    return typeof v === 'number' ? v * (s ? s[2] : 0) : 0;
  });
  return { b, ax };
}

// The button an action is on in a context ('' if none there). 'rod1'/'rod2' are the swap.
export function buttonFor(ctx, action) {
  if (AXES[action]) return padName(AXES[action]);
  const find = (map) => NAMES.find((k) => map[k] === action || (map[k] === 'rodswap' && (action === 'rod1' || action === 'rod2')));
  // (Not on a button just here: where it is when you're walking about, or fishing.)
  const n = find(MAPS[ctx] || PLAY) || find(PLAY) || find(MAPS.fish) || find(MAPS.catch);
  return n ? padName(GLYPH[n]) : '';
}

export class Gamepads {
  // hooks: { context() → a name in MAPS, resolve('rodswap') → 'rod1' or 'rod2',
  //          connected(id, standard), disconnected(), focusRoot() → the title screen }
  constructor(input, hooks) {
    this.input = input;
    this.h = hooks;
    this.index = null;      // the controller in use
    this.id = '';           // (its name, as the browser gives it)
    this.family = 'xbox';   // what kind it is (see familyOf)
    this.layout = null;     // its buttons learned in Settings, if the browser doesn't know them
    this.learning = null;   // (setting up its buttons: see learn)
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
    this.id = gp.id || '';
    this.family = familyOf(this.id);
    this.layout = cleanLayout(this.h.layoutFor?.(this.id));
    this.standard = gp.mapping === 'standard';
    // (Whatever is held as it connects doesn't count until it's let go.)
    const { b } = readPad(gp, this.layout, this.family);
    this.was = NAMES.map((n, i) => !!b[i]?.pressed);
    this.h.connected?.(this.id, this.standard, this.family);
  }

  // Setting up its buttons (Settings): each asked for in turn (LEARN), the first button pressed or
  // axis pushed well over taken for it, and let go of before the next. Nothing in the game is
  // pressed meanwhile. onStep(i, layout): the step it's on now; at the end, the layout learned.
  learn(onStep) {
    this.releaseAll();
    this.learning = { i: 0, rest: null, wait: true, got: { buttons: {}, sticks: {} }, onStep };
  }

  stopLearning() {
    this.learning = null;
  }

  // (Not this one: on to the next.)
  skipLearning() {
    const S = this.learning;
    if (!S) return;
    S.i++;
    S.wait = true;
    this.learnNext();
  }

  learnNext() {
    const S = this.learning;
    if (S.i < LEARN.length) return S.onStep?.(S.i, null);
    this.learning = null;
    this.layout = cleanLayout(S.got);
    S.onStep?.(S.i, this.layout);
  }

  learnTick(gp) {
    const S = this.learning, ax = [...gp.axes];
    // (Where its axes rest when it starts: a trigger's at -1 on some, a hat's outside ±1.)
    if (!S.rest) S.rest = ax.slice();
    const down = gp.buttons.findIndex((x) => x?.pressed || trigger(x) > 0.5);
    // (An axis pushed well over; a hat switch, any direction at all: left, from rest, is only 4/7.)
    const moved = ax.findIndex((v, i) => typeof v === 'number' && (Math.abs(S.rest[i] ?? 0) > 1.05 ? hatDir(v) >= 0 : Math.abs(v - (S.rest[i] ?? 0)) > 0.6));
    if (S.wait) {
      if (down < 0 && moved < 0) S.wait = false;
      return;
    }
    const name = LEARN[S.i][0], stick = STICKS.includes(name);
    let src = null;
    if (!stick && down >= 0) src = ['b', down];
    else if (moved >= 0) {
      const v = ax[moved], r = S.rest[moved] ?? 0, sign = Math.sign(v - r);
      if (Math.abs(r) > 1.05) src = stick || hatDir(v) < 0 ? null : ['h', moved, hatDir(v)];
      // (A stick: its axis, the way that reads right, or down, as the standard layout does.)
      else if (stick) src = ['a', moved, name.endsWith('Y') ? -sign : sign];
      else src = ['a', moved, sign, Math.max(-1, Math.min(1, Math.round(r)))];
    }
    if (!src) return;
    // (One already taken for another button or stick isn't taken again.)
    const key = (s) => s.slice(0, 3).join();
    if (stick ? Object.values(S.got.sticks).some((s) => s[1] === src[1]) : Object.values(S.got.buttons).some((s) => key(s) === key(src))) return;
    (stick ? S.got.sticks : S.got.buttons)[name] = src;
    S.i++;
    S.wait = true;
    this.learnNext();
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
    // Two controllers, and the one we're reading is silent while another is being used: Steam,
    // running, takes the real one for itself and hands the browser a virtual one besides. Go with
    // the one that's actually sending (its press counts).
    const busy = (g) => !!g && g.connected !== false && (g.buttons.some((b) => b?.pressed) || g.axes.some((a) => Math.abs(a) > 0.5));
    const cur = this.index !== null ? list[this.index] : null;
    if (this.index !== null && !busy(cur)) {
      const other = list.find((g) => g && g.index !== this.index && busy(g));
      if (other) {
        this.releaseAll();
        this.index = null;
        this.connect(other);
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
    if (this.learning) {
      this.learnTick(gp);
      // (Every button counts as held until it's let go, so the last one pressed for the set-up
      // doesn't press anything as it ends.)
      this.was = NAMES.map(() => true);
      return;
    }
    const { b, ax } = readPad(gp, this.layout, this.family);
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
    // (In use just now: the game hides the mouse pointer. See main.js hidePointer.)
    if (any) this.onActive?.();
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
        // (Expert technique with a line out: the right stick is the rod, not the camera.)
        if (this.h.rodStick?.()) {
          this.input.virtual.rodUp = -R.y;
          this.input.virtual.rodAcross = R.x;
        } else {
          this.input.virtual.rodUp = this.input.virtual.rodAcross = 0;
          this.input.drag.dx += R.x * 520 * dt;
          this.input.drag.dy += R.y * 380 * dt;
        }
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

  // A short buzz, where the controller can; nothing depends on it. (The game's feelings go
  // through Haptics, see haptics.js, which plays them with feel below.)
  rumble(strength = 0.4, ms = 120) {
    this.feel(strength, strength * 0.6, 0, 0, ms);
  }

  // Play the two motors (strong: the heavy one, weak: the light one) and, where the browser can
  // reach them, the motors in the triggers (lt, rt), for ms; all zero stops. Chrome and Edge
  // play 'dual-rumble' (and 'trigger-rumble' on Xbox controllers); Firefox has only one strength
  // to give.
  feel(strong, weak, lt = 0, rt = 0, ms = 120) {
    if (!this.active && (strong || weak || lt || rt)) return;
    const gp = this.pad();
    const act = gp?.vibrationActuator;
    try {
      if (act?.playEffect) {
        const stop = !(strong || weak || lt || rt) || !ms;
        if (stop && act.reset) {
          act.reset()?.catch?.(() => {});
          return;
        }
        const effects = act.effects || (act.type ? [act.type] : ['dual-rumble']);
        const triggers = (lt || rt) && effects.includes?.('trigger-rumble');
        const params = { startDelay: 0, duration: stop ? 0 : ms, strongMagnitude: strong, weakMagnitude: weak };
        if (triggers) act.playEffect('trigger-rumble', { ...params, leftTrigger: lt, rightTrigger: rt })?.catch?.(() => {});
        else act.playEffect('dual-rumble', params)?.catch?.(() => {});
      } else if (gp?.hapticActuators?.[0]?.pulse) {
        gp.hapticActuators[0].pulse(Math.max(strong, weak), ms)?.catch?.(() => {});
      }
    } catch { /* not on this controller */ }
  }

  /* ---------------- menus ---------------- */

  menu(pressed, L, R, dt) {
    // (H2: the on-screen keyboard, over everything, wherever it was opened from.)
    const top = topDialog(), osk = top?.id === 'osk';
    const root = osk ? top : this.ctx === 'title' ? this.h.focusRoot?.() : top;
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
    // (The keyboard's own buttons: B deletes, Y shifts, X a space, Menu is done. See osk.js.)
    if (osk) for (const n of ['B', 'Y', 'X', 'MENU', 'VIEW']) if (edge(n)) this.h.oskButton?.(n);
    if (edge('A')) {
      const first = firstFocus(root), a = document.activeElement;
      // (On a text box: the on-screen keyboard, to type into it.)
      if (inside() && !osk && isTextBox(a) && this.h.typeInto) this.h.typeInto(a);
      else if (inside()) a.click();
      else if (first) first.focus();
      // (A card with nothing to choose, like a discovery: A carries on, as Enter does.)
      else this.input.emit('press', 'Enter', []);
    }
    if (this.ctx === 'title' || osk) return;
    if (edge('B')) this.input.emit('press', 'Escape', ['cancel']);
    if (edge('LB') || edge('RB')) tabs(root, edge('RB') ? 1 : -1);
    // The buttons that open the map and Settings close them again.
    if (edge('VIEW')) this.input.emit('press', 'Pad:map', ['map']);
    if (edge('MENU')) this.input.emit('press', 'Pad:settings', ['settings']);
    // (H2) A chart or a boat to turn: the right stick, the triggers and X are theirs (main.js).
    if (this.h.panel?.(root, { rx: R.x, ry: R.y, zoom: this.rt - this.lt, x: edge('X') }, dt)) return;
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
  return all.find((d) => d.id === 'osk') || all.find((d) => d.id === 'confirm') || all.find((d) => d.id === 'photo-card') || all.find((d) => d.id === 'mem-viewer') || all[all.length - 1];
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
