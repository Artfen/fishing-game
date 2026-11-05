// Friend codes (src/giftcodes.js): a good one gives every boat and £100, once for each game; a
// wrong one nothing; and the codes themselves aren't written in the game's files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GIFTS, cleanGift, giftHash, redeemGift, giftWords } from '../src/giftcodes.js';
import { cleanYard } from '../src/shipyard.js';

const KINDS = ['row', 'skiff', 'kayak', 'bass', 'sail', 'cabin', 'cruiser', 'console', 'rib', 'windsurf', 'jetski'];
const fresh = () => ({ day: 3, hour: 10, money: 12, ledger: [], yard: cleanYard(null, KINDS) });

test('a code is the same however it’s typed', () => {
  assert.equal(cleanGift(' slowtide-friends '), 'SLOWTIDEFRIENDS');
  assert.equal(cleanGift('Slow Tide Friends'), 'SLOWTIDEFRIENDS');
});

test('the friends’ code: every boat and £100, once for each game', async () => {
  const s = fresh();
  assert.ok(!s.yard.owned.includes('rib'));
  const r = await redeemGift(s, 'slowtide friends', KINDS);
  assert.ok(r.ok, r.why);
  for (const k of KINDS) assert.ok(s.yard.owned.includes(k), k);
  assert.equal(s.money, 112);
  assert.equal(s.ledger.at(-1).v, 100);
  // Not twice.
  const again = await redeemGift(s, 'SLOWTIDE-FRIENDS', KINDS);
  assert.ok(!again.ok && /already/.test(again.why));
  assert.equal(s.money, 112);
});

test('a wrong code gives nothing', async () => {
  const s = fresh();
  for (const c of ['', 'abc', 'FREE-BOATS', 'slowtide-friend']) {
    const r = await redeemGift(s, c, KINDS);
    assert.ok(!r.ok, c);
  }
  assert.equal(s.money, 12);
  assert.ok(!s.yard.owned.includes('rib'));
});

test('the codes aren’t written in the game’s files, only their fingerprints', async () => {
  const src = readFileSync(new URL('../src/giftcodes.js', import.meta.url), 'utf8');
  assert.ok(!/slow\s*tide\W*friends/i.test(src.replace(/Friends of Slow Tide/g, '')) && !/slowtide/i.test(src), 'no code in the file');
  for (const g of GIFTS) assert.match(g.hash, /^[0-9a-f]{64}$/);
  assert.equal(await giftHash('slowtide friends'), GIFTS[0].hash);
});

test('the codes used are kept in the save, and junk is dropped', async () => {
  const S = await import('../src/save.js?gifts=1');
  const h = GIFTS[0].hash;
  assert.deepEqual(S.sanitize({ gifts: [h, 'nonsense', 42] }).gifts, [h]);
  assert.deepEqual(S.sanitize({}).gifts, []);
});

test('a code for the boats alone and one for money alone, each once, alongside the friends’ code', async () => {
  // The game has one of each, all different.
  assert.equal(new Set(GIFTS.map((g) => g.hash)).size, GIFTS.length);
  assert.ok(GIFTS.some((g) => g.boats && !g.money), 'a boats-only code');
  assert.ok(GIFTS.some((g) => !g.boats && g.money >= 1000), 'a money-only code');
  // (Codes made up for the test, so no real one is written here.)
  const gifts = [
    { hash: await giftHash('test-fleet-1'), money: 0, boats: true, name: 'The fleet' },
    { hash: await giftHash('test-purse-1'), money: 2000, boats: false, name: 'A full purse' },
  ];
  const s = fresh();
  const purse = await redeemGift(s, 'TEST PURSE 1', KINDS, gifts);
  assert.ok(purse.ok, purse.why);
  assert.equal(s.money, 2012);
  assert.ok(!s.yard.owned.includes('rib'), 'money alone: no boats');
  const fleet = await redeemGift(s, 'test-fleet-1', KINDS, gifts);
  assert.ok(fleet.ok, fleet.why);
  for (const k of KINDS) assert.ok(s.yard.owned.includes(k), k);
  assert.equal(s.money, 2012, 'boats alone: no money');
  // Each once for each game.
  assert.ok(!(await redeemGift(s, 'test purse 1', KINDS, gifts)).ok);
  assert.equal(s.money, 2012);
  // Said as what it gives.
  assert.equal(giftWords(gifts[0]), 'every boat at the Marine Works');
  assert.equal(giftWords(gifts[1]), '£2,000 in your purse');
  assert.equal(giftWords(GIFTS[0]), 'every boat at the Marine Works, and £100');
});
