// Live bait (src/livebait.js; the live baits in tackle.js; their appeal in world/ecosystem.js):
// small fish and prawns kept alive in a bait bucket or a livewell, with water that goes stale and
// is changed; the hunters want a live one more than anything dead or made; the bucket is in your
// gear and the save; a live bait taken by a fish is gone. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : typeof k === 'string' ? () => {} : undefined),
  set: () => true,
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const { seeded } = await import('../src/util.js');
Math.random = seeded(20261112);
const L = await import('../src/livebait.js');
const { TACKLE, ITEM_IDS, RODS, TERMS, defaultGear, cleanGear, currentRig, carriedItems, checkSetup } = await import('../src/tackle.js');
const { FISH, fishById } = await import('../src/fish.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { rigOf, cleanRig } = await import('../src/sharedworld.js');
const { setupsFor } = await import('../src/guide.js');

const eco = new Ecosystem(createHabitat());

test('what makes a live bait: the small fish and the shoal fish’s young, and a netted prawn, at bait sizes', () => {
  for (const [id, v] of Object.entries(L.LIVE)) {
    assert.ok(L.LIVE_BAITS.includes(v.bait), id);
    assert.ok(v.hardy > 0 && v.hardy <= 1 && v.max > 0, id);
    if (id !== 'prawn') assert.ok(fishById[id], `${id} is a fish in the water`);
    if (fishById[id]) assert.ok(v.max <= Math.max(fishById[id].size[1], 15), `${id}: up to ${v.max} cm`);
  }
  assert.equal(L.isLiveBait('sandsmelt', 12), true);
  assert.equal(L.isLiveBait('mackerel', 38), false, 'a big mackerel is supper, not bait');
  assert.equal(L.isLiveBait('seabass', 8), false);
  // The tough ones are tough: a shanny outlasts a sprat.
  assert.ok(L.LIVE.shanny.hardy > L.LIVE.sprat.hardy + 0.5);
});

test('the bucket: six in it (twelve in a livewell), the water goes stale, the weakest die first, fresh water saves them', () => {
  const B = L.newBucket();
  for (let i = 0; i < 6; i++) assert.ok(L.addLive(B, i % 2 ? 'sprat' : 'shanny', 10).ok);
  assert.equal(L.addLive(B, 'shanny', 10).ok, false, 'the bucket is full');
  assert.equal(L.addLive(B, 'shanny', 10, true).ok, true, 'a livewell takes more');
  assert.equal(L.addLive(B, 'shanny', 40, true).ok, false, 'too big');
  // Still water goes stale over some hours; in a livewell hardly at all.
  const W = L.newBucket();
  L.addLive(W, 'sprat', 10);
  L.stepBucket(W, 4, { aerated: true }, () => 1);
  assert.ok(W.water > 0.95, `livewell: ${W.water}`);
  const S = L.newBucket();
  for (let i = 0; i < 6; i++) L.addLive(S, 'sandsmelt', 10);
  L.stepBucket(S, 6, {}, () => 1);
  assert.ok(S.water > L.STALE && S.water < 0.7, `six hours: ${S.water.toFixed(2)}`);
  assert.equal(L.waterWords(S), 'going stale');
  L.stepBucket(S, 8, {}, () => 1);
  assert.ok(S.water < L.STALE && L.waterWords(S) === 'stale');
  // Stale: the sprats go before the shannies.
  const M = L.newBucket();
  for (let i = 0; i < 3; i++) { L.addLive(M, 'sprat', 10); L.addLive(M, 'shanny', 10); }
  M.water = 0.05;
  const dead = L.stepBucket(M, 0.5, {}, () => 0.3);
  assert.ok(dead.length && dead.every((f) => f.id === 'sprat'), dead.map((f) => f.id).join());
  // Fresh water, and none die.
  L.freshen(M);
  assert.equal(L.waterWords(M), 'fresh');
  assert.deepEqual(L.stepBucket(M, 0.5, {}, () => 0), []);
  // Taken for the hook: the liveliest of the kind asked for.
  const T = L.newBucket();
  L.addLive(T, 'sprat', 10);
  L.addLive(T, 'shanny', 12);
  L.addLive(T, 'prawn', 5);
  assert.equal(L.liveCount(T, 'livefish'), 2);
  assert.equal(L.takeLive(T, 'livefish').id, 'shanny');
  assert.equal(L.takeLive(T, 'liveprawn').id, 'prawn');
  assert.equal(L.takeLive(T, 'liveprawn'), null);
  assert.equal(L.liveCount(T, 'livefish'), 1);
});

test('the hunters want a live one most: a bass, a pollack and a pike before any dead bait; a carp not at all', () => {
  const at = (id) => eco.bySpecies[id][0];
  const bait = (item) => ({ item, size: TACKLE[item].size, natural: true, motion: 'slow', thick: 0.3, nearBottom: true });
  for (const id of ['seabass', 'pollack', 'pike']) {
    const a = at(id), live = eco.appeal(a, bait('livefish'));
    const dead = Math.max(eco.appeal(a, bait('strip')), eco.appeal(a, bait('worm')), eco.appeal(a, bait('prawn')));
    assert.ok(live > dead, `${id}: live ${live.toFixed(2)}, the best dead ${dead.toFixed(2)}`);
  }
  // A live prawn beats a dead one for anything that takes prawns.
  const b = at('seabass');
  assert.ok(eco.appeal(b, bait('liveprawn')) > eco.appeal(b, bait('prawn')));
  // Not for the grazers and the bottom-feeders that don't hunt.
  for (const id of ['carp', 'mullet', 'roach'].filter((x) => eco.bySpecies[x]?.length)) assert.equal(eco.appeal(at(id), bait('livefish')), 0, id);
  // On the hook it swims about by itself: still, it's still a moving bait to a fish.
  assert.ok(TACKLE.livefish.live && TACKLE.liveprawn.live);
});

test('the bucket goes with your gear: tied on only while there’s one in it, never packed, kept in the save', () => {
  const g = cleanGear(defaultGear());
  assert.deepEqual(g.bucket, L.newBucket());
  assert.ok(!ITEM_IDS.includes('livefish') && !ITEM_IDS.includes('liveprawn'), 'not something you pack');
  g.rod = 'float';
  g.rig.float = 'livefish';
  assert.notEqual(currentRig(g).item?.id, 'livefish', 'nothing in the bucket: not on the hook');
  L.addLive(g.bucket, 'sandsmelt', 11);
  assert.equal(currentRig(g).item?.id, 'livefish');
  assert.ok(carriedItems(g).includes('livefish') && !carriedItems(g).includes('liveprawn'));
  assert.deepEqual(checkSetup(RODS.float, TACKLE.livefish, TERMS[RODS.float.terms[0]]).filter((p) => p.level === 'block'), [], 'a float rod fishes it');
  // Saved and read back; nonsense dropped.
  const back = cleanGear(JSON.parse(JSON.stringify(g)));
  assert.deepEqual(back.bucket, g.bucket);
  const junk = cleanGear({ ...g, pack: { ...g.pack, items: [...g.pack.items, 'livefish'] }, bucket: { fish: [{ id: 'shark', size: 3 }, { id: 'sprat', size: 99 }, { id: 'prawn', size: 4 }], water: 7 } });
  assert.deepEqual(junk.bucket, { fish: [{ id: 'prawn', size: 4 }], water: 1 });
  assert.ok(!junk.pack.items.includes('livefish'));
  // The guide doesn't send you to a bait you can't buy.
  for (const id of ['seabass', 'pike']) assert.ok(setupsFor(fishById[id]).every((s) => !TACKLE[s.item]?.live), id);
  // Play together: a guest's live bait reaches the host as it is.
  const b = { x: 1, y: -1, z: 2, kind: 'float', item: 'livefish', size: 2.5, motion: 'slow', thick: 0.3, natural: true, hook: 2 };
  assert.equal(cleanRig(rigOf(b)).item, 'livefish');
});
