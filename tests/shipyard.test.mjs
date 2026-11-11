// Money and the Marine Works (src/economy.js, src/shipyard.js): one purse, never overdrawn, every
// payment a receipt; fuel at the pump quoted before it's bought; the harbour's goodwill when you're
// broke; boats bought and hired; paint, names and fittings; and nothing ever taken away from an
// older game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pay, earn, canAfford, cleanLedger, fuelQuote, fuelPrice, goodwillDue, ECONOMY_IDS, LEDGER_MAX, GOODWILL_L } from '../src/economy.js';
import { STARTER, PRICES, hirePrice, PAINTS, FITS, fitsFor, cleanYard, owns, usable, buyBoat, hireBoat, paintBoat, nameBoat, fitBoat, fitEffect, cleanBoatName } from '../src/shipyard.js';

const KINDS = ['row', 'skiff', 'kayak', 'bass', 'cabin', 'sail', 'cruiser', 'console', 'rib', 'windsurf', 'jetski'];
const fresh = (money = 20) => ({ money, day: 3, hour: 10, ledger: [], yard: cleanYard(undefined, KINDS) });

test('the purse is never overdrawn, nothing is half-paid, and every payment leaves a receipt', () => {
  const s = fresh(10);
  assert.equal(pay(s, 12, 'too dear').ok, false);
  assert.equal(s.money, 10, 'nothing taken');
  assert.equal(s.ledger.length, 0);
  assert.equal(pay(s, 9.99, 'bait').ok, true);
  assert.equal(s.money, 0.01);
  assert.equal(pay(s, -5, 'a trick').ok, false);
  assert.equal(pay(s, NaN, 'a trick').ok, false);
  earn(s, 14.5, 'two bass');
  earn(s, -3, 'nonsense');
  assert.equal(s.money, 14.51);
  assert.deepEqual(s.ledger.map((e) => e.v), [-9.99, 14.5]);
  assert.equal(s.ledger.at(-1).bal, 14.51);
  assert.ok(canAfford(s, 14.51) && !canAfford(s, 14.52));
  for (let i = 0; i < 100; i++) earn(s, 1, 'x');
  assert.equal(s.ledger.length, LEDGER_MAX, 'the ledger keeps the last few');
  assert.deepEqual(cleanLedger([{ at: 1, v: 2, what: 'ok', bal: 3 }, { at: 'x', v: 1 }, null, 'junk']), [{ at: 1, what: 'ok', v: 2, bal: 3 }]);
});

test('fuel at the pump: the price before you buy, and as much as your purse runs to', () => {
  assert.deepEqual(ECONOMY_IDS, ['gentle', 'authentic']);
  assert.ok(fuelPrice('authentic') > fuelPrice('gentle') * 2);
  const full = fuelQuote(40, 'gentle', 100);
  assert.deepEqual(full, { litres: 40, price: 16, short: false });
  const part = fuelQuote(40, 'gentle', 5);
  assert.equal(part.short, true);
  assert.ok(part.price <= 5 && part.litres === 12.5);
  assert.deepEqual(fuelQuote(40, 'gentle', 0), { litres: 0, price: 0, short: true });
  // A run across the home waters flat out in the RIB (about 80 s at 0.05 L/s): small change.
  assert.ok(fuelQuote(80 * 0.05, 'gentle', 100).price < 2);
});

test('broke and nearly dry, the harbour gives you enough to get home, once a day', () => {
  const s = fresh(0.1);
  assert.equal(goodwillDue(s, 'gentle', 1), true);
  assert.equal(goodwillDue(s, 'gentle', GOODWILL_L + 1), false, 'not with fuel to spare');
  assert.equal(goodwillDue({ ...s, money: 30 }, 'gentle', 0), false, 'not with money in your purse');
  s.goodwillDay = s.day;
  assert.equal(goodwillDue(s, 'gentle', 0), false, 'once a day');
});

test('a new game has the camp’s three boats; an older game keeps every boat it had', () => {
  const Y = cleanYard(undefined, KINDS);
  assert.deepEqual(Y.owned.sort(), [...STARTER].sort());
  assert.deepEqual(cleanYard(undefined, KINDS, true).owned.sort(), [...KINDS].sort());
  const junk = cleanYard({ owned: ['rib', 'yacht!', 'rib'], hired: { kind: 'sail', day: 4 }, looks: { rib: { paint: 'navy', name: 'Sea<script>Wolf' }, row: { paint: 'tartan' } }, fits: { rib: ['tank', 'tank', 'warp'], row: ['power'] } }, KINDS);
  assert.ok(junk.owned.includes('rib') && STARTER.every((k) => junk.owned.includes(k)), 'the starters can never be lost');
  assert.equal(junk.owned.filter((k) => k === 'rib').length, 1);
  assert.deepEqual(junk.hired, { kind: 'sail', day: 4 });
  assert.deepEqual(junk.looks, { rib: { paint: 'navy', name: 'SeascriptWolf' } });
  assert.deepEqual(junk.fits, { rib: ['tank'] });
  for (const k of Object.keys(PRICES)) assert.ok(PRICES[k] > 0 && !STARTER.includes(k), k);
});

test('buying a boat: paid for once, yours for good', () => {
  const s = fresh(PRICES.rib - 1);
  assert.equal(buyBoat(s, 'rib').ok, false);
  assert.equal(owns(s.yard, 'rib'), false);
  earn(s, 1, 'a mackerel');
  assert.equal(buyBoat(s, 'rib').ok, true);
  assert.equal(s.money, 0);
  assert.equal(buyBoat(s, 'rib').ok, false, 'not twice');
  assert.equal(buyBoat(s, 'row').ok, false, 'the rowing boat isn’t for sale: she’s yours');
});

test('hiring: one boat at a time, for the day, then she goes back', () => {
  const s = fresh(200);
  assert.equal(hireBoat(s, 'rib').ok, true);
  assert.equal(s.money, 200 - hirePrice('rib'));
  assert.equal(usable(s.yard, 'rib', s.day), true);
  assert.equal(hireBoat(s, 'console').ok, false, 'one at a time');
  assert.equal(hireBoat(s, 'rib').ok, false, 'not twice in a day');
  assert.equal(usable(s.yard, 'rib', s.day + 1), false, 'the next day she’s back at the yard');
  s.day++;
  assert.equal(hireBoat(s, 'console').ok, true, 'and another can be hired');
  assert.ok(hirePrice('cruiser') < PRICES.cruiser / 20 && hirePrice('windsurf') >= 6);
});

test('paint, a name and fittings: only on your own boat, each paid once, and fittings that buy range and speed', () => {
  const s = fresh(2000);
  assert.equal(paintBoat(s, 'rib', 'navy').ok, false, 'not before she’s yours');
  buyBoat(s, 'rib');
  assert.equal(paintBoat(s, 'rib', 'navy').ok, true);
  assert.equal(paintBoat(s, 'rib', 'navy').ok, false, 'not twice the same');
  assert.equal(paintBoat(s, 'rib', 'tartan').ok, false);
  assert.equal(nameBoat(s, 'rib', '  Kittiwake  ').ok, true);
  assert.equal(s.yard.looks.rib.name, 'Kittiwake');
  assert.equal(cleanBoatName('A'.repeat(40)).length, 18);
  assert.ok(['tank', 'sonar', 'plotter', 'anchor'].every((id) => fitsFor('rib').includes(id)));
  // (The RIB chooses her engine and propeller from the engine catalogue instead: see engines.test.mjs.)
  assert.ok(!fitsFor('rib').includes('power') && !fitsFor('rib').includes('economy'));
  assert.ok(fitsFor('console').includes('power') && fitsFor('console').includes('economy'));
  assert.deepEqual(fitsFor('row'), []);
  const none = fitEffect(s.yard, 'rib');
  assert.ok(none.tank === 1 && none.thrust === 1 && none.burn === 1 && none.kg === 0 && !none.sonar);
  assert.equal(fitBoat(s, 'rib', 'tank').ok, true);
  assert.equal(fitBoat(s, 'rib', 'tank').ok, false, 'not twice');
  assert.equal(fitBoat(s, 'rib', 'power').ok, false, 'her engine comes from the catalogue');
  const e = fitEffect(s.yard, 'rib');
  assert.ok(e.tank > 1 && e.thrust === 1 && e.burn === 1);
  assert.equal(fitBoat(s, 'row', 'power').ok, false);
  assert.ok(PAINTS.length >= 8 && Object.values(FITS).every((f) => f.desc && f.name));
  // Nothing here touches the fish: no fitting has anything to do with bites.
  for (const f of Object.values(FITS)) assert.ok(!('bite' in f) && !('catch' in f));
});

test('goals: counted from what the game keeps, done when reached', async () => {
  const { goalsOf } = await import('../src/goals.js');
  const { FISH } = await import('../src/fish.js');
  const none = goalsOf({ fish: {}, yard: { owned: ['row', 'skiff', 'kayak'] }, tips: {} }, { places: [2, 20] });
  assert.ok(none.every((g) => g.n <= g.of));
  assert.equal(none.find((g) => g.id === 'boats').n, 3);
  assert.equal(none.filter((g) => g.done).length, 0);
  const live = FISH.filter((f) => !f.retired);
  const all = Object.fromEntries(live.map((f) => [f.id, { count: 1, best: f.size[1] }]));
  const done = goalsOf({ fish: all, yard: { owned: KINDS }, tips: { brasa: true } }, { places: [20, 20] });
  assert.ok(done.every((g) => g.done), done.filter((g) => !g.done).map((g) => g.id).join());
  const k = done.find((g) => g.id === 'kinds');
  assert.equal(k.of, done.find((g) => g.id === 'fresh').of + done.find((g) => g.id === 'salt').of, 'fresh and sea make up every kind');
});

test('one question instead of six: each play style is a whole, valid set of choices', async () => {
  const { STYLES, STYLE_IDS, styleOf } = await import('../src/playstyle.js');
  const { DIFFICULTY_IDS } = await import('../src/fight.js');
  const { BEHAVIOUR_IDS } = await import('../src/behaviour.js');
  const { CAST_MODES } = await import('../src/settings.js');
  const { START_IDS } = await import('../src/engine.js');
  const { ECONOMY_IDS } = await import('../src/economy.js');
  for (const id of STYLE_IDS) {
    const S = STYLES[id].set;
    assert.ok(DIFFICULTY_IDS.includes(S.difficulty) && BEHAVIOUR_IDS.includes(S.behaviour) && CAST_MODES[S.cast] && ['assisted', 'expert'].includes(S.technique) && START_IDS.includes(S.start) && ['notches', 'lever'].includes(S.throttle) && ['hand', 'helped'].includes(S.sailTrim) && ECONOMY_IDS.includes(S.economy), id);
    assert.equal(styleOf({ ...S }), id);
  }
  assert.equal(styleOf({ ...STYLES.easy.set, throttle: 'lever' }), null, 'changed on its own: your own mix');
});

test('Shipyard 2.0: every fitting weighs something real and does something real, never to do with bites', async () => {
  const { FIT_CATS, unfitBoat } = await import('../src/shipyard.js');
  const KINDS = ['row', 'skiff', 'kayak', 'bass', 'sail', 'cabin', 'cruiser', 'console', 'rib', 'windsurf', 'jetski'];
  for (const [id, F] of Object.entries(FITS)) {
    assert.ok(FIT_CATS[F.cat], `${id} has a category`);
    assert.ok(F.kg >= 0 && F.amps >= 0, `${id} weight and draw`);
    assert.ok(Object.keys(F.price).length > 0 && Object.keys(F.price).every((k) => KINDS.includes(k)), id);
    assert.ok(!/bite|catch more|more fish/i.test(F.desc), `${id} says nothing of bites`);
  }
  // Each motorboat takes a fair choice; the rowing boat, kayak and board none.
  for (const k of ['skiff', 'bass', 'cabin', 'console', 'rib', 'cruiser']) assert.ok(fitsFor(k).length >= 6, k);
  for (const k of ['row', 'kayak', 'windsurf']) assert.equal(fitsFor(k).length, 0, k);
  const s = { day: 1, hour: 9, money: 5000, ledger: [], yard: cleanYard({ owned: KINDS }, KINDS) };
  // One engine choice at a time: the economy tune replaces the bigger outboard.
  assert.ok(fitBoat(s, 'console', 'power').ok);
  const big = fitEffect(s.yard, 'console');
  assert.ok(big.thrust > 1 && big.burn > 1);
  const sw = fitBoat(s, 'console', 'economy');
  assert.ok(sw.ok && sw.swapped === 'power');
  assert.deepEqual(s.yard.fits.console, ['economy']);
  let e = fitEffect(s.yard, 'console');
  assert.ok(e.burn < 1 && e.thrust < 1);
  // Weight and draw add up; the flags follow.
  for (const id of ['sonar', 'lights', 'livewell', 'battery', 'anchor']) assert.ok(fitBoat(s, 'console', id).ok, id);
  e = fitEffect(s.yard, 'console');
  assert.equal(e.kg, ['economy', 'sonar', 'lights', 'livewell', 'battery', 'anchor'].reduce((a, id) => a + FITS[id].kg, 0));
  assert.ok(e.amps >= 7 && e.sonar && e.lights && e.livewell && e.house && e.hold > 2);
  // Taking one off: free, no refund, the weight gone.
  const m = s.money;
  assert.ok(unfitBoat(s, 'console', 'livewell').ok);
  assert.equal(s.money, m);
  assert.equal(fitEffect(s.yard, 'console').kg, e.kg - FITS.livewell.kg);
  // The save keeps one to a slot, and drops what doesn't fit.
  const back = cleanYard({ owned: KINDS, fits: { console: ['power', 'economy', 'bimini', 'livewell', 'nonsense'] } }, KINDS);
  assert.deepEqual(back.fits.console, ['economy', 'livewell']);
});

