// Micro-fishing (src/smallFish.js, the micro float rod and its tackle in src/tackle.js, the bait
// rules in world/ecosystem.js): the coast's small fish are real fish in the shared water, living
// where they really do, at their real sizes; they take a scrap of worm on a size 18 hook (and peck a
// bait off a big hook without taking it in); big fish mostly leave a scrap that small alone; the
// field guide sends you to the micro rod for them; they're in the journal's tree and the register;
// they go back; and in play together the host hears a guest's hook size.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : typeof k === 'string' ? () => {} : undefined),
  set: () => true,
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const { seeded } = await import('../src/util.js');
Math.random = seeded(20261111);

const { FISH, fishById, weightOf } = await import('../src/fish.js');
const { SMALL } = await import('../src/smallFish.js');
const { RODS, TACKLE, TERMS, SETUPS, checkSetup } = await import('../src/tackle.js');
const { setupsFor } = await import('../src/guide.js');
const { registerFor, FRESHWATER } = await import('../src/register.js');
const T = await import('../src/taxonomy.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { newFight, swingLimit, signatureOf } = await import('../src/fight.js');
const { rigOf, cleanRig } = await import('../src/sharedworld.js');
const { HAVEN_QUAY, QUAY } = await import('../src/world/terrain.js');
const { fishWithGuide } = await import('../tools/ecosim.mjs?nomain');

const IDS = ['rockgoby', 'shanny', 'corkwing', 'blackgoby', 'minnow'];
const habitat = createHabitat();
const eco = new Ecosystem(habitat);

test('the coast’s small fish: real species, at their real sizes, in the journal’s tree, every one released', () => {
  assert.deepEqual(SMALL.map((f) => f.id), IDS);
  for (const id of IDS) {
    const sp = fishById[id];
    assert.ok(sp && sp.life.micro, `${id} is in the water, as a small fish`);
    // No bigger than the research says it grows.
    const max = registerFor(id)?.size?.max ?? { minnow: 14 }[id];
    assert.ok(sp.size[1] <= max, `${id}: up to ${sp.size[1]} cm (the research: ${max})`);
    assert.ok(sp.size[0] >= 4 && sp.size[1] <= 25, id);
    assert.ok(weightOf(sp, sp.size[1]) < 0.3, `${id}: a big one is still a few grams`);
    // Released, and the card says why.
    assert.ok(!sp.meal && sp.keep.length > 20, `${id}: goes back`);
    // In the tree, with a family and an order (the gobies and the blenny in orders of their own).
    const e = T.species().find((x) => x.key === `fish:${id}`);
    assert.ok(e && T.FAMILIES[e.family] && T.ORDERS[e.order], `${id}: in the tree`);
    assert.ok(e.sci && e.iucn, `${id}: binomial and status`);
  }
  const at = (id) => T.species().find((x) => x.key === `fish:${id}`);
  assert.deepEqual([at('rockgoby').family, at('rockgoby').order], ['Gobiidae', 'gobiiformes']);
  assert.deepEqual([at('shanny').family, at('shanny').order], ['Blenniidae', 'blenniiformes']);
  assert.equal(at('corkwing').family, 'Labridae');
  assert.equal(at('minnow').family, 'Leuciscidae');
  // The sea fish are researched register entries now marked catchable; the minnow a fresh water fish.
  for (const id of ['rockgoby', 'shanny', 'corkwing', 'blackgoby']) assert.equal(registerFor(id).status, 'catchable', id);
  assert.equal(registerFor('shanny').scientific, 'Lipophrys pholis');
  assert.equal(FRESHWATER.minnow.scientific, 'Phoxinus phoxinus');
});

test('they live where you’d look for them, and every fish already in the water keeps its place', () => {
  const near = (a, P, r) => Math.hypot(a.home.x - P.x, a.home.z - P.z) < r;
  const n = (id) => eco.bySpecies[id]?.length ?? 0;
  for (const id of IDS) assert.ok(n(id) >= 10, `${id}: ${n(id)} in the water`);
  // Rock gobies, shannies and corkwing at the foot of the Willowhaven quay; shannies and black
  // gobies at Wend Quay, in the estuary; black gobies in the eelgrass; minnows in the stream pools.
  const haven = { x: (HAVEN_QUAY.x0 + HAVEN_QUAY.x1) / 2, z: (HAVEN_QUAY.z0 + HAVEN_QUAY.z1) / 2 };
  for (const id of ['rockgoby', 'shanny', 'corkwing']) assert.ok(eco.bySpecies[id].some((a) => near(a, haven, 14)), `${id} by the Willowhaven quay`);
  const wend = { x: (QUAY.x0 + QUAY.x1) / 2, z: (QUAY.z0 + QUAY.z1) / 2 };
  assert.ok(eco.bySpecies.blackgoby.some((a) => near(a, wend, 14)) && eco.bySpecies.blackgoby.some((a) => a.home.tag === 'eelgrass'));
  assert.ok(eco.bySpecies.blackgoby.every((a) => a.home.zone === 'estuary'), 'black gobies only in the estuary');
  assert.ok(eco.bySpecies.minnow.every((a) => a.home.type === 'pool' && ['stream', 'river'].includes(a.home.zone)), 'minnows in the stream pools');
  // All in shallow water, near the shore or a wall, never out in the deep.
  for (const id of IDS) for (const a of eco.bySpecies[id]) assert.ok(a.home.depth < 6, `${id} at ${a.home.depth.toFixed(1)} m`);
  // Added after every other fish: each one's id is past every fish that was there before.
  const firstSmall = eco.agents.findIndex((a) => a.sp.life.micro);
  assert.ok(firstSmall > 4000 && eco.agents.slice(firstSmall).every((a) => a.sp.life.micro), 'the small fish last of all');
  assert.ok(eco.agents.every((a, i) => a.id === i));
});

test('a scrap of worm on a size 18 hook for them; a big hook barely hooks them; big fish mostly leave the scrap', () => {
  const bait = (item, hook) => ({ item, size: TACKLE[item].size, natural: TACKLE[item].type === 'bait', hook, motion: 'still', thick: 0.2 });
  const goby = eco.bySpecies.rockgoby[0], bass = eco.bySpecies.seabass[0], roach = eco.bySpecies.roach[0];
  const small = eco.appeal(goby, bait('wormpiece', 18));
  assert.ok(small > 0.5, `a goby and a worm piece: ${small.toFixed(2)}`);
  assert.ok(eco.appeal(goby, bait('wormpiece', 2)) < small * 0.35, 'on a size 2 sea hook, it only pecks');
  // A whole worm on a size 12 is more than a goby's mouth can manage.
  assert.ok(eco.appeal(goby, bait('worm', 12)) < small * 0.5, 'a whole worm is too much');
  // A big bass: a whole ragworm tempts it; a scrap of worm hardly does.
  const bw = eco.appeal(bass, bait('rag', 2)), bs = eco.appeal(bass, bait('wormpiece', 18));
  assert.ok(bs > 0 && bs < bw * 0.45, `the bass: ragworm ${bw.toFixed(2)}, scrap ${bs.toFixed(2)}`);
  // A roach doesn't list worm pieces, but takes them as it takes worms and maggots.
  assert.ok(eco.appeal(roach, bait('wormpiece', 18)) > 0, 'a roach takes a scrap of worm');
});

test('the micro float rod, its micro float and worm pieces: a setup that works, and the guide’s first choice for them', () => {
  const rod = RODS.micro;
  assert.ok(rod && rod.kind === 'float' && rod.micro && rod.terms.includes('micro'));
  assert.ok(rod.lines.every((l) => l.kg < 1.5), 'gossamer line');
  assert.equal(TERMS.micro.hook, 18);
  assert.deepEqual(checkSetup(rod, TACKLE.wormpiece, TERMS.micro), []);
  assert.deepEqual(checkSetup(RODS.trout, TACKLE.microjig, TERMS.none).filter((p) => p.level === 'block'), [], 'the micro jig on the light rod');
  const S = SETUPS.find((s) => s.id === 'micro');
  assert.ok(S && S.rod === 'micro' && S.rig.micro === 'wormpiece');
  for (const id of IDS) {
    const first = setupsFor(fishById[id])[0];
    assert.equal(first.rod, 'micro', `${id}: ${first.rod}/${first.item}`);
    assert.ok(['wormpiece', 'maggot'].includes(first.item), `${id}: ${first.item}`);
  }
  // And nothing bigger is sent to the micro rod first.
  for (const id of ['seabass', 'mullet', 'roach', 'perch', 'sandsmelt']) assert.notEqual(setupsFor(fishById[id])[0].rod, 'micro', id);
});

test('a minnow bites in a stream pool on the guide’s choice (headless ecosystem)', () => {
  let r = fishWithGuide(eco, 'minnow');
  if (!r.hits) r = fishWithGuide(eco, 'minnow', { homes: [1, 3, 5], tries: 3 });
  assert.ok(r.hits > 0, r.results.join(', '));
});

test('the fight: a goby on 2 lb line is swung in, darting for its crevice, with no big-fish moves to name', () => {
  const sp = fishById.rockgoby, rod = { ...RODS.micro, line: RODS.micro.lines[1] };
  const F = newFight(sp, 11, rod, { force: 1, tire: 1, slack: 1 }, true, seeded(4));
  assert.ok(F && Number.isFinite(F.force) && F.force < 0.2, `pulls ${F.force} kg`);
  assert.ok(weightOf(sp, 11) < swingLimit(rod.line), 'light enough to swing in');
  for (const id of IDS) assert.deepEqual(signatureOf(fishById[id]), [], id);
});

test('play together: a guest’s hook size reaches the host, and nothing odd gets through', () => {
  const b = { x: 1, y: -1, z: 2, kind: 'float', item: 'wormpiece', size: 0.5, motion: 'still', thick: 0.2, natural: true, hook: 18 };
  assert.equal(cleanRig(rigOf(b)).hook, 18);
  assert.equal(cleanRig({ ...rigOf(b), hook: 'big' }).hook, null);
  assert.equal(cleanRig({ ...rigOf(b), hook: 900 }).hook, null);
  // (An older guest that says nothing about its hook: none, as before.)
  const old = rigOf(b);
  delete old.hook;
  assert.equal(cleanRig(old).hook, null);
});
