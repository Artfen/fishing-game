// The townsfolk's boats at the helm. townsfolk.js says where each boat should be by the clock (on
// her mooring, out along her route, drifting over a mark); a skipper takes her there the way a
// person at the helm would: following the route, but watching what's ahead, easing off and
// steering round a boat in the way (a moored one, yours under way, another of the harbour's),
// stopping to let it by when there's no room, then catching up and back onto her line. Bumped,
// she's shoved aside and comes back. All of it in the plane of the water: the boat itself is
// drawn riding the waves where the skipper has her (see folk.js).
//
// Every boat here is a capsule: a segment along her centreline (most of her length) and a radius
// (her half-beam and a little room). That's what's kept clear; the hulls themselves touch, and
// bounce, through the boats' own physics (see boat.js, touch).

const TAU = Math.PI * 2;
const wrap = (a) => a - TAU * Math.round(a / TAU);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// The capsule of a boat at (x, z) heading h (radians, 0 along +z), length L, half-beam B: the
// ends of its segment and its radius.
export function capsule(x, z, h, L, B, room = 0.3, out = {}) {
  const fx = Math.sin(h), fz = Math.cos(h), a = L * 0.4;
  out.ax = x - fx * a;
  out.az = z - fz * a;
  out.bx = x + fx * a;
  out.bz = z + fz * a;
  out.r = B + room;
  return out;
}

// The closest the two segments (p0 → p1, q0 → q1) come.
function segDist(p0x, p0z, p1x, p1z, q0x, q0z, q1x, q1z) {
  const ux = p1x - p0x, uz = p1z - p0z, vx = q1x - q0x, vz = q1z - q0z, wx = p0x - q0x, wz = p0z - q0z;
  const a = ux * ux + uz * uz, b = ux * vx + uz * vz, c = vx * vx + vz * vz, d = ux * wx + uz * wz, e = vx * wx + vz * wz;
  const D = a * c - b * b;
  let s, t;
  if (D < 1e-9) {
    s = 0;
    t = c > 1e-9 ? clamp(e / c, 0, 1) : 0;
  } else {
    s = clamp((b * e - c * d) / D, 0, 1);
    t = c > 1e-9 ? (b * s + e) / c : 0;
    if (t < 0) {
      t = 0;
      s = a > 1e-9 ? clamp(-d / a, 0, 1) : 0;
    } else if (t > 1) {
      t = 1;
      s = a > 1e-9 ? clamp((b - d) / a, 0, 1) : 0;
    }
  }
  const dx = wx + ux * s - vx * t, dz = wz + uz * s - vz * t;
  return { d: Math.hypot(dx, dz), nx: dx, nz: dz };
}

// How far apart two capsules are, surface to surface (negative: overlapping), and which way the
// first would go to get clear (nx, nz, unit).
export function gap(A, B) {
  const s = segDist(A.ax, A.az, A.bx, A.bz, B.ax, B.az, B.bx, B.bz);
  const n = s.d || 1;
  return { d: s.d - A.r - B.r, nx: s.d ? s.nx / n : 1, nz: s.d ? s.nz / n : 0 };
}

const LOOK = 7;         // seconds ahead she watches
const STEP = 0.5;       // ... in steps of
const REPLAN = 0.2;     // seconds between looks round
const TRIES = [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8, 1.1, -1.1, 1.5, -1.5, 2, -2];
const _c = {}, _o = {};

export class Skipper {
  // L, B: her length and half-beam (m); draft: how deep she floats (m).
  constructor(L, B, draft = 0.4) {
    this.L = L;
    this.B = B;
    this.draft = draft;
    this.on = false;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.vx = 0;
    this.vz = 0;
    this.px = 0;        // a shove (m/s), dying away
    this.pz = 0;
    this.off = 0;       // how far round from her course she's steering to keep clear (radians)
    this.side = 0;      // ... round which side (+1, −1), kept for a while once chosen
    this.sideT = 0;
    this.slow = 1;      // ... and how much of her speed she's keeping (0: stopped, waiting)
    this.planT = 0;
    this.lag = 0;       // how far behind the clock she's fallen (m)
  }

  // Put her exactly where the clock says.
  snap(S) {
    this.on = true;
    this.sx = S.x;
    this.sz = S.z;
    this.x = S.x;
    this.z = S.z;
    this.heading = S.heading;
    this.speed = S.speed || 0;
    this.vx = Math.sin(S.heading) * this.speed;
    this.vz = Math.cos(S.heading) * this.speed;
    this.px = this.pz = 0;
    this.off = 0;
    this.slow = 1;
    this.lag = 0;
  }

  // One step: S where the clock has her ({ x, z, heading, speed }); others the boats round her
  // ([{ x, z, heading, L, B, vx, vz, m, fixed }]: fixed, one that won't give way at all);
  // ground(x, z) the seabed's height there (or null). seen: whether anyone's near enough to see
  // her (a boat no one's watching that has fallen behind simply catches up at once).
  step(dt, S, others = [], ground = null, seen = true) {
    if (dt <= 0) return this;
    const dx0 = S.x - this.x, dz0 = S.z - this.z, far = Math.hypot(dx0, dz0);
    // (The clock jumping on, a night's sleep, a change of time sweeping past: she's simply where
    // it puts her, not racing there.)
    const jump = this.on ? Math.hypot(S.x - this.sx, S.z - this.sz) : 0;
    this.sx = S.x;
    this.sz = S.z;
    if (!this.on || far > (seen ? 150 : 20) || jump > Math.max(3, (S.speed || 0) * dt * 3)) {
      this.snap(S);
      return this;
    }
    // Going astern (out of a berth: S.astern): her bow kept the way the clock has it, she backs
    // along her line after the clock, eased sideways onto it as on her lines; nothing else.
    if (S.astern) {
      const fx = Math.sin(S.heading), fz = Math.cos(S.heading);
      const behind = -(dx0 * fx + dz0 * fz), side = dx0 * fz - dz0 * fx;
      const turn = wrap(S.heading - this.heading);
      this.heading = wrap(this.heading + clamp(turn, -0.35 * dt, 0.35 * dt));
      const target = -clamp(behind * 0.5, 0, 0.8);
      this.speed += clamp(target - this.speed, -1.4 * dt, 1.4 * dt);
      const k = Math.min(1, dt * 0.8);
      const hx = Math.sin(this.heading), hz = Math.cos(this.heading);
      this.px *= Math.exp(-dt * 1.2);
      this.pz *= Math.exp(-dt * 1.2);
      this.vx = hx * this.speed + this.px;
      this.vz = hz * this.speed + this.pz;
      this.x += this.vx * dt + fz * side * k;
      this.z += this.vz * dt - fx * side * k;
      this.lag = Math.abs(behind);
      return this;
    }
    const moving = (S.speed || 0) > 0.05;
    const sfx = Math.sin(S.heading), sfz = Math.cos(S.heading);
    // Where she's making for: a little way ahead of where the clock has her (so she runs along
    // her line rather than chasing a point), or her berth itself when she's to lie still.
    let aimX = S.x, aimZ = S.z, want;
    if (moving) {
      const lead = this.L * 0.6 + S.speed * 1.5;
      aimX += sfx * lead;
      aimZ += sfz * lead;
      // (Behind the clock, she opens up a little to catch up; ahead of it, she eases off.)
      const behind = dx0 * sfx + dz0 * sfz;
      want = S.speed * clamp(1 + behind / 15, 0.35, 1.6);
      this.lag = Math.max(0, behind);
    } else {
      want = clamp(far * 0.35, 0, 1.6);
      this.lag = far;
    }
    const dax = aimX - this.x, daz = aimZ - this.z;
    let course = far < 0.05 && !moving ? S.heading : Math.atan2(dax, daz);
    // Close by a berth, she comes round to lie as she should.
    if (!moving && far < 2.5) course = S.heading + wrap(course - S.heading) * clamp(far / 2.5, 0, 1);
    // A look round every so often: which way clear of everything near, and how fast.
    this.planT -= dt;
    if (this.planT <= 0) {
      this.planT = REPLAN;
      // (Room to spare out on the water; close in to her berth, only just clear.)
      const room = !moving && far < 8 ? 0.08 : 0.2 + 0.15 * Math.max(want, Math.abs(this.speed));
      this.plan(course, Math.max(want, 0.6), others, ground, moving || far > 8, room);
    }
    let goal = wrap(course + this.off), astern = false;
    // (Just past her berth, or short of it facing away, she goes astern onto it rather than
    // turning right round.)
    if (!moving && far < 6 && Math.abs(wrap(course - this.heading)) > 1.8) {
      astern = true;
      goal = wrap(course + Math.PI);
    }
    // At the helm: round at the rate a boat turns, speed changing as quickly as she can.
    const rate = 0.35 + 0.25 * clamp(Math.abs(this.speed) / 2, 0, 1);
    const turn = wrap(goal - this.heading);
    this.heading = wrap(this.heading + clamp(turn, -rate * dt, rate * dt));
    // (Facing well away from where she wants to go, she slows to come round.)
    const target = astern ? -Math.min(0.6, want) : want * this.slow * (Math.abs(turn) > 1.2 ? 0.4 : 1);
    const acc = Math.abs(target) > Math.abs(this.speed) && target * this.speed >= 0 ? 0.7 : 1.4;
    this.speed += clamp(target - this.speed, -acc * dt, acc * dt);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    // Close by her berth (nothing in her way), she's worked in onto it, as on her lines.
    if (!moving && far < 3.5 && this.slow > 0.5) {
      const k = Math.min(1 - Math.exp(-dt * 0.7), (0.5 * dt) / Math.max(far, 1e-6));
      this.x += dx0 * k;
      this.z += dz0 * k;
      this.speed *= 1 - Math.min(1, dt * 1.5);
    }
    // A shove dies away.
    const kp = Math.exp(-dt * 1.2);
    this.px *= kp;
    this.pz *= kp;
    this.vx = fx * this.speed + this.px;
    this.vz = fz * this.speed + this.pz;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    // Never left lying through another boat: out of it, the most of the way if the other can't
    // give, half if it can (the other boat's own physics takes the rest).
    for (const o of others) {
      if (Math.abs(o.x - this.x) > this.L + o.L || Math.abs(o.z - this.z) > this.L + o.L) continue;
      const g = gap(capsule(this.x, this.z, this.heading, this.L, this.B, 0.05, _c), capsule(o.x, o.z, o.heading, o.L, o.B, 0.05, _o));
      if (g.d >= 0) continue;
      const share = o.fixed ? 1 : clamp((o.m ?? 1000) / ((o.m ?? 1000) + (this.m ?? 1500)), 0.15, 0.85);
      const pen = -g.d * share;
      this.x += g.nx * pen;
      this.z += g.nz * pen;
      // (And the knock: her way into the other boat taken off, a little bounce.)
      const vn = (this.vx - (o.vx || 0)) * g.nx + (this.vz - (o.vz || 0)) * g.nz;
      if (vn < 0) {
        this.px -= g.nx * vn * 1.3 * share;
        this.pz -= g.nz * vn * 1.3 * share;
        this.speed *= 0.6;
      }
    }
    return this;
  }

  // Which way to steer (off her course) and how much speed to keep, to stay clear of everything
  // for the next few seconds: the smallest turn that keeps clear, keeping to the side she's
  // chosen (round a boat one way, not dithering); nothing clear, she stops and waits, turning to
  // the way that will open first.
  plan(course, v, others, ground, watchGround, room) {
    const near = [];
    const reach = v * LOOK + this.L * 2 + 6;
    for (const o of others) if (Math.abs(o.x - this.x) < reach + o.L && Math.abs(o.z - this.z) < reach + o.L) near.push(o);
    let best = null;
    for (const off of TRIES) {
      const h = wrap(course + off);
      const hit = this.clearFor(h, v, near, room);
      const shoal = watchGround && ground ? this.shoal(h, v, ground) : LOOK;
      const until = Math.min(hit, shoal);
      let cost = Math.abs(off) * 1.2 + (LOOK - until) * 3;
      // (Turning away from where she's going only to keep moving is no answer: with no way
      // ahead, she waits.)
      if (Math.abs(off) > 1.2) cost += 8;
      if (this.side && off && Math.sign(off) !== this.side) cost += 4;
      if (!best || cost < best.cost) best = { off, cost, until };
    }
    this.off = best.off;
    if (best.off) {
      this.side = Math.sign(best.off);
      this.sideT = 4;
    } else if ((this.sideT -= REPLAN) <= 0) this.side = 0;
    // Clear only a little way ahead whichever way she turns: slow, or stop and wait for it.
    this.slow = best.until >= LOOK ? 1 : clamp((best.until - 1) / 3, 0, 1);
  }

  // How long she'd stay clear of the boats near her (seconds, LOOK if the whole time), coming
  // round onto heading h at speed v, the others carrying on as they are.
  clearFor(h, v, near, room) {
    if (!near.length) return LOOK;
    let x = this.x, z = this.z, hh = this.heading;
    for (let t = STEP; t <= LOOK; t += STEP) {
      // (Her bow swings round as she goes: half a radian a second.)
      hh = wrap(hh + clamp(wrap(h - hh), -0.5 * STEP, 0.5 * STEP));
      const u = Math.min(v, Math.abs(this.speed) + 0.7 * t);
      x += Math.sin(hh) * u * STEP;
      z += Math.cos(hh) * u * STEP;
      capsule(x, z, hh, this.L, this.B, room, _c);
      for (const o of near) {
        capsule(o.x + (o.vx || 0) * t, o.z + (o.vz || 0) * t, o.heading, o.L, o.B, room, _o);
        if (gap(_c, _o).d < 0) return t - STEP;
      }
    }
    return LOOK;
  }

  // How long before she'd run into water too shallow for her, heading h at speed v.
  shoal(h, v, ground) {
    const fx = Math.sin(h), fz = Math.cos(h), need = -(this.draft + 0.25);
    for (let t = STEP; t <= LOOK; t += STEP) {
      const d = v * t + this.L * 0.5;
      const g = ground(this.x + fx * d, this.z + fz * d);
      if (g != null && g > need) return t - STEP;
    }
    return LOOK;
  }
}
