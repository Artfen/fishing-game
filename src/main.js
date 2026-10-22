import * as THREE from 'three';
import { Input } from './input.js';
import { loadState, saveState, clearState } from './save.js';
import { HUD, kbd } from './ui.js';
import { AudioScape } from './audio.js';
import { Environment, phaseName, formatClock } from './world/sky.js';
import { createWater, sea } from './world/water.js';
import { buildWorld } from './world/world.js';
import { bakeHeightTexture, heightAt, solidHeight, landSDF, zoneAt, PLACES, START, WATER_RECT, STACKS } from './world/terrain.js';
import { Boat } from './boat.js';
import { Effects } from './effects.js';
import { Fishing } from './fishing.js';
import { FISH, pickFish, buildFishMesh, drawFishSketch, drawLanternSketch } from './fish.js';
import { Journal } from './journal.js';
import { setupTouch } from './touch.js';
import { PRESETS, CHOICES, FrameWatch, lowerLevel, startingLevel } from './quality.js';
import { clamp, lerp, damp, dampAngle, smoothstep, rand, pick } from './util.js';

const HOUR_SECONDS = 40; // one in-game hour lasts 40 real seconds
const REST_SPEED = 30;   // holding T lets time drift by
const $ = (id) => document.getElementById(id);

const state = loadState();
const hud = new HUD();
const audio = new AudioScape();
audio.musicOn = state.music !== false;

/* ---------------- scene ---------------- */

function notice(text, action) {
  $('loading')?.remove();
  $('notice-text').textContent = text;
  $('notice-btn').hidden = !action;
  if (action) $('notice-btn').onclick = action;
  $('notice').hidden = false;
}

const canvas = $('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  notice('Slow Tide needs WebGL, which this browser has switched off or does not support. A recent Chrome, Firefox, Safari or Edge should work.');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xd5ebf1, 0.0021);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2500);

const env = new Environment(scene);
const water = createWater(bakeHeightTexture(512, WATER_RECT), WATER_RECT);
scene.add(water.mesh);
const world = buildWorld(scene, renderer);
const fx = new Effects(scene);
const boat = new Boat(scene);
const journal = new Journal(state);
const input = new Input(canvas);
const touch = setupTouch(input);

if (state.boat && solidHeight(state.boat.x, state.boat.z) < -1) boat.place(state.boat.x, state.boat.z, state.boat.heading);
else boat.place(START.x, START.z, START.heading);
if (state.items.lantern) {
  boat.setLantern(true);
  world.takeLantern();
}

const weather = { rain: 0, target: 0, timer: state.tips.rained ? rand(120, 220) : 240 };
let t = 0;
let started = false;
let modal = null; // 'journal' | 'catch' | 'note'
let hudOff = false;
let rowTime = 0;

/* ---------------- fishing ---------------- */

function fishContext(x, z) {
  return { zone: zoneAt(x, z), hour: state.hour, rain: weather.rain, lantern: boat.hasLantern, depth: -solidHeight(x, z) };
}

const cam = {
  yaw: START.heading + 0.7, pitch: 0.28, pitchT: 0.46, dist: 28, distT: 15,
  target: new THREE.Vector3(boat.pos.x, 1.2, boat.pos.z), lastManual: -99, settleUntil: 0, shake: 0,
};

const fishing = new Fishing(scene, boat, fx, audio, {
  context: fishContext,
  hasCaught: () => Object.keys(state.fish).length > 0,
  flash: (text) => hud.flash(text, t),
  shake: (s) => { cam.shake = Math.max(cam.shake, s); },
  onCast: () => {
    if (!state.tips.cast) {
      state.tips.cast = true;
      save();
    }
  },
  onHook: () => {},
  onCatch: showCatch,
  onRelease: hideCatch,
});

const REPEAT_LINES = [
  'Another lovely one.',
  'It flicks its tail, ready to go home.',
  'The scales catch the light for a moment.',
  'Heavier than it looks.',
  'It eyes you, unimpressed.',
];

function showCatch(sp, size) {
  const isNew = !state.fish[sp.id];
  if (isNew) {
    state.fish[sp.id] = {
      count: 0, best: 0, firstDay: state.day, firstHour: state.hour,
      firstZone: zoneAt(fishing.fishPos.x, fishing.fishPos.z), firstRain: weather.rain > 0.4,
    };
  }
  const rec = state.fish[sp.id];
  const record = !isNew && size > rec.best;
  rec.count++;
  rec.best = Math.max(rec.best, size);
  state.tips.caught = true;
  save();

  const cv = $('cc-canvas');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawFishSketch(ctx, sp, cv.width / 2, cv.height / 2 + 6, cv.width * 0.72);
  $('cc-new').hidden = !isNew;
  $('cc-name').textContent = sp.name;
  $('cc-size').textContent = `${size} cm${record ? ' · your biggest yet' : ''}`;
  $('cc-note').textContent = isNew ? sp.note : pick(REPEAT_LINES);
  $('catch-card').hidden = false;
  modal = 'catch';
  if (isNew) {
    audio.fanfare();
    hud.pulseJournal();
  } else audio.chime();
}

function hideCatch() {
  $('catch-card').hidden = true;
  modal = null;
  hud.flash('Back into the water it goes', t, 2.4);
}

/* ---------------- discoveries ---------------- */

const lanternReach = () => !state.items.lantern && Math.hypot(boat.pos.x - world.lanternSpot.x, boat.pos.z - world.lanternSpot.z) < 10;

function takeLantern() {
  state.items.lantern = true;
  world.takeLantern();
  boat.setLantern(true);
  const cv = $('nc-canvas');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawLanternSketch(ctx, cv.width / 2, cv.height / 2 + 8, 62);
  $('nc-title').textContent = 'An old brass lantern';
  $('nc-text').textContent = 'Tangled in the driftwood, just above the tideline: a little brass lantern, dented but whole. You hang it at the stern of your boat. When evening comes, it will glow.';
  $('note-card').hidden = false;
  modal = 'note';
  audio.fanfare();
  hud.pulseJournal();
  save();
}

function closeNote() {
  $('note-card').hidden = true;
  modal = null;
}

let placeTimer = 0;
function checkPlaces(dt) {
  placeTimer -= dt;
  if (placeTimer > 0) return;
  placeTimer = 0.4;
  for (const p of PLACES) {
    if (state.places[p.id] || !p.test(boat.pos.x, boat.pos.z)) continue;
    state.places[p.id] = { day: state.day, hour: state.hour };
    hud.place(p.name, p.sub);
    audio.chime();
    hud.toast(`${p.name} is in your journal now`);
    hud.pulseJournal();
    save();
  }
}

function moments() {
  const h = state.hour;
  if (!state.tips.dusk && h > 17.6 && h < 19.5) {
    state.tips.dusk = true;
    hud.toast('The light turns gold. Some fish only stir after sundown.', 6);
  }
  if (!state.tips.rained && weather.rain > 0.5) {
    state.tips.rained = true;
    hud.toast('Rain patters on the boat. Out past the bay, something is rising.', 6);
  }
  if (!state.tips.night && (h > 21 || h < 4.5)) {
    state.tips.night = true;
    hud.toast(state.items.lantern ? 'Night settles in. The lantern keeps you company.' : 'Night settles in. A light would be nice out here.', 6);
  }
}

/* ---------------- ambient fish ---------------- */

const jumpers = Object.fromEntries(FISH.map((f) => {
  const m = buildFishMesh(f);
  scene.add(m);
  return [f.id, m];
}));
let jumpTimer = 5;
function ambientJumps(dt) {
  jumpTimer -= dt;
  if (jumpTimer > 0) return;
  jumpTimer = rand(5, 12);
  for (let tries = 0; tries < 6; tries++) {
    const a = rand(0, Math.PI * 2), r = rand(10, 40);
    const x = boat.pos.x + Math.cos(a) * r, z = boat.pos.z + Math.sin(a) * r;
    if (solidHeight(x, z) > -1.5) continue;
    const { fish, total } = pickFish(fishContext(x, z));
    if (total < 0.08) continue;
    const m = jumpers[fish.id];
    if (m.visible) continue;
    fx.jump(m, x, z, rand(0, Math.PI * 2));
    break;
  }
}

/* ---------------- audio hooks ---------------- */

boat.onStroke = (p, side) => {
  fx.ripple(p.x, p.z, 0.9, 1.1, 0.4);
  fx.splash(p.x, 0.05, p.z, 4, 1.2, 0.4);
  audio.oar(side > 0 ? -0.3 : 0.3, 0.8);
};
boat.onBump = (v) => audio.knock(clamp(v / 3, 0.4, 1));
fx.onJumpSplash = (x, z, vol) => {
  const d = Math.hypot(x - boat.pos.x, z - boat.pos.z);
  const side = (x - camera.position.x) * Math.cos(cam.yaw) - (z - camera.position.z) * Math.sin(cam.yaw);
  audio.splashSmall(vol * clamp(1 - d / 50, 0, 1), clamp(-side / 20, -0.8, 0.8));
};

/* ---------------- rain ---------------- */

const RAIN_N = 1400;
const rainPos = new Float32Array(RAIN_N * 6);
for (let i = 0; i < RAIN_N; i++) {
  const x = rand(-26, 26), y = rand(-1, 26), z = rand(-26, 26);
  rainPos.set([x, y, z, x + 0.08, y + 0.75, z], i * 6);
}
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: '#d3dcea', transparent: true, opacity: 0, depthWrite: false });
const rainLines = new THREE.LineSegments(rainGeo, rainMat);
rainLines.frustumCulled = false;
scene.add(rainLines);

/* ---------------- graphics quality ---------------- */

const quality = {
  choice: CHOICES.includes(state.quality) ? state.quality : 'auto',
  autoLevel: startingLevel(touch.active),
};
const frameWatch = new FrameWatch();
const qualityLevel = () => (quality.choice === 'auto' ? quality.autoLevel : quality.choice);

function applyQuality() {
  const q = PRESETS[qualityLevel()];
  const pr = Math.min(window.devicePixelRatio, q.pixelRatio);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  env.setShadows(q.shadows, q.shadowSize);
  water.setSegments(q.waterSegments);
  rainGeo.setDrawRange(0, q.rain * 2);
  world.setPixelRatio(pr);
  const text = quality.choice === 'auto' ? `Graphics: Auto (${q.label})` : `Graphics: ${q.label}`;
  $('set-quality').textContent = text;
  $('title-quality').textContent = text;
}

function cycleQuality() {
  quality.choice = CHOICES[(CHOICES.indexOf(quality.choice) + 1) % CHOICES.length];
  state.quality = quality.choice;
  frameWatch.reset();
  applyQuality();
  save();
}

function watchFrameRate(rawDt) {
  if (quality.choice !== 'auto' || !started || modal) return;
  if (!frameWatch.tooSlow(rawDt)) return;
  const next = lowerLevel(quality.autoLevel);
  if (!next) return;
  quality.autoLevel = next;
  applyQuality();
  frameWatch.reset(3);
}

function updateRain(dt) {
  rainLines.visible = weather.rain > 0.02;
  if (!rainLines.visible) return;
  rainMat.opacity = 0.42 * weather.rain;
  rainLines.position.set(cam.target.x, 0, cam.target.z);
  for (let i = 0; i < RAIN_N; i++) {
    const o = i * 6;
    let y = rainPos[o + 1] - 21 * dt;
    if (y < -1) y += 27;
    rainPos[o + 1] = y;
    rainPos[o + 4] = y + 0.75;
  }
  rainGeo.attributes.position.needsUpdate = true;
}

function updateWeather(dt, speed) {
  weather.timer -= dt * Math.min(speed, 10);
  if (weather.timer <= 0) {
    if (weather.target > 0) {
      weather.target = 0;
      weather.timer = rand(170, 280);
    } else {
      weather.target = rand(0.7, 1);
      weather.timer = rand(80, 130);
    }
  }
  weather.rain = damp(weather.rain, weather.target, 0.12 * Math.min(speed, 6), dt);
  sea.amp = 1 + weather.rain * 0.45;
}

/* ---------------- camera ---------------- */

const _look = new THREE.Vector3();
function updateCamera(dt) {
  const drag = input.takeDrag();
  const wheel = input.takeWheel();
  if (!started) {
    cam.yaw += dt * 0.045;
  } else {
    if (drag.x || drag.y) {
      cam.yaw -= drag.x * 0.0055;
      cam.pitchT = clamp(cam.pitchT + drag.y * 0.004, 0.12, 1.2);
      cam.lastManual = t;
    }
    if (wheel) cam.distT = clamp(cam.distT * Math.exp(wheel * 0.0012), 6, 40);
    let follow = 0;
    if (t < cam.settleUntil) follow = 1.4;
    else if (t - cam.lastManual > 3 && !fishing.busy) follow = 1.1 * smoothstep(0.6, 3.5, boat.forwardSpeed);
    if (follow > 0) cam.yaw = dampAngle(cam.yaw, boat.heading, follow, dt);
  }
  cam.pitch = damp(cam.pitch, started ? cam.pitchT : 0.26, started ? 4 : 1, dt);
  cam.dist = damp(cam.dist, started ? cam.distT + (fishing.lineOut ? 3 : 0) : 26, started ? 3 : 1, dt);

  let fx_ = boat.pos.x, fz_ = boat.pos.z;
  if (fishing.lineOut) {
    fx_ = lerp(fx_, fishing.bob.x, 0.35);
    fz_ = lerp(fz_, fishing.bob.z, 0.35);
  }
  cam.target.x = damp(cam.target.x, fx_, 4, dt);
  cam.target.z = damp(cam.target.z, fz_, 4, dt);
  cam.target.y = damp(cam.target.y, boat.heave + 1.2, 4, dt);

  const hd = cam.dist * Math.cos(cam.pitch);
  camera.position.set(
    cam.target.x - Math.sin(cam.yaw) * hd,
    cam.target.y + cam.dist * Math.sin(cam.pitch),
    cam.target.z - Math.cos(cam.yaw) * hd,
  );
  const ground = Math.max(heightAt(camera.position.x, camera.position.z), 0) + 1.2;
  if (camera.position.y < ground) camera.position.y = ground;
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt);
    const s = cam.shake * 0.12;
    camera.position.x += rand(-s, s);
    camera.position.y += rand(-s, s);
  }
  // Aim a little above the boat so the horizon and the scenery stay in frame.
  // Portrait and short landscape screens aim lower, so the boat isn't pushed under the controls.
  _look.copy(cam.target);
  _look.y += (1.6 + cam.dist * 0.06) * clamp(camera.aspect, 0.3, 1) * clamp(innerHeight / 640, 0.55, 1);
  camera.lookAt(_look);
}

// Keep a reasonable side-to-side view on portrait phones by widening the vertical field of view.
function fitCamera() {
  const aspect = innerWidth / innerHeight;
  camera.aspect = aspect;
  camera.fov = Math.min(78, Math.max(50, (2 * Math.atan(Math.tan((20 * Math.PI) / 180) / aspect) * 180) / Math.PI));
  camera.updateProjectionMatrix();
}
fitCamera();

/* ---------------- HUD ---------------- */

function currentHint() {
  if (!started || modal) return '';
  const L = (c) => kbd(input.label(c));
  // On touch screens "the button" is the round action button on the right.
  const T = touch.active;
  const space = kbd('Space');
  switch (fishing.state) {
    case 'charging': return T ? 'Let go to cast · drag the view to aim' : `Release ${space} to cast · drag to aim`;
    case 'waiting':
      if (state.tips.caught) return T ? 'Waiting for a bite · tap to twitch the line · hold to reel in' : `Waiting for a bite · tap ${space} to twitch the line · hold to reel in`;
      return T ? 'Watch the bobber. Tap the button when it dips under' : `Watch the bobber. Press ${space} when it dips under`;
    case 'bite': return T ? 'Bite! Tap the button' : `Bite! Press ${space}`;
    case 'reeling':
      if (fishing.pulling) return T ? "It's pulling. Let go until it tires" : `It's pulling. Let go of ${space} until it tires`;
      return T ? 'Hold the button to reel in' : `Hold ${space} to reel in`;
    case 'casting': case 'landing': case 'caught': case 'releasing': case 'retrieving': return '';
    default:
  }
  if (!state.tips.rowed) return T ? 'Drag on the left to row · drag on the right to look around' : `${L('KeyW')}${L('KeyA')}${L('KeyS')}${L('KeyD')} to row · drag to look around`;
  if (!state.tips.cast) return T ? 'Hold the button to cast your line' : `Hold ${space} to cast your line`;
  if (state.tips.caught && !state.tips.journal) return T ? 'Tap Journal to see what you’ve found' : `${kbd('J')} to open your journal`;
  return '';
}

const ACTION_LABELS = {
  idle: 'Cast', charging: 'Let go', casting: '', waiting: 'Twitch', bite: 'Hook!', reeling: 'Reel',
  landing: '', caught: 'Let go', releasing: '', retrieving: '',
};

function actionLabel() {
  if (modal === 'note') return 'OK';
  if (fishing.state === 'reeling' && fishing.pulling) return 'Easy';
  return ACTION_LABELS[fishing.state] ?? '';
}

const _p = new THREE.Vector3();
function updateHud() {
  const h = state.hour;
  const night = h >= 20.5 || h < 5.5;
  const w = weather.rain > 0.6 ? 'Rain' : weather.rain > 0.15 ? 'Light rain' : '';
  hud.clock(formatClock(h), phaseName(h), w, night);
  hud.hint(currentHint(), t);
  const near = started && !modal && !fishing.busy && lanternReach();
  hud.prompt(near ? (touch.active ? 'Tap to look closer at the driftwood' : `${kbd('E')} Look closer at the driftwood`) : '');
  if (touch.active) hud.action(actionLabel(), fishing.state === 'bite');

  const F = fishing.fight;
  if (fishing.state === 'charging') hud.meter(true, fishing.power, -1, 0, 'cast');
  else if (fishing.state === 'reeling' && F) hud.meter(true, F.progress, F.tension, F.tension, F.pulling ? 'easy' : 'reel');
  else hud.meter(false);

  let showBite = false;
  if (fishing.state === 'bite' && !modal) {
    _p.copy(fishing.bob);
    _p.y += 0.35;
    _p.project(camera);
    showBite = _p.z < 1;
    hud.bite((_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight, showBite);
  } else hud.bite(0, 0, false);
}

/* ---------------- input ---------------- */

let resetting = false;
function save() {
  if (resetting) return;
  state.boat = { x: boat.pos.x, z: boat.pos.z, heading: boat.heading };
  saveState(state);
}

function begin() {
  if (started) return;
  started = true;
  audio.start();
  document.body.classList.add('started');
  frameWatch.reset();
  $('title').classList.add('gone');
  setTimeout(() => { $('title').hidden = true; }, 1600);
  const returning = !!state.places.bay;
  if (!returning) state.places.bay = { day: state.day, hour: state.hour };
  setTimeout(() => hud.place('Willow Bay', returning ? 'welcome back' : 'home waters'), 900);
  cam.settleUntil = t + 2.5;
  save();
}

function openJournal() {
  journal.open(boat);
  modal = 'journal';
  audio.page();
  if (!state.tips.journal) {
    state.tips.journal = true;
    save();
  }
}

function closeJournal() {
  journal.close();
  modal = null;
  audio.page();
}

input.on('press', (code, key) => {
  if (!started) {
    if (code !== 'Tab') begin();
    return;
  }
  audio.start();
  if (modal === 'note') {
    if (code === 'Space' || code === 'Enter' || code === 'Escape' || key === 'e') closeNote();
    return;
  }
  if (key === 'j' || code === 'Tab') {
    if (modal === 'journal') closeJournal();
    else if (!modal) openJournal();
    return;
  }
  if (modal === 'journal') {
    if (code === 'Escape') closeJournal();
    return;
  }
  if (code === 'Space') {
    fishing.onDown();
    return;
  }
  if (modal) return;
  if (key === 'e' && lanternReach()) takeLantern();
  else if (key === 'm') {
    state.music = audio.toggleMusic();
    hud.toast(state.music ? 'Music on' : 'Music off', 1.6);
    save();
  } else if (key === 'h') {
    hudOff = !hudOff;
    hud.hidden(hudOff);
  } else if (code === 'Escape') fishing.cancel();
});
input.on('release', (code) => {
  if (code === 'Space') fishing.onUp();
});
input.on('pointer', () => {
  if (!started) begin();
  else audio.start();
});

$('start-btn').addEventListener('click', begin);
$('journal-btn').addEventListener('click', () => {
  if (modal === 'journal') closeJournal();
  else if (!modal) openJournal();
});
$('j-close').addEventListener('click', closeJournal);
$('journal').addEventListener('click', (e) => { if (e.target === $('journal')) closeJournal(); });
$('catch-card').addEventListener('click', () => { if (modal === 'catch') fishing.onDown(); });
$('note-card').addEventListener('click', closeNote);
$('prompt').addEventListener('click', () => { if (lanternReach()) takeLantern(); });
$('set-quality').addEventListener('click', cycleQuality);
$('title-quality').addEventListener('click', (e) => {
  e.stopPropagation();
  cycleQuality();
});
const musicLabel = () => { $('set-music').textContent = `Music: ${state.music !== false ? 'on' : 'off'}`; };
$('set-music').addEventListener('click', () => {
  state.music = audio.toggleMusic();
  musicLabel();
  save();
});
musicLabel();
if (Object.keys(state.fish).length || state.places.jetty || state.places.cove) $('start-btn').textContent = 'Continue';

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  fitCamera();
});

// Phones may freeze or discard a background tab: save, and stop the sound until it's back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.suspend();
    if (started) save();
  } else audio.resume();
});
addEventListener('pagehide', () => { if (started) save(); });
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  if (started) save();
  notice('The graphics took a little break. Your progress is saved.', () => location.reload());
});

touch.onChange(() => {
  hud.cache = {};
  if (quality.choice === 'auto' && !started) {
    quality.autoLevel = startingLevel(true);
    applyQuality();
  }
});
applyQuality();

/* ---------------- loop ---------------- */

const zoneW = { open: 0, cove: 0 };
const _lp = new THREE.Vector3();
let saveTimer = 10;
let last = performance.now();

function frame(now) {
  const rawDt = (now - last) / 1000;
  const dt = Math.min(rawDt, 0.05);
  last = now;
  t += dt;
  sea.time = t;
  watchFrameRate(rawDt);

  const resting = started && !modal && input.resting;
  const speed = resting ? REST_SPEED : 1;
  hud.rest(resting);
  if (started) {
    const nightRate = state.hour >= 21.5 || state.hour < 5 ? 2.2 : 1;
    state.hour += (dt * speed * nightRate) / HOUR_SECONDS;
    if (state.hour >= 24) {
      state.hour -= 24;
      state.day++;
    }
  }
  updateWeather(dt, speed);

  let throttle = 0, steer = 0;
  if (started && !modal) {
    throttle = input.throttle;
    steer = input.steer;
  }
  if (throttle !== 0 && fishing.busy) {
    fishing.cancel();
    throttle = 0;
  }
  if (throttle !== 0) {
    rowTime += dt;
    if (rowTime > 3 && !state.tips.rowed) {
      state.tips.rowed = true;
      save();
    }
  }

  boat.update(dt, t, throttle, steer, env.lantern);
  fishing.update(dt, t, cam.yaw, started && modal !== 'journal' && input.action);
  fx.update(dt, t, boat);
  updateCamera(dt);
  env.update(dt, t, state.hour, weather.rain, boat.pos, camera, renderer);
  world.update(dt, t, env);
  updateRain(dt);

  const wu = water.uniforms;
  wu.uTime.value = t;
  wu.uRain.value = weather.rain;
  wu.uNight.value = env.night;
  wu.uAmp.value = sea.amp;
  wu.uLightDir.value.copy(env.lightDir);
  wu.uSunColor.value.copy(env.sunColor).multiplyScalar(env.sunI * 0.32);
  wu.uAmbient.value.copy(env.skyCol).multiplyScalar(env.hemiI * 0.33);
  wu.uZenith.value.copy(env.zenith);
  wu.uHorizon.value.copy(env.horizon);
  boat.lanternWorld(_lp);
  wu.uLights.value[0].set(_lp.x, _lp.y, _lp.z, boat.hasLantern ? boat.lanternLevel : 0);
  wu.uLights.value[1].set(world.lampPos.x, world.lampPos.y, world.lampPos.z, env.lantern);
  water.follow(camera.position);

  const zone = zoneAt(boat.pos.x, boat.pos.z);
  zoneW.open = damp(zoneW.open, zone === 'open' ? 1 : 0, 0.5, dt);
  zoneW.cove = damp(zoneW.cove, zone === 'cove' ? 1 : 0, 0.5, dt);
  audio.update(dt, {
    speed: boat.speed,
    rain: weather.rain,
    day: env.daylight,
    night: env.night,
    land: 1 - smoothstep(6, 70, landSDF(boat.pos.x, boat.pos.z)),
    open: zoneW.open,
    cove: zoneW.cove,
    gulls: 1 - smoothstep(25, 110, Math.hypot(boat.pos.x - STACKS[0].x, boat.pos.z - STACKS[0].z)),
  });

  if (started) {
    checkPlaces(dt);
    moments();
    ambientJumps(dt);
    saveTimer -= dt;
    if (saveTimer <= 0) {
      saveTimer = 10;
      save();
    }
  }
  updateHud();

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

$('loading')?.remove();
requestAnimationFrame((now) => {
  last = now;
  frame(now);
});

// A small handle for tinkering from the browser console, e.g. slowTide.setHour(19).
window.slowTide = {
  state, boat, fishing, env, weather, renderer, scene, camera, quality,
  setHour: (h) => { state.hour = ((h % 24) + 24) % 24; },
  setRain: (r) => { weather.target = r; weather.rain = r; },
  teleport: (x, z, heading = boat.heading) => boat.place(x, z, heading),
  reset: () => {
    resetting = true; // stop the save-on-leave handlers from writing the old progress back
    clearState();
    location.reload();
  },
};
