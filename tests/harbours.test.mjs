// Boats and harbours: the sailing boat's little outboard for a calm; the fuel pumps on Puerto
// Brasa's quay and Willowhaven's pontoon; the pontoons themselves (down a gangway from the quay,
// with finger berths for the bigger boats); and the motor cruiser, a sea-going boat with a
// wheelhouse cabin that can make the long passage south under power. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { Boat, BOAT_KINDS } = await import('../src/boat.js');
const M = await import('../src/mooring.js');
const T = await import('../src/world/terrain.js');
const B = await import('../src/world/brasa.js');
const F = await import('../src/fuel.js');
const { LEVERS } = await import('../src/throttle.js');
const { conditions } = await import('../src/world/conditions.js');

const scene = new THREE.Scene();
const OPEN = { x: 150, z: 330 };
let clock = 0;
const run = (b, secs, lever = 0, steer = 0) => {
  for (let i = 0; i < secs * 30; i++) {
    clock += 1 / 30;
    b.update(1 / 30, clock, lever, steer, 0);
  }
  return b;
};
const boatAt = (kind, x, z, heading = 0) => {
  const b = new Boat(scene, { kind });
  b.place(x, z, heading);
  b.update(1 / 30, clock, 0, 0, 0);
  return b;
};
const calm = () => {
  conditions.manual = { speed: 0, from: 0 };
  conditions.wind.speed = conditions.wind.target = 0;
};

/* ---------------- the sailing boat's outboard ---------------- */

test('the sailing boat’s outboard: down, it drives her about six knots in a flat calm; the sail and the oars put it up', () => {
  calm();
  const b = boatAt('sail', OPEN.x, OPEN.z, 0);
  assert.equal(b.motor, false, 'up to begin with');
  b.setSail(true);
  b.setOutboard(true);
  assert.ok(b.motor && b.outboardDown && !b.sailUp, 'lowering it lowers the sail');
  assert.ok(b.oars.every((o) => !o.g.visible), 'the oars stowed');
  const v = run(b, 40, 1).forwardSpeed;
  assert.ok(v > 2.4 && v < 3.4, `${v.toFixed(2)} m/s flat out`);
  // Raising the sail raises the outboard.
  b.setSail(true);
  assert.ok(!b.motor && !b.outboardDown && b.sailUp);
  b.setSail(false);
  assert.ok(b.oars.every((o) => o.g.visible), 'sail and outboard up: the oars');
  // Its own small tank and a lever of a few notches, burning gently.
  assert.ok(F.isPetrol('sail') && F.TANKS.sail < F.TANKS.skiff);
  assert.deepEqual(LEVERS.sail.map((n) => n.id), ['R', 'N', '1', '2', 'F']);
  const f = F.defaultFuel();
  F.burnBoat(f, 'sail', 1, 600);
  assert.ok(f.boats.sail > F.TANKS.sail - 6 && f.boats.sail < F.TANKS.sail - 3, `ten minutes flat out: ${f.boats.sail.toFixed(1)} L left`);
  conditions.manual = null;
});

test('nothing in the game reads a main motor’s settings without allowing for the sailing boat’s outboard', async () => {
  // (The outboard lives in hull.outboard, not hull.motor: reading hull.motor.something while it
  // runs crashed the game once.)
  const { readFileSync, readdirSync } = await import('node:fs');
  const files = ['src/main.js', ...readdirSync('src').filter((f) => f.endsWith('.js')).map((f) => `src/${f}`)];
  for (const f of new Set(files)) {
    const bad = readFileSync(f, 'utf8').split('\n').filter((l) => /hull\.motor\.[a-z]/.test(l));
    assert.deepEqual(bad, [], `${f} reads hull.motor.… unguarded`);
  }
  // And the sailing boat with her outboard down has a motor, a lever and fuel to burn.
  const b = boatAt('sail', OPEN.x, OPEN.z, 0);
  b.setOutboard(true);
  assert.ok(b.motor && !b.hull.motor && b.hull.outboard);
  const f = F.defaultFuel();
  assert.equal(F.burnBoat(f, 'sail', 1, 10, b.hull.motor?.troll || 0), null);
  assert.ok(f.boats.sail < F.TANKS.sail);
});

/* ---------------- the pumps ---------------- */

test('a fuel pump on Puerto Brasa quay and a fuel point on Willowhaven’s pontoon, within reach of the berths', () => {
  const brasa = T.FUEL_PUMPS.brasa, marina = T.FUEL_PUMPS.marina;
  assert.ok(brasa && brasa.z > T.SOUTH_Z, 'at Las Brasas');
  assert.ok(brasa.x > B.QUAY_S.x0 && brasa.x < B.QUAY_S.x1 && brasa.z > B.QUAY_S.z0 && brasa.z < B.QUAY_S.z1, 'on the quay');
  assert.ok(Math.abs(T.walkHeight(brasa.x, brasa.z) - B.QUAY_S.deck) < 0.05);
  // (The pump reaches boats within 25 m: see openPump in the game.)
  const near = (P, p) => Math.hypot(P.x - p.x, P.z - p.z) < 25;
  assert.ok(near(brasa, B.SAIL_BERTH_S), 'the sailing boat at her berth on the quay');
  assert.ok(near(brasa, { x: B.FINGERS_S[0].x0 + 6.5, z: B.FINGERS_S[0].z1 + 1.65 }), 'the cruiser at the first finger');
  assert.ok(near(brasa, { x: brasa.x, z: B.QUAY_S.z1 + 1.5 }), 'a boat alongside the quay in front of it');
  // (Deep water the whole length of the quay's wall, so she can lie in front of the pump.)
  for (let x = B.QUAY_S.x0 + 3; x < B.QUAY_S.x1 - 2; x += 4) assert.ok(T.solidHeight(x, B.QUAY_S.z1 + 1.2) < -3, `deep in front of the quay at x ${x}`);
  const there = boatAt('skiff', brasa.x, B.QUAY_S.z1 + 1.5, Math.PI / 2), berth = M.berthFor(there, []);
  assert.ok(berth && T.PIERS[berth.pier] === B.QUAY_S && near(brasa, berth), 'a berth alongside, by the pump');
  assert.ok(Math.abs(T.walkHeight(marina.x, marina.z) - T.HAVEN_PONTOON.deck) < 0.05, 'on the pontoon');
  for (const p of [T.CRUISER_BERTH, T.CABIN_BERTH, T.SAIL_BERTH]) assert.ok(near(marina, p), `${JSON.stringify(p)} in reach`);
});

/* ---------------- the pontoons ---------------- */

const HARBOURS = [
  { name: 'Willowhaven', walk: T.HAVEN_PONTOON, fingers: T.HAVEN_FINGERS, steps: T.HAVEN_STEPS, quay: T.HAVEN_QUAY },
  { name: 'Puerto Brasa', walk: B.PONTOON_S, fingers: B.FINGERS_S, steps: B.PONTOON_STEPS, quay: B.QUAY_S },
];

test('each pontoon: down the gangway from the quay, out along it and onto every finger, no step too high', () => {
  for (const H of HARBOURS) {
    assert.ok(T.PIERS.includes(H.walk) && H.fingers.every((f) => T.PIERS.includes(f)), `${H.name}: in PIERS`);
    assert.ok(H.walk.deck < 0.7 && H.fingers.every((f) => f.deck < 0.7), 'low on the water');
    // From the quay, down the steps, to the far end of the walkway.
    const x = H.steps[0].x, line = [];
    for (let z = H.quay.z1 - 2; z < H.walk.z1 - 0.5; z += 0.2) line.push(T.walkHeight(x, z));
    assert.ok(Math.abs(line[0] - H.quay.deck) < 0.05 && Math.abs(line[line.length - 1] - H.walk.deck) < 0.05);
    for (let i = 1; i < line.length; i++) assert.ok(Math.abs(line[i] - line[i - 1]) < 0.3, `${H.name}: a ${Math.abs(line[i] - line[i - 1]).toFixed(2)} m step on the gangway`);
    // Out along each finger from the middle of the walkway.
    const mid = (H.walk.x0 + H.walk.x1) / 2;
    for (const f of H.fingers) {
      const cz = (f.z0 + f.z1) / 2, far = f.x0 >= H.walk.x1 ? f.x1 - 0.3 : f.x0 + 0.3;
      let prev = T.walkHeight(mid, cz);
      for (let k = 0.05; k <= 1; k += 0.05) {
        const h = T.walkHeight(mid + (far - mid) * k, cz);
        assert.ok(Math.abs(h - prev) < 0.3 && h > 0.3, `${H.name}: onto the finger at z ${cz.toFixed(0)}`);
        prev = h;
      }
    }
    // The water under them deep enough for the boats.
    for (const f of H.fingers) assert.ok(T.solidHeight((f.x0 + f.x1) / 2, f.z1 + 2) < -2, `${H.name}: deep beside the finger at z ${f.z0.toFixed(0)}`);
  }
});

test('room on the fingers for the bigger boats: berths alongside, in deep water, clear of each other', () => {
  for (const H of HARBOURS) {
    const others = [];
    let n = 0;
    for (const f of H.fingers) {
      const out = f.x0 >= H.walk.x1 ? 1 : -1;
      for (const side of [1, -1]) {
        const b = boatAt('cruiser', out > 0 ? f.x0 + 5.1 : f.x1 - 5.1, side > 0 ? f.z1 + 2 : f.z0 - 2, out * Math.PI / 2);
        const berth = M.berthFor(b, others);
        if (!berth) continue;
        assert.ok(T.PIERS[berth.pier] === f || T.PIERS[berth.pier] === H.walk, 'alongside the pontoon');
        b.place(berth.x, berth.z, berth.heading);
        b.tieTo(berth);
        others.push(b);
        n++;
      }
    }
    assert.ok(n >= 3, `${H.name}: ${n} cruiser berths on the fingers`);
    // Tied up, they lie still at their berths.
    for (const b of others) run(b, 4);
    for (const b of others) assert.ok(Math.hypot(b.pos.x - b.tie.x, b.pos.z - b.tie.z) < 0.3);
  }
});

/* ---------------- the motor cruiser ---------------- */

test('the motor cruiser: big, quick, slow to turn, with a cabin and a wheel, and her own berth at Willowhaven', () => {
  calm();
  assert.ok(BOAT_KINDS.includes('cruiser'));
  const c = boatAt('cruiser', OPEN.x, OPEN.z, 0), skiff = boatAt('skiff', OPEN.x + 40, OPEN.z, 0), cabin = new Boat(scene, { kind: 'cabin' });
  assert.ok(c.motor && c.hull.cabin && c.wheel && c.hull.passage, 'a motor, a cabin, a wheel, and she can make the passage');
  assert.ok(c.hull.L > cabin.hull.L * 1.4 && c.hull.draft > cabin.hull.draft, 'much bigger than the cabin boat');
  assert.deepEqual(c.cabinStations.map((s) => s.id), ['door', 'galley', 'bunk']);
  assert.ok(c.cabinRoofY - c.cabinFloor > 1.8, 'standing headroom in the wheelhouse');
  const v = run(c, 50, 1).forwardSpeed;
  assert.ok(v > 7 && v < 9, `${v.toFixed(2)} m/s flat out (about fifteen knots)`);
  // The lever's notches give the usual speeds: about 1 m/s dead slow, 2 slow, 4–5 half.
  for (const [id, lo, hi] of [['1', 0.7, 1.3], ['2', 1.5, 2.4], ['3', 4, 5.5]]) {
    const n = LEVERS.cruiser.find((x) => x.id === id);
    const b = boatAt('cruiser', OPEN.x, OPEN.z, 0);
    const s = run(b, 50, n.v).forwardSpeed;
    assert.ok(s > lo && s < hi, `notch ${id}: ${s.toFixed(2)} m/s`);
  }
  // Slower to come round than the skiff at the same speed.
  const turn = (b) => {
    b.place(OPEN.x, OPEN.z, 0);
    run(b, 8, 0.48);
    const h0 = b.heading;
    run(b, 3, 0.48, 1);
    return Math.abs(b.heading - h0);
  };
  assert.ok(turn(c) < turn(skiff) * 0.85, 'she turns slower');
  // Her berth: alongside the first finger east of Willowhaven's pontoon, in deep water.
  const home = boatAt('cruiser', T.CRUISER_BERTH.x, T.CRUISER_BERTH.z, T.CRUISER_BERTH.heading);
  const berth = M.berthFor(home, []);
  assert.ok(berth && Math.hypot(berth.x - T.CRUISER_BERTH.x, berth.z - T.CRUISER_BERTH.z) < 0.5, 'her berth is a berth');
  assert.equal(T.PIERS[berth.pier], T.HAVEN_FINGERS[0]);
  conditions.manual = null;
});

test('her fuel: a big tank, the passage takes half of it, and the save keeps her where she was', async () => {
  assert.ok(F.isPetrol('cruiser'));
  assert.equal(F.PASSAGE_FUEL, F.TANKS.cruiser / 2);
  const f = F.defaultFuel();
  assert.equal(f.boats.cruiser, F.TANKS.cruiser, 'full to begin with');
  F.burnBoat(f, 'cruiser', 1, 600);
  assert.ok(f.boats.cruiser < F.TANKS.cruiser - 20 && f.boats.cruiser > F.TANKS.cruiser - 40, `ten minutes flat out: ${f.boats.cruiser.toFixed(0)} L left`);
  assert.equal(F.cleanFuel({ boats: { skiff: 3 } }).boats.cruiser, F.TANKS.cruiser, 'an older save: her tank full');
  const { parseSave, SAVE_VERSION } = await import('../src/save.js');
  const data = { day: 3, hour: 9, vessel: 'cruiser', mode: 'boat', boats: { cruiser: { x: B.LANDFALL.x, z: B.LANDFALL.z, heading: 1 } }, fuel: { boats: { cruiser: 120 } } };
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1000, data })).state;
  assert.equal(s.vessel, 'cruiser');
  assert.equal(s.boats.cruiser.z, B.LANDFALL.z);
  assert.equal(s.fuel.boats.cruiser, 120);
});

test('boats on the supply ship between the harbours are kept in the save, cleaned', async () => {
  const { parseSave, SAVE_VERSION } = await import('../src/save.js');
  const shipping = [{ kind: 'jetski', to: 'south', due: 200 }, { kind: 'bass', to: 'south', due: 200 }, { kind: 'yacht', to: 'home', due: 1 }, { kind: 'kayak', to: 'moon', due: 3 }];
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1000, data: { day: 8, shipping } })).state;
  assert.deepEqual(s.shipping, [{ kind: 'jetski', to: 'south', due: 200 }], 'only real boats (not the lake’s bass boat) to a real harbour');
  const B = await import('../src/world/brasa.js');
  assert.ok(B.HARBOUR_OFFICE.x > B.QUAY_S.x0 && B.HARBOUR_OFFICE.x < B.QUAY_S.x1 && B.HARBOUR_OFFICE.z > B.QUAY_S.z0 && B.HARBOUR_OFFICE.z < B.QUAY_S.z1, 'the office on the quay');
});
