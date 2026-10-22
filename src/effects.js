import * as THREE from 'three';
import { waveHeight } from './world/water.js';
import { clamp, rand, smoothstep, glowTexture } from './util.js';

const WAKE_POINTS = 70;
const WAKE_LIFE = 3.6;

// Water effects: ripple rings, splash droplets, the boat's wake, and leaping fish.
export class Effects {
  constructor(scene) {
    this.scene = scene;

    const rg = new THREE.RingGeometry(0.86, 1, 40);
    rg.rotateX(-Math.PI / 2);
    this.ripples = [];
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      m.renderOrder = 3;
      scene.add(m);
      this.ripples.push({ m, life: 0, max: 1, size: 1, x: 0, z: 0, str: 0.5 });
    }
    this.ri = 0;

    this.N = 500;
    this.pp = new Float32Array(this.N * 3).fill(-999);
    this.pv = new Float32Array(this.N * 3);
    this.pl = new Float32Array(this.N);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pp, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({
      size: 0.16, map: glowTexture(), transparent: true, depthWrite: false, color: '#f3f7fa', opacity: 0.9,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
    this.pi = 0;

    this.buildWake();
    this.jumps = [];
    this.onJumpSplash = null;
  }

  ripple(x, z, size = 1.5, life = 1.6, str = 0.5) {
    const r = this.ripples[this.ri++ % this.ripples.length];
    Object.assign(r, { x, z, size, max: life, life, str });
    r.m.visible = true;
  }

  splash(x, y, z, n = 12, power = 2.2, spread = 1) {
    for (let k = 0; k < n; k++) {
      const i = this.pi++ % this.N;
      this.pp[i * 3] = x + rand(-0.15, 0.15) * spread;
      this.pp[i * 3 + 1] = y;
      this.pp[i * 3 + 2] = z + rand(-0.15, 0.15) * spread;
      const a = rand(0, Math.PI * 2), s = rand(0.3, 1) * power * 0.4 * spread;
      this.pv[i * 3] = Math.cos(a) * s;
      this.pv[i * 3 + 1] = rand(0.6, 1.2) * power;
      this.pv[i * 3 + 2] = Math.sin(a) * s;
      this.pl[i] = 1.6;
    }
  }

  jump(mesh, x, z, dirAngle) {
    const dx = Math.sin(dirAngle), dz = Math.cos(dirAngle);
    mesh.visible = true;
    mesh.scale.setScalar(0.5 + Math.random() * 0.3);
    this.jumps.push({ mesh, x, z, dx, dz, u: 0, dur: rand(0.6, 0.85), h: rand(0.5, 0.9), dist: rand(1.2, 2.2) });
    this.splash(x, 0.05, z, 10, 1.8);
    this.ripple(x, z, 1.4, 1.4, 0.45);
    if (this.onJumpSplash) this.onJumpSplash(x, z, 0.6);
  }

  buildWake() {
    this.trail = [];
    this.trailT = 0;
    const bands = 3;
    this.wakePos = new Float32Array(bands * WAKE_POINTS * 2 * 3);
    this.wakeCol = new Float32Array(bands * WAKE_POINTS * 2 * 4);
    const idx = [];
    for (let b = 0; b < bands; b++) {
      for (let k = 0; k < WAKE_POINTS - 1; k++) {
        const a = (b * WAKE_POINTS + k) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.wakePos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.wakeCol, 4));
    this.wake = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.wake.frustumCulled = false;
    this.wake.renderOrder = 2;
    this.scene.add(this.wake);
  }

  updateWake(dt, t, boat) {
    const sp = boat.speed;
    this.trailT -= dt;
    for (const p of this.trail) p.age += dt;
    while (this.trail.length && this.trail[this.trail.length - 1].age > WAKE_LIFE) this.trail.pop();
    if (this.trailT <= 0 && sp > 0.3) {
      this.trailT = 0.07;
      const f = boat.fwd;
      this.trail.unshift({ x: boat.pos.x - f.x * 1.75, z: boat.pos.z - f.z * 1.75, fx: f.x, fz: f.z, age: 0, s: clamp(sp / 4.5, 0, 1) });
      if (this.trail.length > WAKE_POINTS) this.trail.pop();
    }
    const n = this.trail.length;
    const P = this.wakePos, C = this.wakeCol;
    for (let b = 0; b < 3; b++) {
      const side = b === 0 ? 1 : b === 1 ? -1 : 0;
      for (let k = 0; k < WAKE_POINTS; k++) {
        const vi = (b * WAKE_POINTS + k) * 2;
        const p = this.trail[Math.min(k, n - 1)];
        if (!p) {
          C[vi * 4 + 3] = C[vi * 4 + 7] = 0;
          continue;
        }
        const a = p.age, life = 1 - a / WAKE_LIFE;
        const rx = -p.fz, rz = p.fx;
        let off, w, alpha;
        if (side !== 0) { off = side * (0.55 + a * 1.15); w = 0.14 + a * 0.2; alpha = 0.45; }
        else { off = 0; w = 0.4 + a * 0.7; alpha = 0.2; }
        alpha *= p.s * life * life * smoothstep(0, 0.12, a) * (k < n ? 1 : 0);
        const cx = p.x + rx * off, cz = p.z + rz * off;
        const y = waveHeight(cx, cz, t) + 0.035;
        P[vi * 3] = cx - rx * w * 0.5; P[vi * 3 + 1] = y; P[vi * 3 + 2] = cz - rz * w * 0.5;
        P[vi * 3 + 3] = cx + rx * w * 0.5; P[vi * 3 + 4] = y; P[vi * 3 + 5] = cz + rz * w * 0.5;
        for (let q = 0; q < 2; q++) {
          C[(vi + q) * 4] = 1; C[(vi + q) * 4 + 1] = 1; C[(vi + q) * 4 + 2] = 1; C[(vi + q) * 4 + 3] = alpha;
        }
      }
    }
    this.wake.geometry.attributes.position.needsUpdate = true;
    this.wake.geometry.attributes.color.needsUpdate = true;
  }

  update(dt, t, boat) {
    for (const r of this.ripples) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const u = 1 - Math.max(r.life, 0) / r.max;
      const s = 0.2 + r.size * Math.sqrt(u);
      r.m.scale.set(s, 1, s);
      r.m.position.set(r.x, waveHeight(r.x, r.z, t) + 0.03, r.z);
      r.m.material.opacity = r.str * (1 - u) * (1 - u);
      if (r.life <= 0) r.m.visible = false;
    }

    for (let i = 0; i < this.N; i++) {
      if (this.pl[i] <= 0) continue;
      this.pl[i] -= dt;
      this.pv[i * 3 + 1] -= 9.8 * dt;
      this.pp[i * 3] += this.pv[i * 3] * dt;
      this.pp[i * 3 + 1] += this.pv[i * 3 + 1] * dt;
      this.pp[i * 3 + 2] += this.pv[i * 3 + 2] * dt;
      if (this.pp[i * 3 + 1] < -0.15 || this.pl[i] <= 0) {
        this.pl[i] = 0;
        this.pp[i * 3 + 1] = -999;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;

    for (let i = this.jumps.length - 1; i >= 0; i--) {
      const j = this.jumps[i];
      j.u += dt / j.dur;
      const u = Math.min(j.u, 1);
      const x = j.x + j.dx * j.dist * u, z = j.z + j.dz * j.dist * u;
      j.mesh.position.set(x, -0.25 + 4 * j.h * u * (1 - u), z);
      j.mesh.rotation.set(-(1 - 2 * u) * 1.1, Math.atan2(j.dx, j.dz), 0, 'YXZ');
      if (j.mesh.userData.tail) j.mesh.userData.tail.rotation.y = Math.sin(t * 30) * 0.5;
      if (j.u >= 1) {
        j.mesh.visible = false;
        this.splash(x, 0.05, z, 8, 1.5);
        this.ripple(x, z, 1.6, 1.5, 0.5);
        if (this.onJumpSplash) this.onJumpSplash(x, z, 0.4);
        this.jumps.splice(i, 1);
      }
    }

    this.updateWake(dt, t, boat);
  }
}
