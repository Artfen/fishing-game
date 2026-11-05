// Friend codes (src/giftcodes.js): a good one gives every boat and £100, once for each game; a
// wrong one nothing; and the codes themselves aren't written in the game's files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GIFTS, cleanGift, giftHash, redeemGift } from '../src/giftcodes.js';
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
