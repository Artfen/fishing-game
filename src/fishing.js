import * as THREE from 'three';
import { FISH, pickFish, rollSize, buildFishMesh } from './fish.js';
import { waveHeight } from './world/water.js';
import { solidHeight } from './world/terrain.js';
import { clamp, lerp, damp, rand, smoothstep, wrapAngle } from './util.js';

const LINE_N = 28;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

// The fishing loop:
// idle → charging (hold) → casting → waiting (nibbles) → bite → reeling → landing → caught → releasing → idle
// Missing a bite or straining the line never loses anything; it just takes a little longer.
export class Fishing {
  constructor(scene, boat, fx, audio, hooks) {
    this.boat = boat;
    this.fx = fx;
    this.audio = audio;
    this.hooks = hooks;
    this.state = 'idle';
    this.t = 0;
    this.power = 0;
    this.aimYaw = 0;
    this.held = false;
    this.hold = false;
    this.holdT = 0;
    this.fight = null;
    this.pending = null;
    this.tip = new THREE.Vector3();
    this.bob = new THREE.Vector3();
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.fishPos = new THREE.Vector3();

    const bobber = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#e5533d' }));
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#f6f1e6' }));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 4), new THREE.MeshLambertMaterial({ color: '#2f2a26' }));
    stem.position.y = 0.11;
    bobber.add(top, bottom, stem);
    bobber.visible = false;
    scene.add(bobber);
    this.bobber = bobber;

    const lg = new THREE.BufferGeometry();
    this.linePos = new Float32Array(LINE_N * 3);
    lg.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3));
    this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#f5efe2', transparent: true, opacity: 0.75 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);

    this.aimRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#fff6e0', transparent: true, opacity: 0, depthWrite: false }),
    );
    this.aimRing.renderOrder = 3;
    scene.add(this.aimRing);

    this.fishMeshes = {};
    for (const f of FISH) {
      const m = buildFishMesh(f);
      scene.add(m);
      this.fishMeshes[f.id] = m;
    }
  }

  get busy() { return this.state !== 'idle'; }
  get lineOut() { return this.state !== 'idle' && this.state !== 'charging'; }
  get pulling() { return !!(this.fight && this.fight.pulling); }

  /* ---------- input ---------- */

  onDown() {
    switch (this.state) {
      case 'idle':
        if (this.boat.speed > 1.8) {
          this.hooks.flash('Let the boat drift to a stop first');
          return;
        }
        this.state = 'charging';
        this.t = 0;
        this.power = 0;
        break;
      case 'waiting':
        this.hold = true;
        this.holdT = 0;
        break;
      case 'bite':
        this.hook();
        break;
      case 'caught':
        if (this.t > 0.5) this.letGo();
        break;
      default:
    }
  }

  onUp() {
    if (this.state === 'charging') this.cast();
    else if (this.state === 'waiting' && this.hold && this.holdT < 0.35) this.twitch();
    this.hold = false;
  }

  cancel() {
    if (this.state === 'charging') this.state = 'idle';
    else if (this.state === 'casting' || this.state === 'waiting' || this.state === 'bite') this.reelIn();
    else if (this.state === 'reeling') {
      this.hooks.flash('You let the line go slack, and the fish swims free');
      this.reelIn();
    }
  }

  /* ---------- transitions ---------- */

  aimPoint(power, out) {
    const dx = Math.sin(this.aimYaw), dz = Math.cos(this.aimYaw);
    const bx = this.boat.pos.x + dx, bz = this.boat.pos.z + dz;
    for (let d = 5 + power * 17; d > 3; d -= 0.5) {
      const x = bx + dx * d, z = bz + dz * d;
      if (solidHeight(x, z) < -0.8) return out.set(x, 0, z);
    }
    return null;
  }

  cast() {
    if (!this.aimPoint(this.power, this.to)) {
      this.state = 'idle';
      this.hooks.flash('Too close to the shore to cast that way');
      return;
    }
    this.state = 'casting';
    this.t = 0;
    this.from.copy(this.tip);
    this.flight = 0.55 + this.from.distanceTo(this.to) * 0.025;
    this.audio.cast();
    this.hooks.onCast();
  }

  land(t) {
    this.state = 'waiting';
    this.t = 0;
    this.bob.set(this.to.x, waveHeight(this.to.x, this.to.z, t), this.to.z);
    this.fx.ripple(this.bob.x, this.bob.z, 1.2, 1.4, 0.55);
    this.fx.splash(this.bob.x, 0.05, this.bob.z, 8, 1.4, 0.6);
    this.audio.plop();
    const { fish, total } = pickFish(this.hooks.context(this.bob.x, this.bob.z));
    this.pending = fish;
    this.biteT = this.hooks.hasCaught() ? Math.max(3, rand(4, 10) / Math.pow(clamp(total, 0.3, 1.6), 0.7)) : rand(3, 5);
    this.nibbleT = rand(1.0, 2.4);
    this.dip = 0;
  }

  nibble() {
    this.dip = 0.06;
    this.fx.ripple(this.bob.x, this.bob.z, 0.6, 0.8, 0.35);
    this.audio.nibble();
  }

  twitch() {
    this.dip = 0.1;
    this.fx.ripple(this.bob.x, this.bob.z, 0.8, 0.9, 0.4);
    this.audio.nibble(0.6);
    this.biteT = Math.max(1.2, this.biteT - 0.6);
  }

  bite() {
    this.state = 'bite';
    this.biteT = 1.9;
    this.fx.splash(this.bob.x, 0.05, this.bob.z, 10, 1.8, 0.6);
    this.fx.ripple(this.bob.x, this.bob.z, 1.6, 1.4, 0.6);
    this.audio.bite();
  }

  missed() {
    this.state = 'waiting';
    this.biteT = rand(3, 6);
    this.nibbleT = rand(1, 2);
    this.hooks.flash('It nibbled, then slipped away. Another will come.');
  }

  hook() {
    const sp = this.pending || FISH[0];
    this.fight = {
      sp, size: rollSize(sp), progress: 0, tension: 0.2, pulling: false, phaseT: rand(0.9, 1.6),
      warned: false, lat: 0, dir: 1, splashT: 0, tickT: 0, start: this.bob.clone(),
    };
    this.state = 'reeling';
    this.t = 0;
    this.audio.hookSet();
    this.fx.splash(this.bob.x, 0.05, this.bob.z, 14, 2.2, 0.7);
    this.fx.ripple(this.bob.x, this.bob.z, 1.8, 1.2, 0.6);
    this.hooks.onHook();
  }

  landFish() {
    const F = this.fight;
    const mesh = this.fishMeshes[F.sp.id];
    this.state = 'landing';
    this.t = 0;
    this.from.set(this.fishPos.x, -0.2, this.fishPos.z);
    mesh.visible = true;
    mesh.scale.setScalar((F.size / 100) * 1.8);
    this.fx.splash(this.fishPos.x, 0.05, this.fishPos.z, 18, 2.6);
    this.fx.ripple(this.fishPos.x, this.fishPos.z, 2.2, 1.6, 0.6);
    this.audio.splashBig();
  }

  letGo() {
    const b = this.boat;
    const mesh = this.fishMeshes[this.fight.sp.id];
    this.state = 'releasing';
    this.t = 0;
    this.from.copy(mesh.position);
    this.to.set(b.pos.x + b.right.x * 2.2 + b.fwd.x, 0, b.pos.z + b.right.z * 2.2 + b.fwd.z);
    this.hooks.onRelease();
  }

  reelIn() {
    this.state = 'retrieving';
    this.t = 0;
    this.from.copy(this.bob);
    this.audio.reelIn();
  }

  holdPoint(out) {
    return this.boat.body.localToWorld(out.set(-0.15, 1.45, 1.05));
  }

  /* ---------- per-frame ---------- */

  update(dt, t, camYaw, held) {
    this.t += dt;
    this.held = held;
    const boat = this.boat, pose = boat.pose;
    boat.rodTip.getWorldPosition(this.tip);

    let rodPitch = 0.85, bend = 0.05;
    let rodYaw = this.state === 'idle' ? 0 : clamp(wrapAngle(Math.atan2(this.bob.x - boat.pos.x, this.bob.z - boat.pos.z) - boat.heading), -1.6, 1.6);
    const fishMesh = this.fight ? this.fishMeshes[this.fight.sp.id] : null;

    switch (this.state) {
      case 'charging': {
        const rel = clamp(wrapAngle(camYaw - boat.heading), -1.6, 1.6);
        this.aimYaw = boat.heading + rel;
        rodYaw = rel;
        this.power = Math.min(1, this.power + dt / 1.1);
        rodPitch = lerp(0.5, -0.45, smoothstep(0, 1, this.power));
        const p = this.aimPoint(this.power, _w);
        if (p) {
          this.aimRing.position.set(p.x, waveHeight(p.x, p.z, t) + 0.05, p.z);
          const s = 0.8 + this.power * 0.6;
          this.aimRing.scale.set(s, 1, s);
        }
        this.aimRing.visible = !!p;
        this.bob.copy(this.tip).add(_v.set(0, -0.55, 0));
        break;
      }
      case 'casting': {
        const u = clamp(this.t / this.flight, 0, 1);
        rodPitch = this.t < 0.12 ? lerp(-0.45, 1.25, this.t / 0.12) : lerp(1.25, 0.85, smoothstep(0.12, 0.6, this.t));
        rodYaw = clamp(wrapAngle(this.aimYaw - boat.heading), -1.6, 1.6);
        this.bob.lerpVectors(this.from, this.to, u);
        this.bob.y = lerp(this.from.y, waveHeight(this.to.x, this.to.z, t), u) + 4 * (1.2 + this.flight) * u * (1 - u);
        if (u >= 1) this.land(t);
        break;
      }
      case 'waiting': {
        rodPitch = 0.8;
        bend = 0.08;
        if (this.hold) {
          this.holdT += dt;
          if (this.holdT > 0.45) {
            this.hold = false;
            this.reelIn();
            break;
          }
        }
        this.nibbleT -= dt;
        this.biteT -= dt;
        if (this.nibbleT <= 0) {
          this.nibble();
          this.nibbleT = this.biteT < 1.2 ? 0.35 : rand(1.2, 3);
        }
        this.dip = damp(this.dip, 0, 8, dt);
        this.bob.y = waveHeight(this.bob.x, this.bob.z, t) - this.dip;
        if (this.biteT <= 0) this.bite();
        break;
      }
      case 'bite': {
        rodPitch = 0.8;
        bend = 0.35 + Math.sin(t * 30) * 0.05;
        this.biteT -= dt;
        this.bob.y = waveHeight(this.bob.x, this.bob.z, t) - 0.22 + Math.sin(t * 24) * 0.03;
        if (this.biteT <= 0) this.missed();
        break;
      }
      case 'reeling': {
        this.updateFight(dt, t, held);
        const F = this.fight;
        if (!F) break;
        rodPitch = 0.95 - F.tension * 0.25;
        bend = 0.25 + F.tension * 0.95 + (F.pulling ? Math.sin(t * 22) * 0.06 : 0);
        break;
      }
      case 'landing': {
        const hp = this.holdPoint(_w);
        const u = clamp(this.t / 0.8, 0, 1);
        fishMesh.position.lerpVectors(this.from, hp, smoothstep(0, 1, u));
        fishMesh.position.y += Math.sin(u * Math.PI) * 1.0;
        fishMesh.rotation.set(-1.25 + Math.sin(t * 14) * 0.15, boat.heading + Math.PI / 2, 0, 'YXZ');
        fishMesh.userData.tail.rotation.y = Math.sin(t * 26) * 0.5;
        rodPitch = 1.1;
        bend = 0.7;
        rodYaw = 0.2;
        if (u >= 1) {
          this.state = 'caught';
          this.t = 0;
          this.hooks.onCatch(this.fight.sp, this.fight.size);
        }
        break;
      }
      case 'caught': {
        const hp = this.holdPoint(_w);
        fishMesh.position.copy(hp);
        fishMesh.position.y += Math.sin(t * 2) * 0.03;
        const wig = Math.sin(t * 9) * Math.max(0, Math.sin(t * 1.3)) * 0.25;
        fishMesh.rotation.set(-1.2 + wig * 0.3, boat.heading + Math.PI / 2 + wig, 0, 'YXZ');
        fishMesh.userData.tail.rotation.y = Math.sin(t * 18) * 0.4 * Math.max(0.2, Math.sin(t * 1.3));
        rodPitch = 1.15;
        bend = 0.6;
        rodYaw = 0.2;
        break;
      }
      case 'releasing': {
        const u = clamp(this.t / 0.65, 0, 1);
        fishMesh.position.lerpVectors(this.from, this.to, u);
        fishMesh.position.y = lerp(this.from.y, -0.3, u) + Math.sin(u * Math.PI) * 0.6;
        fishMesh.rotation.set(lerp(-1.2, 1.3, u), boat.heading + Math.PI / 2, 0, 'YXZ');
        rodPitch = 0.9;
        if (u >= 1) {
          fishMesh.visible = false;
          this.fx.splash(this.to.x, 0.05, this.to.z, 12, 2);
          this.fx.ripple(this.to.x, this.to.z, 2, 1.6, 0.6);
          this.audio.plop(1.3);
          this.fight = null;
          this.state = 'idle';
        }
        break;
      }
      case 'retrieving': {
        const u = clamp(this.t / 0.45, 0, 1);
        this.bob.lerpVectors(this.from, this.tip, u * u);
        this.bob.y += Math.sin(u * Math.PI) * 0.6;
        if (u >= 1) {
          this.state = 'idle';
          this.fight = null;
        }
        break;
      }
      default:
    }

    pose.fishing = damp(pose.fishing, this.state === 'idle' ? 0 : 1, this.state === 'idle' ? 5 : 9, dt);
    pose.rodYaw = this.state === 'charging' ? rodYaw : damp(pose.rodYaw, rodYaw, 6, dt);
    pose.rodPitch = damp(pose.rodPitch, rodPitch, 16, dt);
    pose.bend = damp(pose.bend, bend, 10, dt);

    this.updateVisuals(t, dt, fishMesh);
  }

  updateFight(dt, t, held) {
    const F = this.fight, sp = F.sp;
    F.phaseT -= dt;
    if (F.phaseT <= 0) {
      if (F.pulling) {
        F.pulling = false;
        F.phaseT = rand(1.1, 2.4);
        F.warned = false;
      } else {
        F.pulling = true;
        F.phaseT = rand(0.7, 1.4) + sp.strength * 0.5;
        F.dir = Math.random() < 0.5 ? -1 : 1;
      }
    }
    // A flick on the surface just before each run, so it can be read in time.
    if (!F.pulling && !F.warned && F.phaseT < 0.45) {
      F.warned = true;
      this.fx.splash(this.fishPos.x, 0.05, this.fishPos.z, 6, 1.6, 0.5);
      this.fx.ripple(this.fishPos.x, this.fishPos.z, 1.0, 0.9, 0.5);
      this.audio.flick();
    }
    let dT, dp;
    if (F.pulling) {
      if (held) { dT = 0.8 * sp.strength + 0.1; dp = sp.reel * 0.2; }
      else { dT = -0.7; dp = -0.03 * sp.strength; }
    } else if (held) { dT = 0.05; dp = sp.reel; }
    else { dT = -0.9; dp = 0; }
    F.tension = clamp(F.tension + dT * dt, 0, 1);
    F.progress = clamp(F.progress + dp * dt, 0, 1);
    if (F.tension >= 1) {
      F.progress = Math.max(0, F.progress - 0.1);
      F.tension = 0.55;
      F.pulling = true;
      F.phaseT = 0.9;
      this.audio.strain();
      this.hooks.flash('The line sings! Ease off while it pulls.');
      this.hooks.shake(0.25);
    }
    if (held) {
      F.tickT -= dt;
      if (F.tickT <= 0) {
        this.audio.tick(F.pulling ? 0.7 : 1);
        F.tickT = F.pulling ? 0.12 : 0.065;
      }
    }

    const b = this.boat.pos;
    let dx = F.start.x - b.x, dz = F.start.z - b.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    const e = 1 - Math.pow(1 - F.progress, 1.5);
    const cx = lerp(F.start.x, b.x + dx * 2.6, e), cz = lerp(F.start.z, b.z + dz * 2.6, e);
    F.lat = damp(F.lat, F.pulling ? F.dir * 2.2 * (1 - F.progress * 0.6) : 0, 1.4, dt);
    const wig = Math.sin(t * 6.5) * 0.15;
    this.fishPos.set(cx - dz * (F.lat + wig), 0, cz + dx * (F.lat + wig));
    this.bob.set(this.fishPos.x, waveHeight(this.fishPos.x, this.fishPos.z, t) - (F.pulling ? 0.16 : 0.06), this.fishPos.z);
    if (F.pulling) {
      F.splashT -= dt;
      if (F.splashT <= 0) {
        F.splashT = rand(0.2, 0.4);
        this.fx.splash(this.fishPos.x, 0.05, this.fishPos.z, 5, 1.6, 0.6);
        this.fx.ripple(this.fishPos.x, this.fishPos.z, 1.0, 1.0, 0.4);
        this.audio.splashSmall();
      }
    }
    if (F.progress >= 1) this.landFish();
  }

  updateVisuals(t, dt, fishMesh) {
    const s = this.state;
    const holdingFish = s === 'landing' || s === 'caught';
    this.bobber.visible = s !== 'idle' && s !== 'releasing' && !holdingFish;
    this.bobber.position.copy(this.bob);
    this.bobber.rotation.z = Math.sin(t * 1.7) * 0.12;
    this.bobber.rotation.x = Math.sin(t * 1.3 + 1) * 0.1;

    this.line.visible = s !== 'idle' && s !== 'releasing';
    if (this.line.visible) {
      let end = this.bob, sag = 0.35;
      if (holdingFish) {
        end = fishMesh.localToWorld(_v.set(0, 0, 0.5));
        sag = 0.02;
      } else if (s === 'charging') sag = 0;
      else if (s === 'casting' || s === 'retrieving') sag = 0.12;
      else if (s === 'reeling') sag = (1 - this.fight.tension) * 0.3;
      else sag = 0.35 + this.tip.distanceTo(this.bob) * 0.015;
      this.setLine(this.tip, end, sag);
    }
    this.aimRing.material.opacity = damp(this.aimRing.material.opacity, s === 'charging' && this.aimRing.visible ? 0.6 : 0, 10, dt);
  }

  setLine(a, b, sag) {
    const P = this.linePos;
    for (let i = 0; i < LINE_N; i++) {
      const u = i / (LINE_N - 1);
      P[i * 3] = lerp(a.x, b.x, u);
      P[i * 3 + 1] = lerp(a.y, b.y, u) - sag * 4 * u * (1 - u);
      P[i * 3 + 2] = lerp(a.z, b.z, u);
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }
}
