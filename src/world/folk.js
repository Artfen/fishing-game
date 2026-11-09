import * as THREE from 'three';
import { walkHeight, solidHeight } from './terrain.js';
import { waveHeight } from './water.js';
import { Boat, floatDraft, wakeOf } from '../boat.js';
import { wakes } from './wakes.js';
import { damp, dampAngle, clamp, smoothstep, wrapAngle } from '../util.js';
import { FOLK, FOLK_IDS, SPOTS, POTS } from '../townsfolk.js';
import { Skipper } from './skipper.js';
import { berthFor } from '../mooring.js';

// How the harbour's people look, and the Morning Star (Dougie's boat), drawn where townsfolk.js
// says they are: walking (legs and arms swinging), standing about, sitting (on the bench, Bert's
// chair, or the edge of the quay with his legs over, in Kit's case), busy with their hands, fishing
// (a rod out, its tip nodding now and then), or holding up a fish they've just had. All of it made
// here from simple shapes, the same way as you.
//
// And how they move (Figure.update): a walk paced to how fast they're really going (a stride every
// metre and a half or so, no feet sliding), rising and falling over each step, the hips swaying
// to the foot that's down and the shoulders turning against them, the arms swinging from the
// elbow; stood about, breathing, shifting their weight from foot to foot, hands in their pockets
// or behind their back or arms folded, each in their own way, and stepping round when they turn;
// a lean forward to sit down or get up. Their work is their own: Ruth sweeping the step with a
// broom, Mags gutting at the slab, Dougie crouched over a pot with his netting needle, Ruth wiping
// down the bar. Walking to a job they carry what it needs: a rod and a bucket, a fish box, a pot.
// You they notice: a look your way when you come near, a wave the first time in a while, and
// stood about they turn to you. Two of them stood together talk, turn and turn about, hands going.

const LOOKS = {
  mags: { coat: '#6d7378', legs: '#3b3f46', boots: '#2d2a28', apron: '#2e5f8a', skin: '#efc39d', hat: 'bun', hair: '#a9a59e', sleeves: 'rolled', idle: 'folded' },
  bert: { coat: '#7a6a4f', legs: '#3b3b3b', boots: '#3a2b20', skin: '#e9bf9a', hat: 'flatcap', hatColor: '#4a4a48', stoop: 0.14, idle: 'behind' },
  ruth: { coat: '#7b2e3b', legs: '#2f2a2c', boots: '#2d2a28', apron: '#efe9dc', skin: '#f1c7a1', hat: 'bun', hair: '#8a4a2a', idle: 'hips' },
  dougie: { coat: '#2b3a55', bib: '#e2662a', legs: '#e2662a', boots: '#1f2224', skin: '#e3b48e', hat: 'beanie', hatColor: '#2c3e50', big: 1.06, idle: 'pockets' },
  hettie: { coat: '#55603a', legs: '#4a4036', boots: '#2f4a2f', skin: '#f0c6a0', hat: 'bucket', hatColor: '#8a7a52', idle: 'behind' },
  kit: { coat: '#c43b2f', legs: '#3b5a8a', boots: '#e8e4da', skin: '#f3cba6', hat: 'cap', hatColor: '#2f6f74', scale: 0.7, idle: 'pockets' },
  paco: { coat: '#f4f1ea', legs: '#2a2a2e', boots: '#1f1f22', skin: '#c99a72', hat: 'hair', hair: '#2a211c', idle: 'folded' },
  ian: { coat: '#3d5a7a', legs: '#5b5a50', boots: '#3a2b20', skin: '#efc6a2', hat: 'flatcap', hatColor: '#6b6152', stoop: 0.06, idle: 'behind' },
  chano: { coat: '#e9e2d0', legs: '#2f4a6a', boots: '#3a2e26', skin: '#b98863', hat: 'bucket', hatColor: '#d8c38a', sleeves: 'rolled', idle: 'pockets' },
  wenna: { coat: '#24435a', legs: '#2f3236', boots: '#2a2a2a', skin: '#f0c6a0', hat: 'cap', hatColor: '#1f3a44', hair: '#5a3a28', idle: 'behind' },
  // (Skippers seen only at the helm: the Sea Wren's, the Halcyon's, and the two kayakers.)
  tam: { coat: '#d9472b', legs: '#2f3a4a', boots: '#2a2a2a', skin: '#e3b48e', hatColor: '#2c3e50' },
  halcyon: { coat: '#f2efe6', legs: '#3a3f46', boots: '#2a2a2a', skin: '#efc6a2', hatColor: '#f2efe6' },
  pad1: { coat: '#e8b820', legs: '#2f3a4a', boots: '#2a2a2a', skin: '#c99a72', hatColor: '#e8742a' },
  pad2: { coat: '#3a8fc4', legs: '#3b3b3b', boots: '#2a2a2a', skin: '#f1c7a1', hatColor: '#e8e4da' },
  // (The Puffin's skipper, at the helm: never ashore, so no figure of their own.)
  puffin: { coat: '#c8452f', legs: '#2f3a4a', boots: '#2a2a2a', skin: '#efc6a2', hatColor: '#2f3a4a' },
};
// Dougie's boat: a little cabin boat like yours, but green, with a red stripe and her name.
export const MORNING_STAR = { name: 'Morning Star', paint: '#2f5d47', stripe: '#b8402f', bottom: '#5a2a22' };
// The other boats, each painted her own way, and who's at her helm.
const BOAT_LOOKS = {
  jean: { kind: 'skiff', skipper: 'ian', rod: 'spin', look: { name: 'Bonny Jean', paint: '#e6dcc0', stripe: '#2f6f74', bottom: '#7a3a2a' } },
  carmen: { kind: 'skiff', skipper: 'chano', rod: 'float', look: { name: 'Virgen del Carmen', paint: '#f4f1ea', stripe: '#2c5d8a', bottom: '#b8423a' } },
  puffin: { kind: 'sail', skipper: 'puffin', look: { name: 'Puffin', paint: '#7a2430', stripe: '#efe6cf', bottom: '#2a2f36' } },
  // The marina's: locals' boats on their berths, the charter, the visiting yacht, two kayaks.
  bluebell: { kind: 'cabin', look: { name: 'Bluebell', paint: '#e9e4d6', stripe: '#3d5a9a', bottom: '#7a3a2a' } },
  tern: { kind: 'skiff', look: { name: 'Tern', paint: '#cfd8d6', stripe: '#2a2f36', bottom: '#5a2a22' } },
  marigold: { kind: 'sail', look: { name: 'Marigold', paint: '#f0e6c8', stripe: '#c46a2a', bottom: '#2f4d63' } },
  ladyellen: { kind: 'cruiser', look: { name: 'Lady Ellen', paint: '#f5f3ec', stripe: '#6a2430', bottom: '#2a3442' } },
  osprey: { kind: 'console', look: { name: 'Osprey', paint: '#e8ece9', stripe: '#2f6f74', bottom: '#d9dedd' } },
  wren: { kind: 'console', skipper: 'tam', rod: 'spin', look: { name: 'Sea Wren', paint: '#f2f1ec', stripe: '#d9472b', bottom: '#2c3e50' } },
  halcyon: { kind: 'cruiser', skipper: 'halcyon', look: { name: 'Halcyon', paint: '#eef0f2', stripe: '#1f3a6a', bottom: '#20262c' } },
  kay1: { kind: 'kayak', skipper: 'pad1', look: { name: 'kayak', paint: '#e8b820', stripe: '#e8742a', bottom: '#c45a1c' } },
  kay2: { kind: 'kayak', skipper: 'pad2', look: { name: 'kayak', paint: '#3fae5c', stripe: '#f3d36b', bottom: '#2f7a40' } },
};

const UP = new THREE.Vector3(0, 1, 0);
const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
const cast = (m) => {
  m.castShadow = true;
  return m;
};

// (Exported for the friends you play with, each in a look of their own: see visitors.js.)
export class Figure {
  constructor(id, look = LOOKS[id]) {
    const L = look;
    this.id = id;
    this.look = L;
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
    // How they're moving (see update): how fast they're really going (from where they were last
    // frame), how far into a stride, where their weight is and where it's going, a look your way,
    // a wave, stepping round on the spot, and what's in their hands.
    this.last = null;
    this.speed = 0;
    this.walkK = 0;
    this.weight = 0;
    this.weightTo = 0;
    this.weightT = 2 + Math.random() * 4;
    this.gaze = 0;
    this.lookK = 0;
    this.near = false;
    this.waveT = 0;
    this.waved = -999;
    this.turnPh = 0;
    this.turnK = 0;
    this.talkK = 0;
    this.props = null;
  }

  // What they might have in their hands, made the first time it's wanted: a broom, a gutting
  // knife, a netting needle, a fish box, a bucket, a lobster pot.
  prop(name) {
    this.props ||= {};
    if (this.props[name]) return this.props[name];
    const wood = mat('#8a6a46'), steel = mat('#c9ced2'), blue = mat('#2f6f9a'), pot = mat('#3f4f54');
    let g = new THREE.Group();
    if (name === 'broom') {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.3, 6), wood);
      stick.position.y = -0.2;
      const head = cast(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.09), mat('#5a4a36')));
      head.position.y = -0.86;
      const bristle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.07), mat('#c8a86a'));
      bristle.position.y = -0.92;
      g.add(stick, head, bristle);
      // (Held in front, slanting down to the ground ahead of them; it sweeps as they turn.)
      g.position.set(0, 0.25, 0.32);
      g.rotation.x = -0.5;
      this.torso.add(g);
    } else if (name === 'knife') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.03), steel);
      blade.position.y = -0.1;
      g.add(blade);
      this.arms[1].hand.add(g);
    } else if (name === 'needle') {
      const n = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.008), mat('#d8c890'));
      n.position.y = -0.06;
      g.add(n);
      this.arms[1].hand.add(g);
    } else if (name === 'box') {
      const box = cast(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.3), blue));
      g.add(box);
      g.position.set(0, -0.05, 0.3);
      this.torso.add(g);
    } else if (name === 'bucket') {
      const b = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.22, 10, 1, true), mat('#d8d4c8')));
      b.position.y = -0.17;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 4, 10, Math.PI), steel);
      handle.position.y = -0.06;
      g.add(b, handle);
      this.arms[1].hand.add(g);
    } else if (name === 'pot') {
      const box = cast(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.32), pot));
      box.position.set(0.12, -0.12, 0);
      g.add(box);
      this.arms[0].hand.add(g);
    }
    g.visible = false;
    return (this.props[name] = g);
  }

  showProps(want) {
    if (!this.props && !want.length) return;
    for (const n of want) this.prop(n).visible = true;
    for (const [n, g] of Object.entries(this.props || {})) if (!want.includes(n)) g.visible = false;
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

  // Gone for good (a passenger ashore, a castaway picked up): out of the scene, and the shapes and
  // colours made for them alone given back to the graphics card.
  dispose() {
    this.group.removeFromParent();
    const done = new Set();
    this.group.traverse((o) => {
      for (const x of [o.geometry, ...(Array.isArray(o.material) ? o.material : [o.material])]) {
        if (x && !done.has(x)) {
          done.add(x);
          x.dispose();
        }
      }
    });
  }

  // Pose for what they're doing (see townsfolk.js), and where. env (all optional): from (where you
  // are: they look at you, and wave), chat ({ yaw, talking }: stood with someone, facing them).
  update(dt, t, p, y, env = {}) {
    const act = p.act;
    const L = this.look;
    const sc = this.group.scale.y;
    this.group.visible = true;
    this.group.position.x = p.pos.x;
    this.group.position.z = p.pos.z;
    // How fast they're really going (a jump of more than a few metres is the clock skipping on:
    // no stride for that).
    if (this.last && dt > 0) {
      const d = Math.hypot(p.pos.x - this.last.x, p.pos.z - this.last.z);
      if (d < 3) this.speed = damp(this.speed, Math.min(4, d / dt), 6, dt);
    }
    this.last = { x: p.pos.x, z: p.pos.z };
    const walking = act === 'walk' && this.speed > 0.08;
    this.walkK = damp(this.walkK, walking ? smoothstep(0.08, 0.7, this.speed) : 0, 7, dt);
    const w = this.walkK;
    // Which way they face: where they're going, a friend they're talking to, or you if you've
    // stopped by them.
    const from = env.from, dx = from ? from.x - p.pos.x : 0, dz = from ? from.z - p.pos.z : 0, dist = from ? Math.hypot(dx, dz) : 99;
    const free = act === 'stand' && !env.chat;
    let want = p.yaw;
    if (env.chat && act === 'stand') want = env.chat.yaw;
    else if (free && dist < 2.8) want = Math.atan2(dx, dz);
    const before = this.yaw;
    this.yaw = act === 'walk' ? dampAngle(this.yaw, p.yaw, 8, dt) : dampAngle(this.yaw, want, 3, dt);
    this.group.rotation.y = this.yaw;
    // (Turning on the spot, they step round.)
    const turn = Math.abs(wrapAngle(this.yaw - before)) / Math.max(dt, 1e-3);
    this.turnK = damp(this.turnK, act !== 'walk' && act !== 'sit' && act !== 'crab' && turn > 0.25 ? 1 : 0, 8, dt);
    this.turnPh += turn * dt * 3.2;
    // The stride: paced to the ground covered, about one full stride (two steps) every 1.4 m.
    if (walking) this.phase += (dt * this.speed * Math.PI * 2) / (1.4 * sc);
    const ph = this.phase, fL = Math.sin(ph), swingL = Math.cos(ph);
    // Sitting: on a seat half a metre up, or on the quay's edge with the legs hanging over.
    const sitting = act === 'sit' || act === 'crab';
    const sPrev = this.seat;
    this.seat = damp(this.seat, sitting ? 1 : 0, 4, dt);
    const s = this.seat, sitting2 = Math.abs(this.seat - sPrev) > 1e-4;
    // (Hips down to the seat, half a metre up, or to the quay's deck: as far as their legs are long.)
    let yOff = -s * (act === 'crab' ? 0.9 * sc - 0.03 : Math.max(0, 0.9 * sc - 0.47));
    // Their weight, from foot to foot now and then, stood about.
    this.weightT -= dt;
    if (this.weightT <= 0) {
      this.weightT = 3 + Math.random() * 6;
      this.weightTo = [-1, 0, 1, 1, -1][(Math.random() * 5) | 0];
    }
    const still = (1 - w) * (1 - s);
    this.weight = damp(this.weight, this.weightTo * still, 1.6, dt);
    const wt = this.weight;
    // Breathing.
    const breath = Math.sin(t * 1.65 + this.phase * 0.37);
    // Jobs, by where they are.
    const spot = p.block?.spot;
    const job = act !== 'work' ? null : spot === 'innFront' ? 'sweep' : spot === 'slab' ? 'gut' : spot === 'pots' ? 'mend' : spot === 'innBar' ? 'wipe' : 'busy';
    // Walking to a job, what it needs: a rod and a bucket to fish, the fish box to the slab, a pot
    // down to the boat.
    const bound = act === 'walk' ? p.block : null;
    const carry = !bound ? null : bound.act === 'fish' ? 'rod' : bound.spot === 'slab' ? 'box' : bound.spot === 'pots' || (bound.sea && this.id === 'dougie') ? 'pot' : bound.spot === 'innFront' ? 'broom' : null;
    const crouch = job === 'mend' ? 1 : 0;
    this.crouch = damp(this.crouch ?? 0, crouch, 3, dt);
    const cr = this.crouch;
    yOff -= cr * 0.32 * sc;
    // The walk: up over each step and down between (highest as the legs pass), the hips swaying
    // to the foot that's down.
    yOff += w * 0.045 * (0.5 - Math.abs(fL)) * sc * (1 + Math.min(1, this.speed / 2.6) * 0.8);
    this.group.position.y = y + yOff;
    this.body.position.x = w * -swingL * 0.018 + wt * 0.03;
    this.body.rotation.z = w * swingL * 0.03 - wt * 0.025;
    this.body.rotation.y = w * -fL * 0.08;
    const [lA, rA] = this.arms, [lL, rL] = this.legs;
    // Legs: forward and back from the hip, the knee bending as each swings through; stood, the
    // knee of the foot carrying less weight a little bent; stepping round on the spot.
    // (Running: a longer, higher stride, the arms bent and pumping, leaning into it.)
    const run = smoothstep(1.8, 2.6, this.speed) * w;
    const A = 0.52 * w * (1 + 0.45 * run), K = 0.85 * w * (1 + 0.7 * run);
    const tp = this.turnPh, tk = this.turnK * 0.35;
    lL.hip.rotation.x = -fL * A - 1.5 * s - 1.25 * cr + Math.max(0, Math.sin(tp)) * -tk;
    rL.hip.rotation.x = fL * A - 1.5 * s - 1.05 * cr + Math.max(0, -Math.sin(tp)) * -tk;
    lL.knee.rotation.x = Math.max(0, swingL) * K + 0.06 * w + 1.5 * s * (act === 'crab' ? 1.05 : 1) + Math.max(0, wt) * 0.16 + 2.1 * cr + Math.max(0, Math.sin(tp)) * tk * 1.6;
    rL.knee.rotation.x = Math.max(0, -swingL) * K + 0.06 * w + 1.5 * s * (act === 'crab' ? 0.9 : 1) + Math.max(0, -wt) * 0.16 + 1.7 * cr + Math.max(0, -Math.sin(tp)) * tk * 1.6;
    lL.hip.rotation.z = 0.02 * still;
    rL.hip.rotation.z = -0.02 * still;
    // The body: the shoulders turning against the hips as they walk, leaning a little into it, a
    // stoop, bent to a job, leaning forward as they sit down or get up, breathing.
    const rising = sitting2 ? Math.sin(Math.PI * clamp(this.seat, 0, 1)) * 0.45 : 0;
    this.torso.position.y = 0.92 + breath * 0.004 * (1 - w);
    this.torso.rotation.x = (L.stoop ?? 0) + w * 0.06 + smoothstep(1.8, 2.6, this.speed) * w * 0.14 + (job === 'busy' ? 0.22 : job === 'gut' ? 0.32 : job === 'sweep' ? 0.18 : job === 'wipe' ? 0.2 : 0) + cr * 0.5 + (sitting ? -0.05 : 0) + rising + breath * 0.008 * (1 - w);
    let ty = w * fL * 0.16;
    if (job === 'sweep') ty += Math.sin(t * 2.4 + this.phase) * 0.35;
    // You, near: a look your way (the head mostly, the shoulders a little), and a wave the first
    // time in a while you come within a few metres.
    const canLook = from && dist < 8 && act !== 'inside' && !(job && job !== 'busy' && Math.sin(t * 0.4 + this.phase) < 0.6);
    const toYou = canLook ? clamp(wrapAngle(Math.atan2(dx, dz) - this.yaw), -1.3, 1.3) : 0;
    this.lookK = damp(this.lookK, canLook && Math.abs(toYou) < 1.25 ? 1 : 0, 3, dt);
    this.gaze = damp(this.gaze, toYou, 4, dt);
    const near = dist < 5;
    if (near && !this.near && t - this.waved > 75 && act !== 'lift') {
      this.waveT = 1.7;
      this.waved = t;
    }
    this.near = near;
    this.waveT = Math.max(0, this.waveT - dt);
    const waving = this.waveT > 0 ? Math.sin(Math.PI * Math.min(1, this.waveT / 1.7)) : 0;
    // Talking with someone (chat.talking: their turn), or listening (a nod now and then).
    this.talkK = damp(this.talkK, env.chat?.talking ? 1 : 0, 4, dt);
    const talk = this.talkK;
    this.torso.rotation.y = ty + this.gaze * this.lookK * 0.28;
    this.torso.rotation.z = -wt * 0.02;
    // A slow look about, now and then; your way when you're near; a nod as they listen.
    const about = act === 'stand' || act === 'sit' ? Math.sin(t * 0.3 + this.phase) * 0.45 : act === 'fish' ? Math.sin(t * 0.2 + this.phase) * 0.15 : 0;
    this.head.rotation.y = damp(this.head.rotation.y, env.chat ? Math.sin(t * 0.5 + this.phase) * 0.12 : this.lookK > 0.05 ? this.gaze * 0.72 : about * (1 - w) - ty * 0.6, 4, dt);
    this.head.rotation.x = (env.chat && !env.chat.talking ? Math.max(0, Math.sin(t * 2.2 + this.phase) - 0.7) * 0.5 : 0) + (job === 'gut' || job === 'mend' ? 0.35 : 0) + talk * Math.sin(t * 3.1) * 0.05;
    // Arms: swinging from the shoulder as they walk (the elbow bending as each comes forward),
    // stood about in their own way, at their job, with what they carry, holding the rod or the
    // line, or a fish held up to show.
    let ls = fL * 0.42 * w, rs = -fL * 0.42 * w;
    let le = -(0.18 + 0.4 * Math.max(0, -fL)) * w, re = -(0.18 + 0.4 * Math.max(0, fL)) * w;
    {
      const run = smoothstep(1.8, 2.6, this.speed) * w;
      ls *= 1 + 0.5 * run;
      rs *= 1 + 0.5 * run;
      le -= run * 1.1;
      re -= run * 1.1;
    }
    let lz = 0, rz = 0, lez = 0, rez = 0;
    // (Stood about: hands in pockets, behind the back, arms folded, hands on hips.)
    const idle = still * (act === 'stand' && !talk ? 1 : 0);
    if (idle > 0.01) {
      const st = L.idle || 'pockets';
      const pose = st === 'behind' ? [0.45, -1.1, -0.18] : st === 'folded' ? [-0.62, -1.95, 0.32] : st === 'hips' ? [0.12, -1.35, 0.55] : [0.12, -0.42, 0.06];
      ls = ls * (1 - idle) + pose[0] * idle;
      rs = rs * (1 - idle) + pose[0] * idle;
      le = le * (1 - idle) + pose[1] * idle;
      re = re * (1 - idle) + pose[1] * idle;
      lz = lz * (1 - idle) + (st === 'folded' ? -pose[2] : pose[2]) * idle;
      rz = rz * (1 - idle) - (st === 'folded' ? -pose[2] : pose[2]) * idle;
    }
    if (act === 'work') {
      const k = Math.sin(t * 3.1 + this.phase);
      if (job === 'sweep') {
        ls = -0.75;
        rs = -0.55;
        le = -0.7;
        re = -1.05;
        lz = -0.25;
        rz = 0.25;
      } else if (job === 'gut') {
        // (Left hand steadying the fish, the right working the knife.)
        const c = Math.sin(t * 7.5 + this.phase);
        ls = -0.85;
        le = -1.0;
        rs = -0.75 + c * 0.12;
        re = -1.05 - Math.max(0, c) * 0.4;
        lz = -0.15;
      } else if (job === 'mend') {
        // (Crouched over the pot, the needle going in and through.)
        const c = Math.sin(t * 2.6 + this.phase);
        ls = -0.95;
        le = -0.55;
        rs = -0.9 - c * 0.18;
        re = -0.6 + c * 0.25;
        lz = -0.2;
        rz = 0.15 + c * 0.1;
      } else if (job === 'wipe') {
        // (Wiping down the bar: a slow round and round.)
        rs = -0.95 + Math.cos(t * 3.4) * 0.12;
        rz = Math.sin(t * 3.4) * 0.18;
        re = -0.75;
        ls = -0.5;
        le = -1.2;
      } else {
        ls = -0.7 + k * 0.25;
        rs = -0.75 - k * 0.25;
        le = re = -0.9;
      }
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
    // Carrying: the box in both hands before them; the rod in one hand, tip up; a pot at their
    // side; the broom over the shoulder; the bucket swinging.
    if (carry === 'box') {
      ls = rs = -0.55;
      le = re = -0.95;
      lz = -0.12;
      rz = 0.12;
    } else if (carry === 'rod') {
      ls = -0.55 + fL * 0.08 * w;
      le = -0.9;
    } else if (carry === 'pot') {
      ls = 0.05;
      le = -0.25;
      lz = 0.28;
    } else if (carry === 'broom') {
      rs = -0.7;
      re = -1.1;
    }
    // Talking: the hands going, turn and turn about.
    if (talk > 0.01 && !carry) {
      const g1 = Math.sin(t * 2.7 + this.phase), g2 = Math.sin(t * 1.9 + this.phase * 1.3);
      rs = rs * (1 - talk) + (-0.55 + g1 * 0.22) * talk;
      re = re * (1 - talk) + (-1.15 + g2 * 0.3) * talk;
      ls = ls * (1 - talk) + (-0.3 + g2 * 0.12) * talk;
      le = le * (1 - talk) + (-0.9 + g1 * 0.2) * talk;
      rz = rz * (1 - talk) + 0.12 * talk;
    }
    // The wave: the right hand up and the forearm going side to side.
    if (waving > 0.01) {
      rs = rs * (1 - waving) + (sitting ? -1.9 : -2.6) * waving;
      rz = rz * (1 - waving) - 0.35 * waving;
      re = re * (1 - waving) - 0.35 * waving;
      rez = Math.sin(t * 9) * 0.5 * waving;
    }
    lA.sh.rotation.set(ls, 0, 0.08 + lz);
    rA.sh.rotation.set(rs, 0, -0.08 + rz);
    lA.elbow.rotation.set(le, 0, lez);
    rA.elbow.rotation.set(re, 0, rez);
    this.rod.visible = act === 'fish' || carry === 'rod';
    // (The rod tip nods as a fish takes the bait now and then; carried, it's held up and back.)
    if (act === 'fish') this.rod.rotation.x = 2.56 + Math.max(0, Math.sin(t * 0.7 + this.phase) - 0.9) * 2.5;
    else if (carry === 'rod') this.rod.rotation.x = 1.25;
    this.fish.visible = act === 'lift';
    this.showProps([
      ...(job === 'sweep' || carry === 'broom' ? ['broom'] : []),
      ...(job === 'gut' ? ['knife'] : []),
      ...(job === 'mend' ? ['needle'] : []),
      ...(carry === 'box' ? ['box'] : []),
      ...(carry === 'rod' ? ['bucket'] : []),
      ...(carry === 'pot' ? ['pot'] : []),
    ]);
    // (The broom over the shoulder while walking; down to the ground, sweeping.)
    if (this.props?.broom) {
      const B = this.props.broom;
      if (carry === 'broom') {
        B.position.set(-0.2, 0.62, -0.05);
        B.rotation.set(-2.5, 0, 0.3);
      } else {
        B.position.set(0, 0.25, 0.32);
        B.rotation.set(-0.5, 0, 0);
      }
    }
    // (A bucket hangs straight down from the hand, whatever the arm's doing.)
    if (this.props?.bucket?.visible) this.props.bucket.rotation.x = -(rs + re + this.torso.rotation.x);
  }
}

// Who's talking to whom: two people stood (or sat) within a few strides of each other pass the
// time of day, facing each other, turn and turn about (a few seconds each). people: [{ id, act,
// pos }]. Returns id → { yaw (towards the other), talking (their turn), with }.
export function chatPairs(people, t) {
  const out = new Map(), idle = people.filter((p) => p.act === 'stand' || p.act === 'sit');
  for (let i = 0; i < idle.length; i++) {
    const a = idle[i];
    if (out.has(a.id)) continue;
    let best = null, bd = 3;
    for (let j = i + 1; j < idle.length; j++) {
      const b = idle[j];
      if (out.has(b.id)) continue;
      const d = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (!best) continue;
    // (Whose turn: the pair's own rhythm, a few seconds each, so they don't all talk in step.)
    const seed = (a.id.length * 7 + best.id.length * 3) % 5, turn = Math.floor((t + seed) / 4.2) % 2;
    out.set(a.id, { yaw: Math.atan2(best.pos.x - a.pos.x, best.pos.z - a.pos.z), talking: turn === 0, with: best.id });
    out.set(best.id, { yaw: Math.atan2(a.pos.x - best.pos.x, a.pos.z - best.pos.z), talking: turn === 1, with: a.id });
  }
  return out;
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
    // The table and chairs outside Bar El Muelle, where Chano sits of an afternoon.
    {
      const T = SPOTS.barTable, ty = walkHeight(T.x, T.z), white = mat('#eeeeea');
      this.terrace = new THREE.Group();
      const top = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 16), white));
      top.position.set(-0.75, 0.72, 0);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.72, 8), white);
      stem.position.set(-0.75, 0.36, 0);
      this.terrace.add(top, stem);
      for (const [x, z, yaw] of [[0, 0, -Math.PI / 2], [-1.5, 0.1, Math.PI / 2]]) {
        const c = new THREE.Group();
        const seat = cast(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), white));
        seat.position.y = 0.45;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.04), white);
        back.position.set(0, 0.68, -0.2);
        c.add(seat, back);
        for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.03), white);
          leg.position.set(lx, 0.225, lz);
          c.add(leg);
        }
        c.position.set(x, 0, z - 0.08);
        c.rotation.y = yaw;
        this.terrace.add(c);
      }
      this.terrace.position.set(T.x, ty, T.z);
      this.terrace.rotation.y = T.yaw + Math.PI / 2;
      this.terrace.visible = false;
      scene.add(this.terrace);
    }
    // The other boats.
    this.boats = { star: this.boat };
    for (const [id, D] of Object.entries(BOAT_LOOKS)) {
      const b = new Boat(scene, { kind: D.kind, look: D.look });
      b.name = D.look.name;
      const L = LOOKS[D.skipper], M = b.selfMats;
      if (L) {
        M[0].color.set(L.coat);
        M[2].color.set(L.hatColor || L.hair || '#333');
        M[3].color.set(L.legs);
        M[4].color.set(L.boots);
      }
      if (D.rod) b.setRod(D.rod);
      b.group.visible = false;
      this.boats[id] = b;
    }
    this.roll = {};
    this.rippleT = {};
    // Each boat's skipper: the clock says where she should be; they take her there, keeping
    // clear of every other boat on the way (see skipper.js).
    this.skippers = {};
    for (const [id, b] of Object.entries(this.boats)) {
      const k = (this.skippers[id] = new Skipper(b.hull.L, b.hull.B, b.hull.draft));
      k.m = wakeOf(b.base).mass;
    }
    this._others = [];
  }

  // The boats the harbour's skippers keep clear of: yours (boats: Boat[]), friends' (more), and
  // each other.
  obstacles(boats = [], more = []) {
    const O = this._others;
    O.length = 0;
    const add = (b, fixed) => {
      if (!b?.group?.visible) return;
      O.push({ x: b.pos.x, z: b.pos.z, heading: b.heading, L: b.hull.L, B: b.hull.B, vx: b.vel.x, vz: b.vel.z, m: b._phys?.m ?? 600, fixed, boat: b });
    };
    // (Yours lying still a long way off aren't being worked out: they won't give, so the
    // harbour's boats go round them entirely.)
    for (const b of boats) add(b, !!b._resting);
    for (const b of more) add(b, true);
    return O;
  }

  // town: the Townsfolk; from: where you are (people far off aren't drawn); fx: for the boats'
  // wakes (ripples, and the glow at night); south: you're at Las Brasas; night (0 … 1): the
  // Puffin's anchor light.
  // boats: yours (and more: friends'), for the skippers to keep clear of.
  update(dt, t, town, { from, south = false, fx = null, glow = null, night = 0, boats = [], more = [] } = {}) {
    const shown = [];
    for (const id of FOLK_IDS) {
      const p = town.people[id], f = this.figures[id];
      const hidden = p.act === 'inside' || p.act === 'away' || p.act === 'aboard';
      const far = Math.hypot(p.pos.x - from.x, p.pos.z - from.z) > 260;
      if (hidden || far || !!FOLK[p.id].south !== south) {
        f.group.visible = false;
        continue;
      }
      shown.push(p);
    }
    const chats = chatPairs(shown, t);
    for (const p of shown) this.figures[p.id].update(dt, t, p, walkHeight(p.pos.x, p.pos.z), { from, chat: chats.get(p.id) });
    this.terrace.visible = south && Math.hypot(SPOTS.barTable.x - from.x, SPOTS.barTable.z - from.z) < 260;
    for (const [i, g] of this.buoys.entries()) {
      const P = g.userData.at;
      g.visible = !south && Math.hypot(P.x - from.x, P.z - from.z) < 600;
      if (!g.visible) continue;
      g.position.set(P.x, waveHeight(P.x, P.z, t) + 0.05, P.z);
      g.rotation.z = Math.sin(t * 1.1 + i) * 0.12;
    }
    const others = this.obstacles(boats, more), n0 = others.length;
    // (Each skipper keeps clear of the others' boats too, as they are this frame.)
    for (const id of Object.keys(this.boats)) {
      const B = town.boats[id], k = this.skippers[id];
      if (!!B.south === south && B.present !== false && k.on) others.push({ x: k.x, z: k.z, heading: k.heading, L: k.L, B: k.B, vx: k.vx, vz: k.vz, m: k.m, fixed: false, id });
    }
    for (const id of Object.keys(this.boats)) {
      const B = town.boats[id], k = this.skippers[id];
      const d = Math.hypot(B.x - from.x, B.z - from.z);
      const show = !!B.south === south && B.present !== false && d < 1800;
      if (show) {
        // (Not herself.)
        const mine = others.findIndex((o, i) => i >= n0 && o.id === id);
        const me = mine >= 0 ? others.splice(mine, 1)[0] : null;
        k.step(dt, B, others, solidHeight, d < 400);
        if (me) {
          Object.assign(me, { x: k.x, z: k.z, heading: k.heading, vx: k.vx, vz: k.vz });
          others.splice(mine, 0, me);
        }
      } else k.on = false;
      this.drawBoat(id, B, show, dt, t, { fx, glow, night });
    }
  }

  // A boat rides the swell where she is: bow up a little under way, rolling as she goes; her
  // skipper aboard (or not), fishing, or under sail.
  drawBoat(id, B, show, dt, t, { fx, glow, night }) {
    const b = this.boats[id];
    b.group.visible = show;
    if (!show) return;
    // (Where her skipper has her: the clock's place for her, give or take the boats in her way.)
    const k = this.skippers[id], x = k.x, z = k.z, heading = k.heading, speed = k.speed;
    const fw = { x: Math.sin(heading), z: Math.cos(heading) };
    b.pos.set(x, 0, z);
    b.heading = heading;
    b.fwd.set(fw.x, 0, fw.z);
    b.right.set(-fw.z, 0, fw.x);
    b.vel.set(k.vx, 0, k.vz);
    b.forwardSpeed = speed;
    const H = b.hull, w = waveHeight(x, z, t);
    const fore = waveHeight(x + fw.x * H.L * 0.4, z + fw.z * H.L * 0.4, t), aft = waveHeight(x - fw.x * H.L * 0.4, z - fw.z * H.L * 0.4, t);
    b.group.position.set(x, w - floatDraft(b.base), z);
    // (Under way, she leaves a wake like any boat: it rocks yours as it passes.)
    const wk = (b._wake ||= wakeOf(b.base));
    wakes.trail(b, x, z, fw.x, fw.z, speed, t, wk.mass, wk.L, wk.fine, B.sails ? 0 : Math.min(0.7, Math.abs(speed) / 4), H.B);
    b.group.rotation.y = heading;
    b.body.rotation.x = clamp(Math.atan2(aft - fore, H.L * 0.8) - Math.min(0.08, Math.max(0, speed) * 0.012), -0.3, 0.3);
    this.roll[id] = damp(this.roll[id] || 0, Math.sin(t * 0.9 + id.length) * 0.05 + (B.hauling ? 0.06 : 0) + (B.sails && !B.anchored ? 0.12 : 0), 2, dt);
    b.body.rotation.z = this.roll[id];
    if (b.occupied !== B.aboard) b.setRower(B.aboard);
    // Fishing over the side, the rod out; or under sail (the wind drawing her sails), or at anchor
    // with the sails stowed and her light lit after dark.
    b.pose.fishing = B.fishing ? 1 : 0;
    if (B.fishing) {
      b.pose.rodYaw = 1.1;
      b.pose.rodPitch = 0.75 + Math.max(0, Math.sin(t * 0.8 + id.length) - 0.85) * 2;
      b.pose.bend = 0.12;
    }
    if (b.hull.sail) {
      if (b.sailUp !== !!B.sails) b.setSail(!!B.sails);
      b.sailing = B.sails ? { boom: 0.55, awa: 1.3, alpha: 0.14, speed: 3.5, pull: 3 } : null;
      b.setLantern?.(B.anchored && night > 0.3);
    }
    b.animate(dt, t, Math.abs(speed) > 0.3 && !b.hull.sail ? 0.7 * Math.sign(speed) : 0, 0, B.anchored ? night : 0);
    b.group.updateMatrixWorld(true);
    // (Lying alongside her berth: her lines out to the finger, and her fenders down.)
    const lying = B.moored && Math.abs(speed) < 0.05 && Math.hypot(x - B.x, z - B.z) < 0.5;
    if (lying && !b.tie) b.tie = berthFor({ hull: b.hull, pos: { x, z }, heading }, [], { reach: 2 });
    else if (!lying && b.tie) b.tie = null;
    if (b.tie || b._tied) b.updateGear();
    b._tied = !!b.tie;
    // (Out on the water: solid to your boats, which bump off her as off any boat.)
    b.afloat(t);
    if (!B.fishing && b.rod && b.hull.sail == null) b.rod.visible = false;
    // A wake of ripples behind her under way (glowing after dark, on a glowing night).
    if (fx && Math.abs(speed) > 0.5) {
      this.rippleT[id] = (this.rippleT[id] || 0) - dt;
      if (this.rippleT[id] <= 0) {
        this.rippleT[id] = 0.18;
        fx.ripple(x - fw.x * H.L * 0.5, z - fw.z * H.L * 0.5, 1.2 + Math.abs(speed) * 0.25, 1.8, 0.5);
        glow?.spawn(x - fw.x * H.L * 0.5, z - fw.z * H.L * 0.5, 6, 0.8, 1, t);
      }
      // (And white water off her shoulders once she's going: the bow wave breaking, a little at
      // hull speed and more as she's pushed past it, thrown out each side and falling behind.)
      const fn = Math.abs(speed) / Math.sqrt(9.81 * H.L);
      const rate = fx.spray ? 50 * Math.max(0, fn - 0.3) * H.B : 0;
      if (rate > 0 && speed > 0) {
        const wy = waveHeight(x, z, t);
        for (const side of [-1, 1]) {
          for (let n = Math.floor(rate * dt + Math.random()); n > 0; n--) {
            const ax = x + fw.x * H.L * 0.3 + -fw.z * side * H.B * 0.5, az = z + fw.z * H.L * 0.3 + fw.x * side * H.B * 0.5;
            const out = speed * (0.12 + 0.15 * Math.random()), up = speed * (0.08 + 0.12 * Math.random());
            fx.spray(ax, wy + 0.05, az, -fw.z * side * out + fw.x * speed * 0.3, up, fw.x * side * out + fw.z * speed * 0.3, wy - 0.35);
          }
        }
      }
    }
  }
}
