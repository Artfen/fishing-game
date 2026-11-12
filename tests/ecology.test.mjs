// The living ocean D1 (docs/ECOLOGY.md): the one ecosystem's fish move with the water round them.
// The cool-water kinds go down below the summer's warm layer (and are sluggish stuck above it); a
// hunter goes where the small fish are; a fish shy of the light keeps deeper in a bright sun; the
// flood-tide feeders push up over the shallows on the flood; fish keep away from disturbed water
// and tight to cover where it's been fished hard. And the graphics settings never change which
// fish look at a bait.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem, BAIT_REACH } = await import('../src/world/ecosystem.js');
const EC = await import('../src/world/ecology.js');
const { yearPhase } = await import('../src/world/season.js');
const { mood, whyRejected, BEHAVIOUR } = await import('../src/behaviour.js');
const { FISH } = await import('../src/fish.js');
const TERRAIN = await import('../src/world/terrain.js');

const habitat = createHabitat();
const eco = new Ecosystem(habitat);
// A moment at a point in the year (0 the start of spring, the sea coldest; 0.5 the end of summer).
const absAt = (p, hour = 14) => {
  for (let d = 1; d < 400; d++) if (Math.abs(yearPhase(d * 24 + hour) - p) < 0.02) return d * 24 + hour;
};
const SPRING = absAt(0.05), LATE_SUMMER = absAt(0.48), AUTUMN = absAt(0.66);
// (The same dice each run.)
const seededRandom = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const withDice = (fn, seed = 7) => {
  const r = Math.random;
  Math.random = seededRandom(seed);
  try {
    return fn();
  } finally {
    Math.random = r;
  }
};
const set = (env) => {
  Object.assign(eco.ctx, { hour: 14, daylight: 1, night: 0, cloud: 0, rain: 0, tide: { flow: 0 } }, env);
  eco.update(0, { env: {}, focus: { x: 0, z: 0 }, boat: { x: 0, z: 0, speed: 0 } });
  eco.coolCache.clear();
};
// Where a kind goes, over many choices: its mean depth, the water's depth there, the share at a
// shoal of small fish, and the mean cover.
const picks = (id, env, n = 6, mode = 'cruise', fish = eco.bySpecies[id]) => withDice(() => {
  set(env);
  let y = 0, water = 0, prey = 0, cover = 0, k = 0;
  for (const a of fish) {
    for (let i = 0; i < n; i++) {
      eco.pickPoint(a, mode);
      const s = habitat.sample(a.tx, a.tz, {});
      y += -a.ty;
      water += s.depth;
      prey += a.atPrey ? 1 : 0;
      cover += Math.max(s.rock, s.weed);
      k++;
    }
  }
  return { depth: y / k, water: water / k, prey: prey / k, cover: cover / k };
});

test('the water’s warmth: the cool-water kinds keep below the summer’s warm layer, and are sluggish stuck above it', () => {
  // The pollack's limit, in the game's own sea: in early spring the whole water column suits it; at
  // the end of summer the top's warm and it wants the water below about 13-18 m; in autumn the warm
  // layer's mixed down and nowhere's cooler, so it goes as deep as it can (and only just feels it).
  const lim = EC.WARM_LIMIT.pollack;
  assert.equal(EC.coolDepth(lim, { abs: SPRING, hour: 14 }, 'coast', false), 0);
  const deep = EC.coolDepth(lim, { abs: LATE_SUMMER, hour: 14 }, 'coast', false);
  assert.ok(deep > 12 && deep < 19, `late summer: below ${deep.toFixed(1)} m`);
  assert.equal(EC.coolDepth(lim, { abs: AUTUMN, hour: 14 }, 'coast', false), EC.DEEPEST);
  assert.ok(EC.warmStress('pollack', EC.tempAt({ abs: AUTUMN, hour: 14 }, 'coast', false, 10)) < 0.25, 'autumn’s mixed water: hardly felt');
  // (Kinds that don't mind: none of it.)
  assert.equal(EC.warmStress('seabass', 30), 0);
  // In the water: the pollack go deeper at the end of summer than in spring (near the bottom of
  // their rocks, where those are shallow); a bass, which doesn't mind, the same.
  const spring = picks('pollack', { abs: SPRING }), summer = picks('pollack', { abs: LATE_SUMMER });
  assert.ok(summer.depth > spring.depth + 2.5, `pollack ${spring.depth.toFixed(1)} m in spring, ${summer.depth.toFixed(1)} m at the end of summer`);
  set({ abs: LATE_SUMMER });
  assert.ok(eco.bySpecies.seabass.every((f) => eco.coolTop(f) === 0), 'a bass doesn’t mind the warm layer');
  // A pollack held up in the warm water is sluggish, and says why; down in the cool, it isn't.
  set({ abs: LATE_SUMMER });
  const a = eco.bySpecies.pollack[0];
  const y0 = a.y;
  a.y = -2;
  const up = eco.envAt(a).warm, mUp = mood(a, eco.envAt(a), BEHAVIOUR.natural);
  a.y = -(deep + 3);
  const down = eco.envAt(a).warm, mDown = mood(a, eco.envAt(a), BEHAVIOUR.natural);
  a.y = y0;
  assert.ok(up > 0.6 && down === 0, `stress up ${up.toFixed(2)}, down ${down}`);
  assert.equal(mUp.worst, 'warm');
  assert.ok(mUp.m < mDown.m * 0.8);
  assert.equal(whyRejected({ mood: 'warm' }, 'turned')[0], 'warm');
});

test('the food: a hunter goes where the small fish are, keeps just under them, and is keen there; a grazer doesn’t', () => {
  // A bass home with a shoal of sand smelt brought within reach of it (on a running tide, the bass
  // about), then taken away. (The shoal on water the bass can go to: deep enough, in its zones.)
  const bass = eco.bySpecies.seabass.filter((f) => spotNear(f)).slice(0, 6);
  assert.ok(bass.length >= 4);
  const shoal = eco.forage.find((s) => s.sp.id === 'sandsmelt');
  assert.ok(shoal && EC.fishEater(FISH.find((f) => f.id === 'seabass')));
  assert.ok(!EC.fishEater(FISH.find((f) => f.id === 'mullet')) && !EC.fishEater(FISH.find((f) => f.id === 'sprat')));
  const was = { x: shoal.x, y: shoal.y, z: shoal.z, zone: shoal.home.zone };
  try {
    shoal.home.zone = bass[0].home.zone;
    const near = withDice(() => {
      let at = 0, k = 0, under = 0;
      set({ abs: SPRING, tide: { flow: 0.6 } });
      for (const a of bass) {
        Object.assign(shoal, spotNear(a));
        shoal.y = -1.2;
        for (let i = 0; i < 8; i++) {
          eco.pickPoint(a, 'cruise');
          k++;
          if (a.atPrey) {
            at++;
            if (a.ty < shoal.y && a.ty > shoal.y - 2.6) under++;
          }
        }
      }
      return { share: at / k, under: under / Math.max(1, at) };
    });
    assert.ok(near.share > 0.35, `at the shoal ${(near.share * 100).toFixed(0)}% of the time`);
    assert.ok(near.under > 0.7, `and under it ${(near.under * 100).toFixed(0)}%`);
    // Keen with the small fish about.
    const a = bass[0], p = spotNear(a);
    a.x = shoal.x = p.x;
    a.z = shoal.z = p.z;
    const fed = eco.envAt(a).food, mFed = mood(a, eco.envAt(a), BEHAVIOUR.natural).m;
    shoal.x = a.home.x + 500;
    assert.equal(eco.envAt(a).food, 0);
    const mHungry = mood(a, eco.envAt(a), BEHAVIOUR.natural).m;
    assert.ok(fed > 0.5 && mFed > mHungry * 1.15, `food ${fed.toFixed(2)}, mood ${mFed.toFixed(2)} against ${mHungry.toFixed(2)}`);
    // No shoals of small fish anywhere near: none of it.
    const forage = eco.forage;
    eco.forage = [];
    try {
      assert.equal(picks('seabass', { abs: SPRING, tide: { flow: 0.6 } }, 8, 'cruise', bass).prey, 0);
    } finally {
      eco.forage = forage;
    }
    // (A grazer never goes after them: a mullet is no hunter.)
    const mullet = eco.schools.find((s) => s.sp.id === 'mullet');
    withDice(() => {
      Object.assign(shoal, spotNear(mullet) || { x: mullet.home.x + 10, z: mullet.home.z });
      for (let i = 0; i < 20; i++) {
        eco.pickPoint(mullet, 'cruise');
        assert.ok(!mullet.atPrey);
      }
    });
  } finally {
    Object.assign(shoal, { x: was.x, y: was.y, z: was.z });
    shoal.home.zone = was.zone;
  }
});

// A point 15-25 m from a fish's home on water it can go to (deep enough, in its zones): where to
// put a shoal for it.
function spotNear(a) {
  const { zoneAt } = TERRAIN;
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2, r = 15 + (i % 3) * 5;
    const x = a.home.x + Math.cos(ang) * r, z = a.home.z + Math.sin(ang) * r;
    if (habitat.depth(x, z) > 2.5 && a.L.zones.includes(zoneAt(x, z))) return { x, z };
  }
  return null;
}

test('the light: a fish shy of it keeps deeper in a bright sun than under cloud', () => {
  const sun = picks('seabass', { abs: SPRING, cloud: 0 }), cloud = picks('seabass', { abs: SPRING, cloud: 1 });
  assert.ok(sun.depth > cloud.depth + 0.25, `bass ${sun.depth.toFixed(2)} m in the sun, ${cloud.depth.toFixed(2)} m under cloud`);
  // (Night: no sun to shy from.)
  const night = picks('seabass', { abs: SPRING, hour: 1, daylight: 0, night: 1 });
  assert.ok(night.depth < sun.depth, `${night.depth.toFixed(2)} m at night`);
});

test('the tide: the flood-tide feeders push up over the shallows on the flood and drop back on the ebb', () => {
  const flood = picks('seabass', { abs: SPRING, tide: { flow: -0.6 } }), ebb = picks('seabass', { abs: SPRING, tide: { flow: 0.6 } });
  assert.ok(flood.water < ebb.water - 0.4, `bass over ${flood.water.toFixed(2)} m of water on the flood, ${ebb.water.toFixed(2)} m on the ebb`);
  // (Not a flood feeder: the tide doesn't move it.)
  const p1 = picks('pollack', { abs: SPRING, tide: { flow: -0.6 } }), p2 = picks('pollack', { abs: SPRING, tide: { flow: 0.6 } });
  assert.ok(Math.abs(p1.water - p2.water) < 1e-9);
});

test('people: fish keep away from water lately disturbed, and lie up in cover where it’s been fished hard', () => {
  // A motor going round and round over one corner of a pollack's home: it keeps to the far side.
  const a = eco.bySpecies.pollack.find((f) => f.home.r >= 10);
  const R = a.home.r * (a.L.range || 1);
  const spot = { x: a.home.x + R * 0.5, z: a.home.z };
  const share = () => withDice(() => {
    set({ abs: SPRING });
    let k = 0;
    for (let i = 0; i < 200; i++) {
      eco.pickPoint(a, 'cruise');
      if (Math.hypot(a.tx - spot.x, a.tz - spot.z) < R * 0.5) k++;
    }
    return k / 200;
  });
  const calm = share();
  eco.time = 1000;
  for (let i = 0; i < 4; i++) eco.disturb(spot.x, spot.z, 0.4);
  const noisy = share();
  eco.noise.length = 0;
  assert.ok(noisy < calm * 0.6, `near the noise ${(calm * 100).toFixed(0)}% calm, ${(noisy * 100).toFixed(0)}% disturbed`);
  // Fished hard: what's left lies up in cover more, and cruises less.
  const restShare = () => withDice(() => {
    set({ abs: SPRING, hour: 6 });
    let rest = 0, k = 0;
    for (const f of eco.bySpecies.pollack) {
      for (let i = 0; i < 10; i++) {
        eco.decide(f);
        if (f.state === 'rest') rest++;
        k++;
      }
    }
    return rest / k;
  });
  const before = restShare();
  for (const f of eco.bySpecies.pollack) for (let i = 0; i < 6; i++) eco.pressure.add(f.home.x, f.home.z, SPRING);
  const after = restShare();
  eco.pressure.cells.clear();
  assert.ok(after > before + 0.2, `lying up ${(before * 100).toFixed(0)}% of the time, ${(after * 100).toFixed(0)}% fished hard`);
});

test('the graphics settings never change which fish look at a bait', () => {
  // A blue marlin 110 m from the focus (a trolled lure raises one from three times its 40 m): with
  // the lowest active radius (70 m) and the highest (150 m) it looks at baits all the same; past
  // the reach, neither.
  const marlin = eco.bySpecies.bluemarlin[0];
  const looked = (simRadius, dist) => {
    const e = eco;
    const keep = { x: marlin.x, z: marlin.z, state: marlin.state, sim: e.simRadius, consider: e.considerBait, foci: e.foci, focus: e.focus };
    let n = 0;
    try {
      e.simRadius = simRadius;
      e.foci = null;
      e.focus = { x: marlin.x - dist, z: marlin.z };
      marlin.state = 'cruise';
      marlin.interestCD = 0;
      e.considerBait = (f) => {
        if (f === marlin) n++;
      };
      for (let i = 0; i < 60; i++) e.stepWorld(1 / 30);
    } finally {
      Object.assign(marlin, { x: keep.x, z: keep.z, state: keep.state });
      e.simRadius = keep.sim;
      e.considerBait = keep.consider;
      e.foci = keep.foci;
      e.focus = keep.focus;
    }
    return n;
  };
  assert.ok(BAIT_REACH >= 120);
  const low = looked(70, 110), high = looked(150, 110);
  assert.ok(low > 0 && high > 0, `at 110 m: ${low} looks on the lowest setting, ${high} on the highest`);
  assert.equal(looked(70, BAIT_REACH + 20), 0);
  assert.equal(looked(150, BAIT_REACH + 20), 0);
});
