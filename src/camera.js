import * as THREE from 'three';
import { heightAt, walkHeight } from './world/terrain.js';
import { waveHeight } from './world/water.js';
import { clamp, damp, dampAngle, smoothstep, rand, lerp, wrapAngle } from './util.js';

// Ways to look at the world:
//  boat  – the familiar view from above and behind the boat
//  foot  – over your shoulder while you walk the shore
//  under – an underwater view orbiting a point beneath the boat
//  bait  – an underwater view that follows your bait (or the fish on the line)
//  eye   – first person: through your own eyes, the rod in your hands (pitch here is how far
//          you look down)
// Each view remembers its own angle and zoom. Switching glides there; it never cuts.
const LIMITS = {
  boat: { pitch: [0.12, 1.2], dist: [6, 40] },
  foot: { pitch: [0.02, 1.25], dist: [2.8, 26] },
  under: { pitch: [-0.8, 0.85], dist: [3, 22] },
  bait: { pitch: [-0.8, 0.85], dist: [1.8, 10] },
  eye: { pitch: [-0.6, 1.0], dist: [0, 0] },
};
export const VIEW_NAMES = { boat: 'Boat view', foot: 'On foot', under: 'Underwater', bait: 'Watching your bait', eye: 'First person' };
const EYE_PITCH = 0.2; // looking a little down at the water when you first raise your eyes

const _f = new THREE.Vector3();
const _look = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qr = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'boat';
    this.views = {
      boat: { yaw: 0, pitch: 0.46, dist: 15 },
      foot: { yaw: 0, pitch: 0.3, dist: 7.5 },
      under: { yaw: 0, pitch: 0.08, dist: 9 },
      bait: { yaw: 0, pitch: 0.15, dist: 4.5 },
      eye: { yaw: 0, pitch: EYE_PITCH, dist: 0 },
    };
    this.focus = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.lastManual = -99;
    this.settleUntil = 0;
    this.changedAt = -99;
    this.shake = 0;
    this.onFoot = false;
    // First person is chosen as the view to come back to (from underwater, say) while it's on.
    this.firstPerson = false;
    this.eyeChangedAt = -99;
    this.eyeBlend = 0;      // 1 with the camera at your eyes, 0 well away from them
    this.lastHeading = null;
    // The view the player chose before watching their bait, to go back to afterwards.
    this.beforeBait = null;
    // Comfort settings (set by the game): drag sensitivity, inverted axes, reduced motion.
    this.sensitivity = 1;
    this.invertX = false;
    this.invertY = false;
    this.reduced = false;
  }

  get yaw() { return this.views[this.mode].yaw; }
  get underwaterView() { return this.mode === 'under' || this.mode === 'bait'; }
  get third() { return this.onFoot ? 'foot' : 'boat'; }
  get home() { return this.firstPerson ? 'eye' : this.third; }

  init(boat) {
    this.views.boat.yaw = boat.heading + 0.7;
    this.focus.set(boat.pos.x, 1.2, boat.pos.z);
    this.pos.set(boat.pos.x - Math.sin(this.views.boat.yaw) * 24, 8, boat.pos.z - Math.cos(this.views.boat.yaw) * 24);
  }

  setMode(mode, t) {
    if (mode === this.mode) return false;
    if (mode === 'bait') this.beforeBait = this.mode;
    const from = this.views[this.mode], to = this.views[mode];
    to.yaw = from.yaw; // keep facing the same way, so the change feels like ducking under, not teleporting
    if (mode === 'eye') to.pitch = EYE_PITCH;
    if (mode === 'eye' || this.mode === 'eye') this.eyeChangedAt = t;
    this.mode = mode;
    this.changedAt = t;
    return true;
  }

  // Into your own eyes, or back out over your shoulder (or above the boat).
  setFirstPerson(on, t) {
    this.firstPerson = on;
    return this.setMode(on ? 'eye' : this.third, t);
  }

  // On foot there is no boat to look under, so the view goes straight to your bait.
  cycle(baitAvailable, t) {
    const order = this.onFoot ? ['foot', 'eye'] : ['boat', 'eye', 'under'];
    if (baitAvailable) order.push('bait');
    const i = order.indexOf(this.mode);
    const next = order[(i + 1) % order.length];
    if (next === 'eye') this.firstPerson = true;
    else if (next === this.third) this.firstPerson = false;
    this.setMode(next, t);
  }

  // Back to the usual view behind you (first person off).
  reset(anchor, t) {
    this.firstPerson = false;
    const home = this.home;
    this.setMode(home, t);
    Object.assign(this.views[home], home === 'boat' ? { yaw: anchor.heading, pitch: 0.46, dist: 15 } : { yaw: anchor.heading, pitch: 0.3, dist: 7.5 });
    this.lastManual = -99;
    this.changedAt = t;
  }

  // Stepping ashore or back into the boat: glide to the matching view, facing the same way.
  setHome(onFoot, t) {
    this.onFoot = onFoot;
    const home = this.home;
    if (this.mode !== home) this.setMode(home, t);
    else if (home === 'eye') this.eyeChangedAt = t; // your eyes move from the boat to the shore: glide
    this.settleUntil = t + 1.2;
  }

  input(drag, wheel, t) {
    const v = this.views[this.mode], lim = LIMITS[this.mode];
    const eye = this.mode === 'eye';
    if (drag.x || drag.y) {
      const k = this.sensitivity;
      v.yaw -= drag.x * (eye ? 0.0045 : 0.0055) * k * (this.invertX ? -1 : 1);
      v.pitch = clamp(v.pitch + drag.y * (eye ? 0.0035 : 0.004) * k * (this.invertY ? -1 : 1), lim.pitch[0], lim.pitch[1]);
      this.lastManual = t;
    }
    if (wheel && !eye) v.dist = clamp(v.dist * Math.exp(wheel * 0.0012), lim.dist[0], lim.dist[1]);
  }

  // Turn your head (first person): the keys swing the view while you aim a cast.
  turn(dir, dt, t) {
    if (this.mode !== 'eye' || !dir) return;
    this.views.eye.yaw += dir * 1.3 * dt;
    this.lastManual = t;
  }

  // eye: where your eyes are (first person); roll: how much of the boat's roll you feel.
  update(dt, t, { boat, walker, started, fishing, baitFocus, eye = null, roll = 0 }) {
    // The bait left the water: nothing to watch, so glide back to the view you were in before.
    if (this.mode === 'bait' && !baitFocus) {
      let back = this.beforeBait && this.beforeBait !== 'bait' ? this.beforeBait : this.home;
      if (back === 'under' && this.onFoot) back = this.home;
      if (back === 'eye') this.firstPerson = true;
      this.setMode(back, t);
    }
    if (this.onFoot && this.mode === 'under') this.setMode(this.firstPerson ? 'eye' : 'foot', t);
    if (this.mode === 'eye' && (!started || !eye)) this.setMode(this.third, t);
    const v = this.views[this.mode];
    const under = this.underwaterView;
    // In a boat your view turns with the boat (not when you step across into the other one).
    if (!this.onFoot && this.lastHeading !== null && this.lastBoat === boat && this.mode === 'eye') v.yaw += wrapAngle(boat.heading - this.lastHeading);
    this.lastHeading = this.onFoot ? null : boat.heading;
    this.lastBoat = boat;

    if (this.mode === 'eye') {
      this.updateEye(dt, t, v, eye, roll, fishing);
      return;
    }

    if (!started) v.yaw += dt * 0.045;
    else if (this.mode === 'boat') {
      let follow = 0;
      if (t < this.settleUntil) follow = 1.4;
      else if (t - this.lastManual > 3 && !fishing.busy) follow = 1.1 * smoothstep(0.6, 3.5, boat.forwardSpeed);
      if (follow > 0) v.yaw = dampAngle(v.yaw, boat.heading, follow, dt);
    } else if (this.mode === 'foot') {
      // Drift round behind you while you walk forwards (not while you strafe or turn back).
      let follow = 0;
      const ahead = Math.abs(((walker.heading - v.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.1;
      if (t < this.settleUntil) follow = 1.2;
      else if (t - this.lastManual > 2.5 && !fishing.busy && ahead) follow = 0.9 * smoothstep(0.8, 3.5, walker.speed);
      if (follow > 0) v.yaw = dampAngle(v.yaw, walker.heading, follow, dt);
    }

    // Where the camera looks
    if (this.mode === 'boat') {
      _f.set(boat.pos.x, boat.heave + 1.2, boat.pos.z);
      if (fishing.lineOut) {
        _f.x = lerp(_f.x, fishing.bob.x, 0.35);
        _f.z = lerp(_f.z, fishing.bob.z, 0.35);
      }
    } else if (this.mode === 'foot') {
      _f.set(walker.pos.x, walker.pos.y + 1.45, walker.pos.z);
      if (fishing.lineOut) {
        // Keep yourself in view and the line running out ahead.
        _f.x = lerp(_f.x, fishing.bob.x, 0.18);
        _f.z = lerp(_f.z, fishing.bob.z, 0.18);
        _f.y = Math.max(_f.y - 0.3, walkHeight(_f.x, _f.z) + 0.9);
      }
    } else if (this.mode === 'under') {
      const depth = Math.max(0, -heightAt(boat.pos.x, boat.pos.z));
      _f.set(boat.pos.x, -clamp(depth * 0.45, Math.min(1.0, depth * 0.5), 5.5), boat.pos.z);
    } else {
      _f.set(baitFocus.x, Math.min(baitFocus.y, -0.6), baitFocus.z);
    }
    const fr = 1 - Math.exp(-(this.mode === 'bait' ? 5 : 4) * dt);
    this.focus.x += (_f.x - this.focus.x) * fr;
    this.focus.y += (_f.y - this.focus.y) * fr;
    this.focus.z += (_f.z - this.focus.z) * fr;

    // Where the camera sits: on a sphere around the focus
    const fishingFoot = this.mode === 'foot' && fishing.lineOut;
    const pitch = started ? (fishingFoot ? Math.max(v.pitch, 0.42) : v.pitch) : 0.26;
    const dist = started ? v.dist + (this.mode === 'boat' && fishing.lineOut ? 3 : fishingFoot ? 3.5 : 0) : 26;
    const hd = dist * Math.cos(pitch);
    let cx = this.focus.x - Math.sin(v.yaw) * hd;
    let cy = this.focus.y + dist * Math.sin(pitch);
    let cz = this.focus.z - Math.cos(v.yaw) * hd;
    // Stay on the right side of the waterline, so the view is never half in, half out.
    if (under) cy = Math.min(cy, waveHeight(cx, cz, t) - 0.45);
    else cy = Math.max(cy, waveHeight(cx, cz, t) + 0.8);
    // Pull in if a hill or the seabed sits between the focus and the camera.
    const steps = 14;
    let px = this.focus.x, py = this.focus.y, pz = this.focus.z;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const x = lerp(this.focus.x, cx, k), y = lerp(this.focus.y, cy, k), z = lerp(this.focus.z, cz, k);
      if (y < heightAt(x, z) + 0.45) {
        cx = px;
        cy = py;
        cz = pz;
        break;
      }
      px = x;
      py = y;
      pz = z;
    }

    // Glide: slower right after switching views, steady while following.
    const rate = t - this.changedAt < 1.8 ? 2.4 : 7;
    const k = 1 - Math.exp(-rate * dt);
    this.pos.x += (cx - this.pos.x) * k;
    this.pos.y += (cy - this.pos.y) * k;
    this.pos.z += (cz - this.pos.z) * k;
    this.pos.y = Math.max(this.pos.y, heightAt(this.pos.x, this.pos.z) + 0.4);

    const cam = this.camera;
    cam.position.copy(this.pos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.12;
      cam.position.x += rand(-s, s);
      cam.position.y += rand(-s, s);
    }
    this.look.copy(this.focus);
    // Above water, aim a little above the boat so the horizon stays in frame
    // (less on portrait and short screens, so the boat stays clear of the controls).
    if (!under) this.look.y += (this.mode === 'foot' ? 0.4 + v.dist * 0.05 : 1.6 + v.dist * 0.06) * clamp(cam.aspect, 0.3, 1) * clamp(innerHeight / 640, 0.55, 1);
    this.orient(dt, t, this.look, 0);
    // Gliding back out of your eyes, the rod and you come back as the camera leaves your head.
    this.eyeBlend = eye && t - this.eyeChangedAt < 2 ? 1 - smoothstep(0.3, 1.8, this.pos.distanceTo(eye)) : 0;
  }

  // First person: the camera sits at your eyes and looks where you turn your head. Coming in
  // from behind it glides there; once there it stays put (a lagging head feels seasick).
  updateEye(dt, t, v, eye, roll, fishing) {
    // A fish running right out of sight: your head turns just enough to keep it at the edge of
    // view (unless you're looking around yourself, or have asked for reduced camera motion).
    if (!this.reduced && fishing.state === 'reeling' && fishing.fight && t - this.lastManual > 1.5) {
      const p = fishing.fishPos, cam = this.camera.position;
      const to = Math.atan2(p.x - cam.x, p.z - cam.z);
      const off = wrapAngle(to - v.yaw);
      const over = Math.abs(off) - 0.6;
      if (over > 0) v.yaw += Math.sign(off) * over * (1 - Math.exp(-1.6 * dt));
    }
    const gliding = t - this.eyeChangedAt < 1.4;
    const k = 1 - Math.exp(-(gliding ? 6 : 40) * dt);
    this.pos.lerp(eye, k);
    this.focus.copy(this.pos);
    const cam = this.camera;
    cam.position.copy(this.pos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.04;
      cam.position.x += rand(-s, s);
      cam.position.y += rand(-s, s);
    }
    const cp = Math.cos(v.pitch);
    _look.set(Math.sin(v.yaw) * cp, -Math.sin(v.pitch), Math.cos(v.yaw) * cp).add(cam.position);
    this.orient(dt, t, _look, roll);
    this.eyeBlend = 1 - smoothstep(0.3, 1.8, this.pos.distanceTo(eye));
  }

  // Look at a point (rolled a little, in a boat). Just after going into or out of first person
  // the turn is eased, so the view swings round rather than snapping.
  orient(dt, t, target, roll) {
    const cam = this.camera;
    _m.lookAt(cam.position, target, UP);
    _q.setFromRotationMatrix(_m);
    if (roll) _q.multiply(_qr.setFromAxisAngle(FWD, roll));
    if (t - this.eyeChangedAt < 1.4) cam.quaternion.slerp(_q, 1 - Math.exp(-7 * dt));
    else cam.quaternion.copy(_q);
  }
}
