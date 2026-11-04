import * as THREE from 'three';
import { SHORT, ShortSpectrum } from './ocean.js';

// The sea's short waves, from about eight metres down to a few centimetres, worked out on the
// graphics card each frame (Ocean: Full in Settings): the texture of the water close by, its
// glitter in the sun, and the lacing in the foam. The same spectrum as the long waves (ocean.js),
// handed over smoothly where they leave off; summed by a fast Fourier transform done in passes
// over a 128 × 128 grid (Stockham's autosort form: each pass reads two values and writes one, the
// order coming out right by itself). Only for the eye: the physics feels the long waves alone.
//
// Out of it come two textures the water shader reads, tiled over the sea (and mipmapped, so far
// off they blur rather than glitter): displacement (height and the to-and-fro, x and z) and the
// slopes, with how pinched each crest is (for the foam).

const N = SHORT.N, LOG = Math.log2(N);
const TAU = Math.PI * 2;

const quadVert = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Each wave's state at time t: four complex fields, two to a texture (see the packing below).
const evolveFrag = /* glsl */ `
precision highp float;
uniform sampler2D uH0;   // h0(k) (r, i), conj h0(-k) (r, i)
uniform float uTime;
uniform float uL;
uniform int uWhich;      // 0: (h + i·hx, hz + i·Dx); 1: (Dz + i·Dxx, Dzz + i·Dxz)
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float n = ${N.toFixed(1)};
  vec2 m = vec2(c.x < ${N / 2} ? float(c.x) : float(c.x) - n, c.y < ${N / 2} ? float(c.y) : float(c.y) - n);
  vec2 kv = ${TAU.toFixed(6)} * m / uL;
  float k = length(kv);
  vec4 s = texelFetch(uH0, c, 0);
  float w = sqrt(9.81 * k), ph = w * uTime;
  vec2 e1 = cmul(s.xy, vec2(cos(ph), -sin(ph))), e2 = cmul(s.zw, vec2(cos(ph), sin(ph)));
  vec2 h = e1 + e2;
  vec2 ih = vec2(-h.y, h.x);          // i·h
  float kk = max(k, 1e-6);
  vec2 hx = ih * kv.x, hz = ih * kv.y;
  vec2 dx = -ih * (kv.x / kk), dz = -ih * (kv.y / kk);
  vec2 dxx = h * (kv.x * kv.x / kk), dzz = h * (kv.y * kv.y / kk), dxz = h * (kv.x * kv.y / kk);
  // (Two real fields to one complex: A + i·B.)
  vec2 a, b;
  if (uWhich == 0) {
    a = h + vec2(-hx.y, hx.x);
    b = hz + vec2(-dx.y, dx.x);
  } else {
    a = dz + vec2(-dxx.y, dxx.x);
    b = dzz + vec2(-dxz.y, dxz.x);
  }
  gl_FragColor = vec4(a, b);
}
`;

// One pass of the inverse transform, along rows (uDir 0) or columns (1).
const fftFrag = /* glsl */ `
precision highp float;
uniform sampler2D uSrc;
uniform float uSize;     // this pass's sub-transform size: 2, 4, … N
uniform int uDir;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float index = float(uDir == 0 ? c.x : c.y);
  float half_ = uSize * 0.5;
  float even = floor(index / uSize) * half_ + mod(index, half_);
  ivec2 ce = uDir == 0 ? ivec2(int(even), c.y) : ivec2(c.x, int(even));
  ivec2 co = uDir == 0 ? ivec2(int(even) + ${N / 2}, c.y) : ivec2(c.x, int(even) + ${N / 2});
  vec4 e = texelFetch(uSrc, ce, 0), o = texelFetch(uSrc, co, 0);
  float arg = ${TAU.toFixed(6)} * index / uSize;
  vec2 tw = vec2(cos(arg), sin(arg));
  gl_FragColor = vec4(e.xy + cmul(tw, o.xy), e.zw + cmul(tw, o.zw));
}
`;

// The two textures the water reads: (h, Dx, Dz, 0) and (hx, hz, J, 0).
const assembleFrag = /* glsl */ `
precision highp float;
uniform sampler2D uP;    // (h, hx | hz, Dx)
uniform sampler2D uQ;    // (Dz, Dxx | Dzz, Dxz)
uniform int uWhich;
uniform float uChop;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 p = texelFetch(uP, c, 0), q = texelFetch(uQ, c, 0);
  if (uWhich == 0) gl_FragColor = vec4(p.x, p.w, q.x, 0.0);
  else {
    float J = (1.0 + uChop * q.y) * (1.0 + uChop * q.z) - uChop * uChop * q.w * q.w;
    gl_FragColor = vec4(p.y, p.z, J, 0.0);
  }
}
`;

export class ShortSea {
  // Whether this browser can do it (float render targets).
  static supported(renderer) {
    return !!renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
  }

  constructor(renderer) {
    this.renderer = renderer;
    this.spectrum = new ShortSpectrum();
    const rt = (type, filter, mips) => {
      const t = new THREE.WebGLRenderTarget(N, N, { type, format: THREE.RGBAFormat, depthBuffer: false, magFilter: filter, minFilter: mips ? THREE.LinearMipmapLinearFilter : filter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
      t.texture.generateMipmaps = !!mips;
      return t;
    };
    const F = THREE.FloatType, H = THREE.HalfFloatType, NEAR = THREE.NearestFilter, LIN = THREE.LinearFilter;
    this.work = [rt(F, NEAR), rt(F, NEAR), rt(F, NEAR), rt(F, NEAR)];
    this.disp = rt(H, LIN, true);
    this.slope = rt(H, LIN, true);
    this.h0 = new THREE.DataTexture(this.spectrum.data, N, N, THREE.RGBAFormat, THREE.FloatType);
    this.h0.magFilter = this.h0.minFilter = NEAR;
    this.h0.needsUpdate = true;
    const mat = (frag, uniforms) => new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: 'precision highp float;\nin vec3 position;\n' + quadVert,
      fragmentShader: frag.replace(/gl_FragColor/g, 'outColor').replace('precision highp float;', 'precision highp float;\nprecision highp int;\nprecision highp sampler2D;\nout vec4 outColor;'),
      uniforms, depthTest: false, depthWrite: false,
    });
    this.evolve = mat(evolveFrag, { uH0: { value: this.h0 }, uTime: { value: 0 }, uL: { value: SHORT.L }, uWhich: { value: 0 } });
    this.fft = mat(fftFrag, { uSrc: { value: null }, uSize: { value: 2 }, uDir: { value: 0 } });
    this.assemble = mat(assembleFrag, { uP: { value: null }, uQ: { value: null }, uWhich: { value: 0 }, uChop: { value: 0.8 } });
    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.evolve);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.cam = new THREE.Camera();
    this.lastT = -1;
  }

  draw(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }

  // The short waves at time t for this wind (u m/s blowing towards `to`, the wind sea's energy m0),
  // crests carried along by `chop`.
  update(t, u, to, m0, chop) {
    if (this.spectrum.update(u, to, m0)) this.h0.needsUpdate = true;
    if (t === this.lastT) return;
    this.lastT = t;
    const r = this.renderer, prev = r.getRenderTarget(), auto = r.autoClear;
    r.autoClear = false;
    const [a, b, c, d] = this.work;
    // The waves' state now, in two packed textures.
    this.evolve.uniforms.uTime.value = t;
    this.evolve.uniforms.uWhich.value = 0;
    this.draw(this.evolve, a);
    this.evolve.uniforms.uWhich.value = 1;
    this.draw(this.evolve, c);
    // Back into the sea: rows, then columns, ping-ponging.
    const transform = (src, tmp) => {
      let from = src, to2 = tmp;
      for (let dir = 0; dir < 2; dir++) {
        for (let p = 0; p < LOG; p++) {
          this.fft.uniforms.uSrc.value = from.texture;
          this.fft.uniforms.uSize.value = 2 ** (p + 1);
          this.fft.uniforms.uDir.value = dir;
          this.draw(this.fft, to2);
          [from, to2] = [to2, from];
        }
      }
      return from;
    };
    const P = transform(a, b), Q = transform(c, d);
    this.assemble.uniforms.uP.value = P.texture;
    this.assemble.uniforms.uQ.value = Q.texture;
    this.assemble.uniforms.uChop.value = chop;
    this.assemble.uniforms.uWhich.value = 0;
    this.draw(this.assemble, this.disp);
    this.assemble.uniforms.uWhich.value = 1;
    this.draw(this.assemble, this.slope);
    r.setRenderTarget(prev);
    r.autoClear = auto;
  }

  dispose() {
    for (const t of [...this.work, this.disp, this.slope]) t.dispose();
    this.h0.dispose();
  }
}
