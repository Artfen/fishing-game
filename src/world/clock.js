import { sunTimes } from './season.js';

// The time of day, and the world's clock when playing together.
//
// Your own clock is state.day and state.hour: it runs while you play (an in-game hour every 40
// real seconds, faster through the night), and everything that's yours keeps time by it: the day
// book, favours, the fish on ice, the market's days.
//
// The world clock is the time everyone sees: the sun and the light, the tide, the season, when the
// fish feed, where the harbour's people are. On your own it is simply your clock. Playing together
// it is the host's (see together.js), so a joiner's evening is the host's evening, while their own
// clock and all their own things carry on beneath it untouched. A change of time (joining, the
// host sleeping the night, leaving again) sweeps past in a few seconds rather than jumping.

export const HOUR_SECONDS = 40; // one in-game hour lasts 40 real seconds
export const NIGHT_RATE = 2.2;  // nights pass faster

// How fast time runs at `abs` (game hours since day 0), in game hours per real second, at `speed`
// (1, or faster: holding T to rest, sitting a while).
export function rateAt(abs, speed = 1) {
  const h = ((abs % 24) + 24) % 24, sun = sunTimes(abs);
  const night = h >= sun.set + 1.5 || h < sun.rise - 0.6;
  return (speed * (night ? NIGHT_RATE : 1)) / HOUR_SECONDS;
}

// Move a clock ({ day, hour }) on by dt real seconds at `speed`. Returns the game hours passed.
export function advance(clock, dt, speed = 1) {
  const hours = dt * rateAt(clock.day * 24 + clock.hour, speed);
  clock.hour += hours;
  while (clock.hour >= 24) {
    clock.hour -= 24;
    clock.day++;
  }
  return hours;
}

const SWEEP = 0.25;   // hours: a change bigger than this sweeps past
const SWEEP_K = 1.6;  // how fast it sweeps (most of the way in about two seconds)
const SETTLE_K = 0.6; // how fast small differences are taken up

export class WorldClock {
  // own: () => your own time (game hours since day 0).
  constructor(own) {
    this.own = own;
    this.shown = null;    // the time shown (null: not yet, or exactly your own)
    this.host = null;     // the host's time, when following: { abs, rate, at } (at: real seconds)
    this.sweeping = false;
    this.last = null;     // the target a moment ago (for how fast it's running)
  }

  get following() { return !!this.host; }
  get abs() { return this.shown ?? this.own(); }
  get day() { return Math.floor(this.abs / 24); }
  get hour() { return this.abs - this.day * 24; }

  // The host said it was `abs` at real time `at`, running at `rate` (game hours per second).
  hear(abs, rate, at) {
    if (!this.host) this.sweeping = true;
    this.host = { abs, rate, at };
  }

  // Back to your own time.
  release() {
    if (this.host) this.sweeping = true;
    this.host = null;
  }

  target(now) {
    const H = this.host;
    return H ? H.abs + H.rate * Math.max(0, now - H.at) : this.own();
  }

  // dt: real seconds since the last frame; now: real time (seconds).
  update(dt, now) {
    const target = this.target(now);
    const last = this.last;
    this.last = target;
    if (!this.host && !this.sweeping) {
      this.shown = null;
      return;
    }
    if (this.shown == null) this.shown = this.own();
    let diff = target - this.shown;
    // (Days apart: the calendar goes at once, and only the hours sweep.)
    if (Math.abs(diff) > 30) {
      this.shown += Math.round(diff / 24) * 24;
      diff = target - this.shown;
    }
    if (Math.abs(diff) > SWEEP) this.sweeping = true;
    // Run on at the target's own pace, and take up the difference: quickly in a sweep, gently
    // otherwise (so a correction from the host never shows).
    // (A step of more than a few minutes in one frame isn't pace: it's a jump, and sweeps.)
    const pace = last != null && dt > 0 && Math.abs(target - last) < 0.1 ? (target - last) : 0;
    const k = this.sweeping ? SWEEP_K : SETTLE_K;
    this.shown += pace + (diff - pace) * (1 - Math.exp(-k * dt));
    if (this.sweeping && Math.abs(target - this.shown) < 0.01) {
      this.sweeping = false;
      if (!this.host) this.shown = null; // (home: your own time exactly, from here on)
    }
  }
}
