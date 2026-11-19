import * as THREE from 'three';
import { conditions, WAVE_PARTS, bakeShelter, tidalTexture, SHELTER_RECT, waveHeight as conditionsWaveHeight } from './conditions.js';
import { longSea, PATCH, SHORT, FINE, TMA_N, FineSpectrum, slopeShare } from './ocean.js';
import { ShortSea } from './oceangpu.js';
import { STREAKS } from './spindrift.js';
import { HAZE } from './sky.js';

// The water surface: swell and wind chop from the shared conditions (conditions.js). The same
// function moves these vertices and lifts the boats and floats (waveHeight below), so a hull
// always sits on the water you see.
export const waveHeight = conditionsWaveHeight;
const NEAR_R = 444; // the fine water sheet is drawn this far round the camera (W3b: a square, this far each way)

const f = (n) => n.toFixed(5);
const TAU = Math.PI * 2;
const { SWELL } = WAVE_PARTS;
// (W3, second part) How far out each sheet draws the waves, for the quality setting's resolution
// (seg: about how many cells across the old 900 m sheet), worked out once here for the shader and
// the tests. The near sheet: a square of n × n cells of `cell` metres round the middle, then rings
// round it, each twice as coarse and twice as wide (see clipmap), out past NEAR_R, snapped to its
// coarsest cell as it follows. A wave of length len is drawn in full while the sheet's cells there
// are at most a quarter of it or so, and gone by a third: `lod` metres out per metre of wavelength,
// the cells being at most 4/n of the distance out (lod = n/12: gone by len × n/12, all of it inside
// 0.7 of that). So the longest of them, the wind sea's patch (PATCH.L), is gone by `flatR`.
// Past the near sheet (a square NEAR_R each way round the camera, always within its coarsest ring,
// so the far one's first ring is the same triangles there), the far one: the same cells as the
// near one's coarsest ring, then twice as coarse ring by ring, until it reaches past flatR
// wherever the camera is; snapped to its own coarsest cell, its middle left out (inside NEAR_R,
// wherever it's snapped to). Beyond flatR, a flat ring out to the horizon, cheap, the waves there
// only in its shading (and its roughness).
export function seaLayout(seg) {
  const n = seg <= 150 ? 64 : seg <= 220 ? 96 : 128;
  const cell = 180 / seg;
  const levels = 1 + Math.ceil(Math.log2(NEAR_R / ((n * cell) / 2)));
  const nearCell = cell * 2 ** (levels - 1);
  const lod = n / 12;
  const flatR = PATCH.L * lod;
  let farLevels = 1;
  while ((n * nearCell * 2 ** (farLevels - 1)) / 2 - (nearCell * 2 ** (farLevels - 1)) / 2 < flatR * 1.04) farLevels++;
  const farSnap = nearCell * 2 ** (farLevels - 1);
  // (The far sheet's hole, in cells from its middle: inside NEAR_R wherever it's snapped, less 8 m,
  // more than the wind sea's to-and-fro carries any of its vertices across.)
  const hole = Math.floor((NEAR_R - 8 - farSnap / 2) / nearCell);
  return { nearR: NEAR_R, n, cell, levels, snap: nearCell, nearCell, lod, flatR, farR: flatR * 1.02, farLevels, farSnap, hole };
}
// The waves at a point: the swell (a few long waves, each scaled by how exposed the water is to
// it: shelter.r) and the wind sea (the long-wave patch from ocean.js, sent up each frame, scaled
// by shelter.g), faded in the last shallows and on fresh water. Mirrors conditions.js waveHeight
// term for term: the same swell, and the wind sea sampled from the same grid the same way
// (Catmull-Rom, both copies of the patch), so a hull sits on the water you see. Far off, where
// the sheet's cells are coarse, the patch is read blurred (its mipmaps) so nothing flickers.
// (W5) The wind sea's height left in shallow water, by depth, for its long waves (uTmaL) and its
// short ones (uTmaS): ocean.js tmaAt, interpolated the same way, a step at a time.
const TMA_GLSL = /* glsl */ `
uniform float uTmaL[${TMA_N}];
uniform float uTmaS[${TMA_N}];
float tmaL(float h) {
  float fi = min(${(TMA_N - 1).toFixed(1)}, 2.0 * sqrt(max(h, 0.0))), r = uTmaL[0];
  for (int i = 0; i < ${TMA_N - 1}; i++) r += (uTmaL[i + 1] - r) * clamp(fi - float(i), 0.0, 1.0);
  return r;
}
float tmaS(float h) {
  float fi = min(${(TMA_N - 1).toFixed(1)}, 2.0 * sqrt(max(h, 0.0))), r = uTmaS[0];
  for (int i = 0; i < ${TMA_N - 1}; i++) r += (uTmaS[i + 1] - r) * clamp(fi - float(i), 0.0, 1.0);
  return r;
}
`;
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
${TMA_GLSL}
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
  // (W3b: and gone, its longest waves too, where the sheet's cells are too coarse to draw them:
  // from 0.7 of seaLayout's flatR to all of it. Their slopes carry on in the shading.)
  float keep = smoothstep(uSeaPatch.x * uWaveLod.y, 0.7 * uSeaPatch.x * uWaveLod.y, dist);
  return vec3(a.x + b.x, a.yz + bd) * (0.70710678 * keep);
}
// Height and the swell's slopes (x, z) at p, and (shift) how far the wind sea carries the point;
// (swellH) how much of the height is the swell's.
vec3 waves(vec2 p, float t, float ground, float fresh, float dist, out vec2 shift, out float swellH) {
  vec4 sh = texture2D(uShelter, (p - uShelterRect.xy) / uShelterRect.zw);
  float depth = max(uTideLevel * (1.0 - fresh) - ground, 0.0);
  // (Running into shallow water the swell grows and steepens: conditions.js shoalGrow, shoalPeak.)
  float ks = sh.r * (1.0 + 0.8 * smoothstep(8.0, 2.5, depth) * smoothstep(0.8, 2.2, depth)), kc = 0.15 + 0.85 * sh.g;
  float pk = min(uPeak + 1.4 * smoothstep(5.0, 1.5, depth), 3.6);
  vec3 r = vec3(0.0);
  float a, s;
  // (Every swell wave has a Stokes crest, as conditions.js swellShape: sharpened in a storm and
  // in the shallows. W3b: each drawn while the sheet's cells are fine enough for it, faded out as
  // they grow too coarse, as the wind sea's patch is; its slope carries on in the shading.)
  ${SWELL.map((w, i) => `a = ${f(w.k)} * (${f(w.dx)} * p.x + ${f(w.dz)} * p.y - ${f(w.c)} * t);
  s = uSwellA[${i}] * ks * smoothstep(${f(TAU / w.k)} * uWaveLod.y, ${f(0.7 * TAU / w.k)} * uWaveLod.y, dist);
  r += vec3(s * sin(a) - ${f(0.5 * w.k)} * s * s * pk * cos(2.0 * a), vec2(${f(w.k * w.dx)}, ${f(w.k * w.dz)}) * (s * cos(a) + ${f(w.k)} * s * s * pk * sin(2.0 * a)));`).join('\n  ')}
  float fade = smoothstep(0.05, 0.9 + 3.5 * uStorm, -ground) * (1.0 - 0.85 * fresh);
  // (W5: each band's height left in water this deep.)
  vec3 sea = seaAt(p, dist) * tmaL(depth);
  // (The short waves too, close by: read blurred to about twice the sheet's cell there, so it
  // only carries those it can draw.)
  if (uShortOn > 0.5 && dist < 90.0) {
    float cell = max(uWaveLod.x, dist * 4.0 / (uWaveLod.y * 12.0));
    float lod = log2(max(1.0, 2.0 * cell / (uShortL / 128.0)));
    sea += textureLod(uShortDisp, p / uShortL, lod).xyz * (1.0 - smoothstep(60.0, 90.0, dist)) * tmaS(depth);
  }
  sea *= kc * fade;
  shift = sea.yz * uSeaChop;
  // The swash: on a beach each swell's last run-up, the water's edge sliding up the sand and
  // draining back, in time with the swell offshore (higher where it comes in bigger).
  float swash = 0.0;
  float onBeach = smoothstep(-1.6, -0.3, ground) * smoothstep(0.6, 0.05, ground) * (1.0 - fresh);
  if (onBeach > 0.0) {
    float th = ${f(SWELL[0].k)} * (${f(SWELL[0].dx)} * p.x + ${f(SWELL[0].dz)} * p.y - ${f(SWELL[0].c)} * t);
    float run = uSwellA[0] * sh.r * 1.4 + 0.05 * (0.15 + 0.85 * sh.g);
    swash = run * pow(0.5 + 0.5 * sin(th), 1.6) * onBeach;
  }
  swellH = r.x * fade;
  return r * fade + vec3(sea.x + swash, 0.0, 0.0);
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
varying vec4 vRefl;
varying vec2 vRest; // where this bit of surface lies when the water's still (for the patch's slopes)
varying float vWave; // how high the waves have lifted it here (m)
varying float vSwell; // how much of that is the swell's (m)
#include <fog_pars_vertex>
// The wakes and the ripples (the ripple field: see waterfx.js and wakes.js): heights, metres.
uniform sampler2D uFarRipple; // the wakes again, coarser, over a much wider square (Ocean: Full)
uniform vec4 uFarRect;
uniform float uFarOn;
float rippleHeight(vec2 p) {
  float near = 0.0, h = 0.0;
  if (uRippleOn > 0.5) {
    vec2 uv = (p - uRippleRect.xy) / uRippleRect.zw;
    float edge = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
    if (edge > 0.0) {
      vec4 r = texture2D(uRipple, uv);
      near = smoothstep(0.0, 0.15, edge);
      h = (r.r + r.g) * near;
    }
  }
  if (uFarOn > 0.5 && near < 1.0) {
    vec2 uv = (p - uFarRect.xy) / uFarRect.zw;
    float edge = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
    if (edge > 0.0) h += texture2D(uFarRipple, uv).g * smoothstep(0.0, 0.08, edge) * (1.0 - near);
  }
  return h;
}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vRefl = uReflMatrix * vec4(wp.x, 0.0, wp.z, 1.0);
  vec4 mapV = worldMap(wp.xz);
  vRest = wp.xz;
  #ifdef RING
  // The far ocean, out to the horizon: too far off for the sheet to draw the waves' rise and fall
  // (seaLayout's flatR); they're in its shading.
  vec3 w = vec3(0.0);
  vSwell = 0.0;
  #else
  float dist = length(wp.xz - cameraPosition.xz);
  vec3 w;
  vec2 shift;
  if (aEdge.x > 0.5) {
    // (Where a finer ring meets a coarser one, its in-between vertices sit on the coarser ring's
    // straight edge, so the two meet without a crack.)
    vec2 e = aEdge.yz, s0, s1;
    float h0, h1;
    vec4 m0 = worldMap(wp.xz - e), m1 = worldMap(wp.xz + e);
    w = 0.5 * (waves(wp.xz - e, uTime, m0.r, m0.g, dist, s0, h0) + waves(wp.xz + e, uTime, m1.r, m1.g, dist, s1, h1));
    shift = 0.5 * (s0 + s1);
    vSwell = 0.5 * (h0 + h1);
    w.x += 0.5 * (rippleHeight(wp.xz - e) + rippleHeight(wp.xz + e)) * waveLod(3.0, dist);
  } else {
    w = waves(wp.xz, uTime, mapV.r, mapV.g, dist, shift, vSwell);
    // (The wakes lift the sheet close by, where its cells are fine enough for their short waves;
    // further off they show in its shading alone.)
    w.x += rippleHeight(wp.xz) * waveLod(3.0, dist);
  }
  wp.xz += shift;
  #endif
  wp.y += w.x + uTideLevel * (1.0 - mapV.g);
  vWave = w.x;
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

// (W3b) The swell at p, pixel by pixel, for the shading: its height and its slopes x, z, each of its
// waves as much as this pixel can show: in full while the pixel's footprint along the wave (dp: how
// far the still surface moves from this pixel to the next, across the screen and up it) is at most
// a quarter of its length, gone by half. So it carries on out to the horizon in the shading, past
// where the sheet can draw its rise and fall, until the pixels are too coarse for it: far off and
// low, first the waves coming towards you (a pixel there is long along the view), last those
// running across it. What a pixel can't show goes into the roughness: (var) its slopes' mean
// square, up the wind wd and across it; and (res) the share of the swell's height it shows.
const SWELL_PIX_GLSL = /* glsl */ `
uniform float uSwellA[${SWELL.length}];
uniform float uPeak;
vec3 swellPix(vec2 p, float t, float ks, float pk, vec4 dp, vec2 wd, out vec2 var, out float res) {
  vec3 r = vec3(0.0);
  var = vec2(0.0);
  float a, s, keep, sn, cs, cw, tot = 1e-6, shown = 0.0;
  ${SWELL.map((w, i) => `a = ${f(w.k)} * (${f(w.dx)} * p.x + ${f(w.dz)} * p.y - ${f(w.c)} * t);
  s = uSwellA[${i}] * ks;
  keep = smoothstep(${f(0.5 * TAU / w.k)}, ${f(0.25 * TAU / w.k)}, max(abs(dp.x * ${f(w.dx)} + dp.y * ${f(w.dz)}), abs(dp.z * ${f(w.dx)} + dp.w * ${f(w.dz)})));
  sn = sin(a);
  cs = cos(a);
  r += keep * vec3(s * sn - ${f(0.5 * w.k)} * s * s * pk * (cs * cs - sn * sn), vec2(${f(w.k * w.dx)}, ${f(w.k * w.dz)}) * (s * cs + ${f(2 * w.k)} * s * s * pk * sn * cs));
  cw = ${f(w.dx)} * wd.x + ${f(w.dz)} * wd.y;
  var += (1.0 - keep) * ${f(0.5 * w.k * w.k)} * s * s * vec2(cw * cw, 1.0 - cw * cw);
  tot += s * s;
  shown += keep * s * s;`).join('\n  ')}
  res = shown / tot;
  return r;
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
${TMA_GLSL}
uniform sampler2D uTidal;  // the tidal streams at full ebb (RG), turned by uTideFlow
uniform float uTideFlow;   // +1 full ebb … −1 full flood
uniform float uTideLevel;  // the sea's level above the mean (m)
uniform vec2 uWindV;     // where the wind blows, times its strength (0 … 1 at a fresh breeze)
uniform float uSwellH;   // the swell's crest amplitude (m)
uniform float uChopH;    // the chop's crest amplitude (m)
uniform float uStorm;    // how stormy (0 … 1)
uniform float uWindMS;   // the sustained wind (m/s), for the whitecaps
uniform float uClear;    // clear blue water (Las Brasas): you see the seabed and the fish much deeper
uniform vec3 uSunDir;    // where the sun really is (the light may be the moon's, or held up off the horizon)
uniform vec3 uSkySun;    // the sun's colour as the sky dome has it (sky.js)
uniform float uGlow;     // the sky's glow round a low sun (sky.js)
uniform vec2 uSlopeVar;  // the sea's mean square slope for this wind, up and across it (Cox and Munk)
uniform float uColour;   // silt stirred up by rain or a blow (0 clear … 1 thick): see grounds.js
uniform sampler2D uBelow;  // (W4b) what's under the sea, as drawn, copied just before the sea is
uniform float uBelowOn;
uniform vec2 uScreen;      // the drawing buffer's size, in pixels
uniform mat4 uViewProj;    // the camera's projection times its view, this frame
// (W4b) Where the eye's ray, through the surface at a slope, meets a bottom d metres down, against
// where it would through a level surface: the waves' share of the bend (Snell's law, water's
// index 1.333), as a shift along the bottom (x, z). See bottomShift below for the same in JS.
vec2 bottomShift(float d, vec3 N, vec3 V) {
  vec3 T = refract(-V, N, 0.75), T0 = refract(-V, vec3(0.0, 1.0, 0.0), 0.75);
  return T.xz * (d / max(-T.y, 0.2)) - T0.xz * (d / max(-T0.y, 0.2));
}
varying vec3 vWorld;
varying vec4 vRefl;
varying vec2 vRest;
varying float vWave;
varying float vSwell;
${SWELL_PIX_GLSL}
uniform float uFarR; // (W3b) where the far sheet hands over to the flat ring (seaLayout's farR)
uniform sampler2D uShortSlope; // the short waves (Ocean: Full): slopes x, z, and how pinched (J)
uniform float uShortOn;
uniform float uShortL;
uniform sampler2D uFineSlope;  // (W5) the finest, 60 to 5 cm (Ocean: Full): slopes x, z
uniform float uFineOn;
uniform float uFineL;
uniform vec3 uSlopeShare;      // (W5) the share of the sea's mean square slope the long, short and finest waves draw
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
// Cells round scattered points (Worley): the distance to the nearest point and to the next. Their
// borders make a web like the walls of the bubbles in foam.
vec2 worley(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash12(i + g), hash12(i + g + 17.3));
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return vec2(d1, d2);
}
// Foam's own look, 0 … 1 (q: wind-aligned metres): threads of it drawn out down the wind, and the
// walls of its bubbles among them. Foam thinning as it ages loses the faint parts first.
float foamWeb(vec2 q) {
  vec2 w = q + vec2(vnoise(q * 0.35), vnoise(q * 0.35 + 4.7)) * 1.6;
  float t1 = 1.0 - abs(vnoise(w * vec2(0.9, 0.3)) * 2.0 - 1.0);
  float t2 = 1.0 - abs(vnoise(w * vec2(2.4, 0.8) + 3.1) * 2.0 - 1.0);
  vec2 b = worley(w * vec2(5.2, 3.6) + 7.1);
  float bub = 1.0 - smoothstep(0.0, 0.25, b.y - b.x);
  return clamp(t1 * 0.55 + t2 * 0.35 + bub * 0.14 - 0.04, 0.0, 1.0);
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
uniform sampler2D uFarRipple; // the wakes again, coarser, over a much wider square (Ocean: Full)
uniform vec4 uFarRect;
uniform float uFarOn;
// How far into the near field a point is (0 outside it, 1 well inside), and the far field's.
float nearIn(vec2 p) {
  if (uRippleOn < 0.5) return 0.0;
  vec2 uv = (p - uRippleRect.xy) / uRippleRect.zw;
  return smoothstep(0.0, 0.15, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)));
}
float farIn(vec2 p) {
  if (uFarOn < 0.5) return 0.0;
  vec2 uv = (p - uFarRect.xy) / uFarRect.zw;
  return smoothstep(0.0, 0.08, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)));
}
// The white water in the ripple field (a propeller's wash, a fast boat's bow): 0 … 1.
float rippleWash(vec2 p) {
  float n = nearIn(p), w = 0.0;
  if (n > 0.0) w = clamp(texture2D(uRipple, (p - uRippleRect.xy) / uRippleRect.zw).b, 0.0, 1.0) * n;
  if (n < 1.0) {
    float f = farIn(p);
    if (f > 0.0) w += clamp(texture2D(uFarRipple, (p - uFarRect.xy) / uFarRect.zw).b, 0.0, 1.0) * f * (1.0 - n);
  }
  return w;
}
vec4 rippleSlopes(vec2 p) {
  float n = nearIn(p);
  vec4 r = vec4(0.0);
  if (n > 0.0) {
    vec2 uv = (p - uRippleRect.xy) / uRippleRect.zw;
    float e = uRippleTexel;
    vec2 hx = (texture2D(uRipple, uv + vec2(e, 0.0)) - texture2D(uRipple, uv - vec2(e, 0.0))).rg;
    vec2 hz = (texture2D(uRipple, uv + vec2(0.0, e)) - texture2D(uRipple, uv - vec2(0.0, e))).rg;
    r = vec4(hx.x, hz.x, hx.y, hz.y) * n / (2.0 * e * uRippleRect.z);
  }
  if (n < 1.0) {
    float f = farIn(p);
    if (f > 0.0) {
      vec2 uv = (p - uFarRect.xy) / uFarRect.zw;
      float e = 1.0 / 512.0;
      float hx = texture2D(uFarRipple, uv + vec2(e, 0.0)).g - texture2D(uFarRipple, uv - vec2(e, 0.0)).g;
      float hz = texture2D(uFarRipple, uv + vec2(0.0, e)).g - texture2D(uFarRipple, uv - vec2(0.0, e)).g;
      r.zw += vec2(hx, hz) * f * (1.0 - n) / (2.0 * e * uFarRect.z);
    }
  }
  return r;
}

// The sky as the dome draws it (sky.js) in direction d: its gradient, the warm glow along the
// horizon round a low sun and the dusk on the far side, and the brightness round the sun itself.
// (What the water mirrors on every setting, where there's no mirrored scene: sunset colours,
// overcast grey, the storm's dark sky.)
vec3 skyAt(vec3 d) {
  float h = max(d.y, 0.0);
  vec2 across = normalize(d.xz + vec2(1e-5));
  vec2 sunFlat = normalize(uSunDir.xz + vec2(1e-5));
  float toward = dot(across, sunFlat) * 0.5 + 0.5;
  vec3 hor = mix(mix(uHorizon, uZenith * 1.15 + vec3(0.07, 0.035, 0.09), 0.42 * uGlow), uHorizon * 1.04 + uSkySun * 0.1 * uGlow, smoothstep(0.15, 1.0, toward));
  vec3 c = mix(hor, uZenith, pow(h, mix(0.6, 0.45, uGlow)));
  c += uSkySun * pow(toward, 4.0) * exp(-h * 7.0) * 0.22 * uGlow;
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSkySun * (pow(sd, 5.0) * 0.16 + pow(sd, 40.0) * 0.32) * smoothstep(-0.12, 0.02, uSunDir.y) * (1.0 - uRain * 0.8);
  // (A storm's sky is low and dark.)
  return mix(c, mix(uHorizon * 0.55, uZenith * 0.35, clamp(h * 1.5, 0.0, 1.0)) * 0.9, uStorm);
}

void main() {
  // The near sheet is a square round you, the far sheet starts where it ends (W3b), and the flat
  // ring, round, where the far sheet ends.
  vec2 off = abs(vWorld.xz - cameraPosition.xz);
  float around = length(off), square = max(off.x, off.y);
  #if defined(RING)
  if (around < uFarR) discard;
  #elif defined(FAR)
  if (square <= ${NEAR_R.toFixed(1)} || around > uFarR) discard;
  #else
  if (square > ${NEAR_R.toFixed(1)}) discard;
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
    gl_FragColor = vec4(colU * 0.95, 0.95);
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
  float fadeS = smoothstep(0.05, 0.9 + 3.5 * uStorm, -ground) * (1.0 - 0.85 * fresh);
  float kcS = (0.15 + 0.85 * shel.g) * fadeS;
  vec3 seaS = seaSlope(vRest) * kcS * tmaL(depth);
  // (W3b) The swell's slope pixel by pixel, as the sheet lifts it (WAVE_GLSL waves: grown and
  // steepened in the shallows), out to the horizon; what's too fine for the pixel, as roughness.
  vec2 swVar;
  float swRes;
  float ksS = shel.r * (1.0 + 0.8 * smoothstep(8.0, 2.5, depth) * smoothstep(0.8, 2.2, depth));
  float pkS = min(uPeak + 1.4 * smoothstep(5.0, 1.5, depth), 3.6);
  vec3 sw = swellPix(vRest, uTime, ksS, pkS, vec4(dFdx(vRest), dFdy(vRest)), normalize(uWindV + vec2(1e-6, 0.0)), swVar, swRes) * fadeS;
  vec3 Nw = vec3(-sw.y - seaS.x, 1.0, -sw.z - seaS.y);
  // And the short waves (Ocean: Full), pixel by pixel: two readings of their patch, one turned and
  // larger, so its tiling never shows; their pinched crests lace the foam.
  vec3 shortS = vec3(0.0, 0.0, 1.0);
  if (uShortOn > 0.5) {
    vec2 q = vRest / uShortL, q2 = mat2(0.81, 0.59, -0.59, 0.81) * vRest / (uShortL * 1.63) + vec2(0.37, 0.71);
    vec4 s1 = texture2D(uShortSlope, q), s2 = texture2D(uShortSlope, q2);
    shortS = vec3((s1.xy + vec2(0.81 * s2.x - 0.59 * s2.y, 0.59 * s2.x + 0.81 * s2.y) / 1.63) * 0.8 * kcS * tmaS(depth), min(s1.z, mix(1.0, s2.z, 0.6)));
  }
  // (W5) And the finest, close by (Ocean: Full): a few centimetres to half a metre long, read turned
  // so their small patch never lines up with the short one's; gone by 18 m, where they'd be a pixel
  // or so across and only speckle, and the glitter's spread stands in for them.
  float fineNear = 0.0;
  if (uFineOn > 0.5) {
    fineNear = 1.0 - smoothstep(5.0, 18.0, dist);
    if (fineNear > 0.0) {
      vec4 f1 = texture2D(uFineSlope, mat2(0.6, -0.8, 0.8, 0.6) * vRest / uFineL + vec2(0.13, 0.57));
      shortS.xy += vec2(0.6 * f1.x + 0.8 * f1.y, -0.8 * f1.x + 0.6 * f1.y) * kcS * fineNear;
    }
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
  // (R below the horizon, from a facet tilted away: what it sees is the sea beyond, near the horizon.)
  R.y = abs(R.y);
  // Far away the water looks rougher: reflections soften.
  float rough = smoothstep(25.0, 260.0, dist);
  vec3 sky = skyAt(R);
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
  // The roughness the drawn waves leave out (W2, after Bruneton, Neyret and Holzschuch 2010): the
  // sea's whole mean square slope for this wind (Cox and Munk), less what the waves drawn here
  // already show; and once a pixel covers metres of sea, all of it. With Ocean: Full (W5), worked
  // out from each band's own spectrum (uSlopeShare): the long, short and finest waves close by draw
  // a sixth of it in light air, half in a moderate breeze and all of it in a strong wind. Without
  // them (Simple), most of it, as W2 set it (the shading's own ripples draw the rest). Sheltered
  // water and fresh water are calmer, gusts rougher, rain roughens it.
  float foot = length(fwidth(vWorld.xz));
  float drawn = uSlopeShare.x + uSlopeShare.y + uFineOn * fineNear * uSlopeShare.z;
  float unres = mix(uShortOn > 0.5 ? clamp(1.0 - drawn, 0.1, 1.0) : 0.7, 1.0, smoothstep(0.04, 1.6, foot));
  float calm = (0.12 + 0.88 * shel.g) * (1.0 - 0.75 * fresh) * mix(0.6, 1.3, gust);
  vec2 msq = max(uSlopeVar * unres * calm + uRain * 0.01, vec2(0.0012)) + swVar * fadeS * fadeS;
  // How much the water reflects (Fresnel, from water's own 2% looking straight down to all of it at
  // a glancing angle); a rough sea, its facets tilted every way, never quite turns to a mirror.
  float cosV = clamp(dot(N, V), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
  fres = min(fres, mix(1.0, 0.7, smoothstep(0.003, 0.03, msq.x + msq.y)));
  // (W4) In the sea, what you see is what its surface reflects (the sky, the sun, the foam) and,
  // through the rest, what's under it, seen through the water as it really is (sky.js: each colour
  // taken up along the light's way down and back, the water's glow in its place). Only where the
  // bottom's too deep to show at all does the water's own colour stand in for it, so the sea far
  // out, where nothing's drawn under it, is the deep blue it was, without a seam. (Kept as light,
  // premultiplied, so the sun's glitter isn't dimmed where the surface lets most light through.)
  // Fresh water keeps its colour by depth, the bed seen more or less through it.
  float aBody = smoothstep(0.75, 0.97, 1.0 - exp(-hazeSigma.g * 2.0 * depth));
  vec3 pmSea = col * (1.0 - fres) * aBody + sky * fres;
  float aSea = fres + (1.0 - fres) * aBody;
  col = mix(col, sky, fres);

  // The sun (or the moon) in the water: each of the waves too small to draw is a little mirror, and
  // the ones tilted just so flash it back. Their slopes are spread as measured (Cox and Munk, wider
  // along the wind than across it), so the glitter is as wide as the wind makes it: a narrow bright
  // road in a calm, a broad field of sparkle in a breeze, long and golden towards a low sun.
  vec3 L = uLightDir, Hv = normalize(V + L);
  vec2 wdir2 = windS > 0.01 ? uWindV / windS : vec2(1.0, 0.0);
  vec3 Tw = vec3(wdir2.x, 0.0, wdir2.y);
  Tw = normalize(Tw - N * dot(N, Tw));
  vec3 Bw = cross(N, Tw);
  float hn = max(dot(Hv, N), 0.05);
  float zx = dot(Hv, Tw) / hn, zy = dot(Hv, Bw) / hn;
  float pz = exp(-0.5 * (zx * zx / msq.x + zy * zy / msq.y)) / (6.2831853 * sqrt(msq.x * msq.y));
  float fh = 0.02 + 0.98 * pow(1.0 - clamp(dot(V, Hv), 0.0, 1.0), 5.0);
  float up = smoothstep(-0.02, 0.08, L.y);
  float sunSpec = min(pz * fh / (4.0 * max(cosV, 0.06) * hn * hn * hn * hn), 40.0) * 4.5;
#if DETAIL > 0
  // (Close by, the glitter is a scatter of single wavelets each flashing for a moment, the road broken
  // into sparks; as bright on average, so far off, where they're too small to see apart, it's the
  // smooth road.)
  float spark = smoothstep(0.56, 0.68, vnoise((p * 2.6 + g * 2.0) + vec2(uTime * 1.7, -uTime * 1.3)));
  sunSpec *= mix(1.0, spark * 2.7, near * 0.85);
#endif
  col += uSunColor * sunSpec * up * (1.0 - uRain * 0.85);
  pmSea += uSunColor * sunSpec * up * (1.0 - uRain * 0.85);
  // Ripple crests catch a little extra light.
  vec3 ripLit = (uAmbient + uSunColor * 0.4) * clamp(length(rips.xy) * 0.6 + max(0.0, length(rips.zw) - 0.18) * 0.8, 0.0, 0.25);
  col += ripLit;
  pmSea += ripLit * 0.5;

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
  // Whitecaps: from a moderate breeze up, the crests of the wind sea pinched too steep break in
  // white (ocean.js), more of them the fresher the wind. (A cap is white where the foam here (ocean.js: 1 where a crest has just broken, fading as it
  // ages) is more than a lace of noise carried down the wind: so a fresh cap is solid white, an
  // older one breaks up into threads and flecks trailing downwind before it goes, and as much of
  // the sea is white as the foam says, a few percent in a fresh breeze, a fifth or more in a gale.
  // Before, a fixed threshold on the foam showed its 2 m cells as diamonds.)
  vec2 wn = windS > 0.01 ? uWindV / windS : vec2(1.0, 0.0);
  vec2 wq = vec2(dot(p, vec2(-wn.y, wn.x)), dot(p, wn)) - vec2(0.0, uTime * 0.35);
  // (Squared: a cap just broken is dense, the long tail of it fading is a thin veil, so a fresh
  // breeze shows a few percent of the sea white and a gale about a quarter, as they do.)
  float capF = seaS.z * seaS.z * (1.0 - fresh);
  float caps = 0.0;
  if (capF > 0.01) {
    // (Foam is a web of bubbles: just broken, all of it, dense white; as it ages holes open in it
    // and only its walls are left, threads and lace trailing down the wind, until it's gone. Far off,
    // too fine to see, it's as bright as it is on average.)
#if DETAIL > 0
    float web = detail > 0.0 ? foamWeb(wq) : 0.5;
#else
    // (Low detail: the threads alone, without the bubbles' cells, which cost the most.)
    float web = detail > 0.0 ? clamp(0.1 + (1.0 - abs(vnoise(wq * vec2(0.9, 0.3)) * 2.0 - 1.0)) * 0.55 + (1.0 - abs(vnoise(wq * vec2(2.4, 0.8) + 3.1) * 2.0 - 1.0)) * 0.35, 0.0, 1.0) : 0.5;
#endif
    // (The short waves' own pinched crests break it up, where they're worked out.)
    web = mix(web, web * 0.75 + 0.25 * smoothstep(0.7, 1.02, shortS.z), uShortOn);
    float near = smoothstep(0.0, 0.6, detail);
    caps = mix(capF * 0.55, smoothstep(1.0 - capF, 1.0 - capF + 0.18, web), near);
  }
  // Foam blown in long streaks down the wind, and in a storm the crests of the big seas breaking.
  // (W6) The streaks by the wind's strength, as the Beaufort scale has them (spindrift.js
  // streakShare): none to force 6, beginning at force 7 (13.9 m/s), well marked at 8, dense at 9
  // (20.8). Lying on the water, they drift down the wind as its surface does, at about 3% of the
  // wind. (Before, they came with a storm whatever the wind, and their pattern raced down the wind
  // at 17 m/s.)
  vec2 wdir = windS > 0.01 ? uWindV / windS : vec2(1.0, 0.0);
  float streakF = smoothstep(${STREAKS[0].toFixed(1)}, ${STREAKS[1].toFixed(1)}, uWindMS) * (1.0 - fresh);
  float lane = vnoise(vec2(dot(p, vec2(-wdir.y, wdir.x)) * 0.85, (dot(p, wdir) - 0.03 * uWindMS * uTime) * 0.03));
  float streaks = smoothstep(0.7 - 0.1 * streakF, 0.86, lane) * smoothstep(0.35, 0.7, vnoise(p * 0.09 - drift * 0.3)) * shel.g * streakF;
  // (Each lane threads of foam down the wind, not a smooth smear: filaments a few tens of
  // centimetres across, drawn out along it.)
  if (streaks > 0.001) {
    vec2 sq = vec2(dot(p, vec2(-wdir.y, wdir.x)), dot(p, wdir) - 0.03 * uWindMS * uTime);
    float threads = 1.0 - abs(vnoise(sq * vec2(2.2, 0.18)) * 2.0 - 1.0);
    streaks *= smoothstep(0.45, 0.9, threads) * 0.8 + 0.2 * smoothstep(0.2, 0.8, vnoise(sq * vec2(5.0, 0.5) + 7.3));
  }
  // (Breaking only at the very tops of the big seas, where their faces are steepest.)
  float steepSea = smoothstep(0.08, 0.26, length(Nw.xz));
  // (W3b: by the swell's height pixel by pixel, out past where the sheet draws it, and the sea's own
  // drawn, above the tide (before, the tide's height counted too: more of them white at high water).
  // Where the pixels are too coarse for the swell, as much of the sea white as it is on average:
  // its crests sharpen as the storm builds, from about one part in forty to one in twelve.)
  float hCrest = vWave - vSwell + sw.x, stC = clamp((uStorm - 0.4) / 0.6, 0.0, 1.0);
  float crest = mix(0.026 + 0.06 * stC * stC, smoothstep(uSwellH * 0.62, uSwellH * 1.1, hCrest), swRes) * mix(0.35, 1.0, steepSea) * smoothstep(0.3, 0.62, vnoise(p * 0.42 - drift * 0.6)) * shel.r * stormy;
  // The boats' white water: the churn behind a propeller, settling into bubbly lace as it spreads,
  // and the foam at the foot of a fast boat's bow wave.
  float washed = rippleWash(vRest);
  float wash = 0.0;
  if (washed > 0.01) {
    // (Bubbly web: the thin contours of a pair of noise fields, finer close behind her.)
    float web = max(1.0 - smoothstep(0.03, 0.12, abs(vnoise(p * 1.9 + uTime * 0.07) - 0.5)),
                    1.0 - smoothstep(0.03, 0.1, abs(vnoise(p * 4.3 - uTime * 0.05 + 3.7) - 0.5)) * 0.8);
    wash = smoothstep(0.6, 0.95, washed) * (0.7 + 0.3 * web) + smoothstep(0.05, 0.6, washed) * web * 0.8;
  }
  // (Under a whitecap, the cloud of bubbles it has driven down glows pale turquoise.)
  col += mix(uMid, uShallow, 0.7) * (uAmbient + uSunColor * 0.5) * capF * 0.22;
  float foam = clamp(edge * (0.9 - fresh * 0.75) + bands * 0.35 * min(surf, 1.0) + breaker * 0.85 + streak * 0.45 + caps * 0.92 + streaks * 0.55 + crest * 0.9 + wash * 0.85, 0.0, 1.0);
  // (Foam stays white against a dark storm sea.)
  vec3 foamLit = uFoam * max(uAmbient + uSunColor * 0.6, vec3(0.62 * stormy));
  col = mix(col, foamLit, foam * 0.85);
  pmSea = mix(pmSea, foamLit, foam * 0.85);
  aSea = mix(aSea, 1.0, foam * 0.85);

  // Warm lantern light pooling on the water.
  for (int i = 0; i < 2; i++) {
    vec4 L = uLights[i];
    if (L.w > 0.001) {
      vec3 toL = L.xyz - vWorld;
      float ld = length(toL.xz);
      float glow = exp(-ld * 0.38) * 0.24;
      float spec = pow(max(dot(R, normalize(toL)), 0.0), 60.0) * 0.6;
      col += vec3(1.0, 0.6, 0.3) * L.w * (glow + spec);
      pmSea += vec3(1.0, 0.6, 0.3) * L.w * (glow * 0.3 + spec);
    }
  }

  col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), uNight * 0.35);
  pmSea = mix(pmSea, vec3(dot(pmSea, vec3(0.3, 0.59, 0.11))), uNight * 0.35);

  float alpha = mix(0.42, 0.95, smoothstep(0.0, 5.0, depth));
  // Clear blue water (Las Brasas): the reef and its fish show from a boat down to a dozen metres or
  // so (not in a storm, when it's churned up).
  alpha = mix(alpha, mix(0.3, 0.92, smoothstep(1.0, 18.0, depth)), uClear * (1.0 - stormy));
  // Clear fresh water: you can see the gravel in the stream and fish in the shallows.
  alpha = mix(alpha, mix(0.5, 0.92, smoothstep(0.0, 3.0, depth)), fresh);
  alpha = mix(alpha, 0.93, silty * 0.8);
  alpha = max(alpha, foam);
  // (The sea as light let through and light sent back; fresh water as it was.)
  gl_FragColor = vec4(mix(pmSea, col * alpha, fresh), mix(aSea, alpha, fresh));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
#if DETAIL > 0
  // (W4b, Ocean: Full) What's under the surface, seen through it as it moves: the bottom where the
  // eye's ray, bent by this bit of the surface's slope, meets it, rather than straight below. Only
  // the waves' share of the bend (a level surface shows it just where it was drawn), so the sand
  // and the stones in the shallows waver and the caustics' lines dance as the ripples pass. What
  // it's drawn over is what the blending would have laid it on, moved: so where the copy is the
  // picture behind (no slope), it's exactly as before. A few metres down at most (deeper, the water's
  // own colour hides it), and none at the very edge, where the beach above the water starts.
  if (uBelowOn > 0.5) {
    float dB = clamp(vWorld.y - ground, 0.0, 6.0) * smoothstep(0.02, 0.3, depth);
    vec2 sh = bottomShift(dB, N, V);
    // (And the roughness too fine to draw (msq, which spreads the sun's glitter too): each of those
    // wavelets bends the ray its own way, by a quarter of the depth times its slope. Close by, where
    // a pixel sees them one at a time, they're a shimmer, moving as they do (noise as rough as they
    // are: two samples about zero, each spread about 0.2, times 5); further off, where a pixel
    // covers many, their average: a blur.)
    float sc = 0.25 * dB * sqrt(0.5 * (msq.x + msq.y));
    vec2 q = p * 3.0 + vec2(uTime * 0.7, -uTime * 0.5);
    sh += (vec2(vnoise(q), vnoise(q * 1.13 + vec2(17.3, -uTime * 0.4))) - 0.5) * 5.0 * sc * near;
    vec3 Pb = vWorld - V * (dB / max(V.y, 0.08));
    vec4 c0 = uViewProj * vec4(Pb, 1.0), c1 = uViewProj * vec4(Pb + vec3(sh.x, 0.0, sh.y), 1.0);
    vec2 duv = (c1.xy / c1.w - c0.xy / c0.w) * 0.5;
    duv *= min(1.0, 0.03 / max(length(duv), 1e-5));
    // (Far off, the fine wavelets' blur: a quarter of the depth times their slope, a few
    // centimetres on a calm day, a hand's breadth in a breeze.)
    float rb = 0.25 * dB * sqrt(msq.x + msq.y) * (1.0 - near);
    vec4 cx = uViewProj * vec4(Pb + vec3(rb, 0.0, 0.0), 1.0), cz = uViewProj * vec4(Pb + vec3(0.0, 0.0, rb), 1.0);
    vec2 bx = (cx.xy / cx.w - c0.xy / c0.w) * 0.5, bz = (cz.xy / cz.w - c0.xy / c0.w) * 0.5;
    bx *= min(1.0, 0.02 / max(length(bx), 1e-5));
    bz *= min(1.0, 0.02 / max(length(bz), 1e-5));
    vec2 uv = gl_FragCoord.xy / uScreen + duv, lo = vec2(0.001), hi = vec2(0.999);
    vec3 below = texture2D(uBelow, clamp(uv, lo, hi)).rgb * 0.4
      + (texture2D(uBelow, clamp(uv + bx, lo, hi)).rgb + texture2D(uBelow, clamp(uv - bx, lo, hi)).rgb
      + texture2D(uBelow, clamp(uv + bz, lo, hi)).rgb + texture2D(uBelow, clamp(uv - bz, lo, hi)).rgb) * 0.15;
    gl_FragColor = vec4(gl_FragColor.rgb + (1.0 - gl_FragColor.a) * below, 1.0);
  }
#endif
}
`;

// (W2) The sea's mean square slope in a wind of u m/s, up the wind and across it: what Cox and Munk
// measured from photographs of the sun's glitter on the sea (clean surface, 1954). The water's
// shading spreads the sun's reflection by the part of it its drawn waves leave out.
export function seaSlopeVariance(u) {
  const U = Math.max(0.5, u || 0);
  return [3.16e-3 * U, 0.003 + 1.92e-3 * U];
}

// (W4) How strongly sea water takes up red, green and blue light, per metre (the diffuse
// attenuation, Kd). This coast's water is coastal (Jerlov's coastal types 1 to 3; a summer Secchi
// depth of eight to twelve metres, as off south-west Britain and Brittany, about 1.7 / Kd for
// green): red is gone in a couple of metres, and blue goes sooner than green (the dissolved yellow
// matter off the land takes it), so it's green. The clear blue water at Las Brasas is oceanic (the
// Canaries' summer Secchi depth of 25 m or more), keeping the blue longest. Silt after rain or a
// blow, and a storm's churn, take everything faster.
export const SEA_SIGMA = {
  coastal: [0.55, 0.16, 0.22],
  clear: [0.4, 0.06, 0.04],
  silt: [0.6, 0.55, 0.65],
  storm: [0.25, 0.22, 0.25],
};
// The cosine of a ray's angle from the vertical once it's through the surface into the water,
// from its cosine in the air (Snell's law, water's index 1.333: it's bent towards the vertical,
// never further from it than 48.6°). The fog chunk bends the eye's ray the same way (sky.js).
export const refractedCos = (cosAir) => Math.sqrt(1 - (1 - cosAir * cosAir) / 1.777);
// (W4b) Where the eye's ray through a sloping bit of the surface meets a bottom d metres down,
// against where it would through a level one (both bent by Snell's law, water's index 1.333): the
// shift along the bottom (x, z) the waves' slope makes. N the surface's normal, V towards the eye
// (both unit vectors, y up). The sea shader does the same (bottomShift there).
export function bottomShift(d, N, V, out = [0, 0]) {
  const refr = (n) => {
    const eta = 0.75, ix = -V[0], iy = -V[1], iz = -V[2];
    const c = n[0] * ix + n[1] * iy + n[2] * iz, k = 1 - eta * eta * (1 - c * c);
    if (k < 0) return [0, 0, 0];
    const f = eta * c + Math.sqrt(k);
    return [eta * ix - f * n[0], eta * iy - f * n[1], eta * iz - f * n[2]];
  };
  const T = refr(N), T0 = refr([0, 1, 0]);
  const a = d / Math.max(-T[1], 0.2), b = d / Math.max(-T0[1], 0.2);
  out[0] = T[0] * a - T0[0] * b;
  out[1] = T[2] * a - T0[2] * b;
  return out;
}
export function seaSigma(clear = 0, silt = 0, storm = 0, out = [0, 0, 0]) {
  const C = SEA_SIGMA;
  for (let i = 0; i < 3; i++) out[i] = C.coastal[i] + (C.clear[i] - C.coastal[i]) * clear + C.silt[i] * silt * (1 - clear) + C.storm[i] * Math.min(1, storm);
  return out;
}

export function createWater(heightTex, rect, detailTex, detailRect) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSwellA: { value: Array.from(conditions.swellAmps) },
      uPeak: { value: 1 },
      uWindMS: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSkySun: { value: new THREE.Color(1, 1, 1) },
      uGlow: { value: 0 },
      uSlopeVar: { value: new THREE.Vector2(0.01, 0.01) },
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
      uFarR: { value: 1500 },
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
  uniforms.uFarRipple = { value: null };
  uniforms.uFarRect = { value: new THREE.Vector4(0, 0, 1, 1) };
  uniforms.uFarOn = { value: 0 };
  const seaTex = seaTextures();
  uniforms.uSea0 = { value: seaTex.t0 };
  uniforms.uSea1 = { value: seaTex.t1 };
  uniforms.uSeaCopy = { value: new THREE.Vector4(longSea.copy.c, longSea.copy.s, longSea.copy.x, longSea.copy.z) };
  uniforms.uSeaPatch = { value: new THREE.Vector2(PATCH.L, PATCH.N) };
  uniforms.uSeaChop = { value: longSea.choppy };
  uniforms.uTmaL = { value: Array.from(longSea.tma) };
  uniforms.uTmaS = { value: new Array(TMA_N).fill(1) };
  uniforms.uShortDisp = { value: null };
  uniforms.uShortSlope = { value: null };
  uniforms.uShortOn = { value: 0 };
  uniforms.uShortL = { value: SHORT.L };
  uniforms.uFineSlope = { value: null };
  uniforms.uFineOn = { value: 0 };
  uniforms.uFineL = { value: FINE.L };
  uniforms.uSlopeShare = { value: new THREE.Vector3(0, 0, 0) };
  uniforms.uBelow = { value: null };
  uniforms.uBelowOn = { value: 0 };
  uniforms.uScreen = { value: new THREE.Vector2(1, 1) };
  uniforms.uViewProj = { value: new THREE.Matrix4() };
  let shortSea = null, fineSea = null;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    defines: { DETAIL: 2, NO_WATER_TINT: 1 },
    transparent: true,
    premultipliedAlpha: true,
    fog: true,
    side: THREE.DoubleSide,
  });

  // A sheet that follows the camera: fine close by, where you see each wave and every wake, and
  // coarser ring by ring further out (each ring's cells twice the last's), out past where the
  // near sheet ends. Snapped to the coarsest ring's grid as it follows, so no vertex ever swims.
  // Fewer, coarser cells on lower quality settings.
  let snap = 1, farSnap = 1, segs = 0;
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  // (W3b) Past it, the far sheet: the same waves, drawn on cells as coarse as the near sheet's
  // coarsest and coarser ring by ring, out to where the sheets can't draw any of them (seaLayout's
  // flatR). Where it lies under the near sheet's coarsest ring its vertices are that ring's own, so
  // the two meet without a step; each draws its own side of NEAR_R. Then the flat ring out to the
  // horizon, so a long way out from the bay there is still ocean all round; its waves, too far off
  // for the sheet to draw, in its shading. Both the plainest shading (as far off as they are, the
  // finer touches are gone anyway).
  const farMaterial = (defines) => new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, defines: { DETAIL: 0, NO_WATER_TINT: 1, ...defines }, transparent: true, premultipliedAlpha: true, fog: true, side: THREE.DoubleSide,
  });
  const far = new THREE.Mesh(new THREE.BufferGeometry(), farMaterial({ FAR: 1 }));
  far.frustumCulled = false;
  far.renderOrder = 1;
  mesh.add(far);
  const ring = new THREE.Mesh(new THREE.BufferGeometry(), farMaterial({ RING: 1 }));
  ring.frustumCulled = false;
  ring.renderOrder = 1;
  mesh.add(ring);

  // (W4b) Ocean: Full: what's under the sea, as drawn, copied off the screen just before the sea
  // itself is drawn (everything solid is drawn before anything see-through, and the sea before the
  // things on its surface), once a frame, for the sea to see it through its moving surface. Only
  // for the view on the screen (not the reflection, which leaves the sea out), and not from under
  // the water.
  const below = { want: false, done: false, tex: null, size: new THREE.Vector2(), origin: new THREE.Vector2() };
  mesh.onBeforeRender = (renderer, scene, camera) => {
    // (Any other picture the sea is drawn into, into a texture of its own, goes without; and so
    // does the plainest sea (DETAIL 0, the Low setting), which hasn't the code to use it.)
    if (!below.want || !(material.defines.DETAIL > 0) || uniforms.uUnder.value > 0.5 || renderer.getRenderTarget() !== null) {
      uniforms.uBelowOn.value = 0;
      return;
    }
    if (!below.done) {
      below.done = true;
      renderer.getDrawingBufferSize(below.size);
      const w = below.size.x, h = below.size.y;
      if (!below.tex || below.tex.image.width !== w || below.tex.image.height !== h) {
        below.tex?.dispose();
        below.tex = new THREE.FramebufferTexture(w, h);
        below.tex.minFilter = below.tex.magFilter = THREE.LinearFilter;
        uniforms.uBelow.value = below.tex;
      }
      renderer.copyFramebufferToTexture(below.origin, below.tex);
      uniforms.uScreen.value.set(w, h);
    }
    uniforms.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    uniforms.uBelowOn.value = 1;
  };

  const api = {
    mesh,
    far,
    ring,
    uniforms,
    // (W4) The sea's water, each frame, for everything seen through it from above (sky.js HAZE):
    // where its surface stands, whether the eye's above it (under: 0 above … 1 under), the sun's
    // way down through it (bent by the surface), how it takes up each colour, and its glow: the
    // deep water's colour lit as the surface shader lights it, so the deep sea and the seabed seen
    // far down through it are one colour.
    seaLight(lightDir, under) {
      const u = uniforms, S = HAZE.hazeSea.value, W = HAZE.hazeWater.value;
      S[0] = u.uTideLevel.value;
      S[1] = 1 - under;
      const sy = Math.max(0.05, lightDir.y);
      S[2] = refractedCos(sy);
      seaSigma(u.uClear.value, u.uColour.value, u.uStorm.value, HAZE.hazeSigma.value);
      const D = u.uDeep.value, A = u.uAmbient.value, L = u.uSunColor.value, k = 0.25 + 0.55 * sy, st = Math.min(1, u.uStorm.value) * 0.8;
      W[0] = (D.r + (0.09 - D.r) * st) * (A.r + L.r * k);
      W[1] = (D.g + (0.17 - D.g) * st) * (A.g + L.g * k);
      W[2] = (D.b + (0.21 - D.b) * st) * (A.b + L.b * k);
    },
    // The shared conditions, each frame: the waves' amplitudes and the wind's ruffle.
    sync(windX, windZ) {
      uniforms.uSwellA.value.splice(0, SWELL.length, ...conditions.swellAmps);
      // The wind sea's long waves for this moment (ocean.js), up to the graphics card.
      longSea.fill(conditions.time);
      seaTex.send(longSea);
      uniforms.uSeaChop.value = longSea.choppy;
      // (W5) Each band's height left by depth, as its spectrum has it now.
      for (let i = 0; i < TMA_N; i++) uniforms.uTmaL.value[i] = longSea.tma[i];
      if (shortSea) {
        const W = longSea.wind;
        shortSea.update(conditions.time, W.u, W.to, W.m0, longSea.choppy);
        for (let i = 0; i < TMA_N; i++) uniforms.uTmaS.value[i] = shortSea.spectrum.patch.tma[i];
        fineSea?.update(conditions.time, W.u, W.to, W.m0, longSea.choppy);
      }
      uniforms.uWindV.value.set(windX, windZ);
      uniforms.uSwellH.value = conditions.sea.swell;
      uniforms.uChopH.value = conditions.sea.chop;
      uniforms.uPeak.value = conditions.sea.peak;
      uniforms.uWindMS.value = conditions.wind.speed;
      const [up, across] = seaSlopeVariance(conditions.wind.speed);
      uniforms.uSlopeVar.value.set(up, across);
      // (W5) How much of it each band draws, from its spectrum (as it was last built).
      const cm = up + across;
      uniforms.uSlopeShare.value.set(slopeShare(longSea.patch, cm), slopeShare(shortSea?.spectrum.patch, cm), slopeShare(fineSea?.spectrum.patch, cm));
      uniforms.uStorm.value = conditions.sea.storm;
    },
    follow(pos) {
      below.done = false;
      mesh.position.x = Math.round(pos.x / snap) * snap;
      mesh.position.z = Math.round(pos.z / snap) * snap;
      far.position.set(Math.round(pos.x / farSnap) * farSnap - mesh.position.x, 0, Math.round(pos.z / farSnap) * farSnap - mesh.position.z);
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
      if (want && !shortSea) {
        shortSea = new ShortSea(renderer);
        // (W5) And the finest waves, close by.
        fineSea = new ShortSea(renderer, new FineSpectrum());
      }
      if (!want && shortSea) {
        shortSea.dispose();
        shortSea = null;
        fineSea?.dispose();
        fineSea = null;
      }
      uniforms.uShortOn.value = shortSea ? 1 : 0;
      uniforms.uFineOn.value = fineSea ? 1 : 0;
      uniforms.uFineSlope.value = fineSea ? fineSea.slope.texture : null;
      // (W4b) The bottom seen through the moving surface, with the short waves that move it.
      below.want = !!shortSea;
      if (!below.want) uniforms.uBelowOn.value = 0;
      uniforms.uShortDisp.value = shortSea ? shortSea.disp.texture : null;
      uniforms.uShortSlope.value = shortSea ? shortSea.slope.texture : null;
      return shortSea ? 'full' : 'simple';
    },
    // seg: the quality setting's resolution (about how many cells across the old 900 m sheet).
    setSegments(seg) {
      if (segs === seg) return;
      segs = seg;
      // (Fewer cells across each ring on the lower settings, for slower machines.)
      const L = seaLayout(seg);
      mesh.geometry.dispose();
      mesh.geometry = clipmap(L.cell, L.n, L.levels);
      snap = L.snap;
      far.geometry.dispose();
      far.geometry = clipmap(L.nearCell, L.n, L.farLevels, L.hole);
      farSnap = L.farSnap;
      ring.geometry.dispose();
      ring.geometry = new THREE.RingGeometry(L.farR - 2, 6000, 96, 6).rotateX(-Math.PI / 2);
      uniforms.uWaveLod.value.set(L.cell, L.lod);
      uniforms.uFarR.value = L.farR;
    },
  };
  api.setSegments(300);
  return api;
}

// The near sheet: a square of n × n cells of `cell` metres round the middle, then rings round it,
// each twice as coarse and twice as wide as the one inside, `levels` in all. aEdge marks the
// vertices on each ring's outer edge that fall between two of the next ring's (see the shader).
// (W3b: the far sheet the same, its middle square, `hole` cells out from the middle each way, left
// out.)
export function clipmap(cell, n, levels, hole = 0) {
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
        if (!L && hole && i >= n / 2 - hole && i < n / 2 + hole && j >= n / 2 - hole && j < n / 2 + hole) continue;
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
