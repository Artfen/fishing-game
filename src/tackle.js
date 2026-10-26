import { clamp, smoothstep } from './util.js';

// Rods, reels and line, the terminal tackle at the end (floats, leads, leaders and tippets),
// and what goes on the hook. A rod decides HOW you fish (its "kind"); the line, leader or rig
// and the bait, lure, fly or jig decide what the fish see and what you can land.
// Fish species list how much they like each item (see fish.js `food`).
//
// A setup is: rod (with its reel) + line + terminal (rig or leader) + item. checkSetup()
// says before you cast whether it works and why not.

// kind: float  – a bait hanging under a float at the depth you choose
//       lure   – a lure you reel back, twitch and pause
//       ledger – a carp rig on the bottom, on a bite alarm; self-hooking
//       bottom – a sea rig on the bottom; watch the rod tip and strike
//       fly    – a fly that drifts or is stripped back
//       jig    – a squid jig: let it sink, lift it, pause
// thick: how visible the line is to a wary fish (0 invisible … 1 obvious).
// flex: how stiff the rod is (a soft one, under 1, bends further and cushions a running fish's
// surges, but tires it more slowly; a stiff one, over 1, the other way: see fight.js).
export const RODS = {
  float: {
    id: 'float', name: 'Willow float rod', short: 'Float rod', kind: 'float', accepts: ['bait'],
    length: '3.6 m', reel: 'small fixed-spool reel',
    cast: [3, 26], weight: [2, 12], power: 1.0, finesse: 0.8, flex: 0.75, drag: 1, build: 1.3,
    lines: [
      { id: 'm4', name: '4 lb mono', kg: 1.8, thick: 0.35 },
      { id: 'm6', name: '6 lb mono', kg: 2.7, thick: 0.45 },
      { id: 'm8', name: '8 lb mono', kg: 3.6, thick: 0.55 },
    ],
    terms: ['stick', 'waggler', 'margin'],
    strengths: 'Hangs a bait at any depth under a float, and shows every nibble. Roach, rudd, tench and perch; carp in the margins on 8 lb.',
    limits: 'On 4 lb line a big carp or pike can run it into the weed. Keep the drag light and be patient.',
    look: { len: 3.4, color: '#8a5a34', handle: '#d7b98a', reel: 'spin' },
  },
  trout: {
    id: 'trout', name: 'Light spinning rod', short: 'Light rod', kind: 'lure', accepts: ['lure'],
    length: '1.8 m, ultralight', reel: 'small fixed-spool reel',
    cast: [5, 28], weight: [2, 8], power: 0.9, finesse: 0.85, flex: 0.8, drag: 1, build: 1.2,
    lines: [
      { id: 'f4', name: '4 lb fluorocarbon', kg: 1.8, thick: 0.25 },
      { id: 'm6', name: '6 lb mono', kg: 2.7, thick: 0.45 },
    ],
    terms: ['none'],
    strengths: 'Flicks tiny spinners, spoons and plugs a long way on fine line that wary trout don’t notice. Lovely for perch, too.',
    limits: 'No wire trace, so pike bite straight through it. Heavy lures overload it, and a big carp is far too much.',
    look: { len: 1.8, color: '#5f7350', handle: '#d7b98a', reel: 'spin' },
  },
  spin: {
    id: 'spin', name: 'Spinning rod', short: 'Spinning rod', kind: 'lure', accepts: ['lure'],
    length: '2.4 m, medium', reel: 'medium fixed-spool reel',
    cast: [8, 40], weight: [7, 30], power: 1.15, finesse: 0.55, flex: 1.0, drag: 2, build: 1.4,
    lines: [
      { id: 'b10', name: '10 lb braid', kg: 4.5, thick: 0.55 },
      { id: 'b20', name: '20 lb braid', kg: 9, thick: 0.62 },
    ],
    terms: ['wire', 'fluoro', 'none'],
    strengths: 'Casts lures a long way and works them with life: pike, perch, largemouth bass, and sea bass from the shore.',
    limits: 'Braid is easy for wary fish to see: a fluorocarbon leader hides it. Pike need the wire trace.',
    look: { len: 2.35, color: '#2f3640', handle: '#c9a87a', reel: 'spin' },
  },
  carp: {
    id: 'carp', name: 'Carp rod', short: 'Carp rod', kind: 'ledger', accepts: ['bait'],
    length: '3.6 m, 2¾ lb test curve', reel: 'big-pit reel with a free-spool',
    cast: [10, 50], weight: [40, 120], power: 1.35, finesse: 0.35, flex: 1.05, drag: 2, build: 1.6,
    lines: [
      { id: 'm12', name: '12 lb mono', kg: 5.4, thick: 0.75 },
      { id: 'm15', name: '15 lb mono', kg: 6.8, thick: 0.85 },
    ],
    terms: ['hair', 'method'],
    strengths: 'Lays a self-hooking bait on the bottom far out and sits on a bite alarm while you wait. Lands big carp and tench.',
    limits: 'No good for lures, and the lead lands with a splash that spooks nearby fish.',
    look: { len: 3.4, color: '#2e4a3a', handle: '#2b2b2b', reel: 'big' },
  },
  fly: {
    id: 'fly', name: 'Fly rod', short: 'Fly rod', kind: 'fly', accepts: ['fly'],
    length: '2.7 m, #5', reel: 'fly reel with floating line',
    cast: [5, 20], weight: [0, 1], power: 0.85, finesse: 1.0, flex: 0.6, drag: 1, build: 1.2,
    lines: [
      { id: 't3', name: 'floating line, 3 lb tippet', kg: 1.4, thick: 0.22 },
      { id: 't5', name: 'floating line, 5 lb tippet', kg: 2.3, thick: 0.32 },
    ],
    terms: ['tippet'],
    strengths: 'Lays a weightless fly down without a splash. Made for wary trout and grayling; a streamer for perch and bass.',
    limits: 'Short range, and the fine tippet needs a gentle hand with a big fish.',
    look: { len: 2.7, color: '#9a7040', handle: '#d7b98a', reel: 'fly' },
  },
  sea: {
    id: 'sea', name: 'Coastal spinning rod', short: 'Coastal rod', kind: 'lure', accepts: ['lure'],
    length: '2.9 m, 15–50 g', reel: 'saltwater fixed-spool reel',
    cast: [12, 60], weight: [12, 50], power: 1.25, finesse: 0.6, flex: 1.15, drag: 2, build: 1.5,
    lines: [
      { id: 'b20', name: '20 lb braid', kg: 9, thick: 0.6 },
      { id: 'b30', name: '30 lb braid', kg: 13.6, thick: 0.7 },
    ],
    terms: ['fluoro', 'wire', 'none'],
    strengths: 'Long casts from rocks, beaches and boats: metals for mackerel and bonito, soft sandeels and surface plugs for sea bass, sabiki feathers for the small shoaling fish, and a wire trace for toothy bluefish.',
    limits: 'Too strong for small lures and freshwater finesse. Not built for big tuna.',
    look: { len: 2.8, color: '#3b4f63', handle: '#2b2b2b', reel: 'spin' },
  },
  boat: {
    id: 'boat', name: 'Boat & bottom rod', short: 'Bottom rod', kind: 'bottom', accepts: ['bait'],
    length: '2.1 m, 6–12 oz', reel: 'small multiplier reel',
    cast: [4, 34], weight: [50, 200], power: 1.3, finesse: 0.4, flex: 1.25, drag: 2, build: 1.4,
    lines: [
      { id: 'm20', name: '20 lb mono', kg: 9, thick: 0.75 },
    ],
    terms: ['flapper', 'running'],
    strengths: 'Holds a bait on the seabed in the tide. Flounder, plaice, wrasse and bass. Watch the rod tip and strike when it pulls round.',
    limits: 'No good for lures or still water; the heavy lead doesn’t cast far.',
    look: { len: 2.1, color: '#4a2f3f', handle: '#2b2b2b', reel: 'big' },
  },
  squid: {
    id: 'squid', name: 'Squid rod (egi)', short: 'Squid rod', kind: 'jig', accepts: ['jig'],
    length: '2.5 m, egi 1.8–3.5', reel: 'light fixed-spool reel',
    cast: [8, 42], weight: [5, 22], power: 0.95, finesse: 0.85, flex: 0.9, drag: 1, build: 1.3,
    lines: [
      { id: 'pe08', name: 'PE 0.8 braid, 10 lb fluoro leader', kg: 4.5, thick: 0.3 },
    ],
    terms: ['fluoro'],
    strengths: 'A soft tip that feels a squid’s weight on a sinking jig, and a stiff butt to lift the jig in sharp darts.',
    limits: 'Only for squid jigs. Light line: play a big fish gently.',
    look: { len: 2.5, color: '#6a3a6e', handle: '#d7b98a', reel: 'spin' },
  },
  offshore: {
    id: 'offshore', name: 'Offshore rod', short: 'Offshore rod', kind: 'lure', accepts: ['lure'],
    length: '2.3 m, PE 6', reel: 'big saltwater spinning reel',
    cast: [15, 70], weight: [40, 160], power: 1.8, finesse: 0.45, flex: 1.4, drag: 2, build: 1.8,
    lines: [
      { id: 'pe6', name: '80 lb braid, 100 lb leader', kg: 36, thick: 0.85 },
    ],
    terms: ['shock'],
    strengths: 'For tuna boiling on the surface offshore: big stickbaits, poppers and metal jigs, and the backbone to stop a fish that runs a hundred metres.',
    limits: 'Heavy: no good for small fish or light lures, and tiring to cast all day.',
    look: { len: 2.3, color: '#22323f', handle: '#1e1e1e', reel: 'big' },
  },
  // Trolled from a moving boat for the big ocean fish: let the lure out a little way astern and
  // the boat does the rest. chair: on the yacht you fight a fish on it from the fighting chair.
  biggame: {
    id: 'biggame', name: 'Big-game trolling rod', short: 'Big-game rod', kind: 'lure', accepts: ['lure'],
    length: '1.7 m stand-up, 50–80 lb class', reel: 'big two-speed lever-drag multiplier reel',
    cast: [6, 32], weight: [90, 400], power: 2.3, finesse: 0.3, flex: 1.6, drag: 2, build: 2.0,
    lines: [
      { id: 'm50', name: '50 lb mono, 200 lb wind-on leader', kg: 23, thick: 1.0 },
      { id: 'm80', name: '80 lb mono, 300 lb wind-on leader', kg: 36, thick: 1.1 },
    ],
    terms: ['windon', 'wire'],
    chair: true,
    strengths: 'Trolled behind a moving boat for the big fish of the open ocean: skirted lures fast for marlin, wahoo, dorado and tuna, a rigged ballyhoo slower for sailfish, spearfish and sharks (on a wire trace: their teeth cut anything else). On the yacht you fight from the fighting chair.',
    limits: 'For trolling, not casting: let the lure out astern and troll at six or seven knots (the yacht and the centre console have a trolling notch). Far too heavy for anything small.',
    look: { len: 1.75, color: '#1d2a3a', handle: '#e2ddd0', reel: 'big' },
  },
};

// What goes between the line and the hook: a float rig, a bottom rig, a leader or a tippet.
// weight: grams it adds to the cast. selfHook: the fish hooks itself (a carp rig).
export const TERMS = {
  stick: { id: 'stick', name: 'Stick float, size 16 hook', short: 'Stick float', weight: 2, sensitive: 1.25, hook: 16,
    desc: 'A slim float that shows the shyest bite. Light: short casts. Small hooks suit maggots and bread.' },
  waggler: { id: 'waggler', name: 'Waggler, size 12 hook', short: 'Waggler', weight: 5, sensitive: 1, hook: 12,
    desc: 'The all-round float: casts further and rides a ripple. Worms, sweetcorn, prawns.' },
  margin: { id: 'margin', name: 'Margin float, size 8 hook', short: 'Margin float', weight: 7, sensitive: 0.85, hook: 8, strong: true,
    desc: 'A stubby float and a strong hook for carp and tench close in. Big baits.' },
  hair: { id: 'hair', name: 'Hair rig, 3 oz lead', short: 'Hair rig', weight: 85, selfHook: true,
    desc: 'The bait hangs off the hook on a hair; a carp that picks it up bolts against the lead and hooks itself.' },
  method: { id: 'method', name: 'Method feeder, 45 g', short: 'Method feeder', weight: 50, selfHook: true, feeder: true,
    desc: 'A self-hooking rig wrapped in groundbait that breaks down around the hook: carp and tench home in on it.' },
  flapper: { id: 'flapper', name: 'Flapper rig, 5 oz lead', short: 'Flapper rig', weight: 140,
    desc: 'Two short hook snoods above a lead, lying on the sand: flounder and plaice.' },
  running: { id: 'running', name: 'Running ledger, 3 oz', short: 'Running ledger', weight: 85,
    desc: 'One long trace that lets a bait waft along the seabed: wrasse by the rocks, bass in the surf.' },
  wire: { id: 'wire', name: 'Wire trace', short: 'Wire trace', weight: 1, trace: true,
    desc: 'Bite-proof: pike can’t cut it. Wary fish do notice it.' },
  fluoro: { id: 'fluoro', name: 'Fluorocarbon leader', short: 'Fluoro leader', weight: 0, hides: 0.25,
    desc: 'A near-invisible length of line before the lure: wary bass, trout and mullet don’t see the braid.' },
  none: { id: 'none', name: 'Straight through', short: 'No leader', weight: 0,
    desc: 'The main line tied straight to the lure.' },
  tippet: { id: 'tippet', name: 'Tapered leader and tippet', short: 'Tippet', weight: 0,
    desc: 'The leader turns the fly over so it lands softly.' },
  shock: { id: 'shock', name: '100 lb shock leader', short: 'Shock leader', weight: 0,
    desc: 'Thick enough to survive a tuna’s first run and its sandpaper mouth.' },
  windon: { id: 'windon', name: '200 lb wind-on leader', short: 'Wind-on leader', weight: 0,
    desc: 'A long, heavy leader spliced to the main line, so it winds onto the reel at the end of a fight: a marlin’s bill and sandpaper jaw can’t chafe through it.' },
};

// type: bait | lure | fly | jig. size: 0.5 tiny, 1 small … 4 huge (what a fish's mouth can manage).
// weight: grams (for a bait, without the rig).
export const TACKLE = {
  // --- natural baits ---
  worm: { id: 'worm', on: 'a worm', type: 'bait', name: 'Garden worms', short: 'Worm', size: 1, weight: 3, water: 'both',
    desc: 'Almost anything with fins will try a worm.' },
  maggot: { id: 'maggot', on: 'maggots', type: 'bait', name: 'Maggots', short: 'Maggots', size: 1, weight: 1, water: 'fresh',
    desc: 'A wriggling bunch on a small hook: roach, rudd, perch and grayling can’t resist them.' },
  corn: { id: 'corn', on: 'sweetcorn', type: 'bait', name: 'Sweetcorn', short: 'Sweetcorn', size: 1, weight: 2, water: 'fresh',
    desc: 'Small, bright and sweet. Carp, tench and rudd find it hard to resist.' },
  bread: { id: 'bread', on: 'bread flake', type: 'bait', name: 'Bread flake', short: 'Bread', size: 1, weight: 1, water: 'both',
    desc: 'Soft and light. Rudd and roach near the top, and grey mullet in harbours.' },
  boilie: { id: 'boilie', on: 'a boilie', type: 'bait', name: 'Boilies', short: 'Boilie', size: 2, weight: 4, water: 'fresh',
    desc: 'Hard, round carp baits. Small fish can’t manage them, so they wait for something big.' },
  prawn: { id: 'prawn', on: 'a prawn', type: 'bait', name: 'Prawns', short: 'Prawn', size: 2, weight: 4, water: 'salt',
    desc: 'Salty and strong-smelling. Sea fish of every size love them, and perch take them too.' },
  rag: { id: 'rag', on: 'ragworm', type: 'bait', name: 'Ragworm', short: 'Ragworm', size: 1, weight: 4, water: 'salt',
    desc: 'Wriggly and juicy: the flatfish favourite, and wrasse and bass take it too.' },
  lug: { id: 'lug', on: 'lugworm', type: 'bait', name: 'Lugworm', short: 'Lugworm', size: 2, weight: 5, water: 'salt',
    desc: 'Dug from the estuary sand. It oozes scent along the seabed: flounder and plaice follow it.' },
  crab: { id: 'crab', on: 'peeler crab', type: 'bait', name: 'Peeler crab', short: 'Crab', size: 2, weight: 8, water: 'salt',
    desc: 'A soft crab, irresistible to wrasse on the reef and bass in the estuary.' },
  strip: { id: 'strip', on: 'a mackerel strip', type: 'bait', name: 'Mackerel strip', short: 'Fish strip', size: 2, weight: 6, water: 'salt',
    desc: 'An oily strip that flutters in the tide. Bigger flatfish, bass and the old mossback.' },
  // --- lures: spinners, spoons, plugs, soft plastics, metals and surface lures ---
  tspin: { id: 'tspin', on: 'a little trout spinner', type: 'lure', name: 'Trout spinner (size 0)', short: 'Trout spinner', size: 1, weight: 3,
    action: 'flash', sink: 0.4, lift: 0.95, water: 'fresh',
    desc: 'A tiny gold-bladed spinner. Trout and perch in clear water can’t leave it alone.' },
  spinner: { id: 'spinner', on: 'a silver spinner', type: 'lure', name: 'Silver spinner', short: 'Spinner', size: 1, weight: 6,
    action: 'flash', sink: 0.45, lift: 0.9, water: 'both',
    desc: 'A spinning blade that flashes. It sinks while you wait and rises as you reel. Perch, trout and sunperch chase it.' },
  spoon: { id: 'spoon', on: 'a trout spoon', type: 'lure', name: 'Trout spoon', short: 'Spoon', size: 1, weight: 4,
    action: 'flash', sink: 0.7, lift: 0.8, water: 'fresh',
    desc: 'A little curved spoon that flutters as it sinks and wobbles back. Let it tumble down a pool.' },
  minnow: { id: 'minnow', on: 'a little minnow plug', type: 'lure', name: 'Mini minnow plug', short: 'Mini minnow', size: 1, weight: 3,
    action: 'wobble', dive: 0.5, floats: true, water: 'fresh',
    desc: 'A finger-length floating minnow that wobbles just under the surface. Riffles and weed tops.' },
  crankS: { id: 'crankS', on: 'a shallow crankbait', type: 'lure', name: 'Shallow crankbait', short: 'Shallow crank', size: 2, weight: 9,
    action: 'wobble', dive: 1.2, floats: true, water: 'both',
    desc: 'Floats at rest and wobbles down to about a metre when reeled. Run it over weed beds.' },
  crankD: { id: 'crankD', on: 'a deep crankbait', type: 'lure', name: 'Deep crankbait', short: 'Deep crank', size: 2, weight: 16,
    action: 'wobble', dive: 3.2, floats: true, water: 'both',
    desc: 'Its long lip digs down to about three metres. Reaches fish holding deep, and bumps the bottom in the shallows.' },
  jerk: { id: 'jerk', on: 'a jerkbait', type: 'lure', name: 'Jerkbait', short: 'Jerkbait', size: 3, weight: 14,
    action: 'dart', suspend: 1.0, water: 'fresh',
    desc: 'A slim lure that hangs still between twitches. Twitch, pause, twitch: pike hit it on the pause.' },
  shad: { id: 'shad', on: 'a paddle-tail shad', type: 'lure', name: 'Paddle-tail shad (soft)', short: 'Shad', size: 2, weight: 12,
    action: 'swim', sink: 0.35, water: 'both',
    desc: 'A soft rubber fish whose tail thumps as it swims. Count it down, then reel slowly: pike, perch, bass of both kinds.' },
  creature: { id: 'creature', on: 'a creature bait', type: 'lure', name: 'Creature bait (soft, weedless)', short: 'Creature', size: 2, weight: 10,
    action: 'crawl', sink: 0.8, water: 'fresh',
    desc: 'A weedless soft bait hopped slowly along the bottom through cover. Largemouth bass can’t stand it.' },
  popper: { id: 'popper', on: 'a popper', type: 'lure', name: 'Surface popper', short: 'Popper', size: 2, weight: 14,
    action: 'pop', floats: true, water: 'both',
    desc: 'Floats; each twitch makes it spit and pop on the surface. Bass of both kinds explode on it at dawn and dusk.' },
  sandeel: { id: 'sandeel', on: 'a soft sandeel', type: 'lure', name: 'Soft sandeel', short: 'Sandeel', size: 2, weight: 18,
    action: 'swim', sink: 0.5, water: 'salt',
    desc: 'A slim soft lure on a weighted head that wriggles like a sandeel. Sea bass, especially in the estuary current.' },
  metal: { id: 'metal', on: 'a casting metal', type: 'lure', name: 'Casting metal (25 g)', short: 'Metal', size: 1, weight: 25,
    action: 'flutter', sink: 1.4, water: 'salt',
    desc: 'A heavy slab of chrome that flies a long way and flutters fast. Mackerel shoals hit it.' },
  stickbait: { id: 'stickbait', on: 'a big stickbait', type: 'lure', name: 'Offshore stickbait (60 g)', short: 'Stickbait', size: 4, weight: 60,
    action: 'walk', floats: true, water: 'salt',
    desc: 'A long floating lure that skates and splashes across the top. Cast it into a tuna boil.' },
  mjig: { id: 'mjig', on: 'a metal jig', type: 'lure', name: 'Metal jig (80 g)', short: 'Metal jig', size: 3, weight: 80,
    action: 'flutter', sink: 2.6, water: 'salt',
    desc: 'Drops fast to deep fish; lift and let it flutter back. Tuna below the birds.' },
  // --- big-game trolling lures (trolled behind a moving boat on the big-game rod) ---
  skirt: { id: 'skirt', on: 'a skirted trolling lure', type: 'lure', name: 'Skirted trolling lure (Konahead, 25 cm)', short: 'Skirted lure', size: 4, weight: 140,
    action: 'troll', suspend: 0.35, sink: 0.6, water: 'salt',
    desc: 'A heavy resin head trailing a long vinyl skirt: trolled fast it dives, pops up and leaves a trail of bubbles like a fleeing fish. Marlin, wahoo, dorado and tuna.' },
  ballyhoo: { id: 'ballyhoo', on: 'a rigged ballyhoo', type: 'lure', name: 'Rigged ballyhoo (with a skirt)', short: 'Ballyhoo', size: 3, weight: 160,
    action: 'troll', suspend: 0.5, sink: 0.5, water: 'salt',
    desc: 'A real halfbeak, rigged on a big hook and a little chin lead so it swims, trolled slowly: sailfish, spearfish and sharks find it hard to resist.' },
  sabiki: { id: 'sabiki', on: 'sabiki feathers', type: 'lure', name: 'Sabiki feathers (6 tiny hooks, 20 g)', short: 'Sabiki', size: 0.5, weight: 20,
    action: 'flutter', sink: 0.9, water: 'salt',
    desc: 'A string of tiny hooks dressed in shiny fish skin, above a small lead. Let it down, then lift and drop it: sardines, anchovies, horse mackerel, bogue and sprats.' },
  // --- flies ---
  dry: { id: 'dry', on: 'a dry fly', type: 'fly', name: 'Dry fly (mayfly)', short: 'Dry fly', size: 1, fly: 'dry', water: 'fresh',
    desc: 'Floats on the surface like a hatching insect. Deadly when flies are hatching.' },
  nymph: { id: 'nymph', on: 'a nymph', type: 'fly', name: 'Nymph (pheasant tail)', short: 'Nymph', size: 1, fly: 'nymph', sink: 0.55, water: 'fresh',
    desc: 'Drifts just under the surface beneath a little orange indicator. Trout and grayling take it all day.' },
  streamer: { id: 'streamer', on: 'a streamer', type: 'fly', name: 'Streamer (woolly bugger)', short: 'Streamer', size: 2, fly: 'streamer', sink: 0.9, water: 'fresh',
    desc: 'A wiggly black fly you strip back in pulls, like a little fish. Big trout, perch and bass chase it.' },
  // --- squid jigs ---
  egi18: { id: 'egi18', on: 'a 1.8 squid jig', type: 'jig', name: 'Squid jig 1.8 (6 g, slow)', short: 'Jig 1.8', size: 1, weight: 6, sink: 0.22, water: 'salt',
    desc: 'Small and slow-sinking: for shallow water over weed, and wary squid on calm nights.' },
  egi25: { id: 'egi25', on: 'a 2.5 squid jig', type: 'jig', name: 'Squid jig 2.5 (10 g)', short: 'Jig 2.5', size: 2, weight: 10, sink: 0.3, water: 'salt',
    desc: 'The all-rounder: sinks about a metre every three seconds.' },
  egi30: { id: 'egi30', on: 'a 3.0 squid jig', type: 'jig', name: 'Squid jig 3.0 (15 g, fast)', short: 'Jig 3.0', size: 3, weight: 15, sink: 0.4, water: 'salt',
    desc: 'Heavier: casts further and gets down to squid in deeper water or a current.' },
};

// The colour of each kind of rod's line, in the water and on its spool in the backpack.
export const LINE_COLORS = { float: '#f5efe2', lure: '#c3dc98', ledger: '#e9f0e6', bottom: '#e9f0e6', fly: '#f0dc7a', jig: '#e7d6f2' };

export const ROD_IDS = Object.keys(RODS);
export const ITEM_IDS = Object.keys(TACKLE);
export const TERM_IDS = Object.keys(TERMS);
export const PACK = { rods: 2, items: 8, fish: 4, saved: 6 };
export const TYPE_NAMES = { bait: 'Baits', lure: 'Lures', fly: 'Flies', jig: 'Squid jigs' };
export const KIND_NAMES = { float: 'Float fishing', lure: 'Lure fishing', ledger: 'Carp fishing', bottom: 'Bottom fishing', fly: 'Fly fishing', jig: 'Squid jigging', spear: 'Spearfishing' };

// Ready-made setups to pack in one go at camp or from a boat's tackle locker: rods, how each
// is rigged, what to start with, and what else to carry.
export const SETUPS = [
  { id: 'carp', name: 'Starter Carp', note: 'Carp rod (hair rig, 12 lb) with boilies and corn, and a float rod for tench and roach',
    rods: ['carp', 'float'], items: ['boilie', 'corn', 'bread', 'maggot', 'worm'], rod: 'carp',
    line: { carp: 'm12', float: 'm6' }, term: { carp: 'hair', float: 'waggler' }, rig: { carp: 'boilie', float: 'maggot' } },
  { id: 'float', name: 'Float Fishing', note: 'Float rod (6 lb, waggler) with maggots, worms, bread and corn; light rod as a spare',
    rods: ['float', 'trout'], items: ['maggot', 'worm', 'bread', 'corn', 'prawn', 'tspin', 'spoon'], rod: 'float',
    line: { float: 'm6', trout: 'f4' }, term: { float: 'waggler' }, rig: { float: 'maggot', trout: 'tspin' } },
  { id: 'trout', name: 'Light Trout', note: 'Light rod (4 lb fluoro) with spinners and plugs, and the fly rod',
    rods: ['trout', 'fly'], items: ['tspin', 'spoon', 'minnow', 'dry', 'nymph', 'streamer'], rod: 'trout',
    line: { trout: 'f4', fly: 't3' }, rig: { trout: 'tspin', fly: 'nymph' } },
  { id: 'fly', name: 'Fly Fishing', note: 'Fly rod with dry fly, nymph and streamer, plus the light rod',
    rods: ['fly', 'trout'], items: ['dry', 'nymph', 'streamer', 'tspin', 'spoon', 'minnow'], rod: 'fly',
    line: { fly: 't3', trout: 'f4' }, rig: { fly: 'dry', trout: 'tspin' } },
  { id: 'predator', name: 'Lake Predator', note: 'Spinning rod (20 lb braid, wire trace) for pike and bass, light rod for perch',
    rods: ['spin', 'trout'], items: ['jerk', 'shad', 'creature', 'crankD', 'popper', 'spinner', 'tspin'], rod: 'spin',
    line: { spin: 'b20', trout: 'f4' }, term: { spin: 'wire' }, rig: { spin: 'jerk', trout: 'tspin' } },
  { id: 'coastal', name: 'Coastal Spinning', note: 'Coastal rod (fluoro leader) with metals, sandeels, a popper and sabiki feathers; float rod for mullet, salema and bogue',
    rods: ['sea', 'float'], items: ['metal', 'sandeel', 'popper', 'sabiki', 'bread', 'prawn', 'rag'], rod: 'sea',
    line: { sea: 'b20', float: 'm6' }, term: { sea: 'fluoro', float: 'waggler' }, rig: { sea: 'metal', float: 'bread' } },
  { id: 'reef', name: 'Rock & Reef', note: 'Bottom rod (running ledger) with crab, prawn, ragworm and fish strip for bream, grunts, conger and octopus; coastal rod with shads for pollack and dentex',
    rods: ['boat', 'sea'], items: ['crab', 'prawn', 'rag', 'strip', 'shad', 'sandeel', 'metal'], rod: 'boat',
    term: { boat: 'running', sea: 'fluoro' }, rig: { boat: 'crab', sea: 'shad' } },
  { id: 'flatfish', name: 'Flatfish', note: 'Bottom rod (flapper rig) with lugworm, ragworm and crab; coastal rod as a spare',
    rods: ['boat', 'sea'], items: ['lug', 'rag', 'crab', 'strip', 'metal', 'sandeel'], rod: 'boat',
    term: { boat: 'flapper', sea: 'fluoro' }, rig: { boat: 'lug', sea: 'metal' } },
  { id: 'squid', name: 'Squid', note: 'Squid rod with three jig sizes, and a float rod with prawns',
    rods: ['squid', 'float'], items: ['egi25', 'egi18', 'egi30', 'prawn', 'rag'], rod: 'squid',
    line: { float: 'm6' }, term: { float: 'waggler' }, rig: { squid: 'egi25', float: 'prawn' } },
  { id: 'offshore', name: 'Offshore', note: 'Offshore rod with a stickbait and metal jig for tuna, and the coastal rod',
    rods: ['offshore', 'sea'], items: ['stickbait', 'mjig', 'metal', 'sandeel'], rod: 'offshore',
    term: { sea: 'fluoro' }, rig: { offshore: 'stickbait', sea: 'metal' } },
  { id: 'biggame', name: 'Big Game', note: 'Big-game trolling rod with skirted lures and rigged ballyhoo, and the offshore rod with a stickbait and jig: marlin, sailfish, wahoo, dorado, tuna and sharks',
    rods: ['biggame', 'offshore'], items: ['skirt', 'ballyhoo', 'stickbait', 'mjig'], rod: 'biggame',
    line: { biggame: 'm80' }, term: { biggame: 'windon' }, rig: { biggame: 'skirt', offshore: 'stickbait' } },
  { id: 'bay', name: 'The Bay', note: 'Float rod and spinning rod with sea baits and lures (the way Slow Tide began)',
    rods: ['float', 'spin'], items: ['worm', 'prawn', 'corn', 'spinner', 'crankS', 'crankD'], rod: 'float',
    line: { float: 'm4', spin: 'b10' }, term: { float: 'waggler', spin: 'wire' }, rig: { float: 'worm', spin: 'spinner' } },
];

export function defaultGear() {
  return {
    pack: { rods: ['float', 'spin'], items: ['worm', 'prawn', 'corn', 'spinner', 'crankS', 'crankD'] },
    rod: 'float',
    rig: { float: 'worm', spin: 'spinner', carp: 'boilie', fly: 'dry', trout: 'tspin', sea: 'metal', boat: 'lug', squid: 'egi25', offshore: 'stickbait', biggame: 'skirt' },
    line: {},  // rod id -> line id (defaults to the rod's first line)
    term: {},  // rod id -> terminal tackle id (defaults to the rod's first)
    drag: {},
    saved: [], // setups you saved yourself: { name, rods, items, rod, rig, line, term }
  };
}

const lineOk = (rod, id) => rod.lines.some((l) => l.id === id);
const termOk = (rod, id) => rod.terms.includes(id);

function cleanSetup(s) {
  if (!s || typeof s !== 'object') return null;
  const rods = (Array.isArray(s.rods) ? s.rods : []).filter((r) => RODS[r]).slice(0, PACK.rods);
  if (!rods.length) return null;
  const items = (Array.isArray(s.items) ? s.items : []).filter((i) => TACKLE[i]).slice(0, PACK.items);
  const out = { name: typeof s.name === 'string' ? s.name.slice(0, 30) : 'My setup', rods: [...new Set(rods)], items: [...new Set(items)], rod: rods.includes(s.rod) ? s.rod : rods[0], rig: {}, line: {}, term: {} };
  for (const r of out.rods) {
    if (TACKLE[s.rig?.[r]]) out.rig[r] = s.rig[r];
    if (lineOk(RODS[r], s.line?.[r])) out.line[r] = s.line[r];
    if (termOk(RODS[r], s.term?.[r])) out.term[r] = s.term[r];
  }
  return out;
}

// Fix up a saved loadout (or an old save with none) so it always makes sense.
export function cleanGear(g) {
  const d = defaultGear();
  if (!g || !g.pack) return d;
  const rods = (g.pack.rods || []).filter((r) => RODS[r]).slice(0, PACK.rods);
  const items = (g.pack.items || []).filter((i) => TACKLE[i]).slice(0, PACK.items);
  const out = { pack: { rods: [...new Set(rods)], items: [...new Set(items)] }, rod: g.rod, rig: { ...d.rig }, line: {}, term: {}, drag: {}, saved: [] };
  for (const [r, i] of Object.entries(g.rig || {})) if (RODS[r] && TACKLE[i]) out.rig[r] = i;
  for (const [r, id] of Object.entries(g.line || {})) if (RODS[r] && lineOk(RODS[r], id)) out.line[r] = id;
  for (const [r, id] of Object.entries(g.term || {})) if (RODS[r] && termOk(RODS[r], id)) out.term[r] = id;
  // The drag you've set on each reel (0 = very light … 5 = locked).
  if (g.drag && typeof g.drag === 'object') {
    for (const [r, v] of Object.entries(g.drag)) if (RODS[r] && Number.isInteger(v) && v >= 0 && v <= 5) out.drag[r] = v;
  }
  if (Array.isArray(g.saved)) out.saved = g.saved.map(cleanSetup).filter(Boolean).slice(0, PACK.saved);
  if (!out.pack.rods.length) out.pack.rods = ['float'];
  if (!out.pack.rods.includes(out.rod)) out.rod = out.pack.rods[0];
  return out;
}

export const fits = (rod, item) => !!rod && !!item && rod.accepts.includes(item.type);

// The line and terminal tackle on a rod, as chosen (or the rod's defaults).
export const lineOf = (gear, rod) => rod.lines.find((l) => l.id === gear.line?.[rod.id]) || rod.lines[0];
export const termOf = (gear, rod) => TERMS[termOk(rod, gear.term?.[rod.id]) ? gear.term[rod.id] : rod.terms[0]];

// What the fish (and the fight) see of the line: the main line, hidden by a fluorocarbon
// leader, protected by wire. { name, kg, thick, trace }
export function lineInUse(gear, rod) {
  const l = lineOf(gear, rod), term = termOf(gear, rod);
  const thick = term.hides != null ? Math.min(l.thick, term.hides) : term.trace ? Math.max(l.thick, 0.8) : l.thick;
  const name = term.trace ? `${l.name} and a wire trace` : term.hides != null ? `${l.name} with a fluorocarbon leader` : l.name;
  return { name, kg: l.kg, thick, trace: !!term.trace };
}

// What the current rod has tied on: its chosen item if it is in the backpack, otherwise the
// first suitable thing that is.
export function currentRig(gear) {
  const rod = RODS[gear.rod];
  if (!rod) return { rod: null, item: null };
  const chosen = TACKLE[gear.rig[rod.id]];
  if (chosen && fits(rod, chosen) && gear.pack.items.includes(chosen.id)) return { rod, item: chosen };
  const first = gear.pack.items.map((i) => TACKLE[i]).find((t) => fits(rod, t));
  return { rod, item: first || null };
}

// How much the cast carries: the lure, or the float or lead plus the bait.
export function castWeight(rod, item, term) {
  if (rod.kind === 'fly') return 0;
  const w = item?.weight ?? 0;
  if (rod.kind === 'float' || rod.kind === 'ledger' || rod.kind === 'bottom') return (term?.weight ?? 0) + w;
  return w;
}

// Does this setup work? Problems with level 'block' stop the cast; 'warn' only explains.
export function checkSetup(rod, item, term) {
  const out = [];
  if (!item) {
    out.push({ level: 'block', text: `Nothing to tie on the ${rod.short.toLowerCase()}: pack ${TYPE_NAMES[rod.accepts[0]].toLowerCase()} for it.` });
    return out;
  }
  if (!fits(rod, item)) {
    const what = { bait: 'a bait', lure: 'a lure', fly: 'a fly', jig: 'a squid jig' }[item.type];
    const need = ROD_IDS.map((r) => RODS[r]).filter((r) => fits(r, item)).map((r) => r.short.toLowerCase());
    out.push({ level: 'block', text: `The ${rod.short.toLowerCase()} can’t fish ${what}${need.length ? `: that needs the ${need.slice(0, 2).join(' or ')}` : ''}.` });
    return out;
  }
  const w = castWeight(rod, item, term), [w0, w1] = rod.weight;
  if (rod.kind !== 'fly') {
    if (w > w1 * 1.25) out.push({ level: 'block', text: `The ${item.short.toLowerCase()} rig weighs ${w} g, far too heavy for the ${rod.short.toLowerCase()} (${w0}–${w1} g): the rod could snap on the cast.` });
    else if (w > w1) out.push({ level: 'warn', text: `${w} g is a little over this rod’s ${w0}–${w1} g: it casts, but not as far or as true.` });
    else if (w < w0 * 0.6) out.push({ level: 'warn', text: `${w} g is too light to load the ${rod.short.toLowerCase()} (${w0}–${w1} g): it won’t cast far.` });
  }
  return out;
}

// How far it casts: the rod's range, shortened when the weight is outside what it likes
// (too light doesn't load the rod; too heavy overloads it).
export function castRange(rod, item, term) {
  let max = rod.cast[1];
  if (rod.kind !== 'fly') {
    const w = castWeight(rod, item, term), [w0, w1] = rod.weight;
    if (w > w1) max *= clamp(1 - (w - w1) / w1, 0.55, 1);
    else max *= 0.55 + 0.45 * smoothstep(w0 * 0.3, w0 + (w1 - w0) * 0.4, w);
  }
  return [rod.cast[0], Math.round(clamp(max, rod.cast[0] + 4, rod.cast[1]))];
}

// How much the wind pushes a cast: light lures and flies a lot, a heavy lead hardly at all.
export function windSensitivity(rod, item, term) {
  if (rod.kind === 'fly') return 1.5;
  const w = castWeight(rod, item, term);
  return clamp(7 / (w + 2), 0.08, 2);
}

// How hard a landing it makes: scares nearby fish (radius in metres) and how loud it looks.
export function splashOf(rod, item, term) {
  if (rod.kind === 'fly') return 0.6;
  const w = castWeight(rod, item, term);
  if (rod.kind === 'jig') return 0.9;
  return clamp(0.8 + Math.sqrt(w) * 0.32, 0.9, 4);
}
