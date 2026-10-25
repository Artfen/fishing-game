import { clamp, lerp, smoothstep, fbm } from '../util.js';

// Las Brasas: a volcanic island far to the south, four days' sail down the Atlantic from Willow
// Bay, like the Canaries (an invented island, not a real one). It lies in the same world as home,
// a long way off the bottom of the chart (everything south of SOUTH_Z is the far south), so the
// boats, the fish, the water and the weather all work there as they do at home; you only ever get
// there by the long passage (see passage.js), never by sailing the whole way.
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

export const SOUTH_Z = 3000;
export const inSouth = (z) => z > SOUTH_Z;
export const BRASA = { x: 0, z: 6000 };
// The far south's sea: where its seabed is drawn and its water shaded.
export const SOUTH_RECT = { x0: -1400, x1: 1400, z0: 4600, z1: 7400 };
export const SOUTH_WATER = { x: SOUTH_RECT.x0, z: SOUTH_RECT.z0, w: SOUTH_RECT.x1 - SOUTH_RECT.x0, h: SOUTH_RECT.z1 - SOUTH_RECT.z0 };
// The chart of the island.
export const SOUTH_MAP = { x: -1000, z: 5300, w: 2000, h: 1600 };

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
// Where you come ashore by the quay steps, and the bar with a room upstairs.
export const QUAY_STEPS = { x: 30, z: 6297 };
export const POSADA = { x: 18, z: 6276, yaw: 0 };
// Where the long passage brings you in, and where it sets out from.
export const LANDFALL = { x: 40, z: 6470, heading: Math.PI };

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

// Signed distance to the shore (negative on land).
export function brasaSDF(x, z) {
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

// Black sand on Playa Negra.
export function onBeach(x, z) {
  const u = (x - PLAYA.x) / PLAYA.len, v = (z - PLAYA.z) / 40;
  return smoothstep(1.15, 0.7, Math.hypot(u, v));
}

// The windward side (north and west), where the swell breaks: 0 in the lee … 1 fully exposed.
export function windward(x, z) {
  const a = Math.atan2(x - ISLE.x, -(z - ISLE.z)); // 0 north, π/2 east
  // (North-west round to north-east is exposed; the south is the lee.)
  return smoothstep(-0.2, 0.55, Math.cos(a + 0.55));
}

// How far out the shelf runs before the drop-off (m from the shore).
function shelfWidth(x, z) {
  const sb = smoothstep(1.3, 0.6, Math.hypot((x - SEBADAL.x) / SEBADAL.rx, (z - SEBADAL.z) / SEBADAL.rz));
  return lerp(150 + fbm(x * 0.004, z * 0.004, 2) * 50, 380, sb);
}

function landHeight(x, z, inland) {
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
  return h;
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
  const grass = sb * smoothstep(3, 6, depth) * (1 - smoothstep(16, 22, depth)) * smoothstep(-0.2, 0.3, fbm(x * 0.03 + 5, z * 0.03, 2) + 0.15);
  const reef = (1 - sb) * (1 - smoothstep(40, 170, d));
  const algae = reef * smoothstep(0.8, 2, depth) * (1 - smoothstep(10, 18, depth)) * smoothstep(-0.3, 0.2, fbm(x * 0.05 - 2, z * 0.05 + 7, 2));
  out.depth = depth;
  out.weed = clamp(Math.max(grass, algae * 0.7), 0, 1);
  out.rock = clamp(reef * 0.85 + smoothstep(shelfWidth(x, z) - 25, shelfWidth(x, z) + 10, d) * (1 - smoothstep(shelfWidth(x, z) + 60, shelfWidth(x, z) + 120, d)), 0, 1);
  out.grass = grass;
  return out;
}

// Named places, found as you go (the journal's places and the chart's labels).
export const BRASA_PLACES = [
  { id: 'brasa', name: 'Las Brasas', sub: 'a volcanic island, four days south', area: true, south: true, x: ISLE.x, z: ISLE.z - 80, size: 30, note: 'Black lava, red cinder and a volcano with its head in the cloud: an island four days’ sail to the south, in the trade wind. Warm, clear water, and fish you never see at home.' },
  { id: 'puerto', name: 'Puerto Brasa', sub: 'a little harbour, a white village and a room at the bar', camp: true, dock: true, harbour: true, south: true, x: PUERTO.x, z: PUERTO.z - 40, note: 'White houses climbing the slope above a stone harbour. Tie up at the quay; the bar on the waterfront has a room upstairs to sleep in, and a stove.' },
  { id: 'playa', name: 'Playa Negra', sub: 'a beach of black sand', south: true, x: PLAYA.x, z: PLAYA.z, note: 'Fine black sand, hot underfoot by midday. The surf here brings in white bream and palometa; out beyond, the sand runs into the sebadal.' },
  { id: 'sebadal', name: 'El Sebadal', sub: 'a meadow of seagrass under clear water', area: true, south: true, x: SEBADAL.x, z: SEBADAL.z, note: 'A broad shallow shelf of sand and seagrass. Angel sharks lie buried in the sand here, flat as a doormat, and must be left in peace; cuttlefish, striped bream and rays feed over it.' },
  { id: 'coladas', name: 'Las Coladas', sub: 'old lava running into the sea', south: true, x: -420, z: 5700, note: 'Tongues of black lava that ran down into the sea long ago, broken into a reef the swell works over. Parrotfish graze the rocks, triggerfish cruise above them, and morays watch from the holes.' },
  { id: 'arco', name: 'Roque del Arco', sub: 'an islet with a sea arch', south: true, x: ARCO.x, z: ARCO.z, note: 'A tall rock off the south-west point with an arch the sea runs through. Under the water, more arches of old lava: a dive among barracuda and big groupers.' },
  { id: 'veril', name: 'El Veril', sub: 'the drop-off into the deep blue', area: true, south: true, x: 120, z: 6600, size: 22, note: 'The edge of the island’s shelf, where the bottom falls away from twenty-odd metres into the deep. Groupers in the caves of the wall, amberjack and barracuda along the edge.' },
  { id: 'faro', name: 'Punta del Faro', sub: 'the long east point and its lighthouse', south: true, x: FARO.x, z: FARO.z, note: 'A long, low tongue of lava with a white lighthouse at its end. The current runs past the point a little faster; bluefish and little tunny hunt there.' },
  { id: 'pico', name: 'Pico Brasa', sub: 'the volcano', south: true, x: PICO.x, z: PICO.z, note: 'The old volcano in the middle of the island, three hundred metres high, its crater full of cinders. From the sea it seems to smoke when the trade-wind cloud catches on its top.' },
];
