// The helm's dashboard (src/dashboard.js): each console carries exactly the switches its engine
// room has; the key does what the start-up setting says; the controls move with what they control
// (the battery knob, the key, the kill cord's clip, the throttle lever, the trim rocker, the
// navigation lights); a control can be picked with a ray and reached from its neighbours; the
// gauges and the screen draw from the engine room; and the outboard stays where it's trimmed or
// tilted, a dry tank or not. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const E = await import('../src/engine.js');
const { Boat } = await import('../src/boat.js');
const { controlsFor, keyStep, DASHES } = await import('../src/dashboard.js');

const scene = new THREE.Scene();
// What the dashboard is shown (main.js builds this from the engine room and the boat).
const stateOf = (en, extra = {}) => ({
  powered: en.battery, battery: en.battery, key: en.key, cord: en.cord, hasCord: true, glow: false, glowReady: false,
  crank: en.engines.map((e) => e.crank > 0), running: E.running(en), rpm: en.engines.map((e) => e.rpm),
  knots: 0, fuel: 0.8, volts: 12.6, temp: en.temp, trim: en.trim, trimDir: 0, lever: 0, lights: false, horn: false,
  selftest: 0, night: 0, heading: 0, depth: 8, track: [], page: 'chart', ...extra,
});
const settle = (dash, S, secs = 1) => {
  for (let i = 0; i < secs * 30; i++) dash.update(1 / 30, S, i / 30);
};

test('each console carries exactly the switches its engine room has', () => {
  assert.deepEqual(controlsFor('rib'), ['battery', 'key', 'cord', 'lights', 'horn', 'screen', 'throttle', 'trimUp', 'trimDown']);
  assert.deepEqual(controlsFor('console'), ['battery', 'key0', 'key1', 'cord', 'lights', 'horn', 'screen', 'throttle', 'trimUp', 'trimDown'], 'twin outboards: a key each');
  for (const k of ['row', 'skiff', 'kayak', 'sail', 'windsurf']) assert.deepEqual(controlsFor(k), [], `${k}: no console`);
  for (const kind of Object.keys(DASHES)) {
    const b = new Boat(scene, { kind });
    assert.ok(b.dash, `${kind} has its dashboard`);
    assert.deepEqual([...b.dash.controls.keys()].sort(), controlsFor(kind).slice().sort());
  }
  for (const kind of ['row', 'skiff', 'bass', 'cabin', 'cruiser']) assert.equal(new Boat(scene, { kind }).dash, undefined, `${kind}: not yet`);
});

test('the key does what the start-up setting says: the full procedure, the one button, or nothing to do', () => {
  const en = E.newEngine('rib');
  assert.equal(keyStep(en, null, 'go'), 'go');
  assert.equal(keyStep(en, null, 'simple'), 'assist');
  en.auto = { steps: ['start'], t: 0 };
  assert.equal(keyStep(en, null, 'simple'), 'stop', 'pressed again while it starts her: stop');
  en.auto = null;
  // The full procedure: on, then start, then (running) off.
  assert.equal(keyStep(en, null, 'full'), 'key');
  en.battery = en.cord = true;
  E.act(en, 'key');
  assert.equal(keyStep(en, null, 'full'), 'start');
  const r = E.act(en, 'start', { fuel: 50 });
  assert.ok(r.ok && E.cranking(en));
  assert.equal(keyStep(en, null, 'full'), 'stop', 'turning it while it cranks lets it go');
  for (let i = 0; i < 90; i++) E.stepEngine(en, 1 / 30, { fuel: 50, wet: true }, () => 0.5);
  assert.ok(E.running(en));
  assert.equal(keyStep(en, null, 'full'), 'stop');
  // Twin engines: each key its own engine.
  const tw = E.newEngine('console');
  Object.assign(tw, { battery: true, cord: true, key: true });
  tw.engines[0].run = true;
  assert.equal(keyStep(tw, 0, 'full'), 'stop');
  assert.equal(keyStep(tw, 1, 'full'), 'start');
});

test('the controls move with what they control', () => {
  const b = new Boat(scene, { kind: 'rib' }), D = b.dash, en = E.newEngine('rib');
  const u = (id) => D.controls.get(id).group.userData;
  settle(D, stateOf(en));
  const knobOff = u('battery').knob.rotation.y, keyOff = u('key').key.rotation.y, clipOff = u('cord').clip.position.z;
  assert.ok(Math.abs(knobOff) < 0.01 && Math.abs(keyOff) < 0.01);
  // Battery on, cord clipped on, key on: a quarter-turn of the knob, the clip on its switch, the key turned.
  Object.assign(en, { battery: true, cord: true, key: true });
  settle(D, stateOf(en));
  assert.ok(Math.abs(u('battery').knob.rotation.y + Math.PI / 2) < 0.02, 'the knob a quarter-turn on');
  assert.ok(Math.abs(u('key').key.rotation.y + 0.6) < 0.02, 'the key at on');
  assert.ok(Math.abs(u('cord').clip.position.z) < 0.002 && clipOff < -0.04, 'the clip on its switch (it hung away while it was off)');
  // Cranking: the key held over to start.
  en.engines[0].crank = 0.3;
  settle(D, stateOf(en), 0.5);
  assert.ok(Math.abs(u('key').key.rotation.y + 1.1) < 0.03, 'the key held at start');
  // The throttle lever leans forward ahead and back astern; the trim rocker tips as it's pressed.
  settle(D, stateOf(en, { lever: 1 }));
  const ahead = D.anim.pivot.rotation.x;
  settle(D, stateOf(en, { lever: -0.4 }));
  assert.ok(ahead > 0.5 && D.anim.pivot.rotation.x < -0.2, `lever ${ahead.toFixed(2)} ahead, ${D.anim.pivot.rotation.x.toFixed(2)} astern`);
  settle(D, stateOf(en, { trimDir: 1 }), 0.5);
  assert.ok(D.anim.rocker.rotation.z > 0.25);
  // The navigation lights: lit only switched on with the power on.
  settle(D, stateOf(en, { lights: true, night: 1 }), 0.2);
  assert.ok(D.navLamps.every((l) => l.material.emissiveIntensity > 1));
  settle(D, stateOf({ ...en, battery: false }, { lights: true, night: 1, powered: false }), 0.2);
  assert.ok(D.navLamps.every((l) => l.material.emissiveIntensity === 0), 'no power, no lights');
});

test('a control can be picked with a ray, and reached from its neighbours', () => {
  const b = new Boat(scene, { kind: 'rib' }), D = b.dash;
  b.place(0, 0, 0);
  b.group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const id of ['battery', 'key', 'cord', 'horn', 'screen', 'throttle']) {
    const at = D.worldOf(id);
    ray.set(at.clone().add(new THREE.Vector3(0, 0.6, -0.5)), at.clone().sub(at.clone().add(new THREE.Vector3(0, 0.6, -0.5))).normalize());
    const c = D.pick(ray);
    assert.equal(c?.id, id, `aimed at the ${id}: ${c?.id}`);
  }
  // As the helmsman sees it: to the right of the battery switch, the lights; up from the switches, the screen.
  assert.equal(D.neighbour('battery', 'right').id, 'lights');
  assert.equal(D.neighbour('lights', 'left').id, 'battery');
  assert.equal(D.neighbour('battery', 'up').id, 'screen');
  const up = D.neighbour('key', 'up');
  assert.ok(up.nav[1] > D.controls.get('key').nav[1], `up from the key goes up: ${up.id}`);
  assert.equal(D.neighbour('cord', 'right').id, 'throttle');
  // From every control, some way round to every other.
  const ids = [...D.controls.keys()], seen = new Set(['battery']), todo = ['battery'];
  while (todo.length) {
    const id = todo.pop();
    for (const d of ['left', 'right', 'up', 'down']) {
      const n = D.neighbour(id, d).id;
      if (!seen.has(n)) {
        seen.add(n);
        todo.push(n);
      }
    }
  }
  assert.deepEqual([...seen].sort(), ids.sort());
});

test('the outboard stays where it is trimmed or tilted, running, stopped or with the tank dry', () => {
  const b = new Boat(scene, { kind: 'rib' });
  b.place(150, 330, 0);
  b.engine = E.newEngine('rib');
  b.trimAuto = false;
  b.engine.trim = E.TRIM.up;
  let t = 0;
  const run = (secs) => {
    for (let i = 0; i < secs * 30; i++) b.update(1 / 30, (t += 1 / 30), 0, 0, 0);
  };
  run(3);
  const lean = -b.motorGroup.rotation.x;
  assert.ok(Math.abs(lean - (E.TRIM.up * Math.PI) / 180) < 0.05, `tilted right up at rest: ${((lean * 180) / Math.PI).toFixed(0)}°`);
  b.dry = true;
  run(3);
  assert.ok(Math.abs(-b.motorGroup.rotation.x - lean) < 0.02, 'a dry tank doesn’t drop it');
  b.dry = false;
  b.engine.trim = 4;
  run(3);
  assert.ok(Math.abs(-b.motorGroup.rotation.x - (4 * Math.PI) / 180) < 0.03, 'trimmed back down to 4°');
});
