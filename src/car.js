import * as THREE from 'three';
import { heightAt, laneInfo } from './world/terrain.js';
import { mergeParts, mat, clamp, damp, dampAngle, smoothstep, glowTexture } from './util.js';

// The car: a modest old estate in faded sage green, with a roof rack, a big boot and the gear
// you've loaded in it showing through the back window (a tackle bag, a rod tube, the tent bundle,
// the stove's box and the cool box, as you've packed them). It drives the gravel lanes from home
// to Willowhaven, Shell Strand and Cove Head (and the grass beside them where it's gentle): easy
// to drive and hard to get into trouble with. It won't go into the sea, up anything steep, or
// through trees, rocks and walls; it just stops, and if it ever can't go on, a reset puts it back
// on the lane. Made from simple shapes (no outside models).

export const CAR = {
  length: 4.5, width: 1.82, wheelbase: 2.7, track: 1.52, wheelR: 0.33,
  top: 13,        // m/s on the gravel (about 45 km/h)
  grass: 7,       // and off it
  back: 4,        // reversing
  accel: 3.4, brake: 8, reverseAccel: 2.2,
  steerMax: 0.66,
};
// The circles a car's body is checked with (along its length), and their radius.
const BODY = [-1.45, 0, 1.45];
const BODY_R = 0.92;
const STEEP = 0.42;     // a grade the car won't climb (or go down)
const WATER = 0.35;     // ground lower than this is the water's edge

const plain = () => new THREE.MeshLambertMaterial({ vertexColors: true });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function build() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const PAINT = '#7d9483', DARK = '#2a2d30', TRIM = '#c9cdc8';
  const P = [];
  const put = (geo, x, y, z, color, rx = 0, ry = 0, rz = 0) => P.push({ geo, matrix: mat(x, y, z, rx, ry, rz), color });
  // The body: lower shell, sills, bonnet and the long roof of an estate. (+z is the front.)
  put(box(1.8, 0.55, 4.4), 0, 0.62, 0, PAINT);
  put(box(1.84, 0.12, 4.46), 0, 0.42, 0, DARK);
  put(box(1.7, 0.1, 1.2), 0, 0.93, 1.55, PAINT, -0.06, 0, 0);
  // The cabin: pillars and roof (the windows are their own dark glass).
  put(box(1.66, 0.08, 2.75), 0, 1.5, -0.45, PAINT);
  for (const sx of [-0.8, 0.8]) {
    put(box(0.07, 0.75, 0.08), sx, 1.24, 1.18, PAINT, -0.79, 0, 0);
    put(box(0.07, 0.58, 0.08), sx, 1.2, -0.05, PAINT);
    put(box(0.07, 0.58, 0.08), sx, 1.2, -1.75, PAINT, -0.12, 0, 0);
  }
  // Bumpers, grille, lights, door lines, handles, mirrors.
  put(box(1.86, 0.2, 0.18), 0, 0.45, 2.22, DARK);
  put(box(1.86, 0.2, 0.18), 0, 0.45, -2.22, DARK);
  put(box(0.9, 0.18, 0.04), 0, 0.72, 2.2, '#3a3f44');
  for (const sx of [-0.62, 0.62]) {
    put(box(0.36, 0.14, 0.04), sx, 0.75, 2.21, '#f3f0e2');
    put(box(0.3, 0.16, 0.04), sx, 0.78, -2.21, '#b3302a');
    put(box(0.12, 0.08, 0.2), sx > 0 ? 0.98 : -0.98, 1.1, 0.8, DARK);
  }
  for (const sx of [-0.905, 0.905]) {
    put(box(0.01, 0.5, 0.012), sx, 0.68, 0.45, '#5f6f64');
    put(box(0.01, 0.5, 0.012), sx, 0.68, -0.85, '#5f6f64');
    put(box(0.015, 0.03, 0.14), sx, 0.84, 0.2, TRIM);
    put(box(0.015, 0.03, 0.14), sx, 0.84, -1.05, TRIM);
  }
  // Inside: the dashboard, the steering wheel (on the left), the seats.
  put(box(1.62, 0.22, 0.45), 0, 1.0, 0.82, '#2f3336');
  put(box(1.5, 0.05, 0.3), 0, 1.12, 0.72, '#3a3f44');
  put(new THREE.TorusGeometry(0.17, 0.025, 6, 16), 0.4, 1.12, 0.52, '#1f2224', -0.45, 0, 0);
  put(box(0.03, 0.03, 0.22), 0.4, 1.06, 0.6, '#1f2224', -0.45, 0, 0);
  for (const sx of [-0.4, 0.4]) {
    put(box(0.5, 0.12, 0.5), sx, 0.97, -0.2, '#5b4636');
    put(box(0.5, 0.55, 0.1), sx, 1.22, -0.48, '#5b4636', 0.12, 0, 0);
  }
  // The roof rack.
  for (const sx of [-0.7, 0.7]) put(box(0.05, 0.05, 2.4), sx, 1.58, -0.45, '#4a4f54');
  for (const z of [-1.4, 0.4]) put(box(1.5, 0.04, 0.05), 0, 1.6, z, '#4a4f54');
  const shell = new THREE.Mesh(mergeParts(P), plain());
  shell.castShadow = true;
  shell.receiveShadow = true;
  body.add(shell);
  // Windows.
  const glassMat = new THREE.MeshLambertMaterial({ color: '#2d3a42', transparent: true, opacity: 0.62 });
  const G = [];
  const gput = (geo, x, y, z, rx = 0) => G.push({ geo, matrix: mat(x, y, z, rx, 0, 0), color: '#ffffff' });
  gput(box(1.56, 0.72, 0.02), 0, 1.24, 1.18, -0.79);
  for (const sx of [-0.83, 0.83]) gput(box(0.02, 0.5, 2.6), sx, 1.22, -0.45);
  const glass = new THREE.Mesh(mergeParts(G), glassMat);
  body.add(glass);
  // The tailgate (hinged at the roof's back edge; it lifts to open the boot).
  const gate = new THREE.Group();
  gate.position.set(0, 1.52, -1.83);
  // (From the hinge down to the top of the bumper, sloping back a little: frame, a strip of
  // paint below the window, the glass.)
  const along = (d, color, w, h, t = 0.05, off = 0) => ({ geo: box(w, h, t), matrix: mat(0, -0.62 * d, -0.32 * d - off, 0.475, 0, 0), color });
  const gateParts = [
    along(0.06, PAINT, 1.62, 0.08),
    along(0.86, PAINT, 1.62, 0.2),
    along(0.86, TRIM, 0.32, 0.05, 0.02, 0.03),
    { geo: box(0.06, 0.7, 0.05), matrix: mat(-0.79, -0.31, -0.16, 0.475, 0, 0), color: PAINT },
    { geo: box(0.06, 0.7, 0.05), matrix: mat(0.79, -0.31, -0.16, 0.475, 0, 0), color: PAINT },
  ];
  const gateMesh = new THREE.Mesh(mergeParts(gateParts), plain());
  gateMesh.castShadow = true;
  gate.add(gateMesh);
  const backGlass = new THREE.Mesh(box(1.52, 0.46, 0.02), glassMat);
  backGlass.position.set(0, -0.62 * 0.42, -0.32 * 0.42);
  backGlass.rotation.x = 0.475;
  gate.add(backGlass);
  body.add(gate);
  // The wheels (spinning as you go; the front ones steer).
  const wheels = [];
  const wheelGeo = mergeParts([
    { geo: new THREE.CylinderGeometry(CAR.wheelR, CAR.wheelR, 0.24, 16), matrix: mat(0, 0, 0, 0, 0, Math.PI / 2), color: '#1f2123' },
    { geo: new THREE.CylinderGeometry(0.17, 0.17, 0.25, 10), matrix: mat(0, 0, 0, 0, 0, Math.PI / 2), color: '#a7aaa6' },
    { geo: box(0.26, 0.04, 0.3), matrix: mat(0, 0, 0), color: '#8a8d89' },
  ]);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * CAR.track / 2, CAR.wheelR, sz * CAR.wheelbase / 2);
    const w = new THREE.Mesh(wheelGeo, plain());
    w.castShadow = true;
    pivot.add(w);
    g.add(pivot);
    wheels.push({ pivot, w, front: sz > 0 });
  }
  // Head and tail lights' glow after dark.
  const glows = [];
  for (const [x, z, col] of [[-0.62, 2.3, 'rgba(255,240,200,1)'], [0.62, 2.3, 'rgba(255,240,200,1)'], [-0.62, -2.3, 'rgba(255,60,40,1)'], [0.62, -2.3, 'rgba(255,60,40,1)']]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.position.set(x, 0.76, z);
    s.scale.setScalar(z > 0 ? 0.9 : 0.5);
    body.add(s);
    glows.push({ s, front: z > 0 });
  }
  // The cargo in the boot: each piece its own mesh, shown when it's loaded.
  const cargo = {};
  const cmesh = (parts) => {
    const m = new THREE.Mesh(mergeParts(parts), plain());
    m.visible = false;
    body.add(m);
    return m;
  };
  cargo.bag = cmesh([
    { geo: box(0.62, 0.36, 0.42), matrix: mat(-0.42, 1.08, -1.4), color: '#3c6b4c' },
    { geo: box(0.64, 0.05, 0.1), matrix: mat(-0.42, 1.28, -1.4), color: '#24402e' },
  ]);
  cargo.rods = cmesh([
    { geo: new THREE.CylinderGeometry(0.09, 0.09, 2.1, 10), matrix: mat(0.55, 1.0, -0.75, Math.PI / 2, 0, 0), color: '#3a3f44' },
    { geo: new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), matrix: mat(0.55, 1.0, -1.78, Math.PI / 2, 0, 0), color: '#c64a2e' },
  ]);
  cargo.tent = cmesh([
    { geo: new THREE.CylinderGeometry(0.19, 0.19, 0.8, 12), matrix: mat(0.2, 1.1, -1.5, 0, 0, Math.PI / 2), color: '#4f6b3a' },
    { geo: new THREE.CylinderGeometry(0.14, 0.14, 0.6, 10), matrix: mat(0.2, 1.4, -1.55, 0, 0, Math.PI / 2), color: '#3f5f86' },
  ]);
  cargo.stove = cmesh([{ geo: box(0.4, 0.28, 0.4), matrix: mat(0.55, 1.04, -1.25), color: '#b3402e' }]);
  cargo.coolbox = cmesh([
    { geo: box(0.6, 0.38, 0.42), matrix: mat(-0.42, 1.09, -0.85), color: '#3f7fa8' },
    { geo: box(0.62, 0.07, 0.44), matrix: mat(-0.42, 1.31, -0.85), color: '#eef0ec' },
  ]);
  return { g, body, gate, wheels, glows, cargo, glassMat };
}

export class Car {
  constructor(scene) {
    const m = build();
    this.group = m.g;
    this.body = m.body;
    this.gate = m.gate;
    this.wheels = m.wheels;
    this.glows = m.glows;
    this.cargo = m.cargo;
    this.group.name = 'car';
    scene.add(this.group);
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;      // along the heading (negative when reversing)
    this.steer = 0;      // the front wheels' angle
    this.pitch = 0;
    this.roll = 0;
    this.gateOpen = 0;   // 0 shut … 1 open
    this.wantGate = false;
    this.spin = 0;
    this.stuckT = 0;
    this.bumpT = 0;
  }

  get forwardSpeed() { return this.speed; }

  place(x, z, yaw) {
    this.pos.set(x, heightAt(x, z), z);
    this.heading = yaw;
    this.speed = 0;
    this.steer = 0;
    this.stuckT = 0;
    this.pose(1);
  }

  // Which of the boot's things to show: { bag, rods, tent, stove, coolbox }.
  showCargo(c) {
    for (const k of Object.keys(this.cargo)) this.cargo[k].visible = !!c[k];
  }

  // Where things are around the car, in the world: the driver's door, the boot, the driver's eyes.
  local(lx, lz, out = { x: 0, z: 0 }) {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    out.x = this.pos.x + lx * c + lz * s;
    out.z = this.pos.z - lx * s + lz * c;
    return out;
  }
  doorSpot() { return this.local(1.55, 0.25); }      // beside the driver's door (on the left: +x)
  bootSpot() { return this.local(0, -3.25); }        // behind the boot
  eyePoint(out) {
    const p = this.local(0.4, -0.28);
    return out.set(p.x, this.pos.y + 1.4, p.z);
  }

  // How the ground sits under the car at (x, z) facing yaw: the lowest corner (the water's edge is
  // below WATER), and how steep it is (1 = the most the car will take, along or across).
  ground(x, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    let low = Infinity;
    for (const [lx, lz] of [[-0.9, 2.2], [0.9, 2.2], [-0.9, -2.2], [0.9, -2.2]]) low = Math.min(low, heightAt(x + lx * c + lz * s, z - lx * s + lz * c));
    const hf = heightAt(x + s * 1.6, z + c * 1.6), hb = heightAt(x - s * 1.6, z - c * 1.6);
    const hl = heightAt(x - c * 0.9, z + s * 0.9), hr = heightAt(x + c * 0.9, z - s * 0.9);
    return { low, steep: Math.max(Math.abs(hf - hb) / 3.2 / STEEP, Math.abs(hl - hr) / 1.8 / (STEEP * 1.6)) };
  }

  // Can the car's body stand at (x, z) facing yaw? Returns null, or why not. With `from` (where it
  // is now), only a move that makes things worse is refused: you can always back out of trouble.
  blocked(x, z, yaw, solids, from = null, out = []) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const u of BODY) {
      const bx = x + u * s, bz = z + u * c;
      solids.near(bx, bz, BODY_R, out);
      if (out.length) {
        // (Something the car already overlaps doesn't hold it there: moving away is fine.)
        const fs = from ? Math.sin(from.yaw) : 0, fc = from ? Math.cos(from.yaw) : 0;
        const worse = out.filter((o) => !from || Math.hypot(bx - o.x, bz - o.z) < Math.hypot(from.x + u * fs - o.x, from.z + u * fc - o.z));
        if (worse.length) return { kind: 'thing', name: worse[0].name || 'something' };
      }
    }
    const g = this.ground(x, z, yaw), g0 = from ? this.ground(from.x, from.z, from.yaw) : null;
    if (g.low < WATER && (!g0 || g.low < g0.low - 0.001)) return { kind: 'water' };
    if (g.steep > 1 && (!g0 || g.steep > g0.steep + 0.001)) return { kind: 'steep' };
    return null;
  }

  // controls: { throttle -1…1, steer -1…1, brake 0/1 }, live: you're at the wheel.
  // Returns a bump ({ kind }) when something stopped the car this frame.
  update(dt, t, { throttle = 0, steer = 0, brake = 0 } = {}, solids, { live = false, night = 0, still = false } = {}) {
    let bump = null;
    const onLane = laneInfo(this.pos.x, this.pos.z).d < 2.8;
    const top = onLane ? CAR.top : CAR.grass;
    // Throttle and brakes: pushing against the way you're rolling brakes first.
    let a = 0;
    if (live) {
      if (brake) a = -Math.sign(this.speed) * CAR.brake;
      else if (throttle > 0) a = this.speed < -0.2 ? CAR.brake : CAR.accel * throttle * (1 - smoothstep(top * 0.7, top, this.speed));
      else if (throttle < 0) a = this.speed > 0.2 ? -CAR.brake : -CAR.reverseAccel * -throttle * (this.speed < -CAR.back ? 0 : 1);
    } else a = -Math.sign(this.speed) * CAR.brake; // (nobody driving: the handbrake is on)
    // Rolling resistance and a little air (more on grass); a slope pulls a little.
    const drag = (onLane ? 0.35 : 0.9) * Math.sign(this.speed) + this.speed * (onLane ? 0.04 : 0.12);
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    const grade = (heightAt(this.pos.x + s * 1.4, this.pos.z + c * 1.4) - heightAt(this.pos.x - s * 1.4, this.pos.z - c * 1.4)) / 2.8;
    const v0 = this.speed;
    this.speed += (a - drag - grade * 9.8 * 0.35 * (live && (throttle || brake) ? 1 : 0.2)) * dt;
    // Braking or drag to a stop doesn't overshoot into reverse.
    if ((v0 > 0 && this.speed < 0 && throttle >= 0) || (v0 < 0 && this.speed > 0 && throttle <= 0)) this.speed = 0;
    if (Math.abs(this.speed) < 0.05 && !(live && throttle)) this.speed = 0;
    this.speed = clamp(this.speed, -CAR.back, top + 1);
    // Steering: quick to turn, quicker back to straight, gentler at speed.
    const max = CAR.steerMax / (1 + Math.abs(this.speed) * 0.08);
    this.steer = damp(this.steer, live ? steer * max : 0, steer ? 4 : 6, dt);
    const turn = (this.speed / CAR.wheelbase) * Math.tan(this.steer);
    const yaw = this.heading + turn * dt;
    const ns = Math.sin(yaw), nc = Math.cos(yaw);
    const nx = this.pos.x + ns * this.speed * dt, nz = this.pos.z + nc * this.speed * dt;
    const why = this.speed !== 0 || turn !== 0 ? this.blocked(nx, nz, yaw, solids, { x: this.pos.x, z: this.pos.z, yaw: this.heading }) : null;
    if (why) {
      // Stop (with a little give), and say what was in the way.
      if (Math.abs(this.speed) > 1.2 && this.bumpT <= 0) bump = { ...why, speed: Math.abs(this.speed) };
      this.speed *= -0.12;
      this.bumpT = 0.6;
      if (live && throttle) this.stuckT += dt;
    } else {
      this.pos.x = nx;
      this.pos.z = nz;
      this.heading = yaw;
      if (Math.abs(this.speed) > 0.3) this.stuckT = 0;
    }
    this.bumpT -= dt;
    this.spin += (this.speed * dt) / CAR.wheelR;
    this.pose(dt, still);
    // The boot lid, and lights after dark.
    this.gateOpen = damp(this.gateOpen, this.wantGate ? 1 : 0, 5, dt);
    this.gate.rotation.x = 1.6 * smoothstep(0, 1, this.gateOpen);
    for (const gl of this.glows) gl.s.material.opacity = live ? night * (gl.front ? 0.9 : 0.7) : 0;
    return bump;
  }

  // Sit the body on its wheels on the ground: height, pitch and roll from where the wheels are.
  pose(dt, still = false) {
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    const L = CAR.wheelbase / 2, W = CAR.track / 2;
    const h = (lx, lz) => heightAt(this.pos.x + lx * c + lz * s, this.pos.z - lx * s + lz * c);
    const fl = h(-W, L), fr = h(W, L), bl = h(-W, -L), br = h(W, -L);
    const y = (fl + fr + bl + br) / 4;
    const pitch = Math.atan2((bl + br - fl - fr) / 2, CAR.wheelbase);
    const roll = Math.atan2((fr + br - fl - bl) / 2, CAR.track);
    const k = still ? 1 : 1 - Math.exp(-12 * dt);
    this.pos.y = this.pos.y + (y - this.pos.y) * (dt >= 1 ? 1 : k);
    this.pitch += (pitch - this.pitch) * (dt >= 1 ? 1 : k);
    this.roll += (roll - this.roll) * (dt >= 1 ? 1 : k);
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, this.heading, 0);
    this.body.rotation.set(this.pitch, 0, this.roll);
    for (const wh of this.wheels) {
      wh.pivot.rotation.y = wh.front ? this.steer : 0;
      wh.w.rotation.x = this.spin;
    }
  }

  // Back on the lane: the nearest point on it, facing along it (the way you were going), clear of
  // anything. Steps along the lane until the car fits.
  resetToLane(solids) {
    const li = laneInfo(this.pos.x, this.pos.z, undefined, Infinity);
    if (!Number.isFinite(li.d)) return false;
    const base = { x: li.px, z: li.pz, tx: li.tx, tz: li.tz };
    const yaw0 = Math.atan2(base.tx, base.tz);
    const fwd = Math.cos(this.heading - yaw0) >= 0 ? yaw0 : yaw0 + Math.PI;
    for (let k = 0; k < 40; k++) {
      for (const sgn of k ? [1, -1] : [1]) {
        const q = laneInfo(base.x + base.tx * k * 1.5 * sgn, base.z + base.tz * k * 1.5 * sgn, undefined, Infinity);
        const yaw = Math.atan2(q.tx, q.tz), f = Math.cos(fwd - yaw) >= 0 ? yaw : yaw + Math.PI;
        if (!this.blocked(q.px, q.pz, f, solids)) {
          this.place(q.px, q.pz, f);
          return true;
        }
      }
    }
    return false;
  }
}
