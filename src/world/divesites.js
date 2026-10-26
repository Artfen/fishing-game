import { heightAt, WRECK, DIVE_MARKS, PLACES } from './terrain.js';
import { fbm, seeded, clamp } from '../util.js';

// The dive sites of the home coast: five places worth going down at, each different, each with a
// landmark you can find and life at the depths you can reach (what they look like is built in
// divesiteWorld.js; the fish of their own are hosted homes, see habitat.js and ecosystem.js).
//
//  · Skerries Reef, a shallow reef (3 to 9 m): boulders and gullies under the black rocks, an arch
//    to swim through, wrasse and pollack, an octopus in the cracks, jewel anemones and urchins.
//  · The Kelp Forest, off Gannet Isle's west shore (5 to 10 m): tall kelp standing like trees, the
//    light coming down green between them; pollack in the stalks, cuttlefish and bream on the
//    floor, and a big boulder in a clearing with a lost lobster pot against it.
//  · The Kittiwake, the wooden drifter on the reef off Shell Strand (9 to 10 m): her ribs and
//    boiler grown over with anemones, a conger in her hull, pollack and bogue over her.
//  · Anchor Sands, south of Long Shoal (17 m): open sand, rippled and quiet, where an old
//    Admiralty anchor lies with its chain; flatfish lie in the sand all round, gurnards walk it.
//  · The Hound, offshore beyond Gannet Light: a rock pinnacle standing from the seabed at thirty
//    metres to ten under the surface, at the foot of the Gannet Drop. Pink sea fans and jewel
//    anemones on its walls, dead man's fingers and plumose anemones on its ledges, kelp on its
//    top; pollack hanging off it right down, conger and red porgy at its foot, mackerel over it.
//    The tide runs hard over it: dive it at slack water.
//
// Each has a yellow buoy over it (a special mark: yellow, with a yellow cross on top), except the
// Kittiwake, which has her own black and red one.

const M = DIVE_MARKS;
const place = (id) => PLACES.find((p) => p.id === id);
export const DIVE_SITES = [
  {
    id: 'reef', x: M.reef.x, z: M.reef.z, r: 26, buoy: M.reef.buoy, depth: [3, 9],
    first: 'Skerries Reef: boulders and gullies under the black rocks, kelp on their tops, and somewhere among them a rock arch to swim through. Look in the cracks: there’s an octopus about.',
  },
  {
    id: 'kelp', x: M.kelp.x, z: M.kelp.z, r: 30, buoy: M.kelp.buoy, depth: [4, 10],
    first: 'The Kelp Forest: the stalks stand round you like trees, the light coming down green between them, pollack hanging among them. Somewhere in here there’s a clearing with a big boulder in it.',
  },
  {
    id: 'wreck', x: WRECK.x, z: WRECK.z, r: 22, buoy: null, depth: [8, 10],
    first: 'The Kittiwake: her ribs and boiler grown over with anemones, a conger in her hull, pollack and bogue hanging over her. Her bell lies in the sand by her bow.',
  },
  {
    id: 'sands', x: M.sands.x, z: M.sands.z, r: 28, buoy: M.sands.buoy, depth: [16, 18],
    first: 'Anchor Sands: open sand, rippled by the tide, and it looks empty until you look closely. The flatfish lie half buried, only their eyes showing. The old anchor is here somewhere.',
  },
  {
    id: 'hound', x: M.hound.x, z: M.hound.z, r: 40, buoy: M.hound.buoy, depth: [10, 30],
    first: 'The Hound: the pinnacle rises out of the blue, its walls covered in pink sea fans and jewel anemones, pollack hanging off it all the way down. Watch your air: it’s thirty metres at its foot.',
  },
].map((S) => ({ ...S, name: place(S.id).name, sub: place(S.id).sub, note: place(S.id).note }));
export const siteById = Object.fromEntries(DIVE_SITES.map((s) => [s.id, s]));

// The dive site at a point, if any.
export function siteAt(x, z, pad = 0) {
  for (const s of DIVE_SITES) if (Math.hypot(x - s.x, z - s.z) < s.r + pad) return s;
  return null;
}

/* ---------------- the Hound: its shape ---------------- */

// Two stacks of rock: the Hound itself, and its Pup a stone's throw to the south-east. Each is
// a tapering tower, its walls broken by ledges and cracks: radius(h, a) is how far its wall
// stands from its axis at height h above the seabed, the way a; top, the height of its crown.
export const PINNACLES = [
  { id: 'hound', x: -196, z: 744, top: 20.4, base: 15, crown: 4.2, seed: 3.1 },
  { id: 'pup', x: -172, z: 766, top: 10.5, base: 8, crown: 2.6, seed: 8.7 },
];
for (const P of PINNACLES) P.bed = heightAt(P.x, P.z);
const LEDGES = [0.3, 0.62];
export function pinnacleRadius(P, h, a) {
  const k = clamp(h / P.top, 0, 1);
  let r = P.crown + (P.base - P.crown) * Math.pow(1 - k, 1.35);
  // Ledges: the wall steps out a little under each.
  for (const L of LEDGES) r += 0.9 * Math.max(0, 1 - Math.abs(k - L + 0.04) / 0.07) * (P.base / 15);
  const c = Math.cos(a), s = Math.sin(a);
  const n = fbm(c * 1.7 + h * 0.09 + P.seed, s * 1.7 - h * 0.06 + P.seed, 3);
  const crack = fbm(c * 4.2 + P.seed * 2, s * 4.2 + h * 0.05, 2);
  // (Bedded rock: little steps and overhangs every couple of metres up the wall.)
  const strata = 0.28 * Math.sin(h * 2.6 + n * 4 + P.seed) * (P.base / 15);
  return Math.max(0.6, r * (1 + 0.3 * n) + strata - Math.max(0, crack - 0.25) * 2.4);
}
// The crown's height over its axis: a rounded top, higher in the middle.
export const crownAt = (P, d, a) => P.top + 0.9 * (1 - clamp(d / pinnacleRadius(P, P.top, a), 0, 1) ** 2) + fbm(Math.cos(a) * 3 + P.seed, Math.sin(a) * 3, 2) * 0.35;

/* ---------------- solid rock: keeping a diver out of it ---------------- */

// The arch on Skerries Reef and the boulders round the sites: rocks as spheres (what the world
// draws is built from these). Each: { x, y, z, r }.
export const ROCKS = (() => {
  const rnd = seeded(20261026);
  const out = [];
  const bed = (x, z) => heightAt(x, z);
  // The arch: two piers of piled rock and a long one laid across them, a gap you can swim
  // through under it (three metres wide, two and a half high).
  const A = siteById.reef, ax = A.x, az = A.z, yaw = 0.7;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (u, v) => ({ x: ax + u * c + v * s, z: az - u * s + v * c });
  for (const side of [-1, 1]) {
    const p = at(side * 2.9, 0), b = bed(p.x, p.z);
    out.push({ x: p.x, y: b + 0.9, z: p.z, r: 1.5, arch: true });
    out.push({ x: p.x + side * 0.2, y: b + 2.3, z: p.z + 0.15, r: 1.2, arch: true });
    out.push({ x: p.x - side * 0.1, y: b + 3.3, z: p.z - 0.1, r: 1.05, arch: true });
  }
  {
    const b = bed(ax, az);
    for (const u of [-2.2, -0.75, 0.75, 2.2]) {
      const p = at(u, 0);
      out.push({ x: p.x, y: b + 3.9 + (Math.abs(u) > 1 ? -0.1 : 0.15), z: p.z, r: 0.95, arch: true, lintel: true });
    }
  }
  // Boulders round the reef, the kelp forest's clearing and the foot of the Hound.
  const scatter = (S, n, r0, r1, inner = 0) => {
    for (let i = 0, k = 0; i < n * 6 && k < n; i++) {
      const a = rnd() * Math.PI * 2, d = inner + Math.sqrt(rnd()) * (S.r - inner);
      const x = S.x + Math.cos(a) * d, z = S.z + Math.sin(a) * d;
      const depth = -bed(x, z);
      if (depth < 1.6) continue;
      const r = r0 + rnd() * rnd() * (r1 - r0);
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r * 0.6)) continue;
      out.push({ x, y: bed(x, z) + r * 0.25, z, r: Math.min(r, depth * 0.45) });
      k++;
    }
  };
  scatter(A, 46, 0.7, 2.6, 4.5);
  const K = siteById.kelp;
  {
    // The clearing's boulder, and a few more under the kelp.
    const b = bed(K.x + 4, K.z + 6);
    out.push({ x: K.x + 4, y: b + 1.1, z: K.z + 6, r: 2.3, mare: true });
    scatter(K, 46, 0.5, 1.7, 6);
  }
  const H = siteById.hound;
  scatter({ ...H, r: 30 }, 40, 0.8, 2.8, 15);
  return out;
})();

// (All of it lies in here.)
const BOX = (() => {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const o of [...ROCKS, ...PINNACLES.map((P) => ({ x: P.x, z: P.z, r: P.base * 1.6 }))]) {
    b.x0 = Math.min(b.x0, o.x - o.r - 2);
    b.x1 = Math.max(b.x1, o.x + o.r + 2);
    b.z0 = Math.min(b.z0, o.z - o.r - 2);
    b.z1 = Math.max(b.z1, o.z + o.r + 2);
  }
  return b;
})();
// Push a point out of the rock: the boulders and the arch's stones, the Hound and its Pup.
// p: { x, y, z } (changed in place); pad: how far to keep from it. Returns true if it moved.
export function pushOut(p, pad = 0.4) {
  let moved = false;
  if (p.x < BOX.x0 || p.x > BOX.x1 || p.z < BOX.z0 || p.z > BOX.z1) return false;
  for (const P of PINNACLES) {
    const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz);
    if (d > P.base * 1.6 + pad) continue;
    const h = p.y - P.bed, a = Math.atan2(dz, dx);
    if (h > P.top + 1.4 + pad || h < -1) continue;
    const top = crownAt(P, d, a);
    const R = pinnacleRadius(P, Math.min(h, P.top), a);
    if (d >= R + pad || h >= top + pad) continue;
    // Out the nearest way: up onto its crown, or out from its wall.
    if (top + pad - h < R + pad - d) p.y = P.bed + top + pad;
    else {
      p.x = P.x + Math.cos(a) * (R + pad);
      p.z = P.z + Math.sin(a) * (R + pad);
    }
    moved = true;
  }
  for (const o of ROCKS) {
    const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
    const R = o.r * 0.92 + pad;
    if (Math.abs(dx) > R || Math.abs(dz) > R || Math.abs(dy) > R) continue;
    const d = Math.hypot(dx, dy, dz);
    if (d >= R) continue;
    const k = R / Math.max(d, 1e-3);
    p.x = o.x + dx * k;
    p.y = o.y + dy * k;
    p.z = o.z + dz * k;
    moved = true;
  }
  return moved;
}
// The top of anything solid at (x, z) above the seabed (for a sounder looking down): the Hound's
// crown, or null.
export function rockTopAt(x, z) {
  for (const P of PINNACLES) {
    const d = Math.hypot(x - P.x, z - P.z);
    if (d > P.base + 3) continue;
    const a = Math.atan2(z - P.z, x - P.x);
    // (The widest the wall gets at this distance: the highest point on it there.)
    let h = null;
    for (let y = P.top; y >= 0; y -= 0.5) {
      if (pinnacleRadius(P, y, a) >= d) {
        h = y >= P.top ? crownAt(P, d, a) : y;
        break;
      }
    }
    if (h != null) return P.bed + h;
  }
  return null;
}
