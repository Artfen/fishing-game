// Friend codes: typed in Settings → Play together, a good one gives friends and testers every
// boat at Willowhaven Marine Works and £100 in their purse, once for each save.
//
// The codes themselves aren't kept here, only a fingerprint of each (SHA-256), so reading the
// game's files doesn't hand them out. It's a gift between friends, not a lock: a save lives in
// the player's own browser, so nothing here (or anywhere in a game with no server) can stop a
// determined player giving themselves money; it simply saves your friends the grind. To make a
// code: `node tools/gift-code.mjs YOUR-CODE`, and add the line it prints to GIFTS.

import { earn } from './economy.js';

export const GIFTS = [
  // (The first: for friends and testers.)
  { hash: 'ef00ab7487ac0e64f96524e0ca0b9094cc7398f9d471d34a10b27216811948e5', money: 100, boats: true, name: 'Friends of Slow Tide' },
];

// A code as typed, made plain: letters and digits only, in capitals ("blue boat 7" and
// "BLUE-BOAT-7" are the same code).
export const cleanGift = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);

// Its fingerprint (hex SHA-256 of the plain code, salted with the game's name).
export async function giftHash(code) {
  const data = new TextEncoder().encode(`slow-tide-gift:${cleanGift(code)}`);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Redeem a code on this save: { ok, why, gift }. kinds: every boat there is. Each code once.
export async function redeemGift(state, code, kinds, gifts = GIFTS) {
  if (cleanGift(code).length < 4) return { ok: false, why: 'Type the code your friend gave you.' };
  const hash = await giftHash(code);
  const gift = gifts.find((g) => g.hash === hash);
  if (!gift) return { ok: false, why: 'That code isn’t one the game knows. Check it with whoever gave it you.' };
  state.gifts = Array.isArray(state.gifts) ? state.gifts : [];
  if (state.gifts.includes(hash)) return { ok: false, why: 'That code’s been used on this game already.' };
  state.gifts.push(hash);
  if (gift.boats && state.yard) {
    for (const k of kinds) if (!state.yard.owned.includes(k)) state.yard.owned.push(k);
    state.yard.hired = null;
  }
  if (gift.money) earn(state, gift.money, `A gift: ${gift.name}`.slice(0, 60));
  return { ok: true, gift };
}
