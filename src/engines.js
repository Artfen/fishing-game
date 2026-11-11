// The engine catalogue: which outboards a boat's transom takes, the propellers for each, and what
// they do to her (B1 of docs/WORLD-DEPTH.md: the RIB first; the other boats follow).
//
// The figures are typical of current four-stroke outboards of each size, rounded: not any one
// maker's. The names are the game's own (the Fulmar fours and the Skua V6s), with no maker's marks.
//
// How an engine and its propeller push her. Below the speed her propeller is pitched for, the
// engine is working against the water at the throttle's torque: the push is near enough steady,
// the throttle's share of her full push. At the speed it's pitched for, the engine turns its
// rated revs and gives its rated power; past that the revs climb into the limiter and the push
// falls away. A propeller is matched to an engine when that speed is the boat's own top speed
// with that engine (her resistance against power over speed). So:
//  · more power: more push at every speed, and a higher top speed (as the cube root of the power,
//    near enough, since her resistance at speed grows as the square of it);
//  · a lower pitch: more push below (quicker out of the hole, better with a load aboard), but the
//    engine's at its limiter before she reaches her best;
//  · a heavier engine: carried in her (heavier, slower, lower), like everything else aboard.
// Her own engine on its own propeller, the 150 on its matched 17-inch three-blade, gives exactly
// the push she has always had: the catalogue is calibrated on it.
//
// Fuel follows the work the engine does: its own rate flat out (a bigger engine burns more at
// full throttle) times the throttle's share of its matched push, so at the same speed a lower
// pitch burns what the matched one does (a touch more at the limiter), and a bigger engine,
// eased back to the same speed, about the same as a smaller one, plus what its weight costs.

// Outboards: hp, kg (dry), litres an hour flat out (lph), cylinders, gear ratio, how it looks
// (cowl and band colours: plain, no badges; tall: the V6's taller cowling) and sounds (pitch: its
// note against the 150's; smooth: how much the putter smooths out, a V6 more even than a four),
// and what the Marine Works charges to put it on (price, with the old engine taken in).
export const OUTBOARDS = {
  f115: {
    name: 'Fulmar 115', hp: 115, kg: 172, lph: 42, layout: 'four-stroke, inline four, 2.0 litres', gear: 2.07,
    look: { cowl: '#1d2125', band: '#9aa1a7', tall: 1 }, voice: { pitch: 1.1, smooth: 0 },
    price: 90,
    desc: 'The light four: forty-odd kilos off her transom, a few knots off her best, and the least fuel flat out.',
  },
  f150: {
    name: 'Fulmar 150', hp: 150, kg: 216, lph: 56, layout: 'four-stroke, inline four, 2.8 litres', gear: 2.0,
    look: null, voice: null,
    price: 90,
    desc: 'The engine she came with: a good all-rounder for a 6.5-metre RIB.',
  },
  s200: {
    name: 'Skua 200', hp: 200, kg: 240, lph: 74, layout: 'four-stroke, V6, 3.4 litres', gear: 1.85,
    look: { cowl: '#e6e8e5', band: '#29486b', tall: 1.16 }, voice: { pitch: 0.82, smooth: 0.45 },
    price: 520,
    desc: 'A V6: noticeably quicker out of the hole and a good few knots more flat out, for more fuel at full throttle.',
  },
  s225: {
    name: 'Skua 225', hp: 225, kg: 250, lph: 83, layout: 'four-stroke, V6, 3.4 litres', gear: 1.85,
    look: { cowl: '#e6e8e5', band: '#7a2b2b', tall: 1.18 }, voice: { pitch: 0.8, smooth: 0.5 },
    price: 640,
    desc: 'As much as her plate allows: the quickest she goes, and the thirstiest.',
  },
};

// Propellers, against the engine's matched pitch (dp, inches): three blades on the matched pitch
// (her best top speed), three on two inches less (the hole shot, and a load), four blades of
// stainless on an inch less (they grip in a seaway and when she's trimmed high: a sea costs her
// less speed). rpm: what the engine turns flat out on it; price: fitted.
export const PROPS = {
  matched: {
    name: 'Three blades, matched pitch', dp: 0, blades: 3, steel: false, grip: 0, rpm: 6000, price: 45,
    desc: 'Her engine turns its rated revs at her top speed: the best she does flat out.',
  },
  low: {
    name: 'Three blades, two inches less pitch', dp: -2, blades: 3, steel: false, grip: 0, rpm: 6300, price: 45,
    desc: 'Up onto the plane quicker and stronger with a load aboard; the engine reaches its limiter a couple of knots short of her best.',
  },
  four: {
    name: 'Four blades, stainless, an inch less pitch', dp: -1, blades: 4, steel: true, grip: 0.35, rpm: 6150, price: 160,
    desc: 'Bites in a sea and when she’s trimmed high: a seaway slows her less. A little quicker out of the hole, a little short of her best flat out.',
  },
};
export const PROP_IDS = Object.keys(PROPS);

// Which boats have a catalogue, their engines, the one they come with, and the most power their
// capacity plate allows. drag: her resistance under way as the game runs her (the air on her,
// her trim, the hump) over the hull's own curve (HULLS drag): measured by tools/engine-trials.mjs
// from her top speed on her own engine, so a matched propeller is matched to the boat you drive.
export const CATALOGUE = {
  rib: { stock: 'f150', models: ['f115', 'f150', 's200', 's225'], plate: 225, drag: 1.0732 },
};
export const hasCatalogue = (kind) => !!CATALOGUE[kind];

// (Pitch: how far a turn would screw it through the water, less a tenth for slip, at the engine's
// rated revs flat out.)
const SLIP = 0.1, INCH = 0.0254, RATED = 6000;

// The speed (m/s) where f(v), rising, crosses zero.
function solve(f, lo = 0.1, hi = 60) {
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

// A choice made sensible for a boat: { model, prop } (her own engine on its matched propeller if
// there's nothing to go by).
export function cleanChoice(kind, raw) {
  const C = CATALOGUE[kind];
  if (!C) return null;
  const r = raw && typeof raw === 'object' ? raw : {};
  return { model: C.models.includes(r.model) ? r.model : C.stock, prop: PROPS[r.prop] ? r.prop : 'matched' };
}
export const isStock = (kind, choice) => !CATALOGUE[kind] || (cleanChoice(kind, choice).model === CATALOGUE[kind].stock && cleanChoice(kind, choice).prop === 'matched');

// What an engine and propeller do on this hull (her HULLS entry), or null for a boat without a
// catalogue:
//   thrust  her push below the propeller's speed, as an acceleration on her own weight (m/s²:
//           her motor's thrust, as before);
//   vd      the speed (m/s) the propeller's pitched for: past a twentieth over it, the limiter;
//   astern  her push going astern;
//   effort  how hard the engine works for a throttle setting: this propeller's push over the
//           matched one's (the fuel follows it);
//   burn    her fuel flat out against her own engine's;
//   kg      the engine's weight over her own engine's (carried in her);
//   grip    how much less speed a seaway costs her (0 … 1);
//   rpm     the revs flat out; pitch (inches); scale (the outboard drawn); look, blades, steel
//           and voice (how it's drawn and heard); name, hp, and the ids.
export function engineSpec(kind, hull, choice) {
  const C = CATALOGUE[kind], M = hull?.motor;
  if (!C || !M) return null;
  const { model, prop } = cleanChoice(kind, choice);
  const O = OUTBOARDS[model], S = OUTBOARDS[C.stock], P = PROPS[prop];
  const m0 = hull.mass, dkg = O.kg - S.kg;
  const resist = (v) => C.drag * (hull.drag[0] * v + hull.drag[1] * v * v);
  // Her own engine's power (as a power on her own weight: m²/s³), from her own push at her own
  // top speed; then this engine's top speed, its weight aboard.
  const v0 = solve((v) => resist(v) - M.thrust);
  const P0 = M.thrust * v0, Pe = (P0 * O.hp) / S.hp;
  const stock = model === C.stock;
  const vm = stock ? v0 : solve((v) => (v * resist(v) * (m0 + dkg)) / m0 - Pe);
  const Tm = stock ? M.thrust : Pe / vm;
  // The matched pitch, in whole inches, and this propeller's against it.
  const pitch = Math.round((vm * 60 * O.gear) / RATED / (1 - SLIP) / INCH);
  const k = (pitch + P.dp) / pitch;
  return {
    kind, model, prop, name: O.name, hp: O.hp, propName: P.name, pitch: pitch + P.dp,
    thrust: Tm / k, vd: vm * k, astern: (M.astern * Tm) / M.thrust,
    effort: 1 / k, burn: O.lph / S.lph, kg: dkg, grip: P.grip, rpm: P.rpm,
    scale: (M.scale ?? 1) * Math.cbrt(O.kg / S.kg), look: O.look, blades: P.blades, steel: P.steel, voice: O.voice,
  };
}

// The rev limiter: how much of her push is left at this speed (1 until a twentieth past the
// propeller's speed, then falling away to nothing a fourteenth further on).
export const LIMIT = [1.05, 0.07];
export function pushAt(S, v) {
  const a = Math.abs(v) / S.vd;
  return a <= LIMIT[0] ? S.thrust : S.thrust * Math.max(0, 1 - (a - LIMIT[0]) / LIMIT[1]);
}

// Knots, from m/s.
export const KN = 1 / 0.514444;

// The speed the Marine Works quotes a cruise at (knots: a RIB's easy pace on the plane), and
// how far a tank goes there (nautical miles; trial from engineTrials.js, litres in her tank).
export const CRUISE_KN = 25;
export const rangeAt = (trial, litres) => (trial?.lph > 0 ? (litres / trial.lph) * CRUISE_KN : 0);
