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
const H = await import('../src/world/havenHouses.js');
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
  // (The places inside the chandlery and the inn are reached through their doors: see below.)
  const names = Object.keys(F.SPOTS).filter((k) => !['strand', 'paco', 'chanoHome', 'steps', 'barTable'].includes(k) && !F.SPOTS[k].via);
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

test('in and out of the chandlery and the inn: through the door, round the counter, the bar and the tables', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  const inside = Object.keys(F.SPOTS).filter((k) => F.SPOTS[k].via);
  assert.ok(inside.length >= 6);
  const solid = coast.obstacles.filter((o) => o.kind === 'building' || o.kind === 'harbour');
  const check = (r, a, b, A, B) => {
    const L = F.pathLength(r);
    for (let s = 0; s <= L; s += 0.1) {
      const q = F.along(r, s);
      if (Math.hypot(q.x - A.x, q.z - A.z) < 1.1 || Math.hypot(q.x - B.x, q.z - B.z) < 1.1) continue;
      for (const o of solid) assert.ok(Math.hypot(q.x - o.x, q.z - o.z) > o.r + 0.05, `${a} → ${b} runs through ${o.name} at ${q.x.toFixed(2)}, ${q.z.toFixed(2)}`);
    }
    // In by the door only: wherever the way crosses a room's wall, it's at the door.
    for (let s = 0; s <= L; s += 0.05) {
      const p = F.along(r, s), q = F.along(r, Math.min(L, s + 0.05));
      const was = H.insideHaven(p.x, p.z), now = H.insideHaven(q.x, q.z);
      if (was !== now) {
        const R = H.HAVEN_ROOMS[was || now];
        assert.ok(Math.abs(q.x - R.doorX) < 0.3, `${a} → ${b} goes through the wall of ${R.id} at ${q.x.toFixed(2)}`);
      }
    }
  };
  for (const a of [...inside, 'slab', 'bench', 'chair']) {
    for (const b of [...inside, 'slab', 'bench']) {
      if (a === b) continue;
      const A = F.SPOTS[a], B = F.SPOTS[b];
      check(town.wayTo({ x: A.x, z: A.z }, A, B), a, b, A, B);
    }
  }
  // Each place inside is in its room, and each room's way in leads through its door.
  for (const k of inside) assert.ok(H.insideHaven(F.SPOTS[k].x, F.SPOTS[k].z), k);
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
  // Evening: everyone to the inn (Bert on the settle by the fire, Dougie at the bar), and home after.
  at(town, 20.5, FAIR);
  assert.equal(town.people.bert.block.spot, 'innSettle');
  assert.equal(town.people.dougie.block.spot, 'innBarFront');
  assert.equal(H.insideHaven(town.people.bert.pos.x, town.people.bert.pos.z), 'inn', 'in by now');
  assert.ok(['innTableW', 'gull'].includes(town.people.mags.block.spot), 'Mags: the inn some evenings, home others');
  assert.equal(town.people.ruth.block.spot, 'innBar', 'Ruth behind her bar');
  assert.equal(town.people.ruth.act, 'work');
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
  assert.ok(view.figures.ruth.group.visible, 'Ruth behind her bar');
  assert.equal(H.insideHaven(view.figures.ruth.group.position.x, view.figures.ruth.group.position.z), 'inn');
  assert.ok(!view.figures.paco.group.visible, 'Paco is far to the south');
  assert.ok(view.boat.group.visible && view.boat.occupied, 'out with Dougie at the helm');
  assert.ok(Math.hypot(view.boat.group.position.x - town.boat.x, view.boat.group.position.z - town.boat.z) < 0.01);
  view.update(1 / 30, 1, town, { from: { x: 10, z: 6300 }, south: true });
  assert.ok(!view.figures.mags.group.visible && !view.boat.group.visible);
  at(town, 23.6, FAIR);
  view.update(1 / 30, 1, town, { from: { x: 10, z: -95 } });
  assert.ok(!view.figures.ruth.group.visible, 'Ruth gone up to bed');
});

const CALM = { ...FAIR, wind: 5 };
const GALE = { storm: 0.1, rain: 0.2, wind: 15, about: [], activity: {} };
const puffinDay = () => {
  let d = 1;
  while (!(seeded(d * 7919 + 21)() < F.PUFFIN.chance)) d++;
  return d;
};

test('the other boats keep to water deep enough for them: Ian’s, Chano’s, and the Puffin’s passage in and out', () => {
  const check = (P, what) => {
    const L = F.pathLength(P);
    for (let s = 0; s <= L; s += 1) {
      const q = F.along(P, s);
      const berth = [...Object.values(F.OUTINGS).flatMap((O) => [O.mooring, O.landing].filter(Boolean))].some((b) => Math.hypot(q.x - b.x, q.z - b.z) < 4);
      assert.ok(T.heightAt(q.x, q.z) < (berth ? -0.6 : -1.4), `${what} aground at ${q.x.toFixed(0)}, ${q.z.toFixed(0)}`);
    }
  };
  for (const [id, O] of Object.entries(F.OUTINGS)) for (const L of F.outingLegs(id)) if (L.path) check(L.path, id);
  check(F.PUFFIN.route, 'the Puffin');
  assert.ok(F.OUTING_HOURS.jean < 4.5 && F.OUTING_HOURS.carmen < 6.5);
});

test('a calm afternoon: Ian takes the Bonny Jean out past the Calf after mackerel, and comes back to her mooring; not when it’s blowing', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  at(town, 12, CALM);
  let out = false, fished = false;
  for (let h = 12; h < 19; h += 0.05) {
    at(town, h, CALM);
    const J = town.boats.jean;
    if (J.aboard && Math.hypot(J.x - F.OUTINGS.jean.mooring.x, J.z - F.OUTINGS.jean.mooring.z) > 60) out = true;
    if (J.fishing) fished = true;
  }
  assert.ok(out && fished, 'out to the mark, a line down');
  assert.ok(!town.boats.jean.aboard);
  assert.equal(town.people.ian.block.spot, 'innTableE', 'and a pint after');
  const windy = new F.Townsfolk({ obstacles: coast.obstacles });
  for (let h = 12; h < 19; h += 0.25) {
    at(windy, h, { ...FAIR, wind: 10 });
    assert.ok(!windy.boats.jean.aboard, `at ${h}, she stays on her mooring`);
  }
});

test('Chano goes out to El Bajón at sunrise and lands his catch at the quay steps for Paco; in a gale he mends his nets', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  at(town, 5, CALM);
  let landed = false, overReef = false;
  for (let h = 5; h < 14; h += 0.05) {
    at(town, h, CALM);
    const C = town.boats.carmen;
    if (C.fishing && Math.hypot(C.x - (-104), C.z - 6434) < 12) overReef = true;
    if (C.leg === 'land') {
      landed = true;
      assert.ok(Math.hypot(C.x - F.OUTINGS.carmen.landing.x, C.z - F.OUTINGS.carmen.landing.z) < 0.1);
    }
  }
  assert.ok(overReef && landed);
  assert.ok(town.newsSouth(14).some((l) => /Chano came in from El Bajón with \d+ viejas/.test(l)));
  at(town, 19, CALM);
  assert.equal(town.people.chano.act, 'sit', 'outside the bar of an evening');
  const gale = new F.Townsfolk({ obstacles: coast.obstacles });
  for (let h = 5; h < 11; h += 0.25) {
    at(gale, h, GALE);
    assert.ok(!gale.boats.carmen.aboard);
  }
  assert.equal(gale.people.chano.act, 'work');
  assert.ok(gale.newsSouth(10).some((l) => l.includes('mending his nets')));
});

test('some fine afternoons the Puffin sails in to anchor in the bay; she sails on next morning, unless it’s blowing', () => {
  const d = puffinDay();
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  town.update(d * 24 + 13, CALM);
  assert.ok(!town.boats.puffin.present);
  for (let h = 13; h < 15.5; h += 0.05) town.update(d * 24 + h, CALM);
  assert.ok(town.boats.puffin.present && town.boats.puffin.sails, 'coming in under sail');
  for (let h = 15.5; h < 22; h += 0.1) town.update(d * 24 + h, CALM);
  assert.ok(town.boats.puffin.anchored && !town.boats.puffin.sails);
  assert.ok(town.news(22).some((l) => l.includes('Puffin’s at anchor')));
  for (let h = 22; h < 24 + 13; h += 0.1) town.update(d * 24 + h, CALM);
  assert.ok(!town.boats.puffin.present, 'gone on round the coast');
  // Weather-bound: a blow at sailing time keeps her another day.
  const held = new F.Townsfolk({ obstacles: coast.obstacles });
  for (let h = 13; h < 24 + 8.9; h += 0.1) held.update(d * 24 + h, CALM);
  for (let h = 24 + 8.9; h < 24 + 13; h += 0.1) held.update(d * 24 + h, { ...STORM });
  assert.ok(held.boats.puffin.anchored, 'still at anchor');
  assert.ok(held.news(12).some((l) => l.includes('waiting for the weather')));
});

test('the new boats are drawn in their own sea: Ian’s at home, Chano’s and his table at Las Brasas', () => {
  const scene = new THREE.Scene();
  const view = new FolkView(scene);
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  at(town, 15.5, CALM);
  view.update(1 / 30, 1, town, { from: { x: 10, z: -95 } });
  assert.ok(view.boats.jean.group.visible && view.boats.jean.occupied && view.boats.jean.pose.fishing === 1);
  assert.ok(!view.boats.carmen.group.visible && !view.terrace.visible);
  view.update(1 / 30, 1, town, { from: { x: 20, z: 6300 }, south: true });
  assert.ok(view.boats.carmen.group.visible && view.terrace.visible && !view.boats.jean.group.visible);
});
