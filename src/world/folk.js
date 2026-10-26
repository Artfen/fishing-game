import * as THREE from 'three';
import { walkHeight } from './terrain.js';
import { waveHeight } from './water.js';
import { Boat } from '../boat.js';
import { damp, dampAngle, clamp } from '../util.js';
import { FOLK_IDS, SPOTS, POTS } from '../townsfolk.js';

// How the harbour's people look, and the Morning Star (Dougie's boat), drawn where townsfolk.js
// says they are: walking (legs and arms swinging), standing about, sitting (on the bench, Bert's
// chair, or the edge of the quay with his legs over, in Kit's case), busy with their hands, fishing
// (a rod out, its tip nodding now and then), or holding up a fish they've just had. All of it made
// here from simple shapes, the same way as you.

const LOOKS = {
  mags: { coat: '#6d7378', legs: '#3b3f46', boots: '#2d2a28', apron: '#2e5f8a', skin: '#efc39d', hat: 'bun', hair: '#a9a59e', sleeves: 'rolled' },
  bert: { coat: '#7a6a4f', legs: '#3b3b3b', boots: '#3a2b20', skin: '#e9bf9a', hat: 'flatcap', hatColor: '#4a4a48', stoop: 0.14 },
  ruth: { coat: '#7b2e3b', legs: '#2f2a2c', boots: '#2d2a28', apron: '#efe9dc', skin: '#f1c7a1', hat: 'bun', hair: '#8a4a2a' },
  dougie: { coat: '#2b3a55', bib: '#e2662a', legs: '#e2662a', boots: '#1f2224', skin: '#e3b48e', hat: 'beanie', hatColor: '#2c3e50', big: 1.06 },
  hettie: { coat: '#55603a', legs: '#4a4036', boots: '#2f4a2f', skin: '#f0c6a0', hat: 'bucket', hatColor: '#8a7a52' },
  kit: { coat: '#c43b2f', legs: '#3b5a8a', boots: '#e8e4da', skin: '#f3cba6', hat: 'cap', hatColor: '#2f6f74', scale: 0.7 },
  paco: { coat: '#f4f1ea', legs: '#2a2a2e', boots: '#1f1f22', skin: '#c99a72', hat: 'hair', hair: '#2a211c' },
};
// Dougie's boat: a little cabin boat like yours, but green, with a red stripe and her name.
export const MORNING_STAR = { name: 'Morning Star', paint: '#2f5d47', stripe: '#b8402f', bottom: '#5a2a22' };

const UP = new THREE.Vector3(0, 1, 0);
const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
const cast = (m) => {
  m.castShadow = true;
  return m;
};

class Figure {
  constructor(id) {
    const L = LOOKS[id];
    this.id = id;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.scale.setScalar(L.scale ?? L.big ?? 1);
    const coat = mat(L.coat), skin = mat(L.skin), legs = mat(L.legs), boots = mat(L.boots), dark = mat('#2b2522');
    this.body = new THREE.Group();
    this.group.add(this.body);
    const limb = new THREE.CylinderGeometry(1, 1, 1, 7).translate(0, -0.5, 0);
    // Legs: hip → knee → boot.
    this.legs = [1, -1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(s * 0.1, 0.9, 0);
      this.body.add(hip);
      const thigh = cast(new THREE.Mesh(limb, legs));
      thigh.scale.set(0.078, 0.45, 0.078);
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.45;
      hip.add(knee);
      const shin = cast(new THREE.Mesh(limb, legs));
      shin.scale.set(0.066, 0.42, 0.066);
      knee.add(shin);
      const boot = cast(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.22), boots));
      boot.position.set(0, -0.43, 0.04);
      knee.add(boot);
      return { hip, knee };
    });
    // The body: a coat (and an apron, or Dougie's oilskin bib), the head and what's on it.
    this.torso = new THREE.Group();
    this.torso.position.y = 0.92;
    this.body.add(this.torso);
    const chest = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.27, 4, 10), coat));
    chest.position.y = 0.28;
    chest.scale.set(1, 1, 0.82);
    this.torso.add(chest);
    if (L.apron || L.bib) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.3, L.apron ? 0.62 : 0.5, 0.03), mat(L.apron || L.bib));
      a.position.set(0, L.apron ? 0.1 : 0.2, 0.14);
      this.torso.add(a);
    }
    this.head = new THREE.Group();
    this.head.position.y = 0.67;
    this.torso.add(this.head);
    this.head.add(cast(new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 10), skin)));
    for (const s of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 4), dark);
      eye.position.set(s * 0.043, 0.015, 0.117);
      this.head.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.021, 6, 4), skin);
    nose.position.set(0, -0.015, 0.125);
    this.head.add(nose);
    this.head.add(this.hat(L));
    // Arms: shoulder → elbow → hand (a rolled sleeve shows the forearm).
    this.arms = [1, -1].map((s) => {
      const sh = new THREE.Group();
      sh.position.set(s * 0.215, 0.47, 0);
      this.torso.add(sh);
      const upper = cast(new THREE.Mesh(limb, coat));
      upper.scale.set(0.058, 0.3, 0.058);
      sh.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      sh.add(elbow);
      const fore = cast(new THREE.Mesh(limb, L.sleeves === 'rolled' ? skin : coat));
      fore.scale.set(0.05, 0.27, 0.05);
      elbow.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin);
      hand.position.y = -0.29;
      elbow.add(hand);
      return { sh, elbow, hand };
    });
    // A rod (for fishing) and a fish (to hold up), in the right hand; Kit's crab line.
    this.rod = new THREE.Group();
    const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, 2.8, 6).translate(0, 1.4, 0), mat('#3d3a36'));
    this.rodTip = new THREE.Group();
    this.rodTip.position.y = 2.8;
    this.rod.add(blank, this.rodTip);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 4).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: '#d9d4c8', transparent: true, opacity: 0.6 }));
    line.scale.y = 2.6;
    this.rodTip.add(line);
    this.rod.rotation.x = 2.56; // (out over the water, about 35° up, from the hand as the arm holds it)
    this.rod.visible = false;
    this.arms[0].hand.add(this.rod);
    this.fish = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat('#a8b4ba'));
    this.fish.scale.set(0.05, 0.035, 0.16);
    this.fish.position.set(-0.1, -0.05, 0.08);
    this.fish.visible = false;
    this.arms[0].hand.add(this.fish);
    this.phase = Math.random() * 6;
    this.yaw = 0;
    this.seat = 0;
    this.lastAct = '';
  }

  hat(L) {
    const g = new THREE.Group();
    const c = mat(L.hatColor || L.hair || '#333');
    if (L.hat === 'flatcap') {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.135, 0.06, 14), c);
      crown.position.y = 0.09;
      crown.scale.z = 1.12;
      const peak = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.1), c);
      peak.position.set(0, 0.075, 0.14);
      g.add(crown, peak);
    } else if (L.hat === 'beanie') {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), c);
      b.position.y = 0.02;
      b.scale.y = 1.15;
      g.add(b);
    } else if (L.hat === 'bucket') {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.135, 0.12, 14), c);
      crown.position.y = 0.13;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.02, 16), c);
      brim.position.y = 0.075;
      g.add(crown, brim);
    } else if (L.hat === 'cap') {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.132, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), c);
      crown.position.y = 0.03;
      const peak = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.12), c);
      peak.position.set(0, 0.04, 0.15);
      g.add(crown, peak);
    } else {
      // Hair: a cap of it, and a bun at the back (or short, for Paco).
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.132, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), c);
      hair.position.set(0, 0.012, -0.012);
      g.add(hair);
      if (L.hat === 'bun') {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), c);
        bun.position.set(0, 0.07, -0.12);
        g.add(bun);
      }
    }
    return g;
  }

  // Pose for what they're doing (see townsfolk.js), and where.
  update(dt, t, p, y) {
    const act = p.act;
    const L = LOOKS[this.id];
    this.group.visible = true;
    this.group.position.x = p.pos.x;
    this.group.position.z = p.pos.z;
    this.yaw = act === 'walk' ? dampAngle(this.yaw, p.yaw, 8, dt) : dampAngle(this.yaw, p.yaw, 3, dt);
    this.group.rotation.y = this.yaw;
    const walking = act === 'walk';
    if (walking) this.phase += dt * 5.2;
    const sw = walking ? Math.sin(this.phase) : 0;
    // Sitting: on a seat half a metre up, or on the quay's edge with the legs hanging over.
    const sitting = act === 'sit' || act === 'crab';
    this.seat = damp(this.seat, sitting ? 1 : 0, 6, dt);
    const s = this.seat;
    // (Hips down to the seat, half a metre up, or to the quay's deck: as far as their legs are long.)
    const sc = this.group.scale.y;
    this.group.position.y = y - s * (act === 'crab' ? 0.9 * sc - 0.03 : Math.max(0, 0.9 * sc - 0.47));
    const [lA, rA] = this.arms, [lL, rL] = this.legs;
    lL.hip.rotation.x = sw * 0.5 - 1.5 * s;
    rL.hip.rotation.x = -sw * 0.5 - 1.5 * s;
    lL.knee.rotation.x = Math.max(0, -sw) * 0.6 + 1.5 * s * (act === 'crab' ? 1.05 : 1);
    rL.knee.rotation.x = Math.max(0, sw) * 0.6 + 1.5 * s * (act === 'crab' ? 0.9 : 1);
    this.torso.rotation.x = (L.stoop ?? 0) + (act === 'work' ? 0.22 : 0) + (sitting ? -0.05 : 0);
    // A slow look about, now and then.
    this.head.rotation.y = act === 'stand' || act === 'sit' ? Math.sin(t * 0.3 + this.phase) * 0.45 : act === 'fish' ? Math.sin(t * 0.2 + this.phase) * 0.15 : 0;
    // Arms: swinging, busy, holding the rod or the line, or a fish held up to show.
    let ls = sw * -0.45, rs = sw * 0.45, le = 0.15, re = 0.15, lz = 0, rz = 0;
    if (act === 'work') {
      const k = Math.sin(t * 3.1 + this.phase);
      ls = -0.7 + k * 0.25;
      rs = -0.75 - k * 0.25;
      le = re = -0.9;
    } else if (act === 'fish') {
      rs = -0.85;
      re = -0.35;
      ls = -0.7;
      le = -0.9;
      lz = 0.1;
    } else if (act === 'crab') {
      rs = ls = -0.9;
      re = le = -0.5;
    } else if (act === 'lift') {
      rs = ls = -1.9;
      re = le = -0.4;
      lz = 0.3;
      rz = -0.3;
    } else if (sitting) {
      ls = rs = -0.35;
      le = re = -0.9;
    }
    lA.sh.rotation.set(ls, 0, 0.08 + lz);
    rA.sh.rotation.set(rs, 0, -0.08 + rz);
    lA.elbow.rotation.x = le;
    rA.elbow.rotation.x = re;
    this.rod.visible = act === 'fish';
    // (The rod tip nods as a fish takes the bait now and then.)
    if (act === 'fish') this.rod.rotation.x = 2.56 + Math.max(0, Math.sin(t * 0.7 + this.phase) - 0.9) * 2.5;
    this.fish.visible = act === 'lift';
  }
}

export class FolkView {
  constructor(scene) {
    this.figures = Object.fromEntries(FOLK_IDS.map((id) => [id, new Figure(id)]));
    for (const f of Object.values(this.figures)) scene.add(f.group);
    // Bert's chair by the chandlery door.
    const C = SPOTS.chair, cy = walkHeight(C.x, C.z);
    const wood = mat('#7a5638');
    this.chair = new THREE.Group();
    const seat = cast(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.44), wood));
    seat.position.y = 0.45;
    const back = cast(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.05), wood));
    back.position.set(0, 0.72, -0.2);
    this.chair.add(seat, back);
    for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), wood);
      leg.position.set(x, 0.225, z);
      this.chair.add(leg);
    }
    this.chair.position.set(C.x, cy, C.z - 0.08);
    this.chair.rotation.y = C.yaw;
    scene.add(this.chair);
    // The Morning Star, her skipper in his oilskins.
    this.boat = new Boat(scene, { kind: 'cabin', look: MORNING_STAR });
    this.boat.name = MORNING_STAR.name;
    const S = this.boat.selfMats;
    S[0].color.set(LOOKS.dougie.coat);
    S[2].color.set(LOOKS.dougie.hatColor);
    S[3].color.set(LOOKS.dougie.legs);
    S[4].color.set(LOOKS.dougie.boots);
    // A few pots stacked in her cockpit.
    const potMat = mat('#3f4f54');
    for (const [x, y, z] of [[0.24, 0.32, -1.05], [-0.24, 0.32, -1.1], [0, 0.62, -1.08]]) {
      const pot = cast(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.32), potMat));
      pot.position.set(x, y, z);
      this.boat.body.add(pot);
    }
    // His pot buoys off Gull Rock: an orange float and a little flag on a stick, riding the swell.
    const orange = mat('#e8742a'), flag = mat('#2a2d30');
    this.buoys = POTS.map((P) => {
      const g = new THREE.Group();
      const ball = cast(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), orange));
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 5), flag);
      stick.position.y = 0.55;
      const pennant = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.16, 0.24), flag);
      pennant.position.set(0, 1.0, 0.12);
      g.add(ball, stick, pennant);
      g.userData.at = P;
      scene.add(g);
      return g;
    });
    this.roll = 0;
    this.rippleT = 0;
  }

  // town: the Townsfolk; from: where you are (people far off aren't drawn); fx: for the boat's
  // wake (ripples, and the glow at night); south: you're at Las Brasas.
  update(dt, t, town, { from, south = false, fx = null, glow = null } = {}) {
    for (const id of FOLK_IDS) {
      const p = town.people[id], f = this.figures[id];
      const hidden = p.act === 'inside' || p.act === 'away' || p.act === 'aboard';
      const far = Math.hypot(p.pos.x - from.x, p.pos.z - from.z) > 260;
      if (hidden || far || (p.id === 'paco') !== south) {
        f.group.visible = false;
        continue;
      }
      f.update(dt, t, p, walkHeight(p.pos.x, p.pos.z));
    }
    for (const [i, g] of this.buoys.entries()) {
      const P = g.userData.at;
      g.visible = !south && Math.hypot(P.x - from.x, P.z - from.z) < 600;
      if (!g.visible) continue;
      g.position.set(P.x, waveHeight(P.x, P.z, t) + 0.05, P.z);
      g.rotation.z = Math.sin(t * 1.1 + i) * 0.12;
    }
    // The boat rides the swell where she is: bow up a little under way, rolling as she goes.
    const B = town.boat, b = this.boat;
    const show = !south && Math.hypot(B.x - from.x, B.z - from.z) < 1800;
    b.group.visible = show;
    if (!show) return;
    const fw = { x: Math.sin(B.heading), z: Math.cos(B.heading) };
    b.pos.set(B.x, 0, B.z);
    b.heading = B.heading;
    b.fwd.set(fw.x, 0, fw.z);
    b.right.set(-fw.z, 0, fw.x);
    b.vel.set(fw.x * B.speed, 0, fw.z * B.speed);
    b.forwardSpeed = B.speed;
    const H = b.hull, w = waveHeight(B.x, B.z, t);
    const fore = waveHeight(B.x + fw.x * H.L * 0.4, B.z + fw.z * H.L * 0.4, t), aft = waveHeight(B.x - fw.x * H.L * 0.4, B.z - fw.z * H.L * 0.4, t);
    b.group.position.set(B.x, w - H.draft + 0.05, B.z);
    b.group.rotation.y = B.heading;
    b.body.rotation.x = clamp(Math.atan2(aft - fore, H.L * 0.8) - Math.min(0.08, B.speed * 0.012), -0.3, 0.3);
    this.roll = damp(this.roll, Math.sin(t * 0.9) * 0.05 + (B.hauling ? 0.06 : 0), 2, dt);
    b.body.rotation.z = this.roll;
    if (b.occupied !== B.aboard) b.setRower(B.aboard);
    if (b.rod) b.rod.visible = false;
    b.animate(dt, t, B.speed > 0.3 ? 0.7 : 0, 0, 0);
    b.group.updateMatrixWorld(true);
    // A wake of ripples behind her under way (glowing after dark, on a glowing night).
    if (fx && B.speed > 0.5) {
      this.rippleT -= dt;
      if (this.rippleT <= 0) {
        this.rippleT = 0.18;
        fx.ripple(B.x - fw.x * H.L * 0.5, B.z - fw.z * H.L * 0.5, 1.2 + B.speed * 0.25, 1.8, 0.5);
        glow?.spawn(B.x - fw.x * H.L * 0.5, B.z - fw.z * H.L * 0.5, 6, 0.8, 1, t);
      }
    }
  }
}
