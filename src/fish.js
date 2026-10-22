import * as THREE from 'three';
import { lerp, smoothstep, seeded } from './util.js';

const isDay = (h) => h >= 6.2 && h < 19;
const isEvening = (h) => h >= 18.5 || h < 5;
const isTwilight = (h) => (h >= 5 && h < 7.5) || (h >= 17.5 && h < 20.5);

// Every species lives in the shared underwater world (see world/ecosystem.js).
// `life` describes where it lives and how it behaves; there is no separate catch roll:
// the fish you hook is a fish that was really swimming there.
// ctx = { hour, rain (0..1), daylight, night, lanternNear (bool) }
export const FISH = [
  {
    id: 'glassminnow',
    name: 'Glassminnow',
    size: [5, 10],
    visual: 3.6,
    strength: 0.3,
    reel: 0.34,
    colors: { back: '#7fa89c', body: '#cfe6df', belly: '#f5faf7', fin: '#b9d6cf', mark: '#f2f8ff' },
    sketch: { h: 0.26, tail: 0.75, pattern: 'stripe' },
    where: 'Shallow sand and weed edges, in schools',
    hint: 'Silver flickers move together over the shallow sand. A bait kept shallow and still might tempt one.',
    note: 'Clear as a raindrop, with a single silver stripe. Never alone: the whole school turns at once.',
    life: {
      school: true, schools: 12, members: [12, 24],
      speed: 0.85, turn: 3.4, perception: 5, depthTol: 1.0, cover: 'weed',
      homes: ['sand', 'weed'], zones: ['bay', 'cove'],
      depth: ({ night }) => (night > 0.6 ? [0.6, 2.2] : [0.25, 1.6]),
      activity: ({ hour }) => (isDay(hour) ? 1 : isTwilight(hour) ? 0.6 : 0.15),
      likes: { still: 1, slow: 0.7, twitch: 0.4 },
      bite: 0.75, caution: 0.7, rises: () => 0, jumps: 0,
    },
  },
  {
    id: 'sunperch',
    name: 'Sunperch',
    size: [12, 26],
    visual: 2.0,
    strength: 0.65,
    reel: 0.2,
    colors: { back: '#c47b2c', body: '#f0b44a', belly: '#f8e7b4', fin: '#e07a3a', mark: '#a65a2a' },
    sketch: { h: 0.5, tail: 0.5, pattern: 'bars' },
    where: 'Weed beds and rocks in Willow Bay, by day',
    hint: 'Small and golden, flashing around weed beds and rocks where the sun warms the bay. Try the jetty.',
    note: 'Bright as a new coin. Loves weed beds and warm, shallow water.',
    life: {
      group: [3, 6], groups: 14,
      speed: 0.6, turn: 2.2, perception: 7, depthTol: 1.4, cover: 'any',
      homes: ['weed', 'rock'], zones: ['bay', 'cove'],
      depth: () => [0.6, 5],
      activity: ({ hour }) => (isDay(hour) ? 1 : isTwilight(hour) ? 0.55 : 0.15),
      likes: { still: 1, slow: 0.85, twitch: 1.15 },
      bite: 0.6, caution: 1, rises: ({ hour }) => (isTwilight(hour) ? 0.6 : isDay(hour) ? 0.25 : 0), jumps: 0.15,
    },
  },
  {
    id: 'drizzlefin',
    name: 'Drizzlefin',
    size: [30, 58],
    visual: 1.5,
    strength: 1.0,
    reel: 0.15,
    colors: { back: '#3e6a86', body: '#9fb9c8', belly: '#e6eef0', fin: '#5d8aa3', mark: '#2c4a60' },
    sketch: { h: 0.32, tail: 0.8, pattern: 'spots' },
    where: 'Open water past the bay mouth; near the surface in the rain',
    hint: 'Old fishers say it rises out past the bay mouth when rain dimples the sea. On dry days it cruises deep.',
    note: 'Silver-blue with raindrop spots. Comes up beyond the bay when the rain freshens the sea.',
    life: {
      group: [2, 4], groups: 6, range: 1.6,
      speed: 1.25, turn: 1.5, perception: 12, depthTol: 2.0, cover: 'open',
      homes: ['open'], zones: ['open', 'bay'],
      depth: ({ rain }) => (rain > 0.4 ? [0.4, 2.8] : [3, 9]),
      activity: ({ rain }) => 0.3 + rain * 0.7,
      likes: { still: 0.45, slow: 1.3, twitch: 1.2 },
      bite: 0.55, caution: 0.8, rises: ({ rain }) => (rain > 0.4 ? 2.2 : 0.1), jumps: 0.4,
    },
  },
  {
    id: 'duskfin',
    name: 'Duskfin',
    size: [24, 44],
    visual: 1.5,
    strength: 0.85,
    reel: 0.13,
    colors: { back: '#2b2f5e', body: '#4a4f92', belly: '#a497cc', fin: '#ff9d6b', mark: '#ffd28a' },
    sketch: { h: 0.42, tail: 0.7, pattern: 'specks', glow: true },
    where: 'Driftwood Cove after sundown, drawn to lantern light',
    hint: 'Something glows in a hidden cove beyond the eastern headland once the sun goes down. It may like warm light.',
    note: 'Indigo, with fins like embers. Rests deep in the cove by day and drifts up towards warm light after dark.',
    life: {
      group: [2, 3], groups: 5, spacing: 6,
      speed: 0.7, turn: 1.8, perception: 9, depthTol: 1.6, cover: 'rock', lantern: true,
      homes: ['rock', 'weed'], zones: ['cove'],
      depth: ({ hour }) => (isEvening(hour) ? [0.8, 3] : [3.5, 8]),
      activity: ({ hour, lanternNear }) => (isEvening(hour) ? (lanternNear ? 1 : 0.45) : 0.04),
      likes: { still: 1.1, slow: 0.7, twitch: 0.5 },
      bite: 0.6, caution: 1.2, rises: ({ hour }) => (isEvening(hour) ? 0.4 : 0), jumps: 0.2, bubbles: true,
    },
  },
  {
    id: 'mossback',
    name: 'Mossback',
    size: [55, 95],
    visual: 1.25,
    strength: 1.45,
    reel: 0.115,
    colors: { back: '#4d5a3c', body: '#7e7c55', belly: '#cbc39f', fin: '#5f6b45', mark: '#38422c' },
    sketch: { h: 0.44, tail: 0.55, pattern: 'mottle' },
    where: 'The deepest rocks, close to the bottom',
    hint: 'Down by the deepest rocks something large and slow keeps to the bottom. It will not rise for a bait near the surface.',
    note: 'Broad, old and patient, with moss-coloured scales. It only takes a bait resting right by the bottom.',
    life: {
      group: [1, 1], groups: 4, bottom: true,
      speed: 0.4, turn: 0.8, perception: 7, depthTol: 1.8, cover: 'rock',
      homes: ['deep'], zones: ['bay', 'open', 'cove'],
      depth: () => [6, 30],
      activity: ({ hour }) => (isTwilight(hour) ? 0.85 : 0.4),
      likes: { still: 1.2, slow: 0.45, twitch: 0.3 },
      bite: 0.5, caution: 2, rises: () => 0, jumps: 0, bubbles: true,
    },
  },
];

export const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));

// Bigger fish are rarer.
export const rollSize = (f) => Math.round(lerp(f.size[0], f.size[1], Math.pow(Math.random(), 1.7)));

/* ---------------- 3D model ---------------- */

const _c = new THREE.Color();

// One merged, vertex-coloured fish (nose along +z, about 1 unit long) that works both
// as a single mesh and as an InstancedMesh. aGlow marks the fins that glow at night.
export function buildFishGeometry(f) {
  const c = f.colors;
  const back = new THREE.Color(c.back), body = new THREE.Color(c.body), belly = new THREE.Color(c.belly);
  const mark = new THREE.Color(c.mark), fin = new THREE.Color(c.fin);
  const H = f.sketch.h * 0.9, W = 0.2, h2 = H / 2, side = W * 0.42;
  const pos = [], col = [], glow = [];
  const push = (x, y, z, color, g) => {
    pos.push(x, y, z);
    col.push(color.r, color.g, color.b);
    glow.push(g);
  };

  const sphere = new THREE.SphereGeometry(0.5, 14, 10);
  const p = sphere.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const k = z < 0 ? lerp(1, 0.32, smoothstep(0, -0.5, z)) : lerp(1, 0.75, smoothstep(0.25, 0.5, z));
    p.setXYZ(i, p.getX(i) * W * k, p.getY(i) * H * k, z);
  }
  const bodyGeo = sphere.toNonIndexed();
  const bp = bodyGeo.attributes.position;
  const rnd = seeded(f.id.length * 97 + f.id.charCodeAt(1));
  for (let i = 0; i < bp.count; i += 3) {
    const y = (bp.getY(i) + bp.getY(i + 1) + bp.getY(i + 2)) / 3 / h2;
    const z = (bp.getZ(i) + bp.getZ(i + 1) + bp.getZ(i + 2)) / 3;
    _c.copy(belly).lerp(body, smoothstep(-0.7, 0.0, y)).lerp(back, smoothstep(0.25, 0.85, y));
    const r = rnd();
    const pat = f.sketch.pattern;
    if (pat === 'bars' && y > -0.45 && z < 0.28 && z > -0.38 && Math.sin(z * 26 + 1) > 0.45) _c.lerp(mark, 0.55);
    if (pat === 'spots' && y > -0.2 && r > 0.8) _c.lerp(mark, 0.75);
    if (pat === 'specks' && r > 0.86) _c.copy(mark);
    if (pat === 'stripe' && Math.abs(y) < 0.2 && z > -0.42 && z < 0.36) _c.lerp(mark, 0.85);
    if (pat === 'mottle' && y > -0.35 && r > 0.62) _c.lerp(mark, 0.55);
    for (let k = 0; k < 3; k++) push(bp.getX(i + k), bp.getY(i + k), bp.getZ(i + k), _c, 0);
  }
  bodyGeo.dispose();
  sphere.dispose();

  const g = f.sketch.glow ? 1 : 0;
  const t = f.sketch.tail;
  const tri = (verts) => { for (let i = 0; i < verts.length; i += 3) push(verts[i], verts[i + 1], verts[i + 2], fin, g); };
  const tz = -0.42;
  tri([
    0, 0, tz, 0, h2 * 1.4 * t + 0.05, tz - 0.36, 0, 0.02, tz - 0.22,
    0, 0, tz, 0, -0.02, tz - 0.22, 0, -h2 * 1.4 * t - 0.05, tz - 0.36,
    0, h2 * 0.85, 0.12, 0, h2 * 1.6, -0.05, 0, h2 * 0.7, -0.28,
    0, -h2 * 0.7, -0.08, 0, -h2 * 1.25, -0.22, 0, -h2 * 0.6, -0.3,
    side, -h2 * 0.2, 0.18, side + 0.12, -h2 * 0.55, 0.0, side, -h2 * 0.3, 0.02,
    -side, -h2 * 0.2, 0.18, -side - 0.12, -h2 * 0.55, 0.0, -side, -h2 * 0.3, 0.02,
  ]);

  const eye = new THREE.IcosahedronGeometry(0.032, 0); // already non-indexed
  const ep = eye.attributes.position;
  _c.set('#1a1512');
  for (const s of [1, -1]) {
    for (let i = 0; i < ep.count; i++) push(ep.getX(i) + s * side * 0.85, ep.getY(i) + h2 * 0.2, ep.getZ(i) + 0.3, _c, 0);
  }
  eye.dispose();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  geo.computeVertexNormals();
  return geo;
}

// The tail sways with a travelling wave. Instanced fish read their swim phase and
// effort from an attribute; a single fish reads it from material.userData.swim.
export function fishMaterial(f, instanced) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.38, metalness: 0.18, flatShading: true, side: THREE.DoubleSide,
  });
  const glow = new THREE.Color(f.sketch.glow ? f.colors.fin : '#000000');
  m.userData.swim = { value: new THREE.Vector2(0, 0.3) };
  m.userData.glow = { value: f.sketch.glow ? 1 : 0 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGlowColor = { value: glow };
    shader.uniforms.uGlow = m.userData.glow;
    shader.uniforms.uSwimU = m.userData.swim;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aGlow;
        varying float vGlow;
        ${instanced ? 'attribute vec2 aSwim;' : 'uniform vec2 uSwimU;'}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 sw = ${instanced ? 'aSwim' : 'uSwimU'};
        float bend = smoothstep(0.3, -0.8, position.z);
        transformed.x += sin(sw.x - position.z * 4.0) * bend * (0.03 + sw.y * 0.1);
        vGlow = aGlow;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlowColor;\nuniform float uGlow;\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowColor * vGlow * uGlow + diffuseColor.rgb * 0.16;');
  };
  m.customProgramCacheKey = () => (instanced ? 'fish-instanced' : 'fish-single');
  return m;
}

// A single fish, used while one is hooked, landed and held up for a look.
export function buildFishMesh(f) {
  const mesh = new THREE.Mesh(buildFishGeometry(f), fishMaterial(f, false));
  mesh.castShadow = true;
  mesh.visible = false;
  mesh.userData.swim = mesh.material.userData.swim.value;
  return mesh;
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
  } else if (f.sketch.pattern === 'stripe') {
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-L * 0.3, -H * 0.06, L * 0.7, H * 0.12);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-L * 0.3, H * 0.08, L * 0.7, H * 0.3);
  } else if (f.sketch.pattern === 'mottle') {
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.ellipse(L * (0.34 - rnd() * 0.64), -H * (rnd() * 0.42), L * (0.02 + rnd() * 0.035), H * (0.05 + rnd() * 0.08), rnd() * 3, 0, Math.PI * 2);
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
