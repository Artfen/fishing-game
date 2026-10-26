import * as THREE from 'three';
import { anatomyGeometry, anatomyMaterials } from '../anatomy.js';
import { waveHeight } from './water.js';
import { depthAt, heightAt, GANNET, SKERRIES } from './terrain.js';
import { sealParts } from './calf.js';
import { clamp, lerp, damp, dampAngle, smoothstep, wrapAngle, glowTexture, mergeParts, mat } from '../util.js';

// Sea life you don't catch: the whales, dolphins, seals and seabirds of both seas, there to be
// watched (and listened to), never fished for.
//
//  · Dolphins in pods, rolling up to breathe as they travel: bottlenose dolphins along the coast
//    and common dolphins out over the deep water at home; Atlantic spotted and bottlenose dolphins
//    round Las Brasas. A boat going along at a good clip draws them in: they come racing over and
//    ride its bow wave, side by side just ahead of the stem, leaping now and then, until it slows
//    or they tire of it. After dark their trails glow (see seaglow.js).
//  · Grey seals hauled out on Gannet Isle's west shore and on the Skerries (as on the Calf), and
//    a curious one or two that come up near a quiet boat (or a diver) to look you over.
//  · Gannets: a few always wheeling round Gannet Isle by day, and, when a shoal of small fish comes
//    up near the surface, a flock that gathers high above it and plunges in, one after another,
//    wings folded, with a white splash.
//  · Whales offshore: a fin whale in the Blue Water and a minke along the shelf at home; a pod of
//    short-finned pilot whales off Las Brasas' south-west, and a sperm whale far out. They travel
//    deep for a few minutes, then surface to breathe a few times, each breath a blow you see from
//    far off (tall and narrow for the fin whale, bushy and slanting forward for the sperm whale),
//    then arch down; the sperm whale lifts its flukes high as it goes.
//
// The game hears what you see (onSighting) for its record of sea life, and the blows, whistles and
// splashes for their sounds. Only the sea you're in is alive at a time.

// What each is called, for the record and the words when you first see one.
export const SEA_LIFE = {
  bottlenose: { name: 'Bottlenose dolphins', note: 'A pod of bottlenose dolphins: big, grey and powerful, with short stubby beaks. They love to ride a boat’s bow wave.' },
  commondolphin: { name: 'Common dolphins', note: 'Common dolphins: slim and fast, with a yellow and grey hourglass down each flank. They travel in big, splashing pods over the deep water.' },
  spotteddolphin: { name: 'Atlantic spotted dolphins', note: 'Atlantic spotted dolphins: the older ones dappled all over with spots. Acrobatic, and always ready to ride a bow wave.' },
  seal: { name: 'Grey seals', note: 'Grey seals: hauled out on the rocks to rest, or bobbing upright in the water with only their heads showing, watching you back.' },
  gannet: { name: 'Northern gannets', note: 'Gannets: big white seabirds with black wingtips and a yellow head. They fold their wings and plunge into a shoal from high up, hitting the water like darts.' },
  finwhale: { name: 'A fin whale', note: 'A fin whale: the second-largest animal on Earth, long and sleek, its tall, narrow blow visible from far off. It travels fast, and dives for minutes at a time.' },
  minkewhale: { name: 'A minke whale', note: 'A minke whale: the smallest of the great whales, its blow faint and low. A dark back and a curved fin roll briefly through the surface, and it’s gone.' },
  pilotwhale: { name: 'Short-finned pilot whales', note: 'Short-finned pilot whales: black, round-headed and sociable. A family group lives off Las Brasas’ south-west, resting at the surface for long spells.' },
  spermwhale: { name: 'A sperm whale', note: 'A sperm whale: the great square head, the wrinkled skin, and a bushy blow slanting forward and to the left. As it dives, it lifts its flukes high.' },
  glow: { name: 'The sea glowing at night', note: 'The sea is glowing: tiny plankton flash blue-green wherever the water is disturbed, in the wake, under an oar, where a fish darts. Brighter some nights than others.' },
};

// The pods, where they roam (an area, kept to water at least minDepth deep), how fast they go,
// how long between breaths, and whether they ride a bow.
const PODS = [
  { kind: 'bottlenose', sea: 'home', n: 5, len: [2.6, 3.4], area: [-450, 450, -60, 820], minDepth: 6, speed: 2.2, period: [7, 12], bow: true },
  { kind: 'commondolphin', sea: 'home', n: 9, len: [1.8, 2.3], area: [-600, 900, 650, 1350], minDepth: 15, speed: 3, period: [5, 9], bow: true },
  { kind: 'spotteddolphin', sea: 'south', n: 7, len: [1.7, 2.2], area: [-900, 900, 5400, 6850], minDepth: 20, speed: 2.6, period: [5, 9], bow: true },
  { kind: 'bottlenose', sea: 'south', n: 4, len: [2.6, 3.3], area: [-600, 700, 6250, 6800], minDepth: 10, speed: 2, period: [7, 12], bow: true },
  // (The pilot whales: a family, slow and often resting at the surface; they don't ride bows.)
  { kind: 'pilotwhale', sea: 'south', n: 6, len: [3.8, 5.6], area: [-950, -150, 6250, 6880], minDepth: 60, speed: 1.1, period: [9, 15], bow: false, whale: true },
];

// The great whales: where they range, their size, their blow (height, width, a forward lean), how
// many breaths each time they come up, and how long they stay down between.
const WHALES = [
  { kind: 'finwhale', sea: 'home', len: 19, area: [-500, 1000, 950, 1380], minDepth: 40, speed: 2.4, blow: [7, 1.3, 0], breaths: [3, 5], down: [110, 170], gap: [12, 18] },
  { kind: 'minkewhale', sea: 'home', len: 8, area: [-400, 700, 700, 1100], minDepth: 20, speed: 2, blow: [2.4, 0.9, 0], breaths: [3, 4], down: [70, 110], gap: [8, 14] },
  { kind: 'spermwhale', sea: 'south', len: 14, area: [-950, 950, 6550, 6880], minDepth: 80, speed: 0.7, blow: [4, 2.2, 0.8], breaths: [7, 10], down: [160, 240], gap: [10, 15], rests: true, flukes: true },
];

const BAIT = new Set(['sprat', 'sardine', 'anchovy', 'mackerel', 'horsemackerel', 'chubmackerel', 'garfish']);

const rand = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3();

// A whale's or a dolphin's body: the anatomical model (anatomySea.js), its swim of its own.
function cetacean(scene, id, len) {
  const mats = anatomyMaterials(id, false);
  const mesh = new THREE.Mesh(anatomyGeometry(id, true), mats);
  mesh.scale.setScalar(len);
  mesh.rotation.order = 'YXZ';
  mesh.castShadow = true;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, swim: mats[0].userData.swim.value };
}

// A gannet: a long white body, a yellow-washed head, a dagger of a grey bill, a pointed tail, and
// long narrow wings with black tips.
function buildGannet() {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  g.add(new THREE.Mesh(mergeParts([
    { geo: new THREE.SphereGeometry(0.2, 8, 6), matrix: mat(0, 0, 0, 0, 0, 0, 0.75, 0.7, 2.0), color: '#f6f6f2', jitter: 0.02 },
    { geo: new THREE.SphereGeometry(0.11, 8, 6), matrix: mat(0, 0.05, 0.42), color: '#efe2b0', jitter: 0.02 },
    { geo: new THREE.ConeGeometry(0.035, 0.2, 5), matrix: mat(0, 0.04, 0.6, Math.PI / 2, 0, 0), color: '#9aa8b4' },
    { geo: new THREE.ConeGeometry(0.1, 0.32, 4), matrix: mat(0, 0, -0.5, -Math.PI / 2, 0, 0, 1, 1, 0.35), color: '#f2f2ee' },
  ]), new THREE.MeshLambertMaterial({ vertexColors: true })));
  const wingMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const wing = (s) => {
    const geo = new THREE.BufferGeometry();
    // (White inner wing, the outer third black.)
    const p = [0, 0, 0.16, 0, 0, -0.1, 0.6 * s, 0, 0.08, 0.6 * s, 0, 0.08, 0, 0, -0.1, 0.6 * s, 0, -0.06,
      0.6 * s, 0, 0.08, 0.6 * s, 0, -0.06, 0.95 * s, 0, -0.12];
    const c = [];
    for (let i = 0; i < 6; i++) c.push(0.96, 0.96, 0.94);
    for (let i = 0; i < 3; i++) c.push(0.08, 0.08, 0.09);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, wingMat);
    m.position.set(0.08 * s, 0.05, 0.05);
    g.add(m);
    return m;
  };
  return { g, wl: wing(1), wr: wing(-1) };
}

// A blow: a column of mist that shoots up and spreads, then drifts and fades.
class Blows {
  constructor(scene) {
    const tex = glowTexture('rgba(255,255,255,1)');
    this.list = [];
    for (let i = 0; i < 8; i++) {
      const sprites = [];
      for (let k = 0; k < 14; k++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: '#ffffff' }));
        s.visible = false;
        scene.add(s);
        sprites.push(s);
      }
      this.list.push({ sprites, life: 0, x: 0, z: 0, h: 1, w: 1, lx: 0, lz: 0 });
    }
    this.i = 0;
  }

  add(x, z, h, w, lean = 0, yaw = 0) {
    const b = this.list[this.i++ % this.list.length];
    Object.assign(b, { x, z, h, w, life: 3.4, lx: Math.sin(yaw - 0.7) * lean, lz: Math.cos(yaw - 0.7) * lean });
  }

  update(dt, t) {
    for (const b of this.list) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const u = 1 - Math.max(0, b.life) / 3.4;
      const grow = smoothstep(0, 0.18, u), fade = 1 - smoothstep(0.2, 1, u);
      const base = waveHeight(b.x, b.z, t);
      b.sprites.forEach((s, k) => {
        const f = k / (b.sprites.length - 1);
        const y = base + b.h * f * grow + u * 1.2;
        s.position.set(b.x + b.lx * b.h * f + u * 0.8, y, b.z + b.lz * b.h * f);
        const size = b.w * (0.9 + f * 1.1) * (0.7 + u * 1.5);
        s.scale.set(size, size, 1);
        s.material.opacity = 0.85 * fade * (1 - f * 0.3);
        s.visible = b.life > 0;
      });
    }
  }
}

export function buildSeaLife(scene, { glow = null } = {}) {
  const blows = new Blows(scene);
  const events = { onSighting: null, onBlow: null, onWhistle: null, onPlunge: null, onSplash: null };
  const surface = (x, z, t) => waveHeight(x, z, t);
  // A spot in this area deep enough, reachable from (fx, fz) without crossing land.
  const pickTarget = (A, minDepth, fx, fz) => {
    for (let k = 0; k < 30; k++) {
      const x = rand(A[0], A[1]), z = rand(A[2], A[3]);
      if (depthAt(x, z) < minDepth) continue;
      if (fx != null) {
        let ok = true;
        for (let s = 1; s < 8 && ok; s++) ok = depthAt(lerp(fx, x, s / 8), lerp(fz, z, s / 8)) > minDepth * 0.4;
        if (!ok) continue;
      }
      return { x, z };
    }
    return fx != null ? { x: fx, z: fz } : { x: (A[0] + A[1]) / 2, z: (A[2] + A[3]) / 2 };
  };

  /* ---------- dolphins (and the pilot whales) ---------- */
  const pods = PODS.map((P) => {
    const at = pickTarget(P.area, P.minDepth);
    const pod = {
      ...P, x: at.x, z: at.z, heading: Math.random() * Math.PI * 2, vx: 0, vz: 0, target: pickTarget(P.area, P.minDepth, at.x, at.z),
      mode: 'roam', modeT: 0, bored: 0, slowT: 0, whistleT: 2, seenT: 0, glowT: 0, members: [],
    };
    for (let i = 0; i < P.n; i++) {
      const len = rand(P.len[0], P.len[1]);
      const body = cetacean(scene, P.kind, len);
      const side = i % 2 ? 1 : -1;
      pod.members.push({
        ...body, len, x: at.x, y: -3, z: at.z, yaw: pod.heading, pitch: 0,
        // Its place in the pod (across, along), and alongside a bow (across, ahead, how deep).
        slot: { across: (Math.random() - 0.5) * (P.whale ? 16 : 12), along: (Math.random() - 0.5) * (P.whale ? 14 : 10) },
        bowSlot: { across: side * rand(0.7, 2.2), ahead: rand(0.4, 3.8), deep: rand(0.5, 1.0) },
        cyc: Math.random() * 8, period: rand(P.period[0], P.period[1]), leap: false, blew: false, landed: true, phase: Math.random() * 10,
      });
    }
    return pod;
  });

  const stepPod = (pod, dt, t, ctx, near) => {
    const boat = ctx.boat, sp = ctx.boatSpeed || 0;
    pod.bored = Math.max(0, pod.bored - dt);
    pod.seenT = Math.max(0, pod.seenT - dt);
    // A boat going along at a good clip draws a pod in to ride its bow.
    const dBoat = boat ? Math.hypot(boat.pos.x - pod.x, boat.pos.z - pod.z) : Infinity;
    if (pod.bow && pod.mode === 'roam' && boat && sp > 3 && sp < 11 && dBoat < 160 && !pod.bored) {
      pod.mode = 'bow';
      pod.modeT = rand(45, 90);
      pod.slowT = 0;
    }
    let wantX, wantZ, wantSpeed, frame;
    if (pod.mode === 'bow') {
      pod.modeT -= dt;
      pod.slowT = sp < 2 || sp > 12 ? pod.slowT + dt : 0;
      if (!boat || pod.modeT <= 0 || pod.slowT > 4 || dBoat > 260) {
        pod.mode = 'roam';
        pod.bored = rand(150, 240);
        pod.target = pickTarget(pod.area, pod.minDepth, pod.x, pod.z);
      } else {
        const bow = (boat.hull?.L ?? 3.6) * 0.5;
        wantX = boat.pos.x + boat.fwd.x * bow;
        wantZ = boat.pos.z + boat.fwd.z * bow;
        frame = { fx: boat.fwd.x, fz: boat.fwd.z, rx: boat.right.x, rz: boat.right.z };
        wantSpeed = Math.min(12, sp + 6);
      }
    }
    if (pod.mode === 'roam') {
      if (Math.hypot(pod.target.x - pod.x, pod.target.z - pod.z) < 30) pod.target = pickTarget(pod.area, pod.minDepth, pod.x, pod.z);
      wantX = pod.target.x;
      wantZ = pod.target.z;
      wantSpeed = pod.speed;
    }
    // The pod's middle: swung round towards where it's going, at its own pace (racing in to a bow,
    // then holding just ahead of it).
    const dx = wantX - pod.x, dz = wantZ - pod.z, d = Math.hypot(dx, dz);
    if (pod.mode === 'bow') {
      const v = Math.min(wantSpeed, d * 2.5 + sp);
      pod.vx = (dx / (d || 1)) * v;
      pod.vz = (dz / (d || 1)) * v;
      pod.heading = d > 6 ? Math.atan2(dx, dz) : Math.atan2(frame.fx, frame.fz);
    } else {
      pod.heading = dampAngle(pod.heading, Math.atan2(dx, dz), 0.35, dt);
      pod.vx = Math.sin(pod.heading) * wantSpeed;
      pod.vz = Math.cos(pod.heading) * wantSpeed;
    }
    pod.x += pod.vx * dt;
    pod.z += pod.vz * dt;
    if (!near) {
      for (const m of pod.members) m.mesh.visible = false;
      return;
    }
    const bowing = pod.mode === 'bow' && d < 25;
    const hc = Math.cos(pod.heading), hs = Math.sin(pod.heading);
    let up = false;
    for (const m of pod.members) {
      // Where it wants to be: its place in the pod, or alongside the bow.
      let tx, tz;
      if (bowing) {
        tx = pod.x + frame.fx * m.bowSlot.ahead + frame.rx * m.bowSlot.across;
        tz = pod.z + frame.fz * m.bowSlot.ahead + frame.rz * m.bowSlot.across;
      } else {
        tx = pod.x + hs * m.slot.along + hc * m.slot.across;
        tz = pod.z + hc * m.slot.along - hs * m.slot.across;
      }
      const k = 1 - Math.exp(-(bowing ? 5 : 1.2) * dt);
      const px = m.x, pz = m.z;
      m.x += pod.vx * dt + (tx - m.x - pod.vx * dt) * k;
      m.z += pod.vz * dt + (tz - m.z - pod.vz * dt) * k;
      const mvx = (m.x - px) / Math.max(dt, 1e-3), mvz = (m.z - pz) / Math.max(dt, 1e-3), speed = Math.hypot(mvx, mvz);
      if (speed > 0.3) m.yaw = dampAngle(m.yaw, Math.atan2(mvx, mvz), 4, dt);
      // Up to breathe now and then (often, riding a bow), now and then clear of the water.
      m.cyc += dt;
      const period = bowing ? m.period * 0.4 : m.period;
      if (m.cyc > period) {
        m.cyc = 0;
        m.leap = !pod.whale && Math.random() < (bowing ? 0.2 : speed > 3 ? 0.08 : 0.03);
        m.blew = false;
        m.landed = false;
      }
      const dur = m.leap ? 1.5 : pod.whale ? 3.2 : 1.2;
      const deep = bowing ? m.bowSlot.deep : pod.whale ? 2.2 : 2.4;
      let rise = 0, pitch = 0;
      if (m.cyc < dur) {
        const u = m.cyc / dur;
        rise = Math.sin(u * Math.PI);
        pitch = lerp(0.45, -0.45, u) * (m.leap ? 1.7 : pod.whale ? 0.4 : 1);
        up = true;
        if (!m.blew && u > 0.35) {
          m.blew = true;
          events.onBlow?.(m.x, m.z, pod.whale ? 0.5 : 0.25, pod.kind);
          if (pod.whale) blows.add(m.x, m.z, 1.4, 0.7);
        }
        if (m.leap && !m.landed && u > 0.92) {
          m.landed = true;
          events.onSplash?.(m.x, m.z, m.len);
        }
      }
      const half = m.len * 0.065;
      const peak = m.leap ? m.len * 0.55 : -half * 0.6;
      const s = surface(m.x, m.z, t);
      m.y = s - deep + rise * (deep + peak);
      m.pitch = damp(m.pitch, pitch, 6, dt);
      m.mesh.position.set(m.x, m.y, m.z);
      m.mesh.rotation.set(-m.pitch, m.yaw, Math.sin(t * 0.7 + m.phase) * 0.08);
      m.mesh.visible = true;
      m.phase += dt * (5 + speed * 1.4) / Math.max(1, m.len / 2.5);
      m.swim.set(m.phase, clamp(0.3 + speed * 0.09, 0.3, 1));
      // After dark, a trail of cold light behind each one near the surface.
      if (glow && glow.level > 0.02 && m.y > s - 2.5 && Math.hypot(m.x - ctx.from.x, m.z - ctx.from.z) < 80) {
        m.glowT = (m.glowT ?? 0) - dt;
        if (m.glowT <= 0) {
          m.glowT = 0.08;
          glow.spawn(m.x, m.z, 2 + Math.round(speed * 0.5), 0.4 + m.len * 0.12, 1.2, t);
        }
      }
    }
    // Riding the bow: whistles and clicks close by.
    if (bowing && d < 40) {
      pod.whistleT -= dt;
      if (pod.whistleT <= 0) {
        pod.whistleT = rand(1.5, 4);
        events.onWhistle?.(pod.x, pod.z);
      }
    }
    if (up && !pod.seenT && Math.hypot(pod.x - ctx.from.x, pod.z - ctx.from.z) < (pod.whale ? 400 : 160)) {
      pod.seenT = 240;
      events.onSighting?.(pod.kind, pod.x, pod.z);
    }
  };

  /* ---------- the great whales ---------- */
  const whales = WHALES.map((W) => {
    const at = pickTarget(W.area, W.minDepth);
    const body = cetacean(scene, W.kind, W.len);
    return {
      ...W, ...body, x: at.x, z: at.z, y: -30, heading: Math.random() * Math.PI * 2, pitch: 0, target: pickTarget(W.area, W.minDepth, at.x, at.z),
      state: 'down', t: rand(10, 60), breathsLeft: 0, phase: 0, seenT: 0, blew: false,
    };
  });
  const stepWhale = (w, dt, t, ctx, near) => {
    w.seenT = Math.max(0, w.seenT - dt);
    if (Math.hypot(w.target.x - w.x, w.target.z - w.z) < 60) w.target = pickTarget(w.area, w.minDepth, w.x, w.z);
    const resting = w.rests && w.state !== 'down';
    w.heading = dampAngle(w.heading, Math.atan2(w.target.x - w.x, w.target.z - w.z), 0.08, dt);
    const v = w.speed * (resting ? 0.3 : 1);
    w.x += Math.sin(w.heading) * v * dt;
    w.z += Math.cos(w.heading) * v * dt;
    const s = surface(w.x, w.z, t), half = w.len * 0.06;
    let y = s - 30, pitch = 0;
    // Down deep, travelling; then up to breathe a few times, a dip under between breaths (the
    // sperm whale lies at the surface, breathing); then down again, arching (or flukes up).
    if (w.state === 'down') {
      w.t -= dt;
      if (w.t <= 0) {
        w.state = 'breathe';
        w.breathsLeft = Math.round(rand(w.breaths[0], w.breaths[1]));
        w.t = 0;
        w.blew = false;
      }
    } else if (w.state === 'breathe') {
      w.t += dt; // (counts up through this breath)
      const gap = (w.gap[0] + w.gap[1]) / 2;
      const u = w.t / gap;
      // Rising, at the surface (the blow), rolling under.
      const atTop = w.rests ? 1 : smoothstep(0, 0.12, u) * (1 - smoothstep(0.45, 0.6, u));
      y = s - half * 0.35 - (1 - atTop) * (w.rests ? 0 : 4);
      pitch = w.rests ? 0 : lerp(0.08, -0.12, smoothstep(0.1, 0.6, u));
      if (!w.blew && u > 0.12) {
        w.blew = true;
        const fx = Math.sin(w.heading), fz = Math.cos(w.heading), bx = w.x + fx * w.len * 0.36, bz = w.z + fz * w.len * 0.36;
        blows.add(bx, bz, w.blow[0], w.blow[1], w.blow[2], w.heading);
        events.onBlow?.(bx, bz, 1, w.kind);
        if (!w.seenT && Math.hypot(w.x - ctx.from.x, w.z - ctx.from.z) < 900) {
          w.seenT = 300;
          events.onSighting?.(w.kind, w.x, w.z);
        }
      }
      if (u >= 1) {
        w.breathsLeft--;
        w.t = 0;
        w.blew = false;
        if (w.breathsLeft <= 0) {
          w.state = 'sound';
          w.t = 0;
        }
      }
    } else if (w.state === 'sound') {
      // The terminal dive: the back arches high and slides under; the flukes come up and go down.
      w.t += dt;
      const u = clamp(w.t / 9, 0, 1);
      if (w.flukes) {
        pitch = -1.0 * smoothstep(0, 0.45, u);
        y = s - half * 0.4 - smoothstep(0.2, 1, u) * w.len * 0.9;
      } else {
        pitch = -0.45 * smoothstep(0, 0.4, u);
        y = s - half * 0.3 - smoothstep(0.2, 1, u) * w.len * 0.6;
      }
      if (u >= 1) {
        w.state = 'down';
        w.t = rand(w.down[0], w.down[1]);
      }
    }
    w.y = y;
    w.pitch = damp(w.pitch, pitch, 2, dt);
    if (!near) {
      w.mesh.visible = false;
      return;
    }
    // (For a body this long, its middle sits where its pivot is: flukes up means tail high.)
    w.mesh.position.set(w.x, w.y, w.z);
    w.mesh.rotation.set(-w.pitch, w.heading, 0);
    w.mesh.visible = w.state !== 'down';
    w.phase += dt * 1.6;
    w.swim.set(w.phase, 0.35);
  };

  /* ---------- grey seals ---------- */
  const sealMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const { bodyGeo, headGeo } = sealParts(Math.random);
  const makeSeal = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, sealMat);
    body.castShadow = true;
    const neck = new THREE.Group();
    neck.position.set(0, 0.42, 0.7);
    const head = new THREE.Mesh(headGeo, sealMat);
    head.castShadow = true;
    neck.add(head);
    g.add(body, neck);
    g.visible = false;
    scene.add(g);
    return { g, body, neck, head };
  };
  // Haul-outs: Gannet Isle's low west shore, and the biggest of the Skerries.
  const haulouts = [];
  {
    const spots = [];
    for (let k = 0; k < 5; k++) {
      const a = 2.6 + k * 0.07;
      // Out from the middle of the island to the edge of the rock, just above the water.
      let r = 30;
      while (r < 130 && heightAt(GANNET.x + Math.cos(a) * r, GANNET.z + Math.sin(a) * r) > 1.1) r += 1;
      const x = GANNET.x + Math.cos(a) * r, z = GANNET.z + Math.sin(a) * r;
      if (heightAt(x, z) > 0.15) spots.push({ x, z });
    }
    haulouts.push({ id: 'gannet', x: GANNET.x + Math.cos(2.74) * 75, z: GANNET.z + Math.sin(2.74) * 75, spots });
    const K = SKERRIES[0];
    // (On the dry top of the rock: the nearer the middle the higher.)
    const top = [0, 2.1, 4.2].map((a) => [0.9, 0.5, 0.2].map((r) => ({ x: K.x + Math.sin(a) * r, z: K.z + Math.cos(a) * r })).find((p) => heightAt(p.x, p.z) > 0.15)).filter(Boolean);
    haulouts.push({ id: 'skerries', x: K.x, z: K.z, spots: top });
  }
  const ashore = [], visitors = [];
  for (const H of haulouts) {
    for (const p of H.spots) {
      const s = makeSeal();
      s.g.scale.setScalar(rand(0.8, 1.1));
      s.g.position.set(p.x, Math.max(0.1, heightAt(p.x, p.z)) + 0.02, p.z);
      s.g.rotation.y = Math.random() * Math.PI * 2;
      ashore.push({ ...s, H, ph: Math.random() * 20, lift: 0, look: 0 });
    }
    for (let i = 0; i < 2; i++) {
      const s = makeSeal();
      s.body.visible = false;
      s.neck.position.set(0, 0, 0);
      s.head.rotation.x = -0.35;
      visitors.push({ ...s, H, x: H.x, z: H.z, a: Math.random() * 6.28, r: rand(14, 30), depth: 1, down: true, t: rand(5, 30), look: 0, mode: 'idle', visits: 0, cool: rand(20, 60) });
    }
  }
  const stepSeals = (dt, t, ctx, near) => {
    for (const s of ashore) {
      const d = Math.hypot(ctx.from.x - s.g.position.x, ctx.from.z - s.g.position.z);
      s.g.visible = near && d < 900;
      if (!s.g.visible) continue;
      const alert = smoothstep(40, 18, d);
      const idle = Math.max(0, Math.sin(t * 0.19 + s.ph) * 1.6 - 0.9);
      s.lift = damp(s.lift, Math.max(idle, alert), 1.5, dt);
      s.neck.rotation.x = -0.75 * s.lift;
      const toYou = wrapAngle(Math.atan2(ctx.from.x - s.g.position.x, ctx.from.z - s.g.position.z) - s.g.rotation.y);
      s.look = dampAngle(s.look, alert > 0.3 ? clamp(toYou, -1, 1) : Math.sin(t * 0.13 + s.ph) * 0.5, 1.2, dt);
      s.neck.rotation.y = s.look;
      s.body.scale.y = 1 + Math.sin(t * 1.3 + s.ph) * 0.02;
      if (d < 120) events.onSighting?.('seal', s.g.position.x, s.g.position.z);
    }
    // Heads in the water: drifting off the haul-out, sinking and coming up again; and, near a quiet
    // boat (or a diver), coming over to have a look at you from a few boat-lengths off.
    const quiet = (ctx.boat && (ctx.boatSpeed ?? 0) < 1.5) || ctx.diving;
    for (const s of visitors) {
      const H = s.H, dH = Math.hypot(ctx.from.x - H.x, ctx.from.z - H.z);
      s.t -= dt;
      s.cool = Math.max(0, s.cool - dt);
      if (s.mode === 'idle' && quiet && dH < 240 && !s.cool && s.down) {
        // Off to look: it comes up a little way off you, to one side.
        s.mode = 'visit';
        const a = Math.random() * Math.PI * 2, r = rand(9, 16);
        s.x = ctx.from.x + Math.sin(a) * r;
        s.z = ctx.from.z + Math.cos(a) * r;
        if (depthAt(s.x, s.z) < 1.2) s.mode = 'idle';
        else {
          s.down = false;
          s.t = rand(12, 25);
        }
      }
      if (s.mode === 'idle') {
        s.a += 0.03 * dt;
        s.x = H.x + Math.sin(s.a) * s.r;
        s.z = H.z + Math.cos(s.a) * s.r;
        if (s.t <= 0) {
          s.down = !s.down;
          s.t = s.down ? rand(8, 20) : rand(15, 35);
          if (s.down) {
            s.a += rand(1, 2.5);
            s.r = rand(12, 30);
          }
        }
      } else if (s.t <= 0 || (ctx.boatSpeed ?? 0) > 3) {
        // Seen enough: under again, and back to the rocks for a while.
        s.down = true;
        s.mode = 'idle';
        s.cool = rand(40, 80);
        s.t = rand(8, 16);
      }
      s.depth = damp(s.depth, s.down ? 1 : 0, 1.4, dt);
      const d = Math.hypot(ctx.from.x - s.x, ctx.from.z - s.z);
      s.g.visible = near && s.depth < 0.95 && d < 600;
      if (!s.g.visible) continue;
      s.g.position.set(s.x, surface(s.x, s.z, t) + 0.05 - s.depth * 0.9, s.z);
      const toYou = Math.atan2(ctx.from.x - s.x, ctx.from.z - s.z);
      s.look = dampAngle(s.look, s.mode === 'visit' ? toYou : s.a + Math.PI / 2, 1.5, dt);
      s.g.rotation.y = s.look;
      if (s.mode === 'visit' && s.depth < 0.3 && d < 40) events.onSighting?.('seal', s.x, s.z);
    }
  };

  /* ---------- gannets ---------- */
  const colony = [], feeders = [];
  for (let i = 0; i < 6; i++) {
    const b = buildGannet();
    b.g.visible = false;
    scene.add(b.g);
    colony.push({ ...b, a: Math.random() * 6.28, r: rand(55, 110), y: rand(14, 38), sp: (Math.random() < 0.5 ? -1 : 1) * rand(9, 12), ph: Math.random() * 10 });
  }
  for (let i = 0; i < 8; i++) {
    const b = buildGannet();
    b.g.visible = false;
    scene.add(b.g);
    feeders.push({ ...b, state: 'off', a: Math.random() * 6.28, r: rand(8, 18), y0: rand(18, 30), sp: (Math.random() < 0.5 ? -1 : 1) * rand(9, 12), ph: Math.random() * 10, t: 0, x: 0, y: 0, z: 0, tx: 0, tz: 0 });
  }
  let feeding = null, lookT = 2;
  const flap = (b, t, k = 1) => {
    const f = Math.sin(t * 6 + b.ph) * 0.5 * k;
    b.wl.rotation.z = f;
    b.wr.rotation.z = -f;
  };
  const stepGannets = (dt, t, ctx, near) => {
    const day = ctx.daylight > 0.3;
    // The colony, wheeling round Gannet Isle by day.
    for (const b of colony) {
      b.g.visible = near && day && Math.hypot(ctx.from.x - GANNET.x, ctx.from.z - GANNET.z) < 1200;
      if (!b.g.visible) continue;
      b.a += (b.sp / b.r) * dt;
      b.g.position.set(GANNET.x + Math.cos(b.a) * b.r, b.y + Math.sin(t * 0.4 + b.ph) * 3, GANNET.z + Math.sin(b.a) * b.r);
      const dir = Math.sign(b.sp);
      b.g.rotation.set(0, Math.atan2(-Math.sin(b.a) * dir, Math.cos(b.a) * dir), -0.3 * dir);
      flap(b, t, (t + b.ph) % 7 < 2.5 ? 1 : 0.1);
    }
    if (near && day && Math.hypot(ctx.from.x - GANNET.x, ctx.from.z - GANNET.z) < 250) events.onSighting?.('gannet', GANNET.x, GANNET.z);
    // A shoal up near the surface within sight brings a flock down onto it.
    lookT -= dt;
    if (!feeding && lookT <= 0 && near && day && ctx.eco) {
      lookT = 3;
      let best = null, bd = 450;
      for (const s of ctx.eco.schools) {
        if (!BAIT.has(s.sp.id) || s.y < -3.5 || s.home?.south) continue;
        const d = Math.hypot(s.x - ctx.from.x, s.z - ctx.from.z);
        if (d < bd && depthAt(s.x, s.z) > 3) {
          bd = d;
          best = s;
        }
      }
      if (best) {
        feeding = { school: best, t: 0, life: rand(45, 75) };
        for (const b of feeders) {
          b.state = 'circle';
          b.t = rand(3, 12);
          b.a = Math.random() * 6.28;
          b.y = b.y0 + 30;
        }
      }
    }
    if (feeding) {
      feeding.t += dt;
      const S = feeding.school;
      const done = feeding.t > feeding.life || S.y < -5 || !day;
      if (done && feeders.every((b) => b.state === 'off' || b.state === 'circle')) {
        feeding = null;
        for (const b of feeders) {
          b.state = 'off';
          b.g.visible = false;
        }
      } else {
        const cx = S.x, cz = S.z;
        if (Math.hypot(cx - ctx.from.x, cz - ctx.from.z) < 320) events.onSighting?.('gannet', cx, cz);
        for (const b of feeders) {
          if (b.state === 'off') continue;
          b.t -= dt;
          if (b.state === 'circle') {
            b.a += (b.sp / b.r) * dt;
            b.y = damp(b.y, b.y0, 0.6, dt);
            b.x = cx + Math.cos(b.a) * b.r;
            b.z = cz + Math.sin(b.a) * b.r;
            const dir = Math.sign(b.sp);
            b.g.rotation.set(0, Math.atan2(-Math.sin(b.a) * dir, Math.cos(b.a) * dir), -0.35 * dir);
            flap(b, t, 0.8);
            if (b.t <= 0 && !done) {
              // Wings half closed, a turn, and down like a dart.
              b.state = 'dive';
              b.tx = cx + rand(-4, 4);
              b.tz = cz + rand(-4, 4);
              b.v = 4;
            }
          } else if (b.state === 'dive') {
            b.v = Math.min(26, b.v + 22 * dt);
            const dx = b.tx - b.x, dz = b.tz - b.z, s = surface(b.tx, b.tz, t), dy = s - b.y, l = Math.hypot(dx, dy, dz) || 1;
            b.x += (dx / l) * b.v * dt;
            b.y += (dy / l) * b.v * dt;
            b.z += (dz / l) * b.v * dt;
            b.g.rotation.set(Math.asin(clamp(-dy / l, -1, 1)), Math.atan2(dx, dz), 0);
            b.wl.rotation.z = 1.3;
            b.wr.rotation.z = -1.3;
            if (b.y <= s + 0.2) {
              events.onPlunge?.(b.x, b.z);
              b.state = 'sit';
              b.t = rand(2, 4);
              b.y = s;
            }
          } else if (b.state === 'sit') {
            b.y = surface(b.x, b.z, t) - 0.05;
            b.g.rotation.set(0, b.g.rotation.y, 0);
            b.wl.rotation.z = -0.1;
            b.wr.rotation.z = 0.1;
            if (b.t <= 0) {
              b.state = 'climb';
              b.t = 0;
            }
          } else if (b.state === 'climb') {
            b.t += dt;
            b.y += 5 * dt;
            b.a += (b.sp / b.r) * dt * 0.5;
            const wx = cx + Math.cos(b.a) * b.r, wz = cz + Math.sin(b.a) * b.r;
            b.x = damp(b.x, wx, 0.8, dt);
            b.z = damp(b.z, wz, 0.8, dt);
            b.g.rotation.set(-0.5, b.g.rotation.y, 0);
            flap(b, t * 1.4, 1);
            if (b.y >= b.y0 - 1) {
              b.state = 'circle';
              b.t = rand(5, 14);
            }
          }
          b.g.position.set(b.x, b.y, b.z);
          b.g.visible = near;
        }
      }
    }
  };

  return {
    ...events,
    pods, whales, ashore, visitors, colony, feeders, haulouts,
    get feeding() { return feeding; },
    // ctx: { from (where you are), boat (the boat you're aboard, under way on the surface, or
    // null), boatSpeed, daylight, region ('home' or 'south'), eco, diving }
    update(dt, t, ctx) {
      for (const k of ['onSighting', 'onBlow', 'onWhistle', 'onPlunge', 'onSplash']) events[k] = this[k];
      const home = ctx.region !== 'south';
      for (const p of pods) stepPod(p, dt, t, ctx, (p.sea === 'home') === home && Math.hypot(p.x - ctx.from.x, p.z - ctx.from.z) < 1200);
      for (const w of whales) stepWhale(w, dt, t, ctx, (w.sea === 'home') === home && Math.hypot(w.x - ctx.from.x, w.z - ctx.from.z) < 2000);
      stepSeals(dt, t, ctx, home);
      stepGannets(dt, t, ctx, home);
      blows.update(dt, t);
    },
  };
}
