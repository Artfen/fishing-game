// Marine physics C2 (docs/IMPROVEMENTS.md): cargo with a weight and a place (cargo.js; boat.js
// setCargo, cargoFit, slideCargo): bought, put aboard and brought ashore, kept in the save; on
// deck it stays put while it's strapped down and slides when it's loose and the deck tilts or
// the boat lurches past its grip (a cylinder rolling at the least heel), fetching up against her
// side and her console; its weight goes where it goes.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARGO, SOLD, CARGO_MAX, newCargo, cleanCargo, buy, putAboard, bringAshore, aboard, piecesAboard, storePieces, weightOf, slide, G } from '../src/cargo.js';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

test('the catalogue: real weights and sizes, the jerry can the one you have, and no makers’ names', () => {
  for (const [id, C] of Object.entries(CARGO)) {
    assert.ok(C.kg > 0 && C.kg < 40, id);
    assert.ok(C.size.every((v) => v > 0.1 && v < 1), id);
    assert.ok(C.grip.k < C.grip.s, `${id}: slides more easily than it starts`);
    assert.ok(!/®|™/.test(C.name + C.note));
  }
  assert.ok(CARGO.cylinder.grip.roll < 0.1, 'a cylinder rolls');
  assert.ok(CARGO.cylinder.empty < CARGO.cylinder.kg, 'a used cylinder is lighter');
  assert.ok(!SOLD.includes('can'));
  assert.equal(weightOf({ id: 'can' }, 10), CARGO.can.kg + 7.4, 'the can weighs what’s in it');
  assert.equal(weightOf({ id: 'cylinder', full: false }), CARGO.cylinder.empty);
});

test('bought, aboard, ashore and saved: never in two places, never more than she holds, junk dropped', () => {
  const c = newCargo();
  assert.ok(buy(c, 'battery').ok);
  assert.ok(!buy(c, 'battery').ok, 'one battery');
  assert.ok(buy(c, 'cylinder').ok && buy(c, 'cylinder').ok && !buy(c, 'cylinder').ok, 'two cylinders');
  assert.ok(!buy(c, 'can').ok, 'the jerry can isn’t sold: it’s yours already');
  const [bat, cy] = c.items;
  assert.equal(bat.at, 'ashore');
  assert.ok(!putAboard(c, bat.uid, 'rib', null).ok, 'no room, not aboard');
  assert.ok(putAboard(c, bat.uid, 'rib', { x: 0.3, z: -1.5 }).ok);
  assert.ok(putAboard(c, cy.uid, 'rib', { x: -0.3, z: 1 }).ok);
  assert.deepEqual(aboard(c, 'rib').map((i) => i.id), ['battery', 'cylinder']);
  assert.ok(bat.secured, 'strapped down when it’s put aboard');
  // The jerry can aboard: one list for her deck.
  c.can = { x: 0.2, z: -2, secured: false };
  const P = piecesAboard(c, 'rib', 'boat:rib');
  assert.deepEqual(P.map((p) => p.id), ['battery', 'cylinder', 'can']);
  assert.equal(piecesAboard(c, 'rib', 'pack').length, 2);
  // Where they've slid to, back into the save.
  P[0].x = 0.61;
  P[2].secured = true;
  storePieces(c, 'rib', P);
  assert.equal(bat.x, 0.61);
  assert.ok(c.can.secured);
  // Saved and read back; then junk and a boat that isn't there any more.
  const back = cleanCargo(JSON.parse(JSON.stringify(c)), ['rib', 'console']);
  assert.deepEqual(back, c);
  const junk = cleanCargo({ items: [{ uid: 'x1', id: 'anvil', at: 'ashore' }, { uid: 'x2', id: 'case', at: 'boat:spaceship' }, { uid: 'x2', id: 'case', at: 'ashore' }, null, { uid: '<b>', id: 'case' }], can: 'no' }, ['rib']);
  assert.deepEqual(junk.items.map((i) => [i.id, i.at]), [['case', 'ashore']]);
  assert.deepEqual(cleanCargo(undefined), newCargo());
  assert.ok(bringAshore(c, bat.uid).ok && bat.at === 'ashore');
  // (Room for so many on her deck.)
  const d = newCargo();
  for (let i = 0; i < CARGO_MAX + 2; i++) d.items.push({ uid: `c${i + 1}`, id: 'case', at: 'ashore', x: 0, z: 0, secured: true, full: true });
  for (const it of d.items) putAboard(d, it.uid, 'rib', { x: 0, z: 0 });
  assert.equal(aboard(d, 'rib').length, CARGO_MAX);
});

// (A flat deck as wide as you like, to see the sliding alone.)
const open = (pc, x, z) => ({ x, z });
const run = (pc, F, s = 2, fit = open) => {
  let hit = 0;
  for (let i = 0; i < s * 60; i++) hit = Math.max(hit, slide(pc, F, fit, 1 / 60));
  return hit;
};
const heeled = (deg) => ({ x: G * Math.sin((deg * Math.PI) / 180), y: G * Math.cos((deg * Math.PI) / 180), z: 0 });

test('loose on a tilted deck: a box holds till the slope beats its grip, then slides; a cylinder rolls at the least heel; strapped, nothing moves', () => {
  const box = (id) => ({ id, x: 0, z: 0, secured: false });
  const b5 = box('battery');
  run(b5, heeled(5));
  assert.equal(b5.x, 0, 'a battery stays put at 5° of heel');
  const b30 = box('battery');
  run(b30, heeled(30));
  assert.ok(b30.x > 1, `slides at 30° (atan of its grip ${Math.round((Math.atan(CARGO.battery.grip.s) * 180) / Math.PI)}°): ${b30.x.toFixed(2)} m`);
  const cy = box('cylinder');
  run(cy, heeled(5));
  assert.ok(cy.x > 0.5, `a cylinder lying fore-and-aft rolls across at 5°: ${cy.x.toFixed(2)} m`);
  const cyl = box('cylinder');
  run(cyl, { x: 0, y: G * Math.cos(0.087), z: G * Math.sin(0.087) });
  assert.equal(cyl.z, 0, '…but not along its length, at 5° of trim');
  const strapped = { id: 'cylinder', x: 0, z: 0, secured: true };
  run(strapped, heeled(40));
  assert.equal(strapped.x, 0);
  // Her acceleration, not only her heel: braking hard throws a loose box forward; and in the air
  // off a wave (nothing pressing it to the deck), the least push moves it.
  const fwd = box('stores');
  run(fwd, { x: 0, y: G, z: 0.8 * G }, 0.5);
  assert.ok(fwd.z > 0.3, 'thrown forward stopping hard');
  const air = box('stores');
  run(air, { x: 0.3, y: -1, z: 0 }, 0.5);
  assert.ok(air.x > 0.02, 'nothing holds it when it’s in the air');
});

test('it fetches up against her side with a knock (her sides are the limit), and its velocity dies there', () => {
  const pc = { id: 'stores', x: 0, z: 0, secured: false };
  const wall = (p, x, z) => ({ x: Math.min(x, 0.5), z });
  const hit = run(pc, heeled(35), 2, wall);
  assert.equal(pc.x, 0.5);
  assert.ok(hit > 0.5, `a knock (${hit.toFixed(2)} m/s)`);
  assert.ok(Math.abs(pc.vx) < 0.2);
});

test('on the RIB: kept on her floor clear of her console and inside her tubes; loose and heavy, it slides to her low side and heels her further; strapped, it doesn’t', async () => {
  const THREE = await import('three');
  const { Boat, HULLS } = await import('../src/boat.js');
  const scene = new THREE.Scene(), H = HULLS.rib, [hx, hz] = H.standing.helm;
  const b = new Boat(scene, { kind: 'rib' });
  // Where a piece may sit: inside her, clear of her console.
  for (const [x, z] of [[0, hz + 0.6], [5, 0], [-5, 0], [0, 9], [0, -9], [hx + 0.3, hz + 0.7]]) {
    const at = b.cargoFit({ id: 'stores' }, x, z), C = CARGO.stores;
    const inConsole = Math.abs(at.x - hx) < 0.42 + C.size[0] / 2 - 1e-6 && at.z > hz + 0.3 - C.size[2] / 2 + 1e-6 && at.z < hz + 1.15 + C.size[2] / 2 - 1e-6;
    assert.ok(!inConsole, `(${x}, ${z}) → (${at.x.toFixed(2)}, ${at.z.toFixed(2)}): clear of the console`);
    assert.ok(Math.abs(at.z) < H.L / 2 - 0.3 && Math.abs(at.x) < 1, `(${x}, ${z}): on her floor`);
  }
  // Drawn: a mesh for each, straps on what's strapped, gone when it's taken off.
  b.setCargo([{ key: 'c1', id: 'battery', x: 0.2, z: -1.6, secured: true }, { key: 'c2', id: 'cylinder', x: -0.2, z: 1.2, secured: false }]);
  assert.equal(b.cargoGroup.children.length, 2, 'one mesh a piece');
  assert.ok(b.cargo[0].mesh.userData.strapped && !b.cargo[1].mesh.userData.strapped);
  // (The straps drawn: the strapped battery has more to it than a loose one.)
  const withStraps = b.cargo[0].mesh.geometry.attributes.position.count;
  b.strapCargo(b.cargo[0], false);
  assert.ok(b.cargo[0].mesh.geometry.attributes.position.count < withStraps);
  b.strapCargo(b.cargo[0], true);
  const m1 = b.cargo[0].mesh;
  b.setCargo([{ key: 'c1', id: 'battery', x: 0.2, z: -1.6, secured: true }]);
  assert.equal(b.cargoGroup.children.length, 1);
  assert.equal(b.cargo[0].mesh, m1, 'kept, not rebuilt');
  // Afloat, heeled a few degrees by a weight to port (+x): a loose dive cylinder on her centreline
  // (lying fore-and-aft) rolls to port and heels her further; strapped, it stays where it was. (A
  // battery, gripping the deck, would stay put at this heel: see above.)
  const heel = (secured, id = 'cylinder') => {
    const r = new Boat(scene, { kind: 'rib' });
    r.place(300, 900, 0);
    r.cargoAwake = true;
    r.setCargo([{ key: 'b', id, x: 0, z: -0.8, secured }]);
    const loads = () => [{ kg: 220, p: [H.B * 0.85, H.floorY + 0.4, -1.4] }, { kg: CARGO[id].kg, p: r.cargo[0].p }];
    r.setLoads(loads());
    for (let i = 0; i < 600; i++) r.update(1 / 30, i / 30, 0, 0, 0);
    return { x: r.cargo[0].x, roll: (r.roll * 180) / Math.PI };
  };
  const tight = heel(true), loose = heel(false), battery = heel(false, 'battery');
  assert.equal(tight.x, 0, 'strapped: where it was');
  assert.equal(battery.x, 0, `a loose battery holds at ${battery.roll.toFixed(1)}°`);
  assert.ok(loose.x > 0.3, `loose: slid to port, ${loose.x.toFixed(2)} m`);
  assert.ok(Math.abs(loose.roll) > Math.abs(tight.roll) + 0.1, `and she heels further: ${tight.roll.toFixed(2)}° → ${loose.roll.toFixed(2)}°`);
});

test('her pieces don’t pass through each other: a loose one fetches up against another, and one set down is set beside', async () => {
  const THREE = await import('three');
  const { Boat } = await import('../src/boat.js');
  const b = new Boat(new THREE.Scene(), { kind: 'rib' });
  b.setCargo([{ key: 'a', id: 'battery', x: -0.5, z: -1.6, secured: true }, { key: 'b', id: 'cylinder', x: 0.5, z: -1.6, secured: false }]);
  const [bat, cy] = b.cargo, C = CARGO;
  const overlap = (p, q) => Math.abs(p.x - q.x) < (C[p.id].size[0] + C[q.id].size[0]) / 2 - 1e-6 && Math.abs(p.z - q.z) < (C[p.id].size[2] + C[q.id].size[2]) / 2 - 1e-6;
  // Rolling to starboard (−x) across her deck at a good heel: it stops against the battery.
  for (let i = 0; i < 180; i++) slide(cy, heeled(-12), (p, x, z) => b.cargoClear(p, x, z), 1 / 60);
  assert.ok(!overlap(cy, bat), `${cy.x.toFixed(2)} against ${bat.x.toFixed(2)}`);
  assert.ok(cy.x < 0.5, 'it did roll');
  // Set down on top of the battery: put beside it.
  const at = b.cargoClear({ key: 'c', id: 'stores' }, bat.x, bat.z);
  assert.ok(!overlap({ id: 'stores', ...at }, bat));
});

test('set down where her side leaves no room beside another piece: put the other way, clear of it', async () => {
  const THREE = await import('three');
  const { Boat } = await import('../src/boat.js');
  const b = new Boat(new THREE.Scene(), { kind: 'rib' });
  b.setCargo([{ key: 's', id: 'stores', x: 0.6, z: -2.34, secured: true }]);
  const st = b.cargo[0], C = CARGO;
  const at = b.cargoClear({ key: 'c', id: 'cylinder' }, 0.75, -2.38);
  const overlap = Math.abs(at.x - st.x) < (C.cylinder.size[0] + C.stores.size[0]) / 2 - 1e-6 && Math.abs(at.z - st.z) < (C.cylinder.size[2] + C.stores.size[2]) / 2 - 1e-6;
  assert.ok(!overlap, `(${at.x.toFixed(2)}, ${at.z.toFixed(2)}) beside the crate at (${st.x}, ${st.z})`);
});

test('in the save: your cargo and the jerry can aboard a boat kept; aboard one that isn’t a boat, home again', async () => {
  const { sanitize } = await import('../src/save.js');
  const s = sanitize({ day: 4, cargo: { items: [{ uid: 'c1', id: 'cylinder', at: 'boat:rib', x: 0.2, z: -1.5, secured: false, full: false }], can: { x: 0.1, z: -2, secured: true } }, fuel: { can: { at: 'boat:rib', litres: 6 } } });
  assert.deepEqual(s.cargo.items, [{ uid: 'c1', id: 'cylinder', at: 'boat:rib', x: 0.2, z: -1.5, secured: false, full: false }]);
  assert.equal(s.fuel.can.at, 'boat:rib');
  assert.equal(sanitize({ fuel: { can: { at: 'boat:zeppelin', litres: 6 } } }).fuel.can.at, 'home');
  assert.deepEqual(sanitize({}).cargo, newCargo(), 'an older save: nothing aboard, nothing bought');
});
