// Marine physics C6b (docs/IMPROVEMENTS.md): getting her home. A breach plugged at sea lets in a
// fifth of what it did; a tube's puncture stopped leaks a fifth; swamped (past most of what she
// can hold) she's low and heavy, and on Realistic her outboard drowns; on Relaxed she's never
// swamped. (The harbour's tow is in main.js: checked in the browser.)
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat } = await import('../src/boat.js');
const DM = await import('../src/damage.js');
const FL = await import('../src/flooding.js');
const { newEngine, blocker } = await import('../src/engine.js');

const scene = new THREE.Scene();
const afloat = (kind, prep, secs) => {
  const b = new Boat(scene, { kind });
  b.place(300, 900, 0);
  b.damage = DM.newDamage(DM.TUBED.has(kind));
  const said = [];
  b.onFlood = (bt, what) => said.push(what);
  prep?.(b);
  for (let i = 0; i < secs * 30; i++) b.update(1 / 30, i / 30, 0, 0, 0);
  return { b, said };
};

test('plugged at sea, a breach lets in a fifth of what it did; a tube’s puncture leaks a fifth', () => {
  // (Its rate at the first: a fifth. Over a minute a little more than a fifth of the open one's
  // water, since the open hole slows as the water inside rises to meet it.)
  const open = afloat('skiff', (b) => { b.damage.hull.bottom = 1; }, 2), plugged = afloat('skiff', (b) => { b.damage.hull.bottom = 1; assert.ok(DM.plug(b.damage, 'hull:bottom')); }, 2);
  const ratio = plugged.b.flooding.breach / open.b.flooding.breach;
  assert.ok(ratio > 0.15 && ratio < 0.25, `a plugged hole lets in ${(ratio * 100).toFixed(0)}% of an open one`);
  const openMin = afloat('skiff', (b) => { b.damage.hull.bottom = 1; }, 60), plugMin = afloat('skiff', (b) => { b.damage.hull.bottom = 1; DM.plug(b.damage, 'hull:bottom'); }, 60);
  assert.ok(plugMin.b.flooding.litres > 0 && plugMin.b.flooding.litres < openMin.b.flooding.litres * 0.4, `${Math.round(plugMin.b.flooding.litres)} L plugged against ${Math.round(openMin.b.flooding.litres)} L in a minute`);
  // What can be plugged: a breach (cracked right through), a leaking chamber; each once.
  const D = DM.newDamage(true);
  D.hull.port = 0.9;
  D.hull.bow = 0.6;
  D.tubes[1].leak = DM.TUBE.leak;
  assert.deepEqual(DM.pluggable(D), ['hull:port', 'tube:1']);
  assert.ok(DM.plug(D, 'tube:1'));
  assert.ok(Math.abs(D.tubes[1].leak - DM.TUBE.leak * DM.PLUGGED) < 1e-12);
  assert.equal(DM.plug(D, 'tube:1'), false);
  assert.equal(DM.plug(D, 'hull:bow'), false, 'a crack not right through: nothing to plug');
  assert.deepEqual(DM.pluggable(D), ['hull:port']);
  // Kept in the save; the yard's work takes the plug out with the damage.
  DM.plug(D, 'hull:port');
  const back = DM.cleanDamage(DM.damageSave(D), true);
  assert.equal(back.plugs.port, true);
  assert.equal(back.tubes[1].plugged, true);
  DM.mend(D, 'hull:port');
  assert.equal(D.plugs.port, undefined);
  DM.mend(D, 'tube:1');
  assert.equal(D.tubes[1].plugged, false);
});

test('swamped, she says so once; on Realistic her outboard drowns, on Standard it doesn’t; on Relaxed she’s never swamped', () => {
  const holed = (b) => { b.damage.hull.bottom = 1; b.damage.hull.port = 1; };
  const std = afloat('skiff', holed, 600);
  assert.ok(std.b.flooding.swamped);
  assert.equal(std.said.filter((w) => w === 'swamped').length, 1);
  assert.ok(!std.b._drowned && !std.said.includes('engine'));
  const real = afloat('skiff', (b) => { holed(b); b.floodMode = FL.MODES.realistic; }, 600);
  assert.ok(real.b.flooding.swamped && real.b._drowned && real.said.includes('engine'));
  // Her starter refuses in an outboard's words, not an engine room's; bailed below a third and
  // more, it's free again.
  const E = newEngine('skiff');
  E.cord = true;
  E.drowned = real.b._drowned;
  assert.equal(blocker(E).id, 'drowned');
  assert.match(blocker(E).text, /powerhead/);
  real.b.damage.water = [real.b.compartments()[0].cap * 0.3];
  for (let i = 0; i < 30; i++) real.b.update(1 / 30, i / 30, 0, 0, 0);
  assert.ok(!real.b._drowned, 'bailed, her outboard is no longer under');
  const relaxed = afloat('skiff', (b) => { holed(b); b.floodMode = FL.MODES.relaxed; }, 600);
  assert.ok(!relaxed.b.flooding.swamped && !relaxed.said.includes('swamped'));
});
