// How you look (src/looks.js; dress.js dressFigure; together.js, world/visitors.js): chosen from
// the lists, kept in the save, worn by your figure on foot and in a boat (colours, hat, beard,
// glasses, the clothes' colours by what you're wearing), and sent to friends with your name, who
// draw you as you made yourself. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const L = await import('../src/looks.js');
const { dressFigure } = await import('../src/dress.js');
const { Walker } = await import('../src/walker.js');
const { Boat } = await import('../src/boat.js');
const { parseSave, envelope } = await import('../src/save.js');
const { Together } = await import('../src/together.js');
const scene = new THREE.Scene();
const hex = (c) => `#${c.getHexString()}`;

test('the choices: a broad range of skin, your clothes’ colours, hats, hair, beards and glasses; nonsense is your default', () => {
  assert.ok(L.LOOK_OPTIONS.skin.length >= 8, 'a broad range of skin tones');
  for (const [k, opts] of Object.entries(L.LOOK_OPTIONS)) assert.ok(opts.includes(L.DEFAULT_LOOK[k]), `${k}: the default is a choice`);
  assert.deepEqual(L.cleanLook(null), L.DEFAULT_LOOK);
  assert.ok(L.isDefault(L.cleanLook({})));
  const odd = L.cleanLook({ skin: 'green', hat: 'crown', beard: 'full', coat: L.LOOK_OPTIONS.coat[2], extra: 1 });
  assert.equal(odd.skin, L.DEFAULT_LOOK.skin);
  assert.equal(odd.hat, 'sun');
  assert.equal(odd.beard, 'full');
  assert.equal(odd.coat, L.LOOK_OPTIONS.coat[2]);
  assert.ok(!('extra' in odd));
  // A friend's figure: the sun hat drawn as a bucket hat; no hat shows the hair.
  assert.equal(L.figureLook({ hat: 'sun' }).hat, 'bucket');
  const bun = L.figureLook({ hat: 'bun', hair: L.LOOK_OPTIONS.hair[3] });
  assert.equal(bun.hatColor, L.LOOK_OPTIONS.hair[3]);
  // Kept in the save.
  const look = L.cleanLook({ skin: L.LOOK_OPTIONS.skin[6], coat: L.LOOK_OPTIONS.coat[3], hat: 'cap', glasses: 'shades' });
  assert.deepEqual(parseSave(JSON.stringify(envelope({ day: 2, look }))).state.look, look);
  assert.deepEqual(parseSave(JSON.stringify(envelope({ day: 2 }))).state.look, L.DEFAULT_LOOK);
});

test('worn by your figure on foot and at the helm: colours, the clothes by what you wear, a hat, a beard, glasses', () => {
  const look = L.cleanLook({ skin: L.LOOK_OPTIONS.skin[5], coat: L.LOOK_OPTIONS.coat[1], jumper: L.LOOK_OPTIONS.jumper[2], legs: L.LOOK_OPTIONS.legs[3], boots: L.LOOK_OPTIONS.boots[2], hat: 'cap', hatColor: L.LOOK_OPTIONS.hatColor[1], hair: L.LOOK_OPTIONS.hair[4], beard: 'full', glasses: 'glasses' });
  for (const F of [new Walker(scene), new Boat(scene, { kind: 'skiff' })]) {
    const parts = F.head.children.length;
    dressFigure(F, look);
    assert.equal(hex(F.selfMats[1].color), look.skin);
    assert.equal(hex(F.selfMats[4].color), look.boots);
    F.dress.set({ coat: true, jumper: false, hat: false });
    assert.equal(hex(F.selfMats[0].color), look.coat, 'the raincoat, on');
    F.dress.set({ coat: false, jumper: true, hat: false });
    assert.equal(hex(F.selfMats[0].color), look.jumper, 'the jumper, coat off');
    assert.equal(hex(F.selfMats[3].color), look.legs);
    // The cap instead of the sun hat (and the woolly hat over it when cold), a beard, glasses.
    assert.equal(F.ownHat.visible, false);
    assert.equal(F.head.children.length, parts + 3, 'a cap, a beard and glasses');
    F.dress.set({ coat: true, jumper: false, hat: true });
    assert.equal(F.dress.sunHat.visible, false, 'the woolly hat on for the cold, the cap off');
    // Back as you came: the sun hat again, nothing extra.
    dressFigure(F, L.DEFAULT_LOOK);
    F.dress.set({ coat: true, jumper: false, hat: false });
    assert.ok(F.ownHat.visible && F.head.children.length === parts);
    assert.equal(hex(F.selfMats[0].color), L.DEFAULT_LOOK.coat);
  }
});

test('sent to friends with your name, and kept as you made it (anything odd made sensible)', () => {
  const look = L.cleanLook({ coat: L.LOOK_OPTIONS.coat[4], hat: 'beanie' });
  const T = new Together({ config: () => null, name: () => 'Mags', look: () => look, WS: null, online: () => false });
  assert.deepEqual(T.meta().look, look);
  const plain = new Together({ config: () => null, name: () => 'Sam', WS: null, online: () => false });
  assert.ok(!('look' in plain.meta()), 'no look chosen: none sent');
  // A friend's look arriving: kept, cleaned.
  const p = { id: 'x', name: '' };
  T.named(p, 'Tess', false, { coat: L.LOOK_OPTIONS.coat[5], hat: 'tiara', skin: 'blue' });
  assert.equal(p.look.coat, L.LOOK_OPTIONS.coat[5]);
  assert.equal(p.look.hat, 'sun');
  assert.equal(p.look.skin, L.DEFAULT_LOOK.skin);
});
