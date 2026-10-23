import * as THREE from 'three';
import { heightAt, JETTY, COVE, ISLAND, STACKS, CHANNEL, CAMP, LANDING, findShore, lakeSDF, streamSDF, pathInfo } from './terrain.js';
import { mergeParts, mat, seeded, fbm, clamp, lerp, smoothstep, hash2, jitterGeo, pick, glowTexture } from '../util.js';
import { buildLanternModel } from '../props.js';
import { withCaustics } from './caustics.js';
import { withSurface } from './surface.js';
import { buildShore, SHORE_PATCH } from './shore.js';

const shared = { uTime: { value: 0 }, uWind: { value: 1 } };
const UP = new THREE.Vector3(0, 1, 0);

// Lambert with a little wind sway baked into the vertex shader (for trees and reeds).
function swayMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uWind = shared.uWind;
    shader.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 ip = vec3(0.0);
      #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xyz;
      #endif
      float sw = max(position.y - 0.6, 0.0);
      float ph = uTime * 1.2 + ip.x * 0.21 + ip.z * 0.17;
      transformed.x += sin(ph) * 0.03 * sw * uWind;
      transformed.z += cos(ph * 0.83) * 0.02 * sw * uWind;`,
    );
  };
  return m;
}

// A cylinder of the given radius stretched between two points.
function beam(a, b, r0, r1 = r0, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const geo = new THREE.CylinderGeometry(r1, r0, len, seg);
  const m = new THREE.Matrix4().compose(
    a.clone().addScaledVector(d, 0.5),
    new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()),
    new THREE.Vector3(1, 1, 1),
  );
  return { geo, matrix: m };
}

/* ---------------- terrain ---------------- */

const TC = {
  seabed: new THREE.Color('#b3ab85'),
  wetSand: new THREE.Color('#dac590'),
  sand: new THREE.Color('#efdeae'),
  grassLight: new THREE.Color('#aacd6e'),
  grass: new THREE.Color('#84b65d'),
  grassDark: new THREE.Color('#5f9250'),
  rock: new THREE.Color('#a39786'),
  rockLight: new THREE.Color('#beb3a1'),
  deepBed: new THREE.Color('#6d7c6a'),
  weedBed: new THREE.Color('#7f8a4c'),
  silt: new THREE.Color('#77704f'),
  siltDeep: new THREE.Color('#4f513d'),
  gravel: new THREE.Color('#857b62'),
  mud: new THREE.Color('#7f7052'),
  path: new THREE.Color('#a48f6c'),
  pathEdge: new THREE.Color('#93a463'),
  trodden: new THREE.Color('#a6a06a'),
};

// Lake and stream banks are mud and grass rather than beach sand; the path is bare earth.
function shoreColor(c, h, x, z, r, weed) {
  const dl = lakeSDF(x, z), ds = streamSDF(x, z);
  const bank = Math.min(dl, ds);
  const p = pathInfo(x, z).d;
  const dc = Math.hypot(x - CAMP.x, z - CAMP.z);
  const n = fbm(x * 0.09, z * 0.09, 2);
  if (bank < 14 || p < 2.2 || dc < 9) {
    if (h < -0.15 && bank < 3) {
      if (ds < dl) c.copy(TC.gravel).lerp(TC.siltDeep, smoothstep(0.3, 1.3, -h) * 0.6 + n * 0.15).lerp(TC.weedBed, clamp(n, 0, 1) * 0.35);
      else c.copy(TC.silt).lerp(TC.siltDeep, smoothstep(1, 5, -h)).lerp(TC.weedBed, weed * 0.6);
    } else if (h < 1.6 && bank < 6) {
      c.copy(TC.mud).lerp(TC.grassDark, smoothstep(-0.1, 1.3, h) * (0.6 + n * 0.4));
      if (ds < dl && h < 0.5) c.lerp(TC.gravel, 0.5);
    } else if (bank < 14 && h < 3) {
      c.copy(TC.grassDark).lerp(TC.grass, clamp(0.4 + n, 0, 1));
    }
    if (dc < 9) c.lerp(TC.trodden, smoothstep(9, 3, dc) * 0.7);
    if (p < 1.5) c.lerp(p < 0.7 ? TC.path : TC.pathEdge, smoothstep(1.5, 0.5, p) * (0.75 + n * 0.15));
    c.multiplyScalar(0.96 + r * 0.08);
    return true;
  }
  return false;
}

function terrainColor(c, h, ny, x, z, r, weed, shore) {
  const n = fbm(x * 0.05, z * 0.05, 2);
  if (shore && h < 5 && shoreColor(c, h, x, z, r, weed)) return;
  if (h < -0.25) {
    c.copy(TC.wetSand).lerp(TC.seabed, smoothstep(0, 6, -h)).lerp(TC.deepBed, smoothstep(6, 18, -h));
    c.lerp(TC.weedBed, weed * 0.55);
  }
  else if (h < 1.15 + n * 0.4) c.copy(TC.sand).lerp(TC.wetSand, smoothstep(0.5, -0.2, h));
  else {
    c.copy(TC.grassLight).lerp(TC.grass, clamp(0.5 + n * 1.2, 0, 1));
    c.lerp(TC.grassDark, smoothstep(8, 32, h) * 0.75);
    c.lerp(TC.sand, smoothstep(1.9, 1.15, h) * 0.5);
  }
  const rock = smoothstep(0.86, 0.68, ny);
  if (rock > 0 && h > -0.5) c.lerp(h > 22 ? TC.rockLight : TC.rock, rock);
  c.multiplyScalar(0.96 + r * 0.08);
}

// One big grid for the whole archipelago, plus a finer patch over the west shore so the
// stream, lake banks and path keep their shape. The patch lines up with the big grid and
// its border follows the big grid's edges exactly, so there are no cracks between them.
function buildTerrain(rnd, habitat) {
  const cx = 0, cz = -40, size = 760, N = 300, step = size / N, V = N + 1;
  const x0 = cx - size / 2, z0 = cz - size / 2;
  const P = SHORE_PATCH;
  const pi0 = Math.floor((P.x0 - x0) / step), pi1 = Math.ceil((P.x1 - x0) / step);
  const pj0 = Math.floor((P.z0 - z0) / step), pj1 = Math.ceil((P.z1 - z0) / step);
  const inPatch = (i, j) => i >= pi0 && i <= pi1 && j >= pj0 && j <= pj1;
  const X = new Float32Array(V * V), Y = new Float32Array(V * V), Z = new Float32Array(V * V);
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      let x = x0 + i * step, z = z0 + j * step;
      if (i > 0 && i < N && j > 0 && j < N && !inPatch(i, j)) {
        x += (hash2(i, j) - 0.5) * step * 0.6;
        z += (hash2(j + 991, i + 37) - 0.5) * step * 0.6;
      }
      const k = j * V + i;
      X[k] = x; Z[k] = z; Y[k] = heightAt(x, z);
    }
  }
  const pos = [], col = [];
  const c = new THREE.Color();
  const hs = {};
  const tri = (ax, ay, az, bx, by, bz, dx, dy, dz, shore) => {
    pos.push(ax, ay, az, bx, by, bz, dx, dy, dz);
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = dx - ax, vy = dy - ay, vz = dz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nyn = Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
    const mx = (ax + bx + dx) / 3, mz = (az + bz + dz) / 3, my = (ay + by + dy) / 3;
    terrainColor(c, my, nyn, mx, mz, rnd(), my < -0.3 ? habitat.sample(mx, mz, hs).weed : 0, shore);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
  };
  const vtx = (k) => [X[k], Y[k], Z[k]];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (i >= pi0 && i < pi1 && j >= pj0 && j < pj1) continue;
      const a = j * V + i, b = a + 1, d = a + V, e = d + 1;
      if ((i + j) % 2 === 0) { tri(...vtx(a), ...vtx(d), ...vtx(b)); tri(...vtx(b), ...vtx(d), ...vtx(e)); } else { tri(...vtx(a), ...vtx(d), ...vtx(e)); tri(...vtx(a), ...vtx(e), ...vtx(b)); }
    }
  }

  // The fine patch: 3 × 3 cells for every big cell.
  const S = 3, pn = (pi1 - pi0) * S, pm = (pj1 - pj0) * S, ps = step / S, PV = pn + 1;
  const PX = new Float32Array(PV * (pm + 1)), PY = new Float32Array(PV * (pm + 1)), PZ = new Float32Array(PV * (pm + 1));
  const big = (i, j) => Y[j * V + i];
  for (let j = 0; j <= pm; j++) {
    for (let i = 0; i <= pn; i++) {
      let x = x0 + pi0 * step + i * ps, z = z0 + pj0 * step + j * ps;
      const k = j * PV + i;
      const edgeI = i === 0 || i === pn, edgeJ = j === 0 || j === pm;
      let y;
      if (edgeI || edgeJ) {
        // On the border, sit exactly on the big grid's edge line.
        const gi = pi0 + Math.floor(i / S), gj = pj0 + Math.floor(j / S);
        if (edgeI) {
          const ii = pi0 + (i === 0 ? 0 : pn / S), f = (j % S) / S;
          y = j === pm ? big(ii, pj1) : lerp(big(ii, gj), big(ii, gj + 1), f);
        } else {
          const jj = pj0 + (j === 0 ? 0 : pm / S), f = (i % S) / S;
          y = i === pn ? big(pi1, jj) : lerp(big(gi, jj), big(gi + 1, jj), f);
        }
      } else {
        x += (hash2(i + 5003, j) - 0.5) * ps * 0.5;
        z += (hash2(j + 7919, i + 11) - 0.5) * ps * 0.5;
        y = heightAt(x, z);
      }
      PX[k] = x; PY[k] = y; PZ[k] = z;
    }
  }
  const pv = (k) => [PX[k], PY[k], PZ[k]];
  for (let j = 0; j < pm; j++) {
    for (let i = 0; i < pn; i++) {
      const a = j * PV + i, b = a + 1, d = a + PV, e = d + 1;
      if ((i + j) % 2 === 0) { tri(...pv(a), ...pv(d), ...pv(b), true); tri(...pv(b), ...pv(d), ...pv(e), true); } else { tri(...pv(a), ...pv(d), ...pv(e), true); tri(...pv(a), ...pv(e), ...pv(b), true); }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  // The whole seabed is kept now, so the underwater view has a floor everywhere.
  const mesh = new THREE.Mesh(geo, withSurface(withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true })), 'ground'));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

/* ---------------- vegetation & rocks ---------------- */

function treeGeometries() {
  const leafy = (c1, c2, c3) => mergeParts([
    { geo: new THREE.CylinderGeometry(0.14, 0.22, 1.9, 5), matrix: mat(0, 0.95, 0), color: '#7a5a3e' },
    { geo: new THREE.IcosahedronGeometry(1.45, 0), matrix: mat(0, 2.75, 0), color: c1 },
    { geo: new THREE.IcosahedronGeometry(1.0, 0), matrix: mat(0.75, 2.3, 0.35), color: c2 },
    { geo: new THREE.IcosahedronGeometry(1.05, 0), matrix: mat(-0.6, 2.4, -0.45), color: c3 },
  ]);
  return {
    pine: mergeParts([
      { geo: new THREE.CylinderGeometry(0.12, 0.2, 1.6, 5), matrix: mat(0, 0.8, 0), color: '#76563c' },
      { geo: new THREE.ConeGeometry(1.35, 2.3, 7), matrix: mat(0, 2.1, 0), color: '#4f7f55' },
      { geo: new THREE.ConeGeometry(1.05, 2.0, 7), matrix: mat(0, 3.15, 0, 0, 0.4, 0), color: '#5a8b5b' },
      { geo: new THREE.ConeGeometry(0.72, 1.6, 7), matrix: mat(0, 4.1, 0, 0, 0.9, 0), color: '#679860' },
    ]),
    round: leafy('#7fae5a', '#8cb862', '#76a556'),
    blossom: leafy('#f2b6c4', '#eba2b6', '#f7cad3'),
    bush: mergeParts([
      { geo: new THREE.IcosahedronGeometry(0.75, 0), matrix: mat(0, 0.35, 0, 0, 0, 0, 1, 0.75, 1), color: '#7aa957' },
      { geo: new THREE.IcosahedronGeometry(0.55, 0), matrix: mat(0.5, 0.3, 0.2), color: '#88b55f' },
    ]),
  };
}

function scatterTrees(rnd, avoid, skip) {
  const lists = { pine: [], round: [], blossom: [], bush: [] };
  for (let z = -300; z < 200; z += 4.2) {
    for (let x = -300; x < 300; x += 4.2) {
      const px = x + (rnd() - 0.5) * 4, pz = z + (rnd() - 0.5) * 4;
      const h = heightAt(px, pz);
      if (h < 1.6 || h > 50) continue;
      if (avoid.some((a) => Math.hypot(px - a.x, pz - a.z) < a.r)) continue;
      if (skip(px, pz)) continue;
      const hx = heightAt(px + 1, pz) - heightAt(px - 1, pz);
      const hz = heightAt(px, pz + 1) - heightAt(px, pz - 1);
      if (Math.hypot(hx, hz) / 2 > 0.7) continue;
      const dens = fbm(px * 0.018 + 11, pz * 0.018 - 4, 3);
      const onIsland = Math.hypot(px - ISLAND.x, pz - ISLAND.z) < ISLAND.r + 2;
      if (rnd() > (onIsland ? 0.3 : 0.22 + dens * 0.9)) continue;
      const t = { x: px, y: h - 0.2, z: pz, s: 0.75 + rnd() * 0.6, r: rnd() * Math.PI * 2 };
      let type;
      if (h < 2.6 && rnd() < 0.5) type = 'bush';
      else if (onIsland) type = rnd() < 0.3 ? 'blossom' : 'round';
      else if (h > 13 + dens * 8) type = rnd() < 0.85 ? 'pine' : 'round';
      else type = rnd() < 0.05 ? 'blossom' : rnd() < 0.55 ? 'round' : 'pine';
      lists[type].push(t);
    }
  }
  return lists;
}

function instanced(geo, list, material, rnd, { tint = 0.12, tilt = 0, squash = 1 } = {}) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(list.length, 1));
  m.count = list.length;
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  list.forEach((t, i) => {
    o.position.set(t.x, t.y, t.z);
    o.rotation.set((rnd() - 0.5) * tilt, t.r, (rnd() - 0.5) * tilt);
    o.scale.set(t.s, t.s * (squash === 1 ? 1 : squash + rnd() * (1 - squash)), t.s);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (t.color) c.set(t.color);
    else {
      const v = 1 - tint + rnd() * tint * 2;
      c.setRGB(v * (0.97 + rnd() * 0.06), v, v * (0.95 + rnd() * 0.08));
    }
    m.setColorAt(i, c);
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = true;
  m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}

function scatterRocks(rnd) {
  const list = [];
  for (let i = 0; i < 16000 && list.length < 240; i++) {
    const x = rnd() * 560 - 280, z = rnd() * 460 - 290;
    const h = heightAt(x, z);
    if (h < -1.2 || h > 2.2) continue;
    if (fbm(x * 0.04 + 7, z * 0.04, 2) < 0.12) continue;
    list.push({ x, y: h - 0.25, z, s: 0.5 + rnd() * 1.3, r: rnd() * 6.28 });
  }
  // Rocky lips along the cove channel make it feel tucked away.
  for (const c of CHANNEL) {
    for (let i = 0; i < 26; i++) {
      const t = rnd();
      const x = c[0] + (c[2] - c[0]) * t + (rnd() - 0.5) * 18, z = c[1] + (c[3] - c[1]) * t + (rnd() - 0.5) * 18;
      const h = heightAt(x, z);
      if (h < -0.6 || h > 4) continue;
      list.push({ x, y: h - 0.3, z, s: 0.8 + rnd() * 1.4, r: rnd() * 6.28 });
    }
  }
  return list;
}

/* ---------------- the old jetty ---------------- */

function buildJetty(rnd) {
  const { x, z0, z1, deck } = JETTY;
  const parts = [];
  const len = z1 - z0;
  const PLANKS = ['#b48d63', '#a57f59', '#c09a70', '#9d7a58', '#b89268'];
  const n = Math.floor(len / 0.34);
  for (let i = 0; i < n; i++) {
    if (i === n - 10) continue; // one plank went missing years ago
    const z = z0 + 0.17 + i * 0.34;
    const tilt = i === n - 16 ? 0.08 : (rnd() - 0.5) * 0.03;
    parts.push({
      geo: new THREE.BoxGeometry(2.5 + (rnd() - 0.5) * 0.12, 0.07, 0.3),
      matrix: mat(x + (rnd() - 0.5) * 0.06, deck + (rnd() - 0.5) * 0.015, z, 0, (rnd() - 0.5) * 0.03, tilt),
      color: pick(PLANKS, rnd),
      jitter: 0.04,
    });
  }
  for (const sx of [-0.85, 0.85]) {
    parts.push({ geo: new THREE.BoxGeometry(0.16, 0.2, len), matrix: mat(x + sx, deck - 0.14, (z0 + z1) / 2), color: '#6e5238' });
  }
  for (let z = z0 + 0.6; z <= z1 + 0.01; z += 2.3) {
    for (const sx of [-1.18, 1.18]) {
      const px = x + sx;
      const ground = heightAt(px, z);
      const bottom = Math.min(ground, 0) - 0.6;
      const top = deck + 0.28 + rnd() * 0.12;
      const lean = (rnd() - 0.5) * 0.05;
      parts.push({ geo: new THREE.CylinderGeometry(0.11, 0.13, top - 0.15, 6), matrix: mat(px, (top + 0.15) / 2, z, lean, 0, lean), color: '#6a503b' });
      parts.push({ geo: new THREE.CylinderGeometry(0.135, 0.14, 0.15 - bottom, 6), matrix: mat(px, (0.15 + bottom) / 2, z), color: '#4f5b3d' });
    }
    parts.push({ geo: new THREE.BoxGeometry(2.5, 0.14, 0.14), matrix: mat(x, deck - 0.28, z), color: '#634a35' });
  }
  const ez = z1 - 0.35;
  for (const sx of [-1.0, 1.0]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.12, 0.14, 0.32, 8), matrix: mat(x + sx, deck + 0.2, ez - 1.2), color: '#4a3f36' });
  }
  parts.push({ geo: new THREE.TorusGeometry(0.2, 0.06, 5, 12), matrix: mat(x - 0.6, deck + 0.07, ez - 1.9, Math.PI / 2, 0, 0), color: '#d8c49a' });
  parts.push({ geo: new THREE.TorusGeometry(0.13, 0.055, 5, 10), matrix: mat(x - 0.6, deck + 0.14, ez - 1.9, Math.PI / 2, 0, 0), color: '#cfb98e' });
  parts.push({ geo: new THREE.BoxGeometry(0.6, 0.5, 0.6), matrix: mat(x + 0.65, deck + 0.28, z0 + 4, 0, 0.2, 0), color: '#b0875a' });
  parts.push({ geo: new THREE.BoxGeometry(0.5, 0.42, 0.5), matrix: mat(x + 0.62, deck + 0.74, z0 + 4.05, 0, -0.3, 0), color: '#a47b50' });
  parts.push({ geo: new THREE.CylinderGeometry(0.28, 0.25, 0.7, 10), matrix: mat(x - 0.7, deck + 0.38, z0 + 5.5), color: '#8c5e3c' });

  // Lamp post at the end of the jetty
  const lx = x + 1.02, lz = ez;
  parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.08, 2.5, 6), matrix: mat(lx, deck + 1.25, lz), color: '#3e3a36' });
  parts.push({ geo: new THREE.BoxGeometry(0.06, 0.06, 0.52), matrix: mat(lx, deck + 2.44, lz + 0.24), color: '#3e3a36' });

  // A bench on the island, looking out over the bay
  const bx = x - 2.8, bz = z0 + 1.2;
  const by = heightAt(bx, bz);
  parts.push({ geo: new THREE.BoxGeometry(1.4, 0.06, 0.4), matrix: mat(bx, by + 0.45, bz), color: '#a98258' });
  parts.push({ geo: new THREE.BoxGeometry(1.4, 0.3, 0.05), matrix: mat(bx, by + 0.72, bz - 0.2, -0.15, 0, 0), color: '#9f7a52' });
  for (const sx of [-0.6, 0.6]) parts.push({ geo: new THREE.BoxGeometry(0.06, 0.5, 0.36), matrix: mat(bx + sx, by + 0.2, bz), color: '#6e5238' });

  const mesh = new THREE.Mesh(mergeParts(parts, rnd), withSurface(new THREE.MeshLambertMaterial({ vertexColors: true }), 'wood', { axis: 'x' }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const lamp = buildLanternModel();
  lamp.group.position.set(lx, deck + 2.42, lz + 0.46);
  lamp.group.scale.setScalar(1.35);
  const light = new THREE.PointLight('#ffb35c', 0, 26, 1.6);
  light.position.set(lx, deck + 2.12, lz + 0.46);
  return { mesh, lamp, light, lampPos: light.position.clone(), bench: { x: bx, z: bz } };
}

/* ---------------- Driftwood Cove ---------------- */

function buildCove(rnd) {
  const parts = [];
  const ang = -Math.PI / 2 - 0.42;
  const shore = findShore(COVE.x, COVE.z, ang, 0.25);
  const sx = shore.x + Math.cos(ang) * 1.6, sz = shore.z + Math.sin(ang) * 1.6;
  const gy = heightAt(sx, sz);
  const toC = new THREE.Vector3(COVE.x - sx, 0, COVE.z - sz).normalize();
  const DRIFT = ['#cdbfa8', '#c4b49b', '#d6cab5', '#bba98f'];

  // The bleached post the lantern is tangled on
  const base = new THREE.Vector3(sx, gy - 0.3, sz);
  const top = new THREE.Vector3(sx + toC.x * 0.25, gy + 2.1, sz + toC.z * 0.25);
  parts.push({ ...beam(base, top, 0.15, 0.08), color: '#cfc2ab' });
  const bStart = new THREE.Vector3().lerpVectors(base, top, 0.8);
  const bEnd = bStart.clone().add(new THREE.Vector3(toC.x * 0.75, 0.22, toC.z * 0.75));
  parts.push({ ...beam(bStart, bEnd, 0.06, 0.035), color: '#c8b9a1' });

  // Driftwood logs strewn along the beach
  for (let i = 0; i < 12; i++) {
    const a = ang + (i - 5.5) * 0.3 + (rnd() - 0.5) * 0.12;
    const s = findShore(COVE.x, COVE.z, a, 0.12);
    if (!s) continue;
    const d = 0.4 + rnd() * 2.6;
    const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
    const r = 0.1 + rnd() * 0.13, len = 1.6 + rnd() * 2.2;
    const yaw = a + Math.PI / 2 + (rnd() - 0.5) * 0.9;
    const y = heightAt(x, z) + r * 0.6;
    parts.push({ geo: new THREE.CylinderGeometry(r * 0.8, r, len, 6), matrix: mat(x, y, z, 0, yaw, Math.PI / 2 + (rnd() - 0.5) * 0.1), color: pick(DRIFT, rnd) });
    if (rnd() < 0.5) {
      parts.push({ geo: new THREE.CylinderGeometry(r * 0.3, r * 0.5, len * 0.35, 5), matrix: mat(x, y + 0.15, z, 0.6, yaw + 0.5, Math.PI / 2 - 0.5), color: pick(DRIFT, rnd) });
    }
  }
  const drift = new THREE.Mesh(mergeParts(parts, rnd), new THREE.MeshLambertMaterial({ vertexColors: true }));
  drift.castShadow = true;
  drift.receiveShadow = true;

  const lantern = buildLanternModel();
  lantern.group.position.copy(bEnd).add(new THREE.Vector3(0, -0.04, 0));
  lantern.group.rotation.z = 0.12;
  lantern.glassMat.emissiveIntensity = 0.15;

  // Shells and flowers
  const shells = [], flowers = [], reeds = [];
  for (let i = 0; i < 400 && shells.length < 60; i++) {
    const a = rnd() * Math.PI * 2;
    const s = findShore(COVE.x, COVE.z, a, 0.05);
    if (!s) continue;
    const d = rnd() * 3.5;
    const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
    const h = heightAt(x, z);
    if (h < 0.05 || h > 1.1) continue;
    shells.push({ x, y: h + 0.02, z, s: 0.7 + rnd() * 0.8, r: rnd() * 6.28, color: pick(['#fbe7dc', '#f6d2c4', '#fff4e6', '#f3c9b0', '#e9d8f0'], rnd) });
  }
  for (let i = 0; i < 300 && reeds.length < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const s = findShore(COVE.x, COVE.z, a, -0.45);
    if (!s) continue;
    const x = s.x + (rnd() - 0.5) * 2, z = s.z + (rnd() - 0.5) * 2;
    const h = heightAt(x, z);
    if (h < -0.5 || h > 0.4) continue;
    reeds.push({ x, y: h - 0.1, z, s: 0.8 + rnd() * 0.6, r: rnd() * 6.28 });
  }
  const meadows = [
    { x: ISLAND.x, z: ISLAND.z, r: ISLAND.r, n: 170 },
    { x: COVE.x, z: COVE.z, r: COVE.r + 22, n: 160 },
  ];
  const FLOWERS = ['#f7b9c8', '#ffffff', '#ffe08a', '#d6c2f2', '#ffc9a3'];
  for (const m of meadows) {
    let placed = 0;
    for (let i = 0; i < m.n * 8 && placed < m.n; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * m.r;
      const x = m.x + Math.cos(a) * r, z = m.z + Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h < 1.5 || h > 9) continue;
      flowers.push({ x, y: h + 0.05, z, s: 0.7 + rnd() * 0.6, r: 0, color: pick(FLOWERS, rnd) });
      placed++;
    }
  }

  const shellGeo = mergeParts([
    { geo: new THREE.ConeGeometry(0.08, 0.05, 7), matrix: mat(0, 0.02, 0, 0, 0, 0, 1, 1, 0.8), color: '#ffffff', jitter: 0.1 },
  ]);
  const flowerGeo = mergeParts([
    { geo: new THREE.CylinderGeometry(0.01, 0.01, 0.25, 3), matrix: mat(0, 0.12, 0), color: '#6f9a4e' },
    { geo: new THREE.IcosahedronGeometry(0.075, 0), matrix: mat(0, 0.27, 0), color: '#ffffff', jitter: 0 },
  ]);
  const reedGeo = mergeParts(Array.from({ length: 6 }, (_, i) => ({
    geo: new THREE.ConeGeometry(0.035, 1.1 + (i % 3) * 0.25, 3),
    matrix: mat(Math.cos(i * 1.7) * 0.18, 0.6, Math.sin(i * 1.7) * 0.18, Math.cos(i) * 0.12, 0, Math.sin(i) * 0.12),
    color: i % 2 ? '#8f9d5c' : '#a5a96b',
  })));

  const sway = swayMaterial();
  const plain = new THREE.MeshLambertMaterial({ vertexColors: true });
  const group = new THREE.Group();
  group.add(
    drift,
    lantern.group,
    instanced(shellGeo, shells, plain, rnd, { tilt: 0.4 }),
    instanced(flowerGeo, flowers, sway, rnd),
    instanced(reedGeo, reeds, sway, rnd, { tint: 0.1, tilt: 0.15 }),
  );

  // A soft glint so the lantern catches the eye from the water
  const sparkle = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,236,190,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  sparkle.position.copy(lantern.group.position).add(new THREE.Vector3(0, -0.2, 0));
  sparkle.scale.setScalar(1.2);
  group.add(sparkle);

  return { group, lantern, sparkle, spot: new THREE.Vector3(sx, gy, sz) };
}

/* ---------------- Gull Rock ---------------- */

function buildStacks(rnd) {
  const parts = [];
  const ROCK = ['#a1968a', '#9a8f84', '#a89d90', '#958a80'];
  for (const s of STACKS) {
    let y = -5, r = s.r * 1.15;
    const layers = 5;
    const hgt = (s.h + 5) / layers;
    for (let i = 0; i < layers; i++) {
      const geo = jitterGeo(new THREE.CylinderGeometry(r * 0.86, r, hgt, 7, 1), r * 0.18, rnd);
      parts.push({ geo, matrix: mat(s.x + (rnd() - 0.5) * 0.4, y + hgt / 2, s.z + (rnd() - 0.5) * 0.4, 0, rnd() * 6, 0), color: pick(ROCK, rnd), jitter: 0.07 });
      y += hgt;
      r *= 0.88;
    }
    parts.push({ geo: jitterGeo(new THREE.IcosahedronGeometry(r * 1.05, 0), r * 0.2, rnd), matrix: mat(s.x, y, s.z, 0, 0, 0, 1, 0.45, 1), color: '#e9e3d4' });
    for (let k = 0; k < 4; k++) {
      const a = rnd() * 6.28, d = s.r * (1.1 + rnd() * 0.6);
      parts.push({ geo: jitterGeo(new THREE.DodecahedronGeometry(0.8 + rnd() * 0.9, 0), 0.4, rnd), matrix: mat(s.x + Math.cos(a) * d, -0.2, s.z + Math.sin(a) * d), color: pick(ROCK, rnd) });
    }
  }
  const mesh = new THREE.Mesh(mergeParts(parts, rnd), new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ---------------- distant mountains ---------------- */

function buildMountains(rnd) {
  const parts = [];
  const spots = [
    [-2.75, 560, 150, 240], [-2.35, 520, 200, 280], [-1.95, 600, 250, 320], [-1.6, 540, 190, 260],
    [-1.25, 610, 230, 300], [-0.9, 540, 170, 250], [-0.5, 590, 140, 230], [-0.15, 650, 110, 220],
    [0.55, 720, 60, 190], [2.45, 740, 70, 200],
  ];
  for (const [a, r, h, w] of spots) {
    const geo = jitterGeo(new THREE.ConeGeometry(w, h, 9, 4), w * 0.12, rnd);
    parts.push({
      geo,
      matrix: mat(Math.cos(a) * r * 1.15, h * 0.36 - 14, Math.sin(a) * r * 1.15, 0, rnd() * 6, 0, 1, 0.72, 1),
      color: pick(['#71909a', '#7b98a0', '#6a8790'], rnd),
      jitter: 0.08,
    });
  }
  return new THREE.Mesh(mergeParts(parts, rnd), new THREE.MeshLambertMaterial({ vertexColors: true }));
}

/* ---------------- gulls ---------------- */

function buildGull() {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const body = new THREE.Mesh(mergeParts([
    { geo: new THREE.SphereGeometry(0.22, 7, 5), matrix: mat(0, 0, 0, 0, 0, 0, 0.75, 0.7, 1.6), color: '#f4f2ec', jitter: 0.02 },
    { geo: new THREE.SphereGeometry(0.13, 6, 5), matrix: mat(0, 0.08, 0.36), color: '#f6f4ee', jitter: 0.02 },
    { geo: new THREE.ConeGeometry(0.03, 0.12, 4), matrix: mat(0, 0.06, 0.52, Math.PI / 2, 0, 0), color: '#e8a640' },
    { geo: new THREE.ConeGeometry(0.12, 0.3, 4), matrix: mat(0, 0, -0.42, -Math.PI / 2, 0, 0, 1, 1, 0.4), color: '#d4d6d8' },
  ]), new THREE.MeshLambertMaterial({ vertexColors: true }));
  g.add(body);
  const wingMat = new THREE.MeshLambertMaterial({ color: '#dde1e5', side: THREE.DoubleSide });
  const wing = (s) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0.15, 0, 0, -0.12, 0.55 * s, 0, 0.1,
      0.55 * s, 0, 0.1, 0, 0, -0.12, 1.0 * s, 0, -0.2,
    ], 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, wingMat);
    m.position.set(0.1 * s, 0.05, 0);
    g.add(m);
    return m;
  };
  return { g, wl: wing(1), wr: wing(-1) };
}

/* ---------------- fireflies ---------------- */

function buildFireflies(rnd, spots, count) {
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const s = spots[i % spots.length];
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * s.r;
    const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
    pos[i * 3] = x;
    pos[i * 3 + 1] = Math.max(heightAt(x, z), 0) + 0.5 + rnd() * 2.2;
    pos[i * 3 + 2] = z;
    phase[i] = rnd() * 10;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uOpacity: { value: 0 }, uScale: { value: 90 } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      uniform float uScale;
      varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.5 + aPhase * 3.0) * 0.9;
        p.y += sin(uTime * 0.7 + aPhase * 5.0) * 0.35;
        p.z += cos(uTime * 0.4 + aPhase * 2.0) * 0.9;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = 0.5 + 0.5 * sin(uTime * 2.2 + aPhase * 11.0);
        gl_PointSize = uScale * (0.6 + vA * 0.6) / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.48) * (0.6 + a), a * a * vA * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return points;
}

/* ---------------- obstacles ---------------- */

// A coarse grid of circles, so someone walking only checks the few things near them.
class ObstacleGrid {
  constructor(cell = 4) {
    this.cell = cell;
    this.cells = new Map();
  }

  key(i, j) { return i * 73856093 ^ j * 19349663; }

  // top: how high it stands; you can walk over it on a deck above it.
  add(x, z, r, top = Infinity) {
    const c = this.cell, m = r + 0.6; // margin for the walker's own radius
    const i0 = Math.floor((x - m) / c), i1 = Math.floor((x + m) / c);
    const j0 = Math.floor((z - m) / c), j1 = Math.floor((z + m) / c);
    const o = { x, z, r, top };
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = this.key(i, j);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(o);
      }
    }
  }

  // Push a circle of radius r at (p.x, p.z), with feet at height y, out of anything it overlaps.
  resolve(p, r, y = -Infinity) {
    const list = this.cells.get(this.key(Math.floor(p.x / this.cell), Math.floor(p.z / this.cell)));
    if (!list) return false;
    let hit = false;
    for (const o of list) {
      if (y > o.top) continue;
      const dx = p.x - o.x, dz = p.z - o.z, min = o.r + r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.001;
      p.x = o.x + (dx / d) * min;
      p.z = o.z + (dz / d) * min;
      hit = true;
    }
    return hit;
  }
}

/* ---------------- assemble ---------------- */

export function buildWorld(scene, renderer, habitat) {
  const rnd = seeded(20251022);

  scene.add(buildTerrain(rnd, habitat));

  const jetty = buildJetty(rnd);
  scene.add(jetty.mesh, jetty.lamp.group, jetty.light);

  const cove = buildCove(rnd);
  scene.add(cove.group);

  const shore = buildShore(scene, rnd);

  const avoid = [
    { x: JETTY.x, z: JETTY.z0 - 1, r: 5 },
    { x: jetty.bench.x, z: jetty.bench.z, r: 2.5 },
    { x: cove.spot.x, z: cove.spot.z, r: 5 },
    { x: CAMP.x, z: CAMP.z, r: CAMP.r + 4 },
    { x: LANDING.x, z: LANDING.z, r: 6 },
  ];
  const geos = treeGeometries();
  // Keep the path clear, and leave a few open casting spots along the stream.
  const lists = scatterTrees(rnd, avoid, (x, z) => pathInfo(x, z).d < 2.6 || streamSDF(x, z) < 1.5);
  const sway = swayMaterial();
  for (const k of Object.keys(geos)) scene.add(instanced(geos[k], lists[k], sway, rnd));

  // Things you bump into on foot: tree trunks, bushes, camp gear, big rocks.
  const obstacles = new ObstacleGrid();
  for (const k of ['pine', 'round', 'blossom']) for (const t of lists[k]) obstacles.add(t.x, t.z, 0.28 * t.s);
  for (const t of lists.bush) obstacles.add(t.x, t.z, 0.45 * t.s);
  for (const o of shore.obstacles) obstacles.add(o.x, o.z, o.r);

  const rockGeo = mergeParts([{ geo: jitterGeo(new THREE.DodecahedronGeometry(1, 0), 0.4, rnd), color: '#a39888', jitter: 0.07 }], rnd);
  const rocks = scatterRocks(rnd);
  for (const r of rocks) if (r.s > 0.9 && r.y > -0.6) obstacles.add(r.x, r.z, r.s * 0.75, r.y + r.s * 0.4);
  scene.add(instanced(rockGeo, rocks, withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true })), rnd, { tint: 0.08, tilt: 1.2, squash: 0.5 }));

  scene.add(buildStacks(rnd));
  scene.add(buildMountains(rnd));

  // Gulls circle Gull Rock, a couple more wander over the bay
  const gulls = [];
  const routes = [
    { x: STACKS[0].x, z: STACKS[0].z + 4, r: 16, y: 18, sp: 5.5 },
    { x: STACKS[0].x + 4, z: STACKS[0].z, r: 24, y: 22, sp: -6 },
    { x: STACKS[1].x, z: STACKS[1].z, r: 11, y: 15, sp: 5 },
    { x: STACKS[0].x - 6, z: STACKS[0].z + 8, r: 30, y: 26, sp: 6.5 },
    { x: 20, z: -10, r: 45, y: 24, sp: 6 },
    { x: -10, z: 10, r: 38, y: 20, sp: -5.5 },
  ];
  for (const r of routes) {
    const b = buildGull();
    b.route = r;
    b.a = rnd() * Math.PI * 2;
    b.ph = rnd() * 10;
    scene.add(b.g);
    gulls.push(b);
  }

  const fireflies = buildFireflies(rnd, [
    { x: COVE.x, z: COVE.z, r: COVE.r + 8 },
    { x: COVE.x - 6, z: COVE.z - 14, r: 12 },
    { x: ISLAND.x, z: ISLAND.z, r: ISLAND.r },
  ], 90);
  fireflies.material.uniforms.uScale.value = 90 * renderer.getPixelRatio();
  scene.add(fireflies);

  const lanternPos = cove.lantern.group.position.clone();
  let lanternTaken = false;

  return {
    lanternSpot: lanternPos,
    lampPos: jetty.lampPos,
    shore,
    camp: shore.camp,
    obstacles,
    takeLantern() {
      lanternTaken = true;
      cove.lantern.group.visible = false;
      cove.sparkle.visible = false;
    },
    setPixelRatio(pr) {
      fireflies.material.uniforms.uScale.value = 90 * pr;
      shore.setPixelRatio(pr);
    },
    setQuality(q) {
      shore.setQuality(q);
    },
    update(dt, t, env, extra = {}) {
      shared.uTime.value = t;
      shared.uWind.value = 1 + env.rain * 1.4;
      shore.update(dt, t, env, { ...extra, wind: shared.uWind.value });
      fireflies.material.uniforms.uOpacity.value = env.night * (1 - env.rain * 0.8);

      const lamp = env.lantern;
      jetty.light.intensity = lamp * 32;
      jetty.lamp.glassMat.emissiveIntensity = lamp * 3.2;

      if (!lanternTaken) {
        const tw = 0.6 + 0.4 * Math.sin(t * 2.3) * Math.sin(t * 1.7 + 1);
        cove.sparkle.material.opacity = tw * (0.55 + env.night * 0.45);
        cove.sparkle.scale.setScalar(0.9 + tw * 0.7);
      }

      for (const b of gulls) {
        const r = b.route;
        b.a += (r.sp / r.r) * dt;
        const x = r.x + Math.cos(b.a) * r.r, z = r.z + Math.sin(b.a) * r.r;
        b.g.position.set(x, r.y + Math.sin(t * 0.5 + b.ph) * 1.5, z);
        const dir = Math.sign(r.sp);
        b.g.rotation.y = Math.atan2(-Math.sin(b.a) * dir, Math.cos(b.a) * dir);
        b.g.rotation.z = -0.25 * dir;
        const cycle = (t + b.ph) % 6;
        const flap = cycle < 2.2 ? Math.sin(t * 7 + b.ph) * 0.55 : 0.08 + Math.sin(t * 1.5) * 0.04;
        b.wl.rotation.z = flap;
        b.wr.rotation.z = -flap;
      }
    },
  };
}
