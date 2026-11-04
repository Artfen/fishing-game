import * as THREE from 'three';
import { conditions, WAVE_PARTS, bakeShelter, tidalTexture, SHELTER_RECT, waveHeight as conditionsWaveHeight } from './conditions.js';
import { longSea, PATCH, SHORT } from './ocean.js';
import { ShortSea } from './oceangpu.js';

// The water surface: swell and wind chop from the shared conditions (conditions.js). The same
// function moves these vertices and lifts the boats and floats (waveHeight below), so a hull
// always sits on the water you see.
export const waveHeight = conditionsWaveHeight;
const NEAR_R = 444; // the fine water sheet is round, this far around the camera

const f = (n) => n.toFixed(5);
const { SWELL } = WAVE_PARTS;
// The waves at a point: the swell (a few long waves, each scaled by how exposed the water is to
// it: shelter.r) and the wind sea (the long-wave patch from ocean.js, sent up each frame, scaled
// by shelter.g), faded in the last shallows and on fresh water. Mirrors conditions.js waveHeight
// term for term: the same swell, and the wind sea sampled from the same grid the same way
// (Catmull-Rom, both copies of the patch), so a hull sits on the water you see. Far off, where
// the sheet's cells are coarse, the patch is read blurred (its mipmaps) so nothing flickers.
const WAVE_GLSL = /* glsl */ `
uniform float uSwellA[${SWELL.length}];
uniform float uPeak;
uniform float uStorm;
uniform sampler2D uShelter;
uniform vec4 uShelterRect;
uniform float uTideLevel; // the tide: the sea's level above the mean (m); not the lakes'
uniform vec2 uWaveLod;    // the sheet's finest cell (m), and how far out (m per m of wavelength) it can still draw a wave
uniform sampler2D uSea0;  // the wind sea's long waves (ocean.js): height, displacement x, z
uniform sampler2D uSea1;  // and their slopes, x and z, and foam
uniform vec4 uSeaCopy;    // the patch's second copy: cos, sin of its turn; its shift x, z
uniform vec2 uSeaPatch;   // the patch: metres across, cells across
uniform float uSeaChop;   // how far the water's to-and-fro carries a crest along
uniform sampler2D uShortDisp; // the short waves (oceangpu.js, Ocean: Full): height, to-and-fro x, z
uniform float uShortOn;
uniform float uShortL;        // their patch, metres across
// How much of a wave of length len the sheet can draw this far from you (dist, m).
float waveLod(float len, float dist) {
  float far = len * uWaveLod.y;
  return smoothstep(2.4 * uWaveLod.x, 3.0 * uWaveLod.x, len) * smoothstep(far, far * 0.7, dist);
}
vec4 crW(float f) {
  float f2 = f * f, f3 = f2 * f;
  return vec4(-0.5 * f3 + f2 - 0.5 * f, 1.5 * f3 - 2.5 * f2 + 1.0, -1.5 * f3 + 2.0 * f2 + 0.5 * f, 0.5 * f3 - 0.5 * f2);
}
// The patch at tile point q (metres), Catmull-Rom over its grid.
vec4 seaCR(vec2 q) {
  vec2 g = q * (uSeaPatch.y / uSeaPatch.x), i0 = floor(g), f = g - i0;
  vec4 wx = crW(f.x), wz = crW(f.y), r = vec4(0.0);
  for (int b = 0; b < 4; b++) {
    vec4 row = vec4(0.0);
    for (int a = 0; a < 4; a++) {
      ivec2 c = ivec2(mod(i0 + vec2(float(a - 1), float(b - 1)), uSeaPatch.y));
      row += texelFetch(uSea0, c, 0) * wx[a];
    }
    r += row * wz[b];
  }
  return r;
}
vec2 seaCopy(vec2 p) {
  vec2 u = p - uSeaCopy.zw;
  return vec2(u.x * uSeaCopy.x + u.y * uSeaCopy.y, -u.x * uSeaCopy.y + u.y * uSeaCopy.x);
}
// The wind sea at world point p (both copies): height, and how far the point is carried (x, z).
vec3 seaAt(vec2 p, float dist) {
  vec2 q1 = p, q2 = seaCopy(p);
  vec4 a = vec4(0.0), b = vec4(0.0);
  float far = smoothstep(50.0, 75.0, dist);
  if (far < 1.0) {
    a = seaCR(q1);
    b = seaCR(q2);
  }
  if (far > 0.0) {
    float lod = log2(max(1.0, dist / 60.0));
    vec2 o = vec2(0.5 / uSeaPatch.y);
    a = mix(a, textureLod(uSea0, q1 / uSeaPatch.x + o, lod), far);
    b = mix(b, textureLod(uSea0, q2 / uSeaPatch.x + o, lod), far);
  }
  vec2 bd = vec2(b.y * uSeaCopy.x - b.z * uSeaCopy.y, b.y * uSeaCopy.y + b.z * uSeaCopy.x);
  return vec3(a.x + b.x, a.yz + bd) * 0.70710678;
}
// Height and the swell's slopes (x, z) at p, and (shift) how far the wind sea carries the point.
vec3 waves(vec2 p, float t, float ground, float fresh, float dist, out vec2 shift) {
  vec4 sh = texture2D(uShelter, (p - uShelterRect.xy) / uShelterRect.zw);
  float depth = max(uTideLevel * (1.0 - fresh) - ground, 0.0);
  // (Running into shallow water the swell grows and steepens: conditions.js shoalGrow, shoalPeak.)
  float ks = sh.r * (1.0 + 0.8 * smoothstep(8.0, 2.5, depth) * smoothstep(0.8, 2.2, depth)), kc = 0.15 + 0.85 * sh.g;
  float pk = min(uPeak + 1.4 * smoothstep(5.0, 1.5, depth), 3.6);
  vec3 r = vec3(0.0);
  float a, s;
  // (Every swell wave has a Stokes crest, as conditions.js swellShape: sharpened in a storm and
  // in the shallows.)
  ${SWELL.map((w, i) => `a = ${f(w.k)} * (${f(w.dx)} * p.x + ${f(w.dz)} * p.y - ${f(w.c)} * t);
  s = uSwellA[${i}] * ks;
  r += vec3(s * sin(a) - ${f(0.5 * w.k)} * s * s * pk * cos(2.0 * a), vec2(${f(w.k * w.dx)}, ${f(w.k * w.dz)}) * (s * cos(a) + ${f(w.k)} * s * s * pk * sin(2.0 * a)));`).join('\n  ')}
  float fade = smoothstep(0.05, 0.9 + 3.5 * uStorm, -ground) * (1.0 - 0.85 * fresh);
  vec3 sea = seaAt(p, dist);
  // (The short waves too, close by: read blurred to about twice the sheet's cell there, so it
  // only carries those it can draw.)
  if (uShortOn > 0.5 && dist < 90.0) {
    float cell = max(uWaveLod.x, dist * 4.0 / (uWaveLod.y * 12.0));
    float lod = log2(max(1.0, 2.0 * cell / (uShortL / 128.0)));
    sea += textureLod(uShortDisp, p / uShortL, lod).xyz * (1.0 - smoothstep(60.0, 90.0, dist));
  }
  sea *= kc * fade;
  shift = sea.yz * uSeaChop;
  return r * fade + vec3(sea.x, 0.0, 0.0);
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
uniform sampler2D uRipple;
uniform vec4 uRippleRect;
uniform float uRippleOn;
attribute vec3 aEdge; // on a ring's outer edge, between two of the coarser ring's vertices: 1, and the offset to them
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vRefl;
varying vec2 vRest; // where this bit of surface lies when the water's still (for the patch's slopes)
varying float vWave; // how high the waves have lifted it here (m)
#include <fog_pars_vertex>
// The wakes and the ripples (the ripple field: see waterfx.js and wakes.js): heights, metres.
float rippleHeight(vec2 p) {
  if (uRippleOn < 0.5) return 0.0;
  vec2 uv = (p - uRippleRect.xy) / uRippleRect.zw;
  float edge = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
  if (edge <= 0.0) return 0.0;
  vec4 r = texture2D(uRipple, uv);
  return (r.r + r.g) * smoothstep(0.0, 0.15, edge);
}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vRefl = uReflMatrix * vec4(wp.x, 0.0, wp.z, 1.0);
  vec4 mapV = worldMap(wp.xz);
  vRest = wp.xz;
  #ifdef RING
  // The far ocean, out to the horizon: too far off to see the waves move.
  vec3 w = vec3(0.0);
  #else
  float dist = length(wp.xz - cameraPosition.xz);
  vec3 w;
  vec2 shift;
  if (aEdge.x > 0.5) {
    // (Where a finer ring meets a coarser one, its in-between vertices sit on the coarser ring's
    // straight edge, so the two meet without a crack.)
    vec2 e = aEdge.yz, s0, s1;
    vec4 m0 = worldMap(wp.xz - e), m1 = worldMap(wp.xz + e);
    w = 0.5 * (waves(wp.xz - e, uTime, m0.r, m0.g, dist, s0) + waves(wp.xz + e, uTime, m1.r, m1.g, dist, s1));
    shift = 0.5 * (s0 + s1);
    w.x += 0.5 * (rippleHeight(wp.xz - e) + rippleHeight(wp.xz + e)) * waveLod(3.0, dist);
  } else {
    w = waves(wp.xz, uTime, mapV.r, mapV.g, dist, shift);
    // (The wakes lift the sheet close by, where its cells are fine enough for their short waves;
    // further off they show in its shading alone.)
    w.x += rippleHeight(wp.xz) * waveLod(3.0, dist);
  }
  wp.xz += shift;
  #endif
  wp.y += w.x + uTideLevel * (1.0 - mapV.g);
  vWave = w.x;
  vN = vec3(-w.y, 1.0, -w.z);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uRain;  // how dull the sky is (cloud and rain)
uniform float uRings; // rain rings on the water (rain, scaled by the rain-effects setting)
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
uniform sampler2D uShelter;
uniform vec4 uShelterRect;
uniform sampler2D uTidal;  // the tidal streams at full ebb (RG), turned by uTideFlow
uniform float uTideFlow;   // +1 full ebb … −1 full flood
uniform float uTideLevel;  // the sea's level above the mean (m)
uniform vec2 uWindV;     // where the wind blows, times its strength (0 … 1 at a fresh breeze)
uniform float uSwellH;   // the swell's crest amplitude (m)
uniform float uChopH;    // the chop's crest amplitude (m)
uniform float uStorm;    // how stormy (0 … 1)
uniform float uWindMS;   // the sustained wind (m/s), for the whitecaps
uniform float uClear;    // clear blue water (Las Brasas): you see the seabed and the fish much deeper
uniform float uColour;   // silt stirred up by rain or a blow (0 clear … 1 thick): see grounds.js
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vRefl;
varying vec2 vRest;
varying float vWave;
uniform sampler2D uShortSlope; // the short waves (Ocean: Full): slopes x, z, and how pinched (J)
uniform float uShortOn;
uniform float uShortL;
uniform sampler2D uSea1;  // the wind sea's long waves: slopes x, z and foam (see WAVE_GLSL)
uniform vec4 uSeaCopy;
uniform vec2 uSeaPatch;
vec2 seaCopy(vec2 p) {
  vec2 u = p - uSeaCopy.zw;
  return vec2(u.x * uSeaCopy.x + u.y * uSeaCopy.y, -u.x * uSeaCopy.y + u.y * uSeaCopy.x);
}
vec3 V0(vec3 w) { return normalize(cameraPosition - w); }
vec3 seaSlope(vec2 p) {
  vec2 o = vec2(0.5 / uSeaPatch.y);
  vec4 a = texture2D(uSea1, p / uSeaPatch.x + o), b = texture2D(uSea1, seaCopy(p) / uSeaPatch.x + o);
  vec2 bs = vec2(b.x * uSeaCopy.x - b.y * uSeaCopy.y, b.x * uSeaCopy.y + b.y * uSeaCopy.x);
  return vec3((a.xy + bs) * 0.70710678, max(a.z, b.z));
}
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

// Slopes of the ripple field: xy the little rings (casts, the bobber, rising fish, the boat,
// wading), zw the boats' wakes (see wakes.js).
vec4 rippleSlopes(vec2 p) {
  if (uRippleOn < 0.5) return vec4(0.0);
  vec2 uv = (p - uRippleRect.xy) / uRippleRect.zw;
  float edge = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
  if (edge <= 0.0) return vec4(0.0);
  float e = uRippleTexel;
  vec2 hx = (texture2D(uRipple, uv + vec2(e, 0.0)) - texture2D(uRipple, uv - vec2(e, 0.0))).rg;
  vec2 hz = (texture2D(uRipple, uv + vec2(0.0, e)) - texture2D(uRipple, uv - vec2(0.0, e))).rg;
  return vec4(hx.x, hz.x, hx.y, hz.y) * smoothstep(0.0, 0.15, edge) / (2.0 * e * uRippleRect.z);
}

void main() {
  // The near sheet is round, and the far ring starts where it ends.
  #ifndef RING
  if (length(vWorld.xz - cameraPosition.xz) > ${NEAR_R.toFixed(1)}) discard;
  #endif
  vec4 rips = rippleSlopes(vWorld.xz);
  vec2 rip = rips.xy + rips.zw;
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
  vec4 shel = texture2D(uShelter, (vWorld.xz - uShelterRect.xy) / uShelterRect.zw);
  // The stream's current (fine) and the sea's: the river, channels, headlands and the shoal.
  vec2 tidal = texture2D(uTidal, (vWorld.xz - uShelterRect.xy) / uShelterRect.zw).rg;
  vec2 flow = hs.ba + (shel.ba + tidal * uTideFlow) * 1.6;
  float flowSpeed = length(flow);
  float depth = max(uTideLevel * (1.0 - fresh) - ground, 0.0);
  float dist = length(cameraPosition - vWorld);
  float detail = 1.0 - smoothstep(40.0, 220.0, dist);

  vec2 p = vWorld.xz;
  // The wind sea's long waves (ocean.js): their slope here, smooth from pixel to pixel, and the
  // foam where their crests have broken; with the swell's slope (from the sheet), the waves' own.
  float kcS = (0.15 + 0.85 * shel.g) * smoothstep(0.05, 0.9 + 3.5 * uStorm, -ground) * (1.0 - 0.85 * fresh);
  vec3 seaS = seaSlope(vRest) * kcS;
  vec3 Nw = vec3(vN.x - seaS.x, 1.0, vN.z - seaS.y);
  // And the short waves (Ocean: Full), pixel by pixel: two readings of their patch, one turned and
  // larger, so its tiling never shows; their pinched crests lace the foam.
  vec3 shortS = vec3(0.0, 0.0, 1.0);
  if (uShortOn > 0.5) {
    vec2 q = vRest / uShortL, q2 = mat2(0.81, 0.59, -0.59, 0.81) * vRest / (uShortL * 1.63) + vec2(0.37, 0.71);
    vec4 s1 = texture2D(uShortSlope, q), s2 = texture2D(uShortSlope, q2);
    shortS = vec3((s1.xy + vec2(0.81 * s2.x - 0.59 * s2.y, 0.59 * s2.x + 0.81 * s2.y) / 1.63) * 0.8 * kcS, min(s1.z, mix(1.0, s2.z, 0.6)));
  }
  // Gusts: patches where the breeze ruffles the water, carried downwind, with calmer, glassier
  // lanes between. Stronger wind, rougher water; sheltered water stays smoother.
  float windS = length(uWindV);
  vec2 drift = uWindV * uTime * 2.2;
  float gust = smoothstep(0.2, 0.8, vnoise((p - drift) * 0.016) * 0.7 + vnoise((p - drift * 1.6) * 0.05) * 0.3);
  float wind = mix(0.4, 1.2, gust) * mix(1.0, 0.6, fresh) * (0.35 + 0.85 * min(windS, 1.0) * (0.3 + 0.7 * shel.g));
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
  g += rainRings(p, uTime) * uRings * 0.45;
  g *= detail;
  // (Never so steep that a ruffled patch turns to mirror the white haze on the horizon: in a
  // strong wind the gusts darken the water, as they do, rather than whiten it.)
  g /= max(1.0, length(g) / 0.38);
  // (With the real short waves there, the invented ruffle steps back.)
  g = g * mix(1.0, 0.35, uShortOn) + shortS.xy;
  g += rip;
  vec3 N = normalize(vec3(Nw.x - g.x, 1.0, Nw.z - g.y));
  vec3 V = normalize(cameraPosition - vWorld);

  float s1 = smoothstep(0.0, 3.0, depth);
  // (In clear water the deep blue comes on further down.)
  float s2 = mix(smoothstep(2.5, 13.0, depth), smoothstep(5.0, 32.0, depth), uClear);
  vec3 base = mix(mix(uShallow, uMid, s1), uDeep, s2);
  vec3 freshBase = mix(mix(uFreshShallow, uFreshMid, smoothstep(0.0, 2.2, depth)), uFreshDeep, smoothstep(2.0, 6.0, depth));
  base = mix(base, freshBase, fresh);
  // A storm sea is dark and grey-green, churned up.
  float stormy = uStorm * (1.0 - fresh);
  base = mix(base, mix(vec3(0.2, 0.33, 0.33), vec3(0.09, 0.17, 0.21), s2), stormy * 0.8);
  // Coloured water after rain or a blow: silt in the shallows, olive-brown, and you can't see down.
  float silty = uColour * (1.0 - fresh) * (1.0 - smoothstep(3.0, 16.0, depth)) * (1.0 - uClear);
  base = mix(base, mix(vec3(0.43, 0.46, 0.33), vec3(0.25, 0.33, 0.28), s1), silty * 0.7);

  float diff = clamp(dot(N, uLightDir), 0.0, 1.0);
  vec3 col = base * (uAmbient + uSunColor * (0.25 + 0.55 * diff));
  // Light through the crests: with the sun beyond them, the thin tops of the waves glow green-blue
  // (the light coming through the water to you), the more so the higher they stand.
  float crestH = smoothstep(0.02, 0.7, vWave / max(0.12, uChopH * 1.4 + uSwellH * 0.5));
  float through = pow(clamp(dot(V0(vWorld), -uLightDir) * 0.6 + 0.4, 0.0, 1.0), 3.0) * smoothstep(-0.05, 0.15, uLightDir.y);
  col += mix(uMid, uShallow, 0.55) * uSunColor * crestH * through * (0.55 + 0.45 * length(N.xz) * 3.0) * 0.35 * (1.0 - fresh) * (1.0 - uRain * 0.6);

  vec3 R = reflect(-V, N);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
  // Far away the water looks rougher: reflections soften and the sun's path spreads.
  float rough = smoothstep(25.0, 260.0, dist);
  vec3 sky = mix(uHorizon, uZenith, clamp(R.y * 1.5, 0.0, 1.0));
  // The mirrored scene (sky, shore, boat, lights), nudged by the small waves and ripples.
  // Calm fresh water mirrors crisply; the sea breaks it up.
  // (A rough sea breaks the mirror up: clouds and shores reflect only on calm water.)
  float roughSea = smoothstep(0.06, 0.4, uChopH + 0.5 * uSwellH) * shel.g * (1.0 - fresh);
  if (uReflOn > 0.5) {
    vec2 ruv = vRefl.xy / vRefl.w + (g * 0.9 + vec2(-Nw.x, -Nw.z) * (0.25 + 0.6 * roughSea)) * mix(0.14, 0.05, fresh);
    vec2 inside = smoothstep(vec2(0.0), vec2(0.04), ruv) * smoothstep(vec2(1.0), vec2(0.96), ruv);
    ruv = clamp(ruv, 0.002, 0.998);
    // Choppy sea water blurs what it mirrors; the calm lake keeps it sharp.
    vec2 bl = uReflTexel * mix(4.0, 1.0, fresh) * (1.0 + rough * 2.0);
    vec3 mirrored = texture2D(uRefl, ruv).rgb * 0.4
      + (texture2D(uRefl, ruv + vec2(bl.x, bl.y)).rgb + texture2D(uRefl, ruv - vec2(bl.x, bl.y)).rgb
      + texture2D(uRefl, ruv + vec2(bl.x, -bl.y)).rgb + texture2D(uRefl, ruv + vec2(-bl.x, bl.y)).rgb) * 0.15;
    sky = mix(sky, mirrored, inside.x * inside.y * (1.0 - uRain * 0.4) * (1.0 - 0.75 * roughSea));
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
  col += (uAmbient + uSunColor * 0.4) * clamp(length(rips.xy) * 0.6 + max(0.0, length(rips.zw) - 0.18) * 0.8, 0.0, 0.25);

  // Shoreline foam: a soft edge plus bands rolling in, bigger where the swell reaches the shore.
  float n1 = vnoise(p * 0.7 + uTime * 0.25);
  float surf = clamp(0.35 + shel.r * uSwellH * 6.0, 0.35, 1.6);
  float edge = 1.0 - smoothstep(0.0, (0.4 + n1 * 0.35) * surf, depth);
  float bands = smoothstep(0.85, 1.0, sin(depth * 5.0 / surf - uTime * 1.3 + n1 * 3.0)) * (1.0 - smoothstep(0.2, 1.6 * surf, depth)) * (1.0 - fresh);
  // Breakers: where the swell has grown and steepened in the shallows its crests spill over in
  // white, rolling in with the waves themselves; then the wash runs up the beach.
  float swellHere = max(0.04, uSwellH * shel.r * 1.6);
  float breaker = smoothstep(0.35, 0.8, vWorld.y / swellHere) * smoothstep(0.45 + 3.0 * surf, 0.8, depth) * smoothstep(0.05, 0.35, depth)
    * smoothstep(0.35, 0.7, vnoise(p * vec2(0.6, 0.25) + uTime * 0.1)) * smoothstep(0.05, 0.12, uSwellH * shel.r) * (1.0 - fresh);
  // Whitecaps: from a moderate breeze up, the steepest crests of the wind sea break in white,
  // more of them the fresher the wind (a few scattered at 5 m/s, everywhere by 10); and a few
  // short-lived streaks of foam beside them.
  float capWind = smoothstep(4.5, 10.5, uWindMS);
  // (The foam is where the waves themselves have broken, pinched too steep at their crests (see
  // ocean.js), broken into flecks and lacing by fine noise as it fades; and a few scattered
  // streaks beside it.)
  float fleck = smoothstep(0.3, 0.72, vnoise((p - drift * 1.4) * vec2(0.9, 0.7) + n1 * 0.6));
  // (The short waves' own pinched crests lace it, where they're worked out.)
  fleck = mix(fleck, max(smoothstep(1.02, 0.72, shortS.z), fleck * 0.3), uShortOn);
  // (A cap is white at its heart, where it's just broken, and trails off downwind in threads of
  // lace as it fades: a firm core and streaky edges, not a soft blot.)
  vec2 wn = windS > 0.01 ? uWindV / windS : vec2(1.0, 0.0);
  vec2 wq = vec2(dot(p, vec2(-wn.y, wn.x)), dot(p, wn)) - vec2(0.0, uTime * 0.5);
  float thread = (1.0 - abs(vnoise(wq * vec2(1.7, 0.55)) * 2.0 - 1.0)) * 0.6 + (1.0 - abs(vnoise(wq * vec2(4.1, 1.3) + 5.1) * 2.0 - 1.0)) * 0.5;
  float capF = seaS.z * (0.5 + 0.5 * fleck);
  float caps = min(1.0, smoothstep(0.3, 0.65, capF) + smoothstep(0.06, 0.3, capF) * smoothstep(0.6, 0.95, thread) * 0.8)
    * mix(0.65, 1.0, max(detail, uStorm)) * (1.0 - fresh);
  // In a storm: foam blown in long streaks down the wind, and the crests of the big seas breaking.
  vec2 wdir = windS > 0.01 ? uWindV / windS : vec2(1.0, 0.0);
  float lane = vnoise(vec2(dot(p, vec2(-wdir.y, wdir.x)) * 0.85, dot(p, wdir) * 0.03 - uTime * 0.5));
  float streaks = smoothstep(0.7, 0.86, lane) * smoothstep(0.35, 0.7, vnoise(p * 0.09 - drift * 0.3)) * shel.g * stormy;
  // (Breaking only at the very tops of the big seas, where their faces are steepest.)
  float steepSea = smoothstep(0.08, 0.26, length(Nw.xz));
  float crest = smoothstep(uSwellH * 0.62, uSwellH * 1.1, vWorld.y) * mix(0.35, 1.0, steepSea) * smoothstep(0.3, 0.62, vnoise(p * 0.42 - drift * 0.6)) * shel.r * stormy;
  float foam = clamp(edge * (0.9 - fresh * 0.75) + bands * 0.35 * min(surf, 1.0) + breaker * 0.85 + streak * 0.45 + caps * 0.75 + streaks * 0.55 + crest * 0.9, 0.0, 1.0);
  // (Foam stays white against a dark storm sea.)
  vec3 foamLit = uFoam * max(uAmbient + uSunColor * 0.6, vec3(0.62 * stormy));
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
  // Clear blue water (Las Brasas): the reef and its fish show from a boat down to a dozen metres or
  // so (not in a storm, when it's churned up).
  alpha = mix(alpha, mix(0.3, 0.92, smoothstep(1.0, 18.0, depth)), uClear * (1.0 - stormy));
  // Clear fresh water: you can see the gravel in the stream and fish in the shallows.
  alpha = mix(alpha, mix(0.5, 0.92, smoothstep(0.0, 3.0, depth)), fresh);
  alpha = mix(alpha, 0.93, silty * 0.8);
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
      uSwellA: { value: Array.from(conditions.swellAmps) },
      uPeak: { value: 1 },
      uWindMS: { value: 0 },
      uStorm: { value: 0 },
      uShelterRect: { value: new THREE.Vector4(SHELTER_RECT.x, SHELTER_RECT.z, SHELTER_RECT.w, SHELTER_RECT.h) },
      uWindV: { value: new THREE.Vector2() },
      uSwellH: { value: 0 },
      uChopH: { value: 0 },
      uRain: { value: 0 },
      uRings: { value: 0 },
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
      uClear: { value: 0 },
      uColour: { value: 0 },
      uReflMatrix: { value: new THREE.Matrix4() },
      uRippleOn: { value: 0 },
      uRippleTexel: { value: 1 / 512 },
      uWaveLod: { value: new THREE.Vector2(0.6, 128 / 12) },
      uReflTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    },
  ]);
  // Assigned after merge so the textures (and shared vectors) aren't cloned.
  uniforms.uHeight = { value: heightTex };
  uniforms.uHeight2 = { value: detailTex };
  uniforms.uRect2 = { value: new THREE.Vector4(detailRect.x, detailRect.z, detailRect.w, detailRect.h) };
  uniforms.uRefl = { value: null };
  uniforms.uShelter = { value: bakeShelter() };
  uniforms.uTidal = { value: tidalTexture() };
  uniforms.uTideFlow = { value: 1 };
  uniforms.uTideLevel = { value: 0 };
  uniforms.uRipple = { value: null };
  uniforms.uRippleRect = { value: new THREE.Vector4(0, 0, 1, 1) };
  const seaTex = seaTextures();
  uniforms.uSea0 = { value: seaTex.t0 };
  uniforms.uSea1 = { value: seaTex.t1 };
  uniforms.uSeaCopy = { value: new THREE.Vector4(longSea.copy.c, longSea.copy.s, longSea.copy.x, longSea.copy.z) };
  uniforms.uSeaPatch = { value: new THREE.Vector2(PATCH.L, PATCH.N) };
  uniforms.uSeaChop = { value: longSea.choppy };
  uniforms.uShortDisp = { value: null };
  uniforms.uShortSlope = { value: null };
  uniforms.uShortOn = { value: 0 };
  uniforms.uShortL = { value: SHORT.L };
  let shortSea = null;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    defines: { DETAIL: 2 },
    transparent: true,
    fog: true,
    side: THREE.DoubleSide,
  });

  // A sheet that follows the camera: fine close by, where you see each wave and every wake, and
  // coarser ring by ring further out (each ring's cells twice the last's), out past where the
  // near sheet ends. Snapped to the coarsest ring's grid as it follows, so no vertex ever swims.
  // Fewer, coarser cells on lower quality settings.
  let cell = 0, snap = 1, segs = 0;
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  // Beyond it, a plain ring of sea out to the horizon (the same water, without moving waves),
  // so a long way out from the bay there is still ocean all round.
  const ringMat = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, defines: { DETAIL: 0, RING: 1 }, transparent: true, fog: true, side: THREE.DoubleSide,
  });
  const ringGeo = new THREE.RingGeometry(NEAR_R - 2, 6000, 96, 6).rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.frustumCulled = false;
  ring.renderOrder = 1;
  mesh.add(ring);

  const api = {
    mesh,
    ring,
    uniforms,
    // The shared conditions, each frame: the waves' amplitudes and the wind's ruffle.
    sync(windX, windZ) {
      uniforms.uSwellA.value.splice(0, SWELL.length, ...conditions.swellAmps);
      // The wind sea's long waves for this moment (ocean.js), up to the graphics card.
      longSea.fill(conditions.time);
      seaTex.send(longSea);
      uniforms.uSeaChop.value = longSea.choppy;
      if (shortSea) {
        const W = longSea.wind;
        shortSea.update(conditions.time, W.u, W.to, W.m0, longSea.choppy);
      }
      uniforms.uWindV.value.set(windX, windZ);
      uniforms.uSwellH.value = conditions.sea.swell;
      uniforms.uChopH.value = conditions.sea.chop;
      uniforms.uPeak.value = conditions.sea.peak;
      uniforms.uWindMS.value = conditions.wind.speed;
      uniforms.uStorm.value = conditions.sea.storm;
    },
    follow(pos) {
      mesh.position.x = Math.round(pos.x / snap) * snap;
      mesh.position.z = Math.round(pos.z / snap) * snap;
      ring.position.set(pos.x - mesh.position.x, 0, pos.z - mesh.position.z);
    },
    // 0: two wave layers (low), 1: plus fine wavelets and glints, 2: plus the finest layer.
    setDetail(level) {
      if (material.defines.DETAIL === level) return;
      material.defines.DETAIL = level;
      material.needsUpdate = true;
    },
    // The Ocean setting: 'full' works the short waves out on the graphics card (if it can), and
    // 'simple' leaves them to the shading. Returns what it's doing.
    setOcean(mode, renderer) {
      const want = mode === 'full' && renderer && ShortSea.supported(renderer);
      if (want && !shortSea) shortSea = new ShortSea(renderer);
      if (!want && shortSea) {
        shortSea.dispose();
        shortSea = null;
      }
      uniforms.uShortOn.value = shortSea ? 1 : 0;
      uniforms.uShortDisp.value = shortSea ? shortSea.disp.texture : null;
      uniforms.uShortSlope.value = shortSea ? shortSea.slope.texture : null;
      return shortSea ? 'full' : 'simple';
    },
    // seg: the quality setting's resolution (about how many cells across the old 900 m sheet).
    setSegments(seg) {
      if (segs === seg) return;
      segs = seg;
      // (Fewer cells across each ring on the lower settings, for slower machines.)
      const N = seg <= 150 ? 64 : seg <= 220 ? 96 : 128;
      cell = 180 / seg;
      const R0 = (N * cell) / 2, levels = 1 + Math.ceil(Math.log2(NEAR_R / R0));
      mesh.geometry.dispose();
      mesh.geometry = clipmap(cell, N, levels);
      snap = cell * 2 ** (levels - 1);
      uniforms.uWaveLod.value.set(cell, N / 12);
    },
  };
  api.setSegments(300);
  return api;
}

// The near sheet: a square of n × n cells of `cell` metres round the middle, then rings round it,
// each twice as coarse and twice as wide as the one inside, `levels` in all. aEdge marks the
// vertices on each ring's outer edge that fall between two of the next ring's (see the shader).
function clipmap(cell, n, levels) {
  const pos = [], edge = [], idx = [];
  let base = 0;
  for (let L = 0; L < levels; L++) {
    const c = cell * 2 ** L, half = (n * c) / 2, inner = L ? n / 4 : -1;
    const at = (i, j) => base + i * (n + 1) + j;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const x = -half + j * c, z = -half + i * c;
        pos.push(x, 0, z);
        // (Odd vertices on the outer edge, not the last ring's: between two coarser ones.)
        const onEdge = (i === 0 || i === n || j === 0 || j === n) && L < levels - 1;
        const odd = (i === 0 || i === n) ? j % 2 === 1 : (j === 0 || j === n) ? i % 2 === 1 : false;
        if (onEdge && odd) edge.push(1, i === 0 || i === n ? c : 0, i === 0 || i === n ? 0 : c);
        else edge.push(0, 0, 0);
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // (A ring leaves out the middle, where the finer one lies.)
        if (L && i >= inner && i < n - inner && j >= inner && j < n - inner) continue;
        const a = at(i, j), b = at(i, j + 1), d = at(i + 1, j), e = at(i + 1, j + 1);
        idx.push(a, d, b, b, d, e);
      }
    }
    base += (n + 1) * (n + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 3));
  g.setIndex(idx);
  return g;
}

// The long-wave patch's two textures (half floats, so the card can filter and mipmap them):
// height and displacement (read exactly, texel by texel, close by; blurred from its mipmaps far
// off), and slopes and foam (filtered, for the shading).
function seaTextures() {
  const N = PATCH.N, n = N * N * 4;
  const make = () => {
    const t = new THREE.DataTexture(new Uint16Array(n), N, N, THREE.RGBAFormat, THREE.HalfFloatType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  const t0 = make(), t1 = make();
  const half = THREE.DataUtils.toHalfFloat;
  return {
    t0,
    t1,
    send(sea) {
      const a = t0.image.data, b = t1.image.data, A = sea.tex0, B = sea.tex1;
      for (let i = 0; i < n; i += 4) {
        a[i] = half(A[i]);
        a[i + 1] = half(A[i + 1]);
        a[i + 2] = half(A[i + 2]);
        b[i] = half(B[i]);
        b[i + 1] = half(B[i + 1]);
        b[i + 2] = half(A[i + 3]);
      }
      t0.needsUpdate = true;
      t1.needsUpdate = true;
    },
  };
}
