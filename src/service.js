// Her engine's service (G5 of docs/PROGRESSION.md): an engine wants looking after. Every hundred
// hours it runs (her papers count them: see papers.js addRun), the Marine Works changes the oil and
// the filters, the plugs and the water pump's impeller. Past that she still goes, but each hour
// overdue costs a little: a touch less push, a touch more fuel, and a cold start that takes more
// turning over, until a hundred hours overdue she's a tenth down on power and burning about a
// seventh more, and stays there. Nothing ever breaks for it: serviced, she's herself again.
//
// An electric outboard has nothing to service (see engine.js setElectric), and a boat without an
// engine has none.

export const SERVICE_HOURS = 100;
// What a service costs at the Marine Works (pounds): by her engine room, the twin-engined boats
// at twice.
export const SERVICE_PRICE = { skiff: 30, sail: 30, jetski: 45, bass: 45, rib: 60, cabin: 60, console: 110, cruiser: 160 };

// Engine hours since the last service (V: her papers).
export const sinceService = (V) => (V ? Math.max(0, (V.hours || 0) - (V.serviced || 0)) : 0);

// How worn she is: 0 serviced and within her hours, rising to 1 a hundred hours overdue.
export const wearOf = (V) => Math.max(0, Math.min(1, (sinceService(V) - SERVICE_HOURS) / SERVICE_HOURS));

// What the wear does: her push and her thirst (multipliers), and a cold start's extra turning over
// (0 … 1: see engine.js).
export const wearFx = (wear) => {
  const w = Math.max(0, Math.min(1, wear || 0));
  return { thrust: 1 - 0.1 * w, burn: 1 + 0.15 * w, start: w };
};

// Her service, in words, for her papers: due in so many hours, due now, or overdue.
export function serviceWords(V, { electric = false } = {}) {
  if (!V) return null;
  if (electric) return 'An electric outboard: nothing to service.';
  const h = sinceService(V), left = SERVICE_HOURS - h;
  if (left > 10) return `Serviced ${Math.round(h)} engine hours ago: the next is due in ${Math.round(left)}.`;
  if (left > 0) return `Due a service in ${Math.round(left)} engine hours.`;
  const over = Math.round(-left);
  return over < 5 ? 'Due a service now.' : `${over} engine hours overdue for a service: she’s ${wearOf(V) >= 0.5 ? 'down on power and thirsty' : 'running a little rough'}.`;
}

// A service done: the hours start again from here.
export function serviceDone(V) {
  if (!V) return false;
  V.serviced = V.hours || 0;
  return true;
}

// What the yard would do about it (a row for the Repairs tab: { id, what, price }), or null if
// she isn't due. kind: her kind (for the price); electric: her outboard's an electric one.
export function serviceRow(V, kind, { electric = false } = {}) {
  if (!V || electric || !SERVICE_PRICE[kind]) return null;
  const h = sinceService(V);
  if (h < SERVICE_HOURS - 10) return null;
  return { id: 'service', what: `Her engine’s service: oil and filters, plugs and the impeller (${Math.round(h)} engine hours since the last)`, price: SERVICE_PRICE[kind] };
}
