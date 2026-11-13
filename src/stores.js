// Stores aboard (F1a): food and water for days away, carried in a boat. Reckoned in days for one
// (a day's meals and drinking water), one number, so it's quick to see what you've got:
// - A boat with lockers carries some: the cabin boat's galley, the yacht's galley, the sailing
//   boat's water jugs and tins (GALLEY, days when full).
// - A stores crate (cargo.js) carries CRATE_DAYS more, in any boat that has room for it, and keeps
//   what's left in it when it's moved from boat to boat.
// What draws on them: a meal at the galley (MEAL), a bottle filled or rolls packed at the galley or
// on waking aboard (FILL), and on the crossing, a meal and a drink every six hours (WATCH). They're
// stocked at the chandlery in Willowhaven or the kitchen of Bar El Muelle in Puerto Brasa
// (DAY_PRICE a day), and a boat comes stocked. With the lockers bare, there's nothing aboard to eat
// or drink but what you brought in your backpack and caught.

import { STORES_DAYS } from './cargo.js';

export const GALLEY = { cabin: 3, cruiser: 6, sail: 3 };
export const CRATE_DAYS = STORES_DAYS;
export const MEAL = 1 / 3;
export const FILL = 1 / 6;
export const WATCH = 1 / 4;
export const DAY_PRICE = { gentle: 3, authentic: 6 };

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
// (To a thousandth of a day: about a minute and a half; rounding never leaves a last meal short.)
const r2 = (v) => Math.round(v * 1000) / 1000;

// A new game, and an older save: every boat's lockers full.
export const newStores = () => ({ ...GALLEY });
export function cleanStores(raw) {
  const s = newStores();
  if (!isObj(raw)) return s;
  for (const k of Object.keys(GALLEY)) s[k] = r2(num(raw[k], GALLEY[k], 0, GALLEY[k]));
  return s;
}

// The crates aboard boat `kind` (cargo items: { id: 'stores', at: 'boat:<kind>', days }).
const cratesIn = (cargo, kind) => (cargo?.items || []).filter((it) => it.id === 'stores' && it.at === `boat:${kind}`);

// What's aboard her: { galley, crates, days (all of it), most (all she can carry) }.
export function storesAboard(state, kind) {
  const most = GALLEY[kind] ?? 0, galley = most ? Math.min(most, state.stores?.[kind] ?? most) : 0;
  const crates = cratesIn(state.cargo, kind);
  const inCrates = crates.reduce((a, it) => a + (it.days ?? CRATE_DAYS), 0);
  return { galley, crates: crates.length, days: r2(galley + inCrates), most: most + crates.length * CRATE_DAYS };
}

// Take `days` of stores out of her (the galley first, then the crates): returns how much there was
// (0 … days). Nothing taken if there isn't the whole of it, unless `part` (the crossing takes
// what's left).
export function draw(state, kind, days, part = false) {
  const have = storesAboard(state, kind).days;
  if (have + 0.005 < days && !part) return 0;
  let want = Math.min(days, have);
  const got = want;
  if (GALLEY[kind]) {
    state.stores ??= newStores();
    const g = Math.min(want, state.stores[kind] ?? GALLEY[kind]);
    state.stores[kind] = r2((state.stores[kind] ?? GALLEY[kind]) - g);
    want -= g;
  }
  for (const it of cratesIn(state.cargo, kind)) {
    if (want <= 1e-9) break;
    const g = Math.min(want, it.days ?? CRATE_DAYS);
    it.days = r2((it.days ?? CRATE_DAYS) - g);
    want -= g;
  }
  return got;
}

// Fill her lockers and crates to the brim: { days (taken aboard), price }. The money is the
// caller's: quote first (`dry`), then pay and stock.
export function stockUp(state, kind, profile = 'gentle', dry = false) {
  const A = storesAboard(state, kind), days = r2(A.most - A.days), price = r2(days * (DAY_PRICE[profile] ?? DAY_PRICE.gentle));
  if (!dry && days > 0) {
    if (GALLEY[kind]) {
      state.stores ??= newStores();
      state.stores[kind] = GALLEY[kind];
    }
    for (const it of cratesIn(state.cargo, kind)) it.days = CRATE_DAYS;
  }
  return { days, price };
}

// In words: "food and water for 2½ days".
export function daysWords(d) {
  if (d <= 0.01) return 'nothing';
  if (d < 0.9) return `${Math.max(1, Math.round(d * 3))} meal${Math.round(d * 3) > 1 ? 's' : ''}`;
  const h = Math.round(d * 2) / 2, whole = Math.floor(h);
  return `${whole}${h > whole ? '½' : ''} day${h > 1 ? 's' : ''}`;
}

// A voyage of `hours` (game hours) against what's aboard: { ok, text }. A margin of half a day.
export function storesFor(state, kind, hours, name = 'she') {
  const A = storesAboard(state, kind), need = hours / 24;
  if (!A.most) return { ok: true, text: `No lockers aboard the ${name}: what you carry is in your backpack.` };
  const enough = A.days >= need + 0.5;
  return {
    ok: enough,
    text: enough
      ? `Stores: food and water for ${daysWords(A.days)} aboard, and the passage takes about ${daysWords(need)}.`
      : `Stores: food and water for ${daysWords(A.days)} aboard, and the passage takes about ${daysWords(need)}. Short: stock her up (the chandlery in Willowhaven, or the kitchen at Bar El Muelle), or you'll go hungry and thirsty before the end.`,
  };
}
