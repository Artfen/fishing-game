// Each boat's own looks, for friends to see her as you made her (docs/HUMAN-TOUCH.md, H1c): her
// paint, stripe, a RIB's tubes, her flag, her name and the fittings you can see on her, by her id
// (a second of a kind kept apart: 'rib~2'). Sent with your name and your look in the session's
// presence (together.js meta), again whenever they change; checked as they come in; and put on a
// friend's boats as the shipyard puts them on yours (main.js applyYard), whether they're riding
// in her, she's lying where they left her, on a towline or on her mother's chocks.
import { PAINTS, FITS, cleanBoatName } from './shipyard.js';
import { flagById } from './papers.js';
import { isBoatId, kindOf } from './boatid.js';

const PAINT_IDS = PAINTS.map((p) => p.id);
// (At most a dozen boats, and sixteen fittings each: a fleet's worth, and no more to send.)
export const BOAT_LOOKS_MAX = 12;
const FITS_MAX = 16;

// Yours, to send: { [id]: { p: paint, s: stripe, t: tubes, f: flag, n: name, ft: [fittings] } },
// only what's set (a boat as built sends nothing). fitsOf(id): the fittings fitted to her.
export function boatLooksOf(yard, ids, fitsOf = () => []) {
  const out = {};
  for (const id of ids.slice(0, BOAT_LOOKS_MAX)) {
    const L = yard?.looks?.[id] || {}, ft = (fitsOf(id) || []).filter((f) => FITS[f]).slice(0, FITS_MAX), o = {};
    if (L.paint) o.p = L.paint;
    if (L.stripe) o.s = L.stripe;
    if (L.tubes) o.t = L.tubes;
    if (L.flag) o.f = L.flag;
    if (L.name) o.n = L.name;
    if (ft.length) o.ft = ft;
    if (Object.keys(o).length) out[id] = o;
  }
  return out;
}

// A friend's, as it comes in: only boat ids of kinds the game has, only colours off the yard's
// chart, flags it knows, a name as a name can be, fittings that exist. Anything else left out.
export function cleanBoatLooks(raw, kinds = null) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw).slice(0, BOAT_LOOKS_MAX)) {
    if (!isBoatId(id) || (kinds && !kinds.includes(kindOf(id))) || !v || typeof v !== 'object' || Array.isArray(v)) continue;
    const o = {};
    for (const k of ['p', 's', 't']) if (PAINT_IDS.includes(v[k])) o[k] = v[k];
    if (flagById[v.f]) o.f = v.f;
    const n = cleanBoatName(v.n);
    if (n) o.n = n;
    if (Array.isArray(v.ft)) {
      const ft = [...new Set(v.ft.filter((f) => typeof f === 'string' && Object.hasOwn(FITS, f)))].slice(0, FITS_MAX);
      if (ft.length) o.ft = ft;
    }
    out[id] = o;
  }
  return out;
}

const hex = (pid) => (pid ? PAINTS.find((p) => p.id === pid)?.hex ?? null : null);

// Put a friend's looks on one of their boats (L null or {}: as she was built), the same calls the
// shipyard makes on yours. Only when they've changed (a boat given back from earlier, a repaint
// while you watch): true if anything was done.
export function dressBoat(b, L) {
  const o = L || {}, sig = JSON.stringify(o);
  if (b.looksSig === sig) return false;
  b.looksSig = sig;
  b.repaint(hex(o.p));
  if ((o.n || '') !== (b.boatName || '')) b.setName(o.n || '');
  b.restripe?.(hex(o.s));
  b.retube?.(hex(o.t));
  if ((b.flagId || null) !== (o.f || null) || o.f === 'own') b.setFlag?.(flagById[o.f] || null, { paint: hex(o.p), stripe: hex(o.s) });
  b.setFits?.(o.ft || []);
  return true;
}
