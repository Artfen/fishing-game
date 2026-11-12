// Marine physics C3b (docs/IMPROVEMENTS.md): twin engines worked apart (boat.js: each leg with its
// own engine, and with the levers split, its own lever; main.js: picking the lever the throttle
// works). Both running and joined, she goes as she always has; one stopped, the other pulls her
// round; one ahead and one astern, she turns on the spot.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat } = await import('../src/boat.js');
const { newEngine } = await import('../src/engine.js');
const scene = new THREE.Scene();
const deg = (r) => (r * 180) / Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Out at sea (sixty metres under her), heading north; secs at a lever (or the levers apart).
const run = (kind, { lever = 1, split = null, running = [true, true], engine = true, secs = 12 } = {}) => {
  const b = new Boat(scene, { kind });
  b.place(400, 1200, 0);
  if (engine) {
    b.engine = newEngine(kind);
    b.engine.engines.forEach((e, i) => (e.run = running[i]));
  }
  b.split = split;
  const h0 = b.heading, p0 = { x: b.pos.x, z: b.pos.z };
  for (let i = 0; i < secs * 30; i++) {
    b.motor = true;
    b.lever = lever;
    b.update(1 / 30, i / 30, lever, 0, 0);
  }
  return { turned: deg(wrap(b.heading - h0)), went: Math.hypot(b.pos.x - p0.x, b.pos.z - p0.z), speed: b.speed, b };
};

test('both engines running, the levers together: she goes as she always has, straight', () => {
  for (const kind of ['console', 'cruiser']) {
    const room = run(kind), none = run(kind, { engine: false });
    // (Whatever the sea and her own hull do to her heading, the same with the engine room.)
    assert.ok(Math.abs(room.turned - none.turned) < 0.3, `${kind}: ${room.turned.toFixed(2)}° off her heading, against ${none.turned.toFixed(2)}°`);
    assert.ok(Math.abs(room.speed - none.speed) < 0.05, `${kind}: ${room.speed.toFixed(2)} against ${none.speed.toFixed(2)} m/s without an engine room`);
    // (The levers apart but level: the same as together.)
    const level = run(kind, { split: [1, 1] });
    assert.ok(Math.abs(level.speed - room.speed) < 0.15 && Math.abs(level.turned - room.turned) < 0.5, `${kind}: apart but level ${level.speed.toFixed(2)} m/s`);
  }
});

test('one engine stopped: half her push, all of it on one side, so she pulls round away from it', () => {
  for (const kind of ['console', 'cruiser']) {
    const both = run(kind), port = run(kind, { running: [true, false] }), stbd = run(kind, { running: [false, true] });
    assert.ok(port.speed < both.speed * 0.9, `${kind}: slower on one`);
    assert.ok(Math.abs(port.turned) > 3, `${kind}: the port engine alone pulls her round ${port.turned.toFixed(1)}°`);
    assert.ok(Math.sign(port.turned) === -Math.sign(stbd.turned), `${kind}: the other way on the other engine (${port.turned.toFixed(1)}° and ${stbd.turned.toFixed(1)}°)`);
  }
});

test('one lever ahead and one astern: she turns on the spot; the other way round, the other way', () => {
  // (A propeller pushes harder ahead than astern, so the skipper gives the one going astern more.)
  for (const kind of ['console', 'cruiser']) {
    const a = run(kind, { lever: 0, split: [0.12, -0.45], secs: 10 }), b = run(kind, { lever: 0, split: [-0.45, 0.12], secs: 10 });
    assert.ok(Math.abs(a.turned) > 25, `${kind}: round ${a.turned.toFixed(0)}° in ten seconds`);
    assert.ok(a.went < 8, `${kind}: barely going anywhere (${a.went.toFixed(1)} m)`);
    assert.ok(Math.sign(a.turned) === -Math.sign(b.turned));
  }
});

test('a lever apart goes through neutral to change gear, and builds its push as the joined one does', () => {
  const b = new Boat(scene, { kind: 'console' });
  let p = 0.5;
  // (Ahead to astern: it comes back through neutral before it pushes astern.)
  const seen = [];
  for (let i = 0; i < 90; i++) seen.push((p = b.spoolLeg(1 / 30, p, -0.5)));
  const zero = seen.findIndex((v) => v === 0);
  assert.ok(zero > 0, 'through neutral');
  assert.ok(seen.slice(0, zero).every((v) => v >= 0) && seen.slice(zero + 1).every((v) => v <= 0));
  assert.ok(seen.at(-1) < -0.2, 'and on astern');
});
