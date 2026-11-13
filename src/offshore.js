// The offshore day (E3b): what a run out to far water (the Blue Water above all, a kilometre out)
// asks of you and your boat, from the game's own numbers:
// - how long each way and the fuel there and back, at her cruising pace (the speeds measured with
//   each boat's own physics in calm water; the burn as fuel.js has it);
// - whether she's a boat for the open sea (the sea her people are happy in, vessels.js);
// - the gale (world/forecast.js) and the dark against the time it takes to get home;
// - how the sea is for her now.
// Nothing here stops you going: it's what a skipper would think through, said.

import { BOAT_PER_S, isPetrol } from './fuel.js';
import { LEVERS } from './throttle.js';
import { vesselOf, hullOf, misery, hullMisery } from './vessels.js';

export const HOUR_S = 40; // real seconds a game hour (world/clock.js)
// Further than this from Willowhaven (m), you're offshore: the planner thinks the run through, and
// out there the game watches the fuel, the gale and the dark against the way home.
export const OFFSHORE_AT = 600;

// Her cruising pace (m/s, calm water) and the notch it's at: the cruise notch where she has one
// (the centre console, the RIB), else flat out; the rowing boat and the kayak at a steady pull.
// (Measured with boat.js in calm water: tests/offshore.test.mjs checks the motorboats' against it.)
const notch = (kind, id) => LEVERS[kind]?.find((n) => n.id === id)?.v ?? 1;
export const CRUISE = {
  skiff: { v: 6.9, lever: 1 },
  cabin: { v: 5.7, lever: 1 },
  console: { v: 9.6, lever: notch('console', 'C') },
  rib: { v: 11.4, lever: notch('rib', 'C') },
  cruiser: { v: 9.4, lever: 1 },
  jetski: { v: 15.8, lever: 1 },
  bass: { v: 8.9, lever: 1 },
  sail: { v: 3.5, lever: 1 }, // (under her little outboard; under sail, the wind decides)
  row: { v: 5, lever: 0 },
  kayak: { v: 3.2, lever: 0 },
};

// A run of dist metres in her: { hours (game hours), litres (none for oars and paddles) }.
export function runOf(kind, dist) {
  const C = CRUISE[kind] || CRUISE.row;
  const secs = dist / C.v;
  const litres = isPetrol(kind) ? (BOAT_PER_S[kind] ?? 0) * Math.pow(C.lever, 1.5) * secs : 0;
  return { hours: secs / HOUR_S, litres };
}

// A boat made for the open sea: one her people are happy in a metre of sea or more (the sailing
// boat, the RIB, the centre console, the cabin boat, the yacht). The rest are inshore boats. (As
// she was built: a spray dodger keeps her people drier, not her any safer out there.)
export const OPEN_SEA = 1.0;
export const openSea = (kind) => hullOf(kind).comfort >= OPEN_SEA;

// The sea for her (sea: significant wave height, m): 'fine', 'lively' (her people feel it),
// 'rough' (they're miserable: past half of misery), or 'dangerous' (a good way past what she's
// for: misery full, and green water coming aboard an open boat).
export function seaFor(kind, sea) {
  const m = misery(kind, sea);
  return hullMisery(kind, sea) >= 1 ? 'dangerous' : m > 0.5 ? 'rough' : m > 0 ? 'lively' : 'fine';
}

// Time to turn for home? distHome (m), litres (in the tank, or null for no engine), toGale (hours,
// or null for none coming), toDark (hours until sunset, or null if dark already or no matter).
// The margins: fuel for the way home and half as much again; home an hour before the gale; an
// open boat home half an hour before dark. Returns { why: 'fuel' | 'gale' | 'dark', home (the run
// home), words } or null.
export function turnForHome({ kind, distHome, litres = null, toGale = null, toDark = null }) {
  const home = runOf(kind, distHome), V = vesselOf(kind), name = V.name;
  const hrs = (h) => (h < 1 ? `${Math.max(5, Math.round((h * 60) / 5) * 5)} minutes` : `${Math.round(h * 2) / 2} hours`);
  if (litres != null && isPetrol(kind) && litres < home.litres * 1.5 + 0.5)
    return { why: 'fuel', home, words: `Time to turn for home: it’s about ${Math.max(1, Math.round(home.litres))} L back to Willowhaven in the ${name}, and you have ${Math.max(0, Math.round(litres))} L: too little to spare out here.` };
  if (toGale != null && toGale < home.hours + 1)
    return { why: 'gale', home, words: `Time to turn for home: a gale’s due in ${hrs(toGale)}, and it’s ${hrs(home.hours)} back to Willowhaven in the ${name}.` };
  if (toDark != null && !V.shelter && toDark < home.hours + 0.5)
    return { why: 'dark', home, words: `Time to turn for home: the sun sets in ${hrs(toDark)}, and it’s ${hrs(home.hours)} back in the open ${name}.` };
  return null;
}

// What the trip planner says about going to far water: { ok, text } lines. dist: from where you
// are (m); kind: the boat you'd take; litres: in her tank (null for none); toGale: hours, or null;
// season: how active the fish is this season (season.js, 1 as usual), and its name for the words.
export function offshorePlan({ placeName, dist, kind, litres = null, toGale = null, season = 1, seasonName = '', fish = '' }) {
  const out = [], run = runOf(kind, dist), V = vesselOf(kind);
  const hrs = (h) => (h < 1 ? `${Math.max(5, Math.round((h * 60) / 5) * 5)} minutes` : `${Math.round(h * 2) / 2} hours`);
  const km = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist / 10) * 10} m`;
  const fuel = isPetrol(kind) ? `, ${Math.ceil(run.litres * 2)} L of fuel there and back${litres != null ? ` (${Math.floor(litres)} L aboard)` : ''}` : '';
  out.push({ ok: litres == null || !isPetrol(kind) || litres >= run.litres * 2 * 1.3, text: `${placeName} is ${km} away: about ${hrs(run.hours)} each way in the ${V.name}${fuel}.` });
  if (!openSea(kind)) out.push({ ok: false, text: `The ${V.name} is an inshore boat: a sea over ${hullOf(kind).comfort} m and she’s in trouble out there. The RIB, the centre console, the cabin boat and the yacht are made for it.` });
  if (toGale != null) out.push({ ok: toGale > run.hours * 2 + 2, text: `A gale is due in ${hrs(toGale)}: ${toGale > run.hours * 2 + 2 ? `time to get out, fish ${hrs(toGale - run.hours * 2 - 1)} and be home an hour before it` : 'not long enough to get out there, fish and be back before it'}.` });
  else out.push({ ok: true, text: 'No gale on the way in the next day or so.' });
  if (season < 0.35 && fish) out.push({ ok: false, text: `The ${fish} is scarce in ${seasonName || 'this season'}: few are out there now.` });
  return out;
}
