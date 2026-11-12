// Marine physics C6a (docs/IMPROVEMENTS.md): water in her (flooding.js; boat.js flood and
// waterForces): in only by a way in (a breach below her waterline, a sea over her gunwale, the rain),
// out by her pump and your bailing; its weight where it lies, run to her low side; a flooded engine
// room stops her engines; swamped, she floats. On Relaxed, never past a third.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat, HULLS } = await import('../src/boat.js');
const { newEngine, blocker } = await import('../src/engine.js');
const DM = await import('../src/damage.js');
const FL = await import('../src/flooding.js');

const scene = new THREE.Scene();

test('her compartments as her builder divided them, each sized from her hull; water in by its own laws', () => {
  assert.equal(FL.compartmentsFor('jetski', HULLS.jetski).length, 0);
  assert.equal(FL.compartmentsFor('windsurf', HULLS.windsurf).length, 0);
  const row = FL.compartmentsFor('row', HULLS.row), cab = FL.compartmentsFor('cabin', HULLS.cabin), yacht = FL.compartmentsFor('cruiser', HULLS.cruiser);
  assert.equal(row.length, 1);
  assert.ok(row[0].open && row[0].cap > 300 && row[0].cap < 3000, `the rowing boat's bilge: ${Math.round(row[0].cap)} L`);
  assert.deepEqual(cab.map((c) => c.id), ['cockpit', 'cabin']);
  assert.ok(yacht[0].engine && !yacht[1].open);
  // (Held within the water she can take and still float.)
  const held = FL.compartmentsFor('row', HULLS.row, 400);
  assert.ok(Math.abs(held[0].cap - 400) < 1e-6);
  // A hole: Torricelli, less the water inside; none above the water.
  const q = FL.breachFlow(0.003, 0.3);
  assert.ok(Math.abs(q - 0.6 * 0.003 * Math.sqrt(2 * 9.81 * 0.3) * 1000) < 1e-9);
  assert.ok(FL.breachFlow(0.003, 0.3, 0.2) < q && FL.breachFlow(0.003, -0.1) === 0 && FL.breachFlow(0.003, 0.3, 0.4) === 0);
  assert.equal(FL.holeArea(0.8), 0);
  assert.ok(FL.holeArea(1) > FL.holeArea(0.86));
  assert.ok(FL.overFlow(0.05, 1) > 10 && FL.overFlow(-0.01, 1) === 0);
  // Pumped from the fullest first; a full one spills into the next; on Relaxed, a third at most.
  const C = [{ cap: 100 }, { cap: 100 }], W = [90, 10];
  FL.stepWater(C, W, [0, 0], 20, 1);
  assert.deepEqual(W, [70, 10]);
  // (70 and 50 more: 20 over the first's sill, into the second.)
  FL.stepWater(C, W, [50, 0], 0, 1);
  assert.deepEqual(W, [100, 30]);
  const R = [0];
  FL.stepWater([{ cap: 90 }], R, [500], 0, 1, FL.MODES.relaxed);
  assert.equal(R[0], 30);
});

// Afloat in still water in the bay for `secs`, her damage kept: the water in her and how she lies.
const afloat = (kind, prep, secs = 60) => {
  const b = new Boat(scene, { kind });
  b.place(300, 900, 0);
  b.damage = DM.newDamage(DM.TUBED.has(kind));
  prep?.(b);
  const litres = [];
  for (let i = 0; i < secs * 30; i++) {
    b.update(1 / 30, i / 30, 0, 0, 0);
    if (i % 30 === 29) litres.push(b.flooding?.litres || 0);
  }
  return { b, litres, roll: (b.roll * 180) / Math.PI, y: b.phys.x[1] };
};

test('sound and dry, she floats exactly as a boat with no record kept, and takes no water in a calm', () => {
  const none = afloat('skiff', (b) => { b.damage = null; }), dry = afloat('skiff');
  assert.equal(dry.y, none.y);
  assert.equal(dry.roll, none.roll);
  assert.equal(dry.b.flooding.litres, 0);
});

test('holed below her waterline she fills, the faster the bigger the hole; a pump slows it; swamped, she floats; on Relaxed, a third at most', () => {
  const crack = afloat('skiff', (b) => { b.damage.hull.bottom = 0.86; }, 60), split = afloat('skiff', (b) => { b.damage.hull.bottom = 1; }, 60);
  assert.ok(crack.b.flooding.litres > 20 && split.b.flooding.litres > crack.b.flooding.litres * 2, `${Math.round(crack.b.flooding.litres)} L against ${Math.round(split.b.flooding.litres)} L in a minute`);
  assert.ok(split.y < crack.y, 'lower for it');
  // The bass boat's pump against the same hole: slower.
  const bare = afloat('bass', (b) => { b.damage.hull.bottom = 0.95; b.pumpPower = 0; }, 90), pumped = afloat('bass', (b) => { b.damage.hull.bottom = 0.95; }, 90);
  assert.ok(pumped.b.flooding.litres < bare.b.flooding.litres * 0.85 && pumped.b.pumpRunning);
  // Left to fill: she settles awash and the water stops coming in, the level inside meeting the sea's.
  const swamped = afloat('skiff', (b) => { b.damage.hull.bottom = 1; b.damage.hull.port = 1; }, 600);
  const L = swamped.litres, last = L[L.length - 1];
  assert.ok(last - L[L.length - 60] < 0.05 * last, 'no longer filling');
  assert.ok(swamped.y > -0.15, `afloat, awash: her centre of gravity ${swamped.y.toFixed(2)} m`);
  // Relaxed: never past a third.
  const relaxed = afloat('skiff', (b) => { b.damage.hull.bottom = 1; b.floodMode = FL.MODES.relaxed; }, 300);
  const cap = relaxed.b.compartments()[0].cap;
  assert.ok(relaxed.b.flooding.litres <= cap / 3 + 1e-6);
});

test('loose water makes her tender: the same weight to one side heels her further', () => {
  const side = (b) => b.setLoads([{ kg: 40, p: [0.5, 0.4, 0] }]);
  const dry = afloat('skiff', (b) => { side(b); }, 15), wet = afloat('skiff', (b) => { side(b); b.damage.water = [60]; }, 15);
  assert.ok(Math.abs(wet.roll) > Math.abs(dry.roll) * 1.2, `${dry.roll.toFixed(1)}° dry, ${wet.roll.toFixed(1)}° with 60 L loose`);
  // And she's heavier for it: lower in the water.
  assert.ok(wet.y < dry.y);
});

test('a sea over her gunwale and the rain come in an open boat; her flooded engine room stops the yacht and she won’t start', () => {
  // Laid right over by a weight at her rail: the gunwale under.
  const over = afloat('row', (b) => { b.setLoads([{ kg: 260, p: [0.75, 0.55, 0] }]); }, 20);
  assert.ok(over.b.flooding.litres > 5, `${over.b.flooding.litres.toFixed(1)} L over the side`);
  const rain = afloat('row', (b) => { b.rain = 1; }, 300);
  assert.ok(rain.b.flooding.litres > 1 && rain.b.flooding.litres < 40, `${rain.b.flooding.litres.toFixed(1)} L of rain in five minutes`);
  // (The yacht's engine room past half full.)
  const said = [];
  const y = afloat('cruiser', (b) => {
    b.engine = newEngine('cruiser');
    const C = b.compartments();
    b.damage.water = C.map((c) => (c.engine ? c.cap * 0.6 : 0));
    b.pumpPower = 0;
    b.onFlood = (bt, what) => said.push(what);
  }, 3);
  assert.ok(said.includes('engine') && y.b._drowned);
  const E = newEngine('cruiser');
  E.battery = true;
  E.key = true;
  E.drowned = true;
  assert.equal(blocker(E).id, 'drowned');
});

test('the record keeps the water, the yard pumps her out, and a job on her hull drains her', () => {
  const D = DM.newDamage();
  D.water = [123.45];
  const back = DM.cleanDamage(DM.damageSave(D));
  assert.deepEqual(back.water, [123.5]);
  assert.deepEqual(DM.cleanDamage({ water: ['x', -4, 7] }).water, [0, 0, 7]);
  assert.deepEqual(DM.repairs(D, 'skiff', 300).map((r) => r.id), ['water']);
  DM.mend(D, 'water');
  assert.equal(D.water[0], 0);
  D.water = [50];
  D.hull.bottom = 0.9;
  assert.deepEqual(DM.repairs(D, 'skiff', 300).map((r) => r.id), ['hull:bottom']);
  DM.mend(D, 'hull:bottom');
  assert.equal(D.water[0], 0);
});
