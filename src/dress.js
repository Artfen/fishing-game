import * as THREE from 'three';

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

  // wear: { coat, jumper, hat }; wet: 0 … 1.
  set(wear, wet = 0) {
    const w = Math.round(wet * 20) / 20;
    const key = `${+wear.coat}${+wear.jumper}${+wear.hat}${w}`;
    if (key === this.key) return;
    this.key = key;
    this.coat.color.copy(wear.coat ? TOP.coat : wear.jumper ? TOP.jumper : TOP.shirt).multiplyScalar(1 - 0.32 * w);
    this.pants.color.copy(LEGS).multiplyScalar(1 - 0.35 * w);
    this.sunHat.visible = !wear.hat;
    this.woolly.visible = !!wear.hat;
  }
}
