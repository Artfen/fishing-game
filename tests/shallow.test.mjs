// (B5) Shallow water: more resistance as a boat nears the speed the bottom lets her waves go
// (Lackenby's fit to Schlichting, as the ITTC corrects speed trials for shallow water), and her
// wake's wedge opening out (Havelock). Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;

const Hy = await import('../src/hydro.js');
const { HULLS } = await import('../src/boat.js');
const Wk = await import('../src/world/wakes.js');
const G = 9.81;

test('in shallow water her resistance is deep water’s at a higher speed, as Lackenby’s fit has it, until she’s past the critical speed', () => {
  const { shallowSpeed, SHALLOW_FADE } = Hy;
  // Deep water, or a crawl: no change.
  assert.equal(shallowSpeed(5, Infinity, 0.5), 5);
  assert.ok(Math.abs(shallowSpeed(5, 100, 0.5) - 5) < 1e-6);
  // Below the critical speed it is Lackenby's: V = Vinf·(1 − ΔV/Vinf), ΔV/Vinf = 0.1242·(Ax/h² − 0.05)
  // + 1 − √tanh(g·h/Vinf²).
  for (const [V, h, Ax] of [[3, 2, 0.4], [2, 1, 0.3], [5, 4, 0.7], [1.5, 0.8, 0.2]]) {
    const Vi = shallowSpeed(V, h, Ax);
    const loss = Math.max(0, 0.1242 * (Ax / (h * h) - 0.05)) + 1 - Math.sqrt(Math.tanh((G * h) / (Vi * Vi)));
    assert.ok(Math.abs(Vi * (1 - loss) - V) < 1e-3, `${V} m/s over ${h} m: ${Vi.toFixed(3)} (Fh ${(V / Math.sqrt(G * h)).toFixed(2)})`);
    assert.ok(Vi > V);
  }
  // Growing as she nears the critical speed, and gone again once she's well past it.
  const at = (Fh) => shallowSpeed(Fh * Math.sqrt(G * 2), 2, 0.4) / (Fh * Math.sqrt(G * 2));
  assert.ok(at(0.5) < at(0.7) && at(0.7) < at(0.9), `${at(0.5).toFixed(3)}, ${at(0.7).toFixed(3)}, ${at(0.9).toFixed(3)}`);
  assert.equal(at(SHALLOW_FADE[1] + 0.05), 1);
});

test('over shallow water a RIB on a moderate push is held back near the critical speed; harder, she breaks through', () => {
  // A RIB under a steady push from rest over a flat bottom, against deep water.
  const run = (h, F) => {
    const M = Hy.buildHullModel(HULLS.rib);
    const b = new Hy.HydroBody(M);
    b.place(0, 0, 0, 0);
    b.legDown = true;
    const env = { t: 0, water: (x, z, t, o) => { o.h = 0; o.vx = o.vy = o.vz = 0; return o; }, ground: () => -h };
    for (let i = 0; i < 120; i++) b.step(1 / 60, { ...env, t: i / 60 });
    const th = { p: [0, M.H.keel(0) - 0.28, -M.H.L / 2], d: [0, 0, 1], f: F, vent: 0 };
    let v = 0, t8 = null;
    for (let i = 0; i < 40 * 60; i++) {
      b.thrusters.length = 0;
      b.thrusters.push(th);
      b.forces.length = 0;
      b.step(1 / 60, { ...env, t: 2 + i / 60 });
      v = b.v[2] * b.R[8] + b.v[0] * b.R[2];
      if (t8 == null && v >= 8) t8 = i / 60;
    }
    return { v, t8 };
  };
  const deep = run(100, 4000), two = run(2, 4000), four = run(4, 4000);
  // (The critical speed: √(g·h), 4.4 m/s over 2 m, 6.3 over 4.)
  assert.ok(two.v < deep.v * 0.85, `over 2 m held to ${two.v.toFixed(2)} m/s, against ${deep.v.toFixed(2)} in deep water`);
  assert.ok(four.v < deep.v * 0.95 && four.v > two.v, `over 4 m, ${four.v.toFixed(2)} m/s`);
  // Pushed hard over 4 m she's slowed through it, then out the other side at her deep-water pace.
  const hard = run(4, 9000), hardDeep = run(100, 9000);
  assert.ok(hard.t8 > hardDeep.t8 + 0.3, `to 8 m/s: ${hard.t8?.toFixed(1)} s, against ${hardDeep.t8?.toFixed(1)} in deep water`);
  assert.ok(Math.abs(hard.v - hardDeep.v) < 0.1, `and on at ${hard.v.toFixed(2)} m/s`);
});

test('her wake’s wedge opens out over shallow water as she nears the critical speed, and past it closes to her Mach angle, its transverse waves gone', () => {
  const { wedgeAngle, wedgeFor, transverseFor, kelvin, WEDGE_MAX } = Wk;
  const deg = (r) => (r * 180) / Math.PI;
  // Deep water (or slow): Kelvin's 19.47°.
  for (const Fh of [0, 0.2, 0.4]) assert.ok(Math.abs(deg(wedgeAngle(Fh)) - 19.47) < 0.05, `Fh ${Fh}: ${deg(wedgeAngle(Fh)).toFixed(2)}°`);
  // Widening towards the critical speed (Havelock), never narrowing.
  let last = 0;
  for (const Fh of [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.99]) {
    const a = wedgeAngle(Fh);
    assert.ok(a >= last - 1e-9, `Fh ${Fh}: ${deg(a).toFixed(1)}°`);
    last = a;
  }
  assert.ok(deg(wedgeAngle(0.9)) > 30 && deg(wedgeAngle(0.9)) < 40, `Fh 0.9: ${deg(wedgeAngle(0.9)).toFixed(1)}°`);
  // Past it, her Mach angle (held short of square across).
  for (const Fh of [1.1, 1.3, 1.6, 2]) assert.ok(Math.abs(wedgeAngle(Fh) - Math.min(WEDGE_MAX, Math.asin(1 / Fh))) < 1e-9);
  assert.ok(transverseFor(10, 100) === 1 && transverseFor(3, 2) === 1 && transverseFor(6, 2) === 0);
  // In the pattern: a point 30° off her track, outside the deep-water wedge, has no wake in deep
  // water but has one over shallow water at Fh 0.95; past the critical speed there's no
  // transverse wave close behind her on her track.
  const U = 4, L = 6, a0 = 0.1, h95 = (U / 0.95) ** 2 / G;
  let deepMax = 0, shallowMax = 0;
  for (let r = 10; r < 40; r += 0.25) {
    const x = r * Math.cos(Math.PI / 6), y = r * Math.sin(Math.PI / 6);
    deepMax = Math.max(deepMax, Math.abs(kelvin(x, y, U, a0, L, 5)));
    shallowMax = Math.max(shallowMax, Math.abs(kelvin(x, y, U, a0, L, 5, null, h95)));
  }
  assert.equal(deepMax, 0);
  assert.ok(shallowMax > 0.005, `30° off her track over ${h95.toFixed(2)} m: ${shallowMax.toFixed(3)} m`);
  assert.ok(Math.abs(wedgeFor(U, h95) - wedgeAngle(0.95)) < 0.02);
  // The drawn pattern reads the same wedge (the shader's own copy).
  const src = readFileSync(new URL('../src/world/wakes.js', import.meta.url), 'utf8');
  assert.match(src, /float ay = abs\(y\), th = atan\(ay, x\) \* \(CUSP \/ max\(W, CUSP\)\);/);
  assert.match(src, /kelvinH\(vWake\.x - along, across, vWake\.y, vWake\.z, vWake\.w, age, vShallow\.x, vShallow\.y\)/);
});
