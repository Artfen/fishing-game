// Word on the water (F3c, see word.js): which feed is worth passing word of (big, broken at the
// top, out of your sight but not too far, once), how it reaches you (her VHF, your phone where it
// has signal, or not at all), twice a day at most, the words, and kept through a save.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { worthWord, heardBy, wordLeft, wordPassed, wordFor, cleanWord, newWord, VOICES, NEAR, FAR, MIN_HUNTERS, WORD_PER_DAY } = await import('../src/word.js');
const { NO_SIGNAL } = await import('../src/safety.js');
const { zoneAt } = await import('../src/world/terrain.js');
const { GATHER, UP, OVER, FEED } = await import('../src/world/feeding.js');
const { parseSave, SAVE_VERSION } = await import('../src/save.js');

test('a feed worth passing word of: broken at the top, big, out of sight, not too far, once', () => {
  assert.equal(UP, 1, 'the phase the words go by');
  assert.equal(MIN_HUNTERS, FEED.drive, 'any feed that has broken the top: birds working over it');
  const feed = (o = {}) => ({ id: 7, phase: UP, done: false, hunters: MIN_HUNTERS + 2, x: 800, z: 0, ...o });
  const told = new Set();
  assert.equal(worthWord(feed(), 0, 0, told), true);
  assert.equal(worthWord(feed({ phase: GATHER }), 0, 0, told), false, 'not up yet');
  assert.equal(worthWord(feed({ phase: OVER }), 0, 0, told), false, 'over');
  assert.equal(worthWord(feed({ done: true }), 0, 0, told), false);
  assert.equal(worthWord(feed({ hunters: MIN_HUNTERS - 1 }), 0, 0, told), false, 'a few fish');
  assert.equal(worthWord(feed({ x: NEAR - 10 }), 0, 0, told), false, 'close enough to see for yourself');
  assert.equal(worthWord(feed({ x: FAR + 10 }), 0, 0, told), false, 'too far to be worth it');
  told.add(7);
  assert.equal(worthWord(feed(), 0, 0, told), false, 'told once');
  assert.equal(worthWord(null, 0, 0, told), false);
});

test('how it reaches you: her VHF anywhere, your phone where it has signal, otherwise not at all', () => {
  assert.equal(heardBy({ vhf: true, signal: false }), 'vhf');
  assert.equal(heardBy({ vhf: false, signal: true }), 'phone');
  assert.equal(heardBy({ vhf: false, signal: false }), null);
  assert.equal(NO_SIGNAL.has(zoneAt(60, 160)), false, 'open water off the bay: the phone works');
  assert.equal(NO_SIGNAL.has(zoneAt(40, 960)), true, 'the Blue Water: no signal');
});

test('twice a day at most, then the next day again; the words', () => {
  const W = newWord();
  assert.equal(wordLeft(W, 5), true);
  for (let i = 0; i < WORD_PER_DAY; i++) wordPassed(W, 5);
  assert.equal(wordLeft(W, 5), false);
  assert.equal(wordLeft(W, 6), true, 'a new day');
  wordPassed(W, 6);
  assert.deepEqual(W, { day: 6, n: 1 });
  const a = wordFor({ voice: VOICES[0], how: 'vhf', where: 'off the Calf', fish: 'mackerel' });
  assert.match(a, /^Hettie, out in her boat, on the VHF: “Birds working off the Calf, and mackerel crashing through the bait under them\./);
  assert.match(wordFor({ voice: VOICES[1], how: 'phone', where: '0.8 km SE of the harbour', fish: null }), /Dougie, hauling his pots, on your phone: “Birds working 0\.8 km SE of the harbour, and something big crashing/);
});

test('kept through a save; an older save has had no word', () => {
  assert.deepEqual(cleanWord(undefined), { day: 0, n: 0 });
  assert.deepEqual(cleanWord({ day: 12.7, n: 9 }), { day: 12, n: WORD_PER_DAY });
  assert.deepEqual(cleanWord([3]), { day: 0, n: 0 });
  const wrap = (data) => JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data });
  assert.deepEqual(parseSave(wrap({ day: 12, word: { day: 12, n: 1 } })).state.word, { day: 12, n: 1 });
  assert.deepEqual(parseSave(wrap({ day: 12 })).state.word, { day: 0, n: 0 });
});
