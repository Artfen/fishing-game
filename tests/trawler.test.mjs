// The expedition trawler (L2 of docs/LIVEABOARD.md): a full-displacement trawler of forty-four feet
// on one slow diesel, steered from a pilothouse, with a bow thruster and an autopilot. Her hull and
// how she goes; the single screw; the thruster; the autopilot and its alarms (src/autopilot.js).
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const { Boat, HULLS, floatDraft } = await import('../src/boat.js');
const { buildHullModel } = await import('../src/hydro.js');
const C = await import('../src/world/conditions.js');
const O = await import('../src/world/ocean.js');
const Th = await import('../src/throttle.js');
const E = await import('../src/engines.js');
const A = await import('../src/autopilot.js');

const scene = new THREE.Scene();
const KN = 1 / 0.514444;
let clock = 0, spot = 0;
// Each boat in open water of her own, well clear of the last.
const boatAt = (heading = 0) => {
  const b = new Boat(scene, { kind: 'trawler' });
  b.place((spot = (spot + 200) % 1600) - 700, 2300, heading);
  b.update(1 / 30, clock, 0, 0, 0);
  return b;
};
const run = (b, secs, lever = 0, steer = 0, each = null) => {
  for (let i = 0; i < secs * 30; i++) {
    clock += 1 / 30;
    C.conditions.time = clock;
    const s = typeof steer === 'function' ? steer(b) : steer;
    b.update(1 / 30, clock, lever, s, 0);
    each?.(i / 30);
  }
  return b;
};
const calm = () => {
  C.conditions.manual = { speed: 0, from: 0 };
  C.conditions.wind.speed = C.conditions.wind.target = 0;
  for (let i = 0; i < 200; i++) C.updateConditions(0.1, { rain: 0, cloud: 0.2 });
  C.conditions.swellAmps.fill(0);
  C.conditions.sea.swell = C.conditions.sea.chop = 0;
  O.longSea.setWind(0, 0, 0, 0);
  C.conditions.currents = 'still';
};
const notch = (id) => Th.levers('trawler').find((n) => n.id === id).v;

test('built as a trawler: forty-four feet, seventeen tonnes on a full keel, one screw and its rudder, a pilothouse helm, and within a big boat\'s budget', () => {
  const H = HULLS.trawler, M = buildHullModel(H), b = boatAt();
  assert.equal(b.name, 'expedition trawler');
  assert.ok(H.L > 13 && H.L < 14 && 2 * H.B > 4.2 && 2 * H.B < 4.6, 'about 13.4 m by 4.4 m');
  assert.ok(M.mass === 17000 && M.restDraft > 0.6 && M.restDraft < 0.8, `her hull draws ${M.restDraft.toFixed(2)} m`);
  assert.ok(!H.planing && H.resist, 'a displacement hull, on her own resistance curve');
  // One propeller on her centreline, and its rudder; in her keel's aperture, under her hull.
  assert.equal(b.props.length, 1);
  assert.equal(b.rudders.length, 1);
  assert.ok(Math.abs(b.prop.position.x) < 1e-9 && b.prop.position.y < H.keel(0), 'under her, on her centreline');
  // You stand at her wheel on the pilothouse sole, above her main deck; her dashboard has one key.
  assert.ok(H.standing.floor > H.floorY + 0.4);
  assert.ok(b.wheel && b.dash, 'a wheel and a dashboard');
  assert.ok(b.mastLight, 'a masthead light on her arch');
  assert.match(b.fishBlock(), /wheel/, 'not fished from her wheel: from her decks (tests/deckplan.test.mjs)');
  // What she costs to draw.
  let calls = 0, tris = 0;
  b.group.traverseVisible((o) => {
    if (!o.isMesh || o.material?.colorWrite === false) return;
    calls++;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  assert.ok(calls <= 80 && tris <= 20000, `${calls} draw calls, ${Math.round(tris)} triangles`);
});

test('eight knots all day, about nine at most: more power buys her little; seventeen tonnes carry their way', () => {
  calm();
  const cruise = run(boatAt(), 90, notch('C')).forwardSpeed * KN;
  assert.ok(cruise > 7.5 && cruise < 8.5, `cruising ${cruise.toFixed(2)} knots`);
  const flat = run(boatAt(), 90, 1).forwardSpeed * KN;
  assert.ok(flat > 8.8 && flat < 9.4, `flat out ${flat.toFixed(2)} knots`);
  // Her hull's wall: the biggest engine at the Marine Works, sixty per cent more power, under a knot more.
  const T = E.CATALOGUE.trawler.tops;
  assert.ok((T.d260 - T.d160) * KN < 1 && T.d260 > T.d160, `${(T.d160 * KN).toFixed(1)} → ${(T.d260 * KN).toFixed(1)} knots`);
  // From a cruise, the lever to neutral: she runs on most of a hundred metres.
  const b = run(boatAt(), 60, notch('C')), x0 = b.pos.clone();
  run(b, 120);
  assert.ok(b.pos.distanceTo(x0) > 70 && b.speed < 0.3, `ran on ${b.pos.distanceTo(x0).toFixed(0)} m`);
});

// (Her heading grows as she turns to port: the game's steer is + to port, the left key.)
test('her single screw: she answers her rudder in its wash, and going astern walks her stern to port', () => {
  calm();
  // Dead slow, hard over to starboard: her rudder in the propeller's wash brings her round.
  const turning = boatAt();
  run(turning, 5, notch('1'));
  const h0 = turning.heading;
  run(turning, 15, notch('1'), -1);
  assert.ok(h0 - turning.heading > 0.3, `dead slow, hard to starboard: ${((h0 - turning.heading) * 57.3).toFixed(0)}° in 15 s`);
  // Astern from rest, the helm amidships: her stern walks to port, so her bow swings to starboard,
  // against the same boat with no walk (going astern, a hull swings off of her own accord too).
  const swing = (walk) => {
    const b = boatAt();
    if (!walk) b.propWalk = () => 0;
    run(b, 2);
    const h = b.heading;
    run(b, 15, -0.5);
    assert.ok(b.forwardSpeed < -1, 'going astern');
    return b.heading - h;
  };
  const w = swing(true), n = swing(false);
  assert.ok(w - n < -0.005, `her bow ${((n - w) * 57.3).toFixed(1)}° further to starboard`);
});

test('her bow thruster swings her bow where she lies, either way, and stops when it stops; it does little once she\'s moving', () => {
  calm();
  const swing = (dir) => {
    const b = boatAt();
    run(b, 2);
    const h = b.heading;
    b.thrust = dir;
    run(b, 15);
    const turned = h - b.heading;
    b.thrust = 0;
    run(b, 20);
    return { turned, after: Math.abs(b.omega) };
  };
  const S = swing(1), P = swing(-1);
  assert.ok(S.turned > 0.25, `to starboard: ${(S.turned * 57.3).toFixed(0)}° in 15 s`);
  assert.ok(P.turned < -0.25, `to port: ${(-P.turned * 57.3).toFixed(0)}° in 15 s`);
  assert.ok(S.after < 0.01 && P.after < 0.01, 'and she stops swinging once it stops');
  // Under way at her cruise, it hardly moves her.
  const b = run(boatAt(), 40, notch('C')), h = b.heading;
  b.thrust = 1;
  run(b, 10, notch('C'));
  assert.ok(Math.abs(h - b.heading) < 0.12, `at eight knots: ${((h - b.heading) * 57.3).toFixed(1)}°`);
});

test('her autopilot holds a course in a beam sea for five minutes, and the wheel turns the course it holds', async () => {
  // A fresh breeze on her beam, its sea with it.
  C.conditions.currents = 'natural';
  C.conditions.manual = { speed: 9, from: Math.PI / 2 };
  for (let i = 0; i < 2400; i++) C.updateConditions(0.25, { rain: 0, cloud: 0.4 });
  const b = boatAt(0), P = A.newPilot();
  run(b, 20, notch('C'));
  A.engage(P, b.heading);
  let worst = 0;
  run(b, 300, notch('C'), (bt) => A.steerFor(P, bt.heading, bt.omega), (t) => {
    if (t > 30) worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(b.heading - P.set), Math.cos(b.heading - P.set))));
  });
  assert.ok(worst < 0.09, `off her course by ${(worst * 57.3).toFixed(1)}° at worst`);
  // The wheel held to starboard turns the course it holds to starboard, a few degrees a second.
  const set = P.set;
  for (let i = 0; i < 30; i++) A.nudge(P, -1, 1 / 30);
  assert.ok(set - P.set > 0.08 && set - P.set < 0.2, 'to starboard');
  assert.equal(A.degrees(0), 0);
  C.conditions.manual = null;
});

test('its alarms: shallows and land on her course, a boat closing; nothing for a boat passing well clear', () => {
  const at = { x: 0, z: 0, fx: 0, fz: 1, speed: 4 };
  // Deep water ahead, then a bank at 200 m: shallow, and land beyond it.
  const depth = (x, z) => (z < 200 ? 20 : z < 260 ? 1.8 : -1);
  const S = A.lookAhead(at, depth, 1.25);
  assert.equal(S.what, 'shallow');
  assert.ok(S.d >= 200 && S.d < 210 && S.depth === 1.8);
  assert.equal(A.lookAhead(at, (x, z) => (z < 300 ? 20 : -1), 1.25).what, 'land');
  assert.equal(A.lookAhead(at, () => 20, 1.25), null, 'open water');
  // Slow, she still looks a fair way on.
  assert.ok(A.lookAhead({ ...at, speed: 0.5 }, (x, z) => (z < 70 ? 20 : -1), 1.25));
  // A boat crossing her bow from starboard on a collision course; another passing far off to port.
  const own = { x: 0, z: 0, vx: 0, vz: 4 };
  const hit = { x: -120, z: 120, vx: 4, vz: 0, name: 'the Bonny Jean' }, wide = { x: 150, z: -40, vx: 0, vz: 4 };
  const c = A.closing(own, 0, 1, [wide, hit]);
  assert.ok(c && c.name === 'the Bonny Jean' && c.side === 'starboard' && c.t > 25 && c.t < 35 && c.cpa < 5, JSON.stringify(c));
  assert.equal(A.closing(own, 0, 1, [wide]), null);
  // One closing on her port bow, said so.
  assert.equal(A.closing(own, 0, 1, [{ x: 120, z: 120, vx: -4, vz: 0 }]).side, 'port');
});
