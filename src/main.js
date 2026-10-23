import * as THREE from 'three';
import { Input } from './input.js';
import { loadGame, saveGame, newGame, saveStatus, parseSave, importSave, exportText, stopSaving, SAVE_KEY, adoptJournal } from './save.js';
import { Cloud } from './cloud.js';
import { setupOffline, offline, applyUpdate } from './offline.js';
import { DIFFICULTY, DIFFICULTY_IDS, DRAG_LEVELS, DRAG_NAMES, breakReason } from './fight.js';
import { HUD, kbd } from './ui.js';
import { AudioScape } from './audio.js';
import { Environment, phaseName, formatClock } from './world/sky.js';
import { createWater, sea } from './world/water.js';
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
  bakeHeightTexture, walkHeight, solidHeight, landSDF, lakeSDF, streamSDF, zoneAt,
  PLACES, START, WATER_RECT, SHORE_RECT, STACKS, COVE, LANDING,
  PEGS, POOLS, STREAM, SNAG, LILIES, JETTY, ISLAND,
} from './world/terrain.js';
import { Boat } from './boat.js';
import { Walker } from './walker.js';
import { Effects } from './effects.js';
import { Fishing } from './fishing.js';
import { drawFishSketch, drawLanternSketch, fishById } from './fish.js';
import { RODS, TACKLE, ROD_IDS, PACK, cleanGear, currentRig, fits } from './tackle.js';
import { PackUI } from './pack.js';
import { Camp, WAKE_TIMES } from './camp.js';
import { Journal } from './journal.js';
import { CameraRig } from './camera.js';
import { FishFinder } from './sonar.js';
import { setupTouch } from './touch.js';
import { PRESETS, CHOICES, FrameWatch, lowerLevel, startingLevel } from './quality.js';
import { clamp, damp, smoothstep, rand, pick } from './util.js';

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
const water = createWater(bakeHeightTexture(512, WATER_RECT), WATER_RECT, bakeHeightTexture(256, SHORE_RECT), SHORE_RECT);
scene.add(water.mesh);
const mist = createMist(water.uniforms.uHeight.value, WATER_RECT, water.uniforms.uHeight2.value, SHORE_RECT);
scene.add(mist.group);
const world = buildWorld(scene, renderer, habitat);
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
for (const o of [underwater.grass, underwater.kelp, underwater.rocks, underwater.particles, underwater.bubblesPts, ...underwater.rays]) hideFromReflection(o);
for (const set of fishRenderer.sets) hideFromReflection(set.mesh);
// Two boats: the rowing boat you start with, and the motor skiff tied up at the landing.
// `boat` is whichever you're in (or last used); the other floats where you left it.
const rowboat = new Boat(scene);
const skiff = new Boat(scene, { motor: true });
let boat = rowboat;
const otherBoat = () => (boat === skiff ? rowboat : skiff);
const walker = new Walker(scene);
const journal = new Journal(state);
const input = new Input(canvas);
const touch = setupTouch(input);
const rig = new CameraRig(camera);
const finder = new FishFinder(eco, habitat, state);

// The skiff's mooring: alongside the end of the landing pier, in water deep enough for the motor.
function skiffMooring() {
  const L = LANDING;
  for (const dz of [2.4, -2.4, 3.2, -3.2]) {
    for (let x = L.x + L.len - 1.2; x > L.x; x -= 0.6) {
      if (solidHeight(x, L.z + dz) < -1.1 && solidHeight(x + 2, L.z + dz) < -1.1 && solidHeight(x - 2, L.z + dz) < -0.9) return { x, z: L.z + dz, heading: Math.PI / 2 };
    }
  }
  return { x: L.x + L.len + 4, z: L.z, heading: Math.PI / 2 };
}
if (state.boat && solidHeight(state.boat.x, state.boat.z) < -1) rowboat.place(state.boat.x, state.boat.z, state.boat.heading);
else rowboat.place(START.x, START.z, START.heading);
const mooring = skiffMooring();
if (state.skiff && solidHeight(state.skiff.x, state.skiff.z) < -0.8) skiff.place(state.skiff.x, state.skiff.z, state.skiff.heading);
else skiff.place(mooring.x, mooring.z, mooring.heading);
if (state.boat?.anchored) rowboat.setAnchor(true);
if (state.skiff?.anchored) skiff.setAnchor(true);
if (state.vessel === 'skiff') boat = skiff;
otherBoat().setRower(false);
if (state.items.lantern) {
  rowboat.setLantern(true);
  skiff.setLantern(true);
  world.takeLantern();
}
rig.init(boat);

const weather = { rain: 0, target: 0, timer: state.tips.rained ? rand(120, 220) : 240 };
// The breeze: dir is the way it blows towards. It wanders slowly and freshens in the rain.
const wind = { dir: rand(0, Math.PI * 2), strength: 0.25, target: 0.25, timer: 60 };
const WIND_WORDS = ['still air', 'a light breeze', 'a breeze', 'a fresh wind'];
function updateWind(dt) {
  wind.timer -= dt;
  if (wind.timer <= 0) {
    wind.timer = rand(60, 150);
    wind.target = clamp(rand(0.05, 0.55) + weather.rain * 0.35, 0, 1);
    wind.turn = rand(-0.8, 0.8);
  }
  wind.strength = damp(wind.strength, wind.target, 0.08, dt);
  wind.dir += (wind.turn || 0) * dt * 0.004;
  fishing.wind.x = Math.sin(wind.dir) * wind.strength;
  fishing.wind.z = Math.cos(wind.dir) * wind.strength;
  fishing.wind.strength = wind.strength;
}
// An arrow showing which way the wind blows, as seen from the camera.
function windArrow() {
  let rel = wind.dir - rig.yaw;
  rel = ((rel % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  const i = ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
  return ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗'][i];
}
function windHint() {
  if (wind.strength < 0.15) return '';
  const w = WIND_WORDS[wind.strength < 0.3 ? 1 : wind.strength < 0.55 ? 2 : 3];
  return ` · ${w} blowing ${windArrow()}`;
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
  key: (k) => kbd(k),
  teach,
  shake: (s) => { rig.shake = Math.max(rig.shake, s); },
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
  quiet: (kind, item) => hud.flash(advice(kind, item), t, 7),
});

// A gentle nudge when nothing has come for a while, based on where you are and what's tied on.
function advice(kind, item) {
  const zone = zoneAt(fishing.hook.x, fishing.hook.z);
  const F = touch.active ? 'the fish finder' : `the fish finder (${kbd('F')})`;
  if (zone === 'stream') {
    if (kind !== 'fly') return 'Stream trout are shy of heavy line and splashy lures. The fly rod is the one for them.';
    if (item.fly === 'dry' && hatchLevel() < 0.5) return 'Few flies are hatching just now. A nymph drifted through a pool works at any hour.';
    return 'Trout hold in the pools facing upstream. Cast above them and let the fly drift down without dragging.';
  }
  if (zone === 'lake') {
    if (kind === 'lure') return 'Lake predators wait by the weed, the lily pads and the fallen alder. Try twitches and pauses, or a lure that runs at their depth.';
    if (kind === 'ledger') return `Carp take patience. Throw in some loose bait (${kbd('G')}), and wait: evenings are best.`;
    if (kind === 'fly') return 'Rudd sip flies by the lily pads; perch chase a stripped streamer. Trout live up the stream.';
    return 'Rudd feed near the top by the lily pads; carp graze the bottom on the shallow south-west shelf. Set your depth to suit.';
  }
  if (kind === 'fly') return 'Sea fish aren’t interested in flies. Try the float rod or a lure out here.';
  if (kind === 'ledger') return 'Out at sea, a bottom bait suits the deep rocks where the big old mossback lives.';
  return `Nothing’s biting here yet. Fish gather by weeds and rocks; ${F} shows what’s below.`;
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
    water: sp.water === 'fresh' ? 'fresh' : 'salt',
    kind: rigUsed?.rod?.kind || 'float',
    rod: rigUsed?.rod?.id || 'float',
    item: rigUsed?.item?.id || null,
    from: onFoot ? 'shore' : 'boat',
    rain: weather.rain > 0.6 ? 2 : weather.rain > 0.15 ? 1 : 0,
    hatch: Math.round(hatchLevel() * 10) / 10,
    depth: Math.round(Math.max(0, -at.y) * 10) / 10,
    bottom: Math.round(Math.max(0, -solidHeight(at.x, at.z)) * 10) / 10,
    outcome: 'released',
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
  $('cc-rig').textContent = rigUsed?.item ? `Caught on ${rigUsed.item.on}, with the ${rigUsed.rod.short.toLowerCase()}` : '';
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
  fishing.setRig(rod, item);
  boat.setRod(rod.id);
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
});

function openPack(atCamp = nearCamp()) {
  if (modal) return;
  if (fishing.aiming) fishing.cancel();
  packUI.open(atCamp);
  modal = 'pack';
  audio.page();
  teach('pack', 'Rods decide how you fish; what you tie on decides which fish come.', 6);
}

function closePack() {
  packUI.close();
  if (modal === 'pack') modal = null;
  audio.page();
}

/* ---------------- camp ---------------- */

const camp = new Camp(state, scene, world.camp, {
  toast: (text, secs) => hud.toast(text, secs),
  audio,
  close: () => closeCamp(),
  openTackle: () => {
    closeCamp();
    openPack(true);
  },
  changed: () => save(),
  outcome: (logId, what) => setOutcome(logId, what),
  sleep: (h) => sleepUntil(h),
});

function nearCamp() {
  return onFoot && walker.pos.distanceTo(world.camp.firePos) < 7.5;
}

function openCamp(tab) {
  if (modal) return;
  camp.open(tab);
  modal = 'camp';
  audio.page();
}

function closeCamp() {
  camp.close();
  if (modal === 'camp') modal = null;
}

let sleeping = null;
function sleepUntil(h) {
  if (fishing.busy || sleeping) return;
  closeCamp();
  modal = 'sleep';
  const w = WAKE_TIMES.find((x) => x.h === h);
  hud.sleep(true, `You sleep until ${w ? w.name.toLowerCase() : formatClock(h)}…`);
  audio.rustle?.();
  sleeping = { h, phase: 0, t: 0 };
}

// Halfway through the fade: move the world on.
function passTheNight() {
  const h = sleeping.h;
  let hours = h - state.hour;
  if (hours <= 0.5) hours += 24;
  if (state.hour + hours >= 24) state.day++;
  state.hour = h;
  camp.update(0, hours, true);
  // The weather turns while you sleep: sometimes you wake to rain.
  const rain = Math.random() < 0.3;
  weather.target = rain ? rand(0.6, 1) : 0;
  weather.rain = weather.target * 0.85;
  weather.timer = rain ? rand(80, 140) : rand(170, 280);
  sea.amp = 1 + weather.rain * 0.45;
  eco.feedSpots = [];
  ecoTick(0.016);
  eco.settle();
  for (let i = 0; i < 90; i++) eco.update(1 / 30, ecoCtx);
  sleeping.rain = rain;
  save();
}

function wakeLine(h, rain) {
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
    hud.toast(wakeLine(sleeping.h, sleeping.rain), 6);
    audio.chime();
    sleeping = null;
  }
}

/* ---------------- on foot and back in the boat ---------------- */

// Somewhere to step ashore near the boat: the landing pier first, else any reachable bank.
function shoreSpot() {
  const b = boat.pos;
  const L = LANDING;
  if (b.x > L.x - 3 && b.x < L.x + L.len + 3 && Math.abs(b.z - L.z) < 5.5) {
    const x = clamp(b.x, L.x - 1.8, L.x + L.len - 0.6);
    return { x, z: L.z, heading: -Math.PI / 2, pier: true };
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
  for (const b of [rowboat, skiff]) {
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

function stepAcross() {
  switchBoat(otherBoat());
  audio.knock(0.5);
  hud.chip(`<b>${boat === skiff ? 'Motor skiff' : 'Rowing boat'}</b>`, 2);
  if (boat === skiff) teachSkiff();
  save();
}

function teachSkiff() {
  if (state.tips.skiff) return;
  state.tips.skiff = true;
  hud.toast(touch.active
    ? 'The motor skiff: push the stick forward for throttle, left and right to steer. Let go to slow down. Tap the prompt when stopped to drop anchor, or near a shore to step off.'
    : 'The motor skiff: W and S move the throttle lever (it stays where you leave it), A and D steer, X stops the motor, Z drops or raises the anchor. Near a shore, slow down and press E to step off.', 10);
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
    : `<b>On foot</b> · ${kbd(input.label('KeyW'))}${kbd(input.label('KeyA'))}${kbd(input.label('KeyS'))}${kbd(input.label('KeyD'))} walk · ${kbd('Shift')} jog · ${kbd('E')} by the boat to get back in`, 6);
  if (!state.tips.ashore) {
    state.tips.ashore = true;
    hud.toast(spot.pier ? 'You step onto the landing. Camp is just up the path, with the lake beyond it and the stream further on.' : 'You step ashore. The boat waits where you left it: follow the marker to find it again.', 7);
  }
}

function board(target = boatNear() || boat) {
  switchBoat(target);
  setFoot(false);
  if (boat === skiff) teachSkiff();
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
      if (world.obstacles.resolve(p, 0.45)) continue;
      return { x, z, heading: Math.atan2(c.x - x, c.z - z) };
    }
  }
  return { x: c.x + 3, z: c.z, heading: -Math.PI / 2 };
}

const nearCampSpot = () => Math.hypot(player().pos.x - world.camp.firePos.x, player().pos.z - world.camp.firePos.z) < 8;

function travelInfo() {
  const busy = fishing.state === 'reeling' || fishing.state === 'landing' || fishing.state === 'caught' || fishing.state === 'keeping';
  if (busy) return { camp: false, boat: false, note: 'Land or let go of the fish first.' };
  if (sleeping || traveling) return { camp: false, boat: false, note: '' };
  const camp = !(onFoot && nearCampSpot());
  const boat = onFoot;
  const note = !onFoot ? 'You’re in the boat. It stays where you leave it.' : !camp ? 'You’re at camp.' : stuckT > 2.5 ? 'Stuck? Either one gets you out.' : '';
  return { camp, boat, note };
}

// The walk (or row) back happens off-screen: a short fade, a little time passes, and
// you arrive somewhere safe. Catches, gear and the creel all come with you.
let traveling = null;
function travel(dest) {
  const info = travelInfo();
  if (!info[dest]) return;
  if (fishing.lineOut) fishing.cancel();
  if (modal === 'pack') closePack();
  else if (modal === 'camp') closeCamp();
  if (modal) return;
  modal = 'travel';
  hud.sleep(true, dest === 'camp' ? 'You head back to camp…' : 'You make your way back to the boat…');
  traveling = { dest, t: 0, done: false };
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
    if (traveling.dest === 'camp') {
      const spot = campSpot();
      walker.place(spot.x, spot.z, spot.heading);
      if (!onFoot) setFoot(true, true);
      rig.reset(walker, t);
    } else {
      board();
      rig.reset(boat, t);
    }
    // About as long as the walk would take, but never more than half an hour.
    passTime(clamp(from.distanceTo(player().pos) / 400, 0.05, 0.5));
    stuckT = 0;
    save();
  }
  if (traveling.t > 1.9) {
    hud.sleep(false);
    modal = null;
    hud.toast(traveling.dest === 'camp' ? 'Back at camp. The boat is where you left it.' : 'Back in the boat.', 3.5);
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
  if (!started || modal || fishing.busy) return null;
  if (lanternReach()) return { text: 'Look closer at the driftwood', run: takeLantern };
  if (onFoot) {
    const near = boatNear();
    if (near) return { text: `Get in the ${near.name}`, run: () => board(near) };
    if (nearCamp()) return { text: 'Camp: fire, food, sleep and tackle box', run: () => openCamp() };
    if (stuckT > 2.5) return { text: 'Stuck? Head back to camp or the boat', run: () => openPack() };
    return null;
  }
  const spot = cachedShoreSpot();
  if (spot) return { text: spot.pier ? 'Step ashore at the landing' : 'Step ashore', run: () => stepAshore(spot) };
  const other = otherBoat();
  if (boat.speed < 1 && other.speed < 1 && Math.hypot(other.pos.x - boat.pos.x, other.pos.z - boat.pos.z) < 4.5) {
    return { text: `Step across into the ${other.name}`, run: stepAcross };
  }
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
  const p = player().pos;
  for (const pl of PLACES) {
    if (state.places[pl.id] || !pl.test(p.x, p.z)) continue;
    state.places[pl.id] = { day: state.day, hour: state.hour };
    hud.place(pl.name, pl.sub);
    audio.chime();
    hud.toast(`${pl.name} is in your journal now`);
    hud.pulseJournal();
    if (pl.id === 'landing' && !onFoot) teach('landingTip', `Tie up here: ${touch.active ? 'tap the prompt' : 'press E'} to step ashore. Camp is just up the path.`, 6);
    if (pl.id === 'camp') teach('campTip', 'Camp: grill and eat what you catch, swap rods and tackle from the tackle box, and sleep until morning.', 7);
    if (pl.id === 'stream') teach('streamTip', 'Fernbeck’s trout hold in the pools. They’re shy: walk softly, and bring the fly rod from camp.', 7);
    if (pl.id === 'lake') teach('lakeTip', 'Reedmere: perch and pike take lures, carp graze the bottom, rudd sip near the lily pads.', 7);
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
rowboat.onBump = skiff.onBump = (v) => audio.knock(clamp(v / 3, 0.4, 1));
skiff.onShallow = () => hud.flash('Shallow water: the motor tips up, so you can only creep along. Steer for deeper water.', t, 3.4);
walker.onStep = (p, jog) => audio.step(jog);
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
rainLines.frustumCulled = false;
scene.add(rainLines);

function updateRain(dt) {
  rainLines.visible = weather.rain > 0.02 && underwater.submerge < 0.5;
  if (!rainLines.visible) return;
  rainMat.opacity = 0.42 * weather.rain;
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
  water.setDetail(q.waterDetail);
  reflection.setQuality(q.reflection, q.reflectEvery);
  mist.setLayers(q.mist);
  surfaceUniforms.uDetail.value = q.surfaceDetail;
  ripples.setQuality(q.ripples, q.rippleSpan, renderer);
  water.uniforms.uRippleTexel.value = 1 / Math.max(1, ripples.size);
  rainGeo.setDrawRange(0, q.rain * 2);
  world.setPixelRatio(pr);
  world.setQuality(q);
  eco.setDensity(q.fishDensity);
  eco.simRadius = q.simRadius;
  underwater.setQuality(q);
  underwater.setPixelRatio(pr);
  quality.caustics = q.caustics;
  const text = quality.choice === 'auto' ? `Graphics: Auto (${q.label})` : `Graphics: ${q.label}`;
  $('set-quality').textContent = text;
  $('title-quality').textContent = text;
}

function applyDifficulty() {
  const d = DIFFICULTY[state.difficulty] || DIFFICULTY.standard;
  fishing.diff = d;
  eco.biteScale = d.bite;
  $('set-difficulty').textContent = `Difficulty: ${d.label}`;
  $('title-difficulty').textContent = `Difficulty: ${d.label}`;
  $('difficulty-desc').textContent = d.desc;
}

// Relaxed → Standard → Realistic. Only changes how fish behave from now on; nothing is lost.
function cycleDifficulty() {
  if (fishing.fight) {
    hud.flash('Land this fish first, then change the difficulty', t, 2.4);
    return;
  }
  state.difficulty = DIFFICULTY_IDS[(DIFFICULTY_IDS.indexOf(state.difficulty) + 1) % DIFFICULTY_IDS.length];
  applyDifficulty();
  save();
  hud.flash(`Difficulty: ${DIFFICULTY[state.difficulty].label}`, t, 2.4);
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
  const back = onFoot ? 'back over your shoulder' : 'back to the boat';
  if (rig.mode === 'under') {
    hud.chip(T
      ? '<b>Underwater</b> · drag to look around · pinch to zoom · the view button switches back'
      : `<b>Underwater</b> · drag to look around · scroll to zoom · ${kbd('C')} next view · ${kbd('R')} ${back}`, 6);
  } else if (rig.mode === 'bait') {
    hud.chip(T
      ? '<b>Watching your bait</b> · drag to look around · the view button switches back'
      : `<b>Watching your bait</b> · drag to look around · ${kbd('C')} next view · ${kbd('R')} ${back}`, 6);
  } else if (rig.mode === 'foot') {
    hud.chip(fishing.baitInWater || T ? '<b>On foot</b>' : `<b>On foot</b> · cast first, then ${kbd('C')} watches your bait underwater`, 3);
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
  bite: 'Bite!',
  strike: 'Thump! It hit the lure!',
  run: 'A run! The alarm is screaming!',
  sip: 'It sipped the fly!',
  take: 'The indicator darted under!',
  hooked: 'Hooked!',
};

function currentHint() {
  if (!started || modal) return '';
  const L = (c) => kbd(input.label(c));
  const T = touch.active;
  const space = kbd('Space');
  const info = fishing.info;
  switch (fishing.state) {
    case 'aiming': {
      // The power meter swings out and back; the ring shows where a clean release would land.
      const how = T ? 'Let go when the ring is where you want it' : `Release ${space} when the ring is where you want it`;
      const clean = fishing.release > 0.75 ? 'clean release now' : 'truest as the meter slows';
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
      if (fishing.kind === 'ledger') {
        if (!info.settled) return 'The rig is sinking to the bottom…';
        return T ? 'Rig on the bottom: wait for the alarm · hold to wind in' : `Rig on the bottom: wait for the alarm · ${kbd('G')} loose bait · ${kbd('T')} let time pass · hold ${space} to wind in`;
      }
      if (fishing.kind === 'fly') {
        if (info.drag) return 'The fly is dragging: strip in and cast again, upstream of the fish';
        if (fishing.item.fly === 'streamer') return T ? 'Hold to strip the streamer back in pulls · tap to twitch' : `Hold ${space} to strip it back in pulls · tap to twitch`;
        return T ? 'Let the fly drift with the current · hold to strip line in' : `Let the fly drift with the current · tap to twitch · hold ${space} to strip in`;
      }
      if (T) return `Stick up/down: bait depth · hold the button to reel in · tap to twitch${state.tips.under ? '' : ' · the view button looks underwater'}`;
      return `${L('KeyW')}${L('KeyS')} bait depth · hold ${space} to reel in · tap to twitch${state.tips.under ? '' : ` · ${kbd('C')} look underwater`}`;
    case 'bite': {
      const k = fishing.biteKind;
      const what = k === 'strike' ? 'It hit the lure!' : k === 'run' ? 'A run!' : k === 'sip' ? 'It took the fly!' : k === 'take' ? 'The indicator dipped!' : 'Bite!';
      return T ? `${what} Tap the button` : `${what} Press ${space}`;
    }
    case 'reeling': {
      const F = fishing.fight;
      const drag = `${T ? 'stick up/down' : `${L('KeyW')}${L('KeyS')}`} drag: ${DRAG_NAMES[F?.drag ?? 2]}`;
      if (F?.surgeT > 0) return T ? 'It’s surging! Let go of the button' : `It’s surging! Let go of ${space}`;
      if (F && !F.pulling && F.warned) return 'A flick on the surface: it’s about to run. Ease off';
      if (F?.pulling) return `${F.slipping ? 'It’s taking line against the drag.' : 'It’s pulling.'} ${T ? 'Hold' : `Hold ${space}`} to keep pressure on and tire it · ${drag}`;
      return `${T ? 'Hold the button' : `Hold ${space}`} to reel it in · ease off when it surges · ${drag}`;
    }
    case 'casting': case 'landing': case 'caught': case 'releasing': case 'keeping': case 'retrieving': return '';
    default:
  }
  if (onFoot) {
    if (!state.tips.walked) return T ? 'Drag on the left to walk · drag on the right to look around' : `${L('KeyW')}${L('KeyA')}${L('KeyS')}${L('KeyD')} to walk · ${kbd('Shift')} jog · drag to look around`;
    if (!state.places.camp && Math.hypot(walker.pos.x - world.camp.firePos.x, walker.pos.z - world.camp.firePos.z) < 60) return 'Follow the path up to camp';
    return '';
  }
  if (boat.motor) {
    const lv = boat.lever;
    const word = boat.anchored ? 'at anchor' : Math.abs(lv) < 0.03 ? 'neutral' : lv < 0 ? 'astern' : lv < 0.35 ? 'slow ahead' : lv < 0.75 ? 'half ahead' : 'full ahead';
    return T ? `Throttle: ${word} · the stick drives and steers` : `Throttle: ${word} · ${L('KeyW')}${L('KeyS')} lever · ${L('KeyA')}${L('KeyD')} steer · ${kbd('X')} stop · ${kbd('Z')} anchor`;
  }
  if (!state.tips.rowed) return T ? 'Drag on the left to row · drag on the right to look around' : `${L('KeyW')}${L('KeyA')}${L('KeyS')}${L('KeyD')} to row · drag to look around`;
  if (!state.tips.cast) return T ? 'Hold the button to aim and cast your line' : `Hold ${space} to aim and cast your line`;
  if (state.tips.caught && !state.tips.journal) return T ? 'Tap Journal to see what you’ve found' : `${kbd('J')} to open your journal`;
  if (state.tips.caught && !state.places.camp) return 'Your camp is on the west shore of the bay: row to the landing (follow the Camp marker)';
  if (state.tips.caught && !state.tips.under) return T ? 'The view button lets you look under the water' : `${kbd('C')} to look under the water`;
  if (state.tips.caught && !state.tips.sonar) return T ? 'The sonar button shows a fish finder' : `${kbd('F')} for the fish finder`;
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
  if (fishing.state === 'drifting' && fishing.kind === 'ledger') return 'Wind in';
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
  const onScreen = !behind && sx > m && sx < W - m && sy > m + 50 && sy < H - m - 40;
  let angle = 0;
  if (!onScreen) {
    angle = Math.atan2(sx - W / 2, -(sy - H / 2));
    sx = clamp(sx, m, W - m);
    sy = clamp(sy, m + 50, H - m - 40);
  }
  // Two markers pinned to the same spot on the edge: nudge the second one along.
  if (placed.length && placed.some((p) => Math.abs(p[0] - sx) < 110 && Math.abs(p[1] - sy) < 26)) sy += sy > H / 2 ? -30 : 30;
  placed.push([sx, sy]);
  hud.marker(el, sx, sy, onScreen, angle, dist, dist < 12);
}
const placed = [];

function updateHud() {
  const h = state.hour;
  const night = h >= 20.5 || h < 5.5;
  const w = weather.rain > 0.6 ? 'Rain' : weather.rain > 0.15 ? 'Light rain' : '';
  hud.clock(formatClock(h), phaseName(h), w, night);
  const hunger = camp.hunger;
  hud.food(camp.wellFed ? 'Well fed' : hunger === 'hungry' ? 'Hungry' : hunger === 'peckish' ? 'Peckish' : '', camp.wellFed ? 'fed' : hunger === 'hungry' ? 'hungry' : '');
  hud.hint(currentHint(), t);
  const act = interaction();
  hud.prompt(act ? (touch.active ? `Tap: ${act.text}` : `${kbd('E')} ${act.text}`) : '');
  if (touch.active) hud.action(actionLabel(), fishing.state === 'bite');
  $('cancel-btn').hidden = !(touch.active && fishing.aiming);

  const F = fishing.fight;
  if (fishing.aiming) hud.meter(true, fishing.power, fishing.release, 1 - fishing.release, fishing.aimValid ? `<span>${Math.round(fishing.castDist)} m</span>${wind.strength > 0.15 ? `<span class="ml-sub">wind ${windArrow()}</span>` : ''}` : '—');
  else if (fishing.state === 'reeling' && F) hud.meter(true, F.progress, F.tension, F.tension, F.surgeT > 0 ? 'easy!' : F.slipping ? 'line out' : F.pulling ? 'hold' : 'reel', DRAG_LEVELS[F.drag]);
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

  let showBite = false;
  if (fishing.state === 'bite' && !modal) {
    _p.copy(fishing.biteKind === 'float' || fishing.biteKind === 'take' ? fishing.bob : fishing.hook);
    _p.y = Math.max(_p.y, 0) + 0.35;
    _p.project(camera);
    showBite = _p.z < 1;
    hud.bite((_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight, showBite);
  } else hud.bite(0, 0, false);

  // Where the boat is while you're ashore; where camp is until you've found it.
  const cp = world.camp.firePos;
  placed.length = 0;
  placeMarker($('boat-marker'), boat.pos.x, boat.heave + 1.6, boat.pos.z, started && onFoot && !modal && !nearBoat());
  const campD = Math.hypot(player().pos.x - cp.x, player().pos.z - cp.z);
  placeMarker($('camp-marker'), cp.x, cp.y + 2.4, cp.z, started && !modal && campD > 14 && (onFoot ? campD < 400 : !state.places.camp && !!state.tips.caught));
}

/* ---------------- input ---------------- */

let saveWarned = false;
function save() {
  state.boat = { x: rowboat.pos.x, z: rowboat.pos.z, heading: rowboat.heading, anchored: rowboat.anchored };
  state.skiff = { x: skiff.pos.x, z: skiff.pos.z, heading: skiff.heading, anchored: skiff.anchored };
  state.vessel = boat === skiff ? 'skiff' : 'row';
  state.mode = onFoot ? 'foot' : 'boat';
  state.walker = onFoot ? { x: walker.pos.x, z: walker.pos.z, heading: walker.heading } : null;
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
function ask(title, text, buttons) {
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  const acts = $('confirm-acts');
  acts.replaceChildren(...buttons.map((b) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `pk-btn ${b.cls || ''}`;
    el.textContent = b.text;
    el.addEventListener('click', () => {
      if (!b.keepOpen) $('confirm').hidden = true;
      b.run?.();
    });
    return el;
  }));
  $('confirm').hidden = false;
  acts.lastChild?.focus();
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
        newGame({ quality: state.quality, volumes: state.volumes, music: state.music, difficulty: state.difficulty });
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
  save();
}

function openJournal() {
  journal.open({ boat: rowboat, skiff, walker: onFoot ? walker : null, camp: world.camp.firePos });
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

input.on('press', (code, key) => {
  if (!started) {
    if (code !== 'Tab') begin();
    return;
  }
  audio.start();
  if (modal === 'sleep' || modal === 'travel') return;
  if (!$('confirm').hidden) {
    if (code === 'Escape') $('confirm').hidden = true;
    return;
  }
  if (modal === 'note') {
    if (code === 'Space' || code === 'Enter' || code === 'Escape' || key === 'e') closeNote();
    return;
  }
  if (key === 'j' || code === 'Tab') {
    if (modal === 'journal') closeJournal();
    else if (!modal) openJournal();
    return;
  }
  // While a menu is open, gameplay keys do nothing (except the backpack's own shortcuts).
  if (modal === 'journal') {
    if (code === 'Escape') closeJournal();
    return;
  }
  if (modal === 'camp') {
    if (code === 'Escape' || key === 'e') closeCamp();
    return;
  }
  if (modal === 'pack') {
    if (code === 'Escape' || key === 'b' || key === 'i') closePack();
    else if (key === 'q') nextTackle();
    else if (code === 'Digit1') pickRod(0);
    else if (code === 'Digit2') pickRod(1);
    return;
  }
  if (code === 'Space') {
    fishing.onDown();
    return;
  }
  if (modal === 'catch') {
    if (key === 'k') fishing.keep();
    return;
  }
  if (modal) return;
  const act = interaction();
  if (key === 'e' && act) act.run();
  else if (key === 'b' || key === 'i') openPack();
  else if (key === 'q') nextTackle();
  else if (code === 'Digit1') pickRod(0);
  else if (code === 'Digit2') pickRod(1);
  else if (key === 'g') looseFeed();
  else if (key === 'z') toggleAnchor();
  else if (key === 'x' && !onFoot && boat.motor) {
    boat.lever = 0;
    hud.flash('Motor to neutral', t, 1.4);
  }
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
    if (!fishing.cancel() && rig.mode !== rig.home) resetView();
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
$('prompt').addEventListener('click', () => {
  const act = interaction();
  if (act) act.run();
});
$('set-quality').addEventListener('click', cycleQuality);
$('set-difficulty').addEventListener('click', cycleDifficulty);
$('title-difficulty').addEventListener('click', cycleDifficulty);
applyDifficulty();
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
const ecoCtx = { env: {}, focus: { x: 0, z: 0 }, boat: { x: 0, z: 0, speed: 0 }, walker: null, lantern: null };
const walkerCtx = { x: 0, z: 0, speed: 0 };
const move = { x: 0, z: 0 };
let saveTimer = 10;
let last = performance.now();

// Back where you left off: on foot if that's where you were.
if (state.mode === 'foot' && state.walker && walkHeight(state.walker.x, state.walker.z) > -0.55) {
  walker.place(state.walker.x, state.walker.z, state.walker.heading);
  setFoot(true, true);
  rig.views.foot.yaw = walker.heading;
  rig.focus.set(walker.pos.x, walker.pos.y + 1.4, walker.pos.z);
}
applyGear();

function ecoTick(dt) {
  ecoCtx.env.hour = state.hour;
  ecoCtx.env.rain = weather.rain;
  ecoCtx.env.daylight = env.daylight;
  ecoCtx.env.night = env.night;
  ecoCtx.env.hatch = hatchLevel();
  const lanternLit = boat.hasLantern && boat.lanternLevel > 0.3;
  ecoCtx.env.lanternNear = lanternLit && Math.hypot(boat.pos.x - COVE.x, boat.pos.z - COVE.z) < COVE.r + 30;
  ecoCtx.focus.x = rig.focus.x;
  ecoCtx.focus.z = rig.focus.z;
  ecoCtx.boat.x = boat.pos.x;
  ecoCtx.boat.z = boat.pos.z;
  ecoCtx.boat.speed = boat.speed;
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
  sea.time = t;
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
      fishing.aimBy(si, dt);
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
  otherBoat().update(dt, t, 0, 0, env.lantern);
  keepBoatsApart();
  // The motor: a putter at idle when you're aboard, rising with the throttle. Fish nearby
  // hear it, so slow down (or anchor) before you fish.
  const motorOn = !onFoot && boat === skiff;
  audio.engine?.(motorOn ? Math.max(0.12, Math.abs(skiff.lever) * (skiff.tilted ? 0.5 : 1)) : 0);
  motorNoiseT -= dt;
  if (motorOn && Math.abs(skiff.lever) > 0.25 && motorNoiseT <= 0) {
    motorNoiseT = 0.5;
    eco.startle(skiff.pos.x, -0.6, skiff.pos.z, 5 + skiff.speed * 1.4, 0.7);
  }
  if (onFoot) walker.update(dt, t, move, { jog: input.hasCode('ShiftLeft', 'ShiftRight'), locked: fishing.busy, obstacles: world.obstacles });
  fishing.update(dt, t, rig.yaw, started && !modal && input.action);

  ecoTick(dt);
  handleClues();
  fx.update(dt, t, boat);

  const drag = input.takeDrag();
  const wheel = input.takeWheel();
  if (started && !modal) rig.input(drag, wheel, t);
  rig.update(dt, t, { boat, walker, started, fishing, baitFocus: fishing.watchPoint });
  const P = player().pos;
  env.update(dt, t, state.hour, weather.rain, P, camera, renderer);
  const sub = underwater.updateMedium(t, camera, env, scene, water, weather.rain);
  audio.setUnderwater(sub);
  underwater.update(dt, t, camera, env, weather.rain);
  fishRenderer.update(dt, camera, env.night, sub > 0.5);
  updateWind(dt * Math.min(speed, 10));
  world.update(dt, t, env, { fireLevel: camp.fireLevel, hatchLevel: hatchLevel(), hour: state.hour, wind: 0.5 + wind.strength * 1.3 });
  updateRain(dt);
  mist.update(t, state.hour, env, camera);
  surfaceUniforms.uWetTop.value = 0.22 + 0.05 * Math.sin(t * 0.35) + weather.rain * 0.12;
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

  // The boat's sonar reads under the hull; on foot it reads around your rig once it's in the water.
  if (onFoot) finder.update(dt, fishing.baitInWater ? { x: fishing.hook.x, z: fishing.hook.z, mode: 'rig', moving: fishing.reelSpeed } : { mode: 'none' }, eco.bait);
  else finder.update(dt, { x: boat.pos.x, z: boat.pos.z, mode: 'boat', moving: boat.speed }, eco.bait);

  const zone = zoneAt(P.x, P.z);
  zoneW.open = damp(zoneW.open, zone === 'open' && !onFoot ? 1 : 0, 0.5, dt);
  zoneW.cove = damp(zoneW.cove, zone === 'cove' ? 1 : 0, 0.5, dt);
  const seaD = landSDF(P.x, P.z);
  const fireD = P.distanceTo(world.camp.firePos);
  audio.update(dt, {
    speed: onFoot ? 0 : boat.speed,
    rain: weather.rain,
    day: env.daylight,
    night: env.night,
    land: 1 - smoothstep(6, 70, seaD),
    open: zoneW.open,
    cove: zoneW.cove,
    gulls: 1 - smoothstep(25, 110, Math.hypot(P.x - STACKS[0].x, P.z - STACKS[0].z)),
    water: onFoot ? 1 - smoothstep(3, 30, -seaD) : 1,
    stream: 1 - smoothstep(1.5, 24, streamSDF(P.x, P.z)),
    lake: 1 - smoothstep(2, 35, lakeSDF(P.x, P.z)),
    fire: camp.fireLevel * (1 - smoothstep(2, 18, fireD)),
    sizzle: camp.cooking ? 1 - smoothstep(2, 12, fireD) : 0,
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

// The two boats bump gently instead of sailing through each other.
function keepBoatsApart() {
  const a = rowboat.pos, b = skiff.pos;
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  if (d >= 2.2 || d < 1e-4) return;
  const nx = dx / d, nz = dz / d, push = (2.2 - d) / 2;
  a.x -= nx * push; a.z -= nz * push;
  b.x += nx * push; b.z += nz * push;
  for (const [v, s] of [[rowboat.vel, -1], [skiff.vel, 1]]) {
    const vn = (v.x * nx + v.z * nz) * s;
    if (vn < 0) { v.x -= nx * vn * s; v.z -= nz * vn * s; }
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
  reflection, ripples, mist, fx,
  setHour: (h) => { state.hour = ((h % 24) + 24) % 24; },
  setRain: (r) => { weather.target = r; weather.rain = r; },
  teleport: (x, z, heading = boat.heading) => boat.place(x, z, heading),
  // Put yourself ashore at (x, z), e.g. slowTide.walkTo(-99, -2) for camp.
  walkTo: (x, z, heading = walker.heading) => {
    walker.place(x, z, heading);
    if (!onFoot) setFoot(true);
  },
  board: () => board(),
  rowboat, skiff, wind,
  // Set the breeze: strength 0–1, blowing towards dir (radians, like a heading).
  setWind: (strength, dir = wind.dir) => {
    Object.assign(wind, { strength, target: strength, dir, turn: 0, timer: 1e9 });
  },
  // Put the boat you're not in at (x, z), e.g. alongside for testing.
  placeOther: (x, z, heading = 0) => otherBoat().place(x, z, heading),
  // Climb into the skiff at (x, z).
  useSkiffAt: (x, z, heading = 0) => {
    skiff.place(x, z, heading);
    skiff.setAnchor(false);
    board(skiff);
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
    underwater.updateMedium(t, camera, env, scene, water, weather.rain);
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
