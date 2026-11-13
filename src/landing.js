// Landing a beaten fish (E2b). The landing net takes fish up to NET's length and weight. A fish too
// big for it is landed another way, depending on where you stand:
// - From a boat, it's drawn alongside (see fishing.js bigCatch); the big game on the leader (E3d, below).
// - From the shore, the shore decides:
//   - 'beach': a shelving shore of sand, gravel or mud. Wind steadily and it slides up into the
//     shallows; let go as it stirs.
//   - 'hand': a low rock or ledge where you can reach the water. Take it by the tail as it lies
//     still; grab as it kicks and it slips your hand.
//   - 'lift': too high above the water to reach it (a quay, a jetty, a high rock). It has to come
//     up on the line, and the hook takes all its weight.

import { bottomOf } from './sonarRead.js';

export const NET = { cm: 110, kg: 16 };

export const fitsNet = (cm, kg) => cm <= NET.cm && kg <= NET.kg;

// Higher than this above the water (m) and you can't reach down to it: a jetty's deck is 1.15 m.
export const REACH = 1.0;
// Shallower than this (m) where it lies and the shore shelves gently enough to slide a fish up it.
export const SHELF = 1.2;

// How a fish too big for the net is landed from the shore: bank, the height above the water of the
// nearest place you could stand (m; below 0, wading); bottom, what it lies over (sonarRead.js
// bottomOf); depth, the water's depth where it lies (m).
export function shoreMethod(bank, bottom, depth) {
  if (bank > REACH) return 'lift';
  if (bottom.kind !== 'rock' && bottom.kind !== 'weed' && depth < SHELF) return 'beach';
  return 'hand';
}

// The same, from the world: the angler's position (y the ground they stand on), where the fish
// lies, and the world's lookups (terrain.js walkHeight, depthAt, waterLevel, zoneAt and SOUTH_Z;
// the ecosystem's habitat). The bank is where the shore meets the water on the way in from the
// fish: the first spot you could stand on, ground or deck, or wading no deeper than your shins.
// (You'd walk down to it to land a fish, so standing back up a beach doesn't make it a wall.)
export function shoreMethodAt(pos, end, { walkHeight, depthAt, waterLevel, habitat, zoneAt, southZ }) {
  const lv = waterLevel(end.x, end.z), dx = pos.x - end.x, dz = pos.z - end.z, L = Math.hypot(dx, dz);
  let bank = pos.y - lv;
  for (let d = 0; d <= L; d += 0.25) {
    const x = end.x + (dx / (L || 1)) * d, z = end.z + (dz / (L || 1)) * d, h = walkHeight(x, z) - lv;
    if (h > -0.3) {
      bank = h;
      break;
    }
  }
  const bottom = bottomOf(habitat.sample(end.x, end.z), zoneAt(end.x, end.z), end.z > southZ);
  return shoreMethod(bank, bottom, depthAt(end.x, end.z));
}

// What each way of landing asks of you: landed by a tap (the net, a hand) or by winding steadily
// (up the beach, up the wall); how long it takes to wind it out (s).
export const LAND_WAYS = {
  net: { tap: true, word: 'net it', act: 'Net it' },
  hand: { tap: true, word: 'tail it', act: 'Grab it' },
  beach: { tap: false, word: 'beach it', act: 'Wind', wind: 2.2 },
  lift: { tap: false, word: 'lift it', act: 'Lift', wind: 1.6 },
  // (E3d) The big game from a boat: drawn alongside on the leader, hand over hand (see below).
  leader: { tap: false, word: 'take the leader', act: 'Take the leader', wind: 3.2 },
};

// (E3d) The big game from a boat. Beaten, it comes to the leader: the heavy trace above the hook,
// its swivel at the rod tip, the fish a few metres off and still with a surge or two in it. Someone
// takes the leader and draws it alongside hand over hand: you (hold), or a friend aboard (see
// teamwork.js). Each surge takes back some of the leader. Held through a surge, the hook can tear
// out: let go as it stirs, and the rod takes the run.
// LEADER_OFF: how far off it lies (m) as the leader reaches the rod tip; LEADER_SLIP: how much of
// the draw (s of it) a surge takes back.
export const LEADER_OFF = 4.5;
export const LEADER_SLIP = 1.1;
// The chance (0 … 1) the hook tears out when you hold the leader through a surge: none on Relaxed
// (pull 0); otherwise some even on a firm hold (a big fish's surge on a hand-held leader), and more
// the looser the hook has worn (grip, see fight.js).
export const leaderRisk = (pull, grip) => pull * (0.25 + 0.5 * (1 - grip));

// The chance (0 … 1) the hook tears out as it's lifted clear on the line: none on Relaxed (pull
// 0), and otherwise by how firmly it's still hooked (grip, see fight.js) and how heavy it is.
export const liftRisk = (pull, grip, kg) => pull * (1 - grip) * Math.min(1, kg / 12);

// The chance (0 … 1) the line goes as it's lifted clear: none until the fish weighs twice the
// line's rating (a line breaks above its rating, and the water takes some of the weight until
// it's clear), certain at four times, on Demanding; half that on Natural, none on Relaxed.
export const liftBreakRisk = (pull, kg, lineKg) => pull * Math.min(1, Math.max(0, (kg / lineKg - 2) / 2));

// The chance a net or a hand swung at a kicking fish knocks the hook out of it.
export const knockRisk = (pull, grip) => 0.6 * pull * (1 - grip);
