import * as THREE from 'three';

// Two helpers that make the water respond to the world around it:
//
// Reflection: renders the scene as seen from below the water plane into a small texture,
// so the water can mirror the sky, the shore, the boat and lantern light. It costs one
// extra (smaller) render, so it is only on at the higher graphics settings.
//
// RippleField: every ripple (a cast, the bobber, a rising fish, the boat, your boots in
// the shallows) is drawn as a little expanding wave packet into a height texture around
// you. The water shader reads its slope, so ripples bend reflections and catch the light
// instead of being painted-on rings.

// Objects on this layer are seen by the main camera but left out of the reflection
// (things under the water, and effects that sit on the surface).
export const NO_REFLECT = 3;

export function hideFromReflection(obj) {
  obj.traverse((o) => o.layers.set(NO_REFLECT));
}

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _target = new THREE.Vector3();
const _rot = new THREE.Matrix4();
const _plane = new THREE.Plane();
const _clip = new THREE.Vector4();
const _q = new THREE.Vector4();
const _normal = new THREE.Vector3(0, 1, 0);
const _size = new THREE.Vector2();

export class Reflection {
  constructor() {
    this.target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
    this.target.texture.generateMipmaps = false;
    this.checked = false;
    this.cam = new THREE.PerspectiveCamera();
    this.cam.layers.set(0);
    this.matrix = new THREE.Matrix4();  // world position -> reflection texture coordinates
    this.scale = 0;                     // fraction of the screen's resolution (0 = off)
    this.every = 1;                     // render every n-th frame
    this.frame = 0;
    this.level = 0;                     // height of the water plane
    this.active = false;                // a valid reflection is in the texture
  }

  setQuality(scale, every = 1) {
    this.scale = scale;
    this.every = every;
    if (!scale) this.active = false;
  }

  resize(renderer) {
    if (!this.scale) return;
    if (!this.checked) {
      // Older devices can't draw into half-float textures: use ordinary 8-bit colour there.
      this.checked = true;
      const half = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
      if (!half) {
        this.target.dispose();
        this.target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType, depthBuffer: true });
        this.target.texture.generateMipmaps = false;
      }
    }
    renderer.getDrawingBufferSize(_size);
    const w = Math.max(64, Math.round(_size.x * this.scale)), h = Math.max(64, Math.round(_size.y * this.scale));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);
  }

  // Render the mirrored view. Skipped (and switched off) when the camera is at or under the water.
  render(renderer, scene, camera) {
    if (!this.scale || camera.position.y < this.level + 0.08) {
      this.active = false;
      return;
    }
    if (this.active && this.frame++ % this.every !== 0) return;
    this.resize(renderer);
    const cam = this.cam;
    camera.updateMatrixWorld();
    // Mirror the camera's position and its look direction across the water plane.
    _pos.setFromMatrixPosition(camera.matrixWorld);
    _rot.extractRotation(camera.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_rot).add(_pos);
    cam.position.set(_pos.x, 2 * this.level - _pos.y, _pos.z);
    _target.set(_look.x, 2 * this.level - _look.y, _look.z);
    cam.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_normal);
    cam.lookAt(_target);
    cam.near = camera.near;
    cam.far = Math.min(camera.far, 900);
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.matrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    // Oblique near plane: nothing below the water gets into the reflection.
    _plane.setFromNormalAndCoplanarPoint(_normal, _pos.set(0, this.level, 0));
    _plane.applyMatrix4(cam.matrixWorldInverse);
    _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    const p = cam.projectionMatrix.elements;
    _q.set((Math.sign(_clip.x) + p[8]) / p[0], (Math.sign(_clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
    _clip.multiplyScalar(2 / _clip.dot(_q));
    p[2] = _clip.x;
    p[6] = _clip.y;
    p[10] = _clip.z + 1;
    p[14] = _clip.w;

    const prevTarget = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false; // reuse this frame's shadows
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.autoUpdate = prevShadow;
    this.active = true;
  }
}

const rippleVert = /* glsl */ `
attribute vec4 aPacket; // x, z, radius, amplitude
attribute vec2 aShape;  // packet width, wavelength
varying vec2 vLocal;
varying vec4 vPacket;
varying vec2 vShape;
void main() {
  float reach = aPacket.z + aShape.x * 2.5 + aShape.y;
  vLocal = position.xy * reach;
  vPacket = aPacket;
  vShape = aShape;
  gl_Position = projectionMatrix * viewMatrix * vec4(aPacket.x + vLocal.x, aPacket.y + vLocal.y, 0.0, 1.0);
}
`;

const rippleFrag = /* glsl */ `
varying vec2 vLocal;
varying vec4 vPacket;
varying vec2 vShape;
void main() {
  float d = length(vLocal) - vPacket.z;
  float env = exp(-(d * d) / (vShape.x * vShape.x));
  float h = vPacket.w * env * cos(6.2831853 * d / vShape.y);
  gl_FragColor = vec4(h, 0.0, 0.0, 1.0);
}
`;

export class RippleField {
  constructor(max = 160) {
    this.max = max;
    this.packets = [];
    this.size = 0;      // texture size (0 = off)
    this.span = 80;     // metres covered
    this.target = null;
    this.rect = new THREE.Vector4(0, 0, 1, 1);
    this.scene = new THREE.Scene();
    // Looking down the world's y axis: texture x is world x, texture y is world z.
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    this.aPacket = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aShape = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPacket', this.aPacket);
    geo.setAttribute('aShape', this.aShape);
    geo.instanceCount = 0;
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: rippleVert,
      fragmentShader: rippleFrag,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    }));
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  get on() { return this.size > 0 && !!this.target; }

  // size: texture resolution (0 turns the field off), span: metres around the focus.
  setQuality(size, span, renderer) {
    this.size = size;
    this.span = span;
    if (!size) return;
    // Needs a render target that can hold negative heights and blend them.
    const ok = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
    if (!ok) {
      this.size = 0;
      return;
    }
    if (!this.target) {
      this.target = new THREE.WebGLRenderTarget(size, size, {
        type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      });
      this.target.texture.generateMipmaps = false;
    } else if (this.target.width !== size) this.target.setSize(size, size);
  }

  // A ripple at (x, z): spreads to about `size` metres over `life` seconds.
  add(x, z, size = 1.5, life = 1.6, str = 0.5) {
    if (!this.size) return;
    if (this.packets.length >= this.max) this.packets.shift();
    this.packets.push({ x, z, size, life, str, age: 0 });
  }

  update(dt) {
    let n = 0;
    for (const p of this.packets) {
      p.age += dt;
      if (p.age < p.life) this.packets[n++] = p;
    }
    this.packets.length = n;
  }

  render(renderer, cx, cz) {
    if (!this.on) return;
    const texel = this.span / this.size;
    // Snap to the texel grid so ripples don't shimmer as the view moves.
    const x0 = Math.round((cx - this.span / 2) / texel) * texel;
    const z0 = Math.round((cz - this.span / 2) / texel) * texel;
    this.rect.set(x0, z0, this.span, this.span);
    const cam = this.cam;
    cam.left = x0; cam.right = x0 + this.span;
    cam.bottom = z0; cam.top = z0 + this.span;
    cam.updateProjectionMatrix();

    const P = this.aPacket.array, S = this.aShape.array;
    let k = 0;
    for (const p of this.packets) {
      if (p.x < x0 - 6 || p.x > x0 + this.span + 6 || p.z < z0 - 6 || p.z > z0 + this.span + 6) continue;
      const u = p.age / p.life;
      const R = 0.08 + p.size * Math.sqrt(u);
      const lambda = 0.16 + 0.07 * p.size + 0.12 * u;
      const width = lambda * (0.9 + 0.8 * u);
      // Height in arbitrary units: the water shader scales the slope.
      const amp = 0.12 * p.str * (1 - u) * (1 - u) * lambda / (1 + R * 0.9);
      P[k * 4] = p.x; P[k * 4 + 1] = p.z; P[k * 4 + 2] = R; P[k * 4 + 3] = amp;
      S[k * 2] = width; S[k * 2 + 1] = lambda;
      k++;
    }
    this.geo.instanceCount = k;
    this.aPacket.needsUpdate = true;
    this.aShape.needsUpdate = true;
    const prev = renderer.getRenderTarget();
    const prevColor = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    if (k) renderer.render(this.scene, cam);
    renderer.setRenderTarget(prev);
    renderer.setClearColor(prevColor, prevAlpha);
  }
}
