// The living ocean (R3): a spot fished hard turns slow and wary and recovers when left; the
// water's temperature through the year, down the water column and across the crossing; bait
// balls on the fish finder; the open water's own life (jellyfish, fry) and Las Brasas' seabed;
// and the naturalist's notes for all of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const THREE = await import('three');
const { Pressure, restockFactor, pressureWariness, HEAVY, CELL } = await import('../src/world/pressure.js');
const { seaTemp } = await import('../src/world/seatemp.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { Drifters, jellyChance } = await import('../src/world/drifters.js');
const { Seabed, seabedKindSouth } = await import('../src/world/seabed.js');
const { NATURE } = await import('../src/grounds.js');
const { BAJON } = await import('../src/world/brasa.js');
const habitat = createHabitat();

/* ---------- fishing pressure ---------- */

test('a spot fished hard is remembered, its neighbours a little, and it recovers with time', () => {
  const P = new Pressure();
  assert.equal(P.level(100, 100, 50), 0);
  let lvl = 0;
  for (let i = 0; i < 5; i++) lvl = P.add(100, 100, 50 + i * 0.2);
  assert.ok(lvl >= HEAVY, `five kept: ${lvl.toFixed(2)}`);
  const next = P.level(100 + CELL, 100, 51), far = P.level(100 + CELL * 4, 100, 51);
  assert.ok(next > 0 && next < lvl * 0.7, `next door: ${next.toFixed(2)}`);
  assert.equal(far, 0);
  // A night's sleep (half a day) takes most of it away; a day and more, nearly all.
  assert.ok(P.level(100, 100, 51 + 12) < lvl * 0.5);
  assert.ok(P.level(100, 100, 51 + 48) < lvl * 0.05);
  // What it does: replacements slower (up to six times), the fish warier (and only when it's real).
  assert.equal(restockFactor(0), 1);
  assert.ok(restockFactor(HEAVY) > 2.5);
  assert.equal(restockFactor(50), 6);
  assert.equal(pressureWariness(0.5), 0);
  assert.ok(pressureWariness(HEAVY) > 0.15);
  assert.equal(pressureWariness(50), 0.45);
});

test('in the water: keeping fish from one spot slows their replacements and makes the rest warier', () => {
  const eco = new Ecosystem(habitat);
  eco.ctx.abs = 1000;
  eco.time = 500;
  const sp = Object.keys(eco.bySpecies).find((k) => eco.bySpecies[k].length > 6);
  const fish = eco.bySpecies[sp];
  const a0 = fish[0];
  const calm = eco.envAt(a0).disturb;
  const waits = [], random = Math.random;
  Math.random = () => 0.5; // (the same dice each time: only the pressure differs)
  try {
    for (const a of fish.slice(0, 6)) {
      a.x = a0.x;
      a.z = a0.z;
      a.home = { ...a.home, x: a0.x, z: a0.z };
      eco.keep(a);
      waits.push(a.backAt - eco.time);
    }
  } finally {
    Math.random = random;
  }
  for (let i = 1; i < waits.length; i++) assert.ok(waits[i] >= waits[i - 1] - 1e-6, 'each one slower than the last');
  assert.ok(waits[5] > waits[0] * 1.8, `waits ${waits.map((w) => Math.round(w)).join(', ')}`);
  assert.ok(eco.pressureAt(a0.x, a0.z) >= HEAVY);
  const other = fish[6] || eco.agents.find((a) => !fish.slice(0, 6).includes(a));
  other.x = a0.x + 3;
  other.z = a0.z;
  assert.ok(eco.envAt(other).disturb > calm + 0.15, 'the fish left there are warier');
  // A day later it has mostly recovered.
  eco.ctx.abs = 1060;
  assert.ok(eco.pressureAt(a0.x, a0.z) < 0.5);
});

/* ---------- the water's temperature ---------- */

// (The year runs 28 days from mid-spring: day 7 is high summer's start, day 21 the end of winter.)
const T = (day, opts = {}) => seaTemp({ abs: day * 24 + 12, ...opts });

test('the sea warms through the summer, a month behind the air, and cools through the winter', () => {
  const temps = Array.from({ length: 28 }, (_, d) => T(d + 1));
  const warmest = temps.indexOf(Math.max(...temps)) + 1, coldest = temps.indexOf(Math.min(...temps)) + 1;
  // (Summer runs from about day 5 to day 11, winter from about day 19 to day 25.)
  assert.ok(warmest >= 10 && warmest <= 13, `warmest on day ${warmest}`);
  assert.ok(coldest >= 24 || coldest <= 2, `coldest on day ${coldest}`);
  assert.ok(Math.max(...temps) > 20 && Math.max(...temps) < 22.5);
  assert.ok(Math.min(...temps) > 11 && Math.min(...temps) < 13.5);
});

test('summer’s warm water floats on the cold; winter mixes it; fresh water swings further', () => {
  const summer = 9, winter = 23;
  assert.ok(T(summer) - T(summer, { depth: 30 }) > 4, 'a summer thermocline');
  assert.ok(Math.abs(T(winter, { hour: 7 }) - T(winter, { depth: 30, hour: 7 })) < 0.3, 'mixed in winter');
  assert.ok(T(winter, { zone: 'lake' }) < T(winter) - 5, 'the lake much colder in winter');
  assert.ok(T(summer, { zone: 'lake' }) > T(summer, { zone: 'river' }), 'running water cooler in summer');
  assert.ok(T(winter, { zone: 'tarn' }) < T(winter, { zone: 'lake' }));
  const estuary = T(winter, { zone: 'estuary' });
  assert.ok(estuary < T(winter) && estuary > T(winter, { zone: 'river' }));
  // An afternoon warms the shallows, not the deep.
  const am = seaTemp({ abs: summer * 24 + 7, zone: 'bay' }), pm = seaTemp({ abs: summer * 24 + 14, zone: 'bay', hour: 14 });
  assert.ok(pm > am);
});

test('Las Brasas is warm all year, and the crossing changes from one sea to the other', () => {
  for (let d = 1; d <= 28; d++) {
    const s = T(d, { south: 1 });
    assert.ok(s >= 18 && s <= 24.5, `day ${d}: ${s}`);
    assert.ok(s > T(d) - 1, 'the south is the warmer sea');
  }
  const mid = T(27, { south: 0.5 });
  assert.ok(mid > T(27) && mid < T(27, { south: 1 }));
});

/* ---------- the fish finder ---------- */

test('the sonar can tell a bait ball from a fish', () => {
  const eco = new Ecosystem(habitat);
  const sprat = eco.agents.filter((a) => a.L.bait).slice(0, 10);
  assert.ok(sprat.length >= 6, 'there are bait schools');
  for (const a of sprat) {
    a.x = 200;
    a.z = 200;
    a.y = -4;
    a.active = true;
  }
  const echoes = eco.queryCone(200, 200, 0.6, []);
  assert.ok(echoes.filter((e) => e.bait).length >= 6);
  assert.ok(echoes.every((e) => typeof e.bait === 'boolean'));
});

/* ---------- the open water's life, and Las Brasas' seabed ---------- */

test('jellyfish come with the warm water, and the stinger drifts by at Las Brasas all year', () => {
  assert.ok(jellyChance('moonjelly', 0.45) > 0.12);
  assert.equal(jellyChance('moonjelly', 0.95), 0);
  assert.ok(jellyChance('compass', 0.52) > 0.05);
  assert.ok(jellyChance('compass', 0.1) < 0.01);
  assert.ok(jellyChance('stinger', 0.95) > 0);
});

test('down in the water there’s life away from the fish: jellies in summer, shoals of fry that scatter', () => {
  const scene = new THREE.Scene();
  const D = new Drifters(scene, habitat);
  const cam = { position: new THREE.Vector3(-30, -2, 40) };
  let summerJellies = 0, winterJellies = 0, fry = 0;
  for (const day of [8, 10, 12, 13]) {
    D.cx = Infinity;
    D.update(1 / 60, 1, cam, 1, day * 24 + 12);
    summerJellies += D.jellies.length;
    fry += D.shoals.length;
  }
  for (const day of [24, 26]) {
    D.cx = Infinity;
    D.update(1 / 60, 1, cam, 1, day * 24 + 12);
    winterJellies += D.jellies.length;
  }
  assert.ok(summerJellies > 0, 'jellies in summer');
  assert.equal(winterJellies, 0, 'none in winter');
  assert.ok(fry > 0, 'fry over the shallows');
  // Swim at a shoal: it bolts away from you.
  D.cx = Infinity;
  D.update(1 / 60, 1, cam, 1, 10 * 24 + 12);
  const S = D.shoals[0];
  const near = { position: new THREE.Vector3(S.cx - 1.5, S.y, S.cz) };
  const before = Math.hypot(S.cx - near.position.x, S.cz - near.position.z);
  for (let i = 0; i < 60; i++) D.animate(1 / 30, i / 30, near.position);
  assert.ok(Math.hypot(S.cx - near.position.x, S.cz - near.position.z) > before + 1, 'it scatters');
  // Out of the water, it's all put away.
  D.update(1 / 60, 2, cam, 0, 10 * 24 + 12);
  assert.equal(D.fryMesh.visible, false);
});

test('Las Brasas has a seabed of its own: urchins on the black rock, cucumbers and garden eels on the sand', () => {
  assert.equal(seabedKindSouth({ depth: 0.5, rock: 1, weed: 0 }, 0.1), null);
  const rock = new Set(), sand = new Set();
  for (let i = 0; i < 400; i++) {
    rock.add(seabedKindSouth({ depth: 9, rock: 1, weed: 0 }, i / 400));
    sand.add(seabedKindSouth({ depth: 12, rock: 0, weed: 0 }, i / 400));
  }
  for (const k of ['diadema', 'redstar', 'sponge']) assert.ok(rock.has(k), k);
  for (const k of ['gardeneel', 'cucumber', 'shell']) assert.ok(sand.has(k), k);
  const B = new Seabed(new THREE.Scene(), habitat);
  B.update({ position: new THREE.Vector3(BAJON.x, -4, BAJON.z) }, 1);
  assert.ok(B.meshes.diadema.count > 10, 'urchins on El Bajón');
});

test('everything new down there has its page in the naturalist’s notes', () => {
  for (const k of ['diadema', 'redstar', 'cucumber', 'gardeneel', 'moonjelly', 'compass', 'stinger', 'fry']) {
    assert.ok(NATURE[k]?.name && NATURE[k].latin && NATURE[k].note.length > 40, k);
  }
});

test('the catch log keeps the water’s temperature (and older entries without one load as before)', async () => {
  const { parseSave, exportText, sanitize } = await import('../src/save.js');
  const s = sanitize({ day: 3 });
  s.log.push({ id: 'a1', sp: 'seabass', size: 50, day: 3, hour: 7.5, zone: 'bay', place: 'bay', temp: 16.43, kind: 'lure', rod: 'spin', from: 'boat', depth: 1, bottom: 4, outcome: 'released' });
  s.log.push({ id: 'a2', sp: 'seabass', size: 44, day: 3, hour: 8, zone: 'bay', place: 'bay', kind: 'lure', rod: 'spin', from: 'boat', depth: 1, bottom: 4, outcome: 'released' });
  const back = parseSave(exportText(s)).state.log;
  assert.equal(back[0].temp, 16.4);
  assert.equal(back[1].temp, undefined);
});
