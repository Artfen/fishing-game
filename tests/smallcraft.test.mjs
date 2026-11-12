// The small craft (fleet A4; docs/FLEET-AUDIT.md, docs/BOAT-ART-DIRECTION.md): the jet ski drawn as
// a jet ski (a deep-V hull under a moulded deck top: hood, saddle, footwells, swim platform) over
// her old envelope, so her physics is exactly as it was, her rider's feet in her footwells and
// hands on her grips, her colours the Marine Works'; the rowing boat and the skiff clinker-built
// (the lands of their planks, a stem band, the skiff's motor board); all within budget; and
// ?classic=jetski,row,skiff's old drawings still there to compare.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat, HULLS, floatDraft } = await import('../src/boat.js');
const { buildHullModel } = await import('../src/hydro.js');

const scene = new THREE.Scene();
const meshes = (b) => {
  const out = [];
  b.group.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    out.push(o);
  });
  return out;
};
const as = (kind, over) => {
  const H = HULLS[kind], keep = Object.fromEntries(Object.keys(over).map((k) => [k, H[k]]));
  Object.assign(H, over);
  try { return new Boat(scene, { kind }); } finally { Object.assign(H, keep); }
};
const settle = (b) => {
  b.place(150, 330, 0);
  for (let i = 0; i < 8; i++) b.update(1 / 30, i / 30, 0, 0.4, 0);
  b.group.updateMatrixWorld(true);
  return b;
};
const count = (b, hex) => {
  const c = new THREE.Color(hex);
  let n = 0;
  for (const m of meshes(b)) {
    if (!m.userData.hull) continue;
    const a = m.geometry.attributes.color.array;
    for (let i = 0; i < a.length; i += 3) {
      const k = (a[i] * c.r + a[i + 1] * c.g + a[i + 2] * c.b) / (c.r * c.r + c.g * c.g + c.b * c.b);
      if (k > 0.88 && k < 1.12 && Math.abs(a[i] - k * c.r) + Math.abs(a[i + 1] - k * c.g) + Math.abs(a[i + 2] - k * c.b) < 0.02) n++;
    }
  }
  return n;
};
const tris = (b) => meshes(b).reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);

test('the jet ski: her physics as it was; her deck top within her; your feet in her footwells and your hands on her grips', () => {
  const H = HULLS.jetski, hw = (t) => H.B * H.hw(t), sheer = (t) => H.D + H.sheer(t);
  const a = buildHullModel(H), o = buildHullModel({ ...H, form: null });
  assert.equal(a.mass, o.mass);
  assert.ok(Math.abs(a.restDraft - o.restDraft) < 1e-12);
  assert.equal(floatDraft(H), a.restDraft);
  const b = settle(new Boat(scene, { kind: 'jetski' }));
  // Her deck top (hood, saddle, footwells, platform, bumper): nothing out beyond her sides.
  const fit = meshes(b).find((m) => m.userData.hull && m.material.side === THREE.DoubleSide);
  assert.ok(fit, 'a deck top');
  const p = fit.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = (v.z + H.L / 2) / H.L;
    if (t < 0 || t > 1) continue;
    assert.ok(Math.abs(v.x) <= hw(t) + 0.05, `${v.x.toFixed(2)} out at t ${t.toFixed(2)}`);
  }
  // Your feet down in the footwells, either side of the saddle, on the mats; your hands on the grips.
  b.body.updateMatrixWorld(true);
  assert.ok(b.legs.length === 2);
  for (const L of b.legs) {
    const f = b.body.worldToLocal(L.boot.getWorldPosition(new THREE.Vector3()));
    const t = (f.z + H.L / 2) / H.L;
    assert.ok(Math.abs(f.x) > 0.21 && Math.abs(f.x) < hw(t) - 0.09, `foot at x ${f.x.toFixed(2)}`);
    assert.ok(Math.abs(f.y - (sheer(t) - 0.02)) < 0.12, `foot ${(f.y - sheer(t)).toFixed(2)} from her footwell`);
  }
  const G = H.grip;
  for (const arm of b.arms) {
    const want = b.wheel.localToWorld(new THREE.Vector3(arm.s > 0 ? G[0] : -G[0], G[1], 0));
    assert.ok(arm.hand.getWorldPosition(new THREE.Vector3()).distanceTo(want) < 0.05, 'a hand on a grip');
  }
});

test('the jet ski: her deck top in her accent colour and her hull in her paint, both the Marine Works’ to change', () => {
  const H = HULLS.jetski, b = new Boat(scene, { kind: 'jetski' });
  const paint0 = count(b, H.paint), stripe0 = count(b, H.stripe);
  assert.ok(paint0 > 300 && stripe0 > 1500, `${paint0} painted, ${stripe0} in her accent`);
  b.restripe('#2e8b57');
  b.repaint('#1f3b56');
  assert.equal(count(b, H.stripe), 0);
  assert.ok(count(b, '#2e8b57') >= stripe0 * 0.98 && count(b, '#1f3b56') >= paint0 * 0.98);
});

test('the rowing boat and the skiff: clinker lands along both sides above her bottom paint, a stem band; the skiff’s motor board', () => {
  for (const kind of ['row', 'skiff']) {
    const H = HULLS[kind], b = new Boat(scene, { kind }), old = as(kind, { planked: false });
    const lands = (boat) => count(boat, '#3b3330');
    assert.ok(lands(b) > lands(old) + 150, `${kind}: ${lands(b)} land vertices (old ${lands(old)})`);
    // (Both sides, all of it above her boot-top.)
    const boot = floatDraft(H) + 0.06, c = new THREE.Color('#3b3330');
    // (The lands: the dark lines out on her topsides, from 2 cm under her sheer down.)
    let port = 0, star = 0;
    const hw = (t) => H.B * H.hw(t), sheer = (t) => H.D + H.sheer(t);
    for (const m of meshes(b)) {
      if (!m.userData.hull) continue;
      const col = m.geometry.attributes.color, pos = m.geometry.attributes.position;
      for (let i = 0; i < col.count; i++) {
        if (Math.abs(col.getX(i) - c.r) > 0.04 || Math.abs(col.getY(i) - c.g) > 0.04 || Math.abs(col.getZ(i) - c.b) > 0.04) continue;
        const t = (pos.getZ(i) + H.L / 2) / H.L;
        if (pos.getY(i) > sheer(t) - 0.02 || Math.abs(pos.getX(i)) < hw(t) * 0.5) continue;
        assert.ok(pos.getY(i) > boot, `${kind}: a land below her boot-top`);
        if (pos.getX(i) > 0) port++;
        else star++;
      }
    }
    assert.ok(port > 50 && star > 50, `${kind}: ${port} port, ${star} starboard`);
    assert.ok(tris(b) <= 12000);
  }
  // The skiff's outboard clamps to her motor board, at her transom's middle.
  const s = new Boat(scene, { kind: 'skiff' });
  assert.ok(Math.abs(s.motorGroups[0].position.x) < 0.05);
});

test('the jet ski within budget; the old drawings still built by ?classic', () => {
  const b = new Boat(scene, { kind: 'jetski' }), old = as('jetski', { form: null });
  assert.ok(tris(b) <= 12000 && meshes(b).length <= 40, `${tris(b)} triangles, ${meshes(b).length} meshes`);
  const deckTop = (boat) => meshes(boat).some((m) => m.userData.hull && m.material.roughness === 0.3 && m.material.side === THREE.DoubleSide);
  assert.ok(deckTop(b) && !deckTop(old), 'the old jet ski: no deck top');
});
