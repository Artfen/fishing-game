// Research for the Marine Trust (src/contracts.js: poolcount, seabirds, specimen): a rockpool count,
// a seabird count through the binoculars, a photograph of a named species for the Trust's field
// guide; each kind counted once, a job finished when the count is made, the photograph matched
// against what's in it. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/contracts.js';

const PL = { light: { x: -250, z: 1100, name: 'Gannet Light' }, pools: { x: 68, z: -52, name: 'the rocks east of Willowhaven' }, reef: { x: -128, z: 378, name: 'Skerries Reef' } };
const W = (over = {}) => ({ day: 3, region: 'home', storm: false, places: PL, rank: { pax: 0 }, ...over });
const take = (tpl, w = W(), seed = 1) => {
  const o = K.TEMPLATES[tpl].make(w, K.seeded(seed));
  assert.ok(o, `${tpl} makes an offer`);
  const C = K.newContracts();
  C.board = { day: w.day, region: 'home', offers: [{ id: `${w.day}-home-${tpl}`, tpl, cat: K.TEMPLATES[tpl].cat, giver: K.TEMPLATES[tpl].giver, coop: false, boat: null, gear: null, where: null, ...o }] };
  const a = K.accept(C, `${w.day}-home-${tpl}`);
  assert.ok(a && !a.why, `${tpl} taken`);
  return { C, a: C.active[0] };
};

test('a rockpool count: each kind seen in a pool counts once; done at the count', () => {
  const { C, a } = take('poolcount');
  assert.equal(a.cat, 'survey');
  assert.equal(a.giver, 'trust');
  const n = a.obj.n;
  assert.ok(n >= 4 && n <= 6 && /rockpools/.test(a.goal));
  assert.deepEqual(a.where, PL.pools);
  const kinds = ['beadlet', 'snakelocks', 'limpet', 'prawn', 'shorecrab', 'rockgoby', 'shanny'];
  let done = [];
  // The same kind twice counts once; something seen through binoculars doesn't count here.
  done = K.noted(C, 'pool', 'beadlet');
  done = K.noted(C, 'pool', 'beadlet');
  done = K.noted(C, 'binoculars', 'kittiwake', true);
  assert.equal(K.standing(a), `1 of ${n} recorded.`);
  for (const k of kinds.slice(1, n)) done = K.noted(C, 'pool', k);
  assert.equal(done.length, 1, 'finished at the count');
  assert.ok(a.ready);
});

test('a seabird count: only birds named through the binoculars count; no count in a storm', () => {
  assert.equal(K.TEMPLATES.seabirds.make(W({ storm: true }), K.seeded(1)), null);
  const { C, a } = take('seabirds');
  assert.ok(a.obj.birds && a.obj.where === 'binoculars');
  K.noted(C, 'binoculars', 'bottlenose', false);
  assert.equal(K.standing(a), `0 of ${a.obj.n} recorded.`, 'a dolphin is no seabird');
  let done = [];
  for (const k of ['gannet', 'kittiwake', 'guillemot', 'razorbill', 'puffin'].slice(0, a.obj.n)) done = K.noted(C, 'binoculars', k, true);
  assert.equal(done.length, 1);
});

test('a photograph for the Trust’s guide: matched against what’s in the picture', () => {
  for (let seed = 1; seed < 30; seed++) {
    const { C, a } = take('specimen', W(), seed);
    const want = a.obj.subjects[0];
    // A picture without it: nothing; with it (as a fish, a pool creature or a bird), done.
    assert.deepEqual(K.photographed(C, { species: ['mackerel'], nature: ['limpet'], wild: [], life: [] }), []);
    const pic = { species: [want], nature: [want], wild: [want], life: [] };
    assert.equal(K.photographed(C, pic).length, 1, want);
  }
  // Away from home, none of this work.
  for (const t of ['poolcount', 'seabirds', 'specimen']) assert.equal(K.TEMPLATES[t].make(W({ region: 'south' }), K.seeded(2)), null, t);
});
