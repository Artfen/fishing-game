// The sport-fishing boats: the yacht (twin inboard diesels, the wheel under a hardtop, an open
// cockpit aft with a fighting chair) and the centre console (twin outboards, the wheel on a console
// amidships). On both you stand: at the wheel, and to fish, in the cockpit (or the console's bow),
// turned to face your line, so you can cast straight off the stern. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const { Boat, BOAT_KINDS } = await import('../src/boat.js');
const { LEVERS } = await import('../src/throttle.js');
const F = await import('../src/fuel.js');
const M = await import('../src/mooring.js');
const T = await import('../src/world/terrain.js');
const { Fishing } = await import('../src/fishing.js');
const { RODS, TACKLE } = await import('../src/tackle.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
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
const boatAt = (kind, x = OPEN.x, z = OPEN.z, heading = 0) => {
  const b = new Boat(scene, { kind });
  b.place(x, z, heading);
  b.update(1 / 30, clock, 0, 0, 0);
  return b;
};
const calm = () => {
  conditions.manual = { speed: 0, from: 0 };
  conditions.wind.speed = conditions.wind.target = 0;
};
const local = (b, v) => b.body.worldToLocal(v.clone());

test('the yacht: twin inboards under her stern (no outboard), about twenty knots, and handy when slow', () => {
  calm();
  const y = boatAt('cruiser');
  assert.equal(y.name, 'sport-fishing yacht');
  assert.ok(y.motor && y.hull.motor.inboard && !y.motorGroup, 'inboards: nothing on the transom');
  assert.equal(y.props.length, 2, 'two propellers');
  assert.equal(y.rudders.length, 2, 'two rudders');
  for (const p of y.props) assert.ok(p.position.y < 0 && p.position.z < -3.5, 'the propellers under her stern');
  const v = run(y, 50, 1).forwardSpeed;
  assert.ok(v > 9.3 && v < 11, `${v.toFixed(2)} m/s flat out`);
  // The rudders follow the helm; the propellers turn opposite ways.
  run(y, 1, 1, 1);
  assert.ok(Math.abs(y.rudders[0].rotation.y) > 0.3);
  assert.ok(Math.sign(y.props[0].rotation.z) !== Math.sign(y.props[1].rotation.z) || y.props[0].rotation.z === 0);
  // Slow, the twin screws bring her round more readily than the skiff at its own dead slow.
  const turn = (b) => {
    b.place(OPEN.x, OPEN.z, 0);
    run(b, 6, LEVERS[b.kind][2].v);
    const h0 = b.heading;
    run(b, 3, LEVERS[b.kind][2].v, 1);
    return Math.abs(b.heading - h0);
  };
  assert.ok(turn(boatAt('cruiser')) > turn(boatAt('skiff')), 'twin screws when slow');
  conditions.manual = null;
});

test('the centre console: twin outboards, quick, its own berth, fuel and lever; kept in the save', async () => {
  calm();
  assert.ok(BOAT_KINDS.includes('console'));
  const c = boatAt('console');
  assert.equal(c.motorGroups.length, 2, 'two outboards');
  assert.ok(c.motorGroups[0].position.x * c.motorGroups[1].position.x < 0, 'one each side');
  const v = run(c, 40, 1).forwardSpeed;
  assert.ok(v > 12.5 && v < 15, `${v.toFixed(2)} m/s flat out`);
  for (const [id, lo, hi] of [['1', 0.7, 1.3], ['2', 1.5, 2.4], ['3', 4, 5.5]]) {
    const b = boatAt('console');
    const s = run(b, 40, LEVERS.console.find((n) => n.id === id).v).forwardSpeed;
    assert.ok(s > lo && s < hi, `notch ${id}: ${s.toFixed(2)} m/s`);
  }
  assert.ok(F.isPetrol('console') && F.TANKS.console > F.TANKS.jetski);
  const home = boatAt('console', T.CONSOLE_BERTH.x, T.CONSOLE_BERTH.z, T.CONSOLE_BERTH.heading);
  const berth = M.berthFor(home, []);
  assert.ok(berth && Math.hypot(berth.x - T.CONSOLE_BERTH.x, berth.z - T.CONSOLE_BERTH.z) < 0.5, 'its berth is a berth');
  assert.equal(T.PIERS[berth.pier], T.HAVEN_FINGERS[2]);
  // Clear of the yacht's berth.
  assert.ok(Math.hypot(T.CONSOLE_BERTH.x - T.CRUISER_BERTH.x, T.CONSOLE_BERTH.z - T.CRUISER_BERTH.z) > 6);
  const { parseSave, SAVE_VERSION } = await import('../src/save.js');
  const data = { day: 2, hour: 10, vessel: 'console', mode: 'boat', boats: { console: { x: 20, z: 300, heading: 1 } }, fuel: { boats: { console: 80 } } };
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1000, data })).state;
  assert.equal(s.vessel, 'console');
  assert.equal(s.boats.console.x, 20);
  assert.equal(s.fuel.boats.console, 80);
  conditions.manual = null;
});

test('you stand at the wheel, and step back into the cockpit to fish, turned whichever way you cast', () => {
  for (const kind of ['cruiser', 'console']) {
    const b = boatAt(kind);
    const H = b.hull;
    run(b, 0.5);
    assert.ok(b.turns, `${kind}: you turn to face your line`);
    assert.ok(Math.abs(b.torso.position.y - (H.floorY + 0.88)) < 0.01, 'standing, not sitting');
    assert.ok(Math.abs(b.standAt.x - H.standing.helm[0]) < 0.01 && Math.abs(b.standAt.z - H.standing.helm[1]) < 0.01, 'at the wheel');
    // Feet on the deck.
    for (const L of b.legs) assert.ok(Math.abs(L.boot.position.y - (H.floorY + 0.02)) < 0.05, 'boots on the deck');
    // Fishing over the stern: back in the cockpit, facing aft, the rod out over the transom.
    b.pose.fishing = 1;
    b.pose.rodYaw = Math.PI;
    b.spot = null;
    run(b, 0.2);
    assert.ok(b.standAt.z < H.standing.aft[1], `${kind}: aft to the transom (${b.standAt.z.toFixed(2)})`);
    assert.ok(Math.abs(Math.abs(b.facing - b.heading) - Math.PI) < 0.01, 'facing aft');
    const tip = local(b, b.rodTip.getWorldPosition(new THREE.Vector3()));
    assert.ok(tip.z < -H.L / 2, `${kind}: the rod tip out past the stern (${tip.z.toFixed(2)})`);
    const fish = local(b, b.holdPoint(new THREE.Vector3()));
    assert.ok(fish.z < b.standAt.z, 'a fish held up in front of you, aft');
    const back = b.releasePoint(new THREE.Vector3());
    const rl = local(b, back.setY(b.group.position.y));
    assert.ok(rl.z < -H.L / 2, 'and let go over the stern');
    // Over the side.
    b.pose.rodYaw = Math.PI / 2;
    run(b, 0.2);
    assert.ok(b.standAt.x > 0.3, 'over to the rail on that side');
    // Done fishing: back to the wheel.
    b.pose.fishing = 0;
    b.pose.rodYaw = 0;
    run(b, 0.2);
    assert.ok(Math.abs(b.standAt.z - H.standing.helm[1]) < 0.01);
  }
  // The console's bow: facing forward when you cast, you go up into the bow.
  const c = boatAt('console');
  c.pose.fishing = 1;
  c.pose.rodYaw = 0.2;
  run(c, 0.2);
  assert.ok(c.standAt.z > 1.5, `up in the bow (${c.standAt.z.toFixed(2)})`);
  // The other boats: still seated, the rod swinging no further than your side.
  assert.ok(!boatAt('skiff').turns && !boatAt('cabin').turns);
});

// A headless angler on a real boat: the real fishing system and a real ecosystem.
const habitat = createHabitat();
const quiet = new Proxy({}, { get: () => () => {} });
test('from the yacht’s cockpit you turn and cast straight off the stern; seated, the rod only comes round to your side', () => {
  calm();
  const castAft = (kind) => {
    const b = boatAt(kind, OPEN.x, OPEN.z, Math.PI / 2);
    const eco = new Ecosystem(habitat);
    const f = new Fishing(scene, b, quiet, quiet, eco, { flash() {}, key: (a) => a, teach() {}, shake() {}, cue() {}, onCast() {}, castResult() {}, quiet() {}, canopyAt: () => false });
    f.setRig({ ...RODS.sea, line: RODS.sea.lines[0] }, TACKLE.metal);
    const aft = b.heading + Math.PI;
    let t = 0;
    const step = (secs, held = false) => {
      for (let i = 0; i < secs * 30; i++) {
        t += 1 / 30;
        b.update(1 / 30, t, 0, 0, 0);
        f.update(1 / 30, t, aft, held);
      }
    };
    f.onDown();
    step(0.8, true);
    f.onUp();
    step(4);
    const off = local(b, f.bob);
    return { off, b, f };
  };
  const yacht = castAft('cruiser');
  assert.ok(yacht.off.z < -yacht.b.hull.L / 2 - 4 && Math.abs(yacht.off.x) < 3, `the yacht: it lands astern (${yacht.off.x.toFixed(1)}, ${yacht.off.z.toFixed(1)})`);
  assert.ok(Math.abs(Math.abs(yacht.b.facing - yacht.b.heading) - Math.PI) < 0.3, 'and you face it');
  const tip = local(yacht.b, yacht.b.rodTip.getWorldPosition(new THREE.Vector3()));
  assert.ok(tip.z < -yacht.b.hull.L / 2, 'the rod out over the transom');
  const skiff = castAft('skiff');
  assert.ok(Math.abs(skiff.b.pose.rodYaw) <= 2.2 + 1e-6, `the skiff: the rod no further round than your side (${skiff.b.pose.rodYaw.toFixed(2)})`);
  conditions.manual = null;
});
