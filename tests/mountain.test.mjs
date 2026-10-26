// The bigger map: Hoarfell, the Coldwater running down from Hoar Tarn to the bay, and the path up
// it. That the path can be walked all the way (never too steep, never wet, and a long walk), the
// river keeps to its bed at every height, the land has no walls where one rule meets another, the
// places along the way are found by walking up, the footbridge carries the coast path over the
// river's mouth, the old map and every fish already in the world are as they were, and the river's
// own fish live in water that suits them. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const T = await import('../src/world/terrain.js');
const C = await import('../src/world/coldwater.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { fishById } = await import('../src/fish.js');
const { BIG_GAME } = await import('../src/bigGame.js');

// Every metre along the fell path: [x, z].
const alongPath = () => {
  const out = [];
  const P = C.FELL_PATH;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], len = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d < len; d += 1) out.push([ax + ((bx - ax) * d) / len, az + ((bz - az) * d) / len]);
  }
  return out;
};

/* ---------------- the walk ---------------- */

test('the fell path is a long walk: over two and a half kilometres from the bay to the cairn', () => {
  assert.ok(C.FELL_PATH_LENGTH > 2500 && C.FELL_PATH_LENGTH < 3300, `${C.FELL_PATH_LENGTH.toFixed(0)} m`);
  // (At a steady walk, three metres a second, that's a quarter of an hour or more.)
  assert.ok(C.FELL_PATH_LENGTH / 3 / 60 > 13);
  const [x0, z0] = C.FELL_PATH[0], [x1, z1] = C.FELL_PATH.at(-1);
  assert.ok(T.coastPathInfo(x0, z0).d < 4, 'it starts on the coast path');
  assert.ok(Math.hypot(x1 - C.SUMMIT_CAIRN.x, z1 - C.SUMMIT_CAIRN.z) < 5, 'and ends at the cairn');
  assert.ok(T.heightAt(x1, z1) > 540, 'at the top');
});

test('the fell path can be walked all the way: never too steep a step, never into the water', () => {
  let prev = null, worst = 0, wet = 0;
  for (const [x, z] of alongPath()) {
    const h = T.walkHeight(x, z);
    if (prev !== null) worst = Math.max(worst, Math.abs(h - prev));
    prev = h;
    if (h < T.waterLevel(x, z) + 0.3) wet++;
  }
  // (A walker can't climb more than 1.15 m in a metre: the path never asks for anything near it.)
  assert.ok(worst < 1, `steepest metre ${worst.toFixed(2)}`);
  assert.equal(wet, 0);
});

test('the path is trodden into the hillside, not banked up on it or sunk in a trench', () => {
  // On the open fell (where the river doesn't shape the ground), the tread keeps close to the
  // lie of the land.
  let over = 0, worst = 0;
  const P = C.FELL_PATH;
  const fell = P.findIndex(([x, z]) => z < -1300);
  for (let i = fell; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], len = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d < len; d += 1) {
      const x = ax + ((bx - ax) * d) / len, z = az + ((bz - az) * d) / len;
      const off = Math.abs(T.walkHeight(x, z) - C.coldwaterHeight(x, z, -50));
      worst = Math.max(worst, off);
      if (off > 2) over++;
    }
  }
  assert.ok(worst < 6, `worst cut ${worst.toFixed(1)} m`);
  assert.ok(over < 60, `${over} m of the path more than 2 m off the hillside`);
});

test('the places up the Coldwater are found in order, walking up the path', () => {
  const found = [];
  const want = ['coldfoot', 'lowerforce', 'dale', 'bothy', 'spout', 'tarn', 'summit'];
  const places = T.PLACES.filter((p) => want.includes(p.id));
  assert.equal(places.length, want.length);
  for (const [x, z] of alongPath()) for (const p of places) if (!found.includes(p.id) && p.test(x, z)) found.push(p.id);
  assert.deepEqual(found, want);
  // The bothy is a camp: once found, you can travel straight back to it.
  assert.ok(T.PLACES.find((p) => p.id === 'bothy').camp);
});

/* ---------------- the river ---------------- */

test('the Coldwater keeps to its bed at every height, from the tarn to the sea', () => {
  const W = C.COLDWATER;
  for (let i = 0; i < W.length - 1; i++) {
    const a = W[i], b = W[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
    const tx = (b.x - a.x) / len, tz = (b.z - a.z) / len;
    for (let d = 0; d < len; d += 3) {
      const x = a.x + tx * d, z = a.z + tz * d, R = C.coldInfo(x, z);
      const lv = T.waterLevel(x, z);
      // Water in the middle of the channel…
      assert.ok(T.depthAt(x, z) > 0.2, `water at node ${i} +${d} m (depth ${T.depthAt(x, z).toFixed(2)})`);
      if (lv < 0.05) continue;
      // …and banks either side that hold it (up on the fell, nothing lower than the water).
      for (const side of [-1, 1]) {
        const off = side * (R.w + 2.5), bx = x - tz * off, bz = z + tx * off;
        if (C.inColdwater(bx, bz, 0) || T.waterLevel(bx, bz) > 0.05) continue;
        assert.ok(T.heightAt(bx, bz) > lv - 0.05, `bank at node ${i} +${d} m: ${T.heightAt(bx, bz).toFixed(1)} vs water ${lv.toFixed(1)}`);
      }
    }
  }
});

test('the water stands at its own level: the tarn up in its corrie, the falls, the tide below', () => {
  assert.equal(T.waterLevel(C.TARN.x, C.TARN.z), C.TARN.level);
  assert.ok(T.depthAt(C.TARN.x, C.TARN.z) > 6, 'the tarn is deep in the middle');
  for (const F of C.FALLS) {
    const top = C.COLDWATER[F.top], foot = C.COLDWATER[F.foot];
    assert.ok(top.l - foot.l > 9, `${F.name} is a real drop`);
    assert.ok(T.depthAt(foot.x, foot.z) > 2, `a deep pool under ${F.name}`);
  }
  // Below the Lower Force the river is tidal: the sea's own level.
  const mouth = C.COLDWATER.at(-1);
  assert.equal(T.waterLevel(mouth.x, mouth.z), 0);
  assert.equal(T.zoneAt(mouth.x - 2, mouth.z - 6), 'tideway');
  assert.equal(T.waterOf('tideway'), 'brackish');
  assert.equal(T.waterOf('river'), 'fresh');
  assert.equal(T.waterOf('tarn'), 'fresh');
});

test('a kayak can paddle up the tidal river from the bay to the Force Pool', () => {
  const W = C.COLDWATER;
  for (let i = 33; i < W.length - 1; i++) {
    const a = W[i], b = W[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let d = 0; d < len; d += 2) {
      const x = a.x + ((b.x - a.x) * d) / len, z = a.z + ((b.z - a.z) * d) / len;
      assert.ok(-T.solidHeight(x, z) > 1, `deep enough at node ${i} +${d} m`);
    }
  }
});

test('the land has no walls where one shape meets another', () => {
  // Over the fell, the dale and out to the edge of the land: no step of more than a metre and a
  // half in a quarter of a metre, except in the river's own bed (its pools and falls).
  const steps = [];
  for (let z = -2190; z < -60; z += 12) {
    for (let x = -1790; x < 0; x += 12) {
      if (C.inColdwater(x, z, 3)) continue;
      const h = T.heightAt(x, z);
      const j = Math.max(Math.abs(T.heightAt(x + 0.25, z) - h), Math.abs(T.heightAt(x, z + 0.25) - h));
      if (j > 1.5) steps.push([x, z, +j.toFixed(1)]);
    }
  }
  assert.deepEqual(steps, []);
  // And the fell fades into the moor before the edge of the land drawn, not in a cliff.
  for (const z of [-2190, -2150]) for (let x = -1790; x < 0; x += 50) assert.ok(T.heightAt(x, z) < 60, `${x}, ${z}: ${T.heightAt(x, z).toFixed(0)}`);
  for (const x of [-1790, -1750]) for (let z = -2190; z < -200; z += 50) assert.ok(T.heightAt(x, z) < 60, `${x}, ${z}: ${T.heightAt(x, z).toFixed(0)}`);
});

test('snow lies on the top of Hoarfell: it is the highest ground there is', () => {
  const top = T.heightAt(C.SUMMIT_CAIRN.x, C.SUMMIT_CAIRN.z);
  assert.ok(top > 540 && top < 600, `${top.toFixed(0)} m`);
  for (let x = -1700; x < 1100; x += 100) for (let z = -2100; z < 1400; z += 100) assert.ok(T.heightAt(x, z) <= top + 8);
});

/* ---------------- the footbridge, the bothy ---------------- */

test('the footbridge carries the coast path over the river mouth, high enough for a kayak beneath', () => {
  const F = C.FOOTBRIDGE, ux = Math.cos(F.yaw), uz = -Math.sin(F.yaw);
  let prev = null;
  for (let u = -F.len / 2 - 3; u <= F.len / 2 + 3; u += 0.5) {
    const x = F.x + ux * u, z = F.z + uz * u, h = T.walkHeight(x, z);
    assert.ok(h > T.waterLevel(x, z) + 0.3, `dry at ${u}`);
    if (prev !== null) assert.ok(Math.abs(h - prev) < 0.28, `an easy step at ${u}`);
    prev = h;
  }
  assert.ok(T.walkHeight(F.x, F.z) > 1.6, 'its middle stands well clear of the water');
});

test('the bothy stands beside the path above Spout Pool, on level ground', () => {
  const B = C.BOTHY;
  assert.ok(T.fellPathInfo(B.x, B.z).d < 14 && T.fellPathInfo(B.x, B.z).d > 5, 'beside the path, not on it');
  for (let a = 0; a < 6.3; a += 0.7) assert.ok(Math.abs(T.heightAt(B.x + Math.cos(a) * 4, B.z + Math.sin(a) * 4) - B.level) < 0.05);
  const spout = C.COLDWATER[C.FALLS[0].foot];
  assert.ok(Math.hypot(B.x - spout.x, B.z - spout.z) < 80);
});

/* ---------------- what was there before ---------------- */

test('every fish already in the world is where it was, the same size, the same kind', () => {
  // (A fingerprint of every fish outside the Coldwater, taken before the river was added: the
  // river only adds homes of its own, after all the others. So does Las Brasas, far to the south,
  // and the big game of the open ocean adds fish of its own, moving nobody.)
  const eco = new Ecosystem(createHabitat());
  const COLD = new Set(['beck', 'gill', 'spout', 'dale', 'tarn', 'forcepool', 'tideway', 'flats']);
  const BIG = new Set(BIG_GAME.map((f) => f.id));
  let h = 0x811c9dc5, n = 0;
  for (const a of eco.agents) {
    if (COLD.has(a.home.tag) || a.home.level || a.home.south || a.home.site || BIG.has(a.sp.id)) continue;
    n++;
    const s = `${a.sp.id}|${a.home.type}@${a.home.x.toFixed(1)},${a.home.z.toFixed(1)}:${a.size}`;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  }
  assert.equal(n, 2349);
  assert.equal(h, 2827814919);
});

test('the Coldwater’s own fish live in water that suits them', () => {
  const eco = new Ecosystem(createHabitat());
  const river = eco.agents.filter((a) => a.home.level || ['beck', 'gill', 'spout', 'dale', 'tarn', 'forcepool', 'tideway', 'flats'].includes(a.home.tag));
  assert.ok(river.length > 40, `${river.length} fish`);
  const kinds = new Set(river.map((a) => a.sp.id));
  for (const k of ['trout', 'grayling', 'seabass', 'mullet', 'flounder']) assert.ok(kinds.has(k), k);
  for (const a of river) {
    const zone = T.zoneAt(a.home.x, a.home.z), water = T.waterOf(zone);
    assert.ok(fishById[a.sp.id].life.zones.includes(zone), `${a.sp.id} in ${zone}`);
    // Up on the fell they swim at the river's own level, never the sea's.
    if (a.home.level) assert.ok(water === 'fresh' && a.home.level > 0.05, `${a.sp.id}: ${water}`);
    // Sea fish come no higher than the Force Pool.
    if (fishById[a.sp.id].life.zones.every((z) => T.waterOf(z) !== 'fresh')) assert.equal(T.waterLevel(a.home.x, a.home.z), 0, a.sp.id);
  }
});
