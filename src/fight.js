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

// sp: species, size in cm, rod (with line.kg and power, and its flex), diff: a DIFFICULTY entry,
// cover: true if the fish was hooked near weed, lilies or roots it could run into. who: the fish
// itself, { vigour, condition }, how jumpy its kind is, and the Fish behaviour setting's
// { throwHook, pull } (see behaviour.js); all optional.
export function newFight(sp, size, rod, diff, cover = false, rnd = Math.random, who = {}) {
  const sizeK = clamp((size - sp.size[0]) / Math.max(1, sp.size[1] - sp.size[0]), 0, 1);
  const vigour = who.vigour ?? 1;
  const force = sp.pull * (0.35 + 0.65 * sizeK) * diff.force * vigour; // kg, when fresh
  const level = who.level || { throwHook: 0, pull: 0 };
  return {
    vigour,
    endure: (who.condition ?? 1) * vigour,
    jumpy: who.jumpy ?? 0,
    flex: rod.flex ?? 1,
    level,
    // A hook in the scissors holds; one just nicked in the lip has a light hold.
    hold: level.pull > 0 && rnd() < 0.3 ? 'light' : 'solid',
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
    cover,
    teeth: !!sp.life?.teeth && !rod.line.trace,
    time: 0,
    peak: 0,
    strain: 0, // how close the line is to parting from overload (1 = it parts); eases off slowly
  };
}

// Advance the fight by dt seconds. held: the player is winding (holding the reel).
// Returns what happened this step: null, 'warn' (a flick before a run), 'run', 'turn' (it
// changed direction), 'jump', 'tiring', 'beaten', or an end: a break 'snap:tension' |
// 'snap:drag' | 'snap:snag' | 'snap:teeth', or the fish coming off, 'off:thrown' | 'off:pulled'.
export function stepFight(F, held, dt, diff, rnd = Math.random) {
  F.time += dt;
  let event = null;
  F.phaseT -= dt;
  const beaten = F.stage === 'beaten';
  // (A run lasts until a leap in it is back in the water.)
  if (F.phaseT <= 0 && !(F.pulling && (F.jumping > 0 || F.leapIn > 0))) {
    if (F.pulling) {
      F.pulling = false;
      F.warned = false;
      F.leapIn = 0;
      F.phaseT = (1.1 + rnd() * 1.3) * (1 + (1 - F.stamina) * 0.5) * F.style.rest;
    } else {
      F.pulling = true;
      F.surgeT = SURGE;
      F.phaseT = (0.7 + rnd() * 0.7 + F.strength * 0.5) * (0.45 + 0.55 * F.stamina) * F.style.run;
      F.dir = rnd() < 0.5 ? -1 : 1;
      F.turnT = 0.5 + rnd() * 1.2;
      event = 'run';
      if (F.teeth && rnd() < 0.2 * diff.teeth) return 'snap:teeth';
      // Some kinds leap or shake their heads at the top a moment into a run (once the surge
      // has passed, so it's time to be winding again).
      if (!beaten && F.jumpy > 0 && rnd() < F.jumpy * 0.55 * (1 - F.progress * 0.5)) F.leapIn = SURGE + 0.15 + rnd() * 0.5;
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
  // it runs with it, half-hearted once beaten.
  const flowK = 1 + 0.5 * Math.max(0, F.flow) * (F.level.current ?? 1);
  const f = F.ratio * (0.35 + 0.65 * F.stamina) * flowK;
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
      if (held) jolt = (JOLT[0] + JOLT[1] * Math.min(f, 2.2)) * diff.shock * F.style.surge * k * k * (3 - 2 * k) * (0.55 + 0.45 * F.flex);
    }
    const hold = held ? 1 : 0.6; // easing off lowers the rod and lets the drag work sooner
    let target = Math.min(f, d) * hold + jolt + Math.abs(F.side) * 0.05;
    // In the air it isn't pulling: the line falls slack unless you keep winding, rod up.
    const air = F.jumping > 0;
    if (air) target = held ? Math.max(0.24, target * 0.6) : 0.04;
    // Easing off drops the load at once (the drag slips, the rod straightens); so does the end of a surge.
    F.tension = approach(F.tension, target, jolt ? 7 : 3.5, held ? 2.5 : 5, dt);
    F.slipping = !air && f > d * hold;
    if (F.slipping) {
      // The drag gives line: it gains distance, the more so the harder it outpulls the drag.
      F.progress -= (0.03 + 0.05 * Math.min(f / (d * hold) - 1, 2)) * dt;
    } else if (held) F.progress += F.reel * 0.35 * dt * (1 - 0.35 * Math.max(0, F.flow)); // it can't take line: you gain a little
    // Fighting the drag tires it, the more so under steady pressure, from a stiffer rod, and with
    // the rod swung against it; a fish in fine fettle lasts longer.
    F.stamina -= (0.03 + 0.13 * F.tension + 0.05 * against) * diff.tire * F.style.tire * (0.85 + 0.25 * F.flex) / Math.max(0.35, F.strength) / Math.max(0.7, F.endure ?? 1) * dt;
  } else {
    F.slipping = false;
    if (held) {
      F.tension = approach(F.tension, Math.min(0.2 + 0.35 * f, d), 2.5, 1.5, dt);
      F.progress += F.reel * (0.75 + 0.6 * (1 - F.stamina)) * dt * (1 - 0.3 * Math.max(0, F.flow));
      F.stamina -= 0.012 * diff.tire * dt;
    } else {
      F.tension = approach(F.tension, 0.1, 1, 1.4, dt);
      F.stamina += 0.015 * dt;
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
    if (F.jumping <= 0 && F.jumpSlack && rnd() < F.level.throwHook * 2.2) return 'off:thrown';
  }
  // A light hold tears free under heavy pressure held too long (a drag set tight, or a heavy hand).
  if (F.hold === 'light' && F.tension > 0.76) {
    F.pullT += dt * F.level.pull;
    if (F.pullT > 1.4) return 'off:pulled';
  } else F.pullT = Math.max(0, F.pullT - dt);

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

// Advice after a break (or a fish lost), in words.
export function breakReason(cause, sp, rod) {
  const fish = sp.name.toLowerCase();
  switch (cause) {
    case 'thrown':
      return `The ${fish} leapt and shook its head while the line hung slack, and threw the hook. Keep the rod up and the line tight when it jumps: wind down to it.`;
    case 'pulled':
      return `The hook pulled out: it only had a light hold in the ${fish}’s lip, and the pressure stayed too heavy for too long. A lighter drag and a softer touch keep a lightly hooked fish on.`;
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
