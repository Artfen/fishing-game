// The desktop (Steam) build's bridge, from the game's side (src/desktop.js) and its achievements
// (src/achievements.js): in a browser nothing happens; on the desktop the save is mirrored for
// Steam Cloud, a computer with no save of its own starts from the mirrored one (never overwriting
// one it has, never taking junk), and achievements earned in the save are handed over once a
// session, under names Steamworks accepts. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, ACHIEVEMENT_IDS, earned } from '../src/achievements.js';
import { onDesktop, seedSave, mirrorSave, reportAchievements, _resetTold } from '../src/desktop.js';
import { newContracts } from '../src/contracts.js';
import { newStory, CHAPTERS } from '../src/story.js';

const when = { day: 1, hour: 9 };
const store = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), m };
};

test('achievements are earned from the save itself, under names Steamworks takes', () => {
  assert.equal(new Set(ACHIEVEMENT_IDS).size, ACHIEVEMENTS.length, 'no two alike');
  for (const a of ACHIEVEMENTS) assert.match(a.id, /^[A-Z0-9_]{2,40}$/);
  assert.deepEqual(earned({}), [], 'a new game: none');
  const fish = Object.fromEntries(['mackerel', 'pollack', 'bass', 'garfish', 'wrasse', 'sole', 'plaice', 'perch', 'pike', 'roach'].map((id) => [id, { n: 1, best: 10 }]));
  const s = {
    fish, tips: { brasa: true }, adventures: { kittiwake: { done: when } },
    contracts: Object.assign(newContracts(), { count: 15 }), story: Object.assign(newStory(), { ch: CHAPTERS.length }),
  };
  const got = earned(s, { places: [3, 40] });
  for (const id of ['FIRST_FISH', 'TEN_KINDS', 'LAS_BRASAS', 'FIRST_JOB', 'SKIPPER', 'MASTER', 'KITTIWAKE', 'FIFTH_NAME']) assert.ok(got.includes(id), id);
  assert.ok(!got.includes('ALL_KINDS') && !got.includes('PLACES'), 'not the ones not done');
  assert.ok(earned({ ...s, contracts: Object.assign(newContracts(), { count: 8 }) }).includes('SKIPPER'));
  assert.ok(!earned({ ...s, contracts: Object.assign(newContracts(), { count: 8 }) }).includes('MASTER'));
  assert.ok(earned({}, { places: [40, 40] }).includes('PLACES'));
});

test('in a browser the bridge is absent and nothing happens', () => {
  delete globalThis.slowTideDesktop;
  assert.equal(onDesktop(), false);
  const S = store();
  assert.equal(seedSave(S, 'k'), false);
  assert.equal(mirrorSave('{}'), false);
  assert.deepEqual(reportAchievements({ fish: { bass: {} } }), []);
});

test('on the desktop: the save mirrored, a fresh computer seeded from it, achievements told once', () => {
  const sent = { mirror: [], achieve: [] };
  let file = JSON.stringify({ game: 'slow-tide', version: 6, data: { day: 9 } });
  globalThis.slowTideDesktop = { mirror: (t) => sent.mirror.push(t), mirrored: () => file, achieve: (id) => sent.achieve.push(id) };
  try {
    assert.equal(onDesktop(), true);
    // A computer with no save: the mirrored one.
    const fresh = store();
    assert.equal(seedSave(fresh, 'slow-tide-save'), true);
    assert.equal(fresh.get('slow-tide-save'), file);
    // One with its own: left alone.
    const mine = store({ 'slow-tide-save': '{"mine":1}' });
    assert.equal(seedSave(mine, 'slow-tide-save'), false);
    assert.equal(mine.get('slow-tide-save'), '{"mine":1}');
    // Junk in the file, or none: nothing taken.
    for (const bad of ['', 'not a save', '{broken', null]) {
      file = bad;
      const S = store();
      assert.equal(seedSave(S, 'slow-tide-save'), false, String(bad));
      assert.equal(S.get('slow-tide-save'), null);
    }
    // Mirrored on save.
    assert.equal(mirrorSave('{"a":1}'), true);
    assert.deepEqual(sent.mirror, ['{"a":1}']);
    // Achievements: each once a session.
    _resetTold();
    assert.deepEqual(reportAchievements({ fish: { bass: { best: 30 } } }), ['FIRST_FISH']);
    assert.deepEqual(reportAchievements({ fish: { bass: { best: 30 } } }), []);
    assert.deepEqual(sent.achieve, ['FIRST_FISH']);
    // A bridge that throws doesn't break the game.
    globalThis.slowTideDesktop = { mirror: () => { throw new Error('x'); }, mirrored: () => { throw new Error('x'); }, achieve: () => { throw new Error('x'); } };
    assert.equal(mirrorSave('{}'), false);
    assert.equal(seedSave(store(), 'k'), false);
    _resetTold();
    assert.doesNotThrow(() => reportAchievements({ fish: { bass: {} } }));
  } finally {
    delete globalThis.slowTideDesktop;
  }
});

test('the desktop app keeps the save’s file whole, reads it back, refuses junk; no Steam without an app id', async () => {
  const { createRequire } = await import('node:module');
  const Module = (await import('node:module')).default;
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slow-tide-desktop-'));
  const handlers = {};
  const fake = {
    app: { getPath: (k) => (k === 'exe' ? path.join(dir, 'Slow Tide') : dir), whenReady: () => new Promise(() => {}), on() {} },
    BrowserWindow: class {}, protocol: { registerSchemesAsPrivileged() {}, handle() {} }, net: {},
    ipcMain: { on: (ch, fn) => { handlers[ch] = fn; } },
  };
  fake.app.commandLine = { appendSwitch() {} };
  const load = Module._load;
  Module._load = function (req, ...rest) { return req === 'electron' ? fake : load.call(this, req, ...rest); };
  try {
    delete process.env.STEAM_APP_ID;
    createRequire(import.meta.url)('../desktop/main.cjs');
  } finally {
    Module._load = load;
  }
  const read = () => { const e = {}; handlers['save:read'](e); return e.returnValue; };
  assert.equal(read(), null, 'no file yet');
  const save = JSON.stringify({ game: 'slow-tide', data: { day: 3 } });
  handlers['save:mirror']({}, save);
  assert.equal(read(), save);
  assert.ok(fs.existsSync(path.join(dir, 'saves', 'slow-tide-save.json')));
  assert.ok(!fs.existsSync(path.join(dir, 'saves', 'slow-tide-save.json.tmp')), 'written whole, then put in place');
  // Junk never replaces it.
  for (const bad of ['not json', '{broken', 42, 'x'.repeat(10)]) handlers['save:mirror']({}, bad);
  assert.equal(read(), save);
  // No app id: achievements go nowhere (and nothing throws).
  assert.doesNotThrow(() => handlers['steam:achieve']({}, 'FIRST_FISH'));
  fs.rmSync(dir, { recursive: true, force: true });
});
