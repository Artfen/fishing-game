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
// (The reef's fish wear the fish's own skins, painted on a canvas.)
{
  const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
}
const { Drifters, jellyChance, REEF } = await import('../src/world/drifters.js');
const { Seabed, seabedKindSouth } = await import('../src/world/seabed.js');
const { NATURE } = await import('../src/grounds.js');
const { siteById, PINNACLES, pinnacleRadius } = await import('../src/world/divesites.js');
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

// A spot at home by what's below it (the first found, scanning the bay).
function spotWhere(ok) {
  const s = {};
  for (let z = -300; z < 400; z += 5) for (let x = -300; x < 400; x += 5) if (ok(habitat.sample(x, z, s))) return { x, z };
  throw new Error('no such spot');
}
const reefAt = (p, { density = 1, abs = 10 * 24 + 12 } = {}) => {
  const D = new Drifters(new THREE.Scene(), habitat);
  D.density = density;
  D.update(1 / 60, 1, { position: new THREE.Vector3(p.x, -3, p.z) }, 1, abs);
  return D;
};

test('the reef has its own small fish, by what’s below: wrasse and bream over the rocks, shoals out over the open sand', () => {
  const rocks = spotWhere((s) => s.rock > 0.85 && s.depth > 4 && s.depth < 9);
  const sand = spotWhere((s) => s.rock < 0.02 && s.weed < 0.02 && s.depth > 14);
  const R = reefAt(rocks), S = reefAt(sand);
  assert.ok(R.reefCount > 60, `over the rocks: ${R.reefCount}`);
  assert.ok(R.reef.filter((G) => Math.hypot(G.x - rocks.x, G.z - rocks.z) < 9).length >= 3, 'some right by you');
  assert.ok(S.reefCount < R.reefCount, `over deep sand: ${S.reefCount} (rocks ${R.reefCount})`);
  const kinds = new Set(R.reef.map((G) => G.sp)), sandKinds = new Set(S.reef.map((G) => G.sp));
  for (const k of ['wrasse', 'twobanded']) assert.ok(kinds.has(k), k);
  // Out over the sand, only what lives out there: shoals in the open water, a gurnard on the bottom;
  // never the rocks' wrasse and bream, nor the weed's salema.
  assert.ok(S.reefCount > 0, 'but never empty');
  for (const k of ['wrasse', 'twobanded', 'pollack', 'salema', 'blackbream']) assert.ok(!sandKinds.has(k), k);
  assert.ok(S.reef.every((G) => G.mode === 'mid' || G.sp === 'gurnard'));
  for (const G of R.reef) assert.ok(REEF.home.some((r) => r.sp === G.sp), G.sp);
  // The dive sites' own rock and kelp count (they're not in the habitat's map): Skerries Reef has
  // its wrasse and bream, the Kelp Forest its salema, and on the Hound they keep to the walls, up
  // off the sand thirty metres down and just clear of the rock.
  const kindsAt = (id) => new Set(reefAt(siteById[id]).reef.filter((G) => Math.hypot(G.x - siteById[id].x, G.z - siteById[id].z) < siteById[id].r).map((G) => G.sp));
  for (const k of ['wrasse', 'twobanded']) assert.ok(kindsAt('reef').has(k), `Skerries Reef: ${k}`);
  assert.ok(kindsAt('kelp').has('salema'), 'the Kelp Forest: salema');
  const H = reefAt(siteById.hound), P = PINNACLES[0];
  const onWall = H.reef.filter((G) => G.mode !== 'mid' && Math.hypot(G.x - P.x, G.z - P.z) < P.base * 1.6);
  assert.ok(onWall.length >= 6, `${onWall.length} on the Hound`);
  for (const G of onWall) {
    assert.ok(G.y > P.bed + 0.9, 'up the wall');
    assert.ok(Math.hypot(G.x - P.x, G.z - P.z) > pinnacleRadius(P, G.y - P.bed, Math.atan2(G.z - P.z, G.x - P.x)) + 1, 'clear of the rock');
  }
  // The same for the same week (nothing to do with the dice of the moment); another week, another lot.
  const sig = (D) => D.reef.map((G) => `${G.sp}:${G.x.toFixed(2)}:${G.z.toFixed(2)}:${G.fish.length}`).sort().join('|');
  assert.equal(sig(reefAt(rocks)), sig(R));
  assert.notEqual(sig(reefAt(rocks, { abs: 17 * 24 + 12 })), sig(R));
  // Fewer on lower graphics.
  assert.ok(reefAt(rocks, { density: 0.35 }).reefCount < R.reefCount * 0.7);
  // Drawn: in the water (off the bottom, under the top), each kind in its own mesh.
  for (let i = 0; i < 30; i++) R.animate(1 / 30, i / 30, new THREE.Vector3(rocks.x, -3, rocks.z));
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  let drawn = 0;
  for (const { m: mesh } of Object.values(R.reefMesh).filter(Boolean)) {
    assert.ok(mesh.visible || mesh.count === 0);
    for (let k = 0; k < mesh.count; k++, drawn++) {
      mesh.getMatrixAt(k, m);
      p.setFromMatrixPosition(m);
      const floor = Math.min(...R.reef.map((G) => G.low));
      assert.ok(p.y <= -0.6 + 1e-6 && p.y >= floor - 1e-6, `y ${p.y}`);
    }
  }
  assert.equal(drawn, R.reefCount);
});

test('the reef’s fish move off from a diver who comes at them, and the curious ones come to look at one who keeps still', () => {
  const rocks = spotWhere((s) => s.rock > 0.85 && s.depth > 4 && s.depth < 9);
  // Swim at a group: it moves off.
  const D = reefAt(rocks);
  const G = D.reef.find((g) => g.mode !== 'mid');
  const at = new THREE.Vector3(G.cx - 1.2, G.y, G.cz);
  for (let i = 0; i < 60; i++) D.animate(1 / 30, i / 30, at);
  assert.ok(Math.hypot(G.cx - at.x, G.cz - at.z) > 3, 'shy');
  // Hang still a little way off a curious one: it comes over (and stops a few metres short).
  const C = reefAt(rocks);
  const W = C.reef.find((g) => g.curious);
  const still = new THREE.Vector3(W.x + 8, W.y + 1, W.z);
  const d0 = Math.hypot(W.cx - still.x, W.cz - still.z);
  for (let i = 0; i < 30 * 10; i++) C.animate(1 / 30, i / 30, still);
  const d1 = Math.hypot(W.cx - still.x, W.cz - still.z);
  assert.ok(d1 < d0 - 3 && d1 > 1.5, `from ${d0.toFixed(1)} m to ${d1.toFixed(1)} m`);
  // Out of the water: put away.
  C.update(1 / 60, 2, { position: new THREE.Vector3(rocks.x, 2, rocks.z) }, 0, 10 * 24 + 12);
  for (const R of Object.values(C.reefMesh)) if (R) assert.equal(R.m.visible, false);
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

test('a slow school’s fish keep their places swimming with it, not spinning on the spot round them', () => {
  const eco = new Ecosystem(habitat);
  eco.ctx.abs = 120 * 24 + 11;
  const schools = eco.schools.slice(0, 24);
  for (const s of schools) for (const m of s.members) m.active = true;
  let n = 0, hard = 0, sum = 0;
  const H = 1 / 30;
  eco.time = 0;
  for (let i = 0; i < 30 * 40; i++) {
    eco.time += H;
    for (const s of schools) {
      eco.stepSchool(s, H, false);
      for (const m of s.members) { eco.followSchool(m); eco.steer(m, H); eco.integrate(m, H); }
      if (i > 30 * 5 && s.speed < 0.35) for (const m of s.members) { n++; const r = Math.abs(m.turnRate || 0); sum += r; if (r > 2) hard++; }
    }
  }
  assert.ok(n > 1000, `${n} samples of slow schools`);
  // (Before: turning hard, over 2 rad/s, two-fifths of the time, round and round their places.)
  assert.ok(hard / n < 0.18, `turning hard ${(100 * hard / n).toFixed(1)}% of the time`);
  assert.ok(sum / n < 0.8, `turning ${(sum / n).toFixed(2)} rad/s on average`);
});
