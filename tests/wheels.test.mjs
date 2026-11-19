// A wheel faces the one steering her: its face raked back to look up at your eyes, its top leaning
// away towards the dash (as a helm's wheel is set on a console), so from where you stand or sit you
// see its rim round, not edge on; your hands on it; its rim clear of you. (The yacht's, the bass
// boat's and the trawler's, in her pilothouse. The RIB's and the console boat's are kept low and back, clear of their dashboards'
// switches, which a wheel raked back on those consoles would hide: see buildWheel.)
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat, HULLS } = await import('../src/boat.js');

const scene = new THREE.Scene();
const settle = (b, n = 30, t0 = 0) => {
  for (let i = 0; i < n; i++) b.update(1 / 30, t0 + i / 30, 0, 0, 0);
  b.group.updateMatrixWorld(true);
  return b;
};

test('the yacht’s, the bass boat’s and the trawler’s wheels face your eyes at her helm, their tops leaning away from you; your hands on them', () => {
  // (Every boat steered by a wheel, but the jet ski, whose handlebars are hers.)
  const kinds = Object.keys(HULLS).filter((k) => k !== 'jetski' && new Boat(scene, { kind: k }).wheel);
  assert.deepEqual(kinds.sort(), ['bass', 'console', 'cruiser', 'rib', 'trawler']);
  for (const kind of ['cruiser', 'bass', 'trawler']) {
    const b = new Boat(scene, { kind });
    b.place(150, 330, 0);
    settle(b);
    const w = b.wheel, eye = b.body.worldToLocal(b.eyePoint(new THREE.Vector3()));
    const face = new THREE.Vector3(0, 0, 1).applyEuler(w.rotation), up = new THREE.Vector3(0, 1, 0).applyEuler(w.rotation);
    const toEye = eye.clone().sub(w.position);
    const on = Math.abs(face.dot(toEye.clone().normalize()));
    assert.ok(on > 0.8, `${kind}: its face ${on.toFixed(2)} on to your eyes`);
    // Its top leans forward, away from you (you're aft of it).
    assert.ok(toEye.z < 0 && up.z > 0.3, `${kind}: its top leans ${up.z > 0 ? 'away' : 'towards you'} (${up.z.toFixed(2)})`);
    // Your hands on its rim.
    const G = b.hull.grip || [0.17, 0.06];
    for (const arm of b.arms) {
      const want = w.localToWorld(new THREE.Vector3(arm.s > 0 ? G[0] : -G[0], G[1], 0));
      assert.ok(arm.hand.getWorldPosition(new THREE.Vector3()).distanceTo(want) < 0.03, `${kind}: a hand on the wheel`);
    }
    // Its rim's lowest point is still ahead of where you are, a hand's breadth or more.
    const low = w.position.clone().addScaledVector(up, -0.19 * w.scale.y);
    const you = b.hull.standing ? b.hull.standing.helm[1] : b.seatZ;
    assert.ok(low.z - you > 0.1, `${kind}: the rim's foot ${(low.z - you).toFixed(2)} m ahead of you`);
  }
});

test('from your eyes at the RIB’s and the console boat’s helms, no switch of their dashboards is behind the wheel', () => {
  for (const kind of ['rib', 'console']) {
    const b = new Boat(scene, { kind });
    b.place(150, 330, 0);
    settle(b);
    const eye = b.eyePoint(new THREE.Vector3()), wheel = [], ray = new THREE.Raycaster();
    b.wheel.traverse((o) => o.isMesh && wheel.push(o));
    for (const [id, c] of b.dash.controls) {
      const P = c.hit.geometry.parameters;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        const p = c.hit.localToWorld(new THREE.Vector3((i / 4 - 0.5) * P.width, 0, (j / 4 - 0.5) * P.depth));
        const d = p.clone().sub(eye);
        ray.set(eye, d.clone().normalize());
        ray.far = d.length() - 0.005;
        assert.equal(ray.intersectObjects(wheel, false).length, 0, `${kind}: the ${id} behind the wheel`);
      }
    }
  }
});
