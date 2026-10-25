// The Calf and Calf Sound: a small island off Heron Point, reached by boat from Willowhaven. Where
// it is and that you can get there, step ashore and walk it; the race through the Sound; the fish
// that live there (and that the tackle the field guide suggests catches them); how the planner, the
// guide, the adventure and the save know about it. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const T = await import('../src/world/terrain.js');
const { currentAt, TIDE } = await import('../src/world/conditions.js');
const { buildCalf, TOWER_DOOR } = await import('../src/world/calf.js');
const { Walker } = await import('../src/walker.js');
const { Boat, BOAT_KINDS } = await import('../src/boat.js');
const { seeded } = await import('../src/util.js');
const O = await import('../src/outing.js');
const Fu = await import('../src/fuel.js');
const G = await import('../src/firstTrip.js');
const { Adventures, ADVENTURE_BY_ID, KEEPSAKES } = await import('../src/adventures.js');
const { notices } = await import('../src/harbour.js');
const { drawDestMap } = await import('../src/workbench.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { fishWithGuide } = await import('../tools/ecosim.mjs?nomain');

const { CALF, CALF_TOWER, CALF_SKERRY, CALF_SOUND, CALF_LANDING, HAVEN_QUAY, CAR_PARKS, PLACES, PIERS, heightAt, walkHeight, zoneAt } = T;
const LAND = { x: (CALF_LANDING.x0 + CALF_LANDING.x1) / 2, z: (CALF_LANDING.z0 + CALF_LANDING.z1) / 2 };
const MID = { x: (CALF_SOUND.x0 + CALF_SOUND.x1) / 2, z: (CALF_SOUND.z0 + CALF_SOUND.z1) / 2 };

let loads = 0;
const freshSave = () => import(`../src/save.js?calf=${++loads}`);

// Walk a figure from where it stands towards each point in turn, as the stick or keys would.
function walkTo(w, pts, secs = 40) {
  for (const p of pts) {
    for (let i = 0; i < 30 * secs; i++) {
      const dx = p.x - w.pos.x, dz = p.z - w.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.8) break;
      w.update(1 / 30, i / 30, { x: dx / d, z: dz / d });
    }
    if (Math.hypot(p.x - w.pos.x, p.z - w.pos.z) > 1) return false;
  }
  return true;
}

test('the Calf is an island off Heron Point, with Calf Sound deep between them', () => {
  // Land in the middle, a tower on the top, water all the way round.
  assert.ok(heightAt(CALF.x, CALF.z) > 8, 'the top of the Calf stands well clear of the sea');
  assert.ok(heightAt(CALF_TOWER.x, CALF_TOWER.z) > 8, 'the tower is on the top');
  // (Heron Point is just across the Sound to the north: the ring keeps inside it, and skips the skerry.)
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) {
    const x = CALF.x + Math.sin(a) * 34, z = CALF.z + Math.cos(a) * 19;
    if (Math.hypot(x - CALF_SKERRY.x, z - CALF_SKERRY.z) < CALF_SKERRY.r + 4) continue;
    assert.ok(heightAt(x, z) < -0.5, `water round the Calf at ${a.toFixed(2)}`);
  }
  // The skerry: a rock just clear of the water, for the seals.
  const sk = heightAt(CALF_SKERRY.x, CALF_SKERRY.z);
  assert.ok(sk > 0.6 && sk < 3, `the skerry is low (${sk.toFixed(2)} m)`);
  // The Sound: deep enough for every boat along its length, with land on both sides.
  for (let k = 0.15; k <= 0.85; k += 0.05) {
    const x = CALF_SOUND.x0 + (CALF_SOUND.x1 - CALF_SOUND.x0) * k, z = CALF_SOUND.z0 + (CALF_SOUND.z1 - CALF_SOUND.z0) * k;
    assert.ok(heightAt(x, z) < -4, `${(k * 100).toFixed(0)}% along the Sound: ${heightAt(x, z).toFixed(1)} m`);
  }
  let north = false, south = false;
  for (let d = 4; d < 60; d += 1) {
    if (heightAt(MID.x, MID.z + d) > 0.5) north = true;  // (+z: towards the Calf)
    if (heightAt(MID.x, MID.z - d) > 0.5) south = true;  // (−z: Heron Point)
  }
  assert.ok(north && south, 'the Sound runs between the Calf and the Point');
  assert.equal(zoneAt(MID.x, MID.z), 'coast');
  // On the map: the Calf (a landing) and the Sound, each with a note.
  for (const id of ['calf', 'sound']) {
    const P = PLACES.find((p) => p.id === id);
    assert.ok(P && P.note && P.test(P.x, P.z), id);
  }
  assert.ok(PLACES.find((p) => p.id === 'calf').test(LAND.x, LAND.z), 'the landing is on the Calf');
  assert.ok(PLACES.find((p) => p.id === 'sound').test(MID.x, MID.z));
});

test('the landing: deep enough at its end for every boat, and a walk from it to the tower and the Nose', () => {
  assert.ok(PIERS.includes(CALF_LANDING));
  const scene = new THREE.Scene();
  for (const kind of BOAT_KINDS) {
    const b = new Boat(scene, { kind });
    assert.ok(heightAt(CALF_LANDING.end.x + 1, CALF_LANDING.end.z) < -(b.hull.draft + 0.4), `${kind} can come alongside`);
  }
  // From the end of the landing, up the steps to the tower door; and back down round to the Nose.
  for (const target of [TOWER_DOOR, G.FISH_SPOTS.calf]) {
    const w = new Walker(scene);
    w.place(CALF_LANDING.end.x - 0.8, LAND.z, -Math.PI / 2);
    assert.ok(walkTo(w, [{ x: target.x, z: target.z }]), `walked to (${target.x}, ${target.z})`);
  }
  // The way up is never steeper than the figure can climb (with room to spare).
  let steep = 0;
  for (let x = CALF_LANDING.x1; x > CALF.x + 8; x -= 0.25) steep = Math.max(steep, (walkHeight(x - 0.25, LAND.z) - walkHeight(x, LAND.z)) / 0.25);
  assert.ok(steep < 1, `steepest step on the way up: ${steep.toFixed(2)} m a metre`);
});

test('the race runs through the Sound, and the landing lies in slack water', () => {
  const c = currentAt(MID.x, MID.z, 0);
  const speed = Math.hypot(c.x, c.z);
  assert.ok(speed > 0.6, `mid-Sound: ${speed.toFixed(2)} m/s`);
  // On the ebb it runs east, out through the Sound; it would turn with the tide.
  assert.ok(Math.sign(c.x) === Math.sign(TIDE.flow), 'runs the way the tide goes');
  // The fastest water on the coast: faster than anywhere in the bay or round Gannet Isle.
  for (const [x, z] of [[0, -40], [T.GANNET.x + T.GANNET.r * 1.2, T.GANNET.z], [T.SHOAL.x, T.SHOAL.z]]) {
    const o = currentAt(x, z, 0);
    assert.ok(Math.hypot(o.x, o.z) < speed, `slower at (${x}, ${z})`);
  }
  const lee = currentAt(LAND.x + 4, LAND.z, 0);
  assert.ok(Math.hypot(lee.x, lee.z) < 0.12, `slack at the landing: ${Math.hypot(lee.x, lee.z).toFixed(2)} m/s`);
});

test('by boat from Willowhaven quay to the Calf’s landing: open water all the way, about 600 m', () => {
  // A walk over a 3 m grid of the sea, keeping to water deep enough for the deepest hull.
  const scene = new THREE.Scene();
  const deepest = Math.max(...BOAT_KINDS.map((k) => new Boat(scene, { kind: k }).hull.draft));
  const X0 = -600, Z0 = -260, C = 3, NX = 300, NZ = 220;
  const idx = (x, z) => Math.round((z - Z0) / C) * NX + Math.round((x - X0) / C);
  const ok = (i) => {
    const x = X0 + (i % NX) * C, z = Z0 + Math.floor(i / NX) * C;
    return heightAt(x, z) < -(deepest + 0.5);
  };
  const from = idx(HAVEN_QUAY.end.x + 2.4, HAVEN_QUAY.end.z), to = idx(CALF_LANDING.end.x + 1.5, CALF_LANDING.end.z);
  assert.ok(ok(from) && ok(to), 'deep water at both ends');
  const dist = new Float32Array(NX * NZ).fill(Infinity);
  dist[from] = 0;
  const queue = [from];
  while (queue.length) {
    const i = queue.shift();
    if (i === to) break;
    for (const d of [1, -1, NX, -NX]) {
      const j = i + d;
      if (j < 0 || j >= NX * NZ || dist[j] < Infinity || Math.abs((j % NX) - (i % NX)) > 1 || !ok(j)) continue;
      dist[j] = dist[i] + C;
      queue.push(j);
    }
  }
  assert.ok(dist[to] < Infinity, 'a way through');
  // (Grid steps run long on diagonals: the real crossing is shorter.)
  assert.ok(dist[to] > 450 && dist[to] < 1000, `about ${Math.round(dist[to])} m by the grid`);
  // There and back flat out in the motor skiff (at a modest 5 m/s) takes less than the packing
  // list's "enough for the crossing".
  assert.ok(((dist[to] * 2) / 5) * Fu.BOAT_PER_S.skiff < Fu.BOAT_TRIP, `${(((dist[to] * 2) / 5) * Fu.BOAT_PER_S.skiff).toFixed(1)} L`);
});

test('fish of their own: mackerel, garfish and bluefish in the race, pollack and wrasse on the reefs, bass off the Nose', () => {
  const habitat = createHabitat();
  const hosted = habitat.spots.filter((s) => s.hosts?.length && ['race', 'calf', 'nose'].includes(s.tag));
  assert.ok(hosted.some((s) => s.type === 'tide' && s.tag === 'race'));
  assert.ok(hosted.some((s) => s.type === 'reef' && s.tag === 'calf'));
  assert.ok(hosted.some((s) => s.type === 'surf' && s.tag === 'nose'));
  for (const s of hosted) assert.ok(Math.hypot(s.x - CALF.x, s.z - CALF.z) < 60 && s.depth > 1.2, `${s.tag} spot by the Calf, in the water`);
  const eco = new Ecosystem(habitat);
  const near = (id) => eco.bySpecies[id].filter((a) => a.home.hosts && Math.hypot(a.home.x - CALF.x, a.home.z - CALF.z) < 60);
  for (const id of ['mackerel', 'garfish', 'bluefish', 'pollack', 'wrasse', 'seabass']) {
    const list = near(id);
    assert.ok(list.length, `${id} lives at the Calf`);
    // (Each in a home its own rules allow: the right kind of water, in the right zone.)
    for (const a of list) assert.ok(a.L.homes.includes(a.home.type) && a.L.zones.includes(a.home.zone), `${id} in a ${a.home.type}`);
  }
  // Nobody else lives in the Calf's own homes: it never takes fish from anywhere else.
  for (const a of eco.agents) if (a.home.hosts) assert.ok(a.home.hosts.includes(a.sp.id), `${a.sp.id} in a home kept for ${a.home.hosts}`);
  // And the planner sees them there.
  const sp = O.speciesAt(eco, 'calf', Object.fromEntries(['mackerel', 'pollack', 'wrasse', 'garfish', 'bluefish'].map((id) => [id, true])));
  assert.ok(sp.named.some((f) => f.sp.id === 'mackerel') && sp.named.some((f) => f.sp.id === 'pollack'));
  assert.ok(O.habitatsAt(habitat, 'calf').includes('tide'));
});

test('the tackle the field guide suggests catches the Calf’s fish, there (headless ecosystem)', () => {
  const eco = new Ecosystem(createHabitat());
  const at = (id) => eco.bySpecies[id].map((a, i) => [a, i]).filter(([a]) => a.home.hosts && Math.hypot(a.home.x - CALF.x, a.home.z - CALF.z) < 60).map(([, i]) => i);
  const failed = [];
  for (const id of ['mackerel', 'pollack', 'wrasse', 'seabass', 'garfish']) {
    const homes = at(id).slice(0, 2);
    let r = fishWithGuide(eco, id, { homes, tries: 3 });
    // (A wary fish can lose the bait to a quicker neighbour: a second go.)
    if (!r.hits) r = fishWithGuide(eco, id, { homes, tries: 4 });
    if (!r.hits) failed.push(`${id} on ${r.setup.rod}/${r.setup.item}: ${r.results.join(', ')}`);
  }
  assert.deepEqual(failed, []);
});

test('the planner: the Calf is by boat from Willowhaven, and the car only goes as far as the harbour', () => {
  const D = O.DESTS.calf;
  assert.ok(D.boat && D.launch === 'haven' && D.water === 'salt');
  assert.ok(O.DEST_IDS.includes('calf'));
  assert.ok(!O.DRIVE_IDS.includes('calf'), 'not a place the car can go');
  assert.deepEqual(O.DRIVE_IDS, O.DEST_IDS.filter((id) => id !== 'calf'));
  assert.equal(O.parkOf('calf'), CAR_PARKS.haven);
  assert.equal(O.driveMinutes('home', 'calf'), O.driveMinutes('home', 'haven'));
  assert.equal(O.driveMinutes('haven', 'calf'), 0);
  assert.equal(Fu.carNeeds('home', 'calf'), Fu.carNeeds('home', 'haven'));
  // The car is never "at" the Calf, whatever a save says.
  assert.equal(O.cleanCar({ x: 10, z: -90, yaw: 0, at: 'calf' }).at, null);
  assert.equal(O.cleanPlan({ dest: 'calf' }).dest, 'calf');
  // The packing list: the car's fuel to Willowhaven, the boats' for the crossing.
  const f = Fu.defaultFuel();
  const lines = Fu.fuelCheck(f, 'home', 'calf');
  assert.match(lines[0].text, /Willowhaven/);
  assert.match(lines[1].text, /Boat fuel: plenty/);
  f.boats.skiff = 2;
  assert.match(Fu.fuelCheck(f, 'home', 'calf')[1].text, /motor skiff has 2 L.*harbour pump/);
  // Camping out there: the tent can't be in the car (the car waits at the harbour).
  const s = { gear: { pack: { rods: [], items: [] }, rig: {} }, equip: O.defaultEquip(), camps: [], boats: {} };
  s.equip.kit.tent = 'car';
  const warn = O.departureCheck(s, { ...O.defaultPlan(), fish: false, camp: true, dest: 'calf' }).filter((l) => l.level === 'warn').map((l) => l.text);
  assert.ok(warn.some((t) => /tent is in the car, and the car stays at Willowhaven/.test(t)), warn.join(' | '));
  s.equip.kit.tent = 'pack';
  assert.ok(!O.departureCheck(s, { ...O.defaultPlan(), fish: false, camp: true, dest: 'calf' }).some((l) => /car stays/.test(l.text)));
  // Its little map draws: the landing, and the way across from Willowhaven.
  const calls = [];
  const rec = new Proxy({}, { get: (o, k) => (k === 'fillText' ? (t) => calls.push(t) : () => {}), set: () => true });
  drawDestMap(rec, 220, 130, 'calf', { explored: true });
  assert.ok(calls.includes('L') && calls.includes('from Willowhaven'), calls.join(','));
});

test('the guide: drive to Willowhaven, cross to the landing, then on to the Nose', () => {
  const g = G.cleanGuide(null);
  G.start(g);
  G.complete(g, 'plan');
  g.dest = 'calf';
  const keys = (a) => `<kbd>${a.toUpperCase()}</kbd>`;
  const base = { key: keys, touch: false, pad: false, at: 'home', carAt: 'home', driving: false, nearCar: true, plan: { dest: 'calf' }, rig: 'a metal on the coastal rod', kind: 'lure', caught: 0, car: { x: 130, z: -63 }, tent: 'home' };
  const drive = G.words(g, { ...base, driving: true });
  assert.equal(drive.title, 'Drive to Willowhaven');
  assert.equal(drive.target.x, CAR_PARKS.haven.x);
  assert.match(drive.text, /The Calf is by boat from there/);
  G.complete(g, 'drive');
  // At the harbour: have a boat brought round, and the marker on the landing.
  const harbour = G.words(g, { ...base, at: null, carAt: 'haven', here: 'haven' });
  assert.equal(harbour.title, 'Cross to The Calf');
  assert.match(harbour.text, /Have a boat brought round/);
  assert.equal(harbour.target.label, 'The Calf’s landing');
  assert.match(G.words(g, { ...base, at: null, carAt: 'haven', here: null, afloat: true }).text, /just off Heron Point/);
  // Ashore: the Nose, where to stand.
  const ashore = G.words(g, { ...base, at: null, carAt: 'haven', here: 'calf' });
  assert.equal(ashore.target.x, G.FISH_SPOTS.calf.x);
  assert.equal(G.placeAt(CALF_LANDING.end.x, CALF_LANDING.end.z), 'calf');
  assert.equal(G.placeAt(TOWER_DOOR.x, TOWER_DOOR.z), 'calf');
  assert.equal(G.placeAt(CAR_PARKS.haven.x, CAR_PARKS.haven.z), 'haven');
  // Touch and controller words too.
  assert.ok(!/kbd/.test(G.words(g, { ...base, touch: true, at: null, carAt: 'haven', here: 'haven' }).text));
});

test('the watcher on the Calf: a card on the notice board, the seals, and Tam’s slate', () => {
  const state = { day: 3, hour: 9, adventures: {}, keepsakes: {}, unlocks: {}, places: {} };
  const notes = [];
  const adv = new Adventures(state, { note: (title, text) => notes.push(`${title}|${text}`), toast() {}, save() {} });
  assert.ok(notices(adv).some((n) => n.id === 'watch'), 'on the board at Willowhaven');
  const A = ADVENTURE_BY_ID.watch;
  assert.equal(A.reward.keepsake, 'slate');
  assert.ok(KEEPSAKES.slate.name);
  // The world's checks: on foot on the Calf; near the skerry (from the tower, or a boat).
  const ctx = { onFoot: true, player: { x: G.FISH_SPOTS.calf.x, z: G.FISH_SPOTS.calf.z }, boat: { x: 0, z: 0 }, underwater: false, cam: { x: 0, z: 0 }, flocks: [] };
  adv.check(ctx);
  assert.ok(state.adventures.watch.steps.landed);
  assert.ok(!state.adventures.watch.steps.seals, 'the skerry is round the far side from the Nose');
  adv.check({ ...ctx, onFoot: false, player: { x: CALF_SKERRY.x + 20, z: CALF_SKERRY.z } });
  assert.ok(state.adventures.watch.steps.seals);
  // The slate before the clue: remembered; the clue then finishes it, with the keepsake.
  adv.step('watch', 'slate');
  assert.equal(adv.status('watch'), 'unknown');
  adv.clue('watch');
  assert.equal(adv.status('watch'), 'done');
  assert.ok(state.keepsakes.slate);
  assert.ok(notes.some((t) => /already done/.test(t)));
  assert.ok(notes.some((t) => /Kept in your journal: Tam’s slate\./.test(t)), 'a name keeps its capital');
  // Tam's slate shows you the Sound: it's on your map from then on.
  assert.ok(state.places.sound);
  // The tower, its door and the slate, built headless; the door is the spot you use.
  const scene = new THREE.Scene();
  const calf = buildCalf(scene, seeded(1));
  assert.ok(calf.spots.some((s) => s.kind === 'tower' && Math.hypot(s.x - TOWER_DOOR.x, s.z - TOWER_DOOR.z) < 0.01));
  assert.ok(walkHeight(TOWER_DOOR.x, TOWER_DOOR.z) > 8);
  calf.showSlate(false);
  for (let i = 0; i < 60; i++) calf.update(1 / 30, i / 30, { from: { x: CALF_SKERRY.x + 12, z: CALF_SKERRY.z } });
  calf.update(1 / 30, 3, { from: { x: 2000, z: 2000 } });
  assert.equal(calf.group.visible, false, 'nothing drawn from far away');
});

test('the save keeps the Calf: places, the adventure and the slate; an older save loads with the slate still in the tower', async () => {
  globalThis.localStorage = new MemoryStorage();
  const S = await freshSave();
  const s = S.loadGame().state;
  assert.equal(s.adventures.watch, undefined);
  s.places.calf = { day: 2, hour: 10 };
  s.places.sound = { day: 2, hour: 10.2 };
  s.adventures.watch = { clue: { day: 2, hour: 8 }, steps: { landed: { day: 2, hour: 10 }, seals: { day: 2, hour: 10.1 }, slate: { day: 2, hour: 10.3 } }, done: { day: 2, hour: 10.3 } };
  s.keepsakes.slate = { day: 2, hour: 10.3 };
  s.outing.plan.dest = 'calf';
  s.outing.lastDest = 'calf';
  assert.ok(S.saveGame(s));
  const back = (await freshSave()).loadGame().state;
  assert.ok(back.places.calf && back.places.sound);
  assert.ok(back.adventures.watch.steps.slate && back.adventures.watch.done);
  assert.ok(back.keepsakes.slate);
  assert.equal(back.outing.plan.dest, 'calf');
  assert.equal(back.outing.lastDest, 'calf');
  // A save from before the Calf: nothing of it, and nothing else lost.
  const old = JSON.parse(localStorage.getItem(S.SAVE_KEY));
  delete old.data.places.calf;
  delete old.data.places.sound;
  delete old.data.adventures.watch;
  delete old.data.keepsakes.slate;
  old.data.outing.plan.dest = 'haven';
  localStorage.setItem(S.SAVE_KEY, JSON.stringify(old));
  const older = (await freshSave()).loadGame().state;
  assert.equal(older.adventures.watch, undefined, 'the slate is still in the tower');
  assert.equal(older.keepsakes.slate, undefined);
  assert.equal(older.outing.plan.dest, 'haven');
});
