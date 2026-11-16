// G8a, boats of her own: each boat known by an id of her own, not by her kind (src/boat.js; the
// fleet's berths and laying up, src/fleet.js; where each lies, the one you're in, the ones laid
// up, on the trailer, shipped or towed, src/main.js). For now each boat's id is her kind, one of
// each, so nothing a player sees changes. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { Boat, BOAT_KINDS } = await import('../src/boat.js');
const { ownBerths, chooseAfloat, cleanStored, MAX_AFLOAT } = await import('../src/fleet.js');

test('a boat has an id of her own: her kind unless given one, and her kind still what sort of boat she is', () => {
  const scene = new THREE.Scene();
  for (const kind of BOAT_KINDS) {
    const b = new Boat(scene, { kind });
    assert.equal(b.id, kind, `${kind}: her id, for now, her kind`);
    assert.equal(b.kind, kind);
  }
  const two = new Boat(scene, { kind: 'rib', id: 'rib-2' });
  assert.equal(two.id, 'rib-2');
  assert.equal(two.kind, 'rib', 'the same sort of boat');
  assert.equal(two.hull, new Boat(scene, { kind: 'rib' }).hull, 'the same hull');
  // (An unknown kind is a rowing boat, as ever, and her id follows it unless she has one.)
  assert.equal(new Boat(scene, { kind: 'nonesuch' }).id, 'row');
});

test('the fleet works by id: two boats of a kind each get a berth, and are laid up and launched on their own', () => {
  // (Ready for a second boat of a kind: the berths and laying up know nothing of kinds.)
  const F = { x0: 0, x1: 40, z0: -2, z1: 2 };
  const ids = ['rib', 'rib-2', 'sail'];
  const L = { rib: 6.5, 'rib-2': 6.5, sail: 7.5 }, B = { rib: 1.25, 'rib-2': 1.25, sail: 1.3 };
  const berths = ownBerths(F, ids, L, B);
  assert.deepEqual(Object.keys(berths).sort(), ['rib', 'rib-2', 'sail']);
  const [a, b] = [berths.rib, berths['rib-2']];
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 3, 'the two RIBs in berths of their own');
  // Laying up: each by her id.
  assert.deepEqual(cleanStored(['rib-2'], ids), ['rib-2']);
  assert.equal(cleanStored(['rib', 'rib-2', 'sail'], ids), null, 'never all of them');
  // Which to keep afloat: the one you were in first, then the rest, never more than three.
  const afloat = chooseAfloat(['rib', 'rib-2', 'sail', 'cabin'], { vessel: 'rib-2' });
  assert.equal(afloat[0], 'rib-2');
  assert.equal(afloat.length, MAX_AFLOAT);
});

test('the game keeps each boat by her id: where she lies, the one you are in, laid up, on the trailer, shipped, towed', () => {
  // (A guard on src/main.js: the places that mean "this boat" read her id, not her kind. Her kind
  // stays for what sort of boat she is: her home, her mooring, her hull.)
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /new Boat\(scene, \{ kind: k, id: k \}\)\)\.map\(\(b\) => \[b\.id, b\]\)/, 'the boats built and found by id');
  for (const [what, re] of [
    ['where each lies in the save', /state\.boats\[id\] = \{/],
    ['the one you are in', /state\.vessel = boat\.id;/],
    ['crewing, the one you stepped from', /state\.vessel = crewFrom\.boat\.id;/],
    ['diving, the one you went in from', /state\.vessel = dive\.boat\.id;/],
    ['a tow, your own boats on it', /state\.tow = tow \? \{ lead: ownId\(tow\.lead\), towed: ownId\(tow\.towed\) \}/],
    ['laid up', /state\.stored = \[\.\.\.new Set\(\[\.\.\.state\.stored, b\.id\]\)\]/],
    ['launched', /state\.stored = state\.stored\.filter\(\(id\) => id !== b\.id\)/],
    ['on the trailer', /state\.trailer\.boat = b\.id;/],
    ['shipped', /\{ kind: b\.id, to, due \}/],
  ]) assert.match(src, re, what);
  for (const [what, re] of [
    ['laid up, by kind', /isStored\([a-zA-Z]+\.kind\)/],
    ['the one you are in, by kind', /state\.vessel = [a-zA-Z.]+\.kind\b/],
    ['on the trailer, by kind', /state\.trailer\.boat = [a-zA-Z]+\.kind\b/],
    ['laid up or launched, by kind', /state\.stored[^;\n]*\b[a-z]+\.kind\b/],
    ['shipped, by kind', /kind: [a-z]+\.kind, to, due/],
    ['where each lies, by kind', /state\.boats\[[a-z]*\.?kind\]/],
  ]) assert.doesNotMatch(src, re, what);
});
