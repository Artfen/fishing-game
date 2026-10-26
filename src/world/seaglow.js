import * as THREE from 'three';
import { waveHeight } from './water.js';
import { zoneAt, waterOf, SOUTH_Z } from './terrain.js';

// The sea glowing at night: tiny plankton (Noctiluca and its kind) that flash blue-green when the
// water is disturbed. A boat's wake and bow wave, an oar or a paddle, a splash, a fish darting just
// under the surface, a dolphin's trail, a diver's kick: each leaves sparks of cold light that fade
// in a second or two. Only after dark, only in salt (or brackish) water, never in the lakes and
// rivers, and brighter some nights than others: each night rolls its own dice (see nightGlow).

const N = 1100;

const VERT = /* glsl */`
  attribute float aBorn;
  attribute float aLife;
  attribute float aSize;
  uniform float uTime;
  uniform float uScale;
  varying float vA;
  void main() {
    float age = uTime - aBorn;
    float k = clamp(age / aLife, 0.0, 1.0);
    // A quick flash, then a slow fade; nothing once it's done (or before it's born).
    vA = step(0.0, age) * (1.0 - k) * (1.0 - k) * (0.4 + 0.6 * smoothstep(0.0, 0.08, age));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.5, -mv.z) * (0.7 + 0.5 * (1.0 - k));
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */`
  uniform float uLevel;
  uniform vec3 uColor;
  varying float vA;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float a = smoothstep(1.0, 0.0, r);
    a = a * a * vA * uLevel;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * (0.9 + 0.9 * smoothstep(0.5, 0.0, r)), min(1.0, a * 1.6));
  }`;

// How strongly the sea glows tonight (0 … 1), from the day: most nights a little, some nights a
// lot, a few hardly at all. (The same for the whole night, whoever's asking.)
export function nightGlow(day) {
  let h = (Math.imul((day | 0) + 0x9e37, 0x85ebca6b) ^ 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  const r = (h >>> 8) / 16777216;
  return r < 0.15 ? 0.15 : r < 0.75 ? 0.35 + (r - 0.15) * 0.6 : 0.75 + (r - 0.75) * 1;
}

export class SeaGlow {
  constructor(scene) {
    this.pos = new Float32Array(N * 3).fill(0);
    this.born = new Float32Array(N).fill(-1e6);
    this.life = new Float32Array(N).fill(1);
    this.size = new Float32Array(N).fill(1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aBorn', new THREE.BufferAttribute(this.born, 1));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 300 }, uLevel: { value: 0 }, uColor: { value: new THREE.Color('#58e8ff') } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.visible = false;
    scene.add(this.points);
    this.i = 0;
    this.time = 0;
    this.level = 0;   // how bright, just now (tonight's glow × how dark it is)
    this.dirty = false;
    this.lastCell = '';
    this.lastSalt = true;
  }

  setPixelRatio(pr) {
    this.mat.uniforms.uScale.value = 300 * pr;
  }

  // Salt water here? (Checked by the 10 m cell, so a busy wake doesn't ask every time.)
  salt(x, z) {
    if (z > SOUTH_Z) return true;
    const cell = `${Math.floor(x / 10)},${Math.floor(z / 10)}`;
    if (cell !== this.lastCell) {
      this.lastCell = cell;
      this.lastSalt = waterOf(zoneAt(x, z)) !== 'fresh';
    }
    return this.lastSalt;
  }

  // Sparks where the water was stirred: n of them, scattered over spread metres round (x, z),
  // power for how bright and big. (Nothing in daylight, or in fresh water.)
  spawn(x, z, n = 4, spread = 0.6, power = 1, t = this.time) {
    if (this.level < 0.02 || n <= 0 || !this.salt(x, z)) return;
    for (let k = 0; k < n; k++) {
      const i = this.i++ % N;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      this.pos[i * 3] = px;
      this.pos[i * 3 + 1] = waveHeight(px, pz, t) - 0.04 - Math.random() * 0.12;
      this.pos[i * 3 + 2] = pz;
      this.born[i] = t + Math.random() * 0.12;
      this.life[i] = 0.9 + Math.random() * 1.3 * power;
      this.size[i] = (0.3 + Math.random() * 0.45) * (0.7 + 0.5 * power);
    }
    this.dirty = true;
  }

  // The colour of the foam in a wake tonight: white by day, dim after dark, and, on a night the sea
  // glows, the glow's own blue-green. (daylight 0 … 1.)
  foamColor(out, daylight) {
    const d = Math.max(0, Math.min(1, daylight));
    const k = this.level * (1 - d);
    return out.setRGB(0.22 + 0.78 * d, 0.26 + 0.74 * d, 0.3 + 0.7 * d).lerp(this.mat.uniforms.uColor.value, Math.min(1, k * 0.9));
  }

  // level: tonight's glow × how dark it is (0 by day).
  update(t, level) {
    this.time = t;
    this.level = level;
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uLevel.value = level;
    this.points.visible = level > 0.02;
    if (this.dirty) {
      const g = this.points.geometry;
      for (const k of ['position', 'aBorn', 'aLife', 'aSize']) g.attributes[k].needsUpdate = true;
      this.dirty = false;
    }
  }

  // How many sparks are alive just now (for tests).
  live(t = this.time) {
    let n = 0;
    for (let i = 0; i < N; i++) if (t - this.born[i] >= 0 && t - this.born[i] < this.life[i]) n++;
    return n;
  }
}
