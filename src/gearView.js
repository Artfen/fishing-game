import * as THREE from 'three';
import { buildGear, disposeGear } from './gearArt.js';
import { fishById, buildFishGeometry, fishMaterial, drawFishSketch } from './fish.js';
import { hasAnatomy, ANATOMY } from './anatomy.js';
import { RODS, TACKLE, TERMS, LINE_COLORS } from './tackle.js';

// The backpack's little photo studio: one small WebGL renderer, made the first time the
// backpack opens and kept (never one per card). It photographs each piece of tackle once into a
// cached thumbnail, and draws the selected piece large, re-rendering only when you turn it or
// pick something else (no animation loop). If WebGL isn't available, simple drawings stand in.

export const refKey = (r) => `${r.type}:${r.id}${r.rod ? `@${r.rod}` : ''}`;

// The same model a species has in the water, posed for a portrait: side on, facing left, or
// seen from above for a flatfish and a cephalopod (or as its recipe asks: a gurnard a little
// from above, to show its wings).
function fishModel(ref) {
  const sp = fishById[ref.id];
  const mesh = new THREE.Mesh(buildFishGeometry(sp, true), fishMaterial(sp, false));
  // (Shared anatomical geometry stays cached; the older species' geometry is made per picture.)
  mesh.userData.sharedGeometry = hasAnatomy(sp.id);
  const flat = sp.life?.flat, ceph = !!sp.creature;
  const view = ANATOMY[sp.id]?.view || (flat ? { yaw: -Math.PI / 2 + 0.25, pitch: 0.95 } : ceph ? { yaw: -Math.PI / 2 + 0.5, pitch: 0.6 } : { yaw: -Math.PI / 2 + 0.12, pitch: 0.08 });
  return { object: mesh, view };
}
const build = (ref, opts) => (ref.type === 'fish' ? fishModel(ref) : buildGear(ref, opts));
const release = (object) => {
  if (object.userData.sharedGeometry) return;
  disposeGear(object);
};

const _box = new THREE.Box3(), _size = new THREE.Vector3(), _center = new THREE.Vector3();

export class GearStage {
  constructor() {
    this.thumbs = new Map(); // key -> data URL
    this.ok = null;
    this.current = null;     // the model on the big preview: { key, object, view, closeUp }
  }

  init() {
    if (this.ok !== null) return this.ok;
    try {
      const canvas = document.createElement('canvas');
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.08;
      r.setClearColor(0x000000, 0);
      this.renderer = r;
      this.scene = new THREE.Scene();
      // Soft studio light: a warm key from the upper left, a cool fill, and a rim from behind.
      this.scene.add(new THREE.HemisphereLight('#fff6e6', '#5b6146', 0.9));
      const key = new THREE.DirectionalLight('#fff1dc', 2.2);
      key.position.set(-2, 3, 3);
      const rim = new THREE.DirectionalLight('#dfe9ff', 1.1);
      rim.position.set(2, 1.5, -3);
      const fill = new THREE.DirectionalLight('#ffe6c8', 0.5);
      fill.position.set(3, -1, 2);
      this.scene.add(key, rim, fill);
      this.scene.environment = this.makeEnvironment();
      this.holder = new THREE.Group();
      this.scene.add(this.holder);
      this.persp = new THREE.PerspectiveCamera(26, 1, 0.001, 20);
      this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 20);
      this.ok = true;
    } catch {
      this.ok = false;
    }
    return this.ok;
  }

  // Something for metal and varnish to reflect: a warm room with a couple of bright windows.
  makeEnvironment() {
    const env = new THREE.Scene();
    const geo = new THREE.SphereGeometry(5, 32, 16);
    const cols = [];
    const p = geo.attributes.position;
    const top = new THREE.Color('#fbf3e2'), mid = new THREE.Color('#9a8a6a'), low = new THREE.Color('#3a3a2e'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 5;
      if (y > 0) c.copy(mid).lerp(top, y);
      else c.copy(mid).lerp(low, -y);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    for (const [x, y, z, w, h] of [[-3, 2.5, 2, 2.2, 1.4], [3, 1.5, -2, 1.6, 2], [0, 4, 0, 3, 3]]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }));
      panel.position.set(x, y, z);
      panel.lookAt(0, 0, 0);
      env.add(panel);
    }
    const pm = new THREE.PMREMGenerator(this.renderer);
    const tex = pm.fromScene(env, 0.04).texture;
    pm.dispose();
    env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    return tex;
  }

  // Pose a model and frame it: turned by view.yaw/pitch, centred, the camera backed off to fit.
  frame(object, view, w, h, { closeUp = false, zoom = 1 } = {}) {
    const hold = this.holder;
    hold.clear();
    object.rotation.set(0, 0, 0);
    object.position.set(0, 0, 0);
    hold.rotation.set(view.pitch || 0, view.yaw || 0, view.roll || 0, 'XYZ');
    hold.add(object);
    hold.updateMatrixWorld(true);
    if (closeUp && view.focusX) {
      // Frame the handle and reel only: a box round that part of the rod.
      const f = view.focusX;
      _box.makeEmpty();
      const pts = [];
      object.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
        // Only parts near the handle (in the rod's own length).
        const lp = object.worldToLocal(b.getCenter(new THREE.Vector3()));
        if (lp.x >= f.x0 - 0.02 && lp.x <= f.x1) pts.push(b);
      });
      for (const b of pts) _box.union(b);
    } else _box.setFromObject(hold);
    _box.getSize(_size);
    _box.getCenter(_center);
    hold.position.sub(_center);
    hold.updateMatrixWorld(true);
    const aspect = w / h;
    let cam;
    if (view.ortho) {
      cam = this.ortho;
      const margin = 1.08 / zoom;
      const halfW = Math.max(_size.x / 2, (_size.y / 2) * aspect) * margin, halfH = halfW / aspect;
      Object.assign(cam, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
      cam.position.set(0, 0, 5);
      cam.lookAt(0, 0, 0);
      cam.updateProjectionMatrix();
    } else {
      cam = this.persp;
      cam.aspect = aspect;
      const vf = THREE.MathUtils.degToRad(cam.fov) / 2, hf = Math.atan(Math.tan(vf) * aspect);
      const dist = (Math.max(_size.y / 2 / Math.tan(vf), _size.x / 2 / Math.tan(hf)) + _size.z / 2) * 1.12 / zoom;
      cam.near = dist / 100;
      cam.far = dist * 10;
      cam.position.set(0, 0, dist);
      cam.lookAt(0, 0, 0);
      cam.updateProjectionMatrix();
    }
    return cam;
  }

  shoot(w, h, cam) {
    const r = this.renderer;
    r.setPixelRatio(1);
    r.setSize(w, h, false);
    r.render(this.scene, cam);
    return r.domElement;
  }

  // A cached thumbnail (data URL) for a reference; opts.closeUp for a rod's handle and reel.
  thumb(ref, w, h, opts = {}) {
    const key = `${refKey(ref)}|${w}x${h}|${opts.closeUp ? 'c' : ''}`;
    if (this.thumbs.has(key)) return this.thumbs.get(key);
    let url;
    if (this.init()) {
      const thick = ref.type === 'rod' && !opts.closeUp ? opts.thick ?? 3 : 1;
      const { object, view } = build(ref, { closeUp: opts.closeUp, thick });
      if (ref.type === 'rod' && !opts.closeUp) view.pitch = 0.05;
      const cam = this.frame(object, view, w, h, opts);
      url = this.shoot(w, h, cam).toDataURL('image/png');
      this.holder.clear();
      release(object);
    } else url = fallbackThumb(ref, w, h);
    this.thumbs.set(key, url);
    return url;
  }

  // Draw the selected piece into a visible 2D canvas, turned by (yaw, pitch) on top of its pose.
  preview(canvas, ref, { yaw = 0, pitch = 0, closeUp = false, zoom = 1 } = {}) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!this.init()) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = fallbackThumb(ref, w, h);
      return;
    }
    const key = `${refKey(ref)}|${closeUp ? 'c' : ''}`;
    if (this.current?.key !== key) {
      this.release();
      const thick = ref.type === 'rod' && !closeUp ? 2.2 : 1;
      const built = build(ref, { closeUp, thick });
      this.current = { key, ...built, closeUp };
    }
    const c = this.current;
    const view = { ...c.view, yaw: (c.view.yaw || 0) + yaw, pitch: (c.view.pitch || 0) + pitch };
    const cam = this.frame(c.object, view, w, h, { closeUp, zoom });
    ctx.drawImage(this.shoot(w, h, cam), 0, 0);
  }

  // Let go of the big preview's model (when the backpack closes or the selection changes).
  release() {
    if (!this.current) return;
    this.holder?.clear();
    release(this.current.object);
    this.current = null;
  }

  // GPU memory in use, for checking that opening and closing doesn't leak.
  get memory() {
    return this.renderer ? { ...this.renderer.info.memory } : null;
  }
}

// One studio for the whole game (the backpack, the field guide and the catch card share it).
let shared = null;
export const studio = () => shared || (shared = new GearStage());

/* ---------------- drawings for when WebGL isn't available ---------------- */

function fallbackThumb(ref, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  if (ref.type === 'fish') {
    // A species: its journal sketch.
    drawFishSketch(x, fishById[ref.id], w / 2, h / 2, w * 0.8);
    return c.toDataURL('image/png');
  }
  x.lineCap = 'round';
  x.lineJoin = 'round';
  const cx = w / 2, cy = h / 2, u = Math.min(w, h) / 10;
  if (ref.type === 'rod') {
    const look = RODS[ref.id].look;
    x.strokeStyle = look.color;
    x.lineWidth = u * 0.35;
    x.beginPath();
    x.moveTo(w * 0.08, h * 0.8);
    x.lineTo(w * 0.94, h * 0.2);
    x.stroke();
    x.strokeStyle = look.handle;
    x.lineWidth = u * 0.9;
    x.beginPath();
    x.moveTo(w * 0.08, h * 0.8);
    x.lineTo(w * 0.24, h * 0.69);
    x.stroke();
    x.fillStyle = '#6b737c';
    x.beginPath();
    x.arc(w * 0.2, h * 0.8, u * 0.8, 0, Math.PI * 2);
    x.fill();
  } else if (ref.type === 'line' || ref.type === 'reel') {
    x.fillStyle = '#2f3a2a';
    x.beginPath();
    x.arc(cx, cy, u * 3.6, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = LINE_COLORS[RODS[ref.rod].kind];
    x.beginPath();
    x.arc(cx, cy, u * 2.9, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#2f3a2a';
    x.beginPath();
    x.arc(cx, cy, u * 0.8, 0, Math.PI * 2);
    x.fill();
  } else if (ref.type === 'term') {
    const t = TERMS[ref.id];
    x.strokeStyle = '#4a5560';
    x.lineWidth = u * 0.15;
    x.beginPath();
    x.moveTo(cx, h * 0.1);
    x.lineTo(cx, h * 0.85);
    x.stroke();
    x.fillStyle = t.weight > 20 ? '#6c7077' : '#e9e0cc';
    x.beginPath();
    x.ellipse(cx, cy, u * (t.weight > 20 ? 1.2 : 0.6), u * 2, 0, 0, Math.PI * 2);
    x.fill();
  } else {
    const it = TACKLE[ref.id];
    x.fillStyle = it?.type === 'bait' ? '#c8656a' : it?.type === 'jig' ? '#f2c23a' : it?.type === 'fly' ? '#5a4a2a' : '#4a7a8a';
    x.beginPath();
    x.ellipse(cx, cy, u * 3.2, u * 1.3, -0.2, 0, Math.PI * 2);
    x.fill();
  }
  return c.toDataURL('image/png');
}
