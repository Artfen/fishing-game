import * as THREE from 'three';
import { mergeParts, mat } from './util.js';

// Little models for what is on the end of the line. Lures and flies are drawn a bit larger
// than life so you can follow them underwater. Each faces local +z (the way it travels).

const lambert = (geo) => new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
const shiny = (geo) => new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.3 }));

function hook(parts, y = 0) {
  parts.push({ geo: new THREE.TorusGeometry(0.025, 0.004, 4, 10, Math.PI * 1.3), matrix: mat(0, y, 0), color: '#9aa3ad', jitter: 0 });
}

function bait(id) {
  const parts = [];
  switch (id) {
    case 'worm':
      parts.push({ geo: new THREE.CapsuleGeometry(0.02, 0.08, 3, 6), matrix: mat(0, 0, 0, 0, 0, 0.7), color: '#e98a8a' });
      break;
    case 'prawn':
      parts.push({ geo: new THREE.TorusGeometry(0.035, 0.016, 5, 10, Math.PI * 1.4), matrix: mat(0, 0.01, 0, 0, 0, 0.4), color: '#f2a08a' });
      break;
    case 'corn':
      for (let i = 0; i < 3; i++) parts.push({ geo: new THREE.SphereGeometry(0.016, 6, 4), matrix: mat(0, -0.015 + i * 0.022, 0), color: '#f4cf3a', jitter: 0.03 });
      break;
    case 'bread':
      parts.push({ geo: new THREE.IcosahedronGeometry(0.032, 0), matrix: mat(0, 0, 0, 0.3, 0.2, 0, 1, 0.8, 1.1), color: '#f7f1e3', jitter: 0.03 });
      break;
    case 'boilie':
      parts.push({ geo: new THREE.SphereGeometry(0.03, 8, 6), matrix: mat(0, 0, 0), color: '#b0703a', jitter: 0.02 });
      break;
    default:
  }
  hook(parts, 0.02);
  return lambert(mergeParts(parts));
}

function lure(id) {
  const g = new THREE.Group();
  if (id === 'spinner') {
    const body = shiny(mergeParts([
      { geo: new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4), matrix: mat(0, 0, 0, Math.PI / 2, 0, 0), color: '#c9ced4', jitter: 0 },
      { geo: new THREE.SphereGeometry(0.014, 6, 4), matrix: mat(0, 0, -0.01, 0, 0, 0, 1, 1, 1.8), color: '#e0b84a', jitter: 0 },
      { geo: new THREE.ConeGeometry(0.018, 0.04, 6), matrix: mat(0, 0, -0.06, -Math.PI / 2, 0, 0), color: '#d24a3a', jitter: 0 },
    ]));
    const blade = shiny(mergeParts([{ geo: new THREE.SphereGeometry(0.03, 8, 4), matrix: mat(0.018, 0, 0.035, 0, 0, 0, 0.25, 0.9, 1.4), color: '#eef2f6', jitter: 0 }]));
    const spin = new THREE.Group();
    spin.add(blade);
    g.add(body, spin);
    g.userData.spin = spin;
  } else if (id === 'crankS' || id === 'crankD') {
    const deep = id === 'crankD';
    const [a, b, c] = deep ? ['#5a6a3a', '#d8c04a', '#f3ead0'] : ['#2f7a3a', '#e6d23a', '#ff7a2a'];
    g.add(lambert(mergeParts([
      { geo: new THREE.SphereGeometry(0.045, 10, 8), matrix: mat(0, 0.004, 0, 0, 0, 0, 0.75, 0.9, 1.5), color: b, jitter: 0.02 },
      { geo: new THREE.SphereGeometry(0.03, 8, 6), matrix: mat(0, 0.02, -0.01, 0, 0, 0, 0.6, 0.5, 1.6), color: a, jitter: 0.02 },
      { geo: new THREE.SphereGeometry(0.025, 8, 6), matrix: mat(0, -0.022, 0.01, 0, 0, 0, 0.6, 0.5, 1.4), color: c, jitter: 0.02 },
      { geo: new THREE.BoxGeometry(0.05, 0.004, deep ? 0.08 : 0.035), matrix: mat(0, -0.02, 0.07 + (deep ? 0.02 : 0), deep ? 0.55 : 0.9, 0, 0), color: '#e8eef2', jitter: 0 },
      { geo: new THREE.SphereGeometry(0.008, 6, 4), matrix: mat(0.028, 0.012, 0.045), color: '#1a1512', jitter: 0 },
      { geo: new THREE.SphereGeometry(0.008, 6, 4), matrix: mat(-0.028, 0.012, 0.045), color: '#1a1512', jitter: 0 },
    ])));
  } else if (id === 'jerk') {
    g.add(shiny(mergeParts([
      { geo: new THREE.SphereGeometry(0.03, 10, 8), matrix: mat(0, 0, 0, 0, 0, 0, 0.6, 0.8, 3), color: '#cfd8de', jitter: 0.02 },
      { geo: new THREE.SphereGeometry(0.022, 8, 6), matrix: mat(0, 0.014, -0.01, 0, 0, 0, 0.55, 0.5, 3.1), color: '#2d5a8a', jitter: 0.02 },
      { geo: new THREE.BoxGeometry(0.03, 0.003, 0.02), matrix: mat(0, -0.01, 0.09, 0.9, 0, 0), color: '#e8eef2', jitter: 0 },
    ])));
  }
  return g;
}

function fly(id) {
  const parts = [];
  if (id === 'dry') {
    parts.push({ geo: new THREE.CylinderGeometry(0.004, 0.006, 0.04, 4), matrix: mat(0, 0, 0, Math.PI / 2, 0, 0), color: '#d9c07a' });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push({ geo: new THREE.CylinderGeometry(0.0015, 0.0015, 0.04, 3), matrix: mat(Math.cos(a) * 0.012, 0.004 + Math.sin(a) * 0.012, 0.012, Math.sin(a) * 1.5, 0, -Math.cos(a) * 1.5), color: '#8a6a4a' });
    }
    parts.push({ geo: new THREE.PlaneGeometry(0.02, 0.035), matrix: mat(0.006, 0.025, 0.005, 0, 0, -0.3), color: '#e8e2d2' });
    parts.push({ geo: new THREE.PlaneGeometry(0.02, 0.035), matrix: mat(-0.006, 0.025, 0.005, 0, 0, 0.3), color: '#e8e2d2' });
    parts.push({ geo: new THREE.CylinderGeometry(0.001, 0.001, 0.04, 3), matrix: mat(0, 0.004, -0.035, Math.PI / 2 + 0.3, 0, 0), color: '#6a5a40' });
  } else if (id === 'nymph') {
    parts.push({ geo: new THREE.SphereGeometry(0.01, 6, 4), matrix: mat(0, 0, 0.018), color: '#c9a24a' });
    parts.push({ geo: new THREE.ConeGeometry(0.008, 0.035, 5), matrix: mat(0, 0, -0.005, -Math.PI / 2, 0, 0), color: '#6a4a2a' });
  } else {
    parts.push({ geo: new THREE.CylinderGeometry(0.008, 0.01, 0.04, 6), matrix: mat(0, 0, 0.01, Math.PI / 2, 0, 0), color: '#1e1e22' });
    parts.push({ geo: new THREE.ConeGeometry(0.014, 0.07, 6), matrix: mat(0, 0, -0.04, -Math.PI / 2, 0, 0), color: '#26262c' });
    parts.push({ geo: new THREE.SphereGeometry(0.007, 6, 4), matrix: mat(0, 0, 0.032), color: '#c9a24a' });
  }
  hook(parts, -0.005);
  const m = lambert(mergeParts(parts));
  m.scale.setScalar(1.8);
  return m;
}

export function buildTackleModel(item) {
  if (!item) return new THREE.Group();
  const g = new THREE.Group();
  if (item.type === 'bait') g.add(bait(item.id));
  else if (item.type === 'lure') {
    const l = lure(item.id);
    l.scale.setScalar(1.4);
    g.add(l);
    g.userData.spin = l.userData.spin;
  } else g.add(fly(item.id));
  return g;
}

// The float, a strike indicator for nymphs, and the lead that holds a carp rig on the bottom.
export function buildFloat() {
  const bobber = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#e5533d' }));
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#f6f1e6' }));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 4), new THREE.MeshLambertMaterial({ color: '#2f2a26' }));
  stem.position.y = 0.11;
  bobber.add(top, bottom, stem);
  return bobber;
}

export function buildIndicator() {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), new THREE.MeshLambertMaterial({ color: '#ff8a2a', emissive: '#3a1a00' }));
  m.scale.set(1, 0.8, 1);
  return m;
}

export function buildLead() {
  return new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6).scale(1, 1.5, 1), new THREE.MeshStandardMaterial({ color: '#5a5f66', metalness: 0.4, roughness: 0.5 }));
}
