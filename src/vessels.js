// What each boat is for (phase 5 of the brief): not faster or better all round, but each good at
// something. The numbers here are what the work on the water (contracts.js) asks of a boat, and
// what she carries is real weight in her (main.js adds it to her payload: a boat full of people
// and gear is slower, and sits lower).
//
//  seats:   people besides you (passengers, divers, anglers) she can take out
//  cargo:   kilos of freight she can carry (beyond her own gear)
//  shelter: a cabin or wheelhouse: passengers stay dry and happy in rougher water
//  comfort: the sea (significant wave height, m) passengers are happy in, aboard her
//  divers:  room and a ladder for divers and their kit
//  purpose: in a line, for the Marine Works and the jobs that want her
//  name:    what she's called (as boat.js has it)
//
// The RIB stays what she is: fast, capable, a fine coastal boat for a few, but open and small for
// a charter of eight, a ton of freight or a night out. The yacht: long range, passengers, freight
// and a bed, for the price. The sailing boat: no fuel at all, and the seamanship to go with it.

export const KG_PER_PERSON = 80;
export const VESSELS = {
  row: { name: 'rowing boat', seats: 1, cargo: 120, shelter: false, comfort: 0.5, divers: false, purpose: 'Cheap, quiet and simple: sheltered water, close to the fish.' },
  skiff: { name: 'motor skiff', seats: 2, cargo: 200, shelter: false, comfort: 0.6, divers: false, purpose: 'A little outboard boat for the bay and the estuary: cheap to run, quiet when you want it.' },
  kayak: { name: 'kayak', seats: 0, cargo: 30, shelter: false, comfort: 0.4, divers: false, purpose: 'Into the shallows and the reeds where nothing else goes, silently.' },
  bass: { name: 'bass boat', seats: 1, cargo: 180, shelter: false, comfort: 0.6, divers: false, purpose: 'Shallow, stable and precise: electric motors, a casting deck, the lakes and the estuary.' },
  sail: { name: 'sailing boat', seats: 3, cargo: 300, shelter: false, comfort: 1.0, divers: false, purpose: 'No fuel at all: the wind takes her anywhere, as far as the island, if you can sail her.' },
  rib: { name: 'RIB', seats: 5, cargo: 400, shelter: false, comfort: 1.1, divers: true, purpose: 'Fast and capable along the coast: a few people, divers, a quick trip out and back.' },
  console: { name: 'centre-console boat', seats: 5, cargo: 800, shelter: false, comfort: 1.3, divers: true, purpose: 'An offshore fishing boat: a working deck for several anglers, room for gear, twin engines.' },
  cabin: { name: 'cabin boat', seats: 4, cargo: 600, shelter: true, comfort: 2.0, divers: false, purpose: 'Weather protection and a bunk: longer trips, passengers kept dry, a night aboard.' },
  cruiser: { name: 'sport-fishing yacht', seats: 8, cargo: 1500, shelter: true, comfort: 2.6, divers: true, purpose: 'Long-range expeditions: passengers, freight, divers and a cabin to live in, across the ocean.' },
  jetski: { name: 'jet ski', seats: 1, cargo: 20, shelter: false, comfort: 0.6, divers: false, purpose: 'For the fun of it.' },
  windsurf: { name: 'windsurf board', seats: 0, cargo: 0, shelter: false, comfort: 0.6, divers: false, purpose: 'For the fun of it, and the wind.' },
};
// She as she was built.
export const hullOf = (kind) => VESSELS[kind] || VESSELS.row;
// She as she's fitted out (G5 of docs/PROGRESSION.md): the Marine Works' extra seating, a dive
// ladder and tank racks, a spray dodger (see shipyard.js FITS' work) change what she can take.
// The game tells this module how her fittings change her (setFitOut: kind -> { seats, comfort,
// divers } or null); without it, every boat is as she was built.
let fitOut = null;
export const setFitOut = (fn) => {
  fitOut = typeof fn === 'function' ? fn : null;
};
export function vesselOf(kind) {
  const V = hullOf(kind), w = fitOut?.(kind);
  if (!w || !(w.seats || w.comfort || w.divers)) return V;
  return { ...V, seats: V.seats + (w.seats || 0), comfort: Math.round((V.comfort + (w.comfort || 0)) * 100) / 100, divers: V.divers || !!w.divers };
}

// Can she take this job's people and freight? Returns why not, or null.
export function fits(kind, { pax = 0, cargo = 0, divers = false } = {}) {
  const V = vesselOf(kind);
  if (pax > V.seats) return `room for ${pax}: she seats ${V.seats || 'nobody'} besides you`;
  if (cargo > V.cargo) return `${cargo} kg of freight: she carries ${V.cargo} kg`;
  if (divers && !V.divers) return 'divers and their kit: she has no ladder or room for tanks';
  return null;
}
// The smallest of the boats there are that would do (for an offer's "take").
export function smallestFor(need, kinds = Object.keys(VESSELS)) {
  const ok = kinds.filter((k) => !fits(k, need));
  ok.sort((a, b) => VESSELS[a].seats + VESSELS[a].cargo / 200 - (VESSELS[b].seats + VESSELS[b].cargo / 200));
  return ok[0] || null;
}
// How the people aboard find the sea (wave height, m): 0 happy … 1 miserable. (A spray dodger
// keeps the wind and the spray off them: they're happy in a bigger sea.)
export const misery = (kind, sea) => Math.max(0, Math.min(1, (sea - vesselOf(kind).comfort) / 0.8));
// What the sea is to her hull (the same scale, as she was built): canvas doesn't make an open
// boat any more seaworthy.
export const hullMisery = (kind, sea) => Math.max(0, Math.min(1, (sea - hullOf(kind).comfort) / 0.8));
