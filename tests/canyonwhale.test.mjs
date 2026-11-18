// G7b: a sperm whale at home, hunting Gannet Deep (src/world/sealife.js WHALES, the canyon of
// src/world/terrain.js): kept to the canyon's deep water, up to breathe and blow over it; and
// everything else the sea's life is made of exactly where it was (its own dice). Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { buildSeaLife } = await import('../src/world/sealife.js');
const { canyonAt, depthAt } = await import('../src/world/terrain.js');

const scene = new THREE.Scene();
const ctxFor = (from, extra = {}) => ({ from, boat: null, boatSpeed: 0, daylight: 1, region: 'home', eco: null, diving: false, ...extra });

test('a sperm whale at home, in Gannet Deep: over the canyon, and up to blow', () => {
  const life = buildSeaLife(scene);
  const home = life.whales.filter((w) => w.sea === 'home');
  assert.deepEqual(home.map((w) => w.kind).sort(), ['finwhale', 'minkewhale', 'spermwhale']);
  const w = home.find((x) => x.kind === 'spermwhale');
  // (The one in the south and the one on the crossing are where they were: first in the list.)
  assert.equal(life.whales.find((x) => x.kind === 'spermwhale').sea, 'south');
  assert.ok(canyonAt(w.x, w.z) > 0.3 && depthAt(w.x, w.z) >= 100, `starts over the canyon: ${depthAt(w.x, w.z).toFixed(0)} m`);
  // Over a long while, wherever it heads it's over the canyon's deep water; and it comes up and blows.
  const blows = [];
  life.onBlow = (x, z, size, kind) => { if (kind === 'spermwhale' && z < 2000) blows.push({ x, z }); };
  let t = 0;
  for (let i = 0; i < 30 * 900; i++) {
    t += 1 / 30;
    life.update(1 / 30, t, ctxFor({ x: w.x + 150, z: w.z }));
    if (i % 300 === 0) {
      assert.ok(depthAt(w.target.x, w.target.z) >= 100 && canyonAt(w.target.x, w.target.z) > 0.3, `heading for ${Math.round(w.target.x)}, ${Math.round(w.target.z)}`);
      assert.ok(depthAt(w.x, w.z) > 40, `over deep water at ${Math.round(w.x)}, ${Math.round(w.z)}`);
    }
  }
  assert.ok(blows.length >= 5, `${blows.length} blows`);
  assert.ok(blows.every((b) => canyonAt(b.x, b.z) > 0.1), 'blowing over the canyon');
});

test('the rest of the sea’s life is where it was: the canyon’s whale rolls dice of its own', () => {
  // A fingerprint of where everything else made from the seed starts (the pods, the other whales,
  // the seals ashore, the visitors, the colonies, the feeders, the haul-outs, the shearwaters and
  // the turtles), taken before the canyon's whale was added. Made after the whales from the same
  // dice, they'd all have moved had it drawn from them.
  const life = buildSeaLife(scene);
  const q = (v) => (typeof v === 'number' ? Math.round(v * 10) : v);
  const pick = (o) => [o.kind, q(o.x), q(o.z), q(o.heading), q(o.t), o.target ? [q(o.target.x), q(o.target.z)] : null];
  const groups = {};
  for (const k of ['pods', 'whales', 'ashore', 'visitors', 'colony', 'feeders', 'haulouts', 'shears', 'turtles']) {
    assert.ok(Array.isArray(life[k]), k);
    // (Leaving out what rolls its own dice: the canyon's whale, and El Banco's dolphins.)
    groups[k] = life[k].filter((w) => !(k === 'whales' && w.kind === 'spermwhale' && w.sea === 'home') && !w.ownDice).map(pick);
  }
  assert.deepEqual(Object.values(groups).map((L) => L.length), [6, 5, 8, 4, 6, 8, 2, 12, 3]);
  let h = 2166136261;
  const s = JSON.stringify(groups);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  // (Taken again for the archipelago, docs/ARCHIPELAGO.md: its seabed changed how often the south's
  // creatures re-roll a start in deep enough water, and so the shared dice everything after them
  // draws. Everything made since rolls its own: El Banco's dolphins, like the canyon's whale.)
  assert.equal(h, 1355927063, 'everything else where it was');
  assert.equal(life.whales[life.whales.length - 1].kind, 'spermwhale', 'the canyon’s whale last in the list');
});
