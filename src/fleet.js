// Your boats: which are in the water and which are laid up ashore, and where each one lives.
//
// No more than three of them are afloat at a time (MAX_AFLOAT); the rest are in store, each in its
// own place: the boats that live at Willowhaven in the boat store behind the harbour office, the
// little boats at the camp pulled up above the tide, the bass boat in the boathouse on Longmere.
// At the harbour office you put a boat in store or have one put back in the water: hers is a berth
// on your own finger of the pontoon (OWN_FINGER, in terrain.js), and the camp's and the lake's
// boats go back to where they always lie. The supply ship and bringing a boat round (see main.js)
// only ever move the boats that are afloat.

export const MAX_AFLOAT = 3;

// Where each kind of boat lives.
export const HOMES = {
  row: 'camp', skiff: 'camp', kayak: 'camp',
  bass: 'lake',
  sail: 'harbour', cabin: 'harbour', cruiser: 'harbour', console: 'harbour', jetski: 'harbour', windsurf: 'harbour', rib: 'harbour',
};
export const homeOf = (kind) => HOMES[kind] || 'harbour';
export const STORE_WORDS = {
  harbour: 'in the boat store behind the harbour office',
  camp: 'pulled up above the tide at the camp',
  lake: 'in the boathouse on Longmere',
};
export const LAUNCH_WORDS = {
  harbour: 'on your finger of the pontoon',
  camp: 'at the landing by the camp',
  lake: 'alongside the boathouse jetty on Longmere',
};

// A new game: the camp's three boats in the water, everything else in store.
export const NEW_AFLOAT = ['row', 'skiff', 'kayak'];

// A game from before boats were laid up: which three stay in the water. The boat you're in (or
// last used) first; then any you've left somewhere other than where she lives (you've been out
// in her); then the rest in the order a fisherman would want them.
const ORDER = ['skiff', 'row', 'console', 'cabin', 'cruiser', 'rib', 'sail', 'kayak', 'bass', 'jetski', 'windsurf'];
export function chooseAfloat(kinds, { vessel = null, away = [] } = {}) {
  const pick = [];
  const add = (k) => {
    if (kinds.includes(k) && !pick.includes(k) && pick.length < MAX_AFLOAT) pick.push(k);
  };
  add(vessel);
  for (const k of ORDER) if (away.includes(k)) add(k);
  for (const k of ORDER) add(k);
  for (const k of kinds) add(k);
  return pick;
}

// The berths along your own finger (F: { x0, x1, z0, z1 }, running out from the pontoon on its
// east side, or its west with east false) for the harbour boats in the water: each lies
// alongside, bow out, along one side or the other (of `sides`), longest first, a metre between. lengths: kind -> her length (m); beams: kind
// -> her half-beam. Returns kind -> { x, z, heading, side } (side +1: the seaward side), leaving
// out any that don't fit.
export function ownBerths(F, kinds, lengths, beams, sides = [1, -1], east = true) {
  const out = {};
  // (Along from the pontoon: out towards +x on an east finger, −x on a west one.)
  const room = sides.map((side) => ({ side, at: 0.6 }));
  const order = [...kinds].sort((a, b) => lengths[b] - lengths[a] || a.localeCompare(b));
  for (const k of order) {
    const L = lengths[k];
    // (The side with the most room left.)
    const r = room.filter((s) => s.at + L <= F.x1 - F.x0 + 0.4).sort((a, b) => a.at - b.at)[0];
    if (!r) continue;
    const u = r.at + L / 2, x = east ? F.x0 + u : F.x1 - u, z = r.side > 0 ? F.z1 + beams[k] + 0.25 : F.z0 - beams[k] - 0.25;
    out[k] = { x, z, heading: east ? Math.PI / 2 : -Math.PI / 2, side: r.side };
    r.at += L + 1;
  }
  return out;
}

// A saved list of stored boats, made sensible: known kinds only, each once, and never so many
// that fewer than one is afloat (nor so few that more than MAX_AFLOAT are). null: not yet chosen
// (a game from before boats were laid up). seen: the kinds the save knew (where each was left);
// a boat new to the game since starts laid up.
export function cleanStored(raw, kinds, seen = null) {
  if (!Array.isArray(raw)) return null;
  const s = [...new Set(raw.filter((k) => kinds.includes(k)))];
  if (seen) for (const k of kinds) if (!seen.includes(k) && !s.includes(k)) s.push(k);
  const afloat = kinds.filter((k) => !s.includes(k));
  if (afloat.length < 1) return null;
  if (afloat.length > MAX_AFLOAT) return null;
  return s;
}
