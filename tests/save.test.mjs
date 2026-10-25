// Saves: loading, the version upgrades, the backup and unreadable copies, the newer-version
// guard, full storage, and combining two saves. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'slow-tide-save';
const BACKUP = 'slow-tide-save-backup';
const UNREADABLE = 'slow-tide-save-unreadable';

// save.js keeps its status (can it save, is this the first save) per page load, so each test
// loads a fresh copy of it, as a new page would.
let loads = 0;
const freshSave = () => import(`../src/save.js?load=${++loads}`);
const put = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
const env = (version, data) => ({ game: 'slow-tide', version, savedAt: 1000, data });
const catchEntry = (id, sp = 'carp', size = 60) => ({ id, sp, size, day: 2, hour: 9, zone: 'lake', kind: 'ledger', rod: 'carp', item: 'boilie', from: 'shore' });

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

test('a new player starts from the defaults, first-person fishing view included', async () => {
  const S = await freshSave();
  const { state, outcome } = S.loadGame();
  assert.equal(outcome, 'new');
  assert.equal(state.day, 1);
  assert.equal(state.difficulty, 'standard');
  assert.equal(state.fishView, 'first');
  assert.deepEqual(state.log, []);
});

test('every fresh start comes with a full set of settings (the game reads them as it starts)', async () => {
  const outcomes = {};
  for (const stored of [null, 'not json at all', JSON.stringify(env(99, { day: 50 }))]) {
    globalThis.localStorage = new MemoryStorage();
    if (stored) put(KEY, stored);
    const S = await freshSave();
    const { state, outcome } = S.loadGame();
    outcomes[outcome] = true;
    assert.ok(state.settings, `${outcome}: settings are there`);
    assert.equal(typeof state.settings.audio.master, 'number');
    assert.equal(typeof state.settings.controls, 'object');
  }
  assert.deepEqual(Object.keys(outcomes).sort(), ['new', 'newer', 'unreadable']);
});

test('a save comes back exactly as it was written', async () => {
  let S = await freshSave();
  const { state } = S.loadGame();
  state.day = 4;
  state.fishView = 'shoulder';
  state.log.push(catchEntry('c1'));
  state.fish.carp = { count: 1, best: 60 };
  assert.equal(S.saveGame(state), true);
  S = await freshSave();
  const back = S.loadGame();
  assert.equal(back.outcome, 'loaded');
  assert.equal(back.state.day, 4);
  assert.equal(back.state.fishView, 'shoulder');
  assert.equal(back.state.log.length, 1);
  assert.equal(back.state.log[0].sp, 'carp');
});

test('a version 1 save (no envelope) upgrades with an empty catch log', async () => {
  put(KEY, { hour: 8, day: 3, fish: { carp: { count: 2, best: 70 } } });
  const S = await freshSave();
  const { state, outcome } = S.loadGame();
  assert.equal(outcome, 'loaded');
  assert.equal(state.day, 3);
  assert.equal(state.fish.carp.count, 2);
  assert.deepEqual(state.log, []);
});

test('a version 2 save upgrades to one boat in use and the skiff at its mooring', async () => {
  put(KEY, env(2, { day: 2, boat: { x: 5, z: 6, heading: 1 }, log: [catchEntry('c9', 'rudd', 20)] }));
  const S = await freshSave();
  const { state, outcome } = S.loadGame();
  assert.equal(outcome, 'loaded');
  assert.equal(state.vessel, 'row');
  assert.equal(state.boats.skiff, undefined);
  assert.equal(state.boats.row.x, 5);
  assert.equal(state.log[0].id, 'c9');
});

test('an unreadable save is kept aside and the backup is used', async () => {
  put(BACKUP, env(3, { day: 7 }));
  put(KEY, '{"game":"slow-tide", broken');
  const S = await freshSave();
  const { state, outcome } = S.loadGame();
  assert.equal(outcome, 'backup');
  assert.equal(state.day, 7);
  assert.equal(localStorage.getItem(UNREADABLE), '{"game":"slow-tide", broken');
  // The next save doesn't replace the good backup with the broken text.
  S.saveGame(state);
  assert.equal(JSON.parse(localStorage.getItem(BACKUP)).data.day, 7);
});

test('an unreadable save with no backup starts fresh but keeps the text', async () => {
  put(KEY, 'not json at all');
  const S = await freshSave();
  const { outcome } = S.loadGame();
  assert.equal(outcome, 'unreadable');
  assert.equal(localStorage.getItem(UNREADABLE), 'not json at all');
});

test('a save from a newer version of the game is never written over', async () => {
  const newer = JSON.stringify(env(99, { day: 50 }));
  put(KEY, newer);
  const S = await freshSave();
  const { outcome, state } = S.loadGame();
  assert.equal(outcome, 'newer');
  assert.equal(S.saveStatus.canSave, false);
  assert.equal(S.saveGame(state), false);
  assert.equal(localStorage.getItem(KEY), newer);
});

test('the first save of a session keeps the previous save as a backup', async () => {
  put(KEY, env(3, { day: 5 }));
  const S = await freshSave();
  const { state } = S.loadGame();
  state.day = 6;
  S.saveGame(state);
  assert.equal(JSON.parse(localStorage.getItem(BACKUP)).data.day, 5);
  assert.equal(JSON.parse(localStorage.getItem(KEY)).data.day, 6);
});

test('full storage reports failure instead of throwing, and saving works again later', async () => {
  const S = await freshSave();
  const { state } = S.loadGame();
  localStorage.full = true;
  assert.equal(S.saveGame(state), false);
  localStorage.full = false;
  assert.equal(S.saveGame(state), true);
});

test('junk in a save is cleaned up rather than trusted', async () => {
  const S = await freshSave();
  const s = S.sanitize({
    hour: 99, day: -3, difficulty: 'impossible', fishView: 'sideways', quality: 'maximum',
    fish: { carp: { count: 2, best: 60 }, dragon: { count: 9 } },
    log: [catchEntry('ok'), { sp: 'dragon', size: 900 }, 'nonsense'],
    boats: { row: { x: 1e9, z: 0 }, kayak: { x: 3, z: 4 }, yacht: { x: 1, z: 1 } },
    vessel: 'yacht',
  });
  assert.ok(s.hour < 24);
  assert.ok(s.day >= 1);
  assert.equal(s.difficulty, 'standard');
  assert.equal(s.fishView, 'first');
  assert.equal(s.quality, 'auto');
  assert.ok(s.fish.carp && !s.fish.dragon);
  assert.equal(s.log.length, 1);
  assert.equal(s.boats.row, undefined);
  assert.equal(s.boats.kayak.x, 3);
  assert.equal(s.boats.yacht, undefined);
  assert.equal(s.vessel, 'row');
});

test('combining two saves keeps every catch once and this device’s settings', async () => {
  const S = await freshSave();
  const a = S.sanitize({ day: 3, fishView: 'shoulder', log: [catchEntry('c1'), catchEntry('c2')], fish: { carp: { count: 2, best: 60 } } });
  const b = S.sanitize({ day: 5, fishView: 'first', log: [catchEntry('c2'), catchEntry('c3', 'pike', 80)], fish: { pike: { count: 1, best: 80 } } });
  const m = S.mergeStates(a, b, 'b');
  assert.deepEqual(m.log.map((e) => e.id).sort(), ['c1', 'c2', 'c3']);
  assert.ok(m.fish.carp && m.fish.pike);
  assert.equal(m.day, 5);           // where you are comes from the chosen side
  assert.equal(m.fishView, 'shoulder'); // settings stay with this device
});

test('a downloaded copy reads back in', async () => {
  const S = await freshSave();
  const st = S.sanitize({ day: 9, log: [catchEntry('c5')] });
  const parsed = S.parseSave(S.exportText(st));
  assert.equal(parsed.state.day, 9);
  assert.equal(parsed.state.log[0].id, 'c5');
});

test('a version 3 save moves its two boats into the boat list, and the new boats start moored', async () => {
  put(KEY, env(3, { day: 4, boat: { x: 5, z: 6, heading: 1, anchored: true }, skiff: { x: -80, z: -3 }, vessel: 'skiff' }));
  const S = await freshSave();
  const { state } = S.loadGame();
  assert.deepEqual(state.boats.row, { x: 5, z: 6, heading: 1, anchored: true });
  assert.equal(state.boats.skiff.x, -80);
  assert.equal(state.boats.kayak, undefined);
  assert.equal(state.vessel, 'skiff');
  assert.equal(state.seen, '');
});

test('the explored map and where each catch was made are kept, and junk in them is not', async () => {
  const S = await freshSave();
  const ok = S.sanitize({ seen: 'AAEC/w==', log: [{ ...catchEntry('a'), x: 12.4, z: -30 }, catchEntry('b')] });
  assert.equal(ok.seen, 'AAEC/w==');
  assert.equal(ok.log[0].x, 12.4);
  assert.equal(ok.log[1].x, null);
  const bad = S.sanitize({ seen: '<script>', log: [{ ...catchEntry('c'), x: 'far', z: 1e9 }] });
  assert.equal(bad.seen, '');
  assert.equal(bad.log[0].x, null);
  assert.equal(bad.log[0].z, 3000);
});
