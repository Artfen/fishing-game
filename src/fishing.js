import * as THREE from 'three';
import { FISH, buildFishMesh } from './fish.js';
import { waveHeight } from './world/water.js';
import { solidHeight } from './world/terrain.js';
import { clamp, lerp, damp, rand, smoothstep, wrapAngle, glowTexture } from './util.js';

const LINE_N = 28;
const ARC_N = 24;
const AIM_TIME = 1.5; // seconds of holding for a full-length cast
const MIN_CAST = 4;
const MAX_CAST = 24;
const TAP = 0.22; // a press shorter than this is a twitch; longer is reeling
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

// The fishing loop:
// idle → aiming (hold, aim, choose distance) → casting → drifting (bait in the water)
//      → bite → reeling → landing → caught → releasing → idle
// Fish come to the bait on their own (see world/ecosystem.js); this file reports
// what they do through the float and the line, and plays the fight.
export class Fishing {
  constructor(scene, boat, fx, audio, eco, hooks) {
    this.boat = boat;
    this.fx = fx;
    this.audio = audio;
    this.eco = eco;
    this.hooks = hooks;
    this.state = 'idle';
    this.t = 0;
    this.power = 0;
    this.aimOffset = 0;
    this.aimYaw = 0;
    this.castDist = 0;
    this.aimValid = false;
    this.apex = 1;
    this.flight = 1;
    this.held = false;
    this.hold = false;
    this.holdT = 0;
    this.reelSpeed = 0;
    this.depth = 1.2; // chosen bait depth, remembered between casts
    this.baitDepth = 0;
    this.bottom = 5;
    this.dip = 0;
    this.twitchT = 0;
    this.status = 'quiet';
    this.statusT = 0;
    this.quietT = 0;
    this.hintedQuiet = false;
    this.agent = null;
    this.fight = null;
    this.tip = new THREE.Vector3();
    this.bob = new THREE.Vector3();
    this.hook = new THREE.Vector3();
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

    // The short length of line from the float down to the bait, visible underwater.
    const ldg = new THREE.BufferGeometry();
    this.leaderPos = new Float32Array(6);
    ldg.setAttribute('position', new THREE.BufferAttribute(this.leaderPos, 3));
    this.leader = new THREE.Line(ldg, new THREE.LineBasicMaterial({ color: '#e8f2ee', transparent: true, opacity: 0.5 }));
    this.leader.frustumCulled = false;
    this.leader.visible = false;
    scene.add(this.leader);

    // A little worm on a hook, with a split shot above it.
    this.baitModel = new THREE.Group();
    const worm = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.08, 3, 6), new THREE.MeshLambertMaterial({ color: '#e98a8a', emissive: '#3a1414' }));
    worm.rotation.z = 0.7;
    const hookMesh = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 4, 10, Math.PI * 1.3), new THREE.MeshLambertMaterial({ color: '#9aa3ad' }));
    hookMesh.position.y = 0.02;
    const shot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshLambertMaterial({ color: '#4a4f57' }));
    shot.position.y = 0.26;
    this.baitModel.add(worm, hookMesh, shot);
    this.baitModel.visible = false;
    scene.add(this.baitModel);

    this.aimRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#fff6e0', transparent: true, opacity: 0, depthWrite: false }),
    );
    this.aimRing.renderOrder = 3;
    scene.add(this.aimRing);
    this.arcPos = new Float32Array(ARC_N * 3);
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(this.arcPos, 3));
    this.arc = new THREE.Points(ag, new THREE.PointsMaterial({
      size: 0.42, map: glowTexture(), color: '#fff6e0', transparent: true, opacity: 0, depthWrite: false,
    }));
    this.arc.frustumCulled = false;
    this.arc.renderOrder = 4;
    scene.add(this.arc);

    this.fishMeshes = {};
    for (const f of FISH) {
      const m = buildFishMesh(f);
      scene.add(m);
      this.fishMeshes[f.id] = m;
    }

    eco.listener = {
      onCurious: (a) => this.onCurious(a),
      onNibble: (a) => this.onNibble(a),
      onBite: (a) => this.onBite(a),
      onLeave: (a, reason) => this.onLeave(a, reason),
    };
  }

  get busy() { return this.state !== 'idle'; }
  get aiming() { return this.state === 'aiming'; }
  get lineOut() { return this.state !== 'idle' && this.state !== 'aiming'; }
  get baitInWater() { return this.state === 'drifting' || this.state === 'bite' || this.state === 'reeling'; }
  get pulling() { return !!(this.fight && this.fight.pulling); }
  // What the bait-follow camera watches.
  get watchPoint() {
    if (this.state === 'reeling' && this.fight) return this.fishPos;
    if (this.state === 'drifting' || this.state === 'bite') return this.hook;
    return null;
  }

  /* ---------- input ---------- */

  onDown() {
    switch (this.state) {
      case 'idle':
        if (this.boat.speed > 1.8) {
          this.hooks.flash('Let the boat drift to a stop first');
          return;
        }
        this.state = 'aiming';
        this.t = 0;
        this.power = 0;
        this.aimOffset = 0;
        break;
      case 'drifting':
        this.hold = true;
        this.holdT = 0;
        break;
      case 'bite':
        this.setHook();
        break;
      case 'caught':
        if (this.t > 0.5) this.letGo();
        break;
      default:
    }
  }

  onUp() {
    if (this.state === 'aiming') this.cast();
    else if (this.state === 'drifting' && this.hold && this.holdT < TAP) this.twitch();
    this.hold = false;
  }

  // Esc or right-click: put the cast down, or bring the line home.
  cancel() {
    switch (this.state) {
      case 'aiming':
        this.state = 'idle';
        this.hooks.flash('Cast cancelled', 1.6);
        return true;
      case 'drifting':
      case 'bite':
        this.reelIn();
        return true;
      case 'reeling':
        this.eco.lostHooked(this.fight.agent);
        this.hooks.flash('You let the line go slack, and the fish swims free');
        this.fight = null;
        this.agent = null;
        this.reelIn();
        return true;
      default:
        return false;
    }
  }

  // Left/right while aiming swings the cast around, independent of the boat.
  aimBy(dir, dt) {
    if (this.state === 'aiming') this.aimOffset = clamp(this.aimOffset + dir * 1.3 * dt, -Math.PI, Math.PI);
  }

  // Up/down sets how deep the bait hangs below the float.
  depthBy(dir, dt) {
    if (this.state !== 'aiming' && this.state !== 'drifting') return;
    const max = this.state === 'drifting' ? Math.max(0.4, this.bottom - 0.15) : 14;
    this.depth = clamp(this.depth - dir * 1.4 * dt, 0.4, max);
  }

  get info() {
    return {
      depth: this.baitDepth, target: this.depth, bottom: this.bottom, status: this.status,
      reeling: this.reelSpeed > 0.05, power: this.power, dist: this.castDist, valid: this.aimValid,
    };
  }

  /* ---------- casting ---------- */

  landingPoint(power, out) {
    const dx = Math.sin(this.aimYaw), dz = Math.cos(this.aimYaw);
    const bx = this.boat.pos.x + dx * 0.8, bz = this.boat.pos.z + dz * 0.8;
    for (let d = MIN_CAST + power * (MAX_CAST - MIN_CAST); d > 2.5; d -= 0.4) {
      const x = bx + dx * d, z = bz + dz * d;
      if (solidHeight(x, z) < -0.6) {
        out.set(x, 0, z);
        this.castDist = d;
        return true;
      }
    }
    return false;
  }

  // The same arc is drawn while aiming and flown by the float, so what you see is what you get.
  arcPoint(u, out) {
    out.lerpVectors(this.from, this.to, u);
    out.y += 4 * this.apex * u * (1 - u);
    return out;
  }

  cast() {
    if (!this.aimValid) {
      this.state = 'idle';
      this.hooks.flash('Too close to the shore to cast that way');
      return;
    }
    this.state = 'casting';
    this.t = 0;
    this.from.copy(this.tip);
    this.flight = 0.5 + this.castDist * 0.03;
    this.audio.cast();
    this.hooks.onCast();
  }

  land(t) {
    this.state = 'drifting';
    this.t = 0;
    this.bob.set(this.to.x, waveHeight(this.to.x, this.to.z, t), this.to.z);
    this.hook.copy(this.bob);
    this.baitDepth = 0;
    this.reelSpeed = 0;
    this.bottom = Math.max(0.3, -solidHeight(this.to.x, this.to.z));
    this.depth = Math.min(this.depth, Math.max(0.4, this.bottom - 0.15));
    this.fx.ripple(this.bob.x, this.bob.z, 1.2, 1.4, 0.55);
    this.fx.splash(this.bob.x, 0.05, this.bob.z, 8, 1.4, 0.6);
    this.audio.plop();
    // A splash right on top of fish sends them off; a little further away it draws attention.
    this.eco.startle(this.bob.x, -0.4, this.bob.z, 1.8, 0.8);
    Object.assign(this.eco.bait, { active: true, fresh: 4, owner: null, held: false, twitch: 0, speed: 0 });
    this.syncBait();
    this.agent = null;
    this.setStatus('quiet');
    this.quietT = 0;
    this.hintedQuiet = false;
  }

  twitch() {
    this.twitchT = 0.5;
    this.dip = 0.1;
    this.eco.bait.twitch = 1.4;
    const dx = this.tip.x - this.bob.x, dz = this.tip.z - this.bob.z, l = Math.hypot(dx, dz) || 1;
    this.bob.x += (dx / l) * 0.3;
    this.bob.z += (dz / l) * 0.3;
    this.fx.ripple(this.bob.x, this.bob.z, 0.8, 0.9, 0.4);
    this.audio.nibble(0.6);
  }

  reelIn() {
    this.state = 'retrieving';
    this.t = 0;
    this.from.copy(this.bob);
    this.audio.reelIn();
    this.endBait();
  }

  endBait() {
    const b = this.eco.bait;
    if (b.owner && b.owner.state !== 'hooked' && b.owner.state !== 'caught') this.eco.disengage(b.owner, 'gone', 4);
    b.active = false;
    b.owner = null;
    b.held = false;
    if (!this.fight) this.agent = null;
    this.setStatus('quiet');
  }

  syncBait() {
    const b = this.eco.bait;
    b.x = this.hook.x;
    b.y = this.hook.y;
    b.z = this.hook.z;
    b.speed = this.reelSpeed + (this.twitchT > 0 ? 0.5 : 0);
    b.nearBottom = this.baitDepth >= this.bottom - 0.7;
  }

  setStatus(s) {
    this.status = s;
    this.statusT = 0;
    if (s !== 'quiet') this.quietT = 0;
  }

  /* ---------- what the fish do ---------- */

  onCurious(a) {
    if (this.state !== 'drifting') return;
    this.agent = a;
    this.setStatus('curious');
  }

  onNibble(a) {
    if (this.state !== 'drifting' || a !== this.agent) return;
    this.dip = rand(0.05, 0.09);
    this.fx.ripple(this.bob.x, this.bob.z, 0.6, 0.8, 0.35);
    this.audio.nibble();
    this.setStatus('nibble');
  }

  onBite(a) {
    if (this.state !== 'drifting') return;
    this.state = 'bite';
    this.t = 0;
    this.agent = a;
    this.fx.splash(this.bob.x, 0.05, this.bob.z, 8, 1.4, 0.5);
    this.fx.ripple(this.bob.x, this.bob.z, 1.5, 1.3, 0.55);
    this.audio.bite();
    this.setStatus('bite');
  }

  onLeave(a, reason) {
    if (a !== this.agent) return;
    const wasBite = this.state === 'bite';
    if (wasBite) this.state = 'drifting';
    if (this.state !== 'drifting') return;
    this.agent = null;
    this.setStatus('quiet');
    if (wasBite) this.hooks.flash('It let go of the bait. Another may come.');
    else if (reason === 'startled' || reason === 'spooked') this.hooks.flash('Something darted away.', 2);
  }

  setHook() {
    const a = this.agent;
    if (!a) return;
    this.eco.hook(a);
    const sp = a.sp;
    const sizeK = (a.size - sp.size[0]) / Math.max(1, sp.size[1] - sp.size[0]);
    this.fight = {
      sp, size: a.size, agent: a, strength: sp.strength * (0.85 + sizeK * 0.35),
      progress: 0, tension: 0.2, pulling: false, phaseT: rand(0.9, 1.6), warned: false,
      lat: 0, dir: 1, splashT: 0, tickT: 0, start: this.hook.clone(),
    };
    this.state = 'reeling';
    this.t = 0;
    this.audio.hookSet();
    this.fx.splash(this.bob.x, 0.05, this.bob.z, 14, 2.2, 0.7);
    this.fx.ripple(this.bob.x, this.bob.z, 1.8, 1.2, 0.6);
    this.setStatus('hooked');
    this.hooks.onHook();
  }

  landFish() {
    const F = this.fight;
    const mesh = this.fishMeshes[F.sp.id];
    this.eco.catchAgent(F.agent);
    this.eco.bait.active = false;
    this.state = 'landing';
    this.t = 0;
    this.from.copy(this.fishPos);
    mesh.visible = true;
    mesh.scale.setScalar(F.agent.scale);
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

  holdPoint(out) {
    return this.boat.body.localToWorld(out.set(-0.15, 1.45, 1.05));
  }

  mouthOf(a, out) {
    const cp = Math.cos(a.pitch);
    return out.set(
      a.x + Math.sin(a.yaw) * cp * a.scale * 0.5,
      a.y + Math.sin(a.pitch) * a.scale * 0.5,
      a.z + Math.cos(a.yaw) * cp * a.scale * 0.5,
    );
  }

  /* ---------- per-frame ---------- */

  update(dt, t, camYaw, held) {
    this.t += dt;
    this.statusT += dt;
    this.held = held;
    const boat = this.boat, pose = boat.pose;
    boat.rodTip.getWorldPosition(this.tip);

    let rodPitch = 0.85, bend = 0.05;
    let rodYaw = this.state === 'idle' ? 0 : clamp(wrapAngle(Math.atan2(this.bob.x - boat.pos.x, this.bob.z - boat.pos.z) - boat.heading), -2, 2);
    const fishMesh = this.fight ? this.fishMeshes[this.fight.sp.id] : null;

    switch (this.state) {
      case 'aiming': {
        this.aimYaw = camYaw + this.aimOffset;
        this.power = Math.min(1, this.power + dt / AIM_TIME);
        rodYaw = clamp(wrapAngle(this.aimYaw - boat.heading), -2, 2);
        rodPitch = lerp(0.5, -0.45, smoothstep(0, 1, this.power));
        this.aimValid = this.landingPoint(this.power, this.to);
        if (this.aimValid) {
          this.to.y = waveHeight(this.to.x, this.to.z, t);
          this.from.copy(this.tip);
          this.apex = 0.8 + this.castDist * 0.16;
          for (let i = 0; i < ARC_N; i++) {
            this.arcPoint((i + 1) / ARC_N, _v);
            this.arcPos[i * 3] = _v.x;
            this.arcPos[i * 3 + 1] = _v.y;
            this.arcPos[i * 3 + 2] = _v.z;
          }
          this.arc.geometry.attributes.position.needsUpdate = true;
          this.aimRing.position.set(this.to.x, this.to.y + 0.05, this.to.z);
          const s = 0.7 + this.castDist * 0.03;
          this.aimRing.scale.set(s, 1, s);
        }
        this.bob.copy(this.tip).add(_v.set(0, -0.55, 0));
        break;
      }
      case 'casting': {
        const u = clamp(this.t / this.flight, 0, 1);
        rodPitch = this.t < 0.12 ? lerp(-0.45, 1.25, this.t / 0.12) : lerp(1.25, 0.85, smoothstep(0.12, 0.6, this.t));
        rodYaw = clamp(wrapAngle(this.aimYaw - boat.heading), -2, 2);
        this.arcPoint(u, this.bob);
        if (u >= 1) this.land(t);
        break;
      }
      case 'drifting':
        rodPitch = 0.8;
        bend = 0.08 + this.reelSpeed * 0.1;
        this.updateDrift(dt, t);
        break;
      case 'bite': {
        rodPitch = 0.8;
        bend = 0.35 + Math.sin(t * 30) * 0.05;
        const a = this.agent;
        if (!a || a.state !== 'bite') {
          this.state = 'drifting';
          break;
        }
        this.mouthOf(a, _v);
        this.hook.lerp(_v, 1 - Math.exp(-10 * dt));
        this.bob.x = damp(this.bob.x, _v.x, 3, dt);
        this.bob.z = damp(this.bob.z, _v.z, 3, dt);
        this.bob.y = waveHeight(this.bob.x, this.bob.z, t) - 0.24 + Math.sin(t * 24) * 0.03;
        this.syncBait();
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
        fishMesh.userData.swim.set(t * 18, 1);
        rodPitch = 1.1;
        bend = 0.7;
        rodYaw = 0.2;
        if (u >= 1) {
          this.state = 'caught';
          this.t = 0;
          this.hooks.onCatch(this.fight.sp, this.fight.size, this.fight.agent);
        }
        break;
      }
      case 'caught': {
        const hp = this.holdPoint(_w);
        fishMesh.position.copy(hp);
        fishMesh.position.y += Math.sin(t * 2) * 0.03;
        const wig = Math.sin(t * 9) * Math.max(0, Math.sin(t * 1.3)) * 0.25;
        fishMesh.rotation.set(-1.2 + wig * 0.3, boat.heading + Math.PI / 2 + wig, 0, 'YXZ');
        fishMesh.userData.swim.set(t * 10, 0.4 * Math.max(0.2, Math.sin(t * 1.3)));
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
          this.eco.release(this.fight.agent, this.to.x, this.to.z);
          this.fight = null;
          this.agent = null;
          this.state = 'idle';
        }
        break;
      }
      case 'retrieving': {
        const u = clamp(this.t / 0.45, 0, 1);
        this.bob.lerpVectors(this.from, this.tip, u * u);
        this.bob.y += Math.sin(u * Math.PI) * 0.6;
        if (u >= 1) this.state = 'idle';
        break;
      }
      default:
    }

    pose.fishing = damp(pose.fishing, this.state === 'idle' ? 0 : 1, this.state === 'idle' ? 5 : 9, dt);
    pose.rodYaw = this.state === 'aiming' ? rodYaw : damp(pose.rodYaw, rodYaw, 6, dt);
    pose.rodPitch = damp(pose.rodPitch, rodPitch, 16, dt);
    pose.bend = damp(pose.bend, bend, 10, dt);

    this.updateVisuals(t, dt, fishMesh);
  }

  updateDrift(dt, t) {
    if (this.hold) this.holdT += dt;
    // Holding reels in: gently at first, then steadily.
    const reeling = this.hold && this.holdT > TAP;
    this.reelSpeed = damp(this.reelSpeed, reeling ? lerp(0.45, 1.9, smoothstep(TAP, 1.8, this.holdT)) : 0, 6, dt);
    if (this.reelSpeed > 0.01) {
      const dx = this.tip.x - this.bob.x, dz = this.tip.z - this.bob.z, l = Math.hypot(dx, dz);
      if (l < 2.6) {
        this.reelIn();
        return;
      }
      this.bob.x += (dx / l) * this.reelSpeed * dt;
      this.bob.z += (dz / l) * this.reelSpeed * dt;
      if (Math.random() < dt * 14 * this.reelSpeed) this.audio.tick(0.5);
    } else {
      this.bob.x += 0.03 * dt;
    }
    this.dip = damp(this.dip, 0, 8, dt);
    this.bob.y = waveHeight(this.bob.x, this.bob.z, t) - this.dip;
    this.bottom = Math.max(0.3, -solidHeight(this.hook.x, this.hook.z));

    // The bait hangs below the float at the chosen depth; reeling lifts it a little.
    let want = Math.min(this.depth, Math.max(0.3, this.bottom - 0.15));
    if (this.reelSpeed > 0.1) want = Math.min(want, lerp(want, 0.6, this.reelSpeed / 2.5));
    const rate = want > this.baitDepth ? 0.7 : 1.1;
    this.baitDepth += clamp(want - this.baitDepth, -rate * dt, rate * dt);
    this.hook.x = damp(this.hook.x, this.bob.x, 1.6, dt);
    this.hook.z = damp(this.hook.z, this.bob.z, 1.6, dt);
    this.hook.y = this.bob.y - this.baitDepth;
    if (this.twitchT > 0) {
      this.twitchT -= dt;
      this.hook.y += Math.sin((this.twitchT / 0.5) * Math.PI) * 0.25;
    }
    this.syncBait();

    if (this.status === 'nibble' && this.statusT > 1.5) this.setStatus(this.agent ? 'curious' : 'quiet');
    if (this.status === 'quiet') {
      this.quietT += dt;
      if (this.quietT > 25 && !this.hintedQuiet) {
        this.hintedQuiet = true;
        this.hooks.quiet();
      }
    }
  }

  updateFight(dt, t, held) {
    const F = this.fight;
    F.phaseT -= dt;
    if (F.phaseT <= 0) {
      if (F.pulling) {
        F.pulling = false;
        F.phaseT = rand(1.1, 2.4);
        F.warned = false;
      } else {
        F.pulling = true;
        F.phaseT = rand(0.7, 1.4) + F.strength * 0.5;
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
    const reel = F.sp.reel;
    let dT, dp;
    if (F.pulling) {
      if (held) { dT = 0.8 * F.strength + 0.1; dp = reel * 0.2; } else { dT = -0.7; dp = -0.03 * F.strength; }
    } else if (held) { dT = 0.05; dp = reel; } else { dT = -0.9; dp = 0; }
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

    // The fish swims where the fight takes it, closer to the boat and the surface as you win.
    const b = this.boat.pos;
    let dx = F.start.x - b.x, dz = F.start.z - b.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    const e = 1 - Math.pow(1 - F.progress, 1.5);
    const cx = lerp(F.start.x, b.x + dx * 2.6, e), cz = lerp(F.start.z, b.z + dz * 2.6, e);
    F.lat = damp(F.lat, F.pulling ? F.dir * 2.2 * (1 - F.progress * 0.6) : 0, 1.4, dt);
    const wig = Math.sin(t * 6.5) * 0.15;
    const x = cx - dz * (F.lat + wig), z = cz + dx * (F.lat + wig);
    const floor = solidHeight(x, z) + 0.3;
    const y = Math.min(Math.max(lerp(F.start.y, -0.35, e) - (F.pulling ? 0.45 : 0), floor), -0.25);
    this.fishPos.set(x, y, z);
    const away = Math.atan2(x - b.x, z - b.z);
    this.eco.placeHooked(F.agent, x, y, z, away + (F.pulling ? F.lat * 0.15 : F.dir * 1.6), F.pulling ? 1 : 0.5);
    this.mouthOf(F.agent, this.hook);
    this.bob.set(x, waveHeight(x, z, t) - (F.pulling ? 0.16 : 0.06), z);
    if (F.pulling) {
      F.splashT -= dt;
      if (F.splashT <= 0) {
        F.splashT = rand(0.2, 0.4);
        if (y > -1.2) this.fx.splash(x, 0.05, z, 5, 1.6, 0.6);
        this.fx.ripple(x, z, 1.0, 1.0, 0.4);
        this.audio.splashSmall();
      }
    }
    if (F.progress >= 1) this.landFish();
  }

  updateVisuals(t, dt, fishMesh) {
    const s = this.state;
    const holdingFish = s === 'landing' || s === 'caught';
    const lineVisible = s !== 'idle' && s !== 'releasing';
    this.bobber.visible = lineVisible && !holdingFish;
    this.bobber.position.copy(this.bob);
    this.bobber.rotation.z = Math.sin(t * 1.7) * 0.12;
    this.bobber.rotation.x = Math.sin(t * 1.3 + 1) * 0.1;

    this.line.visible = lineVisible;
    if (lineVisible) {
      let end = this.bob, sag = 0.35;
      if (holdingFish) {
        end = fishMesh.localToWorld(_v.set(0, 0, 0.5));
        sag = 0.02;
      } else if (s === 'aiming') sag = 0;
      else if (s === 'casting' || s === 'retrieving') sag = 0.12;
      else if (s === 'reeling') sag = (1 - this.fight.tension) * 0.3;
      else sag = 0.35 + this.tip.distanceTo(this.bob) * 0.015;
      this.setLine(this.tip, end, sag);
    }

    const underwater = this.baitInWater;
    this.leader.visible = underwater;
    if (underwater) {
      this.leaderPos.set([this.bob.x, this.bob.y, this.bob.z, this.hook.x, this.hook.y + 0.26, this.hook.z]);
      this.leader.geometry.attributes.position.needsUpdate = true;
    }
    this.baitModel.visible = (lineVisible && !holdingFish && s !== 'reeling') || false;
    if (underwater) this.baitModel.position.copy(this.hook);
    else this.baitModel.position.copy(this.bob).add(_w.set(0, -0.3, 0));
    this.baitModel.rotation.y = t * 0.6;

    const aimOn = s === 'aiming' && this.aimValid;
    const k = 1 - Math.exp(-10 * dt);
    this.aimRing.material.opacity += ((aimOn ? 0.65 : 0) - this.aimRing.material.opacity) * k;
    this.arc.material.opacity += ((aimOn ? 0.75 : 0) - this.arc.material.opacity) * k;
    this.aimRing.visible = this.aimRing.material.opacity > 0.01;
    this.arc.visible = this.arc.material.opacity > 0.01;
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
