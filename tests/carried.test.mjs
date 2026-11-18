// The tender carried on her mother's swim platform (L5 of docs/LIVEABOARD.md): one place at a time
// for every boat of yours (whereIs), the carried slot cleaned and its conflicts settled the same way
// every time, kept by the save, the trawler coming with her tender, and where she rides on her.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const K = await import('../src/carried.js');
const { parseSave, SAVE_VERSION } = await import('../src/save.js');
const Y = await import('../src/shipyard.js');
const { Boat } = await import('../src/boat.js');
const VESSELS = Object.keys((await import('../src/vessels.js')).VESSELS);
// (Laid up: every boat but these, as a real save has it.)
const allBut = (...afloat) => VESSELS.filter((k) => !afloat.includes(k));

const load = (data) => parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 2, hour: 10, ...data } })).state;

test('one place at a time: carried, on the trailer, on the ship, laid up, or afloat', () => {
  const S = { carried: { tender: 'trawler' }, trailer: { boat: 'skiff' }, shipping: [{ kind: 'rib', to: 'south', due: 9 }], stored: ['cabin', 'tender'] };
  assert.equal(K.whereIs('tender', S), 'carried', 'carried before anything else');
  assert.equal(K.whereIs('skiff', S), 'trailer');
  assert.equal(K.whereIs('rib', S), 'shipping');
  assert.equal(K.whereIs('cabin', S), 'stored');
  assert.equal(K.whereIs('row', S), 'afloat');
  assert.equal(K.carriedOn(S, 'trawler'), 'tender');
  assert.equal(K.carriedOn(S, 'cruiser'), null);
});

test('the carried slot made sensible: a tender of yours on a mother of yours, one to a platform', () => {
  const owned = ['tender', 'tender~2', 'trawler', 'rib'];
  assert.deepEqual(K.cleanCarried({ tender: 'trawler' }, owned), { tender: 'trawler' });
  // Not a tender, not a mother, not yours, two on one platform, junk: left out.
  assert.deepEqual(K.cleanCarried({ rib: 'trawler' }, owned), {});
  assert.deepEqual(K.cleanCarried({ tender: 'rib' }, owned), {});
  assert.deepEqual(K.cleanCarried({ tender: 'trawler' }, ['tender']), {}, 'her mother not yours');
  assert.deepEqual(K.cleanCarried({ tender: 'trawler', 'tender~2': 'trawler' }, owned), { tender: 'trawler' });
  for (const junk of [null, 3, 'tender', ['tender'], { tender: 7 }, { '../x': 'trawler' }]) assert.deepEqual(K.cleanCarried(junk, owned), {});
});

test('conflicts settled the same way every time (carried, then afloat, then laid up), each said, and nothing lost', () => {
  const S = { carried: { tender: 'trawler' }, trailer: { boat: 'tender' }, shipping: [{ kind: 'tender', to: 'home', due: 3 }], stored: ['tender', 'cabin'] };
  const said = K.settle(S);
  assert.equal(S.trailer.boat, null);
  assert.equal(S.shipping.length, 0);
  assert.deepEqual(S.stored, ['cabin']);
  assert.equal(said.length, 3);
  // A tender whose mother is gone: laid up.
  const L = { carried: {}, stored: ['cabin'], trailer: { boat: null } };
  assert.equal(K.settle(L, ['tender']).length, 1);
  assert.deepEqual(L.stored, ['cabin', 'tender']);
});

test('kept by the save: carried stays carried, never laid up as well; her mother gone, she\'s laid up', () => {
  const owned = ['row', 'skiff', 'kayak', 'trawler', 'tender'];
  const s = load({ yard: { owned }, carried: { tender: 'trawler' }, stored: [...allBut('row', 'skiff', 'trawler')], trailer: { hitched: false, boat: 'tender' } });
  assert.deepEqual(s.carried, { tender: 'trawler' });
  assert.ok(Array.isArray(s.stored) && !s.stored.includes('tender') && s.stored.includes('kayak'), JSON.stringify(s.stored));
  assert.equal(s.trailer.boat, null);
  // The trawler not yours any more: her tender's laid up, not lost.
  const t = load({ yard: { owned: ['row', 'skiff', 'kayak', 'tender'] }, carried: { tender: 'trawler' }, stored: allBut('row', 'skiff', 'tender'), boats: Object.fromEntries(VESSELS.map((k) => [k, { x: 0, z: 0, heading: 0 }])) });
  assert.deepEqual(t.carried, {});
  assert.ok(t.stored.includes('tender'), JSON.stringify(t.stored));
  // An older save, with none: none.
  assert.deepEqual(load({}).carried, {});
});

test('the trawler comes with her tender, if you have none of your own', () => {
  const st = { day: 3, hour: 9, money: 20000, yard: { owned: ['row', 'skiff', 'kayak'], vessels: {}, looks: {}, hired: null } };
  const r = Y.buyBoat(st, 'trawler');
  assert.ok(r.ok && r.tender === 'tender');
  assert.ok(st.yard.owned.includes('tender') && st.yard.vessels.tender, 'yours, with her papers');
  assert.equal(st.money, 20000 - Y.PRICES.trawler, 'for the trawler\'s price alone');
  // With a tender of your own already: just the trawler.
  const st2 = { day: 3, hour: 9, money: 20000, yard: { owned: ['row', 'skiff', 'kayak', 'tender'], vessels: {}, looks: {}, hired: null } };
  const r2 = Y.buyBoat(st2, 'trawler');
  assert.ok(r2.ok && !r2.tender);
  assert.equal(st2.yard.owned.filter((k) => k === 'tender').length, 1);
});

test('where she rides: athwart the trawler\'s platform on its chocks, above the water; no other boat has them', () => {
  const scene = new THREE.Scene(), T = new Boat(scene, { kind: 'trawler' }), R = new Boat(scene, { kind: 'rib' });
  const [x, y, z] = T.chocksAt();
  assert.equal(x, 0);
  assert.ok(z < -T.hull.L / 2 && z > -T.hull.L / 2 - T.hull.aft, 'on her platform, past her transom');
  assert.ok(y > T.hull.draft + 0.3, 'clear of the water');
  assert.equal(R.chocksAt(), null);
  // The tender fits across it: her length over her tubes within the platform's width.
  const tender = new Boat(scene, { kind: 'tender' });
  assert.ok(tender.hull.L + 2 * (tender.hull.tubes?.r || 0) < 3.7);
  // Her weight there trims the trawler by the stern (a load aft of her middle).
  T.place(0, 2300, 0);
  T.setLoads([{ what: 'tender', kg: 165, p: T.chocksAt(0.35) }]);
  assert.ok(T.payload === 165 && T.loads[0].p[2] < 0);
});
