// How a fight looks on the water (src/fightshow.js): the take, leaps, runs, the line, the thrash
// alongside and the landing, each by the fish. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FightShow, bigness, leapHeight, leapStyle } from '../src/fightshow.js';
import { fishById } from '../src/fish.js';

// The water effects, counted: how many drops each splash and spray throws, how big the rings.
function fakeFx() {
  const log = { drops: 0, splashes: [], sprays: 0, ripples: [], flashes: 0, field: 0 };
  return {
    log,
    splash: (x, y, z, n, power, spread) => { log.splashes.push({ n, power, spread }); log.drops += n; },
    spray: () => { log.sprays++; log.drops++; },
    ripple: (x, z, size) => log.ripples.push(size),
    flash: () => log.flashes++,
    field: { on: true, add: () => log.field++ },
  };
}
const fakeAudio = () => ({ big: 0, small: 0, splashBig() { this.big++; }, splashSmall() { this.small++; } });
const fightOf = (id, k = 0.85, extra = {}) => {
  const sp = fishById[id];
  return { sp, size: sp.size[0] + (sp.size[1] - sp.size[0]) * k, sizeK: k, tension: 0.5, pulling: true, stage: 'fresh', leapT: 0, ...extra };
};

// A leap from start to finish (and any skips after it), at 60 frames a second.
function leapThrough(id, k = 0.85) {
  const fx = fakeFx(), audio = fakeAudio(), shakes = [];
  const show = new FightShow(fx, audio, { shake: (s) => shakes.push(s) });
  const F = fightOf(id, k, { leapT: 0.75 });
  let top = -9, reentries = 0, airborne = 0, maxPitch = 0, maxYaw = 0;
  const before = () => fx.log.splashes.length;
  for (let i = 0; i < 240; i++) {
    const n0 = before();
    const o = show.leap(F, 1 / 60, i / 60, 0, -0.4, 0, 0);
    top = Math.max(top, o.y);
    if (o.airborne) airborne++;
    maxPitch = Math.max(maxPitch, o.pitch);
    maxYaw = Math.max(maxYaw, Math.abs(o.yaw));
    // (A crash back in: the widest splash of the lot.)
    if (fx.log.splashes.length > n0 && fx.log.splashes.at(-1).spread >= 0.8) reentries++;
  }
  return { fx, audio, top, reentries, airborne, maxPitch, maxYaw, shakes, F };
}

test('how big a fish is, for the show, and how high each kind leaps', () => {
  assert.ok(bigness(30) < bigness(60) && bigness(60) === 1 && bigness(250) > 4);
  const mackerel = fishById.mackerel, bass = fishById.seabass, marlin = fishById.bluemarlin;
  // Bigger fish, higher; a marlin clears a couple of metres; a mackerel a hand's breadth or so.
  assert.ok(leapHeight(mackerel, 35) < leapHeight(bass, 70) && leapHeight(bass, 70) < leapHeight(marlin, 300));
  assert.ok(leapHeight(marlin, 300) > 2 && leapHeight(mackerel, 35) < 0.6);
  // (Most of the body clears: the middle at least half a body length up.)
  for (const [sp, size] of [[bass, 70], [marlin, 300]]) assert.ok(leapHeight(sp, size, 0.8) >= (size / 100) * 0.5);
  assert.ok(leapStyle(marlin).tailwalk && leapStyle(marlin).greyhound >= 2 && !leapStyle(bass).tailwalk);
});

test('a leap: up clear of the water and back, the sea streaming off it, its head shaking, one crash back in, bigger for a bigger fish', () => {
  const small = leapThrough('seabass', 0.1), big = leapThrough('seabass', 1);
  for (const L of [small, big]) {
    assert.equal(L.reentries, 1, 'one crash back in');
    assert.ok(L.airborne > 10 && L.maxPitch > 0.8 && L.maxYaw > 0.05);
    assert.ok(L.fx.log.sprays > 5, 'water streaming off it and thrown out round it');
  }
  assert.ok(big.top > small.top, `${big.top} vs ${small.top}`);
  const crash = (L) => L.fx.log.splashes.reduce((m, s) => Math.max(m, s.n), 0);
  assert.ok(crash(big) > crash(small) && big.fx.log.drops > small.fx.log.drops * 1.2, `${big.fx.log.drops} vs ${small.fx.log.drops} drops`);
  assert.ok(Math.max(...big.fx.log.ripples) > Math.max(...small.fx.log.ripples));
});

test('a marlin walks on its tail and greyhounds on, and you feel it come down', () => {
  const m = leapThrough('bluemarlin', 0.8), bass = leapThrough('seabass', 0.8);
  // Tail-walking: a run of small splashes across the top in the middle of the leap.
  assert.ok(m.fx.log.splashes.filter((s) => s.spread < 0.8).length > 3);
  // Greyhounding: more crashes back in after the first.
  assert.ok(m.reentries >= 3, `${m.reentries} crashes`);
  assert.ok(m.top > 2 && m.audio.big >= 1 && m.shakes.length >= 1);
  assert.equal(bass.F.skips ?? 0, 0);
});

test('the take: an eruption at the top, a swirl down deep, bigger for a bigger fish', () => {
  const at = (id, k, surface) => {
    const fx = fakeFx(), show = new FightShow(fx, fakeAudio());
    show.strike(fightOf(id, k), { x: 0, y: -0.3, z: 0 }, 0, surface);
    return fx.log;
  };
  const top = at('seabass', 0.9, true), deep = at('seabass', 0.9, false), little = at('seabass', 0.05, true);
  assert.ok(top.drops > 20 && deep.drops === 0 && deep.ripples.length >= 2);
  assert.ok(top.drops > little.drops);
});

test('a run along the top leaves a V in the water and throws spray; deep down, nothing shows', () => {
  const run = (depth, speed) => {
    const fx = fakeFx(), show = new FightShow(fx, fakeAudio());
    const F = fightOf('tuna', 0.8);
    for (let i = 0; i < 60; i++) show.frame(F, 1 / 60, i / 60, { x: i * speed / 60, y: -depth, z: 0 }, 0);
    return fx.log;
  };
  const top = run(0.2, 5), deep = run(4, 5), slow = run(0.2, 0.3);
  assert.ok(top.ripples.length >= 10 && top.sprays > 10, `${top.ripples.length} rings, ${top.sprays} drops`);
  assert.equal(deep.ripples.length + deep.sprays, 0);
  assert.equal(slow.ripples.length, 0);
});

test('the line cuts the water as the fish swings, and lifts off the top in drops as it comes tight', () => {
  const fx = fakeFx(), show = new FightShow(fx, fakeAudio());
  const F = fightOf('seabass', 0.8, { tension: 0.7 });
  // A line from a rod tip 2 m up, down into the water 12 m off, swinging across at 4 m/s.
  const n = 20, line = new Float32Array(n * 3);
  const lay = (sx) => {
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      line[i * 3] = sx * u;
      line[i * 3 + 1] = 2 - 3 * u;
      line[i * 3 + 2] = 18 * u;
    }
  };
  for (let i = 0; i < 30; i++) {
    lay(i * 4 / 60);
    show.frame(F, 1 / 60, i / 60, { x: 0, y: -2, z: 20 }, 0, { line, n, waterAt: () => 0 });
  }
  assert.ok(fx.log.sprays > 20, `${fx.log.sprays} drops off the line`);
  // Held still: nothing.
  const still = fakeFx(), show2 = new FightShow(still, fakeAudio());
  lay(0);
  for (let i = 0; i < 30; i++) show2.frame(F, 1 / 60, i / 60, { x: 0, y: -2, z: 20 }, 0, { line, n, waterAt: () => 0 });
  assert.equal(still.log.sprays, 0);
  // A surge: drops all along where the line lies near the top.
  const surge = fakeFx(), show3 = new FightShow(surge, fakeAudio());
  for (let i = 0; i < n; i++) line[i * 3 + 1] = i > 4 ? 0.05 : 1;
  show3.frame(F, 1 / 60, 0, { x: 0, y: -2, z: 20 }, 0, { ev: 'run', line, n, waterAt: () => 0 });
  assert.ok(surge.log.sprays >= 10);
});

test('close in and still fighting, it thrashes at the top; landed, it comes out with a splash and the water pours off the net', () => {
  const fx = fakeFx(), audio = fakeAudio(), show = new FightShow(fx, audio);
  const F = fightOf('seabass', 0.9);
  for (let i = 0; i < 120; i++) show.frame(F, 1 / 60, i / 60, { x: 0, y: -0.2, z: 0 }, 0, { near: 3 });
  assert.ok(fx.log.splashes.length >= 4 && audio.small >= 4);
  // Beaten, it lies still.
  const quiet = fakeFx(), show2 = new FightShow(quiet, fakeAudio());
  for (let i = 0; i < 120; i++) show2.frame({ ...F, stage: 'beaten', pulling: false }, 1 / 60, i / 60, { x: 0, y: -0.2, z: 0 }, 0, { near: 3 });
  assert.equal(quiet.log.splashes.length, 0);
  // Netted: a splash, and the net streaming water as it comes up, then dry.
  const land = fakeFx(), show3 = new FightShow(land, fakeAudio());
  const net = { x: 0, y: 0.5, z: 0 };
  show3.landed(F, { x: 0, y: -0.2, z: 0 }, 0, true, () => net);
  assert.ok(land.log.splashes[0].n > 30);
  const s0 = land.log.sprays;
  for (let i = 0; i < 60; i++) show3.update(1 / 60);
  assert.ok(land.log.sprays - s0 > 30, 'pouring off the net');
  for (let i = 0; i < 60; i++) show3.update(1 / 60);
  const s1 = land.log.sprays;
  for (let i = 0; i < 60; i++) show3.update(1 / 60);
  assert.equal(land.log.sprays, s1, 'and then it stops');
});
