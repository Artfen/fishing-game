// The throttle lever of a motorboat (and of the kayak's electric motor): a handful of clear
// notches, astern, neutral and a few speeds ahead, rather than a slider. The keys, the
// controller, the touch stick and the lever on screen all move the same lever a notch at a time,
// and the motor answers it the way a real one does (see Boat: it builds up and eases off, and
// changes gear through neutral).
//
// Each notch is a lever value (-1 … 1: the share of the motor's push, astern below 0) chosen for
// the speed it gives that hull on calm water:
//   dead slow  about 1 m/s    creeping along a pier, a mooring or a weed bed
//   slow       about 2 m/s    trolling a lure, and the most you can motor with a line out
//   half       about 4–5 m/s  getting somewhere
//   full                      flat out
// The yacht, the centre console and the RIB also have a trolling notch (T, about 3.6 m/s, seven knots)
// between slow and half: the speed the big ocean fish are trolled for, allowed with a line out.
// On the bass boat the first two notches run its quiet electric motor; on the kayak the whole
// lever is its little electric motor (with the paddle the kayak is faster still).

export const LEVERS = {
  skiff: [
    { v: -0.3, id: 'R', name: 'astern' },
    { v: 0, id: 'N', name: 'neutral' },
    { v: 0.06, id: '1', name: 'dead slow' },
    { v: 0.14, id: '2', name: 'slow ahead' },
    { v: 0.4, id: '3', name: 'half ahead' },
    { v: 1, id: 'F', name: 'full ahead' },
  ],
  cabin: [
    { v: -0.35, id: 'R', name: 'astern' },
    { v: 0, id: 'N', name: 'neutral' },
    { v: 0.085, id: '1', name: 'dead slow' },
    { v: 0.2, id: '2', name: 'slow ahead' },
    { v: 0.5, id: '3', name: 'half ahead' },
    { v: 1, id: 'F', name: 'full ahead' },
  ],
  // The sport-fishing yacht: heavy, and quick once she's going.
  cruiser: [
    { v: -0.25, id: 'R', name: 'astern' },
    { v: 0, id: 'N', name: 'neutral' },
    { v: 0.039, id: '1', name: 'dead slow' },
    { v: 0.088, id: '2', name: 'slow ahead' },
    { v: 0.196, id: 'T', name: 'trolling' },
    { v: 0.3, id: '3', name: 'half ahead' },
    { v: 1, id: 'F', name: 'full ahead' },
  ],
  // The centre console: light and powerful.
  console: [
    { v: -0.25, id: 'R', name: 'astern' },
    { v: 0, id: 'N', name: 'neutral' },
    { v: 0.021, id: '1', name: 'dead slow' },
    { v: 0.05, id: '2', name: 'slow ahead' },
    { v: 0.111, id: 'T', name: 'trolling' },
    { v: 0.155, id: '3', name: 'half ahead' },
    { v: 1, id: 'F', name: 'full ahead' },
  ],
  // The RIB: light, with a big outboard.
  rib: [
    { v: -0.15, id: 'R', name: 'astern' },
    { v: 0, id: 'N', name: 'neutral' },
    { v: 0.011, id: '1', name: 'dead slow' },
    { v: 0.027, id: '2', name: 'slow ahead' },
    { v: 0.066, id: 'T', name: 'trolling' },
    { v: 0.095, id: '3', name: 'half ahead' },
    { v: 1, id: 'F', name: 'full ahead' },
  ],
  // The jet ski: a light touch goes a long way.
  jetski: [
    { v: -0.15, id: 'R', name: 'astern' },
    { v: 0, id: 'N', name: 'neutral' },
    { v: 0.015, id: '1', name: 'dead slow' },
    { v: 0.035, id: '2', name: 'slow ahead' },
    { v: 0.27, id: '3', name: 'half ahead' },
    { v: 1, id: 'F', name: 'full ahead' },
  ],
  bass: [
    { v: -0.3, id: 'R', name: 'astern' },
    { v: 0, id: 'N', name: 'neutral' },
    { v: 0.15, id: 'E1', name: 'electric, dead slow', quiet: true },
    { v: 0.3, id: 'E2', name: 'electric, slow', quiet: true },
    { v: 0.36, id: '3', name: 'outboard, half' },
    { v: 1, id: 'F', name: 'full ahead' },
  ],
  // The sailing boat's little outboard.
  sail: [
    { v: -0.4, id: 'R', name: 'astern' },
    { v: 0, id: 'N', name: 'neutral' },
    { v: 0.25, id: '1', name: 'dead slow' },
    { v: 0.55, id: '2', name: 'slow ahead' },
    { v: 1, id: 'F', name: 'full ahead' },
  ],
  kayak: [
    { v: -0.5, id: 'R', name: 'astern' },
    { v: 0, id: 'N', name: 'neutral' },
    { v: 0.35, id: '1', name: 'dead slow', quiet: true },
    { v: 0.65, id: '2', name: 'slow', quiet: true },
    { v: 1, id: '3', name: 'full', quiet: true },
  ],
};

// The highest notch allowed with a line out, and with a fish on: trolling speed at most (the
// lure swims, the line never drags it skipping across the top); once a fish takes, no more than
// dead slow (it's your fish to play, not the boat's).
const LINE_MAX = { skiff: '2', cabin: '2', bass: 'E2', kayak: '3', sail: '2', cruiser: 'T', console: 'T', rib: 'T', jetski: '2' };
const FIGHT_MAX = { skiff: '1', cabin: '1', bass: 'E1', kayak: '1', sail: '1', cruiser: '1', console: '1', rib: '1', jetski: '1' };

export const levers = (kind) => LEVERS[kind] || null;
const indexOf = (kind, id) => LEVERS[kind].findIndex((n) => n.id === id);
export const neutralIndex = (kind) => indexOf(kind, 'N');

// The notch nearest a lever value.
export function nearest(kind, v) {
  const L = LEVERS[kind];
  let best = 0;
  for (let i = 1; i < L.length; i++) if (Math.abs(L[i].v - v) < Math.abs(L[best].v - v)) best = i;
  return best;
}

// The highest notch allowed now: 'free' (nothing in the water), 'line' (a line out, or aiming),
// 'line+' (a line out from proper trolling rod holders: a notch faster, see shipyard.js) or
// 'fight' (a fish on).
export function capIndex(kind, situation = 'free') {
  const L = LEVERS[kind];
  if (situation === 'fight') return indexOf(kind, FIGHT_MAX[kind]);
  if (situation === 'line') return indexOf(kind, LINE_MAX[kind]);
  if (situation === 'line+') return Math.min(L.length - 1, indexOf(kind, LINE_MAX[kind]) + 1);
  return L.length - 1;
}

// One notch up (dir 1) or down (-1) from v, within what's allowed. Returns { v, capped }: capped
// says the lever wanted to go further than the situation lets it.
export function step(kind, v, dir, situation = 'free') {
  const L = LEVERS[kind], cap = capIndex(kind, situation);
  const i = nearest(kind, v);
  const want = Math.max(0, Math.min(L.length - 1, i + dir));
  if (want > cap) return { v: L[Math.min(i, cap)].v, capped: true };
  return { v: L[want].v, capped: false };
}

// Set the lever to a notch (by index), within what's allowed.
export function setIndex(kind, i, situation = 'free') {
  const L = LEVERS[kind], cap = capIndex(kind, situation);
  const j = Math.max(0, Math.min(L.length - 1, i));
  if (j > cap) return { v: L[cap].v, capped: true };
  return { v: L[j].v, capped: false };
}

// A lever already set too high for the situation (a line just went out, a fish just took) comes
// back to the highest notch allowed.
export function within(kind, v, situation) {
  const L = LEVERS[kind], cap = capIndex(kind, situation);
  return nearest(kind, v) > cap ? L[cap].v : v;
}

export const notchOf = (kind, v) => LEVERS[kind][nearest(kind, v)];
export const leverWords = (kind, v) => notchOf(kind, v).name;

// Casting from a moving boat: up to about trolling speed the boat goes on as it is (the lure
// lands carried a little along with it); faster than that you'd be casting from a speeding boat.
export const CAST_SPEED = 2.6;

/* ---------------- the real lever ---------------- */

// The other way to drive (Settings → Controls → Throttle): a lever like a real boat's, pushed
// forward or pulled back and left where it is, the revs following it smoothly instead of clicking
// from notch to notch. Its travel runs from -1 (full astern) through 0 (neutral) to 1 (full
// ahead). As on a real outboard's control, the first part of the travel either side of neutral
// only puts her into gear (at GEAR_IN she's in gear at idle: dead slow); beyond that it opens the
// throttle, up to full at the end of its travel. The notches are still marked along it, evenly
// spaced, so trolling speed is where it always was; between them the speed follows smoothly
// (each step along the travel multiplies the power by the same amount, as the revs build). Coming
// back through neutral it stops there (the detent): let go, and push again to go on into astern.

export const GEAR_IN = 0.12;

const aheadOf = (kind) => LEVERS[kind].filter((n) => n.v > 0);
const asternOf = (kind) => LEVERS[kind].find((n) => n.v < 0)?.v ?? 0;
const IDLE_ASTERN = 0.35; // (in astern at idle: this share of the astern notch)

// Where each notch sits along the travel.
export function notchPosition(kind, id) {
  const A = aheadOf(kind), i = A.findIndex((n) => n.id === id);
  if (id === 'N') return 0;
  if (i < 0) return LEVERS[kind].some((n) => n.id === id) ? -1 : 0;
  return A.length > 1 ? GEAR_IN + ((1 - GEAR_IN) * i) / (A.length - 1) : 1;
}

// The lever value (the share of the motor's push, as the notches give it) at a place along the
// travel.
export function valueAt(kind, pos) {
  const p = Math.max(-1, Math.min(1, pos));
  if (Math.abs(p) < GEAR_IN) return 0;
  if (p < 0) {
    const u = (-p - GEAR_IN) / (1 - GEAR_IN);
    return asternOf(kind) * (IDLE_ASTERN + (1 - IDLE_ASTERN) * u);
  }
  const A = aheadOf(kind);
  if (A.length === 1) return A[0].v;
  const f = ((p - GEAR_IN) / (1 - GEAR_IN)) * (A.length - 1);
  const i = Math.min(A.length - 2, Math.floor(f)), u = f - i;
  const a = A[i].v, b = A[i + 1].v;
  return a * Math.pow(b / a, u);
}

// And back: where along the travel a lever value lies (for a lever set some other way: a notch
// tapped on screen, neutral knocked in when a fish takes).
export function positionOf(kind, v) {
  if (!v) return 0;
  if (v < 0) {
    const R = asternOf(kind);
    const u = R ? Math.max(0, Math.min(1, (v / R - IDLE_ASTERN) / (1 - IDLE_ASTERN))) : 0;
    return -(GEAR_IN + u * (1 - GEAR_IN));
  }
  const A = aheadOf(kind);
  if (v <= A[0].v || A.length === 1) return GEAR_IN;
  for (let i = 0; i < A.length - 1; i++) {
    const a = A[i].v, b = A[i + 1].v;
    if (v <= b) return GEAR_IN + ((i + Math.log(v / a) / Math.log(b / a)) / (A.length - 1)) * (1 - GEAR_IN);
  }
  return 1;
}

// The furthest forward the lever may go just now (a line out, a fish on: see capIndex).
export function capPosition(kind, situation = 'free') {
  return notchPosition(kind, LEVERS[kind][capIndex(kind, situation)].id);
}

// Moving the lever: push (-1 … 1, the stick or the keys) moves it, faster the further it's pushed,
// for dt seconds. S: { pos, stopped } (stopped: it came back to neutral while still being pushed,
// and waits there until it's let go). Returns what happened: { detent, capped }.
export const LEVER_RATE = 0.9; // (of its travel a second, pushed all the way)
export function slide(kind, S, push, dt, situation = 'free') {
  const out = { detent: false, capped: false };
  const p = Math.abs(push) < 0.12 ? 0 : push;
  if (!p) {
    S.stopped = false;
    return out;
  }
  if (S.stopped) return out;
  const rate = LEVER_RATE * Math.sign(p) * Math.pow(Math.min(1, (Math.abs(p) - 0.12) / 0.88), 1.5);
  let next = S.pos + rate * dt;
  // (Out of neutral, she drops straight into gear rather than wandering through the empty part
  // of the travel; back from either side, the lever stops at neutral.)
  if (S.pos === 0 && next !== 0) next = Math.sign(next) * Math.max(Math.abs(next), GEAR_IN);
  else if (S.pos !== 0 && Math.sign(next) !== Math.sign(S.pos)) next = 0;
  else if (S.pos !== 0 && Math.abs(next) < GEAR_IN && Math.abs(next) < Math.abs(S.pos)) next = 0;
  if (next === 0 && S.pos !== 0) {
    S.stopped = true;
    out.detent = true;
  }
  const cap = capPosition(kind, situation);
  if (next > cap && p > 0) {
    out.capped = S.pos >= cap - 1e-9;
    next = Math.min(next, Math.max(cap, 0));
  }
  S.pos = Math.max(-1, Math.min(1, next));
  return out;
}

// The lever's place in the same steps as the notches on screen (0 at astern, up to the top
// notch), so a smooth lever's handle sits on the same marks.
export function displayIndex(kind, pos) {
  const L = LEVERS[kind], iN = neutralIndex(kind), A = aheadOf(kind);
  const i0 = L.indexOf(A[0]);
  if (pos >= GEAR_IN) return i0 + ((pos - GEAR_IN) / (1 - GEAR_IN)) * (A.length - 1);
  if (pos >= 0) return iN + (pos / GEAR_IN) * (i0 - iN);
  const iR = L.findIndex((n) => n.v < 0);
  return iN + pos * (iR < 0 ? 0 : iN - iR);
}

// And back, for a finger or the mouse dragging the handle.
export function positionAtIndex(kind, f) {
  const L = LEVERS[kind], iN = neutralIndex(kind), A = aheadOf(kind);
  const i0 = L.indexOf(A[0]);
  if (f >= i0) return Math.min(1, GEAR_IN + ((f - i0) / Math.max(1, A.length - 1)) * (1 - GEAR_IN));
  if (f >= iN) return f - iN < (i0 - iN) * 0.5 ? 0 : GEAR_IN;
  const iR = L.findIndex((n) => n.v < 0);
  return iR < 0 ? 0 : Math.max(-1, -(iN - f) / Math.max(1, iN - iR));
}

// In words, as the lever's own reading: 'neutral', 'ahead, idle', 'ahead, 40%', 'full ahead',
// 'astern, idle'.
export function leverPositionWords(pos) {
  if (Math.abs(pos) < GEAR_IN) return 'neutral';
  const open = Math.round(((Math.abs(pos) - GEAR_IN) / (1 - GEAR_IN)) * 100);
  const way = pos > 0 ? 'ahead' : 'astern';
  if (open <= 2) return `${way}, idle`;
  if (open >= 98) return `full ${way}`;
  return `${way}, ${open}%`;
}
