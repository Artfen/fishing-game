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
  // The motor cruiser: heavy, and quick once she's going.
  cruiser: [
    { v: -0.3, id: 'R', name: 'astern' },
    { v: 0, id: 'N', name: 'neutral' },
    { v: 0.06, id: '1', name: 'dead slow' },
    { v: 0.135, id: '2', name: 'slow ahead' },
    { v: 0.48, id: '3', name: 'half ahead' },
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
const LINE_MAX = { skiff: '2', cabin: '2', bass: 'E2', kayak: '3', sail: '2', cruiser: '2', jetski: '2' };
const FIGHT_MAX = { skiff: '1', cabin: '1', bass: 'E1', kayak: '1', sail: '1', cruiser: '1', jetski: '1' };

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

// The highest notch allowed now: 'free' (nothing in the water), 'line' (a line out, or aiming)
// or 'fight' (a fish on).
export function capIndex(kind, situation = 'free') {
  const L = LEVERS[kind];
  if (situation === 'fight') return indexOf(kind, FIGHT_MAX[kind]);
  if (situation === 'line') return indexOf(kind, LINE_MAX[kind]);
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
