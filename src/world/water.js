import * as THREE from 'three';
import { conditions, WAVE_PARTS, bakeShelter, tidalTexture, SHELTER_RECT, waveHeight as conditionsWaveHeight } from './conditions.js';

// The water surface: swell and wind chop from the shared conditions (conditions.js). The same
// function moves these vertices and lifts the boats and floats (waveHeight below), so a hull
// always sits on the water you see.
export const waveHeight = conditionsWaveHeight;
const NEAR_R = 444; // the fine water sheet is round, this far around the camera

const f = (n) => n.toFixed(5);
const { SWELL, CHOP } = WAVE_PARTS;
// The waves at a point: height and its slope (for the normal), each wave scaled by how exposed
// the water is to swell (shelter.r) and to wind (shelter.g), faded in the last shallows and on
// fresh water. Mirrors conditions.js waveHeight term for term.
const WAVE_GLSL = /* glsl */ `
uniform float uSwellA[${SWELL.length}];
uniform float uChopA[${CHOP.length}];
uniform float uPeak;
uniform float uChopPeak;
uniform float uStorm;
uniform sampler2D uShelter;
uniform vec4 uShelterRect;
uniform float uTideLevel; // the tide: the sea's level above the mean (m); not the lakes'
vec3 waves(vec2 p, float t, float ground, float fresh) {
  vec4 sh = texture2D(uShelter, (p - uShelterRect.xy) / uShelterRect.zw);
  float depth = max(uTideLevel * (1.0 - fresh) - ground, 0.0);
  // (Running into shallow water the swell grows and steepens: conditions.js shoalGrow, shoalPeak.)
  float ks = sh.r * (1.0 + 0.8 * smoothstep(8.0, 2.5, depth) * smoothstep(0.8, 2.2, depth)), kc = 0.15 + 0.85 * sh.g;
  float pk = min(uPeak + 1.4 * smoothstep(5.0, 1.5, depth), 3.6);
  vec3 r = vec3(0.0);
  float a, s;
  // (Every wave has a Stokes crest, as conditions.js swellShape: the swell's sharpened in a storm
  // and in the shallows, the wind sea's as the wind freshens.)
  ${SWELL.map((w, i) => `a = ${f(w.k)} * (${f(w.dx)} * p.x + ${f(w.dz)} * p.y - ${f(w.c)} * t);
  s = uSwellA[${i}] * ks;
  r += vec3(s * sin(a) - ${f(0.5 * w.k)} * s * s * pk * cos(2.0 * a), vec2(${f(w.k * w.dx)}, ${f(w.k * w.dz)}) * (s * cos(a) + ${f(w.k)} * s * s * pk * sin(2.0 * a)));`).join('\n  ')}
  vec3 c = vec3(0.0);
  ${CHOP.map((w, i) => `a = ${f(w.k)} * (${f(w.dx)} * p.x + ${f(w.dz)} * p.y - ${f(w.c)} * t);
  s = uChopA[${i}];
  c += vec3(s * sin(a) - ${f(0.5 * w.k)} * s * s * uChopPeak * cos(2.0 * a), vec2(${f(w.k * w.dx)}, ${f(w.k * w.dz)}) * (s * cos(a) + ${f(w.k)} * s * s * uChopPeak * sin(2.0 * a)));`).join('\n  ')}
  r += c * kc;
  return r * smoothstep(0.05, 0.9 + 3.5 * uStorm, -ground) * (1.0 - 0.85 * fresh);
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
  vec4 mapV = worldMap(wp.xz);
  #ifdef RING
  // The far ocean, out to the horizon: too far off to see the waves move.
  vec3 w = vec3(0.0);
  #else
  vec3 w = waves(wp.xz, uTime, mapV.r, mapV.g);
  #endif
  wp.y += w.x + uTideLevel * (1.0 - mapV.g);
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
  // The near sheet is round, and the far ring starts where it ends.
  #ifndef RING
  if (length(vWorld.xz - cameraPosition.xz) > ${NEAR_R.toFixed(1)}) discard;
  #endif
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
  vec4 shel = texture2D(uShelter, (vWorld.xz - uShelterRect.xy) / uShelterRect.zw);
  // The stream's current (fine) and the sea's: the river, channels, headlands and the shoal.
  vec2 tidal = texture2D(uTidal, (vWorld.xz - uShelterRect.xy) / uShelterRect.zw).rg;
  vec2 flow = hs.ba + (shel.ba + tidal * uTideFlow) * 1.6;
  float flowSpeed = length(flow);
  float depth = max(uTideLevel * (1.0 - fresh) - ground, 0.0);
  float dist = length(cameraPosition - vWorld);
  float detail = 1.0 - smoothstep(40.0, 220.0, dist);

  vec2 p = vWorld.xz;
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
  g += rip;
  vec3 N = normalize(vec3(vN.x - g.x, vN.y, vN.z - g.y));
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

  float diff = clamp(dot(N, uLightDir), 0.0, 1.0);
  vec3 col = base * (uAmbient + uSunColor * (0.25 + 0.55 * diff));

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
    vec2 ruv = vRefl.xy / vRefl.w + (g * 0.9 + vec2(-vN.x, -vN.z) * (0.25 + 0.6 * roughSea)) * mix(0.14, 0.05, fresh);
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
  col += (uAmbient + uSunColor * 0.4) * clamp(length(rip) * 0.6, 0.0, 0.25);

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
  float steepW = smoothstep(0.035, 0.13, length(vN.xz));
  float capWind = smoothstep(4.5, 10.5, uWindMS);
  float capCrest = smoothstep(0.02, 0.45, vWorld.y / max(0.05, uChopH + 0.6 * uSwellH * shel.r));
  // (Each cap a small patch: the crest test picks the steep tops, the fine noise breaks them into
  // flecks; the scattered streaks stay rare, so nothing merges into broad white blotches.)
  float caps = (capCrest * steepW * smoothstep(0.55 - 0.15 * capWind, 0.7, vnoise((p - drift * 1.4) * vec2(0.9, 0.7) + n1 * 0.6))
    + 0.45 * smoothstep(0.86, 0.97, vnoise((p - drift * 1.4) * vec2(0.28, 0.22) + n1 * 0.4)))
    * capWind * shel.g * max(detail, uStorm * 0.8) * (1.0 - fresh);
  // In a storm: foam blown in long streaks down the wind, and the crests of the big seas breaking.
  vec2 wdir = windS > 0.01 ? uWindV / windS : vec2(1.0, 0.0);
  float lane = vnoise(vec2(dot(p, vec2(-wdir.y, wdir.x)) * 0.85, dot(p, wdir) * 0.03 - uTime * 0.5));
  float streaks = smoothstep(0.7, 0.86, lane) * smoothstep(0.35, 0.7, vnoise(p * 0.09 - drift * 0.3)) * shel.g * stormy;
  // (Breaking only at the very tops of the big seas, where their faces are steepest.)
  float steepSea = smoothstep(0.08, 0.26, length(vN.xz));
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
      uChopPeak: { value: 1 },
      uWindMS: { value: 0 },
      uStorm: { value: 0 },
      uChopA: { value: Array.from(conditions.chopAmps) },
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
  uniforms.uShelter = { value: bakeShelter() };
  uniforms.uTidal = { value: tidalTexture() };
  uniforms.uTideFlow = { value: 1 };
  uniforms.uTideLevel = { value: 0 };
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

  return {
    mesh,
    ring,
    uniforms,
    // The shared conditions, each frame: the waves' amplitudes and the wind's ruffle.
    sync(windX, windZ) {
      uniforms.uSwellA.value.splice(0, SWELL.length, ...conditions.swellAmps);
      uniforms.uChopA.value.splice(0, CHOP.length, ...conditions.chopAmps);
      uniforms.uWindV.value.set(windX, windZ);
      uniforms.uSwellH.value = conditions.sea.swell;
      uniforms.uChopH.value = conditions.sea.chop;
      uniforms.uPeak.value = conditions.sea.peak;
      uniforms.uChopPeak.value = conditions.sea.chopPeak;
      uniforms.uWindMS.value = conditions.wind.speed;
      uniforms.uStorm.value = conditions.sea.storm;
    },
    follow(pos) {
      mesh.position.x = Math.round(pos.x / cell) * cell;
      mesh.position.z = Math.round(pos.z / cell) * cell;
      ring.position.set(pos.x - mesh.position.x, 0, pos.z - mesh.position.z);
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
