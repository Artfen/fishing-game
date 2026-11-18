// (W6, first part) The wind sea the right way up (see ocean.js compute): its water carried in
// towards each crest and away from each trough, as a real wave's orbits do, so its crests are sharp
// and its troughs broad, the whitecaps break on the crests, and the water runs forward under them.
// Until W6 the to-and-fro had the wrong sign for the transform it's used with (Tessendorf's −i·k̂·ĥ
// with his positive λ): blunt crests, sharp troughs, whitecaps breaking in the troughs and the water
// running backwards under each crest. And where the crests are breaking now (LongSea.brk,
// breaking, breakingAt). Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const O = await import('../src/world/ocean.js');
const C = await import('../src/world/conditions.js');

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

test('the wind sea the right way up: the water carried in towards each crest, so the crests are sharp, break, and the water runs forward under them', async () => {
  const t = blow(14);
  longSea.at(t);
  const f = longSea.a, N = longSea.N, cell = longSea.L / N;
  // How the water's to-and-fro bunches it (the divergence of its displacement) against the height:
  // drawn in under each crest, spread out under each trough (a Gerstner wave's −A sin θ under A cos θ).
  let hd = 0, h2 = 0, d2 = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const q = j * N + i, row = j * N;
      const div = (f.dx[row + ((i + 1) % N)] - f.dx[row + ((i + N - 1) % N)]) / (2 * cell) + (f.dz[((j + 1) % N) * N + i] - f.dz[((j + N - 1) % N) * N + i]) / (2 * cell);
      hd += f.h[q] * div;
      h2 += f.h[q] ** 2;
      d2 += div * div;
    }
  }
  assert.ok(hd / Math.sqrt(h2 * d2) < -0.9, `${(hd / Math.sqrt(h2 * d2)).toFixed(2)}: the water drawn in to the crests`);
  // So the crests are sharp and the troughs broad, and the crests stand higher above the sea's mean
  // level than the troughs fall below it, as a Gerstner (or Stokes) wave's do: the surface's mean,
  // each bit of it counted by the area it's spread over (its Jacobian), lies below the still water.
  const lam = longSea.choppy / Math.SQRT2;
  let hJ = 0, sJ = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const q = j * N + i, row = j * N;
      const dxx = (f.dx[row + ((i + 1) % N)] - f.dx[row + ((i + N - 1) % N)]) / (2 * cell);
      const dzz = (f.dz[((j + 1) % N) * N + i] - f.dz[((j + N - 1) % N) * N + i]) / (2 * cell);
      const dxz = (f.dx[((j + 1) % N) * N + i] - f.dx[((j + N - 1) % N) * N + i]) / (2 * cell);
      const J = (1 + lam * dxx) * (1 + lam * dzz) - lam * lam * dxz * dxz;
      hJ += f.h[q] * J;
      sJ += J;
    }
  }
  const sd = Math.sqrt(h2 / (N * N));
  assert.ok(hJ / sJ < -0.02 * sd, `the sea's mean ${(hJ / sJ).toFixed(3)} m (its height's spread ${sd.toFixed(2)} m)`);
  const out = { b: 0, x: 0, z: 0, h: 0, vx: 0, vy: 0, vz: 0 };
  // The whitecaps break on the crests: high above the mean where they break.
  let hb = 0, nb = 0, hs = 0;
  for (let i = 0; i < 20000; i++) {
    const x = (i % 150) * 0.93, z = Math.floor(i / 150) * 1.05;
    longSea.breakingAt(x, z, t, 1, out);
    hs += out.h * out.h;
    if (out.b > 0.5) {
      hb += out.h;
      nb++;
    }
  }
  const rms = Math.sqrt(hs / 20000);
  assert.ok(nb > 50 && hb / nb > rms, `breaking ${(hb / nb).toFixed(2)} m above the mean, the sea's rms ${rms.toFixed(2)} m`);
  // The water runs forward under a crest, with the waves (back in a trough).
  let ax = 0, az = 0;
  for (let q = 0; q < N * N; q++) {
    ax -= f.ht[q] * f.hx[q];
    az -= f.ht[q] * f.hz[q];
  }
  const l = Math.hypot(ax, az);
  let hu = 0, u2 = 0;
  for (let q = 0; q < N * N; q++) {
    const u = (f.ux[q] * ax + f.uz[q] * az) / l;
    hu += f.h[q] * u;
    u2 += u * u;
  }
  assert.ok(hu / Math.sqrt(h2 * u2) > 0.9, 'forward under the crests');
  // The short waves on the graphics card the same way (oceangpu.js: D = +i k̂ ĥ, with this
  // transform, and its pinch from that).
  const fs = await import('node:fs');
  const gpu = fs.readFileSync(new URL('../src/world/oceangpu.js', import.meta.url), 'utf8');
  assert.match(gpu, /vec2 dx = ih \* \(kv\.x \/ kk\), dz = ih \* \(kv\.y \/ kk\);/);
  assert.match(gpu, /vec2 dxx = -h \* \(kv\.x \* kv\.x \/ kk\), dzz = -h \* \(kv\.y \* kv\.y \/ kk\), dxz = -h \* \(kv\.x \* kv\.y \/ kk\);/);
});

test('the crests breaking: where they are, carried along by the water, and none in light air', () => {
  const t = blow(18);
  longSea.at(t);
  // As much of the sea breaking as the whitecaps' cover: each copy carries half of it (ocean.js).
  let n = 0;
  for (const b of longSea.brk) if (b > 0.5) n++;
  const share = n / longSea.brk.length, want = 3.84e-6 * 18 ** 3.41 * 0.5;
  assert.ok(share > want * 0.6 && share < want * 1.5, `${(share * 100).toFixed(1)}% of the cells breaking, for ${(want * 100).toFixed(1)}%`);
  // A crest breaking: the point of the surface it's carried to, the wind sea's height there (as
  // the surface everyone else reads), the water's motion.
  const out = { b: 0, x: 0, z: 0, h: 0, vx: 0, vy: 0, vz: 0 };
  let found = 0;
  for (let i = 0; i < 4000 && found < 20; i++) {
    const x = (i % 63) * 1.7, z = Math.floor(i / 63) * 1.3;
    if (longSea.breaking(x, z) < 0.6) continue;
    found++;
    longSea.breakingAt(x, z, t, 1, out);
    assert.ok(out.b >= 0.6 && Math.hypot(out.x - x, out.z - z) < 1.5, 'carried a metre at most');
    // (The surface everyone reads finds its still-water point in one step, which where the water's
    // folding over can be a little off: within a quarter of a metre.)
    const surf = longSea.add(out.x, out.z, t, 1, { h: 0, vy: 0, vx: 0, vz: 0 });
    assert.ok(Math.abs(surf.h - out.h) < 0.25, `the crest at ${out.h.toFixed(2)} m, the surface there ${surf.h.toFixed(2)} m`);
  }
  assert.ok(found >= 20);
  // In sheltered water (a share of the sea) it's carried less far.
  longSea.breakingAt(31, 47, t, 0.3, out);
  const half = Math.hypot(out.x - 31, out.z - 47);
  longSea.breakingAt(31, 47, t, 1, out);
  assert.ok(Math.abs(half - 0.3 * Math.hypot(out.x - 31, out.z - 47)) < 1e-9);
  // Light air: no crest breaks.
  blow(3);
  assert.ok(longSea.brk.every((b) => b === 0));
});
