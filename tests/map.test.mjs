// The map's memory of where you've been (src/map.js): cells fill in around you, survive a
// save and a reload, and a damaged string never breaks it. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Explored, SHEET, COLS, ROWS } from '../src/map.js';

const cellOf = (x, z) => [Math.floor((x - SHEET.x) / 20), Math.floor((z - SHEET.z) / 20)];

test('the map fills in around you, and only around you', () => {
  const e = new Explored();
  assert.equal(e.fraction, 0);
  assert.equal(e.reveal(0, 0, 100), true);
  assert.ok(e.has(...cellOf(0, 0)));
  assert.ok(e.has(...cellOf(60, 40)));
  assert.ok(!e.has(...cellOf(300, 300)));
  assert.equal(e.reveal(0, 0, 100), false, 'nothing new the second time');
});

test('what you have seen survives a save', () => {
  const e = new Explored();
  e.reveal(330, -470, 150);
  e.reveal(-260, 560, 80);
  const back = new Explored(e.toString());
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) assert.equal(back.has(i, j), e.has(i, j));
});

test('a damaged map string starts the map afresh instead of failing', () => {
  const e = new Explored('%%% not base64 %%%');
  assert.equal(e.fraction, 0);
  assert.equal(new Explored(null).fraction, 0);
});

test('places off the edge of the sheet are simply not recorded', () => {
  const e = new Explored();
  assert.equal(e.reveal(5000, 5000, 50), false);
});

test('the sheet takes in Hoarfell and the Coldwater, and a map from before it grew keeps every cell you’d seen', () => {
  const e = new Explored();
  assert.equal(e.reveal(-1034, -1496, 60), true, 'the summit is on the sheet');
  assert.equal(e.reveal(-925, -1328, 60), true, 'and the tarn');
  // A map saved on the first sheet (70 by 100 cells from -560, -720): the cells you'd seen at the
  // old camp, and in two opposite corners.
  const OLD = { x: -560, z: -720, cols: 70 };
  const bits = new Uint8Array(875);
  const seen = [[-99, -2], [-550, -710], [830, 1270]];
  for (const [x, z] of seen) {
    const k = Math.floor((z - OLD.z) / 20) * OLD.cols + Math.floor((x - OLD.x) / 20);
    bits[k >> 3] |= 1 << (k & 7);
  }
  const old = new Explored(btoa(String.fromCharCode(...bits)));
  for (const [x, z] of seen) assert.ok(old.has(...cellOf(x, z)), `${x}, ${z} still seen`);
  assert.equal(Math.round(old.fraction * COLS * ROWS), seen.length);
  // Saved again, it's the new sheet's (and still short enough for the save).
  const again = old.toString();
  assert.ok(again.length <= 4000);
  for (const [x, z] of seen) assert.ok(new Explored(again).has(...cellOf(x, z)));
});
