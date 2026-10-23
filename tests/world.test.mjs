// The living world (src/world/ecosystem.js): every kind of fish lives somewhere, fresh water
// fish stay in fresh water and sea fish in the sea, wherever the player is. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHabitat } from '../src/world/habitat.js';
import { Ecosystem } from '../src/world/ecosystem.js';
import { zoneAt, waterOf } from '../src/world/terrain.js';
import { FISH } from '../src/fish.js';

const habitat = createHabitat();

function wrongWater(eco) {
  const bad = [];
  for (const a of eco.agents) {
    if (!a.active && a.state === 'gone') continue;
    const fresh = waterOf(zoneAt(a.x, a.z)) === 'fresh';
    if (fresh !== (a.sp.water === 'fresh')) bad.push(`${a.sp.id} at ${a.x.toFixed(0)},${a.z.toFixed(0)}`);
  }
  return bad;
}

test('every kind of fish (and the squid) lives somewhere in the world', () => {
  const eco = new Ecosystem(habitat);
  for (const f of FISH) assert.ok(eco.bySpecies[f.id]?.length, `no ${f.name} anywhere`);
});

test('fresh water fish stay in fresh water and sea fish in the sea, wherever you are', () => {
  const eco = new Ecosystem(habitat);
  assert.deepEqual(wrongWater(eco), []);
  const ctx = { env: { hour: 10, rain: 0, cloud: 0.3, daylight: 1, night: 0, hatch: 0 }, focus: { x: 0, z: 0 }, boat: { x: 0, z: 0, speed: 0 }, walker: null, lights: [] };
  for (const [x, z] of [[0, 0], [330, -470], [540, -40], [-250, 520], [100, 1000]]) {
    ctx.focus.x = x;
    ctx.focus.z = z;
    for (let i = 0; i < 30 * 40; i++) eco.update(1 / 30, ctx);
    assert.deepEqual(wrongWater(eco), [], `after time near ${x},${z}`);
  }
});
