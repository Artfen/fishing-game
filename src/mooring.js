import { solidHeight, PIERS, inSeas } from './world/terrain.js';
import { clamp, dampAngle } from './util.js';
import { LINES, tension, stiffness } from './lines.js';

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
  return !others.some((o) => o !== b && (Math.hypot(o.pos.x - B.x, o.pos.z - B.z) < (o.hull.B + b.hull.B) * BOAT_GAP || hullsOverlap(b, B, o)));
}
// Would boat b lying at berth B overlap boat o, hull for hull (her length and beam, and o's, as o
// lies)? A clear 0.3 m all round, so a long boat isn't offered a berth whose middle is clear but
// whose bow or stern would sit inside the next boat (the hulls' contact then fires them apart).
export function hullsOverlap(b, B, o, gap = 0.3) {
  const fx = Math.sin(B.heading), fz = Math.cos(B.heading);
  const dx = o.pos.x - B.x, dz = o.pos.z - B.z;
  const along = dx * fx + dz * fz, across = dx * fz - dz * fx;
  const dh = (o.heading ?? 0) - B.heading, c = Math.abs(Math.cos(dh)), s = Math.abs(Math.sin(dh));
  const oLen = c * o.hull.L * 0.5 + s * o.hull.B, oWid = s * o.hull.L * 0.5 + c * o.hull.B;
  return Math.abs(along) < b.hull.L * 0.5 + oLen + gap && Math.abs(across) < b.hull.B + oWid + gap;
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

// One step of the towline, after both boats have moved: it only pulls (a rope can't push). It's a
// nylon line (lines.js): slack, nothing; past its length it stretches, pulling the harder the
// more it stretches and the faster it's opening, at both ends (the leader's stern cleat, the
// towed boat's bow), so it slows the leader for what she's pulling and, pulling the towed boat by
// her bow, brings her round to follow. Snatched hard enough (going ahead fast on a slack line, or
// a big boat yanked about in a sea) it parts. Returns how tight it is (0 … 1); `out`, if given,
// gets { T (N), load (T over what it holds), parted }. `strength`: what share of a new line's
// breaking load it holds (lines.js STRENGTH, by difficulty; Infinity: it never parts).
// hold (F4b): the most a hand tending it lets it take, surging it round the cleat (see lines.js
// TEND): past it the line runs out (out.slip, m) rather than pulling harder or parting.
// How far it is from the leader's stern to the towed boat's bow (m): where the towline runs.
export const towGap = (lead, towed) => {
  const s = sternOf(lead), w = bowEnd(towed);
  return Math.hypot(s.x - w.x, s.z - w.z);
};
// The line paid out when she's taken in tow (m): the usual length, or more if she's further off
// than that from your stern (taken from alongside, her bow's well forward of your stern), so the
// line starts slack, not already stretched past what it holds.
export const towLineFor = (lead, towed) => Math.max(TOW.len, towGap(lead, towed) + 0.5);

export function towStep(lead, towed, dt, len = TOW.len, out = null, strength = 1, hold = Infinity) {
  const s = sternOf(lead), w = bowEnd(towed);
  let dx = s.x - w.x, dz = s.z - w.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  dx /= d;
  dz /= d;
  const A = lead._phys, B = towed._phys;
  if (out) Object.assign(out, { T: 0, load: 0, parted: false, slip: 0 });
  if (A && B) {
    if (d > len) {
      const mL = A.m, mT = B.m, mE = (mL * mT) / (mL + mT);
      // (How fast it's opening: the leader's stern going away from the towed boat's bow.)
      const rel = (lead.vel.x - towed.vel.x) * dx + (lead.vel.z - towed.vel.z) * dz;
      let r = tension(LINES.towline, len, d, rel, mE, strength);
      // (Tended, a pull past what the tender holds runs line out round the cleat instead: held at
      // that, the stretch beyond it let go.)
      const raw = r.parted ? Infinity : r.T;
      if (raw > hold) {
        const k = stiffness(LINES.towline, len);
        const mbl = LINES.towline.mbl;
        r = { T: hold, parted: false, load: hold / Math.min(mbl * (strength > 0 ? strength : 1), mbl * 4) };
        if (out) out.slip = Math.max(0, d - len - hold / k);
      }
      if (out) Object.assign(out, r);
      if (r.parted) return 0;
      // (As an impulse this step, never more than closes what's opening plus the stretch: a stiff
      // line on a light boat would otherwise overshoot from one step to the next.)
      const J = Math.min(r.T * dt, (Math.max(0, rel) + (d - len) / dt) * mE);
      if (J > 0) {
        A.updateR();
        B.updateR();
        const ps = A.toWorld([lead.cleats[1].x, lead.cleats[1].y, lead.cleats[1].z]), pb = B.toWorld([towed.cleats[0].x, towed.cleats[0].y, towed.cleats[0].z]);
        A.applyImpulse(-dx * J, 0, -dz * J, ps[0], ps[1], ps[2]);
        B.applyImpulse(dx * J, 0, dz * J, pb[0], pb[1], pb[2]);
        lead.syncFromPhys();
        towed.syncFromPhys();
      }
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
