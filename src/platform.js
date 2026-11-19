// The trawler's swim platform and her tender (L6 of docs/LIVEABOARD.md): lowering it, launching
// the tender off it, recovering her onto it. Pure: the game (main.js) asks and acts.
//
// The platform goes down travel m in secs, far enough for the tender to float off her chocks, and
// back up; it stops where it is while her mother moves faster than still (dragging, swinging,
// someone at the helm) and carries on when she's steady. While it's down her engine won't go into
// gear. The tender floats off once it's down past float, held by her painter (painter m) to her
// mother's quarter until she's put in gear. Coming back, she's hauled on from within the window:
// near the platform's aft edge, lying across it (her bow to starboard), slowly.
export const PLATFORM = {
  travel: 0.85,   // m it goes down: 0.3 m above the water to 0.55 under
  secs: 15,       // each way
  still: 0.6,     // m/s: her mother moving faster than this, it stops where it is
  float: 0.75,    // how far down (of the way) the tender floats off her chocks
  painter: 3,     // m of painter, her bow to her mother's stern, until she's in gear
  remote: 30,     // m the tender's remote reaches
  haul: 3,        // s to haul her on over the chocks
  window: { d: 2.5, ang: Math.PI / 6, v: 1.0 }, // recovering: how near (m), how square, how slow (m/s)
  sea: 1.2,       // m of sea (crest to trough) past which she isn't launched or recovered
};

// The platform a step on: drop (0 up … 1 down) toward want (0 or 1), unless her mother's moving.
export function stepPlatform(drop, want, dt, speed = 0) {
  if (speed > PLATFORM.still) return drop;
  const k = dt / PLATFORM.secs;
  return want > drop ? Math.min(want, drop + k) : Math.max(want, drop - k);
}

// Whether the tender can be launched off her now: { ok, why }. M: her mother ({ anchored, tie,
// speed, lever }); depth: the water under the platform (m); sea: crest to trough here (m).
export function canLaunch(M, depth, sea) {
  if (!(M.anchored || M.tie || (M.speed < 0.3 && !M.lever))) return { ok: false, why: 'She has to be still: at anchor, tied up, or stopped with her lever in neutral.' };
  if (!(depth > 1.4)) return { ok: false, why: 'Not enough water under her platform to float the tender off.' };
  if (sea > PLATFORM.sea) return { ok: false, why: 'Too much sea running to launch the tender: she’d be thrown against the platform.' };
  return { ok: true };
}

// Whether the tender lies where she can be hauled on: { ok, why, d }. edge: the platform's aft
// edge's middle, in the world ({ x, z }); mh: her mother's heading; T: the tender ({ x, z,
// heading, speed }). Lying across it means her heading a quarter-turn to starboard of her mother's.
export function inWindow(edge, mh, T) {
  const d = Math.hypot(T.x - edge.x, T.z - edge.z);
  const want = mh - Math.PI / 2, off = Math.abs(Math.atan2(Math.sin(T.heading - want), Math.cos(T.heading - want)));
  // (Either way across will do: the game turns her as she's hauled.)
  const square = Math.min(off, Math.PI - off);
  if (d > PLATFORM.window.d) return { ok: false, d, why: 'closer in to the platform' };
  if (square > PLATFORM.window.ang) return { ok: false, d, why: 'lie her across the platform, square to it' };
  if (T.speed > PLATFORM.window.v) return { ok: false, d, why: 'slower' };
  return { ok: true, d };
}

// How the platform is saved: down only with the tender off it (lowering with her still on the
// chocks is kept as up, carried: lowered again next time; raising, likewise).
export const savedDown = (drop, want, carried) => !carried && (want > 0 || drop > 0);
