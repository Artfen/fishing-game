// The Fifth Name (src/story.js): told in order, one chapter at a time, each finished by something
// the game already knows (adventures done, places reached), with what was done early counting in
// its turn, a card at a time and never a flood; the last scene wants Wenna aboard at Willowhaven in
// a boat with a seat, the buoy in the evening light, and home; it ends, with its keepsakes, and is
// kept in the save. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as St from '../src/story.js';
import { KEEPSAKES } from '../src/adventures.js';
import { sanitize } from '../src/save.js';

const when = { day: 4, hour: 10 };
const far = { light: 5000, puerto: 9000, office: 400, buoy: 600 };
const x = (o = {}) => ({ adv: {}, near: far, home: false, boat: null, seats: 0, slow: false, dusk: false, when, ...o, near: { ...far, ...(o.near || {}) } });
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { done: when }]));

test('told in order, each chapter by what the game knows; early deeds count in turn, a card at a time', () => {
  const S = St.newStory();
  assert.equal(St.tick(S, x(), 0), null, 'nothing until the Kittiwake’s found');
  assert.match(St.todo(S), /notice board/);
  // The bell and Tam's slate done before the Kittiwake: nothing yet (the story starts with her).
  assert.equal(St.tick(S, x({ adv: done('bell', 'watch') }), 1), null);
  // Found her: the first card.
  const adv = done('kittiwake', 'bell', 'watch');
  let r = St.tick(S, x({ adv }), 2);
  assert.equal(r.chapter, 'wreck');
  assert.match(r.card.text, /five aboard/);
  assert.ok(St.begun(S));
  // The bell's already done, but its card waits its turn (a few seconds), then comes.
  assert.equal(St.tick(S, x({ adv }), 5), null, 'not straight after the last');
  r = St.tick(S, x({ adv }), 15);
  assert.equal(r.chapter, 'bell');
  assert.match(r.card.text, /Joe Penhallow/);
  r = St.tick(S, x({ adv }), 28);
  assert.equal(r.chapter, 'slate');
  assert.equal(St.aim(S), 'light');
  // The keeper's log: within reach of the light, not before.
  assert.equal(St.tick(S, x({ adv, near: { light: 400 } }), 50), null);
  r = St.tick(S, x({ adv, near: { light: 90 } }), 51);
  assert.equal(r.chapter, 'light');
  assert.match(r.card.text, /VIRGEN DEL CARMEN/);
  assert.equal(St.aim(S), 'puerto');
  // Puerto Brasa: Chano, and the letter to keep.
  r = St.tick(S, x({ adv, near: { puerto: 40 } }), 70);
  assert.equal(r.chapter, 'south');
  assert.equal(r.keepsake, 'letter');
  assert.ok(KEEPSAKES.letter && KEEPSAKES.stone, 'its keepsakes are in the journal’s list');
  // Home to Wenna at the harbour office (or stopped in the harbour).
  r = St.tick(S, x({ adv, near: { office: 12 } }), 90);
  assert.equal(r.chapter, 'home');
  assert.equal(St.current(S).id, 'dusk');
  assert.match(St.todo(S), /Wenna/);
  // The record of when each was told.
  assert.deepEqual(Object.keys(S.at), ['wreck', 'bell', 'slate', 'light', 'south', 'home']);
});

function atDusk() {
  const S = St.newStory();
  S.ch = St.CHAPTER_IDS.indexOf('dusk');
  return S;
}

test('the last scene: Wenna aboard in a boat with a seat, the buoy at dusk, home; then it ends', () => {
  const S = atDusk();
  assert.equal(St.aim(S), 'haven');
  // The kayak has no seat for her.
  assert.equal(St.tick(S, x({ home: true, boat: 'kayak', seats: 0 }), 0), null);
  assert.equal(S.wenna, null);
  // The skiff: aboard, 80 kg in her.
  let r = St.tick(S, x({ home: true, boat: 'skiff', seats: 2 }), 1);
  assert.ok(r.aboard);
  assert.equal(S.wenna, 'skiff');
  assert.equal(St.storyKg(S, 'skiff'), 80);
  assert.equal(St.storyKg(S, 'rib'), 0);
  assert.equal(St.aim(S), 'buoy');
  // Moved over to the RIB before going: she comes too.
  r = St.tick(S, x({ home: true, boat: 'rib', seats: 5 }), 2);
  assert.equal(S.wenna, 'rib');
  // At the buoy at midday: not yet (said once).
  r = St.tick(S, x({ boat: 'rib', slow: true, near: { buoy: 10 }, dusk: false }), 3);
  assert.match(r.toast, /Not yet/);
  assert.equal(St.tick(S, x({ boat: 'rib', slow: true, near: { buoy: 10 }, dusk: false }), 4), null);
  assert.equal(S.laid, false);
  // In another boat, or racing past at dusk: no.
  St.tick(S, x({ boat: 'skiff', slow: true, near: { buoy: 10 }, dusk: true }), 5);
  St.tick(S, x({ boat: 'rib', slow: false, near: { buoy: 10 }, dusk: true }), 6);
  assert.equal(S.laid, false);
  // Slow by the buoy in the evening light: the flowers on the water.
  r = St.tick(S, x({ boat: 'rib', slow: true, near: { buoy: 12 }, dusk: true }), 7);
  assert.ok(r.laid);
  assert.equal(St.aim(S), 'haven');
  assert.match(St.todo(S), /home/);
  // Home: the end, its card and the keepsake; she's ashore.
  r = St.tick(S, x({ home: true, boat: 'rib', seats: 5 }), 30);
  assert.equal(r.chapter, 'dusk');
  assert.ok(r.end);
  assert.equal(r.keepsake, 'stone');
  assert.match(r.card.text, /CAME HOME/);
  assert.ok(St.finished(S));
  assert.equal(S.wenna, null);
  assert.equal(St.storyKg(S, 'rib'), 0);
  assert.equal(St.todo(S), null);
  assert.equal(St.aim(S), null);
  assert.equal(St.tick(S, x({ home: true, boat: 'rib', seats: 5 }), 99), null, 'told once');
});

test('kept in the save, and a bad record made safe', () => {
  const S = atDusk();
  S.at.wreck = { day: 2, hour: 9.5 };
  St.tick(S, x({ home: true, boat: 'rib', seats: 5 }), 0);
  const back = sanitize(JSON.parse(JSON.stringify({ day: 5, story: S }))).story;
  assert.equal(back.ch, S.ch);
  assert.equal(back.wenna, 'rib');
  assert.deepEqual(back.at.wreck, { day: 2, hour: 9.5 });
  assert.deepEqual(sanitize({}).story, { ...St.newStory() }, 'an old save starts at the beginning');
  // Junk: chapters out of range, Wenna aboard outside the last scene, an unknown boat, laid without her.
  assert.equal(St.cleanStory({ ch: 99 }).ch, St.CHAPTERS.length);
  assert.equal(St.cleanStory({ ch: 2, wenna: 'rib', laid: true }).wenna, null);
  assert.equal(St.cleanStory({ ch: St.CHAPTER_IDS.indexOf('dusk'), wenna: 'galleon' }, ['rib']).wenna, null);
  assert.equal(St.cleanStory({ ch: St.CHAPTER_IDS.indexOf('dusk'), laid: true }).laid, false);
  assert.deepEqual(St.cleanStory({ at: { wreck: { day: 'x' }, nope: { day: 1, hour: 2 } } }).at, {});
  // Every chapter has its words.
  for (const C of St.CHAPTERS) assert.ok(C.title && C.card?.text && (C.todo || C.id === 'dusk'), C.id);
});
