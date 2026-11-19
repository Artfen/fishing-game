// Career and Free Roam (docs/MODES.md, M1): what a game starts with, chosen when it begins. (How it
// feels to play, the fish, the casting and the engine, is playstyle.js; this is what you have.)
//
//  · Career, as every game was before there was a choice: the camp's three boats and £20. Sell what
//    you catch, take work from the board and be trusted with more, buy the fleet or hire it by the
//    day, the liveaboard trawler last of all.
//  · Free Roam: the whole coast from the first morning. Every boat in the fleet yours, the trawler
//    with her tender afloat at your berth; all the work on the board open, as to a Master; a purse
//    to begin with. Money still comes in and still buys what it buys.

import { STARTER, PRICES } from './shipyard.js';
import { newContracts } from './contracts.js';
import { $t } from './i18n.js';

export const PLAYS = {
  career: {
    name: $t('Career'),
    desc: $t('Start at the camp with its three boats and £20. Sell what you catch, take work from the notice board and be trusted with more, buy the boats (or hire them by the day), and work your way up to the liveaboard trawler.'),
  },
  free: {
    name: $t('Free Roam'),
    desc: $t('The whole coast from the first morning: every boat in the fleet yours, the liveaboard trawler and her tender waiting at your berth, all the work on the board open to you, and £2,000 in your purse.'),
  },
};
export const PLAY_IDS = Object.keys(PLAYS);
export const FREE_PURSE = 2000;
export const cleanPlay = (v) => (v === 'free' ? 'free' : 'career');
export const isFree = (state) => state?.play === 'free';

// Every boat the coast has: the camp's three and all that Willowhaven Marine Works builds.
export const FLEET_ALL = [...new Set([...STARTER, ...Object.keys(PRICES)])];

// Free Roam's start, on a game's state: the boats made yours (putting them in the water is the
// game's: main.js), the board opened, the purse filled to FREE_PURSE (a receipt in the ledger, by
// earn(state, v, what)). Returns what it gave: { boats: [kinds], purse }.
export function giveFree(state, earn) {
  state.play = 'free';
  const Y = state.yard, boats = [];
  if (Y) for (const k of FLEET_ALL) if (!Y.owned.includes(k)) { Y.owned.push(k); boats.push(k); }
  if (Y?.hired && Y.owned.includes(Y.hired.kind)) Y.hired = null;
  state.contracts ??= newContracts();
  state.contracts.free = true;
  state.contracts.board = null;
  const purse = Math.max(0, FREE_PURSE - (state.money ?? 0));
  if (purse > 0) earn(state, purse, $t('Free Roam: a purse to begin with'));
  return { boats, purse };
}

// The achievements a Free Roam game is simply given (every boat; the board's top ranks): earned
// only in a Career.
export const GIVEN_IN_FREE = ['FLEET', 'SKIPPER', 'MASTER'];
