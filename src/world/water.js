import * as THREE from 'three';
import { BAY } from './terrain.js';
import { smoothstep } from '../util.js';

// Gentle swells. The same numbers drive the shader and the boat's bobbing,
// so the hull always sits on the water you see.
const RAW = [
  // dirX, dirZ, wavelength, amplitude, speed
  [0.8, 0.6, 30, 0.17, 1.7],
  [-0.45, 0.89, 16, 0.085, 1.25],
  [0.96, -0.28, 9.5, 0.04, 1.0],
  [0.25, -0.97, 6, 0.018, 0.85],
];
export const WAVES = RAW.map(([dx, dz, len, amp, c]) => {
  const l = Math.hypot(dx, dz);
  return { dx: dx / l, dz: dz / l, k: (Math.PI * 2) / len, amp, c };
});

// sea.amp rises a little in the rain; sea.time is the shared wave clock.
export const sea = { amp: 1, time: 0 };

const calmness = (x, z) => 0.5 + 0.8 * smoothstep(55, 150, Math.hypot(x - BAY.x, z - BAY.z));

export function waveHeight(x, z, t = sea.time) {
  let h = 0;
  for (const w of WAVES) h += w.amp * Math.sin(w.k * (w.dx * x + w.dz * z - w.c * t));
  return h * sea.amp * calmness(x, z);
}

const f = (n) => n.toFixed(5);
const WAVE_GLSL = /* glsl */ `
uniform float uAmp;
vec3 waves(vec2 p, float t) {
  vec3 r = vec3(0.0);
  float a;
  ${WAVES.map((w) => `a = ${f(w.k)} * (${f(w.dx)} * p.x + ${f(w.dz)} * p.y - ${f(w.c)} * t);
  r.x += ${f(w.amp)} * sin(a);
  r.y += ${f(w.amp * w.k * w.dx)} * cos(a);
  r.z += ${f(w.amp * w.k * w.dz)} * cos(a);`).join('\n  ')}
  float calm = 0.5 + 0.8 * smoothstep(55.0, 150.0, length(p - vec2(${f(BAY.x)}, ${f(BAY.z)})));
  return r * uAmp * calm;
}
`;

const vertexShader = /* glsl */ `
${WAVE_GLSL}
uniform float uTime;
varying vec3 vWorld;
varying vec3 vN;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 w = waves(wp.xz, uTime);
  wp.y += w.x;
  vN = vec3(-w.y, 1.0, -w.z);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uRain;
uniform float uNight;
uniform vec3 uLightDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uShallow;
uniform vec3 uMid;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform sampler2D uHeight;
uniform vec4 uRect;
uniform vec4 uLights[2];
varying vec3 vWorld;
varying vec3 vN;
#include <fog_pars_fragment>

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec2 ngrad(vec2 p) {
  float c = vnoise(p);
  return vec2(vnoise(p + vec2(0.12, 0.0)) - c, vnoise(p + vec2(0.0, 0.12)) - c) / 0.12;
}
// Expanding rings where raindrops land.
vec2 rainRings(vec2 p, float t) {
  vec2 g = vec2(0.0);
  for (int k = 0; k < 2; k++) {
    vec2 q = p * 0.9 + float(k) * 7.31;
    vec2 cell = floor(q);
    vec2 fq = fract(q) - 0.5;
    float h = hash12(cell + float(k) * 3.7);
    vec2 off = vec2(hash12(cell + 1.7), hash12(cell + 4.3)) - 0.5;
    vec2 d = fq - off * 0.5;
    float ph = fract(t * 0.8 + h);
    float dist = length(d);
    float ring = (1.0 - smoothstep(0.0, 0.05, abs(dist - ph * 0.45))) * (1.0 - ph);
    g += (d / max(dist, 0.001)) * ring;
  }
  return g;
}

void main() {
  vec2 uv = (vWorld.xz - uRect.xy) / uRect.zw;
  float ground = texture2D(uHeight, uv).r;
  float depth = max(-ground, 0.0);
  float dist = length(cameraPosition - vWorld);
  float detail = 1.0 - smoothstep(40.0, 220.0, dist);

  vec2 p = vWorld.xz;
  vec2 g = ngrad(p * 0.45 + vec2(uTime * 0.16, uTime * 0.07)) * 0.10
         + ngrad(p * 1.1 + vec2(-uTime * 0.11, uTime * 0.19)) * 0.05;
  g += rainRings(p, uTime) * uRain * 0.45;
  g *= detail;
  vec3 N = normalize(vec3(vN.x - g.x, vN.y, vN.z - g.y));
  vec3 V = normalize(cameraPosition - vWorld);

  float s1 = smoothstep(0.0, 3.0, depth);
  float s2 = smoothstep(2.5, 13.0, depth);
  vec3 base = mix(mix(uShallow, uMid, s1), uDeep, s2);

  float diff = clamp(dot(N, uLightDir), 0.0, 1.0);
  vec3 col = base * (uAmbient + uSunColor * (0.25 + 0.55 * diff));

  vec3 R = reflect(-V, N);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
  vec3 sky = mix(uHorizon, uZenith, clamp(R.y * 1.5, 0.0, 1.0));
  col = mix(col, sky, clamp(0.06 + fres * 0.6, 0.0, 1.0));

  float sd = max(dot(R, uLightDir), 0.0);
  float up = smoothstep(-0.02, 0.08, uLightDir.y);
  col += uSunColor * (pow(sd, 220.0) * 2.4 + pow(sd, 18.0) * 0.12) * up * (1.0 - uRain * 0.85);

  // Shoreline foam: a soft edge plus slow bands rolling in.
  float n1 = vnoise(p * 0.7 + uTime * 0.25);
  float edge = 1.0 - smoothstep(0.0, 0.4 + n1 * 0.35, depth);
  float bands = smoothstep(0.85, 1.0, sin(depth * 5.0 - uTime * 1.3 + n1 * 3.0)) * (1.0 - smoothstep(0.2, 1.6, depth));
  float foam = clamp(edge * 0.9 + bands * 0.55, 0.0, 1.0);
  vec3 foamLit = uFoam * (uAmbient + uSunColor * 0.6);
  col = mix(col, foamLit, foam * 0.85);

  // Warm lantern light pooling on the water.
  for (int i = 0; i < 2; i++) {
    vec4 L = uLights[i];
    if (L.w > 0.001) {
      vec3 toL = L.xyz - vWorld;
      float ld = length(toL.xz);
      float glow = exp(-ld * 0.38) * 0.24;
      float spec = pow(max(dot(R, normalize(toL)), 0.0), 60.0) * 0.6;
      col += vec3(1.0, 0.6, 0.3) * L.w * (glow + spec);
    }
  }

  col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), uNight * 0.35);

  float alpha = mix(0.5, 0.97, smoothstep(0.0, 3.5, depth));
  alpha = max(alpha, foam);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function createWater(heightTex, rect) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uAmp: { value: 1 },
      uRain: { value: 0 },
      uNight: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uAmbient: { value: new THREE.Color() },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uShallow: { value: new THREE.Color('#7fd8c6') },
      uMid: { value: new THREE.Color('#38a0ad') },
      uDeep: { value: new THREE.Color('#1b5c85') },
      uFoam: { value: new THREE.Color('#f7f5ec') },
      uRect: { value: new THREE.Vector4(rect.x, rect.z, rect.w, rect.h) },
      uLights: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    },
  ]);
  // Assigned after merge so the texture isn't cloned.
  uniforms.uHeight = { value: heightTex };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    fog: true,
  });

  // A finely tessellated sheet that follows the camera, snapped to its grid
  // so the vertices never swim. Fewer segments on lower quality settings.
  const SIZE = 900;
  const sheet = (seg) => new THREE.PlaneGeometry(SIZE, SIZE, seg, seg).rotateX(-Math.PI / 2);
  let cell = SIZE / 300;
  const mesh = new THREE.Mesh(sheet(300), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  return {
    mesh,
    uniforms,
    follow(pos) {
      mesh.position.x = Math.round(pos.x / cell) * cell;
      mesh.position.z = Math.round(pos.z / cell) * cell;
    },
    setSegments(seg) {
      if (cell === SIZE / seg) return;
      mesh.geometry.dispose();
      mesh.geometry = sheet(seg);
      cell = SIZE / seg;
    },
  };
}
