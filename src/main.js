import * as THREE from 'three';
import { Input } from './input.js';
import { loadState, saveState, clearState } from './save.js';
import { HUD, kbd } from './ui.js';
import { AudioScape } from './audio.js';
import { Environment, phaseName, formatClock } from './world/sky.js';
import { createWater, sea } from './world/water.js';
import { buildWorld } from './world/world.js';
import { createHabitat } from './world/habitat.js';
import { Ecosystem } from './world/ecosystem.js';
import { FishRenderer } from './world/fishRender.js';
import { Underwater } from './world/underwater.js';
import { causticUniforms } from './world/caustics.js';
import { bakeHeightTexture, heightAt, solidHeight, landSDF, zoneAt, PLACES, START, WATER_RECT, STACKS, COVE } from './world/terrain.js';
import { Boat } from './boat.js';
import { Effects } from './effects.js';
import { Fishing } from './fishing.js';
import { drawFishSketch, drawLanternSketch } from './fish.js';
import { Journal } from './journal.js';
import { CameraRig } from './camera.js';
import { FishFinder } from './sonar.js';
import { setupTouch } from './touch.js';
import { PRESETS, CHOICES, FrameWatch, lowerLevel, startingLevel } from './quality.js';
import { clamp, damp, smoothstep, rand, pick } from './util.js';

const HOUR_SECONDS = 40; // one in-game hour lasts 40 real seconds
const REST_SPEED = 30;   // holding T lets time drift by
const $ = (id) => document.getElementById(id);

const state = loadState();
state.tips = state.tips || {};
const hud = new HUD();
const audio = new AudioScape();
audio.musicOn = state.music !== false;
audio.setVolumes(state.volumes);

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

// One shared underwater world: habitat → plants, rocks and fish homes → the fish themselves.
const habitat = createHabitat();
const env = new Environment(scene);
const water = createWater(bakeHeightTexture(512, WATER_RECT), WATER_RECT);
scene.add(water.mesh);
const world = buildWorld(scene, renderer, habitat);
const underwater = new Underwater(scene, habitat, $('underwater-tint'));
const eco = new Ecosystem(habitat);
const fishRenderer = new FishRenderer(scene, eco);
const fx = new Effects(scene);
const boat = new Boat(scene);
const journal = new Journal(state);
const input = new Input(canvas);
const touch = setupTouch(input);
const rig = new CameraRig(camera);
const finder = new FishFinder(eco, habitat);

if (state.boat && solidHeight(state.boat.x, state.boat.z) < -1) boat.place(state.boat.x, state.boat.z, state.boat.heading);
else boat.place(START.x, START.z, START.heading);
if (state.items.lantern) {
  boat.setLantern(true);
  world.takeLantern();
}
rig.init(boat);

const weather = { rain: 0, target: 0, timer: state.tips.rained ? rand(120, 220) : 240 };
let t = 0;
let started = false;
let modal = null; // 'journal' | 'catch' | 'note'
let hudOff = false;
let rowTime = 0;

/* ---------------- fishing ---------------- */

const fishing = new Fishing(scene, boat, fx, audio, eco, {
  flash: (text, secs) => hud.flash(text, t, secs),
  shake: (s) => { rig.shake = Math.max(rig.shake, s); },
  onCast: () => {
    if (!state.tips.cast) {
      state.tips.cast = true;
      save();
    }
  },
  onHook: () => {},
  onCatch: showCatch,
  onRelease: hideCatch,
  quiet: () => hud.flash(touch.active
    ? 'Nothing’s biting here yet. Fish gather by weeds and rocks; the fish finder shows what’s below.'
    : `Nothing’s biting here yet. Fish gather by weeds and rocks; the fish finder (${kbd('F')}) shows what’s below.`, t, 6),
});

const REPEAT_LINES = [
  'Another lovely one.',
  'It flicks its tail, ready to go home.',
  'The scales catch the light for a moment.',
  'Heavier than it looks.',
  'It eyes you, unimpressed.',
];

function showCatch(sp, size, agent) {
  const isNew = !state.fish[sp.id];
  if (isNew) {
    state.fish[sp.id] = {
      count: 0, best: 0, firstDay: state.day, firstHour: state.hour,
      firstZone: zoneAt(agent.x, agent.z), firstRain: weather.rain > 0.4,
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
  $('cc-note').textContent = isNew ? sp.note : agent.caught > 0 ? 'This one has met your hook before.' : pick(REPEAT_LINES);
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

/* ---------------- surface clues ---------------- */

// Rings, flashes and jumps all come from real fish in the ecosystem.
function handleClues() {
  const cp = camera.position;
  const fx_ = Math.sin(rig.yaw), fz_ = Math.cos(rig.yaw);
  for (const c of eco.takeClues()) {
    const dx = c.x - cp.x, dz = c.z - cp.z;
    const d = Math.hypot(dx, dz);
    if (d > 90) continue;
    const vol = clamp(1 - d / 60, 0, 1);
    const pan = clamp(((-fz_ * dx + fx_ * dz) / (d || 1)) * -0.8, -0.8, 0.8);
    switch (c.type) {
      case 'rise':
        fx.ripple(c.x, c.z, 1.1 + c.size * 2, 1.9, 0.5);
        fx.splash(c.x, 0.05, c.z, 4, 1.0, 0.3);
        if (vol > 0) audio.splashSmall(0.25 * vol, pan);
        tipClues(d);
        break;
      case 'nervous':
        fx.ripple(c.x, c.z, 0.45 + Math.random() * 0.4, 1.0, 0.28);
        break;
      case 'flash':
        fx.flash(c.x, c.z, c.size, -c.y);
        tipClues(d);
        break;
      case 'jump':
        fx.splash(c.x, 0.05, c.z, 8, 1.6, 0.5);
        fx.ripple(c.x, c.z, 1.3, 1.4, 0.45);
        if (vol > 0) audio.splashSmall(0.5 * vol, pan);
        tipClues(d);
        break;
      case 'splash':
        fx.splash(c.x, 0.05, c.z, 6, 1.4, 0.5);
        fx.ripple(c.x, c.z, 1.6, 1.5, 0.5);
        if (vol > 0) audio.splashSmall(0.4 * vol, pan);
        break;
      case 'bubbles':
        underwater.bubbles(c.x, c.y + 0.1, c.z, 4 + Math.floor(Math.random() * 4));
        break;
      default:
    }
  }
}

function tipClues(d) {
  if (state.tips.clues || !started || d > 35) return;
  state.tips.clues = true;
  hud.toast('Rings, flashes and splashes on the water mean fish are feeding just below.', 7);
}

underwater.onPop = (x, z) => {
  if (Math.random() < 0.35) fx.ripple(x, z, 0.25, 0.6, 0.2);
  if (underwater.submerge > 0.5 && Math.hypot(x - camera.position.x, z - camera.position.z) < 10) audio.bubble(0.012);
};

/* ---------------- audio hooks ---------------- */

boat.onStroke = (p, side) => {
  fx.ripple(p.x, p.z, 0.9, 1.1, 0.4);
  fx.splash(p.x, 0.05, p.z, 4, 1.2, 0.4);
  audio.oar(side > 0 ? -0.3 : 0.3, 0.8);
};
boat.onBump = (v) => audio.knock(clamp(v / 3, 0.4, 1));

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

function updateRain(dt) {
  rainLines.visible = weather.rain > 0.02 && underwater.submerge < 0.5;
  if (!rainLines.visible) return;
  rainMat.opacity = 0.42 * weather.rain;
  rainLines.position.set(rig.focus.x, 0, rig.focus.z);
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
  eco.setDensity(q.fishDensity);
  eco.simRadius = q.simRadius;
  underwater.setQuality(q);
  underwater.setPixelRatio(pr);
  quality.caustics = q.caustics;
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

// Keep a reasonable side-to-side view on portrait phones by widening the vertical field of view.
function fitCamera() {
  const aspect = innerWidth / innerHeight;
  camera.aspect = aspect;
  camera.fov = Math.min(78, Math.max(50, (2 * Math.atan(Math.tan((20 * Math.PI) / 180) / aspect) * 180) / Math.PI));
  camera.updateProjectionMatrix();
}
fitCamera();

/* ---------------- views & fish finder ---------------- */

function viewChip() {
  const T = touch.active;
  if (rig.mode === 'under') {
    hud.chip(T
      ? '<b>Underwater</b> · drag to look around · pinch to zoom · the view button switches back'
      : `<b>Underwater</b> · drag to look around · scroll to zoom · ${kbd('C')} next view · ${kbd('R')} back to the boat`, 6);
  } else if (rig.mode === 'bait') {
    hud.chip(T
      ? '<b>Watching your bait</b> · drag to look around · the view button switches back'
      : `<b>Watching your bait</b> · drag to look around · ${kbd('C')} next view · ${kbd('R')} back to the boat`, 6);
  } else hud.chip('<b>Boat view</b>', 2);
}

function cycleView() {
  rig.cycle(fishing.baitInWater, t);
  viewChip();
  if (rig.mode !== 'boat' && !state.tips.under) {
    state.tips.under = true;
    save();
  }
}

function resetView() {
  rig.reset(boat, t);
  viewChip();
}

function toggleFinder(force) {
  const on = force ?? !finder.visible;
  finder.setVisible(on);
  $('finder-btn').classList.toggle('on', on);
  state.sonar = on;
  if (on && !state.tips.sonar) {
    state.tips.sonar = true;
    finder.toggleLegend(true);
  }
  save();
}

/* ---------------- HUD ---------------- */

const STATUS_TEXT = {
  quiet: 'Quiet for now',
  curious: 'Something is curious…',
  nibble: 'Nibbling… wait for the float to go under',
  bite: 'Bite!',
  hooked: 'Hooked!',
};

function currentHint() {
  if (!started || modal) return '';
  const L = (c) => kbd(input.label(c));
  const T = touch.active;
  const space = kbd('Space');
  switch (fishing.state) {
    case 'aiming':
      return T
        ? 'Let go to cast · stick left/right aims, up/down sets bait depth · ✕ cancels'
        : `Release ${space} to cast · ${L('KeyA')}${L('KeyD')} aim · ${L('KeyW')}${L('KeyS')} bait depth · ${kbd('Esc')} cancel`;
    case 'drifting':
      if (fishing.status === 'curious') return 'Something is curious about your bait. Keep still…';
      if (fishing.status === 'nibble') return 'Nibbling… wait for the float to go under';
      if (T) return `Stick up/down: bait depth · hold the button to reel in · tap to twitch${state.tips.under ? '' : ' · the view button looks underwater'}`;
      return `${L('KeyW')}${L('KeyS')} bait depth · hold ${space} to reel in · tap to twitch${state.tips.under ? '' : ` · ${kbd('C')} look underwater`}`;
    case 'bite': return T ? 'Bite! Tap the button' : `Bite! Press ${space}`;
    case 'reeling':
      if (fishing.pulling) return T ? "It's pulling. Let go until it tires" : `It's pulling. Let go of ${space} until it tires`;
      return T ? 'Hold the button to reel in' : `Hold ${space} to reel in`;
    case 'casting': case 'landing': case 'caught': case 'releasing': case 'retrieving': return '';
    default:
  }
  if (!state.tips.rowed) return T ? 'Drag on the left to row · drag on the right to look around' : `${L('KeyW')}${L('KeyA')}${L('KeyS')}${L('KeyD')} to row · drag to look around`;
  if (!state.tips.cast) return T ? 'Hold the button to aim and cast your line' : `Hold ${space} to aim and cast your line`;
  if (state.tips.caught && !state.tips.journal) return T ? 'Tap Journal to see what you’ve found' : `${kbd('J')} to open your journal`;
  if (state.tips.caught && !state.tips.under) return T ? 'The view button lets you look under the water' : `${kbd('C')} to look under the water`;
  if (state.tips.caught && !state.tips.sonar) return T ? 'The sonar button shows a fish finder' : `${kbd('F')} for the fish finder`;
  return '';
}

const ACTION_LABELS = {
  idle: 'Cast', aiming: 'Let go', casting: '', drifting: 'Twitch', bite: 'Hook!', reeling: 'Reel',
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
  $('cancel-btn').hidden = !(touch.active && fishing.aiming);

  const F = fishing.fight;
  if (fishing.aiming) hud.meter(true, fishing.power, -1, 0, fishing.aimValid ? `${Math.round(fishing.castDist)} m` : '—');
  else if (fishing.state === 'reeling' && F) hud.meter(true, F.progress, F.tension, F.tension, F.pulling ? 'easy' : 'reel');
  else hud.meter(false);

  if (started && !modal && fishing.baitInWater) {
    const info = fishing.info;
    info.text = (STATUS_TEXT[info.status] || '') + (info.reeling ? ' · reeling in' : '');
    hud.bait(info);
  } else hud.bait(null);

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
  rig.settleUntil = t + 2.5;
  if (state.sonar) toggleFinder(true);
  save();
}

function openJournal() {
  journal.open(boat);
  modal = 'journal';
  audio.page();
  if (fishing.aiming) fishing.cancel();
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
  // While a menu is open, gameplay keys do nothing.
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
  else if (key === 'c') cycleView();
  else if (key === 'r') resetView();
  else if (key === 'f') toggleFinder();
  else if (key === 'm') {
    state.music = audio.toggleMusic();
    hud.toast(state.music ? 'Music on' : 'Music off', 1.6);
    save();
  } else if (key === 'h') {
    hudOff = !hudOff;
    hud.hidden(hudOff);
  } else if (code === 'Escape') {
    if (!fishing.cancel() && rig.mode !== 'boat') resetView();
  }
});
input.on('release', (code) => {
  if (code === 'Space') fishing.onUp();
});
input.on('pointer', () => {
  if (!started) begin();
  else audio.start();
});
input.on('cancel', () => {
  if (started && !modal) fishing.cancel();
});

$('start-btn').addEventListener('click', begin);
$('journal-btn').addEventListener('click', () => {
  if (modal === 'journal') closeJournal();
  else if (!modal) openJournal();
});
$('view-btn').addEventListener('click', () => { if (started && !modal) cycleView(); });
$('finder-btn').addEventListener('click', () => { if (started && !modal) toggleFinder(); });
$('cancel-btn').addEventListener('click', () => fishing.cancel());
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
for (const key of ['master', 'nature', 'music']) {
  const el = $(`vol-${key}`);
  el.value = String(Math.round((state.volumes[key] ?? 1) * 100));
  el.addEventListener('input', () => {
    state.volumes = { ...state.volumes, [key]: Number(el.value) / 100 };
    audio.setVolumes(state.volumes);
  });
  el.addEventListener('change', save);
}
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
const ecoCtx = { env: {}, focus: { x: 0, z: 0 }, boat: { x: 0, z: 0, speed: 0 }, lantern: null };
let saveTimer = 10;
let last = performance.now();

function tick(now, manual = false) {
  const rawDt = Math.max(0, (now - last) / 1000);
  const dt = Math.min(rawDt, 0.05);
  last = now;
  t += dt;
  sea.time = t;
  if (!manual) watchFrameRate(rawDt);

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

  // The movement keys row the boat; while aiming they swing the cast and set the bait
  // depth, and while the bait is out up/down sets its depth.
  let throttle = 0, steer = 0;
  if (started && !modal) {
    const ti = input.throttle, si = input.steer;
    if (fishing.aiming) {
      fishing.aimBy(si, dt);
      fishing.depthBy(ti, dt);
    } else if (fishing.lineOut) {
      fishing.depthBy(ti, dt);
      steer = si;
    } else {
      throttle = ti;
      steer = si;
    }
  }
  if (throttle !== 0) {
    rowTime += dt;
    if (rowTime > 3 && !state.tips.rowed) {
      state.tips.rowed = true;
      save();
    }
  }

  boat.update(dt, t, throttle, steer, env.lantern);
  fishing.update(dt, t, rig.yaw, started && !modal && input.action);

  ecoCtx.env.hour = state.hour;
  ecoCtx.env.rain = weather.rain;
  ecoCtx.env.daylight = env.daylight;
  ecoCtx.env.night = env.night;
  const lanternLit = boat.hasLantern && boat.lanternLevel > 0.3;
  ecoCtx.env.lanternNear = lanternLit && Math.hypot(boat.pos.x - COVE.x, boat.pos.z - COVE.z) < COVE.r + 30;
  ecoCtx.focus.x = rig.focus.x;
  ecoCtx.focus.z = rig.focus.z;
  ecoCtx.boat.x = boat.pos.x;
  ecoCtx.boat.z = boat.pos.z;
  ecoCtx.boat.speed = boat.speed;
  ecoCtx.lantern = lanternLit ? ecoCtx.boat : null;
  eco.update(dt, ecoCtx);
  handleClues();
  fx.update(dt, t, boat);

  const drag = input.takeDrag();
  const wheel = input.takeWheel();
  if (started && !modal) rig.input(drag, wheel, t);
  rig.update(dt, t, { boat, started, fishing, baitFocus: fishing.watchPoint });
  env.update(dt, t, state.hour, weather.rain, boat.pos, camera, renderer);
  const sub = underwater.updateMedium(t, camera, env, scene, water, weather.rain);
  audio.setUnderwater(sub);
  underwater.update(dt, t, camera, env, weather.rain);
  fishRenderer.update(dt, camera, env.night, sub > 0.5);
  world.update(dt, t, env);
  updateRain(dt);
  causticUniforms.uCausticTime.value = t;
  causticUniforms.uCaustic.value = (quality.caustics ?? 1) * env.daylight * (1 - weather.rain * 0.6);

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

  finder.update(dt, boat, eco.bait);

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
    saveTimer -= dt;
    if (saveTimer <= 0) {
      saveTimer = 10;
      save();
    }
  }
  updateHud();

  renderer.render(scene, camera);
}

function frame(now) {
  tick(now);
  requestAnimationFrame(frame);
}

$('loading')?.remove();
requestAnimationFrame((now) => {
  last = now;
  frame(now);
});

// A small handle for tinkering from the browser console, e.g. slowTide.setHour(19).
window.slowTide = {
  state, boat, fishing, env, weather, renderer, scene, camera, quality, eco, habitat, rig, finder, underwater,
  setHour: (h) => { state.hour = ((h % 24) + 24) % 24; },
  setRain: (r) => { weather.target = r; weather.rain = r; },
  teleport: (x, z, heading = boat.heading) => boat.place(x, z, heading),
  // Step the game by hand (handy for testing while the tab is in the background).
  advance: (seconds, fps = 30) => {
    let now = last;
    for (let i = 0; i < seconds * fps; i++) tick((now += 1000 / fps), true);
  },
  reset: () => {
    resetting = true; // stop the save-on-leave handlers from writing the old progress back
    clearState();
    location.reload();
  },
};
