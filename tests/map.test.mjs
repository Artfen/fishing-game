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
