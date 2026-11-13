// Lights at sea (F2c, see navlights.js): what a boat shows (under way, at anchor, nothing alongside
// or by day, or with her switch off), which light is seen from where (the sidelights' 112.5° arcs,
// the stern light's 135°, the masthead's forward arc, the all-round light), and where they sit on
// real boats: the sidelights on their own sides, above the water, the masthead light over them.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { modeFor, lightsOf, seen, placeOf, NavLights, SIDE_ARC, RED, GREEN, WHITE } = await import('../src/navlights.js');
const { Boat, HULLS, floatDraft } = await import('../src/boat.js');
const { DASHES } = await import('../src/dashboard.js');

test('what she shows: under way or at anchor after dark; nothing by day, alongside, or switched off', () => {
  assert.equal(modeFor({ night: 0.1 }), 'off', 'by day');
  assert.equal(modeFor({ night: 0.9, tied: true }), 'off', 'alongside');
  assert.equal(modeFor({ night: 0.9, lit: false }), 'off', 'her switch off');
  assert.equal(modeFor({ night: 0.9, anchored: true }), 'anchor');
  assert.equal(modeFor({ night: 0.9 }), 'way', 'not anchored, not made fast: under way, stopped or not');
  assert.deepEqual(lightsOf('rib', 'way'), ['port', 'stbd', 'stern', 'mast']);
  assert.deepEqual(lightsOf('sail', 'way', { sailing: true }), ['port', 'stbd', 'stern'], 'under sail, no masthead light');
  assert.deepEqual(lightsOf('row', 'way'), ['all'], 'under oars, a white light all round');
  assert.deepEqual(lightsOf('kayak', 'way'), ['all']);
  assert.deepEqual(lightsOf('cruiser', 'anchor'), ['all']);
  assert.deepEqual(lightsOf('cruiser', 'off'), []);
});

test('which light is seen from where', () => {
  const at = (deg, r = 100) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)]; // [ahead, to starboard]
  const shows = (deg) => ['port', 'stbd', 'stern', 'mast', 'all'].filter((id) => seen(id, ...at(deg)));
  assert.deepEqual(shows(0), ['port', 'stbd', 'mast', 'all'], 'dead ahead: red and green together');
  assert.deepEqual(shows(45), ['stbd', 'mast', 'all'], 'on her starboard bow: green');
  assert.deepEqual(shows(-45), ['port', 'mast', 'all'], 'on her port bow: red');
  assert.deepEqual(shows(110), ['stbd', 'mast', 'all'], 'just inside two points abaft the beam');
  assert.deepEqual(shows(120), ['stern', 'all'], 'on her quarter: the stern light');
  assert.deepEqual(shows(180), ['stern', 'all'], 'dead astern');
  assert.deepEqual(shows(-120), ['stern', 'all']);
  assert.ok(Math.abs(SIDE_ARC - (112.5 * Math.PI) / 180) < 1e-12);
});

test('on real boats: each sidelight on its own side and above the water, the masthead light over them', () => {
  for (const kind of ['cabin', 'cruiser', 'rib', 'console', 'skiff', 'bass', 'sail', 'row']) {
    const b = new Boat(new THREE.Scene(), { kind });
    b.group.updateMatrixWorld(true);
    const H = b.hull, water = floatDraft(b.base);
    const D = DASHES[kind]?.(H)?.lights;
    const port = D ? D.side[0] : placeOf('port', H), stbd = D ? D.side[1] : placeOf('stbd', H), stern = D ? D.stern : placeOf('stern', H);
    assert.ok(port[0] > 0 && stbd[0] < 0, `${kind}: red to port (her +x), green to starboard`);
    assert.ok(port[1] > water && stbd[1] > water && stern[1] > water, `${kind}: above the water`);
    assert.ok(stern[2] < port[2], `${kind}: the stern light aft of the sidelights`);
    assert.ok(Math.abs(port[2]) < H.L / 2 && Math.abs(stern[2]) < H.L / 2 + 0.01, `${kind}: on her`);
    const mast = b.mastLight ? b.mastLight.getWorldPosition(new THREE.Vector3()).y : placeOf('mast', H)[1];
    assert.ok(mast > port[1], `${kind}: the masthead light over the sidelights`);
  }
});

test('the lights drawn: one point each, coloured, only those seen from the eye', () => {
  const scene = new THREE.Scene();
  const L = new NavLights(scene, { dashOf: (b) => DASHES[b.kind]?.(b.hull)?.lights || null });
  const b = new Boat(scene, { kind: 'rib' });
  b.pos.set(0, 0, 0);
  b.heading = 0;
  b.fwd.set(0, 0, 1);
  b.right.set(-1, 0, 0); // (heading 0: ahead is +z, starboard −x)
  b.group.updateMatrixWorld(true);
  const colours = () => [...Array(L.n)].map((_, i) => new THREE.Color(L.col[i * 3], L.col[i * 3 + 1], L.col[i * 3 + 2]).getHex());
  L.begin();
  L.add(b, 'way', new THREE.Vector3(0, 2, 200)); // dead ahead
  assert.deepEqual(colours().sort(), [new THREE.Color(RED).getHex(), new THREE.Color(GREEN).getHex(), new THREE.Color(WHITE).getHex()].sort(), 'red, green and her masthead light');
  L.begin();
  L.add(b, 'way', new THREE.Vector3(-200, 2, 0)); // off her starboard beam
  assert.deepEqual(colours().sort(), [new THREE.Color(GREEN).getHex(), new THREE.Color(WHITE).getHex()].sort(), 'green and the masthead light');
  L.begin();
  L.add(b, 'way', new THREE.Vector3(0, 2, -200)); // astern
  assert.deepEqual(colours(), [new THREE.Color(WHITE).getHex()], 'the stern light alone');
  L.begin();
  L.add(b, 'anchor', new THREE.Vector3(0, 2, -200));
  L.add(b, 'off', new THREE.Vector3(0, 2, 200));
  assert.equal(L.n, 1, 'at anchor, one white light; switched off, nothing');
  // However many ticks a frame takes, or frames a tick, no light is counted twice: the town's
  // added in the tick, then marked; each frame goes back to the mark before yours add theirs.
  L.begin();
  L.add(b, 'anchor', new THREE.Vector3(0, 2, -200)); // (a townsman's, in the tick)
  L.mark();
  for (let frame = 0; frame < 3; frame++) {
    L.rewind();
    L.add(b, 'way', new THREE.Vector3(0, 2, -200)); // (yours, as each frame is drawn)
    assert.equal(L.n, 2, `frame ${frame}`);
  }
  L.begin();
  L.add(b, 'anchor', new THREE.Vector3(0, 2, -200));
  L.end(0.9, 2);
  assert.equal(L.points.visible, true);
  assert.equal(L.points.geometry.drawRange.count, 1);
  L.end(0.1, 1);
  assert.equal(L.points.visible, false, 'by day nothing is drawn');
});
