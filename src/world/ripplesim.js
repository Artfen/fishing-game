// (W7) Ripples simulated round the boat: the small waves a cast, the bobber, a rising fish, the
// oars or a wading foot make, run on a little square of water that follows you, as the wave
// equation runs them, so they spread, cross one another and come back off a hull, a quay or the
// shore (Crest's "dynamic waves", SIGGRAPH 2019, do the same). Drawn rings, before, only spread
// and faded: they ran through a boat and up a quay as if neither were there.
//
//   ∂²h/∂t² = c²∇²h − γ ∂h/∂t
//
// stepped leapfrog on a grid (the next height from this one and the last), steady so long as c·dt/dx
// stays under 0.87 (with the eight-neighbour Laplacian below; 1/√2 with the nearest four alone).
//
//  · c, the speed a ring spreads at. A ring's crests run through it at their own speed, but the
//    ring itself, its energy, spreads at the waves' group speed: for ripples of 2 to 30 cm, the
//    rings a cast, a rising fish or a raindrop make, that's 0.2 to 0.4 m/s (ω² = g·k + (σ/ρ)·k³:
//    see ocean.js omegaOf; the slowest of all is 0.18 m/s, at 4.4 cm). These spread at 0.45 m/s.
//    The equation runs every wavelength at that one speed; on a grid, the shortest waves run a
//    little slower, so a ring trails a train of shorter ones behind it, as a real ripple does
//    (whose longer waves run ahead).
//  · At a wall (a quay, a hull, the shore) no water goes through it: the height's slope across it
//    is nought, so a ripple comes back as it went in, crest as a crest, the water rising twice as
//    high against the wall as the ripple's own height.
//  · γ, a gentle damping, and round the edge of the square a band that soaks ripples up, so none
//    comes back off the square's own edge.
//
// The graphics card runs the same steps (ripplegpu.js): this file is the reference it's tested
// against.

export const SIM = {
  N: 512,       // cells across
  SPAN: 48,     // metres across: cells of 9.4 cm
  C: 0.45,      // the rings' speed, m/s
  DAMP: 0.35,   // γ, 1/s: a ring fades by e in about 6 s of its own, as well as by spreading
  EDGE: 0.12,   // the share of the square, all round, that soaks ripples up
  EDGE_DAMP: 6, // γ at the very edge, 1/s
  DT: 1 / 60,   // the step, s
  STEPS: 4,     // the most steps in a frame (time beyond that is let go)
  BUMP: 0.15,   // a ring starts as a bump this wide (m)
  MOST: 0.05    // the most the water's shown raised or lowered by them (m): see ringBump
};

// The largest stable step for cells dx metres across at speed c (with a margin).
export const maxStep = (dx, c = SIM.C) => (0.6 * dx) / c;

// The soaking band: γ at cell (i, j) of an N-cell square, from DAMP inside to EDGE_DAMP at the edge.
export function dampAt(i, j, N, s = SIM) {
  const e = Math.max(1, Math.round(s.EDGE * N));
  const d = Math.min(i, j, N - 1 - i, N - 1 - j);
  if (d >= e) return s.DAMP;
  const u = 1 - d / e;
  return s.DAMP + (s.EDGE_DAMP - s.DAMP) * u * u;
}

// One step of dt seconds: from h1 (now) and h0 (a step ago) into out (a step on). wall: 1 where
// the cell is solid (a quay, a hull, the shore). Cells are dx metres across. out may be h0.
export function step(h0, h1, out, wall, N, dx, dt, c = SIM.C, s = SIM) {
  const r = (c * dt / dx) ** 2;
  // (A wall's side: no flow across it, the slope nought, so it's as if the height there were this
  // cell's own. The square's own edge the same; the soaking band takes the ripples first.)
  const at = (a, b, hc) => (a >= 0 && a < N && b >= 0 && b < N && !(wall && wall[b * N + a]) ? h1[b * N + a] : hc);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const q = j * N + i;
      if (wall && wall[q]) {
        out[q] = 0;
        continue;
      }
      const hc = h1[q];
      // The Laplacian from all eight neighbours, the nearest four weighted 4 and the corners 1
      // (Patra and Karttunen 2006): a ring stays round, where the nearest four alone run its
      // shorter waves slower along the grid than across it, and it comes out square.
      const lap = (4 * (at(i - 1, j, hc) + at(i + 1, j, hc) + at(i, j - 1, hc) + at(i, j + 1, hc)) +
        at(i - 1, j - 1, hc) + at(i + 1, j - 1, hc) + at(i - 1, j + 1, hc) + at(i + 1, j + 1, hc) - 20 * hc) / 6;
      const g = dampAt(i, j, N, s) * dt * 0.5;
      out[q] = (2 * hc - (1 - g) * h0[q] + r * lap) / (1 + g);
    }
  }
  return out;
}

// A ripple started at (x, y) metres from the square's corner: a smooth bump of height amp and
// radius rad (metres), added to now and a step ago alike, so it starts still and spreads.
export function bump(h0, h1, N, dx, x, y, rad, amp) {
  const r2 = rad * rad, reach = Math.ceil((rad * 3) / dx);
  const ci = Math.round(x / dx), cj = Math.round(y / dx);
  for (let j = Math.max(0, cj - reach); j <= Math.min(N - 1, cj + reach); j++) {
    for (let i = Math.max(0, ci - reach); i <= Math.min(N - 1, ci + reach); i++) {
      const ex = i * dx - x, ey = j * dx - y, v = amp * Math.exp(-(ex * ex + ey * ey) / r2);
      h0[j * N + i] += v;
      h1[j * N + i] += v;
    }
  }
}

// The square moved by (di, dj) cells (it follows you): the water's heights stay where they are in
// the world, so in the square's own cells they shift the other way; what comes in from beyond
// is still water.
export function scroll(h, N, di, dj, tmp = new Float32Array(N * N)) {
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const si = i + di, sj = j + dj;
      tmp[j * N + i] = si >= 0 && si < N && sj >= 0 && sj < N ? h[sj * N + si] : 0;
    }
  }
  h.set(tmp);
  return h;
}

// A drawn ring (waterfx.js RippleField, beyond the square, and before W7 everywhere) of `size`
// metres and strength str, u of the way through its life: its radius R, wavelength, the width of
// its band and its height (m).
export function ringShape(size, str, u) {
  const R = 0.08 + size * Math.sqrt(u);
  const lambda = 0.16 + 0.07 * size + 0.12 * u;
  const width = lambda * (0.9 + 0.8 * u);
  const amp = 0.12 * str * (1 - u) * (1 - u) * lambda / (1 + R * 0.9);
  return { R, lambda, width, amp };
}
// Its steepest slope.
export const ringSteep = (D) => D.amp * (2 * Math.PI / D.lambda) * Math.exp(-((D.lambda / (4 * D.width)) ** 2));

// A ring from a bump of height 1 (SIM.BUMP wide) in the square: its steepest slope R metres out,
// times √R (in open water, undamped), as the steps run it at the game's grid, speed and bump
// (measured: tests/ripplesim.test.mjs checks it). Spreading alone would keep this the same; the
// grid's shortest waves falling behind into the train take it down slowly.
export const RING = [[0.3, 0.993], [0.5, 0.957], [0.75, 0.882], [1, 0.823], [1.5, 0.763], [2, 0.706], [2.5, 0.634], [3, 0.594], [4, 0.543]];
export function ringSlope(R) {
  if (R <= RING[0][0]) return RING[0][1];
  for (let k = 1; k < RING.length; k++) {
    if (R <= RING[k][0]) {
      const [r0, v0] = RING[k - 1], [r1, v1] = RING[k];
      return v0 + ((v1 - v0) * (R - r0)) / (r1 - r0);
    }
  }
  return RING[RING.length - 1][1];
}

// The bump that starts a ring as steep, a quarter of the way through its life, as the drawn ring
// of that size and strength was (so the water looks as it was tuned to, but the rings now run as
// the water does). Its height (m). A big one is a tall, narrow bump for its first moment (a ring
// from a fish rising: about 0.3 m): the water's shown raised by SIM.MOST at most.
export function ringBump(size, str, s = SIM) {
  const D = ringShape(size, str, 0.25), R = Math.max(D.R, RING[0][0]);
  return (ringSteep(D) * Math.sqrt(R)) / (ringSlope(R) * Math.exp((-s.DAMP * R) / (2 * s.C)));
}
