import { clamp, lerp, smoothstep, fbm } from '../util.js';
import { $t } from '../i18n.js';

// The north: the Selkie Isles, a cold-water archipelago up the coast from Willow Bay (invented, not
// a real place; docs/NORTH.md). In the same world as home: out of the bay to the west, past Heron
// Point and the Calf, round the Ness, and north up the mainland's west coast under the fells,
// about nine kilometres by sea.
//
//  · The Ness: the mainland's south-west corner, a high headland where the south coast meets the
//    west coast. The swell comes in from the west round it.
//  · The west coast: cliffs and coves under the fells, Hoarfell inland, nothing else for miles.
//  · Raven Isle: the big island, high, with grey cliffs on its Atlantic west and grass and heather
//    down to the sound on its east, where Halvig, a hamlet with a stone pier, faces the mainland.
//  · Raven Sound between them, sheltered, and the Churn at its north end, a tide race off the
//    mainland's point.
//  · Tern Isle: low and sandy, white shell sand on its east, to the south-west of Raven Isle.
//  · The Selkie Rocks: low skerries in the approach, where the seals haul out.
//  · Skarv Stack: a stack off Raven Isle's north-west, white with seabirds.
//  · Loch Skarn: a sea loch running east into the mainland under the fells, steep-sided, over a
//    sill at its mouth and deep inside; Bothy Bay on its north shore, the best anchorage.
//
// The wind and swell come off the Atlantic from the west and south-west, so the west sides of
// everything are the weather side (cliffs, broken water) and the east sides the lee.
//
// North is -z. Home's land runs on west and north without end (terrain.js coastZ): the north takes
// it as it is and gives it a west coast, a loch and islands. Inside what home draws (west to x
// -1800, north to z -2200) nothing changes; beyond it, the land is the north's.

/* ---------------- where it is ---------------- */

// The north's own land and sea begin beyond what home draws (world.js FAR_RECT): west of NORTH_EDGE.x
// or north of NORTH_EDGE.z. (East of EAST, north of home, the land stays as the far hills drawn on
// the horizon always were: nobody goes there.)
export const NORTH_EDGE = { x: -1800, z: -2200 };
export const NORTH_EAST = -360;
// Everything the north draws and shades: the coast north and the isles.
export const NORTH_RECT = { x0: -4680, x1: NORTH_EAST, z0: -7960, z1: 1400 };
export const NORTH_WATER = { x: NORTH_RECT.x0, z: NORTH_RECT.z0, w: NORTH_RECT.x1 - NORTH_RECT.x0, h: NORTH_RECT.z1 - NORTH_RECT.z0 };
// The isles in finer water (the water's detail map, over the coarse one of the whole north).
export const ISLES_WATER = { x: -4400, z: -7400, w: 2700, h: 2900 };
// The charts: the coast north, printed (all of it there from the start, as a bought chart would
// be: map.js draws it coarser, from the heights themselves), and the isles and Loch Skarn,
// explored as you go.
// (Its size a whole number of its grid's cells and its pixels.)
export const COAST_SHEET = { x: -4704, z: -8016, w: 4704, h: 9408, px: 12, grid: 24 };
export const ISLES_MAP = { x: -4300, z: -7400, w: 3700, h: 2900, px: 5 };

// Where the north's own land and sea are (elsewhere, home's).
export const northLand = (x, z) => x < NORTH_EDGE.x || (z < NORTH_EDGE.z && x < NORTH_EAST);
// The north as a region (its water map, its sea's fields, its chart, its edges): its own land and
// sea, and the sea along the south coast west of the Calf (x -850), where the north's water map
// takes over from home's (both cover it, so the change never shows).
export const inNorth = (x, z) => z < NORTH_RECT.z1 && (northLand(x, z) || (x < -850 && z > -40));
// Which of the game's seas a point is in.
export const regionOf = (x, z, southZ) => (z > southZ ? 'south' : inNorth(x, z) ? 'north' : 'home');

/* ---------------- the shapes ---------------- */

// The Ness: the corner headland, reaching south from where the coasts meet.
export const NESS = { x0: -2200, z0: 20, x1: -2300, z1: 420, r: 95 };
// The Churn: the mainland's point at the north end of Raven Sound, and the race off it.
export const CHURN = { x: -2620, z: -7020, r: 120 };
export const RAVEN = { id: 'raven', x: -3250, z: -6350, rx: 460, rz: 700, yaw: 0.12, h: 190 };
export const TERN = { id: 'tern', x: -3760, z: -5260, rx: 400, rz: 250, yaw: 0.45, h: 13 };
export const ISLES = [RAVEN, TERN];
export const SKARV = { x: -3950, z: -7060, r: 30, h: 62 };
export const SELKIE = [
  { x: -3020, z: -4880, r: 22, h: 3 }, { x: -3075, z: -4925, r: 14, h: 2.2 }, { x: -2985, z: -4940, r: 11, h: 1.8 },
  { x: -3110, z: -4860, r: 9, h: 1.5 }, { x: -3050, z: -4990, r: 16, h: 2.6 },
];
// Loch Skarn: from its mouth on the west coast in under the fells to its head, x, z and half-width.
export const LOCH = [[-2330, -5520, 92], [-1950, -5600, 135], [-1480, -5570, 150], [-1060, -5720, 128], [-720, -5860, 70]];
export const LOCH_SILL = { x: -2250, z: -5536, top: -15 };
export const BOTHY_BAY = { x: -1500, z: -5735, r: 85 };
// Halvig's bay on Raven Isle's east shore (the hamlet and its pier: N3).
export const HALVIG = { x: -2795, z: -6170, r: 79 };

/* ---------------- the way there (N5) ---------------- */

// The passage up the coast: from the bay's mouth west past the Calf, round the Ness and north to
// Raven Sound, about nine kilometres (the route in tests/north.test.mjs); and where a boat comes in,
// in the sound off Halvig's pier, her bow to it.
export const NORTH_M = 9400;
export const NORTH_LANDFALL = { x: -2790, z: -6150, heading: -Math.PI / 2 };
// Water to set out on the passage from: up the coast (anywhere in the north's sea), or out of
// Willow Bay west of the Calf, where the way north begins.
export const northWaters = (x, z) => inNorth(x, z) || (x < -600 && z > -40 && z < 1400);

/* ---------------- what's on them (N3) ---------------- */

// Halvig: a hamlet on Raven Isle's east shore, on a shelf of level ground above its bay, a stone
// pier running out into the bay (eight to ten metres alongside its head), the fuel pump at its
// root, the shop, three crofts and a red phone box. (yaw: the way a front faces; 0 = +z.)
export const HALVIG_SHELF = { x0: -2904, x1: -2873, z0: -6240, z1: -6100, level: 2.6 };
export const HALVIG_PIER = { x0: -2876, x1: -2832, z0: -6176, z1: -6167, deck: 2.4, land: { x: -2882, z: -6171.5 } };
export const HALVIG_FUEL = { x: -2875.5, z: -6168.2, yaw: Math.PI, name: $t('the fuel pump on Halvig pier'), deck: 2.4 };
export const HALVIG_SHOP = { x: -2890, z: -6150, yaw: Math.PI / 2, w: 9, d: 6 };
export const CROFTS = [
  { x: -2891, z: -6204, yaw: Math.PI / 2, w: 8, d: 5.5 },
  { x: -2893, z: -6124, yaw: Math.PI / 2, w: 7.5, d: 5.5 },
  { x: -2890, z: -6229, yaw: Math.PI / 2, w: 7, d: 5 },
];
export const PHONE_BOX = { x: -2880, z: -6188, yaw: Math.PI / 2 };
// The light on Raven Head, the island's north end; the broch and the standing stones on Tern Isle;
// the bothy above Bothy Bay; the herring station's ruins on Loch Skarn's south shore; the Seal
// Cave in Raven Isle's west cliffs; the Sula, a trawler wrecked in the kelp off Tern Isle.
export const RAVEN_LIGHT = { x: -3318, z: -6950 };
export const BROCH = { x: -3715, z: -5188, r: 8.5 };
export const STONES = { x: -3880, z: -5320, r: 7, n: 7 };
export const NORTH_BOTHY = { x: -1500, z: -5836, yaw: 0, level: 2.6 };
export const HERRING = { x: -1085, z: -5566, yaw: 0.25, level: 3 };
export const SEAL_CAVE = { x: -3713, z: -6300, yaw: -Math.PI / 2 };
export const SULA = { x: -3450, z: -5100, yaw: 0.9, len: 24 };
// Where you stand at a door (a metre or so out from it): Halvig Stores' (its front faces the pier),
// the bothy's (it faces the bay).
const doorOf = (B, u, d) => {
  const c = Math.cos(B.yaw), s = Math.sin(B.yaw), w = d / 2 + 1.2;
  return { x: B.x + u * c + w * s, z: B.z - u * s + w * c, yaw: B.yaw };
};
export const NORTH_DOORS = { shop: doorOf(HALVIG_SHOP, -1.2, HALVIG_SHOP.d), bothy: doorOf(NORTH_BOTHY, -1, 4.2) };
// Level ground cut for them: [x, z, radius, level].
const PADS = [[NORTH_BOTHY.x, NORTH_BOTHY.z, 7, NORTH_BOTHY.level], [HERRING.x, HERRING.z, 16, HERRING.level]];

/* ---------------- distance fields ---------------- */

const hyp = Math.hypot;
function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}
const smax = (a, b, k) => -smin(-a, -b, k);
const sdCircle = (x, z, cx, cz, r) => hyp(x - cx, z - cz) - r;
function sdCapsule(x, z, ax, az, bx, bz, r) {
  const pax = x - ax, paz = z - az, bax = bx - ax, baz = bz - az;
  const h = clamp((pax * bax + paz * baz) / (bax * bax + baz * baz), 0, 1);
  return hyp(pax - bax * h, paz - baz * h) - r;
}
// An island's own outline (a turned ellipse; k: 0 at its middle, 1 at its shore).
function isleK(I, x, z) {
  const dx = x - I.x, dz = z - I.z, c = Math.cos(I.yaw), s = Math.sin(I.yaw);
  return hyp((dx * c - dz * s) / I.rx, (dx * s + dz * c) / I.rz);
}
const isleD = (I, x, z) => (isleK(I, x, z) - 1) * Math.min(I.rx, I.rz);

// The west coast: how far west the mainland reaches at z (cliffs and coves, a headland every few
// hundred metres).
export function westX(z) {
  // (Bolder along the way, headlands and bays half a kilometre across; steadier by the isles,
  // where the sound runs along it.)
  const bold = 340 * fbm(z * 0.0011 + 3.3, 1.7, 3) * smoothstep(-5300, -4700, z) * smoothstep(-200, -700, z);
  return -2190 + bold + 70 * fbm(z * 0.0016 + 3.3, 1.7, 3) + 30 * fbm(z * 0.006 - 1.1, 2.2, 2) + 12 * fbm(z * 0.02, 4.1, 2);
}
// Loch Skarn: signed distance to its shores (negative on its water), and how far in (0 at the
// mouth, 1 at the head).
const _lk = { d: 0, t: 0 };
export function lochAt(x, z, out = _lk) {
  let best = Infinity, along = 0, run = 0, total = 0;
  for (let i = 0; i < LOCH.length - 1; i++) total += hyp(LOCH[i + 1][0] - LOCH[i][0], LOCH[i + 1][1] - LOCH[i][1]);
  for (let i = 0; i < LOCH.length - 1; i++) {
    const [ax, az, aw] = LOCH[i], [bx, bz, bw] = LOCH[i + 1];
    const bax = bx - ax, baz = bz - az, L = hyp(bax, baz);
    const h = clamp(((x - ax) * bax + (z - az) * baz) / (L * L), 0, 1);
    const d = hyp(x - ax - bax * h, z - az - baz * h) - lerp(aw, bw, h);
    if (d < best) {
      best = d;
      along = (run + h * L) / total;
    }
    run += L;
  }
  out.d = best;
  out.t = along;
  return out;
}

// The shape of the north at a point: d, the coast's signed distance (negative on land); main,
// the mainland's; isle, the islands' (and the stacks and skerries); I, the island it's nearest.
// home: home's own coast distance here (terrain.js), which the mainland is cut from.
const _ns = { x: NaN, z: NaN, home: NaN, d: 0, main: 0, isle: 0, I: null, n: 0, n2: 0, loch: 0, t: 0 };
export function northShape(x, z, home) {
  const S = _ns;
  if (x === S.x && z === S.z && home === S.home) return S;
  S.x = x;
  S.z = z;
  S.home = home;
  const n = fbm(x * 0.021, z * 0.021, 3), n2 = fbm(x * 0.08 + 5.2, z * 0.08 - 3.1, 2);
  // The mainland: home's land as it runs on, ending at the west coast; the Ness at its corner;
  // the point at the Churn; Loch Skarn and Bothy Bay cut into it.
  let m = smax(home, westX(z) - x + n * 8, 40);
  m = smin(m, sdCapsule(x, z, NESS.x0, NESS.z0, NESS.x1, NESS.z1, NESS.r) + n * 14 + n2 * 3, 30);
  m = smin(m, sdCircle(x, z, CHURN.x, CHURN.z, CHURN.r) + n * 10 + n2 * 2, 60);
  const L = lochAt(x, z);
  m = smax(m, -(L.d + n2 * 3), 25);
  m = smax(m, -(sdCircle(x, z, BOTHY_BAY.x, BOTHY_BAY.z, BOTHY_BAY.r) + n2 * 3), 15);
  // The isles.
  let isle = Infinity, I = null;
  for (const J of ISLES) {
    let d = isleD(J, x, z) + n * (J === RAVEN ? 26 : 14) + n2 * 3;
    if (J === RAVEN) d = smax(d, -(sdCircle(x, z, HALVIG.x, HALVIG.z, HALVIG.r) + n2 * 2), 18);
    if (d < isle) {
      isle = d;
      I = J;
    }
  }
  for (const R of SELKIE) isle = Math.min(isle, sdCircle(x, z, R.x, R.z, R.r) + n2 * 2.5);
  isle = Math.min(isle, sdCircle(x, z, SKARV.x, SKARV.z, SKARV.r) + n2 * 1.5);
  S.main = m;
  S.isle = isle;
  S.I = I;
  S.d = Math.min(m, isle);
  S.n = n;
  S.n2 = n2;
  S.loch = L.d;
  S.t = L.t;
  return S;
}
export const northSDF = (x, z, home) => northShape(x, z, home).d;

/* ---------------- heights ---------------- */

// The far hills: the land beyond home's rising into the fells (as the horizon was always drawn:
// world.js draws home's far side with the same).
export function farHills(x, z) {
  const out = Math.max(NORTH_EDGE.x - x, NORTH_EDGE.z - z, 0);
  return 240 * smoothstep(0, 1300, out) * clamp(0.45 + fbm(x * 0.0011 + 7, z * 0.0011 - 3, 3) * 0.9, 0.1, 1.2) + fbm(x * 0.004, z * 0.004, 2) * 25 * smoothstep(0, 500, out);
}
// How much of the west's weather a point takes (0 the lee … 1 open to the Atlantic): the west coast,
// and each island's west side.
export function weatherSide(x, z, S) {
  if (S.isle < S.main && S.I) return smoothstep(0.15, -0.55, Math.cos(Math.atan2(z - S.I.z, x - S.I.x)));
  return smoothstep(-1880, -2120, x) * (1 - smoothstep(-80, -20, S.loch));
}
// The loch's floor: over the sill at the mouth, deep inside, shoaling at the head.
const lochFloor = (t) => (t < 0.06 ? lerp(-15, -22, t / 0.06) : t < 0.2 ? lerp(-22, -88, (t - 0.06) / 0.14) : t < 0.82 ? -88 + 6 * Math.sin(t * 9) : lerp(-88, -5, (t - 0.82) / 0.18));
// In Raven Sound (0 … 1): between Raven Isle's east shore and the mainland, south of the Churn.
export function inSound(x, z) {
  const along = smoothstep(-5450, -5700, z) * smoothstep(-7150, -6950, z);
  const across = smoothstep(RAVEN.x + RAVEN.rx - 60, RAVEN.x + RAVEN.rx + 60, x) * smoothstep(westX(z) + 40, westX(z) - 60, x);
  return along * across;
}
// The Churn's race (0 … 1): the narrows between the point and Raven Isle's north-east shore.
export const inChurn = (x, z) => smoothstep(330, 140, hyp(x - (CHURN.x - 200), z - (CHURN.z + 30)));
// In Bothy Bay (its water, off Loch Skarn's north shore).
export const inBothyBay = (x, z) => hyp(x - BOTHY_BAY.x, z - BOTHY_BAY.z) < BOTHY_BAY.r + 10;
// The Selkie Rocks' ground (0 … 1).
export const nearSelkie = (x, z) => smoothstep(260, 90, hyp(x - -3045, z - -4920));

// The ground's height in the north. S: its shape (northShape); base: home's own ground for that
// coast distance (terrain.js baseHeight, with the north's distance), on which it builds.
export function northGround(x, z, S, base) {
  const d = S.d, n = S.n;
  if (d >= 0) {
    // The sea: home's shelf, deeper off the west coast and among the isles (the Atlantic's), the
    // sound's floor, the loch's basin over its sill, the race's rock sill.
    let h = base - 26 * smoothstep(-1850, -2350, x) * smoothstep(30, 420, d) - 8 * smoothstep(-2600, -4200, x) * smoothstep(200, 700, d);
    const s = inSound(x, z);
    if (s > 0) h = lerp(h, Math.max(h, -22 + fbm(x * 0.01, z * 0.01, 2) * 5), s);
    if (S.loch < 30) {
      const k = smoothstep(8, 75, d) * smoothstep(30, -10, S.loch);
      h = lerp(h, lochFloor(S.t) + fbm(x * 0.02, z * 0.02, 2) * 3, k);
      // (The sill across its mouth: rock a few metres higher than the water either side.)
      const sill = hyp(x - LOCH_SILL.x, z - LOCH_SILL.z);
      if (sill < 150) h = Math.max(h, lerp(-60, LOCH_SILL.top + n * 3, smoothstep(140, 30, sill)));
    }
    // Bothy Bay: shoaling to its beach, six to ten metres over most of it (mud and sand).
    const bay = hyp(x - BOTHY_BAY.x, z - BOTHY_BAY.z);
    if (bay < BOTHY_BAY.r + 70) h = lerp(h, Math.max(h, lerp(-2, -12, smoothstep(BOTHY_BAY.z - 75, BOTHY_BAY.z + 85, z)) + fbm(x * 0.03, z * 0.03, 2)), smoothstep(BOTHY_BAY.r + 70, BOTHY_BAY.r, bay) * smoothstep(-50, 0, S.loch));
    const c = inChurn(x, z);
    if (c > 0) h = lerp(h, Math.max(h, -10 + fbm(x * 0.05, z * 0.05, 2) * 3), c);
    // (Alongside Halvig's pier, dredged to a working depth: a boat lies there to the pier's root.)
    const Q = HALVIG_PIER;
    if (x > Q.x0 - 4 && x < Q.x1 + 8 && z > Q.z0 - 14 && z < Q.z1 + 14) h = Math.min(h, lerp(h, -3.6, smoothstep(14, 6, Math.max(Q.z0 - z, z - Q.z1, 0)) * smoothstep(Q.x1 + 8, Q.x1, x)));
    // Skarv Stack stands in deep water: its foot drops away all round to thirty-odd metres.
    const ds = hyp(x - SKARV.x, z - SKARV.z);
    if (ds < 320) h = Math.min(h, lerp(h, -34 + fbm(x * 0.03, z * 0.03, 2) * 4, smoothstep(320, 70, ds)) - 4 * smoothstep(SKARV.r + 30, SKARV.r + 4, ds));
    return h;
  }
  const inland = -d;
  // The islands, each its own shape; the stacks and skerries sheer; the mainland home's land with
  // the far hills on it, falling to cliffs on the west coast.
  if (S.isle < S.main) {
    for (const R of SELKIE) {
      const dr = hyp(x - R.x, z - R.z);
      if (dr < R.r + 8) return -0.4 + (R.h + 0.4) * smoothstep(0, R.r * 0.5, inland) * (0.85 + 0.15 * n);
    }
    const ds = hyp(x - SKARV.x, z - SKARV.z);
    if (ds < SKARV.r + 8) return lerp(2, SKARV.h * (0.9 + 0.1 * n), smoothstep(SKARV.r + 1, SKARV.r - 5, ds)) + 6 * smoothstep(SKARV.r - 6, 0, ds);
    const I = S.I, k = clamp(isleK(I, x, z), 0, 1), west = weatherSide(x, z, S);
    if (I === TERN) return pads(x, z, -0.4 + 2 * smoothstep(0, 10, inland) + (I.h - 2) * smoothstep(8, 160, inland) * (0.8 + 0.25 * n));
    // Raven Isle: a high back, cliffs on its west, a long slope to the sound on its east.
    const dome = I.h * Math.pow(1 - k * k, 0.75) * (0.85 + 0.25 * n) + 8 * fbm(x * 0.02, z * 0.02, 2);
    const edge = 0.8 + inland * lerp(0.32, 3.8, west);
    return pads(x, z, Math.max(-0.4 + 1.6 * smoothstep(0, 6, inland), Math.min(dome, edge)));
  }
  const hills = farHills(x, z);
  const soft = base + hills * smoothstep(0, 60, inland);
  // The cliffs: the land's top reached within a few metres of the sea.
  const top = 5.6 + 30 * (0.5 + 0.5 * fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 4)) ** 2 + hills;
  const cliff = weatherSide(x, z, S) * smoothstep(-0.35, 0.1, fbm(x * 0.004 + 1.3, z * 0.004 - 6.1, 2));
  // (Loch Skarn's sides fall steeply into it: a fjord's.)
  const fjord = smoothstep(160, 40, S.loch + inland) * (1 - smoothstep(0.88, 1, S.t));
  const steep = Math.max(cliff, fjord * 0.8);
  return pads(x, z, lerp(soft, Math.max(-0.4 + 1.2 * smoothstep(0, 4, inland), top * smoothstep(0.5, lerp(14, 40, 1 - cliff), inland)), steep));
}
// The level ground cut for what stands there (Halvig's shelf, the bothy, the herring station; the
// broch's and the light's own ground, levelled where they stand).
function pads(x, z, h) {
  const S = HALVIG_SHELF;
  if (x > S.x0 - 14 && x < S.x1 + 6 && z > S.z0 - 14 && z < S.z1 + 14 && h > 0.5) {
    const out = Math.max(S.x0 - x, x - S.x1, S.z0 - z, z - S.z1, 0);
    h = lerp(S.level, h, smoothstep(0, 12, out));
  }
  for (const [px, pz, r, level] of PADS) {
    const d = hyp(x - px, z - pz);
    if (d < r + 8) h = lerp(level, h, smoothstep(r, r + 8, d));
  }
  return h;
}

/* ---------------- zones, current and habitat ---------------- */

// The north's waters: the kelp along every rocky shore, Raven Sound, the Churn, Loch Skarn, the
// skerries, and the open Atlantic outside.
export const NORTH_ZONES = ['kelp', 'sound', 'race', 'loch', 'skerry', 'outer'];
export function northZone(x, z, S, depth) {
  if ((S.loch < 0 && S.t > 0.04) || inBothyBay(x, z)) return 'loch';
  if (inChurn(x, z) > 0.5) return 'race';
  if (nearSelkie(x, z) > 0.5) return 'skerry';
  if (inSound(x, z) > 0.5) return 'sound';
  if (S.d < 70 && depth < 16) return 'kelp';
  return 'outer';
}
// The north's current at the surface: a slow drift north along the west coast, stronger offshore;
// the tide through Raven Sound and hard over the Churn; still in the loch. flow: the tide's
// stream (-1 … 1), as conditions.js turns it.
export function northCurrent(x, z, S, flow, out) {
  const open = smoothstep(10, 300, Math.max(0, S.d));
  let cx = 0.01 * open, cz = -0.06 * open;
  const s = inSound(x, z), c = inChurn(x, z);
  cz += flow * (0.35 * s + 0.85 * c) * smoothstep(0, 40, Math.max(0, S.d));
  const still = S.loch < 40 ? smoothstep(40, -60, S.loch) : 0;
  out.x = cx * (1 - still);
  out.z = cz * (1 - still);
  return out;
}
// Weed and rock on the seabed: kelp on the rock from a metre or two down to fifteen, sand in the
// sound and off Tern Isle's beach, mud in the loch's basin, rock walls in the loch and round the
// stack.
// H: the ground's height anywhere (terrain.js heightAt), for how steep it is here.
export function northHabitat(x, z, S, h, out, H) {
  // (S is shared: what's needed of it first, before H moves it elsewhere.)
  const depth = Math.max(0, -h), d = Math.max(0, S.d), tern = S.I === TERN && S.isle < 260, loch = S.loch;
  const slope = (Math.abs(H(x + 3, z) - H(x - 3, z)) + Math.abs(H(x, z + 3) - H(x, z - 3))) / 6;
  // (Bothy Bay: sand by its beach, mud further out, the best holding in the isles.)
  const bay = inBothyBay(x, z);
  const sandy = Math.max(inSound(x, z) * smoothstep(8, 14, depth), tern ? smoothstep(0.2, -0.6, Math.cos(Math.atan2(z - TERN.z, x - TERN.x) + Math.PI)) : 0, bay ? 1 : 0);
  const mud = bay ? 0.7 * smoothstep(4, 9, depth) : loch < 0 ? smoothstep(25, 45, depth) : 0;
  const rock = clamp(Math.max((1 - sandy) * (1 - mud) * (1 - smoothstep(60, 160, d)), inChurn(x, z), mud > 0 ? 0 : smoothstep(0.6, 1.4, slope)), 0, 1);
  out.depth = depth;
  out.weed = clamp(rock * smoothstep(0.6, 2, depth) * (1 - smoothstep(13, 18, depth)) * smoothstep(-0.4, 0.1, fbm(x * 0.04 - 2, z * 0.04 + 7, 2) + 0.2), 0, 1);
  out.rock = rock;
  out.grass = 0;
  out.mud = mud;
  return out;
}

// The kelp forests and the low weed under them (underwater.js addBeds), round each island and along
// the shores near them: kelp wherever there's rock from a couple of metres down to fifteen.
export const NORTH_BEDS = [
  { x: -3780, z: -7180, w: 1300, h: 1580, grass: 900, kelp: 1100 }, // Raven Isle and the Churn
  { x: -4180, z: -5600, w: 840, h: 680, grass: 400, kelp: 450 }, // Tern Isle
  { x: -3200, z: -5080, w: 320, h: 320, grass: 150, kelp: 220 }, // the Selkie Rocks
  { x: -4060, z: -7180, w: 220, h: 240, grass: 60, kelp: 140 }, // Skarv Stack
  { x: -2500, z: -7300, w: 600, h: 2100, grass: 500, kelp: 600 }, // the mainland's shore along the sound
  { x: -2300, z: -6100, w: 1700, h: 900, grass: 300, kelp: 300 }, // Loch Skarn's shores
];

/* ---------------- places ---------------- */

// Found as you go (the journal's places and the chart's labels). r: how near you come to find it.
export const NORTH_PLACES = [
  { id: 'ness', name: $t('The Ness'), sub: $t('the headland at the mainland’s south-west corner'), north: true, x: -2045, z: 260, r: 260, note: $t('A high headland where the south coast turns north. The swell comes in round it from the open Atlantic; beyond it the coast runs north under the fells, cliffs and coves for miles, to the Selkie Isles.') },
  { id: 'selkie', name: $t('The Selkie Isles'), sub: $t('an archipelago up the coast, in cold clear water'), area: true, north: true, x: -3200, z: -6000, size: 30, r: 1300, note: $t('Islands off the mainland’s west coast, nine kilometres from Willow Bay by sea: cliffs and seabirds, kelp in clear cold water, seals on the skerries, a sea loch running into the hills.') },
  { id: 'raven', name: $t('Raven Isle'), sub: $t('the big island, its cliffs and its colony'), north: true, x: RAVEN.x, z: RAVEN.z, r: 560, note: $t('The biggest of the isles: grey cliffs on its Atlantic side where the seabirds nest, grass and heather down to the sound on the other, and the hamlet of Halvig on its shore.') },
  { id: 'tern', name: $t('Tern Isle'), sub: $t('a low island of white sand'), north: true, x: TERN.x, z: TERN.z, r: 380, note: $t('A low island of machair and white shell sand, the terns nesting on it in summer. Its east side is a long beach to land the tender on; clear water over sand off it.') },
  { id: 'selkierocks', name: $t('The Selkie Rocks'), sub: $t('skerries where the seals haul out'), north: true, x: -3045, z: -4920, r: 160, note: $t('Low rocks in the approach to the isles, awash at high water. The grey seals haul out on them at low tide, and watch every boat go by.') },
  { id: 'skarv', dive: true, name: $t('Skarv Stack'), sub: $t('a stack off Raven Isle, white with seabirds'), north: true, x: SKARV.x, z: SKARV.z, r: 200, note: $t('A sixty-metre stack off Raven Isle’s north-west, standing in deep water. Gannets on its top, guillemots and kittiwakes packed on its ledges; the noise and the smell carry a long way downwind.') },
  { id: 'ravensound', name: $t('Raven Sound'), sub: $t('sheltered water between Raven Isle and the mainland'), area: true, north: true, x: -2520, z: -6250, size: 22, r: 0, note: $t('The channel between Raven Isle and the mainland: sheltered from the west, sand and kelp under fifteen to thirty metres of clear water, the tide running through it.') },
  { id: 'churn', name: $t('The Churn'), sub: $t('a tide race at the sound’s north end'), north: true, x: CHURN.x - 200, z: CHURN.z + 30, r: 0, note: $t('Where Raven Sound narrows at its north end, the tide pours over a rock sill: standing waves and boils on the ebb, flat calm at slack water. Pollack and saithe hunt in it, and the birds work over it.') },
  { id: 'loch', name: $t('Loch Skarn'), sub: $t('a sea loch running into the hills'), area: true, north: true, x: -1500, z: -5640, size: 22, r: 0, note: $t('A sea loch running a mile and a half into the mainland under the fells: steep sides, a sill at its mouth, and ninety metres of still, dark water inside. Skate, ling and conger in the deep.') },
  // (N3) What's on them.
  { id: 'halvig', name: $t('Halvig'), sub: $t('a hamlet on Raven Isle, with a stone pier, fuel and a shop'), dock: true, harbour: true, north: true, x: -2885, z: -6170, r: 90, note: $t('Four houses and a shop on a shelf of level ground above a little bay on Raven Isle’s sheltered side, and a stone pier with eight to ten metres alongside its head. Diesel and petrol from the pump at the pier’s root, stores and ice from the shop, and a red phone box.') },
  { id: 'ravenhead', name: $t('Raven Head'), sub: $t('the light on Raven Isle’s north end'), north: true, x: RAVEN_LIGHT.x, z: RAVEN_LIGHT.z, r: 120, note: $t('A white lighthouse on the high ground at Raven Isle’s north end, sixty metres above the sea. Its light shows three flashes every fifteen seconds after dark; below it the Churn runs and the stack stands off to the west.') },
  { id: 'broch', name: $t('The Broch'), sub: $t('an iron-age tower on Tern Isle'), north: true, x: BROCH.x, z: BROCH.z, r: 45, note: $t('The stump of a round tower of dry stone, two thousand years old, on Tern Isle’s high ground: its double wall still stands higher than a man, with a stair in the thickness of it and a doorway facing the sea.') },
  { id: 'stones', name: $t('The Standing Stones'), sub: $t('a ring of stones on Tern Isle'), north: true, x: STONES.x, z: STONES.z, r: 35, note: $t('Seven tall grey stones standing in a ring on the machair at Tern Isle’s west end, older than the broch. Nobody knows who raised them; the terns don’t care.') },
  { id: 'lochbothy', name: $t('The Loch Bothy'), sub: $t('a stone hut above Bothy Bay'), north: true, x: NORTH_BOTHY.x, z: NORTH_BOTHY.z, r: 40, note: $t('An old shepherd’s hut above the beach in Bothy Bay, kept weathertight and left open: a stove, a bench, a sleeping platform, and a book to write your name in.') },
  { id: 'herring', name: $t('The Herring Station'), sub: $t('ruins on Loch Skarn’s shore'), north: true, x: HERRING.x, z: HERRING.z, r: 60, note: $t('The roofless walls of a curing station from the days when the loch was full of herring, and the stumps of its timber pier running out into the water. Ling and conger live among the stones that fell off it.') },
  { id: 'sealcave', name: $t('The Seal Cave'), sub: $t('a sea cave in Raven Isle’s west cliffs'), north: true, x: SEAL_CAVE.x, z: SEAL_CAVE.z, r: 60, note: $t('A cave at the foot of the cliffs on Raven Isle’s Atlantic side, big enough to take a tender into on a calm day. The grey seals pup in it in autumn; listen for them singing.') },
  { id: 'sula', dive: true, name: $t('The Sula'), sub: $t('a trawler wrecked in the kelp off Tern Isle'), north: true, x: SULA.x, z: SULA.z, r: 70, note: $t('A steel trawler that ran onto the rocks off Tern Isle in a winter gale and sank in the kelp, ten to eighteen metres down, under a yellow buoy. Her wheelhouse still stands; a conger and a ling live in her hull, and pollack hang over her.') },
  { id: 'bothybay', name: $t('Bothy Bay'), sub: $t('an anchorage in Loch Skarn'), north: true, x: BOTHY_BAY.x, z: BOTHY_BAY.z, r: 120, note: $t('A bay on Loch Skarn’s north shore, sheltered from every wind: mud and sand at six to ten metres, the best holding in the isles. A bothy stands above the beach.') },
];
