import * as THREE from 'three';
import { PIERS } from './terrain.js';

// Wakes: the waves a boat makes as she goes. Every boat under way leaves a Kelvin wake behind
// her, the pattern any ship makes in deep water: inside a wedge 19.5° either side of her track,
// the feathered divergent waves angling out from her bow and stern, the transverse waves square
// across her track behind her, the two meeting in a line of bigger, steeper crests along the
// wedge's edge (the cusps). It's worked out where the waves are from where she went: each point
// of her track remembers when she passed it and how fast she was going, and the waves she made
// there go on spreading out as they age, whatever she does after; on a turn they fan out round
// the curve. How big they are follows her weight and how fine her hull is, and her speed: biggest
// as she pushes a hump of water around her at about her hull speed, smaller once she's planing,
// and nothing much at a crawl. They lift and rock any other boat they reach (sample, for the
// physics: see boat.js), and they're drawn on the water (the ripple field: see waterfx.js).
// (Stationary-phase theory of the Kelvin pattern; the heights scaled from measured small-craft
// wakes, a few centimetres for a kayak, half a metre or more for a big boat pushing hard.)

const G = 9.81;
const CUSP = Math.asin(1 / 3); // the wedge's half-angle: 19.47°
const STEP = 0.8;      // metres between remembered points of a track
const MAX_AGE = 40;    // seconds a wake lasts
const MAX_POINTS = 120; // per track
const FAR = 140;       // how far behind (m) a wake is still worth drawing
const DECAY = 30;      // seconds for a wake's waves to die down by e (beyond their spreading)

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A boat's wake height scale (m: the crest amplitude a boat's length out, on the wedge's line)
// for her weight (kg), length (m), how fine she is (length over the cube root of her displaced
// volume) and speed (m/s).
export function wakeScale(mass, L, fine, U) {
  const fn = U / Math.sqrt(G * L);
  const hump = smooth(0.12, 0.42, fn) * (1 - 0.55 * smooth(0.7, 1.6, fn));
  const slim = Math.min(1.3, Math.max(0.2, (5 / fine) ** 2));
  return 0.5 * 0.23 * Math.cbrt(mass / 1000) * hump * slim;
}

// The wake's height at a point x metres behind where she was (along her track: her speed there
// times the time since), y across it (m), for a boat of length L going at U m/s with a scale a0
// (wakeScale), age seconds on. out (optional): { h, vy } added to.
export function kelvin(x, y, U, a0, L, age, out = null) {
  if (U < 0.4 || x <= 0.05 || a0 <= 0) return 0;
  const ay = Math.abs(y), th = Math.atan2(ay, x);
  if (th >= CUSP + 0.025) return 0;
  const r = Math.hypot(x, ay);
  const fade = smooth(CUSP + 0.025, CUSP - 0.015, th) * smooth(0, 0.6 * L, x) * smooth(FAR, FAR * 0.75, x) * Math.exp(-age / DECAY);
  if (fade <= 0) return 0;
  const tt = Math.max(1e-5, Math.tan(Math.min(th, CUSP - 1e-4)));
  const disc = Math.sqrt(Math.max(0, 1 - 8 * tt * tt));
  const t1 = (2 * tt) / (1 + disc), t2 = (1 + disc) / (4 * tt); // tan ψ: transverse, divergent
  const fn = U / Math.sqrt(G * L), u2 = U * U;
  // (A fast boat's wake looks narrower than the Kelvin wedge: its biggest waves lie at an angle
  // that closes in as she speeds up, about 0.4/Fr radians past a Froude number of one or so,
  // the wedge's edge itself left faint. Rabaud & Moisy, 2013.)
  const peak = Math.min(CUSP, 0.4 / fn), narrow = peak < CUSP - 0.005;
  const cusp = 1 + 0.8 * Math.exp(-(((CUSP - th) / 0.035) ** 2)) * smooth(CUSP * 0.8, CUSP, peak);
  const lean = narrow ? 0.25 + 0.75 * Math.exp(-(((th - peak) / (0.45 * peak)) ** 2)) : 1;
  const q = L / (r + L);
  let h = 0, vy = 0;
  // The transverse waves (long, square across her track; faint once she's planing).
  const aT = a0 * 0.7 * (1 - smooth(0.6, 1.2, fn)) * Math.sqrt(q) * cusp * fade;
  if (aT > 1e-5) {
    const kx = (G * Math.sqrt(1 + t1 * t1)) / u2;
    const ph = kx * (x + ay * t1);
    h += aT * Math.cos(ph);
    vy -= aT * Math.sin(ph) * kx * U;
  }
  // The divergent waves (shorter, angling out; the shortest, close in along her track, too small
  // to matter).
  // (They're strongest out towards the wedge's edges, faint close in along her track.)
  const kx2 = (G * Math.sqrt(1 + t2 * t2)) / u2, k2 = kx2 * Math.sqrt(1 + t2 * t2);
  const aD = a0 * Math.cbrt(q) * cusp * fade * smooth(12, 4, k2) * (0.2 + 0.8 * smooth(0.25, 0.9, th / peak)) * lean;
  if (aD > 1e-5) {
    const ph = kx2 * (x + ay * t2);
    h += aD * Math.cos(ph);
    vy -= aD * Math.sin(ph) * kx2 * U;
  }
  if (out) {
    out.h += h;
    out.vy += vy;
  }
  return h;
}

// The water heaped up round a hull as she goes (the near field of her wake): a bow wave rising
// from her stem and running back along both sides as two arms, a trough along her sides
// amidships, and at displacement speeds a stern wave rising behind her transom. u along her
// (+ towards the bow) and v across, metres from her middle; L her length, B her half-beam, U her
// speed. Biggest about her hull speed; a planing boat lifts clear of most of it. Inside her own
// footprint, nothing (she's there). Returns the height (m); foam (optional out) the white water
// at the foot of a fast boat's bow wave.
export function hullWave(u, v, L, B, U, out = null) {
  if (U < 0.5) return 0;
  const fn = U / Math.sqrt(G * L), av = Math.abs(v);
  const hb = Math.min((0.35 * U * U) / (2 * G), 0.06 * L) * (1 - 0.6 * smooth(0.9, 2, fn)) * smooth(0.08, 0.3, fn);
  const r = (2 * u) / L, inside = Math.abs(r) < 1 && av < B * Math.sqrt(Math.max(0, 1 - r * r)) * (r > 0 ? 1 - 0.35 * r : 1);
  if (inside || hb <= 1e-4) return 0;
  const ca = Math.cos(0.5), sa = Math.sin(0.5), wu = u - L / 2;
  const sAlong = -wu * ca + av * sa, e = wu * sa + av * ca, wb = 0.1 * L + 0.15 * Math.max(0, sAlong);
  const arm = Math.exp(-((e / wb) ** 2)) * Math.exp(-Math.max(0, sAlong) / (0.9 * L)) * smooth(-0.2 * L, 0.1 * L, sAlong);
  const trough = -0.55 * Math.exp(-((u / (0.35 * L)) ** 2)) * Math.exp(-(((av - B) / (0.4 * B + 0.25)) ** 2));
  const stern = 0.5 * (1 - smooth(0.7, 1.3, fn)) * Math.exp(-(((u + 0.75 * L) / (0.22 * L)) ** 2)) * Math.exp(-((v / (B + 0.4)) ** 2));
  if (out) out.foam = smooth(4, 9, U) * smooth(0.04, 0.15, hb) * Math.exp(-((e / (0.6 * wb)) ** 2)) * Math.exp(-Math.max(0, sAlong) / (0.35 * L));
  return hb * (arm + trough + stern);
}

// The same, for the ripple field's shader (per pixel of a track's ribbon).
const KELVIN_GLSL = /* glsl */ `
float kelvinH(float x, float y, float U, float a0, float L, float age) {
  if (U < 0.4 || x <= 0.05 || a0 <= 0.0) return 0.0;
  float ay = abs(y), th = atan(ay, x);
  const float CUSP = ${CUSP.toFixed(6)};
  if (th >= CUSP + 0.025) return 0.0;
  float r = length(vec2(x, ay));
  float fade = smoothstep(CUSP + 0.025, CUSP - 0.015, th) * smoothstep(0.0, 0.6 * L, x) * smoothstep(${FAR.toFixed(1)}, ${(FAR * 0.75).toFixed(1)}, x) * exp(-age / ${DECAY.toFixed(1)});
  float tt = max(1e-5, tan(min(th, CUSP - 1e-4)));
  float disc = sqrt(max(0.0, 1.0 - 8.0 * tt * tt));
  float t1 = 2.0 * tt / (1.0 + disc), t2 = (1.0 + disc) / (4.0 * tt);
  float fn = U / sqrt(${G} * L), u2 = U * U;
  float peak = min(CUSP, 0.4 / fn);
  float cusp = 1.0 + 0.8 * exp(-pow((CUSP - th) / 0.035, 2.0)) * smoothstep(CUSP * 0.8, CUSP, peak);
  float lean = peak < CUSP - 0.005 ? 0.25 + 0.75 * exp(-pow((th - peak) / (0.45 * peak), 2.0)) : 1.0;
  float q = L / (r + L);
  float aT = a0 * 0.7 * (1.0 - smoothstep(0.6, 1.2, fn)) * sqrt(q) * cusp * fade;
  float kx = ${G} * sqrt(1.0 + t1 * t1) / u2;
  float h = aT * cos(kx * (x + ay * t1));
  float s2 = sqrt(1.0 + t2 * t2);
  float kx2 = ${G} * s2 / u2;
  float aD = a0 * pow(q, 1.0 / 3.0) * cusp * fade * smoothstep(12.0, 4.0, kx2 * s2) * (0.2 + 0.8 * smoothstep(0.25, 0.9, th / peak)) * lean;
  h += aD * cos(kx2 * (x + ay * t2));
  return h;
}
// (hullWave: as the JS above.) Returns (height, foam).
vec2 hullWave(float u, float v, float L, float B, float U) {
  if (U < 0.5) return vec2(0.0);
  float fn = U / sqrt(${G} * L), av = abs(v);
  float hb = min(0.35 * U * U / (2.0 * ${G}), 0.06 * L) * (1.0 - 0.6 * smoothstep(0.9, 2.0, fn)) * smoothstep(0.08, 0.3, fn);
  float r = 2.0 * u / L;
  if ((abs(r) < 1.0 && av < B * sqrt(max(0.0, 1.0 - r * r)) * (r > 0.0 ? 1.0 - 0.35 * r : 1.0)) || hb <= 1e-4) return vec2(0.0);
  float ca = cos(0.5), sa = sin(0.5), wu = u - L * 0.5;
  float sAlong = -wu * ca + av * sa, e = wu * sa + av * ca, wb = 0.1 * L + 0.15 * max(0.0, sAlong);
  float arm = exp(-pow(e / wb, 2.0)) * exp(-max(0.0, sAlong) / (0.9 * L)) * smoothstep(-0.2 * L, 0.1 * L, sAlong);
  float trough = -0.55 * exp(-pow(u / (0.35 * L), 2.0)) * exp(-pow((av - B) / (0.4 * B + 0.25), 2.0));
  float stern = 0.5 * (1.0 - smoothstep(0.7, 1.3, fn)) * exp(-pow((u + 0.75 * L) / (0.22 * L), 2.0)) * exp(-pow(v / (B + 0.4), 2.0));
  float foam = smoothstep(4.0, 9.0, U) * smoothstep(0.04, 0.15, hb) * exp(-pow(e / (0.6 * wb), 2.0)) * exp(-max(0.0, sAlong) / (0.35 * L));
  return vec2(hb * (arm + trough + stern), foam);
}
`;

// Each ribbon vertex carries the track point it stands beside (where, and which way she was
// heading), so every pixel works out exactly how far along and across her track it lies.
const ribbonVert = /* glsl */ `
attribute vec4 aTrack; // the track point: x, z, and her heading there (unit x, z)
attribute vec4 aWake;  // how far she's gone since (m), speed (m/s), scale a0 (m), length (m)
attribute float aAge;  // seconds since she passed
attribute vec2 aWash;  // how hard her propeller was churning there (0 … 1), her half-beam (m)
attribute vec4 aClip;  // a wake mirrored off a quay: the wall's face (normal x, z, offset) and how much comes back
attribute vec4 aSpan;  // and along it (direction x, z, middle, half its length)
varying vec4 vClip;
varying vec4 vSpan;
varying vec2 vP;
varying vec4 vTrack;
varying vec4 vWake;
varying float vAge;
varying vec2 vWash;
void main() {
  vP = position.xy;
  vTrack = aTrack;
  vWake = aWake;
  vAge = aAge;
  vWash = aWash;
  vClip = aClip;
  vSpan = aSpan;
  gl_Position = projectionMatrix * viewMatrix * vec4(position.xy, 0.0, 1.0);
}
`;
const ribbonFrag = /* glsl */ `
varying vec2 vP;
varying vec4 vTrack;
varying vec4 vWake;
varying float vAge;
varying vec2 vWash;
varying vec4 vClip;
varying vec4 vSpan;
${KELVIN_GLSL}
void main() {
  // (A reflection: only on the water's side of the wall, and only as long as the wall is.)
  float keep = 1.0;
  if (vClip.w > 0.0) {
    keep = vClip.w * step(0.0, dot(vClip.xy, vP) + vClip.z) * (1.0 - smoothstep(vSpan.w, vSpan.w + 3.0, abs(dot(vSpan.xy, vP) - vSpan.z)));
    if (keep <= 0.0) discard;
  }
  vec2 t = normalize(vTrack.zw), d = vP - vTrack.xy;
  float along = dot(d, t), across = dot(d, vec2(-t.y, t.x));
  float age = vAge - along / max(vWake.y, 0.1);
  // The white water her propeller churned up, straight astern, spreading and fading as it settles.
  float spreadW = vWash.y * (0.55 + 0.28 * max(age, 0.0));
  float wash = vWash.x * exp(-pow(across / max(spreadW, 0.2), 2.0)) * exp(-max(age, 0.0) / 5.0) * smoothstep(0.0, 1.5, vWake.x - along);
  // (Into the field's second channel the wake's height, the third its white water: the water
  // shader lifts the sheet by both channels, but only the little rings, not the wakes' long smooth
  // waves, catch the light as ripples.)
  gl_FragColor = vec4(0.0, kelvinH(vWake.x - along, across, vWake.y, vWake.z, vWake.w, age), wash * step(vClip.w, 0.0), 1.0) * keep;
}
`;

// The water round each hull, on a square about her.
const hullVert = /* glsl */ `
attribute vec2 aLocal;  // along, across her (m)
attribute vec3 aHull;   // length, half-beam, speed
varying vec2 vLocal;
varying vec3 vHull;
void main() {
  vLocal = aLocal;
  vHull = aHull;
  gl_Position = projectionMatrix * viewMatrix * vec4(position.xy, 0.0, 1.0);
}
`;
const hullFrag = /* glsl */ `
varying vec2 vLocal;
varying vec3 vHull;
${KELVIN_GLSL}
void main() {
  vec2 w = hullWave(vLocal.x, vLocal.y, vHull.x, vHull.y, vHull.z);
  gl_FragColor = vec4(0.0, w.x, w.y, 1.0);
}
`;

const MAX_TRACKS = 16;

// The quay wall nearest a boat that her wake would come back off: a straight face of a pier or
// quay at least eight metres long, within forty metres, her on its water side. Returns the
// reflection: the face (outward normal nx, nz; c so that nx·x + nz·z + c > 0 on the water side),
// and its run (direction ax, az, middle, half-length); or null.
const REFLECT = 0.45; // how much of a wake comes back off a wall
const WALL_HOLD = 20;  // seconds a wake keeps coming back off a wall she's passed
function wallFor(x, z) {
  let best = null, bd = 40;
  for (const Q of PIERS) {
    const faces = [
      [-1, 0, Q.x0, Q.z0, Q.z1], [1, 0, Q.x1, Q.z0, Q.z1],
      [0, -1, Q.z0, Q.x0, Q.x1], [0, 1, Q.z1, Q.x0, Q.x1],
    ];
    for (const [nx, nz, at, s0, s1] of faces) {
      if (s1 - s0 < 8) continue;
      const d = nx ? (x - at) * nx : (z - at) * nz;           // how far out from the face
      const sAlong = nx ? z : x;
      if (d <= 0.5 || d >= bd || sAlong < s0 - 15 || sAlong > s1 + 15) continue;
      bd = d;
      best = { nx, nz, c: -(nx ? at * nx : at * nz), ax: nx ? 0 : 1, az: nx ? 1 : 0, mid: (s0 + s1) / 2, half: (s1 - s0) / 2 };
    }
  }
  return best;
}
// A point mirrored in a wall, and a direction.
const mirror = (W, x, z) => {
  const d = W.nx * x + W.nz * z + W.c;
  return [x - 2 * d * W.nx, z - 2 * d * W.nz];
};
const mirrorDir = (W, x, z) => {
  const d = W.nx * x + W.nz * z;
  return [x - 2 * d * W.nx, z - 2 * d * W.nz];
};

export class Wakes {
  constructor() {
    this.tracks = new Map(); // boat → { pts: [{ x, z, tx, tz, t, U, a0 }], L, seen }
    this.n = 0;               // trail calls so far (a track not written lately is gone)
    this.mesh = null;
  }

  // A boat at (x, z), heading along (fx, fz), going U m/s through the water at time t: remember
  // her track. mass (kg), L (m), fine: see wakeScale.
  // (churn: how hard her propeller's working, 0 … 1; B her half-beam.)
  trail(boat, x, z, fx, fz, U, t, mass, L, fine, churn = 0, B = L * 0.2) {
    let T = this.tracks.get(boat);
    if (!T) this.tracks.set(boat, (T = { pts: [], L, seen: 0, now: { x, z, fx, fz, U: 0, B } }));
    T.seen = ++this.n;
    T.lastT = t;
    T.L = L;
    Object.assign(T.now, { x, z, fx, fz, U, B });
    const P = T.pts, last = P[P.length - 1];
    // (Moved a long way at once, or the clock turned back: a fresh track.)
    if (last && (Math.hypot(x - last.x, z - last.z) > 8 || t < last.t)) P.length = 0;
    while (P.length && t - P[0].t > MAX_AGE) P.shift();
    const a0 = wakeScale(mass, L, fine, Math.abs(U));
    if (P.length && Math.hypot(x - P[P.length - 1].x, z - P[P.length - 1].z) < STEP) {
      // (Not far enough for a new point: the newest one follows her.)
      if (P.length > 1) return;
    }
    if (Math.abs(U) < 0.4 && (!P.length || P[P.length - 1].a0 === 0)) {
      if (P.length) P[P.length - 1].t = Math.max(P[P.length - 1].t, t - MAX_AGE);
      return;
    }
    // (The way her track runs, not where her bow happens to point this instant: a boat yaws a
    // little in a seaway, but her wake follows her course, smoothly.)
    let tx = fx, tz = fz;
    const prev = P[P.length - 1];
    if (prev) {
      // (Along the chord from a few metres back, eased: the way she's been going.)
      let q = prev;
      for (let i = P.length - 1; i >= 0 && Math.hypot(x - P[i].x, z - P[i].z) < 8; i--) q = P[i];
      const dx = x - q.x, dz = z - q.z, d = Math.hypot(dx, dz);
      if (d > 0.4) {
        const dir = Math.sign(U || 1);
        tx = prev.tx * 0.7 + (dir * dx / d) * 0.3;
        tz = prev.tz * 0.7 + (dir * dz / d) * 0.3;
        const l = Math.hypot(tx, tz) || 1;
        tx /= l;
        tz /= l;
      } else {
        tx = prev.tx;
        tz = prev.tz;
      }
    }
    P.push({ x, z, tx, tz, t, U: Math.abs(U), a0: Math.abs(U) < 0.4 ? 0 : a0, c: churn, B });
    if (P.length > MAX_POINTS) P.shift();
  }

  forget(boat) {
    this.tracks.delete(boat);
  }

  // The wall a track's wake comes back off just now (worked out once a moment). (It keeps coming
  // back off a wall for a while after she's gone on past it.)
  wall(T, t) {
    if (T._wt !== t) {
      T._wt = t;
      const W = T.now && T.pts.length > 1 ? wallFor(T.now.x, T.now.z) : null;
      if (W) {
        T._w = W;
        T._ws = t;
      } else if (T._w && !(t - T._ws < WALL_HOLD && t >= T._ws && T.pts.length > 1)) T._w = null;
    }
    return T._w;
  }

  // The wakes near a boat (other boats' only: her own runs away astern), worked out once a
  // frame at her middle: for each track, the stretch of it she's beside. ctx is reused.
  context(boat, x, z, t, reach, ctx = []) {
    ctx.length = 0;
    for (const [o, T] of this.tracks) {
      if (o === boat) continue;
      // (A boat that's stopped being moved at all, gone from the world, takes her wake with her.)
      if (this.n - T.seen > 400 || !(Math.abs(t - T.lastT) < 2)) {
        if (this.n - T.seen > 4000) this.tracks.delete(o);
        continue;
      }
      const P = T.pts;
      if (P.length < 2) continue;
      // The point of her track nearest to us, among those whose waves could have got here.
      let best = -1, bd = Infinity;
      for (let i = 0; i < P.length; i++) {
        const p = P[i], age = t - p.t;
        if (age < 0 || age > MAX_AGE || p.a0 <= 0) continue;
        const d = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) continue;
      const p = P[best];
      const back = p.U * (t - p.t);
      // (Close beside her: the water heaped round her hull, too.)
      const nw = T.now;
      if (Math.hypot(x - nw.x, z - nw.z) < T.L * 1.5 + reach && Math.abs(nw.U) > 0.5) ctx.push({ hull: true, x: nw.x, z: nw.z, fx: nw.fx, fz: nw.fz, U: Math.abs(nw.U), L: T.L, B: nw.B });
      // (And what comes back off the quay wall beside her, if there is one.)
      const W = this.wall(T, t);
      if (W && W.nx * x + W.nz * z + W.c > 0 && Math.abs(W.ax * x + W.az * z - W.mid) < W.half + 3) {
        const [mx, mz] = mirror(W, p.x, p.z), [mtx, mtz] = mirrorDir(W, p.tx, p.tz);
        ctx.push({ x: mx, z: mz, tx: mtx, tz: mtz, t: p.t, U: p.U, a0: p.a0 * REFLECT, L: T.L, mirrored: true });
      }
      if (Math.sqrt(bd) > back * 0.4 + reach + T.L) continue;
      ctx.push({ x: p.x, z: p.z, tx: p.tx, tz: p.tz, t: p.t, U: p.U, a0: p.a0, L: T.L });
    }
    return ctx;
  }

  // Add the wakes at (x, z) to out ({ h, vy }), from a context.
  sample(ctx, x, z, t, out) {
    for (let i = 0; i < ctx.length; i++) {
      const c = ctx[i];
      const dx = x - c.x, dz = z - c.z;
      if (c.hull) {
        out.h += hullWave(dx * c.fx + dz * c.fz, -dx * c.fz + dz * c.fx, c.L, c.B, c.U);
        continue;
      }
      // Ahead of that point along her track (she got there later) and across it.
      const along = dx * c.tx + dz * c.tz, across = dx * -c.tz + dz * c.tx;
      const passed = c.t + along / c.U;
      kelvin(c.U * (t - c.t) - along, across, c.U, c.a0, c.L, t - passed, out);
    }
    return out;
  }

  // The wakes' height at a point (every track; for a float or a bobber, say).
  heightAt(x, z, t) {
    const o = { h: 0, vy: 0 };
    return this.sample(this.context(null, x, z, t, 0, _hctx), x, z, t, o).h;
  }

  /* ---------------- drawn in the ripple field ---------------- */

  // The ribbons drawn into the ripple field (see waterfx.js): one strip down each track, as
  // wide as its wake has spread, each pixel working out the wake's height there.
  buildMesh() {
    const n = MAX_TRACKS * MAX_POINTS * 2;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3);
    this.tr = new Float32Array(n * 4);
    this.w1 = new Float32Array(n * 4);
    this.ag = new Float32Array(n);
    this.wa = new Float32Array(n * 2);
    this.cl = new Float32Array(n * 4);
    this.sp = new Float32Array(n * 4);
    g.setAttribute('aWash', new THREE.BufferAttribute(this.wa, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aClip', new THREE.BufferAttribute(this.cl, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSpan', new THREE.BufferAttribute(this.sp, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aTrack', new THREE.BufferAttribute(this.tr, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aWake', new THREE.BufferAttribute(this.w1, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAge', new THREE.BufferAttribute(this.ag, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let k = 0; k < MAX_TRACKS; k++) {
      for (let i = 0; i < MAX_POINTS - 1; i++) {
        const a = (k * MAX_POINTS + i) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: ribbonVert,
      fragmentShader: ribbonFrag,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    // The squares round each hull.
    const hg = new THREE.BufferGeometry(), m4 = MAX_TRACKS * 4;
    this.hp = new Float32Array(m4 * 3);
    this.hl = new Float32Array(m4 * 2);
    this.hh = new Float32Array(m4 * 3);
    hg.setAttribute('position', new THREE.BufferAttribute(this.hp, 3).setUsage(THREE.DynamicDrawUsage));
    hg.setAttribute('aLocal', new THREE.BufferAttribute(this.hl, 2).setUsage(THREE.DynamicDrawUsage));
    hg.setAttribute('aHull', new THREE.BufferAttribute(this.hh, 3).setUsage(THREE.DynamicDrawUsage));
    const hi = [];
    for (let k = 0; k < MAX_TRACKS; k++) hi.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
    hg.setIndex(hi);
    this.hulls = new THREE.Mesh(hg, new THREE.ShaderMaterial({
      vertexShader: hullVert, fragmentShader: hullFrag, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide,
    }));
    this.hulls.frustumCulled = false;
    this.mesh.add(this.hulls);
    return this.mesh;
  }

  // One track's ribbon into slot k (or, W given, its reflection off that wall). Returns k + 1.
  ribbon(T, P, k, t, W) {
    const P3 = this.pos, TR = this.tr, W1 = this.w1, AG = this.ag, WA = this.wa, CL = this.cl, SP = this.sp;
    const base = k * MAX_POINTS * 2;
    const m = Math.min(P.length, MAX_POINTS);
    for (let j = 0; j < MAX_POINTS; j++) {
      // Newest first; past the end, the strip folds up on its last point (no area).
      const p = P[P.length - 1 - Math.min(j, m - 1)];
      const age = Math.max(0, t - p.t), back = p.U * age;
      const half = j < m ? Math.min(FAR * 0.4, back * Math.tan(CUSP) * 1.15 + T.L * 0.6 + 1) : 0;
      let px = p.x, pz = p.z, tx = p.tx, tz = p.tz;
      if (W) {
        [px, pz] = mirror(W, px, pz);
        [tx, tz] = mirrorDir(W, tx, tz);
      }
      // (Square across her heading there, either side.)
      const nx = -tz, nz = tx;
      for (let s = 0; s < 2; s++) {
        const v = base + j * 2 + s, sd = s ? 1 : -1;
        P3[v * 3] = px + nx * half * sd;
        P3[v * 3 + 1] = pz + nz * half * sd;
        P3[v * 3 + 2] = 0;
        TR[v * 4] = px;
        TR[v * 4 + 1] = pz;
        TR[v * 4 + 2] = tx;
        TR[v * 4 + 3] = tz;
        W1[v * 4] = back;
        W1[v * 4 + 1] = p.U;
        W1[v * 4 + 2] = p.a0;
        W1[v * 4 + 3] = T.L;
        AG[v] = age;
        WA[v * 2] = p.c || 0;
        WA[v * 2 + 1] = p.B || T.L * 0.2;
        CL[v * 4] = W ? W.nx : 0;
        CL[v * 4 + 1] = W ? W.nz : 0;
        CL[v * 4 + 2] = W ? W.c : 0;
        CL[v * 4 + 3] = W ? REFLECT : 0;
        SP[v * 4] = W ? W.ax : 0;
        SP[v * 4 + 1] = W ? W.az : 0;
        SP[v * 4 + 2] = W ? W.mid : 0;
        SP[v * 4 + 3] = W ? W.half : 0;
      }
    }
    return k + 1;
  }

  // Lay the ribbons for time t (only tracks within `range` of (cx, cz)). Returns whether any.
  updateMesh(t, cx, cz, range) {
    if (!this.mesh) return false;
    let k = 0, kh = 0;
    for (const [, T] of this.tracks) {
      if (k >= MAX_TRACKS) break;
      if (this.n - T.seen > 400 || !(Math.abs(t - T.lastT) < 2)) continue;
      const P = T.pts;
      if (P.length < 2) continue;
      // (Only if some of it is near enough to see.)
      let near = false;
      for (let i = P.length - 1; i >= 0 && !near; i -= 4) near = Math.abs(P[i].x - cx) < range + 60 && Math.abs(P[i].z - cz) < range + 60;
      if (!near) continue;
      // The water round her hull, if she's going.
      const nw = T.now;
      if (Math.abs(nw.U) > 0.5 && kh < MAX_TRACKS) {
        const reach = T.L * 1.1 + 2, fwd = T.L * 0.5 + 2;
        const corners = [[fwd, -reach], [fwd, reach], [-T.L * 1.3, reach], [-T.L * 1.3, -reach]];
        for (let c = 0; c < 4; c++) {
          const [u, v] = corners[c], q = kh * 4 + c;
          this.hp[q * 3] = nw.x + nw.fx * u - nw.fz * v;
          this.hp[q * 3 + 1] = nw.z + nw.fz * u + nw.fx * v;
          this.hp[q * 3 + 2] = 0;
          this.hl[q * 2] = u;
          this.hl[q * 2 + 1] = v;
          this.hh[q * 3] = T.L;
          this.hh[q * 3 + 1] = nw.B;
          this.hh[q * 3 + 2] = Math.abs(nw.U);
        }
        kh++;
      }
      k = this.ribbon(T, P, k, t, null);
      const W = this.wall(T, t);
      if (W && k < MAX_TRACKS) k = this.ribbon(T, P, k, t, W);
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, k * (MAX_POINTS - 1) * 6);
    g.attributes.position.needsUpdate = true;
    g.attributes.aTrack.needsUpdate = true;
    g.attributes.aWake.needsUpdate = true;
    g.attributes.aAge.needsUpdate = true;
    g.attributes.aWash.needsUpdate = true;
    g.attributes.aClip.needsUpdate = true;
    g.attributes.aSpan.needsUpdate = true;
    const hg = this.hulls.geometry;
    hg.setDrawRange(0, kh * 6);
    for (const key of ['position', 'aLocal', 'aHull']) hg.attributes[key].needsUpdate = true;
    return k > 0 || kh > 0;
  }
}
const _hctx = [];

export const wakes = new Wakes();
