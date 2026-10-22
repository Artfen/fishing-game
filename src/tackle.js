import { clamp, smoothstep } from './util.js';

// Rods, line and everything that goes on the end of it. A rod decides HOW you fish
// (its "kind": float, lure, ledger or fly) and what it can carry; the tackle item decides
// what the fish see. Fish species list how much they like each item (see fish.js `food`).

export const RODS = {
  float: {
    id: 'float', name: 'Willow float rod', short: 'Float rod', kind: 'float', accepts: 'bait',
    length: '3.6 m', line: { name: '4 lb mono', kg: 1.8, thick: 0.35 },
    cast: [4, 24], weight: [1, 8], power: 1.0, finesse: 0.75,
    strengths: 'Hangs a bait at any depth under a float, and shows every nibble.',
    limits: 'Light line: a big carp or pike can snap it if you hold on while it runs.',
    look: { len: 3.4, color: '#8a5a34', handle: '#d7b98a', reel: 'pin' },
  },
  spin: {
    id: 'spin', name: 'Spinning rod', short: 'Spinning rod', kind: 'lure', accepts: 'lure',
    length: '2.1 m', line: { name: '10 lb braid, wire trace', kg: 4.5, thick: 0.7, trace: true },
    cast: [8, 36], weight: [5, 25], power: 1.15, finesse: 0.45,
    strengths: 'Casts lures a long way and works them with life. The wire trace stops pike biting through.',
    limits: 'Wary trout notice the heavier line. Light lures don’t cast as far.',
    look: { len: 2.15, color: '#2f3640', handle: '#c9a87a', reel: 'spin' },
  },
  carp: {
    id: 'carp', name: 'Carp rod', short: 'Carp rod', kind: 'ledger', accepts: 'bait',
    length: '3.6 m', line: { name: '12 lb mono', kg: 5.4, thick: 0.9 },
    cast: [10, 46], weight: [40, 90], power: 1.35, finesse: 0.3,
    strengths: 'Lays a bait on the bottom far out and sits on a bite alarm while you wait. Lands big fish.',
    limits: 'No good for lures, and the heavy lead lands with a splash that spooks nearby fish.',
    look: { len: 3.4, color: '#2e4a3a', handle: '#2b2b2b', reel: 'big' },
  },
  fly: {
    id: 'fly', name: 'Fly rod', short: 'Fly rod', kind: 'fly', accepts: 'fly',
    length: '2.7 m, #5', line: { name: 'floating line, 3 lb tippet', kg: 1.4, thick: 0.25 },
    cast: [5, 18], weight: [0, 1], power: 0.85, finesse: 1.0,
    strengths: 'Lays a weightless fly down without a splash. Made for wary stream trout.',
    limits: 'Short range, and the fine tippet needs a gentle hand with a big fish.',
    look: { len: 2.7, color: '#9a7040', handle: '#d7b98a', reel: 'fly' },
  },
};

export const TACKLE = {
  worm: {
    id: 'worm', on: 'a worm', type: 'bait', name: 'Garden worms', short: 'Worm', size: 1, weight: 3,
    desc: 'Almost anything with fins will try a worm.',
  },
  prawn: {
    id: 'prawn', on: 'a prawn', type: 'bait', name: 'Bay prawns', short: 'Prawn', size: 2, weight: 4,
    desc: 'Salty and strong-smelling. The bigger sea fish love them.',
  },
  corn: {
    id: 'corn', on: 'sweetcorn', type: 'bait', name: 'Sweetcorn', short: 'Sweetcorn', size: 1, weight: 2,
    desc: 'Small, bright and sweet. Carp and rudd find it hard to resist.',
  },
  bread: {
    id: 'bread', on: 'bread flake', type: 'bait', name: 'Bread flake', short: 'Bread', size: 1, weight: 1,
    desc: 'Soft and light. Rudd and little silver fish take it near the top.',
  },
  boilie: {
    id: 'boilie', on: 'a boilie', type: 'bait', name: 'Boilies', short: 'Boilie', size: 2, weight: 4,
    desc: 'Hard, round carp baits. Small fish can’t manage them, so they wait for something big.',
  },
  spinner: {
    id: 'spinner', on: 'a silver spinner', type: 'lure', name: 'Silver spinner', short: 'Spinner', size: 1, weight: 6,
    action: 'flash', sink: 0.45, lift: 0.9,
    desc: 'A spinning blade that flashes. It sinks while you wait and rises as you reel. Perch, trout and sunperch chase it.',
  },
  crankS: {
    id: 'crankS', on: 'a shallow crankbait', type: 'lure', name: 'Shallow crankbait', short: 'Shallow crank', size: 2, weight: 9,
    action: 'wobble', dive: 1.2, floats: true,
    desc: 'Floats at rest and wobbles down to about a metre when reeled. Run it over weed beds.',
  },
  crankD: {
    id: 'crankD', on: 'a deep crankbait', type: 'lure', name: 'Deep crankbait', short: 'Deep crank', size: 2, weight: 16,
    action: 'wobble', dive: 3.2, floats: true,
    desc: 'Its long lip digs down to about three metres. Reaches fish holding deep, and bumps the bottom in the shallows.',
  },
  jerk: {
    id: 'jerk', on: 'a jerkbait', type: 'lure', name: 'Jerkbait', short: 'Jerkbait', size: 3, weight: 14,
    action: 'dart', suspend: 1.0,
    desc: 'A slim lure that hangs still between twitches. Twitch, pause, twitch: pike hit it on the pause.',
  },
  dry: {
    id: 'dry', on: 'a dry fly', type: 'fly', name: 'Dry fly (mayfly)', short: 'Dry fly', size: 1, fly: 'dry',
    desc: 'Floats on the surface like a hatching insect. Deadly when flies are hatching.',
  },
  nymph: {
    id: 'nymph', on: 'a nymph', type: 'fly', name: 'Nymph (pheasant tail)', short: 'Nymph', size: 1, fly: 'nymph', sink: 0.55,
    desc: 'Drifts just under the surface beneath a little orange indicator. Trout and grayling take it all day.',
  },
  streamer: {
    id: 'streamer', on: 'a streamer', type: 'fly', name: 'Streamer (woolly bugger)', short: 'Streamer', size: 2, fly: 'streamer', sink: 0.9,
    desc: 'A wiggly black fly you strip back in pulls, like a little fish. Big trout and perch chase it.',
  },
};

export const ROD_IDS = Object.keys(RODS);
export const ITEM_IDS = Object.keys(TACKLE);
export const PACK = { rods: 2, items: 6, fish: 4 };
export const TYPE_NAMES = { bait: 'Baits', lure: 'Lures', fly: 'Flies' };
export const KIND_NAMES = { float: 'Float fishing', lure: 'Lure fishing', ledger: 'Bottom fishing', fly: 'Fly fishing' };

export function defaultGear() {
  return {
    pack: { rods: ['float', 'spin'], items: ['worm', 'prawn', 'corn', 'spinner', 'crankS', 'crankD'] },
    rod: 'float',
    rig: { float: 'worm', spin: 'spinner', carp: 'boilie', fly: 'dry' },
  };
}

// Fix up a saved loadout (or an old save with none) so it always makes sense.
export function cleanGear(g) {
  const d = defaultGear();
  if (!g || !g.pack) return d;
  const rods = (g.pack.rods || []).filter((r) => RODS[r]).slice(0, PACK.rods);
  const items = (g.pack.items || []).filter((i) => TACKLE[i]).slice(0, PACK.items);
  const out = { pack: { rods: [...new Set(rods)], items: [...new Set(items)] }, rod: g.rod, rig: { ...d.rig, ...(g.rig || {}) } };
  if (!out.pack.rods.length) out.pack.rods = ['float'];
  if (!out.pack.rods.includes(out.rod)) out.rod = out.pack.rods[0];
  return out;
}

// What the current rod has tied on: its chosen item if it is in the backpack,
// otherwise the first suitable thing that is.
export function currentRig(gear) {
  const rod = RODS[gear.rod];
  if (!rod) return { rod: null, item: null };
  const chosen = TACKLE[gear.rig[rod.id]];
  if (chosen && chosen.type === rod.accepts && gear.pack.items.includes(chosen.id)) return { rod, item: chosen };
  const first = gear.pack.items.map((i) => TACKLE[i]).find((t) => t.type === rod.accepts);
  return { rod, item: first || null };
}

export const fits = (rod, item) => !!rod && !!item && rod.accepts === item.type;

// Light lures don't load a spinning rod, so they don't fly as far.
export function castRange(rod, item) {
  let max = rod.cast[1];
  if (rod.kind === 'lure' && item) {
    const [w0, w1] = rod.weight;
    const k = item.weight > w1 ? 0.8 : 0.62 + 0.38 * smoothstep(w0, w0 + (w1 - w0) * 0.45, item.weight);
    max *= k;
  }
  return [rod.cast[0], Math.round(clamp(max, rod.cast[0] + 4, rod.cast[1]))];
}

// How hard a landing it makes: scares nearby fish (radius in metres) and how loud it looks.
export function splashOf(rod, item) {
  if (rod.kind === 'fly') return 0.6;
  if (rod.kind === 'ledger') return 3.2;
  if (rod.kind === 'lure') return 1.2 + (item?.weight || 8) * 0.06;
  return 1.8;
}
