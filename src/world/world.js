import * as THREE from 'three';
import {
  heightAt, JETTY, COVE, ISLAND, STACKS, CHANNEL, CAMP, LANDING, findShore, lakeSDF, streamSDF, pathInfo,
  WORLD, riverSDF, mereSDF, trailInfo, MERE, GANNET, coastPathInfo, HAVEN_APRON, HAVEN_HOUSES, DAYMARK, SHELTER, PUNT, STRAND,
  HOME_PAD, CAR_PARKS, laneInfo,
} from './terrain.js';
import { mergeParts, mat, seeded, fbm, clamp, lerp, smoothstep, hash2, jitterGeo, pick, glowTexture } from '../util.js';
import { buildLanternModel } from '../props.js';
import { withCaustics } from './caustics.js';
import { withSurface } from './surface.js';
import { buildShore, SHORE_PATCH } from './shore.js';
import { buildRegions } from './regions.js';
import { buildCoast } from './coast.js';
import { buildHome, buildGravel } from './home.js';

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
  marsh: new THREE.Color('#9aa25e'),
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

// The estuary is mud and saltmarsh rather than beach; Longmere's banks are like Reedmere's; trails are earth.
function regionColor(c, h, x, z, r, weed) {
  const n = fbm(x * 0.09, z * 0.09, 2);
  const tr = trailInfo(x, z).d;
  if (tr < 1.6 && h > 0.2) {
    c.copy(TC.path).lerp(TC.pathEdge, smoothstep(0.6, 1.6, tr));
    c.multiplyScalar(0.96 + r * 0.08);
    return true;
  }
  const dr = riverSDF(x, z);
  if (dr < 26 && h < 3) {
    if (h < -0.15) c.copy(TC.silt).lerp(TC.wetSand, smoothstep(-1.2, -0.1, h) * 0.5).lerp(TC.siltDeep, smoothstep(1, 4, -h) * 0.6).lerp(TC.weedBed, weed * 0.5);
    else if (h < 0.45) c.copy(TC.mud).lerp(TC.wetSand, clamp(n + 0.4, 0, 1) * 0.6);
    else c.copy(TC.grassDark).lerp(TC.marsh, clamp(0.5 + n, 0, 1));
    c.multiplyScalar(0.96 + r * 0.08);
    return true;
  }
  const dm = mereSDF(x, z);
  if (dm < 14 && h < 4) {
    if (h < -0.15) c.copy(TC.silt).lerp(TC.siltDeep, smoothstep(1, 6, -h)).lerp(TC.weedBed, weed * 0.6);
    else if (h < 1.4) c.copy(TC.mud).lerp(TC.grassDark, smoothstep(-0.1, 1.2, h) * (0.6 + n * 0.4));
    else c.copy(TC.grassDark).lerp(TC.grass, clamp(0.4 + n, 0, 1));
    c.multiplyScalar(0.96 + r * 0.08);
    return true;
  }
  return false;
}

// Home's pad, the lanes and the car parks stay clear of trees and rocks.
const homeClear = (x, z) => (x > HOME_PAD.x0 - 4 && x < HOME_PAD.x1 + 4 && z > HOME_PAD.z0 - 3 && z < HOME_PAD.z1 + 3)
  || laneInfo(x, z).d < 4.5 || Object.values(CAR_PARKS).some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 3);

// Shell Strand's shelf: 1 on the sand, fading to 0 at its grassy back and ends.
const onStrand = (x, z) => smoothstep(30, 18, Math.abs(x - STRAND.x + 2)) * smoothstep(-12, -4, z - STRAND.z) * (z < STRAND.z + 18 ? 1 : 0);

// The coast paths are bare earth, and the ground round Willowhaven's cottages is trodden.
function coastColor(c, h, x, z, r) {
  if (h < 0.3 || x < -96 || x > 200 || z < -125 || z > 40) return false;
  const st = onStrand(x, z);
  if (st > 0.01 && h < 3) {
    const n = fbm(x * 0.12, z * 0.12, 2);
    c.copy(TC.grassLight).lerp(TC.grass, clamp(0.5 + n, 0, 1)).lerp(TC.sand, clamp(st * 1.3 - 0.15 + n * 0.25, 0, 1));
    c.multiplyScalar(0.96 + r * 0.08);
    return true;
  }
  const p = coastPathInfo(x, z).d;
  const nearHouse = z < -96 && z > -122 && x > -36 && x < 44 && HAVEN_HOUSES.some((b) => Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) * 0.5 + 3);
  if (p > 1.6 && !nearHouse) return false;
  const n = fbm(x * 0.09, z * 0.09, 2);
  c.copy(TC.grassLight).lerp(TC.grass, clamp(0.5 + n * 1.2, 0, 1));
  if (nearHouse) c.lerp(TC.trodden, 0.65);
  if (p < 1.6) c.lerp(p < 0.7 ? TC.path : TC.pathEdge, smoothstep(1.6, 0.5, p) * (0.75 + n * 0.15));
  c.multiplyScalar(0.96 + r * 0.08);
  return true;
}

function terrainColor(c, h, ny, x, z, r, weed, shore) {
  const n = fbm(x * 0.05, z * 0.05, 2);
  if (shore && h < 5 && shoreColor(c, h, x, z, r, weed)) return;
  if (x > 100 && h < 5 && regionColor(c, h, x, z, r, weed)) return;
  if (ny > 0.8 && coastColor(c, h, x, z, r)) return;
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

// The land and seabed are drawn as a few meshes: the home waters (with a finer patch over the
// west shore, where the stream is narrow), detailed patches over the estuary, Longmere and
// Gannet Isle, and one coarse sheet for everything else, out to the horizon. Each patch lines up
// with the coarse grid and its border follows the coarse grid's edges exactly, so nothing cracks.
const FAR = 20; // metres per cell of the coarse sheet
export const TERRAIN_PATCHES = [
  { id: 'home', x0: -380, x1: 380, z0: -420, z1: 340, cell: 2.5, jitter: 0.6, shadows: true, inner: SHORE_PATCH, innerSub: 3 },
  { id: 'estuary', x0: 380, x1: 780, z0: -420, z1: 300, cell: 4, jitter: 0.5, shadows: true },
  { id: 'mere', x0: 100, x1: 600, z0: -680, z1: -420, cell: 4, jitter: 0.5, shadows: true },
  { id: 'gannet', x0: -380, x1: -140, z0: 420, z1: 680, cell: 2.5, jitter: 0.5, shadows: true },
];
const FAR_RECT = { x0: -1300, x1: 1500, z0: -1900, z1: 1800 };

function terrainMesh(pos, col, shadows) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  // The whole seabed is kept, so the underwater view has a floor everywhere.
  const mesh = new THREE.Mesh(geo, withSurface(withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true })), 'ground'));
  mesh.receiveShadow = true;
  mesh.castShadow = shadows;
  return mesh;
}

function buildTerrain(rnd, habitat) {
  const c = new THREE.Color();
  const hs = {};
  const meshes = [];
  const makeTri = (pos, col, detailed) => (ax, ay, az, bx, by, bz, dx, dy, dz, shore) => {
    pos.push(ax, ay, az, bx, by, bz, dx, dy, dz);
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = dx - ax, vy = dy - ay, vz = dz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nyn = Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
    const mx = (ax + bx + dx) / 3, mz = (az + bz + dz) / 3, my = (ay + by + dy) / 3;
    terrainColor(c, my, nyn, mx, mz, rnd(), detailed && my < -0.3 ? habitat.sample(mx, mz, hs).weed : 0, shore);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
  };
  const quad = (tri, i, j, A, B, D, E, shore) => {
    if ((i + j) % 2 === 0) { tri(...A, ...D, ...B, shore); tri(...B, ...D, ...E, shore); } else { tri(...A, ...D, ...E, shore); tri(...A, ...E, ...B, shore); }
  };

  // The coarse sheet, with a hole wherever a patch is.
  const farH = (x, z) => heightAt(x, z);
  {
    const pos = [], col = [];
    const tri = makeTri(pos, col, false);
    const nx = (FAR_RECT.x1 - FAR_RECT.x0) / FAR, nz = (FAR_RECT.z1 - FAR_RECT.z0) / FAR;
    const H = new Float32Array((nx + 1) * (nz + 1));
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) H[j * (nx + 1) + i] = farH(FAR_RECT.x0 + i * FAR, FAR_RECT.z0 + j * FAR);
    const v = (i, j) => [FAR_RECT.x0 + i * FAR, H[j * (nx + 1) + i], FAR_RECT.z0 + j * FAR];
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const cx = FAR_RECT.x0 + (i + 0.5) * FAR, cz = FAR_RECT.z0 + (j + 0.5) * FAR;
        if (TERRAIN_PATCHES.some((p) => cx > p.x0 && cx < p.x1 && cz > p.z0 && cz < p.z1)) continue;
        quad(tri, i, j, v(i, j), v(i + 1, j), v(i, j + 1), v(i + 1, j + 1), false);
      }
    }
    const far = terrainMesh(pos, col, false);
    far.userData.far = true;
    meshes.push(far);
  }

  // Each patch: its border vertices sit on the coarse sheet's edges; inside, the land in detail.
  for (const P of TERRAIN_PATCHES) {
    const step = P.cell, N = Math.round((P.x1 - P.x0) / step), M = Math.round((P.z1 - P.z0) / step), V = N + 1;
    const X = new Float32Array(V * (M + 1)), Y = new Float32Array(V * (M + 1)), Z = new Float32Array(V * (M + 1));
    const per = FAR / step; // patch cells per coarse cell
    for (let j = 0; j <= M; j++) {
      for (let i = 0; i <= N; i++) {
        let x = P.x0 + i * step, z = P.z0 + j * step, y;
        const k = j * V + i;
        const edgeI = i === 0 || i === N, edgeJ = j === 0 || j === M;
        if (edgeI || edgeJ) {
          // On the border: straight between the coarse sheet's vertices.
          if (edgeI) {
            const g = Math.floor(j / per), f = (j % per) / per;
            y = lerp(farH(x, P.z0 + g * FAR), farH(x, P.z0 + Math.min(g + 1, M / per) * FAR), f);
          } else {
            const g = Math.floor(i / per), f = (i % per) / per;
            y = lerp(farH(P.x0 + g * FAR, z), farH(P.x0 + Math.min(g + 1, N / per) * FAR, z), f);
          }
        } else {
          x += (hash2(i + P.x0, j) - 0.5) * step * P.jitter;
          z += (hash2(j + 991 + P.z0, i + 37) - 0.5) * step * P.jitter;
          y = heightAt(x, z);
        }
        X[k] = x; Y[k] = y; Z[k] = z;
      }
    }
    const pos = [], col = [];
    const tri = makeTri(pos, col, true);
    const vtx = (k) => [X[k], Y[k], Z[k]];
    const I = P.inner;
    const pi0 = I ? Math.floor((I.x0 - P.x0) / step) : -1, pi1 = I ? Math.ceil((I.x1 - P.x0) / step) : -1;
    const pj0 = I ? Math.floor((I.z0 - P.z0) / step) : -1, pj1 = I ? Math.ceil((I.z1 - P.z0) / step) : -1;
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        if (I && i >= pi0 && i < pi1 && j >= pj0 && j < pj1) continue;
        const a = j * V + i;
        quad(tri, i, j, vtx(a), vtx(a + 1), vtx(a + V), vtx(a + V + 1), false);
      }
    }
    // A finer patch inside (the west shore), its border on this patch's grid.
    if (I) {
      const S = P.innerSub, pn = (pi1 - pi0) * S, pm = (pj1 - pj0) * S, ps = step / S, PV = pn + 1;
      const PX = new Float32Array(PV * (pm + 1)), PY = new Float32Array(PV * (pm + 1)), PZ = new Float32Array(PV * (pm + 1));
      const big = (i, j) => Y[j * V + i];
      for (let j = 0; j <= pm; j++) {
        for (let i = 0; i <= pn; i++) {
          let x = P.x0 + pi0 * step + i * ps, z = P.z0 + pj0 * step + j * ps;
          const k = j * PV + i;
          const edgeI = i === 0 || i === pn, edgeJ = j === 0 || j === pm;
          let y;
          if (edgeI || edgeJ) {
            // On the border: on the straight edge between two of the outer grid's vertices.
            let k0, k1, f;
            if (edgeI) {
              const ii = pi0 + (i === 0 ? 0 : pn / S), gj = pj0 + Math.floor(j / S);
              f = (j % S) / S;
              k0 = gj * V + ii;
              k1 = Math.min(gj + 1, pj1) * V + ii;
            } else {
              const jj = pj0 + (j === 0 ? 0 : pm / S), gi = pi0 + Math.floor(i / S);
              f = (i % S) / S;
              k0 = jj * V + gi;
              k1 = jj * V + Math.min(gi + 1, pi1);
            }
            x = lerp(X[k0], X[k1], f);
            y = lerp(big(k0 % V, Math.floor(k0 / V)), big(k1 % V, Math.floor(k1 / V)), f);
            z = lerp(Z[k0], Z[k1], f);
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
          const a = j * PV + i;
          quad(tri, i, j, pv(a), pv(a + 1), pv(a + PV), pv(a + PV + 1), true);
        }
      }
    }
    const mesh = terrainMesh(pos, col, P.shadows);
    mesh.userData.patch = P.id;
    meshes.push(mesh);
  }
  return meshes;
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

function scatterTrees(rnd, avoid, skip, rect = { x0: -300, x1: 300, z0: -300, z1: 200 }, step = 4.2, thin = 1) {
  const lists = { pine: [], round: [], blossom: [], bush: [] };
  for (let z = rect.z0; z < rect.z1; z += step) {
    for (let x = rect.x0; x < rect.x1; x += step) {
      const px = x + (rnd() - 0.5) * step, pz = z + (rnd() - 0.5) * step;
      const h = heightAt(px, pz);
      if (h < 1.6 || h > 50) continue;
      if (avoid.some((a) => Math.hypot(px - a.x, pz - a.z) < a.r)) continue;
      if (skip(px, pz)) continue;
      const hx = heightAt(px + 1, pz) - heightAt(px - 1, pz);
      const hz = heightAt(px, pz + 1) - heightAt(px, pz - 1);
      if (Math.hypot(hx, hz) / 2 > 0.7) continue;
      const dens = fbm(px * 0.018 + 11, pz * 0.018 - 4, 3);
      const onIsland = Math.hypot(px - ISLAND.x, pz - ISLAND.z) < ISLAND.r + 2;
      if (rnd() > (onIsland ? 0.3 : (0.22 + dens * 0.9) * thin)) continue;
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

// Blue hills far inland, always on the northern horizon wherever you are on the map. They move
// with you (like the sky), and fade into the haze rather than the fog, so they stay in view.
function buildMountains(rnd) {
  const parts = [];
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * 0.08 - (i / 25) * Math.PI * 0.84 + (rnd() - 0.5) * 0.08;
    const r = 1500 + rnd() * 450, h = 140 + rnd() * 260, w = 220 + rnd() * 260;
    const geo = jitterGeo(new THREE.ConeGeometry(w, h, 9, 4), w * 0.12, rnd);
    parts.push({
      geo,
      matrix: mat(Math.cos(a) * r, h * 0.36 - 30, Math.sin(a) * r, 0, rnd() * 6, 0, 1, 0.72, 1),
      color: pick(['#71909a', '#7b98a0', '#6a8790'], rnd),
      jitter: 0.08,
    });
  }
  const mesh = new THREE.Mesh(mergeParts(parts, rnd), new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.85 }));
  mesh.renderOrder = -5;
  mesh.frustumCulled = false;
  return mesh;
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

  // top: how high it stands; you can walk over it on a deck above it. base: where it starts
  // (a tree crown starts above the trunk).
  // kind and name say what it is (a tree, a rock, a building…), for the camp's check of the ground.
  add(x, z, r, top = Infinity, base = -Infinity, kind = 'thing', name = '') {
    const c = this.cell, m = r + 0.6; // margin for the walker's own radius
    const i0 = Math.floor((x - m) / c), i1 = Math.floor((x + m) / c);
    const j0 = Math.floor((z - m) / c), j1 = Math.floor((z + m) / c);
    const o = { x, z, r, top, base, kind, name };
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = this.key(i, j);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(o);
      }
    }
  }

  // Everything whose circle comes within `pad` of (x, z), at any height (for the camp's check).
  near(x, z, pad = 0, out = []) {
    out.length = 0;
    const c = this.cell, i0 = Math.floor((x - pad - 1) / c), i1 = Math.floor((x + pad + 1) / c);
    const j0 = Math.floor((z - pad - 1) / c), j1 = Math.floor((z + pad + 1) / c);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        for (const o of this.cells.get(this.key(i, j)) || []) {
          if (out.includes(o)) continue;
          const min = o.r + pad;
          if ((x - o.x) ** 2 + (z - o.z) ** 2 < min * min) out.push(o);
        }
      }
    }
    return out;
  }

  // Anything at (x, z) whose circle covers the point, with y between its bottom and top
  // (bottom is stored as o.base; 0 if not given).
  hit(x, y, z) {
    const list = this.cells.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!list) return null;
    for (const o of list) {
      if (y > o.top || y < o.base) continue;
      if ((x - o.x) ** 2 + (z - o.z) ** 2 < o.r * o.r) return o;
    }
    return null;
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

  const terrain = buildTerrain(rnd, habitat);
  for (const m of terrain) scene.add(m);
  // Detail far from you (beyond the haze) isn't drawn: the terrain patches, the woods and the
  // reeds of places you're nowhere near. The coarse sheet and the home bay always are.
  const distant = [];
  const watchDistance = (o) => {
    if (!o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (o.isInstancedMesh) o.computeBoundingSphere();
    distant.push(o);
  };
  for (const m of terrain) if (m.userData.patch && m.userData.patch !== 'home') watchDistance(m);

  const jetty = buildJetty(rnd);
  scene.add(jetty.mesh, jetty.lamp.group, jetty.light);

  const cove = buildCove(rnd);
  scene.add(cove.group);

  const shore = buildShore(scene, rnd);
  const regions = buildRegions(scene, rnd);
  regions.group.traverse((o) => { if (o.isInstancedMesh) watchDistance(o); });

  const avoid = [
    { x: JETTY.x, z: JETTY.z0 - 1, r: 5 },
    { x: jetty.bench.x, z: jetty.bench.z, r: 2.5 },
    { x: cove.spot.x, z: cove.spot.z, r: 5 },
    { x: CAMP.x, z: CAMP.z, r: CAMP.r + 4 },
    { x: LANDING.x, z: LANDING.z, r: 6 },
  ];
  const geos = treeGeometries();
  // Keep the path clear, and leave a few open casting spots along the stream.
  // (The cove shore's paths, Willowhaven, the knoll and the strand's shelter are kept clear too.)
  const coastClear = (x, z) => coastPathInfo(x, z).d < 2.6
    || (x > HAVEN_APRON.x0 - 22 && x < HAVEN_APRON.x1 + 22 && z > -124 && z < -88)
    || Math.hypot(x - DAYMARK.x, z - DAYMARK.z) < DAYMARK.r || Math.hypot(x - SHELTER.x, z - SHELTER.z) < 8 || Math.hypot(x - PUNT.x, z - PUNT.z) < 5
    || onStrand(x, z) > 0.2 || homeClear(x, z);
  const lists = scatterTrees(rnd, avoid, (x, z) => pathInfo(x, z).d < 2.6 || streamSDF(x, z) < 1.5 || coastClear(x, z));
  const sway = swayMaterial();
  for (const k of Object.keys(geos)) scene.add(instanced(geos[k], lists[k], sway, rnd));
  // Beyond the bay: woods in the Wend valley and round Longmere (clear of the trail and the
  // banks), trees on Gannet Isle, and thinner woods along the rest of the coast. Each area is its
  // own set of meshes, so the ones out of view aren't drawn.
  const regionSkip = (x, z) => trailInfo(x, z).d < 3 || riverSDF(x, z) < 8 || mereSDF(x, z) < 4 || (x < 380 && x > -380 && z > -420 && z < 340);
  const areas = [
    { x0: 380, x1: 780, z0: -420, z1: 300, step: 5, thin: 0.9 },
    { x0: 100, x1: 600, z0: -680, z1: -420, step: 5, thin: 0.9 },
    { x0: -380, x1: -140, z0: 420, z1: 680, step: 5.5, thin: 0.6 },
    { x0: -900, x1: -380, z0: -700, z1: 300, step: 9, thin: 0.6 },
    { x0: 780, x1: 1100, z0: -700, z1: 200, step: 9, thin: 0.6 },
    { x0: -380, x1: 380, z0: -800, z1: -420, step: 9, thin: 0.6 },
  ];
  const regionTrees = [];
  const TILE = 250;
  const tiles = [];
  for (const A of areas) {
    for (let x = A.x0; x < A.x1; x += TILE) {
      for (let z = A.z0; z < A.z1; z += TILE) tiles.push({ x0: x, x1: Math.min(A.x1, x + TILE), z0: z, z1: Math.min(A.z1, z + TILE), step: A.step, thin: A.thin });
    }
  }
  for (const A of tiles) {
    const L = scatterTrees(rnd, avoid, regionSkip, A, A.step, A.thin);
    regionTrees.push(L);
    for (const k of Object.keys(geos)) {
      if (!L[k].length) continue;
      const m = instanced(geos[k], L[k], sway, rnd);
      scene.add(m);
      watchDistance(m);
    }
  }

  // Things you bump into on foot: tree trunks, bushes, camp gear, big rocks.
  const obstacles = new ObstacleGrid();
  for (const L of [lists, ...regionTrees]) {
    for (const k of ['pine', 'round', 'blossom']) for (const t of L[k]) obstacles.add(t.x, t.z, 0.28 * t.s, Infinity, -Infinity, 'tree', 'a tree');
    for (const t of L.bush) obstacles.add(t.x, t.z, 0.45 * t.s, Infinity, -Infinity, 'tree', 'a bush');
  }
  for (const o of shore.obstacles) obstacles.add(o.x, o.z, o.r, Infinity, -Infinity, o.kind || 'thing', o.name || '');
  for (const o of regions.obstacles) obstacles.add(o.x, o.z, o.r, o.top ?? Infinity, -Infinity, o.kind || 'thing', o.name || '');
  // The cove shore: its own seed, so building it never reshuffles anything else.
  const coast = buildCoast(scene, seeded(20261024));
  for (const o of coast.obstacles) obstacles.add(o.x, o.z, o.r, o.top ?? Infinity, -Infinity, o.kind || 'thing', o.name || '');
  // Home and its garage, and the gravel lanes the car drives (their own seed too).
  const home = buildHome(scene, seeded(20261101));
  for (const o of home.obstacles) obstacles.add(o.x, o.z, o.r, o.top ?? Infinity, -Infinity, o.kind || 'thing', o.name || '');
  scene.add(buildGravel(seeded(20261102)));
  // Tree crowns, for casts that clip a branch: radius, and the height band of the leaves.
  const canopy = new ObstacleGrid(6);
  const crown = { pine: [1.25, 1.1, 4.8], round: [1.5, 1.3, 3.8], blossom: [1.5, 1.3, 3.8] };
  for (const L of [lists, ...regionTrees]) {
    for (const k of ['pine', 'round', 'blossom']) {
      for (const t of L[k]) {
        const [r, lo, hi] = crown[k];
        canopy.add(t.x, t.z, r * t.s, t.y + hi * t.s, t.y + lo * t.s);
      }
    }
  }

  const rockGeo = mergeParts([{ geo: jitterGeo(new THREE.DodecahedronGeometry(1, 0), 0.4, rnd), color: '#a39888', jitter: 0.07 }], rnd);
  const rocks = scatterRocks(rnd).filter((r) => !homeClear(r.x, r.z));
  for (const r of rocks) if (r.s > 0.9 && r.y > -0.6) obstacles.add(r.x, r.z, r.s * 0.75, r.y + r.s * 0.4, -Infinity, 'rock', 'rocks');
  scene.add(instanced(rockGeo, rocks, withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true })), rnd, { tint: 0.08, tilt: 1.2, squash: 0.5 }));

  scene.add(buildStacks(rnd));
  const mountains = buildMountains(rnd);
  scene.add(mountains);

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

  // Seabirds that come down on shoals feeding at the surface: a pool of gulls that circle and
  // dive over a spot for a while, then drift off. Set by the fish (see ecosystem clues).
  const flockBirds = [];
  for (let i = 0; i < 12; i++) {
    const b = buildGull();
    b.g.visible = false;
    b.g.scale.setScalar(1.1);
    scene.add(b.g);
    flockBirds.push({ ...b, a: rnd() * 6.28, ph: rnd() * 10, flock: null });
  }
  const flocks = [];

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
    boxes: regions.boxes,
    coast,
    home,
    // Birds over feeding fish: a flock gathers over (x, z) for a while (or freshens if one is there).
    birdsAt(x, z) {
      const near = flocks.find((f) => Math.hypot(f.x - x, f.z - z) < 40);
      if (near) {
        near.x = x;
        near.z = z;
        near.t = Math.min(near.t, 2);
        return;
      }
      const free = flockBirds.filter((b) => !b.flock).slice(0, 6);
      if (free.length < 3) return;
      const f = { x, z, t: 0, life: 24 };
      flocks.push(f);
      for (const b of free) {
        b.flock = f;
        b.r = 8 + Math.random() * 10;
        b.y0 = 10 + Math.random() * 8;
        b.sp = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 2);
        b.g.visible = true;
      }
    },
    get flocks() { return flocks; },
    // A tree crown at this point in the air? (Casts that fly through one stop there.)
    canopyAt: (x, y, z) => canopy.hit(x, y, z),
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
      if (extra.camera) {
        const cp = extra.camera.position;
        for (const o of distant) {
          const b = o.isInstancedMesh ? o.boundingSphere : o.geometry.boundingSphere;
          if (!b) continue;
          o.visible = Math.hypot(b.center.x - cp.x, b.center.z - cp.z) - b.radius < 650;
        }
        mountains.position.set(extra.camera.position.x, 0, extra.camera.position.z);
        if (extra.fog) mountains.material.emissive.copy(extra.fog).multiplyScalar(0.55);
      }
      shared.uWind.value = 1 + env.rain * 1.4;
      shore.update(dt, t, env, { ...extra, wind: shared.uWind.value });
      regions.update(dt, t, env);
      coast.update(dt, t, env);
      fireflies.material.uniforms.uOpacity.value = env.night * (1 - env.rain * 0.8);

      const lamp = env.lantern;
      jetty.light.intensity = lamp * 32;
      jetty.lamp.glassMat.emissiveIntensity = lamp * 3.2;

      if (!lanternTaken) {
        const tw = 0.6 + 0.4 * Math.sin(t * 2.3) * Math.sin(t * 1.7 + 1);
        cove.sparkle.material.opacity = tw * (0.55 + env.night * 0.45);
        cove.sparkle.scale.setScalar(0.9 + tw * 0.7);
      }

      // The flocks over feeding fish: circling, and every so often one folds and dives.
      for (let i = flocks.length - 1; i >= 0; i--) {
        const f = flocks[i];
        f.t += dt;
        if (f.t > f.life) {
          for (const b of flockBirds) if (b.flock === f) { b.flock = null; b.g.visible = false; }
          flocks.splice(i, 1);
        }
      }
      for (const b of flockBirds) {
        if (!b.flock) continue;
        const f = b.flock;
        const fade = Math.min(1, f.t / 3, (f.life - f.t) / 3);
        b.a += (b.sp / b.r) * dt;
        const cycle = (t * 0.35 + b.ph) % 4;
        const dive = cycle < 0.6 ? Math.sin((cycle / 0.6) * Math.PI) : 0;
        const y = (b.y0 + 30 * (1 - fade)) * (1 - dive * 0.9) + 0.5;
        b.g.position.set(f.x + Math.cos(b.a) * b.r, y, f.z + Math.sin(b.a) * b.r);
        const dir = Math.sign(b.sp);
        b.g.rotation.y = Math.atan2(-Math.sin(b.a) * dir, Math.cos(b.a) * dir);
        b.g.rotation.x = dive * 1.2;
        b.g.rotation.z = -0.3 * dir;
        const flap = dive ? 0.9 : Math.sin(t * 8 + b.ph) * 0.5;
        b.wl.rotation.z = flap;
        b.wr.rotation.z = -flap;
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
