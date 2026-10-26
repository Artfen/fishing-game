import { fishById, weightOf } from './fish.js';

// The chandlery's counter (Old Bert Hale behind it): the tackle itself stays free, as ever, and
// the counter sells the few things that make a trip go better, and mends what wears out.
//
//  · Creels hold fish by weight, not by number: the one you start with takes 15 kg (thirty-odd
//    mackerel, or a few good bass); a bigger one 25 kg; a cool-lined wicker one 40 kg, and fish in
//    it keep fresh twice as long. One big fish always goes in an empty creel, however heavy (a
//    yellowfin tuna fills it on its own), but then there's no room for anything else.
//  · Ice: a bag in the creel keeps every fish in it fresh for the next day (the clock on their
//    freshness stops while they're on ice).
//  · Fresh bait, dug and gathered this morning: lively and smelly, so fish find a natural bait
//    from further off, for the rest of the day.
//  · Line wears: a long, hard fight frays it a little (the longer and harder, the more), and a
//    frayed line is a little weaker, never more than a fifth. Respooling puts fresh line on.
//
// state.shop: { creel (index into CREELS), iceUntil (game hours), baitDay, wear: { rod id: 0 … 1 } }.

export const CREELS = [
  { id: 'creel', name: 'Your old creel', kg: 15, price: 0 },
  { id: 'bigger', name: 'A bigger creel', kg: 25, price: 30, note: 'Canvas and leather: 25 kg of fish.' },
  { id: 'wicker', name: 'A cool-lined wicker creel', kg: 40, price: 80, cool: true, note: '40 kg of fish, and a lining that keeps them cool: they stay fresh twice as long.' },
];
// (However light they are, no more than this many fish at once: a limit you'd hardly meet.)
export const CREEL_MAX = 80;
export const ICE = { price: 2, hours: 24 };
export const BAIT = { price: 3, boost: 1.3 };
export const WEAR_MAX_LOSS = 0.2; // a line worn right through is a fifth weaker

export const newShop = () => ({ creel: 0, iceUntil: 0, baitDay: 0, wear: {} });

export function cleanShop(raw, rodIds) {
  const s = newShop();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
  const n = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  s.creel = Math.round(n(raw.creel, 0, 0, CREELS.length - 1));
  s.iceUntil = n(raw.iceUntil, 0, 0, 1e7);
  s.baitDay = Math.round(n(raw.baitDay, 0, 0, 1e6));
  if (raw.wear && typeof raw.wear === 'object') {
    for (const [k, v] of Object.entries(raw.wear)) if (rodIds.includes(k) && n(v, 0, 0, 1) > 0) s.wear[k] = Math.round(n(v, 0, 0, 1) * 1000) / 1000;
  }
  return s;
}

const shopOf = (state) => state.shop || newShop();
export const creelOf = (state) => CREELS[shopOf(state).creel] || CREELS[0];
export const creelKg = (state) => creelOf(state).kg;
// What a fish in the creel weighs (cooked, the same near enough).
export const keptKg = (f) => (fishById[f.id] ? weightOf(fishById[f.id], f.size) : 0);
export const creelLoad = (state) => (state.keep || []).reduce((s, f) => s + keptKg(f), 0);
// Room for a fish of this weight? (An empty creel always takes one, however big.)
export function creelFits(state, kg) {
  const keep = state.keep || [];
  if (keep.length >= CREEL_MAX) return false;
  return !keep.length || creelLoad(state) + kg <= creelKg(state) + 1e-6;
}
export const kgWords = (kg) => (kg < 1 ? `${Math.round(kg * 100) / 100} kg` : `${kg.toFixed(kg < 10 ? 1 : 0)} kg`);
export const creelWords = (state) => `${kgWords(creelLoad(state))} of ${creelKg(state)} kg`;
// The creel's fish, kind by kind (thirty mackerel are one line, not thirty): [{ id, cooked, n,
// first (the index of the biggest, the one an action takes), idx (all their indices), min, max (cm),
// kg }].
export function creelGroups(keep) {
  const by = new Map();
  keep.forEach((f, i) => {
    const key = `${f.id}${f.cooked ? ':c' : ''}`;
    let g = by.get(key);
    if (!g) by.set(key, (g = { id: f.id, cooked: !!f.cooked, n: 0, first: i, idx: [], min: f.size, max: f.size, kg: 0 }));
    g.n++;
    g.idx.push(i);
    if (f.size > keep[g.first].size) g.first = i;
    g.min = Math.min(g.min, f.size);
    g.max = Math.max(g.max, f.size);
    g.kg += keptKg(f);
  });
  return [...by.values()];
}
// "Atlantic Mackerel ×12, 24–33 cm" or "Sea bass, 52 cm".
export const groupWords = (name, g) => `${name}${g.n > 1 ? ` ×${g.n}` : ''}, ${g.min === g.max ? g.min : `${g.min}–${g.max}`} cm`;
export const freshBaitToday = (state) => shopOf(state).baitDay === state.day;
export const onIce = (state, now) => shopOf(state).iceUntil > now;

// Time passing for the fish in your creel (from game hour `from` to `to`): on ice, their
// freshness clock stops; in a cool-lined creel it runs at half speed. (Freshness is told from
// each fish's `at`, the hour it was caught: moving it on keeps the fish as fresh as it was.)
export function chill(state, from, to) {
  const dh = to - from;
  if (!(dh > 0) || !state.keep?.length) return;
  const iced = Math.max(0, Math.min(to, shopOf(state).iceUntil) - from);
  const slowed = creelOf(state).cool ? (dh - iced) * 0.5 : 0;
  const shift = iced + slowed;
  if (shift <= 0) return;
  for (const f of state.keep) if (Number.isFinite(f.at) && !f.cooked) f.at = Math.min(to, f.at + shift);
}

// Line wear from a fight just ended: F is the fight (its time in seconds and peak tension, 0 … 1).
export function wearFrom(F) {
  const secs = Math.max(0, F.time || 0), peak = Math.min(1, Math.max(0, F.peak || 0));
  return Math.min(0.45, (secs / 150) * (0.4 + peak * 0.8));
}
export function addWear(state, rodId, w) {
  const S = (state.shop ??= newShop());
  const was = S.wear[rodId] || 0;
  S.wear[rodId] = Math.min(1, Math.round((was + w) * 1000) / 1000);
  return { was, now: S.wear[rodId] };
}
export const wearOf = (state, rodId) => shopOf(state).wear[rodId] || 0;
// The line as it is now: its breaking strain cut by its wear.
export function wornLine(line, wear) {
  if (!wear) return line;
  return { ...line, kg: line.kg * (1 - WEAR_MAX_LOSS * Math.min(1, wear)) };
}
export const wearWords = (w) => (w < 0.25 ? 'good as new' : w < 0.6 ? 'a bit worn' : 'frayed');
// Fresh line for a rod: more for the heavy lines.
export const respoolPrice = (line) => (line.kg >= 20 ? 8 : line.kg >= 6 ? 5 : 3);
