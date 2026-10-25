import * as THREE from 'three';

// The finishing pass for the Ultra and Cinematic graphics levels (see quality.js). The scene is
// drawn to the screen exactly as on High; then a copy of that picture is taken and laid back over
// it with:
//  · glow: only the brightest light (lamps, lit windows, the sun and its glints on the water, the
//    moon) is blurred into a soft halo round it;
//  · shafts (Cinematic): from a low sun in view, the glow is drawn out into soft rays across the
//    picture, strongest at sunrise and in the golden hour, gone in rain or when the sun's behind
//    you;
//  · colour: the hour's own grade, warmer as the sun goes down, a little cooler by moonlight, a
//    touch more colour on Cinematic, and a gentle darkening at the corners there.
// Everything that matters to play (fish, the line, the aiming ring, prompts and panels) is the
// same: the HUD is the page's, not drawn here, and nothing is blurred but light already near white.
// Where the browser can't do it (no WebGL 2), the levels simply go without it.

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// The bright parts only, a quarter or half the size: four taps so small glints don't flicker.
const BRIGHT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
vec3 bright(vec2 uv) {
  vec3 c = texture2D(tDiffuse, uv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return c * smoothstep(uThreshold, 1.0, l);
}
void main() {
  vec3 c = bright(vUv + uTexel * vec2(-1.0, -1.0)) + bright(vUv + uTexel * vec2(1.0, -1.0))
         + bright(vUv + uTexel * vec2(-1.0, 1.0)) + bright(vUv + uTexel * vec2(1.0, 1.0));
  gl_FragColor = vec4(c * 0.25, 1.0);
}
`;

// One direction of a nine-tap blur (run across, then down).
const BLUR = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
  c += texture2D(tDiffuse, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tDiffuse, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tDiffuse, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tDiffuse, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

// Rays from the sun: the bright sky right round the sun, smeared out from the sun's place in the
// picture. Trees, hills and boats in the way cut dark gaps in it, which is what makes the rays.
const SHAFTS = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uSun;
uniform float uAspect;
varying vec2 vUv;
float source(vec2 uv) {
  vec3 c = texture2D(tDiffuse, uv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec2 d = (uv - uSun) * vec2(uAspect, 1.0);
  return smoothstep(0.6, 0.95, l) * (1.0 - smoothstep(0.05, 0.32, length(d)));
}
void main() {
  vec2 step = (vUv - uSun) * (0.85 / 40.0);
  vec2 uv = vUv;
  float c = 0.0;
  float w = 1.0;
  for (int i = 0; i < 40; i++) {
    uv -= step;
    c += source(clamp(uv, 0.0, 1.0)) * w;
    w *= 0.955;
  }
  gl_FragColor = vec4(vec3(c / 14.0), 1.0);
}
`;

// Light is added the way a lens adds it (a "screen" blend): it brightens towards white but never
// burns past it.
const COMPOSITE = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tShafts;
uniform float uBloom;
uniform float uShafts;
uniform vec3 uShaftColor;
uniform vec3 uTint;
uniform float uSat;
uniform float uVignette;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  vec3 glow = texture2D(tBloom, vUv).rgb * uBloom;
  if (uShafts > 0.001) glow += texture2D(tShafts, vUv).rgb * uShaftColor * uShafts;
  c = 1.0 - (1.0 - c) * (1.0 - clamp(glow, 0.0, 1.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, uSat) * uTint, 0.0, 1.0);
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.1, 0.5, dot(q, q));
  gl_FragColor = vec4(c, 1.0);
}
`;

// How each level finishes the picture. scale: the glow's size against the screen; blurs: how
// soft it is; threshold: how near white light has to be to glow.
export const POST_MODES = {
  ultra: { scale: 0.25, blurs: 2, threshold: 0.84, bloom: 0.8, shafts: 0, sat: 1.04, vignette: 0 },
  cinematic: { scale: 0.5, blurs: 3, threshold: 0.8, bloom: 1.1, shafts: 0.7, sat: 1.08, vignette: 0.2 },
};

const _v2 = new THREE.Vector2();
const _sun = new THREE.Vector3();
const _origin = new THREE.Vector2();

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.mode = null;
    this.supported = !!renderer.capabilities?.isWebGL2;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // One triangle over the whole screen.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const mat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
    this.bright = mat(BRIGHT, { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0.9 } });
    this.blur = mat(BLUR, { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.shafts = mat(SHAFTS, { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 } });
    this.composite = mat(COMPOSITE, {
      tScene: { value: null }, tBloom: { value: null }, tShafts: { value: null },
      uBloom: { value: 0.5 }, uShafts: { value: 0 }, uShaftColor: { value: new THREE.Color(1, 0.85, 0.6) },
      uTint: { value: new THREE.Color(1, 1, 1) }, uSat: { value: 1 }, uVignette: { value: 0 },
    });
    this.quad = new THREE.Mesh(geo, this.bright);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.targets = null;
    this.failed = false;
  }

  get on() { return !!this.mode && this.supported && !this.failed; }

  // 'ultra', 'cinematic' or null (none: the scene goes straight to the screen).
  setMode(mode) {
    const m = POST_MODES[mode] ? mode : null;
    if (m === this.mode) return;
    this.mode = m;
    this.dispose();
  }

  dispose() {
    if (!this.targets) return;
    for (const t of Object.values(this.targets)) t.dispose();
    this.targets = null;
  }

  // Sized to the drawing buffer (checked every frame: cheap, and it follows the window and the
  // pixel ratio by itself).
  fit() {
    const P = POST_MODES[this.mode];
    this.renderer.getDrawingBufferSize(_v2);
    const w = Math.max(1, _v2.x), h = Math.max(1, _v2.y);
    const sw = Math.max(1, Math.round(w * P.scale)), sh = Math.max(1, Math.round(h * P.scale));
    const T = this.targets;
    if (T && T.copy.image.width === w && T.copy.image.height === h && T.a.width === sw && T.a.height === sh) return T;
    this.dispose();
    // The copy of the screen. (A canvas without its own transparency can only be copied into a
    // picture without one either.)
    const copy = new THREE.FramebufferTexture(w, h);
    copy.internalFormat = 'RGB8';
    copy.minFilter = copy.magFilter = THREE.LinearFilter;
    const opts = { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.targets = {
      copy,
      a: new THREE.WebGLRenderTarget(sw, sh, opts),
      b: new THREE.WebGLRenderTarget(sw, sh, opts),
      shafts: new THREE.WebGLRenderTarget(sw, sh, opts),
    };
    return this.targets;
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  // After the scene is drawn to the screen: finish it. look: { sunDir, sunColor, low (how low and
  // strong the sun is: 0 … 1), night (0 … 1), tint, sat }.
  finish(camera, look) {
    if (!this.on) return;
    const r = this.renderer, P = POST_MODES[this.mode];
    const T = this.fit();
    // (The first time, check the copy works: if this browser refuses it, it can't do the pass at
    // all, and stops trying, quietly. Only once: asking is slow.)
    const gl = this.checked ? null : r.getContext();
    if (gl) for (let i = 0; i < 8 && gl.getError() !== gl.NO_ERROR; i++);
    r.copyFramebufferToTexture(_origin, T.copy);
    if (gl) {
      this.checked = true;
      if (gl.getError() !== gl.NO_ERROR) {
        this.failed = true;
        this.dispose();
        return;
      }
    }
    const autoClear = r.autoClear;
    r.autoClear = false;
    // The glow.
    this.bright.uniforms.tDiffuse.value = T.copy;
    this.bright.uniforms.uTexel.value.set(1 / T.copy.image.width, 1 / T.copy.image.height);
    // (After dark, lamplight stands out against the night: the glow starts lower.)
    this.bright.uniforms.uThreshold.value = P.threshold * (1 - 0.32 * look.night);
    this.pass(this.bright, T.a);
    for (let i = 0; i < P.blurs; i++) {
      this.blur.uniforms.tDiffuse.value = T.a.texture;
      this.blur.uniforms.uDir.value.set((1 + i) / T.a.width, 0);
      this.pass(this.blur, T.b);
      this.blur.uniforms.tDiffuse.value = T.b.texture;
      this.blur.uniforms.uDir.value.set(0, (1 + i) / T.a.height);
      this.pass(this.blur, T.a);
    }
    // Shafts from a low sun in view.
    let shafts = 0;
    if (P.shafts && look.low > 0.02) {
      _sun.copy(look.sunDir).multiplyScalar(900).add(camera.position).project(camera);
      const ahead = _sun.z < 1 && Math.abs(_sun.x) < 1.8 && Math.abs(_sun.y) < 1.8;
      if (ahead) {
        shafts = P.shafts * look.low * clamp01(1.4 - Math.hypot(_sun.x, _sun.y) * 0.5);
        this.shafts.uniforms.tDiffuse.value = T.copy;
        this.shafts.uniforms.uSun.value.set(_sun.x * 0.5 + 0.5, _sun.y * 0.5 + 0.5);
        this.shafts.uniforms.uAspect.value = T.copy.image.width / T.copy.image.height;
        this.pass(this.shafts, T.shafts);
      }
    }
    const U = this.composite.uniforms;
    U.tScene.value = T.copy;
    U.tBloom.value = T.a.texture;
    U.tShafts.value = T.shafts.texture;
    U.uBloom.value = P.bloom;
    U.uShafts.value = shafts;
    U.uShaftColor.value.copy(look.sunColor);
    U.uTint.value.copy(look.tint);
    U.uSat.value = P.sat * look.sat;
    U.uVignette.value = P.vignette;
    this.pass(this.composite, null);
    r.autoClear = autoClear;
  }
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
