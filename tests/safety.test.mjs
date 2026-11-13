// When it goes wrong at sea (F1b, see safety.js and damage.js plug): the repair kit's plugs and
// leak-stoppers used up, a rag with none left (half the water still coming, against a plug's
// fifth) and a proper plug in its place later; topping the kit up; and calling for help: your
// phone near a harbour, her VHF, a flare (help takes twice as long), or a passing boat (hours).
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { KIT, KIT_PRICE, SPARE_PRICE, FLARES, NO_SIGNAL, WAIT_HOURS, newSafety, cleanSafety, takePlug, restock, fillKit, helpBy, helpHours, HELP_WORDS } = await import('../src/safety.js');
const { newDamage, plug, pluggable, plugLets, PLUGGED, RAG, cleanDamage, damageSave } = await import('../src/damage.js');

test('the repair kit: plugs and leak-stoppers used up, then a rag', () => {
  const S = newSafety();
  assert.deepEqual(S, { kit: true, plugs: KIT.plugs, stoppers: KIT.stoppers, flares: 0 }, 'everyone starts with a kit');
  for (let i = 0; i < KIT.plugs; i++) assert.equal(takePlug(S, 'hull'), 'kit');
  assert.equal(takePlug(S, 'hull'), 'rag', 'no plugs left');
  assert.equal(S.stoppers, KIT.stoppers, 'the stoppers untouched');
  assert.equal(takePlug(S, 'tube'), 'kit');
  assert.equal(takePlug({ kit: false, plugs: 0, stoppers: 0, flares: 0 }, 'tube'), 'rag', 'no kit at all');
  // Topping up: the spares used, at a few pounds each; a whole kit if there isn't one.
  assert.deepEqual(restock(S), { n: KIT.plugs + 1, price: (KIT.plugs + 1) * SPARE_PRICE, whole: false });
  fillKit(S);
  assert.deepEqual(restock(S), { n: 0, price: 0, whole: false });
  assert.deepEqual(restock({ kit: false, plugs: 0, stoppers: 0, flares: 0 }), { n: KIT.plugs + KIT.stoppers, price: KIT_PRICE, whole: true });
});

test('a hole plugged from the kit lets in a fifth; a rag, half; a proper plug can take a rag’s place', () => {
  const D = newDamage(false);
  D.hull.bottom = 0.95;
  assert.deepEqual(pluggable(D), ['hull:bottom']);
  assert.equal(plug(D, 'hull:bottom', 'rag'), true);
  assert.equal(D.plugs.bottom, 'rag');
  assert.equal(plugLets(D.plugs.bottom), RAG);
  assert.deepEqual(pluggable(D), [], 'nothing more to do with a rag');
  assert.deepEqual(pluggable(D, true), ['hull:bottom'], 'but a proper plug can go in its place');
  assert.equal(plug(D, 'hull:bottom', 'rag'), false, 'a rag over a rag does nothing');
  assert.equal(plug(D, 'hull:bottom'), true);
  assert.equal(D.plugs.bottom, true);
  assert.equal(plugLets(D.plugs.bottom), PLUGGED);
  assert.equal(plugLets(undefined), 1);
  // A tube: a rag halves the leak; a stopper later brings it to a fifth of what it was.
  const R = newDamage(true);
  R.tubes[1].leak = 0.01;
  plug(R, 'tube:1', 'rag');
  assert.ok(Math.abs(R.tubes[1].leak - 0.005) < 1e-9);
  plug(R, 'tube:1');
  assert.ok(Math.abs(R.tubes[1].leak - 0.01 * PLUGGED) < 1e-9, 'a fifth of the first leak in all');
  assert.equal(R.tubes[1].plugged, true);
});

test('kept through a save: the kit, the flares, and a rag in a hole', () => {
  assert.deepEqual(cleanSafety(undefined), newSafety(), 'an older save: a full kit');
  assert.deepEqual(cleanSafety({ kit: true, plugs: 1, stoppers: 9, flares: -2 }), { kit: true, plugs: 1, stoppers: KIT.stoppers, flares: 0 });
  assert.deepEqual(cleanSafety({ kit: false, plugs: 3, stoppers: 2, flares: 3 }), { kit: false, plugs: 0, stoppers: 0, flares: 3 }, 'no kit, no plugs');
  const D = newDamage(true);
  D.hull.port = 0.9;
  plug(D, 'hull:port', 'rag');
  D.tubes[0].leak = 0.004;
  plug(D, 'tube:0', 'rag');
  const back = cleanDamage(JSON.parse(JSON.stringify(damageSave(D))), true);
  assert.equal(back.plugs.port, 'rag');
  assert.equal(back.tubes[0].plugged, 'rag');
  const junk = cleanDamage({ hull: { port: 0.9 }, plugs: { port: 'cork' } }, true);
  assert.equal(junk.plugs.port, undefined, 'junk dropped');
});

test('calling for help: your phone along the coast, her VHF, a flare (twice as long), or a passing boat on the deep water', async () => {
  const { zoneAt, GANNET } = await import('../src/world/terrain.js');
  const at = (x, z) => zoneAt(x, z);
  assert.equal(helpBy({ zone: at(60, 160) }), 'phone', 'in the bay');
  assert.equal(helpBy({ zone: at(GANNET.x, GANNET.z - 100) }), 'phone', 'off Gannet Isle');
  assert.ok(NO_SIGNAL.has(at(40, 960)), 'no signal on the Blue Water');
  assert.ok(NO_SIGNAL.has(at(40, 2000)), 'nor on the crossing');
  assert.equal(helpBy({ zone: 'deep', vhf: true }), 'vhf');
  assert.equal(helpBy({ zone: 'deep', flares: 2 }), 'flare', 'on the Blue Water with flares');
  assert.equal(helpBy({ zone: 'ocean' }), 'wait', 'and with nothing');
  assert.equal(helpBy({ zone: 'deep', vhf: true, flares: 3 }), 'vhf', 'the radio before a flare');
  assert.equal(helpHours('phone', 1), 1);
  assert.equal(helpHours('vhf', 0.5), 0.5);
  assert.equal(helpHours('flare', 1), 2);
  assert.equal(helpHours('wait', 1), WAIT_HOURS);
  assert.equal(helpHours('wait', 8), 8, 'never sooner than the harbour would have been');
  for (const k of ['phone', 'vhf', 'flare', 'wait']) assert.ok(HELP_WORDS[k]);
  assert.equal(FLARES, 3);
});
