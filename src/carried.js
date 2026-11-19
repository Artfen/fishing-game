// The tender carried on her mother's swim platform (L5 of docs/LIVEABOARD.md). An owned boat is in
// exactly one place at a time: in the water, laid up, on the trailer, on the supply ship, or
// carried. Each of those is its own slot in the save (afloat is where none of the others has her);
// whereIs is the one place that says which. Carried is its own slot, state.carried (tender's id →
// her mother's id), not "stowed": that word already means laid up or on the trailer.
//
// Pure: the game (main.js) places a carried tender on her mother's chocks each frame, as a boat on
// the trailer is placed behind the car, and puts her weight on her mother (loadsOf).
import { isBoatId } from './boatid.js';
import { $t } from './i18n.js';

// The kinds that ride on a platform, and the kinds with a platform to carry one.
export const TENDERS = ['tender'];
export const MOTHERS = ['trawler'];
// Her weight on the chocks, hull and outboard ready to go (kg; her fuel on top of it).
export const TENDER_KG = 150;

// Where one of your boats is: 'carried', 'trailer', 'shipping', 'stored' (laid up) or 'afloat'.
// S: the state's slots ({ carried, trailer, shipping, stored }).
export function whereIs(id, S) {
  if (S.carried?.[id]) return 'carried';
  if (S.trailer?.boat === id) return 'trailer';
  if ((S.shipping || []).some((x) => x.kind === id)) return 'shipping';
  if ((S.stored || []).includes(id)) return 'stored';
  return 'afloat';
}
// The tender a mother carries (her id), or null.
export const carriedOn = (S, mother) => Object.keys(S.carried || {}).find((t) => S.carried[t] === mother) || null;

// The carried slot from a save, made sensible: a tender of yours on a mother of yours (owned: the
// ids you own), one to a platform. A tender left out (her mother isn't yours any more, or isn't
// there) is laid up instead: see settle.
export function cleanCarried(raw, owned) {
  const out = {}, used = new Set();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [t, m] of Object.entries(raw).slice(0, 8)) {
    if (!isBoatId(t, TENDERS) || !owned.includes(t) || !isBoatId(m, MOTHERS) || !owned.includes(m) || used.has(m)) continue;
    out[t] = m;
    used.add(m);
  }
  return out;
}

// One place at a time, settled the same way every time: carried, then afloat, then laid up. A
// carried tender comes off the trailer, the supply ship and the laid-up list; one the save had
// carried whose mother is gone (dropped: her ids) is laid up. Returns a word for each, for the
// game to say (never deleted: always somewhere).
export function settle(S, dropped = []) {
  const said = [];
  for (const t of Object.keys(S.carried || {})) {
    if (S.trailer?.boat === t) {
      S.trailer.boat = null;
      said.push($t`${t}: on her mother’s platform, not the trailer`);
    }
    if ((S.shipping || []).some((x) => x.kind === t)) {
      S.shipping = S.shipping.filter((x) => x.kind !== t);
      said.push($t`${t}: on her mother’s platform, not the supply ship`);
    }
    if (Array.isArray(S.stored) && S.stored.includes(t)) {
      S.stored = S.stored.filter((x) => x !== t);
      said.push($t`${t}: on her mother’s platform, not laid up`);
    }
  }
  for (const t of dropped) {
    if (!Array.isArray(S.stored) || S.stored.includes(t) || S.trailer?.boat === t) continue;
    S.stored.push(t);
    said.push($t`${t}: her mother gone, laid up at Willowhaven`);
  }
  return said;
}
