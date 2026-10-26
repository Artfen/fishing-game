// Learning the grounds (grounds.js): the signs on the water, noted when seen and read when you
// catch what was under one; what your catches say about each place; the water's colour after rain
// and a blow, and the fish it suits; the naturalist's notes; and all of it through a save.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const G = await import('../src/grounds.js');
const { fishById } = await import('../src/fish.js');
const { sanitize, sanitizeLogEntry } = await import('../src/save.js');
const THREE = await import('three');
const { Seabed } = await import('../src/world/seabed.js');
const { createHabitat } = await import('../src/world/habitat.js');

test('a sign seen, then a fish caught right under it: now you know what it was', () => {
  const g = G.newGrounds(), recent = [];
  const birds = { type: 'birds', x: 300, z: 520, sp: 'mackerel' };
  assert.equal(G.seeSign(g, recent, birds, 100, 4), true);
  // The same birds a moment later, a little further on, are the same sign.
  assert.equal(G.seeSign(g, recent, { ...birds, x: 310 }, 100.05, 4), false);
  assert.equal(g.signs.birds.seen, 1);
  // A fish of another kind there, or this kind far away, or much later: nothing read.
  assert.equal(G.readSign(g, recent, 'pollack', 305, 522, 100.2), null);
  assert.equal(G.readSign(g, recent, 'mackerel', 600, 522, 100.2), null);
  assert.equal(G.readSign(g, recent.map((r) => ({ ...r })), 'mackerel', 305, 522, 102), null);
  // A mackerel under them, soon after: read.
  const r = G.readSign(g, recent, 'mackerel', 305, 522, 100.3);
  assert.deepEqual(r, { kind: 'birds', sp: 'mackerel', first: true });
  assert.equal(g.signs.birds.read, 1);
  assert.deepEqual(g.signs.birds.sp, { mackerel: 1 });
  assert.match(G.SIGNS.birds.lesson('mackerel'), /^The birds were right: a shoal of Atlantic mackerel under them\./);
  assert.match(G.SIGNS.rise.lesson('trout'), /^Those rings were a brown trout rising to feed\.$/i);
  // Used up: the next mackerel isn't the same sign again.
  assert.equal(G.readSign(g, recent, 'mackerel', 305, 522, 100.35), null);
  // Every sign has its words.
  for (const [k, S] of Object.entries(G.SIGNS)) assert.ok(S.name && S.note && S.lesson('seabass').length > 20 && G.SEEN_AT[k] > 0, k);
});

test('the grounds: what your catches say about a place, once there are enough of them', () => {
  const at = (sp, hour, tide, extra = {}) => ({ sp, size: 30, place: 'Long Shoal', hour, tide, season: 'summer', item: 'sabiki', ...extra });
  const log = [
    at('mackerel', 6, 'flood'), at('mackerel', 7, 'flood'), at('mackerel', 6.5, 'flood'), at('mackerel', 13, 'ebb', { size: 38 }),
    at('plaice', 12, 'flood', { item: 'lug', size: 41 }), at('plaice', 12.5, 'ebb', { item: 'lug' }),
    { sp: 'seabass', size: 55, place: 'Shell Strand', hour: 19, tide: 'flood', colour: 'coloured', season: 'autumn' },
  ];
  const g = G.groundsOf(log);
  assert.equal(g[0].place, 'Long Shoal', 'the most fished first');
  assert.equal(g[0].n, 6);
  assert.equal(g[0].kinds[0].sp, 'mackerel');
  const mack = G.groundWords(g[0].kinds[0]);
  assert.equal(mack, 'Atlantic mackerel: 4 (best 38 cm), mostly on the flood, at dawn, in summer; most on sabiki feathers.');
  // Two plaice say nothing about when: too few to tell.
  assert.equal(G.groundWords(g[0].kinds[1]), 'European plaice: 2 (best 41 cm).');
  assert.equal(g[1].place, 'Shell Strand');
});

test('the water colours up after rain and a blow, and settles over a day; it suits some fish', () => {
  let c = 0;
  c = G.stepColour(c, { storm: 1 }, 2);
  assert.ok(c > 0.6, `after two hours of a gale: ${c.toFixed(2)}`);
  c = G.stepColour(c, { storm: 1 }, 4);
  const peak = c;
  c = G.stepColour(c, {}, 6);
  assert.ok(c < peak && c > 0.2, `six hours on, still coloured: ${c.toFixed(2)}`);
  c = G.stepColour(c, {}, 18);
  assert.ok(c < 0.15, `a day on, clear again: ${c.toFixed(2)}`);
  assert.equal(G.colourKey(0.05), 'clear');
  assert.equal(G.colourKey(0.3), 'tinged');
  assert.equal(G.colourKey(0.8), 'coloured');
  assert.ok(G.colourFactor(fishById.seabass, 1) > 1.2, 'bass like a bit of colour');
  assert.ok(G.colourFactor(fishById.mackerel, 1) < 0.7, 'mackerel hunt by sight');
  assert.equal(G.colourFactor(fishById.trout, 1), 1, 'fresh water is its own');
  assert.equal(G.colourFactor(fishById.seabass, 0), 1);
  // The catch log keeps it.
  assert.equal(sanitizeLogEntry({ sp: 'seabass', size: 50, colour: 'coloured' }).colour, 'coloured');
  assert.equal(sanitizeLogEntry({ sp: 'seabass', size: 50, colour: 'muddy' }).colour, undefined);
});

test('the naturalist’s notes: met once, noted with when and where', () => {
  const g = G.newGrounds();
  assert.equal(G.noteNature(g, 'dahlia', { day: 3, hour: 11, where: 'Skerries Reef' }), true);
  assert.equal(G.noteNature(g, 'dahlia', { day: 4, hour: 9 }), false);
  assert.deepEqual(g.notes.dahlia, { n: 2, day: 3, hour: 11, where: 'Skerries Reef' });
  assert.equal(G.noteNature(g, 'unicorn', { day: 1, hour: 1 }), false);
  for (const [k, N] of Object.entries(G.NATURE)) assert.ok(N.name && N.latin && N.note.length > 40, k);
  // What's on the seabed round a diver is there to be met.
  const sb = new Seabed(new THREE.Scene(), createHabitat());
  sb.update({ position: new THREE.Vector3(-300, -25, 780) }, 1);
  const near = new Set();
  for (let i = 0; i < 40 && near.size < 2; i++) sb.kindsNear({ x: -300 + (i % 7) * 3, y: -29.5, z: 780 + Math.floor(i / 7) * 3 }, 3, near);
  assert.ok(near.size > 0, 'something within reach');
  for (const k of near) assert.ok(k in G.NATURE || ['shell', 'stone'].includes(k), k);
});

test('the grounds and the water’s colour survive a save; junk is thrown out', () => {
  const s = sanitize({});
  assert.deepEqual(s.grounds, { signs: {}, notes: {} });
  assert.equal(s.seaColour, 0);
  const g = G.newGrounds(), recent = [];
  G.seeSign(g, recent, { type: 'boil', x: 0, z: 900, sp: 'bonito' }, 50, 3);
  G.readSign(g, recent, 'bonito', 10, 905, 50.2);
  G.noteNature(g, 'fan', { day: 3, hour: 12, where: 'The Hound' });
  const back = sanitize(JSON.parse(JSON.stringify({ grounds: g, seaColour: 0.42 })));
  assert.deepEqual(back.grounds, g);
  assert.equal(back.seaColour, 0.42);
  const junk = sanitize({ grounds: { signs: { birds: { seen: -4, sp: { nofish: 3, mackerel: 2 } }, ufo: { seen: 9 } }, notes: { fan: 'x', kelp: { n: 2, day: 5 } } }, seaColour: 9 });
  assert.deepEqual(Object.keys(junk.grounds.signs), ['birds']);
  assert.equal(junk.grounds.signs.birds.seen, 0);
  assert.deepEqual(junk.grounds.signs.birds.sp, { mackerel: 2 });
  assert.deepEqual(Object.keys(junk.grounds.notes), ['kelp']);
  assert.equal(junk.seaColour, 1);
});
