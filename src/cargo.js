// Cargo (marine physics C2): things you carry in a boat that have a weight and a place, and stay
// where you put them only if they're strapped down.
//
//  · A dive cylinder, full (a second dive without going back for air: swap to it at sea), a fish
//    box with ice, an equipment case, a spare battery (for an electric motor: swap it in when one's
//    flat), stores (water and food in a crate), and the jerry can (fuel.js: the same can that goes
//    in the car and your backpack, now aboard too, and poured into her tank from the deck).
//  · Bought once at the chandlery, kept there for you ("ashore") until you put them aboard a boat
//    lying at Willowhaven. Aboard, each sits on her deck where you set it: pick it up, carry it,
//    set it down somewhere else, strap it down or let it go.
//  · Strapped down, its weight is part of hers where it is (boat.js setLoads), as a fitting's is.
//    Loose, it slides when the deck tilts or the boat speeds up, slows or turns harder than the
//    deck's grip holds it (a cylinder lying fore-and-aft rolls across her at the least heel), until
//    it fetches up against her side; its weight goes with it, so a heavy thing sliding to the low
//    side heels her further. Only the boat you're in (or near) moves her loose things, and only a
//    few each: nothing else in the world is simulated for it.
//
// state.cargo: { items: [{ uid, id, at ('ashore' | 'boat:<kind>'), x, z, secured, full }],
//   can: { x, z, secured } (where the jerry can sits when it's aboard: fuel.js has where it is) }.
// x across (her port side +), z along (bow +), metres, in her own space, on her floor.

export const G = 9.81;

// Each thing: its weight (kg; `empty` when it has been used), its size [across, up, along] lying
// as it's stowed, what it costs, the deck's grip on it (static and sliding; a cylinder's across
// it is its roll), and the colours it's drawn in.
export const CARGO = {
  cylinder: { name: 'Dive cylinder', short: 'cylinder', kg: 17, empty: 14.4, size: [0.2, 0.2, 0.7], price: 60, grip: { s: 0.45, k: 0.35, roll: 0.04 }, colour: '#e6b422', note: 'A full 12-litre cylinder: swap to it at sea for a second dive. The chandlery refills it.', most: 2 },
  fishbox: { name: 'Fish box', short: 'fish box', kg: 9, size: [0.5, 0.32, 0.78], price: 15, grip: { s: 0.55, k: 0.42 }, colour: '#e9eef0', trim: '#2f6fa8', note: 'An insulated box with ice: 9 kg as it stands.' },
  case: { name: 'Equipment case', short: 'case', kg: 11, size: [0.42, 0.24, 0.56], price: 35, grip: { s: 0.4, k: 0.3 }, colour: '#2c3136', trim: '#c9a227', note: 'A hard case for the camera, spares and tools.' },
  battery: { name: 'Spare battery', short: 'battery', kg: 24, size: [0.2, 0.24, 0.34], price: 90, grip: { s: 0.5, k: 0.4 }, colour: '#1f2326', trim: '#c0392b', note: 'A charged deep-cycle battery: swap it in when an electric motor’s is flat. It charges at a jetty or quay.' },
  stores: { name: 'Stores crate', short: 'stores crate', kg: 22, size: [0.46, 0.34, 0.6], price: 20, grip: { s: 0.6, k: 0.45 }, colour: '#9a7a4f', trim: '#5c4630', note: 'Water and food for a few days away.' },
  can: { name: 'Jerry can', short: 'jerry can', kg: 1.6, size: [0.16, 0.34, 0.32], price: 0, grip: { s: 0.45, k: 0.35 }, colour: '#b3262a', note: 'Your jerry can, aboard: pour it into her tank from the deck.' },
};
export const CARGO_IDS = Object.keys(CARGO);
// (What's bought at the chandlery: the jerry can is the one you already have.)
export const SOLD = CARGO_IDS.filter((id) => id !== 'can');
// No more than this many things aboard one boat (and ashore, in all).
export const CARGO_MAX = 8;
export const PETROL_KG = 0.74;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export const newCargo = () => ({ items: [], can: { x: 0, z: 0, secured: true } });

export function cleanCargo(raw, kinds = null) {
  const c = newCargo();
  if (!isObj(raw)) return c;
  const seen = new Set();
  for (const it of Array.isArray(raw.items) ? raw.items : []) {
    if (!isObj(it) || !SOLD.includes(it.id) || typeof it.uid !== 'string' || !/^[a-z0-9]{1,12}$/.test(it.uid) || seen.has(it.uid)) continue;
    const kind = typeof it.at === 'string' && /^boat:[a-z]{2,12}$/.test(it.at) ? it.at.slice(5) : null;
    const at = kind && (!kinds || kinds.includes(kind)) ? it.at : 'ashore';
    seen.add(it.uid);
    c.items.push({ uid: it.uid, id: it.id, at, x: num(it.x, 0, -5, 5), z: num(it.z, 0, -15, 15), secured: it.secured !== false, full: it.full !== false });
    if (c.items.length >= CARGO_MAX * 2) break;
  }
  if (isObj(raw.can)) c.can = { x: num(raw.can.x, 0, -5, 5), z: num(raw.can.z, 0, -15, 15), secured: raw.can.secured !== false };
  return c;
}

// What a thing weighs now (the can by what's in it; a used cylinder lighter).
export function weightOf(piece, canLitres = 0) {
  const C = CARGO[piece.id];
  if (!C) return 0;
  if (piece.id === 'can') return C.kg + Math.max(0, canLitres) * PETROL_KG;
  return piece.full === false && C.empty ? C.empty : C.kg;
}

export const owned = (c, id) => c.items.filter((it) => it.id === id).length;
export const aboard = (c, kind) => c.items.filter((it) => it.at === `boat:${kind}`);

// Buy one at the chandlery: it waits there, ashore. (The money is the caller's.)
export function buy(c, id) {
  const C = CARGO[id];
  if (!C || !SOLD.includes(id)) return { ok: false, why: 'Not sold here.' };
  if (owned(c, id) >= (C.most || 1)) return { ok: false, why: `You’ve ${C.most > 1 ? `${C.most} already` : 'one already'}.` };
  if (c.items.length >= CARGO_MAX * 2) return { ok: false, why: 'Bert’s store room is full of your things.' };
  let n = c.items.length + 1;
  while (c.items.some((it) => it.uid === `c${n}`)) n++;
  const it = { uid: `c${n}`, id, at: 'ashore', x: 0, z: 0, secured: true, full: true };
  c.items.push(it);
  return { ok: true, item: it };
}

// Aboard, strapped down at a spot her deck has room for (the caller finds it: Boat.cargoSpot);
// or ashore again.
export function putAboard(c, uid, kind, spot) {
  const it = c.items.find((i) => i.uid === uid);
  if (!it) return { ok: false, why: 'Not yours.' };
  if (aboard(c, kind).length >= CARGO_MAX) return { ok: false, why: `She has room for ${CARGO_MAX} things on deck.` };
  if (!spot) return { ok: false, why: 'There’s no clear space on her deck for it.' };
  Object.assign(it, { at: `boat:${kind}`, x: spot.x, z: spot.z, secured: true });
  return { ok: true };
}
export function bringAshore(c, uid) {
  const it = c.items.find((i) => i.uid === uid);
  if (!it) return { ok: false, why: 'Not yours.' };
  it.at = 'ashore';
  return { ok: true };
}

// The pieces aboard a boat as one list (with the jerry can when it's aboard her): what the boat
// draws and moves, and what her loads are made of.
export function piecesAboard(c, kind, canAt) {
  const out = aboard(c, kind).map((it) => ({ key: it.uid, id: it.id, x: it.x, z: it.z, secured: it.secured, full: it.full }));
  if (canAt === `boat:${kind}`) out.push({ key: 'can', id: 'can', x: c.can.x, z: c.can.z, secured: c.can.secured, full: true });
  return out;
}
// Back into the save from the boat's own (where her loose things have slid to).
export function storePieces(c, kind, pieces) {
  for (const p of pieces) {
    if (p.key === 'can') Object.assign(c.can, { x: round(p.x), z: round(p.z), secured: !!p.secured });
    else {
      const it = c.items.find((i) => i.uid === p.key && i.at === `boat:${kind}`);
      if (it) Object.assign(it, { x: round(p.x), z: round(p.z), secured: !!p.secured, full: p.full !== false });
    }
  }
}
const round = (v) => Math.round(v * 100) / 100;

// One loose thing on her deck, a step of `dt`: F is what it feels in her own space, per kilogram
// (gravity less her acceleration, and the turn: { x, y, z }, y the push into the deck), and
// `fit(piece, x, z)` puts a spot back on her deck clear of her console and sides, returning it
// ({ x, z }) as it is or moved. Its sliding velocity is kept on the piece (vx, vz). Each axis
// grips on its own (a cylinder lying fore-and-aft rolls across, but slides along only as a box
// would). Returns the speed it hit something at (for the thud), or 0.
export function slide(piece, F, fit, dt) {
  piece.vx ??= 0;
  piece.vz ??= 0;
  if (piece.secured || piece.carried) {
    piece.vx = piece.vz = 0;
    return 0;
  }
  const g = CARGO[piece.id]?.grip || { s: 0.5, k: 0.4 }, N = Math.max(0, F.y);
  const axis = (v, f, mus, muk) => {
    // (Stuck, and the push less than the grip: stays put. Else it slides, the grip against it.)
    if (Math.abs(v) < 0.02 && Math.abs(f) <= mus * N) return -v / Math.max(dt, 1e-3);
    const dir = Math.abs(v) >= 0.02 ? Math.sign(v) : Math.sign(f);
    const a = f - muk * N * dir;
    // (The grip stops it; it never pushes it backwards.)
    if (Math.abs(v) >= 0.02 && Math.sign(v + a * dt) !== Math.sign(v) && Math.abs(f) <= mus * N) return -v / dt;
    return a;
  };
  const rx = g.roll ?? g.k, rxs = g.roll ?? g.s;
  piece.vx += axis(piece.vx, F.x, rxs, rx) * dt;
  piece.vz += axis(piece.vz, F.z, g.s, g.k) * dt;
  // (A little air drag, so nothing outruns the boat.)
  piece.vx *= 1 - Math.min(0.5, 0.2 * dt);
  piece.vz *= 1 - Math.min(0.5, 0.2 * dt);
  const nx = piece.x + piece.vx * dt, nz = piece.z + piece.vz * dt;
  const at = fit(piece, nx, nz);
  // (Against her side or her console: a knock only as it arrives, not while it's pressed there;
  // a hard one bounces it back a little, a soft one stops it.)
  let hit = 0;
  const stopX = Math.abs(at.x - nx) > 1e-6, stopZ = Math.abs(at.z - nz) > 1e-6;
  if (stopX) {
    if (!piece.atX) hit = Math.max(hit, Math.abs(piece.vx));
    piece.vx = Math.abs(piece.vx) > 0.6 ? piece.vx * -0.15 : 0;
  }
  if (stopZ) {
    if (!piece.atZ) hit = Math.max(hit, Math.abs(piece.vz));
    piece.vz = Math.abs(piece.vz) > 0.6 ? piece.vz * -0.15 : 0;
  }
  piece.atX = stopX;
  piece.atZ = stopZ;
  piece.x = at.x;
  piece.z = at.z;
  return hit;
}
