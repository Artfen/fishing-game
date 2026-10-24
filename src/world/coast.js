import * as THREE from 'three';
import {
  heightAt, HAVEN, HAVEN_APRON, HAVEN_HOUSES, HAVEN_QUAY, SLIPWAY, HAVEN_BOARD, HAVEN_BENCH, HAVEN_LAMP,
  DAYMARK, STRAND, PUNT, SHELTER, WRECK, WRECK_BUOY, CHANNEL, COVE,
} from './terrain.js';
import { waveHeight } from './conditions.js';
import { mergeParts, mat, pick, jitterGeo, glowTexture, clamp, smoothstep } from '../util.js';
import { reedClump } from './shore.js';
import { withSurface } from './surface.js';
import { withCaustics } from './caustics.js';

// The cove shore, built from the map in terrain.js: Willowhaven (a stone quay and sea wall, a
// slipway, the chandlery, a net store and three cottages, a notice board, a bench under a lamp,
// lobster pots and fish boxes), the old punt and the reeds at the head of Driftwood Cove, the
// daymark and ledges on Cove Head, the driftwood shelter on Shell Strand, and the Kittiwake on
// the reef under her buoy. All of it is made here from simple shapes (no outside models).

const wood = () => withSurface(new THREE.MeshLambertMaterial({ vertexColors: true }), 'wood', { axis: 'x' });
const plain = () => new THREE.MeshLambertMaterial({ vertexColors: true });
const STONE = ['#a59d90', '#9a9286', '#b0a898', '#8f887d'];
const ROOF = ['#4d5157', '#565b62', '#474b50'];

function mesh(geo, material, shadows = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

// A matrix placing a part in a frame at (x, y, z) turned by yaw (local +z along the yaw).
function placed(x, y, z, yaw, lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return mat(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, rx, yaw + ry, rz, sx, sy, sz);
}
const local = (x, z, yaw, lx, lz) => {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: x + lx * c + lz * s, z: z - lx * s + lz * c };
};

// A gable roof (a triangular prism) over a w × d box whose eaves are at y, ridge along local x.
function gable(w, d, rise) {
  const hw = w / 2 + 0.25, hd = d / 2 + 0.3;
  const g = new THREE.BufferGeometry();
  const P = [
    [-hw, 0, -hd], [hw, 0, -hd], [hw, rise, 0], [-hw, rise, 0], // back slope
    [-hw, rise, 0], [hw, rise, 0], [hw, 0, hd], [-hw, 0, hd], // front slope
  ];
  const v = [];
  const quad = (a, b, c, d) => v.push(...P[a], ...P[b], ...P[c], ...P[a], ...P[c], ...P[d]);
  quad(0, 3, 2, 1);
  quad(4, 7, 6, 5);
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}
// The triangular gable ends of a wall box (to close the roof space).
function gableEnds(w, d, rise) {
  const hw = w / 2, hd = d / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    -hw, 0, -hd, -hw, 0, hd, -hw, rise, 0,
    hw, 0, hd, hw, 0, -hd, hw, rise, 0,
  ], 3));
  return g;
}

function textTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const paint = () => {
    draw(c.getContext('2d'), w, h);
    tex.needsUpdate = true;
  };
  paint();
  document.fonts?.ready?.then(paint).catch(() => {});
  return { tex, canvas: c, repaint: paint };
}

/* ---------------- Willowhaven ---------------- */

function buildHaven(rnd, group, obstacles, spots) {
  const stone = [], woodParts = [], roofs = [], walls = [], dark = [];
  const A = HAVEN_APRON, ay = A.h;

  // The apron: setts laid level, with a kerb along the sea wall.
  {
    const g = new THREE.PlaneGeometry(A.x1 - A.x0, A.z1 - A.z0, 1, 1).rotateX(-Math.PI / 2);
    const tex = textTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#9d968a';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) {
        for (let x = (y / 8) % 2 ? -6 : 0; x < w; x += 12) {
          const v = 140 + Math.floor(rnd() * 30);
          ctx.fillStyle = `rgb(${v},${v - 6},${v - 14})`;
          ctx.fillRect(x + 1, y + 1, 10, 6);
        }
      }
    });
    tex.tex.wrapS = tex.tex.wrapT = THREE.RepeatWrapping;
    tex.tex.repeat.set((A.x1 - A.x0) / 6, (A.z1 - A.z0) / 1.5);
    const apron = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex.tex }));
    apron.position.set((A.x0 + A.x1) / 2, ay + 0.015, (A.z0 + A.z1) / 2);
    apron.receiveShadow = true;
    group.add(apron);
  }
  // The sea wall: dressed stone from the beach up to the apron, gaps for the slipway and quay.
  const Q = HAVEN_QUAY, S = SLIPWAY;
  for (let x = A.x0; x < A.x1; x += 1.0) {
    const mid = x + 0.5;
    if (Math.abs(mid - S.x) < S.w / 2 || (mid > Q.x0 && mid < Q.x1)) continue;
    const base = Math.min(heightAt(mid, A.z1 + 0.6), 0) - 0.8;
    const top = ay + 0.25;
    stone.push({ geo: new THREE.BoxGeometry(1.02, top - base, 0.7), matrix: mat(mid, (top + base) / 2, A.z1 + 0.25), color: pick(STONE, rnd), jitter: 0.05 });
    stone.push({ geo: new THREE.BoxGeometry(1.02, 0.12, 0.8), matrix: mat(mid, top + 0.06, A.z1 + 0.25), color: '#b9b2a4', jitter: 0.03 });
  }
  // The quay: a stone pier on a rubble foot, bollards along it and a light at the end.
  {
    const len = Q.z1 - Q.z0, cx = (Q.x0 + Q.x1) / 2, cz = (Q.z0 + Q.z1) / 2, w = Q.x1 - Q.x0;
    const bed = Math.min(heightAt(cx, Q.z1), -1) - 0.6;
    stone.push({ geo: new THREE.BoxGeometry(w, Q.deck - bed, len), matrix: mat(cx, (Q.deck + bed) / 2, cz), color: '#9a9286', jitter: 0.04 });
    for (let z = Q.z0 + 0.6; z < Q.z1; z += 1.2) stone.push({ geo: new THREE.BoxGeometry(w + 0.04, 0.1, 1.15), matrix: mat(cx, Q.deck + 0.05, z), color: pick(STONE, rnd), jitter: 0.04 });
    for (let z = Q.z0 + 3; z < Q.z1 - 0.5; z += 3.5) {
      for (const s of [-1, 1]) {
        dark.push({ geo: new THREE.CylinderGeometry(0.13, 0.17, 0.5, 8), matrix: mat(cx + s * (w / 2 - 0.3), Q.deck + 0.25, z), color: '#2f3236' });
        obstacles.push({ x: cx + s * (w / 2 - 0.3), z, r: 0.2, top: Q.deck + 0.55, kind: 'quay', name: 'a bollard' });
      }
    }
    // Ladders down to the water.
    for (const s of [-1, 1]) {
      for (let y = Q.deck - 0.2; y > -1.2; y -= 0.3) dark.push({ geo: new THREE.BoxGeometry(0.05, 0.04, 0.5), matrix: mat(cx + s * (w / 2 + 0.03), y, Q.z1 - 4), color: '#3a3d40' });
    }
    // The light at the end (green, lit after dark).
    stone.push({ geo: new THREE.CylinderGeometry(0.3, 0.38, 1.4, 8), matrix: mat(cx, Q.deck + 0.7, Q.z1 - 0.6), color: '#e7e1d4', jitter: 0.02 });
    obstacles.push({ x: cx, z: Q.z1 - 0.6, r: 0.45, top: Q.deck + 1.5, kind: 'quay', name: 'the quay light' });
  }
  // The slipway: setts down into the water, with a winch post at the top.
  {
    const S2 = SLIPWAY;
    for (let z = A.z1 - 0.5; z < A.z1 + S2.len; z += 0.5) {
      const y = heightAt(S2.x, z);
      stone.push({ geo: new THREE.BoxGeometry(S2.w, 0.12, 0.52), matrix: mat(S2.x, y + 0.02, z, Math.atan2(heightAt(S2.x, z - 0.4) - heightAt(S2.x, z + 0.4), 0.8), 0, 0), color: pick(['#8f897f', '#9b9489', '#857f75'], rnd), jitter: 0.06 });
    }
    woodParts.push({ geo: new THREE.CylinderGeometry(0.12, 0.14, 1.1, 8), matrix: mat(S2.x + S2.w / 2 + 0.6, ay + 0.55, A.z1 - 1.4), color: '#6a503b' });
    dark.push({ geo: new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10), matrix: mat(S2.x + S2.w / 2 + 0.6, ay + 0.95, A.z1 - 1.4, 0, 0, Math.PI / 2), color: '#3a3d40' });
    obstacles.push({ x: S2.x + S2.w / 2 + 0.6, z: A.z1 - 1.4, r: 0.3, kind: 'harbour', name: 'the winch' });
  }

  // The buildings.
  const windows = [];
  let sign = null;
  for (const b of HAVEN_HOUSES) {
    const y = heightAt(b.x, b.z) - 0.05;
    const wallH = b.kind === 'cottage' ? 3.0 : 2.6, rise = b.kind === 'cottage' ? 1.7 : 1.3;
    const col = b.kind === 'chandlery' ? '#7c8f8c' : b.kind === 'store' ? '#3b3632' : b.color;
    const target = b.kind === 'cottage' ? walls : woodParts;
    target.push({ geo: new THREE.BoxGeometry(b.w, wallH + 0.4, b.d), matrix: placed(b.x, y, b.z, b.yaw, 0, (wallH + 0.4) / 2 - 0.4, 0), color: col, jitter: 0.03 });
    target.push({ geo: gableEnds(b.w, b.d, rise), matrix: placed(b.x, y + wallH, b.z, b.yaw, 0, 0, 0), color: col, jitter: 0.03 });
    roofs.push({ geo: gable(b.w, b.d, rise), matrix: placed(b.x, y + wallH, b.z, b.yaw, 0, 0, 0), color: b.kind === 'store' ? '#2c2a28' : pick(ROOF, rnd), jitter: 0.04 });
    // Door, front windows and a chimney (on the cottages).
    const front = b.d / 2 + 0.02;
    dark.push({ geo: new THREE.BoxGeometry(0.95, 1.95, 0.06), matrix: placed(b.x, y, b.z, b.yaw, b.kind === 'chandlery' ? -1.4 : 0, 0.98, front), color: b.door || (b.kind === 'chandlery' ? '#30484c' : '#2a2522') });
    const winX = b.kind === 'chandlery' ? [1.2] : b.kind === 'store' ? [] : [-b.w / 2 + 1.2, b.w / 2 - 1.2];
    for (const wx of winX) windows.push({ geo: new THREE.BoxGeometry(b.kind === 'chandlery' ? 1.8 : 0.9, 0.9, 0.06), matrix: placed(b.x, y, b.z, b.yaw, wx, 1.55, front + 0.01), color: '#ffffff' });
    if (b.kind === 'cottage') {
      windows.push({ geo: new THREE.BoxGeometry(0.8, 0.7, 0.06), matrix: placed(b.x, y, b.z, b.yaw, 0, wallH - 0.6 + 0.9, front + 0.01), color: '#ffffff' });
      stone.push({ geo: new THREE.BoxGeometry(0.6, 1.6, 0.6), matrix: placed(b.x, y, b.z, b.yaw, b.w / 2 - 0.6, wallH + rise * 0.6, -0.4), color: '#8d8478' });
    }
    // The building blocks the way; a little apron in front of the door is kept clear.
    for (let lx = -b.w / 2 + 0.9; lx <= b.w / 2 - 0.9 + 0.01; lx += Math.max(1.2, (b.w - 1.8) / Math.max(1, Math.round((b.w - 1.8) / 1.6)))) {
      for (let lz = -b.d / 2 + 0.9; lz <= b.d / 2 - 0.9 + 0.01; lz += Math.max(1.2, (b.d - 1.8) / Math.max(1, Math.round((b.d - 1.8) / 1.6)))) {
        const p = local(b.x, b.z, b.yaw, lx, lz);
        obstacles.push({ x: p.x, z: p.z, r: 1.3, top: y + wallH + rise, kind: 'building', name: b.kind === 'cottage' ? 'a cottage' : b.kind === 'chandlery' ? 'the chandlery' : 'the net store' });
      }
    }
    const door = local(b.x, b.z, b.yaw, b.kind === 'chandlery' ? -1.4 : 0, b.d / 2 + 1.2);
    spots.push({ kind: 'door', name: b.kind === 'chandlery' ? 'the chandlery door' : b.kind === 'cottage' ? 'a cottage door' : 'the net store door', x: door.x, z: door.z, r: 2.4, id: b.id });
    if (b.kind === 'chandlery') {
      // The sign over the window.
      const t = textTexture(512, 128, (ctx, w, h) => {
        ctx.fillStyle = '#26383b';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#d8c48f';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = '#efe2bd';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 54px Kalam, Caveat, cursive';
        ctx.fillText('Chandlery', w / 2, h * 0.42);
        ctx.font = '600 26px Kalam, Caveat, cursive';
        ctx.fillText('tackle · bait · charts · advice', w / 2, h * 0.78);
      });
      sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshLambertMaterial({ map: t.tex }));
      const p = local(b.x, b.z, b.yaw, 0, front + 0.05);
      sign.position.set(p.x, y + 2.55, p.z);
      sign.rotation.y = b.yaw;
      group.add(sign);
    }
    if (b.kind === 'store') {
      // Nets hung to dry on poles beside the store.
      for (const lx of [b.w / 2 + 1.0, b.w / 2 + 3.2]) {
        const p = local(b.x, b.z, b.yaw, lx, 0.8);
        woodParts.push({ geo: new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), matrix: mat(p.x, heightAt(p.x, p.z) + 1.2, p.z), color: '#6a503b' });
        obstacles.push({ x: p.x, z: p.z, r: 0.2, kind: 'harbour', name: 'the net poles' });
      }
      const p = local(b.x, b.z, b.yaw, b.w / 2 + 2.1, 0.8);
      dark.push({ geo: new THREE.PlaneGeometry(2.2, 1.6, 6, 4), matrix: placed(p.x, heightAt(p.x, p.z) + 1.3, p.z, b.yaw, 0, 0, 0), color: '#4f6a5a', jitter: 0.15 });
    }
  }

  // The notice board (its paper is drawn by the game: notices, and later your photograph).
  const B = HAVEN_BOARD, by = heightAt(B.x, B.z);
  for (const s of [-1, 1]) woodParts.push({ geo: new THREE.BoxGeometry(0.12, 2.3, 0.12), matrix: placed(B.x, by, B.z, B.yaw, s * 0.95, 1.15, 0), color: '#5a4030' });
  woodParts.push({ geo: new THREE.BoxGeometry(2.1, 1.35, 0.08), matrix: placed(B.x, by, B.z, B.yaw, 0, 1.45, -0.02), color: '#7a5a3e' });
  roofs.push({ geo: new THREE.BoxGeometry(2.4, 0.06, 0.55), matrix: placed(B.x, by, B.z, B.yaw, 0, 2.28, 0.05, -0.25, 0, 0), color: '#4d5157' });
  obstacles.push({ x: B.x, z: B.z, r: 0.75, kind: 'harbour', name: 'the notice board' });
  const boardTex = textTexture(512, 320, () => {});
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.22), new THREE.MeshLambertMaterial({ map: boardTex.tex }));
  {
    const p = local(B.x, B.z, B.yaw, 0, 0.03);
    board.position.set(p.x, by + 1.45, p.z);
    board.rotation.y = B.yaw;
    group.add(board);
  }
  spots.push({ kind: 'board', name: 'the notice board', x: local(B.x, B.z, B.yaw, 0, 1.4).x, z: local(B.x, B.z, B.yaw, 0, 1.4).z, r: 2.6 });

  // The bench under the lamp, looking out over the bay.
  const N = HAVEN_BENCH, ny = heightAt(N.x, N.z);
  woodParts.push({ geo: new THREE.BoxGeometry(1.8, 0.07, 0.45), matrix: placed(N.x, ny, N.z, N.yaw, 0, 0.46, 0), color: '#8a6a4a' });
  woodParts.push({ geo: new THREE.BoxGeometry(1.8, 0.4, 0.06), matrix: placed(N.x, ny, N.z, N.yaw, 0, 0.75, -0.24, -0.15, 0, 0), color: '#8a6a4a' });
  for (const s of [-1, 1]) dark.push({ geo: new THREE.BoxGeometry(0.06, 0.48, 0.45), matrix: placed(N.x, ny, N.z, N.yaw, s * 0.8, 0.24, 0), color: '#2f3236' });
  obstacles.push({ x: N.x - 0.5, z: N.z, r: 0.35, top: ny + 0.5, kind: 'harbour', name: 'the bench' }, { x: N.x + 0.5, z: N.z, r: 0.35, top: ny + 0.5, kind: 'harbour', name: 'the bench' });
  spots.push({ kind: 'bench', name: 'the bench', x: N.x, z: N.z + 1.2, r: 2.2 });

  // The lamp post.
  const L = HAVEN_LAMP, ly = heightAt(L.x, L.z);
  dark.push({ geo: new THREE.CylinderGeometry(0.06, 0.09, 3.2, 8), matrix: mat(L.x, ly + 1.6, L.z), color: '#2a2d30' });
  dark.push({ geo: new THREE.ConeGeometry(0.28, 0.25, 4), matrix: mat(L.x, ly + 3.55, L.z, 0, Math.PI / 4, 0), color: '#2a2d30' });
  obstacles.push({ x: L.x, z: L.z, r: 0.2, kind: 'harbour', name: 'the lamp post' });
  const lampGlass = new THREE.MeshBasicMaterial({ color: '#ffe2a8' });
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.26), lampGlass);
  lampHead.position.set(L.x, ly + 3.28, L.z);
  group.add(lampHead);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,205,130,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  lampGlow.position.copy(lampHead.position);
  lampGlow.scale.setScalar(2.4);
  group.add(lampGlow);
  const lampLight = new THREE.PointLight('#ffc98a', 0, 18, 1.6);
  lampLight.position.set(L.x, ly + 3.1, L.z);
  group.add(lampLight);

  // Lobster pots, fish boxes, barrels and an upturned dinghy along the apron.
  const props = [
    { x: 20, z: -97.5, k: 'pots' }, { x: 23.5, z: -96.6, k: 'pots' }, { x: -15.5, z: -97.8, k: 'boxes' },
    { x: 6, z: -99.3, k: 'barrels' }, { x: 26, z: -99.2, k: 'dinghy' }, { x: -17, z: -99.4, k: 'boxes' },
  ];
  for (const p of props) {
    if (p.k === 'pots') {
      for (let i = 0; i < 3; i++) {
        dark.push({ geo: new THREE.BoxGeometry(0.7, 0.45, 0.5), matrix: mat(p.x + (i % 2) * 0.1, ay + 0.23 + i * 0.46, p.z + (i % 2) * 0.08, 0, rnd() * 0.3, 0), color: pick(['#3f4f54', '#4a3c33', '#5a5f3a'], rnd), jitter: 0.08 });
      }
      obstacles.push({ x: p.x, z: p.z, r: 0.5, kind: 'harbour', name: 'the lobster pots' });
    } else if (p.k === 'boxes') {
      for (let i = 0; i < 2; i++) woodParts.push({ geo: new THREE.BoxGeometry(0.8, 0.3, 0.5), matrix: mat(p.x, ay + 0.15 + i * 0.31, p.z, 0, (rnd() - 0.5) * 0.2, 0), color: pick(['#a5482f', '#3f6f74', '#c9a65a'], rnd), jitter: 0.04 });
      obstacles.push({ x: p.x, z: p.z, r: 0.5, kind: 'harbour', name: 'the fish boxes' });
    } else if (p.k === 'barrels') {
      for (const dx of [-0.35, 0.35]) woodParts.push({ geo: new THREE.CylinderGeometry(0.3, 0.3, 0.8, 10), matrix: mat(p.x + dx, ay + 0.4, p.z), color: '#7a5636' });
      obstacles.push({ x: p.x, z: p.z, r: 0.7, kind: 'harbour', name: 'the barrels' });
    } else if (p.k === 'dinghy') {
      woodParts.push({ geo: new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), matrix: mat(p.x, ay + 0.02, p.z, Math.PI, 0.2, 0, 0.75, 0.42, 1.6), color: '#3f6f74', jitter: 0.03 });
      obstacles.push({ x: p.x, z: p.z - 0.6, r: 0.75, kind: 'harbour', name: 'an upturned dinghy' }, { x: p.x, z: p.z + 0.6, r: 0.75, kind: 'harbour', name: 'an upturned dinghy' });
    }
  }
  // Two mooring floats off the quay.
  const floats = [];
  for (const [x, z] of [[17, -82], [2.5, -80.5]]) {
    const f = mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshLambertMaterial({ color: '#e7e2d6' }));
    f.position.set(x, 0, z);
    f.userData.base = { x, z };
    group.add(f);
    floats.push(f);
  }

  group.add(mesh(mergeParts(stone, rnd), plain()));
  group.add(mesh(mergeParts(walls, rnd), plain()));
  group.add(mesh(mergeParts(woodParts, rnd), wood()));
  group.add(mesh(mergeParts(roofs, rnd), plain()));
  group.add(mesh(mergeParts(dark, rnd), plain()));
  const windowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#2e3c46' });
  const windowMesh = new THREE.Mesh(mergeParts(windows, rnd), windowMat);
  group.add(windowMesh);
  // The quay light, green after dark.
  const qLight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22), new THREE.MeshBasicMaterial({ color: '#3a7a52' }));
  qLight.position.set((Q.x0 + Q.x1) / 2, Q.deck + 1.55, Q.z1 - 0.6);
  group.add(qLight);

  return {
    board, boardTex, sign,
    update(dt, t, env) {
      const night = clamp(env.lantern * 1.15, 0, 1);
      lampGlass.color.setRGB(0.55 + night * 0.45, 0.5 + night * 0.38, 0.4 + night * 0.25);
      lampGlow.material.opacity = 0.75 * night;
      lampLight.intensity = 14 * night;
      windowMat.color.setRGB(0.18 + night * 0.82, 0.24 + night * 0.58, 0.28 + night * 0.22);
      qLight.material.color.setRGB(0.2 + night * 0.1, 0.45 + night * 0.55, 0.3 + night * 0.25);
      for (const [i, f] of floats.entries()) {
        const b = f.userData.base;
        f.position.y = waveHeight(b.x, b.z, t) + 0.12;
        f.rotation.z = Math.sin(t * 1.2 + i) * 0.1;
      }
    },
  };
}

/* ---------------- the cove's head, Cove Head and Shell Strand ---------------- */

// A clinker punt pulled up on the mud, a little on its side.
function puntParts(parts, rnd) {
  const P = PUNT, y = Math.max(heightAt(P.x, P.z), 0.1);
  const L = 3.6, W = 1.1;
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.04, 0.12, L - i * 0.1), matrix: placed(P.x, y, P.z, P.yaw, s * (W / 2 - i * 0.03), 0.08 + i * 0.11, 0, 0, 0, s * 0.18), color: pick(['#6f7a6a', '#5f6b5e'], rnd) });
  }
  parts.push({ geo: new THREE.BoxGeometry(W - 0.1, 0.04, L - 0.1), matrix: placed(P.x, y, P.z, P.yaw, 0, 0.04, 0), color: '#5a5446' });
  for (const lz of [-0.7, 0.5]) parts.push({ geo: new THREE.BoxGeometry(W - 0.12, 0.05, 0.28), matrix: placed(P.x, y, P.z, P.yaw, 0, 0.36, lz), color: '#8a7a5e' });
  for (const s of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(W - 0.05, 0.4, 0.05), matrix: placed(P.x, y, P.z, P.yaw, 0, 0.22, s * (L / 2)), color: '#5f6b5e' });
}

// The heron: grey, long-legged, standing in the shallows at the head of the cove.
function heronModel() {
  const parts = [
    { geo: new THREE.SphereGeometry(0.22, 8, 6), matrix: mat(0, 0.95, 0, 0, 0, 0, 0.8, 0.9, 1.5), color: '#9aa2a6' },
    { geo: new THREE.CylinderGeometry(0.035, 0.045, 0.55, 5), matrix: mat(0, 1.2, 0.22, -0.5, 0, 0), color: '#b8bec0' },
    { geo: new THREE.SphereGeometry(0.07, 6, 5), matrix: mat(0, 1.46, 0.36), color: '#e9ebe6' },
    { geo: new THREE.ConeGeometry(0.025, 0.24, 4), matrix: mat(0, 1.46, 0.52, Math.PI / 2, 0, 0), color: '#d9b04a' },
    { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4), matrix: mat(-0.06, 0.4, 0), color: '#7b6a4e' },
    { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4), matrix: mat(0.06, 0.4, 0), color: '#7b6a4e' },
  ];
  return mesh(mergeParts(parts), plain());
}

function buildShoreSide(rnd, group, obstacles, spots) {
  const woodParts = [], stone = [], plainParts = [];

  // The punt, with a page of a notebook tucked under its seat (see the adventures).
  puntParts(woodParts, rnd);
  obstacles.push({ x: PUNT.x, z: PUNT.z, r: 1.3, top: heightAt(PUNT.x, PUNT.z) + 0.6, kind: 'thing', name: 'the old punt' });
  spots.push({ kind: 'punt', name: 'the old punt', x: PUNT.x, z: PUNT.z, r: 2.6 });
  // Reeds and eelgrass round the head of the cove.
  const reedGeo = reedClump(rnd, true);
  const reeds = [];
  for (let i = 0; i < 70; i++) {
    const a = -Math.PI * 0.95 + rnd() * Math.PI * 0.9, r = COVE.r + (rnd() - 0.3) * 6;
    const x = COVE.x + Math.cos(a) * r * 1.05, z = COVE.z + Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h < -0.5 || h > 0.6) continue;
    reeds.push({ x, z, y: Math.max(h, -0.3) - 0.05, s: 0.7 + rnd() * 0.5, r: rnd() * 6 });
  }
  const reedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const reedMesh = new THREE.InstancedMesh(reedGeo, reedMat, Math.max(1, reeds.length));
  const o = new THREE.Object3D();
  reeds.forEach((t, i) => {
    o.position.set(t.x, t.y, t.z);
    o.rotation.set(0, t.r, 0);
    o.scale.setScalar(t.s);
    o.updateMatrix();
    reedMesh.setMatrixAt(i, o.matrix);
  });
  reedMesh.count = reeds.length;
  reedMesh.computeBoundingSphere();
  group.add(reedMesh);
  for (const r of reeds) if (r.y > -0.1) obstacles.push({ x: r.x, z: r.z, r: 0.25 * r.s, top: 1.2, kind: 'reeds', name: 'reeds' });
  const heron = heronModel();
  const hx = COVE.x - 9, hz = COVE.z - 13;
  heron.position.set(hx, Math.max(heightAt(hx, hz), -0.35), hz);
  heron.rotation.y = 2.4;
  group.add(heron);

  // Cove Head: rocky ledges round the knoll's seaward foot, and the daymark on top.
  const rockGeo = jitterGeo(new THREE.DodecahedronGeometry(1, 0), 0.35, rnd);
  for (let i = 0; i < 26; i++) {
    const a = -0.4 + rnd() * Math.PI * 1.3, r = DAYMARK.r * (0.55 + rnd() * 0.65);
    const x = DAYMARK.x + Math.cos(a) * r, z = DAYMARK.z + Math.sin(a) * r;
    const h = heightAt(x, z), s = 0.7 + rnd() * 1.4;
    if (h < -1.5) continue;
    stone.push({ geo: rockGeo, matrix: mat(x, h + s * 0.15, z, rnd() * 3, rnd() * 3, rnd() * 3, s * 1.4, s * 0.7, s), color: pick(['#8a8378', '#7d776d', '#958d80'], rnd), jitter: 0.07 });
    if (h > 0.2) obstacles.push({ x, z, r: s * 0.9, top: h + s * 0.6, kind: 'rock', name: 'rocks' });
  }
  const D = DAYMARK, dy = heightAt(D.x, D.z);
  plainParts.push({ geo: new THREE.CylinderGeometry(0.75, 1.25, 5.2, 10), matrix: mat(D.x, dy + 2.5, D.z), color: '#f2efe6', jitter: 0.02 });
  plainParts.push({ geo: new THREE.ConeGeometry(0.85, 1.4, 10), matrix: mat(D.x, dy + 5.7, D.z), color: '#26292c' });
  plainParts.push({ geo: new THREE.CylinderGeometry(1.35, 1.45, 0.25, 10), matrix: mat(D.x, dy + 0.05, D.z), color: '#9a9286' });
  obstacles.push({ x: D.x, z: D.z, r: 1.45, kind: 'building', name: 'the daymark' });
  spots.push({ kind: 'daymark', name: 'the daymark', x: D.x - 0.4, z: D.z + 2.1, r: 2.4 });

  // Shell Strand: the driftwood shelter, logs and shells on the sand.
  const S = SHELTER, sy = heightAt(S.x, S.z);
  for (let i = 0; i < 9; i++) {
    const lx = -1.2 + i * 0.3;
    woodParts.push({ geo: new THREE.CylinderGeometry(0.05, 0.07, 2.4, 5), matrix: placed(S.x, sy, S.z, S.yaw, lx, 0.95, -0.35, -0.55 + (rnd() - 0.5) * 0.1, 0, (rnd() - 0.5) * 0.1), color: pick(['#cfc3ad', '#bfb39c', '#d8cdb9'], rnd) });
  }
  woodParts.push({ geo: new THREE.CylinderGeometry(0.08, 0.08, 3, 6), matrix: placed(S.x, sy, S.z, S.yaw, 0, 1.75, -0.95, 0, 0, Math.PI / 2), color: '#c6baa3' });
  obstacles.push({ x: S.x, z: S.z, r: 1.4, top: sy + 2, kind: 'thing', name: 'the driftwood shelter' });
  spots.push({ kind: 'shelter', name: 'the driftwood shelter', x: local(S.x, S.z, S.yaw, 0, 1.4).x, z: local(S.x, S.z, S.yaw, 0, 1.4).z, r: 2.4 });
  for (let i = 0; i < 6; i++) {
    const x = STRAND.x - 18 + rnd() * 34, z = STRAND.z + 4 + rnd() * 9, h = heightAt(x, z);
    if (h < 0.2) continue;
    woodParts.push({ geo: new THREE.CylinderGeometry(0.11, 0.15, 1.8 + rnd() * 1.4, 6), matrix: mat(x, h + 0.08, z, 0, rnd() * 3, Math.PI / 2), color: pick(['#cfc3ad', '#bdb199'], rnd) });
  }
  for (let i = 0; i < 60; i++) {
    const x = STRAND.x - 22 + rnd() * 40, z = STRAND.z + 6 + rnd() * 12, h = heightAt(x, z);
    if (h < 0.05 || h > 1.6) continue;
    plainParts.push({ geo: new THREE.SphereGeometry(0.035 + rnd() * 0.03, 4, 3), matrix: mat(x, h + 0.01, z, 0, 0, 0, 1, 0.5, 1), color: pick(['#f1ece2', '#e9d9c6', '#f5e6dc'], rnd), jitter: 0.04 });
  }

  group.add(mesh(mergeParts(woodParts, rnd), wood()));
  group.add(mesh(mergeParts(stone, rnd), withCaustics(plain())));
  group.add(mesh(mergeParts(plainParts, rnd), plain()));
  return {
    heron,
    update(dt, t) {
      // Now and then the heron dips its head to look at the water.
      const k = (t * 0.13) % 1;
      heron.rotation.x = k > 0.86 ? Math.sin(((k - 0.86) / 0.14) * Math.PI) * 0.35 : 0;
    },
  };
}

/* ---------------- the Kittiwake ---------------- */

// A wooden steam drifter on her side on the reef: keel and broken ribs, a boiler, the stern
// post, scattered planks; and above her, an isolated-danger buoy (black, a red band, two black
// balls on top). The hull's shape is kept (WRECK) so divers could visit her one day.
function buildWreck(rnd, group) {
  const W = WRECK, parts = [];
  const bed = heightAt(W.x, W.z);
  // keel
  parts.push({ geo: new THREE.BoxGeometry(0.4, 0.5, W.len), matrix: placed(W.x, bed + 0.2, W.z, W.yaw, 0, 0, 0, 0, 0, 0.35), color: '#3d3127' });
  // ribs, broken off at different heights, the hull lying over a little
  for (let u = -W.len / 2 + 1.2; u < W.len / 2 - 1; u += 1.1) {
    const k = 1 - Math.abs(u) / (W.len / 2);
    const half = W.beam / 2 * (0.4 + 0.6 * Math.sqrt(k));
    for (const side of [-1, 1]) {
      const h = (side < 0 ? 2.6 : 1.4) * (0.5 + rnd() * 0.6) * (0.6 + 0.4 * k);
      parts.push({ geo: new THREE.BoxGeometry(0.18, h, 0.22), matrix: placed(W.x, bed + h / 2, W.z, W.yaw, side * half, 0, u, 0, 0, side * (0.35 + rnd() * 0.25)), color: pick(['#4a3a2c', '#3f3226', '#56442f'], rnd) });
    }
  }
  // planking still on the low side, and loose planks on the bed
  for (let u = -W.len / 2 + 2; u < W.len / 2 - 2; u += 2.1) {
    parts.push({ geo: new THREE.BoxGeometry(0.08, 1.1, 2.0), matrix: placed(W.x, bed + 0.55, W.z, W.yaw, W.beam * 0.42, 0, u, 0, 0, 0.5), color: '#4b3d30' });
  }
  for (let i = 0; i < 10; i++) {
    const u = (rnd() - 0.5) * W.len * 1.3, v = (rnd() - 0.5) * W.beam * 3;
    parts.push({ geo: new THREE.BoxGeometry(0.25, 0.06, 1.5 + rnd() * 2), matrix: placed(W.x, bed + 0.05, W.z, W.yaw + (rnd() - 0.5) * 1.5, v, 0, u), color: '#5a4836' });
  }
  // boiler, stern post and the stump of the funnel
  parts.push({ geo: new THREE.CylinderGeometry(1.0, 1.0, 2.4, 12), matrix: placed(W.x, bed + 1.0, W.z, W.yaw, 0.2, 0, -2.5, Math.PI / 2, 0, 0), color: '#5d3a28' });
  parts.push({ geo: new THREE.CylinderGeometry(0.45, 0.45, 1.6, 10), matrix: placed(W.x, bed + 2.4, W.z, W.yaw, 0.6, 0, -2.0, 0.4, 0, 0.5), color: '#4e3022' });
  parts.push({ geo: new THREE.BoxGeometry(0.3, 3.2, 0.35), matrix: placed(W.x, bed + 1.5, W.z, W.yaw, 0, 0, -W.len / 2 + 0.3, -0.25, 0, 0.3), color: '#3d3127' });
  parts.push({ geo: new THREE.BoxGeometry(0.3, 2.6, 0.35), matrix: placed(W.x, bed + 1.2, W.z, W.yaw, 0, 0, W.len / 2 - 0.3, 0.35, 0, 0.3), color: '#3d3127' });
  const hull = mesh(mergeParts(parts, rnd), withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true })), false);
  group.add(hull);

  // The buoy.
  const buoy = new THREE.Group();
  const bparts = [
    { geo: new THREE.CylinderGeometry(0.55, 0.65, 1.0, 12), matrix: mat(0, 0.2, 0), color: '#1f2224' },
    { geo: new THREE.CylinderGeometry(0.2, 0.35, 1.9, 10), matrix: mat(0, 1.6, 0), color: '#1f2224' },
    { geo: new THREE.CylinderGeometry(0.27, 0.27, 0.5, 10), matrix: mat(0, 1.4, 0), color: '#c23b2e' },
    { geo: new THREE.SphereGeometry(0.2, 10, 8), matrix: mat(0, 2.75, 0), color: '#1f2224' },
    { geo: new THREE.SphereGeometry(0.2, 10, 8), matrix: mat(0, 3.2, 0), color: '#1f2224' },
    { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), matrix: mat(0, 2.9, 0), color: '#1f2224' },
  ];
  const bm = mesh(mergeParts(bparts, rnd), plain());
  buoy.add(bm);
  buoy.position.set(WRECK_BUOY.x, 0, WRECK_BUOY.z);
  group.add(buoy);
  return {
    hull, buoy,
    update(dt, t) {
      buoy.position.y = waveHeight(WRECK_BUOY.x, WRECK_BUOY.z, t) - 0.25;
      buoy.rotation.z = Math.sin(t * 0.9) * 0.07;
      buoy.rotation.x = Math.sin(t * 0.7 + 1) * 0.06;
    },
  };
}

/* ---------------- assemble ---------------- */

export function buildCoast(scene, rnd) {
  const group = new THREE.Group();
  group.name = 'coast';
  const obstacles = [];
  // Places you can do something at (and that a camp mustn't be pitched across).
  const spots = [];
  const haven = buildHaven(rnd, group, obstacles, spots);
  const shore = buildShoreSide(rnd, group, obstacles, spots);
  const wreck = buildWreck(rnd, group);
  scene.add(group);

  // The notice board's paper: drawn by the game (see harbour.js), redrawn when it changes.
  const paintBoard = (draw) => {
    const t = haven.boardTex;
    draw(t.canvas.getContext('2d'), t.canvas.width, t.canvas.height);
    t.tex.needsUpdate = true;
  };

  return {
    group, obstacles, spots, wreck, paintBoard,
    havenCentre: HAVEN,
    update(dt, t, env) {
      haven.update(dt, t, env);
      shore.update(dt, t, env);
      wreck.update(dt, t, env);
    },
  };
}

// Distance from (x, z) to the nearest stretch of the cove's channel (for sounds and hints).
export function channelDistance(x, z) {
  let d = Infinity;
  for (const c of CHANNEL) {
    const bax = c[2] - c[0], baz = c[3] - c[1];
    const h = Math.max(0, Math.min(1, ((x - c[0]) * bax + (z - c[1]) * baz) / (bax * bax + baz * baz)));
    d = Math.min(d, Math.hypot(x - c[0] - bax * h, z - c[1] - baz * h) - c[4]);
  }
  return d;
}

export const HAVEN_SOUND = (x, z) => 1 - smoothstep(18, 70, Math.hypot(x - HAVEN.x, z - HAVEN.z));
