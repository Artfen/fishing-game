import * as THREE from 'three';
import { FISH, buildFishGeometry, fishMaterial } from '../fish.js';
import { hasAnatomy } from '../anatomy.js';
import { wrapAngle } from '../util.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();


// Draws every fish in the ecosystem: one instanced draw per species (two, near and far, for
// species with a detailed anatomical model), only the fish near the camera, positions
// interpolated between simulation steps.
export class FishRenderer {
  constructor(scene, eco) {
    this.eco = eco;
    // Lower graphics settings draw fewer of the distant fish (by each fish's fixed rank, so the
    // same ones stay hidden). Every fish is still simulated, can still bite and shows on the
    // fish finder; the ones near you and the ones interested in your bait are always drawn.
    this.density = 1;
    // Fish drawn in full detail out to this distance; beyond it, the simpler model of the same
    // species (for species with an anatomical model). Lower graphics settings bring it closer.
    this.near = 22;
    const instanced = (sp, list, detail) => {
      const n = Math.max(1, list.length);
      // (Each draw has its own copy: the per-fish swim attribute can't be shared.)
      const geo = buildFishGeometry(sp, detail).clone();
      const swim = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
      swim.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aSwim', swim);
      const mat = fishMaterial(sp, true);
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      return { mesh, swim, mat };
    };
    this.sets = FISH.filter((sp) => !sp.retired).map((sp) => {
      const list = this.eco.bySpecies[sp.id];
      const near = instanced(sp, list, true);
      const far = hasAnatomy(sp.id) ? instanced(sp, list, false) : null;
      return { sp, list, ...near, far };
    });
  }

  // Every mesh drawn (for the reflection to leave out).
  get meshes() {
    return this.sets.flatMap((s) => (s.far ? [s.mesh, s.far.mesh] : [s.mesh]));
  }

  update(dt, camera, night, submerged) {
    const alpha = this.eco.alpha;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    // Underwater the haze hides fish sooner; from above only fairly close fish can show through.
    // (In Las Brasas' clear water, see `clear`, you see a good way further.)
    const reach = (submerged ? 60 : 80) + 18 * (this.clear || 0);
    const maxD2 = reach * reach;
    const busy = this.busy || (this.busy = new Set([...this.eco.engagedSet, 'escort', 'hooked']));
    for (const set of this.sets) {
      if (set.mat.userData?.glow) set.mat.userData.glow.value = set.sp.sketch.glow ? 0.25 + night * 1.3 : 0;
      let k = 0, kf = 0;
      for (const f of set.list) {
        if (!f.active || f.state === 'caught' || f.state === 'gone') continue;
        const x = f.px + (f.x - f.px) * alpha, y = f.py + (f.y - f.py) * alpha + (f.lvl || 0), z = f.pz + (f.z - f.pz) * alpha;
        const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
        if (d2 > maxD2) continue;
        if (f.rank >= this.density && d2 > 324 && !busy.has(f.state)) continue;
        f.phase += dt * (3 + f.beat * 11);
        _e.set(-f.pitch, f.pyaw + wrapAngle(f.yaw - f.pyaw) * alpha, f.bank);
        _q.setFromEuler(_e);
        _m.compose(_p.set(x, y, z), _q, _s.setScalar(f.scale));
        const into = set.far && d2 > this.near * this.near ? set.far : set;
        const i = into === set ? k++ : kf++;
        into.mesh.setMatrixAt(i, _m);
        into.swim.setXY(i, f.phase, f.beat);
      }
      for (const [s, n] of set.far ? [[set, k], [set.far, kf]] : [[set, k]]) {
        s.mesh.count = n;
        s.mesh.visible = n > 0; // (no draw at all for a species with none in view)
        s.mesh.instanceMatrix.needsUpdate = true;
        s.swim.needsUpdate = true;
      }
    }
  }
}
