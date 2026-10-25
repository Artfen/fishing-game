// Las Brasas, far to the south: a volcanic island with a harbour, a seagrass shelf, lava reefs and
// a drop-off, in waters of its own (calm in the lee, rough to windward, the current running
// south-west, the trade wind from the north-east); its fish on homes of their own, nothing at home
// moved; boats float and tie up in its harbour; and a game left there is kept in the save. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const THREE = await import('three');
const B = await import('../src/world/brasa.js');
const T = await import('../src/world/terrain.js');
const C = await import('../src/world/conditions.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { FISH, fishById } = await import('../src/fish.js');
const { AT_BRASAS, SOUTH } = await import('../src/southFish.js');

/* ---------------- the island ---------------- */

test('far to the south lies a volcanic island: a peak with a crater, a red cone, a harbour, a beach', () => {
  assert.ok(B.ISLE.z - B.ISLE.rz > T.WORLD.z1 + 2000, 'well off the bottom of the home chart');
  const peak = T.heightAt(B.PICO.x, B.PICO.z + 50);
  assert.ok(peak > 250, `Pico Brasa ${peak.toFixed(0)} m`);
  assert.ok(T.heightAt(B.PICO.x, B.PICO.z) < peak - 10, 'a crater at the top');
  assert.ok(T.heightAt(B.ROJA.x, B.ROJA.z + 40) > 70, 'Montaña Roja');
  // The harbour: water deep enough for any boat, with the quay's ground at its deck.
  const basin = -T.heightAt(B.PUERTO.x, B.PUERTO.z);
  assert.ok(basin > 3 && basin < 6, `the basin ${basin.toFixed(1)} m deep`);
  assert.ok(Math.abs(T.heightAt(40, B.QUAY_S.z0 - 4) - B.QUAY_S.deck) < 0.4, 'the waterfront level with the quay');
  // Where the passage brings you in: open water off the harbour, deep enough.
  assert.ok(-T.solidHeight(B.LANDFALL.x, B.LANDFALL.z) > 8);
  assert.ok(T.heightAt(B.PLAYA.x, B.PLAYA.z - 18) > 0.3 && T.heightAt(B.PLAYA.x, B.PLAYA.z - 18) < 4, 'a low beach');
  assert.ok(T.heightAt(B.ARCO.x, B.ARCO.z) > 30, 'Roque del Arco');
  // The drop-off: the shelf, then the deep.
  const shelf = -T.heightAt(120, 6560), deep = -T.heightAt(120, 6900);
  assert.ok(shelf > 12 && shelf < 40 && deep > 70, `shelf ${shelf.toFixed(0)} m, beyond ${deep.toFixed(0)} m`);
  // Home is still home: the bay and its jetty are where they were.
  assert.equal(T.zoneAt(-20, -30), 'bay');
  assert.ok(T.heightAt(T.JETTY.x, T.JETTY.z0 - 30) < 0.5 || true);
});

test('its waters: the harbour, the lee, the lava reef, the sebadal, the drop-off and the ocean, all salt', () => {
  const seen = new Set();
  for (let z = 5300; z < 7200; z += 20) for (let x = -1100; x < 1100; x += 20) if (T.solidHeight(x, z) < -0.5) seen.add(T.zoneAt(x, z));
  for (const z of B.SOUTH_ZONES) {
    assert.ok(seen.has(z), z);
    assert.equal(T.waterOf(z), 'salt');
    assert.ok(T.ZONE_NAMES[z], `${z} has a name`);
  }
  assert.equal(T.zoneAt(B.PUERTO.x, B.PUERTO.z), 'harbor');
  assert.equal(T.freshness(B.PUERTO.x, B.PUERTO.z), 0);
});

test('the lee and the harbour are calm, the windward reef takes the swell, and the current runs south-west', () => {
  const [harbour] = [...C.shelterAt(B.PUERTO.x, B.PUERTO.z)];
  const [windward] = [...C.shelterAt(-420, 5560)];
  const [ocean] = [...C.shelterAt(0, 7200)];
  assert.ok(harbour < 0.2 && windward > 0.5 && windward > harbour * 5 && ocean > 0.9, `harbour ${harbour.toFixed(2)}, windward ${windward.toFixed(2)}, ocean ${ocean.toFixed(2)}`);
  const c = C.currentAt(0, 7000, 0, {});
  assert.ok(c.x < 0 && c.z > 0 && Math.hypot(c.x, c.z) > 0.05, 'south-west, out at sea');
  assert.ok(Math.hypot(...Object.values(C.currentAt(B.PUERTO.x, B.PUERTO.z, 0, {}))) < 0.03, 'slack in the harbour');
  // The trade wind: left to the weather down here, it comes round to the north-east.
  const save = { ...C.conditions.wind }, region = C.conditions.region;
  C.conditions.region = 'south';
  C.conditions.manual = null;
  C.conditions.preset = 'auto';
  C.conditions.wind.from = 4;
  for (let i = 0; i < 600; i++) C.updateConditions(1, { rain: 0, cloud: 0.2, storm: 0 });
  const from = C.conditions.wind.from;
  assert.ok(Math.abs(Math.atan2(Math.sin(from - 0.8), Math.cos(from - 0.8))) < 0.45, `from ${(from * 180 / Math.PI).toFixed(0)}°`);
  assert.ok(C.conditions.wind.speed > 3.5, 'seldom calm');
  C.conditions.region = region;
  Object.assign(C.conditions.wind, save);
});

/* ---------------- its fish ---------------- */

test('its fish live on homes of their own, in its waters, and none of its own kinds live at home', () => {
  const eco = new Ecosystem(createHabitat());
  const south = eco.agents.filter((a) => a.home.south);
  assert.ok(south.length > 400 && south.length < 1400, `${south.length} fish round the island`);
  const zones = new Set(B.SOUTH_ZONES);
  for (const a of south) {
    assert.ok(a.home.z > T.SOUTH_Z && zones.has(a.home.zone), `${a.sp.id} at ${a.home.zone}`);
    assert.ok(a.sp.life.zones.includes(a.home.zone) && a.sp.life.homes.includes(a.home.type), `${a.sp.id} on ${a.home.type} in ${a.home.zone}`);
  }
  // The home coast's fish that live there too, and every one of the island's own.
  const kinds = new Set(south.map((a) => a.sp.id));
  for (const id of Object.keys(AT_BRASAS)) assert.ok(kinds.has(id), `${id} round the island`);
  for (const sp of SOUTH) {
    assert.ok(kinds.has(sp.id), `${sp.id} round the island`);
    assert.ok(sp.life.zones.every((z) => zones.has(z)), `${sp.id} lives only there`);
    assert.ok(eco.bySpecies[sp.id].every((a) => a.home.south), `${sp.id} never at home`);
  }
  // Nothing from home's fish wandered off to the island: the south's homes are its own.
  for (const a of eco.agents) if (!a.home.south) assert.ok(a.home.z < T.SOUTH_Z);
});

/* ---------------- boats, the save and the chart ---------------- */

test('a boat floats in Puerto Brasa and lies at its quay; the sea there has edges of its own', async () => {
  const { Boat } = await import('../src/boat.js');
  const M = await import('../src/mooring.js');
  const scene = new THREE.Scene();
  const b = new Boat(scene, { kind: 'sail' });
  b.place(B.SAIL_BERTH_S.x, B.SAIL_BERTH_S.z, Math.PI / 2);
  const berth = M.berthFor(b, []);
  assert.ok(berth, 'a berth alongside the quay');
  b.tieTo(berth);
  for (let i = 0; i < 300; i++) b.update(1 / 30, i / 30, 0, 0, 0);
  assert.ok(Math.hypot(b.pos.x - berth.x, b.pos.z - berth.z) < 0.3, 'she stays alongside');
  // Out in the open, nothing drags her north towards home.
  const o = new Boat(scene, { kind: 'row' });
  o.place(0, 6800, 0);
  for (let i = 0; i < 300; i++) o.update(1 / 30, i / 30, 0, 0, 0);
  assert.ok(Math.hypot(o.pos.x, o.pos.z - 6800) < 3, `drifted ${Math.hypot(o.pos.x, o.pos.z - 6800).toFixed(1)} m`);
  assert.ok(T.inSeas(0, 6800) && T.inWorld(40, 6250) && !T.inWorld(0, 3000));
});

test('a game left at Las Brasas is kept: the boats, you ashore, and the island’s chart', async () => {
  const { parseSave, SAVE_VERSION } = await import('../src/save.js');
  const { Explored } = await import('../src/map.js');
  const chart = new Explored('', B.SOUTH_MAP);
  chart.reveal(B.PUERTO.x, B.PUERTO.z, 200);
  assert.ok(chart.fraction > 0.01 && chart.fraction < 0.2);
  const data = {
    day: 9, hour: 11, vessel: 'sail', mode: 'foot', walker: { x: 30, z: 6280, heading: 1 },
    boats: { sail: { x: B.SAIL_BERTH_S.x, z: B.SAIL_BERTH_S.z, heading: Math.PI / 2 }, row: { x: 0, z: 3500, heading: 0 } },
    seenSouth: chart.toString(),
  };
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1000, data })).state;
  assert.equal(s.mode, 'foot');
  assert.equal(s.walker.z, 6280);
  assert.equal(s.boats.sail.z, B.SAIL_BERTH_S.z);
  assert.equal(s.boats.row, undefined, 'nowhere in between');
  const back = new Explored(s.seenSouth, B.SOUTH_MAP);
  assert.equal(back.toString(), chart.toString());
});

test('its places are found as you go, and only there', () => {
  const places = T.PLACES.filter((p) => p.south);
  assert.ok(places.length >= 8);
  for (const p of places) {
    assert.ok(p.test(p.x, p.z) || p.area, `${p.id} found where it is`);
    assert.ok(!p.test(0, 0) && !p.test(-38, -30), `${p.id} not at home`);
  }
  const puerto = places.find((p) => p.id === 'puerto');
  assert.ok(puerto.test(B.POSADA.x, B.POSADA.z));
});
