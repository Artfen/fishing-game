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
