import * as THREE from 'three';
import { walkHeight, waterLevel } from './world/terrain.js';
import { waveHeight } from './world/water.js';
import { buildRod, bendRod } from './props.js';
import { RODS } from './tackle.js';
import { lerp, damp, dampAngle, smoothstep, clamp } from './util.js';
import { Dress } from './dress.js';

const WALK = 3.0;      // metres per second
const JOG = 5.4;
const RADIUS = 0.3;
const DEEP = -0.6;     // can wade up to about knee deep, no further
const STEEP = 1.15;    // rise per metre that is too steep to climb
const UP = new THREE.Vector3(0, 1, 0);
const HOLD = new THREE.Vector3(0.08, 1.02, 0.28); // where the figure holds the rod
const EYE = 1.6;      // eye height in first person
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _pl = new THREE.Vector3();
const _p = { x: 0, z: 0 };

function setLimb(mesh, a, b, r) {
  _d.subVectors(b, a);
  const len = _d.length() || 0.001;
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, _d.divideScalar(len));
  mesh.scale.set(r, len, r);
}

// The elbow for a hand at T from a shoulder at S (an upper arm UPPER long, a forearm FORE): where the
// two bones meet, bent towards pole (out and down and back, for an arm), the hand held to the arm's
// reach. Writes the elbow into out, and the hand (if it had to be pulled in) into T.
export const UPPER = 0.3, FORE = 0.29;
const _ik = new THREE.Vector3(), _pole = new THREE.Vector3();
export function reach(S, T, pole, out) {
  _ik.subVectors(T, S);
  let d = _ik.length();
  const max = UPPER + FORE - 0.005, min = Math.abs(UPPER - FORE) + 0.02;
  if (d < 1e-5) {
    _ik.set(0, -1, 0);
    d = min;
  } else _ik.divideScalar(d);
  if (d > max) {
    T.copy(S).addScaledVector(_ik, max);
    d = max;
  } else if (d < min) d = min;
  const along = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d), h = Math.sqrt(Math.max(0, UPPER * UPPER - along * along));
  // (The pole, made square to the arm's line.)
  _pole.copy(pole).addScaledVector(_ik, -pole.dot(_ik));
  if (_pole.lengthSq() < 1e-8) _pole.set(0, -1, 0).addScaledVector(_ik, _ik.y);
  _pole.normalize();
  return out.copy(S).addScaledVector(_ik, along).addScaledVector(_pole, h);
}

// You, on foot: the same yellow coat and teal hat as in the boat (or whatever you've put on: see
// dress.js), with a backpack.
// Implements the same "angler" shape as the Boat (pos, heading, rodTip, pose, holdPoint),
// so the fishing system doesn't mind where you're standing.
export class Walker {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.right = new THREE.Vector3(-1, 0, 0);
    this.phase = 0;
    this.stride = 0;
    this.wading = 0;
    this.ground = 0;
    this.onBoat = false;
    this.moving = false;
    this.jogging = false;
    this.speedMul = 1;
    // How you feel, for the figure (set by the game from comfort.js): shiver (0 … 1) when you're
    // cold, sweat (0 … 1) when you're hot, drink (seconds left of a drink from the bottle).
    this.cue = { shiver: 0, sweat: 0, drink: 0 };
    this.wipeT = 0;
    this.onStep = null;
    this.onSplash = null;
    // (bendTo: where the line pulls the rod tip, set by the fishing: see bendRod.)
    this.pose = { fishing: 0, rodYaw: 0, rodPitch: 0.85, bend: 0.05, bendVel: 0, bendTo: null };
    // Sitting (0 standing … 1 sat down), on a seat this high; warming your hands at a fire.
    this.seat = 0;
    this.seatH = 0.42;
    this.warmHands = false;
    // In first person (set by the game): where a landed fish is held up in view, and which way
    // you face for it.
    this.viewHold = null;
    this.faceYaw = null;
    this.selfHidden = false;
    this.build();
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }

  build() {
    const coat = new THREE.MeshLambertMaterial({ color: '#e8b440' });
    const skin = new THREE.MeshLambertMaterial({ color: '#f1c7a1' });
    const hat = new THREE.MeshLambertMaterial({ color: '#35676b' });
    const pants = new THREE.MeshLambertMaterial({ color: '#3b4a68' });
    const boot = new THREE.MeshLambertMaterial({ color: '#5a3d2b' });
    const dark = new THREE.MeshLambertMaterial({ color: '#2b2522' });
    const pack = new THREE.MeshLambertMaterial({ color: '#6b5034' });
    const flapMat = new THREE.MeshLambertMaterial({ color: '#5a4029' });
    const matMat = new THREE.MeshLambertMaterial({ color: '#4f7a6a' });
    const tubeMat = new THREE.MeshLambertMaterial({ color: '#3d4a3a' });
    this.selfMats = [coat, skin, hat, pants, boot, dark, pack, flapMat, matMat, tubeMat];
    const cast = (m) => { m.castShadow = true; return m; };

    this.body = new THREE.Group();
    this.group.add(this.body);

    this.torso = new THREE.Group();
    this.torso.position.y = 0.92;
    this.body.add(this.torso);
    const chest = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.26, 4, 10), coat));
    chest.position.y = 0.27;
    chest.scale.set(1, 1, 0.85);
    this.torso.add(chest);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12), coat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.52;
    this.torso.add(collar);
    // The backpack with a rolled mat on top
    const bag = cast(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.18), pack));
    bag.position.set(0, 0.3, -0.22);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.12, 0.19), flapMat);
    flap.position.set(0, 0.44, -0.22);
    const mat = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 8), matMat));
    mat.rotation.z = Math.PI / 2;
    mat.position.set(0, 0.55, -0.24);
    this.torso.add(bag, flap, mat);
    // A spare rod tube slung on the pack
    this.tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6), tubeMat);
    this.tube.position.set(0.13, 0.42, -0.3);
    this.tube.rotation.z = -0.35;
    this.torso.add(this.tube);

    this.head = new THREE.Group();
    this.head.position.y = 0.66;
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
    this.dress = new Dress({ coat, pants, head: this.head, sunHat: hatGroup, mats: this.selfMats });

    // Legs: hip → knee → foot, each a pivot so they swing naturally.
    const limbGeo = new THREE.CylinderGeometry(1, 1, 1, 7).translate(0, -0.5, 0);
    this.legs = [1, -1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(s * 0.1, 0.9, 0);
      this.body.add(hip);
      const thigh = cast(new THREE.Mesh(limbGeo, pants));
      thigh.scale.set(0.075, 0.44, 0.075);
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      const shin = cast(new THREE.Mesh(limbGeo, pants));
      shin.scale.set(0.065, 0.4, 0.065);
      knee.add(shin);
      const foot = cast(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.24), boot));
      foot.position.set(0, -0.43, 0.05);
      knee.add(foot);
      return { s, hip, knee };
    });

    // Arms: an upper arm and a forearm, the elbow worked out from where the hand has to be (see
    // reach), bending out and down the way an elbow does.
    this.arms = [1, -1].map((s) => {
      const arm = cast(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 7), coat));
      const fore = cast(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 7), coat));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin);
      this.body.add(arm, fore, hand);
      return { s, arm, fore, hand, shoulder: new THREE.Vector3(s * 0.22, 0.44, 0), target: new THREE.Vector3(), elbow: new THREE.Vector3() };
    });
    // The water bottle, in your hand while you drink.
    const bottleMat = new THREE.MeshLambertMaterial({ color: '#4f7c95' });
    this.selfMats.push(bottleMat);
    this.bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.034, 0.17, 8), bottleMat);
    this.bottle.visible = false;
    this.body.add(this.bottle);

    // One of each rod, held in front of you while fishing.
    this.rods = {};
    for (const [id, def] of Object.entries(RODS)) {
      const rod = buildRod(def.look);
      rod.group.position.copy(HOLD);
      rod.group.visible = false;
      this.body.add(rod.group);
      this.rods[id] = rod;
    }
    this.setRod('float');
  }

  setRod(id) {
    const next = this.rods[id] || this.rods.float;
    if (this.active === next) return;
    if (this.active) this.active.group.visible = false;
    this.active = next;
    this.rod = next.group;
    this.rodTip = next.tip;
  }

  setVisible(v) {
    this.group.visible = v;
  }

  // Carried (crewing in a friend's boat, see crew.js): stood at (pos) on her floor, facing heading,
  // going with her at vel; moving: walking about her.
  ride(dt, t, pos, heading, vel, moving = false) {
    this.pos.copy(pos);
    this.ground = pos.y;
    this.vel.set(vel.x, 0, vel.z);
    this.heading = dampAngle(this.heading, heading, 6, dt);
    this.fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.right.set(-Math.cos(this.heading), 0, Math.sin(this.heading));
    this.wading = 0;
    this.jogging = false;
    this.moving = moving;
    this.animate(dt, t);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    this.group.updateMatrixWorld(true);
  }

  place(x, z, heading) {
    this.pos.set(x, walkHeight(x, z), z);
    this.ground = this.pos.y;
    this.vel.set(0, 0, 0);
    this.heading = heading;
    this.group.position.copy(this.pos);
    this.group.rotation.y = heading;
    this.group.updateMatrixWorld(true);
  }

  holdPoint(out) {
    if (this.viewHold) return out.copy(this.viewHold);
    return this.body.localToWorld(out.set(0.0, 1.25, 0.55));
  }

  // Your eyes, for the first-person view: steady, with just a hint of your step.
  eyePoint(out) {
    return this.group.localToWorld(out.set(0, EYE + this.body.position.y * 0.6, 0.1));
  }

  // In first person you don't see yourself, but you still cast a shadow on the bank: the
  // figure draws nothing on screen while its shadow is still made.
  setSelfHidden(on) {
    if (on === this.selfHidden) return;
    this.selfHidden = on;
    for (const m of this.selfMats) {
      m.colorWrite = !on;
      m.depthWrite = !on;
    }
  }

  // Can you stand at (x, z)? Not in deep water, and not up (or down) a bank too steep to
  // climb: you never step down anything you couldn't climb back up. Wading out of water
  // you get a little extra help up the bank.
  canStand(x, z, fromH) {
    const h = walkHeight(x, z);
    // (Deep is below the water here: the sea, or the Coldwater and Hoar Tarn up on the fell.)
    if (h < waterLevel(x, z) + DEEP) return false;
    const step = Math.abs(h - fromH);
    const run = Math.hypot(x - this.pos.x, z - this.pos.z) || 0.01;
    return step / run < STEEP || step < (this.wading > 0.2 ? 0.45 : 0.3);
  }

  // A step aboard a boat, or off one onto the bank: from (a world point; where you are, if not
  // given) to target() (asked each frame, so a boat that moves on the swell is followed), over
  // dur seconds, up and over her side (lift: how high above the higher end), facing the way you
  // go; done() when you're there. Until then the keys do nothing.
  stepTo(target, { from = null, dur = 0.8, lift = 0.3 } = {}, done = null) {
    const f = from ? from.clone() : this.pos.clone();
    this.stepping = { from: f, target, t: 0, dur, lift, done, last: f.clone() };
    this.pos.copy(f);
  }

  stepUpdate(dt, t) {
    const S = this.stepping;
    S.t = Math.min(S.dur, S.t + dt);
    const k = S.t / S.dur, e = smoothstep(0, 1, k), to = S.target();
    const nx = lerp(S.from.x, to.x, e), nz = lerp(S.from.z, to.z, e);
    const ny = lerp(S.from.y, to.y, e) + Math.sin(Math.PI * k) * S.lift;
    if (Math.hypot(to.x - S.from.x, to.z - S.from.z) > 0.2) this.heading = dampAngle(this.heading, Math.atan2(to.x - S.from.x, to.z - S.from.z), 10, dt);
    this.vel.set((nx - S.last.x) / Math.max(dt, 1e-3), 0, (nz - S.last.z) / Math.max(dt, 1e-3));
    this.pos.set(nx, ny, nz);
    S.last.copy(this.pos);
    this.ground = ny;
    this.wading = 0;
    this.moving = true;
    this.animate(dt, t);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    this.group.updateMatrixWorld(true);
    if (k >= 1) {
      this.stepping = null;
      this.vel.set(0, 0, 0);
      S.done?.();
    }
  }

  // move: a world-space direction (length 0..1) from the camera-relative keys or stick.
  update(dt, t, move, { jog = false, locked = false, obstacles = null } = {}) {
    if (this.stepping) return this.stepUpdate(dt, t);
    this.fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.right.set(-Math.cos(this.heading), 0, Math.sin(this.heading));
    const mag = locked ? 0 : Math.min(1, Math.hypot(move.x, move.z));
    this.jogging = jog && mag > 0.5 && this.wading < 0.2;
    const top = (this.jogging ? JOG : WALK) * this.speedMul * lerp(1, 0.55, this.wading);
    const want = mag * top;
    if (mag > 0.05) this.heading = dampAngle(this.heading, Math.atan2(move.x, move.z), 9, dt);
    const dirx = mag > 0.05 ? move.x / mag : 0, dirz = mag > 0.05 ? move.z / mag : 0;
    this.vel.x = damp(this.vel.x, dirx * want, 8, dt);
    this.vel.z = damp(this.vel.z, dirz * want, 8, dt);

    const from = this.ground;
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    // Slide along water's edges and steep banks rather than stopping dead.
    if (this.canStand(nx, nz, from)) { this.pos.x = nx; this.pos.z = nz; } else if (this.canStand(nx, this.pos.z, from)) { this.pos.x = nx; this.vel.z *= 0.5; } else if (this.canStand(this.pos.x, nz, from)) { this.pos.z = nz; this.vel.x *= 0.5; } else { this.vel.x *= 0.2; this.vel.z *= 0.2; }
    if (obstacles) {
      _p.x = this.pos.x;
      _p.z = this.pos.z;
      if (obstacles.resolve(_p, RADIUS, from - 0.1) && this.canStand(_p.x, _p.z, from)) {
        this.pos.x = _p.x;
        this.pos.z = _p.z;
      }
    }
    this.ground = walkHeight(this.pos.x, this.pos.z);
    const water = waveHeight(this.pos.x, this.pos.z, t);
    this.wading = smoothstep(0.0, 0.45, water - this.ground);
    this.pos.y = damp(this.pos.y, this.ground, 18, dt);
    this.moving = this.speed > 0.25;

    this.animate(dt, t);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    this.group.updateMatrixWorld(true);
  }

  animate(dt, t) {
    const sp = this.speed;
    const amt = smoothstep(0.1, 1.2, sp);
    const fishing = this.pose.fishing;
    // About one full stride (two steps) every 1.5 m walking, longer when jogging.
    const prev = this.phase;
    this.phase += dt * sp * (Math.PI * 2) / (this.jogging ? 2.0 : 1.45);
    // A footstep each time a foot comes down.
    if (Math.floor(prev / Math.PI) !== Math.floor(this.phase / Math.PI) && amt > 0.3) {
      if (this.wading > 0.2) this.onSplash?.(this.pos, this.wading);
      else this.onStep?.(this.pos, this.jogging);
    }
    const swing = (this.jogging ? 0.75 : 0.5) * amt;
    for (const L of this.legs) {
      const ph = this.phase + (L.s > 0 ? 0 : Math.PI);
      L.hip.rotation.x = -Math.sin(ph) * swing;
      L.knee.rotation.x = Math.max(0, Math.cos(ph)) * swing * 1.3 + (1 - amt) * 0.02;
    }
    // (Stepping up over a boat's side: the leading knee comes up high, then the other follows.)
    if (this.stepping) {
      const k = this.stepping.t / this.stepping.dur, up = Math.sin(Math.PI * clamp(k * 1.6, 0, 1)), up2 = Math.sin(Math.PI * clamp(k * 1.6 - 0.6, 0, 1));
      const [L0, L1] = this.legs;
      L0.hip.rotation.x -= up * 0.9;
      L0.knee.rotation.x += up * 1.2;
      L1.hip.rotation.x -= up2 * 0.7;
      L1.knee.rotation.x += up2 * 1.0;
    }
    const bob = Math.abs(Math.sin(this.phase)) * 0.045 * amt * (this.jogging ? 1.6 : 1);
    this.body.position.y = bob - (1 - amt) * Math.sin(t * 1.6) * 0.004;
    // Sat down: thighs forward, shins down, the hips on the seat.
    const st = this.seat;
    for (const L of this.legs) {
      L.hip.rotation.z = st * L.s * 0.1;
      if (!st) continue;
      L.hip.rotation.x = lerp(L.hip.rotation.x, -1.5, st);
      L.knee.rotation.x = lerp(L.knee.rotation.x, 1.45, st);
    }
    if (st) this.body.position.y = lerp(this.body.position.y, this.seatH - 0.9 + Math.sin(t * 0.9) * 0.004, st);
    // How you feel: cold, a tremble and your arms hugged in while you stand about; hot, a hand
    // across your brow now and then; and the bottle tipped up when you drink (head back).
    const C = this.cue, idle = (1 - fishing) * (1 - amt);
    C.drink = Math.max(0, C.drink - dt);
    const sip = C.drink > 0 ? smoothstep(2, 1.6, C.drink) * smoothstep(0, 0.4, C.drink) : 0;
    const hug = smoothstep(0.3, 0.8, C.shiver) * idle * (1 - sip);
    this.wipeT = C.sweat > 0.5 && idle > 0.8 && !sip ? this.wipeT + dt : 0;
    const wipe = smoothstep(0, 0.3, this.wipeT % 9) * smoothstep(1.4, 1.0, this.wipeT % 9) * (this.wipeT > 2 ? 1 : 0);
    // Leaning into a cast: back as the rod goes back over your shoulder, forward as it comes
    // through (from where the rod is: rodPitch 0.85 is fishing, below that it's going back).
    const cast = fishing * clamp(0.85 - this.pose.rodPitch, -0.5, 1.4);
    this.torso.rotation.x = lerp(amt * (this.jogging ? 0.18 : 0.06) + fishing * 0.05 - cast * 0.12, this.warmHands ? 0.22 : 0.1, st);
    // Walking, the hips sway to the foot that's down and the shoulders turn against them.
    this.body.rotation.z = Math.cos(this.phase) * 0.03 * amt * (1 - st);
    this.body.rotation.y = -Math.sin(this.phase) * 0.07 * amt * (1 - st) * (1 - fishing);
    this.torso.rotation.z = Math.sin(t * 38) * 0.018 * C.shiver * (1 - amt) - Math.cos(this.phase) * 0.02 * amt;
    this.torso.rotation.y = damp(this.torso.rotation.y, this.pose.rodYaw * 0.35 * fishing + cast * 0.22 + Math.sin(this.phase) * 0.15 * amt * (1 - fishing), 6, dt);
    this.head.rotation.y = damp(this.head.rotation.y, fishing ? this.pose.rodYaw * 0.45 : Math.sin(t * 0.17) * 0.3 * (1 - amt) * (1 - sip), 2, dt);
    this.head.rotation.x = fishing ? 0.12 : -0.35 * sip + 0.1 * hug;

    // Rod
    this.rod.visible = fishing > 0.02;
    this.tube.visible = !this.rod.visible;
    this.rod.position.copy(HOLD);
    this.rod.rotation.y = this.pose.rodYaw;
    this.rod.rotation.x = this.pose.rodPitch;
    bendRod(this.active, this.pose.bend, this.pose.bendTo);

    // Arms swing while walking, or reach for the rod.
    this.torso.updateMatrix();
    this.rod.updateMatrix();
    for (const a of this.arms) {
      const shoulder = _a.copy(a.shoulder).applyMatrix4(this.torso.matrix);
      const ph = this.phase + (a.s > 0 ? Math.PI : 0);
      const sw = Math.sin(ph) * swing * 0.8;
      const free = _b.set(a.s * 0.27, shoulder.y - 0.55 * Math.cos(sw), 0.55 * Math.sin(sw) + 0.04);
      // (Hugged across your chest; at your lips with the bottle, the right hand; across your brow,
      // the left.)
      if (hug) free.lerp(_d.set(-a.s * 0.06, 0.32, 0.19).applyMatrix4(this.torso.matrix), hug);
      if (a.s > 0 && sip) free.lerp(_d.set(0.02, 0.6, 0.2).applyMatrix4(this.torso.matrix), sip);
      if (a.s < 0 && wipe) free.lerp(_d.set(0.03, 0.74, 0.15).applyMatrix4(this.torso.matrix), wipe);
      // Sitting: hands resting on your knees, or held out to the fire.
      if (st) free.lerp(this.warmHands ? _d.set(a.s * 0.12, 0.2, 0.46).applyMatrix4(this.torso.matrix) : _d.set(a.s * 0.15, -0.3, 0.34).applyMatrix4(this.torso.matrix), st);
      const onRod = _d.set(0, a.s > 0 ? 0.06 : 0.32, 0).applyMatrix4(this.rod.matrix);
      a.target.lerpVectors(free, onRod, smoothstep(0, 1, fishing));
      // (The elbow out to the side and down, a little back: further out holding the rod.)
      reach(shoulder, a.target, _pl.set(a.s * (0.55 + 0.35 * fishing), -0.75, -0.35), a.elbow);
      setLimb(a.arm, shoulder, a.elbow, 0.056);
      setLimb(a.fore, a.elbow, a.target, 0.049);
      a.hand.position.copy(a.target);
      if (a.s > 0) {
        this.bottle.visible = sip > 0.05;
        this.bottle.position.copy(a.target);
        this.bottle.rotation.set(-1.9 * sip, 0, 0);
      }
    }
  }
}
