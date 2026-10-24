import * as THREE from 'three';
import { heightAt, walkHeight, CALF, CALF_TOWER, CALF_SKERRY, CALF_SOUND, CALF_LANDING } from './terrain.js';
import { waveHeight, currentAt, TIDE } from './conditions.js';
import { mergeParts, mat, pick, jitterGeo, clamp, smoothstep, lerp, damp, dampAngle } from '../util.js';
import { withSurface } from './surface.js';
import { withCaustics } from './caustics.js';

// The Calf, off Heron Point: a ruined watch tower on its top, a stone landing in its lee with
// steps up from it, sea pinks in the short turf and boulders under the cliffs; grey seals hauled
// out on the skerry at the mouth of Calf Sound (and a couple in the water, watching you); and the
// race itself, where the tide pours through the Sound and the water stands up in white ridges.
//
// Everything is made here from simple shapes (no outside models or images). Nothing in it is
// needed to fish: the seals and the foam are only to be seen, and never get in a line's way.

const plain = () => new THREE.MeshLambertMaterial({ vertexColors: true });
function mesh(geo, material, shadows = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

const T = CALF_TOWER;
const TOWER_R = 2.2;      // outer radius
const DOOR_YAW = Math.PI / 2; // the doorway faces east, towards the landing
const DOOR_H = 1.9;

// Where you stand at the tower's doorway (the game's interaction spot).
export const TOWER_DOOR = { x: T.x + Math.sin(DOOR_YAW) * (TOWER_R + 1.3), z: T.z + Math.cos(DOOR_YAW) * (TOWER_R + 1.3), r: 1.7 };

export function buildCalf(scene, rnd) {
  const group = new THREE.Group();
  group.name = 'calf';
  scene.add(group);
  const obstacles = [];
  const spots = [];

  /* ---------- the watch tower: a round stone ruin, broken at the top ---------- */
  const ty = heightAt(T.x, T.z) - 0.25;
  const stone = [];
  const COURSE = 0.34, N = 20;
  // How high the wall still stands at each point round it: tall on the weather side, broken down
  // to the east and over the doorway's far side.
  const standing = (a) => 12 + 6 * Math.max(0, Math.cos(a + Math.PI / 2)) + 3 * Math.sin(a * 3 + 1.3) + (rnd() - 0.5) * 2;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const top = Math.floor(standing(a));
    const door = Math.abs(Math.atan2(Math.sin(a - DOOR_YAW), Math.cos(a - DOOR_YAW))) < 0.32;
    const slit = (i === 6 || i === 15);
    for (let k = 0; k < top; k++) {
      const y = ty + k * COURSE + COURSE / 2;
      if (door && k * COURSE < DOOR_H) continue;
      if (slit && k >= 8 && k <= 10) continue;
      const aa = a + (k % 2 ? Math.PI / N : 0);
      const r = TOWER_R - 0.25;
      stone.push({
        geo: new THREE.BoxGeometry(0.66 + rnd() * 0.06, COURSE * 0.94, 0.5),
        matrix: mat(T.x + Math.sin(aa) * r, y, T.z + Math.cos(aa) * r, 0, aa + (rnd() - 0.5) * 0.06, 0),
        color: pick(['#9a958b', '#8b867c', '#a7a196', '#7f7a70'], rnd), jitter: 0.04,
      });
    }
  }
  // The lintel over the doorway, and fallen stones round the foot.
  stone.push({ geo: new THREE.BoxGeometry(1.4, 0.3, 0.6), matrix: mat(T.x + Math.sin(DOOR_YAW) * (TOWER_R - 0.25), ty + DOOR_H + 0.15, T.z + Math.cos(DOOR_YAW) * (TOWER_R - 0.25), 0, DOOR_YAW, 0), color: '#8b867c' });
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, d = TOWER_R + 0.4 + rnd() * 2.2;
    const x = T.x + Math.sin(a) * d, z = T.z + Math.cos(a) * d;
    if (Math.abs(Math.atan2(Math.sin(a - DOOR_YAW), Math.cos(a - DOOR_YAW))) < 0.5) continue; // (the way in kept clear)
    stone.push({ geo: new THREE.BoxGeometry(0.5, 0.3, 0.4), matrix: mat(x, heightAt(x, z) + 0.1, z, rnd() * 0.4, rnd() * 3, rnd() * 0.4), color: pick(['#8b867c', '#9a958b'], rnd) });
  }
  // Inside: a stone ledge, and on it (until you take it) the watcher's slate.
  const inX = T.x - Math.sin(DOOR_YAW) * 1.2, inZ = T.z - Math.cos(DOOR_YAW) * 1.2;
  stone.push({ geo: new THREE.BoxGeometry(0.9, 0.12, 0.4), matrix: mat(inX, ty + 0.9, inZ, 0, DOOR_YAW, 0), color: '#7f7a70' });
  group.add(mesh(mergeParts(stone, rnd), withSurface(plain(), 'ground')));
  const slate = mesh(mergeParts([{ geo: new THREE.BoxGeometry(0.34, 0.24, 0.025), matrix: mat(0, 0, 0), color: '#3f454c' }], rnd), plain());
  slate.position.set(inX, ty + 1.08, inZ);
  slate.rotation.set(-0.25, DOOR_YAW, 0);
  group.add(slate);
  obstacles.push({ x: T.x, z: T.z, r: TOWER_R + 0.15, kind: 'building', name: 'the watch tower' });
  spots.push({ kind: 'tower', name: 'the watch tower', ...TOWER_DOOR });

  /* ---------- the landing, and steps up from it ---------- */
  const L = CALF_LANDING, cz = (L.z0 + L.z1) / 2, w = L.z1 - L.z0;
  const land = [];
  for (let x = L.x0 + 0.5; x < L.x1; x += 1.0) {
    const bottom = Math.min(heightAt(x, cz), 0) - 0.8;
    for (let y = bottom; y < L.deck - 0.25; y += 0.45) {
      land.push({ geo: new THREE.BoxGeometry(0.98, 0.44, w), matrix: mat(x + (rnd() - 0.5) * 0.05, y + 0.22, cz), color: pick(['#8f8a80', '#9c968b', '#857f74'], rnd), jitter: 0.03 });
    }
    land.push({ geo: new THREE.BoxGeometry(0.98, 0.25, w + 0.2), matrix: mat(x, L.deck - 0.12, cz), color: pick(['#b3ab9c', '#a8a091'], rnd), jitter: 0.02 });
  }
  // A bollard to make fast to, and an iron ring in the end.
  const bx = L.x1 - 0.9;
  for (const bz of [L.z0 + 0.35, L.z1 - 0.35]) {
    land.push({ geo: new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8), matrix: mat(bx, L.deck + 0.25, bz), color: '#3e3a36' });
    obstacles.push({ x: bx, z: bz, r: 0.22, top: L.deck + 0.5, kind: 'harbour', name: 'the bollard' });
  }
  land.push({ geo: new THREE.TorusGeometry(0.16, 0.035, 5, 12), matrix: mat(L.x1 + 0.02, L.deck - 0.3, cz, 0, Math.PI / 2, 0), color: '#6a5a48' });
  // Rough steps up the slope from the landing to the top: level blocks set into the turf, each
  // standing a little proud of the slope below it (its riser).
  const s0 = { x: L.x0 - 0.2, z: cz }, s1 = { x: T.x + 6, z: T.z - 0.5 };
  const yaw = Math.atan2(s1.x - s0.x, s1.z - s0.z) + Math.PI / 2;
  for (let i = 0; i <= 20; i++) {
    const k = i / 20, x = lerp(s0.x, s1.x, k), z = lerp(s0.z, s1.z, k) + Math.sin(k * 5) * 0.4;
    land.push({ geo: new THREE.BoxGeometry(0.62, 0.5, 1.25), matrix: mat(x, walkHeight(x, z) + 0.07 - 0.25, z, 0, yaw + (rnd() - 0.5) * 0.12, 0), color: pick(['#a39b8c', '#958d7f', '#8c8478'], rnd), jitter: 0.05 });
  }
  group.add(mesh(mergeParts(land, rnd), withCaustics(plain())));

  /* ---------- boulders under the cliffs, sea pinks on the top ---------- */
  const rockGeo = jitterGeo(new THREE.DodecahedronGeometry(1, 0), 0.35, rnd);
  const rocks = [];
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const x = CALF.x + Math.sin(a) * (CALF.rx + 1 + rnd() * 4), z = CALF.z + Math.cos(a) * (CALF.rz + 1 + rnd() * 4);
    const h = heightAt(x, z);
    if (h < -2.5 || h > 3 || (x > L.x0 - 3 && x < L.x1 + 4 && Math.abs(z - cz) < 5)) continue;
    rocks.push({ geo: rockGeo, matrix: new THREE.Matrix4().compose(new THREE.Vector3(x, h + 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 2, rnd() * 6, rnd() * 2)), new THREE.Vector3(0.6 + rnd() * 1.2, 0.4 + rnd() * 0.8, 0.6 + rnd() * 1.2)), color: pick(['#7d7a72', '#8c877d', '#6e6b64'], rnd) });
  }
  group.add(mesh(mergeParts(rocks, rnd), withCaustics(plain())));
  const pinkGeo = new THREE.IcosahedronGeometry(0.16, 0);
  const pinks = [];
  for (let i = 0; i < 160; i++) {
    const x = CALF.x + (rnd() - 0.5) * CALF.rx * 1.8, z = CALF.z + (rnd() - 0.5) * CALF.rz * 1.8;
    const h = heightAt(x, z);
    if (h < 2.5 || Math.hypot(x - T.x, z - T.z) < TOWER_R + 1.2) continue;
    const s = 0.7 + rnd() * 0.8;
    pinks.push({ geo: pinkGeo, matrix: new THREE.Matrix4().compose(new THREE.Vector3(x, h + 0.04 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.55, s)), color: pick(['#e48cb0', '#d77aa3', '#efa3c2', '#c9d2a0'], rnd), jitter: 0.05 });
  }
  group.add(mesh(mergeParts(pinks, rnd), plain(), false));

  /* ---------- grey seals ---------- */
  const sealMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const bodyGeo = mergeParts([
    { geo: new THREE.SphereGeometry(0.5, 12, 8), matrix: new THREE.Matrix4().compose(new THREE.Vector3(0, 0.26, 0), new THREE.Quaternion(), new THREE.Vector3(0.85, 0.62, 1.55)), color: '#7d8187', jitter: 0.03 },
    { geo: new THREE.ConeGeometry(0.3, 0.75, 10), matrix: mat(0, 0.2, -1.0, -Math.PI / 2, 0, 0), color: '#6f7379', jitter: 0.03 },
    { geo: new THREE.BoxGeometry(0.42, 0.04, 0.26), matrix: mat(0.12, 0.18, -1.42, 0, 0.5, 0), color: '#4f5358' },
    { geo: new THREE.BoxGeometry(0.42, 0.04, 0.26), matrix: mat(-0.12, 0.18, -1.42, 0, -0.5, 0), color: '#4f5358' },
    { geo: new THREE.BoxGeometry(0.08, 0.05, 0.3), matrix: mat(0.38, 0.08, 0.35, 0, 0.4, -0.3), color: '#5f6368' },
    { geo: new THREE.BoxGeometry(0.08, 0.05, 0.3), matrix: mat(-0.38, 0.08, 0.35, 0, -0.4, 0.3), color: '#5f6368' },
  ], rnd);
  // (Mottled: a few darker blotches over the grey.)
  const headGeo = mergeParts([
    { geo: new THREE.SphereGeometry(0.21, 10, 8), matrix: new THREE.Matrix4().compose(new THREE.Vector3(0, 0, 0.08), new THREE.Quaternion(), new THREE.Vector3(1, 0.9, 1.15)), color: '#7a7e84', jitter: 0.03 },
    { geo: new THREE.SphereGeometry(0.11, 8, 6), matrix: mat(0, -0.04, 0.3), color: '#5d6166' },
    { geo: new THREE.SphereGeometry(0.03, 5, 4), matrix: mat(0.09, 0.07, 0.2), color: '#111111' },
    { geo: new THREE.SphereGeometry(0.03, 5, 4), matrix: mat(-0.09, 0.07, 0.2), color: '#111111' },
  ], rnd);
  const makeSeal = () => {
    const g = new THREE.Group();
    const body = mesh(bodyGeo, sealMat);
    const neck = new THREE.Group();
    neck.position.set(0, 0.42, 0.7);
    const head = mesh(headGeo, sealMat);
    neck.add(head);
    g.add(body, neck);
    group.add(g);
    return { g, body, neck, head };
  };
  // Hauled out on the skerry: lying about, now and then lifting a head (and all of them, if you
  // come close: they watch you, and the nearest slips off into the water).
  const K = CALF_SKERRY;
  const ashore = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.5, d = rnd() * (K.r - 1.6);
    const x = K.x + Math.sin(a) * d, z = K.z + Math.cos(a) * d;
    const s = makeSeal();
    const sc = 0.8 + rnd() * 0.35;
    s.g.scale.setScalar(sc);
    s.g.position.set(x, heightAt(x, z) + 0.02, z);
    s.g.rotation.y = rnd() * Math.PI * 2;
    ashore.push({ ...s, home: { x, z, yaw: s.g.rotation.y }, ph: rnd() * 20, look: 0, lift: 0, banana: rnd() < 0.35 ? 1 : 0, off: false, t: 0 });
  }
  // In the water: a couple of heads, bobbing upright, drifting round the skerry; they sink out
  // of sight if you come too close, and come up again somewhere else.
  const afloat = [];
  for (let i = 0; i < 2; i++) {
    const s = makeSeal();
    s.body.visible = false;
    s.neck.position.set(0, 0, 0);
    s.head.rotation.x = -0.35;
    afloat.push({ ...s, a: rnd() * 6.28, r: 12 + rnd() * 8, depth: 0, down: 0, t: rnd() * 10, next: 12 + rnd() * 18, spin: (rnd() < 0.5 ? -1 : 1) * 0.03 });
  }

  /* ---------- the race: white ridges where the tide stands up ---------- */
  const foamTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 16;
    const ctx = c.getContext?.('2d');
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 16);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 16);
      const h = ctx.createLinearGradient(0, 0, 64, 0);
      h.addColorStop(0, 'rgba(0,0,0,1)');
      h.addColorStop(0.2, 'rgba(0,0,0,0)');
      h.addColorStop(0.8, 'rgba(0,0,0,0)');
      h.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = h;
      ctx.fillRect(0, 0, 64, 16);
    }
    const tex = new THREE.CanvasTexture(c);
    return tex;
  })();
  const RIDGES = 22;
  const foam = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), RIDGES);
  foam.renderOrder = 2;
  foam.frustumCulled = false;
  group.add(foam);
  const S = CALF_SOUND, len = Math.hypot(S.x1 - S.x0, S.z1 - S.z0);
  const along = { x: (S.x1 - S.x0) / len, z: (S.z1 - S.z0) / len };
  const ridges = [];
  // (Born at whichever end the tide comes in from.)
  const spawn = (r, first = false) => {
    const u = first ? rnd() : rnd() * 0.35 + 0.1;
    r.u = TIDE.flow >= 0 ? u : 1 - u;              // how far along the Sound
    r.v = (rnd() - 0.5) * 18;                      // across it
    r.life = 5 + rnd() * 5;
    r.t = first ? rnd() * r.life : 0;
    r.w = 3 + rnd() * 4.5;
  };
  for (let i = 0; i < RIDGES; i++) {
    const r = {};
    spawn(r, true);
    ridges.push(r);
    foam.setColorAt(i, new THREE.Color(0, 0, 0));
  }
  const _o = new THREE.Object3D(), _c = new THREE.Color(), cur = { x: 0, z: 0 };

  return {
    group, obstacles, spots,
    // (Taken: the slate leaves the ledge.)
    showSlate(on) { slate.visible = on; },
    // Each frame: the seals and the race, only while you're anywhere near (from: where you are).
    update(dt, t, { from }) {
      const d = Math.hypot(from.x - CALF.x, from.z - CALF.z);
      group.visible = d < 700;
      if (!group.visible) return;
      const close = d < 260;
      // Seals ashore.
      const pd = Math.hypot(from.x - K.x, from.z - K.z);
      for (const s of ashore) {
        s.t += dt;
        const alert = smoothstep(32, 16, pd);
        // Now and then a head comes up to look round; everyone looks up if you come close.
        const idle = Math.max(0, Math.sin(t * 0.21 + s.ph) * 1.6 - 0.9);
        s.lift = damp(s.lift, Math.max(idle, alert, s.banana * 0.7), 1.5, dt);
        s.neck.rotation.x = -0.75 * s.lift;
        const toYou = Math.atan2(from.x - s.g.position.x, from.z - s.g.position.z) - s.g.rotation.y;
        s.look = dampAngle(s.look, alert > 0.3 ? clamp(Math.atan2(Math.sin(toYou), Math.cos(toYou)), -1, 1) : Math.sin(t * 0.13 + s.ph) * 0.5, 1.2, dt);
        s.neck.rotation.y = s.look;
        s.body.rotation.x = -0.06 * s.banana * s.lift;
        // Breathing.
        s.body.scale.y = 1 + Math.sin(t * 1.3 + s.ph) * 0.02;
      }
      // Seals afloat: drift round, bob on the swell, and duck under if you come near.
      for (const s of afloat) {
        s.t += dt;
        s.a += s.spin * dt;
        const x = K.x + Math.sin(s.a) * s.r, z = K.z + Math.cos(s.a) * s.r;
        const shy = Math.hypot(from.x - x, from.z - z) < 11;
        s.next -= dt;
        if (s.next <= 0 || shy) {
          // Under for a while, then up again elsewhere round the rock.
          if (s.down === 0) s.down = 1;
          if (s.next <= -6) {
            s.down = 0;
            s.a += 1 + Math.random() * 2;
            s.r = 10 + Math.random() * 12;
            s.next = 14 + Math.random() * 22;
          }
        }
        s.depth = damp(s.depth, s.down ? 1 : 0, 1.4, dt);
        const y = (close ? waveHeight(x, z, t) : 0) + 0.05 - s.depth * 0.9;
        s.g.position.set(x, y, z);
        s.g.rotation.y = s.a + Math.PI / 2 * Math.sign(s.spin);
        s.g.visible = s.depth < 0.95;
      }
      // The race's ridges: born at the upstream end, carried through on the current, fading.
      foam.visible = close;
      if (!close) return;
      ridges.forEach((r, i) => {
        r.t += dt;
        if (r.t > r.life || r.u < 0 || r.u > 1) spawn(r);
        const x = S.x0 + (S.x1 - S.x0) * r.u - along.z * r.v, z = S.z0 + (S.z1 - S.z0) * r.u + along.x * r.v;
        currentAt(x, z, 0, cur);
        r.u += ((cur.x * along.x + cur.z * along.z) * dt) / len;
        const fade = smoothstep(0, 1.2, r.t) * smoothstep(r.life, r.life - 1.8, r.t) * smoothstep(0, 0.12, Math.min(r.u, 1 - r.u));
        const strong = clamp(Math.hypot(cur.x, cur.z) / 0.9, 0, 1);
        _o.position.set(x, waveHeight(x, z, t) + 0.06, z);
        _o.rotation.set(-Math.PI / 2, 0, Math.atan2(along.x, along.z));
        _o.scale.set(r.w, 1.2 + Math.sin(t * 2 + i) * 0.2, 1);
        _o.updateMatrix();
        foam.setMatrixAt(i, _o.matrix);
        const a = 0.75 * fade * strong;
        foam.setColorAt(i, _c.setRGB(a, a, a));
      });
      foam.instanceMatrix.needsUpdate = true;
      if (foam.instanceColor) foam.instanceColor.needsUpdate = true;
    },
  };
}
