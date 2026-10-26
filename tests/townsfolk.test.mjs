// The harbour's people (townsfolk.js): their days round the clock and the weather, the paths they
// walk round Willowhaven (clear of the buildings and clutter), Dougie's boat going out to his pots
// off Gull Rock and coming in to land them (or staying in when it blows), Hettie going where the
// fish are, and what's said about them at the bar. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const F = await import('../src/townsfolk.js');
const T = await import('../src/world/terrain.js');
const { buildCoast } = await import('../src/world/coast.js');
const { seeded } = await import('../src/util.js');
const { FolkView } = await import('../src/world/folk.js');

const coast = buildCoast(new THREE.Scene(), seeded(20261024));
const FAIR = { storm: 0, rain: 0, wind: 5, about: [{ id: 'mackerel', name: 'Atlantic Mackerel', act: 0.9 }], activity: { mackerel: 0.9, seabass: 0.7, squid: 0.6, flounder: 0.5 } };
const STORM = { storm: 0.75, rain: 0.6, wind: 17, about: [], activity: { flounder: 0.5 } };
const DAY = 5;
const at = (town, h, ctx) => {
  town.update(DAY * 24 + h, ctx);
  return town;
};

test('the paths: every place reachable from every other, never through a building, a wall or the clutter', () => {
  const P = new F.Paths(coast.obstacles);
  const names = Object.keys(F.SPOTS).filter((k) => k !== 'strand' && k !== 'paco');
  const walls = coast.obstacles.filter((o) => o.kind === 'building' || o.kind === 'harbour');
  for (const a of names) {
    for (const b of names) {
      if (a === b) continue;
      const A = F.SPOTS[a], B = F.SPOTS[b];
      const r = P.route(A, B);
      // (Clear of everything, but for the last steps up to a door or a seat.)
      const L = F.pathLength(r);
      for (let s = 0; s <= L; s += 0.25) {
        const q = F.along(r, s);
        if (Math.hypot(q.x - A.x, q.z - A.z) < 1.4 || Math.hypot(q.x - B.x, q.z - B.z) < 1.4) continue;
        for (const o of walls) assert.ok(Math.hypot(q.x - o.x, q.z - o.z) > o.r + 0.05, `${a} → ${b} runs through ${o.name} at ${q.x.toFixed(1)}, ${q.z.toFixed(1)}`);
        assert.ok(T.walkHeight(q.x, q.z) > 0.1, `${a} → ${b} goes into the water at ${q.x.toFixed(1)}, ${q.z.toFixed(1)}`);
      }
      assert.ok(L < Math.hypot(A.x - B.x, A.z - B.z) * 3 + 6, `${a} → ${b}: ${L.toFixed(0)} m is a long way round`);
    }
  }
});

test('the Morning Star’s trip stays in water deep enough for her, out to the pots and home', () => {
  for (const L of F.tripLegs()) {
    if (!L.path) continue;
    for (let s = 0; s <= L.len; s += 1) {
      const q = F.along(L.path, s);
      const nearBerth = Math.hypot(q.x - F.MOORING.x, q.z - F.MOORING.z) < 4 || Math.hypot(q.x - F.LANDING.x, q.z - F.LANDING.z) < 4;
      assert.ok(T.heightAt(q.x, q.z) < (nearBerth ? -0.7 : -1.5), `aground at ${q.x.toFixed(0)}, ${q.z.toFixed(0)}`);
    }
  }
  for (const p of F.POTS) assert.ok(T.heightAt(p.x, p.z) < -4, 'pots in a few fathoms');
  assert.ok(F.TRIP_HOURS > 4 && F.TRIP_HOURS < 6.8, `${F.TRIP_HOURS.toFixed(1)} hours`);
});

test('a fine day: Mags at her slab, Bert in his chair, Dougie out at his pots and in to land them, Kit crabbing, Hettie after the bass at dawn', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  at(town, 3, FAIR);
  assert.equal(town.people.mags.act, 'inside');
  at(town, 6.2, FAIR);
  assert.equal(town.people.hettie.block.spot, 'strand');
  assert.equal(town.people.dougie.act, 'aboard');
  assert.ok(town.boat.aboard);
  at(town, 9, FAIR);
  assert.equal(town.people.mags.act, 'work');
  assert.ok(Math.hypot(town.people.mags.pos.x - F.SPOTS.slab.x, town.people.mags.pos.z - F.SPOTS.slab.z) < 0.1);
  assert.equal(town.people.bert.act, 'sit');
  assert.ok(Math.hypot(town.boat.x - F.MOORING.x, town.boat.z - F.MOORING.z) > 150, 'out at the pots');
  assert.ok(town.news(9).some((l) => l.includes('out at his pots')));
  // On the mackerel, she's on the end of the quay.
  assert.equal(town.people.hettie.block.spot, 'quayEnd');
  at(town, 10.8, FAIR);
  assert.equal(town.people.kit.act, 'crab');
  // In to the quay to land the catch, then back on her mooring, Dougie ashore.
  let landedAt = null;
  for (let h = 10.8; h < 13; h += 0.05) {
    at(town, h, FAIR);
    if (town.boat.leg === 'land' && landedAt == null) landedAt = h;
  }
  assert.ok(landedAt > 10.5 && landedAt < 12.4, `landed at ${landedAt}`);
  assert.ok(town.news(13).some((l) => /Dougie landed his pots this morning: \d+ lobster/.test(l)));
  at(town, 14, FAIR);
  assert.ok(Math.hypot(town.boat.x - F.MOORING.x, town.boat.z - F.MOORING.z) < 0.1);
  assert.ok(!town.boat.aboard);
  assert.notEqual(town.people.dougie.act, 'aboard');
  // Evening: everyone to the inn, and home after.
  at(town, 20.5, FAIR);
  for (const id of ['bert', 'dougie']) assert.equal(town.people[id].block.spot, 'inn', id);
  assert.ok(['inn', 'gull'].includes(town.people.mags.block.spot), 'Mags: the inn some evenings, home others');
  assert.equal(town.people.hettie.block.spot, 'strand');
  at(town, 23.5, FAIR);
  assert.equal(town.people.hettie.block.spot, 'quayEnd', 'squid under the quay light');
});

test('a storm: the boat stays on her mooring, Dougie mends pots and then fishes in the lee of the quay, and so does Hettie; Kit stays in', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  for (let h = 4; h <= 18; h += 0.5) {
    at(town, h, STORM);
    assert.ok(Math.hypot(town.boat.x - F.MOORING.x, town.boat.z - F.MOORING.z) < 0.1, `at ${h} the boat stays in`);
    assert.notEqual(town.people.kit.act, 'crab');
    if (h === 10) {
      assert.equal(town.people.dougie.block.spot, 'pots');
      assert.ok(town.news(h).some((l) => l.includes('not going out')));
    }
    if (h === 15.5) {
      assert.equal(town.people.dougie.block.spot, 'lee');
      assert.equal(town.people.hettie.block.spot, 'lee', 'sheltered water');
    }
  }
});

test('a blow coming on while she’s out: Dougie leaves the rest of his pots and comes straight in', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  at(town, 4, FAIR);
  for (let h = 4; h < 8.6; h += 0.05) at(town, h, FAIR);
  assert.ok(town.boat.aboard && town.boat.leg);
  let landedAt = null;
  for (let h = 8.6; h < 12.4; h += 0.05) {
    at(town, h, STORM);
    if (town.boat.leg === 'land' && landedAt == null) landedAt = h;
  }
  assert.ok(town.trip?.cut || landedAt, 'turned for home');
  assert.ok(landedAt != null && landedAt < 10.6, `in by ${landedAt?.toFixed(2)}`);
  assert.ok(town.news(12).some((l) => l.includes('before the blow')));
});

test('a long sleep: everyone is where the hour puts them, not walking there from where they were', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  at(town, 22.5, FAIR);
  town.update((DAY + 1) * 24 + 9.2, FAIR);
  const m = town.people.mags;
  assert.equal(m.act, 'work');
  assert.ok(Math.hypot(m.pos.x - F.SPOTS.slab.x, m.pos.z - F.SPOTS.slab.z) < 0.1);
  assert.ok(town.boat.aboard, 'Dougie’s out');
});

test('Hettie goes where the fish are, and lands one now and then; everyone has a word for you', () => {
  assert.equal(F.hettieMark(9, FAIR).spot, 'quayEnd');
  assert.equal(F.hettieMark(9, { ...FAIR, about: [] }).spot, 'slipway');
  assert.equal(F.hettieMark(6, FAIR).spot, 'strand');
  assert.equal(F.hettieMark(9, STORM).spot, 'lee');
  assert.equal(F.hettieMark(3, STORM), null, 'abed at three in the morning');
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  at(town, 4, FAIR);
  for (let h = 4; h < 22; h += 0.05) at(town, h, FAIR);
  const hers = town.landed.filter((l) => l.who === 'Hettie');
  assert.ok(hers.length >= 1 && hers.length <= 8, `${hers.length} fish`);
  for (const l of hers) assert.ok(['Atlantic Mackerel', 'European Seabass', 'European Squid'].includes(l.name), l.name);
  for (const id of F.FOLK_IDS) {
    for (const act of ['walk', 'stand', 'sit', 'work', 'fish', 'crab']) {
      const p = { id, act, block: { spot: id === 'dougie' ? 'pots' : 'quayEnd', target: 'mackerel' } };
      assert.ok(F.sayTo(p, { wanted: ['Sole'], landed: town.landed }).length > 12, `${id} ${act}`);
    }
  }
  // Close enough to talk to; not when they're indoors.
  const m = town.people.mags;
  assert.equal(town.near(m.pos.x + 1, m.pos.z)?.id, m.act === 'inside' ? undefined : 'mags');
});

test('the figures and the Morning Star are drawn where they are, and hidden when indoors or far off', () => {
  const scene = new THREE.Scene();
  const view = new FolkView(scene);
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  at(town, 9, FAIR);
  view.update(1 / 30, 1, town, { from: { x: 10, z: -95 } });
  assert.ok(view.figures.mags.group.visible);
  assert.ok(Math.abs(view.figures.mags.group.position.x - F.SPOTS.slab.x) < 0.01);
  assert.ok(!view.figures.ruth.group.visible, 'Ruth is inside');
  assert.ok(!view.figures.paco.group.visible, 'Paco is far to the south');
  assert.ok(view.boat.group.visible && view.boat.occupied, 'out with Dougie at the helm');
  assert.ok(Math.hypot(view.boat.group.position.x - town.boat.x, view.boat.group.position.z - town.boat.z) < 0.01);
  view.update(1 / 30, 1, town, { from: { x: 10, z: 6300 }, south: true });
  assert.ok(!view.figures.mags.group.visible && !view.boat.group.visible);
});
