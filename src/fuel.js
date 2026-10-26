import { DESTS, driveMinutes } from './outing.js';

// Fuel: light, and only for what has an engine. The car and the motorboats (the motor skiff,
// the bass boat's outboard, the cabin boat, the sailing boat's little outboard, the centre
// console, the jet ski, and the yacht's diesels) burn fuel from the pumps; the rowing boat and the kayak never
// need any; the bass boat's quiet electric motor runs on a battery of its own.
//
//  · You fill up at the pump by the garage at home, the harbour pump on Willowhaven quay (it
//    reaches the boats alongside and, with a can, the car park), the fuel point on Willowhaven's
//    pontoon, or the pump on Puerto Brasa quay far to the south. Petrol costs nothing but a few
//    minutes: this is about planning a trip, not money.
//  · A 10-litre jerry can goes wherever you take it (the garage, the car's boot, your backpack):
//    fill it at a pump and pour it into the car or a boat somewhere without one (Longmere, say).
//  · Running dry never strands you: the car rolls to a stop and someone up the lane lends you a
//    can; a boat without fuel can still be paddled along with an oar, or towed to a quay. Either
//    way it costs an hour or so, and you're on your way again.
//  · The battery runs down while the electric motor runs, and charges while the boat is tied up
//    at a jetty or quay, and overnight whenever you sleep.
//  · The kayak's little electric motor has a battery of its own, charged the same way. Flat, it
//    simply stops: the paddle is always there.
//
// state.fuel: { car, boats: { skiff, bass, cabin, sail, cruiser, console, jetski } (litres), battery (0…1),
//   kayak (0…1), can: { at, litres } }

// (The sailing boat's little outboard has a small tank of its own; the yacht (id 'cruiser') a
// big one, enough for the long passage south and some.)
export const TANKS = { car: 45, skiff: 20, bass: 30, cabin: 40, sail: 12, cruiser: 300, console: 200, jetski: 60 };
export const PETROL = ['skiff', 'bass', 'cabin', 'sail', 'cruiser', 'console', 'jetski'];
// What the yacht needs aboard to set out on the crossing to Las Brasas or home (see crossing.js):
// she burns about 55 litres across with the lever down the whole way; this leaves a margin.
export const PASSAGE_FUEL = 90;
export const CAN = 10;
export const CAN_PLACES = ['home', 'car', 'pack'];
// The car: litres a minute of driving (a drive you let go by), and a metre (one you drive).
// (Home to Willowhaven is about 2 L; Wend Quay or the Mere Boathouse and back, about a third of a tank.)
export const CAR_PER_MIN = 0.35;
export const CAR_PER_M = 0.014;
// The boats: litres a second at full throttle (a full tank of the skiff is a good quarter of an
// hour flat out, far longer at the speeds you fish at).
export const BOAT_PER_S = { skiff: 0.02, bass: 0.03, cabin: 0.03, sail: 0.008, cruiser: 0.05, console: 0.06, jetski: 0.045 };
// The battery: what a second of the electric motor at full takes (about ten minutes of it), and
// what an hour tied up at a jetty or a quay gives back.
export const BATTERY_PER_S = 0.0017;
export const BATTERY_PER_HOUR = 0.5;
// The kayak's battery: a quarter of an hour flat out (far longer at dead slow).
export const KAYAK_PER_S = 0.0011;
// Help when you run dry: what a borrowed can holds, and how long it takes.
export const RESCUE = { car: 6, boat: 4, hours: 1 };
// The low-fuel words come at these fractions of a tank.
export const LOW = 0.2;
// Enough in a motor boat's tank for a crossing to a place reached by boat, and back (the Calf is
// about 600 m from Willowhaven quay: a litre or two each way at the speeds you'd go).
export const BOAT_TRIP = 6;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const r1 = (v) => Math.round(v * 10) / 10;

export function defaultFuel() {
  return { car: TANKS.car, boats: Object.fromEntries(PETROL.map((k) => [k, TANKS[k]])), battery: 1, kayak: 1, can: { at: 'home', litres: CAN } };
}

// A saved record made safe (and a save from before fuel: everything full).
export function cleanFuel(raw) {
  const d = defaultFuel();
  if (!isObj(raw)) return d;
  d.car = num(raw.car, TANKS.car, 0, TANKS.car);
  if (isObj(raw.boats)) for (const k of PETROL) d.boats[k] = num(raw.boats[k], TANKS[k], 0, TANKS[k]);
  d.battery = num(raw.battery, 1, 0, 1);
  // (A save from before the kayak had a motor: its battery starts full.)
  d.kayak = num(raw.kayak, 1, 0, 1);
  if (isObj(raw.can)) {
    d.can.at = CAN_PLACES.includes(raw.can.at) ? raw.can.at : 'home';
    d.can.litres = num(raw.can.litres, CAN, 0, CAN);
  }
  return d;
}

// How much is in a tank ('car' or a petrol boat), and how much it holds.
export const level = (f, what) => (what === 'car' ? f.car : f.boats[what] ?? 0);
export const room = (f, what) => TANKS[what] - level(f, what);
const set = (f, what, v) => {
  if (what === 'car') f.car = v;
  else f.boats[what] = v;
};
export const isPetrol = (kind) => PETROL.includes(kind);

// Litres for a drive that goes by (from and to: 'home' or a destination).
export const carNeeds = (from, to) => r1(driveMinutes(from || 'home', to) * CAR_PER_MIN);

// Driving yourself: metres covered. Returns true the moment the tank runs dry.
export function burnCar(f, metres) {
  if (f.car <= 0) return false;
  f.car = Math.max(0, f.car - Math.abs(metres) * CAR_PER_M);
  return f.car === 0;
}

// A drive that goes by: the fuel it takes, or (short of it) running dry on the way and the hour it
// takes to get a can, arriving with a little in the tank. Never a drive you can't make.
export function driveBy(f, from, to) {
  const need = carNeeds(from, to);
  if (f.car >= need) {
    f.car = r1(f.car - need);
    return { need, short: false, hours: 0 };
  }
  f.car = Math.max(2, r1(RESCUE.car - (need - f.car) * 0.25));
  return { need, short: true, hours: RESCUE.hours };
}

// A motor running for dt seconds at lever (−0.4 … 1): petrol, or (the bass boat's first notches)
// the battery. Returns 'dry' or 'flat' the moment one runs out.
export function burnBoat(f, kind, lever, dt, troll = 0) {
  if (!isPetrol(kind) || !lever) return null;
  if (troll && lever > 0 && lever <= troll) {
    if (f.battery <= 0) return null;
    f.battery = Math.max(0, f.battery - BATTERY_PER_S * (lever / troll) * dt);
    return f.battery === 0 ? 'flat' : null;
  }
  const v = f.boats[kind];
  if (v <= 0) return null;
  f.boats[kind] = Math.max(0, v - BOAT_PER_S[kind] * Math.pow(Math.abs(lever), 1.5) * dt);
  return f.boats[kind] === 0 ? 'dry' : null;
}

export function chargeBattery(f, hours, which = 'battery') {
  f[which] = Math.min(1, f[which] + hours * BATTERY_PER_HOUR);
}

// The kayak's motor running for dt seconds at lever (-1 … 1). Returns 'flat' the moment the
// battery runs out.
export function burnKayak(f, lever, dt) {
  if (!lever || f.kayak <= 0) return null;
  f.kayak = Math.max(0, f.kayak - KAYAK_PER_S * Math.pow(Math.abs(lever), 1.3) * dt);
  return f.kayak === 0 ? 'flat' : null;
}

// Fill a tank (or the can) at a pump. Returns the litres it took.
export function fill(f, what) {
  if (what === 'can') {
    const got = CAN - f.can.litres;
    f.can.litres = CAN;
    return r1(got);
  }
  const got = room(f, what);
  set(f, what, TANKS[what]);
  return r1(got);
}

// Pour the jerry can into a tank: as much as fits. Returns the litres poured.
export function pour(f, into) {
  const got = Math.min(f.can.litres, room(f, into));
  if (got <= 0) return 0;
  f.can.litres = r1(f.can.litres - got);
  set(f, into, level(f, into) + got);
  return r1(got);
}

export function moveCan(f, to) {
  if (!CAN_PLACES.includes(to)) return { ok: false, why: 'Nowhere to put it.' };
  f.can.at = to;
  return { ok: true };
}

// Help when you've run dry: a borrowed can's worth (and the time it took).
export function rescue(f, what) {
  set(f, what, Math.max(level(f, what), what === 'car' ? RESCUE.car : RESCUE.boat));
  return RESCUE.hours;
}

// In words, for the hints and the sheets: "31 of 45 L", "battery 80%".
const amount = (v) => (v < 10 ? r1(v) : Math.round(v));
export const litres = (v) => `${amount(v)} L`;
export const tankWords = (f, what) => `${amount(level(f, what))} of ${TANKS[what]} L`;
export const batteryWords = (f, which = 'battery') => `battery ${Math.round(f[which] * 100)}%`;
export const canWords = (f) => `${amount(f.can.litres)} of ${CAN} L`;
export const low = (f, what) => level(f, what) < TANKS[what] * LOW;

// For the workbench's packing list and the car's "Where to?": will the tank get you there and
// back? (A level per line, like the rest of the check: ok, info or warn.)
export function fuelCheck(f, from, to) {
  const T = DESTS[to];
  if (!T) return [];
  // (A place by boat: the car goes as far as its harbour.)
  const D = DESTS[T.launch] || T;
  const there = carNeeds(from, to), back = carNeeds(to, 'home');
  const have = f.car;
  const out = [];
  const canWith = f.can.at !== 'home' && f.can.litres >= 1;
  if (have >= there + back) out.push({ level: 'ok', text: `Fuel: ${tankWords(f, 'car')}, plenty for ${D.name} and back (about ${litres(there + back)}).` });
  else if (have + (canWith ? f.can.litres : 0) >= there + back) out.push({ level: 'info', text: `Fuel: ${tankWords(f, 'car')} gets you to ${D.name} (about ${litres(there)}); the jerry can with you gets you home again.` });
  else if (have >= there) out.push({ level: 'info', text: `Fuel: ${tankWords(f, 'car')} gets you to ${D.name} (about ${litres(there)}), but not home again: fill up at the pump by the garage, or take the jerry can.` });
  else out.push({ level: 'warn', text: `Fuel: ${tankWords(f, 'car')} isn’t enough for ${D.name} (about ${litres(there)}): fill up at the pump by the garage first.` });
  // The motor boats brought round to the quay (the bass boat stays on Longmere).
  if (T.boat) {
    const thin = ['skiff', 'cabin'].filter((k) => f.boats[k] < BOAT_TRIP);
    const names = { skiff: 'motor skiff', cabin: 'cabin boat' };
    if (thin.length) out.push({ level: 'info', text: `Boat fuel: the ${thin.map((k) => `${names[k]} has ${litres(f.boats[k])}`).join(' and the ')}. Fill up at the harbour pump on ${D.name} quay before you cross to ${T.name} (the oars and the paddle need none).` });
    else out.push({ level: 'ok', text: `Boat fuel: plenty in the motor skiff and the cabin boat for ${T.name} and back.` });
  }
  return out;
}
