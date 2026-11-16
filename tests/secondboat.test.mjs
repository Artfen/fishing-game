// G8c1, boats of her own: a second boat of a kind ('rib~2') in a save is kept everywhere a boat is
// (where she lies, the one you're in, laid up, shipped, towing, her engine room, damage, the jerry
// can aboard), and the game builds her, moors her at a berth of her own, and works out her fitted
// tank, burn and engine under her id (src/save.js, src/main.js). Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { sanitize } = await import('../src/save.js');

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
