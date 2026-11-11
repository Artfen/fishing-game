import { isDay, isTwilight } from './habits.js';

// The coast's small fish, for micro-fishing: a size 18 hook and a scrap of worm under a micro
// float on the harbour wall, a 1 g jig bumped along the rocks, a worm in the stream for minnows.
// Real species of the coast and its streams, in the habitats they really keep to, at their real
// sizes (see the register entries in research/register/batch-f.json and register.js; the minnow is
// a fresh water fish, in FRESHWATER there). Same fields as the species in fish.js; fish.js appends
// these to FISH, last of all, so nothing already in the water moves.
//
// They live only on the homes laid out for them (habitat.js smallFishSpots: harbour walls, the
// shallow rocks round the reef, the Calf and the cove, the estuary's eelgrass, the stream pools),
// added after every other fish, so every fish already in the game keeps its place and its id.
//
// Extra life flags used here:
//  micro – a small fish: it takes a tiny bait best, and a big hook barely hooks it (ecosystem.js
//          appeal); the field guide sends you to the micro float rod or a micro jig for it
//  lift  – sits on the bottom (benthic) but rises off it to take a bait just above
//
// None of them is kept for the pot: no one eats them, and they go back where they were caught
// (released, they swim straight back to their crevice). Each one is a new name for the journal,
// and a close look at a fish most people never see.

const dayFish = ({ hour }) => (isDay(hour) ? 1 : isTwilight(hour) ? 0.6 : 0.15);
const back = 'Too small to eat and too good to waste: it goes back, and darts straight into its crevice.';

export const SMALL = [
  /* ---------------- rocky shores and harbour walls ---------------- */
  {
    id: 'rockgoby',
    fight: 'dogged',
    name: 'Rock Goby',
    water: 'salt',
    wt: 0.012,
    size: [6, 13],
    visual: 3.1,
    strength: 0.35,
    reel: 0.35,
    pull: 0.12,
    mouth: 1,
    colors: { back: '#3e3424', body: '#6e5c3e', belly: '#c9b48a', fin: '#5a4a30', mark: '#e8c86a' },
    sketch: { h: 0.3, tail: 0.6, pattern: 'mottle', bigMouth: true },
    where: 'Harbour walls and the shallow rocks: under stones and weed at the foot of the Willowhaven quay, round the Skerries and the Calf',
    hint: 'At the foot of a weedy wall or among the stones, a big-headed little fish perches on the rock, watching. A scrap of worm on a tiny hook, let down to the bottom beside the wall.',
    note: 'Big head, thick lips and bulging eyes set high; dark mottled brown, with a pale cream or orange band along the top of the first dorsal fin. Its pelvic fins are joined into a sucker for clinging to rock. Males guard eggs under stones in spring.',
    keep: back,
    food: { wormpiece: 1.5, microjig: 0.9, rag: 0.7, maggot: 0.6, worm: 0.5, prawn: 0.3 },
    life: {
      group: [2, 4], groups: 0, spacing: 6, micro: true,
      speed: 0.3, turn: 3.2, perception: 2.6, depthTol: 1.4, cover: 'rock', benthic: true, lift: true,
      homes: ['quay', 'rock', 'reef'], zones: ['bay', 'cove', 'coast', 'estuary'],
      depth: () => [0.5, 5],
      activity: dayFish,
      likes: { still: 1.2, slow: 0.8, fast: 0.05, twitch: 0.7 },
      bite: 0.85, caution: 0.6, rises: () => 0, jumps: 0,
      strike: { float: 'nibble', lure: 'chase' },
    },
  },
  {
    id: 'shanny',
    fight: 'dogged',
    name: 'Shanny',
    water: 'salt',
    wt: 0.011,
    size: [6, 16],
    visual: 3.0,
    strength: 0.35,
    reel: 0.35,
    pull: 0.14,
    mouth: 1,
    colors: { back: '#4a4a2e', body: '#7a7448', belly: '#c8be8e', fin: '#6a6440', mark: '#2a2a1a' },
    sketch: { h: 0.26, tail: 0.6, pattern: 'mottle', bigMouth: true },
    where: 'Harbour walls and the shallow rocks: in the cracks of the Willowhaven quay and Wend Quay, and the weedy stones round the reefs',
    hint: 'A slimy little fish with a round head peers out of a crack in the wall. It can’t resist a scrap of worm or ragworm dangled right at its door.',
    note: 'A blenny: smooth, scaleless and slimy, with a blunt rounded head and no tentacles on it. One long dorsal fin, notched in the middle, with a dark spot at the front. Mottled olive and brown. It can breathe air and waits out low tide in a damp crevice; in summer the males guard eggs in a hole.',
    keep: back,
    food: { wormpiece: 1.4, microjig: 0.8, rag: 0.8, maggot: 0.5, worm: 0.5, prawn: 0.4, bread: 0.3 },
    life: {
      group: [2, 3], groups: 0, spacing: 6, micro: true,
      speed: 0.28, turn: 3.4, perception: 2.2, depthTol: 1.4, cover: 'rock', benthic: true, lift: true,
      homes: ['quay', 'rock', 'reef'], zones: ['bay', 'cove', 'coast', 'estuary'],
      depth: () => [0.3, 4],
      activity: dayFish,
      likes: { still: 1.2, slow: 0.7, fast: 0.05, twitch: 0.8 },
      bite: 0.9, caution: 0.5, rises: () => 0, jumps: 0,
      strike: { float: 'nibble', lure: 'chase' },
    },
  },
  {
    id: 'corkwing',
    fight: 'dogged',
    name: 'Corkwing Wrasse',
    water: 'salt',
    wt: 0.015,
    size: [9, 25],
    visual: 2.4,
    strength: 0.6,
    reel: 0.3,
    pull: 0.4,
    mouth: 1,
    colors: { back: '#3a5a3a', body: '#7a8a52', belly: '#d8c08a', fin: '#5a7a4a', mark: '#1e2a1a' },
    sketch: { h: 0.4, tail: 0.55, pattern: 'specks', lips: true },
    where: 'Weedy rocks in the shallows: the Willowhaven quay, the Skerries, the Calf and the cove’s rocks',
    hint: 'Small, deep-bodied wrasse pick over the weed on the rocks and along the quay. A worm piece or a scrap of ragworm by the weed; a micro jig works too.',
    note: 'A small wrasse with a dark comma-shaped mark just behind the eye and a dark spot on the wrist of the tail. Females brown; breeding males green and blue with bright lines on the head. In spring the males build nests of seaweed in the crevices, and guard the eggs.',
    keep: 'It goes back: a nest-building wrasse of the inshore rocks, worth more to the reef than to the pan.',
    food: { wormpiece: 1.4, rag: 1.0, microjig: 1.1, prawn: 0.8, crab: 0.6, worm: 0.6, maggot: 0.4 },
    life: {
      group: [1, 3], groups: 0, spacing: 8, micro: true,
      speed: 0.4, turn: 2.6, perception: 3.5, depthTol: 1.6, cover: 'rock',
      homes: ['quay', 'rock', 'reef'], zones: ['bay', 'cove', 'coast'],
      depth: () => [1, 6],
      activity: dayFish,
      likes: { still: 1, slow: 0.9, fast: 0.15, twitch: 0.8 },
      bite: 0.8, caution: 0.8, rises: () => 0, jumps: 0,
      strike: { float: 'nibble', lure: 'chase' },
    },
  },
  /* ---------------- the estuary's eelgrass ---------------- */
  {
    id: 'blackgoby',
    fight: 'dogged',
    name: 'Black Goby',
    water: 'salt',
    wt: 0.011,
    size: [6, 16],
    visual: 3.0,
    strength: 0.35,
    reel: 0.35,
    pull: 0.13,
    mouth: 1,
    colors: { back: '#2a2a22', body: '#4e4a3a', belly: '#9e967a', fin: '#38362a', mark: '#141410' },
    sketch: { h: 0.28, tail: 0.6, pattern: 'mottle', bigMouth: true },
    where: 'The estuary: on the sand and mud among the eelgrass, and along the foot of Wend Quay',
    hint: 'Dark little gobies sit on the muddy sand among the estuary’s eelgrass. A scrap of worm on the bottom, on a tiny hook.',
    note: 'A dark goby, brown to almost black, with a black spot at the top front of the first dorsal fin; the males’ dorsal fin rays grow long. It lives in estuaries and lagoons, over sand and mud among eelgrass and weed, and tolerates brackish water.',
    keep: back,
    food: { wormpiece: 1.5, rag: 0.8, maggot: 0.5, worm: 0.6, microjig: 0.7, lug: 0.4 },
    life: {
      group: [2, 4], groups: 0, spacing: 8, micro: true,
      speed: 0.28, turn: 3.2, perception: 2.6, depthTol: 1.4, cover: 'weed', benthic: true, lift: true,
      homes: ['weed', 'quay', 'flats'], zones: ['estuary'],
      depth: () => [0.6, 4],
      activity: dayFish,
      likes: { still: 1.2, slow: 0.8, fast: 0.05, twitch: 0.6 },
      bite: 0.85, caution: 0.6, rises: () => 0, jumps: 0,
      strike: { float: 'nibble', lure: 'chase' },
    },
  },
  /* ---------------- clear streams ---------------- */
  {
    id: 'minnow',
    fight: 'dash',
    name: 'Minnow',
    water: 'fresh',
    wt: 0.009,
    size: [4, 12],
    visual: 3.6,
    strength: 0.2,
    reel: 0.4,
    pull: 0.05,
    mouth: 1,
    colors: { back: '#4a5a42', body: '#9aa078', belly: '#e6dcc0', fin: '#a8a080', mark: '#3a4030' },
    sketch: { h: 0.22, tail: 0.65, pattern: 'bars' },
    where: 'The clear streams: shoals in the pools of the Fernbeck and the Coldwater’s dale, with the trout',
    hint: 'Shoals of tiny fish hang in the clear pools, all facing upstream. A maggot or a scrap of worm under a micro float, trotted down to them.',
    note: 'A tiny shoaling fish of cold, clear, well-oxygenated streams, often with trout. A row of dark blotches along its side over a golden line; in spring the males flush red underneath with a black throat. Prey for trout, perch, kingfishers and herons.',
    keep: 'It goes back to its shoal: a minnow is food for the trout and the kingfisher, not the pan.',
    food: { maggot: 1.5, wormpiece: 1.4, bread: 0.9, worm: 0.4 },
    life: {
      school: true, schools: 0, members: [10, 18], spacing: 6, micro: true, midwater: true,
      speed: 0.7, turn: 3.6, perception: 2.6, depthTol: 1.0, cover: 'rock',
      homes: ['pool'], zones: ['stream', 'river'],
      depth: () => [0.15, 0.8],
      activity: dayFish,
      likes: { still: 1, slow: 1, fast: 0.2, twitch: 0.5 },
      bite: 0.9, caution: 0.5, rises: () => 0.1, jumps: 0,
      strike: { float: 'nibble' },
    },
  },
];
