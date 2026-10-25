import * as THREE from 'three';
import { clamp, lerp } from './util.js';

// A rope in the world: an anchor's rode, a mooring line to a jetty, a towline between two boats.
// It's a chain of short round segments (one draw for the lot), laid along a curve from one end
// to the other: straight when it's pulled tight, sagging when it's slack, down into the water and
// along the seabed where it reaches it. Cheap to move every frame; hidden when not in use.

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Rope {
  constructor(scene, { segments = 14, radius = 0.014, color = '#d8c49a' } = {}) {
    this.n = segments;
    this.mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(radius, radius, 1, 5, 1, true), new THREE.MeshLambertMaterial({ color }), segments);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.points = Array.from({ length: segments + 1 }, () => new THREE.Vector3());
  }

  hide() { this.mesh.visible = false; }

  // Lay the rope from a to b. tension 0 … 1 (slack … tight); floor(x, z): the seabed under a
  // point (the rope lies on it rather than through it), or null; sag: how far a slack rope dips
  // at its middle, in metres.
  lay(a, b, { tension = 1, floor = null, sag = 0.6 } = {}) {
    const P = this.points, n = this.n, t = clamp(tension, 0, 1);
    // A hanging rope: the straight line between the ends, dropped in the middle by the slack
    // (a curve close enough to a catenary for a boat's rope).
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = P[i].lerpVectors(a, b, u);
      p.y -= Math.sin(Math.PI * u) * sag * (1 - t);
      if (floor) p.y = Math.max(p.y, floor(p.x, p.z) + 0.04);
    }
    this.place();
  }

  // An anchor's rode: from the bow down to the anchor on the seabed. Slack, most of it lies along
  // the bottom from the anchor and rises steeply to the bow; pulled tight, it runs straight.
  rode(bow, anchor, tension, floor) {
    const P = this.points, n = this.n, t = clamp(tension, 0, 1);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      // How far along the bottom the slack lies: most of the way when slack, none when tight.
      const lie = (1 - t) * 0.7;
      const p = P[i];
      p.x = lerp(anchor.x, bow.x, u);
      p.z = lerp(anchor.z, bow.z, u);
      const rise = u <= lie ? 0 : Math.pow((u - lie) / (1 - lie), 1 + (1 - t) * 1.5);
      p.y = lerp(anchor.y, bow.y, lerp(rise, u, t));
      if (floor) p.y = Math.max(p.y, floor(p.x, p.z) + 0.04);
    }
    this.place();
  }

  place() {
    const P = this.points;
    for (let i = 0; i < this.n; i++) {
      _a.copy(P[i]);
      _b.copy(P[i + 1]);
      const len = _a.distanceTo(_b);
      _s.subVectors(_b, _a);
      _q.setFromUnitVectors(UP, len > 1e-6 ? _s.divideScalar(len) : UP);
      _m.compose(_a.add(_b).multiplyScalar(0.5), _q, _s.set(1, Math.max(len, 1e-3), 1));
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = true;
  }
}
