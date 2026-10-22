import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep, mergeParts, mat } from './util.js';
import { waveHeight } from './world/water.js';
import { solidHeight, JETTY } from './world/terrain.js';
import { buildLanternModel } from './props.js';

// Hull proportions (metres). The bow points along local +z.
const L = 3.8, B = 0.8, D = 0.6;
const DRAFT = 0.2;
const hw = (t) => B * Math.pow(Math.sin(Math.PI * (0.17 + 0.83 * t)), 0.75);
const sheer = (t) => D + 0.26 * Math.pow(t, 2.4) + 0.05 * Math.pow(1 - t, 3);
const keelY = (t) => 0.2 * Math.pow(t, 3);
const zAt = (t) => -L / 2 + L * t;
const OAR_T = 0.56;

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();

function hullSurface(inset, colorFor) {
  const NZ = 18, NP = 10, rows = [];
  for (let i = 0; i <= NZ; i++) {
    const t = i / NZ, w = Math.max(hw(t) - inset, 0), s = sheer(t), k = keelY(t) + inset;
    const row = [];
    for (let j = 0; j <= NP; j++) {
      const a = -Math.PI / 2 + Math.PI * (j / NP);
      const sn = Math.sin(a), cs = Math.max(Math.cos(a), 0);
      row.push([w * Math.sign(sn) * Math.pow(Math.abs(sn), 0.65), k + (s - k) * (1 - Math.pow(cs, 0.55)), zAt(t)]);
    }
    rows.push(row);
  }
  const pos = [], col = [], c = new THREE.Color();
  const face = (p, q, r, i, j) => {
    pos.push(...p, ...q, ...r);
    colorFor(c, i, j, NP, (p[1] + q[1] + r[1]) / 3);
    for (let n = 0; n < 3; n++) col.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < NZ; i++) {
    for (let j = 0; j < NP; j++) {
      const a = rows[i][j], b = rows[i + 1][j], cc = rows[i + 1][j + 1], d = rows[i][j + 1];
      face(a, b, cc, i, j);
      face(a, cc, d, i, j);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return { geo, rows };
}

function setLimb(mesh, a, b, r) {
  _d.subVectors(b, a);
  const len = _d.length() || 0.001;
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, _d.divideScalar(len));
  mesh.scale.set(r, len, r);
}

export class Boat {
  constructor(scene) {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.body.rotation.order = 'YXZ';
    this.group.add(this.body);
    scene.add(this.group);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.omega = 0;
    this.phase = 0;
    this.pitch = 0;
    this.roll = 0;
    this.heave = 0;
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.right = new THREE.Vector3(-1, 0, 0);
    this.forwardSpeed = 0;
    this.hasLantern = false;
    this.lanternLevel = 0;
    this.onStroke = null;
    this.onBump = null;
    this.bumpCooldown = 0;
    // Set by the fishing system each frame.
    this.pose = { fishing: 0, rodYaw: 0, rodPitch: 0.85, bend: 0.05 };

    this.buildHull();
    this.buildCharacter();
    this.oars = [this.buildOar(1), this.buildOar(-1)];
    this.buildRods();
    this.buildLantern();
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  place(x, z, heading) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.heading = heading;
    this.omega = 0;
  }

  /* ---------- construction ---------- */

  buildHull() {
    const PAINT = new THREE.Color('#3f7f86'), STRIPE = new THREE.Color('#f1e6cc'), BOTTOM = new THREE.Color('#a2513d');
    const outer = hullSurface(0, (c, i, j, NP, y) => {
      if (j === 0 || j === NP - 1) c.copy(STRIPE);
      else if (y < DRAFT + 0.05) c.copy(BOTTOM);
      else c.copy(PAINT);
      c.multiplyScalar(0.94 + ((i * 7 + j * 3) % 5) * 0.025);
    });
    const WOOD = [new THREE.Color('#c99a63'), new THREE.Color('#b8874f')];
    const inner = hullSurface(0.045, (c, i, j, NP) => {
      c.copy(j === 0 || j === NP - 1 ? new THREE.Color('#a87a48') : WOOD[j % 2]);
      c.multiplyScalar(0.95 + ((i * 5 + j) % 4) * 0.03);
    });

    // Transom: a fan closing off the stern.
    const stern = outer.rows[0];
    const tPos = [];
    const cy = (stern[0][1] + stern[5][1]) / 2;
    for (let j = 0; j < stern.length - 1; j++) tPos.push(0, cy, zAt(0), ...stern[j], ...stern[j + 1]);
    const transom = new THREE.BufferGeometry();
    transom.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));

    const railPts = (j) => outer.rows.map((r) => new THREE.Vector3(r[j][0], r[j][1] + 0.02, r[j][2]));
    const NP = outer.rows[0].length - 1;
    const parts = [
      { geo: outer.geo, color: '#ffffff', jitter: 0 },
      { geo: inner.geo, color: '#ffffff', jitter: 0 },
      { geo: transom, color: '#3f7f86', jitter: 0.03 },
      { geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts(0)), 36, 0.045, 5), color: '#7b5434', jitter: 0.03 },
      { geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts(NP)), 36, 0.045, 5), color: '#7b5434', jitter: 0.03 },
      { geo: new THREE.BoxGeometry(hw(0) * 2 + 0.08, 0.07, 0.09), matrix: mat(0, sheer(0) + 0.02, zAt(0)), color: '#7b5434' },
      { geo: new THREE.BoxGeometry(0.5, 0.03, L * 0.62), matrix: mat(0, 0.08, 0.05), color: '#a77746' },
    ];
    for (const t of [0.1, 0.5, 0.79]) {
      parts.push({ geo: new THREE.BoxGeometry(hw(t) * 1.84, 0.05, 0.28), matrix: mat(0, 0.46, zAt(t)), color: '#a8743f' });
    }
    for (const s of [1, -1]) {
      parts.push({ geo: new THREE.CylinderGeometry(0.025, 0.025, 0.1, 5), matrix: mat(s * (hw(OAR_T) + 0.02), sheer(OAR_T) + 0.06, zAt(OAR_T)), color: '#3b342e' });
    }
    const geo = mergeParts(parts);
    // The two hull surfaces come first in the merge; copy their painted colours back in.
    const colors = geo.attributes.color.array;
    let o = 0;
    for (const g of [outer.geo, inner.geo]) {
      const src = g.attributes.color.array;
      colors.set(src, o);
      o += src.length;
    }
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.body.add(mesh);
  }

  buildCharacter() {
    const coat = new THREE.MeshLambertMaterial({ color: '#e8b440' });
    const skin = new THREE.MeshLambertMaterial({ color: '#f1c7a1' });
    const hat = new THREE.MeshLambertMaterial({ color: '#35676b' });
    const pants = new THREE.MeshLambertMaterial({ color: '#3b4a68' });
    const boot = new THREE.MeshLambertMaterial({ color: '#5a3d2b' });
    const dark = new THREE.MeshLambertMaterial({ color: '#2b2522' });
    const cast = (m) => { m.castShadow = true; return m; };

    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.47, 0.02);
    this.body.add(this.torso);
    const chest = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.22, 4, 10), coat));
    chest.position.y = 0.27;
    chest.scale.set(1, 1, 0.85);
    this.torso.add(chest);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12), coat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.5;
    this.torso.add(collar);

    this.head = new THREE.Group();
    this.head.position.y = 0.63;
    this.torso.add(this.head);
    this.head.add(cast(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), skin)));
    for (const s of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), dark);
      eye.position.set(s * 0.045, 0.015, 0.122);
      this.head.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), skin);
    nose.position.set(0, -0.015, 0.13);
    this.head.add(nose);
    const brim = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.025, 16), hat));
    brim.position.y = 0.075;
    const crown = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.13, 14), hat));
    crown.position.y = 0.14;
    const hatGroup = new THREE.Group();
    hatGroup.add(brim, crown);
    hatGroup.rotation.set(-0.12, 0, 0.08);
    this.head.add(hatGroup);

    const limbGeo = new THREE.CylinderGeometry(1, 1, 1, 7);
    const leg = (s) => {
      const thigh = cast(new THREE.Mesh(limbGeo, pants));
      const shin = cast(new THREE.Mesh(limbGeo, pants));
      const hip = new THREE.Vector3(s * 0.09, 0.52, 0.06);
      const knee = new THREE.Vector3(s * 0.11, 0.56, 0.42);
      const foot = new THREE.Vector3(s * 0.11, 0.14, 0.5);
      setLimb(thigh, hip, knee, 0.07);
      setLimb(shin, knee, foot, 0.06);
      const b = cast(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.22), boot));
      b.position.set(s * 0.11, 0.12, 0.55);
      this.body.add(thigh, shin, b);
    };
    leg(1);
    leg(-1);

    this.arms = [1, -1].map((s) => {
      const arm = cast(new THREE.Mesh(limbGeo, coat));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin);
      this.body.add(arm, hand);
      return { s, arm, hand, shoulder: new THREE.Vector3(s * 0.21, 0.43, 0), target: new THREE.Vector3() };
    });
  }

  buildOar(side) {
    const g = new THREE.Group();
    g.rotation.order = 'YZX';
    g.position.set(side * (hw(OAR_T) + 0.02), sheer(OAR_T) + 0.06, zAt(OAR_T));
    const parts = [
      { geo: new THREE.CylinderGeometry(0.028, 0.028, 2.0, 6), matrix: mat(side * 0.4, 0, 0, 0, 0, Math.PI / 2), color: '#c9a16b' },
      { geo: new THREE.CylinderGeometry(0.036, 0.036, 0.26, 6), matrix: mat(side * -0.5, 0, 0, 0, 0, Math.PI / 2), color: '#7b5434' },
      { geo: new THREE.BoxGeometry(0.42, 0.16, 0.03), matrix: mat(side * 1.55, 0, 0), color: '#3f7f86' },
      { geo: new THREE.BoxGeometry(0.12, 0.16, 0.032), matrix: mat(side * 1.82, 0, 0), color: '#f1e6cc' },
    ];
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true;
    g.add(mesh);
    this.body.add(g);
    return {
      g, side, blend: 0, wasIn: 0,
      handle: new THREE.Vector3(side * -0.55, 0, 0),
      blade: new THREE.Vector3(side * 1.6, 0, 0),
    };
  }

  buildRods() {
    const wood = new THREE.MeshLambertMaterial({ color: '#8a5a34' });
    const cork = new THREE.MeshLambertMaterial({ color: '#d7b98a' });
    const metal = new THREE.MeshLambertMaterial({ color: '#59606a' });

    // Rod held while fishing: a chain of segments that can bend.
    this.rod = new THREE.Group();
    this.rod.rotation.order = 'YXZ';
    this.rod.position.set(0.05, 0.8, 0.34);
    this.body.add(this.rod);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.36, 7), cork);
    grip.position.y = 0.12;
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), metal);
    reel.rotation.z = Math.PI / 2;
    reel.position.set(-0.05, 0.22, 0);
    this.rod.add(grip, reel);
    this.rodSegs = [];
    const lens = [0.55, 0.52, 0.48, 0.42, 0.38];
    let parent = this.rod, y = 0.3, r = 0.02;
    for (const len of lens) {
      const seg = new THREE.Group();
      seg.position.y = y;
      parent.add(seg);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r, len, 5), wood);
      m.position.y = len / 2;
      m.castShadow = true;
      seg.add(m);
      this.rodSegs.push(seg);
      parent = seg;
      y = len;
      r *= 0.78;
    }
    this.rodTip = new THREE.Object3D();
    this.rodTip.position.y = lens[lens.length - 1];
    parent.add(this.rodTip);

    // Stowed rod lying along the starboard side.
    this.rodStowed = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.024, 2.4, 5), wood);
    this.rodStowed.rotation.set(Math.PI / 2 - 0.06, 0, 0);
    this.rodStowed.position.set(-0.42, 0.52, -0.25);
    this.body.add(this.rodStowed);
  }

  buildLantern() {
    this.lanternRig = new THREE.Group();
    this.lanternRig.position.set(0.42, 0, -1.58);
    this.lanternRig.visible = false;
    const wood = new THREE.MeshLambertMaterial({ color: '#6b4a30' });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 1.3, 6), wood);
    pole.position.y = 0.95;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.4), wood);
    arm.position.set(0, 1.58, -0.18);
    this.lanternRig.add(pole, arm);
    this.lanternHanger = new THREE.Group();
    this.lanternHanger.position.set(0, 1.56, -0.36);
    const model = buildLanternModel();
    this.lanternGlass = model.glassMat;
    this.lanternHanger.add(model.group);
    this.lanternLight = new THREE.PointLight('#ffb15c', 0, 18, 1.6);
    this.lanternLight.position.y = -0.2;
    this.lanternHanger.add(this.lanternLight);
    this.lanternRig.add(this.lanternHanger);
    this.body.add(this.lanternRig);
  }

  setLantern(on) {
    this.hasLantern = on;
    this.lanternRig.visible = on;
  }

  lanternWorld(target) {
    return this.lanternLight.getWorldPosition(target);
  }

  /* ---------- per-frame ---------- */

  update(dt, t, throttle, steer, lanternLevel) {
    const fishing = this.pose.fishing > 0.5;
    this.fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.right.set(-Math.cos(this.heading), 0, Math.sin(this.heading));

    // Rowing rhythm
    const rowing = throttle !== 0 || steer !== 0;
    if (rowing) this.phase += dt * Math.PI * 2 * 0.8;
    const pulse = 0.5 + 0.5 * Math.max(0, Math.sin(this.phase));

    let vf = this.vel.dot(this.fwd);
    let vr = this.vel.dot(this.right);
    // Throttle can be partial (touch stick), so it scales the stroke.
    const thrust = throttle > 0 ? 6.4 * pulse * throttle : throttle < 0 ? 3.2 * pulse * throttle : 0;
    vf += thrust * dt;
    vf -= vf * (0.32 + 0.075 * Math.abs(vf)) * dt;
    vr -= vr * 2.6 * dt;
    if (fishing) vf -= vf * 0.9 * dt;
    this.vel.copy(this.fwd).multiplyScalar(vf).addScaledVector(this.right, vr);
    this.forwardSpeed = vf;

    const turnRate = 0.85 + 0.25 * clamp(Math.abs(vf) / 5, 0, 1);
    this.omega = damp(this.omega, steer * turnRate * (fishing ? 0.5 : 1), 2.8, dt);
    this.heading += this.omega * dt;

    this.pos.addScaledVector(this.vel, dt);
    this.collide(dt);

    // Float on the swell
    const f = this.fwd, r = this.right, p = this.pos;
    const hb = waveHeight(p.x + f.x * 1.5, p.z + f.z * 1.5, t);
    const hs = waveHeight(p.x - f.x * 1.5, p.z - f.z * 1.5, t);
    const hp = waveHeight(p.x - r.x * 0.8, p.z - r.z * 0.8, t);
    const hst = waveHeight(p.x + r.x * 0.8, p.z + r.z * 0.8, t);
    const hc = (hb + hs + hp + hst) / 4;
    const targetPitch = -Math.atan2(hb - hs, 3.0) - thrust * 0.004;
    const targetRoll = Math.atan2(hp - hst, 1.6) + this.omega * vf * 0.035 + Math.sin(t * 0.9) * 0.012;
    this.pitch = damp(this.pitch, targetPitch, 4, dt);
    this.roll = damp(this.roll, targetRoll, 4, dt);
    this.heave = damp(this.heave, hc, 5, dt);

    this.group.position.set(p.x, this.heave - DRAFT, p.z);
    this.group.rotation.y = this.heading;
    this.body.rotation.x = this.pitch;
    this.body.rotation.z = this.roll;

    this.animate(dt, t, throttle, steer, lanternLevel);
    this.group.updateMatrixWorld(true);
  }

  collide(dt) {
    const f = this.fwd, p = this.pos, v = this.vel;
    let impact = 0;
    const LIM = -0.35;
    for (const [off, rad] of [[1.45, 0.5], [0.2, 0.85], [-1.3, 0.75]]) {
      const px = p.x + f.x * off, pz = p.z + f.z * off;
      // Shore and rocks: push back towards deeper water.
      const h = solidHeight(px, pz);
      if (h > LIM) {
        const e = 0.8;
        const gx = solidHeight(px + e, pz) - solidHeight(px - e, pz);
        const gz = solidHeight(px, pz + e) - solidHeight(px, pz - e);
        const gl = Math.hypot(gx, gz) || 1;
        const nx = -gx / gl, nz = -gz / gl;
        const pen = Math.min(h - LIM, 1.5);
        p.x += nx * pen * 0.35;
        p.z += nz * pen * 0.35;
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) {
          v.x -= nx * vn * 1.2;
          v.z -= nz * vn * 1.2;
          impact = Math.max(impact, -vn);
        }
      }
      // The jetty
      const bx0 = JETTY.x - JETTY.halfW - 0.1, bx1 = JETTY.x + JETTY.halfW + 0.1;
      const qx = clamp(px, bx0, bx1), qz = clamp(pz, JETTY.z0, JETTY.z1 + 0.2);
      const dx = px - qx, dz = pz - qz;
      const dist = Math.hypot(dx, dz);
      if (dist < rad) {
        let nx, nz, pen;
        if (dist < 1e-4) {
          // Centre is inside the jetty: push out through the nearest long side.
          nx = px < JETTY.x ? -1 : 1;
          nz = 0;
          pen = (nx < 0 ? px - bx0 : bx1 - px) + rad;
        } else {
          nx = dx / dist;
          nz = dz / dist;
          pen = rad - dist;
        }
        p.x += nx * pen;
        p.z += nz * pen;
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) {
          v.x -= nx * vn * 1.3;
          v.z -= nz * vn * 1.3;
          impact = Math.max(impact, -vn);
        }
      }
    }
    // The open sea goes on forever; drift gently back towards the islands.
    const rd = Math.hypot(p.x, p.z - 20);
    if (rd > 290) {
      v.x -= (p.x / rd) * (rd - 290) * 0.5 * dt;
      v.z -= ((p.z - 20) / rd) * (rd - 290) * 0.5 * dt;
    }
    this.bumpCooldown -= dt;
    if (impact > 1.2 && this.bumpCooldown <= 0 && this.onBump) {
      this.onBump(impact);
      this.bumpCooldown = 0.6;
    }
  }

  animate(dt, t, throttle, steer, lanternLevel) {
    const fishing = this.pose.fishing;
    const rowW = 1 - fishing;

    // Oars: each side has its own effort so turning on the spot sweeps them in opposite directions.
    for (const oar of this.oars) {
      const e = clamp(throttle + (oar.side > 0 ? -steer : steer) * 0.85, -1, 1) * rowW;
      const active = Math.abs(e) > 0.15;
      oar.blend = damp(oar.blend, active ? 1 : 0, 4, dt);
      const dir = e < 0 ? -1 : 1;
      const sweep = Math.cos(this.phase) * 0.55 * dir;
      const inWater = smoothstep(-0.25, 0.35, Math.sin(this.phase));
      const alpha = lerp(-0.95, sweep, oar.blend);
      const beta = lerp(0.2, lerp(0.1, 0.32, inWater), oar.blend);
      oar.g.rotation.y = oar.side > 0 ? -alpha : alpha;
      oar.g.rotation.z = oar.side > 0 ? -beta : beta;
      const isIn = inWater > 0.5 && oar.blend > 0.5 ? 1 : 0;
      if (isIn && !oar.wasIn && this.onStroke) {
        oar.g.updateMatrixWorld(true);
        this.onStroke(oar.g.localToWorld(_a.copy(oar.blade)), oar.side);
      }
      oar.wasIn = isIn;
    }

    // Upper body sways with the stroke, and turns towards the line while fishing.
    const blendRow = (this.oars[0].blend + this.oars[1].blend) / 2;
    this.torso.rotation.x = 0.12 * Math.cos(this.phase) * blendRow + fishing * 0.08;
    this.torso.rotation.y = damp(this.torso.rotation.y, this.pose.rodYaw * 0.35 * fishing, 4, dt);
    const look = fishing ? this.pose.rodYaw * 0.45 : Math.sin(t * 0.21) * 0.35 * (1 - blendRow);
    this.head.rotation.y = damp(this.head.rotation.y, look, 2, dt);
    this.head.rotation.x = fishing ? 0.15 : 0;

    // Rod
    this.rod.visible = fishing > 0.02;
    this.rodStowed.visible = !this.rod.visible;
    this.rod.rotation.y = this.pose.rodYaw;
    this.rod.rotation.x = this.pose.rodPitch;
    const bend = this.pose.bend;
    const k = [0.04, 0.09, 0.16, 0.24, 0.32];
    this.rodSegs.forEach((s, i) => { s.rotation.x = bend * k[i]; });

    // Hands go to the oar handles, or to the rod grip.
    this.torso.updateMatrix();
    this.rod.updateMatrix();
    for (const a of this.arms) {
      const shoulder = _a.copy(a.shoulder).applyMatrix4(this.torso.matrix);
      const oar = a.s > 0 ? this.oars[0] : this.oars[1];
      oar.g.updateMatrix();
      const onOar = _b.copy(oar.handle).applyMatrix4(oar.g.matrix);
      const onRod = _d.set(0, a.s > 0 ? 0.08 : 0.3, 0).applyMatrix4(this.rod.matrix);
      a.target.lerpVectors(onOar, onRod, smoothstep(0, 1, fishing));
      setLimb(a.arm, shoulder, a.target, 0.055);
      a.hand.position.copy(a.target);
    }

    // Lantern sways and glows as evening comes.
    if (this.hasLantern) {
      this.lanternHanger.rotation.x = -this.pitch * 0.8 + Math.sin(t * 1.3) * 0.04;
      this.lanternHanger.rotation.z = -this.roll * 0.8;
      this.lanternLevel = damp(this.lanternLevel, lanternLevel, 1.5, dt);
      const flicker = 1 + Math.sin(t * 11) * 0.03 + Math.sin(t * 7.3) * 0.03;
      this.lanternLight.intensity = this.lanternLevel * 9 * flicker;
      this.lanternGlass.emissiveIntensity = 0.2 + this.lanternLevel * 3.2 * flicker;
    }
  }
}
