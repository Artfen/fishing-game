import { clamp, smoothstep, lerp } from './util.js';
import { weightOf } from './fish.js';

// Fish as individuals, and how each kind answers the water it's in.
//
//  · Every fish has its own build, worked out once from who it is (not drawn from the dice that
//    place the fish, so no fish moves): its condition (lean … fat for its length, Fulton's factor
//    about one), and from that its true weight; its vigour (how hard and long it fights, a fit fish
//    more); and its temper (bold … shy: how readily it comes to look, and how fussy it is).
//  · Each species has its likes: current (a trout or a bass holds in moving water; a carp keeps
//    out of it), rough water (bass hunt in the surf, mullet keep away), bright light (most fish go
//    shy and deep under a high sun; mullet and wrasse don't mind), and how much a disturbance puts
//    it off (splashes, a motor, casting over the same spot again and again).
//  · When a fish turns away from your rig it does so for a reason you can act on: too big a lure,
//    the wrong depth, too fast or too still, a line it can see, a dragging fly, or a disturbance.
//
// The Fish behaviour setting decides how fussy they are: Relaxed (the default) forgives a lot;
// Natural is each species as fussy as in life; Demanding adds wary fish, line-shy fish, and a
// hooked fish that throws the hook on a slack line or tears free of a light hold.

export const BEHAVIOUR = {
  relaxed: {
    id: 'relaxed', label: 'Relaxed', mood: 0.35, fussy: 0.5, disturb: 0.4, current: 0.5, throwHook: 0, pull: 0, shy: 0.6,
    desc: 'Fish come readily and forgive a lot: the wrong depth or a hasty retrieve rarely puts them off, and a hooked fish stays on. The way to enjoy the water.',
  },
  natural: {
    id: 'natural', label: 'Natural', mood: 1, fussy: 1, disturb: 1, current: 1, throwHook: 0.12, pull: 0.5, shy: 1,
    desc: 'Each kind as fussy as in life: the light, the current, the weather and a careless approach all count, and they tell you why they turn away. A jumping fish can throw the hook on a slack line.',
  },
  demanding: {
    id: 'demanding', label: 'Demanding', mood: 1.25, fussy: 1.35, disturb: 1.4, current: 1.3, throwHook: 0.3, pull: 1, shy: 1.3,
    desc: 'Wary fish: they spook at splashes and boats, see a thick line, and refuse anything not quite right. A hooked fish throws the hook on a slack line and can tear free of a light hold under too much pressure.',
  },
};
export const BEHAVIOUR_IDS = Object.keys(BEHAVIOUR);

/* ---------------- individuals ---------------- */

// A small, steady hash: the same fish always gets the same build.
function hashRnd(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// A fish's build: condition (≈ 0.82 … 1.18), vigour (≈ 0.8 … 1.25), temper (shy 0.6 … bold 1.5),
// and its weight in kg. id: a number unique to the fish; sp, size (cm).
export function traits(sp, size, id) {
  const r = hashRnd(id * 31 + 7);
  // (A sum of three for a hump in the middle: most fish are about average.)
  const n = (r() + r() + r()) / 3 - 0.5;
  const condition = clamp(1 + n * 0.5, 0.8, 1.2);
  const vigour = clamp(0.62 + condition * 0.38 + (r() - 0.5) * 0.3, 0.78, 1.28);
  const temper = clamp(0.6 + r() * 0.9, 0.6, 1.5);
  return { condition, vigour, temper, weight: Math.max(0.01, weightOf(sp, size) * condition) };
}

// In words, for the catch card: how it's built.
export function conditionWords(c) {
  if (c >= 1.12) return 'fat and deep-bodied';
  if (c >= 1.04) return 'in fine condition';
  if (c > 0.95) return 'in good condition';
  if (c > 0.88) return 'a little lean';
  return 'thin';
}

/* ---------------- what each kind likes ---------------- */

// current: the flow it likes (m/s; 0 keeps out of it) and how much it minds; rough: + seeks wave
// action, − avoids it; bright: how much a high sun puts it off (deeper, warier); disturb: how
// easily a disturbance spooks it; jumpy: how often a hooked one leaps or shakes its head.
const DEFAULT = { current: [0.15, 0.4], rough: 0, bright: 0.4, disturb: 1, jumpy: 0.2 };
const PREFS = {
  // Fresh water.
  trout: { current: [0.45, 1], rough: 0, bright: 0.7, disturb: 1.5, jumpy: 0.8 },
  grayling: { current: [0.4, 0.9], rough: 0, bright: 0.5, disturb: 1.2, jumpy: 0.3 },
  carp: { current: [0, 1], rough: -0.2, bright: 0.3, disturb: 1.6, jumpy: 0 },
  tench: { current: [0, 1], rough: -0.3, bright: 0.8, disturb: 1.2, jumpy: 0 },
  pike: { current: [0.05, 0.7], rough: 0, bright: 0.6, disturb: 0.7, jumpy: 0.5 },
  perch: { current: [0.1, 0.5], rough: 0, bright: 0.3, disturb: 0.6, jumpy: 0.1 },
  roach: { current: [0.1, 0.5], rough: 0, bright: 0.5, disturb: 1.1, jumpy: 0 },
  rudd: { current: [0.05, 0.6], rough: 0, bright: 0.2, disturb: 1.1, jumpy: 0 },
  lmbass: { current: [0.05, 0.6], rough: 0, bright: 0.7, disturb: 0.8, jumpy: 0.9 },
  // The sea.
  seabass: { current: [0.4, 0.8], rough: 0.9, bright: 0.6, disturb: 1.1, jumpy: 0.6 },
  mullet: { current: [0.1, 0.4], rough: -0.6, bright: 0, disturb: 1.8, jumpy: 0.4 },
  mackerel: { current: [0.45, 0.6], rough: 0.3, bright: 0, disturb: 0.4, jumpy: 0.3 },
  pollack: { current: [0.35, 0.6], rough: 0.4, bright: 0.6, disturb: 0.7, jumpy: 0 },
  wrasse: { current: [0.15, 0.5], rough: 0.2, bright: -0.1, disturb: 0.6, jumpy: 0 },
  garfish: { current: [0.4, 0.5], rough: 0.2, bright: 0, disturb: 0.6, jumpy: 1 },
  bluefish: { current: [0.5, 0.6], rough: 0.5, bright: 0.1, disturb: 0.6, jumpy: 0.7 },
  flounder: { current: [0.15, 0.6], rough: -0.1, bright: 0.4, disturb: 0.8, jumpy: 0 },
  plaice: { current: [0.15, 0.5], rough: -0.1, bright: 0.4, disturb: 0.8, jumpy: 0 },
  conger: { current: [0.05, 0.6], rough: 0, bright: 1, disturb: 0.7, jumpy: 0 },
  tuna: { current: [0.4, 0.4], rough: 0.3, bright: 0, disturb: 0.9, jumpy: 0.2 },
  squid: { current: [0.1, 0.6], rough: -0.3, bright: 1, disturb: 1, jumpy: 0 },
  gilthead: { current: [0.2, 0.5], rough: 0.1, bright: 0.4, disturb: 1.2, jumpy: 0 },
  meagre: { current: [0.3, 0.5], rough: 0.4, bright: 0.8, disturb: 0.9, jumpy: 0 },
  dentex: { current: [0.3, 0.5], rough: 0.2, bright: 0.5, disturb: 0.8, jumpy: 0 },
  sole: { current: [0.1, 0.5], rough: -0.1, bright: 1, disturb: 0.8, jumpy: 0 },
  turbot: { current: [0.2, 0.5], rough: 0, bright: 0.6, disturb: 0.7, jumpy: 0 },
  bonito: { current: [0.4, 0.4], rough: 0.3, bright: 0, disturb: 0.6, jumpy: 0.3 },
  cuttlefish: { current: [0.05, 0.6], rough: -0.3, bright: 0.5, disturb: 1.2, jumpy: 0 },
  octopus: { current: [0.05, 0.5], rough: -0.2, bright: 0.8, disturb: 1, jumpy: 0 },
  sardine: { current: [0.3, 0.4], rough: 0, bright: 0, disturb: 0.8, jumpy: 0 },
  horsemackerel: { current: [0.35, 0.5], rough: 0.2, bright: 0.2, disturb: 0.5, jumpy: 0.2 },
  // Las Brasas. Parrotfish and ornate wrasse are fish of the sunny shallows; a grouper and a moray
  // shun bright light and a disturbance; barracuda leap and shake their heads when hooked, and
  // amberjack shake theirs on the way down; the angelshark keeps still on the sand.
  parrotfish: { current: [0.1, 0.4], rough: 0.2, bright: -0.1, disturb: 0.9, jumpy: 0 },
  ornatewrasse: { current: [0.1, 0.5], rough: 0.2, bright: -0.1, disturb: 0.4, jumpy: 0 },
  triggerfish: { current: [0.15, 0.4], rough: 0.1, bright: 0, disturb: 0.5, jumpy: 0 },
  moray: { current: [0.05, 0.5], rough: 0, bright: 1, disturb: 0.7, jumpy: 0 },
  grouper: { current: [0.1, 0.4], rough: 0, bright: 0.5, disturb: 1.3, jumpy: 0 },
  barracuda: { current: [0.3, 0.5], rough: 0.2, bright: 0.3, disturb: 0.8, jumpy: 0.6 },
  amberjack: { current: [0.4, 0.5], rough: 0.3, bright: 0.2, disturb: 0.7, jumpy: 0.3 },
  chubmackerel: { current: [0.4, 0.6], rough: 0.3, bright: 0, disturb: 0.5, jumpy: 0.25 },
  angelshark: { current: [0.05, 0.5], rough: -0.2, bright: 0.8, disturb: 1, jumpy: 0 },
  // The big game: the open ocean's hunters care little for current or a boat's wake (billfish
  // even come to it); the billfish, the mako and the dorado leap when hooked.
  blueshark: { current: [0.3, 0.3], rough: 0.2, bright: 0, disturb: 0.3, jumpy: 0 },
  mako: { current: [0.3, 0.3], rough: 0.3, bright: 0, disturb: 0.3, jumpy: 0.45 },
  albacore: { current: [0.4, 0.4], rough: 0.3, bright: 0, disturb: 0.5, jumpy: 0.05 },
  bluemarlin: { current: [0.3, 0.3], rough: 0.3, bright: 0, disturb: 0.2, jumpy: 0.7 },
  sailfish: { current: [0.3, 0.3], rough: 0.2, bright: 0, disturb: 0.25, jumpy: 0.8 },
  spearfish: { current: [0.3, 0.3], rough: 0.2, bright: 0, disturb: 0.3, jumpy: 0.6 },
  wahoo: { current: [0.4, 0.4], rough: 0.3, bright: 0, disturb: 0.4, jumpy: 0.05 },
  dorado: { current: [0.3, 0.3], rough: 0.2, bright: 0, disturb: 0.3, jumpy: 0.55 },
  yellowfin: { current: [0.4, 0.4], rough: 0.3, bright: 0, disturb: 0.8, jumpy: 0.15 },
  hammerhead: { current: [0.3, 0.3], rough: 0.1, bright: 0.1, disturb: 0.5, jumpy: 0 },
  trumpetfish: { current: [0.05, 0.4], rough: -0.2, bright: 0.2, disturb: 1, jumpy: 0 },
};
export const prefsFor = (id) => PREFS[id] || DEFAULT;

// How the water here suits this fish just now, as a multiplier on its interest (0.25 … 1.4), and
// the biggest thing putting it off (for advice). env: { current (m/s), waves (crest-to-trough m),
// light (0 night … 1 a bright midday sun), disturb (0 … 1 near here lately), storm (0 … 1) }.
export function mood(a, env, level = BEHAVIOUR.relaxed) {
  const P = prefsFor(a.sp.id), k = level.mood;
  let m = 1, worst = null, worstK = 1;
  const note = (f, why) => {
    m *= f;
    if (f < worstK) {
      worstK = f;
      worst = why;
    }
  };
  // Current: near what it likes is best; far off it, less keen (by how much it minds).
  const [want, mind] = P.current;
  const off = Math.abs(env.current - want) / Math.max(0.15, want + 0.2);
  note(1 - clamp(off * mind * 0.45, 0, 0.55) * k, env.current > want ? 'current' : 'still');
  // Rough water: the surf hunters perk up, the shy ones go quiet.
  const rough = smoothstep(0.3, 2.5, env.waves);
  if (P.rough > 0) m *= 1 + rough * P.rough * 0.5;
  else if (P.rough < 0) note(1 + rough * P.rough * 0.6 * k, 'rough');
  // A storm puts most fish down, the surf hunters apart.
  if (env.storm > 0.2 && P.rough < 0.6) note(1 - env.storm * 0.45 * k, 'storm');
  // A high, bright sun: shy fish keep deep and wary.
  note(1 - smoothstep(0.6, 1, env.light) * P.bright * 0.4 * k, 'bright');
  // Disturbance: splashes, motors, the same spot cast at again and again.
  note(1 - clamp(env.disturb * P.disturb * 0.55 * level.disturb, 0, 0.8), 'disturbed');
  // And its own temper: bold fish come, shy ones hang back.
  m *= lerp(1, a.temper ?? 1, 0.6);
  return { m: clamp(m, 0.2, 1.45), worst: worstK < 0.85 ? worst : null };
}

/* ---------------- why it turned away ---------------- */

// The reason a fish gave up on the rig, as a code and a sentence to act on. f: what the fish made
// of it (from the ecosystem: appeal's parts); the mood's worst; the way it left.
export function whyRejected(f, reason) {
  if (reason === 'startled' || reason === 'spooked') return f.fast ? ['fast', 'It shied away from a lure coming through that fast. Slower, near it.'] : ['spooked', 'Something spooked it. Go quietly: fewer splashes, the motor off, a softer cast.'];
  if (f.size) return ['size', f.lure ? 'It looked and turned away: the lure’s too big for this one. Try something smaller.' : 'It mouthed the bait and left it: too big a mouthful for this one.'];
  if (f.drag) return ['drag', 'It came up, looked, and refused it: the fly was dragging across the current. Mend the line, or cast straight upstream.'];
  if (f.line) return ['line', 'It came close, then sheered off: it saw the line. A lighter line (or a longer leader) fools a shy fish.'];
  if (f.depth) return ['depth', f.above ? 'It looked up at it but wouldn’t come: the bait’s too far above it. Fish it deeper.' : 'It was too deep for it: the fish are higher in the water. Fish it shallower.'];
  if (f.motion) return ['motion', f.motion === 'fast' ? 'It followed but wouldn’t take: too fast for it. Slow the retrieve.' : f.motion === 'still' ? 'It lost interest in something so still. Give it a twitch, or reel steadily.' : 'It followed but wouldn’t commit. A twitch or a pause often makes them strike.'];
  if (f.mood === 'disturbed') return ['spooked', 'It hung back, wary: this water’s been disturbed lately. Rest it, or move along a little.'];
  if (f.mood === 'bright') return ['bright', 'It hung back in the bright light. Shy fish feed better at dawn, dusk or under cloud, or deeper down.'];
  if (f.mood === 'current') return ['current', 'It wouldn’t hold in water running this hard. Look for the slacker water beside it.'];
  if (f.mood === 'still') return ['still', 'It’s a fish of moving water: try where the current runs.'];
  if (f.mood === 'storm' || f.mood === 'rough') return ['weather', 'It’s keeping its head down in this weather. Sheltered water, or the fish that love the surf.'];
  return ['fussy', reason === 'turned' ? 'It followed all the way in, then turned away. Try a twitch, or a pause.' : 'It looked, and swam off. Another may come.'];
}
