import * as THREE from 'three';
import { clamp, lerp, smoothstep, wrapAngle } from './util.js';

// First person: the rod is held in front of your eyes instead of by the little figure.
// For each moment of fishing there is a pose: where your hand is (in front of the camera) and
// which way the rod points (az to the right, el upwards, both in radians from straight ahead).
// The pose eases from one moment to the next, quickly on the flick of a cast, and the blank
// is a spring: it loads back as you cast and whips through after the line leaves.
//
// The rod stays the same object it always is (the figure's rod), so the fishing code still
// reads its tip for the line: only where it is held changes.

const HANDS = {
  low: new THREE.Vector3(0.25, -0.5, -0.3),    // carried, not fishing
  ready: new THREE.Vector3(0.21, -0.37, -0.38),
  out: new THREE.Vector3(0.19, -0.36, -0.47),  // reaching forward as the cast goes out
  back: new THREE.Vector3(0.26, -0.21, -0.17), // wound up over the shoulder
  fight: new THREE.Vector3(0.17, -0.31, -0.4),
  show: new THREE.Vector3(0.31, -0.3, -0.3),   // swung aside while you hold the fish up
};

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _hand = new THREE.Vector3();

// Which way something at (x, z) lies from the camera, in radians to the right of where it looks.
function bearing(cam, yaw, x, z) {
  return wrapAngle(yaw - Math.atan2(x - cam.x, z - cam.z));
}

export class RodView {
  constructor() {
    this.az = 0.3;
    this.el = -0.3;
    this.hand = HANDS.low.clone();
    this.bend = 0;
    this.bendVel = 0;
    this.cam = new THREE.Matrix4(); // the rod in camera space
  }

  // ctx: { yaw (where the camera looks), walking, phase (the walker's stride), onBoat }
  update(dt, t, f, camera, ctx) {
    const s = f.state, kind = f.kind;
    const cam = camera.position;
    let az = 0.12, el = 0.2, hand = HANDS.ready, rate = 5;
    // Point the rod roughly towards the line, but never so far that it leaves the view.
    const toward = (x, z, k) => clamp(bearing(cam, ctx.yaw, x, z) * k, -0.7, 0.8);
    switch (s) {
      case 'idle':
        az = 0.34; el = -0.1; hand = HANDS.low;
        break;
      case 'aiming': {
        // The rod goes back over your shoulder as the meter swings up.
        const p = smoothstep(0, 1, f.power);
        az = lerp(0.12, 0.2, p);
        el = lerp(0.18, 1.9, p);
        hand = _hand.lerpVectors(HANDS.ready, HANDS.back, p);
        rate = 10;
        break;
      }
      case 'casting':
        az = 0.1;
        el = f.t < 0.3 ? 0.02 : 0.14;
        hand = HANDS.out;
        rate = f.t < 0.3 ? 24 : 6;
        break;
      case 'drifting':
      case 'bite':
        az = 0.1 + toward(f.bob.x, f.bob.z, 0.35);
        if (kind === 'lure') el = 0.07 + (f.twitchT > 0 ? 0.15 : 0) - (f.reelSpeed > 0.05 ? 0.03 : 0);
        else if (kind === 'ledger') { el = 0.13; az += 0.04; }
        else if (kind === 'fly') el = 0.3 + (f.reelSpeed > 0.05 ? Math.sin(t * 9) * 0.03 : 0);
        else el = 0.2;
        if (s === 'bite') {
          el += 0.05 + Math.sin(t * 31) * 0.012;
          rate = 9;
        }
        break;
      case 'reeling': {
        const F = f.fight;
        const tension = F ? F.tension : 0.3;
        // Rod up against the fish, swung towards it as it runs left and right; it dips when it surges.
        az = 0.06 + toward(f.fishPos.x, f.fishPos.z, 0.55);
        el = 0.32 + 0.3 * Math.min(tension, 1) - (F && F.surgeT > 0 ? 0.18 : 0) + (F && F.pulling ? Math.sin(t * 22) * 0.01 : 0);
        hand = HANDS.fight;
        rate = 7;
        break;
      }
      case 'landing':
      case 'caught':
        az = 0.42; el = 0.85; hand = HANDS.show;
        break;
      case 'releasing':
      case 'keeping':
        az = 0.3; el = 0.4;
        break;
      case 'retrieving':
        az = 0.12; el = 0.3; rate = 8;
        break;
      default:
    }
    // Sitting in a boat, the rod is held higher to clear the gunwale.
    if (ctx.onBoat && s !== 'aiming') el += 0.14;
    // A live hand: breathing, and a little bounce in your step.
    el += Math.sin(t * 1.3) * 0.008;
    az += Math.sin(t * 0.9 + 1.7) * 0.006;
    const k = 1 - Math.exp(-rate * dt);
    this.az += (az - this.az) * k;
    this.el += (el - this.el) * k;
    this.hand.lerp(hand, k);
    _hand.copy(this.hand);
    if (ctx.walking) {
      _hand.y += Math.abs(Math.sin(ctx.phase)) * 0.02;
      _hand.x += Math.sin(ctx.phase) * 0.01;
    }

    // The blank: a lightly damped spring towards the bend the fishing asks for. Casting loads
    // it back for a moment first, so it whips through.
    let bendT = f.angler.pose.bend;
    if (s === 'casting' && f.t < 0.08) bendT = -0.35 * (0.4 + f.power);
    const K = 180, C = 11;
    this.bendVel += ((bendT - this.bend) * K - this.bendVel * C) * dt;
    this.bend += this.bendVel * dt;

    // Rod basis in camera space: +Y along the rod, +Z the side it bends towards (down, under load),
    // so the reel hangs beneath it.
    const ca = Math.cos(this.az), sa = Math.sin(this.az), ce = Math.cos(this.el), se = Math.sin(this.el);
    _y.set(sa * ce, se, -ca * ce);
    _x.set(-ca, 0, -sa);
    _z.crossVectors(_x, _y);
    this.cam.makeBasis(_x, _y, _z).setPosition(_hand);
  }

  // Hold the rod (a child of the figure) in front of the camera. w blends from where the figure
  // holds it (0) to the first-person pose (1), for the glide in and out of your eyes.
  place(rod, camera, w) {
    _m.multiplyMatrices(camera.matrixWorld, this.cam);
    rod.parent.updateMatrixWorld();
    _inv.copy(rod.parent.matrixWorld).invert();
    _m.premultiply(_inv).decompose(_p, _q, _s);
    rod.position.lerp(_p, w);
    rod.quaternion.slerp(_q, w);
    rod.updateMatrixWorld(true);
  }
}
