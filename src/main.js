import * as THREE from 'three';
import { Input, defaultBindings } from './input.js';
import { SettingsUI, WEATHER_MODES } from './settings.js';
import { loadGame, saveGame, newGame, saveStatus, parseSave, importSave, exportText, stopSaving, SAVE_KEY, adoptJournal } from './save.js';
import { Cloud } from './cloud.js';
import { setupOffline, offline, applyUpdate } from './offline.js';
import { DIFFICULTY, DIFFICULTY_IDS, DRAG_LEVELS, DRAG_NAMES, breakReason } from './fight.js';
import { HUD, kbd } from './ui.js';
import { AudioScape } from './audio.js';
import { Environment, phaseName, formatClock } from './world/sky.js';
import { createWater } from './world/water.js';
import { conditions, updateConditions, windAt, currentAt, currentScale, waveHeightHere, compass, bearingOf, windWords, seaWords } from './world/conditions.js';
import { buildWorld } from './world/world.js';
import { createHabitat } from './world/habitat.js';
import { Ecosystem } from './world/ecosystem.js';
import { FishRenderer } from './world/fishRender.js';
import { Underwater } from './world/underwater.js';
import { Reflection, RippleField, NO_REFLECT, hideFromReflection } from './world/waterfx.js';
import { createMist } from './world/mist.js';
import { surfaceUniforms } from './world/surface.js';
import { causticUniforms } from './world/caustics.js';
import {
  bakeHeightTexture, heightAt, walkHeight, solidHeight, landSDF, lakeSDF, streamSDF, zoneAt, waterOf, riverSDF, mereSDF,
  PLACES, START, WATER_RECT, SHORE_RECT, STACKS, COVE, LANDING, PIERS, BOATHOUSE_PIER, WORLD,
  PEGS, POOLS, STREAM, SNAG, LILIES, JETTY, ISLAND, GANNET_CAMP, SKERRIES, SKELLIG, DEEP_Z,
  HAVEN, HAVEN_QUAY, HAVEN_BENCH, DAYMARK, STRAND, WRECK, WRECK_BUOY, CHANNEL,
} from './world/terrain.js';
import { Boat, BOAT_KINDS } from './boat.js';
import { Walker } from './walker.js';
import { Effects } from './effects.js';
import { Fishing } from './fishing.js';
import { drawFishSketch, drawLanternSketch, fishById, weightOf } from './fish.js';
import { RODS, TACKLE, ROD_IDS, PACK, cleanGear, currentRig, fits, termOf, lineInUse } from './tackle.js';
import { PackUI } from './pack.js';
import { Camp, WAKE_TIMES } from './camp.js';
import { kitsFree, newCamp, moveCamp, packUp, checkSite, nearestSite, defaultName, toWorld, LAYOUT } from './campsite.js';
import { makeSiteWorld } from './siteWorld.js';
import { CampView, campObstacles } from './campView.js';
import { Placement } from './placement.js';
import { Adventures, ADVENTURE_BY_ID, PAGES, KEEPSAKES } from './adventures.js';
import { PhotoStore, capture, photoId, albumPage, download } from './photos.js';
import { Memories } from './memories.js';
import { whatsAbout, birdsWorking, weatherLines, notices, paintBoard } from './harbour.js';
import { PHOTO_MAX } from './save.js';
import { Journal } from './journal.js';
import { MapSheet, Explored } from './map.js';
import { FieldGuide } from './guide.js';
import { startTrip, endTrip, summaryText } from './trip.js';
import { diagnose } from './advice.js';
import { studio } from './gearView.js';
import { CameraRig } from './camera.js';
import { RodView } from './firstperson.js';
import { bendRod } from './props.js';
import { FishFinder } from './sonar.js';
import { setupTouch } from './touch.js';
import { PRESETS, CHOICES, FrameWatch, lowerLevel, startingLevel, resolveQuality } from './quality.js';
import { clamp, damp, dampAngle, lerp, smoothstep, rand, pick } from './util.js';

const HOUR_SECONDS = 40; // one in-game hour lasts 40 real seconds
const REST_SPEED = 30;   // holding T lets time drift by
const $ = (id) => document.getElementById(id);

const loaded = loadGame();
// Optional cloud saves: only when a backend is configured and you've signed in. Startup waits
// a moment for the cloud (just when signed in, or arriving from a sign-in link), so the game
// begins from the combined save rather than jumping later. Offline, it simply carries on.
const cloud = new Cloud();
const cloudReady = cloud.init();
let cloudStart = null;
if (Cloud.expected() && saveStatus.canSave) {
  const sync = cloudReady.then(() => cloud.syncAtStart(loaded.state, saveStatus.lastSaved)).catch(() => null);
  cloudStart = await Promise.race([sync, new Promise((r) => setTimeout(() => r('late'), 6000))]);
  if (cloudStart === 'late') {
    // Too slow: play the local save, and take in the cloud's catches when it answers.
    sync.then((r) => { if (r) adoptJournal(state, r.state); });
    cloudStart = null;
  }
}
const state = cloudStart?.state || loaded.state;
if (cloudStart) saveGame(state);
state.tips = state.tips || {};
state.gear = cleanGear(state.gear);
state.keep = Array.isArray(state.keep) ? state.keep.filter((f) => fishById[f.id]) : [];
state.caughtOn = state.caughtOn || {};
const hud = new HUD();
const audio = new AudioScape();
const settings = state.settings;
audio.musicOn = state.music !== false;
audio.setVolumes(settings.audio);

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
// The water's map of the world: about two metres a texel over the whole map, finer over the stream.
// (The same baked heights draw the map.)
const heightTex = bakeHeightTexture(896, WATER_RECT, 1120);
const water = createWater(heightTex, WATER_RECT, bakeHeightTexture(256, SHORE_RECT), SHORE_RECT);
scene.add(water.mesh);
const mist = createMist(water.uniforms.uHeight.value, WATER_RECT, water.uniforms.uHeight2.value, SHORE_RECT);
scene.add(mist.group);
const world = buildWorld(scene, renderer, habitat);
// Your own camps (see campsite.js): drawn by CampView, and solid underfoot like everything else.
state.camps = Array.isArray(state.camps) ? state.camps : [];
const campView = new CampView(scene);
const campSolids = [];
function refreshCamps() {
  campSolids.length = 0;
  for (const c of state.camps) campSolids.push(...campObstacles(c));
  campView.sync(state.camps);
}
// The world's obstacles and your camps' gear together, as one thing to bump into.
const solids = {
  resolve(p, r, y = -Infinity) {
    let hit = world.obstacles.resolve(p, r, y);
    for (const o of campSolids) {
      if (y > o.top) continue;
      const dx = p.x - o.x, dz = p.z - o.z, min = o.r + r, d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.001;
      p.x = o.x + (dx / d) * min;
      p.z = o.z + (dz / d) * min;
      hit = true;
    }
    return hit;
  },
  near(x, z, pad, out = []) {
    world.obstacles.near(x, z, pad, out);
    for (const o of campSolids) if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + pad) ** 2) out.push(o);
    return out;
  },
};
// Places a camp mustn't go besides those in siteWorld.js: the doorways, the notice board, the
// bench and the like (see coast.js), the tackle boxes, and the driftwood where the lantern was.
const interactionKeepOut = [
  ...world.coast.spots.map((sp) => ({ x: sp.x, z: sp.z, r: sp.r + 1.2, why: `That would block ${sp.name}.` })),
  ...world.boxes.map((b) => ({ x: b.x, z: b.z, r: 4, why: 'Keep the tackle box clear.' })),
];
const siteWorld = makeSiteWorld({
  obstacles: (x, z, pad, out) => {
    solids.near(x, z, pad, out);
    if (siteWorld.ignore) for (let i = out.length - 1; i >= 0; i--) if (out[i].camp === siteWorld.ignore) out.splice(i, 1);
    return out;
  },
  extraKeepOut: () => interactionKeepOut,
});
// Camps saved before the ground changed (a world update): kept, with everything in them, and
// moved to the nearest safe ground with a word about it.
const campNotes = [];
for (const c of state.camps) {
  siteWorld.ignore = c.id;
  const r = checkSite(c.x, c.z, c.yaw, siteWorld, { others: state.camps, ignore: c.id });
  if (r.ok) continue;
  const near = nearestSite(c.x, c.z, c.yaw, siteWorld, 90, { others: state.camps, ignore: c.id });
  if (near) {
    const d = Math.round(Math.hypot(near.x - c.x, near.z - c.z));
    moveCamp(c, near.x, near.z, near.yaw, c.pitched.day, c.pitched.hour);
    campNotes.push(`The ground where ${c.name} stood has changed (${r.reason.charAt(0).toLowerCase()}${r.reason.slice(1)}). Your camp has been moved ${d} m to safe ground, with everything in it.`);
  } else campNotes.push(`The ground where ${c.name} stands has changed, and there’s no good ground near it. It’s still there with everything in it: move it or pack it up when you visit.`);
}
siteWorld.ignore = null;
refreshCamps();
const underwater = new Underwater(scene, habitat, $('underwater-tint'));
const eco = new Ecosystem(habitat);
const fishRenderer = new FishRenderer(scene, eco);
const fx = new Effects(scene);
// The water mirrors the world and shows every ripple (both scale with the graphics setting).
const reflection = new Reflection();
const ripples = new RippleField();
fx.setField(ripples);
camera.layers.enable(NO_REFLECT);
hideFromReflection(water.mesh);
hideFromReflection(water.ring);
for (const o of [...underwater.beds.flatMap((b) => [b.grass, b.kelp]), underwater.rocks, underwater.particles, underwater.bubblesPts, ...underwater.rays]) hideFromReflection(o);
for (const m of fishRenderer.meshes) hideFromReflection(m);
// The boats: the rowing boat you start with, the motor skiff and the kayak tied up at the
// landing, and the bass boat at the Longmere boathouse. `boat` is whichever you're in (or
// last used); the others float where you left them.
const BOATS = Object.fromEntries(BOAT_KINDS.map((k) => [k, new Boat(scene, { kind: k })]));
const boats = Object.values(BOATS);
const rowboat = BOATS.row, skiff = BOATS.skiff;
let boat = rowboat;
// The nearest other boat close enough to step across into (both boats near enough still).
const otherBoat = (reach = 4.5) => {
  let best = null;
  for (const b of boats) {
    if (b === boat || b.speed > 1) continue;
    const d = Math.hypot(b.pos.x - boat.pos.x, b.pos.z - boat.pos.z);
    if (d < reach) { reach = d; best = b; }
  }
  return best;
};
const walker = new Walker(scene);
const journal = new Journal(state);
// The parts of the coast you've seen. An older save starts with what's around the places it found.
const explored = new Explored(state.seen);
if (!state.seen) {
  explored.reveal(START.x, START.z, 160);
  for (const p of PLACES) if (state.places[p.id]) explored.reveal(p.x, p.z, p.area ? 160 : 110);
}
const input = new Input(canvas);
input.setBindings(settings.controls.keys || defaultBindings());
// The key for an action, as printed on this keyboard, ready for a hint: K('interact') → E.
const K = (action) => kbd(input.keyLabel(action));
const touch = setupTouch(input);
const rig = new CameraRig(camera);
const rodView = new RodView();
const finder = new FishFinder(eco, habitat, state);

// Where each boat is tied up to begin with: the skiff alongside the end of the landing pier
// in water deep enough for the motor, the kayak on the other side nearer the beach, and the
// bass boat along the boathouse jetty on Longmere. The rowing boat starts out in the bay.
function mooring(kind) {
  const L = LANDING;
  if (kind === 'skiff' || kind === 'kayak') {
    const skiff = kind === 'skiff', need = skiff ? 1.1 : 0.45;
    const xs = [];
    for (let x = L.x + L.len - 1.2; x > L.x; x -= 0.6) xs.push(x);
    if (!skiff) xs.reverse();
    for (const dz of skiff ? [2.4, -2.4, 3.2, -3.2] : [-2, 2, -2.6, 2.6]) {
      for (const x of xs) {
        if (solidHeight(x, L.z + dz) < -need && solidHeight(x + 2, L.z + dz) < -need && solidHeight(x - 2, L.z + dz) < -need * 0.8) return { x, z: L.z + dz, heading: Math.PI / 2 };
      }
    }
    return { x: L.x + L.len + 4, z: L.z + (skiff ? 0 : 3), heading: Math.PI / 2 };
  }
  if (kind === 'bass') {
    const P = BOATHOUSE_PIER, d = P.dir, side = { x: -d.z, z: d.x };
    for (const off of [2.1, -2.1, 2.8, -2.8]) {
      for (let k = 2; k < 12; k += 0.5) {
        const x = P.end.x - d.x * k + side.x * off, z = P.end.z - d.z * k + side.z * off;
        if (solidHeight(x, z) < -1 && solidHeight(x + d.x * 2.4, z + d.z * 2.4) < -1 && solidHeight(x - d.x * 2.4, z - d.z * 2.4) < -0.8) return { x, z, heading: Math.atan2(d.x, d.z) };
      }
    }
    return { x: P.end.x + d.x * 4, z: P.end.z + d.z * 4, heading: Math.atan2(d.x, d.z) };
  }
  return { x: START.x, z: START.z, heading: START.heading };
}

// A saved spot is only trusted if the boat would float there: inside the world, in water
// deep enough for its hull, and not on top of a pier.
function floats(b, p) {
  if (!p || p.x < WORLD.x0 || p.x > WORLD.x1 || p.z < WORLD.z0 || p.z > WORLD.z1) return false;
  if (solidHeight(p.x, p.z) > -(b.hull.draft + 0.4)) return false;
  return !PIERS.some((P) => p.x > P.x0 - 0.8 && p.x < P.x1 + 0.8 && p.z > P.z0 - 0.8 && p.z < P.z1 + 0.8);
}
for (const [kind, b] of Object.entries(BOATS)) {
  const saved = state.boats[kind];
  const at = floats(b, saved) ? saved : mooring(kind);
  b.place(at.x, at.z, at.heading);
  if (saved?.anchored && at === saved) b.setAnchor(true);
}
boat = BOATS[state.vessel] || rowboat;
for (const b of boats) if (b !== boat) b.setRower(false);
if (state.items.lantern) {
  for (const b of boats) b.setLantern(true);
  world.takeLantern();
}
rig.init(boat);

// The weather: how cloudy the sky is and how hard it rains (each 0–1), drifting smoothly
// towards the sky of the moment. Choose one in Settings, or let it change by itself.
const SKIES = {
  clear: { cloud: 0.06, rain: 0, word: '' },
  partly: { cloud: 0.4, rain: 0, word: 'Partly cloudy' },
  overcast: { cloud: 0.86, rain: 0, word: 'Overcast' },
  light: { cloud: 0.82, rain: 0.36, word: 'Light rain' },
  heavy: { cloud: 1, rain: 0.92, word: 'Heavy rain' },
};
// When it changes by itself: what can come next (a list may repeat an entry to make it likelier).
const NEXT_SKY = {
  clear: ['partly', 'partly', 'clear'],
  partly: ['clear', 'overcast', 'partly'],
  overcast: ['partly', 'light', 'overcast'],
  light: ['overcast', 'heavy', 'partly', 'light'],
  heavy: ['light'],
};
const startSky = state.sky || { state: 'partly', cloud: SKIES.partly.cloud, rain: 0, timer: state.tips.rained ? rand(120, 220) : 240 };
const weather = {
  rain: startSky.rain, cloud: startSky.cloud, state: startSky.state, timer: startSky.timer,
  get target() { return SKIES[this.state].rain; },
  override: null, // slowTide.setRain() for testing: a fixed rain level
};
const skyMode = () => settings.weather.mode;
if (skyMode() !== 'auto') weather.state = skyMode();
// The wind, the sea and the currents live in conditions.js, shared by the water, the boats, the
// rig, the trees and the sound. `wind` is a small view of it for the HUD and the console.
const FRESH = 12; // m/s: a fresh breeze, strength 1 for the casting maths
const wind = {
  // The way it blows towards (as atan2(x, z) of its vector) and how strong (0 … 1), where you are.
  get dir() { const w = windAt(player().pos.x, player().pos.z); return Math.atan2(w.x, w.z); },
  get strength() { return Math.min(1, windAt(player().pos.x, player().pos.z).speed / FRESH); },
};
function updateWind(dt) {
  conditions.preset = settings.weather.sea || 'auto';
  conditions.manual = settings.weather.windMode === 'manual' ? { speed: settings.weather.windSpeed, from: settings.weather.windFrom * Math.PI / 180 } : null;
  conditions.currents = settings.weather.currents || 'natural';
  updateConditions(dt, weather);
  // The wind on the cast: where you stand, gusts and all (the landing preview allows for it).
  const a = player().pos, w = windAt(a.x, a.z);
  fishing.wind.x = w.x / FRESH;
  fishing.wind.z = w.z / FRESH;
  fishing.wind.strength = Math.min(1, w.speed / FRESH);
}
// An arrow for a direction (a world vector), as seen from the camera.
function arrowFor(x, z) {
  let rel = Math.atan2(x, z) - rig.yaw;
  rel = ((rel % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  const i = ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
  return ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗'][i];
}
function windArrow() {
  const w = windAt(player().pos.x, player().pos.z);
  return arrowFor(w.x, w.z);
}
function windHint() {
  const w = windAt(player().pos.x, player().pos.z);
  if (w.speed < 1.5) return '';
  return ` · wind ${Math.round(w.speed * 3.6)} km/h ${arrowFor(w.x, w.z)}`;
}
let t = 0;
let started = false;
let modal = null; // 'journal' | 'catch' | 'note' | 'pack' | 'camp' | 'sleep' | 'travel'
let hudOff = false;
let rowTime = 0;
let walkTime = 0;
let onFoot = false;
const player = () => (onFoot ? walker : boat);

/* ---------------- fishing ---------------- */

function teach(key, text, secs = 5) {
  if (state.tips[key]) return;
  state.tips[key] = true;
  hud.toast(text, secs);
  save();
}

const fishing = new Fishing(scene, boat, fx, audio, eco, {
  flash: (text, secs) => hud.flash(text, t, secs),
  key: (a) => K(a),
  canopyAt: (x, y, z) => world.canopyAt(x, y, z),
  teach,
  shake: (s) => shake(s),
  // The flick before a run, and the run itself: felt as well as seen (a buzz on phones that
  // can, a jolt through your hands in first person).
  cue: (kind) => {
    if (touch.active) navigator.vibrate?.(kind === 'warn' ? 35 : 70);
    if (kind === 'run' && rig.mode === 'eye') shake(0.25);
  },
  onCast: () => {
    if (!onFoot && boat.motor && boat.lever) boat.lever = 0;
    if (!state.tips.cast) {
      state.tips.cast = true;
      save();
    }
  },
  castResult: (text, good) => {
    hud.flash(text, t, good ? 2.2 : 3.6);
    if (good) audio.chime?.();
  },
  onHook: () => {},
  onCatch: showCatch,
  onRelease: hideCatch,
  canKeep: () => {
    if (state.keep.length < PACK.fish) return true;
    hud.flash(`Your creel is full (${PACK.fish} fish). Cook some at camp, or let this one go.`, t, 3.5);
    return false;
  },
  onKeep: (sp, size) => {
    state.keep.push({ id: sp.id, size, logId: lastCatchId });
    setOutcome(lastCatchId, 'kept');
    $('catch-card').hidden = true;
    modal = null;
    hud.flash(`Into the creel: ${sp.name.toLowerCase()}, ${size} cm. Cook it at camp.`, t, 3);
    teach('kept', 'Fish you keep ride in the creel on your backpack. Grill them at camp, then eat.', 6);
    save();
  },
  // Every break has a reason you can see and do something about (see fight.js).
  onSnap: (why, sp, rod) => {
    hud.flash(why === 'teeth' ? 'Snip! The line is cut.' : why === 'snag' ? 'Snagged! The line parted in the weed.' : 'Snap! The line broke.', t, 3);
    hud.toast(breakReason(why, sp, rod), 9);
  },
  onDrag: (level, rod) => {
    hud.flash(`Drag: ${DRAG_NAMES[level]}${level === DRAG_LEVELS.length - 1 ? ' (it can’t slip: the line breaks first)' : ''}`, t, 2);
    save();
  },
  spooked: (a) => {
    if (a.L.stream) teach('spooked', 'Splash, and it was gone! Trout feel heavy footsteps. Walk (don’t jog) near the stream, and cast from a few metres back.', 7);
  },
  // Nothing for a while: a word from the field guide, if hints are on (Settings).
  quiet: () => {
    const hints = settings.controls.hints;
    if (hints === 'off') return;
    giveAdvice(false);
    // "More": another word if it stays quiet.
    if (hints === 'more') {
      fishing.hintedQuiet = false;
      fishing.quietT = -15;
    }
  },
});

// Why aren't they biting? What the simulation makes of the rig (advice.js): the most telling
// reason, then the next one each time you ask again during the same cast.
let adviceCast = null, adviceIdx = 0;
function giveAdvice(asked) {
  if (fishing.state !== 'drifting') {
    if (asked) hud.flash('Cast out first: then the field guide can tell what the fish make of your rig.', t, 3.5);
    return;
  }
  const target = state.trip ? fishById[state.trip.sp] : null;
  const { sp, reasons } = diagnose(fishing, eco, mapSheet, target);
  if (adviceCast !== fishing.interest) {
    adviceCast = fishing.interest;
    adviceIdx = 0;
  }
  const r = reasons[Math.min(adviceIdx, reasons.length - 1)];
  adviceIdx++;
  const who = sp && !target ? ` (for the ${sp.name.toLowerCase()}, the likeliest fish here)` : '';
  hud.toast(`${r.text}${adviceIdx === 1 ? who : ''}${asked && reasons.length > adviceIdx ? ` · ${input.keyLabel('advice')} again for more` : ''}`, 8);
}

// The nearest named spot to a catch, for the log: a pool, a peg, the jetty…
function placeName(x, z) {
  const near = (px, pz, r) => Math.hypot(x - px, z - pz) < r;
  for (const p of POOLS) {
    const n = STREAM[p.node];
    if (near(n[0], n[1], 7)) return p.name;
  }
  for (const p of PEGS) if (near(p.x, p.z, 9)) return p.name;
  if (near(SNAG.x + Math.sin(SNAG.yaw) * 2.5, SNAG.z + Math.cos(SNAG.yaw) * 2.5, 9)) return 'the fallen alder';
  if (near(LILIES.x, LILIES.z, LILIES.r + 3)) return 'the lily pads';
  if (near(LANDING.x + 4, LANDING.z, 14)) return 'The Landing';
  if (near(JETTY.x, (JETTY.z0 + JETTY.z1) / 2, 20) || near(ISLAND.x, ISLAND.z, ISLAND.r + 10)) return 'The Old Jetty';
  if (near(STACKS[0].x, STACKS[0].z, 34)) return 'Gull Rock';
  for (const p of PLACES) if (!p.area && p.id !== 'camp' && near(p.x, p.z, 40)) return p.name;
  for (const p of PLACES) if (p.area && p.id !== 'bay' && p.test(x, z)) return p.name;
  return '';
}

const logById = (id) => (id ? state.log.find((e) => e.id === id) : null);
// What happened to a logged fish: kept, cooked, eaten (it starts as released).
function setOutcome(id, outcome) {
  const e = logById(id);
  if (e) e.outcome = outcome;
}

let lastCatchId = null;
function logCatch(sp, size, agent, rigUsed) {
  const F = fishing.fight;
  const at = F ? F.start : fishing.hook;
  const entry = {
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    sp: sp.id,
    size,
    day: state.day,
    hour: Math.round(state.hour * 100) / 100,
    zone: zoneAt(agent.x, agent.z),
    place: placeName(agent.x, agent.z),
    water: waterOf(zoneAt(agent.x, agent.z)),
    kind: rigUsed?.rod?.kind || 'float',
    rod: rigUsed?.rod?.id || 'float',
    item: rigUsed?.item?.id || null,
    line: rigUsed?.rod?.line?.name || '',
    term: fishing.term?.id || '',
    weight: Math.round(weightOf(sp, size) * 100) / 100,
    sky: weather.state,
    from: onFoot ? 'shore' : 'boat',
    rain: weather.rain > 0.6 ? 2 : weather.rain > 0.15 ? 1 : 0,
    hatch: Math.round(hatchLevel() * 10) / 10,
    depth: Math.round(Math.max(0, -at.y) * 10) / 10,
    bottom: Math.round(Math.max(0, -solidHeight(at.x, at.z)) * 10) / 10,
    outcome: 'released',
    x: Math.round(at.x),
    z: Math.round(at.z),
  };
  state.log.push(entry);
  if (state.log.length > 1000) state.log.splice(0, state.log.length - 1000);
  lastCatchId = entry.id;
}

const REPEAT_LINES = [
  'Another lovely one.',
  'It flicks its tail, ready to go home.',
  'The scales catch the light for a moment.',
  'Heavier than it looks.',
  'It eyes you, unimpressed.',
];

function showCatch(sp, size, agent, rigUsed) {
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
  if (rigUsed?.item) {
    const on = (state.caughtOn[sp.id] = state.caughtOn[sp.id] || {});
    on[rigUsed.item.id] = (on[rigUsed.item.id] || 0) + 1;
  }
  logCatch(sp, size, agent, rigUsed);
  adventures.caught(sp.id, agent.x, agent.z, world.flocks);
  state.tips.caught = true;
  save();

  // The species' own model, as it swims in the water and appears in the field guide.
  const cv = $('cc-canvas');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const photo = new Image();
  photo.onload = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(photo, 0, 0, cv.width, cv.height);
  };
  photo.src = studio().thumb({ type: 'fish', id: sp.id }, cv.width, cv.height);
  markObserved(sp.id, agent);
  $('cc-new').hidden = !isNew;
  $('cc-name').textContent = sp.name;
  const kg = weightOf(sp, size);
  const wtText = kg < 1 ? `${Math.round(kg * 1000 / 10) * 10} g` : `${kg.toFixed(kg < 10 ? 1 : 0)} kg`;
  $('cc-size').textContent = `${size} cm${sp.creature ? ' mantle' : ''} · about ${wtText}${record ? ' · your biggest yet' : ''}`;
  $('cc-note').textContent = isNew ? sp.note : agent.caught > 0 ? 'This one has met your hook before.' : sp.creature ? pick(['It flushes pale and dark, and squirts a last jet of ink.', 'Its great eyes look you over.', 'It wraps an arm round your finger, then lets go.']) : pick(REPEAT_LINES);
  $('cc-rig').textContent = (rigUsed?.item ? `Caught on ${rigUsed.item.on}, with the ${rigUsed.rod.short.toLowerCase()}` : '') + (state.trip?.sp === sp.id ? ' · the fish your trip is for' : '');
  const keepBtn = $('cc-keep');
  keepBtn.hidden = !sp.meal;
  keepBtn.disabled = state.keep.length >= PACK.fish;
  keepBtn.lastChild.textContent = state.keep.length >= PACK.fish ? 'Creel full' : 'Keep for the pot';
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
  save();
}

/* ---------------- gear ---------------- */

let gearDirty = true;
function applyGear(msg) {
  if (msg) hud.flash(fishing.busy ? `${msg} (once you reel in)` : msg, t, 2.2);
  if (fishing.busy) {
    gearDirty = true;
    save(); // the choice is kept now, even though the rig changes once you reel in
    return;
  }
  gearDirty = false;
  const { rod, item } = currentRig(state.gear);
  if (item) state.gear.rig[rod.id] = item.id;
  fishing.setRig({ ...rod, line: lineInUse(state.gear, rod) }, item, termOf(state.gear, rod));
  for (const b of boats) b.setRod(rod.id);
  walker.setRod(rod.id);
  hud.gear(rod, item);
  world.camp.setRackRods(ROD_IDS.filter((r) => !state.gear.pack.rods.includes(r)));
  save();
}

// Q: the next bait, lure or fly in your backpack that suits the rod in hand.
function nextTackle() {
  const g = state.gear, rod = RODS[g.rod];
  const options = g.pack.items.filter((i) => fits(rod, TACKLE[i]));
  if (!options.length) {
    hud.flash(`Nothing in your backpack for the ${rod.short.toLowerCase()}. Pack some at camp.`, t, 3);
    return;
  }
  const cur = currentRig(g).item?.id;
  const next = options[(options.indexOf(cur) + 1) % options.length];
  g.rig[rod.id] = next;
  applyGear(`${TACKLE[next].name} on the ${rod.short.toLowerCase()}`);
  if (packUI.isOpen) packUI.render();
}

function pickRod(slot) {
  const id = state.gear.pack.rods[slot];
  if (!id || id === state.gear.rod) return;
  state.gear.rod = id;
  const { item } = currentRig(state.gear);
  applyGear(`${RODS[id].name}${item ? ` · ${item.short}` : ''}`);
  if (packUI.isOpen) packUI.render();
}

const packUI = new PackUI(state, {
  onChange: (msg) => applyGear(msg),
  onClose: () => closePack(),
  travel: (dest) => travel(dest),
  travelInfo: () => travelInfo(),
  kit: (el) => renderKit(el),
  openMap: () => {
    closePack();
    openMap();
  },
  openGuide: (id) => {
    closePack();
    openGuide(id);
  },
});

// The tackle boxes at the camps beyond the bay (Wend Quay, the boathouse, Puffin Cove).
const regionBox = (reach = 4) => (onFoot ? world.boxes.find((b) => Math.hypot(walker.pos.x - b.x, walker.pos.z - b.z) < reach) : null);
// A tackle box within reach: one at a camp, or the locker in a motorboat.
const tackleBox = () => (nearCamp() || regionBox() || ownCampNear(4.5) ? 'tackle box' : chandleryNear() ? 'chandlery' : !onFoot && boat.motor ? 'boat locker' : false);

function openPack(box = tackleBox()) {
  if (modal) return;
  if (fishing.aiming) fishing.cancel();
  packUI.open(box);
  modal = 'pack';
  audio.page();
  teach('pack', 'Rods decide how you fish; what you tie on decides which fish come.', 6);
}

function closePack() {
  packUI.close();
  if (modal === 'pack') modal = null;
  audio.page();
}

// The camping kit, in the backpack: pitch it, or where your camp is and what to do about it.
function renderKit(el) {
  const out = [];
  const btn = (text, run, dis = false, cls = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pk-btn ${cls}`.trim();
    b.textContent = text;
    b.disabled = dis;
    b.addEventListener('click', run);
    return b;
  };
  const p = (text, cls = 'gx-note') => {
    const e = document.createElement('p');
    e.className = cls;
    e.textContent = text;
    return e;
  };
  if (kitsFree(state)) {
    out.push(p('A tent and bedroll, a lantern, a camp chair, a little stove and a cool box, rolled up on your pack. Pitch them wherever the ground allows.', 'gx-kit-text'));
    out.push(btn('Pitch a camp…', () => startPitching('new'), !onFoot));
    if (!onFoot) out.push(p('Step ashore first: a tent needs dry ground.'));
  }
  for (const c of state.camps) {
    const P = player().pos, d = Math.round(Math.hypot(c.x - P.x, c.z - P.z));
    const dir = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round((Math.atan2(c.x - P.x, -(c.z - P.z)) / (Math.PI * 2)) * 8 + 8) % 8];
    out.push(p(d < 12 ? `${c.name}: you’re here. Pack it up or move it from the camp itself (Your camp tab).` : `${c.name}: ${d} m ${dir}, pitched on day ${c.pitched.day}. ${c.store.fish.length ? `${c.store.fish.length} fish in the cool box.` : 'The cool box is empty.'}`, 'gx-kit-text'));
    const row = document.createElement('div');
    row.className = 'gx-kit-acts';
    if (d >= 12) row.append(btn('Head there', () => travel('own'), !travelInfo().own), btn('Move it here…', () => startPitching('move', c), !onFoot, 'quiet'));
    out.push(row);
  }
  // The camera rides in the same pocket (the only way into photo mode on a touch screen).
  out.push(p(`Your camera: a picture of wherever you are, and under the water, of the fish themselves.${touch.active ? '' : ` (${input.keyLabel('photo')} anywhere.)`}`, 'gx-kit-text'));
  out.push(btn('Take a photograph', () => {
    closePack();
    openPhoto();
  }, fishing.busy, 'quiet'));
  el.replaceChildren(...out);
}

/* ---------------- camp ---------------- */

const camp = new Camp(state, scene, world.camp, {
  toast: (text, secs) => hud.toast(text, secs),
  audio,
  close: () => closeCamp(),
  openTackle: () => {
    closeCamp();
    openPack('tackle box');
  },
  changed: () => {
    refreshCamps();
    save();
  },
  outcome: (logId, what) => setOutcome(logId, what),
  sleep: (h) => sleepUntil(h),
  near: (c) => Math.hypot(player().pos.x - c.x, player().pos.z - c.z) < 40,
  openJournal: () => {
    closeCamp();
    openJournal();
  },
  planTrip: () => {
    closeCamp();
    openGuide();
  },
  moveCamp: (c) => {
    closeCamp();
    startPitching('move', c);
  },
  packUp: (c, release) => packCamp(c, release),
});

function nearCamp() {
  return onFoot && walker.pos.distanceTo(world.camp.firePos) < 7.5;
}

// Your own camp, if you're standing by it (its door, or anywhere round its middle).
function ownCampNear(reach = 3.6) {
  if (!onFoot) return null;
  for (const c of state.camps) {
    const door = toWorld(c.x, c.z, c.yaw, 0, 1.1);
    if (Math.hypot(walker.pos.x - door.x, walker.pos.z - door.z) < reach || Math.hypot(walker.pos.x - c.x, walker.pos.z - c.z) < reach + 1) return c;
  }
  return null;
}

function openCamp(tab, site = null) {
  if (modal) return;
  camp.open(tab, site);
  modal = 'camp';
  audio.page();
}

/* ---------------- your own camp: pitching, moving, packing up ---------------- */

const placement = new Placement({
  walker,
  yaw: () => rig.yaw,
  world: siteWorld,
  preview: campView.preview,
  others: () => state.camps,
  keyLabel: (a) => input.keyLabel(a),
  touch: () => touch.active,
  nope: (why) => hud.flash(why, t, 2.6),
  cancel: () => {
    siteWorld.ignore = null;
    hud.flash('Nothing pitched: the kit is still rolled up.', t, 2.2);
  },
  confirm: (spot, mode, c) => {
    siteWorld.ignore = null;
    pitchHere(spot, mode, c);
  },
});

// Start choosing where to pitch (mode 'new', from your backpack) or where to move a camp to.
function startPitching(mode = 'new', c = null) {
  if (placement.isOn) return;
  if (!onFoot) {
    hud.flash('Step ashore first: a tent needs dry ground under it.', t, 3);
    return;
  }
  if (fishing.state === 'reeling' || fishing.state === 'landing' || fishing.state === 'caught' || fishing.state === 'keeping') {
    hud.flash('Land or let go of the fish first.', t, 3);
    return;
  }
  if (fishing.lineOut || fishing.aiming) {
    fishing.cancel();
    hud.flash('You reel in and put the rod down.', t, 2);
  }
  if (mode === 'new' && !kitsFree(state)) {
    hud.flash('Your camping kit is pitched already: move that camp, or pack it up first.', t, 3.5);
    return;
  }
  if (modal === 'pack') closePack();
  else if (modal === 'camp') closeCamp();
  else if (modal === 'map') closeMap();
  if (modal) return;
  siteWorld.ignore = mode === 'move' ? c.id : null;
  placement.start(mode, c);
  audio.rustle?.();
  teach('pitching', touch.active
    ? 'Walk to where you’d like your camp: the outline turns green where it fits. The buttons turn it; tap Pitch it here when you’re happy.'
    : `Walk to where you’d like your camp: the outline turns green where it fits, and says why where it doesn’t. ${input.keyLabel('tackle')} and ${input.keyLabel('interact')} turn it, the mouse wheel brings it nearer or further, ${input.keyLabel('cast')} pitches it, Esc puts the kit away again.`, 10);
}

function pitchHere(spot, mode, c) {
  if (mode === 'move') {
    const d = Math.hypot(spot.x - c.x, spot.z - c.z);
    const hours = Math.min(2.5, 0.25 + (d / 400) * 2);
    const mins = Math.round(hours * 60);
    ask(`Move ${c.name} here?`, `It stands ${Math.round(d)} m away. You go back for it and carry everything over (about ${mins < 90 ? `${mins} minutes` : `${Math.round(hours * 10) / 10} hours`}). The tent, the stove and the cool box come just as they are, with ${c.store.fish.length} fish on ice.`, [
      { text: 'Leave it where it is', cls: 'quiet', run: () => hud.flash(`${c.name} stays where it is.`, t, 2) },
      {
        text: 'Move it here', run: () => {
          moveCamp(c, spot.x, spot.z, spot.yaw, state.day, state.hour);
          passTime(hours);
          refreshCamps();
          solids.resolve(walker.pos, 0.4);
          audio.knock(0.4);
          save();
          hud.toast(`${c.name} is pitched here now. ${spot.check.words}`, 5);
        },
      },
    ]);
    return;
  }
  const name = defaultName(spot.x, spot.z, PLACES, state.places);
  const c2 = newCamp({ x: spot.x, z: spot.z, yaw: spot.yaw, name, day: state.day, hour: state.hour });
  state.camps.push(c2);
  refreshCamps();
  solids.resolve(walker.pos, 0.4);
  audio.knock(0.45);
  setTimeout(() => audio.knock(0.35), 260);
  save();
  ask('Your camp is up', `${spot.check.words}${spot.check.warn ? ` ${spot.check.warn}` : ''} It stays here, just as you leave it, until you move it or pack it up. What shall we call it?`, [
    { text: 'Keep this name', cls: 'quiet', run: () => campPitchedTip(c2) },
    {
      text: 'Name it', run: (v) => {
        const n = (v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
        if (n) c2.name = n;
        save();
        campPitchedTip(c2);
      },
    },
  ], { input: name });
}

function campPitchedTip(c) {
  hud.toast(`${c.name} is on your map. ${touch.active ? 'Tap the prompt by the door' : `Press ${input.keyLabel('interact')} by the door`} to rest, cook, use the cool box or change your tackle.`, 7);
}

// Pack it up (fish in the cool box go into your creel; `release` are the ones you chose to let go).
function packCamp(c, release = []) {
  const r = packUp(state, c, { release });
  if (!r.ok) {
    hud.toast(r.why, 5);
    return;
  }
  for (const f of r.released) setOutcome(f.logId, 'released');
  closeCamp();
  refreshCamps();
  audio.rustle?.();
  save();
  hud.toast(`${c.name} is packed up: the tent and stove are rolled up on your backpack${r.carried ? `, and ${r.carried} fish are in your creel` : ''}${r.released.length ? `; ${r.released.length} went back into the water` : ''}.`, 6);
}

// Back at your camp after time away: a word that it's just as you left it.
let campAway = new Map();
function watchCamps() {
  for (const c of state.camps) {
    const d = Math.hypot(player().pos.x - c.x, player().pos.z - c.z);
    const was = campAway.get(c.id) ?? (d > 40);
    if (was && d < 12 && onFoot) {
      c.visits = (c.visits || 0) + 1;
      const fish = c.store.fish.length, meals = c.store.meals.length;
      hud.place(c.name, 'your camp');
      if (c.visits > 0) hud.toast(`Back at ${c.name}. Just as you left it${fish || meals ? `: ${fish ? `${fish} fish in the cool box` : ''}${fish && meals ? ' and ' : ''}${meals ? `${meals} cooked by the stove` : ''}` : ''}.`, 5);
      save();
    }
    campAway.set(c.id, d > 40 ? true : d < 12 ? false : was);
  }
}

function closeCamp() {
  camp.close();
  if (modal === 'camp') modal = null;
}

let sleeping = null;
function sleepUntil(h) {
  if (sleeping) return;
  if (fishing.state === 'reeling' || fishing.state === 'landing' || fishing.state === 'caught' || fishing.state === 'keeping') {
    hud.toast('Land or let go of the fish first.', 3);
    return;
  }
  // (A line left out overnight would be a tangle by morning: you reel in before turning in.)
  if (fishing.lineOut || fishing.aiming) fishing.cancel();
  const site = camp.site;
  closeCamp();
  modal = 'sleep';
  const w = WAKE_TIMES.find((x) => x.h === h);
  hud.sleep(true, `You sleep until ${w ? w.name.toLowerCase() : formatClock(h)}…`);
  audio.rustle?.();
  sleeping = { h, phase: 0, t: 0, site };
}

// Halfway through the fade: move the world on.
function passTheNight() {
  const h = sleeping.h;
  let hours = h - state.hour;
  if (hours <= 0.5) hours += 24;
  if (state.hour + hours >= 24) state.day++;
  state.hour = h;
  camp.update(0, hours, true);
  // The weather turns while you sleep (unless you've chosen it): sometimes you wake to rain.
  if (skyMode() === 'auto') {
    weather.state = pick(Math.random() < 0.3 ? ['light', 'heavy', 'overcast'] : ['clear', 'partly', 'partly', 'overcast']);
    weather.timer = rand(120, 260);
  }
  weather.rain = SKIES[weather.state].rain * 0.9;
  weather.cloud = SKIES[weather.state].cloud;
  const rain = weather.rain > 0.2;
  eco.feedSpots = [];
  ecoTick(0.016);
  eco.settle();
  for (let i = 0; i < 90; i++) eco.update(1 / 30, ecoCtx);
  sleeping.rain = rain;
  // You wake at the tent's door, on firm ground (whatever the night did, you're never left in the water).
  const door = sleeping.site ? toWorld(sleeping.site.x, sleeping.site.z, sleeping.site.yaw, 0.6, 1.6) : null;
  const spot = door ? standNear(door.x, door.z, 0.3) : onFoot && walkHeight(walker.pos.x, walker.pos.z) < 0.1 ? campSpot() : null;
  if (spot && onFoot) {
    walker.place(spot.x, spot.z, spot.heading);
    rig.reset(walker, t);
  }
  save();
}

function wakeLine(h, rain, site = null) {
  // By the sea (your own camp on the coast): the sea's sounds, not the lake's.
  const P = player().pos;
  if (site && !['lake', 'stream', 'mere'].includes(zoneAt(P.x, P.z + 20))) {
    if (rain) return 'You wake to rain on the canvas and the sea breathing on the sand. A good morning for bass.';
    if (h < 7) return 'You wake to oystercatchers piping along the tideline, and a pale light over the sea.';
    if (h < 11) return 'Morning sun through the canvas, and gulls working the water offshore.';
    if (h < 16) return 'You wake to a bright afternoon and the hush of small waves.';
    if (h < 20) return 'You wake as the light turns gold over the water: the bass will be coming in.';
    return 'You wake in the dark to the lantern’s glow and the sea turning over on the sand.';
  }
  if (rain) return 'You wake to rain pattering on the canvas. The fish will be stirring.';
  if (h < 7) return 'You wake to birdsong. Mist lies on the water, and the trout are rising.';
  if (h < 11) return 'Morning light through the tent. A good time for the stream.';
  if (h < 16) return 'You wake to a warm afternoon, the lake still as glass.';
  if (h < 20) return 'You wake as the light turns gold: pike and carp hours.';
  return 'You wake in the dark. Stars over the lake, and the fire has burned down.';
}

function updateSleep(dt) {
  if (!sleeping) return;
  sleeping.t += dt;
  if (sleeping.phase === 0 && sleeping.t > 1.6) {
    sleeping.phase = 1;
    passTheNight();
  }
  if (sleeping.phase === 1 && sleeping.t > 3.4) {
    hud.sleep(false);
    modal = null;
    hud.toast(wakeLine(sleeping.h, sleeping.rain, sleeping.site), 6);
    audio.chime();
    sleeping = null;
  }
}

/* ---------------- on foot and back in the boat ---------------- */

// Somewhere to step ashore near the boat: a pier or jetty alongside first, else any
// reachable bank.
function shoreSpot() {
  const b = boat.pos;
  for (const P of PIERS) {
    const qx = clamp(b.x, P.x0, P.x1), qz = clamp(b.z, P.z0, P.z1);
    if (Math.hypot(b.x - qx, b.z - qz) > 3.4) continue;
    // Onto the middle of the deck, facing along it towards the land.
    const long = P.x1 - P.x0 > P.z1 - P.z0;
    const x = long ? clamp(b.x, P.x0 + 0.6, P.x1 - 0.6) : (P.x0 + P.x1) / 2;
    const z = long ? (P.z0 + P.z1) / 2 : clamp(b.z, P.z0 + 0.6, P.z1 - 0.6);
    const land = P.land || { x: P.x0, z: (P.z0 + P.z1) / 2 };
    return { x, z, heading: Math.atan2(land.x - x, land.z - z), pier: true, landing: P === PIERS[1], quay: P === HAVEN_QUAY };
  }
  for (let r = 1.4; r <= 6.2; r += 0.6) {
    let best = null;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = b.x + Math.sin(a) * r, z = b.z + Math.cos(a) * r;
      const h = walkHeight(x, z);
      if (h < 0.05 || h > 4) continue;
      const slope = Math.abs(walkHeight(x + 0.8, z) - walkHeight(x - 0.8, z)) + Math.abs(walkHeight(x, z + 0.8) - walkHeight(x, z - 0.8));
      if (slope > 1.6) continue;
      if (!best || h < best.h) best = { x, z, h, heading: a };
    }
    if (best) return best;
  }
  return null;
}

let shoreCache = { t: -1, spot: null };
function cachedShoreSpot() {
  if (t - shoreCache.t > 0.3) shoreCache = { t, spot: !onFoot && boat.speed < 1.4 ? shoreSpot() : null };
  return shoreCache.spot;
}

// The nearest boat you could climb into from where you stand.
function boatNear(reach = 5.5) {
  let best = null;
  for (const b of boats) {
    const d = Math.hypot(walker.pos.x - b.pos.x, walker.pos.z - b.pos.z);
    if (d < reach) {
      reach = d;
      best = b;
    }
  }
  return best;
}
const nearBoat = () => onFoot && !!boatNear();

// Change which boat is yours right now (climbing in, or stepping across from the other).
function switchBoat(b) {
  if (b === boat) return;
  boat.setRower(false);
  boat.pose.fishing = 0;
  boat.lever = 0;
  boat = b;
  if (!onFoot) {
    boat.setRower(true);
    fishing.setAngler(boat);
  }
  finder.reset();
}

const boatTitle = (b) => b.name[0].toUpperCase() + b.name.slice(1);

function stepAcross(to) {
  switchBoat(to);
  audio.knock(0.5);
  hud.chip(`<b>${boatTitle(boat)}</b>`, 2);
  teachBoat();
  save();
}

// The first time aboard each kind of boat: what it's for and how it handles.
function teachBoat() {
  const k = boat.kind, tip = k === 'skiff' ? 'skiff' : `boat-${k}`;
  if (k === 'row' || state.tips[tip]) return;
  state.tips[tip] = true;
  const T = touch.active, key = (a) => input.keyLabel(a);
  const lever = T ? 'push the stick forward for throttle, left and right to steer. Let go to slow down.'
    : `${key('forward')} and ${key('back')} move the throttle lever (it stays where you leave it), ${key('left')} and ${key('right')} steer, ${key('neutral')} stops the motor, ${key('anchor')} drops or raises the anchor.`;
  const text = {
    skiff: `The motor skiff, for the open coast and the islands: ${lever} Near a shore, slow down and ${T ? 'tap the prompt' : `press ${key('interact')}`} to step off.`,
    kayak: `The kayak: slow, but silent and stable enough to fish from, and it floats in a hand's depth of water. Paddle into the shallows, the saltings and the reeds where the boats can't go: fish hardly notice it. ${T ? 'The stick paddles and steers.' : `${key('forward')}${key('left')}${key('back')}${key('right')} paddle and steer.`}`,
    bass: `The bass boat: ${lever} The first notches of throttle run the quiet electric motor at the bow, for creeping along the weed beds and the reeds without spooking anything; push on for the outboard to cross the lake fast. Its locker holds your tackle box, and it sits steady when you cast.`,
  }[k];
  hud.toast(text, 12);
}

// Z (or the prompt when stopped): drop or raise the anchor.
function toggleAnchor() {
  if (onFoot || fishing.busy) return;
  if (!boat.anchored && boat.speed > 1.2) {
    hud.flash('Slow down before dropping the anchor', t, 2.2);
    return;
  }
  boat.setAnchor(!boat.anchored);
  audio.knock(0.35);
  audio.plop(boat.anchored ? 1.2 : 0.7);
  hud.flash(boat.anchored ? 'Anchor down: the boat will hold here while you fish' : 'Anchor up', t, 2.4);
  save();
}

function setFoot(foot, silent = false) {
  onFoot = foot;
  walker.setVisible(foot);
  boat.setRower(!foot);
  fishing.setAngler(foot ? walker : boat);
  rig.setHome(foot, t);
  finder.reset();
  if (!silent) save();
}

function stepAshore(spot) {
  walker.place(spot.x, spot.z, spot.heading);
  setFoot(true);
  audio.step(false);
  audio.knock(0.4);
  hud.chip(touch.active
    ? '<b>On foot</b> · the stick walks · tap the prompt by the boat to get back in'
    : `<b>On foot</b> · ${K('forward')}${K('left')}${K('back')}${K('right')} walk · ${K('jog')} jog · ${K('interact')} by the boat to get back in`, 6);
  if (!state.tips.ashore) {
    state.tips.ashore = true;
    hud.toast(spot.landing ? 'You step onto the landing. Camp is just up the path, with the lake beyond it and the stream further on.' : 'You step ashore. The boat waits where you left it: follow the marker to find it again.', 7);
  }
}

function board(target = boatNear() || boat) {
  switchBoat(target);
  setFoot(false);
  teachBoat();
  audio.knock(0.5);
  hud.chip('<b>Boat view</b>', 2);
}

/* ---------------- heading back: camp or boat ---------------- */

// A safe place to stand by the fire: on dry, level ground, clear of the tent and gear.
function campSpot() {
  const c = world.camp.firePos;
  const p = { x: 0, z: 0 };
  for (let r = 2.2; r <= 7; r += 0.6) {
    for (let i = 0; i < 16; i++) {
      // Start on the side facing the bay and the path, then work round.
      const a = Math.PI / 2 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 8);
      const x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r;
      const h = walkHeight(x, z);
      if (h < 0.3) continue;
      if (Math.abs(walkHeight(x + 0.6, z) - walkHeight(x - 0.6, z)) + Math.abs(walkHeight(x, z + 0.6) - walkHeight(x, z - 0.6)) > 0.5) continue;
      p.x = x;
      p.z = z;
      if (solids.resolve(p, 0.45)) continue;
      return { x, z, heading: Math.atan2(c.x - x, c.z - z) };
    }
  }
  return { x: c.x + 3, z: c.z, heading: -Math.PI / 2 };
}

const nearCampSpot = () => Math.hypot(player().pos.x - world.camp.firePos.x, player().pos.z - world.camp.firePos.z) < 8;

// Somewhere safe to stand near (x, z): dry, level ground clear of gear, as close as can be.
function standNear(x, z, from = 1.5) {
  const p = { x: 0, z: 0 };
  for (let r = from; r <= 12; r += 0.6) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      p.x = x + Math.sin(a) * r;
      p.z = z + Math.cos(a) * r;
      const h = walkHeight(p.x, p.z);
      if (h < 0.3) continue;
      if (Math.abs(walkHeight(p.x + 0.6, p.z) - walkHeight(p.x - 0.6, p.z)) + Math.abs(walkHeight(p.x, p.z + 0.6) - walkHeight(p.x, p.z - 0.6)) > 0.5) continue;
      const q = { x: p.x, z: p.z };
      if (solids.resolve(q, 0.45)) continue;
      return { x: q.x, z: q.z, heading: Math.atan2(x - q.x, z - q.z) };
    }
  }
  return null;
}

// The camps beyond the bay you can head to: by their tackle boxes.
function campAt(id) {
  const box = world.boxes.find((b) => b.place === id);
  return box && state.places[id] ? box : null;
}

// Where your own camp's door is, and the safe ground in front of it.
const ownCampSpot = (c) => {
  const door = toWorld(c.x, c.z, c.yaw, 0.6, 1.8);
  return standNear(door.x, door.z, 0.3);
};
// Willowhaven: on the apron by the head of the quay.
const HAVEN_SPOT = { x: HAVEN_QUAY.x0 - 3, z: HAVEN_QUAY.z0 + 1.5 };

function travelInfo() {
  const busy = fishing.state === 'reeling' || fishing.state === 'landing' || fishing.state === 'caught' || fishing.state === 'keeping';
  if (busy) return { camp: false, boat: false, camps: false, own: false, haven: false, note: 'Land or let go of the fish first.' };
  if (sleeping || traveling) return { camp: false, boat: false, camps: false, own: false, haven: false, note: '' };
  const atCamp = onFoot && nearCampSpot();
  const box = regionBox(10);
  const camp = !atCamp;
  const boat = onFoot;
  const P = player().pos;
  const ownHere = state.camps.find((c) => onFoot && Math.hypot(P.x - c.x, P.z - c.z) < 12);
  const atHaven = onFoot && Math.hypot(P.x - HAVEN.x, P.z - HAVEN.z) < 22;
  const note = !onFoot ? 'You’re in the boat. It stays where you leave it.' : ownHere ? `You’re at ${ownHere.name}.` : atCamp ? 'You’re at the old camp.' : atHaven ? 'You’re in Willowhaven.' : stuckT > 2.5 ? 'Stuck? Any of these gets you out.' : '';
  return {
    camp, boat, camps: true, here: atCamp ? 'camp' : ownHere ? 'own' : atHaven ? 'haven' : box ? box.place : null, note,
    own: !!state.camps.length && !ownHere, haven: !!state.places.haven && !atHaven,
  };
}

// The walk (or row) back happens off-screen: a short fade, a little time passes, and
// you arrive somewhere safe. Catches, gear and the creel all come with you.
let traveling = null;
function travel(dest) {
  const info = travelInfo();
  const far = !['camp', 'boat', 'own', 'haven'].includes(dest);
  if (far ? !info.camps || !campAt(dest) || info.here === dest : !info[dest]) return;
  if (placement.isOn) placement.stop();
  if (fishing.lineOut) fishing.cancel();
  if (modal === 'pack') closePack();
  else if (modal === 'camp') closeCamp();
  else if (modal === 'map') closeMap();
  if (modal) return;
  modal = 'travel';
  const name = far ? PLACES.find((p) => p.id === dest)?.name : dest === 'own' ? state.camps[0].name : dest === 'haven' ? 'Willowhaven' : '';
  hud.sleep(true, far || dest === 'haven' ? `You make your way to ${name}…` : dest === 'own' ? `You head back to ${name}…` : dest === 'camp' ? 'You head back to the old camp…' : 'You make your way back to the boat…');
  traveling = { dest, name, t: 0, done: false };
}

function passTime(hours) {
  state.hour += hours;
  if (state.hour >= 24) {
    state.hour -= 24;
    state.day++;
  }
  camp.update(0, hours);
}

function updateTravel(dt) {
  if (!traveling) return;
  traveling.t += dt;
  if (!traveling.done && traveling.t > 0.9) {
    traveling.done = true;
    const from = player().pos.clone();
    const box = campAt(traveling.dest);
    const own = traveling.dest === 'own' ? state.camps[0] : null;
    const spot = traveling.dest === 'camp' ? campSpot() : own ? ownCampSpot(own) : traveling.dest === 'haven' ? standNear(HAVEN_SPOT.x, HAVEN_SPOT.z, 0.2) : box ? standNear(box.x, box.z) : null;
    if (spot) {
      walker.place(spot.x, spot.z, spot.heading);
      if (!onFoot) setFoot(true, true);
      rig.reset(walker, t);
    } else {
      board();
      rig.reset(boat, t);
    }
    // About as long as the walk (or the sail) would take: half an hour at most back to camp or
    // the boat, longer to the far camps.
    passTime(clamp(from.distanceTo(player().pos) / 400, 0.05, box || own || traveling.dest === 'haven' ? 2.5 : 0.5));
    stuckT = 0;
    save();
  }
  if (traveling.t > 1.9) {
    hud.sleep(false);
    modal = null;
    hud.toast(traveling.name ? `${traveling.name}. Your boat is where you left it.` : traveling.dest === 'camp' ? 'Back at the old camp. The boat is where you left it.' : 'Back in the boat.', 3.5);
    traveling = null;
  }
}

// Pushing against something without getting anywhere: offer the way out.
let stuckT = 0;
const stuckFrom = new THREE.Vector3();
function watchStuck(dt, pushing) {
  if (!onFoot || !pushing || fishing.busy || modal) {
    stuckT = 0;
    stuckFrom.copy(walker.pos);
    return;
  }
  if (walker.pos.distanceTo(stuckFrom) > 0.6) {
    stuckT = 0;
    stuckFrom.copy(walker.pos);
  } else stuckT += dt;
}

const lanternReach = () => !state.items.lantern && (onFoot
  ? walker.pos.distanceTo(world.lanternSpot) < 3.5
  : Math.hypot(boat.pos.x - world.lanternSpot.x, boat.pos.z - world.lanternSpot.z) < 10);

// What E (or tapping the prompt) does right now, if anything.
function interaction() {
  if (!started || modal || fishing.busy || placement.isOn) return null;
  if (lanternReach()) return { text: 'Look closer at the driftwood', run: takeLantern };
  if (onFoot) {
    const near = boatNear();
    if (near) return { text: `Get in the ${near.name}`, run: () => board(near) };
    const own = ownCampNear();
    if (own) return { text: `${own.name}: rest, cook, cool box and tackle`, run: () => openCamp('cook', own) };
    if (nearCamp()) return { text: 'Camp: fire, food, sleep and tackle box', run: () => openCamp() };
    const box = regionBox();
    if (box) return { text: `${PLACES.find((p) => p.id === box.place)?.name || 'Camp'}: the tackle box`, run: () => openPack('tackle box') };
    // Willowhaven, and the pages round the cove.
    const page = pageNear();
    if (page) return { text: PAGES[page].where.startsWith('tucked') ? 'Look at the paper tucked under the seat' : PAGES[page].where.startsWith('folded') ? 'Look at the paper in the crack' : 'Look at the paper in the driftwood', run: () => readPage(page) };
    if (coastSpot('board')) return { text: 'Read the notice board', run: () => openBoard() };
    if (chandleryNear()) return { text: 'The chandlery: tackle, bait and charts', run: () => openPack('chandlery') };
    if (coastSpot('bench')) return { text: 'Sit on the bench a while', run: () => sitOnBench() };
    if (quayHeadNear()) return { text: 'Have a boat brought round to the quay', run: () => boatsRound() };
    if (stuckT > 2.5) return { text: 'Stuck? Head back to camp or the boat', run: () => openPack() };
    return null;
  }
  const spot = cachedShoreSpot();
  if (spot) return { text: spot.landing ? 'Step ashore at the landing' : spot.quay ? 'Step up onto the quay' : spot.pier ? 'Step onto the jetty' : 'Step ashore', run: () => stepAshore(spot) };
  const other = boat.speed < 1 ? otherBoat() : null;
  if (other) return { text: `Step across into the ${other.name}`, run: () => stepAcross(other) };
  if (boat.speed < 0.6 && !fishing.lineOut) return { text: boat.anchored ? 'Raise the anchor' : 'Drop the anchor', run: toggleAnchor };
  return null;
}

// G: a pouch of loose bait around your bottom rig, to draw the carp in.
function looseFeed() {
  if (fishing.kind !== 'ledger' || !fishing.baitInWater) {
    hud.flash('Loose bait is for bottom fishing: cast a rig with the carp rod first.', t, 3);
    return;
  }
  const h = fishing.hook;
  eco.addFeed(h.x, h.z, 1);
  for (let i = 0; i < 7; i++) {
    const x = h.x + rand(-2.2, 2.2), z = h.z + rand(-2.2, 2.2);
    setTimeout(() => {
      fx.ripple(x, z, 0.35, 0.8, 0.35);
      fx.splash(x, 0.05, z, 2, 0.8, 0.3);
    }, 250 + i * 70);
  }
  audio.cast(0.4);
  setTimeout(() => audio.plop(1.6), 300);
  hud.flash('You catapult a pouch of loose bait around your rig. Carp nearby will come to graze.', t, 3.2);
}

/* ---------------- discoveries ---------------- */

function takeLantern() {
  state.items.lantern = true;
  world.takeLantern();
  for (const b of boats) b.setLantern(true);
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
  // (Another card waiting: an adventure's ending after the page that finished it.)
  const next = noteQueue.shift();
  if (next) setTimeout(() => showNote(...next), 250);
}

/* ---------------- life on the coast: notes, adventures, the harbour, photographs ---------------- */

// A card with a little sketch: a page found, an adventure's ending, a notice read.
const noteQueue = [];
function showNote(title, text, kind = '') {
  if (modal === 'note' || (modal && modal !== 'journal')) {
    noteQueue.push([title, text, kind]);
    return;
  }
  if (modal === 'journal') closeJournal();
  const cv = $('nc-canvas'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawNoteSketch(ctx, cv.width, cv.height, kind);
  $('nc-title').textContent = title;
  $('nc-text').textContent = text;
  $('note-card').hidden = false;
  modal = 'note';
  audio.page();
}

// Little ink sketches for the cards (drawn here: no pictures from outside).
function drawNoteSketch(ctx, w, h, kind) {
  ctx.save();
  ctx.strokeStyle = '#3a2e26';
  ctx.fillStyle = '#3a2e26';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const cx = w / 2, cy = h / 2;
  if (kind === 'kittiwake') {
    // The drifter: hull, wheelhouse, funnel, mast; a line of sea.
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy + 10); ctx.quadraticCurveTo(cx - 60, cy + 38, cx - 10, cy + 40); ctx.lineTo(cx + 62, cy + 36); ctx.lineTo(cx + 74, cy + 6); ctx.closePath();
    ctx.stroke();
    ctx.strokeRect(cx + 18, cy - 18, 26, 26);
    ctx.fillRect(cx - 8, cy - 34, 10, 42);
    ctx.beginPath(); ctx.moveTo(cx - 44, cy + 8); ctx.lineTo(cx - 44, cy - 58); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, cy + 48); for (let x = 10; x < w - 10; x += 12) ctx.quadraticCurveTo(x + 3, cy + 44, x + 6, cy + 48); ctx.stroke();
  } else if (kind === 'notebook' || PAGES[kind]) {
    ctx.strokeRect(cx - 50, cy - 60, 100, 120);
    ctx.fillStyle = '#3f5f86';
    ctx.fillRect(cx - 50, cy - 60, 12, 120);
    ctx.fillStyle = '#3a2e26';
    for (let i = 0; i < 7; i++) ctx.fillRect(cx - 30, cy - 42 + i * 14, 66 - ((i * 23) % 20), 1.6);
  } else if (kind === 'gulls') {
    for (const [x, y, s] of [[cx - 40, cy - 20, 1.2], [cx + 10, cy - 40, 1], [cx + 40, cy - 6, 0.8], [cx - 6, cy + 4, 0.9]]) {
      ctx.beginPath(); ctx.moveTo(x - 18 * s, y); ctx.quadraticCurveTo(x - 8 * s, y - 12 * s, x, y); ctx.quadraticCurveTo(x + 8 * s, y - 12 * s, x + 18 * s, y); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(10, cy + 40); for (let x = 10; x < w - 10; x += 12) ctx.quadraticCurveTo(x + 3, cy + 36, x + 6, cy + 40); ctx.stroke();
  } else if (kind === 'wall') {
    ctx.strokeRect(cx - 52, cy - 40, 104, 80);
    ctx.beginPath(); ctx.ellipse(cx, cy, 30, 14, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 30, cy); for (let i = 0; i < 5; i++) ctx.lineTo(cx - 44, cy - 8 + i * 4); ctx.stroke();
  } else {
    drawLanternSketch(ctx, cx, cy + 8, 62);
  }
  ctx.restore();
}

const adventures = new Adventures(state, {
  note: (title, text, id) => showNote(title, text, id),
  toast: (text, secs) => hud.toast(text, secs),
  save: () => save(),
});

// Ada's pages, where they lie (until you've read them).
const PAGE_SPOTS = { punt: 'punt', head: 'daymark', strand: 'shelter' };
function pageNear() {
  if (!onFoot) return null;
  const read = adventures.pagesFound();
  for (const [id, kind] of Object.entries(PAGE_SPOTS)) {
    if (read.includes(id)) continue;
    const sp = world.coast.spots.find((q) => q.kind === kind);
    if (sp && Math.hypot(walker.pos.x - sp.x, walker.pos.z - sp.z) < sp.r + 0.6) return id;
  }
  return null;
}
function readPage(id, again = false) {
  const P = PAGES[id];
  if (again) {
    showNote(P.title, P.text, id);
    return;
  }
  // (The page first; if it was the last one, the notebook's ending follows it.)
  const found = adventures.pagesFound().length;
  audio.rustle?.();
  showNote(P.title, `${found ? `Another of Ada’s pages, ${P.where} (${found + 1} of 3). ` : `A page of someone’s notebook, ${P.where}. `}“${P.text}”`, id);
  adventures.page(id);
}

// Coast spots (the board, the bench, the chandlery's door…) within reach on foot.
const coastSpot = (kind, pad = 0) => (onFoot ? world.coast.spots.find((q) => q.kind === kind && Math.hypot(walker.pos.x - q.x, walker.pos.z - q.z) < q.r + pad) : null);
const chandleryNear = () => onFoot && world.coast.spots.some((q) => q.kind === 'door' && q.id === 'chandlery' && Math.hypot(walker.pos.x - q.x, walker.pos.z - q.z) < q.r + 0.4);
// The head of the quay, where a boat can be brought round to.
const QUAY_HEAD = { x: (HAVEN_QUAY.x0 + HAVEN_QUAY.x1) / 2, z: HAVEN_QUAY.z0 + 3 };
const quayHeadNear = () => onFoot && Math.hypot(walker.pos.x - QUAY_HEAD.x, walker.pos.z - QUAY_HEAD.z) < 3;

/* ---- the notice board ---- */

function openBoard() {
  if (modal) return;
  modal = 'board';
  $('board').hidden = false;
  audio.page();
  renderBoard();
  teach('board', 'Everything on the board comes from the water itself: the wind and sea right now, which fish are busy at this hour round the harbour, and where gulls are diving. It changes as the day does.', 8);
}
function closeBoard() {
  $('board').hidden = true;
  if (modal === 'board') modal = null;
}
function renderBoard() {
  const sky = weather.rain > 0.6 ? 'Heavy rain' : weather.rain > 0.15 ? 'Light rain' : weather.cloud > 0.7 ? 'Overcast' : weather.cloud > 0.3 ? 'Some cloud' : 'Clear';
  $('board-sub').textContent = `${formatClock(state.hour)} · day ${state.day}`;
  const p = (text, cls = '') => {
    const e = document.createElement('p');
    if (cls) e.className = cls;
    e.textContent = text;
    return e;
  };
  $('board-weather').replaceChildren(...weatherLines(sky).map((l) => p(l)));
  const birds = birdsWorking(world.flocks, state.places);
  $('board-birds').replaceChildren(...(birds.length ? birds.map((l) => p(l)) : [p('No gulls working the water just now. They come down where fish drive the bait to the top: watch for them at dawn and dusk.', 'j-faint')]));
  const about = whatsAbout(eco);
  $('board-about').replaceChildren(...(about.length ? about.map((a) => {
    const d = document.createElement('div');
    d.className = 'board-fish';
    const b = document.createElement('b');
    b.textContent = a.sp.name;
    d.append(b, p(`${a.act > 0.85 ? 'Busy' : 'About'} ${a.where}. ${a.how ? `Try ${a.how}.` : ''}`));
    const g = document.createElement('button');
    g.type = 'button';
    g.className = 'pk-btn quiet';
    g.textContent = 'In the field guide';
    g.addEventListener('click', () => {
      closeBoard();
      openGuide(a.sp.id);
    });
    d.append(g);
    return d;
  }) : [p('A quiet hour: little is feeding close to the harbour. The evening is usually better.', 'j-faint')]));
  const list = notices(adventures).map((n) => {
    const d = document.createElement('div');
    d.className = `board-note ${n.status}`;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'board-note-title';
    b.textContent = `${n.title}${n.status === 'done' ? ' ✓' : n.status === 'unknown' ? '' : ' (read)'}`;
    b.addEventListener('click', () => {
      const first = adventures.clue(n.id);
      closeBoard();
      if (!first || adventures.status(n.id) !== 'done') showNote(n.title, n.text, n.id);
    });
    d.append(b);
    // The cuttlefish photograph: pin it up here.
    if (n.id === 'wall' && n.status !== 'unknown' && !state.wallPhoto) {
      const ph = [...state.photos].reverse().find((q) => q.subjects.species.includes('cuttlefish'));
      if (ph) {
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'pk-btn';
        pin.textContent = 'Pin up your photograph';
        pin.addEventListener('click', () => {
          pinWall(ph.id);
          closeBoard();
        });
        d.append(pin);
      }
    }
    return d;
  });
  $('board-notices').replaceChildren(...list);
}
$('board-close').addEventListener('click', closeBoard);
$('board').addEventListener('click', (e) => { if (e.target === $('board')) closeBoard(); });
$('board-plan').addEventListener('click', () => {
  closeBoard();
  openGuide();
});
$('board-map').addEventListener('click', () => {
  closeBoard();
  openMap();
});

// The board in the world: its notes, and your photograph once it's pinned up.
async function paintHavenBoard() {
  let img = null;
  if (state.wallPhoto) {
    const u = await photos.url(state.wallPhoto, 'blob');
    if (u) {
      img = new Image();
      img.src = u;
      await img.decode().catch(() => { img = null; });
    }
  }
  world.coast.paintBoard((ctx, w, h) => paintBoard(ctx, w, h, { photo: img, seen: { kittiwake: adventures.status('kittiwake') === 'done' } }));
}

function pinWall(id) {
  state.wallPhoto = id;
  adventures.step('wall', 'pinned');
  paintHavenBoard();
  save();
}

/* ---- the bench, and boats brought round ---- */

function sitOnBench() {
  const h = state.hour;
  const line = h < 6 ? 'The harbour is asleep: just the lamp, and the water knocking at the quay.' : h < 11 ? 'Gulls on the quay wall, and the smell of tar and rope.' : h < 17 ? 'The boats nod at their moorings; someone has left a coil of rope drying on the wall.' : h < 21 ? 'The light goes gold over the bay, and the lamp comes on behind you.' : 'Stars over the bay, and the lamp’s circle of light round the bench.';
  const opts = [{ text: 'An hour', hours: 1 }];
  if (h < 17.5) opts.push({ text: 'Until golden hour', to: 18.5 });
  if (h < 20.5 && h > 4) opts.push({ text: 'Until dark', to: 21.5 });
  if (h >= 20 || h < 4.5) opts.push({ text: 'Until first light', to: 5.2 });
  ask('The bench by the lamp', `${line} Sit a while?`, [
    { text: 'Get up again', cls: 'quiet' },
    ...opts.map((o) => ({ text: o.text, run: () => waitAWhile(o.hours ?? ((o.to - state.hour + 24) % 24), 'You sit and watch the harbour…') })),
  ]);
}

let waiting = null;
function waitAWhile(hours, text) {
  if (modal || fishing.busy) return;
  if (fishing.lineOut) fishing.cancel();
  modal = 'travel';
  hud.sleep(true, text);
  waiting = { hours, t: 0, done: false };
}
function updateWaiting(dt) {
  if (!waiting) return;
  waiting.t += dt;
  if (!waiting.done && waiting.t > 0.9) {
    waiting.done = true;
    passTime(waiting.hours);
    eco.settle();
    save();
  }
  if (waiting.t > 1.9) {
    hud.sleep(false);
    modal = null;
    hud.toast(`${formatClock(state.hour)}. ${state.hour > 20.5 || state.hour < 5.5 ? 'The lamp is lit.' : 'The harbour carries on round you.'}`, 3.5);
    waiting = null;
  }
}

// Alongside the quay, in water deep enough for the skiff.
function quayMooring(b) {
  for (const [dx, dz] of [[2.4, -3], [-2.4, -3], [2.4, -7], [-2.4, -7]]) {
    const p = { x: (dx > 0 ? HAVEN_QUAY.x1 : HAVEN_QUAY.x0) + dx * 0.9, z: HAVEN_QUAY.z1 + dz, heading: 0 };
    const taken = boats.some((o) => o !== b && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 3);
    if (!taken && floats(b, p)) return p;
  }
  return null;
}
function boatsRound() {
  const here = (b) => Math.hypot(b.pos.x - QUAY_HEAD.x, b.pos.z - HAVEN_QUAY.z1) < 14;
  const list = boats.filter((b) => b.kind !== 'bass' && !here(b));
  if (!list.length) {
    hud.toast('Your boats are all here at the quay already. (The bass boat lives on Longmere.)', 4);
    return;
  }
  ask('Bring a boat round?', 'One of the harbour lads will row or run it round to the quay for you. It takes a little while.', [
    { text: 'Never mind', cls: 'quiet' },
    ...list.map((b) => ({
      text: `The ${b.name}`, run: () => {
        const p = quayMooring(b);
        if (!p) {
          hud.toast('There’s no room alongside the quay just now.', 3);
          return;
        }
        const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
        b.place(p.x, p.z, p.heading);
        // (Made fast alongside, so it's still there when you come down the steps.)
        b.setAnchor(true);
        passTime(clamp(d / 300, 0.15, 1.5));
        audio.knock(0.4);
        save();
        hud.toast(`The ${b.name} is made fast alongside the quay. Step down into it from the quay steps (and raise its anchor to go).`, 6);
      },
    })),
  ]);
}

/* ---- photographs ---- */

const photos = new PhotoStore();
let photoFov = 50;
let pendingPhoto = null;
const _frustum = new THREE.Frustum(), _pm = new THREE.Matrix4(), _pv = new THREE.Vector3();

// What's in the picture: fish close enough to see (under the water, or at the surface), the
// places in view, and gulls diving.
function photoSubjects(extra = null) {
  camera.updateMatrixWorld();
  _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_pm);
  const c = camera.position, under = c.y < -0.05;
  const species = new Set(extra?.species || []);
  for (const a of eco.agents) {
    if (!a.active || a.state === 'caught' || a.state === 'gone' || a.sp.retired) continue;
    const d = Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z);
    if (d > (under ? 13 : 5) || (!under && a.y < -0.9)) continue;
    if (_frustum.containsPoint(_pv.set(a.x, a.y, a.z))) species.add(a.sp.id);
  }
  const places = [];
  for (const p of PLACES) {
    if (p.area) {
      if (p.test(c.x, c.z)) places.push(p.id);
      continue;
    }
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d > 420) continue;
    if (d < 25 || _frustum.containsPoint(_pv.set(p.x, Math.max(solidHeight(p.x, p.z), 0) + 2, p.z))) places.push(p.id);
  }
  const birds = world.flocks.some((f) => Math.hypot(f.x - c.x, f.z - c.z) < 320 && _frustum.containsPoint(_pv.set(f.x, 12, f.z)));
  return { species: [...species].slice(0, 12), places: places.slice(0, 12), birds };
}

function openPhoto() {
  if (modal || !started) return;
  if (fishing.aiming) fishing.cancel();
  modal = 'photo';
  photoFov = camera.fov;
  hud.hidden(true);
  $('photo-frame').hidden = false;
  $('pf-hint').textContent = touch.active ? 'Drag to look, pinch to zoom' : `Drag to look · mouse wheel to zoom · ${input.keyLabel('cast')} or ${input.keyLabel('photo')} takes it · Esc puts the camera away`;
  teach('photoMode', `Photo mode: frame your picture and take it. Under the water (${touch.active ? 'the eye button, from a boat' : input.keyLabel('view')}) you can photograph the fish themselves. Your album is in the journal, under Memories.`, 8);
}
function closePhoto() {
  $('photo-frame').hidden = true;
  camera.fov = photoFov;
  camera.updateProjectionMatrix();
  hud.hidden(hudOff);
  if (modal === 'photo') modal = null;
}
let capturing = false;
async function takePhoto(extra = null, title = '') {
  if (capturing) return;
  if (state.photos.length >= PHOTO_MAX) {
    hud.toast(`Your album is full (${PHOTO_MAX} photographs). Download or delete some in the journal (Memories) to make room.`, 6);
    return;
  }
  const subjects = photoSubjects(extra);
  const from = modal;
  capturing = true;
  let shot;
  try {
    shot = await capture(renderer.domElement, () => draw());
  } finally {
    capturing = false;
  }
  audio.shutter?.();
  const P = player().pos;
  pendingPhoto = { shot, subjects, from, meta: { x: Math.round(P.x), z: Math.round(P.z), place: placeName(P.x, P.z) || PLACES.find((q) => q.area && q.test(P.x, P.z))?.name || '' } };
  if (from === 'photo') closePhoto();
  $('pc-img').src = shot.preview;
  $('pc-title').value = title;
  const sp = subjects.species.map((id) => fishById[id]?.name).filter(Boolean);
  const pl = subjects.places.map((id) => PLACES.find((q) => q.id === id)?.name).filter(Boolean);
  $('pc-text').textContent = [sp.length ? `In the picture: ${sp.join(', ')}.` : '', pl.length ? `${pl.slice(0, 4).join(', ')}.` : '', subjects.birds ? 'Gulls diving.' : ''].filter(Boolean).join(' ') || 'A quiet moment.';
  if (from !== 'catch') modal = 'photocard';
  $('photo-card').hidden = false;
}
async function keepPhoto() {
  const pp = pendingPhoto;
  if (!pp) return;
  pendingPhoto = null;
  $('photo-card').hidden = true;
  if (modal === 'photocard') modal = null;
  const id = photoId();
  await photos.put(id, pp.shot.blob, pp.shot.thumb);
  const meta = { id, title: $('pc-title').value.replace(/[<>]/g, '').trim().slice(0, 60), at: Date.now(), day: state.day, hour: Math.round(state.hour * 100) / 100, ...pp.meta, sky: weather.state, subjects: pp.subjects };
  state.photos.push(meta);
  adventures.photographed(meta);
  save();
  hud.toast(`Kept in your album (${state.photos.length} of ${PHOTO_MAX}).${photos.persistent ? '' : ' This browser won’t keep it after you close the tab: download it from the journal.'}`, 4);
}
function discardPhoto() {
  pendingPhoto = null;
  $('photo-card').hidden = true;
  if (modal === 'photocard') modal = null;
}
$('pf-take').addEventListener('click', () => takePhoto());
$('pf-leave').addEventListener('click', () => closePhoto());
$('pc-keep').addEventListener('click', (e) => {
  e.stopPropagation();
  keepPhoto();
});
$('pc-discard').addEventListener('click', (e) => {
  e.stopPropagation();
  discardPhoto();
});
$('pc-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') keepPhoto(); });

// Gulls you've seen diving (for the map, once you've learned to look): kept for an hour of game time.
const birdSightings = [];
let birdT = 0;
function watchBirds(dt) {
  birdT -= dt;
  if (birdT > 0) return;
  birdT = 1;
  const abs = state.day * 24 + state.hour, P = player().pos;
  for (const f of world.flocks) {
    if (f.t < 1 || Math.hypot(f.x - P.x, f.z - P.z) > 380) continue;
    const s = birdSightings.find((b) => Math.hypot(b.x - f.x, b.z - f.z) < 40);
    if (s) Object.assign(s, { x: f.x, z: f.z, at: abs });
    else birdSightings.push({ x: f.x, z: f.z, at: abs });
  }
  for (let i = birdSightings.length - 1; i >= 0; i--) if (abs - birdSightings[i].at > 1.5) birdSightings.splice(i, 1);
}

// The adventures' own checks, twice a second.
let advT = 0;
const advCtx = { onFoot: false, player: null, boat: null, underwater: false, cam: null, flocks: [] };
function watchAdventures(dt) {
  advT -= dt;
  if (advT > 0) return;
  advT = 0.5;
  advCtx.onFoot = onFoot;
  advCtx.player = player().pos;
  advCtx.boat = boat.pos;
  advCtx.underwater = rig.underwaterView && camera.position.y < -0.05;
  advCtx.cam = camera.position;
  advCtx.flocks = world.flocks;
  adventures.check(advCtx);
}

// Animals you've seen for yourself: in the underwater view or following your bait, close and in
// front of you (and every one you catch). The field guide keeps the record.
const seenAgents = new Set();
function markObserved(id, agent) {
  const obs = (state.observed = state.observed || {});
  const key = agent ? agent.id : `catch-${id}`;
  if (agent && seenAgents.has(key)) return;
  seenAgents.add(key);
  const at = agent || player().pos;
  const rec = obs[id];
  if (rec) rec.count++;
  else obs[id] = { count: 1, day: state.day, hour: Math.round(state.hour * 100) / 100, zone: zoneAt(at.x, at.z) };
}
let observeT = 0;
const _fwd = new THREE.Vector3();
function watchObservations(dt) {
  observeT -= dt;
  if (observeT > 0 || !rig.underwaterView) return;
  observeT = 0.5;
  camera.getWorldDirection(_fwd);
  const c = camera.position;
  for (const a of eco.agents) {
    if (!a.active || a.state === 'gone' || a.state === 'caught') continue;
    const dx = a.x - c.x, dy = a.y - c.y, dz = a.z - c.z, d = Math.hypot(dx, dy, dz);
    if (d > 9 || d < 0.2) continue;
    if ((dx * _fwd.x + dy * _fwd.y + dz * _fwd.z) / d < 0.55) continue;
    markObserved(a.sp.id, a);
  }
}

let placeTimer = 0;
function checkPlaces(dt) {
  placeTimer -= dt;
  if (placeTimer > 0) return;
  placeTimer = 0.4;
  const p = player().pos;
  // The map fills in around you: further out on the water than among the trees.
  explored.reveal(p.x, p.z, onFoot ? 90 : 150);
  for (const pl of PLACES) {
    if (state.places[pl.id] || !pl.test(p.x, p.z)) continue;
    state.places[pl.id] = { day: state.day, hour: state.hour };
    hud.place(pl.name, pl.sub);
    audio.chime();
    hud.toast(`${pl.name} is in your journal now`);
    hud.pulseJournal();
    if (pl.id === 'landing' && !onFoot) teach('landingTip', `Tie up here: ${touch.active ? 'tap the prompt' : `press ${input.keyLabel('interact')}`} to step ashore. Camp is just up the path.`, 6);
    if (pl.id === 'camp') teach('campTip', 'Camp: grill and eat what you catch, swap rods and tackle from the tackle box, and sleep until morning.', 7);
    if (pl.id === 'stream') teach('streamTip', 'Fernbeck’s trout hold in the pools. They’re shy: walk softly, and bring the fly rod from camp.', 7);
    if (pl.id === 'lake') teach('lakeTip', 'Reedmere: perch and pike take lures, carp graze the bottom, rudd sip near the lily pads.', 7);
    if (pl.id === 'quay') teach('quayTip', 'Wend Quay: a camp with a tackle box. Mullet cruise the estuary, flounder lie on the sand, and sea bass hunt the channel at dawn and dusk. The trail inland leads to Longmere.', 9);
    if (pl.id === 'boathouse') teach('boathouseTip', 'The Mere Boathouse: a bass boat at the jetty and a tackle box. Largemouth bass lurk by the pads and the drowned oaks; pike lie in the weed.', 8);
    if (pl.id === 'puffin') teach('puffinTip', 'Puffin Cove: a sheltered camp with a tackle box. After dark, squid gather under the lamp light; wrasse live in the kelp by the rocks.', 8);
    if (pl.id === 'deep') teach('deepTip', 'The Blue Water. Watch for seabirds diving and the sea boiling white: tuna chase the sprat shoals out here.', 8);
    if (pl.id === 'haven') teach('havenTip', `Willowhaven: read the notice board for what’s about today, find all your tackle in the chandlery, sit on the bench a while, or have a boat brought round to the quay (${touch.active ? 'tap the prompts' : input.keyLabel('interact')}).`, 10);
    if (pl.id === 'strand') teach('strandTip', 'Shell Strand: bass come into the surf at dusk, and flatfish up the sand after dark. The shelf above the beach is a dry, level place for a tent.', 9);
    if (pl.id === 'head') teach('headTip', 'Cove Head takes the swell: bass and white bream in the wash below the ledges. You can see the Kittiwake’s buoy from the daymark.', 8);
    if (pl.id === 'reach') teach('reachTip', 'The cove channel is sheltered from every wind: a calm place for a float at dusk, and for watching cuttlefish under the water.', 8);
    if (pl.id === 'wreck') teach('wreckTip', `The Kittiwake lies below you. Look under the water (${touch.active ? 'the view button' : input.keyLabel('view')}) to see her, or fish over her: a bottom rig for the conger, a shad for the pollack.`, 9);
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
    hud.toast('Rain patters on the water. Out past the bay, something is rising.', 6);
  }
  if (!state.tips.night && (h > 21 || h < 4.5)) {
    state.tips.night = true;
    hud.toast(state.items.lantern ? 'Night settles in. The lantern keeps you company.' : 'Night settles in. A light would be nice out here.', 6);
  }
  if (!state.tips.hatch && hatchLevel() > 0.8 && onFoot && streamSDF(walker.pos.x, walker.pos.z) < 25) {
    state.tips.hatch = true;
    hud.toast('Little flies are hatching over the water, and the trout are rising to them. A dry fly’s moment.', 6);
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
    if (d > (c.type === 'birds' ? 400 : c.type === 'boil' ? 220 : 90)) continue;
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
      case 'boil':
        // Big fish crashing through bait at the surface.
        fx.splash(c.x + rand(-2, 2), 0.05, c.z + rand(-2, 2), 14, 2.4, 1.4);
        fx.ripple(c.x, c.z, 2.6, 1.8, 0.6);
        if (vol > 0) audio.splashSmall(0.7 * vol, pan);
        if (d < 120) teach('boil', 'The sea boils as big fish crash through the bait. Motor up gently, stop well short, and cast into it.', 7);
        break;
      case 'birds':
        world.birdsAt(c.x, c.z);
        if (d < 200) teach('birds', 'Gulls diving over the water: fish are feeding underneath, driving small fry to the top.', 7);
        break;
      case 'fizz':
        // Feeding carp: a patch of fizzing bubbles breaking the surface.
        for (let i = 0; i < 4; i++) fx.ripple(c.x + rand(-0.5, 0.5), c.z + rand(-0.5, 0.5), 0.15 + Math.random() * 0.2, 0.7, 0.35);
        underwater.bubbles(c.x, c.y + 0.1, c.z, 6);
        if (vol > 0.3 && Math.random() < 0.4) audio.bubble(0.01 * vol, pan);
        if (d < 30) teach('fizz', 'Fizzing patches of bubbles on the lake: carp grazing the bottom. They want a bait laid right on the bottom, not a lure.', 7);
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

rowboat.onStroke = (p, side) => {
  fx.ripple(p.x, p.z, 0.9, 1.1, 0.4);
  fx.splash(p.x, 0.05, p.z, 4, 1.2, 0.4);
  audio.oar(side > 0 ? -0.3 : 0.3, 0.8);
};
// A paddle slips in with hardly a sound.
BOATS.kayak.onStroke = (p, side) => {
  fx.ripple(p.x, p.z, 0.6, 0.9, 0.3);
  fx.splash(p.x, 0.05, p.z, 2, 0.7, 0.25);
  audio.oar(side > 0 ? -0.3 : 0.3, 0.35);
};
for (const b of boats) b.onBump = (v) => audio.knock(clamp(v / 3, 0.4, 1));
for (const b of boats) {
  if (b.motor) b.onShallow = () => hud.flash(b.kind === 'bass' ? 'Shallow water: the outboard tips up. Ease back to the first notches to creep on with the electric motor.' : 'Shallow water: the motor tips up, so you can only creep along. Steer for deeper water.', t, 3.4);
}
// What's underfoot, for the sound of your steps: planks, stone (the quay and Willowhaven's
// setts), sand (beaches and the strand) or grass.
function surfaceAt(p) {
  const g = heightAt(p.x, p.z);
  if (walkHeight(p.x, p.z) > g + 0.2) return p.x > HAVEN_QUAY.x0 - 0.5 && p.x < HAVEN_QUAY.x1 + 0.5 && p.z > HAVEN_QUAY.z0 - 0.5 && p.z < HAVEN_QUAY.z1 + 0.5 ? 'stone' : 'wood';
  if (Math.hypot(p.x - HAVEN.x, p.z - HAVEN.z) < 24 && g > 1.4 && g < 1.8) return 'stone';
  if (Math.hypot(p.x - DAYMARK.x, p.z - DAYMARK.z) < 14) return 'stone';
  if (g < 1.5 || (Math.abs(p.x - STRAND.x) < 28 && p.z > STRAND.z - 8 && p.z < STRAND.z + 14)) return 'sand';
  return 'grass';
}
walker.onStep = (p, jog) => audio.step(jog, 0, surfaceAt(p));
walker.onSplash = (p, deep) => {
  audio.wade(0.5 + deep * 0.5);
  fx.ripple(p.x + rand(-0.2, 0.2), p.z + rand(-0.2, 0.2), 0.5, 1.0, 0.35);
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
let rainDrawn = RAIN_N; // how many drops the graphics setting allows
rainLines.frustumCulled = false;
scene.add(rainLines);

function updateRain(dt) {
  const fxRain = weather.rain * settings.weather.rainFx;
  rainLines.visible = fxRain > 0.02 && underwater.submerge < 0.5;
  if (!rainLines.visible) return;
  rainMat.opacity = 0.42 * Math.min(1, fxRain * 1.2);
  rainGeo.setDrawRange(0, Math.round(rainDrawn * Math.min(1, 0.3 + settings.weather.rainFx * 0.7)) * 2);
  rainLines.position.set(rig.focus.x, Math.max(0, rig.focus.y - 1.4), rig.focus.z);
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
  const mode = skyMode();
  if (mode !== 'auto') {
    weather.state = mode;
  } else {
    weather.timer -= dt * Math.min(speed, 10);
    if (weather.timer <= 0) {
      weather.state = pick(NEXT_SKY[weather.state]);
      weather.timer = weather.state === 'heavy' ? rand(60, 110) : weather.state === 'light' ? rand(80, 150) : rand(150, 300);
    }
  }
  const sky = SKIES[weather.state];
  // A change you choose settles in about ten seconds; a change by itself drifts in more slowly.
  const rate = (mode === 'auto' ? 0.08 : 0.3) * Math.min(speed, 6);
  weather.rain = damp(weather.rain, weather.override ?? sky.rain, rate, dt);
  weather.cloud = damp(weather.cloud, Math.max(sky.cloud, weather.override ?? 0), rate, dt);
}
// How dull the light is: overcast skies and rain both grey the day.
const gloom = () => Math.max(weather.rain, weather.cloud * 0.72);

// Flies hatch over the stream and lake in the morning and (most of all) the evening;
// a light shower helps, heavy rain stops it.
function hatchLevel() {
  const h = state.hour;
  const morning = smoothstep(6.3, 7.8, h) * (1 - smoothstep(9.5, 11, h));
  const evening = smoothstep(17.3, 18.5, h) * (1 - smoothstep(20.5, 21.6, h));
  const day = 0.25 * smoothstep(8, 10, h) * (1 - smoothstep(16, 18, h));
  const r = weather.rain;
  return clamp((morning * 0.9 + evening * 1.3 + day) * (r > 0.6 ? 0.4 : 1 + r * 0.5), 0, 1.4);
}

/* ---------------- graphics quality ---------------- */

const quality = {
  choice: settings.graphics.preset,
  autoLevel: startingLevel(touch.active),
};
const frameWatch = new FrameWatch();
const qualityLevel = () => (quality.choice === 'auto' ? quality.autoLevel : quality.choice);
const qualityText = () => {
  const L = PRESETS[qualityLevel()].label;
  const custom = Object.entries(settings.graphics).some(([k, v]) => !['preset', 'scale', 'fps'].includes(k) && v !== 'auto') || settings.graphics.scale < 1;
  return `${quality.choice === 'auto' ? `Auto (${L})` : L}${custom ? ', adjusted' : ''}`;
};

function applyQuality() {
  const G = settings.graphics;
  quality.choice = G.preset;
  state.quality = G.preset;
  const q = resolveQuality(qualityLevel(), G);
  const pr = Math.max(0.5, Math.min(window.devicePixelRatio, q.pixelRatio) * q.scale);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  env.setShadows(q.shadows, q.shadowSize);
  water.setSegments(q.waterSegments);
  water.setDetail(q.waterDetail);
  reflection.setQuality(q.reflection, q.reflectEvery);
  mist.setLayers(q.mist);
  surfaceUniforms.uDetail.value = q.surfaceDetail;
  ripples.setQuality(q.ripples, q.rippleSpan, renderer);
  water.uniforms.uRippleTexel.value = 1 / Math.max(1, ripples.size);
  rainDrawn = q.rain;
  world.setPixelRatio(pr);
  world.setQuality(q);
  // Fewer distant fish are drawn on lower settings, but every one of them is still there:
  // simulated, able to bite, and on the fish finder.
  fishRenderer.density = q.fishDensity;
  fishRenderer.near = 8 + 14 * q.fishDensity;
  eco.simRadius = q.simRadius;
  underwater.setQuality(q);
  underwater.setPixelRatio(pr);
  quality.caustics = q.caustics;
  const text = `Graphics: ${qualityText()}`;
  $('title-quality').textContent = text;
}

function applyDifficulty() {
  const d = DIFFICULTY[state.difficulty] || DIFFICULTY.standard;
  fishing.diff = d;
  eco.biteScale = d.bite;
  $('title-difficulty').textContent = `Difficulty: ${d.label}`;
}

function setDifficulty(id) {
  if (fishing.fight) {
    hud.flash('Land this fish first, then change the difficulty', t, 2.4);
    return;
  }
  state.difficulty = id;
  applyDifficulty();
  save();
}

// Camera feel: sensitivity, inverted axes and reduced motion.
function applyControls() {
  const C = settings.controls;
  rig.sensitivity = C.sensitivity;
  rig.invertX = C.invertX;
  rig.invertY = C.invertY;
  rig.reduced = C.reducedMotion;
  document.documentElement.classList.toggle('reduce-motion', !!C.reducedMotion);
  fishing.assist = C.cast === 'assisted';
  input.setBindings(C.keys || defaultBindings());
  for (const k of document.querySelectorAll('kbd[data-key]')) k.textContent = input.keyLabel(k.dataset.key);
  hud.cache = {};
}

// A little camera shake, unless you've asked for less motion.
function shake(s) {
  if (!settings.controls.reducedMotion) rig.shake = Math.max(rig.shake, s);
}

function watchFrameRate(rawDt) {
  if (quality.choice !== 'auto' || !started || modal) return;
  const cap = settings.graphics.fps;
  if (!frameWatch.tooSlow(rawDt, cap ? cap * 0.85 : 42)) return;
  const next = lowerLevel(quality.autoLevel);
  if (!next) return;
  quality.autoLevel = next;
  applyQuality();
  frameWatch.reset(3);
}

/* ---------------- settings ---------------- */

const settingsUI = new SettingsUI(state, {
  changed: (section, key, value, live) => {
    if (section === 'audio') audio.setVolumes(settings.audio);
    else if (section === 'graphics') {
      if (key === 'preset') frameWatch.reset();
      if (!live || key !== 'scale') applyQuality();
      else applyQuality();
    } else if (section === 'controls') applyControls();
    else if (section === 'weather' && key === 'mode') {
      const w = WEATHER_MODES.find((m) => m.id === value);
      if (started && w) hud.flash(value === 'auto' ? 'The weather will change as it likes' : `The weather turns: ${w.name.toLowerCase()}`, t, 2.4);
    }
    if (!live) save();
  },
  close: () => closeSettings(),
  playAlert: () => {
    audio.start();
    audio.biteAlert('strike');
  },
  qualityText,
  difficulty: () => state.difficulty,
  setDifficulty,
  keyLabel: (code) => input.label(code),
});

let modalBeforeSettings = null;
function openSettings(tab) {
  if (modal === 'settings') return;
  if (fishing.aiming) fishing.cancel();
  modalBeforeSettings = modal;
  if (modal === 'journal') journal.close();
  if (started) modal = 'settings';
  input.releaseAll();
  settingsUI.open(tab);
  audio.page();
}

function closeSettings() {
  settingsUI.close();
  if (modal === 'settings') modal = null;
  if (modalBeforeSettings === 'journal') openJournal();
  modalBeforeSettings = null;
  audio.page();
  save();
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
  const back = onFoot ? 'back over your shoulder' : 'back to the boat';
  if (rig.mode === 'under') {
    hud.chip(T
      ? '<b>Underwater</b> · drag to look around · pinch to zoom · the view button switches back'
      : `<b>Underwater</b> · drag to look around · scroll to zoom · ${K('view')} next view · ${K('reset')} ${back}`, 6);
  } else if (rig.mode === 'bait') {
    hud.chip(T
      ? '<b>Watching your bait</b> · drag to look around · the view button switches back'
      : `<b>Watching your bait</b> · drag to look around · ${K('view')} next view · ${K('reset')} ${back}`, 6);
  } else if (rig.mode === 'eye') {
    hud.chip(T
      ? '<b>First person</b> · drag to look around · the view button switches'
      : `<b>First person</b> · drag to look around · ${K('eye')} ${back}`, 4);
  } else if (rig.mode === 'foot') {
    hud.chip(fishing.baitInWater || T ? '<b>On foot</b>' : `<b>On foot</b> · cast first, then ${K('view')} watches your bait underwater`, 3);
  } else hud.chip('<b>Boat view</b>', 2);
}

function cycleView() {
  rig.cycle(fishing.baitInWater, t);
  viewChip();
  if (rig.mode !== 'boat' && rig.mode !== 'foot' && !state.tips.under) {
    state.tips.under = true;
    save();
  }
}

function resetView() {
  rig.reset(player(), t);
  viewChip();
}

/* ---------------- first person ---------------- */

// Through your own eyes: V switches in and out, and C cycles through it. It is always your
// choice: casting, a bite or a hooked fish never change the view.
const _eye = new THREE.Vector3();
let eyeY = 0; // (the steady camera's eye height)
const _hold = new THREE.Vector3();
const _shadowAt = new THREE.Vector3();

function toggleFirstPerson() {
  rig.setFirstPerson(rig.mode !== 'eye', t);
  viewChip();
}

// Each frame after the camera: hold the rod in front of your eyes, hide your own figure (its
// shadow stays), and hold a landed fish up in view.
function updateFirstPerson(dt) {
  const A = player();
  const w = rig.eyeBlend;
  const fp = w > 0.5;
  for (const X of [walker, ...boats]) {
    X.viewHold = null;
    X.faceYaw = null;
    if (X !== A) X.setSelfHidden(false);
  }
  A.setSelfHidden(fp);
  fishing.viewer = fp ? camera.position : null;
  fishing.admire = fp ? 1.1 : 0;
  const near = fp ? 0.06 : 0.1;
  if (camera.near !== near) {
    camera.near = near;
    camera.updateProjectionMatrix();
  }
  if (w <= 0.001) return;
  camera.updateMatrixWorld();
  if (fp) {
    A.viewHold = _hold.set(0.02, -0.2, -0.95).applyMatrix4(camera.matrixWorld);
    A.faceYaw = rig.yaw;
  }
  rodView.update(dt, t, fishing, camera, { yaw: rig.yaw, walking: onFoot && walker.moving, phase: walker.phase, onBoat: !onFoot });
  // On foot you carry the rod in view; in a boat it lies in the bottom while you row.
  if (onFoot || A.pose.fishing > 0.02) {
    A.rod.visible = onFoot || boat.occupied;
    if (onFoot) walker.tube.visible = false;
    rodView.place(A.rod, camera, w);
    bendRod(A.active, lerp(A.pose.bend, rodView.bend, w));
  }
  fishing.afterView(t);
}

function toggleFinder(force) {
  const on = force ?? !finder.visible;
  finder.setVisible(on);
  $('finder-btn').classList.toggle('on', on);
  state.sonar = on;
  if (on && !state.tips.sonar) {
    state.tips.sonar = true;
    // Show what the colours mean the first time, unless the screen is small (the ? button has it).
    if (innerWidth > 700 && innerHeight > 600) finder.toggleLegend(true);
  }
  save();
}

/* ---------------- HUD ---------------- */

const STATUS_TEXT = {
  quiet: 'Quiet for now',
  curious: 'Something is curious…',
  rising: 'A shape drifts up beneath the fly…',
  follow: 'Something is following your lure!',
  nibble: 'Nibbling… wait for the float to go under',
  bleep: 'Bleep! Something is moving the line…',
  sinking: 'The rig sinks to the bottom…',
  set: 'On the bottom. Waiting for the alarm…',
  bite: 'Bite! Strike now',
  rattle: 'The rod tip rattles: something is at the bait…',
  tip: 'The rod tip pulls round! Strike now',
  touch: 'Something touches the jig…',
  grab: 'The jig stops sinking: weight on it! Strike now',
  jigbottom: 'The jig rests on the bottom: lift it',
  strike: 'Thump! It hit the lure!',
  run: 'A run! The alarm is screaming!',
  sip: 'It sipped the fly!',
  take: 'The indicator darted under!',
  hooked: 'Hooked!',
  fishon: 'Fish on! It hooked itself',
};

function currentHint() {
  if (!started || modal) return '';
  const L = (c) => K({ KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right' }[c]);
  const T = touch.active;
  const space = K('cast');
  const info = fishing.info;
  switch (fishing.state) {
    case 'aiming': {
      // Holding loads the rod and the ring moves out; let go when it's where you want it.
      if (fishing.kind === 'fly') {
        const when = fishing.flyForward ? 'let go now, as the rod comes forward' : fishing.deliver ? 'it goes out on the next forward stroke' : 'false casting: each stroke shoots more line';
        return `${T ? 'Hold to false cast' : `Hold ${space} to false cast`} · ${when} · ${T ? 'stick left/right aims' : `${L('KeyA')}${L('KeyD')} aim`}${windHint()} · ${T ? '✕ cancels' : `${kbd('Esc')} cancel`}`;
      }
      const how = T ? 'Let go when the ring is where you want it' : `Let go of ${space} when the ring is where you want it`;
      const clean = fishing.assist ? 'the wind is allowed for' : fishing.overload > 0 ? 'overloading: let go now' : fishing.sweet ? 'fully loaded: let go for a perfect cast' : 'let go before it overloads';
      const extra = fishing.kind === 'lure' ? (T ? 'up/down: reeling speed' : `${L('KeyW')}${L('KeyS')} reeling speed`)
        : fishing.kind === 'float' ? (T ? 'up/down: bait depth' : `${L('KeyW')}${L('KeyS')} bait depth`) : '';
      return `${how} (${clean}) · ${T ? 'stick left/right aims' : `${L('KeyA')}${L('KeyD')} aim`}${extra ? ` · ${extra}` : ''}${windHint()} · ${T ? '✕ cancels' : `${kbd('Esc')} cancel`}`;
    }
    case 'drifting':
      if (fishing.status === 'curious') return 'Something is curious about your bait. Keep still…';
      if (fishing.status === 'nibble') return 'Nibbling… wait for the float to go under';
      if (fishing.status === 'follow') return T ? 'It’s following! Tap to twitch, or let go to pause' : `It’s following! Tap ${space} to twitch, or let go to pause`;
      if (fishing.status === 'rising') return 'A fish is coming up to look. Let the fly drift…';
      if (fishing.kind === 'lure') {
        if (info.fouled) return T ? 'Weed on the lure: hold to reel in, or tap to flick it' : `Weed on the lure: hold ${space} to reel in, or tap to flick it`;
        return T
          ? `Hold to reel (${info.retrieve}; stick up/down changes speed) · tap to twitch · let go to pause`
          : `Hold ${space} to reel · ${L('KeyW')}${L('KeyS')} speed: ${info.retrieve} · tap to twitch · let go to pause`;
      }
      if (fishing.kind === 'bottom') {
        if (!info.settled) return 'The rig is sinking to the seabed…';
        return T ? 'Rig on the seabed: watch the rod tip and strike when it pulls round · hold to wind in' : `Rig on the seabed: watch the rod tip, and strike (${space}) when it pulls round · hold ${space} to wind in`;
      }
      if (fishing.kind === 'jig') {
        if (fishing.status === 'touch') return 'Something is touching the jig. Let it keep sinking…';
        return T ? 'Let the jig sink · tap to dart it up, then pause: squid grab it as it glides down · hold to reel slowly' : `Let the jig sink · tap ${space} to dart it up, then pause: squid grab it as it glides down · hold ${space} to reel slowly`;
      }
      if (fishing.kind === 'ledger') {
        if (!info.settled) return 'The rig is sinking to the bottom…';
        return T ? 'Rig on the bottom: wait for the alarm · hold to wind in' : `Rig on the bottom: wait for the alarm · ${K('feed')} loose bait · ${K('rest')} let time pass · hold ${space} to wind in`;
      }
      if (fishing.kind === 'fly') {
        if (info.drag) return 'The fly is dragging: strip in and cast again, upstream of the fish';
        if (fishing.item.fly === 'streamer') return T ? 'Hold to strip the streamer back in pulls · tap to twitch' : `Hold ${space} to strip it back in pulls · tap to twitch`;
        return T ? 'Let the fly drift with the current · hold to strip line in' : `Let the fly drift with the current · tap to twitch · hold ${space} to strip in`;
      }
      if (T) return `Stick up/down: bait depth · hold the button to reel in · tap to twitch${state.tips.under ? '' : ' · the view button looks underwater'}`;
      return `${L('KeyW')}${L('KeyS')} bait depth · hold ${space} to reel in · tap to twitch${state.tips.under ? '' : ` · ${K('view')} look underwater`}`;
    case 'bite': {
      const k = fishing.biteKind;
      const what = k === 'strike' ? 'It hit the lure!' : k === 'run' ? 'A run!' : k === 'sip' ? 'It took the fly!' : k === 'take' ? 'The indicator dipped!' : 'Bite! The float went under.';
      return T ? `${what} Tap the button to strike` : `${what} Press ${space} to strike`;
    }
    case 'reeling': {
      const F = fishing.fight;
      const drag = `${T ? 'stick up/down' : `${L('KeyW')}${L('KeyS')}`} drag: ${DRAG_NAMES[F?.drag ?? 2]}`;
      if (F?.selfHooked && !F.pickedUp) return T ? 'Fish on! It hooked itself on the rig. Hold the button to pick up the rod and play it' : `Fish on! It hooked itself on the rig. Hold ${space} to pick up the rod and play it`;
      if (F && F.tension > 0.97) return T ? 'The line is straining! Let go of the button' : `The line is straining! Let go of ${space}`;
      if (F?.surgeT > 0) return T ? 'It’s surging! Let go of the button' : `It’s surging! Let go of ${space}`;
      if (F && !F.pulling && F.warned) return 'A flick on the surface: it’s about to run. Ease off';
      if (F?.pulling) return `${F.slipping ? 'It’s taking line against the drag.' : F.style?.words || 'It’s pulling.'} ${T ? 'Hold' : `Hold ${space}`} to keep pressure on and tire it · ${drag}`;
      return `${T ? 'Hold the button' : `Hold ${space}`} to reel it in · ease off when it surges · ${drag}`;
    }
    case 'casting': case 'landing': case 'caught': case 'releasing': case 'keeping': case 'retrieving': return '';
    default:
  }
  if (placement.isOn) return '';
  if (onFoot) {
    if (!state.tips.walked) return T ? 'Drag on the left to walk · drag on the right to look around' : `${L('KeyW')}${L('KeyA')}${L('KeyS')}${L('KeyD')} to walk · ${K('jog')} jog · drag to look around`;
    if (!state.places.camp && Math.hypot(walker.pos.x - world.camp.firePos.x, walker.pos.z - world.camp.firePos.z) < 60) return 'Follow the path up to camp';
    return '';
  }
  if (boat.motor) {
    const lv = boat.lever;
    const word = boat.anchored ? 'at anchor' : Math.abs(lv) < 0.03 ? 'neutral' : lv < 0 ? 'astern' : boat.trolling ? 'electric motor (quiet)' : lv < 0.35 ? 'slow ahead' : lv < 0.75 ? 'half ahead' : 'full ahead';
    return T ? `Throttle: ${word} · the stick drives and steers` : `Throttle: ${word} · ${L('KeyW')}${L('KeyS')} lever · ${L('KeyA')}${L('KeyD')} steer · ${K('neutral')} stop · ${K('anchor')} anchor`;
  }
  if (!state.tips.rowed) return T ? 'Drag on the left to row · drag on the right to look around' : `${L('KeyW')}${L('KeyA')}${L('KeyS')}${L('KeyD')} to row · drag to look around`;
  if (!state.tips.cast) return T ? 'Hold the button to aim and cast your line' : `Hold ${space} to aim and cast your line`;
  if (state.tips.caught && !state.tips.journal) return T ? 'Tap Journal to see what you’ve found' : `${K('journal')} to open your journal`;
  if (state.tips.caught && !state.places.camp) return 'Your camp is on the west shore of the bay: row to the landing (follow the Camp marker)';
  if (state.tips.caught && !state.tips.under) return T ? 'The view button lets you look under the water' : `${K('view')} to look under the water`;
  if (state.tips.caught && !state.tips.sonar) return T ? 'The sonar button shows a fish finder' : `${K('finder')} for the fish finder`;
  return '';
}

const ACTION_LABELS = {
  idle: 'Cast', aiming: 'Let go', casting: '', drifting: 'Twitch', bite: 'Strike!', reeling: 'Reel',
  landing: '', caught: 'Let go', releasing: '', keeping: '', retrieving: '',
};

function actionLabel() {
  if (modal === 'note') return 'OK';
  if (fishing.state === 'reeling' && (fishing.fight?.surgeT > 0 || (fishing.fight?.warned && !fishing.pulling))) return 'Easy';
  if (fishing.state === 'reeling' && fishing.pulling) return 'Hold';
  if (fishing.state === 'drifting' && (fishing.kind === 'ledger' || fishing.kind === 'bottom')) return 'Wind in';
  if (fishing.state === 'drifting' && fishing.kind === 'jig') return 'Lift';
  if (fishing.state === 'drifting' && fishing.kind === 'fly') return 'Strip';
  if (fishing.state === 'drifting' && fishing.kind === 'lure') return 'Reel';
  return ACTION_LABELS[fishing.state] ?? '';
}

const _p = new THREE.Vector3();
const _q = new THREE.Vector3();

// A label over a point in the world, or pinned to the screen edge pointing towards it.
function placeMarker(el, x, y, z, show) {
  if (!show || hudOff) {
    el.hidden = true;
    return;
  }
  const dist = Math.hypot(x - player().pos.x, z - player().pos.z);
  _p.set(x, y, z).project(camera);
  const W = innerWidth, H = innerHeight, m = 46;
  // Behind the camera: flip it so the arrow still points the right way round.
  _q.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  let sx = (_p.x * 0.5 + 0.5) * W, sy = (-_p.y * 0.5 + 0.5) * H;
  const behind = _q.z > 0;
  if (behind) {
    sx = W - sx;
    sy = H - m;
  }
  // (Kept clear of the prompt along the bottom while one is showing.)
  const bottom = H - m - 40 - (hud.el.prompt.hidden ? 0 : 52);
  // (A longer label keeps clear of the screen's edges by its own half-width.)
  const mx = Math.max(m, (el.offsetWidth || 0) / 2 + 10);
  const onScreen = !behind && sx > mx && sx < W - mx && sy > m + 50 && sy < bottom;
  let angle = 0;
  if (!onScreen) {
    angle = Math.atan2(sx - W / 2, -(sy - H / 2));
    sx = clamp(sx, mx, W - mx);
    sy = clamp(sy, m + 50, bottom);
  }
  // Two markers pinned to the same spot on the edge: nudge the second one along.
  if (placed.length && placed.some((p) => Math.abs(p[0] - sx) < 110 && Math.abs(p[1] - sy) < 26)) sy += sy > H / 2 ? -30 : 30;
  placed.push([sx, sy]);
  hud.marker(el, sx, sy, onScreen, angle, dist, dist < 12);
}
const placed = [];

// The conditions panel: the wind and sea where you are, and the current at your rig if it's in
// the water (or under you). Directions are arrows as you see them, with the compass in words.
let condT = 0;
function updateConditionsPanel(dt) {
  const el = $('conditions');
  const show = started && !hudOff && !modal && settings.weather.panel;
  el.hidden = !show;
  if (!show || (condT -= dt) > 0) return;
  condT = 0.3;
  const P = player().pos, w = windAt(P.x, P.z);
  const kmh = (v) => Math.round(v * 3.6);
  const sustained = conditions.wind.speed;
  $('cd-wind').textContent = w.speed < 0.6 ? 'calm' : `${arrowFor(w.x, w.z)} ${kmh(w.speed)} km/h from ${compass(conditions.wind.from)}${w.gust > 1.15 ? ' · gusting' : ''}${sustained > 0.6 && w.speed < sustained * 0.6 ? ' · sheltered' : ''}`;
  const at = fishing.state === 'drifting' ? fishing.hook : P;
  const c = currentAt(at.x, at.z, 0), cs = Math.hypot(c.x, c.z) * currentScale();
  $('cd-cur').textContent = cs < 0.03 ? `slack${fishing.state === 'drifting' ? ' at your rig' : ''}` : `${arrowFor(c.x, c.z)} ${cs.toFixed(cs < 0.1 ? 2 : 1)} m/s to ${compass(bearingOf(c.x, c.z))}${fishing.state === 'drifting' ? ' at your rig' : ''}`;
  const hgt = waveHeightHere(P.x, P.z);
  $('cd-sea').textContent = `${seaWords(hgt)}, ${hgt < 0.1 ? 'under 0.1' : `about ${hgt.toFixed(1)}`} m`;
}

function updateHud() {
  const h = state.hour;
  const night = h >= 20.5 || h < 5.5;
  const w = weather.rain > 0.6 ? 'Heavy rain' : weather.rain > 0.15 ? 'Light rain' : weather.cloud > 0.7 ? 'Overcast' : '';
  hud.clock(formatClock(h), phaseName(h), w, night);
  const hunger = camp.hunger;
  hud.food(camp.wellFed ? 'Well fed' : hunger === 'hungry' ? 'Hungry' : hunger === 'peckish' ? 'Peckish' : '', camp.wellFed ? 'fed' : hunger === 'hungry' ? 'hungry' : '');
  hud.hint(currentHint(), t);
  const act = interaction();
  hud.prompt(act ? (touch.active ? `Tap: ${act.text}` : `${K('interact')} ${act.text}`) : '');
  const F = fishing.fight;
  // Ease off: the flick before a run, and the surge as it starts.
  const easy = fishing.state === 'reeling' && !!F && (F.surgeT > 0 || (F.warned && !F.pulling));
  if (touch.active) hud.action(actionLabel(), fishing.state === 'bite' || easy);
  $('cancel-btn').hidden = !(touch.active && fishing.aiming);

  if (fishing.aiming) {
    // Outer ring: how far it will go. Inner ring: the rod's load (amber in the sweet spot, red
    // when it's overloading); for the fly rod, the stroke (amber as it comes forward).
    const fly = fishing.kind === 'fly';
    const load = fly ? (fishing.flyForward ? 1 : 0.35) : fishing.power;
    const warm = fly ? (fishing.flyForward ? 0.6 : 0.2) : fishing.overload > 0 ? 1 : fishing.sweet ? 0.6 : 0.2;
    const sub_ = fishing.overload > 0 ? 'overload' : fishing.sweet ? 'sweet spot' : wind.strength > 0.15 ? `wind ${Math.round(wind.strength * FRESH * 3.6)} km/h ${windArrow()}` : '';
    hud.meter(true, fishing.power, load, warm, fishing.aimValid ? `<span>${Math.round(fishing.castDist)} m</span>${sub_ ? `<span class="ml-sub">${sub_}</span>` : ''}` : '—', -1, fishing.sweet || (fly && fishing.flyForward));
  }
  else if (fishing.state === 'reeling' && F) hud.meter(true, F.progress, F.tension, F.tension, F.surgeT > 0 ? 'easy!' : easy ? 'flick!' : F.slipping ? 'line out' : F.pulling ? 'hold' : 'reel', DRAG_LEVELS[F.drag], easy);
  else hud.meter(false);

  if (started && !modal && fishing.baitInWater) {
    const info = fishing.info;
    let text = STATUS_TEXT[info.status] || '';
    if (info.kind === 'lure' && info.reeling) text += ` · reeling ${info.retrieve}`;
    else if (info.reeling) text += info.kind === 'fly' ? ' · stripping in' : ' · reeling in';
    if (info.drag && info.status === 'quiet') text = 'Dragging across the current';
    if (info.fouled) text = 'Weed on the lure';
    info.text = text;
    hud.bait(info);
  } else hud.bait(null);

  // A mark over the float or line when there's something to do: strike a bite, or pick up the
  // rod when a self-hooking rig has a fish on.
  const fishOn = fishing.state === 'reeling' && F?.selfHooked && !F.pickedUp;
  if ((fishing.state === 'bite' || fishOn) && !modal) {
    _p.copy(fishing.biteKind === 'float' || fishing.biteKind === 'take' ? fishing.bob : fishing.hook);
    _p.y = Math.max(_p.y, 0) + 0.35;
    _p.project(camera);
    const k = fishing.biteKind;
    const text = fishOn ? 'Fish on!' : k === 'float' ? 'Bite — strike!' : k === 'tip' ? 'Tip pulls — strike!' : k === 'grab' ? 'Squid — strike!' : k === 'sip' ? 'Rise — strike!' : 'Strike!';
    hud.bite((_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight, _p.z < 1, text, fishOn);
  } else hud.bite(0, 0, false);

  // Where the boat is while you're ashore; where camp is until you've found it.
  const cp = world.camp.firePos;
  placed.length = 0;
  placeMarker($('boat-marker'), boat.pos.x, boat.heave + 1.6, boat.pos.z, started && onFoot && !modal && !nearBoat());
  const campD = Math.hypot(player().pos.x - cp.x, player().pos.z - cp.z);
  placeMarker($('camp-marker'), cp.x, cp.y + 2.4, cp.z, started && !modal && campD > 14 && (onFoot ? campD < 400 : !state.places.camp && !!state.tips.caught));
  // A trip's destination: a marker until you're on the water it rings.
  const trip = state.trip;
  if (trip) {
    const d = Math.hypot(trip.x - player().pos.x, trip.z - player().pos.z);
    if (!trip.arrived && d < trip.r) {
      trip.arrived = true;
      hud.flash(`You’re on the trip’s water: ${trip.name}. Good luck with the ${fishById[trip.sp].name.toLowerCase()}.`, t, 4);
      save();
    }
    $('trip-name').textContent = fishById[trip.sp].name;
  }
  placeMarker($('trip-marker'), trip?.x ?? 0, 1.2, trip?.z ?? 0, !!trip && started && !modal && Math.hypot((trip?.x ?? 0) - player().pos.x, (trip?.z ?? 0) - player().pos.z) > (trip?.r ?? 0));
}

/* ---------------- input ---------------- */

let saveWarned = false;
function save() {
  for (const [k, b] of Object.entries(BOATS)) state.boats[k] = { x: b.pos.x, z: b.pos.z, heading: b.heading, anchored: b.anchored };
  state.vessel = boat.kind;
  state.mode = onFoot ? 'foot' : 'boat';
  state.walker = onFoot ? { x: walker.pos.x, z: walker.pos.z, heading: walker.heading } : null;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  state.sky = { cloud: r3(weather.cloud), rain: r3(weather.rain), state: weather.state, timer: r3(weather.timer) };
  state.seen = explored.toString();
  const ok = saveGame(state);
  if (ok) cloud.queue(state, saveStatus.lastSaved);
  if (!ok && saveStatus.canSave && !saveWarned && started) {
    saveWarned = true;
    hud.toast('Your progress couldn’t be saved just now (the browser’s storage may be full). The game will keep trying.', 7);
  }
  if (modal === 'journal') renderSaveStatus();
}

/* ---------------- your progress: saving, copies, starting over ---------------- */

// After loading: a gentle word if something about the save needed attention.
const LOAD_NOTES = {
  nostorage: 'This browser isn’t letting the game save (a private window, perhaps). You can play, but progress won’t be kept.',
  backup: 'Your latest save couldn’t be read, so you’re back where the previous session began. The unreadable save has been kept aside, not deleted.',
  unreadable: 'Your saved game couldn’t be read, so a new one has begun. The old data has been kept aside, not deleted.',
  newer: 'This save was made by a newer version of Slow Tide. Reload the page to get the latest version; until then nothing will be saved, so your progress is safe.',
};

// Two tabs saving over each other would lose progress: the tab that didn't save last steps aside.
window.addEventListener('storage', (e) => {
  if (e.key !== SAVE_KEY || !saveStatus.canSave || e.newValue == null) return;
  stopSaving();
  hud.toast('Slow Tide was saved from another tab or window. This one has stopped saving so it can’t overwrite that progress. Reload to carry on here.', 10);
  if (modal === 'journal') renderSaveStatus();
});

function renderSaveStatus() {
  const el = $('save-status');
  if (!saveStatus.canSave) {
    el.textContent = saveStatus.otherTab ? 'Not saving here: the game was saved from another tab. Reload to carry on in this one.'
      : loaded.outcome === 'newer' ? 'Not saving: your save is from a newer version. Reload to update.'
        : 'This browser can’t keep your progress (storage is turned off or unavailable).';
    return;
  }
  const ago = saveStatus.lastSaved ? Math.round((Date.now() - saveStatus.lastSaved) / 1000) : null;
  const when = ago == null ? 'not yet' : ago < 10 ? 'just now' : ago < 90 ? `${ago} seconds ago` : `${Math.round(ago / 60)} minutes ago`;
  el.textContent = `Saved automatically in this browser (last saved ${when}): no account needed. ${state.log.length} catches in your log.`;
}

// The optional account box under "Your progress". Only shown when a backend is configured.
function renderCloud() {
  const box = $('cloud');
  box.hidden = !cloud.enabled;
  if (!cloud.enabled) return;
  const make = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const btn = (text, run, cls) => {
    const b = make('button', text, cls);
    b.type = 'button';
    b.addEventListener('click', run);
    return b;
  };
  const kids = [make('h4', 'Cloud save (optional)')];
  if (cloud.signedIn) {
    const when = cloud.lastSync ? Math.round((Date.now() - cloud.lastSync) / 60000) : null;
    const sync = !offline.online ? 'offline, so syncing is paused until the connection is back'
      : cloud.paused ? 'paused' : cloud.syncing ? 'syncing…' : cloud.pending ? 'changes waiting to sync' : when == null ? 'not synced yet this visit' : when < 1 ? 'synced just now' : `synced ${when} min ago`;
    kids.push(make('p', `Signed in as ${cloud.email || 'you'}: ${sync}. Your progress is also kept in this browser.`));
    kids.push(btn('Sync now', async () => {
      save();
      renderCloud();
      await cloud.flush(state, saveStatus.lastSaved);
      renderCloud();
    }));
    kids.push(btn('Sign out', async () => {
      if (cloud.pending) await cloud.flush(state, saveStatus.lastSaved);
      await cloud.signOut();
      renderCloud();
    }, 'quiet'));
  } else {
    kids.push(make('p', 'Sign in with your email to keep your progress safe and carry it to other devices. There’s no password: you get a sign-in link. Your progress here comes with you, and you can always keep playing as a guest.'));
    const form = make('form', null, 'j-cloud-form');
    const email = make('input');
    Object.assign(email, { type: 'email', id: 'cloud-email', placeholder: 'you@example.com', autocomplete: 'email', required: true });
    email.setAttribute('aria-label', 'Email address');
    const send = make('button', cloud.state === 'sent' ? 'Send another link' : 'Email me a sign-in link');
    send.type = 'submit';
    send.disabled = cloud.state === 'sending';
    form.append(email, send);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await cloud.sendLink(email.value);
    });
    kids.push(form);
  }
  if (cloud.message) kids.push(make('p', cloud.message, 'j-cloud-msg'));
  box.replaceChildren(...kids);
}
cloud.onChange = () => {
  if (modal === 'journal') {
    renderSaveStatus();
    // Don't wipe what someone is typing.
    if (document.activeElement?.id === 'cloud-email' && !cloud.signedIn) {
      const msg = $('cloud').querySelector('.j-cloud-msg') || $('cloud').appendChild(document.createElement('p'));
      msg.className = 'j-cloud-msg';
      msg.textContent = cloud.message;
    } else renderCloud();
  }
};
// A sign-in link opened in this same tab only changes the address's #fragment: start afresh
// so it is picked up (progress is saved first by the page-hide handlers).
addEventListener('hashchange', () => {
  if (Cloud.fromLink()) location.reload();
});
cloudReady.then(() => {
  if (modal === 'journal') renderCloud();
  // Signed in, but startup didn't wait for the cloud (it was slow): sync once it's ready.
  if (cloud.signedIn && !cloudStart && saveStatus.canSave) cloud.queue(state, saveStatus.lastSaved);
});

/* ---------------- offline play ---------------- */

function renderOffline() {
  const el = $('offline-status');
  const net = offline.online ? 'Online.' : 'Offline: everything keeps working and saving on this device.';
  const sync = cloud.signedIn && !offline.online ? ' Cloud sync is paused and will catch up when you’re back online.' : '';
  let store;
  if (!offline.supported) store = 'This browser can’t store the game for offline play.';
  else if (!offline.enabled) store = 'Offline play is switched off on this test server (add ?sw to the address to try it).';
  else if (offline.ready) store = 'Ready to play offline: the whole game is stored on this device.';
  else if (offline.error) store = offline.error;
  else store = offline.total ? `Getting ready to play offline (${offline.cached} of ${offline.total} files)…` : 'Getting ready to play offline…';
  el.textContent = `${net}${sync} ${store}`;
  $('update-now').hidden = !offline.updateReady;
  $('clock-net').hidden = offline.online;
  const t = $('title-offline');
  t.hidden = !offline.enabled || (!offline.ready && !offline.error);
  t.classList.toggle('ok', offline.ready);
  t.textContent = offline.ready ? 'Ready to play offline' : offline.error;
}

function updateNow() {
  save();
  if (!applyUpdate()) location.reload();
}

setupOffline((event) => {
  renderOffline();
  if (event === 'ready') hud.toast('Ready to play offline: the whole game is stored on this device, so it starts and plays even without a connection.', 7);
  if (event === 'update') {
    // On the title screen, take the new version straight away; mid-game, ask first.
    if (!started) updateNow();
    else hud.toast('A new version of Slow Tide is ready. Open the journal (J) and choose Update; your progress is kept.', 8);
  }
  if (event === 'offline') hud.toast(`You’re offline. Everything keeps working and saving on this device.${cloud.signedIn ? ' Cloud sync is paused until you’re back online.' : ''}`, 6);
  if (event === 'online') {
    if (cloud.signedIn && cloud.pending) hud.toast('Back online. Syncing your progress…', 4);
    cloud.reconnected(state, saveStatus.lastSaved);
  }
  if (modal === 'journal') renderCloud();
});
renderOffline();
$('update-now').addEventListener('click', updateNow);

// A small "are you sure?" with any buttons we need.
// A question with buttons; { input } adds a text box (its value goes to the button's run).
function ask(title, text, buttons, { input = null } = {}) {
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  const box = $('confirm-input');
  box.hidden = input == null;
  box.value = input ?? '';
  const acts = $('confirm-acts');
  acts.replaceChildren(...buttons.map((b) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `pk-btn ${b.cls || ''}`;
    el.textContent = b.text;
    el.addEventListener('click', () => {
      if (!b.keepOpen) $('confirm').hidden = true;
      b.run?.(box.value);
    });
    return el;
  }));
  box.onkeydown = (e) => { if (e.key === 'Enter') acts.lastChild?.click(); };
  $('confirm').hidden = false;
  if (input != null) {
    box.focus();
    box.select();
  } else acts.lastChild?.focus();
}

function downloadSave() {
  save();
  const blob = new Blob([exportText(state)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `slow-tide-day-${state.day}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function startNewGame() {
  const acct = cloud.signedIn ? ' This also starts over the game saved to your account.' : '';
  ask('Start a new game?', `Your journal, catches, places, gear and camp will be cleared, and you’ll begin again in Willow Bay. Your sound and graphics settings stay.${acct} If you might want this game back, download a copy first.`, [
    { text: 'Download a copy first', cls: 'quiet', keepOpen: true, run: downloadSave },
    { text: 'Keep playing', cls: 'quiet' },
    {
      text: 'Start a new game', cls: 'danger', run: () => {
        cloud.replaceNextSync();
        newGame({ quality: state.quality, volumes: state.volumes, music: state.music, difficulty: state.difficulty, settings: state.settings });
        location.reload();
      },
    },
  ]);
}

function loadSaveFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = parseSave(String(reader.result));
    } catch {
      ask('That file isn’t a Slow Tide save', 'Nothing has been changed. Choose a file downloaded with “Download a copy”.', [{ text: 'OK' }]);
      return;
    }
    if (parsed.newer) {
      ask('That save is from a newer version', 'Reload the page to get the latest version of Slow Tide, then load it again. Nothing has been changed.', [{ text: 'OK' }]);
      return;
    }
    const st = parsed.state;
    const n = Object.values(st.fish).reduce((a, f) => a + f.count, 0);
    const acct = cloud.signedIn ? ' It will replace the game saved to your account too.' : '';
    ask('Load this saved copy?', `It’s on day ${st.day}, with ${n} fish caught and ${Object.keys(st.places).length} places found. It replaces your current game (which is kept as a backup).${acct}`, [
      { text: 'Cancel', cls: 'quiet' },
      { text: 'Load it', run: () => { cloud.replaceNextSync(); importSave(st); location.reload(); } },
    ]);
  };
  reader.readAsText(file);
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
  const zone = zoneAt(player().pos.x, player().pos.z);
  const names = { lake: 'Reedmere', stream: 'Fernbeck', cove: 'Driftwood Cove' };
  setTimeout(() => hud.place(onFoot ? (names[zone] || 'The west shore') : 'Willow Bay', returning ? 'welcome back' : onFoot ? 'by the camp' : 'home waters'), 900);
  rig.settleUntil = t + 2.5;
  if (state.sonar) toggleFinder(true);
  if (cloudStart?.note) setTimeout(() => hud.toast(cloudStart.note, 8), 2600);
  else if (LOAD_NOTES[loaded.outcome]) setTimeout(() => hud.toast(LOAD_NOTES[loaded.outcome], 9), 2600);
  // A camp whose ground changed with an update: what happened to it (nothing in it is lost).
  campNotes.forEach((n, i) => setTimeout(() => hud.toast(n, 10), 12000 + i * 11000));
  // Coming back to a game from before your own camps and Willowhaven: a word about them.
  if (returning && state.log.length && !state.tips.coastIntro) {
    setTimeout(() => {
      if (state.tips.coastIntro) return;
      state.tips.coastIntro = true;
      hud.toast(`New on the coast: a camping kit in your backpack (${input.keyLabel('pack')}), to pitch wherever the ground allows, and Willowhaven, a little harbour on the north shore of the bay.`, 11);
      save();
    }, 9000 + campNotes.length * 11000);
  }
  save();
}

// The map: for now the journal's map page (a full map sheet comes with the bigger world).
const mapSheet = new MapSheet(state, explored, { data: heightTex.image.data, width: 896, height: 1120, rect: WATER_RECT }, {
  travel: (dest) => {
    closeMap();
    travel(dest);
  },
  travelInfo: () => travelInfo(),
  close: () => closeMap(),
  changed: () => save(),
  birds: () => {
    const abs = state.day * 24 + state.hour;
    return birdSightings.map((b) => ({ x: b.x, z: b.z, age: (abs - b.at) / 1.5 }));
  },
});

// Open the map on a spot (a mark, a photograph's place).
function openMapAt(x, z) {
  if (modal === 'journal') closeJournal();
  if (modal) return;
  const p = player();
  mapSheet.openAt({ player: { x: p.pos.x, z: p.pos.z, heading: p.heading }, onFoot, boats, boat }, x, z);
  modal = 'map';
  audio.page();
}

// The journal's Memories pages.
journal.memories = new Memories(state, {
  photos,
  adventures,
  photoHint: () => (touch.active
    ? 'Take a photograph from here or from your backpack (and from a catch card, a picture of your fish).'
    : `Press ${input.keyLabel('photo')} anywhere to take a photograph (and on a catch card to photograph your fish).`),
  takePhoto: () => {
    closeJournal();
    openPhoto();
  },
  showOnMap: (x, z) => openMapAt(x, z),
  removePhoto: (id) => {
    photos.remove(id);
    const i = state.photos.findIndex((q) => q.id === id);
    if (i >= 0) state.photos.splice(i, 1);
    if (state.wallPhoto === id) {
      state.wallPhoto = null;
      paintHavenBoard();
    }
    save();
  },
  renamePhoto: (id, title) => {
    const ph = state.photos.find((q) => q.id === id);
    if (ph) ph.title = String(title).replace(/[<>]/g, '').trim().slice(0, 60);
    save();
  },
  downloadPhoto: async (id) => {
    const r = await photos.get(id);
    const ph = state.photos.find((q) => q.id === id);
    if (r?.blob) download(r.blob, `slow-tide-${(ph?.title || `day-${ph?.day}`).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.jpg`);
    else hud.toast('That photograph was taken on another device: its picture isn’t in this browser.', 4);
  },
  downloadAlbum: async () => {
    const html = await albumPage(photos, state.photos, (q) => journal.memories.describe(q));
    download(new Blob([html], { type: 'text/html' }), `slow-tide-album-day-${state.day}.html`);
  },
  editPin: (pin) => {
    openMapAt(pin.x, pin.z);
    mapSheet.editPin(pin);
  },
  markHere: () => {
    closeJournal();
    openMap();
    mapSheet.addPin(player().pos.x, player().pos.z);
  },
  canPinWall: (ph) => adventures.status('wall') !== 'unknown' && !state.wallPhoto && ph.subjects.species.includes('cuttlefish'),
  pinWall: (id) => pinWall(id),
  readPage: (id) => readPage(id, true),
});
paintHavenBoard();

// On a catch card: a picture of the fish you're holding up. (From your own eyes for the moment
// of the picture, where the fish is held up to the camera; then back to the view you had.)
async function photographCatch() {
  const e = state.log[state.log.length - 1], sp = fishById[e?.sp];
  const was = rig.mode === 'eye';
  if (!was) {
    rig.setFirstPerson(true, t);
    await new Promise((r) => setTimeout(r, 900));
  }
  await takePhoto(sp ? { species: [sp.id] } : null, sp ? `${sp.name}, ${e.size} cm` : '');
  if (!was) rig.setFirstPerson(false, t);
}

function openMap(highlight = null) {
  if (modal) return;
  if (fishing.aiming) fishing.cancel();
  const p = player();
  mapSheet.open({ player: { x: p.pos.x, z: p.pos.z, heading: p.heading }, onFoot, boats, boat }, typeof highlight === 'string' ? highlight : null);
  modal = 'map';
  audio.page();
  teach('map', 'The map fills in as you explore. Camps you’ve found are listed beside it: you can head straight to any of them.', 6);
}
function closeMap() {
  mapSheet.close();
  if (modal === 'map') modal = null;
  audio.page();
}

// The field guide lives in the journal; it can rig a recommended setup (when you carry it), and
// send you to the map or the backpack.
journal.guide = new FieldGuide(state, {
  atBox: () => !!tackleBox(),
  showOnMap: (id) => {
    closeJournal();
    openMap(id);
  },
  openPack: (ref) => {
    closeJournal();
    openPack();
    packUI.goto({ rod: 'rods', item: { bait: 'baits', lure: 'lures', fly: 'flies', jig: 'flies' }[TACKLE[ref.id]?.type] }[ref.type] || 'rods', ref);
  },
  rig: (s) => rigSetup(s),
  packAndRig: (s) => packAndRig(s),
  miniMap: (cv, id, places) => mapSheet.miniMap(cv, id, places, player().pos),
  map: () => mapSheet,
  where: () => player().pos,
  startTrip: (place, s, sp) => {
    startTrip(state, { sp, place, setup: s });
    save();
    return `Trip set for the ${fishById[sp].name.toLowerCase()}: ${place.name}, ${Math.round(place.dist)} m ${place.dir}. Follow the marker.`;
  },
  endTrip: () => {
    const sp = state.trip?.sp;
    const sum = endTrip(state);
    save();
    return sum ? `Trip ended. ${summaryText(sp, sum)}` : '';
  },
});

// Rig a rod from the field guide (the parts must be carried).
function rigSetup(s) {
  const g = state.gear;
  g.rod = s.rod;
  g.line[s.rod] = s.line;
  g.term[s.rod] = s.term;
  g.rig[s.rod] = s.item;
  const msg = `${RODS[s.rod].name} rigged with ${TACKLE[s.item].on}`;
  applyGear(msg);
  return msg;
}

// At a tackle box: pack what a setup needs and rig it. If the backpack is full, the rod you
// aren't holding, or tackle none of your rods can use (or that isn't tied on), goes back in the
// box, and the message says what.
function packAndRig(s) {
  if (!tackleBox()) return 'You can only swap tackle at a tackle box: at a camp, or in a motorboat’s locker.';
  const g = state.gear, left = [];
  if (!g.pack.rods.includes(s.rod)) {
    if (g.pack.rods.length >= PACK.rods) {
      const out = g.pack.rods.find((r) => r !== g.rod) ?? g.pack.rods[0];
      g.pack.rods.splice(g.pack.rods.indexOf(out), 1);
      left.push(`the ${RODS[out].short.toLowerCase()}`);
    }
    g.pack.rods.push(s.rod);
  }
  if (!g.pack.items.includes(s.item)) {
    if (g.pack.items.length >= PACK.items) {
      const usable = (i) => g.pack.rods.some((r) => fits(RODS[r], TACKLE[i]));
      const tied = new Set(g.pack.rods.map((r) => g.rig[r]));
      const out = g.pack.items.find((i) => !usable(i)) ?? g.pack.items.find((i) => !tied.has(i)) ?? g.pack.items[0];
      g.pack.items.splice(g.pack.items.indexOf(out), 1);
      left.push(TACKLE[out].short.toLowerCase());
    }
    g.pack.items.push(s.item);
  }
  const msg = rigSetup(s);
  return left.length ? `Packed and rigged: ${msg.charAt(0).toLowerCase()}${msg.slice(1)}. Left in the tackle box: ${left.join(' and ')}.` : `Packed and rigged: ${msg.charAt(0).toLowerCase()}${msg.slice(1)}.`;
}

function openGuide(id) {
  if (modal) return;
  journal.openGuide({ boats, walker: onFoot ? walker : null, camp: world.camp.firePos }, id);
  modal = 'journal';
  audio.page();
}

function openJournal() {
  journal.open({ boats, walker: onFoot ? walker : null, camp: world.camp.firePos });
  renderSaveStatus();
  renderCloud();
  renderOffline();
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

input.on('press', (code, acts) => {
  const is = (a) => acts.includes(a);
  if (!started) {
    if (settingsUI.isOpen) {
      if (code === 'Escape' || is('settings')) closeSettings();
    } else if (is('settings')) openSettings();
    else if (!is('journal')) begin();
    return;
  }
  audio.start();
  if (modal === 'sleep' || modal === 'travel') return;
  if (!$('confirm').hidden) {
    if (code === 'Escape') $('confirm').hidden = true;
    return;
  }
  // A photograph waiting to be kept (over the catch card, or after photo mode).
  if (!$('photo-card').hidden) {
    if (code === 'Escape') discardPhoto();
    else if (code === 'Enter') keepPhoto();
    return;
  }
  // Choosing where to pitch: only its own keys (and Settings); nothing casts or steers a boat.
  if (placement.isOn && !modal) {
    if (code === 'Escape') placement.cancel();
    else if (is('cast')) placement.confirm();
    else if (is('tackle')) placement.turn(-Math.PI / 12);
    else if (is('interact')) placement.turn(Math.PI / 12);
    else if (is('settings')) openSettings();
    else if (is('pack') || is('map') || is('journal')) hud.flash('Pitch the camp or cancel (Esc) first.', t, 2);
    return;
  }
  // Menus first: while one is open, gameplay keys do nothing (except each menu's own keys).
  if (modal === 'settings') {
    if (code === 'Escape' || is('settings')) closeSettings();
    return;
  }
  if (modal === 'note') {
    if (is('cast') || code === 'Enter' || code === 'Escape' || is('interact')) closeNote();
    return;
  }
  if (modal === 'photo') {
    if (code === 'Escape') closePhoto();
    else if (is('cast') || is('photo')) takePhoto();
    return;
  }
  if (modal === 'photocard') {
    if (code === 'Escape') discardPhoto();
    else if (code === 'Enter') keepPhoto();
    return;
  }
  if (modal === 'board') {
    if (code === 'Escape' || is('interact')) closeBoard();
    return;
  }
  if (modal === 'map') {
    if (code === 'Escape' || is('map')) closeMap();
    return;
  }
  if (is('journal')) {
    if (modal === 'journal') closeJournal();
    else if (!modal) openJournal();
    return;
  }
  if (modal === 'journal') {
    if (code === 'Escape') closeJournal();
    return;
  }
  if (modal === 'camp') {
    if (code === 'Escape' || is('interact')) closeCamp();
    return;
  }
  if (modal === 'pack') {
    if (code === 'Escape' || is('pack')) closePack();
    else if (is('tackle')) nextTackle();
    else if (is('rod1')) pickRod(0);
    else if (is('rod2')) pickRod(1);
    return;
  }
  if (is('cast')) {
    fishing.onDown();
    return;
  }
  if (modal === 'catch') {
    if (is('keep')) fishing.keep();
    else if (is('photo') && $('photo-card').hidden) photographCatch();
    return;
  }
  if (modal) return;
  const act = interaction();
  if (is('interact') && act) act.run();
  else if (is('pack')) openPack();
  else if (is('tackle')) nextTackle();
  else if (is('rod1')) pickRod(0);
  else if (is('rod2')) pickRod(1);
  else if (is('feed')) looseFeed();
  else if (is('advice')) giveAdvice(true);
  else if (is('conditions')) {
    settings.weather.panel = !settings.weather.panel;
    hud.flash(settings.weather.panel ? 'Conditions panel shown' : 'Conditions panel hidden', t, 1.4);
    save();
  }
  else if (is('anchor')) toggleAnchor();
  else if (is('neutral') && !onFoot && boat.motor) {
    boat.lever = 0;
    hud.flash('Motor to neutral', t, 1.4);
  }
  else if (is('photo')) openPhoto();
  else if (is('view')) cycleView();
  else if (is('eye')) toggleFirstPerson();
  else if (is('reset')) resetView();
  else if (is('finder')) toggleFinder();
  else if (is('map')) openMap();
  else if (is('settings')) openSettings();
  else if (is('hide')) {
    hudOff = !hudOff;
    hud.hidden(hudOff);
  } else if (code === 'Escape') {
    if (!fishing.cancel() && rig.mode !== rig.third) resetView();
  }
});
input.on('release', (code, acts) => {
  if (acts.includes('cast')) fishing.onUp();
});
input.on('pointer', () => {
  if (!started) {
    if (!settingsUI.isOpen) begin();
  } else audio.start();
});
input.on('cancel', () => {
  if (started && !modal && placement.isOn) placement.cancel();
  else if (started && !modal) fishing.cancel();
});

$('start-btn').addEventListener('click', begin);
$('journal-btn').addEventListener('click', () => {
  if (modal === 'journal') closeJournal();
  else if (!modal) openJournal();
});
$('view-btn').addEventListener('click', () => { if (started && !modal) cycleView(); });
$('finder-btn').addEventListener('click', () => { if (started && !modal) toggleFinder(); });
$('pack-btn').addEventListener('click', () => {
  if (modal === 'pack') closePack();
  else if (started && !modal) openPack();
});
$('gear').addEventListener('click', () => { if (started && !modal) openPack(); });
$('cancel-btn').addEventListener('click', () => fishing.cancel());
$('j-close').addEventListener('click', closeJournal);
$('journal').addEventListener('click', (e) => { if (e.target === $('journal')) closeJournal(); });
$('catch-card').addEventListener('click', () => { if (modal === 'catch') fishing.onDown(); });
$('cc-release').addEventListener('click', (e) => {
  e.stopPropagation();
  if (modal === 'catch') fishing.onDown();
});
$('cc-keep').addEventListener('click', (e) => {
  e.stopPropagation();
  if (modal === 'catch') fishing.keep();
});
$('note-card').addEventListener('click', closeNote);
$('cc-photo').addEventListener('click', (e) => {
  e.stopPropagation();
  if (modal === 'catch' && $('photo-card').hidden) photographCatch();
});
$('prompt').addEventListener('click', () => {
  const act = interaction();
  if (act) act.run();
});
$('j-settings-open').addEventListener('click', () => openSettings());
$('map-btn').addEventListener('click', () => { if (started && !modal) openMap(); });
$('settings-btn').addEventListener('click', () => { if (!modal || modal === 'settings') openSettings(); });
$('title-difficulty').addEventListener('click', (e) => {
  e.stopPropagation();
  openSettings('controls');
});
$('title-settings').addEventListener('click', (e) => {
  e.stopPropagation();
  openSettings();
});
applyDifficulty();
applyControls();
fishing.drags = state.gear.drag;
$('save-download').addEventListener('click', downloadSave);
$('save-load').addEventListener('click', () => $('save-file').click());
$('save-file').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (f) loadSaveFile(f);
  e.target.value = '';
});
$('save-new').addEventListener('click', startNewGame);
$('title-quality').addEventListener('click', (e) => {
  e.stopPropagation();
  openSettings('graphics');
});
if (Object.keys(state.fish).length || state.places.jetty || state.places.cove || state.places.camp) $('start-btn').textContent = 'Continue';

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  fitCamera();
  finder.fit();
});

// Phones may freeze or discard a background tab: save, and stop the sound until it's back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.suspend();
    if (started) save();
    if (cloud.pending) cloud.flush(state, saveStatus.lastSaved);
  } else audio.resume();
});
addEventListener('pagehide', () => {
  if (started) save();
  if (cloud.pending) cloud.flush(state, saveStatus.lastSaved, true);
});
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
const ecoCtx = { env: {}, focus: { x: 0, z: 0 }, boat: { x: 0, z: 0, speed: 0 }, walker: null, lantern: null, lights: [] };
const ecoLights = [];
const walkerCtx = { x: 0, z: 0, speed: 0 };
const move = { x: 0, z: 0 };
let saveTimer = 10;
let last = performance.now();

// Back where you left off: on foot if that's where you were (and somewhere you can stand:
// otherwise you're back in your boat).
const W0 = state.walker;
if (state.mode === 'foot' && W0 && W0.x > WORLD.x0 && W0.x < WORLD.x1 && W0.z > WORLD.z0 && W0.z < WORLD.z1 && walkHeight(W0.x, W0.z) > -0.55) {
  const at = { x: W0.x, z: W0.z };
  solids.resolve(at, 0.45);
  walker.place(at.x, at.z, W0.heading);
  setFoot(true, true);
  rig.views.foot.yaw = walker.heading;
  rig.focus.set(walker.pos.x, walker.pos.y + 1.4, walker.pos.z);
}
applyGear();

function ecoTick(dt) {
  ecoCtx.env.hour = state.hour;
  ecoCtx.env.rain = weather.rain;
  ecoCtx.env.cloud = weather.cloud;
  ecoCtx.env.daylight = env.daylight;
  ecoCtx.env.night = env.night;
  ecoCtx.env.hatch = hatchLevel();
  const lanternLit = boat.hasLantern && boat.lanternLevel > 0.3;
  ecoCtx.env.lanternNear = lanternLit && Math.hypot(boat.pos.x - COVE.x, boat.pos.z - COVE.z) < COVE.r + 30;
  // After dark the old jetty's lamp and the lamp at Puffin Cove's camp draw squid too.
  ecoLights.length = 0;
  if (lanternLit) ecoLights.push({ x: boat.pos.x, z: boat.pos.z });
  if (env.lantern > 0.3) ecoLights.push({ x: world.lampPos.x, z: world.lampPos.z }, { x: GANNET_CAMP.x, z: GANNET_CAMP.z - 14 });
  ecoCtx.lights = ecoLights;
  ecoCtx.focus.x = rig.focus.x;
  ecoCtx.focus.z = rig.focus.z;
  ecoCtx.boat.x = boat.pos.x;
  ecoCtx.boat.z = boat.pos.z;
  // (A kayak slides along quietly; the fish hardly notice it.)
  ecoCtx.boat.speed = onFoot ? 0 : boat.speed * boat.noise;
  walkerCtx.x = walker.pos.x;
  walkerCtx.z = walker.pos.z;
  walkerCtx.speed = walker.speed;
  ecoCtx.walker = onFoot ? walkerCtx : null;
  ecoCtx.lantern = lanternLit ? ecoCtx.boat : null;
  eco.update(dt, ecoCtx);
}

function tick(now, manual = false) {
  const rawDt = Math.max(0, (now - last) / 1000);
  const dt = Math.min(rawDt, 0.05);
  last = now;
  t += dt;
  conditions.time = t;
  if (!manual) watchFrameRate(rawDt);

  const resting = started && (!modal || modal === 'camp') && input.resting;
  const speed = resting ? REST_SPEED : 1;
  hud.rest(resting);
  let hours = 0;
  if (started && !sleeping) {
    const nightRate = state.hour >= 21.5 || state.hour < 5 ? 2.2 : 1;
    hours = (dt * speed * nightRate) / HOUR_SECONDS;
    state.hour += hours;
    if (state.hour >= 24) {
      state.hour -= 24;
      state.day++;
    }
  }
  updateWeather(dt, speed);
  updateSleep(dt);
  updateTravel(dt);
  updateWaiting(dt);
  camp.update(dt, hours);
  walker.speedMul = camp.hunger === 'hungry' ? 0.82 : 1;
  fishing.steady = camp.wellFed ? 0.8 : 1;
  if (gearDirty && !fishing.busy) applyGear();

  // The movement keys row the boat or walk you along the shore; while aiming they swing
  // the cast and set the bait depth (or lure speed), and while the line is out up/down does that.
  let throttle = 0, steer = 0;
  move.x = 0;
  move.z = 0;
  if (started && !modal) {
    const ti = input.throttle, si = input.steer;
    if (fishing.aiming) {
      // In first person the keys turn your head (and the cast with it); otherwise they swing the cast.
      if (rig.mode === 'eye') rig.turn(si, dt, t);
      else fishing.aimBy(si, dt);
      fishing.depthBy(ti, dt);
    } else if (fishing.lineOut) {
      fishing.depthBy(ti, dt);
      if (!onFoot) steer = si;
    } else if (onFoot) {
      // Camera-relative: W walks away from the camera, A/D to the sides.
      const yaw = rig.yaw, fx_ = Math.sin(yaw), fz_ = Math.cos(yaw);
      move.x = fx_ * ti + fz_ * si;
      move.z = fz_ * ti - fx_ * si;
    } else if (boat.motor) {
      // The throttle lever stays where you leave it (on a touch screen the stick drives it
      // directly). Coming back through neutral it pauses there before going astern.
      if (touch.active && input.virtual.throttle !== 0) boat.lever = clamp(input.virtual.throttle, -0.4, 1);
      else if (touch.active) boat.lever = damp(boat.lever, 0, 2, dt);
      else if (ti) {
        const was = boat.lever;
        leverHold -= dt;
        if (leverHold <= 0) boat.lever = clamp(boat.lever + ti * 0.7 * dt, -0.4, 1);
        if (was > 0 && boat.lever <= 0 && ti < 0) { boat.lever = 0; leverHold = 0.45; }
        if (was < 0 && boat.lever >= 0 && ti > 0) { boat.lever = 0; leverHold = 0.45; }
      } else leverHold = 0;
      if (boat.anchored && boat.lever > 0.05) {
        boat.lever = 0;
        hud.flash('The anchor is down: raise it first (Z)', t, 2);
      }
      throttle = boat.lever;
      steer = si;
    } else {
      throttle = ti;
      steer = si;
    }
  }
  if (boat.motor && (onFoot || modal)) throttle = 0;
  if (throttle !== 0) {
    rowTime += dt;
    if (rowTime > 3 && !state.tips.rowed) {
      state.tips.rowed = true;
      save();
    }
  }
  watchStuck(dt, !!(move.x || move.z));
  if (onFoot && (move.x || move.z)) {
    walkTime += dt;
    if (walkTime > 3 && !state.tips.walked) {
      state.tips.walked = true;
      save();
    }
  }

  boat.update(dt, t, throttle, steer, env.lantern);
  for (const b of boats) if (b !== boat) b.update(dt, t, 0, 0, env.lantern);
  keepBoatsApart();
  // The motor: a putter at idle when you're aboard, rising with the throttle. Fish nearby
  // hear it, so slow down (or anchor) before you fish. (The bass boat's electric motor is
  // almost silent, and doesn't bother them.)
  const motorOn = !onFoot && boat.motor;
  const outboard = motorOn && !boat.trolling;
  audio.engine?.(motorOn ? (outboard ? Math.max(0.12, Math.abs(boat.lever) * (boat.tilted ? 0.5 : 1)) : 0.04) : 0);
  motorNoiseT -= dt;
  if (outboard && Math.abs(boat.lever) > 0.25 && motorNoiseT <= 0) {
    motorNoiseT = 0.5;
    eco.startle(boat.pos.x, -0.6, boat.pos.z, 5 + boat.speed * 1.4, 0.7);
  }
  // First person: you face where you look.
  if (rig.mode === 'eye' && onFoot && !(move.x || move.z)) walker.heading = dampAngle(walker.heading, rig.yaw, 10, dt);
  if (onFoot) walker.update(dt, t, move, { jog: input.jogging, locked: fishing.busy, obstacles: solids });
  fishing.update(dt, t, rig.yaw, started && !modal && !placement.isOn && input.action);

  ecoTick(dt);
  handleClues();
  fx.update(dt, t, boat);

  const drag = input.takeDrag();
  const wheel = input.takeWheel();
  // (While pitching a camp the wheel brings it nearer or pushes it further, instead of zooming.)
  if (started && !modal) rig.input(drag, placement.isOn ? 0 : wheel, t);
  // Photo mode: look about, and zoom the lens rather than the camera's distance.
  if (modal === 'photo') {
    rig.input(drag, 0, t);
    if (wheel) {
      camera.fov = clamp(camera.fov + wheel * 0.02, 18, 75);
      camera.updateProjectionMatrix();
    }
  }
  if (placement.isOn) placement.update(dt, { turning: modal ? 0 : (input.holding('interact') ? 1 : 0) - (input.holding('tackle') ? 1 : 0), wheel: modal ? 0 : wheel });
  // (A steady horizon: your eyes don't pitch and roll with the boat, and only drift gently up and
  // down with the swell; the quick bob of the chop is smoothed away.)
  const steadyCam = settings.controls.boatCam === 'steady' || settings.controls.reducedMotion;
  if (onFoot) walker.eyePoint(_eye);
  else boat.eyePoint(_eye, steadyCam);
  if (!onFoot && steadyCam) _eye.y = eyeY = Math.abs(eyeY - _eye.y) > 1 ? _eye.y : damp(eyeY, _eye.y, 0.3, dt);
  else eyeY = _eye.y;
  rig.update(dt, t, { boat, walker, started, fishing, baitFocus: fishing.watchPoint, eye: _eye, roll: onFoot || steadyCam ? 0 : boat.roll * 0.45 });
  updateFirstPerson(dt);
  const P = player().pos;
  // In first person the shadows gather in front of you, finer, where you're looking.
  const fpShadow = rig.eyeBlend > 0.5;
  env.setShadowSpan(fpShadow ? 30 : 55);
  if (fpShadow) {
    camera.getWorldDirection(_shadowAt).setY(0).normalize();
    _shadowAt.multiplyScalar(12).add(P);
  }
  env.update(dt, t, state.hour, weather.rain, fpShadow ? _shadowAt : P, camera, renderer, weather.cloud);
  const sub = underwater.updateMedium(t, camera, env, scene, water, weather.rain);
  audio.setUnderwater(sub);
  underwater.update(dt, t, camera, env, weather.rain);
  fishRenderer.update(dt, camera, env.night, sub > 0.5);
  updateWind(dt * Math.min(speed, 10));
  world.update(dt, t, env, { fireLevel: camp.fireLevel, hatchLevel: hatchLevel(), hour: state.hour, wind: 0.5 + Math.min(1, windAt(camera.position.x, camera.position.z).speed / FRESH) * 1.3, camera, fog: scene.fog.color });
  {
    const abs = state.day * 24 + state.hour;
    campView.update(dt, t, env, state.camps, player().pos, {
      wind: Math.min(1, windAt(player().pos.x, player().pos.z).speed / FRESH),
      still: settings.controls.reducedMotion,
      cooking: (c) => (c.cooking ? { fish: c.cooking, done: clamp((abs - c.cooking.start) / c.cooking.dur, 0, 1) } : c.store.meals[0] ? { fish: c.store.meals[0], done: 1 } : null),
    });
  }
  updateRain(dt);
  mist.update(t, state.hour, env, camera);
  surfaceUniforms.uWetTop.value = 0.22 + 0.05 * Math.sin(t * 0.35) + weather.rain * 0.12;
  causticUniforms.uCausticTime.value = t;
  causticUniforms.uCaustic.value = (quality.caustics ?? 1) * env.daylight * (1 - gloom() * 0.6);

  const wu = water.uniforms;
  wu.uTime.value = t;
  wu.uRain.value = gloom();
  wu.uRings.value = weather.rain * settings.weather.rainFx;
  wu.uNight.value = env.night;
  {
    const w = windAt(camera.position.x, camera.position.z);
    water.sync(w.x / FRESH, w.z / FRESH);
  }
  wu.uLightDir.value.copy(env.lightDir);
  wu.uSunColor.value.copy(env.sunColor).multiplyScalar(env.sunI * 0.32);
  wu.uAmbient.value.copy(env.skyCol).multiplyScalar(env.hemiI * 0.33);
  wu.uZenith.value.copy(env.zenith);
  wu.uHorizon.value.copy(env.horizon);
  boat.lanternWorld(_lp);
  wu.uLights.value[0].set(_lp.x, _lp.y, _lp.z, boat.hasLantern ? boat.lanternLevel : 0);
  wu.uLights.value[1].set(world.lampPos.x, world.lampPos.y, world.lampPos.z, env.lantern);
  water.follow(camera.position);

  // The boat's sonar reads under the hull; on foot it reads around your rig once it's in the water.
  if (onFoot) finder.update(dt, fishing.baitInWater ? { x: fishing.hook.x, z: fishing.hook.z, mode: 'rig', moving: fishing.reelSpeed } : { mode: 'none' }, eco.bait);
  else finder.update(dt, { x: boat.pos.x, z: boat.pos.z, mode: 'boat', moving: boat.speed }, eco.bait);

  const zone = zoneAt(P.x, P.z);
  zoneW.open = damp(zoneW.open, (zone === 'open' || zone === 'coast' || zone === 'deep') && !onFoot ? 1 : 0, 0.5, dt);
  zoneW.cove = damp(zoneW.cove, zone === 'cove' ? 1 : 0, 0.5, dt);
  const seaD = landSDF(P.x, P.z);
  const fireD = P.distanceTo(world.camp.firePos);
  // (Your own camp's stove, while something's in the pan.)
  let ownCookD = Infinity;
  for (const c of state.camps) if (c.cooking) ownCookD = Math.min(ownCookD, Math.hypot(P.x - c.x, P.z - c.z));
  const windHere = windAt(P.x, P.z);
  audio.update(dt, {
    wind: Math.min(1, windHere.speed / FRESH),
    gust: windHere.gust,
    sea: waveHeightHere(P.x, P.z) / 0.6,
    speed: onFoot ? 0 : boat.speed,
    rain: weather.rain,
    day: env.daylight,
    night: env.night,
    land: 1 - smoothstep(6, 70, seaD),
    open: zoneW.open,
    cove: zoneW.cove,
    gulls: Math.max(
      (1 - smoothstep(20, 90, Math.hypot(P.x - HAVEN.x, P.z - HAVEN.z))) * 0.7,
      1 - smoothstep(25, 110, Math.hypot(P.x - STACKS[0].x, P.z - STACKS[0].z)),
      1 - smoothstep(25, 120, Math.hypot(P.x - SKELLIG.x, P.z - SKELLIG.z)),
      1 - smoothstep(25, 100, Math.hypot(P.x - SKERRIES[0].x, P.z - SKERRIES[0].z)),
      ...world.flocks.map((f) => 1 - smoothstep(20, 160, Math.hypot(P.x - f.x, P.z - f.z))),
    ),
    water: onFoot ? Math.max(1 - smoothstep(3, 30, -seaD), 1 - smoothstep(3, 30, Math.min(mereSDF(P.x, P.z), riverSDF(P.x, P.z)))) : 1,
    stream: 1 - smoothstep(1.5, 24, streamSDF(P.x, P.z)),
    lake: Math.max(1 - smoothstep(2, 35, lakeSDF(P.x, P.z)), 1 - smoothstep(2, 45, mereSDF(P.x, P.z)), (1 - smoothstep(2, 30, riverSDF(P.x, P.z))) * 0.6),
    fire: camp.fireLevel * (1 - smoothstep(2, 18, fireD)),
    sizzle: Math.max(camp.cooking ? 1 - smoothstep(2, 12, fireD) : 0, 1 - smoothstep(2, 12, ownCookD)),
    stove: 1 - smoothstep(1.5, 9, ownCookD),
    harbour: 1 - smoothstep(15, 70, Math.hypot(P.x - HAVEN.x, P.z - HAVEN.z)),
    inlet: 1 - smoothstep(10, 60, Math.min(...CHANNEL.map((c) => Math.hypot(P.x - (c[0] + c[2]) / 2, P.z - (c[1] + c[3]) / 2)), Math.hypot(P.x - COVE.x, P.z - COVE.z))),
    head: 1 - smoothstep(15, 90, Math.hypot(P.x - DAYMARK.x, P.z - (DAYMARK.z + 20))),
    tent: state.camps.reduce((m, c) => Math.max(m, 1 - smoothstep(3, 18, Math.hypot(P.x - c.x, P.z - c.z))), 0),
  });

  if (started) {
    checkPlaces(dt);
    watchCamps();
    watchBirds(dt);
    // An open board keeps up with the hour: it's read off the water as it is now.
    if (modal === 'board' && $('board-sub').textContent !== `${formatClock(state.hour)} · day ${state.day}`) renderBoard();
    watchAdventures(dt);
    watchObservations(dt);
    moments();
    saveTimer -= dt;
    if (saveTimer <= 0) {
      saveTimer = 10;
      save();
    }
  }
  updateHud();
  updateConditionsPanel(dt);

  // Wading through the shallows sends rings out around your boots.
  if (onFoot && walker.wading > 0.05 && (move.x || move.z) && !fishing.busy) {
    wadeT -= dt;
    if (wadeT <= 0) {
      wadeT = walker.jogging ? 0.18 : 0.3;
      fx.ripple(walker.pos.x + rand(-0.15, 0.15), walker.pos.z + rand(-0.15, 0.15), 0.6 + walker.wading * 0.6, 1.4, 0.3 + walker.wading * 0.25);
    }
  }

  if (!manual) draw();
}

let wadeT = 0;
let leverHold = 0;
let motorNoiseT = 0;

// The boats bump gently instead of sailing through each other.
function keepBoatsApart() {
  for (let i = 0; i < boats.length; i++) {
    for (let j = i + 1; j < boats.length; j++) {
      const A = boats[i], B = boats[j], a = A.pos, b = B.pos;
      const gap = (A.hull.B + B.hull.B) * 1.35;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d >= gap || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d, push = (gap - d) / 2;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
      for (const [v, s] of [[A.vel, -1], [B.vel, 1]]) {
        const vn = (v.x * nx + v.z * nz) * s;
        if (vn < 0) { v.x -= nx * vn * s; v.z -= nz * vn * s; }
      }
    }
  }
}
const _rf = new THREE.Vector3();
// Everything that has to happen to put a frame on screen: the ripple field (centred
// between you and your line, or a little ahead of you), the reflection, then the view.
function draw() {
  const P = player().pos;
  if (fishing.baitInWater) {
    _rf.set((P.x + fishing.hook.x) / 2, 0, (P.z + fishing.hook.z) / 2);
  } else {
    camera.getWorldDirection(_rf);
    _rf.set(P.x + _rf.x * 14, 0, P.z + _rf.z * 14);
  }
  ripples.render(renderer, _rf.x, _rf.z);
  reflection.render(renderer, scene, camera);
  const wu = water.uniforms;
  wu.uReflOn.value = reflection.active ? 1 : 0;
  wu.uRefl.value = reflection.target.texture;
  wu.uReflMatrix.value.copy(reflection.matrix);
  wu.uReflTexel.value.set(1 / reflection.target.width, 1 / reflection.target.height);
  wu.uRippleOn.value = ripples.on ? 1 : 0;
  wu.uRipple.value = ripples.target?.texture || null;
  wu.uRippleRect.value.copy(ripples.rect);
  renderer.render(scene, camera);
}

function frame(now) {
  if (!window.slowTide?.paused) tick(now);
  else last = now;
  requestAnimationFrame(frame);
}

$('loading')?.remove();
requestAnimationFrame((now) => {
  last = now;
  frame(now);
});

// A small handle for tinkering from the browser console, e.g. slowTide.setHour(19).
window.slowTide = {
  state, walker, fishing, env, weather, renderer, scene, camera, quality, eco, habitat, rig, finder, underwater, camp, world,
  get boat() { return boat; }, // the boat you're in (or last used)
  reflection, ripples, mist, fx, rodView, audio, settingsUI, input, packUI,
  firstPerson: (on = true) => rig.setFirstPerson(on, t),
  setHour: (h) => { state.hour = ((h % 24) + 24) % 24; },
  setRain: (r) => { weather.override = r; weather.rain = r; },
  setWeather: (id) => { settings.weather.mode = id; if (id !== 'auto') weather.state = id; },
  // Graphics preset: 'auto', 'high', 'medium' or 'low'.
  setGraphics: (preset) => { settings.graphics.preset = preset; applyQuality(); },
  teleport: (x, z, heading = boat.heading) => boat.place(x, z, heading),
  // Put yourself ashore at (x, z), e.g. slowTide.walkTo(-99, -2) for camp.
  walkTo: (x, z, heading = walker.heading) => {
    walker.place(x, z, heading);
    if (!onFoot) setFoot(true);
  },
  board: () => board(),
  rowboat, skiff, boats: BOATS, wind,
  // Set the breeze: strength 0–1, blowing towards dir (radians, like a heading).
  // A steady wind for testing: strength 0 … 1 (1 = a fresh breeze, 12 m/s), blowing towards dir
  // (as atan2(x, z) of its vector). setWind(null) gives it back to the weather and Settings.
  setWind: (strength, dir = wind.dir) => {
    if (strength == null) {
      settings.weather.windMode = 'auto';
      return;
    }
    const to = (Math.atan2(Math.sin(dir), -Math.cos(dir)) + Math.PI * 2) % (Math.PI * 2);
    Object.assign(settings.weather, { windMode: 'manual', windSpeed: strength * FRESH, windFrom: ((to + Math.PI) % (Math.PI * 2)) * 180 / Math.PI });
    conditions.wind.speed = conditions.wind.target = strength * FRESH;
    conditions.wind.from = (to + Math.PI) % (Math.PI * 2);
  },
  conditions, windAt, currentAt,
  // Put the boat you're not in at (x, z), e.g. alongside for testing.
  placeOther: (x, z, heading = 0, kind = boat === skiff ? 'row' : 'skiff') => BOATS[kind].place(x, z, heading),
  // Climb into the skiff (or another boat: 'row', 'kayak', 'bass') at (x, z).
  useSkiffAt: (x, z, heading = 0, kind = 'skiff') => {
    const b = BOATS[kind];
    b.place(x, z, heading);
    b.setAnchor(false);
    board(b);
  },
  // How loading went and whether the game is saving, e.g. { outcome: 'loaded', canSave: true, … }.
  saveInfo: () => ({ outcome: loaded.outcome, ...saveStatus }),
  get modal() { return modal; },
  // Hand yourself a rod and tackle, e.g. slowTide.gear('fly', 'nymph').
  gear: (rod, item) => {
    const g = state.gear;
    if (rod && !g.pack.rods.includes(rod)) g.pack.rods[Math.min(g.pack.rods.length, PACK.rods - 1)] = rod;
    if (rod) g.rod = rod;
    if (item) {
      if (!g.pack.items.includes(item)) g.pack.items[Math.min(g.pack.items.length, PACK.items - 1)] = item;
      g.rig[g.rod] = item;
    }
    applyGear();
  },
  // Freeze the game and look from one point at another (for screenshots and tinkering).
  look: (x, y, z, tx, ty, tz) => {
    window.slowTide.paused = true;
    camera.position.set(x, y, z);
    camera.lookAt(tx, ty, tz);
    const sub = underwater.updateMedium(t, camera, env, scene, water, weather.rain);
    fishRenderer.update(0, camera, env.night, sub > 0.5); // the fish near this view, in full detail
    reflection.active = false; // a fresh reflection for the new view
    draw();
  },
  // Step the game by hand (handy for testing while the tab is in the background).
  advance: (seconds, fps = 30, render = true) => {
    let now = last;
    for (let i = 0; i < seconds * fps; i++) tick((now += 1000 / fps), true);
    if (!render) return;
    reflection.active = false;
    draw();
  },
  reset: () => {
    newGame(); // also stops the save-on-leave handlers from writing the old progress back
    location.reload();
  },
};
