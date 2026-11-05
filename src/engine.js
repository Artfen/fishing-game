// Engines that start like engines, as plain numbers (no graphics or sound: the game listens for
// what happens and shows it, plays it, and lets you feel it).
//
// Each motorboat has its own engine room (PROFILES): an outboard on the RIB, the bass boat, the
// cabin boat and the centre console (two of them); twin diesels in the yacht; a pull-started
// tiller outboard on the skiff and the sailing boat; a jet ski's button start. The kayak's
// electric motor, the oars, the sails and the windsurf board have nothing to start.
//
// What there is to do, depending on the boat:
//   - the battery switch: on, or nothing turns over;
//   - the kill cord: clipped on, or the engine won't start (and unclipped, it stops);
//   - neutral: the starter won't turn with her in gear;
//   - the key: on (the gauges wake and the alarm sounds its self-test), then turned and held to
//     start; or a starter button; or the cord of a pull-start, pulled;
//   - the diesels' glow plugs: a few seconds' preheat before a cold start;
//   - trim and tilt: the leg of a powered outboard in and out while she runs, and right up out of
//     the water at rest (see TRIM).
// Once she's running she idles, the revs follow the throttle, the battery charges and water
// comes out of the telltale; with the cooling intake out of the water she overheats, the alarm
// goes, and an overheated engine runs on but only gently (it never just stops you dead). With
// the tank dry she coughs and stalls.
//
// How much of this you do is the Start-up setting (START_MODES): all of it, one button that runs
// the same steps for you (assist), or none (get in and go: she's running when you take the helm).
// A failed start is never the end of a trip: a flat battery has the outboard's emergency rope or
// the house battery, and every refusal says why.

export const START_MODES = {
  full: { id: 'full', name: 'Full procedure', desc: 'You do it all: the battery switch, the kill cord, neutral, the key (and the diesels’ glow plugs), then trim the leg as she gets going. The helm panel (the engine key) has every switch; Assisted start on it runs the same steps for you.' },
  simple: { id: 'simple', name: 'One-button start', desc: 'One press of the engine key runs the start-up for you, step by step (switch on, cord on, neutral, key, start), and another stops her. Trim the leg yourself as she gets going.' },
  go: { id: 'go', name: 'Get in and go', desc: 'The engine is running as soon as you take the helm, and stops when you leave it. She trims herself.' },
};
export const START_IDS = Object.keys(START_MODES);

// drive: what pushes her; engines: how many; starter: 'key' (turned and held), 'button' or
// 'pull' (a pull-start cord); battery: a battery switch; cord: a kill cord; trim: 'power' (power
// trim and tilt), 'tilt' (tilted up by hand at rest), or null; diesel: glow plugs to preheat;
// idle / max: revs; cooling: 'telltale' (an outboard's stream), 'alarm' (an inboard's water-flow
// alarm), or null.
export const PROFILES = {
  skiff: { drive: 'outboard', engines: 1, starter: 'pull', battery: false, cord: true, trim: 'tilt', idle: 950, max: 5600, cooling: 'telltale', name: 'outboard' },
  sail: { drive: 'outboard', engines: 1, starter: 'pull', battery: false, cord: true, trim: null, idle: 1100, max: 5500, cooling: 'telltale', name: 'outboard' },
  bass: { drive: 'outboard', engines: 1, starter: 'key', battery: true, cord: true, trim: 'power', idle: 700, max: 5800, cooling: 'telltale', name: 'outboard' },
  cabin: { drive: 'outboard', engines: 1, starter: 'key', battery: true, cord: true, trim: 'power', idle: 750, max: 5500, cooling: 'telltale', name: 'outboard' },
  console: { drive: 'outboard', engines: 2, starter: 'key', battery: true, cord: true, trim: 'power', idle: 700, max: 6000, cooling: 'telltale', name: 'outboards' },
  rib: { drive: 'outboard', engines: 1, starter: 'key', battery: true, cord: true, trim: 'power', idle: 700, max: 6000, cooling: 'telltale', name: 'outboard' },
  cruiser: { drive: 'inboard', engines: 2, starter: 'key', battery: true, cord: false, trim: null, diesel: true, idle: 650, max: 3200, cooling: 'alarm', name: 'diesels' },
  jetski: { drive: 'jet', engines: 1, starter: 'button', battery: false, cord: true, trim: null, idle: 1600, max: 7500, cooling: null, name: 'engine' },
};
export const profileOf = (kind) => PROFILES[kind] || null;
export const hasEngine = (kind) => !!PROFILES[kind];

// Trim and tilt, as the leg's angle (degrees): in to TRIM.min (bow down, onto the plane sooner),
// out to TRIM.max (bow up, quicker at speed, until the propeller starts to draw air); beyond that
// the leg tilts on up (TRIM.shallow: still pushing, gently, for creeping over shallows; TRIM.out:
// the propeller's out of the water) to TRIM.up, which only works at rest or near it.
export const TRIM = { min: -4, max: 16, shallow: 26, out: 36, up: 65 };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

// A fresh engine room, everything off and cold.
export function newEngine(kind) {
  const P = PROFILES[kind];
  if (!P) return null;
  return {
    kind,
    battery: !P.battery,        // (no switch: always live)
    cord: !P.cord,              // (no kill cord: nothing to clip on)
    key: false,                 // the ignition on (the gauges awake)
    charge: 1,                  // the starting battery, 0–1
    glow: 0,                    // the diesels' glow plugs, 0–1 (1: ready)
    glowing: 0,                 // seconds of preheat still to go
    warm: 0,                    // how warm the engine is, 0–1 (a warm one starts easily)
    temp: 0,                    // 0 cool … 1 overheated
    trim: 0,                    // the leg's angle (degrees, see TRIM)
    pulls: 0,                   // pulls of the cord since she last ran
    engines: Array.from({ length: P.engines }, () => ({ run: false, crank: 0, need: 0, rpm: 0 })),
    auto: null,                 // the assisted start, under way: { steps, t }
  };
}

// What's kept in the save: the switches and the battery (an engine left on is off again next time).
export function engineSave(E) {
  return E ? { battery: E.battery, cord: E.cord, charge: Math.round(E.charge * 1000) / 1000, trim: Math.round(E.trim * 10) / 10 } : null;
}
export function cleanEngine(kind, raw) {
  const E = newEngine(kind);
  if (!E || !raw || typeof raw !== 'object') return E;
  const P = PROFILES[kind];
  if (P.battery) E.battery = raw.battery === true;
  if (P.cord) E.cord = raw.cord === true;
  E.charge = Number.isFinite(raw.charge) ? clamp(raw.charge, 0, 1) : 1;
  E.trim = Number.isFinite(raw.trim) ? clamp(raw.trim, TRIM.min, P.trim === 'power' || P.trim === 'tilt' ? TRIM.up : 0) : 0;
  return E;
}

export const running = (E) => !!E && E.engines.some((e) => e.run);
export const allRunning = (E) => !!E && E.engines.every((e) => e.run);
export const cranking = (E) => !!E && E.engines.some((e) => e.crank > 0);
// The share of her push there is: one of twin engines running gives half; overheated, gently.
export function runShare(E) {
  if (!E) return 1;
  const n = E.engines.filter((e) => e.run).length / E.engines.length;
  return n * (E.temp >= 1 ? 0.3 : 1);
}

// What's stopping her starting, as the first thing to put right (null: ready), in words.
// ctx: { lever (the throttle), fuel (litres in the tank) }
export function blocker(E, ctx = {}) {
  const P = PROFILES[E.kind];
  if (P.battery && !E.battery) return { id: 'battery', text: 'The battery switch is off' };
  if (P.cord && !E.cord) return { id: 'cord', text: 'The kill cord isn’t clipped on' };
  if (ctx.lever) return { id: 'neutral', text: 'She’s in gear: the starter only turns in neutral' };
  if (P.starter === 'key' && !E.key) return { id: 'key', text: 'The key is off' };
  if (P.starter !== 'pull' && E.charge < 0.12) return { id: 'flat', text: 'The battery is flat: the starter only clicks' };
  return null;
}

// The checklist for the helm panel: each step, whether it's done.
export function checklist(E, ctx = {}) {
  const P = PROFILES[E.kind], out = [];
  if (P.battery) out.push({ id: 'battery', text: 'Battery switch on', ok: E.battery });
  if (P.cord) out.push({ id: 'cord', text: 'Kill cord clipped on', ok: E.cord });
  out.push({ id: 'neutral', text: 'In neutral', ok: !ctx.lever });
  if (P.starter === 'key') out.push({ id: 'key', text: 'Key on', ok: E.key });
  if (P.diesel) out.push({ id: 'glow', text: 'Glow plugs warmed', ok: E.glow >= 1 || E.warm > 0.5 });
  out.push({ id: 'start', text: P.starter === 'pull' ? 'Pull the cord' : P.engines > 1 ? 'Start both engines' : 'Start', ok: allRunning(E) });
  return out;
}

// Do something at the helm. Returns { ok, events, why }: events for the game to show and play
// ('switch', 'selftest', 'crank', 'pull', 'catch', 'stop', 'glow', 'refuse', ...).
// which: an engine's index (twin engines), or null for all of them.
export function act(E, action, ctx = {}, which = null, rnd = Math.random) {
  const P = PROFILES[E.kind], ev = [];
  const done = (ok, why = null) => ({ ok, events: ev, why });
  const list = which == null ? E.engines : [E.engines[which]].filter(Boolean);
  switch (action) {
    case 'battery':
      if (!P.battery) return done(false, 'She has no battery switch');
      if (E.battery && running(E)) return done(false, 'Not with the engine running: switch off first');
      E.battery = !E.battery;
      if (!E.battery) E.key = false;
      ev.push('switch');
      return done(true);
    case 'cord':
      if (!P.cord) return done(false, 'She has no kill cord');
      E.cord = !E.cord;
      ev.push('switch');
      if (!E.cord && running(E)) {
        for (const e of E.engines) stopOne(e);
        ev.push('stop', 'cordStop');
      }
      return done(true);
    case 'key':
      if (P.starter !== 'key') return done(false, 'She has no key');
      if (!E.key && P.battery && !E.battery) return done(false, 'The battery switch is off: nothing happens');
      E.key = !E.key;
      ev.push('switch');
      if (E.key) ev.push('selftest');
      else if (running(E)) {
        for (const e of E.engines) stopOne(e);
        ev.push('stop');
      }
      return done(true);
    case 'glow':
      if (!P.diesel) return done(false, 'She has no glow plugs');
      if (!E.key) return done(false, 'The key is off');
      E.glowing = 3;
      ev.push('glow');
      return done(true);
    case 'start': {
      if (P.starter === 'pull') return act(E, 'pull', ctx, which, rnd);
      const b = blocker(E, ctx);
      if (b) {
        ev.push(b.id === 'flat' ? 'click' : 'refuse');
        return done(false, b.text);
      }
      let any = false;
      for (const e of list) {
        if (e.run || e.crank > 0) continue;
        e.crank = 1e-6;
        e.need = catchTime(E, ctx, rnd);
        any = true;
      }
      if (any) ev.push('crank');
      return done(any, any ? null : 'Already running');
    }
    case 'pull': {
      if (P.starter !== 'pull') return done(false, 'She has no pull-start');
      const b = blocker(E, ctx);
      if (b) {
        ev.push('refuse');
        return done(false, b.text);
      }
      const e = list[0];
      if (e.run) return done(false, 'Already running');
      ev.push('pull');
      E.pulls++;
      // (Warm, she goes first pull; cold, it can take two or three, never more.)
      const chance = ctx.fuel <= 0 ? 0 : E.warm > 0.4 ? 0.9 : [0.45, 0.75, 1][Math.min(2, E.pulls - 1)];
      if (rnd() < chance) {
        e.run = true;
        e.rpm = P.idle * 1.3;
        E.pulls = 0;
        ev.push('catch');
      } else if (ctx.fuel <= 0) ev.push('dry');
      return done(true);
    }
    case 'stop': {
      const was = list.some((e) => e.run || e.crank > 0);
      for (const e of list) stopOne(e);
      if (which == null && P.starter === 'key') E.key = false;
      if (was) ev.push('stop');
      E.auto = null;
      return done(was);
    }
    default:
      return done(false, 'Nothing to do');
  }
}

function stopOne(e) {
  e.run = false;
  e.crank = 0;
}

// How long the starter has to turn her over before she catches (seconds): quickly when warm,
// longer cold, and a cold diesel without its preheat takes a good while.
function catchTime(E, ctx, rnd) {
  const P = PROFILES[E.kind];
  let t = E.warm > 0.4 ? 0.45 : 0.9;
  if (P.diesel && E.glow < 1 && E.warm <= 0.5) t += 2.2;
  return t + rnd() * 0.5;
}

// The one-button start: the same steps, done for you one after another (each a moment apart,
// so the panel and the sounds show them), then the start itself.
export function assist(E, ctx = {}) {
  const P = PROFILES[E.kind], steps = [];
  if (P.battery && !E.battery) steps.push('battery');
  if (P.cord && !E.cord) steps.push('cord');
  if (ctx.lever) steps.push('neutral');
  if (P.starter === 'key' && !E.key) steps.push('key');
  if (P.diesel && E.glow < 1 && E.warm <= 0.5) steps.push('glow');
  steps.push('start');
  E.auto = { steps: [...steps], t: 0.25 };
  return steps;
}

// Once a frame. ctx: { lever, power (what the motor's giving, -1 … 1), opening (0–1: how far the
// throttle's open, as the lever travel: see throttle.js), fuel (litres), wet (the cooling intake in
// the water), speed (m/s) }. Returns the events of this step ('catch', 'stall', 'hot', 'cool',
// 'flat', 'nocatch', and the assisted start's own steps as it does them: { step }).
export function stepEngine(E, dt, ctx = {}, rnd = Math.random) {
  const P = PROFILES[E.kind], ev = [];
  // The assisted start, one step at a time.
  if (E.auto) {
    E.auto.t -= dt;
    if (E.auto.t <= 0 && !cranking(E) && !(P.diesel && E.glowing > 0)) {
      const s = E.auto.steps.shift();
      if (!s) E.auto = null;
      else {
        E.auto.t = s === 'glow' ? 0.2 : 0.45;
        if (s === 'neutral') ev.push({ step: 'neutral' });
        else {
          const r = act(E, s, { ...ctx, lever: s === 'start' ? 0 : ctx.lever }, null, rnd);
          ev.push({ step: s, ok: r.ok, why: r.why }, ...r.events);
          if (!r.ok && s !== 'start') E.auto = null;
        }
        if (s === 'start') E.auto = null;
      }
    }
  }
  // Glow plugs warming.
  // (Warmed, the plugs stay ready for half a minute or so, then cool again.)
  if (E.glowing > 0) {
    E.glowing -= dt;
    E.glow = clamp(E.glow + dt / 3, 0, 1);
    if (E.glowing <= 0) {
      E.glow = 1;
      E.glowHold = 30;
      ev.push('glowed');
    }
  } else if (!running(E)) {
    E.glowHold = (E.glowHold || 0) - dt;
    if (E.glowHold <= 0) E.glow = Math.max(0, E.glow - dt / 20);
  }
  for (const e of E.engines) {
    if (e.crank > 0) {
      e.crank += dt;
      E.charge = Math.max(0, E.charge - 0.035 * dt);
      if (E.charge < 0.08) {
        e.crank = 0;
        ev.push('flat');
      } else if (ctx.fuel <= 0 && e.crank > 2.5) {
        e.crank = 0;
        ev.push('dry');
      } else if (ctx.fuel > 0 && e.crank >= e.need) {
        e.crank = 0;
        e.run = true;
        e.rpm = P.idle * 1.35;
        ev.push('catch');
      }
    }
    if (e.run) {
      if (ctx.fuel <= 0) {
        stopOne(e);
        ev.push('stall');
        continue;
      }
      if ((P.cord && !E.cord) || (P.starter === 'key' && !E.key)) {
        stopOne(e);
        ev.push('stop');
        continue;
      }
      // The revs: idle in neutral, following the throttle; a propeller drawing air (trimmed too
      // far out at speed, or the leg up) races.
      const vent = ventilation(E, ctx.speed || 0);
      const open = clamp(ctx.opening ?? Math.abs(ctx.power || 0), 0, 1);
      const want = P.idle + (P.max - P.idle) * Math.pow(open, 0.85) * (1 + 0.12 * vent) * (E.temp >= 1 ? 0.55 : 1);
      e.rpm += (Math.min(P.max * 1.08, want) - e.rpm) * Math.min(1, dt * 2.5);
    } else e.rpm += (0 - e.rpm) * Math.min(1, dt * 4);
  }
  const on = running(E);
  if (on) {
    E.warm = Math.min(1, E.warm + dt / 90);
    if (P.battery || P.starter === 'key') E.charge = Math.min(1, E.charge + 0.012 * dt);
  } else E.warm = Math.max(0, E.warm - dt / 900);
  // Cooling: water through the engine while the intake's in the water; without it she heats up.
  const before = E.temp;
  if (on && P.cooling && ctx.wet === false) E.temp = Math.min(1, E.temp + dt / 22);
  else E.temp = Math.max(0, E.temp - dt / (on ? 30 : 15));
  if (before < 0.6 && E.temp >= 0.6) ev.push('hot');
  if (before >= 0.6 && E.temp < 0.6) ev.push('cool');
  return ev;
}

// The engine's revs (the fastest-turning one), and as a share of its range for the sound.
export const rpmOf = (E) => (E ? Math.max(0, ...E.engines.map((e) => e.rpm)) : 0);
export function revs(E) {
  const P = PROFILES[E?.kind];
  if (!P || !running(E)) return 0;
  return clamp((rpmOf(E) - P.idle * 0.7) / (P.max - P.idle * 0.7), 0, 1);
}

/* ---------------- trim and tilt ---------------- */

// The best trim for her speed (degrees): right in to get her up onto the plane, out a few degrees
// once she's flying.
export function bestTrim(speed) {
  return TRIM.min + (6 - TRIM.min) * smooth(3, 12, Math.abs(speed));
}

// The trim switch held up (dir 1) or down (-1) for dt. The leg trims at a few degrees a second,
// and tilts up beyond the trim range only when she's slow (as a real power trim does). Returns
// what stopped it, if anything ('limit', 'fast').
export function trimBy(E, dir, dt, speed = 0) {
  const P = PROFILES[E.kind];
  if (!P?.trim || !dir) return null;
  const tiltOnly = P.trim === 'tilt';
  const top = tiltOnly || Math.abs(speed) < 2.5 ? TRIM.up : TRIM.max;
  const lo = tiltOnly ? 0 : TRIM.min;
  const rate = E.trim > TRIM.max || tiltOnly ? 22 : 6;
  const want = E.trim + dir * rate * dt;
  if (want > top) {
    E.trim = Math.max(E.trim, Math.min(want, top));
    return top === TRIM.max && Math.abs(speed) >= 2.5 ? 'fast' : 'limit';
  }
  if (want < lo) {
    E.trim = lo;
    return 'limit';
  }
  E.trim = want;
  return null;
}

// How far into the air the propeller is drawing (0–1): trimmed past about 12° at planing speed it
// starts to slip and race; tilted up into the shallow-water range it's half out.
export function ventilation(E, speed = 0) {
  if (!E) return 0;
  const fast = smooth(6, 14, Math.abs(speed));
  return clamp(smooth(12, 18, E.trim) * fast + smooth(TRIM.max, TRIM.out, E.trim), 0, 1);
}

// What the leg's angle does to her (for the physics: see Boat): auto (no trim set: she's always
// trimmed right, as the game has always driven her). Returns { err: degrees from the best trim
// (tips her thrust and so her bow), eff: what share of the propeller's push she gets, out: the
// propeller is out of the water, wet: the cooling intake is in the water, angle: the leg's angle }.
export function trimEffect(E, speed = 0, auto = false) {
  const P = PROFILES[E?.kind];
  if (!P || P.trim !== 'power' && P.trim !== 'tilt') return { err: 0, eff: 1, out: false, wet: true, angle: 0 };
  const best = bestTrim(speed);
  const angle = auto ? Math.min(E.trim > TRIM.max ? E.trim : best, TRIM.up) : E.trim;
  if (angle >= TRIM.out) return { err: 0, eff: 0, out: true, wet: false, angle };
  const shallow = smooth(TRIM.max, TRIM.out, angle);
  // (A tiller outboard's trim is a pin, set right for her: only its tilt changes anything.)
  const err = auto || angle > TRIM.max || P.trim === 'tilt' ? 0 : clamp(angle - best, -12, 12);
  const planing = smooth(4, 10, Math.abs(speed));
  const eff = (1 - 0.0028 * err * err * planing) * (1 - 0.55 * smooth(12, 18, angle) * smooth(6, 14, Math.abs(speed))) * (1 - 0.65 * shallow);
  return { err, eff: clamp(eff, 0, 1), out: false, wet: angle < TRIM.shallow + 4, angle };
}
