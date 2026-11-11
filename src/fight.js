// The fight with a hooked fish, as plain numbers (no graphics), so it can be tuned and tested
// on its own.
//
// Tension is measured against the line's breaking strain: 1 means the line parts. The reel's
// drag (its clutch) slips and gives line once the tension reaches the drag setting, so with a
// sensible drag a running fish takes line instead of snapping it. A fish tires as it fights
// (faster the more pressure you keep on it), and a tired fish can be wound in.
//
// A line doesn't part the instant it's loaded past its rating: overload strains it, and the
// strain builds over a fraction of a second (longer on Relaxed, shorter on Realistic). So the
// creak you hear when the line is at its limit is a real warning: ease off and it holds.
//
// The line breaks for a reason the player can see and avoid:
// - 'tension': you kept winding hard while the fish surged (wait for the flick on the surface
//   that comes before each run, and ease off while it runs, or at least when the line creaks);
// - 'drag':    the drag was set so tight it couldn't slip before the line broke;
// - 'snag':    the line was too light to stop the fish reaching weed or roots, and it cut on them;
// - 'teeth':   a pike's teeth cut line that had no wire trace.
// Or the fish comes off without the line breaking (the Fish behaviour setting decides how
// likely; on Relaxed, never):
// - 'thrown':  it leapt or shook its head while the line hung slack, and threw the hook;
// - 'pulled':  a hook with only a light hold tore free under heavy, sustained pressure.
//
// Each fish fights as itself: its kind's style, its size (a big fish's runs longer and heavier,
// a small one's quick), its own vigour and condition; it changes direction on a run, some kinds
// leap; it tires (shorter runs, then beaten, rolling on its side). The current helps a fish
// running with it; a soft rod cushions a surge but tires a fish more slowly than a stiff one;
// and side pressure (the rod swung against the way it's running) turns it and tires it sooner.
//
// And each kind has its own signature moves (see SIGNATURES), each with a tell you can see, hear
// and feel, and a right answer with the rod and the reel:
// - 'charge':    a trout turns and runs straight at you: wind fast to keep up (the line falls
//                slack otherwise, and a slack line lets it shake the hook);
// - 'headshake': a bass or a pike at the top, shaking its head: the rod low and to one side
//                keeps its head down and the line steady (rod up and winding, the line snatches
//                at every shake; easing right off, it falls slack between them);
// - 'dive':      a crash-dive for the rocks or the weed: side strain turns its head;
// - 'lastdash':  one more dive at your feet, close in, when you thought it was done;
// - 'longrun':   a tuna's or a wahoo's run that pours line off the reel past where it was
//                hooked (any fish can take line past where it was hooked when it outpulls the
//                drag, but these go far); the spool holds only so much (a drag set too light
//                lets it all go);
// - 'sound':     straight down and hanging there, a dead weight: winding steadily barely moves
//                it; pump it up in strokes (lift, then wind down as you lower the rod);
// - 'circle':    a tired tuna circling below the boat: wind as it comes up on the near side,
//                hold as it goes round the far side (winding then only loads the line).

// The drag settings: the fraction of the line's breaking strain at which the reel gives line.
export const DRAG_LEVELS = [0.3, 0.42, 0.55, 0.68, 0.82, 1.05]; // "locked" is past the line's breaking strain
export const DRAG_NAMES = ['very light', 'light', 'medium', 'firm', 'tight', 'locked'];
export const DEFAULT_DRAG = 2;

// How each difficulty changes things.
export const DIFFICULTY = {
  relaxed: {
    id: 'relaxed', label: 'Relaxed',
    bite: 1.6, force: 0.8, shock: 0.5, tire: 1.5, snag: 2.2, light: 3.2, warn: 0.75, teeth: 0.5, cast: 0.6, onset: 0.45, strain: 1.6,
    desc: 'Fish give you longer to strike, pull less hard and tire sooner. The line forgives a lot, fish rarely reach the weed, and casts fly truer.',
  },
  standard: {
    id: 'standard', label: 'Standard',
    bite: 1, force: 1, shock: 1, tire: 1, snag: 1, light: 2.2, warn: 0.45, teeth: 1, cast: 1, onset: 0.35, strain: 0.35,
    desc: 'The way Slow Tide is meant to be played. Suitable tackle and a little care land anything.',
  },
  realistic: {
    id: 'realistic', label: 'Realistic',
    bite: 0.75, force: 1.15, shock: 1.15, tire: 0.85, snag: 0.75, light: 1.7, warn: 0.3, teeth: 1.3, cast: 1.25, onset: 0.22, strain: 0.25,
    desc: 'Shorter bites, stronger fish, less warning before a run and less forgiving casts. Light line and a heavy hand lose fish; the right rod and patience still win.',
  },
};
export const DIFFICULTY_IDS = Object.keys(DIFFICULTY);

// How each kind of fish fights: how long its runs and rests last, how hard it surges, how fast
// it tires, how it moves on the line (sway: side to side; dive: how deep it goes on a run;
// splash: whether it breaks the surface), and what the game says while it runs.
export const FIGHT_STYLES = {
  steady: { run: 1, rest: 1, surge: 1, tire: 1, sway: 2.2, dive: 0.45, splash: true, words: 'It’s pulling.' },
  // Carp, tench, wrasse: long, heavy, plodding runs, few surprises.
  dogged: { run: 1.25, rest: 0.9, surge: 1.03, tire: 1, sway: 2.4, dive: 0.9, splash: false, words: 'It’s plodding off, heavy and steady.' },
  // Trout, perch, mackerel, sea bass, mullet: quick dashes this way and that, and splashes.
  dash: { run: 0.7, rest: 0.75, surge: 1, tire: 1.4, sway: 2.8, dive: 0.3, splash: true, words: 'It’s darting this way and that.' },
  // Pike and largemouth bass: short, violent head-shaking surges at the surface.
  thrash: { run: 0.75, rest: 0.9, surge: 1, tire: 1.1, sway: 1.7, dive: 0.2, splash: true, words: 'It’s shaking its head.' },
  // Flatfish: they flatten themselves on the bottom and plane against the pull.
  flat: { run: 1.2, rest: 1.1, surge: 0.7, tire: 0.9, sway: 1.3, dive: 3, splash: false, words: 'It’s flattened itself against the bottom.' },
  // Squid: short backward jets, one after another.
  jet: { run: 0.45, rest: 0.55, surge: 0.9, tire: 1.2, sway: 0.7, dive: 0.6, splash: false, words: 'It’s jetting backwards in pulses.' },
  // Tuna: long, deep runs, circling below the boat, but they tire.
  deep: { run: 1.5, rest: 0.9, surge: 1, tire: 1.25, sway: 3.6, dive: 2.5, splash: false, words: 'It’s sounding deep, circling below.' },
  // Octopus: it grips the seabed with its arms and lets go only to steady, patient pressure.
  cling: { run: 1.4, rest: 1.3, surge: 0.75, tire: 0.85, sway: 0.8, dive: 2.6, splash: false, words: 'It’s clinging to the bottom: keep a steady lift.' },
  // Conger: twisting and backing down towards its hole in the rocks.
  twist: { run: 1.15, rest: 0.8, surge: 1.1, tire: 0.9, sway: 1.4, dive: 2.4, splash: false, words: 'It’s twisting and backing down towards the rocks.' },
  // Rays: wings spread, they kite off wide across the tide and clamp flat on the bottom (plating),
  // a dead weight you pump up off the sand a little at a time.
  plate: { run: 1.35, rest: 1.25, surge: 0.8, tire: 0.8, sway: 3.0, dive: 3.2, splash: false, words: 'It’s kiting off with its wings spread, then clamping flat on the sand: pump it up off the bottom.' },
  // Catsharks and dogfish: writhing and rolling, wrapping themselves in the line.
  roll: { run: 0.6, rest: 0.7, surge: 1.15, tire: 1.3, sway: 1.1, dive: 1.4, splash: false, words: 'It’s writhing and rolling, wrapping itself in the line.' },
  // Garfish: skittering, leaping and tail-walking across the top.
  leap: { run: 0.6, rest: 0.7, surge: 0.9, tire: 1.5, sway: 3.2, dive: 0.1, splash: true, words: 'It’s skittering and leaping across the surface.' },
  // Marlin, sailfish, spearfish: long, fast runs across the top, greyhounding and tail-walking,
  // then sounding deep; a long fight, but they do tire.
  billfish: { run: 1.75, rest: 0.85, surge: 1.05, tire: 0.6, sway: 4.4, dive: 0.5, splash: true, words: 'It’s greyhounding away across the top, leaping as it goes!' },
  // Sharks: heavy, relentless runs deep, shaking their heads, and they never quite give up.
  shark: { run: 1.5, rest: 1.0, surge: 1.1, tire: 0.7, sway: 2.2, dive: 1.6, splash: false, words: 'It’s boring away deep, shaking its head: heavy and relentless.' },
  // Wahoo: one blistering first run that strips line off the reel, then shorter ones.
  blister: { run: 1.7, rest: 1.15, surge: 1.15, tire: 1.45, sway: 2.0, dive: 0.6, splash: false, words: 'It’s off on a blistering run: let the drag work.' },
};

// Each kind's signature moves (see the top of this file), by its fight style, and for a few kinds
// their own: what makes a sea bass, a trout and a tuna three different fights, not one fight of
// three lengths.
const STYLE_MOVES = {
  thrash: ['headshake'],
  dogged: ['dive', 'lastdash'],
  deep: ['longrun', 'sound', 'circle'],
  blister: ['longrun'],
  billfish: ['longrun'],
  shark: ['headshake', 'sound'],
  plate: ['sound'],
  twist: ['dive'],
  // (Flatfish and octopus clamp to the bottom: a dead weight to pump up. Dogfish writhe and roll.)
  flat: ['sound'],
  cling: ['sound'],
  roll: ['headshake'],
};
export const SIGNATURES = {
  trout: ['charge'], grayling: ['charge'], sunperch: ['charge'],
  seabass: ['headshake', 'dive', 'lastdash'], striped: ['headshake', 'dive', 'lastdash'],
  barracuda: ['charge', 'headshake'], dorado: ['charge', 'headshake'],
  amberjack: ['dive', 'sound'], grouper: ['dive'], meagre: ['headshake', 'dive', 'lastdash'],
  // (The small fish of the rocks and streams wriggle and dart, but nothing worth naming.)
  rockgoby: [], shanny: [], corkwing: [], blackgoby: [], minnow: [],
};
export const signatureOf = (sp) => SIGNATURES[sp.id] ?? STYLE_MOVES[sp.fight] ?? [];

// What each move looks like from the rod, and the answer to it (said in the game as it happens).
export const MOVES = {
  charge: { name: 'the charge', tell: 'It turns and comes straight at you: the line falls slack.', answer: 'Wind as fast as you can to keep up with it.' },
  headshake: { name: 'the headshake', tell: 'At the top, its head up, shaking: the rod tip knocks.', answer: 'Rod low and to one side: keep its head down and the line steady.' },
  dive: { name: 'the dive', tell: 'It bores straight down for the rocks or the weed: the rod pulls down hard.', answer: 'Side strain: swing the rod low against it to turn its head.' },
  lastdash: { name: 'the last dash', tell: 'Close in, when you thought it was done, one more dive.', answer: 'Let the drag work: don’t wind into it.' },
  longrun: { name: 'the long run', tell: 'The reel screams and line pours off, far past where it was hooked.', answer: 'Let it run with the rod up. If the spool runs low, a click more drag (or follow it with the boat).' },
  sound: { name: 'sounding', tell: 'It goes straight down and hangs there, a dead weight.', answer: 'Pump it up: lift, then wind down as you lower the rod; winding steadily barely moves it.' },
  circle: { name: 'the circles', tell: 'Tired, it circles below the boat: the rod tip rises and falls.', answer: 'Wind as it comes up on the near side; hold as it goes round the far side.' },
};

// Line off the reel. When a running fish pulls harder than the drag, the drag slips and the fish
// swims off with line: as fast as it can swim against the drag's pull (a fish nearly free on a
// drag set far too light, a slow creep against one that nearly holds it), out past where it was
// hooked if it keeps going, until it tires, turns, runs out of water or empties the spool. A run
// that nothing much is stopping lasts longer, and winding against a resting fish on a drag that
// light only slips the spool. So the drag is the lever: light enough to give line on a surge,
// firm enough to stop a run.
//
// How fast each kind can run (m/s at the reel, for a fish of its size, fresh), by fight style:
// a wahoo or a billfish fastest, a tuna, then the darting and head-shaking kinds; clinging and
// twisting kinds hardly run at all.
const STYLE_SPEED = {
  steady: 1, dogged: 0.9, dash: 1.15, thrash: 1.05, flat: 0.6, jet: 0.8, deep: 1.15, cling: 0.4,
  twist: 0.7, plate: 0.85, roll: 0.75, leap: 1.15, billfish: 0.6, shark: 0.9, blister: 1.5,
};
export const runSpeed = (sp, size) => (1.6 + (2.6 * size) / 100) * (STYLE_SPEED[sp.fight || 'steady'] ?? 1);
// The drag holding less than this share of a running fish's pull barely checks it: its run goes
// on longer (up to RUN_FREE times as long, held by nothing).
const CHECK = 0.3, RUN_FREE = 2.4;

// How much line each reel holds (m), from the line's class: the big-game reels most (an 80 lb
// class lever-drag reel holds the best part of 700 m of its line, a 50 lb one over 400 m), a fly
// reel (fly line and backing) least.
export const spoolFor = (line) => {
  const kg = line?.kg ?? 4;
  return kg >= 30 ? 650 : kg >= 20 ? 420 : kg >= 8 ? 200 : kg >= 3.5 ? 150 : 110;
};

// How hard each kind makes for cover (weed, roots, rock) when it runs: 1 an ordinary fish; more,
// one that heads straight for a snag (a pollack crash-diving into the kelp, a conger backing into
// its hole, a tench for the lily roots); less, a fish of the open water that just runs (mackerel,
// tuna, garfish). By fight style, and for a few kinds their own.
const STYLE_COVER = {
  steady: 1, dogged: 1.6, dash: 0.6, thrash: 1.3, flat: 0.3, jet: 0.4, deep: 0.1, cling: 2.2,
  twist: 2.6, plate: 0.4, roll: 0.8, leap: 0.1, billfish: 0, shark: 0.2, blister: 0.1,
};
export const COVER = {
  perch: 1.3, trout: 1.1, seabass: 1, eel: 2, pollack: 2.2, wrasse: 2, tench: 1.9, carp: 1.6, lmbass: 1.6, pike: 1.3,
  comber: 1.7, triggerfish: 1.9, grouper: 2.6, mackerel: 0.1, horsemackerel: 0.15, sardine: 0.05, anchovy: 0.05,
  chubmackerel: 0.1, bogue: 0.3, mullet: 0.7, dorado: 0.1, barracuda: 0.3, hake: 0.3, sprat: 0.05,
  // (The small fish of the rocks dart straight for their crevice; a minnow just flits about.)
  rockgoby: 2.4, shanny: 2.6, corkwing: 2, blackgoby: 1.6, minnow: 0.4,
};
export const coverPull = (sp) => COVER[sp.id] ?? STYLE_COVER[sp.fight || 'steady'] ?? 1;

// The heaviest fish you can swing in on a line (kg): a quarter of its breaking strain, no more than
// two kilos (a hook-hold and a rod tip won't take more, whatever the line). Heavier: the net.
export const swingLimit = (line) => Math.min(2, Math.max(0.4, (line?.kg ?? 2) * 0.25));

const SURGE = 0.5;  // seconds
// The fight's metres are reckoned at the reel: a fraction of the fight is this many metres at
// least, so line goes out and comes back at the same pace however close it was hooked.
const SPAN = 30;
// Winding a resting fish in loads the line by about this much (of its breaking strain); a drag set
// well under it slips under the handle, and you gain only this share of what you wind.
export const slipK = (d, f) => clamp((d / (0.2 + 0.35 * f) - 0.3) / 0.3, 0.35, 1);
export const JOLT = [0.2, 0.55]; // the extra load (over the drag) of winding into a surge: base, and per unit of pull
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const approach = (v, target, up, down, dt) => (v < target ? Math.min(target, v + up * dt) : Math.max(target, v - down * dt));

// sp: species, size in cm, rod (with line.kg and power, and its flex), diff: a DIFFICULTY entry,
// cover: what the fish was hooked near that it could run into: 'weed' (weed, lilies, roots),
// 'rock', or nothing (true counts as weed). who: the fish itself, { vigour, condition }, how
// jumpy its kind is, the Fish behaviour setting's { throwHook, pull } (see behaviour.js), and how
// far off it was hooked (range, metres); all optional. The line (rod.line) may say how much it
// stretches (stretch: mono 1, fluorocarbon less, braid 0) and how it stands up to rock (abrade).
export function newFight(sp, size, rod, diff, cover = false, rnd = Math.random, who = {}) {
  const sizeK = clamp((size - sp.size[0]) / Math.max(1, sp.size[1] - sp.size[0]), 0, 1);
  const vigour = who.vigour ?? 1;
  const force = sp.pull * (0.35 + 0.65 * sizeK) * diff.force * vigour; // kg, when fresh
  const level = who.level || { throwHook: 0, pull: 0 };
  // The hook-set: a hook in the scissors holds; one just nicked in the lip has a light hold (a soft
  // mouth, a hake's, more often than not). Line that stretches soaks up the strike at long range,
  // so it sets the hook less well out there; braid doesn't stretch, and sets it home.
  const stretch = rod.line.stretch ?? 1;
  let light = sp.life?.softMouth ? 0.75 : 0.3;
  if (who.range != null) light += 0.25 * stretch * clamp((who.range - 20) / 30, 0, 1);
  if (stretch === 0) light -= 0.1;
  return {
    vigour,
    endure: (who.condition ?? 1) * vigour,
    jumpy: who.jumpy ?? 0,
    flex: rod.flex ?? 1,
    level,
    hold: level.pull > 0 && rnd() < clamp(light, 0.05, 0.9) ? 'light' : 'solid',
    stretch,
    soft: !!sp.life?.softMouth,
    flow: 0,     // the current, pulling it away from you (+) or towards you (−), m/s (set each step)
    side: 0,     // side pressure: the rod swung left (−1) or right (+1) (set each step)
    dir: 1,      // the way it's running, across the line
    turnT: 1,
    turn: 0,     // how much side pressure is turning it just now (0 … 1)
    leapIn: 0,   // a leap coming on this run (seconds until it clears the water)
    jumping: 0,  // a leap under way (seconds left), and whether the line went slack in it
    jumpSlack: false,
    pullT: 0,
    stage: 'fresh', // 'fresh', 'tiring', 'beaten'
    sizeK,
    style: FIGHT_STYLES[sp.fight] || FIGHT_STYLES.steady,
    force,
    ratio: force / rod.line.kg,            // pull against the line's breaking strain
    strength: sp.strength * (0.85 + sizeK * 0.35),
    reel: sp.reel * rod.power,
    stamina: 1,
    progress: 0,
    tension: 0.15,
    pulling: false,
    phaseT: 0.9 + rnd() * 0.7,
    warned: false,
    surgeT: 0,
    slipping: false,
    snagT: 0,
    drag: rod.drag ?? DEFAULT_DRAG,
    cover: !!cover,
    coverKind: cover === 'rock' ? 'rock' : cover ? 'weed' : null,
    coverK: coverPull(sp),
    // How the line stands up to rock: braid chafes through in a moment, a fluorocarbon leader or
    // heavy mono stands up to it, wire and the heavy leaders more still.
    abrade: rod.line.abrade ?? 1,
    teeth: !!sp.life?.teeth && !rod.line.trace,
    time: 0,
    peak: 0,
    strain: 0, // how close the line is to parting from overload (1 = it parts); eases off slowly
    // Its signature moves (see SIGNATURES), and the one under way (with its own clock).
    sig: signatureOf(sp),
    move: null,
    moveT: 0,
    moves: {},     // how many of each so far
    shakeIn: 0,    // a headshake coming on this run (seconds), one under way, and its clock
    shakeT: 0,
    shakeClock: 0,
    shakeOff: 0,   // (the shake's share of the tension just now)
    shakeSlack: 0, // (how long the line fell slack in it)
    chargeV: 0,    // a charge's speed towards you (m/s), and the slack it's left (m)
    slack: 0,
    turnHold: 0,   // side strain held against a dive (seconds)
    sounded: 0,    // line won back since it sounded (progress)
    circA: 0,      // where it is on its circle (radians), and whether it's coming up
    coming: false,
    heldFor: 0,    // how long you've been winding (for a pumping stroke)
    strokes: 0,
    // How far off it was hooked (m), the line out past that (a run that took line past where it
    // was hooked), the reel's capacity, and how fast it can run (m/s).
    dist: Math.max(3, who.range ?? 30),
    extra: 0,
    spool: rod.spool ?? spoolFor(rod.line),
    spoolWarn: 0,
    speed: runSpeed(sp, size),
    // The water it has to run in past where it was hooked (m; set each step by the game: a bank
    // or the shallows turns it), and whether it turned there this run.
    room: Infinity,
    edged: false,
    windSlip: 0,   // line the spool slipped back as you wound against a drag too light (m/s)
    chase: 0,      // the boat closing on it (m/s; set each step)
  };
}

// Advance the fight by dt seconds. held: the player is winding (holding the reel).
// Returns what happened this step: null, 'warn' (a flick before a run), 'run', 'turn' (it
// changed direction), 'jump', 'tiring', 'beaten'; a signature move beginning: 'charge', 'shake'
// (a headshake), 'dive', 'lastdash', 'longrun', 'sound', 'circle', or answered: 'turned' (side
// strain turned a dive), 'lifted' (pumped up off the bottom), 'spool' (the spool running low),
// 'edge' (a run stopped by a bank or the shallows: it turns);
// or an end: a break 'snap:tension' | 'snap:drag' | 'snap:snag' | 'snap:rock' | 'snap:teeth' |
// 'snap:spool', or the fish coming off, 'off:thrown' | 'off:pulled'.
export function stepFight(F, held, dt, diff, rnd = Math.random) {
  F.time += dt;
  let event = null;
  F.phaseT -= dt;
  F.windSlip = 0;
  const beaten = F.stage === 'beaten';
  const sig = F.sig || [];
  const has = (m) => sig.includes(m);
  const count = (m) => (F.moves[m] = (F.moves[m] || 0) + 1);
  const p0 = F.progress;
  // A pumping stroke: a short spell of winding (the rod lifting), then letting go (lowering it).
  let stroke = false;
  if (held) F.heldFor += dt;
  else {
    stroke = F.heldFor > 0.2 && F.heldFor < 1.8;
    F.heldFor = 0;
  }
  // (The last headshake's share of the load comes back out here, and goes back in below.)
  F.tension -= F.shakeOff;
  F.shakeOff = 0;

  // Close in, when you thought it was done, one more dive (the next run comes at once).
  if (has('lastdash') && !F.moves.lastdash && F.progress > 0.86 && !F.pulling && F.move !== 'charge') {
    count('lastdash');
    F.dash = true;
    F.move = null;
    F.phaseT = Math.min(F.phaseT, diff.warn + 0.05);
  }
  // (A run lasts until a leap in it is back in the water.)
  if (F.phaseT <= 0 && !(F.pulling && (F.jumping > 0 || F.leapIn > 0))) {
    if (F.pulling) {
      F.pulling = false;
      F.warned = false;
      F.leapIn = 0;
      F.shakeIn = 0;
      F.shakeT = Math.min(F.shakeT, dt);
      F.phaseT = (1.1 + rnd() * 1.3) * (1 + (1 - F.stamina) * 0.5) * F.style.rest;
      const was = F.move;
      F.move = null;
      F.dashing = false;
      if (has('sound') && !beaten && (was === 'longrun' || (!has('longrun') && rnd() < 0.4))) {
        // After a long run it sounds (and some kinds now and then on their own).
        F.move = 'sound';
        count('sound');
        F.sounded = 0;
        F.phaseT = (4.5 + rnd() * 3.5) * (0.5 + 0.5 * F.stamina) * F.style.rest;
        event = 'sound';
      } else if (has('circle') && (F.stage === 'beaten' || (F.stage === 'tiring' && F.extra < 5))) {
        // Tired, it circles below the boat, with longer between its runs.
        if (!F.moves.circle) event = 'circle';
        count('circle');
        F.move = 'circle';
        F.phaseT *= 2.4;
      }
    } else if (has('charge') && !beaten && !F.afterCharge && F.progress < 0.8 && rnd() < 0.35) {
      // Instead of running off, it turns and comes straight at you.
      F.move = 'charge';
      count('charge');
      F.chargeV = 2.2 + rnd() * 2 + F.sizeK;
      F.phaseT = 0.9 + rnd() * 0.8;
      F.warned = false;
      F.afterCharge = true;
      event = 'charge';
    } else {
      // A charge you didn't keep up with leaves slack, and a fish turning away on a slack line
      // can shake the hook.
      if (F.move === 'charge' && F.slack > 2.5 && rnd() < F.level.throwHook * 1.6 * Math.min(1, F.slack / 6)) {
        F.thrownBy = 'charge';
        return 'off:thrown';
      }
      F.afterCharge = false;
      F.move = null;
      F.pulling = true;
      F.edged = false;
      F.surgeT = SURGE;
      F.phaseT = (0.7 + rnd() * 0.7 + F.strength * 0.5) * (0.45 + 0.55 * F.stamina) * F.style.run;
      F.dir = rnd() < 0.5 ? -1 : 1;
      F.turnT = 0.5 + rnd() * 1.2;
      event = 'run';
      if (F.teeth && rnd() < 0.2 * diff.teeth) return 'snap:teeth';
      // Some kinds leap or shake their heads at the top a moment into a run (once the surge
      // has passed, so it's time to be winding again).
      if (!beaten && F.jumpy > 0 && rnd() < F.jumpy * 0.55 * (1 - F.progress * 0.5)) F.leapIn = SURGE + 0.15 + rnd() * 0.5;
      // Its signature move on this run, if any.
      if (F.dash) {
        F.dash = false;
        F.dashing = true;
        F.move = 'dive';
        F.turnHold = 0;
        F.phaseT = Math.max(F.phaseT, 1.4);
        event = 'lastdash';
      } else if (has('longrun') && !beaten && (!F.moves.longrun || (F.stage === 'fresh' && rnd() < 0.3))) {
        F.phaseT *= F.moves.longrun ? 1.5 : 2.1;
        count('longrun');
        F.move = 'longrun';
        event = 'longrun';
      } else if (has('dive') && !beaten && rnd() < (F.cover ? 0.55 : 0.3)) {
        count('dive');
        F.move = 'dive';
        F.turnHold = 0;
        event = 'dive';
      }
      if (has('headshake') && !beaten && F.move !== 'longrun' && rnd() < 0.6) F.shakeIn = Math.min(SURGE + 0.2 + rnd() * 0.6, F.phaseT - 0.9);
    }
  }
  if (F.leapIn > 0) {
    F.leapIn -= dt;
    if (F.leapIn <= 0) {
      F.jumping = 0.75;
      F.jumpSlack = false;
      event = event || 'jump';
    }
  }
  if (F.shakeIn > 0) {
    F.shakeIn -= dt;
    if (F.shakeIn <= 0 && F.pulling) {
      F.shakeT = 0.9 + rnd() * 0.7;
      F.shakeClock = 0;
      F.shakeSlack = 0;
      count('headshake');
      event = event || 'shake';
    }
  }
  if (!F.pulling && !F.warned && F.phaseT < diff.warn) {
    F.warned = true;
    event = 'warn';
  }
  // On a run it changes direction now and then: the darting kinds often.
  if (F.pulling) {
    F.turnT -= dt;
    if (F.turnT <= 0) {
      const darty = F.style.run < 0.8 ? 0.6 : 0.3;
      F.turnT = 0.6 + rnd() * 1.1;
      if (rnd() < darty) {
        F.dir = -F.dir;
        event = event || 'turn';
      }
    }
  }

  const d = DRAG_LEVELS[F.drag];
  // How hard it pulls right now, against the line: tiring as it goes, helped by the current when
  // it runs with it, half-hearted once beaten (but a dive pulls harder, and the last dash as if
  // it were fresh again).
  const flowK = 1 + 0.5 * Math.max(0, F.flow) * (F.level.current ?? 1);
  const f0 = F.ratio * (0.35 + 0.65 * F.stamina) * flowK;
  let f = f0;
  if (F.pulling && F.move === 'dive') f *= 1.3;
  if (F.dashing) f = Math.max(f, F.ratio * 0.8);
  // Side pressure: the rod swung against the way it's running turns it and shortens the run.
  const against = F.pulling ? clamp(-F.side * F.dir, 0, 1) : 0;
  F.turn = against;
  if (against > 0) F.phaseT -= against * 0.5 * dt;
  if (F.pulling) {
    // The first moment of a run is a surge: winding through it jolts the line before the drag
    // can start to slip. Ease off for that moment, then keep the rod up and let the drag work.
    // The jolt builds as the fish gets going (over diff.onset seconds), so letting go just
    // after the run starts is not quite too late; the flick before it gives you time.
    let jolt = 0;
    if (F.surgeT > 0) {
      F.surgeT -= dt;
      const k = clamp((SURGE - F.surgeT) / diff.onset, 0, 1);
      // (A soft rod cushions it; a stiff one passes it straight to the line.)
      // (The surge's jolt is the fish's own: a dive's weight comes on after it.)
      if (held) jolt = (JOLT[0] + JOLT[1] * Math.min(f0, 2.2)) * diff.shock * F.style.surge * k * k * (3 - 2 * k) * (0.55 + 0.45 * F.flex) * (F.cushion ?? 1);
    }
    const hold = held ? 1 : 0.6; // easing off lowers the rod and lets the drag work sooner
    // (Expert: lifting the rod into it loads the line further; see technique.js.)
    let target = Math.min(f, d) * hold + jolt + Math.abs(F.side) * 0.05 + (F.pumpLoad || 0);
    // In the air it isn't pulling: the line falls slack unless you keep winding, rod up.
    const air = F.jumping > 0;
    if (air) target = held ? Math.max(0.24, target * 0.6) : 0.04;
    // Easing off drops the load at once (the drag slips, the rod straightens); so does the end of a surge.
    F.tension = approach(F.tension, target, jolt ? 7 : 3.5, held ? 2.5 : 5, dt);
    F.slipping = !air && f > d * hold;
    const long = F.move === 'longrun';
    if (F.slipping) {
      // The drag gives line: it swims off as fast as it can against the drag's pull (nearly its
      // full speed on a drag far too light, a creep against one that nearly holds it), tiring;
      // on a long run, line simply pours off the reel. (Reckoned at the reel: see SPAN.)
      const free = Math.sqrt(clamp(1 - (d * hold) / f, 0, 1));
      const v = F.speed * (0.4 + 0.6 * F.stamina) * free * (long ? 1.4 : 1) * (F.dashing ? 1.2 : 1);
      F.progress -= (v * dt) / Math.max(F.dist, SPAN);
      // A drag holding back only a small share of its pull hardly checks it: the run goes on
      // (not a beaten fish's: its runs are half-hearted, short whatever the drag).
      const check = (d * hold) / f;
      if (check < CHECK && !F.edged && !beaten) F.phaseT += dt * (1 - Math.max(1 / RUN_FREE, check / CHECK));
    } else if (held) F.progress += F.reel * 0.35 * dt * (1 - 0.35 * Math.max(0, F.flow)); // it can't take line: you gain a little
    // A dive: side strain held against it turns its head (a firm hand turns it sooner).
    if (F.move === 'dive') {
      if (Math.abs(F.side) > 0.4) F.turnHold += dt * (held ? 1.4 : 0.8);
      if (F.turnHold > 0.9) {
        F.move = null;
        F.dashing = false;
        F.phaseT = Math.min(F.phaseT, 0.25);
        F.stamina -= 0.03;
        event = event || 'turned';
      }
    }
    // Fighting the drag tires it, the more so under steady pressure, from a stiffer rod, and with
    // the rod swung against it; a fish in fine fettle lasts longer. (A long run is a fish going
    // somewhere at its cruising pace: it spends itself more slowly than in a fight at close range.)
    F.stamina -= (0.03 + 0.13 * F.tension + 0.05 * against) * diff.tire * F.style.tire * (0.85 + 0.25 * F.flex) / Math.max(0.35, F.strength) / Math.max(0.7, F.endure ?? 1) * dt * (long ? 0.7 : 1);
  } else {
    F.slipping = false;
    // (Expert: pumping (lifting the rod while it rests) draws it towards you: see technique.js.)
    if (F.pump && F.move !== 'charge') F.progress += F.pump * dt * (0.6 + 0.6 * (1 - F.stamina)) * (F.move === 'sound' ? 1.6 : 1);
    const wind = F.reel * (0.75 + 0.6 * (1 - F.stamina)) * dt * (1 - 0.3 * Math.max(0, F.flow));
    if (F.move === 'charge') {
      // Coming at you: winding fast keeps up with it (as fast as the reel can take line in);
      // otherwise the line falls slack.
      const v = F.chargeV * dt, take = held ? Math.min(v, F.reel * 1.6 * F.dist * dt) : 0;
      F.progress += take / F.dist;
      F.slack += v - take;
      if (take >= v) F.slack = Math.max(0, F.slack - v);
      F.tension = approach(F.tension, held && take >= v * 0.9 ? 0.22 : 0.02, 3, 6, dt);
      F.stamina -= 0.01 * diff.tire * dt;
    } else if (F.move === 'sound') {
      // Straight down and hanging there, a dead weight: winding steadily barely shifts it, and
      // loads the line; each pumping stroke lifts it a little.
      let g = 0;
      if (held) {
        F.tension = approach(F.tension, Math.min(0.42 + 0.3 * f, d) + (F.pumpLoad || 0), 2.5, 1.5, dt);
        g += wind * 0.12;
      } else F.tension = approach(F.tension, 0.26, 1, 1.4, dt);
      if (stroke) {
        g += F.reel * 0.85 * (0.75 + 0.6 * (1 - F.stamina));
        F.strokes++;
        F.stamina -= 0.02 * diff.tire;
      }
      F.progress += g;
      F.sounded += g + (F.pump ? F.pump * dt : 0);
      // (Hanging there unpumped, it gets its breath back.)
      if (!F.pump) F.stamina += 0.01 * dt;
      // Lifted off the bottom, it's swimming again.
      if (F.sounded > 0.2) {
        F.move = null;
        event = event || 'lifted';
      }
    } else if (F.move === 'circle') {
      // Round and round below the boat: line comes in as it swims up on the near side; winding
      // as it goes round the far side only loads the line.
      F.circA += (dt * 2 * Math.PI) / (6 + 4 * F.sizeK);
      F.coming = Math.sin(F.circA) > 0;
      if (held) {
        if (F.coming) {
          F.progress += wind * 1.7;
          F.tension = approach(F.tension, Math.min(0.2 + 0.35 * f, d) + (F.pumpLoad || 0), 2.5, 1.5, dt);
        } else {
          // (It drags you round: the drag slips under the handle and it gains a little.)
          F.progress -= wind * 0.3;
          F.tension = approach(F.tension, d + 0.06, 2.5, 1.5, dt);
        }
        F.stamina -= 0.012 * diff.tire * dt;
      } else {
        F.tension = approach(F.tension, F.coming ? 0.12 : 0.2, 1, 1.4, dt);
        F.stamina += 0.01 * dt;
      }
    } else if (held) {
      F.tension = approach(F.tension, Math.min(0.2 + 0.35 * f, d) + (F.pumpLoad || 0), 2.5, 1.5, dt);
      // (On a drag set far lighter than it takes to draw it in, the spool slips under the handle:
      // you wind, and hardly gain. Beaten, rolling on its side, it comes in on any drag.)
      const k = beaten ? 1 : slipK(d, f);
      F.progress += wind * k;
      F.windSlip = k < 1 ? (wind * (1 - k) * Math.max(F.dist, SPAN)) / dt : 0;
      F.stamina -= 0.012 * diff.tire * dt;
    } else {
      F.tension = approach(F.tension, 0.1, 1, 1.4, dt);
      F.stamina += 0.015 * dt;
    }
  }
  // (The slack a charge left is taken up again as it swims off.)
  if (F.move !== 'charge') F.slack = Math.max(0, F.slack - 4 * dt);
  // A headshake: the load snatching up and down several times a second. The rod held low and to
  // one side keeps its head down and smooths it out; rod up and winding, every shake snatches at
  // the line; easing right off, it falls slack between the shakes and can throw the hook.
  if (F.shakeT > 0) {
    F.shakeT -= dt;
    F.shakeClock += dt;
    const A = 0.3 * (1 - 0.75 * Math.min(1, Math.abs(F.side))) * (F.rodHigh ? 1.3 : 1);
    const osc = Math.sin(F.shakeClock * Math.PI * 2 * 4.5);
    const T = Math.max(0, F.tension + A * osc + (held ? A * 0.45 * Math.max(0, osc) : 0));
    F.shakeOff = T - F.tension;
    F.tension = T;
    if (T < 0.1) F.shakeSlack += dt;
    if (F.shakeT <= 0) {
      F.tension -= F.shakeOff;
      F.shakeOff = 0;
      if (F.shakeSlack > 0.12 && rnd() < F.level.throwHook * 1.2 * Math.min(1, F.shakeSlack / 0.4)) {
        F.thrownBy = 'shake';
        return 'off:thrown';
      }
    }
  }
  // A fish that keeps running against the drag takes line past where it was hooked; that has to
  // be won back before it comes any closer, and the spool holds only so much.
  {
    // (The boat closing on it wins that line back as surely as the reel.)
    if (F.chase > 0 && F.extra > 0) F.extra = Math.max(0, F.extra - F.chase * dt);
    // (Reckoned at the reel: a run pours off line, and winding gets it back, at the same pace
    // however far off it was hooked.)
    const span = Math.max(F.dist, SPAN);
    if (F.progress < 0) {
      F.extra += -F.progress * span;
      F.progress = 0;
    } else if (F.extra > 0 && F.progress > p0) {
      const back = Math.min(F.extra, (F.progress - p0) * span);
      F.extra -= back;
      F.progress -= back / span;
    }
    // Out of water to run in (a bank, the shallows): it can go no further, and turns.
    if (F.extra > F.room) {
      F.extra = Math.max(0, F.room);
      if (F.pulling && !F.edged) {
        F.edged = true;
        F.dir = -F.dir;
        F.phaseT = Math.min(F.phaseT, 0.35);
        event = event || 'edge';
      }
    }
    const out = F.dist * (1 - F.progress) + F.extra;
    if (out >= F.spool) return 'snap:spool';
    if (F.spoolWarn < 2 && out > F.spool * (F.spoolWarn ? 0.85 : 0.6)) {
      F.spoolWarn++;
      event = event || 'spool';
    }
  }
  F.stamina = clamp(F.stamina, 0, 1);
  F.progress = clamp(F.progress, 0, 1);
  F.peak = Math.max(F.peak, F.tension);
  // How it's lasting: tiring (its runs shorter), then beaten.
  if (F.stage === 'fresh' && F.stamina < 0.55) {
    F.stage = 'tiring';
    event = event || 'tiring';
  } else if (F.stage === 'tiring' && F.stamina < 0.16) {
    F.stage = 'beaten';
    event = event || 'beaten';
  }

  // A leap: a line left slack while it's in the air lets it throw the hook (on Natural, now and
  // then; on Demanding, often; never on Relaxed).
  if (F.jumping > 0) {
    F.jumping -= dt;
    if (F.tension < 0.16) F.jumpSlack = true;
    if (F.jumping <= 0 && F.jumpSlack && rnd() < F.level.throwHook * 2.2) {
      F.thrownBy = 'leap';
      return 'off:thrown';
    }
  }
  // A light hold tears free under heavy pressure held too long (a drag set tight, or a heavy hand);
  // sooner on braid, which has no stretch to cushion it.
  if (F.hold === 'light' && F.tension > (F.soft ? 0.66 : 0.76)) {
    F.pullT += dt * F.level.pull * (F.soft ? 1.6 : 1) * (F.stretch === 0 ? 1.35 : 1);
    if (F.pullT > 1.4) return 'off:pulled';
  } else F.pullT = Math.max(0, F.pullT - dt);

  // Out at the far end with line pouring off: near weed, roots or rock, it can reach them (a
  // fish that makes for cover sooner, and sooner still on a dive for it). Only line that is light
  // for this fish can't turn it in time; on rock, how the line stands up to it counts as much
  // (braid goes in a moment).
  const rock = F.coverKind === 'rock', wear = rock ? F.abrade : 1, diving = F.pulling && F.move === 'dive';
  if (F.cover && F.coverK > 0 && F.slipping && F.progress < (diving ? 0.3 : 0.1) && F.ratio > diff.light * wear) F.snagT += dt * F.coverK * (diving ? 1.8 : 1);
  else F.snagT = Math.max(0, F.snagT - dt * 0.5);
  if (F.snagT > 3.5 * diff.snag * wear) return rock ? 'snap:rock' : 'snap:snag';

  // Past its rating the line strains, faster the further past; below it, it recovers slowly.
  if (F.tension > 0.97) F.strain += (F.tension - 0.97) / diff.strain * dt;
  else if (F.tension < 0.9) F.strain = Math.max(0, F.strain - 0.1 * dt);
  if (F.strain >= 1) return d >= 0.9 ? 'snap:drag' : 'snap:tension';
  return event;
}

// Advice after a break (or a fish lost), in words. extra: { by (what threw the hook: 'charge',
// 'shake' or 'leap'), loosen (the control that loosens the drag, as the player has it) }.
export function breakReason(cause, sp, rod, extra = {}) {
  const fish = sp.name.toLowerCase();
  switch (cause) {
    case 'thrown':
      if (extra.by === 'charge') return `The ${fish} came straight at you faster than you wound, and on the slack line it turned and threw the hook. When it charges, wind fast to keep the line tight.`;
      if (extra.by === 'shake') return `The ${fish} shook its head at the top while the line went slack, and threw the hook. Keep the rod low and to the side and the line steady when it head-shakes.`;
      return `The ${fish} leapt and shook its head while the line hung slack, and threw the hook. Keep the rod up and the line tight when it jumps: wind down to it.`;
    case 'pulled':
      return `The hook pulled out: it only had a light hold in the ${fish}’s lip, and the pressure stayed too heavy for too long. A lighter drag and a softer touch keep a lightly hooked fish on.`;
    case 'spat':
      return `The ${fish} let go just as you struck, and the hook came back empty. Strike as the float goes under or the line draws tight, not a moment after.`;
    case 'teeth':
      return `The ${fish}’s teeth cut straight through the ${rod.line.name}. Pike need a wire trace: rig one on the spinning rod.`;
    case 'drag':
      return `The line snapped: the drag was locked tight, so it couldn’t give line when the ${fish} ran. Loosen it (${extra.loosen || 'S'} while the fish is on).`;
    case 'spool':
      return `The ${fish} took every metre of line off the reel and broke it at the knot. With the drag that light it ran too far: a click more drag slows a long run, and following it with the boat keeps line on the spool.`;
    case 'lifted':
      return `You tried to lift the ${fish} out on the line, and the hook tore free: a fish that size needs the net. When it’s beaten and alongside, let go of the reel and tap to net it.`;
    case 'kicked':
      return `The ${fish} gave a last kick alongside while you were winding hard, and the hook came out. Let go as it kicks, and net it when it rolls over again.`;
    case 'snag':
      return `The ${fish} ran into the weed and the ${rod.line.name} parted on the stems. Heavier line or a firmer drag would have turned it sooner.`;
    case 'rock':
      return (rod.line.abrade ?? 1) < 1
        ? `The ${fish} got down among the rocks and the ${rod.line.name} chafed through on them: braid cuts on rock in a moment. A fluorocarbon leader stands up to it far better, and side strain keeps a fish out of the rocks.`
        : `The ${fish} got down among the rocks and the line chafed through on them. Turn it sooner (a firmer drag, side strain) before it reaches them.`;
    default:
      return `The line snapped: you kept winding while the ${fish} surged, and it strained past its limit. Watch for the flick on the surface before each run and ease off, or at the latest when the line creaks.`;
  }
}
