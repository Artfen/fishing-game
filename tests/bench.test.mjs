// The benchmark (docs/PERFORMANCE.md): the scenarios the brief asks for, each set up the same way
// every time, shared by tools/perf.mjs and bench.html; and a benchmark run in your own browser
// never reading or writing your save (save.js keeps its own under 'slow-tide-bench').
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { BENCH_SCENARIOS, benchSave } = await import('../src/bench.js');

test('the scenarios: the harbour, rough water, a school of fish, dives at home and at Las Brasas, a storm, the sonar, the crossing, boats far off', () => {
  for (const id of ['harbour', 'harbour_off', 'rib_rough', 'storm', 'shoal', 'wildlife', 'sonar', 'underwater', 'dive_reef', 'dive_brasas', 'voyage']) {
    const S = BENCH_SCENARIOS[id];
    assert.ok(S, id);
    assert.equal(typeof S.label, 'string');
    assert.equal(typeof S.setup, 'function');
    // (Handed to the page as source by tools/perf.mjs: nothing but the game's own handle in it.)
    assert.doesNotThrow(() => new Function(`return (${S.setup.toString()})`)(), id);
    assert.ok(!/\bimport\b|\brequire\(/.test(S.setup.toString()), id);
  }
  const s = benchSave(BENCH_SCENARIOS.storm.save, 'high');
  assert.equal(s.settings.graphics.preset, 'high');
  assert.equal(s.quality, 'high');
  assert.equal(s.settings.weather.sea, 'rough');
  assert.equal(s.settings.player.name, 'Bench');
});

test('a benchmark run never touches your save: its own, under its own key', async () => {
  const mine = JSON.stringify({ game: 'slow-tide', version: 6, savedAt: 1, data: { money: 4242 } });
  globalThis.localStorage = new globalThis.MemoryStorage();
  localStorage.setItem('slow-tide-save', mine);
  const keep = globalThis.location;
  globalThis.location = { search: '?bench=harbour' };
  try {
    // (A fresh copy of the module, loaded as the game with ?bench=… loads it.)
    const S = await import('../src/save.js?benchmode');
    assert.equal(S.BENCH, true);
    const { state } = S.loadGame();
    state.money = 7;
    S.saveGame(state);
    assert.equal(localStorage.getItem('slow-tide-save'), mine, 'yours as it was');
    assert.ok(JSON.parse(localStorage.getItem('slow-tide-bench')).data.money === 7, 'the benchmark’s own');
  } finally {
    globalThis.location = keep;
  }
  // (And the game as you play it: your key.)
  const N = await import('../src/save.js');
  assert.equal(N.BENCH, false);
});
