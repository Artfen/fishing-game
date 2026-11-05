// Expert technique: the rod in your hands, as plain numbers (see fishing.js and fight.js for what
// the line, the lure and the fish make of it).
//
// On the Assisted technique (the default) a lure is worked with a few clear controls: hold to
// reel at a chosen speed, tap to twitch, let go to pause; a fish is struck with a press. Expert
// (Settings → Controls → Technique) puts the rod itself in your hands: on a controller the right
// stick holds the rod (up lifts it, down drops it, across sweeps it to the side) and the right
// trigger is the reel, as hard as you squeeze it; on a keyboard, forward and back lift and drop
// the rod and the reel key winds at an even pace.
//
// Nothing here is a second set of fish or a second lure: the rod only moves the same lure (pulls
// it through the water, gives it slack to fall, twitches it), sets the same hook and loads the same
// line, so what an Expert angler catches is decided by the same fish as anyone's. Better technique
// shows as better presentation and fewer fish lost, never as more bites from nowhere.

export const TECHNIQUES = {
  assisted: { id: 'assisted', name: 'Assisted', desc: 'Hold to reel at your chosen speed, tap to twitch, let go to pause; press to strike. The rod looks after itself.' },
  expert: { id: 'expert', name: 'Expert', desc: 'The rod is in your hands (the right stick: up lifts, down drops, across sweeps), the reel is the right trigger. Lift to work a jig, snap down to pop a popper, sweep side to side to walk a stick bait, sweep up hard to set the hook, and pump a big fish in: lift, then wind down as you lower the rod. Readouts show the lure’s depth and speed and the line’s load.' },
};
export const TECHNIQUE_IDS = Object.keys(TECHNIQUES);

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

// How far the rod tip travels for its whole sweep from low to high (m): about a 2.4 m rod.
export const TIP_TRAVEL = 2.2;
// The rod at rest, held a little above the line.
export const REST = 0.35;

export const newRod = () => ({ pitch: REST, yaw: 0, vPitch: 0, vYaw: 0, lastSide: 0, sideT: 9, walks: 0 });

// The rod follows the stick: stick up lifts it (to 1, high), down drops it (to 0, pointing down the
// line), across sweeps it (yaw -1 … 1). up, across: -1 … 1. Returns R with its rates (per second).
export function rodStep(R, up, across, dt) {
  const want = up >= 0 ? REST + (1 - REST) * up : REST * (1 + up);
  const k = Math.min(1, dt * 16);
  const p = R.pitch + (want - R.pitch) * k, y = R.yaw + (clamp(across, -1, 1) - R.yaw) * k;
  const vp = dt > 0 ? (p - R.pitch) / dt : 0, vy = dt > 0 ? (y - R.yaw) / dt : 0;
  // (The rates smoothed a touch, so one frame's jump doesn't count as a flick.)
  R.vPitch = R.vPitch * 0.4 + vp * 0.6;
  R.vYaw = R.vYaw * 0.4 + vy * 0.6;
  R.pitch = p;
  R.yaw = y;
  R.sideT += dt;
  return R;
}

// What the rod just did to the lure, for its kind of action (the lure's `action`, or 'jig' for a
// jig, 'float' for a float), over dt: { pull (m drawn towards you through the water), slack (m
// given), twitch (0–1.5: a sharp movement the fish see), pop (a popper's spit and gulp), walk (-1,
// 0, 1: a stick bait's step to one side), rhythm (0–1: how even the walking has been) }.
export function lureFromRod(act, R, dt) {
  const lift = Math.max(0, R.vPitch), drop = Math.max(0, -R.vPitch);
  const out = { pull: lift * TIP_TRAVEL * dt, slack: drop * TIP_TRAVEL * dt, twitch: 0, pop: false, walk: 0, rhythm: 0 };
  const snap = Math.abs(R.vPitch), sweep = Math.abs(R.vYaw);
  if (snap > 4) out.twitch = clamp(snap / 6, 0.6, 1.5);
  if (act === 'pop' && R.vPitch < -4.5) {
    // A popper: a short sharp snap downwards makes it spit and gulp.
    out.pop = true;
    out.pull = Math.max(out.pull, 0.25);
  }
  if (act === 'walk' && sweep > 5 && R.sideT > 0.18) {
    // A stick bait: each sideways flick turns its head the other way; even flicks walk the dog.
    const side = Math.sign(R.vYaw);
    if (side !== R.lastSide) {
      const even = R.sideT > 0.25 && R.sideT < 0.8;
      R.walks = even ? Math.min(6, R.walks + 1) : 0;
      R.lastSide = side;
      R.sideT = 0;
      out.walk = side;
      out.twitch = Math.max(out.twitch, 0.8);
      out.pull = Math.max(out.pull, 0.18);
    }
  }
  if (R.sideT > 1.2) R.walks = 0;
  out.rhythm = R.walks / 6;
  return out;
}

// A strike: the rod swept up hard as the fish takes. Returns 0 (not a strike) to 1 (a firm, fast
// sweep that drives the hook home).
export function strikeFrom(R) {
  return smooth(2, 6, R.vPitch);
}

// How a strike sets the hook (the hold: 'solid' or 'light', see fight.js): a firm sweep makes a
// light hold solid more often than not; a feeble one can leave a solid hold light. rnd: 0–1.
export function holdAfterStrike(hold, quality, rnd) {
  if (hold === 'light' && quality > 0.55 && rnd < quality * 0.8) return 'solid';
  if (hold === 'solid' && quality < 0.25 && rnd < (0.25 - quality) * 2) return 'light';
  return hold;
}

// Playing a fish with the rod: { pump (line gained a second: lifting the rod while it isn't
// running draws it towards you, to be wound back on the drop), load (extra tension the lift puts on
// the line), cushion (how much of a surge reaches the line: a raised rod bends and soaks it up, a
// rod pointed at the fish passes it straight on), high (the rod held right up over a fish close in:
// high-sticking, the rod's tip taking all the strain) }.
export function fightFromRod(R, { running = false, near = false } = {}) {
  const lift = Math.max(0, R.vPitch);
  return {
    pump: running ? 0 : lift * 0.05,
    load: lift * 0.2,
    cushion: 1.25 - 0.55 * R.pitch,
    high: near && R.pitch > 0.92,
  };
}
