// The fish finder as a head unit (src/sonarUnit.js, src/sonar.js): its colour ramps, the depths on
// screen for each zoom, one fish symbol for one fish, and its settings kept in the save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, rampAt, depthWindow, labelFish, PAGES, ZOOMS } from '../src/sonarUnit.js';

test('each palette runs from its weakest colour to its strongest', () => {
  for (const P of PALETTES) {
    assert.deepEqual(rampAt(P, 0), P.ramp[0], P.id);
    assert.deepEqual(rampAt(P, 1), P.ramp[P.ramp.length - 1], P.id);
    assert.deepEqual(rampAt(P, 2), rampAt(P, 1), 'clamped');
    const mid = rampAt(P, 0.5);
    assert.ok(mid.every((c) => c >= 0 && c <= 255));
  }
});

test('the depths on screen: the whole range, 2× following the bottom, and bottom lock', () => {
  assert.deepEqual(depthWindow(10, 0, 7), { top: 0, bottom: 10, lock: false });
  for (const bottom of [2, 6, 9.5]) {
    const w = depthWindow(10, 1, bottom);
    assert.equal(w.bottom - w.top, 5, 'half the range');
    assert.ok(w.top >= 0 && w.top <= bottom && bottom <= w.bottom, `the bottom on screen at ${bottom} m`);
  }
  const lock = depthWindow(15, 2, 12);
  assert.ok(lock.lock && lock.top < 0 && lock.bottom > 0, 'the few metres above the bottom, and a little below');
  assert.equal(PAGES.length, 3);
  assert.equal(ZOOMS.length, 3);
});

test('one fish crossing the beam gets one symbol; two fish at different depths get two', () => {
  const pings = [];
  const ping = (fish) => {
    pings.push({ bottom: 9, fish: fish.map(([depth, size]) => ({ depth, size, strength: 0.8 })) });
    labelFish(pings);
    return pings[pings.length - 1].labels;
  };
  // An arch: the same fish over six pings, its slant depth dipping and rising.
  const one = [5.4, 5.2, 5.1, 5.1, 5.2, 5.4].map((d) => ping([[d, 0.7]]));
  assert.equal(one.flat().length, 1);
  // Later, two at once, well apart.
  for (let i = 0; i < 20; i++) ping([]);
  assert.equal(ping([[3, 0.6], [7.5, 1.2]]).length, 2);
  // Fry are never labelled.
  for (let i = 0; i < 20; i++) ping([]);
  assert.equal(ping([[4, 0.1]]).length, 0);
});

test('the unit’s settings are kept in the save, and junk is put right', async () => {
  const S = await import('../src/save.js?unit=1');
  const ok = S.sanitize({ finder: { x: 0.2, y: 0.3, size: 2, unit: true, w: 700, page: 'split', pal: 2, gain: 8, range: 15, zoom: 2, symbols: false } }).finder;
  assert.deepEqual(ok, { x: 0.2, y: 0.3, size: 2, unit: true, w: 700, page: 'split', pal: 2, gain: 8, range: 15, zoom: 2, symbols: false });
  const bad = S.sanitize({ finder: { unit: 'yes', w: 9999, page: 'radar', pal: 9, gain: -3, range: 17, zoom: 5 } }).finder;
  assert.equal(bad.unit, false);
  assert.equal(bad.w, 2000);
  assert.equal(bad.page, 'sonar');
  assert.equal(bad.pal, 3);
  assert.equal(bad.gain, 0);
  assert.equal(bad.range, 'auto');
  assert.equal(bad.zoom, 2);
  assert.equal(bad.symbols, true);
});
