import { clamp, lerp, smoothstep, fbm } from '../util.js';

// Las Brasas: a volcanic island far to the south across the open Atlantic from Willow Bay, like the
// Canaries (an invented island, not a real one). It lies in the same world as home, off the bottom
// of the chart (everything south of SOUTH_Z is the far south), so the boats, the fish, the water
// and the weather all work there as they do at home; you get there by the crossing, sailing (or
// motoring) the whole way at the helm, or by the fast passage (see crossing.js).
//
//  · Brasa itself: black lava and red cinder, a volcano (Pico Brasa) in the middle with a crater
//    at the top, a younger red cone (Montaña Roja) to the east, sea cliffs on the windward north
//    coast, and scrub, palms and a white village in the lee.
//  · Puerto Brasa: a little harbour on the south coast, its basin behind a breakwater, a quay to
//    tie up at, the village on the slope above, and a room at the bar to sleep and cook in.
//  · Playa Negra: a beach of black sand east of the harbour.
//  · El Sebadal: a broad shallow shelf of sand and seagrass off the south-east, where angel sharks
//    lie buried and cuttlefish and rays feed.
//  · Las Coladas: tongues of old lava running into the sea on the north-west, a rugged reef in
//    the swell: parrotfish, triggerfish, morays in the holes.
//  · Roque del Arco: an islet off the south-west with a sea arch through it, and more arches
//    under the water (Los Arcos).
//  · El Veril: the drop-off. A narrow shelf round the island, then the bottom falls away into the
//    deep blue: groupers in the caves of the wall, barracuda and amberjack along its edge.
//  · Punta del Faro: the long east point, with a lighthouse.
//
// The trade wind blows from the north-east almost all the time; the Atlantic swell comes in from
// the north-west. So the north and west are rough and the south (the lee) is calm.
//
// The archipelago round it (docs/ARCHIPELAGO.md):
//  · Isla Gaviota: a low island to the north-east, up-current, with gulls on its cliffs and
//    Caleta Blanca, a cove of white shell sand, in its lee facing Brasa.
//  · El Estrecho: the channel between Brasa and Gaviota, over a sill, the current squeezing
//    through it.
//  · El Banco: a seamount out in the north-west swell, from the deep to about 24 m.
//  · Los Roquetes: a chain of black stacks west of the Roque, and El Vapor, a steamer wrecked on
//    them.
//  · Isla Honda: the outer island to the south-east, beyond the sebadal, and Bahía Escondida, a
//    horseshoe bay of sand in its lee, with the old salt pans of Las Salinas behind it.

export const SOUTH_Z = 3000;
export const inSouth = (z) => z > SOUTH_Z;
export const BRASA = { x: 0, z: 6000 };
// The far south's sea: where its seabed is drawn and its water shaded.
export const SOUTH_RECT = { x0: -1400, x1: 1400, z0: 4600, z1: 7400 };
export const SOUTH_WATER = { x: SOUTH_RECT.x0, z: SOUTH_RECT.z0, w: SOUTH_RECT.x1 - SOUTH_RECT.x0, h: SOUTH_RECT.z1 - SOUTH_RECT.z0 };
// The chart of the islands (the archipelago's: see below). old: the chart of Brasa alone, from
// before the archipelago, so a chart explored then is laid out on this one (map.js Explored).
export const SOUTH_MAP = { x: -1300, z: 4840, w: 2600, h: 2320, old: { x: -1000, z: 5300, w: 2000, h: 1600 } };

export const ISLE = { x: 0, z: 5960, rx: 560, rz: 380 };
export const PICO = { x: -90, z: 5880, h: 330, r: 470 };
export const ROJA = { x: 310, z: 6050, h: 120, r: 175 };
export const FARO_POINT = { x0: 400, z0: 5985, x1: 700, z1: 5945, r: 62 };
export const FARO = { x: 672, z: 5947 };
export const PUERTO = { x: 40, z: 6352, r: 56 };
export const PLAYA = { x: 300, z: 6282, len: 150 };
export const SEBADAL = { x: 430, z: 6490, rx: 330, rz: 175 };
export const ARCO = { x: -470, z: 6470, r: 34, h: 46 };
export const ARCHES = [ // the arches under the water off the Roque: [x, z, yaw, span, top]
  { x: -428, z: 6528, yaw: 0.6, span: 9, top: -7 },
  { x: -452, z: 6545, yaw: 1.9, span: 7, top: -10 },
];
// El Bajón: a reef of lava pinnacles on the shelf off the harbour mouth, rising from about twenty
// metres to a few under the surface, with a yellow buoy over it. Its pinnacles are given along the
// reef (u, metres from its middle; v across it), with their tops (metres, negative: below the
// surface) and how wide they are at the foot.
export const BAJON = {
  x: -100, z: 6432, yaw: 0.35, len: 60, w: 26, buoy: { x: -118, z: 6440.5 },
  peaks: [{ u: -20, v: 2, top: -3.2, r: 9 }, { u: -4, v: -3, top: -5.5, r: 8 }, { u: 10, v: 3, top: -4.2, r: 8.5 }, { u: 23, v: -1, top: -7.5, r: 7 }],
};
// (In the reef's own frame: u along it, v across it.)
function bajonUV(x, z) {
  const c = Math.cos(BAJON.yaw), s = Math.sin(BAJON.yaw), dx = x - BAJON.x, dz = z - BAJON.z;
  return [dx * c - dz * s, dx * s + dz * c];
}
// How far up the reef's rock stands here (metres; -Infinity off the reef): a broken ridge, the
// pinnacles steep-sided and cragged, gullies between them.
export function bajonHeight(x, z) {
  const [u, v] = bajonUV(x, z);
  const e = Math.hypot(u / (BAJON.len / 2 + 6), v / (BAJON.w / 2 + 4));
  if (e > 1) return -Infinity;
  let top = -15.5 + 3.5 * smoothstep(1, 0.35, e);
  for (const p of BAJON.peaks) {
    const d = Math.hypot(u - p.u, v - p.v) / p.r;
    if (d < 1.4) top = Math.max(top, p.top - 11 * Math.pow(Math.min(d, 1.4), 1.6));
  }
  const crag = Math.abs(fbm(x * 0.32 + 4, z * 0.32 - 2, 2)) * 1.8 + fbm(x * 0.11, z * 0.11, 2) * 1.2;
  return top + crag * smoothstep(1, 0.6, e) - 2.5 * smoothstep(0.75, 1, e);
}
// On the reef (0 … 1): for its rock, its colours and its homes.
export function onBajon(x, z) {
  const [u, v] = bajonUV(x, z);
  return smoothstep(1, 0.75, Math.hypot(u / (BAJON.len / 2 + 6), v / (BAJON.w / 2 + 4)));
}
export const COLADAS = [ // lava tongues on the north-west: from inland out into the sea
  [-300, 5700, -390, 5560, 34],
  [-430, 5760, -560, 5650, 30],
  [-500, 5880, -650, 5840, 28],
];
// The village on the slope above the harbour: where its houses stand (x, z, w, d, yaw).
export const VILLAGE = { x: 40, z: 6262, r: 85, level: 3.2 };
// The harbour's quay (along the head of the basin) and its breakwater (round the east side).
// (land: the way ashore from each, for stepping off a boat facing it.)
export const QUAY_S = { x0: 6, x1: 82, z0: 6292, z1: 6301, deck: 1.6, land: { x: 40, z: 6280 } };
export const DIQUE = { x0: 92, x1: 101, z0: 6312, z1: 6402, deck: 2.4, land: { x: 96, z: 6300 } };
export const MOLE = { x0: 44, x1: 101, z0: 6394, z1: 6403, deck: 2.4, land: { x: 96, z: 6300 } };
export const SAIL_BERTH_S = { x: 46, z: 6302.6, heading: Math.PI / 2 };
// The pontoon: a floating jetty out from the quay into the basin, low on the water, with finger
// berths off it (room for the bigger boats), a gangway of steps down to it from the quay, and the
// fuel pump on the quay at its root.
export const PONTOON_S = { x0: 58.5, x1: 61.5, z0: 6301, z1: 6347, deck: 0.55, land: { x: 60, z: 6290 } };
export const FINGERS_S = [
  { x0: 61.5, x1: 73, z0: 6317, z1: 6319.2, deck: 0.5, land: { x: 60, z: 6318 } },
  { x0: 61.5, x1: 73, z0: 6333, z1: 6335.2, deck: 0.5, land: { x: 60, z: 6334 } },
  { x0: 46, x1: 58.5, z0: 6325, z1: 6327.2, deck: 0.5, land: { x: 60, z: 6326 } },
];
export const PONTOON_STEPS = [1.34, 1.08, 0.82].map((deck, i) => ({ x: 60, z: 6301.5 + i, hx: 0.9, hz: 0.5, yaw: 0, deck }));
export const FUEL_S = { x: 65, z: 6298.5, yaw: 0, name: 'the fuel pump on Puerto Brasa quay' };
// The harbour office: a white kiosk on the quay, where the harbour master has your boats brought
// round, or shipped down from Willowhaven on the supply ship.
export const HARBOUR_OFFICE = { x: 52, z: 6293.6, w: 3, d: 2.2 };
// Where you come ashore by the quay steps, and the bar with a room upstairs.
export const QUAY_STEPS = { x: 30, z: 6297 };
export const POSADA = { x: 18, z: 6276, yaw: 0 };
// Where the long passage brings you in, and where it sets out from.
export const LANDFALL = { x: 40, z: 6470, heading: Math.PI };

const sdCircle = (x, z, cx, cz, r) => Math.hypot(x - cx, z - cz) - r;

/* ---------------- the archipelago (docs/ARCHIPELAGO.md) ---------------- */

// The islands round Brasa: each an ellipse (rx, rz, turned by yaw) standing h m at its highest,
// cliffs of cliff m on its weather side, its shelf running out shelf m before the drop-off, and a
// cove cut into its lee (its beach a pale shell sand on the cove's shore: pale 0 black … 1 white).
export const GAVIOTA = { id: 'gaviota', x: 1000, z: 5180, rx: 240, rz: 150, yaw: -0.35, h: 30, cliff: 18, shelf: 120,
  cove: { x: 815, z: 5300, r: 72, pale: 1 } };
export const HONDA = { id: 'honda', x: 990, z: 6790, rx: 210, rz: 170, yaw: 0.3, h: 14, cliff: 6, shelf: 220,
  cove: { x: 845, z: 6880, r: 88, pale: 0.8 } };
export const ISLANDS = [GAVIOTA, HONDA];
// Los Roquetes: black stacks in a chain west of the Roque (x, z, r, h).
export const ROQUETES = [
  { x: -770, z: 6390, r: 22, h: 26 }, { x: -850, z: 6430, r: 16, h: 18 },
  { x: -935, z: 6470, r: 24, h: 31 }, { x: -1010, z: 6515, r: 14, h: 12 },
];
// El Banco: a seamount out in the north-west, from the deep to its top (m: negative, under).
export const BANCO = { x: -820, z: 5150, r: 270, top: -24 };
// El Estrecho: the channel between Brasa's north-east coast and Gaviota, along its axis, with the
// half-width of its sill and the sill's depth (m).
export const ESTRECHO = { x0: 470, z0: 5660, x1: 800, z1: 5330, w: 120, sill: -30 };
// El Vapor: a coasting steamer wrecked on Los Roquetes, lying on the sand on their lee side.
export const VAPOR = { x: -905, z: 6530, yaw: 2.1, len: 46, beam: 8 };
// Las Salinas: the old salt pans behind Bahía Escondida, and the hut at their head.
export const SALINAS = { x: 905, z: 6815, w: 90, d: 50, yaw: 0.3, hut: { x: 948, z: 6800 } };

// (In an island's own frame, scaled to its size: 1 at its edge.)
function islandK(I, x, z) {
  const c = Math.cos(I.yaw), s = Math.sin(I.yaw), dx = x - I.x, dz = z - I.z;
  return Math.hypot((dx * c - dz * s) / I.rx, (dx * s + dz * c) / I.rz);
}
// The island a point belongs to (on it, or in its waters): Brasa (null), or one of ISLANDS, by
// which is nearest for its size.
let _ioX = NaN, _ioZ = NaN, _io = null;
export function islandOf(x, z) {
  if (x === _ioX && z === _ioZ) return _io;
  _ioX = x;
  _ioZ = z;
  let best = null, k = Math.hypot((x - ISLE.x) / ISLE.rx, (z - ISLE.z) / ISLE.rz) * 1.25;
  for (const I of ISLANDS) {
    const ki = islandK(I, x, z);
    if (ki < k) {
      k = ki;
      best = I;
    }
  }
  return (_io = best);
}
// The channel's axis: how far a point is from it (m), and how far along (0 … 1).
function estrechoAt(x, z) {
  const E = ESTRECHO, ax = E.x1 - E.x0, az = E.z1 - E.z0, L2 = ax * ax + az * az;
  const t = clamp(((x - E.x0) * ax + (z - E.z0) * az) / L2, 0, 1);
  return { d: Math.hypot(x - (E.x0 + ax * t), z - (E.z0 + az * t)), t };
}
// In the channel (0 … 1): over its sill, between the islands.
export function inEstrecho(x, z) {
  const { d, t } = estrechoAt(x, z);
  return smoothstep(ESTRECHO.w + 60, ESTRECHO.w, d) * smoothstep(0, 0.15, t) * smoothstep(1, 0.85, t);
}
// El Banco's rock: how high it stands here (m; -Infinity off it). A broad cone with a cragged
// plateau on top, steepest on its up-current (north-east) face.
export function bancoHeight(x, z) {
  const dx = x - BANCO.x, dz = z - BANCO.z, r = Math.hypot(dx, dz) / BANCO.r;
  if (r > 1.25) return -Infinity;
  const up = smoothstep(-0.3, 0.8, (dx * 0.7 - dz * 0.7) / (Math.hypot(dx, dz) || 1)); // (north-east)
  const fall = Math.pow(Math.min(r, 1.25), lerp(1.5, 1.15, up));
  const crag = Math.abs(fbm(x * 0.05 + 1, z * 0.05 - 7, 3)) * 5 + fbm(x * 0.15, z * 0.15, 2) * 1.5;
  return BANCO.top - 6 * smoothstep(0, 0.25, r) - 175 * fall + crag * smoothstep(1, 0.4, r);
}
// On El Banco (0 … 1): for its rock, its zone and its homes.
export function onBanco(x, z) {
  return smoothstep(1, 0.75, Math.hypot(x - BANCO.x, z - BANCO.z) / BANCO.r);
}
// In an island's cove (0 … 1): its sheltered sand, and its pale beach.
export function inCove(x, z) {
  let k = 0;
  for (const I of ISLANDS) k = Math.max(k, smoothstep(I.cove.r + 50, I.cove.r * 0.5, Math.hypot(x - I.cove.x, z - I.cove.z)));
  return k;
}
// On Los Roquetes' stacks (0 … 1), and how high the tallest near here stands.
function roqueteHeight(x, z) {
  let h = -Infinity;
  for (const R of ROQUETES) {
    const d = Math.hypot(x - R.x, z - R.z);
    // (Sheer sides up from a ledge of boulders, a broken top.)
    if (d < R.r + 30) h = Math.max(h, 1 + 1.5 * smoothstep(R.r + 2, R.r * 0.85, d) + (R.h - 2.5) * Math.pow(smoothstep(R.r * 0.92, R.r * 0.62, d), 0.6) * (0.82 + 0.18 * lavaRough(x, z)));
  }
  return h;
}
function sdCapsule(x, z, ax, az, bx, bz, r) {
  const pax = x - ax, paz = z - az, bax = bx - ax, baz = bz - az;
  const h = clamp((pax * bax + paz * baz) / (bax * bax + baz * baz), 0, 1);
  return Math.hypot(pax - bax * h, paz - baz * h) - r;
}
function sdEllipse(x, z, cx, cz, rx, rz) {
  const px = x - cx, pz = z - cz;
  const k0 = Math.hypot(px / rx, pz / rz);
  const k1 = Math.hypot(px / (rx * rx), pz / (rz * rz));
  if (k1 < 1e-9) return -Math.min(rx, rz);
  return (k0 * (k0 - 1)) / Math.max(k1, 1e-6);
}
function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}
const smax = (a, b, k) => -smin(-a, -b, k);
const inBox = (B, x, z, pad = 0) => x > B.x0 - pad && x < B.x1 + pad && z > B.z0 - pad && z < B.z1 + pad;
function sdBox(x, z, B) {
  const dx = Math.max(B.x0 - x, x - B.x1), dz = Math.max(B.z0 - z, z - B.z1);
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
}
// The harbour basin: round to seaward, squared off along the quay, whose wall is its north side
// (no water behind the quay, and no land in front of it).
function sdBasin(x, z) {
  const round = sdCircle(x, z, PUERTO.x, PUERTO.z, PUERTO.r);
  const front = sdBox(x, z, { x0: QUAY_S.x0, x1: QUAY_S.x1, z0: QUAY_S.z1, z1: PUERTO.z });
  return Math.max(smin(round, front, 6), QUAY_S.z1 - z);
}

// How settled the coast is here: near the harbour and the village the shore keeps to its line
// (no wild noise), elsewhere it's ragged.
const settled = (x, z) => smoothstep(220, 90, Math.hypot(x - PUERTO.x, z - PUERTO.z + 30));

// Signed distance to the shore (negative on land): Brasa's own, and the archipelago's islands and
// stacks round it.
// (Asked again for the same point, as the zone, the habitat and the height each do in turn: the
// last answer, kept.)
let _sdfX = NaN, _sdfZ = NaN, _sdfD = 0;
export function brasaSDF(x, z) {
  if (x === _sdfX && z === _sdfZ) return _sdfD;
  _sdfX = x;
  _sdfZ = z;
  return (_sdfD = archipelagoSDF(x, z));
}
function archipelagoSDF(x, z) {
  let d = brasaIsleSDF(x, z);
  // (The archipelago: each island near enough to matter, with its cove cut into its lee; Los
  // Roquetes' stacks.)
  let n1 = null, n2 = null;
  for (const I of ISLANDS) {
    const k = islandK(I, x, z);
    if (k > 3.5) continue;
    if (n1 == null) {
      n1 = fbm(x * 0.0045 + 17, z * 0.0045 - 5, 3);
      n2 = fbm(x * 0.03 - 4, z * 0.03 + 9, 2);
    }
    const size = Math.min(I.rx, I.rz);
    let di = (k - 1) * size * 0.9 + (n1 * 26 + n2 * 6);
    di = smax(di, -(sdCircle(x, z, I.cove.x, I.cove.z, I.cove.r) + n2 * 3), 14);
    d = smin(d, di, 20);
  }
  if (Math.hypot(x - -890, z - 6450) < 420) {
    n2 ??= fbm(x * 0.03 - 4, z * 0.03 + 9, 2);
    for (const R of ROQUETES) d = smin(d, sdCircle(x, z, R.x, R.z, R.r) + n2 * 4, 3);
  }
  return d;
}
// Brasa's own shore (the island, its points and lava tongues, the harbour, the Roque): the coast the
// crossing makes for (crossing.js), without the archipelago's islands round it.
export function brasaIsleSDF(x, z) {
  const n1 = fbm(x * 0.0045 + 17, z * 0.0045 - 5, 3), n2 = fbm(x * 0.03 - 4, z * 0.03 + 9, 2);
  const calm = settled(x, z);
  let d = sdEllipse(x, z, ISLE.x, ISLE.z, ISLE.rx, ISLE.rz) + (n1 * 60 + n2 * 9) * (1 - 0.85 * calm);
  // Punta del Faro, a long tongue to the east.
  d = smin(d, sdCapsule(x, z, FARO_POINT.x0, FARO_POINT.z0, FARO_POINT.x1, FARO_POINT.z1, FARO_POINT.r + n2 * 10), 60);
  // Las Coladas: lava tongues out into the sea.
  for (const c of COLADAS) d = smin(d, sdCapsule(x, z, c[0], c[1], c[2], c[3], c[4] + n2 * 7), 26);
  // The harbour basin (its edge kept straight along the quay).
  d = smax(d, -(sdBasin(x, z) + n2 * 1.5 * smoothstep(QUAY_S.z1 + 1, QUAY_S.z1 + 8, z)), 10);
  // Roque del Arco.
  d = smin(d, sdCircle(x, z, ARCO.x, ARCO.z, ARCO.r) + n2 * 5, 4);
  return d;
}

// How rough the old lava is here (0 smooth … 1 broken): for the ground's colour and the reef.
export function lavaRough(x, z) {
  return clamp(0.5 + fbm(x * 0.05 + 3, z * 0.05 - 8, 3) * 0.9, 0, 1);
}

// Sand on the beaches: black on Playa Negra, and the shell sand of the islands' coves.
export function onBeach(x, z) {
  const u = (x - PLAYA.x) / PLAYA.len, v = (z - PLAYA.z) / 40;
  let b = smoothstep(1.15, 0.7, Math.hypot(u, v));
  for (const I of ISLANDS) b = Math.max(b, smoothstep(I.cove.r + 30, I.cove.r + 4, Math.hypot(x - I.cove.x, z - I.cove.z)));
  return b;
}
// How pale a beach's sand is here: 0 Brasa's black … 1 the islands' white shell sand.
export function beachPale(x, z) {
  let p = 0;
  for (const I of ISLANDS) p = Math.max(p, I.cove.pale * smoothstep(I.cove.r + 60, I.cove.r + 10, Math.hypot(x - I.cove.x, z - I.cove.z)));
  return p;
}

// The windward side (north and west), where the swell breaks: 0 in the lee … 1 fully exposed.
// (Round each island from its own middle: Brasa's, or the island nearest; Los Roquetes from the
// middle of their chain.)
export function windward(x, z) {
  const I = islandOf(x, z), roq = Math.hypot(x - -890, z - 6450) < 260 && !I;
  const cx = I ? I.x : roq ? -890 : ISLE.x, cz = I ? I.z : roq ? 6450 : ISLE.z;
  const a = Math.atan2(x - cx, -(z - cz)); // 0 north, π/2 east
  // (North-west round to north-east is exposed; the south is the lee.)
  return smoothstep(-0.2, 0.55, Math.cos(a + 0.55));
}

// How far out the shelf runs before the drop-off (m from the shore).
function shelfWidth(x, z) {
  const sb = smoothstep(1.3, 0.6, Math.hypot((x - SEBADAL.x) / SEBADAL.rx, (z - SEBADAL.z) / SEBADAL.rz));
  const I = islandOf(x, z), own = I ? I.shelf : 150;
  return lerp(own + fbm(x * 0.004, z * 0.004, 2) * 50, 380, sb);
}

function landHeight(x, z, inland) {
  // (The archipelago's islands and stacks: their own ground.)
  const I = islandOf(x, z);
  if (I) return islandLand(I, x, z, inland);
  const roq = roqueteHeight(x, z);
  if (roq > -Infinity && Math.hypot(x - ISLE.x, z - ISLE.z) > 700) return roq;
  const calm = settled(x, z), beach = onBeach(x, z);
  // The shore: a rim of boulders and low lava (a gentle black beach on Playa Negra).
  let h = 0.7 + lerp(2.6, 0.9, beach) * smoothstep(0, lerp(10, 26, beach), inland);
  // Sea cliffs on the windward north coast.
  const north = smoothstep(5960, 5700, z) * (1 - beach);
  h += 22 * north * smoothstep(2, 24, inland) * (0.7 + 0.3 * lavaRough(x, z));
  // The badlands rising inland, broken by old flows.
  const n = fbm(x * 0.008 + 2, z * 0.008 - 6, 3) * 0.5 + 0.5;
  h += (10 + 26 * n) * smoothstep(10, 200, inland) * (1 - 0.5 * calm);
  h += fbm(x * 0.06, z * 0.06, 2) * 1.6 * smoothstep(4, 30, inland);
  // Pico Brasa, with its crater; and Montaña Roja.
  // (Each cone's top is its crater's rim, with the bowl sunk inside it.)
  const dp = Math.hypot(x - PICO.x, z - PICO.z);
  h += PICO.h * Math.pow(Math.max(0, 1 - Math.max(dp, 48) / PICO.r), 1.65);
  h -= 38 * Math.pow(smoothstep(50, 6, dp), 0.8);
  const dr = Math.hypot(x - ROJA.x, z - ROJA.z);
  h += ROJA.h * Math.pow(Math.max(0, 1 - Math.max(dr, 24) / ROJA.r), 1.4);
  h -= 18 * Math.pow(smoothstep(26, 4, dr), 0.8);
  // Roque del Arco: a steep stack.
  const da = Math.hypot(x - ARCO.x, z - ARCO.z);
  if (da < ARCO.r + 30) h = Math.max(h, 1 + (ARCO.h - 1) * smoothstep(ARCO.r + 2, ARCO.r * 0.3, da) * (0.85 + 0.15 * lavaRough(x, z)));
  // The village: terraces stepping up from the harbour, and the waterfront level with the quay.
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  if (dv < VILLAGE.r + 60) {
    const terrace = VILLAGE.level + Math.round(Math.max(0, VILLAGE.z + 40 - z) / 16) * 2.2 * smoothstep(VILLAGE.z + 40, VILLAGE.z - 10, z);
    h = lerp(terrace, h, smoothstep(VILLAGE.r * 0.7, VILLAGE.r + 50, dv));
  }
  if (inBox({ x0: QUAY_S.x0 - 30, x1: QUAY_S.x1 + 30, z0: QUAY_S.z0 - 34, z1: QUAY_S.z1 }, x, z)) {
    const k = smoothstep(QUAY_S.z0 - 34, QUAY_S.z0 - 6, z) * smoothstep(QUAY_S.x0 - 30, QUAY_S.x0, x) * smoothstep(QUAY_S.x1 + 30, QUAY_S.x1, x);
    h = lerp(h, QUAY_S.deck, k);
  }
  return h;
}

// An island of the archipelago: a rim at the shore (low sand in its cove), cliffs on its weather
// side, a hump of old lava and scrub inland.
function islandLand(I, x, z, inland) {
  const beach = onBeach(x, z), wind = windward(x, z), rough = lavaRough(x, z);
  let h = 0.7 + lerp(2.4, 0.8, beach) * smoothstep(0, lerp(8, 22, beach), inland);
  h += I.cliff * wind * (1 - beach) * smoothstep(2, 18, inland) * (0.7 + 0.3 * rough);
  const n = fbm(x * 0.012 + I.x * 0.001, z * 0.012 - 3, 3) * 0.5 + 0.5;
  h += I.h * (0.55 + 0.45 * n) * smoothstep(8, Math.min(I.rx, I.rz) * 0.9, inland);
  h += fbm(x * 0.06, z * 0.06, 2) * 1.2 * smoothstep(4, 24, inland);
  // (Las Salinas: the salt pans, flat and low behind the bay.)
  if (I === HONDA) {
    const dx = x - SALINAS.x, dz = z - SALINAS.z, c = Math.cos(SALINAS.yaw), s = Math.sin(SALINAS.yaw);
    const u = Math.abs(dx * c - dz * s) / (SALINAS.w / 2), v = Math.abs(dx * s + dz * c) / (SALINAS.d / 2);
    h = lerp(h, 1.1, smoothstep(1.3, 0.9, Math.max(u, v)));
  }
  return h;
}

function seaHeight(x, z, d) {
  const shelf = shelfWidth(x, z), wild = windward(x, z), beach = onBeach(x, z);
  // Down the inshore slope (gentler off the beach), along the shelf, over the edge (El Veril) and
  // away into the deep.
  let h = -0.5 - lerp(17, 9, beach) * (1 - Math.exp(-d / lerp(38, 70, beach)));
  h -= 13 * smoothstep(60, shelf, d);
  h -= 62 * smoothstep(shelf, shelf + 70, d);
  h -= 130 * smoothstep(shelf + 250, shelf + 900, d);
  // El Sebadal: a broad, flat shelf of sand and seagrass.
  const sb = smoothstep(1.25, 0.75, Math.hypot((x - SEBADAL.x) / SEBADAL.rx, (z - SEBADAL.z) / SEBADAL.rz));
  if (sb > 0) h = lerp(h, Math.max(h, -8 - 5 * smoothstep(40, shelf, d) + fbm(x * 0.02, z * 0.02, 2) * 0.8), sb);
  // The reef: boulders and broken lava on the inshore slope, rougher where the swell breaks.
  const reef = (1 - smoothstep(25, 150, d)) * (1 - sb) * (0.55 + 0.45 * wild);
  h += (fbm(x * 0.07 + 11, z * 0.07 - 3, 3) * 2.6 + Math.abs(fbm(x * 0.16, z * 0.16, 2)) * 1.6) * reef;
  // The wall: steps and ledges down the drop-off.
  h += fbm(x * 0.05 - 7, z * 0.05 + 2, 2) * 4 * smoothstep(shelf - 20, shelf + 20, d) * (1 - smoothstep(shelf + 70, shelf + 140, d));
  // The harbour basin: dredged to a level four metres, quieter water than outside.
  const dh = Math.hypot(x - PUERTO.x, z - PUERTO.z);
  if (dh < PUERTO.r + 40) h = lerp(-4.2 + fbm(x * 0.1, z * 0.1, 2) * 0.3, h, smoothstep(PUERTO.r - 8, PUERTO.r + 40, dh));
  // (The archipelago) The coves: gentle sand, no reef. El Estrecho's sill between the islands.
  // El Banco standing up out of the deep.
  const cove = inCove(x, z);
  if (cove > 0) h = lerp(h, Math.max(h, -0.5 - 8 * (1 - Math.exp(-d / 55)) + fbm(x * 0.05, z * 0.05, 2) * 0.4), cove);
  const sill = inEstrecho(x, z);
  if (sill > 0) h = lerp(h, Math.max(h, ESTRECHO.sill + fbm(x * 0.03 + 3, z * 0.03, 2) * 3), sill);
  h = Math.max(h, bancoHeight(x, z));
  // El Bajón standing up off the shelf.
  return Math.max(h, bajonHeight(x, z));
}

// The ground (or seabed) height anywhere in the far south.
export function brasaHeight(x, z) {
  const d = brasaSDF(x, z);
  if (d < 0) return landHeight(x, z, -d);
  // (Just offshore the land's rim and the seabed meet at the waterline.)
  return seaHeight(x, z, d);
}

// Which water a point is in.
//  harbor  – Puerto Brasa's basin
//  lee     – the calm water along the south and east coasts
//  lava    – the rough reef of the windward north and west (Las Coladas)
//  sebadal – the seagrass shelf
//  veril   – over the drop-off
//  ocean   – the open ocean round it all
export const SOUTH_ZONES = ['harbor', 'lee', 'lava', 'sebadal', 'veril', 'ocean'];
export function brasaZone(x, z) {
  if (Math.hypot(x - PUERTO.x, z - PUERTO.z) < PUERTO.r + 6 && z < MOLE.z1 + 4) return 'harbor';
  const d = brasaSDF(x, z), shelf = shelfWidth(x, z);
  // (El Banco: a drop-off of its own, far out.)
  if (onBanco(x, z) > 0.2 && brasaHeight(x, z) > -110) return 'veril';
  if (d > shelf + 260) return 'ocean';
  if (d > shelf - 30) return 'veril';
  if (Math.hypot((x - SEBADAL.x) / SEBADAL.rx, (z - SEBADAL.z) / SEBADAL.rz) < 1 && d > 25) return 'sebadal';
  return windward(x, z) > 0.45 ? 'lava' : 'lee';
}

// The sea's current: the Canary current running south-west, a little faster off the points and
// over the drop-off, slack in the lee and the harbour. (m/s)
export function brasaCurrent(x, z, out) {
  const d = Math.max(0, brasaSDF(x, z));
  const open = smoothstep(10, 220, d);
  const lee = 1 - windward(x, z);
  let k = 0.16 * open * (1 - 0.6 * lee * (1 - smoothstep(150, 400, d)));
  // (Round the east point and off the Roque it squeezes past a little faster.)
  k += 0.12 * smoothstep(140, 30, Math.hypot(x - FARO.x, z - FARO.z)) + 0.1 * smoothstep(110, 30, Math.hypot(x - ARCO.x, z - ARCO.z));
  // (The archipelago) Squeezing through El Estrecho, faster over El Banco; slack in the coves.
  k += 0.22 * inEstrecho(x, z) + 0.1 * onBanco(x, z);
  k *= 1 - 0.9 * inCove(x, z);
  if (Math.hypot(x - PUERTO.x, z - PUERTO.z) < PUERTO.r + 10) k = 0.01;
  out.x = -0.72 * k;
  out.z = 0.69 * k;
  return out;
}

// Weed and rock on the seabed, for the plants, the fish and the fish finder: the seagrass of the
// sebadal, brown weed on the shallow reef, bare rock on the lava and the wall.
export function brasaHabitat(x, z, out) {
  const h = brasaHeight(x, z), depth = Math.max(0, -h), d = brasaSDF(x, z);
  const sb = smoothstep(1.1, 0.8, Math.hypot((x - SEBADAL.x) / SEBADAL.rx, (z - SEBADAL.z) / SEBADAL.rz));
  const grass = Math.max(sb, inCove(x, z) * 0.6) * smoothstep(3, 6, depth) * (1 - smoothstep(16, 22, depth)) * smoothstep(-0.2, 0.3, fbm(x * 0.03 + 5, z * 0.03, 2) + 0.15);
  // (The coves are sand, a little seagrass in the bays; El Banco's top is rock.)
  const cove = inCove(x, z);
  const reef = Math.max((1 - sb) * (1 - cove) * (1 - smoothstep(40, 170, d)), onBajon(x, z), onBanco(x, z) * smoothstep(-110, -40, h));
  const algae = reef * smoothstep(0.8, 2, depth) * (1 - smoothstep(10, 18, depth)) * smoothstep(-0.3, 0.2, fbm(x * 0.05 - 2, z * 0.05 + 7, 2));
  out.depth = depth;
  out.weed = clamp(Math.max(grass, algae * 0.7), 0, 1);
  out.rock = clamp(Math.max(reef * 0.85, onBajon(x, z), onBanco(x, z) * smoothstep(-110, -40, h)) + smoothstep(shelfWidth(x, z) - 25, shelfWidth(x, z) + 10, d) * (1 - smoothstep(shelfWidth(x, z) + 60, shelfWidth(x, z) + 120, d)), 0, 1);
  out.grass = grass;
  return out;
}

// Named places, found as you go (the journal's places and the chart's labels).
export const BRASA_PLACES = [
  { id: 'brasa', name: 'Las Brasas', sub: 'a volcanic island across the sea to the south', area: true, south: true, x: ISLE.x, z: ISLE.z - 80, size: 30, note: 'Black lava, red cinder and a volcano with its head in the cloud: an island across the open Atlantic to the south, in the trade wind. Warm, clear water, and fish you never see at home.' },
  { id: 'puerto', name: 'Puerto Brasa', sub: 'a little harbour, a white village and a room at the bar', camp: true, dock: true, harbour: true, south: true, x: PUERTO.x, z: PUERTO.z - 40, note: 'White houses climbing the slope above a stone harbour. Tie up at the quay; the bar on the waterfront has a room upstairs to sleep in, and a stove.' },
  { id: 'playa', name: 'Playa Negra', sub: 'a beach of black sand', south: true, x: PLAYA.x, z: PLAYA.z, note: 'Fine black sand, hot underfoot by midday. The surf here brings in white bream and palometa; out beyond, the sand runs into the sebadal.' },
  { id: 'sebadal', dive: true, name: 'El Sebadal', sub: 'a meadow of seagrass under clear water', area: true, south: true, x: SEBADAL.x, z: SEBADAL.z, note: 'A broad shallow shelf of sand and seagrass. Angel sharks lie buried in the sand here, flat as a doormat, and must be left in peace; cuttlefish, striped bream and rays feed over it.' },
  { id: 'coladas', dive: true, name: 'Las Coladas', sub: 'old lava running into the sea', south: true, x: -480, z: 5640, note: 'Tongues of black lava that ran down into the sea long ago, broken into a reef the swell works over. Parrotfish graze the rocks, triggerfish cruise above them, and morays watch from the holes.' },
  { id: 'bajon', dive: true, name: 'El Bajón', sub: 'a reef just off the harbour mouth', south: true, x: BAJON.x, z: BAJON.z, note: 'Lava pinnacles standing up off the shelf, the tallest a few metres under a yellow buoy. Sea fans, sponges and orange sun coral on their sides; parrotfish, wrasse and triggerfish over the top, morays in the cracks, a grouper in the cave at the foot. Best seen diving, or looking down from a boat over the shallowest pinnacle.' },
  { id: 'arco', name: 'Roque del Arco', sub: 'an islet with a sea arch', south: true, x: ARCO.x, z: ARCO.z, note: 'A tall rock off the south-west point with an arch the sea runs through. Under the water, more arches of old lava: a dive among barracuda and big groupers.' },
  { id: 'arcos', dive: true, name: 'Los Arcos', sub: 'arches under the water off the Roque', south: true, x: -440, z: 6537, note: 'Two arches of old lava standing on the seabed just off Roque del Arco, their tops seven and ten metres down, with a yellow buoy over them. Swim through them; groupers and morays live in the caves round their feet.' },
  { id: 'veril', dive: true, name: 'El Veril', sub: 'the drop-off into the deep blue', area: true, south: true, x: 120, z: 6600, size: 22, note: 'The edge of the island’s shelf, where the bottom falls away from twenty-odd metres into the deep. Groupers in the caves of the wall, amberjack and barracuda along the edge.' },
  { id: 'faro', name: 'Punta del Faro', sub: 'the long east point and its lighthouse', south: true, x: FARO.x, z: FARO.z, note: 'A long, low tongue of lava with a white lighthouse at its end. The current runs past the point a little faster; bluefish and little tunny hunt there.' },
  { id: 'pico', name: 'Pico Brasa', sub: 'the volcano', south: true, x: PICO.x, z: PICO.z, note: 'The old volcano in the middle of the island, three hundred metres high, its crater full of cinders. From the sea it seems to smoke when the trade-wind cloud catches on its top.' },
  // (The archipelago: docs/ARCHIPELAGO.md. r: how near you come to find it.)
  { id: 'gaviota', name: 'Isla Gaviota', sub: 'a low island up-current, and its gulls', south: true, x: GAVIOTA.x, z: GAVIOTA.z, r: 330, note: 'A low island of grey lava to the north-east, where the current comes in from the open sea. Gulls nest on its weather cliffs in their thousands; the water up-current of it is where the bait gathers, and everything that eats bait with it.' },
  { id: 'caleta', name: 'Caleta Blanca', sub: 'a cove of white shell sand', south: true, x: GAVIOTA.cove.x, z: GAVIOTA.cove.z, r: 95, note: 'A cove in Isla Gaviota’s lee, facing back across to Brasa, with a beach of white shell sand: the only white sand in the islands. Five to eight metres of clear water over sand to anchor in, and a beach to land the tender on.' },
  { id: 'estrecho', name: 'El Estrecho', sub: 'the channel between Brasa and Gaviota', area: true, south: true, x: (ESTRECHO.x0 + ESTRECHO.x1) / 2, z: (ESTRECHO.z0 + ESTRECHO.z1) / 2, size: 18, note: 'The channel between the two islands, over a sill about thirty metres down. The current squeezes through it, faster on the ebb of the trade-wind sea, and the bait it carries draws little tunny, bonito and the birds.' },
  { id: 'banco', name: 'El Banco', sub: 'a seamount out in the north-west', south: true, x: BANCO.x, z: BANCO.z, r: 200, note: 'Out in the open swell north-west of Brasa, the bottom comes up from the deep to about twenty-four metres: a mountain under the sea. Amberjack and barracuda patrol its edges, groupers live in its rock, and the current welling up its north-east face brings the bait.' },
  { id: 'roquetes', name: 'Los Roquetes', sub: 'a chain of black stacks', south: true, x: -890, z: 6450, r: 160, note: 'Four black stacks in a line west of Roque del Arco, the tallest thirty metres, with channels of clear water between them. A steamer lies wrecked on their lee side.' },
  { id: 'vapor', name: 'El Vapor', sub: 'a steamer wrecked on Los Roquetes', south: true, x: VAPOR.x, z: VAPOR.z, r: 60, note: 'An old coasting steamer, driven onto Los Roquetes in a winter gale and lying on the sand in their lee, about twelve metres down: her bow, her boiler and the ribs of her hull, grown over with sponges, the fish living in her.' },
  { id: 'honda', name: 'Isla Honda', sub: 'the outer island, low and sandy', south: true, x: HONDA.x, z: HONDA.z, r: 300, note: 'The outer island to the south-east, beyond the sebadal: low lava and sand, salt scrub, and a bay in its lee that you’d sail past without seeing.' },
  { id: 'escondida', name: 'Bahía Escondida', sub: 'a horseshoe bay of sand', south: true, x: HONDA.cove.x, z: HONDA.cove.z, r: 110, note: 'A horseshoe bay in Isla Honda’s lee, sand at four to eight metres, sheltered from everything but the south: the best anchorage in the islands. Rays feed over the sand; behind the beach lie the old salt pans.' },
  { id: 'salinas', name: 'Las Salinas', sub: 'the old salt works', south: true, x: SALINAS.x, z: SALINAS.z, r: 60, note: 'The salt pans behind Bahía Escondida, their low walls still standing, and the stone hut where the salt was kept. Nobody has worked them in a lifetime; the sea comes in at the big tides and the salt still crusts in the corners.' },
];
