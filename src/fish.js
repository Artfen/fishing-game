import * as THREE from 'three';
import { lerp, smoothstep, seeded } from './util.js';
import { hasAnatomy, anatomyGeometry, anatomyMaterials } from './anatomy.js';
import { registerFor, titleName } from './register.js';
import { isDay, isEvening, isTwilight, clamp01 } from './habits.js';
import { ATLANTIC } from './atlantic.js';
import { SOUTH, AT_BRASAS, SOUTH_REEF } from './southFish.js';
import { BIG_GAME } from './bigGame.js';

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
    retired: true, // fictional: replaced by a real species, kept for old catches
    wt: 0.006, // weight ≈ wt × length³ (grams, length in cm)
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
    food: { worm: 0.7, bread: 1.3, corn: 0.35, maggot: 1.2, rag: 0.4 },
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
    retired: true, // fictional: replaced by a real species, kept for old catches
    fight: 'dash',
    wt: 0.016,
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
    food: { worm: 1, prawn: 0.8, corn: 0.5, bread: 0.4, spinner: 1.0, crankS: 0.45, streamer: 0.6, tspin: 0.9, spoon: 0.6, minnow: 0.5, maggot: 0.8, rag: 1.0, crab: 0.6, shad: 0.4 },
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
    retired: true, // fictional: replaced by a real species, kept for old catches
    wt: 0.009,
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
    food: { worm: 0.9, prawn: 1.3, spinner: 1.2, crankS: 0.9, crankD: 1.25, jerk: 0.8, metal: 1.3, sandeel: 1.2, shad: 0.8, strip: 0.9, popper: 0.6 },
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
    retired: true, // fictional: replaced by a real species, kept for old catches
    wt: 0.012,
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
    food: { worm: 1, prawn: 1.2, corn: 0.4, spinner: 0.4, rag: 0.9, strip: 0.6 },
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
    retired: true, // fictional: replaced by a real species, kept for old catches
    fight: 'dogged',
    wt: 0.014,
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
    food: { worm: 0.8, prawn: 1.4, boilie: 1.1, corn: 0.3, crankD: 0.25, strip: 1.3, crab: 1.2, lug: 0.6 },
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
    fight: 'dash',
    wt: 0.012,
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
    where: 'Reedmere and Longmere: weed edges and fallen trees, in little packs',
    hint: 'Striped hunters move in packs around the weed and the fallen tree in the lake. They chase small lures that flash.',
    note: 'Dark bars, a spiky fin and bright orange-red fins below. Where one follows a lure, the rest of the pack comes too.',
    meal: { name: 'Perch fillets crisped in butter', fill: 40 },
    food: { worm: 1.2, spinner: 1.3, crankS: 1.0, crankD: 0.7, jerk: 0.35, streamer: 1.0, nymph: 0.35, prawn: 0.6, corn: 0.15, bread: 0.1, tspin: 1.2, spoon: 1.0, minnow: 0.9, maggot: 1.1, shad: 1.0, creature: 0.4, popper: 0.3 },
    life: {
      group: [4, 7], groups: 7, spacing: 9, groupsIn: { lake: 6, mere: 8 },
      speed: 0.75, turn: 2.6, perception: 8, depthTol: 1.6, cover: 'any', pack: true,
      homes: ['weed', 'snag', 'rock', 'dropoff', 'holm', 'pads', 'margin'], zones: ['lake', 'mere'],
      depth: ({ night }) => (night > 0.6 ? [1.5, 5] : [0.8, 4.2]),
      activity: ({ hour }) => (isDay(hour) ? 1 : isTwilight(hour) ? 0.85 : 0.15),
      likes: { still: 0.6, slow: 1.1, fast: 0.8, twitch: 1.3 },
      bite: 0.7, caution: 0.9, rises: ({ hour }) => (isTwilight(hour) ? 0.15 : 0), jumps: 0.05,
      strike: { lure: 'chase', streamer: 'chase' },
    },
  },
  {
    id: 'pike',
    fight: 'thrash',
    wt: 0.0055,
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
    where: 'Reedmere and Longmere: lurking in the weed, the lily pads and the drowned oaks',
    hint: 'Something long lies still as a log in the weed. It ignores worms, but a lure that darts and pauses might wake it.',
    note: 'Long, green and patient, with a mouth full of needles. It waits motionless, then strikes in a flash. Its teeth cut fine line.',
    meal: { name: 'Pike baked with lemon and dill (mind the bones)', fill: 85 },
    food: { jerk: 1.6, crankS: 1.25, crankD: 1.1, spinner: 0.75, streamer: 0.9, worm: 0.12, prawn: 0.3, spoon: 0.6, minnow: 0.55, tspin: 0.3, shad: 1.4, creature: 0.3, popper: 0.6 },
    life: {
      group: [1, 1], groups: 6, spacing: 11, groupsIn: { lake: 2, mere: 7 },
      speed: 0.5, burst: 4.2, turn: 1.7, perception: 13, depthTol: 2.0, cover: 'weed', lurk: true, teeth: true,
      homes: ['pads', 'weed', 'snag', 'dropoff'], zones: ['lake', 'mere'],
      depth: () => [0.6, 3.5],
      activity: ({ hour, rain }) => clamp01((isTwilight(hour) ? 1 : isDay(hour) ? 0.5 : 0.2) + rain * 0.3),
      likes: { still: 0.12, slow: 0.9, fast: 1.2, twitch: 1.5 },
      bite: 0.85, caution: 1.1, rises: () => 0.04, jumps: 0.3,
      strike: { lure: 'ambush', streamer: 'ambush' },
    },
  },
  {
    id: 'carp',
    fight: 'dogged',
    wt: 0.017,
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
    food: { boilie: 1.5, corn: 1.3, bread: 0.9, worm: 0.6, maggot: 0.5 },
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
    wt: 0.013,
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
    food: { bread: 1.3, corn: 1.1, worm: 0.9, dry: 1.0, nymph: 0.7, spinner: 0.15, tspin: 0.25, maggot: 1.2 },
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
    fight: 'dash',
    wt: 0.011,
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
    food: { dry: 1.3, nymph: 1.25, streamer: 1.0, worm: 0.8, spinner: 0.6, crankS: 0.2, tspin: 1.3, spoon: 1.15, minnow: 1.0, maggot: 0.6 },
    life: {
      group: [1, 2], groups: 6, spacing: 5,
      speed: 0.8, turn: 2.6, perception: 7, depthTol: 1.3, cover: 'rock', stream: true, spooky: 9, lineShy: 0.5,
      homes: ['pool'], zones: ['stream', 'river', 'tarn'],
      depth: () => [0.25, 1.3],
      activity: ({ hour, rain }) => clamp01((hour >= 5.5 && hour < 10 ? 0.9 : hour >= 17.5 && hour < 22 ? 1 : isDay(hour) ? 0.45 : 0.25) + rain * 0.25),
      likes: { still: 0.9, slow: 1.0, fast: 0.6, twitch: 0.6 },
      bite: 0.75, caution: 1.4, rises: ({ hatch = 0 }) => hatch * 1.3, jumps: 0.25,
      strike: { dry: 'rise', nymph: 'take', streamer: 'chase', lure: 'chase' },
    },
  },
  {
    id: 'grayling',
    fight: 'dash',
    wt: 0.009,
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
    food: { nymph: 1.4, dry: 0.9, worm: 0.7, corn: 0.3, tspin: 0.45, maggot: 1.1 },
    life: {
      group: [2, 4], groups: 4, spacing: 5,
      speed: 0.7, turn: 2.4, perception: 6, depthTol: 1.2, cover: 'open', stream: true, spooky: 7, lineShy: 0.6,
      homes: ['pool'], zones: ['stream', 'river'],
      depth: () => [0.3, 1.2],
      activity: ({ hour }) => (isDay(hour) ? 0.9 : isTwilight(hour) ? 0.7 : 0.2),
      likes: { still: 1, slow: 0.7, fast: 0.3, twitch: 0.5 },
      bite: 0.7, caution: 1.1, rises: ({ hatch = 0 }) => hatch * 0.6, jumps: 0.05,
      strike: { dry: 'rise', nymph: 'take' },
    },
  },
  /* ---------------- fresh water: Reedmere and Longmere ---------------- */
  {
    id: 'tench',
    fight: 'dogged',
    name: 'Tench',
    water: 'fresh',
    wt: 0.017,
    size: [25, 60],
    visual: 1.35,
    strength: 1.2,
    reel: 0.12,
    pull: 3.4,
    mouth: 2,
    colors: { back: '#2e4a2a', body: '#5f7a3a', belly: '#c9b56a', fin: '#3a4a2a', mark: '#d0563a' },
    sketch: { h: 0.4, tail: 0.5, pattern: 'plain', round: true },
    where: 'Reedmere: the weedy margins, at first light',
    hint: 'At dawn, strings of tiny bubbles rise along the reeds in the pond. Something feeds on the bottom there, slowly.',
    note: 'Olive-gold and slippery, with tiny red eyes and round paddle fins. It browses the silt among the reeds at dawn, and pulls far harder than it looks.',
    meal: { name: 'Tench baked with garlic and herbs', fill: 55 },
    food: { worm: 1.3, maggot: 1.2, corn: 1.1, bread: 0.6, boilie: 0.5 },
    life: {
      group: [1, 3], groups: 5, spacing: 10,
      speed: 0.4, turn: 1.4, perception: 7, depthTol: 2.0, cover: 'weed', bottom: true, grazer: true, spooky: 1.2,
      homes: ['margin', 'weed', 'pads'], zones: ['lake'],
      depth: () => [0.6, 3],
      activity: ({ hour, cloud = 0 }) => clamp01((hour >= 4.5 && hour < 9.5 ? 1 : hour >= 19 || hour < 1 ? 0.8 : 0.35) + cloud * 0.15),
      likes: { still: 1.3, slow: 0.25, fast: 0, twitch: 0.35 },
      bite: 0.6, caution: 1.3, rises: () => 0, jumps: 0, bubbles: true,
      strike: { ledger: 'run', float: 'nibble' },
    },
  },
  {
    id: 'roach',
    name: 'Roach',
    water: 'fresh',
    wt: 0.012,
    size: [10, 32],
    visual: 2.1,
    strength: 0.45,
    reel: 0.26,
    pull: 0.55,
    mouth: 1,
    colors: { back: '#4a5a64', body: '#c8ccc8', belly: '#f2f0ea', fin: '#d0503a', mark: '#b8bcb6' },
    sketch: { h: 0.38, tail: 0.65, pattern: 'plain', redEye: true },
    where: 'Reedmere and Longmere: shoals over weed and open shallows',
    hint: 'Silver flashes in shoals over the weed, in both lakes. They take small baits under a float: maggots, bread, sweetcorn.',
    note: 'Bright silver with red fins and a red eye. Shoals of them sway over the weed, and the float dances when they find your bait.',
    meal: { name: 'Little roach fried crisp', fill: 18 },
    food: { maggot: 1.4, bread: 1.2, corn: 0.9, worm: 0.8, nymph: 0.5, dry: 0.4, tspin: 0.15 },
    life: {
      school: true, schools: 6, members: [8, 16], spacing: 18, groupsIn: { lake: 2, mere: 4 },
      speed: 0.75, turn: 2.8, perception: 6, depthTol: 1.2, cover: 'weed',
      homes: ['weed', 'pads', 'sand', 'shallows'], zones: ['lake', 'mere'],
      depth: ({ night }) => (night > 0.6 ? [1, 3] : [0.4, 2.4]),
      activity: ({ hour }) => (isDay(hour) ? 0.9 : isTwilight(hour) ? 1 : 0.3),
      likes: { still: 1, slow: 0.7, fast: 0.1, twitch: 0.6 },
      bite: 0.8, caution: 0.8, rises: ({ hatch = 0 }) => 0.1 + hatch * 0.2, jumps: 0,
    },
  },
  {
    id: 'lmbass',
    fight: 'thrash',
    name: 'Largemouth Bass',
    water: 'fresh',
    wt: 0.014,
    size: [25, 58],
    visual: 1.45,
    strength: 1.1,
    reel: 0.13,
    pull: 3.4,
    mouth: 3,
    colors: { back: '#3a4a2a', body: '#7a8a4a', belly: '#e6e2c0', fin: '#5a6a3a', mark: '#2a3420' },
    sketch: { h: 0.4, tail: 0.6, pattern: 'band', bigMouth: true },
    where: 'Longmere: weed beds, lily pads and fallen timber (a freshwater fish, no relation of the sea bass)',
    hint: 'In the lake beyond Wend Quay, something with a huge mouth lies in ambush by the lily pads and drowned oaks. It loves a lure that crawls or pops.',
    note: 'A freshwater sunfish, green with a dark stripe along its side and a mouth like a bucket. It ambushes from cover and jumps when hooked. Not a sea bass at all.',
    meal: { name: 'Largemouth bass fillets in breadcrumbs', fill: 55 },
    food: { creature: 1.5, popper: 1.3, shad: 1.2, crankS: 1.1, crankD: 0.9, worm: 1.0, spinner: 0.8, jerk: 0.9, streamer: 1.0, minnow: 0.7 },
    life: {
      group: [1, 2], groups: 11, spacing: 14,
      speed: 0.6, burst: 3.6, turn: 2.0, perception: 9, depthTol: 1.8, cover: 'any',
      homes: ['weed', 'pads', 'snag', 'shallows', 'holm'], zones: ['mere'],
      depth: ({ hour }) => (isTwilight(hour) ? [0.3, 2] : [0.8, 4]),
      activity: ({ hour, cloud = 0, rain = 0 }) => clamp01((isTwilight(hour) ? 1 : isDay(hour) ? 0.55 : 0.3) + cloud * 0.25 + rain * 0.1),
      likes: { still: 0.6, slow: 1.2, fast: 0.8, twitch: 1.4 },
      bite: 0.8, caution: 1.0, rises: ({ hour }) => (isTwilight(hour) ? 0.3 : 0.05), jumps: 0.6,
      strike: { lure: 'chase', streamer: 'chase' },
    },
  },
  /* ---------------- the estuary and the coast ---------------- */
  {
    id: 'seabass',
    fight: 'dash',
    name: 'Sea Bass',
    water: 'salt',
    wt: 0.0115,
    size: [30, 75],
    visual: 1.35,
    strength: 1.25,
    reel: 0.12,
    pull: 4.6,
    mouth: 3,
    colors: { back: '#4a5a6a', body: '#c4ccd2', belly: '#f2f4f2', fin: '#8a96a0', mark: '#5a6a78' },
    sketch: { h: 0.32, tail: 0.65, pattern: 'plain', spiky: true },
    where: 'The Wend’s channels and the quay; the surf off rocky points',
    hint: 'Silver hunters push up the estuary on the flood and prowl the white water off rocky points. A soft sandeel or a popper at dawn or dusk.',
    note: 'Bright silver with a spiny back, built for surf and current. It hunts in the white water and the estuary channels, and runs hard. A sea fish: the largemouth bass of the lake is no relation.',
    meal: { name: 'Sea bass baked whole with fennel', fill: 70 },
    food: { sandeel: 1.5, popper: 1.25, shad: 1.2, crankS: 1.0, metal: 0.7, crab: 1.3, strip: 1.1, prawn: 1.0, rag: 0.8, spinner: 0.6, lug: 0.6 },
    life: {
      group: [1, 3], groups: 12, spacing: 22, favour: ['strand'],
      speed: 0.9, burst: 3.2, turn: 2.0, perception: 11, depthTol: 2.4, cover: 'any', lineShy: 0.55,
      homes: ['channel', 'quay', 'surf', 'reef'], zones: ['estuary', 'coast', 'tideway'],
      depth: ({ hour, rain = 0 }) => (isTwilight(hour) || rain > 0.3 ? [0.4, 2.5] : [1.2, 5]),
      activity: ({ hour, rain = 0, cloud = 0 }) => clamp01((isTwilight(hour) ? 1 : isDay(hour) ? 0.45 : 0.6) + rain * 0.25 + cloud * 0.1),
      likes: { still: 0.8, slow: 1.2, fast: 1.0, twitch: 1.2 },
      bite: 0.7, caution: 1.3, rises: ({ hour }) => (isTwilight(hour) ? 0.2 : 0.03), jumps: 0.2,
      strike: { lure: 'chase' },
    },
  },
  {
    id: 'mullet',
    fight: 'dash',
    name: 'Thick-lipped Mullet',
    water: 'salt',
    wt: 0.0115,
    size: [30, 62],
    visual: 1.35,
    strength: 1.35,
    reel: 0.12,
    pull: 3.9,
    mouth: 1,
    colors: { back: '#4e5e6a', body: '#a8b4bc', belly: '#eef0ee', fin: '#7a8892', mark: '#6a7882' },
    sketch: { h: 0.3, tail: 0.6, pattern: 'lines' },
    where: 'The Wend estuary and the quay: grey shapes cruising the shallows',
    hint: 'Grey backs cruise in shoals across the estuary flats and round the quay, sipping at the surface. Famously fussy: bread flake on a fine line, and patience.',
    note: 'Grey, thick-lipped and maddening. Shoals graze the mud and sip at the surface, nibbling baits without taking them, then fight like a fish twice the size.',
    meal: { name: 'Mullet grilled with lemon', fill: 55 },
    food: { bread: 1.6, maggot: 0.7, rag: 0.35, corn: 0.3 },
    life: {
      school: true, schools: 6, members: [5, 10], spacing: 26,
      speed: 0.7, turn: 2.2, perception: 9, depthTol: 1.0, cover: 'open', spooky: 4, lineShy: 0.4,
      homes: ['flats', 'quay', 'reeds'], zones: ['estuary', 'bay', 'tideway'],
      depth: () => [0.2, 1.4],
      activity: ({ hour }) => (isDay(hour) ? 0.9 : isTwilight(hour) ? 0.7 : 0.25),
      likes: { still: 1.2, slow: 0.5, fast: 0, twitch: 0.2 },
      bite: 0.35, caution: 2.2, rises: () => 0.25, jumps: 0.1,
    },
  },
  {
    id: 'wrasse',
    fight: 'dogged',
    name: 'Ballan Wrasse',
    water: 'salt',
    wt: 0.016,
    size: [25, 55],
    visual: 1.4,
    strength: 1.15,
    reel: 0.13,
    pull: 3.2,
    mouth: 2,
    colors: { back: '#2e5a3a', body: '#6a9a5a', belly: '#e0b47a', fin: '#c46a3a', mark: '#e8d07a' },
    sketch: { h: 0.4, tail: 0.5, pattern: 'specks', spiky: true, lips: true },
    where: 'The outer coast: reefs and kelp round Gannet Isle and the Skerries',
    hint: 'Among the kelp on the reefs out at sea, big-lipped fish pick crabs off the rocks. A crab or ragworm on the bottom by the rocks; hold on when it dives.',
    note: 'Green and orange, speckled like a bird’s egg, with thick lips for crunching crabs. Hooked, it dives straight for its hole in the kelp.',
    keep: 'Better to let a wrasse go home to its reef. Back into the kelp it goes.',
    food: { crab: 1.6, rag: 1.2, prawn: 1.1, strip: 0.6, shad: 0.6, sandeel: 0.5, worm: 0.7 },
    life: {
      group: [1, 2], groups: 14, spacing: 14,
      speed: 0.45, turn: 1.8, perception: 7, depthTol: 2.2, cover: 'rock', bottom: true,
      homes: ['reef'], zones: ['coast'],
      depth: () => [2, 12],
      activity: ({ hour }) => (isDay(hour) ? 0.9 : isTwilight(hour) ? 0.5 : 0.1),
      likes: { still: 1.2, slow: 0.7, fast: 0.15, twitch: 0.5 },
      bite: 0.7, caution: 0.9, rises: () => 0, jumps: 0,
      strike: { bottom: 'nibble', lure: 'chase' },
    },
  },
  {
    id: 'mackerel',
    fight: 'dash',
    name: 'Mackerel',
    water: 'salt',
    wt: 0.0062,
    size: [24, 42],
    visual: 1.6,
    strength: 0.75,
    reel: 0.2,
    pull: 1.1,
    mouth: 2,
    colors: { back: '#1e5a6a', body: '#a8c4c8', belly: '#f2f6f4', fin: '#3a6a74', mark: '#0e2a34' },
    sketch: { h: 0.24, tail: 0.85, pattern: 'mackerel', forked: true },
    where: 'The open tide: fast shoals off the islands and over the shoal',
    hint: 'Out in the tide, shoals boil at the surface and gulls dive into the commotion. A metal cast into it and wound fast.',
    note: 'Blue-green tiger stripes on top, silver below, and never still. Shoals race through the tide, and gulls give them away.',
    meal: { name: 'Mackerel grilled straight from the sea', fill: 45 },
    food: { metal: 1.5, strip: 1.2, sandeel: 0.9, spinner: 1.0, shad: 0.6, rag: 0.5, prawn: 0.4 },
    life: {
      school: true, schools: 9, members: [14, 24], spacing: 60, range: 1.8,
      speed: 1.6, turn: 3.0, perception: 10, depthTol: 2.5, cover: 'open',
      homes: ['tide'], zones: ['coast', 'open', 'deep'],
      depth: ({ hour }) => (isDay(hour) ? [0.5, 5] : [3, 12]),
      activity: ({ hour }) => (isDay(hour) ? 1 : isTwilight(hour) ? 0.7 : 0.2),
      likes: { still: 0.2, slow: 0.7, fast: 1.5, twitch: 1.2 },
      bite: 0.8, caution: 0.6, rises: () => 0, jumps: 0.05, birds: true,
      strike: { lure: 'chase' },
    },
  },
  {
    id: 'flounder',
    fight: 'flat',
    name: 'Flounder',
    water: 'salt',
    wt: 0.012,
    size: [20, 45],
    visual: 1.5,
    strength: 0.75,
    reel: 0.18,
    pull: 1.4,
    mouth: 2,
    colors: { back: '#6a5e46', body: '#8a7a5a', belly: '#f2efe6', fin: '#5a4e3a', mark: '#4a4030' },
    sketch: { h: 0.62, tail: 0.4, pattern: 'mottle', flat: true },
    where: 'The Wend estuary: lying flat on the sandy and muddy bottom',
    hint: 'In the estuary, a flat shape lies buried in the sand with only its eyes showing. A worm on a bottom rig, moved along slowly now and then.',
    note: 'Flat as a plate, brown and freckled on top to match the mud, white underneath, with both eyes on one side. It lies buried and creeps up on worms.',
    meal: { name: 'Flounder pan-fried in butter', fill: 45 },
    food: { lug: 1.5, rag: 1.4, crab: 1.0, worm: 1.0, maggot: 0.4, strip: 0.6, prawn: 0.6 },
    life: {
      group: [1, 1], groups: 18, spacing: 12, flat: true,
      speed: 0.3, turn: 1.2, perception: 9, depthTol: 1.0, cover: 'open', bottom: true,
      homes: ['flats', 'channel'], zones: ['estuary', 'tideway'],
      depth: () => [0.5, 4],
      activity: ({ hour, rain = 0 }) => clamp01((isDay(hour) ? 0.6 : 0.85) + rain * 0.1),
      likes: { still: 1.2, slow: 0.9, fast: 0.1, twitch: 0.5 },
      bite: 0.65, caution: 1.0, rises: () => 0, jumps: 0,
      strike: { bottom: 'nibble', ledger: 'nibble', float: 'nibble' },
    },
  },
  {
    id: 'plaice',
    fight: 'flat',
    name: 'Plaice',
    water: 'salt',
    wt: 0.011,
    size: [25, 55],
    visual: 1.45,
    strength: 0.85,
    reel: 0.16,
    pull: 1.9,
    mouth: 2,
    colors: { back: '#6a5a44', body: '#8a7656', belly: '#f4f1ea', fin: '#5e4e3a', mark: '#e0702a' },
    sketch: { h: 0.65, tail: 0.4, pattern: 'orange', flat: true },
    where: 'The outer coast: clean sand between the reefs, and the Long Shoal',
    hint: 'On the clean sand out at sea, between the reefs and on the Long Shoal, flat fish with orange spots lie still. Lugworm or ragworm on the seabed.',
    note: 'Flat and sand-brown with bright orange spots, eyes on top. It noses over the sand for worms and shellfish.',
    meal: { name: 'Plaice with brown butter', fill: 50 },
    food: { lug: 1.3, rag: 1.2, strip: 0.8, crab: 0.6, prawn: 0.7, worm: 0.8 },
    life: {
      group: [1, 2], groups: 20, spacing: 14, flat: true,
      speed: 0.3, turn: 1.2, perception: 9, depthTol: 1.2, cover: 'open', bottom: true,
      homes: ['sand'], zones: ['coast'],
      depth: () => [3, 16],
      activity: ({ hour }) => (isDay(hour) ? 0.85 : 0.4),
      likes: { still: 1.2, slow: 0.9, fast: 0.1, twitch: 0.4 },
      bite: 0.65, caution: 1.0, rises: () => 0, jumps: 0,
      strike: { bottom: 'nibble', ledger: 'nibble', float: 'nibble' },
    },
  },
  /* ---------------- offshore ---------------- */
  {
    id: 'sprat',
    name: 'Sprat',
    water: 'salt',
    wt: 0.006,
    size: [8, 15],
    visual: 3.2,
    strength: 0.3,
    reel: 0.34,
    pull: 0.15,
    mouth: 1,
    colors: { back: '#3a6a7a', body: '#cfdcdf', belly: '#f6faf8', fin: '#9ab4ba', mark: '#e6f0f4' },
    sketch: { h: 0.24, tail: 0.75, pattern: 'stripe' },
    where: 'Out to sea: dense shoals in the open water',
    hint: 'Far out, the sea sometimes fizzes with tiny silver fish crammed into a ball. Bigger hunters are never far behind. Sabiki feathers on the coastal rod, let down into the shoal and lifted gently, take them.',
    note: 'A little silver fish that lives in vast shoals. Mackerel, birds and tuna all feed on them; where the sprats are, the hunters come.',
    keep: 'Far too small to keep. You drop it back to its shoal.',
    food: { sabiki: 1.5, bread: 0.6, rag: 0.5 },
    life: {
      school: true, schools: 8, members: [26, 40], spacing: 70, range: 2.2, bait: true, midwater: true,
      speed: 0.9, turn: 3.6, perception: 5, depthTol: 1.4, cover: 'open',
      homes: ['blue', 'tide'], zones: ['deep', 'coast'],
      depth: ({ hour }) => (isDay(hour) ? [1, 6] : [4, 14]),
      activity: () => 0.8,
      likes: { still: 1, slow: 0.8, fast: 0.1, twitch: 0.9 },
      bite: 0.7, caution: 0.6, rises: () => 0, jumps: 0,
      // (They pick at sabiki feathers as at a bait: a string of tiny lures is no chase.)
      strike: { lure: 'nibble', float: 'nibble' },
    },
  },
  {
    id: 'tuna',
    fight: 'deep',
    name: 'Bluefin Tuna',
    water: 'salt',
    wt: 0.02,
    size: [95, 175],
    visual: 1.0,
    strength: 2.3,
    reel: 0.07,
    pull: 52,
    mouth: 5, // it gulps a lure as long as your forearm
    colors: { back: '#14284a', body: '#5a7894', belly: '#e8ecee', fin: '#d8b43a', mark: '#c8d4dc' },
    sketch: { h: 0.32, tail: 1.0, pattern: 'tuna', forked: true, finlets: true },
    where: 'The Blue Water: roaming far offshore after the bait shoals',
    hint: 'Far past the shelf, birds dive and the sea erupts as something huge drives sprats to the surface. Cast a big stickbait into the boil, on the offshore rod.',
    note: 'Steel-blue and torpedo-shaped, with a sickle tail and a row of yellow finlets. It roams the open sea at the speed of a boat and fights for a long, long time.',
    keep: 'Every bluefin goes back in these waters: anglers may only catch and release them, to let the stock that has come back keep coming back. You hold it alongside a moment, then let it swim free.',
    food: { stickbait: 1.6, mjig: 1.4, popper: 0.9, metal: 0.6, strip: 0.5, sandeel: 0.6 },
    life: {
      school: true, schools: 3, members: [4, 6], spacing: 140, range: 3.2, hunter: 'sprat',
      speed: 2.6, burst: 3, turn: 1.4, perception: 22, depthTol: 4, cover: 'open',
      homes: ['blue'], zones: ['deep'],
      depth: ({ hour }) => (isDay(hour) ? [1, 14] : [6, 30]),
      activity: ({ hour, cloud = 0 }) => clamp01((isTwilight(hour) ? 1 : isDay(hour) ? 0.75 : 0.25) + cloud * 0.05),
      likes: { still: 0.1, slow: 0.6, fast: 1.5, twitch: 1.3 },
      bite: 0.75, caution: 0.9, rises: () => 0, jumps: 0.15, birds: true,
      strike: { lure: 'chase' },
    },
  },
  {
    id: 'squid',
    fight: 'jet',
    name: 'Squid',
    creature: 'squid',
    water: 'salt',
    wt: 0.085, wtPow: 2.5,
    size: [12, 38],
    visual: 2.2,
    strength: 0.8,
    reel: 0.2,
    pull: 1.3,
    mouth: 3,
    colors: { back: '#b85a6a', body: '#e8c4c4', belly: '#f6eeee', fin: '#d89aa2', mark: '#8a3a4a' },
    sketch: { h: 0.32, tail: 0.5, pattern: 'squid' },
    where: 'Calm sheltered water at night, near lights: Puffin Cove, the old jetty, the reef',
    hint: 'After dark, pale shapes hover at the edge of the light under the old jetty’s lamp and in Puffin Cove. A squid jig, sunk, darted up and let glide down.',
    note: 'Not a fish at all: a soft, clever animal with ten arms, two fins and great dark eyes, that changes colour as it thinks. It stalks a jig, then grabs it as it glides down, and squirts ink when it comes out of the water.',
    meal: { name: 'Squid rings fried crisp, with a squeeze of lemon', fill: 45 },
    food: { egi18: 1.3, egi25: 1.4, egi30: 1.15, prawn: 0.45, strip: 0.35 },
    life: {
      school: true, schools: 6, members: [3, 6], spacing: 30, groupsIn: { cove: 3, coast: 2, bay: 1 },
      speed: 0.55, burst: 2.6, turn: 2.6, perception: 9, depthTol: 2.0, cover: 'any', squid: true, lantern: true,
      homes: ['cove', 'reef'], zones: ['cove', 'coast', 'bay'],
      depth: ({ night }) => (night > 0.5 ? [0.8, 4] : [4, 12]),
      activity: ({ night, lanternNear }) => clamp01(0.15 + night * 0.85 + (lanternNear ? 0.2 : 0)),
      likes: { still: 1.25, slow: 0.7, fast: 0.15, twitch: 0.9 },
      bite: 0.75, caution: 1.0, rises: () => 0, jumps: 0,
      strike: { lure: 'chase', jig: 'chase', float: 'nibble' },
    },
  },
  /* ---------------- the Atlantic field guide's reference species (see register.js) ---------------- */
  {
    id: 'meagre',
    fight: 'dogged',
    name: 'Meagre',
    water: 'salt',
    wt: 0.0098,
    size: [45, 140],
    visual: 1.2,
    strength: 1.7,
    reel: 0.085,
    pull: 13,
    mouth: 4,
    colors: { back: '#5b5a4c', body: '#b9b7aa', belly: '#ece8de', fin: '#8a5a44', mark: '#3e3a30' },
    sketch: { h: 0.3, tail: 0.55, pattern: 'plain', spiky: true },
    where: 'The Wend estuary: the deep channel, the rocks and the quay, mostly at dusk and after dark',
    hint: 'Something big drums in the estuary channel at dusk. A soft shad or a sandeel worked slowly near the bottom, or a mackerel strip on the bottom rod.',
    note: 'A big, silver-bronze croaker of estuaries, with a large mouth golden inside and a lateral line that runs right out onto its tail. Males drum loudly in spring, when meagre gather in estuaries like the Gironde to spawn.',
    meal: { name: 'Meagre steaks grilled with olive oil and garlic', fill: 80 },
    food: { shad: 1.6, sandeel: 1.4, strip: 1.3, crab: 0.9, prawn: 0.9, lug: 0.7, rag: 0.6, metal: 0.5, popper: 0.3 },
    life: {
      group: [1, 3], groups: 7, spacing: 28,
      speed: 0.7, burst: 3.0, turn: 1.6, perception: 12, depthTol: 2.6, cover: 'any',
      homes: ['channel', 'rock', 'quay'], zones: ['estuary'],
      depth: ({ hour }) => (isTwilight(hour) || isEvening(hour) ? [1.2, 4] : [2.5, 8]),
      activity: ({ hour, rain = 0 }) => clamp01((isTwilight(hour) ? 1 : isEvening(hour) ? 0.85 : 0.3) + rain * 0.1),
      likes: { still: 0.9, slow: 1.25, fast: 0.6, twitch: 1.0 },
      bite: 0.65, caution: 1.2, rises: () => 0, jumps: 0,
      strike: { lure: 'chase', bottom: 'nibble', float: 'nibble' },
    },
  },
  {
    id: 'gilthead',
    fight: 'dash',
    name: 'Gilthead Seabream',
    water: 'salt',
    wt: 0.0145,
    size: [20, 60],
    visual: 1.35,
    strength: 1.3,
    reel: 0.12,
    pull: 4.2,
    mouth: 2,
    colors: { back: '#55606a', body: '#c3c8cb', belly: '#f0f0ec', fin: '#7d8a94', mark: '#e0b43a' },
    sketch: { h: 0.44, tail: 0.6, pattern: 'lines' },
    where: 'Shallow sand, rock and weed in the bay, the estuary flats and the coast',
    hint: 'A deep silver fish with a gold band between its eyes grubs among the rocks and on the flats for crabs and shellfish. A peeler crab or a prawn on the bottom, and patience: it mouths a bait before it takes.',
    note: 'Deep-bodied, silver and strong, with a band of gold across its forehead and a dark blotch on its gill cover. Its jaws carry crushing teeth for crabs, mussels and shellfish. Wary, and a hard fighter for its size.',
    meal: { name: 'Gilthead baked in a salt crust', fill: 55 },
    food: { crab: 1.6, prawn: 1.25, rag: 1.0, lug: 0.8, worm: 0.7, strip: 0.5, bread: 0.15, corn: 0.15 },
    life: {
      group: [2, 5], groups: 11, spacing: 16, groupsIn: { estuary: 4, bay: 4, coast: 3 },
      speed: 0.6, burst: 2.4, turn: 2.2, perception: 9, depthTol: 1.6, cover: 'any', lineShy: 0.5,
      homes: ['flats', 'rock', 'quay', 'sand', 'weed'], zones: ['estuary', 'bay', 'coast'],
      depth: () => [0.8, 5],
      activity: ({ hour, rain = 0 }) => clamp01((isDay(hour) ? 0.9 : isTwilight(hour) ? 0.7 : 0.25) - rain * 0.1),
      likes: { still: 1.2, slow: 0.8, fast: 0.1, twitch: 0.4 },
      bite: 0.6, caution: 1.4, rises: () => 0, jumps: 0,
      strike: { bottom: 'nibble', ledger: 'nibble', float: 'nibble' },
    },
  },
  {
    id: 'sole',
    fight: 'flat',
    name: 'Common Sole',
    water: 'salt',
    wt: 0.0085,
    size: [20, 50],
    visual: 1.5,
    strength: 0.8,
    reel: 0.17,
    pull: 1.6,
    mouth: 1,
    colors: { back: '#6b5843', body: '#7b6650', belly: '#efe9dc', fin: '#6e5a45', mark: '#4e3d2c' },
    sketch: { h: 0.5, tail: 0.35, pattern: 'mottle', flat: true },
    where: 'Sand and mud in the estuary, the bay and the coast; it feeds after dark',
    hint: 'By day it lies buried in the sand with only its eyes showing. After dark it creeps over the bottom feeling for worms: a ragworm on a bottom rig, left still.',
    note: 'An oval flatfish with both eyes on its right side, brown and blotched above and white beneath, with a black tip to the pectoral fin on its eyed side. It hunts worms by touch and smell at night.',
    meal: { name: 'Sole meunière, in brown butter', fill: 40 },
    food: { rag: 1.6, lug: 1.4, worm: 1.0, prawn: 0.4, crab: 0.3, maggot: 0.3 },
    life: {
      group: [1, 1], groups: 18, spacing: 12, flat: true,
      speed: 0.28, turn: 1.3, perception: 8, depthTol: 1.0, cover: 'open', bottom: true,
      homes: ['sand', 'flats', 'channel'], zones: ['estuary', 'bay', 'coast'],
      depth: () => [1, 8],
      activity: ({ hour, night }) => clamp01(0.2 + (night ?? (isEvening(hour) ? 1 : 0)) * 0.85 + (isTwilight(hour) ? 0.25 : 0)),
      likes: { still: 1.3, slow: 0.6, fast: 0.05, twitch: 0.3 },
      bite: 0.6, caution: 1.0, rises: () => 0, jumps: 0,
      strike: { bottom: 'nibble', ledger: 'nibble', float: 'nibble' },
    },
  },
  {
    id: 'cuttlefish',
    fight: 'jet',
    name: 'Common Cuttlefish',
    creature: 'cuttlefish',
    water: 'salt',
    wt: 0.25, wtPow: 2.6,
    size: [10, 35],
    visual: 2.0,
    strength: 0.9,
    reel: 0.18,
    pull: 1.6,
    mouth: 3,
    colors: { back: '#5a4636', body: '#9a7a5c', belly: '#ebe0d0', fin: '#d8c8b0', mark: '#2a1e16' },
    sketch: { h: 0.34, tail: 0.5, pattern: 'squid' },
    where: 'Shallow sand and weed in the bay, the coves and the coast, close to the bottom',
    hint: 'A brown shape hovers just above the sand, its fins rippling, and flickers stripes across its back. A squid jig let down to the bottom and lifted gently, by day or at dusk.',
    note: 'Not a fish: a cephalopod with a broad, flat body fringed by a rippling fin, eight arms, two long tentacles it shoots out to seize prey, and W-shaped pupils. It changes colour and pattern in a moment, and squirts ink when caught.',
    meal: { name: 'Cuttlefish stewed in its own ink, with rice', fill: 45 },
    food: { egi18: 1.4, egi25: 1.4, egi30: 1.1, prawn: 0.9, strip: 0.5 },
    life: {
      group: [1, 2], groups: 10, spacing: 20, groupsIn: { bay: 3, cove: 3, coast: 3, estuary: 1 },
      speed: 0.32, burst: 2.2, turn: 2.2, perception: 8, depthTol: 1.8, cover: 'any', squid: true,
      homes: ['weed', 'sand', 'rock', 'flats'], zones: ['bay', 'cove', 'coast', 'estuary'],
      depth: () => [1, 7],
      activity: ({ hour }) => clamp01(isTwilight(hour) ? 1 : isDay(hour) ? 0.75 : 0.5),
      likes: { still: 1.1, slow: 0.8, fast: 0.1, twitch: 0.9 },
      bite: 0.7, caution: 1.0, rises: () => 0, jumps: 0,
      strike: { lure: 'chase', jig: 'chase', float: 'nibble' },
    },
  },
];
// The Atlantic roster (atlantic.js) joins the original species, then Las Brasas' own (southFish.js).
FISH.push(...ATLANTIC);
FISH.push(...SOUTH);
// The big game of the open ocean, at home and round Las Brasas (bigGame.js).
FISH.push(...BIG_GAME);
// Las Brasas' commonest reef fish, joined last of all (so no fish anywhere moves).
FISH.push(...SOUTH_REEF);
// Fish of the home coast that live round Las Brasas too, in its waters and on its homes.
for (const [id, R] of Object.entries(AT_BRASAS)) {
  const f = FISH.find((x) => x.id === id);
  if (!f) continue;
  f.life.zones = [...f.life.zones, ...R.zones];
  if (R.homes) f.life.homes = [...f.life.homes, ...R.homes];
  f.life.southGroups = R.groups;
  if (R.more) f.life.southMore = R.more;
  if (R.favour) f.life.favourSouth = R.favour;
  // (Who it hunts round the island, where the home coast's prey don't live.)
  if (R.hunter) f.life.hunterSouth = R.hunter;
  f.whereSouth = R.where;
}

// Real species take their names from the Atlantic register (register.js), so the water, the
// catch card, the journal and the field guide all call a fish the same thing.
for (const f of FISH) {
  const r = registerFor(f.id);
  if (!r) continue;
  if (r.names?.en) f.name = titleName(r.names.en);
  f.scientific = r.scientific;
}
export const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));

// Bigger fish are rarer.
export const rollSize = (f) => Math.round(lerp(f.size[0], f.size[1], Math.pow(Math.random(), 1.7)));

// About how much a fish of this length weighs (kg), from its shape: wt × length^3 grams.
export const weightOf = (f, size) => Math.max(0.01, ((f.wt ?? 0.011) * Math.pow(size, f.wtPow ?? 3)) / 1000);
export const isFish = (f) => !f.creature;

/* ---------------- 3D model ---------------- */

const _c = new THREE.Color();

// One merged, vertex-coloured fish (nose along +z, about 1 unit long) that works both
// as a single mesh and as an InstancedMesh. aGlow marks the fins that glow at night.
// Species with an anatomical recipe (anatomy.js) use it instead, near (detail) and far.
export function buildFishGeometry(f, detail = true) {
  if (hasAnatomy(f.id)) return anatomyGeometry(f.id, detail);
  if (f.creature === 'squid') return buildSquidGeometry(f);
  if (f.sketch.flat) return buildFlatGeometry(f);
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
    if (pat === 'band' && Math.abs(y - 0.05) < 0.16 && z > -0.42 && z < 0.34 && Math.sin(z * 30) > -0.3) _c.lerp(mark, 0.7);
    if (pat === 'lines' && y > -0.3 && Math.abs(Math.sin(y * 18)) < 0.25) _c.lerp(mark, 0.45);
    if (pat === 'mackerel' && y > 0.15 && Math.sin(z * 34 + Math.sin(y * 9) * 2) > 0.2) _c.lerp(mark, 0.8);
    if (pat === 'tuna' && y > -0.1 && y < 0.25 && Math.sin(z * 22) > 0.6) _c.lerp(mark, 0.35);
    for (let k = 0; k < 3; k++) push(bp.getX(i + k), bp.getY(i + k), bp.getZ(i + k), _c, 0);
  }
  bodyGeo.dispose();
  sphere.dispose();

  const g = f.sketch.glow ? 1 : 0;
  const t = f.sketch.tail * (f.sketch.forked ? 1.25 : 1);
  if (f.sketch.finlets) {
    // A row of little yellow finlets along the tail, above and below.
    for (let k = 0; k < 6; k++) {
      const z = -0.12 - k * 0.05;
      const tri2 = (y0, y1) => { for (const v of [[0, y0, z], [0, y1, z - 0.02], [0, y0, z - 0.04]]) push(v[0], v[1], v[2], fin, 0); };
      tri2(h2 * (0.55 - k * 0.07), h2 * (0.8 - k * 0.07));
      tri2(-h2 * (0.55 - k * 0.07), -h2 * (0.8 - k * 0.07));
    }
  }
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
  if (hasAnatomy(f.id)) return anatomyMaterials(f.id, instanced);
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: f.creature ? 0.55 : 0.38, metalness: f.creature ? 0.02 : 0.18, flatShading: true, side: THREE.DoubleSide,
  });
  // How it swims: a fish sways its tail; a flatfish ripples up and down; a squid trails and
  // curls its arms and flaps its fins.
  const mode = f.creature === 'squid' ? 2 : f.sketch.flat ? 1 : 0;
  const bendCode = mode === 2
    ? `float arm = smoothstep(-0.05, -0.6, position.z);
        transformed.x += sin(sw.x * 0.7 - position.z * 6.0) * arm * (0.03 + sw.y * 0.05);
        transformed.y += cos(sw.x * 0.6 - position.z * 5.0) * arm * 0.02;
        float finF = smoothstep(0.12, 0.3, abs(position.x)) * step(0.15, position.z);
        transformed.y += sin(sw.x * 1.4) * finF * 0.05;`
    : mode === 1
      ? `float bend = smoothstep(0.35, -0.5, position.z);
        transformed.y += sin(sw.x - position.z * 5.0) * bend * (0.02 + sw.y * 0.05);
        transformed.y += sin(sw.x * 1.3 + position.z * 9.0) * 0.012 * smoothstep(0.25, 0.4, abs(position.x));`
      : `float bend = smoothstep(0.3, -0.8, position.z);
        transformed.x += sin(sw.x - position.z * 4.0) * bend * (0.03 + sw.y * 0.1);`;
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
        ${bendCode}
        vGlow = aGlow;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlowColor;\nuniform float uGlow;\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowColor * vGlow * uGlow + diffuseColor.rgb * 0.16;');
  };
  m.customProgramCacheKey = () => `fish-${instanced ? 'instanced' : 'single'}-${mode}`;
  return m;
}

// A flatfish: an oval disc lying on the bottom, mottled on top and white beneath, with a fringe
// of fin all round, a fan of a tail, and both eyes on top. Nose along +z, top along +y.
function buildFlatGeometry(f) {
  const c = f.colors;
  const back = new THREE.Color(c.back), body = new THREE.Color(c.body), belly = new THREE.Color(c.belly), mark = new THREE.Color(c.mark), fin = new THREE.Color(c.fin);
  const pos = [], col = [], glow = [];
  const push = (x, y, z, color) => { pos.push(x, y, z); col.push(color.r, color.g, color.b); glow.push(0); };
  const rnd = seeded(f.id.length * 131 + f.id.charCodeAt(0));
  const W = 0.3, T = 0.055;
  const disc = new THREE.SphereGeometry(0.5, 16, 8).toNonIndexed();
  const dp = disc.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const z = dp.getZ(i);
    const k = z < 0 ? lerp(1, 0.55, smoothstep(0, -0.5, z)) : lerp(1, 0.6, smoothstep(0.2, 0.5, z));
    dp.setXYZ(i, dp.getX(i) * W * 2 * k, dp.getY(i) * T * 2, z * 0.85);
  }
  for (let i = 0; i < dp.count; i += 3) {
    const y = dp.getY(i) + dp.getY(i + 1) + dp.getY(i + 2);
    const r = rnd();
    _c.copy(y > 0 ? body : belly);
    if (y > 0) {
      _c.lerp(back, r * 0.5);
      if (f.sketch.pattern === 'orange' && r > 0.88) _c.copy(mark);
      if (f.sketch.pattern === 'mottle' && r > 0.6) _c.lerp(mark, 0.6);
    }
    for (let k = 0; k < 3; k++) push(dp.getX(i + k), dp.getY(i + k), dp.getZ(i + k), _c);
  }
  disc.dispose();
  // A thin fringe of fin all round, and the tail.
  for (let k = 0; k < 18; k++) {
    const a0 = (k / 18) * Math.PI * 2, a1 = ((k + 1) / 18) * Math.PI * 2;
    const ring = (a, out) => [Math.sin(a) * W * (out ? 1.32 : 0.95), 0, Math.cos(a) * 0.42 * (out ? 1.12 : 0.95)];
    if (Math.cos(a0) > 0.75) continue; // no fin over the head
    const A = ring(a0, false), B = ring(a1, false), C = ring(a1, true), D = ring(a0, true);
    for (const v of [A, B, C, A, C, D]) push(v[0], v[1], v[2], fin);
  }
  for (const v of [[0, 0, -0.38], [0.16, 0, -0.58], [-0.16, 0, -0.58]]) push(v[0], v[1], v[2], fin);
  // Both eyes on top, near the head.
  _c.set('#1a1512');
  const eye = new THREE.IcosahedronGeometry(0.03, 0);
  const ep = eye.attributes.position;
  for (const [ex, ez] of [[0.05, 0.28], [-0.03, 0.32]]) for (let i = 0; i < ep.count; i++) push(ep.getX(i) + ex, ep.getY(i) + T * 1.2, ep.getZ(i) + ez, _c);
  eye.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  geo.computeVertexNormals();
  return geo;
}

// A squid: a long mantle with two fins at the tip (which leads, +z), a head with big eyes, and
// eight arms and two longer tentacles trailing behind.
function buildSquidGeometry(f) {
  const c = f.colors;
  const body = new THREE.Color(c.body), back = new THREE.Color(c.back), mark = new THREE.Color(c.mark), fin = new THREE.Color(c.fin), belly = new THREE.Color(c.belly);
  const pos = [], col = [], glow = [];
  const push = (x, y, z, color) => { pos.push(x, y, z); col.push(color.r, color.g, color.b); glow.push(0); };
  const rnd = seeded(77);
  const addGeo = (geo, colorFn) => {
    const g = geo.toNonIndexed(), p = g.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const cc = colorFn(p.getX(i), p.getY(i), p.getZ(i));
      for (let k = 0; k < 3; k++) push(p.getX(i + k), p.getY(i + k), p.getZ(i + k), cc);
    }
    g.dispose();
    geo.dispose();
  };
  const mantle = new THREE.CylinderGeometry(0.03, 0.1, 0.62, 10, 4).rotateX(Math.PI / 2).translate(0, 0, 0.19);
  addGeo(mantle, (x, y) => _c.copy(belly).lerp(body, smoothstep(-0.08, 0.02, y)).lerp(back, smoothstep(0.02, 0.1, y) * 0.7).lerp(mark, rnd() > 0.82 ? 0.7 : 0));
  // Fins at the tip: a diamond either side.
  for (const sx of [1, -1]) {
    for (const v of [[0, 0, 0.5], [sx * 0.17, 0, 0.36], [0, 0, 0.26]]) push(v[0], v[1], v[2], fin);
  }
  addGeo(new THREE.SphereGeometry(0.075, 8, 6).translate(0, 0, -0.13), () => _c.copy(body).lerp(back, 0.3));
  _c.set('#141018');
  addGeo(new THREE.SphereGeometry(0.03, 6, 4).translate(0.06, 0.02, -0.12), () => _c.set('#141018'));
  addGeo(new THREE.SphereGeometry(0.03, 6, 4).translate(-0.06, 0.02, -0.12), () => _c.set('#141018'));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const long = k === 2 || k === 7;
    const len = long ? 0.42 : 0.24;
    const arm = new THREE.ConeGeometry(0.016, len, 4).rotateX(-Math.PI / 2).translate(Math.cos(a) * 0.035, Math.sin(a) * 0.035, -0.2 - len / 2);
    addGeo(arm, () => _c.copy(body).lerp(mark, 0.25));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  geo.computeVertexNormals();
  return geo;
}

// A single fish, used while one is hooked, landed and held up for a look.
export function buildFishMesh(f) {
  const mesh = new THREE.Mesh(buildFishGeometry(f), fishMaterial(f, false));
  mesh.castShadow = true;
  mesh.visible = false;
  mesh.userData.swim = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).userData.swim.value;
  return mesh;
}

/* ---------------- journal sketch ---------------- */

const INK = '#3a2e26';

function sketchUnknown(ctx, shapes, outline, L, H) {
  ctx.fillStyle = 'rgba(58, 46, 38, 0.1)';
  for (const p of shapes) ctx.fill(p);
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = 'rgba(58, 46, 38, 0.45)';
  ctx.lineWidth = 1.4;
  for (const p of outline) ctx.stroke(p);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(58, 46, 38, 0.55)';
  ctx.font = `700 ${Math.round(Math.max(H, L * 0.2) * 0.75)}px Caveat, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, 0);
}

function inked(ctx, paths, L) {
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.2, L * 0.008);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of paths) ctx.stroke(p);
  ctx.globalAlpha = 0.28;
  ctx.save();
  ctx.translate(L * 0.004, -L * 0.003);
  for (const p of paths) ctx.stroke(p);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// A squid, seen from above: mantle and fins to the right, arms trailing left.
function drawSquidSketch(ctx, f, cx, cy, len, unknown) {
  const L = len, c = f.colors;
  ctx.save();
  ctx.translate(cx, cy);
  const mantle = new Path2D();
  mantle.moveTo(L * 0.48, 0);
  mantle.quadraticCurveTo(L * 0.4, -L * 0.09, -L * 0.02, -L * 0.075);
  mantle.lineTo(-L * 0.02, L * 0.075);
  mantle.quadraticCurveTo(L * 0.4, L * 0.09, L * 0.48, 0);
  const fins = new Path2D();
  fins.moveTo(L * 0.48, 0);
  fins.quadraticCurveTo(L * 0.36, -L * 0.2, L * 0.24, -L * 0.07);
  fins.moveTo(L * 0.48, 0);
  fins.quadraticCurveTo(L * 0.36, L * 0.2, L * 0.24, L * 0.07);
  fins.lineTo(L * 0.24, -L * 0.07);
  fins.closePath();
  const head = new Path2D();
  head.ellipse(-L * 0.07, 0, L * 0.06, L * 0.055, 0, 0, Math.PI * 2);
  const arms = new Path2D();
  const rnd = seeded(5);
  for (let k = 0; k < 10; k++) {
    const long = k === 3 || k === 6;
    const y0 = (k - 4.5) * L * 0.012, len2 = long ? L * 0.42 : L * 0.24;
    arms.moveTo(-L * 0.12, y0);
    arms.bezierCurveTo(-L * 0.12 - len2 * 0.4, y0 + (rnd() - 0.5) * L * 0.05, -L * 0.12 - len2 * 0.7, y0 * 1.6 + (rnd() - 0.5) * L * 0.06, -L * 0.12 - len2, y0 * 2 + (rnd() - 0.5) * L * 0.05);
  }
  if (unknown) {
    sketchUnknown(ctx, [mantle, fins, head], [mantle, fins], L, L * 0.15);
    ctx.restore();
    return;
  }
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = c.fin;
  ctx.fill(fins);
  ctx.strokeStyle = c.body;
  ctx.lineWidth = Math.max(1.5, L * 0.01);
  ctx.stroke(arms);
  const g = ctx.createLinearGradient(0, -L * 0.08, 0, L * 0.08);
  g.addColorStop(0, c.back);
  g.addColorStop(0.5, c.body);
  g.addColorStop(1, c.back);
  ctx.fillStyle = g;
  ctx.fill(mantle);
  ctx.fill(head);
  // Chromatophores: little dots of colour that come and go.
  ctx.save();
  ctx.clip(mantle);
  ctx.fillStyle = c.mark;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc(L * (0.46 - rnd() * 0.48), L * (rnd() - 0.5) * 0.15, L * (0.004 + rnd() * 0.006), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  inked(ctx, [mantle, fins, head], L);
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1, L * 0.005);
  ctx.stroke(arms);
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK;
  for (const sy of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(-L * 0.08, sy * L * 0.035, L * 0.014, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// A flatfish from above: an oval with a fringe of fin, a fan of a tail, both eyes on top.
function drawFlatSketch(ctx, f, cx, cy, len, unknown) {
  const L = len, c = f.colors, W = L * 0.32;
  ctx.save();
  ctx.translate(cx, cy);
  const body = new Path2D();
  body.ellipse(L * 0.05, 0, L * 0.4, W, 0, 0, Math.PI * 2);
  const fringe = new Path2D();
  fringe.ellipse(L * 0.04, 0, L * 0.45, W * 1.22, 0, 0, Math.PI * 2);
  const tail = new Path2D();
  tail.moveTo(-L * 0.33, 0);
  tail.lineTo(-L * 0.5, -W * 0.45);
  tail.quadraticCurveTo(-L * 0.46, 0, -L * 0.5, W * 0.45);
  tail.closePath();
  if (unknown) {
    sketchUnknown(ctx, [fringe, tail, body], [fringe, body], L, W);
    ctx.restore();
    return;
  }
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = c.fin;
  ctx.fill(fringe);
  ctx.fill(tail);
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.body;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  const rnd = seeded(f.id.charCodeAt(0));
  for (let i = 0; i < 36; i++) {
    ctx.globalAlpha = f.sketch.pattern === 'orange' ? 0.95 : 0.45;
    ctx.fillStyle = f.sketch.pattern === 'orange' ? c.mark : c.back;
    ctx.beginPath();
    ctx.arc(L * (0.42 - rnd() * 0.8), W * (rnd() * 2 - 1) * 0.85, L * (f.sketch.pattern === 'orange' ? 0.016 : 0.012 + rnd() * 0.02), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  inked(ctx, [fringe, body, tail], L);
  ctx.fillStyle = INK;
  for (const [ex, ey] of [[0.3, -0.18], [0.34, 0.02]]) {
    ctx.beginPath();
    ctx.arc(L * ex, W * ey, L * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFishSketch(ctx, f, cx, cy, len, { unknown = false } = {}) {
  if (f.creature === 'squid') return drawSquidSketch(ctx, f, cx, cy, len, unknown);
  if (f.sketch.flat) return drawFlatSketch(ctx, f, cx, cy, len, unknown);
  const L = len, H = len * f.sketch.h, c = f.colors, t = f.sketch.tail * (f.sketch.forked ? 1.3 : 1);
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
  tail.quadraticCurveTo(f.sketch.forked ? -L * 0.36 : -L * 0.42, 0, -L * 0.5, H * (0.55 * t + 0.1));
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
  } else if (f.sketch.pattern === 'band') {
    // A dark, broken stripe along the side (largemouth bass).
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.ellipse(L * (0.3 - i * 0.07), -H * 0.02, L * 0.04, H * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.sketch.pattern === 'lines') {
    // Fine grey lines along the flanks (mullet).
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = Math.max(1, H * 0.03);
    ctx.strokeStyle = c.mark;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.3, -H * 0.3 + i * H * 0.12);
      ctx.lineTo(L * 0.42, -H * 0.3 + i * H * 0.12);
      ctx.stroke();
    }
  } else if (f.sketch.pattern === 'mackerel') {
    // Wavy dark tiger stripes over a blue-green back.
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1.2, L * 0.012);
    ctx.strokeStyle = c.mark;
    for (let i = 0; i < 12; i++) {
      const x = L * (0.3 - i * 0.055);
      ctx.beginPath();
      ctx.moveTo(x, -H * 0.5);
      ctx.quadraticCurveTo(x - L * 0.03, -H * 0.3, x + L * 0.01, -H * 0.08);
      ctx.stroke();
    }
  } else if (f.sketch.pattern === 'tuna') {
    // Dark steel back, a faint pale band, silver below.
    ctx.globalAlpha = 0.5;
    ctx.fillRect(-L * 0.3, -H * 0.08, L * 0.72, H * 0.08);
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

  if (f.sketch.finlets) {
    ctx.fillStyle = c.fin;
    ctx.globalAlpha = 0.95;
    for (let k = 0; k < 6; k++) {
      const x = -L * (0.1 + k * 0.03);
      for (const sy of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, sy * H * (0.38 - k * 0.04));
        ctx.lineTo(x - L * 0.012, sy * H * (0.5 - k * 0.04));
        ctx.lineTo(x - L * 0.024, sy * H * (0.36 - k * 0.04));
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(L * 0.14, 0, H * 0.4, -0.75, 0.75);
  ctx.stroke();
  if (f.sketch.bigMouth) {
    ctx.beginPath();
    ctx.moveTo(L * 0.5, H * 0.04);
    ctx.lineTo(L * 0.34, H * 0.08);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(L * 0.5, H * 0.02);
  ctx.lineTo(L * 0.44, H * 0.05);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (f.sketch.redEye) {
    ctx.fillStyle = '#c2412e';
    ctx.beginPath();
    ctx.arc(L * 0.36, -H * 0.1, Math.max(3, H * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
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
