// (W5) The wind sea's spectrum refined (see ocean.js): how it spreads round the wind, by each
// wave's frequency (Donelan, Hamilton and Hui's measured spreading, as Horvath 2015 recommends
// it), and how much of it shallow water holds (the TMA spectrum's depth factor, Kitaigorodskii's).
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const O = await import('../src/world/ocean.js');
const C = await import('../src/world/conditions.js');
const T = await import('../src/world/terrain.js');

const deg = (r) => (r * 180) / Math.PI;
// (The angle off the wind holding half the peak share: sech²(βθ) = ½.)
const halfWidth = (r) => Math.acosh(Math.SQRT2) / O.spreadBeta(r);

test('the sea spreads round the wind as measured: narrowest at its peak, wider for the waves either side, the short ones widest', () => {
  for (const r of [0.4, 0.7, 0.95, 1, 1.3, 1.6, 2.5, 4, 8]) {
    let s = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) s += O.spread(-Math.PI + ((i + 0.5) * 2 * Math.PI) / n, r) * ((2 * Math.PI) / n);
    assert.ok(Math.abs(s - 1) < 1e-4, `all of it somewhere round the circle at ω/ωp ${r}: ${s}`);
  }
  // Donelan et al.'s β: 2.61(ω/ωp)^1.3 below 0.95, 2.28(ω/ωp)^−1.3 to 1.6, then their fit; joined
  // without a step.
  assert.ok(Math.abs(O.spreadBeta(0.95 - 1e-9) - O.spreadBeta(0.95)) < 0.01 && Math.abs(O.spreadBeta(1.6 - 1e-9) - O.spreadBeta(1.6)) < 0.01);
  assert.ok(Math.abs(O.spreadBeta(1) - 2.28) < 1e-9 && Math.abs(O.spreadBeta(0.5) - 2.61 * 0.5 ** 1.3) < 1e-9);
  // At the peak half its energy is within ±22° of the wind (cos⁴, before: ±33°); twice the peak's
  // frequency, ±53°; four times, ±85°, a little of it running against the wind.
  assert.ok(Math.abs(deg(halfWidth(1)) - 22.2) < 0.5, `${deg(halfWidth(1))}`);
  assert.ok(deg(halfWidth(2)) > 45 && deg(halfWidth(4)) > 75);
  assert.ok(O.spread(Math.PI, 1) / O.spread(0, 1) < 1e-5, 'none of the peak waves against the wind');
  assert.ok(O.spread(Math.PI, 4) / O.spread(0, 4) > 0.05, 'some of the short ones');
  // Symmetric about the wind.
  assert.ok(Math.abs(O.spread(0.4, 1.3) - O.spread(-0.4, 1.3)) < 1e-12);
});

test('in the patch itself: the long waves near the peak keep closer to the wind than the short ones', () => {
  const P = new O.Patch(O.PATCH.N, O.PATCH.L, 1, () => 1);
  const u = 10, wp = O.peakFrequency(u);
  P.setSpectrum(u, 0, 0.25);
  // (The energy-weighted spread of direction, by frequency band.)
  const band = (lo, hi) => {
    let e = 0, a = 0;
    for (let q = 0; q < P.amp.length; q++) {
      const r = P.w[q] / wp;
      if (r < lo || r >= hi || !P.amp[q]) continue;
      const E = P.amp[q] ** 2, th = Math.atan2(P.kz[q], P.kx[q]);
      e += E;
      a += E * th * th;
    }
    return Math.sqrt(a / e);
  };
  const near = band(0.85, 1.25), short = band(1.8, 3);
  assert.ok(deg(near) < deg(short) - 10, `about the peak ±${deg(near).toFixed(0)}°, short ones ±${deg(short).toFixed(0)}°`);
});

test('shallow water holds less of the wind sea: Kitaigorodskii’s depth factor, the TMA spectrum', () => {
  // Φ(ωh), ωh = ω·√(h/g): ½ωh² to 1, 1 − ½(2 − ωh)² to 2, then 1.
  const at = (x) => O.kitaigorodskii(x, 9.81);
  assert.ok(Math.abs(at(0.5) - 0.125) < 1e-12 && Math.abs(at(1) - 0.5) < 1e-12 && Math.abs(at(1.5) - 0.875) < 1e-12 && at(2) === 1 && at(3) === 1);
  assert.equal(O.kitaigorodskii(3, 0), 0, 'none in no water');
  // Each band's height left by depth, from its own waves: none at the edge, all of it in deep water,
  // never more as it shoals; the long waves feel the bottom first.
  const L = new O.Patch(O.PATCH.N, O.PATCH.L, 1, (k) => 1 - (k > O.CUT[0] ? 1 : 0));
  const S = new O.Patch(O.SHORT.N, O.SHORT.L, 2, (k) => (k > O.CUT[0] ? 1 : 0));
  L.setSpectrum(10, 0, 0.25);
  S.setSpectrum(10, 0, 0.25);
  assert.equal(L.tma[0], 0);
  assert.ok(L.tma[O.TMA_N - 1] > 0.999 && S.tma[O.TMA_N - 1] > 0.999);
  for (let i = 1; i < O.TMA_N; i++) assert.ok(L.tma[i] >= L.tma[i - 1] - 1e-9 && S.tma[i] >= S.tma[i - 1] - 1e-9);
  const two = (P) => O.tmaAt(P.tma, 2);
  assert.ok(two(L) < two(S), `in 2 m the long waves keep ${two(L).toFixed(2)} of their height, the short ones ${two(S).toFixed(2)}`);
  // Read between the depths, piecewise linear in 2·√h; at a table's depth, its value.
  assert.ok(Math.abs(O.tmaAt(L.tma, O.tmaDepth(3)) - L.tma[3]) < 1e-9);
  const mid = O.tmaAt(L.tma, ((Math.sqrt(O.tmaDepth(3)) + Math.sqrt(O.tmaDepth(4))) / 2) ** 2);
  assert.ok(Math.abs(mid - (L.tma[3] + L.tma[4]) / 2) < 1e-6);
  // In a fresh breeze (10 m/s) the long waves keep about half their height in a metre of water,
  // nearly nine tenths in four, all of it in nine.
  const t1 = O.tmaAt(L.tma, 1), t4 = O.tmaAt(L.tma, 4), t9 = O.tmaAt(L.tma, 9);
  assert.ok(t1 > 0.4 && t1 < 0.6 && t4 > 0.82 && t4 < 0.95 && t9 > 0.98, `${t1.toFixed(2)} ${t4.toFixed(2)} ${t9.toFixed(2)}`);
  // A stronger wind's longer waves feel the bottom further out.
  const L2 = new O.Patch(O.PATCH.N, O.PATCH.L, 1, (k) => 1 - (k > O.CUT[0] ? 1 : 0));
  L2.setSpectrum(18, 0, 1);
  assert.ok(O.tmaAt(L2.tma, 4) < t4, `${O.tmaAt(L2.tma, 4).toFixed(3)} in 4 m at 18 m/s`);
});

test('the boats and the drawn water feel the same shallow sea: the wind sea\'s share there is the depth\'s too', () => {
  const { longSea } = O;
  const saved = { ...longSea.wind, chop: longSea.choppy };
  try {
    longSea.setWind(10, 0, (1.2 / 4) ** 2, 0.8);
    longSea.at(30);
    // A point a metre or so deep, and one well out: the wind sea's share at each (shelter, the
    // shore's fade and, now, the depth), as the hull's sampler has it.
    let shallow = null, deep = null;
    for (let x = -300; x < 400 && !(shallow && deep); x += 3) {
      for (let z = 0; z < 600 && !(shallow && deep); z += 3) {
        const d = -T.solidHeight(x, z);
        if (!shallow && d > 1.4 && d < 1.6 && T.freshness(x, z) === 0) shallow = { x, z, d };
        if (!deep && d > 20 && T.freshness(x, z) === 0) deep = { x, z, d };
      }
    }
    assert.ok(shallow && deep);
    for (const p of [shallow, deep]) {
      const S = C.waveSampler(p.x, p.z), sh = C.shelterAt(p.x, p.z);
      const fade = C.shoreFadeOf(T.solidHeight(p.x, p.z), 0);
      const want = O.tmaAt(longSea.tma, Math.max(0, C.TIDE.level - T.solidHeight(p.x, p.z)));
      const share = (0.15 + 0.85 * sh[1]) * fade;
      assert.ok(Math.abs(S.sea - share * want) < 1e-9, `${S.sea} against ${share * want}`);
      p.tma = want;
    }
    assert.ok(shallow.tma < 0.75 && deep.tma > 0.999, `${shallow.tma.toFixed(2)} in ${shallow.d.toFixed(1)} m, ${deep.tma} in ${deep.d.toFixed(0)} m`);
  } finally {
    longSea.setWind(saved.u, saved.to, saved.m0, saved.chop);
  }
});
