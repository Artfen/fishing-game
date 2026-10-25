// The first trip: the guide's steps (done by what happens, never out of reach), what it says for
// each way of playing, the places it sends you to fish, and how it keeps with the save.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// The home model paints a few canvas textures: a stand-in canvas is enough here.
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const G = await import('../src/firstTrip.js');
const { DESTS, DEST_IDS, DRIVE_IDS, parkOf } = await import('../src/outing.js');
const { CAR_PARKS, PIERS, HOME_START, heightAt, walkHeight } = await import('../src/world/terrain.js');

let loads = 0;
const freshSave = () => import(`../src/save.js?trip=${++loads}`);

test('a guide in a save is made safe, and starts switched off', () => {
  const g = G.cleanGuide({ on: 'yes', done: { plan: 1, bogus: true, cast: 0 }, dest: 'atlantis', since: 'soon', min: 1 });
  assert.equal(g.on, true);
  assert.deepEqual(g.done, { plan: true });
  assert.equal(g.dest, null);
  assert.equal(g.since, 0);
  assert.equal(g.min, true);
  const d = G.cleanGuide(undefined);
  assert.deepEqual(d, { on: false, done: {}, dest: null, offered: false, finished: false, min: false, since: 0 });
});

test('each step done counts the ones before it, and the last one finishes the guide', () => {
  const g = G.cleanGuide(null);
  G.start(g, 1000);
  assert.equal(G.stepOf(g), 'plan');
  assert.equal(g.since, 1000);
  // Skipping the workbench and just driving off is fine.
  assert.equal(G.complete(g, 'drive'), true);
  assert.equal(G.stepOf(g), 'spot');
  assert.ok(g.done.plan);
  assert.equal(G.complete(g, 'drive'), false, 'a step already done changes nothing');
  G.complete(g, 'land');
  assert.equal(G.stepOf(g), 'record');
  assert.equal(G.stepNumber(g), 6);
  G.complete(g, 'back');
  assert.equal(G.stepOf(g), null);
  assert.equal(g.finished, true);
  assert.equal(g.on, false);
  // And again, from the start.
  G.start(g);
  assert.equal(G.stepOf(g), 'plan');
  assert.equal(g.on, true);
});

test('you are at a place when you reach its car park or the water there, and never at home', () => {
  for (const id of DRIVE_IDS) assert.equal(G.placeAt(CAR_PARKS[id].x, CAR_PARKS[id].z), id);
  for (const id of DEST_IDS) assert.equal(G.placeAt(G.FISH_SPOTS[id].x, G.FISH_SPOTS[id].z), id);
  // Home: the drive (a field away from Cove Head's car park), the front door, the workbench.
  for (const [x, z] of [[CAR_PARKS.home.x, CAR_PARKS.home.z], [HOME_START.x, HOME_START.z], [130.9, -79.1], [142.2, -47.4]]) assert.equal(G.placeAt(x, z), null);
});

test('a new game is one with nothing found or caught yet', () => {
  assert.equal(G.isNewGame({ places: {}, log: [], camps: [] }), true);
  assert.equal(G.isNewGame({ places: { bay: { day: 1, hour: 9 } }, log: [], camps: [] }), false);
  assert.equal(G.isNewGame({ places: {}, log: [{ id: 'x' }], camps: [] }), false);
});

test('the guide is kept with the save, and older saves without one load with it off', async () => {
  globalThis.localStorage = new MemoryStorage();
  const S = await freshSave();
  const s = S.loadGame().state;
  assert.equal(s.guide.on, false);
  assert.equal(s.guide.offered, false);
  G.start(s.guide, 5);
  G.complete(s.guide, 'cast');
  s.guide.dest = 'haven';
  assert.ok(S.saveGame(s));
  const back = (await freshSave()).loadGame().state;
  assert.equal(back.guide.on, true);
  assert.equal(G.stepOf(back.guide), 'land');
  assert.equal(back.guide.dest, 'haven');
  // A save from before the guide existed.
  const old = JSON.parse(localStorage.getItem(S.SAVE_KEY));
  delete old.data.guide;
  localStorage.setItem(S.SAVE_KEY, JSON.stringify(old));
  const older = (await freshSave()).loadGame().state;
  assert.deepEqual(older.guide, G.cleanGuide(null));
});

test('every place it sends you to fish is somewhere to stand, with deep water a short cast away', () => {
  for (const id of DEST_IDS) {
    const s = G.FISH_SPOTS[id];
    assert.ok(s, `${id} has a spot`);
    assert.ok(walkHeight(s.x, s.z) > 0.2, `${id}: you can stand at ${s.name}`);
    let deep = false;
    for (let a = 0; a < Math.PI * 2 && !deep; a += Math.PI / 24) {
      for (let r = 5; r <= 16; r += 1) if (heightAt(s.x + Math.sin(a) * r, s.z + Math.cos(a) * r) < -1.2) deep = true;
    }
    assert.ok(deep, `${id}: water over 1.2 m deep within 16 m of ${s.name}`);
    // (A place by boat: a short walk from where you step ashore, not from the car.)
    const from = DESTS[id].boat ? G.LANDINGS[id] : CAR_PARKS[id];
    assert.ok(Math.hypot(s.x - from.x, s.z - from.z) < 60, `${id}: the spot is a short walk from the car park or the landing`);
    if (DESTS[id].boat) assert.equal(parkOf(id), CAR_PARKS[DESTS[id].launch]);
    assert.ok(s.tip, `${id}: a word on where to cast`);
  }
  // And a new game starts on firm ground at home.
  assert.ok(walkHeight(HOME_START.x, HOME_START.z) > 5);
});

test('you can walk onto every pier and quay from the bank (no step too high at its root)', () => {
  for (const p of PIERS) {
    const long = p.x1 - p.x0 > p.z1 - p.z0;
    const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
    const ends = long ? [[p.x0 - 0.3, cz], [p.x1 + 0.3, cz]] : [[cx, p.z0 - 0.3], [cx, p.z1 + 0.3]];
    // The landward end is the one on higher ground (or on another pier it joins, as Puerto Brasa's
    // breakwater arms do).
    const joined = (x, z) => Math.max(-99, ...PIERS.filter((q) => q !== p && x > q.x0 - 0.5 && x < q.x1 + 0.5 && z > q.z0 - 0.5 && z < q.z1 + 0.5).map((q) => q.deck));
    const bank = Math.max(...ends.map(([x, z]) => Math.max(heightAt(x, z), joined(x, z))));
    assert.ok(bank >= p.deck - 0.3, `a ${(p.deck - bank).toFixed(2)} m step up onto the deck at (${cx.toFixed(0)}, ${cz.toFixed(0)})`);
  }
});

// What the game tells the guide (see main.js).
const ctx = (scheme, extra = {}) => ({
  key: scheme === 'pad' ? (a) => `<kbd>${{ interact: 'A', cast: 'RT', cancel: 'B', pack: 'Y', tackle: 'RB', look: 'R-stick', journal: 'D-pad ↑', keep: 'X', advice: 'LB' }[a] || '?'}</kbd>` : (a) => `<kbd>${a.toUpperCase()}</kbd>`,
  touch: scheme === 'touch', pad: scheme === 'pad',
  at: 'home', carAt: 'home', driving: false, nearCar: false, plan: { dest: 'haven' }, rig: 'a worm on the float rod', kind: 'float',
  caught: 0, car: { x: 130, z: -63 }, tent: 'home', ...extra,
});

test('every step says something for keyboard, controller and touch, in that one’s own words', () => {
  const g = G.cleanGuide(null);
  G.start(g);
  for (const id of G.STEP_IDS) {
    for (const scheme of ['keys', 'pad', 'touch']) {
      const w = G.words(g, ctx(scheme, id === 'spot' || id === 'cast' ? { at: null, carAt: 'haven' } : {}));
      assert.equal(w.id, id);
      assert.ok(w.text.length > 40, `${id}/${scheme} says something`);
      if (scheme === 'touch') assert.ok(!/kbd/.test(w.text), `${id}: no keys on a touch screen`);
      if (scheme === 'pad') assert.ok(!/<kbd>\?<\/kbd>/.test(w.text), `${id}: only buttons the controller has`);
      if (scheme === 'keys') assert.ok(!/R-stick|D-pad/.test(w.text), `${id}: no controller words for the keyboard`);
    }
    G.complete(g, id);
    if (id === 'plan') g.dest = 'haven';
  }
  assert.equal(G.words(g, ctx('keys')), null, 'nothing to say once it’s done');
});

test('the guide points the way: the bench, the car, the car park, the water', () => {
  const g = G.cleanGuide(null);
  G.start(g);
  assert.equal(G.words(g, ctx('keys')).target.label, 'Workbench');
  G.complete(g, 'plan');
  g.dest = 'strand';
  const walking = G.words(g, ctx('keys'));
  assert.equal(walking.target.label, 'Car');
  assert.match(walking.title, /Shell Strand/);
  const driving = G.words(g, ctx('keys', { driving: true }));
  assert.equal(driving.target.x, CAR_PARKS.strand.x);
  assert.match(driving.text, /south/);
  G.complete(g, 'drive');
  const spot = G.words(g, ctx('keys', { at: null, carAt: 'strand' }));
  assert.equal(spot.target.x, G.FISH_SPOTS.strand.x);
  assert.match(spot.text, /a worm on the float rod/);
  // A place you can't drive to yourself: the car's "Where to?" takes you.
  const far = G.cleanGuide(null);
  G.start(far);
  G.complete(far, 'plan');
  far.dest = 'quay';
  assert.ok(!DESTS.quay.drive);
  assert.match(G.words(far, ctx('keys')).text, /Where to\?/);
});

test('the last step only offers a camp when the tent is with you', () => {
  const g = G.cleanGuide(null);
  G.start(g);
  G.complete(g, 'record');
  g.dest = 'haven';
  const at = { at: null, carAt: 'haven', caught: 2 };
  assert.match(G.words(g, ctx('keys', { ...at, tent: 'pack' })).text, /pitch a camp.*in your backpack/);
  assert.match(G.words(g, ctx('keys', { ...at, tent: 'car' })).text, /in the boot/);
  const home = G.words(g, ctx('keys', { ...at, tent: 'home' })).text;
  assert.ok(!/pitch a camp/.test(home));
  assert.match(home, /2 fish in your journal/);
});
