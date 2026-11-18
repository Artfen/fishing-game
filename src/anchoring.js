// (B6) An anchor and its rode: the rope's shape between the bow and the anchor, and what the anchor
// holds in the bottom it's in. Pure: boat.js drives it, hydro.js puts the rode's pull on her.
//
// The rode is an elastic catenary (Irvine 1981; as in Faltinsen, Sea Loads on Ships and Offshore
// Structures, ch. 8): a line with a weight in water w (N per metre) and a stretch EA (N), from the
// anchor on the bottom to her fairlead, X along the bottom and h above it. Some of it lies along the
// bottom from the anchor and the rest hangs up to her bow (then the pull on the anchor is level);
// or, pulled hard enough, all of it's off the bottom and it lifts at the anchor (by its angle
// there, theta). Her pull on it: H, level, the same all along; and at her bow the weight of what
// hangs (V) as well.
//
// What an anchor holds:
// - Its angle. An anchor holds best pulled along the bottom; lifted at its shank, less and less,
//   and past about 35° it pulls out. Pat Piper's table of holding against scope (a taut rode's
//   angle is asin(1/scope)): 3:1 holds 53% of what 10:1 does, 5:1 77%, 7:1 91%; the US Sailing anchor
//   study, 5:1 about 80% of 10:1. 1 - theta/35° gives 53%, 80% and 91%.
// - The bottom (the fish finder reads it, sonarRead.js bottomOf). Sand holds best; firm mud well,
//   the game's (soft, silty, offshore) less; gravel poorly unless it's sandy; weed worst, the anchor
//   skating over it or held by a root bundle, unless it gets through to what's under; rock, it hooks
//   on something (and holds hard) or skids. None of the tests I could reach gave figures for these
//   (they're qualitative everywhere, BoatingNZ, Practical Sailor, sailing guides), so the numbers
//   are ours, in that order.
// - How well it's set. Dropped, it lies on the bottom; dragged, it digs in, to its full hold over a
//   metre or so in sand and a few in mud (the US Navy's NCEL guidance on drag anchors: three to five
//   fluke lengths in mud, less in sand).

// What an ordinary anchor holds, steadily, dug into sand at the scope a skipper pays out (boat.js
// holdAnchor), as a share of her weight: the game's calibration, as before B6 (B3's), that it holds
// her through a gale and drags in the game's storm. Measured on the rode's level pull at five to
// one in 9 m of open water over three minutes, the steadied pull's peak: in the storm 0.10 to 0.21
// of her weight (cabin boat, skiff, centre console, rowing boat), in a gale 0.04 to 0.05. (Before
// B6 it was 0.12 of the rope's whole pull, on a short, steep rope at two and a half to one, which
// counted its downward pull at her bow too.)
export const ANCHOR_HOLD = 0.08;

export const UPLIFT_OUT = (35 * Math.PI) / 180;
// What an anchor holds, lifted theta (radians) at its shank, against pulled level.
export const uplift = (theta) => Math.max(0, 1 - Math.max(0, theta) / UPLIFT_OUT);
// The scope a skipper pays out (mooring.js rodeFor): a taut rope's angle at that scope.
export const SCOPE_REF = 5;
export const UPLIFT_REF = uplift(Math.asin(1 / SCOPE_REF));

// By the bottom, against sand: hold; set: metres dragged to dig in (to 63% of the way from its first
// bite, see setBy).
export const BOTTOMS = {
  sand: { hold: 1, set: 0.8 },
  mud: { hold: 0.6, set: 2 },
  gravel: { hold: 0.5, set: 0.6 },
  weed: { hold: 0.3, set: 1.5 },
  rock: { hold: 0.15, set: 0.3 },
};
// Rock: hooked on something, it holds this hard (and won't come up easily).
export const ROCK_HOOKED = 1.3;
// Weed: it gets through to what's under this often (in a given spot), and then holds a little less
// than it would there (the weed still in its flukes).
export const WEED_THROUGH = 0.35;
// Rock: it hooks on something this often.
export const ROCK_HOOKS = 0.4;
// What it holds, just dropped (lying on the bottom, not yet dug in).
export const BITE = 0.15;

// A die for a spot on the bottom (0 … 1), the same for anyone dropping there.
export function spotDie(x, z, salt = 0) {
  const s = Math.sin(Math.round(x) * 12.9898 + Math.round(z) * 78.233 + salt * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

// Where it went down: { kind, under } (sonarRead.js bottomOf) at (x, z) -> what it'll hold there,
// as a share of what it would in sand: { kind, hold, set, hooked, through }.
export function anchorBottom(bottom, x = 0, z = 0) {
  const kind = BOTTOMS[bottom?.kind] ? bottom.kind : 'sand';
  if (kind === 'rock') {
    const hooked = spotDie(x, z, 1) < ROCK_HOOKS;
    return { kind, hold: hooked ? ROCK_HOOKED : BOTTOMS.rock.hold, set: BOTTOMS.rock.set, hooked, through: false };
  }
  if (kind === 'weed') {
    const under = BOTTOMS[bottom.under] && bottom.under !== 'weed' ? bottom.under : 'sand';
    const through = spotDie(x, z, 2) < WEED_THROUGH;
    return through
      ? { kind, under, hold: BOTTOMS[under].hold * 0.85, set: BOTTOMS[under].set, hooked: false, through }
      : { kind, under, hold: BOTTOMS.weed.hold, set: BOTTOMS.weed.set, hooked: false, through };
  }
  return { kind, hold: BOTTOMS[kind].hold, set: BOTTOMS[kind].set, hooked: false, through: false };
}

// How well set it is (BITE … 1), dragged `d` metres in a bottom that sets in `set` metres.
export const setBy = (d, set) => 1 - (1 - BITE) * Math.exp(-Math.max(0, d) / set);

// The rodes. w: weight in water, N per metre; EA: stretch, N (so a length L gives EA/L N a metre),
// both for a boat of mass m (kg): sized to her.
// - Rope (the ordinary anchor's): nylon with a few metres of chain at the anchor, its weight spread
//   along it (so it lies nearly straight once it's pulling). Stretch: the game's rope as before
//   (8·m N a metre over 25 m of it), so longer is softer, as a rope is.
// - Chain (the heavier anchor's, a Marine Works fitting): all chain, with a nylon snubber at the bow
//   for its stretch (a chain pulled straight would snatch). 6 mm chain for a tonne of boat (about
//   0.7 kg a metre in water), heavier for a heavier boat.
export function rodeOf(kind, m) {
  const s = Math.cbrt(Math.max(50, m) / 1000);
  if (kind === 'chain') return { kind, w: 0.7 * 9.81 * s * s, EA: 800 * m };
  return { kind: 'rope', w: 0.09 * 9.81 * s * s, EA: 200 * m };
}

const asinh = Math.asinh, sq = Math.sqrt;

// Hanging from its touchdown (level there) with horizontal pull H: the length off the bottom Ls that
// rises h (stretch included).
function liftLen(H, h, w, EA) {
  let L = sq(h * h + (2 * h * H) / w);
  for (let i = 0; i < 4; i++) {
    const u = (w * L) / H, r = sq(1 + u * u);
    const f = (H / w) * (r - 1) + (w * L * L) / (2 * EA) - h;
    const d = u / r + (w * L) / EA;
    L -= f / d;
  }
  return L;
}

// All of it off the bottom (length L): the upward pull Va at the anchor that makes it rise h.
function anchorLift(H, h, L, w, EA) {
  const rise = (Va) => {
    const a0 = Va / H, a1 = (Va + w * L) / H;
    return (H / w) * (sq(1 + a1 * a1) - sq(1 + a0 * a0)) + (Va * L + (w * L * L) / 2) / EA - h;
  };
  // (It rises more the harder it's lifted: bracket it, then bisect a few times and finish by secant.)
  let lo = 0, hi = Math.max(1, H);
  while (rise(hi) < 0 && hi < 1e9) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi);
    if (rise(mid) < 0) lo = mid; else hi = mid;
    if (hi - lo < 1e-6 * (1 + hi)) break;
  }
  return 0.5 * (lo + hi);
}

// How far along the bottom her bow is from the anchor (X) with the rode pulled level by H, h above
// the bottom, L of it out. Fills `o` (the rode's shape).
function spanAt(H, h, L, R, o) {
  const { w, EA } = R;
  const Ls = liftLen(H, h, w, EA);
  if (Ls <= L) {
    o.Ls = Ls; o.lying = L - Ls; o.Va = 0;
    return L - Ls + (H / w) * asinh((w * Ls) / H) + (H * L) / EA;
  }
  const Va = anchorLift(H, h, L, w, EA);
  o.Ls = L; o.lying = 0; o.Va = Va;
  return (H / w) * (asinh((Va + w * L) / H) - asinh(Va / H)) + (H * L) / EA;
}

// Its angle at the anchor (radians) pulled level by H, h above the bottom, L of it out: none while
// some of it lies along the bottom.
export function liftAngle(H, h, L, R) {
  if (H <= 0) return 0;
  const Ls = liftLen(H, Math.max(0.05, h), R.w, R.EA);
  if (Ls <= L) return 0;
  return Math.atan2(anchorLift(H, Math.max(0.05, h), L, R.w, R.EA), H);
}

// The rode's shape with her bow X from the anchor along the bottom and h above it, L of it out:
// { H (level pull, N), V (the downward pull at her bow), Va (upward at the anchor), theta (its
// angle at the anchor), Ls (off the bottom), lying (along it), k (dH/dX: how stiff it is there) }.
// Hmax: the most it's asked (past it, it's held there). guess: last step's H, to start from.
export function rodeShape(X, h, L, R, Hmax = 1e6, guess = 0, o = {}) {
  h = Math.max(0.05, h);
  // (Never shorter than reaches the bottom.)
  L = Math.max(L, h + 0.05);
  o.X = X; o.h = h; o.L = L;
  // Slack: less than hanging straight down and lying along the bottom.
  const H0 = 1e-3 * R.w;
  const X0 = spanAt(H0, h, L, R, o);
  if (X <= X0) {
    o.H = 0; o.V = R.w * Math.min(L, h); o.Va = 0; o.theta = 0; o.Ls = Math.min(L, h); o.lying = Math.max(0, L - h); o.k = 0;
    return o;
  }
  let lo = H0, hi = Math.max(guess * 2, R.w * L, 10);
  while (spanAt(hi, h, L, R, o) < X && hi < Hmax) hi = Math.min(Hmax, hi * 2);
  let H;
  if (spanAt(hi, h, L, R, o) < X) H = hi;
  else {
    // (Bisection on a log scale, then a little regula falsi: the span grows with H throughout.)
    for (let i = 0; i < 48; i++) {
      const mid = Math.sqrt(lo * hi);
      if (spanAt(mid, h, L, R, o) < X) lo = mid; else hi = mid;
      if (hi / lo < 1 + 1e-7) break;
    }
    H = 0.5 * (lo + hi);
  }
  const x1 = spanAt(H * 1.001, h, L, R, o);
  const x0 = spanAt(H, h, L, R, o);
  o.k = x1 > x0 ? (H * 0.001) / (x1 - x0) : 0;
  o.H = H;
  o.V = o.Va + R.w * o.Ls;
  o.theta = Math.atan2(o.Va, H);
  return o;
}

// Points along it for drawing, in its plane: [s (from the anchor, along the bottom), y (above it)]
// for n + 1 points, from the anchor to her bow.
export function rodePoints(o, R, n, out = []) {
  const X = o.X, w = R.w;
  for (let i = 0; i <= n; i++) {
    const p = (out[i] ||= [0, 0]);
    if (!o.H) {
      // (Slack: along the bottom, then up to her.)
      const u = i / n, lie = Math.min(o.lying, Math.max(0, X - 0.2));
      const s = u * X;
      p[0] = s;
      p[1] = s <= lie ? 0 : o.h * Math.pow((s - lie) / Math.max(1e-3, X - lie), 2.2);
      continue;
    }
    const a = o.H / w;
    // Its lowest point: at the touchdown (lying along the bottom before it), or under the bottom
    // if it lifts at the anchor.
    const c0 = a * asinh(o.Va / o.H);
    const xt = o.lying > 0 ? X - a * asinh((w * o.Ls) / o.H) : -c0;
    const s = (i / n) * X;
    p[0] = s;
    if (o.lying > 0 && s <= xt) p[1] = 0;
    else {
      const base = o.lying > 0 ? 0 : a * (Math.cosh(c0 / a) - 1);
      p[1] = Math.max(0, a * (Math.cosh((s - xt) / a) - 1) - base);
    }
  }
  // (Stretch and the drawing's few points: end it at her bow.)
  const last = out[n][1];
  if (last > 0) for (let i = 0; i <= n; i++) out[i][1] *= o.h / last;
  return out;
}
