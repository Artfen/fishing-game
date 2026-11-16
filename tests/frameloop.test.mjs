// The frame loop (src/loop.js) and the sound under water (src/audio.js): found playing the brief's
// Part J day through (docs/PLAYTHROUGH.md). Once in fifteen days, a frame threw (a value that
// wasn't a number reached the sound's underwater filter, which the browser refuses), and because
// the next frame was only asked for after this one, the game stopped dead. Now the next frame is
// asked for first, so one bad frame is reported and the game goes on; and the underwater filter is
// never handed a value that isn't a number. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { frameLoop } = await import('../src/loop.js');

test('a frame that throws doesn’t stop the game: the next one is already asked for', () => {
  const queue = [];
  let frames = 0;
  const frame = frameLoop((f) => queue.push(f), (now) => {
    frames++;
    if (now === 2) throw new Error('a bad frame');
  });
  frame(1);
  assert.equal(queue.length, 1);
  assert.throws(() => queue.shift()(2), /a bad frame/, 'still reported');
  assert.equal(queue.length, 1, 'and the next frame asked for all the same');
  queue.shift()(3);
  assert.equal(frames, 3);
  // (The game's own loop is this one.)
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const frame = frameLoop\(requestAnimationFrame,/);
});

// A stand-in for the browser's audio: a filter whose frequency refuses anything that isn't a
// number, as a real AudioParam does ("The provided float value is non-finite").
const strictParam = () => ({ value: 0, setTargetAtTime(v) { if (!Number.isFinite(v)) throw new TypeError('The provided float value is non-finite.'); this.value = v; return this; } });

test('the underwater muffle is never handed a value that isn’t a number', async () => {
  globalThis.window ??= globalThis;
  const { AudioScape } = await import('../src/audio.js');
  const A = Object.create(AudioScape.prototype);
  A.ctx = { currentTime: 0 };
  A.muffle = { frequency: strictParam() };
  A.setUnderwater(0);
  assert.equal(A.muffle.frequency.value, 20000, 'above water: open');
  A.setUnderwater(1);
  assert.ok(Math.abs(A.muffle.frequency.value - 650) < 1e-6, 'under: muffled');
  for (const bad of [NaN, Infinity, -Infinity, undefined]) assert.doesNotThrow(() => A.setUnderwater(bad), String(bad));
  assert.ok(Math.abs(A.muffle.frequency.value - 650) < 1e-6, 'left as it was');
  assert.equal(A.under, 1);
});
