// A friend's fight, as you see it (src/together.js, src/world/visitors.js, src/fightshow.js): what
// they send of the fish on their line (what it is, how big, what it's doing, landed), and the
// show at the end of their line on your screen: the take, the fish itself in the air in a leap, the
// crash back in by its size, a billfish's tail-walk, the landing splash. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { cleanPose, FISH_MOVES } = await import('../src/together.js');
const { VisitorView } = await import('../src/world/visitors.js');
const { fishById } = await import('../src/fish.js');

test('what a friend sends of the fish on their line: what it is, how big, landed; junk thrown out; a long run still shown', () => {
  const base = { m: 'boat', k: 'console', x: 100, z: 400, h: 0, f: true, o: true, r: 'biggame', ex: 160, ez: 420, tn: 0.6 };
  const P = cleanPose({ ...base, mv: 'jump', sp: 'bluemarlin', sz: 290 });
  assert.equal(P.sp, 'bluemarlin');
  assert.equal(P.sz, 290);
  assert.equal(P.mv, 'jump');
  assert.equal(cleanPose({ ...base, mv: 'land', sp: 'seabass', sz: 60 }).mv, 'land');
  assert.ok(FISH_MOVES.includes('land'));
  // Junk: not a species id, a size no fish is, or no fish on at all.
  assert.equal(cleanPose({ ...base, sp: '<img onerror=x>', sz: 60 }).sp, undefined);
  assert.equal(cleanPose({ ...base, sp: 'seabass', sz: 9999 }).sz, undefined);
  assert.equal(cleanPose({ ...base, sp: 'seabass', sz: 'big' }).sz, undefined);
  assert.equal(cleanPose({ ...base, o: false, sp: 'seabass', sz: 60 }).sp, undefined);
  // A marlin 500 m off on a long run is still at the end of their line; 900 m is not believed.
  assert.equal(cleanPose({ ...base, ex: 600, ez: 400 }).ex, 600);
  assert.equal(cleanPose({ ...base, ex: 1000, ez: 400 }).ex, undefined);
});

// The water effects, counted.
function fakeFx() {
  const log = { drops: 0, splashes: [], sprays: 0, ripples: 0 };
  return {
    log,
    splash: (x, y, z, n, power, spread) => { log.splashes.push({ n, spread }); log.drops += n; },
    spray: () => { log.sprays++; log.drops++; },
    ripple: () => log.ripples++,
    flash: () => {},
    field: { on: false, add: () => {} },
  };
}

// A friend's fight watched from 30 m: no fish, then a fish on, running, a leap, running, landed.
function watch(sp, sz, { audio = null } = {}) {
  const view = new VisitorView(new THREE.Scene());
  view.audio = audio;
  const fx = fakeFx(), d = { end: { x: 60, z: 0 }, line: null };
  const pose = (o, mv) => ({ m: 'boat', x: 0, z: 0, o, mv, sp, sz, r: 'sea', tn: 0.6 });
  let t = 0, top = -9, fishSeen = 0, fishAbove = 0;
  const run = (P, secs) => {
    for (let i = 0; i < secs * 60; i++, t += 1 / 60) {
      d.end.x += 2 / 60;
      view.fishAtEnd(d, P, 1 / 60, t, fx, { x: 30, z: 0 });
      if (d.fishMesh?.visible) {
        fishSeen++;
        top = Math.max(top, d.fishMesh.position.y);
        if (d.fishMesh.position.y > 0.05) fishAbove++;
      }
    }
  };
  run(pose(false), 0.5);
  const beforeStrike = fx.log.drops;
  run(pose(true, 'run'), 0.2);
  const strike = fx.log.drops - beforeStrike;
  run(pose(true, 'run'), 1.5);
  const beforeLeap = fx.log.drops;
  run(pose(true, 'jump'), 0.8);
  run(pose(true, 'run'), 2.5);
  const leapDrops = fx.log.drops - beforeLeap;
  const beforeLand = fx.log.drops;
  run(pose(true, 'land'), 0.3);
  const land = fx.log.drops - beforeLand;
  run(pose(false), 0.5);
  return { fx, d, strike, leapDrops, land, top, fishSeen, fishAbove };
}

test('watching a friend’s fight: the take, the fish itself in the air as it leaps, the crash back in by its size, the landing splash', () => {
  const bass = watch('seabass', 70), mack = watch('mackerel', 30), marlin = watch('bluemarlin', 300);
  for (const w of [bass, mack, marlin]) {
    assert.ok(w.strike > 0, 'the take');
    assert.ok(w.fishAbove > 10, 'the fish seen clear of the water');
    assert.ok(w.land > 10, 'the landing splash');
    assert.ok(!w.d.fishMesh.visible, 'and gone when it’s over');
  }
  // As big as it is: a marlin's leap goes higher and throws more water than a bass's, a bass's
  // than a mackerel's.
  assert.ok(marlin.top > bass.top && bass.top > mack.top, `${marlin.top} ${bass.top} ${mack.top}`);
  assert.ok(marlin.leapDrops > bass.leapDrops && bass.leapDrops > mack.leapDrops, `${marlin.leapDrops} ${bass.leapDrops} ${mack.leapDrops}`);
  // A marlin walks on its tail and greyhounds: more small splashes, and several crashes back in.
  assert.ok(marlin.fx.log.splashes.filter((s) => s.spread < 0.8).length > 3);
  // Drawn as itself, and the right size.
  assert.equal(marlin.d.fishMesh.userData.sp, 'bluemarlin');
  assert.ok(Math.abs(marlin.d.fishMesh.scale.x - 3 * fishById.bluemarlin.visual) < 1e-6);
});

test('come by mid-fight and there’s no take to see; their splashes you hear only near enough', () => {
  const view = new VisitorView(new THREE.Scene());
  let big = 0, small = 0;
  view.audio = { splashBig: () => big++, splashSmall: () => small++ };
  const fx = fakeFx(), d = { end: { x: 0, z: 0 }, line: null };
  // First seen with a fish already on: no take.
  view.fishAtEnd(d, { m: 'boat', x: 0, z: -20, o: true, mv: 'run', sp: 'tuna', sz: 150 }, 1 / 60, 0, fx, { x: 0, z: -25 });
  assert.equal(fx.log.drops, 0);
  // A leap 25 m off: heard. The same leap 200 m off: not.
  const leap = (from) => {
    const before = big + small;
    for (let i = 0; i < 90; i++) view.fishAtEnd(d, { m: 'boat', x: 0, z: -20, o: true, mv: i < 45 ? 'jump' : 'run', sp: 'tuna', sz: 150 }, 1 / 60, 1 + i / 60, fx, from);
    return big + small - before;
  };
  assert.ok(leap({ x: 0, z: -25 }) > 0);
  d.mvWas = 'run';
  assert.equal(leap({ x: 0, z: -200 }), 0);
});
