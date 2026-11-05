// The two throttle styles (src/throttle.js): clear notches, or a smooth lever like a real boat's
// that the revs follow, with the notches marked along it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVERS, GEAR_IN, notchPosition, valueAt, positionOf, capPosition, slide, displayIndex, positionAtIndex, leverPositionWords, neutralIndex, nearest } from '../src/throttle.js';

const KINDS = Object.keys(LEVERS);

test('the smooth lever passes through every notch at its mark, and the notches are evenly spaced ahead', () => {
  for (const k of KINDS) {
    for (const n of LEVERS[k]) {
      const p = notchPosition(k, n.id);
      assert.ok(Math.abs(valueAt(k, p) - n.v) < 1e-9, `${k} ${n.id}`);
    }
    const ahead = LEVERS[k].filter((n) => n.v > 0).map((n) => notchPosition(k, n.id));
    assert.equal(ahead[0], GEAR_IN, `${k}: in gear at idle first`);
    assert.equal(ahead.at(-1), 1, `${k}: full ahead at the end of the travel`);
    const gaps = ahead.slice(1).map((p, i) => p - ahead[i]);
    for (const g of gaps) assert.ok(Math.abs(g - gaps[0]) < 1e-9, k);
  }
});

test('more lever, more power, always: smooth from idle to full, and neutral is neutral', () => {
  for (const k of KINDS) {
    let last = 0;
    for (let p = GEAR_IN; p <= 1.0001; p += 0.01) {
      const v = valueAt(k, p);
      assert.ok(v >= last - 1e-12, `${k} at ${p.toFixed(2)}`);
      last = v;
    }
    for (const p of [0, 0.05, -0.05, GEAR_IN * 0.99]) assert.equal(valueAt(k, p), 0, `${k}: ${p} is still neutral`);
    assert.ok(valueAt(k, -1) < valueAt(k, -GEAR_IN) && valueAt(k, -GEAR_IN) < 0, `${k}: astern builds too`);
    // (No sudden jump between two notches: each step of 1% multiplies the power by at most a little.)
    for (let p = GEAR_IN; p < 0.99; p += 0.01) assert.ok(valueAt(k, p + 0.01) / valueAt(k, p) < 1.13, `${k} at ${p.toFixed(2)}`);
  }
});

test('a lever value maps back to the same place on the travel', () => {
  for (const k of KINDS) {
    for (let p = -1; p <= 1; p += 0.05) {
      if (Math.abs(p) < GEAR_IN) continue;
      assert.ok(Math.abs(positionOf(k, valueAt(k, p)) - p) < 1e-6, `${k} ${p.toFixed(2)}`);
    }
    assert.equal(positionOf(k, 0), 0);
  }
});

test('pushed, it moves (faster the further it is pushed); let go, it stays where it is', () => {
  const S = { pos: 0, stopped: false };
  slide('rib', S, 1, 0.05);
  assert.ok(S.pos >= GEAR_IN, 'straight into gear');
  const a = { pos: 0.5, stopped: false }, b = { pos: 0.5, stopped: false };
  slide('rib', a, 0.4, 0.2);
  slide('rib', b, 1, 0.2);
  assert.ok(b.pos - 0.5 > (a.pos - 0.5) * 2, 'a gentle push moves it gently');
  const at = b.pos;
  for (let i = 0; i < 30; i++) slide('rib', b, 0, 1 / 30);
  assert.equal(b.pos, at, 'and it stays');
  // A tiny wobble of the stick does nothing.
  const c = { pos: 0.5, stopped: false };
  slide('rib', c, 0.08, 1);
  assert.equal(c.pos, 0.5);
});

test('coming back it stops at neutral, and goes on into astern only after a fresh push', () => {
  const S = { pos: 0.3, stopped: false };
  let detents = 0;
  for (let i = 0; i < 90; i++) if (slide('skiff', S, -1, 1 / 30).detent) detents++;
  assert.equal(S.pos, 0, 'held back, it waits in neutral');
  assert.equal(detents, 1);
  slide('skiff', S, 0, 1 / 30);
  for (let i = 0; i < 10; i++) slide('skiff', S, -1, 1 / 30);
  assert.ok(S.pos <= -GEAR_IN, 'let go and pulled again: astern');
  // And the same coming forward out of astern.
  for (let i = 0; i < 90; i++) slide('skiff', S, 1, 1 / 30);
  assert.equal(S.pos, 0);
});

test('with a line out it goes no further than trolling speed, and with a fish on no further than dead slow', () => {
  for (const k of ['rib', 'console', 'cruiser', 'skiff', 'bass']) {
    const S = { pos: 0, stopped: false };
    let capped = false;
    for (let i = 0; i < 120; i++) capped = slide(k, S, 1, 1 / 30, 'line').capped || capped;
    assert.ok(Math.abs(S.pos - capPosition(k, 'line')) < 1e-9, k);
    assert.ok(capped, `${k}: and says so`);
    const F = { pos: 0, stopped: false };
    for (let i = 0; i < 120; i++) slide(k, F, 1, 1 / 30, 'fight');
    assert.equal(F.pos, GEAR_IN, `${k}: dead slow`);
    // (Astern is still there.)
    const A = { pos: 0, stopped: false };
    for (let i = 0; i < 60; i++) slide(k, A, -1, 1 / 30, 'fight');
    assert.ok(A.pos < 0);
  }
});

test('on screen the smooth lever sits on the same marks as the notches, and a drag lands where it is', () => {
  for (const k of KINDS) {
    for (const n of LEVERS[k]) {
      const i = LEVERS[k].indexOf(n);
      assert.ok(Math.abs(displayIndex(k, notchPosition(k, n.id)) - i) < 1e-9, `${k} ${n.id}`);
    }
    for (let p = GEAR_IN; p <= 1; p += 0.05) assert.ok(Math.abs(positionAtIndex(k, displayIndex(k, p)) - p) < 1e-6, `${k} ${p}`);
    assert.equal(positionAtIndex(k, neutralIndex(k)), 0);
  }
  assert.equal(nearest('rib', valueAt('rib', notchPosition('rib', 'T'))), LEVERS.rib.findIndex((n) => n.id === 'T'));
});

test('the lever in words', () => {
  assert.equal(leverPositionWords(0), 'neutral');
  assert.equal(leverPositionWords(GEAR_IN), 'ahead, idle');
  assert.equal(leverPositionWords(1), 'full ahead');
  assert.equal(leverPositionWords(-GEAR_IN), 'astern, idle');
  assert.match(leverPositionWords(0.56), /^ahead, 50%$/);
});
