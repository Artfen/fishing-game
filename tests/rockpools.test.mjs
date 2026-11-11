// The rockpools (src/world/rockpools.js, and the rockpool view in main.js): pools between the tide
// marks on three stretches of rocky shore, uncovered at low water and covered at high; what lives
// in them, richer the lower they lie, with the shy ones under the stones; turning a stone, and
// putting it back; the hand net; and every creature in the naturalist's notes and the journal's tree.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? () => {} : undefined),
  set: () => true,
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const THREE = await import('three');
const R = await import('../src/world/rockpools.js');
const { heightAt } = await import('../src/world/terrain.js');
const { tideAt, RANGE } = await import('../src/world/tide.js');
const { NATURE, cleanGrounds } = await import('../src/grounds.js');
const { fishById } = await import('../src/fish.js');
const T = await import('../src/taxonomy.js');

test('pools on three stretches of rocky shore, every one between the tide marks, in a basin that holds water', () => {
  for (const S of R.POOL_SITES) assert.ok(R.POOLS.filter((p) => p.site === S.id).length >= 4, `${S.id}: pools`);
  for (const p of R.POOLS) {
    assert.ok(p.rim > -RANGE.springs / 2 + 0.05 && p.rim < RANGE.springs / 2 + 0.1, `${p.id}: rim ${p.rim.toFixed(2)} within the tide's reach`);
    assert.ok(p.rim - p.ground > 0.15 && p.rim - p.ground < 0.45, `${p.id}: ${((p.rim - p.ground) * 100).toFixed(0)} cm of water`);
    // A basin: the ground all round inside it is under its water.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      assert.ok(heightAt(p.x + Math.cos(a) * p.r * 0.85, p.z + Math.sin(a) * p.r * 0.85) < p.rim, `${p.id}: holds water`);
    }
  }
  // Laid out the same every game.
  const again = R.POOL_SITES.flatMap((S) => R.layPools(S));
  assert.deepEqual(again.map((p) => [p.id, p.x.toFixed(2), p.life.length]), R.POOLS.map((p) => [p.id, p.x.toFixed(2), p.life.length]));
});

test('the tide covers them and leaves them: all out at a spring low, the low pools under at high water', () => {
  assert.ok(R.POOLS.every((p) => R.poolOpen(p, -RANGE.springs / 2)), 'every pool out at the bottom of a spring tide');
  const low = R.POOLS.filter((p) => p.low > 0.5);
  assert.ok(low.length >= 3 && low.every((p) => !R.poolOpen(p, 0)), 'the low ones under the sea at half tide');
  // Over a fortnight, out for a good part of the time but not all of it.
  let open = 0, n = 0;
  for (let h = 0; h < 24 * 15; h += 0.5) for (const p of R.POOLS) { n++; if (R.poolOpen(p, tideAt(h).level)) open++; }
  assert.ok(open / n > 0.4 && open / n < 0.9, `${(100 * open / n).toFixed(0)}% of the time`);
  // Beside one at low water: found; under the tide: only when asked for covered ones too.
  const p = low[0];
  assert.equal(R.poolNear(p.x + p.r + 0.5, p.z, -0.5), p);
  assert.equal(R.poolNear(p.x + p.r + 0.5, p.z, 0.4), null);
  assert.equal(R.poolNear(p.x + p.r + 0.5, p.z, 0.4, { open: false }), p);
});

test('what lives in them: richer low down, the shy ones under stones, every kind in the notes and the tree', () => {
  const life = (ps) => ps.reduce((s, p) => s + p.life.length, 0) / Math.max(1, ps.length);
  const low = R.POOLS.filter((p) => p.low > 0.55), high = R.POOLS.filter((p) => p.low < 0.25);
  assert.ok(low.length && high.length && life(low) > life(high) * 1.5, `low ${life(low).toFixed(1)}, high ${life(high).toFixed(1)}`);
  const kinds = new Set(R.POOLS.flatMap((p) => p.life.map((c) => c.kind)));
  for (const k of ['beadlet', 'limpet', 'periwinkle', 'prawn', 'shorecrab', 'rockgoby', 'shanny']) assert.ok(kinds.has(k), `${k} somewhere`);
  for (const p of R.POOLS) {
    for (const c of p.life) {
      if (R.POOL_LIFE[c.kind].where === 'under') assert.ok(c.under >= 0 && c.under < 3, `${c.kind} under a stone`);
      if (R.POOL_LIFE[c.kind].fish) assert.ok(c.size >= fishById[c.kind].size[0] && c.size <= fishById[c.kind].size[1], `${c.kind} ${c.size} cm`);
    }
  }
  for (const k of R.POOL_KINDS) {
    if (R.POOL_LIFE[k].fish) assert.ok(fishById[k]?.life.micro, `${k}: one of the small fish`);
    else {
      assert.ok(NATURE[k]?.note.length > 60, `${k}: in the notes`);
      const e = T.species().find((x) => x.key === `nature:${k}`);
      assert.ok(e && e.sci && T.FAMILIES[e.family] && T.ORDERS[e.order] && T.CLASSES[e.cls], `${k}: in the tree`);
    }
  }
  assert.equal(T.species().find((x) => x.key === 'nature:limpet').cls, 'gastropoda');
  // The notes keep them, saved and loaded.
  const g = cleanGrounds({ notes: { beadlet: { n: 2, day: 3, hour: 10, where: 'The rocks in Willow Bay' }, cushionstar: { n: 1, day: 3, hour: 10, where: '' } } });
  assert.equal(g.notes.beadlet.n, 2);
  assert.ok(g.notes.cushionstar);
});

test('turning a stone over shows what hides under it; put back, it hides them again; the net, and letting go', () => {
  const p = R.POOLS.find((q) => q.life.some((c) => c.under != null));
  const hidden = p.life.filter((c) => c.under != null);
  const before = R.visibleLife(p, 100).length;
  assert.ok(hidden.every((c) => !R.visibleLife(p, 100).includes(c)), 'hidden at first');
  let found = 0;
  for (let i = 0; i < 3; i++) found += R.turnStone(p)?.found.length ?? 0;
  assert.equal(R.turnStone(p), null, 'three stones, no more');
  assert.equal(found, hidden.length);
  assert.equal(R.visibleLife(p, 100).length, before + hidden.length);
  R.settle(p);
  assert.equal(R.visibleLife(p, 100).length, before, 'put back as you found them');
  // The net: a sure sweep and a miss; what you net is gone a while, then back.
  const q = R.POOLS.find((x) => R.visibleLife(x, 100).some((c) => c.kind === 'prawn'));
  const miss = R.netIn(q, 100, 'prawn', () => 0.99);
  assert.ok(!miss.ok && miss.creature.kind === 'prawn');
  const hit = R.netIn(q, 100, 'prawn', () => 0.01);
  assert.ok(hit.ok);
  R.letGo(hit.creature, 100);
  assert.ok(!R.visibleLife(q, 101).includes(hit.creature), 'sheltering');
  assert.ok(R.visibleLife(q, 104).includes(hit.creature), 'back a few hours later');
  // Limpets and anemones can't be netted.
  assert.ok(!R.POOL_LIFE.limpet.net && !R.POOL_LIFE.beadlet.net);
});

test('drawn near you: the water while the tide is out, the life you can see; in a photograph, named', () => {
  const Rp = new R.Rockpools(new THREE.Scene());
  const p = R.POOLS.find((q) => q.site === 'bayrocks' && q.low > 0.3) || R.POOLS[0];
  Rp.update(1 / 30, 5, { x: p.x, z: p.z }, -0.5, 100);
  assert.ok(Rp.group.visible);
  const drawn = Object.values(Rp.kinds).reduce((s, m) => s + m.count, 0);
  assert.ok(drawn > 5, `${drawn} creatures drawn`);
  Rp.update(1 / 30, 5, { x: p.x + 400, z: p.z }, -0.5, 100);
  assert.ok(!Rp.group.visible, 'far off: not drawn');
  // A camera looking down into a pool: what's in the picture.
  Rp.update(1 / 30, 5, { x: p.x, z: p.z }, -0.5, 100);
  const cam = new THREE.PerspectiveCamera(60, 1.5, 0.05, 100);
  cam.position.set(p.x + p.r + 0.3, p.rim + 0.8, p.z);
  cam.lookAt(p.x, p.ground, p.z);
  cam.updateMatrixWorld();
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const seen = Rp.inFrame(fr, cam.position, 100);
  assert.ok(seen.nature.length >= 1, JSON.stringify(seen));
});
