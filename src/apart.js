// Boats kept from sitting inside each other (the physics' own contacts keep them from hitting
// hard; this is the last word, so two hulls never end up overlapped): each pair nearer than their
// beams allow is pushed apart half each, and neither keeps any speed towards the other.
//
// Only a pair whose distance is a real number is touched. A boat whose position has gone wrong
// (not a number) is left alone here: before, every comparison with it failed both tests that let a
// pair be, so the push itself was "not a number" and every boat it was compared with, anywhere,
// went the same way in that frame (found playing the brief's Part J day through:
// docs/PLAYTHROUGH.md).
export const APART_K = 1.35; // the gap kept, as a multiple of their two beams

export function keepApart(all) {
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const A = all[i], B = all[j], a = A.pos, b = B.pos;
      const gap = (A.hull.B + B.hull.B) * APART_K;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (!(d < gap) || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d, push = (gap - d) / 2;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
      for (const [v, s] of [[A.vel, -1], [B.vel, 1]]) {
        const vn = (v.x * nx + v.z * nz) * s;
        if (vn < 0) { v.x -= nx * vn * s; v.z -= nz * vn * s; }
      }
    }
  }
}

// A boat whose position or heading has stopped being a number (whatever did it: it shouldn't
// happen, and nothing found so far does it) is put back where she last was, stopped, rather than
// left nowhere for every frame after to trip over. Call each frame after everything that moves
// boats; lost(b, at) does the putting back (at: { x, z, h } where she last was, or null if she
// never was anywhere).
export function keepFinite(all, lost) {
  for (const b of all) {
    const p = b.pos;
    if (Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(b.heading)) {
      const g = (b._lastGood ||= { x: 0, z: 0, h: 0 });
      g.x = p.x;
      g.z = p.z;
      g.h = b.heading;
      continue;
    }
    lost(b, b._lastGood || null);
  }
}

// (J1c) Your boats eased clear of boats that don't give way: a friend's, drawn where their game
// says. Found playing the day through: two friends starting in their rowing boats at the same spot
// put a friend's row right on top of yours; her hull, inside the other's, was pushed out from its
// centreline by each point of it, back and forth as they crossed it, until she was flung off and
// lost. Now all of a hull deep inside another goes out the one way (boat.js touch), so the two
// part with a push; and a friend's, which can't give, yours slides clear of gently, here.
//
// It starts when they're closer than their two half-beams, middle to middle: well inside each
// other (boats lying side by side at a pontoon are further apart than that, see main.js
// freeOwnBerth, and are left be). Yours then slides out until no part of either hull is inside the
// other, in under half a second, the shortest way (along the line between them, or square out from
// either side of hers), and loses her speed towards the other; theirs isn't moved, being where
// their game says. While she slides the two don't touch (Boat.nearby: clearOf), or the contacts
// would kick her the rest of the way out and spin her. One tied up is left be, rather than
// strained against her lines.
export const CLEAR_K = 1; // where it starts: middle to middle, as a multiple of their two half-beams
export const CLEAR_RATE = 8; // how quickly she slides out, per second
const CLEAR_MAX = 10; // m: no further than this, however they lie
const CLEAR_SKIN = 0.05; // m: and this far clear, so her contacts don't touch her straight away
const CLEAR_TOP = 0.1; // m: middle to middle, closer than this is right on top
const NONE = [];

// The half-beam of hull H at t (0 stern … 1 bow), as boat.js draws her.
const halfAt = (H, t) => (H.hw ? H.B * H.hw(t) : H.B);
// Is any of A's outline (both sides and her middle, stern to bow), were she lying at (x, z), inside
// B's hull, as each lies on the water?
function inside(A, x, z, B) {
  const H = A.hull, G = B.hull, L = H.L || 2 * H.B, M = G.L || 2 * G.B;
  const ha = A.heading || 0, hb = B.heading || 0;
  const fa = [Math.sin(ha), Math.cos(ha)], ra = [Math.cos(ha), -Math.sin(ha)];
  const fb = [Math.sin(hb), Math.cos(hb)], rb = [Math.cos(hb), -Math.sin(hb)];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, along = -L / 2 + L * t, w = halfAt(H, t);
    for (const across of [-w, 0, w]) {
      const px = x + fa[0] * along + ra[0] * across - B.pos.x, pz = z + fa[1] * along + ra[1] * across - B.pos.z;
      const bz = px * fb[0] + pz * fb[1], bx = px * rb[0] + pz * rb[1];
      const u = (bz + M / 2) / M;
      if (u > 0 && u < 1 && Math.abs(bx) < halfAt(G, u) + CLEAR_SKIN) return true;
    }
  }
  return false;
}
// Do A (lying at x, z) and B overlap, either's outline inside the other?
const overlapping = (A, x, z, B) => {
  if (inside(A, x, z, B)) return true;
  const P = A.pos, px = P.x, pz = P.z;
  P.x = x; P.z = z;
  const r = inside(B, B.pos.x, B.pos.z, A);
  P.x = px; P.z = pz;
  return r;
};

export function keepClear(mine, fixed = NONE, dt = 1 / 60) {
  const k = 1 - Math.exp(-CLEAR_RATE * dt);
  for (const A of mine) {
    // (Clear of one that's gone, or never had one: touching again as ever.)
    if (A.clearOf && !fixed.includes(A.clearOf)) A.clearOf = null;
    if (A.tie || (A.group && !A.group.visible)) {
      A.clearOf = null;
      continue;
    }
    for (const F of fixed) {
      if (A === F) continue;
      const a = A.pos, b = F.pos;
      const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz);
      if (!Number.isFinite(d)) continue;
      if (A.clearOf !== F) {
        if (!(d < (A.hull.B + F.hull.B) * CLEAR_K)) continue;
        A.clearOf = F;
      }
      // (Which way out: along the line between them, or square out from either side of hers,
      // whichever is shortest. Right on top, any way at all, and only that: not one fixed way, or
      // the friend's game, seeing theirs on top of yours, would send theirs the same way, and the
      // two would go on together. Word of where theirs is comes to the centimetre, so within a
      // tenth of a metre even which side is which may differ between the two games.)
      const ways = (A._ways ||= [0, 0, 0, 0, 0, 0]), hb = F.heading || 0;
      let n = 6;
      if (d > CLEAR_TOP) {
        ways[0] = dx / d; ways[1] = dz / d;
        ways[2] = Math.cos(hb); ways[3] = -Math.sin(hb);
        ways[4] = -ways[2]; ways[5] = -ways[3];
      } else {
        const r = Math.random() * Math.PI * 2;
        ways[0] = Math.cos(r); ways[1] = Math.sin(r);
        n = 2;
      }
      let best = Infinity, nx = 0, nz = 0;
      for (let w = 0; w < n; w += 2) {
        const ux = ways[w], uz = ways[w + 1];
        let s = 0;
        while (s < best && s < CLEAR_MAX && overlapping(A, a.x + ux * s, a.z + uz * s, F)) s += 0.1;
        if (s < best) { best = s; nx = ux; nz = uz; }
      }
      if (best === 0) {
        // (Clear of her: done.)
        A.clearOf = null;
        continue;
      }
      const step = best < 0.02 ? best : best * k;
      const mx = nx * step, mz = nz * step;
      // (A boat's body moves with her: see Boat.shift.)
      if (A.shift) A.shift(mx, mz);
      else { a.x += mx; a.z += mz; }
      const vn = A.vel.x * nx + A.vel.z * nz;
      if (vn < 0) {
        A.vel.x -= vn * nx;
        A.vel.z -= vn * nz;
      }
    }
  }
}
