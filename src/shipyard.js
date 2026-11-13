// Willowhaven Marine Works: buying a boat, hiring one for the day, paint and a name sign-written on
// her, and fitting her out (see economy.js for the purse).
//
// A new game starts with the camp's three: the rowing boat, the motor skiff and the kayak, yours
// for good. Every other boat is for sale at the Marine Works, or for hire by the day: a taste of
// her before you save up. A game from before the Marine Works keeps every boat it had: nothing is
// ever taken away.
//
// What money buys is capability and looks, never a better bite: range and speed (a long-range
// tank, an engine choice), electronics (an imaging sonar, a chartplotter, a radio), power (a
// house battery), the deck (floodlights, a livewell, rod holders, a bimini), an anchor that holds,
// your colours and your boat's name. Each fitting weighs something and some draw on her batteries.

import { pay } from './economy.js';
import { CATALOGUE, MODELS, PROPS, cleanChoice, propsFor } from './engines.js';
import { cleanVessels, cleanTrim, newVessel, logLine, flagById, STRIPE_PRICE, TUBES_PRICE } from './papers.js';

export const STARTER = ['row', 'skiff', 'kayak'];
// What each boat costs (pounds): from a couple of good days' fishing to a summer's.
export const PRICES = { windsurf: 90, jetski: 380, bass: 420, sail: 480, cabin: 650, rib: 1200, console: 1650, cruiser: 3600 };
// A day's hire: a few percent of her price.
export const hirePrice = (kind) => (PRICES[kind] ? Math.max(6, Math.round(PRICES[kind] * 0.03)) : 0);

// Hull colours from a boatyard's chart.
export const PAINTS = [
  { id: 'white', name: 'Gelcoat white', hex: '#eeeae2' },
  { id: 'navy', name: 'Navy', hex: '#24354f' },
  { id: 'red', name: 'Pillar-box red', hex: '#a8302a' },
  { id: 'green', name: 'Racing green', hex: '#2f5a43' },
  { id: 'sky', name: 'Sky blue', hex: '#7fa8c9' },
  { id: 'teal', name: 'Teal', hex: '#2c7c7a' },
  { id: 'cream', name: 'Cream', hex: '#e7dcc0' },
  { id: 'yellow', name: 'Sunflower', hex: '#e2b43c' },
  { id: 'black', name: 'Black', hex: '#1f2226' },
  { id: 'grey', name: 'Slate grey', hex: '#6b7279' },
];
export const PAINT_PRICE = 40;
export const NAME_PRICE = 25;
export const NAME_MAX = 18;

// Fittings: what each does, which boats take it, and its price (pounds). Each is grouped (cat),
// weighs something (kg: carried in her, so she's a touch slower and sits a touch lower), may draw
// on her batteries (amps, while it's on), and does something real: more range or speed, a better
// sonar, a track on your chart, the harbour's radio, light to fish by at night, fish kept alive,
// a faster troll, shade, an anchor that holds in a blow. A slot holds one: a new engine choice
// replaces the old. (Each motorboat's engine and propeller come from the engine catalogue
// instead: see engines.js and repowerBoat.)
export const FIT_CATS = { fuel: 'Fuel', electronics: 'Electronics', power: 'Power', trolling: 'Trolling motor', deck: 'Deck', gear: 'Ground tackle' };
export const FITS = {
  tank: {
    name: 'Long-range tank', cat: 'fuel', kg: 8, amps: 0,
    price: { skiff: 60, bass: 90, cabin: 110, console: 300, rib: 220, jetski: 90 },
    desc: 'Half as much fuel again: further out, and home again. Heavier when she’s full.',
    tank: 1.5,
  },
  sonar: {
    name: 'Imaging sonar', cat: 'electronics', kg: 3, amps: 1.2,
    price: { skiff: 140, bass: 180, cabin: 200, console: 300, rib: 260, cruiser: 360 },
    desc: 'A through-hull imaging transducer for the fish finder’s head unit: the down view and the split screen, ranges down to 40 m, and the smaller echoes picked out. (Without it the head unit shows the 2D sonar to 20 m.)',
  },
  // (G7) A deep sounder: the bottom to 200 m, where the shelf falls away and Gannet Deep's floor
  // lies (see sonar.js DEEP_RANGES). Without it the finder loses the bottom past what it reaches.
  deepsonar: {
    name: 'Deep sounder', cat: 'electronics', kg: 5, amps: 1.5,
    price: { cabin: 360, rib: 380, console: 420, cruiser: 480 },
    desc: 'A big low-frequency transducer for the fish finder’s head unit: it reads the bottom to two hundred metres, and the marks over it. The deep water off the shelf, and Gannet Deep’s floor, where nothing else reaches. (Without it the finder loses the bottom past 20 m, or 40 m with the imaging sonar.)',
  },
  plotter: {
    name: 'GPS chartplotter', cat: 'electronics', kg: 2, amps: 1,
    price: { skiff: 150, bass: 170, cabin: 190, console: 260, rib: 240, cruiser: 320, sail: 170, jetski: 160 },
    desc: 'Your track drawn on the chart wherever she goes, and at the helm the bearing and distance to the nearest of your marks.',
  },
  vhf: {
    name: 'VHF radio', cat: 'electronics', kg: 1, amps: 0.5,
    price: { skiff: 70, bass: 70, cabin: 80, console: 90, rib: 90, cruiser: 90, sail: 80 },
    desc: 'The harbour’s channel at sea: who’s catching what and where the birds are working, and the forecast, now and then while you’re out.',
  },
  battery: {
    name: 'Dual batteries', cat: 'power', kg: 26, amps: 0,
    price: { bass: 120, cabin: 110, console: 140, rib: 130, cruiser: 160 },
    desc: 'A second, house battery for the electronics and the lights, so the starting battery’s always there for the engine; and on the bass boat, the trolling motor runs half as long again.',
    house: true, troll: 1.6,
  },
  lights: {
    name: 'Deck floodlights', cat: 'deck', kg: 3, amps: 6,
    price: { skiff: 45, bass: 60, cabin: 70, console: 90, rib: 80, cruiser: 90 },
    desc: 'Bright LED floods that light the deck and the water round her after dark: fish by night and see what you’re doing. They draw hard on a battery with the engine off.',
  },
  livewell: {
    name: 'Livewell', cat: 'deck', kg: 22, amps: 0.5,
    price: { skiff: 90, bass: 120, cabin: 140, console: 160, cruiser: 180 },
    desc: 'A tank of running sea water: fish you keep aboard her stay alive, and fresh for the market, for as long as you’re out.',
  },
  holders: {
    name: 'Trolling rod holders', cat: 'deck', kg: 4, amps: 0,
    price: { skiff: 40, bass: 50, cabin: 60, console: 90, rib: 80, cruiser: 90 },
    desc: 'Proper holders on the gunwale: with a line out you can run a notch faster, for the lures that want speed (mackerel feathers, tuna plugs), and the rod rides safe while you steer.',
  },
  bimini: {
    name: 'Bimini top', cat: 'deck', kg: 9, amps: 0,
    price: { skiff: 90, bass: 120, rib: 160 },
    desc: 'A canvas top on a frame over the helm: shade from the sun and most of the rain off you while you’re aboard.',
  },
  // Fit-outs that change the work she can take (G5 of docs/PROGRESSION.md; vessels.js vesselOf):
  // room for more people, divers able to go down from her and climb back, her people happy in a
  // rougher sea. work: { seats (more, by kind), divers, comfort (m more sea her people are happy
  // in: not seaworthiness, which stays her hull's) }.
  seating: {
    name: 'Extra seating', cat: 'deck', kg: 18, amps: 0,
    price: { skiff: 80, rib: 140, console: 160, cabin: 150 },
    desc: 'A padded bench across her cockpit and a seat or two more: room for more people on a charter or a trip out (two more; on the skiff, one). Each of them weighs what a person weighs, and she feels it.',
    work: { seats: { skiff: 1, rib: 2, console: 2, cabin: 2 } },
  },
  ladder: {
    name: 'Dive ladder and tank racks', cat: 'deck', kg: 14, amps: 0,
    price: { skiff: 90, sail: 140, cabin: 170 },
    desc: 'A folding ladder over her stern and racks for the tanks: divers can kit up aboard, go down from her and climb back in, so she can take dive work.',
    work: { divers: true },
  },
  dodger: {
    name: 'Spray dodger', cat: 'deck', kg: 8, amps: 0,
    price: { skiff: 110, rib: 150, console: 170 },
    desc: 'A folding canvas hood with clear windows ahead of the helm: it turns the spray and the wind, and her people stay happy in a sea about 40 cm bigger. (She’s no more seaworthy for it: open water still wants a boat built for it.)',
    work: { comfort: 0.4 },
  },
  // The bow trolling motors (see trolling.js, and trollmount.js for each boat's installation):
  // one at a time, on the boats a bow mount suits. (The RIB's goes on a raised platform over her
  // tube nose, so it costs a little more fitted; the bass boat comes with the basic one.)
  troll: {
    name: 'Bow trolling motor', cat: 'trolling', slot: 'troll', kg: 22, amps: 0,
    price: { skiff: 260, bass: 300, cabin: 320, console: 380, rib: 440 },
    standardOn: ['bass'],
    desc: 'An electric motor on a bow mount. Stowed, it lies along the foredeck on its mount; to use it, go forward, release the latch and swing it down over the bow by hand until it locks, and set its depth on the collar. Then creep along a reef or round a shoal in silence with the main engine in neutral, steered by turning its head. Its own battery, charged at a jetty and overnight.',
  },
  trollgps: {
    name: 'GPS trolling motor (Spot-Lock)', cat: 'trolling', slot: 'troll', kg: 25, amps: 0,
    price: { skiff: 520, bass: 560, cabin: 600, console: 680, rib: 740 },
    desc: 'A saltwater bow motor with GPS, swung down and stowed by hand with a lift-assist spring that takes most of its weight. From its remote, anywhere aboard: Spot-Lock holds her on a spot in water too deep to anchor in, pushing back against the wind and the tide as she drifts, and heading hold keeps her bow where you set it. Too much wind or tide and she drags off slowly.',
  },
  trollpro: {
    name: 'High-thrust GPS trolling motor', cat: 'trolling', slot: 'troll', kg: 32, amps: 0,
    price: { bass: 860, cabin: 900, console: 980, rib: 1080 },
    desc: 'A bigger saltwater bow motor that stows and deploys itself at the press of a button, from its remote or the dashboard, its depth set by power trim. Twice the push: Spot-Lock that holds a heavier boat in a fresh breeze and a running tide. Wired for 36 volts; its battery runs down sooner, and flat, the actuator won’t move it: then it’s stowed by hand at the bow.',
  },
  trollbank: {
    name: 'Lithium trolling battery', cat: 'power', kg: 12, amps: 0,
    price: { skiff: 240, bass: 260, cabin: 260, console: 300, rib: 300 },
    desc: 'A lithium bank for the trolling motor: twice as long on Spot-Lock or creeping about, and lighter than the lead battery it replaces.',
  },
  anchor: {
    name: 'Heavier anchor and chain', cat: 'gear', kg: 14, amps: 0,
    price: { skiff: 35, bass: 45, cabin: 60, console: 80, rib: 70, cruiser: 120, sail: 50 },
    desc: 'A bigger anchor on a length of chain: it digs in first time and holds in a blow that would drag the old one across the bottom.',
    hold: 2.2,
  },
};
export const FIT_IDS = Object.keys(FITS);
// (What she comes with as standard isn't offered, unless an older game bought it anyway: fitted,
// it stays listed so it can be taken off.)
export const fitsFor = (kind, fitted = []) => FIT_IDS.filter((id) => FITS[id].price[kind] && !(FITS[id].standardOn?.includes(kind) && !fitted.includes(id)));

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const cleanBoatName = (v) => (typeof v === 'string' ? v.replace(/[^\p{L}\p{N} '’.&-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '');

// The yard's records, made sensible. kinds: the boats there are; legacy: a game from before the
// Marine Works (it owns every boat it had); day: today (a boat's papers begin today if it has none).
export function cleanYard(raw, kinds, legacy = false, day = 1) {
  const r = isObj(raw) ? raw : {};
  let owned = Array.isArray(r.owned) ? [...new Set(r.owned.filter((k) => kinds.includes(k)))] : legacy ? [...kinds] : [...STARTER];
  for (const k of STARTER) if (kinds.includes(k) && !owned.includes(k)) owned.push(k);
  const hired = isObj(r.hired) && kinds.includes(r.hired.kind) && !owned.includes(r.hired.kind) && Number.isFinite(r.hired.day)
    ? { kind: r.hired.kind, day: r.hired.day, ...(Number.isFinite(r.hired.until) ? { until: r.hired.until } : {}) } : null;
  const looks = {};
  for (const [k, v] of Object.entries(isObj(r.looks) ? r.looks : {})) {
    if (!kinds.includes(k) || !isObj(v)) continue;
    const paint = PAINTS.some((p) => p.id === v.paint) ? v.paint : null, name = cleanBoatName(v.name);
    // (And her stripe, a RIB's tubes, a flag: see papers.js.)
    const trim = cleanTrim(v, PAINTS.map((p) => p.id));
    if (paint || name || Object.keys(trim).length) looks[k] = { ...(paint ? { paint } : {}), ...(name ? { name } : {}), ...trim };
  }
  const fits = {};
  for (const [k, v] of Object.entries(isObj(r.fits) ? r.fits : {})) {
    if (!kinds.includes(k) || !Array.isArray(v)) continue;
    const ok = [];
    for (const id of new Set(v)) {
      if (!FITS[id]?.price[k]) continue;
      // (One to a slot: the last one fitted.)
      const slot = FITS[id].slot;
      if (slot) for (let i = ok.length - 1; i >= 0; i--) if (FITS[ok[i]].slot === slot) ok.splice(i, 1);
      ok.push(id);
    }
    if (ok.length) fits[k] = ok;
  }
  // The engine on her transom (or in her engine room), for a boat with a catalogue (see
  // engines.js), kept only where it isn't the one she came with on its matched propeller. A game
  // from before the catalogue keeps what it paid for: her "Bigger outboard" is the bigger engine
  // that replaced it, and her "Economy tune and prop" the lighter, more frugal one (CATALOGUE
  // legacy: the RIB's Skua 200 and Fulmar 115, say).
  const engines = {};
  for (const k of kinds) {
    if (!CATALOGUE[k]) continue;
    const v = isObj(r.engines) && isObj(r.engines[k]) ? r.engines[k] : null;
    const old = !v && isObj(r.fits) && Array.isArray(r.fits[k]) ? r.fits[k].filter((id) => id === 'power' || id === 'economy').pop() : null;
    const c = cleanChoice(k, v || (old ? { model: CATALOGUE[k].legacy?.[old] } : null));
    if (c.model !== CATALOGUE[k].stock || c.prop !== 'matched') engines[k] = c;
  }
  // Each boat's papers: her registration, her log, what she's done (see papers.js).
  const vessels = cleanVessels(r.vessels, owned, day);
  return { owned, hired, looks, fits, engines, vessels };
}

// Can you take her out: yours, or on hire to you now. A hire runs 24 hours from when you took her
// (until: your own clock, in game hours since day 0); one from an older game, with no until, runs
// to the end of the day it was taken (day). abs: the time now on your own clock; without it (or
// for an old hire) the day decides.
export const owns = (yard, kind) => yard.owned.includes(kind);
export const hiredToday = (yard, kind, day, abs) => {
  const H = yard.hired;
  if (H?.kind !== kind) return false;
  return Number.isFinite(H.until) && Number.isFinite(abs) ? abs < H.until : H.day === day;
};
export const usable = (yard, kind, day, abs) => owns(yard, kind) || hiredToday(yard, kind, day, abs);
// The time now on a state's own clock (null for a state without one).
const nowOf = (state) => (Number.isFinite(state.hour) ? state.day * 24 + state.hour : undefined);
export const HIRE_HOURS = 24;

// Buy her. Returns { ok, why }.
export function buyBoat(state, kind) {
  const Y = state.yard;
  if (owns(Y, kind)) return { ok: false, why: 'She’s yours already.' };
  if (!PRICES[kind]) return { ok: false, why: 'She isn’t for sale.' };
  const r = pay(state, PRICES[kind], `Bought the ${kind}`);
  if (!r.ok) return r;
  Y.owned.push(kind);
  if (Y.hired?.kind === kind) Y.hired = null;
  Y.vessels ??= {};
  Y.vessels[kind] = newVessel(kind, state.day);
  logLine(Y.vessels[kind], state.day, `Bought at Willowhaven Marine Works for ${PRICES[kind]} pounds.`);
  return { ok: true };
}

// Hire her for a day: 24 hours from now (one boat at a time). Returns { ok, why }.
export function hireBoat(state, kind) {
  const Y = state.yard, abs = nowOf(state);
  if (owns(Y, kind)) return { ok: false, why: 'She’s yours: no need to hire her.' };
  if (!PRICES[kind]) return { ok: false, why: 'She isn’t for hire.' };
  if (Y.hired && Y.hired.kind !== kind && hiredToday(Y, Y.hired.kind, state.day, abs)) return { ok: false, why: `You’ve the ${Y.hired.kind} on hire already.` };
  if (hiredToday(Y, kind, state.day, abs)) return { ok: false, why: 'She’s on hire to you already.' };
  const r = pay(state, hirePrice(kind), `A day’s hire of the ${kind}`);
  if (!r.ok) return r;
  Y.hired = { kind, day: state.day, ...(abs != null ? { until: abs + HIRE_HOURS } : {}) };
  return { ok: true };
}

// Paint her (a colour from PAINTS), or have her name sign-written. Returns { ok, why }.
export function paintBoat(state, kind, paint) {
  const Y = state.yard;
  if (!owns(Y, kind)) return { ok: false, why: 'Only your own boat.' };
  if (!PAINTS.some((p) => p.id === paint)) return { ok: false, why: 'Not a colour on the chart.' };
  if (Y.looks[kind]?.paint === paint) return { ok: false, why: 'She’s that colour already.' };
  if (Y.looks[kind]?.stripe === paint) return { ok: false, why: 'That’s her stripe’s colour: her paint wants one of its own.' };
  const r = pay(state, PAINT_PRICE, `Painted the ${kind}`);
  if (!r.ok) return r;
  Y.looks[kind] = { ...Y.looks[kind], paint };
  return { ok: true };
}
export function nameBoat(state, kind, name) {
  const Y = state.yard, n = cleanBoatName(name);
  if (!owns(Y, kind)) return { ok: false, why: 'Only your own boat.' };
  if (!n) return { ok: false, why: 'Give her a name first.' };
  if (Y.looks[kind]?.name === n) return { ok: false, why: 'That’s her name already.' };
  const r = pay(state, NAME_PRICE, `Sign-written the ${kind}`);
  if (!r.ok) return r;
  Y.looks[kind] = { ...Y.looks[kind], name: n };
  return { ok: true };
}

// Her stripe or a RIB's tubes in a colour from the chart, or a flag at her stern (see papers.js).
// Returns { ok, why }.
export function trimBoat(state, kind, what, id, { stripes = true, tubes = false } = {}) {
  const Y = state.yard;
  if (!owns(Y, kind)) return { ok: false, why: 'Only your own boat.' };
  const L = Y.looks[kind] || {};
  if (what === 'flag') {
    if (id === null) {
      if (!L.flag) return { ok: false, why: 'She flies none.' };
      Y.looks[kind] = { ...L };
      delete Y.looks[kind].flag;
      return { ok: true };
    }
    const F = flagById[id];
    if (!F) return { ok: false, why: 'Not a flag the chandlery has.' };
    if (L.flag === id) return { ok: false, why: 'She flies that one already.' };
    const r = pay(state, F.price, `A flag for the ${kind}`);
    if (!r.ok) return r;
    Y.looks[kind] = { ...L, flag: id };
    return { ok: true };
  }
  if ((what === 'stripe' && !stripes) || (what === 'tubes' && !tubes) || !['stripe', 'tubes'].includes(what)) return { ok: false, why: 'Not on her.' };
  if (!PAINTS.some((p) => p.id === id)) return { ok: false, why: 'Not a colour on the chart.' };
  if (L[what] === id) return { ok: false, why: 'She’s that colour already.' };
  if (what === 'stripe' && L.paint === id) return { ok: false, why: 'That’s her paint: a stripe wants a colour of its own.' };
  const r = pay(state, what === 'tubes' ? TUBES_PRICE : STRIPE_PRICE, `${what === 'tubes' ? 'New tube covers' : 'A new stripe'} for the ${kind}`);
  if (!r.ok) return r;
  Y.looks[kind] = { ...L, [what]: id };
  return { ok: true };
}

// Fit her out (a fitting in a slot already taken replaces what's there). Returns { ok, why, swapped }.
export function fitBoat(state, kind, id) {
  const Y = state.yard, F = FITS[id];
  if (!owns(Y, kind)) return { ok: false, why: 'Only your own boat.' };
  if (!F?.price[kind]) return { ok: false, why: 'That doesn’t fit her.' };
  if (Y.fits[kind]?.includes(id)) return { ok: false, why: 'She has one already.' };
  const r = pay(state, F.price[kind], `${F.name} for the ${kind}`);
  if (!r.ok) return r;
  const was = (Y.fits[kind] || []).filter((x) => !(F.slot && FITS[x].slot === F.slot));
  const swapped = (Y.fits[kind] || []).find((x) => F.slot && FITS[x].slot === F.slot) || null;
  Y.fits[kind] = [...was, id];
  return { ok: true, swapped };
}

// A new engine on her transom, or a new propeller (see engines.js): fitted while you wait, the old
// one taken in part exchange (the price is what's left to pay). A new engine keeps the kind of
// propeller she had, pitched for it. Returns { ok, why }.
export const engineOf = (yard, kind) => cleanChoice(kind, yard?.engines?.[kind]);
function setEngine(Y, kind, c) {
  Y.engines ??= {};
  if (c.model === CATALOGUE[kind].stock && c.prop === 'matched') delete Y.engines[kind];
  else Y.engines[kind] = c;
}
export function repowerBoat(state, kind, model) {
  const Y = state.yard, C = CATALOGUE[kind];
  if (!owns(Y, kind)) return { ok: false, why: 'Only your own boat.' };
  if (!C?.models.includes(model)) return { ok: false, why: 'That engine doesn’t go on her.' };
  const now = engineOf(Y, kind);
  if (now.model === model) return { ok: false, why: 'She has that engine already.' };
  const r = pay(state, MODELS[model].price * (C.count || 1), `${MODELS[model].name} for the ${kind}`);
  if (!r.ok) return r;
  // (An electric comes with its own propeller; back to petrol, the one she had if it fits.)
  setEngine(Y, kind, { model, prop: propsFor(kind, model).includes(now.prop) ? now.prop : 'matched' });
  return { ok: true };
}
export function repropBoat(state, kind, prop) {
  const Y = state.yard;
  if (!owns(Y, kind)) return { ok: false, why: 'Only your own boat.' };
  if (!CATALOGUE[kind]?.props.includes(prop)) return { ok: false, why: 'That propeller doesn’t fit her.' };
  const now = engineOf(Y, kind);
  if (!propsFor(kind, now.model).includes(prop)) return { ok: false, why: `The ${MODELS[now.model].name} takes only its own propeller.` };
  if (now.prop === prop) return { ok: false, why: 'She has that propeller already.' };
  const r = pay(state, PROPS[prop].price * (CATALOGUE[kind].count || 1), `A propeller for the ${kind}`);
  if (!r.ok) return r;
  setEngine(Y, kind, { ...now, prop });
  return { ok: true };
}

// Take a fitting off (to save her the weight, or the power): no charge, and no money back.
export function unfitBoat(state, kind, id) {
  const Y = state.yard;
  if (!Y.fits[kind]?.includes(id)) return { ok: false, why: 'She hasn’t one.' };
  Y.fits[kind] = Y.fits[kind].filter((x) => x !== id);
  if (!Y.fits[kind].length) delete Y.fits[kind];
  return { ok: true };
}

// What her fittings do (1, false or 0: as she came):
// { tank, thrust, burn (multipliers), kg (what they weigh), amps (what they draw, all on),
//   sonar, plotter, vhf, house (a house battery), troll (the trolling battery's size), lights,
//   livewell, holders, bimini, hold (how hard her anchor holds), seats (more), comfort (m more),
//   divers (room for them now), list (the ids) }.
export function fitEffect(yard, kind) {
  const list = (yard?.fits?.[kind] || []).filter((id) => FITS[id]?.price[kind]);
  const has = (id) => list.includes(id);
  const e = { tank: 1, thrust: 1, burn: 1, kg: 0, amps: 0, sonar: false, deep: false, plotter: false, vhf: false, house: false, troll: 1, lights: false, livewell: false, holders: false, bimini: false, hold: 1, seats: 0, comfort: 0, divers: false, trollMotor: null, trollBank: false, list };
  for (const id of list) {
    const F = FITS[id];
    e.kg += F.kg || 0;
    e.amps += F.amps || 0;
    if (F.thrust) e.thrust *= F.thrust[kind] || 1;
    if (F.burn) e.burn *= F.burn;
    if (F.tank) e.tank *= F.tank;
    if (F.troll) e.troll *= F.troll;
    if (F.hold) e.hold *= F.hold;
    if (F.house) e.house = true;
    const W = F.work;
    if (W) {
      e.seats += W.seats?.[kind] || 0;
      e.comfort += W.comfort || 0;
      if (W.divers) e.divers = true;
    }
  }
  for (const id of ['sonar', 'plotter', 'vhf', 'lights', 'livewell', 'holders', 'bimini']) e[id] = has(id);
  e.deep = has('deepsonar');
  // (The bow trolling motor fitted, if any, and its battery bank.)
  // (The bass boat's own: the basic bow motor, there unless a better one's fitted.)
  e.trollMotor = ['trollpro', 'trollgps', 'troll'].find(has) || (kind === 'bass' ? 'troll' : null);
  e.trollStandard = kind === 'bass' && !['trollpro', 'trollgps', 'troll'].some(has);
  e.trollBank = has('trollbank');
  return e;
}
