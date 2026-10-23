import * as THREE from 'three';
import { clamp, lerp, smoothstep, fbm } from '../util.js';

// The whole archipelago is one signed-distance function: negative on land, positive on water.
// World axes: +x east, -z north. Water level is y = 0.

export const BAY = { x: 0, z: -10, r: 80 };
export const ISLAND = { x: 8, z: -24, r: 15 };
export const COVE = { x: 140, z: -16, r: 18 };
export const CHANNEL = [
  [140, -4, 151, 14, 4.8],
  [151, 14, 146, 52, 5.2],
];
export const ISLETS = [
  { x: -150, z: 150, r: 11 },
  { x: 95, z: 185, r: 14 },
  { x: 215, z: 110, r: 9 },
  { x: -212, z: 62, r: 12 },
];
export const STACKS = [
  { x: -58, z: 108, r: 4.6, h: 14 },
  { x: -46, z: 117, r: 3.3, h: 10 },
  { x: -66, z: 121, r: 2.7, h: 7 },
];
export const JETTY = { x: 4, z0: -14, z1: 9, halfW: 1.25, deck: 1.15 };
export const START = { x: 12, z: 32, heading: Math.PI };

// Beyond the bay. The coast runs east and west from Willow Bay; the Wend estuary opens to the
// sea in the east, with Longmere, a big inland lake, up a trail from Wend Quay. Out to sea lie
// the Skerries, Gannet Isle with its cove and light, the Long Shoal, and past them the deep water.
// WORLD is the land and sea you can reach; the map and textures cover it.
export const WORLD = { x0: -900, x1: 1100, z0: -1100, z1: 1400 };
export const WATER_RECT = { x: WORLD.x0, z: WORLD.z0, w: WORLD.x1 - WORLD.x0, h: WORLD.z1 - WORLD.z0 };
export const MAP_RECT = { x: -620, z: -700, w: 1380, h: 1700 };
// The old home map (for the hand-drawn bay map in the journal).
export const HOME_RECT = { x: -180, z: -112, w: 375, h: 284 };

// The Wend: a river down from the hills that widens into a sandy, reedy estuary.
// Nodes from upstream to the sea: x, z, half-width, depth.
export const RIVER = [
  [612, -340, 5, 0.6],
  [603, -280, 8, 1.2],
  [588, -215, 14, 2.2],
  [566, -150, 24, 3.0],
  [572, -75, 40, 3.4],
  [556, 0, 62, 3.2],
  [570, 70, 95, 3.6],
  [585, 150, 140, 4.5],
];
// Sandbanks in the lower estuary (some dry in the middle), and marsh islands with side channels.
export const SANDBANKS = [
  { x: 536, z: 26, rx: 26, rz: 9, yaw: 0.35, top: 0.25 },
  { x: 603, z: 78, rx: 34, rz: 11, yaw: -0.2, top: -0.35 },
  { x: 584, z: -40, rx: 16, rz: 6, yaw: 0.1, top: 0.15 },
  { x: 548, z: 108, rx: 30, rz: 10, yaw: 0.5, top: -0.9 },
];
export const MARSH = [
  { x: 545, z: -98, r: 13 },
  { x: 600, z: -10, r: 17 },
  { x: 528, z: 56, r: 10 },
];
// Wend Quay: a stone quay on the west bank where the estuary narrows, with a little camp.
export const WEND_CAMP = { x: 522, z: -170, r: 5 };

// Longmere: a big inland lake. Shallow weedy bays, fallen timber on the north shore, a steep
// drop-off and a deep middle; Heron Holm, a little wooded island; and a boathouse.
export const MERE = { x: 330, z: -470, rx: 150, rz: 82, depth: 14 };
export const MERE_BAYS = [
  { x: 446, z: -520, rx: 48, rz: 30 },
  { x: 214, z: -430, rx: 50, rz: 32 },
  { x: 300, z: -410, rx: 40, rz: 22 },
];
export const HOLM = { x: 360, z: -500, r: 13 };
export const TIMBER = [
  { x: 300, z: -538, yaw: 0.4 }, { x: 352, z: -546, yaw: -0.3 }, { x: 236, z: -505, yaw: 1.1 }, { x: 410, z: -545, yaw: 0.2 },
];
export const BOATHOUSE = { x: 414, z: -404 };

// Out to sea.
export const GANNET = { x: -260, z: 560, r: 84 };
export const PUFFIN_COVE = { x: -252, z: 486, r: 24 };
export const GANNET_CAMP = { x: -246, z: 512, r: 4.5 };
export const LIGHT = { x: -272, z: 604 };
export const SKERRIES = [
  { x: -96, z: 334, r: 5 }, { x: -74, z: 348, r: 3.5 }, { x: -118, z: 352, r: 4 }, { x: -62, z: 322, r: 2.6 }, { x: -104, z: 366, r: 2.4 },
];
export const SKELLIG = { x: 430, z: 770, r: 16 };
export const SHOAL = { x: 300, z: 520, rx: 115, rz: 34, yaw: 0.25, top: -3.6 };
export const DEEP_Z = 860; // past here the seabed falls away to the deep water

// The west shore: a landing on the bay, a camp on the rise behind it, a freshwater lake
// (Reedmere) tucked into the hill, and a stream (Fernbeck) running down to it from the north.
// Everything stays at sea level (y = 0), so the one water surface serves the lake and stream too.
export const CAMP = { x: -99, z: -6, r: 6.5 };
export const LAKE = { x: -133, z: -21, rx: 23, rz: 13.5, depth: 6.2 };
// Stream nodes from the spring down to the lake: x, z, half-width, depth.
export const STREAM = [
  [-151, -86, 1.2, 0.45],
  [-147, -75, 2.6, 1.05],
  [-152, -64, 1.7, 0.3],
  [-148, -53, 2.8, 1.15],
  [-152.5, -43, 1.7, 0.32],
  [-148, -35, 2.7, 1.05],
  [-144, -28, 3.4, 1.5],
];
// Pools along the stream (where trout hold), at the deep nodes.
export const POOLS = [
  { name: 'Spring Pool', node: 1 },
  { name: 'Alder Pool', node: 3 },
  { name: 'Tail Pool', node: 5 },
];
// The path from the landing, past camp, round the lake and up the stream.
export const PATH = [
  [-86, -5.5], [-93, -6.2], [-99, -6], [-105, -2.5], [-112, 1.2], [-123, 3], [-136, 2.2],
  [-147, -1.5], [-155, -7], [-160.5, -16], [-161, -27], [-159, -38], [-159.5, -48],
  [-158.5, -58], [-158, -69], [-157, -79], [-156, -88],
];
// Shore features: a fallen alder in the lake (perch and pike love it) and lily pads in the
// east bay near camp.
export const SNAG = { x: -128, z: -33.5, yaw: 0.35 };
export const LILIES = { x: -114.5, z: -17, r: 7 };
const SHORE_BOX = { x0: -195, x1: -84, z0: -110, z1: 14 };
// The water shader gets a sharper map of this area, so the narrow stream reads properly.
export const SHORE_RECT = { x: -196, z: -112, w: 116, h: 128 };

const sdCircle = (x, z, cx, cz, r) => Math.hypot(x - cx, z - cz) - r;

function sdCapsule(x, z, ax, az, bx, bz, r) {
  const pax = x - ax, paz = z - az, bax = bx - ax, baz = bz - az;
  const h = clamp((pax * bax + paz * baz) / (bax * bax + baz * baz), 0, 1);
  return Math.hypot(pax - bax * h, paz - baz * h) - r;
}

function sdEllipse(x, z, cx, cz, rx, rz) {
  const px = x - cx, pz = z - cz;
  const k0 = Math.hypot(px / rx, pz / rz);
  const k1 = Math.hypot(px / (rx * rx), pz / (rz * rz));
  return (k0 * (k0 - 1)) / Math.max(k1, 1e-6);
}

function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}
const smax = (a, b, k) => -smin(-a, -b, k);

// The coast east and west of the bay: land lies north of coastZ(x).
function coastZ(x) {
  if (x > -300 && x < 300) return -320;
  if (x <= -300) {
    // West: low cliffs and a rocky headland, Heron Point.
    const k = smoothstep(-300, -420, x);
    return lerp(-320, 60, k) + 70 * Math.exp(-(((x + 480) / 45) ** 2)) + fbm(x * 0.01, 3.3, 3) * 40;
  }
  // East: a straight run, the Wend's mouth (carved separately), then on along the coast.
  const k = smoothstep(300, 400, x);
  return lerp(-320, 30, k) + fbm(x * 0.01, 7.1, 3) * 40 + 20 * Math.sin(x * 0.006);
}

export function landSDF(x, z) {
  const n1 = fbm(x * 0.021, z * 0.021, 3);
  const n2 = fbm(x * 0.08 + 5.2, z * 0.08 - 3.1, 2);
  // Mainland that wraps around the bay, joined to the coast running east and west.
  let d = sdEllipse(x, z, 0, -95, 235, 150) + n1 * 12 + n2 * 2;
  d = smin(d, (z - coastZ(x)) + n1 * 10 + n2 * 2, 40);
  // Gannet Isle, with Puffin Cove cut into its north side.
  if (Math.abs(x - GANNET.x) < 160 && Math.abs(z - GANNET.z) < 160) {
    const ng = fbm(x * 0.05 + 11, z * 0.05 - 4, 3);
    d = smin(d, sdEllipse(x, z, GANNET.x, GANNET.z, GANNET.r, GANNET.r * 0.78) + ng * 10 + n2 * 3, 10);
    d = smax(d, -(sdCircle(x, z, PUFFIN_COVE.x, PUFFIN_COVE.z, PUFFIN_COVE.r) + n2 * 2), 8);
    d = smax(d, -sdCapsule(x, z, PUFFIN_COVE.x, PUFFIN_COVE.z, PUFFIN_COVE.x + 8, PUFFIN_COVE.z - 60, 9 + n2 * 2), 6);
  }
  for (const s of SKERRIES) d = smin(d, sdCircle(x, z, s.x, s.z, s.r) + n2 * 1.8, 2);
  d = smin(d, sdCircle(x, z, SKELLIG.x, SKELLIG.z, SKELLIG.r) + n2 * 4, 3);
  // The bay itself, open to the south
  d = smax(d, -(sdCircle(x, z, BAY.x, BAY.z, BAY.r) + n1 * 7 + n2 * 1.5), 10);
  // Little island with the jetty
  d = smin(d, sdCircle(x, z, ISLAND.x, ISLAND.z, ISLAND.r) + n2 * 2.2, 5);
  // Far islets on the horizon
  for (const s of ISLETS) d = smin(d, sdCircle(x, z, s.x, s.z, s.r) + n2 * 2.5, 4);
  // Hidden cove behind the eastern headland, reached by a winding channel
  d = smax(d, -(sdCircle(x, z, COVE.x, COVE.z, COVE.r) + n2 * 1.4), 6);
  for (const c of CHANNEL) d = smax(d, -(sdCapsule(x, z, c[0], c[1], c[2], c[3], c[4]) + n2 * 0.5), 3);
  return d;
}

function baseHeight(x, z) {
  const d = landSDF(x, z);
  if (d >= 0) {
    let h = -0.6 - 9 * (1 - Math.exp(-d / 13));
    h -= 7 * smoothstep(25, 90, d);
    // Far from land the shelf slopes on down, and past DEEP_Z it falls away to the deep water.
    h -= 14 * smoothstep(140, 420, d) * smoothstep(120, 300, z);
    h -= 30 * smoothstep(DEEP_Z - 60, DEEP_Z + 200, z);
    h += fbm(x * 0.06, z * 0.06, 2) * 0.5 * smoothstep(0, 5, d);
    // The Long Shoal: a sandbank a few metres down, out in the open.
    const sx = x - SHOAL.x, sz = z - SHOAL.z;
    if (Math.abs(sx) < SHOAL.rx * 1.6 && Math.abs(sz) < SHOAL.rx * 1.6) {
      const c = Math.cos(SHOAL.yaw), sn = Math.sin(SHOAL.yaw);
      const u = (sx * c - sz * sn) / SHOAL.rx, v = (sx * sn + sz * c) / SHOAL.rz;
      const k = smoothstep(1.6, 0.7, Math.hypot(u, v));
      h = lerp(h, Math.max(h, SHOAL.top + fbm(x * 0.07, z * 0.07, 2) * 1.2), k);
    }
    return h;
  }
  const inland = -d;
  let h = -0.6 + 2.2 * smoothstep(0, 9, inland);
  const hill = smoothstep(4, 50, inland);
  const n = fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 4) * 0.5 + 0.5;
  h += hill * (4 + 30 * n * n + 5 * fbm(x * 0.045, z * 0.045, 3));
  // a soft hump in the middle of the jetty island
  const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  h += 2.2 * smoothstep(ISLAND.r + 2, 0, di);
  return h;
}

/* ---------------- the west shore: lake, stream, camp and path ---------------- */

// Signed distance to the lake shore (negative on the water), with a slightly wobbly edge.
export function lakeSDF(x, z) {
  // Scaled-circle distance: close enough near the shore, and well behaved at the middle.
  const d = (Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz) - 1) * LAKE.rz;
  if (d > 30) return d;
  return d + fbm(x * 0.07 + 21, z * 0.07 - 8, 2) * 2.6;
}

// Closest point on the stream: distance from its centre line, plus the local width, depth and flow direction.
const _st = { d: 0, hw: 1, dep: 0.5, tx: 0, tz: 1, t: 0 };
export function streamInfo(x, z, out = _st) {
  out.d = Infinity;
  for (let i = 0; i < STREAM.length - 1; i++) {
    const a = STREAM[i], b = STREAM[i + 1];
    const bax = b[0] - a[0], baz = b[1] - a[1];
    const len2 = bax * bax + baz * baz;
    const h = clamp(((x - a[0]) * bax + (z - a[1]) * baz) / len2, 0, 1);
    const d = Math.hypot(x - a[0] - bax * h, z - a[1] - baz * h);
    if (d < out.d) {
      const k = smoothstep(0, 1, h);
      const l = Math.sqrt(len2);
      out.d = d;
      out.hw = lerp(a[2], b[2], k);
      out.dep = lerp(a[3], b[3], k);
      out.tx = bax / l;
      out.tz = baz / l;
      out.t = (i + h) / (STREAM.length - 1);
    }
  }
  // A little meander so the banks are not ruler-straight.
  out.d += fbm(x * 0.11 - 3, z * 0.11 + 9, 2) * 0.7;
  return out;
}
export const streamSDF = (x, z) => {
  const s = streamInfo(x, z);
  return s.d - s.hw;
};

// The current: fastest in the narrow riffles, lazy in the pools. Zero outside the stream.
export function streamFlow(x, z, out = { x: 0, z: 0 }) {
  out.x = 0;
  out.z = 0;
  if (x < SHORE_BOX.x0 || x > SHORE_BOX.x1 || z < SHORE_BOX.z0 || z > SHORE_BOX.z1) return out;
  const s = streamInfo(x, z);
  if (s.d > s.hw + 0.5) return out;
  const speed = (0.2 + 0.8 / (s.hw * Math.max(s.dep, 0.3) + 0.4)) * (1 - smoothstep(0.65, 1.05, s.t + lakeFade(x, z)));
  const edge = 1 - smoothstep(s.hw * 0.4, s.hw + 0.5, s.d);
  out.x = s.tx * speed * edge;
  out.z = s.tz * speed * edge;
  return out;
}
const lakeFade = (x, z) => smoothstep(4, -4, lakeSDF(x, z)) * 0.6;

// Distance to the walking path (and how far along it), used for flattening, colour and trees.
let pathH = null;
const _pi = { d: 0, h: 0 };
export function pathInfo(x, z, out = _pi) {
  out.d = Infinity;
  out.h = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    const bax = b[0] - a[0], baz = b[1] - a[1];
    const hh = clamp(((x - a[0]) * bax + (z - a[1]) * baz) / (bax * bax + baz * baz), 0, 1);
    const d = Math.hypot(x - a[0] - bax * hh, z - a[1] - baz * hh);
    if (d < out.d) {
      out.d = d;
      if (pathH) out.h = lerp(pathH[i], pathH[i + 1], hh);
    }
  }
  return out;
}

// The lake and stream are carved into the land; the camp is a level clearing; the path is smoothed.
function shoreHeight(x, z, h, withPath) {
  const dl = lakeSDF(x, z);
  if (dl < 40) {
    if (dl < 0) {
      // Steep drop-off along the north shore, a long shallow shelf in the south-west.
      const ramp = lerp(4.5, 15, smoothstep(-9, 9, (z - LAKE.z) - (x - LAKE.x) * 0.45));
      // The bed starts level with the bank (no lip at the waterline) and falls away from there.
      const bed = 0.05 - (LAKE.depth + 0.05) * smoothstep(0, ramp, -dl) + fbm(x * 0.2, z * 0.2, 2) * 0.25 * smoothstep(0, 2.5, -dl);
      h = Math.min(h, bed);
    } else {
      const north = smoothstep(2, -10, z - LAKE.z);
      h = Math.min(h, 0.06 + dl * lerp(0.16, 0.55, north) + dl * dl * lerp(0.01, 0.05, north));
    }
  }
  const s = streamInfo(x, z);
  if (s.d < s.hw + 40) {
    const e = s.d - s.hw;
    let c;
    if (e < 0) {
      const u = s.d / s.hw;
      c = 0.1 - (s.dep + 0.1) * (1 - u * u) + fbm(x * 0.6, z * 0.6, 2) * 0.08 * (1 - u * u);
    } else {
      // A low, walkable strip beside the water, then the valley sides.
      c = 0.12 + e * 0.2 + Math.max(0, e - 3.5) * 0.36 + Math.max(0, e - 11) ** 2 * 0.018;
    }
    h = Math.min(h, c);
  }
  // The camp clearing
  const dc = Math.hypot(x - CAMP.x, z - CAMP.z);
  if (dc < CAMP.r + 6) h = lerp(campH, h, smoothstep(CAMP.r - 1, CAMP.r + 6, dc));
  if (withPath) {
    const p = pathInfo(x, z);
    if (p.d < 4) h = lerp(p.h, h, smoothstep(1.2, 4, p.d));
  }
  return h;
}
let campH = 4;

export function heightAt(x, z) {
  let h = baseHeight(x, z);
  if (x > SHORE_BOX.x0 && x < SHORE_BOX.x1 && z > SHORE_BOX.z0 && z < SHORE_BOX.z1) return shoreHeight(x, z, h, true);
  if (x > EST_BOX.x0 && x < EST_BOX.x1 && z > EST_BOX.z0 && z < EST_BOX.z1) h = estuaryHeight(x, z, h);
  if (x > MERE_BOX.x0 && x < MERE_BOX.x1 && z > MERE_BOX.z0 && z < MERE_BOX.z1) h = mereHeight(x, z, h);
  if (x > TRAIL_BOX.x0 && x < TRAIL_BOX.x1 && z > TRAIL_BOX.z0 && z < TRAIL_BOX.z1) {
    const p = trailInfo(x, z);
    if (p.d < 4) h = lerp(p.h, h, smoothstep(1.2, 4, p.d));
  }
  if (Math.abs(x - GANNET_CAMP.x) < 14 && Math.abs(z - GANNET_CAMP.z) < 14) {
    h = lerp(gannetCampH, h, smoothstep(GANNET_CAMP.r - 1, GANNET_CAMP.r + 5, Math.hypot(x - GANNET_CAMP.x, z - GANNET_CAMP.z)));
  }
  return h;
}

/* ---------------- the Wend estuary ---------------- */

const EST_BOX = { x0: 380, x1: 790, z0: -380, z1: 330 };
const _ri = { d: 0, hw: 1, dep: 1, t: 0, tx: 0, tz: 1 };
// Closest point on the river: distance from its centre line, local half-width, depth and direction.
export function riverInfo(x, z, out = _ri) {
  out.d = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const a = RIVER[i], b = RIVER[i + 1];
    const bax = b[0] - a[0], baz = b[1] - a[1];
    const len2 = bax * bax + baz * baz;
    const h = clamp(((x - a[0]) * bax + (z - a[1]) * baz) / len2, 0, 1);
    const d = Math.hypot(x - a[0] - bax * h, z - a[1] - baz * h);
    if (d < out.d) {
      const k = smoothstep(0, 1, h), l = Math.sqrt(len2);
      out.d = d;
      out.hw = lerp(a[2], b[2], k);
      out.dep = lerp(a[3], b[3], k);
      out.t = (i + h) / (RIVER.length - 1);
      out.tx = bax / l;
      out.tz = baz / l;
    }
  }
  out.d += fbm(x * 0.03 + 4, z * 0.03 - 2, 2) * 9;
  return out;
}
export const riverSDF = (x, z) => {
  if (x < EST_BOX.x0 || x > EST_BOX.x1 || z < EST_BOX.z0 || z > EST_BOX.z1) return 999;
  const r = riverInfo(x, z);
  return r.d - r.hw;
};

function estuaryHeight(x, z, h) {
  const r = riverInfo(x, z);
  const e = r.d - r.hw;
  if (e > 60) return h;
  let c;
  if (e < 0) {
    // The channel: deepest in the middle, shelving up to mudflats at the edges.
    const u = clamp(r.d / r.hw, 0, 1);
    c = 0.05 - (r.dep + 0.05) * Math.pow(1 - u * u, 0.8) + fbm(x * 0.12, z * 0.12, 2) * 0.35 * (1 - u);
  } else {
    // Mudflats and saltmarsh, then the valley sides.
    c = 0.08 + e * 0.05 + Math.max(0, e - 12) * 0.22 + Math.max(0, e - 30) ** 2 * 0.012;
  }
  h = Math.min(h, c);
  for (const b of SANDBANKS) {
    const dx = x - b.x, dz = z - b.z;
    if (Math.abs(dx) > b.rx * 1.8 || Math.abs(dz) > b.rx * 1.8) continue;
    const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
    const u = (dx * cs - dz * sn) / b.rx, v = (dx * sn + dz * cs) / b.rz;
    const k = smoothstep(1.4, 0.55, Math.hypot(u, v));
    h = Math.max(h, lerp(h, b.top + fbm(x * 0.2, z * 0.2, 2) * 0.2, k));
  }
  for (const m of MARSH) {
    const dm = Math.hypot(x - m.x, z - m.z) + fbm(x * 0.08, z * 0.08, 2) * 5;
    if (dm < m.r + 8) h = Math.max(h, lerp(-1.2, 0.75, smoothstep(m.r + 6, m.r - 3, dm)));
  }
  // The quay sits on firm ground with deep water alongside.
  const dq = Math.hypot(x - WEND_CAMP.x, z - WEND_CAMP.z);
  if (dq < WEND_CAMP.r + 8) h = lerp(wendCampH, h, smoothstep(WEND_CAMP.r - 1, WEND_CAMP.r + 8, dq));
  return h;
}
const estuaryCarved = (x, z) => estuaryHeight(x, z, baseHeight(x, z));
const wendCampH = 1.6;

/* ---------------- Longmere ---------------- */

const MERE_BOX = { x0: 120, x1: 540, z0: -620, z1: -320 };
export function mereSDF(x, z) {
  if (x < MERE_BOX.x0 || x > MERE_BOX.x1 || z < MERE_BOX.z0 || z > MERE_BOX.z1) return 999;
  let d = (Math.hypot((x - MERE.x) / MERE.rx, (z - MERE.z) / MERE.rz) - 1) * MERE.rz;
  for (const b of MERE_BAYS) d = smin(d, (Math.hypot((x - b.x) / b.rx, (z - b.z) / b.rz) - 1) * b.rz, 18);
  d += fbm(x * 0.04 + 31, z * 0.04 - 5, 3) * 9;
  // Heron Holm stands out of the water.
  d = smax(d, -(Math.hypot(x - HOLM.x, z - HOLM.z) - HOLM.r + fbm(x * 0.15, z * 0.15, 2) * 3), 4);
  return d;
}

function mereHeight(x, z, h) {
  const dl = mereSDF(x, z);
  if (dl > 70) return h;
  if (dl < 0) {
    // Gentle weedy bays to the south and in the lobes; a steep drop-off along the north shore.
    const north = smoothstep(MERE.z + 10, MERE.z - 40, z);
    const inBay = MERE_BAYS.some((b) => Math.hypot((x - b.x) / b.rx, (z - b.z) / b.rz) < 0.9);
    const ramp = inBay ? 55 : lerp(32, 9, north);
    const bed = 0.05 - (MERE.depth + 0.05) * smoothstep(0, ramp, -dl) * (inBay ? 0.22 : 1) + fbm(x * 0.12, z * 0.12, 2) * 0.5 * smoothstep(0, 3, -dl);
    return Math.min(h, bed);
  }
  // The holm: a low wooded hump.
  const dh = Math.hypot(x - HOLM.x, z - HOLM.z);
  if (dh < HOLM.r + 4) return Math.max(0.1, Math.min(h, 0.06 + dl * 0.35 + smoothstep(HOLM.r, 0, dh) * 3));
  const steep = smoothstep(MERE.z, MERE.z - 60, z);
  return Math.min(h, 0.06 + dl * lerp(0.14, 0.45, steep) + dl * dl * lerp(0.006, 0.03, steep));
}

/* ---------------- trails ---------------- */

// From Wend Quay up the valley and over the hill to the Longmere boathouse.
export const WEND_TRAIL = [
  [526, -170], [512, -205], [500, -248], [486, -292], [470, -334], [458, -366], [440, -394], [420, -402],
];
const TRAIL_BOX = { x0: 430, x1: 560, z0: -420, z1: -140 };
let trailH = null;
const _ti = { d: 0, h: 0 };
export function trailInfo(x, z, out = _ti) {
  out.d = Infinity;
  out.h = 0;
  const P = WEND_TRAIL;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1];
    const bax = b[0] - a[0], baz = b[1] - a[1];
    const hh = clamp(((x - a[0]) * bax + (z - a[1]) * baz) / (bax * bax + baz * baz), 0, 1);
    const d = Math.hypot(x - a[0] - bax * hh, z - a[1] - baz * hh);
    if (d < out.d) {
      out.d = d;
      if (trailH) out.h = lerp(trailH[i], trailH[i + 1], hh);
    }
  }
  return out;
}
{
  const raw = WEND_TRAIL.map(([x, z]) => mereHeight(x, z, estuaryCarved(x, z)));
  trailH = raw.map((h, i) => {
    if (i === 0 || i === raw.length - 1) return Math.max(0.4, h);
    return Math.max(0.4, (raw[i - 1] + h * 2 + raw[i + 1]) / 4);
  });
}
const gannetCampH = Math.max(1.4, baseHeight(GANNET_CAMP.x, GANNET_CAMP.z));

// The landing: a short pier out from the beach, due east of camp.
campH = Math.max(2.4, baseHeight(CAMP.x, CAMP.z) - 0.4);
const carvedHeight = (x, z) => shoreHeight(x, z, baseHeight(x, z), false);
export const LANDING = (() => {
  const z = -5.5;
  let x = -70;
  while (x > -100 && carvedHeight(x, z) < 0.05) x -= 0.25;
  return { x, z, deck: 0.95, len: 10 };
})();

// Path heights come from the carved land under each node, smoothed a little. The path
// starts on the pier's land end, level with its deck, so you walk straight off it.
PATH[0] = [LANDING.x - 2.2, LANDING.z];
{
  const raw = PATH.map(([x, z]) => carvedHeight(x, z));
  raw[0] = LANDING.deck;
  pathH = raw.map((h, i) => {
    if (i === 0 || i === raw.length - 1) return Math.max(0.35, h);
    const a = raw[i - 1], b = raw[i + 1];
    return Math.max(0.35, (a + h * 2 + b) / 4);
  });
}

// A pier from the shore out along an axis (dx, dz) to water deep enough to tie up a boat.
// Starts a few metres back on dry ground; returns its box and its two ends.
function pierAlong(x, z, dx, dz, { width = 2.2, deep = 1.4, deck = 0.95, max = 40 } = {}) {
  let shore = 0;
  while (shore < max && heightAt(x + dx * shore, z + dz * shore) > 0.3) shore += 0.5;
  let end = shore;
  while (end < shore + 25 && heightAt(x + dx * end, z + dz * end) > -deep) end += 0.5;
  end += 1.5;
  const a = { x: x + dx * (shore - 3), z: z + dz * (shore - 3) }, b = { x: x + dx * end, z: z + dz * end };
  const hw = width / 2;
  return {
    x0: Math.min(a.x, b.x) - (dx ? 0 : hw), x1: Math.max(a.x, b.x) + (dx ? 0 : hw),
    z0: Math.min(a.z, b.z) - (dz ? 0 : hw), z1: Math.max(a.z, b.z) + (dz ? 0 : hw),
    deck, land: a, end: b, dir: { x: dx, z: dz },
  };
}
export const QUAY = pierAlong(WEND_CAMP.x + 4, WEND_CAMP.z, 1, 0, { width: 3, deck: 1.0 });
export const BOATHOUSE_PIER = pierAlong(BOATHOUSE.x + 4, BOATHOUSE.z, -1, 0, { width: 2, deck: 0.7 });
export const COVE_PIER = pierAlong(GANNET_CAMP.x, GANNET_CAMP.z - 2, 0, -1, { width: 2, deck: 0.8 });

// Walkable decks the boat bumps into: [x0, x1, z0, z1, deck height].
export const PIERS = [
  { x0: JETTY.x - JETTY.halfW, x1: JETTY.x + JETTY.halfW, z0: JETTY.z0, z1: JETTY.z1, deck: JETTY.deck },
  { x0: LANDING.x - 2.5, x1: LANDING.x + LANDING.len, z0: LANDING.z - 0.9, z1: LANDING.z + 0.9, deck: LANDING.deck },
  // Wend Quay running out east into the estuary, the Longmere boathouse jetty, and the little
  // landing in Puffin Cove.
  QUAY, BOATHOUSE_PIER, COVE_PIER,
];

// Where the lake meets the land, walking out from its centre at an angle.
export function lakeShore(angle, inset = 0) {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  let r = 0;
  while (r < 60 && lakeSDF(LAKE.x + dx * r, LAKE.z + dz * r) < 0) r += 0.25;
  r -= inset;
  return { x: LAKE.x + dx * r, z: LAKE.z + dz * r, angle };
}

// Little wooden platforms on the lake shore: one by the lily pads near camp,
// one on the shallow south-west shelf where the carp feed.
export const PEGS = [
  { name: 'Lily Peg', ...lakeShore(1.3, 1.0) },
  { name: 'Willow Swim', ...lakeShore(Math.PI * 0.72, 1.2) },
];
const STREAM_AT = (i, k) => {
  const a = STREAM[i], b = STREAM[i + 1];
  return { x: lerp(a[0], b[0], k), z: lerp(a[1], b[1], k), yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
};
// A plank bridge over the top riffle, stepping stones over the lower one.
export const BRIDGE = { ...STREAM_AT(2, 0.0), len: 6.4, w: 1.3, deck: 0.75 };
export const STONES = STREAM_AT(4, 0.0);

// Everything you can stand on that is not the ground: piers, pegs, the bridge.
// Each deck is a box centred on (x, z), turned by yaw (its local z points along yaw, like a heading),
// with half sizes hx (local x) and hz (local z).
export const DECKS = [
  ...PIERS.map((p) => ({ x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2, hx: (p.x1 - p.x0) / 2, hz: (p.z1 - p.z0) / 2, yaw: 0, deck: p.deck })),
  ...PEGS.map((p) => ({ x: p.x, z: p.z, hx: 1.1, hz: 1.1, yaw: p.angle, deck: 0.32 })),
  { x: BRIDGE.x, z: BRIDGE.z, hx: BRIDGE.len / 2, hz: BRIDGE.w / 2, yaw: BRIDGE.yaw, deck: BRIDGE.deck },
];

// Ground height for someone on foot, including decks.
export function walkHeight(x, z) {
  let h = heightAt(x, z);
  for (const d of DECKS) {
    const dx = x - d.x, dz = z - d.z;
    if (Math.abs(dx) > d.hx + d.hz || Math.abs(dz) > d.hx + d.hz) continue;
    const c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    const u = dx * c - dz * s, v = dx * s + dz * c;
    if (Math.abs(u) <= d.hx && Math.abs(v) <= d.hz) h = Math.max(h, d.deck);
  }
  return h;
}

export function stackHeight(x, z) {
  let h = -100;
  for (const s of STACKS) h = Math.max(h, 2.5 - (Math.hypot(x - s.x, z - s.z) - s.r) * 1.1);
  return h;
}

// Height including the sea stacks, used for collisions and the water shader.
export const solidHeight = (x, z) => Math.max(heightAt(x, z), stackHeight(x, z));

// Fresh water first: Reedmere, Fernbeck and Longmere are their own little worlds.
export function freshZone(x, z) {
  if (x > MERE_BOX.x0 && x < MERE_BOX.x1 && z > MERE_BOX.z0 && z < MERE_BOX.z1) return mereSDF(x, z) < 3 ? 'mere' : null;
  if (x < SHORE_BOX.x0 || x > SHORE_BOX.x1 || z < SHORE_BOX.z0 || z > SHORE_BOX.z1) return null;
  if (lakeSDF(x, z) < 3) return 'lake';
  if (streamSDF(x, z) < 2) return 'stream';
  return null;
}

// Which water a point is in. Fish live in some of these and not others: fresh water (lake,
// stream, mere), the brackish estuary, and the sea (bay, cove, open, coast, deep).
export function zoneAt(x, z) {
  const fresh = freshZone(x, z);
  if (fresh) return fresh;
  if (riverSDF(x, z) < 6 && z < 175) return 'estuary';
  if (Math.hypot(x - COVE.x, z - COVE.z) < COVE.r + 4) return 'cove';
  for (const c of CHANNEL) if (sdCapsule(x, z, c[0], c[1], c[2], c[3], c[4]) < -1) return 'cove';
  if (Math.hypot(x - BAY.x, z - BAY.z) < BAY.r + 4) return 'bay';
  if (z > DEEP_Z) return 'deep';
  if (z > 260 || x < -300 || x > 300) return 'coast';
  return 'open';
}
export const SALT_ZONES = ['bay', 'cove', 'open', 'coast', 'deep'];
export const waterOf = (zone) => (zone === 'lake' || zone === 'stream' || zone === 'mere' ? 'fresh' : zone === 'estuary' ? 'brackish' : 'salt');

export const ZONE_NAMES = {
  bay: 'Willow Bay', cove: 'Driftwood Cove', open: 'open water', lake: 'Reedmere', stream: 'Fernbeck',
  estuary: 'the Wend estuary', mere: 'Longmere', coast: 'the outer coast', deep: 'the deep water',
};

export const PLACES = [
  {
    id: 'bay', name: 'Willow Bay', sub: 'home waters',
    note: 'Home waters. Calm and sheltered, with sunperch flashing in the shallows.',
    x: -38, z: -30, area: true,
    test: (x, z) => zoneAt(x, z) === 'bay',
  },
  {
    id: 'jetty', name: 'The Old Jetty', sub: 'someone used to tie up here',
    note: 'Weathered planks on the little island. One board is missing, and the lamp still comes on at dusk.',
    x: JETTY.x, z: JETTY.z1,
    test: (x, z) => Math.hypot(x - JETTY.x, z - (JETTY.z0 + JETTY.z1) / 2) < 22,
  },
  {
    id: 'cove', name: 'Driftwood Cove', sub: 'a quiet place, out of the wind',
    note: 'Tucked behind the eastern headland. Bleached logs, shells, and a deep hush.',
    x: COVE.x, z: COVE.z,
    test: (x, z) => Math.hypot(x - COVE.x, z - COVE.z) < COVE.r + 2,
  },
  {
    id: 'landing', name: 'The Landing', sub: 'a mooring post and a few planks', dock: true,
    note: 'A short pier on the west shore of the bay. Tie up here: camp is just up the path.',
    x: -86, z: -5.5,
    test: (x, z) => Math.hypot(x - LANDING.x, z - LANDING.z) < 16,
  },
  {
    id: 'camp', name: 'Camp', sub: 'a tent, a fire ring, and the kettle', labelLeft: true, camp: true,
    note: 'Your tent on the rise between the bay and the lake. Tackle box, fire and a dry bed.',
    x: CAMP.x, z: CAMP.z,
    test: (x, z) => Math.hypot(x - CAMP.x, z - CAMP.z) < 12,
  },
  {
    id: 'lake', name: 'Reedmere', sub: 'still water behind the hill',
    note: 'A freshwater lake: lily pads by camp, a fallen alder on the steep north shore, a shallow silty shelf in the south-west.',
    x: LAKE.x, z: LAKE.z + 2, area: true, size: 26,
    test: (x, z) => lakeSDF(x, z) < 6,
  },
  {
    id: 'stream', name: 'Fernbeck', sub: 'a clear stream under the alders',
    note: 'Runs down from a spring into Reedmere. Three pools, with fast shallow riffles between.',
    x: STREAM[3][0] - 14, z: STREAM[3][1],
    test: (x, z) => streamSDF(x, z) < 7,
  },
  {
    id: 'wend', name: 'The Wend', sub: 'where the river meets the sea', area: true, size: 30,
    note: 'A wide, shallow estuary: sandbanks, mudflats and reeds, with the tide of salt and fresh water mixing. Mullet, flounder and sea bass come in on the current.',
    x: 572, z: -20, region: 'estuary',
    test: (x, z) => riverSDF(x, z) < 12 && z < 175,
  },
  {
    id: 'quay', name: 'Wend Quay', sub: 'old stones, a mooring ring, a little camp', camp: true, dock: true,
    note: 'A stone quay where the estuary narrows, with a tent pitch and a tackle box. The trail to Longmere starts here.',
    x: WEND_CAMP.x, z: WEND_CAMP.z, region: 'estuary',
    test: (x, z) => Math.hypot(x - WEND_CAMP.x, z - WEND_CAMP.z) < 22,
  },
  {
    id: 'saltings', name: 'The Saltings', sub: 'reedy channels between the marsh islands',
    note: 'Narrow, sheltered channels between low marsh islands. Quiet water for a kayak, and mullet nosing along the edges.',
    x: MARSH[0].x, z: MARSH[0].z, region: 'estuary',
    test: (x, z) => MARSH.some((m) => Math.hypot(x - m.x, z - m.z) < m.r + 18),
  },
  {
    id: 'mere', name: 'Longmere', sub: 'a long lake among the hills', area: true, size: 34,
    note: 'A big inland lake: weedy bays, a steep north shore with drowned oaks, and deep water in the middle. Largemouth bass in the shallows, pike in the weed, perch everywhere.',
    x: MERE.x, z: MERE.z, region: 'mere',
    test: (x, z) => mereSDF(x, z) < 8,
  },
  {
    id: 'boathouse', name: 'Mere Boathouse', sub: 'a jetty, a bass boat and a tackle box', dock: true, camp: true,
    note: 'A tarred boathouse on the south-east shore of Longmere, with a jetty, a tackle locker and a bunk. The bass boat lives here.',
    x: BOATHOUSE.x, z: BOATHOUSE.z, region: 'mere',
    test: (x, z) => Math.hypot(x - BOATHOUSE.x, z - BOATHOUSE.z) < 20,
  },
  {
    id: 'holm', name: 'Heron Holm', sub: 'a wooded islet in the lake',
    note: 'A little island of alders in the middle of Longmere. A heron stands guard on the shingle; the deep water drops away all round.',
    x: HOLM.x, z: HOLM.z, region: 'mere',
    test: (x, z) => Math.hypot(x - HOLM.x, z - HOLM.z) < HOLM.r + 26,
  },
  {
    id: 'oaks', name: 'The Drowned Oaks', sub: 'old trees fallen into deep water',
    note: 'Along Longmere’s steep north shore, oaks have toppled into the water. Big pike and bass lie among the branches.',
    x: TIMBER[0].x, z: TIMBER[0].z, region: 'mere',
    test: (x, z) => TIMBER.some((t) => Math.hypot(x - t.x, z - t.z) < 26),
  },
  {
    id: 'gannet', name: 'Gannet Isle', sub: 'an island out past the Skerries', area: true, size: 26,
    note: 'A green island with rocky points, kelp and reef all round it. Wrasse on the reef, bass in the surf, mackerel out in the tide.',
    x: GANNET.x, z: GANNET.z, region: 'coast',
    test: (x, z) => Math.hypot(x - GANNET.x, z - GANNET.z) < GANNET.r + 40,
  },
  {
    id: 'puffin', name: 'Puffin Cove', sub: 'a sheltered anchorage and a camp', camp: true, dock: true,
    note: 'A deep, sheltered cove on Gannet Isle’s north side: a landing stage, a bivouac and a tackle box. Squid come to the lights here after dark.',
    x: PUFFIN_COVE.x, z: PUFFIN_COVE.z, region: 'coast',
    test: (x, z) => Math.hypot(x - PUFFIN_COVE.x, z - PUFFIN_COVE.z) < PUFFIN_COVE.r + 16,
  },
  {
    id: 'light', name: 'Gannet Light', sub: 'a little white lighthouse',
    note: 'On the island’s southern point. Its lamp turns all night, and the deep water starts not far beyond.',
    x: LIGHT.x, z: LIGHT.z, region: 'coast',
    test: (x, z) => Math.hypot(x - LIGHT.x, z - LIGHT.z) < 55,
  },
  {
    id: 'skerries', name: 'The Skerries', sub: 'black rocks and white water',
    note: 'A broken reef halfway out to Gannet Isle. Wrasse among the kelp, mackerel passing over; seals sometimes sleep on the rocks.',
    x: SKERRIES[0].x, z: SKERRIES[0].z, region: 'coast',
    test: (x, z) => SKERRIES.some((k) => Math.hypot(x - k.x, z - k.z) < 40),
  },
  {
    id: 'shoal', name: 'Long Shoal', sub: 'a sandbank far out in the open',
    note: 'Only a few metres deep, far from any shore. Plaice on the sand, and mackerel shoals that birds give away.',
    x: SHOAL.x, z: SHOAL.z, region: 'coast',
    test: (x, z) => Math.hypot((x - SHOAL.x) / SHOAL.rx, (z - SHOAL.z) / SHOAL.rz) < 1.4,
  },
  {
    id: 'skellig', name: 'Little Skellig', sub: 'a lone rock out in the tide',
    note: 'A rock with nothing but birds on it, on the way out to the deep water. A good mark to steer by.',
    x: SKELLIG.x, z: SKELLIG.z, region: 'coast',
    test: (x, z) => Math.hypot(x - SKELLIG.x, z - SKELLIG.z) < 45,
  },
  {
    id: 'deep', name: 'The Blue Water', sub: 'deep sea, far from land', area: true, size: 30,
    note: 'Past the shelf the sea turns dark blue and the bottom drops beyond sixty metres. Watch for birds diving: tuna drive the bait shoals to the top.',
    x: 120, z: DEEP_Z + 160, region: 'deep',
    test: (x, z) => z > DEEP_Z + 40,
  },
  {
    id: 'heron', name: 'Heron Point', sub: 'the western headland',
    note: 'A rocky point on the west coast, with surf on its ledges. Sea bass hunt in the white water.',
    x: -480, z: 110, region: 'coast',
    test: (x, z) => Math.hypot(x + 480, z - 110) < 70,
  },
  {
    id: 'gull', name: 'Gull Rock', sub: 'where the water turns deep',
    note: 'Sea stacks past the bay mouth. The water goes dark blue here, and the gulls never stop talking.',
    x: STACKS[0].x, z: STACKS[0].z,
    test: (x, z) => Math.hypot(x - STACKS[0].x, z - STACKS[0].z) < 34,
  },
];

// Walk outward from a point until the ground rises above minH.
export function findShore(cx, cz, angle, minH = 0.3, maxR = 80) {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  for (let r = 0; r < maxR; r += 0.25) {
    const x = cx + dx * r, z = cz + dz * r;
    if (heightAt(x, z) > minH) return { x, z, r };
  }
  return null;
}

// The water shader's map of the world: R = ground height, G = fresh water (lake and stream),
// B/A = the stream's current, so it can tint, calm and set the water flowing.
export function bakeHeightTexture(size = 512, rect = WATER_RECT, sizeZ = size) {
  const data = new Uint16Array(size * sizeZ * 4);
  const flow = { x: 0, z: 0 };
  const toHalf = THREE.DataUtils.toHalfFloat;
  for (let j = 0; j < sizeZ; j++) {
    const z = rect.z + ((j + 0.5) / sizeZ) * rect.h;
    for (let i = 0; i < size; i++) {
      const x = rect.x + ((i + 0.5) / size) * rect.w;
      const o = (j * size + i) * 4;
      data[o] = toHalf(clamp(solidHeight(x, z), -60, 60));
      data[o + 1] = toHalf(freshness(x, z));
      streamFlow(x, z, flow);
      data[o + 2] = toHalf(flow.x);
      data[o + 3] = toHalf(flow.z);
    }
  }
  const tex = new THREE.DataTexture(data, size, sizeZ, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// 1 on the lakes and stream, 0 on the sea; the estuary is brackish, fresher upstream.
export function freshness(x, z) {
  if (x > MERE_BOX.x0 && x < MERE_BOX.x1 && z > MERE_BOX.z0 && z < MERE_BOX.z1) return smoothstep(6, 0, mereSDF(x, z));
  if (x > EST_BOX.x0 && x < EST_BOX.x1 && z > EST_BOX.z0 && z < EST_BOX.z1) {
    const r = riverInfo(x, z);
    return smoothstep(10, 0, r.d - r.hw) * clamp(1.15 - r.t * 1.1, 0.12, 1) * 0.75;
  }
  if (x < SHORE_BOX.x0 || x > SHORE_BOX.x1 || z < SHORE_BOX.z0 || z > SHORE_BOX.z1) return 0;
  return Math.max(smoothstep(6, 0, lakeSDF(x, z)), smoothstep(4, 0, streamSDF(x, z)));
}
