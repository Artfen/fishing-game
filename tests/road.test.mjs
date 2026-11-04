// The road round the bay and the boat trailer (R6): a road you can drive from home to the Mere
// Boathouse and Wend Quay, dry and gentle the whole way and level across; and a trailer that takes
// a small boat out of the water and puts her in again wherever the car can get close.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const T = await import('../src/world/terrain.js');
const { ROAD, ROAD_LENGTH, LANES, CAR_PARKS, heightAt, depthAt, laneInfo, roadNear } = T;
const { DESTS, driveMinutes } = await import('../src/outing.js');
const { TRAILABLE, TRAILER_HOME, cleanTrailer, launchSpot, loadable, LAUNCH_REACH } = await import('../src/trailer.js');
const { cleanStored, MAX_AFLOAT } = await import('../src/fleet.js');
const { sanitize } = await import('../src/save.js');

// How the car judges the ground (car.js ground): 1 is the steepest it will take.
const STEEP = 0.42;
function steep(x, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const hf = heightAt(x + s * 1.6, z + c * 1.6), hb = heightAt(x - s * 1.6, z - c * 1.6);
  const hl = heightAt(x - c * 0.9, z + s * 0.9), hr = heightAt(x + c * 0.9, z - s * 0.9);
  return Math.max(Math.abs(hf - hb) / 3.2 / STEEP, Math.abs(hl - hr) / 1.8 / (STEEP * 1.6));
}
// Every metre along the road: (x, z), the way along it, and how far along.
function* along(step = 1) {
  let s0 = 0;
  for (let i = 0; i < ROAD.length - 1; i++) {
    const [ax, az] = ROAD[i], [bx, bz] = ROAD[i + 1], L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
    for (let d = 0; d < L; d += step) yield { x: ax + ((bx - ax) * d) / L, z: az + ((bz - az) * d) / L, yaw, s: s0 + d };
    s0 += L;
  }
}

test('the road forks off the drive at home and runs past the Mere Boathouse to Wend Quay', () => {
  assert.ok(LANES.includes(ROAD), 'it is one of the lanes');
  const drive = LANES[0];
  assert.ok(drive.some(([x, z]) => x === ROAD[0][0] && z === ROAD[0][1]), 'it starts on the drive');
  const end = ROAD[ROAD.length - 1], q = CAR_PARKS.quay, b = CAR_PARKS.boathouse;
  assert.ok(Math.hypot(end[0] - q.x, end[1] - q.z) < q.r, 'it ends in the quay’s car park');
  assert.ok(laneInfo(b.x, b.z, undefined, 20).d < b.r + 3, 'it passes the boathouse’s car park');
  assert.ok(ROAD_LENGTH > 1000 && ROAD_LENGTH < 1500, `${Math.round(ROAD_LENGTH)} m`);
  assert.equal(DESTS.quay.drive, true);
  assert.equal(DESTS.boathouse.drive, true);
  assert.ok(driveMinutes('home', 'boathouse') < driveMinutes('home', 'quay'), 'the boathouse comes first');
  assert.match(DESTS.quay.access, /road round the bay/);
});

test('it is dry the whole way (and leaves the water alone), and the car can drive every metre of it', () => {
  let worst = 0;
  for (const p of along(1)) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      assert.ok(depthAt(p.x + Math.cos(a) * 4, p.z + Math.sin(a) * 4) <= 0, `water by the road at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`);
    }
    // (Down the middle, and where each side's wheels run.)
    for (const off of [-1.2, 0, 1.2]) worst = Math.max(worst, steep(p.x + Math.cos(p.yaw) * off, p.z - Math.sin(p.yaw) * off, p.yaw));
  }
  assert.ok(worst < 0.8, `the steepest is ${worst.toFixed(2)} of what the car will take`);
});

test('the ground under it is level across and eases back into the land: a bank here and there, never a step', () => {
  for (const p of along(7)) {
    const nx = Math.cos(p.yaw), nz = -Math.sin(p.yaw);
    const mid = heightAt(p.x, p.z);
    // (Except just above the water, where the road leaves the bank as it is, and right on a bend,
    // where it turns as it climbs.)
    if (Math.min(mid, heightAt(p.x + nx * 1.6, p.z + nz * 1.6), heightAt(p.x - nx * 1.6, p.z - nz * 1.6)) < 0.8) continue;
    if (ROAD.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < 3)) continue;
    assert.ok(Math.abs(heightAt(p.x + nx * 1.6, p.z + nz * 1.6) - mid) < 0.12 && Math.abs(heightAt(p.x - nx * 1.6, p.z - nz * 1.6) - mid) < 0.12, `level across at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`);
    assert.ok(Math.abs(mid - roadNear(p.x, p.z).h) < 0.05, 'at the road’s own height');
    // Walking out across it, six metres each side (where the road shapes the ground): never a jump. (On a steep hillside, where the
    // road is cut in on one side and built up on the other, a bank: no steeper than about 1 in 0.8.)
    let prev = heightAt(p.x - nx * 6, p.z - nz * 6);
    for (let u = -5.5; u <= 6; u += 0.5) {
      const h = heightAt(p.x + nx * u, p.z + nz * u);
      assert.ok(Math.abs(h - prev) < 0.65, `a step of ${(h - prev).toFixed(2)} m beside the road at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`);
      prev = h;
    }
  }
});

test('the trailer takes the small boats, and nothing goes on it that shouldn’t', () => {
  assert.deepEqual(TRAILABLE, ['kayak', 'row', 'skiff', 'bass', 'jetski']);
  assert.deepEqual(cleanTrailer(null), { hitched: false, boat: null });
  assert.deepEqual(cleanTrailer({ hitched: true }), { hitched: true, boat: null });
  assert.deepEqual(cleanTrailer({ boat: 'kayak' }), { hitched: true, boat: 'kayak' }, 'a boat on it: it’s hitched');
  assert.deepEqual(cleanTrailer({ hitched: true, boat: 'cruiser' }), { hitched: true, boat: null });
  assert.deepEqual(cleanTrailer({ boat: '<b>' }), { hitched: false, boat: null });
  // It stands at home on the level, clear of the lanes.
  assert.ok(Math.abs(heightAt(TRAILER_HOME.x, TRAILER_HOME.z) - T.HOME_PAD.h) < 0.05);
  const boats = [
    { kind: 'kayak', pos: { x: 10, z: 0 } }, { kind: 'row', pos: { x: 5, z: 0 } }, { kind: 'cruiser', pos: { x: 2, z: 0 } },
    { kind: 'skiff', pos: { x: 3, z: 0 }, aboard: true }, { kind: 'bass', pos: { x: 90, z: 0 } }, { kind: 'jetski', pos: { x: 4, z: 0 }, towing: true },
  ];
  assert.deepEqual(loadable(boats, 0, 0).map((b) => b.kind), ['row', 'kayak'], 'small, near, empty and free, nearest first');
});

test('a boat goes in off the trailer where the water’s close: the quay, the boathouse, the slipway, the strand; not at home', () => {
  for (const id of ['quay', 'boathouse', 'haven', 'strand', 'head']) {
    const c = CAR_PARKS[id], s = launchSpot(depthAt, c.x, c.z, c.yaw);
    assert.ok(s, `water to launch into from ${id}`);
    assert.ok(depthAt(s.x, s.z) >= 0.7 && s.r <= LAUNCH_REACH);
  }
  assert.equal(launchSpot(depthAt, CAR_PARKS.home.x, CAR_PARKS.home.z, CAR_PARKS.home.yaw), null);
  assert.equal(launchSpot(depthAt, TRAILER_HOME.x, TRAILER_HOME.z, 0), null);
});

test('a boat on the trailer is neither in the water nor laid up, and the save keeps her there', () => {
  const kinds = ['row', 'skiff', 'kayak', 'bass', 'sail'];
  // (Three in the water and one on the trailer is fine: she's not counted.)
  assert.ok(cleanStored(['bass'], kinds.filter((k) => k !== 'kayak')));
  assert.equal(cleanStored(['bass'], kinds), null, 'counted in, four would be in the water');
  const s = sanitize({ trailer: { hitched: true, boat: 'kayak' }, stored: ['bass', 'sail', 'cabin', 'cruiser', 'console', 'jetski', 'windsurf', 'rib'], boats: { row: { x: 1, z: 2 }, skiff: { x: 1, z: 2 }, kayak: { x: 1, z: 2 } } });
  assert.deepEqual(s.trailer, { hitched: true, boat: 'kayak' });
  assert.ok(s.stored && !s.stored.includes('kayak'));
  assert.ok(MAX_AFLOAT === 3);
});
