import * as THREE from 'three';
import { SIM, ringBump } from './ripplesim.js';
import { MAP_GLSL } from './water.js';
import { PIERS } from './terrain.js';

// (W7) The rings simulated round you, on the graphics card: the steps of ripplesim.js (the
// reference they're tested against), on a square of SIM.N cells, SIM.SPAN metres across, that
// follows the ripple field's focus (between you and your line, or a little ahead of you).
//
// Each frame:
//  · the walls: where the ground is above the water (the map the water draws by, at the tide),
//    the stone quays and the pontoons (terrain.js PIERS), the posts of the timber piers (the
//    water runs under their decks), and every boat's hull where she floats (her shape along her
//    length);
//  · the square moved by whole cells if the focus has moved (the water keeps its place in the
//    world), and the rings begun since the last frame added in, as bumps (ringBump);
//  · a step for each 1/60 s of game time (up to SIM.STEPS);
//  · then, drawn into the ripple field with the rest (waterfx.js RippleField), the water's height
//    over the square, faded out over the band at its edge that soaks the rings up.
//
// Heights are held in a float texture: r now, g a step ago.

const MAX_PIERS = 16, MAX_HULLS = 12, MAX_BUMPS = 8;
// A hull's half-breadth at these points along her (stern to bow).
const HULL_AT = [0.02, 0.2, 0.4, 0.6, 0.8, 0.98];

// Her half-breadth t of the way from stern to bow: straight between the points, to nothing at
// either end.
const HULL_GLSL = (() => {
  const T = HULL_AT, W = ['b.y', 'b.z', 'b.w', 'c.x', 'c.y', 'c.z'], f = (v) => v.toFixed(2);
  let g = `float hullHalf(vec4 b, vec4 c, float t) {\n  if (t < ${f(T[0])}) return b.y * t / ${f(T[0])};\n`;
  for (let k = 1; k < T.length; k++) g += `  if (t < ${f(T[k])}) return mix(${W[k - 1]}, ${W[k]}, (t - ${f(T[k - 1])}) / ${f(T[k] - T[k - 1])});\n`;
  return g + `  return c.z * (1.0 - t) / ${f(1 - T[T.length - 1])};\n}`;
})();

const passVert = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Water (1) or wall (0), each cell.
const maskFrag = /* glsl */ `
${MAP_GLSL}
uniform vec2 uOrigin;   // cell (0, 0)'s middle, world x, z
uniform float uDx;
uniform float uTide;
uniform vec4 uPiers[${MAX_PIERS}]; // x0, z0, x1, z1
uniform vec4 uPosts[${MAX_PIERS}]; // a pier on posts: (first, step, inset, radius); radius 0: solid
uniform int uPierN;
// Whether p is in one of a pier's posts (two rows along its length: terrain.js PIERS posts).
bool onPost(vec2 p, vec4 r, vec4 q) {
  bool alongX = r.z - r.x > r.w - r.y;
  float len = alongX ? r.z - r.x : r.w - r.y, w = alongX ? r.w - r.y : r.z - r.x;
  float u = alongX ? p.x - r.x : p.y - r.y;
  float v = abs(alongX ? p.y - (r.y + r.w) * 0.5 : p.x - (r.x + r.z) * 0.5) - (w * 0.5 - q.z);
  float k = clamp(floor((u - q.x) / q.y + 0.5), 0.0, floor((len - q.x) / q.y));
  float du = u - (q.x + k * q.y);
  return du * du + v * v < q.w * q.w;
}
uniform vec4 uHulls[${MAX_HULLS * 3}]; // (x, z, ahead x, ahead z), (length, half-breadths…), (…)
uniform int uHullN;
${HULL_GLSL}
void main() {
  vec2 p = uOrigin + floor(gl_FragCoord.xy) * uDx;
  vec4 m = worldMap(p);
  float water = uTide * (1.0 - m.g) - m.r > 0.02 ? 1.0 : 0.0;
  for (int k = 0; k < ${MAX_PIERS}; k++) {
    if (k >= uPierN) break;
    vec4 r = uPiers[k], q = uPosts[k];
    if (q.w > 0.0 ? onPost(p, r, q) : p.x > r.x && p.x < r.z && p.y > r.y && p.y < r.w) water = 0.0;
  }
  for (int k = 0; k < ${MAX_HULLS}; k++) {
    if (k >= uHullN) break;
    vec4 a = uHulls[k * 3], b = uHulls[k * 3 + 1], c = uHulls[k * 3 + 2];
    vec2 d = p - a.xy;
    float t = dot(d, a.zw) / b.x + 0.5;
    if (t > 0.0 && t < 1.0 && abs(a.z * d.y - a.w * d.x) < hullHalf(b, c, t)) water = 0.0;
  }
  gl_FragColor = vec4(water, 0.0, 0.0, 1.0);
}
`;

// The square moved by whole cells, and new rings added (ripplesim.js scroll, bump).
const injectFrag = /* glsl */ `
uniform sampler2D uState;
uniform ivec2 uShift;
uniform int uN;
uniform vec4 uBumps[${MAX_BUMPS}]; // cell x, y (fractional), radius (cells), height
uniform int uBumpN;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy), s = c + uShift;
  vec2 v = s.x >= 0 && s.y >= 0 && s.x < uN && s.y < uN ? texelFetch(uState, s, 0).rg : vec2(0.0);
  for (int k = 0; k < ${MAX_BUMPS}; k++) {
    if (k >= uBumpN) break;
    vec4 b = uBumps[k];
    vec2 e = vec2(c) - b.xy;
    vec2 off = abs(vec2(c) - floor(b.xy + 0.5));
    if (max(off.x, off.y) <= ceil(3.0 * b.z)) v += b.w * exp(-dot(e, e) / (b.z * b.z));
  }
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

// One step (ripplesim.js step).
const stepFrag = /* glsl */ `
uniform sampler2D uState;
uniform sampler2D uMask;
uniform int uN;
uniform float uR;    // (c dt / dx)²
uniform float uDt;
uniform float uDamp, uEdgeDamp;
uniform int uEdge;   // cells
float side(ivec2 q, float hc) {
  if (q.x < 0 || q.y < 0 || q.x >= uN || q.y >= uN) return hc;
  if (texelFetch(uMask, q, 0).r < 0.5) return hc;
  return texelFetch(uState, q, 0).r;
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 s = texelFetch(uState, c, 0).rg;
  float hc = s.x;
  if (texelFetch(uMask, c, 0).r < 0.5) {
    gl_FragColor = vec4(0.0, hc, 0.0, 1.0);
    return;
  }
  // (All eight neighbours, so a ring stays round: ripplesim.js step.)
  float lap = (4.0 * (side(c - ivec2(1, 0), hc) + side(c + ivec2(1, 0), hc) + side(c - ivec2(0, 1), hc) + side(c + ivec2(0, 1), hc))
    + side(c + ivec2(-1, -1), hc) + side(c + ivec2(1, -1), hc) + side(c + ivec2(-1, 1), hc) + side(c + ivec2(1, 1), hc) - 20.0 * hc) / 6.0;
  int d = min(min(c.x, c.y), min(uN - 1 - c.x, uN - 1 - c.y));
  float gam = uDamp;
  if (d < uEdge) {
    float u = 1.0 - float(d) / float(uEdge);
    gam = uDamp + (uEdgeDamp - uDamp) * u * u;
  }
  float g = gam * uDt * 0.5;
  gl_FragColor = vec4((2.0 * hc - (1.0 - g) * s.y + uR * lap) / (1.0 + g), hc, 0.0, 1.0);
}
`;

// Drawn into the ripple field: the square's heights (bilinear), faded out over its soaking band.
const showVert = /* glsl */ `
uniform vec2 uOrigin;
uniform float uDx;
uniform int uN;
varying vec2 vCell;
void main() {
  vec2 w = uOrigin - 0.5 * uDx + (position.xy * 0.5 + 0.5) * float(uN) * uDx;
  vCell = (w - uOrigin) / uDx;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 0.0, 1.0);
}
`;
const showFrag = /* glsl */ `
uniform sampler2D uState;
uniform int uN;
uniform float uEdge;  // cells
uniform float uMost;
varying vec2 vCell;
float at(ivec2 q) { return texelFetch(uState, clamp(q, ivec2(0), ivec2(uN - 1)), 0).r; }
void main() {
  vec2 f = floor(vCell), t = vCell - f;
  ivec2 q = ivec2(f);
  float h = mix(mix(at(q), at(q + ivec2(1, 0)), t.x), mix(at(q + ivec2(0, 1)), at(q + ivec2(1, 1)), t.x), t.y);
  float d = min(min(vCell.x, vCell.y), min(float(uN - 1) - vCell.x, float(uN - 1) - vCell.y));
  gl_FragColor = vec4(clamp(h, -uMost, uMost) * smoothstep(0.4 * uEdge, uEdge, d), 0.0, 0.0, 1.0);
}
`;

export class RippleSim {
  // map: the water's map uniforms (uHeight, uRect, uHeight2, uRect2) and tide (uTideLevel), shared.
  constructor(map, tide, opts = {}) {
    this.s = { ...SIM, ...opts };
    this.dx = this.s.SPAN / this.s.N;
    this.piers = opts.piers || PIERS;
    this.state = null;   // two targets, ping-pong
    this.mask = null;
    this.i0 = 0;         // cell (0, 0) is world (i0·dx, j0·dx)
    this.j0 = 0;
    this.fresh = true;   // nothing in it yet
    this.pending = 0;    // game time not yet stepped (s)
    this.bumps = [];     // rings begun, to add: world x, z, height
    this.live = 0;       // seconds since the last ring (none left after a while)
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    const N = this.s.N, edge = Math.max(1, Math.round(this.s.EDGE * N));
    this.edge = edge;
    this.maskMat = new THREE.ShaderMaterial({
      vertexShader: passVert, fragmentShader: maskFrag, depthTest: false, depthWrite: false,
      uniforms: {
        ...map, uTide: tide,
        uOrigin: { value: new THREE.Vector2() }, uDx: { value: this.dx },
        uPiers: { value: Array.from({ length: MAX_PIERS }, () => new THREE.Vector4()) },
        uPosts: { value: Array.from({ length: MAX_PIERS }, () => new THREE.Vector4()) }, uPierN: { value: 0 },
        uHulls: { value: Array.from({ length: MAX_HULLS * 3 }, () => new THREE.Vector4()) }, uHullN: { value: 0 },
      },
    });
    this.injectMat = new THREE.ShaderMaterial({
      vertexShader: passVert, fragmentShader: injectFrag, depthTest: false, depthWrite: false,
      uniforms: {
        uState: { value: null }, uShift: { value: [0, 0] }, uN: { value: N },
        uBumps: { value: Array.from({ length: MAX_BUMPS }, () => new THREE.Vector4()) }, uBumpN: { value: 0 },
      },
    });
    const S = this.s;
    this.stepMat = new THREE.ShaderMaterial({
      vertexShader: passVert, fragmentShader: stepFrag, depthTest: false, depthWrite: false,
      uniforms: {
        uState: { value: null }, uMask: { value: null }, uN: { value: N },
        uR: { value: ((S.C * S.DT) / this.dx) ** 2 }, uDt: { value: S.DT },
        uDamp: { value: S.DAMP }, uEdgeDamp: { value: S.EDGE_DAMP }, uEdge: { value: edge },
      },
    });
    // (Drawn into the ripple field's scene: see waterfx.js setSim.)
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: showVert, fragmentShader: showFrag,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      depthTest: false, depthWrite: false, transparent: true,
      uniforms: {
        uState: { value: null }, uOrigin: { value: new THREE.Vector2() }, uDx: { value: this.dx }, uN: { value: N },
        uEdge: { value: edge }, uMost: { value: S.MOST },
      },
    }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get on() { return !!this.state; }

  // Turn it on (if the graphics card can hold and draw into float heights) or off.
  setOn(on, renderer) {
    if (!on) {
      this.dispose();
      return false;
    }
    if (this.state) return true;
    const ext = renderer.extensions;
    const type = !renderer.capabilities.isWebGL2 ? null
      : ext.has('EXT_color_buffer_float') ? THREE.FloatType
        : ext.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : null;
    if (!type) return false;
    const N = this.s.N;
    const target = (t) => {
      const r = new THREE.WebGLRenderTarget(N, N, { type: t, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      r.texture.generateMipmaps = false;
      return r;
    };
    this.state = [target(type), target(type)];
    this.mask = target(THREE.UnsignedByteType);
    this.fresh = true;
    return true;
  }

  dispose() {
    for (const r of this.state || []) r.dispose();
    this.mask?.dispose();
    this.state = null;
    this.mask = null;
    this.bumps.length = 0;
    this.mesh.visible = false;
  }

  // Inside the part of the square the rings run in (not its soaking band).
  inside(x, z) {
    const i = x / this.dx - this.i0, j = z / this.dx - this.j0, e = this.edge, N = this.s.N;
    return i >= e && j >= e && i <= N - 1 - e && j <= N - 1 - e;
  }

  // A ring begun at (x, z) (as waterfx.js RippleField add): taken (true) if it's in the square.
  take(x, z, size, str) {
    if (!this.on || this.fresh || !this.inside(x, z)) return false;
    if (this.bumps.length >= 64) this.bumps.shift();
    this.bumps.push({ x, z, h: ringBump(size, str, this.s) });
    return true;
  }

  // Game time passing (steps are taken when it's drawn).
  advance(dt) {
    if (this.on) this.pending += dt;
  }

  // Ready to draw into the ripple field this frame: whether there's anything to draw.
  show() {
    this.mesh.visible = this.on && !this.fresh && this.live < 60;
    return this.mesh.visible;
  }

  // The frame's work: walls, the square moved, new rings, the steps. (cx, cz): the focus. hulls:
  // the boats afloat (pos, fwd, hull).
  update(renderer, cx, cz, hulls = []) {
    if (!this.on) return;
    const S = this.s, N = S.N, dx = this.dx;
    const i0 = Math.round((cx - S.SPAN / 2) / dx), j0 = Math.round((cz - S.SPAN / 2) / dx);
    let di = i0 - this.i0, dj = j0 - this.j0;
    const prev = renderer.getRenderTarget();
    if (this.fresh || Math.abs(di) >= N || Math.abs(dj) >= N) {
      // (Starting, or moved right away: still water.)
      const c = renderer.getClearColor(new THREE.Color()), a = renderer.getClearAlpha();
      renderer.setClearColor(0x000000, 0);
      for (const r of this.state) {
        renderer.setRenderTarget(r);
        renderer.clear(true, false, false);
      }
      renderer.setClearColor(c, a);
      this.fresh = false;
      this.bumps.length = 0;
      this.pending = 0;
      this.live = 60;
      di = dj = 0;
    }
    this.i0 = i0;
    this.j0 = j0;
    const x0 = i0 * dx, z0 = j0 * dx, x1 = x0 + (N - 1) * dx, z1 = z0 + (N - 1) * dx;

    // The steps to take.
    let steps = Math.floor(this.pending / S.DT);
    if (steps > S.STEPS) {
      steps = S.STEPS;
      this.pending = 0;
    } else this.pending -= steps * S.DT;
    // (Once the last ring has died away, a minute on, nothing's left to step.)
    if (this.live >= 60 && !this.bumps.length) steps = 0;

    // The walls.
    const MU = this.maskMat.uniforms;
    MU.uOrigin.value.set(x0, z0);
    let n = 0;
    for (const Q of this.piers) {
      if (n >= MAX_PIERS || Q.x1 < x0 || Q.x0 > x1 || Q.z1 < z0 || Q.z0 > z1) continue;
      const T = Q.posts;
      MU.uPosts.value[n].set(T?.first || 0, T?.step || 1, T?.inset || 0, T?.r || 0);
      MU.uPiers.value[n++].set(Q.x0, Q.z0, Q.x1, Q.z1);
    }
    MU.uPierN.value = n;
    n = 0;
    // (The nearest first, if there are more than it takes.)
    const near = hulls.filter((b) => b.hull && b.pos && b.pos.x > x0 - b.hull.L && b.pos.x < x1 + b.hull.L && b.pos.z > z0 - b.hull.L && b.pos.z < z1 + b.hull.L);
    if (near.length > MAX_HULLS) near.sort((a, b) => Math.hypot(a.pos.x - cx, a.pos.z - cz) - Math.hypot(b.pos.x - cx, b.pos.z - cz));
    for (const b of near) {
      const H = b.hull, P = b.pos;
      if (n >= MAX_HULLS) break;
      const w = (H._rippleHalf ||= HULL_AT.map((t) => (typeof H.hw === 'function' ? H.B * H.hw(t) : H.B * 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.6)))));
      const f = b.fwd, fl = Math.hypot(f.x, f.z) || 1;
      MU.uHulls.value[n * 3].set(P.x, P.z, f.x / fl, f.z / fl);
      MU.uHulls.value[n * 3 + 1].set(H.L, w[0], w[1], w[2]);
      MU.uHulls.value[n * 3 + 2].set(w[3], w[4], w[5], 0);
      n++;
    }
    MU.uHullN.value = n;
    if (steps) this.pass(renderer, this.maskMat, this.mask);

    // The square moved, and the rings begun.
    const k = Math.min(this.bumps.length, MAX_BUMPS);
    if (di || dj || k) {
      const IU = this.injectMat.uniforms;
      IU.uState.value = this.state[0].texture;
      IU.uShift.value[0] = di;
      IU.uShift.value[1] = dj;
      for (let q = 0; q < k; q++) {
        const B = this.bumps[q];
        IU.uBumps.value[q].set(B.x / dx - i0, B.z / dx - j0, S.BUMP / dx, B.h);
      }
      IU.uBumpN.value = k;
      this.bumps.splice(0, k);
      this.pass(renderer, this.injectMat, this.state[1]);
      this.state.reverse();
      if (k) this.live = 0;
    }

    // The steps.
    this.live += steps * S.DT;
    const SU = this.stepMat.uniforms;
    SU.uMask.value = this.mask.texture;
    for (let q = 0; q < steps; q++) {
      SU.uState.value = this.state[0].texture;
      this.pass(renderer, this.stepMat, this.state[1]);
      this.state.reverse();
    }
    renderer.setRenderTarget(prev);

    const U = this.mesh.material.uniforms;
    U.uState.value = this.state[0].texture;
    U.uOrigin.value.set(x0, z0);
  }

  pass(renderer, mat, target) {
    this.quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.cam);
  }

  // The heights now (for tests): a Float32Array of N·N, row by row (z), and the origin.
  read(renderer) {
    const N = this.s.N, rgba = new Float32Array(N * N * 4), h = new Float32Array(N * N);
    renderer.readRenderTargetPixels(this.state[0], 0, 0, N, N, rgba);
    for (let q = 0; q < N * N; q++) h[q] = rgba[q * 4];
    return { h, x0: this.i0 * this.dx, z0: this.j0 * this.dx };
  }
}
