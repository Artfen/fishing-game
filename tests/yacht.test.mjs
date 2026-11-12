// The sport-fishing yacht rebuilt (fleet A3; docs/FLEET-AUDIT.md, docs/BOAT-ART-DIRECTION.md): a
// sportfisher's hull drawn over her old envelope (her physics exactly as it was), a deep V with
// her topsides flaring out at the bow; a shaped wheelhouse whose roof runs on aft as her hardtop;
// from her helm you see ahead through it (the old box's wall hid everything); walking her deck you
// go round the house by its side decks, not through it; her helm, dashboard, chair, rods and
// outriggers as they were; her livery the Marine Works' and her decks not; within budget; and
// ?classic=cruiser's old drawing still there to compare.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat, HULLS, floatDraft, formHalf } = await import('../src/boat.js');
const { buildHullModel } = await import('../src/hydro.js');

const H = HULLS.cruiser, F = H.form, W = H.wheelhouse;
const hw = (t) => H.B * H.hw(t), sheer = (t) => H.D + H.sheer(t), zAt = (t) => -H.L / 2 + H.L * t;
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
const classic = () => {
  const keep = { form: H.form, wheelhouse: H.wheelhouse };
  Object.assign(H, { form: null, wheelhouse: null });
  try { return new Boat(scene, { kind: 'cruiser' }); } finally { Object.assign(H, keep); }
};
const settle = (b) => {
  b.place(150, 330, 0);
  for (let i = 0; i < 6; i++) b.update(1 / 30, i / 30, 0, 0.4, 0);
  b.group.updateMatrixWorld(true);
  return b;
};

test('her physics is as it was; her hull as drawn flares out at the bow over a deep V', () => {
  const a = buildHullModel(H), b = buildHullModel({ ...H, form: null, wheelhouse: null });
  assert.equal(a.mass, b.mass);
  assert.ok(Math.abs(a.restDraft - b.restDraft) < 1e-12);
  assert.equal(floatDraft(H), a.restDraft);
  // Flare: forward, halfway up her topsides she's well inside her sheer's width; aft, nearly as wide.
  const mid = (t) => (sheer(t) + H.keel(t)) / 2;
  assert.ok(formHalf(H, F, 0.88, mid(0.88)) < 0.75 * hw(0.88), 'flared at the bow');
  assert.ok(formHalf(H, F, 0.3, mid(0.3)) > 0.88 * hw(0.3), 'full aft');
  // A V: low down she's narrow.
  assert.ok(formHalf(H, F, 0.3, H.keel(0.3) + 0.15) < 0.5 * hw(0.3));
});

test('from her helm you see ahead through the wheelhouse (the old box hid it all)', () => {
  const blocked = (b) => {
    settle(b);
    const eye = b.eyePoint(new THREE.Vector3()), q = b.body.getWorldQuaternion(new THREE.Quaternion());
    const own = new Set([...b.selfMats]);
    b.rod?.group?.traverse((o) => o.material && own.add(o.material));
    const solid = meshes(b).filter((m) => !m.material.transparent && !own.has(m.material));
    // (As far as the windscreen, and a little beyond: the bow rail is in your view, as it should be.)
    const far = zAt(W.front) - b.body.worldToLocal(eye.clone()).z + 0.3;
    const ray = new THREE.Raycaster();
    let hits = 0, rays = 0;
    // (Straight ahead, a little to starboard (you stand near the windscreen's starboard corner,
    // its corner post just beyond) and more to port.)
    for (const yaw of [-0.015, 0, 0.02, 0.05]) for (const pitch of [0, 0.02]) {
      ray.set(eye, new THREE.Vector3(Math.sin(yaw), Math.sin(pitch), Math.cos(yaw)).normalize().applyQuaternion(q));
      ray.far = far;
      rays++;
      if (ray.intersectObjects(solid, false).length) hits++;
    }
    return { hits, rays };
  };
  const now = blocked(new Boat(scene, { kind: 'cruiser' })), old = blocked(classic());
  assert.equal(now.hits, 0, `${now.hits} of ${now.rays} lines of sight blocked`);
  assert.equal(old.hits, old.rays, 'the old wheelhouse: every line into its wall');
});

test('walking her deck forward from the helm you go round the house by its side deck, never through it, and back', () => {
  const b = new Boat(scene, { kind: 'cruiser' });
  assert.ok(b.setDeck(true) && b.deck);
  const [c0, c1] = H.cabin, wall = (z) => Math.max(0.12, hw((z + H.L / 2) / H.L) - W.deck);
  let worst = Infinity;
  for (let i = 0; i < 400; i++) {
    b.walkDeck(i < 40 ? -0.03 : 0, 0.04, 1 / 30);
    const t = (b.deck.z + H.L / 2) / H.L;
    if (t > c0 && t < c1) worst = Math.min(worst, Math.abs(b.deck.x) - wall(b.deck.z));
  }
  assert.ok(b.deck.z >= zAt(c1) - 0.01, `up beside the front of the house (z ${b.deck.z.toFixed(2)})`);
  assert.ok(worst > 0.1, `kept ${worst.toFixed(2)} m off the house`);
  // And back aft along the side deck to the cockpit (never stuck at the front of the house).
  for (let i = 0; i < 400; i++) b.walkDeck(0, -0.04, 1 / 30);
  assert.ok(b.deck.z < zAt(c0), `back aft (z ${b.deck.z.toFixed(2)})`);
  // And straight at its back from the cockpit: you step aside along it, not into it.
  b.deck.x = 0;
  b.deck.z = zAt(c0) - 0.3;
  for (let i = 0; i < 60; i++) b.walkDeck(0, 0.04, 1 / 30);
  assert.ok(b.deck.z < zAt(c0) || Math.abs(b.deck.x) > wall(b.deck.z), 'not inside the house');
});

test('her helm, dashboard, chair, rods and outriggers as they were; the hardtop over the helm on its posts', () => {
  const b = new Boat(scene, { kind: 'cruiser' });
  assert.ok(b.wheel && b.dash && b.chair && b.cabinRoof && b.cabinStations.length === 3);
  b.cabinRoof.geometry.computeBoundingBox();
  const bb = b.cabinRoof.geometry.boundingBox, [, hz] = H.standing.helm;
  assert.ok(bb.min.z <= hz - 0.3, `the hardtop reaches back over the helm (${bb.min.z.toFixed(2)})`);
  assert.ok(bb.max.x >= W.hardtop.half - 0.01, 'out to its posts');
  // Standing room in the cabin, and the stations inside it.
  assert.ok(b.cabinRoofY - b.cabinFloor > 1.7);
  for (const s of b.cabinStations) assert.ok(s.z > zAt(H.cabin[0]) && s.z < zAt(H.cabin[1]) && Math.abs(s.x) < 0.3, s.id);
});

test('her livery the Marine Works’, her decks not; the old drawing still there; within budget', () => {
  const b = new Boat(scene, { kind: 'cruiser' });
  const count = (hex, tagged = true) => {
    const c = new THREE.Color(hex);
    let n = 0;
    for (const m of meshes(b)) {
      if (!!m.userData.hull !== tagged || !m.geometry.attributes.color) continue;
      const a = m.geometry.attributes.color.array;
      for (let i = 0; i < a.length; i += 3) {
        const k = (a[i] * c.r + a[i + 1] * c.g + a[i + 2] * c.b) / (c.r * c.r + c.g * c.g + c.b * c.b);
        if (k > 0.88 && k < 1.12 && Math.abs(a[i] - k * c.r) + Math.abs(a[i + 1] - k * c.g) + Math.abs(a[i + 2] - k * c.b) < 0.02) n++;
      }
    }
    return n;
  };
  const paint0 = count(H.paint), stripe0 = count(H.stripe), decks0 = count('#dcd8cc', false);
  assert.ok(paint0 > 1000 && stripe0 > 200 && decks0 > 100, `${paint0} painted, ${stripe0} striped, ${decks0} deck`);
  b.repaint('#2f6a4f');
  b.restripe('#c0392b');
  assert.ok(count('#2f6a4f') >= paint0 * 0.98 && count('#c0392b') >= stripe0 * 0.98);
  assert.equal(count('#dcd8cc', false), decks0, 'her decks stay their colour');
  const old = classic();
  assert.ok(old.cabinPanes && !old.cabinMesh);
  let tris = 0;
  const ms = meshes(b);
  for (const m of ms) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  assert.ok(tris <= 20000, `${tris} triangles`);
});
