import { solidHeight, PIERS, inSeas } from './world/terrain.js';
import { clamp, dampAngle } from './util.js';

// Holding a boat still, three ways (the rules here; the boat does the rest, see boat.js):
//
//  · At anchor, away from the shore: the anchor goes down to the seabed from the bow and the rope
//    is paid out to two and a half times the depth. The boat drifts back on the wind and tide until
//    the rope comes tight, then lies there bow to the anchor, swinging a little, riding the waves.
//    It needs water deep enough to float in (and not run aground on the swing) and no deeper than
//    the rope is long.
//  · Tied up alongside a jetty or quay: made fast by a line at the bow and the stern, fenders
//    between, lying along the side of it. Any of the game's piers will do, where the water
//    alongside is deep enough for the hull and there's room. Casting off pushes her clear, so
//    there has to be open water beside her to go.
//  · On a towline: one boat's stern to another's bow, the second following the first.

// The anchor's rope, and how much of it goes out for a given depth (two and a half times the depth;
// in shallow water a few metres more than the depth at least).
export const ANCHOR = { rope: 30, scope: 2.5, maxDepth: 25 };
export const rodeFor = (depth) => clamp(depth * ANCHOR.scope, depth + 2.5, ANCHOR.rope);
// How far along the bottom that lets the boat lie from the anchor (a little less than the rope
// would reach pulled straight: it hangs).
export const reachFor = (depth) => Math.max(1.5, Math.sqrt(Math.max(0, rodeFor(depth) ** 2 - depth ** 2)) * 0.8);

// Where the bow is, on the water.
export const bowOf = (b, out = { x: 0, z: 0 }) => {
  out.x = b.pos.x + b.fwd.x * b.hull.L * 0.45;
  out.z = b.pos.z + b.fwd.z * b.hull.L * 0.45;
  return out;
};

// Can she anchor here? { ok, depth, x, z } (where the anchor goes down) or { ok: false, why }.
export function anchorCheck(b) {
  if (b.hull.rig) return { ok: false, why: 'A windsurf board has no anchor: tie up at a pontoon or a jetty, or step ashore.' };
  const bow = bowOf(b), depth = -solidHeight(bow.x, bow.z);
  if (b.speed > 1) return { ok: false, why: 'Slow down before dropping the anchor' };
  if (depth < b.hull.draft + 0.6) return { ok: false, why: `Too shallow to anchor here (${depth < 0.1 ? 'barely any water' : `${depth.toFixed(1)} m`}): she’d swing onto the bottom. Find a little more water, or tie up or step ashore instead.` };
  if (depth > ANCHOR.maxDepth) return { ok: false, why: `Too deep to anchor here (${Math.round(depth)} m): the anchor rope is ${ANCHOR.rope} m long. Find water under ${ANCHOR.maxDepth} m deep, nearer the shore or over a shoal.` };
  return { ok: true, depth, x: bow.x, z: bow.z };
}

/* ---------------- tying up ---------------- */

const across = (P) => (P.x1 - P.x0 >= P.z1 - P.z0 ? 'z' : 'x');
const BOAT_GAP = 1.35;

// The berth alongside pier i on a side (-1 or 1), at a point along it, for this boat: where her
// middle sits and which way she faces. (Saved as { pier, side, along, heading } and found again.)
export const sideOut = (b) => b.hull.fend ?? b.hull.B - 0.05;
export function berthAt(b, i, side, along, heading) {
  const P = PIERS[i];
  if (!P) return null;
  // (fend: how far her side lies out from her middle, against a pier, rubbing strake and all;
  // for most boats her half-beam. Then the fenders between.)
  const off = sideOut(b) + 0.2;
  return across(P) === 'z'
    ? { pier: i, side, along, heading, x: along, z: side < 0 ? P.z0 - off : P.z1 + off }
    : { pier: i, side, along, heading, x: side < 0 ? P.x0 - off : P.x1 + off, z: along };
}

// Is a berth any good: deep enough under her length, clear of other boats and of other piers?
function berthFits(b, B, others) {
  // (Her whole length, bow and stern, clear of any other pier: she can't lie with her bow under
  // the next finger.)
  const fx = Math.sin(B.heading), fz = Math.cos(B.heading), half = b.hull.L * 0.5 + 0.2;
  const n = Math.ceil(half / 0.5);
  for (let i = -n; i <= n; i++) {
    const k = i / n, x = B.x + fx * half * k, z = B.z + fz * half * k;
    if (!inSeas(x, z)) return false;
    // (Deep enough under her middle and most of her length; her very ends may hang over less.)
    if (Math.abs(k) <= 0.85 && solidHeight(x, z) > -(b.hull.draft + 0.25)) return false;
    if (PIERS.some((Q, j) => j !== B.pier && x > Q.x0 - 0.3 && x < Q.x1 + 0.3 && z > Q.z0 - 0.3 && z < Q.z1 + 0.3)) return false;
  }
  return !others.some((o) => o !== b && Math.hypot(o.pos.x - B.x, o.pos.z - B.z) < (o.hull.B + b.hull.B) * BOAT_GAP);
}

// A berth for this boat alongside the nearest pier within reach, on the side she's on, as close
// to where she is as the water allows; or null (too far, or nowhere alongside deep enough).
export function berthFor(b, others = [], { reach = 4 } = {}) {
  let best = null;
  PIERS.forEach((P, i) => {
    const ax = across(P);
    // Her distance from the pier's edge, and the side she's on.
    const qx = clamp(b.pos.x, P.x0, P.x1), qz = clamp(b.pos.z, P.z0, P.z1);
    const gap = Math.hypot(b.pos.x - qx, b.pos.z - qz);
    if (gap > reach) return;
    const side = ax === 'z' ? (b.pos.z < (P.z0 + P.z1) / 2 ? -1 : 1) : (b.pos.x < (P.x0 + P.x1) / 2 ? -1 : 1);
    // Lying along the pier, facing whichever way along it is nearer her heading.
    const h0 = ax === 'z' ? Math.PI / 2 : 0;
    const heading = Math.cos(b.heading - h0) >= 0 ? h0 : h0 + Math.PI;
    // (Her middle anywhere along it, or a little past either end: a long boat can lie with her
    // bow or stern out beyond a short landing.)
    const over = b.hull.L * 0.3;
    const lo = (ax === 'z' ? P.x0 : P.z0) + 0.3 - over, hi = (ax === 'z' ? P.x1 : P.z1) - 0.3 + over;
    const here = clamp(ax === 'z' ? b.pos.x : b.pos.z, lo, hi);
    // Look along the pier from where she is, nearest first.
    for (let k = 0; k <= 2 * (hi - lo) + 1; k++) {
      const along = here + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5;
      if (along < lo || along > hi) continue;
      const B = berthAt(b, i, side, along, heading);
      const d = Math.hypot(B.x - b.pos.x, B.z - b.pos.z);
      if (d > reach + 1.5) continue;
      if (!berthFits(b, B, others)) continue;
      // (Nearest, and lying the way she already lies: swinging a long boat right round on her
      // lines in a tight corner jams her against the next pier.)
      const turn = Math.abs(Math.atan2(Math.sin(heading - b.heading), Math.cos(heading - b.heading)));
      const cost = d + turn * b.hull.L * 0.5;
      if (!best || cost < best.cost) best = { ...B, d, cost };
      break;
    }
  });
  return best;
}

// Room to cast off: open water for her to go into, out beside her or (where it's shallow out
// there) ahead or astern along the pier; deep enough to float, and no boat or pier in the way.
// { ok, nx, nz } (the way she's pushed off) or { ok: false, why }.
export function castOffCheck(b, others = []) {
  const T = b.tie;
  if (!T) return { ok: false, why: '' };
  const P = PIERS[T.pier], ax = across(P);
  const ox = ax === 'z' ? 0 : T.side, oz = ax === 'z' ? T.side : 0;
  const fx = Math.sin(T.heading), fz = Math.cos(T.heading);
  let blocker = null;
  const clear = (pts) => pts.every(([x, z]) => {
    if (solidHeight(x, z) > -(b.hull.draft + 0.1)) return false;
    if (PIERS.some((Q) => x > Q.x0 - 0.2 && x < Q.x1 + 0.2 && z > Q.z0 - 0.2 && z < Q.z1 + 0.2)) return false;
    const o = others.find((q) => q !== b && Math.hypot(q.pos.x - x, q.pos.z - z) < (q.hull.B + b.hull.B) * 1.1);
    if (o) blocker = blocker || o;
    return !o;
  });
  const d = b.hull.B + 1.2, L = b.hull.L * 0.42;
  const out = [-1, 0, 1].map((k) => [T.x + ox * d + fx * L * k, T.z + oz * d + fz * L * k]);
  if (clear(out)) return { ok: true, nx: ox, nz: oz };
  for (const s of [1, -1]) {
    const run = [1, 2].map((k) => [T.x + fx * s * (b.hull.L * 0.5 + k), T.z + fz * s * (b.hull.L * 0.5 + k)]);
    if (clear(run)) return { ok: true, nx: fx * s, nz: fz * s };
  }
  return blocker
    ? { ok: false, why: `No room to cast off: the ${blocker.name} is lying right alongside. Move her first.` }
    : { ok: false, why: 'No room to cast off here: it’s too shallow beside her and ahead and astern. Step across into another boat, or have her brought round.' };
}

/* ---------------- towing ---------------- */

// The towline, stern to bow; and which boats can tow which (a boat can't pull one much heavier
// than itself: the kayak tows nothing, the rowing boat no more than the bass boat).
export const TOW = { len: 5.5, reach: 5 };
export const heft = (b) => b.hull.L * b.hull.B;
export function canTow(lead, towed) {
  if (!lead || !towed || lead === towed) return { ok: false, why: '' };
  if (heft(lead) < heft(towed) * 0.5) return { ok: false, why: `The ${lead.name} is too small to tow the ${towed.name}.` };
  if (towed.tie) return { ok: false, why: `The ${towed.name} is tied up: step across and cast her off first.` };
  if (towed.anchored) return { ok: false, why: `The ${towed.name}’s anchor is down: step across and raise it first.` };
  if (lead.speed > 1.2 || towed.speed > 1.2) return { ok: false, why: 'Slow down alongside her first.' };
  return { ok: true };
}

const sternOf = (b) => ({ x: b.pos.x - b.fwd.x * b.hull.L * 0.5, z: b.pos.z - b.fwd.z * b.hull.L * 0.5 });
const bowEnd = (b) => ({ x: b.pos.x + b.fwd.x * b.hull.L * 0.5, z: b.pos.z + b.fwd.z * b.hull.L * 0.5 });

// One step of the towline, after both boats have moved: it only pulls (a rope can't push). A
// tight line snatches at both ends, stern of the one and bow of the other: it stops them parting
// (the pull shared between them by their weight), slows the leader for what she's pulling, and,
// pulling the towed boat by her bow, brings her round to follow it. Returns how tight it is (0 … 1).
export function towStep(lead, towed, dt, len = TOW.len) {
  const s = sternOf(lead), w = bowEnd(towed);
  let dx = s.x - w.x, dz = s.z - w.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  dx /= d;
  dz /= d;
  const A = lead._phys, B = towed._phys;
  if (A && B) {
    if (d > len) {
      const mL = A.m, mT = B.m, wL = mT / (mL + mT), wT = mL / (mL + mT), c = d - len;
      A.x[0] -= dx * c * wL; A.x[2] -= dz * c * wL;
      B.x[0] += dx * c * wT; B.x[2] += dz * c * wT;
      const rel = (lead.vel.x - towed.vel.x) * dx + (lead.vel.z - towed.vel.z) * dz;
      if (rel > 0) {
        const J = rel / (1 / mL + 1 / mT);
        A.updateR();
        B.updateR();
        const ps = A.toWorld([lead.cleats[1].x, lead.cleats[1].y, lead.cleats[1].z]), pb = B.toWorld([towed.cleats[0].x, towed.cleats[0].y, towed.cleats[0].z]);
        A.applyImpulse(-dx * J, 0, -dz * J, ps[0], ps[1], ps[2]);
        B.applyImpulse(dx * J, 0, dz * J, pb[0], pb[1], pb[2]);
      }
      lead.syncFromPhys();
      towed.syncFromPhys();
    }
    return clamp((d - len * 0.9) / (len * 0.1), 0, 1);
  }
  // (Boats without a hull of their own to push: the line simply holds them together.)
  const mL = heft(lead), mT = heft(towed), wL = mT / (mL + mT), wT = mL / (mL + mT);
  if (d > len) {
    const c = d - len;
    towed.pos.x += dx * c * wT;
    towed.pos.z += dz * c * wT;
    lead.pos.x -= dx * c * wL;
    lead.pos.z -= dz * c * wL;
    const rel = (lead.vel.x - towed.vel.x) * dx + (lead.vel.z - towed.vel.z) * dz;
    if (rel > 0) {
      towed.vel.x += dx * rel * wT;
      towed.vel.z += dz * rel * wT;
      lead.vel.x -= dx * rel * wL;
      lead.vel.z -= dz * rel * wL;
    }
  }
  const tight = clamp((d - len * 0.9) / (len * 0.1), 0, 1);
  if (tight > 0.2) {
    towed.heading = dampAngle(towed.heading, Math.atan2(dx, dz), 1 + 2 * tight, dt);
    towed.omega = 0;
  }
  return tight;
}
