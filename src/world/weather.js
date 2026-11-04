import { damp, rand, pick } from '../util.js';
import { galeSky } from './forecast.js';
import { seasonOf } from './season.js';

// The sky: which weather it is (clear, partly, overcast, light rain, heavy rain, storm), and how
// cloudy, wet and stormy it is just now (each easing towards the weather's own, 0 … 1).
//
// Left to itself ('auto') the weather wanders from one to the next, leaned by the season (grey and
// wet in winter, fine in summer), and a gale forecast for the day makes its own sky. Chosen in
// Settings, it's what you chose. Playing together, a joiner's sky is the host's (see together.js).

export const SKIES = {
  clear: { cloud: 0.06, rain: 0, word: '' },
  partly: { cloud: 0.4, rain: 0, word: 'Partly cloudy' },
  overcast: { cloud: 0.86, rain: 0, word: 'Overcast' },
  light: { cloud: 0.82, rain: 0.36, word: 'Light rain' },
  heavy: { cloud: 1, rain: 0.92, word: 'Heavy rain' },
  // A gale off the Atlantic: the wind gets up, the big seas roll in, thunder and lightning.
  storm: { cloud: 1, rain: 1, storm: 1, word: 'Storm' },
};
export const SKY_IDS = Object.keys(SKIES);
// When it changes by itself: what can come next (a list may repeat an entry to make it likelier).
export const NEXT_SKY = {
  clear: ['partly', 'partly', 'clear'],
  partly: ['clear', 'overcast', 'partly'],
  overcast: ['partly', 'light', 'overcast'],
  light: ['overcast', 'heavy', 'partly', 'light'],
  heavy: ['light', 'light', 'heavy'],
  storm: ['heavy'],
};
// (Storms don't come by chance: gales are forecast a day ahead, see forecast.js.)
// The season leans the weather: grey and wet in winter, fine in summer.
export const SEASON_SKY = {
  spring: { overcast: ['light', 'partly'] },
  summer: { partly: ['clear', 'clear'], overcast: ['partly'], light: ['partly'], heavy: ['light'] },
  autumn: { partly: ['overcast'], overcast: ['light'] },
  winter: { clear: ['overcast', 'partly'], partly: ['overcast', 'light'], overcast: ['light', 'overcast'], light: ['heavy', 'light'] },
};
// At Las Brasas, the trade-wind weather: mostly fine, cloud banking up now and then, a passing
// shower, very seldom anything worse.
export const NEXT_SKY_SOUTH = {
  clear: ['clear', 'partly', 'clear'],
  partly: ['clear', 'partly', 'clear', 'overcast'],
  overcast: ['partly', 'partly', 'light'],
  light: ['partly', 'overcast'],
  heavy: ['light', 'overcast'],
  storm: ['heavy'],
};

// The weather as saved (state.sky), or a fresh one. mode: Settings' choice ('auto' or a sky);
// rained: whether it has rained before (a first game keeps the first shower waiting a while).
export function createWeather(saved, { mode = 'auto', rained = false } = {}) {
  const S = saved && SKIES[saved.state] ? saved : { state: 'partly', cloud: SKIES.partly.cloud, rain: 0, timer: rained ? rand(120, 220) : 240 };
  const W = {
    rain: S.rain ?? 0, cloud: S.cloud ?? SKIES[S.state].cloud, storm: S.storm || 0, state: S.state, timer: S.timer ?? 200,
    get target() { return SKIES[this.state].rain; },
    override: null, // a fixed rain level, for testing (slowTide.setRain)
  };
  if (mode !== 'auto' && SKIES[mode]) W.state = mode;
  return W;
}

// One step of the weather. dt: real seconds; speed: how fast time runs (resting, sitting).
// mode: Settings' choice; region: 'home' or 'south'; abs: the world's time (game hours);
// host: the session host's sky to follow ({ state, cloud, rain, storm }), or null.
// Returns 'auto' when it wandered by itself (so the game can give its gale warnings).
export function stepWeather(W, dt, { mode = 'auto', region = 'home', abs = 0, speed = 1, host = null }) {
  if (host) {
    // Playing together: the host's sky, eased onto (their changes are already gentle, and come
    // every couple of seconds: this only smooths the steps between).
    W.state = SKIES[host.state] ? host.state : W.state;
    const k = 1.5;
    W.rain = damp(W.rain, W.override ?? host.rain, k, dt);
    W.cloud = damp(W.cloud, Math.max(host.cloud, W.override ?? 0), k, dt);
    W.storm = damp(W.storm, host.storm, k * 0.8, dt);
    return 'host';
  }
  if (mode !== 'auto' && SKIES[mode]) {
    W.state = mode;
  } else {
    W.timer -= dt * Math.min(speed, 10);
    // A gale on its way (or blowing) makes the sky; otherwise it wanders as the season leans it.
    const forced = region === 'home' ? galeSky(abs) : null;
    if (forced) {
      W.state = forced;
      W.timer = Math.max(W.timer, 20);
    } else if (W.timer <= 0) {
      const lean = region === 'home' ? SEASON_SKY[seasonOf(Math.floor(abs / 24)).name][W.state] || [] : [];
      W.state = pick([...(region === 'south' ? NEXT_SKY_SOUTH : NEXT_SKY)[W.state], ...lean]);
      if (W.state === 'storm') W.state = 'heavy';
      W.timer = W.state === 'heavy' ? rand(60, 110) : W.state === 'light' ? rand(80, 150) : rand(150, 300);
    }
  }
  const sky = SKIES[W.state];
  // A change you choose settles in about ten seconds; a change by itself drifts in more slowly.
  const auto = mode === 'auto' || !SKIES[mode];
  const rate = (auto ? 0.08 : 0.3) * Math.min(speed, 6);
  W.rain = damp(W.rain, W.override ?? sky.rain, rate, dt);
  W.cloud = damp(W.cloud, Math.max(sky.cloud, W.override ?? 0), rate, dt);
  W.storm = damp(W.storm, sky.storm || 0, rate * 0.8, dt);
  return auto ? 'auto' : 'chosen';
}

// The weather as it's saved, or sent to the others in a session.
export function skyOf(W) {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { cloud: r3(W.cloud), rain: r3(W.rain), storm: r3(W.storm), state: W.state, timer: r3(W.timer) };
}
