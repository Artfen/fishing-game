import * as THREE from 'three';
import { heightAt } from './world/terrain.js';
import { mergeParts, mat, clamp, smoothstep, glowTexture } from './util.js';
import { buildLanternModel } from './props.js';
import { fishById, buildFishGeometry } from './fish.js';
import { cookedMaterial, browned } from './camp.js';
import { LAYOUT, FOOTPRINT, TENTS, toWorld } from './campsite.js';

// Your camp as you see it: the tent (its fly sheet stirring in the wind), the bedroll inside,
// the lantern on its pole, the stove and pan, the cool box, the tackle box and a camp chair, with
// bunting, a rug and wind chimes if you've put them out. And the preview you place it with: a
// ghost of the camp and its footprint, green where it fits, amber with a warning, red where it
// doesn't, with the spots that are in the way marked. Everything is made here from simple shapes.

const flySway = { uTime: { value: 0 }, uWind: { value: 0 } };

// The fly sheet: Lambert, with a gentle billow in the wind (none in reduced motion).
function flyMaterial(color) {
  const m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = flySway.uTime;
    shader.uniforms.uWind = flySway.uWind;
    shader.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      // Fixed at the ridge and the pegs, loosest in the middle of each panel.
      float slack = sin(clamp(position.y / 1.35, 0.0, 1.0) * 3.14159) * (1.0 - abs(position.z) / 1.4);
      float ph = uTime * 3.1 + position.z * 2.3;
      float flap = sin(ph) * 0.6 + sin(ph * 2.7 + 1.3) * 0.4;
      transformed.x += sign(position.x) * flap * 0.035 * slack * uWind;`,
    );
  };
  m.customProgramCacheKey = () => 'tent-fly';
  return m;
}

// An A-frame ridge tent, 2.5 m long, door facing local +z: the fly (its own mesh, to sway), and
// the walls, groundsheet, bedroll, pillow, poles and pegs.
function tentParts(look) {
  const L = 2.5, W = 1.9, H = 1.35;
  const fly = new THREE.BufferGeometry();
  const hz = L / 2, hx = W / 2, v = [];
  // Each sloping side in a few strips, so it can billow.
  const N = 4;
  for (const s of [-1, 1]) {
    for (let i = 0; i < N; i++) {
      const z0 = -hz + (i / N) * L, z1 = -hz + ((i + 1) / N) * L;
      for (let j = 0; j < 3; j++) {
        const a = j / 3, b = (j + 1) / 3;
        const p = (t, z) => [s * hx * t, H * (1 - t), z];
        v.push(...p(a, z0), ...p(b, z0), ...p(b, z1), ...p(a, z0), ...p(b, z1), ...p(a, z1));
      }
    }
  }
  fly.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  fly.computeVertexNormals();
  const tri = (pts) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  };
  const parts = [
    { geo: tri([0, H, -L / 2, W / 2, 0, -L / 2, -W / 2, 0, -L / 2]), color: look.canvas },
    { geo: tri([0, H, L / 2, -W / 2, 0, L / 2, -W * 0.3, 0, L / 2 + 0.25]), color: look.dark },
    { geo: tri([0, H, L / 2, W * 0.3, 0, L / 2 + 0.25, W / 2, 0, L / 2]), color: look.dark },
    { geo: new THREE.BoxGeometry(W - 0.1, 0.03, L - 0.05), matrix: mat(0, 0.015, 0), color: '#5d5a4c' },
    // The bedroll and pillow.
    { geo: new THREE.CapsuleGeometry(0.28, 1.3, 4, 8), matrix: mat(0.2, 0.14, -0.1, Math.PI / 2, 0, 0, 1, 0.5, 1), color: '#b5532f' },
    { geo: new THREE.BoxGeometry(0.45, 0.12, 0.3), matrix: mat(0.2, 0.1, -0.95), color: '#efe6d2' },
    ...[-1, 1].map((s) => ({ geo: new THREE.CylinderGeometry(0.02, 0.02, H + 0.25, 5), matrix: mat(0, (H + 0.25) / 2, s * (L / 2 + 0.02)), color: '#6b5a48' })),
    { geo: new THREE.CylinderGeometry(0.02, 0.02, L + 0.15, 5), matrix: mat(0, H + 0.01, 0, Math.PI / 2, 0, 0), color: '#6b5a48' },
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push({ geo: new THREE.CylinderGeometry(0.015, 0.01, 0.2, 4), matrix: mat(sx * (W / 2 + 0.05), 0.05, sz * (L / 2 - 0.1)), color: '#9aa0a6' });
  // Guy ropes from the poles' tops out to pegs.
  const UPV = new THREE.Vector3(0, 1, 0);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const a = new THREE.Vector3(0, H + 0.01, sz * (L / 2 + 0.02)), b = new THREE.Vector3(sx * 0.45, 0.02, sz * 2.05);
      const d = new THREE.Vector3().subVectors(b, a), len = d.length();
      const m = new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(UPV, d.normalize()), new THREE.Vector3(1, 1, 1));
      parts.push({ geo: new THREE.CylinderGeometry(0.007, 0.007, len, 3), matrix: m, color: '#e8dcc0' });
    }
  }
  return { fly, parts };
}

// has: which of the separate pieces are here (the stove and the cool box can stay at home).
function furnitureParts(look, deco, has = { stove: true, coolbox: true }) {
  const P = [];
  const at = (k) => LAYOUT[k];
  // The stove: a little gas stove on a flat stone, with a pan on it.
  const S = at('stove');
  if (has.stove) {
  P.push({ geo: new THREE.CylinderGeometry(0.24, 0.27, 0.08, 7), matrix: mat(S.x, 0.04, S.z), color: '#8f8a80' });
  P.push({ geo: new THREE.CylinderGeometry(0.09, 0.09, 0.2, 10), matrix: mat(S.x, 0.18, S.z), color: '#c64a2e' });
  P.push({ geo: new THREE.CylinderGeometry(0.11, 0.06, 0.05, 8), matrix: mat(S.x, 0.3, S.z), color: '#3b3d40' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    P.push({ geo: new THREE.BoxGeometry(0.02, 0.02, 0.14), matrix: mat(S.x + Math.sin(a) * 0.07, 0.34, S.z + Math.cos(a) * 0.07, 0, a, 0), color: '#3b3d40' });
  }
  P.push({ geo: new THREE.CylinderGeometry(0.17, 0.15, 0.05, 12), matrix: mat(S.x, 0.375, S.z), color: '#5f6366' });
  P.push({ geo: new THREE.BoxGeometry(0.22, 0.02, 0.03), matrix: mat(S.x + 0.27, 0.39, S.z), color: '#2f3134' });
  }
  // The cool box.
  const C = at('cooler');
  if (has.coolbox) {
    P.push({ geo: new THREE.BoxGeometry(0.62, 0.36, 0.42), matrix: mat(C.x, 0.18, C.z), color: '#3f7fa8' });
    P.push({ geo: new THREE.BoxGeometry(0.64, 0.07, 0.44), matrix: mat(C.x, 0.39, C.z), color: '#eef0ec' });
  }
  // The tackle box (green, with a handle) and a rod leaning on it.
  const T = at('tackle');
  P.push({ geo: new THREE.BoxGeometry(0.55, 0.3, 0.32), matrix: mat(T.x, 0.15, T.z), color: '#3c6b4c' });
  P.push({ geo: new THREE.TorusGeometry(0.1, 0.015, 4, 8, Math.PI), matrix: mat(T.x, 0.3, T.z), color: '#1f2a24' });
  P.push({ geo: new THREE.CylinderGeometry(0.008, 0.02, 2.2, 5), matrix: mat(T.x - 0.55, 0.95, T.z - 0.1, 0.12, 0, 0.5), color: '#2f3640' });
  // The camp chair, facing out from the door.
  const H = at('chair');
  for (const s of [-1, 1]) {
    P.push({ geo: new THREE.CylinderGeometry(0.015, 0.015, 0.62, 4), matrix: mat(H.x + s * 0.22, 0.22, H.z, 0.6, 0, 0), color: '#2b2d30' });
    P.push({ geo: new THREE.CylinderGeometry(0.015, 0.015, 0.62, 4), matrix: mat(H.x + s * 0.22, 0.22, H.z, -0.6, 0, 0), color: '#2b2d30' });
  }
  P.push({ geo: new THREE.BoxGeometry(0.46, 0.03, 0.4), matrix: mat(H.x, 0.42, H.z), color: look.fly });
  P.push({ geo: new THREE.BoxGeometry(0.46, 0.42, 0.03), matrix: mat(H.x, 0.64, H.z - 0.2, -0.2, 0, 0), color: look.fly });
  // The lantern pole.
  const N = at('lantern');
  P.push({ geo: new THREE.CylinderGeometry(0.03, 0.04, 1.8, 5), matrix: mat(N.x, 0.9, N.z), color: '#5a4030' });
  P.push({ geo: new THREE.BoxGeometry(0.04, 0.04, 0.35), matrix: mat(N.x, 1.76, N.z + 0.15), color: '#5a4030' });
  if (deco.rug) {
    const R = at('rug');
    P.push({ geo: new THREE.BoxGeometry(1.3, 0.015, 0.8), matrix: mat(R.x, 0.01, R.z), color: '#a5482f' });
    for (let i = -2; i <= 2; i++) P.push({ geo: new THREE.BoxGeometry(1.3, 0.017, 0.07), matrix: mat(R.x, 0.012, R.z + i * 0.15), color: i % 2 ? '#e3c58a' : '#3f6f74' });
  }
  if (deco.bunting) {
    // A string of little flags from the tent's front pole to the lantern pole.
    const a = new THREE.Vector3(LAYOUT.tent.x, 1.6, LAYOUT.tent.z + 1.27), b = new THREE.Vector3(N.x, 1.7, N.z);
    const cols = ['#c23b2e', '#e3c58a', '#3f6f74', '#7f9a6a', '#e9dcc4'];
    for (let i = 1; i < 8; i++) {
      const k = i / 8, p = a.clone().lerp(b, k);
      p.y -= Math.sin(k * Math.PI) * 0.25;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.07, 0, 0, 0.07, 0, 0, 0, -0.16, 0], 3));
      P.push({ geo: g, matrix: mat(p.x, p.y, p.z, 0, Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2, 0), color: cols[i % cols.length], jitter: 0 });
    }
  }
  if (deco.deckchair) {
    // A striped deckchair, angled towards the view.
    const D = { x: -1.1, z: 2.2 };
    const stripes = ['#c23b2e', '#efe4cf', '#3f6f74'];
    for (let i = 0; i < 6; i++) P.push({ geo: new THREE.BoxGeometry(0.09, 0.02, 0.9), matrix: mat(D.x - 0.22 + i * 0.09, 0.45, D.z, -0.55, 0.3, 0), color: stripes[i % 3], jitter: 0 });
    for (const s of [-1, 1]) {
      P.push({ geo: new THREE.CylinderGeometry(0.015, 0.015, 1.0, 4), matrix: mat(D.x + s * 0.3, 0.45, D.z, -0.55, 0.3, 0), color: '#8a6a4a' });
      P.push({ geo: new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), matrix: mat(D.x + s * 0.3 + 0.05, 0.28, D.z + 0.2, 0.7, 0.3, 0), color: '#8a6a4a' });
    }
  }
  if (deco.chimes) {
    for (let i = 0; i < 4; i++) P.push({ geo: new THREE.CylinderGeometry(0.012, 0.012, 0.22 + i * 0.04, 4), matrix: mat(N.x + 0.12 + i * 0.03, 1.5 - i * 0.02, N.z + 0.32), color: '#d8cdb9' });
  }
  return P;
}

// The obstacles a camp puts in your way on foot (world positions).
export function campObstacles(camp) {
  const out = [];
  const add = (k, r, top = 2) => {
    const L = LAYOUT[k], p = toWorld(camp.x, camp.z, camp.yaw, L.x, L.z);
    out.push({ x: p.x, z: p.z, r, top: heightAt(p.x, p.z) + top, kind: 'camp', name: 'your camp', camp: camp.id });
  };
  add('tent', 1.3, 1.4);
  if (camp.has?.stove !== false) add('stove', 0.3, 0.5);
  if (camp.has?.coolbox !== false) add('cooler', 0.4, 0.45);
  add('tackle', 0.38, 0.4);
  add('chair', 0.32, 0.8);
  add('lantern', 0.15, 1.9);
  return out;
}

const campHasAll = (camp) => ({ stove: camp.has?.stove !== false, coolbox: camp.has?.coolbox !== false });
const modelKey = (camp) => `${camp.tent}|${JSON.stringify(camp.deco)}|${JSON.stringify(campHasAll(camp))}`;

// One camp in the world.
class CampModel {
  constructor(scene, camp) {
    this.scene = scene;
    this.id = camp.id;
    this.group = new THREE.Group();
    this.group.name = `camp ${camp.id}`;
    scene.add(this.group);
    this.lantern = buildLanternModel();
    this.group.add(this.lantern.group);
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), new THREE.MeshBasicMaterial({ color: '#7fb4ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.group.add(this.flame);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,200,120,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.glow.scale.setScalar(1.6);
    this.group.add(this.glow);
    this.pan = null;
    this.panId = null;
    this.rebuild(camp);
  }

  rebuild(camp) {
    for (const m of [this.tentMesh, this.flyMesh, this.furnMesh]) {
      if (!m) continue;
      this.group.remove(m);
      m.geometry.dispose();
    }
    const look = TENTS[camp.tent] || TENTS.green;
    const t = tentParts(look);
    this.flyMesh = new THREE.Mesh(t.fly, flyMaterial(look.fly));
    this.tentMesh = new THREE.Mesh(mergeParts(t.parts), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.furnMesh = new THREE.Mesh(mergeParts(furnitureParts(look, camp.deco, campHasAll(camp))), new THREE.MeshLambertMaterial({ vertexColors: true }));
    for (const m of [this.flyMesh, this.tentMesh, this.furnMesh]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    this.group.add(this.flyMesh, this.tentMesh, this.furnMesh);
    this.key = modelKey(camp);
    this.place(camp);
  }

  // Sit everything on the ground: the tent at its own height, the furniture as a group on the
  // level of the door (the ground has been checked to be near enough level).
  place(camp) {
    this.x = camp.x;
    this.z = camp.z;
    this.yaw = camp.yaw;
    const T = LAYOUT.tent, tp = toWorld(camp.x, camp.z, camp.yaw, T.x, T.z);
    const ty = heightAt(tp.x, tp.z) - 0.02;
    const gy = heightAt(camp.x, camp.z);
    this.group.position.set(camp.x, gy, camp.z);
    this.group.rotation.y = camp.yaw;
    this.tentMesh.position.set(T.x, ty - gy, T.z);
    this.flyMesh.position.copy(this.tentMesh.position);
    this.furnMesh.position.set(0, 0, 0);
    const N = LAYOUT.lantern;
    this.lantern.group.position.set(N.x, 1.74, N.z + 0.3);
    const S = LAYOUT.stove;
    this.flame.position.set(S.x, 0.33, S.z);
    this.glow.position.set(N.x, 1.55, N.z + 0.3);
    this.base = gy;
  }

  // The fish in the pan, browning as it cooks.
  setPan(fish, done) {
    const id = fish?.id || null;
    if (id !== this.panId) {
      if (this.pan) {
        this.group.remove(this.pan);
        this.pan.geometry.dispose();
        this.pan = null;
      }
      this.panId = id;
      if (id) {
        const sp = fishById[id];
        this.pan = new THREE.Mesh(buildFishGeometry(sp), cookedMaterial(sp));
        this.pan.rotation.set(0, Math.PI / 2, Math.PI / 2);
        this.pan.scale.setScalar(Math.min((fish.size / 100) * sp.visual, 0.32));
        const S = LAYOUT.stove;
        this.pan.position.set(S.x, 0.41, S.z);
        this.group.add(this.pan);
      }
    }
    if (this.pan) browned(this.pan, done);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}

/* ---------------- the preview ---------------- */

class Preview {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.mat = new THREE.MeshBasicMaterial({ color: '#7fd18a', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    // The ghost: the tent's shape and boxes where the furniture goes.
    const L = 2.5, W = 1.9, H = 1.35;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      0, H, -L / 2, W / 2, 0, -L / 2, W / 2, 0, L / 2, 0, H, -L / 2, W / 2, 0, L / 2, 0, H, L / 2,
      0, H, -L / 2, -W / 2, 0, L / 2, -W / 2, 0, -L / 2, 0, H, -L / 2, 0, H, L / 2, -W / 2, 0, L / 2,
      0, H, -L / 2, W / 2, 0, -L / 2, -W / 2, 0, -L / 2,
    ], 3));
    const ghostParts = [{ geo: g, matrix: mat(LAYOUT.tent.x, 0, LAYOUT.tent.z) }];
    for (const [k, w, h, d] of [['stove', 0.5, 0.4, 0.5], ['cooler', 0.62, 0.42, 0.42], ['tackle', 0.55, 0.32, 0.32], ['chair', 0.46, 0.8, 0.45], ['lantern', 0.1, 1.8, 0.1]]) {
      ghostParts.push({ geo: new THREE.BoxGeometry(w, h, d), matrix: mat(LAYOUT[k].x, h / 2, LAYOUT[k].z) });
    }
    this.ghost = new THREE.Mesh(mergeParts(ghostParts.map((p) => ({ ...p, color: '#ffffff', jitter: 0 }))), this.mat);
    this.ghost.renderOrder = 9;
    this.group.add(this.ghost);
    // The footprint's outline on the ground, and a little arrow out of the door.
    this.edge = [];
    const F = FOOTPRINT;
    const push = (x, z) => this.edge.push([x, z]);
    for (let x = F.x0; x < F.x1; x += 0.4) push(x, F.z0);
    for (let z = F.z0; z < F.z1; z += 0.4) push(F.x1, z);
    for (let x = F.x1; x > F.x0; x -= 0.4) push(x, F.z1);
    for (let z = F.z1; z > F.z0; z -= 0.4) push(F.x0, z);
    // (A ribbon on the ground rather than a line, so it reads at any distance.)
    this.lineGeo = new THREE.BufferGeometry();
    this.linePos = new Float32Array(this.edge.length * 6 * 3);
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3));
    this.lineMat = new THREE.MeshBasicMaterial({ color: '#7fd18a', transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide });
    this.line = new THREE.Mesh(this.lineGeo, this.lineMat);
    this.line.frustumCulled = false;
    this.line.renderOrder = 10;
    scene.add(this.line);
    this.line.visible = false;
    // Markers on the spots in the way.
    this.badMat = new THREE.MeshBasicMaterial({ color: '#e0523a', transparent: true, opacity: 0.85, depthTest: false });
    this.bad = new THREE.InstancedMesh(new THREE.CircleGeometry(0.2, 8).rotateX(-Math.PI / 2), this.badMat, 160);
    this.bad.count = 0;
    this.bad.frustumCulled = false;
    this.bad.renderOrder = 11;
    scene.add(this.bad);
    this._o = new THREE.Object3D();
  }

  show(on) {
    this.group.visible = on;
    this.line.visible = on;
    this.bad.visible = on;
    if (!on) this.bad.count = 0;
  }

  // state: 'ok' | 'warn' | 'bad'
  set(x, z, yaw, state, bad = []) {
    const col = state === 'ok' ? '#7fd18a' : state === 'warn' ? '#f0c060' : '#e0523a';
    this.mat.color.set(col);
    this.lineMat.color.set(col);
    const gy = heightAt(x, z);
    this.group.position.set(x, gy + 0.02, z);
    this.group.rotation.y = yaw;
    const pts = this.edge.map(([lx, lz]) => {
      const p = toWorld(x, z, yaw, lx, lz);
      return [p.x, Math.max(heightAt(p.x, p.z), 0) + 0.07, p.z];
    });
    const W = 0.09, L = this.linePos;
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * W, nz = (dx / l) * W;
      const q = [[a[0] - nx, a[1], a[2] - nz], [a[0] + nx, a[1], a[2] + nz], [b[0] + nx, b[1], b[2] + nz], [b[0] - nx, b[1], b[2] - nz]];
      [q[0], q[1], q[2], q[0], q[2], q[3]].forEach((v, k) => L.set(v, (i * 6 + k) * 3));
    });
    this.lineGeo.attributes.position.needsUpdate = true;
    this.lineGeo.computeBoundingSphere();
    const o = this._o;
    const n = Math.min(bad.length, 160);
    for (let i = 0; i < n; i++) {
      o.position.set(bad[i].x, Math.max(heightAt(bad[i].x, bad[i].z), 0) + 0.07, bad[i].z);
      o.updateMatrix();
      this.bad.setMatrixAt(i, o.matrix);
    }
    this.bad.count = n;
    this.bad.instanceMatrix.needsUpdate = true;
  }
}

/* ---------------- all of them ---------------- */

export class CampView {
  constructor(scene) {
    this.scene = scene;
    this.models = new Map();
    this.preview = new Preview(scene);
    // One light for the camp you're nearest (the lantern after dark).
    this.light = new THREE.PointLight('#ffb866', 0, 14, 1.6);
    scene.add(this.light);
  }

  // Keep the models in step with the camps in the save (stable ids: never two of one camp).
  sync(camps) {
    const ids = new Set(camps.map((c) => c.id));
    for (const [id, m] of this.models) {
      if (!ids.has(id)) {
        m.dispose();
        this.models.delete(id);
      }
    }
    for (const c of camps) {
      const m = this.models.get(c.id);
      if (!m) this.models.set(c.id, new CampModel(this.scene, c));
      else if (m.key !== modelKey(c)) m.rebuild(c);
      else if (m.x !== c.x || m.z !== c.z || m.yaw !== c.yaw) m.place(c);
    }
  }

  // env: the sky (night, lantern); camps; from: where you are; wind 0…1; still: reduced motion;
  // cooking(camp) → { fish, done } for the pan.
  update(dt, t, env, camps, from, { wind = 0.3, still = false, cooking } = {}) {
    flySway.uTime.value = t;
    flySway.uWind.value = still ? 0 : clamp(0.25 + wind * 1.1, 0, 1.3);
    let nearest = null, nd = Infinity;
    for (const c of camps) {
      const m = this.models.get(c.id);
      if (!m) continue;
      const d = Math.hypot(c.x - from.x, c.z - from.z);
      // Out of sight past the haze: not drawn at all.
      m.group.visible = d < 420;
      if (!m.group.visible) continue;
      if (d < nd) { nd = d; nearest = { c, m }; }
      const lit = c.lantern === 'on' || (c.lantern === 'auto' && env.lantern > 0.25);
      const level = lit ? (c.lantern === 'on' ? Math.max(0.55, env.lantern) : env.lantern) : 0;
      m.lantern.glassMat.emissiveIntensity = level * 3.2;
      m.glow.material.opacity = 0.55 * level * (0.4 + env.night * 0.6);
      m.level = level;
      const ck = cooking?.(c);
      m.flame.visible = !!ck?.fish && ck.done < 1;
      m.flame.scale.setScalar(0.9 + Math.sin(t * 17) * 0.1);
      m.setPan(ck?.fish || null, ck?.done ?? 1);
    }
    if (nearest && nd < 160) {
      const { m } = nearest;
      const N = LAYOUT.lantern, p = toWorld(m.x, m.z, m.yaw, N.x, N.z + 0.3);
      this.light.position.set(p.x, m.base + 1.6, p.z);
      this.light.intensity = 9 * m.level * (1 + Math.sin(t * 9.3) * 0.03);
    } else this.light.intensity = 0;
  }
}
