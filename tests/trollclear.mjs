// What a bow trolling motor's moving parts have to keep clear of on each boat, from her own
// geometry (used by tests/trollmount.test.mjs, and handy for trying a mount: node --import
// ./tests/setup.mjs tests/trollclear.mjs). Every check returns the things it hit, with where.
import { section, tubeCentre } from '../src/hydro.js';
import { V, rigPoints, rigPose, propAt, deckY, TrollMech } from '../src/trollmount.js';

const hw = (H, t) => H.B * H.hw(t);
const sheer = (H, t) => H.D + H.sheer(t);
const zAt = (H, t) => -H.L / 2 + H.L * t;
const tOf = (H, z) => (z + H.L / 2) / H.L;

// The hull's half-width at height y, at t (null above her gunwale or below her keel).
function halfWidthAt(H, t, y) {
  const w = hw(H, t), s = sheer(H, t), k = H.keel(t);
  if (y > s || y < k) return null;
  let lo = 0, hi = Math.PI / 2;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (section(H, w, s, k, m)[1] < y) lo = m;
    else hi = m;
  }
  return Math.abs(section(H, w, s, k, (lo + hi) / 2)[0]);
}
const segDist = (p, a, b) => {
  const e = V.sub(b, a), l2 = V.dot(e, e) || 1e-12;
  const u = Math.max(0, Math.min(1, V.dot(V.sub(p, a), e) / l2));
  return V.len(V.sub(p, V.add(a, V.mul(e, u))));
};
const lineDist = (p, pts) => {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, segDist(p, pts[i], pts[i + 1]));
  return best;
};

// The things on each boat, as segments (with a radius) and boxes, built the way boat.js builds
// them. b: a Boat (for her cleats and fairlead).
export function obstacles(b, M) {
  const H = b.hull, segs = [], boxes = [];
  // The bow cleat and the anchor's fairlead.
  segs.push({ a: b.cleats[0].toArray(), b: b.cleats[0].toArray(), r: 0.06, what: 'bow cleat' });
  segs.push({ a: b.fairlead.toArray(), b: b.fairlead.toArray(), r: 0.07, what: 'anchor fairlead' });
  if (H.tubes) {
    const T = H.tubes, r = T.r, nose = tubeCentre(H, T.t1, 1);
    const tip = [0, nose[1] + r * 0.35, zAt(H, 1) + r * 0.55];
    const line = [];
    for (let t = 0.3; t <= T.t1 + 1e-6; t += 0.02) line.push(tubeCentre(H, t, -1));
    line.push(tip);
    for (let t = T.t1; t >= 0.3 - 1e-6; t -= 0.02) line.push(tubeCentre(H, t, 1));
    for (let i = 0; i + 1 < line.length; i++) segs.push({ a: line[i], b: line[i + 1], r, what: 'tube' });
    segs.push({ a: [0, tip[1] - r * 0.4, tip[2] + 0.02], b: [0, tip[1] - r * 0.4, tip[2] + 0.02], r: 0.06, what: 'towing eye' });
    // The bow locker seat.
    const y0 = H.floorY, bz0 = zAt(H, 0.66), bz1 = zAt(H, 0.76), bw = Math.min(hw(H, 0.66), hw(H, 0.76)) * 1.25;
    boxes.push({ min: [-bw / 2, y0, bz0], max: [bw / 2, y0 + 0.475, bz1], what: 'bow locker seat' });
  }
  if (H.rails) {
    const h = 0.55;
    for (const sd of [1, -1]) {
      const pts = H.rails.map((t) => [sd * (hw(H, t) - 0.05), sheer(H, t) + h, zAt(H, t)]);
      pts.push([sd * 0.12, sheer(H, 0.99) + h, zAt(H, 0.985)]);
      for (const p of pts.slice(0, -1)) segs.push({ a: [p[0], p[1] - h, p[2]], b: p, r: 0.02, what: 'rail stanchion' });
      for (let i = 0; i + 1 < pts.length; i++) {
        // (The trolling-motor rail: open in its starboard forward bay.)
        if (M?.railGap && sd === 1 && i === pts.length - 2) continue;
        segs.push({ a: pts[i], b: pts[i + 1], r: 0.02, what: 'bow rail' });
      }
    }
    segs.push({ a: [0, sheer(H, 0.995), zAt(H, 0.99)], b: [0, sheer(H, 0.995) + h, zAt(H, 0.99)], r: 0.02, what: 'bow rail post' });
  }
  if (H.cabin) {
    const [t0, t1] = H.cabin, top = sheer(H, t0) - 0.12 + (H.cabinH || 1.05) + 0.06;
    boxes.push({ cabin: true, t0, t1, top, what: 'cabin' });
  }
  if (H.wheelhouse) {
    // The cabin boat's foredeck: her samson post and a cleat either side (boat.js buildWheelhouse).
    const t = 0.925, y = sheer(H, t), z = zAt(H, t);
    boxes.push({ min: [-0.045, y - 0.02, z - 0.045], max: [0.045, y + 0.22, z + 0.045], what: 'samson post' });
    for (const sd of [1, -1]) {
      const tc = 0.895, x = sd * (hw(H, tc) - 0.1), yc = sheer(H, tc), zc = zAt(H, tc);
      boxes.push({ min: [x - 0.02, yc, zc - 0.11], max: [x + 0.02, yc + 0.07, zc + 0.11], what: 'foredeck cleat' });
    }
  }
  if (H.pedestals) {
    const z = zAt(H, 0.78);
    boxes.push({ min: [-0.21, sheer(H, 0.78) - 0.07, z - 0.24], max: [0.21, H.seatY + 0.34, z + 0.2], what: 'casting-deck seat' });
  }
  return { segs, boxes };
}

// Everything the motor's moving parts hit in one pose.
export function hits(b, M, P, O = obstacles(b, M)) {
  const H = b.hull, out = [];
  for (const q of rigPoints(M, P)) {
    const [x, y, z] = q.p, t = tOf(H, z);
    // Her hull: its side (a shell, below the gunwale), and inside it, her deck or floor (nothing
    // may be below it); above the gunwale, open air.
    if (t >= 0 && t <= 1) {
      const w = halfWidthAt(H, t, y), ax = Math.abs(x);
      if (w != null && ax < w + q.r && ax > w - 0.03 - q.r) out.push({ what: 'hull', part: q.part, p: q.p });
      else if (w != null && ax <= w - 0.03 - q.r && y - q.r < deckY(H, z)) out.push({ what: 'deck', part: q.part, p: q.p });
      // (Just over the gunwale, inside her: still above the deck.)
      if (w == null && y > H.keel(t) && ax < hw(H, t) && y - q.r < deckY(H, z) + 0.01) out.push({ what: 'deck', part: q.part, p: q.p });
    }
    for (const s of O.segs) if (segDist(q.p, s.a, s.b) < s.r + q.r + 0.005) out.push({ what: s.what, part: q.part, p: q.p });
    for (const B of O.boxes) {
      if (B.cabin) {
        if (t >= B.t0 && t <= B.t1 && Math.abs(x) < hw(H, t) * 0.86 + q.r && y < B.top + q.r) out.push({ what: B.what, part: q.part, p: q.p });
      } else if (x > B.min[0] - q.r && x < B.max[0] + q.r && y > B.min[1] - q.r && y < B.max[1] + q.r && z > B.min[2] - q.r && z < B.max[2] + q.r) out.push({ what: B.what, part: q.part, p: q.p });
    }
  }
  return out;
}

// Run the motor down and back up, frame by frame, and check every frame: what it hit, the biggest
// jump any part made between frames, and the poses at the two ends. how: the mech's kind.
export function sweep(b, M, how = 'manual', { reverseAt = null } = {}) {
  const mech = new TrollMech(how, M), O = obstacles(b, M);
  const frames = [];
  const look = () => {
    const P = rigPose(M, mech.v, mech.angle(), 0);
    frames.push({ P, v: { ...mech.v }, pts: rigPoints(M, P).map((q) => q.p), hits: hits(b, M, P, O), ready: mech.ready });
  };
  look();
  mech.deploy(true);
  for (let i = 0; i < 30 * 20 && !(mech.ready && !mech.moving); i++) {
    mech.step(1 / 30);
    look();
    if (reverseAt != null && i === Math.round(reverseAt * 30)) mech.deploy(false);
    if (reverseAt != null && !mech.want && mech.stowed) break;
  }
  const down = frames.at(-1);
  if (reverseAt == null) {
    mech.deploy(false);
    for (let i = 0; i < 30 * 20 && !mech.stowed; i++) {
      mech.step(1 / 30);
      look();
    }
  }
  let jump = 0;
  for (let i = 1; i < frames.length; i++) frames[i].pts.forEach((p, j) => { jump = Math.max(jump, V.len(V.sub(p, frames[i - 1].pts[j]))); });
  return { frames, down, up: frames.at(-1), jump, hit: frames.flatMap((f) => f.hits) };
}

// A summary, run directly: each boat's mount, what (if anything) it hits, and where it ends up.
if (process.argv[1]?.endsWith('trollclear.mjs')) {
  const THREE = await import('three');
  const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
  const { Boat, floatDraft } = await import('../src/boat.js');
  const { mountFor, MOUNT_SPECS } = await import('../src/trollmount.js');
  const scene = new THREE.Scene();
  for (const kind of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MOUNT_SPECS)) {
    const b = new Boat(scene, { kind });
    const M = mountFor(kind, b.hull, floatDraft(b.hull));
    const r = sweep(b, M);
    const P = r.down.P, prop = propAt(P);
    const kinds = {};
    for (const h of r.hit) kinds[`${h.what}/${h.part}`] = (kinds[`${h.what}/${h.part}`] || 0) + 1;
    const f = (a) => a.map((n) => n.toFixed(2)).join(',');
    console.log(`${kind}: hinge ${f(M.hinge)} base y ${M.base.y.toFixed(2)} water ${M.water.toFixed(2)} | stowed head ${f(r.frames[0].P.head)} low ${f(r.frames[0].P.low)} | down: vertical ${(P.d[1]).toFixed(4)} prop ${f(prop)} (${(M.water - prop[1]).toFixed(2)} under) | jump ${r.jump.toFixed(3)} | hits ${JSON.stringify(kinds)}`);
    const first = r.hit[0];
    if (first) console.log('   first hit', first.what, first.part, f(first.p));
  }
}
