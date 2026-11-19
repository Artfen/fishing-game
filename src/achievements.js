// Achievements for the desktop (Steam) build: the game's own milestones, each under a stable API
// name to set up in Steamworks with the same name, title and line. Counted from the save, so they
// can be (re)reported any time: on Steam an achievement already unlocked stays unlocked, and one
// earned before the desktop build existed is reported the first time it's played there.
//
// Nothing here talks to anything: desktop.js hands the list to the desktop app, which hands it to
// Steamworks if (and only if) the app was built with it and an app id.

import { GIVEN_IN_FREE } from './playmode.js';
import { goalsOf } from './goals.js';
import { career } from './contracts.js';
import { finished as storyFinished } from './story.js';
import { $t } from './i18n.js';

export const ACHIEVEMENTS = [
  { id: 'FIRST_FISH', title: $t('A fish on the line'), text: $t('Land your first fish.'), got: (s) => Object.keys(s.fish || {}).length > 0 },
  { id: 'TEN_KINDS', title: $t('Ten kinds'), text: $t('Catch ten different kinds of fish.'), got: (s) => Object.keys(s.fish || {}).length >= 10 },
  { id: 'ALL_KINDS', title: $t('Every kind of fish'), text: $t('Catch every kind of fish there is.'), goal: 'kinds' },
  { id: 'LIFETIME', title: $t('A fish of a lifetime'), text: $t('Land a fish as big as its kind grows, near enough.'), goal: 'lifetime' },
  { id: 'PLACES', title: $t('Every place on the coast'), text: $t('Find every place on the coast.'), goal: 'places' },
  { id: 'LAS_BRASAS', title: $t('Across the ocean'), text: $t('Make the crossing to Las Brasas.'), goal: 'brasas' },
  { id: 'FLEET', title: $t('A fleet of your own'), text: $t('Own every boat at the Marine Works.'), goal: 'boats' },
  { id: 'FIRST_JOB', title: $t('Work on the water'), text: $t('Be paid for a job from the notice board.'), got: (s) => (s.contracts?.count || 0) >= 1 },
  { id: 'SKIPPER', title: $t('Skipper'), text: $t('Be trusted with charters of six.'), got: (s) => s.contracts && career(s.contracts).rank.pax >= 6 },
  { id: 'MASTER', title: $t('Master'), text: $t('Be trusted with anything on the board.'), got: (s) => s.contracts && !career(s.contracts).next },
  { id: 'KITTIWAKE', title: $t('Under the black and red buoy'), text: $t('Find the Kittiwake.'), got: (s) => !!s.adventures?.kittiwake?.done },
  { id: 'FIFTH_NAME', title: $t('The Fifth Name'), text: $t('See the fifth name on the stone.'), got: (s) => !!s.story && storyFinished(s.story) },
];
export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((a) => a.id);

// The ones earned in save `state` (extra: what goalsOf needs: { places: [found, of], boats }).
export function earned(state, extra = {}) {
  const goals = Object.fromEntries(goalsOf(state, extra).map((g) => [g.id, g.done]));
  // (What Free Roam hands you from the start is only earned in a Career: see playmode.js.)
  const given = state?.play === 'free' ? GIVEN_IN_FREE : [];
  return ACHIEVEMENTS.filter((a) => !given.includes(a.id) && (a.goal ? !!goals[a.goal] : !!a.got(state))).map((a) => a.id);
}
