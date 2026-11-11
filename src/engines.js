// The engine catalogue: which engines each motorboat takes, the propellers for each, and what they
// do to her (B1 and B2 of docs/WORLD-DEPTH.md): portable outboards for the motor skiff, mid-size
// outboards for the bass boat and the cabin boat, a pair of big outboards on the centre console,
// one on the RIB, and twin diesels in the yacht.
//
// The figures are typical of current engines of each size, rounded: not any one maker's. The names
// are the game's own (the Petrel portables, the Tern threes, the Fulmar fours, the Skua V6s and the
// Shearwater diesels), with no maker's marks.
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
// Each boat's own engine on its own propeller gives exactly the push she has always had: the
// catalogue is calibrated on it.
//
// Fuel follows the work the engine does: its own rate flat out (a bigger engine burns more at
// full throttle) times the throttle's share of its matched push, so at the same speed a lower
// pitch burns what the matched one does (a touch more at the limiter), and a bigger engine,
// eased back to the same speed, about the same as a smaller one, plus what its weight costs.

// The engines: hp, kg (dry), litres an hour flat out (lph), layout, gear ratio, rated revs (rpm),
// how it looks (cowl and band colours: plain, no badges; tall: a V6's taller cowling) and sounds
// (note: its pitch, against a big four's; smooth: how even its beat, a V6 more than a four), and
// what the Marine Works charges to fit it (price, with the old one taken in part exchange).
export const MODELS = {
  // The Petrel portables, for a tiller: light enough to carry.
  p6: {
    name: 'Petrel 6', hp: 6, kg: 27, lph: 2.3, layout: 'four-stroke, single cylinder, 0.14 litres', gear: 1.92, rpm: 5500,
    look: { cowl: '#e9e5dc', band: '#2f4f7a', tall: 0.92 }, note: 1.5, smooth: 0, price: 40,
    desc: 'A single-cylinder portable: light, and it sips fuel; slow with two aboard.',
  },
  p10: {
    name: 'Petrel 9.9', hp: 9.9, kg: 40, lph: 3.7, layout: 'four-stroke, twin, 0.21 litres', gear: 2.08, rpm: 5500,
    look: { cowl: '#e9e5dc', band: '#2f4f7a', tall: 1 }, note: 1.4, smooth: 0, price: 40,
    desc: 'The classic small-boat twin: enough to get a light skiff up and going.',
  },
  p15: {
    name: 'Petrel 15', hp: 15, kg: 45, lph: 5.5, layout: 'four-stroke, twin, 0.35 litres', gear: 2.08, rpm: 5500,
    look: { cowl: '#e9e5dc', band: '#7a2b2b', tall: 1.04 }, note: 1.33, smooth: 0, price: 120,
    desc: 'Half as much power again for a few kilos more: quicker up, and a few knots more.',
  },
  p20: {
    name: 'Petrel 20', hp: 20, kg: 48, lph: 7.2, layout: 'four-stroke, twin, 0.35 litres', gear: 2.08, rpm: 5700,
    look: { cowl: '#e9e5dc', band: '#7a2b2b', tall: 1.06 }, note: 1.3, smooth: 0, price: 170,
    desc: 'As much as a small skiff wants: she fairly leaps along, and drinks for it.',
  },
  // The Tern threes (and the Tern 90, a four).
  t30: {
    name: 'Tern 30', hp: 30, kg: 72, lph: 11, layout: 'four-stroke, three cylinders, 0.75 litres', gear: 1.92, rpm: 6000,
    look: { cowl: '#2b2e33', band: '#2f7a5a', tall: 0.96 }, note: 1.22, smooth: 0.1, price: 120,
    desc: 'A light three: gentle on fuel, slower up to speed.',
  },
  t40: {
    name: 'Tern 40', hp: 40, kg: 95, lph: 15, layout: 'four-stroke, three cylinders, 1.0 litres', gear: 1.83, rpm: 6000,
    look: { cowl: '#2b2e33', band: '#2f7a5a', tall: 1 }, note: 1.2, smooth: 0.1, price: 150,
    desc: 'A willing three-cylinder, smooth and easy to live with.',
  },
  t60: {
    name: 'Tern 60', hp: 60, kg: 112, lph: 22, layout: 'four-stroke, three cylinders, 1.0 litres', gear: 2.0, rpm: 6000,
    look: { cowl: '#2b2e33', band: '#b8312f', tall: 1.04 }, note: 1.16, smooth: 0.1, price: 260,
    desc: 'The bigger three: real punch for its weight.',
  },
  t90: {
    name: 'Tern 90', hp: 90, kg: 165, lph: 33, layout: 'four-stroke, inline four, 1.8 litres', gear: 2.08, rpm: 6000,
    look: { cowl: '#2b2e33', band: '#b8312f', tall: 1.08 }, note: 1.08, smooth: 0.15, price: 420,
    desc: 'A four-cylinder in a light case: lively, and thirstier.',
  },
  // The Fulmar fours.
  f115: {
    name: 'Fulmar 115', hp: 115, kg: 172, lph: 42, layout: 'four-stroke, inline four, 2.0 litres', gear: 2.07, rpm: 6000,
    look: { cowl: '#1d2125', band: '#9aa1a7', tall: 1 }, note: 1.1, smooth: 0.2, price: 90,
    desc: 'The light four: lighter on the transom and on fuel flat out than the 150, a few knots slower.',
  },
  f150: {
    name: 'Fulmar 150', hp: 150, kg: 216, lph: 56, layout: 'four-stroke, inline four, 2.8 litres', gear: 2.0, rpm: 6000,
    look: { cowl: '#1d2125', band: '#9aa1a7', tall: 1.04 }, note: 1, smooth: 0.2, price: 90,
    desc: 'A big four: a good all-rounder, strong and economical.',
  },
  // The Skua V6s.
  s200: {
    name: 'Skua 200', hp: 200, kg: 240, lph: 74, layout: 'four-stroke, V6, 3.4 litres', gear: 1.85, rpm: 6000,
    look: { cowl: '#e6e8e5', band: '#29486b', tall: 1.16 }, note: 0.82, smooth: 0.65, price: 520,
    desc: 'A V6: noticeably quicker out of the hole and a good few knots more flat out, for more fuel at full throttle.',
  },
  s225: {
    name: 'Skua 225', hp: 225, kg: 250, lph: 83, layout: 'four-stroke, V6, 3.4 litres', gear: 1.85, rpm: 6000,
    look: { cowl: '#e6e8e5', band: '#7a2b2b', tall: 1.18 }, note: 0.8, smooth: 0.7, price: 640,
    desc: 'The biggest V6: the quickest she goes, and the thirstiest.',
  },
  // The Shearwater diesels, inboard: heavy, long-lived, and far thriftier than petrol for the power.
  d260: {
    name: 'Shearwater 260', hp: 260, kg: 480, lph: 50, layout: 'diesel, inline six, 4.2 litres, turbocharged', gear: 2.0, rpm: 3200,
    look: null, note: 1.06, smooth: 0, price: 900, inboard: true,
    desc: 'The smaller six: lighter in her, gentler on fuel, a couple of knots slower.',
  },
  d320: {
    name: 'Shearwater 320', hp: 320, kg: 520, lph: 62, layout: 'diesel, inline six, 5.5 litres, turbocharged', gear: 2.0, rpm: 3200,
    look: null, note: 1, smooth: 0, price: 900, inboard: true,
    desc: 'A big six that will run all day: the yacht’s all-round pair.',
  },
  d370: {
    name: 'Shearwater 370', hp: 370, kg: 545, lph: 72, layout: 'diesel, inline six, 5.5 litres, turbocharged', gear: 2.0, rpm: 3200,
    look: null, note: 0.97, smooth: 0, price: 1400, inboard: true,
    desc: 'The same block turned up: a couple of knots more, for more fuel.',
  },
  d440: {
    name: 'Shearwater 440', hp: 440, kg: 610, lph: 86, layout: 'diesel, inline six, 6.7 litres, turbocharged', gear: 2.0, rpm: 3200,
    look: null, note: 0.93, smooth: 0, price: 2100, inboard: true,
    desc: 'The big six: the fastest passage south, and a thirst to match.',
  },
};

// Propellers, against the engine's matched pitch (k: their pitch over it): matched (her best top
// speed), an eighth less (the hole shot, and a load: two inches on a RIB's), and on an outboard
// four blades of stainless a sixteenth less (they grip in a seaway and when she's trimmed high: a
// sea costs her less speed). rpmK: the
// revs flat out on it, against the engine's rated revs (a lower pitch runs it up to its limiter);
// price: fitted. (An inboard's propellers have four blades whatever their pitch.)
export const PROPS = {
  matched: {
    name: 'Three blades, matched pitch', inboard: 'Four blades, matched pitch', k: 1, blades: 3, steel: false, grip: 0, rpmK: 1, price: 45,
    desc: 'Her engine turns its rated revs at her top speed: the best she does flat out.',
  },
  low: {
    name: 'Three blades, lower pitch', inboard: 'Four blades, lower pitch', k: 0.88, blades: 3, steel: false, grip: 0, rpmK: 1.05, price: 45,
    desc: 'Up to speed quicker and stronger with a load aboard; the engine reaches its limiter a little short of her best.',
  },
  four: {
    name: 'Four blades, stainless, a little less pitch', k: 0.94, blades: 4, steel: true, grip: 0.35, rpmK: 1.025, price: 160,
    desc: 'Bites in a sea and when she’s trimmed high: a seaway slows her less. A little quicker away, a little short of her best flat out.',
  },
};
export const PROP_IDS = Object.keys(PROPS);

// Which boats have a catalogue: their engines (models), the one they came with (stock), how many
// (count: a pair on the console and the yacht), the most power their capacity plate allows
// (plate, each engine), and the propellers they take. drag: her resistance under way as the game
// runs her (the air on her, her trim, the hump) over the hull's own curve: measured by
// tools/engine-trials.mjs (--calibrate) from her top speed on her own engine, so a matched
// propeller is matched to the boat you drive. slip: how much her propeller slips at her best (a
// fast boat's little, a heavy, slow one's more: for its pitch). tops: her top speed (m/s) with
// each engine, no limiter, measured by tools/engine-trials.mjs --calibrate: what each engine's
// matched propeller is pitched for. legacy: what an older game's engine fittings became
// (the "Bigger outboard" and the "Economy tune and prop"). The Marine Works' figures: the speed
// to time her to (go, knots), the speed to quote her range at (cruise, knots), and a load
// (laden kg; crew: the words for it).
export const CATALOGUE = {
  skiff: { slip: 0.3, stock: 'p10', models: ['p6', 'p10', 'p15', 'p20'], plate: 20, props: ['matched', 'low', 'four'], drag: 1.1689, tops: { p6: 5.783, p10: 7.101, p15: 8.358, p20: 9.297 },
    legacy: { power: 'p15', economy: 'p6' }, go: 10, cruise: 10, laden: 150, crew: 'two aboard' },
  bass: { slip: 0.2, stock: 't60', models: ['t40', 't60', 't90'], plate: 90, props: ['matched', 'low', 'four'], drag: 1.1013, tops: { t40: 7.818, t60: 9.085, t90: 10.314 },
    legacy: { power: 't90', economy: 't40' }, go: 12, cruise: 12, laden: 150, crew: 'two aboard' },
  cabin: { slip: 0.45, stock: 't40', models: ['t30', 't40', 't60'], plate: 60, props: ['matched', 'low', 'four'], drag: 1.0935, tops: { t30: 5.347, t40: 5.929, t60: 6.836 },
    legacy: { power: 't60', economy: 't30' }, go: 8, cruise: 8, laden: 300, crew: 'four aboard' },
  rib: { slip: 0.1, stock: 'f150', models: ['f115', 'f150', 's200', 's225'], plate: 225, props: ['matched', 'low', 'four'], drag: 1.0732, tops: { f115: 16.816, f150: 18.26, s200: 20.097, s225: 20.895 },
    legacy: { power: 's200', economy: 'f115' }, go: 20, cruise: 25, laden: 300, crew: 'four aboard' },
  console: { slip: 0.12, stock: 'f115', models: ['t90', 'f115', 'f150', 's200'], count: 2, plate: 200, props: ['matched', 'low', 'four'], drag: 1.0906, tops: { t90: 12.269, f115: 13.396, f150: 14.562, s200: 16.046 },
    legacy: { power: 'f150', economy: 't90' }, go: 20, cruise: 22, laden: 400, crew: 'five aboard' },
  cruiser: { slip: 0.3, stock: 'd320', models: ['d260', 'd320', 'd370', 'd440'], count: 2, plate: null, props: ['matched', 'low'], drag: 1.1174, tops: { d260: 8.97, d320: 9.664, d370: 10.185, d440: 10.805 },
    legacy: {}, go: 15, cruise: 15, laden: 1600, crew: 'a full load (six aboard, full tanks and gear)' },
};
export const hasCatalogue = (kind) => !!CATALOGUE[kind];

// (Pitch: how far a turn would screw it through the water at the engine's rated revs flat out,
// less what it slips: a tenth on a fast planing boat, more on a heavy or slow one: see slip.)
const INCH = 0.0254;

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
  return { model: C.models.includes(r.model) ? r.model : C.stock, prop: C.props.includes(r.prop) ? r.prop : 'matched' };
}
export const isStock = (kind, choice) => {
  const C = CATALOGUE[kind], c = cleanChoice(kind, choice);
  return !C || (c.model === C.stock && c.prop === 'matched');
};

// Her resistance as a push per kilogram at a speed (her hull's own curve: see hydro.js).
const hullResist = (hull) => hull.resist || ((v) => (hull.drag?.[0] ?? 0.26) * v + (hull.drag?.[1] ?? 0.055) * v * v);

// A propeller's name on this boat (an inboard's have four blades).
export const propName = (kind, id) => (MODELS[CATALOGUE[kind]?.stock]?.inboard ? PROPS[id].inboard || PROPS[id].name : PROPS[id].name);
// An engine's name as fitted: a pair on a twin-engined boat.
export const fittedName = (kind, model) => (CATALOGUE[kind]?.count > 1 ? `twin ${MODELS[model].name}s` : MODELS[model].name);

// What an engine and propeller do on this hull (her HULLS entry), or null for a boat without a
// catalogue:
//   thrust  her push below the propeller's speed, as an acceleration on her own weight (m/s²:
//           her motor's thrust, as before; both engines of a pair);
//   vd      the speed (m/s) the propeller's pitched for: past a twentieth over it, the limiter;
//   astern  her push going astern;
//   effort  how hard the engine works for a throttle setting: this propeller's push over the
//           matched one's (the fuel follows it);
//   burn    her fuel flat out against her own engine's;
//   kg      the engines' weight over her own engines' (carried in her);
//   grip    how much less speed a seaway costs her (0 … 1);
//   rpm     the revs flat out; pitch (inches); scale (the outboard drawn); look, blades, steel
//           and voice (how it's drawn and heard: null, as she came); name, hp, and the ids.
export function engineSpec(kind, hull, choice) {
  const C = CATALOGUE[kind], M = hull?.motor;
  if (!C || !M) return null;
  const { model, prop } = cleanChoice(kind, choice);
  const O = MODELS[model], S = MODELS[C.stock], P = PROPS[prop], n = C.count || 1;
  const m0 = hull.mass, dkg = (O.kg - S.kg) * n, own = hullResist(hull);
  const resist = (v) => C.drag * own(v);
  // Her own engine's power (as a power on her own weight: m²/s³), from her own push at her own
  // top speed; then this engine's top speed, its weight aboard.
  const v0 = solve((v) => resist(v) - M.thrust);
  const P0 = M.thrust * v0, Pe = (P0 * O.hp) / S.hp;
  const stock = model === C.stock;
  const ideal = stock ? v0 : solve((v) => (v * resist(v) * (m0 + dkg)) / m0 - Pe);
  const Tm = stock ? M.thrust : Pe / ideal;
  // (The speed her matched propeller is pitched for: her own top speed with this engine, as the
  // game runs her, measured by tools/engine-trials.mjs (tops); else the one her curve gives.)
  const vm = C.tops?.[model] ?? ideal;
  // The matched pitch (inches), and this propeller's against it.
  const pitch = (vm * 60 * O.gear) / O.rpm / (1 - (C.slip ?? 0.1)) / INCH, k = P.k;
  return {
    kind, model, prop, name: fittedName(kind, model), hp: O.hp, count: n, propName: propName(kind, prop), pitch: Math.round(pitch * k),
    thrust: Tm / k, vd: vm * k, astern: stock ? M.astern : (M.astern * Tm) / M.thrust,
    effort: 1 / k, burn: O.lph / S.lph, kg: dkg, grip: P.grip, rpm: Math.round(O.rpm * P.rpmK),
    scale: (M.scale ?? 1) * Math.cbrt(O.kg / S.kg), look: stock ? null : O.look,
    blades: O.inboard ? 4 : P.blades, steel: P.steel,
    voice: stock ? null : { pitch: O.note / S.note, smooth: Math.max(0, O.smooth - S.smooth) },
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

// How far a tank goes at her cruise (nautical miles; trial from engineTrials.js, litres in her
// tank, the boat's kind for the speed the yard quotes).
export const cruiseOf = (kind) => CATALOGUE[kind]?.cruise ?? 25;
export const rangeAt = (trial, litres, kind = 'rib') => (trial?.lph > 0 ? (litres / trial.lph) * cruiseOf(kind) : 0);
