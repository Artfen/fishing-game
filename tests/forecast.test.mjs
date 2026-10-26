// Gales (world/forecast.js): rare (rarer in summer, commoner in winter), known a day ahead, coming
// in over hours with warnings, blowing for hours; and the fish of sheltered water feeding in a blow
// while the open sea's go quiet. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const G = await import('../src/world/forecast.js');
const S = await import('../src/world/season.js');

test('gales are rare, commoner in winter than summer, by day, lasting four to eight hours', () => {
  const by = { spring: [0, 0], summer: [0, 0], autumn: [0, 0], winter: [0, 0] };
  for (let d = 1; d < 1200; d++) {
    const s = S.seasonOf(d).name, g = G.galeFor(d);
    by[s][1]++;
    if (!g) continue;
    by[s][0]++;
    const start = g.start - d * 24;
    assert.ok(start >= 9 && start <= 21, `starts ${start.toFixed(1)}`);
    assert.ok(g.end - g.start >= 4 && g.end - g.start <= 8);
  }
  const rate = (s) => by[s][0] / by[s][1];
  assert.ok(rate('summer') < 0.12 && rate('winter') > 0.22 && rate('winter') < 0.45, JSON.stringify(by));
  assert.ok(rate('winter') > rate('autumn') && rate('autumn') > rate('spring') && rate('spring') > rate('summer'));
});

test('a gale comes in over hours: cloud, rain, heavy rain, the storm, and clearing after; warned of in good time', () => {
  let d = 1;
  while (!G.galeFor(d)) d++;
  const g = G.galeFor(d);
  const seen = [];
  for (let a = g.start - 9; a < g.end + 6; a += 0.1) {
    const s = G.galeSky(a);
    if (seen[seen.length - 1] !== s) seen.push(s);
  }
  assert.deepEqual(seen, [null, 'overcast', 'light', 'heavy', 'storm', 'heavy', 'light', null]);
  assert.ok(G.hoursToGale(g.start - 6) > 5.9 && G.hoursToGale(g.start - 1) < 1.1);
  assert.equal(G.hoursToGale(g.start + 1), null);
  // The board, a day ahead, on the day, and while it blows.
  assert.ok(G.outlook((d - 1) * 24 + 10).some((l) => l.startsWith('Tomorrow: a gale from about')));
  assert.ok(G.outlook(g.start - 3).some((l) => l.startsWith('Gale warning for today')));
  assert.ok(G.outlook(g.start + 1).some((l) => l.startsWith('Storm warning')));
  let calm = 1;
  while (G.galeFor(calm) || G.galeFor(calm + 1) || G.galeFor(calm - 1)) calm++;
  assert.deepEqual(G.outlook(calm * 24 + 12), ['Today: no gales expected.', 'Tomorrow: no gales expected.']);
});

test('in a blow the sheltered water fishes and the open sea goes quiet; afterwards the coloured water fishes', () => {
  assert.ok(G.blowFactor('estuary', 0.9) > 1.2 && G.blowFactor('lake', 0.9) > 1.2);
  assert.ok(G.blowFactor('open', 0.9) < 0.7 && G.blowFactor('deep', 0.9) < 0.7);
  assert.ok(G.blowFactor('cove', 0, 1) > G.blowFactor('cove', 0, 0.3));
  assert.equal(G.blowFactor('open', 0, 0), 1);
});
