import * as THREE from 'three';
import { clamp, smoothstep, damp, lerp } from '../util.js';
import {
  WATER_RECT, BAY, COVE, CHANNEL, GANNET, SHOAL, SKERRIES, RIVER, DEEP_Z,
  zoneAt, solidHeight, streamFlow, riverInfo, freshness, CALF_SOUND, waterLevel, SOUTH_Z,
} from './terrain.js';
import { coldwaterFlow } from './coldwater.js';
import { SOUTH_WATER, brasaCurrent } from './brasa.js';

// Wind, waves and currents: one shared state for the whole game, so the water you see, the
// boats on it, a float, a cast, the trees and the sound of the wind all answer to the same
// conditions. Nothing here is a fluid simulation; it is a small set of honest approximations:
//
//  · Wind has a direction (where it blows from, in the weather forecast's sense), a sustained
//    speed that changes slowly with the weather (or as you set it), and gusts: smooth patches of
//    stronger air drifting downwind. Land breaks it: coves, bays and the lee of a shore get less.
//    On a fair day at home a sea breeze sets in towards midday, onshore and fresher through the
//    afternoon, and dies in the evening; at Las Brasas the trade wind blows, fresher still in
//    the afternoon. (An Atlantic coast is seldom still: a breeze most days, often a fresh one.)
//  · Waves are a sum of long swell from the open Atlantic (west-south-west), which takes minutes
//    to build or fade, barely reaches into sheltered water, and steepens and grows as it runs
//    into shallow water before it breaks on the shore; and a wind sea raised by the local wind,
//    which builds over tens of seconds, is weaker where the fetch is short, and grows longer
//    waves as the wind freshens (a ruffle of short ones in light air; in a fresh breeze, long
//    steep ones with sharp crests). The same function moves the water's vertices (water.js) and
//    lifts the boats and floats.
//  · Currents are a modest background drift along the coast, the river and estuary flowing out
//    to sea, and authored zones where water squeezes past headlands, through channels and over
//    shoals; sheltered water is slacker. Each zone carries a tidal flag: it runs with the tide
//    (TIDE.flow, set by the game from tide.js: +1 out on a full ebb, −1 in on the flood, 0 slack);
//    and the sea's level rises and falls with it (TIDE.level).
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
// (Las Brasas, far to the south, has its own: the windward north and west take the swell and the
// trade wind; the lee and the harbour are calm.)
const SWELL_BY_ZONE = {
  deep: 1, coast: 0.9, open: 0.75, bay: 0.28, cove: 0.18, estuary: 0.16, lake: 0, stream: 0, mere: 0.02,
  harbor: 0.04, lee: 0.3, lava: 1, sebadal: 0.42, veril: 0.75, ocean: 1,
};
const WIND_BY_ZONE = {
  deep: 1, coast: 0.95, open: 0.9, bay: 0.6, cove: 0.45, estuary: 0.7, lake: 0.35, stream: 0.2, mere: 0.55,
  harbor: 0.35, lee: 0.62, lava: 1, sebadal: 0.85, veril: 0.95, ocean: 1,
};
// One baked field per sea: home (the whole water rect, 8 m cells) and the far south.
// data: Float32 [swell, wind] per cell (as the texture holds them); cur: Float32 [x, z] per cell,
// the sea's surface current, for quick lookups.
const FIELDS = {
  home: { rect: WATER_RECT, w: 250, h: 312, data: null, cur: null, tex: null },
  south: { rect: SOUTH_WATER, w: 280, h: 280, data: null, cur: null, tex: null },
};
const fieldAt = (z) => (z > SOUTH_Z ? FIELDS.south : FIELDS.home);
export const shelterRect = (region = 'home') => FIELDS[region].rect;

export function bakeShelter(region = 'home') {
  const F = FIELDS[region];
  if (F.tex) return F.tex;
  const { w, h } = F, R = F.rect;
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
  const shelterData = (F.data = new Float32Array(w * h * 2));
  for (let k = 0; k < w * h; k++) {
    data[k * 4] = toHalf(a[k * 2]);
    data[k * 4 + 1] = toHalf(a[k * 2 + 1]);
    shelterData[k * 2] = fromHalf(data[k * 4]);
    shelterData[k * 2 + 1] = fromHalf(data[k * 4 + 1]);
  }
  // The current in two parts: what runs whatever the tide (B, A), and the tidal streams at full
  // ebb (their own texture), so the game turns them with the tide: base + flow × tidal.
  const cur = { x: 0, z: 0 }, full = { x: 0, z: 0 };
  const currentData = (F.cur = new Float32Array(w * h * 2));
  const tidalData = (F.tid = new Float32Array(w * h * 2));
  const tdata = new Uint16Array(w * h * 4);
  const flow = TIDE.flow;
  for (let j = 0; j < h; j++) {
    const z = R.z + ((j + 0.5) / h) * R.h;
    for (let i = 0; i < w; i++) {
      const x = R.x + ((i + 0.5) / w) * R.w, k = j * w + i;
      if (a[k * 2 + 1] <= 0) continue;
      TIDE.flow = 0;
      seaCurrent(x, z, cur);
      TIDE.flow = 1;
      seaCurrent(x, z, full);
      data[k * 4 + 2] = toHalf(cur.x);
      data[k * 4 + 3] = toHalf(cur.z);
      currentData[k * 2] = cur.x;
      currentData[k * 2 + 1] = cur.z;
      tidalData[k * 2] = full.x - cur.x;
      tidalData[k * 2 + 1] = full.z - cur.z;
      tdata[k * 4] = toHalf(full.x - cur.x);
      tdata[k * 4 + 1] = toHalf(full.z - cur.z);
    }
  }
  TIDE.flow = flow;
  const tt = (F.tidTex = new THREE.DataTexture(tdata, w, h, THREE.RGBAFormat, THREE.HalfFloatType));
  tt.magFilter = tt.minFilter = THREE.LinearFilter;
  tt.wrapS = tt.wrapT = THREE.ClampToEdgeWrapping;
  tt.needsUpdate = true;
  const tex = (F.tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType));
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Bilinear, at texel centres, exactly as the GPU filters the texture. out = [swell, wind].
const _sh = [0, 0];
export function shelterAt(x, z, out = _sh) {
  const F = fieldAt(z);
  if (!F.data) bakeShelter(F === FIELDS.south ? 'south' : 'home');
  const R = F.rect, { w, h } = F, shelterData = F.data;
  const u = ((x - R.x) / R.w) * w - 0.5, v = ((z - R.z) / R.h) * h - 0.5;
  const i = clamp(Math.floor(u), 0, w - 2), j = clamp(Math.floor(v), 0, h - 2);
  const fu = clamp(u - i, 0, 1), fv = clamp(v - j, 0, 1);
  for (let c = 0; c < 2; c++) {
    const at = (ii, jj) => shelterData[(jj * w + ii) * 2 + c];
    out[c] = lerp(lerp(at(i, j), at(i + 1, j), fu), lerp(at(i, j + 1), at(i + 1, j + 1), fu), fv);
  }
  return out;
}
export const SHELTER_RECT = WATER_RECT; // (home's; the far south's is shelterRect('south'))

/* ---------------- the shared state ---------------- */

// Sea states for the setting, and what the weather brings when it's left to the weather.
// wind: [low, high] sustained m/s; swell: crest amplitude in m.
export const SEA_PRESETS = {
  calm: { name: 'Calm', wind: [0.5, 3.5], swell: 0.08, note: 'Light airs and a gentle swell. Easy casting and still water in the bays.' },
  moderate: { name: 'Moderate', wind: [4, 8.5], swell: 0.3, note: 'A good breeze, a few whitecaps and a swell outside; the bays stay sheltered.' },
  lively: { name: 'Lively', wind: [8, 13], swell: 0.55, note: 'A fresh to strong wind, whitecaps everywhere in the open, a long swell breaking on the outer coast. Shelter in the bays and coves.' },
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
// The wind sea: four wavelengths, from short wavelets to long wind waves, each in six fixed
// directions (each length's set turned a little, so they never line up); the wind's direction
// weights them (so a turning wind turns the sea without any wave jumping), and the wind's
// strength decides how much of the sea is in the longer ones (on: the wind, m/s, over which a
// length builds; bias: its share once built). Shorter waves than these are the water's own
// surface detail (see water.js).
const CHOP_BANDS = [{ len: 9, on: [0, 0.1], bias: 0.6 }, { len: 15, on: [2, 6], bias: 1 }, { len: 26, on: [5, 10], bias: 1.3 }, { len: 42, on: [8, 14], bias: 1.5 }];
const CHOP = [];
CHOP_BANDS.forEach((B, band) => {
  for (let d = 0; d < 6; d++) {
    const ang = (d / 6) * TAU + band * 0.37;
    const k = TAU / B.len;
    CHOP.push({ dx: Math.sin(ang), dz: -Math.cos(ang), k, c: Math.sqrt(9.81 / k), band, ang });
  }
});
// Swell running into shallow water: it slows, grows and steepens over the last few metres, and
// once it's broken (in water not much deeper than the wave is high) it shrinks again, spent
// (depth: metres of water). Its crests never peak more than a storm's.
export const shoalGrow = (depth) => 1 + 0.8 * smoothstep(8, 2.5, depth) * smoothstep(0.8, 2.2, depth);
export const shoalPeak = (depth) => 1.4 * smoothstep(5, 1.5, depth);
const MAX_PEAK = 3.6;
export const WAVE_COUNTS = { swell: SWELL.length, chop: CHOP.length };

// The tide as it is now (see tide.js): flow +1 ebb (out to sea) … −1 flood; level, metres above
// the mean. (Left to itself, as in the tests, a steady ebb at mean level.)
export const TIDE = { flow: 1, level: 0 };
const TRADES_FROM = 0.8; // the trade wind's bearing: from the north-east

export const conditions = {
  time: 0, // the shared wave clock (seconds), set by the game each frame
  // Wind: from (compass radians, where it blows from), sustained speed (m/s), and the slow drifts
  // that move them when left to the weather.
  wind: { from: 3.9, speed: 3, target: 3, turn: 0, timer: 0, gust: 0 },
  // Sea: the swell's crest amplitude (m) and the chop's (m), each easing towards its target; how
  // stormy it is (0 … 1, building over a minute or two and dying away more slowly) and how much
  // the swell stands up in peaks.
  sea: { swell: 0.1, chop: 0.05, storm: 0, peak: 1, chopPeak: 1 },
  // The hour of the day (set by the game; null: no daily cycle, as in the tests), for the sea
  // breeze and the trade wind's afternoon freshening.
  hour: null,
  // From Settings: 'auto' (follow the weather) or a SEA_PRESETS id; wind 'auto' or manual.
  preset: 'auto', manual: null, currents: 'natural',
  // Which sea you're in ('home', or 'south' at Las Brasas, where the trade wind blows).
  region: 'home',
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
    const trades = C.region === 'south' && storm < 0.3;
    if (W.timer <= 0 || (storm > 0.3 && W.target < 12 * storm)) {
      W.timer = (70 + Math.random() * 110) * (1 - storm * 0.5);
      // (At Las Brasas, the trade wind: a steady fresh breeze from the north-east, seldom calm.
      // At home, the weather's own wind: a breeze most days, fresher under cloud and in rain.)
      const [lo, hi] = P && storm < 0.3 ? P.wind : trades ? [7, 11.5] : [lerp(3 + weather.cloud * 1.5, 13, storm), lerp(8.5 + weather.rain * 4, 18.5, storm)];
      W.target = clamp(lerp(lo, hi, Math.random()) + weather.rain * 2 * (1 - storm), 0, 20);
      W.turn = (Math.random() - 0.5) * 0.004 * (1 + storm * 2);
    }
    W.from = (W.from + W.turn * dt + TAU) % TAU;
    if (trades) W.from = dampAngleTo(W.from, TRADES_FROM + Math.sin(C.time * 0.0021) * 0.25, 0.01, dt);
    // The day's own wind, on a fair day: at home a sea breeze sets in towards midday, blowing in
    // from the sea (the south) and freshening through the afternoon, and a lighter land breeze at
    // night; at Las Brasas the trade wind freshens in the afternoon.
    const day = dayWind(C.hour) * (1 - storm) * (P ? 0 : 1) * (1 - 0.6 * (weather.cloud || 0));
    W.daily = trades ? Math.max(0, day) * 0.6 : day;
    if (!trades && day > 0.2) W.from = dampAngleTo(W.from, Math.PI, 0.004 * day, dt);
  }
  W.speed = damp(W.speed, Math.max(0, W.target + (C.manual ? 0 : W.daily || 0)), 0.05, dt);
  // The sea follows: chop within half a minute or so, the swell over a few minutes; a storm's big
  // seas build over a minute or two and take longer to die away.
  const stormTarget = weather.storm || 0;
  C.sea.storm = damp(C.sea.storm, stormTarget, stormTarget > C.sea.storm ? 0.014 : 0.006, dt);
  C.sea.peak = 1 + 2.4 * smoothstep(0.15, 1, C.sea.storm);
  // (The Atlantic swell comes and goes over hours too: some days a long one is running.)
  const swellTarget = (P ? P.swell : 0.18 + weather.cloud * 0.1 + weather.rain * 0.15 + 0.08 * Math.sin(C.time * 0.0006)) * (C.manual ? 0.6 + C.manual.speed / 25 : 1) + 2.1 * C.sea.storm;
  C.sea.swell = damp(C.sea.swell, swellTarget, 0.008 + 0.012 * C.sea.storm, dt);
  C.sea.chop = damp(C.sea.chop, chopFor(W.speed), 0.04, dt);
  // A fresh wind's sea is steep, its crests sharp (and breaking: see water.js).
  C.sea.chopPeak = 1 + 1.2 * smoothstep(5, 14, W.speed);
  // How the wind sea is shared between its lengths (longer ones as the wind freshens), and in
  // each, between its fixed directions: the ones the wind blows along.
  const to = W.from + Math.PI;
  let bandSum = 0;
  for (let b = 0; b < CHOP_BANDS.length; b++) {
    const B = CHOP_BANDS[b];
    BAND_SHARE[b] = smoothstep(B.on[0], B.on[1], W.speed) * B.bias;
    bandSum += BAND_SHARE[b];
  }
  const dirSum = new Float32Array(CHOP_BANDS.length);
  for (let i = 0; i < CHOP.length; i++) {
    const a = Math.max(0, Math.cos(CHOP[i].ang - to));
    C.chopAmps[i] = a * a;
    dirSum[CHOP[i].band] += C.chopAmps[i];
  }
  for (let i = 0; i < CHOP.length; i++) {
    const b = CHOP[i].band;
    C.chopAmps[i] = (C.chopAmps[i] / (dirSum[b] || 1)) * C.sea.chop * (BAND_SHARE[b] / (bandSum || 1));
  }
  for (let i = 0; i < SWELL.length; i++) C.swellAmps[i] = C.sea.swell * (SWELL[i].share * (1 - 0.5 * C.sea.storm) + SWELL[i].storm * C.sea.storm);
}
// The wind sea's crest amplitude for a sustained wind (m/s): a ripple in light air, about half a
// metre crest to trough in a moderate breeze and a metre in a strong one, where it has room to
// build (less in the bays, where the fetch is short: see the shelter).
const chopFor = (u) => 0.02 + 0.005 * Math.pow(u, 1.75);
const BAND_SHARE = new Float32Array(CHOP_BANDS.length);
// The day's own wind, as a share of a few m/s: the sea breeze building from late morning to a
// mid-afternoon peak and dying by dusk, a lighter land breeze in the small hours. (No hour: none.)
export function dayWind(hour) {
  if (hour == null) return 0;
  const breeze = smoothstep(10, 14, hour) * (1 - smoothstep(17, 20.5, hour));
  const night = smoothstep(21, 23, hour) + 1 - smoothstep(4, 7, hour);
  return 3.5 * breeze - 1.2 * Math.min(1, night);
}
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
  const gust = 1 + (0.45 + 0.3 * conditions.sea.storm) * Math.max(0, g - 0.45) / 0.55;
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
  const C = conditions, sh = shelterAt(x, z), depth = Math.max(0, -solidHeight(x, z));
  let hs = 0, hc = 0;
  // (Sheltered, each wave is smaller there before it peaks, as the shader does it; running into
  // shallow water the swell grows and steepens.)
  const peak = Math.min(C.sea.peak + shoalPeak(depth), MAX_PEAK), grow = shoalGrow(depth);
  for (let i = 0; i < SWELL.length; i++) {
    const w = SWELL[i], a = C.swellAmps[i] * sh[0] * grow;
    if (a < 1e-5) continue;
    hs += swellShape(a, w.k, w.k * (w.dx * x + w.dz * z - w.c * t), peak);
  }
  const cp = C.sea.chopPeak;
  for (let i = 0; i < CHOP.length; i++) {
    const a = C.chopAmps[i];
    if (a < 1e-5) continue;
    const w = CHOP[i];
    hc += swellShape(a, w.k, w.k * (w.dx * x + w.dz * z - w.c * t), cp);
  }
  return TIDE.level * (1 - freshness(x, z)) + (hs + hc * (0.15 + 0.85 * sh[1])) * shoreFade(x, z);
}
// The tidal streams' texture for the water shader (see bakeShelter): they turn with uTideFlow.
export function tidalTexture(region = 'home') {
  bakeShelter(region);
  return FIELDS[region].tidTex;
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
  // (Las Brasas: the Canary current, see brasa.js.)
  if (z > SOUTH_Z) return brasaCurrent(x, z, out);
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
  const F = fieldAt(z);
  if (!F.cur) bakeShelter(F === FIELDS.south ? 'south' : 'home');
  const R = F.rect, { w, h } = F, currentData = F.cur, tidal = F.tid, flow = TIDE.flow;
  const u = ((x - R.x) / R.w) * w - 0.5, v = ((z - R.z) / R.h) * h - 0.5;
  const i = clamp(Math.floor(u), 0, w - 2), j = clamp(Math.floor(v), 0, h - 2);
  const fu = clamp(u - i, 0, 1), fv = clamp(v - j, 0, 1);
  for (let c = 0; c < 2; c++) {
    const at = (ii, jj) => currentData[(jj * w + ii) * 2 + c] + flow * tidal[(jj * w + ii) * 2 + c];
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
