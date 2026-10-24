// The backpack's pictures (src/gearArt.js): every rod, reel, line, rig, leader, bait, lure, fly
// and jig in the game has its own model, built from the game's tackle data by id, and pieces
// that should look different do. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Spool labels and cork are painted on canvases: a do-nothing canvas is enough here.
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : typeof k === 'string' ? () => {} : undefined),
  set: () => true,
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const THREE = await import('three');
const { buildGear, reelOf, disposeGear } = await import('../src/gearArt.js');
const { RODS, TACKLE, TERMS, ROD_IDS, ITEM_IDS } = await import('../src/tackle.js');

const size = (object) => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
const meshes = (object) => {
  let n = 0;
  object.traverse((o) => { if (o.isMesh) n++; });
  return n;
};
function sound(ref, opts) {
  const { object } = buildGear(ref, opts);
  const s = size(object);
  assert.ok(meshes(object) > 0, `${JSON.stringify(ref)} has no model`);
  assert.ok([s.x, s.y, s.z].every((v) => Number.isFinite(v) && v > 0), `${JSON.stringify(ref)} has a broken shape`);
  disposeGear(object);
  return s;
}

test('every piece of tackle in the game has a model', () => {
  for (const id of ROD_IDS) {
    sound({ type: 'rod', id });
    sound({ type: 'rod', id }, { closeUp: true });
    sound({ type: 'reel', id: 'reel', rod: id });
    for (const l of RODS[id].lines) sound({ type: 'line', id: l.id, rod: id });
  }
  for (const id of Object.keys(TERMS)) sound({ type: 'term', id });
  for (const id of ITEM_IDS) sound({ type: 'item', id });
});

test('each rod is drawn at its own length, with the reel its data names', () => {
  for (const id of ROD_IDS) {
    const s = sound({ type: 'rod', id });
    assert.ok(Math.abs(s.x - RODS[id].look.len) < 0.1, `${id}: ${s.x} m long, data says ${RODS[id].look.len}`);
  }
  assert.equal(reelOf(RODS.fly).type, 'fly');
  assert.equal(reelOf(RODS.boat).type, 'multiplier');
  assert.equal(reelOf(RODS.carp).type, 'bigpit');
  assert.equal(reelOf(RODS.float).type, 'spin');
});

test('look-alikes look different: the deep crankbait has the longer lip, the big jig is bigger', () => {
  const shallow = sound({ type: 'item', id: 'crankS' }), deep = sound({ type: 'item', id: 'crankD' });
  assert.ok(deep.x > shallow.x + 0.01, 'the deep diver reaches further forward with its long lip');
  assert.ok(sound({ type: 'item', id: 'egi30' }).x > sound({ type: 'item', id: 'egi18' }).x);
  assert.ok(sound({ type: 'item', id: 'mjig' }).x > sound({ type: 'item', id: 'metal' }).x);
});
