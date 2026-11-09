import { clamp, rand, smoothstep, lerp } from './util.js';

// Big fish, big moments: how a hooked fish's fight looks on the water (fishing.js calls these as
// the fight goes; the fight itself is fight.js). The take, a leap clear of the water with the sea
// sheeting off it and its head shaking, the crash back in; a run along the top, the water bulging
// in a V behind it and spray off its back; the line cutting the water as it swings, and lifting
// off it in a line of drops as it comes tight; a swirl where it turns; thrashing alongside at the
// end; the net going in and coming up streaming, or the drips off a fish lifted out. All of it by
// the fish: a mackerel's leap is a flick, a sea bass's a crash, a marlin's a show.
//
// fx: the water effects (effects.js: splash, spray, ripple, flash, field), audio (splashSmall,
// splashBig), hooks (shake: the camera, feel: the controller). None of it changes the fight.

// How big a fish is, for the show: its length against a sixty-centimetre fish (a big sea bass).
export const bigness = (size) => clamp(size / 60, 0.3, 5);

// How each kind leaps: how far out of the water (in body lengths, roughly), and whether it
// tail-walks (stands on its tail skittering across the top) and greyhounds (a run of leaps, one
// after another). By fight style; billfish the most.
const LEAP_STYLES = {
  leap: { clear: 1.0, shake: 0.5 },
  billfish: { clear: 0.75, shake: 0.6, tailwalk: true, greyhound: 3 },
  dash: { clear: 0.8, shake: 0.35 },
  thrash: { clear: 0.55, shake: 0.7 },
  blister: { clear: 0.7, shake: 0.2, greyhound: 1 },
  deep: { clear: 0.5, shake: 0.2 },
};
export const leapStyle = (sp) => LEAP_STYLES[sp.fight] || { clear: 0.5, shake: 0.4 };

// How high its middle goes above the water in a leap (m): enough for most of the body to clear,
// more for the kinds that really leap, and for a fresh, big one.
export function leapHeight(sp, size, sizeK = 0.5) {
  const L = size / 100, S = leapStyle(sp);
  return clamp(L * (0.5 + S.clear * (0.55 + 0.45 * sizeK)) + 0.12, 0.25, 3.6);
}

export class FightShow {
  constructor(fx, audio, hooks = {}) {
    this.fx = fx;
    this.audio = audio;
    this.hooks = hooks;
    this.drips = [];     // things dripping: { at() (a world point, or null when done), t, n }
    this.lineWas = null; // where the line went into the water last frame
    this.wakeT = 0;
    this.sliceT = 0;
    this.thrashT = 0;
    this.prev = null;
  }

  // A fresh fight: forget the last one's state.
  begin() {
    this.lineWas = null;
    this.prev = null;
    this.wakeT = this.sliceT = this.thrashT = 0;
  }

  // The take. p: where it took (the hook); lv: the water's level there; surface: taken at or near
  // the top (a lure, a fly, a fish up in the water) rather than down deep.
  strike(F, p, lv, surface) {
    const S = bigness(F.size), fx = this.fx;
    if (surface) {
      // At the top: the water erupts where it hit, a boil spreading round it.
      fx.splash(p.x, lv + 0.05, p.z, Math.round(12 + 16 * S), 1.6 + 0.6 * S, 0.7 + 0.35 * S);
      for (let i = 0; i < Math.round(6 + 10 * S); i++) {
        const a = rand(0, Math.PI * 2), v = rand(1, 2.2) * Math.sqrt(S);
        fx.spray(p.x, lv + 0.05, p.z, Math.cos(a) * v, rand(1.5, 3) * Math.sqrt(S), Math.sin(a) * v, lv - 0.1);
      }
      fx.flash?.(p.x, p.z, 0.8 * S, 0);
      fx.ripple(p.x, p.z, 1.6 + 0.8 * S, 1.5, 0.65);
      if (S > 1.3) this.audio.splashBig?.();
    } else {
      // Down deep: a bulge and a swirl on the top as it turns away with it.
      fx.ripple(p.x, p.z, 1.0 + 0.5 * S, 1.6, 0.35);
      fx.ripple(p.x + rand(-0.4, 0.4), p.z + rand(-0.4, 0.4), 0.7 + 0.3 * S, 1.2, 0.25);
    }
    if (fx.field?.on) fx.field.add(p.x, p.z, 1.2 + 0.8 * S, 1.6, surface ? 0.6 : 0.3);
  }

  // A leap under way (F.leapT counting down from dur): where its middle is (y), and how it lies
  // (pitch: nose up +, roll, yaw: a headshake), from where it would be in the water (y0) and the
  // water's level (lv). Throws the water off it as it goes up, and crashes it back in at the end.
  // Billfish stand on their tails in the middle of it, skittering, and greyhound on: a skip or
  // two more after it's back in (only to look at: the fight's own leap is the first).
  leap(F, dt, t, x, y0, z, lv, dur = 0.75) {
    const S = bigness(F.size), st = leapStyle(F.sp), H = leapHeight(F.sp, F.size, F.sizeK);
    const out = { y: y0, pitch: 0, roll: 0, yaw: 0, airborne: false };
    if (F.leapT > 0) {
      const was = F.leapT;
      F.leapT -= dt;
      const u = 1 - clamp(F.leapT / dur, 0, 1);
      let h = Math.sin(u * Math.PI) * H, pitch = lerp(1.0, -1.0, u);
      // (Tail-walking: up quick, then stood on its tail across the top, then down.)
      if (st.tailwalk && S > 1) {
        const stand = smoothstep(0.18, 0.3, u) * (1 - smoothstep(0.62, 0.75, u));
        h = lerp(h, Math.max(h * 0.55, (F.size / 100) * 0.45), stand);
        pitch = lerp(pitch, 1.35, stand);
        if (stand > 0.5) {
          this.walkT = (this.walkT ?? 0) - dt;
          if (this.walkT <= 0) {
            this.walkT = 0.06;
            this.fx.splash(x, lv + 0.02, z, Math.round(Math.min(10, 4 + 3 * S)), 1.2 + 0.3 * S, 0.5);
            this.fx.ripple(x, z, 0.5 + 0.2 * S, 0.8, 0.35);
          }
        }
      }
      out.y = Math.max(y0, lv + h - 0.15);
      out.pitch = pitch;
      // Its head shaking, its gills rattling, in the air.
      const air = Math.sin(u * Math.PI);
      out.yaw = Math.sin(t * 24) * 0.35 * st.shake * air;
      out.roll = Math.sin(t * 17 + 1) * 0.25 * st.shake * air;
      out.airborne = out.y > lv;
      // The sea streaming off it as it climbs.
      if (u < 0.55 && out.airborne) {
        const n = Math.min(6, Math.round(1 + 2.5 * S * (1 - u * 1.6)));
        for (let i = 0; i < n; i++) this.fx.spray(x + rand(-0.15, 0.15) * S, out.y + rand(-0.2, 0.1) * S, z + rand(-0.15, 0.15) * S, rand(-0.6, 0.6), rand(-0.5, 0.6), rand(-0.6, 0.6), lv - 0.1);
      }
      if (F.leapT <= 0 && was > 0) {
        this.reentry(x, z, lv, S);
        // Greyhounding: on again, lower each time.
        if (st.greyhound && S > 0.9) F.skips = Math.min(st.greyhound, (F.skips ?? 0) + st.greyhound) || 0;
        F.skipN = 0;
      }
      return out;
    }
    // A skip after a leap (greyhounding), while it's still up near the top.
    if (F.skips > 0 && F.stage !== 'beaten' && y0 > lv - 1.2) {
      F.skipT = (F.skipT ?? 0) + dt;
      const sd = 0.5, u = F.skipT / sd, Hs = H * (0.6 - 0.12 * (F.skipN ?? 0));
      if (u < 1) {
        out.y = Math.max(y0, lv + Math.sin(u * Math.PI) * Hs - 0.15);
        out.pitch = lerp(0.8, -0.8, u);
        out.airborne = out.y > lv;
        return out;
      }
      this.reentry(x, z, lv, S * 0.75);
      F.skips--;
      F.skipN = (F.skipN ?? 0) + 1;
      F.skipT = 0;
    } else if (F.skips > 0) F.skips = 0;
    return out;
  }

  // Off the water: the spray it throws up as it goes.
  takeOff(F, p, lv) {
    const S = bigness(F.size);
    this.fx.splash(p.x, lv + 0.05, p.z, Math.round(10 + 14 * S), 1.6 + 0.6 * S, 0.6 + 0.3 * S);
    this.fx.ripple(p.x, p.z, 1.0 + 0.6 * S, 1.2, 0.55);
  }

  // Back in, with a crash: the splash, a crown of water thrown out low all round, the rings, the
  // white water, the sound; a big one close by, you feel it.
  reentry(x, z, lv, S) {
    const fx = this.fx;
    fx.splash(x, lv + 0.05, z, Math.round(Math.min(90, 14 + 28 * S)), 1.8 + 0.7 * S, 0.8 + 0.4 * S);
    const crown = Math.round(Math.min(48, 10 + 14 * S));
    for (let i = 0; i < crown; i++) {
      const a = (i / crown) * Math.PI * 2 + rand(-0.15, 0.15), v = rand(1.4, 2.6) * Math.sqrt(S);
      fx.spray(x + Math.cos(a) * 0.2 * S, lv + 0.05, z + Math.sin(a) * 0.2 * S, Math.cos(a) * v, rand(1.4, 2.4) * Math.sqrt(S), Math.sin(a) * v, lv - 0.1);
    }
    fx.ripple(x, z, 1.6 + 0.9 * S, 1.8, 0.7);
    fx.ripple(x, z, 0.8 + 0.4 * S, 1.0, 0.5);
    fx.flash?.(x, z, 0.9 * S, 0);
    if (fx.field?.on) fx.field.add(x, z, 1.4 + 1.0 * S, 2.0, Math.min(1, 0.45 + 0.15 * S));
    if (S > 1.3) this.audio.splashBig?.();
    else this.audio.splashSmall?.(1 + 0.3 * S);
    if (S > 1.2) this.hooks.shake?.(Math.min(0.22, 0.05 * S));
  }

  // Each frame of the fight: a run along the top (the V of water behind it, spray off its back),
  // a swirl where it turns, the line cutting the water, and thrashing alongside. p: where it is;
  // lv: the water's level there; ev: what the fight said this step; line: the line's points (a
  // flat array, from the rod tip out) and how many; waterAt(x, z): the water's level anywhere;
  // near: how far it is from you (m).
  frame(F, dt, t, p, lv, { ev = null, line = null, n = 0, waterAt = null, near = 99 } = {}) {
    const S = bigness(F.size), fx = this.fx;
    const prev = this.prev;
    this.prev = { x: p.x, z: p.z };
    const v = prev && dt > 0 ? Math.hypot(p.x - prev.x, p.z - prev.z) / dt : 0;
    const depth = lv - p.y;
    // A run along the top: the water bulging in a V behind it; fast and right at the top, spray off
    // its back.
    if (F.pulling && v > 1.2 && v < 30 && depth < 0.9 + 0.2 * S) {
      this.wakeT -= dt;
      if (this.wakeT <= 0 && prev) {
        this.wakeT = 0.07;
        const dx = (p.x - prev.x) / (v * dt), dz = (p.z - prev.z) / (v * dt), w = 0.25 + 0.15 * S;
        for (const sd of [1, -1]) fx.ripple(p.x - dx * 0.4 * S + dz * w * sd, p.z - dz * 0.4 * S - dx * w * sd, 0.45 + 0.3 * S, 0.9, 0.3);
        if (fx.field?.on) fx.field.add(p.x, p.z, 0.8 + 0.5 * S, 1.2, 0.3);
      }
      if (depth < 0.4 && v > 2.2) {
        const k = Math.min(4, Math.round((v - 2) * S));
        for (let i = 0; i < k; i++) fx.spray(p.x, lv + 0.03, p.z, rand(-1, 1) - (p.x - prev.x) / dt * 0.15, rand(0.8, 1.8), rand(-1, 1) - (p.z - prev.z) / dt * 0.15, lv - 0.1);
      }
    }
    // A swirl where it turns, near the top.
    if ((ev === 'turn' || ev === 'edge' || ev === 'turned') && depth < 1.5) {
      fx.ripple(p.x, p.z, 1.0 + 0.6 * S, 1.4, 0.45);
      fx.ripple(p.x + rand(-0.3, 0.3) * S, p.z + rand(-0.3, 0.3) * S, 0.6 + 0.4 * S, 1.0, 0.3);
      fx.flash?.(p.x, p.z, 0.5 * S, depth);
    }
    // The line: where it goes into the water, cutting through it as the fish swings about (spray
    // off it, a thin trail), and lifting off the top in a line of drops when it snaps tight.
    if (line && n > 2 && waterAt) {
      let entry = null;
      for (let i = 1; i < n; i++) {
        const o = i * 3, wy = waterAt(line[o], line[o + 2]);
        if (line[o + 1] <= wy) {
          const a = (i - 1) * 3, wa = waterAt(line[a], line[a + 2]), ya = line[a + 1] - wa, yb = line[o + 1] - wy, k = ya / Math.max(1e-4, ya - yb);
          entry = { x: lerp(line[a], line[o], k), z: lerp(line[a + 2], line[o + 2], k), y: lerp(wa, wy, k) };
          break;
        }
      }
      if (entry && this.lineWas && F.tension > 0.3) {
        const ex = entry.x - this.lineWas.x, ez = entry.z - this.lineWas.z, ve = Math.hypot(ex, ez) / Math.max(dt, 1e-3);
        if (ve > 1.1 && ve < 25) {
          const k = Math.min(5, Math.round((ve - 1) * 1.5 * (0.5 + F.tension)));
          for (let i = 0; i < k; i++) fx.spray(entry.x, entry.y + 0.02, entry.z, (ex / Math.max(dt, 1e-3)) * 0.35 + rand(-0.3, 0.3), rand(1, 2.2), (ez / Math.max(dt, 1e-3)) * 0.35 + rand(-0.3, 0.3), entry.y - 0.1);
          this.sliceT -= dt;
          if (this.sliceT <= 0) {
            this.sliceT = 0.06;
            fx.ripple(entry.x, entry.z, 0.3, 0.6, 0.3);
          }
        }
      }
      this.lineWas = entry;
      // (Coming tight with a surge: the line lifts off the top along its length.)
      if (ev === 'run' || ev === 'longrun' || ev === 'dive' || ev === 'lastdash') {
        for (let i = 1; i < n; i++) {
          const o = i * 3, wy = waterAt(line[o], line[o + 2]), d = line[o + 1] - wy;
          if (d > -0.25 && d < 0.2) fx.spray(line[o], wy + 0.02, line[o + 2], rand(-0.2, 0.2), rand(0.8, 1.6), rand(-0.2, 0.2), wy - 0.1);
        }
      }
    }
    // Close in and still full of fight (or kicking at the net): thrashing at the top, the tail
    // slapping the water.
    const kicking = F.atNet ? (F.kick ?? 0) > 0.3 : F.pulling || F.shakeT > 0;
    if (near < 6 && depth < 0.7 && kicking && F.stage !== 'beaten') {
      this.thrashT -= dt;
      if (this.thrashT <= 0) {
        this.thrashT = rand(0.12, 0.26);
        fx.splash(p.x, lv + 0.05, p.z, Math.round(5 + 8 * S), 1.3 + 0.4 * S, 0.5 + 0.2 * S);
        fx.ripple(p.x, p.z, 0.7 + 0.4 * S, 0.9, 0.4);
        this.audio.splashSmall?.(0.6 + 0.3 * S);
      }
    }
  }

  // Landed: out of the water with a splash (a big one if it's big), into the net or lifted out on
  // the line. at(): where the net, or the fish, is now (a world point), for the water pouring off
  // it as it comes up.
  landed(F, p, lv, netted, at) {
    const S = bigness(F.size), fx = this.fx;
    fx.splash(p.x, lv + 0.05, p.z, Math.round(Math.min(80, 16 + 20 * S)), 2.0 + 0.5 * S, 0.8 + 0.3 * S);
    fx.ripple(p.x, p.z, 1.8 + 0.7 * S, 1.6, 0.6);
    if (netted) fx.ripple(p.x, p.z, 1.0 + 0.4 * S, 1.0, 0.5);
    if (fx.field?.on) fx.field.add(p.x, p.z, 1.2 + 0.6 * S, 1.6, 0.5);
    if (at) this.drips.push({ at, t: netted ? 1.1 : 1.3, n: netted ? 3 + Math.round(2 * S) : 1 + Math.round(S), lv });
  }

  // The water still running off whatever's dripping.
  update(dt) {
    for (const d of this.drips) {
      d.t -= dt;
      const p = d.at?.();
      if (!p || d.t <= 0) continue;
      const k = Math.ceil(d.n * Math.min(1, d.t));
      for (let i = 0; i < k; i++) this.fx.spray(p.x + rand(-0.18, 0.18), p.y - 0.05, p.z + rand(-0.18, 0.18), rand(-0.2, 0.2), rand(-0.6, 0), rand(-0.2, 0.2), d.lv - 0.1);
    }
    this.drips = this.drips.filter((d) => d.t > 0);
  }
}
