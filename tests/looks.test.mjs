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
  // A friend's figure (H1a: as they made themselves, all of it): the sun hat as theirs is, the
  // jumper, shirt, beard and glasses with it; no hat shows the hair.
  const fl = L.figureLook({ hat: 'sun', beard: 'short', glasses: 'glasses', jumper: L.LOOK_OPTIONS.jumper[1], shirt: L.LOOK_OPTIONS.shirt[2] });
  assert.equal(fl.hat, 'sun');
  assert.deepEqual([fl.beard, fl.glasses, fl.jumper, fl.shirt], ['short', 'glasses', L.LOOK_OPTIONS.jumper[1], L.LOOK_OPTIONS.shirt[2]]);
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

// (H4b) Outfits: what you wear over it all, the same on every figure and to friends.
test('an outfit: kept and cleaned, as you came if unknown, sent to friends, worn on foot, at the helm and by a friend\'s figure', async () => {
  const { OUTFITS, outfitColours } = await import('../src/body.js');
  const { Figure } = await import('../src/world/folk.js');
  assert.deepEqual(L.LOOK_OPTIONS.outfit, OUTFITS, 'the choices are the ones body.js makes');
  assert.equal(L.cleanLook({}).outfit, 'weather', 'an older save, or a friend from before: as the weather has it');
  assert.equal(L.cleanLook({ outfit: 'tuxedo' }).outfit, 'weather');
  assert.equal(L.cleanLook({ outfit: 'waders' }).outfit, 'waders');
  assert.ok(L.isDefault(L.cleanLook({})) && !L.isDefault(L.cleanLook({ outfit: 'vest' })));
  assert.equal(L.figureLook({ outfit: 'lifejacket' }).outfit, 'lifejacket', 'a friend\'s figure gets it');
  // On foot and at the helm: its pieces on the chest, its colours on the top, the trousers, the boots.
  const look = L.cleanLook({ outfit: 'waders', legs: L.LOOK_OPTIONS.legs[1] });
  for (const F of [new Walker(new THREE.Scene()), new Boat(new THREE.Scene(), { kind: 'skiff' })]) {
    dressFigure(F, look);
    const parts = F.chest.children.filter((o) => o.name === 'outfit:waders');
    assert.ok(parts.length >= 2, 'a bib and braces');
    assert.equal(`#${F.selfMats[4].color.getHexString()}`, outfitColours('waders', look).boots, 'wader boots');
    // Changed: the old pieces off, the new ones on.
    dressFigure(F, { ...look, outfit: 'weather' });
    assert.equal(F.chest.children.filter((o) => o.name.startsWith('outfit:')).length, 0, 'taken off');
  }
  // A friend in a wetsuit: black all over, a stripe in their raincoat's colour.
  const fr = new Figure('sam', L.figureLook({ ...look, outfit: 'wetsuit' }));
  assert.equal(`#${fr.coatMat.color.getHexString()}`, outfitColours('wetsuit', look).top);
  assert.ok(fr.chest.children.some((o) => o.name === 'outfit:wetsuit'));
  // And the look that goes to friends carries it.
  const T = new Together({ config: () => null, name: () => 'Ines', look: () => L.cleanLook({ outfit: 'hoodie' }) });
  assert.equal(T.meta().look.outfit, 'hoodie');
});
