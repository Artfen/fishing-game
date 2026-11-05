// Feeling the game through the controller. Slow Tide is meant to be played on one, and a lot of
// what happens reaches you through your hands before your eyes: the engine's beat through the
// hull, the starter turning her over, a sea slamming under the bow, a knock against a pier, the
// tap of a bite, the hook going home, a fish running and the drag buzzing as it gives line.
//
// Two kinds of feeling, mixed together:
// - steady ones (`hold`): the engine, the weight of a fish on the line, the drag slipping, the
//   starter cranking. The game sets each one every frame it's going on, and it fades out by
//   itself if the game stops setting it (nothing is ever left buzzing).
// - short ones (`pulse`): a bite, the hook-set, a slam, a knock, a jump, the line parting, a fish
//   in the net. Each has its own strength and length, and fades as it ends.
//
// A controller has two motors: a heavy, slow one (strong: the thump, the weight) and a light,
// quick one (weak: the buzz, the tick). Xbox controllers also have a motor in each trigger, which
// some browsers can reach: the reel trigger (RT) then carries the fish itself, its weight and the
// drag's buzz. Nothing in the game depends on any of this; with vibration off, or a controller
// that can't, everything plays the same.
//
// Everything here is plain numbers; `out` is whatever plays them (see Gamepads.feel).

// The Vibration setting: how strongly it's all felt.
export const STRENGTHS = { off: 0, light: 0.55, normal: 1, strong: 1.45 };
export const STRENGTH_IDS = Object.keys(STRENGTHS);

// The short ones. strong / weak: the two motors (0–1); rt / lt: the triggers; ms: how long;
// shape: 'thump' starts hard and fades, 'swell' builds and fades, 'flat' holds then stops.
export const PULSES = {
  // Fishing
  cast:     { strong: 0,    weak: 0.32, ms: 90,  shape: 'thump' },              // the line whipping off
  plop:     { strong: 0,    weak: 0.14, ms: 60,  shape: 'thump' },              // the lure or float landing
  nibble:   { strong: 0.05, weak: 0.3,  ms: 70,  shape: 'thump', rt: 0.25 },    // a touch at the bait
  bleep:    { strong: 0,    weak: 0.22, ms: 60,  shape: 'thump' },              // the bite alarm's single bleep
  bite:     { strong: 0.45, weak: 0.5,  ms: 140, shape: 'thump', rt: 0.6 },     // the float goes under, the tip pulls round
  strike:   { strong: 0.85, weak: 0.55, ms: 170, shape: 'thump', rt: 0.9 },     // a predator hits the lure
  hookset:  { strong: 1,    weak: 0.55, ms: 230, shape: 'thump', rt: 1 },       // the hook goes home
  warn:     { strong: 0.12, weak: 0.35, ms: 80,  shape: 'thump' },              // the flick before a run
  run:      { strong: 0.65, weak: 0.3,  ms: 260, shape: 'thump', rt: 0.8 },     // it's off on a run
  turn:     { strong: 0.3,  weak: 0.2,  ms: 120, shape: 'thump', rt: 0.4 },     // it changes direction
  jump:     { strong: 0.7,  weak: 0.75, ms: 200, shape: 'thump' },              // out of the water, shaking
  headshake:{ strong: 0.4,  weak: 0.5,  ms: 110, shape: 'thump', rt: 0.5 },
  creak:    { strong: 0.2,  weak: 0.6,  ms: 120, shape: 'flat',  rt: 0.7 },     // the line at its limit
  snap:     { strong: 1,    weak: 1,    ms: 110, shape: 'flat',  rt: 1 },       // and then nothing
  lost:     { strong: 0.3,  weak: 0.15, ms: 140, shape: 'thump' },              // the hook comes out
  netted:   { strong: 0.6,  weak: 0.25, ms: 260, shape: 'swell' },              // in the net
  landed:   { strong: 0.35, weak: 0.2,  ms: 180, shape: 'thump' },              // swung in, lifted out
  kick:     { strong: 0.5,  weak: 0.4,  ms: 140, shape: 'thump', rt: 0.5 },     // the last kick alongside
  // Boats
  catch:    { strong: 0.75, weak: 0.4,  ms: 260, shape: 'thump' },              // the engine fires
  stall:    { strong: 0.5,  weak: 0.2,  ms: 380, shape: 'swell' },              // and dies
  gear:     { strong: 0.25, weak: 0.15, ms: 90,  shape: 'thump' },              // clunk into gear
  notch:    { strong: 0,    weak: 0.16, ms: 40,  shape: 'thump' },              // the lever clicking into a notch
  detent:   { strong: 0.1,  weak: 0.22, ms: 60,  shape: 'thump' },              // the lever's neutral detent
  switch:   { strong: 0,    weak: 0.2,  ms: 45,  shape: 'thump' },              // a switch on the panel
  // The world
  thunder:  { strong: 0.55, weak: 0.1,  ms: 1400, shape: 'swell' },
  step:     { strong: 0.08, weak: 0,    ms: 50,  shape: 'thump' },              // stepping aboard
};

// The steady ones, and how fast each one dies away once the game stops setting it (per second).
const FADE = { engine: 6, line: 10, drag: 14, crank: 14, hull: 6, trolling: 6 };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const or = (a, b) => 1 - (1 - a) * (1 - b); // two feelings together: more than either, never past 1

export class Haptics {
  // out(strong, weak, lt, rt, ms): plays a mix; out(0, 0, 0, 0, 0) stops.
  constructor(out = null) {
    this.out = out;
    this.strength = 1;
    this.pulses = [];
    this.steady = new Map();  // name → { strong, weak, lt, rt, buzz, age }
    this.t = 0;
    this.sentT = -1;
    this.sent = { strong: 0, weak: 0, lt: 0, rt: 0 };
    this.mix = { strong: 0, weak: 0, lt: 0, rt: 0 };
    this.live = true;         // false while paused, in a menu, or not on the controller
  }

  setStrength(id) { this.strength = STRENGTHS[id] ?? (typeof id === 'number' ? id : 1); }

  // A short feeling: a name in PULSES, scaled by k (a knock's force, a slam's size), or a recipe.
  pulse(name, k = 1) {
    const P = typeof name === 'string' ? PULSES[name] : name;
    if (!P || !(k > 0) || !this.strength) return;
    if (this.pulses.length > 12) this.pulses.shift();
    this.pulses.push({ ...P, k: clamp(k, 0, 1.5), age: 0, ms: P.ms ?? 120 });
  }

  // A steady feeling, for this frame. buzz (Hz): a rough, rattling texture (the starter, the
  // drag's ratchet) rather than a smooth hum.
  hold(name, strong = 0, weak = 0, { lt = 0, rt = 0, buzz = 0 } = {}) {
    const s = this.steady.get(name);
    if (s) Object.assign(s, { strong, weak, lt, rt, buzz, age: 0 });
    else this.steady.set(name, { strong, weak, lt, rt, buzz, age: 0, phase: 0 });
  }

  // Everything stops at once (a menu opened, the game paused, the controller put down).
  silence() {
    this.pulses.length = 0;
    this.steady.clear();
    this.mix = { strong: 0, weak: 0, lt: 0, rt: 0 };
    if (this.sent.strong || this.sent.weak || this.sent.lt || this.sent.rt) {
      this.sent = { strong: 0, weak: 0, lt: 0, rt: 0 };
      this.out?.(0, 0, 0, 0, 0);
    }
  }

  // The mix as it is now (before the strength setting).
  feel() {
    let strong = 0, weak = 0, lt = 0, rt = 0;
    for (const p of this.pulses) {
      const u = clamp(p.age / (p.ms / 1000), 0, 1);
      const env = p.shape === 'flat' ? (u < 1 ? 1 : 0) : p.shape === 'swell' ? Math.sin(Math.PI * u) : (1 - u) * (1 - u);
      const a = env * p.k;
      strong = or(strong, clamp((p.strong || 0) * a, 0, 1));
      weak = or(weak, clamp((p.weak || 0) * a, 0, 1));
      lt = or(lt, clamp((p.lt || 0) * a, 0, 1));
      rt = or(rt, clamp((p.rt || 0) * a, 0, 1));
    }
    for (const s of this.steady.values()) {
      const fade = Math.exp(-s.age * (s.fadeK ?? 8));
      // (A buzz: on and off, like the teeth of a ratchet or a starter turning the engine over; a few
      // to a dozen or so times a second, which is as quick as a controller's motors can follow.)
      const tex = s.buzz ? 0.35 + 0.65 * (Math.sin(s.phase) > 0 ? 1 : 0) : 1;
      strong = or(strong, clamp(s.strong * fade * tex, 0, 1));
      weak = or(weak, clamp(s.weak * fade * tex, 0, 1));
      lt = or(lt, clamp(s.lt * fade * tex, 0, 1));
      rt = or(rt, clamp(s.rt * fade * tex, 0, 1));
    }
    return { strong, weak, lt, rt };
  }

  // Once a frame: age everything, mix it, and send it on when it has changed (or is about to
  // run out). The effect sent lasts a little longer than the gap before the next, so a steady
  // feeling never stutters.
  update(dt) {
    this.t += dt;
    for (const p of this.pulses) p.age += dt;
    this.pulses = this.pulses.filter((p) => p.age < p.ms / 1000);
    let textured = false;
    for (const [name, s] of this.steady) {
      s.age += dt;
      s.fadeK = FADE[name] ?? 8;
      if (s.buzz) {
        s.phase += 2 * Math.PI * s.buzz * dt;
        textured = true;
      }
      if (s.age > 0.6) this.steady.delete(name);
    }
    if (!this.live || !this.strength) {
      this.silence();
      return null;
    }
    const m = this.feel(), k = this.strength;
    const mix = { strong: clamp(m.strong * k, 0, 1), weak: clamp(m.weak * k, 0, 1), lt: clamp(m.lt * k, 0, 1), rt: clamp(m.rt * k, 0, 1) };
    this.mix = mix;
    const any = mix.strong > 0.01 || mix.weak > 0.01 || mix.lt > 0.01 || mix.rt > 0.01;
    const was = this.sent.strong > 0.01 || this.sent.weak > 0.01 || this.sent.lt > 0.01 || this.sent.rt > 0.01;
    const since = this.t - this.sentT;
    const changed = Math.max(Math.abs(mix.strong - this.sent.strong), Math.abs(mix.weak - this.sent.weak), Math.abs(mix.lt - this.sent.lt), Math.abs(mix.rt - this.sent.rt));
    // (A rattle needs sending quickly to be felt as one; a smooth hum only now and then.)
    const gap = textured ? 1 / 60 : 1 / 20;
    if (!any) {
      if (was) {
        this.sent = { strong: 0, weak: 0, lt: 0, rt: 0 };
        this.sentT = this.t;
        this.out?.(0, 0, 0, 0, 0);
        return this.sent;
      }
      return null;
    }
    if ((changed > 0.03 && since >= gap) || since >= 0.09 || !was) {
      this.sent = mix;
      this.sentT = this.t;
      this.out?.(mix.strong, mix.weak, mix.lt, mix.rt, 140);
      return mix;
    }
    return null;
  }
}

// The engine through the hull: a faint beat at idle, building with the revs (0–1), heavier on
// the big inboards, a light buzz from an electric motor.
export function engineFeel(rpm, { inboard = false, electric = false, jet = false, running = true } = {}) {
  if (!running) return { strong: 0, weak: 0 };
  const r = clamp(rpm, 0, 1);
  if (electric) return { strong: 0, weak: 0.03 + 0.05 * r };
  if (inboard) return { strong: 0.06 + 0.16 * r, weak: 0.03 + 0.08 * r };
  if (jet) return { strong: 0.02 + 0.08 * r, weak: 0.05 + 0.2 * r };
  return { strong: 0.03 + 0.11 * r, weak: 0.05 + 0.17 * r };
}

// A fish on: its weight on the line (tension: 1 is the breaking strain) felt in the heavy motor
// and the reel trigger, and the drag's buzz while it slips, faster the harder it's taking line.
export function lineFeel(tension, slipping = false, pull = 0) {
  const T = clamp(tension, 0, 1.2);
  const weight = { strong: 0.06 + 0.42 * T * T, weak: 0.02 + 0.1 * T, rt: 0.08 + 0.55 * T };
  const drag = slipping ? { weak: 0.3 + 0.35 * clamp(pull, 0, 1), rt: 0.35 + 0.4 * clamp(pull, 0, 1), buzz: 8 + 8 * clamp(pull, 0, 1) } : null;
  return { weight, drag };
}

// A sea meeting the hull: slam is how hard she's coming down into it (m/s), as Boat.slam.
export function slamFeel(slam) {
  return clamp((slam - 1.2) / 2.8, 0, 1);
}

// A knock against a pier, a boat or the bottom: v is how hard (m/s into it), as Boat.onBump.
export function knockFeel(v) {
  return clamp(v / 3, 0.35, 1.2);
}
