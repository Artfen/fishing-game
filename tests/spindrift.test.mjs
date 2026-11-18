// (W6, second part) Spray and spindrift (see spindrift.js and storm.js): what a strong wind tears
// off the crests breaking round you, and how it flies. Torn only from crests that are breaking
// (ocean.js breakingAt; where they break, tests/choppy.test.mjs), in proportion to how hard, and
// only in a wind strong enough to tear them; each drop pulled to the wind's speed and falling at
// its own; and the foam streaks on the water by the Beaufort scale. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };

const THREE = await import('three');
const D = await import('../src/world/spindrift.js');
const O = await import('../src/world/ocean.js');
const C = await import('../src/world/conditions.js');
const T = await import('../src/world/terrain.js');
const { Storm } = await import('../src/world/storm.js');

const { longSea } = O;

// The wind sea in a wind of u m/s from the west, as conditions.js sets it (its height for this
// wind, its crests sharp), worked forward a few seconds so its crests have broken. (Each later
// than the last: the foam only builds going forward in time.)
let clock = 200;
function blow(u) {
  const t0 = (clock += 100);
  C.conditions.wind.speed = u;
  C.conditions.wind.from = -Math.PI / 2;
  const chop = 0.02 + 0.005 * Math.pow(u, 1.75), to = C.conditions.wind.from + Math.PI;
  longSea.setWind(u, Math.atan2(-Math.cos(to), Math.sin(to)), (chop * chop) / 4, 0.8);
  for (let t = t0; t <= t0 + 4; t += 0.05) longSea.at(t);
  return t0 + 4;
}

// Somewhere well out at sea: open to the wind, deep, the whole wind sea.
let OPEN = null;
for (let x = -400; x < 800 && !OPEN; x += 20) {
  for (let z = -800; z < 1200 && !OPEN; z += 20) {
    if (T.freshness(x, z) > 0 || -T.solidHeight(x, z) < 25) continue;
    let ok = true;
    for (let a = 0; a < 8 && ok; a++) {
      const px = x + 55 * Math.cos(a), pz = z + 55 * Math.sin(a);
      ok = C.seaShareAt(px, pz) > 0.97 && C.seaShareAt(x, z) > 0.97;
    }
    if (ok) OPEN = { x, z };
  }
}

test('spume is torn off the crests only in a strong wind: from 7 to 11 m/s, and more of it the harder it blows', () => {
  assert.equal(D.spumeShare(5), 0);
  assert.equal(D.spumeShare(7), 0);
  assert.equal(D.spumeShare(11), 1);
  assert.equal(D.spumeRate(6.9), 0, 'none in a moderate breeze');
  assert.ok(D.spumeRate(9) > 0, 'some at the usual rule of thumb, 9 m/s');
  for (let u = 0; u < 30; u += 0.5) assert.ok(D.spumeRate(u + 0.5) >= D.spumeRate(u) - 1e-12);
  assert.ok(D.spumeRate(20) / D.spumeRate(14) > 2, 'twice as much off each crest in a strong gale as at force 7');
  // The wind a metre or two above the waves: about 0.8 of the 10 m wind.
  assert.ok(D.SURFACE_WIND > 0.75 && D.SURFACE_WIND < 0.85);
});

test('foam blown in streaks on the water by the Beaufort scale, and the water draws it by the same numbers', async () => {
  assert.equal(D.streakShare(13.8), 0, 'none at force 6');
  assert.ok(D.streakShare(15.5) > 0.05 && D.streakShare(15.5) < 0.3, 'beginning at force 7');
  assert.ok(D.streakShare(19) > 0.7, 'well marked at force 8');
  assert.equal(D.streakShare(20.8), 1, 'dense at force 9');
  // (The shader's own: its source with the numbers put in.)
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/world/water.js', import.meta.url), 'utf8');
  assert.match(src, /float streakF = smoothstep\(\$\{STREAKS\[0\]\.toFixed\(1\)\}, \$\{STREAKS\[1\]\.toFixed\(1\)\}, uWindMS\)/);
  assert.match(src, /\* shel\.g \* streakF;/, 'the streaks by the wind, not the storm');
  assert.equal(D.STREAKS[0].toFixed(1), '13.9');
});

test('a drop flies as a drop does: pulled to the wind, falling at its own speed, worked out exactly whatever the step', () => {
  const g = 9.81;
  for (const vt of [0.4, 1, 4]) {
    // In still air it settles to falling at vt; in a wind, to moving with it.
    const p = { x: 0, y: 0, z: 0, vx: 3, vy: 5, vz: -2 };
    for (let i = 0; i < 400; i++) D.fly(p, 12, -5, vt, 0.02);
    assert.ok(Math.abs(p.vx - 12) < 1e-6 && Math.abs(p.vz + 5) < 1e-6 && Math.abs(p.vy + vt) < 1e-6, `${vt}: ${p.vx} ${p.vy} ${p.vz}`);
    // Its slip has fallen to 1/e in vt/g.
    const q = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
    D.fly(q, 10, 0, vt, vt / g);
    assert.ok(Math.abs((10 - q.vx) / 10 - Math.exp(-1)) < 1e-9);
    // One long step is the same as many short ones (an exact solution, not a step-by-step guess).
    const a = { x: 1, y: 2, z: 3, vx: -1, vy: 4, vz: 2 }, b = { ...a };
    D.fly(a, 15, 3, vt, 0.5);
    for (let i = 0; i < 50; i++) D.fly(b, 15, 3, vt, 0.01);
    for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${k}: ${a[k]} ${b[k]}`);
  }
  // In an eddy going up at wy it settles to rising at wy − vt (the finest carried up and along).
  const e = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  for (let i = 0; i < 200; i++) D.fly(e, 14, 0, 0.4, 0.02, 0.9);
  assert.ok(Math.abs(e.vy - 0.5) < 1e-6 && e.y > 1.5, `${e.vy} m/s, ${e.y.toFixed(2)} m up`);
  // The air's eddies over the sea: 1.25·u*, u* = √Cd·U (Large and Pond's drag coefficient), half a
  // metre a second in a near gale, about one in a gale.
  assert.equal(D.dragCoefficient(8), 1.2e-3);
  assert.ok(Math.abs(D.dragCoefficient(18.5) - (0.49 + 0.065 * 18.5) * 1e-3) < 1e-12);
  assert.ok(Math.abs(D.eddySpread(14) - 0.65) < 0.01 && Math.abs(D.eddySpread(18.5) - 0.95) < 0.01, `${D.eddySpread(14)} ${D.eddySpread(18.5)}`);
  // With no drag to speak of (a heavy drop) it's a thrown stone's arc.
  const s = { x: 0, y: 0, z: 0, vx: 0, vy: 5, vz: 0 };
  D.fly(s, 0, 0, 1e4, 0.5);
  assert.ok(Math.abs(s.y - (5 * 0.5 - 0.5 * g * 0.25)) < 1e-3);
  // The finest catch the wind within a tenth of a second and stream away low; heavy spray arcs up
  // and comes down close by.
  const fine = { x: 0, y: 0, z: 0, vx: 0, vy: 1, vz: 0 }, heavy = { x: 0, y: 0, z: 0, vx: 0, vy: 3, vz: 0 };
  const tf = D.flightTime(1, 0.4, 1), th = D.flightTime(3, 4, 1);
  D.fly(fine, 14, 0, 0.4, tf);
  D.fly(heavy, 14, 0, 4, th);
  assert.ok(fine.x > 25 && heavy.x < 12, `the fine drops ${fine.x.toFixed(0)} m downwind, the heavy ${heavy.x.toFixed(1)} m`);
});

test('how long a drop is in the air: it comes down exactly the height asked', () => {
  for (const [vy, vt, drop] of [[1, 0.4, 1], [0.5, 1.6, 0.3], [3, 4, 1.2], [2, 2.5, 0.25], [0, 0.35, 2]]) {
    const t = D.flightTime(vy, vt, drop), p = { x: 0, y: 0, z: 0, vx: 0, vy, vz: 0 };
    D.fly(p, 0, 0, vt, t);
    assert.ok(Math.abs(p.y + drop) < 1e-6, `${vy} ${vt} ${drop}: ${p.y} after ${t}`);
    assert.ok(p.vy < 0, 'coming down');
  }
});

// How many puffs there should be: spumeRate(u) a second from each square metre breaking (as hard
// as it's breaking, the sea's share there squared), worked out here over the same circle round
// (x, z) at time t.
function expected(x0, z0, t, N = 3000) {
  let sum = 0;
  const R = 50;
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = R * Math.sqrt(Math.random());
    const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r, s = C.seaShareAt(x, z);
    sum += longSea.breaking(x, z) * s * s * D.spumeRate(C.windAt(x, z, t).speed);
  }
  return (sum / N) * Math.PI * R * R;
}

// The storm's drops, with the camera at sea level well out: run for a while, counting the puffs
// made a second and the puffs there should have been (as the crests breaking came and went).
function runSpray(u, seconds, { breaking = true } = {}) {
  const t0 = blow(u);
  const S = new Storm(new THREE.Scene());
  const cam = new THREE.Vector3(OPEN.x, 3, OPEN.z);
  const dt = 1 / 30;
  let t = t0, want = 0, n = 0;
  for (let k = 0; k < seconds / dt; k++) {
    t += dt;
    C.conditions.time = t;
    longSea.at(t);
    if (!breaking) longSea.brk.fill(0);
    if (k % 6 === 0) {
      want += expected(OPEN.x, OPEN.z, t);
      n++;
    }
    S.updateSpray(dt, t, 0, cam);
  }
  return { S, t, cam, rate: S.spumeMade / seconds, want: want / n };
}

test('spindrift: as many puffs as the crests breaking round you and the wind give, and none without either', () => {
  assert.ok(OPEN, 'somewhere well out at sea');
  const run = runSpray(18, 6), { rate, want } = run;
  assert.ok(want > 200, `${want.toFixed(0)} puffs a second expected in a gale`);
  assert.ok(Math.abs(rate / want - 1) < 0.15, `${rate.toFixed(0)} puffs a second, for ${want.toFixed(0)}`);
  // Each drop flies with the wind, down it, low over the sea.
  const S = run.S, W = C.windAt(OPEN.x, OPEN.z, run.t);
  let live = 0, down = 0;
  const hs = [];
  for (let i = 0; i < S.age.length; i++) {
    if (S.age[i] > S.life[i] || !S.spread[i] || S.age[i] < 0.4) continue;
    live++;
    const along = (S.vel[i * 3] * W.x + S.vel[i * 3 + 2] * W.z) / W.speed;
    if (along > 0.5 * D.SURFACE_WIND * W.speed) down++;
    hs.push(S.sp[i * 3 + 1] - C.TIDE.level);
  }
  assert.ok(live > 100 && down / live > 0.95, `${down} of ${live} streaming down the wind`);
  // Low over the sea: nine in ten within 3 m of it, none higher than the strongest eddy (three
  // times its spread) could carry the finest for their whole flight.
  hs.sort((a, b) => a - b);
  const p90 = hs[Math.floor(0.9 * (hs.length - 1))], most = (3 * D.eddySpread(18) - 0.35) * 3.5 + 1;
  assert.ok(p90 < 3 && hs.at(-1) < most, `nine in ten within ${p90.toFixed(2)} m, the highest ${hs.at(-1).toFixed(2)} m (at most ${most.toFixed(1)})`);
  // The air's eddies carry some of it up over the troughs, a metre or more above the sea's mean.
  let up = 0;
  for (let i = 0; i < S.age.length; i++) if (S.age[i] <= S.life[i] && S.spread[i] && S.sp[i * 3 + 1] > C.TIDE.level + 1) up++;
  assert.ok(up > 10, `${up} carried up over a metre`);
  // A near gale makes fewer; a gentle breeze none, though a few of its crests break (3.9 m/s: its
  // strongest gusts under 7); and no crest breaking, none whatever the wind.
  const near = runSpray(14, 6), fewer = near.rate;
  assert.ok(Math.abs(fewer / near.want - 1) < 0.2, `${fewer.toFixed(0)} a second at 14 m/s, for ${near.want.toFixed(0)}`);
  assert.ok(fewer > 0 && fewer < rate * 0.6, `${fewer.toFixed(0)} a second at 14 m/s, ${rate.toFixed(0)} at 18`);
  const calm = runSpray(3.9, 3);
  assert.ok(longSea.brk.some((b) => b > 0), 'a few of a gentle breeze\'s crests break');
  assert.equal(calm.S.spumeMade, 0);
  assert.equal(runSpray(18, 2, { breaking: false }).S.spumeMade, 0);
});

test('the spray is lit as the foam on the water is: dim at night, white by day, a storm\'s white', () => {
  const S = new Storm(new THREE.Scene());
  const env = { skyCol: new THREE.Color('#cbe2f4'), sunColor: new THREE.Color('#fff6e4'), hemiI: 1.55, sunI: 3, storm: 0 };
  S.light(env);
  const day = S.spray.material.color.clone();
  S.light({ ...env, skyCol: new THREE.Color('#53689e'), sunColor: new THREE.Color('#9cb2e4'), hemiI: 1.1, sunI: 0.5 });
  const night = S.spray.material.color.clone();
  assert.ok(night.g < day.g * 0.5, `${night.getHexString()} at night, ${day.getHexString()} by day`);
  // (As water.js: the foam's white by the sky's light and the sun's.)
  const a = 1.55 * 0.33, b = 3 * 0.32 * 0.6;
  assert.ok(Math.abs(day.r - (env.skyCol.r * a + env.sunColor.r * b) * 0.969) < 1e-6);
  S.light({ ...env, skyCol: new THREE.Color('#222222'), sunColor: new THREE.Color('#111111'), hemiI: 1, sunI: 0.3, storm: 1 });
  assert.ok(S.spray.material.color.g > 0.55, 'white against a dark storm sea');
});
