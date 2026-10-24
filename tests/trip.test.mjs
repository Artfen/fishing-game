// Planning a fishing trip (src/trip.js): it leads to water that suits the fish, never to a fish,
// and afterwards counts what the trip brought. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { MapSheet } = await import('../src/map.js');
const { heightAt, zoneAt } = await import('../src/world/terrain.js');
const { fishById } = await import('../src/fish.js');
const { tripPlaces, startTrip, endTrip, tripSummary, summaryText } = await import('../src/trip.js');

// The map's habitat sums without its window: depths straight from the terrain.
const map = Object.create(MapSheet.prototype);
map.sample = (x, z) => [heightAt(x, z), 0];
const fresh = () => ({ places: {}, log: [], trips: [], trip: null, day: 3, hour: 7 });
const HOME = { x: 48, z: 47 };

test('a trip leads to water that suits the fish (its waters, habitats and depths), and never to a fish', () => {
  for (const id of ['whitebream', 'bonito', 'sole', 'octopus', 'sardine']) {
    const sp = fishById[id], places = tripPlaces(sp, map, HOME, fresh());
    assert.ok(places.length, `${id}: somewhere to go`);
    for (const p of places) {
      assert.ok(map.suitableAt(id, p.x, p.z), `${id}: ${p.name} suits it`);
      assert.ok(sp.life.zones.includes(zoneAt(p.x, p.z)) || sp.life.zones.includes(p.zone), `${id}: ${p.name} is in its waters`);
      assert.ok(p.dist >= 0 && /north|south|east|west/.test(p.dir));
    }
    // Spread out: two choices are never the same stretch of water.
    for (const a of places) for (const b of places) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 120);
  }
});

test('a trip counts what it brought, and goes into the record when it ends', () => {
  const st = fresh();
  startTrip(st, { sp: 'whitebream', place: { x: 50, z: 270, r: 30, name: 'the outer coast' }, setup: { rod: 'boat', item: 'rag', term: 'flapper', line: 'm20' } });
  const at = (st.trip.start -= 60000); // (it began a minute ago)
  st.log.push({ sp: 'mackerel', size: 30, at: at - 1000, rod: 'sea', item: 'metal' }); // before it began
  st.log.push({ sp: 'whitebream', size: 31, at: at + 1000, rod: 'boat', item: 'rag' });
  st.log.push({ sp: 'whitebream', size: 24, at: at + 2000, rod: 'float', item: 'rag' });
  st.log.push({ sp: 'wrasse', size: 35, at: at + 3000, rod: 'boat', item: 'rag' });
  st.hour = 9;
  const now = tripSummary(st);
  assert.equal(now.target, 2);
  assert.equal(now.best.size, 31);
  assert.equal(now.onSetup, 1);
  assert.deepEqual(now.others, { wrasse: 1 });
  const sum = endTrip(st);
  assert.equal(st.trip, null);
  assert.equal(st.trips.length, 1);
  assert.equal(st.trips[0].target, 2);
  assert.equal(sum.hours, 2);
  assert.match(summaryText('whitebream', sum), /^2 hours out: 2 white seabream \(best 31 cm\), and 1 ballan wrasse\.$/);
  assert.match(summaryText('whitebream', { ...sum, hours: 1 / 60, target: 0, others: {} }), /^1 minute out: no white seabream yet\.$/);
});
