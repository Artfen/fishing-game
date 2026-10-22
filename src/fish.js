import * as THREE from 'three';
import { lerp, smoothstep, seeded } from './util.js';

const isDay = (h) => h >= 6.2 && h < 19;
const isEvening = (h) => h >= 18.5 || h < 5;
const isTwilight = (h) => (h >= 5 && h < 7.5) || (h >= 17.5 && h < 20.5);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Every species lives in the shared underwater world (see world/ecosystem.js).
// `life` describes where it lives and how it behaves; there is no separate catch roll:
// the fish you hook is a fish that was really swimming there.
// ctx = { hour, rain (0..1), daylight, night, lanternNear (bool), hatch (0..1.4) }
//
// What a fish will take:
//  food   – how much it likes each bait, lure or fly (tackle.js ids); missing means "ignores it"
//  likes  – how it likes the bait to move: still, slow, fast, or twitched
//  mouth  – the biggest bait size it can manage (1 small … 4 huge)
//  strike – how it takes: nibble (default), chase, ambush, rise (to a dry fly), take (a nymph), run (a bottom bait)
//  pull   – how hard (kg) a big one pulls; compare with the line on your rod
export const FISH = [
  {
    id: 'glassminnow',
    name: 'Glassminnow',
    water: 'salt',
    size: [5, 10],
    visual: 3.6,
    strength: 0.3,
    reel: 0.34,
    pull: 0.15,
    mouth: 1,
    colors: { back: '#7fa89c', body: '#cfe6df', belly: '#f5faf7', fin: '#b9d6cf', mark: '#f2f8ff' },
    sketch: { h: 0.26, tail: 0.75, pattern: 'stripe' },
    where: 'Shallow sand and weed edges, in schools',
    hint: 'Silver flickers move together over the shallow sand. A small bait kept shallow and still might tempt one.',
    note: 'Clear as a raindrop, with a single silver stripe. Never alone: the whole school turns at once.',
    keep: 'Far too small to keep. Back it goes, to find its school.',
    food: { worm: 0.7, bread: 1.3, corn: 0.35 },
    life: {
      school: true, schools: 12, members: [12, 24],
      speed: 0.85, turn: 3.4, perception: 5, depthTol: 1.0, cover: 'weed',
      homes: ['sand', 'weed'], zones: ['bay', 'cove'],
      depth: ({ night }) => (night > 0.6 ? [0.6, 2.2] : [0.25, 1.6]),
      activity: ({ hour }) => (isDay(hour) ? 1 : isTwilight(hour) ? 0.6 : 0.15),
      likes: { still: 1, slow: 0.7, fast: 0.2, twitch: 0.4 },
      bite: 0.75, caution: 0.7, rises: () => 0, jumps: 0,
    },
  },
  {
    id: 'sunperch',
    name: 'Sunperch',
    water: 'salt',
    size: [12, 26],
    visual: 2.0,
    strength: 0.65,
    reel: 0.2,
    pull: 0.9,
    mouth: 2,
    colors: { back: '#c47b2c', body: '#f0b44a', belly: '#f8e7b4', fin: '#e07a3a', mark: '#a65a2a' },
    sketch: { h: 0.5, tail: 0.5, pattern: 'bars' },
    where: 'Weed beds and rocks in Willow Bay, by day',
    hint: 'Small and golden, flashing around weed beds and rocks where the sun warms the bay. Try the jetty.',
    note: 'Bright as a new coin. Loves weed beds and warm, shallow water. It will chase a little spinner too.',
    meal: { name: 'Sunperch fried golden in the pan', fill: 35 },
    food: { worm: 1, prawn: 0.8, corn: 0.5, bread: 0.4, spinner: 1.0, crankS: 0.45, streamer: 0.6 },
    life: {
      group: [3, 6], groups: 14,
      speed: 0.6, turn: 2.2, perception: 7, depthTol: 1.4, cover: 'any',
      homes: ['weed', 'rock'], zones: ['bay', 'cove'],
      depth: () => [0.6, 5],
      activity: ({ hour }) => (isDay(hour) ? 1 : isTwilight(hour) ? 0.55 : 0.15),
      likes: { still: 1, slow: 0.85, fast: 0.6, twitch: 1.15 },
      bite: 0.6, caution: 1, rises: ({ hour }) => (isTwilight(hour) ? 0.6 : isDay(hour) ? 0.25 : 0), jumps: 0.15,
      strike: { lure: 'chase', streamer: 'chase' },
    },
  },
  {
    id: 'drizzlefin',
    name: 'Drizzlefin',
    water: 'salt',
    size: [30, 58],
    visual: 1.5,
    strength: 1.0,
    reel: 0.15,
    pull: 3.2,
    mouth: 3,
    colors: { back: '#3e6a86', body: '#9fb9c8', belly: '#e6eef0', fin: '#5d8aa3', mark: '#2c4a60' },
    sketch: { h: 0.32, tail: 0.8, pattern: 'spots' },
    where: 'Open water past the bay mouth; near the surface in the rain',
    hint: 'Old fishers say it rises out past the bay mouth when rain dimples the sea. On dry days it cruises deep.',
    note: 'Silver-blue with raindrop spots. Comes up beyond the bay when the rain freshens the sea. Hits a moving lure hard.',
    meal: { name: 'Drizzlefin steaks over the coals', fill: 70 },
    food: { worm: 0.9, prawn: 1.3, spinner: 1.2, crankS: 0.9, crankD: 1.25, jerk: 0.8 },
    life: {
      group: [2, 4], groups: 6, range: 1.6,
      speed: 1.25, turn: 1.5, perception: 12, depthTol: 2.0, cover: 'open',
      homes: ['open'], zones: ['open', 'bay'],
      depth: ({ rain }) => (rain > 0.4 ? [0.4, 2.8] : [3, 9]),
      activity: ({ rain }) => 0.3 + rain * 0.7,
      likes: { still: 0.45, slow: 1.3, fast: 1.4, twitch: 1.2 },
      bite: 0.55, caution: 0.8, rises: ({ rain }) => (rain > 0.4 ? 2.2 : 0.1), jumps: 0.4,
      strike: { lure: 'chase' },
    },
  },
  {
    id: 'duskfin',
    name: 'Duskfin',
    water: 'salt',
    size: [24, 44],
    visual: 1.5,
    strength: 0.85,
    reel: 0.13,
    pull: 2.4,
    mouth: 2,
    colors: { back: '#2b2f5e', body: '#4a4f92', belly: '#a497cc', fin: '#ff9d6b', mark: '#ffd28a' },
    sketch: { h: 0.42, tail: 0.7, pattern: 'specks', glow: true },
    where: 'Driftwood Cove after sundown, drawn to lantern light',
    hint: 'Something glows in a hidden cove beyond the eastern headland once the sun goes down. It may like warm light.',
    note: 'Indigo, with fins like embers. Rests deep in the cove by day and drifts up towards warm light after dark.',
    meal: { name: 'Duskfin baked in leaves (it still glows a little)', fill: 55 },
    food: { worm: 1, prawn: 1.2, corn: 0.4, spinner: 0.4 },
    life: {
      group: [2, 3], groups: 5, spacing: 6,
      speed: 0.7, turn: 1.8, perception: 9, depthTol: 1.6, cover: 'rock', lantern: true,
      homes: ['rock', 'weed'], zones: ['cove'],
      depth: ({ hour }) => (isEvening(hour) ? [0.8, 3] : [3.5, 8]),
      activity: ({ hour, lanternNear }) => (isEvening(hour) ? (lanternNear ? 1 : 0.45) : 0.04),
      likes: { still: 1.1, slow: 0.7, fast: 0.3, twitch: 0.5 },
      bite: 0.6, caution: 1.2, rises: ({ hour }) => (isEvening(hour) ? 0.4 : 0), jumps: 0.2, bubbles: true,
    },
  },
  {
    id: 'mossback',
    name: 'Mossback',
    water: 'salt',
    size: [55, 95],
    visual: 1.25,
    strength: 1.45,
    reel: 0.115,
    pull: 7.5,
    mouth: 4,
    colors: { back: '#4d5a3c', body: '#7e7c55', belly: '#cbc39f', fin: '#5f6b45', mark: '#38422c' },
    sketch: { h: 0.44, tail: 0.55, pattern: 'mottle' },
    where: 'The deepest rocks, close to the bottom',
    hint: 'Down by the deepest rocks something large and slow keeps to the bottom. It will not rise for a bait near the surface.',
    note: 'Broad, old and patient, with moss-coloured scales. It only takes a bait resting right by the bottom: a prawn or a boilie.',
    keep: 'Far too old and grand to eat. You ease it back towards its rocks.',
    food: { worm: 0.8, prawn: 1.4, boilie: 1.1, corn: 0.3, crankD: 0.25 },
    life: {
      group: [1, 1], groups: 4, bottom: true,
      speed: 0.4, turn: 0.8, perception: 7, depthTol: 1.8, cover: 'rock',
      homes: ['deep'], zones: ['bay', 'open', 'cove'],
      depth: () => [6, 30],
      activity: ({ hour }) => (isTwilight(hour) ? 0.85 : 0.4),
      likes: { still: 1.2, slow: 0.45, fast: 0.1, twitch: 0.3 },
      bite: 0.5, caution: 2, rises: () => 0, jumps: 0, bubbles: true,
      strike: { ledger: 'run' },
    },
  },
  /* ---------------- fresh water: Reedmere ---------------- */
  {
    id: 'perch',
    name: 'Perch',
    water: 'fresh',
    size: [12, 40],
    visual: 1.8,
    strength: 0.7,
    reel: 0.2,
    pull: 1.3,
    mouth: 2,
    colors: { back: '#3f5a2a', body: '#a9b04c', belly: '#f1ead0', fin: '#e0582f', mark: '#2a3a1c' },
    sketch: { h: 0.42, tail: 0.55, pattern: 'bars', spiky: true },
    where: 'Reedmere: weed edges and the fallen alder, in little packs',
    hint: 'Striped hunters move in packs around the weed and the fallen tree in the lake. They chase small lures that flash.',
    note: 'Dark bars, a spiky fin and bright orange-red fins below. Where one follows a lure, the rest of the pack comes too.',
    meal: { name: 'Perch fillets crisped in butter', fill: 40 },
    food: { worm: 1.2, spinner: 1.3, crankS: 1.0, crankD: 0.7, jerk: 0.35, streamer: 1.0, nymph: 0.35, prawn: 0.6, corn: 0.15, bread: 0.1 },
    life: {
      group: [4, 7], groups: 7, spacing: 9,
      speed: 0.75, turn: 2.6, perception: 8, depthTol: 1.6, cover: 'any', pack: true,
      homes: ['weed', 'snag', 'rock'], zones: ['lake'],
      depth: ({ night }) => (night > 0.6 ? [1.5, 5] : [0.8, 4.2]),
      activity: ({ hour }) => (isDay(hour) ? 1 : isTwilight(hour) ? 0.85 : 0.15),
      likes: { still: 0.6, slow: 1.1, fast: 0.8, twitch: 1.3 },
      bite: 0.7, caution: 0.9, rises: ({ hour }) => (isTwilight(hour) ? 0.15 : 0), jumps: 0.05,
      strike: { lure: 'chase', streamer: 'chase' },
    },
  },
  {
    id: 'pike',
    name: 'Pike',
    water: 'fresh',
    size: [45, 105],
    visual: 1.3,
    strength: 1.35,
    reel: 0.11,
    pull: 6.5,
    mouth: 4,
    colors: { back: '#3b4a2c', body: '#7b8a4c', belly: '#e3dfb8', fin: '#a0763a', mark: '#dcd79c' },
    sketch: { h: 0.24, tail: 0.6, pattern: 'pike' },
    where: 'Reedmere: lurking in the weed and the lily pads',
    hint: 'Something long lies still as a log in the weed. It ignores worms, but a lure that darts and pauses might wake it.',
    note: 'Long, green and patient, with a mouth full of needles. It waits motionless, then strikes in a flash. Its teeth cut fine line.',
    meal: { name: 'Pike baked with lemon and dill (mind the bones)', fill: 85 },
    food: { jerk: 1.6, crankS: 1.25, crankD: 1.1, spinner: 0.75, streamer: 0.9, worm: 0.12, prawn: 0.3 },
    life: {
      group: [1, 1], groups: 6, spacing: 11,
      speed: 0.5, burst: 4.2, turn: 1.7, perception: 10, depthTol: 2.0, cover: 'weed', lurk: true, teeth: true,
      homes: ['pads', 'weed', 'snag'], zones: ['lake'],
      depth: () => [0.6, 3.5],
      activity: ({ hour, rain }) => clamp01((isTwilight(hour) ? 1 : isDay(hour) ? 0.5 : 0.2) + rain * 0.3),
      likes: { still: 0.12, slow: 0.9, fast: 1.2, twitch: 1.5 },
      bite: 0.85, caution: 1.1, rises: () => 0.04, jumps: 0.3,
      strike: { lure: 'ambush', streamer: 'ambush' },
    },
  },
  {
    id: 'carp',
    name: 'Mirror Carp',
    water: 'fresh',
    size: [40, 88],
    visual: 1.3,
    strength: 1.6,
    reel: 0.1,
    pull: 8.5,
    mouth: 3,
    colors: { back: '#5a4a2a', body: '#b38b46', belly: '#efd9a2', fin: '#8a5a32', mark: '#dcb46c' },
    sketch: { h: 0.44, tail: 0.6, pattern: 'scales' },
    where: 'Reedmere: grazing the silty shelf and the margins',
    hint: 'Patches of fizzing bubbles rise from the shallow silt in the lake. Whatever makes them feeds on the bottom and ignores lures.',
    note: 'Bronze, with a few big mirror scales. It grazes the bottom, sending up bubbles, and runs like a train when hooked.',
    meal: { name: 'Carp stewed slowly over the fire', fill: 90 },
    food: { boilie: 1.5, corn: 1.3, bread: 0.9, worm: 0.6 },
    life: {
      group: [2, 4], groups: 5, spacing: 12,
      speed: 0.45, turn: 1.2, perception: 9, depthTol: 2.6, cover: 'weed', bottom: true, grazer: true, spooky: 1.5,
      homes: ['margin', 'sand', 'weed'], zones: ['lake'],
      depth: ({ hour }) => (isEvening(hour) || hour < 7 ? [0.6, 3] : [1, 6]),
      activity: ({ hour }) => (hour >= 16 || hour < 3 ? 1 : hour < 8 ? 0.75 : 0.5),
      likes: { still: 1.3, slow: 0.08, fast: 0, twitch: 0.05 },
      bite: 0.6, caution: 1.6, rises: ({ hour }) => (hour > 18 || hour < 5 ? 0.25 : 0.03), jumps: 0.5, bubbles: true,
      strike: { ledger: 'run', float: 'nibble' },
    },
  },
  {
    id: 'rudd',
    name: 'Rudd',
    water: 'fresh',
    size: [10, 28],
    visual: 2.2,
    strength: 0.4,
    reel: 0.28,
    pull: 0.5,
    mouth: 1,
    colors: { back: '#5a6a3a', body: '#d9c35a', belly: '#f6efd2', fin: '#e04a3a', mark: '#c9a84a' },
    sketch: { h: 0.4, tail: 0.65, pattern: 'plain' },
    where: 'Reedmere: near the surface by the lily pads',
    hint: 'Golden flashes and dimples among the lily pads near camp. Something there takes little baits near the top.',
    note: 'Gold with blood-red fins. It feeds near the surface, sipping insects and bread, and loves the shade of lily pads.',
    meal: { name: 'A crispy little rudd on a stick', fill: 20 },
    food: { bread: 1.3, corn: 1.1, worm: 0.9, dry: 1.0, nymph: 0.7, spinner: 0.15 },
    life: {
      school: true, schools: 4, members: [8, 14], spacing: 12,
      speed: 0.8, turn: 3, perception: 6, depthTol: 1.0, cover: 'weed',
      homes: ['pads', 'weed', 'sand'], zones: ['lake'],
      depth: () => [0.2, 1.4],
      activity: ({ hour }) => (isDay(hour) ? 1 : isTwilight(hour) ? 0.7 : 0.15),
      likes: { still: 1, slow: 0.6, fast: 0.1, twitch: 0.7 },
      bite: 0.75, caution: 0.75, rises: ({ hatch = 0 }) => 0.2 + hatch * 0.4, jumps: 0,
      strike: { dry: 'rise' },
    },
  },
  /* ---------------- fresh water: Fernbeck ---------------- */
  {
    id: 'trout',
    name: 'Brown Trout',
    water: 'fresh',
    size: [20, 55],
    visual: 1.6,
    strength: 0.95,
    reel: 0.15,
    pull: 2.6,
    mouth: 2,
    colors: { back: '#5a4a2a', body: '#b8935a', belly: '#f2e2b8', fin: '#8a6a40', mark: '#2a1e14' },
    sketch: { h: 0.3, tail: 0.6, pattern: 'trout' },
    where: 'Fernbeck: holding in the pools, facing the current',
    hint: 'In the clear stream pools, shadows hold still against the current. They bolt if you stamp up to the bank.',
    note: 'Buttery gold with black and red spots. Holds in the pools facing upstream and rises to hatching flies. Shy of thick line and heavy footsteps.',
    meal: { name: 'Trout cooked in foil with wild thyme', fill: 60 },
    food: { dry: 1.3, nymph: 1.25, streamer: 1.0, worm: 0.8, spinner: 0.6, crankS: 0.2 },
    life: {
      group: [1, 1], groups: 6, spacing: 5,
      speed: 0.8, turn: 2.6, perception: 7, depthTol: 1.3, cover: 'rock', stream: true, spooky: 9, lineShy: 0.5,
      homes: ['pool'], zones: ['stream'],
      depth: () => [0.25, 1.3],
      activity: ({ hour, rain }) => clamp01((hour >= 5.5 && hour < 10 ? 0.9 : hour >= 17.5 && hour < 22 ? 1 : isDay(hour) ? 0.45 : 0.25) + rain * 0.25),
      likes: { still: 0.9, slow: 1.0, fast: 0.6, twitch: 0.6 },
      bite: 0.75, caution: 1.4, rises: ({ hatch = 0 }) => hatch * 1.3, jumps: 0.25,
      strike: { dry: 'rise', nymph: 'take', streamer: 'chase', lure: 'chase' },
    },
  },
  {
    id: 'grayling',
    name: 'Grayling',
    water: 'fresh',
    size: [20, 40],
    visual: 1.7,
    strength: 0.6,
    reel: 0.2,
    pull: 1.1,
    mouth: 1,
    colors: { back: '#4f5a62', body: '#a9b2b6', belly: '#eef0ee', fin: '#7a5a7e', mark: '#2e3438' },
    sketch: { h: 0.3, tail: 0.65, pattern: 'specks', sail: true },
    where: 'Fernbeck: in small groups at the heads of the pools',
    hint: 'Silver-grey fish with a flag-like fin keep together near the bottom of the stream pools. A drifting nymph suits them.',
    note: 'The lady of the stream: silver-grey, with a great sail of a dorsal fin speckled purple. Smells faintly of thyme.',
    meal: { name: 'Grayling grilled whole on the embers', fill: 40 },
    food: { nymph: 1.4, dry: 0.9, worm: 0.7, corn: 0.3 },
    life: {
      group: [2, 3], groups: 3, spacing: 7,
      speed: 0.7, turn: 2.4, perception: 6, depthTol: 1.2, cover: 'open', stream: true, spooky: 7, lineShy: 0.6,
      homes: ['pool'], zones: ['stream'],
      depth: () => [0.3, 1.2],
      activity: ({ hour }) => (isDay(hour) ? 0.9 : isTwilight(hour) ? 0.7 : 0.2),
      likes: { still: 1, slow: 0.7, fast: 0.3, twitch: 0.5 },
      bite: 0.7, caution: 1.1, rises: ({ hatch = 0 }) => hatch * 0.6, jumps: 0.05,
      strike: { dry: 'rise', nymph: 'take' },
    },
  },
];

export const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));

// Bigger fish are rarer.
export const rollSize = (f) => Math.round(lerp(f.size[0], f.size[1], Math.pow(Math.random(), 1.7)));

/* ---------------- 3D model ---------------- */

const _c = new THREE.Color();

// One merged, vertex-coloured fish (nose along +z, about 1 unit long) that works both
// as a single mesh and as an InstancedMesh. aGlow marks the fins that glow at night.
export function buildFishGeometry(f) {
  const c = f.colors;
  const back = new THREE.Color(c.back), body = new THREE.Color(c.body), belly = new THREE.Color(c.belly);
  const mark = new THREE.Color(c.mark), fin = new THREE.Color(c.fin), red = new THREE.Color('#c2412e');
  const H = f.sketch.h * 0.9, W = 0.2, h2 = H / 2, side = W * 0.42;
  const pos = [], col = [], glow = [];
  const push = (x, y, z, color, g) => {
    pos.push(x, y, z);
    col.push(color.r, color.g, color.b);
    glow.push(g);
  };

  const sphere = new THREE.SphereGeometry(0.5, 14, 10);
  const p = sphere.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const k = z < 0 ? lerp(1, 0.32, smoothstep(0, -0.5, z)) : lerp(1, 0.75, smoothstep(0.25, 0.5, z));
    p.setXYZ(i, p.getX(i) * W * k, p.getY(i) * H * k, z);
  }
  const bodyGeo = sphere.toNonIndexed();
  const bp = bodyGeo.attributes.position;
  const rnd = seeded(f.id.length * 97 + f.id.charCodeAt(1));
  for (let i = 0; i < bp.count; i += 3) {
    const y = (bp.getY(i) + bp.getY(i + 1) + bp.getY(i + 2)) / 3 / h2;
    const z = (bp.getZ(i) + bp.getZ(i + 1) + bp.getZ(i + 2)) / 3;
    _c.copy(belly).lerp(body, smoothstep(-0.7, 0.0, y)).lerp(back, smoothstep(0.25, 0.85, y));
    const r = rnd();
    const pat = f.sketch.pattern;
    if (pat === 'bars' && y > -0.45 && z < 0.28 && z > -0.38 && Math.sin(z * 26 + 1) > 0.45) _c.lerp(mark, 0.55);
    if (pat === 'spots' && y > -0.2 && r > 0.8) _c.lerp(mark, 0.75);
    if (pat === 'specks' && r > 0.86) _c.copy(mark);
    if (pat === 'stripe' && Math.abs(y) < 0.2 && z > -0.42 && z < 0.36) _c.lerp(mark, 0.85);
    if (pat === 'mottle' && y > -0.35 && r > 0.62) _c.lerp(mark, 0.55);
    if (pat === 'scales' && Math.abs(y + 0.05) < 0.4 && z > -0.35 && z < 0.3 && r > 0.55) _c.lerp(mark, 0.65);
    if (pat === 'trout' && y > -0.35 && r > 0.8) _c.copy(r > 0.95 ? red : mark);
    if (pat === 'pike' && y > -0.45 && y < 0.6 && r > 0.6) _c.lerp(mark, 0.6);
    for (let k = 0; k < 3; k++) push(bp.getX(i + k), bp.getY(i + k), bp.getZ(i + k), _c, 0);
  }
  bodyGeo.dispose();
  sphere.dispose();

  const g = f.sketch.glow ? 1 : 0;
  const t = f.sketch.tail;
  const tri = (verts) => { for (let i = 0; i < verts.length; i += 3) push(verts[i], verts[i + 1], verts[i + 2], fin, g); };
  const tz = -0.42;
  // Dorsal fin: a tall purple sail on the grayling, a spiky crest on the perch, set far back on the pike.
  const dorsal = f.sketch.sail ? [0, h2 * 0.9, 0.22, 0, h2 * 2.5, 0.0, 0, h2 * 0.7, -0.3]
    : f.sketch.spiky ? [0, h2 * 0.85, 0.2, 0, h2 * 2.1, 0.08, 0, h2 * 0.75, -0.2]
      : f.sketch.pattern === 'pike' ? [0, h2 * 0.8, -0.18, 0, h2 * 1.9, -0.3, 0, h2 * 0.6, -0.4]
        : [0, h2 * 0.85, 0.12, 0, h2 * 1.6, -0.05, 0, h2 * 0.7, -0.28];
  tri([
    0, 0, tz, 0, h2 * 1.4 * t + 0.05, tz - 0.36, 0, 0.02, tz - 0.22,
    0, 0, tz, 0, -0.02, tz - 0.22, 0, -h2 * 1.4 * t - 0.05, tz - 0.36,
    ...dorsal,
    0, -h2 * 0.7, -0.08, 0, -h2 * 1.25, -0.22, 0, -h2 * 0.6, -0.3,
    side, -h2 * 0.2, 0.18, side + 0.12, -h2 * 0.55, 0.0, side, -h2 * 0.3, 0.02,
    -side, -h2 * 0.2, 0.18, -side - 0.12, -h2 * 0.55, 0.0, -side, -h2 * 0.3, 0.02,
  ]);

  const eye = new THREE.IcosahedronGeometry(0.032, 0); // already non-indexed
  const ep = eye.attributes.position;
  _c.set('#1a1512');
  for (const s of [1, -1]) {
    for (let i = 0; i < ep.count; i++) push(ep.getX(i) + s * side * 0.85, ep.getY(i) + h2 * 0.2, ep.getZ(i) + 0.3, _c, 0);
  }
  eye.dispose();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  geo.computeVertexNormals();
  return geo;
}

// The tail sways with a travelling wave. Instanced fish read their swim phase and
// effort from an attribute; a single fish reads it from material.userData.swim.
export function fishMaterial(f, instanced) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.38, metalness: 0.18, flatShading: true, side: THREE.DoubleSide,
  });
  const glow = new THREE.Color(f.sketch.glow ? f.colors.fin : '#000000');
  m.userData.swim = { value: new THREE.Vector2(0, 0.3) };
  m.userData.glow = { value: f.sketch.glow ? 1 : 0 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGlowColor = { value: glow };
    shader.uniforms.uGlow = m.userData.glow;
    shader.uniforms.uSwimU = m.userData.swim;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aGlow;
        varying float vGlow;
        ${instanced ? 'attribute vec2 aSwim;' : 'uniform vec2 uSwimU;'}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 sw = ${instanced ? 'aSwim' : 'uSwimU'};
        float bend = smoothstep(0.3, -0.8, position.z);
        transformed.x += sin(sw.x - position.z * 4.0) * bend * (0.03 + sw.y * 0.1);
        vGlow = aGlow;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlowColor;\nuniform float uGlow;\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowColor * vGlow * uGlow + diffuseColor.rgb * 0.16;');
  };
  m.customProgramCacheKey = () => (instanced ? 'fish-instanced' : 'fish-single');
  return m;
}

// A single fish, used while one is hooked, landed and held up for a look.
export function buildFishMesh(f) {
  const mesh = new THREE.Mesh(buildFishGeometry(f), fishMaterial(f, false));
  mesh.castShadow = true;
  mesh.visible = false;
  mesh.userData.swim = mesh.material.userData.swim.value;
  return mesh;
}

/* ---------------- journal sketch ---------------- */

export function drawFishSketch(ctx, f, cx, cy, len, { unknown = false } = {}) {
  const L = len, H = len * f.sketch.h, c = f.colors, t = f.sketch.tail;
  const rnd = seeded(f.id.charCodeAt(0) * 31 + f.id.length);
  ctx.save();
  ctx.translate(cx, cy);

  const body = new Path2D();
  body.moveTo(L * 0.5, 0);
  body.bezierCurveTo(L * 0.44, -H * 0.66, -L * 0.06, -H * 0.62, -L * 0.3, -H * 0.1);
  body.lineTo(-L * 0.3, H * 0.1);
  body.bezierCurveTo(-L * 0.06, H * 0.56, L * 0.44, H * 0.52, L * 0.5, 0);
  body.closePath();

  const tail = new Path2D();
  tail.moveTo(-L * 0.27, 0);
  tail.quadraticCurveTo(-L * 0.38, -H * 0.15, -L * 0.5, -H * (0.55 * t + 0.1));
  tail.quadraticCurveTo(-L * 0.42, 0, -L * 0.5, H * (0.55 * t + 0.1));
  tail.quadraticCurveTo(-L * 0.38, H * 0.15, -L * 0.27, 0);

  const dorsal = new Path2D();
  if (f.sketch.sail) {
    dorsal.moveTo(L * 0.22, -H * 0.45);
    dorsal.quadraticCurveTo(L * 0.12, -H * 1.5, -L * 0.18, -H * 1.05);
    dorsal.quadraticCurveTo(-L * 0.12, -H * 0.6, -L * 0.2, -H * 0.3);
    dorsal.quadraticCurveTo(L * 0.0, -H * 0.42, L * 0.22, -H * 0.45);
  } else if (f.sketch.spiky) {
    dorsal.moveTo(L * 0.2, -H * 0.46);
    for (let i = 0; i < 6; i++) {
      const x = L * (0.18 - i * 0.065);
      dorsal.lineTo(x - L * 0.012, -H * (1.05 - i * 0.07));
      dorsal.lineTo(x - L * 0.035, -H * (0.62 - i * 0.03));
    }
    dorsal.lineTo(-L * 0.2, -H * 0.3);
    dorsal.quadraticCurveTo(-L * 0.02, -H * 0.45, L * 0.2, -H * 0.46);
  } else if (f.sketch.pattern === 'pike') {
    dorsal.moveTo(-L * 0.08, -H * 0.44);
    dorsal.quadraticCurveTo(-L * 0.16, -H * 1.1, -L * 0.27, -H * 0.2);
    dorsal.quadraticCurveTo(-L * 0.14, -H * 0.35, -L * 0.08, -H * 0.44);
  } else {
    dorsal.moveTo(L * 0.16, -H * 0.47);
    dorsal.quadraticCurveTo(L * 0.0, -H * 1.0, -L * 0.2, -H * 0.3);
    dorsal.quadraticCurveTo(-L * 0.02, -H * 0.45, L * 0.16, -H * 0.47);
  }

  const anal = new Path2D();
  anal.moveTo(-L * 0.02, H * 0.4);
  anal.quadraticCurveTo(-L * 0.1, H * 0.78, -L * 0.2, H * 0.3);
  anal.quadraticCurveTo(-L * 0.1, H * 0.38, -L * 0.02, H * 0.4);

  const pect = new Path2D();
  pect.moveTo(L * 0.2, H * 0.08);
  pect.quadraticCurveTo(L * 0.08, H * 0.32, L * 0.04, H * 0.18);
  pect.quadraticCurveTo(L * 0.12, H * 0.08, L * 0.2, H * 0.08);

  const ink = '#3a2e26';
  if (unknown) {
    ctx.fillStyle = 'rgba(58, 46, 38, 0.1)';
    for (const p of [tail, dorsal, anal, body]) ctx.fill(p);
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(58, 46, 38, 0.45)';
    ctx.lineWidth = 1.4;
    for (const p of [tail, dorsal, body]) ctx.stroke(p);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(58, 46, 38, 0.55)';
    ctx.font = `700 ${Math.round(H * 0.75)}px Caveat, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', L * 0.06, H * 0.02);
    ctx.restore();
    return;
  }

  if (f.sketch.glow) {
    ctx.shadowColor = c.fin;
    ctx.shadowBlur = L * 0.08;
  }
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = c.fin;
  for (const p of [tail, dorsal, anal]) ctx.fill(p);
  ctx.shadowBlur = 0;

  const g = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
  g.addColorStop(0, c.back);
  g.addColorStop(0.45, c.body);
  g.addColorStop(1, c.belly);
  ctx.fillStyle = g;
  ctx.fill(body);
  // Watercolour bleed
  ctx.globalAlpha = 0.22;
  ctx.save();
  ctx.translate(L * 0.008, L * 0.006);
  ctx.fill(body);
  ctx.restore();

  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = c.mark;
  if (f.sketch.pattern === 'bars') {
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 6; i++) {
      const x = L * (0.24 - i * 0.09);
      ctx.beginPath();
      ctx.ellipse(x, -H * 0.12, L * 0.022, H * 0.36, 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.sketch.pattern === 'spots') {
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 22; i++) {
      ctx.beginPath();
      ctx.arc(L * (0.32 - rnd() * 0.6), -H * (0.05 + rnd() * 0.35), L * (0.008 + rnd() * 0.01), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.sketch.pattern === 'stripe') {
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-L * 0.3, -H * 0.06, L * 0.7, H * 0.12);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-L * 0.3, H * 0.08, L * 0.7, H * 0.3);
  } else if (f.sketch.pattern === 'scales') {
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.ellipse(L * (0.26 - rnd() * 0.5), H * (-0.15 + rnd() * 0.28), L * (0.03 + rnd() * 0.025), H * (0.08 + rnd() * 0.06), rnd() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.sketch.pattern === 'trout') {
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 30; i++) {
      const red = i % 4 === 0;
      const x = L * (0.34 - rnd() * 0.62), y = -H * (rnd() * 0.42) + (red ? H * 0.12 : 0);
      if (red) {
        ctx.fillStyle = 'rgba(255, 245, 225, 0.8)';
        ctx.beginPath();
        ctx.arc(x, y, L * 0.016, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = red ? '#c2412e' : c.mark;
      ctx.beginPath();
      ctx.arc(x, y, L * (red ? 0.009 : 0.008 + rnd() * 0.006), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.sketch.pattern === 'pike') {
    ctx.globalAlpha = 0.8;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.ellipse(L * (0.3 - i * 0.07 - (row % 2) * 0.035), H * (-0.3 + row * 0.16), L * 0.018, H * 0.045, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (f.sketch.pattern === 'plain') {
    ctx.globalAlpha = 0.2;
    ctx.fillRect(-L * 0.3, -H * 0.02, L * 0.7, H * 0.04);
  } else if (f.sketch.pattern === 'mottle') {
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.ellipse(L * (0.34 - rnd() * 0.64), -H * (rnd() * 0.42), L * (0.02 + rnd() * 0.035), H * (0.05 + rnd() * 0.08), rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = c.mark;
    ctx.shadowBlur = L * 0.02;
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.arc(L * (0.38 - rnd() * 0.66), H * (rnd() - 0.6) * 0.8, L * (0.004 + rnd() * 0.006), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = c.fin;
  ctx.fill(pect);

  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.2, L * 0.008);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of [body, tail, dorsal, anal, pect]) ctx.stroke(p);
  // A second, lighter pass makes it feel hand-inked.
  ctx.globalAlpha = 0.28;
  ctx.save();
  ctx.translate(L * 0.004, -L * 0.003);
  ctx.stroke(body);
  ctx.stroke(tail);
  ctx.restore();

  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(L * 0.14, 0, H * 0.4, -0.75, 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(L * 0.5, H * 0.02);
  ctx.lineTo(L * 0.44, H * 0.05);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(L * 0.36, -H * 0.1, Math.max(2, H * 0.07), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(L * 0.365, -H * 0.12, Math.max(0.8, H * 0.022), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawLanternSketch(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  const ink = '#3a2e26';
  const glow = ctx.createRadialGradient(0, s * 0.1, 0, 0, s * 0.1, s * 0.9);
  glow.addColorStop(0, 'rgba(255, 196, 110, 0.55)');
  glow.addColorStop(1, 'rgba(255, 196, 110, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-s, -s, s * 2, s * 2);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(255, 214, 140, 0.75)';
  ctx.beginPath();
  ctx.rect(-s * 0.28, -s * 0.2, s * 0.56, s * 0.62);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b98b3f';
  ctx.beginPath();
  ctx.moveTo(-s * 0.36, -s * 0.2);
  ctx.lineTo(0, -s * 0.48);
  ctx.lineTo(s * 0.36, -s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-s * 0.36, s * 0.42, s * 0.72, s * 0.1);
  ctx.strokeRect(-s * 0.36, s * 0.42, s * 0.72, s * 0.1);
  ctx.beginPath();
  ctx.arc(0, -s * 0.58, s * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.09, -s * 0.2);
  ctx.lineTo(-s * 0.09, s * 0.42);
  ctx.moveTo(s * 0.09, -s * 0.2);
  ctx.lineTo(s * 0.09, s * 0.42);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 170, 70, 0.9)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.14, s * 0.06, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
