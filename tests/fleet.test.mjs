// Your boats ashore and afloat (fleet.js), your own finger of Willowhaven's pontoon, the visitors'
// row and the harbour office (terrain.js, coast.js). Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const FL = await import('../src/fleet.js');
const T = await import('../src/world/terrain.js');
const M = await import('../src/mooring.js');
const { Boat, BOAT_KINDS } = await import('../src/boat.js');
const { parseSave, SAVE_VERSION } = await import('../src/save.js');
const { buildCoast } = await import('../src/world/coast.js');
const { seeded } = await import('../src/util.js');

const scene = new THREE.Scene();
const boats = Object.fromEntries(BOAT_KINDS.map((k) => [k, new Boat(scene, { kind: k })]));
const LENGTHS = Object.fromEntries(BOAT_KINDS.map((k) => [k, boats[k].hull.L]));
const BEAMS = Object.fromEntries(BOAT_KINDS.map((k) => [k, boats[k].hull.B]));
const HARBOUR = BOAT_KINDS.filter((k) => FL.homeOf(k) === 'harbour');

test('three of your boats in the water at most: a new game has the camp’s, an older one keeps the three you’d want', () => {
  assert.equal(FL.MAX_AFLOAT, 3);
  assert.deepEqual(FL.NEW_AFLOAT, ['row', 'skiff', 'kayak']);
  for (const k of BOAT_KINDS) assert.ok(['harbour', 'camp', 'lake'].includes(FL.homeOf(k)), k);
  // The boat you were in first, then ones you'd left out somewhere, then the most useful.
  assert.deepEqual(FL.chooseAfloat(BOAT_KINDS, { vessel: 'cruiser' }), ['cruiser', 'skiff', 'row']);
  assert.deepEqual(FL.chooseAfloat(BOAT_KINDS, { vessel: 'jetski', away: ['sail', 'kayak'] }), ['jetski', 'sail', 'kayak']);
  assert.equal(FL.chooseAfloat(BOAT_KINDS, {}).length, 3);
  // A stored list kept only if it leaves between one and three in the water.
  assert.equal(FL.cleanStored(null, BOAT_KINDS), null);
  assert.equal(FL.cleanStored(['row'], BOAT_KINDS), null, 'nine afloat: not allowed');
  assert.equal(FL.cleanStored(BOAT_KINDS, BOAT_KINDS), null, 'none afloat: not allowed');
  const ok = BOAT_KINDS.filter((k) => !['row', 'skiff', 'console'].includes(k));
  assert.deepEqual(FL.cleanStored([...ok, 'nonsense', ok[0]], BOAT_KINDS), ok);
});

test('the save keeps which boats are laid up; an older save has it decided when it loads', () => {
  const stored = BOAT_KINDS.filter((k) => !['row', 'cabin', 'console'].includes(k));
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 2, hour: 10, stored } })).state;
  assert.deepEqual(s.stored, stored);
  const old = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 2, hour: 10 } })).state;
  assert.equal(old.stored, null);
});

test('your finger: any three of the Willowhaven boats lie alongside it at once, clear of each other, in deep water', () => {
  const F = T.OWN_FINGER;
  assert.ok(T.HAVEN_FINGERS.includes(F) && T.PIERS.includes(F));
  const sets = [];
  for (let i = 0; i < HARBOUR.length; i++) for (let j = i + 1; j < HARBOUR.length; j++) for (let k = j + 1; k < HARBOUR.length; k++) sets.push([HARBOUR[i], HARBOUR[j], HARBOUR[k]]);
  for (const set of sets) {
    const B = FL.ownBerths(F, set, LENGTHS, BEAMS);
    assert.deepEqual(Object.keys(B).sort(), [...set].sort(), `all of ${set.join(', ')} fit`);
    const placed = [];
    for (const k of set) {
      const b = B[k], h = boats[k].hull;
      // Alongside, within the finger's length, and the water deep enough under her whole length.
      assert.ok(b.x - h.L / 2 >= F.x0 && b.x + h.L / 2 <= F.x1 + 0.5, `${k} along the finger`);
      for (const u of [-0.45, 0, 0.45]) assert.ok(T.solidHeight(b.x + u * h.L, b.z) < -(h.draft + 1), `${k}: deep enough`);
      // A berth the mooring lines find, on your finger.
      const at = { hull: h, pos: { x: b.x, z: b.z }, heading: b.heading };
      const berth = M.berthFor(at, []);
      assert.ok(berth && T.PIERS[berth.pier] === F && Math.hypot(berth.x - b.x, berth.z - b.z) < 0.6, `${k}: ties up there`);
      for (const o of placed) {
        const clear = Math.abs(o.b.z - b.z) > o.h.B + h.B || Math.abs(o.b.x - b.x) > (o.h.L + h.L) / 2 + 0.5;
        assert.ok(clear, `${k} clear of the ${o.k}`);
      }
      placed.push({ k, b, h });
    }
  }
});

test('the harbour’s own boats go out round the end of the fingers, never across a berth', async () => {
  const F = await import('../src/townsfolk.js');
  const routes = [F.ROUTE_OUT, ...Object.values(F.OUTINGS).filter((O) => !O.south).map((O) => O.route)];
  for (const R of routes) {
    const L = F.pathLength(R);
    for (let s = 0; s <= L; s += 0.5) {
      const q = F.along(R, s);
      for (const P of [T.HAVEN_PONTOON, ...T.HAVEN_FINGERS]) assert.ok(!(q.x > P.x0 - 4 && q.x < P.x1 + 4 && q.z > P.z0 - 4 && q.z < P.z1 + 4), `clear of the pontoon at ${q.x.toFixed(0)}, ${q.z.toFixed(0)}`);
    }
  }
});

test('the visitors’ row at the end of the pontoon, and the harbour office at the head of the quay', () => {
  assert.equal(T.VISITOR_FINGERS.length, 2);
  for (const V of T.VISITOR_FINGERS) {
    assert.ok(T.HAVEN_FINGERS.includes(V) && V !== T.OWN_FINGER);
    // Room alongside for a visiting yacht, on the inner side at least.
    const m = (V.x0 + V.x1) / 2;
    assert.ok(T.solidHeight(m, V.z0 - 2) < -3, 'deep inside the visitors’ row');
  }
  // The office stands on the apron by the head of the quay, its hatch reachable on foot.
  const O = T.HARBOUR_OFFICE, A = T.HAVEN_APRON;
  assert.ok((O.x + O.w / 2 < T.HAVEN_QUAY.x0 || O.x - O.w / 2 > T.HAVEN_QUAY.x1) && O.z + O.d / 2 < A.z1 && O.z - O.d / 2 > A.z0 - 1, 'on the apron, clear of the quay');
  assert.ok(Object.values(T.FUEL_PUMPS).every((p) => Math.hypot(p.x - O.x, p.z - O.z) > 4), 'not crowding a fuel pump');
  const coast = buildCoast(new THREE.Scene(), seeded(20261024));
  const hatch = { x: O.x, z: O.z + O.d / 2 + 0.7 };
  assert.ok(Math.abs(T.walkHeight(hatch.x, hatch.z) - A.h) < 0.1, 'the hatch at the apron’s level');
  const blocked = coast.obstacles.filter((o) => Math.hypot(o.x - hatch.x, o.z - hatch.z) < o.r);
  assert.equal(blocked.length, 0, 'nothing in the way of standing at the hatch');
  assert.ok(coast.obstacles.some((o) => o.name === 'the harbour office'), 'you can’t walk through it');
  assert.equal(typeof coast.ownerSign, 'function');
  coast.ownerSign('Robin');
});
