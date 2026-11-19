// The north (N1 of docs/NORTH.md): the way up the coast to the Selkie Isles, as a region of the
// world: its land joined to home's without a seam and nothing at home moved, the route deep enough,
// the isles and the loch where they should be, its zones, its sea's field, the boats' edge, saves,
// the places, and the tiles it's drawn in.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const T = await import('../src/world/terrain.js');
const N = await import('../src/world/north.js');
const { heightAt, landSDF, zoneAt, inSeas, inWorld, PLACES, SOUTH_Z } = T;

test('which sea: home, the north up the coast to the west, and Las Brasas far to the south', () => {
  assert.equal(N.regionOf(0, 0, SOUTH_Z), 'home');
  assert.equal(N.regionOf(-600, 500, SOUTH_Z), 'home', 'off the Calf: still home');
  assert.equal(N.regionOf(-1000, 500, SOUTH_Z), 'north', 'west along the south coast: the north');
  assert.equal(N.regionOf(-3000, -6000, SOUTH_Z), 'north');
  assert.equal(N.regionOf(-1040, -1500, SOUTH_Z), 'home', 'Hoarfell is home');
  assert.equal(N.regionOf(0, 6000, SOUTH_Z), 'south');
  for (const [x, z] of [[-1500, 600], [-2500, -1000], [-2600, -6170], [-1500, -5640]]) {
    assert.ok(inSeas(x, z) && inWorld(x, z), `(${x}, ${z}) inside the world`);
  }
});

test('nothing at home moved: its land, sea and zones are as they were before the north', () => {
  // (A fingerprint over everything home draws, taken before the north was added.)
  let h = 2166136261;
  const mix = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  for (let z = -2190; z < 1800; z += 37) for (let x = -1790; x < 1500; x += 37) mix(`${heightAt(x, z).toFixed(3)},${landSDF(x, z).toFixed(2)},${zoneAt(x, z)};`);
  assert.equal(h, 1683162388);
});

test('no seam where the north meets home: the ground continuous across both edges', () => {
  let worst = 0;
  for (let z = -2190; z <= 1390; z += 10) worst = Math.max(worst, Math.abs(heightAt(-1799.9, z) - heightAt(-1800.1, z)));
  for (let x = -1795; x <= -365; x += 10) worst = Math.max(worst, Math.abs(heightAt(x, -2199.9) - heightAt(x, -2200.1)));
  assert.ok(worst < 0.5, `worst step ${worst.toFixed(2)} m`);
  // And the coast in the same place either side: land stays land, sea stays sea.
  for (let z = -2190; z <= 1390; z += 10) assert.equal(landSDF(-1799.9, z) < 0, landSDF(-1800.1, z) < 0, `the coast at z ${z}`);
});

test('the way north: out of the bay, west past the Calf, round the Ness and up the coast to the isles, in deep water', () => {
  const route = [[0, 300], [-480, 330], [-1500, 620], [-2450, 700], [-2550, -1000], [-2500, -3000], [-2500, -4700], [-2560, -5500], [-2600, -6170]];
  let len = 0, shallow = Infinity, past = Infinity;
  for (let k = 0; k < route.length - 1; k++) {
    const [ax, az] = route[k], [bx, bz] = route[k + 1], L = Math.hypot(bx - ax, bz - az);
    len += L;
    for (let s = 0; s <= L; s += 10) {
      const x = ax + ((bx - ax) * s) / L, z = az + ((bz - az) * s) / L, d = -heightAt(x, z);
      shallow = Math.min(shallow, d);
      if (k > 0) past = Math.min(past, d);
    }
  }
  assert.ok(len > 8500 && len < 10500, `about nine kilometres (${(len / 1000).toFixed(1)})`);
  assert.ok(shallow > 5, `water all the way (${shallow.toFixed(1)} m at the shallowest)`);
  assert.ok(past > 12, `past the Calf, deep water (${past.toFixed(1)} m)`);
  // The Ness stands out from the coast at the mainland's corner.
  assert.ok(heightAt(-2250, 250) > 20, 'the Ness, high');
  assert.ok(heightAt(-2600, 250) < -15, 'the sea west of it');
  // The west coast: sea to the west of it, the fells behind.
  // (Low coast at first, then rising into the fells as it runs north.)
  for (const [z, high] of [[-1000, 5], [-3000, 30], [-4500, 30]]) {
    assert.ok(heightAt(N.westX(z) - 300, z) < -15, `sea off the coast at z ${z}`);
    assert.ok(heightAt(N.westX(z) + 400, z) > high, `land behind it at z ${z}`);
  }
});

test('the isles and the loch where they should be', () => {
  const { RAVEN, TERN, SKARV, SELKIE, BOTHY_BAY, LOCH_SILL } = N;
  assert.ok(heightAt(RAVEN.x, RAVEN.z) > 100, 'Raven Isle high');
  // (Its cliffs on the weather side: high close in from its west shore, a long slope on its east.)
  const westShore = RAVEN.x - RAVEN.rx, eastShore = RAVEN.x + RAVEN.rx;
  assert.ok(heightAt(westShore + 40, RAVEN.z) > heightAt(eastShore - 40, RAVEN.z) + 10, 'cliffs to the west');
  assert.ok(heightAt(TERN.x, TERN.z) > 4 && heightAt(TERN.x, TERN.z) < 20, 'Tern Isle low');
  assert.ok(heightAt(SKARV.x, SKARV.z) > 50 && heightAt(SKARV.x + SKARV.r + 25, SKARV.z) < 0, 'Skarv Stack sheer in the sea');
  for (const R of SELKIE.slice(0, 3)) assert.ok(heightAt(R.x, R.z) > 0.5, 'a Selkie rock above the water');
  // Loch Skarn: deep inside, over a sill at its mouth; Bothy Bay shallow enough to anchor.
  assert.ok(heightAt(-1500, -5600) < -60, 'the loch deep');
  assert.ok(heightAt(LOCH_SILL.x, LOCH_SILL.z) > -22 && heightAt(LOCH_SILL.x, LOCH_SILL.z) < -8, 'its sill');
  const bay = -heightAt(BOTHY_BAY.x, BOTHY_BAY.z);
  assert.ok(bay > 4 && bay < 12, `Bothy Bay ${bay.toFixed(1)} m`);
  // Raven Sound fifteen to thirty metres; the Churn shallower over its sill.
  const sound = -heightAt(-2500, -6250);
  assert.ok(sound > 14 && sound < 32, `the sound ${sound.toFixed(1)} m`);
  assert.ok(-heightAt(N.CHURN.x - 200, N.CHURN.z + 30) < 15, 'the Churn over its sill');
});

test('the north\'s waters: kelp, the sound, the race, the loch, the skerries and the open Atlantic', () => {
  assert.equal(zoneAt(-1500, -5600), 'loch');
  assert.equal(zoneAt(N.BOTHY_BAY.x, N.BOTHY_BAY.z), 'loch');
  assert.equal(zoneAt(-2500, -6250), 'sound');
  assert.equal(zoneAt(N.CHURN.x - 200, N.CHURN.z + 30), 'race');
  assert.equal(zoneAt(-3045, -4920), 'skerry');
  assert.equal(zoneAt(-2600, -3000), 'outer');
  // Close in under a rocky shore, in the shallows: the kelp.
  let kelp = 0;
  for (let x = N.westX(-3000) - 10; x > N.westX(-3000) - 90; x -= 4) if (zoneAt(x, -3000) === 'kelp') kelp++;
  assert.ok(kelp > 0, 'kelp along the west coast');
  for (const z of N.NORTH_ZONES) assert.ok(T.SALT_ZONES.includes(z) && T.ZONE_NAMES[z], z);
});

test('its sea: the Atlantic\'s swell outside, the sound sheltered, the loch still; the tide hard over the Churn', async () => {
  const C = await import('../src/world/conditions.js');
  const outside = C.shelterAt(-3000, -3000)[0], sound = C.shelterAt(-2500, -6250)[0], loch = C.shelterAt(-1500, -5600)[0];
  assert.ok(outside > 0.8, `outside ${outside.toFixed(2)}`);
  assert.ok(sound < 0.6 && sound > loch, `the sound ${sound.toFixed(2)}`);
  assert.ok(loch < 0.15, `the loch ${loch.toFixed(2)}`);
  const flow = C.TIDE.flow;
  C.TIDE.flow = 1;
  const race = Math.hypot(...Object.values(C.currentFast(N.CHURN.x - 200, N.CHURN.z + 30)));
  const still = Math.hypot(...Object.values(C.currentFast(-1500, -5600)));
  C.TIDE.flow = flow;
  assert.ok(race > 0.5, `the Churn running ${race.toFixed(2)} m/s`);
  assert.ok(still < 0.05, `the loch still (${still.toFixed(2)})`);
});

test('a boat can go west past the Calf and on up the coast, and is turned back only at the north\'s own edge', async () => {
  const { edgePush } = await import('../src/boat.js');
  const push = (x, z) => { const e = edgePush({ x, z }); return Math.hypot(e.x, e.z); };
  assert.equal(push(-860, 500), 0, 'west of home\'s sea, on into the north');
  assert.equal(push(-1500, 600), 0);
  assert.equal(push(-2600, -6170), 0, 'in the sound');
  assert.ok(push(N.NORTH_RECT.x0 + 20, -5000) > 0, 'the north\'s own west edge');
  assert.ok(push(-3000, N.NORTH_RECT.z0 + 20) > 0, 'and its north edge');
  // Home's sea's own edges are as they were.
  assert.ok(push(1080, 500) > 0, 'home\'s east edge');
});

test('a save keeps a boat, a walker and a log in the north', async () => {
  const { sanitize, DEFAULT_STATE } = await import('../src/save.js');
  const raw = structuredClone(DEFAULT_STATE);
  raw.boats = { ...raw.boats, skiff: { x: -2600, z: -6170, heading: 1 } };
  raw.walker = { x: -3760, z: -5260, heading: 0 };
  raw.seenNorth = 'AAAA';
  const s = sanitize(raw);
  assert.deepEqual([s.boats.skiff?.x, s.boats.skiff?.z], [-2600, -6170]);
  assert.deepEqual([s.walker?.x, s.walker?.z], [-3760, -5260]);
  assert.equal(s.seenNorth, 'AAAA');
  // The isles' chart, explored all over, still fits the save.
  const { Explored } = await import('../src/map.js');
  const E = new Explored('', N.ISLES_MAP);
  E.bits.fill(255);
  assert.ok(E.toString().length <= 6000, `${E.toString().length} characters`);
});

test('its places, each found only there', () => {
  const ids = N.NORTH_PLACES.map((p) => p.id);
  for (const id of ids) {
    const p = PLACES.find((q) => q.id === id);
    assert.ok(p, id);
    assert.ok(p.test(p.x, p.z), `${id} found at its place`);
    assert.ok(!p.test(0, 0) && !p.test(0, 6000) && !p.test(-1040, -1500), `${id} not found elsewhere`);
  }
  assert.equal(new Set(PLACES.map((p) => p.id)).size, PLACES.length, 'every place its own id');
});

test('drawn in tiles on the coarse sheet\'s grid, covering the north and nothing home draws', async () => {
  const { NORTH_TILES } = await import('../src/world/world.js');
  const FAR = { x0: -1800, x1: 1500, z0: -2200, z1: 1800 };
  for (const R of NORTH_TILES) {
    for (const v of [R.x0, R.x1, R.z0, R.z1]) assert.equal(Math.abs(v % 20), 0, 'on the 20 m grid');
    assert.ok(!(R.x0 < FAR.x1 && R.x1 > FAR.x0 && R.z0 < FAR.z1 && R.z1 > FAR.z0), 'clear of home\'s sheet');
  }
  for (let i = 0; i < NORTH_TILES.length; i++) for (let j = i + 1; j < NORTH_TILES.length; j++) {
    const A = NORTH_TILES[i], B = NORTH_TILES[j];
    assert.ok(!(A.x0 < B.x1 && A.x1 > B.x0 && A.z0 < B.z1 && A.z1 > B.z0), 'no two overlap');
  }
  const covered = (x, z) => NORTH_TILES.some((R) => x >= R.x0 && x <= R.x1 && z >= R.z0 && z <= R.z1);
  for (const [x, z] of [[-2250, 250], [-2600, -6170], [-1500, -5640], [-720, -5860], [-4500, -7800], [-1000, -3000]]) assert.ok(covered(x, z), `(${x}, ${z}) drawn`);
});

// N2: the isles in detail.
test('the isles in detail: patches on the grid, over the isles, on the north\'s tiles', async () => {
  const { TERRAIN_PATCHES, NORTH_TILES } = await import('../src/world/world.js');
  const ids = ['ness', 'raven-s', 'raven-n', 'tern', 'selkie', 'skarv', 'bothybay'];
  for (const id of ids) {
    const P = TERRAIN_PATCHES.find((p) => p.id === id);
    assert.ok(P?.later, `${id}, built when you come near`);
    for (const v of [P.x0, P.x1, P.z0, P.z1]) assert.equal(Math.abs(v % 20), 0, `${id} on the grid`);
    assert.equal(Math.abs((20 / P.cell) % 1), 0, `${id}'s cell divides the coarse one`);
    assert.ok(NORTH_TILES.some((R) => P.x0 >= R.x0 && P.x0 < R.x1 && P.z0 >= R.z0 && P.z0 < R.z1), `${id} on the north's tiles`);
  }
  const has = (x, z) => TERRAIN_PATCHES.some((P) => x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1);
  for (const [x, z] of [[N.RAVEN.x, N.RAVEN.z], [N.TERN.x, N.TERN.z], [N.SKARV.x, N.SKARV.z], [N.BOTHY_BAY.x, N.BOTHY_BAY.z], [N.CHURN.x - 200, N.CHURN.z + 30], [-2250, 250]]) assert.ok(has(x, z), `(${x}, ${z}) in detail`);
});

test('under the water: kelp on the rock round the isles, sand in the sound and off Tern Isle, mud in the loch', async () => {
  const { createHabitat } = await import('../src/world/habitat.js');
  const H = createHabitat(), s = {};
  // Along Raven Isle's east shore, in the shallows: kelp on rock.
  let kelp = 0;
  for (let z = -6600; z < -5900; z += 20) {
    for (let x = -2900; x < -2700; x += 10) {
      H.sample(x, z, s);
      if (s.depth > 3 && s.depth < 12 && s.weed > 0.3 && s.rock > 0.4) kelp++;
    }
  }
  assert.ok(kelp > 10, `kelp along Raven Isle (${kelp})`);
  assert.equal(H.sample(-2500, -6250, s).rock, 0, 'the sound\'s floor sand');
  assert.ok(H.sample(-1500, -5600, s).mud > 0.8, 'the loch\'s basin mud');
  assert.ok(H.sample(-2820, -6990, s).rock > 0.8 || H.sample(-2760, -7000, s).rock > 0.8, 'the Churn rock');
  for (const B of N.NORTH_BEDS) assert.ok(B.x >= N.NORTH_RECT.x0 && B.x + B.w <= N.NORTH_RECT.x1 && B.z >= N.NORTH_RECT.z0 && B.z + B.h <= N.NORTH_RECT.z1, 'its kelp beds in the north');
});

test('on the isles: boulders on the shores, heather on the slopes, rowans in the loch\'s glens, marram on Tern Isle', async () => {
  const THREE = await import('three');
  const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
  const { buildNorth, NORTH_AREAS } = await import('../src/world/northWorld.js');
  const { seeded } = await import('../src/util.js');
  const W = buildNorth(new THREE.Scene(), seeded(20261118));
  const meshes = W.group.children.filter((o) => o.isInstancedMesh);
  // (One set to each area, so an area out of view is left out.)
  for (const A of NORTH_AREAS) {
    const here = meshes.filter((m) => m.count && m.boundingSphere.center.x > A.x0 - 50 && m.boundingSphere.center.x < A.x1 + 50 && m.boundingSphere.center.z > A.z0 - 50 && m.boundingSphere.center.z < A.z1 + 50);
    assert.ok(here.length >= 1, `${A.id}'s things`);
    for (const m of here) assert.ok(m.boundingSphere.radius < 1400, `${A.id}'s drawn as its own`);
  }
  const rowans = W.obstacles.filter((o) => o.name === 'a rowan');
  assert.ok(rowans.length > 20, 'rowans');
  for (const r of rowans) assert.ok(heightAt(r.x, r.z) > 2 && N.lochAt(r.x, r.z).d < 270, 'a rowan in the loch\'s glens, on land');
  const total = meshes.reduce((n, m) => n + m.count, 0);
  assert.ok(total > 3000 && total < 12000, `${total} things in all`);
});

// N3: Halvig and the things to find.
test('Halvig: a stone pier with water enough alongside, the fuel pump at its root, the shop and crofts on level ground', () => {
  const { PIERS, FUEL_PUMPS } = T;
  const Q = N.HALVIG_PIER;
  assert.equal(PIERS[PIERS.length - 1], Q, 'its pier walkable, last so the others keep their places');
  assert.ok(-heightAt(Q.x1 - 2, (Q.z0 + Q.z1) / 2) > 7, 'seven metres and more at its head');
  assert.ok(Math.abs(heightAt(Q.x0 + 1, (Q.z0 + Q.z1) / 2) - Q.deck) < 0.6, 'its root at the shelf');
  assert.equal(FUEL_PUMPS.halvig, N.HALVIG_FUEL);
  for (const B of [N.HALVIG_SHOP, ...N.CROFTS, N.PHONE_BOX, N.HALVIG_FUEL]) assert.ok(Math.abs(heightAt(B.x, B.z) - N.HALVIG_SHELF.level) < 0.2, 'on the shelf');
  for (const B of [N.HALVIG_SHOP, ...N.CROFTS]) {
    const c = Math.cos(B.yaw), s = Math.sin(B.yaw);
    for (const [u, v] of [[-B.w / 2, -B.d / 2], [B.w / 2, -B.d / 2], [-B.w / 2, B.d / 2], [B.w / 2, B.d / 2]]) {
      assert.ok(Math.abs(heightAt(B.x + u * c + v * s, B.z - u * s + v * c) - N.HALVIG_SHELF.level) < 0.3, 'level under every corner');
    }
  }
});

test('the north\'s dives: the Sula in the kelp and the foot of Skarv Stack, at their depths, with fish of their own, and nothing else moved', async () => {
  const D = await import('../src/world/divesites.js');
  assert.deepEqual(D.NORTH_SITES.map((S) => S.id), ['sula', 'skarv']);
  assert.equal(D.HOME_SITES.length, 5, 'home\'s five as they were');
  const sula = -heightAt(N.SULA.x, N.SULA.z), foot = -heightAt(N.SKARV.x + N.SKARV.r + 40, N.SKARV.z);
  assert.ok(sula > 10 && sula < 18, `the Sula ${sula.toFixed(1)} m down`);
  assert.ok(foot > 28, `the stack's foot ${foot.toFixed(1)} m`);
  const { Ecosystem } = await import('../src/world/ecosystem.js');
  const { createHabitat } = await import('../src/world/habitat.js');
  const eco = new Ecosystem(createHabitat());
  for (const S of D.NORTH_SITES) {
    const own = eco.agents.filter((a) => a.home.site === S.id);
    assert.ok(own.length >= 10 && new Set(own.map((a) => a.sp.id)).size >= 3, `${S.id}: ${own.length}`);
  }
  assert.ok(eco.agents.filter((a) => a.home.site === 'sula').some((a) => a.sp.id === 'conger'), 'a conger in the Sula');
  // Every other fish where it was before the north had any (a fingerprint taken then).
  let h = 2166136261;
  const mix = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  const rest = eco.agents.filter((a) => !a.home.north);
  for (const a of rest) mix(`${a.sp.id},${a.x.toFixed(2)},${a.z.toFixed(2)},${a.y.toFixed(2)};`);
  assert.deepEqual([rest.length, h], [5031, 409352983]);
  // And the board's challenge for them.
  const { CHALLENGES } = await import('../src/daybook.js');
  const C = CHALLENGES.find((c) => c.id === 'northdives');
  assert.deepEqual(C.check({ dive: { sites: { sula: { dives: 1 } } } }), { n: 1, of: 2 });
});

test('what\'s built: the light flashing after dark, Halvig\'s houses solid, the broch, the stones, the bothy, the herring station, the Sula on the bottom', async () => {
  const THREE = await import('three');
  const { buildNorth } = await import('../src/world/northWorld.js');
  const { seeded } = await import('../src/util.js');
  const W = buildNorth(new THREE.Scene(), seeded(20261118));
  const lamp = W.group.children.find((o) => o.isMesh && o.geometry.type === 'SphereGeometry');
  assert.ok(Math.hypot(lamp.position.x - N.RAVEN_LIGHT.x, lamp.position.z - N.RAVEN_LIGHT.z) < 1 && lamp.position.y > 60, 'the lamp high on Raven Head');
  const seen = [];
  for (let t = 0; t < 15; t += 0.1) {
    W.update(0.1, t, { lantern: 1 });
    seen.push(lamp.material.opacity > 0.6 ? 1 : 0);
  }
  const flashes = seen.filter((v, i) => v && !seen[i - 1]).length;
  assert.equal(flashes, 3, 'three flashes every fifteen seconds');
  W.update(0.1, 0.1, { lantern: 0 });
  assert.ok(lamp.material.opacity < 0.5, 'only a glimmer by day');
  const names = new Set(W.obstacles.map((o) => o.name));
  for (const n of ['Halvig Stores', 'a croft', 'the fuel pump', 'the phone box', 'the lighthouse', 'the broch', 'a standing stone', 'the bothy', 'the herring station']) assert.ok(names.has(n), n);
  // The Sula's iron, under the water at her place.
  let iron = 0;
  W.group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    if (b.min.x < N.SULA.x + 5 && b.max.x > N.SULA.x - 5 && b.min.z < N.SULA.z + 5 && b.max.z > N.SULA.z - 5 && b.min.y < -8) iron++;
  });
  assert.ok(iron >= 1, 'her hull on the bottom');
});

// N4: life in the north.
test('the north\'s own fish: cod, saithe, ling, haddock and the flapper skate, each modelled, named, priced, and living only up the coast', async () => {
  const { FISH, fishById } = await import('../src/fish.js');
  const { hasAnatomy } = await import('../src/anatomy.js');
  const { PRICES } = await import('../src/market.js');
  const Tx = await import('../src/taxonomy.js');
  const ids = ['cod', 'saithe', 'ling', 'haddock', 'skate'];
  for (const id of ids) {
    const f = fishById[id];
    assert.ok(f && FISH.indexOf(f) >= FISH.length - ids.length, `${id}, after every other fish`);
    assert.ok(hasAnatomy(id), `${id}: a body`);
    assert.ok(id in PRICES, `${id}: a price`);
    assert.ok(f.life.zones.every((z) => N.NORTH_ZONES.includes(z)), `${id}: the north's waters only`);
    const e = Tx.species().find((x) => x.key === `fish:${id}`);
    assert.ok(e?.sci && e.family, `${id}: in the tree`);
  }
  assert.equal(PRICES.skate, 0, 'nobody buys the protected skate');
  const at = (k) => Tx.species().find((x) => x.key === `fish:${k}`);
  assert.deepEqual([at('cod').sci, at('cod').family, at('ling').family, at('skate').order, at('skate').iucn], ['Gadus morhua', 'Gadidae', 'Lotidae', 'rajiformes', 'CR']);
});

test('life in the north: its own fish and the home coast\'s cold-water ones on its homes, and every other fish where it was', async () => {
  const { Ecosystem } = await import('../src/world/ecosystem.js');
  const { createHabitat } = await import('../src/world/habitat.js');
  const eco = new Ecosystem(createHabitat());
  const north = eco.agents.filter((a) => a.home.north && !a.home.site);
  const count = (id) => north.filter((a) => a.sp.id === id).length;
  for (const id of ['cod', 'saithe', 'ling', 'haddock', 'skate', 'pollack', 'wrasse', 'mackerel']) assert.ok(count(id) > 0, `${id} in the north (${count(id)})`);
  for (const a of north) assert.ok(N.inNorth(a.home.x, a.home.z) && a.sp.life.zones.includes(a.home.zone), `${a.sp.id} at home in the north`);
  // The skate on the loch's mud, deep; the haddock on the sand; the saithe in shoals in the race and along the cliffs.
  for (const a of north.filter((x) => x.sp.id === 'skate')) assert.ok(a.home.zone === 'loch' && a.home.depth > 40, 'the skate deep in the loch');
  // No north-only fish anywhere else.
  for (const a of eco.agents) if (['cod', 'saithe', 'ling', 'haddock', 'skate'].includes(a.sp.id)) assert.ok(a.home.north, `${a.sp.id} only in the north`);
  let h = 2166136261;
  const mix = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  const rest = eco.agents.filter((a) => !a.home.north);
  for (const a of rest) mix(`${a.sp.id},${a.x.toFixed(2)},${a.z.toFixed(2)},${a.y.toFixed(2)};`);
  assert.deepEqual([rest.length, h], [5031, 409352983]);
});

test('its sea colder, its seals on the Selkie Rocks, its minke whale and dolphins, its seabirds on Skarv Stack', async () => {
  const { seaTemp } = await import('../src/world/seatemp.js');
  for (const abs of [0, 24 * 90, 24 * 180, 24 * 270]) {
    const home = seaTemp({ abs, zone: 'coast' }), north = seaTemp({ abs, zone: 'sound' });
    assert.ok(north < home - 2 && north > 6 && north < 14.5, `the north colder (${north} against ${home})`);
  }
  const THREE = await import('three');
  const { buildSeaLife, PODS } = await import('../src/world/sealife.js');
  const life = buildSeaLife(new THREE.Scene());
  assert.ok(life.ashore.some((s) => N.SELKIE.some((R) => Math.hypot(s.g.position.x - R.x, s.g.position.z - R.z) < R.r)), 'seals hauled out on the Selkie Rocks');
  assert.ok(life.whales.some((w) => w.sea === 'north' && w.kind === 'minkewhale'), 'a minke in the north');
  assert.ok(PODS.some((p) => p.sea === 'north' && p.ownDice), 'dolphins in the north, with their own dice');
  const { buildBirds } = await import('../src/world/birds.js');
  const B = buildBirds(new THREE.Scene());
  const onSkarv = B.colonies.filter((c) => c.cx && Math.hypot(c.cx - N.SKARV.x, c.cz - N.SKARV.z) < 120);
  assert.ok(new Set(onSkarv.map((c) => c.kind)).size >= 3, 'a seabird colony on Skarv Stack');
});

// N5: the voyage.
test('the voyage: offered west of the Calf and up the coast; the nearest harbour named; the bay\'s mud for the anchor; the westerlies', async () => {
  // Where the passage is offered (at the helm, or the trawler's chart table): out of the bay west of
  // the Calf, or anywhere up the coast; not in Willow Bay, not at Las Brasas.
  assert.ok(N.northWaters(-700, 450) && N.northWaters(-2600, -6170) && N.northWaters(-2500, -3000));
  assert.ok(!N.northWaters(0, 300) && !N.northWaters(-300, 400) && !N.northWaters(0, 6000));
  assert.ok(N.NORTH_M > 8500 && N.NORTH_M < 10500);
  assert.ok(-heightAt(N.NORTH_LANDFALL.x, N.NORTH_LANDFALL.z) > 6, 'the landfall in water deep enough for the trawler');
  // Turning for home: the way back is to the nearest harbour.
  const { turnForHome } = await import('../src/offshore.js');
  const r = turnForHome({ kind: 'skiff', distHome: 2500, litres: 1, harbour: 'Halvig' });
  assert.match(r.words, /back to Halvig/);
  // Bothy Bay: sand by its beach, mud further out (good holding); rock under Raven Isle's shores.
  const { createHabitat } = await import('../src/world/habitat.js');
  const { bottomOf } = await import('../src/sonarRead.js');
  const H = createHabitat();
  const bed = (x, z) => bottomOf(H.sample(x, z, {}), zoneAt(x, z)).kind;
  assert.equal(bed(N.BOTHY_BAY.x, N.BOTHY_BAY.z + 15), 'mud', 'mud in Bothy Bay');
  assert.equal(bed(N.BOTHY_BAY.x, N.BOTHY_BAY.z - 25), 'sand', 'sand by its beach');
  assert.equal(bed(-1500, -5600), 'mud', 'mud in the loch\'s deep');
  // The north's wind: the westerlies, off the open Atlantic (west-south-west, give or take).
  const C = await import('../src/world/conditions.js');
  const was = { region: C.conditions.region, from: C.conditions.wind.from, hour: C.conditions.hour };
  C.conditions.region = 'north';
  C.conditions.hour = null;
  C.conditions.wind.from = 0.5;
  for (let i = 0; i < 4000; i++) C.updateConditions(0.5, { rain: 0, cloud: 0.3, storm: 0 });
  const off = Math.abs(((C.conditions.wind.from - 4.32 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  assert.ok(off < 0.8, `from the west-south-west (${C.conditions.wind.from.toFixed(2)})`);
  Object.assign(C.conditions, { region: was.region, hour: was.hour });
  C.conditions.wind.from = was.from;
});
