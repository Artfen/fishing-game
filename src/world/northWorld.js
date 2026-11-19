import * as THREE from 'three';
import { clamp, smoothstep, fbm } from '../util.js';
import { northAt } from './terrain.js';
import { TERN, RAVEN, inSound, inBothyBay } from './north.js';

// The north's look (docs/NORTH.md): the colours of its ground and seabed, and (N2, N3) what
// stands on it. Cold and northern: grass and heather on the fells, grey crags and scree, cliffs
// of grey rock to the west; green machair and white shell sand on Tern Isle; under the water,
// dark kelp on every rocky shore, grey-green sand, mud in the loch's deep.
const NC = {
  grass: new THREE.Color('#7f914f'),
  grassDark: new THREE.Color('#5b6b3b'),
  machair: new THREE.Color('#93a95c'),
  heather: new THREE.Color('#6d5a5d'),
  bracken: new THREE.Color('#87693d'),
  scree: new THREE.Color('#999488'),
  crag: new THREE.Color('#6b6963'),
  cliff: new THREE.Color('#5f5e5a'),
  shingle: new THREE.Color('#8a877f'),
  shellSand: new THREE.Color('#e4dcc6'),
  wetShell: new THREE.Color('#bdb59f'),
  wetShingle: new THREE.Color('#5d5a52'),
  sand: new THREE.Color('#a39c80'),
  bed: new THREE.Color('#7f7c66'),
  kelp: new THREE.Color('#4a4526'),
  mud: new THREE.Color('#4c4a3f'),
  rock: new THREE.Color('#57564f'),
  deep: new THREE.Color('#2c3536'),
};

// The ground's colour at a point of the north (for the terrain's triangles).
export function northColor(c, h, ny, x, z, r) {
  const S = northAt(x, z), n = fbm(x * 0.02 + 3, z * 0.02 - 8, 3), n2 = fbm(x * 0.09 - 1, z * 0.09 + 6, 2);
  const steep = smoothstep(0.82, 0.58, ny);
  // (What's needed of the shape, kept: S is shared.)
  const isle = S.isle < S.main ? S.I : null, d = S.d, loch = S.loch;
  const tern = isle === TERN, terny = tern ? -Math.cos(Math.atan2(z - TERN.z, x - TERN.x)) : 0;
  if (h < -0.3) {
    // The seabed: sand going grey-green with depth, kelp on the rock in the shallows, mud in the
    // loch's basin, the deep dark; white sand off Tern Isle's beach and in Bothy Bay.
    const depth = -h;
    c.copy(NC.bed).lerp(NC.sand, smoothstep(14, 4, depth) * 0.6).lerp(NC.deep, smoothstep(18, 70, depth));
    if (tern && terny < -0.2) c.lerp(NC.wetShell, smoothstep(-0.2, -0.7, terny) * smoothstep(14, 3, depth) * 0.8);
    const sandy = Math.max(inSound(x, z) * smoothstep(8, 14, depth), tern ? smoothstep(-0.2, -0.6, terny) : 0, inBothyBay(x, z) ? 1 : 0);
    const kelp = (1 - sandy) * smoothstep(110, 40, Math.max(0, d)) * smoothstep(0.6, 2, depth) * (1 - smoothstep(13, 18, depth)) * clamp(0.6 + n2, 0, 1);
    c.lerp(NC.kelp, kelp * 0.85);
    if (loch < 0) c.lerp(NC.mud, smoothstep(20, 45, depth) * 0.8);
    c.lerp(NC.rock, steep * 0.7);
    c.multiplyScalar(0.95 + r * 0.1);
    return;
  }
  // The shore: white shell sand on Tern Isle's east; shingle and rock elsewhere, wet below the tide.
  const shore = smoothstep(2.4, 0.8, h);
  if (tern) {
    // Tern Isle: machair (short green turf over sand), white sand on its beach side.
    c.copy(NC.machair).lerp(NC.grass, clamp(0.4 + n, 0, 1) * 0.5);
    const beach = smoothstep(-0.1, -0.6, terny);
    c.lerp(h < 0.7 ? NC.wetShell : NC.shellSand, Math.max(shore, beach * smoothstep(5, 1.5, h)));
    c.multiplyScalar(0.96 + r * 0.08);
    return;
  }
  // The fells (and Raven Isle): grass low down, heather and bracken higher, scree high, crags on the
  // steep, grey cliffs on the weather side.
  if (h > 150) c.copy(NC.heather).lerp(NC.bracken, clamp(0.5 + n * 1.3, 0, 1) * 0.6).lerp(NC.scree, smoothstep(200, 280, h) * 0.6);
  else c.copy(NC.grass).lerp(NC.grassDark, clamp(0.5 + n * 1.2, 0, 1)).lerp(NC.heather, smoothstep(40, 140, h) * clamp(0.5 + n2, 0, 1) * 0.7).lerp(NC.bracken, clamp(n2 * 1.4 - 0.2, 0, 0.5) * smoothstep(20, 80, h));
  c.lerp(isle === RAVEN || d > -400 ? NC.cliff : NC.crag, steep * 0.9);
  c.lerp(h < 0.6 ? NC.wetShingle : NC.shingle, shore * (1 - steep * 0.5));
  c.multiplyScalar(0.96 + r * 0.08);
}
