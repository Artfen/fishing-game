// Watching over the seasons (G3): each sighting noted against its season and place, read back in
// words for the journal's notes, kept through a save; and the photographs as a collection of their
// own. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const W = await import('../src/watching.js');
const { seasonOf, SEASON_DAYS } = await import('../src/world/season.js');
const { parseSave, SAVE_VERSION } = await import('../src/save.js');
const { goalsOf } = await import('../src/goals.js');

// A day in each season (the year begins half way through spring).
const dayIn = (name) => Array.from({ length: SEASON_DAYS * 4 }, (_, i) => i + 1).find((d) => seasonOf(d).name === name);

test('each sighting noted against its season and the place; the most-seen places kept', () => {
  const R = { n: 1 };
  for (let i = 0; i < 7; i++) W.noteSighting(R, { day: dayIn('summer'), where: 'the Kelp Forest' });
  for (let i = 0; i < 3; i++) W.noteSighting(R, { day: dayIn('spring'), where: 'Gull Rock' });
  W.noteSighting(R, { day: dayIn('autumn'), where: 'the Kelp Forest' });
  assert.deepEqual(R.s, [3, 7, 1, 0]);
  assert.deepEqual(R.at, { 'the Kelp Forest': 8, 'Gull Rock': 3 });
  assert.equal(W.seasonsWords(R), 'mostly in summer (7); in spring (3) and autumn (1) too');
  assert.equal(W.placesWords(R), 'the Kelp Forest and Gull Rock');
  // A one-off place drops away for one seen more often, once there are more than six.
  for (const p of ['A', 'B', 'C', 'D']) W.noteSighting(R, { day: 1, where: p });
  W.noteSighting(R, { day: 1, where: 'E' });
  assert.equal(Object.keys(R.at).length, W.AT_KEPT);
  assert.ok(R.at['the Kelp Forest'] && R.at['Gull Rock'], 'the places it’s mostly seen stay');
  // Nothing noted yet: nothing to say.
  assert.equal(W.seasonsWords({ n: 1 }), null);
  assert.equal(W.placesWords({ n: 1 }), null);
  assert.equal(W.seasonsWords({ s: [0, 0, 2, 0] }), 'only in autumn (2) so far');
});

test('kept through a save with the rest of the record; junk dropped; an older save has the first sighting only', () => {
  const wrap = (data) => JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data });
  const seaLife = { gannet: { n: 9, day: 3, hour: 10, where: 'Gull Rock', s: [2, 6, 1, 0], at: { 'Gull Rock': 5, '<b>': 2, 'the Kelp Forest': 4 } }, seal: { n: 2, day: 4, hour: 9, where: '', s: [1, 'x'] } };
  const back = parseSave(wrap({ day: 6, seaLife })).state.seaLife;
  assert.deepEqual(back.gannet.s, [2, 6, 1, 0]);
  assert.deepEqual(Object.keys(back.gannet.at).sort(), ['Gull Rock', 'b', 'the Kelp Forest'].sort(), 'plain words');
  assert.equal(back.seal.s, undefined, 'a season list that isn’t one');
  assert.equal(back.seal.n, 2, 'the rest kept');
  assert.deepEqual(W.cleanWatch({}), {});
});

test('the photographs as a collection: each kind with a picture of it, and the goal counts the wildlife', () => {
  const photos = [
    { subjects: { species: ['pollack'], sea: ['commondolphin'], life: ['cormorant'] } },
    { subjects: { species: [], sea: ['commondolphin'], nature: ['anemone'] } },
    { subjects: null },
  ];
  assert.deepEqual([...W.photographed(photos)].sort(), ['fish:pollack', 'nature:anemone', 'sea:commondolphin', 'sea:cormorant']);
  assert.equal(W.wildPhotographed(photos), 3, 'the wildlife, not the fish');
  const G = goalsOf({ fish: {}, photos }).find((g) => g.id === 'photos');
  assert.deepEqual([G.n, G.of, G.done], [3, W.WILD_GOAL, false]);
});
