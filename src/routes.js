// Routes on the chart (C of docs/WORLD-DEPTH.md): a passage planned mark by mark, each leg's
// course and distance, and the whole of it in time and fuel for the boat you'll take, from what
// she does at her cruise (engineTrials.js: measured on the boat herself); then followed at the
// helm, the plotter giving the course and distance to the next mark and moving on to the one
// after as you round it.
//
// state.routes: [{ id, name, pts: [[x, z], …] }] (up to ROUTES_MAX, each up to POINTS_MAX marks);
// state.route: the one you're following, { id, leg } (leg: the mark you're making for), or null.

import { HOUR_SECONDS } from './world/clock.js';

export const ROUTES_MAX = 8;
export const POINTS_MAX = 16;
// (Rounding a mark: within this of it, the next leg begins.)
export const ROUND_M = 35;
export const NM = 1852;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);

// A course, in degrees true (0 north, 90 east), from (x, z) to (x2, z2): north is −z on the chart.
export const courseTo = (x, z, x2, z2) => ((Math.round((Math.atan2(x2 - x, -(z2 - z)) * 180) / Math.PI) % 360) + 360) % 360;
export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// The routes from a save, made sensible.
export function cleanRoutes(raw) {
  const out = [], seen = new Set();
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!isObj(r) || typeof r.id !== 'string' || !/^[a-z0-9-]{1,24}$/.test(r.id) || seen.has(r.id)) continue;
    const pts = (Array.isArray(r.pts) ? r.pts : []).filter(finite).slice(0, POINTS_MAX).map((p) => [Math.round(p[0]), Math.round(p[1])]);
    if (pts.length < 2) continue;
    seen.add(r.id);
    out.push({ id: r.id, name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 30) : `Route ${out.length + 1}`, pts });
    if (out.length >= ROUTES_MAX) break;
  }
  return out;
}
export function cleanActive(raw, routes) {
  if (!isObj(raw)) return null;
  const R = routes.find((r) => r.id === raw.id);
  if (!R) return null;
  return { id: R.id, leg: Number.isInteger(raw.leg) ? Math.min(Math.max(1, raw.leg), R.pts.length - 1) : 1 };
}

// Each leg: from, to, course (degrees) and distance (m); and the whole: metres.
export function legsOf(pts) {
  const legs = [];
  for (let i = 1; i < pts.length; i++) legs.push({ from: pts[i - 1], to: pts[i], course: courseTo(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]), m: dist(pts[i - 1], pts[i]) });
  return { legs, m: legs.reduce((s, l) => s + l.m, 0) };
}

// The passage in time and fuel for a boat: knots (her cruise), lph (litres an hour there), tank
// (litres aboard). Returns { nm, hours, litres, spare } (spare: litres left at the end; under a
// fifth of her tank is cutting it fine).
export function passage(pts, { knots, lph, tank }) {
  const { m } = legsOf(pts);
  const nm = m / NM, hours = knots > 0 ? nm / knots : Infinity, litres = hours * (lph || 0);
  return { nm, hours, litres, spare: tank - litres, fine: tank - litres < tank * 0.2 };
}

// Following a route: where you are (x, z), the leg you're on. Returns { leg, to, course, m, done,
// rounded } (rounded: you just rounded a mark and are on to the next).
export function follow(R, leg, x, z) {
  let L = Math.min(Math.max(1, leg), R.pts.length - 1), rounded = false;
  while (dist([x, z], R.pts[L]) < ROUND_M) {
    if (L === R.pts.length - 1) return { leg: L, to: R.pts[L], course: 0, m: 0, done: true, rounded: true };
    L++;
    rounded = true;
  }
  const to = R.pts[L];
  return { leg: L, to, course: courseTo(x, z, to[0], to[1]), m: dist([x, z], to), done: false, rounded };
}

// A distance in a skipper's words: metres close in, sea miles further off.
export const rangeWords = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / NM).toFixed(m < 10 * NM ? 1 : 0)} nm`);
export const courseWords = (deg) => `${String(deg).padStart(3, '0')}°`;
export const timeWords = (hours) => {
  if (!Number.isFinite(hours)) return '—';
  const min = Math.round(hours * 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
};

// (F2d) The route's day. A route takes the game's day as well as your time at the helm: at the
// clock's HOUR_S seconds a game hour (world/clock.js), a sea mile at six knots is ten minutes at
// the helm and fifteen hours of the day. So a route of any length runs into the night: where she'll
// be when the sun goes down (and whether that's water to anchor in for the night), when a gale due
// will find her, and how many days of stores and ice it wants.
export const HOUR_S = HOUR_SECONDS;
export const KNOT = 1852 / 3600; // metres a second

// Game hours to run `m` metres at `knots`.
export const runHours = (m, knots) => (knots > 0 ? m / (knots * KNOT) / HOUR_S : Infinity);

// Where she is `h` game hours along the route at `knots`: { x, z, leg (the mark she's making for),
// done }.
export function alongAt(pts, knots, h) {
  const { legs } = legsOf(pts);
  let left = h;
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i], lh = runHours(L.m, knots);
    if (left <= lh) {
      const f = lh > 0 ? left / lh : 1;
      return { x: L.from[0] + (L.to[0] - L.from[0]) * f, z: L.from[1] + (L.to[1] - L.from[1]) * f, leg: i + 1, done: false };
    }
    left -= lh;
  }
  const end = pts[pts.length - 1];
  return { x: end[0], z: end[1], leg: pts.length - 1, done: true };
}

// The route's day, leaving at `abs` (game hours) at her `knots`: { hours (of the game's day),
// arrive (abs), days (of stores it wants: whole days begun), dark (where she is at `sunset`, abs,
// if she's still out then: { at, x, z, leg }), gale (where she is when a gale due at `galeAt`
// begins, if she's still out: { at, x, z, leg }) }.
export function routeDay(pts, knots, abs, { sunset = null, galeAt = null } = {}) {
  const hours = legsOf(pts).legs.reduce((s, L) => s + runHours(L.m, knots), 0);
  const at = (t) => (t != null && t > abs && t < abs + hours ? { at: t, ...alongAt(pts, knots, t - abs) } : null);
  return { hours, arrive: abs + hours, days: Math.max(1, Math.ceil(hours / 24 - 1e-9)), dark: at(sunset), gale: at(galeAt) };
}

// The last mark she rounds before `h` game hours where `ok(x, z)` (sheltered water, say), or null:
// { i (the mark's number from 0, the start), x, z }.
export function lastMarkBefore(pts, knots, h, ok) {
  let t = 0, best = ok(pts[0][0], pts[0][1]) ? { i: 0, x: pts[0][0], z: pts[0][1] } : null;
  for (let i = 1; i < pts.length; i++) {
    t += runHours(dist(pts[i - 1], pts[i]), knots);
    if (t > h) break;
    if (ok(pts[i][0], pts[i][1])) best = { i, x: pts[i][0], z: pts[i][1] };
  }
  return best;
}
