// The fleet made consistent (fleet A5; docs/FLEET-AUDIT.md, docs/BOAT-ART-DIRECTION.md): every
// outboard's shell shaped like one (a rounded cowling on its pan, a streamlined leg, the plate, a
// torpedo gearcase) inside the old box's envelope, so nothing mounted on it moves; and boats far
// off drawn without their small parts (boat.js DETAIL), given back whole as they come near,
// drawing only: nothing a boat does, nor what the game shows or hides of her, is touched.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat, BOAT_KINDS, DETAIL, boatDetail } = await import('../src/boat.js');

const scene = new THREE.Scene();
const drawn = (b) => {
  const out = [];
  b.group.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    if (o.layers.mask) out.push(o);
  });
  return out;
};

test('every outboard shaped like one, inside the old box’s envelope: nothing mounted on it moves', () => {
  let n = 0;
  for (const kind of BOAT_KINDS) {
    const b = new Boat(scene, { kind });
    if (!b.motorMeshes?.length) continue;
    n++;
    const g = b.outboardGeo(), bb = new THREE.Box3().setFromBufferAttribute(g.attributes.position);
    // (The old shell: 0.31 wide; from the skeg's foot at -1.02 up to the cowling's top at 0.39,
    // and from the cowling's back at -0.335 forward; the tiller further, where there is one.)
    assert.ok(bb.max.x <= 0.16 && bb.min.x >= -0.16, `${kind}: ${bb.min.x.toFixed(2)}…${bb.max.x.toFixed(2)} across`);
    assert.ok(bb.min.y >= -1.03 && bb.max.y <= 0.4 + 1e-6, `${kind}: ${bb.min.y.toFixed(2)}…${bb.max.y.toFixed(2)} high`);
    assert.ok(bb.min.z >= -0.4, `${kind}: back to ${bb.min.z.toFixed(2)}`);
    // (No further forward than the clamp, but for a tiller: the cowling's front at its front.)
    const H = b.hull;
    if (H.console || H.form?.wheel) assert.ok(bb.max.z < 0.2, `${kind}: forward to ${bb.max.z.toFixed(2)}`);
    const cowlFront = new THREE.Box3().setFromBufferAttribute(g.attributes.position);
    assert.ok(cowlFront.max.y > 0.3, `${kind}: a cowling on top`);
    // A V6's taller cowling, taller.
    const tall = new THREE.Box3().setFromBufferAttribute(b.outboardGeo({ tall: 1.25 }).attributes.position);
    assert.ok(tall.max.y > bb.max.y + 0.05);
  }
  assert.ok(n >= 6, `${n} outboard boats`);
});

test('far off, a boat drops her small parts (her hull and other big ones stay); near again, she’s whole, every part on its own layers', () => {
  for (const kind of ['cruiser', 'console', 'rib', 'cabin', 'skiff']) {
    const b = new Boat(scene, { kind });
    b.place(0, 0, 0);
    b.update(1 / 30, 0, 0, 0.4, 0);
    b.group.updateMatrixWorld(true);
    const masks = new Map();
    b.group.traverse((o) => o.isMesh && masks.set(o, o.layers.mask));
    const all = drawn(b).length;
    assert.equal(b.detailFor({ x: 20, y: 5, z: 0 }), 0);
    assert.equal(drawn(b).length, all, `${kind}: whole near`);
    assert.equal(b.detailFor({ x: DETAIL.near + 20, y: 5, z: 0 }), 1);
    const mid = drawn(b);
    assert.equal(b.detailFor({ x: DETAIL.far + 30, y: 5, z: 0 }), 2);
    const far = drawn(b);
    assert.ok(mid.length < all && far.length < mid.length, `${kind}: ${all} → ${mid.length} → ${far.length}`);
    assert.ok(far.some((m) => m.userData.hull), `${kind}: her hull still drawn`);
    b.detailFor({ x: 10, y: 5, z: 0 });
    b.group.traverse((o) => o.isMesh && assert.equal(o.layers.mask, masks.get(o), `${kind}: a part back on its own layers`));
    assert.equal(drawn(b).length, all);
  }
});

test('it holds at the line (no flicker), leaves other scenes’ boats alone, and changes nothing she does', () => {
  const b = new Boat(scene, { kind: 'console' });
  b.place(0, 0, 0);
  b.update(1 / 30, 0, 0, 0.4, 0);
  // (Either side of the line by less than its slack: no change.)
  b.detailFor({ x: DETAIL.near + DETAIL.slack + 1, y: 0, z: 0 });
  assert.equal(b.detailTier, 1);
  assert.equal(b.detailFor({ x: DETAIL.near - DETAIL.slack + 1, y: 0, z: 0 }), 1);
  assert.equal(b.detailFor({ x: DETAIL.near - DETAIL.slack - 1, y: 0, z: 0 }), 0);
  // A boat in another scene (the Marine Works' preview has its own) isn't touched.
  const other = new THREE.Scene(), p = new Boat(other, { kind: 'rib' });
  p.place(0, 0, 0);
  boatDetail({ x: 500, y: 0, z: 0 }, scene);
  assert.ok(!p.detailTier);
  // Nothing of her state moves.
  const before = JSON.stringify([b.pos, b.vel, b.heading, b.lever]);
  b.detailFor({ x: 400, y: 0, z: 0 });
  assert.equal(JSON.stringify([b.pos, b.vel, b.heading, b.lever]), before);
});
