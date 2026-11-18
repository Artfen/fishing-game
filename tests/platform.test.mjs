// The trawler's swim platform and her tender (L6 of docs/LIVEABOARD.md): it goes down and up in its
// time, stopping while she moves; when she can launch; the window for hauling her back on; how it's
// saved; and on the trawler, the platform moving as a piece with its floor and chocks.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const Pf = await import('../src/platform.js');
const D = await import('../src/deckplan.js');
const { Boat, HULLS } = await import('../src/boat.js');
const { parseSave, SAVE_VERSION } = await import('../src/save.js');
const { PLATFORM } = Pf;

test('down in its time and up again, and stopped where it is while she moves', () => {
  let d = 0, s = 0;
  while (d < 1 && s < 60) { d = Pf.stepPlatform(d, 1, 0.1); s += 0.1; }
  assert.ok(Math.abs(s - PLATFORM.secs) < 0.2, `down in ${s.toFixed(1)} s`);
  // Down past where the tender floats off a while before it's all the way.
  assert.ok(PLATFORM.float < 1 && PLATFORM.float * PLATFORM.travel > 0.4 + 0.15, 'under her chocks by then');
  assert.equal(Pf.stepPlatform(0.5, 1, 1, PLATFORM.still + 0.1), 0.5, 'held while she moves');
  assert.ok(Pf.stepPlatform(0.5, 0, 1) < 0.5, 'and up');
  assert.equal(Pf.stepPlatform(0, 0, 1), 0);
});

test('launching: only with her still, water enough and not too much sea', () => {
  assert.ok(Pf.canLaunch({ anchored: true, speed: 0.2 }, 5, 0.3).ok);
  assert.ok(Pf.canLaunch({ tie: {}, speed: 0 }, 5, 0.3).ok);
  assert.ok(Pf.canLaunch({ speed: 0.1, lever: 0 }, 5, 0.3).ok, 'stopped, in neutral');
  assert.match(Pf.canLaunch({ speed: 2, lever: 0.3 }, 5, 0.3).why, /still/);
  assert.match(Pf.canLaunch({ anchored: true, speed: 0 }, 1, 0.3).why, /water/);
  assert.match(Pf.canLaunch({ anchored: true, speed: 0 }, 5, 2).why, /sea/);
});

test('hauling her on: near the platform\'s edge, across it, slowly; a generous window', () => {
  const edge = { x: 0, z: 0 }, mh = 0;
  const across = { x: 0.5, z: -1.2, heading: -Math.PI / 2, speed: 0.4 };
  assert.ok(Pf.inWindow(edge, mh, across).ok);
  assert.ok(Pf.inWindow(edge, mh, { ...across, heading: Math.PI / 2 }).ok, 'either way across');
  assert.ok(Pf.inWindow(edge, mh, { ...across, heading: -Math.PI / 2 + 0.4 }).ok, 'twenty degrees off');
  assert.match(Pf.inWindow(edge, mh, { ...across, heading: 0 }).why, /across/);
  assert.match(Pf.inWindow(edge, mh, { ...across, z: -4 }).why, /closer/);
  assert.match(Pf.inWindow(edge, mh, { ...across, speed: 2 }).why, /slower/);
});

test('saved down only with the tender off it', () => {
  assert.equal(Pf.savedDown(0.4, 1, true), false, 'lowering with her aboard: saved up, carried');
  assert.equal(Pf.savedDown(0.6, 0, true), false, 'raising with her on the chocks: carried');
  assert.equal(Pf.savedDown(1, 1, false), true, 'down, the tender in the water');
  assert.equal(Pf.savedDown(0, 0, false), false);
  const load = (data) => parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 2, hour: 10, ...data } })).state;
  assert.deepEqual(load({ yard: { owned: ['trawler', 'tender'] }, platforms: { trawler: 1 } }).platforms, { trawler: 1 });
  assert.deepEqual(load({ yard: { owned: ['trawler', 'tender'] }, carried: { tender: 'trawler' }, platforms: { trawler: 1 } }).platforms, {}, 'her tender on it: up');
  assert.deepEqual(load({ yard: { owned: [] }, platforms: { trawler: 1, rib: 1 } }).platforms, {});
});

test('on her: the platform goes down as a piece, its floor and her chocks with it, into the water', () => {
  const b = new Boat(new THREE.Scene(), { kind: 'trawler' }), P = b.plan.places;
  const y0 = b.chocksAt()[1], f = (id) => D.floorAt(b.plan, 0, (P.platform[0] + P.platform[1]) / 2, id);
  const floor0 = D.heightOf(f('platform'), 0, -7.5);
  b.setPlatform(1);
  assert.ok(Math.abs(b.platformGroup.position.y + PLATFORM.travel) < 1e-9);
  assert.ok(Math.abs(y0 - b.chocksAt()[1] - PLATFORM.travel) < 1e-9, 'the chocks');
  const floor1 = D.heightOf(f('platform'), 0, -7.5);
  assert.ok(Math.abs(floor0 - floor1 - PLATFORM.travel) < 1e-9, 'where you stand on it');
  assert.ok(floor1 < HULLS.trawler.draft, 'under the water');
  // Walking down the gate to it is still a ramp, never a jump.
  let p = { x: 1.1, z: -5.5, floor: 'aft' }, worst = 0, y = D.heightOf(D.floorAt(b.plan, p.x, p.z, 'aft'), p.x, p.z);
  for (let i = 0; i < 60; i++) {
    p = D.step(b.plan, p, 0, -0.043);
    worst = Math.max(worst, Math.abs(p.y - y));
    y = p.y;
  }
  assert.equal(p.floor, 'platform');
  assert.ok(worst < 0.15, `the biggest step ${worst.toFixed(2)} m`);
  b.setPlatform(0);
  assert.equal(b.platformGroup.position.y, 0);
});
