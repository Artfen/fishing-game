// Water in her (marine physics C6a): what comes in, where it lies, what it weighs, and what takes
// it out again.
//
// Her hull is divided as her builder divided it: an open boat (the rowing boat, the skiff, the bass
// boat, the sailing boat) is one bilge from end to end, the water running freely along it; a
// kayak's cockpit lies between its sealed ends; the cabin boat's cockpit and cabin and the yacht's
// engine room, saloon and forecabin are each behind a bulkhead, water spilling over its sill only
// once one's full. The RIB and the centre console have self-draining decks: water over the side runs
// out through the scuppers, and only her bilge below the deck can fill. The jet ski and the board
// are sealed.
//
// Water comes in only by a way in:
// - A breach: a part of her hull cracked right through (damage.js, past 0.85) below her waterline,
//   at the rate the head of water over the hole drives through it (Torricelli, with a sharp-edged
//   hole's discharge coefficient), less as the water inside rises to meet it.
// - Green water: in an open compartment, a sea standing above her gunwale pours over it (a broad-
//   crested weir along the compartment's side).
// - Rain, a little, into anything open.
// And goes out by: an electric bilge pump with a float switch on the boats with a battery (it draws
// on it with the engine off), bailing by hand (any boat), and hauling her out (the yard).
//
// The water's weight acts where it lies: down in the compartment, run to the low side as she heels
// and to the low end as she trims (a free surface: the higher it can move, the less stiff she is).
// A flooded engine room stops her engines. However much comes in, she floats: small craft carry
// buoyancy (foam, air tanks) enough to stay up swamped, so no compartment holds more than leaves her
// a reserve.
//
// Difficulty: on Relaxed, water never stands past a third of any compartment and the pumps are twice
// as strong; on Standard, the full account; on Realistic, a breach lets in more and the pumps manage
// less.

export const SEALED = new Set(['windsurf', 'jetski']);
export const SELF_DRAINING = new Set(['rib', 'console']);
// Electric bilge pumps (litres a second, all together): the boats with a battery.
export const PUMPS = { bass: 1.2, cabin: 1.2, console: 2, rib: 1.5, cruiser: 3 };
// Bailing by hand (litres a second: a bailer or a hand pump, steadily).
export const BAIL = 0.7;
// What a pump draws on her battery, a share of its charge a second (about 5 A from 70 Ah).
export const PUMP_DRAW = 2e-5;
export const MODES = {
  relaxed: { cap: 1 / 3, inK: 1, pumpK: 2 },
  standard: { cap: 1, inK: 1, pumpK: 1 },
  realistic: { cap: 1, inK: 1.4, pumpK: 0.75 },
};
export const modeOf = (difficulty) => MODES[difficulty] || MODES.standard;
const RHO = 1025;   // kg/m³
const G = 9.81;
const CD = 0.6;     // a sharp-edged hole's discharge coefficient
const WEIR = 1.7;   // broad-crested weir: Q = 1.7 b d^1.5 (m³/s)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Her compartments, as her builder divided them: [{ id, name, t0, t1 (share of her length from
// the stern), open (green water and rain get in), engine (her engines are in it) }].
function layoutOf(kind) {
  if (SEALED.has(kind)) return [];
  if (kind === 'kayak') return [{ id: 'cockpit', name: 'the cockpit', t0: 0.3, t1: 0.6, open: true }];
  if (kind === 'cabin') return [{ id: 'cockpit', name: 'the cockpit', t0: 0.02, t1: 0.5, open: true }, { id: 'cabin', name: 'the cabin', t0: 0.5, t1: 0.95 }];
  if (kind === 'cruiser') return [{ id: 'engine', name: 'the engine room', t0: 0.02, t1: 0.3, engine: true }, { id: 'saloon', name: 'the saloon', t0: 0.3, t1: 0.72 }, { id: 'fore', name: 'the forecabin', t0: 0.72, t1: 0.95 }];
  if (SELF_DRAINING.has(kind)) return [{ id: 'bilge', name: 'her bilge', t0: 0.03, t1: 0.9 }];
  return [{ id: 'bilge', name: 'her bilge', t0: 0.03, t1: 0.95, open: true }];
}

// Her compartments with their sizes, for a hull H (boat.js HULLS): each one's capacity (litres: her
// section's area from her keel to her sheer, or to her deck on a self-draining boat, along its
// length), its middle (local z), its width at the middle, and the heights of its floor (keel) and
// top. reserve: the litres she can carry and still float (her buoyancy past her own weight, less a
// margin: see reserveOf); capacities are held within it.
export function compartmentsFor(kind, H, reserve = Infinity) {
  const out = [];
  const hw = (t) => H.B * H.hw(t), sheer = (t) => H.D + H.sheer(t), keel = (t) => H.keel(t), zAt = (t) => -H.L / 2 + H.L * t;
  const deck = SELF_DRAINING.has(kind) ? H.floorY ?? 0.2 : null;
  for (const L of layoutOf(kind)) {
    let cap = 0;
    const N = 8, dz = (H.L * (L.t1 - L.t0)) / N;
    for (let i = 0; i < N; i++) {
      const t = L.t0 + ((i + 0.5) / N) * (L.t1 - L.t0);
      const top = deck != null ? Math.min(deck, sheer(t)) : sheer(t);
      // (A boat's section is rounder than a box: three-fifths of one, from her keel up.)
      cap += 0.6 * 2 * hw(t) * Math.max(0, top - keel(t)) * dz;
    }
    const tc = (L.t0 + L.t1) / 2;
    out.push({ ...L, cap: cap * 1000, zc: zAt(tc), len: H.L * (L.t1 - L.t0), width: 2 * hw(tc) * 0.85, floor: keel(tc), top: deck != null ? Math.min(deck, sheer(tc)) : sheer(tc) });
  }
  // (Held within her reserve of buoyancy, shared in proportion: swamped, she floats.)
  const total = out.reduce((n, c) => n + c.cap, 0);
  if (total > reserve) for (const c of out) c.cap *= reserve / total;
  return out;
}
// Her reserve: the litres of water she can take and still float with a margin (her volume to her
// sheer, less her own weight and what she carries, less a sixth for her to float awash, not under).
export const reserveOf = (volumeToSheer, kg) => Math.max(0, ((volumeToSheer * RHO - kg) / RHO) * (5 / 6) * 1000);

// What water's in each, litres (the save keeps it with her damage: damage.js water).
export const waterKg = (W) => (W || []).reduce((n, l) => n + l, 0) * (RHO / 1000);
export const waterLitres = (W) => (W || []).reduce((n, l) => n + l, 0);

// How deep the water stands in a compartment (m, from its floor) holding `litres`.
export const depthOf = (c, litres) => (c.cap > 0 ? clamp(litres / c.cap, 0, 1) * (c.top - c.floor) : 0);

// A hole of area A (m²) with `head` m of water outside above it and `inside` m inside: litres a second.
export const breachFlow = (A, head, inside = 0) => {
  const h = head - Math.max(0, inside);
  return h > 0 ? CD * A * Math.sqrt(2 * G * h) * 1000 : 0;
};
// A sea `d` m over her gunwale along `len` m: litres a second.
export const overFlow = (d, len) => (d > 0 ? WEIR * len * d ** 1.5 * 1000 : 0);
// Rain falling into an open compartment of `area` m² at `rain` (0 … 1: a downpour about 12 mm an
// hour): litres a second.
export const rainFlow = (rain, area) => Math.max(0, rain) * (12 / 3600) * area;

// A breach's hole, for a part of her hull cracked right through (damage 0.85 … 1): its area (m²),
// a hand's-width crack opening to a split.
export const holeArea = (dmg) => (dmg < 0.85 ? 0 : 0.0015 + ((dmg - 0.85) / 0.15) * 0.0045);

// One step of the water (litres) in each compartment: `inflow` (litres a second into each), `pump`
// (litres a second out, taken from the fullest first), held within each one's capacity (and on
// Relaxed, a third of it); a full one spills into its neighbours over their sills. Returns the
// litres pumped and whether anything is gaining.
export function stepWater(comps, W, inflow, pump, dt, mode = MODES.standard) {
  let pumped = 0, gaining = false;
  for (let i = 0; i < comps.length; i++) {
    const add = (inflow[i] || 0) * mode.inK * dt;
    if (add > 0) gaining = true;
    W[i] += add;
  }
  // Pumped out, the fullest first (the pump's suction where the water is).
  let left = pump * mode.pumpK * dt;
  while (left > 1e-6) {
    let k = -1;
    for (let i = 0; i < comps.length; i++) if (W[i] > 1e-3 && (k < 0 || W[i] / comps[i].cap > W[k] / comps[k].cap)) k = i;
    if (k < 0) break;
    const take = Math.min(W[k], left);
    W[k] -= take;
    left -= take;
    pumped += take;
  }
  if (gaining && pumped >= comps.reduce((n, c, i) => n + (inflow[i] || 0), 0) * mode.inK * dt) gaining = false;
  // Spilling over a full one's sill into the next; the last can only hold what it holds.
  for (let i = 0; i < comps.length; i++) {
    const max = comps[i].cap * mode.cap;
    if (W[i] <= max) continue;
    const over = W[i] - max;
    W[i] = max;
    const j = i + 1 < comps.length && W[i + 1] < comps[i + 1].cap * mode.cap ? i + 1 : i - 1 >= 0 && W[i - 1] < comps[i - 1].cap * mode.cap ? i - 1 : -1;
    if (j >= 0) W[j] += over;
  }
  for (let i = 0; i < comps.length; i++) W[i] = clamp(W[i], 0, comps[i].cap * mode.cap);
  return { pumped, gaining };
}

// Where the water in a compartment lies (her local frame: +x port, +z forward) as she lies: run to
// her low side and low end (px, bz: her port and bow axes' world heights, as hydro's R gives them),
// as far as a free surface over its width and length would go. For its weight's point.
export function waterAt(c, litres, px, bz, out = [0, 0, 0]) {
  const h = Math.max(0.02, depthOf(c, litres));
  const sx = (c.width * c.width) / (12 * h), sz = (c.len * c.len) / (12 * h);
  const tx = -px / Math.sqrt(Math.max(1e-6, 1 - px * px)), tz = -bz / Math.sqrt(Math.max(1e-6, 1 - bz * bz));
  // (No further than a wedge of water lying in the low side or end puts it: a sixth of the way.)
  out[0] = clamp(sx * tx, -c.width / 6, c.width / 6);
  out[1] = c.floor + h / 2;
  out[2] = c.zc + clamp(sz * tz, -c.len / 6, c.len / 6);
  return out;
}

// In words for the throttle panel: "water aboard 120 L".
export const waterWords = (litres) => `water aboard ${litres < 10 ? litres.toFixed(1) : Math.round(litres)} L`;
