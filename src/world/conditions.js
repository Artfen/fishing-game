import * as THREE from 'three';
import { clamp, smoothstep, damp, lerp } from '../util.js';
import {
  WATER_RECT, BAY, COVE, CHANNEL, GANNET, SHOAL, SKERRIES, RIVER, DEEP_Z,
  zoneAt, solidHeight, streamFlow, riverInfo, freshness, CALF_SOUND, waterLevel,
} from './terrain.js';
import { coldwaterFlow } from './coldwater.js';

// Wind, waves and currents: one shared state for the whole game, so the water you see, the
// boats on it, a float, a cast, the trees and the sound of the wind all answer to the same
// conditions. Nothing here is a fluid simulation; it is a small set of honest approximations:
//
//  · Wind has a direction (where it blows from, in the weather forecast's sense), a sustained
//    speed that changes slowly with the weather (or as you set it), and gusts: smooth patches of
//    stronger air drifting downwind. Land breaks it: coves, bays and the lee of a shore get less.
//  · Waves are a sum of long swell from the open Atlantic (west-south-west), which takes minutes
//    to build or fade and barely reaches into sheltered water, and shorter chop raised by the
//    local wind, which builds over tens of seconds and is weaker where the fetch is short. The
//    same function moves the water's vertices (water.js) and lifts the boats and floats.
//  · Currents are a modest background drift along the coast, the river and estuary flowing out
//    to sea, and authored zones where water squeezes past headlands, through channels and over
//    shoals; sheltered water is slacker. Each zone carries a tidal flag: today every tidal zone
//    runs on the ebb (TIDE.flow = 1), and a future tide can turn them by changing TIDE.flow.
//    Depth: a simple profile, full speed at the surface easing to 60% at the seabed.
//
// Units: wind in m/s (shown in km/h), current in m/s, wave height in metres (crest to trough).

const TAU = Math.PI * 2;

/* ---------------- shelter ---------------- */

// How exposed each patch of water is, baked once from the shape of the coast: R = to the open
// Atlantic swell, G = to wind (and the chop it raises); B/A = the sea's current at the surface
// (for the water to show it flowing: the stream's own is in the height map). Open sea 1; bays, coves and the estuary
// much less; close under a shore less again; lakes and the stream almost none. Smoothed so there
// are never edges. The water shader samples the same texture as the boats do here.
const SH = { w: 250, h: 312 }; // cells over the whole water rect (8 m each)
const SWELL_BY_ZONE = { deep: 1, coast: 0.9, open: 0.75, bay: 0.28, cove: 0.18, estuary: 0.16, lake: 0, stream: 0, mere: 0.02 };
const WIND_BY_ZONE = { deep: 1, coast: 0.95, open: 0.9, bay: 0.6, cove: 0.45, estuary: 0.7, lake: 0.35, stream: 0.2, mere: 0.55 };
let shelterData = null; // Float32 [swell, wind] per cell (as the texture holds them)
let currentData = null; // Float32 [x, z] per cell: the sea's surface current, for quick lookups
let shelterTex = null;

export function bakeShelter() {
  if (shelterTex) return shelterTex;
  const { w, h } = SH, R = WATER_RECT;
  const a = new Float32Array(w * h * 2);
  for (let j = 0; j < h; j++) {
    const z = R.z + ((j + 0.5) / h) * R.h;
    for (let i = 0; i < w; i++) {
      const x = R.x + ((i + 0.5) / w) * R.w;
      const o = (j * w + i) * 2;
      if (solidHeight(x, z) > -0.05) continue; // land: 0, so the blur below shelters the water beside it
      const zone = zoneAt(x, z);
      a[o] = SWELL_BY_ZONE[zone] ?? 0.6;
      a[o + 1] = WIND_BY_ZONE[zone] ?? 0.8;
    }
  }
  // Blur a few times: exposure eases off towards the shore and across zone boundaries.
  const tmp = new Float32Array(a.length);
  for (let pass = 0; pass < 4; pass++) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        for (let c = 0; c < 2; c++) {
          let s = 0, n = 0;
          for (let dj = -2; dj <= 2; dj++) {
            for (let di = -2; di <= 2; di++) {
              const ii = clamp(i + di, 0, w - 1), jj = clamp(j + dj, 0, h - 1);
              s += a[(jj * w + ii) * 2 + c];
              n++;
            }
          }
          tmp[(j * w + i) * 2 + c] = s / n;
        }
      }
    }
    a.set(tmp);
  }
  // Half floats, as the GPU will see them; the CPU reads back the very same values.
  const toHalf = THREE.DataUtils.toHalfFloat, fromHalf = THREE.DataUtils.fromHalfFloat;
  const data = new Uint16Array(w * h * 4);
  shelterData = new Float32Array(w * h * 2);
  for (let k = 0; k < w * h; k++) {
    data[k * 4] = toHalf(a[k * 2]);
    data[k * 4 + 1] = toHalf(a[k * 2 + 1]);
    shelterData[k * 2] = fromHalf(data[k * 4]);
    shelterData[k * 2 + 1] = fromHalf(data[k * 4 + 1]);
  }
  const cur = { x: 0, z: 0 };
  currentData = new Float32Array(w * h * 2);
  for (let j = 0; j < h; j++) {
    const z = R.z + ((j + 0.5) / h) * R.h;
    for (let i = 0; i < w; i++) {
      const x = R.x + ((i + 0.5) / w) * R.w, k = j * w + i;
      if (a[k * 2 + 1] <= 0) continue;
      seaCurrent(x, z, cur);
      data[k * 4 + 2] = toHalf(cur.x);
      data[k * 4 + 3] = toHalf(cur.z);
      currentData[k * 2] = cur.x;
      currentData[k * 2 + 1] = cur.z;
    }
  }
  shelterTex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  shelterTex.magFilter = shelterTex.minFilter = THREE.LinearFilter;
  shelterTex.wrapS = shelterTex.wrapT = THREE.ClampToEdgeWrapping;
  shelterTex.needsUpdate = true;
  return shelterTex;
}

// Bilinear, at texel centres, exactly as the GPU filters the texture. out = [swell, wind].
const _sh = [0, 0];
export function shelterAt(x, z, out = _sh) {
  if (!shelterData) bakeShelter();
  const R = WATER_RECT, { w, h } = SH;
  const u = ((x - R.x) / R.w) * w - 0.5, v = ((z - R.z) / R.h) * h - 0.5;
  const i = clamp(Math.floor(u), 0, w - 2), j = clamp(Math.floor(v), 0, h - 2);
  const fu = clamp(u - i, 0, 1), fv = clamp(v - j, 0, 1);
  for (let c = 0; c < 2; c++) {
    const at = (ii, jj) => shelterData[(jj * w + ii) * 2 + c];
    out[c] = lerp(lerp(at(i, j), at(i + 1, j), fu), lerp(at(i, j + 1), at(i + 1, j + 1), fu), fv);
  }
  return out;
}
export const SHELTER_RECT = WATER_RECT;

/* ---------------- the shared state ---------------- */

// Sea states for the setting, and what the weather brings when it's left to the weather.
// wind: [low, high] sustained m/s; swell: crest amplitude in m.
export const SEA_PRESETS = {
  calm: { name: 'Calm', wind: [0.5, 3.5], swell: 0.06, note: 'Light airs and a gentle swell. Easy casting and still water in the bays.' },
  moderate: { name: 'Moderate', wind: [3, 7.5], swell: 0.16, note: 'A breeze and a moderate swell outside; the bays stay sheltered.' },
  lively: { name: 'Lively', wind: [6.5, 11], swell: 0.3, note: 'A fresh wind, whitecaps in the open and a long swell on the outer coast. Shelter in the bays and coves.' },
};
export const SEA_IDS = Object.keys(SEA_PRESETS);

// The swell: a few long waves from the open Atlantic (from the west-south-west), slightly spread;
// and in a storm, two much longer seas rolling in under them (share: of the swell in fair weather;
// storm: of it in a full storm, when the fair-weather waves give way to them by half).
const SWELL_FROM = 250 * (Math.PI / 180); // compass bearing it comes from (clockwise from north)
const SWELL = [[0, 70, 0.55, 0], [0.18, 52, 0.3, 0], [-0.22, 38, 0.15, 0], [0.06, 78, 0, 0.62], [-0.14, 58, 0, 0.42]].map(([da, len, share, storm]) => {
  const to = SWELL_FROM + Math.PI + da; // the way it travels
  // Compass bearing → world vector (north is -z, east +x).
  const k = TAU / len;
  return { dx: Math.sin(to), dz: -Math.cos(to), k, c: Math.sqrt((9.81 / k)), share, storm };
});
// Storm seas stand up in peaks: each swell wave gets a second-order (Stokes) crest, sharpened as
// the storm builds (peak: 1 in fair weather, up to 3.4 in a full storm). Steep crests, long
// troughs, the same mean level.
export const swellShape = (a, k, theta, peak) => a * Math.sin(theta) - 0.5 * k * a * a * peak * Math.cos(2 * theta);
// The chop: two short wavelengths in six fixed directions; the wind's direction weights them
// (so a turning wind turns the sea without any wave jumping).
const CHOP = [];
for (const [len, share] of [[9, 0.65], [5, 0.35]]) {
  for (let d = 0; d < 6; d++) {
    const ang = (d / 6) * TAU + (len === 5 ? 0.5 : 0);
    const k = TAU / len;
    CHOP.push({ dx: Math.sin(ang), dz: -Math.cos(ang), k, c: Math.sqrt(9.81 / k), share, ang });
  }
}
export const WAVE_COUNTS = { swell: SWELL.length, chop: CHOP.length };

export const TIDE = { flow: 1 }; // +1 ebb (out to sea), −1 flood; constant until tides arrive

export const conditions = {
  time: 0, // the shared wave clock (seconds), set by the game each frame
  // Wind: from (compass radians, where it blows from), sustained speed (m/s), and the slow drifts
  // that move them when left to the weather.
  wind: { from: 3.9, speed: 3, target: 3, turn: 0, timer: 0, gust: 0 },
  // Sea: the swell's crest amplitude (m) and the chop's (m), each easing towards its target; how
  // stormy it is (0 … 1, building over a minute or two and dying away more slowly) and how much
  // the swell stands up in peaks.
  sea: { swell: 0.1, chop: 0.05, storm: 0, peak: 1 },
  // From Settings: 'auto' (follow the weather) or a SEA_PRESETS id; wind 'auto' or manual.
  preset: 'auto', manual: null, currents: 'natural',
  chopAmps: new Float32Array(CHOP.length),
  swellAmps: new Float32Array(SWELL.length),
};

// One step of the weather's wind and sea. weather: { rain, cloud, storm }.
export function updateConditions(dt, weather) {
  const C = conditions, W = C.wind;
  const P = SEA_PRESETS[C.preset] || null;
  if (C.manual) {
    W.target = C.manual.speed;
    W.from = dampAngleTo(W.from, C.manual.from, 0.5, dt);
  } else {
    W.timer -= dt;
    const storm = weather.storm || 0;
    // (In a storm the wind gets up to a gale and changes more often.)
    if (W.timer <= 0 || (storm > 0.3 && W.target < 12 * storm)) {
      W.timer = (70 + Math.random() * 110) * (1 - storm * 0.5);
      const [lo, hi] = P && storm < 0.3 ? P.wind : [lerp(1 + weather.cloud * 2, 13, storm), lerp(6 + weather.rain * 5, 18.5, storm)];
      W.target = clamp(lerp(lo, hi, Math.random()) + weather.rain * 2 * (1 - storm), 0, 20);
      W.turn = (Math.random() - 0.5) * 0.004 * (1 + storm * 2);
    }
    W.from = (W.from + W.turn * dt + TAU) % TAU;
  }
  W.speed = damp(W.speed, W.target, 0.05, dt);
  // The sea follows: chop within half a minute or so, the swell over a few minutes; a storm's big
  // seas build over a minute or two and take longer to die away.
  const stormTarget = weather.storm || 0;
  C.sea.storm = damp(C.sea.storm, stormTarget, stormTarget > C.sea.storm ? 0.014 : 0.006, dt);
  C.sea.peak = 1 + 2.4 * smoothstep(0.15, 1, C.sea.storm);
  const swellTarget = (P ? P.swell : 0.07 + weather.cloud * 0.08 + weather.rain * 0.12) * (C.manual ? 0.6 + C.manual.speed / 25 : 1) + 2.1 * C.sea.storm;
  C.sea.swell = damp(C.sea.swell, swellTarget, 0.008 + 0.012 * C.sea.storm, dt);
  C.sea.chop = damp(C.sea.chop, chopFor(W.speed), 0.04, dt);
  // How much of the chop runs in each of its fixed directions: the ones the wind blows along.
  const to = W.from + Math.PI;
  let sum = 0;
  for (let i = 0; i < CHOP.length; i++) {
    const a = Math.max(0, Math.cos(CHOP[i].ang - to));
    C.chopAmps[i] = a * a;
    sum += C.chopAmps[i];
  }
  for (let i = 0; i < CHOP.length; i++) C.chopAmps[i] = (C.chopAmps[i] / (sum || 1)) * 2 * C.sea.chop * CHOP[i].share;
  for (let i = 0; i < SWELL.length; i++) C.swellAmps[i] = C.sea.swell * (SWELL[i].share * (1 - 0.5 * C.sea.storm) + SWELL[i].storm * C.sea.storm);
}
// Chop crest amplitude for a sustained wind (m/s): a ripple in light air, half a metre of
// crest-to-trough in a fresh breeze where it has room to build.
const chopFor = (u) => 0.012 + 0.0045 * Math.pow(u, 1.6);
function dampAngleTo(a, b, k, dt) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return (a + d * (1 - Math.exp(-k * dt)) + TAU) % TAU;
}

/* ---------------- queries ---------------- */

// The wind where you are (m/s): where it blows towards (x, z: a unit vector times the speed),
// with this spot's gusts and its shelter.
const _w = { x: 0, z: 0, speed: 0, gust: 0 };
export function windAt(x, z, t = conditions.time, out = _w) {
  const W = conditions.wind, to = W.from + Math.PI;
  const dx = Math.sin(to), dz = -Math.cos(to);
  // Gusts: smooth patches carried downwind at the wind's speed, a third or so above it.
  const along = (x * dx + z * dz) - W.speed * t, across = x * -dz + z * dx;
  const g = 0.5 + 0.25 * Math.sin(along * 0.045 + Math.sin(across * 0.02) * 1.3) + 0.25 * Math.sin(along * 0.11 - t * 0.21 + across * 0.035);
  // (Storm gusts hit harder.)
  const gust = 1 + (0.38 + 0.3 * conditions.sea.storm) * Math.max(0, g - 0.45) / 0.55;
  const shelter = shelterAt(x, z)[1];
  const s = W.speed * gust * (0.25 + 0.75 * shelter);
  out.x = dx * s;
  out.z = dz * s;
  out.speed = s;
  out.gust = gust;
  return out;
}

// Water height (m) at a point: swell (sheltered by the coast) plus wind chop (less where the
// fetch is short), fading in the last half metre of depth so nothing bobs on the sand. The
// sea's water shader computes exactly this (see water.js WAVE_GLSL). Up the Coldwater and on Hoar
// Tarn the water has its own level (see coldwater.js), and only the faintest ripple.
export function waveHeight(x, z, t = conditions.time) {
  const lvl = waterLevel(x, z);
  if (lvl > 0.05) return lvl + 0.012 * Math.sin(x * 1.7 + t * 2.1) * Math.sin(z * 1.3 - t * 1.6) * smoothstep(0.05, 0.6, lvl - solidHeight(x, z));
  const C = conditions, sh = shelterAt(x, z);
  let hs = 0, hc = 0;
  // (Sheltered, each wave is smaller there before it peaks, as the shader does it.)
  const peak = C.sea.peak;
  for (let i = 0; i < SWELL.length; i++) {
    const w = SWELL[i], a = C.swellAmps[i] * sh[0];
    if (a < 1e-5) continue;
    hs += swellShape(a, w.k, w.k * (w.dx * x + w.dz * z - w.c * t), peak);
  }
  for (let i = 0; i < CHOP.length; i++) {
    const a = C.chopAmps[i];
    if (a < 1e-5) continue;
    const w = CHOP[i];
    hc += a * Math.sin(w.k * (w.dx * x + w.dz * z - w.c * t));
  }
  return (hs + hc * (0.15 + 0.85 * sh[1])) * shoreFade(x, z);
}
// Waves die away over the last stretch of shallow water (so boats sit still on a beach) and on
// fresh water (only the faintest wind ripple reaches the lake). A storm's big seas feel the bottom
// sooner: they've broken and spent themselves by the time the water's a few metres deep.
function shoreFade(x, z) {
  return smoothstep(0.05, 0.9 + 3.5 * conditions.sea.storm, -solidHeight(x, z)) * (1 - 0.85 * freshness(x, z));
}

// The current (m/s) at a point and depth below the surface: where the water is going.
const _c = { x: 0, z: 0 };
const _f = { x: 0, z: 0 };
const _cw = { x: 0, z: 0 };
const _ri = {};
// Authored current zones: water squeezed past headlands and through channels, flowing over the
// shoal. dir: the way it runs on the ebb (world vector); tidal: turns with the tide.
const ZONES = [
  // Through the channel into Driftwood Cove: a gentle set northwards.
  ...CHANNEL.map(([x0, z0, x1, z1, r]) => ({ kind: 'line', x0, z0, x1, z1, r: r + 6, speed: 0.22, tidal: true })),
  // Calf Sound: the tide pours through the gut between Heron Point and the Calf, the strongest
  // race on the coast (slack in the Calf's lee, a few metres either side).
  { kind: 'line', x0: CALF_SOUND.x0, z0: CALF_SOUND.z0, x1: CALF_SOUND.x1, z1: CALF_SOUND.z1, r: 18, speed: 0.8, tidal: true },
  // Round Gannet Isle's points: the tide splits and runs along its shores, fastest off them.
  { kind: 'ring', x: GANNET.x, z: GANNET.z, r0: GANNET.r * 0.95, r1: GANNET.r * 1.6, speed: 0.38, spin: 1, tidal: true },
  // Over Long Shoal: the tide quickens across the shallows.
  { kind: 'disc', x: SHOAL.x, z: SHOAL.z, rx: SHOAL.rx * 1.2, rz: SHOAL.rz * 2.2, dx: 0.85, dz: 0.53, speed: 0.32, tidal: true },
  // Through the Skerries.
  { kind: 'disc', x: SKERRIES[0].x - 10, z: SKERRIES[0].z + 15, rx: 55, rz: 40, dx: 0.6, dz: 0.8, speed: 0.28, tidal: true },
  // The mouth of Willow Bay: a slow exchange with the open water.
  { kind: 'disc', x: BAY.x + 10, z: BAY.z + BAY.r + 15, rx: 60, rz: 35, dx: 0.2, dz: 0.98, speed: 0.08, tidal: true },
];
const RIVER_MOUTH = RIVER[RIVER.length - 1];

export function currentAt(x, z, depth = 0, out = _c) {
  seaCurrent(x, z, out);
  // The stream's own current (fine-grained, in terrain.js), and the Coldwater's.
  streamFlow(x, z, _f);
  coldwaterFlow(x, z, _cw);
  // Slower near the bottom: full at the surface, 60% at the bottom.
  const bottom = Math.max(0.3, waterLevel(x, z) - solidHeight(x, z));
  const k = 1 - 0.4 * clamp(depth / bottom, 0, 1);
  out.x = (out.x + _f.x + _cw.x) * k;
  out.z = (out.z + _f.z + _cw.z) * k;
  return out;
}

// The sea's current at the surface (everything but the stream).
function seaCurrent(x, z, out) {
  let cx = 0, cz = 0;
  const sh = shelterAt(x, z);
  const exposed = sh[0];
  // 1. A modest background drift along the open coast (to the south-east), slacker in shelter.
  const bg = 0.05 * (0.2 + 0.8 * exposed);
  cx += 0.83 * bg;
  cz += 0.55 * bg;
  // 2. The Wend running down its estuary to the sea (the stream's own current too).
  const r = riverInfo(x, z, _ri);
  if (r.d < r.hw + 25 && z < RIVER_MOUTH[1] + 140) {
    const inChannel = smoothstep(r.hw + 25, r.hw * 0.4, r.d);
    // Fast in the narrow upper river, slower where it spreads over the estuary.
    const v = (0.55 - 0.32 * smoothstep(0.2, 1, r.t)) * inChannel * (r.t > 0.6 ? TIDE.flow : 1);
    cx += r.tx * v;
    cz += r.tz * v;
  }
  // 3. The authored zones, each fading smoothly at its edge.
  for (const Z of ZONES) {
    const tide = Z.tidal ? TIDE.flow : 1;
    if (Z.kind === 'line') {
      const bx = Z.x1 - Z.x0, bz = Z.z1 - Z.z0, l = Math.hypot(bx, bz);
      const h = clamp(((x - Z.x0) * bx + (z - Z.z0) * bz) / (l * l), 0, 1);
      const d = Math.hypot(x - Z.x0 - bx * h, z - Z.z0 - bz * h);
      const k = smoothstep(Z.r, Z.r * 0.3, d) * Z.speed * tide;
      cx += (bx / l) * k;
      cz += (bz / l) * k;
    } else if (Z.kind === 'ring') {
      const dx = x - Z.x, dz = z - Z.z, d = Math.hypot(dx, dz) || 1;
      const k = smoothstep(Z.r0, Z.r0 + 10, d) * smoothstep(Z.r1, Z.r1 - 30, d) * Z.speed * tide * Z.spin;
      cx += (-dz / d) * k;
      cz += (dx / d) * k;
    } else {
      const u = (x - Z.x) / Z.rx, v = (z - Z.z) / Z.rz, d = Math.hypot(u, v);
      const k = smoothstep(1, 0.35, d) * Z.speed * tide;
      cx += Z.dx * k;
      cz += Z.dz * k;
    }
  }
  // 4. Far out past the shelf the background drift only.
  if (z > DEEP_Z) {
    const k = smoothstep(DEEP_Z, DEEP_Z + 80, z);
    cx = lerp(cx, 0.83 * 0.05, k);
    cz = lerp(cz, 0.55 * 0.05, k);
  }
  out.x = cx;
  out.z = cz;
  return out;
}
// The sea's surface current from the baked grid (8 m): cheap enough for every fish, every step.
export function currentFast(x, z, out = _c) {
  if (!currentData) bakeShelter();
  const R = WATER_RECT, { w, h } = SH;
  const u = ((x - R.x) / R.w) * w - 0.5, v = ((z - R.z) / R.h) * h - 0.5;
  const i = clamp(Math.floor(u), 0, w - 2), j = clamp(Math.floor(v), 0, h - 2);
  const fu = clamp(u - i, 0, 1), fv = clamp(v - j, 0, 1);
  for (let c = 0; c < 2; c++) {
    const at = (ii, jj) => currentData[(jj * w + ii) * 2 + c];
    const val = lerp(lerp(at(i, j), at(i + 1, j), fu), lerp(at(i, j + 1), at(i + 1, j + 1), fu), fv);
    if (c) out.z = val;
    else out.x = val;
  }
  return out;
}

// How much of the current moves your rig and your boat, by the Currents setting: natural,
// gentle (halved) or still (none on your rig and boat; the fish still know where the water runs).
export const currentScale = () => ({ natural: 1, gentle: 0.5, still: 0 })[conditions.currents] ?? 1;

/* ---------------- in words ---------------- */

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const COMPASS_WORDS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compass = (rad, words = false) => (words ? COMPASS_WORDS : COMPASS)[Math.round((((rad % TAU) + TAU) % TAU) / (TAU / 8)) % 8];
// The way a world vector points, as a compass bearing in radians.
export const bearingOf = (x, z) => (Math.atan2(x, -z) + TAU) % TAU;

const BEAUFORT = [[0.5, 'calm'], [1.6, 'light air'], [3.4, 'light breeze'], [5.5, 'gentle breeze'], [8, 'moderate breeze'], [10.8, 'fresh breeze'], [13.9, 'strong breeze'], [17.2, 'near gale'], [99, 'gale']];
export const windWords = (ms) => BEAUFORT.find(([v]) => ms < v)[1];
// Sea state from the significant wave height (m), after the Douglas scale.
const SEA = [[0.05, 'glassy'], [0.15, 'rippled'], [0.5, 'smooth'], [1.25, 'slight'], [2.5, 'moderate'], [4, 'rough'], [99, 'very rough']];
export const seaWords = (h) => SEA.find(([v]) => h < v)[1];
// The wave height (m, crest to trough) you'd see at a point.
export function waveHeightHere(x, z) {
  const C = conditions, sh = shelterAt(x, z);
  return 2 * (C.sea.swell * (1 + 0.54 * C.sea.storm) * sh[0] + C.sea.chop * (0.15 + 0.85 * sh[1])) * shoreFade(x, z);
}

// For the water shader: the waves' fixed parts (directions, wavenumbers, speeds).
export const WAVE_PARTS = { SWELL, CHOP };
