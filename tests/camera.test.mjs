// The camera rig (src/camera.js): in first person the view sits exactly at your eyes once any glide
// from a change of place is over, at every frame rate (it used to trail the eye by 0.2 to 0.4 m at
// speed, more at higher frame rates, which made the helm judder). Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;
const THREE = await import('three');
const { CameraRig } = await import('../src/camera.js');
const { Boat } = await import('../src/boat.js');

test('first person: the view is at the eye at speed, whatever the frame rate', () => {
  for (const fps of [30, 60, 144]) {
    const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 2000);
    const rig = new CameraRig(cam);
    const b = new Boat(new THREE.Scene(), { kind: 'rib' });
    b.place(60, 160, 0);
    rig.init(b);
    const fishing = { busy: false, lineOut: false, state: 'idle', bob: new THREE.Vector3() };
    rig.setFirstPerson(true, 0);
    const eye = new THREE.Vector3(60, 1.6, 160);
    let worst = 0;
    // 18 m/s along z for 4 s (the glide after the change of view is over after 1.4 s).
    for (let i = 0; i < fps * 4; i++) {
      const t = i / fps;
      eye.z = 160 + 18 * t;
      rig.update(1 / fps, t, { boat: b, walker: null, started: true, fishing, baitFocus: null, eye });
      if (t > 2) worst = Math.max(worst, cam.position.distanceTo(eye));
    }
    assert.ok(worst < 0.01, `${fps} fps: ${worst.toFixed(3)} m behind the eye`);
  }
});
