import * as THREE from 'three';
import { conditions, windAt, waveHeight, shelterAt, seaShareAt, TIDE } from './conditions.js';
import { longSea } from './ocean.js';
import { spumeRate, SURFACE_WIND, eddySpread, fly, flightTime } from './spindrift.js';
import { clamp, smoothstep } from '../util.js';

// A storm's show: lightning and the spray off the seas.
//
//  · Lightning strikes somewhere out over the sea or the hills, every few seconds to half a
//    minute (more often the harder it blows): a jagged bolt from the cloud to the ground, a flash
//    that lights the whole sky and the world for an instant (often twice), and the thunder after
//    it, later the further off it was (sound travels a kilometre in three seconds).
//  · Spray: where a big sea's crest breaks in the wind, a burst of white blown downwind off its
//    top; and from the bow of a boat slamming into a wave (see burst).
//  · (W6) Spindrift: in a strong wind, storm or not, the spray torn off the wind sea's crests
//    breaking round you, streaming low down the wind (spindrift.js has the numbers). Each drop
//    flies as a drop does: pulled to the wind's speed, falling at its own (fly).
//
// The lightning waits for a storm; the spindrift for a wind strong enough to tear the crests.

const MAX_SPRAY = 3000;

// (W6) A puff of spray as the sprite draws it: an uneven cloud of soft blobs inside a soft round
// edge, with no bright centre (the shared glow, white to a third of its radius, read as a light,
// not as spray). Drawn once, the same scatter every time.
function puffTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), h = size / 2;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 14; k++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * h * 0.55, x = h + Math.cos(a) * r, y = h + Math.sin(a) * r, s = h * (0.25 + 0.3 * rnd());
    const gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, 'rgba(255,255,255,0.32)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
  }
  // (Faded out towards its edge.)
  g.globalCompositeOperation = 'destination-in';
  const edge = g.createRadialGradient(h, h, 0, h, h, h);
  edge.addColorStop(0, 'rgba(255,255,255,1)');
  edge.addColorStop(0.6, 'rgba(255,255,255,0.8)');
  edge.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = edge;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const SPUME_R = 50;   // metres round the camera the spindrift is drawn to

export class Storm {
  constructor(scene) {
    // The bolt: a ribbon of a few jagged segments with a branch or two, rebuilt each strike.
    this.boltGeo = new THREE.BufferGeometry();
    this.boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 6 * 64), 3));
    this.bolt = new THREE.Mesh(this.boltGeo, new THREE.MeshBasicMaterial({ color: '#eef3ff', transparent: true, opacity: 0, fog: false, side: THREE.DoubleSide, depthWrite: false }));
    this.bolt.frustumCulled = false;
    this.bolt.renderOrder = -4;
    this.bolt.visible = false;
    scene.add(this.bolt);
    this.next = 6;
    this.flash = 0;
    this.strike = null; // { t, dist, dir, pulses }
    this.dir = new THREE.Vector3(1, 0.2, 0);
    this.thunders = []; // [{ at, dist }]
    // Spray: soft white points, blown downwind and falling.
    const geo = new THREE.BufferGeometry();
    this.sp = new Float32Array(MAX_SPRAY * 3);
    this.sa = new Float32Array(MAX_SPRAY * 4);
    this.vel = new Float32Array(MAX_SPRAY * 3);
    this.life = new Float32Array(MAX_SPRAY);
    this.age = new Float32Array(MAX_SPRAY).fill(1e9);
    // (W6) Each drop's own: the wind it flies in (x, z), how fast it falls in still air, how big
    // its puff is drawn, how white, and whether it spreads as it goes (spindrift) or not (spray).
    this.wnd = new Float32Array(MAX_SPRAY * 2);
    this.eddy = new Float32Array(MAX_SPRAY);  // (the eddy it's in, going up, m/s)
    this.grow = new Float32Array(MAX_SPRAY);  // (how fast its cloud spreads, m/s across)
    this.vt = new Float32Array(MAX_SPRAY).fill(3);
    this.sz = new Float32Array(MAX_SPRAY);
    this.size0 = new Float32Array(MAX_SPRAY).fill(1);
    this.alpha0 = new Float32Array(MAX_SPRAY).fill(0.7);
    this.spread = new Uint8Array(MAX_SPRAY);
    geo.setAttribute('position', new THREE.BufferAttribute(this.sp, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.sa, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage));
    this.turn = Float32Array.from({ length: MAX_SPRAY }, () => Math.random() * Math.PI * 2);
    geo.setAttribute('aTurn', new THREE.BufferAttribute(this.turn, 1));
    const mat = new THREE.PointsMaterial({ size: 0.55, map: puffTexture(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, fog: true });
    // (Each puff its own size, and turned its own way, so no two show the same cloud.)
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute float aSize;\nattribute float aTurn;\nvarying float vTurn;\nvoid main() {\n  vTurn = aTurn;').replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vTurn;\nvoid main() {').replace('#include <map_particle_fragment>', `
        vec2 pc = gl_PointCoord - 0.5;
        float tc = cos(vTurn), ts = sin(vTurn);
        pc = vec2(tc * pc.x - ts * pc.y, ts * pc.x + tc * pc.y) + 0.5;
        #ifdef USE_MAP
          diffuseColor *= texture2D(map, vec2(pc.x, 1.0 - pc.y));
        #endif`);
    };
    this.spray = new THREE.Points(geo, mat);
    this.spray.frustumCulled = false;
    this.spray.renderOrder = 3;
    scene.add(this.spray);
    this.cursor = 0;
    this.crestT = 0;
    this.spumeT = 0;
    this.spumeMade = 0;   // (puffs of spindrift made: for the tests and the debug panel)
    this._crest = { b: 0, x: 0, z: 0, h: 0, vx: 0, vy: 0, vz: 0 };
    this._p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  }

  // (W6) Lit as the foam on the water is (water.js: its foam colour by the sky's light and the
  // sun's, never darker than a storm's white): from the sky each frame.
  light(env) {
    if (!env?.skyCol) return;
    const c = this.spray.material.color, A = env.skyCol, S = env.sunColor, a = (env.hemiI ?? 1) * 0.33, b = (env.sunI ?? 1) * 0.32 * 0.6;
    const st = 0.62 * Math.min(1, env.storm || 0);
    c.setRGB(Math.max(A.r * a + S.r * b, st), Math.max(A.g * a + S.g * b, st), Math.max(A.b * a + S.b * b, st));
    // (#f7f5ec, the foam's own white.)
    c.r *= 0.969;
    c.g *= 0.961;
    c.b *= 0.925;
  }

  // (W6) The next drop's slot, and its start: at (x, y, z) moving (vx, vy, vz), flying in the wind
  // (wx, wz), falling at vt, drawn size × 0.55 m across, alpha white, for life seconds.
  drop(x, y, z, vx, vy, vz, wx, wz, vt, size, alpha, life, spread, eddy = 0, grow = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_SPRAY;
    this.sp[i * 3] = x;
    this.sp[i * 3 + 1] = y;
    this.sp[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.wnd[i * 2] = wx;
    this.wnd[i * 2 + 1] = wz;
    this.vt[i] = vt;
    this.eddy[i] = eddy;
    this.grow[i] = grow;
    this.size0[i] = size;
    this.alpha0[i] = alpha;
    this.spread[i] = spread ? 1 : 0;
    this.life[i] = life;
    this.age[i] = 0;
    return i;
  }

  // A burst of spray at (x, y, z), thrown up and blown along (vx, vz): heavy drops, thrown up
  // to `up` m/s, carried towards (vx, vz) and falling back in a second or two.
  burst(x, y, z, vx, vz, n = 24, up = 3) {
    for (let k = 0; k < n; k++) {
      const vt = 2.2 + Math.random() * 2.3, vy = up * (0.5 + Math.random() * 0.8);
      const life = clamp(flightTime(vy, vt, 0.4 + Math.random() * 0.8), 0.5, 2.2);
      this.drop(x + (Math.random() - 0.5) * 1.2, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 1.2,
        vx * (0.5 + Math.random() * 0.7) + (Math.random() - 0.5) * 1.5, vy, vz * (0.5 + Math.random() * 0.7) + (Math.random() - 0.5) * 1.5,
        vx, vz, vt, 0.8 + Math.random() * 0.5, 0.7, life, false);
    }
  }

  // (W6) Spindrift torn off a breaking crest at (x, y, z), the water there moving (vx, vy, vz), in
  // the wind (wx, wz) a metre or two up, its eddies going up and down at about `gust` (m/s); `drop`
  // metres down to the sea behind. A short plume: a few puffs of fine drops, torn off the crest's
  // lip one after another along the wind.
  spume(x, y, z, vx, vy, vz, wx, wz, drop, gust) {
    const n = 2 + Math.floor(Math.random() * 3), w = Math.hypot(wx, wz) || 1;
    for (let j = 0; j < n; j++) {
      // (Fine drops, falling at 0.35 to 1.6 m/s in still air: the finer, the further they're
      // carried, the higher the eddies lift them, and the fainter and wider their cloud.)
      const f = Math.random(), vt = 0.35 * Math.pow(1.6 / 0.35, f), up = 0.6 + Math.random() * 1.4;
      // (The eddy it's torn into: up or down, about as fast as the air's eddies go there.)
      // (Three uniform draws summed: near enough a normal spread of `gust` either way.)
      const eddy = gust * (Math.random() + Math.random() + Math.random() - 1.5) * 2;
      const fall = vt - eddy, along = (Math.random() * 0.8 + 0.1) * j;
      const life = fall > 0.05 ? clamp(flightTime(vy + up, fall, drop), 0.5, 3.5) : 3.5;
      // (Its cloud: about 1.2 m across torn off, spreading as the eddies mix it, by twice their
      // speed across each second, thinner as it spreads; sizes in the material's 0.55 m. Torn off,
      // it's dense white at its core, the sprite's soft, uneven cloud (puffTexture) thinning it outwards:
      // its strength above 1 is what keeps the core white a while as it spreads. Tried at half
      // that, a gale's spindrift was too faint to pick out against the sea.)
      this.drop(x + (wx / w) * along + (Math.random() - 0.5) * 1.2, y + 0.1 + Math.random() * 0.25, z + (wz / w) * along + (Math.random() - 0.5) * 1.2,
        vx, vy + up, vz, wx, wz, vt, 2.2, 1.3 + 0.5 * f, life, true, eddy, (2 * gust) / 0.55);
    }
  }

  // Each frame. env: the sky (its flash and storm are set here); camera; t: the wave clock.
  // onThunder(distance in metres, loudness 0 … 1) when the sound of a strike arrives.
  update(dt, t, { storm, camera, env, onThunder, flashes = true }) {
    const cam = camera.position;
    // Lightning, in a real storm.
    this.next -= dt;
    if (storm > 0.55 && this.next <= 0 && !this.strike) {
      this.next = (5 + Math.random() * 22) / (0.4 + storm * 0.6);
      this.strikeAt(cam, flashes);
    }
    if (this.strike) {
      const S = this.strike;
      S.t += dt;
      // One to three pulses of light in half a second, each fading fast.
      let f = 0;
      for (const p of S.pulses) {
        const k = S.t - p;
        if (k >= 0) f = Math.max(f, Math.exp(-k * 14) * (k < 0.03 ? k / 0.03 : 1));
      }
      this.flash = f * S.bright;
      this.bolt.visible = S.t < 0.45;
      this.bolt.material.opacity = clamp(f * 1.4, 0, 1);
      if (S.t > 0.7) this.strike = null;
    } else {
      this.flash = 0;
      this.bolt.visible = false;
    }
    env.flash = this.flash;
    env.flashDir.copy(this.dir);
    env.storm = storm;
    this.light(env);
    // The thunder, when it arrives.
    for (let i = this.thunders.length - 1; i >= 0; i--) {
      const T = this.thunders[i];
      T.at -= dt;
      if (T.at <= 0) {
        onThunder?.(T.dist, clamp(1.15 - T.dist / 2200, 0.15, 1));
        this.thunders.splice(i, 1);
      }
    }
    this.updateSpray(dt, t, storm, cam);
  }

  // (Somewhere round the camera; a and dist to choose where, for a look.)
  strikeAt(cam, flashes, a = Math.random() * Math.PI * 2, dist = 350 + Math.random() * 1600) {
    const x = cam.x + Math.cos(a) * dist, z = cam.z + Math.sin(a) * dist;
    this.dir.set(Math.cos(a), 0.25, Math.sin(a)).normalize();
    // (Its own sound arrives later: a kilometre in about three seconds.)
    this.thunders.push({ at: dist / 343, dist });
    if (!flashes) return;
    const pulses = [0];
    if (Math.random() < 0.6) pulses.push(0.12 + Math.random() * 0.12);
    if (Math.random() < 0.3) pulses.push(0.3 + Math.random() * 0.15);
    this.strike = { t: 0, pulses, bright: clamp(1.25 - dist / 2000, 0.35, 1) };
    // The bolt: from the cloud base down to the sea, jagged, with a branch or two.
    const pos = this.boltGeo.attributes.position.array;
    let n = 0;
    const seg = (x0, y0, z0, x1, y1, z1, w) => {
      if (n + 18 > pos.length) return;
      // A flat ribbon turned to face the camera.
      const dx = cam.x - (x0 + x1) / 2, dz = cam.z - (z0 + z1) / 2, l = Math.hypot(dx, dz) || 1;
      const px = (-dz / l) * w, pz = (dx / l) * w;
      pos.set([x0 - px, y0, z0 - pz, x0 + px, y0, z0 + pz, x1 + px, y1, z1 + pz, x0 - px, y0, z0 - pz, x1 + px, y1, z1 + pz, x1 - px, y1, z1 - pz], n);
      n += 18;
    };
    const path = (x0, y0, z0, y1, steps, w, branches) => {
      let px = x0, py = y0, pz = z0;
      const dy = (y1 - y0) / steps;
      for (let i = 0; i < steps; i++) {
        const nx = px + (Math.random() - 0.5) * 34, ny = py + dy, nz = pz + (Math.random() - 0.5) * 34;
        seg(px, py, pz, nx, ny, nz, w);
        if (branches && Math.random() < 0.3) path(nx, ny, nz, ny + dy * (2 + Math.random() * 3), 3, w * 0.5, false);
        px = nx; py = ny; pz = nz;
      }
    };
    path(x, 260 + Math.random() * 60, z, 0, 9, 1.6 + dist * 0.0012, true);
    pos.fill(0, n);
    this.boltGeo.attributes.position.needsUpdate = true;
    this.boltGeo.setDrawRange(0, n / 3);
    this.boltGeo.computeBoundingSphere();
  }

  updateSpray(dt, t, storm, cam) {
    // New spray off the breaking crests round you, where the big seas reach.
    if (storm > 0.25) {
      this.crestT -= dt;
      const swell = conditions.sea.swell;
      while (this.crestT <= 0) {
        this.crestT += 0.05 / storm;
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 55;
        const x = cam.x + Math.cos(a) * r, z = cam.z + Math.sin(a) * r;
        const sh = shelterAt(x, z);
        if (sh[0] < 0.35) continue;
        const h = waveHeight(x, z, t);
        if (h < swell * 0.7 * sh[0]) continue;
        const w = windAt(x, z, t);
        this.burst(x, h, z, w.x * SURFACE_WIND, w.z * SURFACE_WIND, 10, 1.6 + storm * 1.8);
      }
    }
    this.makeSpume(dt, t, cam);
    let live = 0;
    const p = this._p;
    for (let i = 0; i < MAX_SPRAY; i++) {
      const o = i * 3, c = i * 4;
      if (this.age[i] > this.life[i]) {
        this.sa[c + 3] = 0;
        this.sz[i] = 0;
        continue;
      }
      live++;
      this.age[i] += dt;
      // (W6) Each drop as a drop flies: pulled to the wind's speed, falling at its own.
      p.x = this.sp[o];
      p.y = this.sp[o + 1];
      p.z = this.sp[o + 2];
      p.vx = this.vel[o];
      p.vy = this.vel[o + 1];
      p.vz = this.vel[o + 2];
      fly(p, this.wnd[i * 2], this.wnd[i * 2 + 1], this.vt[i], dt, this.eddy[i]);
      this.sp[o] = p.x;
      this.sp[o + 1] = p.y;
      this.sp[o + 2] = p.z;
      this.vel[o] = p.vx;
      this.vel[o + 1] = p.vy;
      this.vel[o + 2] = p.vz;
      const k = clamp(this.age[i] / this.life[i], 0, 1);
      this.sa[c] = this.sa[c + 1] = this.sa[c + 2] = 1;
      // (Spray: in fast, thinning as it falls. Spindrift: torn off dense, a white smoke, then a
      // cloud spreading and thinning as it streams away, gone as it settles on the sea.)
      this.sa[c + 3] = this.spread[i]
        ? this.alpha0[i] * smoothstep(0, 0.05, k) * (1 - smoothstep(0.35, 1, k))
        : this.alpha0[i] * Math.sin(Math.PI * k) * smoothstep(0, 0.1, k + 0.02);
      if (this.spread[i]) {
        const sz = this.size0[i] + this.grow[i] * this.age[i];
        this.sz[i] = sz;
        this.sa[c + 3] = Math.min(1, this.sa[c + 3] * Math.sqrt(this.size0[i] / sz));
      } else this.sz[i] = this.size0[i];
    }
    this.spray.visible = live > 0;
    if (live > 0) {
      const A = this.spray.geometry.attributes;
      A.position.needsUpdate = true;
      A.color.needsUpdate = true;
      A.aSize.needsUpdate = true;
    }
    return live;
  }

  // (W6) Spindrift off the wind sea's crests breaking within SPUME_R of the camera. Points of the
  // still sea are tried at random, as many as the most there could be (the strongest gust's rate
  // over the whole circle, as if all of it were breaking), and each kept as often as its crest is
  // breaking, the wind sea's share there (squared, as the foam drawn there is) and its own wind's
  // rate allow: so on average spumeRate(u) puffs a second from each square metre breaking.
  makeSpume(dt, t, cam) {
    const W = conditions.wind;
    // (No gust is more than 1.75 times the wind: conditions.js windAt.)
    const most = spumeRate(W.speed * 1.75);
    if (!(most > 0) || !(dt > 0) || longSea.wind.m0 < 1e-9) return;
    this.spumeT += most * Math.PI * SPUME_R * SPUME_R * Math.min(dt, 0.1);
    let n = Math.floor(this.spumeT);
    this.spumeT -= n;
    n = Math.min(n, 600);
    const C = this._crest;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, r = SPUME_R * Math.sqrt(Math.random());
      const x = cam.x + Math.cos(a) * r, z = cam.z + Math.sin(a) * r;
      // (The crest's breaking first, cheaply: most of the sea isn't.)
      if (Math.random() >= longSea.breaking(x, z)) continue;
      const s = seaShareAt(x, z);
      if (s <= 0) continue;
      const w = windAt(x, z, t);
      if (Math.random() * most >= s * s * spumeRate(w.speed)) continue;
      // (Where that crest is: carried along by the water's to-and-fro, at its height there.)
      longSea.breakingAt(x, z, t, s, C);
      const y = waveHeight(C.x, C.z, t), level = TIDE.level;
      this.spume(C.x, y, C.z, C.vx, C.vy, C.vz, w.x * SURFACE_WIND, w.z * SURFACE_WIND, 0.25 + Math.random() * Math.max(0.2, y - level), eddySpread(w.speed));
      this.spumeMade++;
    }
  }
}
