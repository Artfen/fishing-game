import * as THREE from 'three';
import {
  heightAt, riverSDF, mereSDF, WEND_CAMP, QUAY, BOATHOUSE, BOATHOUSE_PIER, COVE_PIER, GANNET_CAMP, LIGHT,
  TIMBER, MERE_BAYS, SKERRIES, SKELLIG, MARSH, RIVER, SHOAL, PUFFIN_COVE,
} from './terrain.js';
import { mergeParts, mat, fbm, pick, jitterGeo, glowTexture, clamp } from '../util.js';
import { swayMaterial, tentGeometry, reedClump, lilyGeometry } from './shore.js';
import { withSurface } from './surface.js';
import { withCaustics } from './caustics.js';

// Everything built beyond the bay: Wend Quay and its camp, the Longmere boathouse and jetty,
// Puffin Cove's landing and bivouac, Gannet Light, the drowned oaks, reeds and saltmarsh,
// lily pads, the Skerries and Little Skellig, and buoys to steer by.

const wood = () => withSurface(new THREE.MeshLambertMaterial({ vertexColors: true }), 'wood', { axis: 'x' });
const plain = () => new THREE.MeshLambertMaterial({ vertexColors: true });

function mesh(geo, material, shadows = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

function instanced(geo, list, material, rnd) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
  m.count = list.length;
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((t, i) => {
    o.position.set(t.x, t.y, t.z);
    o.rotation.set(t.rx || 0, t.r || 0, 0);
    o.scale.setScalar(t.s);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    const v = 0.9 + rnd() * 0.2;
    c.setRGB(v, v, v * (0.95 + rnd() * 0.08));
    m.setColorAt(i, c);
  });
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.receiveShadow = true;
  return m;
}

// A plank deck over an axis-aligned pier box, on posts down to the bed.
function pierParts(P, parts, rnd, { color = '#a98258', posts = '#6a503b' } = {}) {
  const alongX = P.x1 - P.x0 > P.z1 - P.z0;
  const len = alongX ? P.x1 - P.x0 : P.z1 - P.z0, w = alongX ? P.z1 - P.z0 : P.x1 - P.x0;
  const cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
  const n = Math.floor(len / 0.34);
  for (let i = 0; i < n; i++) {
    const u = -len / 2 + 0.17 + i * 0.34;
    const x = alongX ? cx + u : cx, z = alongX ? cz : cz + u;
    parts.push({ geo: new THREE.BoxGeometry(alongX ? 0.3 : w, 0.07, alongX ? w : 0.3), matrix: mat(x, P.deck + (rnd() - 0.5) * 0.015, z, 0, (rnd() - 0.5) * 0.03, 0), color: pick([color, '#a57f59', '#b48d63'], rnd), jitter: 0.03 });
  }
  for (let u = -len / 2 + 0.4; u <= len / 2; u += 2.2) {
    for (const s of [-1, 1]) {
      const x = alongX ? cx + u : cx + s * (w / 2 - 0.1), z = alongX ? cz + s * (w / 2 - 0.1) : cz + u;
      const bottom = Math.min(heightAt(x, z), 0) - 0.5;
      parts.push({ geo: new THREE.CylinderGeometry(0.11, 0.13, P.deck + 0.3 - bottom, 6), matrix: mat(x, (P.deck + 0.3 + bottom) / 2, z), color: posts });
    }
  }
}

function chestParts(x, y, z, yaw, parts) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const p = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  parts.push({ geo: new THREE.BoxGeometry(0.9, 0.45, 0.55), matrix: mat(...p(0, 0.23, 0), 0, yaw, 0), color: '#7a5636' });
  parts.push({ geo: new THREE.BoxGeometry(0.94, 0.12, 0.59), matrix: mat(...p(0, 0.5, 0), 0, yaw, 0), color: '#6a4a2e' });
  parts.push({ geo: new THREE.BoxGeometry(0.12, 0.1, 0.04), matrix: mat(...p(0, 0.42, 0.3), 0, yaw, 0), color: '#c9a24a' });
}

export function buildRegions(scene, rnd) {
  const obstacles = [];
  const woodParts = [], stoneParts = [], plainParts = [];
  const group = new THREE.Group();

  /* ---------- Wend Quay ---------- */
  {
    const Q = QUAY;
    const cx = (Q.x0 + Q.x1) / 2, cz = (Q.z0 + Q.z1) / 2, len = Q.x1 - Q.x0, w = Q.z1 - Q.z0;
    // Courses of dressed stone down to the bed, and big capstones on top.
    for (let x = Q.x0 + 0.5; x < Q.x1; x += 1.0) {
      const bottom = Math.min(heightAt(x, cz), 0) - 0.8;
      for (let y = bottom; y < Q.deck - 0.25; y += 0.45) {
        stoneParts.push({ geo: new THREE.BoxGeometry(0.98, 0.44, w), matrix: mat(x + (rnd() - 0.5) * 0.05, y + 0.22, cz), color: pick(['#8f8a80', '#9c968b', '#857f74'], rnd), jitter: 0.03 });
      }
      stoneParts.push({ geo: new THREE.BoxGeometry(0.98, 0.25, w + 0.2), matrix: mat(x, Q.deck - 0.12, cz), color: pick(['#b3ab9c', '#a8a091'], rnd), jitter: 0.02 });
    }
    // Bollards and a mooring ring at the end.
    for (const sx of [Q.x1 - 1.2, Q.x0 + len * 0.45]) {
      for (const sz of [Q.z0 + 0.35, Q.z1 - 0.35]) {
        plainParts.push({ geo: new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8), matrix: mat(sx, Q.deck + 0.25, sz), color: '#3e3a36' });
        obstacles.push({ x: sx, z: sz, r: 0.22, top: Q.deck + 0.5 });
      }
    }
    plainParts.push({ geo: new THREE.TorusGeometry(0.16, 0.035, 5, 12), matrix: mat(Q.x1 - 0.1, Q.deck - 0.25, cz, 0, Math.PI / 2, 0), color: '#6a5a48' });
    // The camp: a tent, the tackle box, a bench, and a sign to Longmere.
    const C = WEND_CAMP, gy = heightAt(C.x, C.z);
    const tent = new THREE.Mesh(tentGeometry(rnd), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    tent.position.set(C.x - 2.4, heightAt(C.x - 2.4, C.z + 1.5) - 0.02, C.z + 1.5);
    tent.rotation.y = Math.PI / 2;
    tent.castShadow = true;
    group.add(tent);
    obstacles.push({ x: tent.position.x, z: tent.position.z, r: 1.35 });
    chestParts(C.x + 1.5, gy, C.z + 2.2, Math.PI / 2, woodParts);
    obstacles.push({ x: C.x + 1.5, z: C.z + 2.2, r: 0.55 });
    woodParts.push({ geo: new THREE.BoxGeometry(1.4, 0.06, 0.4), matrix: mat(C.x + 1, gy + 0.45, C.z - 2.4), color: '#a98258' });
    for (const sx of [-0.6, 0.6]) woodParts.push({ geo: new THREE.BoxGeometry(0.06, 0.5, 0.36), matrix: mat(C.x + 1 + sx, gy + 0.2, C.z - 2.4), color: '#6e5238' });
    const sx = C.x - 3.5, sz = C.z - 3.5, sy = heightAt(sx, sz);
    woodParts.push({ geo: new THREE.CylinderGeometry(0.06, 0.07, 1.8, 6), matrix: mat(sx, sy + 0.9, sz), color: '#6e5238' });
    woodParts.push({ geo: new THREE.BoxGeometry(1.0, 0.24, 0.05), matrix: mat(sx + 0.3, sy + 1.55, sz, 0, -0.9, 0), color: '#c9a978' });
    obstacles.push({ x: sx, z: sz, r: 0.12 });
  }

  /* ---------- the Longmere boathouse ---------- */
  {
    const B = BOATHOUSE, gy = heightAt(B.x + 3, B.z);
    pierParts(BOATHOUSE_PIER, woodParts, rnd);
    // A tarred shed on the bank beside the jetty's land end.
    const hx = B.x + 4.5, hz = B.z + 4;
    woodParts.push({ geo: new THREE.BoxGeometry(4.2, 2.4, 3.4), matrix: mat(hx, gy + 1.2, hz), color: '#4a3a30', jitter: 0.01 });
    woodParts.push({ geo: new THREE.BoxGeometry(4.6, 0.12, 2.2), matrix: mat(hx, gy + 2.75, hz - 0.85, 0.5, 0, 0), color: '#6a3a2a' });
    woodParts.push({ geo: new THREE.BoxGeometry(4.6, 0.12, 2.2), matrix: mat(hx, gy + 2.75, hz + 0.85, -0.5, 0, 0), color: '#6a3a2a' });
    woodParts.push({ geo: new THREE.BoxGeometry(1.1, 1.8, 0.06), matrix: mat(hx - 0.8, gy + 0.9, hz - 1.72), color: '#7a5a3a' });
    obstacles.push({ x: hx - 1, z: hz, r: 1.6 }, { x: hx + 1, z: hz, r: 1.6 });
    chestParts(B.x + 2.2, heightAt(B.x + 2.2, B.z - 2.4), B.z - 2.4, 0, woodParts);
    obstacles.push({ x: B.x + 2.2, z: B.z - 2.4, r: 0.55 });
    // A rack for oars and paddles.
    for (const dz of [-0.6, 0.6]) woodParts.push({ geo: new THREE.BoxGeometry(0.08, 1.0, 0.08), matrix: mat(hx + 2.6, gy + 0.5, hz + dz), color: '#6e5238' });
    woodParts.push({ geo: new THREE.BoxGeometry(0.08, 0.06, 1.4), matrix: mat(hx + 2.6, gy + 0.85, hz), color: '#6e5238' });
  }

  /* ---------- Puffin Cove ---------- */
  {
    pierParts(COVE_PIER, woodParts, rnd, { color: '#b5a17e', posts: '#5a4a3a' });
    const C = GANNET_CAMP, gy = heightAt(C.x, C.z + 2);
    const tent = new THREE.Mesh(tentGeometry(rnd), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    tent.position.set(C.x + 2.6, heightAt(C.x + 2.6, C.z + 3) - 0.02, C.z + 3);
    tent.rotation.y = Math.PI;
    tent.scale.setScalar(0.85);
    tent.castShadow = true;
    group.add(tent);
    obstacles.push({ x: tent.position.x, z: tent.position.z, r: 1.2 });
    chestParts(C.x - 2, gy, C.z + 2, -0.4, woodParts);
    obstacles.push({ x: C.x - 2, z: C.z + 2, r: 0.55 });
    // A bleached driftwood log to sit on.
    woodParts.push({ geo: new THREE.CylinderGeometry(0.16, 0.2, 2.2, 7), matrix: mat(C.x, gy + 0.18, C.z + 4.5, 0, 0.3, Math.PI / 2), color: '#cfc2ab' });
  }

  /* ---------- Gannet Light ---------- */
  const lightBeam = new THREE.Group();
  {
    const x = LIGHT.x, z = LIGHT.z, gy = heightAt(x, z);
    const tower = [];
    tower.push({ geo: new THREE.CylinderGeometry(1.5, 2.0, 1.2, 12), matrix: mat(x, gy + 0.4, z), color: '#9c968b' });
    tower.push({ geo: new THREE.CylinderGeometry(1.1, 1.5, 8.5, 12), matrix: mat(x, gy + 5, z), color: '#f2efe6' });
    tower.push({ geo: new THREE.CylinderGeometry(1.12, 1.24, 1.4, 12), matrix: mat(x, gy + 4.4, z), color: '#b8423a' });
    tower.push({ geo: new THREE.CylinderGeometry(1.5, 1.5, 0.2, 12), matrix: mat(x, gy + 9.35, z), color: '#3a3a3a' });
    tower.push({ geo: new THREE.CylinderGeometry(0.75, 0.75, 1.2, 10), matrix: mat(x, gy + 10.1, z), color: '#e8f2f6' });
    tower.push({ geo: new THREE.ConeGeometry(0.95, 0.9, 10), matrix: mat(x, gy + 11.1, z), color: '#b8423a' });
    plainParts.push(...tower);
    obstacles.push({ x, z, r: 2.1 });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,190,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glow.scale.setScalar(6);
    lightBeam.position.set(x, gy + 10.1, z);
    lightBeam.add(glow);
    // Two long soft beams that sweep round.
    const beamGeo = new THREE.ConeGeometry(2.4, 60, 12, 1, true).translate(0, -30, 0).rotateZ(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({ color: '#ffe9b8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true });
    for (const r of [0, Math.PI]) {
      const b = new THREE.Mesh(beamGeo, beamMat);
      b.rotation.y = r;
      lightBeam.add(b);
    }
    lightBeam.userData = { glow, beamMat };
    group.add(lightBeam);
  }

  /* ---------- the drowned oaks ---------- */
  for (const t of TIMBER) {
    const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
    const len = 9 + rnd() * 4;
    const x = t.x + s * len * 0.4, z = t.z + c * len * 0.4;
    const y = Math.max(heightAt(x, z), -1.5) + 0.2;
    woodParts.push({ geo: new THREE.CylinderGeometry(0.25, 0.42, len, 7), matrix: mat(x, y, z, Math.PI / 2 - 0.12, t.yaw, 0), color: '#5a4636', jitter: 0.03 });
    for (let k = 0; k < 4; k++) {
      const u = 0.25 + k * 0.18;
      const bx = t.x + s * len * u, bz = t.z + c * len * u;
      woodParts.push({ geo: new THREE.CylinderGeometry(0.05, 0.12, 2.4, 5), matrix: mat(bx, y + 0.6, bz, (rnd() - 0.5) * 1.6, rnd() * 6, (rnd() - 0.5) * 1.6), color: '#4e3c2e' });
    }
  }

  /* ---------- the Skerries and Little Skellig ---------- */
  {
    const ROCK = ['#5f5a54', '#6a645c', '#55504a'];
    for (const k of [...SKERRIES, { ...SKELLIG, r: SKELLIG.r * 0.7 }]) {
      for (let i = 0; i < 4; i++) {
        const a = rnd() * 6.28, d = rnd() * k.r * 0.6;
        const x = k.x + Math.cos(a) * d, z = k.z + Math.sin(a) * d;
        const s = k.r * (0.35 + rnd() * 0.4);
        stoneParts.push({ geo: jitterGeo(new THREE.DodecahedronGeometry(s, 0), s * 0.35, rnd), matrix: mat(x, heightAt(x, z) + s * 0.25, z, 0, rnd() * 6, 0, 1, 0.7 + rnd() * 0.5, 1), color: pick(ROCK, rnd), jitter: 0.06 });
      }
    }
    // Guano on Skellig's top.
    stoneParts.push({ geo: jitterGeo(new THREE.IcosahedronGeometry(SKELLIG.r * 0.45, 1), 1.2, rnd), matrix: mat(SKELLIG.x, heightAt(SKELLIG.x, SKELLIG.z) + 3, SKELLIG.z, 0, 0, 0, 1, 0.35, 1), color: '#ece8dc' });
  }

  /* ---------- buoys to steer by ---------- */
  const buoys = [];
  {
    const mouth = RIVER[RIVER.length - 1];
    const marks = [
      { x: mouth[0] - 70, z: mouth[1] - 10, color: '#c23b2e', top: 'can' },
      { x: mouth[0] + 60, z: mouth[1] - 30, color: '#2f8a4a', top: 'cone' },
      { x: SHOAL.x, z: SHOAL.z - SHOAL.rz - 12, color: '#e0c23a', top: 'cross' },
      { x: PUFFIN_COVE.x + 10, z: PUFFIN_COVE.z - 70, color: '#c23b2e', top: 'can' },
    ];
    for (const m of marks) {
      const g = new THREE.Group();
      const parts = [
        { geo: new THREE.CylinderGeometry(0.5, 0.6, 1.2, 10), matrix: mat(0, 0.3, 0), color: m.color },
        { geo: new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), matrix: mat(0, 1.6, 0), color: '#3a3a3a' },
        m.top === 'cone' ? { geo: new THREE.ConeGeometry(0.35, 0.5, 8), matrix: mat(0, 2.6, 0), color: m.color }
          : m.top === 'cross' ? { geo: new THREE.BoxGeometry(0.8, 0.12, 0.12), matrix: mat(0, 2.5, 0, 0, 0, 0.7), color: '#1e1e1e' }
            : { geo: new THREE.CylinderGeometry(0.3, 0.3, 0.45, 8), matrix: mat(0, 2.55, 0), color: m.color },
      ];
      g.add(mesh(mergeParts(parts, rnd), plain(), false));
      g.position.set(m.x, 0, m.z);
      group.add(g);
      buoys.push(g);
    }
  }

  /* ---------- reeds, saltmarsh and lily pads ---------- */
  const reeds = [], lilies = [], flowers = [], marsh = [];
  for (let i = 0; i < 90000 && reeds.length < 900; i++) {
    const x = 120 + rnd() * 660, z = -660 + rnd() * 840;
    const dr = riverSDF(x, z), dm = mereSDF(x, z);
    if (dr > 14 && dm > 10) continue;
    const h = heightAt(x, z);
    if (h < -0.5 || h > 0.5) continue;
    if (fbm(x * 0.05, z * 0.05, 2) < -0.05) continue;
    reeds.push({ x, y: h - 0.1, z, s: 0.8 + rnd() * 0.6, r: rnd() * 6.28 });
  }
  for (const m of MARSH) {
    for (let i = 0; i < 90; i++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * (m.r + 3);
      const x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d, h = heightAt(x, z);
      if (h < 0.1) continue;
      marsh.push({ x, y: h, z, s: 0.7 + rnd() * 0.5, r: rnd() * 6.28 });
    }
  }
  for (const b of MERE_BAYS) {
    for (let i = 0; i < 70; i++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * b.rx * 0.45;
      const x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d * (b.rz / b.rx);
      const depth = -heightAt(x, z);
      if (depth < 0.4 || depth > 2.5) continue;
      (rnd() < 0.15 ? flowers : lilies).push({ x, y: 0.02, z, s: 0.9 + rnd() * 0.6, r: rnd() * 6.28 });
    }
  }
  const sway = swayMaterial(0.15, 0.08);
  group.add(instanced(reedClump(rnd, true), reeds, sway, rnd));
  group.add(instanced(reedClump(rnd, false), marsh, sway, rnd));
  const lily = lilyGeometry(rnd);
  const lilyMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  group.add(instanced(lily.pad, lilies, lilyMat, rnd), instanced(lily.flower, flowers, lilyMat, rnd));
  for (const r of reeds) if (r.y > -0.2) obstacles.push({ x: r.x, z: r.z, r: 0.25 * r.s, top: 1.2 });

  group.add(mesh(mergeParts(woodParts, rnd), wood()));
  group.add(mesh(mergeParts(stoneParts, rnd), withCaustics(plain())));
  group.add(mesh(mergeParts(plainParts, rnd), plain()));
  scene.add(group);

  // The tackle boxes beyond the bay (camp has its own): within reach, the backpack can swap.
  const boxes = [
    { place: 'quay', x: WEND_CAMP.x + 1.5, z: WEND_CAMP.z + 2.2 },
    { place: 'boathouse', x: BOATHOUSE.x + 2.2, z: BOATHOUSE.z - 2.4 },
    { place: 'puffin', x: GANNET_CAMP.x - 2, z: GANNET_CAMP.z + 2 },
  ];

  return {
    group,
    obstacles,
    boxes,
    update(dt, t, env) {
      // The light turns once every twelve seconds; you see it from far out after dark.
      const night = clamp(env.lantern * 1.2, 0, 1);
      lightBeam.rotation.y = t * ((Math.PI * 2) / 12);
      lightBeam.userData.beamMat.opacity = 0.12 * night;
      lightBeam.userData.glow.material.opacity = 0.2 + 0.8 * night;
      for (const [i, b] of buoys.entries()) {
        b.position.y = Math.sin(t * 1.1 + i) * 0.12 - 0.15;
        b.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.08;
      }
    },
  };
}

