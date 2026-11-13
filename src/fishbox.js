// The fish box (F2b). A bag of ice in your creel keeps your catch a day (shop.js's ICE); a voyage
// runs longer than that. The boats built for days away have a box for the catch that holds ice
// for BOX_HOURS: the cabin boat's fish box under the cockpit sole, the yacht's insulated fish hold,
// the sailing boat's cool box, the centre console's fish box in the seat in front of the console,
// the RIB's cool box under her jockey seat. While you're aboard her, your catch goes in it: the
// freshness clock stops (as on ice in your creel) for as long as there's ice in it.
// Iced at the chandlery in Willowhaven (*Ready for a trip*) or by the kitchen at Bar El Muelle in
// Puerto Brasa, for the voyage home.
//
// state.fishbox: { boat kind: game hour her ice lasts until }.

export const FISHBOX = {
  cabin: 'fish box',
  cruiser: 'fish hold',
  sail: 'cool box',
  console: 'fish box',
  rib: 'cool box',
};
export const BOX_HOURS = 72;
export const BOX_PRICE = 6;

export const hasBox = (kind) => Object.hasOwn(FISHBOX, kind);
export const boxIceUntil = (state, kind) => (hasBox(kind) && state.fishbox?.[kind]) || 0;

// Ice her box (to the full BOX_HOURS from `now`).
export function iceBox(state, kind, now) {
  if (!hasBox(kind)) return false;
  state.fishbox ??= {};
  state.fishbox[kind] = now + BOX_HOURS;
  return true;
}

// The ice your catch is on: your creel's, or (aboard a boat with one) her box's, whichever lasts.
export function iceUntilHere(state, creelUntil, aboard) {
  return Math.max(creelUntil || 0, aboard ? boxIceUntil(state, aboard) : 0);
}

// Hours of ice left in her box at `now`.
export const boxHoursLeft = (state, kind, now) => Math.max(0, boxIceUntil(state, kind) - now);

// In words: "her fish box iced for 2 days more" / "… for 5 hours more" / "no ice in her fish box".
export function boxWords(state, kind, now) {
  if (!hasBox(kind)) return '';
  const h = boxHoursLeft(state, kind, now), box = FISHBOX[kind];
  if (h <= 0) return `no ice in her ${box}`;
  const n = Math.max(1, Math.round(h));
  return `her ${box} iced for ${h >= 36 ? `${Math.round(h / 24)} days` : h >= 20 ? 'a day' : `${n} hour${n === 1 ? '' : 's'}`} more`;
}

// From a save: known boats, finite hours.
export function cleanFishbox(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const k of Object.keys(FISHBOX)) {
    const v = raw[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = Math.min(1e7, v);
  }
  return out;
}
