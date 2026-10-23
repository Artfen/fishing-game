import * as THREE from 'three';
import { BAY, freshness } from './terrain.js';
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

// The lake and the stream are sheltered: only the faintest swell reaches them.
export function waveHeight(x, z, t = sea.time) {
  let h = 0;
  for (const w of WAVES) h += w.amp * Math.sin(w.k * (w.dx * x + w.dz * z - w.c * t));
  return h * sea.amp * calmness(x, z) * (1 - 0.92 * freshness(x, z));
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

// The world map, with a sharper copy over the west shore where the stream is narrow.
export const MAP_GLSL = /* glsl */ `
uniform sampler2D uHeight;
uniform vec4 uRect;
uniform sampler2D uHeight2;
uniform vec4 uRect2;
vec4 worldMap(vec2 xz) {
  vec2 uv2 = (xz - uRect2.xy) / uRect2.zw;
  if (uv2.x > 0.002 && uv2.y > 0.002 && uv2.x < 0.998 && uv2.y < 0.998) return texture2D(uHeight2, uv2);
  return texture2D(uHeight, (xz - uRect.xy) / uRect.zw);
}
`;

const vertexShader = /* glsl */ `
${WAVE_GLSL}
${MAP_GLSL}
uniform float uTime;
uniform mat4 uReflMatrix;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vRefl;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vRefl = uReflMatrix * vec4(wp.x, 0.0, wp.z, 1.0);
  float freshV = worldMap(wp.xz).g;
  vec3 w = waves(wp.xz, uTime) * (1.0 - 0.92 * freshV);
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
uniform vec3 uUnderColor;
uniform float uUnder;
uniform vec3 uFreshShallow;
uniform vec3 uFreshMid;
uniform vec3 uFreshDeep;
${MAP_GLSL}
uniform vec4 uLights[2];
uniform sampler2D uRefl;
uniform float uReflOn;
uniform vec2 uReflTexel;
uniform sampler2D uRipple;
uniform vec4 uRippleRect;
uniform float uRippleOn;
uniform float uRippleTexel;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vRefl;
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

// Slope of the ripple field (casts, the bobber, rising fish, the boat, wading).
vec2 rippleSlope(vec2 p) {
  if (uRippleOn < 0.5) return vec2(0.0);
  vec2 uv = (p - uRippleRect.xy) / uRippleRect.zw;
  float edge = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
  if (edge <= 0.0) return vec2(0.0);
  float e = uRippleTexel;
  float hx = texture2D(uRipple, uv + vec2(e, 0.0)).r - texture2D(uRipple, uv - vec2(e, 0.0)).r;
  float hz = texture2D(uRipple, uv + vec2(0.0, e)).r - texture2D(uRipple, uv - vec2(0.0, e)).r;
  return vec2(hx, hz) * smoothstep(0.0, 0.06, edge) / (2.0 * e * uRippleRect.z);
}

void main() {
  vec2 rip = rippleSlope(vWorld.xz);
  // Seen from below: bright where you look straight up through the surface,
  // the darker underwater colour where the light reflects back at a slant.
  // From under the water every part of the surface is its underside, even far-off wave slopes
  // that happen to tilt their top towards you.
  if (!gl_FrontFacing || uUnder > 0.5) {
    vec3 Vu = normalize(cameraPosition - vWorld);
    vec2 gu = ngrad(vWorld.xz * 0.45 + vec2(uTime * 0.16, uTime * 0.07)) + ngrad(vWorld.xz * 1.3 - uTime * 0.2) * 0.5 + rip * 2.0;
    // Snell's window: looking up you see the sky squeezed into a bright circle; outside it the
    // surface mirrors the water below. Its edge shimmers with the waves.
    float view = clamp(-Vu.y, 0.0, 1.0) + (gu.x + gu.y) * 0.05;
    float win = smoothstep(0.58, 0.8, view);
    vec3 Nu = normalize(vec3(gu.x * 0.15, -1.0, gu.y * 0.15));
    vec3 Tu = refract(-Vu, Nu, 1.33);
    vec3 skyU = mix(uHorizon, uZenith, clamp(Tu.y, 0.0, 1.0)) * 0.85;
    float sunU = pow(max(dot(Tu, uLightDir), 0.0), 40.0) * smoothstep(-0.02, 0.1, uLightDir.y);
    skyU += uSunColor * (0.12 + sunU * 2.2);
    vec3 colU = mix(uUnderColor * 0.8, mix(skyU, uUnderColor * 1.5, 0.4), win);
    // A brighter rim where the window meets the mirrored part.
    colU += skyU * 0.25 * win * (1.0 - smoothstep(0.78, 0.86, view));
    colU += uSunColor * pow(max(0.0, 1.0 - length(gu) * 0.5), 6.0) * 0.06 * win;
    gl_FragColor = vec4(colU, 0.95);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    return;
  }
  vec4 hs = worldMap(vWorld.xz);
  float ground = hs.r;
  float fresh = hs.g;
  vec2 flow = hs.ba;
  float flowSpeed = length(flow);
  float depth = max(-ground, 0.0);
  float dist = length(cameraPosition - vWorld);
  float detail = 1.0 - smoothstep(40.0, 220.0, dist);

  vec2 p = vWorld.xz;
  // Gusts: slow patches where the breeze ruffles the water, with calmer, glassier lanes between.
  float gust = smoothstep(0.2, 0.8, vnoise(p * 0.016 + vec2(uTime * 0.011, uTime * 0.005)) * 0.7 + vnoise(p * 0.05 - uTime * 0.02) * 0.3);
  float wind = mix(0.4, 1.2, gust) * mix(1.0, 0.6, fresh);
  // Still water (the lake) gets only a faint ruffle; the sea keeps its chop.
  float chop = 1.0 - fresh * 0.65;
  vec2 g = ngrad(p * 0.45 + vec2(uTime * 0.16, uTime * 0.07)) * 0.10 * chop
         + ngrad(p * 1.1 + vec2(-uTime * 0.11, uTime * 0.19)) * 0.05;
#if DETAIL > 0
  // Finer wavelets in other directions, fading out with distance so they never shimmer.
  float near = 1.0 - smoothstep(12.0, 70.0, dist);
  g += ngrad(p * 2.6 + vec2(uTime * 0.23, -uTime * 0.15)) * 0.035 * near;
#endif
#if DETAIL > 1
  g += ngrad(p * 5.3 + vec2(-uTime * 0.34, -uTime * 0.27)) * 0.02 * near * near;
#endif
  g *= wind;
  // Running water: ripples carried downstream (two phases cross-faded so they never stretch).
  float streak = 0.0;
  if (flowSpeed > 0.02) {
    float ph0 = fract(uTime * 0.45), ph1 = fract(uTime * 0.45 + 0.5);
    float wgt = abs(ph0 * 2.0 - 1.0);
    vec2 q0 = p * 1.6 - flow * ph0 * 2.2, q1 = p * 1.6 - flow * ph1 * 2.2 + 0.37;
    g += mix(ngrad(q0), ngrad(q1), wgt) * 0.09 * min(flowSpeed * 1.6, 1.0);
    vec2 sd = normalize(flow);
    vec2 sq = vec2(dot(p, vec2(-sd.y, sd.x)) * 3.0, dot(p, sd) * 0.5);
    float n0 = vnoise(sq - vec2(0.0, uTime * flowSpeed * 1.1));
    streak = smoothstep(0.7, 0.95, n0) * smoothstep(0.45, 1.0, flowSpeed) * (1.0 - smoothstep(0.25, 0.7, depth));
  }
  g += rainRings(p, uTime) * uRain * 0.45;
  g *= detail;
  g += rip;
  vec3 N = normalize(vec3(vN.x - g.x, vN.y, vN.z - g.y));
  vec3 V = normalize(cameraPosition - vWorld);

  float s1 = smoothstep(0.0, 3.0, depth);
  float s2 = smoothstep(2.5, 13.0, depth);
  vec3 base = mix(mix(uShallow, uMid, s1), uDeep, s2);
  vec3 freshBase = mix(mix(uFreshShallow, uFreshMid, smoothstep(0.0, 2.2, depth)), uFreshDeep, smoothstep(2.0, 6.0, depth));
  base = mix(base, freshBase, fresh);

  float diff = clamp(dot(N, uLightDir), 0.0, 1.0);
  vec3 col = base * (uAmbient + uSunColor * (0.25 + 0.55 * diff));

  vec3 R = reflect(-V, N);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
  // Far away the water looks rougher: reflections soften and the sun's path spreads.
  float rough = smoothstep(25.0, 260.0, dist);
  vec3 sky = mix(uHorizon, uZenith, clamp(R.y * 1.5, 0.0, 1.0));
  // The mirrored scene (sky, shore, boat, lights), nudged by the small waves and ripples.
  // Calm fresh water mirrors crisply; the sea breaks it up.
  if (uReflOn > 0.5) {
    vec2 ruv = vRefl.xy / vRefl.w + (g * 0.9 + vec2(-vN.x, -vN.z) * 0.25) * mix(0.14, 0.05, fresh);
    vec2 inside = smoothstep(vec2(0.0), vec2(0.04), ruv) * smoothstep(vec2(1.0), vec2(0.96), ruv);
    ruv = clamp(ruv, 0.002, 0.998);
    // Choppy sea water blurs what it mirrors; the calm lake keeps it sharp.
    vec2 bl = uReflTexel * mix(4.0, 1.0, fresh) * (1.0 + rough * 2.0);
    vec3 mirrored = texture2D(uRefl, ruv).rgb * 0.4
      + (texture2D(uRefl, ruv + vec2(bl.x, bl.y)).rgb + texture2D(uRefl, ruv - vec2(bl.x, bl.y)).rgb
      + texture2D(uRefl, ruv + vec2(bl.x, -bl.y)).rgb + texture2D(uRefl, ruv + vec2(-bl.x, bl.y)).rgb) * 0.15;
    sky = mix(sky, mirrored, inside.x * inside.y * (1.0 - uRain * 0.4));
  }
  // Looking straight down you mostly see into the water; at a glancing angle, mostly reflection.
  float reflAmt = mix(0.035 + fres * 0.66, 0.08 + fres * 0.82, fresh);
  col = mix(col, sky, clamp(reflAmt, 0.0, 1.0));

  float sd = max(dot(R, uLightDir), 0.0);
  float up = smoothstep(-0.02, 0.08, uLightDir.y);
  float sunSpec = pow(sd, mix(220.0, 45.0, rough)) * mix(2.4, 0.7, rough) + pow(sd, 18.0) * 0.12;
#if DETAIL > 0
  // Glints: single wavelets flashing the sun back for a moment, along the sun's path.
  vec2 gc = p * 4.0 + g * 3.0;
  vec2 gcell = floor(gc);
  float gh = hash12(gcell);
  float blink = fract(uTime * (0.7 + gh) + gh * 7.0);
  vec2 goff = vec2(hash12(gcell + 3.1), hash12(gcell + 7.7)) * 0.7 + 0.15;
  float spot = 1.0 - smoothstep(0.02, 0.1, length(fract(gc) - goff));
  float glint = spot * step(0.8, gh) * smoothstep(0.0, 0.1, blink) * (1.0 - smoothstep(0.1, 0.3, blink));
  sunSpec += glint * pow(sd, 24.0) * near * wind * 3.5;
#endif
  col += uSunColor * sunSpec * up * (1.0 - uRain * 0.85);
  // Ripple crests catch a little extra light.
  col += (uAmbient + uSunColor * 0.4) * clamp(length(rip) * 0.6, 0.0, 0.25);

  // Shoreline foam: a soft edge plus slow bands rolling in.
  float n1 = vnoise(p * 0.7 + uTime * 0.25);
  float edge = 1.0 - smoothstep(0.0, 0.4 + n1 * 0.35, depth);
  float bands = smoothstep(0.85, 1.0, sin(depth * 5.0 - uTime * 1.3 + n1 * 3.0)) * (1.0 - smoothstep(0.2, 1.6, depth)) * (1.0 - fresh);
  float foam = clamp(edge * (0.9 - fresh * 0.75) + bands * 0.55 + streak * 0.45, 0.0, 1.0);
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

  float alpha = mix(0.42, 0.95, smoothstep(0.0, 5.0, depth));
  // Clear fresh water: you can see the gravel in the stream and fish in the shallows.
  alpha = mix(alpha, mix(0.5, 0.92, smoothstep(0.0, 3.0, depth)), fresh);
  alpha = max(alpha, foam);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function createWater(heightTex, rect, detailTex, detailRect) {
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
      uUnderColor: { value: new THREE.Color('#2a8b95') },
      uFreshShallow: { value: new THREE.Color('#6f9480') },
      uFreshMid: { value: new THREE.Color('#46705a') },
      uFreshDeep: { value: new THREE.Color('#25463f') },
      uRect: { value: new THREE.Vector4(rect.x, rect.z, rect.w, rect.h) },
      uLights: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uReflOn: { value: 0 },
      uUnder: { value: 0 },
      uReflMatrix: { value: new THREE.Matrix4() },
      uRippleOn: { value: 0 },
      uRippleTexel: { value: 1 / 512 },
      uReflTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    },
  ]);
  // Assigned after merge so the textures (and shared vectors) aren't cloned.
  uniforms.uHeight = { value: heightTex };
  uniforms.uHeight2 = { value: detailTex };
  uniforms.uRect2 = { value: new THREE.Vector4(detailRect.x, detailRect.z, detailRect.w, detailRect.h) };
  uniforms.uRefl = { value: null };
  uniforms.uRipple = { value: null };
  uniforms.uRippleRect = { value: new THREE.Vector4(0, 0, 1, 1) };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    defines: { DETAIL: 2 },
    transparent: true,
    fog: true,
    side: THREE.DoubleSide,
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
    // 0: two wave layers (low), 1: plus fine wavelets and glints, 2: plus the finest layer.
    setDetail(level) {
      if (material.defines.DETAIL === level) return;
      material.defines.DETAIL = level;
      material.needsUpdate = true;
    },
    setSegments(seg) {
      if (cell === SIZE / seg) return;
      mesh.geometry.dispose();
      mesh.geometry = sheet(seg);
      cell = SIZE / seg;
    },
  };
}
