// A boat as a real floating body: a rigid hull of a few hundred triangles, its mass and inertia,
// pushed about by the water it sits in. Every substep, each triangle of the hull is cut at the
// waterline, and the part below it feels:
//
//  · the water's pressure, which grows with depth (buoyancy, and the hull's own shape righting
//    her when she heels or pitches, falls out of this alone);
//  · drag where it pushes into the water (and suction where it pulls away from it), from how fast
//    it moves through the water: resistance ahead, grip sideways, damping as she rolls and
//    pitches, and the lift that raises a fast boat's bow and planes a board;
//  · skin friction along it.
//
// This is the model of Jacques Kerner's "Water interaction model for boats in video games" (the
// Just Cause 3 boats), with the moving water itself (the waves' orbital motion and the current)
// carried into every velocity. Keels, centreboards, rudders, fins and outboard legs are foils:
// lift across the flow and drag along it, stalling past their best angle. On top: propellers,
// oars, sails and ropes as forces at the points where they act, the wind on the topsides, and
// the seabed, piers and other hulls as contacts.
//
// Units: metres, kilograms, seconds, newtons. The hull's local frame is the boat's: +z to the
// bow, +y up from the keel, +x to port (left); the water stands at local y = H.draft when she
// floats level at her design weight.

import { hypot2, hypot3, hypot4 } from './hypot.js';

export const RHO = 1025;   // sea water, kg/m³
export const G = 9.81;

// Momentum under way. A hull's resistance curve and the push that drives her against it (see
// hullForces, boat.js) are each several times a real boat's (they balance at the same speeds, so
// every boat makes her real top speed, and the hull grips and turns as a real one does); but
// along her length, that would have her leap up to speed and stop dead when the throttle came
// off. So once she's moving, everything that pushes her along her way (the propeller, the water's
// resistance, her rudder and keel, the wind, the seas) moves her that much less, as if she were
// that much heavier along her track: her surge (H.surge: 1 as she is; less, more of a real boat's
// momentum: the heavy yacht carries her way for a hundred metres, a light skiff stops sooner).
// The forces balance where they always did, so each throttle setting still gives the speed it
// always did: only how quickly she gets there, and how far she runs on after, changes. Nothing
// else is touched (how she heaves, pitches, rolls, turns and grips the water; the bottom, piers,
// other boats and ropes, which stop her as hard as ever), and below a walking pace nothing at all
// changes (manoeuvring, mooring, drifting at anchor).
export const surgeShare = (surge, v) => {
  if (surge >= 1) return 1;
  const u = Math.min(1, Math.max(0, (Math.abs(v) - 0.6) / 1.9));
  return 1 - (1 - surge) * u * u * (3 - 2 * u);
};
const NU = 1.19e-6;        // kinematic viscosity of sea water, m²/s
const RHO_AIR = 1.2;

// The shape of a hull at t (0 stern … 1 bow), as boat.js builds its mesh.
const hw = (H, t) => H.B * H.hw(t);
const sheer = (H, t) => H.D + H.sheer(t);
const zAt = (H, t) => -H.L / 2 + H.L * t;
// A point round the hull's section at t: j from 0 (port gunwale) through NP/2 (the keel) to NP
// (starboard gunwale), exactly as boat.js hullSurface.
function hullPoint(H, t, j, NP) {
  const w = hw(H, t), s = sheer(H, t), k = H.keel(t);
  const [x, y] = section(H, w, s, k, -Math.PI / 2 + Math.PI * (j / NP));
  return [x, y, zAt(H, t)];
}
// A point round a hull's section, at angle a from the keel (−π/2 the port gunwale, π/2 the
// starboard): half-beam w, gunwale height s, keel height k. Most hulls are a soft round-bilged
// curve; a deep-V (H.vee: { chine, wc, rise }) runs straight up from the keel at its deadrise to a
// hard chine (at `chine` of the way round, `wc` of the half-beam out), then up the topside.
export function section(H, w, s, k, a) {
  const V = H.vee;
  if (!V) {
    const sn = Math.sin(a), cs = Math.max(Math.cos(a), 0);
    return [w * Math.sign(sn) * Math.pow(Math.abs(sn), 0.65), k + (s - k) * (1 - Math.pow(cs, 0.55))];
  }
  const u = Math.min(1, Math.abs(a) / (Math.PI / 2)), c = V.chine, wc = w * V.wc, yc = k + Math.min(V.rise * wc, 0.8 * (s - k));
  const x = u < c ? wc * (u / c) : wc + (w - wc) * ((u - c) / (1 - c));
  const y = u < c ? k + (yc - k) * (u / c) : yc + (s - yc) * ((u - c) / (1 - c));
  return [Math.sign(a) * x, y];
}

// A RIB's tubes (H.tubes: { r, out, drop, t1 }): the centre of the tube's round section at t
// along her (0 stern … t1, where the two meet at the nose) on side sd (+1 starboard, −1 port),
// lying along her gunwale, out from the hull by `out` of its radius and down by `drop`.
export function tubeCentre(H, t, sd) {
  const T = H.tubes, u = Math.min(1, Math.max(0, t));
  return [sd * (hw(H, u) + T.r * T.out), sheer(H, u) - T.r * T.drop, zAt(H, t)];
}

// Where a sheet of spray running out under her bottom at local z leaves the hull: her hard chine,
// on a deep-V (where the bottom meets the topside), or the underside of a RIB's tube outside it;
// null for a round-bilged hull, whose spray leaves where the water meets her. Returns [x (the
// side's half-width, positive), y] in her local frame.
export function sheetEdge(H, z) {
  const t = Math.min(1, Math.max(0, (z + H.L / 2) / H.L));
  let out = null;
  if (H.vee) {
    const w = hw(H, t), s = sheer(H, t), k = H.keel(t), wc = w * H.vee.wc;
    out = [wc, k + Math.min(H.vee.rise * wc, 0.8 * (s - k))];
  }
  if (H.tubes && t <= H.tubes.t1) {
    const c = tubeCentre(H, t, 1), r = H.tubes.r;
    out = [c[0] + r * 0.35, c[1] - r * 0.85];
  }
  return out;
}

/* ---------------- the hull model ---------------- */

// Build what the physics needs from a hull spec (boat.js HULLS): a closed mesh (the hull, the
// transom, a bow cap where the hull doesn't close, and a lid at the gunwale, so she's a sealed
// shell), mass, centre of gravity and inertia, the lattice the water is sampled on, the foils, and
// the points that touch the bottom and bump into piers and other boats.
export function buildHullModel(H) {
  const NZ = H.L > 6 ? 16 : 12, NP = 8;
  const rows = [];
  for (let i = 0; i <= NZ; i++) {
    const row = [];
    for (let j = 0; j <= NP; j++) row.push(hullPoint(H, i / NZ, j, NP));
    rows.push(row);
  }
  const verts = [];
  const idx = (i, j) => i * (NP + 1) + j;
  for (const row of rows) for (const p of row) verts.push(p);
  const tris = [];
  const axis = (z) => {
    // (The middle of the section, for telling which way is out.)
    const t = Math.min(1, Math.max(0, (z + H.L / 2) / H.L));
    return [0, (H.keel(t) + sheer(H, t)) / 2, z];
  };
  const addTri = (a, b, c, out) => {
    const A = verts[a], B = verts[b], C = verts[c];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) return;
    nx /= len; ny /= len; nz /= len;
    const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3, cz = (A[2] + B[2] + C[2]) / 3;
    const ref = out || [cx - axis(cz)[0], cy - axis(cz)[1], 0];
    if (nx * ref[0] + ny * ref[1] + nz * ref[2] < 0) tris.push([a, c, b]);
    else tris.push([a, b, c]);
  };
  for (let i = 0; i < NZ; i++) {
    for (let j = 0; j < NP; j++) {
      addTri(idx(i, j), idx(i + 1, j), idx(i + 1, j + 1));
      addTri(idx(i, j), idx(i + 1, j + 1), idx(i, j + 1));
    }
  }
  // The transom (facing aft), a bow cap if the hull's open there (facing forward), and the lid.
  const capEnd = (i, out) => {
    const row = rows[i];
    const cy = (row[0][1] + row[NP / 2][1]) / 2;
    verts.push([0, cy, row[0][2]]);
    const c = verts.length - 1;
    for (let j = 0; j < NP; j++) addTri(c, idx(i, j), idx(i, j + 1), out);
  };
  capEnd(0, [0, 0, -1]);
  if (hw(H, 1) > 0.01) capEnd(NZ, [0, 0, 1]);
  for (let i = 0; i < NZ; i++) {
    addTri(idx(i, 0), idx(i, NP), idx(i + 1, NP), [0, 1, 0]);
    addTri(idx(i, 0), idx(i + 1, NP), idx(i + 1, 0), [0, 1, 0]);
  }
  // A RIB's tubes, each a sealed shell of its own along her side: out of the water lying still,
  // they press on it as she heels or pitches into a sea, and stand her up again.
  if (H.tubes) {
    const TB = H.tubes, NT = 12, NS = 8, t0 = -0.05, t1 = TB.t1 ?? 0.93;
    for (const sd of [1, -1]) {
      const base = verts.length, centres = [];
      for (let i = 0; i <= NT; i++) {
        const c = tubeCentre(H, t0 + (t1 - t0) * (i / NT), sd);
        centres.push(c);
        for (let k = 0; k < NS; k++) {
          const a = (k / NS) * Math.PI * 2;
          verts.push([c[0] + sd * TB.r * Math.cos(a), c[1] + TB.r * Math.sin(a), c[2]]);
        }
      }
      const at = (i, k) => base + i * NS + (k % NS);
      for (let i = 0; i < NT; i++) {
        for (let k = 0; k < NS; k++) {
          const a = ((k + 0.5) / NS) * Math.PI * 2, out = [sd * Math.cos(a), Math.sin(a), 0];
          addTri(at(i, k), at(i + 1, k), at(i + 1, k + 1), out);
          addTri(at(i, k), at(i + 1, k + 1), at(i, k + 1), out);
        }
      }
      // (Sealed at both ends.)
      for (const [i, dir] of [[0, -1], [NT, 1]]) {
        verts.push(centres[i]);
        const m = verts.length - 1;
        for (let k = 0; k < NS; k++) addTri(m, at(i, k), at(i, k + 1), [0, 0, dir]);
      }
    }
  }

  const nv = verts.length, nt = tris.length;
  const V = new Float64Array(nv * 3);
  verts.forEach((p, i) => { V[i * 3] = p[0]; V[i * 3 + 1] = p[1]; V[i * 3 + 2] = p[2]; });
  const T = new Uint16Array(nt * 3);
  const N = new Float64Array(nt * 3), A = new Float64Array(nt);
  tris.forEach((tr, k) => {
    T.set(tr, k * 3);
    const [a, b, c] = tr;
    const ux = V[b * 3] - V[a * 3], uy = V[b * 3 + 1] - V[a * 3 + 1], uz = V[b * 3 + 2] - V[a * 3 + 2];
    const vx = V[c * 3] - V[a * 3], vy = V[c * 3 + 1] - V[a * 3 + 1], vz = V[c * 3 + 2] - V[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    A[k] = len / 2;
    N[k * 3] = nx / len; N[k * 3 + 1] = ny / len; N[k * 3 + 2] = nz / len;
  });

  // The water's surface is sampled on a coarse lattice over the hull's footprint and each vertex
  // reads it from its four corners (fixed weights: both are fixed to the hull). A long boat's
  // lattice is no finer than her length allows, so she bridges short chop as a real one does.
  const NA = H.L > 6 ? 9 : 7, NC = 3;
  let bMax = 0;
  for (let i = 0; i <= NZ; i++) bMax = Math.max(bMax, hw(H, i / NZ) + (H.tubes ? H.tubes.r * (H.tubes.out + 1) : 0));
  const latX = [-bMax * 1.05, 0, bMax * 1.05];
  const latZ = [];
  for (let a = 0; a < NA; a++) latZ.push(-H.L / 2 - 0.05 + (H.L + 0.1) * (a / (NA - 1)));
  const lat = new Float64Array(NA * NC * 2);
  for (let a = 0; a < NA; a++) for (let c = 0; c < NC; c++) { lat[(a * NC + c) * 2] = latX[c]; lat[(a * NC + c) * 2 + 1] = latZ[a]; }
  const W = new Float64Array(nv * 4), WI = new Uint16Array(nv * 4);
  for (let i = 0; i < nv; i++) {
    const x = V[i * 3], z = V[i * 3 + 2];
    let fa = ((z - latZ[0]) / (latZ[NA - 1] - latZ[0])) * (NA - 1);
    fa = Math.min(NA - 1.0001, Math.max(0, fa));
    const a0 = Math.floor(fa), ta = fa - a0;
    let fc = ((x - latX[0]) / (latX[2] - latX[0])) * 2;
    fc = Math.min(1.9999, Math.max(0, fc));
    const c0 = Math.floor(fc), tc = fc - c0;
    const set = (k, a, c, w) => { WI[i * 4 + k] = a * NC + c; W[i * 4 + k] = w; };
    set(0, a0, c0, (1 - ta) * (1 - tc));
    set(1, a0 + 1, c0, ta * (1 - tc));
    set(2, a0, c0 + 1, (1 - ta) * tc);
    set(3, a0 + 1, c0 + 1, ta * tc);
  }

  const model = { H, NZ, NP, rows, nv, nt, V, T, N, A, NA, NC, lat, W, WI, bMax };
  // Mass, and where her weight sits: she floats level (with you aboard) at whatever draft her
  // weight sinks her to: her design draft, unless she's given her own weight.
  let hs = hydrostatics(model, H.draft);
  model.mass = H.mass ?? RHO * hs.volume;
  let rest = H.draft;
  if (H.mass) {
    let lo = 0.002, hi = H.D;
    for (let i = 0; i < 30; i++) {
      rest = (lo + hi) / 2;
      if (RHO * hydrostatics(model, rest).volume > model.mass) hi = rest;
      else lo = rest;
    }
    hs = hydrostatics(model, rest);
  }
  model.restDraft = rest;
  model.volume = hs.volume;
  model.cb = hs.cb;
  model.cg = [0, H.cgY ?? Math.min((H.floorY ?? 0.1) + 0.24, H.D * 0.62), hs.cb[2]];
  const m = model.mass, L = H.L, Bf = 2 * bMax;
  // (Radii of gyration of a boat: a quarter of her length in pitch and yaw, the usual naval
  // architect's figure, and a little over a third of her beam in roll.)
  model.inertia = [m * (0.25 * L) ** 2, m * (0.25 * L) ** 2, m * (0.38 * Bf) ** 2];
  model.wetted = hs.wetted;
  model.waterplane = hs.waterplane;
  // (Her stiffness in roll from her waterplane alone, N·m a radian: what a wave's slope works
  // against, whatever she weighs.)
  model.rollK = RHO * G * hs.iwp;

  // Foils: keels, centreboards, skegs, rudders, fins, outboard legs (see foilsFor).
  model.foils = foilsFor(H, bMax);
  // Points that touch the seabed (the keel line, the chines, the ends, the foils' tips) and that
  // bump into piers and other boats (round the gunwale and the waterline).
  const contacts = [];
  for (let i = 0; i <= NZ; i += 2) contacts.push(rows[i][NP / 2]);
  for (let i = 1; i < NZ; i += 3) contacts.push(rows[i][2], rows[i][NP - 2]);
  contacts.push(rows[NZ][NP / 2], rows[0][1], rows[0][NP - 1]);
  for (const f of model.foils) if (f.tip) contacts.push(f.tip);
  model.contacts = contacts;
  const ring = [];
  for (let i = 0; i <= NZ; i += 2) {
    ring.push(rows[i][0], rows[i][NP]);
    const wl = Math.min(sheer(H, i / NZ) - 0.05, H.draft + 0.05);
    ring.push([hw(H, i / NZ) * 0.95, wl, zAt(H, i / NZ)], [-hw(H, i / NZ) * 0.95, wl, zAt(H, i / NZ)]);
  }
  ring.push([0, sheer(H, 1), zAt(H, 1) + 0.02], [0, H.draft + 0.05, zAt(H, 1)]);
  // (A RIB meets a pier or another boat with her tubes: the outside of each, all along.)
  if (H.tubes) {
    for (let t = 0; t <= (H.tubes.t1 ?? 0.93); t += 0.12) {
      for (const sd of [1, -1]) {
        const c = tubeCentre(H, t, sd);
        ring.push([c[0] + sd * H.tubes.r, c[1], c[2]]);
      }
    }
  }
  model.ring = ring;
  model.drag = calibrate(model);
  return model;
}

// Each of the hull's vertices' heights (V: local, x, y, z each) above a level waterline at draft.
function levelHeights(V, draft) {
  const n = V.length / 3, Hv = new Float64Array(n);
  for (let i = 0; i < n; i++) Hv[i] = V[i * 3 + 1] - draft;
  return Hv;
}

// What the water does to her floating still and level at a draft: the displaced volume, its
// centre (the centre of buoyancy), the wetted area and the waterplane's area.
export function hydrostatics(model, draft) {
  const { V, T, N, A, nt } = model;
  let fy = 0, mx = 0, mz = 0, my = 0, wet = 0;
  const sub = _clip, Hv = levelHeights(V, draft);
  for (let k = 0; k < nt; k++) {
    const ns = clipTriangle(V, Hv, T, k, sub);
    for (let i = 0; i < ns; i++) {
      const o = i * CLIP, area = sub[o], d = -sub[o + 4];
      const p = RHO * G * d * area;
      const fyk = -p * N[k * 3 + 1];
      fy += fyk;
      mx += fyk * sub[o + 1];
      mz += fyk * sub[o + 3];
      my += fyk * sub[o + 2];
      wet += area;
    }
  }
  const volume = fy / (RHO * G);
  // (The waterplane, roughly: the footprint where the hull crosses the draft.)
  const { H, NZ } = model;
  let wp = 0, iwp = 0;
  for (let i = 0; i < NZ; i++) {
    const t0 = i / NZ, t1 = (i + 1) / NZ;
    const w0 = halfBeamAt(model, t0, draft), w1 = halfBeamAt(model, t1, draft), dz = zAt(H, t1) - zAt(H, t0);
    wp += (w0 + w1) * dz;
    // (And its second moment about the centreline: how stiffly she stands up to a heel.)
    iwp += (((w0 + w1) / 2) ** 3 * 2 * dz) / 3;
  }
  return { volume, cb: [fy ? mx / fy : 0, fy ? my / fy : 0, fy ? mz / fy : 0], wetted: wet, waterplane: wp, iwp };
}

// The hull's half-beam at t where it crosses height y (0 below the keel).
function halfBeamAt(model, t, y) {
  const { H, NP } = model;
  let prev = hullPoint(H, t, NP / 2, NP);
  if (prev[1] >= y) return 0;
  for (let j = NP / 2 + 1; j <= NP; j++) {
    const p = hullPoint(H, t, j, NP);
    if (p[1] >= y) return prev[0] + (p[0] - prev[0]) * ((y - prev[1]) / (p[1] - prev[1] || 1));
    prev = p;
  }
  return prev[0];
}

// Cut triangle k (its corners' indices in T; their points in P, x, y, z each, and their heights
// above the water in Hv, one each) at the waterline and write the submerged parts (none, one or
// two triangles) into out, CLIP numbers each: area, the centroid cx, cy, cz (in P's frame), and
// hc (the centroid's height above the water, negative under it). Returns how many. (Plain
// numbers into buffers, and no calls: it runs for every wet panel of every hull, hundreds of
// times a frame.)
export const CLIP = 5;
export function clipTriangle(P, Hv, T, k, out) {
  const a = T[k * 3], b = T[k * 3 + 1], c = T[k * 3 + 2];
  const h0 = Hv[a], h1 = Hv[b], h2 = Hv[c];
  const below = (h0 < 0) + (h1 < 0) + (h2 < 0);
  if (below === 0) return 0;
  // The submerged triangles' corners (x, y, z and height, each), into C.
  const C = _tri, ia = a * 3, ib = b * 3, ic = c * 3;
  let nt = 1;
  if (below === 3) {
    C[0] = P[ia]; C[1] = P[ia + 1]; C[2] = P[ia + 2]; C[3] = h0;
    C[4] = P[ib]; C[5] = P[ib + 1]; C[6] = P[ib + 2]; C[7] = h1;
    C[8] = P[ic]; C[9] = P[ic + 1]; C[10] = P[ic + 2]; C[11] = h2;
  } else {
    // Order the corners by height, L lowest … H highest (corners at the same height keep their
    // order, as a stable sort leaves them).
    let L = ia, M = ib, Hi = ic, hL = h0, hM = h1, hH = h2, q;
    if (hM < hL) { q = L; L = M; M = q; q = hL; hL = hM; hM = q; }
    if (hH < hM) {
      q = M; M = Hi; Hi = q; q = hM; hM = hH; hH = q;
      if (hM < hL) { q = L; L = M; M = q; q = hL; hL = hM; hM = q; }
    }
    const lx = P[L], ly = P[L + 1], lz = P[L + 2], ux = P[Hi], uy = P[Hi + 1], uz = P[Hi + 2];
    // (Where the edge from L to the highest corner crosses the waterline.)
    const tLH = hL / (hL - hH);
    const bx = lx + (ux - lx) * tLH, by = ly + (uy - ly) * tLH, bz = lz + (uz - lz) * tLH;
    C[0] = lx; C[1] = ly; C[2] = lz; C[3] = hL;
    if (below === 1) {
      // Only L is under: the triangle from it to where its two edges cross.
      const tM = hL / (hL - hM);
      C[4] = lx + (P[M] - lx) * tM; C[5] = ly + (P[M + 1] - ly) * tM; C[6] = lz + (P[M + 2] - lz) * tM; C[7] = 0;
      C[8] = bx; C[9] = by; C[10] = bz; C[11] = 0;
    } else {
      // L and M under: the quadrilateral up to the crossings, as two triangles.
      const mx = P[M], my = P[M + 1], mz = P[M + 2];
      const tMH = hM / (hM - hH);
      const ax = mx + (ux - mx) * tMH, ay = my + (uy - my) * tMH, az = mz + (uz - mz) * tMH;
      C[4] = mx; C[5] = my; C[6] = mz; C[7] = hM;
      C[8] = ax; C[9] = ay; C[10] = az; C[11] = 0;
      C[12] = lx; C[13] = ly; C[14] = lz; C[15] = hL;
      C[16] = ax; C[17] = ay; C[18] = az; C[19] = 0;
      C[20] = bx; C[21] = by; C[22] = bz; C[23] = 0;
      nt = 2;
    }
  }
  // Each one's area and centroid (none for a sliver).
  let n = 0;
  for (let i = 0; i < nt; i++) {
    const j = i * 12;
    const ax = C[j], ay = C[j + 1], az = C[j + 2], bx = C[j + 4], by = C[j + 5], bz = C[j + 6], cx = C[j + 8], cy = C[j + 9], cz = C[j + 10];
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const area = 0.5 * hypot3(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (area < 1e-10) continue;
    const o = n * CLIP;
    out[o] = area;
    out[o + 1] = (ax + bx + cx) / 3;
    out[o + 2] = (ay + by + cy) / 3;
    out[o + 3] = (az + bz + cz) / 3;
    out[o + 4] = (C[j + 3] + C[j + 7] + C[j + 11]) / 3;
    n++;
  }
  return n;
}
const _tri = new Float64Array(24), _clip = new Float64Array(2 * CLIP);

// The foils each hull carries. Each: where its centre of pressure is (local), the way its face
// points (local, across the flow), its area and aspect ratio, how deep it reaches (for the bottom
// and for knowing when it's out of the water), and whether the helm turns it.
function foilsFor(H, bMax) {
  const F = [];
  const keelAt = (t) => H.keel(t);
  const foil = (o) => {
    const f = { area: 0.1, ar: 1.5, cl: 2 * Math.PI, stall: 0.3, steer: 0, span: 0.3, n: [1, 0, 0], ...o };
    // (Its tip touches the bottom; an outboard's leg tilts up out of the way instead.)
    if (!f.leg) f.tip = [f.p[0], f.p[1] - f.span / 2, f.p[2]];
    F.push(f);
  };
  // A keel strip or skeg along the bottom of the wooden boats and the cabin boat; a shallow keel
  // on the motorboats (strakes and the like): they hold a course and don't skid at speed.
  const keel = (t0, t1, depth, ar = 0.2) => {
    const tm = (t0 + t1) / 2, len = H.L * (t1 - t0);
    foil({ p: [0, keelAt(tm) - depth / 2, zAt(H, tm)], area: len * depth, ar, span: depth, stall: 0.6 });
  };
  switch (H.name) {
    case 'rowing boat': keel(0.08, 0.85, 0.07); break;
    case 'motor skiff': keel(0.08, 0.85, 0.07); break;
    case 'kayak': keel(0.05, 0.3, 0.05); break;
    case 'bass boat': keel(0.1, 0.8, 0.05); break;
    case 'cabin boat': keel(0.05, 0.85, 0.12); break;
    case 'sport-fishing yacht': keel(0.1, 0.75, 0.25); break;
    case 'centre-console boat': keel(0.1, 0.8, 0.08); break;
    case 'jet ski': keel(0.1, 0.7, 0.06); break;
    default:
  }
  if (H.sail) {
    // The centreboard, down through the keel amidships, and the rudder hung on the transom.
    foil({ p: [0, keelAt(0.52) - 0.42, zAt(H, 0.52)], area: 0.3, ar: 2.8, span: 0.84, stall: 0.28 });
    foil({ p: [0, H.draft - 0.42, zAt(H, 0) - 0.12], area: 0.2, ar: 2.4, span: 0.62, steer: 0.62, rudder: true, stall: 0.38 });
  }
  if (H.rig) {
    // The windsurf board's fin, under its tail.
    foil({ p: [0, keelAt(0.08) - 0.2, zAt(H, 0.08)], area: 0.045, ar: 3.2, span: 0.38, stall: 0.3 });
  }
  if (H.motor?.inboard) {
    // Two rudders behind the propellers.
    for (const s of [1, -1]) foil({ p: [s * (H.motor.twin ?? 0.4), keelAt(0.05) - 0.3, zAt(H, 0) + 0.25], area: 0.16, ar: 1.6, span: 0.5, steer: 0.6, rudder: true, stall: 0.4 });
  }
  if (H.motor?.jet) {
    // A jet ski's pump housing and ride plate under her stern, and the sponsons either side:
    // the grip aft that keeps her running straight at speed instead of swapping ends.
    foil({ p: [0, keelAt(0.06) - 0.07, zAt(H, 0.06)], area: 0.05, ar: 1.4, span: 0.14, stall: 0.45 });
  }
  const ob = H.motor && !H.motor.inboard && !H.motor.jet ? H.motor : H.outboard;
  if (ob) {
    // An outboard's leg (its gearcase and skeg) under the transom: turned with the tiller or the
    // wheel, it grips the water as a rudder does, so her stern doesn't skid out as she turns.
    // (Only while it's down in the water: see legDown.)
    const sc = ob.scale ?? 1, legs = ob.twin ? [ob.twin, -ob.twin] : [ob.side || 0];
    for (const x of legs) foil({ p: [x, keelAt(0) - 0.08 * sc, zAt(H, 0) - 0.18], area: 0.045 * sc * sc, ar: 2.2, span: 0.4 * sc, steer: 0.7, rudder: true, leg: true, stall: 0.35 });
  }
  if (H.paddle) {
    // A kayak's skeg, and the little rudder its electric motor steers by.
    foil({ p: [0, keelAt(0.04) - 0.05, zAt(H, 0.04)], area: 0.02, ar: 1.2, span: 0.1, stall: 0.5, kayak: true });
  }
  return F;
}

/* ---------------- calibration ---------------- */

// The panel drag's two coefficients (N per m² of hull, for each m/s and each (m/s)² it moves
// through the water). Going ahead, a hull's resistance is mostly the waves it makes, which panels
// can't know about, so ahead she follows her own resistance curve instead (H.resist: force per
// kilogram at a speed; see hullForces). The panels give everything else: the quadratic term is a
// flat plate's drag (half the water's density, times a drag coefficient about 1.1), which grips
// her sideways once she's moving and lifts a fast hull; the linear term is the damping of the
// waves she makes as she heaves, pitches and rolls (a small boat bobs two or three times and
// settles), and a little slow grip.
function calibrate(model) {
  const H = model.H;
  const resist = H.resist || ((v) => (H.drag?.[0] ?? 0.26) * v + (H.drag?.[1] ?? 0.055) * v * v);
  return { c1: H.c1 ?? 220, c2: H.c2 ?? 0.5 * RHO * 1.1, resist };
}

// Skin friction (N) at a speed over the hull's wetted area (the ITTC line).
function frictionAt(model, v) {
  if (v < 1e-3) return 0;
  const re = Math.max(1e5, (v * model.H.L) / NU);
  const cf = 0.075 / (Math.log10(re) - 2) ** 2;
  return 0.5 * RHO * cf * model.wetted * v * v;
}

// The panels' pressure drag and suction, moving at v along one of her axes (0 sideways, 2 ahead),
// level at her draft.
function panelResistance(model, v, c1, c2, axis = 2) {
  const { V, T, N, nt } = model;
  const draft = model.H.draft;
  let f = 0;
  const sub = _clip, Hv = levelHeights(V, draft);
  for (let k = 0; k < nt; k++) {
    const ns = clipTriangle(V, Hv, T, k, sub);
    let area = 0;
    for (let i = 0; i < ns; i++) area += sub[i * CLIP];
    if (!area) continue;
    const cos = N[k * 3 + axis];
    const mag = (c1 * v + c2 * v * v) * area * Math.sqrt(Math.abs(cos));
    // (Pressure on the faces that meet the water, suction on those that leave it: both hold her back.)
    f += mag * Math.abs(cos);
  }
  return f;
}

/* ---------------- the body ---------------- */

const _o = { h: 0, vx: 0, vy: 0, vz: 0 };

export class HydroBody {
  constructor(model) {
    this.model = model;
    this.m = model.mass;
    this.I = model.inertia; // about local x (pitch), y (yaw), z (roll)
    this.x = [0, 0, 0];     // the centre of gravity, world
    this.v = [0, 0, 0];
    this.q = [0, 0, 0, 1];  // orientation (x, y, z, w)
    this.w = [0, 0, 0];     // angular velocity, world
    this.R = new Float64Array(9);
    const nv = model.nv, nl = model.NA * model.NC;
    this.P = new Float64Array(nv * 3);   // vertices, world
    this.Hh = new Float64Array(nv);      // each vertex's height above the water
    this.WV = new Float64Array(nv * 3);  // the water's velocity at each vertex
    this.LH = new Float64Array(nl);      // the lattice: water height and velocity
    this.LV = new Float64Array(nl * 3);
    this.LH0 = new Float64Array(nl);
    this.F = [0, 0, 0];
    this.Tq = [0, 0, 0];
    this.submerged = 0;   // the hull's wetted area this step (m²)
    this.dryT = 0;        // how long she's been clear of the water (s)
    this.impact = 0;      // the hardest she's met the water or the ground lately (m/s into it)
    this.grounded = 0;    // how much of her is resting on the bottom (0 … 1)
    this.scrape = 0;      // how hard she's sliding on the bottom (m/s)
    // Set by the boat each frame.
    this.thrusters = [];  // { p: [local], d: [local unit], f: N, vent: m (submersion needed); k: how far in (0 … 1), set by step }
    this.forces = [];     // { f: [world N], p: [world] }
    this.ropes = [];      // { p: [local], to: [world] | () => [world], len, k, c, out: { tension } }
    this.rudder = 0;      // helm angle (rad) on the steerable foils
    this.legDown = false; // an outboard's leg down in the water (not tilted up, nor stowed)
    this.roll0 = 0.62;    // past this roll (rad) the crew lean out and ease off: never over
    this.balance = 0;     // a standing rider's balance (windsurf): how firmly she's held upright
    this.pitchBalance = 0; // a rider's lean fore and aft against porpoising (jet ski, at speed)
    this.trimBias = 0;    // a held lean (rad of roll) the crew sit out for (sailing): torque target
    this.heelMoment = 0;  // the crew's weight moment to windward (N·m, + raises port)
    this.wind = [0, 0];   // the true wind (m/s, world xz)
    this.windage = 0.003; // the topsides' push per kg for each (m/s)² of air past them
    this.windageAt = [0, model.H.D + 0.25, 0];
    this.current = [0, 0];
    this.drag = model.drag;
    this.surge = 1;       // her momentum under way (see surgeShare): set by the boat
    this.Fs = [0, 0, 0];  // (this step's forces before the ropes and contacts)
  }

  // Float her level at x, z, heading (the water at its height there).
  place(x, z, heading, surface = 0) {
    const M = this.model;
    const s = Math.sin(heading / 2), c = Math.cos(heading / 2);
    this.q = [0, s, 0, c];
    this.updateR();
    // The keel's origin sits her draft below the water.
    const cg = M.cg;
    const R = this.R;
    this.x = [x + R[0] * cg[0] + R[1] * cg[1] + R[2] * cg[2], surface - M.restDraft + R[3] * cg[0] + R[4] * cg[1] + R[5] * cg[2], z + R[6] * cg[0] + R[7] * cg[1] + R[8] * cg[2]];
    this.v = [0, 0, 0];
    this.w = [0, 0, 0];
    this.dryT = 0;
  }

  updateR() {
    const q = this.q, x = q[0], y = q[1], z = q[2], w = q[3], R = this.R;
    R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - z * w); R[2] = 2 * (x * z + y * w);
    R[3] = 2 * (x * y + z * w); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - x * w);
    R[6] = 2 * (x * z - y * w); R[7] = 2 * (y * z + x * w); R[8] = 1 - 2 * (x * x + y * y);
  }

  // A local point (relative to the hull's origin) in the world.
  toWorld(p, out = [0, 0, 0]) {
    const R = this.R, cg = this.model.cg;
    const lx = p[0] - cg[0], ly = p[1] - cg[1], lz = p[2] - cg[2];
    out[0] = this.x[0] + R[0] * lx + R[1] * ly + R[2] * lz;
    out[1] = this.x[1] + R[3] * lx + R[4] * ly + R[5] * lz;
    out[2] = this.x[2] + R[6] * lx + R[7] * ly + R[8] * lz;
    return out;
  }

  // A local direction in the world.
  dirWorld(d, out = [0, 0, 0]) {
    const R = this.R;
    out[0] = R[0] * d[0] + R[1] * d[1] + R[2] * d[2];
    out[1] = R[3] * d[0] + R[4] * d[1] + R[5] * d[2];
    out[2] = R[6] * d[0] + R[7] * d[1] + R[8] * d[2];
    return out;
  }

  // The velocity of a world point fixed to the hull.
  pointVel(p, out = [0, 0, 0]) {
    const rx = p[0] - this.x[0], ry = p[1] - this.x[1], rz = p[2] - this.x[2], w = this.w;
    out[0] = this.v[0] + w[1] * rz - w[2] * ry;
    out[1] = this.v[1] + w[2] * rx - w[0] * rz;
    out[2] = this.v[2] + w[0] * ry - w[1] * rx;
    return out;
  }

  // A sudden push (N·s) at a world point: a rope snatching tight, a shove off a pier.
  applyImpulse(jx, jy, jz, px, py, pz) {
    const m = this.m, R = this.R, I = this.I, w = this.w;
    this.v[0] += jx / m; this.v[1] += jy / m; this.v[2] += jz / m;
    const rx = px - this.x[0], ry = py - this.x[1], rz = pz - this.x[2];
    const tx = ry * jz - rz * jy, ty = rz * jx - rx * jz, tz = rx * jy - ry * jx;
    // (Into her own frame, through her inertia, and back out.)
    const l0 = (R[0] * tx + R[3] * ty + R[6] * tz) / I[0], l1 = (R[1] * tx + R[4] * ty + R[7] * tz) / I[1], l2 = (R[2] * tx + R[5] * ty + R[8] * tz) / I[2];
    w[0] += R[0] * l0 + R[1] * l1 + R[2] * l2;
    w[1] += R[3] * l0 + R[4] * l1 + R[5] * l2;
    w[2] += R[6] * l0 + R[7] * l1 + R[8] * l2;
  }

  addForce(fx, fy, fz, px, py, pz) {
    const F = this.F, T = this.Tq;
    F[0] += fx; F[1] += fy; F[2] += fz;
    const rx = px - this.x[0], ry = py - this.x[1], rz = pz - this.x[2];
    T[0] += ry * fz - rz * fy;
    T[1] += rz * fx - rx * fz;
    T[2] += rx * fy - ry * fx;
  }

  // Step dt seconds in substeps. env: { t (time at the start), water(x, z, t, out),
  // ground(x, z), contact(body, p, v, out) for piers and other boats (returns a force or null) }.
  step(dt, env) {
    if (dt <= 0) return;
    const fast = Math.hypot(this.v[0], this.v[2]) > 6 || this.dryT > 0;
    const hMax = fast ? 1 / 240 : 1 / 120;
    const n = Math.max(1, Math.ceil(dt / hMax - 1e-6)), h = dt / n;
    this.impact *= Math.exp(-dt * 4);
    // (Barely moving, she reads the water round her once a step and carries its rise and fall on
    // through the substeps; under way, every substep.)
    const v = this.v, w = this.w;
    const slow = !fast && v[0] * v[0] + v[2] * v[2] < 2.25 && Math.abs(v[1]) < 0.5 && w[0] * w[0] + w[1] * w[1] + w[2] * w[2] < 0.25;
    for (let s = 0; s < n; s++) this.substep(h, env.t + s * h, env, slow && s > 0 ? h * s : -1);
  }

  substep(h, t, env, carry = -1) {
    const M = this.model, R = this.R, x = this.x;
    this.updateR();
    this.F[0] = 0; this.F[1] = -this.m * G; this.F[2] = 0;
    this.Tq[0] = this.Tq[1] = this.Tq[2] = 0;
    const cg = M.cg;
    // The water on the lattice (or, carry ≥ 0, the step's first reading carried on that long).
    const nl = M.NA * M.NC;
    if (carry >= 0) for (let j = 0; j < nl; j++) this.LH[j] = this.LH0[j] + this.LV[j * 3 + 1] * carry;
    else for (let j = 0; j < nl; j++) {
      const lx = M.lat[j * 2] - cg[0], ly = M.H.draft - cg[1], lz = M.lat[j * 2 + 1] - cg[2];
      const wx = x[0] + R[0] * lx + R[1] * ly + R[2] * lz, wz = x[2] + R[6] * lx + R[7] * ly + R[8] * lz;
      env.water(wx, wz, t, _o);
      this.LH[j] = _o.h;
      this.LV[j * 3] = _o.vx + this.current[0];
      this.LV[j * 3 + 1] = _o.vy;
      this.LV[j * 3 + 2] = _o.vz + this.current[1];
      this.LH0[j] = _o.h;
    }
    // Each vertex in the world, the water's height and motion there.
    const { V, W, WI, nv } = M, P = this.P;
    for (let i = 0; i < nv; i++) {
      const lx = V[i * 3] - cg[0], ly = V[i * 3 + 1] - cg[1], lz = V[i * 3 + 2] - cg[2];
      const px = x[0] + R[0] * lx + R[1] * ly + R[2] * lz;
      const py = x[1] + R[3] * lx + R[4] * ly + R[5] * lz;
      const pz = x[2] + R[6] * lx + R[7] * ly + R[8] * lz;
      P[i * 3] = px; P[i * 3 + 1] = py; P[i * 3 + 2] = pz;
      let eh = 0, ex = 0, ey = 0, ez = 0;
      for (let k = 0; k < 4; k++) {
        const j = WI[i * 4 + k], w = W[i * 4 + k];
        eh += this.LH[j] * w;
        ex += this.LV[j * 3] * w; ey += this.LV[j * 3 + 1] * w; ez += this.LV[j * 3 + 2] * w;
      }
      this.Hh[i] = py - eh;
      this.WV[i * 3] = ex; this.WV[i * 3 + 1] = ey; this.WV[i * 3 + 2] = ez;
    }
    this.hullForces(h);
    this.foilForces();
    // Propellers and jets: they push where they are, the way they point, while they're in the water.
    for (const th of this.thrusters) {
      if (!th.f) continue;
      const p = this.toWorld(th.p, _p1), d = this.dirWorld(th.d, _p2);
      const depth = this.depthAt(p, env, t);
      const k = th.vent ? Math.min(1, Math.max(0, (depth + 0.02) / th.vent)) : 1;
      // (How deep in it is, as a share of what it needs to grip: the boat reads it back for the
      // engine's revs, see Boat.propBite.)
      th.k = k;
      // (lever: how much of the propeller's depth below her centre of gravity turns her bow up.
      // It grips the water where it is, but a push that has to make up for the game's own hull
      // resistance is bigger than a real propeller's, and would twist her over far harder than a
      // real one does: so its turning arm is scaled to what a real propeller's would be.)
      // (Only its push along her and up and down: its sideways push, as it steers, heels her on
      // its full arm, as it always has.)
      if (k > 0 && th.lever != null && th.lever !== 1) {
        const cg = this.model.cg, f = th.f * k;
        _l1[0] = th.p[0]; _l1[1] = cg[1] + (th.p[1] - cg[1]) * th.lever; _l1[2] = th.p[2];
        _l2[0] = 0; _l2[1] = th.d[1]; _l2[2] = th.d[2];
        _l3[0] = th.d[0]; _l3[1] = 0; _l3[2] = 0;
        const q = this.toWorld(_l1, _p3);
        const fa = this.dirWorld(_l2, _pc), fs = this.dirWorld(_l3, _pv);
        this.addForce(fa[0] * f, fa[1] * f, fa[2] * f, q[0], q[1], q[2]);
        this.addForce(fs[0] * f, fs[1] * f, fs[2] * f, p[0], p[1], p[2]);
      } else if (k > 0) this.addForce(d[0] * th.f * k, d[1] * th.f * k, d[2] * th.f * k, p[0], p[1], p[2]);
      // Its slipstream over the leg or the rudder behind it: what steers a boat at idle, before
      // she has way enough on for the hull and the leg to bite on their own.
      if (th.foil && k > 0) {
        const wash = Math.sign(th.f) * Math.sqrt((2 * Math.abs(th.f) * k) / (RHO * th.foil.disk));
        const fd = th.foil.d || th.d;
        _l1[0] = fd[2]; _l1[1] = 0; _l1[2] = -fd[0];
        this.foil(th.foil.p || th.p, _l1, th.foil.area * k, th.foil.ar ?? 1.5, th.foil.stall ?? 0.35, 2 * Math.PI, wash, fd);
      }
    }
    for (const fo of this.forces) this.addForce(fo.f[0], fo.f[1], fo.f[2], fo.p[0], fo.p[1], fo.p[2]);
    this.windForce();
    // (What drives her and holds her back as she goes, before the ropes, the bottom and anything
    // she bumps into: the part her momentum under way applies to. See surgeShare.)
    this.Fs[0] = this.F[0]; this.Fs[1] = this.F[1]; this.Fs[2] = this.F[2];
    this.ropeForces(h);
    this.groundForces(env);
    if (env.contact) this.contactForces(env);
    this.crewForces();
    this.integrate(h);
  }

  // How far a world point is below the water (positive under it).
  depthAt(p, env, t) {
    env.water(p[0], p[2], t, _o);
    return _o.h - p[1];
  }

  hullForces(h) {
    const M = this.model, { T, N, nt } = M, P = this.P, Hh = this.Hh, WV = this.WV;
    const R = this.R, c1 = this.drag.c1, c2 = this.drag.c2;
    const sub = _clip, X = this.x, Vb = this.v, Wb = this.w;
    let wet = 0, along = 0, wx = 0, wy = 0, wz = 0, ux0 = 0, uz0 = 0;
    const bx = R[2], by = R[5], bz = R[8];
    const speed = hypot2(this.v[0] - this.current[0], this.v[2] - this.current[1]);
    const re = Math.max(1e5, (speed * M.H.L) / NU);
    const cf = 0.075 / (Math.log10(re) - 2) ** 2;
    // (How much the faces leaving the water still pull: all of it slow, a quarter on the plane.)
    const fn = speed / Math.sqrt(G * M.H.L);
    const suck = 1 - 0.75 * Math.min(1, Math.max(0, (fn - 0.6) / 0.8)) ** 2;
    for (let k = 0; k < nt; k++) {
      const a = T[k * 3], b = T[k * 3 + 1], c = T[k * 3 + 2];
      const ha = Hh[a], hb = Hh[b], hc = Hh[c];
      if (ha >= 0 && hb >= 0 && hc >= 0) continue;
      const ns = clipTriangle(P, Hh, T, k, sub);
      if (!ns) continue;
      // The panel's outward normal in the world.
      const ln0 = N[k * 3], ln1 = N[k * 3 + 1], ln2 = N[k * 3 + 2];
      const nx = R[0] * ln0 + R[1] * ln1 + R[2] * ln2, ny = R[3] * ln0 + R[4] * ln1 + R[5] * ln2, nz = R[6] * ln0 + R[7] * ln1 + R[8] * ln2;
      // The water's motion here (the panel's corners averaged).
      const wvx = (WV[a * 3] + WV[b * 3] + WV[c * 3]) / 3, wvy = (WV[a * 3 + 1] + WV[b * 3 + 1] + WV[c * 3 + 1]) / 3, wvz = (WV[a * 3 + 2] + WV[b * 3 + 2] + WV[c * 3 + 2]) / 3;
      for (let i = 0; i < ns; i++) {
        const o = i * CLIP, area = sub[o], scx = sub[o + 1], scy = sub[o + 2], scz = sub[o + 3];
        wet += area;
        // Pressure, by depth.
        const p = RHO * G * -sub[o + 4] * area;
        let fx = -p * nx, fy = -p * ny, fz = -p * nz;
        // Drag: the panel's own velocity through the moving water. (Its velocity as a point
        // fixed to the hull, as pointVel works it out.)
        const rx = scx - X[0], ry = scy - X[1], rz = scz - X[2];
        const ux = Vb[0] + Wb[1] * rz - Wb[2] * ry - wvx, uy = Vb[1] + Wb[2] * rx - Wb[0] * rz - wvy, uz = Vb[2] + Wb[0] * ry - Wb[1] * rx - wvz;
        const u = hypot3(ux, uy, uz);
        if (u > 1e-4) {
          const cos = (ux * nx + uy * ny + uz * nz) / u;
          // (The slow, linear part is the waves she sends out heaving, pitching and rolling: it's
          // the bottom's, mostly, not the sides'. And the water slips round her sides far more
          // easily than it gets out from under her flat bottom: going sideways, a hull's flanks
          // feel only about a quarter of what her bottom does lifting or planing.)
          const any = Math.abs(ny);
          const mag = (c1 * u * (0.2 + 0.8 * any) + c2 * u * u * (0.25 + 0.75 * any)) * area * Math.abs(cos);
          // Into the water: pressure drag, pushing back along the normal. Away from it: suction,
          // pulling back towards it. (Both oppose the panel's motion through the water. But going
          // fast the flow breaks away from her chines and transom and the air gets in under her:
          // lifting off a crest, nothing much holds her down but her weight.)
          const sgn = cos > 0 ? -1 : 1, f = cos > 0 ? mag : mag * suck;
          fx += sgn * f * nx; fy += sgn * f * ny; fz += sgn * f * nz;
          // Skin friction, along the panel.
          const un = ux * nx + uy * ny + uz * nz;
          const tx = ux - un * nx, ty = uy - un * ny, tz = uz - un * nz, tl = hypot3(tx, ty, tz);
          const fr = 0.5 * RHO * cf * area * tl;
          fx -= fr * tx; fy -= fr * ty; fz -= fr * tz;
          // (What the drag does along her bow axis, to be put right below.)
          along += (sgn * f * nx - fr * tx) * bx + (sgn * f * ny - fr * ty) * by + (sgn * f * nz - fr * tz) * bz;
        }
        wx += scx * area; wy += scy * area; wz += scz * area;
        ux0 += wvx * area; uz0 += wvz * area;
        this.addForce(fx, fy, fz, scx, scy, scz);
      }
    }
    this.submerged = wet;
    if (wet < 1e-3) this.dryT += h;
    else this.dryT = 0;
    if (wet < 1e-3) return;
    // Ahead and astern she meets her own resistance (the waves she makes and the water along
    // her), in proportion to how much of her is in the water: lifted clear on a crest she
    // runs free; buried in a sea she's slowed. It acts low down, where the water is.
    const hl = hypot2(bx, bz) || 1;
    // (Her speed through the water round her: the current and the waves' own to-and-fro.)
    const wux = ux0 / wet, wuz = uz0 / wet;
    const vf = ((this.v[0] - wux) * bx + (this.v[2] - wuz) * bz) / hl;
    // (Running at her usual trim, lifted onto the plane or not, it's her whole resistance; only
    // as she leaves the water altogether does it fall away.)
    const wr = wet / this.model.wetted;
    const share = Math.min(1, wr / 0.03) + Math.max(0, wr - 1) * 0.6;
    // The flow round a hull going a little sideways also turns her (the Munk moment, from the
    // water's own inertia): it swings the bow away from the way she's going, so a hull making
    // leeway gripes up to windward (weather helm), and a hull with no keel is unsteady at speed.
    const px = R[0], pz = R[6];
    const vs = (this.v[0] - wux) * px + (this.v[2] - wuz) * pz;
    const vv = vf * vf + vs * vs;
    if (vv > 0.04) {
      const munk = -0.12 * this.m * Math.min(1, share) * vs * vf;
      this.Tq[0] += R[1] * munk; this.Tq[1] += R[4] * munk; this.Tq[2] += R[7] * munk;
    }
    const want = -Math.sign(vf) * this.m * this.drag.resist(Math.abs(vf)) * share;
    const fix = want - along;
    // (On her centreline, at the wetted part's height and its place along her: heeled, the
    // wetted area lies to leeward, but a hull's resistance doesn't swing her bow away for it.)
    const cx = wx / wet - this.x[0], cy = wy / wet - this.x[1], cz = wz / wet - this.x[2];
    const side = cx * R[0] + cy * R[3] + cz * R[6];
    this.addForce(fix * bx, fix * by, fix * bz, wx / wet - side * R[0], wy / wet - side * R[3], wz / wet - side * R[6]);
  }

  // Keels, centreboards, rudders, fins: lift across the flow, drag along it.
  foilForces() {
    const M = this.model;
    for (const f of M.foils) {
      if (f.leg && !this.legDown) continue;
      // How much of it is under water (the hull's draft at its spot).
      const depth = -this.localWaterHeight(f.p) + f.span / 2;
      const wetK = Math.min(1, Math.max(0, depth / f.span));
      if (wetK <= 0) continue;
      // Its face, turned by the helm about the vertical.
      let n = f.n;
      if (f.steer || f.kayak) {
        const d = this.rudder * (f.steer || 0.5);
        n = _l1;
        n[0] = Math.cos(d); n[1] = 0; n[2] = -Math.sin(d);
      }
      this.foil(f.p, n, f.area * wetK, f.ar, f.stall, f.cl, 0, null);
    }
  }

  // One foil at local point lp, its face along local n: the water's flow past it (her motion
  // through the current, plus wash: a propeller's slipstream, m/s along the local direction wd).
  foil(lp, n, area, ar, stall, clA = 2 * Math.PI, wash = 0, wd = null) {
    const p = this.toWorld(lp, _p1);
    this.pointVel(p, _pv);
    let ux = _pv[0] - this.current[0], uy = _pv[1], uz = _pv[2] - this.current[1];
    if (wash && wd) {
      // (The slipstream streams aft past it: as if it were going that much faster ahead.)
      this.dirWorld(wd, _p3);
      ux += _p3[0] * wash; uy += _p3[1] * wash; uz += _p3[2] * wash;
    }
    const u = hypot3(ux, uy, uz);
    if (u < 0.02) return;
    this.dirWorld(n, _p2);
    const nx = _p2[0], ny = _p2[1], nz = _p2[2];
    const sa = (ux * nx + uy * ny + uz * nz) / u; // sin of the angle of attack
    const alpha = Math.asin(Math.max(-1, Math.min(1, sa)));
    const aa = Math.abs(alpha);
    // Thin-wing lift, falling away past the stall; induced and form drag.
    const k3 = clA / (1 + 2 / ar);
    const cl = aa < stall ? k3 * aa : k3 * stall * Math.max(0.35, 1 - (aa - stall) * 1.5) + 1.1 * Math.sin(aa) * Math.cos(aa) * Math.min(1, (aa - stall) * 3);
    const cd = 0.012 + (cl * cl) / (Math.PI * ar * 0.85) + (aa > stall ? 1.0 * Math.sin(aa) ** 2 : 0);
    const q = 0.5 * RHO * area * u * u;
    // Lift: across the flow, against the side the water comes from.
    const lx = nx - (sa * ux) / u, ly = ny - (sa * uy) / u, lz = nz - (sa * uz) / u;
    const ll = hypot3(lx, ly, lz) || 1;
    const L = (q * cl * (alpha > 0 ? -1 : 1)) / ll, D = (-q * cd) / u;
    this.addForce(lx * L + ux * D, ly * L + uy * D, lz * L + uz * D, p[0], p[1], p[2]);
  }

  // The water's height above the hull's origin level at a local point (from the nearest lattice
  // cell), as a height relative to that point's own world height: negative when the point is
  // under the water.
  localWaterHeight(lp) {
    const M = this.model;
    const p = this.toWorld(lp, _p3);
    let fa = ((lp[2] - M.lat[1]) / (M.lat[(M.NA - 1) * M.NC * 2 + 1] - M.lat[1])) * (M.NA - 1);
    fa = Math.min(M.NA - 1, Math.max(0, Math.round(fa)));
    return p[1] - this.LH[fa * M.NC + 1];
  }

  // The wind on the topsides: it blows her along and, pushing high on her, heels her a little.
  windForce() {
    const ax = this.wind[0] - this.v[0], az = this.wind[1] - this.v[2];
    const a = hypot2(ax, az);
    if (a < 0.05) return;
    const k = this.windage * this.m * a;
    const p = this.toWorld(this.windageAt, _p1);
    this.addForce(ax * k, 0, az * k, p[0], p[1], p[2]);
  }

  ropeForces(h) {
    for (const r of this.ropes) {
      const p = this.toWorld(r.p, _p1);
      const to = typeof r.to === 'function' ? r.to() : r.to;
      const dx = to[0] - p[0], dy = to[1] - p[1], dz = to[2] - p[2];
      const d = hypot3(dx, dy, dz) || 1e-6;
      const stretch = d - r.len;
      r.out.tension = 0;
      if (stretch <= 0) continue;
      this.pointVel(p, _pv);
      const tv = r.toVel ? r.toVel() : null;
      const rel = ((tv ? tv[0] : 0) - _pv[0]) * dx / d + ((tv ? tv[1] : 0) - _pv[1]) * dy / d + ((tv ? tv[2] : 0) - _pv[2]) * dz / d;
      // (A rope holds what a rope can: past a few times her weight the anchor drags or the line
      // renders through the cleat rather than pull her apart.)
      const T = Math.min(Math.max(0, r.k * stretch + r.c * rel), this.m * G * 3);
      r.out.tension = T;
      this.addForce((dx / d) * T, (dy / d) * T, (dz / d) * T, p[0], p[1], p[2]);
    }
  }

  // The seabed and the beach: a firm, springy contact with friction where any of her contact
  // points has gone into the ground.
  groundForces(env) {
    if (!env.ground) return;
    const M = this.model, m = this.m;
    const k = (m * G * 12) / 0.05 / M.contacts.length, c = 2 * Math.sqrt(k * m / M.contacts.length) * 1.1;
    let touching = 0, slide = 0, deep = 0;
    for (const lp of M.contacts) {
      const p = this.toWorld(lp, _p1);
      const g = env.ground(p[0], p[2]);
      const pen = g - p[1];
      if (pen <= 0) continue;
      touching++;
      deep = Math.max(deep, pen);
      // The ground's slope.
      const e = 0.4;
      const gx = (env.ground(p[0] + e, p[2]) - env.ground(p[0] - e, p[2])) / (2 * e);
      const gz = (env.ground(p[0], p[2] + e) - env.ground(p[0], p[2] - e)) / (2 * e);
      const nl = hypot3(gx, 1, gz);
      const nx = -gx / nl, ny = 1 / nl, nz = -gz / nl;
      this.pointVel(p, _pv);
      const vn = _pv[0] * nx + _pv[1] * ny + _pv[2] * nz;
      if (vn < -0.5) this.impact = Math.max(this.impact, -vn);
      // (The spring saturates: put down deep in the sand she's eased out, never fired out.)
      const fn = Math.max(0, k * Math.min(pen, 0.08) - c * vn);
      // Friction: wet sand, stones, weed.
      const tx = _pv[0] - vn * nx, ty = _pv[1] - vn * ny, tz = _pv[2] - vn * nz, tl = hypot3(tx, ty, tz);
      const mu = 0.45, fr = tl > 1e-4 ? (mu * fn) / Math.max(tl, 0.08) : 0;
      slide = Math.max(slide, tl);
      this.addForce(nx * fn - tx * fr, ny * fn - ty * fr, nz * fn - tz * fr, p[0], p[1], p[2]);
    }
    this.grounded = touching / M.contacts.length;
    this.scrape = touching ? slide : 0;
    // Deep in the ground (put down there, or driven up a beach): lifted out a little each step,
    // without any kick.
    if (deep > 0.05) {
      this.x[1] += Math.min(deep - 0.05, 0.02);
      if (this.v[1] < 0) this.v[1] *= 0.5;
    }
  }

  // Piers, quays and other hulls (the boat works out what's there: see boat.js).
  contactForces(env) {
    for (const lp of this.model.ring) {
      const p = this.toWorld(lp, _p1);
      const f = env.contact(this, p);
      if (!f) continue;
      this.pointVel(p, _pv);
      const vn = _pv[0] * f.nx + _pv[1] * f.ny + _pv[2] * f.nz - (f.vn || 0);
      if (vn < -0.4) this.impact = Math.max(this.impact, -vn);
      const k = f.k ?? (this.m * 120), c = f.c ?? 2 * Math.sqrt(k * this.m) * 0.25;
      // (Already parting faster than half a metre a second: the spring lets go, so hulls that find
      // themselves inside each other ease apart instead of firing off at many metres a second.)
      const fn = vn > 0.5 ? 0 : Math.max(0, k * Math.min(f.pen, 0.1) - c * vn);
      const tx = _pv[0] - vn * f.nx, ty = _pv[1] - vn * f.ny, tz = _pv[2] - vn * f.nz, tl = hypot3(tx, ty, tz);
      const fr = tl > 1e-4 ? ((f.mu ?? 0.3) * fn) / Math.max(tl, 0.1) : 0;
      this.addForce(f.nx * fn - tx * fr, f.ny * fn - ty * fr, f.nz * fn - tz * fr, p[0], p[1], p[2]);
    }
  }

  // The crew: sitting out against a heel (sailing), a standing rider balancing, and, past a
  // steep roll, everyone leaning out and easing off so she never goes over.
  crewForces() {
    const R = this.R, w = this.w;
    // Her port axis (local +x) and bow axis (local +z) in the world.
    const px = R[0], py = R[3], pz = R[6];
    const bx = R[2], by = R[5], bz = R[8];
    const roll = Math.asin(Math.max(-1, Math.min(1, py)));
    const rollRate = w[0] * bx + w[1] * by + w[2] * bz; // about the bow axis
    let tq = this.heelMoment;
    if (this.balance > 0) {
      // A rider standing on a board keeps it level under the sail.
      tq += -(roll - this.trimBias) * this.balance * this.m * G * 0.9 - rollRate * this.balance * this.m * 0.6;
    }
    const lim = this.roll0;
    if (Math.abs(roll) > lim) {
      // (As hard as a sea can roll her: her weight, or her waterplane's stiffness if a light
      // boat on a broad hull.)
      const ex = Math.abs(roll) - lim, k = Math.max(this.m, this.model.rollK / G);
      tq += -Math.sign(roll) * k * G * (2.5 * ex + 30 * ex * ex) - rollRate * k * 0.8 * Math.min(1, ex * 4);
    }
    // A torque about her bow axis: positive raises the port side.
    this.Tq[0] += bx * tq; this.Tq[1] += by * tq; this.Tq[2] += bz * tq;
    // (And pitch: never stood on her end.)
    const pitch = -Math.asin(Math.max(-1, Math.min(1, by)));
    if (this.pitchBalance > 0 && this.submerged > 0.02) {
      // A rider on a fast little hull keeps her bow from bobbing up and down (porpoising) by
      // leaning in and out with her, fore and aft, as far as a body can: in the water only (in
      // the air, leaning moves nothing).
      const pitchRate = w[0] * px + w[1] * py + w[2] * pz; // about her port axis (+: bow down)
      const lim = 80 * G * 0.35;
      const tp = this.pitchBalance * Math.max(-lim, Math.min(lim, -3 * pitchRate * this.m - 1.3 * (pitch + 0.02) * this.m * G));
      this.Tq[0] += px * tp; this.Tq[1] += py * tp; this.Tq[2] += pz * tp;
    }
    if (Math.abs(pitch) > 0.55) {
      const ex = Math.abs(pitch) - 0.55;
      const t2 = Math.sign(pitch) * this.m * G * (3 * ex + 20 * ex * ex);
      // About her port axis: positive puts the bow down.
      this.Tq[0] -= px * t2; this.Tq[1] -= py * t2; this.Tq[2] -= pz * t2;
    }
  }

  integrate(h) {
    const m = this.m, v = this.v, x = this.x, w = this.w, R = this.R, I = this.I;
    let fx = this.F[0], fz = this.F[2];
    // Her momentum under way: what drives her along her track (her bow's way, laid flat) moves
    // her less once she's moving, as if she were heavier along it. (See surgeShare.)
    if (this.surge < 1) {
      const bl = hypot2(R[2], R[8]);
      if (bl > 0.3) {
        const ux = R[2] / bl, uz = R[8] / bl;
        const vf = (v[0] - this.current[0]) * ux + (v[2] - this.current[1]) * uz;
        const k = surgeShare(this.surge, vf), al = this.Fs[0] * ux + this.Fs[2] * uz;
        fx -= (1 - k) * al * ux;
        fz -= (1 - k) * al * uz;
      }
    }
    v[0] += (fx / m) * h; v[1] += (this.F[1] / m) * h; v[2] += (fz / m) * h;
    x[0] += v[0] * h; x[1] += v[1] * h; x[2] += v[2] * h;
    // Angular: in her own frame, where the inertia is diagonal.
    const T = this.Tq;
    const tl0 = R[0] * T[0] + R[3] * T[1] + R[6] * T[2], tl1 = R[1] * T[0] + R[4] * T[1] + R[7] * T[2], tl2 = R[2] * T[0] + R[5] * T[1] + R[8] * T[2];
    let wl0 = R[0] * w[0] + R[3] * w[1] + R[6] * w[2], wl1 = R[1] * w[0] + R[4] * w[1] + R[7] * w[2], wl2 = R[2] * w[0] + R[5] * w[1] + R[8] * w[2];
    const Iw0 = I[0] * wl0, Iw1 = I[1] * wl1, Iw2 = I[2] * wl2;
    // (Euler's equations: the gyroscopic term ω × Iω.)
    const g0 = wl1 * Iw2 - wl2 * Iw1, g1 = wl2 * Iw0 - wl0 * Iw2, g2 = wl0 * Iw1 - wl1 * Iw0;
    wl0 += ((tl0 - g0) / I[0]) * h; wl1 += ((tl1 - g1) / I[1]) * h; wl2 += ((tl2 - g2) / I[2]) * h;
    // (A whisper of damping, so nothing hums forever.)
    const damp = Math.exp(-0.05 * h);
    wl0 *= damp; wl1 *= damp; wl2 *= damp;
    w[0] = R[0] * wl0 + R[1] * wl1 + R[2] * wl2;
    w[1] = R[3] * wl0 + R[4] * wl1 + R[5] * wl2;
    w[2] = R[6] * wl0 + R[7] * wl1 + R[8] * wl2;
    const q = this.q;
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    q[0] += 0.5 * h * (w[0] * qw + w[1] * qz - w[2] * qy);
    q[1] += 0.5 * h * (w[1] * qw + w[2] * qx - w[0] * qz);
    q[2] += 0.5 * h * (w[2] * qw + w[0] * qy - w[1] * qx);
    q[3] += 0.5 * h * (-w[0] * qx - w[1] * qy - w[2] * qz);
    const ql = hypot4(q[0], q[1], q[2], q[3]);
    q[0] /= ql; q[1] /= ql; q[2] /= ql; q[3] /= ql;
  }
}

// (Scratch for local points and directions built on the fly.)
const _l1 = [0, 0, 0], _l2 = [0, 0, 0], _l3 = [0, 0, 0];
const _p1 = [0, 0, 0], _p2 = [0, 0, 0], _p3 = [0, 0, 0], _pc = [0, 0, 0], _pv = [0, 0, 0];
