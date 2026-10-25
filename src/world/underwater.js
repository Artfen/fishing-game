import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { waveHeight } from './water.js';
import { withCaustics } from './caustics.js';
import { mergeParts, seeded, jitterGeo, clamp, lerp, smoothstep, rand } from '../util.js';

// What lives below the waterline besides the fish: weed beds, rocks, drifting
// particles, soft light shafts and bubbles, plus the colour and haze you see
// once the camera slips under the surface.

const shared = { uTime: { value: 0 } };
const UNDER_DAY = new THREE.Color('#2a8b95');
const UNDER_DUSK = new THREE.Color('#3b5f7c');
const UNDER_NIGHT = new THREE.Color('#0b1f33');
const UNDER_RAIN = new THREE.Color('#4a6f74');
const UNDER_DEEP = new THREE.Color('#0d3f5a');
// Las Brasas' water, far to the south: clear ocean blue, seeing twice as far.
const UNDER_DAY_S = new THREE.Color('#1c87b6');
const UNDER_DEEP_S = new THREE.Color('#09306e');
const _day = new THREE.Color(), _deep = new THREE.Color();
const _look = new THREE.Vector3();
const _fogC = new THREE.Color();
const _c = new THREE.Color();

function plantMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(0.0);
      #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xyz;
      #endif
      float k = max(position.y, 0.0);
      k *= k;
      float sway = sin(uTime * 0.7 + ip.x * 0.15 + ip.z * 0.11) * 0.6 + sin(uTime * 1.3 + ip.z * 0.3 + position.y * 2.0) * 0.25;
      transformed.x += sway * 0.22 * k;
      transformed.z += cos(uTime * 0.55 + ip.x * 0.2) * 0.12 * k;`);
  };
  m.customProgramCacheKey = () => 'underwater-plant';
  return m;
}

// A clump of thin, gently curving blades about one unit tall.
function bladeClump(rnd, blades, width, lean, baseHex, tipHex) {
  const pos = [], col = [];
  const base = new THREE.Color(baseHex), tip = new THREE.Color(tipHex);
  for (let b = 0; b < blades; b++) {
    const th = rnd() * Math.PI * 2, hgt = 0.65 + rnd() * 0.35, ln = lean * (0.5 + rnd());
    const ox = (rnd() - 0.5) * 0.25, oz = (rnd() - 0.5) * 0.25;
    const px = Math.cos(th + Math.PI / 2), pz = Math.sin(th + Math.PI / 2);
    const shade = 0.85 + rnd() * 0.3;
    let prev = null;
    for (let j = 0; j <= 4; j++) {
      const t = j / 4;
      const cx = ox + Math.cos(th) * ln * t * t, cz = oz + Math.sin(th) * ln * t * t, cy = t * hgt;
      const w = width * (1 - t * 0.75) * 0.5;
      const L = [cx - px * w, cy, cz - pz * w], R = [cx + px * w, cy, cz + pz * w];
      if (prev) {
        pos.push(...prev.L, ...prev.R, ...R, ...prev.L, ...R, ...L);
        _c.copy(base).lerp(tip, t).multiplyScalar(shade);
        for (let n = 0; n < 6; n++) col.push(_c.r, _c.g, _c.b);
      }
      prev = { L, R };
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

function instances(geo, material, list, rnd, tint) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  list.forEach((p, i) => {
    o.position.set(p.x, p.y, p.z);
    o.rotation.set(p.rx || 0, p.r, p.rz || 0);
    o.scale.set(p.sx || p.s, p.s, p.sz || p.s);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    tint(c, rnd);
    m.setColorAt(i, c);
  });
  m.count = list.length;
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false;
  return m;
}

function rayTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  const h = ctx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(255,255,255,0)');
  h.addColorStop(0.5, 'rgba(255,255,255,1)');
  h.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 64, 256);
  ctx.globalCompositeOperation = 'destination-in';
  const v = ctx.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Underwater {
  constructor(scene, habitat, tintEl) {
    this.scene = scene;
    this.habitat = habitat;
    this.tint = tintEl;
    this.submerge = 0;
    this.clear = 0; // 1 in Las Brasas' clear blue water (set by the game)
    this.underColor = new THREE.Color().copy(UNDER_DAY);
    const rnd = seeded(9090);

    // Weed beds: short seagrass everywhere there is weed, taller ribbon weed (kelp on the
    // coast) in deeper beds. One set per region, so the ones far out of view aren't drawn.
    const s = {};
    const plants = plantMaterial();
    const grassGeo = bladeClump(rnd, 9, 0.075, 0.35, '#355f37', '#86ad5c');
    const kelpGeo = bladeClump(rnd, 3, 0.16, 0.25, '#4e5a2a', '#a39a4c');
    this.plants = { material: plants, grassGeo, kelpGeo };
    this.beds = [];
    // (Half again as many as High draws: Ultra and Cinematic draw more of them; see quality.js.)
    const MORE = 1.5;
    for (const R0 of habitat.regions) {
      if (!R0.grass && !R0.kelp) continue;
      const R = { ...R0, grass: Math.round(R0.grass * MORE), kelp: Math.round(R0.kelp * MORE) };
      const grass = [], kelp = [];
      for (let i = 0; i < (R.grass + R.kelp) * 50 && (grass.length < R.grass || kelp.length < R.kelp); i++) {
        const x = R.x + rnd() * R.w, z = R.z + rnd() * R.h;
        habitat.sample(x, z, s);
        if (s.weed < 0.15 || rnd() > Math.pow(s.weed, 0.8)) continue;
        const y = heightAt(x, z) - 0.05;
        if (s.depth > 2.6 && rnd() < 0.28 && kelp.length < R.kelp) {
          kelp.push({ x, y, z, s: rand(1.2, Math.min(R.id === 'gannet' ? 5 : 3.2, s.depth * 0.55)), r: rnd() * 6.28 });
        } else if (grass.length < R.grass) {
          grass.push({ x, y, z, s: rand(0.45, Math.min(1.3, 0.4 + s.depth * 0.25)), r: rnd() * 6.28 });
        }
      }
      const g = instances(grassGeo, plants, grass, rnd, (c, r) => c.setRGB(0.85 + r() * 0.3, 0.9 + r() * 0.2, 0.85 + r() * 0.2));
      const k = instances(kelpGeo, plants, kelp, rnd, (c, r) => c.setRGB(0.85 + r() * 0.3, 0.85 + r() * 0.25, 0.8 + r() * 0.2));
      g.frustumCulled = k.frustumCulled = true;
      g.computeBoundingSphere();
      k.computeBoundingSphere();
      this.beds.push({ grass: g, kelp: k, grassTotal: grass.length, kelpTotal: kelp.length });
      scene.add(g, k);
    }
    // The home bay's beds (kept as before, for anything that looks for them).
    this.grass = this.beds[0].grass;
    this.kelp = this.beds[0].kelp;

    // Submerged rocks: the cover fish shelter beside.
    const rocks = [];
    for (const c of habitat.clusters) {
      const n = 4 + Math.floor(c.r * 1.3);
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * c.r * 0.75;
        const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        const size = lerp(2.4, 0.5, d / (c.r * 0.75)) * (0.6 + rnd() * 0.6);
        rocks.push({ x, y: heightAt(x, z) - size * 0.3, z, s: size, sx: size * (0.8 + rnd() * 0.5), sz: size * (0.8 + rnd() * 0.5), r: rnd() * 6.28, rx: (rnd() - 0.5) * 0.6, rz: (rnd() - 0.5) * 0.6 });
      }
    }
    const rockGeo = mergeParts([{ geo: jitterGeo(new THREE.DodecahedronGeometry(1, 0), 0.42, rnd), color: '#8f8a7c', jitter: 0.09 }], rnd);
    const algae = new THREE.Color('#7a8a5c');
    this.rocks = instances(rockGeo, withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true })), rocks, rnd, (c, r) => {
      c.setRGB(1, 1, 1).lerp(algae, r() * 0.55).multiplyScalar(0.8 + r() * 0.3);
    });
    this.rocks.receiveShadow = true;
    scene.add(this.rocks);

    // Drifting particles, wrapped around the camera entirely on the GPU.
    const N = 700;
    const pp = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pp[i * 3] = rand(-14, 14);
      pp[i * 3 + 1] = rand(-14, 14);
      pp[i * 3 + 2] = rand(-14, 14);
      seed[i] = rnd();
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.particleMat = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uCam: { value: new THREE.Vector3() }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#d9f2ea') }, uScale: { value: 30 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform vec3 uCam;
        uniform float uTime;
        uniform float uScale;
        varying float vA;
        void main() {
          vec3 drift = vec3(sin(uTime * 0.1 + aSeed * 6.0) * 0.4 + uTime * 0.05, -uTime * 0.03 + sin(uTime * 0.2 + aSeed * 3.0) * 0.2, cos(uTime * 0.08 + aSeed * 4.0) * 0.4);
          vec3 p = mod(position + drift - uCam + 14.0, 28.0) - 14.0 + uCam;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vA = (1.0 - smoothstep(9.0, 14.0, length(p - uCam))) * step(p.y, -0.25);
          gl_PointSize = uScale * (0.6 + fract(aSeed * 7.0) * 0.8) / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vA;
        void main() {
          float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
          gl_FragColor = vec4(uColor, a * vA * uOpacity);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.particles = new THREE.Points(pg, this.particleMat);
    this.particles.frustumCulled = false;
    this.particles.renderOrder = 5;
    scene.add(this.particles);

    // Soft shafts of light from the surface.
    const rayGeo = new THREE.PlaneGeometry(2.6, 22).translate(0, -11, 0);
    const map = rayTexture();
    this.rays = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(rayGeo, new THREE.MeshBasicMaterial({
        map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#bfe9df', opacity: 0, side: THREE.DoubleSide,
      }));
      m.rotation.order = 'YXZ';
      m.renderOrder = 6;
      m.visible = false;
      m.userData = { ox: rand(-12, 12), oz: rand(-12, 12), w: rand(0.6, 1.6), ph: rand(0, 10) };
      m.scale.x = m.userData.w;
      scene.add(m);
      this.rays.push(m);
    }
    this.rayCount = 6;

    // Bubbles rising from weed beds and from a few fish.
    this.maxB = 90;
    this.bp = new Float32Array(this.maxB * 3).fill(-999);
    this.bSize = new Float32Array(this.maxB);
    this.bVy = new Float32Array(this.maxB);
    this.bSeed = new Float32Array(this.maxB);
    this.bAlive = new Uint8Array(this.maxB);
    this.bi = 0;
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(this.bp, 3));
    bg.setAttribute('aSize', new THREE.BufferAttribute(this.bSize, 1));
    this.bubbleMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 300 }, uOpacity: { value: 0.75 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uScale;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.42, d) * (0.25 + smoothstep(0.2, 0.45, d) * 0.75);
          gl_FragColor = vec4(vec3(0.88, 0.97, 1.0), a * uOpacity);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.bubblesPts = new THREE.Points(bg, this.bubbleMat);
    this.bubblesPts.frustumCulled = false;
    this.bubblesPts.renderOrder = 5;
    scene.add(this.bubblesPts);
    this.ambientT = 2;
    this.onPop = null;
  }

  // Weed beds for a region built later (Las Brasas: its seagrass and the brown weed of its reefs),
  // with a seed of its own. R: { x, z, w, h, grass, kelp }.
  addBeds(R, rnd, q = this.quality) {
    const s = {}, grass = [], kelp = [];
    for (let i = 0; i < (R.grass + R.kelp) * 14 && (grass.length < R.grass || kelp.length < R.kelp); i++) {
      const x = R.x + rnd() * R.w, z = R.z + rnd() * R.h;
      this.habitat.sample(x, z, s);
      if (s.weed < 0.2 || rnd() > Math.pow(s.weed, 0.8)) continue;
      const y = heightAt(x, z) - 0.05;
      if (!s.grass && s.depth > 2 && rnd() < 0.4 && kelp.length < R.kelp) kelp.push({ x, y, z, s: rand(1, Math.min(2.6, s.depth * 0.5)), r: rnd() * 6.28 });
      else if (grass.length < R.grass) grass.push({ x, y, z, s: rand(0.5, 1.1), r: rnd() * 6.28 });
    }
    const P = this.plants;
    const g = instances(P.grassGeo, P.material, grass, rnd, (c, r) => c.setRGB(0.8 + r() * 0.25, 0.95 + r() * 0.2, 0.75 + r() * 0.2));
    const k = instances(P.kelpGeo, P.material, kelp, rnd, (c, r) => c.setRGB(0.95 + r() * 0.25, 0.8 + r() * 0.2, 0.65 + r() * 0.2));
    g.frustumCulled = k.frustumCulled = true;
    g.computeBoundingSphere();
    k.computeBoundingSphere();
    const bed = { grass: g, kelp: k, grassTotal: grass.length, kelpTotal: kelp.length };
    if (q) {
      g.count = Math.floor(bed.grassTotal * q.plants);
      k.count = Math.floor(bed.kelpTotal * q.plants);
    }
    this.beds.push(bed);
    this.scene.add(g, k);
  }

  setQuality(q) {
    this.quality = q;
    for (const b of this.beds) {
      b.grass.count = Math.floor(b.grassTotal * q.plants);
      b.kelp.count = Math.floor(b.kelpTotal * q.plants);
    }
    this.particles.geometry.setDrawRange(0, q.particles);
    this.rayCount = q.rays;
  }

  setPixelRatio(pr) {
    this.particleMat.uniforms.uScale.value = 30 * pr;
    this.bubbleMat.uniforms.uScale.value = 300 * pr;
  }

  bubbles(x, y, z, n = 4, spread = 0.15) {
    for (let k = 0; k < n; k++) {
      const i = this.bi++ % this.maxB;
      this.bp[i * 3] = x + rand(-spread, spread);
      this.bp[i * 3 + 1] = y - k * rand(0.08, 0.2);
      this.bp[i * 3 + 2] = z + rand(-spread, spread);
      this.bSize[i] = rand(0.04, 0.12);
      this.bVy[i] = rand(0.45, 0.8);
      this.bSeed[i] = Math.random() * 10;
      this.bAlive[i] = 1;
    }
  }

  // Blend everything about the medium (fog, colour, sky, particles) by how far under
  // the surface the camera is. Returns 0 above water, 1 fully submerged.
  updateMedium(t, camera, env, scene, water, rain) {
    const cp = camera.position;
    const sub = smoothstep(0.12, -0.12, cp.y - waveHeight(cp.x, cp.z, t));
    const c = this.underColor;
    _day.copy(UNDER_DAY).lerp(UNDER_DAY_S, this.clear);
    _deep.copy(UNDER_DEEP).lerp(UNDER_DEEP_S, this.clear);
    c.copy(UNDER_NIGHT).lerp(_day, env.daylight);
    c.lerp(UNDER_DUSK, smoothstep(0.35, 0.05, env.sunDir.y) * env.daylight * 0.5);
    if (rain > 0) c.lerp(UNDER_RAIN, rain * 0.35 * env.daylight);
    c.multiplyScalar(1 - clamp(-cp.y / 40, 0, 0.45));
    if (sub > 0) {
      // Water scatters light from above: looking up the haze is bright, looking down it deepens to blue.
      camera.getWorldDirection(_look);
      _fogC.copy(c).lerp(_deep, clamp(0.35 - _look.y * 0.6, 0, 0.6) * env.daylight).multiplyScalar(1 + clamp(_look.y, 0, 1) * 0.35);
      scene.fog.color.lerp(_fogC, sub);
      scene.fog.density = lerp(scene.fog.density, lerp(0.034, 0.016, this.clear) + rain * 0.01 + env.night * 0.008, sub);
    }
    env.setUnder(sub, c);
    water.uniforms.uUnderColor.value.copy(c);
    water.uniforms.uUnder.value = sub;
    this.tint.style.opacity = sub.toFixed(3);
    this.submerge = sub;
    return sub;
  }

  update(dt, t, camera, env, rain) {
    // Weed beds in far-off places (out of sight in the haze) aren't drawn.
    for (const b of this.beds) {
      for (const o of [b.grass, b.kelp]) {
        const bs = o.boundingSphere;
        if (bs) o.visible = Math.hypot(bs.center.x - camera.position.x, bs.center.z - camera.position.z) - bs.radius < 420;
      }
    }
    shared.uTime.value = t;
    const sub = this.submerge;
    const cp = camera.position;
    this.particleMat.uniforms.uCam.value.copy(cp);
    this.particleMat.uniforms.uOpacity.value = sub * 0.55;
    this.particles.visible = sub > 0.01;

    const light = sub * env.daylight * (1 - rain * 0.7);
    for (let i = 0; i < this.rays.length; i++) {
      const r = this.rays[i], u = r.userData;
      r.visible = i < this.rayCount && light > 0.02;
      if (!r.visible) continue;
      const x = cp.x + ((((u.ox - cp.x) % 24) + 36) % 24) - 12;
      const z = cp.z + ((((u.oz - cp.z) % 24) + 36) % 24) - 12;
      r.position.set(x, waveHeight(x, z, t) - 0.2, z);
      r.rotation.set(clamp(env.lightDir.z * 0.4, -0.35, 0.35), Math.atan2(cp.x - x, cp.z - z), clamp(-env.lightDir.x * 0.4, -0.35, 0.35));
      const dist = Math.hypot(cp.x - x, cp.z - z);
      r.material.opacity = light * (0.1 + 0.05 * Math.sin(t * 0.5 + u.ph)) * (1 - smoothstep(6, 12, dist)) * smoothstep(1.5, 4, dist);
    }

    // A few bubbles drift up from the weeds near the camera while you watch.
    this.ambientT -= dt;
    if (sub > 0.4 && this.ambientT <= 0) {
      this.ambientT = rand(1.5, 4);
      const x = cp.x + rand(-12, 12), z = cp.z + rand(-12, 12);
      const s = this.habitat.sample(x, z);
      if (s.weed > 0.3 || s.rock > 0.4) this.bubbles(x, -s.depth + 0.3, z, 3 + Math.floor(Math.random() * 3));
    }
    for (let i = 0; i < this.maxB; i++) {
      if (!this.bAlive[i]) continue;
      const k = i * 3;
      this.bp[k + 1] += this.bVy[i] * dt;
      this.bp[k] += Math.sin(t * 3 + this.bSeed[i]) * 0.12 * dt;
      if (this.bp[k + 1] > waveHeight(this.bp[k], this.bp[k + 2], t) - 0.05) {
        if (this.onPop) this.onPop(this.bp[k], this.bp[k + 2]);
        this.bAlive[i] = 0;
        this.bp[k + 1] = -999;
      }
    }
    this.bubblesPts.geometry.attributes.position.needsUpdate = true;
    this.bubblesPts.geometry.attributes.aSize.needsUpdate = true;
  }
}
