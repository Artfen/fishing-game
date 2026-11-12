// The cabin boat rebuilt (fleet A2; docs/FLEET-AUDIT.md, docs/BOAT-ART-DIRECTION.md): a little
// wooden wheelhouse launch drawn over her old envelope, so her physics is exactly as it was; the
// house within her, standing room inside it, her cabin as it was to live in; real glass, so from
// her tiller you see ahead through the house (the old cuddy's wall hid everything); her livery the
// Marine Works' to change; her screens and floodlights on the house; her drawing within budget;
// and ?classic=cabin's old cuddy still there to compare.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat, HULLS, floatDraft } = await import('../src/boat.js');
const { buildHullModel } = await import('../src/hydro.js');

const H = HULLS.cabin;
const hw = (t) => H.B * H.hw(t), sheer = (t) => H.D + H.sheer(t), zAt = (t) => -H.L / 2 + H.L * t, tOf = (z) => (z + H.L / 2) / H.L;
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
// (A cabin boat built as she was: her old cuddy, for comparison.)
const classic = () => {
  const keep = { wheelhouse: H.wheelhouse, decks: H.decks };
  Object.assign(H, { wheelhouse: null, decks: null });
  try { return new Boat(scene, { kind: 'cabin' }); } finally { Object.assign(H, keep); }
};
const settle = (b) => {
  b.place(150, 330, 0);
  for (let i = 0; i < 6; i++) b.update(1 / 30, i / 30, 0, 0.4, 0);
  b.group.updateMatrixWorld(true);
  return b;
};

test('her physics is as it was: built from her envelope, never from how she is drawn', () => {
  const a = buildHullModel(H), b = buildHullModel({ ...H, wheelhouse: null, decks: null });
  assert.equal(a.mass, b.mass);
  assert.ok(Math.abs(a.restDraft - b.restDraft) < 1e-12);
  assert.equal(floatDraft(H), a.restDraft);
});

test('the house within her, standing room inside it, and her cabin as it was to live in', () => {
  const b = new Boat(scene, { kind: 'cabin' });
  assert.ok(b.cabinMesh && b.cabinRoof && b.cabinDoor, 'the wheelhouse');
  // Nothing of the house, its roofs or her fittings outside her (bar a cleat on her capping).
  const v = new THREE.Vector3();
  let n = 0;
  for (const m of [b.cabinMesh, b.cabinRoof]) {
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const t = tOf(v.z);
      if (t < 0.01 || t > 0.99) continue;
      n++;
      assert.ok(Math.abs(v.x) <= hw(t) + 0.04, `${v.x.toFixed(2)} out at t ${t.toFixed(2)} (half-beam ${hw(t).toFixed(2)})`);
    }
  }
  assert.ok(n > 2000);
  // Standing room, and the stations on the boards inside the house.
  assert.ok(b.cabinRoofY - b.cabinFloor > 1.7);
  const [t0, t1] = H.cabin;
  for (const s of b.cabinStations) assert.ok(s.z > zAt(t0) + 0.2 && s.z < zAt(t1) && Math.abs(s.x) < 0.3, s.id);
  // Its door opens and shuts; the roof lifts away to look in; the lamp lights it after dark, and
  // glows in its glass.
  b.setCabin({ open: 1, roof: false });
  for (let i = 0; i < 60; i++) b.update(1 / 30, i / 30, 0, 0.4, 0);
  assert.ok(Math.abs(b.cabinDoor.rotation.y) > 1.4 && !b.cabinRoof.visible);
  b.setCabin({ open: 0, roof: true });
  b.setCabinLight(1, false);
  assert.ok(b.cabinLight.intensity > 0.5 && b.cabinGlass.material.emissiveIntensity > 0.5);
  b.setCabinLight(0, false);
  assert.equal(b.cabinGlass.material.emissiveIntensity, 0);
});

test('from her tiller you see ahead, through the house: glass, not a wall (the old cuddy hid it all)', () => {
  // A fan of rays from your eyes, straight ahead and a little either side and up: what solid part
  // of her each meets first (her glass is clear; your own body and rod don't count).
  const blocked = (b) => {
    settle(b);
    const eye = b.eyePoint(new THREE.Vector3()), q = b.body.getWorldQuaternion(new THREE.Quaternion());
    const own = new Set([...b.selfMats]);
    b.rod?.group?.traverse((o) => o.material && own.add(o.material));
    const solid = meshes(b).filter((m) => !m.material.transparent && !own.has(m.material));
    const ray = new THREE.Raycaster();
    let hits = 0, rays = 0;
    for (const yaw of [-0.04, 0, 0.04]) for (const pitch of [0, 0.03]) {
      const dir = new THREE.Vector3(Math.sin(yaw), Math.sin(pitch), Math.cos(yaw)).normalize().applyQuaternion(q);
      ray.set(eye, dir);
      ray.far = 12;
      rays++;
      if (ray.intersectObjects(solid, false).length) hits++;
    }
    return { hits, rays };
  };
  const now = blocked(new Boat(scene, { kind: 'cabin' })), old = blocked(classic());
  assert.equal(now.hits, 0, `${now.hits} of ${now.rays} lines of sight blocked`);
  assert.equal(old.hits, old.rays, 'the old cuddy: every line ahead into its wall');
});

test('her livery the Marine Works’ to change: topsides, the sheer stripe and the boot-top', () => {
  const b = new Boat(scene, { kind: 'cabin' });
  const count = (hex) => {
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
  const paint0 = count(H.paint), stripe0 = count(H.stripe);
  assert.ok(paint0 > 500 && stripe0 > 400, `${paint0} painted, ${stripe0} striped`);
  b.restripe('#e8b440');
  assert.equal(count(H.stripe), 0);
  assert.ok(count('#e8b440') >= stripe0 * 0.98, 'her stripe and boot-top in the new colour');
  b.repaint('#2f4f7a');
  assert.ok(count('#2f4f7a') >= paint0 * 0.98);
});

test('her screens on the back of the house, her floodlights under its roof; the old cuddy as it was; within budget', () => {
  const b = new Boat(scene, { kind: 'cabin' });
  b.setFits(['sonar', 'plotter', 'lights']);
  const zb = zAt(H.cabin[0]), p = b.fitGroup.children[0].geometry.attributes.position, v = new THREE.Vector3();
  let onHouse = 0, loose = 0;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (v.y < 0.5) continue; // (the sounder's transducer, under her)
    if (v.z > zb - 0.3 && v.z < zb + 0.001) onHouse++;
    else loose++;
  }
  assert.ok(onHouse > 50 && loose === 0, `${onHouse} on the house, ${loose} elsewhere`);
  // ?classic=cabin: her old cuddy (its panes lit from inside), for judging the new one against.
  const old = classic();
  assert.ok(old.cabinPanes && !old.cabinMesh);
  // Drawn: no more than a small boat's allowance (docs/BOAT-ART-DIRECTION.md).
  let tris = 0;
  const ms = meshes(b);
  for (const m of ms) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  assert.ok(ms.length <= 40, `${ms.length} meshes`);
  assert.ok(tris <= 12000, `${tris} triangles`);
});
