import { fishById } from './fish.js';
import { PLACES, ZONE_NAMES, zoneAt } from './world/terrain.js';
import { habitsOf } from './guide.js';

// Planning a fishing trip from the field guide: a target species, the stretches of water that
// suit it (from the map's own habitat data: waters, habitats and depths, never where any fish
// is), a setup the tackle rules accept, a destination marked on the map and on screen, and
// afterwards what the trip brought. It guarantees nothing: fish move, feed and wait as they
// always do.

export const HOME_WORDS = {
  sand: 'open sand', weed: 'weed beds', rock: 'rocks', deep: 'deep water', open: 'open water', cove: 'sheltered coves',
  reef: 'reefs and kelp', surf: 'surf off rocky points', tide: 'tide races', channel: 'the channel', flats: 'sand and mud flats',
  quay: 'the quay wall', reeds: 'reed edges', blue: 'the open ocean', pool: 'stream pools', margin: 'lake margins', pads: 'lily pads',
  snag: 'snags and fallen trees', dropoff: 'drop-offs', holm: 'island shores', shallows: 'shallows',
};

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
// A bearing in words. (The world's north is -z, as on the map.)
export const bearing = (dx, dz) => COMPASS[Math.round(((Math.atan2(dx, -dz) / (Math.PI * 2)) * 8 + 8)) % 8];

// Where it's worth going for a species: its suitable stretches of water, named by the nearest
// place you know (or the water itself), nearest first, up to `max`.
export function tripPlaces(sp, map, from, state, max = 4) {
  const H = habitsOf(sp);
  const homes = [...new Set(sp.life.homes.map((h) => HOME_WORDS[h] || h))];
  const out = [];
  for (const a of map.areasFor(sp.id)) {
    // The point of the area nearest you, so the marker leads to the closest suitable water.
    const p = a.pts.reduce((b, q) => (Math.hypot(q[0] - from.x, q[1] - from.z) < Math.hypot(b[0] - from.x, b[1] - from.z) ? q : b));
    const named = PLACES.filter((pl) => !pl.area && state.places[pl.id])
      .map((pl) => ({ pl, d: Math.hypot(pl.x - p[0], pl.z - p[1]) }))
      .sort((x, y) => x.d - y.d)[0];
    const zone = zoneAt(p[0], p[1]) || a.zone;
    const name = named && named.d < 160 ? `${ZONE_NAMES[zone] || zone}, near ${named.pl.name}` : ZONE_NAMES[zone] || zone;
    const dist = Math.hypot(p[0] - from.x, p[1] - from.z);
    out.push({ x: p[0], z: p[1], r: Math.min(60, Math.max(22, a.r * 0.5)), zone, name, dist, dir: bearing(p[0] - from.x, p[1] - from.z), size: a.cells, homes, depth: H.depth });
  }
  // Nearest first, but not a sliver: the bigger stretches win a close call.
  out.sort((a, b) => a.dist / Math.sqrt(a.size) - b.dist / Math.sqrt(b.size));
  const picked = [];
  for (const o of out) {
    if (picked.length >= max) break;
    if (picked.some((q) => Math.hypot(q.x - o.x, q.z - o.z) < 120)) continue;
    picked.push(o);
  }
  return picked;
}

// Set off: the target, the water marked, the setup chosen.
export function startTrip(state, { sp, place, setup }) {
  state.trip = {
    id: `t${Date.now().toString(36)}`, sp, start: Date.now(), day: state.day, hour: state.hour,
    x: Math.round(place.x), z: Math.round(place.z), r: Math.round(place.r), name: place.name,
    setup: { rod: setup.rod, item: setup.item, term: setup.term, line: setup.line },
    arrived: false,
  };
  return state.trip;
}

// What a trip has brought so far (or brought, once ended): every catch logged since it began.
export function tripSummary(state, trip = state.trip) {
  if (!trip) return null;
  const end = trip.end ?? Infinity;
  const log = state.log.filter((e) => e.at >= trip.start && e.at <= end);
  const target = log.filter((e) => e.sp === trip.sp);
  const others = {};
  for (const e of log) if (e.sp !== trip.sp) others[e.sp] = (others[e.sp] || 0) + 1;
  const hours = Math.max(0, ((trip.endDay ?? state.day) - trip.day) * 24 + (trip.endHour ?? state.hour) - trip.hour);
  return {
    target: target.length, best: target.reduce((b, e) => (!b || e.size > b.size ? e : b), null),
    others, total: log.length, hours, onSetup: target.filter((e) => e.rod === trip.setup.rod && e.item === trip.setup.item).length,
  };
}

// Home again: the trip goes into the record (the last twenty), with what it brought.
export function endTrip(state) {
  const trip = state.trip;
  if (!trip) return null;
  Object.assign(trip, { end: Date.now(), endDay: state.day, endHour: state.hour });
  const sum = tripSummary(state, trip);
  state.trips.push({ sp: trip.sp, name: trip.name, day: trip.day, hours: Math.round(sum.hours * 10) / 10, target: sum.target, best: sum.best?.size ?? null, total: sum.total, setup: trip.setup });
  if (state.trips.length > 20) state.trips.splice(0, state.trips.length - 20);
  state.trip = null;
  return sum;
}

// In words, for the guide and the end of a trip.
export function summaryText(sp, sum) {
  const name = fishById[sp]?.name.toLowerCase() || sp;
  const others = Object.entries(sum.others).map(([id, n]) => `${n} ${fishById[id]?.name.toLowerCase() || id}`).join(', ');
  const m = Math.max(1, Math.round(sum.hours * 60)), hh = Math.round(sum.hours * 10) / 10;
  const h = sum.hours < 1 ? `${m} minute${m > 1 ? 's' : ''}` : `${hh} hour${hh === 1 ? '' : 's'}`;
  const got = sum.target ? `${sum.target} ${name}${sum.best ? ` (best ${sum.best.size} cm)` : ''}` : `no ${name} yet`;
  return `${h} out: ${got}${others ? `, and ${others}` : ''}.`;
}
