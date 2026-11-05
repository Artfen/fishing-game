// Where a sound comes from, as you hear it: the harbour's sounds placed in the world (the sea
// slapping the quay, mooring lines creaking, rigging, gulls, a boat's engine going past, talk at
// the inn's door), each heard from where you stand and the way you're facing.
//
// ear: { x, z, fx, fz }: where you are and which way you look (fx, fz: a unit vector on the
// ground, the camera's forward). A sound at (x, z) is heard with
//   vol: how loud, 0 … 1: all of it within `near` metres, falling away as near / distance, and
//        gone by `far`;
//   pan: -1 (hard left) … 1 (hard right); close in it fills both ears;
//   lp:  how bright (a lowpass, Hz): distance takes the top off it (the air soaks up the highs),
//        a wall takes off more, and a sound behind you is a touch duller than one in front.
// walls: 0 … 1, how much is in the way (1: you're indoors and it's outside, or the other way).

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

export const BRIGHT = 18000;

export function hear(ear, x, z, { near = 3, far = 60, walls = 0 } = {}) {
  const dx = x - ear.x, dz = z - ear.z, d = Math.hypot(dx, dz);
  if (!(d < far)) return { vol: 0, pan: 0, lp: 400, d };
  const vol = Math.min(1, near / Math.max(d, near)) * (1 - smooth(far * 0.55, far, d)) * (1 - 0.7 * walls);
  const ux = d > 1e-6 ? dx / d : 0, uz = d > 1e-6 ? dz / d : 0;
  // (Your right hand: the forward turned a quarter clockwise, seen from above.)
  const side = ux * -ear.fz + uz * ear.fx, front = ux * ear.fx + uz * ear.fz;
  const pan = clamp(side * smooth(0.4, near * 1.5, d) * 0.9, -0.9, 0.9);
  let lp = BRIGHT / (1 + d / 35);
  if (front < 0) lp *= 1 + 0.3 * front;
  if (walls > 0) lp = Math.min(lp, 2600 - 1900 * walls);
  return { vol, pan, lp: Math.max(300, lp), d };
}

// The ear from where you are and the camera's forward (any length; a camera looking straight down
// falls back on `heading`, the way you face).
export function earOf(x, z, fx, fz, heading = 0) {
  const n = Math.hypot(fx, fz);
  return n > 0.15 ? { x, z, fx: fx / n, fz: fz / n } : { x, z, fx: Math.sin(heading), fz: Math.cos(heading) };
}

// The nearest point on the edge of a deck or a quay (a box: x0, x1, z0, z1) to (x, z): where the
// water meets it. From on it, the nearest of its sides.
export function edgeNear(r, x, z) {
  const inside = x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  if (!inside) {
    const ex = clamp(x, r.x0, r.x1), ez = clamp(z, r.z0, r.z1);
    return { x: ex, z: ez, d: Math.hypot(x - ex, z - ez) };
  }
  const opts = [[r.x0, z, x - r.x0], [r.x1, z, r.x1 - x], [x, r.z0, z - r.z0], [x, r.z1, r.z1 - z]];
  const [ex, ez, d] = opts.reduce((a, b) => (b[2] < a[2] ? b : a));
  return { x: ex, z: ez, d };
}

// The water's edge nearest you along any of these decks (within `within` m), or null.
export function quayNear(decks, x, z, within = 45) {
  let best = null;
  for (const r of decks) {
    const e = edgeNear(r, x, z);
    if (e.d < within && (!best || e.d < best.d)) best = e;
  }
  return best;
}

// Up to n of the list nearest (x, z) within `within` m, nearest first (each { x, z, … }).
export function nearestOf(list, x, z, n, within) {
  return list
    .map((p) => ({ p, d: Math.hypot(p.x - x, p.z - z) }))
    .filter((q) => q.d < within)
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((q) => q.p);
}
