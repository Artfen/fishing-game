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
