// Money: one purse (state.money, in pounds) and every payment through here, so the purse is never
// overdrawn, nothing is paid twice, and each payment leaves a receipt in the ledger.
//
// Money buys things you want (boats, paint, fittings: see shipyard.js) and pays for what you use
// (fuel). It never buys a better bite: a good angler in a cheap boat catches as much as anyone.
// And it never stops you fishing: the rowing boat, the skiff and the kayak are yours from the
// start and cost nothing to run but a little petrol, and when the purse is empty the harbour
// gives you enough fuel to get home (goodwill).
//
// The Economy setting (ECONOMY): gentle (the default: fuel is cheap) or authentic (fuel at
// something like real prices, so a long run at full throttle wants a good catch to pay for it).

export const ECONOMY = {
  gentle: { id: 'gentle', name: 'Gentle', fuel: 0.4, desc: 'Fuel is cheap, and the harbour helps you home when your purse is empty. A day’s fishing pays for a day’s running and more.' },
  authentic: { id: 'authentic', name: 'Authentic', fuel: 1.45, desc: 'Fuel at about real prices: a long run at full throttle wants a good catch to pay for it. Slow down, plan the trip, take the small boat. The harbour still helps you home when you’re broke.' },
};
export const ECONOMY_IDS = Object.keys(ECONOMY);
export const LEDGER_MAX = 40;
export const GOODWILL_L = 5;

const r2 = (v) => Math.round(v * 100) / 100;
const when = (state) => (state.day ?? 1) * 24 + (state.hour ?? 0);

export const canAfford = (state, v) => (state.money ?? 0) >= v - 1e-6;

// Pay v for what (a few words): all of it or none of it. Returns { ok, why }.
export function pay(state, v, what) {
  const p = r2(v);
  if (!(p >= 0)) return { ok: false, why: 'That isn’t a price.' };
  if (!canAfford(state, p)) return { ok: false, why: `That’s £${p.toFixed(2)}, and you’ve £${(state.money ?? 0).toFixed(2)} in your purse.` };
  state.money = r2((state.money ?? 0) - p);
  note(state, what, -p);
  return { ok: true };
}

// Money in (a sale, a kitchen's order, a favour, a charter).
export function earn(state, v, what) {
  const p = r2(v);
  if (!(p > 0)) return;
  state.money = r2((state.money ?? 0) + p);
  note(state, what, p);
}

function note(state, what, v) {
  if (!Array.isArray(state.ledger)) state.ledger = [];
  state.ledger.push({ at: when(state), what: String(what || '').slice(0, 60), v, bal: state.money });
  if (state.ledger.length > LEDGER_MAX) state.ledger.splice(0, state.ledger.length - LEDGER_MAX);
}

// The ledger as the save keeps it: the last LEDGER_MAX entries, each made sensible.
export function cleanLedger(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === 'object' && Number.isFinite(e.v) && Number.isFinite(e.at))
    .slice(-LEDGER_MAX)
    .map((e) => ({ at: e.at, what: String(e.what || '').slice(0, 60), v: r2(e.v), bal: Number.isFinite(e.bal) ? r2(e.bal) : 0 }));
}

/* ---------------- fuel at the pump ---------------- */

// (G2) Fuel on the island is shipped in: dearer at Puerto Brasa's pump (place 'brasa').
export const ISLAND_FUEL_K = 1.25;
export const fuelPrice = (profile = 'gentle', place = 'haven') => Math.round((ECONOMY[profile] || ECONOMY.gentle).fuel * (place === 'brasa' ? ISLAND_FUEL_K : 1) * 100) / 100;

// A quote at the pump: want litres (to fill up); what that costs, and if the purse won't run to it,
// as much as it will (to the nearest tenth of a litre). Returns { litres, price, short }.
export function fuelQuote(want, profile, purse, place = 'haven') {
  const each = fuelPrice(profile, place);
  const full = Math.max(0, want);
  if (purse >= full * each - 1e-6) return { litres: Math.round(full * 10) / 10, price: r2(full * each), short: false };
  const can = Math.floor((Math.max(0, purse) / each) * 10) / 10;
  return { litres: can, price: r2(can * each), short: true };
}

// The harbour's goodwill: with your purse empty (less than a litre's worth) and the tank near dry,
// enough fuel to get home, once a day.
export function goodwillDue(state, profile, tankLitres) {
  return (state.money ?? 0) < fuelPrice(profile) && tankLitres < GOODWILL_L && state.goodwillDay !== state.day;
}
