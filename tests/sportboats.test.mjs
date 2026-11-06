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
  // Slow, the twin screws (one ahead, one astern) walk her round in a tighter circle for her
  // size than the skiff turns at its own dead slow. (Nine tonnes don't swing as quickly as a
  // light skiff, but she comes round within a fraction of her own length.)
  const turn = (b) => {
    b.place(OPEN.x, OPEN.z, 0);
    run(b, 6, LEVERS[b.kind][2].v);
    const h0 = b.heading;
    let path = 0, x = b.pos.x, z = b.pos.z;
    for (let i = 0; i < 90; i++) {
      run(b, 1 / 30, LEVERS[b.kind][2].v, 1);
      path += Math.hypot(b.pos.x - x, b.pos.z - z);
      x = b.pos.x;
      z = b.pos.z;
    }
    const turned = Math.abs(b.heading - h0);
    assert.ok(turned > 0.5, `${b.kind}: turned ${turned.toFixed(2)} rad in 3 s`);
    return path / turned / b.hull.L;
  };
  const yr = turn(boatAt('cruiser')), sr = turn(boatAt('skiff'));
  assert.ok(yr < sr, `twin screws when slow: a turning radius of ${yr.toFixed(2)} of her length, the skiff ${sr.toFixed(2)}`);
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
  assert.equal(T.PIERS[berth.pier], T.OWN_FINGER);
  // Clear of the yacht's berth (the other side of your finger).
  assert.ok(T.CONSOLE_BERTH.z < T.OWN_FINGER.z0 && T.CRUISER_BERTH.z > T.OWN_FINGER.z1);
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

test('the RIB: tubes round a deep-V hull, one big outboard, about thirty-five knots, her own notches, fuel and berth', async () => {
  conditions.manual = { speed: 0, from: 0 };
  conditions.wind.speed = conditions.wind.target = 0;
  assert.ok(BOAT_KINDS.includes('rib'));
  const r = boatAt('rib');
  assert.ok(r.motor && r.hull.tubes && r.hull.standing && r.wheel, 'a motor, tubes, a wheel, and you stand');
  assert.ok(!r.hull.motor.twin, 'one outboard');
  const v = run(boatAt('rib'), 45, 1).forwardSpeed;
  assert.ok(v > 17 && v < 20, `${v.toFixed(2)} m/s flat out (about thirty-five knots)`);
  for (const [id, lo, hi] of [['1', 0.7, 1.3], ['2', 1.5, 2.4], ['T', 3.2, 4], ['3', 4, 5.5]]) {
    const s = run(boatAt('rib'), 35, LEVERS.rib.find((n) => n.id === id).v).forwardSpeed;
    assert.ok(s > lo && s < hi, `notch ${id}: ${s.toFixed(2)} m/s`);
  }
  // Held hard over flat out, she banks into the turn and stays upright; the tubes take some of it.
  const turn = (kind) => {
    const b = run(boatAt(kind), 40, 1);
    let heel = 0;
    for (let i = 0; i < 30 * 4; i++) {
      run(b, 1 / 30, 1, 1);
      heel = Math.max(heel, Math.abs(b.roll));
    }
    return heel;
  };
  const { HULLS } = await import('../src/boat.js');
  HULLS.rib_bare = { ...HULLS.rib };
  delete HULLS.rib_bare.tubes;
  const withTubes = turn('rib'), bare = turn('rib_bare');
  delete HULLS.rib_bare;
  assert.ok(withTubes < 0.45, `heeled ${withTubes.toFixed(2)} rad in a hard turn at full speed`);
  assert.ok(withTubes < bare, `the tubes stand her up (${withTubes.toFixed(2)} vs ${bare.toFixed(2)} rad without)`);
  // Petrol, a tank of her own, the trolling notch with a line out, and a berth on your finger.
  assert.ok(F.isPetrol('rib') && F.TANKS.rib > F.TANKS.jetski && F.TANKS.rib < F.TANKS.console);
  assert.ok(LEVERS.rib.some((n) => n.id === 'T'));
  const FL = await import('../src/fleet.js');
  assert.equal(FL.homeOf('rib'), 'harbour');
  // An older save, from before her: she starts laid up, and the boats it had in the water stay.
  const { parseSave, SAVE_VERSION } = await import('../src/save.js');
  const old = BOAT_KINDS.filter((k) => k !== 'rib');
  const stored = old.filter((k) => !['row', 'skiff', 'console'].includes(k));
  const boats = Object.fromEntries(old.map((k) => [k, { x: 0, z: 0, heading: 0 }]));
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 2, hour: 10, boats, stored } })).state;
  assert.ok(s.stored.includes('rib') && !s.stored.includes('console'));
  conditions.manual = null;
});

test('the RIB is built like one: tubes half a metre across for her sides, a 2.5 m beam with about 1.5 m inside, a deep-V, the tubes just off the water at the stern, and steadier than the console in a beam sea', async () => {
  const { HULLS, floatDraft } = await import('../src/boat.js');
  const { tubeCentre } = await import('../src/hydro.js');
  const H = HULLS.rib, T = H.tubes;
  assert.ok(2 * T.r >= 0.5 && 2 * T.r <= 0.56, 'tubes 50–56 cm across');
  const mid = tubeCentre(H, 0.5, 1), beam = 2 * (mid[0] + T.r), inside = 2 * (mid[0] - T.r);
  assert.ok(beam > 2.4 && beam < 2.7, `beam ${beam.toFixed(2)} m`);
  assert.ok(inside > 1.2 && inside < 1.7, `${inside.toFixed(2)} m inside the tubes`);
  assert.ok(Math.atan(H.vee.rise) > (22 * Math.PI) / 180 && Math.atan(H.vee.rise) < (27 * Math.PI) / 180, 'a deep-V, 22–27° of deadrise');
  // Lying still, the tubes' undersides at the stern are at the waterline, give or take a few cm,
  // and well clear of it at the bow; the hull below them is all that's in the water.
  const r = new Boat(scene, { kind: 'rib' }), draft = floatDraft(r.base);
  const stern = tubeCentre(H, 0, 1)[1] - T.r, bow = tubeCentre(H, 0.9, 1)[1] - T.r;
  assert.ok(Math.abs(stern - draft) < 0.12, `tubes ${(stern - draft).toFixed(2)} m off the water at the stern`);
  assert.ok(bow - draft > 0.25, 'and well up at the bow');
  // In a beam sea her tubes steady her: less roll than the centre console.
  conditions.manual = { speed: 11, from: 0 };
  conditions.wind.speed = conditions.wind.target = 11;
  const { updateConditions } = await import('../src/world/conditions.js');
  for (let i = 0; i < 2000; i++) updateConditions(0.1, { rain: 0, cloud: 0.2 });
  const rms = (kind) => {
    const b = boatAt(kind, -60, 470, Math.PI / 2 + 0.2);
    let s = 0, n = 0;
    for (let i = 0; i < 30 * 30; i++) {
      clock += 1 / 30;
      conditions.time = clock;
      b.update(1 / 30, clock, 0, 0, 0);
      if (i > 150) { s += b.roll * b.roll; n++; }
    }
    return Math.sqrt(s / n);
  };
  const rib = rms('rib'), cc = rms('console');
  assert.ok(rib < cc, `rolling ${rib.toFixed(3)} rad rms against the console's ${cc.toFixed(3)}`);
  conditions.manual = null;
});

test('underway as a real one: the RIB never stands on her tail in a sea, rears onto the plane and levels out, and a sea costs speed', async () => {
  const { updateConditions } = await import('../src/world/conditions.js');
  const full = (kind) => LEVERS[kind].at(-1).v;
  const watch = (kind, secs) => {
    const b = boatAt(kind);
    let up = 0, roll = 0, air = 0, v = 0, n = 0;
    for (let i = 0; i < secs * 30; i++) {
      clock += 1 / 30;
      conditions.time = clock;
      b.update(1 / 30, clock, full(kind), 0, 0);
      if (i > 15 * 30) { up = Math.max(up, -b.pitch); roll = Math.max(roll, Math.abs(b.roll)); if (b.air) air += 1 / 30; v += b.forwardSpeed; n++; }
    }
    return { up, roll, air, v: v / n };
  };
  // Climbing onto the plane in a calm: her bow rears up a few degrees through the hump, then she levels out.
  conditions.manual = { speed: 0, from: 0 };
  for (let i = 0; i < 400; i++) updateConditions(0.25, { rain: 0, cloud: 0 });
  const b = boatAt('rib');
  let hump = 0;
  for (let i = 0; i < 20 * 30; i++) {
    clock += 1 / 30;
    conditions.time = clock;
    b.update(1 / 30, clock, full('rib'), 0, 0);
    hump = Math.max(hump, -b.pitch);
  }
  assert.ok(hump > 0.05 && hump < 0.2, `reared ${(hump * 57.3).toFixed(1)}° climbing onto the plane`);
  assert.ok(Math.abs(b.pitch) < 0.05, `and levelled out on the plane: ${(-b.pitch * 57.3).toFixed(1)}°`);
  const calm = watch('rib', 30).v;
  // A rough sea, flat out: thrown about and a short hop off a crest at most, never on her tail; slower.
  conditions.manual = { speed: 11, from: 0 };
  for (let i = 0; i < 2400; i++) updateConditions(0.25, { rain: 0, cloud: 0.5 });
  const R = watch('rib', 40);
  assert.ok(R.up < 0.4, `bow up at most ${(R.up * 57.3).toFixed(0)}° in a rough sea (she stood on her tail at 54°)`);
  assert.ok(R.roll < 0.45, `rolled at most ${(R.roll * 57.3).toFixed(0)}°`);
  assert.ok(R.air < 2, `airborne ${R.air.toFixed(1)} s`);
  assert.ok(R.v < calm - 1, `slower in a sea: ${R.v.toFixed(1)} against ${calm.toFixed(1)} m/s in a calm`);
  conditions.manual = null;
});

test('walking the deck: off the helm and back, about her inside her sides and round the console, short of her ends; not in the little boats', () => {
  for (const kind of ['rib', 'console', 'cruiser']) {
    const b = boatAt(kind);
    assert.ok(b.setDeck(true) && b.deck && b.atHelm, `${kind}: off the helm at the wheel`);
    const H = b.hull;
    // Forward as far as she goes: stops short of her bow, having gone round the console.
    for (let i = 0; i < 400; i++) b.walkDeck(0.0, 0.03, 1 / 30);
    for (let i = 0; i < 400; i++) b.walkDeck(0.02, 0.03, 1 / 30);
    assert.ok(b.deck.z > H.standing.helm[1] + 0.5, `${kind}: walked forward (${b.deck.z.toFixed(2)})`);
    assert.ok(b.deck.z < H.L / 2, `${kind}: short of her bow`);
    // Out to either side: never past her sides.
    for (const sd of [1, -1]) {
      for (let i = 0; i < 200; i++) b.walkDeck(sd * 0.03, 0, 1 / 30);
      assert.ok(Math.abs(b.deck.x) <= b.deckRoom(b.deck.z) + 1e-9, `${kind}: inside her sides`);
    }
    // Aft to her stern, and back to the wheel.
    for (let i = 0; i < 400; i++) b.walkDeck(0, -0.03, 1 / 30);
    assert.ok(b.deck.z > -H.L / 2 && b.deck.z < H.standing.helm[1]);
    assert.ok(!b.atHelm);
    b.deck.x = H.standing.helm[0];
    b.deck.z = H.standing.helm[1];
    assert.ok(b.atHelm);
    b.setDeck(false);
    assert.equal(b.deck, null);
  }
  for (const kind of ['row', 'skiff', 'kayak']) assert.equal(boatAt(kind).setDeck(true), false, `${kind}: no walking about`);
});

test('the RIB and the centre console have a cruising notch: on the plane, between half and full', async () => {
  // (A flat calm: the sea left by the rough-water tests settled first.)
  const { updateConditions } = await import('../src/world/conditions.js');
  calm();
  for (let i = 0; i < 400; i++) updateConditions(0.25, { rain: 0, cloud: 0 });
  for (const kind of ['rib', 'console']) {
    const L = LEVERS[kind], at = (id) => L.find((n) => n.id === id).v;
    assert.ok(at('3') < at('C') && at('C') < at('F'), `${kind}: C between half and full`);
    const speed = (v) => run(boatAt(kind), 40, v).speed;
    const half = speed(at('3')), cruise = speed(at('C')), full = speed(at('F'));
    assert.ok(cruise > half + 4 && cruise < full - 2.5, `${kind}: half ${half.toFixed(1)}, cruising ${cruise.toFixed(1)}, full ${full.toFixed(1)} m/s`);
    assert.ok(cruise > 9, `${kind}: on the plane (${cruise.toFixed(1)} m/s)`);
  }
  conditions.manual = null;
});
