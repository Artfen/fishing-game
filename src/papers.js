// Her papers: each boat you own as a vessel of her own (B3 of docs/WORLD-DEPTH.md): her
// registration at Willowhaven, the day she became yours, what she's done since (engine hours,
// sea miles, fuel burned, fish caught aboard, the best of them), and her log, a line for each thing
// that's happened to her (bought, painted, named, re-engined, a record fish aboard, the crossing).
// And how she's dressed beyond her paint: a second colour on her stripe (or a RIB's tubes), and a
// flag at her stern.
//
// The records live with the yard's (state.yard.vessels: kind -> record): one of each boat, as the
// harbour has always had. A game from before them has a record started for each boat it owns, on
// the day it's read ("records begin").

// Her registration: the harbour's letters and a number of her own.
export const PORT = 'WH';
const NUMBERS = { row: 101, skiff: 104, kayak: 109, bass: 132, sail: 147, cabin: 158, rib: 171, console: 186, cruiser: 203, jetski: 219, windsurf: 224 };
export const regOf = (kind) => `${PORT} ${NUMBERS[kind] ?? 300}`;

// The flags she can fly from her stern: a club's, the harbour's, a working flag; none a country's
// ensign or anyone's mark.
export const FLAGS = [
  { id: 'burgee', name: 'Willowhaven Sailing Club burgee', colors: ['#1f3f63', '#f1ece0'], shape: 'pennant', price: 12 },
  { id: 'trust', name: 'Marine Trust pennant', colors: ['#2f6d5a', '#e9e2c8'], shape: 'pennant', price: 12 },
  { id: 'brasa', name: 'Puerto Brasa fishermen’s pennant', colors: ['#c8562a', '#f2d36b'], shape: 'swallow', price: 12 },
  { id: 'alpha', name: 'Code flag A (diver below: keep clear)', colors: ['#f4f2ec', '#1f4ea0'], shape: 'swallow', price: 12 },
  { id: 'own', name: 'A plain swallowtail in her colours', colors: null, shape: 'swallow', price: 8 },
];
export const flagById = Object.fromEntries(FLAGS.map((f) => [f.id, f]));
export const STRIPE_PRICE = 30;
export const TUBES_PRICE = 90;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo = 0, hi = 1e9) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);
export const LOG_MAX = 40;

export function newVessel(kind, day) {
  return { reg: regOf(kind), since: Number.isFinite(day) ? day : 1, hours: 0, nm: 0, litres: 0, fish: 0, best: null, log: [] };
}

// The records, made sensible: one for each boat you own (a new one for any without), nonsense
// dropped. day: today (for a record that begins now).
export function cleanVessels(raw, owned, day) {
  const r = isObj(raw) ? raw : {};
  const out = {};
  for (const k of owned) {
    const v = isObj(r[k]) ? r[k] : null;
    if (!v) {
      out[k] = { ...newVessel(k, day), log: [{ day, text: 'Her papers made out at the Marine Works: records begin.' }] };
      continue;
    }
    const best = isObj(v.best) && typeof v.best.id === 'string' && Number.isFinite(v.best.kg) && v.best.kg > 0
      ? { id: v.best.id.slice(0, 24), kg: Math.round(v.best.kg * 100) / 100, size: num(v.best.size, 0, 999), day: num(v.best.day, 0, 1e6) } : null;
    out[k] = {
      reg: regOf(k), since: Number.isFinite(v.since) ? Math.max(0, Math.floor(v.since)) : day,
      hours: num(v.hours), nm: num(v.nm), litres: num(v.litres), fish: Math.floor(num(v.fish)), best,
      log: (Array.isArray(v.log) ? v.log : []).filter((e) => isObj(e) && typeof e.text === 'string' && Number.isFinite(e.day)).slice(-LOG_MAX)
        .map((e) => ({ day: Math.max(0, Math.floor(e.day)), text: e.text.slice(0, 160) })),
    };
  }
  return out;
}

// A line in her log.
export function logLine(V, day, text) {
  if (!V) return;
  V.log.push({ day, text });
  if (V.log.length > LOG_MAX) V.log.splice(0, V.log.length - LOG_MAX);
}

// Time and distance under her own power: game hours with her engine running, metres made good,
// litres burned.
export function addRun(V, { hours = 0, metres = 0, litres = 0 }) {
  if (!V) return;
  V.hours += Math.max(0, hours);
  V.nm += Math.max(0, metres) / 1852;
  V.litres += Math.max(0, litres);
}

// A fish caught aboard her: counted, and the heaviest kept. Returns true if it's her best.
export function addFish(V, id, kg, size, day) {
  if (!V) return false;
  V.fish++;
  if (!V.best || kg > V.best.kg) {
    V.best = { id, kg: Math.round(kg * 100) / 100, size, day };
    return true;
  }
  return false;
}

// Her looks beyond paint and name, made sensible (paint ids from shipyard.js PAINTS).
export const cleanTrim = (v, paintIds) => ({
  ...(paintIds.includes(v?.stripe) ? { stripe: v.stripe } : {}),
  ...(paintIds.includes(v?.tubes) ? { tubes: v.tubes } : {}),
  ...(flagById[v?.flag] ? { flag: v.flag } : {}),
});
