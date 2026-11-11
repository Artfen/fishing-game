// The Marine Works' look at a boat (see harbourView.js): the boat herself, as she'd be with the
// paint, the name and the fittings you're choosing, afloat on a patch of calm water in soft
// daylight, turning slowly; drag to turn her yourself. Drawn by a small renderer of its own, off
// screen, onto whichever canvas is showing (the sheet redraws its page as you choose things).

import * as THREE from 'three';

export class BoatPreview {
  // makeBoat(scene, kind): a boat of that kind in the given scene (the game's Boat).
  constructor(makeBoat) {
    this.makeBoat = makeBoat;
    this.ok = null;
    this.boats = {};
    this.want = null;   // { kind, paint, name, fits }
    this.yaw = 0.7;
    this.spin = 0;      // your drag, turning her
    this.raf = 0;
  }

  init() {
    if (this.ok !== null) return this.ok;
    try {
      const canvas = document.createElement('canvas');
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.05;
      this.renderer = r;
      const S = (this.scene = new THREE.Scene());
      S.background = new THREE.Color('#cfe0ea');
      S.fog = new THREE.Fog('#cfe0ea', 18, 40);
      S.add(new THREE.HemisphereLight('#f4f8ff', '#3c5a66', 1.1));
      const sun = new THREE.DirectionalLight('#fff3e0', 2.0);
      sun.position.set(4, 7, 5);
      S.add(sun);
      const water = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: '#3f7c93', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88 }));
      water.rotation.x = -Math.PI / 2;
      S.add(water);
      this.camera = new THREE.PerspectiveCamera(32, 2, 0.1, 80);
      this.ok = true;
    } catch {
      this.ok = false;
    }
    return this.ok;
  }

  // Show this boat as she'd be: { kind, paint (hex or null), name, fits (ids), motor (her engine's
  // spec from engines.js, or none) }.
  show(want) {
    this.want = want;
    if (!this.init()) return;
    if (!this.boats[want.kind]) {
      const b = (this.boats[want.kind] = this.makeBoat(this.scene, want.kind));
      // (Empty, as she stands in the yard.)
      b.setRower?.(false);
    }
    const B = this.boats[want.kind];
    for (const [k, b] of Object.entries(this.boats)) b.group.visible = k === want.kind;
    B.repaint?.(want.paint || null);
    if ((want.name || '') !== (B.boatName || '')) B.setName?.(want.name || '');
    // (Her engine as it is on her, from the catalogue: see engines.js.)
    B.setMotor?.(want.motor || null);
    B.setFits?.(want.fits || []);
    if (!this.raf) this.loop();
  }

  // Drag to turn her (dx: pixels).
  turn(dx) {
    this.spin += dx * 0.01;
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  loop() {
    this.raf = requestAnimationFrame(() => this.loop());
    const view = document.getElementById('hb-preview');
    if (!view || !this.want) return;
    const B = this.boats[this.want.kind];
    if (!B) return;
    const H = B.hull, w = view.width, h = view.height;
    if (this.renderer.domElement.width !== w || this.renderer.domElement.height !== h) this.renderer.setSize(w, h, false);
    // (Afloat at her waterline, turning slowly; your drag turns her the rest of the way.)
    this.yaw += 0.004;
    B.group.position.set(0, -H.draft, 0);
    B.group.rotation.set(0, this.yaw + this.spin, 0);
    const r = 2.6 + H.L * 0.78, el = 0.34;
    this.camera.aspect = w / h;
    this.camera.position.set(Math.sin(0.4) * r * Math.cos(el), r * Math.sin(el) + 0.5, Math.cos(0.4) * r * Math.cos(el));
    this.camera.lookAt(0, H.D * 0.6, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    view.getContext('2d').drawImage(this.renderer.domElement, 0, 0);
  }
}
