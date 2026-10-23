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
    case 'maggot':
      for (let i = 0; i < 4; i++) parts.push({ geo: new THREE.CapsuleGeometry(0.008, 0.02, 2, 5), matrix: mat((i - 1.5) * 0.012, 0, 0, 0, 0, 0.5 + i * 0.4), color: '#f3ead2', jitter: 0.03 });
      break;
    case 'rag':
      parts.push({ geo: new THREE.CapsuleGeometry(0.014, 0.1, 3, 6), matrix: mat(0, 0, 0, 0, 0, 0.9), color: '#b0503a' });
      break;
    case 'lug':
      parts.push({ geo: new THREE.CapsuleGeometry(0.018, 0.08, 3, 6), matrix: mat(0, 0, 0, 0, 0, 0.6), color: '#6a3a2a' });
      break;
    case 'crab':
      parts.push({ geo: new THREE.SphereGeometry(0.035, 8, 5), matrix: mat(0, 0, 0, 0, 0, 0, 1.2, 0.5, 1), color: '#c86a3a', jitter: 0.04 });
      break;
    case 'strip':
      parts.push({ geo: new THREE.BoxGeometry(0.025, 0.006, 0.1), matrix: mat(0, 0, 0), color: '#9fb4c8' });
      parts.push({ geo: new THREE.BoxGeometry(0.025, 0.003, 0.1), matrix: mat(0, 0.004, 0), color: '#3a5a4a' });
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
  } else if (id === 'tspin') {
    // A smaller spinner with a gold blade.
    const body = shiny(mergeParts([
      { geo: new THREE.CylinderGeometry(0.003, 0.003, 0.08, 4), matrix: mat(0, 0, 0, Math.PI / 2, 0, 0), color: '#c9ced4', jitter: 0 },
      { geo: new THREE.SphereGeometry(0.009, 6, 4), matrix: mat(0, 0, -0.008, 0, 0, 0, 1, 1, 1.8), color: '#3a3a3a', jitter: 0 },
    ]));
    const blade = shiny(mergeParts([{ geo: new THREE.SphereGeometry(0.02, 8, 4), matrix: mat(0.012, 0, 0.022, 0, 0, 0, 0.25, 0.9, 1.4), color: '#e8c25a', jitter: 0 }]));
    const spin = new THREE.Group();
    spin.add(blade);
    g.add(body, spin);
    g.userData.spin = spin;
  } else if (id === 'spoon') {
    g.add(shiny(mergeParts([
      { geo: new THREE.SphereGeometry(0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI / 3), matrix: mat(0, 0, 0, Math.PI / 2, 0, 0, 0.7, 1.6, 1), color: '#dfe6ec', jitter: 0 },
      { geo: new THREE.SphereGeometry(0.012, 6, 4), matrix: mat(0, 0.004, 0.01, 0, 0, 0, 0.6, 0.3, 1.2), color: '#d24a3a', jitter: 0 },
    ])));
  } else if (id === 'minnow') {
    g.add(lambert(mergeParts([
      { geo: new THREE.SphereGeometry(0.02, 8, 6), matrix: mat(0, 0, 0, 0, 0, 0, 0.6, 0.75, 2.6), color: '#c8d0c4', jitter: 0.02 },
      { geo: new THREE.SphereGeometry(0.015, 8, 6), matrix: mat(0, 0.009, -0.004, 0, 0, 0, 0.55, 0.45, 2.7), color: '#3f6a4a', jitter: 0.02 },
      { geo: new THREE.BoxGeometry(0.02, 0.002, 0.018), matrix: mat(0, -0.008, 0.055, 0.7, 0, 0), color: '#e8eef2', jitter: 0 },
      { geo: new THREE.SphereGeometry(0.005, 6, 4), matrix: mat(0.012, 0.006, 0.03), color: '#1a1512', jitter: 0 },
      { geo: new THREE.SphereGeometry(0.005, 6, 4), matrix: mat(-0.012, 0.006, 0.03), color: '#1a1512', jitter: 0 },
    ])));
  } else if (id === 'shad' || id === 'sandeel') {
    // A soft swimbait on a jig head: slim for the sandeel, a deep body and paddle for the shad.
    const eel = id === 'sandeel';
    const [back, side] = eel ? ['#3a6a7a', '#d8e2e6'] : ['#5a7a3a', '#e8e4c8'];
    g.add(lambert(mergeParts([
      { geo: new THREE.SphereGeometry(0.02, 8, 6), matrix: mat(0, 0, 0, 0, 0, 0, eel ? 0.55 : 0.75, eel ? 0.7 : 1, eel ? 4.2 : 2.6), color: side, jitter: 0.02 },
      { geo: new THREE.SphereGeometry(0.016, 8, 6), matrix: mat(0, 0.009, 0, 0, 0, 0, eel ? 0.5 : 0.65, 0.5, eel ? 4.2 : 2.6), color: back, jitter: 0.02 },
      { geo: new THREE.BoxGeometry(0.04, 0.03, 0.004), matrix: mat(0, 0, eel ? -0.09 : -0.065, 0, Math.PI / 2, 0), color: back, jitter: 0 },
      { geo: new THREE.SphereGeometry(0.014, 6, 5), matrix: mat(0, 0, eel ? 0.08 : 0.05), color: '#9aa3ad', jitter: 0 },
    ])));
  } else if (id === 'creature') {
    g.add(lambert(mergeParts([
      { geo: new THREE.CapsuleGeometry(0.014, 0.06, 3, 6), matrix: mat(0, 0, 0, Math.PI / 2, 0, 0), color: '#4a3a5a' },
      { geo: new THREE.ConeGeometry(0.006, 0.05, 4), matrix: mat(0.02, 0, -0.04, -1.2, 0, 0.6), color: '#5a4a6a' },
      { geo: new THREE.ConeGeometry(0.006, 0.05, 4), matrix: mat(-0.02, 0, -0.04, -1.2, 0, -0.6), color: '#5a4a6a' },
    ])));
  } else if (id === 'popper' || id === 'stickbait') {
    const big = id === 'stickbait';
    const [a, b] = big ? ['#2a6a9a', '#eef2f6'] : ['#d8d23a', '#2a3a2a'];
    g.add(shiny(mergeParts([
      { geo: new THREE.CylinderGeometry(big ? 0.022 : 0.024, big ? 0.012 : 0.016, big ? 0.16 : 0.07, 10), matrix: mat(0, 0, 0, Math.PI / 2, 0, 0), color: b, jitter: 0 },
      { geo: new THREE.CylinderGeometry(big ? 0.018 : 0.02, big ? 0.01 : 0.014, big ? 0.16 : 0.07, 10), matrix: mat(0, 0.008, 0, Math.PI / 2, 0, 0), color: a, jitter: 0 },
      { geo: new THREE.SphereGeometry(0.006, 6, 4), matrix: mat(0.016, 0.006, big ? 0.06 : 0.025), color: '#1a1512', jitter: 0 },
      { geo: new THREE.SphereGeometry(0.006, 6, 4), matrix: mat(-0.016, 0.006, big ? 0.06 : 0.025), color: '#1a1512', jitter: 0 },
    ])));
  } else if (id === 'metal' || id === 'mjig') {
    const big = id === 'mjig';
    g.add(shiny(mergeParts([
      { geo: new THREE.BoxGeometry(big ? 0.03 : 0.022, big ? 0.012 : 0.008, big ? 0.14 : 0.08), matrix: mat(0, 0, 0), color: '#e6ecf2', jitter: 0.03 },
      { geo: new THREE.BoxGeometry(big ? 0.031 : 0.023, 0.004, big ? 0.13 : 0.075), matrix: mat(0, big ? 0.007 : 0.005, 0), color: big ? '#e05a8a' : '#4a8ab0', jitter: 0 },
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

// A squid jig (egi): a shrimp-shaped body with a cloth wrap, a sinker under its chin, and a
// crown of fine spikes at the tail instead of a hook.
function egi(id) {
  const k = id === 'egi18' ? 0.8 : id === 'egi30' ? 1.2 : 1;
  const [cloth, back] = id === 'egi18' ? ['#f08a3a', '#3a8a5a'] : id === 'egi30' ? ['#e04a8a', '#3a4a9a'] : ['#f2c23a', '#c04a3a'];
  const parts = [
    { geo: new THREE.SphereGeometry(0.03, 10, 8), matrix: mat(0, 0, 0, 0, 0, 0, 0.7, 0.8, 3), color: cloth, jitter: 0.02 },
    { geo: new THREE.SphereGeometry(0.022, 8, 6), matrix: mat(0, 0.012, -0.01, 0, 0, 0, 0.6, 0.5, 3.1), color: back, jitter: 0.02 },
    { geo: new THREE.BoxGeometry(0.018, 0.012, 0.04), matrix: mat(0, -0.024, 0.07, 0.4, 0, 0), color: '#7d8590', jitter: 0 },
    { geo: new THREE.SphereGeometry(0.007, 6, 4), matrix: mat(0.016, 0.01, 0.075), color: '#1a1512', jitter: 0 },
    { geo: new THREE.SphereGeometry(0.007, 6, 4), matrix: mat(-0.016, 0.01, 0.075), color: '#1a1512', jitter: 0 },
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push({ geo: new THREE.CylinderGeometry(0.001, 0.0015, 0.025, 3), matrix: mat(Math.cos(a) * 0.008, Math.sin(a) * 0.008, -0.1, Math.PI / 2 + Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5), color: '#c9ced4', jitter: 0 });
  }
  const m = lambert(mergeParts(parts));
  m.scale.setScalar(1.4 * k);
  return m;
}

export function buildTackleModel(item) {
  if (!item) return new THREE.Group();
  const g = new THREE.Group();
  if (item.type === 'jig') g.add(egi(item.id));
  else if (item.type === 'bait') g.add(bait(item.id));
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
  // Glossy painted balsa.
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e5533d', roughness: 0.3 }));
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.3 }));
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
