import * as THREE from 'three';
import { COLDWATER, FALLS, TARN } from './coldwater.js';
import { clamp, lerp, smoothstep, glowTexture } from '../util.js';

// The Coldwater's water, from Hoar Tarn's lip down to the foot of the Lower Force (below that the
// river is at sea level, and the sea's own water serves): a ribbon along the river at its own
// level, flowing, white where it's steep, a sheet of water over each fall with mist at its foot;
// and the tarn, still and dark under the fell. Lit by the same sky as everything else, faintly
// mirroring it, glinting in the sun.

const VERT = /* glsl */ `
attribute float aFoam;
attribute float aFlow;
varying vec2 vUv;
varying float vFoam;
varying float vFlow;
varying vec3 vWorld;
varying vec3 vNormalW;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vFoam = aFoam;
  vFlow = aFlow;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSky;
uniform vec3 uHorizon;
uniform vec3 uAmbient;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uNight;
varying vec2 vUv;
varying float vFoam;
varying float vFlow;
varying vec3 vWorld;
varying vec3 vNormalW;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  // Ripples carried down the river (along v, in metres), quicker where it runs fast.
  float t = uTime * vFlow;
  float n1 = noise(vec2(vUv.x * 2.5, vUv.y * 0.55 - t * 0.9));
  float n2 = noise(vec2(vUv.x * 6.0 + 7.0, vUv.y * 1.6 - t * 1.6));
  float n3 = noise(vec2(vUv.x * 13.0 - 3.0, vUv.y * 3.4 - t * 2.4));
  vec3 N = normalize(vNormalW + vec3(n1 - 0.5, 0.0, n2 - 0.5) * (0.25 + vFlow * 0.18));
  vec3 V = normalize(cameraPosition - vWorld);
  float edge = abs(vUv.x * 2.0 - 1.0);
  // Clear water over stones near the edges, peaty and deep in the middle.
  vec3 col = mix(uDeep, uShallow, smoothstep(0.35, 1.0, edge));
  col *= uAmbient * 1.4 + uSunColor * max(dot(vNormalW, uSunDir), 0.0) * 0.35;
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  col = mix(col, mix(uHorizon, uSky, clamp(reflect(-V, N).y, 0.0, 1.0)), fres * 0.65);
  vec3 H = normalize(uSunDir + V);
  col += uSunColor * pow(max(dot(N, H), 0.0), 90.0) * 1.4 * (1.0 - uNight);
  // White water: streaks in the runs; over a fall, ropes of white pouring over darker water
  // (streaked down its face, thinner at its edges), churning at its foot.
  float streak = smoothstep(0.62, 0.86, n1 * 0.55 + n2 * 0.35 + n3 * 0.25);
  float fall = smoothstep(0.75, 1.0, vFoam);
  float ropes = noise(vec2(vUv.x * 17.0, vUv.y * 0.14 - t * 1.4)) * 0.6 + noise(vec2(vUv.x * 41.0 + 4.0, vUv.y * 0.45 - t * 2.6)) * 0.4;
  float foam = clamp(vFoam * (0.35 + streak * 1.2) * (1.0 - fall) + fall * (0.35 + smoothstep(0.3, 0.75, ropes) * 0.6), 0.0, 1.0);
  col = mix(col, vec3(0.93, 0.95, 0.95) * (uAmbient * 1.6 + uSunColor * 0.4), foam);
  float alpha = mix(0.86, 0.6, smoothstep(0.6, 1.0, edge)) + foam * 0.12;
  alpha *= 1.0 - fall * smoothstep(0.55, 1.0, edge) * 0.7;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

function waterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uSky: { value: new THREE.Color('#9fc7e4') },
      uHorizon: { value: new THREE.Color('#d5ebf1') },
      uAmbient: { value: new THREE.Color(0.5, 0.5, 0.5) },
      uDeep: { value: new THREE.Color('#2b3f3a') },
      uShallow: { value: new THREE.Color('#6f8a72') },
      uNight: { value: 0 },
    }]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
}

// Along the river, every metre or so: where, how wide, the water's level, how steep, how fast.
function samples() {
  const out = [];
  let s = 0;
  const last = FALLS.find((f) => f.id === 'lower').foot; // (the sea's water from here on)
  for (let i = 0; i < last; i++) {
    const a = COLDWATER[i], b = COLDWATER[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z), drop = a.l - b.l, steep = drop / len;
    const n = Math.max(2, Math.ceil(len / (steep > 0.5 ? 0.6 : 1.6)));
    // (s: metres along the water itself, down the face of a fall too.)
    const run = Math.hypot(len, drop);
    for (let k = 0; k < n; k++) {
      const u = k / n, e = smoothstep(0, 1, u);
      out.push({ x: lerp(a.x, b.x, u), z: lerp(a.z, b.z, u), w: lerp(a.w, b.w, e), l: lerp(a.l, b.l, u), steep, s: s + run * u });
    }
    s += run;
  }
  const b = COLDWATER[last];
  out.push({ x: b.x, z: b.z, w: b.w, l: b.l + 0.05, steep: 0, s });
  return out;
}

function ribbon() {
  const S = samples();
  const ACROSS = 5;
  const pos = [], uv = [], foam = [], flow = [], idx = [];
  S.forEach((p, i) => {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    // How white: rapids where it's steep, sheer white over a fall.
    const f = clamp(smoothstep(0.08, 0.35, p.steep) * 0.7 + smoothstep(0.9, 2.5, p.steep), 0, 1);
    const speed = clamp(0.35 + p.steep * 4 + 1.6 / (p.w + 0.8), 0.25, 3);
    for (let k = 0; k < ACROSS; k++) {
      const u = k / (ACROSS - 1), off = (u * 2 - 1) * (p.w + 0.9);
      pos.push(p.x + tz * off, p.l + 0.03, p.z - tx * off);
      uv.push(u, p.s);
      foam.push(f);
      flow.push(speed);
    }
    if (i < S.length - 1) {
      for (let k = 0; k < ACROSS - 1; k++) {
        const q = i * ACROSS + k;
        idx.push(q, q + ACROSS, q + 1, q + 1, q + ACROSS, q + ACROSS + 1);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aFoam', new THREE.Float32BufferAttribute(foam, 1));
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// Hoar Tarn: an oval of still water, a little larger than the tarn (the shore hides the edge).
function tarnGeometry() {
  const geo = new THREE.CircleGeometry(1, 48);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    uv.setXY(i, 0.5 - x * 0.18, z * (TARN.rz + 8));
  }
  geo.scale(TARN.rx + 10, 1, TARN.rz + 10);
  geo.rotateY(-TARN.yaw);
  geo.translate(TARN.x, TARN.level + 0.02, TARN.z);
  const n = p.count;
  geo.setAttribute('aFoam', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(new Float32Array(n).fill(0.12), 1));
  geo.computeVertexNormals();
  return geo;
}

export function buildColdwaterWater(scene) {
  const mat = waterMaterial();
  const river = new THREE.Mesh(ribbon(), mat);
  river.renderOrder = 2;
  scene.add(river);
  const tmat = waterMaterial();
  tmat.uniforms.uDeep.value.set('#1f3436');
  tmat.uniforms.uShallow.value.set('#4b6a66');
  const tarn = new THREE.Mesh(tarnGeometry(), tmat);
  tarn.renderOrder = 2;
  scene.add(tarn);
  // Mist at the foot of each fall: soft white puffs, rising and drifting off.
  const mist = [];
  const tex = glowTexture();
  for (const F of FALLS) {
    const a = COLDWATER[F.top], b = COLDWATER[F.foot], big = a.l - b.l > 20;
    for (let k = 0; k < (big ? 9 : 5); k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#f4f8f8', transparent: true, depthWrite: false, opacity: 0, fog: true }));
      s.userData = { x: b.x + (Math.random() - 0.5) * b.w * 0.8, z: b.z + (Math.random() - 0.5) * b.w * 0.8, y: b.l, size: big ? 7 : 4, phase: Math.random() * 10, rise: big ? 6 : 3 };
      s.renderOrder = 3;
      scene.add(s);
      mist.push(s);
    }
  }
  const mats = [mat, tmat];
  return {
    river, tarn, mist,
    // Each frame: the sky and the light of the hour, and time for the flow.
    update(t, env, camera) {
      for (const m of mats) {
        const U = m.uniforms;
        U.uTime.value = t;
        U.uSunDir.value.copy(env.lightDir);
        U.uSunColor.value.copy(env.sunColor).multiplyScalar(env.sunI * 0.3);
        U.uSky.value.copy(env.zenith);
        U.uHorizon.value.copy(env.horizon);
        U.uAmbient.value.copy(env.skyCol).multiplyScalar(env.hemiI * 0.35);
        U.uNight.value = env.night;
      }
      // (Only the mist near you is worth the bother.)
      for (const s of mist) {
        const d = s.userData, near = Math.hypot(camera.position.x - d.x, camera.position.z - d.z) < 400;
        s.visible = near;
        if (!near) continue;
        const k = ((t * 0.12 + d.phase) % 1);
        s.position.set(d.x + Math.sin(d.phase + t * 0.3) * 1.5, d.y + 0.8 + k * d.rise, d.z + Math.cos(d.phase * 1.7 + t * 0.25) * 1.5);
        s.scale.setScalar(d.size * (0.6 + k * 0.9));
        s.material.opacity = 0.32 * Math.sin(k * Math.PI) * (1 - env.night * 0.6);
      }
    },
  };
}
