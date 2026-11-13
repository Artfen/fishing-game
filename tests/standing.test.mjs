// Standing with each giver (G4): the jobs done for them add up; a giver who knows you pays more for
// their work (from the job after the one that took you there), and a trusting one's work comes
// first on the board. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const K = await import('../src/contracts.js');

// A finished job from `giver`, worth `rep` standing, paying £20, on the active list, ready.
function done(C, giver, rep, id = `j${Math.random()}`) {
  C.active.push({ id, tpl: 'special', cat: 'fishing', giver, title: 'T', pay: 20, rep, obj: { kind: 'catch' }, progress: {}, ready: true });
  return id;
}

test('standing tiers by what you’ve done for them: new, known, trusted, a regular', () => {
  const C = K.newContracts();
  const at = (n) => { C.rep.ruth = n; return K.standingWith(C, 'ruth'); };
  assert.deepEqual([at(0).id, at(2).id, at(3).id, at(7).id, at(8).id, at(15).id, at(40).id], ['new', 'new', 'known', 'known', 'trusted', 'regular', 'regular']);
  assert.deepEqual([at(5).next.id, at(5).toGo], ['trusted', 3]);
  assert.equal(at(15).next, null);
  assert.equal(K.standingWith(C, 'trust').id, 'new', 'each giver their own');
});

test('a giver who knows you pays more: paid with the standing you had, the step up said', () => {
  const C = K.newContracts();
  C.rep.ruth = 2;
  // The job that takes you to "known" is paid as before; the next one 10% more.
  const a = K.claim(C, done(C, 'ruth', 1), 1);
  assert.equal(a.pay, 20);
  assert.equal(a.up, true);
  assert.equal(a.standing.id, 'known');
  const b = K.claim(C, done(C, 'ruth', 1), 1);
  assert.equal(b.pay, 22, '10% more');
  assert.equal(b.up, false);
  C.rep.ruth = 20;
  assert.equal(K.claim(C, done(C, 'ruth', 1), 1).pay, 26, 'a regular: 30% more');
  // Another giver's work, as ever.
  assert.equal(K.claim(C, done(C, 'bert', 1), 1).pay, 20);
});

test('a trusting giver’s work comes first on the board', () => {
  const W = { day: 30, region: 'home', kinds: ['row', 'skiff', 'rib', 'cabin', 'console', 'cruiser', 'sail', 'bass', 'kayak'], usable: ['row', 'skiff', 'rib', 'cabin', 'console', 'cruiser', 'sail', 'bass', 'kayak'], places: {}, hour: 10 };
  const plain = K.newContracts();
  plain.count = 20;
  const before = K.offers(plain, W);
  // (Someone on the board, trusted: their work to the top.)
  const giver = before[before.length - 1]?.giver;
  assert.ok(giver, 'a board to look at');
  const keen = K.newContracts();
  keen.count = 20;
  keen.rep[giver] = 10;
  const after = K.offers(keen, W);
  assert.equal(after[0].giver, giver, `${giver}'s work first`);
  // (But not the whole board: the rest keep the day's order, everyone else's among them.)
  const lifted = after.slice(0, K.KEEN_FIRST).filter((o) => o.giver === giver).length;
  assert.ok(lifted >= 1 && lifted <= K.KEEN_FIRST);
  const rest = after.slice(K.KEEN_FIRST).map((o) => o.tpl), natural = before.map((o) => o.tpl).filter((t) => !after.slice(0, K.KEEN_FIRST).some((o) => o.tpl === t));
  assert.deepEqual(rest, natural.slice(0, rest.length), 'the rest in the day’s order');
  // Every day, whoever it is: a trusted giver with work on the board has it first. (Their jobs
  // that can't be made today are skipped, not lifted in place of the one that can.)
  for (let day = 1; day <= 60; day++) {
    const Wd = { ...W, day };
    const board = K.offers(Object.assign(K.newContracts(), { count: 20 }), Wd);
    for (const g of new Set(board.map((o) => o.giver))) {
      const C = Object.assign(K.newContracts(), { count: 20 });
      C.rep[g] = 10;
      const top = K.offers(C, Wd);
      assert.equal(top[0].giver, g, `day ${day}: ${g}'s work first`);
      // (The same jobs, the board's six: nobody else's work made differently for it.)
      for (const o of top) assert.ok(K.offers(Object.assign(K.newContracts(), { count: 20 }), Wd).some((p) => p.tpl === o.tpl) || o.giver === g, `day ${day}: ${o.tpl}`);
    }
  }
});
