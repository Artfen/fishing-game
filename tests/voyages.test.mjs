// Voyages (G1): a voyage begun when she leaves a berth, what happens on it noted, kept only if it
// was one (offshore, a night out, a crossing, a job, half a day away), named, written up for the
// journal and her papers, and kept through a save. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const V_ = await import('../src/voyages.js');
const { newVoyage, onVoyage, worthKeeping, finishVoyage, keepVoyage, voyageTitle, voyageWords, papersLine, cleanVoyage, cleanVoyages, VOYAGES_KEPT, LONG_HOURS } = V_;
const { parseSave, SAVE_VERSION } = await import('../src/save.js');

const start = (over = {}) => newVoyage({ day: 4, hour: 7.5, abs: 4 * 24 + 7.5, kind: 'rib', from: 'Willowhaven', x: 0, z: 0, ...over });

test('a voyage notes what happens on it: how far, the furthest and where, boats, places, fish and the best, sea life, gales, crossings, jobs, her log', () => {
  const V = start();
  onVoyage(V, { k: 'move', m: 1500, x: 0, z: 1500, where: 'the Blue Water' });
  onVoyage(V, { k: 'move', m: 900, x: 0, z: 900, where: 'the outer coast' });
  assert.equal(V.m, 2400);
  assert.equal(V.far, 1500, 'the furthest from where she set out');
  assert.equal(V.farAt, 'the Blue Water', 'and where that was, not where she is now');
  onVoyage(V, { k: 'boat', kind: 'rib' });
  onVoyage(V, { k: 'boat', kind: 'console' });
  assert.deepEqual(V.boats, ['rib', 'console'], 'each boat once');
  onVoyage(V, { k: 'fish', sp: 'mackerel', name: 'Atlantic mackerel', kg: 0.4, kept: true });
  onVoyage(V, { k: 'fish', sp: 'tuna', name: 'bluefin tuna', kg: 41.2 });
  onVoyage(V, { k: 'fish', sp: 'pollack', name: 'pollack', kg: 2.1 });
  assert.equal(V.fish, 3);
  assert.equal(V.kept, 1);
  assert.deepEqual(V.best, { sp: 'tuna', name: 'bluefin tuna', kg: 41.2 }, 'the best of them by weight');
  onVoyage(V, { k: 'life', kind: 'commondolphin' });
  onVoyage(V, { k: 'life', kind: 'commondolphin' });
  assert.deepEqual(V.life, ['commondolphin']);
  onVoyage(V, { k: 'gale' });
  onVoyage(V, { k: 'cross', to: 'south', stage: 'nowhere' });
  assert.equal(V.cross.length, 0, 'not a stage there is');
  onVoyage(V, { k: 'job', title: '<b>Whale-watching charter</b>' });
  assert.deepEqual(V.jobs, ['b Whale-watching charter /b'], 'plain words');
  onVoyage(V, { k: 'log', day: 4, text: 'Holed below the waterline: taking water.' });
  onVoyage(V, { k: 'log', day: 4, text: 'Holed below the waterline: taking water.' });
  assert.equal(V.log.length, 1, 'the same line again the same day: once');
  for (let i = 0; i < 30; i++) onVoyage(V, { k: 'log', day: 4, text: `Line ${i}` });
  assert.equal(V.log.length, 16, 'her log, the last few lines');
  assert.equal(V.log[15].text, 'Line 29');
});

test('kept only if it was a voyage: offshore, a night out, a crossing, a job, or half a day away from a berth', () => {
  const at = (V, more = {}) => worthKeeping(V, { day: 4, abs: V.abs + 2, offshoreAt: 1200, ...more });
  const bay = start();
  onVoyage(bay, { k: 'move', m: 400, x: 200, z: 100 });
  assert.equal(at(bay), false, 'round the bay and back: not a voyage');
  const out = start();
  onVoyage(out, { k: 'move', m: 2000, x: 0, z: 1600 });
  assert.equal(at(out), true, 'offshore');
  assert.equal(at(start(), { day: 5 }), true, 'a night out');
  assert.equal(at(start(), { abs: 4 * 24 + 7.5 + LONG_HOURS }), true, 'half a day away');
  const job = start();
  onVoyage(job, { k: 'job', title: 'Freight to Wend Quay' });
  assert.equal(at(job), true, 'a job done');
  const cross = start();
  onVoyage(cross, { k: 'cross', to: 'south', stage: 'out' });
  assert.equal(at(cross), true, 'a crossing');
});

test('named for its crossing, or where it reached; written up for the journal and her papers', () => {
  const T = (cross, farAt = '') => voyageTitle({ cross, farAt });
  assert.equal(T([{ to: 'south', stage: 'out' }, { to: 'south', stage: 'in' }, { to: 'home', stage: 'out' }, { to: 'home', stage: 'in' }]), 'To Las Brasas and back');
  assert.equal(T([{ to: 'south', stage: 'in' }]), 'Across to Las Brasas');
  assert.equal(T([{ to: 'home', stage: 'in' }]), 'Home from Las Brasas');
  assert.equal(T([{ to: 'south', stage: 'back' }]), 'Out towards Las Brasas, and back');
  assert.equal(T([], 'the Blue Water'), 'Out to the Blue Water');
  assert.equal(T([]), 'Along the coast');
  const V = start();
  onVoyage(V, { k: 'move', m: 7000, x: 0, z: 4100, where: 'the Blue Water' });
  onVoyage(V, { k: 'fish', sp: 'tuna', name: 'bluefin tuna', kg: 41.2 });
  onVoyage(V, { k: 'fish', sp: 'mackerel', name: 'Atlantic mackerel', kg: 0.4, kept: true });
  onVoyage(V, { k: 'life', kind: 'commondolphin' });
  onVoyage(V, { k: 'gale' });
  onVoyage(V, { k: 'log', day: 5, text: 'Night at anchor off the Kelp Forest.' });
  const R = finishVoyage(V, { day: 6, hour: 18.25, abs: 6 * 24 + 18.25, to: 'Willowhaven' });
  assert.equal(R.title, 'Out to the Blue Water');
  assert.equal(R.nights, 2);
  assert.equal(R.nm, 3.8);
  assert.equal(R.hours, 58.8);
  const W = voyageWords(R, { boat: (k) => ({ rib: 'RIB' })[k] || k, life: (k) => ({ commondolphin: 'common dolphins' })[k] || k });
  assert.equal(W.when, 'Day 4, 7:30am to day 6, 6:15pm');
  assert.deepEqual(W.lines, [
    'From Willowhaven to Willowhaven, in the RIB: 3.8 nm, 4.1 km out at the furthest (the Blue Water).',
    'Two nights out.',
    'Two fish (1 kept), the best a bluefin tuna of 41.2 kg.',
    'Saw common dolphins.',
    'Weathered a gale.',
  ]);
  assert.deepEqual(W.log, ['Day 5: Night at anchor off the Kelp Forest.']);
  assert.equal(papersLine(R), 'Out to the Blue Water: 3.8 nm, 2 nights out, 2 fish.');
  const list = [];
  for (let i = 0; i < VOYAGES_KEPT + 5; i++) keepVoyage(list, { ...R, day: i });
  assert.equal(list.length, VOYAGES_KEPT, 'the last forty');
  assert.equal(list[0].day, 5);
});

test('kept through a save: the voyage under way and those written up; junk dropped; an older save has made none', () => {
  const V = start();
  onVoyage(V, { k: 'move', m: 1200, x: 0, z: 1200, where: 'the Blue Water' });
  onVoyage(V, { k: 'fish', sp: 'tuna', name: 'bluefin tuna', kg: 41.2 });
  assert.deepEqual(cleanVoyage(JSON.parse(JSON.stringify(V))), V);
  assert.equal(cleanVoyage({ day: 'x' }), null);
  const R = finishVoyage(V, { day: 4, hour: 20, abs: V.abs + 12.5, to: 'Willowhaven' });
  const kept = cleanVoyages([R, 'junk', { title: 'no end' }]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].title, 'Out to the Blue Water');
  assert.deepEqual(kept[0].end, R.end);
  const wrap = (data) => JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data });
  const back = parseSave(wrap({ day: 6, voyage: V, voyages: [R] }));
  assert.ok(back.state.voyage && back.state.voyage.far === 1200, 'under way');
  assert.equal(back.state.voyages[0].title, 'Out to the Blue Water');
  const old = parseSave(wrap({ day: 3 }));
  assert.equal(old.state.voyage, null);
  assert.deepEqual(old.state.voyages, []);
});

// (J4) Found playing the brief's Part J day through (docs/PLAYTHROUGH.md, finding 5): Bert's
// mackerel, landed from Mags's RIB, was in his log but her voyage said "0 fish".
test('a friend crewing aboard is in her voyage, and so are the fish they land from her, as theirs', () => {
  const V = start();
  onVoyage(V, { k: 'crew', name: 'Bert' });
  onVoyage(V, { k: 'crew', name: 'Bert' });
  onVoyage(V, { k: 'crew', name: '' });
  assert.deepEqual(V.crew, ['Bert'], 'once each, and only a name');
  onVoyage(V, { k: 'fish', sp: 'mackerel', name: 'Atlantic mackerel', kg: 0.41, by: 'Bert' });
  onVoyage(V, { k: 'fish', sp: 'pollack', name: 'pollack', kg: 0.3 });
  assert.equal(V.fish, 2, 'hers and his, both aboard her');
  assert.equal(V.crewFish, 1);
  assert.deepEqual(V.best, { sp: 'mackerel', name: 'Atlantic mackerel', kg: 0.41, by: 'Bert' }, 'his the best, and said so');
  // (A fish of a crewmate's who wasn't named yet: they're aboard now.)
  onVoyage(V, { k: 'fish', sp: 'bass', name: 'bass', kg: 0.2, by: 'Cass' });
  assert.deepEqual(V.crew, ['Bert', 'Cass']);
  const R = finishVoyage(V, { day: 5, hour: 9, abs: 5 * 24 + 9, to: 'Willowhaven' });
  assert.deepEqual([R.crew, R.crewFish], [['Bert', 'Cass'], 2]);
  assert.match(papersLine(R), /, 3 fish, with Bert and Cass\.$/);
  const W = voyageWords(R, { boat: () => 'RIB' });
  assert.match(W.lines[0], /^From Willowhaven to Willowhaven, in the RIB with Bert and Cass:/);
  assert.ok(W.lines.includes('Three fish (two of them the crew’s), the best an Atlantic mackerel of 410 g, Bert’s.'), JSON.stringify(W.lines));
  // (All of them one crewmate's.)
  const V2 = start();
  onVoyage(V2, { k: 'fish', sp: 'mackerel', name: 'Atlantic mackerel', kg: 0.41, by: 'Bert' });
  const W2 = voyageWords(finishVoyage(V2, { day: 4, hour: 20, abs: 4 * 24 + 20, to: 'Willowhaven' }));
  assert.ok(W2.lines.includes('One fish (all Bert’s), the best an Atlantic mackerel of 410 g, Bert’s.'), JSON.stringify(W2.lines));
  // (Your own alone: as before, no crew mentioned.)
  const V3 = start();
  onVoyage(V3, { k: 'fish', sp: 'pollack', name: 'pollack', kg: 2.1 });
  const R3 = finishVoyage(V3, { day: 4, hour: 20, abs: 4 * 24 + 20, to: 'Willowhaven' });
  assert.equal(papersLine(R3), `${R3.title}: 0 nm, 1 fish.`);
  assert.ok(voyageWords(R3).lines.includes('One fish, the best a pollack of 2.1 kg.'));
});

test('the crew and their fish are kept through a save; an older save has none', () => {
  const V = start();
  onVoyage(V, { k: 'fish', sp: 'mackerel', name: 'Atlantic mackerel', kg: 0.41, by: 'Bert' });
  const back = cleanVoyage(JSON.parse(JSON.stringify(V)));
  assert.deepEqual([back.crew, back.crewFish, back.best.by], [['Bert'], 1, 'Bert']);
  const R = cleanVoyages([JSON.parse(JSON.stringify(finishVoyage(V, { day: 5, hour: 9, abs: 5 * 24 + 9, to: 'Willowhaven' })))])[0];
  assert.deepEqual([R.crew, R.crewFish, R.best.by], [['Bert'], 1, 'Bert']);
  // (Older: no crew, no crewFish; and never more of the crew's fish than fish.)
  const { crew, crewFish, ...old } = JSON.parse(JSON.stringify(V));
  const O = cleanVoyage(old);
  assert.deepEqual([O.crew, O.crewFish], [[], 0]);
  assert.equal(cleanVoyage({ ...JSON.parse(JSON.stringify(V)), crewFish: 9 }).crewFish, 1);
  // (Names as plain words, and only names.)
  assert.deepEqual(cleanVoyage({ ...JSON.parse(JSON.stringify(V)), crew: ['<b>Bert</b>', 7] }).crew, ['b Bert /b']);
});
