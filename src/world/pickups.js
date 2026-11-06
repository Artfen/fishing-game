// What the harbour office's calls send you out to (see contracts.js, pickup jobs), out on the water
// where the call said: someone sat on a paddleboard hanging on to an orange pot buoy, or a buoy
// adrift (a yellow mooring buoy with its broken chain's stub of rope). They ride the waves, and go
// when they're aboard (then they're a passenger: passengers.js) or the job's given up.

import * as THREE from 'three';
import { Figure } from './folk.js';
import { lookFor } from './visitors.js';
import { waveHeight } from './water.js';

const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

function personAt(id) {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 3.1), mat('#e8e3d6'));
  board.castShadow = true;
  g.add(board);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.11, 0.18), mat('#2f6f74'));
  g.add(stripe);
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), mat('#e2662a'));
  pot.position.set(0.75, 0.05, 0.9);
  g.add(pot);
  const fig = new Figure(`castaway:${id}`, lookFor(`castaway:${id}`));
  g.add(fig.group);
  return { g, fig, pot };
}

function buoyAt() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), mat('#e8c22a'));
  ball.position.y = 0.2;
  ball.castShadow = true;
  g.add(ball);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 12), mat('#3a3a3a'));
  ring.position.y = 0.74;
  g.add(ring);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), mat('#7a6a4f'));
  rope.position.set(0, -0.3, 0.55);
  rope.rotation.x = 1.2;
  g.add(rope);
  return { g };
}

export class PickupView {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map(); // job id -> { g, fig?, x, z, what, phase }
  }

  // The ones out there now: [{ id, what ('person' | 'buoy'), x, z }].
  sync(list) {
    const want = new Set(list.map((p) => p.id));
    for (const [id, it] of this.items) {
      if (want.has(id)) continue;
      this.scene.remove(it.g);
      this.items.delete(id);
    }
    for (const p of list) {
      if (this.items.has(p.id)) continue;
      const it = p.what === 'person' ? personAt(p.id) : buoyAt();
      Object.assign(it, { x: p.x, z: p.z, what: p.what, phase: (p.x * 0.37 + p.z * 0.11) % 6 });
      this.scene.add(it.g);
      this.items.set(p.id, it);
    }
  }

  get count() { return this.items.size; }

  update(dt, t) {
    for (const it of this.items.values()) {
      const y = waveHeight(it.x, it.z, t);
      it.g.position.set(it.x, y, it.z);
      // (Riding the waves: a little pitch and roll from the slope.)
      const dx = waveHeight(it.x + 1, it.z, t) - y, dz = waveHeight(it.x, it.z + 1, t) - y;
      it.g.rotation.set(-dz * 0.8, it.phase, dx * 0.8);
      if (it.fig) {
        it.fig.update(dt, t, { act: 'sit', pos: { x: 0, z: -0.2 }, yaw: 0 }, 0.05 - 0.42);
        // (One arm out to the pot buoy, now and then a wave.)
        it.fig.arms[1].sh.rotation.set(-1.2 - Math.max(0, Math.sin(t * 1.3 + it.phase) - 0.6) * 2.2, 0, -0.5);
      }
    }
  }
}
