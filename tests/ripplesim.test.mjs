// (W7) Ripples simulated round the boat (see ripplesim.js): the wave equation on a little square of
// water. A ripple spreads at its own speed, stays steady however long it runs, comes back off a
// wall as it went in (the water twice as high against it), passes through another unchanged, is
// soaked up at the square's edge rather than coming back off it, and keeps its place in the world
// as the square follows you. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const R = await import('../src/world/ripplesim.js');

// A small square for the tests: 160 cells of 15 cm, the game's speed and damping, no damping when
// asked (to see the waves themselves).
const N = 160, DX = 0.15, DT = 1 / 60;
const S0 = { ...R.SIM, DAMP: 0 };
function sea(s = R.SIM) {
  return { h0: new Float32Array(N * N), h1: new Float32Array(N * N), t: new Float32Array(N * N), s };
}
function run(w, secs, wall = null) {
  for (let k = 0; k < Math.round(secs / DT); k++) {
    R.step(w.h0, w.h1, w.t, wall, N, DX, DT, R.SIM.C, w.s);
    [w.h0, w.h1, w.t] = [w.h1, w.t, w.h0];
  }
  return w;
}
const at = (w, x, y) => w.h1[Math.round(y / DX) * N + Math.round(x / DX)];
const energy = (w, inner = 0) => {
  let e = 0;
  for (let j = inner; j < N - inner; j++) for (let i = inner; i < N - inner; i++) e += w.h1[j * N + i] ** 2;
  return e;
};

test('a ripple spreads at its own speed, and runs steady at the largest step', () => {
  assert.ok(R.SIM.C * DT / DX < 0.7, 'the game\'s step well inside the limit (c·dt/dx < 0.87)');
  assert.ok(Math.abs(R.maxStep(DX) - 0.6 * DX / R.SIM.C) < 1e-12);
  const w = sea(S0), mid = (N / 2) * DX;
  R.bump(w.h0, w.h1, N, DX, mid, mid, 0.2, 0.01);
  run(w, 3);
  // Its crest along a line out from the middle: about c·t out (1.35 m in 3 s).
  let best = 0, where = 0;
  for (let i = N / 2; i < N - 1; i++) {
    const v = w.h1[(N / 2) * N + i];
    if (v > best) {
      best = v;
      where = (i - N / 2) * DX;
    }
  }
  assert.ok(Math.abs(where - R.SIM.C * 3) < 0.35, `its crest ${where.toFixed(2)} m out after 3 s, for ${(R.SIM.C * 3).toFixed(2)}`);
  // At the largest step it's allowed, a long run never grows.
  const v = sea(S0);
  R.bump(v.h0, v.h1, N, DX, mid, mid, 0.3, 0.01);
  const dt = R.maxStep(DX);
  let most = 0;
  for (let k = 0; k < 3000; k++) {
    R.step(v.h0, v.h1, v.t, null, N, DX, dt, R.SIM.C, S0);
    [v.h0, v.h1, v.t] = [v.h1, v.t, v.h0];
    for (let q = 0; q < N * N; q += 97) most = Math.max(most, Math.abs(v.h1[q]));
  }
  assert.ok(Number.isFinite(most) && most < 0.01, `never above its start: ${most}`);
});

test('a ripple comes back off a wall as it went in: crest as crest, the water twice as high against it', () => {
  const mid = (N / 2) * DX, wx = mid + 1.5;
  // A quay wall: a line of solid cells 1.5 m east of the ripple's start.
  const wall = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = Math.round(wx / DX); i < Math.round(wx / DX) + 3; i++) wall[j * N + i] = 1;
  const free = sea(S0), walled = sea(S0);
  R.bump(free.h0, free.h1, N, DX, mid, mid, 0.2, 0.01);
  R.bump(walled.h0, walled.h1, N, DX, mid, mid, 0.2, 0.01);
  // Against the wall, as the ripple reaches it (1.5 m, at its speed): twice the free ripple there.
  let peakFree = 0, peakWall = 0;
  const xi = Math.round(wx / DX) - 1, slow = 0.8 / R.SIM.C;
  for (let k = 0; k < Math.round((2.6 * slow) / DT); k++) {
    for (const [w, wl] of [[free, null], [walled, wall]]) {
      R.step(w.h0, w.h1, w.t, wl, N, DX, DT, R.SIM.C, S0);
      [w.h0, w.h1, w.t] = [w.h1, w.t, w.h0];
    }
    peakFree = Math.max(peakFree, free.h1[(N / 2) * N + xi]);
    peakWall = Math.max(peakWall, walled.h1[(N / 2) * N + xi]);
  }
  const ratio = peakWall / peakFree;
  assert.ok(ratio > 1.6 && ratio < 2.3, `against the wall ${ratio.toFixed(2)} times the free ripple's height`);
  // And it comes back. What the wall adds is the walled water less the open water (each ripple's
  // height adds); 1.5 m west of the start that's the reflection, 4.5 m from where it began by way
  // of the wall. It comes back as it went: as high as the ripple itself 4.5 m out in open water,
  // and in the same order, its crest first and its trough after (a ripple that came back upside
  // down would bring its trough first).
  let back = 0, tBack = 0, trough = 0, tTrough = 0, direct = 0, tDirect = 0, dTrough = 0, tDT = 0;
  for (let k = 0; k < Math.round((4.4 * slow) / DT); k++) {
    for (const [w, wl] of [[free, null], [walled, wall]]) {
      R.step(w.h0, w.h1, w.t, wl, N, DX, DT, R.SIM.C, S0);
      [w.h0, w.h1, w.t] = [w.h1, w.t, w.h0];
    }
    const d = at(walled, mid - 1.5, mid) - at(free, mid - 1.5, mid), o = at(free, mid, mid + 4.5);
    if (d > back) [back, tBack] = [d, k];
    if (d < trough) [trough, tTrough] = [d, k];
    if (o > direct) [direct, tDirect] = [o, k];
    if (o < dTrough) [dTrough, tDT] = [o, k];
  }
  assert.ok(Math.abs(back / direct - 1) < 0.25 && Math.abs(trough / dTrough - 1) < 0.25, `came back ${back.toExponential(2)} / ${trough.toExponential(2)}, the ripple itself ${direct.toExponential(2)} / ${dTrough.toExponential(2)}`);
  assert.ok(tBack < tTrough && tDirect < tDT, `crest first: ${tBack} before ${tTrough} (the ripple itself ${tDirect}, ${tDT})`);
  // None gets through the wall.
  let through = 0;
  for (let j = 0; j < N; j++) for (let i = Math.round(wx / DX) + 3; i < N; i++) through = Math.max(through, Math.abs(walled.h1[j * N + i]));
  assert.equal(through, 0);
});

test('two ripples pass through each other unchanged: the water is each one\'s height added', () => {
  const a = sea(), b = sea(), ab = sea();
  R.bump(a.h0, a.h1, N, DX, 8, 12, 0.25, 0.01);
  R.bump(b.h0, b.h1, N, DX, 14, 11, 0.15, -0.006);
  R.bump(ab.h0, ab.h1, N, DX, 8, 12, 0.25, 0.01);
  R.bump(ab.h0, ab.h1, N, DX, 14, 11, 0.15, -0.006);
  run(a, 4);
  run(b, 4);
  run(ab, 4);
  let worst = 0;
  for (let q = 0; q < N * N; q++) worst = Math.max(worst, Math.abs(ab.h1[q] - a.h1[q] - b.h1[q]));
  assert.ok(worst < 1e-7, `${worst}`);
});

test('the square\'s edge soaks ripples up, and the water calms', () => {
  // A ripple near the middle, run long enough to reach the edge and (were it a wall) come back.
  const soaked = sea(), mid = (N / 2) * DX;
  R.bump(soaked.h0, soaked.h1, N, DX, mid, mid, 0.2, 0.01);
  run(soaked, 1);
  const e1 = energy(soaked, Math.round(R.SIM.EDGE * N));
  run(soaked, 30);
  const e2 = energy(soaked, Math.round(R.SIM.EDGE * N));
  assert.ok(e2 < e1 * 0.01, `inside the band, ${(e2 / e1 * 100).toFixed(2)}% of its energy left`);
  // The band: the game's damping inside, much more at the edge.
  assert.equal(R.dampAt(N / 2, N / 2, N), R.SIM.DAMP);
  assert.ok(R.dampAt(0, N / 2, N) === R.SIM.EDGE_DAMP && R.dampAt(3, N / 2, N) < R.SIM.EDGE_DAMP && R.dampAt(3, N / 2, N) > R.SIM.DAMP);
});

test('the square follows you and the ripples keep their place in the world', () => {
  // The same ripple run in a square that stays put, and in one that moves 5 cells east and 3
  // north half-way: where the two overlap, the water's the same.
  const still = sea(S0), moving = sea(S0);
  R.bump(still.h0, still.h1, N, DX, 10, 10, 0.2, 0.01);
  R.bump(moving.h0, moving.h1, N, DX, 10, 10, 0.2, 0.01);
  run(still, 1);
  run(moving, 1);
  R.scroll(moving.h0, N, 5, 3);
  R.scroll(moving.h1, N, 5, 3);
  run(still, 1);
  run(moving, 1);
  let worst = 0, top = 0;
  for (let j = 30; j < N - 30; j++) {
    for (let i = 30; i < N - 30; i++) {
      worst = Math.max(worst, Math.abs(moving.h1[j * N + i] - still.h1[(j + 3) * N + i + 5]));
      top = Math.max(top, Math.abs(still.h1[(j + 3) * N + i + 5]));
    }
  }
  assert.ok(top > 1e-4 && worst < top * 0.02, `${worst} against ${top}`);
});

test('a simulated ring is as steep as the drawn one was, as it runs at the game\'s grid', () => {
  // The game's grid, speed and bump: a ring's steepest slope R metres out, times √R, against the
  // table ringBump works from (RING), in open water and undamped.
  const S = R.SIM, dx = S.SPAN / S.N, M = 300, mid = (M / 2) * dx, S0g = { ...S, DAMP: 0 };
  let h0 = new Float32Array(M * M), h1 = new Float32Array(M * M), t = new Float32Array(M * M);
  R.bump(h0, h1, M, dx, mid, mid, S.BUMP, 1);
  const steep = R.RING.map(() => 0);
  for (let k = 0; k < Math.round((4.6 / S.C) / S.DT); k++) {
    R.step(h0, h1, t, null, M, dx, S.DT, S.C, S0g);
    [h0, h1, t] = [h1, t, h0];
    R.RING.forEach(([r], a) => {
      const i = Math.round((mid + r) / dx), j = M / 2;
      steep[a] = Math.max(steep[a], Math.abs(h1[j * M + i + 1] - h1[j * M + i - 1]) / (2 * dx));
    });
  }
  R.RING.forEach(([r, v], a) => {
    const got = steep[a] * Math.sqrt(r);
    assert.ok(Math.abs(got / v - 1) < 0.05, `${r} m out: ${got.toFixed(3)}, the table ${v}`);
  });
  // And a ring started by ringBump, damped as in the game, is as steep as the drawn ring of that
  // size and strength was a quarter of the way through its life, as far out as that ring was then:
  // a cast's, a rising fish's, a wavelet off the hull.
  for (const [size, str] of [[1.7, 0.5], [3.4, 0.5], [0.8, 0.3]]) {
    const D = R.ringShape(size, str, 0.25), want = R.ringSteep(D), at = Math.max(D.R, R.RING[0][0]);
    h0 = new Float32Array(M * M); h1 = new Float32Array(M * M); t = new Float32Array(M * M);
    R.bump(h0, h1, M, dx, mid, mid, S.BUMP, R.ringBump(size, str));
    let got = 0;
    for (let k = 0; k < Math.round((at / S.C + 2) / S.DT); k++) {
      R.step(h0, h1, t, null, M, dx, S.DT, S.C, S);
      [h0, h1, t] = [h1, t, h0];
      const i = Math.round((mid + at) / dx), j = M / 2;
      got = Math.max(got, Math.abs(h1[j * M + i + 1] - h1[j * M + i - 1]) / (2 * dx));
    }
    assert.ok(Math.abs(got / want - 1) < 0.12, `size ${size}: ${got.toFixed(4)} ${at.toFixed(2)} m out, the drawn ring ${want.toFixed(4)}`);
  }
});

test('a ring stays round: as high along the grid as across it', () => {
  // On a grid, the shorter waves trailing a ring run slower along its lines than across them if
  // only the nearest four cells are used: the ring came out square (5 s out, along the grid its
  // crest a quarter lower than on the diagonal, its trough 17%, and 0.11 m further in). With all
  // eight, the same within 1% at the game's grid.
  const S = R.SIM, dx = S.SPAN / S.N, M = 240, c = M / 2, S0g = { ...S, DAMP: 0 };
  let h0 = new Float32Array(M * M), h1 = new Float32Array(M * M), t = new Float32Array(M * M);
  R.bump(h0, h1, M, dx, c * dx, c * dx, S.BUMP, 1);
  for (let k = 0; k < Math.round(5 / S.DT); k++) {
    R.step(h0, h1, t, null, M, dx, S.DT, S.C, S0g);
    [h0, h1, t] = [h1, t, h0];
  }
  // The crest and the trough among the cells within 4° of each way out, and how far out they are.
  const along = (angle) => {
    let top = 0, where = 0, low = 0, lowAt = 0;
    for (let j = c; j < M; j++) {
      for (let i = c; i < M; i++) {
        const r = Math.hypot(i - c, j - c) * dx;
        if (r < 1 || Math.abs(Math.atan2(j - c, i - c) - angle) > (4 * Math.PI) / 180) continue;
        const v = h1[j * M + i];
        if (v > top) [top, where] = [v, r];
        if (v < low) [low, lowAt] = [v, r];
      }
    }
    return { top, where, low, lowAt };
  };
  const a = along(0), d = along(Math.PI / 4);
  assert.ok(Math.abs(a.top / d.top - 1) < 0.06 && Math.abs(a.low / d.low - 1) < 0.06, `crest ${a.top.toFixed(4)} along, ${d.top.toFixed(4)} on the diagonal; trough ${a.low.toFixed(4)}, ${d.low.toFixed(4)}`);
  assert.ok(Math.abs(a.where - d.where) < dx && Math.abs(a.lowAt - d.lowAt) < dx, `crest ${a.where.toFixed(2)} m out along, ${d.where.toFixed(2)} on the diagonal; trough ${a.lowAt.toFixed(2)}, ${d.lowAt.toFixed(2)}`);
});
