// G8c1, boats of her own: a second boat of a kind ('rib~2') in a save is kept everywhere a boat is
// (where she lies, the one you're in, laid up, shipped, towing, her engine room, damage, the jerry
// can aboard), and the game builds her, moors her at a berth of her own, and works out her fitted
// tank, burn and engine under her id (src/save.js, src/main.js). Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { sanitize } = await import('../src/save.js');
const Sy = await import('../src/shipyard.js');
const Tg = await import('../src/together.js');
const Cr = await import('../src/crossing.js');

const base = (extra = {}) => ({
  day: 9, hour: 10, money: 900, vessel: 'rib~2', mode: 'boat',
  yard: { owned: ['row', 'skiff', 'kayak', 'rib', 'rib~2', 'rib~x', 'nonesuch~2'], looks: { 'rib~2': { name: 'Second Wind' } } },
  boats: { rib: { x: 10, z: -60, heading: 1.5 }, 'rib~2': { x: 14, z: -60, heading: 1.5 }, 'rib~x': { x: 0, z: 0, heading: 0 } },
  stored: ['kayak', 'sail', 'cabin', 'cruiser', 'console', 'jetski', 'windsurf', 'bass', 'skiff', 'row'],
  ...extra,
});

test('a save keeps a second boat of a kind everywhere a boat is kept', () => {
  const s = sanitize(base({
    tow: { lead: 'rib~2', towed: 'rib' },
    shipping: [{ kind: 'rib~2', to: 'south', due: 300 }, { kind: 'bass~2', to: 'south', due: 300 }],
    engines: { 'rib~2': { key: true }, 'rib~x': { key: true } },
    damage: { 'rib~2': { hull: { bottom: 0.4 } } },
    fuel: { boats: { 'rib~2': 33 }, can: { at: 'boat:rib~2', litres: 5 } },
  }));
  assert.deepEqual(s.yard.owned, ['row', 'skiff', 'kayak', 'rib', 'rib~2']);
  assert.equal(s.vessel, 'rib~2', 'the one you were in');
  assert.ok(s.boats['rib~2'] && s.boats['rib~2'].x === 14, 'where she lies');
  assert.ok(!('rib~x' in s.boats), 'nonsense dropped');
  assert.deepEqual(s.tow, { lead: 'rib~2', towed: 'rib' }, 'towing the other');
  assert.deepEqual(s.shipping.map((x) => x.kind), ['rib~2'], 'on the supply ship (and never a bass boat)');
  assert.ok(s.engines['rib~2'] && !s.engines['rib~x'], 'her engine room');
  assert.ok(s.damage['rib~2'], 'her damage');
  assert.equal(s.fuel.boats['rib~2'], 33);
  assert.equal(s.fuel.can.at, 'boat:rib~2', 'the jerry can aboard her');
  assert.ok(!s.stored.includes('rib~2'), 'in the water, as she was');
});

test('a second boat with no place in the save yet starts laid up; one you don\'t own isn\'t yours', () => {
  const s = sanitize(base({ boats: { rib: { x: 10, z: -60, heading: 1.5 } }, stored: ['kayak', 'sail', 'cabin', 'cruiser', 'console', 'jetski', 'windsurf', 'bass'] }));
  assert.ok(s.stored.includes('rib~2'), 'laid up in the boat store');
  const t = sanitize({ ...base(), vessel: 'cabin~2', yard: { owned: ['row', 'skiff', 'kayak'] } });
  assert.equal(t.vessel, 'cabin~2', 'an id is kept as an id');
  assert.ok(!t.stored.includes('cabin~2'), 'but not one of your boats to lay up');
});

test('the game builds a second boat, moors her by her id and fits her out under it', () => {
  // (A guard on src/main.js; the browser check drives her.)
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const [what, re] of [
    ['a second of a harbour kind you own, built', /const SECONDS = \(state\.yard\?\.owned \|\| \[\]\)\.filter\(\(id\) => id !== kindOf\(id\) && isBoatId\(id, BOAT_KINDS\) && homeOf\(kindOf\(id\)\) === 'harbour'\)/],
    ['her mooring by her id', /function mooring\(id\) \{\n  const kind = kindOf\(id\)/],
    ['her own berth', /if \(homeOf\(kind\) === 'harbour'\) return ownBerth\(id\);/],
    ['the yard on each boat by her id', /for \(const b of Object\.values\(BOATS\)\) \{\n    const id = b\.id, k = b\.kind, e = fitEffect\(state\.yard, id\);/],
    ['her fitted tank', /TANKS\[id\] = Math\.round\(YARD_BASE\.tanks\[k\] \* e\.tank\)/],
    ['her revs on her own engine room', /if \(b\.engine\) b\.engine\.wot = S\.rpm;/],
  ]) assert.match(src, re, what);
  for (const [what, re] of [
    ['an electric outboard by kind', /\bELEC\[[a-z]+\.kind\]/],
    ['a mooring by kind', /mooring\([a-zA-Z]+\.kind\)/],
    ['each boat by kind, for her loads', /for \(const k of KINDS\) (\{|BOATS\[k\]\.setLoads)/],
  ]) assert.doesNotMatch(src, re, what);
  // (Her engine's revs flat out, her own: engine.js reads them off her engine room first.)
  const eng = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
  assert.match(eng, /const top = E\.wot \|\| WOT\[E\.kind\] \|\| P\.max;/);
});

test('G8c2: buying another of a kind you have, at the Marine Works', () => {
  const KINDS = ['row', 'skiff', 'kayak', 'bass', 'cabin', 'sail', 'cruiser', 'console', 'windsurf', 'jetski', 'rib'];
  const state = { day: 12, money: 5000, ledger: [], yard: Sy.cleanYard({ owned: ['row', 'skiff', 'kayak', 'rib', 'bass'] }, KINDS, false, 12) };
  // Only one you have already, and only one that lives at Willowhaven.
  assert.equal(Sy.buyAnother(state, 'console').ok, false, 'not before the first');
  assert.equal(Sy.buyAnother(state, 'bass').ok, false, 'the lake\'s jetty is one to a kind');
  assert.equal(Sy.buyAnother(state, 'skiff').ok, false, 'so is the camp\'s landing');
  const before = state.money, r = Sy.buyAnother(state, 'rib');
  assert.ok(r.ok, r.why);
  assert.equal(r.id, 'rib~2', 'her own id');
  assert.equal(before - state.money, Sy.PRICES.rib, 'a RIB\'s price');
  assert.deepEqual(Sy.ofKind(state.yard, 'rib'), ['rib', 'rib~2']);
  assert.equal(state.yard.vessels['rib~2'].reg, 'WH 171-2', 'her papers made out');
  assert.match(state.yard.vessels['rib~2'].log[0].text, /your second/);
  // Two to a kind.
  const again = Sy.buyAnother(state, 'rib');
  assert.equal(again.ok, false);
  assert.match(again.why, /Two of a kind/);
  // Kept through a save.
  const kept = Sy.cleanYard(JSON.parse(JSON.stringify(state.yard)), KINDS, false, 13);
  assert.deepEqual(kept.owned.filter((k) => k.startsWith('rib')), ['rib', 'rib~2']);
  // Not enough money: nothing bought.
  const poor = { day: 12, money: 10, ledger: [], yard: Sy.cleanYard({ owned: ['row', 'skiff', 'kayak', 'sail'] }, KINDS, false, 12) };
  assert.equal(Sy.buyAnother(poor, 'sail').ok, false);
  assert.ok(!poor.yard.owned.includes('sail~2'));
});

test('G8c2: a boat bought now is built and set up as every boat is, and named apart from the first', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const [what, re] of [
    ['what every boat is given, for one built later too', /const boatSetup = \[\];\nfunction eachBoat\(fn\) \{/],
    ['her knocks', /eachBoat\(\(b\) => \{\n  b\.onBump = /],
    ['her anchor\'s words', /eachBoat\(\(b\) => \{\n  b\.onAnchor = /],
    ['her flooding', /eachBoat\(\(b\) => \{\n  b\.floodMode = /],
    ['her damage', /eachBoat\(\(b\) => \{\n  b\.damageMode = /],
    ['shallow water', /eachBoat\(\(b\) => \{\n  if \(b\.motor\) b\.onShallow = /],
    ['a boat bought now, built and laid up', /function addBoat\(id\) \{[\s\S]*?for \(const fn of boatSetup\) fn\(b\);[\s\S]*?stow\(b, true\);/],
    ['bought at the yard and built', /const r = buyAnother\(state, kind\);\n    yardDo\(r, \(\) => \{\n      const b = addBoat\(r\.id\);/],
    // (Each laid-up boat by her own name; the bass boat's is "on Longmere", or down by road.)
    ['named apart in the harbour office', /laid\.flatMap\(\(b\) => \[\n\s+\{ text: homeOf\(b\.kind\) === 'lake' \? `The \$\{boatCall\(b\)\}, on Longmere` : `The \$\{boatCall\(b\)\}`, run: \(\) => launchBoat\(b\) \},\n\s+\.\.\.\(byRoad\(b\) \? \[\{ text: `The \$\{boatCall\(b\)\}, down here by road/],
  ]) assert.match(src, re, what);
  // (Set up only for the ones in the water at the start, as before: none left.)
  assert.doesNotMatch(src, /^for \(const b of boats\) \{\n  b\.on/m);
  assert.doesNotMatch(src, /^for \(const b of boats\) b\.onScrape/m);
});

test('G8c3: friends see a second boat of a kind by her id; one RIB can tow the other', () => {
  const KINDS = ['row', 'skiff', 'kayak', 'bass', 'cabin', 'sail', 'cruiser', 'console', 'windsurf', 'jetski', 'rib'];
  // A pose: in the second RIB, towing the first.
  const p = Tg.cleanPose({ m: 'boat', k: 'rib', i: 'rib~2', x: 10, z: 20, h: 1, tw: { k: 'rib', x: 12, z: 26, h: 1 } }, KINDS);
  assert.equal(p.k, 'rib');
  assert.equal(p.i, 'rib~2', 'which RIB she\'s in');
  assert.ok(p.tw && p.tw.k === 'rib' && !p.tw.i, 'towing the other RIB (the first)');
  // Towing herself (the same boat) isn't a tow; an id that isn't of her kind is dropped.
  assert.ok(!Tg.cleanPose({ m: 'boat', k: 'rib', x: 0, z: 0, h: 0, tw: { k: 'rib', x: 2, z: 5, h: 0 } }, KINDS).tw, 'the first RIB towing the first RIB');
  assert.ok(!('i' in Tg.cleanPose({ m: 'boat', k: 'rib', i: 'sail~2', x: 0, z: 0, h: 0 }, KINDS)), 'an id of another kind dropped');
  assert.ok(!('i' in Tg.cleanPose({ m: 'boat', k: 'rib', i: 'rib', x: 0, z: 0, h: 0 }, KINDS)), 'the first of a kind sends no id');
  // Moored: both RIBs, each once.
  const F = Tg.cleanFleet([{ k: 'rib', x: 1, z: 1, h: 0 }, { k: 'rib', i: 'rib~2', x: 5, z: 1, h: 0 }, { k: 'rib', i: 'rib~2', x: 9, z: 1, h: 0 }, { k: 'rib', x: 3, z: 3, h: 0 }], KINDS);
  assert.deepEqual(F.map((b) => b.i || b.k), ['rib', 'rib~2'], 'both RIBs, each once');
});

test('G8c3: a crossing in a second boat of a kind is kept; the crossing\'s words and records by her id and kind', () => {
  const C = Cr.cleanCrossing({ to: 'south', kind: 'cruiser~2', day: 4, abs: 100, secs: 30, events: [] });
  assert.ok(C && C.kind === 'cruiser~2', 'the second yacht making the crossing');
  assert.equal(Cr.cleanCrossing({ to: 'south', kind: 'rib~2', day: 4, abs: 100, secs: 30, events: [] }), null, 'no RIB makes the crossing');
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const [what, re] of [
    ['the crossing, by her id', /state\.crossing = \{ to, kind: S\.id,/],
    ['the fast passage, by her id', /passage = \{ to, kind: S\.id,/],
    ['reefed, the sailing boat making it', /if \(b\.kind === 'sail'\) b\.reef = C\?\.eased && C\.kind === b\.id/],
    ['the best crossing for a boat of her kind', /P\.best\[kindOf\(C\.kind\)\] = mins/],
    ['a voyage in her, by her id', /onVoyage\(V, \{ k: 'boat', kind: boat\.id \}\)/],
    ['her id to friends, a second of a kind\'s', /k: boat\.kind, \.\.\.\(boat\.id !== boat\.kind \? \{ i: boat\.id \} : \{\}\)/],
    ['her moored boats to friends, by id', /k: b\.kind, \.\.\.\(b\.id !== b\.kind \? \{ i: b\.id \} : \{\}\), x: b\.pos\.x/],
  ]) assert.match(src, re, what);
});

