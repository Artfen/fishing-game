import * as THREE from 'three';
import { mergeParts, mat } from './util.js';
import { withSurface } from './world/surface.js';

// A fuel pump (at home, and on Willowhaven quay): a red cabinet on a plinth with a dial window,
// a hose looped to the nozzle in its holster, and a sign on top. Parts for mergeParts, placed at
// (x, y, z) facing yaw.
export function fuelPumpParts(x, y, z, yaw) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  const at = (u, h, w, rx = 0, ry = 0, rz = 0) => mat(x + u * c + w * s, y + h, z - u * s + w * c, rx, yaw + ry, rz);
  return [
    { geo: new THREE.BoxGeometry(0.7, 0.12, 0.55), matrix: at(0, 0.06, 0), color: '#a9a69e' },
    { geo: new THREE.BoxGeometry(0.52, 1.25, 0.4), matrix: at(0, 0.74, 0), color: '#b8312f' },
    { geo: new THREE.BoxGeometry(0.36, 0.22, 0.02), matrix: at(0, 1.05, 0.21), color: '#e8e4da' },
    { geo: new THREE.BoxGeometry(0.4, 0.06, 0.03), matrix: at(0, 0.82, 0.21), color: '#2b2e33' },
    { geo: new THREE.BoxGeometry(0.58, 0.26, 0.12), matrix: at(0, 1.5, 0), color: '#f1ece2' },
    { geo: new THREE.BoxGeometry(0.6, 0.06, 0.14), matrix: at(0, 1.39, 0), color: '#b8312f' },
    // The holster and nozzle on the side, the hose looping down from the top.
    { geo: new THREE.BoxGeometry(0.06, 0.14, 0.12), matrix: at(0.29, 0.86, 0.05), color: '#2b2e33' },
    { geo: new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), matrix: at(0.33, 0.92, 0.12, 0.6, 0, 0), color: '#3a3d42' },
    { geo: new THREE.TorusGeometry(0.22, 0.022, 5, 12, Math.PI), matrix: at(0.3, 0.98, -0.02, 0, Math.PI / 2, 0), color: '#1f2124' },
  ];
}

// A little brass lantern. The glass material is returned so its glow can follow the evening.
export function buildLanternModel() {
  const group = new THREE.Group();
  const brass = '#b98b3f';
  const frame = mergeParts([
    { geo: new THREE.ConeGeometry(0.1, 0.09, 6), matrix: mat(0, -0.05, 0), color: brass },
    { geo: new THREE.CylinderGeometry(0.095, 0.095, 0.03, 6), matrix: mat(0, -0.1, 0), color: brass },
    { geo: new THREE.CylinderGeometry(0.1, 0.1, 0.035, 6), matrix: mat(0, -0.3, 0), color: brass },
    { geo: new THREE.TorusGeometry(0.045, 0.01, 4, 10), matrix: mat(0, 0.01, 0), color: brass },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({
      geo: new THREE.CylinderGeometry(0.008, 0.008, 0.19, 3),
      matrix: mat(Math.cos((i / 6) * Math.PI * 2) * 0.088, -0.2, Math.sin((i / 6) * Math.PI * 2) * 0.088),
      color: brass,
    })),
  ]);
  const frameMesh = new THREE.Mesh(frame, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.45, flatShading: true }));
  frameMesh.castShadow = true;
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#fff0cf', emissive: '#ffad4a', emissiveIntensity: 0, roughness: 0.2, transparent: true, opacity: 0.9,
  });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.17, 6), glassMat);
  glass.position.y = -0.2;
  group.add(frameMesh, glass);
  return { group, glassMat };
}

// A fishing rod that can bend: a grip and reel, then a chain of tapering segments ending
// at `tip`. `look` (from tackle.js) sets its length, colours and reel. Points along +y.
const SEG = [0.55, 0.52, 0.48, 0.42, 0.38];
export function buildRod(look) {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  // A varnished blank that catches the light, and a cork grip.
  const blank = new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.32, metalness: 0.05 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.38, 7), withSurface(new THREE.MeshLambertMaterial({ color: look.handle }), 'cork'));
  grip.position.y = 0.12;
  group.add(grip);
  const metal = new THREE.MeshStandardMaterial({ color: '#7d8590', metalness: 0.6, roughness: 0.4 });
  let reel;
  if (look.reel === 'spin' || look.reel === 'big') {
    // A fixed-spool reel hanging under the rod (on the side the rod bends towards), with its
    // little handle.
    const s = look.reel === 'big' ? 1.35 : 1;
    reel = new THREE.Group();
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.04 * s, 0.07 * s, 10), metal);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07 * s, 0.02), metal);
    foot.position.set(0, 0, 0.045 * s);
    spool.rotation.x = Math.PI / 2;
    spool.position.set(0, 0.03 * s, 0.09 * s);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.01, 0.01), new THREE.MeshLambertMaterial({ color: '#2b2b2b' }));
    handle.position.set(0.045 * s, 0.03 * s, 0.09 * s);
    reel.add(spool, foot, handle);
    reel.position.set(0, 0.24, 0);
  } else {
    // Centrepin (float rod) or fly reel: a disc on the side, low on the butt for the fly rod.
    reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, look.reel === 'fly' ? 0.035 : 0.05, 12), metal);
    reel.rotation.z = Math.PI / 2;
    reel.position.set(-0.05, look.reel === 'fly' ? 0.02 : 0.22, 0);
  }
  group.add(reel);
  const k = (look.len - 0.3) / SEG.reduce((a, b) => a + b, 0);
  const segs = [];
  let parent = group, y = 0.3, r = look.reel === 'big' ? 0.024 : 0.02;
  for (const base of SEG) {
    const len = base * k;
    const seg = new THREE.Group();
    seg.position.y = y;
    parent.add(seg);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r, len, 5), blank);
    m.position.y = len / 2;
    m.castShadow = true;
    seg.add(m);
    segs.push(seg);
    parent = seg;
    y = len;
    r *= 0.78;
  }
  const tip = new THREE.Object3D();
  tip.position.y = y;
  parent.add(tip);
  return { group, segs, tip };
}

// Bend the rod: the tip sections give the most.
const BEND = [0.04, 0.09, 0.16, 0.24, 0.32];
export function bendRod(rod, bend) {
  rod.segs.forEach((s, i) => { s.rotation.x = bend * BEND[i]; });
}
