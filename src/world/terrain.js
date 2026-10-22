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
export const WATER_RECT = { x: -360, z: -390, w: 720, h: 720 };
export const MAP_RECT = { x: -180, z: -112, w: 375, h: 284 };

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

export function landSDF(x, z) {
  const n1 = fbm(x * 0.021, z * 0.021, 3);
  const n2 = fbm(x * 0.08 + 5.2, z * 0.08 - 3.1, 2);
  // Mainland that wraps around the bay
  let d = sdEllipse(x, z, 0, -95, 235, 150) + n1 * 12 + n2 * 2;
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
    h += fbm(x * 0.06, z * 0.06, 2) * 0.5 * smoothstep(0, 5, d);
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
  const h = baseHeight(x, z);
  if (x < SHORE_BOX.x0 || x > SHORE_BOX.x1 || z < SHORE_BOX.z0 || z > SHORE_BOX.z1) return h;
  return shoreHeight(x, z, h, true);
}

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

// Walkable decks the boat bumps into: [x0, x1, z0, z1, deck height].
export const PIERS = [
  { x0: JETTY.x - JETTY.halfW, x1: JETTY.x + JETTY.halfW, z0: JETTY.z0, z1: JETTY.z1, deck: JETTY.deck },
  { x0: LANDING.x - 2.5, x1: LANDING.x + LANDING.len, z0: LANDING.z - 0.9, z1: LANDING.z + 0.9, deck: LANDING.deck },
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

// Fresh water first: the lake and the stream are their own little worlds.
export function freshZone(x, z) {
  if (x < SHORE_BOX.x0 || x > SHORE_BOX.x1 || z < SHORE_BOX.z0 || z > SHORE_BOX.z1) return null;
  if (lakeSDF(x, z) < 3) return 'lake';
  if (streamSDF(x, z) < 2) return 'stream';
  return null;
}

export function zoneAt(x, z) {
  const fresh = freshZone(x, z);
  if (fresh) return fresh;
  if (Math.hypot(x - COVE.x, z - COVE.z) < COVE.r + 4) return 'cove';
  for (const c of CHANNEL) if (sdCapsule(x, z, c[0], c[1], c[2], c[3], c[4]) < -1) return 'cove';
  if (Math.hypot(x - BAY.x, z - BAY.z) < BAY.r + 4) return 'bay';
  return 'open';
}

export const ZONE_NAMES = { bay: 'Willow Bay', cove: 'Driftwood Cove', open: 'open water', lake: 'Reedmere', stream: 'Fernbeck' };

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
    id: 'landing', name: 'The Landing', sub: 'a mooring post and a few planks',
    note: 'A short pier on the west shore of the bay. Tie up here: camp is just up the path.',
    x: -86, z: -5.5,
    test: (x, z) => Math.hypot(x - LANDING.x, z - LANDING.z) < 16,
  },
  {
    id: 'camp', name: 'Camp', sub: 'a tent, a fire ring, and the kettle', labelLeft: true,
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
export function bakeHeightTexture(size = 512, rect = WATER_RECT) {
  const data = new Uint16Array(size * size * 4);
  const flow = { x: 0, z: 0 };
  const toHalf = THREE.DataUtils.toHalfFloat;
  for (let j = 0; j < size; j++) {
    const z = rect.z + ((j + 0.5) / size) * rect.h;
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
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// 1 on the lake and stream, 0 on the sea, soft in between.
export function freshness(x, z) {
  if (x < SHORE_BOX.x0 || x > SHORE_BOX.x1 || z < SHORE_BOX.z0 || z > SHORE_BOX.z1) return 0;
  return Math.max(smoothstep(6, 0, lakeSDF(x, z)), smoothstep(4, 0, streamSDF(x, z)));
}
