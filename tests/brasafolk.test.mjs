// G9a of docs/PROGRESSION.md (item 12, harbours and people): Puerto Brasa's people beyond Paco and
// Chano (src/townsfolk.js, src/world/folk.js, src/requests.js). Nayra Cabrera, who runs the dive
// school, sanding her boat's cracked keel at the end of the waterfront, her tanks on the quay, a
// table outside the bar; Agustín, the oldest of the cofradía's fishermen, mending nets on the quay,
// out along the dique at dusk to look at the weather, then the evening with Chano. Each has a day
// round the clock and the weather, words of their own that know what you've done for the dive
// school and the cofradía, and a favour. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const F = await import('../src/townsfolk.js');
const T = await import('../src/world/terrain.js');
const Q = await import('../src/requests.js');
const { POSADA } = await import('../src/world/brasa.js');
const { buildCoast } = await import('../src/world/coast.js');
const { seeded } = await import('../src/util.js');
const { FolkView } = await import('../src/world/folk.js');
const { fishById } = await import('../src/fish.js');

const coast = buildCoast(new THREE.Scene(), seeded(20261024));
const FAIR = { storm: 0, rain: 0, wind: 5, about: [], activity: {} };
const WET = { storm: 0.1, rain: 0.8, wind: 9, about: [], activity: {} };
const GALE = { storm: 0.75, rain: 0.6, wind: 17, about: [], activity: {} };
const DAY = 5;
const block = (id, h, ctx) => F.blockFor(id, h, ctx, DAY);

test('Puerto Brasa’s people: Nayra and Agustín, at the island, with homes and places of their own there', () => {
  for (const id of ['nayra', 'agustin']) {
    assert.ok(F.FOLK[id].south, `${id}: at Las Brasas`);
    assert.ok(F.FOLK_IDS.includes(id));
  }
  assert.match(F.FOLK.nayra.role, /dive school/);
  assert.match(F.FOLK.agustin.role, /cofradía/);
  // Every place of theirs on the island's dry land (or the dique's blocks), and walked to straight.
  for (const k of ['nayraHome', 'hull', 'tanks', 'nayraTable', 'agustinHome', 'nets', 'dique', 'barTable2']) {
    const S = F.SPOTS[k];
    assert.ok(S.south, `${k}: Puerto Brasa's`);
    assert.ok(T.walkHeight(S.x, S.z) > 0.5, `${k}: ashore (${T.walkHeight(S.x, S.z).toFixed(2)} m)`);
  }
  // Nayra's boat: the first of the two pulled up at the west end of the waterfront (brasaWorld.js).
  assert.ok(Math.hypot(F.SPOTS.hull.x + 6, F.SPOTS.hull.z - 6296) < 2.5);
  // Agustín's evening chair across Chano's table, outside the bar; Nayra's at the next table.
  // (The terrace's other chair, world/folk.js: across the table from Chano's, facing him.)
  assert.ok(Math.abs(F.SPOTS.barTable2.x - (F.SPOTS.barTable.x - 1.5)) < 0.05 && Math.abs(F.SPOTS.barTable2.z - F.SPOTS.barTable.z) < 0.1);
  assert.ok(Math.abs(Math.abs(F.SPOTS.barTable2.yaw - F.SPOTS.barTable.yaw) - Math.PI) < 1e-9, 'facing Chano');
  assert.ok(Math.abs(F.SPOTS.nayraTable.x - (POSADA.x - 3)) < 1 && Math.abs(F.SPOTS.nayraTable.z - (POSADA.z + 6.2)) < 0.5);
});

test('Nayra’s day: her boat’s keel, out of the rain; her tanks on the quay; the bar at lunch and of an evening', () => {
  assert.deepEqual([block('nayra', 8, FAIR).spot, block('nayra', 8, FAIR).act], ['hull', 'work']);
  assert.deepEqual([block('nayra', 11, FAIR).spot, block('nayra', 11, FAIR).act], ['tanks', 'stand']);
  assert.deepEqual([block('nayra', 13, FAIR).spot, block('nayra', 13, FAIR).act], ['nayraTable', 'sit']);
  assert.deepEqual([block('nayra', 15, FAIR).spot, block('nayra', 15, FAIR).act], ['hull', 'work']);
  assert.deepEqual([block('nayra', 20, FAIR).spot, block('nayra', 20, FAIR).act], ['nayraTable', 'sit']);
  for (const h of [3, 18, 23]) assert.equal(block('nayra', h, FAIR).act, 'inside', `${h}:00 at home`);
  // In the rain she leaves the sanding.
  assert.deepEqual([block('nayra', 8, WET).spot, block('nayra', 8, WET).act], ['nayraHome', 'inside']);
  assert.equal(block('nayra', 11, WET).spot, 'tanks', 'her tanks don’t mind the rain');
});

test('Agustín’s day: his nets, a siesta, the dique at dusk to look at the weather, the evening with Chano', () => {
  assert.deepEqual([block('agustin', 9, FAIR).spot, block('agustin', 9, FAIR).act], ['nets', 'work']);
  assert.deepEqual([block('agustin', 9, GALE).spot, block('agustin', 9, GALE).act], ['nets', 'work'], 'every morning, whatever the weather');
  assert.equal(block('agustin', 14, FAIR).act, 'inside', 'his siesta');
  assert.equal(block('agustin', 16.5, FAIR).spot, 'nets');
  assert.equal(block('agustin', 16.5, WET).act, 'inside', 'not in the rain of an afternoon');
  assert.deepEqual([block('agustin', 18, FAIR).spot, block('agustin', 18, FAIR).act], ['dique', 'stand']);
  assert.notEqual(block('agustin', 18, GALE).spot, 'dique', 'not out on the dique in a gale');
  assert.deepEqual([block('agustin', 20, FAIR).spot, block('agustin', 20, FAIR).act], ['barTable2', 'sit']);
  assert.equal(block('chano', 20, FAIR).spot, 'barTable', 'across the table from Chano');
  assert.equal(block('agustin', 23, FAIR).act, 'inside');
});

test('out there: they walk to their places across the waterfront, can be talked to, and the bar knows about the boat', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  for (let h = 6; h < 9; h += 0.05) town.update(DAY * 24 + h, FAIR);
  const N = town.people.nayra, A = town.people.agustin;
  assert.equal(N.act, 'work');
  assert.ok(Math.hypot(N.pos.x - F.SPOTS.hull.x, N.pos.z - F.SPOTS.hull.z) < 0.3, 'at her boat');
  assert.equal(A.act, 'work');
  assert.ok(Math.hypot(A.pos.x - F.SPOTS.nets.x, A.pos.z - F.SPOTS.nets.z) < 0.3, 'at his nets');
  assert.equal(town.near(N.pos.x + 1, N.pos.z)?.id, 'nayra');
  assert.equal(town.near(A.pos.x, A.pos.z + 1)?.id, 'agustin');
  assert.ok(town.newsSouth(9).some((l) => /dive school’s boat is still up .* Nayra’s at it/.test(l)));
  // Walking to the quay for her tanks, she's on the way: straight across the open waterfront.
  for (let h = 9; h < 10.6; h += 0.02) town.update(DAY * 24 + h, FAIR);
  assert.equal(N.act, 'walk');
  for (let h = 10.6; h < 11.5; h += 0.02) town.update(DAY * 24 + h, FAIR);
  assert.equal(N.act, 'stand');
  assert.ok(Math.hypot(N.pos.x - F.SPOTS.tanks.x, N.pos.z - F.SPOTS.tanks.z) < 0.3);
  assert.ok(!town.newsSouth(11).some((l) => /dive school’s boat/.test(l)), 'not while she’s on the quay');
});

test('Agustín’s evening: the long stroll back from the dique, and a good while at Chano’s table', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  let sat = 0;
  for (let h = 16; h < 22.5; h += 0.05) {
    town.update(DAY * 24 + h, FAIR);
    if (h >= 18.5 && town.people.agustin.act === 'sit' && town.people.agustin.block?.spot === 'barTable2') sat += 0.05;
  }
  assert.ok(sat > 1.5, `sat with Chano ${sat.toFixed(1)} h of the evening`);
});

test('their words: what they’re at, and they know what you’ve done for the dive school and the cofradía', () => {
  const say = (id, act, spot, extra = {}) => F.sayTo({ id, act, block: { spot } }, extra);
  // Nayra.
  assert.match(say('nayra', 'work', 'hull'), /crack in her keel.*Two more days of sanding/);
  assert.match(say('nayra', 'work', 'hull', { rep: { buceo: 2 } }), /kept my divers going/);
  assert.match(say('nayra', 'stand', 'tanks'), /marine reserve: no anchoring/);
  assert.match(say('nayra', 'sit', 'nayraTable'), /angel sharks/);
  assert.match(say('nayra', 'sit', 'nayraTable', { rep: { buceo: 2 } }), /holding the boat over the reef/);
  // Agustín.
  assert.match(say('agustin', 'work', 'nets'), /Sixty years.*A good net, you mend/);
  assert.match(say('agustin', 'work', 'nets', { rep: { cofradia: 3 } }), /You carried our salt fish/);
  assert.match(say('agustin', 'stand', 'dique'), /trade wind’s backing/);
  assert.match(say('agustin', 'stand', 'dique', { storm: 0.6 }), /The sea’s the sea’s today/);
  assert.match(say('agustin', 'sit', 'barTable2'), /salt fish, the way my father did/);
  assert.match(say('agustin', 'sit', 'barTable2', { rep: { cofradia: 3 } }), /carried our fish to the English/);
  // (Never nothing to say, whatever they're at.)
  for (const id of ['nayra', 'agustin']) for (const act of ['walk', 'stand', 'sit', 'work']) assert.ok(say(id, act, 'tanks').length > 20, `${id} ${act}`);
});

test('a favour each: the pilot whales for Nayra’s divers, a triggerfish for Agustín’s supper', () => {
  const C = Q.requestById.calderones, G = Q.requestById.gallo;
  assert.equal(C.who, 'nayra');
  assert.equal(C.kind, 'see');
  assert.deepEqual(C.what, ['pilotwhale']);
  // Her thanks: a mark only the school knows, under the water off the Roque.
  const h = T.heightAt(C.reward.pin.x, C.reward.pin.z);
  assert.ok(h < -5 && h > -15, `Nayra’s arch, ${h.toFixed(1)} m down`);
  assert.equal(G.who, 'agustin');
  assert.equal(G.kind, 'bring');
  assert.equal(G.species, 'triggerfish');
  const sz = fishById.triggerfish.size;
  assert.ok(G.min > sz[0] && G.min < sz[1], `a fish that size exists (${sz.join('–')} cm)`);
  assert.ok(G.reward.dish?.fill > 0, 'supper with him');
  // Asked when you stop for a word, one at a time each, as everyone's are.
  const Fv = Q.newFavours();
  assert.equal(Q.offerFor('nayra', Fv, 3)?.id, 'calderones');
  assert.equal(Q.offerFor('agustin', Fv, 3)?.id, 'gallo');
});

test('the figures: each drawn at Las Brasas, not at home; Nayra sanding, Agustín mending', () => {
  const view = new FolkView(new THREE.Scene());
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  for (let h = 6; h < 9; h += 0.05) town.update(DAY * 24 + h, FAIR);
  view.update(1 / 30, 1, town, { from: { x: 10, z: -95 } });
  assert.ok(!view.figures.nayra.group.visible && !view.figures.agustin.group.visible, 'far to the south');
  view.update(1 / 30, 1, town, { from: { x: 20, z: 6295 }, south: true });
  assert.ok(view.figures.nayra.group.visible && view.figures.agustin.group.visible);
  assert.ok(Math.abs(view.figures.nayra.group.position.x - F.SPOTS.hull.x) < 0.05);
  // (Their work by where they are: the keel sanded, the nets mended, as Dougie mends his pots.)
  const src = readFileSync(new URL('../src/world/folk.js', import.meta.url), 'utf8');
  assert.match(src, /spot === 'pots' \|\| spot === 'nets' \? 'mend'/);
  assert.match(src, /spot === 'hull' \? 'sand'/);
  assert.match(src, /job === 'sand'/);
  // And the game passes your standing with each giver to what they say.
  assert.match(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /landed: town\.landed, rep: state\.contracts\.rep \|\| \{\} \}/);
});
