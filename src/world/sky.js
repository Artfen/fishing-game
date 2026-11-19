import * as THREE from 'three';
import { clamp, lerp, smoothstep, seeded, mergeParts, mat } from '../util.js';
import { $t } from '../i18n.js';

// The haze lies low: thick over the sea and the low ground, thinner higher up, so the snow on
// Hoarfell shows from the bay while the far edges of the land stay lost in it. (The fog's
// density, for each thing drawn, goes by how high that thing is.)
// (W3) And the haze is the sky's own colour along the horizon, the way you look (not one colour
// for the whole view): warm towards a low sun and bright round it, dusk-blue on the far side, the
// storm's dark, so the far sea and the far shore fade into the sky just above them without a seam.
// Worked out as the sky dome works out its horizon (skyFrag, at h = 0), in linear light, and
// turned into the screen's colours as the dome's are. Every hazed material shares these: the same
// arrays, never copied (three.js copies a uniform's Color or Vector for each material, but keeps a
// typed array as it is), set once a frame (Environment.update).
export const HAZE = {
  hazeSun: { value: new Float32Array(4) },    // the sun's direction; w: how much the haze is the sky's (0: fogColor alone)
  hazeAway: { value: new Float32Array(3) },   // along the horizon, away from the sun
  hazeToward: { value: new Float32Array(3) }, // towards it
  hazeGlow: { value: new Float32Array(3) },   // the warm glow along the horizon round a low sun
  hazeHalo: { value: new Float32Array(3) },   // the brightness round the sun itself
  hazeDark: { value: new Float32Array(4) },   // a storm's dark horizon, and how much of it
  hazeFlash: { value: new Float32Array(4) },  // a lightning flash, and how much
  // (W4) The sea, for everything seen through it from above: where its surface stands, how much
  // it counts (0 with the eye under it), and the sun's way down through it (the cosine of its
  // angle in the water); how strongly it takes up red, green and blue, per metre; and its glow
  // (linear). Set by water.js seaLight.
  hazeSea: { value: new Float32Array(4) },
  hazeSigma: { value: new Float32Array(3) },
  hazeWater: { value: new Float32Array(3) },
};
Object.assign(THREE.UniformsLib.fog, HAZE);
for (const sh of Object.values(THREE.ShaderLib)) if (sh.uniforms?.fogColor) Object.assign(sh.uniforms, HAZE);

THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth;
  varying float vFogY;
  varying vec3 vFogDir;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogY = cameraPosition.y + dot(viewMatrix[1].xyz, mvPosition.xyz);
  vFogDir = (vec4(mvPosition.xyz, 0.0) * viewMatrix).xyz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform vec4 hazeSun;
  uniform vec3 hazeAway;
  uniform vec3 hazeToward;
  uniform vec3 hazeGlow;
  uniform vec3 hazeHalo;
  uniform vec4 hazeDark;
  uniform vec4 hazeFlash;
  uniform vec4 hazeSea;
  uniform vec3 hazeSigma;
  uniform vec3 hazeWater;
  varying float vFogDepth;
  varying float vFogY;
  varying vec3 vFogDir;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    // (How hazy the air is at each height, and on the way here from the eye: the less of the two,
    // so the high tops stand clear from below, and from up high you see down through the haze.)
    #define HAZE(y) mix(1.0, 0.16, smoothstep(40.0, 330.0, y))
    float fogAlong = (HAZE(cameraPosition.y) + 4.0 * HAZE((cameraPosition.y + vFogY) * 0.5) + HAZE(vFogY)) / 6.0;
    float fogThin = fogDensity * min(HAZE(vFogY), fogAlong);
    float fogFactor = 1.0 - exp( - fogThin * fogThin * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  #ifndef NO_WATER_TINT
  // (W4) Seen from above the sea, anything under its surface (the seabed and its rocks, the fish,
  // a hull below her waterline, a diver) is seen through the water: each colour taken up along the
  // way the light came, down from the sky to it and back up to the eye (red first, in a metre or
  // two), and the water's own glow in its place, the more of it the more water between. (In this
  // chunk the colour's already the screen's, so the light let through and the glow go into the
  // screen's colours too.)
  if (hazeSea.y > 0.0 && vFogY < hazeSea.x) {
    float wd = hazeSea.x - vFogY;
    float wc = abs(normalize(vFogDir).y);
    float wmu = sqrt(max(1.0 - (1.0 - wc * wc) / 1.777, 0.05));
    vec3 wtv = exp(-hazeSigma * wd / wmu);
    vec3 wt = wtv * exp(-hazeSigma * wd / max(hazeSea.z, 0.2));
    vec3 wg = hazeWater;
    #ifdef TONE_MAPPING
      wg = toneMapping(wg);
    #endif
    vec3 wseen = gl_FragColor.rgb * linearToOutputTexel(vec4(wt, 1.0)).rgb
      + linearToOutputTexel(vec4(wg, 1.0)).rgb * (1.0 - linearToOutputTexel(vec4(wtv, 1.0)).rgb);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, wseen, hazeSea.y);
  }
  #endif
  vec3 fogC = fogColor;
  if (hazeSun.w > 0.0) {
    vec3 fogD = normalize(vFogDir);
    float fogT = dot(normalize(fogD.xz + vec2(1e-5)), normalize(hazeSun.xz + vec2(1e-5))) * 0.5 + 0.5;
    float fogS = max(dot(fogD, hazeSun.xyz), 0.0);
    vec3 hz = mix(hazeAway, hazeToward, smoothstep(0.15, 1.0, fogT)) + hazeGlow * (fogT * fogT * fogT * fogT)
      + hazeHalo * (pow(fogS, 5.0) * 0.16 + pow(fogS, 40.0) * 0.32);
    hz = mix(mix(hz, hazeDark.rgb, hazeDark.a), hazeFlash.rgb, hazeFlash.a);
    fogC = mix(fogC, linearToOutputTexel(vec4(hz, 1.0)).rgb, hazeSun.w);
  }
  #ifdef PREMULTIPLIED_ALPHA
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogC * gl_FragColor.a, fogFactor );
  #else
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogC, fogFactor );
  #endif
#endif`;

// The haze's colour looking along (dx, dz), in linear light: the fog chunk's sum, for what reads
// it on the CPU (the fog colour, for what's in view).
export function hazeAt(dx, dz, out) {
  const S = HAZE.hazeSun.value, l = Math.hypot(dx, dz) || 1, sl = Math.hypot(S[0], S[2]) || 1;
  const t = ((dx * S[0] + dz * S[2]) / (l * sl)) * 0.5 + 0.5;
  const w = smoothstep(0.15, 1, t), t4 = t * t * t * t;
  const sd = Math.max(0, (dx * S[0] + dz * S[2]) / l), halo = Math.pow(sd, 5) * 0.16 + Math.pow(sd, 40) * 0.32;
  const A = HAZE.hazeAway.value, B = HAZE.hazeToward.value, Gl = HAZE.hazeGlow.value, Hl = HAZE.hazeHalo.value, D = HAZE.hazeDark.value, F = HAZE.hazeFlash.value;
  const c = [0, 1, 2].map((i) => {
    let v = A[i] + (B[i] - A[i]) * w + Gl[i] * t4 + Hl[i] * halo;
    v += (D[i] - v) * D[3];
    return v + (F[i] - v) * F[3];
  });
  return out.setRGB(c[0], c[1], c[2]);
}

// Hand-picked colours for each part of the day. Everything else is interpolated.
const KEYS = [
  { h: 0,    zen: '#0f1d3a', hor: '#2a3d66', sun: '#9cb2e4', sunI: 0.5, sky: '#53689e', gnd: '#1c2132', hemiI: 1.1 },
  { h: 4.4,  zen: '#17264f', hor: '#41507e', sun: '#9cb2e4', sunI: 0.5, sky: '#5a6a9e', gnd: '#202436', hemiI: 1.1 },
  { h: 5.8,  zen: '#4d679c', hor: '#eeb28e', sun: '#ffb27c', sunI: 1.4, sky: '#aaadc8', gnd: '#6e5a50', hemiI: 1.25 },
  { h: 6.5,  zen: '#6487c4', hor: '#f3c9a2', sun: '#ffd29c', sunI: 2.0, sky: '#bcc2d6', gnd: '#7a6a56', hemiI: 1.35 },
  { h: 7.5,  zen: '#5d97d3', hor: '#d3e3e6', sun: '#ffeccc', sunI: 2.5, sky: '#c2d8ec', gnd: '#8a7a5c', hemiI: 1.45 },
  { h: 12,   zen: '#4a8cd6', hor: '#d5ebf1', sun: '#fff6e4', sunI: 3.0, sky: '#cbe2f4', gnd: '#8e8060', hemiI: 1.55 },
  { h: 16,   zen: '#5690d0', hor: '#e9e3cb', sun: '#ffe4b4', sunI: 2.8, sky: '#cfdcea', gnd: '#8e7a5c', hemiI: 1.45 },
  { h: 18,   zen: '#6582c0', hor: '#f6c48e', sun: '#ffb168', sunI: 2.5, sky: '#d4bcc4', gnd: '#86624c', hemiI: 1.3 },
  { h: 19.3, zen: '#4f5498', hor: '#f29572', sun: '#ff8650', sunI: 1.7, sky: '#b48ca8', gnd: '#68484a', hemiI: 1.2 },
  { h: 20.5, zen: '#283166', hor: '#8a6a8f', sun: '#b892c0', sunI: 0.8, sky: '#71699c', gnd: '#2c2638', hemiI: 1.15 },
  { h: 21.1, zen: '#1b2858', hor: '#4b5890', sun: '#8fa0d8', sunI: 0.6, sky: '#5d6a9e', gnd: '#242838', hemiI: 1.12 },
  { h: 22,   zen: '#0f1d3a', hor: '#2a3d66', sun: '#9cb2e4', sunI: 0.5, sky: '#53689e', gnd: '#1c2132', hemiI: 1.1 },
  { h: 24,   zen: '#0f1d3a', hor: '#2a3d66', sun: '#9cb2e4', sunI: 0.5, sky: '#53689e', gnd: '#1c2132', hemiI: 1.1 },
].map((k) => ({
  ...k,
  zen: new THREE.Color(k.zen), hor: new THREE.Color(k.hor), sun: new THREE.Color(k.sun),
  sky: new THREE.Color(k.sky), gnd: new THREE.Color(k.gnd),
}));

export function phaseName(h) {
  if (h < 5) return 'Night';
  if (h < 7) return 'Dawn';
  if (h < 11.5) return 'Morning';
  if (h < 14) return 'Midday';
  if (h < 17.4) return 'Afternoon';
  if (h < 19.5) return $t('Golden hour');
  if (h < 21) return 'Dusk';
  return 'Night';
}

export function formatClock(h) {
  const mins = Math.floor((h % 1) * 60 / 10) * 10;
  const hr = Math.floor(h) % 24;
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}:${String(mins).padStart(2, '0')} ${hr < 12 ? 'am' : 'pm'}`;
}

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const skyFrag = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uNight;
uniform float uRain;
uniform float uTime;
uniform float uUnder;
uniform vec3 uUnderColor;
uniform float uGlow;
uniform float uFlash;   // lightning: the whole sky lit for an instant
uniform vec3 uFlashDir; // where the strike is
uniform float uStorm;   // how stormy: the sky low and dark, torn cloud racing past
varying vec3 vDir;
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  // With the sun low, the sky round it glows warm along the horizon, and the far side, away from
  // it, turns a cooler dusky blue and rose.
  vec2 across = normalize(d.xz + vec2(1e-5));
  vec2 sunFlat = normalize(uSunDir.xz + vec2(1e-5));
  float toward = dot(across, sunFlat) * 0.5 + 0.5;
  vec3 hor = mix(mix(uHorizon, uZenith * 1.15 + vec3(0.07, 0.035, 0.09), 0.42 * uGlow), uHorizon * 1.04 + uSunColor * 0.1 * uGlow, smoothstep(0.15, 1.0, toward));
  vec3 col = mix(hor, uZenith, pow(clamp(h, 0.0, 1.0), mix(0.6, 0.45, uGlow)));
  col += uSunColor * pow(toward, 4.0) * exp(-max(h, 0.0) * 7.0) * 0.22 * uGlow;
  col = mix(col, hor * 0.92, smoothstep(0.0, -0.2, h));

  float sd = max(dot(d, uSunDir), 0.0);
  float sunVis = smoothstep(-0.12, 0.02, uSunDir.y) * (1.0 - uRain * 0.8);
  col += uSunColor * (pow(sd, 5.0) * 0.16 + pow(sd, 40.0) * 0.32) * sunVis;
  col = mix(col, uSunColor * 1.5 + 0.35, smoothstep(0.99925, 0.99965, sd) * sunVis * step(-0.02, h));

  float md = max(dot(d, uMoonDir), 0.0);
  float moonVis = uNight * (1.0 - uRain * 0.9);
  col = mix(col, vec3(0.95, 0.96, 1.0), smoothstep(0.99935, 0.9996, md) * moonVis);
  col += vec3(0.35, 0.42, 0.6) * pow(md, 24.0) * 0.25 * moonVis;

  vec3 sp = d * 220.0;
  vec3 cell = floor(sp);
  float r = hash13(cell);
  float star = step(0.9965, r) * (1.0 - smoothstep(0.0, 0.32, length(fract(sp) - 0.5)));
  float tw = 0.6 + 0.4 * sin(uTime * (1.0 + r * 3.0) + r * 50.0);
  col += vec3(1.0, 0.96, 0.9) * star * tw * moonVis * smoothstep(0.02, 0.3, h) * 1.2;

  // A storm: the sky low and dark, with torn cloud racing across it; lightning lights it all
  // for an instant, brightest round the strike.
  if (uStorm > 0.001) {
    vec2 q = d.xz / max(h + 0.18, 0.05) * 1.6;
    float n = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++) {
      vec2 c = q + vec2(uTime * 0.05 * float(i + 1), -uTime * 0.03);
      vec2 ic = floor(c), fc = fract(c);
      vec2 u2 = fc * fc * (3.0 - 2.0 * fc);
      float a = hash13(vec3(ic, 1.0)), b = hash13(vec3(ic + vec2(1.0, 0.0), 1.0)), c2 = hash13(vec3(ic + vec2(0.0, 1.0), 1.0)), e = hash13(vec3(ic + 1.0, 1.0));
      n += amp * mix(mix(a, b, u2.x), mix(c2, e, u2.x), u2.y);
      q *= 2.1;
      amp *= 0.5;
    }
    vec3 dark = mix(uHorizon * 0.55, uZenith * 0.35, clamp(h * 1.5, 0.0, 1.0));
    col = mix(col, dark * (0.75 + n * 0.5), uStorm * smoothstep(-0.1, 0.05, h));
  }
  col += vec3(0.78, 0.82, 0.95) * uFlash * (0.35 + 0.9 * pow(max(dot(d, uFlashDir), 0.0), 6.0));
  col = mix(col, uUnderColor, uUnder);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const _grey = new THREE.Color();
const _haze = new THREE.Color(), _hA = new THREE.Color();
const _dusk = new THREE.Color(0.07, 0.035, 0.09);

function towardsGrey(c, amt, dark) {
  const l = (c.r * 0.3 + c.g * 0.59 + c.b * 0.11) * dark;
  _grey.setRGB(l * 0.96, l, l * 1.04);
  c.lerp(_grey, amt);
}

const _flashC = new THREE.Color(0.8, 0.84, 0.95);
const _cold = new THREE.Color(0.7, 0.76, 0.82);

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.fogBase = 0.0021; // haze on a clear day; rain, cloud and early mornings thicken it
    this.air = 1; // how hazy the air is drawn: less on Ultra and Cinematic, which see further
    this.cloud = 0;
    this.zenith = new THREE.Color();
    this.horizon = new THREE.Color();
    this.sunColor = new THREE.Color();
    this.skyCol = new THREE.Color();
    this.gndCol = new THREE.Color();
    this.sunI = 1;
    this.hemiI = 1;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.moonDir = new THREE.Vector3(-0.35, 0.72, -0.6).normalize();
    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.night = 0;
    this.daylight = 1;
    this.lantern = 0;
    this.rain = 0;
    // A storm (0 … 1) and a lightning flash this frame (0 … 1, set by the storm: see storm.js).
    this.storm = 0;
    this.flash = 0;
    // (How far under the water the camera is, 0 … 1: see setUnder.)
    this.under = 0;
    this.flashDir = new THREE.Vector3(1, 0.2, 0);

    const light = (this.light = new THREE.DirectionalLight(0xffffff, 3));
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    const sc = light.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 420;
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.05;
    scene.add(light, light.target);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
    scene.add(this.hemi);

    this.skyUniforms = {
      uZenith: { value: this.zenith },
      uHorizon: { value: this.horizon },
      uSunDir: { value: this.sunDir },
      uSunColor: { value: new THREE.Color() },
      uMoonDir: { value: this.moonDir },
      uNight: { value: 0 },
      uRain: { value: 0 },
      uTime: { value: 0 },
      uUnder: { value: 0 },
      uUnderColor: { value: new THREE.Color() },
      uGlow: { value: 0 },
      uFlash: { value: 0 },
      uFlashDir: { value: new THREE.Vector3(1, 0.2, 0) },
      uStorm: { value: 0 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    this.buildClouds();
  }

  buildClouds() {
    const rnd = seeded(7);
    this.cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
    this.clouds = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const parts = [];
      const n = 4 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const r = 6 + rnd() * 8;
        parts.push({
          geo: new THREE.IcosahedronGeometry(r, 1),
          matrix: mat((k - n / 2) * 7 + rnd() * 4, rnd() * 3, (rnd() - 0.5) * 8, 0, rnd() * 3, 0, 1, 0.62, 1),
          color: '#ffffff',
          jitter: 0.035,
        });
      }
      const mesh = new THREE.Mesh(mergeParts(parts, rnd), this.cloudMat);
      const a = rnd() * Math.PI * 2, dist = 220 + rnd() * 330;
      mesh.position.set(Math.cos(a) * dist, 90 + rnd() * 70, Math.sin(a) * dist);
      mesh.rotation.y = rnd() * Math.PI;
      mesh.scale.setScalar(1 + rnd() * 1.3);
      this.clouds.add(mesh);
    }
    this.scene.add(this.clouds);
  }

  // While the camera is underwater, the sky behind the surface becomes the water colour.
  setUnder(amount, color) {
    this.under = amount;
    HAZE.hazeSun.value[3] = 1 - amount;
    this.skyUniforms.uUnder.value = amount;
    this.skyUniforms.uUnderColor.value.copy(color);
  }

  // How far the shadows reach around their centre (metres each way): closer in, they're sharper.
  setShadowSpan(half) {
    const sc = this.light.shadow.camera;
    if (sc.right === half) return;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.updateProjectionMatrix();
  }

  setShadows(on, size) {
    const l = this.light;
    l.castShadow = on;
    if (l.shadow.mapSize.x !== size) {
      l.shadow.mapSize.set(size, size);
      if (l.shadow.map) {
        l.shadow.map.dispose();
        l.shadow.map = null;
      }
    }
  }

  sample(hour) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    let t = clamp((hour - a.h) / (b.h - a.h), 0, 1);
    t = t * t * (3 - 2 * t);
    this.zenith.lerpColors(a.zen, b.zen, t);
    this.horizon.lerpColors(a.hor, b.hor, t);
    this.sunColor.lerpColors(a.sun, b.sun, t);
    this.skyCol.lerpColors(a.sky, b.sky, t);
    this.gndCol.lerpColors(a.gnd, b.gnd, t);
    this.sunI = lerp(a.sunI, b.sunI, t);
    this.hemiI = lerp(a.hemiI, b.hemiI, t);
  }

  // cloud: how much of the sky is covered (0–1); rain: how hard it rains (0–1). An overcast sky
  // greys the light even when it's dry.
  update(dt, t, hour, rain, focus, camera, renderer, cloud = rain) {
    this.rain = rain;
    this.cloud = cloud;
    const gloom = Math.max(rain, cloud * 0.72);
    this.sample(hour);

    if (gloom > 0.001) {
      towardsGrey(this.zenith, gloom * 0.7, 0.85);
      towardsGrey(this.horizon, gloom * 0.65, 0.9);
      towardsGrey(this.skyCol, gloom * 0.5, 0.9);
      towardsGrey(this.sunColor, gloom * 0.4, 1);
      this.sunI *= 1 - 0.65 * gloom;
      this.hemiI *= 1 + 0.12 * gloom; // (the light comes from the whole sky, softly)
    }
    // A storm: the whole sky dark slate, the light dim and cold.
    if (this.storm > 0.001) {
      const k = this.storm;
      towardsGrey(this.zenith, k * 0.6, 0.6);
      towardsGrey(this.horizon, k * 0.6, 0.72);
      this.zenith.multiplyScalar(1 - 0.5 * k);
      this.horizon.multiplyScalar(1 - 0.42 * k);
      this.skyCol.multiplyScalar(1 - 0.35 * k);
      this.sunColor.lerp(_cold, 0.5 * k);
    }

    // The sun rises in the east (+x), crosses the southern sky and sets in the west.
    const df = (hour - 5.6) / 14;
    const el = Math.sin(df * Math.PI);
    const az = df * Math.PI;
    this.sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * 0.5 * Math.cos(el)).normalize();

    const up = this.sunDir.y;
    this.daylight = smoothstep(-0.08, 0.12, up);
    this.night = 1 - smoothstep(-0.2, 0.04, up);
    this.lantern = clamp(1 - smoothstep(0.04, 0.28, up) + gloom * 0.35, 0, 1);

    _v.copy(this.sunDir);
    if (_v.y < 0.12) { _v.y = 0.12; _v.normalize(); }
    this.lightDir.copy(this.moonDir).lerp(_v, this.daylight).normalize();

    const light = this.light;
    light.color.copy(this.sunColor);
    light.intensity = this.sunI;
    light.position.copy(focus).addScaledVector(this.lightDir, 180);
    light.target.position.copy(focus);
    // A storm darkens the day further; lightning lights everything for an instant.
    if (this.storm > 0.001) {
      light.intensity *= 1 - 0.45 * this.storm;
      this.hemiI *= 1 - 0.3 * this.storm;
    }
    light.intensity += this.flash * 2.2;
    this.hemi.color.copy(this.skyCol);
    this.hemi.groundColor.copy(this.gndCol);
    this.hemi.intensity = this.hemiI + this.flash * 3.5;

    const fog = this.scene.fog;
    const low = (1 - smoothstep(0.04, 0.45, this.sunDir.y)) * this.daylight * (1 - gloom * 0.7);
    // The haze, the sky's along the horizon (see HAZE): its colours as the dome makes them there.
    const H = this.horizon, Z = this.zenith, S = this.sunColor, g = low, Hz = HAZE;
    const sunVis = smoothstep(-0.12, 0.02, this.sunDir.y) * (1 - gloom * 0.8);
    Hz.hazeSun.value.set([this.sunDir.x, this.sunDir.y, this.sunDir.z, 1 - this.under]);
    _haze.copy(Z).multiplyScalar(1.15).add(_dusk).lerp(_hA.copy(H), 1 - 0.42 * g).toArray(Hz.hazeAway.value);
    _haze.copy(H).multiplyScalar(1.04).add(_hA.copy(S).multiplyScalar(0.1 * g)).toArray(Hz.hazeToward.value);
    _haze.copy(S).multiplyScalar(0.22 * g).toArray(Hz.hazeGlow.value);
    _haze.copy(S).multiplyScalar(sunVis).toArray(Hz.hazeHalo.value);
    // (A storm's sky low and dark right down to the horizon; lightning lighting the haze.)
    _haze.copy(H).multiplyScalar(0.55).toArray(Hz.hazeDark.value);
    Hz.hazeDark.value[3] = this.storm * 0.74;
    _flashC.toArray(Hz.hazeFlash.value);
    Hz.hazeFlash.value[3] = this.flash * 0.5;
    // (And as one colour, the way you're looking, for what reads the fog's: what the haze hides
    // ahead, and the water closing over it when you dive.)
    camera.getWorldDirection(_f);
    hazeAt(_f.x, _f.z, fog.color);
    // Early mornings are hazier, before the day warms up.
    const morning = smoothstep(4.5, 5.8, hour) * (1 - smoothstep(7.5, 10, hour));
    fog.density = this.fogBase * (this.air + rain * 2.1 + cloud * 0.25 + morning * 0.65 + this.storm * 0.6);

    const su = this.skyUniforms;
    su.uSunColor.value.copy(this.sunColor);
    su.uNight.value = this.night;
    su.uRain.value = gloom;
    su.uGlow.value = low;
    su.uTime.value = t;
    su.uFlash.value = this.flash;
    su.uFlashDir.value.copy(this.flashDir);
    su.uStorm.value = this.storm;
    this.sky.position.copy(camera.position);

    // The clouds drift with you across the sky; how many there are follows the cover.
    this.clouds.position.set(camera.position.x, 0, camera.position.z);
    this.clouds.rotation.y += dt * 0.0035;
    const shown = Math.round(2 + cloud * (this.clouds.children.length - 2));
    this.clouds.children.forEach((c, i) => { c.visible = i < shown; });
    this.cloudMat.color.setRGB(1, 1, 1).lerp(this.horizon, 0.2);
    if (gloom > 0) towardsGrey(this.cloudMat.color, gloom * 0.6, 0.75);
    this.cloudMat.emissive.copy(this.horizon).multiplyScalar(0.42 * (1 - gloom * 0.5));

    renderer.toneMappingExposure = 1.0 + this.night * 0.3;
  }
}
