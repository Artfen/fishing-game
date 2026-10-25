import * as THREE from 'three';
import { MAP_GLSL } from './water.js';
import { smoothstep } from '../util.js';

// Morning mist: a few soft, slowly drifting layers just above the water. It gathers over the
// still lake and the stream before dawn, thins over the sea, and burns off by mid-morning,
// with a lighter veil again late in the evening. Lit warm on the side facing a low sun.

const vert = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
${MAP_GLSL}
uniform float uTime;
uniform float uAmount;
uniform float uLayer;
uniform vec3 uColor;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
varying vec3 vWorld;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec4 hs = worldMap(vWorld.xz);
  float ground = hs.r, fresh = hs.g;
  // Over water and the lowest ground only, thickest over still fresh water.
  float mask = smoothstep(0.9, -0.5, ground) * mix(0.45, 1.0, fresh);
  vec2 q = vWorld.xz * 0.045 + vec2(uTime * 0.012, uTime * 0.007) + uLayer * 3.7;
  float n = vnoise(q) * 0.55 + vnoise(q * 2.3 - uTime * 0.01) * 0.3 + vnoise(q * 5.1 + uTime * 0.02) * 0.15;
  float a = smoothstep(0.32, 0.8, n) * mask * uAmount;
  vec3 toP = vWorld - cameraPosition;
  float d = length(toP);
  // Fade out right around you (so it never looks like a flat sheet) and far away.
  a *= smoothstep(2.5, 12.0, d) * (1.0 - smoothstep(120.0, 230.0, d));
  float glow = pow(max(dot(toP / d, uSunDir), 0.0), 6.0);
  vec3 col = mix(uColor, uSunColor, glow * 0.7);
  gl_FragColor = vec4(col, a * (0.55 - uLayer * 0.12));
  #include <colorspace_fragment>
}
`;

const HEIGHTS = [0.35, 0.9, 1.6];

export function createMist(heightTex, rect, detailTex, detailRect) {
  const group = new THREE.Group();
  const shared = {
    uTime: { value: 0 },
    uAmount: { value: 0 },
    uColor: { value: new THREE.Color('#eef2f2') },
    uSunColor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uHeight: { value: heightTex },
    uRect: { value: new THREE.Vector4(rect.x, rect.z, rect.w, rect.h) },
    uHeight2: { value: detailTex },
    uRect2: { value: new THREE.Vector4(detailRect.x, detailRect.z, detailRect.w, detailRect.h) },
  };
  const layers = HEIGHTS.map((y, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(460, 460).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { ...shared, uLayer: { value: i } },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    m.position.y = y;
    m.renderOrder = 6;
    m.frustumCulled = false;
    group.add(m);
    return m;
  });
  let count = 3;

  return {
    group,
    uniforms: shared,
    // How many layers to draw (graphics setting).
    setLayers(n) { count = n; },
    // How misty it is at this hour (0..1).
    amount(hour, rain) {
      const dawn = smoothstep(4, 5.4, hour) * (1 - smoothstep(7.6, 9.6, hour));
      const night = (1 - smoothstep(3.5, 5, hour)) * 0.32 + smoothstep(19.5, 21.5, hour) * 0.42;
      return Math.max(dawn, night) * (1 - rain * 0.5);
    },
    update(t, hour, env, camera) {
      const k = this.amount(hour, env.rain);
      shared.uTime.value = t;
      shared.uAmount.value = k;
      shared.uColor.value.copy(env.horizon).lerp(env.skyCol, 0.3).lerp(new THREE.Color(1, 1, 1), 0.35 * env.daylight);
      shared.uSunColor.value.copy(env.sunColor).multiplyScalar(0.9 * env.daylight).add(shared.uColor.value.clone().multiplyScalar(0.4));
      shared.uSunDir.value.copy(env.sunDir);
      layers.forEach((m, i) => {
        m.visible = k > 0.01 && i < count && camera.position.y > -0.2;
        m.position.x = Math.round(camera.position.x / 4) * 4;
        m.position.z = Math.round(camera.position.z / 4) * 4;
      });
    },
  };
}
