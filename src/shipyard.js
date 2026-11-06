// Willowhaven Marine Works: buying a boat, hiring one for the day, paint and a name sign-written on
// her, and fitting her out (see economy.js for the purse).
//
// A new game starts with the camp's three: the rowing boat, the motor skiff and the kayak, yours
// for good. Every other boat is for sale at the Marine Works, or for hire by the day: a taste of
// her before you save up. A game from before the Marine Works keeps every boat it had: nothing is
// ever taken away.
//
// What money buys is capability and looks, never a better bite: range and speed (a long-range
// tank, an engine choice), electronics (an imaging sonar, a chartplotter, a radio), power (a
// house battery), the deck (floodlights, a livewell, rod holders, a bimini), an anchor that holds,
// your colours and your boat's name. Each fitting weighs something and some draw on her batteries.

import { pay } from './economy.js';

export const STARTER = ['row', 'skiff', 'kayak'];
// What each boat costs (pounds): from a couple of good days' fishing to a summer's.
export const PRICES = { windsurf: 90, jetski: 380, bass: 420, sail: 480, cabin: 650, rib: 1200, console: 1650, cruiser: 3600 };
// A day's hire: a few percent of her price.
export const hirePrice = (kind) => (PRICES[kind] ? Math.max(6, Math.round(PRICES[kind] * 0.03)) : 0);

// Hull colours from a boatyard's chart.
export const PAINTS = [
  { id: 'white', name: 'Gelcoat white', hex: '#eeeae2' },
  { id: 'navy', name: 'Navy', hex: '#24354f' },
  { id: 'red', name: 'Pillar-box red', hex: '#a8302a' },
  { id: 'green', name: 'Racing green', hex: '#2f5a43' },
  { id: 'sky', name: 'Sky blue', hex: '#7fa8c9' },
  { id: 'teal', name: 'Teal', hex: '#2c7c7a' },
  { id: 'cream', name: 'Cream', hex: '#e7dcc0' },
  { id: 'yellow', name: 'Sunflower', hex: '#e2b43c' },
  { id: 'black', name: 'Black', hex: '#1f2226' },
  { id: 'grey', name: 'Slate grey', hex: '#6b7279' },
];
export const PAINT_PRICE = 40;
export const NAME_PRICE = 25;
export const NAME_MAX = 18;

// Fittings: what each does, which boats take it, and its price (pounds). Each is grouped (cat),
// weighs something (kg: carried in her, so she's a touch slower and sits a touch lower), may draw
// on her batteries (amps, while it's on), and does something real: more range or speed, a better
// sonar, a track on your chart, the harbour's radio, light to fish by at night, fish kept alive,
// a faster troll, shade, an anchor that holds in a blow. A slot holds one: a new engine choice
// replaces the old.
export const FIT_CATS = { engine: 'Engine', fuel: 'Fuel', electronics: 'Electronics', power: 'Power', trolling: 'Trolling motor', deck: 'Deck', gear: 'Ground tackle' };
export const FITS = {
  power: {
    name: 'Bigger outboard', cat: 'engine', slot: 'engine', kg: 35, amps: 0,
    price: { skiff: 140, bass: 220, cabin: 260, console: 520, rib: 380 },
    desc: 'More horsepower on the transom: quicker onto the plane and a few knots more flat out, for a little more fuel. Heavier.',
    thrust: { skiff: 1.25, bass: 1.12, cabin: 1.15, console: 1.1, rib: 1.12 },
    burn: 1.15,
  },
  economy: {
    name: 'Economy tune and prop', cat: 'engine', slot: 'engine', kg: 0, amps: 0,
    price: { skiff: 70, bass: 110, cabin: 120, console: 220, rib: 180 },
    desc: 'A finer-pitched propeller and the engine tuned for its middle range: a fifth less fuel for every mile, a knot or two off flat out.',
    thrust: { skiff: 0.94, bass: 0.94, cabin: 0.95, console: 0.94, rib: 0.94 },
    burn: 0.8,
  },
  tank: {
    name: 'Long-range tank', cat: 'fuel', kg: 8, amps: 0,
    price: { skiff: 60, bass: 90, cabin: 110, console: 300, rib: 220, jetski: 90 },
    desc: 'Half as much fuel again: further out, and home again. Heavier when she’s full.',
    tank: 1.5,
  },
  sonar: {
    name: 'Imaging sonar', cat: 'electronics', kg: 3, amps: 1.2,
    price: { skiff: 140, bass: 180, cabin: 200, console: 300, rib: 260, cruiser: 360 },
    desc: 'A through-hull imaging transducer for the fish finder’s head unit: the down view and the split screen, ranges down to 40 m, and the smaller echoes picked out. (Without it the head unit shows the 2D sonar to 20 m.)',
  },
  plotter: {
    name: 'GPS chartplotter', cat: 'electronics', kg: 2, amps: 1,
    price: { skiff: 150, bass: 170, cabin: 190, console: 260, rib: 240, cruiser: 320, sail: 170, jetski: 160 },
    desc: 'Your track drawn on the chart wherever she goes, and at the helm the bearing and distance to the nearest of your marks.',
  },
  vhf: {
    name: 'VHF radio', cat: 'electronics', kg: 1, amps: 0.5,
    price: { skiff: 70, bass: 70, cabin: 80, console: 90, rib: 90, cruiser: 90, sail: 80 },
    desc: 'The harbour’s channel at sea: who’s catching what and where the birds are working, and the forecast, now and then while you’re out.',
  },
  battery: {
    name: 'Dual batteries', cat: 'power', kg: 26, amps: 0,
    price: { bass: 120, cabin: 110, console: 140, rib: 130, cruiser: 160 },
    desc: 'A second, house battery for the electronics and the lights, so the starting battery’s always there for the engine; and on the bass boat, the trolling motor runs half as long again.',
    house: true, troll: 1.6,
  },
  lights: {
    name: 'Deck floodlights', cat: 'deck', kg: 3, amps: 6,
    price: { skiff: 45, bass: 60, cabin: 70, console: 90, rib: 80, cruiser: 90 },
    desc: 'Bright LED floods that light the deck and the water round her after dark: fish by night and see what you’re doing. They draw hard on a battery with the engine off.',
  },
  livewell: {
    name: 'Livewell', cat: 'deck', kg: 22, amps: 0.5,
    price: { skiff: 90, bass: 120, cabin: 140, console: 160, cruiser: 180 },
    desc: 'A tank of running sea water: fish you keep aboard her stay alive, and fresh for the market, for as long as you’re out.',
  },
  holders: {
    name: 'Trolling rod holders', cat: 'deck', kg: 4, amps: 0,
    price: { skiff: 40, bass: 50, cabin: 60, console: 90, rib: 80, cruiser: 90 },
    desc: 'Proper holders on the gunwale: with a line out you can run a notch faster, for the lures that want speed (mackerel feathers, tuna plugs), and the rod rides safe while you steer.',
  },
  bimini: {
    name: 'Bimini top', cat: 'deck', kg: 9, amps: 0,
    price: { skiff: 90, bass: 120, rib: 160 },
    desc: 'A canvas top on a frame over the helm: shade from the sun and most of the rain off you while you’re aboard.',
  },
  // The bow trolling motors (see trolling.js): one at a time, on the boats a bow mount suits.
  troll: {
    name: 'Bow trolling motor', cat: 'trolling', slot: 'troll', kg: 22, amps: 0,
    price: { skiff: 260, bass: 300, cabin: 320, console: 380 },
    desc: 'An electric motor on the bow, lowered on its mount: creep along a reef or round a shoal in silence with the main engine off, steered by turning its head. Runs on its own battery, charged at a jetty and overnight.',
  },
  trollgps: {
    name: 'GPS trolling motor (Spot-Lock)', cat: 'trolling', slot: 'troll', kg: 25, amps: 0,
    price: { skiff: 520, bass: 560, cabin: 600, console: 680 },
    desc: 'The same quiet bow motor with GPS: Spot-Lock holds her on a spot in water too deep to anchor in, pushing back against the wind and the tide as she drifts, and heading hold keeps her bow where you set it. Too much wind or tide and she drags off slowly.',
  },
  trollpro: {
    name: 'High-thrust GPS trolling motor', cat: 'trolling', slot: 'troll', kg: 32, amps: 0,
    price: { bass: 860, cabin: 900, console: 980 },
    desc: 'A bigger bow motor with GPS, twice as strong: Spot-Lock that holds a heavier boat in a fresh breeze and a running tide, at the cost of a battery that runs down sooner.',
  },
  trollbank: {
    name: 'Lithium trolling battery', cat: 'power', kg: 12, amps: 0,
    price: { skiff: 240, bass: 260, cabin: 260, console: 300 },
    desc: 'A lithium bank for the trolling motor: twice as long on Spot-Lock or creeping about, and lighter than the lead battery it replaces.',
  },
  anchor: {
    name: 'Heavier anchor and chain', cat: 'gear', kg: 14, amps: 0,
    price: { skiff: 35, bass: 45, cabin: 60, console: 80, rib: 70, cruiser: 120, sail: 50 },
    desc: 'A bigger anchor on a length of chain: it digs in first time and holds in a blow that would drag the old one across the bottom.',
    hold: 2.2,
  },
};
export const FIT_IDS = Object.keys(FITS);
export const fitsFor = (kind) => FIT_IDS.filter((id) => FITS[id].price[kind]);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const cleanBoatName = (v) => (typeof v === 'string' ? v.replace(/[^\p{L}\p{N} '’.&-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '');

// The yard's records, made sensible. kinds: the boats there are; legacy: a game from before the
// Marine Works (it owns every boat it had).
export function cleanYard(raw, kinds, legacy = false) {
  const r = isObj(raw) ? raw : {};
  let owned = Array.isArray(r.owned) ? [...new Set(r.owned.filter((k) => kinds.includes(k)))] : legacy ? [...kinds] : [...STARTER];
  for (const k of STARTER) if (kinds.includes(k) && !owned.includes(k)) owned.push(k);
  const hired = isObj(r.hired) && kinds.includes(r.hired.kind) && !owned.includes(r.hired.kind) && Number.isFinite(r.hired.day) ? { kind: r.hired.kind, day: r.hired.day } : null;
  const looks = {};
  for (const [k, v] of Object.entries(isObj(r.looks) ? r.looks : {})) {
    if (!kinds.includes(k) || !isObj(v)) continue;
    const paint = PAINTS.some((p) => p.id === v.paint) ? v.paint : null, name = cleanBoatName(v.name);
    if (paint || name) looks[k] = { ...(paint ? { paint } : {}), ...(name ? { name } : {}) };
  }
  const fits = {};
  for (const [k, v] of Object.entries(isObj(r.fits) ? r.fits : {})) {
    if (!kinds.includes(k) || !Array.isArray(v)) continue;
    const ok = [];
    for (const id of new Set(v)) {
      if (!FITS[id]?.price[k]) continue;
      // (One to a slot: the last one fitted.)
      const slot = FITS[id].slot;
      if (slot) for (let i = ok.length - 1; i >= 0; i--) if (FITS[ok[i]].slot === slot) ok.splice(i, 1);
      ok.push(id);
    }
    if (ok.length) fits[k] = ok;
  }
  return { owned, hired, looks, fits };
}

// Can you take her out: yours, or hired for today.
export const owns = (yard, kind) => yard.owned.includes(kind);
export const hiredToday = (yard, kind, day) => yard.hired?.kind === kind && yard.hired.day === day;
export const usable = (yard, kind, day) => owns(yard, kind) || hiredToday(yard, kind, day);

// Buy her. Returns { ok, why }.
export function buyBoat(state, kind) {
  const Y = state.yard;
  if (owns(Y, kind)) return { ok: false, why: 'She’s yours already.' };
  if (!PRICES[kind]) return { ok: false, why: 'She isn’t for sale.' };
  const r = pay(state, PRICES[kind], `Bought the ${kind}`);
  if (!r.ok) return r;
  Y.owned.push(kind);
  if (Y.hired?.kind === kind) Y.hired = null;
  return { ok: true };
}

// Hire her until the end of today (one boat at a time). Returns { ok, why }.
export function hireBoat(state, kind) {
  const Y = state.yard;
  if (owns(Y, kind)) return { ok: false, why: 'She’s yours: no need to hire her.' };
  if (!PRICES[kind]) return { ok: false, why: 'She isn’t for hire.' };
  if (Y.hired && Y.hired.day === state.day && Y.hired.kind !== kind) return { ok: false, why: `You’ve the ${Y.hired.kind} on hire today already.` };
  if (hiredToday(Y, kind, state.day)) return { ok: false, why: 'She’s yours for the day already.' };
  const r = pay(state, hirePrice(kind), `A day’s hire of the ${kind}`);
  if (!r.ok) return r;
  Y.hired = { kind, day: state.day };
  return { ok: true };
}

// Paint her (a colour from PAINTS), or have her name sign-written. Returns { ok, why }.
export function paintBoat(state, kind, paint) {
  const Y = state.yard;
  if (!owns(Y, kind)) return { ok: false, why: 'Only your own boat.' };
  if (!PAINTS.some((p) => p.id === paint)) return { ok: false, why: 'Not a colour on the chart.' };
  if (Y.looks[kind]?.paint === paint) return { ok: false, why: 'She’s that colour already.' };
  const r = pay(state, PAINT_PRICE, `Painted the ${kind}`);
  if (!r.ok) return r;
  Y.looks[kind] = { ...Y.looks[kind], paint };
  return { ok: true };
}
export function nameBoat(state, kind, name) {
  const Y = state.yard, n = cleanBoatName(name);
  if (!owns(Y, kind)) return { ok: false, why: 'Only your own boat.' };
  if (!n) return { ok: false, why: 'Give her a name first.' };
  if (Y.looks[kind]?.name === n) return { ok: false, why: 'That’s her name already.' };
  const r = pay(state, NAME_PRICE, `Sign-written the ${kind}`);
  if (!r.ok) return r;
  Y.looks[kind] = { ...Y.looks[kind], name: n };
  return { ok: true };
}

// Fit her out (a fitting in a slot already taken replaces what's there). Returns { ok, why, swapped }.
export function fitBoat(state, kind, id) {
  const Y = state.yard, F = FITS[id];
  if (!owns(Y, kind)) return { ok: false, why: 'Only your own boat.' };
  if (!F?.price[kind]) return { ok: false, why: 'That doesn’t fit her.' };
  if (Y.fits[kind]?.includes(id)) return { ok: false, why: 'She has one already.' };
  const r = pay(state, F.price[kind], `${F.name} for the ${kind}`);
  if (!r.ok) return r;
  const was = (Y.fits[kind] || []).filter((x) => !(F.slot && FITS[x].slot === F.slot));
  const swapped = (Y.fits[kind] || []).find((x) => F.slot && FITS[x].slot === F.slot) || null;
  Y.fits[kind] = [...was, id];
  return { ok: true, swapped };
}

// Take a fitting off (to save her the weight, or the power): no charge, and no money back.
export function unfitBoat(state, kind, id) {
  const Y = state.yard;
  if (!Y.fits[kind]?.includes(id)) return { ok: false, why: 'She hasn’t one.' };
  Y.fits[kind] = Y.fits[kind].filter((x) => x !== id);
  if (!Y.fits[kind].length) delete Y.fits[kind];
  return { ok: true };
}

// What her fittings do (1, false or 0: as she came):
// { tank, thrust, burn (multipliers), kg (what they weigh), amps (what they draw, all on),
//   sonar, plotter, vhf, house (a house battery), troll (the trolling battery's size), lights,
//   livewell, holders, bimini, hold (how hard her anchor holds), list (the ids) }.
export function fitEffect(yard, kind) {
  const list = (yard?.fits?.[kind] || []).filter((id) => FITS[id]?.price[kind]);
  const has = (id) => list.includes(id);
  const e = { tank: 1, thrust: 1, burn: 1, kg: 0, amps: 0, sonar: false, plotter: false, vhf: false, house: false, troll: 1, lights: false, livewell: false, holders: false, bimini: false, hold: 1, trollMotor: null, trollBank: false, list };
  for (const id of list) {
    const F = FITS[id];
    e.kg += F.kg || 0;
    e.amps += F.amps || 0;
    if (F.thrust) e.thrust *= F.thrust[kind] || 1;
    if (F.burn) e.burn *= F.burn;
    if (F.tank) e.tank *= F.tank;
    if (F.troll) e.troll *= F.troll;
    if (F.hold) e.hold *= F.hold;
    if (F.house) e.house = true;
  }
  for (const id of ['sonar', 'plotter', 'vhf', 'lights', 'livewell', 'holders', 'bimini']) e[id] = has(id);
  // (The bow trolling motor fitted, if any, and its battery bank.)
  e.trollMotor = ['trollpro', 'trollgps', 'troll'].find(has) || null;
  e.trollBank = has('trollbank');
  return e;
}
