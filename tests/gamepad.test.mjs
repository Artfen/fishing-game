// A game controller: the dead zone, which button does what where, and the buttons pressing and
// letting go of the same actions the keyboard does (held through a change of what you're doing).
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.addEventListener ??= () => {};
const P = await import('../src/gamepad.js');
const { ACTION_BY_ID } = await import('../src/input.js');
const { PAD_HELP } = await import('../src/settings.js');

test('the dead zone ignores a resting stick and eases out from its edge', () => {
  assert.deepEqual(P.deadzone(0.1, -0.12), { x: 0, y: 0 });
  const edge = P.deadzone(0.21, 0);
  assert.ok(edge.x > 0 && edge.x < 0.03, 'no jump just past the edge');
  const full = P.deadzone(1, 0);
  assert.ok(Math.abs(full.x - 1) < 1e-9);
  const diag = P.deadzone(0.8, 0.8);
  assert.ok(Math.hypot(diag.x, diag.y) <= 1 + 1e-9, 'never more than a full push');
});

test('every button presses a real action, and no button does two things at once', () => {
  for (const [ctx, map] of Object.entries(P.MAPS)) {
    for (const [btn, action] of Object.entries(map)) {
      if (!action) continue;
      assert.ok(btn in P.BTN, `${ctx}: ${btn} is a button`);
      assert.ok(action === 'rodswap' || ACTION_BY_ID[action], `${ctx}: ${btn} → ${action} is an action`);
    }
  }
  // The suggested layout: RT casts and reels, A uses things, B goes back, the catch card's three.
  assert.equal(P.buttonFor('play', 'cast'), 'RT');
  assert.equal(P.buttonFor('fight', 'cast'), 'RT');
  assert.equal(P.buttonFor('play', 'interact'), 'A');
  assert.equal(P.buttonFor('play', 'cancel'), 'B');
  assert.equal(P.buttonFor('catch', 'cast'), 'A');
  assert.equal(P.buttonFor('catch', 'keep'), 'X');
  assert.equal(P.buttonFor('catch', 'photo'), 'Y');
  assert.equal(P.buttonFor('drive', 'throttle'), 'RT');
  assert.equal(P.buttonFor('drive', 'brake'), 'LT');
  assert.equal(P.buttonFor('play', 'rod2'), 'LB');
  // In a menu, a hint names where a thing is while you play.
  assert.equal(P.buttonFor('menu', 'photo'), 'D-pad →');
  // Settings lists every one of them.
  for (const [, rows] of PAD_HELP) for (const [ctx, action] of rows) assert.ok(P.buttonFor(ctx, action), `${ctx}/${action} has a button`);
});

// A stand-in for the browser's controller list, and for the game's input.
function rig(context) {
  const pad = { index: 0, id: 'Test pad', connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [pad] }, configurable: true });
  const log = [];
  const input = {
    codes: new Set(), virtual: { throttle: 0, steer: 0 }, drag: { dx: 0, dy: 0 }, wheel: 0, method: 'keys',
    use(m) { this.method = m; },
    emit(evt, code, acts) { log.push(`${evt}:${acts.join(',')}`); },
  };
  const now = { ctx: context };
  const pads = new P.Gamepads(input, { context: () => now.ctx, resolve: () => 'rod2' });
  const press = (b, on) => { pad.buttons[P.BTN[b]] = { pressed: on, value: on ? 1 : 0 }; pads.poll(1 / 60); };
  return { pad, pads, input, log, now, press };
}

test('a controller already plugged in shows up when you press a button, and takes over the hints', () => {
  const { pads, input, log, press } = rig('play');
  assert.equal(pads.index, null);
  press('A', true);
  assert.equal(pads.index, 0);
  assert.equal(input.method, 'pad');
  assert.deepEqual(log, ['press:interact']);
  press('A', false);
  assert.deepEqual(log, ['press:interact', 'release:interact']);
});

test('RT held from aiming the cast on into reeling stays held; a menu lets go of it', () => {
  const { pads, input, log, now, press } = rig('play');
  press('RT', true);
  assert.ok(input.codes.has('Pad:cast'));
  // Aiming, then a fish on: RT is still the cast/reel button, so nothing lets go.
  now.ctx = 'fish';
  pads.poll(1 / 60);
  now.ctx = 'fight';
  pads.poll(1 / 60);
  assert.deepEqual(log, ['press:cast']);
  assert.ok(input.codes.has('Pad:cast'));
  // The catch card has no RT: that lets go.
  now.ctx = 'catch';
  pads.poll(1 / 60);
  assert.deepEqual(log, ['press:cast', 'release:cast']);
  assert.ok(!input.codes.has('Pad:cast'));
  press('RT', false);
  assert.equal(log.length, 2, 'letting go of a button already let go does nothing');
});

test('the left stick moves (as the touch stick does), the right one looks, the bumper swaps rods', () => {
  const { pads, input, log, pad, press } = rig('play');
  press('LB', true);
  assert.deepEqual(log, ['press:rod2']);
  pad.axes = [0, -1, 0.5, 0];
  pads.poll(0.1);
  assert.ok(input.virtual.throttle > 0.99, 'stick forward is forward');
  assert.equal(input.virtual.steer, -0);
  assert.ok(input.drag.dx > 0, 'the right stick turns the view');
  // L3 toggles a jog, and stopping ends it.
  press('L3', true);
  press('L3', false);
  assert.equal(pads.jog, true);
  pad.axes = [0, 0, 0, 0];
  for (let i = 0; i < 40; i++) pads.poll(1 / 30);
  assert.equal(pads.jog, false);
});

test('touching the controller again after the keyboard hands the hints back to it, and the press counts', () => {
  const { input, log, press } = rig('play');
  press('A', true);
  press('A', false);
  input.method = 'keys';
  // (The first button back only wakes it: it still counts, as a press.)
  press('X', true);
  assert.equal(input.method, 'pad');
  assert.deepEqual(log.slice(-1), ['press:anchor']);
});
