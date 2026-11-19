import { HAVEN_HOUSES, HAVEN_QUAY, HAVEN_MARKET, HAVEN_BENCH, SLIPWAY, STRAND, STACKS, HAVEN_FINGERS, HAVEN_PONTOON, VISITOR_FINGERS, HARBOUR_OFFICE, QUAY, COVE_PIER, WEND_CAMP, WEND_HUT, GANNET_CAMP, walkHeight, heightAt } from './world/terrain.js';
import { POSADA, QUAY_S } from './world/brasa.js';
import { fishById } from './fish.js';
import { seeded } from './util.js';
import { ROOM_PLACES, ROOM_WAY, insideHaven } from './world/havenHouses.js';
import { lower } from './innTalk.js';
import { $t } from './i18n.js';

// The people of Willowhaven (and Paco at Las Brasas), going about their days: what they do hour by
// hour, worked out from the clock and the weather and what the fish are up to, and where that puts
// them. (How they look is world/folk.js; this is only where and what.)
//
//  · Mags Pennock keeps the fish market, five in the morning till seven at night.
//  · Old Bert Hale has the chandlery: a chair by its door on a fine morning.
//  · Ruth Alder keeps The Lobster Pot; out front first thing, sweeping, and a breather on the bench.
//  · Dougie Ferris works lobster pots off Gull Rock from his boat, the Morning Star: out from her
//    mooring at first light, hauling each pot, in at noon to land his catch on the quay. When it's
//    blowing he stays in, mends pots on the apron, and fishes in the lee of the quay instead.
//  · Hettie Moss is the keenest angler on the coast, and goes where the fish are: Shell Strand for
//    the bass at dawn and dusk, the end of the quay when the mackerel are in, the squid under the
//    quay light at night, the sheltered water in a blow. Now and then she lands one.
//  · Kit crabs off the quay on a fine day.
//  · Ian Rennie, a retired schoolmaster, takes his skiff the Bonny Jean out past the Calf on a calm
//    afternoon, feathering for mackerel.
//  · Now and then a little cruising boat, the Puffin, sails in of an afternoon to anchor in the bay
//    for the night, and sails on next morning (or waits for a blow to pass).
//  · Paco, at Las Brasas, stands in the door of Bar El Muelle; Chano takes his boat, the Virgen del
//    Carmen, out to El Bajón at sunrise, handlines over the pinnacles, and lands his catch at the
//    quay steps for Paco's kitchen; afternoons and evenings he sits outside the bar.
//  · Nayra Cabrera runs Buceo Las Brasas, the dive school: her boat is up at the west end of the
//    waterfront with a cracked keel, and she's at it with a sanding block morning and afternoon,
//    out of the rain; late morning she's on the quay by the steps with her tanks, for anyone who
//    wants to dive; lunch and the evening at a table outside the bar.
//  · Agustín, the oldest of the cofradía's fishermen, mends nets on the quay by the fuel pump of
//    a morning and, after his siesta, of a fine afternoon; towards sunset he walks out along the
//    dique to look at the weather, then sits with Chano outside the bar.
//  · Bryn Tregear keeps Wend Quay and its camp, and lives in the hut above it: he sweeps the quay
//    first thing, fishes for the mullet off the end of it through the morning and again of a fair
//    evening (now and then he has one), puts the camp to rights after lunch, and sits on its bench
//    till dark.
//  · Fen Hollis is the Marine Trust's seabird warden on Gannet Isle for the season (spring and
//    summer): she counts the colony from the clifftop over Puffin Cove at dawn and through the
//    afternoon, watches from the landing stage of a morning, writes up her counts in the bivouac,
//    eats on the driftwood log, and at dusk counts the shearwaters gathering off the island's east
//    side. In autumn and winter the birds have gone, and so has she.
//
// Everyone walks at a stroll (1.3 m/s, so an hour of the game's clock covers about fifty metres)
// along paths that keep clear of the buildings, walls and clutter (a little grid search over the
// harbour); somewhere further (Shell Strand) they go by bike, out of sight.

export const HOUR_SECONDS = 40;
const WALK = 1.3 * HOUR_SECONDS;  // metres per game hour on foot
const BIKE = 5 * HOUR_SECONDS;
const BOAT = 5 * HOUR_SECONDS;    // the Morning Star at a steady cruise
const SLOW = 1.8 * HOUR_SECONDS;  // round the harbour, and between pots

export const FOLK = {
  mags: { name: $t('Mags Pennock'), short: $t('Mags'), role: $t('the fishmonger'), home: 'gull' },
  bert: { name: $t('Old Bert Hale'), short: $t('Bert'), role: $t('the chandler'), home: 'shopUp' },
  ruth: { name: $t('Ruth Alder'), short: $t('Ruth'), role: $t('keeps The Lobster Pot'), home: 'innUp' },
  dougie: { name: $t('Dougie Ferris'), short: $t('Dougie'), role: $t('the lobsterman'), home: 'rose' },
  hettie: { name: $t('Hettie Moss'), short: $t('Hettie'), role: $t('an angler'), home: 'east' },
  kit: { name: $t('Kit'), short: $t('Kit'), role: $t('a boy who fishes off the quay'), home: 'net' },
  ian: { name: $t('Ian Rennie'), short: $t('Ian'), role: $t('a retired schoolmaster with a skiff'), home: 'east' },
  wenna: { name: $t('Morwenna Penhallow'), short: $t('Wenna'), role: $t('the harbourmaster'), home: 'innUp' },
  paco: { name: $t('Paco'), short: $t('Paco'), role: $t('Bar El Muelle'), home: 'paco', south: true },
  chano: { name: $t('Chano'), short: $t('Chano'), role: $t('a fisherman of Puerto Brasa'), home: 'chanoHome', south: true },
  nayra: { name: $t('Nayra Cabrera'), short: $t('Nayra'), role: $t('runs Buceo Las Brasas, the dive school'), home: 'nayraHome', south: true },
  agustin: { name: $t('Agustín'), short: $t('Agustín'), role: $t('the oldest of the cofradía’s fishermen'), home: 'agustinHome', south: true },
  // (G9b) The small harbours': walked straight to their places (remote), as the island's are.
  bryn: { name: $t('Bryn Tregear'), short: $t('Bryn'), role: $t('keeps Wend Quay and its camp'), home: 'brynHut', remote: true },
  fen: { name: $t('Fen Hollis'), short: $t('Fen'), role: $t('the Marine Trust’s seabird warden on Gannet Isle'), home: 'bivouac', remote: true },
};
export const FOLK_IDS = Object.keys(FOLK);

const house = (id) => HAVEN_HOUSES.find((b) => b.id === id);
const local = (b, lx, lz) => {
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
};
const doorOf = (id, out = 1.2) => {
  const b = house(id);
  const p = local(b, b.doorX ?? 0, b.d / 2 + out);
  return { x: p.x, z: p.z, yaw: b.yaw };
};
const Q = HAVEN_QUAY, M = HAVEN_MARKET;

// (G9b) The foot of Wend Quay (Bryn's hut is world/terrain.js's WEND_HUT), and the ways round
// Puffin Cove's camp: between the tackle box and the bivouac, the root of the landing stage, up
// past the driftwood log to the slope, and round the front of the bivouac to the east.
const WEND_FOOT = { x: QUAY.land.x - 3.5, z: QUAY.land.z };
const COVE_CAMP = { x: GANNET_CAMP.x + 0.5, z: GANNET_CAMP.z };
const COVE_FOOT = { x: COVE_PIER.land.x, z: COVE_PIER.land.z + 1.2 };
const COVE_UP = { x: GANNET_CAMP.x - 3.5, z: GANNET_CAMP.z + 7 };
const COVE_EAST = { x: GANNET_CAMP.x + 5.5, z: GANNET_CAMP.z + 1 };

// Where people go, and which way they face there (yaw: 0 is +z, towards the bay).
export const SPOTS = {
  rose: doorOf('rose'), gull: doorOf('gull'), net: doorOf('net'),
  inn: { ...doorOf('inn', 0.5), yaw: 0 },
  innFront: { x: 9.6, z: -99.6, yaw: 0.4 },
  chandlery: doorOf('chandlery', 0.6),
  chair: { x: -4.2, z: -100.6, yaw: 0 },
  slab: { x: M.x, z: M.z - 0.7, yaw: 0 },
  bench: { x: HAVEN_BENCH.x - 0.4, z: HAVEN_BENCH.z + 0.45, yaw: 0 },
  pots: { x: 3.4, z: -98.5, yaw: -2.4 },
  quayEnd: { x: 9.3, z: Q.z1 - 1.5, yaw: 0 },
  crab: { x: Q.x1 - 0.12, z: -88.2, yaw: Math.PI / 2 },
  lee: { x: Q.x0 + 0.35, z: -91.8, yaw: -Math.PI / 2 },
  slipway: { x: SLIPWAY.x + 0.2, z: -92.5, yaw: 0 },
  east: { x: 27.2, z: -95.6, yaw: Math.PI / 2 },
  // The harbour office's side door, and the top of the gangway, looking over the pontoon.
  office: { x: HARBOUR_OFFICE.x + HARBOUR_OFFICE.w / 2 + 0.6, z: HARBOUR_OFFICE.z - 0.2, yaw: -Math.PI / 2 },
  gangway: { x: 10.9, z: Q.z1 - 3.2, yaw: 0 },
  strand: { x: STRAND.x - 1, z: STRAND.z + 4.5, yaw: 0 },
  // Puerto Brasa (south: walked to straight across the open waterfront, never by Willowhaven's
  // paths): Paco's door, Chano's door up the lane, the quay steps, and the table outside the bar.
  paco: { x: POSADA.x - 1.2, z: POSADA.z + 5.8, yaw: 0, south: true },
  chanoHome: { x: -4, z: 6290, yaw: 0, south: true },
  steps: { x: 30, z: QUAY_S.z1 - 1.6, yaw: 0, south: true },
  barTable: { x: POSADA.x + 2.6, z: POSADA.z + 7, yaw: -Math.PI / 2, south: true },
  // (Nayra: her door, her boat up at the west end of the waterfront (brasaWorld.js, the first of
  // the boats pulled up), her tanks on the quay by the steps, a table of her own outside the bar.
  // Agustín: his door, his nets on the quay by the fuel pump, the dique, and the other chair at
  // Chano's table (world/folk.js's terrace: across it from Chano's).)
  nayraHome: { x: 4, z: 6284, yaw: 0, south: true },
  hull: { x: -3.9, z: 6296.2, yaw: -Math.PI / 2, south: true },
  tanks: { x: 24, z: QUAY_S.z1 - 1.6, yaw: 0, south: true },
  nayraTable: { x: POSADA.x - 2.3, z: POSADA.z + 6.2, yaw: -Math.PI / 2, south: true },
  agustinHome: { x: 76, z: 6284, yaw: 0, south: true },
  nets: { x: 74, z: 6296, yaw: 0, south: true },
  dique: { x: 96.5, z: 6318, yaw: Math.PI / 2, south: true },
  barTable2: { x: POSADA.x + 1.1, z: POSADA.z + 7, yaw: Math.PI / 2, south: true },
  // The small harbours (remote: walked to straight, by way of the points in `way`, from where the
  // way starts: onto the quay at its foot, or round the camp's things).
  // (Bryn: his hut's door (world/regions.js), the quay he sweeps, the end of it where he fishes
  // for the mullet, the camp's bench, and the pitch beside the tent.)
  brynHut: { x: WEND_HUT.x - 0.5, z: WEND_HUT.z - WEND_HUT.d / 2 - 0.8, yaw: Math.PI, remote: true },
  quayTop: { x: QUAY.land.x + 4.5, z: QUAY.land.z - 0.2, yaw: Math.PI / 2, remote: true, way: [WEND_FOOT] },
  mulletEnd: { x: QUAY.end.x - 0.6, z: QUAY.end.z - 0.3, yaw: Math.PI / 2 + 0.25, remote: true, way: [WEND_FOOT] },
  wendBench: { x: WEND_CAMP.x + 1.2, z: WEND_CAMP.z - 2.32, yaw: 0, remote: true },
  pitch: { x: WEND_CAMP.x - 0.4, z: WEND_CAMP.z + 4.4, yaw: -2.5, remote: true },
  // (Fen: the bivouac's door (it faces the cove), the driftwood log, the end of the landing stage,
  // the clifftop over the cove and its puffins, and the island's east side, over the sea.)
  bivouac: { x: GANNET_CAMP.x + 2.6, z: GANNET_CAMP.z + 1.3, yaw: Math.PI, remote: true },
  fenLog: { x: GANNET_CAMP.x - 0.3, z: GANNET_CAMP.z + 4.5, yaw: -Math.PI + 0.3, seat: 0.4, remote: true, way: [COVE_CAMP] },
  stage: { x: COVE_PIER.end.x, z: COVE_PIER.end.z + 0.9, yaw: Math.PI, remote: true, way: [COVE_CAMP, COVE_FOOT] },
  cliff: { x: GANNET_CAMP.x - 11, z: GANNET_CAMP.z + 26, yaw: Math.PI - 0.15, remote: true, way: [COVE_CAMP, COVE_UP] },
  headland: { x: GANNET_CAMP.x + 25, z: GANNET_CAMP.z + 29, yaw: Math.PI / 2 - 0.3, remote: true, way: [COVE_EAST] },
  // Inside the chandlery and The Lobster Pot (see world/havenHouses.js): Bert behind his counter,
  // Ruth behind her bar, the regulars at the bar, the tables and the settle by the fire.
  ...ROOM_PLACES,
  // (Upstairs, over the bar and over the shop: gone up from behind the bar or the counter.)
  innUp: { ...ROOM_PLACES.innBar }, shopUp: { ...ROOM_PLACES.shopCounter },
};
// Each boat's skipper, and where they come ashore from her.
const BOAT_OF = { dougie: 'star', ian: 'jean', chano: 'carmen' };
const ASHORE = { dougie: 'slipway', ian: 'slipway', chano: 'steps' };
// Places reached by bike (out of sight on the way), not on foot.
const FAR = new Set(['strand']);
// Where someone fishes, in words.
const WHERE = { strand: $t('on Shell Strand'), quayEnd: $t('off the end of the quay'), slipway: $t('by the slipway'), lee: $t('in the lee of the quay'), mulletEnd: $t('off Wend Quay') };

// Dougie's boat: her mooring off the quay, where she lands at the quay's end, and the pots.
export const MOORING = { x: 17, z: -79.6, heading: Math.PI };
export const LANDING = { x: Q.x1 + 1.45, z: Q.z1 - 3.2, heading: Math.PI };
const G = STACKS[0];
export const POTS = [[G.x + 18, G.z - 8], [G.x + 28, G.z + 17], [G.x + 8, G.z + 32], [G.x - 17, G.z + 27], [G.x - 27, G.z + 2]].map(([x, z]) => ({ x, z }));
// (Out round the east end of the pontoon's fingers, clear of the berths.)
export const ROUTE_OUT = [[MOORING.x, MOORING.z], [32.5, -77.5], [36, -60], [35.5, -38], [30, 10], [5, 55], [-25, 85], [POTS[0].x, POTS[0].z]].map(([x, z]) => ({ x, z }));
const pts = (a) => a.map(([x, z]) => ({ x, z }));
// The other boats that go out: Ian's skiff from the other mooring off the quay, out past the Calf
// to drift for mackerel; Chano's boat from her mooring in Puerto Brasa's basin, out through the
// harbour mouth to El Bajón, back to land his catch at the quay steps.
export const OUTINGS = {
  jean: {
    owner: 'ian', name: $t('Bonny Jean'), kind: 'skiff', start: 14.1, target: 'mackerel', where: $t('from the Bonny Jean, out past the Calf'), south: false,
    mooring: { x: 25, z: -80.5, heading: Math.PI },
    route: pts([[25, -80.5], [32.5, -77.5], [36, -60], [35.5, -38], [33, -25], [32, 12], [36, 26]]), drift: pts([[36, 26], [46, 34]]), fishHours: 2.4,
  },
  carmen: {
    owner: 'chano', name: $t('Virgen del Carmen'), kind: 'skiff', start: 6.9, target: 'parrotfish', where: $t('over El Bajón'), south: true,
    mooring: { x: 34, z: 6318, heading: Math.PI },
    route: pts([[34, 6318], [37, 6372], [25, 6408], [-60, 6432], [-108, 6437]]), drift: pts([[-108, 6437], [-100, 6431]]), fishHours: 3,
    landing: { x: 30, z: QUAY_S.z1 + 1.35, heading: Math.PI / 2 },
    home: pts([[-100, 6431], [-60, 6432], [25, 6408], [37, 6372], [34, 6330], [31, 6306], [30, QUAY_S.z1 + 1.35]]),
  },
};
// The marina's boats (see terrain.js HAVEN_FINGERS). A berth alongside finger f, on its seaward
// (side +1) or landward side, bow out, `slot` metres further out along it.
const SIZES = { cabin: [6.2, 1.0], skiff: [3.8, 0.8], sail: [4.9, 0.84], cruiser: [9.2, 1.5], console: [7.4, 1.25] };
export function fingerBerth(f, side, kind, slot = 0) {
  const F = HAVEN_FINGERS[f], [L, Bm] = SIZES[kind], east = F.x0 >= HAVEN_PONTOON.x1, along = 0.6 + L / 2 + slot;
  return { x: east ? F.x0 + along : F.x1 - along, z: side > 0 ? F.z1 + Bm + 0.25 : F.z0 - Bm - 0.25, heading: east ? Math.PI / 2 : -Math.PI / 2 };
}
// Locals' boats lying on their berths (their owners away: they don't go out while you're about).
export const LOCAL_BOATS = {
  bluebell: { kind: 'cabin', at: fingerBerth(0, 1, 'cabin') },
  tern: { kind: 'skiff', at: fingerBerth(1, -1, 'skiff', 1) },
  marigold: { kind: 'sail', at: fingerBerth(1, 1, 'sail') },
  ladyellen: { kind: 'cruiser', at: fingerBerth(3, -1, 'cruiser') },
  osprey: { kind: 'console', at: fingerBerth(3, 1, 'console') },
};
// The Sea Wren: a charter boat, out of a fair morning with a party to fish off Gull Rock. (She
// lies bow in, having come home that way: see charterLegs.)
const WREN_BERTH = { ...fingerBerth(0, -1, 'console'), heading: -Math.PI / 2 };
export const CHARTER = {
  name: $t('Sea Wren'), kind: 'console', start: 9, chance: 0.7, mooring: WREN_BERTH,
  route: [[WREN_BERTH.x, WREN_BERTH.z], [32.5, -74.5], [36, -60], [35.5, -38], [30, 10], [5, 55], [G.x - 40, G.z - 4]].map(([x, z]) => ({ x, z })),
  drift: [[G.x - 40, G.z - 4], [G.x - 46, G.z + 2]].map(([x, z]) => ({ x, z })), fishHours: 2.6,
};
// The Halcyon: a motor yacht cruising the coast, in to the visitors' pontoon some afternoons,
// away again next morning.
const V0 = VISITOR_FINGERS[0];
export const CALLER = {
  name: $t('Halcyon'), kind: 'cruiser', arrive: 15.6, leave: 9.4, chance: 0.35,
  berth: { x: V0.x0 + 0.6 + 4.6, z: V0.z1 + 1.5 + 0.25, heading: -Math.PI / 2 },
  // (In round the north of the shoals off Shell Strand, then down the deep water into the bay.)
  route: [[300, 240], [150, 110], [100, 63], [46, 61], [43, 10], [40, -30], [33, -42.55], [V0.x0 + 5.2, V0.z1 + 1.75]].map(([x, z]) => ({ x, z })),
};
// Two kayaks out from the slipway of a fine spring or summer afternoon, round the west of the
// bay and back.
export const PADDLE = {
  start: 14.6, chance: 0.6, speed: 48, // metres an hour of the game's clock: about 1.2 m/s
  loop: [[-11, -88], [-20, -78], [-30, -62], [-33, -45], [-26, -36], [-16, -42], [-12, -60], [-11, -88]].map(([x, z]) => ({ x, z })),
};

// The Puffin: in from the open sea of an afternoon to anchor in the bay; out again next morning.
export const PUFFIN = {
  name: $t('Puffin'), kind: 'sail', arrive: 14.5, leave: 9, chance: 0.4,
  route: pts([[260, 330], [150, 170], [60, 80], [0, 45], [-25, 10], [-32, -30], [-27, -52]]),
};
const SAIL = 4 * HOUR_SECONDS;

/* ---- the paths round the harbour ---- */

const GRID = { x0: -32, x1: 40, z0: -118, z1: -79, s: 0.5 };
export class Paths {
  constructor(obstacles) {
    const G0 = GRID;
    this.nx = Math.round((G0.x1 - G0.x0) / G0.s) + 1;
    this.nz = Math.round((G0.z1 - G0.z0) / G0.s) + 1;
    this.free = new Uint8Array(this.nx * this.nz);
    this.h = new Float32Array(this.nx * this.nz);
    const near = obstacles.filter((o) => o.x > G0.x0 - 3 && o.x < G0.x1 + 3 && o.z > G0.z0 - 3 && o.z < G0.z1 + 3);
    for (let i = 0; i < this.nx; i++) {
      for (let k = 0; k < this.nz; k++) {
        const x = G0.x0 + i * G0.s, z = G0.z0 + k * G0.s;
        const h = walkHeight(x, z);
        this.h[k * this.nx + i] = h;
        let ok = h > 0.25;
        if (ok) for (const o of near) if (Math.hypot(x - o.x, z - o.z) < o.r + 0.32) { ok = false; break; }
        this.free[k * this.nx + i] = ok ? 1 : 0;
      }
    }
    // Too steep to walk: a step of more than ~0.9 m per metre to any neighbour.
    const steep = new Uint8Array(this.free);
    for (let i = 1; i < this.nx - 1; i++) {
      for (let k = 1; k < this.nz - 1; k++) {
        const c = k * this.nx + i;
        if (!this.free[c]) continue;
        for (const d of [1, -1, this.nx, -this.nx]) if (Math.abs(this.h[c] - this.h[c + d]) > 0.9 * G0.s * 1.35) steep[c] = 0;
      }
    }
    this.free = steep;
  }
  cell(x, z) {
    const i = Math.round((x - GRID.x0) / GRID.s), k = Math.round((z - GRID.z0) / GRID.s);
    return i >= 0 && k >= 0 && i < this.nx && k < this.nz ? k * this.nx + i : -1;
  }
  ok(x, z) {
    const c = this.cell(x, z);
    return c >= 0 && !!this.free[c];
  }
  // The nearest walkable cell to (x, z).
  snap(x, z) {
    if (this.ok(x, z)) return { x, z };
    for (let r = GRID.s; r < 6; r += GRID.s) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos((a / 16) * Math.PI * 2) * r, pz = z + Math.sin((a / 16) * Math.PI * 2) * r;
        if (this.ok(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }
  // A clear line between two points (sampled every quarter metre)?
  clear(a, b) {
    const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(L / 0.25);
    for (let i = 1; i < n; i++) if (!this.ok(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
    return true;
  }
  // The way from a to b: a search over the grid, then pulled straight between corners.
  route(a, b) {
    const s = this.snap(a.x, a.z), e = this.snap(b.x, b.z);
    const start = this.cell(s.x, s.z), goal = this.cell(e.x, e.z);
    if (start < 0 || goal < 0) return [a, b];
    if (this.clear(s, e)) return [a, ...(s.x !== a.x || s.z !== a.z ? [s] : []), ...(e.x !== b.x || e.z !== b.z ? [e] : []), b];
    const nx = this.nx, N = this.free.length;
    const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
    const gi = goal % nx, gk = Math.floor(goal / nx);
    const hh = (c) => {
      const dx = Math.abs((c % nx) - gi), dz = Math.abs(Math.floor(c / nx) - gk);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    // (A small binary heap of [f, cell].)
    const heap = [];
    const push = (f, c) => {
      heap.push([f, c]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    g[start] = 0;
    push(hh(start), start);
    const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false;
    while (heap.length) {
      const [, c] = pop();
      if (shut[c]) continue;
      shut[c] = 1;
      if (c === goal) {
        found = true;
        break;
      }
      const ci = c % nx, ck = Math.floor(c / nx);
      for (const [di, dk, w] of STEPS) {
        const i = ci + di, k = ck + dk;
        if (i < 0 || k < 0 || i >= nx || k >= this.nz) continue;
        const n = k * nx + i;
        if (!this.free[n] || shut[n]) continue;
        if (di && dk && (!this.free[ck * nx + i] || !this.free[k * nx + ci])) continue;
        const ng = g[c] + w;
        if (ng < g[n]) {
          g[n] = ng;
          came[n] = c;
          push(ng + hh(n), n);
        }
      }
    }
    if (!found) return [a, b];
    const cells = [];
    for (let c = goal; c >= 0; c = came[c]) cells.push({ x: GRID.x0 + (c % nx) * GRID.s, z: GRID.z0 + Math.floor(c / nx) * GRID.s });
    cells.reverse();
    // String-pulling: from each corner, on to the furthest point in clear sight.
    const out = [a];
    let at = s;
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && !this.clear(at, cells[j])) j--;
      at = cells[j];
      out.push(at);
      i = j;
    }
    out.push(b);
    return out;
  }
}
export const pathLength = (P) => P.reduce((L, p, i) => (i ? L + Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z) : 0), 0);
// The point (and heading) a distance s along a path.
export function along(P, s) {
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], L = Math.hypot(b.x - a.x, b.z - a.z);
    if (s <= L || i === P.length - 1) {
      const k = L > 0 ? Math.min(1, Math.max(0, s / L)) : 1;
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    s -= L;
  }
  const p = P[P.length - 1];
  return { x: p.x, z: p.z, yaw: 0 };
}

/* ---- their days ---- */

// A day's dice, the same for everyone who asks.
const dayDice = (day, salt) => seeded(day * 7919 + salt)();
// Will Dougie go out? Not in a storm, a gale or a downpour.
export const fitForSea = (ctx) => (ctx.storm ?? 0) < 0.3 && (ctx.wind ?? 0) < 11 && (ctx.rain ?? 0) < 0.85;
const fair = (ctx) => (ctx.storm ?? 0) < 0.25 && (ctx.rain ?? 0) < 0.3;
// Ian only goes out on a calm, dry afternoon; Chano unless the trade wind's blowing a gale (El
// Bajón is in the island's lee); the Puffin wants a sailing breeze, and no storm.
export const calmSea = (ctx) => (ctx.storm ?? 0) < 0.2 && (ctx.wind ?? 0) < 8 && (ctx.rain ?? 0) < 0.4 && ctx.season !== 'winter';
export const chanoSea = (ctx) => (ctx.storm ?? 0) < 0.3 && (ctx.wind ?? 0) < 13.5 && (ctx.rain ?? 0) < 0.7;
export const sailingWeather = (ctx) => (ctx.storm ?? 0) < 0.25 && (ctx.wind ?? 0) > 2 && (ctx.wind ?? 0) < 11.5;
// How likely the Puffin (or her like) is to come in on a fine afternoon: a summer thing.
export const puffinChance = (season) => PUFFIN.chance * ({ spring: 0.75, summer: 1.35, autumn: 0.4, winter: 0 }[season] ?? 1);

// Where Hettie goes, for the stretch of the day starting at `hour`: { spot, target (what she's
// after), why } (or null: home).
export function hettieMark(hour, ctx) {
  const about = ctx.about || [];
  if (hour >= 1 && hour < 4.5) return null;
  if ((ctx.storm ?? 0) >= 0.35) return { spot: 'lee', target: 'flounder', why: $t('in the lee of the quay, out of the wind') };
  if ((ctx.rain ?? 0) > 0.75) return null;
  if ((hour >= 4.5 && hour < 8) || (hour >= 18 && hour < 21.5)) return { spot: 'strand', target: 'seabass', why: $t('on Shell Strand after the bass') };
  if (hour >= 21.5 || hour < 1) return { spot: 'quayEnd', target: 'squid', why: $t('under the quay light, jigging for squid') };
  const top = about.find((a) => ['mackerel', 'garfish', 'bonito', 'horsemackerel', 'bluefish'].includes(a.id));
  if (top) return { spot: 'quayEnd', target: top.id, why: $t`on the end of the quay: the ${lower(top.name)} are in` };
  return { spot: 'slipway', target: 'flounder', why: $t('down by the slipway, a worm out on the sand for flounder') };
}

// In (at home, or the bivouac) until the next of the day's times, as each could take them out again.
function hutUntil(key, h, times, spot, B) {
  const i = times.findIndex((t) => h < t);
  return i < 0 ? B(`${key}-${times.length}`, 24 + times[0], spot, 'inside') : B(`${key}-${i}`, times[i], spot, 'inside');
}

// What someone is doing at `hour` (a block of the day): { key, until, spot, act } where act is
// 'stand' | 'sit' | 'work' | 'fish' | 'crab' | 'inside' (gone in at the spot's door) | 'boat'.
export function blockFor(id, hour, ctx, day) {
  const h = hour;
  const B = (key, until, spot, act, extra = {}) => ({ key: `${day}:${key}`, until, spot, act, ...extra });
  switch (id) {
    case 'mags':
      if (h >= 4.2 && h < 19) return B('slab', 19, 'slab', 'work');
      if (h >= 19 && h < 21.5 && dayDice(day, 1) < 0.6) return B('pub', 21.5, 'innTableW', 'sit');
      return B('home', h < 4.2 ? 4.2 : 28.2, 'gull', 'inside');
    case 'bert':
      // (Behind his counter in shop hours; upstairs over the shop at night.)
      if (h >= 7.5 && h < 10.5) return fair(ctx) ? B('chair-am', 10.5, 'chair', 'sit') : B('shop-am', 10.5, 'shopCounter', 'stand');
      if (h >= 15 && h < 17.5) return fair(ctx) ? B('chair-pm', 17.5, 'chair', 'sit') : B('shop-pm', 17.5, 'shopCounter', 'stand');
      if (h >= 19 && h < 22) return B('pub', 22, 'innSettle', 'sit');
      if (h >= 22 || h < 7.5) return B('night', h < 7.5 ? 7.5 : 31.5, 'shopUp', 'inside');
      return B(`shop-${Math.floor(h)}`, h < 15 ? 15 : 19, 'shopCounter', 'stand');
    case 'ruth':
      if (h >= 7.5 && h < 8.3) return B('sweep', 8.3, 'innFront', 'work');
      if (h >= 14.5 && h < 15.3 && (ctx.rain ?? 0) < 0.3 && (ctx.storm ?? 0) < 0.3) return B('bench', 15.3, 'bench', 'sit');
      if (h >= 22.5 && h < 23) return B('time', 23, 'inn', 'stand');
      // (Behind the bar from opening till last orders; upstairs the rest of the night.)
      if (h >= 8.3 && h < 22.5) return B(`bar-${h < 14.5 ? 1 : 2}`, h < 14.5 ? 14.5 : 22.5, 'innBar', 'work');
      return B(`in-${h < 7.5 ? 0 : 3}`, h < 7.5 ? 7.5 : 31.5, 'innUp', 'inside');
    case 'dougie': {
      if (h < 5) return B('night', 5, 'rose', 'inside');
      if (h >= 19 && h < 22) return B('pub', 22, 'innBarFront', 'stand');
      if (h >= 22) return B('home', 29, 'rose', 'inside');
      // Out to the pots at first light, if the weather lets him.
      if (h >= 5 && h < 5.6) return fitForSea(ctx) ? B('down', 5.6, 'slipway', 'stand', { sea: true }) : B('lie-in', 7.5, 'rose', 'inside');
      if (h >= 5.6 && h < 12.4 && ctx.trip) return B('trip', 12.4, 'slipway', 'boat');
      if (h < 7.5) return B('lie-in', 7.5, 'rose', 'inside');
      if (h < 12) return B('mend-am', 12, 'pots', 'work');
      if (h < 13.5) return B('lunch', 13.5, 'innBarFront', 'stand');
      if (h < 17.5) return (ctx.storm ?? 0) >= 0.3 || !fitForSea(ctx) ? B('lee', 17.5, 'lee', 'fish', { target: 'flounder' }) : B('mend-pm', 17.5, 'pots', 'work');
      return B('bench', 19, 'bench', (ctx.rain ?? 0) > 0.3 ? 'stand' : 'sit');
    }
    case 'hettie': {
      // Her day in stretches; where she goes for each depends on the hour, the weather and the fish.
      const s0 = h < 1 ? 21.5 : [21.5, 18, 13, 12, 8, 4.5, 1].find((s) => h >= s);
      const until = { 1: 4.5, 4.5: 8, 8: 12, 12: 13, 13: 18, 18: 21.5, 21.5: 25 }[s0];
      if (s0 === 12) return B('lunch', until, 'innTableW', 'sit');
      const mark = hettieMark(s0, ctx);
      if (!mark) return B(`home-${s0}`, until, 'east', 'inside');
      return B(`${mark.spot}-${s0}`, until, mark.spot, 'fish', { target: mark.target, why: mark.why });
    }
    case 'kit':
      if (fair(ctx) && ctx.season !== 'winter' && ((h >= 9.5 && h < 12) || (h >= 16 && h < 18.5))) return B(`crab-${h < 12 ? 'am' : 'pm'}`, h < 12 ? 12 : 18.5, 'crab', 'crab');
      return B(`home-${h < 9.5 ? 0 : h < 16 ? 1 : 2}`, h < 9.5 ? 9.5 : h < 16 ? 16 : 33.5, 'net', 'inside');
    case 'ian': {
      const end = OUTINGS.jean.start + OUTING_HOURS.jean + 0.25;
      if (h >= 9.5 && h < 11 && fair(ctx)) return B('bench', 11, 'bench', 'sit');
      if (h >= 13.6 && h < OUTINGS.jean.start && calmSea(ctx)) return B('down', OUTINGS.jean.start, 'slipway', 'stand', { sea: true });
      if (h >= OUTINGS.jean.start && h < end && ctx.trip) return B('trip', end, 'slipway', 'boat');
      if (h >= 17.8 && h < 21) return B('pub', 21, 'innTableE', 'sit');
      return B(`home-${h < 11 ? 0 : h < 17.8 ? 1 : 2}`, h < 11 ? 11 : h < 17.8 ? 17.8 : 33.5, 'east', 'inside');
    }
    case 'wenna':
      // (The harbourmaster: in the office from eight, down to the gangway to look over the pontoon
      // mid-morning and late afternoon, lunch at the inn, an hour on the bench of a dry evening;
      // she lodges at the inn.)
      if (h >= 7.8 && h < 10) return B('office-1', 10, 'office', 'inside');
      if (h >= 10 && h < 10.6) return B('round-am', 10.6, 'gangway', 'stand');
      if (h >= 10.6 && h < 12.3) return B('office-2', 12.3, 'office', 'inside');
      if (h >= 12.3 && h < 13.2) return B('lunch', 13.2, 'innTableE', 'sit');
      if (h >= 13.2 && h < 16) return B('office-3', 16, 'office', 'inside');
      if (h >= 16 && h < 16.6) return B('round-pm', 16.6, 'gangway', 'stand');
      if (h >= 16.6 && h < 18) return B('office-4', 18, 'office', 'inside');
      if (h >= 19.2 && h < 20.5 && (ctx.rain ?? 0) < 0.3 && (ctx.storm ?? 0) < 0.3) return B('bench', 20.5, 'bench', 'sit');
      return B(`in-${h < 7.8 ? 0 : h < 19.2 ? 1 : 2}`, h < 7.8 ? 7.8 : h < 19.2 ? 19.2 : 31.8, 'innUp', 'inside');
    case 'paco':
      if (h >= 8 && h < 23.5) return B('door', 23.5, 'paco', 'stand');
      return B('in', h < 8 ? 8 : 32, 'paco', 'inside');
    case 'chano': {
      const end = OUTINGS.carmen.start + OUTING_HOURS.carmen + 0.25;
      if (h >= 6.2 && h < OUTINGS.carmen.start) return chanoSea(ctx) ? B('down', OUTINGS.carmen.start, 'steps', 'stand', { sea: true }) : B('nets', 11.5, 'steps', 'work');
      if (h >= OUTINGS.carmen.start && h < end && ctx.trip) return B('trip', end, 'steps', 'boat');
      if (h >= OUTINGS.carmen.start && h < 11.5) return B('nets', 11.5, 'steps', 'work');
      if (h >= 12.5 && h < 14) return B('lunch', 14, 'barTable', 'sit');
      if (h >= 18 && h < 21.5) return B('evening', 21.5, 'barTable', 'sit');
      return B(`home-${h < 6.2 ? 0 : h < 12.5 ? 1 : h < 18 ? 2 : 3}`, h < 6.2 ? 6.2 : h < 12.5 ? 12.5 : h < 18 ? 18 : 30.2, 'chanoHome', 'inside');
    }
    case 'nayra': {
      // (Sanding her boat's keel, out of the rain; her tanks on the quay late morning; lunch and the
      // evening outside the bar.)
      const dry = (ctx.rain ?? 0) < 0.6 && (ctx.storm ?? 0) < 0.4;
      if (h >= 7.5 && h < 10.5) return dry ? B('hull-am', 10.5, 'hull', 'work') : B('wet-am', 10.5, 'nayraHome', 'inside');
      if (h >= 10.5 && h < 12.5) return B('tanks', 12.5, 'tanks', 'stand');
      if (h >= 12.5 && h < 14) return B('lunch', 14, 'nayraTable', 'sit');
      if (h >= 14 && h < 17.5) return dry ? B('hull-pm', 17.5, 'hull', 'work') : B('wet-pm', 17.5, 'nayraHome', 'inside');
      if (h >= 19 && h < 21) return B('evening', 21, 'nayraTable', 'sit');
      return B(`home-${h < 7.5 ? 0 : h < 19 ? 1 : 2}`, h < 7.5 ? 7.5 : h < 19 ? 19 : 31.5, 'nayraHome', 'inside');
    }
    case 'agustin':
      // (His nets every morning; a siesta; his nets again of a fine afternoon; out along the dique
      // as the sun goes down, to look at the weather; then the evening with Chano. It's a long
      // stroll from the dique to the bar, an hour and a half of the game's clock, so he leaves it
      // in good time.)
      if (h >= 7 && h < 12) return B('nets-am', 12, 'nets', 'work');
      if (h >= 16 && h < 17.3 && fair(ctx)) return B('nets-pm', 17.3, 'nets', 'work');
      if (h >= 17.3 && h < 18.5 && (ctx.storm ?? 0) < 0.4) return B('dique', 18.5, 'dique', 'stand');
      if (h >= 18.5 && h < 22.5) return B('evening', 22.5, 'barTable2', 'sit');
      return B(`home-${h < 7 ? 0 : h < 17.3 ? 1 : 2}`, h < 7 ? 7 : h < 17.3 ? 17.3 : 31, 'agustinHome', 'inside');
    case 'bryn': {
      // (The quay swept first thing; the mullet off the end of it through the morning, unless it's
      // blowing (they keep away from rough water) or pouring; the kettle in the hut; lunch on the
      // bench; the camp put to rights; the mullet again of a fair evening; the bench till dark.)
      const blow = (ctx.storm ?? 0) >= 0.4, wet = (ctx.rain ?? 0) >= 0.6;
      if (h >= 6.5 && h < 7.8 && !blow) return B('sweep', 7.8, 'quayTop', 'work');
      if (h >= 7.8 && h < 11 && !blow && !wet) return B('mullet-am', 11, 'mulletEnd', 'fish', { target: 'mullet' });
      if (h >= 12.5 && h < 13.5 && !wet) return B('lunch', 13.5, 'wendBench', 'sit');
      if (h >= 13.5 && h < 15.5 && !blow) return B('camp', 15.5, 'pitch', 'work');
      if (h >= 17 && h < 19.5 && fair(ctx)) return B('mullet-pm', 19.5, 'mulletEnd', 'fish', { target: 'mullet' });
      if (h >= 19.5 && h < 21.5 && !blow && (ctx.rain ?? 0) < 0.3) return B('evening', 21.5, 'wendBench', 'sit');
      return hutUntil('hut', h, [6.5, 7.8, 11, 12.5, 13.5, 15.5, 17, 19.5, 21.5], 'brynHut', B);
    }
    case 'fen': {
      // (Gannet Isle for the seabird season, spring and summer: the colony counted from the
      // clifftop at dawn and through the afternoon, the landing stage of a morning, the counts
      // written up in the bivouac, meals on the driftwood log, and at dusk the shearwaters counted
      // as they gather off the island's east side. Not in a gale, nor counting in the pouring rain.
      // In autumn and winter the birds have gone, and so has she.)
      const season = ctx.season ?? 'summer';
      if (season !== 'spring' && season !== 'summer') return B('away', 24 + 5.5, 'bivouac', 'inside', { away: true });
      const blow = (ctx.storm ?? 0) >= 0.4, wet = (ctx.rain ?? 0) >= 0.6;
      // (The clifftop's a stiff climb from the camp, the headland further: half an hour and more of
      // the clock each way, so she comes down in good time for her meals.)
      if (h >= 5.5 && h < 7.6 && !blow && !wet) return B('dawn', 7.6, 'cliff', 'work');
      if (h >= 7.6 && h < 9 && !wet) return B('breakfast', 9, 'fenLog', 'sit');
      if (h >= 9 && h < 11.5 && !blow) return B('stage', 11.5, 'stage', 'stand');
      if (h >= 13.5 && h < 14.5 && !wet) return B('lunch', 14.5, 'fenLog', 'sit');
      if (h >= 14.5 && h < 16.8 && !blow && !wet) return B('count', 16.8, 'cliff', 'work');
      if (h >= 16.8 && h < 18.2 && !wet) return B('supper', 18.2, 'fenLog', 'sit');
      if (h >= 18.2 && h < 21 && !blow && !wet) return B('dusk', 21, 'headland', 'work');
      return hutUntil('in', h, [5.5, 7.6, 9, 11.5, 13.5, 14.5, 16.8, 18.2, 21], 'bivouac', B);
    }
  }
  return B('none', 99, 'inn', 'inside');
}

/* ---- the Morning Star's day at the pots ---- */

// Her trip as a list of legs: [{ kind: 'prep' | 'go' | 'haul' | 'land', path?, speed?, hours?,
// pot? }]: a timeline from the moment Dougie is aboard.
export function tripLegs() {
  const legs = [{ kind: 'prep', hours: 0.5 }];
  legs.push({ kind: 'go', path: ROUTE_OUT, speed: BOAT });
  POTS.forEach((p, i) => {
    if (i) legs.push({ kind: 'go', path: [POTS[i - 1], p], speed: SLOW });
    legs.push({ kind: 'haul', hours: 0.35, pot: i });
  });
  const home = [...ROUTE_OUT].reverse().slice(1, -1);
  legs.push({ kind: 'go', path: [POTS[POTS.length - 1], { x: -25, z: 85 }, ...home.slice(1), { x: LANDING.x + 2, z: LANDING.z + 8 }, { x: LANDING.x, z: LANDING.z }], speed: BOAT });
  legs.push({ kind: 'land', hours: 0.45 });
  legs.push({ kind: 'go', path: [{ x: LANDING.x, z: LANDING.z }, { x: MOORING.x, z: MOORING.z }], speed: SLOW });
  for (const L of legs) if (L.path) L.len = pathLength(L.path), L.hours = L.len / L.speed;
  return legs;
}
export const TRIP_HOURS = tripLegs().reduce((s, L) => s + L.hours, 0);

// An outing (Ian's, Chano's): ready the boat, out to the mark, drift over it fishing, home (to land
// the catch at the quay steps first, in Chano's case) and back on her mooring.
export function outingLegs(id) {
  const O = OUTINGS[id];
  const legs = [{ kind: 'prep', hours: 0.15 }, { kind: 'go', path: O.route, speed: BOAT }, { kind: 'fish', path: O.drift, hours: O.fishHours }];
  const end = O.drift[O.drift.length - 1];
  if (O.landing) {
    legs.push({ kind: 'go', path: O.home, speed: BOAT }, { kind: 'land', hours: 0.4 });
    legs.push({ kind: 'go', path: [{ x: O.landing.x, z: O.landing.z }, { x: O.landing.x + 3, z: O.landing.z + 6 }, { x: O.mooring.x, z: O.mooring.z }], speed: SLOW });
  } else legs.push({ kind: 'go', path: [end, ...[...O.route].reverse().slice(1)], speed: BOAT });
  for (const L of legs) {
    if (!L.path) continue;
    L.len = pathLength(L.path);
    if (L.kind === 'go') L.hours = L.len / L.speed;
  }
  return legs;
}
export const OUTING_HOURS = Object.fromEntries(Object.keys(OUTINGS).map((id) => [id, outingLegs(id).reduce((s, L) => s + L.hours, 0)]));
export const PUFFIN_HOURS = pathLength(PUFFIN.route) / SAIL;
// Where a boat is, so far along her legs: { leg, q (x, z), heading, speed } (null: all done).
function onLegs(legs, t) {
  for (const L of legs) {
    if (t < L.hours) {
      if (!L.path) return { leg: L, t };
      const s = (t / L.hours) * L.len;
      const q = along(L.path, s), ahead = along(L.path, Math.min(L.len, s + 2));
      return { leg: L, t, q, heading: Math.atan2(ahead.x - q.x, ahead.z - q.z), speed: L.len / L.hours / HOUR_SECONDS };
    }
    t -= L.hours;
  }
  return null;
}

// The Sea Wren's morning: ready, astern out of her berth along the finger, away to Gull Rock,
// drifting there with her party, and home, in bow first. (Backing out, she keeps her bow where it
// was: a boat that long doesn't turn round alongside a finger.)
const BACK = 0.5 * HOUR_SECONDS; // astern out of a berth, about half a metre a second
export function charterLegs() {
  const O = CHARTER, R = O.route;
  const legs = [{ kind: 'prep', hours: 0.15 }, { kind: 'back', path: [R[0], R[1]], speed: BACK }, { kind: 'go', path: R.slice(1), speed: BOAT }, { kind: 'fish', path: O.drift, hours: O.fishHours }];
  legs.push({ kind: 'go', path: [O.drift[O.drift.length - 1], ...[...R].reverse().slice(1)], speed: BOAT });
  for (const L of legs) {
    if (!L.path) continue;
    L.len = pathLength(L.path);
    if (L.speed) L.hours = L.len / L.speed;
  }
  return legs;
}
const CHARTER_LEGS = charterLegs();
export const CHARTER_HOURS = CHARTER_LEGS.reduce((s, L) => s + L.hours, 0);
const CALL_SPEED = 4 * HOUR_SECONDS;
export const CALL_HOURS = pathLength(CALLER.route) / CALL_SPEED;
const CALL_BACK = Math.hypot(CALLER.route.at(-2).x - CALLER.berth.x, CALLER.route.at(-2).z - CALLER.berth.z);

/* ---- everyone together ---- */

export class Townsfolk {
  // obstacles: the coast's (see world/coast.js), for the paths.
  constructor({ obstacles = [] } = {}) {
    this.paths = new Paths(obstacles);
    this.people = {};
    for (const id of FOLK_IDS) this.people[id] = { id, pos: { ...SPOTS[FOLK[id].home] }, yaw: 0, act: 'inside', block: null, path: null, t0: 0, len: 0, away: 0, liftT: 0, said: 0 };
    this.legs = tripLegs();
    this.boat = { x: MOORING.x, z: MOORING.z, heading: MOORING.heading, speed: 0, aboard: false, leg: null, hauling: false };
    this.trip = null;     // { t0 (game hours when Dougie came aboard), cut (storm: straight in) }
    // The other boats: Ian's and Chano's (on their moorings, or out), and the Puffin (when she's
    // here: present).
    this.boats = { star: this.boat };
    for (const [id, O] of Object.entries(OUTINGS)) this.boats[id] = { x: O.mooring.x, z: O.mooring.z, heading: O.mooring.heading, speed: 0, aboard: false, leg: null, fishing: false, south: O.south, present: true };
    this.boats.puffin = { x: PUFFIN.route[0].x, z: PUFFIN.route[0].z, heading: 0, speed: 0, aboard: true, leg: null, sails: false, anchored: false, present: false };
    // The marina's: the locals' boats on their berths, the Sea Wren, the Halcyon (when she's in),
    // and two kayaks (when they're out). (moored: lying alongside, her lines out.)
    for (const [id, L] of Object.entries(LOCAL_BOATS)) this.boats[id] = { x: L.at.x, z: L.at.z, heading: L.at.heading, speed: 0, aboard: false, leg: null, present: true, moored: true };
    const W = CHARTER.mooring;
    this.boats.wren = { x: W.x, z: W.z, heading: W.heading, speed: 0, aboard: false, leg: null, fishing: false, present: true, moored: true };
    this.boats.halcyon = { x: CALLER.berth.x, z: CALLER.berth.z, heading: CALLER.berth.heading, speed: 0, aboard: true, leg: null, present: false, moored: false };
    for (const id of ['kay1', 'kay2']) this.boats[id] = { x: PADDLE.loop[0].x, z: PADDLE.loop[0].z, heading: 0, speed: 0, aboard: true, leg: null, present: false };
    this.charterTrip = null; // the Sea Wren's morning out: { t0 }
    this.call = null;        // the Halcyon's visit: { day, inAt, leaveAt }
    this.outLegs = Object.fromEntries(Object.keys(OUTINGS).map((id) => [id, outingLegs(id)]));
    this.trips = { jean: null, carmen: null }; // { t0, landed }
    this.visit = null;    // the Puffin: { day, inAt, leaveAt, stay }
    this.landed = [];     // today's fish off the rod: { who, name, size, where (in words), day, hour }
    this.haul = null;     // Dougie's pots today: { day, hour, text }
    this.chanoHaul = null; // Chano's catch today: { day, hour, text }
    this.abs = null;
  }

  // How many are in the chandlery or the inn just now (sat, stood, at work, on their way in).
  inside(room) {
    let n = 0;
    for (const p of Object.values(this.people)) if (p.act !== 'inside' && p.act !== 'away' && p.act !== 'aboard' && insideHaven(p.pos.x, p.pos.z) === room) n++;
    return n;
  }

  // Someone's boat trip (Dougie's, Ian's, Chano's), if they're on one.
  tripOf(id) {
    const b = BOAT_OF[id];
    return b === 'star' ? this.trip : b ? this.trips[b] : null;
  }
  ctxFor(id, ctx) {
    return BOAT_OF[id] ? { ...ctx, trip: !!this.tripOf(id) } : ctx;
  }

  // abs: the game's clock in hours (day × 24 + hour); ctx: { storm, rain, wind, about: [{ id,
  // name, act }], activity: { species id: 0 … 1 } }.
  update(abs, ctx = {}) {
    if (this.abs == null || abs < this.abs || abs - this.abs > 48) this.place(abs, ctx);
    // In small steps, so a long sleep plays out the same as a day watched.
    while (this.abs < abs) {
      const to = Math.min(abs, this.abs + 0.05);
      this.step(to, ctx);
      this.abs = to;
    }
  }

  // Everyone straight to where they'd be at this hour (a game loaded, or a new day begun): no
  // walking there from home. Dougie's boat is out if it's the hour for it and the weather lets her.
  place(abs, ctx) {
    const day = Math.floor(abs / 24), hour = abs - day * 24;
    this.trip = hour >= 5.6 && hour < 5.6 + TRIP_HOURS && fitForSea(ctx) ? { t0: day * 24 + 5.6, cut: false } : null;
    if (this.trip) this.trip.counted = {};
    for (const [id, O] of Object.entries(OUTINGS)) {
      const ok = id === 'carmen' ? chanoSea(ctx) : calmSea(ctx);
      this.trips[id] = hour >= O.start && hour < O.start + OUTING_HOURS[id] && ok ? { t0: day * 24 + O.start } : null;
    }
    // The Puffin: here if she came in yesterday afternoon (and hasn't left yet), or today.
    this.visit = null;
    for (const d of [day, day - 1]) {
      const inAt = d * 24 + PUFFIN.arrive, leaveAt = (d + 1) * 24 + PUFFIN.leave;
      if (abs >= inAt && abs < leaveAt + PUFFIN_HOURS && dayDice(d, 21) < puffinChance(ctx.season) && sailingWeather(ctx)) this.visit = { day: d, inAt, leaveAt, stay: 0 };
    }
    this.charterTrip = hour >= CHARTER.start && hour < CHARTER.start + CHARTER_HOURS && this.charterDay(day, ctx) ? { t0: day * 24 + CHARTER.start } : null;
    this.call = null;
    for (const d of [day, day - 1]) {
      const inAt = d * 24 + CALLER.arrive, leaveAt = (d + 1) * 24 + CALLER.leave;
      if (abs >= inAt && abs < leaveAt + CALL_HOURS && this.callDay(d, ctx)) this.call = { day: d, inAt, leaveAt };
    }
    for (const id of FOLK_IDS) {
      const p = this.people[id];
      const b = blockFor(id, hour, this.ctxFor(id, ctx), day);
      p.block = b;
      p.path = null;
      p.away = 0;
      p.t0 = abs;
      p.lastCatch = abs;
      p.pos = { ...SPOTS[b.spot] };
      p.yaw = SPOTS[b.spot].yaw;
      p.act = b.act === 'boat' ? 'aboard' : b.act;
    }
    this.abs = abs - 0.001;
  }

  step(abs, ctx) {
    const day = Math.floor(abs / 24), hour = abs - day * 24;
    this.landed = this.landed.filter((l) => l.day === day);
    // The trips: each decided when its skipper goes down to the boat, run on its own clock.
    if (this.trip && abs - this.trip.t0 > TRIP_HOURS + 0.5) this.trip = null;
    for (const id of Object.keys(OUTINGS)) if (this.trips[id] && abs - this.trips[id].t0 > OUTING_HOURS[id] + 0.5) this.trips[id] = null;
    for (const id of FOLK_IDS) {
      const p = this.people[id];
      const b = blockFor(id, hour, this.ctxFor(id, ctx), day);
      if (!p.block || b.key !== p.block.key) this.begin(p, b, abs, ctx);
      this.move(p, abs, ctx, day);
    }
    this.sail(abs, ctx, day);
    for (const id of Object.keys(OUTINGS)) this.outing(id, abs, ctx, day);
    this.puffin(abs, ctx, day, hour);
    this.charter(abs, ctx, day, hour);
    this.caller(abs, ctx, day, hour);
    this.paddlers(ctx, day, hour);
  }

  // Whether the Sea Wren goes out today (a fair morning, most days), and whether the Halcyon
  // calls in (some fine afternoons, seldom in winter).
  charterDay(day, ctx) {
    return fitForSea(ctx) && fair(ctx) && dayDice(day, 51) < CHARTER.chance;
  }
  callDay(day, ctx) {
    return fitForSea(ctx) && dayDice(day, 61) < CALLER.chance * (ctx.season === 'winter' ? 0.3 : 1);
  }

  // The Sea Wren: on her berth, or out on her morning (see charterLegs).
  charter(abs, ctx, day, hour) {
    const B = this.boats.wren, O = CHARTER;
    if (!this.charterTrip && hour >= O.start && hour < O.start + 0.1 && this.charterDay(day, ctx)) this.charterTrip = { t0: day * 24 + O.start };
    if (this.charterTrip && abs - this.charterTrip.t0 > CHARTER_HOURS + 0.5) this.charterTrip = null;
    Object.assign(B, { speed: 0, leg: null, fishing: false, aboard: false, moored: true, astern: false, x: O.mooring.x, z: O.mooring.z, heading: O.mooring.heading });
    const T = this.charterTrip, at = T && abs >= T.t0 ? onLegs(CHARTER_LEGS, abs - T.t0) : null;
    if (!at) return;
    B.aboard = true;
    B.leg = at.leg.kind;
    if (at.leg.kind === 'prep') return;
    B.moored = false;
    Object.assign(B, { x: at.q.x, z: at.q.z, heading: at.heading || B.heading, speed: at.speed });
    // (Astern out of her berth: bow still where it was, and she's eased along to the clock.)
    if (at.leg.kind === 'back') Object.assign(B, { heading: O.mooring.heading, speed: 0, astern: true });
    if (at.leg.kind === 'fish') {
      B.fishing = true;
      B.speed = Math.min(B.speed, 0.4);
    }
  }

  // The Halcyon: in along the coast to the visitors' pontoon, lying there for the night, and
  // away next morning (astern off the berth first, then round and out).
  caller(abs, ctx, day, hour) {
    const B = this.boats.halcyon, O = CALLER;
    if (!this.call && hour >= O.arrive && hour < O.arrive + 0.5 && this.callDay(day, ctx)) this.call = { day, inAt: day * 24 + O.arrive, leaveAt: (day + 1) * 24 + O.leave };
    const V = this.call;
    Object.assign(B, { present: !!V, speed: 0, leg: null, moored: false, aboard: true, astern: false });
    if (!V) return;
    const R = O.route, L = pathLength(R);
    const put = (s, back, speed) => {
      const q = along(R, s), a = along(R, back ? Math.max(0, s - 2) : Math.min(L, s + 2));
      Object.assign(B, { x: q.x, z: q.z, heading: Math.atan2(a.x - q.x, a.z - q.z), speed });
    };
    if (abs < V.inAt + CALL_HOURS) {
      B.leg = 'in';
      put((abs - V.inAt) * CALL_SPEED, false, CALL_SPEED / HOUR_SECONDS);
    } else if (abs < V.leaveAt) {
      Object.assign(B, { x: O.berth.x, z: O.berth.z, heading: O.berth.heading, leg: 'berthed', moored: true, aboard: false });
    } else {
      // Astern off the berth, slowly, to clear the finger; then away at her cruise.
      const backHours = CALL_BACK / BACK, t = abs - V.leaveAt;
      if (t < backHours) {
        put(L - t * BACK, true, 0);
        Object.assign(B, { heading: O.berth.heading, leg: 'out', astern: true });
      } else if (t < backHours + (L - CALL_BACK) / CALL_SPEED) {
        B.leg = 'out';
        put(L - CALL_BACK - (t - backHours) * CALL_SPEED, true, CALL_SPEED / HOUR_SECONDS);
      } else {
        this.call = null;
        B.present = false;
      }
    }
  }

  // Two kayaks round the west of the bay of a fine spring or summer afternoon, one behind the
  // other; pulled up at the slipway the rest of the time.
  paddlers(ctx, day, hour) {
    const O = PADDLE, L = pathLength(O.loop);
    const on = (ctx.season === 'spring' || ctx.season === 'summer') && calmSea(ctx) && dayDice(day, 71) < O.chance;
    ['kay1', 'kay2'].forEach((id, i) => {
      const B = this.boats[id], s = (hour - O.start) * O.speed - i * 5;
      if (!on || s < 0 || s > L) {
        Object.assign(B, { present: false, speed: 0 });
        return;
      }
      const q = along(O.loop, s), a = along(O.loop, Math.min(L, s + 2));
      Object.assign(B, { present: true, x: q.x, z: q.z, heading: Math.atan2(a.x - q.x, a.z - q.z) || B.heading, speed: O.speed / HOUR_SECONDS, aboard: true });
    });
  }

  begin(p, b, abs, ctx) {
    const was = p.block;
    p.block = b;
    p.t0 = abs;
    p.lastCatch = abs;
    // (Down to the boat: Dougie at first light, rowing out to her, away by 5:40; Ian after lunch;
    // Chano at sunrise from the quay steps.)
    const own = BOAT_OF[p.id];
    if (b.sea && own === 'star' && !this.trip) this.trip = { t0: Math.max(abs + 0.3, Math.floor(abs / 24) * 24 + 5.6), cut: false };
    else if (b.sea && own && !this.trips[own]) this.trips[own] = { t0: Math.max(abs + 0.3, Math.floor(abs / 24) * 24 + OUTINGS[own].start) };
    // Back from the boat: ashore at the slipway (the quay steps, for Chano), and on from there.
    if (was?.act === 'boat' && p.act === 'aboard') {
      p.pos = { ...SPOTS[ASHORE[p.id] || 'slipway'] };
      p.away = abs + 0.2;
      p.t0 = abs + 0.2;
    }
    const S = SPOTS[b.spot];
    // (At Puerto Brasa the waterfront is open: they walk straight there. At the small harbours too,
    // by way of the points on the way (onto the quay at its foot, round the camp's things): back
    // along the way they came to where the two ways part, and out along the new one. Two places
    // the same way out (along the quay, say) are walked between straight.)
    if (FOLK[p.id].south || FOLK[p.id].remote) {
      if (!(p.away > abs)) p.away = 0;
      const back = (was && SPOTS[was.spot]?.way) || [], on = S.way || [];
      let k = 0;
      while (k < back.length && k < on.length && back[k] === on[k]) k++;
      const same = k === back.length && k === on.length;
      const via = same ? [] : [...back.slice(k).reverse(), ...(k ? [back[k - 1]] : []), ...on.slice(k)].map((q) => ({ x: q.x, z: q.z }));
      p.path = Math.hypot(S.x - p.pos.x, S.z - p.pos.z) < 0.3 ? null : [{ ...p.pos }, ...via, { x: S.x, z: S.z }];
      p.len = p.path ? pathLength(p.path) : 0;
      return;
    }
    // Somewhere far: out of sight, by bike, for as long as the ride takes.
    const from = p.pos;
    if (FAR.has(b.spot) || (was && FAR.has(was.spot))) {
      p.path = null;
      p.away = abs + Math.hypot(S.x - from.x, S.z - from.z) / BIKE;
      return;
    }
    if (!(p.away > abs)) p.away = 0;
    p.path = Math.hypot(S.x - from.x, S.z - from.z) < 0.3 ? null : this.wayTo(from, was ? SPOTS[was.spot] : null, S);
    p.len = p.path ? pathLength(p.path) : 0;
  }
  // The way from where someone is to a spot: across the harbour by the paths, and in or out of the
  // chandlery and the inn by their doors (and round the counter, the bar and the tables inside).
  wayTo(from, W, S) {
    const a = insideHaven(from.x, from.z), b = insideHaven(S.x, S.z);
    const back = W?.inner && insideHaven(W.x, W.z) === a ? [...W.inner].reverse() : [];
    if (a && a === b) return [from, ...back, ...(S.inner || []), { x: S.x, z: S.z }];
    const pre = a ? [from, ...back, ROOM_WAY[a][1], ROOM_WAY[a][0]] : [];
    const post = b ? [ROOM_WAY[b][0], ROOM_WAY[b][1], ...(S.inner || []), { x: S.x, z: S.z }] : [];
    const start = a ? ROOM_WAY[a][0] : from, end = b ? ROOM_WAY[b][0] : S;
    const mid = Math.hypot(end.x - start.x, end.z - start.z) < 0.3 ? [start] : this.paths.route(start, end);
    return [...(pre.length ? pre.slice(0, -1) : []), ...mid, ...(post.length ? post.slice(1) : [])];
  }

  move(p, abs, ctx, day) {
    const b = p.block, S = SPOTS[b.spot];
    // Aboard their boat (see sail and outing).
    const T = this.tripOf(p.id);
    if (b.act === 'boat' && T && abs >= T.t0) {
      const V = this.boats[BOAT_OF[p.id]];
      p.act = 'aboard';
      p.pos = { x: V.x, z: V.z };
      return;
    }
    if (p.away > abs) {
      p.act = 'away';
      return;
    }
    if (p.away && p.away <= abs && FAR.has(b.spot)) {
      p.pos = { x: S.x, z: S.z };
      p.away = 0;
    }
    if (p.path) {
      const s = (abs - p.t0) * WALK;
      if (s < p.len) {
        const q = along(p.path, s);
        p.pos = { x: q.x, z: q.z };
        p.yaw = q.yaw;
        p.act = 'walk';
        return;
      }
      p.path = null;
      p.pos = { x: S.x, z: S.z };
    }
    p.pos = { x: S.x, z: S.z };
    p.yaw = S.yaw;
    p.act = b.act === 'boat' ? 'stand' : b.act;
    // Hettie (and Dougie in the lee of the quay): now and then, a fish.
    if (b.act === 'fish' && b.target && abs - p.lastCatch >= 0.5) {
      const slot = Math.floor(abs * 2);
      p.lastCatch = abs;
      const act = ctx.activity?.[b.target] ?? 0.5;
      const r = seeded(slot * 131 + (p.id === 'hettie' ? 7 : p.id === 'bryn' ? 11 : 3))();
      if (r < 0.06 + 0.22 * act) {
        const sp = fishById[b.target];
        if (sp) {
          const rs = seeded(slot * 17 + 5)();
          const size = Math.round(sp.size[0] + (sp.size[1] - sp.size[0]) * (0.15 + 0.6 * rs * rs));
          p.liftT = abs + 0.08;
          this.landed.push({ who: FOLK[p.id].name.split(' ')[0], name: sp.name, size, k: (size - sp.size[0]) / (sp.size[1] - sp.size[0]), where: WHERE[b.spot] || '', day, hour: abs - day * 24 });
          if (this.landed.length > 8) this.landed.shift();
        }
      }
    }
    if (p.liftT > abs) p.act = 'lift';
  }

  // The Morning Star: on her mooring, or out on her trip (from the moment Dougie is aboard).
  sail(abs, ctx, day) {
    const B = this.boat;
    B.aboard = false;
    B.speed = 0;
    B.leg = null;
    B.hauling = false;
    const T = this.trip;
    if (!T || abs < T.t0) {
      Object.assign(B, { x: MOORING.x, z: MOORING.z, heading: MOORING.heading });
      return;
    }
    // A blow coming on while she's at the pots: she leaves the rest and comes straight in.
    let t = abs - T.t0;
    B.aboard = true;
    let i = 0;
    const legs = this.legs;
    const inLeg = legs.findIndex((L, k) => k > 2 && L.kind === 'go' && L.path.length > 2);
    if (!T.cut && (ctx.storm ?? 0) >= 0.45) {
      let acc = 0;
      for (let k = 0; k < inLeg; k++) acc += legs[k].hours;
      if (t > legs[0].hours + legs[1].hours && t < acc) {
        T.cut = true;
        T.cutAt = t;
        T.skip = acc - t;
      }
    }
    if (T.cut && t >= T.cutAt) t += T.skip;
    for (; i < legs.length; i++) {
      const L = legs[i];
      if (t < L.hours) break;
      t -= L.hours;
      // (Landing her catch on the quay: the morning's haul, told round the harbour.)
      if (L.kind === 'haul' && !T.counted?.[L.pot]) {
        T.counted ??= {};
        T.counted[L.pot] = true;
      }
    }
    if (i >= legs.length) {
      // Back on her mooring: Dougie rows ashore.
      Object.assign(B, { x: MOORING.x, z: MOORING.z, heading: MOORING.heading, aboard: false });
      return;
    }
    const L = legs[i];
    B.leg = L.kind;
    if (L.kind === 'go') {
      const q = along(L.path, (t / L.hours) * L.len);
      const ahead = along(L.path, Math.min(L.len, (t / L.hours) * L.len + 2));
      Object.assign(B, { x: q.x, z: q.z, heading: Math.atan2(ahead.x - q.x, ahead.z - q.z) || B.heading, speed: L.speed / HOUR_SECONDS });
    } else if (L.kind === 'prep') Object.assign(B, { x: MOORING.x, z: MOORING.z, heading: MOORING.heading });
    else if (L.kind === 'haul') {
      Object.assign(B, { x: POTS[L.pot].x, z: POTS[L.pot].z });
      B.hauling = true;
    } else if (L.kind === 'land') {
      Object.assign(B, { x: LANDING.x, z: LANDING.z, heading: LANDING.heading });
      if (!T.landed) {
        T.landed = true;
        const pots = Object.keys(T.counted || {}).length;
        const lobsters = Math.max(1, Math.round(pots * (1.2 + 1.6 * dayDice(day, 9))));
        const crab = Math.round(pots * (1 + 2 * dayDice(day, 11)));
        const conger = dayDice(day, 13) < 0.25;
        this.haul = { day, hour: abs - day * 24, text: (lobsters > 1 ? $t`Dougie landed his pots this morning: ${lobsters} lobsters${crab ? $t` and ${crab} brown crab` : ''}${conger ? $t(', and a conger as long as his arm that had got into one of them') : ''}.${T.cut ? $t(' He came in early, before the blow.') : ''}` : $t`Dougie landed his pots this morning: ${lobsters} lobster${crab ? $t` and ${crab} brown crab` : ''}${conger ? $t(', and a conger as long as his arm that had got into one of them') : ''}.${T.cut ? $t(' He came in early, before the blow.') : ''}`) };
      }
    }
  }

  // Ian's afternoon, and Chano's morning: out to the mark, drifting over it with a line down, a
  // fish now and then, and home (Chano by way of the quay steps, to land his catch for Paco).
  outing(id, abs, ctx, day) {
    const O = OUTINGS[id], B = this.boats[id], T = this.trips[id];
    Object.assign(B, { speed: 0, leg: null, fishing: false, aboard: false });
    const at = T && abs >= T.t0 ? onLegs(this.outLegs[id], abs - T.t0) : null;
    if (!at) {
      Object.assign(B, { x: O.mooring.x, z: O.mooring.z, heading: O.mooring.heading });
      return;
    }
    B.aboard = true;
    B.leg = at.leg.kind;
    if (at.q) Object.assign(B, { x: at.q.x, z: at.q.z, heading: at.heading || B.heading, speed: at.speed });
    else if (at.leg.kind === 'prep') Object.assign(B, { x: O.mooring.x, z: O.mooring.z, heading: O.mooring.heading });
    else if (at.leg.kind === 'land') Object.assign(B, { x: O.landing.x, z: O.landing.z, heading: O.landing.heading });
    if (at.leg.kind === 'fish') {
      B.fishing = true;
      // (Drifting: slowly, the bow round to the drift.)
      B.speed = Math.min(B.speed, 0.4);
      const slot = Math.floor(abs * 2);
      if (slot !== T.slot) {
        T.slot = slot;
        const sp = fishById[O.target];
        const r = seeded(slot * 97 + (id === 'jean' ? 1 : 2))();
        if (sp && r < 0.12 + 0.3 * (ctx.activity?.[O.target] ?? 0.5)) {
          const rs = seeded(slot * 29 + 3)();
          const size = Math.round(sp.size[0] + (sp.size[1] - sp.size[0]) * (0.15 + 0.55 * rs * rs));
          T.n = (T.n || 0) + 1;
          if (!O.south) {
            this.landed.push({ who: FOLK[O.owner].short, name: sp.name, size, k: (size - sp.size[0]) / (sp.size[1] - sp.size[0]), where: O.where, day, hour: abs - day * 24 });
            if (this.landed.length > 8) this.landed.shift();
          }
        }
      }
    }
    if (at.leg.kind === 'land' && !T.landed) {
      T.landed = true;
      const n = Math.max(2, (T.n || 0) + Math.round(3 * dayDice(day, 31)));
      const extra = dayDice(day, 33) < 0.3 ? $t(', and a big moray he says nearly had his fingers') : dayDice(day, 35) < 0.3 ? $t(' and a couple of triggerfish') : '';
      this.chanoHaul = { day, hour: abs - day * 24, text: $t`Chano came in from El Bajón with ${n} viejas${extra}. Paco’s mother will have them on the menu tonight.` };
    }
  }

  // The Puffin: some fine afternoons she sails in from the sea and anchors in the bay; next
  // morning she sails on, unless it's blowing, when she waits for it to pass (a day or two).
  puffin(abs, ctx, day, hour) {
    const B = this.boats.puffin;
    if (!this.visit && hour >= PUFFIN.arrive && hour < PUFFIN.arrive + 0.5 && dayDice(day, 21) < puffinChance(ctx.season) && sailingWeather(ctx)) {
      this.visit = { day, inAt: day * 24 + PUFFIN.arrive, leaveAt: (day + 1) * 24 + PUFFIN.leave, stay: 0 };
    }
    const V = this.visit;
    Object.assign(B, { present: !!V, sails: false, anchored: false, speed: 0, leg: null });
    if (!V) return;
    if (abs >= V.leaveAt && V.checked !== V.leaveAt) {
      V.checked = V.leaveAt;
      if (!sailingWeather(ctx) && V.stay < 2) {
        V.leaveAt += 24;
        V.stay++;
      }
    }
    const R = PUFFIN.route, L = pathLength(R);
    const place = (s, back) => {
      const q = along(R, s), a = along(R, back ? Math.max(0, s - 2) : Math.min(L, s + 2));
      Object.assign(B, { x: q.x, z: q.z, heading: Math.atan2(a.x - q.x, a.z - q.z), speed: SAIL / HOUR_SECONDS, sails: true });
    };
    if (abs < V.inAt + PUFFIN_HOURS) {
      B.leg = 'in';
      place((abs - V.inAt) * SAIL, false);
    } else if (abs < V.leaveAt) {
      const end = R[R.length - 1], prev = R[R.length - 2];
      Object.assign(B, { x: end.x, z: end.z, heading: Math.atan2(end.x - prev.x, end.z - prev.z), anchored: true, leg: 'anchored' });
    } else if (abs < V.leaveAt + PUFFIN_HOURS) {
      B.leg = 'out';
      place(L - (abs - V.leaveAt) * SAIL, true);
    } else {
      this.visit = null;
      B.present = false;
    }
  }

  // What's being said about the harbour's own people today (for the bar), every word of it true:
  // where they are and what they're at, Dougie's catch, and the best fish anyone's had today.
  news(hour) {
    const out = [];
    const day = Math.floor((this.abs ?? 0) / 24);
    if (this.haul?.day === day) out.push(this.haul.text);
    const best = this.landed.filter((l) => l.day === day).sort((a, b) => b.k - a.k)[0];
    if (best && best.k > 0.35) out.push($t`${best.who} had a good ${lower(best.name)} ${best.where} ${best.hour < 12 ? $t('this morning') : best.hour < 18 ? $t('this afternoon') : $t('this evening')}: ${best.size} cm.`);
    const D = this.people.dougie, H = this.people.hettie, K = this.people.kit;
    if (this.boat.aboard && this.boat.leg && this.boat.leg !== 'land') out.push(this.trip?.cut ? $t('Dougie’s on his way in: he left the rest of his pots when the wind got up.') : $t('Dougie’s out at his pots off Gull Rock. He’ll be in about noon to land them.'));
    else if (D.block?.spot === 'pots' && D.act !== 'walk') out.push($t('Dougie’s not going out today: he’s on the quay mending pots.'));
    else if (D.block?.spot === 'lee') out.push($t('Dougie’s fishing in the lee of the quay: no going out to the pots in this.'));
    if (H.block?.why && (H.act === 'fish' || H.act === 'lift' || H.act === 'walk' || H.act === 'away')) out.push(`Hettie’s ${H.block.why}.`);
    if (K.act === 'crab') out.push(hour < 12.5 ? $t('Kit’s been crabbing off the quay all morning.') : $t('Kit’s back on the quay with his crab line.'));
    const J = this.boats.jean;
    if (J.aboard && J.leg !== 'prep') out.push(J.fishing ? $t('Ian Rennie’s out in the Bonny Jean past the Calf, feathering for mackerel.') : $t('That’s Ian Rennie in the Bonny Jean: off after the mackerel, now the wind’s dropped.'));
    if (this.boats.wren.aboard && this.boats.wren.leg !== 'prep') out.push(this.boats.wren.fishing ? $t('The Sea Wren’s out off Gull Rock with a party, drifting for pollack.') : $t('That’s the Sea Wren going out: a charter, with a party aboard after the pollack off Gull Rock.'));
    const HB = this.boats.halcyon;
    if (HB.present) out.push(HB.leg === 'in' ? $t('There’s a motor yacht coming in: the Halcyon, cruising the coast. She’ll lie at the visitors’ pontoon tonight.') : HB.leg === 'out' ? $t('The Halcyon’s off again, on round the coast.') : $t('The Halcyon’s in at the visitors’ pontoon for the night, a motor yacht cruising the coast.'));
    if (this.boats.kay1.present) out.push($t('A couple of kayaks are out round the west of the bay.'));
    const P = this.boats.puffin, V = this.visit;
    if (P.present) {
      if (P.leg === 'in') out.push($t('There’s a little cruising boat coming in under sail: the Puffin, by the look of her. She’ll anchor in the bay for the night.'));
      else if (P.leg === 'out') out.push($t('The Puffin’s off, under sail, out of the bay and on round the coast.'));
      else out.push(V.stay ? $t('The Puffin’s still at anchor in the bay, waiting for the weather to let her go on.') : $t('The Puffin’s at anchor in the bay for the night: a little cruising boat, going round the coast.'));
    }
    // (G9b) The Trust's warden, out on Gannet Isle for the season.
    const Fn = this.people.fen;
    if (Fn && !Fn.block?.away) out.push($t('Fen Hollis is out on Gannet Isle for the Trust, counting the seabirds. She’d be glad of a visitor, and of the post.'));
    return out;
  }

  // The same at Bar El Muelle, about Puerto Brasa's own.
  newsSouth(hour) {
    const out = [];
    const day = Math.floor((this.abs ?? 0) / 24);
    if (this.chanoHaul?.day === day) out.push(this.chanoHaul.text);
    const C = this.boats.carmen, ch = this.people.chano;
    if (C.aboard && C.leg !== 'land') out.push(C.fishing ? $t('Chano is out over El Bajón with his handlines, since sunrise.') : $t('That’s Chano’s boat, the Virgen del Carmen, going out to El Bajón.'));
    else if (ch.block?.spot === 'steps' && ch.act === 'work' && !C.aboard) out.push($t('Chano didn’t go out this morning: too much wind. He’s mending his nets on the quay.'));
    // (G9) The dive school's boat, up at the end of the waterfront.
    if (this.people.nayra?.block?.spot === 'hull') out.push($t('The dive school’s boat is still up at the end of the waterfront with a cracked keel. Nayra’s at it with a sanding block.'));
    return out;
  }

  // Someone within reach of (x, z), on foot and to be talked to.
  near(x, z, r = 2.2) {
    let best = null, bd = r;
    for (const p of Object.values(this.people)) {
      if (p.act === 'inside' || p.act === 'away' || p.act === 'aboard') continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < bd) [best, bd] = [p, d];
    }
    return best;
  }
}

// A word from someone you walk up to: what they're doing, and something useful or kind.
export function sayTo(p, { hour = 12, storm = 0, wanted = [], caught = 0, landed = [], rep = {} } = {}) {
  const act = p.act, b = p.block || {};
  switch (p.id) {
    case 'mags':
      if (act === 'walk') return $t('Can’t stop, love: the boats’ll be in.');
      return wanted.length ? $t`“Morning! I’m after ${wanted.map((n) => lower(n)).join($t(' and '))} today: bring me some and I’ll pay you half as much again.”` : $t('“What have you got for me, then?”');
    case 'bert':
      return act === 'sit' ? $t('“Sit down a minute? No? Well, mind you keep your line fresh. A frayed line loses you the fish of the day, and you never forget that one.”') : $t('“The tackle’s through there, same as always. Help yourself.”');
    case 'ruth':
      return act === 'sit' ? $t('“Five minutes’ peace. Don’t tell anyone I’m out here.”') : act === 'work' ? $t('“Morning! Fish pie tonight, if you’re hungry. And I’m always after a good fish for the kitchen.”') : $t('“Last orders! Come on, haven’t you got homes to go to?”');
    case 'dougie': {
      if (b.spot === 'lee') return $t('“Nothing doing out there in this. In here, out of the wind, there’s always a flounder or two on the bottom.”');
      if (b.spot === 'pots') return storm > 0.3 ? $t('“No going out in this. I’ll have these mended by the time it blows through.”') : $t('“Pots don’t mend themselves. Off Gull Rock tomorrow, first light.”');
      return $t('“Been out since first light. Lobsters were walking this morning.”');
    }
    case 'hettie': {
      const mine = landed.filter((l) => l.who === 'Hettie');
      const last = mine[mine.length - 1];
      const tgt = fishById[b.target] ? lower(fishById[b.target].name) : null;
      if (last) return $t`“Had ${mine.length > 1 ? $t`${mine.length} so far` : 'one'}: the best a ${last.size} cm ${lower(last.name)}. ${b.spot === 'strand' ? $t('Fish the white water, where the waves break.') : b.spot === 'quayEnd' ? $t('Straight out off the end, let it sink a bit.') : $t('Patience. Let the bait sit.')}”`;
      return tgt ? $t`“I’m after ${tgt}. Nothing yet, but they’ll come.”` : $t('“Lovely day for it.”');
    }
    case 'kit':
      return caught > 0 ? $t('“I’ve caught loads of crabs! Gran says I’ve to put them all back.”') : $t('“Bacon’s the best bait for crabs. Everybody knows that.”');
    case 'ian':
      return act === 'sit' ? $t('“Forty years I taught Latin up at the school. Now I fish. Calm afternoons, the mackerel come in past the Calf: a string of feathers, and you can’t go wrong.”') : $t('“Off out in the Bonny Jean later, if the wind stays down.”');
    case 'wenna':
      if (b.spot === 'gangway') return $t('“Just looking over the lines. That finger with your name on it is yours, mind: nobody else ties up there. Visitors go on the end row.”');
      if (b.spot === 'bench') return $t('“I like to see them all in before I turn in. Quiet night for it.”');
      return $t('“Your boats are in good hands: three in the water at a time, and the rest snug in the store. Ask at the hatch whenever you want one.”');
    case 'paco':
      return hour < 12 ? $t('“¡Buenos días! Coffee? The boats are out at El Bajón.”') : $t('“¡Hola! A cold caña? Sit, sit.”');
    case 'chano':
      if (act === 'work') return $t('“Too much wind for my little boat today. So, the nets.” He holds up a tangle. “Always the nets.”');
      return $t('“El Bajón, every morning since I was a boy. The viejas like a piece of crab, on the bottom, right by the rock. Paco’s mother cooks them better than anyone.”');
    // (G9) Nayra and Agustín: what they're at, and a word for someone who's worked for them (your
    // standing with the dive school and the cofradía: contracts.js rep).
    case 'nayra':
      if (rep.buceo > 0 && act !== 'work') return $t('“My divers still talk about you holding the boat over the reef while they were down. ¡Gracias! Come and dive with us one day, as a guest.”');
      if (act === 'work') return $t`“A crack in her keel, from a bad landing on Las Coladas.” She runs a hand along it.${rep.buceo > 0 ? $t(' “You’ve kept my divers going while she’s up here. I won’t forget it.”') : $t(' “Two more days of sanding and filling, and she’s back in the water. Till then, the school needs a boat.”')}`;
      if (b.spot === 'tanks') return $t('“El Bajón is a marine reserve: no anchoring, no fishing over the pinnacles. Ten metres down it’s full of life. Barracuda, groupers, and the black coral down the walls.”');
      return $t('“If you want to see angel sharks, go to El Sebadal early, before the boats. They lie in the sand like doormats, and the sand is their colour.”');
    case 'agustin':
      if (act === 'work') return $t`“Sixty years I’ve mended nets on this quay.” His needle doesn’t stop.${rep.cofradia > 0 ? $t(' “You carried our salt fish, our buoys. The cofradía doesn’t forget.”') : $t(' “The young ones buy new. A good net, you mend.”')}`;
      if (b.spot === 'dique') return storm > 0.3 ? $t('“Look at it. The sea’s the sea’s today. Tomorrow, maybe.”') : $t('“The trade wind’s backing. When the cloud sits on the Pico like a hat, it’ll blow by morning.”');
      return rep.cofradia > 0 ? $t('“¡Siéntate! The one who carried our fish to the English. Paco, another for my friend.”') : $t('“The salt fish, the way my father did it: split, salted, dried in the wind on the roofs. Your Mags pays well for it, they tell me.”');
    // (G9b) Bryn at Wend Quay and Fen on Gannet Isle: what they're at, and a word for someone who's
    // worked for the harbour office or the Trust.
    case 'bryn': {
      const mine = landed.filter((l) => l.who === 'Bryn'), last = mine[mine.length - 1];
      if (act === 'walk') return $t('“Can’t stop: the tide won’t wait for me.”');
      if (b.spot === 'quayTop') return $t`“Somebody has to keep the old quay. Three hundred years these stones have stood: I’d like them to see another three hundred.”${rep.wenna > 0 ? $t(' “Wenna speaks well of you, and she doesn’t speak well of many.”') : ''}`;
      if (b.spot === 'mulletEnd') return last ? $t`“Had one! ${last.size} centimetres, on bread flake. Don’t tell Hettie: she says they can’t be caught off here.”` : $t('“Mullet. Look: grey backs, nosing at the weed on the stones. I can see them, they can see me, and thirty years they’ve laughed at me.”');
      if (b.spot === 'pitch') return $t('“Campers leave their tent pegs everywhere. I’ve a jar of them in the hut: forty years of pegs.”');
      if (hour >= 19.5) return $t('“Listen: the curlews, out on the flats. They’ll be calling all night, and the tide coming up under them.”');
      return $t`“The tide comes up the Wend a good hour after it’s high at Willowhaven, and the mullet come up with it. Bread flake, a little float, and keep still: they see you long before you see them.”${rep.wenna > 0 ? $t(' “Sit down a minute. Wenna’s friends are mine.”') : ''}`;
    }
    case 'fen':
      if (act === 'walk') return $t('“Sorry, can’t stop: I mustn’t miss the light.”');
      if (b.spot === 'cliff') return $t`“Three hundred and twelve… Sorry. Puffins. They all look the same from up here, so I count the ones coming in with a beak full of sandeels: each of those is a chick being fed.”${rep.trust > 0 ? $t(' “Your counts are in the Trust’s records with mine, you know.”') : ''}`;
      if (b.spot === 'headland') return $t('“They gather out there at dusk, the shearwaters, thousands of them, and come in to their burrows after dark. You’ll hear them before you see them: they wail like lost souls.”');
      if (b.spot === 'stage') return rep.trust > 0 ? $t('“The Trust tells me you’ve done counts for us. Come up to the cliff one dawn and I’ll show you how it’s done on a colony.”') : $t('“The Trust’s boat comes out once a week, with water and the post. Anything sooner is a kindness.”');
      return $t('“Porridge on a little stove, three months running. I dream about Ruth’s fish pie.”');
  }
  return '';
}
