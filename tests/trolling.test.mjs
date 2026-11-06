// Electric trolling motors and GPS Spot-Lock (src/trolling.js, with the boat's own physics): a real
// push under the bow, never a frozen position; Spot-Lock holding her near her spot in a breeze
// while she wanders a little as it corrects, and losing it in a gale; the manual push and heading
// hold; the battery running down and a flat one stopping it; and switching itself off when the
// main engine goes into gear or it's stowed. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const { Boat } = await import('../src/boat.js');
const { TrollMotor, canTroll, TROLL_TIERS } = await import('../src/trolling.js');
const { conditions } = await import('../src/world/conditions.js');
const { FITS, fitEffect, fitBoat } = await import('../src/shipyard.js');
const { cleanFuel } = await import('../src/fuel.js');

const scene = new THREE.Scene();
const OPEN = { x: 150, z: 330 };
const windy = (speed, from = Math.PI / 2) => {
  conditions.manual = { speed, from };
  conditions.wind.speed = conditions.wind.target = speed;
  conditions.wind.from = from;
};
const calm = () => windy(0);

// A boat with a motor, run for so long: each frame the motor works out its push from where she is
// and how she's moving, and the boat's physics does the rest (as main.js does).
function sim(kind, tier, secs, setup = () => {}, each = null) {
  const b = new Boat(scene, { kind });
  b.place(OPEN.x, OPEN.z, Math.PI / 2);
  const m = new TrollMotor(tier);
  b.troll = m;
  m.deploy(true);
  m.down = 1;
  let battery = 1, t = 0, said = [];
  b.update(1 / 30, 0, 0, 0, 0);
  setup(m, b);
  const track = [];
  for (let i = 0; i < secs * 30; i++) {
    t += 1 / 30;
    const r = m.step(1 / 30, { boat: { x: b.pos.x, z: b.pos.z, vx: b.vel.x, vz: b.vel.z, heading: b.heading, mass: b._phys.m }, battery, sea: 0, lever: 0 });
    battery = Math.max(0, battery - r.drawn);
    if (r.why) said.push(r.why);
    b.update(1 / 30, t, 0, 0, 0);
    each?.(m, b, i);
    if (i % 15 === 0) track.push({ x: b.pos.x, z: b.pos.z, t });
  }
  return { b, m, track, battery, said };
}
const from = (track, p) => track.map((q) => Math.hypot(q.x - p.x, q.z - p.z));

test('which boats a bow motor suits, and the tiers', () => {
  for (const k of ['skiff', 'bass', 'cabin', 'console']) assert.ok(canTroll(k), k);
  for (const k of ['rib', 'cruiser', 'sail', 'jetski', 'windsurf', 'kayak', 'row']) assert.equal(canTroll(k), false, k);
  assert.equal(TROLL_TIERS.troll.gps, false, 'the basic motor: manual only');
  assert.ok(TROLL_TIERS.trollgps.gps && TROLL_TIERS.trollpro.gps);
  assert.ok(TROLL_TIERS.trollpro.push > TROLL_TIERS.trollgps.push, 'the high-thrust motor pushes harder');
  const basic = new TrollMotor('troll');
  basic.down = 1;
  assert.equal(basic.spotLock(true, { x: 0, z: 0 }), 'no-gps', 'no Spot-Lock without GPS');
  const stowed = new TrollMotor('trollgps');
  assert.equal(stowed.spotLock(true, { x: 0, z: 0 }), 'stowed', 'nor stowed');
});

test('Spot-Lock holds her near her spot in a breeze, wandering a little as it corrects; without it she drifts off', () => {
  windy(7);
  try {
    // Drifting free in the breeze.
    const free = sim('console', 'trollpro', 60, (m) => m.stop());
    const p0 = free.track[0], drift = from(free.track, p0).at(-1);
    // Locked.
    let spot = null;
    const held = sim('console', 'trollpro', 60, (m, b) => {
      spot = { x: b.pos.x, z: b.pos.z };
      m.spotLock(true, spot);
    });
    const off = from(held.track, spot), late = off.slice(Math.floor(off.length / 3));
    assert.ok(drift > 15, `free, the breeze takes her ${drift.toFixed(1)} m in a minute`);
    assert.ok(Math.max(...late) < 6, `Spot-Lock keeps her within ${Math.max(...late).toFixed(1)} m of her spot`);
    assert.ok(Math.max(...off) > 0.3, `and she wanders as it corrects (never frozen): ${Math.max(...off).toFixed(2)} m at most`);
    assert.ok(held.m.f > 0, 'it’s pushing');
    assert.ok(held.battery < 1, 'on the battery');
  } finally {
    calm();
  }
});

test('in a gale it can’t hold her: she drags off slowly, and it knows it’s short', () => {
  windy(19);
  try {
    let spot = null, short = 0;
    const r = sim('bass', 'trollgps', 45, (m, b) => {
      spot = { x: b.pos.x, z: b.pos.z };
      m.spotLock(true, spot);
    }, (m) => { short = Math.max(short, m.short); });
    const off = from(r.track, spot).at(-1);
    assert.ok(off > 8, `in a gale she drags ${off.toFixed(1)} m off her spot`);
    assert.ok(short > 0.3, `and it’s short of what it needs (${(short * 100).toFixed(0)}%)`);
  } finally {
    calm();
  }
});

test('the manual push: slow and quiet ahead, steered by turning the head; heading hold keeps her bow where it was', () => {
  calm();
  const ahead = sim('bass', 'troll', 40, (m) => m.drive(1, 0));
  const v = ahead.b.forwardSpeed;
  assert.ok(v > 0.4 && v < 2.2, `full push ahead: ${v.toFixed(2)} m/s, a slow creep`);
  // Head turned to port: she turns to port (her heading grows, as the steer keys' +1 does).
  const turned = sim('bass', 'troll', 30, (m) => m.drive(0.8, 1));
  const dh = turned.b.heading - Math.PI / 2;
  assert.ok(Math.abs(dh) > 0.5, `with the head over she swings round (${dh.toFixed(2)} rad)`);
  // Heading hold, nudged off course: back on it.
  let set = 0;
  const hold = sim('bass', 'trollgps', 40, (m, b) => {
    set = b.heading;
    m.drive(0.5, 0);
    m.holdHeading(true, set);
    b.omega = 0.4;
  });
  const err = Math.atan2(Math.sin(hold.b.heading - set), Math.cos(hold.b.heading - set));
  assert.ok(Math.abs(err) < 0.25, `heading hold brings her back within ${err.toFixed(2)} rad`);
});

test('the battery runs down at full push, and flat it stops the motor; gear or stowing switch it off', () => {
  calm();
  const m = new TrollMotor('trollgps');
  m.deploy(true);
  m.down = 1;
  m.drive(1, 0);
  const boat = { x: 0, z: 0, vx: 0, vz: 0, heading: 0, mass: 700 };
  let battery = 1, mins = 0;
  for (let i = 0; i < 30 * 60 * 200 && battery > 0; i++) {
    battery = Math.max(0, battery - m.step(1 / 30, { boat, battery }).drawn);
    if (i % (30 * 60) === 0) mins++;
  }
  assert.ok(mins > 60 && mins < 180, `flat out, a battery lasts about ${mins} minutes`);
  const r = m.step(1 / 30, { boat, battery: 0 });
  assert.equal(r.why, 'flat');
  assert.equal(m.f, 0);
  // Gear: the main engine in gear switches it off.
  m.drive(1, 0);
  assert.equal(m.step(1 / 30, { boat, battery: 1, lever: 0.3 }).why, 'gear');
  assert.equal(m.mode, 'off');
  // Spot-Lock on, then stowed: off, and it swings up.
  m.spotLock(true, { x: 0, z: 0 });
  m.deploy(false);
  assert.equal(m.mode, 'off');
  for (let i = 0; i < 90; i++) m.step(1 / 30, { boat, battery: 1 });
  assert.equal(m.down, 0);
  assert.equal(m.spotLock(true, { x: 0, z: 0 }), 'stowed');
  // A big sea: much less push to give.
  const big = new TrollMotor('trollgps');
  big.down = 1;
  big.want = true;
  big.drive(1, 0);
  for (let i = 0; i < 60; i++) big.step(1 / 30, { boat, battery: 1, sea: 1.6 });
  assert.ok(big.f < TROLL_TIERS.trollgps.push * 0.35, `in a big sea it gives ${big.f.toFixed(0)} N`);
});

test('bought at the Marine Works: one motor at a time, on the boats it suits; the bank doubles the battery; the charge is kept', () => {
  for (const id of ['troll', 'trollgps', 'trollpro']) {
    assert.equal(FITS[id].slot, 'troll', `${id}: one trolling motor at a time`);
    for (const k of Object.keys(FITS[id].price)) assert.ok(canTroll(k), `${id} is only sold for boats a bow mount suits (${k})`);
    assert.equal(FITS[id].price.rib, undefined);
    assert.equal(FITS[id].price.cruiser, undefined);
  }
  const state = { money: 10000, yard: { owned: ['bass'], fits: {}, looks: {}, hired: null }, ledger: [] };
  const r1 = fitBoat(state, 'bass', 'troll');
  assert.ok(r1.ok, r1.why);
  assert.equal(fitEffect(state.yard, 'bass').trollMotor, 'troll');
  const r2 = fitBoat(state, 'bass', 'trollgps');
  assert.ok(r2.ok && r2.swapped === 'troll', 'the GPS motor replaces the basic one');
  assert.equal(fitEffect(state.yard, 'bass').trollMotor, 'trollgps');
  assert.equal(fitEffect(state.yard, 'bass').trollBank, false);
  fitBoat(state, 'bass', 'trollbank');
  assert.equal(fitEffect(state.yard, 'bass').trollBank, true);
  assert.equal(new TrollMotor('trollgps', { bank: true }).wh, new TrollMotor('trollgps').wh * 2);
  // Each boat's trolling battery is kept in the save (a save from before them: full when first used).
  const f = cleanFuel({ troll: { bass: 0.42, console: 2, nowhere: 0.5 } });
  assert.equal(f.troll.bass, 0.42);
  assert.equal(f.troll.console, 1, 'held to a full battery');
  assert.equal(f.troll.nowhere, undefined);
  assert.deepEqual(cleanFuel({}).troll, {});
});
