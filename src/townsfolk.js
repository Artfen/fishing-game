import { HAVEN_HOUSES, HAVEN_QUAY, HAVEN_MARKET, HAVEN_BENCH, SLIPWAY, STRAND, STACKS, walkHeight, heightAt } from './world/terrain.js';
import { POSADA } from './world/brasa.js';
import { fishById } from './fish.js';
import { seeded } from './util.js';
import { lower } from './innTalk.js';

// The people of Willowhaven (and Paco at Las Brasas), going about their days: what they do hour by
// hour, worked out from the clock and the weather and what the fish are up to, and where that puts
// them. (How they look is world/folk.js; this is only where and what.)
//
//  · Mags Pennock keeps the fish market, five in the morning till seven at night.
//  · Old Bert Hale has the chandlery: a chair by its door on a fine morning.
//  · Ruth Alder keeps The Lobster Pot; out front first thing, sweeping, and a breather on the bench.
//  · Dougie Ferris works lobster pots off Gull Rock from his boat, the Morning Star: out from her
//    mooring at first light, hauling each pot, in at noon to land his catch on the quay. When it's
//    blowing he stays in, mends pots on the apron, and fishes in the lee of the quay instead.
//  · Hettie Moss is the keenest angler on the coast, and goes where the fish are: Shell Strand for
//    the bass at dawn and dusk, the end of the quay when the mackerel are in, the squid under the
//    quay light at night, the sheltered water in a blow. Now and then she lands one.
//  · Kit crabs off the quay on a fine day.
//  · Paco, at Las Brasas, stands in the door of Bar El Muelle.
//
// Everyone walks at a stroll (1.3 m/s, so an hour of the game's clock covers about fifty metres)
// along paths that keep clear of the buildings, walls and clutter (a little grid search over the
// harbour); somewhere further (Shell Strand) they go by bike, out of sight.

export const HOUR_SECONDS = 40;
const WALK = 1.3 * HOUR_SECONDS;  // metres per game hour on foot
const BIKE = 5 * HOUR_SECONDS;
const BOAT = 5 * HOUR_SECONDS;    // the Morning Star at a steady cruise
const SLOW = 1.8 * HOUR_SECONDS;  // round the harbour, and between pots

export const FOLK = {
  mags: { name: 'Mags Pennock', short: 'Mags', role: 'the fishmonger', home: 'gull' },
  bert: { name: 'Old Bert Hale', short: 'Bert', role: 'the chandler', home: 'chandlery' },
  ruth: { name: 'Ruth Alder', short: 'Ruth', role: 'keeps The Lobster Pot', home: 'inn' },
  dougie: { name: 'Dougie Ferris', short: 'Dougie', role: 'the lobsterman', home: 'rose' },
  hettie: { name: 'Hettie Moss', short: 'Hettie', role: 'an angler', home: 'east' },
  kit: { name: 'Kit', short: 'Kit', role: 'a boy who fishes off the quay', home: 'net' },
  paco: { name: 'Paco', short: 'Paco', role: 'Bar El Muelle', home: 'paco', south: true },
};
export const FOLK_IDS = Object.keys(FOLK);

const house = (id) => HAVEN_HOUSES.find((b) => b.id === id);
const local = (b, lx, lz) => {
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
};
const doorOf = (id, out = 1.2) => {
  const b = house(id);
  const p = local(b, id === 'chandlery' ? -1.4 : 0, b.d / 2 + out);
  return { x: p.x, z: p.z, yaw: b.yaw };
};
const Q = HAVEN_QUAY, M = HAVEN_MARKET;

// Where people go, and which way they face there (yaw: 0 is +z, towards the bay).
export const SPOTS = {
  rose: doorOf('rose'), gull: doorOf('gull'), net: doorOf('net'),
  inn: { ...doorOf('inn', 0.5), yaw: 0 },
  innFront: { x: 9.6, z: -99.6, yaw: 0.4 },
  chandlery: doorOf('chandlery', 0.6),
  chair: { x: -4.2, z: -100.6, yaw: 0 },
  slab: { x: M.x, z: M.z - 0.7, yaw: 0 },
  bench: { x: HAVEN_BENCH.x - 0.4, z: HAVEN_BENCH.z + 0.45, yaw: 0 },
  pots: { x: 3.4, z: -98.5, yaw: -2.4 },
  quayEnd: { x: 9.3, z: Q.z1 - 1.5, yaw: 0 },
  crab: { x: Q.x1 - 0.12, z: -88.2, yaw: Math.PI / 2 },
  lee: { x: Q.x0 + 0.35, z: -91.8, yaw: -Math.PI / 2 },
  slipway: { x: SLIPWAY.x + 0.2, z: -92.5, yaw: 0 },
  east: { x: 27.2, z: -95.6, yaw: Math.PI / 2 },
  strand: { x: STRAND.x - 1, z: STRAND.z + 4.5, yaw: 0 },
  paco: { x: POSADA.x - 1.2, z: POSADA.z + 5.8, yaw: 0 },
};
// Places reached by bike (out of sight on the way), not on foot.
const FAR = new Set(['strand']);
// Where someone fishes, in words.
const WHERE = { strand: 'on Shell Strand', quayEnd: 'off the end of the quay', slipway: 'by the slipway', lee: 'in the lee of the quay' };

// Dougie's boat: her mooring off the quay, where she lands at the quay's end, and the pots.
export const MOORING = { x: 17, z: -79.6, heading: Math.PI };
export const LANDING = { x: Q.x1 + 1.45, z: Q.z1 - 3.2, heading: Math.PI };
const G = STACKS[0];
export const POTS = [[G.x + 18, G.z - 8], [G.x + 28, G.z + 17], [G.x + 8, G.z + 32], [G.x - 17, G.z + 27], [G.x - 27, G.z + 2]].map(([x, z]) => ({ x, z }));
export const ROUTE_OUT = [[MOORING.x, MOORING.z], [24, -60], [32, -30], [30, 10], [5, 55], [-25, 85], [POTS[0].x, POTS[0].z]].map(([x, z]) => ({ x, z }));

/* ---- the paths round the harbour ---- */

const GRID = { x0: -32, x1: 40, z0: -118, z1: -79, s: 0.5 };
export class Paths {
  constructor(obstacles) {
    const G0 = GRID;
    this.nx = Math.round((G0.x1 - G0.x0) / G0.s) + 1;
    this.nz = Math.round((G0.z1 - G0.z0) / G0.s) + 1;
    this.free = new Uint8Array(this.nx * this.nz);
    this.h = new Float32Array(this.nx * this.nz);
    const near = obstacles.filter((o) => o.x > G0.x0 - 3 && o.x < G0.x1 + 3 && o.z > G0.z0 - 3 && o.z < G0.z1 + 3);
    for (let i = 0; i < this.nx; i++) {
      for (let k = 0; k < this.nz; k++) {
        const x = G0.x0 + i * G0.s, z = G0.z0 + k * G0.s;
        const h = walkHeight(x, z);
        this.h[k * this.nx + i] = h;
        let ok = h > 0.25;
        if (ok) for (const o of near) if (Math.hypot(x - o.x, z - o.z) < o.r + 0.32) { ok = false; break; }
        this.free[k * this.nx + i] = ok ? 1 : 0;
      }
    }
    // Too steep to walk: a step of more than ~0.9 m per metre to any neighbour.
    const steep = new Uint8Array(this.free);
    for (let i = 1; i < this.nx - 1; i++) {
      for (let k = 1; k < this.nz - 1; k++) {
        const c = k * this.nx + i;
        if (!this.free[c]) continue;
        for (const d of [1, -1, this.nx, -this.nx]) if (Math.abs(this.h[c] - this.h[c + d]) > 0.9 * G0.s * 1.35) steep[c] = 0;
      }
    }
    this.free = steep;
  }
  cell(x, z) {
    const i = Math.round((x - GRID.x0) / GRID.s), k = Math.round((z - GRID.z0) / GRID.s);
    return i >= 0 && k >= 0 && i < this.nx && k < this.nz ? k * this.nx + i : -1;
  }
  ok(x, z) {
    const c = this.cell(x, z);
    return c >= 0 && !!this.free[c];
  }
  // The nearest walkable cell to (x, z).
  snap(x, z) {
    if (this.ok(x, z)) return { x, z };
    for (let r = GRID.s; r < 6; r += GRID.s) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos((a / 16) * Math.PI * 2) * r, pz = z + Math.sin((a / 16) * Math.PI * 2) * r;
        if (this.ok(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }
  // A clear line between two points (sampled every quarter metre)?
  clear(a, b) {
    const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(L / 0.25);
    for (let i = 1; i < n; i++) if (!this.ok(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
    return true;
  }
  // The way from a to b: a search over the grid, then pulled straight between corners.
  route(a, b) {
    const s = this.snap(a.x, a.z), e = this.snap(b.x, b.z);
    const start = this.cell(s.x, s.z), goal = this.cell(e.x, e.z);
    if (start < 0 || goal < 0) return [a, b];
    if (this.clear(s, e)) return [a, ...(s.x !== a.x || s.z !== a.z ? [s] : []), ...(e.x !== b.x || e.z !== b.z ? [e] : []), b];
    const nx = this.nx, N = this.free.length;
    const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
    const gi = goal % nx, gk = Math.floor(goal / nx);
    const hh = (c) => {
      const dx = Math.abs((c % nx) - gi), dz = Math.abs(Math.floor(c / nx) - gk);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    // (A small binary heap of [f, cell].)
    const heap = [];
    const push = (f, c) => {
      heap.push([f, c]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    g[start] = 0;
    push(hh(start), start);
    const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false;
    while (heap.length) {
      const [, c] = pop();
      if (shut[c]) continue;
      shut[c] = 1;
      if (c === goal) {
        found = true;
        break;
      }
      const ci = c % nx, ck = Math.floor(c / nx);
      for (const [di, dk, w] of STEPS) {
        const i = ci + di, k = ck + dk;
        if (i < 0 || k < 0 || i >= nx || k >= this.nz) continue;
        const n = k * nx + i;
        if (!this.free[n] || shut[n]) continue;
        if (di && dk && (!this.free[ck * nx + i] || !this.free[k * nx + ci])) continue;
        const ng = g[c] + w;
        if (ng < g[n]) {
          g[n] = ng;
          came[n] = c;
          push(ng + hh(n), n);
        }
      }
    }
    if (!found) return [a, b];
    const cells = [];
    for (let c = goal; c >= 0; c = came[c]) cells.push({ x: GRID.x0 + (c % nx) * GRID.s, z: GRID.z0 + Math.floor(c / nx) * GRID.s });
    cells.reverse();
    // String-pulling: from each corner, on to the furthest point in clear sight.
    const out = [a];
    let at = s;
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && !this.clear(at, cells[j])) j--;
      at = cells[j];
      out.push(at);
      i = j;
    }
    out.push(b);
    return out;
  }
}
export const pathLength = (P) => P.reduce((L, p, i) => (i ? L + Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z) : 0), 0);
// The point (and heading) a distance s along a path.
export function along(P, s) {
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], L = Math.hypot(b.x - a.x, b.z - a.z);
    if (s <= L || i === P.length - 1) {
      const k = L > 0 ? Math.min(1, Math.max(0, s / L)) : 1;
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    s -= L;
  }
  const p = P[P.length - 1];
  return { x: p.x, z: p.z, yaw: 0 };
}

/* ---- their days ---- */

// A day's dice, the same for everyone who asks.
const dayDice = (day, salt) => seeded(day * 7919 + salt)();
// Will Dougie go out? Not in a storm, a gale or a downpour.
export const fitForSea = (ctx) => (ctx.storm ?? 0) < 0.3 && (ctx.wind ?? 0) < 11 && (ctx.rain ?? 0) < 0.85;
const fair = (ctx) => (ctx.storm ?? 0) < 0.25 && (ctx.rain ?? 0) < 0.3;

// Where Hettie goes, for the stretch of the day starting at `hour`: { spot, target (what she's
// after), why } (or null: home).
export function hettieMark(hour, ctx) {
  const about = ctx.about || [];
  if (hour >= 1 && hour < 4.5) return null;
  if ((ctx.storm ?? 0) >= 0.35) return { spot: 'lee', target: 'flounder', why: 'in the lee of the quay, out of the wind' };
  if ((ctx.rain ?? 0) > 0.75) return null;
  if ((hour >= 4.5 && hour < 8) || (hour >= 18 && hour < 21.5)) return { spot: 'strand', target: 'seabass', why: 'on Shell Strand after the bass' };
  if (hour >= 21.5 || hour < 1) return { spot: 'quayEnd', target: 'squid', why: 'under the quay light, jigging for squid' };
  const top = about.find((a) => ['mackerel', 'garfish', 'bonito', 'horsemackerel', 'bluefish'].includes(a.id));
  if (top) return { spot: 'quayEnd', target: top.id, why: `on the end of the quay: the ${lower(top.name)} are in` };
  return { spot: 'slipway', target: 'flounder', why: 'down by the slipway, a worm out on the sand for flounder' };
}

// What someone is doing at `hour` (a block of the day): { key, until, spot, act } where act is
// 'stand' | 'sit' | 'work' | 'fish' | 'crab' | 'inside' (gone in at the spot's door) | 'boat'.
export function blockFor(id, hour, ctx, day) {
  const h = hour;
  const B = (key, until, spot, act, extra = {}) => ({ key: `${day}:${key}`, until, spot, act, ...extra });
  switch (id) {
    case 'mags':
      if (h >= 4.2 && h < 19) return B('slab', 19, 'slab', 'work');
      if (h >= 19 && h < 21.5 && dayDice(day, 1) < 0.6) return B('pub', 21.5, 'inn', 'inside');
      return B('home', h < 4.2 ? 4.2 : 28.2, 'gull', 'inside');
    case 'bert':
      if (h >= 7.5 && h < 10.5) return fair(ctx) ? B('chair-am', 10.5, 'chair', 'sit') : B('shop-am', 10.5, 'chandlery', 'inside');
      if (h >= 15 && h < 17.5) return fair(ctx) ? B('chair-pm', 17.5, 'chair', 'sit') : B('shop-pm', 17.5, 'chandlery', 'inside');
      if (h >= 19 && h < 22) return B('pub', 22, 'inn', 'inside');
      return B(`shop-${Math.floor(h)}`, h < 7.5 ? 7.5 : h < 15 ? 15 : h < 19 ? 19 : 31.5, 'chandlery', 'inside');
    case 'ruth':
      if (h >= 7.5 && h < 8.3) return B('sweep', 8.3, 'innFront', 'work');
      if (h >= 14.5 && h < 15.3 && (ctx.rain ?? 0) < 0.3 && (ctx.storm ?? 0) < 0.3) return B('bench', 15.3, 'bench', 'sit');
      if (h >= 22.5 && h < 23) return B('time', 23, 'inn', 'stand');
      return B(`in-${h < 7.5 ? 0 : h < 14.5 ? 1 : h < 22.5 ? 2 : 3}`, h < 7.5 ? 7.5 : h < 14.5 ? 14.5 : h < 22.5 ? 22.5 : 31.5, 'inn', 'inside');
    case 'dougie': {
      if (h < 5) return B('night', 5, 'rose', 'inside');
      if (h >= 19 && h < 22) return B('pub', 22, 'inn', 'inside');
      if (h >= 22) return B('home', 29, 'rose', 'inside');
      // Out to the pots at first light, if the weather lets him.
      if (h >= 5 && h < 5.6) return fitForSea(ctx) ? B('down', 5.6, 'slipway', 'stand', { sea: true }) : B('lie-in', 7.5, 'rose', 'inside');
      if (h >= 5.6 && h < 12.4 && ctx.trip) return B('trip', 12.4, 'slipway', 'boat');
      if (h < 7.5) return B('lie-in', 7.5, 'rose', 'inside');
      if (h < 12) return B('mend-am', 12, 'pots', 'work');
      if (h < 13.5) return B('lunch', 13.5, 'inn', 'inside');
      if (h < 17.5) return (ctx.storm ?? 0) >= 0.3 || !fitForSea(ctx) ? B('lee', 17.5, 'lee', 'fish', { target: 'flounder' }) : B('mend-pm', 17.5, 'pots', 'work');
      return B('bench', 19, 'bench', (ctx.rain ?? 0) > 0.3 ? 'stand' : 'sit');
    }
    case 'hettie': {
      // Her day in stretches; where she goes for each depends on the hour, the weather and the fish.
      const s0 = h < 1 ? 21.5 : [21.5, 18, 13, 12, 8, 4.5, 1].find((s) => h >= s);
      const until = { 1: 4.5, 4.5: 8, 8: 12, 12: 13, 13: 18, 18: 21.5, 21.5: 25 }[s0];
      if (s0 === 12) return B('lunch', until, 'inn', 'inside');
      const mark = hettieMark(s0, ctx);
      if (!mark) return B(`home-${s0}`, until, 'east', 'inside');
      return B(`${mark.spot}-${s0}`, until, mark.spot, 'fish', { target: mark.target, why: mark.why });
    }
    case 'kit':
      if (fair(ctx) && ((h >= 9.5 && h < 12) || (h >= 16 && h < 18.5))) return B(`crab-${h < 12 ? 'am' : 'pm'}`, h < 12 ? 12 : 18.5, 'crab', 'crab');
      return B(`home-${h < 9.5 ? 0 : h < 16 ? 1 : 2}`, h < 9.5 ? 9.5 : h < 16 ? 16 : 33.5, 'net', 'inside');
    case 'paco':
      if (h >= 8 && h < 23.5) return B('door', 23.5, 'paco', 'stand');
      return B('in', h < 8 ? 8 : 32, 'paco', 'inside');
  }
  return B('none', 99, 'inn', 'inside');
}

/* ---- the Morning Star's day at the pots ---- */

// Her trip as a list of legs: [{ kind: 'prep' | 'go' | 'haul' | 'land', path?, speed?, hours?,
// pot? }]: a timeline from the moment Dougie is aboard.
export function tripLegs() {
  const legs = [{ kind: 'prep', hours: 0.5 }];
  legs.push({ kind: 'go', path: ROUTE_OUT, speed: BOAT });
  POTS.forEach((p, i) => {
    if (i) legs.push({ kind: 'go', path: [POTS[i - 1], p], speed: SLOW });
    legs.push({ kind: 'haul', hours: 0.35, pot: i });
  });
  const home = [...ROUTE_OUT].reverse().slice(1, -1);
  legs.push({ kind: 'go', path: [POTS[POTS.length - 1], { x: -25, z: 85 }, ...home.slice(1), { x: LANDING.x + 2, z: LANDING.z + 8 }, { x: LANDING.x, z: LANDING.z }], speed: BOAT });
  legs.push({ kind: 'land', hours: 0.45 });
  legs.push({ kind: 'go', path: [{ x: LANDING.x, z: LANDING.z }, { x: MOORING.x, z: MOORING.z }], speed: SLOW });
  for (const L of legs) if (L.path) L.len = pathLength(L.path), L.hours = L.len / L.speed;
  return legs;
}
export const TRIP_HOURS = tripLegs().reduce((s, L) => s + L.hours, 0);

/* ---- everyone together ---- */

export class Townsfolk {
  // obstacles: the coast's (see world/coast.js), for the paths.
  constructor({ obstacles = [] } = {}) {
    this.paths = new Paths(obstacles);
    this.people = {};
    for (const id of FOLK_IDS) this.people[id] = { id, pos: { ...SPOTS[FOLK[id].home] }, yaw: 0, act: 'inside', block: null, path: null, t0: 0, len: 0, away: 0, liftT: 0, said: 0 };
    this.legs = tripLegs();
    this.boat = { x: MOORING.x, z: MOORING.z, heading: MOORING.heading, speed: 0, aboard: false, leg: null, hauling: false };
    this.trip = null;     // { t0 (game hours when Dougie came aboard), cut (storm: straight in) }
    this.landed = [];     // today's fish off the rod: { who, name, size, where (in words), day, hour }
    this.haul = null;     // Dougie's pots today: { day, hour, text }
    this.abs = null;
  }

  // abs: the game's clock in hours (day × 24 + hour); ctx: { storm, rain, wind, about: [{ id,
  // name, act }], activity: { species id: 0 … 1 } }.
  update(abs, ctx = {}) {
    if (this.abs == null || abs < this.abs || abs - this.abs > 48) this.place(abs, ctx);
    // In small steps, so a long sleep plays out the same as a day watched.
    while (this.abs < abs) {
      const to = Math.min(abs, this.abs + 0.05);
      this.step(to, ctx);
      this.abs = to;
    }
  }

  // Everyone straight to where they'd be at this hour (a game loaded, or a new day begun): no
  // walking there from home. Dougie's boat is out if it's the hour for it and the weather lets her.
  place(abs, ctx) {
    const day = Math.floor(abs / 24), hour = abs - day * 24;
    this.trip = hour >= 5.6 && hour < 5.6 + TRIP_HOURS && fitForSea(ctx) ? { t0: day * 24 + 5.6, cut: false } : null;
    if (this.trip) this.trip.counted = {};
    for (const id of FOLK_IDS) {
      const p = this.people[id];
      const b = blockFor(id, hour, id === 'dougie' ? { ...ctx, trip: !!this.trip } : ctx, day);
      p.block = b;
      p.path = null;
      p.away = 0;
      p.t0 = abs;
      p.lastCatch = abs;
      p.pos = { ...SPOTS[b.spot] };
      p.yaw = SPOTS[b.spot].yaw;
      p.act = b.act === 'boat' ? 'aboard' : b.act;
    }
    this.abs = abs - 0.001;
  }

  step(abs, ctx) {
    const day = Math.floor(abs / 24), hour = abs - day * 24;
    this.landed = this.landed.filter((l) => l.day === day);
    // Dougie's trip: decided when he goes down to the slipway, run on its own clock.
    if (this.trip && abs - this.trip.t0 > TRIP_HOURS + 0.5) this.trip = null;
    const dctx = { ...ctx, trip: !!this.trip };
    for (const id of FOLK_IDS) {
      const p = this.people[id];
      const b = blockFor(id, hour, id === 'dougie' ? dctx : ctx, day);
      if (!p.block || b.key !== p.block.key) this.begin(p, b, abs, ctx);
      this.move(p, abs, ctx, day);
    }
    this.sail(abs, ctx, day);
  }

  begin(p, b, abs, ctx) {
    const was = p.block;
    p.block = b;
    p.t0 = abs;
    p.lastCatch = abs;
    // (Dougie, down to the slipway at first light: he rows out to her, and she's away by 5:40.)
    if (b.sea && !this.trip) this.trip = { t0: Math.max(abs + 0.3, Math.floor(abs / 24) * 24 + 5.6), cut: false };
    // Back from the boat: he rows ashore to the slipway, then walks on from there.
    if (was?.act === 'boat' && p.act === 'aboard') {
      p.pos = { ...SPOTS.slipway };
      p.away = abs + 0.2;
      p.t0 = abs + 0.2;
    }
    const S = SPOTS[b.spot];
    if (FOLK[p.id].south) {
      p.path = null;
      p.pos = { ...S };
      return;
    }
    // Somewhere far: out of sight, by bike, for as long as the ride takes.
    const from = p.pos;
    if (FAR.has(b.spot) || (was && FAR.has(was.spot))) {
      p.path = null;
      p.away = abs + Math.hypot(S.x - from.x, S.z - from.z) / BIKE;
      return;
    }
    if (!(p.away > abs)) p.away = 0;
    p.path = Math.hypot(S.x - from.x, S.z - from.z) < 0.3 ? null : this.paths.route(from, S);
    p.len = p.path ? pathLength(p.path) : 0;
  }

  move(p, abs, ctx, day) {
    const b = p.block, S = SPOTS[b.spot];
    // Aboard the Morning Star (see sail).
    if (b.act === 'boat' && this.trip && abs >= this.trip.t0) {
      p.act = 'aboard';
      p.pos = { x: this.boat.x, z: this.boat.z };
      return;
    }
    if (p.away > abs) {
      p.act = 'away';
      return;
    }
    if (p.away && p.away <= abs && FAR.has(b.spot)) {
      p.pos = { x: S.x, z: S.z };
      p.away = 0;
    }
    if (p.path) {
      const s = (abs - p.t0) * WALK;
      if (s < p.len) {
        const q = along(p.path, s);
        p.pos = { x: q.x, z: q.z };
        p.yaw = q.yaw;
        p.act = 'walk';
        return;
      }
      p.path = null;
      p.pos = { x: S.x, z: S.z };
    }
    p.pos = { x: S.x, z: S.z };
    p.yaw = S.yaw;
    p.act = b.act === 'boat' ? 'stand' : b.act;
    // Hettie (and Dougie in the lee of the quay): now and then, a fish.
    if (b.act === 'fish' && b.target && abs - p.lastCatch >= 0.5) {
      const slot = Math.floor(abs * 2);
      p.lastCatch = abs;
      const act = ctx.activity?.[b.target] ?? 0.5;
      const r = seeded(slot * 131 + (p.id === 'hettie' ? 7 : 3))();
      if (r < 0.06 + 0.22 * act) {
        const sp = fishById[b.target];
        if (sp) {
          const rs = seeded(slot * 17 + 5)();
          const size = Math.round(sp.size[0] + (sp.size[1] - sp.size[0]) * (0.15 + 0.6 * rs * rs));
          p.liftT = abs + 0.08;
          this.landed.push({ who: FOLK[p.id].name.split(' ')[0], name: sp.name, size, k: (size - sp.size[0]) / (sp.size[1] - sp.size[0]), where: WHERE[b.spot] || '', day, hour: abs - day * 24 });
          if (this.landed.length > 8) this.landed.shift();
        }
      }
    }
    if (p.liftT > abs) p.act = 'lift';
  }

  // The Morning Star: on her mooring, or out on her trip (from the moment Dougie is aboard).
  sail(abs, ctx, day) {
    const B = this.boat;
    B.aboard = false;
    B.speed = 0;
    B.leg = null;
    B.hauling = false;
    const T = this.trip;
    if (!T || abs < T.t0) {
      Object.assign(B, { x: MOORING.x, z: MOORING.z, heading: MOORING.heading });
      return;
    }
    // A blow coming on while she's at the pots: she leaves the rest and comes straight in.
    let t = abs - T.t0;
    B.aboard = true;
    let i = 0;
    const legs = this.legs;
    const inLeg = legs.findIndex((L, k) => k > 2 && L.kind === 'go' && L.path.length > 2);
    if (!T.cut && (ctx.storm ?? 0) >= 0.45) {
      let acc = 0;
      for (let k = 0; k < inLeg; k++) acc += legs[k].hours;
      if (t > legs[0].hours + legs[1].hours && t < acc) {
        T.cut = true;
        T.cutAt = t;
        T.skip = acc - t;
      }
    }
    if (T.cut && t >= T.cutAt) t += T.skip;
    for (; i < legs.length; i++) {
      const L = legs[i];
      if (t < L.hours) break;
      t -= L.hours;
      // (Landing her catch on the quay: the morning's haul, told round the harbour.)
      if (L.kind === 'haul' && !T.counted?.[L.pot]) {
        T.counted ??= {};
        T.counted[L.pot] = true;
      }
    }
    if (i >= legs.length) {
      // Back on her mooring: Dougie rows ashore.
      Object.assign(B, { x: MOORING.x, z: MOORING.z, heading: MOORING.heading, aboard: false });
      return;
    }
    const L = legs[i];
    B.leg = L.kind;
    if (L.kind === 'go') {
      const q = along(L.path, (t / L.hours) * L.len);
      const ahead = along(L.path, Math.min(L.len, (t / L.hours) * L.len + 2));
      Object.assign(B, { x: q.x, z: q.z, heading: Math.atan2(ahead.x - q.x, ahead.z - q.z) || B.heading, speed: L.speed / HOUR_SECONDS });
    } else if (L.kind === 'prep') Object.assign(B, { x: MOORING.x, z: MOORING.z, heading: MOORING.heading });
    else if (L.kind === 'haul') {
      Object.assign(B, { x: POTS[L.pot].x, z: POTS[L.pot].z });
      B.hauling = true;
    } else if (L.kind === 'land') {
      Object.assign(B, { x: LANDING.x, z: LANDING.z, heading: LANDING.heading });
      if (!T.landed) {
        T.landed = true;
        const pots = Object.keys(T.counted || {}).length;
        const lobsters = Math.max(1, Math.round(pots * (1.2 + 1.6 * dayDice(day, 9))));
        const crab = Math.round(pots * (1 + 2 * dayDice(day, 11)));
        const conger = dayDice(day, 13) < 0.25;
        this.haul = { day, hour: abs - day * 24, text: `Dougie landed his pots this morning: ${lobsters} lobster${lobsters > 1 ? 's' : ''}${crab ? ` and ${crab} brown crab` : ''}${conger ? ', and a conger as long as his arm that had got into one of them' : ''}.${T.cut ? ' He came in early, before the blow.' : ''}` };
      }
    }
  }

  // What's being said about the harbour's own people today (for the bar), every word of it true:
  // where they are and what they're at, Dougie's catch, and the best fish anyone's had today.
  news(hour) {
    const out = [];
    const day = Math.floor((this.abs ?? 0) / 24);
    if (this.haul?.day === day) out.push(this.haul.text);
    const best = this.landed.filter((l) => l.day === day).sort((a, b) => b.k - a.k)[0];
    if (best && best.k > 0.35) out.push(`${best.who} had a good ${lower(best.name)} ${best.where} ${best.hour < 12 ? 'this morning' : best.hour < 18 ? 'this afternoon' : 'this evening'}: ${best.size} cm.`);
    const D = this.people.dougie, H = this.people.hettie, K = this.people.kit;
    if (this.boat.aboard && this.boat.leg && this.boat.leg !== 'land') out.push(this.trip?.cut ? 'Dougie’s on his way in: he left the rest of his pots when the wind got up.' : 'Dougie’s out at his pots off Gull Rock. He’ll be in about noon to land them.');
    else if (D.block?.spot === 'pots' && D.act !== 'walk') out.push('Dougie’s not going out today: he’s on the quay mending pots.');
    else if (D.block?.spot === 'lee') out.push('Dougie’s fishing in the lee of the quay: no going out to the pots in this.');
    if (H.block?.why && (H.act === 'fish' || H.act === 'lift' || H.act === 'walk' || H.act === 'away')) out.push(`Hettie’s ${H.block.why}.`);
    if (K.act === 'crab') out.push(hour < 12.5 ? 'Kit’s been crabbing off the quay all morning.' : 'Kit’s back on the quay with his crab line.');
    return out;
  }

  // Someone within reach of (x, z), on foot and to be talked to.
  near(x, z, r = 2.2) {
    let best = null, bd = r;
    for (const p of Object.values(this.people)) {
      if (p.act === 'inside' || p.act === 'away' || p.act === 'aboard') continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < bd) [best, bd] = [p, d];
    }
    return best;
  }
}

// A word from someone you walk up to: what they're doing, and something useful or kind.
export function sayTo(p, { hour = 12, storm = 0, wanted = [], caught = 0, landed = [] } = {}) {
  const act = p.act, b = p.block || {};
  switch (p.id) {
    case 'mags':
      if (act === 'walk') return 'Can’t stop, love: the boats’ll be in.';
      return wanted.length ? `“Morning! I’m after ${wanted.map((n) => lower(n)).join(' and ')} today: bring me some and I’ll pay you half as much again.”` : '“What have you got for me, then?”';
    case 'bert':
      return act === 'sit' ? '“Sit down a minute? No? Well, mind you keep your line fresh. A frayed line loses you the fish of the day, and you never forget that one.”' : '“The tackle’s through there, same as always. Help yourself.”';
    case 'ruth':
      return act === 'sit' ? '“Five minutes’ peace. Don’t tell anyone I’m out here.”' : act === 'work' ? '“Morning! Fish pie tonight, if you’re hungry. And I’m always after a good fish for the kitchen.”' : '“Last orders! Come on, haven’t you got homes to go to?”';
    case 'dougie': {
      if (b.spot === 'lee') return '“Nothing doing out there in this. In here, out of the wind, there’s always a flounder or two on the bottom.”';
      if (b.spot === 'pots') return storm > 0.3 ? '“No going out in this. I’ll have these mended by the time it blows through.”' : '“Pots don’t mend themselves. Off Gull Rock tomorrow, first light.”';
      return '“Been out since first light. Lobsters were walking this morning.”';
    }
    case 'hettie': {
      const mine = landed.filter((l) => l.who === 'Hettie');
      const last = mine[mine.length - 1];
      const tgt = fishById[b.target] ? lower(fishById[b.target].name) : null;
      if (last) return `“Had ${mine.length > 1 ? `${mine.length} so far` : 'one'}: the best a ${last.size} cm ${lower(last.name)}. ${b.spot === 'strand' ? 'Fish the white water, where the waves break.' : b.spot === 'quayEnd' ? 'Straight out off the end, let it sink a bit.' : 'Patience. Let the bait sit.'}”`;
      return tgt ? `“I’m after ${tgt}. Nothing yet, but they’ll come.”` : '“Lovely day for it.”';
    }
    case 'kit':
      return caught > 0 ? '“I’ve caught loads of crabs! Gran says I’ve to put them all back.”' : '“Bacon’s the best bait for crabs. Everybody knows that.”';
    case 'paco':
      return hour < 12 ? '“¡Buenos días! Coffee? The boats are out at El Bajón.”' : '“¡Hola! A cold caña? Sit, sit.”';
  }
  return '';
}
