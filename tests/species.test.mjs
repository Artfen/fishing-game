// The tree of life (src/taxonomy.js, the journal's Species pages in src/journal.js): every living
// thing in the game, fish and otherwise, placed by kingdom, phylum, class, order and family, with
// its scientific name and IUCN status; what you've recorded of each (caught, seen, met on a dive,
// or heard); the herring gulls, curlews, tawny owls and frogs counted now; and the pages drawn.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// A very small stand-in for the page: just what the journal uses.
class FakeEl {
  constructor(tag) {
    Object.assign(this, { tag, children: [], className: '', textContent: '', hidden: false, dataset: {}, style: {}, listeners: {}, attrs: {} });
  }
  addEventListener(k, f) { (this.listeners[k] ??= []).push(f); }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  click() { for (const f of this.listeners.click || []) f({ stopPropagation() {}, target: this }); }
  getContext() { return ctx2d; }
}
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
const byId = new Map();
globalThis.document = {
  createElement: (tag) => new FakeEl(tag),
  createTextNode: (t) => ({ textContent: t }),
  getElementById: (id) => (byId.has(id) ? byId.get(id) : byId.set(id, new FakeEl('div')).get(id)),
  querySelectorAll: () => [],
  fonts: null,
};
const all = (e, out = []) => {
  out.push(e);
  for (const c of e.children || []) if (c instanceof FakeEl) all(c, out);
  return out;
};
const text = (e) => all(e).map((x) => x.textContent).join('\n');

const { FISH } = await import('../src/fish.js');
const { LEGACY } = await import('../src/register.js');
const { NATURE_IDS } = await import('../src/grounds.js');
const { SEA_LIFE } = await import('../src/world/sealife.js');
const T = await import('../src/taxonomy.js');
const { parseSave, SAVE_VERSION, SEA_LIFE_KINDS } = await import('../src/save.js');

test('every living thing in the game is in the tree, placed down to its family, with its scientific name', () => {
  const list = T.species(), keys = new Set(list.map((e) => e.key));
  // The fish (all but the fictional ones of the first versions), the seabed's life and the sea's.
  for (const f of FISH) if (!LEGACY[f.id] && !f.retired) assert.ok(keys.has(`fish:${f.id}`), f.id);
  for (const k of NATURE_IDS) assert.ok(keys.has(`nature:${k}`) || k === 'fry', `nature: ${k}`);
  for (const k of Object.keys(SEA_LIFE)) assert.ok(keys.has(`sea:${k}`), `sea: ${k}`);
  assert.ok(list.length >= 125, `${list.length}`);
  for (const e of list) {
    assert.ok(e.sci && e.name, e.key);
    assert.ok(T.KINGDOMS[e.kingdom] && T.PHYLA[e.phylum]?.kingdom === e.kingdom, `${e.key}: kingdom and phylum`);
    if (e.cls) assert.equal(T.CLASSES[e.cls].phylum, e.phylum, `${e.key}: class in its phylum`);
    if (e.rank === 'phylum') continue;
    assert.ok(T.FAMILIES[e.family], `${e.key}: family ${e.family}`);
    assert.equal(e.order, T.FAMILIES[e.family][0], e.key);
    if (e.order) assert.ok(T.ORDERS[e.order], `${e.key}: order ${e.order}`);
    // (Binomials for species: a capitalised genus and a lower-case epithet.)
    if (e.rank === 'species') assert.match(e.sci, /^[A-Z][a-z]+ [a-z]+/, e.key);
  }
  // A few a zoologist would check.
  const at = (key) => list.find((e) => e.key === key);
  assert.deepEqual([at('sea:bottlenose').cls, at('sea:bottlenose').order, at('sea:bottlenose').family], ['mammalia', 'artiodactyla', 'Delphinidae']);
  assert.deepEqual([at('sea:spermwhale').family, at('sea:finwhale').family], ['Physeteridae', 'Balaenopteridae']);
  assert.deepEqual([at('sea:herringgull').cls, at('sea:herringgull').family, at('sea:herringgull').sci], ['aves', 'Laridae', 'Larus argentatus']);
  assert.equal(at('sea:turtle').cls, 'reptilia');
  assert.equal(at('fish:octopus').cls, 'cephalopoda');
  assert.equal(at('fish:blueshark').cls, 'chondrichthyes');
  assert.equal(at('fish:thornback').order, 'rajiformes');
  assert.equal(at('fish:turbot').order, 'pleuronectiformes');
  assert.equal(at('nature:jewel').order, 'corallimorpharia', 'the jewel anemone is no true anemone');
  assert.equal(at('nature:gardeneel').cls, 'actinopterygii', 'garden eels are fish');
  assert.deepEqual([at('sea:glow').kingdom, at('nature:kelp').kingdom, at('nature:red').kingdom], ['chromista', 'chromista', 'plantae'], 'not everything is an animal');
  // The sand smelt the divers meet in shoals is the one you catch: one entry.
  assert.ok(!keys.has('nature:fry'));
});

test('the status is the IUCN Red List’s: read from the register’s notes, given for the rest where it’s clear', () => {
  assert.equal(T.iucnOf('IUCN global: Near Threatened (NT), assessed 3 March 2022 (FishBase).'), 'NT');
  assert.equal(T.iucnOf('IUCN Least Concern (assessed 2013, per FishBase). Under EU TAC management.'), 'LC');
  assert.equal(T.iucnOf('IUCN global: CR (A2bd+4bd, assessed 7 Nov 2018; FishBase).'), 'CR');
  assert.equal(T.iucnOf('Catalog of Fishes: D. cadenati Not Assessed by IUCN (2025); DORIS cites LC since 2011'), 'NE');
  assert.equal(T.iucnOf('No assessment here.'), null);
  const at = (key) => T.species().find((e) => e.key === key);
  assert.deepEqual(['fish:eel', 'fish:mako', 'fish:seabass', 'fish:angelshark', 'sea:finwhale', 'sea:turtle', 'sea:curlew', 'sea:gannet'].map((k) => at(k).iucn), ['CR', 'EN', 'NT', 'CR', 'VU', 'VU', 'NT', 'LC']);
  for (const e of T.species()) if (e.iucn) assert.ok(T.IUCN[e.iucn], e.key);
});

test('what you’ve recorded: caught, seen, met on a dive, heard; counted up the tree', () => {
  const state = {
    fish: { seabass: { count: 3, best: 62 } }, observed: { eel: { count: 1 } },
    seaLife: { gannet: { n: 2, day: 3, where: 'Gull Rock' }, curlew: { n: 1, day: 4, where: 'the cove', heard: true } },
    grounds: { notes: { star: { n: 2, day: 5, where: 'Skerries Reef' }, fry: { n: 1, day: 6, where: 'Willow Bay' } } },
  };
  const at = (key) => T.species().find((e) => e.key === key);
  assert.deepEqual(T.recordOf(state, at('fish:seabass')), { how: 'caught', n: 3, best: 62, day: null, where: '' });
  assert.equal(T.recordOf(state, at('fish:eel')).how, 'seen');
  assert.equal(T.recordOf(state, at('fish:sandsmelt')).how, 'met', 'met in a shoal on a dive');
  assert.equal(T.recordOf(state, at('sea:gannet')).how, 'seen');
  assert.equal(T.recordOf(state, at('sea:curlew')).how, 'heard');
  assert.equal(T.recordOf(state, at('nature:star')).how, 'met');
  assert.equal(T.recordOf(state, at('sea:finwhale')), null);
  const tree = T.treeOf(state);
  assert.deepEqual(tree.map((K) => K.id), ['animalia', 'chromista', 'plantae']);
  const animals = tree[0];
  assert.equal(animals.n, 6);
  assert.deepEqual(animals.phyla[0].classes.map((c) => c.id), ['mammalia', 'aves', 'reptilia', 'amphibia', 'actinopterygii', 'chondrichthyes']);
  assert.equal(animals.phyla[0].classes.find((c) => c.id === 'aves').n, 2);
  assert.equal(tree.reduce((s, K) => s + K.of, 0), T.species().length);
  // A class by order and family: whales and dolphins together, families sorted.
  const mammals = T.byOrder(animals.phyla[0].classes[0].entries);
  assert.deepEqual(mammals.map((o) => o.order), ['artiodactyla', 'carnivora']);
  assert.deepEqual(mammals[0].families.map((f) => f.family), ['Balaenopteridae', 'Delphinidae', 'Physeteridae']);
});

test('herring gulls, curlews, tawny owls and frogs are counted now; heard (not yet seen) is kept in the save', () => {
  for (const k of ['herringgull', 'curlew', 'tawnyowl', 'commonfrog']) {
    assert.ok(SEA_LIFE[k]?.name && SEA_LIFE[k].note.length > 60, k);
    assert.ok(SEA_LIFE_KINDS.includes(k), k);
  }
  for (const k of ['curlew', 'tawnyowl', 'commonfrog']) assert.ok(SEA_LIFE[k].heard.length > 40, `${k}: the words when you hear one`);
  const raw = JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { seaLife: { curlew: { n: 2, day: 4, hour: 19, where: 'the cove', heard: true }, herringgull: { n: 5, day: 2, hour: 10, where: 'Gull Rock', heard: 'yes' }, dodo: { n: 1, day: 1 } } } });
  const s = parseSave(raw).state;
  assert.deepEqual(s.seaLife.curlew, { n: 2, day: 4, hour: 19, where: 'the cove', heard: true });
  assert.equal(s.seaLife.herringgull.heard, undefined, 'only a real true counts as heard');
  assert.equal(s.seaLife.dodo, undefined);
});

test('the journal’s Species pages: the tree with counts, a group by order and family, a card for each kind', async () => {
  const { Journal } = await import('../src/journal.js');
  const state = {
    fish: { seabass: { count: 3, best: 62 } }, observed: {}, log: [], places: {}, items: {}, journal: [], photos: [],
    seaLife: { bottlenose: { n: 2, day: 14, hour: 11, where: 'Willow Bay' }, curlew: { n: 1, day: 20, hour: 19, where: 'the cove', heard: true } },
    grounds: { signs: {}, notes: { star: { n: 2, day: 5, hour: 11, where: 'Skerries Reef' } } },
  };
  const J = new Journal(state);
  J.renderSpecies();
  const total = T.species().length;
  assert.equal(byId.get('sp-count').textContent, `4 of ${total} recorded`);
  const tree = text(byId.get('sp-tree'));
  for (const w of ['Animals', 'Chordates', 'Mammals', 'Birds', 'Ray-finned fishes', 'Echinoderms', 'Chromists']) assert.match(tree, new RegExp(w));
  // The first group with something in it is shown: the mammals, whales and dolphins first.
  const group = text(byId.get('sp-group'));
  assert.match(group, /Mammals/);
  assert.match(group, /Artiodactyla/);
  assert.match(group, /Delphinidae/);
  assert.match(group, /Bottlenose dolphin\nTursiops truncatus/);
  assert.match(group, /Seen 2 times · first on day 14, Willow Bay/);
  assert.match(group, /Where to look: Far offshore past the bay/, 'a kind not yet recorded says where to look');
  // Choosing the birds: the curlew heard, not yet seen.
  const birds = all(byId.get('sp-tree')).find((e) => e.tag === 'button' && /Birds/.test(text(e)));
  birds.click();
  const g2 = text(byId.get('sp-group'));
  assert.match(g2, /Eurasian curlew/);
  assert.match(g2, /Heard once · first on day 20, the cove, not yet seen/);
  assert.match(g2, /Scolopacidae/);
  // A fish's card goes to the field guide.
  const fish = all(byId.get('sp-tree')).find((e) => e.tag === 'button' && /Ray-finned/.test(text(e)));
  fish.click();
  const cards = all(byId.get('sp-group')).filter((e) => e.tag === 'article');
  assert.equal(cards.length, T.species().filter((e) => e.cls === 'actinopterygii').length);
  assert.match(text(byId.get('sp-group')), /Caught 3 · best 62 cm/);
});
