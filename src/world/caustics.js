// Dancing light on the seabed. Patches a Lambert material so anything below the
// waterline (terrain, rocks) picks up soft caustics that fade with depth.
export const causticUniforms = {
  uCausticTime: { value: 0 },
  uCaustic: { value: 1 },
};

const CAUSTIC_GLSL = /* glsl */ `
uniform float uCausticTime;
uniform float uCaustic;
varying vec3 vCausticPos;
float causticLayer(vec2 p, float t) {
  float a = sin(p.x * 1.7 + sin(p.y * 1.3 + t * 0.9) * 1.6 + t * 0.7);
  float b = sin(p.y * 1.9 + sin(p.x * 1.1 - t * 0.8) * 1.4 - t * 0.6);
  return pow(1.0 - abs(a * b), 7.0);
}
float causticAt(vec2 p, float t) {
  return causticLayer(p * 0.55, t) * 0.6 + causticLayer(p * 0.9 + 3.7, t * 1.3) * 0.4;
}
`;

export function withCaustics(material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.uniforms.uCausticTime = causticUniforms.uCausticTime;
    shader.uniforms.uCaustic = causticUniforms.uCaustic;
    shader.vertexShader = 'varying vec3 vCausticPos;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 cpw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        cpw = instanceMatrix * cpw;
      #endif
      vCausticPos = (modelMatrix * cpw).xyz;`);
    shader.fragmentShader = CAUSTIC_GLSL + shader.fragmentShader.replace('#include <opaque_fragment>', `
      float cDepth = -vCausticPos.y;
      float cMask = smoothstep(0.05, 0.6, cDepth) * (1.0 - smoothstep(4.0, 16.0, cDepth)) * uCaustic;
      if (cMask > 0.001) outgoingLight += diffuseColor.rgb * causticAt(vCausticPos.xz, uCausticTime) * cMask * 0.6;
      #include <opaque_fragment>`);
  };
  const prevKey = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${prevKey ? prevKey.call(material) : ''}-caustics`;
  return material;
}
