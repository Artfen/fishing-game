// Fine surface detail painted in the shader, so the low-poly world keeps its look but gains
// texture up close: grain and a wet band along the waterline on the ground, sand ripples on
// the shallow seabed, wood grain on planks and the boat, speckles on cork.
// Switched on and off with the graphics setting (surfaceUniforms.uDetail).

export const surfaceUniforms = {
  uDetail: { value: 1 },
  uWetTop: { value: 0.3 }, // how far up the shore the sand is wet
};

const NOISE = /* glsl */ `
uniform float uDetail;
uniform float uWetTop;
float sHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float sNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), u.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

const KINDS = {
  // World-space: the ground and seabed.
  ground: /* glsl */ `
    if (uDetail > 0.5) {
      vec3 sp = vSurfWorld;
      float lum = 1.0 + (sNoise(sp.xz * 1.3) - 0.5) * 0.1 + (sNoise(sp.xz * 6.0) - 0.5) * 0.07 + (sHash(floor(sp.xz * 24.0)) - 0.5) * 0.05;
      // Ripples in the sand under shallow water.
      float shallow = smoothstep(-0.15, -0.6, sp.y) * (1.0 - smoothstep(2.5, 9.0, -sp.y));
      lum += sin(dot(sp.xz, vec2(0.8, 0.6)) * 6.5 + sNoise(sp.xz * 0.45) * 7.0) * 0.045 * shallow;
      // Darker, cooler sand and mud just above the waterline where the water reaches.
      float wet = (1.0 - smoothstep(0.0, uWetTop + (sNoise(sp.xz * 0.7) - 0.5) * 0.15, sp.y)) * step(-0.2, sp.y);
      diffuseColor.rgb *= lum * mix(1.0, 0.72, wet);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.93, 0.98, 1.05), wet);
    }`,
  // Object-space wood: grain along GRAIN_AXIS, with plank seams every SEAM metres up the side.
  wood: /* glsl */ `
    if (uDetail > 0.5) {
      vec3 q = vSurfLocal;
      float along = GRAIN_AXIS == 0 ? q.x : q.z;
      float across = GRAIN_AXIS == 0 ? q.z : q.x;
      float grain = sNoise(vec2(along * 1.4, across * 26.0 + q.y * 26.0));
      float fine = sNoise(vec2(along * 5.0, across * 80.0 + q.y * 80.0));
      float lum = 0.9 + grain * 0.14 + fine * 0.05;
      #if SEAM > 0
        float f = fract(q.y / (float(SEAM) * 0.01));
        lum *= mix(0.8, 1.0, smoothstep(0.0, 0.07, f) * smoothstep(1.0, 0.93, f));
      #endif
      diffuseColor.rgb *= lum;
    }`,
  // Cork handles: little dark pits.
  cork: /* glsl */ `
    if (uDetail > 0.5) {
      vec3 q = vSurfLocal * 90.0;
      float pit = smoothstep(0.72, 0.9, sNoise(q.xy + q.z)) * 0.35;
      diffuseColor.rgb *= (0.92 + sNoise(q.yz * 0.5) * 0.12) * (1.0 - pit);
    }`,
};

// kind: 'ground' | 'wood' | 'cork'. For wood: axis 'x' or 'z' (the way the grain runs, in the
// object's own space) and seam (plank height in cm, 0 for none).
export function withSurface(material, kind, { axis = 'z', seam = 0 } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.uniforms.uDetail = surfaceUniforms.uDetail;
    shader.uniforms.uWetTop = surfaceUniforms.uWetTop;
    shader.defines = { ...(shader.defines || {}), GRAIN_AXIS: axis === 'x' ? 0 : 1, SEAM: seam };
    shader.vertexShader = 'varying vec3 vSurfWorld;\nvarying vec3 vSurfLocal;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vSurfLocal = transformed;
      vec4 sw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        sw = instanceMatrix * sw;
      #endif
      vSurfWorld = (modelMatrix * sw).xyz;`);
    shader.fragmentShader = 'varying vec3 vSurfWorld;\nvarying vec3 vSurfLocal;\n' + NOISE + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      ${KINDS[kind]}`);
  };
  const prevKey = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${prevKey ? prevKey.call(material) : ''}-surface-${kind}-${axis}-${seam}`;
  return material;
}
