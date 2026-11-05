// Willowhaven Marine Works: buying a boat, hiring one for the day, paint and a name sign-written on
// her, and fitting her out (see economy.js for the purse).
//
// A new game starts with the camp's three: the rowing boat, the motor skiff and the kayak, yours
// for good. Every other boat is for sale at the Marine Works, or for hire by the day: a taste of
// her before you save up. A game from before the Marine Works keeps every boat it had: nothing is
// ever taken away.
//
// What money buys is capability and looks, never a better bite: more range (a long-range tank),
// more speed (a bigger outboard), your colours and your boat's name.

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

// Fittings: what each does, which boats take it, and its price (pounds).
export const FITS = {
  tank: {
    name: 'Long-range tank', price: { skiff: 60, bass: 90, cabin: 110, console: 300, rib: 220, jetski: 90 },
    desc: 'Half as much fuel again: further out, and home again. A little heavier when she’s full.',
    tank: 1.5,
  },
  power: {
    name: 'Bigger outboard', price: { skiff: 140, bass: 220, cabin: 260, console: 520, rib: 380 },
    desc: 'More horsepower on the transom: quicker onto the plane and a few knots more flat out, for a little more fuel.',
    thrust: { skiff: 1.25, bass: 1.12, cabin: 1.15, console: 1.1, rib: 1.12 },
    burn: 1.15,
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
    const ok = [...new Set(v.filter((id) => FITS[id]?.price[k]))];
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

// Fit her out. Returns { ok, why }.
export function fitBoat(state, kind, id) {
  const Y = state.yard, F = FITS[id];
  if (!owns(Y, kind)) return { ok: false, why: 'Only your own boat.' };
  if (!F?.price[kind]) return { ok: false, why: 'That doesn’t fit her.' };
  if (Y.fits[kind]?.includes(id)) return { ok: false, why: 'She has one already.' };
  const r = pay(state, F.price[kind], `${F.name} for the ${kind}`);
  if (!r.ok) return r;
  Y.fits[kind] = [...(Y.fits[kind] || []), id];
  return { ok: true };
}

// What her fittings do: { tank, thrust, burn } multipliers (1: as she came).
export function fitEffect(yard, kind) {
  const has = (id) => !!yard?.fits?.[kind]?.includes(id);
  return {
    tank: has('tank') ? FITS.tank.tank : 1,
    thrust: has('power') ? FITS.power.thrust[kind] || 1 : 1,
    burn: has('power') ? FITS.power.burn : 1,
  };
}
