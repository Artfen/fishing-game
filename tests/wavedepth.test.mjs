// (B2) The waves below the surface. A wave's pressure and its orbital motion fade as
// exp(−k·depth): the hull's pressure follows Smith's correction, so a short sea heaves a deep
// hull less than its surface would say; and the keel, the rudders and an outboard's leg feel the
// water moving at their own depth, so on a following sea's crest, where the water runs on with
// her, her rudder goes light, and in the trough it bites harder.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;

const { HULLS } = await import('../src/boat.js');
const { buildHullModel, HydroBody } = await import('../src/hydro.js');
const C = await import('../src/world/conditions.js');
const O = await import('../src/world/ocean.js');

const G = 9.81;
// A regular wave, amplitude a (m), length lam (m), running along +z (or +x): its surface and
// the water's motion at the surface, as the sea's sampler gives them.
const wave = (a, lam, alongZ = true) => {
  const k = (2 * Math.PI) / lam, w = Math.sqrt(G * k);
  const water = (x, z, t, o) => {
    const th = k * (alongZ ? z : x) - w * t, u = a * w * Math.sin(th);
    o.h = a * Math.sin(th);
    o.vx = alongZ ? 0 : u;
    o.vz = alongZ ? u : 0;
    o.vy = -a * w * Math.cos(th);
    return o;
  };
  return { a, k, w, water };
};
const deep = () => -100;

test('the sea’s waves fade with depth by their own lengths: its rise and fall by the longer, its motion by the shorter', () => {
  // One wave: its own wavenumber, both ways.
  const k1 = (2 * Math.PI) / 70, k2 = (2 * Math.PI) / 10;
  const one = C.seaDecay({ n: 1, a: [0.5], kx: [k1 * 0.6], kz: [k1 * 0.8], sea: 0 });
  assert.ok(Math.abs(one.kH - k1) < 1e-9 && Math.abs(one.kV - k1) < 1e-9, `one wave: ${one.kH}, ${one.kV}`);
  // A long swell and a short sea together: between them, the motion's nearer the short one (its
  // water moves faster for its height: ω² = g·k).
  const two = C.seaDecay({ n: 2, a: [0.5, 0.2], kx: [k1, k2], kz: [0, 0], sea: 0 });
  assert.ok(two.kH > k1 && two.kH < k2, `two: kH ${two.kH.toFixed(3)}`);
  assert.ok(two.kV > two.kH && two.kV < k2, `two: kV ${two.kV.toFixed(3)} > kH ${two.kH.toFixed(3)}`);
  // The wind sea alone, in a fresh breeze: about its peak's own wavenumber (ω_p²/g).
  C.conditions.preset = 'calm';
  C.conditions.manual = { speed: 11, from: 0 };
  for (let i = 0; i < 600; i++) C.updateConditions(0.5, { rain: 0, cloud: 0.2 });
  C.conditions.swellAmps.fill(0);
  O.longSea.at(5000);
  const S = C.waveSampler(150, 330);
  const kp = O.peakFrequency(11) ** 2 / G;
  assert.ok(S.sea > 0.3, `the open sea here (${S.sea.toFixed(2)})`);
  assert.ok(S.kH > kp * 0.5 && S.kH < kp * 2, `wind sea: kH ${S.kH.toFixed(3)} vs peak ${kp.toFixed(3)}`);
  assert.ok(S.kV > S.kH, `wind sea: kV ${S.kV.toFixed(3)} > kH ${S.kH.toFixed(3)}`);
  C.conditions.manual = null;
});

test('under a wave a hull feels the pressure at her own depth: a short sea heaves a deep hull less (Smith)', () => {
  // Each hull held still in a regular beam sea, its crests 10 cm up, its heave force over a wave period,
  // with the waves fading below the surface and without. A hull feels less of the wave the
  // deeper her bottom lies under it: never less than all of her at her full draft would (e^−kT),
  // and the deep cruiser in a short sea markedly less.
  const heave = (M, W, sea) => {
    const b = new HydroBody(M);
    b.place(0, 0, 0, 0);
    let F = 0, lo = Infinity, hi = -Infinity;
    b.integrate = function () { F = this.F[1]; };
    const env = { t: 0, water: W.water, ground: deep, sea };
    for (let i = 0; i < 40; i++) {
      b.substep(1e-5, ((i / 40) * 2 * Math.PI) / W.w, env);
      lo = Math.min(lo, F); hi = Math.max(hi, F);
    }
    return (hi - lo) / 2;
  };
  const got = {};
  for (const kind of ['row', 'skiff', 'cabin', 'rib', 'cruiser']) {
    const M = buildHullModel(HULLS[kind]), T = M.restDraft;
    for (const lam of [6, 20]) {
      const W = wave(0.1, lam, false), full = Math.exp(-W.k * T);
      const r = heave(M, W, { kH: W.k, kV: W.k, level: 0 }) / heave(M, W, undefined);
      got[`${kind}${lam}`] = r;
      assert.ok(r > full - 0.02 && r < 1, `${kind}, ${lam} m sea: ${r.toFixed(3)} of the surface's heave (e^−kT ${full.toFixed(3)})`);
      // (At least a third of what all of her at her full draft would lose.)
      assert.ok(1 - r > (1 - full) / 3, `${kind}, ${lam} m sea: loses ${(1 - r).toFixed(3)}`);
    }
    assert.ok(got[`${kind}6`] < got[`${kind}20`], `${kind}: the shorter sea fades more`);
  }
  assert.ok(got.cruiser6 < 0.75 && got.row6 > 0.85, `cruiser ${got.cruiser6.toFixed(2)}, row ${got.row6.toFixed(2)} in a 6 m sea`);
  // With no wave, the same forces as ever: she floats as she did, at any tide.
  const M = buildHullModel(HULLS.cabin);
  for (const level of [0, 1.3]) {
    const still = (o) => { o.h = level; o.vx = o.vy = o.vz = 0; return o; };
    const F = (sea) => {
      const b = new HydroBody(M);
      b.place(0, 0, 0, level);
      let f = null;
      b.integrate = function () { f = [...this.F, ...this.Tq]; };
      b.substep(1e-5, 0, { t: 0, water: (x, z, t, o) => still(o), ground: deep, sea });
      return f;
    };
    const a = F(undefined), b = F({ kH: 0.6, kV: 0.6, level });
    for (let i = 0; i < 6; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-6 * (1 + Math.abs(a[i])), `still water at ${level} m: ${a[i]} vs ${b[i]}`);
  }
});

test('the water’s motion under the hull fades with depth: at her keel less than at her waterline', () => {
  // The cruiser held under a crest of a 12 m sea: at each vertex under the water, the waves'
  // motion is the surface's (as the hull reads it) times e^−k·depth.
  const M = buildHullModel(HULLS.cruiser), W = wave(0.3, 12, false);
  const read = (sea) => {
    const b = new HydroBody(M);
    b.place(0, 0, 0, 0);
    b.integrate = function () {};
    b.substep(1e-5, (1.5 * Math.PI) / W.w, { t: 0, water: W.water, ground: deep, sea });
    return b;
  };
  const a = read(undefined), b = read({ kH: W.k, kV: W.k, level: 0 });
  let checked = 0, deepest = 0;
  for (let i = 0; i < M.nv; i++) {
    const d = -a.Hh[i], surf = Math.hypot(a.WV[i * 3], a.WV[i * 3 + 1], a.WV[i * 3 + 2]);
    const here = Math.hypot(b.WV[i * 3], b.WV[i * 3 + 1], b.WV[i * 3 + 2]);
    if (d <= 0) {
      assert.ok(Math.abs(here - surf) < 1e-9, `vertex ${i}, out of the water: as it was`);
      continue;
    }
    assert.ok(Math.abs(here - surf * Math.exp(-W.k * d)) < 1e-6, `vertex ${i}, ${d.toFixed(2)} m down: ${here.toFixed(4)} vs ${(surf * Math.exp(-W.k * d)).toFixed(4)}`);
    checked++;
    deepest = Math.max(deepest, d);
  }
  assert.ok(checked > 10 && deepest > 0.5, `${checked} vertices under the water, the deepest ${deepest.toFixed(2)} m down`);
});

test('a following sea’s crest takes the grip off her rudder, and in the trough it bites harder', () => {
  // Going ahead at 3 m/s with the helm over, a sea running the same way under her (20 m long, its
  // crests half a metre up: its water runs at 0.88 m/s at the surface, forward under the crest and back
  // in the trough). With her rudder on the crest, the water past it is slower and it grips
  // less; in the trough, faster and more. The rudder's side force, crest over trough, is
  // ((U − u)/(U + u))², u the wave's motion at the rudder's depth: between the surface's and
  // the rudder tip's.
  const U = 3, W = wave(0.5, 20, true), u0 = W.a * W.w;
  const ratio = (u) => ((U - u) / (U + u)) ** 2;
  for (const kind of ['sail', 'rib', 'skiff', 'console', 'cabin', 'cruiser']) {
    const M = buildHullModel(HULLS[kind]);
    const R = M.foils.find((f) => f.rudder);
    const side = (phase) => {
      const b = new HydroBody(M);
      b.place(0, phase / W.k - R.p[2], 0, W.a * Math.sin(phase));
      b.v = [0, 0, U];
      b.rudder = 0.3;
      b.legDown = true;
      b.integrate = function () {};
      b.substep(1e-5, 0, { t: 0, water: W.water, ground: deep, sea: { kH: W.k, kV: W.k, level: 0 } });
      b.F.fill(0); b.Tq.fill(0);
      b.foilForces();
      return { F: b.F[0], N: b.Tq[1] };
    };
    const crest = side(Math.PI / 2), trough = side(-Math.PI / 2);
    const r = crest.F / trough.F, tip = M.restDraft - R.p[1] + R.span / 2;
    assert.ok(Math.sign(crest.F) === Math.sign(trough.F) && Math.sign(crest.N) === Math.sign(trough.N), `${kind}: the helm turns her the same way`);
    assert.ok(r > ratio(u0) - 0.02 && r < ratio(u0 * Math.exp(-W.k * tip)) + 0.02, `${kind}: crest/trough ${r.toFixed(3)}, between ${ratio(u0).toFixed(3)} and ${ratio(u0 * Math.exp(-W.k * tip)).toFixed(3)}`);
    assert.ok(Math.abs(crest.N) < 0.6 * Math.abs(trough.N), `${kind}: her rudder turns her ${(crest.N / trough.N).toFixed(2)} as hard on the crest`);
  }
});

test('in a beam sea the water’s to-and-fro across her keel pushes her with it', () => {
  // Lying still across a sea, the cruiser's keel feels the water run one way under the crest
  // and back under the trough: a push along with it, as on anything held in moving water.
  const M = buildHullModel(HULLS.cruiser), W = wave(0.4, 16, false);
  const keel = M.foils.find((f) => !f.rudder && !f.steer);
  const side = (phase) => {
    const b = new HydroBody(M);
    b.place(phase / W.k - keel.p[0], 0, 0, W.a * Math.sin(phase));
    b.integrate = function () {};
    b.substep(1e-5, 0, { t: 0, water: W.water, ground: deep, sea: { kH: W.k, kV: W.k, level: 0 } });
    b.F.fill(0); b.Tq.fill(0);
    b.foilForces();
    return b.F[0];
  };
  const crest = side(Math.PI / 2), trough = side(-Math.PI / 2);
  assert.ok(crest > 0 && trough < 0, `with the wave under the crest (${crest.toFixed(0)} N), against it under the trough (${trough.toFixed(0)} N)`);
});
