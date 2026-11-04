// The townsfolk's boats at the helm (world/skipper.js, world/folk.js): they follow the clock's
// route but keep clear of every boat in their way, steering round or stopping to let it by, come
// back onto their line, berth without leaning on a neighbour, and are solid to your boats. Run
// with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { Skipper, capsule, gap } = await import('../src/world/skipper.js');
const F = await import('../src/townsfolk.js');
const { buildCoast } = await import('../src/world/coast.js');
const { seeded } = await import('../src/util.js');
const { FolkView } = await import('../src/world/folk.js');
const { Boat } = await import('../src/boat.js');
const { wakes } = await import('../src/world/wakes.js');

// A skipper on a straight run up +z at v m/s (stopping at `end`), among `others`.
function run(others, { v = 2, T = 110, end = Infinity } = {}) {
  const k = new Skipper(6.2, 1.0, 0.38);
  const dt = 1 / 30;
  let closest = Infinity, wide = 0, stopped = 0, t = 0;
  for (; t < T; t += dt) {
    const z = Math.min(v * t, end);
    for (const o of others) o.move?.(o, dt);
    k.step(dt, { x: 0, z, heading: 0, speed: v * t < end ? v : 0 }, others, null, true);
    if (Math.abs(k.speed) < 0.05 && v * t < end) stopped += dt;
    for (const o of others) closest = Math.min(closest, gap(capsule(k.x, k.z, k.heading, k.L, k.B, 0), capsule(o.x, o.z, o.heading, o.L, o.B, 0)).d);
    wide = Math.max(wide, Math.abs(k.x));
  }
  return { k, closest, wide, stopped, behind: Math.min(v * t, end) - k.z };
}
const moored = (x, z, heading, L = 6, B = 1.2) => ({ x, z, heading, L, B, vx: 0, vz: 0, fixed: true });

test('a skipper steers round a boat in her way, never touching it, and comes back onto her line', () => {
  for (const o of [moored(0, 60, 0.3), moored(0.5, 80, Math.PI / 2, 7.4, 1.25)]) {
    const r = run([o]);
    assert.ok(r.closest > 0.5, `kept ${r.closest.toFixed(2)} m clear`);
    assert.ok(r.wide > 2 && r.wide < 9, `went ${r.wide.toFixed(1)} m out of her way`);
    assert.ok(Math.abs(r.k.x) < 0.3 && Math.abs(r.behind) < 2, 'back on her line, on time');
    assert.equal(r.stopped, 0, 'without stopping');
  }
  // Meeting a boat coming the other way.
  const head = { x: 0.5, z: 180, heading: Math.PI, L: 4, B: 0.8, vx: 0, vz: -3, m: 300, move: (o, dt) => { o.z += o.vz * dt; } };
  assert.ok(run([head]).closest > 0.5, 'passes a boat coming the other way');
  // A line of boats right across her way: round the end of it.
  const line = run([-8, -4, 0, 4, 8].map((x) => moored(x, 60, Math.PI / 2, 4, 0.9)), { T: 70 });
  assert.ok(line.closest > 0.5 && line.wide > 10 && Math.abs(line.behind) < 3, 'round the end of a line of boats');
});

test('with no way through, she stops and waits, and goes on when it clears', () => {
  // A channel blocked right across, from shore to shore (as far as she can tell, a wall of boats).
  const wall = [-16, -12, -8, -4, 0, 4, 8, 12, 16].map((x) => moored(x, 60, Math.PI / 2, 4.2, 0.9));
  const k = new Skipper(6.2, 1.0, 0.38);
  const ground = (x) => (Math.abs(x) > 18 ? 1 : -5);
  let closest = Infinity, t = 0;
  for (; t < 60; t += 1 / 30) {
    k.step(1 / 30, { x: 0, z: 2 * t, heading: 0, speed: 2 }, wall, ground, true);
    for (const o of wall) closest = Math.min(closest, gap(capsule(k.x, k.z, k.heading, k.L, k.B, 0), capsule(o.x, o.z, o.heading, o.L, o.B, 0)).d);
  }
  assert.ok(closest > 0.3, `waits clear of them (${closest.toFixed(2)} m)`);
  assert.ok(Math.abs(k.speed) < 0.1 && k.z < 60, 'stopped short');
  // The middle boat moves off: through the gap she goes, and catches up.
  wall.splice(3, 3);
  for (let s = 0; s < 90; s += 1 / 30, t += 1 / 30) k.step(1 / 30, { x: 0, z: 2 * t, heading: 0, speed: 2 }, wall, ground, true);
  assert.ok(k.z > 2 * t - 20, `on her way again, ${(2 * t - k.z).toFixed(0)} m behind the clock`);
});

test('she comes in to her berth beside another boat without leaning on it, and a bump pushes her off it for a moment', () => {
  const r = run([moored(2.6, 100, 0)], { end: 100, T: 80 });
  assert.ok(Math.hypot(r.k.x, r.behind) < 0.3, `on her berth (${r.k.x.toFixed(2)}, ${r.behind.toFixed(2)})`);
  assert.ok(r.closest > 0, 'never touching her neighbour');
  // Lying on her mooring, a boat runs into her: she's shoved aside, and drifts back.
  const k = r.k, bump = { x: -3, z: 100, heading: Math.PI / 2, L: 4, B: 0.8, vx: 2, vz: 0, m: 400 };
  let most = 0;
  for (let t = 0; t < 1.2; t += 1 / 30) {
    bump.x += bump.vx / 30;
    k.step(1 / 30, { x: 0, z: 100, heading: 0, speed: 0 }, [bump], null, true);
    most = Math.max(most, k.x);
  }
  assert.ok(most > 0.3, `shoved ${most.toFixed(2)} m`);
  for (let t = 0; t < 30; t += 1 / 30) k.step(1 / 30, { x: 0, z: 100, heading: 0, speed: 0 }, [], null, true);
  assert.ok(Math.hypot(k.x, k.z - 100) < 0.3, 'back on her mooring');
});

const coast = buildCoast(new THREE.Scene(), seeded(20261024));
const FAIR = { storm: 0, rain: 0, wind: 5, about: [{ id: 'mackerel', name: 'Atlantic Mackerel', act: 0.9 }], activity: { mackerel: 0.9, seabass: 0.7, squid: 0.6, flounder: 0.5 } };

test('the Morning Star goes round your boat lying across her way out, and is solid to it', () => {
  const scene = new THREE.Scene();
  const view = new FolkView(scene);
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  // Your cabin boat left lying right across Dougie's way out to his pots.
  const q = F.along(F.ROUTE_OUT, 32), q2 = F.along(F.ROUTE_OUT, 34);
  const mine = new Boat(scene, { kind: 'cabin' });
  mine.place(q.x, q.z, Math.atan2(q2.x - q.x, q2.z - q.z) + Math.PI / 2);
  const from = { x: q.x, z: q.z }, dt = 1 / 30;
  let h = 5.5, t = 0, closest = Infinity, out = false;
  town.update(5 * 24 + 3, FAIR);
  for (let i = 0; i < 30 * 40 * 1.6; i++) {
    h += dt / F.HOUR_SECONDS;
    t += dt;
    town.update(5 * 24 + h, FAIR);
    mine.rest(dt, t, 0);
    view.update(dt, t, town, { from, boats: [mine] });
    const k = view.skippers.star;
    if (town.boat.aboard && town.boat.leg === 'go') {
      out = true;
      closest = Math.min(closest, gap(capsule(k.x, k.z, k.heading, k.L, k.B, 0), capsule(mine.pos.x, mine.pos.z, mine.heading, mine.hull.L, mine.hull.B, 0)).d);
    }
  }
  assert.ok(out, 'she went out');
  assert.ok(closest > 0.3, `never through your boat (${closest.toFixed(2)} m clear)`);
  const k = view.skippers.star;
  assert.ok(Math.hypot(k.x - town.boat.x, k.z - town.boat.z) < 25, 'and on her way to the pots, about where the clock has her');
  // Out on the water she's solid: your boats bump off her as off any boat.
  assert.ok(view.boat.lastT === t, 'counted as afloat');
  wakes.forget(view.boat);
});

test('when the clock jumps on (a night’s sleep), she is simply where it puts her', () => {
  const k = new Skipper(6.2, 1.0, 0.38);
  k.step(1 / 30, { x: 0, z: 0, heading: 0, speed: 0 }, [], null, true);
  k.step(1 / 30, { x: 60, z: 90, heading: 1, speed: 0 }, [], null, true);
  assert.ok(Math.hypot(k.x - 60, k.z - 90) < 0.01 && Math.abs(k.heading - 1) < 0.01);
});

test('your boat driven into a townsperson’s boat on her mooring bumps off her, never through', async () => {
  const C = await import('../src/world/conditions.js');
  C.conditions.preset = 'calm';
  C.conditions.manual = { speed: 1, from: 0 };
  C.conditions.wind.speed = C.conditions.wind.target = 1;
  for (let i = 0; i < 2000; i++) C.updateConditions(0.1, { rain: 0, cloud: 0.2 });
  const scene = new THREE.Scene();
  const view = new FolkView(scene);
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  town.update(5 * 24 + 15, FAIR);
  const M = F.MOORING, skiff = new Boat(scene, { kind: 'skiff' });
  // Abeam of the Morning Star, a few lengths off, heading straight for her middle.
  const side = { x: Math.cos(M.heading), z: -Math.sin(M.heading) };
  skiff.place(M.x - side.x * 14, M.z - side.z * 14, Math.atan2(side.x, side.z));
  let t = 0, worst = Infinity, past = false;
  for (let i = 0; i < 30 * 14; i++) {
    t += 1 / 30;
    C.conditions.time = t;
    view.update(1 / 30, t, town, { from: { x: M.x, z: M.z }, boats: [skiff] });
    skiff.update(1 / 30, t, i < 30 * 8 ? 1 : 0, 0, 0);
    const k = view.skippers.star;
    worst = Math.min(worst, gap(capsule(k.x, k.z, k.heading, k.L, k.B, 0), capsule(skiff.pos.x, skiff.pos.z, skiff.heading, skiff.hull.L, skiff.hull.B, 0)).d);
    // (Past her centreline and out the other side would be through her.)
    if ((skiff.pos.x - k.x) * side.x + (skiff.pos.z - k.z) * side.z > k.B + skiff.hull.B) past = true;
  }
  assert.ok(!past, 'not through her');
  assert.ok(worst > -0.5, `hulls pressed together no more than a fender's worth (${worst.toFixed(2)} m)`);
  const k = view.skippers.star;
  assert.ok(Math.hypot(k.x - M.x, k.z - M.z) < 3, 'she swings on her mooring and stays there');
  wakes.forget(skiff);
  wakes.forget(view.boat);
  C.conditions.manual = null;
});
