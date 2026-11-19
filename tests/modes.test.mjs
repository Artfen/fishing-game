// Career and Free Roam, and save slots (docs/MODES.md): a Free Roam game owns every boat with the
// board open to it and a purse, a Career is the game as it always was (and every older save is
// one), and what Free Roam hands you isn't counted as earned; three games side by side in the
// browser, each kept whole through every switch, never falling back to another's backup, never
// lost when storage is full. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const P = await import('../src/playmode.js');
const SL = await import('../src/slots.js');
const { STARTER, PRICES } = await import('../src/shipyard.js');
const { career, CAREER, cleanContracts, newContracts } = await import('../src/contracts.js');
const { earned } = await import('../src/achievements.js');
const { earn } = await import('../src/economy.js');
let loads = 0;
const freshSave = () => import(`../src/save.js?modes=${++loads}`);

test('Free Roam: every boat yours, the board open as to a Master, a purse with its receipt', async () => {
  globalThis.localStorage = new MemoryStorage();
  const S = await freshSave();
  const s = S.loadGame().state;
  assert.equal(s.play, 'career', 'a new game is a Career unless chosen');
  assert.deepEqual([...s.yard.owned].sort(), [...STARTER].sort(), 'the camp’s three boats');
  assert.equal(career(s.contracts ?? newContracts()).rank.id, 'hand');
  const r = P.giveFree(s, earn);
  assert.equal(s.play, 'free');
  for (const k of [...STARTER, ...Object.keys(PRICES)]) assert.ok(s.yard.owned.includes(k), `owns the ${k}`);
  assert.ok(s.yard.owned.includes('trawler') && s.yard.owned.includes('tender'), 'the liveaboard and her tender');
  assert.equal(new Set(s.yard.owned).size, s.yard.owned.length, 'none twice');
  assert.equal(r.boats.length, Object.keys(PRICES).length);
  assert.equal(career(s.contracts).rank.id, CAREER.at(-1).id, 'trusted with anything');
  assert.equal(career(s.contracts).next, null);
  assert.equal(s.money, P.FREE_PURSE);
  assert.equal(s.ledger.at(-1).what, 'Free Roam: a purse to begin with');
  // Given again (a reload before it was marked): nothing doubled.
  P.giveFree(s, earn);
  assert.equal(s.money, P.FREE_PURSE);
  assert.equal(new Set(s.yard.owned).size, s.yard.owned.length);
  // Kept through a save, the board's openness with it.
  assert.ok(S.saveGame(s));
  const back = (await freshSave()).loadGame().state;
  assert.equal(back.play, 'free');
  assert.ok(back.yard.owned.includes('trawler'));
  assert.equal(career(back.contracts).rank.id, 'master');
});

test('a Career is the game as it was; every save from before is one; nonsense reads as Career', async () => {
  const { sanitize, DEFAULT_STATE } = await freshSave();
  assert.equal(sanitize({ ...structuredClone(DEFAULT_STATE), play: undefined }).play, 'career');
  for (const v of ['FREE', 'sandbox', 3, null, {}]) assert.equal(sanitize({ ...structuredClone(DEFAULT_STATE), play: v }).play, 'career');
  assert.equal(sanitize({ ...structuredClone(DEFAULT_STATE), play: 'free' }).play, 'free');
  assert.equal(cleanContracts({ ...newContracts(), free: 'yes' }).free, false, 'only true opens the board');
  assert.equal(cleanContracts({ ...newContracts(), count: 9 }).free, false);
  assert.equal(career(cleanContracts({ ...newContracts(), count: 9 })).rank.id, 'skipper', 'a Career still rises job by job');
});

test('what Free Roam hands you isn’t counted as earned there; everything you do still is', () => {
  const C = { ...newContracts(), count: 20 };
  const everything = { fish: { bass: { count: 1, best: 30 } }, contracts: C };
  const inCareer = earned({ ...everything, play: 'career' }, { boats: [13, 13] });
  const inFree = earned({ ...everything, play: 'free', contracts: { ...C, free: true } }, { boats: [13, 13] });
  for (const id of ['SKIPPER', 'MASTER']) assert.ok(inCareer.includes(id), `${id} in a Career`);
  for (const id of P.GIVEN_IN_FREE) assert.ok(!inFree.includes(id), `${id} not given in Free Roam`);
  assert.ok(inFree.includes('FIRST_FISH') && inFree.includes('FIRST_JOB'), 'your own catches and jobs count');
});

// A stand-in for the browser's storage, that can be made to fill up.
function storage() {
  const m = new Map();
  let full = null; // (key) => true when that write should fail
  return {
    m,
    get: (k) => (m.has(k) ? m.get(k) : null),
    set: (k, v) => {
      if (full?.(k)) throw new Error('QuotaExceededError');
      m.set(k, String(v));
    },
    remove: (k) => { m.delete(k); },
    fill: (f) => { full = f; },
  };
}
const keys = { KEY: 'slow-tide-save', BACKUP: 'slow-tide-save-backup' };

test('slots: switching keeps every game whole, both ways, and clears the backup', () => {
  const st = storage();
  assert.deepEqual(SL.readIndex(st), { active: 1, games: { 1: null, 2: null, 3: null } }, 'a browser from before: its one game is Game 1');
  st.set(keys.KEY, 'GAME-A');
  st.set(keys.BACKUP, 'GAME-A-EARLIER');
  SL.noteSaved(st, { play: 'career', day: 7, fish: { bass: { count: 3 } }, places: { bay: {} }, money: 55 }, 1000);
  assert.deepEqual(SL.readIndex(st).games[1], { play: 'career', day: 7, kinds: 1, caught: 3, places: 1, money: 55, savedAt: 1000 });
  assert.deepEqual(SL.filled(st, keys), { 1: true, 2: false, 3: false });
  // To an empty slot: A parked, nothing where the save lives (a new game begins), no backup.
  assert.deepEqual(SL.switchTo(st, keys, 2), { ok: true });
  assert.equal(st.get(SL.slotKey(1)), 'GAME-A');
  assert.equal(st.get(keys.KEY), null);
  assert.equal(st.get(keys.BACKUP), null, 'a damaged save can never fall back to the other game');
  assert.equal(SL.readIndex(st).active, 2);
  st.set(keys.KEY, 'GAME-B');
  SL.noteSaved(st, { play: 'free', day: 2, fish: {}, places: {}, money: 2000 }, 2000);
  assert.deepEqual(SL.filled(st, keys), { 1: true, 2: true, 3: false });
  // And back: exactly what was there.
  assert.deepEqual(SL.switchTo(st, keys, 1), { ok: true });
  assert.equal(st.get(keys.KEY), 'GAME-A');
  assert.equal(st.get(SL.slotKey(2)), 'GAME-B');
  assert.equal(st.get(SL.slotKey(1)), null, 'not kept twice');
  assert.equal(SL.readIndex(st).games[2].play, 'free', 'each keeps its own line');
  assert.deepEqual(SL.switchTo(st, keys, 1), { ok: true, same: true });
  assert.equal(SL.switchTo(st, keys, 4).ok, false);
  assert.equal(SL.switchTo(st, keys, 0).ok, false);
});

test('slots: storage too full to take it, at any step: nothing changes and nothing is lost', () => {
  for (const failing of [(k) => k === SL.slotKey(1), (k) => k === SL.INDEX_KEY, (k) => k === keys.KEY]) {
    const st = storage();
    st.set(keys.KEY, 'GAME-A');
    st.set(SL.slotKey(2), 'GAME-B');
    st.set(SL.INDEX_KEY, JSON.stringify({ active: 1, games: {} }));
    const before = new Map(st.m);
    st.fill(failing);
    const r = SL.switchTo(st, keys, 2);
    assert.equal(r.ok, false);
    assert.match(r.why, /too full/);
    assert.deepEqual(new Map(st.m), before, 'exactly as it was');
  }
});

test('slots: only a game you’re not playing can be deleted; what it held comes back to clean up after', () => {
  const st = storage();
  st.set(keys.KEY, 'GAME-A');
  st.set(SL.slotKey(3), 'GAME-C');
  st.set(SL.INDEX_KEY, JSON.stringify({ active: 1, games: { 3: { play: 'career', day: 4 } } }));
  assert.equal(SL.deleteGame(st, 1).ok, false, 'not the one being played');
  assert.equal(st.get(keys.KEY), 'GAME-A');
  assert.equal(SL.parkedText(st, 3), 'GAME-C');
  const r = SL.deleteGame(st, 3);
  assert.deepEqual(r, { ok: true, text: 'GAME-C' });
  assert.equal(st.get(SL.slotKey(3)), null);
  assert.equal(SL.readIndex(st).games[3], null);
  assert.deepEqual(SL.filled(st, keys), { 1: true, 2: false, 3: false });
});

test('slots through the save: switching stops this page saving over the next game; a damaged save never becomes another game', async () => {
  globalThis.localStorage = new MemoryStorage();
  let S = await freshSave();
  const a = S.loadGame().state;
  a.day = 9;
  a.money = 321;
  assert.ok(S.saveGame(a));
  assert.ok(S.saveGame(a));
  assert.equal(S.slots.index().games[1].day, 9, 'each save keeps its line up to date');
  // Over to Game 2: the page that showed Game 1 can't save any more (its save on leaving would
  // land on Game 2).
  assert.ok(S.slots.switchTo(2).ok);
  assert.equal(S.saveStatus.canSave, false);
  assert.equal(S.saveGame(a), false);
  // Game 2 begins new; it's saved, then damaged: it starts again rather than becoming Game 1.
  S = await freshSave();
  const b = S.loadGame().state;
  assert.equal(b.day, 1);
  assert.equal(b.money, 20, 'a new game, not Game 1');
  b.day = 3;
  assert.ok(S.saveGame(b));
  localStorage.setItem(S.SAVE_KEY, '{ not a save');
  S = await freshSave();
  const c = S.loadGame();
  assert.notEqual(c.state.day, 9);
  assert.notEqual(c.state.money, 321, 'never Game 1’s');
  // Game 1, back, whole.
  assert.ok(S.slots.switchTo(1).ok);
  S = await freshSave();
  const a2 = S.loadGame().state;
  assert.equal(a2.day, 9);
  assert.equal(a2.money, 321);
});

test('the desktop app mirrors each game to its own file, and never a bad slot over Game 1', async () => {
  const { createRequire } = await import('node:module');
  const Module = (await import('node:module')).default;
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slow-tide-slots-'));
  const handlers = {};
  const fake = {
    app: { getPath: () => dir, whenReady: () => new Promise(() => {}), on() {}, commandLine: { appendSwitch() {} }, isPackaged: false, getVersion: () => '0.1.0' },
    BrowserWindow: class { static getAllWindows() { return []; } }, protocol: { registerSchemesAsPrivileged() {}, handle() {} }, net: {},
    ipcMain: { on: (ch, fn) => { handlers[ch] = fn; }, handle: (ch, fn) => { handlers[ch] = fn; } },
    shell: { openPath() {}, openExternal() {} },
  };
  const load = Module._load;
  Module._load = function (req, ...rest) { return req === 'electron' ? fake : load.call(this, req, ...rest); };
  const require = createRequire(import.meta.url);
  try {
    delete require.cache[require.resolve('../desktop/main.cjs')];
    require('../desktop/main.cjs');
  } finally {
    Module._load = load;
  }
  const save = (n) => JSON.stringify({ game: 'slow-tide', data: { slot: n } });
  handlers['save:mirror']({}, save(1));
  handlers['save:mirror']({}, save(2), 2);
  handlers['save:mirror']({}, save(3), 3);
  handlers['save:mirror']({}, save(9), 9);
  const file = (f) => fs.readFileSync(path.join(dir, 'saves', f), 'utf8');
  assert.equal(file('slow-tide-save.json'), save(1), 'Game 1 where it always was');
  assert.equal(file('slow-tide-save-2.json'), save(2));
  assert.equal(file('slow-tide-save-3.json'), save(3));
  assert.ok(!fs.existsSync(path.join(dir, 'saves', 'slow-tide-save-9.json')));
  fs.rmSync(dir, { recursive: true, force: true });
});
