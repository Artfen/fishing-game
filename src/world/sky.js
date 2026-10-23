import * as THREE from 'three';
import { clamp, lerp, smoothstep, seeded, mergeParts, mat } from '../util.js';

// Hand-picked colours for each part of the day. Everything else is interpolated.
const KEYS = [
  { h: 0,    zen: '#0f1d3a', hor: '#2a3d66', sun: '#9cb2e4', sunI: 0.5, sky: '#53689e', gnd: '#1c2132', hemiI: 1.1 },
  { h: 4.4,  zen: '#17264f', hor: '#41507e', sun: '#9cb2e4', sunI: 0.5, sky: '#5a6a9e', gnd: '#202436', hemiI: 1.1 },
  { h: 5.8,  zen: '#4d679c', hor: '#eeb28e', sun: '#ffb27c', sunI: 1.4, sky: '#aaadc8', gnd: '#6e5a50', hemiI: 1.25 },
  { h: 7.5,  zen: '#5d97d3', hor: '#d3e3e6', sun: '#ffeccc', sunI: 2.5, sky: '#c2d8ec', gnd: '#8a7a5c', hemiI: 1.45 },
  { h: 12,   zen: '#4a8cd6', hor: '#d5ebf1', sun: '#fff6e4', sunI: 3.0, sky: '#cbe2f4', gnd: '#8e8060', hemiI: 1.55 },
  { h: 16,   zen: '#5690d0', hor: '#e9e3cb', sun: '#ffe4b4', sunI: 2.8, sky: '#cfdcea', gnd: '#8e7a5c', hemiI: 1.45 },
  { h: 18,   zen: '#6582c0', hor: '#f6c48e', sun: '#ffb168', sunI: 2.5, sky: '#d4bcc4', gnd: '#86624c', hemiI: 1.3 },
  { h: 19.3, zen: '#4f5498', hor: '#f29572', sun: '#ff8650', sunI: 1.7, sky: '#b48ca8', gnd: '#68484a', hemiI: 1.2 },
  { h: 20.5, zen: '#283166', hor: '#8a6a8f', sun: '#b892c0', sunI: 0.8, sky: '#71699c', gnd: '#2c2638', hemiI: 1.15 },
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
  if (h < 19.5) return 'Golden hour';
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
varying vec3 vDir;
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.6));
  col = mix(col, uHorizon * 0.92, smoothstep(0.0, -0.2, h));

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

  col = mix(col, uUnderColor, uUnder);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const _grey = new THREE.Color();
const _haze = new THREE.Color();

function towardsGrey(c, amt, dark) {
  const l = (c.r * 0.3 + c.g * 0.59 + c.b * 0.11) * dark;
  _grey.setRGB(l * 0.96, l, l * 1.04);
  c.lerp(_grey, amt);
}

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.fogBase = 0.0021; // haze on a clear day; rain, cloud and early mornings thicken it
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
      this.hemiI *= 1 - 0.08 * gloom;
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
    this.hemi.color.copy(this.skyCol);
    this.hemi.groundColor.copy(this.gndCol);
    this.hemi.intensity = this.hemiI;

    const fog = this.scene.fog;
    fog.color.copy(this.horizon).lerp(this.zenith, 0.08);
    // Looking towards a low sun, the haze glows warm; looking away, it stays cool.
    camera.getWorldDirection(_f);
    const fl = Math.hypot(_f.x, _f.z) || 1, sl = Math.hypot(this.sunDir.x, this.sunDir.z) || 1;
    const facing = Math.max(0, (_f.x * this.sunDir.x + _f.z * this.sunDir.z) / (fl * sl));
    const low = (1 - smoothstep(0.04, 0.45, this.sunDir.y)) * this.daylight * (1 - gloom * 0.7);
    fog.color.lerp(_haze.copy(this.sunColor).lerp(this.horizon, 0.4), facing * facing * facing * low * 0.45);
    // Early mornings are hazier, before the day warms up.
    const morning = smoothstep(4.5, 5.8, hour) * (1 - smoothstep(7.5, 10, hour));
    fog.density = this.fogBase * (1 + rain * 2.1 + cloud * 0.25 + morning * 0.65);

    const su = this.skyUniforms;
    su.uSunColor.value.copy(this.sunColor);
    su.uNight.value = this.night;
    su.uRain.value = gloom;
    su.uTime.value = t;
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
