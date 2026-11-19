// Lamps, and the few real lights that light them (docs/PERFORMANCE.md, "Stutter").
//
// three.js builds each lit material's shader for the number of point lights it counts, and it
// counts only lights in visible parts of the scene. So whenever a lamp's boat, house or cabin was
// shown or hidden, the count changed and every lit material in view was rebuilt at once: 65 shader
// programs the moment the cabin boat came into play, a freeze of seconds on a PC (worst on
// Windows, where each shader is translated for DirectX).
//
// So a lamp (a cabin's, a lantern's, a jetty's, a window's) is not a light. It's a Lamp: where a
// light would be, and what it would be (colour, intensity, distance, decay), set just as a light
// was. The scene has a fixed number of real point lights (LampPool), lent each frame to the lamps
// that are lit and shown, nearest first. The count never changes, so nothing is rebuilt; with as
// many lights as lamps are ever lit in view (POOL), it looks as it did.

import * as THREE from 'three';

export const POOL = 12;
const LAMPS = new Set();

export class Lamp extends THREE.Object3D {
  constructor(color = '#ffffff', intensity = 1, distance = 0, decay = 2) {
    super();
    this.isLamp = true;
    this.color = new THREE.Color(color);
    this.intensity = intensity;
    this.distance = distance;
    this.decay = decay;
    LAMPS.add(this);
  }
  // (Gone for good: no longer lent a light.)
  dispose() {
    LAMPS.delete(this);
  }
}

// Shown: it and everything it hangs from visible, all the way up to this scene.
function shown(o, scene) {
  for (let p = o; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === scene) return true;
  }
  return false;
}

const _p = new THREE.Vector3();
export class LampPool {
  constructor(scene, n = POOL) {
    this.scene = scene;
    this.lights = [];
    this.lit = 0; // (lamps lit and shown last frame: if ever more than the pool, the nearest win)
    for (let i = 0; i < n; i++) {
      const L = new THREE.PointLight('#ffffff', 0, 1, 2);
      L.name = `lamp light ${i}`;
      scene.add(L);
      this.lights.push(L);
    }
    this.picked = [];
  }

  // Lend the lights to the lit lamps that are shown, nearest the camera first (by how far their
  // light falls short of it: a big lamp a little further off before a small one just beside you).
  update(camera) {
    const C = camera.position, picked = this.picked;
    picked.length = 0;
    for (const L of LAMPS) {
      if (!(L.intensity > 0) || !shown(L, this.scene)) continue;
      L.getWorldPosition(_p);
      picked.push({ L, x: _p.x, y: _p.y, z: _p.z, d: Math.hypot(_p.x - C.x, _p.y - C.y, _p.z - C.z) - (L.distance || 0) });
    }
    this.lit = picked.length;
    if (picked.length > this.lights.length) picked.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.lights.length; i++) {
      const R = this.lights[i], P = picked[i];
      if (!P) {
        R.intensity = 0;
        continue;
      }
      R.position.set(P.x, P.y, P.z);
      R.color.copy(P.L.color);
      R.intensity = P.L.intensity;
      R.distance = P.L.distance;
      R.decay = P.L.decay;
    }
  }
}

// (For the tests: every lamp there is.)
export const allLamps = () => [...LAMPS];
