// What you carry for when it goes wrong at sea (F1b): the repair kit, and a way to call for help.
//
// - The repair kit (the chandlery, KIT_PRICE): softwood plugs for a hole in her hull and
//   leak-stoppers for a punctured tube (damage.js plug), used up as they're used and topped up at
//   the counter (SPARE_PRICE each). With none, a hole gets a rag and a jumper stuffed in it: it
//   slows the water (half of it still comes in, against a plug's fifth: damage.js RAG) but it's no
//   plug, and a proper plug can take its place.
// - Calling for help: anywhere along the coast and round the islands your phone reaches the harbour
//   office; out on the deep water (NO_SIGNAL: the Blue Water, the crossing, the open ocean off Las
//   Brasas) it has no signal, and it takes her VHF (a fitting, shipyard.js) or a flare (the
//   chandlery: FLARES for FLARE_PRICE; help takes twice as long to find you by a flare). With
//   neither, you wait for a passing boat to see you (WAIT_HOURS).
// Everyone starts with a kit (and an older save has one); flares are bought.

export const KIT = { plugs: 3, stoppers: 2 };
export const KIT_PRICE = 18;
export const SPARE_PRICE = 3;
export const FLARES = 3;
export const FLARE_PRICE = 12;
export const NO_SIGNAL = new Set(['deep', 'ocean']);
export const WAIT_HOURS = 6;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v, d, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);

export const newSafety = () => ({ kit: true, plugs: KIT.plugs, stoppers: KIT.stoppers, flares: 0 });
export function cleanSafety(raw) {
  if (!isObj(raw)) return newSafety();
  const kit = raw.kit !== false;
  return { kit, plugs: kit ? int(raw.plugs, KIT.plugs, 0, KIT.plugs) : 0, stoppers: kit ? int(raw.stoppers, KIT.stoppers, 0, KIT.stoppers) : 0, flares: int(raw.flares, 0, 0, FLARES * 2) };
}

// A plug for this (what: 'hull' or 'tube'): 'kit' (one used from the kit) or 'rag' (none left).
export function takePlug(S, what) {
  const k = what === 'tube' ? 'stoppers' : 'plugs';
  if (S?.kit && S[k] > 0) {
    S[k]--;
    return 'kit';
  }
  return 'rag';
}

// Topping the kit up (or buying one): { n (spares needed), price }.
export function restock(S) {
  if (!S?.kit) return { n: KIT.plugs + KIT.stoppers, price: KIT_PRICE, whole: true };
  const n = KIT.plugs - S.plugs + KIT.stoppers - S.stoppers;
  return { n, price: n * SPARE_PRICE, whole: false };
}
export function fillKit(S) {
  Object.assign(S, { kit: true, plugs: KIT.plugs, stoppers: KIT.stoppers });
}

// How help is called from here: zone (terrain.js zoneAt where she is), vhf (she has one fitted),
// flares (in your kit). 'phone' | 'vhf' | 'flare' | 'wait'.
export function helpBy({ zone, vhf = false, flares = 0 }) {
  if (!NO_SIGNAL.has(zone)) return 'phone';
  if (vhf) return 'vhf';
  if (flares > 0) return 'flare';
  return 'wait';
}
// How long it takes help to reach you (hours), from what it takes the harbour to come (hours).
export function helpHours(how, hours) {
  return how === 'wait' ? Math.max(hours, WAIT_HOURS) : how === 'flare' ? hours * 2 : hours;
}
// In a few words.
export const HELP_WORDS = {
  phone: 'Your phone reaches the harbour office from here.',
  vhf: 'Her VHF reaches the harbour office.',
  flare: 'No signal for your phone out on the deep water, and no VHF aboard: a flare brings someone, in time.',
  wait: 'No signal for your phone out on the deep water, no VHF aboard and no flares: you can only wait for a passing boat to see you.',
};
