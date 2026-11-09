// Bow trolling motors as pieces of marine equipment: where each boat's mount goes, and how the
// motor gets from lying on the foredeck to standing in the water and back (see trolling.js for the
// motor itself: its push, its battery and Spot-Lock).
//
// Built after the bow-mount motors anglers actually fit (Minn Kota's Terrova and Riptide Terrova,
// the Riptide Instinct QUEST, and the bow plates sold for them). Stowed, the motor lies flat on its
// mount: the shaft runs aft along the foredeck, the control head at its aft end on a rest, and the
// lower unit at its forward end sits across the mount's fall-away ramps, turned sideways so the pod
// lies in them. To deploy it:
//   1. the stow/deploy lever releases the latch and the ramps fall away;
//   2. the shaft slides forward through its pivoting collar, the lower unit clear of the ramps;
//   3. the whole assembly pivots about the hinge at the front of the mount, the lower unit
//      swinging out and down past the bow, the head coming up;
//   4. at the vertical it clicks into its lock;
//   5. the shaft slides down through the collar to the depth set (the depth collar comes to rest
//      on the steering housing);
//   6. down there, clear of her bottom, the lower unit turns from sideways to straight ahead —
//      and only then is the propeller live.
// Stowing is the same backwards: the lower unit turned sideways, up out of the water, unlocked,
// swung up, slid back onto the ramps, latched.
//
// How it's done depends on the motor: by hand (the basic motor, and the bass boat's own), by hand
// with a lift-assist spring (the GPS motor, like a Riptide Terrova), or by its own electric
// actuator at the press of a button, depth by power trim (the high-thrust motor, like a Riptide
// Instinct QUEST, the only kind that stows and deploys itself).
//
// Everything here is in the boat's own frame: x to starboard, y up, z forward, metres; and plain
// numbers (no three.js), so the tests can check every part of it against the hull.

import { tubeCentre } from './hydro.js';

const hw = (H, t) => H.B * H.hw(t);
const sheer = (H, t) => H.D + H.sheer(t);
const zAt = (H, t) => -H.L / 2 + H.L * t;
const tOf = (H, z) => (z + H.L / 2) / H.L;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (u) => u * u * (3 - 2 * u);

// Small vector helpers (arrays [x, y, z]).
export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  // a rotated about unit axis k by angle th (Rodrigues).
  rot: (a, k, th) => {
    const c = Math.cos(th), s = Math.sin(th), kd = k[0] * a[0] + k[1] * a[1] + k[2] * a[2];
    const kx = [k[1] * a[2] - k[2] * a[1], k[2] * a[0] - k[0] * a[2], k[0] * a[1] - k[1] * a[0]];
    return [a[0] * c + kx[0] * s + k[0] * kd * (1 - c), a[1] * c + kx[1] * s + k[1] * kd * (1 - c), a[2] * c + kx[2] * s + k[2] * kd * (1 - c)];
  },
};

// Each boat's installation. All of them on the starboard bow (side 1), clear of the anchor's
// fairlead, the bow cleat and the towing eye on the centreline.
//  x      how far out from the centreline the hinge is
//  out    how far beyond the hull's edge (or the tube's nose) the hinge stands, so the shaft drops
//         clear of her stem
//  rise   the hinge's height above the base plate
//  toe    the stowed shaft's angle out from fore-and-aft (rad), following her side aft
//  droop  its slope down aft (rad): the head end lower than the hinge, on its rest
//  shaft  the shaft's length
//  rest   how far aft along the stowed shaft its rest stands (null: none needed)
//  platform 'plate' (a bow mount plate on the deck) or 'riser' (a raised platform on legs, over
//         the RIB's tube nose)
//  railGap the bow rail's starboard forward bay left open for it (the centre console)
export const MOUNT_SPECS = {
  // The RIB: on a raised aluminium platform on legs bolted to her rigid foredeck inside the tubes
  // (both on its inboard side: the deck there is narrow), its outboard edge overhanging the
  // starboard tube and its front standing out beyond the tube's nose, so the shaft drops into the
  // water ahead of the nose and never touches the tubes; stowed, the motor lies along the
  // starboard side of the bow on the platform, on a cradle at its aft end.
  rib: { x: 0.34, out: 0.17, rise: 0.1, toe: -0.03, droop: 0.02, shaft: 2.05, rest: 1.3, platform: 'riser' },
  // The bass boat: a bow mount plate on the casting deck, overhanging the bow.
  bass: { x: 0.33, out: 0.11, rise: 0.1, toe: 0.07, droop: 0.02, shaft: 1.5, rest: null, platform: 'plate' },
  // The centre console: a plate on the foredeck; her bow rail is the trolling-motor kind, open in
  // its starboard forward bay for the shaft to swing through.
  console: { x: 0.33, out: 0.12, rise: 0.11, toe: 0.06, droop: 0.02, shaft: 2.2, rest: null, platform: 'plate', railGap: true },
  // The skiff: a small plate on her stem head.
  skiff: { x: 0.3, out: 0.09, rise: 0.09, toe: 0.05, droop: 0.04, shaft: 1.6, rest: null, platform: 'plate' },
  // The cabin boat: on the foredeck, the shaft stowing along her starboard side deck beside the
  // cabin, on a rest at the cabin's corner.
  cabin: { x: 0.3, out: 0.1, rise: 0.1, toe: 0.3, droop: -0.03, shaft: 1.8, rest: 1.25, platform: 'plate' },
};
export const canMount = (kind) => kind in MOUNT_SPECS;
// How far the lower unit's nose reaches in from the shaft when it's turned sideways (m).
const REACH_IN = 0.24;
// The RIB's platform's length, aft from its hinge.
export const PLATFORM_LEN = 1.4;

// Where her hull's edge is, at x out from the centreline, going forward: the z beyond which the
// hull (or the RIB's tube) no longer reaches out that far.
function edgeAt(H, x) {
  if (H.tubes) {
    const T = H.tubes, r = T.r, line = tubeLine(H);
    // (The tube's outer surface in plan: within r of its centreline.)
    let z = H.L / 2 + 1.2;
    while (z > 0 && planDist(line, x, z) > r) z -= 0.005;
    return z;
  }
  let lo = 0.5, hi = 1;
  if (hw(H, 1) >= x) return zAt(H, 1);
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (hw(H, m) > x) lo = m;
    else hi = m;
  }
  return zAt(H, (lo + hi) / 2);
}
// The RIB's starboard tube's centreline round the bow, and its nose (see hydro.js, boat.js).
export function tubeLine(H) {
  const T = H.tubes, out = [];
  for (let t = 0.5; t <= T.t1 + 1e-6; t += 0.01) out.push(tubeCentre(H, t, 1));
  const nose = tubeCentre(H, T.t1, 1);
  out.push([0, nose[1] + T.r * 0.35, zAt(H, 1) + T.r * 0.55]);
  return out;
}
function planDist(line, x, z) {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1];
    const ex = b[0] - a[0], ez = b[2] - a[2], l2 = ex * ex + ez * ez || 1e-9;
    const u = clamp(((x - a[0]) * ex + (z - a[2]) * ez) / l2, 0, 1);
    best = Math.min(best, Math.hypot(a[0] + ex * u - x, a[2] + ez * u - z));
  }
  return best;
}
// The deck's height at z (where something stands on it), and the top of the RIB's tube nose.
export function deckY(H, z) {
  const t = clamp(tOf(H, z), 0, 1);
  for (const [a, b, drop] of H.decks || []) if (t >= a && t <= b) return sheer(H, t) - drop;
  if (H.floor && H.floorY != null) return H.floorY;
  return sheer(H, t) - 0.1;
}

// The mount itself, worked out from her hull: the hinge, the pivot's axis, the stowed shaft's
// line, the shaft's travel through its collar, and the depths. water: her waterline at rest, in
// her own frame (floatDraft).
export function mountFor(kind, H, water) {
  const S = MOUNT_SPECS[kind];
  if (!S) return null;
  const side = 1, x = side * S.x;
  // (Far enough forward of her edge for the shaft, and for the lower unit, which swings down lying
  // sideways with its nose reaching in towards her stem.)
  const zh = Math.max(edgeAt(H, S.x) + S.out, edgeAt(H, Math.max(0, S.x - REACH_IN)) + 0.05);
  // The base: a plate just aft of the hinge, on the deck, or (the RIB) a platform on legs standing
  // above the tubes' nose.
  const baseLen = S.platform === 'riser' ? PLATFORM_LEN : 0.4, baseZ = zh - 0.2;
  // (A plate on her deck, packed up on a block to the height of her gunwale where the deck's below
  // it, so the overhang clears the gunwale's lip.)
  let baseY = Math.max(deckY(H, baseZ), sheer(H, clamp(tOf(H, edgeAt(H, S.x)), 0, 1))) + 0.005, legsTo = null;
  if (S.platform === 'riser') {
    const line = tubeLine(H), r = H.tubes.r;
    let top = 0;
    for (const p of line) if (p[2] > zh - baseLen - 0.1) top = Math.max(top, p[1] + r);
    baseY = top + 0.05;
  }
  const hinge = [x, baseY + S.rise, zh];
  // The stowed shaft points aft from the collar (lower unit forward, head aft): out a little to
  // follow her side, and down a little onto its rest.
  const d0 = V.norm([side * Math.sin(S.toe) * Math.cos(S.droop), -Math.sin(S.droop), -Math.cos(S.toe) * Math.cos(S.droop)]);
  const up = [0, 1, 0];
  const k = V.norm(V.cross(d0, up));
  const sweep = Math.acos(clamp(V.dot(d0, up), -1, 1));
  // The shaft's travel through its collar (u: from the collar to the lower unit's centre, along
  // the shaft): sitting in the ramps stowed, slid clear of them to pivot, then down to depth.
  const uStow = 0.27, slideLen = 0.11, uPivot = uStow + slideLen;
  // Depths, as the propeller's depth under her still waterline: shallow, normal (about a foot
  // over the top of the motor, the makers' advice), deep (for a chop); never so shallow it draws
  // air, never so deep the head comes down onto the collar.
  const above = hinge[1] - water;
  const extFor = (sub) => above + sub - uPivot;
  const max = Math.max(extFor(0.3), S.shaft - 0.3 - uPivot);
  const depths = { min: extFor(0.22), shallow: extFor(0.3), normal: extFor(0.5), deep: extFor(0.75), max };
  for (const id of ['shallow', 'normal', 'deep']) depths[id] = Math.min(depths[id], max);
  // (Stowed, the shaft's aft end lies in a cradle: on the RIB's platform, or on a post from her
  // deck.)
  const aft = V.norm([d0[0], 0, d0[2]]);
  const rest = S.rest ? (() => {
    const p = V.add(hinge, V.mul(d0, S.rest));
    return { at: p, foot: S.platform === 'riser' && S.rest < baseLen - 0.05 ? baseY : deckY(H, p[2]) };
  })() : null;
  // The RIB's platform's legs: on its inboard side, down to her foredeck.
  if (S.platform === 'riser') {
    legsTo = [];
    for (const s of [1.05, 1.32]) {
      const top = V.add(V.add(hinge, V.mul(aft, s)), V.mul(k, -0.14));
      legsTo.push({ top: [top[0], baseY - 0.025, top[2]], foot: [top[0], deckY(H, top[2]), top[2]] });
    }
  }
  return {
    kind, side, spec: S, hinge, d0, k, sweep, shaft: S.shaft, uStow, slideLen, uPivot, depths, water,
    base: { y: baseY, z: baseZ, len: baseLen, legsTo, x: x - side * 0.02 }, rest,
    railGap: !!S.railGap, platform: S.platform,
  };
}

// A mount for a motor not on a boat (the tests' and the shipyard's): a plain one.
export function genericMount() {
  const d0 = [0, 0, -1], k = [1, 0, 0];
  return {
    kind: null, side: 1, spec: { x: 0.3 }, hinge: [0.3, 0.9, 2], d0, k, sweep: Math.PI / 2, shaft: 1.5, uStow: 0.27, slideLen: 0.11, uPivot: 0.38,
    depths: { min: 0.55, shallow: 0.63, normal: 0.83, deep: 1.08, max: 1.08 }, water: 0.25,
    base: { y: 0.8, z: 1.8, len: 0.4, legsTo: null, x: 0.28 }, rest: null, railGap: false, platform: 'plate',
  };
}

// How each kind of motor moves (s for each step; lower: m/s down through the collar). By hand: a
// firm push on the lever, a slide and a swing; with a lift-assist spring, the swing comes easier
// and quicker; powered, the actuator runs at its own steady pace, and the depth is power trim.
export const DEPLOY = {
  manual: { latch: 0.35, slide: 0.45, pivot: 1.5, lock: 0.25, turn: 0.6, lower: 0.55, ease: 'hand' },
  assist: { latch: 0.3, slide: 0.4, pivot: 1.2, lock: 0.2, turn: 0.5, lower: 0.6, ease: 'assist' },
  powered: { latch: 0.5, slide: 0.7, pivot: 2.4, lock: 0.4, turn: 0.9, lower: 0.16, ease: 'powered' },
};
// The order things happen deploying (stowing is the same backwards), and where each ends up.
const STEPS = ['latch', 'slide', 'pivot', 'lock', 'ext', 'turn'];
const DOWN = { latch: 1, slide: 1, pivot: 1, lock: 1, turn: 0 };
const UP = { latch: 0, slide: 0, pivot: 0, lock: 0, turn: 1, ext: 0 };
// What each step says as it finishes (for the sounds and the words).
const SAY_DOWN = { latch: 'unlatched', slide: 'clear', pivot: 'vertical', lock: 'locked', turn: 'straight', ext: 'atDepth' };
const SAY_UP = { ext: 'raised', turn: 'turned', lock: 'unlocked', pivot: 'level', slide: 'onRamps', latch: 'latched' };

export class TrollMech {
  // how: 'manual' | 'assist' | 'powered'; mount: from mountFor (or genericMount).
  constructor(how, mount = genericMount()) {
    this.how = how;
    this.R = DEPLOY[how] || DEPLOY.manual;
    this.mount = mount;
    // Each of the motion's parts, 0 … 1 (ext: metres down through the collar past the pivot).
    this.v = { latch: 0, slide: 0, pivot: 0, lock: 0, turn: 1, ext: 0 };
    this.want = false;
    this.depthId = 'normal';
    this.active = null; // the step moving now, or null
    this.wait = null;   // why it's waiting ('align': the head turning straight first)
    this.arrived = false; // down to depth since it was last deployed
  }

  get depthWant() { return this.mount.depths[this.depthId]; }
  get stowed() { return !this.want && STEPS.every((s) => this.v[s] === UP[s]); }
  // Down, locked, straight and at a depth where the propeller can't draw air: it may push. (A
  // power trim may move between depths and keep pushing; set by hand, the collar's loose while
  // it's moved, so not until it's tightened again.)
  get ready() {
    const v = this.v, D = this.mount.depths;
    if (!this.want || v.latch < 1 || v.slide < 1 || v.pivot < 1 || v.lock < 1 || v.turn > 0) return false;
    if (v.ext < D.min - 1e-6) return false;
    return this.how === 'powered' || Math.abs(v.ext - this.depthWant) < 1e-6;
  }
  // 0 stowed … 1 deployed, for anything that wants one number.
  get progress() {
    const v = this.v, d = Math.max(1e-6, this.depthWant);
    const p = v.latch * 0.05 + v.slide * 0.1 + v.pivot * 0.5 + v.lock * 0.05 + (1 - v.turn) * 0.1 + Math.min(1, v.ext / d) * 0.2;
    return clamp(Math.round(p * 1e6) / 1e6, 0, 1);
  }
  get moving() { return !!this.active; }

  deploy(on) {
    this.want = !!on;
    if (!on) this.arrived = false;
    return this.want;
  }
  setDepth(id) {
    if (!(id in this.mount.depths) || id === 'min' || id === 'max') return false;
    this.depthId = id;
    return true;
  }
  // Straight to one end (a game loaded with it down, or a test).
  snap(down) {
    this.want = !!down;
    Object.assign(this.v, down ? { ...DOWN, ext: this.depthWant } : UP);
    this.active = null;
    this.arrived = !!down;
  }

  // Once a frame. aligned: the motor's steering has the head straight ahead (it turns it there
  // itself before it's stowed). Returns the things that happened, for the sounds: 'start' (a step
  // begins: { step }), and each step's finish (unlatched, clear, vertical, locked, straight,
  // atDepth; raised, turned, unlocked, level, onRamps, latched; 'depth' for a new depth reached).
  step(dt, { aligned = true } = {}) {
    const ev = [], v = this.v, R = this.R;
    const targets = this.want ? { ...DOWN, ext: this.depthWant } : UP;
    const order = this.want ? STEPS : [...STEPS].reverse();
    // (A step within a hair of where it's going is there: exactly.)
    for (const s of STEPS) if (v[s] !== targets[s] && Math.abs(v[s] - targets[s]) <= 1e-6) v[s] = targets[s];
    let step = order.find((s) => v[s] !== targets[s]) || null;
    this.wait = null;
    if (!this.want && step && step !== 'ext' && !aligned) {
      // (Coming up: the lower unit has to be straight first; the steering's turning it.)
      this.wait = 'align';
      step = null;
    }
    if (step !== this.active) {
      if (step) ev.push({ type: 'start', step });
      this.active = step;
    }
    if (!step) return ev;
    const target = targets[step];
    if (step === 'ext') {
      const rate = R.lower;
      const was = v.ext;
      v.ext = target > was ? Math.min(target, was + rate * dt) : Math.max(target, was - rate * dt);
      if (Math.abs(v.ext - target) <= 1e-6) v.ext = target;
      if (v.ext === target && was !== target) {
        // (Down to depth the first time: deployed; afterwards, a new depth set.)
        ev.push({ type: this.want ? (this.arrived ? 'depth' : SAY_DOWN.ext) : SAY_UP.ext });
        if (this.want) this.arrived = true;
      }
    } else {
      const rate = 1 / R[step];
      v[step] = target > v[step] ? Math.min(target, v[step] + rate * dt) : Math.max(target, v[step] - rate * dt);
      if (Math.abs(v[step] - target) <= 1e-6) v[step] = target;
      if (v[step] === target) ev.push({ type: (this.want ? SAY_DOWN : SAY_UP)[step] });
    }
    if (Math.abs(v[step] - target) <= 1e-6) {
      v[step] = target;
      this.active = null;
    }
    return ev;
  }

  // The swing's angle as you'd see it (rad from lying stowed): by hand it starts slow and eases
  // into the lock; with the lift-assist it's quicker off the mark; the actuator runs steadily.
  angle() {
    const p = this.v.pivot, E = this.R.ease;
    const f = E === 'powered' ? 0.8 * p + 0.2 * smooth(p) : E === 'assist' ? 1 - Math.pow(1 - p, 1.4) : smooth(p);
    return clamp(f, 0, 1) * this.mount.sweep;
  }
}

// Where everything is for a state of the motion (the mech's v, its swing angle) and the head's
// steering angle (rad, + to port, as trolling.js has it): the shaft's direction, the collar, the
// lower unit, the head, the depth collar, and the axes the model is built on. Everything the
// model shows and the tests check comes from here.
export function rigPose(M, v, theta, steer = 0) {
  const d = V.rot(M.d0, M.k, theta);                // the shaft, from the lower unit up to the head
  const C = M.hinge;                                 // the collar (steering housing) on the hinge
  const u = M.uStow + v.slide * M.slideLen + v.ext;  // collar to the lower unit's centre
  const low = V.sub(C, V.mul(d, u));
  const head = V.add(C, V.mul(d, M.shaft - u));
  // The lower unit's own axes: turned about the shaft by the steering, plus a quarter-turn
  // sideways to lie across the ramps when stowed (turn = 1).
  const spin = steer - M.side * v.turn * (Math.PI / 2);
  const z0 = V.cross(M.k, d);                        // straight ahead, on a vertical shaft
  const fwd = V.rot(z0, d, spin);
  const side = V.cross(d, fwd);
  return { d, k: M.k, C, u, low, head, fwd, side, spin };
}

// Points along the whole moving assembly, for checking it against the boat: the shaft every few
// centimetres, the lower unit's nose, tail, fin and propeller, and the head's corners. Each { p,
// r (radius it needs clear), part }.
export function rigPoints(M, P) {
  const out = [];
  const L = M.shaft;
  for (let s = 0.08; s <= L - 0.12; s += 0.05) out.push({ p: V.add(P.low, V.mul(P.d, s)), r: 0.02, part: 'shaft' });
  out.push({ p: P.low, r: 0.06, part: 'motor' });
  out.push({ p: V.add(P.low, V.mul(P.fwd, 0.17)), r: 0.045, part: 'motor' });
  out.push({ p: V.sub(P.low, V.mul(P.fwd, 0.15)), r: 0.05, part: 'motor' });
  const hub = V.sub(P.low, V.mul(P.fwd, 0.22));
  out.push({ p: hub, r: 0.035, part: 'prop' });
  for (const a of [-1, 1]) for (const ax of [P.side, P.d]) out.push({ p: V.add(hub, V.mul(ax, a * 0.1)), r: 0.02, part: 'prop' });
  out.push({ p: V.sub(P.low, V.mul(P.d, 0.13)), r: 0.02, part: 'fin' });
  for (const a of [-1, 1]) for (const b of [-1, 1]) out.push({ p: V.add(V.add(P.head, V.mul(P.fwd, a * 0.1)), V.mul(P.side, b * 0.06)), r: 0.04, part: 'head' });
  out.push({ p: V.add(P.head, V.mul(P.d, 0.08)), r: 0.05, part: 'head' });
  return out;
}

// The propeller's centre (where its push acts, see Boat), for a pose.
export const propAt = (P) => V.sub(P.low, V.mul(P.fwd, 0.22));

// Over the wire (a friend sees your motor where it is: see together.js, visitors.js): the motor's
// kind, each part of the motion, the swing (as a share of its sweep), the depth set, the head's
// angle and whether the propeller's turning. Ten small numbers.
export const TROLL_LOOKS = ['troll', 'trollgps', 'trollpro'];
export function trollWire(tier, mech, steer = 0, pushing = false) {
  const v = mech.v, r2 = (x) => Math.round(x * 100) / 100;
  return [Math.max(0, TROLL_LOOKS.indexOf(tier)), r2(v.latch), r2(v.slide), r2(mech.angle() / (mech.mount.sweep || 1)), r2(v.lock), r2(v.ext), r2(v.turn), r2(steer), pushing ? 1 : 0, r2(mech.mount.uPivot + mech.depthWant)];
}
// Checked as it comes in (anything that isn't sensible: nothing drawn). Returns what a Boat's
// trollView takes, for her mount (theta from the share of her sweep), or null.
export function cleanTrollWire(a, mount) {
  if (!Array.isArray(a) || a.length !== 10 || !mount) return null;
  const n = a.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : NaN));
  if (n.some(Number.isNaN)) return null;
  const c01 = (x) => clamp(x, 0, 1);
  const look = TROLL_LOOKS[clamp(Math.round(n[0]), 0, TROLL_LOOKS.length - 1)];
  const D = mount.depths;
  return {
    look,
    v: { latch: c01(n[1]), slide: c01(n[2]), pivot: c01(n[3]), lock: c01(n[4]), ext: clamp(n[5], 0, D.max), turn: c01(n[6]) },
    theta: c01(n[3]) * mount.sweep,
    steer: clamp(n[7], -Math.PI * 1.5, Math.PI * 1.5),
    f: n[8] ? 60 : 0,
    depthU: clamp(n[9], mount.uPivot, mount.uPivot + D.max),
  };
}
