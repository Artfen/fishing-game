// (B3) The boats checked against measurements: the wind on a boat's topsides as wind-tunnel tests
// of ships and boats give it (Blendermann 1994), a skiff left to drift in the wind as the field
// trials found small craft drift (Allen et al., met.no report 17/2010), and each hull's roll dying
// away as calm-water decay tests of small craft find. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;

const Hy = await import('../src/hydro.js');
const { Boat, HULLS } = await import('../src/boat.js');
const C = await import('../src/world/conditions.js');

test('the wind on her topsides: Blendermann’s loads, side-on and end-on, and the wind by height', () => {
  const { windLoad, windAtHeight, RHO_AIR, WIND_CDT, WIND_CDL, WIND_SHIFT } = Hy;
  const q = 0.5 * RHO_AIR, A = 10, end = 0.4, U = 12;
  // Beam-on: her side's area, C_Dt; head-on and dead astern: her end's, C_Dl (a little more from
  // astern); none across her then, and none along her beam-on.
  const beam = windLoad(0, U, A, end), head = windLoad(-U, 0, A, end), stern = windLoad(U, 0, A, end);
  assert.ok(Math.abs(beam[1] - q * A * WIND_CDT * U * U) < 1e-6 && Math.abs(beam[0]) < 1e-9, `beam-on ${beam}`);
  assert.ok(Math.abs(head[0] + q * A * end * WIND_CDL[0] * U * U) < 1e-6 && Math.abs(head[1]) < 1e-9, `head-on ${head}`);
  assert.ok(Math.abs(stern[0] - q * A * end * WIND_CDL[1] * U * U) < 1e-6 && stern[0] > -head[0], `astern ${stern}`);
  // With the wind fine on her bow the push across her grows with the angle's sine, as a wing's
  // lift does (half as much at 5° as at 10°), not its square (a quarter), so lying to the wind
  // she's pushed back to it.
  const at = (deg) => windLoad(-U * Math.cos((deg * Math.PI) / 180), U * Math.sin((deg * Math.PI) / 180), A, end);
  const r = at(5)[1] / at(10)[1];
  assert.ok(r > 0.45 && r < 0.55, `at 5° against 10°: ${r.toFixed(3)}`);
  // And it pushes further forward the finer the wind is on her bow (dead ahead, 0.18 of her length
  // for each radian before the beam), at her middle beam-on, aft with the wind astern.
  assert.ok(Math.abs(head[2] - WIND_SHIFT * Math.PI / 2) < 1e-9 && Math.abs(beam[2]) < 1e-9 && Math.abs(stern[2] + WIND_SHIFT * Math.PI / 2) < 1e-9);
  assert.ok(at(10)[2] > at(45)[2] && at(45)[2] > 0, 'further forward the finer the wind');
  // The wind over open water by height: the 10 m wind at 10 m, about 70% of it half a metre up.
  assert.equal(windAtHeight(10), 1);
  assert.ok(Math.abs(windAtHeight(0.5) - 0.698) < 0.002, `${windAtHeight(0.5)}`);
  assert.ok(windAtHeight(2) > windAtHeight(1) && windAtHeight(1) > windAtHeight(0.5));
});

test('a skiff left to drift goes down the wind as the field trials found small craft do', () => {
  // Engine off, no one rowing, in a steady wind over open water (the wind's own sea, no swell),
  // after a minute to settle, over two minutes: her drift through the water down the wind, against
  // the field trials' fit for a 4.15 m skiff (Allen et al.: 0.0252·U₁₀ + 0.134 m/s), at the wind she
  // feels on average (the game's gusts and all). The trials' winds were mostly light to fresh:
  // 5 and 10 m/s here, within 15%; at 15 m/s she drifts faster again.
  const scene = new THREE.Scene();
  const was = { preset: C.conditions.preset, manual: C.conditions.manual };
  const drift = (U) => {
    C.conditions.preset = null;
    C.conditions.manual = { speed: U, from: 4.0 };
    for (let i = 0; i < 1200; i++) C.updateConditions(0.1, { rain: 0, cloud: 0.4 });
    C.conditions.swellAmps.fill(0);
    const b = new Boat(scene, { kind: 'skiff' });
    b.place(-300, 900, 0.7);
    let n = 0, down = 0, wind = 0;
    for (let i = 0; i < 180 * 30; i++) {
      b.update(1 / 30, 100 + i / 30, 0, 0, 0);
      if (i <= 60 * 30) continue;
      const W = b.phys.wind, ws = Math.hypot(W[0], W[1]);
      down += ((b.vel.x - b.drift.x) * W[0] + (b.vel.z - b.drift.z) * W[1]) / ws;
      wind += ws;
      n++;
    }
    b.dispose?.();
    return { v: down / n, U: wind / n };
  };
  try {
    const out = [5, 10, 15].map(drift);
    for (const r of out.slice(0, 2)) {
      const want = 0.0252 * r.U + 0.134;
      assert.ok(Math.abs(r.v - want) < 0.15 * want, `in ${r.U.toFixed(1)} m/s she drifts ${r.v.toFixed(3)} m/s, the trials ${want.toFixed(3)}`);
    }
    assert.ok(out[2].v > out[1].v && out[1].v > out[0].v, `faster in more wind: ${out.map((r) => r.v.toFixed(3)).join(', ')}`);
  } finally {
    C.conditions.preset = was.preset;
    C.conditions.manual = was.manual;
  }
});

test('heeled and let go in a calm, each hull rolls on a few times and settles, as small craft do', () => {
  // A free roll decay (as the ITTC's procedure has it): heeled 10° in flat water and let go; her
  // damping ratio from the logarithmic decrement of each swing to the next on the same side. Calm-
  // water decay tests of small craft find a few hundredths to a tenth (a 10 m yacht's: 0.025 with
  // her sails stowed, 0.079 with her mainsail up).
  const env = { t: 0, water: (x, z, t, o) => { o.h = 0; o.vx = o.vy = o.vz = 0; return o; }, ground: () => -100 };
  for (const kind of ['row', 'skiff', 'kayak', 'bass', 'cabin', 'console', 'rib', 'cruiser', 'sail']) {
    const M = Hy.buildHullModel(HULLS[kind]);
    const b = new Hy.HydroBody(M);
    b.place(0, 0, 0, 0);
    b.legDown = true;
    for (let i = 0; i < 300; i++) b.step(1 / 60, { ...env, t: i / 60 });
    const a = (10 * Math.PI) / 180, s = Math.sin(a / 2), c = Math.cos(a / 2), q = b.q;
    const ax = b.dirWorld([0, 0, 1], [0, 0, 0]), r = [ax[0] * s, ax[1] * s, ax[2] * s, c];
    b.q = [r[3] * q[0] + r[0] * q[3] + r[1] * q[2] - r[2] * q[1], r[3] * q[1] - r[0] * q[2] + r[1] * q[3] + r[2] * q[0], r[3] * q[2] + r[0] * q[1] - r[1] * q[0] + r[2] * q[3], r[3] * q[3] - r[0] * q[0] - r[1] * q[1] - r[2] * q[2]];
    b.updateR();
    b.v = [0, 0, 0];
    b.w = [0, 0, 0];
    const roll = [];
    for (let i = 0; i < 20 * 120; i++) {
      b.step(1 / 120, { ...env, t: 5 + i / 120 });
      roll.push((Math.atan2(b.R[3], b.R[4]) * 180) / Math.PI);
    }
    const pk = [];
    for (let i = 1; i < roll.length - 1; i++) {
      const v = Math.abs(roll[i]);
      if (v > Math.abs(roll[i - 1]) && v >= Math.abs(roll[i + 1]) && v > 0.3) pk.push([i / 120, roll[i]]);
    }
    const dec = [];
    for (let i = 0; i + 2 < Math.min(pk.length, 7); i++) dec.push(Math.log(Math.abs(pk[i][1]) / Math.abs(pk[i + 2][1])));
    const d = dec.reduce((x, y) => x + y, 0) / dec.length, zeta = d / Math.sqrt(4 * Math.PI * Math.PI + d * d);
    const period = pk[4][0] - pk[2][0], swings = pk.filter((p) => Math.abs(p[1]) > 1).length / 2;
    assert.ok(zeta > 0.025 && zeta < 0.12, `${kind}: damping ratio ${zeta.toFixed(3)}`);
    assert.ok(swings >= 3, `${kind}: ${swings} swings over 1°`);
    assert.ok(period > 1 && period < 4, `${kind}: rolls in ${period.toFixed(2)} s`);
  }
});
