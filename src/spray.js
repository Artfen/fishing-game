// Spray: thrown up where a hull actually meets the water. Every frame the hull physics (hydro.js)
// knows each corner of the hull's mesh and how high it stands above the water there; wherever a
// panel crosses the waterline and is driving into the water (her bow cutting through, her chines
// on the plane, her bottom slamming down into a sea, a heeled side shouldering through a wave),
// the water is pushed out of the way, and the harder it's pushed the more of it flies. So the
// spray comes off the real waterline at the real place: the shoulders of a displacement hull, a
// planing hull's chines well aft, the lee side of a heeled sailing boat, the whole bottom when she
// lands off a crest, and nothing from a hull gliding along without disturbing the water much.

import { sheetEdge } from './hydro.js';

const _p = [0, 0, 0], _v = [0, 0, 0], _l = [0, 0, 0];

// The places along her waterline throwing water just now, strongest first: each { x, y, z (world),
// nx, nz (the way it's thrown, outward across the water), un (how fast that bit of hull is driving
// into the water, m/s), U (the water's speed past it), len (how long a stretch of waterline it is,
// m), w (un × len: how much water is thrown) }. body: a HydroBody that has stepped at least once. min: the slowest push (m/s) that
// throws anything; max: how many to keep.
export function sprayPoints(body, { min = 0.3, max = 24 } = {}) {
  const M = body.model, { T, N, nt } = M, P = body.P, Hh = body.Hh, WV = body.WV, R = body.R;
  const out = [];
  if (!P || !Hh) return out;
  for (let k = 0; k < nt; k++) {
    const a = T[k * 3], b = T[k * 3 + 1], c = T[k * 3 + 2];
    const ha = Hh[a], hb = Hh[b], hc = Hh[c];
    // (Only a panel the waterline runs across.)
    const below = (ha < 0) + (hb < 0) + (hc < 0);
    if (below === 0 || below === 3) continue;
    const ln0 = N[k * 3], ln1 = N[k * 3 + 1], ln2 = N[k * 3 + 2];
    // (Not her deck or the lid over her: water over those is green water, not spray.)
    if (ln1 > 0.7) continue;
    // The two points where the waterline crosses its edges.
    let n = 0, x0 = 0, y0 = 0, z0 = 0, x1 = 0, y1 = 0, z1 = 0;
    const edge = (i, j, hi, hj) => {
      if ((hi < 0) === (hj < 0)) return;
      const t = hi / (hi - hj);
      const x = P[i * 3] + (P[j * 3] - P[i * 3]) * t, y = P[i * 3 + 1] + (P[j * 3 + 1] - P[i * 3 + 1]) * t, z = P[i * 3 + 2] + (P[j * 3 + 2] - P[i * 3 + 2]) * t;
      if (n === 0) { x0 = x; y0 = y; z0 = z; } else { x1 = x; y1 = y; z1 = z; }
      n++;
    };
    edge(a, b, ha, hb);
    edge(b, c, hb, hc);
    edge(c, a, hc, ha);
    if (n < 2) continue;
    const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    if (len < 1e-3) continue;
    // The panel's outward normal in the world, and how fast it's driving into the water there
    // (its own velocity through the moving water, along that normal).
    const nx = R[0] * ln0 + R[1] * ln1 + R[2] * ln2, ny = R[3] * ln0 + R[4] * ln1 + R[5] * ln2, nz = R[6] * ln0 + R[7] * ln1 + R[8] * ln2;
    _p[0] = (x0 + x1) / 2; _p[1] = (y0 + y1) / 2; _p[2] = (z0 + z1) / 2;
    body.pointVel(_p, _v);
    const wvx = (WV[a * 3] + WV[b * 3] + WV[c * 3]) / 3, wvy = (WV[a * 3 + 1] + WV[b * 3 + 1] + WV[c * 3 + 1]) / 3, wvz = (WV[a * 3 + 2] + WV[b * 3 + 2] + WV[c * 3 + 2]) / 3;
    const ux = _v[0] - wvx, uy = _v[1] - wvy, uz = _v[2] - wvz;
    const un = ux * nx + uy * ny + uz * nz;
    if (un < min) continue;
    // (The water's speed past the hull there: what a sheet of spray leaves the hull at.)
    const U = Math.hypot(ux, uy, uz);
    // (Thrown out across the water: the normal laid flat; a bottom panel slamming down throws its
    // water out sideways, the way her bottom slopes.)
    let hx = nx, hz = nz;
    const hl = Math.hypot(hx, hz);
    if (hl < 0.05) continue;
    hx /= hl;
    hz /= hl;
    // (A planing hull's spray roots lie in a V under her bottom: the sheet runs out under her and
    // leaves at her chine, or under a RIB's tube. That's where it's seen to fly from.)
    let x = _p[0], y = _p[1], z = _p[2];
    const dx = x - body.x[0], dy = y - body.x[1], dz = z - body.x[2], cg = M.cg;
    const lx = R[0] * dx + R[3] * dy + R[6] * dz + cg[0], lz = R[2] * dx + R[5] * dy + R[8] * dz + cg[2];
    const rim = sheetEdge(M.H, lz);
    if (rim && Math.abs(lx) < rim[0]) {
      _l[0] = Math.sign(lx || hx) * rim[0];
      _l[1] = rim[1];
      _l[2] = lz;
      body.toWorld(_l, _l);
      x = _l[0];
      y = _l[1];
      z = _l[2];
    }
    out.push({ x, y, z, nx: hx, nz: hz, un, U, len, w: un * len });
  }
  out.sort((p, q) => q.w - p.w);
  if (out.length > max) out.length = max;
  return out;
}

// How a spray point throws its water: the drops' velocity (m/s, world) for a point p from a hull
// moving at (vx, vz), with r1, r2 random numbers 0 … 1 for each drop. A sheet leaves the hull at a
// fair part of the water's speed past it, out across the water and a little up (low and flat off a
// planing hull's chine); a hull driving hard into the water (a slam, a bow burying in a sea) throws
// it higher; and the drops carry a little of the hull's own way.
export function sprayVelocity(p, vx, vz, r1, r2) {
  const out = p.U * (0.1 + 0.18 * r1) + p.un * 0.5, up = p.U * (0.07 + 0.15 * r2) + p.un * 0.7;
  return [p.nx * out + vx * 0.3, Math.min(up, 9), p.nz * out + vz * 0.3];
}

// How many drops a second a spray point throws (a sheet's worth from her chine at speed, a burst
// from a slam): its water (w) and how fast it's thrown.
export const sprayRate = (p) => Math.min(60, p.w * p.U * 2.2);
