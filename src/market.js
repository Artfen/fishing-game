import { FISH, fishById, weightOf } from './fish.js';

// The harbour's trade in fish, kept gentle: a catch you keep can go to the pot (as ever), to the
// fish market on Willowhaven quay, or to the kitchen at The Lobster Pot when it's asked for one
// (and at Las Brasas, to Bar El Muelle's kitchen). A little money for a good catch, to spend at
// the chandlery and the inn: purpose for a catch, never a grind.
//
//  · Prices are by the kilo, roughly in proportion to what each fish fetches on a real quay (sole,
//    turbot and bass dear; mackerel, scad and bogue cheap). The coarse fish of the lakes aren't
//    bought at all.
//  · Each day the market wants a couple of kinds more than usual (half as much again) and has
//    plenty of another (less), from the day's dice: the same all day, whoever asks.
//  · Fresher fetches more: a fish keeps its price for half a day in the creel, then slips, to just
//    over half after two days.
//  · No one fish pays more than £40 at the market, or £60 from a kitchen (a whopper is a fine
//    thing, but it shouldn't make the purse meaningless).
//  · The kitchen asks for a couple of particular fish each day (sometimes a good-sized one), and
//    pays well over the market for them.

// £ a kilo, at the quay.
export const PRICES = {
  // Fresh water (the market takes the trout and its kin; the coarse fish nobody buys).
  trout: 12, grayling: 9, perch: 6, pike: 4, lmbass: 7, carp: 0, tench: 0, roach: 0, rudd: 0,
  // The home coast.
  seabass: 15, mullet: 4, mackerel: 4, flounder: 6, plaice: 9, squid: 10, meagre: 12, gilthead: 13, sole: 18,
  cuttlefish: 8, baila: 11, blackbream: 8, whitebream: 8, twobanded: 5, striped: 6, urta: 12, redporgy: 11,
  pandora: 8, dentex: 14, borriquete: 7, roncador: 5, pollack: 7, bluefish: 6, senegalsole: 16, sandsole: 14,
  acedia: 10, turbot: 20, gurnard: 6, sardine: 4, horsemackerel: 3, bogue: 2, salema: 2, garfish: 3, bonito: 8,
  bullet: 5, pompano: 8, octopus: 11, albacore: 10,
  // Las Brasas.
  parrotfish: 16, triggerfish: 9, moray: 6, barracuda: 7, chubmackerel: 3, wahoo: 12, dorado: 12, yellowfin: 14, littletunny: 6,
};

// When the market on the quay is open (hours of the day). The inn's kitchen takes its orders until
// late.
export const MARKET_HOURS = [5, 19];
export const ORDERS_BY = 22;
export const MAX_PRICE = 40;
export const MAX_REWARD = 60;

const SOUTH_ZONES = new Set(['harbor', 'lee', 'lava', 'sebadal', 'veril', 'ocean']);
// Who buys what: the quay at home buys the home coast's fish (and the trout); Bar El Muelle the
// island's (and the home coast's kinds that live there too).
const atHome = (sp) => sp.life.zones.some((z) => !SOUTH_ZONES.has(z));
const atBrasas = (sp) => !!sp.life.southGroups;
export const buyers = {
  haven: (sp) => (PRICES[sp.id] ?? 0) > 0 && atHome(sp),
  muelle: (sp) => (PRICES[sp.id] ?? 0) > 0 && atBrasas(sp),
};

// A small, steady hash for the day's dice.
function dice(seed) {
  let s = (Math.imul(seed | 0, 2654435761) ^ 0x5bd1e995) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const shuffled = (list, r) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// The day's demand at a place: { wanted: [ids] (×1.5), plenty: [ids] (×0.7) }.
export function demandFor(day, place = 'haven') {
  const r = dice(day * 31 + (place === 'muelle' ? 7 : 3));
  const pool = shuffled(FISH.filter((sp) => !sp.retired && sp.meal && buyers[place](sp) && sp.water !== 'fresh').map((sp) => sp.id).sort(), r);
  return { wanted: pool.slice(0, 2), plenty: pool.slice(2, 3) };
}

// How fresh a fish caught at absolute hour `at` is by `now` (1 … 0.55). (A fish from an old save,
// with no time on it, counts as fresh.)
export function freshness(at, now) {
  if (!Number.isFinite(at)) return 1;
  const age = Math.max(0, now - at);
  return age <= 12 ? 1 : Math.max(0.55, 1 - ((age - 12) / 36) * 0.45);
}

// What a fish from your creel fetches here today: { price (£), kg, each (£/kg), fresh, demand
// ('wanted' | 'plenty' | null), wanted (false if nobody here buys it) }.
export function fishValue(f, { day, now, place = 'haven' } = {}) {
  const sp = fishById[f.id];
  if (!sp || f.cooked || !buyers[place](sp)) return { price: 0, kg: 0, each: 0, fresh: 1, demand: null, wanted: false };
  const kg = weightOf(sp, f.size);
  const D = demandFor(day, place);
  const demand = D.wanted.includes(sp.id) ? 'wanted' : D.plenty.includes(sp.id) ? 'plenty' : null;
  const each = PRICES[sp.id] * (demand === 'wanted' ? 1.5 : demand === 'plenty' ? 0.7 : 1);
  const fresh = freshness(f.at, now);
  return { price: Math.min(MAX_PRICE, Math.max(0.2, Math.round(kg * each * fresh * 20) / 20)), kg, each, fresh, demand, wanted: true };
}

// The fish a kitchen likes to put on its menu.
const MENU = {
  haven: ['seabass', 'sole', 'turbot', 'plaice', 'gilthead', 'mackerel', 'squid', 'cuttlefish', 'pollack', 'blackbream', 'gurnard', 'flounder', 'bonito', 'octopus', 'redporgy', 'trout'],
  muelle: ['parrotfish', 'moray', 'wahoo', 'dorado', 'octopus', 'squid', 'redporgy', 'dentex', 'triggerfish', 'albacore', 'chubmackerel', 'whitebream'],
};

// The kitchen's orders for the day: two fish it would like (one now and then wanting a good-sized
// one), what it pays (well over the market) and by when (22:00).
export function ordersFor(day, place = 'haven') {
  const r = dice(day * 57 + (place === 'muelle' ? 11 : 5));
  const ids = shuffled(MENU[place].filter((id) => fishById[id]?.meal), r).slice(0, place === 'muelle' ? 1 : 2);
  return ids.map((id, i) => {
    const sp = fishById[id];
    const big = r() < 0.4;
    const min = big ? Math.round(sp.size[0] + (sp.size[1] - sp.size[0]) * 0.4) : sp.size[0];
    const mid = (min + sp.size[1]) / 2;
    const reward = Math.min(MAX_REWARD, Math.max(6, Math.round(weightOf(sp, mid) * PRICES[id] * 1.8 + 4)));
    return { key: `${day}-${place}-${i}`, id, min, reward, by: ORDERS_BY, day };
  });
}

// The first fish in your creel that fills an order (or -1).
export const fills = (keep, o) => keep.findIndex((f) => f.id === o.id && !f.cooked && f.size >= o.min);

// Money, in words: £12, £3.40.
export const money = (v) => `£${(Math.round(v * 100) / 100).toFixed(Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2)}`;
