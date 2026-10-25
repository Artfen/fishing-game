import * as THREE from 'three';
import { clamp, lerp, smoothstep, fbm } from '../util.js';
import { COLD_BOX, coldwaterHeight, inColdwater, waterLevel, neckSDF, coldInfo, FELL_PATH, FELL_BOX, FELL_PATH_SEGS, fellPathNear, fellPathCandidates, BOTHY, FOOTBRIDGE, SUMMIT_CAIRN, COLDWATER, TARN, tarnSDF } from './coldwater.js';
export { waterLevel } from './coldwater.js';
import { SOUTH_Z, brasaHeight, brasaSDF, brasaZone, SOUTH_ZONES, BRASA_PLACES, PUERTO, ISLE, inSouth, QUAY_S, MOLE, DIQUE, SOUTH_RECT, PONTOON_S, FINGERS_S, PONTOON_STEPS, FUEL_S } from './brasa.js';
export { SOUTH_Z, inSouth } from './brasa.js';

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
// WORLD is the land and sea you can reach. To the north-west it runs on up to Hoarfell and the
// Coldwater (see coldwater.js); the sea and its textures cover SEA, the part with any sea in it.
export const WORLD = { x0: -1700, x1: 1100, z0: -2100, z1: 1400 };
export const SEA = { x0: -900, x1: 1100, z0: -1100, z1: 1400 };
export const WATER_RECT = { x: SEA.x0, z: SEA.z0, w: SEA.x1 - SEA.x0, h: SEA.z1 - SEA.z0 };
// Inside the world: home's, or Las Brasas' far to the south (see brasa.js). pad: a margin inside.
export const inWorld = (x, z, pad = 0) => (x > WORLD.x0 + pad && x < WORLD.x1 - pad && z > WORLD.z0 + pad && z < WORLD.z1 - pad)
  || (x > SOUTH_RECT.x0 + pad && x < SOUTH_RECT.x1 - pad && z > SOUTH_RECT.z0 + pad && z < SOUTH_RECT.z1 - pad);
// In either of the game's seas: home, or Las Brasas' far to the south (see brasa.js).
export const inSeas = (x, z) => (x > SEA.x0 && x < SEA.x1 && z > SEA.z0 && z < SEA.z1) || (x > SOUTH_RECT.x0 && x < SOUTH_RECT.x1 && z > SOUTH_RECT.z0 && z < SOUTH_RECT.z1);
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
// The Calf: a small green island off Heron Point, the western headland, with Calf Sound between
// them: a narrow, deep gut the tide races through. A ruined watch tower on its top, a stone
// landing in its lee (the east side, out of the Atlantic swell), and a low skerry off its
// north-west corner where the seals haul out.
export const CALF = { x: -484, z: 167, rx: 21, rz: 15 };
export const CALF_TOWER = { x: -489, z: 169 };
export const CALF_SKERRY = { x: -516, z: 158, r: 5.5 };
// Calf Sound: the line the race runs along (west to east on the ebb), and how far it reaches.
export const CALF_SOUND = { x0: -528, z0: 141, x1: -440, z1: 138, r: 15 };
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

// The cove shore. Willowhaven, a few cottages round a stone quay on the north shore of the bay;
// a coast path to it from the landing, and on along the east arm to Shell Strand (a quiet beach
// facing the sea) and round Driftwood Cove to Cove Head (a rocky knoll with a white daymark over
// the cove's channel). Off the strand, the Kittiwake lies on the reef with a buoy over her.
export const HAVEN = { x: 4, z: -97 };
// The level apron behind the quay, and the cottages, chandlery and net store on their pads up the
// slope (doors facing the bay, +z). w and d are the building's width and depth.
export const HAVEN_APRON = { x0: -18, x1: 28, z0: -100, z1: -94.5, h: 1.6 };
export const HAVEN_HOUSES = [
  { id: 'chandlery', x: -6, z: -103.5, yaw: 0, w: 6, d: 4.4, kind: 'chandlery' },
  { id: 'store', x: 21, z: -103, yaw: -0.15, w: 5, d: 4, kind: 'store' },
  { id: 'rose', x: -24, z: -108, yaw: 0.25, w: 6.5, d: 5, kind: 'cottage', color: '#e9dcc4', door: '#3f6f74' },
  { id: 'gull', x: 33, z: -110, yaw: -0.3, w: 6, d: 5, kind: 'cottage', color: '#dfe6e4', door: '#a5482f' },
  { id: 'net', x: 6, z: -114, yaw: 0.05, w: 7, d: 5.2, kind: 'cottage', color: '#efe4cf', door: '#3d5a7a' },
];
// The slipway: a ramp of setts down into the bay beside the quay, for launching small boats.
export const SLIPWAY = { x: -12, z: -91, len: 8, w: 3.2 };
export const HAVEN_BOARD = { x: 16, z: -98.2, yaw: 0 };   // the notice board, by the head of the quay
export const HAVEN_BENCH = { x: -1, z: -96.4, yaw: 0 };   // a bench under the lamp, looking out over the bay
export const HAVEN_LAMP = { x: 3.2, z: -95.6 };
export const DAYMARK = { x: 176, z: -6, r: 18, rise: 5.5 };     // Cove Head and its beacon
export const STRAND = { x: 101, z: 21 };                        // Shell Strand
export const PUNT = { x: 124, z: -31, yaw: 0.6 };              // an old punt pulled up at the cove's head
export const SHELTER = { x: 90, z: 24, yaw: -0.4 };            // a driftwood shelter on the strand
export const WRECK = { x: 92, z: 76, yaw: 0.95, len: 22, beam: 5.6 };
export const WRECK_BUOY = { x: 99, z: 68 };
// Her bell, fallen from the wheelhouse onto the sand by her bow (for divers to find, and leave).
export const WRECK_BELL = {
  x: WRECK.x + 0.9 * Math.cos(WRECK.yaw) + (WRECK.len / 2 + 1.4) * Math.sin(WRECK.yaw),
  z: WRECK.z - 0.9 * Math.sin(WRECK.yaw) + (WRECK.len / 2 + 1.4) * Math.cos(WRECK.yaw),
};
// Paths: from the landing round the bay to Willowhaven; from Willowhaven along the east arm and
// round the head of the cove to Cove Head; and down from the arm to the strand.
export const COAST_PATHS = [
  [[-88.6, -8.5], [-89.5, -20], [-87, -34], [-82, -48], [-74.5, -62], [-63, -75], [-49, -85.5], [-33, -93.5], [-17, -96]],
  [[26, -96], [40, -93], [55, -84], [70, -70], [84, -57], [100, -50], [118, -49], [136, -49], [152, -45], [164, -35], [172, -22], [175, -12]],
  [[100, -50], [98, -32], [99, -14], [100, 3]],
];

// Home: a cottage and its garage on a level shoulder of the east arm, looking south over Shell
// Strand to the sea, with the hill behind (see home.js). The pad is cut and filled level; the
// house and garage share a wall, with a door between them; the garage door faces the drive.
export const HOME = { x: 123, z: -74 };
// The fuel pumps (see fuel.js): by the garage at home, facing the drive, at the root of
// Willowhaven quay, where the boats come alongside, and on Puerto Brasa's quay far to the south
// (and Willowhaven's fuel point on its pontoon: see HAVEN_PONTOON). yaw: the way the pump faces.
export const FUEL_PUMPS = {
  home: { x: 136.6, z: -68.8, yaw: -Math.PI / 2, name: 'the fuel pump by the garage' },
  haven: { x: 13.6, z: -96.2, yaw: -Math.PI / 2, name: 'the harbour fuel pump' },
  brasa: FUEL_S,
};
// Where a new game begins: in front of the cottage, the garage on your right, the car on the drive.
export const HOME_START = { x: 123.5, z: -66, heading: Math.PI };
export const HOME_PAD = { x0: 106, x1: 141, z0: -86, z1: -57, h: 6 };
export const HOUSE = { x0: 111, x1: 126, z0: -81, z1: -71.5, door: 116.5 };
export const GARAGE = { x0: 126, x1: 135.5, z0: -81, z1: -70, door: [128, 133.6], inner: -76.6 };
// Where the car stands: on the drive at home (nose out, boot to the garage door) and at the car
// parks the lanes lead to; Wend Quay and the Mere Boathouse are reached by road (a short travel
// transition), the rest you can drive yourself. yaw: the way the car faces (0 = +z).
export const CAR_PARKS = {
  home: { x: 130.8, z: -63.6, yaw: 0, r: 5 },
  haven: { x: 36, z: -91.5, yaw: -2.2, r: 7 },
  strand: { x: 100, z: -7, yaw: 0, r: 7 },
  head: { x: 157, z: -41.5, yaw: 0.9, r: 7 },
  quay: { x: 530, z: -157, yaw: 2.6, r: 5 },
  boathouse: { x: 425, z: -391, yaw: -2.4, r: 5 },
};
// The lanes a car can drive: the drive down from home, and the coast path widened into a gravel
// lane from Willowhaven along the east arm to Cove Head, with its branch down to Shell Strand.
export const LANES = [
  [[132, -58.5], [137.5, -57], [141.2, -54.2], [142.4, -50.6], [142.2, -47.4]],
  [[36, -91.5], [42, -91], [55, -84], [70, -70], [84, -57], [100, -50], [118, -49], [136, -49], [150, -45.5], [157, -41.5]],
  [[100, -50], [98, -32], [99, -14], [100, -7]],
];

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
  // (Exactly at the centre the estimate is 0/0: there, it's as deep inside as it gets.)
  if (k1 < 1e-9) return -Math.min(rx, rz);
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
  // (Far to the south: Las Brasas, see brasa.js.)
  if (z > SOUTH_Z) return brasaSDF(x, z);
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
  // The Calf and its skerry, and Calf Sound kept open between it and the Point (whatever the
  // coast's own noise does there, a clear, deep gut).
  if (Math.abs(x - CALF.x) < 90 && Math.abs(z - CALF.z) < 90) {
    const nc = fbm(x * 0.09 + 31, z * 0.09 - 17, 2);
    d = smin(d, sdEllipse(x, z, CALF.x, CALF.z, CALF.rx, CALF.rz) + nc * 4, 3);
    d = smin(d, sdCircle(x, z, CALF_SKERRY.x, CALF_SKERRY.z, CALF_SKERRY.r) + n2 * 1.2, 1.5);
    d = smax(d, -sdCapsule(x, z, CALF_SOUND.x0, CALF_SOUND.z0, CALF_SOUND.x1, CALF_SOUND.z1, 8), 4);
  }
  d = smin(d, sdCircle(x, z, SKELLIG.x, SKELLIG.z, SKELLIG.r) + n2 * 4, 3);
  // The neck across the old strait, where the Coldwater comes through to the bay.
  if (x > -200 && x < 60 && z > -420 && z < -160) d = smin(d, neckSDF(x, z, n1 * 6 + n2 * 2), 18);
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
  // The Calf: sheer to the west and south where the swell hits, a long grassy slope down to the
  // landing on its east side, and a level top round the tower. (Not the skerry: that stays low.)
  if (Math.abs(x - CALF.x) < 40 && Math.abs(z - CALF.z) < 40) {
    const lee = smoothstep(-0.2, 0.9, (x - CALF.x) / CALF.rx);
    const skerry = smoothstep(CALF_SKERRY.r + 2, CALF_SKERRY.r + 6, Math.hypot(x - CALF_SKERRY.x, z - CALF_SKERRY.z));
    h += (7.5 - 3.5 * lee) * smoothstep(1.5, lerp(6.5, 13, lee), inland) * skerry;
    // The skerry: a low, flat-topped rock, just clear of the water.
    h += 0.7 * smoothstep(CALF_SKERRY.r + 1, CALF_SKERRY.r * 0.4, Math.hypot(x - CALF_SKERRY.x, z - CALF_SKERRY.z));
    // The way up from the landing (see CALF_LANDING): a cut in the slope, easier on the legs.
    const px = Math.min(CALF.x + 19, Math.max(CALF.x + 11, x)), pd = Math.hypot(x - px, z - CALF.z - 1);
    const ramp = lerp(1.15, 7, (CALF.x + 19 - px) / 8);
    h = lerp(h, Math.min(h, ramp), smoothstep(2.6, 1.2, pd));
  }
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
  if (z > SOUTH_Z) return brasaHeight(x, z);
  let h = baseHeight(x, z);
  if (x > SHORE_BOX.x0 && x < SHORE_BOX.x1 && z > SHORE_BOX.z0 && z < SHORE_BOX.z1) h = shoreHeight(x, z, h, true);
  else {
    if (x > EST_BOX.x0 && x < EST_BOX.x1 && z > EST_BOX.z0 && z < EST_BOX.z1) h = estuaryHeight(x, z, h);
    if (x > MERE_BOX.x0 && x < MERE_BOX.x1 && z > MERE_BOX.z0 && z < MERE_BOX.z1) h = mereHeight(x, z, h);
    if (x > TRAIL_BOX.x0 && x < TRAIL_BOX.x1 && z > TRAIL_BOX.z0 && z < TRAIL_BOX.z1) {
      const p = trailInfo(x, z);
      if (p.d < 4) h = lerp(p.h, h, smoothstep(1.2, 4, p.d));
    }
    if (Math.abs(x - GANNET_CAMP.x) < 14 && Math.abs(z - GANNET_CAMP.z) < 14) {
      h = lerp(gannetCampH, h, smoothstep(GANNET_CAMP.r - 1, GANNET_CAMP.r + 5, Math.hypot(x - GANNET_CAMP.x, z - GANNET_CAMP.z)));
    }
  }
  if (x > COAST_BOX.x0 && x < COAST_BOX.x1 && z > COAST_BOX.z0 && z < COAST_BOX.z1) h = coastHeight(x, z, h, true);
  if (parkH) h = parkHeight(x, z, h);
  // Hoarfell, and the Coldwater's valley down to the bay, with the fell path trodden into it.
  if (x < COLD_BOX.x1 && z < COLD_BOX.z1 && x > COLD_BOX.x0 && z > COLD_BOX.z0) {
    h = coldwaterHeight(x, z, h);
    if (fellH && x > FELL_BOX.x0 && x < FELL_BOX.x1 && z > FELL_BOX.z0 && z < FELL_BOX.z1) h = fellTread(x, z, h);
    // (The bothy's level ground, cut back into the hillside.)
    if (Math.abs(x - BOTHY.x) < 12 && Math.abs(z - BOTHY.z) < 12) h = lerp(BOTHY.level, h, smoothstep(BOTHY.r, BOTHY.r + 3.5, Math.hypot(x - BOTHY.x, z - BOTHY.z)));
  }
  return h;
}

// The fell path: how far from it, and the height of its tread there.
let fellH = null; // for each stretch of the path, the tread's height every few metres along it
const treadAt = (i, u) => {
  const H = fellH[i], k = u * (H.length - 1), j = Math.min(H.length - 2, Math.floor(k));
  return lerp(H[j], H[j + 1], k - j);
};
const _fi = { d: 0, h: 0 };
export function fellPathInfo(x, z, out = _fi) {
  const n = fellPathNear(x, z);
  out.d = n.d;
  out.h = fellH && n.d < Infinity ? treadAt(n.i, n.u) : 0;
  return out;
}
// The path trodden into the land (h, without it): level across, its banks easing back into the
// hillside (spread wider where it's cut in deeper or built up higher). Every stretch near here
// counts, the nearest most, so where two legs of a zigzag come close the slope between them runs
// smoothly from one to the other.
function fellTread(x, z, h) {
  let most = 0, sum = 0, wsum = 0;
  for (const k of fellPathCandidates(x, z)) {
    const g = FELL_PATH_SEGS[k], bax = g.bx - g.ax, baz = g.bz - g.az;
    const u = clamp(((x - g.ax) * bax + (z - g.az) * baz) / (g.len * g.len), 0, 1);
    const d = Math.hypot(x - g.ax - bax * u, z - g.az - baz * u);
    if (d > 10) continue;
    const t = treadAt(k, u), reach = 3.6 + Math.min(Math.abs(t - h), 3) * 0.9;
    const w = 1 - smoothstep(1.3, reach, d);
    if (w <= 0) continue;
    const w4 = w ** 4;
    most = Math.max(most, w);
    sum += w4 * t;
    wsum += w4;
  }
  return most > 0 ? lerp(h, sum / wsum, most) : h;
}

/* ---------------- the cove shore: Willowhaven, the paths, Cove Head ---------------- */

const COAST_BOX = { x0: -96, x1: 200, z0: -125, z1: 40 };
const HAVEN_BOX = { x0: -42, x1: 52, z0: -125, z1: -84 };

// Each building stands on a level pad cut into the slope at the height of its middle; the apron
// behind the quay is level too, and ends in a low sea wall above the beach (so the shore and the
// water stay as they were).
const havenPads = HAVEN_HOUSES.map((b) => ({ ...b, h: Math.max(1.9, baseHeight(b.x, b.z)) }));
function havenHeight(x, z, h) {
  const S = SLIPWAY;
  // The slipway: a ramp of setts from the apron straight down into the bay.
  if (Math.abs(x - S.x) < S.w / 2 + 0.6 && z > HAVEN_APRON.z0 && z < HAVEN_APRON.z1 + S.len && h > -1.2) {
    const ramp = lerp(HAVEN_APRON.h, -0.9, smoothstep(HAVEN_APRON.z1 - 1, HAVEN_APRON.z1 + S.len, z));
    return lerp(ramp, h, smoothstep(S.w / 2, S.w / 2 + 0.6, Math.abs(x - S.x)));
  }
  const A = HAVEN_APRON;
  // On the apron itself, level ground (its seaward edge is the wall).
  if (x >= A.x0 && x <= A.x1 && z >= A.z0 && z <= A.z1) return A.h;
  if (h < 0.15) return h;
  if (z <= A.z1) {
    const ax = Math.max(A.x0 - x, 0, x - A.x1), az = Math.max(A.z0 - z, 0);
    const da = Math.hypot(ax, az);
    if (da < 7) h = lerp(A.h, h, smoothstep(0, 7, da));
  }
  for (const p of havenPads) {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw), dx = x - p.x, dz = z - p.z;
    const u = Math.abs(dx * c - dz * s) - p.w / 2 - 1.4, v = Math.abs(dx * s + dz * c) - p.d / 2 - 1.4;
    const d = Math.hypot(Math.max(u, 0), Math.max(v, 0));
    if (d < 11) h = lerp(p.h, h, smoothstep(0, 11, d));
  }
  return h;
}

// Cove Head: a rocky knoll rising from the low point east of the cove's channel. Only the land
// rises; the shoreline stays where it was, so its seaward sides are steep and rocky.
function headHeight(x, z, h) {
  const D = DAYMARK, d = Math.hypot(x - D.x, z - D.z);
  if (d > D.r + 8 || h < 0.2) return h;
  const rough = fbm(x * 0.17 + 7, z * 0.17 - 3, 2) * 0.7;
  return h + (D.rise + rough) * smoothstep(D.r + 6, 3, d) * smoothstep(0.2, 1.8, h);
}

// The paths: within a few metres of one, the ground is smoothed to the path's own gentle grade.
let coastH = null;
const _cp = { d: 0, h: 0 };
export function coastPathInfo(x, z, out = _cp) {
  out.d = Infinity;
  out.h = 0;
  for (let p = 0; p < COAST_PATHS.length; p++) {
    const P = COAST_PATHS[p];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const bax = b[0] - a[0], baz = b[1] - a[1];
      if (Math.min(a[0], b[0]) - 6 > x || Math.max(a[0], b[0]) + 6 < x || Math.min(a[1], b[1]) - 6 > z || Math.max(a[1], b[1]) + 6 < z) continue;
      const hh = clamp(((x - a[0]) * bax + (z - a[1]) * baz) / (bax * bax + baz * baz), 0, 1);
      const d = Math.hypot(x - a[0] - bax * hh, z - a[1] - baz * hh);
      if (d < out.d) {
        out.d = d;
        if (coastH) out.h = lerp(coastH[p][i], coastH[p][i + 1], hh);
      }
    }
  }
  return out;
}

// Shell Strand: a flat shelf of sand above the beach (the sea's storms laid it down), then the
// beach shelving into the sea.
function strandHeight(x, z, h) {
  const S = STRAND;
  if (x < S.x - 34 || x > S.x + 30 || z < S.z - 14 || z > S.z + 16) return h;
  const w = smoothstep(34, 20, Math.abs(x - S.x + 2)) * smoothstep(-14, -7, z - S.z);
  if (w <= 0) return h;
  const u = z - S.z;
  // (The shelf is cut and filled level; the beach below it is only ever cut, never built out
  // into the sea.)
  if (u < 7) return lerp(h, lerp(2.0, 1.55, smoothstep(-7, 7, u)) + fbm(x * 0.15, z * 0.15, 2) * 0.12, w);
  return lerp(h, Math.min(h, lerp(1.55, -0.7, smoothstep(7, 15, u))), w);
}

function coastHeight(x, z, h, withPaths) {
  if (x > HAVEN_BOX.x0 && x < HAVEN_BOX.x1 && z > HAVEN_BOX.z0 && z < HAVEN_BOX.z1) h = havenHeight(x, z, h);
  h = headHeight(x, z, h);
  h = strandHeight(x, z, h);
  h = homeHeight(x, z, h);
  if (withPaths && coastH && h > -0.4) {
    const p = coastPathInfo(x, z);
    if (p.d < 4) h = lerp(p.h, h, smoothstep(1.2, 4, p.d));
  }
  if (withPaths && laneH && h > -0.4) {
    const p = laneInfo(x, z);
    if (p.d < 6.5) h = lerp(p.h, h, smoothstep(2.6, 6.5, p.d));
  }
  return h;
}

// Home's pad: level inside, easing back into the land over nine metres, and into the hill behind
// over a longer, grassy slope (cut at the back, a little fill at the front).
function homeHeight(x, z, h) {
  const P = HOME_PAD;
  const dx = Math.max(P.x0 - x, 0, x - P.x1), back = Math.max(P.z0 - z, 0), dz = Math.max(back * (9 / 26), z - P.z1);
  const d = Math.hypot(dx * (back > 0 ? 0.6 : 1), dz);
  if (d > 9) return h;
  return lerp(P.h, h, smoothstep(0, 9, d));
}

// The lanes: within a couple of metres of one, the ground is level across and follows the lane's
// own easy grade along it.
let laneH = null;
const _li = { d: 0, h: 0, i: 0, l: 0, tx: 0, tz: 1, px: 0, pz: 0 };
// reach: how far to look (the ground's shaping only needs the lanes close by).
export function laneInfo(x, z, out = _li, reach = 8) {
  out.d = Infinity;
  out.h = 0;
  for (let p = 0; p < LANES.length; p++) {
    const P = LANES[p];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      if (Math.min(a[0], b[0]) - reach > x || Math.max(a[0], b[0]) + reach < x || Math.min(a[1], b[1]) - reach > z || Math.max(a[1], b[1]) + reach < z) continue;
      const bax = b[0] - a[0], baz = b[1] - a[1], len = Math.hypot(bax, baz);
      const hh = clamp(((x - a[0]) * bax + (z - a[1]) * baz) / (len * len), 0, 1);
      const d = Math.hypot(x - a[0] - bax * hh, z - a[1] - baz * hh);
      if (d < out.d) {
        out.d = d;
        out.l = p;
        out.i = i + hh;
        out.tx = bax / len;
        out.tz = baz / len;
        out.px = a[0] + bax * hh;
        out.pz = a[1] + baz * hh;
        if (laneH) out.h = lerp(laneH[p][i], laneH[p][i + 1], hh);
      }
    }
  }
  return out;
}

// The car parks: a level circle of gravel, easing out over a few metres.
let parkH = null;
function parkHeight(x, z, h) {
  for (const id in CAR_PARKS) {
    if (id === 'home') continue; // (on home's own level pad)
    const c = CAR_PARKS[id], d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r + 5 && h > -0.4) h = lerp(parkH[id], h, smoothstep(c.r, c.r + 5, d));
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
// The coast paths' heights, the same way (from the ground before the paths are smoothed in). The
// coast path starts on the landing's land end, level with its deck.
{
  coastH = null;
  coastH = COAST_PATHS.map((P, p) => {
    const raw = P.map(([x, z]) => heightAt(x, z));
    if (p === 0) raw[0] = Math.max(raw[0], LANDING.deck);
    return raw.map((h, i) => (i === 0 || i === raw.length - 1 ? Math.max(0.45, h) : Math.max(0.45, (raw[i - 1] + h * 2 + raw[i + 1]) / 4)));
  });
}
// The lanes the same way (over the paths and home's pad), then the car parks on top of them.
{
  laneH = LANES.map((P, p) => {
    const raw = P.map(([x, z]) => heightAt(x, z));
    if (p === 0) {
      // The drive: one even grade from the pad down to the coast path (cut and filled).
      const len = [0];
      for (let i = 1; i < P.length; i++) len.push(len[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      return len.map((l) => lerp(raw[0], raw[raw.length - 1], l / len[len.length - 1]));
    }
    return raw.map((h, i) => (i === 0 || i === raw.length - 1 ? Math.max(0.8, h) : Math.max(0.8, (raw[i - 1] + h * 2 + raw[i + 1]) / 4)));
  });
  const ph = {};
  for (const id in CAR_PARKS) ph[id] = Math.max(0.9, heightAt(CAR_PARKS[id].x, CAR_PARKS[id].z));
  parkH = ph;
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
// (Its deck sits low enough to step up onto from the bank at its root.)
export const QUAY = pierAlong(WEND_CAMP.x + 4, WEND_CAMP.z, 1, 0, { width: 3, deck: 0.7 });
export const BOATHOUSE_PIER = pierAlong(BOATHOUSE.x + 4, BOATHOUSE.z, -1, 0, { width: 2, deck: 0.7 });
export const COVE_PIER = pierAlong(GANNET_CAMP.x, GANNET_CAMP.z - 2, 0, -1, { width: 2, deck: 0.8 });
// Willowhaven's quay: stone, out from the apron into the bay where it's deep enough for the skiff.
export const HAVEN_QUAY = pierAlong(10, -97, 0, 1, { width: 3.2, deck: 1.5, deep: 4.2 });
// The Calf's landing: a short stone jetty out from its east side, in the lee, deep enough at its
// end for any of the boats to come alongside.
export const CALF_LANDING = pierAlong(CALF.x + 8, CALF.z + 1, 1, 0, { width: 2.6, deck: 1.0, deep: 1.8 });
// Where the cabin boat lies: alongside Willowhaven quay, bow to the sea, near the harbour pump,
// with water under its whole length.
export const CABIN_BERTH = (() => {
  const Q = HAVEN_QUAY;
  for (const dx of [2.6, 3.0, 3.4]) {
    for (let z = Q.z1 - 1.5; z > Q.z0 + 4; z -= 0.5) {
      const x = Q.x1 + dx;
      if ([-3.2, 0, 3.2].every((k) => heightAt(x, z + k) < -1.1)) return { x, z, heading: 0 };
    }
  }
  return { x: Q.x1 + 3, z: Q.z1 - 3, heading: 0 };
})();

// Where the sailing boat lies: alongside the other (west) side of Willowhaven quay, bow to the sea.
export const SAIL_BERTH = (() => {
  const Q = HAVEN_QUAY;
  for (const dx of [2.6, 3.0, 3.4]) {
    for (let z = Q.z1 - 1.5; z > Q.z0 + 4; z -= 0.5) {
      const x = Q.x0 - dx;
      if ([-2.6, 0, 2.6].every((k) => heightAt(x, z + k) < -1.1)) return { x, z, heading: 0 };
    }
  }
  return { x: Q.x0 - 3, z: Q.z1 - 3, heading: 0 };
})();

// Willowhaven's pontoon: a floating jetty on out from the end of the quay, low on the water, with
// fingers either side for the bigger boats; a gangway of steps down to it beside the quay light,
// and a fuel point on its west edge near its head (out of the way of the gangway).
export const HAVEN_PONTOON = (() => {
  const Q = HAVEN_QUAY, z0 = Q.z1;
  return { x0: 9.8, x1: 12.2, z0, z1: z0 + 24, deck: 0.55, land: { x: (Q.x0 + Q.x1) / 2, z: Q.z0 } };
})();
export const HAVEN_FINGERS = [10, 19.5].flatMap((u) => {
  const P = HAVEN_PONTOON, z0 = P.z0 + u, z1 = z0 + 2.2, land = { x: (P.x0 + P.x1) / 2, z: z0 + 1.1 };
  return [{ x0: P.x1, x1: P.x1 + 12, z0, z1, deck: 0.5, land }, { x0: P.x0 - 12, x1: P.x0, z0, z1, deck: 0.5, land }];
});
export const HAVEN_STEPS = [1.26, 1.02, 0.78].map((deck, i) => ({ x: 11, z: HAVEN_PONTOON.z0 + 0.5 + i, hx: 0.6, hz: 0.5, yaw: 0, deck }));
FUEL_PUMPS.marina = { x: HAVEN_PONTOON.x0 + 0.35, z: HAVEN_PONTOON.z0 + 5.5, yaw: Math.PI, name: 'the fuel point on the pontoon', deck: HAVEN_PONTOON.deck };
// Where the motor cruiser lies: alongside the first finger east of the pontoon, bow out to the bay.
export const CRUISER_BERTH = { x: HAVEN_FINGERS[0].x0 + 6, z: HAVEN_FINGERS[0].z1 + 1.65, heading: Math.PI / 2 };
// And the centre-console boat: alongside the second finger east, on its seaward side.
export const CONSOLE_BERTH = { x: HAVEN_FINGERS[2].x0 + 5, z: HAVEN_FINGERS[2].z1 + 1.4, heading: Math.PI / 2 };

// Walkable decks the boat bumps into: [x0, x1, z0, z1, deck height].
export const PIERS = [
  { x0: JETTY.x - JETTY.halfW, x1: JETTY.x + JETTY.halfW, z0: JETTY.z0, z1: JETTY.z1, deck: JETTY.deck },
  { x0: LANDING.x - 2.5, x1: LANDING.x + LANDING.len, z0: LANDING.z - 0.9, z1: LANDING.z + 0.9, deck: LANDING.deck },
  // Wend Quay running out east into the estuary, the Longmere boathouse jetty, and the little
  // landing in Puffin Cove.
  QUAY, BOATHOUSE_PIER, COVE_PIER,
  // (After the others, so PIERS[1] stays the landing.)
  HAVEN_QUAY,
  CALF_LANDING,
  // Puerto Brasa, far to the south: the quay, and the breakwater round the basin; the pontoon
  // and its fingers.
  QUAY_S, DIQUE, MOLE, PONTOON_S, ...FINGERS_S,
  // Willowhaven's pontoon and its fingers.
  HAVEN_PONTOON, ...HAVEN_FINGERS,
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
  { x: FOOTBRIDGE.x, z: FOOTBRIDGE.z, hx: FOOTBRIDGE.len / 2, hz: FOOTBRIDGE.w / 2, yaw: FOOTBRIDGE.yaw, deck: FOOTBRIDGE.deck, arch: FOOTBRIDGE.arch },
  // (The gangways' steps down from the quays to the pontoons.)
  ...PONTOON_STEPS, ...HAVEN_STEPS,
];

// Ground height for someone on foot, including decks.
export function walkHeight(x, z) {
  let h = heightAt(x, z);
  for (const d of DECKS) {
    const dx = x - d.x, dz = z - d.z;
    if (Math.abs(dx) > d.hx + d.hz || Math.abs(dz) > d.hx + d.hz) continue;
    const c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    const u = dx * c - dz * s, v = dx * s + dz * c;
    // (An arched deck rises to its middle.)
    if (Math.abs(u) <= d.hx && Math.abs(v) <= d.hz) h = Math.max(h, d.arch ? d.deck + d.arch * (1 - (u / d.hx) ** 2) : d.deck);
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
// How deep the water is here (below its own surface: the sea's, or the Coldwater's up on the fell).
export const depthAt = (x, z) => waterLevel(x, z) - solidHeight(x, z);

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
  if (z > SOUTH_Z) return brasaZone(x, z);
  const fresh = freshZone(x, z);
  if (fresh) return fresh;
  // The Coldwater and Hoar Tarn (the river's mouth, out in the bay, is the bay's).
  if (x < COLD_BOX.x1 && z < COLD_BOX.z1) {
    const c = inColdwater(x, z, 3);
    if (c === 'tarn') return 'tarn';
    if (c && landSDF(x, z) < -1) return c;
  }
  if (riverSDF(x, z) < 6 && z < 175) return 'estuary';
  if (Math.hypot(x - COVE.x, z - COVE.z) < COVE.r + 4) return 'cove';
  for (const c of CHANNEL) if (sdCapsule(x, z, c[0], c[1], c[2], c[3], c[4]) < -1) return 'cove';
  if (Math.hypot(x - BAY.x, z - BAY.z) < BAY.r + 4) return 'bay';
  // The outer shore east of the bay's mouth (Shell Strand, Cove Head, the Kittiwake's reef) is the
  // coast: surf, rock and sand within a short row of the land.
  if (x > 55 && x < 260 && z > -10 && z < 140 && landSDF(x, z) < 70) return 'coast';
  if (z > DEEP_Z) return 'deep';
  if (z > 260 || x < -300 || x > 300) return 'coast';
  return 'open';
}
export const SALT_ZONES = ['bay', 'cove', 'open', 'coast', 'deep', ...SOUTH_ZONES];
export const FRESH_ZONES = ['lake', 'stream', 'mere', 'river', 'tarn'];
export const waterOf = (zone) => (FRESH_ZONES.includes(zone) ? 'fresh' : zone === 'estuary' || zone === 'tideway' ? 'brackish' : 'salt');

export const ZONE_NAMES = {
  bay: 'Willow Bay', cove: 'Driftwood Cove', open: 'open water', lake: 'Reedmere', stream: 'Fernbeck',
  estuary: 'the Wend estuary', mere: 'Longmere', coast: 'the outer coast', deep: 'the deep water',
  river: 'the Coldwater', tarn: 'Hoar Tarn', tideway: 'the Coldwater’s tideway',
  harbor: 'Puerto Brasa harbour', lee: 'the lee of Brasa', lava: 'Las Coladas', sebadal: 'El Sebadal', veril: 'El Veril', ocean: 'the open ocean',
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
    id: 'haven', name: 'Willowhaven', sub: 'a stone quay, a chandlery, a few cottages', dock: true, harbour: true,
    note: 'A handful of cottages round a stone quay on the north shore of the bay, with a slipway, a chandlery and a notice board. Boats come and go from here.',
    x: HAVEN.x, z: HAVEN.z,
    test: (x, z) => Math.hypot(x - HAVEN.x, z - HAVEN.z) < 26,
  },
  {
    id: 'reach', name: 'The Cove Channel', sub: 'a winding inlet, sheltered from every wind',
    note: 'The narrow channel into Driftwood Cove. Eelgrass and soft mud along its edges; bream, wrasse and cuttlefish come and go with the light.',
    x: CHANNEL[1][0] - 2, z: CHANNEL[1][1] + 14,
    test: (x, z) => CHANNEL.some((c) => sdCapsule(x, z, c[0], c[1], c[2], c[3], c[4] + 6) < 0),
  },
  {
    id: 'head', name: 'Cove Head', sub: 'a rocky knoll with a white daymark',
    note: 'A rocky knoll over the mouth of the cove’s channel, with a whitewashed daymark on top. Surf breaks on its ledges; the Kittiwake’s buoy is in sight to the south-west.',
    x: DAYMARK.x, z: DAYMARK.z,
    test: (x, z) => Math.hypot(x - DAYMARK.x, z - DAYMARK.z) < 24,
  },
  {
    id: 'strand', name: 'Shell Strand', sub: 'a quiet beach facing the sea',
    note: 'A sandy beach on the seaward side of the east arm, out of the north wind. Bass hunt in the surf at dusk; flatfish lie on the sand beyond. A good place to pitch a tent.',
    x: STRAND.x, z: STRAND.z,
    test: (x, z) => Math.hypot(x - STRAND.x, z - STRAND.z) < 24,
  },
  {
    id: 'wreck', name: 'The Kittiwake', sub: 'a wreck on the reef, under a black and red buoy',
    note: 'A wooden steam drifter that went down on the reef south of Shell Strand, nine or ten metres down. A conger lives in her hull; pollack and wrasse hang over her, and red porgy and pandora feed round her.',
    x: WRECK.x, z: WRECK.z,
    test: (x, z) => Math.hypot(x - WRECK.x, z - WRECK.z) < 30,
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
    id: 'calf', name: 'The Calf', sub: 'a small island off Heron Point', dock: true,
    note: 'A green hump of an island, sheer to the west, with a ruined watch tower on its top and a stone landing in its lee. Seals haul out on the skerry off its north-west corner. Room on the top for a tent, if the weather’s kind.',
    x: CALF.x, z: CALF.z, region: 'coast',
    test: (x, z) => Math.hypot((x - CALF.x) / (CALF.rx + 12), (z - CALF.z) / (CALF.rz + 12)) < 1,
  },
  {
    id: 'sound', name: 'Calf Sound', sub: 'a tide race between the Point and the Calf',
    note: 'The tide pours through the gut between Heron Point and the Calf, and the water stands up in ridges where it runs. Bass and pollack wait on its edges for what it carries; mackerel and garfish come through on it. Spin a metal or a sandeel across it, from the Calf’s rocks or drifting through.',
    x: (CALF_SOUND.x0 + CALF_SOUND.x1) / 2, z: (CALF_SOUND.z0 + CALF_SOUND.z1) / 2, region: 'coast',
    test: (x, z) => sdCapsule(x, z, CALF_SOUND.x0, CALF_SOUND.z0, CALF_SOUND.x1, CALF_SOUND.z1, 10) < 0,
  },
  {
    id: 'gull', name: 'Gull Rock', sub: 'where the water turns deep',
    note: 'Sea stacks past the bay mouth. The water goes dark blue here, and the gulls never stop talking.',
    x: STACKS[0].x, z: STACKS[0].z,
    test: (x, z) => Math.hypot(x - STACKS[0].x, z - STACKS[0].z) < 34,
  },
  // Up the Coldwater, from the bay to the top of Hoarfell.
  {
    id: 'coldfoot', name: 'Coldwater Foot', sub: 'a footbridge over the river’s mouth',
    note: 'Where the Coldwater comes out into the bay, under a timber footbridge on the coast path. A fingerpost points up the river: the path to Hoarfell starts here. Bass and mullet come in on the tide.',
    x: FOOTBRIDGE.x, z: FOOTBRIDGE.z,
    test: (x, z) => Math.hypot(x - FOOTBRIDGE.x, z - FOOTBRIDGE.z) < 26,
  },
  {
    id: 'lowerforce', name: 'The Lower Force', sub: 'the last fall, where the tide stops',
    note: 'The Coldwater’s last waterfall, a dozen metres down into the Force Pool, where the fresh water meets the tide. Sea bass and eels come up as far as the pool; above the fall it’s trout and grayling.',
    x: COLDWATER[33].x, z: COLDWATER[33].z,
    test: (x, z) => Math.hypot(x - COLDWATER[32].x, z - COLDWATER[32].z) < 30 || Math.hypot(x - COLDWATER[33].x, z - COLDWATER[33].z) < 24,
  },
  {
    id: 'dale', name: 'Coldwater Dale', sub: 'a long valley under the fell', area: true, size: 30,
    note: 'The Coldwater’s valley, wooded along the river with alder and birch: runs and riffles, and a pool at every bend. Trout and grayling all the way up.',
    x: COLDWATER[22].x - 60, z: COLDWATER[22].z, region: 'fell',
    test: (x, z) => z < -420 && z > -950 && x < -60 && coldInfo(x, z).d < 80,
  },
  {
    id: 'spout', name: 'Spout Force', sub: 'a high fall into a deep pool', region: 'fell',
    note: 'The Coldwater drops thirty metres off the lip of the dale into Spout Pool, deep and cold and full of spray. The bothy is just above it.',
    x: COLDWATER[11].x, z: COLDWATER[11].z,
    test: (x, z) => Math.hypot(x - COLDWATER[11].x, z - COLDWATER[11].z) < 34 || Math.hypot(x - COLDWATER[10].x, z - COLDWATER[10].z) < 22,
  },
  {
    id: 'bothy', name: 'The Bothy', sub: 'a stone hut kept open for walkers', camp: true, region: 'fell',
    note: 'An old shepherd’s hut above Spout Pool, kept open for anyone on the fell: a stove, a sleeping platform, a shelf with a few rods and a tin of oatcakes. Halfway to the top.',
    x: BOTHY.x, z: BOTHY.z,
    test: (x, z) => Math.hypot(x - BOTHY.x, z - BOTHY.z) < 16,
  },
  {
    id: 'tarn', name: 'Hoar Tarn', sub: 'a cold lake in the corrie under the top', region: 'fell',
    note: 'A deep, dark tarn in a bowl scooped out of the fell, crags all round its back. Small wild trout rise to anything at dusk. The river starts at its lip.',
    x: TARN.x, z: TARN.z,
    test: (x, z) => tarnSDF(x, z) < 14,
  },
  {
    id: 'summit', name: 'Hoarfell', sub: 'the top: 570 metres, the whole coast below', region: 'fell',
    note: 'The top of Hoarfell, with a cairn of stones that walkers have carried up. On a clear day you can see the whole coast: the bay, the Wend, Longmere, Gannet Isle and the deep water beyond.',
    x: SUMMIT_CAIRN.x, z: SUMMIT_CAIRN.z,
    test: (x, z) => Math.hypot(x - SUMMIT_CAIRN.x, z - SUMMIT_CAIRN.z) < 26,
  },
  // Las Brasas, far to the south (see brasa.js).
  ...BRASA_PLACES.map((p) => ({
    ...p,
    test: p.id === 'brasa' ? (x, z) => inSouth(z) && Math.hypot((x - ISLE.x) / (ISLE.rx + 500), (z - ISLE.z) / (ISLE.rz + 500)) < 1
      : p.id === 'sebadal' ? (x, z) => inSouth(z) && brasaZone(x, z) === 'sebadal'
        : p.id === 'veril' ? (x, z) => inSouth(z) && brasaZone(x, z) === 'veril' && Math.hypot(x - ISLE.x, z - ISLE.z) < 900
          : p.id === 'puerto' ? (x, z) => inSouth(z) && Math.hypot(x - PUERTO.x, z - PUERTO.z + 20) < 95
            : p.id === 'pico' ? (x, z) => inSouth(z) && Math.hypot(x - p.x, z - p.z) < 70
              : (x, z) => inSouth(z) && Math.hypot(x - p.x, z - p.z) < 70,
  })),
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
  if (z > SOUTH_Z) return 0;
  if (x < COLD_BOX.x1 && z < COLD_BOX.z1 && x > COLD_BOX.x0 && z > COLD_BOX.z0) {
    const c = inColdwater(x, z, 8);
    if (c) {
      // (The tidal stretch is salty towards the bay, fresh up at the Force.)
      const r = coldInfo(x, z);
      return c === 'tarn' || r.l > 0.05 ? 1 : smoothstep(-80, -330, z) * 0.85 + 0.1;
    }
  }
  if (x > MERE_BOX.x0 && x < MERE_BOX.x1 && z > MERE_BOX.z0 && z < MERE_BOX.z1) return smoothstep(6, 0, mereSDF(x, z));
  if (x > EST_BOX.x0 && x < EST_BOX.x1 && z > EST_BOX.z0 && z < EST_BOX.z1) {
    const r = riverInfo(x, z);
    return smoothstep(10, 0, r.d - r.hw) * clamp(1.15 - r.t * 1.1, 0.12, 1) * 0.75;
  }
  if (x < SHORE_BOX.x0 || x > SHORE_BOX.x1 || z < SHORE_BOX.z0 || z > SHORE_BOX.z1) return 0;
  return Math.max(smoothstep(6, 0, lakeSDF(x, z)), smoothstep(4, 0, streamSDF(x, z)));
}

// The fell path's tread: the land along it every few metres, eased into a steady climb (never
// steeper than three in five, rather than every lump and crag), kept within a metre or so of
// the hillside where it can be (not banked up above it or cut deep into it), and never down at
// the water. Round each hairpin it levels out into a landing, so the two legs of the zigzag
// meet at much the same height.
{
  const pts = [], ends = [0];
  let s = 0;
  for (const g of FELL_PATH_SEGS) {
    const n = Math.max(1, Math.round(g.len / 4));
    for (let k = pts.length ? 1 : 0; k <= n; k++) pts.push({ x: lerp(g.ax, g.bx, k / n), z: lerp(g.az, g.bz, k / n), ds: g.len / n, s: s + (g.len * k) / n });
    s += g.len;
    ends.push(pts.length - 1);
  }
  // The hairpins: wherever the path turns right round (more than 110 degrees) within a few metres.
  const bends = [];
  for (let v = 1, sv = FELL_PATH_SEGS[0].len; v < FELL_PATH_SEGS.length; sv += FELL_PATH_SEGS[v].len, v++) {
    const a = FELL_PATH_SEGS[v - 1], b = FELL_PATH_SEGS[v];
    const turn = Math.abs(Math.atan2((a.bx - a.ax) * (b.bz - b.az) - (a.bz - a.az) * (b.bx - b.ax), (a.bx - a.ax) * (b.bx - b.ax) + (a.bz - a.az) * (b.bz - b.az)));
    bends.push({ s: sv, turn });
  }
  const hairpins = bends.filter((b) => bends.reduce((t, c) => t + (Math.abs(c.s - b.s) <= 7 ? c.turn : 0), 0) > 1.9).map((b) => b.s);
  const bare = pts.map((p) => heightAt(p.x, p.z));
  const ground = pts.map((p, i) => Math.max(bare[i], waterLevel(p.x, p.z) + 0.9, i < 4 ? 0.9 : -Infinity));
  const GRADE = 0.6, BAND = 1.2, last = pts.length - 1;
  const steep = pts.map((p) => lerp(0.35, GRADE, smoothstep(2, 10, Math.min(Infinity, ...hairpins.map((hs) => Math.abs(hs - p.s))))));
  let h = ground.slice();
  const ease = () => {
    for (let i = 1; i <= last; i++) {
      const g = Math.min(steep[i - 1], steep[i]) * pts[i].ds;
      h[i] = clamp(h[i], h[i - 1] - g, h[i - 1] + g);
    }
    for (let i = last - 1; i >= 0; i--) {
      const g = Math.min(steep[i], steep[i + 1]) * pts[i + 1].ds;
      h[i] = clamp(h[i], h[i + 1] - g, h[i + 1] + g);
    }
  };
  for (let pass = 0; pass < 6; pass++) {
    h = h.map((v, i) => (i === 0 || i === last ? v : (h[i - 1] + v * 2 + h[i + 1]) / 4));
    h = h.map((v, i) => clamp(v, ground[i] - BAND, ground[i] + BAND));
    ease();
  }
  // (Never below the water, whatever the easing did.)
  h = h.map((v, i) => Math.max(v, waterLevel(pts[i].x, pts[i].z) + 0.6));
  fellH = FELL_PATH_SEGS.map((g, i) => h.slice(ends[i], ends[i + 1] + 1));
}
