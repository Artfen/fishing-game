import * as THREE from 'three';
import { lerp, smoothstep, seeded } from './util.js';

const isDay = (h) => h >= 6 && h < 19;
const isEvening = (h) => h >= 18.5 || h < 5;

// Each fish has a weight function: how likely it is to bite given where and when you fish.
// ctx = { zone: 'bay' | 'cove' | 'open', hour, rain (0..1), lantern (bool), depth }
export const FISH = [
  {
    id: 'sunperch',
    name: 'Sunperch',
    size: [12, 26],
    strength: 0.65,
    reel: 0.2,
    colors: { back: '#c47b2c', body: '#f0b44a', belly: '#f8e7b4', fin: '#e07a3a', mark: '#a65a2a' },
    sketch: { h: 0.5, tail: 0.5, pattern: 'bars' },
    where: 'Willow Bay shallows, by day',
    hint: 'Small and golden, flashing wherever the sun warms the shallows. Try the bay during the day.',
    note: 'Bright as a new coin. Happiest in warm, shallow water.',
    weight({ zone, hour, rain, depth }) {
      let w = zone === 'bay' ? 1 : zone === 'cove' ? 0.45 : 0.3;
      w *= isDay(hour) ? 1 : 0.3;
      if (depth < 7) w *= 1.25;
      return w * (1 - rain * 0.3);
    },
  },
  {
    id: 'drizzlefin',
    name: 'Drizzlefin',
    size: [30, 58],
    strength: 1.0,
    reel: 0.15,
    colors: { back: '#3e6a86', body: '#9fb9c8', belly: '#e6eef0', fin: '#5d8aa3', mark: '#2c4a60' },
    sketch: { h: 0.32, tail: 0.8, pattern: 'spots' },
    where: 'Open water past the bay mouth, in the rain',
    hint: 'Old fishers say it rises out past the bay mouth when rain dimples the sea.',
    note: 'Silver-blue with raindrop spots. Comes up beyond the bay when the rain freshens the sea.',
    weight({ zone, rain }) {
      const base = zone === 'open' ? 0.06 : zone === 'bay' ? 0.01 : 0;
      return base * (1 + rain * 14);
    },
  },
  {
    id: 'duskfin',
    name: 'Duskfin',
    size: [24, 44],
    strength: 0.85,
    reel: 0.13,
    colors: { back: '#2b2f5e', body: '#4a4f92', belly: '#a497cc', fin: '#ff9d6b', mark: '#ffd28a' },
    sketch: { h: 0.42, tail: 0.7, pattern: 'specks', glow: true },
    where: 'Driftwood Cove after sundown, drawn to lantern light',
    hint: 'Something glows in a hidden cove beyond the eastern headland once the sun goes down. It may like warm light.',
    note: 'Indigo, with fins like embers. Rises in the cove after dark and drifts towards warm light.',
    weight({ zone, hour, lantern }) {
      if (zone !== 'cove' || !isEvening(hour)) return 0;
      return lantern ? 1.5 : 0.12;
    },
  },
];

export const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));

export function pickFish(ctx) {
  const ws = FISH.map((f) => Math.max(0, f.weight(ctx)));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return { fish: FISH[0], total: 0.1 };
  let r = Math.random() * total;
  for (let i = 0; i < FISH.length; i++) {
    r -= ws[i];
    if (r <= 0) return { fish: FISH[i], total };
  }
  return { fish: FISH[FISH.length - 1], total };
}

// Bigger fish are rarer.
export const rollSize = (f) => Math.round(lerp(f.size[0], f.size[1], Math.pow(Math.random(), 1.7)));

/* ---------------- 3D model ---------------- */

export function buildFishMesh(f) {
  const c = f.colors;
  const back = new THREE.Color(c.back), body = new THREE.Color(c.body), belly = new THREE.Color(c.belly), mark = new THREE.Color(c.mark);
  const H = f.sketch.h * 0.9, W = 0.2, h2 = H / 2, side = W * 0.42;
  const sphere = new THREE.SphereGeometry(0.5, 16, 12);
  const p = sphere.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    // Taper towards the tail, slightly pointed at the nose.
    const k = z < 0 ? lerp(1, 0.32, smoothstep(0, -0.5, z)) : lerp(1, 0.75, smoothstep(0.25, 0.5, z));
    p.setXYZ(i, p.getX(i) * W * k, p.getY(i) * H * k, z);
  }
  const geo = sphere.toNonIndexed();
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  const rnd = seeded(f.id.length * 97);
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 / h2;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    tmp.copy(belly).lerp(body, smoothstep(-0.7, 0.0, y)).lerp(back, smoothstep(0.25, 0.85, y));
    const r = rnd();
    if (f.sketch.pattern === 'bars' && y > -0.45 && z < 0.28 && z > -0.38 && Math.sin(z * 26 + 1) > 0.45) tmp.lerp(mark, 0.55);
    if (f.sketch.pattern === 'spots' && y > -0.2 && r > 0.8) tmp.lerp(mark, 0.75);
    if (f.sketch.pattern === 'specks' && r > 0.86) tmp.copy(mark);
    for (let k = 0; k < 3; k++) col.set([tmp.r, tmp.g, tmp.b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();

  const group = new THREE.Group();
  const bodyMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.35, metalness: 0.2, flatShading: true,
    emissive: f.sketch.glow ? '#1d1846' : '#000000',
  }));
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  const finMat = new THREE.MeshStandardMaterial({
    color: c.fin, side: THREE.DoubleSide, roughness: 0.5, flatShading: true,
    emissive: f.sketch.glow ? c.fin : '#000000', emissiveIntensity: f.sketch.glow ? 1.1 : 0,
  });
  const tri = (verts) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, finMat);
  };
  const t = f.sketch.tail;
  const tail = tri([
    0, 0, 0, 0, h2 * 1.4 * t + 0.05, -0.36, 0, 0.02, -0.22,
    0, 0, 0, 0, -0.02, -0.22, 0, -h2 * 1.4 * t - 0.05, -0.36,
  ]);
  tail.position.z = -0.42;
  const fins = tri([
    0, h2 * 0.85, 0.12, 0, h2 * 1.6, -0.05, 0, h2 * 0.7, -0.28,
    0, -h2 * 0.7, -0.08, 0, -h2 * 1.25, -0.22, 0, -h2 * 0.6, -0.3,
    side, -h2 * 0.2, 0.18, side + 0.12, -h2 * 0.55, 0.0, side, -h2 * 0.3, 0.02,
    -side, -h2 * 0.2, 0.18, -side - 0.12, -h2 * 0.55, 0.0, -side, -h2 * 0.3, 0.02,
  ]);
  group.add(tail, fins);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#1a1512' });
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), eyeMat);
    eye.position.set(s * side * 0.85, h2 * 0.2, 0.3);
    group.add(eye);
  }
  group.userData.tail = tail;
  group.visible = false;
  return group;
}

/* ---------------- journal sketch ---------------- */

export function drawFishSketch(ctx, f, cx, cy, len, { unknown = false } = {}) {
  const L = len, H = len * f.sketch.h, c = f.colors, t = f.sketch.tail;
  const rnd = seeded(f.id.charCodeAt(0) * 31 + f.id.length);
  ctx.save();
  ctx.translate(cx, cy);

  const body = new Path2D();
  body.moveTo(L * 0.5, 0);
  body.bezierCurveTo(L * 0.44, -H * 0.66, -L * 0.06, -H * 0.62, -L * 0.3, -H * 0.1);
  body.lineTo(-L * 0.3, H * 0.1);
  body.bezierCurveTo(-L * 0.06, H * 0.56, L * 0.44, H * 0.52, L * 0.5, 0);
  body.closePath();

  const tail = new Path2D();
  tail.moveTo(-L * 0.27, 0);
  tail.quadraticCurveTo(-L * 0.38, -H * 0.15, -L * 0.5, -H * (0.55 * t + 0.1));
  tail.quadraticCurveTo(-L * 0.42, 0, -L * 0.5, H * (0.55 * t + 0.1));
  tail.quadraticCurveTo(-L * 0.38, H * 0.15, -L * 0.27, 0);

  const dorsal = new Path2D();
  dorsal.moveTo(L * 0.16, -H * 0.47);
  dorsal.quadraticCurveTo(L * 0.0, -H * 1.0, -L * 0.2, -H * 0.3);
  dorsal.quadraticCurveTo(-L * 0.02, -H * 0.45, L * 0.16, -H * 0.47);

  const anal = new Path2D();
  anal.moveTo(-L * 0.02, H * 0.4);
  anal.quadraticCurveTo(-L * 0.1, H * 0.78, -L * 0.2, H * 0.3);
  anal.quadraticCurveTo(-L * 0.1, H * 0.38, -L * 0.02, H * 0.4);

  const pect = new Path2D();
  pect.moveTo(L * 0.2, H * 0.08);
  pect.quadraticCurveTo(L * 0.08, H * 0.32, L * 0.04, H * 0.18);
  pect.quadraticCurveTo(L * 0.12, H * 0.08, L * 0.2, H * 0.08);

  const ink = '#3a2e26';
  if (unknown) {
    ctx.fillStyle = 'rgba(58, 46, 38, 0.1)';
    for (const p of [tail, dorsal, anal, body]) ctx.fill(p);
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(58, 46, 38, 0.45)';
    ctx.lineWidth = 1.4;
    for (const p of [tail, dorsal, body]) ctx.stroke(p);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(58, 46, 38, 0.55)';
    ctx.font = `700 ${Math.round(H * 0.75)}px Caveat, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', L * 0.06, H * 0.02);
    ctx.restore();
    return;
  }

  if (f.sketch.glow) {
    ctx.shadowColor = c.fin;
    ctx.shadowBlur = L * 0.08;
  }
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = c.fin;
  for (const p of [tail, dorsal, anal]) ctx.fill(p);
  ctx.shadowBlur = 0;

  const g = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
  g.addColorStop(0, c.back);
  g.addColorStop(0.45, c.body);
  g.addColorStop(1, c.belly);
  ctx.fillStyle = g;
  ctx.fill(body);
  // Watercolour bleed
  ctx.globalAlpha = 0.22;
  ctx.save();
  ctx.translate(L * 0.008, L * 0.006);
  ctx.fill(body);
  ctx.restore();

  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = c.mark;
  if (f.sketch.pattern === 'bars') {
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 6; i++) {
      const x = L * (0.24 - i * 0.09);
      ctx.beginPath();
      ctx.ellipse(x, -H * 0.12, L * 0.022, H * 0.36, 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.sketch.pattern === 'spots') {
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 22; i++) {
      ctx.beginPath();
      ctx.arc(L * (0.32 - rnd() * 0.6), -H * (0.05 + rnd() * 0.35), L * (0.008 + rnd() * 0.01), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = c.mark;
    ctx.shadowBlur = L * 0.02;
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.arc(L * (0.38 - rnd() * 0.66), H * (rnd() - 0.6) * 0.8, L * (0.004 + rnd() * 0.006), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = c.fin;
  ctx.fill(pect);

  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.2, L * 0.008);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of [body, tail, dorsal, anal, pect]) ctx.stroke(p);
  // A second, lighter pass makes it feel hand-inked.
  ctx.globalAlpha = 0.28;
  ctx.save();
  ctx.translate(L * 0.004, -L * 0.003);
  ctx.stroke(body);
  ctx.stroke(tail);
  ctx.restore();

  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(L * 0.14, 0, H * 0.4, -0.75, 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(L * 0.5, H * 0.02);
  ctx.lineTo(L * 0.44, H * 0.05);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(L * 0.36, -H * 0.1, Math.max(2, H * 0.07), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(L * 0.365, -H * 0.12, Math.max(0.8, H * 0.022), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawLanternSketch(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  const ink = '#3a2e26';
  const glow = ctx.createRadialGradient(0, s * 0.1, 0, 0, s * 0.1, s * 0.9);
  glow.addColorStop(0, 'rgba(255, 196, 110, 0.55)');
  glow.addColorStop(1, 'rgba(255, 196, 110, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-s, -s, s * 2, s * 2);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(255, 214, 140, 0.75)';
  ctx.beginPath();
  ctx.rect(-s * 0.28, -s * 0.2, s * 0.56, s * 0.62);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b98b3f';
  ctx.beginPath();
  ctx.moveTo(-s * 0.36, -s * 0.2);
  ctx.lineTo(0, -s * 0.48);
  ctx.lineTo(s * 0.36, -s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-s * 0.36, s * 0.42, s * 0.72, s * 0.1);
  ctx.strokeRect(-s * 0.36, s * 0.42, s * 0.72, s * 0.1);
  ctx.beginPath();
  ctx.arc(0, -s * 0.58, s * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.09, -s * 0.2);
  ctx.lineTo(-s * 0.09, s * 0.42);
  ctx.moveTo(s * 0.09, -s * 0.2);
  ctx.lineTo(s * 0.09, s * 0.42);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 170, 70, 0.9)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.14, s * 0.06, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
