import * as THREE from 'three';
import { FISH, buildFishGeometry, fishMaterial } from '../fish.js';
import { wrapAngle } from '../util.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// Draws every fish in the ecosystem: one instanced draw per species, only the
// fish near the camera, positions interpolated between simulation steps.
export class FishRenderer {
  constructor(scene, eco) {
    this.eco = eco;
    this.sets = FISH.map((sp) => {
      const list = eco.bySpecies[sp.id];
      const n = Math.max(1, list.length);
      const geo = buildFishGeometry(sp);
      const swim = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
      swim.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aSwim', swim);
      const mat = fishMaterial(sp, true);
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      return { sp, list, mesh, swim, mat };
    });
  }

  update(dt, camera, night, submerged) {
    const alpha = this.eco.alpha;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    // Underwater the haze hides fish sooner; from above only fairly close fish can show through.
    const maxD2 = submerged ? 60 * 60 : 80 * 80;
    for (const set of this.sets) {
      set.mat.userData.glow.value = set.sp.sketch.glow ? 0.25 + night * 1.3 : 0;
      let k = 0;
      for (const f of set.list) {
        if (!f.active || f.state === 'caught') continue;
        const x = f.px + (f.x - f.px) * alpha, y = f.py + (f.y - f.py) * alpha, z = f.pz + (f.z - f.pz) * alpha;
        if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 > maxD2) continue;
        f.phase += dt * (3 + f.beat * 11);
        _e.set(-f.pitch, f.pyaw + wrapAngle(f.yaw - f.pyaw) * alpha, f.bank);
        _q.setFromEuler(_e);
        _m.compose(_p.set(x, y, z), _q, _s.setScalar(f.scale));
        set.mesh.setMatrixAt(k, _m);
        set.swim.setXY(k, f.phase, f.beat);
        k++;
      }
      set.mesh.count = k;
      set.mesh.instanceMatrix.needsUpdate = true;
      set.swim.needsUpdate = true;
    }
  }
}
