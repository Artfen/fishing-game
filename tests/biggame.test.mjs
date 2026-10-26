// The big game: the great fish of the open ocean (bigGame.js), trolled for on the big-game rod
// from a moving boat, raised by the wake from far off, fought for a long time (on the yacht from
// the fighting chair) and, the billfish and the sharks, released alongside. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const { seeded } = await import('../src/util.js');
const { fishById } = await import('../src/fish.js');
const { BIG_GAME } = await import('../src/bigGame.js');
const { setupsFor } = await import('../src/guide.js');
const { RODS, TACKLE } = await import('../src/tackle.js');
const { LEVERS, within } = await import('../src/throttle.js');
const { registerFor, MACARONESIA } = await import('../src/register.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { Boat } = await import('../src/boat.js');
const { Fishing } = await import('../src/fishing.js');
const { conditions } = await import('../src/world/conditions.js');
const { depthAt } = await import('../src/world/terrain.js');

const BILLFISH = ['bluemarlin', 'sailfish', 'spearfish'], SHARKS = ['blueshark', 'mako', 'hammerhead'];
const habitat = createHabitat();
const scene = new THREE.Scene();

test('ten big fish of the open ocean, every one trolled for on the big-game rod', () => {
  assert.equal(BIG_GAME.length, 10);
  for (const sp of BIG_GAME) {
    assert.equal(fishById[sp.id], sp);
    assert.ok(sp.life.big, `${sp.id}: big game`);
    assert.ok(registerFor(sp.id) || MACARONESIA[sp.id], `${sp.id}: accounted for`);
    const s = setupsFor(sp)[0];
    assert.equal(s.rod, 'biggame', `${sp.id}: the guide's first choice is the big-game rod (${s.rod})`);
    assert.ok(['skirt', 'ballyhoo'].includes(s.item), `${sp.id}: trolled (${s.item})`);
    // Teeth: a wire trace; the rest, the wind-on leader.
    assert.equal(s.term, sp.life.teeth ? 'wire' : 'windon', `${sp.id}: ${s.term}`);
    // Never a light rod for a big fish.
    assert.ok(setupsFor(sp).every((x) => RODS[x.rod].lines.some((l) => l.kg >= sp.pull * 0.4)), `${sp.id}: a rod that can stand up to it`);
  }
  // The billfish and the sharks go back; the wahoo, the dorado and the albacore make a meal.
  for (const id of [...BILLFISH, ...SHARKS]) {
    assert.ok(!fishById[id].meal && fishById[id].keep, `${id}: released`);
    assert.ok(fishById[id].noSpear, `${id}: never speared`);
  }
  for (const id of ['wahoo', 'dorado', 'albacore']) assert.ok(fishById[id].meal, `${id}: supper`);
  // The fast lure for the fast fish, the slow bait for the sailfish and the sharks.
  assert.equal(setupsFor(fishById.bluemarlin)[0].item, 'skirt');
  assert.equal(setupsFor(fishById.sailfish)[0].item, 'ballyhoo');
  assert.equal(setupsFor(fishById.blueshark)[0].item, 'ballyhoo');
  assert.ok(TACKLE.skirt.size > TACKLE.ballyhoo.size);
});

test('where they live: the billfish only off Las Brasas; the blue shark, mako and albacore in both seas, all in deep blue water', () => {
  Math.random = seeded(5);
  const eco = new Ecosystem(habitat);
  for (const sp of BIG_GAME) {
    const all = eco.bySpecies[sp.id];
    assert.ok(all.length, `${sp.id}: lives somewhere`);
    for (const a of all) assert.ok(depthAt(a.home.x, a.home.z) > 20, `${sp.id}: in deep water`);
    const home = all.filter((a) => !a.home.south).length, south = all.length - home;
    if (['blueshark', 'mako', 'albacore'].includes(sp.id)) assert.ok(home && south, `${sp.id}: ${home} at home, ${south} at Las Brasas`);
    else assert.ok(!home && south, `${sp.id}: only at Las Brasas`);
  }
});

test('the trolling notch: about seven knots with a line out on the yacht and the console; slow ahead on the others', () => {
  for (const kind of ['cruiser', 'console']) {
    const T = LEVERS[kind].find((n) => n.id === 'T');
    assert.ok(T, `${kind}: a trolling notch`);
    assert.equal(within(kind, 1, 'line'), T.v, 'the most with a line out');
    assert.ok(within(kind, 1, 'fight') < T.v, 'and less with a fish on');
    conditions.manual = { speed: 0, from: 0 };
    conditions.wind.speed = conditions.wind.target = 0;
    const b = new Boat(scene, { kind });
    b.place(150, 330, 0);
    for (let i = 0; i < 40 * 30; i++) b.update(1 / 30, i / 30, T.v, 0, 0);
    assert.ok(b.forwardSpeed > 3.1 && b.forwardSpeed < 4.1, `${kind}: ${b.forwardSpeed.toFixed(2)} m/s trolling`);
    conditions.manual = null;
  }
  assert.ok(!LEVERS.skiff.some((n) => n.id === 'T'));
  assert.equal(within('skiff', 1, 'line'), LEVERS.skiff.find((n) => n.id === '2').v);
});

// A lure dragged in a straight line past a fish, at a speed, and who comes to it.
function troll(eco, a, speed, secs = 90) {
  const b = eco.bait;
  // Start 75 m off, heading past it.
  const dir = { x: 1, z: 0 };
  let x = a.x - 60, z = a.z + 45;
  Object.assign(b, { active: true, kind: 'lure', item: 'skirt', size: TACKLE.skirt.size, fly: null, thick: 0.3, fresh: 0, owner: null, held: false, twitch: 0, pause: false, drag: false, fouled: false, natural: false, sinking: false, darted: 0 });
  const ctx = { env: { hour: 11, rain: 0, cloud: 0.2, daylight: 1, night: 0, lanternNear: false, hatch: 0 }, focus: { x, z }, boat: { x, z, speed }, walker: null, lights: [] };
  let met = null;
  eco.listener = { onFollow: (f) => { if (!met) met = f; }, onBite: (f) => { if (!met) met = f; } };
  for (let i = 0; i < secs * 30 && !met; i++) {
    x += dir.x * speed / 30;
    z += dir.z * speed / 30;
    Object.assign(b, { x, y: -0.35, z, vx: dir.x * speed, vz: dir.z * speed, speed, towed: true, motion: speed > 1.15 ? 'fast' : speed > 0.15 ? 'slow' : 'still', nearBottom: false, anglerX: x + 12, anglerZ: z });
    ctx.focus.x = x;
    ctx.focus.z = z;
    eco.update(1 / 30, ctx);
  }
  b.active = false;
  return met;
}

test('a lure trolled behind a boat raises the big game from far off; a slow bait there doesn’t', () => {
  Math.random = seeded(11);
  const eco = new Ecosystem(habitat);
  const marlin = eco.bySpecies.bluemarlin[0];
  const met = troll(eco, marlin, 3.6);
  assert.ok(met?.sp.L?.big || met?.L?.big, `something big came up the wake: ${met?.sp?.id}`);
  Math.random = seeded(11);
  const eco2 = new Ecosystem(habitat);
  const slow = troll(eco2, eco2.bySpecies.bluemarlin[0], 0.6, 40);
  assert.ok(!slow || Math.hypot(slow.x - eco2.bait.x, slow.z - eco2.bait.z) < 45, 'nothing raised from afar by a bait that hardly moves');
});

test('on the yacht a fish on the big-game rod is fought from the fighting chair, swivelling to follow it', () => {
  const y = new Boat(scene, { kind: 'cruiser' });
  y.place(150, 330, 0);
  y.pose.fishing = 1;
  y.pose.rodYaw = Math.PI - 0.5;
  y.pose.chair = true;
  for (let i = 0; i < 90; i++) y.update(1 / 30, i / 30, 0, 0, 0);
  const H = y.hull, [cx, cz, cy] = H.standing.chair;
  assert.ok(y.chairT > 0.95, 'in the chair');
  assert.ok(Math.hypot(y.standAt.x - cx, y.standAt.z - cz) < 0.02, 'sitting at the chair');
  assert.ok(Math.abs(y.standAt.y - (H.floorY + cy + 0.02)) < 0.02, 'seated, not standing');
  assert.ok(Math.abs(y.chair.rotation.y - (Math.PI - 0.5)) < 0.05, 'the chair swung round towards the fish');
  // Swivelling no further than so far either side of aft.
  y.pose.rodYaw = 0.2;
  for (let i = 0; i < 60; i++) y.update(1 / 30, 3 + i / 30, 0, 0, 0);
  assert.ok(Math.abs(y.chair.rotation.y - Math.PI) <= 1.1 + 1e-6);
  // The fight over: back on your feet.
  y.pose.chair = false;
  for (let i = 0; i < 90; i++) y.update(1 / 30, 6 + i / 30, 0, 0, 0);
  assert.ok(y.chairT < 0.05 && Math.abs(y.standAt.y - y.seatY) < 0.02);
  // The centre console has no chair: you fight standing.
  const c = new Boat(scene, { kind: 'console' });
  c.place(150, 330, 0);
  c.pose.fishing = 1;
  c.pose.chair = true;
  for (let i = 0; i < 60; i++) c.update(1 / 30, i / 30, 0, 0, 0);
  assert.equal(c.chairT, 0);
});

test('a big fish landed from a boat lies alongside in the water; a small one is held up', () => {
  const y = new Boat(scene, { kind: 'cruiser' });
  y.place(150, 330, 0);
  y.pose.fishing = 1;
  y.pose.rodYaw = Math.PI;
  for (let i = 0; i < 30; i++) y.update(1 / 30, i / 30, 0, 0, 0);
  const quiet = new Proxy({}, { get: () => () => {} });
  const f = new Fishing(scene, y, quiet, quiet, new Ecosystem(habitat), { flash() {}, key: (a) => a, teach() {}, shake() {}, cue() {}, onCast() {}, castResult() {}, quiet() {}, canopyAt: () => false });
  f.fight = { sp: fishById.bluemarlin, size: 260 };
  const p = f.showPoint(new THREE.Vector3());
  assert.ok(Math.abs(p.y) < 0.3, 'at the surface');
  assert.ok(y.body.worldToLocal(p.clone()).z < -y.hull.L / 2, 'over the stern you face');
  f.fight = { sp: fishById.seabass, size: 50 };
  assert.ok(f.showPoint(new THREE.Vector3()).y > 1, 'a bass held up in your hands');
});
