import { RODS, TACKLE, PACK, SETUPS, KIND_NAMES, fits, checkSetup, lineOf, termOf } from './tackle.js';
import { fishById } from './fish.js';
import { setupsFor } from './guide.js';
import { CAR_PARKS, CALF } from './world/terrain.js';

// Going out: home, the garage and the car. Where every piece of your outing gear is, kept in one
// place (state.equip) so nothing can be in two places at once or quietly vanish:
//
//  - Rods and tackle: what you carry is your backpack (state.gear.pack, as ever: two rods and
//    eight baits or lures). The car's boot can carry more: a rod tube and a tackle bag
//    (state.equip.car). Everything else is stored: on the tackle wall in the garage, and (as it
//    always has been) at the tackle boxes round the coast and in the boats' lockers. A rod or
//    bait in the car is in the car, not on the wall as well.
//  - Camping gear: the tent (with its bedroll, lantern, chair and the camp's bits), the stove and
//    the cool box, each in one place: at home, in the car, in your backpack, or at your camp.
//
// The rest of this file plans outings: where you can drive, what's there, a packing list, saved
// loadouts, and the short check before you leave. Everything here is plain data and rules (the
// game, the workbench and the tests share them).

export const KIT = {
  tent: { name: 'Tent & bedroll', short: 'tent', note: 'The tent and bedroll, with the lantern, the camp chair and the camp’s bits and pieces. You need it to pitch a camp.' },
  stove: { name: 'Stove & pans', short: 'stove', note: 'A little gas stove, a pan and a kettle: for cooking at camp.' },
  coolbox: { name: 'Cool box', short: 'cool box', note: 'Keeps six fish on ice at camp.' },
};
export const KIT_IDS = Object.keys(KIT);
// The boot: a rod tube and a tackle bag beside the camping gear (which always fits).
export const CAR_HOLD = { rods: 4, items: 12 };
export const LOADOUT_MAX = 6;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, lo = -Infinity, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const listWords = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/* ---------------- where you can go by car ---------------- */

// Each destination: where the car parks (terrain.js), the water you fish (for what lives there),
// how you get there, and what's there. drive: the lanes reach it (you can drive yourself);
// otherwise it's by road, a short travel transition. mins: how long the drive takes in game time.
// boat: no road goes there at all: you drive to its launch (a harbour) and go on by boat.
export const DESTS = {
  haven: {
    id: 'haven', place: 'haven', name: 'Willowhaven', kind: 'A harbour', drive: true, mins: 6, water: 'salt',
    at: { x: 10, z: -84, r: 130 },
    terrain: 'A cobbled apron behind a stone quay, a slipway and a few cottages up the slope. Level walking from the car park.',
    access: 'Park at the top of the harbour; the quay, the slipway, the chandlery and the notice board are a minute’s walk.',
    boats: 'At the head of the quay you can have any of your boats brought round and made fast.',
    camp: 'No camping in the village itself: there’s open grass along the shore east of it.',
    explore: 'The notice board (what’s about today, and notices), the chandlery with all your tackle, and the bench under the lamp.',
  },
  strand: {
    id: 'strand', place: 'strand', name: 'Shell Strand', kind: 'A sandy beach', drive: true, mins: 4, water: 'salt',
    at: { x: 100, z: 45, r: 95 },
    terrain: 'A sandy beach facing the sea, with a dry shelf of sand above it and a driftwood shelter. A short walk down from the car park.',
    access: 'The lane ends at a car park at the top of the beach.',
    boats: 'No moorings here: bring a boat round by sea, or have one brought to Willowhaven’s quay.',
    camp: 'The shelf above the beach is the driest ground on the coast for a tent.',
    explore: 'The driftwood shelter, the surf, and the Kittiwake’s buoy offshore.',
  },
  head: {
    id: 'head', place: 'head', name: 'Cove Head', kind: 'A rocky headland', drive: true, mins: 7, water: 'salt',
    at: { x: 178, z: 8, r: 85 },
    terrain: 'A rocky knoll with a white daymark, ledges stepping down into the surf. Rough ground at the end: watch your step.',
    access: 'The lane ends at a car park above the cove; the path goes on round to the headland on foot.',
    boats: 'No moorings: the cove channel is calm water for a boat that comes round by sea.',
    camp: 'Grass along the cove path; the headland itself is rock.',
    explore: 'The daymark (with a view of the Kittiwake’s buoy), the cove channel, and an old punt at the head of the cove.',
  },
  quay: {
    id: 'quay', place: 'quay', name: 'Wend Quay', kind: 'An estuary quay', drive: false, mins: 35, water: 'brackish',
    at: { x: 540, z: -150, r: 150 },
    terrain: 'Old stones where the estuary narrows, reeds and mudflats either side.',
    access: 'By road round the bay: you park by the quay and its little camp.',
    boats: 'A mooring ring on the quay; your boats stay where you left them.',
    camp: 'A fixed camp with a tent and a tackle box, and room for your own.',
    explore: 'The Saltings’ reedy channels, and the trail inland to Longmere.',
  },
  boathouse: {
    id: 'boathouse', place: 'boathouse', name: 'Mere Boathouse', kind: 'A lake boathouse', drive: false, mins: 45, water: 'fresh',
    at: { x: 380, z: -440, r: 170 },
    terrain: 'A tarred boathouse and jetty on the south-east shore of Longmere, a big lake among the hills.',
    access: 'By road over the hill: you park beside the boathouse.',
    boats: 'The bass boat lives at the jetty (with a tackle locker).',
    camp: 'The boathouse has a bunk and a tackle box; grass along the shore for a tent.',
    explore: 'Heron Holm, the drowned oaks under the north shore, and the weedy bays.',
  },
  calf: {
    id: 'calf', place: 'calf', name: 'The Calf', kind: 'A small island', boat: true, launch: 'haven', mins: 6, water: 'salt',
    at: { x: CALF.x, z: CALF.z - 8, r: 70 },
    terrain: 'A green hump of an island off Heron Point: cliffs to the west, a ruined watch tower on the top, sea pinks in the short turf, and low rocks at its south-east corner (the Nose) looking straight into the race. Steps go up from a stone landing in its lee.',
    access: 'By boat only, from Willowhaven quay: out of the bay and west along the coast to the island just off Heron Point. Tie up at the landing on the Calf’s east side, out of the tide.',
    boats: 'Any of your sea boats will do. The race in Calf Sound sets a boat east as it drifts through: the rowing boat and the kayak feel it most. Make fast at the landing, or anchor in the lee, where the cabin boat makes a floating camp.',
    camp: 'Room for a tent on the top beside the tower, the most exposed pitch on the coast (the tent has to be in your backpack: the car stays at Willowhaven), or sleep aboard the cabin boat in the lee.',
    explore: 'The watch tower, grey seals hauled out on the skerry, and the race itself: Calf Sound, where the tide stands up in white ridges.',
  },
};
export const DEST_IDS = Object.keys(DESTS);
// The places a car goes (the rest are by boat from one of them).
export const DRIVE_IDS = DEST_IDS.filter((id) => !DESTS[id].boat);
// Where the car takes you for a place: its own car park, or the harbour you go on from by boat.
export const launchOf = (id) => DESTS[id]?.launch || id;
export const parkOf = (id) => CAR_PARKS[launchOf(id)] || null;
export const HOME_NAME = 'Home';

// How long the drive takes (game minutes), from home or between destinations: lanes are quick,
// the road round to the far ones longer.
export function driveMinutes(from, to) {
  from = launchOf(from);
  to = launchOf(to);
  if (from === to) return 0;
  const m = (id) => (id === 'home' || !DESTS[id] ? 0 : DESTS[id].mins);
  if (from === 'home' || !DESTS[from]) return m(to);
  if (to === 'home' || !DESTS[to]) return m(from);
  return DESTS[from].drive && DESTS[to].drive ? Math.max(4, Math.abs(m(from) - m(to)) + 3) : m(from) + m(to);
}

// The nearest car park to a point (within reach), or null.
export function parkNear(x, z, reach = 12) {
  let best = null, bd = reach;
  for (const [id, c] of Object.entries(CAR_PARKS)) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

/* ---------------- the equipment record ---------------- */

export function defaultEquip(where = 'home') {
  return { kit: Object.fromEntries(KIT_IDS.map((k) => [k, where])), car: { rods: [], items: [] } };
}

const LOC = /^(home|car|pack|camp:[a-z0-9-]{3,40})$/;

// A saved record made safe, and made to agree with the rest of the save: a camp always has its
// tent; gear at a camp that no longer exists comes home; the car never holds what the backpack
// does; nothing is lost.
export function cleanEquip(raw, s) {
  const out = defaultEquip(s.camps?.length ? `camp:${s.camps[0].id}` : 'home');
  if (isObj(raw)) {
    if (isObj(raw.kit)) for (const k of KIT_IDS) if (typeof raw.kit[k] === 'string' && LOC.test(raw.kit[k])) out.kit[k] = raw.kit[k];
    if (isObj(raw.car)) {
      out.car.rods = [...new Set((Array.isArray(raw.car.rods) ? raw.car.rods : []).filter((r) => RODS[r]))].slice(0, CAR_HOLD.rods);
      out.car.items = [...new Set((Array.isArray(raw.car.items) ? raw.car.items : []).filter((i) => TACKLE[i]))].slice(0, CAR_HOLD.items);
    }
  }
  reconcile({ ...s, equip: out });
  return out;
}

export function reconcile(s) {
  const e = s.equip, camps = s.camps || [];
  for (const k of KIT_IDS) {
    const at = e.kit[k];
    if (at.startsWith('camp:') && !camps.some((c) => `camp:${c.id}` === at)) e.kit[k] = 'home';
  }
  // A pitched camp has its tent (the camp can't stand without it).
  if (camps[0] && e.kit.tent !== `camp:${camps[0].id}`) e.kit.tent = `camp:${camps[0].id}`;
  if (!camps.length && e.kit.tent.startsWith('camp:')) e.kit.tent = 'home';
  const pack = s.gear?.pack;
  if (pack) {
    e.car.rods = e.car.rods.filter((r) => !pack.rods.includes(r));
    e.car.items = e.car.items.filter((i) => !pack.items.includes(i));
  }
  return e;
}

export const kitAt = (s, k) => s.equip.kit[k];
export const campOfKit = (s, k) => (s.equip.kit[k].startsWith('camp:') ? (s.camps || []).find((c) => `camp:${c.id}` === s.equip.kit[k]) || null : null);
export const campHas = (s, camp, k) => s.equip?.kit[k] === `camp:${camp.id}`;

// Where something is, in a word, and where exactly: 'carried', 'loaded' (in the car), 'stored'
// (at home, or the tackle boxes), 'pitched' (at your camp).
export function statusOf(s, type, id) {
  if (type === 'kit') {
    const at = s.equip.kit[id];
    if (at === 'pack') return { state: 'carried', words: 'In your backpack' };
    if (at === 'car') return { state: 'loaded', words: 'In the car' };
    if (at === 'home') return { state: 'stored', words: 'In the garage' };
    const c = campOfKit(s, id);
    return { state: 'pitched', words: c ? `At ${c.name}` : 'At your camp' };
  }
  const list = type === 'rod' ? 'rods' : 'items';
  if (s.gear.pack[list].includes(id)) return { state: 'carried', words: 'In your backpack' };
  if (s.equip.car[list].includes(id)) return { state: 'loaded', words: 'In the car' };
  return { state: 'stored', words: 'In the garage (and the tackle boxes)' };
}

// What a tackle box holds for you: the store (everything not carried and not in the car), or the
// car's boot (what's loaded in it).
export function boxHas(s, box, type, id) {
  const list = type === 'rod' ? 'rods' : 'items';
  if (s.gear.pack[list].includes(id)) return false;
  return box === 'car' ? s.equip.car[list].includes(id) : !s.equip.car[list].includes(id);
}

// Moving camping gear between home, the car and your backpack (your camp's own sheet moves it on
// and off a camp). Never duplicates, never drops: a refusal says why.
export function moveKit(s, k, to, { campId = null } = {}) {
  if (!KIT[k]) return { ok: false, why: 'Nothing like that.' };
  const from = s.equip.kit[k];
  const dest = to === 'camp' ? `camp:${campId}` : to;
  if (!LOC.test(dest)) return { ok: false, why: 'Nowhere to put it.' };
  if (from === dest) return { ok: true, same: true };
  if (k === 'tent' && from.startsWith('camp:')) return { ok: false, why: 'The tent is pitched: pack the camp up to take it.' };
  if (to === 'camp' && !(s.camps || []).some((c) => c.id === campId)) return { ok: false, why: 'That camp isn’t there.' };
  if (k === 'coolbox' && from.startsWith('camp:')) {
    const c = campOfKit(s, k);
    if (c && (c.store.fish.length || c.store.meals.length)) return { ok: false, why: 'Empty the cool box into your creel first.' };
  }
  if (k === 'stove' && from.startsWith('camp:') && campOfKit(s, k)?.cooking) return { ok: false, why: 'Something is still cooking on it.' };
  s.equip.kit[k] = dest;
  return { ok: true, from, to: dest };
}

// Rods and tackle in and out of the boot. toCar: from the backpack or the store into the car;
// otherwise out of the car into the store (the garage).
export function moveToCar(s, type, id, toCar) {
  const list = type === 'rod' ? 'rods' : 'items', car = s.equip.car[list], pack = s.gear.pack[list];
  const name = type === 'rod' ? RODS[id]?.short.toLowerCase() : TACKLE[id]?.name;
  if (!name) return { ok: false, why: 'Nothing like that.' };
  if (toCar) {
    if (car.includes(id)) return { ok: true, same: true };
    if (car.length >= CAR_HOLD[list]) return { ok: false, why: `The boot holds ${CAR_HOLD[list]} ${type === 'rod' ? 'rods (in the rod tube)' : 'boxes of tackle (in the tackle bag)'}: take one out first.` };
    if (pack.includes(id)) {
      if (type === 'rod' && pack.length <= 1) return { ok: false, why: 'You always carry one rod: pack another first.' };
      pack.splice(pack.indexOf(id), 1);
      if (type === 'rod' && s.gear.rod === id) s.gear.rod = pack[0];
    }
    car.push(id);
    return { ok: true, words: `Loaded the ${name} into the car` };
  }
  if (!car.includes(id)) return { ok: true, same: true };
  car.splice(car.indexOf(id), 1);
  return { ok: true, words: `Took the ${name} back to the garage` };
}

// Everything out of the car and back in the garage (the tackle on the wall, the camping gear on
// its shelf). Returns what was moved.
export function unloadCar(s) {
  const out = { rods: s.equip.car.rods.length, items: s.equip.car.items.length, kit: [] };
  s.equip.car.rods = [];
  s.equip.car.items = [];
  for (const k of KIT_IDS) if (s.equip.kit[k] === 'car') { s.equip.kit[k] = 'home'; out.kit.push(k); }
  return out;
}

// Camping gear in your backpack, back on the garage shelf.
export function unpackKit(s) {
  const out = [];
  for (const k of KIT_IDS) if (s.equip.kit[k] === 'pack') { s.equip.kit[k] = 'home'; out.push(k); }
  return out;
}

// Pack a setup (ready-made, saved or one of yours) into the backpack, from the store and the car
// together: what's in the car comes out of it; the backpack's own goes to the store. Like the
// tackle box's "Pack this setup", which this mirrors.
export function packSetup(s, setup) {
  const g = s.gear;
  for (const r of setup.rods) if (s.equip.car.rods.includes(r)) s.equip.car.rods.splice(s.equip.car.rods.indexOf(r), 1);
  for (const i of setup.items) if (s.equip.car.items.includes(i)) s.equip.car.items.splice(s.equip.car.items.indexOf(i), 1);
  g.pack.rods = [...new Set(setup.rods)].slice(0, PACK.rods);
  g.pack.items = [...new Set(setup.items)].slice(0, PACK.items);
  g.rod = g.pack.rods.includes(setup.rod) ? setup.rod : g.pack.rods[0];
  for (const r of g.pack.rods) {
    if (setup.line?.[r]) g.line[r] = setup.line[r];
    if (setup.term?.[r]) g.term[r] = setup.term[r];
    const want = setup.rig?.[r];
    if (want && g.pack.items.includes(want) && fits(RODS[r], TACKLE[want])) g.rig[r] = want;
    else if (!g.pack.items.includes(g.rig[r])) {
      const first = g.pack.items.find((i) => fits(RODS[r], TACKLE[i]));
      if (first) g.rig[r] = first;
    }
  }
  return { ok: true, words: `Packed ${setup.name}` };
}

// Load a setup into the car as spare tackle (anything already in your backpack stays there).
export function loadSetup(s, setup) {
  const loaded = [], full = [];
  for (const r of setup.rods) {
    if (s.gear.pack.rods.includes(r) || s.equip.car.rods.includes(r)) continue;
    if (s.equip.car.rods.length >= CAR_HOLD.rods) full.push(RODS[r].short.toLowerCase());
    else { s.equip.car.rods.push(r); loaded.push(RODS[r].short.toLowerCase()); }
  }
  for (const i of setup.items) {
    if (s.gear.pack.items.includes(i) || s.equip.car.items.includes(i)) continue;
    if (s.equip.car.items.length >= CAR_HOLD.items) full.push(TACKLE[i].short.toLowerCase());
    else { s.equip.car.items.push(i); loaded.push(TACKLE[i].short.toLowerCase()); }
  }
  return { ok: !full.length, loaded, full, words: full.length ? `The boot is full: ${listWords(full)} stayed in the garage.` : `Loaded ${setup.name} into the car.` };
}

/* ---------------- loadouts: saved packing lists ---------------- */

// A loadout names things; it never holds them. Applying one moves what it can, and says what it
// couldn't (a tent still pitched at a camp, a car that's somewhere else).
export function snapshot(s, name = 'Last time') {
  const g = s.gear, lo = {
    name: String(name).slice(0, 30),
    pack: { rods: [...g.pack.rods], items: [...g.pack.items], rod: g.rod, rig: {}, line: {}, term: {} },
    car: { rods: [...s.equip.car.rods], items: [...s.equip.car.items] },
    kit: {},
  };
  for (const r of g.pack.rods) {
    lo.pack.rig[r] = g.rig[r];
    lo.pack.line[r] = lineOf(g, RODS[r]).id;
    lo.pack.term[r] = termOf(g, RODS[r]).id;
  }
  for (const k of KIT_IDS) {
    const at = s.equip.kit[k];
    lo.kit[k] = at === 'pack' || at === 'car' ? at : 'home';
  }
  return lo;
}

export function cleanLoadout(lo) {
  if (!isObj(lo) || !isObj(lo.pack)) return null;
  const rods = [...new Set((Array.isArray(lo.pack.rods) ? lo.pack.rods : []).filter((r) => RODS[r]))].slice(0, PACK.rods);
  if (!rods.length) return null;
  const out = {
    name: typeof lo.name === 'string' ? lo.name.replace(/[\u0000-\u001f<>]/g, '').slice(0, 30) || 'A loadout' : 'A loadout',
    pack: { rods, items: [...new Set((Array.isArray(lo.pack.items) ? lo.pack.items : []).filter((i) => TACKLE[i]))].slice(0, PACK.items), rod: rods.includes(lo.pack.rod) ? lo.pack.rod : rods[0], rig: {}, line: {}, term: {} },
    car: { rods: [], items: [] },
    kit: {},
  };
  for (const r of rods) {
    if (TACKLE[lo.pack.rig?.[r]]) out.pack.rig[r] = lo.pack.rig[r];
    if (RODS[r].lines.some((l) => l.id === lo.pack.line?.[r])) out.pack.line[r] = lo.pack.line[r];
    if (RODS[r].terms.includes(lo.pack.term?.[r])) out.pack.term[r] = lo.pack.term[r];
  }
  if (isObj(lo.car)) {
    out.car.rods = [...new Set((Array.isArray(lo.car.rods) ? lo.car.rods : []).filter((r) => RODS[r] && !rods.includes(r)))].slice(0, CAR_HOLD.rods);
    out.car.items = [...new Set((Array.isArray(lo.car.items) ? lo.car.items : []).filter((i) => TACKLE[i] && !out.pack.items.includes(i)))].slice(0, CAR_HOLD.items);
  }
  for (const k of KIT_IDS) out.kit[k] = ['pack', 'car', 'home'].includes(lo.kit?.[k]) ? lo.kit[k] : 'home';
  return out;
}

// carHome: whether the car is here to load. Returns { notes } (what couldn't be done, and why).
export function applyLoadout(s, lo, { carHome = true } = {}) {
  const notes = [];
  packSetup(s, { name: lo.name, ...lo.pack });
  if (carHome) {
    // The car's tackle as the loadout had it (what's now in the backpack stays there).
    s.equip.car.rods = lo.car.rods.filter((r) => !s.gear.pack.rods.includes(r)).slice(0, CAR_HOLD.rods);
    s.equip.car.items = lo.car.items.filter((i) => !s.gear.pack.items.includes(i)).slice(0, CAR_HOLD.items);
  } else if (lo.car.rods.length || lo.car.items.length) notes.push('The car isn’t here, so its share of the tackle waits.');
  for (const k of KIT_IDS) {
    const want = lo.kit[k], at = s.equip.kit[k];
    if (at === want) continue;
    if (at.startsWith('camp:')) {
      notes.push(`The ${KIT[k].short} is at ${campOfKit(s, k)?.name || 'your camp'}, so it stays there.`);
      continue;
    }
    if (want === 'car' && !carHome) {
      notes.push(`The ${KIT[k].short} can’t go in the car: the car isn’t here.`);
      continue;
    }
    if (at === 'car' && !carHome) {
      notes.push(`The ${KIT[k].short} is in the car, which isn’t here.`);
      continue;
    }
    s.equip.kit[k] = want;
  }
  return { notes };
}

/* ---------------- the plan ---------------- */

export function defaultPlan() {
  return { fish: true, camp: false, explore: false, target: null, dest: null };
}

export function cleanPlan(p) {
  const d = defaultPlan();
  if (!isObj(p)) return d;
  d.fish = p.fish !== false;
  d.camp = !!p.camp;
  d.explore = !!p.explore;
  if (isObj(p.target)) {
    if (fishById[p.target.sp] && !fishById[p.target.sp].retired && !fishById[p.target.sp].life?.observe) d.target = { sp: p.target.sp };
    else if (KIND_NAMES[p.target.kind]) d.target = { kind: p.target.kind };
  }
  d.dest = DESTS[p.dest] ? p.dest : null;
  return d;
}

export function cleanOuting(raw) {
  const o = isObj(raw) ? raw : {};
  return {
    plan: cleanPlan(o.plan),
    last: o.last ? cleanLoadout(o.last) : null,
    lastDest: DESTS[o.lastDest] ? o.lastDest : null,
    loadouts: (Array.isArray(o.loadouts) ? o.loadouts : []).map(cleanLoadout).filter(Boolean).slice(0, LOADOUT_MAX),
    // A drive under way when the game closed: finished on the next load (see main.js).
    travel: isObj(o.travel) && (DESTS[o.travel.to] || o.travel.to === 'home') ? { to: o.travel.to, from: typeof o.travel.from === 'string' ? o.travel.from.slice(0, 20) : null } : null,
    intro: !!o.intro,
  };
}

export function cleanCar(raw) {
  const home = CAR_PARKS.home;
  if (!isObj(raw)) return { x: home.x, z: home.z, yaw: home.yaw, at: 'home' };
  const x = num(raw.x, NaN, -3000, 3000), z = num(raw.z, NaN, -3000, 3000);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: home.x, z: home.z, yaw: home.yaw, at: 'home' };
  const at = raw.at === 'home' || DRIVE_IDS.includes(raw.at) ? raw.at : null;
  return { x, z, yaw: num(raw.yaw, 0, -100, 100), at };
}

// Which water a destination is: the species there and what you'd fish them with.
const waterOk = (it, water) => it.water === 'both' || (water === 'fresh' ? it.water === 'fresh' : it.water !== 'fresh');

// Setups worth suggesting for the plan: the ready-made ones and your own, best first, judged by
// the field guide's own recommendations for the target (or by the destination's water).
export function suggestions(s, plan) {
  const dest = DESTS[plan.dest];
  const water = dest?.water || 'salt';
  const all = [...SETUPS.map((x) => ({ ...x, own: false })), ...(s.gear.saved || []).map((x, i) => ({ ...x, id: `saved${i}`, own: true }))];
  let recs = [];
  if (plan.target?.sp) recs = setupsFor(fishById[plan.target.sp]).slice(0, 6);
  const score = (x) => {
    let v = 0;
    const items = x.items.map((i) => TACKLE[i]);
    if (recs.length) {
      recs.forEach((r, k) => { if (x.rods.includes(r.rod) && x.items.includes(r.item)) v += 6 - k; });
      if (!v) recs.forEach((r) => { if (x.rods.includes(r.rod)) v += 0.5; });
    } else if (plan.target?.kind) {
      if (x.rods.some((r) => RODS[r].kind === plan.target.kind)) v += 4;
    } else v += 1;
    v += items.filter((it) => waterOk(it, water)).length / Math.max(1, items.length);
    return v;
  };
  return all.map((x) => ({ setup: x, score: score(x) })).filter((x) => x.score > 1.1).sort((a, b) => b.score - a.score).map((x) => x.setup);
}

// Does what you're taking (backpack and car) suit the plan? Returns the best match for the target,
// or null: { rod, item } from the guide's recommendations.
function takenMatch(s, sp) {
  const rods = new Set([...s.gear.pack.rods, ...s.equip.car.rods]), items = new Set([...s.gear.pack.items, ...s.equip.car.items]);
  return setupsFor(sp).find((r) => rods.has(r.rod) && items.has(r.item)) || null;
}

/* ---------------- before you leave ---------------- */

// A short, honest look at what you're taking for what you've planned. Each line: { level: 'ok' |
// 'info' | 'warn', text }. Nothing here stops you leaving.
// ctx: { campDest(camp) → destination id or null (where a camp is), carHome }
export function departureCheck(s, plan, ctx = {}) {
  const out = [], ok = (text) => out.push({ level: 'ok', text }), info = (text) => out.push({ level: 'info', text }), warn = (text) => out.push({ level: 'warn', text });
  const dest = DESTS[plan.dest];
  const g = s.gear, rods = [...g.pack.rods, ...s.equip.car.rods], items = [...g.pack.items, ...s.equip.car.items];
  if (!dest) warn('No destination chosen yet.');
  if (plan.fish) {
    // Every rod you're taking needs something it can fish.
    const idle = rods.filter((r) => !items.some((i) => fits(RODS[r], TACKLE[i])));
    for (const r of idle) warn(`The ${RODS[r].short.toLowerCase()} has nothing to fish with: no ${RODS[r].accepts.map((t) => (t === 'bait' ? 'bait' : t === 'lure' ? 'lures' : t === 'fly' ? 'flies' : 'jigs')).join(' or ')} in your backpack or the car.`);
    // What's tied on, against the rules (a lure too heavy for the rod, say).
    for (const r of g.pack.rods) {
      const it = TACKLE[g.rig[r]];
      if (!it || !fits(RODS[r], it)) continue;
      const block = checkSetup(RODS[r], it, termOf(g, RODS[r])).find((p) => p.level === 'block');
      if (block) warn(`${RODS[r].short}: ${block.text}`);
    }
    if (dest) {
      const wrong = items.filter((i) => !waterOk(TACKLE[i], dest.water)).map((i) => TACKLE[i].short.toLowerCase());
      if (wrong.length && wrong.length === items.length) warn(`Everything you’re taking is for ${dest.water === 'fresh' ? 'the sea' : 'fresh water'}, and ${dest.name} is ${dest.water === 'fresh' ? 'a lake' : 'salt water'}.`);
      else if (wrong.length) info(`${cap(listWords(wrong))} ${wrong.length === 1 ? 'is' : 'are'} for ${dest.water === 'fresh' ? 'the sea' : 'fresh water'}: ${wrong.length === 1 ? 'it won’t' : 'they won’t'} do much at ${dest.name}.`);
    }
    const sp = plan.target?.sp ? fishById[plan.target.sp] : null;
    if (sp) {
      const m = takenMatch(s, sp);
      if (m) ok(`For ${sp.name.toLowerCase()}: ${TACKLE[m.item].on} on the ${RODS[m.rod].short.toLowerCase()} is what the field guide suggests${g.pack.rods.includes(m.rod) && g.pack.items.includes(m.item) ? '' : ' (part of it is in the car)'}.`);
      else {
        const rec = setupsFor(sp)[0];
        warn(rec ? `Nothing you’re taking is what the field guide suggests for ${sp.name.toLowerCase()} (${TACKLE[rec.item].on} on the ${RODS[rec.rod].short.toLowerCase()}).` : `The field guide has no setup for ${sp.name.toLowerCase()}.`);
      }
    } else if (plan.target?.kind) {
      if (!rods.some((r) => RODS[r].kind === plan.target.kind)) warn(`No rod for ${KIND_NAMES[plan.target.kind].toLowerCase()} in your backpack or the car.`);
    }
    if (!items.length) warn('No bait, lures or flies at all: you’d only be able to look.');
    else if (!out.some((l) => l.level === 'warn')) ok(`Fishing: ${rods.map((r) => RODS[r].short.toLowerCase()).join(' and ')}, with ${items.length} kinds of tackle.`);
  } else if (!items.length) info('No fishing tackle packed: fine for a walk, and the rod you always carry comes along.');
  if (plan.camp) {
    const tent = s.equip.kit.tent, camp = campOfKit(s, 'tent');
    if (camp) {
      const where = ctx.campDest?.(camp);
      if (where && where === plan.dest) ok(`Your tent is already pitched at ${camp.name}${dest ? `, ${dest.name}` : ''}: no need to take it.`);
      else warn(`Your tent is pitched at ${camp.name}${where && DESTS[where] ? ` (${DESTS[where].name})` : ''}: pack that camp up to take it somewhere new, or go there instead.`);
    } else if (tent === 'home') warn('You’re camping, but the tent is still in the garage.');
    else ok(`Tent: ${tent === 'pack' ? 'in your backpack' : 'in the car'}.`);
    if (!camp || ctx.campDest?.(camp) !== plan.dest) {
      for (const k of ['stove', 'coolbox']) {
        const at = s.equip.kit[k];
        if (at === 'home') info(k === 'stove' ? 'The stove is at home: you can camp, but not cook there.' : 'The cool box is at home: kept fish stay in your creel.');
        else if (at.startsWith('camp:')) info(`The ${KIT[k].short} is at ${campOfKit(s, k)?.name || 'your camp'}.`);
      }
    }
  } else {
    const away = KIT_IDS.filter((k) => s.equip.kit[k] === 'pack' || s.equip.kit[k] === 'car');
    if (away.length) info(`Not camping, but the ${listWords(away.map((k) => KIT[k].short))} ${away.length === 1 ? 'is' : 'are'} coming along anyway.`);
  }
  // By boat: the car waits at the harbour, so only what you carry goes across.
  if (dest?.boat) {
    const launch = DESTS[dest.launch];
    if (plan.camp && s.equip.kit.tent === 'car') warn(`The tent is in the car, and the car stays at ${launch.name}: put it in your backpack to camp on ${dest.name} (or sleep aboard the cabin boat).`);
    if (s.equip.car.rods.length || s.equip.car.items.length) info(`${dest.name} is by boat from ${launch.name}: what’s in the boot stays with the car there, and only your backpack goes across.`);
  }
  if (plan.explore) ok('Your camera is always in your pocket.');
  if (ctx.carHome === false) warn('The car isn’t at home: the boot can’t be loaded until it is.');
  return out;
}

// The essentials for the plan, from what you own (it's all yours: nothing is bought or made up):
// a setup that suits the target into your backpack, and the camping gear into the car. Returns a
// list of what changed, in words.
export function essentials(s, plan, ctx = {}) {
  const changes = [];
  if (plan.fish) {
    const sp = plan.target?.sp ? fishById[plan.target.sp] : null;
    const good = sp ? takenMatch(s, sp) : null;
    const carried = sp ? good && s.gear.pack.rods.includes(good.rod) && s.gear.pack.items.includes(good.item) : s.gear.pack.items.length > 0;
    if (!carried) {
      const best = suggestions(s, plan)[0];
      if (best) {
        packSetup(s, best);
        if (sp) {
          const rec = setupsFor(sp).find((r) => best.rods.includes(r.rod) && best.items.includes(r.item));
          if (rec) {
            s.gear.rod = rec.rod;
            s.gear.rig[rec.rod] = rec.item;
            s.gear.line[rec.rod] = rec.line;
            s.gear.term[rec.rod] = rec.term;
          }
        }
        changes.push(`Packed ${best.name} in your backpack`);
      }
    }
  }
  if (plan.camp && ctx.carHome !== false) {
    const camp = campOfKit(s, 'tent');
    const there = camp && ctx.campDest?.(camp) === plan.dest;
    if (!there) {
      for (const k of KIT_IDS) {
        if (s.equip.kit[k] !== 'home') continue;
        s.equip.kit[k] = 'car';
        changes.push(`Loaded the ${KIT[k].short} into the car`);
      }
    }
  }
  return changes;
}

/* ---------------- what's there ---------------- */

// The species living in a destination's water (from the fish actually there), busiest first.
// Fish you haven't met yet are counted but not named, so the guide's surprises stay surprises.
export function speciesAt(eco, dest, known = {}) {
  const D = DESTS[dest];
  if (!D) return { named: [], unknown: 0 };
  const by = new Map();
  for (const a of eco.agents) {
    if (a.sp.retired || a.L.observe) continue;
    if (Math.hypot(a.home.x - D.at.x, a.home.z - D.at.z) > D.at.r) continue;
    by.set(a.sp.id, (by.get(a.sp.id) || 0) + 1);
  }
  const named = [], unknownIds = [];
  for (const [id, n] of by) {
    if (n < 2) continue;
    if (known[id]) named.push({ sp: fishById[id], n, act: eco.activity?.[id] ?? 0 });
    else unknownIds.push(id);
  }
  named.sort((a, b) => b.act - a.act || b.n - a.n);
  return { named, unknown: unknownIds.length };
}

// The kinds of water a destination offers (from the habitat map).
export function habitatsAt(habitat, dest) {
  const D = DESTS[dest];
  if (!D) return [];
  const count = {};
  for (const sp of habitat.spots) {
    if (Math.hypot(sp.x - D.at.x, sp.z - D.at.z) > D.at.r) continue;
    count[sp.type] = (count[sp.type] || 0) + 1;
  }
  return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
