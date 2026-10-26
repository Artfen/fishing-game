// Wildlife moments (world/wildlife.js, and the seals in world/sealife.js): otters on the quiet
// waters that you can watch if you keep still, herons and oystercatchers that go up when you come
// too close, cormorants drying their wings, terns in summer, seals that follow a slow boat; what's
// in a photograph; and the record. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const THREE = await import('three');
// (The sea life draws its whale blows on a canvas: a stand-in for one.)
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
const W = await import('../src/world/wildlife.js');
const { buildSeaLife, SEA_LIFE } = await import('../src/world/sealife.js');
const T = await import('../src/world/terrain.js');
const { sanitize } = await import('../src/save.js');
const { seeded } = await import('../src/util.js');

// (Fixed dice, so the animals do the same thing every run.)
function withDice(seed, fn) {
  const was = Math.random;
  Math.random = seeded(seed);
  try {
    return fn();
  } finally {
    Math.random = was;
  }
}
const ctxAt = (x, z, extra = {}) => ({ from: { x, z }, onFoot: true, speed: 0, daylight: 0.8, hour: 7, season: 'summer', tideLevel: 0, region: 'home', ...extra });
function watch(w, seconds, ctx, dt = 0.1) {
  const seen = {}, calls = {}, moments = [];
  w.onSighting = (k) => { seen[k] = (seen[k] || 0) + 1; };
  w.onCall = (k) => { calls[k] = (calls[k] || 0) + 1; };
  w.onMoment = (k) => moments.push(k);
  for (let i = 0; i < seconds / dt; i++) w.update(dt, i * dt, typeof ctx === 'function' ? ctx(i * dt) : ctx);
  return { seen, calls, moments };
}

test('where they live: otters along the quiet waters, herons in the shallows, birds on dry perches', () => {
  assert.deepEqual(W.OTTER_BEATS.map((b) => b.id), ['coldwater', 'wend', 'saltings']);
  for (const B of W.OTTER_BEATS) {
    assert.ok(B.path.length > 10, `${B.id}: ${B.path.length} points`);
    for (const p of B.path) assert.ok(T.depthAt(p.x, p.z) > 0.3, `${B.id} in the water`);
    const banks = B.path.filter((p) => p.bx != null);
    assert.ok(banks.length > 5, `${B.id} has banks to eat on`);
    for (const p of banks) assert.ok(T.heightAt(p.bx, p.bz) > T.waterLevel(p.bx, p.bz), 'the bank is dry');
  }
  for (const S of W.HERON_SPOTS) {
    assert.ok(S.length >= 4);
    for (const p of S) assert.ok(T.depthAt(p.x, p.z) > 0.05 && T.depthAt(p.x, p.z) < 0.45, 'a heron stands in the shallows');
  }
  for (const P of W.PERCHES) assert.ok(P.y > 0.3, 'a perch above the water');
  for (const S of W.SHORES) for (const p of S) assert.ok(p.h > 0, 'dry ground for the oystercatchers');
  // Every one has its place in the record.
  for (const k of W.WILD_KINDS) assert.ok(SEA_LIFE[k]?.name && SEA_LIFE[k].note.length > 60, k);
});

test('an otter: watched from still and quiet, it carries on; come at it, and it’s gone', () => {
  withDice(7, () => {
    const w = W.buildWildlife(new THREE.Scene());
    const o = w.otters[0], p = o.B.path[8];
    // Keep still a little way off, at dawn: it comes and goes along the bank, and you see it.
    const quiet = watch(w, 600, ctxAt(p.x + 35, p.z));
    assert.ok(quiet.seen.otter > 20, `seen ${quiet.seen.otter}`);
    assert.ok(quiet.moments.includes('otter'));
    // Walk straight up on it: it dives and stays away.
    Object.assign(o, { state: 'swim', t: 30, x: p.x, z: p.z });
    const loud = watch(w, 4, ctxAt(p.x + 8, p.z, { speed: 1.4 }));
    assert.equal(o.state, 'gone');
    assert.ok(loud.moments.includes('otterGone'));
    assert.ok(o.t > 100, 'and won’t be back for a good while');
  });
});

test('herons and oystercatchers go up when you come too close, and settle further off', () => {
  withDice(11, () => {
    const w = W.buildWildlife(new THREE.Scene());
    const H = w.herons[0], x0 = H.x, z0 = H.z;
    const r = watch(w, 1, ctxAt(H.x + 15, H.z, { speed: 1.2 }));
    assert.ok(H.fly, 'up it goes');
    assert.equal(r.calls.heron, 1, 'with a croak');
    watch(w, 40, ctxAt(x0 + 15, z0));
    assert.ok(!H.fly && (H.state === 'away' || Math.hypot(H.x - (x0 + 15), H.z - z0) > 45), 'settled again well away from you (or gone over the hill)');
    // Far off and quiet, they stay put.
    const H2 = w.herons[1];
    watch(w, 20, ctxAt(H2.x + 200, H2.z));
    assert.ok(!H2.fly);
    const F = w.flocks[0], fx = F.x, fz = F.z;
    const f = watch(w, 0.5, ctxAt(F.x + 10, F.z, { speed: 1.2 }));
    assert.ok(F.fly && f.calls.oystercatcher >= 1, 'piping as they go');
    watch(w, 30, ctxAt(fx + 10, fz));
    assert.ok(!F.fly && Math.hypot(F.x - fx, F.z - fz) > 10);
  });
});

test('the tide covers the oystercatchers’ sandbank: off they go to dry ground', () => {
  withDice(3, () => {
    const w = W.buildWildlife(new THREE.Scene());
    const F = w.flocks[1], spot = F.S[F.i];
    watch(w, 0.3, ctxAt(spot.x + 300, spot.z, { tideLevel: spot.h + 0.2 }));
    if (F.S.some((p) => p.h > spot.h + 0.3)) assert.ok(F.fly, 'moving off the covered sand');
  });
});

test('cormorants dry their wings; terns only in spring and summer', () => {
  withDice(5, () => {
    const w = W.buildWildlife(new THREE.Scene());
    const C = w.cormorants.find((c) => c.kind === 'perch');
    C.dry = true;
    const r = watch(w, 2, ctxAt(C.x + 50, C.z, { onFoot: false, speed: 0.5 }));
    assert.ok(r.moments.includes('cormorantDry'));
    assert.ok(C.wl.visible && C.wr.visible, 'wings out');
    const t = w.terns[0];
    watch(w, 2, ctxAt(t.H.x, t.H.z, { season: 'winter' }));
    assert.equal(t.g.visible, false, 'gone south for the winter');
    const s = watch(w, 60, ctxAt(t.H.x, t.H.z, { season: 'summer' }));
    assert.ok(t.g.visible && s.seen.tern > 0);
  });
});

test('a seal takes to following a slow boat near its rocks, astern, up and down', () => {
  withDice(13, () => {
    const L = buildSeaLife(new THREE.Scene());
    const H = L.haulouts[0];
    const boat = { pos: new THREE.Vector3(H.x + 150, 0, H.z), fwd: new THREE.Vector3(0, 0, 1), heading: 0 };
    const moments = [];
    L.onMoment = (k) => moments.push(k);
    let follower = null, near = 0;
    for (let i = 0; i < 6000 && !(follower && near > 20); i++) {
      boat.pos.z += 2 * 0.1;
      L.update(0.1, i * 0.1, { from: boat.pos, boat, boatSpeed: 2, daylight: 0.8, region: 'home', eco: null, diving: false });
      follower = L.visitors.find((v) => v.mode === 'follow');
      if (follower && !follower.down && Math.hypot(follower.x - boat.pos.x, follower.z - boat.pos.z) < 22) near++;
    }
    assert.ok(follower, 'one followed');
    assert.ok(near > 20, 'astern of you, up for a look');
    assert.ok(moments.includes('sealFollow'));
    // Open the throttle and it gives up.
    for (let i = 0; i < 30; i++) L.update(0.1, 700 + i * 0.1, { from: boat.pos, boat, boatSpeed: 7, daylight: 0.8, region: 'home', eco: null, diving: false });
    assert.ok(!L.visitors.some((v) => v.mode === 'follow'));
  });
});

test('wildlife in a photograph, and kept with it', () => {
  withDice(17, () => {
    const w = W.buildWildlife(new THREE.Scene());
    const C = w.cormorants.find((c) => c.kind === 'perch');
    watch(w, 1, ctxAt(C.x + 40, C.z, { onFoot: false }));
    C.g.updateMatrixWorld(true);
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    cam.position.set(C.x + 20, C.y + 2, C.z);
    cam.lookAt(C.x, C.y, C.z);
    cam.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    assert.ok(w.inFrame(frustum, cam.position).includes('cormorant'));
    // Turned away: not in it.
    cam.lookAt(C.x + 40, C.y, C.z);
    cam.updateMatrixWorld();
    const away = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    assert.ok(!w.inFrame(away, cam.position).includes('cormorant'));
  });
  const s = sanitize({ photos: [{ id: 'p1abcd', subjects: { species: [], places: [], life: ['otter', 'dragon', 'heron'] } }] });
  assert.deepEqual(s.photos[0].subjects.life, ['otter', 'heron']);
  assert.equal(sanitize({ photos: [{ id: 'p2abcd', subjects: { life: ['dragon'] } }] }).photos[0].subjects.life, undefined);
});
