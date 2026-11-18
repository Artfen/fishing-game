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

test('(W5) the finest waves close by: 60 cm down to 5 cm, handed over smoothly from the short ones, a little faster for surface tension', () => {
  // Their patch: 3.17 m across, 128 cells, so the shortest about 5 cm.
  assert.ok(Math.abs((2 * O.FINE.L) / O.FINE.N - 0.0495) < 1e-3);
  // The short band hands over to the finest between 75 and 50 cm: their shares add up to the whole
  // spectrum everywhere, as the long and short ones' do.
  const S = new O.ShortSpectrum(), F = new O.FineSpectrum();
  // (From where the long waves have handed over to the short, 6 m, down.)
  for (const len of [5, 2, 1, 0.8, 0.7, 0.6, 0.55, 0.45, 0.3, 0.1]) {
    const k = (2 * Math.PI) / len;
    assert.ok(Math.abs(S.patch.band(k) + F.patch.band(k) - 1) < 1e-12, `at ${len} m`);
  }
  assert.equal(F.patch.band((2 * Math.PI) / 1), 0, 'none at a metre');
  assert.equal(S.patch.band((2 * Math.PI) / 0.3), 0, 'the short patch none at 30 cm');
  // Surface tension: ω² = g·k + (σ/ρ)·k³. A 5 cm wave runs about 6% faster than gravity alone would
  // take it; a 60 cm one barely 0.4%.
  const c = (len) => O.omegaOf((2 * Math.PI) / len) / ((2 * Math.PI) / len), cg = (len) => Math.sqrt((9.81 * len) / (2 * Math.PI));
  assert.ok(Math.abs(c(0.05) / cg(0.05) - 1.057) < 0.01, `${c(0.05) / cg(0.05)}`);
  assert.ok(c(0.6) / cg(0.6) < 1.005);
  // Its spectrum is the sea's own, carrying its share.
  S.update(10, 0, 0.09);
  F.update(10, 0, 0.09);
  assert.ok(F.patch.m[0] > 0 && F.patch.m[0] < S.patch.m[0] * 0.05, 'little of the height');
  assert.ok(F.patch.m[2] > S.patch.m[2] * 0.6, 'much of the slope');
});

test('(W5) the glitter’s spread is the slope the drawn waves leave out, worked out from their spectra', async () => {
  const { seaSlopeVariance } = await import('../src/world/water.js');
  const share = (u) => {
    const chop = 0.02 + 0.005 * u ** 1.75, m0 = (chop * chop) / 4;
    const L = new O.Patch(O.PATCH.N, O.PATCH.L, 20251104, (k) => 1 - (k > O.CUT[1] ? 1 : k < O.CUT[0] ? 0 : (k - O.CUT[0]) / (O.CUT[1] - O.CUT[0])));
    const S = new O.ShortSpectrum(), F = new O.FineSpectrum();
    L.setSpectrum(u, 0, m0);
    S.update(u, 0, m0);
    F.update(u, 0, m0);
    const [up, across] = seaSlopeVariance(u), cm = up + across;
    return [O.slopeShare(L, cm), O.slopeShare(S.patch, cm), O.slopeShare(F.patch, cm)];
  };
  const light = share(3), strong = share(15);
  // The long waves alone draw almost none of it in light air, a sixth or so in a strong wind; the
  // finest, in light air hardly any (the wind barely raises ripples, rippleShare), in a strong one
  // about as much as the short ones; all together, from a sixth or so to (more than) all of it.
  assert.ok(light[0] < 0.02 && strong[0] > 0.12 && strong[0] < 0.25, `${light[0]} ${strong[0]}`);
  assert.ok(light[2] < light[1] * 0.4 && Math.abs(strong[2] / strong[1] - 1) < 0.5, `${light} / ${strong}`);
  const all = (s) => s[0] + s[1] + s[2];
  assert.ok(all(light) > 0.1 && all(light) < 0.3 && all(strong) > 0.9, `${all(light)} ${all(strong)}`);
  assert.equal(O.slopeShare(null, 0.05), 0);
});

test('(W5) ripples need a wind: none in light air under about 2.4 m/s, a fifth of their level at 3, all of it from about 6.6 (Elfouhaily et al.)', () => {
  // α_m = 0.01·(1 + ln(u*/c_m)) against its level at u* = c_m: u* = √(1.2·10⁻³)·U, c_m = 0.23 m/s.
  const at = (u) => O.rippleShare(u);
  assert.equal(at(0), 0);
  assert.equal(at(2), 0);
  assert.ok(at(2.4) < 0.01 && at(2.6) > 0.03);
  assert.ok(Math.abs(at(3) - (1 + Math.log((Math.sqrt(1.2e-3) * 3) / 0.23))) < 1e-12 && Math.abs(at(3) - 0.206) < 0.01);
  assert.ok(at(6.6) > 0.99 && at(12) === 1);
  for (let u = 2; u < 8; u += 0.25) assert.ok(at(u + 0.25) >= at(u));
  // The finest waves' spectrum carries it: in a light air, none of them; in a breeze, their share.
  const F = new O.FineSpectrum(), F2 = new O.FineSpectrum();
  F.update(2, 0, 0.01);
  assert.equal(F.patch.m[0], 0, 'a flat calm close by');
  F.update(7, 0, 0.01);
  const full = new O.ShortSpectrum(O.FINE, 4242, F.patch.band);
  full.update(7, 0, 0.01);
  assert.ok(Math.abs(F.patch.m[0] / full.patch.m[0] - O.rippleShare(7)) < 1e-9);
  // (At 4 m/s, half its level.)
  F2.update(4, 0, 0.01);
  full.update(4, 0, 0.01);
  assert.ok(Math.abs(F2.patch.m[0] / full.patch.m[0] - O.rippleShare(4)) < 1e-9 && Math.abs(O.rippleShare(4) - 0.49) < 0.01);
});
