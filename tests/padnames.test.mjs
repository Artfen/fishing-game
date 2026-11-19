// PlayStation (and Nintendo) controllers (README, "A PlayStation or Nintendo controller"): the hints name the
// buttons as they're printed on the controller in your hands (✕ ○ □ △, L1 R2, Options), found
// from the name it gives the browser or chosen in Settings; its touchpad opens the map as in its
// own games; and a controller the browser doesn't know the layout of (a DualSense in some
// browsers, its ✕ reported where □ should be) is set up in Settings by pressing each button as
// it's asked for. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

globalThis.addEventListener ??= () => {};
const P = await import('../src/gamepad.js');
const { cleanSettings } = await import('../src/settings.js');
const root = new URL('..', import.meta.url).pathname;

test('what kind of controller it is, from the name each browser gives it', () => {
  const kinds = {
    // Chrome and Edge
    'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)': 'playstation',
    'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)': 'ps4',
    'Xbox 360 Controller (XInput STANDARD GAMEPAD)': 'xbox',
    'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)': 'xbox',
    'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)': 'nintendo',
    // Firefox
    '054c-0ce6-DualSense Wireless Controller': 'playstation',
    '054c-05c4-Wireless Controller': 'ps4',
    '045e-0b12-Microsoft Xbox Series S|X Controller': 'xbox',
    // Safari
    'DualSense Wireless Controller Extended Gamepad': 'playstation',
    'DUALSHOCK 4 Wireless Controller Extended Gamepad': 'ps4',
    'Logitech Dual Action (Vendor: 046d Product: c216)': 'xbox',
    '': 'xbox',
  };
  for (const [id, kind] of Object.entries(kinds)) assert.equal(P.familyOf(id), kind, id);
});

test('the hints name its buttons as printed on it: ✕ to use, R2 to cast, Options for Settings; or as chosen', () => {
  try {
    P.setPadStyle(P.styleFor('auto', 'playstation'));
    assert.equal(P.buttonFor('play', 'interact'), '✕');
    assert.equal(P.buttonFor('play', 'cancel'), '○');
    assert.equal(P.buttonFor('play', 'anchor'), '□');
    assert.equal(P.buttonFor('play', 'pack'), '△');
    assert.equal(P.buttonFor('play', 'cast'), 'R2');
    assert.equal(P.buttonFor('drive', 'brake'), 'L2');
    assert.equal(P.buttonFor('play', 'rod2'), 'L1');
    assert.equal(P.buttonFor('play', 'map'), 'Create');
    assert.equal(P.buttonFor('play', 'settings'), 'Options');
    assert.equal(P.buttonFor('play', 'forward'), 'L-stick');
    assert.equal(P.padName('LT'), 'L2');
    assert.equal(P.padName('D-pad →'), 'D-pad →');
    // A PS4's DualShock: Share where the PS5's Create is.
    P.setPadStyle(P.styleFor('playstation', 'ps4'));
    assert.equal(P.buttonFor('play', 'map'), 'Share');
    // Nintendo's B is at the bottom: the button you use things with.
    P.setPadStyle(P.styleFor('auto', 'nintendo'));
    assert.equal(P.buttonFor('play', 'interact'), 'B');
    assert.equal(P.buttonFor('play', 'cast'), 'ZR');
    // Chosen in Settings over what it says it is (a PlayStation controller through Steam reads as Xbox).
    P.setPadStyle(P.styleFor('playstation', 'xbox'));
    assert.equal(P.buttonFor('play', 'interact'), '✕');
    P.setPadStyle(P.styleFor('xbox', 'playstation'));
    assert.equal(P.buttonFor('play', 'interact'), 'A');
    // Every kind names every button.
    for (const [kind, names] of Object.entries(P.PAD_NAMES)) for (const k of Object.keys(P.BTN)) assert.ok(names[k], `${kind} ${k}`);
  } finally {
    P.setPadStyle('xbox');
  }
});

// A stand-in for the browser's controller list, and the game's input.
function rig(gp, context = 'play', layout = null) {
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [gp] }, configurable: true });
  const log = [];
  const input = {
    codes: new Set(), virtual: { throttle: 0, steer: 0 }, drag: { dx: 0, dy: 0 }, wheel: 0, method: 'keys',
    use(m) { this.method = m; },
    emit(evt, code, acts) { log.push(`${evt}:${acts.join(',')}`); },
  };
  const pads = new P.Gamepads(input, { context: () => context, resolve: () => 'rod2', layoutFor: () => layout });
  pads.connect(gp);
  return { pads, input, log };
}
const pad = (id, mapping, nb, axes) => ({ index: 0, id, connected: true, mapping, buttons: Array.from({ length: nb }, () => ({ pressed: false, value: 0 })), axes: [...axes] });
const set = (gp, i, on) => { gp.buttons[i] = { pressed: on, value: on ? 1 : 0 }; };

test('a PlayStation controller\'s touchpad, pressed, opens the map (as Create does); not on other controllers', () => {
  const ds = pad('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', 'standard', 18, [0, 0, 0, 0]);
  const { pads, log } = rig(ds);
  set(ds, 17, true);
  pads.poll(1 / 60);
  assert.deepEqual(log, ['press:map']);
  set(ds, 17, false);
  pads.poll(1 / 60);
  const xb = pad('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', 'standard', 18, [0, 0, 0, 0]);
  const X = rig(xb);
  set(xb, 17, true);
  X.pads.poll(1 / 60);
  assert.deepEqual(X.log, []);
});

// A DualSense as some browsers report it, not in the standard layout (its own order, as its USB
// report gives it): □ ✕ ○ △ L1 R1 L2 R2 Create Options L3 R3 PS touchpad; the sticks on axes 0, 1,
// 2 and 5, the triggers' travel on axes 3 and 4 (resting at −1), the D-pad a hat switch on axis 9.
const RAW = { square: 0, cross: 1, circle: 2, triangle: 3, L1: 4, R1: 5, L2: 6, R2: 7, create: 8, options: 9, L3: 10, R3: 11 };
const HAT = { up: -1, right: -3 / 7, down: 1 / 7, left: 5 / 7, rest: 9 / 7 };
const rawPad = () => pad('054c-0ce6-DualSense Wireless Controller', '', 14, [0, 0, 0, -1, -1, 0, 0, 0, 0, HAT.rest]);

test('a controller the browser doesn\'t know: set up by pressing each button as asked, nothing in the game pressed meanwhile; then each does what it should', () => {
  const ds = rawPad();
  const { pads, input, log } = rig(ds);
  assert.equal(pads.standard, false);
  assert.equal(pads.family, 'playstation');
  // Before it's set up, ✕ (its button 1) is read as the standard layout's B: back. That's the mix-up.
  set(ds, RAW.cross, true);
  pads.poll(1 / 60);
  set(ds, RAW.cross, false);
  pads.poll(1 / 60);
  assert.deepEqual(log, ['press:cancel', 'release:cancel']);
  log.length = 0;
  // Setting up: what's asked, and what's pressed on it for each.
  const steps = [];
  let learned = null;
  pads.learn((i, L) => { steps.push(i); if (L) learned = L; });
  const doIt = {
    A: () => set(ds, RAW.cross, true), B: () => set(ds, RAW.circle, true), X: () => set(ds, RAW.square, true), Y: () => set(ds, RAW.triangle, true),
    UP: () => { ds.axes[9] = HAT.up; }, DOWN: () => { ds.axes[9] = HAT.down; }, LEFT: () => { ds.axes[9] = HAT.left; }, RIGHT: () => { ds.axes[9] = HAT.right; },
    LB: () => set(ds, RAW.L1, true), RB: () => set(ds, RAW.R1, true),
    // (The left trigger reported only as its travel; the right one as a button as well.)
    LT: () => { ds.axes[3] = 1; }, RT: () => { ds.axes[4] = 1; set(ds, RAW.R2, true); },
    VIEW: () => set(ds, RAW.create, true), MENU: () => set(ds, RAW.options, true), L3: () => set(ds, RAW.L3, true), R3: () => set(ds, RAW.R3, true),
    LX: () => { ds.axes[0] = 1; }, LY: () => { ds.axes[1] = -1; }, RX: () => { ds.axes[2] = 1; }, RY: () => { ds.axes[5] = -1; },
  };
  const letGo = () => { for (let i = 0; i < ds.buttons.length; i++) set(ds, i, false); ds.axes = [0, 0, 0, -1, -1, 0, 0, 0, 0, HAT.rest]; };
  pads.poll(1 / 60);
  for (const [name] of P.LEARN) {
    // (The same button pressed again for the next one isn't taken twice.)
    if (name === 'B') {
      doIt.A();
      pads.poll(1 / 60);
      assert.equal(pads.learning.i, 1, 'still asking for the right face button');
      letGo();
      pads.poll(1 / 60);
    }
    doIt[name]();
    pads.poll(1 / 60);
    letGo();
    pads.poll(1 / 60);
  }
  assert.equal(pads.learning, null);
  assert.deepEqual(steps, P.LEARN.map((_, i) => i + 1));
  assert.ok(learned && pads.layout === learned);
  assert.deepEqual(log, [], 'nothing pressed while it was being set up');
  assert.deepEqual(learned.buttons.A, ['b', RAW.cross]);
  assert.deepEqual(learned.buttons.X, ['b', RAW.square]);
  assert.deepEqual(learned.buttons.UP, ['h', 9, 0]);
  assert.deepEqual(learned.buttons.LT, ['a', 3, 1, -1]);
  assert.deepEqual(learned.sticks.RY, ['a', 5, 1]);
  // Now: ✕ uses things, ○ goes back, □ the anchor, △ the pack; up on its D-pad the journal.
  const press = (fn) => { fn(); pads.poll(1 / 60); letGo(); pads.poll(1 / 60); };
  press(doIt.A);
  press(doIt.B);
  press(doIt.X);
  press(doIt.Y);
  press(doIt.UP);
  assert.deepEqual(log.filter((l) => l.startsWith('press')), ['press:interact', 'press:cancel', 'press:anchor', 'press:pack', 'press:journal']);
  // (Up and to the left on the D-pad: up and left both, as on any D-pad.)
  log.length = 0;
  ds.axes[9] = 1;
  pads.poll(1 / 60);
  assert.deepEqual(log, ['press:journal', 'press:view']);
  letGo();
  pads.poll(1 / 60);
  // Its sticks: the left walks, the right looks (up looks up); its triggers read from their travel.
  ds.axes[1] = -1;
  ds.axes[5] = -1;
  ds.axes[3] = 0;
  pads.poll(0.1);
  assert.ok(input.virtual.throttle > 0.99, 'left stick forward is forward');
  assert.ok(input.drag.dy < 0, 'right stick up looks up');
  assert.ok(Math.abs(pads.lt - 0.5) < 1e-9, `L2 half way: ${pads.lt}`);
  letGo();
  pads.poll(0.1);
  assert.equal(pads.lt, 0, 'resting at −1 is let go');
  assert.ok(input.virtual.throttle === 0, 'the stick let go');
});

test('setting up: a button skipped, or stopped part way, changes nothing it shouldn\'t; and kept for that controller in the settings', () => {
  const ds = rawPad();
  const { pads } = rig(ds);
  pads.learn(() => {});
  pads.poll(1 / 60);
  pads.skipLearning();
  assert.equal(pads.learning.i, 1);
  pads.stopLearning();
  assert.equal(pads.learning, null);
  assert.equal(pads.layout, null, 'stopped: as it was');
  // A learned layout, kept in the settings by the controller's name, and read back checked.
  const layout = { buttons: { A: ['b', 1], UP: ['h', 9, 0], LT: ['a', 3, 1, -1] }, sticks: { LX: ['a', 0, 1] } };
  const id = '054c-0ce6-DualSense Wireless Controller';
  const S = cleanSettings({ controls: { padNames: 'playstation', padLayouts: { [id]: layout, junk: { buttons: { A: ['x', 1] } }, odd: 4 } } });
  assert.equal(S.controls.padNames, 'playstation');
  assert.deepEqual(Object.keys(S.controls.padLayouts), [id]);
  assert.deepEqual(S.controls.padLayouts[id], layout);
  assert.equal(cleanSettings({ controls: { padNames: 'sega' } }).controls.padNames, 'auto');
  assert.deepEqual(cleanSettings({}).controls.padLayouts, {});
  // And used as it connects again.
  const again = rig(rawPad(), 'play', S.controls.padLayouts[id]);
  assert.deepEqual(again.pads.layout, layout);
  assert.equal(P.cleanLayout({ buttons: { A: ['b', -1], B: ['h', 9, 8], X: ['a', 2, 2] } }), null);
});

test('no Xbox button names written into the game\'s words: every one goes through the names of the controller in use', () => {
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  assert.doesNotMatch(main, /kbd\('(A|B|X|Y|LB|RB|LT|RT)'\)/);
  assert.doesNotMatch(main, /'pad' \? '(LB|RB|LB and RB|LB RB)'|P \? 'LB RB'|pads\.active \? 'LT'/);
  assert.doesNotMatch(main, /A works a switch, B looks|A takes it · Y binoculars|Y or B to lower|B or Esc closes/);
  assert.match(main, /setPadStyle\(styleFor\(settings\.controls\.padNames, pads\.family\)\)/);
  assert.match(main, /layoutFor: \(id\) => settings\.controls\.padLayouts\?\.\[id\]/);
  assert.match(main, /for \(const k of document\.querySelectorAll\('kbd\[data-pad\]'\)\) k\.textContent = padName\(k\.dataset\.pad\);/);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<kbd>(A|B|X|Y|LB|RB|LT|RT)<\/kbd>/);
  const settings = fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8');
  assert.doesNotMatch(settings, /Esc or B\)|X on a controller|, A chooses, B goes back/);
});
