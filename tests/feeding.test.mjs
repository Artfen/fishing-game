// The living ocean D4 (docs/ECOLOGY.md): feeding events. Hunters pressing a shoal of small fish ball
// it up and drive it to the top; the hunters near close in; the top boils, small fish spray, a
// hunter clears the water, and by day the birds come; the fish in it take a lure readily; and it
// disperses, leaving the water quiet a while. The host decides; everyone sees the same.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { FEED, GATHER, UP, OVER } = await import('../src/world/feeding.js');
const { cleanShared, countsOf } = await import('../src/sharedworld.js');
const { seeded } = await import('../src/util.js');
const { FISH: FISHES } = await import('../src/fish.js');
const FISH_ID = (i) => (i >= 0 ? FISHES[i].id : null);

const habitat = createHabitat();
// (Every test on fixed dice, so each runs the same every time.)
const realRandom = Math.random;
beforeEach(() => {
  Math.random = seeded(20261113);
});
afterEach(() => {
  Math.random = realRandom;
});
const withDice = (fn, seed = 7) => {
  const r = Math.random;
  Math.random = seeded(seed);
  try {
    return fn();
  } finally {
    Math.random = r;
  }
};
const settle = (eco, hour = 7, daylight = 0.8) => {
  Object.assign(eco.ctx, { hour, daylight, night: 0, cloud: 0, rain: 0, tide: { flow: 0.5 } });
  eco.update(0, { env: {}, focus: { x: 0, z: 0 }, boat: { x: 0, z: 1e5, speed: 0 } });
};
// A sprat shoal on the open coast over a good depth of water, with everyone near it.
const seaShoal = (eco) => {
  const s = eco.forage.find((f) => f.sp.id === 'sprat' && !f.home.south && habitat.depth(f.x, f.z) > 6);
  eco.focus = { x: s.x, z: s.z };
  eco.foci = null;
  return s;
};
const press = (eco, s, fear = 2.4) => Object.assign(s, { threat: fear, threatT: eco.time, threatX: s.x + 5, threatZ: s.z });
// n bass brought within 40 m of the shoal, keen.
const bassAbout = (eco, s, n = 5) => {
  eco.activity.seabass = 0.9;
  const fish = eco.feeding.eaters.filter((a) => a.sp.id === 'seabass').slice(0, n);
  fish.forEach((a, i) => Object.assign(a, { x: s.x + 20 + i * 3, z: s.z - 10, y: s.y - 1, state: 'cruise', t: 0, dur: 30, active: true, bait: null, fullUntil: 0 }));
  return fish;
};
const startOn = (eco, s) => {
  press(eco, s);
  withDice(() => {
    for (let i = 0; i < 60 && !s.feed; i++) eco.feeding.look();
  });
  return s.feed;
};
const step = (eco, s, secs) => {
  for (let i = 0; i < secs * 30; i++) {
    eco.time += 1 / 30;
    eco.stepSchool(s, 1 / 30, false);
    eco.feeding.step(1 / 30);
  }
};

test('hunters pressing a shoal ball it up and drive it to the top; the hunters near come in', () => {
  const eco = new Ecosystem(habitat);
  settle(eco);
  const s = seaShoal(eco);
  s.y = -6;
  const bass = bassAbout(eco, s);
  // One look's pressing isn't enough: it takes a while.
  press(eco, s);
  eco.feeding.look();
  assert.equal(s.feed, null, 'not on the first look');
  const e = startOn(eco, s);
  assert.ok(e && e.phase === GATHER && e.cause === 'hunters', 'a feed starts');
  step(eco, s, 1.1);
  assert.ok(bass.every((a) => a.shoal === s && Math.hypot(a.tx - s.x, a.tz - s.z) < 7), 'the bass near come in under it');
  assert.ok(e.hunters >= bass.length, `${e.hunters} hunters at it`);
  assert.equal(FISH_ID(e.sp), 'seabass', 'mostly bass');
  // Balled up, holding its ground, driven up.
  const y0 = s.y;
  step(eco, s, 4);
  assert.ok(s.spread < 0.6 && Math.hypot(s.x - e.ax, s.z - e.az) < 4, 'tight, holding its ground');
  assert.ok(s.y > y0 + 0.4, `rising: ${y0.toFixed(1)} to ${s.y.toFixed(1)} m`);
  step(eco, s, 40);
  assert.ok(s.y > FEED.top && e.phase === UP, `at the top (${s.y.toFixed(1)} m)`);
});

test('too few hunters to drive it up: the feed stays down and shows nothing at the top', () => {
  const eco = new Ecosystem(habitat);
  settle(eco);
  const s = seaShoal(eco);
  s.y = -6;
  for (const a of eco.feeding.eaters) a.fullUntil = Infinity;
  for (const H of eco.feeding.hunters) H.rest = 1e6;
  bassAbout(eco, s, 2);
  const e = startOn(eco, s);
  step(eco, s, 20);
  assert.ok(e.phase === GATHER && s.y < -5, `still down at ${s.y.toFixed(1)} m with ${e.hunters} hunters`);
  eco.clues.length = 0;
  step(eco, s, 5);
  assert.ok(!eco.clues.some((c) => c.feed && Math.hypot(c.x - s.x, c.z - s.z) < 30), `nothing at the top (${e.phase} ${e.why} ${e.hunters})`);
});

test('at the top: boils, small fish spraying, a hunter clearing the water, and by day the birds, seen from far off', () => {
  const eco = new Ecosystem(habitat);
  settle(eco);
  const s = seaShoal(eco);
  bassAbout(eco, s, 6);
  const e = startOn(eco, s);
  s.y = -1;
  step(eco, s, 1.1);
  assert.equal(e.phase, UP);
  const kinds = {};
  for (let i = 0; i < 30 * 30; i++) {
    eco.clues.length = 0;
    eco.feeding.show(e, 1 / 30);
    for (const c of eco.clues) kinds[c.type] = (kinds[c.type] || 0) + 1;
    if (eco.clues.some((c) => c.type === 'birds' && c.big)) kinds.big = (kinds.big || 0) + 1;
  }
  assert.ok(kinds.boil >= 15 && kinds.nervous >= 40 && kinds.flash >= 8 && kinds.jump >= 1 && kinds.birds >= 3 && kinds.big === kinds.birds, JSON.stringify(kinds));
  // At night: the boils, but no birds, nothing flashing.
  eco.ctx.daylight = 0;
  const night = {};
  for (let i = 0; i < 30 * 30; i++) {
    eco.clues.length = 0;
    eco.feeding.show(e, 1 / 30);
    for (const c of eco.clues) night[c.type] = (night[c.type] || 0) + 1;
  }
  assert.ok(night.boil > 0 && !night.birds && !night.flash, JSON.stringify(night));
});

test('the fish in a feed take a lure far more readily, a small fish’s likeness most of all', () => {
  const eco = new Ecosystem(habitat);
  settle(eco);
  const s = seaShoal(eco);
  const [bass] = bassAbout(eco, s, 1);
  const tries = (feed, item, kind = 'lure') => {
    let n = 0;
    const engage = eco.engage;
    eco.engage = () => n++;
    try {
      withDice(() => {
        for (let i = 0; i < 4000; i++) {
          Object.assign(bass, { x: s.x + 2, y: s.y - 0.5, z: s.z, wary: 0, shoal: feed ? s : null, caught: 0 });
          Object.assign(eco.bait, { active: true, kind, item, motion: 'fast', x: s.x + 5, y: s.y - 0.5, z: s.z, owner: null, held: false, fresh: 0, natural: kind !== 'lure', boost: 1 });
          eco.considerOne(bass, eco.bait);
        }
      }, 11);
    } finally {
      eco.engage = engage;
    }
    return n;
  };
  const before = { metal: tries(false, 'metal'), worm: tries(false, 'rag', 'float') };
  const e = startOn(eco, s);
  assert.ok(e);
  const during = { metal: tries(true, 'metal'), worm: tries(true, 'rag', 'float') };
  assert.ok(during.metal >= before.metal * 2.5, `a metal: ${before.metal} before, ${during.metal} in the feed`);
  assert.ok(during.worm > before.worm && during.worm < during.metal * (before.worm / Math.max(1, before.metal)) * 1.2 + 5, `a worm: ${before.worm} before, ${during.worm} in the feed`);
});

test('it disperses: the ball breaks and goes deep, the hunters drift off fed, and the water stays quiet a while', () => {
  const eco = new Ecosystem(habitat);
  settle(eco);
  const s = seaShoal(eco);
  const bass = bassAbout(eco, s, 5);
  const e = startOn(eco, s);
  s.y = -1;
  step(eco, s, 2);
  e.life = e.t + 0.5;
  step(eco, s, 1);
  assert.ok(e.phase === OVER && e.why === 'fed', `over (${e.why})`);
  assert.ok(s.scatterT > 1.5, 'the ball breaks');
  assert.ok(bass.every((a) => a.shoal !== s && a.fullUntil > eco.time + 100), 'the hunters drift off fed');
  // A fed hunter leaves the small fish alone a while.
  const a = bass[0];
  withDice(() => eco.pickPoint(a, 'cruise'));
  assert.ok(!a.atPrey, 'fed: it doesn’t go back to the shoal');
  step(eco, s, 6);
  assert.ok(s.y < -1.5, `the shoal goes down (${s.y.toFixed(1)} m)`);
  step(eco, s, FEED.linger);
  assert.ok(e.done && s.feed === null && !eco.feeding.events.includes(e), 'gone');
  // Quiet: pressed again, here or near, no feed for a while; far off, one can.
  for (const a of bass) a.fullUntil = 0;
  press(eco, s);
  withDice(() => { for (let i = 0; i < 10; i++) eco.feeding.look(); });
  assert.equal(s.feed, null, 'the water stays quiet');
  const other = eco.forage.find((f) => f !== s && !f.home.south && f.sp.id !== 'roach' && f.sp.id !== 'rudd' && habitat.depth(f.x, f.z) > 4 && Math.hypot(f.x - s.x, f.z - s.z) > FEED.quietR + 50);
  eco.focus = { x: other.x, z: other.z };
  assert.ok(startOn(eco, other), 'further off, a feed can start');
});

test('a boat running through a feed breaks it up; the ball eaten down ends it; so do the hunters going', () => {
  const eco = new Ecosystem(habitat);
  settle(eco);
  const s = seaShoal(eco);
  bassAbout(eco, s, 5);
  let e = startOn(eco, s);
  eco.feeding.boatThrough(s.x + 20, s.z, 8);
  assert.equal(e.phase, GATHER, '20 m off: nothing');
  eco.feeding.boatThrough(s.x + 4, s.z, 2);
  assert.equal(e.phase, GATHER, 'creeping by: nothing');
  eco.feeding.boatThrough(s.x + 4, s.z, 8);
  assert.ok(e.phase === OVER && e.why === 'boat', 'flat out through it: broken up');
  // The ball eaten down to what it can spare.
  eco.feeding.end(e);
  eco.feeding.events.length = 0;
  eco.feeding.quiet.length = 0;
  e = startOn(eco, s);
  let k = 0;
  for (const m of s.members) if (k++ < Math.floor(s.members.length / 3) + 1) m.state = 'gone';
  step(eco, s, 0.1);
  assert.ok(e.phase === OVER && e.why === 'eaten', `eaten down (${e.why})`);
  // The hunters gone (the light going: none keen).
  eco.feeding.end(e);
  eco.feeding.events.length = 0;
  eco.feeding.quiet.length = 0;
  for (const m of s.members) m.state = 'school';
  e = startOn(eco, s);
  for (const id in eco.activity) eco.activity[id] = 0.1;
  step(eco, s, FEED.none + 3);
  assert.ok(e.phase === OVER && e.why === 'gone', `the hunters went (${e.why})`);
});

test('an empty sea: with no hunters pressing a shoal, no feed starts near anyone; far off, only when they’re keen', () => {
  const eco = new Ecosystem(habitat);
  settle(eco);
  const s = seaShoal(eco);
  for (const f of eco.forage) f.threat = 0;
  withDice(() => { for (let i = 0; i < 200; i++) eco.feeding.look(); });
  const near = eco.feeding.events.filter((e) => e.cause !== 'far');
  assert.equal(near.length, 0, 'none near');
  // Far off (beyond the 240 m the fish are kept going round anyone): by chance, by how keen.
  eco.feeding.events.length = 0;
  for (const f of eco.forage) f.feed = null;
  eco.focus = { x: s.x + 500, z: s.z };
  for (const id in eco.activity) eco.activity[id] = 0.4;
  withDice(() => { for (let i = 0; i < 5000; i++) eco.feeding.look(); });
  assert.equal(eco.feeding.events.length, 0, 'not keen: none');
  for (const id in eco.activity) eco.activity[id] = 1;
  withDice(() => { for (let i = 0; i < 5000 && !eco.feeding.events.length; i++) eco.feeding.look(); });
  const far = eco.feeding.events[0];
  assert.ok(far && far.cause === 'far', 'keen: one starts, now and then');
  // It runs on without the fish: driven up all the same if there are hunters about.
  far.hunters = 6;
  for (let i = 0; i < 30 * 60; i++) eco.feeding.advance(far, 1 / 30, false);
  assert.ok(far.s.y > FEED.top - 0.5, `up (${far.s.y.toFixed(1)} m)`);
});

test('a hunting shoal’s frenzy on a shoal of small fish is a feed', () => {
  const eco = new Ecosystem(habitat);
  settle(eco, 12, 1);
  const mk = eco.schools.find((f) => f.sp.id === 'mackerel');
  const sp = eco.forage.find((f) => f.sp.id === 'sprat' && mk.L.zones.includes(f.home.zone) && !f.home.south);
  eco.focus = { x: sp.x, z: sp.z };
  Object.assign(mk, { prey: sp, frenzy: 30, rest: 0 });
  eco.feeding.look();
  assert.ok(sp.feed && sp.feed.cause === 'shoal');
});

test('the host decides each feed; a guest sees the same one, and never starts its own', () => {
  const host = new Ecosystem(habitat), guest = new Ecosystem(habitat);
  guest.follower = true;
  settle(host);
  settle(guest);
  const s = seaShoal(host);
  bassAbout(host, s, 6);
  const e = startOn(host, s);
  s.y = -1;
  step(host, s, 1.2);
  assert.equal(e.phase, UP);
  const snap = { v: 1, ep: 'x', sq: 1, t: 0, s: null, k: host.captureSchools([{ x: s.x + 600, z: s.z }], 260, 130, true), e: host.feeding.capture() };
  assert.ok(snap.k.some((r) => r[0] === s.id), 'its shoal goes, however far from anyone');
  const wire = JSON.parse(JSON.stringify(snap));
  guest.applySchools(wire.k, 0.1);
  guest.feeding.apply(wire.e);
  const g = guest.schools[s.id].feed;
  assert.ok(g && g.phase === UP && g.hunters === e.hunters && Math.abs(g.t - e.t) < 0.1 && g.sp === e.sp, 'the same feed');
  // The guest shows the top of it, where the host's is.
  guest.netT = 0;
  guest.clues.length = 0;
  for (let i = 0; i < 60; i++) guest.feeding.step(1 / 30);
  const boils = guest.clues.filter((c) => c.feed);
  assert.ok(boils.length && boils.every((c) => Math.hypot(c.x - s.x, c.z - s.z) < 6), 'at the host’s ball');
  // A guest's own sea never starts one.
  const gs = guest.forage.find((f) => f !== guest.schools[s.id]);
  press(guest, gs);
  guest.focus = { x: gs.x, z: gs.z };
  for (let i = 0; i < 200; i++) guest.feeding.step(0.1);
  assert.ok(!gs.feed, 'none of its own');
  // Over on the host: over on the guest; gone from the host's word: gone.
  host.feeding.disperse(e, 'fed');
  guest.feeding.apply(JSON.parse(JSON.stringify(host.feeding.capture())));
  assert.equal(g.phase, OVER);
  guest.feeding.apply([]);
  assert.ok(!guest.schools[s.id].feed && !guest.feeding.events.length);
});

test('a snapshot’s feeds are checked: sound ones pass, junk is refused, and an older host’s (none) is fine', () => {
  const eco = new Ecosystem(habitat);
  const counts = { pods: [], whales: 0, seals: 0, turtles: 0, schools: eco.schools.length, agents: eco.agents.length };
  const base = () => ({ v: 1, ep: 'x', sq: 1, t: 0, s: { p: [], w: [], s: [], u: [], g: null, h: null }, k: [] });
  assert.ok(cleanShared(base(), counts), 'none: fine');
  assert.ok(cleanShared({ ...base(), e: [[3, 1, 12.5, 200, 6, 4, 100.5, -20]] }, counts));
  for (const bad of [[[3, 5, 1, 1, 1, 1, 0, 0]], [[3, 1, 1, 1, 1, 1, 0]], [[1e6, 1, 1, 1, 1, 1, 0, 0]], [[3, 1, 'x', 1, 1, 1, 0, 0]], 'x', new Array(9).fill([3, 1, 1, 1, 1, 1, 0, 0])]) assert.equal(cleanShared({ ...base(), e: bad }, counts), null, JSON.stringify(bad).slice(0, 40));
  assert.ok(typeof countsOf === 'function');
});

test('the gannets come to a feed first; between feeds, a shoal at the top by itself brings them only now and then', async () => {
  const THREE = await import('three');
  // (Sea life draws its textures on a canvas: a stand-in, as in sealife.test.mjs.)
  const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
  const { buildSeaLife } = await import('../src/world/sealife.js');
  const scene = new THREE.Scene();
  const ctxFor = (from, extra = {}) => ({ from, boat: null, boatSpeed: 0, daylight: 1, region: 'home', eco: null, diving: false, ...extra });
  // A sprat shoal at the top near you, and a feed on another a little further off.
  const near = { id: 1, sp: { id: 'sprat' }, x: 60, z: 420, y: -1, home: {} };
  const fed = { id: 2, sp: { id: 'sandsmelt' }, x: 160, z: 380, y: -1, home: {} };
  const feed = { s: fed, phase: UP, t: 10, overAt: 0, done: false };
  const eco = { schools: [near, fed], feeding: { events: [feed] } };
  const life = buildSeaLife(scene);
  const plunges = [];
  life.onPlunge = (x, z) => plunges.push({ x, z });
  let t = 0;
  for (let i = 0; i < 30 * 40; i++) {
    t += 1 / 30;
    life.update(1 / 30, t, ctxFor({ x: 20, z: 400 }, { eco }));
  }
  assert.ok(life.feeding?.school === fed, 'down on the feed, not the nearer shoal');
  assert.ok(plunges.length >= 3 && plunges.every((p) => Math.hypot(p.x - fed.x, p.z - fed.z) < 8), `${plunges.length} plunges, into the feed`);
  // The feed breaks up: they go a little after.
  feed.phase = OVER;
  feed.overAt = feed.t;
  feed.t += 11;
  for (let i = 0; i < 30 * 30; i++) {
    t += 1 / 30;
    life.update(1 / 30, t, ctxFor({ x: 20, z: 400 }, { eco }));
  }
  assert.ok(!life.feeding || life.feeding.school !== fed, 'gone from it');
  // Then the shoal at the top by itself: once, and not again for minutes.
  eco.feeding.events = [];
  const starts = [];
  let was = life.feeding;
  for (let i = 0; i < 30 * 200; i++) {
    t += 1 / 30;
    life.update(1 / 30, t, ctxFor({ x: 20, z: 400 }, { eco }));
    if (life.feeding && life.feeding !== was) starts.push(t);
    was = life.feeding;
  }
  assert.ok(starts.length <= 1, `${starts.length} flocks on the lone shoal in 200 s`);
});
