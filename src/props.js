import * as THREE from 'three';
import { mergeParts, mat } from './util.js';

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
