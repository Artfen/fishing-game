// (W6) Spray and spindrift: what a strong wind tears off the crests breaking round you, and how
// it flies. The numbers storm.js draws it by, kept here on their own so they can be tested.
//
//  · Where: from the crests breaking now (the long waves' own, where they're pinched past folding:
//    ocean.js breakingAt), in proportion to how hard each is breaking, so the spray comes off the
//    whitecaps you see and nowhere else.
//  · When: spume, the drops the wind tears from the crests, begins somewhere between 7 and 11 m/s
//    (Andreas et al. 1995, a review: the usual "9 m/s" is a rule of thumb within that range);
//    by force 8 on the Beaufort scale (17.2 m/s) "the edges of the crests begin to break into
//    spindrift". The harder it blows, the more of it from each crest (as the wind's square: our
//    choice) and the more crests breaking (the whitecaps' own cover, ocean.js).
//  · How it flies: each drop is pulled towards the wind's speed and falls at its own terminal
//    speed. Taking the air's drag as linear in the slip between them, its velocity relaxes towards
//    (the wind, −vt) in a time vt/g: the finest, falling at half a metre a second, catch the wind in
//    a twentieth of a second and stream low over the sea for tens of metres; heavy spray, falling
//    at 3 or 4, arcs up and drops back close by. Worked out exactly for each frame's step, so a
//    long frame can't throw a drop off.
//  · The wind it flies in: near the water slower than the 10 m wind the game's wind is, by the
//    log profile over a rough sea (z0 about a millimetre): about 0.8 of it a metre or two up. And
//    gusty: the air close over the sea is turbulent, its eddies going up and down at about 1.25
//    times the friction velocity u* (√Cd·U, Cd about 1.2·10⁻³ to 2·10⁻³ in a gale), half a metre a
//    second or more in a gale. That's as fast as the finest drops fall, so they're carried up and
//    along by it, over the troughs, not let fall straight back: each drop is given the eddy it's
//    torn into (eddy), which carries it for its short flight.
//  · On the water: foam blown in streaks down the wind from force 7 (13.9 m/s: "begins to be blown
//    in streaks"), well marked at force 8 and dense at force 9 (20.8 m/s): streakShare, which the
//    water's shader works out the same way from the wind (water.js).

const G = 9.81;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The wind (m/s) where spume begins to be torn off the crests, and where all of them that break
// give it.
export const SPUME = [7, 11];
export const spumeShare = (u) => smooth(SPUME[0], SPUME[1], u);

// Puffs of spray a second, for each square metre of crest breaking, by the wind (our calibration:
// in a full gale, a few hundred puffs a second within 50 m of you, each a cloud of drops).
export const SPUME_RATE = 0.39;
export const SPUME_REF = 14;
export const spumeRate = (u) => SPUME_RATE * spumeShare(u) * (u / SPUME_REF) ** 2;

// The wind a metre or two above the waves, as a share of the 10 m wind (ln(1.5/z0) / ln(10/z0),
// z0 = 1 mm).
export const SURFACE_WIND = Math.log(1.5 / 1e-3) / Math.log(10 / 1e-3);

// Foam blown in streaks on the water: none to force 6 (to 13.8 m/s), beginning at force 7 (13.9),
// well marked at 8, dense at 9 (20.8). (The water's shader reads these: water.js.)
export const STREAKS = [13.9, 20.8];
export const streakShare = (u) => smooth(STREAKS[0], STREAKS[1], u);

// The air's up-and-down eddies over the sea (m/s, their spread): 1.25·u*, u* = √Cd·U with the drag
// coefficient rising with the wind (Large and Pond's 1981 fit: 1.2·10⁻³ to 11 m/s, then
// (0.49 + 0.065·U)·10⁻³).
export const dragCoefficient = (u) => (u < 11 ? 1.2e-3 : (0.49 + 0.065 * u) * 1e-3);
export const eddySpread = (u) => 1.25 * Math.sqrt(dragCoefficient(u)) * u;

// One step of a drop's flight (dt seconds), exactly: p { x, y, z, vx, vy, vz } flying in the wind
// (wx, wz), in an eddy going up at wy (m/s; 0 still air), and falling at vt (m/s) in still air.
// Changes p.
export function fly(p, wx, wz, vt, dt, wy = 0) {
  const tau = vt / G, k = Math.exp(-dt / tau), a = tau * (1 - k), sy = wy - vt;
  p.x += wx * dt + (p.vx - wx) * a;
  p.y += sy * dt + (p.vy - sy) * a;
  p.z += wz * dt + (p.vz - wz) * a;
  p.vx = wx + (p.vx - wx) * k;
  p.vy = sy + (p.vy - sy) * k;
  p.vz = wz + (p.vz - wz) * k;
  return p;
}

// How long a drop thrown up at vy (m/s), falling at vt in still air, takes to come down to `drop`
// metres below where it started (Newton's method on its height, from where it's falling steadily).
// (In an eddy going up at wy it falls at vt − wy: pass that.)
export function flightTime(vy, vt, drop) {
  const tau = vt / G, c = (vy + vt) * tau;
  let t = Math.max(1e-3, (drop + c) / vt);
  for (let i = 0; i < 6; i++) {
    const e = Math.exp(-t / tau), f = -vt * t + c * (1 - e) + drop, df = -vt + (vy + vt) * e;
    if (df > -1e-6) break;
    const n = t - f / df;
    if (!(n > 0)) break;
    t = n;
  }
  return t;
}
