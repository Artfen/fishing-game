// The bass boat rebuilt (fleet A1; docs/FLEET-AUDIT.md, docs/BOAT-ART-DIRECTION.md): a hard-chined
// planing V drawn over her physics envelope, so her physics is exactly as it was; nothing of her
// cockpit, consoles or seats through her skin; you at the wheel of her console, no tiller on her
// outboard, on a jack plate; her paint and stripe still the Marine Works' to change; her decks
// where you stand on them; and her drawing within the art direction's budget.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat, HULLS, floatDraft, formHalf, formRows } = await import('../src/boat.js');
const { buildHullModel } = await import('../src/hydro.js');
const { deckY } = await import('../src/trollmount.js');

const H = HULLS.bass, F = H.form;
const hw = (t) => H.B * H.hw(t), sheer = (t) => H.D + H.sheer(t);
const tOf = (z) => (z + H.L / 2) / H.L;
const scene = new THREE.Scene();
// (What's drawn of her: meshes shown, and everything above them shown too.)
const meshes = (b) => {
  const out = [];
  b.group.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    out.push(o);
  });
  return out;
};

test('her physics is as it was: built from her envelope, never from how she is drawn', () => {
  // (A copy with no drawing of her own and her old seat: the same hull model, to the gram.)
  const plain = { ...H, form: null, seatX: 0, seatZ: -1.55, seatY: 0.78 };
  const a = buildHullModel(H), b = buildHullModel(plain);
  assert.equal(a.mass, b.mass);
  assert.ok(Math.abs(a.restDraft - b.restDraft) < 1e-12);
  assert.equal(floatDraft(H), a.restDraft);
  // Drawn over that envelope: her gunwale at her half-beam and sheer, her keel on her keel line
  // (forward of the forefoot, which the raked stem cuts back).
  const rows = formRows(H, F);
  for (const row of rows) {
    const z = row[0][2], t = tOf(z), keel = row[(row.length - 1) / 2];
    assert.ok(Math.abs(row[0][0] - hw(t)) < 1e-9 && Math.abs(row[0][1] - sheer(t)) < 1e-9, `gunwale at t ${t.toFixed(2)}`);
    assert.ok(Math.abs(row.at(-1)[0] + hw(t)) < 1e-9, 'the other gunwale');
    if (t < 0.84) assert.ok(Math.abs(keel[1] - H.keel(t)) < 1e-9 && keel[0] === 0, `keel at t ${t.toFixed(2)}`);
  }
  // A real planing hull: a hard chine above the waterline aft, rising forward.
  const wl = floatDraft(H), chine = (t) => {
    const w = hw(t), rise = F.rise[0];
    return H.keel(t) + rise * (w * F.chine - F.pad);
  };
  assert.ok(chine(0.05) > wl && chine(0.05) < wl + 0.1, `chine aft ${chine(0.05).toFixed(3)} over a waterline of ${wl.toFixed(3)}`);
});

test('nothing of her cockpit, seats or consoles comes through her skin', () => {
  const b = new Boat(scene, { kind: 'bass' });
  let checked = 0;
  const bad = [];
  for (const m of meshes(b)) {
    if (m.userData.hull && m.material.side === THREE.DoubleSide) continue; // (her shell itself)
    if (!m.geometry.attributes.color || m.parent !== b.body) continue; // (merged fit-out and carpet only)
    m.updateMatrix();
    const p = m.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrix);
      const t = tOf(v.z);
      // (Her gunwale's cap, strake and cleats are on her sheer, outside by design; her transom's
      // jack plate and her stem's eye at her ends.)
      if (t < 0.02 || t > 0.9 || v.y > sheer(t) - 0.06) continue;
      checked++;
      const half = formHalf(H, F, t, v.y);
      if (Math.abs(v.x) > half + 0.004) bad.push(`${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)} > ${half.toFixed(2)}`);
    }
  }
  assert.ok(checked > 500, `${checked} points checked`);
  assert.equal(bad.length, 0, `${bad.length} points outside her: ${bad.slice(0, 4).join(' · ')}`);
});

test('you at the wheel of her console, to starboard; no tiller on her outboard, set back on a jack plate', () => {
  const b = new Boat(scene, { kind: 'bass' });
  b.place(150, 330, 0);
  for (let i = 0; i < 6; i++) b.update(1 / 30, i / 30, 0, 0.4, 0);
  assert.ok(b.wheel, 'a wheel');
  assert.ok(H.seatX < -0.3 && b.torso.position.x === H.seatX, 'sat to starboard, behind it');
  b.body.updateMatrixWorld(true);
  const G = H.grip || [0.17, 0.06];
  for (const a of b.arms) {
    const want = b.wheel.localToWorld(new THREE.Vector3(a.s > 0 ? G[0] : -G[0], G[1], 0));
    assert.ok(a.hand.getWorldPosition(new THREE.Vector3()).distanceTo(want) < 0.02, 'a hand on the wheel');
  }
  // The outboard: nothing of it reaching forward over her transom (a tiller would, 0.6 m), and
  // it on the jack plate, aft of where it'd clamp.
  const g = b.motorGroups[0], geo = b.motorMeshes[0].geometry;
  geo.computeBoundingBox();
  assert.ok(geo.boundingBox.max.z < 0.2, `the outboard reaches ${geo.boundingBox.max.z.toFixed(2)} m forward of its mount: a tiller`);
  assert.ok(Math.abs(g.position.z - (-H.L / 2 - 0.04 - F.jack)) < 1e-9);
  // Your eyes and your rod where you sit.
  const eye = b.body.worldToLocal(b.eyePoint(new THREE.Vector3()));
  assert.ok(Math.abs(eye.x - H.seatX) < 0.05 && eye.y > 1.3 && eye.y < 1.7);
});

test('her paint and her stripe stay the Marine Works’ to change: hull, consoles and piping', () => {
  const b = new Boat(scene, { kind: 'bass' });
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
  assert.ok(paint0 > 1000 && stripe0 > 300, `${paint0} painted, ${stripe0} striped`);
  b.repaint('#2f4f7a');
  assert.equal(count(H.paint), 0, 'none of the old paint left');
  assert.ok(count('#2f4f7a') >= paint0 * 0.98, 'all of it in the new');
  b.restripe('#e8b440');
  assert.ok(count('#e8b440') >= stripe0 * 0.98, 'her stripe and piping in the new colour');
});

test('her decks where you stand on them, and her drawing within the fleet’s budget', () => {
  const b = new Boat(scene, { kind: 'bass' });
  // (Her casting decks as drawn: her sheer less the drop; deckY, which the trolling motor's plate,
  // stepping aboard and crew go by, says the same.)
  for (const z of [-2.0, -1.6, 0.6, 1.2, 1.9]) assert.ok(Math.abs(deckY(H, z) - (sheer(tOf(z)) - 0.045)) < 1e-9, `deck at ${z}`);
  assert.equal(deckY(H, -0.5), H.floorY, 'the cockpit sole between');
  // Drawn: no more than the art direction allows a small boat (docs/BOAT-ART-DIRECTION.md).
  let tris = 0;
  const ms = meshes(b);
  for (const m of ms) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  assert.ok(ms.length <= 32, `${ms.length} meshes`);
  assert.ok(tris <= 12000, `${tris} triangles`);
});
