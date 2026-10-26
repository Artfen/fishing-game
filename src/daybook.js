import { fishById } from './fish.js';
import { PLACES } from './world/terrain.js';
import { SOUTH_ZONES } from './world/brasa.js';
import { seasonWords } from './world/season.js';
import { SEA_LIFE } from './world/sealife.js';
import { DIVE_SITES, siteById } from './world/divesites.js';
import { lower, an } from './innTalk.js';

// The day book: every day out becomes a page in your journal, written up when the day ends (you
// sleep, or midnight passes): the weather and the tides, where you went and how, what you caught
// and what you let go, your firsts and your biggest yet, the dives, the sea life you saw, and how
// you weathered a gale. As the day goes the game notes a few things (state.today); the rest comes
// from the catch log and the records. Also here: your record (the totals, your best fish, the
// notable ones) and the harbour's challenges, each worth a cloth badge for the board at home.

const DAYS_KEPT = 60;
const SHELTERED = new Set(['bay', 'cove', 'lake', 'stream', 'estuary', 'mere', 'river', 'tarn', 'tideway', 'harbor']);
export const isSheltered = (zone) => SHELTERED.has(zone);

/* ---------------- today, as it goes ---------------- */

export function newToday(day) {
  return { day, out: null, back: null, places: [], boats: [], dives: [], seen: [], sky: [], gale: null, records: [], dist: { boat: 0, foot: 0, car: 0, swim: 0 } };
}
// Somewhere you were (a place's id), in order: only when it changes.
export function notePlace(today, id, hour) {
  if (today.places[today.places.length - 1] === id || today.places.length >= 30) return;
  today.places.push(id);
  if (today.out == null) today.out = hour;
}
// Moving about: how far, and how (boat, foot, car, swim).
export function noteMove(today, mode, metres, hour) {
  if (!(metres > 0) || !(mode in today.dist)) return;
  today.dist[mode] += metres;
  if (metres > 3 && mode !== 'swim') {
    if (today.out == null) today.out = hour;
    today.back = hour;
  }
}
export function noteBoat(today, name) {
  if (name && !today.boats.includes(name) && today.boats.length < 6) today.boats.push(name);
}
// A dive: at a site (its id) or not (null), and how deep.
export function noteDive(today, site, depth) {
  const d = today.dives.find((x) => x.site === site);
  if (d) d.deepest = Math.max(d.deepest, Math.round(depth * 10) / 10);
  else if (today.dives.length < 10) today.dives.push({ site, deepest: Math.round(depth * 10) / 10 });
}
export function noteSeen(today, kind) {
  if (!today.seen.includes(kind) && today.seen.length < 12) today.seen.push(kind);
}
export function noteSky(today, sky) {
  if (sky && today.sky[today.sky.length - 1] !== sky && today.sky.length < 8) today.sky.push(sky);
}
// Where you were while a gale blew: out on open water is worst, then sheltered water, then ashore.
const GALE_RANK = { ashore: 1, shelter: 2, out: 3 };
export function noteGale(today, where) {
  if (!GALE_RANK[where]) return;
  if (!today.gale || GALE_RANK[where] > GALE_RANK[today.gale]) today.gale = where;
}
// Your biggest yet of a kind (not a first).
export function noteRecord(today, sp, size) {
  const r = today.records.find((x) => x.sp === sp);
  if (r) r.size = Math.max(r.size, size);
  else if (today.records.length < 12) today.records.push({ sp, size });
}

/* ---------------- the day's page ---------------- */

// The page for a day (from today's notes, the log and the records), or null if nothing happened
// worth writing down.
export function dayPage(state, today = state.today) {
  const day = today.day;
  const log = state.log.filter((e) => e.day === day);
  const kinds = {};
  for (const e of log) kinds[e.sp] = (kinds[e.sp] || 0) + 1;
  const firstFish = Object.entries(state.fish || {}).filter(([, r]) => r.firstDay === day).map(([id]) => id).filter((id) => fishById[id]);
  const firstPlaces = Object.entries(state.places || {}).filter(([, r]) => r.day === day).map(([id]) => id).filter((id) => PLACES.some((p) => p.id === id));
  const firstSites = Object.entries(state.dive?.sites || {}).filter(([, r]) => r.first === day).map(([id]) => id).filter((id) => siteById[id]);
  const firstLife = Object.entries(state.seaLife || {}).filter(([, r]) => r.day === day).map(([k]) => k).filter((k) => SEA_LIFE[k]);
  const moved = Object.values(today.dist).reduce((a, b) => a + b, 0);
  const top = log.reduce((b, e) => (!b || rel(e) > rel(b) ? e : b), null);
  if (!log.length && !today.dives.length && !today.seen.length && moved < 150 && !firstPlaces.length) return null;
  return {
    day, season: seasonWords(day), sky: today.sky.slice(), out: today.out, back: today.back,
    places: today.places.slice(), boats: today.boats.slice(), dist: Object.fromEntries(Object.entries(today.dist).map(([k, v]) => [k, Math.round(v)])),
    caught: log.length, kept: log.filter((e) => e.outcome !== 'released').length, kinds,
    best: top ? { sp: top.sp, size: top.size } : null,
    records: today.records.filter((r) => !firstFish.includes(r.sp)), firsts: { fish: firstFish, places: firstPlaces, sites: firstSites, life: firstLife },
    dives: today.dives.slice(), seen: today.seen.slice(), gale: today.gale,
  };
}
// The page goes into the book (the last sixty days), and a new day starts.
export function closeDay(state, newDay) {
  const page = state.today ? dayPage(state, state.today) : null;
  if (page) {
    state.days.push(page);
    if (state.days.length > DAYS_KEPT) state.days.splice(0, state.days.length - DAYS_KEPT);
  }
  state.today = newToday(newDay);
  return page;
}

// How big a fish was for its kind (0 the smallest here, 1 the biggest).
export function rel(e) {
  const sp = fishById[e.sp];
  return sp ? (e.size - sp.size[0]) / Math.max(1, sp.size[1] - sp.size[0]) : 0;
}

const SKY_WORDS = { clear: 'clear', partly: 'some cloud', overcast: 'grey', light: 'showers', heavy: 'heavy rain', storm: 'a storm' };
const listWords = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const placeName = (id) => {
  const p = PLACES.find((q) => q.id === id);
  return p ? p.name.replace(/^The /, 'the ') : null;
};
const fishName = (id) => lower(fishById[id]?.name || id);
const km = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The page in words: a few plain sentences, the way you'd write up a day.
export function dayText(p) {
  const out = [];
  const sky = p.sky.map((s) => SKY_WORDS[s]).filter(Boolean);
  if (sky.length) out.push(`${cap(sky.length > 1 ? `${sky[0]}, later ${listWords(sky.slice(1))}` : sky[0])}.`);
  // Where, and how.
  // (Setting out from a harbour, a landing or a camp: out from it, and back if you came back.)
  const base = (id) => PLACES.some((q) => q.id === id && (q.camp || q.dock || q.harbour));
  const ids = p.places.slice(), from = ids.length > 1 && base(ids[0]) ? ids.shift() : null;
  const back = from && ids[ids.length - 1] === from && ids.pop() && true;
  const where = [...new Set(ids.map(placeName).filter(Boolean))].filter((n) => n !== placeName(from));
  const by = p.boats.length ? ` by the ${listWords(p.boats)}` : '';
  const legs = [['boat', 'on the water'], ['foot', 'on foot'], ['car', 'by car'], ['swim', 'in the water']].filter(([k]) => p.dist[k] >= 100).map(([k, w]) => `${km(p.dist[k])} ${w}`);
  const start = from ? `Out from ${placeName(from)}${by}` : `Out${by}`;
  if (where.length) out.push(`${start} to ${listWords(where.slice(0, 7))}${where.length > 7 ? ' and more' : ''}${back ? ', and back' : ''}${legs.length ? ` (${listWords(legs)})` : ''}.`);
  else if (legs.length) out.push(`Out and about: ${listWords(legs)}.`);
  // What you caught.
  if (p.caught) {
    const kinds = Object.entries(p.kinds).sort((a, b) => b[1] - a[1]).map(([id, n]) => (n === 1 ? an(fishName(id)) : `${n} ${fishName(id)}`));
    const freed = p.caught - p.kept;
    out.push(`Caught ${p.caught}: ${listWords(kinds.slice(0, 6))}${kinds.length > 6 ? ' and more' : ''}. ${p.kept ? `Kept ${p.kept}${freed ? `, let ${freed} go` : ''}.` : `Let ${p.caught === 1 ? 'it' : 'them all'} go.`}`);
  } else if (where.length || legs.length) out.push('Nothing caught.');
  for (const id of p.firsts.fish) out.push(`Your first ${fishName(id)}.`);
  for (const r of p.records) out.push(`Your biggest ${fishName(r.sp)} yet: ${r.size} cm.`);
  // Down below.
  if (p.dives.length) {
    const at = p.dives.map((d) => (d.site && siteById[d.site] ? `${siteById[d.site].name.replace(/^The /, 'the ')} (down to ${Math.round(d.deepest)} m)` : `off the boat (down to ${Math.round(d.deepest)} m)`));
    out.push(`Dived ${listWords(at)}.`);
  }
  if (p.seen.length) out.push(`Saw ${listWords(p.seen.map((k) => (SEA_LIFE[k]?.name || k).toLowerCase()))}.`);
  const found = [...p.firsts.places.map(placeName)].filter(Boolean);
  if (found.length) out.push(`Found ${listWords(found)}.`);
  if (p.gale === 'out') out.push('A gale caught you out on open water.');
  else if (p.gale === 'shelter') out.push('When the gale blew, you kept to sheltered water.');
  else if (p.gale === 'ashore') out.push('You sat the gale out ashore.');
  return out.join(' ');
}
// A line for the morning after: the day in a sentence or two.
export function dayLine(p) {
  const bits = [];
  if (p.caught) bits.push(`${p.caught} fish${p.firsts.fish.length ? `, ${p.firsts.fish.length === 1 ? 'a new kind' : `${p.firsts.fish.length} new kinds`}` : ''}`);
  if (p.dives.length) bits.push(`${p.dives.length === 1 ? 'a dive' : `${p.dives.length} dives`}`);
  if (p.firsts.places.length) bits.push(`${p.firsts.places.length === 1 ? 'a new place' : `${p.firsts.places.length} new places`}`);
  if (p.seen.length) bits.push(listWords(p.seen.slice(0, 2).map((k) => (SEA_LIFE[k]?.name || k).toLowerCase())));
  return `Day ${p.day} is written up in your journal${bits.length ? `: ${listWords(bits)}` : ''}.`;
}

/* ---------------- your record ---------------- */

export function careerOf(state) {
  const log = state.log;
  const released = log.filter((e) => e.outcome === 'released').length;
  const bests = Object.entries(state.fish || {}).filter(([id]) => fishById[id]).map(([id, r]) => ({ sp: id, size: r.best, count: r.count, k: rel({ sp: id, size: r.best }) }))
    .sort((a, b) => b.k - a.k);
  // (The fish to remember: near the top of the sizes their kind grows to, and not the little
  // kinds; the best of each kind only.)
  const notable = [];
  for (const e of log.filter((x) => rel(x) >= 0.8 && fishById[x.sp].size[1] >= 30).sort((a, b) => rel(b) - rel(a))) {
    if (!notable.some((n) => n.sp === e.sp)) notable.push(e);
    if (notable.length >= 8) break;
  }
  return {
    days: state.days.length,
    fish: log.length, kinds: bests.length, released, kept: log.length - released,
    places: PLACES.filter((p) => state.places?.[p.id]).length, placesOf: PLACES.length,
    dives: state.dive?.dives || 0, deepest: state.dive?.deepest || 0, longest: state.dive?.longest || 0,
    sites: DIVE_SITES.filter((s) => state.dive?.sites?.[s.id]?.dives).length, sitesOf: DIVE_SITES.length,
    life: Object.keys(state.seaLife || {}).filter((k) => SEA_LIFE[k]).length,
    bests, notable,
  };
}

/* ---------------- the harbour's challenges ---------------- */

// Gentle ones, for the board in the Lobster Pot: none needs doing, each is a reason to go somewhere
// or try something. Done, each gives a cloth badge for the board at home. check(state) →
// { n, of } (done when n ≥ of).
const kindsWhere = (log, test) => new Set(log.filter(test).map((e) => e.sp)).size;
const logOf = (s) => s.log || [];
const WATERS = { sea: (z) => ['bay', 'cove', 'open', 'coast', 'deep'].includes(z), estuary: (z) => z === 'estuary' || z === 'tideway', lake: (z) => ['lake', 'mere', 'tarn'].includes(z), river: (z) => z === 'stream' || z === 'river' };
export const CHALLENGES = [
  {
    id: 'bayten', name: 'Ten from the bay', color: '#2f6f8a', mark: 'ten',
    text: 'Ten different kinds of fish from Willow Bay and its coves.',
    check: (s) => ({ n: kindsWhere(logOf(s), (e) => e.zone === 'bay' || e.zone === 'cove'), of: 10 }),
  },
  {
    id: 'slam', name: 'The coast slam', color: '#3c7a52', mark: 'three',
    text: 'A bass, a pollack and a mackerel, all on the same day.',
    check: (s) => {
      let n = 0;
      const days = new Set(logOf(s).map((e) => e.day));
      for (const d of days) n = Math.max(n, ['seabass', 'pollack', 'mackerel'].filter((id) => logOf(s).some((e) => e.day === d && e.sp === id)).length);
      return { n, of: 3 };
    },
  },
  {
    id: 'waters', name: 'Every water', color: '#7a5a2f', mark: 'drop',
    text: 'A fish from the sea, the estuary, a lake and a river.',
    check: (s) => ({ n: Object.values(WATERS).filter((t) => logOf(s).some((e) => t(e.zone))).length, of: 4 }),
  },
  {
    id: 'kinds', name: 'Twenty-five kinds', color: '#8a3a3a', mark: 'fish',
    text: 'Twenty-five different kinds of fish caught.',
    check: (s) => ({ n: Object.keys(s.fish || {}).filter((id) => fishById[id]).length, of: 25 }),
  },
  {
    id: 'specimen', name: 'A specimen', color: '#b08a2a', mark: 'star',
    text: 'A fish in the top tenth of the sizes its kind grows to here.',
    check: (s) => ({ n: logOf(s).some((e) => rel(e) >= 0.9) ? 1 : 0, of: 1 }),
  },
  {
    id: 'release', name: 'Fifty let go', color: '#4a7a7a', mark: 'wave',
    text: 'Fifty fish put back alive.',
    check: (s) => ({ n: logOf(s).filter((e) => e.outcome === 'released').length, of: 50 }),
  },
  {
    id: 'night', name: 'After midnight', color: '#2a3550', mark: 'moon',
    text: 'A fish caught between midnight and four in the morning.',
    check: (s) => ({ n: logOf(s).some((e) => e.hour < 4) ? 1 : 0, of: 1 }),
  },
  {
    id: 'gale', name: 'Fished through a gale', color: '#5a5f6a', mark: 'storm',
    text: 'A fish from sheltered water while a gale was blowing.',
    check: (s) => ({ n: logOf(s).some((e) => e.sky === 'storm' && isSheltered(e.zone)) ? 1 : 0, of: 1 }),
  },
  {
    id: 'sites', name: 'Five dives', color: '#c23b2e', mark: 'flag',
    text: 'All five dive sites dived: Skerries Reef, the Kelp Forest, the Kittiwake, Anchor Sands and the Hound.',
    check: (s) => ({ n: DIVE_SITES.filter((x) => s.dive?.sites?.[x.id]?.dives).length, of: DIVE_SITES.length }),
  },
  {
    id: 'thirty', name: 'Thirty metres', color: '#1f4e6f', mark: 'down',
    text: 'Down to thirty metres on a tank (the Hound’s foot is the place).',
    check: (s) => ({ n: (s.dive?.deepest || 0) >= 28 ? 1 : 0, of: 1 }),
  },
  {
    id: 'south', name: 'Las Brasas', color: '#d9822b', mark: 'sun',
    text: 'A fish from Las Brasas, the island far to the south.',
    check: (s) => ({ n: logOf(s).some((e) => SOUTH_ZONES.includes(e.zone)) ? 1 : 0, of: 1 }),
  },
  {
    id: 'week', name: 'A week on the water', color: '#6a4a7a', mark: 'seven',
    text: 'Seven days out fishing (a day you caught something).',
    check: (s) => ({ n: new Set(logOf(s).map((e) => e.day)).size, of: 7 }),
  },
];
export const challengeById = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
// Any newly done: their badges go to state.badges ({ id: { day, hour } }); returns them.
export function checkChallenges(state) {
  const done = [];
  state.badges ||= {};
  for (const c of CHALLENGES) {
    if (state.badges[c.id]) continue;
    const p = c.check(state);
    if (p.n >= p.of) {
      state.badges[c.id] = { day: state.day, hour: state.hour };
      done.push(c);
    }
  }
  return done;
}

/* ---------------- the save ---------------- */

const num = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const strs = (a, n, test = (x) => typeof x === 'string' && x.length < 40) => (Array.isArray(a) ? a.filter(test).slice(0, n) : []);
const fishOk = (id) => !!fishById[id];
function cleanDist(d) {
  const o = d && typeof d === 'object' ? d : {};
  return { boat: num(o.boat, 0, 0, 1e7), foot: num(o.foot, 0, 0, 1e7), car: num(o.car, 0, 0, 1e7), swim: num(o.swim, 0, 0, 1e7) };
}
const cleanDives = (a) => (Array.isArray(a) ? a.filter((d) => d && typeof d === 'object').slice(0, 10).map((d) => ({ site: siteById[d.site] ? d.site : null, deepest: num(d.deepest, 0, 0, 100) })) : []);
const cleanRecords = (a) => (Array.isArray(a) ? a.filter((r) => r && fishOk(r.sp)).slice(0, 12).map((r) => ({ sp: r.sp, size: Math.round(num(r.size, 1, 1, 400)) })) : []);
const GALE = ['ashore', 'shelter', 'out'];
export function cleanToday(raw, day) {
  if (!raw || typeof raw !== 'object' || raw.day !== day) return newToday(day);
  return {
    day, out: raw.out == null ? null : num(raw.out, null, 0, 24), back: raw.back == null ? null : num(raw.back, null, 0, 24),
    places: strs(raw.places, 30), boats: strs(raw.boats, 6), dives: cleanDives(raw.dives), seen: strs(raw.seen, 12, (k) => !!SEA_LIFE[k]),
    sky: strs(raw.sky, 8), gale: GALE.includes(raw.gale) ? raw.gale : null, records: cleanRecords(raw.records), dist: cleanDist(raw.dist),
  };
}
export function cleanDays(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p) => p && typeof p === 'object' && Number.isFinite(p.day)).slice(-DAYS_KEPT).map((p) => {
    const kinds = {};
    for (const [id, n] of Object.entries(p.kinds && typeof p.kinds === 'object' ? p.kinds : {})) if (fishOk(id)) kinds[id] = Math.round(num(n, 1, 1, 1e4));
    const f = p.firsts && typeof p.firsts === 'object' ? p.firsts : {};
    return {
      day: Math.round(num(p.day, 1, 1, 1e6)), season: typeof p.season === 'string' ? p.season.slice(0, 30) : '', sky: strs(p.sky, 8),
      out: p.out == null ? null : num(p.out, null, 0, 24), back: p.back == null ? null : num(p.back, null, 0, 24),
      places: strs(p.places, 30), boats: strs(p.boats, 6), dist: cleanDist(p.dist),
      caught: Math.round(num(p.caught, 0, 0, 1e4)), kept: Math.round(num(p.kept, 0, 0, 1e4)), kinds,
      best: p.best && fishOk(p.best.sp) ? { sp: p.best.sp, size: Math.round(num(p.best.size, 1, 1, 400)) } : null,
      records: cleanRecords(p.records),
      firsts: { fish: strs(f.fish, 20, fishOk), places: strs(f.places, 20), sites: strs(f.sites, 5, (x) => !!siteById[x]), life: strs(f.life, 12, (k) => !!SEA_LIFE[k]) },
      dives: cleanDives(p.dives), seen: strs(p.seen, 12, (k) => !!SEA_LIFE[k]), gale: GALE.includes(p.gale) ? p.gale : null,
    };
  });
}
export function cleanBadges(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const c of CHALLENGES) {
    const b = raw[c.id];
    if (b && typeof b === 'object') out[c.id] = { day: Math.round(num(b.day, 1, 1, 1e6)), hour: num(b.hour, 12, 0, 24) };
  }
  return out;
}
