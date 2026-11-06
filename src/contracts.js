// Work on the water: contracts posted on Willowhaven's notice board, alongside the harbour folk's
// favours (requests.js), the adventures (adventures.js) and the badges, not instead of them.
//
// Every job uses the game's own systems, and what's offered depends on the world as it is that day
// (see offers): the fish that are busy, the sea life about, the season, the region you're in, the
// weather and what's forecast. A gale brings no deliveries; dolphins about bring a call for
// pictures of them on a bow; birds working the water bring a call to watch it.
//
//  · fishing   catch a species at a size, a mixed bag on one trip, one on the fly, a trophy
//              photographed and let go;
//  · wildlife  dolphins on your bow (photographed), a whale's position logged, a feeding frenzy
//              watched, a turtle photographed;
//  · survey    a sonar transect, the water's temperature at marks (some by night);
//  · delivery  a box to Wend Quay, spares across the ocean to Puerto Brasa (fair weather only);
//  · handling  berthing alongside without a bump, a course round the marks, the same under sail.
//
// A contract is accepted from the board (three at a time), shown on the map and in the journal,
// done out there, and paid when you're back at the board (or on arrival, for a delivery). Paid
// once: a finished contract is struck off, and its id kept so it can never be paid again.
// Abandoned: struck off, nothing lost but the job; anything it put in the world goes with it.
//
// Pure: the game passes in what's happening (main.js) and does the paying and the showing.

import { fits, smallestFor, misery, vesselOf, VESSELS, KG_PER_PERSON } from './vessels.js';

export const CONTRACT_MAX = 3;
export const CATEGORIES = { fishing: 'Fishing', wildlife: 'Wildlife', survey: 'Survey', delivery: 'Delivery', handling: 'Boat handling', charter: 'Charter' };
// Who offers work (the harbour's people, and the bodies they speak for).
export const GIVERS = {
  ruth: 'Ruth at The Lobster Pot',
  mags: 'Mags Pennock, fishmonger',
  bert: 'Old Bert, the chandlery',
  club: 'Willow Bay Angling Club',
  trust: 'Willow Bay Marine Trust',
  wenna: 'Wenna, the harbour office',
  sailing: 'Willowhaven Sailing Club',
  paco: 'Paco, Bar El Muelle',
  trips: 'Willow Bay Boat Trips',
  divers: 'Willow Bay Sub-Aqua Club',
};

// A career on the water: what you're trusted with grows with the jobs you've done. Carrying paying
// passengers wants a ticket (as it does for real: a commercial endorsement), and a bigger party or
// a heavier load a better one. jobs: finished jobs it takes; pax: the most passengers a charter
// offered to you carries; kg: the heaviest freight.
export const CAREER = [
  { id: 'hand', name: 'Odd-job hand', jobs: 0, pax: 0, kg: 300, says: 'fishing, wildlife, surveys, deliveries and boat handling' },
  { id: 'boatman', name: 'Boatman', jobs: 3, pax: 3, kg: 500, says: 'a passenger ticket: small charters, up to three aboard' },
  { id: 'skipper', name: 'Skipper', jobs: 8, pax: 6, kg: 800, says: 'charters of up to six, dive parties, heavier freight' },
  { id: 'master', name: 'Master', jobs: 15, pax: 8, kg: 1500, says: 'the biggest charters and the heaviest freight' },
];
// Where you are in it: { rank, next (or null), toGo (jobs to the next) }.
export function career(C) {
  let i = 0;
  while (i + 1 < CAREER.length && C.count >= CAREER[i + 1].jobs) i++;
  const next = CAREER[i + 1] || null;
  return { rank: CAREER[i], next, toGo: next ? next.jobs - C.count : 0 };
}

const rnd = (r, a, b) => a + r() * (b - a);
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
const round5 = (v) => Math.max(5, Math.round(v / 5) * 5);
// What boat a job wants, in words: one of yours that will do (W.usable: owned, or hired today), or
// the smallest there is (W.kinds) to hire for the day. null: no boat in the game would do.
function boatFor(W, need, what) {
  const mine = smallestFor(need, W.usable || []), any = smallestFor(need, W.kinds || Object.keys(VESSELS));
  if (!any) return null;
  return mine ? `${what} (your ${vesselOf(mine).name} will do)` : `${what} (the ${vesselOf(any).name}: hire her for the day at the Marine Works)`;
}
// A day's seed (and the region's): the same board all day, a different one tomorrow.
export function seeded(n) {
  let s = (n * 2654435761) >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The jobs there can be. Each makes an offer from the world (W, see offers) and a die (r), or
// nothing if the world doesn't call for it today. An offer:
// { tpl, cat, giver, title, story, goal (what to do, in words), obj (what counts: see progress),
//   where ({ x, z, name } or null), boat (recommended), gear, difficulty 1-3, minutes, pay, rep, coop }.
export const TEMPLATES = {
  // ---- fishing ----
  special: {
    cat: 'fishing', giver: 'ruth',
    make(W, r) {
      const busy = (W.busy || []).filter((b) => b.sea);
      if (!busy.length) return null;
      const b = pick(r, busy), min = Math.round(b.min + (b.max - b.min) * rnd(r, 0.35, 0.55));
      return {
        title: `${b.name} for the specials board`, story: `Ruth wants a fine ${b.name.toLowerCase()} for tonight’s specials: they’re ${b.where}, and she hears they’re feeding well.`,
        goal: `Catch ${an(b.name)} of ${min} cm or more`, obj: { kind: 'catch', sp: b.id, min, count: 1 },
        where: b.at || null, difficulty: 1, minutes: 25, pay: round5(18 + min * 0.35), rep: 1,
      };
    },
  },
  mixedbag: {
    cat: 'fishing', giver: 'mags',
    make(W, r) {
      const n = r() < 0.5 ? 3 : 4;
      return {
        title: `A mixed bag: ${n} kinds`, story: 'Mags has a customer who wants a bit of everything for a fish stew, and she’d sooner have it from you than the wholesaler.',
        goal: `Catch ${n} different kinds of sea fish on one trip`, obj: { kind: 'catch', distinct: n, sea: true },
        difficulty: n === 3 ? 1 : 2, minutes: n * 15, pay: n * 12, rep: 1,
      };
    },
  },
  fly: {
    cat: 'fishing', giver: 'bert',
    make(W, r) {
      if (W.region !== 'home') return null;
      const min = Math.round(rnd(r, 28, 36));
      return {
        title: 'A trout on the fly', story: 'Bert’s sold a fly rod to a visitor who doesn’t believe the trout here take a fly. Bert would like the proof, and a size to boast about.',
        goal: `Catch a trout of ${min} cm or more on a fly`, obj: { kind: 'catch', sp: 'trout', min, method: 'fly', count: 1 },
        where: W.places?.stream || null, gear: 'the fly rod', difficulty: 2, minutes: 30, pay: round5(20 + min * 0.6), rep: 1,
      };
    },
  },
  trophy: {
    cat: 'fishing', giver: 'club',
    make(W, r) {
      const big = (W.busy || []).filter((b) => b.sea && b.max >= 50);
      if (!big.length) return null;
      const b = pick(r, big), min = Math.round(b.max * rnd(r, 0.68, 0.78));
      return {
        title: `Photograph and release: a big ${b.name.toLowerCase()}`, story: 'The Angling Club keeps a book of big fish photographed and let go. They’d pay to see this one in it, and see it swim away.',
        goal: `Catch ${an(b.name)} of ${min} cm or more, photograph it on the catch card, and let it go`, obj: { kind: 'catch', sp: b.id, min, released: true, photo: true, count: 1 },
        where: b.at || null, difficulty: 3, minutes: 45, pay: round5(30 + min * 0.6), rep: 2,
      };
    },
  },
  // ---- wildlife and photography ----
  bowride: {
    cat: 'wildlife', giver: 'trust',
    make(W) {
      if (!W.dolphins) return null;
      return {
        title: 'Dolphins on the bow', story: 'The Marine Trust is counting the pods that ride boats’ bow waves this season. They want a photograph of them on yours: going steadily, they’ll come.',
        goal: 'Photograph dolphins riding your bow wave', obj: { kind: 'photo', life: ['bottlenose', 'commondolphin', 'spotteddolphin'], bow: true },
        boat: 'something quick (the RIB, the console)', difficulty: 2, minutes: 25, pay: 35, rep: 2, coop: true,
      };
    },
  },
  whale: {
    cat: 'wildlife', giver: 'trust',
    make(W) {
      if (!W.whales?.length) return null;
      const w = W.whales[0];
      return {
        title: 'A whale’s position', story: `A ${w.name.toLowerCase()} has been reported ${w.where}. The Trust wants it found and its position logged as it surfaces.`,
        goal: `Be within 200 m of the ${w.name.toLowerCase()} as it surfaces to blow`, obj: { kind: 'observe', what: 'whale', r: 200, life: w.kind },
        where: w.at || null, boat: 'a seaworthy boat', difficulty: 2, minutes: 40, pay: 45, rep: 2, coop: true,
      };
    },
  },
  frenzy: {
    cat: 'wildlife', giver: 'mags',
    make(W) {
      if (!W.birds) return null;
      return {
        title: 'Birds working', story: 'Dougie says the gannets have been diving on the bait every dawn and dusk. Mags wants to know where: go and watch one, close.',
        goal: 'Get within 80 m of birds diving on a shoal', obj: { kind: 'observe', what: 'frenzy', r: 80 },
        difficulty: 1, minutes: 20, pay: 20, rep: 1, coop: true,
      };
    },
  },
  turtle: {
    cat: 'wildlife', giver: 'paco',
    make(W) {
      // (Paco writes once you've been to the island: his letters come up the board at Willowhaven.)
      if (!W.beenSouth) return null;
      return {
        title: 'Una tortuga', story: 'A letter from Paco: his niece is drawing the island’s animals for school and she has no turtle yet. A photograph of one would do: they come up to breathe off the lee of Las Brasas.',
        goal: 'Photograph a loggerhead turtle', obj: { kind: 'photo', life: ['turtle'] },
        difficulty: 1, minutes: 25, pay: 25, rep: 1,
      };
    },
  },
  // ---- survey ----
  transect: {
    cat: 'survey', giver: 'trust',
    make(W, r) {
      const line = W.surveyLines?.length ? pick(r, W.surveyLines) : null;
      if (!line) return null;
      return {
        title: `Sonar transect: ${line.name}`, story: 'The Trust is mapping the seabed. Run the line of marks with your fish finder on, slowly enough for it to read the bottom.',
        goal: `Pass each of ${line.marks.length} marks in order with the fish finder on`, obj: { kind: 'visit', marks: line.marks, sonar: true, r: 25 },
        where: line.marks[0], boat: 'any boat with a fish finder (imaging sonar pays a bonus)', difficulty: 1, minutes: 25, pay: 30, rep: 2,
      };
    },
  },
  temps: {
    cat: 'survey', giver: 'trust',
    make(W, r) {
      const marks = W.tempMarks;
      if (!marks?.length) return null;
      const night = W.summer && r() < 0.5;
      return {
        title: night ? 'A night survey: water temperatures' : 'Water temperatures at the marks', story: night ? 'Summer nights are when the top of the sea cools: the Trust wants readings taken after dark.' : 'The Trust keeps a record of the sea’s temperature through the year. Take readings at each mark with the fish finder on.',
        goal: `Reach each of ${marks.length} marks with the fish finder on${night ? ', after dark' : ''}`, obj: { kind: 'visit', marks, sonar: true, night, r: 25 },
        where: marks[0], difficulty: night ? 2 : 1, minutes: 30, pay: night ? 40 : 28, rep: 2,
      };
    },
  },
  // ---- deliveries ----
  wendbox: {
    cat: 'delivery', giver: 'mags',
    make(W) {
      if (W.storm || !W.places?.quay) return null;
      return {
        title: 'Ice for Wend Quay', story: 'The campers at Wend Quay have run out of ice. Mags has a box packed: take it up the estuary.',
        goal: 'Take the box of ice to Wend Quay', obj: { kind: 'deliver', to: 'quay', r: 25 }, cargo: 'a box of ice',
        where: W.places.quay, difficulty: 1, minutes: 15, pay: 15, rep: 1,
      };
    },
  },
  // A gale coming: the campers at Wend Quay want their spare tarpaulins before it arrives. Paid
  // well, and only worth anything if it gets there first (it lapses, harmlessly, if it doesn't).
  beforegale: {
    cat: 'delivery', giver: 'wenna',
    make(W) {
      if (!W.galeAt || !W.places?.quay || W.galeAt - W.abs < 1.5) return null;
      return {
        title: 'Before the gale', story: `There’s a gale due at ${W.galeWords}. The campers at Wend Quay need their spare tarpaulins and pegs before it comes: Wenna has them bagged on the quay.`,
        goal: 'Take the tarpaulins to Wend Quay before the gale arrives', obj: { kind: 'deliver', to: 'quay', r: 25, by: W.galeAt }, cargo: 'tarpaulins and pegs',
        where: W.places.quay, difficulty: 2, minutes: 15, pay: 30, rep: 2,
      };
    },
  },
  spares: {
    cat: 'delivery', giver: 'paco',
    make(W, r) {
      // (Only in fair weather, and only for someone with a boat that can make the crossing.)
      if (W.storm || W.forecastStorm || !W.places?.puerto || !W.canCross || !W.beenSouth) return null;
      if (r() < 0.4) return null;
      return {
        title: 'Spares for Puerto Brasa', story: 'Paco’s generator has thrown a part and the island’s chandlery has none. Bert has one: carry it across the ocean to the quay at Puerto Brasa, in fair weather.',
        goal: 'Take the generator part across to Puerto Brasa', obj: { kind: 'deliver', to: 'puerto', r: 40 }, cargo: 'a generator part',
        where: W.places.puerto, boat: 'a boat that can make the crossing (the yacht or the sailing boat)', difficulty: 3, minutes: 60, pay: 120, rep: 3,
      };
    },
  },
  // ---- charters: people (and freight) aboard; the jobs that want a bigger boat ----
  whalewatch: {
    cat: 'charter', giver: 'trips',
    make(W, r) {
      if (W.region !== 'home') return null;
      if (!W.whales?.length || W.storm) return null;
      const can = [3, 4, 6, 8].filter((n) => n <= W.rank.pax);
      if (!can.length) return null;
      const pax = pick(r, can), boat = boatFor(W, { pax }, `a boat with ${pax} seats`);
      if (!boat) return null;
      return {
        title: `Whale watching: ${pax} passengers`, story: `${pax} visitors have booked a trip to see the ${W.whales[0].name.toLowerCase()} reported ${W.whales[0].where}. Pick them up at Willowhaven, find it, and bring them home happy (rough water in an open boat and they won’t tip).`,
        goal: `Take ${pax} passengers out to see a whale surface, and back to Willowhaven`, obj: { kind: 'charter', pax, see: 'whale' },
        where: W.whales[0].at, boat, difficulty: 2, minutes: 45, pay: round5(25 + pax * 14), rep: 2, coop: true,
      };
    },
  },
  dolphintrip: {
    cat: 'charter', giver: 'trips',
    make(W, r) {
      if (W.region !== 'home') return null;
      if (!W.dolphins || W.storm) return null;
      const can = [2, 3, 5].filter((n) => n <= W.rank.pax);
      if (!can.length) return null;
      const pax = pick(r, can), boat = boatFor(W, { pax }, `something quick with ${pax} seats`);
      if (!boat) return null;
      return {
        title: `Dolphins for ${pax}`, story: `A family of ${pax} wants to see the dolphins on the bow. Pick them up at Willowhaven, get the dolphins riding your bow, and bring them home.`,
        goal: `Take ${pax} passengers out until dolphins ride your bow, and back to Willowhaven`, obj: { kind: 'charter', pax, see: 'dolphins' },
        boat, difficulty: 1, minutes: 30, pay: round5(20 + pax * 10), rep: 1, coop: true,
      };
    },
  },
  divecharter: {
    cat: 'charter', giver: 'divers',
    make(W, r) {
      if (W.region !== 'home') return null;
      if (W.storm || !W.diveSites?.length) return null;
      const can = [2, 4, 6].filter((n) => n <= W.rank.pax);
      if (!can.length) return null;
      const site = pick(r, W.diveSites), pax = pick(r, can), boat = boatFor(W, { pax, divers: true }, `a boat for ${pax} divers and their kit`);
      if (!boat) return null;
      return {
        title: `Divers to ${site.name}`, story: `The Sub-Aqua Club has ${pax} divers booked for ${site.name}${site.noAnchor ? ` (${site.noAnchor}: no anchoring, so hold her on the spot while they’re down)` : ''}. Take them out, stay with them while they dive, and bring them home.`,
        goal: `Take ${pax} divers to ${site.name}, stay on the site while they’re down, and back to Willowhaven`, obj: { kind: 'charter', pax, divers: true, dive: { x: site.x, z: site.z, r: 45, stay: 150, noAnchor: !!site.noAnchor } },
        where: site, boat, gear: site.noAnchor ? 'a GPS trolling motor (Spot-Lock), or a steady hand on the helm' : null, difficulty: site.noAnchor ? 3 : 2, minutes: 40, pay: round5(30 + pax * 15 + (site.noAnchor ? 25 : 0)), rep: 2,
      };
    },
  },
  fishcharter: {
    cat: 'charter', giver: 'club',
    make(W, r) {
      if (W.region !== 'home') return null;
      if (W.storm) return null;
      const can = [2, 3, 4].filter((n) => n <= W.rank.pax);
      if (!can.length) return null;
      const pax = pick(r, can), n = pax + 1, boat = boatFor(W, { pax }, `a boat with a deck for ${pax} anglers`);
      if (!boat) return null;
      return {
        title: `A fishing charter for ${pax}`, story: `${pax} club members want a day after the sea fish with someone who knows where they are. Take them out, put them on the fish (${n} between you), and bring them home.`,
        goal: `Take ${pax} anglers out, land ${n} sea fish with them aboard, and back to Willowhaven`, obj: { kind: 'charter', pax, fish: n },
        boat, difficulty: 2, minutes: 60, pay: round5(30 + pax * 18), rep: 2, coop: true,
      };
    },
  },
  freight: {
    cat: 'delivery', giver: 'bert',
    make(W, r) {
      if (W.region !== 'home') return null;
      if (W.storm || !W.places?.puffin) return null;
      const kg = pick(r, [250, 450, 700, 1200].filter((k) => k <= W.rank.kg)), boat = boatFor(W, { cargo: kg }, `a boat that carries ${kg} kg`);
      if (!boat) return null;
      return {
        title: `${kg} kg for Puffin Cove`, story: `The camp at Puffin Cove is rebuilding its jetty: ${kg} kg of timber and fixings are stacked on Willowhaven quay. Load them (it takes a boat that can carry it) and take them out.`,
        goal: `Load ${kg} kg at Willowhaven and deliver it to Puffin Cove`, obj: { kind: 'deliver', to: 'puffin', r: 40, cargo: kg }, cargo: `${kg} kg of timber`,
        where: W.places.puffin, boat, difficulty: kg > 600 ? 2 : 1, minutes: 35, pay: round5(20 + kg * 0.07), rep: 2,
      };
    },
  },
  // ---- boat handling ----
  berthing: {
    cat: 'handling', giver: 'wenna',
    make(W) {
      if (W.region !== 'home' || W.wind > 11 || W.storm) return null;
      return {
        title: 'Berthing, cleanly', story: 'Wenna is short of hands for the visitors’ pontoon and wants to see you can bring a boat alongside without touching anything before she asks you to help.',
        goal: 'Make fast at the visitors’ pontoon without a bump', obj: { kind: 'dock', pier: 'visitors', bumps: 0 },
        where: W.places?.visitors || null, difficulty: 1, minutes: 10, pay: 15, rep: 1,
      };
    },
  },
  marks: {
    cat: 'handling', giver: 'sailing',
    make(W, r) {
      if (W.region !== 'home' || W.wind > 13 || W.storm || !W.courses?.length) return null;
      const c = pick(r, W.courses), mins = c.minutes;
      return {
        title: `Round the marks: ${c.name}`, story: 'The Sailing Club sets a course every week for anyone who fancies it. Round every mark in order, inside the time.',
        goal: `Round ${c.marks.length} marks in order inside ${mins} minutes`, obj: { kind: 'visit', marks: c.marks, r: 18, limit: mins * 60 },
        where: c.marks[0], difficulty: 2, minutes: mins + 5, pay: 30, rep: 1,
      };
    },
  },
  undersail: {
    cat: 'handling', giver: 'sailing',
    make(W, r) {
      if (W.region !== 'home' || !W.ownsSail || W.wind < 3 || W.wind > 12 || W.storm || !W.courses?.length) return null;
      const c = pick(r, W.courses);
      return {
        title: `Under sail: ${c.name}`, story: 'The same course the Club sets each week, but sailed: the sail up and the outboard off, all the way round.',
        goal: `Round ${c.marks.length} marks in order under sail alone`, obj: { kind: 'visit', marks: c.marks, r: 18, sail: true },
        where: c.marks[0], boat: 'the sailing boat', difficulty: 2, minutes: 30, pay: 40, rep: 2,
      };
    },
  },
};
export const TEMPLATE_IDS = Object.keys(TEMPLATES);

function an(name) {
  const w = name.toLowerCase();
  return `${/^[aeiou]/.test(w) ? 'an' : 'a'} ${w}`;
}

/* ---------------- the record ---------------- */

export const newContracts = () => ({ board: null, active: [], done: {}, rep: {}, earned: 0, count: 0 });
export function cleanContracts(raw) {
  const C = newContracts();
  if (!raw || typeof raw !== 'object') return C;
  if (raw.board && Number.isFinite(raw.board.day) && Array.isArray(raw.board.offers)) C.board = { day: raw.board.day, region: raw.board.region || 'home', offers: raw.board.offers.filter(okOffer).slice(0, 8) };
  if (Array.isArray(raw.active)) C.active = raw.active.filter((a) => okOffer(a) && a.progress && typeof a.progress === 'object').slice(0, CONTRACT_MAX);
  if (raw.done && typeof raw.done === 'object') for (const [k, v] of Object.entries(raw.done)) if (Number.isFinite(v)) C.done[k] = v;
  if (raw.rep && typeof raw.rep === 'object') for (const [k, v] of Object.entries(raw.rep)) if (k in GIVERS && Number.isFinite(v)) C.rep[k] = Math.max(0, Math.round(v));
  C.earned = Number.isFinite(raw.earned) ? Math.max(0, raw.earned) : 0;
  C.count = Number.isFinite(raw.count) ? Math.max(0, Math.round(raw.count)) : 0;
  return C;
}
function okOffer(o) {
  return !!o && typeof o === 'object' && typeof o.id === 'string' && o.tpl in TEMPLATES && o.obj && typeof o.obj === 'object' && Number.isFinite(o.pay);
}

/* ---------------- the board ---------------- */

// Today's offers (made once a day, and again in another region): from the world W:
// { day, region ('home' | 'south'), busy: [{ id, name, where, at, min, max, sea }], dolphins, whales:
//   [{ kind, name, where, at }], birds, storm, forecastStorm, wind (m/s), summer, canCross, ownsSail,
//   places: { quay, puerto, stream, visitors, … }, surveyLines: [{ name, marks }], tempMarks: [...],
//   courses: [{ name, marks, minutes }] }.
export function offers(C, W) {
  if (C.board && C.board.day === W.day && C.board.region === W.region) return C.board.offers;
  const r = seeded(W.day * 7 + (W.region === 'south' ? 3 : 0));
  // (Shuffled with the day's own die: the same order all day.)
  const ids = TEMPLATE_IDS.slice();
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const out = [];
  W = { ...W, rank: career(C).rank };
  for (const tpl of ids) {
    if (out.length >= 6) break;
    const T = TEMPLATES[tpl], o = T.make(W, r);
    if (!o) continue;
    const id = `${W.day}-${W.region}-${tpl}`;
    if (id in C.done || C.active.some((a) => a.id === id)) continue;
    out.push({ id, tpl, cat: T.cat, giver: T.giver, coop: false, boat: null, gear: null, where: null, ...o });
  }
  C.board = { day: W.day, region: W.region, offers: out };
  return out;
}

// Take a job: onto the active list (three at most), off the board. Returns the contract, or why not.
export function accept(C, id, now = 0) {
  const o = C.board?.offers.find((x) => x.id === id);
  if (!o) return { why: 'That job’s gone.' };
  if (C.active.length >= CONTRACT_MAX) return { why: `You have ${CONTRACT_MAX} jobs on already: finish or give one up first.` };
  if (id in C.done) return { why: 'You’ve done that one.' };
  const a = { ...o, progress: startOf(o.obj, now), accepted: now, ready: false };
  C.active.push(a);
  C.board.offers = C.board.offers.filter((x) => x.id !== id);
  return { contract: a };
}

// Give a job up: off the list, nothing paid and nothing lost. Returns it (so the game can tidy up
// anything it put in the world for it), or null.
export function abandon(C, id) {
  const i = C.active.findIndex((a) => a.id === id);
  if (i < 0) return null;
  return C.active.splice(i, 1)[0];
}

// Paid: once, and only for a finished job. Returns { pay, rep, contract } or null (not finished,
// not taken, or paid already). bonus: what earns more (see payFor).
export function claim(C, id, day = 0, bonus = {}) {
  if (id in C.done) return null;
  const i = C.active.findIndex((a) => a.id === id);
  if (i < 0 || !C.active[i].ready) return null;
  const a = C.active.splice(i, 1)[0];
  const pay = payFor(a, bonus);
  C.done[a.id] = day;
  C.earned += pay;
  C.count++;
  C.rep[a.giver] = (C.rep[a.giver] || 0) + (a.rep || 0);
  return { pay, rep: a.rep || 0, contract: a };
}
// (The record of finished jobs kept to a sensible size: ids older than a fortnight go. Board ids
// carry their day, so an old one can never come round again anyway.)
export function prune(C, day) {
  for (const [k, v] of Object.entries(C.done)) if (day - v > 14) delete C.done[k];
}

/* ---------------- progress ---------------- */

function startOf(obj, now) {
  if (obj.kind === 'catch') return { got: 0, species: [] };
  if (obj.kind === 'visit') return { next: 0, started: null, now };
  if (obj.kind === 'dock') return { bumps: 0 };
  if (obj.kind === 'charter') return { aboard: false, boat: null, seen: false, told: false, stay: 0, rough: 0, caught: 0, said: false, warned: false };
  if (obj.kind === 'deliver' && obj.cargo) return { loaded: false, boat: null, said: false };
  return {};
}

// A fish landed (phase 'landed'), or let go off the catch card (phase 'released', with photo: a
// picture taken of it there). c: { sp, size, method ('float' | 'lure' | 'fly' | …), sea, phase,
// photo }. A job wanting a fish let go counts only its release; every other, only its landing (so
// no fish counts twice). Returns the contracts it finished.
export function caught(C, c) {
  const out = [];
  const released = c.phase === 'released';
  for (const a of C.active) {
    const o = a.obj;
    // (A fishing charter: their fish, landed with them aboard.)
    if (!a.ready && o.kind === 'charter' && o.fish && a.progress.aboard && !released && c.sea !== false && c.boat === a.progress.boat) {
      a.progress.caught++;
      if (a.progress.caught >= o.fish) a.progress.seen = true;
      continue;
    }
    if (a.ready || o.kind !== 'catch') continue;
    if (!!o.released !== released) continue;
    if (o.sea && !c.sea) continue;
    if (o.distinct) {
      if (!a.progress.species.includes(c.sp)) a.progress.species.push(c.sp);
      if (a.progress.species.length >= o.distinct) out.push(finish(a));
      continue;
    }
    if (o.sp && o.sp !== c.sp) continue;
    if (o.min && c.size < o.min) continue;
    if (o.method && c.method !== o.method) continue;
    if (o.photo && !c.photo) continue;
    a.progress.got++;
    if (a.progress.got >= (o.count || 1)) out.push(finish(a));
  }
  return out;
}

// A photograph kept. s: { life: [kinds of sea life in it], bow: a pod on your bow in it, species }.
export function photographed(C, s) {
  const out = [];
  for (const a of C.active) {
    const o = a.obj;
    if (a.ready || o.kind !== 'photo') continue;
    if (o.life && !o.life.some((k) => (s.life || []).includes(k))) continue;
    if (o.bow && !s.bow) continue;
    out.push(finish(a));
  }
  return out;
}

// Each second or so, out there. x: { x, z, now (s), abs (the game's hour, for a job with a deadline), night, sonar (finder on), sailing (sail up,
// engine off), whale (metres to a whale surfacing just now, or null), frenzy (metres to birds working
// a shoal, or null), at (a place id you're at, stopped: for deliveries), tied (the pier you're made
// fast to, or null), bumps (bumps since the last call) }. Returns the contracts it finished, any it
// put back to the start (a course failed: reset), and any that lapsed (too late: missed, struck off
// with nothing lost but the job).
export function tick(C, x) {
  const out = [], reset = [], missed = [], boarded = [], said = [], seen = [];
  for (const a of [...C.active]) {
    const o = a.obj, P = a.progress;
    if (a.ready) continue;
    if (o.by != null && x.abs != null && x.abs > o.by) {
      C.active.splice(C.active.indexOf(a), 1);
      missed.push(a);
      continue;
    }
    if (o.kind === 'visit') {
      // (A time limit starts at the first mark.)
      if (o.limit && P.started != null && x.now - P.started > o.limit) {
        P.next = 0;
        P.started = null;
        reset.push(a);
        continue;
      }
      if (o.sail && !x.sailing) continue;
      if (o.sonar && !x.sonar) continue;
      if (o.night && !x.night) continue;
      const m = o.marks[P.next];
      if (m && Math.hypot(x.x - m.x, x.z - m.z) <= (o.r || 20)) {
        if (P.next === 0) P.started = x.now;
        P.next++;
        if (P.next >= o.marks.length) out.push(finish(a));
      }
    } else if (o.kind === 'observe') {
      const d = o.what === 'whale' ? x.whale : x.frenzy;
      if (d != null && d <= o.r) out.push(finish(a));
    } else if (o.kind === 'deliver') {
      // (Freight: loaded at Willowhaven first, in a boat that can carry it; then there.)
      if (o.cargo && !P.loaded) {
        if (x.home && x.boat) {
          const why = fits(x.boat, { cargo: o.cargo });
          if (!why) {
            P.loaded = true;
            P.boat = x.boat;
            boarded.push(a);
          } else if (!P.said) {
            P.said = true;
            said.push({ a, text: `${a.title}: it won’t go in her, ${why}.` });
          }
        } else if (!x.home) P.said = false;
        continue;
      }
      if (x.at === o.to && (!o.cargo || x.boat === P.boat)) out.push(finish(a, true));
    } else if (o.kind === 'charter') {
      // Aboard at Willowhaven (if she has the room), out to whatever they came for, and home.
      // (Before the trip's begun they'll move to another boat at Willowhaven, if she has the room.)
      const need = { pax: o.pax, divers: o.divers };
      if (x.home && x.boat && x.boat !== P.boat && !P.seen && !fits(x.boat, need)) {
        P.aboard = true;
        P.boat = x.boat;
        boarded.push(a);
        continue;
      }
      if (!P.aboard) {
        if (x.home && x.boat) {
          const why = fits(x.boat, need);
          if (!P.said) {
            P.said = true;
            said.push({ a, text: `${a.title}: they can’t all come in her, ${why}.` });
          }
        } else if (!x.home) P.said = false;
        continue;
      }
      if (x.boat !== P.boat) continue;
      if (x.sea != null && misery(P.boat, x.sea) > 0.5) P.rough += x.dt || 0.5;
      if (!P.seen) {
        if (o.see === 'whale' && x.whale != null && x.whale <= 250) P.seen = true;
        if (o.see === 'dolphins' && x.bow) P.seen = true;
        if (o.dive && Math.hypot(x.x - o.dive.x, x.z - o.dive.z) <= o.dive.r && (x.speed ?? 0) < 0.5) {
          // (On a reef where anchoring's banned, an anchor down doesn't count, and they say so.)
          if (o.dive.noAnchor && x.anchored) {
            if (!P.warned) {
              P.warned = true;
              said.push({ a, text: `${a.title}: no anchoring here, it tears up the reef. Up anchor and hold her on the spot (Spot-Lock, or by hand).` });
            }
          } else {
            P.stay += x.dt || 0.5;
            if (P.stay >= o.dive.stay) P.seen = true;
          }
        }
      }
      if (P.seen && !P.told) {
        P.told = true;
        seen.push(a);
      } else if (P.seen && x.home) out.push(finish(a));
    } else if (o.kind === 'dock') {
      P.bumps += x.bumps || 0;
      if (P.bumps > (o.bumps ?? 0)) {
        P.bumps = 0;
        if (!x.tied) reset.push(a);
      }
      if (x.tied === o.pier && P.bumps <= (o.bumps ?? 0)) out.push(finish(a));
    }
  }
  return { done: out, reset, missed, boarded, said, seen };
}

function finish(a, onSpot = false) {
  a.ready = true;
  a.onSpot = onSpot;
  return a;
}

/* ---------------- words and marks ---------------- */

// Where a job wants you next (for the map and a marker): { x, z, name } or null.
export function target(a) {
  if (a.ready) return a.onSpot ? null : { board: true };
  const o = a.obj;
  if (o.kind === 'visit') {
    const m = o.marks[a.progress.next];
    return m ? { x: m.x, z: m.z, name: `${a.title}: mark ${a.progress.next + 1} of ${o.marks.length}` } : null;
  }
  if (o.kind === 'charter') {
    if (!a.progress.aboard || a.progress.seen) return { home: true, name: a.progress.aboard ? `${a.title}: home to Willowhaven` : `${a.title}: pick them up at Willowhaven` };
    if (o.dive) return { x: o.dive.x, z: o.dive.z, name: a.where?.name || a.title };
  }
  if (o.kind === 'deliver' && o.cargo && !a.progress.loaded) return { home: true, name: `${a.title}: load at Willowhaven` };
  return a.where ? { x: a.where.x, z: a.where.z, name: a.where.name || a.title } : null;
}

// Where it stands, in a line, for the journal.
export function standing(a) {
  if (a.ready) return a.onSpot ? 'Done and paid.' : 'Done: back to the notice board at Willowhaven to be paid.';
  const o = a.obj, P = a.progress;
  if (o.kind === 'catch' && o.distinct) return `${P.species.length} of ${o.distinct} kinds so far.`;
  if (o.kind === 'catch' && (o.count || 1) > 1) return `${P.got} of ${o.count} so far.`;
  if (o.kind === 'visit') return `Mark ${Math.min(P.next + 1, o.marks.length)} of ${o.marks.length}${o.limit && P.started != null ? ' (the clock’s running)' : ''}.`;
  if (o.kind === 'charter') {
    if (!P.aboard) return `They’re waiting at Willowhaven: bring a boat with room for ${o.pax}${o.divers ? ' divers' : ''}.`;
    if (!P.seen) return o.dive ? `Divers down: ${Math.floor(P.stay)} of ${o.dive.stay} s on the site.` : o.fish ? `${P.caught} of ${o.fish} fish so far.` : o.see === 'whale' ? 'Find them a whale.' : 'Find them dolphins to ride your bow.';
    return `Bring them home to Willowhaven${P.rough > 60 ? ' (a rough trip: no tip)' : ''}.`;
  }
  if (o.kind === 'deliver' && o.cargo && !P.loaded) return `${o.cargo} kg waiting on Willowhaven quay: bring a boat that can carry it.`;
  return a.goal;
}

// The pay as it stands, with any bonus (imaging sonar on a survey).
export function payFor(a, { imaging = false } = {}) {
  if (a.cat === 'survey' && imaging) return Math.round(a.pay * 1.5);
  // (A charter's passengers tip for a good trip; a rough one in an open boat, they don't.)
  if (a.obj.kind === 'charter' && a.progress?.rough > 60) return Math.round(a.pay * 0.7);
  return a.pay;
}

// What the people and freight of your jobs weigh, aboard boat `kind` (kg): real weight in her.
export function aboardKg(C, kind) {
  let kg = 0;
  for (const a of C.active) {
    const o = a.obj, P = a.progress;
    // (Once it's done they've stepped ashore, and the freight's been unloaded.)
    if (a.ready || P.boat !== kind) continue;
    if (o.kind === 'charter' && P.aboard) kg += o.pax * KG_PER_PERSON;
    if (o.kind === 'deliver' && o.cargo && P.loaded) kg += o.cargo;
  }
  return kg;
}
