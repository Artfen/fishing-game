// The living ocean D2 (docs/ECOLOGY.md): the small shoaling fish live their own lives, each shoal
// as one (no fish-by-fish schooling across the sea). Hunters gathering about a shoal send it off
// the other way, closer together, quicker, and into cover if it has any; it follows its food up
// towards the top at dusk and through the night and down again by day; in winter it goes out to
// deeper water; a boat roaring past sends it down and together for a few seconds. It's the host's
// shoal, so everyone sees the same.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { yearPhase } = await import('../src/world/season.js');
const { currentFast, TIDE } = await import('../src/world/conditions.js');

const habitat = createHabitat();
const eco = new Ecosystem(habitat);
const absAt = (p, hour = 14) => {
  for (let d = 1; d < 400; d++) if (Math.abs(yearPhase(d * 24 + hour) - p) < 0.02) return d * 24 + hour;
};
const SPRING = absAt(0.05), LATE_SUMMER = absAt(0.48);
const seededRandom = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const withDice = (fn, seed = 11) => {
  const r = Math.random;
  Math.random = seededRandom(seed);
  try {
    return fn();
  } finally {
    Math.random = r;
  }
};
const set = (env) => {
  Object.assign(eco.ctx, { abs: SPRING, hour: 14, daylight: 1, night: 0, cloud: 0, rain: 0, tide: { flow: 0 } }, env);
  eco.update(0, { env: {}, focus: { x: 0, z: 0 }, boat: { x: 0, z: 1e5, speed: 0 } });
};
// Where a shoal chooses to go, many times over: mean depth, water depth, distance from a point,
// cover.
const picks = (s, env, n = 40, from = null) => withDice(() => {
  set(env);
  let y = 0, water = 0, dist = 0, cover = 0;
  for (let i = 0; i < n; i++) {
    eco.pickPoint(s, 'cruise');
    const c = habitat.sample(s.tx, s.tz, {});
    y += -s.ty;
    water += c.depth;
    cover += Math.max(c.weed, c.rock);
    if (from) dist += Math.hypot(s.tx - from.x, s.tz - from.z);
  }
  return { depth: y / n, water: water / n, dist: dist / n, cover: cover / n };
});
const calm = (s) => Object.assign(s, { threat: 0, threatT: -1e9, soundT: 0, fled: false, scatterT: 0 });

test('every shoal of the small fish is one of them, and only those', () => {
  const ids = new Set(eco.forage.map((s) => s.sp.id));
  for (const id of ['sprat', 'sardine', 'anchovy', 'sandsmelt', 'roach', 'rudd']) assert.ok(ids.has(id), id);
  assert.ok(eco.forage.every((s) => s.forage) && eco.schools.filter((s) => s.forage).length === eco.forage.length);
  assert.ok(!eco.schools.find((s) => s.sp.id === 'mackerel').forage && !eco.schools.find((s) => s.sp.id === 'tuna').forage);
});

test('hunters gathering about a shoal: it goes off the other way, closer together, quicker, into cover', () => {
  // A shoal of sand smelt (a weed-lover) on its home water.
  const s = eco.forage.find((f) => f.sp.id === 'sandsmelt' && f.home.r >= 8);
  calm(s);
  const R = s.home.r * (s.L.range || 1);
  const side = { x: s.home.x + R, z: s.home.z };
  const before = picks(s, {}, 60, side);
  // A bass settling at the shoal tells it (a fish-eater choosing the water round it: see D1).
  const bass = eco.bySpecies.seabass[0];
  const keep = { x: bass.x, z: bass.z, zones: bass.L.zones, homeZone: s.home.zone };
  try {
    bass.x = side.x;
    bass.z = side.z;
    let tries = 0;
    set({ tide: { flow: 0.6 } });
    while (!bass.atPrey && tries++ < 60) {
      s.x = bass.home.x + 12;
      s.z = bass.home.z;
      s.home.zone = bass.home.zone;
      eco.pickPoint(bass, 'cruise');
    }
    assert.ok(bass.atPrey, 'the bass settled at the shoal');
    assert.ok(eco.fearOf(s) >= 0.45 && Math.hypot(s.threatX - side.x, s.threatZ - side.z) < 1e-6, `fear ${eco.fearOf(s).toFixed(2)}`);
  } finally {
    Object.assign(bass, { x: keep.x, z: keep.z });
    s.home.zone = keep.homeZone;
  }
  // Three hunters lately, from one side: it goes the other way, and into the weed.
  Object.assign(s, { threat: 3, threatT: eco.time, threatX: side.x, threatZ: side.z });
  const after = picks(s, {}, 60, side);
  assert.ok(after.dist > before.dist + R * 0.4, `from the hunters' side: ${before.dist.toFixed(1)} m calm, ${after.dist.toFixed(1)} m wary`);
  assert.ok(after.cover > before.cover, `cover ${before.cover.toFixed(2)} → ${after.cover.toFixed(2)}`);
  // And off at once, closer together and quicker.
  const spreads = (fear) => withDice(() => {
    set({});
    let sp = 0, v = 0;
    for (let i = 0; i < 30; i++) {
      calm(s);
      if (fear) Object.assign(s, { threat: fear, threatT: eco.time, threatX: side.x, threatZ: side.z });
      s.t = 0;
      s.dur = 25;
      eco.stepSchool(s, 1 / 30, false);
      if (fear) assert.equal(s.t, 0, 'it chose somewhere new at once');
      sp += s.spread;
      v += s.wantSpeed;
    }
    return { spread: sp / 30, speed: v / 30 };
  });
  const quiet = (() => withDice(() => {
    set({});
    let sp = 0, v = 0;
    for (let i = 0; i < 30; i++) {
      calm(s);
      s.t = 99;
      eco.stepSchool(s, 1 / 30, false);
      sp += s.spread;
      v += s.wantSpeed;
    }
    return { spread: sp / 30, speed: v / 30 };
  }))();
  const wary = spreads(3);
  assert.ok(wary.spread < quiet.spread * 0.7, `spread ${quiet.spread.toFixed(2)} calm, ${wary.spread.toFixed(2)} wary`);
  assert.ok(wary.speed >= quiet.speed, `speed ${quiet.speed.toFixed(2)} calm, ${wary.speed.toFixed(2)} wary`);
  // It fades: twenty seconds on, half as wary; a minute on, hardly.
  Object.assign(s, { threat: 2, threatT: eco.time - 20 });
  assert.ok(Math.abs(eco.fearOf(s) - 2 * Math.exp(-1)) < 1e-9);
  calm(s);
});

test('feeding, a shoal works up into the current, where its food comes from', () => {
  // The sea shoal with the strongest tide past its home, in late summer (no pull offshore), the
  // tide running: feeding, it chooses water up-current; cruising, the same dice, it doesn't.
  TIDE.flow = 1;
  const speedAt = (f) => Math.hypot(...Object.values(currentFast(f.home.x, f.home.z, { x: 0, z: 0 })));
  const s = eco.forage.filter((f) => f.sp.water !== 'fresh').sort((a, b) => speedAt(b) - speedAt(a))[0];
  calm(s);
  const up = (mode) => withDice(() => {
    set({ abs: LATE_SUMMER });
    TIDE.flow = 1;
    let u = 0;
    for (let i = 0; i < 40; i++) {
      s.x = s.home.x;
      s.z = s.home.z;
      const c = currentFast(s.x, s.z, { x: 0, z: 0 }), sp = Math.hypot(c.x, c.z) || 1;
      eco.pickPoint(s, mode);
      u -= ((s.tx - s.home.x) * c.x + (s.tz - s.home.z) * c.z) / sp;
    }
    return u / 40;
  });
  try {
    const sp = speedAt(s), R = s.home.r * (s.L.range || 1);
    assert.ok(sp > 0.15, `the tide past the ${s.sp.id}: ${sp.toFixed(2)} m/s`);
    const feeding = up('feed'), cruising = up('cruise');
    assert.ok(feeding > cruising + R * 0.2, `feeding ${feeding.toFixed(1)} m up-current, cruising ${cruising.toFixed(1)} m (range ${R.toFixed(0)} m)`);
  } finally {
    TIDE.flow = 1;
  }
});

test('in winter a shoal goes out to deeper water; in summer it comes back in', () => {
  // The shoals with somewhere deeper to go.
  const movers = eco.forage.filter((f) => {
    eco.winterGround(f);
    return Math.hypot(f.winterX - f.home.x, f.winterZ - f.home.z) > 40 && f.sp.water !== 'fresh';
  }).slice(0, 8);
  assert.ok(movers.length >= 4, `${movers.length} sea shoals with deeper water near`);
  let deeper = 0;
  for (const s of movers) {
    calm(s);
    const summer = picks(s, { abs: LATE_SUMMER }, 20), winter = picks(s, { abs: SPRING }, 20);
    if (winter.water > summer.water + 1) deeper++;
  }
  assert.ok(deeper >= movers.length - 1, `${deeper} of ${movers.length} over deeper water at the end of winter`);
  // (The water's warmth decides it: the end of winter, fully; late summer, not at all.)
  set({ abs: SPRING });
  assert.ok(eco.winterness(movers[0]) > 0.95);
  set({ abs: LATE_SUMMER });
  assert.equal(eco.winterness(movers[0]), 0);
});

test('a boat roaring past sends a shoal down and together for a few seconds; a slow one doesn’t', () => {
  const s = eco.forage.find((f) => f.sp.id === 'sprat' && habitat.depth(f.x, f.z) > 6);
  calm(s);
  set({});
  s.y = -1.5;
  s.t = 0;
  s.dur = 25;
  s.spread = 2;
  const ty = s.ty;
  // Slow (a kayak, or a boat at dead slow): nothing.
  eco.boat = { x: s.x + 20, z: s.z, speed: 1.2 };
  eco.stepSchool(s, 1 / 30, false);
  assert.equal(s.soundT, 0);
  // Flat out, thirty metres off: down two or three metres, closer together, for six seconds.
  eco.boat = { x: s.x + 30, z: s.z, speed: 9 };
  eco.stepSchool(s, 1 / 30, false);
  assert.ok(s.soundT > 5.9, 'sounding');
  assert.ok(s.ty <= Math.max(-(habitat.depth(s.x, s.z) - 0.6), -1.5 - 2.4), `down to ${s.ty.toFixed(1)} m from -1.5`);
  assert.ok(s.spread < 2);
  // It holds down while it lasts, then goes on its way.
  const down = s.ty;
  for (let i = 0; i < 30 * 5; i++) eco.stepSchool(s, 1 / 30, false);
  assert.equal(s.ty, down, 'still down');
  eco.boat = { x: 0, z: 1e5, speed: 0 };
  for (let i = 0; i < 30 * 2; i++) eco.stepSchool(s, 1 / 30, false);
  assert.ok(s.soundT <= 0);
  // (Balled up by a hunting shoal, it has bigger things to think about: the hunt drives it.)
  calm(s);
  s.scatterT = 0.6;
  eco.boat = { x: s.x + 30, z: s.z, speed: 9 };
  eco.stepSchool(s, 1 / 30, false);
  assert.equal(s.soundT, 0);
  eco.boat = { x: 0, z: 1e5, speed: 0 };
  calm(s);
  void ty;
});

test('playing together: the guest sees the host’s wary shoal, as close together and as far off', () => {
  const host = new Ecosystem(habitat), guest = new Ecosystem(habitat);
  guest.follower = true;
  const s = host.forage.find((f) => f.sp.id === 'sandsmelt');
  const focus = { x: s.x, z: s.z };
  const ctx = (foci) => ({ env: { hour: 11, daylight: 1, night: 0, abs: SPRING, tide: { flow: 0.4 }, rain: 0, cloud: 0.2 }, focus, foci, boat: { x: focus.x, z: focus.z + 1e4, speed: 0 }, walker: null, lantern: null, lights: [] });
  Object.assign(s, { threat: 3, threatT: 0, threatX: s.x + 20, threatZ: s.z });
  for (let i = 0; i < 30 * 8; i++) {
    s.threatT = host.time; // (the hunters keep coming)
    host.update(1 / 30, ctx([focus]));
    if (i % 15 === 0) guest.applySchools(JSON.parse(JSON.stringify(host.captureSchools([focus]))), 0.1);
    guest.update(1 / 30, ctx(null));
  }
  const g = guest.schools[s.id];
  assert.ok(Math.abs(g.spread - s.spread) < 0.02, `spread ${s.spread.toFixed(2)} on the host, ${g.spread.toFixed(2)} on the guest`);
  assert.ok(s.spread < 1.9, `wary: ${s.spread.toFixed(2)}`);
  assert.ok(Math.hypot(g.x - s.x, g.z - s.z) < 6, `${Math.hypot(g.x - s.x, g.z - s.z).toFixed(1)} m apart`);
});
