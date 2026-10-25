import { clamp, lerp, smoothstep, fbm } from '../util.js';

// Hoarfell and the Coldwater: a snow-capped fell to the north-west, and the river that runs off it
// down to Willow Bay. From the summit's corrie a tarn spills into a steep beck; the beck drops over
// Spout Force into a deep pool, tumbles down a gorge (the Gill), then winds through a long dale of
// pools and runs, over the Lower Force, and out across the old strait (now land: the river cut
// its own way through) to meet the bay just west of Willowhaven.
//
// Unlike the rest of the game's water, most of this river sits above the sea: each stretch has
// its own water level, stepping down at the falls. waterLevel() below gives it; waveHeight (see
// conditions.js) adds it, so wading, floats, the camera and the underwater view all follow it.
// The last stretch below the Lower Force is at sea level, tidal: the sea's own water.
//
// North is -z (the bay opens to the south); west is -x.

export const HOARFELL = { x: -1040, z: -1500, h: 560 };
// The tarn in the summit's corrie: an oval lake under the headwall.
export const TARN = { x: -925, z: -1328, rx: 64, rz: 40, yaw: 0.62, level: 246, depth: 9 };

// The river from the tarn's outflow to the bay: x, z, half-width w, depth d at the middle, water
// level l, and raise (1 where the dale lifts the land to carry the river above the plateau; 0
// where it's cut down into the hills). The Spout and the Lower Force are where two nodes a few
// metres apart are many metres apart in level.
const N = (x, z, w, d, l, raise = 1) => ({ x, z, w, d, l, raise });
export const COLDWATER = [
  N(-878, -1298, 2.6, 0.6, 246),   // the tarn's lip
  N(-852, -1264, 2.0, 0.5, 236),
  N(-824, -1226, 2.2, 0.6, 223),
  N(-803, -1197, 3.2, 1.5, 215),   // a pool under a slab
  N(-782, -1170, 2.0, 0.5, 206),
  N(-755, -1133, 2.4, 0.6, 191),
  N(-737, -1109, 3.4, 1.6, 185),   // a pool
  N(-714, -1078, 2.2, 0.5, 171),
  N(-692, -1047, 2.6, 0.7, 159),
  N(-672, -1020, 3.8, 1.2, 151),   // the lip of Spout Force
  N(-667, -1013, 3.6, 1.1, 150.5),
  N(-661, -1005, 9.5, 4.6, 122),   // Spout Pool, 28 m below
  N(-645, -984, 10.5, 4.8, 122),
  N(-630, -962, 4.2, 1.0, 121.4),
  N(-613, -935, 2.6, 0.6, 112),    // the Gill
  N(-597, -906, 2.4, 0.6, 101),
  N(-581, -880, 3.6, 1.7, 96.5),   // Gill Pool
  N(-561, -851, 2.4, 0.6, 87),
  N(-541, -823, 3.2, 0.9, 80),
  N(-513, -791, 4.2, 1.0, 74.5),   // into the dale
  N(-481, -760, 5.8, 1.9, 71.5),   // a pool
  N(-449, -729, 4.2, 0.7, 65),
  N(-411, -700, 6.4, 2.1, 61),     // a pool
  N(-373, -668, 4.6, 0.7, 53),
  N(-336, -630, 6.8, 2.2, 48.5),   // a pool
  N(-300, -590, 4.6, 0.8, 41),
  N(-262, -551, 7.2, 2.3, 36.5),   // a pool
  N(-225, -512, 5.0, 0.8, 30),
  N(-190, -471, 7.4, 2.4, 25.5),   // a pool
  N(-158, -431, 5.2, 0.8, 19.5),
  N(-128, -396, 7.6, 2.4, 15.5),   // a pool
  N(-103, -366, 6.2, 1.0, 11.5),   // the lip of the Lower Force
  N(-99, -361, 6.0, 1.0, 11.2),
  N(-93, -352, 12, 3.6, 0, 0),     // Force Pool, at sea level: the tide reaches this far
  N(-80, -320, 9.5, 2.7, 0, 0),
  N(-68, -286, 9.5, 2.5, 0, 0),
  N(-61, -251, 10, 2.6, 0, 0),
  N(-66, -213, 10, 2.4, 0, 0),
  N(-60, -176, 11, 2.6, 0, 0),
  N(-53, -141, 12, 2.8, 0, 0),
  N(-50, -109, 9.5, 2.6, 0, 0),
  N(-48, -84, 10.5, 2.4, 0, 0),    // into the bay, under the footbridge
];
// The named falls (where the water drops), for the scenery, the sound and the map.
export const FALLS = [
  { id: 'spout', name: 'Spout Force', top: 10, foot: 11 },
  { id: 'lower', name: 'the Lower Force', top: 32, foot: 33 },
];
// Where the old strait is closed: the river runs out across this neck of land.
export const NECK = { x0: -64, z0: -228, x1: -78, z1: -350, r: 52 };

// The footbridge that carries the coast path over the river's mouth: a low timber arch (deck: its
// height at each end, arch: how much higher in the middle), high enough for a canoe to pass under.
export const FOOTBRIDGE = { x: -48.1, z: -85.1, len: 27, w: 1.6, yaw: 0.551, deck: 0.8, arch: 0.95 };

// Everything this module touches lies in here (out to the edge of the land drawn at all).
export const COLD_BOX = { x0: -1800, x1: 10, z0: -2200, z1: -40 };
const RIVER_BOX = { x0: -1000, x1: 0, z0: -1340, z1: -60 };

// Along the river: cumulative length, and a smoothed level for the land (the valley floor ramps
// past a fall over a hundred metres or so, where the water itself drops at once).
const SEG = [];
let total = 0;
for (let i = 0; i < COLDWATER.length - 1; i++) {
  const a = COLDWATER[i], b = COLDWATER[i + 1];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  SEG.push({ a, b, len, s0: total, tx: (b.x - a.x) / len, tz: (b.z - a.z) / len });
  total += len;
}
export const COLDWATER_LENGTH = total;

// A coarse grid over the area saying which segments of a line lie within reach of each cell, so
// finding the nearest one only looks at a few.
export function segmentGrid(segs, box, pad, cell = 40) {
  const nx = Math.ceil((box.x1 - box.x0) / cell), nz = Math.ceil((box.z1 - box.z0) / cell);
  const cells = Array.from({ length: nx * nz }, () => []);
  segs.forEach((g, k) => {
    const x0 = Math.min(g.ax, g.bx) - pad, x1 = Math.max(g.ax, g.bx) + pad, z0 = Math.min(g.az, g.bz) - pad, z1 = Math.max(g.az, g.bz) + pad;
    for (let j = Math.max(0, Math.floor((z0 - box.z0) / cell)); j <= Math.min(nz - 1, Math.floor((z1 - box.z0) / cell)); j++) {
      for (let i = Math.max(0, Math.floor((x0 - box.x0) / cell)); i <= Math.min(nx - 1, Math.floor((x1 - box.x0) / cell)); i++) cells[j * nx + i].push(k);
    }
  });
  const none = [];
  return (x, z) => {
    const i = Math.floor((x - box.x0) / cell), j = Math.floor((z - box.z0) / cell);
    return i >= 0 && j >= 0 && i < nx && j < nz ? cells[j * nx + i] : none;
  };
}
for (const g of SEG) Object.assign(g, { ax: g.a.x, az: g.a.z, bx: g.b.x, bz: g.b.z });
const RIVER_NEAR = segmentGrid(SEG, { x0: -1300, x1: 300, z0: -1600, z1: 200 }, 260);
const SMOOTH = 55;
const smoothLevels = COLDWATER.map((n, i) => {
  const s = i ? SEG[i - 1].s0 + SEG[i - 1].len : 0;
  let sum = 0, wsum = 0;
  for (let k = -12; k <= 12; k++) {
    const l = levelAtS(s + (k / 12) * SMOOTH), w = 1 - Math.abs(k) / 13;
    sum += l * w;
    wsum += w;
  }
  return sum / wsum;
});
// How steeply the river falls round each node, over 80 m or so (for the valley's walls, which
// steepen into a gorge round the falls).
const smoothSteep = COLDWATER.map((n, i) => {
  const s = i ? SEG[i - 1].s0 + SEG[i - 1].len : 0;
  return Math.max(0, (levelAtS(s - 40) - levelAtS(s + 40)) / 80);
});
function levelAtS(s) {
  if (s <= 0) return COLDWATER[0].l;
  for (const g of SEG) if (s <= g.s0 + g.len) return lerp(g.a.l, g.b.l, (s - g.s0) / g.len);
  return COLDWATER[COLDWATER.length - 1].l;
}

// The nearest point of the river to (x, z): distance from the middle d, half-width w, depth,
// water level l, the smoothed level ls, flow direction (tx, tz), how far along (s, metres from
// the tarn), raise, and the segment's steepness.
const _ci = { d: Infinity, w: 1, dep: 0.5, l: 0, ls: 0, tx: 0, tz: 1, s: 0, raise: 1, steep: 0, gorge: 0, i: 0 };
const _near = new Float64Array(3 * 64);
export function coldInfo(x, z, out = _ci) {
  out.d = Infinity;
  const near = RIVER_NEAR(x, z);
  if (!near.length) {
    out.l = out.ls = out.w = out.dep = out.steep = out.gorge = 0;
    out.raise = 0;
    return out;
  }
  let n = 0;
  for (const i of near) {
    const g = SEG[i], a = g.a;
    const h = clamp(((x - a.x) * g.tx + (z - a.z) * g.tz) / g.len, 0, 1);
    const px = a.x + g.tx * g.len * h, pz = a.z + g.tz * g.len * h;
    const d = Math.hypot(x - px, z - pz);
    _near[n++] = d;
    _near[n++] = h;
    _near[n++] = i;
    if (d < out.d) {
      const b = g.b, k = smoothstep(0, 1, h);
      out.d = d;
      out.i = i;
      out.w = lerp(a.w, b.w, k);
      out.dep = lerp(a.d, b.d, k);
      out.l = lerp(a.l, b.l, h);
      out.tx = g.tx;
      out.tz = g.tz;
      out.s = g.s0 + g.len * h;
      out.steep = (a.l - b.l) / g.len;
    }
  }
  // The lie of the land round the river (its smoothed level, how far the dale floor is raised,
  // how gorge-like the sides): from every stretch near here, the nearest counting most, so the
  // valley's shape runs on smoothly round the bends rather than changing at a line between two
  // stretches. (Close to the water, that's all but the nearest.)
  const tau = 3 + out.d * 0.15;
  let ws = 0, ls = 0, raise = 0, gorge = 0, wide = 0;
  for (let k = 0; k < n; k += 3) {
    const w = Math.exp(-(_near[k] - out.d) / tau);
    if (w < 1e-3) continue;
    const h = _near[k + 1], i = _near[k + 2], g = SEG[i];
    ws += w;
    ls += w * lerp(smoothLevels[i], smoothLevels[i + 1], h);
    raise += w * lerp(g.a.raise, g.b.raise, h);
    gorge += w * lerp(smoothSteep[i], smoothSteep[i + 1], h);
    wide += w * lerp(g.a.w, g.b.w, smoothstep(0, 1, h));
  }
  out.ls = ls / ws;
  out.raise = raise / ws;
  out.gorge = gorge / ws;
  out.w = wide / ws;
  // Banks are never ruler-straight.
  out.d += fbm(x * 0.09 - 7, z * 0.09 + 3, 2) * Math.min(1.2, out.w * 0.3);
  return out;
}

// The tarn: signed distance to its shore (negative on the water).
export function tarnSDF(x, z) {
  const c = Math.cos(TARN.yaw), sn = Math.sin(TARN.yaw);
  const dx = x - TARN.x, dz = z - TARN.z;
  const u = (dx * c - dz * sn) / TARN.rx, v = (dx * sn + dz * c) / TARN.rz;
  const d = (Math.hypot(u, v) - 1) * TARN.rz;
  return d > 60 ? d : d + fbm(x * 0.05 + 13, z * 0.05 - 9, 2) * 4 * smoothstep(60, 30, d);
}

// The water surface here, if it's the river above the sea or the tarn; otherwise 0 (the sea's
// own level, which the sea, the lakes and the lower river share).
export function waterLevel(x, z) {
  if (x < RIVER_BOX.x0 || x > RIVER_BOX.x1 || z < RIVER_BOX.z0 || z > RIVER_BOX.z1) {
    if (Math.abs(x - TARN.x) < TARN.rx + 30 && Math.abs(z - TARN.z) < TARN.rx + 30 && tarnSDF(x, z) < 0.6) return TARN.level;
    return 0;
  }
  if (z > -345) return 0; // (below the Lower Force: sea level)
  if (Math.abs(x - TARN.x) < TARN.rx + 30 && Math.abs(z - TARN.z) < TARN.rx + 30 && tarnSDF(x, z) < 0.6) return TARN.level;
  const r = coldInfo(x, z);
  return r.d < r.w + 0.6 && r.l > 0.05 ? r.l : 0;
}

// Is this point in the Coldwater (or the tarn)? For zones and fish.
export function inColdwater(x, z, margin = 2) {
  if (x < COLD_BOX.x0 || x > COLD_BOX.x1 || z < COLD_BOX.z0 || z > COLD_BOX.z1) return false;
  if (Math.abs(x - TARN.x) < TARN.rx + 30 && Math.abs(z - TARN.z) < TARN.rx + 30 && tarnSDF(x, z) < margin) return 'tarn';
  if (x < RIVER_BOX.x0 || x > RIVER_BOX.x1 + 30 || z < RIVER_BOX.z0 || z > RIVER_BOX.z1) return false;
  const r = coldInfo(x, z);
  // (Below the Lower Force the river is at sea level and the tide comes up it: the tideway.)
  return r.d < r.w + margin ? (r.l > 0.05 ? 'river' : 'tideway') : false;
}

// Hoarfell itself: a broad cone with ridges and buttresses, falling away into the plateau.
function massif(x, z) {
  const dx = x - HOARFELL.x, dz = z - HOARFELL.z;
  // (The far flanks, to the west and north, are steeper: the fell falls away to the moor there
  // well before the edge of the land.)
  const d = Math.hypot(dx, dz) + Math.max(0, -dx - 200) * 0.6 + Math.max(0, -dz - 200) * 0.6;
  if (d > 1500) return -Infinity;
  const ang = Math.atan2(dz, dx);
  // Three long ridges: south-east (towards the dale), south-west and north.
  const ridge = Math.max(Math.cos(ang - 0.95) ** 9, Math.cos(ang - 2.3) ** 9 * 0.8, Math.cos(ang + 1.6) ** 9 * 0.7);
  // (A rounded top, the steep ground lower down: a fell, not a spike.)
  const fall = 410 + 170 * ridge;
  let h = HOARFELL.h * Math.exp(-((d / fall) ** 1.75));
  // Crags and gullies, stronger high up (and none out on the low ground round it).
  const crag = fbm(x * 0.012 + 4.1, z * 0.012 - 2.3, 4);
  h += crag * (8 * smoothstep(5, 60, h) + h * 0.035) + Math.abs(fbm(x * 0.03, z * 0.03, 3)) * 7 * smoothstep(80, 300, h);
  // (And it fades out at its outer edge, and at the edge of the land: down below anything round
  // it, so the land there is the land's own.)
  return lerp(-60, h, smoothstep(1500, 1200, d) * smoothstep(COLD_BOX.x0, COLD_BOX.x0 + 120, x) * smoothstep(COLD_BOX.z0, COLD_BOX.z0 + 120, z));
}

// The corrie: a bowl scooped out of the fell's flank, open to the south-east, its floor the tarn.
function corrie(x, z, h) {
  const dx = x - TARN.x, dz = z - TARN.z;
  if (Math.abs(dx) > 260 || Math.abs(dz) > 260) return h;
  const sd = tarnSDF(x, z);
  // Towards the summit (behind the tarn) the bowl's back wall rises steeply; to the south-east it
  // opens out over the lip.
  const back = clamp(((x - TARN.x) * -0.55 + (z - TARN.z) * -0.83) / 120, -1, 1);
  if (sd < 0) {
    const bed = TARN.level - TARN.depth * smoothstep(0, 22, -sd) + fbm(x * 0.15, z * 0.15, 2) * 0.4;
    return bed;
  }
  const wall = lerp(0.22, 1.25, smoothstep(-0.4, 0.8, back));
  const floor = TARN.level + 0.4 + sd * wall + Math.max(0, sd - 30) * wall * 0.8;
  const k = smoothstep(220, 120, Math.hypot(dx, dz));
  return lerp(h, Math.min(h, floor), k);
}

// The land, given what it would be without the fell and the river (h0, from the plateau and the
// hills round the bay): the fell raised, its corrie scooped, and the river's valley carved down
// to the water (or, where the river runs above the plateau, the dale's floor raised to carry it).
const _vi = {};
export function coldwaterHeight(x, z, h0) {
  if (x < COLD_BOX.x0 || x > COLD_BOX.x1 || z < COLD_BOX.z0 || z > COLD_BOX.z1) return h0;
  let O = Math.max(h0, massif(x, z));
  O = corrie(x, z, O);
  if (x < RIVER_BOX.x0 - 120 || x > RIVER_BOX.x1 + 40 || z < RIVER_BOX.z0 - 80 || z > RIVER_BOX.z1 + 30) return O;
  const r = coldInfo(x, z, _vi);
  const e = r.d - r.w;
  if (e > 200) return O;
  // Where the river runs above the land round it (in the dale, under the fell's flank), its
  // floor and shoulders are raised to carry it; never in the tarn.
  if (r.raise > 0.01) {
    const near = Math.abs(x - TARN.x) < 200 && Math.abs(z - TARN.z) < 200 ? smoothstep(0, 35, tarnSDF(x, z)) : 1;
    const lift = Math.min(r.ls + 2.5 + Math.max(0, e) * 0.2, r.ls + 26);
    O = lerp(O, Math.max(O, lift), r.raise * smoothstep(170, 90, e) * near);
  }
  // The valley profile: a floor beside the water, then sides that steepen (gorge-like where the
  // river is steep).
  const wall = 1 + smoothstep(0.08, 0.3, r.gorge) * 1.4;
  const ee = Math.max(0, e);
  // (Beside a pool below a fall the floor comes down near the water, so you can get to it.)
  const floor = lerp(r.ls, Math.min(r.ls, r.l + 2.5), smoothstep(30, 0, ee) * (r.l > 0.05 ? 1 : 0));
  const P = floor + 0.5 + ee * 0.12 + Math.max(0, ee - 6) * 0.3 * wall + Math.max(0, ee - 24) * 0.25 * wall + Math.max(0, ee - 120) * 0.8;
  // Banks that keep the water in: never lower than the water just beside it.
  const keep = smoothstep(0.1, 1.5, r.l);
  const C = r.l + 0.35 + ee * 0.65;
  // (Far from the water the valley gives way to the land round it: the fell, or the moor.)
  let land = lerp(Math.min(O, P), O, smoothstep(140, 200, e));
  if (keep > 0 && ee < 14) land = lerp(land, Math.max(land, C), keep * smoothstep(14, 8, ee));
  if (e < 0) {
    // In the channel: the bed, deepest in the middle.
    const u = r.d / r.w;
    const bed = r.l - r.dep * (1 - u * u) + fbm(x * 0.4, z * 0.4, 2) * 0.12 * (1 - u * u);
    const inner = r.l > 0.05 ? bed : Math.min(O, bed);
    // (A soft edge from the bed up to the bank.)
    return lerp(inner, land, smoothstep(0.75, 1, u));
  }
  return land;
}

// The river's current: quick and white in the steep runs, slow in the pools, a lazy drift in the
// tidal stretch. (On the falls themselves it simply pours.)
export function coldwaterFlow(x, z, out = { x: 0, z: 0 }) {
  out.x = 0;
  out.z = 0;
  if (x < RIVER_BOX.x0 || x > RIVER_BOX.x1 + 20 || z < RIVER_BOX.z0 || z > RIVER_BOX.z1 + 10) return out;
  const r = coldInfo(x, z);
  if (r.d > r.w + 0.5) return out;
  const speed = clamp(0.25 + r.steep * 6 + 1.2 / (r.w * Math.max(r.dep, 0.3) + 0.6), 0.15, 2.2) * (r.l > 0.05 ? 1 : 0.35);
  const edge = 1 - smoothstep(r.w * 0.45, r.w + 0.5, r.d);
  out.x = r.tx * speed * edge;
  out.z = r.tz * speed * edge;
  return out;
}

/* ---------------- the fell path ---------------- */

// From the coast path by the footbridge, up the river's east and north-east bank (on the terrace
// above the water), past the Lower Force and the bothy at Spout Pool, up the beck to the tarn,
// and in a few long zigzags up the south-east ridge to the summit. Built from the river itself:
// each point a little way back from the bank.
// The bothy: a stone hut dug into the hillside beside the path, above Spout Pool, its door
// facing the path and the pool (yaw: the way the door faces, 0 = south, +x = east), and the
// level ground it stands on (r: the level part; the hillside is cut back round it).
export const BOTHY = { x: -606, z: -996, yaw: -Math.PI / 2 - 0.15, r: 5.5, level: 141 };
export const SUMMIT_CAIRN = { x: HOARFELL.x + 6, z: HOARFELL.z + 4 };
export const FELL_PATH = (() => {
  const pts = [[-36, -93], [-37, -101]];
  const W = COLDWATER;
  for (let i = W.length - 2; i >= 1; i--) {
    const a = W[i - 1], b = W[i + 1], n = W[i];
    let tx = b.x - a.x, tz = b.z - a.z;
    const l = Math.hypot(tx, tz);
    tx /= l;
    tz /= l;
    // (The east, then north-east bank: the left bank going downstream is +normal; this is the
    // right one.)
    const off = n.w + (i > 36 ? 7 : i >= 10 && i <= 13 ? 22 : 13);
    pts.push([Math.round((n.x + tz * off) * 10) / 10, Math.round((n.z - tx * off) * 10) / 10]);
  }
  // From the tarn's east shore across the corrie floor and up onto its east rim (the headwall
  // behind the tarn is crags, no way up), along the rim, round onto the fell's north flank in long
  // zigzags (about two in five), and up the gentle dome of the top to the cairn. Each hairpin is a
  // little U-turn, its two legs a few metres apart.
  pts.push([-866, -1322], [-856, -1312], [-802, -1276], [-780, -1261], [-775, -1261], [-776, -1267], [-790, -1282],
    [-754, -1336], [-736, -1390], [-772, -1504], [-772, -1528], [-784, -1546], [-796, -1570], [-820, -1606],
    [-832, -1630], [-838, -1636], [-908, -1686], [-913, -1687], [-912, -1682], [-874, -1630], [-850, -1558],
    [-847, -1548], [-848, -1542], [-853, -1544], [-922, -1594], [-934, -1606], [-988, -1642], [-1012, -1654],
    [-1036, -1642], [-1048, -1624], [-1066, -1606], [-1074, -1590], [-1075, -1585], [-1070, -1586], [-1036, -1600],
    [-1018, -1582], [-1012, -1570], [SUMMIT_CAIRN.x - 2, SUMMIT_CAIRN.z - 3]);
  return pts;
})();
const PATH_SEGS = [];
for (let i = 0; i < FELL_PATH.length - 1; i++) {
  const [ax, az] = FELL_PATH[i], [bx, bz] = FELL_PATH[i + 1];
  PATH_SEGS.push({ ax, az, bx, bz, len: Math.hypot(bx - ax, bz - az) });
}
export const FELL_PATH_LENGTH = PATH_SEGS.reduce((s, g) => s + g.len, 0);
export const FELL_BOX = (() => {
  const xs = FELL_PATH.map((p) => p[0]), zs = FELL_PATH.map((p) => p[1]);
  return { x0: Math.min(...xs) - 14, x1: Math.max(...xs) + 14, z0: Math.min(...zs) - 14, z1: Math.max(...zs) + 14 };
})();
const PATH_NEAR = segmentGrid(PATH_SEGS, FELL_BOX, 14, 32);
// The stretches of path that may be within a dozen metres of here.
export const fellPathCandidates = PATH_NEAR;
// The nearest point of the path: distance d, which segment i and how far along it u, and how
// far from the start s (metres).
const _fp = { d: Infinity, i: 0, u: 0, s: 0 };
export function fellPathNear(x, z, out = _fp) {
  out.d = Infinity;
  for (const k of PATH_NEAR(x, z)) {
    const g = PATH_SEGS[k];
    const bax = g.bx - g.ax, baz = g.bz - g.az;
    const u = clamp(((x - g.ax) * bax + (z - g.az) * baz) / (g.len * g.len), 0, 1);
    const d = Math.hypot(x - g.ax - bax * u, z - g.az - baz * u);
    if (d < out.d) {
      out.d = d;
      out.i = k;
      out.u = u;
    }
  }
  return out;
}
export const FELL_PATH_SEGS = PATH_SEGS;

// Land for the old strait: a neck joining the bay's land to the mainland, where the river runs.
export function neckSDF(x, z, n = 0) {
  const { x0, z0, x1, z1, r } = NECK;
  const bax = x1 - x0, baz = z1 - z0;
  const h = clamp(((x - x0) * bax + (z - z0) * baz) / (bax * bax + baz * baz), 0, 1);
  return Math.hypot(x - x0 - bax * h, z - z0 - baz * h) - r + n;
}
