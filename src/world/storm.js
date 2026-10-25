import * as THREE from 'three';
import { conditions, windAt, waveHeight, shelterAt } from './conditions.js';
import { clamp, smoothstep, glowTexture } from '../util.js';

// A storm's show: lightning and the spray off the seas.
//
//  · Lightning strikes somewhere out over the sea or the hills, every few seconds to half a
//    minute (more often the harder it blows): a jagged bolt from the cloud to the ground, a flash
//    that lights the whole sky and the world for an instant (often twice), and the thunder after
//    it, later the further off it was (sound travels a kilometre in three seconds).
//  · Spray: where a big sea's crest breaks in the wind, a burst of white blown downwind off its
//    top; and from the bow of a boat slamming into a wave (see burst).
//
// It only draws anything in a storm; in fair weather it waits.

const MAX_SPRAY = 420;

export class Storm {
  constructor(scene) {
    // The bolt: a ribbon of a few jagged segments with a branch or two, rebuilt each strike.
    this.boltGeo = new THREE.BufferGeometry();
    this.boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 6 * 64), 3));
    this.bolt = new THREE.Mesh(this.boltGeo, new THREE.MeshBasicMaterial({ color: '#eef3ff', transparent: true, opacity: 0, fog: false, side: THREE.DoubleSide, depthWrite: false }));
    this.bolt.frustumCulled = false;
    this.bolt.renderOrder = -4;
    this.bolt.visible = false;
    scene.add(this.bolt);
    this.next = 6;
    this.flash = 0;
    this.strike = null; // { t, dist, dir, pulses }
    this.dir = new THREE.Vector3(1, 0.2, 0);
    this.thunders = []; // [{ at, dist }]
    // Spray: soft white points, blown downwind and falling.
    const geo = new THREE.BufferGeometry();
    this.sp = new Float32Array(MAX_SPRAY * 3);
    this.sa = new Float32Array(MAX_SPRAY * 4);
    this.vel = new Float32Array(MAX_SPRAY * 3);
    this.life = new Float32Array(MAX_SPRAY);
    this.age = new Float32Array(MAX_SPRAY).fill(1e9);
    geo.setAttribute('position', new THREE.BufferAttribute(this.sp, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.sa, 4).setUsage(THREE.DynamicDrawUsage));
    this.spray = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.55, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, fog: true }));
    this.spray.frustumCulled = false;
    this.spray.renderOrder = 3;
    scene.add(this.spray);
    this.cursor = 0;
    this.crestT = 0;
  }

  // A burst of spray at (x, y, z), thrown up and blown along (vx, vz).
  burst(x, y, z, vx, vz, n = 24, up = 3) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_SPRAY;
      this.sp[i * 3] = x + (Math.random() - 0.5) * 1.2;
      this.sp[i * 3 + 1] = y + Math.random() * 0.3;
      this.sp[i * 3 + 2] = z + (Math.random() - 0.5) * 1.2;
      this.vel[i * 3] = vx * (0.5 + Math.random() * 0.7) + (Math.random() - 0.5) * 1.5;
      this.vel[i * 3 + 1] = up * (0.5 + Math.random() * 0.8);
      this.vel[i * 3 + 2] = vz * (0.5 + Math.random() * 0.7) + (Math.random() - 0.5) * 1.5;
      this.life[i] = 0.9 + Math.random() * 0.9;
      this.age[i] = 0;
    }
  }

  // Each frame. env: the sky (its flash and storm are set here); camera; t: the wave clock.
  // onThunder(distance in metres, loudness 0 … 1) when the sound of a strike arrives.
  update(dt, t, { storm, camera, env, onThunder, flashes = true }) {
    const cam = camera.position;
    // Lightning, in a real storm.
    this.next -= dt;
    if (storm > 0.55 && this.next <= 0 && !this.strike) {
      this.next = (5 + Math.random() * 22) / (0.4 + storm * 0.6);
      this.strikeAt(cam, flashes);
    }
    if (this.strike) {
      const S = this.strike;
      S.t += dt;
      // One to three pulses of light in half a second, each fading fast.
      let f = 0;
      for (const p of S.pulses) {
        const k = S.t - p;
        if (k >= 0) f = Math.max(f, Math.exp(-k * 14) * (k < 0.03 ? k / 0.03 : 1));
      }
      this.flash = f * S.bright;
      this.bolt.visible = S.t < 0.45;
      this.bolt.material.opacity = clamp(f * 1.4, 0, 1);
      if (S.t > 0.7) this.strike = null;
    } else {
      this.flash = 0;
      this.bolt.visible = false;
    }
    env.flash = this.flash;
    env.flashDir.copy(this.dir);
    env.storm = storm;
    // The thunder, when it arrives.
    for (let i = this.thunders.length - 1; i >= 0; i--) {
      const T = this.thunders[i];
      T.at -= dt;
      if (T.at <= 0) {
        onThunder?.(T.dist, clamp(1.15 - T.dist / 2200, 0.15, 1));
        this.thunders.splice(i, 1);
      }
    }
    this.updateSpray(dt, t, storm, cam);
  }

  // (Somewhere round the camera; a and dist to choose where, for a look.)
  strikeAt(cam, flashes, a = Math.random() * Math.PI * 2, dist = 350 + Math.random() * 1600) {
    const x = cam.x + Math.cos(a) * dist, z = cam.z + Math.sin(a) * dist;
    this.dir.set(Math.cos(a), 0.25, Math.sin(a)).normalize();
    // (Its own sound arrives later: a kilometre in about three seconds.)
    this.thunders.push({ at: dist / 343, dist });
    if (!flashes) return;
    const pulses = [0];
    if (Math.random() < 0.6) pulses.push(0.12 + Math.random() * 0.12);
    if (Math.random() < 0.3) pulses.push(0.3 + Math.random() * 0.15);
    this.strike = { t: 0, pulses, bright: clamp(1.25 - dist / 2000, 0.35, 1) };
    // The bolt: from the cloud base down to the sea, jagged, with a branch or two.
    const pos = this.boltGeo.attributes.position.array;
    let n = 0;
    const seg = (x0, y0, z0, x1, y1, z1, w) => {
      if (n + 18 > pos.length) return;
      // A flat ribbon turned to face the camera.
      const dx = cam.x - (x0 + x1) / 2, dz = cam.z - (z0 + z1) / 2, l = Math.hypot(dx, dz) || 1;
      const px = (-dz / l) * w, pz = (dx / l) * w;
      pos.set([x0 - px, y0, z0 - pz, x0 + px, y0, z0 + pz, x1 + px, y1, z1 + pz, x0 - px, y0, z0 - pz, x1 + px, y1, z1 + pz, x1 - px, y1, z1 - pz], n);
      n += 18;
    };
    const path = (x0, y0, z0, y1, steps, w, branches) => {
      let px = x0, py = y0, pz = z0;
      const dy = (y1 - y0) / steps;
      for (let i = 0; i < steps; i++) {
        const nx = px + (Math.random() - 0.5) * 34, ny = py + dy, nz = pz + (Math.random() - 0.5) * 34;
        seg(px, py, pz, nx, ny, nz, w);
        if (branches && Math.random() < 0.3) path(nx, ny, nz, ny + dy * (2 + Math.random() * 3), 3, w * 0.5, false);
        px = nx; py = ny; pz = nz;
      }
    };
    path(x, 260 + Math.random() * 60, z, 0, 9, 1.6 + dist * 0.0012, true);
    pos.fill(0, n);
    this.boltGeo.attributes.position.needsUpdate = true;
    this.boltGeo.setDrawRange(0, n / 3);
    this.boltGeo.computeBoundingSphere();
  }

  updateSpray(dt, t, storm, cam) {
    // New spray off the breaking crests round you, where the big seas reach.
    if (storm > 0.25) {
      this.crestT -= dt;
      const swell = conditions.sea.swell;
      while (this.crestT <= 0) {
        this.crestT += 0.05 / storm;
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 55;
        const x = cam.x + Math.cos(a) * r, z = cam.z + Math.sin(a) * r;
        const sh = shelterAt(x, z);
        if (sh[0] < 0.35) continue;
        const h = waveHeight(x, z, t);
        if (h < swell * 0.7 * sh[0]) continue;
        const w = windAt(x, z, t);
        this.burst(x, h, z, w.x * 0.55, w.z * 0.55, 10, 1.6 + storm * 1.8);
      }
    }
    let live = 0;
    const g = 9.8;
    for (let i = 0; i < MAX_SPRAY; i++) {
      const o = i * 3, c = i * 4;
      if (this.age[i] > this.life[i]) {
        this.sa[c + 3] = 0;
        continue;
      }
      live++;
      this.age[i] += dt;
      this.vel[o + 1] -= g * dt * 0.7;
      this.sp[o] += this.vel[o] * dt;
      this.sp[o + 1] += this.vel[o + 1] * dt;
      this.sp[o + 2] += this.vel[o + 2] * dt;
      const k = this.age[i] / this.life[i];
      this.sa[c] = this.sa[c + 1] = this.sa[c + 2] = 1;
      this.sa[c + 3] = 0.7 * Math.sin(Math.PI * clamp(k, 0, 1)) * smoothstep(0, 0.1, k + 0.02);
    }
    this.spray.visible = live > 0;
    if (live > 0) {
      this.spray.geometry.attributes.position.needsUpdate = true;
      this.spray.geometry.attributes.color.needsUpdate = true;
    }
  }
}
