// Fuel: the car and the petrol boats burn it, the rowing boat and the kayak never do, the bass
// boat's electric motor has a battery; pumps and the jerry can fill things up; running dry costs
// time, never the trip. And the cabin boat: where it lies, and that it floats and moves.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const Fu = await import('../src/fuel.js');
const { DEST_IDS } = await import('../src/outing.js');
const { Boat, BOAT_KINDS } = await import('../src/boat.js');
const { HAVEN_QUAY, CABIN_BERTH, FUEL_PUMPS, walkHeight, heightAt } = await import('../src/world/terrain.js');

let loads = 0;
const freshSave = () => import(`../src/save.js?fuel=${++loads}`);

test('a save without fuel starts full, and odd values are made safe', () => {
  const d = Fu.cleanFuel(undefined);
  assert.equal(d.car, Fu.TANKS.car);
  for (const k of Fu.PETROL) assert.equal(d.boats[k], Fu.TANKS[k]);
  assert.equal(d.battery, 1);
  assert.deepEqual(d.can, { at: 'home', litres: Fu.CAN });
  const odd = Fu.cleanFuel({ car: -4, boats: { skiff: 999, bass: 'lots', row: 5 }, battery: 7, can: { at: 'moon', litres: 3 } });
  assert.equal(odd.car, 0);
  assert.equal(odd.boats.skiff, Fu.TANKS.skiff);
  assert.equal(odd.boats.bass, Fu.TANKS.bass);
  assert.equal(odd.boats.row, undefined, 'the rowing boat has no tank');
  assert.equal(odd.battery, 1);
  assert.deepEqual(odd.can, { at: 'home', litres: 3 });
});

test('the fuel keeps with the save', async () => {
  globalThis.localStorage = new MemoryStorage();
  const S = await freshSave();
  const s = S.loadGame().state;
  s.fuel.car = 12.5;
  s.fuel.boats.cabin = 3;
  s.fuel.can = { at: 'car', litres: 7 };
  s.boats.cabin = { x: 14, z: -86, heading: 0, anchored: true };
  s.vessel = 'cabin';
  assert.ok(S.saveGame(s));
  const back = (await freshSave()).loadGame().state;
  assert.equal(back.fuel.car, 12.5);
  assert.equal(back.fuel.boats.cabin, 3);
  assert.deepEqual(back.fuel.can, { at: 'car', litres: 7 });
  assert.equal(back.vessel, 'cabin');
  assert.equal(back.boats.cabin.x, 14);
});

test('the car burns by the metre and by the minute; a full tank does every trip there and back', () => {
  const f = Fu.defaultFuel();
  assert.equal(Fu.burnCar(f, 100), false);
  assert.ok(Math.abs(f.car - (Fu.TANKS.car - 100 * Fu.CAR_PER_M)) < 1e-9);
  for (const id of DEST_IDS) {
    const there = Fu.carNeeds('home', id), back = Fu.carNeeds(id, 'home');
    assert.ok(there > 0 && there + back < Fu.TANKS.car, `${id}: ${there} L there, ${back} L back`);
  }
  // Running the tank dry: true once, at the moment it happens.
  f.car = 0.01;
  assert.equal(Fu.burnCar(f, 10), true);
  assert.equal(f.car, 0);
  assert.equal(Fu.burnCar(f, 10), false);
});

test('a drive that goes by uses its fuel, and short of it costs an hour, never the trip', () => {
  const f = Fu.defaultFuel();
  const r = Fu.driveBy(f, 'home', 'quay');
  assert.equal(r.short, false);
  assert.ok(Math.abs(f.car - (Fu.TANKS.car - r.need)) < 0.11);
  f.car = 1;
  const s = Fu.driveBy(f, 'quay', 'home');
  assert.equal(s.short, true);
  assert.equal(s.hours, Fu.RESCUE.hours);
  assert.ok(f.car >= 2, 'you arrive with something in the tank');
});

test('only the motorboats burn petrol; the electric motor runs on its battery', () => {
  const f = Fu.defaultFuel();
  assert.equal(Fu.burnBoat(f, 'row', 1, 10), null);
  assert.equal(Fu.burnBoat(f, 'kayak', 1, 10), null);
  Fu.burnBoat(f, 'skiff', 1, 10);
  assert.ok(Math.abs(f.boats.skiff - (Fu.TANKS.skiff - 10 * Fu.BOAT_PER_S.skiff)) < 1e-9);
  // The bass boat: the first notches (up to its troll) run the battery, above them the outboard.
  const troll = 0.3;
  Fu.burnBoat(f, 'bass', 0.3, 10, troll);
  assert.ok(f.battery < 1 && f.boats.bass === Fu.TANKS.bass);
  Fu.burnBoat(f, 'bass', 0.8, 10, troll);
  assert.ok(f.boats.bass < Fu.TANKS.bass);
  // Flat and dry come back as words, once.
  f.battery = 0.0001;
  assert.equal(Fu.burnBoat(f, 'bass', 0.3, 1, troll), 'flat');
  f.boats.skiff = 0.0001;
  assert.equal(Fu.burnBoat(f, 'skiff', 1, 1), 'dry');
  assert.equal(Fu.burnBoat(f, 'skiff', 1, 1), null);
  // A full skiff runs a good quarter of an hour flat out.
  assert.ok(Fu.TANKS.skiff / Fu.BOAT_PER_S.skiff > 15 * 60);
  // The battery charges by the hour at a jetty, and never past full.
  f.battery = 0.2;
  Fu.chargeBattery(f, 1);
  assert.ok(Math.abs(f.battery - (0.2 + Fu.BATTERY_PER_HOUR)) < 1e-9);
  Fu.chargeBattery(f, 10);
  assert.equal(f.battery, 1);
});

test('pumps fill tanks and the can; the can pours what fits; help gives a can’s worth', () => {
  const f = Fu.defaultFuel();
  f.car = 5;
  f.can.litres = 2;
  assert.equal(Fu.fill(f, 'car'), Fu.TANKS.car - 5);
  assert.equal(Fu.fill(f, 'can'), Fu.CAN - 2);
  assert.equal(f.can.litres, Fu.CAN);
  f.car = Fu.TANKS.car - 3;
  assert.equal(Fu.pour(f, 'car'), 3, 'only what fits');
  assert.equal(f.can.litres, Fu.CAN - 3);
  f.boats.bass = 0;
  assert.equal(Fu.pour(f, 'bass'), Fu.CAN - 3);
  assert.equal(f.can.litres, 0);
  assert.equal(Fu.pour(f, 'bass'), 0, 'an empty can pours nothing');
  f.boats.skiff = 0;
  assert.equal(Fu.rescue(f, 'skiff'), Fu.RESCUE.hours);
  assert.equal(f.boats.skiff, Fu.RESCUE.boat);
  assert.equal(Fu.moveCan(f, 'pack').ok, true);
  assert.equal(Fu.moveCan(f, 'boat').ok, false);
  assert.equal(f.can.at, 'pack');
});

test('the packing list says whether the tank will do', () => {
  const f = Fu.defaultFuel();
  assert.equal(Fu.fuelCheck(f, 'home', 'quay')[0].level, 'ok');
  f.car = Fu.carNeeds('home', 'quay') + 1;
  assert.equal(Fu.fuelCheck(f, 'home', 'quay')[0].level, 'info');
  // (With the can along, a little short is enough.)
  f.can.at = 'car';
  f.car = Fu.carNeeds('home', 'quay') + 3;
  assert.match(Fu.fuelCheck(f, 'home', 'quay')[0].text, /jerry can with you/);
  f.car = 1;
  assert.equal(Fu.fuelCheck(f, 'home', 'quay')[0].level, 'warn');
});

test('the pumps stand on firm ground you can walk up to', () => {
  for (const [id, P] of Object.entries(FUEL_PUMPS)) {
    assert.ok(walkHeight(P.x, P.z) > 1, id);
    const front = { x: P.x + Math.sin(P.yaw) * 1.4, z: P.z + Math.cos(P.yaw) * 1.4 };
    assert.ok(Math.abs(walkHeight(front.x, front.z) - walkHeight(P.x, P.z)) < 0.3, `${id}: level in front of it`);
  }
});

test('the cabin boat: a sixth hull, deep enough at its berth by the quay, and slower than the skiff', () => {
  assert.ok(BOAT_KINDS.includes('cabin'));
  const scene = new THREE.Scene();
  const cabin = new Boat(scene, { kind: 'cabin' }), skiff = new Boat(scene, { kind: 'skiff' });
  assert.equal(cabin.motor, true);
  assert.ok(cabin.hull.cabin);
  // Its berth: alongside Willowhaven quay, in water deep enough for its hull, bow to stern.
  const B = CABIN_BERTH;
  assert.ok(B.x > HAVEN_QUAY.x1 && B.x < HAVEN_QUAY.x1 + 4 && B.z > HAVEN_QUAY.z0 && B.z < HAVEN_QUAY.z1, 'alongside the quay');
  for (const k of [-3.1, 0, 3.1]) assert.ok(heightAt(B.x, B.z + k) < -(cabin.hull.draft + 0.4), `deep enough ${k} m along`);
  // Full ahead for a while, on calm water: the cabin boat is the slower of the two.
  const top = (b) => {
    b.place(0, 40, 0);
    for (let i = 0; i < 600; i++) b.update(1 / 30, i / 30, 1, 0, 0);
    return b.forwardSpeed;
  };
  const vc = top(cabin), vs = top(skiff);
  assert.ok(vc > 3 && vc < vs, `cabin ${vc.toFixed(2)} m/s, skiff ${vs.toFixed(2)} m/s`);
  // Dry, an oar still moves it: slowly, but never stuck.
  cabin.dry = true;
  const vo = top(cabin);
  assert.ok(vo > 0.8 && vo < vc / 2, `oar ${vo.toFixed(2)} m/s`);
});
