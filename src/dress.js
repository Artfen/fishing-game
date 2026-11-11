import * as THREE from 'three';
import { buildHat } from './hats.js';
import { cleanLook, figureLook } from './looks.js';

// What the angler wears, on the figure (on foot, see walker.js, and in a boat, see boat.js): the
// yellow raincoat, or the wool jumper with the coat off, or just a shirt; the sun hat or a red
// woolly hat; and clothes a shade darker when they're wet. The game dresses both figures from the
// comfort record (comfort.js).
const TOP = { coat: new THREE.Color('#e8b440'), jumper: new THREE.Color('#5f7486'), shirt: new THREE.Color('#d8ccb0') };
const LEGS = new THREE.Color('#3b4a68');

// A woolly hat with a turned-up brim and a bobble, for a head of radius 0.13 (hidden until worn).
function woollyHat(mat) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.142, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat);
  dome.position.y = 0.01;
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.03, 6, 16), mat);
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 0.035;
  const bobble = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat);
  bobble.position.y = 0.16;
  for (const m of [dome, brim, bobble]) m.castShadow = true;
  g.add(dome, brim, bobble);
  g.rotation.set(-0.1, 0, 0.05);
  g.visible = false;
  return g;
}

export class Dress {
  // coat: the coat's material (chest and arms), pants: the trousers', head: where the hats sit,
  // sunHat: the sun hat's group. mats: the figure's list of its own materials (the woolly hat's is
  // added, so first person hides it with the rest).
  constructor({ coat, pants, head, sunHat, mats }) {
    this.coat = coat;
    this.pants = pants;
    this.sunHat = sunHat;
    const wool = new THREE.MeshLambertMaterial({ color: '#b5452f' });
    mats?.push(wool);
    this.woolly = woollyHat(wool);
    head.add(this.woolly);
    this.key = '';
  }

  // Your own colours (see looks.js): { coat, jumper, shirt, legs } (hex), or null as you came.
  setPalette(p) {
    this.palette = p ? { coat: new THREE.Color(p.coat), jumper: new THREE.Color(p.jumper), shirt: new THREE.Color(p.shirt), legs: new THREE.Color(p.legs) } : null;
    this.key = '';
    if (this.wear) this.set(this.wear, this.wet);
  }

  // wear: { coat, jumper, hat }; wet: 0 … 1.
  set(wear, wet = 0) {
    this.wear = wear;
    this.wet = wet;
    const w = Math.round(wet * 20) / 20;
    const key = `${+wear.coat}${+wear.jumper}${+wear.hat}${w}`;
    if (key === this.key) return;
    this.key = key;
    const P = this.palette || { ...TOP, legs: LEGS };
    this.coat.color.copy(wear.coat ? P.coat : wear.jumper ? P.jumper : P.shirt).multiplyScalar(1 - 0.32 * w);
    this.pants.color.copy(P.legs).multiplyScalar(1 - 0.35 * w);
    this.sunHat.visible = !wear.hat;
    this.woolly.visible = !!wear.hat;
  }
}

// Dress a figure of you (walker.js's on foot, boat.js's at the helm): selfMats [coat, skin, hat,
// trousers, boots, …], head, dress (dress.js), sunHat (its own hat). Its colours, its hat (the
// sun hat, or one of the townsfolk's hats, hats.js), and a beard and glasses on its head.
export function dressFigure(F, look) {
  const L = cleanLook(look), M = F.selfMats;
  if (!M || !F.head || !F.dress) return;
  M[1].color.set(L.skin);
  M[2].color.set(L.hatColor);
  M[4].color.set(L.boots);
  F.dress.setPalette?.({ coat: L.coat, jumper: L.jumper, shirt: L.shirt, legs: L.legs });
  // The hat: her own sun hat, or another (the woolly hat still comes out when it's cold: dress.js).
  F.ownHat ??= F.dress.sunHat;
  const key = `${L.hat}|${L.hatColor}|${L.hair}|${L.beard}|${L.glasses}`;
  if (F.lookKey === key) return;
  F.lookKey = key;
  for (const o of F.lookParts || []) {
    o.removeFromParent();
    o.traverse((m) => { m.geometry?.dispose(); if (m.material && !M.includes(m.material)) m.material.dispose?.(); });
  }
  F.lookParts = [];
  if (L.hat === 'sun') {
    F.ownHat.visible = true;
    F.dress.sunHat = F.ownHat;
  } else {
    F.ownHat.visible = false;
    const g = buildHat(figureLook(L), (c) => new THREE.MeshLambertMaterial({ color: c }));
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    F.head.add(g);
    F.lookParts.push(g);
    F.dress.sunHat = g;
  }
  // A beard, under the chin, in the hair's colour.
  if (L.beard !== 'none') {
    const full = L.beard === 'full', m = new THREE.MeshLambertMaterial({ color: L.hair });
    const b = new THREE.Mesh(new THREE.SphereGeometry(full ? 0.105 : 0.095, 12, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), m);
    b.position.set(0, full ? -0.012 : -0.005, full ? 0.035 : 0.045);
    b.scale.set(1, full ? 1.1 : 0.75, 0.9);
    F.head.add(b);
    F.lookParts.push(b);
  }
  // Glasses (two rims and a bridge) or sunglasses (two dark lenses), over the eyes.
  if (L.glasses !== 'none') {
    const g = new THREE.Group(), dark = L.glasses === 'shades';
    const m = new THREE.MeshLambertMaterial({ color: dark ? '#141414' : '#2b2b2b' });
    for (const s of [1, -1]) {
      const lens = dark ? new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 12).rotateX(Math.PI / 2), m) : new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 4, 14), m);
      lens.position.set(s * 0.045, 0.017, 0.13);
      g.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.005), m);
    bridge.position.set(0, 0.02, 0.132);
    g.add(bridge);
    F.head.add(g);
    F.lookParts.push(g);
  }
}
