// The bass boat out on the sea. Her home water is Longmere, fresh water up the fell road from the
// coast; the trailer behind your car, or now the yard's own (ROAD_HAUL, from the harbour office),
// brings her down to the sea and takes her back up. Out there she's a boat like the others: towed
// in to Willowhaven quay when she runs dry or holed, the quay pumps filling her, the harbour office
// saying where she is. Before, all of that sent her to the boathouse on Longmere from anywhere.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const T = await import('../src/world/terrain.js');
const { ROAD_HAUL, TRAILABLE } = await import('../src/trailer.js');
const { homeOf } = await import('../src/fleet.js');

test('Longmere and the sea: the boathouse jetty on the mere, Willowhaven quay on salt water; the yard’s trailer between them', () => {
  const P = T.BOATHOUSE_PIER, Q = T.HAVEN_QUAY, d = P.dir;
  // Alongside the boathouse jetty, where she lies at home (main.js boathouseMooring).
  for (const k of [2, 6, 10]) for (const off of [2.1, -2.1]) {
    const x = P.end.x - d.x * k - d.z * off, z = P.end.z - d.z * k + d.x * off;
    assert.equal(T.zoneAt(x, z), 'mere', `beside the jetty at (${x.toFixed(0)}, ${z.toFixed(0)})`);
  }
  // Off Willowhaven's quay, where she's towed in to or brought down to: the sea.
  for (const dz of [-3, 10, 16]) {
    const x = (Q.x0 + Q.x1) / 2, z = Q.z1 + dz, zone = T.zoneAt(x, z);
    assert.notEqual(zone, 'mere');
    assert.equal(T.waterOf(zone), 'salt', `off the quay at (${x.toFixed(0)}, ${z.toFixed(0)}): ${zone}`);
  }
  // She lives on the mere, and goes on a trailer.
  assert.equal(homeOf('bass'), 'lake');
  assert.ok(TRAILABLE.includes('bass'));
  // The yard's trailer: less than the harbour launch's tow (£30), and an hour or two on the road.
  assert.ok(ROAD_HAUL.fee > 0 && ROAD_HAUL.fee < 30, `£${ROAD_HAUL.fee}`);
  assert.ok(ROAD_HAUL.hours >= 1 && ROAD_HAUL.hours <= 3, `${ROAD_HAUL.hours} h`);
});

test('the game: towed in, rescued, shipped home and said where she is by the water she’s on, not by her being the bass boat', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  // On Longmere is where she is, not what she is.
  assert.match(src, /const onMere = \(b\) => zoneAt\(b\.pos\.x, b\.pos\.z\) === 'mere';/);
  // Run dry or holed: towed to the boathouse only from the mere; from the sea, into Willowhaven
  // (the quay, the visitors' pontoon, or off the quay head: havenMooring, never the boathouse).
  assert.equal(src.match(/mere \? boathouseMooring\(boat\) : havenMooring\(boat\)/g)?.length, 2, 'the out-of-fuel tow and the harbour launch');
  assert.doesNotMatch(src, /kind === 'bass' \? mooring\('bass'\)/);
  assert.doesNotMatch(src, /boat\.iind/);
  assert.match(src, /into = onMere\(boat\) \? 'the boathouse'/);
  // The supply ship bringing her home with no berth free: off the quay, not up on the mere.
  assert.match(src, /south \? \{ x: PONTOON_S\.x1 \+ 9, z: PONTOON_S\.z1 \+ 6, heading: 0 \} : homeOf\(b\.kind\) === 'lake' \? havenMooring\(b\) : mooring\(b\.id\);/);
  // The harbour office: where she is, and she's brought round or shipped like the others at sea.
  assert.match(src, /if \(onMere\(b\)\) return 'on Longmere';/);
  assert.doesNotMatch(src, /b\.kind !== 'bass' && regionOf/);
  assert.doesNotMatch(src, /The bass boat lives on Longmere/);
  // By road: down from the mere, or (the bass boat) back up to it, and laid up she can go in here.
  assert.match(src, /haulByRoad\(b, 'sea'\)/);
  assert.match(src, /haulByRoad\(b, 'mere'\)/);
  // Her fuel: no pump on the mere, the quay pumps at sea.
  assert.match(src, /BOATS\[what\] && onMere\(BOATS\[what\]\) \? 'Longmere has no pump/);
});
