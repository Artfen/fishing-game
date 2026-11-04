import * as THREE from 'three';
import { waveHeight } from './water.js';
import { mergeParts, mat, clamp } from '../util.js';
import { CROSSING_HOMES } from './habitat.js';

// What you see out on the crossing to Las Brasas besides the fish, dolphins and whales (see
// crossing.js): rafts of floating sargassum weed in the warm water, golden-brown mats drifting in
// lines with the wind, where the dorado lurk underneath (the same fish that live there: see
// habitat.js CROSSING_HOMES); flying fish bursting out ahead of a boat going along, gliding low
// over the waves on their long clear fins and dropping back in; and now and then a ship, crossing
// the route on her way between the Channel and the islands, who won't turn for anybody.

const rand = (a, b) => a + Math.random() * (b - a);

// A mat of sargassum: a ragged patch of golden-brown weed with its little air bladders, flat on
// the water, a few metres across.
function weedGeometry(seed) {
  const parts = [];
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 26; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 4.2;
    parts.push({ geo: new THREE.CircleGeometry(0.6 + r() * 0.9, 6), matrix: mat(Math.cos(a) * d * 1.6, 0.02 + r() * 0.03, Math.sin(a) * d, -Math.PI / 2, 0, r() * 6), color: ['#9a7a2e', '#b08a36', '#7e6626', '#a8873e'][k % 4] });
  }
  for (let k = 0; k < 40; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 4.6;
    parts.push({ geo: new THREE.IcosahedronGeometry(0.07, 0), matrix: mat(Math.cos(a) * d * 1.6, 0.06, Math.sin(a) * d), color: '#c8a248' });
  }
  return mergeParts(parts);
}

// A flying fish: a slim blue-backed body and long clear wing-fins.
function flyerGeometry() {
  return mergeParts([
    { geo: new THREE.SphereGeometry(0.05, 8, 5), matrix: mat(0, 0, 0, 0, 0, 0, 0.8, 0.7, 3.4), color: '#2f5f9a' },
    { geo: new THREE.SphereGeometry(0.045, 8, 5), matrix: mat(0, -0.012, 0, 0, 0, 0, 0.7, 0.5, 3.2), color: '#d8e4ec' },
    { geo: new THREE.PlaneGeometry(0.5, 0.12), matrix: mat(0, 0.01, 0.03, -Math.PI / 2, 0, 0), color: '#b8d0e0' },
    { geo: new THREE.ConeGeometry(0.05, 0.14, 4), matrix: mat(0, 0, -0.22, -Math.PI / 2, 0, 0, 1.2, 1, 0.4), color: '#2f5f9a' },
  ]);
}

// A small container ship, about sixty metres: a dark hull with a raked bow and a red boot-top,
// coloured boxes stacked forward, the white bridge block aft with its wings and the funnel behind,
// a mast forward and one on the bridge. +z is her bow; y 0 her waterline.
export const SHIP = { len: 62, beam: 11, draft: 3.4, speed: 6.2 };
function shipGeometry(seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const hull = ['#1f2a3d', '#1d1f22', '#6b2620'][Math.floor(r() * 3)];
  const H = SHIP, L = H.len, B = H.beam, parts = [];
  // The hull in plan: square at the stern, a long pointed bow. (The shape's y runs towards the
  // stern; extruded up, then turned so its depth is her height.)
  const shape = new THREE.Shape();
  shape.moveTo(-B / 2, L / 2);
  shape.lineTo(B / 2, L / 2);
  shape.lineTo(B / 2, -L / 2 + 12);
  shape.quadraticCurveTo(B / 2 - 0.6, -L / 2 + 3, 0, -L / 2);
  shape.quadraticCurveTo(-B / 2 + 0.6, -L / 2 + 3, -B / 2, -L / 2 + 12);
  shape.closePath();
  const ext = (h, y0) => new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, y0, 0);
  parts.push({ geo: ext(H.draft + 0.6, -H.draft), matrix: mat(0, 0, 0), color: '#7a2a22' });
  parts.push({ geo: ext(5.2, 0.6), matrix: mat(0, 0, 0), color: hull });
  parts.push({ geo: ext(0.15, 5.8), matrix: mat(0, 0, 0, 0, 0, 0, 0.98, 1, 0.98), color: '#59605c' });
  // Containers: rows across her, two or three high, from the bridge to the bow.
  const C = ['#b8442e', '#2f6f8f', '#d9a03a', '#3f7d4a', '#8c8f93', '#e4e2da', '#5a4a8a', '#a0523a'];
  for (let z = -14; z < L / 2 - 14; z += 6.4) {
    const tiers = 2 + Math.floor(r() * 2);
    for (let x = -3.75; x <= 3.76; x += 2.5) {
      for (let k = 0; k < tiers; k++) {
        if (k === tiers - 1 && r() < 0.25) continue;
        parts.push({ geo: new THREE.BoxGeometry(2.4, 2.55, 6.1), matrix: mat(x, 5.95 + 1.3 + k * 2.6, z), color: C[Math.floor(r() * C.length)] });
      }
    }
  }
  // The bridge block, aft: its decks, windows and wings; the funnel behind it; the masts.
  const az = L / 2 - 9;
  parts.push({ geo: new THREE.BoxGeometry(B - 1.2, 10, 8), matrix: mat(0, 5.9 + 5, az), color: '#e8e6df' });
  parts.push({ geo: new THREE.BoxGeometry(B + 1.6, 2.4, 3.2), matrix: mat(0, 5.9 + 9.2, az - 2.2), color: '#e8e6df' });
  parts.push({ geo: new THREE.BoxGeometry(B + 1.62, 0.8, 0.1), matrix: mat(0, 5.9 + 9.4, az - 3.82), color: '#283038' });
  for (const y of [7.4, 10.2]) parts.push({ geo: new THREE.BoxGeometry(B - 1.18, 0.6, 0.1), matrix: mat(0, 5.9 + y, az - 4.02), color: '#283038' });
  parts.push({ geo: new THREE.BoxGeometry(2.6, 5, 3.4), matrix: mat(0, 5.9 + 12.5, az + 4.2), color: '#c8a23a' });
  parts.push({ geo: new THREE.BoxGeometry(2.64, 1.2, 3.44), matrix: mat(0, 5.9 + 14.6, az + 4.2), color: '#1d1f22' });
  parts.push({ geo: new THREE.CylinderGeometry(0.18, 0.22, 7, 6), matrix: mat(0, 5.9 + 14, az - 1), color: '#e8e6df' });
  parts.push({ geo: new THREE.CylinderGeometry(0.2, 0.25, 9, 6), matrix: mat(0, 5.9 + 4.5, -L / 2 + 6), color: '#e8e6df' });
  return mergeParts(parts);
}

export function buildCrossingLife(scene) {
  const group = new THREE.Group();
  group.name = 'crossing-life';
  scene.add(group);
  const plain = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  // The weed rafts: one at each home with dorado under it, drifting a little round it.
  const weeds = CROSSING_HOMES.filter((h) => h.weed).map((h, i) => {
    const m = new THREE.Mesh(weedGeometry(1234 + i * 97), plain);
    m.position.set(h.x, 0, h.z);
    m.rotation.y = i * 1.7;
    m.visible = false;
    group.add(m);
    return { m, h, ph: i * 2.1 };
  });
  // The flyers: a few at a time, launched from ahead of the bow.
  const flyGeo = flyerGeometry();
  const flyers = Array.from({ length: 10 }, () => {
    const m = new THREE.Mesh(flyGeo, plain);
    m.rotation.order = 'YXZ';
    m.visible = false;
    group.add(m);
    return { m, t: 0, dur: 0, x0: 0, z0: 0, dx: 0, dz: 0, len: 0, h: 0, live: false };
  });
  let flyT = 0, flyUntil = 0;
  const events = { onSighting: null, onPlop: null, onHorn: null, onWake: null };
  // The ship, and her navigation lights (masthead and steaming lights white, red to port, green
  // to starboard, white over the stern), lit after dark: they shine through the haze.
  const shipMesh = new THREE.Mesh(shipGeometry(4242), new THREE.MeshLambertMaterial({ vertexColors: true }));
  shipMesh.visible = false;
  group.add(shipMesh);
  const lamp = (color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color, fog: false }));
    m.position.set(x, y, z);
    shipMesh.add(m);
    return m;
  };
  const az = SHIP.len / 2 - 9;
  const lamps = [
    lamp('#fff6dc', 0, 5.9 + 9.6, -SHIP.len / 2 + 6), lamp('#fff6dc', 0, 5.9 + 17.6, az - 1),
    lamp('#ff3b2e', -(SHIP.beam / 2 + 0.8), 5.9 + 9.6, az - 2.2), lamp('#3bff6a', SHIP.beam / 2 + 0.8, 5.9 + 9.6, az - 2.2),
    lamp('#fff6dc', 0, 5.9 + 3, SHIP.len / 2 + 0.2),
  ];
  const ship = { live: false, x: 0, z: 0, heading: 0, t: 0, horned: false, wakeT: 0 };

  return {
    group, weeds, flyers, events, ship, shipMesh,
    // A ship crossing the route ahead: from off one bow (side: 1 starboard, -1 port), across your
    // course well ahead of you, and away. B: your boat ({ pos, fwd, right }).
    sendShip(B, side = 1, angle = 0) {
      const ahead = 1050, off = 950;
      Object.assign(ship, {
        live: true, t: 0, horned: false, wakeT: 0,
        x: B.pos.x + B.fwd.x * ahead + B.right.x * off * side, z: B.pos.z + B.fwd.z * ahead + B.right.z * off * side,
        // (Heading back across: towards the other side.)
        heading: Math.atan2(-B.right.x * side, -B.right.z * side) + angle,
      });
    },
    // A while of flying fish ahead of the boat (seconds), from the crossing's encounters.
    flyingFish(secs) {
      flyUntil = Math.max(flyUntil, secs);
      flyT = 0.5;
    },
    get flying() { return flyUntil > 0; },
    // ctx: { from, boat (aboard, under way, or null), boatSpeed, crossing (out on it) }
    update(dt, t, ctx) {
      // The weed, near enough to see.
      for (const W of weeds) {
        const d = Math.hypot(W.h.x - ctx.from.x, W.h.z - ctx.from.z);
        W.m.visible = d < 700;
        if (!W.m.visible) continue;
        const x = W.h.x + Math.sin(t * 0.02 + W.ph) * 6, z = W.h.z + Math.cos(t * 0.017 + W.ph) * 6;
        W.m.position.set(x, waveHeight(x, z, t) - 0.03, z);
      }
      flyUntil = Math.max(0, flyUntil - dt);
      // A boat going along at a fair clip puts them up: a few at a time, off either bow, gliding
      // ahead and away.
      const B = ctx.boat, sp = ctx.boatSpeed || 0;
      if (flyUntil > 0 && B && sp > 1.8) {
        flyT -= dt;
        if (flyT <= 0) {
          flyT = rand(1.2, 4);
          const n = 1 + Math.floor(Math.random() * 4);
          for (let k = 0; k < n; k++) {
            const f = flyers.find((q) => !q.live);
            if (!f) break;
            const side = Math.random() < 0.5 ? -1 : 1, ahead = rand(4, 10);
            const a = Math.atan2(B.fwd.x, B.fwd.z) + side * rand(0.3, 0.9);
            Object.assign(f, {
              live: true, t: 0, dur: rand(1.4, 2.6), len: rand(14, 32), h: rand(0.4, 1.2),
              x0: B.pos.x + B.fwd.x * ahead + B.right.x * side * rand(1, 4), z0: B.pos.z + B.fwd.z * ahead + B.right.z * side * rand(1, 4),
              dx: Math.sin(a), dz: Math.cos(a),
            });
            events.onPlop?.(f.x0, f.z0, 0.5);
          }
          events.onSighting?.('flyingfish', B.pos.x, B.pos.z);
        }
      }
      // The ship: steady as she goes, the swell barely moving her, and gone when she's well past.
      if (ship.live) {
        ship.t += dt;
        ship.x += Math.sin(ship.heading) * SHIP.speed * dt;
        ship.z += Math.cos(ship.heading) * SHIP.speed * dt;
        const d = Math.hypot(ship.x - ctx.from.x, ship.z - ctx.from.z);
        shipMesh.visible = d < 3200;
        shipMesh.position.set(ship.x, waveHeight(ship.x, ship.z, t) * 0.25, ship.z);
        shipMesh.rotation.set(Math.sin(t * 0.31) * 0.012, ship.heading, Math.sin(t * 0.23 + 1) * 0.02, 'YXZ');
        const lit = (ctx.night ?? 0) > 0.25;
        for (const m of lamps) m.visible = lit;
        // A long blast if you're too close to her (and only the once).
        if (!ship.horned && d < 320) {
          ship.horned = true;
          events.onHorn?.(ship.x, ship.z);
        }
        ship.wakeT -= dt;
        if (ship.wakeT <= 0 && d < 1500) {
          ship.wakeT = 0.35;
          events.onWake?.(ship.x - Math.sin(ship.heading) * SHIP.len * 0.45, ship.z - Math.cos(ship.heading) * SHIP.len * 0.45);
          events.onWake?.(ship.x + Math.sin(ship.heading) * SHIP.len * 0.5, ship.z + Math.cos(ship.heading) * SHIP.len * 0.5, 0.6);
        }
        if (ship.t > 60 && d > 2600) {
          ship.live = false;
          shipMesh.visible = false;
        }
      }
      for (const f of flyers) {
        if (!f.live) {
          f.m.visible = false;
          continue;
        }
        f.t += dt;
        const u = clamp(f.t / f.dur, 0, 1);
        const x = f.x0 + f.dx * f.len * u, z = f.z0 + f.dz * f.len * u;
        const s = waveHeight(x, z, t);
        // Up out of the water, a long flat glide just over the crests, and down.
        const y = s + f.h * Math.min(1, u * 6) * Math.min(1, (1 - u) * 5) + Math.sin(u * 9) * 0.05;
        f.m.position.set(x, y, z);
        f.m.rotation.set(-0.05, Math.atan2(f.dx, f.dz), Math.sin(t * 20) * 0.1);
        f.m.visible = true;
        if (u >= 1) {
          f.live = false;
          events.onPlop?.(x, z, 0.35);
        }
      }
    },
  };
}
