// Hats (and, for no hat, hair): a flat cap, a beanie, a bucket hat, a cap, or a cap of hair with a
// bun at the back, for a head of radius 0.13. Shared by the townsfolk and friends (world/folk.js)
// and your own figure (looks.js). L: { hat, hatColor, hair }; mat(colour): a material.
import * as THREE from 'three';

export function buildHat(L, mat) {
  const g = new THREE.Group();
  const c = mat(L.hatColor || L.hair || '#333');
  if (L.hat === 'flatcap') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.135, 0.06, 14), c);
    crown.position.y = 0.09;
    crown.scale.z = 1.12;
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.1), c);
    peak.position.set(0, 0.075, 0.14);
    g.add(crown, peak);
  } else if (L.hat === 'beanie') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), c);
    b.position.y = 0.02;
    b.scale.y = 1.15;
    g.add(b);
  } else if (L.hat === 'bucket') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.135, 0.12, 14), c);
    crown.position.y = 0.13;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.02, 16), c);
    brim.position.y = 0.075;
    g.add(crown, brim);
  } else if (L.hat === 'cap') {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.132, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), c);
    crown.position.y = 0.03;
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.12), c);
    peak.position.set(0, 0.04, 0.15);
    g.add(crown, peak);
  } else {
    // Hair: a cap of it, and a bun at the back (or short, for Paco).
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.132, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), c);
    hair.position.set(0, 0.012, -0.012);
    g.add(hair);
    if (L.hat === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), c);
      bun.position.set(0, 0.07, -0.12);
      g.add(bun);
    }
  }
    return g;
}
