// Routes on the chart (C of docs/WORLD-DEPTH.md): a passage planned mark by mark, each leg's
// course and distance, and the whole of it in time and fuel for the boat you'll take, from what
// she does at her cruise (engineTrials.js: measured on the boat herself); then followed at the
// helm, the plotter giving the course and distance to the next mark and moving on to the one
// after as you round it.
//
// state.routes: [{ id, name, pts: [[x, z], …] }] (up to ROUTES_MAX, each up to POINTS_MAX marks);
// state.route: the one you're following, { id, leg } (leg: the mark you're making for), or null.

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
