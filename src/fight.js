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
  // Garfish: skittering, leaping and tail-walking across the top.
  leap: { run: 0.6, rest: 0.7, surge: 0.9, tire: 1.5, sway: 3.2, dive: 0.1, splash: true, words: 'It’s skittering and leaping across the surface.' },
};

const SURGE = 0.5;  // seconds
export const JOLT = [0.2, 0.55]; // the extra load (over the drag) of winding into a surge: base, and per unit of pull
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const approach = (v, target, up, down, dt) => (v < target ? Math.min(target, v + up * dt) : Math.max(target, v - down * dt));

// sp: species, size in cm, rod (with line.kg and power), diff: a DIFFICULTY entry,
// cover: true if the fish was hooked near weed, lilies or roots it could run into.
export function newFight(sp, size, rod, diff, cover = false, rnd = Math.random) {
  const sizeK = clamp((size - sp.size[0]) / Math.max(1, sp.size[1] - sp.size[0]), 0, 1);
  const force = sp.pull * (0.35 + 0.65 * sizeK) * diff.force; // kg, when fresh
  return {
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
    cover,
    teeth: !!sp.life?.teeth && !rod.line.trace,
    time: 0,
    peak: 0,
    strain: 0, // how close the line is to parting from overload (1 = it parts); eases off slowly
  };
}

// Advance the fight by dt seconds. held: the player is winding (holding the reel).
// Returns what happened this step: null, 'warn' (a flick before a run), 'run', or a break:
// 'snap:tension' | 'snap:drag' | 'snap:snag' | 'snap:teeth'.
export function stepFight(F, held, dt, diff, rnd = Math.random) {
  F.time += dt;
  let event = null;
  F.phaseT -= dt;
  if (F.phaseT <= 0) {
    if (F.pulling) {
      F.pulling = false;
      F.warned = false;
      F.phaseT = (1.1 + rnd() * 1.3) * (1 + (1 - F.stamina) * 0.5) * F.style.rest;
    } else {
      F.pulling = true;
      F.surgeT = SURGE;
      F.phaseT = (0.7 + rnd() * 0.7 + F.strength * 0.5) * (0.45 + 0.55 * F.stamina) * F.style.run;
      event = 'run';
      if (F.teeth && rnd() < 0.2 * diff.teeth) return 'snap:teeth';
    }
  }
  if (!F.pulling && !F.warned && F.phaseT < diff.warn) {
    F.warned = true;
    event = 'warn';
  }

  const d = DRAG_LEVELS[F.drag];
  const f = F.ratio * (0.35 + 0.65 * F.stamina); // how hard it pulls right now, against the line
  if (F.pulling) {
    // The first moment of a run is a surge: winding through it jolts the line before the drag
    // can start to slip. Ease off for that moment, then keep the rod up and let the drag work.
    // The jolt builds as the fish gets going (over diff.onset seconds), so letting go just
    // after the run starts is not quite too late; the flick before it gives you time.
    let jolt = 0;
    if (F.surgeT > 0) {
      F.surgeT -= dt;
      const k = clamp((SURGE - F.surgeT) / diff.onset, 0, 1);
      if (held) jolt = (JOLT[0] + JOLT[1] * Math.min(f, 2.2)) * diff.shock * F.style.surge * k * k * (3 - 2 * k);
    }
    const hold = held ? 1 : 0.6; // easing off lowers the rod and lets the drag work sooner
    const target = Math.min(f, d) * hold + jolt;
    // Easing off drops the load at once (the drag slips, the rod straightens); so does the end of a surge.
    F.tension = approach(F.tension, target, jolt ? 7 : 3.5, held ? 2.5 : 5, dt);
    F.slipping = f > d * hold;
    if (F.slipping) {
      // The drag gives line: it gains distance, the more so the harder it outpulls the drag.
      F.progress -= (0.03 + 0.05 * Math.min(f / (d * hold) - 1, 2)) * dt;
    } else if (held) F.progress += F.reel * 0.35 * dt; // it can't take line: you gain a little
    // Fighting the drag tires it, the more so under steady pressure.
    F.stamina -= (0.03 + 0.13 * F.tension) * diff.tire * F.style.tire / Math.max(0.35, F.strength) * dt;
  } else {
    F.slipping = false;
    if (held) {
      F.tension = approach(F.tension, Math.min(0.2 + 0.35 * f, d), 2.5, 1.5, dt);
      F.progress += F.reel * (0.75 + 0.6 * (1 - F.stamina)) * dt;
      F.stamina -= 0.012 * diff.tire * dt;
    } else {
      F.tension = approach(F.tension, 0.1, 1, 1.4, dt);
      F.stamina += 0.015 * dt;
    }
  }
  F.stamina = clamp(F.stamina, 0, 1);
  F.progress = clamp(F.progress, 0, 1);
  F.peak = Math.max(F.peak, F.tension);

  // Out at the far end with line pouring off: near weed or roots, it can reach them.
  // Only line that is light for this fish can't turn it in time.
  if (F.cover && F.slipping && F.progress < 0.1 && F.ratio > diff.light) F.snagT += dt;
  else F.snagT = Math.max(0, F.snagT - dt * 0.5);
  if (F.snagT > 3.5 * diff.snag) return 'snap:snag';

  // Past its rating the line strains, faster the further past; below it, it recovers slowly.
  if (F.tension > 0.97) F.strain += (F.tension - 0.97) / diff.strain * dt;
  else if (F.tension < 0.9) F.strain = Math.max(0, F.strain - 0.1 * dt);
  if (F.strain >= 1) return d >= 0.9 ? 'snap:drag' : 'snap:tension';
  return event;
}

// Advice after a break, in words.
export function breakReason(cause, sp, rod) {
  const fish = sp.name.toLowerCase();
  switch (cause) {
    case 'teeth':
      return `The ${fish}’s teeth cut straight through the ${rod.line.name}. Pike need a wire trace: rig one on the spinning rod.`;
    case 'drag':
      return `The line snapped: the drag was locked tight, so it couldn’t give line when the ${fish} ran. Loosen it (S while the fish is on).`;
    case 'snag':
      return `The ${fish} ran into the weed and the ${rod.line.name} parted on the stems. Heavier line or a firmer drag would have turned it sooner.`;
    default:
      return `The line snapped: you kept winding while the ${fish} surged, and it strained past its limit. Watch for the flick on the surface before each run and ease off, or at the latest when the line creaks.`;
  }
}
