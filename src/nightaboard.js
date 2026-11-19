// (J3) A night aboard a boat with no cabin: the brief's two friends "remain overnight aboard their
// vessel", and their vessel is the RIB. Only the cabin boat and the yacht had anywhere to sleep
// (docs/PLAYTHROUGH.md, finding 3).
//
// With a bivvy roll aboard (cargo.js: two sleeping bags in waterproof bivvy bags, and two foam
// mats), at anchor or tied up and still, her skipper can turn in on her deck until a time they
// choose, as in the cabin boat's bunk (main.js sleepUntil). The night at anchor is the cabin's:
// a gale while they sleep can drag her (anchorage.js). Their water bottle is filled from the
// stores crate if there's one aboard. They wake warm in the bag but to the morning's chill, and
// damp clothes stay damp (comfort.js, `open`). A friend crewing aboard sleeps the night through
// with them, in the other bag: their game shows the night pass, and they wake beside the skipper.

// Whether her skipper can turn in here, and if not why. o: { cabin (she has a bunk), deck (a boat
// you walk about: the RIB, the console), settled (at anchor or tied up, and still), bivvy (aboard
// her), following (playing together, and time is a friend's to pass) }. null: nothing to offer
// here (the cabin boat has her bunk; a small boat has no room to lie down; under way).
import { $t } from './i18n.js';
export function turnIn(o) {
  if (o.cabin || !o.deck || !o.settled) return null;
  if (!o.bivvy) return { ok: false, why: $t('Nowhere dry to sleep in an open boat. A bivvy roll from the chandlery in Willowhaven (two sleeping bags in waterproof bags, and two mats) makes a night aboard her.') };
  if (o.following) return { ok: false, host: true };
  return { ok: true };
}

// What you wake to on her deck, at hour h: rain or not, and the friend in the other bag, if any.
export function wakeOnDeck(h, rain, friend = null) {
  const by = friend ? $t` ${friend} is stirring in the other bag.` : '';
  if (rain) return $t`You wake to rain pattering on the bivvy bag and running in her scuppers: dry inside it, and nowhere else.${by}`;
  if (h < 7) return $t`You wake on her deck to a grey light, dew on everything and the boat nodding on her rope. Cold out of the bag.${by}`;
  if (h < 11) return $t`Morning sun on her deck, and the water slapping under her. Stiff from the boards, but a fine place to wake.${by}`;
  if (h < 16) return $t`You wake in the heat of the day, the boat turning slowly on her rope.${by}`;
  if (h < 20) return $t`You wake as the light goes gold on the water: the fish will be on the move.${by}`;
  return $t`You wake in the dark on her deck: stars from one side of the sky to the other, and the water talking under her.${by}`;
}

// The words when the skipper turns in, on the sleep screen (who with, if anyone).
export const turningIn = (friend = null) => (friend
  ? $t`You unroll the bivvies on her deck, ${friend} in the other bag, and sleep until`
  : $t('You unroll a bivvy on her deck and sleep until'));

// A friend's sleep, seen by their crewmate: their pose says they're asleep (`zz`). How long the
// crewmate's night lasts at most, if the word that they've woken never comes (seconds, real time).
export const SHARED_NIGHT_MAX = 30;
