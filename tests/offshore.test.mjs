// The offshore day (E3). E3a: fighting a fish together, a friend at the helm chasing it while
// you play it: where the fish is from her bow, the line out and what's left on the spool, carried
// in your pose to their game, and the words their helm gives them.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { fishFromHelm, helmWords, FOLLOW_AT, SPOOL_LOW } = await import('../src/crew.js');
const { cleanPose } = await import('../src/together.js');

test('where the fish is from her bow: dead ahead, off the bow, on the beam, off the quarter, astern; port to the left as she heads', () => {
  // (Heading 0 points her along +z; her starboard side is to −x, her port side to +x: boat.js.)
  const at = (fx, fz, h = 0) => fishFromHelm(0, 0, h, fx, fz);
  assert.equal(at(0, 50).where, 'dead ahead');
  assert.equal(at(30, 40).where, 'off the port bow');
  assert.equal(at(-30, 40).where, 'off the starboard bow');
  assert.equal(at(50, 0).where, 'on the port beam');
  assert.equal(at(-50, 0).where, 'on the starboard beam');
  assert.equal(at(30, -40).where, 'off the port quarter');
  assert.equal(at(0, -50).where, 'astern');
  assert.equal(Math.round(at(30, 40).d), 50);
  // Turned to head along +x, her starboard side faces +z (her right: boat.js), so a fish there is
  // on her starboard beam.
  assert.equal(at(0, 50, Math.PI / 2).where, 'on the starboard beam');
  assert.equal(at(50, 0, Math.PI / 2).where, 'dead ahead');
});

test('the helm’s words: follow it while it takes line, after it as the spool empties, steady while it’s played, stop as it’s landed', () => {
  const near = fishFromHelm(0, 0, 0, 20, 30), far = fishFromHelm(0, 0, 0, 0, 1400);
  assert.match(helmWords('Mags', near, { xl: 0, sl: 90 }), /^Mags has a fish on, 36 m off the port bow · spool 90%: keep her steady and let Mags play it$/);
  assert.match(helmWords('Mags', near, { xl: FOLLOW_AT + 20, sl: 60 }), /taking line.*follow it at a trolling pace/);
  assert.match(helmWords('Mags', near, { xl: 80, sl: SPOOL_LOW - 5 }), /emptying the spool.*after it, now!/);
  assert.match(helmWords('Mags', far, { xl: 0 }), /1\.4 km dead ahead/);
  assert.match(helmWords('Mags', near, { nt: 1 }), /beaten, off the port bow: stop her and keep her still/);
  assert.match(helmWords('Mags', near, { nt: 2 }), /beaten/, 'landed another way, too big for the net: the same');
  assert.doesNotMatch(helmWords('Mags', near, {}), /spool/, 'an older game sends no spool: none said');
});

test('the pose carries the line out and the spool, with a fish on; junk is dropped or clamped', () => {
  const base = { m: 'boat', k: 'skiff', x: 0, z: 0, h: 0, o: true, r: 'biggame', i: 'skirt', ex: 30, ez: 40, hk: 7 };
  const p = cleanPose({ ...base, xl: 123.4, sl: 47.6 });
  assert.equal(p.xl, 123);
  assert.equal(p.sl, 48);
  assert.equal(cleanPose({ ...base, xl: -5, sl: 140 }).xl, 0, 'negative line clamped to none');
  assert.equal(cleanPose({ ...base, xl: 10, sl: 140 }).sl, 100, 'over 100% clamped');
  const junk = cleanPose({ ...base, xl: 'lots', sl: NaN });
  assert.equal(junk.xl, undefined);
  assert.equal(junk.sl, undefined);
  // (Without a fish on, neither is kept.)
  const off = cleanPose({ ...base, o: false, xl: 50, sl: 40 });
  assert.equal(off.xl, undefined);
  assert.equal(off.sl, undefined);
});
