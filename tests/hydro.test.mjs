// The water and the boats on it: hulls floating at their real weights, a hull's sideways grip
// against naval architects' measurements, the wind sea's spectrum, the Kelvin wake, and a boat
// rocked by another's wake. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;

const { Boat, HULLS } = await import('../src/boat.js');
const { buildHullModel, hydrostatics, HydroBody, RHO } = await import('../src/hydro.js');
const C = await import('../src/world/conditions.js');
const { kelvin, wakeScale, wakes } = await import('../src/world/wakes.js');

const scene = new THREE.Scene();
const flat = () => {
  C.conditions.preset = 'calm';
  C.conditions.manual = { speed: 0, from: 0 };
  C.conditions.wind.speed = C.conditions.wind.target = 0;
  for (let i = 0; i < 300; i++) C.updateConditions(0.1, { rain: 0, cloud: 0.2 });
  C.conditions.swellAmps.fill(0);
  C.conditions.chopAmps.fill(0);
  C.conditions.sea.swell = C.conditions.sea.chop = 0;
};

test('every hull floats at the draft her own weight sinks her to, level', () => {
  for (const [kind, H] of Object.entries(HULLS)) {
    const M = buildHullModel(H);
    // Archimedes: what she displaces at her resting draft weighs what she does.
    const v = hydrostatics(M, M.restDraft).volume;
    assert.ok(Math.abs(RHO * v - M.mass) / M.mass < 0.01, `${kind}: ${(RHO * v).toFixed(0)} kg displaced, ${M.mass.toFixed(0)} kg`);
    assert.ok(M.restDraft > 0.03 && M.restDraft < H.D, `${kind} draws ${M.restDraft.toFixed(2)} m, afloat`);
  }
  // Real weights, as they go out: boat, engine, fuel, you and your gear.
  assert.ok(buildHullModel(HULLS.skiff).mass < 400 && buildHullModel(HULLS.cruiser).mass > 7000);
  flat();
  for (const kind of ['skiff', 'sail', 'cruiser']) {
    const b = new Boat(scene, { kind });
    b.place(150, 330, 0);
    for (let i = 0; i < 240; i++) b.update(1 / 30, i / 30, 0, 0, 0);
    assert.ok(Math.abs(b.pitch) < 0.03 && Math.abs(b.roll) < 0.01, `${kind} lies level (${b.pitch.toFixed(3)}, ${b.roll.toFixed(3)})`);
  }
  C.conditions.manual = null;
});

test('a hull grips the water sideways about as real hulls do (Clarke’s measurements)', () => {
  // The bare hull's sway force and yaw damping going ahead at 3 m/s, against Clarke (1982):
  // within a factor of three either way (his formulas are for ships; these are small boats).
  const env = { t: 0, water: (x, z, t, o) => { o.h = 0; o.vx = o.vy = o.vz = 0; }, ground: () => -100 };
  const load = (M, vs, r) => {
    const b = new HydroBody({ ...M, foils: [] });
    b.place(0, 0, 0, 0);
    b.v = [vs, 0, 3];
    b.w = [0, r, 0];
    let F, T;
    b.integrate = function () { F = [...this.F]; T = [...this.Tq]; };
    b.substep(1e-4, 0, env);
    return { Y: F[0], N: T[1] };
  };
  for (const kind of ['skiff', 'bass', 'cabin', 'cruiser', 'console']) {
    const H = HULLS[kind], M = buildHullModel(H), T = M.restDraft, L = H.L, B = 2 * M.bMax, U = 3;
    const Yv = (load(M, 0.15, 0).Y - load(M, -0.15, 0).Y) / 0.3;
    const Nr = (load(M, 0, 0.15 / L).N - load(M, 0, -0.15 / L).N) / (0.3 / L);
    const tl = Math.PI * (T / L) ** 2;
    const cYv = -tl * (1 + 0.4 * 0.55 * (B / T)) * 0.5 * RHO * L * L * U;
    const cNr = -tl * (0.25 + 0.039 * (B / T) - 0.56 * (B / L)) * 0.5 * RHO * L ** 4 * U;
    for (const [name, got, want] of [['sway', Yv, cYv], ['yaw', Nr, cNr]]) {
      assert.ok(got < 0, `${kind} ${name}: resists`);
      assert.ok(got / want > 1 / 3 && got / want < 3, `${kind} ${name}: ${got.toFixed(0)} vs Clarke ${want.toFixed(0)}`);
    }
  }
});

test('the wind sea’s energy is shared as a real one’s is, and adds up to its height', () => {
  const { CHOP } = C.WAVE_PARTS;
  for (const u of [3, 8, 14]) {
    const S = C.chopSpectrum(u);
    assert.ok(Math.abs(S.reduce((a, b) => a + b) - 1) < 1e-6);
  }
  // Fresher wind, longer waves.
  const peak = (u) => { const S = C.chopSpectrum(u); return S.indexOf(Math.max(...S)); };
  assert.ok(peak(3) < peak(10) && peak(10) < peak(18));
  // The significant height: four times the root of the energy, twice the significant crest.
  C.conditions.preset = 'auto';
  C.conditions.manual = { speed: 10, from: 0 };
  C.conditions.wind.speed = C.conditions.wind.target = 10;
  for (let i = 0; i < 3000; i++) C.updateConditions(0.1, { rain: 0, cloud: 0.2 });
  let m0 = 0;
  CHOP.forEach((w, i) => { m0 += C.conditions.chopAmps[i] ** 2 / 2; });
  const hs = 4 * Math.sqrt(m0);
  assert.ok(Math.abs(hs - 2 * C.conditions.sea.chop) < 0.01, `Hs ${hs.toFixed(2)} m for a crest of ${C.conditions.sea.chop.toFixed(2)}`);
  C.conditions.manual = null;
});

test('a Kelvin wake: inside a 19.5° wedge, biggest on its edge, dying away behind', () => {
  const L = 7, U = 6, a0 = wakeScale(2400, L, 5.5, U);
  const at = (deg, r) => {
    const th = (deg * Math.PI) / 180;
    let m = 0;
    // (The biggest crest over a short run of points there.)
    for (let k = 0; k < 40; k++) m = Math.max(m, Math.abs(kelvin(r * Math.cos(th) + k * 0.1, r * Math.sin(th), U, a0, L, 5)));
    return m;
  };
  assert.equal(at(24, 40), 0, 'nothing outside the wedge');
  assert.ok(at(18.5, 40) > at(8, 40), 'the edge stands out');
  assert.ok(at(18.5, 25) > at(18.5, 90), 'smaller further back');
  // Heavier boats pushing harder make bigger wakes; a kayak hardly any.
  assert.ok(wakeScale(86, 3.7, 8.4, 3) < 0.03 && wakeScale(9000, 9.2, 4.4, 5) > 0.2);
  assert.ok(wakeScale(2400, 7.4, 5.5, 4.5) > wakeScale(2400, 7.4, 5.5, 13), 'planing, less than at hull speed');
});

test('a boat going by rocks a boat drifting beside her track; on flat calm, fast boats run smooth', () => {
  flat();
  let clock = 0;
  const yacht = new Boat(scene, { kind: 'cruiser' });
  yacht.place(-300, 330, Math.PI / 2);
  const skiff = new Boat(scene, { kind: 'skiff' });
  skiff.place(-240, 350, 1.2 + Math.PI / 2);
  let roll = 0, before = 0;
  for (let i = 0; i < 30 * 34; i++) {
    clock += 1 / 30;
    C.conditions.time = clock;
    yacht.update(1 / 30, clock, i < 30 * 18 ? 0.3 : 0, 0, 0);
    skiff.update(1 / 30, clock, 0, 0, 0);
    if (i > 60 && i < 30 * 20) before = Math.max(before, Math.abs(skiff.roll));
    if (i >= 30 * 20) roll = Math.max(roll, Math.abs(skiff.roll));
  }
  assert.ok(before < 0.02, `still before it arrives (${before.toFixed(3)})`);
  assert.ok(roll > 0.04 && roll < 0.35, `rocked by the wake (${roll.toFixed(3)} rad)`);
  wakes.forget(yacht);
  // Flat out on glassy water: no porpoising, no bouncing.
  for (const kind of ['jetski', 'console', 'skiff']) {
    const b = new Boat(scene, { kind });
    b.place(-200, 500, 0.8);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 30 * 16; i++) {
      clock += 1 / 30;
      C.conditions.time = clock;
      b.update(1 / 30, clock, 1, 0, 0);
      if (i > 30 * 10) { lo = Math.min(lo, b.heave); hi = Math.max(hi, b.heave); }
    }
    assert.ok(hi - lo < 0.02, `${kind}: heaving ${(hi - lo).toFixed(3)} m flat out on flat water`);
    wakes.forget(b);
  }
  C.conditions.manual = null;
});

test('at speed the helm is gentle: a tap turns her a little, held over she comes round without spinning out, let go she settles', () => {
  C.conditions.preset = 'calm';
  C.conditions.manual = { speed: 2, from: 0 };
  C.conditions.wind.speed = C.conditions.wind.target = 2;
  for (let i = 0; i < 2000; i++) C.updateConditions(0.1, { rain: 0, cloud: 0.2 });
  let clock = 0;
  const go = (kind) => {
    const b = new Boat(scene, { kind });
    b.place(-60, 470, 0.5);
    const step = (s) => { clock += 1 / 60; C.conditions.time = clock; b.update(1 / 60, clock, 1, s, 0); };
    for (let i = 0; i < 60 * 12; i++) step(0);
    return { b, step };
  };
  for (const kind of ['jetski', 'skiff', 'console']) {
    // A tap: a little way round, and she stays on her new course (no swinging back).
    const { b, step } = go(kind);
    const h0 = b.heading;
    for (let i = 0; i < 30; i++) step(1);
    let most = 0, last = 0;
    for (let i = 0; i < 60 * 4; i++) {
      step(0);
      last = (b.heading - h0) * Math.sign(b.heading - h0 || 1);
      most = Math.max(most, last);
    }
    assert.ok(most > 0.03 && most < 0.5, `${kind}: a tap turned her ${most.toFixed(2)} rad`);
    assert.ok(most - last < 0.06, `${kind}: let go, she settles (${(most - last).toFixed(2)} rad back)`);
    assert.ok(Math.abs(b.omega) < 0.1, `${kind}: and holds her course`);
    // Held hard over at full speed: round she comes, still going ahead, never spun round.
    const r = go(kind);
    let fastest = 0;
    for (let i = 0; i < 60 * 3; i++) { r.step(1); fastest = Math.max(fastest, Math.abs(r.b.omega)); }
    assert.ok(fastest < 1.6 && r.b.forwardSpeed > 4, `${kind}: turning ${fastest.toFixed(2)} rad/s at ${r.b.forwardSpeed.toFixed(1)} m/s`);
    wakes.forget(b);
    wakes.forget(r.b);
  }
  C.conditions.manual = null;
});
