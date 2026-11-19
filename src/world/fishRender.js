import * as THREE from 'three';
import { FISH, buildFishGeometry, fishMaterial, drawnLength } from '../fish.js';
import { hasAnatomy } from '../anatomy.js';
import { wrapAngle, clamp, damp, seeded } from '../util.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _o = new THREE.Vector3();

// (F4, docs/FISH.md) Fish are drawn at their true length, so how big one looks is its length over
// its distance. Detail follows that: the detailed model while a fish looks as big as a 45 cm one
// within `near`, so a big tuna keeps it a long way off and a sprat only close by. A fish that
// looks smaller than SEEN (radians: two or three pixels) isn't drawn at all, unless it's busy
// with you.
export const NEAR_LEN = 0.45, SEEN = 0.0035;
// A school of small fish is thousands of fish, not the few dozen the ecosystem follows: each one
// it follows is drawn with a few companions about it (none simulated: they swim with it, as part
// of its school), more the smaller the fish, so a bait ball at its true size is a dense one.
export function companionsFor(sp) {
  if (!sp.life?.school || sp.creature) return 0;
  const len = (sp.size[0] + sp.size[1]) / 200;
  return clamp(Math.round(0.6 / len) - 1, 0, 6);
}
const PATTERNS = 8;


// How each kind swims (the look of it: where it goes is the ecosystem's):
//  · 'steady': the tunas and mackerels, the shoaling fish, the eels and sharks, billfish: the
//    tail never stops.
//  · 'burst': bass, bream, wrasse, the cod family and most others, cruising: a few strong beats,
//    then a glide with the body straight, then again.
//  · 'ripple': flatfish, rays and the cephalopods: no body bend.
// Every fish that bends curves its whole body into an arc as it turns, head and tail towards the
// inside; startled, it throws a sharp C-bend away before it bolts (the escape every fish makes);
// hooked, it thrashes, side to side, as hard as it's pulling.
const STEADY = new Set(['mackerel', 'chubmackerel', 'tuna', 'albacore', 'bonito', 'littletunny', 'bullet', 'yellowfin', 'wahoo', 'eel', 'conger', 'moray',
  'blueshark', 'mako', 'hammerhead', 'catshark', 'bluemarlin', 'sailfish', 'spearfish', 'dorado', 'bluefish', 'amberjack', 'pompano', 'garfish', 'horsemackerel']);
export function swimStyle(sp) {
  if (sp.creature || sp.sketch?.flat || sp.life?.flat || ['thornback', 'angelshark'].includes(sp.id)) return 'ripple';
  return STEADY.has(sp.id) || sp.life?.school ? 'steady' : 'burst';
}
const RELAXED = new Set(['cruise', 'rest', 'feed', 'school', 'approach', 'investigate', 'inspect', 'follow', 'escort', 'sip', 'nibble']);
// One fish's swim for this frame: moves its phase on, and gives { beat, bend } to draw it with.
// (Its tempo: a big fish sweeps its tail slowly, a small one flickers. See tempoOf.)
export function swimStep(f, style, dt, rnd = Math.random) {
  let bend = style === 'ripple' ? 0 : clamp((f.turnRate || 0) * 0.14, -0.45, 0.45);
  let beat = f.beat ?? 0.3, rate = (3 + beat * 11) * (f.tempo ?? 1);
  // (A fright: the moment it turns to flee, a sharp C-bend away, beating flat out.)
  if (f.state !== f.rs) {
    if (f.state === 'flee' && style !== 'ripple') {
      f.cT = 0.22;
      f.cSide = Math.sign(f.turnRate || rnd() - 0.5) || 1;
    }
    f.rs = f.state;
  }
  if (f.cT > 0) {
    f.cT -= dt;
    bend = f.cSide * 0.7;
    beat = 1;
    rate = 22;
  } else if (f.state === 'hooked' && style !== 'ripple') {
    // Thrashing on the line: the whole body whipping side to side, harder the harder it pulls.
    bend += Math.sin(f.phase * 0.55) * 0.32 * clamp(beat, 0.3, 1);
  } else if (style === 'burst' && RELAXED.has(f.state) && beat < 0.7) {
    // Burst and glide: a few beats, then coasting with the tail still.
    f.gT = (f.gT ?? rnd() * 1.5) - dt;
    if (f.gT < 0) {
      f.gl = !f.gl;
      f.gT = f.gl ? 0.5 + rnd() * 0.9 : 0.35 + rnd() * 0.45;
    }
    if (f.gl) {
      beat *= 0.25;
      rate *= 0.3;
    } else {
      beat = Math.min(1, beat * 1.5 + 0.1);
      rate *= 1.25;
    }
  }
  f.phase += dt * rate;
  f.bendV = damp(f.bendV || 0, bend, f.cT > 0 ? 30 : 8, dt);
  return { beat, bend: f.bendV };
}

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
    const instanced = (sp, list, detail, per = 1) => {
      const n = Math.max(1, list.length * per);
      // (Each draw has its own copy: the per-fish swim attribute can't be shared.)
      const geo = buildFishGeometry(sp, detail).clone();
      // (Phase, effort and bend: see swimStep.)
      const swim = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
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
      const list = this.eco.bySpecies[sp.id], extra = companionsFor(sp);
      const near = instanced(sp, list, true, 1 + extra);
      const far = hasAnatomy(sp.id) ? instanced(sp, list, false, 1 + extra) : null;
      // (The companions' places about their fish, in body lengths (x across, y up, z ahead), a
      // little bigger or smaller, and their tails out of step: a few patterns, one per fish.)
      const off = new Float32Array(PATTERNS * extra * 5), r = seeded(sp.id.length * 7717 + 31);
      for (let i = 0; i < PATTERNS * extra; i++) {
        let x, y, z;
        do {
          x = (r() - 0.5) * 2.6;
          y = (r() - 0.5) * 1.1;
          z = (r() - 0.5) * 3.4;
        } while (x * x + y * y * 4 + z * z * 0.5 < 0.5);
        off.set([x, y, z, 0.9 + r() * 0.2, r() * 6.28], i * 5);
      }
      return { sp, list, ...near, far, style: swimStyle(sp), extra, off, len: drawnLength(sp) };
    });
    // (On lower graphics settings, fewer companions: see density.)
    this.companions = 1;
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
      const E = Math.round(set.extra * this.companions);
      for (const f of set.list) {
        if (!f.active || f.state === 'caught' || f.state === 'gone') continue;
        const x = f.px + (f.x - f.px) * alpha, y = f.py + (f.y - f.py) * alpha + (f.lvl || 0), z = f.pz + (f.z - f.pz) * alpha;
        const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
        if (d2 > maxD2) continue;
        // (Its true length, m. A fish of a metre or more is always drawn, whatever the setting.)
        const len = f.scale * set.len, busyNow = busy.has(f.state);
        if (f.rank >= this.density && d2 > 324 && len < 1 && !busyNow) continue;
        if (!busyNow && len * len < SEEN * SEEN * d2) continue;
        const S = swimStep(f, set.style, dt);
        _e.set(-f.pitch, f.pyaw + wrapAngle(f.yaw - f.pyaw) * alpha, f.bank);
        _q.setFromEuler(_e);
        // (Its true length, and as deep and thick as its build: see girthOf.)
        const g = f.girth ?? 1;
        _m.compose(_p.set(x, y, z), _q, _s.set(f.scale * g, f.scale * g, f.scale));
        const nearD = this.near * clamp(len / NEAR_LEN, 0.3, 4);
        const into = set.far && d2 > nearD * nearD ? set.far : set;
        let i = into === set ? k++ : kf++;
        into.mesh.setMatrixAt(i, _m);
        into.swim.setXYZ(i, f.phase, S.beat, S.bend);
        // Its companions, while it's with its school.
        if (E && f.state === 'school') {
          const base = ((f.id * 2654435761) >>> 0) % PATTERNS * set.extra * 5;
          for (let j = 0; j < E; j++) {
            const o = set.off, b = base + j * 5;
            _o.set(o[b] * len, o[b + 1] * len, o[b + 2] * len).applyQuaternion(_q);
            const sc = f.scale * o[b + 3];
            _m.compose(_p.set(x + _o.x, y + _o.y, z + _o.z), _q, _s.set(sc * g, sc * g, sc));
            i = into === set ? k++ : kf++;
            into.mesh.setMatrixAt(i, _m);
            into.swim.setXYZ(i, f.phase + o[b + 4], S.beat, S.bend);
          }
        }
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
