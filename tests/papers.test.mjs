// Her papers and her colours (src/papers.js, shipyard.js trimBoat; boat.js restripe, retube and
// setFlag): each boat you own has a registration, the day she became yours, what she's done
// (engine hours, sea miles, fuel, fish aboard, the best of them) and a log; a stripe or a RIB's
// tubes in a colour of your own, and a flag at her stern; all kept in the save, and an older game
// gets papers for every boat it owns. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const V = await import('../src/papers.js');
const { cleanYard, buyBoat, trimBoat, paintBoat, PAINTS, PRICES } = await import('../src/shipyard.js');
const { Boat, HULLS } = await import('../src/boat.js');
const { parseSave, envelope } = await import('../src/save.js');
const KINDS = Object.keys(HULLS);
const scene = new THREE.Scene();

test('her papers: a registration of her own, the day she became yours, what she’s done, and her log', () => {
  const regs = KINDS.map(V.regOf);
  assert.equal(new Set(regs).size, regs.length, 'every boat her own number');
  assert.ok(regs.every((r) => /^WH \d{3}$/.test(r)));
  const s = { day: 9, hour: 10, money: PRICES.rib + 50, ledger: [], yard: cleanYard(undefined, KINDS, false, 9) };
  // A new game: papers for the camp's three, records beginning today.
  assert.deepEqual(Object.keys(s.yard.vessels).sort(), ['kayak', 'row', 'skiff']);
  assert.equal(s.yard.vessels.skiff.since, 9);
  // Bought: her papers made out, and the purchase in her log.
  assert.ok(buyBoat(s, 'rib').ok);
  const P = s.yard.vessels.rib;
  assert.equal(P.reg, V.regOf('rib'));
  assert.equal(P.since, 9);
  assert.match(P.log.at(-1).text, /Bought/);
  // Under way: engine hours, sea miles, fuel; fish aboard and the best of them.
  V.addRun(P, { hours: 1.5, metres: 1852 * 3, litres: 20 });
  V.addRun(P, { hours: -1, metres: -5, litres: -2 });
  assert.ok(Math.abs(P.hours - 1.5) < 1e-9 && Math.abs(P.nm - 3) < 1e-9 && P.litres === 20);
  assert.equal(V.addFish(P, 'mackerel', 0.6, 34, 9), true);
  assert.equal(V.addFish(P, 'pollack', 3.2, 62, 10), true);
  assert.equal(V.addFish(P, 'mackerel', 0.5, 30, 10), false);
  assert.equal(P.fish, 3);
  assert.deepEqual(P.best, { id: 'pollack', kg: 3.2, size: 62, day: 10 });
  // The log keeps its last forty.
  for (let i = 0; i < 60; i++) V.logLine(P, 10, `line ${i}`);
  // (The same line again the same day, a holed hull knocked again: written once.)
  const n = P.log.length;
  V.logLine(P, 10, 'line 59');
  assert.equal(P.log.length, n, 'not again the same day');
  V.logLine(P, 11, 'line 59');
  assert.equal(P.log[P.log.length - 1].day, 11, 'another day, again');
  assert.equal(P.log.length, V.LOG_MAX);
  assert.equal(P.log.at(-1).text, 'line 59');
});

test('kept in the save; an older game gets papers for every boat it owns; nonsense is dropped', () => {
  const s = { day: 3, hour: 10, money: 9000, ledger: [], yard: cleanYard({ owned: ['row', 'skiff', 'kayak', 'cabin'] }, KINDS, false, 3) };
  V.addRun(s.yard.vessels.cabin, { hours: 2, metres: 4000, litres: 6 });
  const again = cleanYard(JSON.parse(JSON.stringify(s.yard)), KINDS, false, 40);
  assert.deepEqual(again.vessels, s.yard.vessels, 'read back as written (a later day changes nothing)');
  // A game from before papers: every boat it owns gets them, beginning on the day it's read.
  const old = cleanYard({ owned: ['row', 'skiff', 'kayak', 'console'] }, KINDS, false, 21);
  assert.deepEqual(Object.keys(old.vessels).sort(), ['console', 'kayak', 'row', 'skiff']);
  assert.ok(Object.values(old.vessels).every((v) => v.since === 21 && v.hours === 0 && /records begin/.test(v.log[0].text)));
  // Nonsense.
  const junk = cleanYard({ owned: ['row', 'skiff', 'kayak'], vessels: { row: { reg: 'HACKED', since: -4, hours: 'lots', nm: 1e99, fish: 2.7, best: { id: 'shark', kg: 'big' }, log: [{ day: 2, text: 'ok' }, { text: 7 }, 'x'] }, rib: { hours: 4 } } }, KINDS, false, 5);
  assert.equal(junk.vessels.row.reg, V.regOf('row'));
  assert.equal(junk.vessels.row.since, 0);
  assert.equal(junk.vessels.row.hours, 0);
  assert.equal(junk.vessels.row.fish, 2);
  assert.equal(junk.vessels.row.best, null);
  assert.deepEqual(junk.vessels.row.log, [{ day: 2, text: 'ok' }]);
  assert.ok(!junk.vessels.rib, 'not a boat you own');
  // Through the whole save, and back.
  const state = parseSave(JSON.stringify(envelope({ day: 6, yard: s.yard }))).state;
  assert.deepEqual(state.yard.vessels.cabin, s.yard.vessels.cabin);
});

test('her colours: a stripe or a RIB’s tubes from the chart, and a flag at her stern; paid for, only on your own', () => {
  const s = { day: 3, hour: 10, money: 2000, ledger: [], yard: cleanYard({ owned: ['row', 'skiff', 'kayak', 'rib'] }, KINDS, false, 3) };
  const m0 = s.money;
  assert.equal(trimBoat(s, 'skiff', 'stripe', 'red').ok, true);
  assert.equal(s.money, m0 - V.STRIPE_PRICE);
  assert.equal(trimBoat(s, 'skiff', 'stripe', 'red').ok, false, 'not twice');
  assert.equal(trimBoat(s, 'skiff', 'stripe', 'tartan').ok, false);
  assert.equal(trimBoat(s, 'skiff', 'tubes', 'red').ok, false, 'a skiff has no tubes');
  assert.equal(trimBoat(s, 'rib', 'tubes', 'navy', { stripes: false, tubes: true }).ok, true);
  assert.equal(trimBoat(s, 'rib', 'stripe', 'navy', { stripes: false, tubes: true }).ok, false, 'a RIB’s second colour is her tubes');
  assert.equal(trimBoat(s, 'cabin', 'stripe', 'navy').ok, false, 'not your boat');
  // A stripe and her paint want different colours.
  assert.ok(paintBoat(s, 'skiff', 'green').ok);
  assert.equal(trimBoat(s, 'skiff', 'stripe', 'green').ok, false);
  assert.equal(paintBoat(s, 'skiff', 'red').ok, false);
  // A flag, and down again (free).
  assert.equal(trimBoat(s, 'skiff', 'flag', 'burgee').ok, true);
  assert.equal(s.yard.looks.skiff.flag, 'burgee');
  const m1 = s.money;
  assert.equal(trimBoat(s, 'skiff', 'flag', null).ok, true);
  assert.equal(s.money, m1);
  assert.ok(!s.yard.looks.skiff.flag);
  assert.equal(trimBoat(s, 'skiff', 'flag', 'jolly-roger').ok, false);
  // Kept in the yard's records; nonsense dropped.
  trimBoat(s, 'skiff', 'flag', 'alpha');
  const back = cleanYard(JSON.parse(JSON.stringify(s.yard)), KINDS, false, 3);
  assert.deepEqual(back.looks, s.yard.looks);
  assert.deepEqual(cleanYard({ owned: ['skiff'], looks: { skiff: { stripe: 'plaid', flag: 'pirate', tubes: 'navy' } } }, KINDS).looks, { skiff: { tubes: 'navy' } });
  // No country's ensign and no one's mark among the flags.
  for (const F of V.FLAGS) assert.doesNotMatch(F.name, /ensign|union|national|brand/i);
});

test('drawn on her: the stripe recoloured, a RIB’s tubes recoloured, a flag at her stern (and away again)', () => {
  const colourCount = (b, tag, hex) => {
    const c = new THREE.Color(hex), f2 = c.r * c.r + c.g * c.g + c.b * c.b;
    let n = 0;
    b.group.traverse((o) => {
      const a = o.userData?.[tag] && o.geometry?.attributes?.color?.array;
      if (!a) return;
      for (let i = 0; i < a.length; i += 3) {
        const k = (a[i] * c.r + a[i + 1] * c.g + a[i + 2] * c.b) / f2;
        if (k > 0.88 && k < 1.1 && (a[i] - k * c.r) ** 2 + (a[i + 1] - k * c.g) ** 2 + (a[i + 2] - k * c.b) ** 2 < 0.0009 * f2) n++;
      }
    });
    return n;
  };
  const red = PAINTS.find((p) => p.id === 'red').hex, navy = PAINTS.find((p) => p.id === 'navy').hex;
  const s = new Boat(scene, { kind: 'skiff' });
  const before = colourCount(s, 'hull', HULLS.skiff.stripe);
  assert.ok(before > 10, 'she has a stripe');
  s.restripe(red);
  assert.ok(colourCount(s, 'hull', red) >= before && colourCount(s, 'hull', HULLS.skiff.stripe) === 0, 'the stripe repainted');
  s.restripe(null);
  assert.equal(colourCount(s, 'hull', HULLS.skiff.stripe), before, 'and back');
  const r = new Boat(scene, { kind: 'rib' });
  const tubes = colourCount(r, 'tubes', HULLS.rib.tubes.color);
  assert.ok(tubes > 100);
  r.retube(navy);
  assert.ok(colourCount(r, 'tubes', navy) >= tubes * 0.99);
  // The flag: up on a staff, and down again.
  s.setFlag(V.flagById.burgee);
  assert.ok(s.flag && s.flagCloth && s.flagId === 'burgee');
  s.setFlag(null);
  assert.ok(!s.flag && s.flagId === null);
  // The console's flag goes on her centreline, clear of her pair of outboards.
  const c = new Boat(scene, { kind: 'console' });
  c.setFlag(V.flagById.trust);
  assert.equal(c.flag.position.x, 0);
});
