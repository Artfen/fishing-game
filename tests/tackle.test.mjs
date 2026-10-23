// Tackle (src/tackle.js): the ready-made setups are complete and castable, impossible rigs are
// refused with a reason, and every kind of fish can be caught with some setup.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RODS, TACKLE, TERMS, SETUPS, fits, checkSetup, castRange, castWeight } from '../src/tackle.js';
import { FISH } from '../src/fish.js';

const lineOf = (rod, id) => rod.lines.find((l) => l.id === id) || rod.lines[0];
const termOf = (rod, id) => TERMS[id || rod.terms[0]];

test('every setup ties on something each of its rods can fish, with nothing blocked', () => {
  for (const s of SETUPS) {
    for (const r of s.rods) {
      const rod = { ...RODS[r], line: lineOf(RODS[r], s.line?.[r]) };
      const item = TACKLE[s.rig?.[r]] || s.items.map((i) => TACKLE[i]).find((it) => fits(rod, it));
      assert.ok(item, `${s.name}: nothing for the ${r} rod`);
      assert.ok(fits(rod, item), `${s.name}: ${item.id} doesn't fit the ${r} rod`);
      const term = termOf(rod, s.term?.[r]);
      assert.ok(rod.terms.includes(term.id), `${s.name}: ${term.id} isn't a rig for the ${r} rod`);
      const blocked = checkSetup(rod, item, term).filter((p) => p.level === 'block');
      assert.deepEqual(blocked, [], `${s.name}: ${r} with ${item.id}`);
    }
    for (const i of s.items) assert.ok(s.rods.some((r) => fits(RODS[r], TACKLE[i])), `${s.name}: ${i} fits none of its rods`);
  }
});

test('a heavy offshore lure on the light rod is refused, and says why', () => {
  const rod = RODS.trout, item = TACKLE.stickbait;
  const problems = checkSetup(rod, item, termOf(rod));
  assert.equal(problems[0].level, 'block');
  assert.match(problems[0].text, /too heavy|can’t fish/);
});

test('a fly on a spinning rod is refused, naming the rod that can fish it', () => {
  const problems = checkSetup(RODS.spin, TACKLE.dry, termOf(RODS.spin));
  assert.equal(problems[0].level, 'block');
  assert.match(problems[0].text, /fly rod/);
});

test('a lure too light for the rod casts shorter than one in its range', () => {
  const rod = RODS.offshore;
  const light = Object.values(TACKLE).filter((t) => fits(rod, t)).sort((a, b) => a.weight - b.weight)[0];
  const right = Object.values(TACKLE).filter((t) => fits(rod, t)).find((t) => {
    const w = castWeight(rod, t, termOf(rod));
    return w >= rod.weight[0] && w <= rod.weight[1];
  });
  assert.ok(right, 'the offshore rod has a lure in its range');
  if (castWeight(rod, light, termOf(rod)) < rod.weight[0] * 0.6) {
    assert.ok(castRange(rod, light, termOf(rod))[1] < castRange(rod, right, termOf(rod))[1]);
  }
});

test('every kind of fish (and the squid) can be caught with one of the setups', () => {
  for (const f of FISH) {
    const ok = SETUPS.some((s) => s.rods.some((r) => s.items.some((i) => fits(RODS[r], TACKLE[i]) && (f.food?.[i] ?? 0) >= 0.5)));
    assert.ok(ok, `no setup catches the ${f.name}`);
  }
});
