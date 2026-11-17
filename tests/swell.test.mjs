// In a swell: a boat at anchor counts as still though each wave carries her to and fro, so the
// deck's offers (sit back, go diving, the cabin) don't come and go with every wave; and a diver
// at the surface rides the waves up and down instead of finding a crest closed over them, so
// "Climb aboard" is there when they swim back. (Both found playing the two-friends day through:
// tools/playthrough.mjs.) Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;

const { Boat } = await import('../src/boat.js');
const { Diver } = await import('../src/diver.js');
const { conditions, waveHeight } = await import('../src/world/conditions.js');
const { longSea } = await import('../src/world/ocean.js');

const scene = new THREE.Scene();
// A long swell running (crest to trough about 1.8 m over the Hound), a moderate breeze.
const swell = () => {
  conditions.wind.speed = conditions.wind.target = 7;
  conditions.wind.from = 3.9;
  conditions.sea.swell = 0.6;
  conditions.sea.chop = 0.25;
  conditions.swellAmps.fill(0.3);
  longSea.setWind(7, 3.9, 0.06 ** 2 / 4, 0.5);
};

test('at anchor in a swell she counts as still, though each wave carries her to and fro', () => {
  swell();
  const b = new Boat(scene, { kind: 'rib' });
  b.place(-186, 666, 0);
  let clock = 100;
  const run = (s, f) => {
    for (let i = 0; i < s * 30; i++) {
      clock += 1 / 30;
      conditions.time = clock;
      b.update(1 / 30, clock, 0, 0, 0);
      f?.();
    }
  };
  run(0.2);
  b.setAnchor(true);
  run(30);
  // Five minutes lying to her anchor: her speed this moment is past 0.6 m/s again and again (the
  // waves' to-and-fro); over the last few seconds, hardly ever.
  let n = 0, raw = 0, rawTimes = 0, still = 0, stillTimes = 0, wasRaw = false, wasStill = false;
  run(300, () => {
    n++;
    const r = b.speed >= 0.6, s = b.steadySpeed >= 0.6;
    if (r) raw++;
    if (s) still++;
    if (r && !wasRaw) rawTimes++;
    if (s && !wasStill) stillTimes++;
    wasRaw = r;
    wasStill = s;
  });
  assert.ok(b.anchored, 'held by her anchor');
  assert.ok(rawTimes > 20, `her speed this moment past 0.6 m/s ${rawTimes} times (${((100 * raw) / n).toFixed(1)}% of the time)`);
  assert.ok(stillTimes <= 3 && still / n < 0.03, `over the last few seconds, ${stillTimes} times (${((100 * still) / n).toFixed(1)}% of the time)`);
  // Under way, she's under way: her steady speed is her speed.
  const c = new Boat(scene, { kind: 'rib' });
  c.place(-150, 640, 0);
  for (let i = 0; i < 30 * 15; i++) c.update(1 / 30, 200 + i / 30, 0.25, 0, 0);
  assert.ok(c.speed > 2 && Math.abs(c.steadySpeed - c.speed) < 0.25 * c.speed, `under way at ${c.speed.toFixed(2)} m/s: steady ${c.steadySpeed.toFixed(2)}`);
  // Put somewhere new, she starts still.
  c.place(-150, 640, 0);
  assert.equal(c.steadySpeed, 0);
});

test('the deck’s offers ask whether she’s been still, not whether she is this moment', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  // Sitting back, a dive, turning in: at anchor or made fast, and still.
  assert.match(src, /const settled = \(boat\.anchored \|\| boat\.tie\) && boat\.steadySpeed < 0\.6 && !fishing\.lineOut;/);
  // Over the side from a stopped boat.
  assert.match(src, /if \(!onFoot\) \{\n    if \(boat\.steadySpeed < 0\.6\) \{/);
  // The cabin.
  assert.match(src, /\(b\.anchored \|\| !!b\.tie \|\| moored\(b\)\) && b\.steadySpeed < 0\.6 &&/);
});

test('a diver at the surface rides the swell; a duck dive still takes them down', () => {
  swell();
  const d = new Diver(scene);
  const at = { x: -170, z: 655 };
  // Up from a dive to just under the surface (60 cm down), swimming along it, level.
  d.enter('scuba', at.x, waveHeight(at.x, at.z, 100) - 0.6, at.z, 0);
  const input = { fwd: 0.6, up: 0, kick: false, dir: new THREE.Vector3(0, 0, 1) };
  let t = 100, first = null, on = 0, n = 0, lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 30 * 40; i++) {
    input.dir.set(Math.sin(i / 200), 0, Math.cos(i / 200));
    d.update(1 / 30, (t += 1 / 30), input);
    if (d.atSurface(t) && first == null) first = i / 30;
    if (i > 30 * 15) {
      n++;
      if (d.atSurface(t)) on++;
      lo = Math.min(lo, d.pos.y);
      hi = Math.max(hi, d.pos.y);
    }
    assert.ok(d.pos.y <= waveHeight(d.pos.x, d.pos.z, t) - 0.27, 'never out of the water');
  }
  // (The first trough to reach them lifts them onto the surface: within a wave's period.)
  assert.ok(first != null && first < 12, `at the surface after ${first?.toFixed(1)} s`);
  assert.equal(on, n, `at the surface ${on} of ${n} moments after that`);
  assert.ok(hi - lo > 1.2, `riding the swell up and down ${(hi - lo).toFixed(2)} m`);
  // A duck dive: looking well down, they go down.
  input.dir.set(0, -1, 0.3).normalize();
  for (let i = 0; i < 30 * 8; i++) d.update(1 / 30, (t += 1 / 30), input);
  assert.ok(d.depth > 3, `duck-dived to ${d.depth.toFixed(1)} m`);
});
