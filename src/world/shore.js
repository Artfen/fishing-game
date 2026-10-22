import * as THREE from 'three';
import {
  heightAt, lakeSDF, streamSDF, pathInfo,
  CAMP, LAKE, STREAM, LANDING, SNAG, LILIES, PEGS, BRIDGE, STONES,
} from './terrain.js';
import { mergeParts, mat, fbm, clamp, lerp, smoothstep, jitterGeo, pick, glowTexture } from '../util.js';
import { buildLanternModel } from '../props.js';
import { withCaustics } from './caustics.js';

// The west shore, built on the map in terrain.js: the landing pier, camp (tent, fire,
// tackle chest and rod rack), the lake's reeds, lily pads and fallen alder, the stream's
// boulders, bridge and stepping stones, and the small living touches (grass, ferns,
// morning mist and hatching flies).

export const SHORE_PATCH = { x0: -195, x1: -84, z0: -110, z1: 14 };

const shared = { uTime: { value: 0 }, uWind: { value: 1 } };

// Lambert with wind sway above a height (reeds, grass, ferns).
function swayMaterial(from = 0.15, amount = 0.08, side = THREE.FrontSide) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uWind = shared.uWind;
    shader.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 ip = vec3(0.0);
      #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xyz;
      #endif
      float sw = max(position.y - ${from.toFixed(2)}, 0.0);
      sw *= sw;
      float ph = uTime * 1.6 + ip.x * 0.31 + ip.z * 0.23;
      float gust = 0.6 + 0.4 * sin(uTime * 0.37 + ip.x * 0.05);
      transformed.x += (sin(ph) * 0.7 + sin(ph * 2.3 + 1.0) * 0.3) * ${amount.toFixed(3)} * sw * uWind * gust;
      transformed.z += cos(ph * 0.8) * ${(amount * 0.6).toFixed(3)} * sw * uWind * gust;`,
    );
  };
  m.customProgramCacheKey = () => `shore-sway-${from}-${amount}-${side}`;
  return m;
}

function instanced(geo, list, material, rnd, { tint = 0.1, shadows = true } = {}) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(list.length, 1));
  m.count = list.length;
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  list.forEach((t, i) => {
    o.position.set(t.x, t.y, t.z);
    o.rotation.set(t.rx || 0, t.r || 0, t.rz || 0);
    o.scale.set(t.sx || t.s, t.sy || t.s, t.sz || t.s);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (t.color) c.set(t.color);
    else {
      const v = 1 - tint + rnd() * tint * 2;
      c.setRGB(v * (0.97 + rnd() * 0.06), v, v * (0.95 + rnd() * 0.08));
    }
    m.setColorAt(i, c);
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = shadows;
  m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}

const UP = new THREE.Vector3(0, 1, 0);
function beam(a, b, r0, r1 = r0, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const m = new THREE.Matrix4().compose(
    a.clone().addScaledVector(d, 0.5),
    new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()),
    new THREE.Vector3(1, 1, 1),
  );
  return { geo: new THREE.CylinderGeometry(r1, r0, len, seg), matrix: m };
}

// A matrix placing a part in a frame at (x, y, z) turned by yaw.
function placed(x, y, z, yaw, lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return mat(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, rx, yaw + ry, rz, sx, sy, sz);
}

/* ---------------- the landing ---------------- */

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const draw = () => {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = '#b48d63';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = 'rgba(80, 55, 35, 0.25)';
    for (let i = 0; i < 9; i++) ctx.fillRect(0, 8 + i * 14, 256, 1.5);
    ctx.fillStyle = '#3a2a1c';
    ctx.font = '700 40px Kalam, Caveat, cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('← Camp', 128, 40);
    ctx.font = '700 26px Kalam, Caveat, cursive';
    ctx.fillText('Reedmere · Fernbeck', 128, 92);
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  draw();
  document.fonts?.ready?.then(draw).catch(() => {});
  return tex;
}

function buildLanding(rnd, parts, obstacles) {
  const { x, z, deck, len } = LANDING;
  const PLANKS = ['#b48d63', '#a57f59', '#c09a70', '#9d7a58', '#b89268'];
  const x0 = x - 2.5, x1 = x + len;
  for (let px = x0 + 0.17; px < x1; px += 0.34) {
    parts.push({
      geo: new THREE.BoxGeometry(0.3, 0.07, 1.8 + (rnd() - 0.5) * 0.1),
      matrix: mat(px, deck + (rnd() - 0.5) * 0.02, z + (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.03, (rnd() - 0.5) * 0.03, 0),
      color: pick(PLANKS, rnd),
      jitter: 0.04,
    });
  }
  for (const sz of [-0.62, 0.62]) parts.push({ geo: new THREE.BoxGeometry(x1 - x0, 0.18, 0.14), matrix: mat((x0 + x1) / 2, deck - 0.13, z + sz), color: '#6e5238' });
  for (let px = x0 + 0.6; px <= x1; px += 2.2) {
    for (const sz of [-0.85, 0.85]) {
      const bed = Math.min(heightAt(px, z + sz), 0) - 0.5;
      const top = deck + 0.25 + rnd() * 0.1;
      parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.12, top - bed, 6), matrix: mat(px, (top + bed) / 2, z + sz), color: '#5f4834' });
    }
  }
  // Mooring post with a coil of rope at the far end.
  parts.push({ geo: new THREE.CylinderGeometry(0.13, 0.15, 0.6, 8), matrix: mat(x1 - 0.5, deck + 0.3, z + 0.55), color: '#4a3f36' });
  parts.push({ geo: new THREE.TorusGeometry(0.17, 0.05, 5, 12), matrix: mat(x1 - 1.2, deck + 0.06, z - 0.45, Math.PI / 2, 0, 0), color: '#d8c49a' });
  parts.push({ geo: new THREE.TorusGeometry(0.11, 0.045, 5, 10), matrix: mat(x1 - 1.2, deck + 0.12, z - 0.45, Math.PI / 2, 0, 0), color: '#cfb98e' });
  // Signpost at the land end of the pier.
  const sx = x0 - 1.2, sz = z - 1.6, sy = heightAt(sx, sz);
  parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.07, 1.9, 6), matrix: mat(sx, sy + 0.95, sz), color: '#6a503b' });
  obstacles.push({ x: sx, z: sz, r: 0.25 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshLambertMaterial({ map: signTexture(), side: THREE.DoubleSide }));
  sign.position.set(sx, sy + 1.6, sz + 0.07);
  sign.rotation.y = Math.PI / 2;
  sign.castShadow = true;
  return sign;
}

/* ---------------- camp ---------------- */

function flameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uLevel: { value: 1 }, uSeed: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uLevel;
      uniform float uSeed;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        vec2 uv = vUv;
        float t = uTime * 2.2 + uSeed * 7.0;
        float n = noise(vec2(uv.x * 4.0 + uSeed, uv.y * 3.0 - t)) * 0.6 + noise(vec2(uv.x * 9.0, uv.y * 7.0 - t * 1.7)) * 0.4;
        float width = mix(0.42, 0.04, pow(uv.y, 0.8)) * (0.75 + uLevel * 0.25);
        float body = smoothstep(width, width * 0.35, abs(uv.x - 0.5 + (n - 0.5) * 0.18 * uv.y));
        float top = smoothstep(0.95 * uLevel + 0.05, 0.2, uv.y + n * 0.35);
        float a = body * top;
        vec3 col = mix(vec3(1.0, 0.36, 0.08), vec3(1.0, 0.86, 0.45), smoothstep(0.55, 0.0, uv.y + abs(uv.x - 0.5)));
        gl_FragColor = vec4(col * (1.2 + uLevel * 0.6), a * clamp(uLevel * 1.4, 0.0, 1.0));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function buildFire(cx, cy, cz, rnd) {
  const group = new THREE.Group();
  group.position.set(cx, cy, cz);
  const parts = [];
  const STONE = ['#8f8a80', '#9d978c', '#7f7a72', '#a39c90'];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.2;
    parts.push({ geo: jitterGeo(new THREE.DodecahedronGeometry(0.2 + rnd() * 0.07, 0), 0.06, rnd), matrix: mat(Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62, rnd(), rnd(), 0, 1, 0.75, 1), color: pick(STONE, rnd) });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.075, 0.8, 6), matrix: mat(Math.cos(a) * 0.12, 0.18, Math.sin(a) * 0.12, Math.cos(a) * 1.0, 0, -Math.sin(a) * 1.0), color: i % 2 ? '#3d2c22' : '#4d3628' });
  }
  parts.push({ geo: new THREE.CylinderGeometry(0.45, 0.5, 0.04, 10), matrix: mat(0, 0.02, 0), color: '#2e2a26' });
  // A little iron grill on two stones
  for (const s of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.14, 0.3, 0.14), matrix: mat(s * 0.42, 0.15, 0), color: '#7d786f' });
  for (let i = 0; i < 6; i++) parts.push({ geo: new THREE.BoxGeometry(0.92, 0.015, 0.015), matrix: mat(0, 0.33, -0.2 + i * 0.08), color: '#2b2826' });
  const ring = new THREE.Mesh(mergeParts(parts, rnd), new THREE.MeshLambertMaterial({ vertexColors: true }));
  ring.castShadow = true;
  ring.receiveShadow = true;
  group.add(ring);

  const embersMat = new THREE.MeshBasicMaterial({ color: '#ff6a2a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const embers = new THREE.Mesh(new THREE.CircleGeometry(0.34, 12).rotateX(-Math.PI / 2), embersMat);
  embers.position.y = 0.06;
  group.add(embers);

  const flames = [];
  const fg = new THREE.PlaneGeometry(0.75, 1.0).translate(0, 0.5, 0);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(fg, flameMaterial());
    m.material.uniforms.uSeed.value = i * 1.7;
    m.rotation.y = (i / 3) * Math.PI;
    m.position.y = 0.08;
    m.scale.setScalar(0.9 + i * 0.12);
    m.renderOrder = 7;
    group.add(m);
    flames.push(m);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,150,70,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  glow.position.y = 0.45;
  glow.scale.setScalar(2.4);
  group.add(glow);

  const light = new THREE.PointLight('#ff9b52', 0, 16, 1.7);
  light.position.set(0, 0.9, 0);
  group.add(light);

  // Smoke: soft puffs that rise, drift with the wind and fade.
  const SMOKE = 26;
  const sp = new Float32Array(SMOKE * 3), sa = new Float32Array(SMOKE);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('aAge', new THREE.BufferAttribute(sa, 1));
  const smokeMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 220 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#b9b4ad') } },
    vertexShader: /* glsl */ `
      attribute float aAge;
      uniform float uScale;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = aAge;
        gl_PointSize = uScale * (0.25 + aAge * 1.1) / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * (1.0 - vA) * smoothstep(0.0, 0.15, vA);
        gl_FragColor = vec4(uColor, a * uOpacity * 0.32);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const smoke = new THREE.Points(sg, smokeMat);
  smoke.frustumCulled = false;
  smoke.renderOrder = 8;
  const seeds = Array.from({ length: SMOKE }, () => ({ age: Math.random(), dx: 0, dz: 0, life: 4 + Math.random() * 3, ox: 0, oz: 0 }));

  return {
    group, flames, light, glow, embers, smoke, smokeMat, level: 0,
    update(dt, t, level, wind, night) {
      this.level = level;
      const burn = smoothstep(0.3, 1, level);
      const flick = 1 + Math.sin(t * 13.1) * 0.08 + Math.sin(t * 7.7 + 1) * 0.1 + Math.sin(t * 23) * 0.04;
      for (const f of flames) {
        f.visible = burn > 0.02;
        f.material.uniforms.uLevel.value = burn;
      }
      embersMat.opacity = clamp(level * 1.6, 0, 1) * (0.55 + Math.sin(t * 2.1) * 0.1);
      glow.material.opacity = (0.2 + burn * 0.55) * clamp(level * 2, 0, 1) * (0.4 + night * 0.6) * flick;
      this.light.intensity = (burn * 7 + clamp(level, 0, 0.3) * 3) * flick * (0.5 + night * 0.7);
      smokeMat.uniforms.uOpacity.value = clamp(level * 1.3, 0, 1);
      for (let i = 0; i < SMOKE; i++) {
        const s = seeds[i];
        s.age += dt / s.life;
        if (s.age >= 1) {
          s.age = 0;
          s.ox = (Math.random() - 0.5) * 0.3;
          s.oz = (Math.random() - 0.5) * 0.3;
          s.life = 4 + Math.random() * 3;
        }
        const a = s.age;
        sp[i * 3] = cx + s.ox + a * a * 2.4 * wind + Math.sin(t * 0.7 + i) * 0.2 * a;
        sp[i * 3 + 1] = cy + 0.6 + a * 4.2;
        sp[i * 3 + 2] = cz + s.oz + a * a * 1.1 * wind;
        sa[i] = a;
      }
      sg.attributes.position.needsUpdate = true;
      sg.attributes.aAge.needsUpdate = true;
    },
  };
}

function tentGeometry(rnd) {
  // An A-frame ridge tent, 2.5 m long, door facing local +z.
  const L = 2.5, W = 1.9, H = 1.35;
  const parts = [];
  const canvas = '#d9c39a', canvasDark = '#c4ab80', fly = '#7f9a6a';
  // Two sloping sides
  const side = (s) => {
    const geo = new THREE.BufferGeometry();
    const hz = L / 2, hx = W / 2;
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, H, -hz, s * hx, 0, -hz, s * hx, 0, hz,
      0, H, -hz, s * hx, 0, hz, 0, H, hz,
    ], 3));
    return geo;
  };
  parts.push({ geo: side(1), color: fly, jitter: 0.03 });
  parts.push({ geo: side(-1), color: fly, jitter: 0.03 });
  // Back wall and the two door flaps, tied open
  const tri = (pts) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  };
  parts.push({ geo: tri([0, H, -L / 2, W / 2, 0, -L / 2, -W / 2, 0, -L / 2]), color: canvas });
  parts.push({ geo: tri([0, H, L / 2, -W / 2, 0, L / 2, -W * 0.3, 0, L / 2 + 0.25]), color: canvasDark });
  parts.push({ geo: tri([0, H, L / 2, W * 0.3, 0, L / 2 + 0.25, W / 2, 0, L / 2]), color: canvasDark });
  // Groundsheet, sleeping bag and pillow inside
  parts.push({ geo: new THREE.BoxGeometry(W - 0.1, 0.03, L - 0.05), matrix: mat(0, 0.015, 0), color: '#5d5a4c' });
  parts.push({ geo: new THREE.CapsuleGeometry(0.28, 1.3, 4, 8), matrix: mat(0.2, 0.14, -0.1, Math.PI / 2, 0, 0, 1, 0.5, 1), color: '#b5532f' });
  parts.push({ geo: new THREE.BoxGeometry(0.45, 0.12, 0.3), matrix: mat(0.2, 0.1, -0.95), color: '#efe6d2' });
  // Poles and ridge
  for (const s of [-1, 1]) parts.push({ geo: new THREE.CylinderGeometry(0.02, 0.02, H + 0.25, 5), matrix: mat(0, (H + 0.25) / 2, s * (L / 2 + 0.02)), color: '#6b5a48' });
  parts.push({ geo: new THREE.CylinderGeometry(0.02, 0.02, L + 0.15, 5), matrix: mat(0, H + 0.01, 0, Math.PI / 2, 0, 0), color: '#6b5a48' });
  // Pegs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push({ geo: new THREE.CylinderGeometry(0.015, 0.01, 0.2, 4), matrix: mat(sx * (W / 2 + 0.05), 0.05, sz * (L / 2 - 0.1)), color: '#9aa0a6' });
  return mergeParts(parts, rnd);
}

function buildCamp(rnd, parts, obstacles, scene) {
  const cy = heightAt(CAMP.x, CAMP.z);
  const fire = { x: CAMP.x + 0.6, z: CAMP.z + 0.9 };
  const tent = { x: CAMP.x - 3.0, z: CAMP.z - 2.4 };
  // Door faces the fire.
  tent.yaw = Math.atan2(fire.x - tent.x, fire.z - tent.z);
  const tentMesh = new THREE.Mesh(tentGeometry(rnd), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  tentMesh.position.set(tent.x, heightAt(tent.x, tent.z) - 0.02, tent.z);
  tentMesh.rotation.y = tent.yaw;
  tentMesh.castShadow = true;
  tentMesh.receiveShadow = true;
  scene.add(tentMesh);
  obstacles.push({ x: tent.x, z: tent.z, r: 1.35 });
  // Guy ropes
  const ropes = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const a = new THREE.Vector3(0, 1.36, sz * 1.27), b = new THREE.Vector3(sx * 0.4, 0.02, sz * 2.1);
      ropes.push({ ...beam(a, b, 0.008), color: '#e8dcc0' });
    }
  }
  const ropeMesh = new THREE.Mesh(mergeParts(ropes, rnd), new THREE.MeshLambertMaterial({ vertexColors: true }));
  ropeMesh.position.copy(tentMesh.position);
  ropeMesh.rotation.y = tent.yaw;
  scene.add(ropeMesh);

  // A log to sit on, facing the fire and the bay.
  const seat = { x: fire.x + 1.7, z: fire.z + 0.3 };
  parts.push({ geo: new THREE.CylinderGeometry(0.22, 0.25, 1.6, 8), matrix: mat(seat.x, cy + 0.2, seat.z, Math.PI / 2, 0.3, 0), color: '#7a5a3e' });
  obstacles.push({ x: seat.x, z: seat.z - 0.4, r: 0.35 }, { x: seat.x, z: seat.z + 0.4, r: 0.35 });
  // Firewood stack by the tent
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 4), k = i % 4;
    parts.push({ geo: new THREE.CylinderGeometry(0.07, 0.08, 0.7, 6), matrix: mat(tent.x + 1.6, cy + 0.08 + row * 0.13, tent.z - 1.1 + k * 0.16 + row * 0.08, 0, 0, Math.PI / 2), color: pick(['#8a6a4a', '#7a5a3e', '#9a7a58'], rnd) });
  }
  obstacles.push({ x: tent.x + 1.6, z: tent.z - 0.9, r: 0.45 });

  // Tackle chest and rod rack
  const chest = { x: CAMP.x + 2.8, z: CAMP.z - 2.3, yaw: -0.5 };
  parts.push({ geo: new THREE.BoxGeometry(0.9, 0.45, 0.5), matrix: placed(chest.x, cy, chest.z, chest.yaw, 0, 0.23, 0), color: '#7a4f30' });
  parts.push({ geo: new THREE.BoxGeometry(0.94, 0.06, 0.54), matrix: placed(chest.x, cy, chest.z, chest.yaw, 0, 0.47, 0), color: '#6a4228' });
  parts.push({ geo: new THREE.BoxGeometry(0.12, 0.08, 0.04), matrix: placed(chest.x, cy, chest.z, chest.yaw, 0, 0.38, 0.27), color: '#c9a65a' });
  for (const s of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.04, 0.47, 0.52), matrix: placed(chest.x, cy, chest.z, chest.yaw, s * 0.47, 0.24, 0), color: '#c9a65a' });
  obstacles.push({ x: chest.x, z: chest.z, r: 0.6 });
  const rack = { x: chest.x - 1.0, z: chest.z - 1.0, yaw: chest.yaw };
  for (const s of [-1, 1]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.035, 0.04, 1.6, 5), matrix: placed(rack.x, cy, rack.z, rack.yaw, s * 0.85, 0.75, -0.15, -0.18, 0, 0), color: '#6b4a30' });
    parts.push({ geo: new THREE.CylinderGeometry(0.035, 0.04, 1.6, 5), matrix: placed(rack.x, cy, rack.z, rack.yaw, s * 0.85, 0.75, 0.25, 0.25, 0, 0), color: '#6b4a30' });
  }
  parts.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, 1.9, 5), matrix: placed(rack.x, cy, rack.z, rack.yaw, 0, 1.45, 0.05, 0, 0, Math.PI / 2), color: '#6b4a30' });
  obstacles.push({ x: rack.x, z: rack.z, r: 0.55 });
  // Rods leaning on the rack; which ones show depends on what is in your backpack.
  const rackRods = {};
  const ROD_LOOK = {
    float: { len: 3.4, color: '#a8794a', handle: '#d7b98a' },
    spin: { len: 2.2, color: '#2f3640', handle: '#8a6a4a' },
    carp: { len: 3.4, color: '#2e4a3a', handle: '#3a3a3a' },
    fly: { len: 2.7, color: '#8a6a3a', handle: '#d7b98a' },
  };
  Object.entries(ROD_LOOK).forEach(([id, look], i) => {
    const g = new THREE.Group();
    const rod = new THREE.Mesh(mergeParts([
      { geo: new THREE.CylinderGeometry(0.008, 0.02, look.len, 5), matrix: mat(0, look.len / 2, 0), color: look.color },
      { geo: new THREE.CylinderGeometry(0.024, 0.024, 0.4, 6), matrix: mat(0, 0.25, 0), color: look.handle },
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8), matrix: mat(0.04, 0.5, 0, 0, 0, Math.PI / 2), color: '#7d8590' },
    ], rnd), new THREE.MeshLambertMaterial({ vertexColors: true }));
    rod.castShadow = true;
    g.add(rod);
    const lx = -0.6 + i * 0.4;
    const c = Math.cos(rack.yaw), s = Math.sin(rack.yaw);
    g.position.set(rack.x + lx * c + 0.35 * s, cy, rack.z - lx * s + 0.35 * c);
    g.rotation.set(-0.28, rack.yaw, (i - 1.5) * 0.03, 'YXZ');
    scene.add(g);
    rackRods[id] = g;
  });

  // A lantern on a hooked pole by the tent door
  const lp = { x: tent.x + Math.sin(tent.yaw) * 1.9 + Math.cos(tent.yaw) * 0.9, z: tent.z + Math.cos(tent.yaw) * 1.9 - Math.sin(tent.yaw) * 0.9 };
  parts.push({ geo: new THREE.CylinderGeometry(0.03, 0.04, 1.8, 5), matrix: mat(lp.x, cy + 0.9, lp.z), color: '#5a4030' });
  parts.push({ geo: new THREE.BoxGeometry(0.04, 0.04, 0.35), matrix: placed(lp.x, cy, lp.z, tent.yaw, 0, 1.76, 0.15), color: '#5a4030' });
  obstacles.push({ x: lp.x, z: lp.z, r: 0.18 });
  const lantern = buildLanternModel();
  lantern.group.position.set(lp.x + Math.sin(tent.yaw) * 0.3, cy + 1.74, lp.z + Math.cos(tent.yaw) * 0.3);
  scene.add(lantern.group);

  const fireObj = buildFire(fire.x, cy, fire.z, rnd);
  scene.add(fireObj.group, fireObj.smoke);
  obstacles.push({ x: fire.x, z: fire.z, r: 0.85 });

  return {
    fire: fireObj, firePos: new THREE.Vector3(fire.x, cy, fire.z), tent, chest, rack, seat, lanternGlass: lantern.glassMat,
    grillPos: new THREE.Vector3(fire.x, cy + 0.36, fire.z),
    setRackRods(atCamp) {
      for (const [id, g] of Object.entries(rackRods)) g.visible = atCamp.includes(id);
    },
  };
}

/* ---------------- the lake ---------------- */

function reedClump(rnd, cattails) {
  const parts = [];
  const n = 7 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.25;
    const h = 1.2 + rnd() * 0.9;
    const lean = (rnd() - 0.5) * 0.18;
    parts.push({
      geo: new THREE.ConeGeometry(0.022 + rnd() * 0.012, h, 3),
      matrix: mat(Math.cos(a) * r, h / 2, Math.sin(a) * r, lean, rnd() * 3, lean * 0.7),
      color: pick(['#8f9d5c', '#a5a96b', '#7b8f4e', '#b4ae74'], rnd),
    });
    if (cattails && i < 3) {
      parts.push({ geo: new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6), matrix: mat(Math.cos(a) * r + lean * h * 0.4, h * 0.82, Math.sin(a) * r, lean, 0, lean * 0.7), color: '#6b4a2e' });
    }
  }
  return mergeParts(parts, rnd);
}

function lilyGeometry(rnd) {
  // A flat pad with a notch, plus a few that carry a flower (built as a second geometry).
  const pad = new THREE.CircleGeometry(0.32, 12, 0.25, Math.PI * 2 - 0.5).rotateX(-Math.PI / 2);
  const flower = mergeParts([
    { geo: pad.clone(), color: '#4f7a3a', jitter: 0.08 },
    ...Array.from({ length: 7 }, (_, i) => ({
      geo: new THREE.ConeGeometry(0.05, 0.16, 3),
      matrix: mat(Math.cos((i / 7) * 6.28) * 0.06, 0.07, Math.sin((i / 7) * 6.28) * 0.06, Math.sin((i / 7) * 6.28) * 0.7, 0, -Math.cos((i / 7) * 6.28) * 0.7),
      color: i % 2 ? '#fbeff2' : '#f4c9d6',
      jitter: 0.03,
    })),
    { geo: new THREE.SphereGeometry(0.035, 6, 4), matrix: mat(0, 0.08, 0), color: '#f2d24a' },
  ], rnd);
  return { pad: mergeParts([{ geo: pad, color: '#557f3c', jitter: 0.08 }], rnd), flower };
}

function buildSnag(rnd, parts, obstacles) {
  // A fallen alder: roots on the bank, the trunk sloping down into the water.
  const yaw = SNAG.yaw;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  const root = new THREE.Vector3(SNAG.x - dx * 6.5, 0, SNAG.z - dz * 6.5);
  root.y = heightAt(root.x, root.z) + 0.3;
  const tip = new THREE.Vector3(SNAG.x + dx * 4, -1.4, SNAG.z + dz * 4);
  parts.push({ ...beam(root, tip, 0.32, 0.12, 7), color: '#6e5a48' });
  // The torn-up root plate stands on edge at the bank end, with a few root stubs.
  const axis = new THREE.Vector3().subVectors(tip, root).normalize();
  const plate = new THREE.Matrix4().compose(root.clone().addScaledVector(axis, -0.15), new THREE.Quaternion().setFromUnitVectors(UP, axis), new THREE.Vector3(1, 1, 1));
  parts.push({ geo: jitterGeo(new THREE.CylinderGeometry(0.85, 0.95, 0.28, 9), 0.22, rnd), matrix: plate, color: '#5e4a3a' });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const off = new THREE.Vector3(Math.cos(a) * dz, Math.sin(a) * 0.7 + 0.1, -Math.cos(a) * dx).multiplyScalar(0.75);
    const r0 = root.clone().add(off);
    parts.push({ ...beam(r0, r0.clone().addScaledVector(axis, -0.5).add(off.clone().multiplyScalar(0.5)), 0.06, 0.02, 4), color: '#6a5646' });
  }
  // Branches
  for (let i = 0; i < 9; i++) {
    const k = 0.3 + rnd() * 0.65;
    const a = new THREE.Vector3().lerpVectors(root, tip, k);
    const side = rnd() < 0.5 ? -1 : 1;
    const b = a.clone().add(new THREE.Vector3(dz * side * (0.8 + rnd() * 1.4), 0.3 + rnd() * 1.2, -dx * side * (0.8 + rnd() * 1.4) + (rnd() - 0.5)));
    parts.push({ ...beam(a, b, 0.07, 0.025, 5), color: '#6a5646' });
  }
  obstacles.push({ x: root.x, z: root.z, r: 1.1 });
  const mid = new THREE.Vector3().lerpVectors(root, tip, 0.25);
  obstacles.push({ x: mid.x, z: mid.z, r: 0.5 });
}

function buildPegs(rnd, parts) {
  for (const p of PEGS) {
    const c = Math.cos(p.angle), s = Math.sin(p.angle);
    // Planks laid across the direction from the lake centre.
    const yaw = Math.atan2(c, s);
    for (let i = -3; i <= 3; i++) {
      parts.push({ geo: new THREE.BoxGeometry(2.2, 0.06, 0.3), matrix: placed(p.x, 0.29, p.z, yaw, 0, 0, i * 0.31, 0, (rnd() - 0.5) * 0.04, 0), color: pick(['#a57f59', '#b48d63', '#9d7a58'], rnd), jitter: 0.04 });
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const lx = sx * 0.95, lz = sz * 0.95;
        const wx = p.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), wz = p.z - lx * Math.sin(yaw) + lz * Math.cos(yaw);
        const bed = Math.min(heightAt(wx, wz), 0) - 0.3;
        parts.push({ geo: new THREE.CylinderGeometry(0.07, 0.08, 0.4 - bed, 5), matrix: mat(wx, (0.4 + bed) / 2, wz), color: '#5f4834' });
      }
    }
  }
}

/* ---------------- the stream ---------------- */

function buildStream(rnd, parts, obstacles) {
  const ROCK = ['#8f8a7c', '#9a958a', '#857f74', '#a39d92'];
  const rocks = [];
  // Boulders breaking the riffles, and some along the banks.
  for (let i = 0; i < STREAM.length - 1; i++) {
    const a = STREAM[i], b = STREAM[i + 1];
    const riffle = a[3] < 0.5;
    for (let k = 0; k < (riffle ? 7 : 4); k++) {
      const t = rnd();
      const x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len;
      const hw = lerp(a[2], b[2], t);
      const off = riffle ? (rnd() - 0.5) * hw * 1.6 : (rnd() < 0.5 ? -1 : 1) * (hw + 0.4 + rnd() * 1.2);
      const px = x + nx * off, pz = z + nz * off;
      const s = riffle ? 0.25 + rnd() * 0.35 : 0.35 + rnd() * 0.5;
      rocks.push({ x: px, y: heightAt(px, pz) + s * 0.25, z: pz, s, sx: s * (1 + rnd() * 0.5), sy: s * 0.7, r: rnd() * 6.28 });
      if (!riffle && s > 0.5) obstacles.push({ x: px, z: pz, r: s * 0.9 });
    }
  }
  // Stepping stones across the lower riffle
  const st = STONES, c = Math.cos(st.yaw), s = Math.sin(st.yaw);
  for (let i = -3; i <= 3; i++) {
    const x = st.x + c * i * 0.9, z = st.z - s * i * 0.9;
    rocks.push({ x, y: Math.max(heightAt(x, z), -0.5) + 0.12, z, s: 0.42, sx: 0.5, sy: 0.32, r: rnd() * 6.28, flat: true });
  }
  // The spring: a little rocky outcrop the stream rises from.
  const sp = STREAM[0];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.45, d = 2.2 + rnd();
    const x = sp[0] + Math.sin(a) * d * 0.6, z = sp[1] - 1.5 - Math.cos(a) * d * 0.4;
    const sz = 0.7 + rnd() * 0.8;
    rocks.push({ x, y: heightAt(x, z) + sz * 0.2, z, s: sz, sx: sz * 1.2, sy: sz, r: rnd() * 6.28 });
    obstacles.push({ x, z, r: sz });
  }
  // Plank footbridge over the top riffle
  const br = BRIDGE, bc = Math.cos(br.yaw), bs = Math.sin(br.yaw);
  for (let i = 0; i < 5; i++) {
    parts.push({ geo: new THREE.BoxGeometry(br.len, 0.07, 0.24), matrix: placed(br.x, br.deck, br.z, br.yaw, 0, 0, -0.52 + i * 0.26, 0, 0, (rnd() - 0.5) * 0.03), color: pick(['#a57f59', '#b48d63', '#9d7a58', '#8f6e4e'], rnd), jitter: 0.04 });
  }
  for (const side of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(br.len, 0.12, 0.12), matrix: placed(br.x, br.deck, br.z, br.yaw, 0, -0.1, side * 0.6), color: '#6e5238' });
    parts.push({ geo: new THREE.BoxGeometry(br.len, 0.06, 0.06), matrix: placed(br.x, br.deck, br.z, br.yaw, 0, 0.75, side * 0.62), color: '#7a5a3e' });
    for (const lx of [-br.len / 2 + 0.2, 0, br.len / 2 - 0.2]) {
      parts.push({ geo: new THREE.CylinderGeometry(0.04, 0.05, 0.8, 5), matrix: placed(br.x, br.deck, br.z, br.yaw, lx, 0.38, side * 0.62), color: '#6a503b' });
      const wx = br.x + lx * bc + side * 0.62 * bs, wz = br.z - lx * bs + side * 0.62 * bc;
      const bed = heightAt(wx, wz);
      if (bed < br.deck - 0.2) parts.push({ geo: new THREE.CylinderGeometry(0.07, 0.08, br.deck - bed + 0.2, 5), matrix: mat(wx, (br.deck + bed - 0.2) / 2, wz), color: '#5f4834' });
    }
  }
  const rockGeo = mergeParts([{ geo: jitterGeo(new THREE.DodecahedronGeometry(1, 1), 0.25, rnd), color: '#8f8a7c', jitter: 0.08 }], rnd);
  const m = new THREE.InstancedMesh(rockGeo, withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true })), rocks.length);
  const o = new THREE.Object3D();
  const col = new THREE.Color();
  rocks.forEach((r, i) => {
    o.position.set(r.x, r.y, r.z);
    o.rotation.set(r.flat ? 0 : (rnd() - 0.5) * 0.5, r.r, r.flat ? 0 : (rnd() - 0.5) * 0.5);
    o.scale.set(r.sx, r.sy, r.sx * 0.9);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    col.set(pick(ROCK, rnd)).multiplyScalar(0.9 + rnd() * 0.2);
    if (r.y < 0.2) col.lerp(new THREE.Color('#6f7d55'), 0.25);
    m.setColorAt(i, col);
  });
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function fernGeometry(rnd) {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.3;
    const len = 0.55 + rnd() * 0.25;
    const g = new THREE.PlaneGeometry(0.16, len, 1, 3).translate(0, len / 2, 0);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) / len;
      p.setX(k, p.getX(k) * (1 - y * 0.85));
      p.setZ(k, y * y * 0.35);
    }
    parts.push({ geo: g, matrix: mat(0, 0, 0, -0.5, a, 0), color: pick(['#4f7f3f', '#5f8f48', '#46703a'], rnd), jitter: 0.06 });
  }
  return mergeParts(parts, rnd);
}

function grassGeometry(rnd) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI;
    const h = 0.28 + rnd() * 0.22;
    parts.push({ geo: new THREE.PlaneGeometry(0.05, h, 1, 2).translate(0, h / 2, 0), matrix: mat((rnd() - 0.5) * 0.18, 0, (rnd() - 0.5) * 0.18, (rnd() - 0.5) * 0.4, a, (rnd() - 0.5) * 0.4), color: pick(['#9cc066', '#8fb85e', '#a8c872', '#86ad5c'], rnd), jitter: 0.08 });
  }
  return mergeParts(parts, rnd);
}

/* ---------------- mist and insects ---------------- */

function mistTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = 20 + Math.random() * 88, y = 20 + Math.random() * 88, r = 18 + Math.random() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildMist(rnd) {
  const tex = mistTexture();
  const planes = [];
  const spots = [
    { x: LAKE.x - 8, z: LAKE.z, s: 26 }, { x: LAKE.x + 9, z: LAKE.z + 2, s: 22 }, { x: LAKE.x, z: LAKE.z - 5, s: 20 },
    { x: STREAM[3][0], z: STREAM[3][1], s: 14 }, { x: STREAM[1][0], z: STREAM[1][1], s: 12 },
  ];
  for (const sp of spots) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sp.s, sp.s * 0.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false, color: '#eef3f2',
    }));
    m.position.set(sp.x, 0.6 + rnd() * 0.4, sp.z);
    m.rotation.y = rnd() * Math.PI;
    m.renderOrder = 6;
    m.userData = { x: sp.x, z: sp.z, ph: rnd() * 10 };
    planes.push(m);
  }
  return planes;
}

function buildHatch(rnd) {
  const N = 90;
  const pos = new Float32Array(N * 3), phase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // Along the stream and over the lake margins.
    let x, z;
    if (i < 60) {
      const n = STREAM[1 + Math.floor(rnd() * (STREAM.length - 1))];
      x = n[0] + (rnd() - 0.5) * 6;
      z = n[1] + (rnd() - 0.5) * 8;
    } else {
      const a = rnd() * Math.PI * 2;
      x = LAKE.x + Math.cos(a) * LAKE.rx * (0.6 + rnd() * 0.4);
      z = LAKE.z + Math.sin(a) * LAKE.rz * (0.6 + rnd() * 0.4);
    }
    pos[i * 3] = x;
    pos[i * 3 + 1] = 0.3 + rnd() * 1.6;
    pos[i * 3 + 2] = z;
    phase[i] = rnd() * 10;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uOpacity: { value: 0 }, uScale: { value: 40 }, uColor: { value: new THREE.Color('#fff4d6') } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      uniform float uScale;
      varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime + aPhase * 7.0;
        p.x += sin(t * 0.9) * 0.6 + sin(t * 3.1) * 0.08;
        p.y += sin(t * 1.3) * 0.35 + abs(sin(t * 0.21)) * 0.5;
        p.z += cos(t * 0.7) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = 0.55 + 0.45 * sin(t * 9.0);
        gl_PointSize = uScale / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d);
        gl_FragColor = vec4(uColor, a * vA * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, material);
  pts.frustumCulled = false;
  return pts;
}

/* ---------------- assemble ---------------- */

export function buildShore(scene, rnd) {
  const parts = [];
  const obstacles = [];
  const sign = buildLanding(rnd, parts, obstacles);
  scene.add(sign);
  const camp = buildCamp(rnd, parts, obstacles, scene);
  buildSnag(rnd, parts, obstacles);
  buildPegs(rnd, parts);
  scene.add(buildStream(rnd, parts, obstacles));
  const wood = new THREE.Mesh(mergeParts(parts, rnd), new THREE.MeshLambertMaterial({ vertexColors: true }));
  wood.castShadow = true;
  wood.receiveShadow = true;
  scene.add(wood);

  // Reeds: thick along the lake margins (with cattails), thinner by the stream.
  const reeds = [], cattails = [], ferns = [], grass = [], pads = [], flowers = [];
  const P = SHORE_PATCH;
  const sInfo = {};
  for (let i = 0; i < 80000 && (reeds.length < 420 || grass.length < 2400 || ferns.length < 260); i++) {
    const x = P.x0 + rnd() * (P.x1 - P.x0), z = P.z0 + rnd() * (P.z1 - P.z0);
    const h = heightAt(x, z);
    const dl = lakeSDF(x, z), ds = streamSDF(x, z);
    const onPath = pathInfo(x, z).d < 1.6;
    const camp2 = Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.r + 1;
    if (onPath || camp2) continue;
    if (h > -0.55 && h < 0.35 && dl > -4 && dl < 1.5 && reeds.length < 420) {
      // Leave gaps at the pegs and in front of camp so you can cast.
      if (PEGS.some((p) => Math.hypot(x - p.x, z - p.z) < 4)) continue;
      const thick = 0.5 + 0.5 * fbm(x * 0.08 + 3, z * 0.08, 2);
      if (rnd() > thick) continue;
      (rnd() < 0.35 ? cattails : reeds).push({ x, y: h - 0.05, z, s: 0.8 + rnd() * 0.5, r: rnd() * 6.28, rx: (rnd() - 0.5) * 0.15 });
      continue;
    }
    if (h > -0.2 && h < 0.5 && ds > -0.6 && ds < 1.2 && reeds.length < 420 && rnd() < 0.35) {
      reeds.push({ x, y: h - 0.05, z, s: 0.55 + rnd() * 0.35, r: rnd() * 6.28 });
      continue;
    }
    if (h > 0.25 && h < 4 && ds > 0.5 && ds < 7 && ferns.length < 260 && rnd() < 0.5) {
      ferns.push({ x, y: h - 0.03, z, s: 0.8 + rnd() * 0.7, r: rnd() * 6.28 });
      continue;
    }
    if (h > 0.4 && h < 14 && grass.length < 2400) {
      const near = Math.min(dl, ds, pathInfo(x, z).d * 2, Math.hypot(x - CAMP.x, z - CAMP.z) - CAMP.r);
      if (near > 16 || rnd() > 0.85) continue;
      grass.push({ x, y: h - 0.02, z, s: 0.45 + rnd() * 0.45, r: rnd() * 6.28 });
      if (rnd() < 0.08) flowers.push({ x: x + 0.2, y: h, z: z + 0.1, s: 0.7 + rnd() * 0.5, r: 0, color: pick(['#f7b9c8', '#ffffff', '#ffe08a', '#d6c2f2'], rnd) });
    }
  }
  // Lily pads in the east bay near camp, and a few scattered along the south shelf.
  for (let i = 0; i < 900 && pads.length < 150; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * LILIES.r;
    let x = LILIES.x + Math.cos(a) * r * 1.3, z = LILIES.z + Math.sin(a) * r;
    if (i % 4 === 0) {
      const b = Math.PI * (0.25 + rnd() * 0.5);
      x = LAKE.x + Math.cos(b) * LAKE.rx * (0.55 + rnd() * 0.35);
      z = LAKE.z + Math.sin(b) * LAKE.rz * (0.55 + rnd() * 0.35);
    }
    const h = heightAt(x, z);
    if (h > -0.5 || h < -2.6 || lakeSDF(x, z) > -1) continue;
    if (pads.some((p) => Math.hypot(p.x - x, p.z - z) < 0.5)) continue;
    pads.push({ x, y: 0.035, z, s: 0.75 + rnd() * 0.6, r: rnd() * 6.28, flower: rnd() < 0.12 });
  }
  const sway = swayMaterial(0.25, 0.07);
  const grassMat = swayMaterial(0.05, 0.12, THREE.DoubleSide);
  scene.add(instanced(reedClump(rnd, false), reeds, sway, rnd, { tint: 0.12 }));
  scene.add(instanced(reedClump(rnd, true), cattails, sway, rnd, { tint: 0.12 }));
  scene.add(instanced(fernGeometry(rnd), ferns, swayMaterial(0.1, 0.06, THREE.DoubleSide), rnd, { tint: 0.15 }));
  const grassMesh = instanced(grassGeometry(rnd), grass, grassMat, rnd, { tint: 0.15, shadows: false });
  scene.add(grassMesh);
  const flowerGeo = mergeParts([
    { geo: new THREE.CylinderGeometry(0.01, 0.01, 0.25, 3), matrix: mat(0, 0.12, 0), color: '#6f9a4e' },
    { geo: new THREE.IcosahedronGeometry(0.06, 0), matrix: mat(0, 0.27, 0), color: '#ffffff', jitter: 0 },
  ], rnd);
  scene.add(instanced(flowerGeo, flowers, grassMat, rnd));
  const lily = lilyGeometry(rnd);
  const lilyMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const padMesh = instanced(lily.pad, pads.filter((p) => !p.flower), lilyMat, rnd, { tint: 0.15, shadows: false });
  const flowerMesh = instanced(lily.flower, pads.filter((p) => p.flower), lilyMat, rnd, { tint: 0.05, shadows: false });
  padMesh.renderOrder = 2;
  flowerMesh.renderOrder = 2;
  scene.add(padMesh, flowerMesh);

  const mist = buildMist(rnd);
  for (const m of mist) scene.add(m);
  const hatch = buildHatch(rnd);
  scene.add(hatch);

  return {
    camp,
    obstacles,
    grassMesh,
    grassTotal: grass.length,
    hatch,
    setQuality(q) {
      grassMesh.count = Math.floor(this.grassTotal * q.plants);
    },
    setPixelRatio(pr) {
      hatch.material.uniforms.uScale.value = 40 * pr;
      camp.fire.smokeMat.uniforms.uScale.value = 220 * pr;
    },
    update(dt, t, env, { fireLevel = 0, hatchLevel = 0, wind = 1, hour = 12 }) {
      shared.uTime.value = t;
      shared.uWind.value = wind;
      camp.fire.update(dt, t, fireLevel, wind, env.night);
      camp.lanternGlass.emissiveIntensity = env.lantern * 2.6;
      // Morning mist lies on the still water from before dawn until mid-morning, and a little at dusk.
      const mistK = (smoothstep(4, 5.5, hour) * (1 - smoothstep(7.5, 9.5, hour)) + smoothstep(19.5, 21, hour) * (1 - smoothstep(22.5, 23.5, hour)) * 0.5) * (1 - env.rain * 0.5);
      for (const m of mist) {
        const u = m.userData;
        m.visible = mistK > 0.01;
        m.material.opacity = mistK * (0.45 + 0.15 * Math.sin(t * 0.13 + u.ph));
        m.position.x = u.x + Math.sin(t * 0.03 + u.ph) * 3;
        m.position.z = u.z + Math.cos(t * 0.025 + u.ph) * 2;
        m.rotation.y += dt * 0.004;
      }
      hatch.material.uniforms.uOpacity.value = hatchLevel * (0.4 + env.daylight * 0.6);
      hatch.visible = hatchLevel > 0.02;
    },
  };
}
