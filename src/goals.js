// What there is to aim for, beyond a good day's fishing: every kind of fish, a fish of a lifetime,
// boats of your own, every place on the coast, and the island far to the south. Shown on the
// journal's Days page (see journal.js), counted from what the game already keeps.

import { FISH, fishById } from './fish.js';
import { wildPhotographed, WILD_GOAL } from './watching.js';

const LIVE = FISH.filter((f) => !f.retired);

// state: the save. extra: { places: [found, of] }. Returns [{ id, text, n, of, done }].
export function goalsOf(state, extra = {}) {
  const caught = Object.keys(state.fish || {}).filter((id) => fishById[id] && !fishById[id].retired);
  const of = (water) => LIVE.filter((f) => !water || f.water === water);
  const got = (water) => caught.filter((id) => !water || fishById[id].water === water).length;
  // (A fish of a lifetime: within a tenth of the biggest its kind grows to.)
  const lifetime = caught.some((id) => {
    const sp = fishById[id], best = state.fish[id].best || 0;
    return sp.size[1] >= 30 && best >= sp.size[0] + (sp.size[1] - sp.size[0]) * 0.9;
  });
  const owned = state.yard?.owned?.length ?? 0;
  const [pf, po] = extra.places || [0, 0];
  const list = [
    { id: 'kinds', text: 'Every kind of fish', n: caught.length, of: LIVE.length },
    { id: 'fresh', text: 'Every fresh-water fish', n: got('fresh'), of: of('fresh').length },
    { id: 'salt', text: 'Every sea fish', n: got('salt'), of: of('salt').length },
    { id: 'lifetime', text: 'A fish of a lifetime (as big as its kind grows, near enough)', n: lifetime ? 1 : 0, of: 1 },
    { id: 'boats', text: 'Boats of your own', n: owned, of: extra.boats || 11 },
    { id: 'places', text: 'Every place on the coast found', n: pf, of: po },
    { id: 'brasas', text: 'Across the ocean to Las Brasas', n: state.tips?.brasa ? 1 : 0, of: 1 },
    // (G3) A collection of your own: kinds of wildlife with a photograph of each.
    { id: 'photos', text: 'Wildlife photographed: twenty kinds, a picture of each', n: Math.min(WILD_GOAL, wildPhotographed(state.photos || [])), of: WILD_GOAL },
  ];
  return list.filter((g) => g.of > 0).map((g) => ({ ...g, done: g.n >= g.of }));
}
