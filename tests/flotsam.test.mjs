// After the gale (F3a, see flotsam.js): what a gale throws up and where (the same for the same
// gale), a spot on each beach's tide line, how long it lies, what the chandlery gives for it, the
// bottles' marks out on the water, and all of it kept through a save.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { BEACHES, FINDS, NOTES, LIES_DAYS, HELD_MAX, thrownUp, tideSpot, stillLying, saleOf, cleanFlotsam, beachName } = await import('../src/flotsam.js');
const { heightAt } = await import('../src/world/terrain.js');
const { parseSave, SAVE_VERSION } = await import('../src/save.js');

test('what a gale throws up: one find at one beach, the same for the same gale, every kind in time', () => {
  assert.deepEqual(thrownUp(41), thrownUp(41), 'the same gale, the same find');
  const kinds = new Set(), beaches = new Set();
  for (let d = 1; d < 200; d++) {
    const T = thrownUp(d);
    assert.ok(FINDS[T.kind], T.kind);
    assert.ok(BEACHES.some((b) => b.id === T.beach), T.beach);
    assert.equal(T.note != null, T.kind === 'bottle', 'a note only in a bottle');
    if (T.note != null) assert.ok(NOTES[T.note]);
    kinds.add(T.kind);
    beaches.add(T.beach);
  }
  assert.equal(kinds.size, Object.keys(FINDS).length);
  assert.equal(beaches.size, BEACHES.length);
  assert.equal(beachName('strand'), 'Shell Strand');
});

test('it lies on the tide line: dry, just above the water, with the water a few steps off', () => {
  for (const b of BEACHES) {
    for (const seed of [0, 0.25, 0.5, 0.75]) {
      const p = tideSpot(b.id, heightAt, seed);
      assert.ok(p, `${b.id} ${seed}`);
      const h = heightAt(p.x, p.z);
      assert.ok(h >= 0.15 && h <= 0.9, `${b.id}: ${h.toFixed(2)} m above the water`);
      assert.ok(Math.hypot(p.x - b.x, p.z - b.z) <= 40, `${b.id}: on the beach`);
      let wet = false;
      for (let j = 0; j < 8; j++) if (heightAt(p.x + Math.sin((j / 8) * Math.PI * 2) * 4, p.z + Math.cos((j / 8) * Math.PI * 2) * 4) < -0.05) wet = true;
      assert.ok(wet, `${b.id}: the water close by`);
    }
  }
  assert.equal(tideSpot('nowhere', heightAt), null);
});

test('the tide takes it back; the chandlery buys the rest; the bottles mark the water', () => {
  const f = { at: 100 };
  assert.equal(stillLying(f, 100 + LIES_DAYS * 24 - 1), true);
  assert.equal(stillLying(f, 100 + LIES_DAYS * 24), false);
  const q = saleOf([{ kind: 'float' }, { kind: 'float' }, { kind: 'rope' }]);
  assert.equal(q.n, 3);
  assert.equal(q.price, FINDS.float.price * 2 + FINDS.rope.price);
  assert.equal(q.words, '2 × glass float, coil of rope');
  assert.equal(saleOf([]).n, 0);
  assert.equal(FINDS.bottle.price, 0, 'a bottle is read, not sold');
  for (const N of NOTES) if (N.x != null) assert.ok(heightAt(N.x, N.z) < -1, `${N.title}: out on the water`);
});

test('kept through a save; an older save has nothing lying', () => {
  assert.deepEqual(cleanFlotsam(undefined), { seen: 0, lying: [], held: [] });
  const raw = {
    seen: 57,
    lying: [{ gale: 57, beach: 'cove', kind: 'float', note: null, x: 150, z: -33, at: 1390 }, { gale: 3, beach: 'atlantis', kind: 'float', x: 0, z: 0, at: 1 }, { gale: 4, beach: 'strand', kind: 'gold', x: 0, z: 0, at: 1 }],
    held: [{ kind: 'rope', day: 50 }, { kind: 'bottle', day: 51 }, { kind: 'junk' }, ...Array(10).fill({ kind: 'float', day: 52 })],
  };
  const C = cleanFlotsam(raw);
  assert.equal(C.seen, 57);
  assert.deepEqual(C.lying, [{ gale: 57, beach: 'cove', kind: 'float', note: null, x: 150, z: -33, at: 1390 }]);
  assert.ok(C.held.length <= HELD_MAX && C.held.every((h) => FINDS[h.kind].price > 0), 'only what sells, and no more than an armful');
  const wrap = (data) => JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data });
  assert.deepEqual(parseSave(wrap({ day: 60, flotsam: raw })).state.flotsam, C);
  assert.deepEqual(parseSave(wrap({ day: 60 })).state.flotsam, { seen: 0, lying: [], held: [] });
});
