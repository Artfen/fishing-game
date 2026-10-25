import * as THREE from 'three';
import { heightAt, waterLevel, inWorld } from './world/terrain.js';
import { waveHeight } from './world/water.js';
import { currentAt, currentScale } from './world/conditions.js';
import { SPEAR } from './dive.js';
import { clamp, damp, dampAngle, lerp } from './util.js';

// You, in the water: swimming where you look, with fins. The rules of breath and air are in
// dive.js; this is the body. Water is thick: you glide up to speed and coast to a stop, the
// current carries you, and near the surface a freediver floats up a little (deeper than about
// twelve metres the water's weight wins and you sink: the "freefall" freedivers wait for).
// You can't swim through the seabed, the rocks, a boat's hull or up the beach.

// (On scuba, rising on the up key is a gentle, safe ascent: the jacket's air let in slowly.)
const SWIM = 0.95, KICK = 1.65, RISE = 0.75, RISE_SCUBA = 0.45;
const FLOAT = 0.28;   // how far under the surface your back lies, floating
const CLEAR = 0.32;   // the closest your middle comes to the seabed
const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3(), _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

function setLimb(mesh, a, b, r) {
  _d.subVectors(b, a);
  const len = _d.length() || 0.001;
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, _d.divideScalar(len));
  mesh.scale.set(r, len, r);
}

// A band-powered speargun: a dark barrel, a handle and trigger, two rubber bands, and the steel
// shaft along the top. Points along +z; the muzzle at z = 0.95.
export function buildGun() {
  const g = new THREE.Group();
  const barrel = new THREE.MeshLambertMaterial({ color: '#2b2f33' });
  const rubber = new THREE.MeshLambertMaterial({ color: '#2f2422' });
  const grip = new THREE.MeshLambertMaterial({ color: '#3a3f44' });
  const steel = new THREE.MeshLambertMaterial({ color: '#b9c0c4' });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.95), barrel);
  b.position.z = 0.42;
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.05), grip);
  h.position.set(0, -0.07, 0.06);
  h.rotation.x = 0.35;
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.05), barrel);
  muzzle.position.z = 0.9;
  g.add(b, h, muzzle);
  // The bands, stretched back to the shaft's notch when loaded.
  g.bands = [];
  for (const s of [1, -1]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 5), rubber);
    g.add(band);
    g.bands.push({ mesh: band, s });
  }
  g.shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1.15, 5).rotateX(Math.PI / 2), steel);
  g.shaft.position.set(0, 0.03, 0.5);
  g.add(g.shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.05, 6).rotateX(Math.PI / 2), steel);
  tip.position.z = 0.6;
  g.shaft.add(tip);
  g.setLoaded = (k) => {
    g.shaft.visible = k > 0;
    for (const { mesh, s } of g.bands) {
      // Loaded, the bands run from the muzzle back to the shaft; slack, they hang at the muzzle.
      const a = _v.set(s * 0.03, 0.02, 0.9), z = lerp(0.88, 0.45, k);
      setLimb(mesh, a, _d.set(s * 0.008 * k, 0.03 - 0.06 * (1 - k), z), 1);
      mesh.scale.x = mesh.scale.z = 1;
    }
  };
  g.setLoaded(1);
  return g;
}

export class Diver {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;     // which way the body faces
    this.bodyPitch = 0;   // head down (negative) or up
    this.kit = 'free';    // 'free' (breath-hold, speargun) or 'scuba'
    this.phase = 0;
    this.kicking = false;
    this.still = 0;       // seconds without moving
    this.aground = false; // pushing up against the beach
    this.speed = 0;
    this.build();
  }

  // (Below the surface here: up the Coldwater or in Hoar Tarn the water sits above the sea.)
  get depth() { return Math.max(0, waterLevel(this.pos.x, this.pos.z) - this.pos.y); }
  // Floating at the surface (or near enough to breathe through a snorkel).
  surfaceAt(t) { return waveHeight(this.pos.x, this.pos.z, t) - FLOAT; }
  atSurface(t) { return this.pos.y > this.surfaceAt(t) - 0.12; }

  build() {
    const suit = (this.suitMat = new THREE.MeshLambertMaterial({ color: '#34413a' }));
    const panel = (this.panelMat = new THREE.MeshLambertMaterial({ color: '#2c5a5c' }));
    const skin = new THREE.MeshLambertMaterial({ color: '#f1c7a1' });
    const glass = new THREE.MeshLambertMaterial({ color: '#9fd4e0', transparent: true, opacity: 0.55 });
    const frame = new THREE.MeshLambertMaterial({ color: '#202326' });
    const fin = (this.finMat = new THREE.MeshLambertMaterial({ color: '#3d5a4c', side: THREE.DoubleSide }));
    const yellow = new THREE.MeshLambertMaterial({ color: '#e8b440' });
    const cast = (m) => { m.castShadow = true; return m; };
    // The body lies along +z (head forward), so swimming it simply points the way you go.
    this.body = new THREE.Group();
    this.group.add(this.body);
    const torso = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 4, 10).rotateX(Math.PI / 2), suit));
    torso.scale.set(1, 0.82, 1);
    const stripe = new THREE.Mesh(new THREE.CapsuleGeometry(0.162, 0.2, 4, 10).rotateX(Math.PI / 2), panel);
    stripe.scale.set(1.01, 0.84, 1);
    stripe.position.z = 0.12;
    this.body.add(torso, stripe);
    // Head in a hood, the mask, and the snorkel (freediving) or the regulator (scuba).
    this.head = new THREE.Group();
    this.head.position.set(0, 0.04, 0.42);
    this.body.add(this.head);
    this.head.add(cast(new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), suit)));
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.04), frame);
    mask.position.set(0, -0.005, 0.1);
    mask.rotation.x = 0.55;
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.055, 0.02), glass);
    lens.position.set(0, -0.012, 0.117);
    lens.rotation.x = 0.55;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin);
    face.position.set(0, -0.06, 0.085);
    face.scale.set(1, 0.6, 0.6);
    this.head.add(mask, lens, face);
    this.snorkel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 6), yellow);
    this.snorkel.position.set(0.11, 0.12, 0.02);
    this.snorkel.rotation.x = -0.5;
    this.head.add(this.snorkel);
    // The scuba kit: a yellow tank on the back, a black jacket, the regulator.
    this.tank = new THREE.Group();
    const cyl = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.6, 12).rotateX(Math.PI / 2), yellow));
    cyl.position.set(0, 0.2, 0.02);
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8).rotateX(Math.PI / 2), frame);
    valve.position.set(0, 0.2, 0.35);
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 5, 10, Math.PI), frame);
    hose.position.set(0.05, 0.12, 0.4);
    hose.rotation.set(0, Math.PI / 2, 0);
    this.tank.add(cyl, valve, hose);
    this.body.add(this.tank);
    // Arms: reaching forward to the gun (freediving), or tucked in (scuba).
    this.arms = [0, 1].map(() => {
      const upper = cast(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 7), suit));
      const lower = cast(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 7), suit));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), frame);
      this.body.add(upper, lower, hand);
      return { upper, lower, hand };
    });
    // Legs and fins: each blade narrow at the foot pocket and widening to its tip (one unit long,
    // scaled to the kit's fin length).
    const finGeo = new THREE.BufferGeometry();
    finGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, 0.1, 0.92, 0, 0.06, 1, 0, -0.06, 1, 0, -0.1, 0.92, 0], 3));
    finGeo.setIndex([0, 1, 2, 0, 2, 5, 5, 2, 3, 5, 3, 4]);
    finGeo.computeVertexNormals();
    this.legs = [0, 1].map(() => {
      const thigh = cast(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 7), suit));
      const shin = cast(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 7), suit));
      const blade = cast(new THREE.Mesh(finGeo, fin));
      this.body.add(thigh, shin, blade);
      return { thigh, shin, blade };
    });
    this.gun = buildGun();
    this.gun.scale.setScalar(0.95);
    this.body.add(this.gun);
  }

  // Into the water with this kit, here, facing this way.
  enter(kit, x, y, z, heading) {
    this.kit = kit;
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.heading = heading;
    this.bodyPitch = 0;
    this.still = 0;
    this.aground = false;
    const scuba = kit === 'scuba';
    this.tank.visible = scuba;
    this.snorkel.visible = !scuba;
    this.gun.visible = !scuba;
    this.suitMat.color.set(scuba ? '#24282d' : '#34413a');
    this.panelMat.color.set(scuba ? '#2f6f73' : '#3e5544');
    this.finLen = scuba ? 0.45 : 0.75;
    this.finMat.color.set(scuba ? '#2f8a8c' : '#3d5a4c');
    this.group.visible = true;
  }

  leave() {
    this.group.visible = false;
    this.vel.set(0, 0, 0);
  }

  // One step. input: { fwd (-1…1), up (-1…1), kick, dir (a unit vector: where you look),
  // turn (-1…1, only for the body when you're not moving) }. boats: hulls to keep out of.
  update(dt, t, input, boats = []) {
    const P = this.pos, V = this.vel;
    const surface = this.surfaceAt(t);
    const near = P.y > surface - 0.5;
    const speed = (input.kick ? KICK : SWIM) * clamp(input.fwd, -0.5, 1);
    _v.copy(input.dir).multiplyScalar(speed);
    // Along the surface you stay at the surface, unless you look well down (a duck dive) or
    // swim down on purpose.
    if (near && input.dir.y > -0.35 && input.up <= 0) _v.y = Math.max(_v.y, 0);
    _v.y += input.up * (this.kit === 'scuba' && input.up > 0 ? RISE_SCUBA : RISE);
    // Floating up near the surface (a freediver's wetsuit floats), sinking deeper down; a
    // scuba diver's jacket keeps them neutral.
    if (this.kit === 'free' && !input.up && Math.abs(input.fwd) < 0.1) {
      const d = this.depth;
      _v.y += d < 4 ? 0.12 * (1 - d / 4) : d > 12 ? -Math.min(0.12, (d - 12) * 0.02) : 0;
    }
    const k = 1 - Math.exp(-(input.kick ? 2.6 : 2.0) * dt);
    V.x += (_v.x - V.x) * k;
    V.y += (_v.y - V.y) * k;
    V.z += (_v.z - V.z) * k;
    // The current carries you (less near the bottom).
    const cs = currentScale(), cur = currentAt(P.x, P.z, this.depth);
    const nx = P.x + (V.x + cur.x * cs) * dt, nz = P.z + (V.z + cur.z * cs) * dt;
    let ny = P.y + V.y * dt;
    // Not up the beach: where the water's too shallow to swim, you stop (and can stand up).
    const g1 = heightAt(nx, nz), s1 = waveHeight(nx, nz, t);
    this.aground = g1 > s1 - 0.65;
    if (!this.aground && inWorld(nx, nz, 5)) {
      P.x = nx;
      P.z = nz;
    } else {
      V.x *= 0.3;
      V.z *= 0.3;
    }
    const ground = heightAt(P.x, P.z);
    const top = this.surfaceAt(t);
    if (ny > top) {
      ny = top;
      V.y = Math.min(V.y, 0);
    }
    if (ny < ground + CLEAR) {
      ny = ground + CLEAR;
      V.y = Math.max(V.y, 0);
    }
    P.y = ny;
    // Keep out of the boats' hulls.
    for (const b of boats) {
      if (!b?.hull || P.y < -(b.hull.draft + 0.5)) continue;
      const dx = P.x - b.pos.x, dz = P.z - b.pos.z;
      const along = dx * b.fwd.x + dz * b.fwd.z, across = dx * b.right.x + dz * b.right.z;
      const ex = b.hull.L * 0.55, ez = b.hull.B * 0.62;
      const e = (along / ex) ** 2 + (across / ez) ** 2;
      if (e >= 1) continue;
      const push = (1 - Math.sqrt(e)) * Math.min(ex, ez);
      const l = Math.hypot(dx, dz) || 1;
      P.x += (dx / l) * push;
      P.z += (dz / l) * push;
    }
    this.speed = V.length();
    this.kicking = !!input.kick && Math.abs(input.fwd) > 0.1;
    this.still = this.speed < 0.18 ? this.still + dt : 0;

    // The body: facing the way you swim (or look, holding still), tilted head down diving,
    // head up coming up, flat on the surface.
    const hs = Math.hypot(V.x, V.z);
    const want = hs > 0.15 ? Math.atan2(V.x, V.z) : Math.atan2(input.dir.x, input.dir.z);
    this.heading = dampAngle(this.heading, want, 4, dt);
    const pitch = this.atSurface(t) && V.y > -0.2 ? 0 : clamp(Math.atan2(V.y, Math.max(0.25, hs)), -1.2, 1.1);
    this.bodyPitch = damp(this.bodyPitch, this.speed > 0.15 ? pitch : this.bodyPitch * 0.5, 3, dt);
    this.phase += dt * (1.5 + this.speed * 4.5) * (this.kicking ? 1.3 : 1);
    this.pose(t);
  }

  pose(t) {
    this.group.position.copy(this.pos);
    _e.set(-this.bodyPitch, this.heading, Math.sin(this.phase * 0.5) * 0.04, 'YXZ');
    this.body.quaternion.setFromEuler(_e);
    const swing = Math.min(1, 0.25 + this.speed * 0.6) * (this.kicking ? 1.35 : 1);
    const L = this.finLen ?? 0.72;
    // Legs: a flutter kick from the hips, the fins whipping through.
    this.legs.forEach((leg, i) => {
      const s = i ? 1 : -1, ph = this.phase + i * Math.PI;
      const hip = _v.set(s * 0.08, -0.02, -0.28);
      const kneeA = Math.sin(ph) * 0.32 * swing;
      const knee = new THREE.Vector3(s * 0.09, -0.02 + Math.sin(kneeA) * 0.38, -0.28 - Math.cos(kneeA) * 0.38);
      const ankA = kneeA + Math.sin(ph - 0.9) * 0.35 * swing;
      const ankle = new THREE.Vector3(s * 0.09, knee.y + Math.sin(ankA) * 0.36, knee.z - Math.cos(ankA) * 0.36);
      setLimb(leg.thigh, hip, knee, 0.065);
      setLimb(leg.shin, knee, ankle, 0.05);
      // The blade: from the ankle on back, bending with the stroke.
      const finA = ankA + Math.sin(ph - 1.6) * 0.45 * swing;
      leg.blade.position.copy(ankle);
      leg.blade.rotation.set(finA - Math.PI / 2, 0, 0);
      leg.blade.scale.set(1, L, 1);
    });
    // Arms: out in front holding the gun, or tucked along the body (scuba).
    const gunOut = this.kit === 'free';
    this.arms.forEach((arm, i) => {
      const s = i ? 1 : -1;
      const sh = new THREE.Vector3(s * 0.17, 0.05, 0.3);
      const hand = gunOut
        ? new THREE.Vector3(s * 0.04, -0.03, 0.82 + (i ? 0.12 : 0))
        : new THREE.Vector3(s * 0.13, -0.06, -0.05);
      const elbow = gunOut
        ? new THREE.Vector3(s * 0.12, -0.02, 0.56)
        : new THREE.Vector3(s * 0.2, -0.08, 0.12);
      setLimb(arm.upper, sh, elbow, 0.05);
      setLimb(arm.lower, elbow, hand, 0.042);
      arm.hand.position.copy(hand);
    });
    this.gun.position.set(0, -0.04, 0.78);
  }

  // Where your eyes are (first person): just inside the mask.
  eyePoint(out) {
    this.group.updateMatrixWorld(true);
    return this.head.localToWorld(out.set(0, 0.0, 0.13));
  }

  // The speargun's muzzle (third person), in the world.
  muzzle(out) {
    this.group.updateMatrixWorld(true);
    return this.gun.localToWorld(out.set(0, 0.03, 0.95));
  }

  setSelfHidden(on) {
    this.body.visible = !on;
  }
}

/* ---------------- the shot ---------------- */

// The shaft in flight, on its line back to the gun; a fish on it; drawn back in; the bands
// loaded again. States: 'loaded' → 'flying' → 'back' (being pulled in) → 'loading' → 'loaded'.
export class Shot {
  constructor(scene, rope) {
    this.state = 'loaded';
    this.t = 0;
    this.from = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 0, 1);
    this.tip = new THREE.Vector3();
    this.end = 0;       // how far this shot goes (to the fish, the bottom, or the end of the line)
    this.fish = null;   // { agent, quality, tears, wriggle }
    this.rope = rope;
    const steel = new THREE.MeshLambertMaterial({ color: '#b9c0c4' });
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 1.15, 5).rotateX(Math.PI / 2), steel);
    const tipM = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.05, 6).rotateX(Math.PI / 2), steel);
    tipM.position.z = 0.6;
    this.shaft.add(tipM);
    this.shaft.visible = false;
    scene.add(this.shaft);
  }

  get loaded() { return this.state === 'loaded'; }
  // 1 loaded, 0 the bands slack (for the gun's look).
  get bandsLoaded() { return this.state === 'loaded' ? 1 : this.state === 'loading' ? clamp(this.t / SPEAR.load, 0, 1) : 0; }

  fire(from, dir, end, fish) {
    this.state = 'flying';
    this.t = 0;
    this.from.copy(from);
    this.dir.copy(dir);
    this.end = end;
    this.fish = fish;
    this.shaft.visible = true;
  }

  reset() {
    this.state = 'loaded';
    this.t = 0;
    this.fish = null;
    this.shaft.visible = false;
    this.rope.hide();
  }

  // Each frame: muzzle is where the gun is now (the line runs back to it). Returns an event:
  // 'hit' (the shaft has reached the fish), 'landed' (pulled in with a fish), 'tore' (it tore
  // free), or null.
  update(dt, muzzle) {
    this.t += dt;
    let ev = null;
    if (this.state === 'flying') {
      const d = Math.min(this.end, this.t * SPEAR.speed);
      this.tip.copy(this.from).addScaledVector(this.dir, d);
      if (d >= this.end) {
        this.state = 'back';
        this.t = 0;
        this.hold = 0;
        if (this.fish) ev = 'hit';
      }
    } else if (this.state === 'back') {
      // A fish on the shaft struggles for a moment (and a badly hit one may tear free), then
      // it's drawn in hand over hand along the line.
      const struggle = this.fish ? 0.7 : 0.2;
      if (this.fish && this.fish.tears && this.t > 0.45 && !this.fish.gone) {
        this.fish.gone = true;
        ev = 'tore';
      }
      if (this.t > struggle) {
        const k = 1 - Math.exp(-(1 / SPEAR.retrieve) * 3.2 * dt);
        this.tip.lerp(muzzle, k);
        if (this.tip.distanceTo(muzzle) < 0.35) {
          if (this.fish && !this.fish.gone) ev = 'landed';
          this.state = 'loading';
          this.t = 0;
          this.fish = null;
          this.shaft.visible = false;
        }
      }
    } else if (this.state === 'loading' && this.t >= SPEAR.load) {
      this.state = 'loaded';
      this.t = 0;
    }
    if (this.shaft.visible) {
      // The shaft points the way it flew (on its way back, from the gun out to it).
      _m.lookAt(this.state === 'flying' ? this.from : muzzle, this.tip, UP);
      _q.setFromRotationMatrix(_m);
      this.shaft.position.copy(this.tip).addScaledVector(this.dir, -0.55);
      this.shaft.quaternion.copy(_q);
      this.shaft.rotateY(Math.PI);
      this.rope.lay(muzzle, this.tip, { tension: this.state === 'flying' ? 0.6 : 0.85, sag: 0.25 });
    } else this.rope.hide();
    return ev;
  }
}
