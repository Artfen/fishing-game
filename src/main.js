import * as THREE from 'three';
import { Input, defaultBindings } from './input.js';
import { SettingsUI, WEATHER_MODES } from './settings.js';
import { loadGame, saveGame, newGame, saveStatus, parseSave, importSave, exportText, stopSaving, SAVE_KEY, adoptJournal } from './save.js';
import { Cloud } from './cloud.js';
import { setupOffline, offline, applyUpdate } from './offline.js';
import { DIFFICULTY, DIFFICULTY_IDS, DRAG_LEVELS, DRAG_NAMES, breakReason } from './fight.js';
import { BEHAVIOUR, conditionWords } from './behaviour.js';
import { HUD, kbd } from './ui.js';
import { AudioScape } from './audio.js';
import { Environment, phaseName, formatClock } from './world/sky.js';
import { createWater } from './world/water.js';
import { conditions, updateConditions, windAt, currentAt, currentScale, waveHeight, waveHeightHere, compass, bearingOf, windWords, seaWords, shelterAt, bakeShelter, shelterRect } from './world/conditions.js';
import { SOUTH_WATER, SOUTH_MAP, LANDFALL, POSADA, PUERTO as PUERTO_AT, PONTOON_S, FINGERS_S } from './world/brasa.js';
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
  bakeHeightTexture, heightAt, walkHeight, solidHeight, landSDF, lakeSDF, streamSDF, zoneAt, waterOf, riverSDF, mereSDF, waterLevel, depthAt,
  PLACES, START, WATER_RECT, SHORE_RECT, STACKS, COVE, LANDING, PIERS, BOATHOUSE_PIER, WORLD, SEA, inSeas, inWorld, SOUTH_Z,
  PEGS, POOLS, STREAM, SNAG, LILIES, JETTY, ISLAND, GANNET_CAMP, SKERRIES, SKELLIG, DEEP_Z,
  HAVEN, HAVEN_QUAY, HAVEN_BENCH, DAYMARK, STRAND, WRECK, WRECK_BUOY, WRECK_BELL, CHANNEL,
  HOME, HOME_START, HOUSE, GARAGE, CAR_PARKS, FUEL_PUMPS, CABIN_BERTH, SAIL_BERTH, CRUISER_BERTH, CONSOLE_BERTH, HAVEN_PONTOON, HAVEN_FINGERS, laneInfo,
  CALF, CALF_TOWER, CALF_SKERRY, CALF_SOUND, CALF_LANDING,
} from './world/terrain.js';
import { Car } from './car.js';
import { Workbench, OutingSheet } from './workbench.js';
import { KIT, KIT_IDS, DESTS, launchOf, parkNear, driveMinutes, moveKit, reconcile, campOfKit, campHas, statusOf, snapshot } from './outing.js';
import { insideHome, HOME_SPOTS } from './world/home.js';
import { BOTHY_DOOR, FELL_SIGN } from './world/fell.js';
import { trimAdvice, bestSheet, SAIL } from './sailing.js';
import { SailUI } from './sailui.js';
import { WindLines } from './world/windlines.js';
import { Storm } from './world/storm.js';
import { coldInfo, COLDWATER, FALLS, tarnSDF } from './world/coldwater.js';
import { Boat, BOAT_KINDS } from './boat.js';
import { Walker } from './walker.js';
import { Effects } from './effects.js';
import { buildSeaLife, SEA_LIFE } from './world/sealife.js';
import { SeaGlow, nightGlow } from './world/seaglow.js';
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
import { HarbourSheet, paintSlate } from './harbourView.js';
import { Townsfolk, FOLK, sayTo } from './townsfolk.js';
import { FolkView } from './world/folk.js';
import { demandFor, money } from './market.js';
import { creelSize, chill, wearFrom, addWear, wearOf, wornLine, freshBaitToday, onIce, BAIT, ICE } from './shop.js';
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
import { Gamepads, buttonFor, topDialog, focusables } from './gamepad.js';
import { levers, nearest, step, setIndex, within, capIndex, leverWords } from './throttle.js';
import { LeverUI } from './lever.js';
import { anchorCheck, berthFor, berthAt, castOffCheck, canTow, towStep, TOW } from './mooring.js';
import { Rope } from './rope.js';
import { isPetrol, PASSAGE_FUEL, level as fuelLevel, room as fuelRoom, burnCar, burnBoat, burnKayak, chargeBattery, driveBy, fill, pour, rescue, moveCan, tankWords, batteryWords, canWords, litres, low as fuelLow } from './fuel.js';
import { STEPS as TRIP_STEPS, stepOf, stepNumber, complete as completeStep, start as startGuide, words as guideWords, isNewGame, placeAt, FISH_SPOTS } from './firstTrip.js';
import { PRESETS, CHOICES, FrameWatch, lowerLevel, startingLevel, resolveQuality } from './quality.js';
import { Post } from './post.js';
import { Diver, Shot, buildGun } from './diver.js';
import { stepComfort, effectsOf, needsOf, dressFor, drink as drinkFrom, refill, eatRoll, packRolls, mealDrink, CLOTHES, CLOTHES_IDS, BOTTLE, ROLLS, feelsLike } from './comfort.js';
import { BREATH, SCUBA, SPEAR, breathUse, breathToSurface, recoverRate, airUse, minutesLeft, canSpear, sizeGuess, spearHit, shotQuality, tearChance } from './dive.js';
import { clamp, damp, dampAngle, lerp, smoothstep, rand, pick, seeded } from './util.js';

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
// The finishing pass of the Ultra and Cinematic levels (off below them).
const post = new Post(renderer);

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

/* ---------------- which sea: home, or Las Brasas far to the south ---------------- */

// Las Brasas (see world/brasa.js) is far off the bottom of the home chart, so the water there needs
// its own map of the seabed and its own shelter (baked the first time you go), and it is another
// sea: clearer and bluer, in the trade wind. Which one you're in is wherever you are.
let region = 'home';
// (A sharper map over the harbour and El Bajón, the reef off its mouth.)
const HARBOUR_RECT = { x: -150, z: 6180, w: 340, h: 300 };
const HOME_WATER = { tex: heightTex, rect: WATER_RECT, detail: water.uniforms.uHeight2.value, detailRect: SHORE_RECT };
let SOUTH_TEX = null;
function southWater() {
  if (!SOUTH_TEX) SOUTH_TEX = { tex: bakeHeightTexture(560, SOUTH_WATER, 560), rect: SOUTH_WATER, detail: bakeHeightTexture(320, HARBOUR_RECT, 282), detailRect: HARBOUR_RECT, shelter: bakeShelter('south') };
  return SOUTH_TEX;
}
// The colours of each sea, from the shallows to the deep.
const SEA_COLOURS = {
  home: { uShallow: '#7fd8c6', uMid: '#38a0ad', uDeep: '#1b5c85' },
  south: { uShallow: '#6fe3d8', uMid: '#1f97c9', uDeep: '#0d3e86' },
};
function setRegion(r) {
  region = r;
  conditions.region = r;
  const W = r === 'south' ? southWater() : HOME_WATER;
  for (const U of [water.uniforms, mist.uniforms]) {
    U.uHeight.value = W.tex;
    U.uRect.value.set(W.rect.x, W.rect.z, W.rect.w, W.rect.h);
    U.uHeight2.value = W.detail;
    U.uRect2.value.set(W.detailRect.x, W.detailRect.z, W.detailRect.w, W.detailRect.h);
  }
  const SR = shelterRect(r);
  water.uniforms.uShelter.value = r === 'south' ? W.shelter : bakeShelter();
  water.uniforms.uShelterRect.value.set(SR.x, SR.z, SR.w, SR.h);
  for (const [k, c] of Object.entries(SEA_COLOURS[r])) water.uniforms[k].value.set(c);
  underwater.clear = r === 'south' ? 1 : 0;
  water.uniforms.uClear.value = r === 'south' ? 1 : 0;
  // (At Las Brasas the trade wind blows from the north-east, unless you've set the wind yourself.)
  if (r === 'south' && settings.weather.windMode !== 'manual') conditions.wind.from = 0.8;
  // (The first time: the island's buildings and plants, and its weed beds under the water.)
  if (r === 'south' && !world.brasa) world.buildBrasa();
  if (r === 'south' && !southBeds) {
    southBeds = true;
    underwater.addBeds({ x: -760, z: 5480, w: 1520, h: 1120, grass: 6500, kelp: 1400 }, seeded(9191));
  }
}
let southBeds = false;
function watchRegion() {
  const r = player().pos.z > SOUTH_Z || camera.position.z > SOUTH_Z ? 'south' : 'home';
  if (r !== region) setRegion(r);
}
const world = buildWorld(scene, renderer, habitat);
// Your own camps (see campsite.js): drawn by CampView, and solid underfoot like everything else.
state.camps = Array.isArray(state.camps) ? state.camps : [];
// Where your outing gear is (see outing.js): one record, made to agree with your camps and pack.
reconcile(state);
const campView = new CampView(scene);
const campSolids = [];
function refreshCamps() {
  campSolids.length = 0;
  for (const c of state.camps) {
    // (Which pieces are set up there: the stove and the cool box can be elsewhere.)
    c.has = { stove: campHas(state, c, 'stove'), coolbox: campHas(state, c, 'coolbox') };
    campSolids.push(...campObstacles(c));
  }
  campView.sync(state.camps);
}
// The car's body, as something to bump into on foot (see the car, below).
const carSolids = [];
// The world's obstacles, your camps' gear and the car together, as one thing to bump into.
const solids = {
  resolve(p, r, y = -Infinity) {
    let hit = world.obstacles.resolve(p, r, y);
    for (const o of carSolids.length ? campSolids.concat(carSolids) : campSolids) {
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
    for (const o of carSolids) if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + pad) ** 2) out.push(o);
    return out;
  },
};
// What the car itself can run into: the world and your camps (not itself).
const carWorld = {
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
// The sea glowing at night (splashes, wakes and strokes light it: see seaglow.js), and the
// whales, dolphins, seals and gannets you watch rather than catch (sealife.js).
const glow = new SeaGlow(scene);
fx.glow = glow;
glow.setPixelRatio(renderer.getPixelRatio());
hideFromReflection(glow.points);
const sealife = buildSeaLife(scene, { glow });
// The harbour's people (Mags, Bert, Ruth, Dougie and his boat, Hettie, Kit; Paco at Las Brasas).
const town = new Townsfolk({ obstacles: world.coast.obstacles });
const folkView = new FolkView(scene);
// What the people go by: the weather, and what the fish near the harbour are up to (looked at every
// few seconds, not every frame).
let folkAbout = [], folkAboutT = 0;
function folkCtx(dt) {
  folkAboutT -= dt;
  if (folkAboutT <= 0) {
    folkAboutT = 5;
    folkAbout = whatsAbout(eco).map((a) => ({ id: a.sp.id, name: a.sp.name, act: a.act }));
  }
  return { storm: Math.max(weather.storm, conditions.sea.storm), rain: weather.rain, wind: conditions.wind.speed, about: folkAbout, activity: eco.activity };
}
// A word with someone you walk up to.
function talkTo(p) {
  const wanted = demandFor(state.day, 'haven').wanted.map((id) => fishById[id].name);
  hud.toast(`${FOLK[p.id].short}: ${sayTo(p, { hour: state.hour, storm: Math.max(weather.storm, conditions.sea.storm), wanted, caught: Math.floor(state.hour) % 3, landed: town.landed })}`, 8);
  audio.page?.();
}
camera.layers.enable(NO_REFLECT);
hideFromReflection(water.mesh);
hideFromReflection(water.ring);
for (const o of [...underwater.beds.flatMap((b) => [b.grass, b.kelp]), underwater.rocks, underwater.particles, underwater.bubblesPts, ...underwater.rays]) hideFromReflection(o);
for (const m of fishRenderer.meshes) hideFromReflection(m);
// The boats: the rowing boat you start with, the motor skiff and the kayak tied up at the
// landing, and the bass boat at the Longmere boathouse. `boat` is whichever you're in (or
// last used); the others float where you left them.
const BOATS = Object.fromEntries(BOAT_KINDS.map((k) => [k, new Boat(scene, { kind: k })]));
// The car (see car.js): on the drive at home, or wherever you left it. If the ground where it
// stood has changed (an update), it waits at its car park instead.
const car = new Car(scene);
{
  const c = state.car;
  car.place(c.x, c.z, c.yaw);
  if (car.blocked(c.x, c.z, c.yaw, carWorld)) {
    const p = CAR_PARKS[c.at] || CAR_PARKS.home;
    car.place(p.x, p.z, p.yaw);
    state.car = { x: p.x, z: p.z, yaw: p.yaw, at: CAR_PARKS[c.at] ? c.at : 'home' };
  }
}
function refreshCarSolids() {
  carSolids.length = 0;
  const s = Math.sin(car.heading), c = Math.cos(car.heading);
  for (const u of [-1.5, -0.5, 0.5, 1.5]) carSolids.push({ x: car.pos.x + u * s, z: car.pos.z + u * c, r: 0.9, top: car.pos.y + 1.6, kind: 'car', name: 'the car' });
}
refreshCarSolids();
let driving = false;
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
// (Las Brasas' chart, far to the south, remembers its own.)
const exploredSouth = new Explored(state.seenSouth, SOUTH_MAP);
const exploredAt = (z) => (z > SOUTH_Z ? exploredSouth : explored);
if (!state.seen) {
  explored.reveal(START.x, START.z, 160);
  for (const p of PLACES) if (state.places[p.id]) exploredAt(p.z).reveal(p.x, p.z, p.area ? 160 : 110);
}
const input = new Input(canvas);
input.setBindings(settings.controls.keys || defaultBindings());
// The key for an action, as printed on this keyboard, ready for a hint: K('interact') → E.
const K = (action) => kbd(input.keyLabel(action));
const touch = setupTouch(input);
// A game controller, if one is plugged in (see gamepad.js): its buttons press the same actions,
// and while it's the last thing you used the hints name its buttons.
const pads = new Gamepads(input, {
  context: padContext,
  resolve: () => (state.gear.pack.rods[0] === state.gear.rod ? 'rod2' : 'rod1'),
  connected: (id, standard) => {
    if (!standard) hud.toast('A controller is connected, but the browser doesn’t know its layout: some buttons may not be where the hints say.', 7);
    else if (started) hud.toast('Controller connected: the hints show its buttons now.', 4);
  },
  disconnected: () => {
    if (input.method === 'pad') input.use(touch.active ? 'touch' : 'keys');
    if (started) hud.toast(`Controller disconnected: ${touch.active ? 'the touch controls are back' : 'the keyboard and mouse carry on'}.`, 4);
  },
  focusRoot: () => $('title'),
});
input.padLabel = (a) => pads.label(a);
// Which controls the hints describe: 'keys' (keyboard and mouse), 'pad' or 'touch'.
const scheme = () => input.method;
// Moving and looking, in the hints: the movement keys and the mouse, or the controller's sticks.
const MOVE = () => (scheme() === 'pad' ? kbd('L-stick') : `${K('forward')}${K('left')}${K('back')}${K('right')}`);
const LOOK = () => (scheme() === 'pad' ? `${kbd('R-stick')} look around (push up to sink under the water)` : 'drag to look around (drag up to sink under the water)');
input.onMethod((m) => {
  document.body.classList.toggle('pad', m === 'pad');
  hud.cache = {};
  labelKeys();
  showControls();
});

// Tab moves round the open panel and stays in it (from outside, it goes in), so the keyboard
// never wanders off behind a menu.
addEventListener('keydown', (e) => {
  if (e.code !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
  const root = topDialog();
  if (!root) return;
  const all = focusables(root);
  if (!all.length) return;
  const i = all.indexOf(document.activeElement);
  if (i >= 0 && !(e.shiftKey ? i === 0 : i === all.length - 1)) return;
  e.preventDefault();
  (e.shiftKey ? all[all.length - 1] : all[0]).focus();
});

// The key (or button) printed beside the corner buttons, the catch card's photo button…
function labelKeys() {
  for (const k of document.querySelectorAll('kbd[data-key]')) {
    k.textContent = scheme() === 'pad' ? buttonFor(k.dataset.ctx || 'play', k.dataset.key) : input.keyName(k.dataset.key);
  }
}

// The title's few essential controls, for whichever you're using (the full list is in Settings).
function showControls() {
  const k = (a) => kbd(input.keyName(a)), b = (a) => kbd(buttonFor('play', a));
  const rows = {
    touch: [
      ['left side', 'drag to walk, row or drive'],
      ['right side', 'drag to look · pinch to zoom'],
      ['round button', 'hold to aim, let go to cast · hold to reel'],
      ['tap a prompt', 'whatever it says: a door, the car, the boat'],
      ['top buttons', 'backpack · map · journal · settings'],
    ],
    pad: [
      [`${b('forward')} ${b('look')}`, 'walk, row and steer · look around'],
      [b('cast'), 'hold to aim, let go to cast · hold to reel'],
      [`${b('interact')} · ${b('cancel')}`, 'whatever the prompt says · cancel or back'],
      [`${b('pack')} ${b('map')} ${b('journal')}`, 'backpack · map · journal'],
      [b('settings'), 'settings (every button is listed there)'],
    ],
    keys: [
      [`${k('forward')}${k('left')}${k('back')}${k('right')}`, 'walk, row and drive'],
      ['drag · scroll', 'look around · zoom'],
      [k('cast'), 'hold to aim, let go to cast · hold to reel'],
      [`${k('interact')} · ${kbd('Esc')}`, 'whatever the prompt says · cancel or back'],
      [`${k('pack')} ${k('map')} ${k('journal')}`, 'backpack · map · journal'],
      [k('settings'), 'settings (every key is listed there, and can be changed)'],
    ],
  }[scheme()];
  $('t-keys').innerHTML = rows.map(([dt, dd]) => `<dt>${dt}</dt><dd>${dd}</dd>`).join('');
  $('t-pad').textContent = scheme() === 'pad' ? 'Playing with a controller (the keyboard, mouse or a touch switches back).'
    : 'getGamepads' in navigator && scheme() === 'keys' ? 'Got a controller? Press any button on it.' : '';
}
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
  if (kind === 'cabin') return { ...CABIN_BERTH };
  if (kind === 'sail') return { ...SAIL_BERTH };
  if (kind === 'cruiser') return { ...CRUISER_BERTH };
  if (kind === 'console') return { ...CONSOLE_BERTH };
  // The jet ski and the windsurf board: alongside the first finger west of Willowhaven's pontoon.
  if (kind === 'jetski' || kind === 'windsurf') {
    const F = HAVEN_FINGERS[1];
    return kind === 'jetski' ? { x: F.x1 - 3, z: F.z0 - 0.9, heading: -Math.PI / 2 } : { x: F.x1 - 8.5, z: F.z0 - 0.6, heading: -Math.PI / 2 };
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
// deep enough for its hull, and not on top of a pier. (Tied up alongside one, her middle lies
// just clear of its edge: that's fine.)
function floats(b, p) {
  if (!p || !inSeas(p.x, p.z)) return false;
  if (solidHeight(p.x, p.z) > -(b.hull.draft + (p.tie ? 0.2 : 0.4))) return false;
  const m = p.tie ? 0.2 : 0.8;
  return !PIERS.some((P) => p.x > P.x0 - m && p.x < P.x1 + m && p.z > P.z0 - m && p.z < P.z1 + m);
}
for (const [kind, b] of Object.entries(BOATS)) {
  const saved = state.boats[kind];
  const at = floats(b, saved) ? saved : mooring(kind);
  b.place(at.x, at.z, at.heading);
  // (The kayak's motor as you left it: lowered, or up; the sailing boat's sail, and its sheet.)
  if (saved?.motor && b.hull.emotor) b.setEMotor(true);
  // (The sailing boat's outboard, left down and running.)
  if (saved?.motor && b.hull.outboard) b.setOutboard(true);
  if (saved?.sail != null && b.hull.sail) {
    b.setSail(true);
    b.sheet = saved.sail;
  }
}
// How each boat was left: tied up alongside (made fast again where she lies, held firm from the
// start), at anchor (the anchor already on the bottom where it was), or free. A boat at her home
// mooring starts tied up there; an older save's boat "anchored" right alongside a pier (how boats
// brought round to the quay used to be left) is tied up instead.
for (const [kind, b] of Object.entries(BOATS)) {
  const saved = state.boats[kind], here = !!saved && floats(b, saved) && Math.hypot(saved.x - b.pos.x, saved.z - b.pos.z) < 0.01;
  const T = here ? saved.tie : null;
  const berth = T ? berthAt(b, T.pier, T.side, T.along, T.heading) : null;
  if (berth && Math.hypot(berth.x - b.pos.x, berth.z - b.pos.z) < 3) {
    b.tieTo({ ...berth, t: 9 });
    continue;
  }
  if (here && saved.anchored) {
    const old = !saved.anchor && berthFor(b, boats, { reach: 2.5 });
    if (old) {
      b.place(old.x, old.z, old.heading);
      b.tieTo({ ...old, t: 9 });
    } else b.setAnchor(true, { at: saved.anchor || null, instant: true });
    continue;
  }
  if (!here) {
    const home = berthFor(b, boats, { reach: 2.5 });
    if (home) {
      b.place(home.x, home.z, home.heading);
      b.tieTo({ ...home, t: 9 });
    }
  }
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
  // A gale off the Atlantic: the wind gets up, the big seas roll in, thunder and lightning.
  storm: { cloud: 1, rain: 1, storm: 1, word: 'Storm' },
};
// When it changes by itself: what can come next (a list may repeat an entry to make it likelier).
const NEXT_SKY = {
  clear: ['partly', 'partly', 'clear'],
  partly: ['clear', 'overcast', 'partly'],
  overcast: ['partly', 'light', 'overcast'],
  light: ['overcast', 'heavy', 'partly', 'light'],
  heavy: ['light', 'light', 'heavy', 'storm'],
  storm: ['heavy'],
};
// At Las Brasas, the trade-wind weather: mostly fine, cloud banking up now and then, a passing
// shower, very seldom anything worse.
const NEXT_SKY_SOUTH = {
  clear: ['clear', 'partly', 'clear'],
  partly: ['clear', 'partly', 'clear', 'overcast'],
  overcast: ['partly', 'partly', 'light'],
  light: ['partly', 'overcast'],
  heavy: ['light', 'overcast'],
  storm: ['heavy'],
};
const startSky = state.sky || { state: 'partly', cloud: SKIES.partly.cloud, rain: 0, timer: state.tips.rained ? rand(120, 220) : 240 };
const weather = {
  rain: startSky.rain, cloud: startSky.cloud, storm: startSky.storm || 0, state: startSky.state, timer: startSky.timer,
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
let dive = null; // in the water: see the diving section
const player = () => (dive ? diver : onFoot ? walker : boat);
// The map open while you're aboard: the boat carries on (her motor at its notch, her sail as it's
// trimmed), and the helm still answers the keys, so you can steer by the map.
const mapAboard = () => modal === 'map' && !onFoot && !driving && !dive && !cabinIn;

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
    if (settings.controls.rumble) pads.rumble(kind === 'warn' ? 0.2 : 0.55, kind === 'warn' ? 70 : 200);
    if (kind === 'run' && rig.mode === 'eye') shake(0.25);
  },
  // Casting from a boat under power: the throttle eases back to trolling speed (see easeForCast).
  easeForCast: () => easeForCast(),
  onCast: () => {
    if (!state.tips.cast) {
      state.tips.cast = true;
      save();
    }
    // The big-game rod, the first time: how trolling goes.
    if (fishing.rod?.chair) {
      const T = scheme() === 'touch', big = !onFoot && !!levers(boat.kind)?.some((n) => n.id === 'T');
      teach('trolling', `Trolling: with the lure out astern, motor on and it swims behind the boat. ${big ? `Push the throttle up to T (trolling, about seven knots) for marlin, wahoo, dorado and tuna, or keep to dead slow or slow for sailfish, spearfish and sharks with a ballyhoo.` : 'Slow ahead is the most this boat allows with a line out; the yacht and the centre console troll faster.'} Out in the blue water the big fish come up the wake to look. When one hits, it hooks itself: ${T ? 'hold the reel button' : 'hold'} to play it${boat.hull.standing?.chair ? ', from the fighting chair' : ''}, and ease off when it runs.`, 12);
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
    if (state.keep.length < creelSize(state)) return true;
    hud.flash(`Your creel is full (${creelSize(state)} fish). Cook or sell some, or let this one go.`, t, 3.5);
    return false;
  },
  onKeep: (sp, size) => {
    state.keep.push({ id: sp.id, size, logId: lastCatchId, at: state.day * 24 + state.hour });
    setOutcome(lastCatchId, 'kept');
    $('catch-card').hidden = true;
    modal = null;
    hud.flash(`Into the creel: ${sp.name.toLowerCase()}, ${size} cm. Cook it at camp.`, t, 3);
    teach('kept', 'Fish you keep ride in the creel on your backpack. Grill them at camp, then eat.', 6);
    save();
  },
  // Every break has a reason you can see and do something about (see fight.js).
  // A fish thrown or pulled free has the line whole: it says so.
  onSnap: (why, sp, rod) => {
    hud.flash(why === 'teeth' ? 'Snip! The line is cut.' : why === 'snag' ? 'Snagged! The line parted in the weed.' : why === 'thrown' ? 'It threw the hook!' : why === 'pulled' ? 'The hook pulled free.' : 'Snap! The line broke.', t, 3);
    hud.toast(breakReason(why, sp, rod), 9);
  },
  // The line as it is (worn by hard fights, see shop.js); and the wear a fight just ended leaves.
  line: (rod) => wornLine(rod.line, wearOf(state, rod.id)),
  fought: (F, rod) => {
    const w = addWear(state, rod.id, wearFrom(F));
    if (w.was < 0.6 && w.now >= 0.6) teach('frayed', `That fight has left the line on your ${rod.short.toLowerCase()} frayed: it’s a little weaker now. Old Bert at the chandlery will put fresh line on for a few pounds.`, 9);
  },
  baitBoost: () => (freshBaitToday(state) ? BAIT.boost : 1),
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
// how: for a fish not caught on a rod (speared): { kind, rod, from, at }.
function logCatch(sp, size, agent, rigUsed, how = null) {
  const F = fishing.fight;
  const at = how?.at || (F ? F.start : fishing.hook);
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
    kind: how?.kind || rigUsed?.rod?.kind || 'float',
    rod: how?.rod || rigUsed?.rod?.id || 'float',
    item: rigUsed?.item?.id || null,
    line: how ? '' : rigUsed?.rod?.line?.name || '',
    term: how ? '' : fishing.term?.id || '',
    weight: Math.round((agent?.weight ?? weightOf(sp, size)) * 100) / 100,
    sky: weather.state,
    from: how?.from || (onFoot ? 'shore' : 'boat'),
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

// Into the records: the species' tally and best, the log, the adventures. Returns { isNew, record }.
function recordCatch(sp, size, agent, rigUsed, how = null) {
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
  logCatch(sp, size, agent, rigUsed, how);
  adventures.caught(sp.id, agent.x, agent.z, world.flocks);
  markObserved(sp.id, agent);
  state.tips.caught = true;
  save();
  return { isNew, record };
}

function showCatch(sp, size, agent, rigUsed) {
  const { isNew, record } = recordCatch(sp, size, agent, rigUsed);

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
  $('cc-new').hidden = !isNew;
  $('cc-name').textContent = sp.name;
  // (Its own weight: a fish in fine condition is heavier for its length than a lean one.)
  const kg = agent?.weight ?? weightOf(sp, size);
  const wtText = kg < 1 ? `${Math.round(kg * 1000 / 10) * 10} g` : `${kg.toFixed(kg < 10 ? 1 : 0)} kg`;
  const build = agent?.condition && !sp.creature ? ` · ${conditionWords(agent.condition)}` : '';
  $('cc-size').textContent = `${size} cm${sp.creature ? ' mantle' : ''} · about ${wtText}${build}${record ? ' · your biggest yet' : ''}`;
  $('cc-note').textContent = isNew ? sp.note : agent.caught > 0 ? 'This one has met your hook before.' : sp.creature ? pick(['It flushes pale and dark, and squirts a last jet of ink.', 'Its great eyes look you over.', 'It wraps an arm round your finger, then lets go.']) : pick(REPEAT_LINES);
  $('cc-rig').textContent = (rigUsed?.item ? `Caught on ${rigUsed.item.on}, with the ${rigUsed.rod.short.toLowerCase()}` : '') + (state.trip?.sp === sp.id ? ' · the fish your trip is for' : '');
  const keepBtn = $('cc-keep');
  keepBtn.hidden = !sp.meal;
  keepBtn.disabled = state.keep.length >= creelSize(state);
  keepBtn.lastChild.textContent = state.keep.length >= creelSize(state) ? 'Creel full' : 'Keep for the pot';
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
  wear: (el) => renderWear(el),
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
const tackleBox = () => (nearCamp() || regionBox() || ownCampNear(4.5) ? 'tackle box' : chandleryNear() ? 'chandlery' : inGarage() ? 'tackle wall' : !onFoot && boat.motor ? 'boat locker' : false);
const inGarage = () => onFoot && !driving && insideHome(walker.pos.x, walker.pos.z) === 'garage';

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
  refreshHomeGear();
  returnToBench();
}

// The camping gear, in the backpack: where each piece is, pitching a camp, your camp's whereabouts,
// and the camera.
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
  const where = KIT_IDS.map((k) => `${KIT[k].name}: ${statusOf(state, 'kit', k).words.toLowerCase()}`);
  out.push(p(where.join(' · '), 'gx-kit-text'));
  if (kitsFree(state) || state.equip.kit.tent === 'car') {
    out.push(btn('Pitch a camp…', () => startPitching('new'), !onFoot || driving));
    if (!onFoot) out.push(p('Step ashore first: a tent needs dry ground.'));
  } else if (state.equip.kit.tent === 'home') out.push(p('The tent is in the garage at home: plan an outing at the workbench to take it.'));
  for (const c of state.camps) {
    const P = player().pos, d = Math.round(Math.hypot(c.x - P.x, c.z - P.z));
    const dir = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round((Math.atan2(c.x - P.x, -(c.z - P.z)) / (Math.PI * 2)) * 8 + 8) % 8];
    out.push(p(d < 12 ? `${c.name}: you’re here. Pack it up or move it from the camp itself (Your camp tab).` : `${c.name}: ${d} m ${dir}, pitched on day ${c.pitched.day}. ${c.has?.coolbox === false ? 'No cool box there.' : c.store.fish.length ? `${c.store.fish.length} fish in the cool box.` : 'The cool box is empty.'}`, 'gx-kit-text'));
    const row = document.createElement('div');
    row.className = 'gx-kit-acts';
    if (d >= 12) row.append(btn('Head there', () => travel('own'), !travelInfo().own), btn('Move it here…', () => startPitching('move', c), !onFoot, 'quiet'));
    out.push(row);
  }
  // The jerry can: where it is, how full, and pouring it into whatever's here.
  {
    const f = tanks(), P = player().pos;
    out.push(p(`Jerry can: ${canWords(f)}, ${f.can.at === 'pack' ? 'in your backpack' : f.can.at === 'car' ? 'in the car' : 'in the garage at home'}.`, 'gx-kit-text'));
    const row = document.createElement('div');
    row.className = 'gx-kit-acts';
    const nearCar = driving || (onFoot && Math.hypot(car.pos.x - P.x, car.pos.z - P.z) < 8);
    const boatHere = !onFoot ? (isPetrol(boat.kind) ? boat : null) : boats.find((b) => isPetrol(b.kind) && Math.hypot(b.pos.x - P.x, b.pos.z - P.z) < 5);
    const redo = () => packUI.render();
    if (canHere()) {
      if (nearCar) row.append(btn('Pour it into the car', () => { pourCan('car'); redo(); }, f.can.litres < 0.5 || fuelRoom(f, 'car') < 0.05, 'quiet'));
      if (boatHere) row.append(btn(`Pour it into the ${boatHere.name}`, () => { pourCan(boatHere.kind); redo(); }, f.can.litres < 0.5 || fuelRoom(f, boatHere.kind) < 0.05, 'quiet'));
    }
    if (nearCar && f.can.at === 'pack') row.append(btn('Leave it in the car', () => { moveCan(f, 'car'); save(); redo(); }, false, 'quiet'));
    if (nearCar && f.can.at === 'car') row.append(btn('Take it from the car', () => { moveCan(f, 'pack'); save(); redo(); }, false, 'quiet'));
    if (row.children.length) out.push(row);
  }
  // The camera rides in the same pocket (the only way into photo mode on a touch screen).
  out.push(p(`Your camera: a picture of wherever you are, and under the water, of the fish themselves.${scheme() === 'touch' ? '' : ` (${input.keyLabel('photo')} anywhere.)`}`, 'gx-kit-text'));
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
  passTime: (h) => passTime(h),
  // The camping gear at a camp: what's set up there, where the rest is, moving it on and off.
  kit: {
    has: (c, k) => campHas(state, c, k),
    at: (k) => state.equip.kit[k],
    where: (k) => statusOf(state, 'kit', k).words,
    move: (k, to) => {
      const r = typeof to === 'object' ? moveKit(state, k, 'camp', { campId: to.id }) : moveKit(state, k, to);
      if (r.ok) {
        refreshCamps();
        audio.knock?.(0.3);
      }
      return r;
    },
  },
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
  controls: () => scheme(),
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
    const at = state.equip.kit.tent;
    // The tent in the car, and the car close by: you fetch it (and the stove and cool box).
    if (at === 'car' && Math.hypot(car.pos.x - walker.pos.x, car.pos.z - walker.pos.z) < 70) {
      const got = KIT_IDS.filter((k) => state.equip.kit[k] === 'car');
      for (const k of got) state.equip.kit[k] = 'pack';
      hud.toast(`You fetch the ${got.map((k) => KIT[k].short).join(', ').replace(/, ([^,]*)$/, ' and $1')} from the car.`, 4);
      save();
    } else {
      hud.flash(at.startsWith('camp:') ? 'Your tent is pitched already: move that camp, or pack it up first.'
        : at === 'car' ? 'Your tent is in the car: fetch it from the boot first.'
          : 'Your tent is in the garage at home: take it on your next outing.', t, 3.5);
      return;
    }
  }
  if (modal === 'pack') closePack();
  else if (modal === 'camp') closeCamp();
  else if (modal === 'map') closeMap();
  if (modal) return;
  siteWorld.ignore = mode === 'move' ? c.id : null;
  placement.start(mode, c);
  audio.rustle?.();
  teach('pitching', scheme() === 'touch'
    ? 'Walk to where you’d like your camp: the outline turns green where it fits. The buttons turn it; tap Pitch it here when you’re happy.'
    : scheme() === 'pad'
      ? `Walk to where you’d like your camp: the outline turns green where it fits, and says why where it doesn’t. ${K('tackle')} and ${K('interact')} turn it, ${K('cast')} pitches it, ${K('cancel')} puts the kit away again.`
      : `Walk to where you’d like your camp: the outline turns green where it fits, and says why where it doesn’t. ${input.keyLabel('tackle')} and ${input.keyLabel('interact')} turn it, the mouse wheel brings it nearer or further, ${input.keyLabel('cast')} pitches it, Esc puts the kit away again.`, 10);
}

function pitchHere(spot, mode, c) {
  if (stepOf(state.guide) === 'back') guideEvent('back');
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
  // The tent goes up, and the stove and cool box come out of your backpack if they're in it.
  for (const k of KIT_IDS) if (k === 'tent' || state.equip.kit[k] === 'pack') state.equip.kit[k] = `camp:${c2.id}`;
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
  hud.toast(`${c.name} is on your map. ${scheme() === 'touch' ? 'Tap the prompt by the door' : `Press ${input.keyLabel('interact')} by the door`} to rest, cook, use the cool box or change your tackle.`, 7);
}

// Pack it up (fish in the cool box go into your creel; `release` are the ones you chose to let go).
function packCamp(c, release = []) {
  const r = packUp(state, c, { release });
  if (!r.ok) {
    hud.toast(r.why, 5);
    return;
  }
  // Everything that was set up there goes into your backpack.
  for (const k of KIT_IDS) if (state.equip.kit[k] === `camp:${c.id}`) state.equip.kit[k] = 'pack';
  for (const f of r.released) setOutcome(f.logId, 'released');
  closeCamp();
  refreshCamps();
  audio.rustle?.();
  save();
  hud.toast(`${c.name} is packed up: the camping gear is rolled up on your backpack${r.carried ? `, and ${r.carried} fish are in your creel` : ''}${r.released.length ? `; ${r.released.length} went back into the water` : ''}.`, 6);
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

/* ---------------- the harbour: the fish market and the inns ---------------- */

const harbourSheet = new HarbourSheet(state, {
  toast: (text, secs) => hud.toast(text, secs),
  chime: () => audio.chime?.(),
  changed: () => save(),
  close: () => closeHarbour(),
  now: () => state.day * 24 + state.hour,
  sold: (logId) => setOutcome(logId, 'sold'),
  eatMeal: (m) => camp.eatMeal(m),
  eatDish: (text, fill) => camp.eatDish(text, fill),
  drink: () => { if (state.comfort) mealDrink(state.comfort); },
  openRoom: () => {
    closeHarbour();
    openCamp('cook', 'posada');
  },
  talk: (place) => innTalk(place),
  openStore: () => {
    closeHarbour();
    openPack('chandlery');
  },
  // The rods Bert looks over: the ones you carry, and any other with worn line.
  rods: () => ROD_IDS.filter((id) => state.gear.pack.rods.includes(id) || wearOf(state, id) > 0)
    .map((id) => ({ id, name: RODS[id].name, line: lineInUse(state.gear, RODS[id]) })),
  trip: () => tripChecklist(),
});
// where: 'market' (Willowhaven's fish market), 'inn' (The Lobster Pot), 'muelle' (Bar El Muelle) or
// 'chandlery' (its counter: creels, ice, fresh bait, mending, ready for a trip).
function openHarbour(where) {
  if (modal) return;
  modal = 'harbour';
  harbourSheet.open(where);
  audio.page();
  if (where === 'chandlery') teach('counter', 'The chandlery’s tackle is free to take, as always (The tackle store). At the counter, Old Bert sells a bigger creel, ice to keep your catch fresh and fresh bait, puts new line on a worn rod, and runs through what you need for a trip.', 10);
  else if (where === 'market') teach('market', 'The fish market buys what you keep: the price is by weight, more for the kinds wanted today, and best while the fish is fresh. Money goes on a pint, a hot meal, or a fish cooked for you at the inn.', 9);
  else teach('inn', 'The inn: buy a pint and hear a story, ask what’s biting, and catch what’s being said about the sea today. The kitchen asks for particular fish each day, and pays well for them.', 9);
}
function closeHarbour() {
  harbourSheet.close();
  if (modal === 'harbour') modal = null;
}
// What the bar is talking about: the water as it is (for the advice), and what's going on out
// there (for the rumours). Every word of it read off the world as it is now.
function innTalk(place) {
  const home = place !== 'muelle';
  const storm = Math.max(weather.storm, conditions.sea.storm);
  const nameOf = (x, z) => {
    if (!home) return 'off the island';
    const n = placeName(x, z);
    return n ? `near ${n.replace(/^The /, 'the ')}` : 'out past the bay';
  };
  const inSea = (z) => (z > SOUTH_Z) === !home;
  const F = sealife.feeding;
  const tuna = eco.schools.find((s) => s.frenzy > 0 && s.prey && inSea(s.z));
  // The best fish you've had today, if it was a good one.
  let yours = null;
  for (let i = state.log.length - 1; i >= 0 && state.log[i].day === state.day; i--) {
    const e = state.log[i], sp = fishById[e.sp];
    if (!sp || !inSea(e.z)) continue;
    const k = (e.size - sp.size[0]) / Math.max(1, sp.size[1] - sp.size[0]);
    if (k > 0.75 && (!yours || k > yours.k)) yours = { k, name: sp.name, size: e.size };
  }
  return {
    advice: { place, hour: state.hour, rain: weather.rain, wind: conditions.wind.speed, storm, about: home ? whatsAbout(eco) : [], caught: new Set(Object.keys(state.fish)) },
    rumours: {
      place, hour: state.hour, nameOf, storm, rain: weather.rain,
      birds: home ? birdsWorking(world.flocks, state.places) : [],
      gannets: home && F ? { x: F.school.x, z: F.school.z } : null,
      boil: tuna ? { x: tuna.x, z: tuna.z } : null,
      // (Dolphins only when they're somewhere with a name: close in, worth going to look for.)
      pods: state.hour > 6 && state.hour < 21 ? sealife.pods.filter((p) => p.sea === (home ? 'home' : 'south') && (!home || placeName(p.x, p.z))).slice(0, 1).map((p) => ({ kind: p.kind, x: p.x, z: p.z })) : [],
      whales: sealife.whales.filter((w) => w.sea === (home ? 'home' : 'south') && w.state !== 'down').slice(0, 1).map((w) => ({ kind: w.kind, x: w.x, z: w.z, up: w.state === 'breathe' })),
      glow: nightGlow(state.day),
      news: home ? town.news(state.hour) : town.newsSouth(state.hour),
      yours,
    },
  };
}
// Ready for a trip: what Bert runs through with you at the counter.
function tripChecklist() {
  const out = [];
  const now = state.day * 24 + state.hour, size = creelSize(state), free = size - state.keep.length;
  out.push({ ok: free >= 2, text: free ? `Room in your creel for ${free} more fish (it holds ${size}).` : `Your creel is full (${size}). Sell some at the market, or cook them.` });
  out.push(onIce(state, now)
    ? { ok: true, text: 'Ice in your creel: your catch keeps fresh.' }
    : { ok: false, text: 'No ice in your creel: fish start to lose their freshness after half a day.', act: { label: `Ice: ${money(ICE.price)}`, run: () => buyIce() } });
  if (needsMode() !== 'off' && state.comfort) {
    const c = state.comfort;
    out.push(c.bottle >= BOTTLE ? { ok: true, text: `Your water bottle is full (${BOTTLE} drinks).` } : { ok: false, text: `Your water bottle has ${c.bottle} of ${BOTTLE} drinks.`, act: { label: 'Fill it here', run: () => fillBottle() } });
    out.push(c.rolls >= 2 ? { ok: true, text: `${c.rolls} rolls in your backpack.` } : { ok: false, text: c.rolls ? 'Only one roll in your backpack.' : 'No rolls in your backpack for later.', act: { label: 'Pack some', run: () => takeRolls() } });
  }
  const worn = state.gear.pack.rods.filter((id) => wearOf(state, id) >= 0.6);
  out.push(worn.length ? { ok: false, text: `Frayed line on your ${worn.map((id) => RODS[id].short.toLowerCase()).join(' and ')}.`, act: { label: 'Mending', run: () => { harbourSheet.tab = 'mend'; } } } : { ok: true, text: 'Your lines are sound.' });
  const v = state.vessel;
  if (isPetrol(v) && BOATS[v]) {
    const low = fuelLow(tanks(), v);
    out.push({ ok: !low, text: `${boatTitle(BOATS[v])}: ${tankWords(tanks(), v)}${low ? '. Fill up at the fuel point on the pontoon, or the pump by the quay.' : '.'}` });
  }
  out.push(freshBaitToday(state) ? { ok: true, text: 'Fresh bait for today.' } : { ok: true, text: 'No fresh bait today (a help with worms and crab, never a need).' });
  const storm = Math.max(weather.storm, conditions.sea.storm);
  out.push({ ok: storm < 0.4, text: storm >= 0.4 ? 'A storm is blowing: stay in the bay and the sheltered water today.' : weatherLines(weather.rain > 0.6 ? 'Heavy rain' : weather.rain > 0.15 ? 'Light rain' : weather.cloud > 0.7 ? 'Overcast' : weather.cloud > 0.3 ? 'Some cloud' : 'Clear')[0] });
  const a = whatsAbout(eco, { max: 1 })[0];
  out.push(a ? { ok: true, text: `${a.sp.name}: ${a.act > 0.85 ? 'busy' : 'about'} ${a.where}${a.how ? `; try ${a.how}` : ''}.`, act: { label: 'Plan a trip', run: () => { closeHarbour(); openGuide(); } } } : { ok: true, text: 'Little is feeding near the harbour this hour. Dawn and dusk are usually better.', act: { label: 'Plan a trip', run: () => { closeHarbour(); openGuide(); } } });
  return out;
}
function buyIce() {
  const now = state.day * 24 + state.hour;
  state.shop ??= { creel: 0, iceUntil: 0, baitDay: 0, wear: {} };
  if (state.shop.iceUntil > now + 12) return;
  if (state.money < ICE.price) {
    hud.toast(`Ice is ${money(ICE.price)}, and your purse has ${money(state.money)}. Sell a fish or two at the market first.`, 5);
    return;
  }
  state.money = Math.round((state.money - ICE.price) * 100) / 100;
  state.shop.iceUntil = now + ICE.hours;
  hud.toast('Bert shovels crushed ice into a bag and packs it into your creel. Your fish keep fresh for a day.', 5);
  save();
}

// The market's slate on the quay: chalked up afresh each morning.
let slateDay = -1;
// The game hour the creel's fish were last kept cold up to (see shop.js chill).
let chilledTo = state.day * 24 + state.hour;
function chalkSlate() {
  slateDay = state.day;
  const D = demandFor(state.day, 'haven');
  world.coast.paintSlate((ctx, w, h) => paintSlate(ctx, w, h, { day: state.day, wanted: D.wanted.map((id) => fishById[id].name), plenty: D.plenty.map((id) => fishById[id].name) }));
}
const innNear = () => onFoot && world.coast.spots.some((q) => q.kind === 'door' && q.id === 'inn' && Math.hypot(walker.pos.x - q.x, walker.pos.z - q.z) < q.r + 0.4);

let sleeping = null;
function sleepUntil(h) {
  if (sleeping) return;
  if (fishing.state === 'reeling' || fishing.state === 'landing' || fishing.state === 'caught' || fishing.state === 'keeping') {
    hud.toast('Land or let go of the fish first.', 3);
    return;
  }
  // Aboard the cabin boat: not adrift.
  if (camp.site === 'cabin' && !boat.anchored && !moored(boat)) {
    hud.toast(`Drop the anchor first (${input.keyLabel('anchor')}), or tie up alongside a quay: nobody sleeps adrift.`, 4);
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
  if (stepOf(state.guide) === 'back') guideEvent('back');
}

// Halfway through the fade: move the world on.
function passTheNight() {
  const h = sleeping.h;
  let hours = h - state.hour;
  if (hours <= 0.5) hours += 24;
  if (state.hour + hours >= 24) state.day++;
  state.hour = h;
  camp.update(0, hours, true);
  // You wake warm and dry, and fill your water bottle before you set off.
  if (needsMode() !== 'off') {
    stepComfort(state.comfort, hours, { asleep: true });
    refill(state.comfort);
  }
  // The weather turns while you sleep (unless you've chosen it): sometimes you wake to rain.
  if (skyMode() === 'auto') {
    weather.state = pick(Math.random() < 0.3 ? ['light', 'heavy', 'overcast'] : ['clear', 'partly', 'partly', 'overcast']);
    weather.storm = 0;
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
  // (Overnight, the bass boat's battery charges wherever you sleep.)
  tanks().battery = 1;
  tanks().kayak = 1;
  const door = sleeping.site === 'house' ? { x: 113.6, z: -78.6 } : sleeping.site === 'bothy' ? BOTHY_DOOR : sleeping.site === 'posada' ? { x: POSADA.x - 2, z: POSADA.z + 5 } : sleeping.site && sleeping.site !== 'cabin' ? toWorld(sleeping.site.x, sleeping.site.z, sleeping.site.yaw, 0.6, 1.6) : null;
  const spot = door ? standNear(door.x, door.z, 0.3) : onFoot && walkHeight(walker.pos.x, walker.pos.z) < 0.1 ? campSpot() : null;
  if (spot && onFoot) {
    walker.place(spot.x, spot.z, spot.heading);
    rig.reset(walker, t);
  }
  save();
}

function wakeLine(h, rain, site = null) {
  // Aboard the cabin boat: the water round the hull.
  if (site === 'cabin') {
    if (rain) return 'You wake to rain drumming on the cabin roof and the boat nodding on her rope. Kettle on the stove.';
    if (h < 7) return 'You wake to water lapping at the hull and a grey light in the cabin windows. The gulls are up already.';
    if (h < 16) return 'You wake in the bunk with the boat turning gently on her rope. A good day on the water.';
    if (h < 20) return 'You wake to evening light on the water through the cabin windows. Time for a cast at dusk.';
    return 'You wake in the dark cabin: stars over the water, and the tide talking under the hull.';
  }
  // In the bothy: the stone walls, the river below, the fell outside.
  if (site === 'bothy') {
    if (rain) return 'You wake to rain blowing against the bothy’s little window and Spout Force roaring below. The stove first.';
    if (h < 7) return 'You wake in the grey before dawn to the sound of the falls. Frost on the inside of the window.';
    if (h < 11) return 'Morning on the fell: sun on the crags above, and mist lifting off Spout Pool.';
    if (h < 16) return 'You wake to a bright afternoon, the fell warm and the beck chattering past the door.';
    if (h < 20) return 'You wake as the light goes gold on the top of Hoarfell. The trout will be rising in the pools.';
    return 'You wake in the dark: the last of the stove’s glow, and stars thick over the fell.';
  }
  // Over the bar at Puerto Brasa: the harbour, the trade wind, the island waking up.
  if (site === 'posada') {
    if (rain) return 'You wake to a rare shower rattling on the harbour, the volcano lost in cloud. It won’t last.';
    if (h < 7) return 'You wake before dawn to the fishing boats putting out, their engines puttering past the breakwater.';
    if (h < 11) return 'Morning over the harbour: bright sun on white walls, the smell of coffee from the bar below.';
    if (h < 16) return 'You wake to the heat of the afternoon and the trade wind rattling the palms in the square.';
    if (h < 20) return 'You wake as the light goes gold on Pico Brasa. The bar is filling up; the parrotfish will be heading for their holes.';
    return 'You wake in the warm dark: the green harbour light flashing, the lighthouse turning out on the point.';
  }
  // At home: your own bed, the house waking up around you.
  if (site === 'house') {
    if (rain) return 'You wake to rain on the roof and the gutters chattering. The kettle, then the garage.';
    if (h < 7) return 'You wake early in your own bed. Grey light at the window, and the sea quiet below the garden.';
    if (h < 11) return 'Morning at home: sun across the floorboards, and the bay bright beyond the garden wall.';
    if (h < 16) return 'You wake to a warm afternoon. The garage door is open and the car is on the drive.';
    if (h < 20) return 'You wake as the light turns gold over Shell Strand. Still time for an evening out.';
    return 'You wake in the dark. The house is quiet, and the lighthouse turns far out to sea.';
  }
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
    return { x, z, heading: Math.atan2(land.x - x, land.z - z), pier: true, landing: P === PIERS[1] || P === CALF_LANDING, quay: P === HAVEN_QUAY };
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
  if (cabinIn) leaveCabin(true);
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
  const k = boat.kind, tip = k === 'skiff' ? 'skiff' : k === 'cruiser' ? 'boat-yacht' : `boat-${k}`;
  if (k === 'row' || state.tips[tip]) return;
  state.tips[tip] = true;
  const T = scheme() === 'touch', S = T || scheme() === 'pad', key = (a) => input.keyLabel(a);
  const stick = T ? 'the stick' : 'the left stick';
  const lever = T ? 'push the stick up or down to move the throttle lever a notch (it stays where you leave it), or tap and drag the lever itself (bottom right); across steers, and Stop knocks it into neutral.'
    : S ? `push ${stick} up or down to move the throttle lever a notch (it stays where you leave it), across to steer; ${key('neutral')} stops the motor, ${key('anchor')} drops or raises the anchor.`
      : `${key('forward')} and ${key('back')} move the throttle lever a notch (it stays where you leave it; you can click and drag the lever on screen too), ${key('left')} and ${key('right')} steer, ${key('neutral')} stops the motor, ${key('anchor')} drops or raises the anchor. The motor takes a moment to build up and ease off.`;
  const text = {
    skiff: `The motor skiff, for the open coast and the islands: ${lever} Near a shore, slow down and ${T ? 'tap the prompt' : `press ${key('interact')}`} to step off. It runs on petrol: the harbour pump is at the root of Willowhaven quay.`,
    kayak: `The kayak: slow, but silent and stable enough to fish from, and it floats in a hand's depth of water. Paddle into the shallows, the saltings and the reeds where the boats can't go: fish hardly notice it. ${S ? `${T ? 'The stick' : 'The left stick'} paddles and steers.` : `${key('forward')}${key('left')}${key('back')}${key('right')} paddle and steer.`} It has a little electric motor on its stern too (${T ? 'the Lower motor button' : S ? key('motor') : key('motor')}): slower than paddling, but quiet and hands-free, for creeping up on fish or trolling a lure. Its battery charges at a jetty and overnight.`,
    bass: `The bass boat: ${lever} The first notches of throttle run the quiet electric motor at the bow, for creeping along the weed beds and the reeds without spooking anything; push on for the outboard to cross the lake fast. Its locker holds your tackle box, and it sits steady when you cast. The outboard takes petrol (Longmere has no pump: bring the jerry can), and the electric motor a battery that charges at the jetty and overnight.`,
    windsurf: `The windsurf board: you sail it standing up. ${T ? 'The stick up sheets the sail in and down eases it out; across steers (you lean the rig)' : S ? `${stick} up and down sheets in and out, across steers (you lean the rig)` : `${key('forward')} sheets in, ${key('back')} eases out, ${key('left')} and ${key('right')} steer (you lean the rig)`}. Like the sailing boat it goes where the wind lets it, and the panel shows how the sail is drawing; in a good breeze (from about 25 km/h) it climbs up onto the plane and flies. Hang on to too much power for too long (hauled in hard in a gust) and you're catapulted in: ease out in the gusts. You climb back on in a moment. Sail trim: Helped (Settings) trims it for you. No fishing from it, and no anchor: tie up at a pontoon or step ashore.`,
    console: `The centre-console boat: twin outboards, fast (about twenty-seven knots flat out), and open all round. You drive it standing at the console, under the T-top: ${lever} To fish, cast as from any boat: you step back into the cockpit (or up into the bow, if that's the way you're facing) and turn to face your line. It runs on petrol: the fuel point is on Willowhaven's pontoon, by its berth.`,
    jetski: `The jet ski: very quick (over thirty knots flat out). ${lever} It steers by its jet, so it only turns with the throttle on. At speed it leaves the wave crests and lands with a smack, throwing a plume of spray behind it: hold on. It runs on petrol (the fuel point is on Willowhaven's pontoon, beside its berth). No fishing from it.`,
    cruiser: `The sport-fishing yacht: twin diesels, a cabin forward (bunks and a galley), and an open cockpit aft to fish from. You stand at the wheel: ${lever} She's quick once she's going (about twenty knots) but slow to turn at speed, so give her room; slow, her twin screws bring her round handily. To fish, cast as from any boat: you step back into the cockpit and turn to face your line, so you can cast off the stern or either side, and fight a fish wherever it runs. Tie up at a quay or a pontoon, or anchor, then ${T ? 'tap the prompt' : `press ${key('interact')}`} for the cabin: cook, and sleep aboard. She can make the long passage south under power too: four days to Las Brasas, and it takes half her tank (${T ? 'tap the prompt' : key('interact')} out on open water, or beside her at her berth). The fuel point is on Willowhaven's pontoon, by her berth.`,
    cabin: `The cabin boat: slow and steady, with a little cabin forward: a bunk and a galley stove. ${lever} Anchor (or tie up alongside a quay), then ${T ? 'tap the prompt' : `press ${key('interact')}`} for the cabin: cook what you've kept, and sleep aboard. A camp that floats. It runs on petrol: the harbour pump is right by her berth.`,
    sail: `The sailing boat: she goes where the wind lets her. ${T ? 'Raise the sail on the panel' : `Raise the sail (${key('motor')})`}, then ${T ? 'the stick up hauls the mainsheet in and down eases it; across steers' : S ? `${stick} up and down hauls the mainsheet in and eases it, across steers` : `${key('forward')} hauls the mainsheet in, ${key('back')} eases it, ${key('left')} and ${key('right')} steer`}. Watch the sail and the panel: if it flaps (luffing), haul in; if she's slow and heeling with the sail in tight across the wind, ease it out. Nothing drives her within about forty degrees of the wind (in irons): to go upwind, zigzag, tacking through the wind with speed on. The white lines in the air show the wind. With the sail down, she rows. She can make the long passage south, too: four days to Las Brasas, a volcanic island in the trade wind (${T ? 'tap the prompt' : key('interact')} out on open water, or beside her at the quay).`,
  }[k];
  hud.toast(text, 12);
}

// Drop the anchor (where the water's right for it: the depth under the bow), or haul it in.
function toggleAnchor() {
  if (onFoot || cabinIn) return;
  if (boat.anchored) {
    if (boat.anchor?.phase === 'haul') return;
    if (fishing.state === 'reeling' || fishing.state === 'landing') {
      hud.flash('Land or let go of the fish first', t, 2);
      return;
    }
    boat.setAnchor(false);
    audio.knock(0.3);
    hud.flash('Hauling in the anchor…', t, 3);
    return;
  }
  const c = anchorCheck(boat);
  if (!c.ok) {
    hud.flash(c.why, t, 4);
    return;
  }
  boat.setAnchor(true);
  audio.plop(1.2);
  audio.knock(0.35);
  hud.flash(`The anchor goes down: ${c.depth < 10 ? c.depth.toFixed(1) : Math.round(c.depth)} m of water…`, t, 3);
  save();
}
// What the anchor does as it goes: it bites on the bottom, and comes up again.
for (const b of boats) {
  b.onAnchor = (what, who) => {
    if (who !== boat || onFoot) return;
    if (what === 'set') hud.flash('The anchor’s holding: she’ll lie back on her rope, head to the wind and tide', t, 4);
    else {
      audio.knock(0.4);
      audio.plop(0.6);
      hud.flash('Anchor up: she’s free to go', t, 2.4);
      save();
    }
  };
}

/* ---------------- tying up, and towing ---------------- */

// Tie up alongside the pier she's beside (where there's a berth for her), or cast off again.
function tieUp(B = berthFor(boat, boats)) {
  if (!B || onFoot) return;
  boat.tieTo(B);
  audio.knock(0.45);
  const T = scheme() === 'touch';
  hud.flash(`Tied up alongside, fenders out: she’ll stay here. ${T ? 'Tap Step ashore when you’re ready, or Cast off to go' : `${K('interact')} steps ashore, ${K('anchor')} casts off`}.`, t, 4.5);
  save();
}
function castOff() {
  const c = castOffCheck(boat, boats);
  if (!c.ok) {
    hud.flash(c.why, t, 4);
    return;
  }
  boat.castOff(c.nx, c.nz);
  audio.knock(0.35);
  hud.flash('Cast off: lines in, fenders up, and she drifts clear of the pier', t, 2.6);
  save();
}

// One boat towing another: a line from your stern to her bow. She follows where you go, and
// stays wherever you let her go.
let tow = null; // { lead, towed, tight }
const towRope = new Rope(scene, { segments: 12, radius: 0.013 });
function takeInTow(other) {
  const c = canTow(boat, other);
  if (!c.ok) {
    hud.flash(c.why, t, 3.5);
    return;
  }
  tow = { lead: boat, towed: other, tight: 0 };
  audio.knock(0.35);
  hud.flash(`The ${other.name} is on a towline from your stern, and follows where you go. ${scheme() === 'touch' ? 'Let go the tow' : `${K('anchor')} lets her go`} whenever you like: she stays where she is.`, t, 5);
  save();
}
function letGoTow(quiet = false) {
  if (!tow) return;
  const name = tow.towed.name;
  tow = null;
  towRope.hide();
  if (quiet) return;
  audio.knock(0.25);
  hud.flash(`You let the ${name} go: she lies where she is (anchor her or tie her up, or come back for her)`, t, 3.5);
  save();
}
const _ts = new THREE.Vector3(), _tb = new THREE.Vector3();
function updateTow(dt) {
  if (!tow) return;
  const { lead, towed } = tow;
  // (Anything that parts them, a journey by map, say, or one of them made fast, lets the tow go.)
  if (Math.hypot(lead.pos.x - towed.pos.x, lead.pos.z - towed.pos.z) > 30 || towed.tie || towed.anchored) {
    letGoTow(true);
    return;
  }
  tow.tight = towStep(lead, towed, dt);
  lead.body.localToWorld(_ts.copy(lead.cleats[1]));
  towed.body.localToWorld(_tb.copy(towed.cleats[0]));
  towRope.lay(_ts, _tb, { tension: tow.tight, sag: 0.9 });
}
// (A tow kept from last time, if the two boats are still together.)
{
  const T = state.tow, L = T && BOATS[T.lead], W = T && BOATS[T.towed];
  if (L && W && L !== W && !W.tie && !W.anchored && Math.hypot(L.pos.x - W.pos.x, L.pos.z - W.pos.z) < TOW.len * 3) tow = { lead: L, towed: W, tight: 0 };
}

// The mooring prompt (the anchor key, X on a controller, or a tap): what holding her still means
// here and now. Tied up: cast off. Beside a pier: tie up. Towing: let the tow go. Out on the
// water: the anchor, down or up.
function mooringAction() {
  if (!started || modal || onFoot || driving || cabinIn || placement.isOn) return null;
  if (boat.tie) return { text: 'Cast off', run: castOff };
  if (fishing.state === 'reeling' || fishing.state === 'landing') return null;
  if (!boat.anchored && boat.speed < 0.9) {
    const B = berthFor(boat, boats);
    if (B) return { text: 'Tie up alongside', run: () => tieUp(B) };
  }
  if (tow && (tow.lead === boat || tow.towed === boat)) return { text: `Let go the tow (the ${tow.lead === boat ? tow.towed.name : tow.lead.name})`, run: () => letGoTow() };
  if (boat.anchored) return boat.anchor?.phase === 'haul' ? { text: 'Hauling in the anchor…', run: () => {}, busy: true } : { text: 'Raise the anchor', run: toggleAnchor };
  if (boat.speed < 1) return { text: 'Drop the anchor', run: toggleAnchor };
  return null;
}

function setFoot(foot, silent = false) {
  // (Anything that puts you ashore, or in another boat, takes you out of the cabin first.)
  if (cabinIn) leaveCabin(true);
  onFoot = foot;
  walker.setVisible(foot);
  boat.setRower(!foot);
  fishing.setAngler(foot ? walker : boat);
  rig.setHome(foot, t);
  finder.reset();
  if (!silent) save();
}

function stepAshore(spot) {
  // At a jetty or quay you make her fast before you step off (out on a bank she's left as she is:
  // anchored, or pulled up and drifting nowhere).
  let tied = false;
  if (spot.pier && !boat.tie && !boat.anchored) {
    const B = berthFor(boat, boats, { reach: 5 });
    if (B) {
      boat.tieTo(B);
      tied = true;
    }
  }
  if (tied) hud.flash(`You make her fast alongside and step ashore (${scheme() === 'touch' ? 'Cast off' : K('anchor')} from aboard to go again)`, t, 3.5);
  walker.place(spot.x, spot.z, spot.heading);
  setFoot(true);
  audio.step(false);
  audio.knock(0.4);
  hud.chip(scheme() === 'touch'
    ? '<b>On foot</b> · the stick walks · tap the prompt by the boat to get back in'
    : `<b>On foot</b> · ${MOVE()} walk · ${K('jog')} jog · ${K('interact')} by the boat to get back in`, 6);
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

/* ---------------- diving (the rules are in dive.js, the swimmer in diver.js) ---------------- */

// Over the side of a stopped boat, or in off a jetty, the rocks or a steep beach: freediving on
// one breath with the speargun, or on scuba with the camera. While you're in the water you're
// out of the boat (onFoot, your figure put away) and the diver is you: where you look is where
// you swim. Back at the surface, climb aboard, up onto a jetty, or wade ashore.
const diver = new Diver(scene);
const shot = new Shot(scene, new Rope(scene, { segments: 10, radius: 0.0035, color: '#e9e4d6' }));
const fpGun = buildGun();
fpGun.scale.setScalar(0.85);
fpGun.visible = false;
scene.add(fpGun);
const diveIn = { fwd: 0, up: 0, kick: false, dir: new THREE.Vector3(0, 0, 1) };
const diverCtx = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, speed: 0, kicking: false, still: 0 };
const _dFrom = new THREE.Vector3(), _dDir = new THREE.Vector3(), _dAim = new THREE.Vector3(), _dMuz = new THREE.Vector3(), _dEye = new THREE.Vector3();
const diveVeil = $('dive-veil');
let aim = null; // what's in the sights: { sp, size, dist, ok, why, known }
let aimT = 0;

// Where you could go in from here, if anywhere: deep water beside a stopped boat, or within a
// stride or two of where you stand ashore (off a jetty, a quay, the rocks, a steep beach).
let diveSpotCache = { t: -1, spot: null };
function diveEntry() {
  if (t - diveSpotCache.t < 0.3) return diveSpotCache.spot;
  let spot = null;
  if (!onFoot) {
    if (boat.speed < 0.6) {
      const off = boat.hull.B * 0.5 + 0.7;
      for (const s of [1, -1]) {
        const x = boat.pos.x + boat.right.x * off * s, z = boat.pos.z + boat.right.z * off * s;
        if (depthAt(x, z) > 1.6) {
          spot = { x, z, heading: boat.heading, from: 'boat' };
          break;
        }
      }
    }
  } else if (!driving && !insideHome(walker.pos.x, walker.pos.z)) {
    for (let r = 1.2; r <= 3.2 && !spot; r += 1) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, x = walker.pos.x + Math.sin(a) * r, z = walker.pos.z + Math.cos(a) * r;
        // (Deep enough, and not a leap down off a cliff to it.)
        const d = depthAt(x, z);
        if (d > 1.4 && walker.pos.y - waterLevel(x, z) < 3 && (!spot || d > spot.d)) spot = { x, z, d, heading: a, from: 'shore' };
      }
    }
  }
  diveSpotCache = { t, spot };
  return spot;
}

// Which way in: the speargun on a breath, or the camera on a tank.
function chooseDive(entry) {
  const tank = state.dive.tank;
  const drift = entry.from === 'boat' && !boat.anchored && !boat.tie;
  const fresh = waterOf(zoneAt(entry.x, entry.z)) === 'fresh';
  const buttons = [];
  if (drift) buttons.push({ text: 'Drop the anchor first', cls: 'quiet', run: () => toggleAnchor() });
  buttons.push(tank > SCUBA.reserve
    ? { text: `Scuba, with the camera (${Math.round(tank)} bar)`, cls: 'quiet', run: () => startDive('scuba', entry) }
    : { text: 'Scuba: the tank needs filling', cls: 'quiet', run: () => hud.flash('The tank’s nearly empty: the chandlery in Willowhaven fills it.', t, 3.5) });
  buttons.push({ text: fresh ? 'Freedive, to look' : 'Freedive, with the speargun', run: () => startDive('free', entry) });
  ask('Go diving', `${drift ? `The ${boat.name} isn’t anchored: she’ll drift off while you’re down. ` : ''}${fresh
    ? 'Fresh water: a breath-hold dive or a tank, to look (spearfishing isn’t allowed in fresh water).'
    : 'Hold your breath and take the speargun, or dive on a tank with the camera, to look and take photographs (spearfishing on scuba is banned).'}`, buttons);
}

function startDive(kit, entry) {
  if (dive) return;
  if (fishing.busy) fishing.cancel();
  if (entry.from === 'boat') {
    walker.place(entry.x, entry.z, entry.heading);
    setFoot(true, true);
  }
  const back = entry.from === 'shore' ? { x: walker.pos.x, z: walker.pos.z, heading: walker.heading } : null;
  walker.setVisible(false);
  diver.enter(kit, entry.x, waveHeight(entry.x, entry.z, t) - 0.3, entry.z, entry.heading);
  dive = {
    kit, from: entry.from, boat: entry.from === 'boat' ? boat : null, back, t: 0,
    o2: 1, hold: 0, longest: 0, maxDepth: 0, lastY: diver.pos.y, rate: 0, breathT: 1.5, blackT: 0,
    stop: { need: false, left: SCUBA.stopFor, done: false, said: false },
    said: {}, fastT: 0, catches: [], fresh: waterOf(zoneAt(entry.x, entry.z)) === 'fresh',
  };
  shot.reset();
  rig.setDive(diver, kit === 'free', t);
  fx.splash(entry.x, 0.05, entry.z, 14, 1.8, 0.8);
  audio.splashBig();
  state.dive.dives++;
  document.body.classList.add('diving');
  const T = scheme() === 'touch', P = scheme() === 'pad';
  hud.chip(T
    ? '<b>Diving</b> · the stick swims where you look · drag to look · ▲ ▼ up and down'
    : P ? `<b>Diving</b> · ${kbd('L-stick')} swim where you look · ${kbd('R-stick')} look · ${K('interact')} up · ${K('tackle')} down`
      : `<b>Diving</b> · ${K('forward')}${K('back')} swim where you look · ${K('left')}${K('right')} turn · drag to look · ${K('interact')} up · ${K('tackle')} down`, 7);
  if (kit === 'free') {
    teach('freedive', `Freediving: one breath. The gauge shows it running down, and the mark on it is when to turn for the surface. Swim slowly to make it last; ${T ? 'the action button' : K('cast')} fires the speargun. Aim just behind the head. At the surface, breathe up before the next dive.`, 10);
  } else {
    teach('scuba', `Scuba: your air goes faster the deeper you are. Head up at ${SCUBA.reserve} bar, not too fast (the computer warns you), and after a dive below ${SCUBA.stopFrom} m stop for a moment at five metres. ${T ? 'The action button' : K('cast')} takes a photograph.`, 10);
  }
  save();
}

// Out of the water: aboard a boat alongside, up onto a jetty, or ashore. With nowhere given
// (travelling off, or a save), back where you went in.
function endDive(to = null, quiet = false) {
  if (!dive) return;
  const d = dive;
  if (shot.fish && !shot.fish.gone) eco.lostHooked(shot.fish.agent);
  shot.reset();
  aim = null;
  diver.leave();
  fpGun.visible = false;
  dive = null;
  document.body.classList.remove('diving');
  rig.setDive(null, false, t);
  const S = state.dive;
  S.deepest = Math.max(S.deepest, Math.round(d.maxDepth * 10) / 10);
  const back = to || (d.boat ? { boat: d.boat } : { spot: d.back });
  if (back.boat) board(back.boat);
  else {
    walker.place(back.spot.x, back.spot.z, back.spot.heading ?? walker.heading);
    setFoot(true, true);
    walker.setVisible(true);
  }
  if (!quiet) {
    const mins = Math.max(1, Math.round(d.t / 60));
    const fish = d.catches.length ? ` · ${d.catches.join(', ')}` : '';
    hud.toast(`${d.kit === 'free' ? 'Freedive' : 'Scuba dive'}: ${mins} min in the water, down to ${d.maxDepth.toFixed(1)} m${d.kit === 'free' && d.longest > 5 ? `, longest breath-hold ${Math.round(d.longest)} s` : ''}${d.kit === 'scuba' ? `, ${Math.round(S.tank)} bar left` : ''}${fish}.`, 6);
  }
  save();
}

// At the surface: what's there to climb out onto.
function diveExit() {
  if (!dive || dive.blackT > 0 || !diver.atSurface(t)) return null;
  const P = diver.pos;
  let best = null, bd = 1.7;
  for (const b of boats) {
    const d = Math.hypot(P.x - b.pos.x, P.z - b.pos.z) - b.hull.L * 0.45;
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  if (best) return { text: `Climb aboard the ${best.name}`, run: () => endDive({ boat: best }) };
  for (const Q of PIERS) {
    const qx = clamp(P.x, Q.x0, Q.x1), qz = clamp(P.z, Q.z0, Q.z1);
    if (Math.hypot(P.x - qx, P.z - qz) > 1.6) continue;
    const long = Q.x1 - Q.x0 > Q.z1 - Q.z0;
    const x = long ? clamp(P.x, Q.x0 + 0.6, Q.x1 - 0.6) : (Q.x0 + Q.x1) / 2, z = long ? (Q.z0 + Q.z1) / 2 : clamp(P.z, Q.z0 + 0.6, Q.z1 - 0.6);
    const land = Q.land || { x: Q.x0, z: (Q.z0 + Q.z1) / 2 };
    return { text: Q === HAVEN_QUAY ? 'Up the ladder onto the quay' : 'Climb out onto the jetty', run: () => endDive({ spot: { x, z, heading: Math.atan2(land.x - x, land.z - z) } }) };
  }
  if (diver.aground || heightAt(P.x, P.z) > -1.4) {
    // Somewhere you can stand: knee deep or drier, the nearest.
    for (let r = 0.6; r <= 7; r += 0.6) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r;
        const h = walkHeight(x, z);
        if (h > -0.45 && h < 3) return { text: 'Stand up and wade ashore', run: () => endDive({ spot: { x, z, heading: a } }) };
      }
    }
  }
  return null;
}

// Each frame in the water (not while a panel's open: the dive waits for you).
function updateDive(dt) {
  const d = dive, D = diver;
  if (d.blackT > 0) {
    // Blacked out: carried up, and you come to at the surface.
    d.blackT -= dt;
    diveIn.fwd = 0;
    diveIn.up = 1;
    diveIn.kick = false;
  }
  camera.getWorldDirection(diveIn.dir);
  // (Out of air: up you go, steadily.)
  if (d.kit === 'scuba' && state.dive.tank <= 0 && !D.atSurface(t)) diveIn.up = Math.max(diveIn.up, 0.8);
  D.update(dt, t, diveIn, boats);
  // (Blacked out, you're carried up while it's dark, and come to at the surface.)
  if (d.black) {
    D.pos.y += (D.surfaceAt(t) - D.pos.y) * (1 - Math.exp(-2.2 * dt));
    if (d.blackT <= 0) {
      d.black = false;
      D.pos.y = D.surfaceAt(t);
      D.vel.set(0, 0, 0);
    }
  }
  d.t += dt;
  const depth = D.depth, surf = D.atSurface(t);
  d.maxDepth = Math.max(d.maxDepth, depth);
  d.rate = damp(d.rate, (D.pos.y - d.lastY) / Math.max(dt, 1e-3), 3, dt);
  d.lastY = D.pos.y;
  if (d.kit === 'free') freediveStep(dt, depth, surf);
  else scubaStep(dt, depth, surf);
  // (The fish reckon heights from their own water's surface.)
  Object.assign(diverCtx, { x: D.pos.x, y: D.pos.y - waterLevel(D.pos.x, D.pos.z), z: D.pos.z, vx: D.vel.x, vy: D.vel.y, vz: D.vel.z, speed: D.speed, kicking: D.kicking, still: D.still });
  // (Where "you" are, for the markers, the map and the places you pass.)
  walker.pos.set(D.pos.x, Math.max(D.pos.y, 0), D.pos.z);
  if (d.kit === 'free') gunStep(dt);
  // Finning along the surface leaves rings; under it, a few bubbles now and then.
  if (surf && D.speed > 0.3 && Math.random() < dt * 4) fx.ripple(D.pos.x - D.vel.x * 0.4, D.pos.z - D.vel.z * 0.4, 0.5, 1.2, 0.25);
  if (!surf && d.kit === 'free' && Math.random() < dt * 0.4) underwater.bubbles(D.pos.x, D.pos.y + 0.1, D.pos.z, 2, 0.05);
  // The view through the mask darkens at the edges as the breath runs low; a blackout goes dark.
  const low = d.kit === 'free' && !surf ? clamp((BREATH.low - d.o2) / BREATH.low, 0, 1) : 0;
  diveVeil.style.setProperty('--low', low.toFixed(3));
  diveVeil.style.setProperty('--black', clamp(d.blackT > 0 ? Math.min(1, d.blackT) : 0, 0, 1).toFixed(3));
  audio.heart?.(low);
}

function freediveStep(dt, depth, surf) {
  const d = dive;
  if (surf) {
    if (d.hold > 2.5) {
      d.longest = Math.max(d.longest, d.hold);
      state.dive.longest = Math.max(state.dive.longest, Math.round(d.hold));
      if (d.blackT <= 0) audio.gasp?.(clamp(1 - d.o2, 0.2, 1));
    }
    d.hold = 0;
    d.said.turn = d.said.low = false;
    d.o2 = Math.min(1, d.o2 + recoverRate() * comfortFx.breath * dt);
    return;
  }
  d.hold += dt;
  if (d.blackT > 0) return;
  d.o2 -= breathUse(Math.abs(diveIn.fwd), diver.kicking) * dt;
  if (depth > 1.5 && d.o2 < breathToSurface(depth) && !d.said.turn) {
    d.said.turn = true;
    hud.flash('Your breath is at the turn mark: head up now', t, 2.6);
  }
  if (d.o2 < BREATH.low && !d.said.low) {
    d.said.low = true;
    hud.flash('Your chest is tight and the edges are going dark: up, now!', t, 2.4);
  }
  if (d.o2 <= 0) blackout();
}

// Ran out of breath: everything goes dark, and you come to at the surface. (In real life, a
// blackout underwater drowns you unless someone's there: freedivers never dive alone, and
// always turn for the surface with breath to spare.)
function blackout() {
  const d = dive;
  d.o2 = 0.3;
  d.blackT = 3.2;
  d.black = true;
  state.dive.blackouts++;
  if (shot.fish && !shot.fish.gone) {
    shot.fish.gone = true;
    eco.lostHooked(shot.fish.agent);
  }
  hud.toast('You blacked out. In real life that’s how freedivers drown: never dive alone, and always turn for the surface with breath to spare. Here, you come to at the surface, coughing.', 10);
  save();
}

function scubaStep(dt, depth, surf) {
  const d = dive, S = state.dive;
  const before = S.tank;
  // (At the surface you breathe through the snorkel, saving the tank.)
  if (!surf && S.tank > 0) S.tank = Math.max(0, S.tank - airUse(depth, Math.abs(diveIn.fwd), diver.kicking) * dt);
  // A breath every few seconds: the regulator hisses, and out goes a stream of bubbles.
  d.breathT -= dt;
  if (!surf && S.tank > 0 && d.breathT <= 0) {
    d.breathT = 4.2 - Math.min(1.8, diver.speed);
    audio.regulator?.(1.2);
    _dEye.set(0, 0.18, 0.12);
    diver.head.localToWorld(_dEye);
    setTimeout(() => dive && underwater.bubbles(_dEye.x, _dEye.y, _dEye.z, 7, 0.05), 1300);
  }
  // Coming up too fast.
  d.fastT -= dt;
  if (d.rate > SCUBA.maxAscent && depth > 0.8 && d.fastT <= 0) {
    d.fastT = 2.5;
    audio.beep?.();
    hud.flash('Slow down: you’re coming up too fast', t, 2);
  }
  // The safety stop, after a deeper dive.
  if (d.maxDepth >= SCUBA.stopFrom && !d.stop.done) {
    d.stop.need = true;
    if (depth >= SCUBA.stopAt[0] && depth <= SCUBA.stopAt[1] && Math.abs(d.rate) < 0.25) {
      d.stop.left -= dt;
      if (d.stop.left <= 0) {
        d.stop.done = true;
        hud.flash('Safety stop done: up you go, slowly', t, 2.6);
      }
    }
  }
  if (surf && d.stop.need && !d.stop.done && !d.stop.said) {
    d.stop.said = true;
    hud.toast(`Up without your safety stop. On a real dive that’s how decompression sickness starts: after any dive below ${SCUBA.stopFrom} m, three minutes at five metres before the surface.`, 8);
  }
  if (before > SCUBA.reserve && S.tank <= SCUBA.reserve) hud.flash(`${SCUBA.reserve} bar: time to head up`, t, 3);
  if (before > SCUBA.low && S.tank <= SCUBA.low) hud.flash(`${SCUBA.low} bar: up now, slowly`, t, 3);
  if (before > 0 && S.tank <= 0) hud.toast('Out of air! You rise steadily to the surface, breathing out all the way. (In real life: watch the gauge, and turn at the reserve.)', 8);
}

/* ---- the speargun ---- */

// The shot runs from the gun to the middle of the screen at the gun's sure range: through your
// mask, from just under your eyes; behind you, from the gun's muzzle in your hands.
function aimRay(from, dir) {
  camera.getWorldDirection(_dDir);
  const eye = rig.mode === 'eye';
  _dAim.copy(camera.position).addScaledVector(_dDir, (eye ? 0 : camera.position.distanceTo(diver.pos)) + SPEAR.sure);
  if (eye) from.copy(camera.position).addScaledVector(_dDir, 0.45).add(_dEye.set(0, -0.09, 0).applyQuaternion(camera.quaternion));
  else diver.muzzle(from);
  dir.subVectors(_dAim, from).normalize();
  return _dAim;
}

// The shot stops at the seabed, a rock, the surface, or the end of its line.
function shotLength(from, dir) {
  for (let s = 0.25; s < SPEAR.range; s += 0.2) {
    const x = from.x + dir.x * s, y = from.y + dir.y * s, z = from.z + dir.z * s;
    if (y < solidHeight(x, z) + 0.04 || y > waveHeight(x, z, t)) return s;
  }
  return SPEAR.range;
}

function fireSpear() {
  if (!shot.loaded) {
    hud.flash(shot.state === 'loading' ? 'Loading the bands…' : 'The shaft is still out', t, 1.2);
    return;
  }
  if (dive.blackT > 0) return;
  if (dive.fresh) {
    hud.flash('Spearfishing isn’t allowed in fresh water.', t, 2.5);
    return;
  }
  aimRay(_dFrom, _dDir);
  let end = shotLength(_dFrom, _dDir), fish = null;
  const hit = spearHit(_dFrom, _dDir, end, eco.agents);
  if (hit) {
    const a = hit.agent, ok = canSpear(a.sp, a.size, waterOf(zoneAt(a.x, a.z)));
    // (A fish you shouldn't take: you hold your shot.)
    if (!ok.ok) {
      hud.flash(`You hold your shot. ${ok.why}`, t, 2.6);
      return;
    }
    if (state.keep.length >= creelSize(state)) {
      hud.flash(`Your creel is full (${creelSize(state)} fish): take only what you’ll eat. Cook some at camp first.`, t, 3.2);
      return;
    }
    const q = shotQuality(hit.along);
    end = hit.dist;
    fish = { agent: a, quality: q, tears: Math.random() < tearChance(q, a.sp, a.size), gone: false };
    eco.spear(a);
  }
  shot.fire(_dFrom, _dDir, end, fish);
  audio.spear?.();
  underwater.bubbles(_dFrom.x, _dFrom.y, _dFrom.z, 5, 0.04);
  // The thump of the bands carries: fish close by startle.
  eco.startle(_dFrom.x, _dFrom.y - waterLevel(_dFrom.x, _dFrom.z), _dFrom.z, 2.5, 0.6);
  if (!fish) teach('spearMiss', 'Missed. Get closer (the shaft is only sure at three metres or so), keep still as they come to look, and aim just behind the head.', 7);
}

function gunStep(dt) {
  const fp = rig.eyeBlend > 0.5;
  const target = aimRay(_dFrom, _dDir);
  // The gun you see: in your hands (behind you), or out in front of the mask.
  fpGun.visible = fp;
  if (fp) {
    fpGun.position.copy(camera.position).add(_dEye.set(0.07, -0.19, -0.34).applyQuaternion(camera.quaternion));
    fpGun.lookAt(target);
  }
  if (fp) {
    fpGun.updateMatrixWorld();
    fpGun.localToWorld(_dMuz.set(0, 0.03, 0.9));
  } else diver.muzzle(_dMuz);
  const F = shot.fish; // (read first: landing it hands it over)
  const ev = shot.update(dt, _dMuz);
  fpGun.setLoaded(shot.bandsLoaded);
  diver.gun.setLoaded(shot.bandsLoaded);
  if (F && !F.gone && shot.fish === F && shot.state !== 'flying') {
    // On the shaft: it thrashes, then hangs as it comes in.
    const a = F.agent, w = shot.state === 'back' && shot.t < 0.8 ? Math.sin(t * 22) * 0.5 : Math.sin(t * 8) * 0.15;
    eco.placeHooked(a, shot.tip.x, shot.tip.y, shot.tip.z, Math.atan2(_dDir.x, _dDir.z) + Math.PI / 2 + w, 1);
  }
  if (ev === 'hit') {
    audio.thud?.();
    if (F.quality === 'poor') hud.flash('In the tail: hold on!', t, 1.6);
  } else if (ev === 'tore') {
    eco.lostHooked(F.agent);
    hud.flash('It tore free! Aim just behind the head: a clean shot holds, a tail shot doesn’t.', t, 3.2);
  } else if (ev === 'landed') landSpeared(F.agent);
  // What's in the sights (a few times a second).
  aimT -= dt;
  if (aimT <= 0) {
    aimT = 0.12;
    aim = null;
    if (shot.loaded) {
      const hit = spearHit(_dFrom, _dDir, SPEAR.range + 1.5, eco.agents);
      if (hit) {
        const a = hit.agent, ok = canSpear(a.sp, a.size, waterOf(zoneAt(a.x, a.z)));
        const known = !!(state.fish[a.sp.id] || state.observed?.[a.sp.id]);
        aim = { sp: a.sp, size: a.size, dist: hit.dist, ok: ok.ok, why: ok.why, small: !!ok.small, known, far: hit.dist > SPEAR.sure, quality: shotQuality(hit.along) };
      }
    }
  }
}

// A fish on the shaft, in hand: logged, and onto the stringer (your creel), as a kept fish.
function landSpeared(a) {
  const sp = a.sp, size = a.size;
  const { isNew } = recordCatch(sp, size, a, null, { kind: 'spear', rod: 'speargun', from: 'dive', at: { x: a.x, y: a.y, z: a.z } });
  eco.keep(a);
  state.keep.push({ id: sp.id, size, logId: lastCatchId, at: state.day * 24 + state.hour });
  setOutcome(lastCatchId, 'kept');
  state.dive.speared++;
  dive.catches.push(`${sp.name.toLowerCase()} ${size} cm`);
  hud.flash(`${isNew ? 'A first! ' : ''}${sp.name}, ${size} cm: on the stringer`, t, 3);
  if (isNew) {
    audio.fanfare();
    hud.pulseJournal();
  } else audio.chime();
  teach('speared', `Speared fish go in your creel (it holds ${creelSize(state)}), to cook at camp: a speargun only takes what you keep, so take only what you'll eat.`, 7);
  save();
}

// Space (or the action button): fire the speargun, or take a photograph on scuba.
function diveAction() {
  if (dive.kit === 'free') fireSpear();
  else takePhoto();
}

/* ---------------- the throttle lever, and the kayak's motor ---------------- */

// The lever the boat you're in has (see throttle.js): a motorboat's own, the kayak's with its
// motor down, or none (rowing, paddling, on foot).
const leverKind = () => (onFoot || driving || cabinIn ? null : boat.motor ? boat.kind : boat.hull.emotor && boat.emotorDown ? 'kayak' : null);
// What the lever may do just now: a line out (or a cast being aimed) caps it at trolling speed,
// a fish on at dead slow.
const leverSituation = () => (fishing.state === 'reeling' || fishing.state === 'landing' ? 'fight' : fishing.busy ? 'line' : 'free');
const CAP_WORDS = {
  line: 'With a line out she goes no faster than trolling speed: reel in for more.',
  fight: 'A fish on: dead slow at most, so it’s yours to play.',
};

// Set the lever to a notch (the lever on screen), or move it a notch (keys, stick, D-pad).
// fresh: a new press (held down, the lever pauses in neutral before going on into astern).
function setLever(i) {
  const kind = leverKind();
  if (!kind) return;
  if (boat.tie && levers(kind)[i]?.v !== 0) {
    hud.flash(`Tied up alongside: cast off first (${scheme() === 'touch' ? 'the Cast off prompt' : K('anchor')})`, t, 2.2);
    return;
  }
  if (boat.anchored && levers(kind)[i]?.v > 0) {
    hud.flash(`The anchor is down: raise it first (${K('anchor')})`, t, 2);
    return;
  }
  const r = setIndex(kind, i, leverSituation());
  if (r.capped) hud.flash(CAP_WORDS[leverSituation()], t, 2.6);
  changeLever(r.v);
}
function stepLever(dir, fresh = true) {
  const kind = leverKind();
  if (!kind) return;
  const L = levers(kind), i = nearest(kind, boat.lever);
  if (!fresh && L[i].id === 'N') return;
  if (boat.tie) {
    if (fresh) hud.flash(`Tied up alongside: cast off first (${scheme() === 'touch' ? 'the Cast off prompt' : K('anchor')})`, t, 2.2);
    return;
  }
  if (boat.anchored && dir > 0 && L[i].v >= 0) {
    hud.flash(`The anchor is down: raise it first (${K('anchor')})`, t, 2);
    return;
  }
  const r = step(kind, boat.lever, dir, leverSituation());
  if (r.capped && fresh) hud.flash(CAP_WORDS[leverSituation()], t, 2.6);
  changeLever(r.v);
}
function changeLever(v) {
  if (v === boat.lever) return;
  boat.lever = v;
  audio.tick?.(0.35);
}
function leverNeutral(say = false) {
  if (!leverKind()) return;
  if (boat.lever && say) hud.flash('Neutral: the motor idles, and she coasts on', t, 1.6);
  changeLever(0);
}

// Held forward or back (the keys, or the stick pushed well over): one notch now, and more
// while held, pausing at neutral.
let leverHeld = 0, leverRepeat = 0;
let tieWordT = 0;
function helmInput(raw, dt) {
  const dir = Math.abs(raw) > 0.55 ? Math.sign(raw) : 0;
  if (!dir) {
    leverHeld = 0;
    return;
  }
  if (dir !== leverHeld) {
    leverHeld = dir;
    leverRepeat = 0.45;
    stepLever(dir, true);
    return;
  }
  leverRepeat -= dt;
  if (leverRepeat <= 0) {
    leverRepeat = 0.3;
    stepLever(dir, false);
  }
}

// Casting from a boat under power: if she's going faster than trolling speed, the throttle comes
// back to slow ahead and you aim while she slows (a word says so; the lever goes up again once
// your line's in). Says whether a cast may start.
function easeForCast() {
  const kind = leverKind();
  if (!kind) return false;
  const v = within(kind, boat.lever, 'line');
  if (v !== boat.lever) {
    changeLever(v);
    hud.flash(`Throttle eased back to ${leverWords(kind, v)} for the cast. ${scheme() === 'touch' ? 'The lever' : K('throttleUp')} opens it up again (to trolling speed while your line’s out).`, t, 4);
  }
  return true;
}

// A fish takes while you're under way: you knock the motor out of gear.
let fishWas = 'idle';
function watchHookup() {
  const s = fishing.state;
  if (s === 'reeling' && fishWas !== 'reeling' && leverKind() && boat.lever > 0) {
    changeLever(0);
    const chair = boat.hull.standing?.chair && fishing.rod?.chair;
    hud.flash(chair ? 'Fish on! You knock the engines into neutral and get into the fighting chair' : 'Fish on! You knock the motor into neutral: she coasts while you play it', t, 3.2);
  }
  fishWas = s;
}

// The kayak's electric motor, down or up.
function toggleKayakMotor() {
  if (onFoot || driving || cabinIn || !boat.hull.emotor) return;
  if (fishing.state === 'reeling' || fishing.state === 'landing') {
    hud.flash('Land or let go of the fish first', t, 2);
    return;
  }
  if (boat.emotorDown) {
    boat.setEMotor(false);
    audio.knock(0.25);
    hud.flash(`Motor up: paddle on (${scheme() === 'touch' ? 'the stick' : scheme() === 'pad' ? kbd('L-stick') : MOVE()})`, t, 2.6);
  } else {
    if (tanks().kayak <= 0) {
      hud.flash('The kayak’s battery is flat: it charges at a jetty, and overnight. Paddle for now.', t, 3.5);
      return;
    }
    boat.setEMotor(true);
    state.tips.kayakMotor = true;
    audio.knock(0.25);
    const how = scheme() === 'touch' ? 'the stick up or down (or the lever) moves it a notch' : scheme() === 'pad' ? `${kbd('L-stick')} up or down moves it a notch, ${K('neutral')} stops` : `${K('forward')}${K('back')} move the lever a notch, ${K('neutral')} stops`;
    hud.flash(`Motor down: quiet and slow, hands free for the rod. ${how}.`, t, 4);
  }
  save();
}

// The sailing boat's outboard: down (the sail comes down, and she motors on a throttle lever like
// the skiff's), or up again (she sails or rows). It runs on petrol, from a small tank of its own.
function toggleOutboard() {
  if (onFoot || driving || cabinIn || !boat.hull.outboard) return;
  if (fishing.state === 'reeling' || fishing.state === 'landing') {
    hud.flash('Land or let go of the fish first', t, 2);
    return;
  }
  if (boat.outboardDown) {
    boat.setOutboard(false);
    audio.knock(0.25);
    hud.flash(`Outboard up. ${scheme() === 'touch' ? 'Raise the sail on the panel, or row with the stick.' : `${K('motor')} raises the sail; or row (${MOVE()}).`}`, t, 3);
  } else {
    if (fuelLevel(tanks(), 'sail') <= 0) {
      hud.flash(`The outboard’s tank is dry. ${boat.pos.z > SOUTH_Z ? 'The pump on Puerto Brasa quay fills it' : 'The harbour pump on Willowhaven quay fills it'} (or the jerry can). Sail or row for now.`, t, 4);
      return;
    }
    boat.setOutboard(true);
    audio.knock(0.25);
    const how = scheme() === 'touch' ? 'the stick up or down (or the lever) moves the throttle a notch' : scheme() === 'pad' ? `${kbd('L-stick')} up or down moves the throttle a notch, ${K('neutral')} stops` : `${K('forward')}${K('back')} move the throttle a notch, ${K('neutral')} stops`;
    hud.flash(`Outboard down, the sail down: she motors. ${how}. ${fuelHint('sail')}.`, t, 4.5);
  }
  save();
}

// The sailing boat's sail: up (and drawing, or flapping, as the wind and the sheet have it), or
// down and furled on the boom, so she rows.
function toggleSail() {
  if (onFoot || driving || cabinIn || !boat.hull.sail) return;
  if (fishing.state === 'reeling' || fishing.state === 'landing') {
    hud.flash('Land or let go of the fish first', t, 2);
    return;
  }
  boat.setSail(!boat.sailUp);
  audio.rustle?.();
  if (boat.sailUp) {
    const A = boat.sailing;
    hud.flash(`Sail up. ${settings.controls.sailTrim === 'helped' ? 'The sheet trims itself; steer her, and haul in or ease to take over.' : `Trim the mainsheet (${scheme() === 'touch' ? 'the stick up and down' : `${K('forward')} in, ${K('back')} out`}) until the sail stops flapping.`}`, t, 3.5);
    if (A) boat.sheet = clamp(boat.sheet, 0, 1);
  } else hud.flash(`Sail down: she rows (${scheme() === 'touch' ? 'the stick' : MOVE()}).`, t, 2.6);
  save();
}

// The mainsheet, a little at a time while the key (or stick, or button) is held: in to drive her
// closer to the wind, out to let the sail breathe. On the helped setting it trims itself towards
// the best angle whenever you leave it be.
function sailInput(raw, dt) {
  const ui = sailUI.hold;
  const want = ui || (Math.abs(raw) > 0.2 ? -raw : 0);
  if (want) {
    boat.sheet = clamp(boat.sheet + want * SAIL.sheetRate * dt * (Math.abs(raw) > 0.2 ? Math.abs(raw) : 1), 0, 1);
    sheetTouched = t;
  } else if (settings.controls.sailTrim === 'helped' && boat.sailing && t - sheetTouched > 2.5) {
    let best = bestSheet(boat.sailing.awa);
    // (On a windsurf board in a strong wind it eases out past its best, spilling the gusts.)
    if (boat.hull.rig && boat.sailing.pull > 5.5) best = Math.min(1, best + (boat.sailing.pull - 5.5) * 0.09);
    boat.sheet += clamp(best - boat.sheet, -0.25 * dt, 0.25 * dt);
  }
}
let sheetTouched = -10;

const windLines = new WindLines(scene);
const stormFx = new Storm(scene);
hideFromReflection(stormFx.spray);
// A storm coming in: a word when it starts, and now and then a warning for a small boat caught out
// in the open; spray off her bow as she plunges into the seas.
let stormWas = 0, stormWarnT = 0, lastPitch = 0, slamT = 0;
function watchStorm(dt) {
  const st = conditions.sea.storm;
  if (weather.storm > 0.4 && stormWas <= 0.4 && started) {
    hud.toast('A storm is coming in off the Atlantic: the wind is rising to a gale and big seas are building outside. The bay and the coves stay calmer: a good place to sit it out.', 8);
  }
  stormWas = weather.storm;
  stormWarnT -= dt;
  if (!onFoot && !dive && st > 0.5 && stormWarnT <= 0) {
    const exposed = shelterAt(boat.pos.x, boat.pos.z)[0];
    if (exposed > 0.55 && (boat.kind === 'kayak' || boat.kind === 'row' || boat.kind === 'sail')) {
      stormWarnT = 45;
      hud.flash(boat.kind === 'sail' ? 'Too much wind for full sail out here: ease the sheet right out in the gusts, and run for shelter.' : `The seas are too big for the ${boat.name} out here: head for the shelter of the bay.`, t, 5);
    }
  }
  // Plunging into a sea: the bow drops fast and throws spray.
  slamT -= dt;
  if (!onFoot && st > 0.2 && dt > 0) {
    const rate = (boat.pitch - lastPitch) / dt;
    if (rate > 0.45 && boat.speed > 0.8 && slamT <= 0) {
      slamT = 0.6;
      const H = boat.hull, bx = boat.pos.x + boat.fwd.x * H.L * 0.5, bz = boat.pos.z + boat.fwd.z * H.L * 0.5;
      const w = windAt(bx, bz);
      stormFx.burst(bx, boat.heave + 0.3, bz, w.x * 0.4 + boat.vel.x * 0.5, w.z * 0.4 + boat.vel.z * 0.5, 30, 2.5 + rate * 2);
      audio.splashSmall?.(0.6 + st * 0.4);
    }
  }
  lastPitch = boat.pitch;
}
hideFromReflection(windLines.mesh);
const _wl = new THREE.Vector3();
const sailUI = new SailUI($('sail'), {
  toggle: () => { if (started && !modal) toggleSail(); },
  outboard: () => { if (started && !modal) toggleOutboard(); },
});
function updateSailPanel() {
  // (With the outboard down, the throttle lever takes its place.)
  const show = started && !modal && !hudOff && !placement.isOn && !onFoot && !driving && !cabinIn && !!(boat.hull.sail || boat.hull.rig) && !boat.outboardDown;
  if (!show) {
    sailUI.update({ show: false });
    return;
  }
  const A = boat.sailing, T = scheme() === 'touch', P = scheme() === 'pad';
  // Where the true wind comes from, off her bow (signed: + over the right side).
  const w = windAt(boat.pos.x, boat.pos.z);
  const fromX = -w.x, fromZ = -w.z, f = boat.fwd, r = boat.right;
  const twa = Math.atan2(fromX * r.x + fromZ * r.z, fromX * f.x + fromZ * f.z);
  const up = boat.sailUp && !!A;
  const advice = up ? trimAdvice(A) : null;
  sailUI.update({
    show: true, up: boat.sailUp, sheet: boat.sheet, best: up && A.state !== 'irons' ? bestSheet(A.awa) : null, board: !!boat.hull.rig,
    words: !boat.sailUp ? 'sail down' : boat.fallen > 0 ? 'in the water' : boat.anchored ? 'at anchor' : boat.tie ? 'tied up' : `${advice.words}${boat.planing > 0.6 ? ' · planing' : ''}`,
    knots: Math.max(0, boat.forwardSpeed) * 1.944,
    awa: up ? A.awa * A.side : twa, twa, side: up ? A.side : 1, boom: up ? A.boom : 0,
    keys: T ? '' : boat.hull.rig ? (P ? `${kbd('L-stick')} ↕ sheet` : `${K('forward')} in · ${K('back')} out`) : P ? `${kbd('L-stick')} ↕ sheet · ${K('motor')} sail` : `${K('forward')} in · ${K('back')} out · ${K('motor')} sail ${boat.sailUp ? 'down' : 'up'} · ${K('outboard')} outboard`,
  });
}

const leverUI = new LeverUI($('lever'), {
  set: (i) => { if (started && !modal) setLever(i); },
  stop: () => { if (started && !modal) leverNeutral(true); },
  motor: () => { if (started && !modal) (boat.hull.outboard ? toggleOutboard() : toggleKayakMotor()); },
});

function updateLever() {
  const kind = leverKind();
  const kayak = !onFoot && !driving && !cabinIn && !!boat.hull.emotor;
  const show = started && !modal && !hudOff && !placement.isOn && (!!kind || kayak);
  if (!show) {
    leverUI.update({ show: false });
    return;
  }
  const T = scheme() === 'touch', P = scheme() === 'pad', sit = leverSituation();
  const line = sit !== 'free';
  let keys = '';
  // (With a line out on a controller the D-pad steps it, down through neutral.)
  if (kind && !T) keys = P ? (line ? `${K('throttleUp')} ${K('throttleDown')} a notch` : `${kbd('L-stick')} ↕ a notch · ${K('neutral')} stop`) : `${line ? `${K('throttleUp')}${K('throttleDown')}` : `${K('forward')}${K('back')}`} a notch · ${K('neutral')} stop`;
  if (kayak && !T) keys += `${keys ? ' · ' : ''}${K('motor')} motor`;
  // (The sailing boat's outboard: its own button raises it again.)
  const outboard = kind === 'sail';
  if (outboard && !T) keys += ` · ${K('outboard')} outboard up`;
  const dead = kind && (kind === 'kayak' ? boat.kflat : boat.trolling ? boat.flat : boat.dry);
  leverUI.update({
    show: true, kind, index: kind ? nearest(kind, boat.lever) : 0, power: boat.power, cap: kind ? capIndex(kind, sit) : 0,
    words: !kind ? 'paddling' : boat.anchored ? 'at anchor' : dead ? (kind === 'kayak' ? 'battery flat' : 'motor dead') : cap(leverWords(kind, boat.lever)),
    title: kind === 'kayak' ? 'Kayak motor' : kayak ? 'Kayak' : outboard ? 'Outboard' : 'Throttle',
    motor: kayak ? (boat.emotorDown ? 'down' : 'up') : outboard ? 'outboard' : null, keys,
  });
}

/* ---------------- the cabin boat: inside ---------------- */

// Inside the cabin: where you stand (the doorway, the galley, the bunk), walking between them.
let cabinIn = null;
const _cab = new THREE.Vector3(), _cab2 = new THREE.Vector3();
const canEnterCabin = (b) => !!b.hull.cabin && (b.anchored || !!b.tie || moored(b)) && b.speed < 0.6 && b.anchor?.phase !== 'haul';

function enterCabin(b = boat) {
  if (!canEnterCabin(b)) {
    hud.flash(`She has to be still: drop the anchor (${K('anchor')}), or tie up alongside a quay, then go in`, t, 3);
    return;
  }
  if (fishing.lineOut || fishing.aiming) fishing.cancel();
  // From the quay: aboard first (into the cockpit), and straight on in.
  if (onFoot || boat !== b) board(b);
  changeLever(0);
  // (Alongside but loose: you make her fast, so she can't wander off while you're in.)
  if (!b.anchored && !b.tie) {
    const B = berthFor(b, boats, { reach: 5 });
    if (B) b.tieTo(B);
    else b.setAnchor(true);
  }
  cabinIn = { at: 0, from: 0, k: 1 };
  boat.setRower(false);
  walker.setVisible(true);
  walker.vel.set(0, 0, 0);
  boat.setCabin({ open: 1, roof: rig.mode === 'eye' });
  rig.setCabin(true, t);
  audio.knock(0.3);
  placeInCabin(0);
  hud.chip('<b>The cabin</b>', 2);
  hud.flash(scheme() === 'touch' ? 'In the cabin: the stick walks to the galley and the bunk · tap the prompt to use them (at the doorway, back out on deck)'
    : `In the cabin: ${scheme() === 'pad' ? `${kbd('L-stick')} ↕` : `${K('forward')}${K('back')}`} the galley and the bunk · ${K('interact')} use · ${K('cancel')} back out on deck`, t, 5);
}

function leaveCabin(quiet = false) {
  if (!cabinIn) return;
  cabinIn = null;
  walker.setVisible(false);
  boat.setRower(true);
  boat.setCabin({ open: 0, roof: true });
  rig.setCabin(false, t);
  if (quiet) return;
  audio.knock(0.3);
  hud.flash(moored(boat) ? `Back on deck. ${scheme() === 'touch' ? 'Tap the prompt' : K('interact')} to step ashore` : 'Back out on deck, at the helm', t, 2.4);
  save();
}

// The figure in the cabin, standing at (or walking between) the stations, riding the boat.
function placeInCabin(dt) {
  const S = boat.cabinStations, c = cabinIn;
  if (c.k < 1) c.k = Math.min(1, c.k + dt / 0.7);
  const a = S[c.from], b = S[c.at], k = smoothstep(0, 1, c.k);
  boat.cabinWorld(lerp(a.x, b.x, k), boat.cabinFloor, lerp(a.z, b.z, k), _cab);
  walker.pos.copy(_cab);
  walker.ground = _cab.y;
  const yaw = boat.heading + (c.k < 1 ? Math.atan2(b.x - a.x, b.z - a.z) : b.yaw);
  walker.heading = dampAngle(walker.heading, yaw, 8, dt || 1);
  // (Walking pace, for the stride, while moving between stations.)
  walker.vel.set(c.k < 1 ? Math.sin(walker.heading) * 1.2 : 0, 0, c.k < 1 ? Math.cos(walker.heading) * 1.2 : 0);
  walker.group.position.copy(walker.pos);
  walker.group.rotation.y = walker.heading;
  walker.animate(dt, t);
  walker.group.updateMatrixWorld(true);
  // The view looks into the cabin from above (the roof lifted), or through your eyes.
  boat.cabinWorld(boat.cabinMid.x, boat.cabinFloor + 0.9, boat.cabinMid.z, rig.cabinFocus);
  boat.setCabin({ open: 1, roof: rig.mode === 'eye' });
}

// Forward and back walk between the doorway, the galley and the bunk.
let cabinHeld = 0;
function cabinInput(raw) {
  const dir = Math.abs(raw) > 0.55 ? Math.sign(raw) : 0;
  if (dir && dir !== cabinHeld && cabinIn.k >= 1) {
    const next = Math.max(0, Math.min(boat.cabinStations.length - 1, cabinIn.at + dir));
    if (next !== cabinIn.at) {
      cabinIn.from = cabinIn.at;
      cabinIn.at = next;
      cabinIn.k = 0;
      audio.step?.(false);
    }
  }
  cabinHeld = dir;
}

function cabinAction() {
  const st = boat.cabinStations[cabinIn.at];
  if (cabinIn.k < 1) return null;
  if (st.id === 'galley') return { text: 'The galley: cook and eat', run: () => openCamp('cook', 'cabin') };
  if (st.id === 'bunk') return { text: 'The bunk: sleep', run: () => openCamp('sleep', 'cabin') };
  return { text: moored(boat) ? 'Back out on deck (and ashore)' : 'Back out on deck', run: () => leaveCabin() };
}

/* ---------------- how you feel: warmth, wet clothes, thirst (see comfort.js) ---------------- */

const needsMode = () => settings.controls.needs || 'gentle';
let comfortFx = { pace: 1, shake: 1, breath: 1 };
let lastNeeds = null, dressT = 0;
const needSaid = {}; // need id -> when it was last mentioned (game hours)

// The weather on you just now: the hour, where you are and how high, the wind and sun on you, rain
// and spray, how hard you're working, and a roof over you or a fire beside you.
function comfortEnv() {
  const P = player().pos, w = windAt(P.x, P.z);
  const indoors = driving || !!cabinIn || (modal === 'camp' && camp.house) || modal === 'bench';
  const F = world.camp.firePos;
  let fire = onFoot ? camp.fireLevel * smoothstep(5, 1.5, Math.hypot(P.x - F.x, P.z - F.z)) : 0;
  if (modal === 'camp' && camp.own) fire = Math.max(fire, 0.5);
  const afloat = !onFoot && !driving;
  const rowing = afloat && !boat.motor && !boat.sailUp && boat.speed > 0.6;
  const spray = afloat ? smoothstep(4, 8, boat.speed) * smoothstep(0.2, 1, waveHeightHere(P.x, P.z)) + weather.storm * 0.4 : 0;
  return {
    hour: state.hour, south: conditions.region === 'south', height: onFoot ? Math.max(0, walker.pos.y) : 0,
    cloud: weather.cloud, rain: weather.rain, storm: weather.storm,
    wind: w.speed * (onFoot ? 0.75 : 1), sun: (1 - env.night) * (1 - 0.85 * weather.cloud) * (1 - weather.rain),
    moving: onFoot ? smoothstep(0.4, 4.5, walker.speed) : rowing ? 0.6 : 0,
    shelter: indoors ? 1 : 0, fire, wading: onFoot ? walker.wading : 0, spray: clamp(spray, 0, 1),
  };
}

// Each frame: how you feel moves on with the day and the weather (not while you're under the
// water, asleep or at sea on the long passage), the small effects when a need is very low (on
// Gentle), and the figure: what you're wearing, a shiver, a hand to your brow.
function updateComfort(dt, hours) {
  const c = state.comfort, mode = needsMode(), off = mode === 'off';
  camp.quiet = off;
  if (!off && hours > 0 && !dive && !sleeping && !passage) stepComfort(c, hours, comfortEnv());
  comfortFx = effectsOf(c, state.food, mode);
  walker.speedMul = comfortFx.pace;
  fishing.steady = (camp.wellFed ? 0.8 : 1) * comfortFx.shake;
  const shiver = off ? 0 : smoothstep(9, 4, c.warm), sweat = off ? 0 : smoothstep(28, 32, c.warm);
  walker.cue.shiver = shiver;
  walker.cue.sweat = sweat;
  for (const b of boats) b.shiver = b === boat && !onFoot ? shiver : 0;
  dressT -= dt;
  if (dressT <= 0) {
    dressT = 0.25;
    const wet = off ? 0 : c.wet;
    walker.dress.set(c.wear, wet);
    for (const b of boats) b.dress.set(c.wear, wet);
  }
  if (!off) sayNeeds(c);
}

// A word when you start to feel something (once in a while, not a nag): what it is and what would
// help. (Hunger has its own words: see camp.js.)
function sayNeeds(c) {
  const now = new Set(needsOf(c).map((n) => n.id));
  const prev = lastNeeds;
  lastNeeds = now;
  if (!prev || modal || sleeping || dive || !started) return;
  const abs = state.day * 24 + state.hour;
  for (const id of now) {
    if (prev.has(id) || abs - (needSaid[id] ?? -99) < 3) continue;
    needSaid[id] = abs;
    const first = !state.tips.comfort;
    state.tips.comfort = true;
    const pack = input.keyLabel('pack'), sip = input.keyLabel('drink');
    const tip = {
      chilly: `You’re getting chilly. ${!c.wear.jumper ? `Put your jumper on (the backpack, ${pack})` : !c.wear.hat ? `The woolly hat would help (the backpack, ${pack})` : 'Get out of the wind, or warm up by a fire'}.`,
      cold: 'You’re cold, and your hands are getting clumsy. Layers on (the backpack), out of the wind, or warm up by a fire or indoors.',
      warm: `It’s warm work. ${c.wear.coat ? 'Take the raincoat off' : c.wear.jumper ? 'Take the jumper off' : 'Take it easy a moment'} (the backpack, ${pack}), and have a drink (${sip}).`,
      hot: `You’re too hot: shed a layer, have a drink (${sip}), and take it easy for a bit.`,
      damp: `Your clothes are getting damp.${weather.rain > 0.15 && !c.wear.coat ? ' The raincoat would keep the rain off.' : ''} A fire or a roof dries them, or the sun and wind, slowly.`,
      soaked: 'Soaked through, and the wind feels colder for it. Dry off by a fire or indoors.',
      thirsty: c.bottle ? `You’re thirsty: have a drink from your water bottle (${sip}).` : 'You’re thirsty, and your bottle is empty: fill it at a camp, a kitchen, the chandlery or a clear stream.',
      parched: c.bottle ? `You’re parched, and it’s slowing you down: have a drink (${sip}).` : 'You’re parched, and your bottle is empty: fill it at a camp, a kitchen, the chandlery or a clear stream.',
    }[id];
    if (!tip) continue;
    hud.toast(first ? `${tip} (Your angler feels the day now: cold and heat, wet clothes, thirst and hunger. The words by the clock say how you are, and the backpack has your clothes, water bottle and rolls. Settings → Controls & comfort turns it down or off.)` : tip, first ? 11 : 6);
    break;
  }
}

// A drink from your water bottle.
function takeDrink() {
  const c = state.comfort;
  if (needsMode() === 'off' || dive) return;
  if (!drinkFrom(c)) {
    hud.flash('Your water bottle is empty: fill it at a camp, a kitchen, the chandlery or a clear stream.', t, 3.5);
    return;
  }
  walker.cue.drink = 2;
  hud.flash(`A long drink of water. ${c.bottle ? `${c.bottle} left in the bottle.` : 'That’s the bottle empty.'}`, t, 2.5);
  packUI.render();
  save();
}

// Where your bottle can be filled (and where there's a kitchen to pack rolls from): at a camp or
// a kitchen (home, the bothy, Bar El Muelle, a boat's galley), the chandlery, or a clear stream
// or river beside you.
const kitchenHere = () => (onFoot ? !!(insideHome(walker.pos.x, walker.pos.z) || coastSpot('bothy', 1) || coastSpot('posada', 1) || chandleryNear()) : !driving && !!boat.hull.cabin);
function streamHere() {
  if (!onFoot) return false;
  const P = walker.pos;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = P.x + Math.sin(a) * 1.6, z = P.z + Math.cos(a) * 1.6;
    if (depthAt(x, z) > 0.12 && ['stream', 'river', 'tarn'].includes(zoneAt(x, z))) return true;
  }
  return false;
}
const waterHere = () => kitchenHere() || nearCamp() || !!ownCampNear(4.5) || streamHere();

function fillBottle(quiet = false) {
  refill(state.comfort);
  if (!quiet) hud.flash(`Your water bottle is full (${BOTTLE} drinks), and you drink your fill while you’re at it.`, t, 3);
  packUI.render();
  camp.render();
  save();
}
function takeRolls() {
  const got = packRolls(state.comfort);
  hud.flash(got ? `${got} ${got > 1 ? 'rolls' : 'roll'} wrapped and into your backpack (${ROLLS} in all).` : 'Your backpack has all the rolls it can carry.', t, 3);
  packUI.render();
  camp.render();
  save();
}
function eatARoll() {
  if (!eatRoll(state.comfort, state.food)) return;
  hud.flash(`A roll from your backpack: ${conditions.region === 'south' ? 'bread, cheese and a slice of chorizo' : 'cheese and pickle'}. ${state.comfort.rolls ? `${state.comfort.rolls} left.` : 'That was the last one.'}`, t, 3);
  packUI.render();
  save();
}

// The backpack's clothes, water and food: what you're wearing (and what would suit the weather),
// the bottle and the rolls.
function renderWear(el) {
  const c = state.comfort, off = needsMode() === 'off';
  const mk = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const btn = (text, run, dis = false, pressed = null) => {
    const b = mk('button', 'pk-btn', text);
    b.type = 'button';
    b.disabled = dis;
    if (pressed != null) b.setAttribute('aria-pressed', pressed);
    b.addEventListener('click', run);
    return b;
  };
  const out = [];
  const env2 = comfortEnv(), feel = Math.round(feelsLike(c, env2)), suits = dressFor(c, env2);
  const words = off ? [] : needsOf(c, state.food).map((n) => n.word.toLowerCase());
  out.push(mk('p', 'gx-kit-text', off ? 'Character needs are off (Settings → Controls & comfort): the weather never bothers you.'
    : `${words.length ? `You’re ${words.join(', ')}.` : 'You’re comfortable.'} It feels about ${feel}° to you just now.`));
  const row = mk('div', 'gx-kit-acts');
  for (const id of CLOTHES_IDS) {
    const on = !!c.wear[id];
    row.append(btn(`${CLOTHES[id].name}${on ? ' ✓' : ''}`, () => {
      c.wear[id] = !on;
      dressT = 0;
      packUI.render();
      save();
    }, false, on));
  }
  out.push(row);
  const advice = CLOTHES_IDS.filter((id) => !!suits[id] !== !!c.wear[id]);
  if (!off && advice.length) out.push(mk('p', 'gx-kit-note', `For this weather: ${CLOTHES_IDS.filter((id) => suits[id]).map((id) => CLOTHES[id].name.toLowerCase()).join(', ') || 'nothing extra'}.`));
  const water = waterHere(), kitchen = kitchenHere();
  out.push(mk('p', 'gx-kit-text', `Water bottle: ${c.bottle} of ${BOTTLE} drinks. Rolls: ${c.rolls} of ${ROLLS}.`));
  const acts = mk('div', 'gx-kit-acts');
  acts.append(
    btn('Have a drink', () => takeDrink(), off || c.bottle <= 0 || !!dive),
    btn('Fill the bottle', () => fillBottle(), off || !water || c.bottle >= BOTTLE),
    btn('Eat a roll', () => eatARoll(), off || c.rolls <= 0),
    btn('Pack rolls', () => takeRolls(), off || !kitchen || c.rolls >= ROLLS),
  );
  out.push(acts);
  if (!off && (!water || !kitchen)) out.push(mk('p', 'gx-kit-note', `${water ? '' : 'Fill the bottle at a camp, a kitchen, the chandlery or a clear stream. '}${kitchen ? '' : 'Rolls come from a kitchen (home, the bothy, Bar El Muelle, a boat’s galley) or the chandlery.'}`.trim()));
  el.replaceChildren(...out);
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
  // (Only in the sea you're in: Las Brasas and home are four days apart.)
  return box && state.places[id] && (box.z > SOUTH_Z) === (player().pos.z > SOUTH_Z) ? box : null;
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
  // (At Las Brasas, home's places are four days away: only the passage takes you there.)
  const south = player().pos.z > SOUTH_Z;
  const camp = !atCamp && !south;
  const boat = onFoot;
  const P = player().pos;
  const ownHere = state.camps.find((c) => onFoot && Math.hypot(P.x - c.x, P.z - c.z) < 12);
  const atHaven = onFoot && Math.hypot(P.x - HAVEN.x, P.z - HAVEN.z) < 22;
  const atHome = onFoot && Math.hypot(P.x - HOME.x, P.z - HOME.z) < 30;
  const carD = Math.hypot(car.pos.x - P.x, car.pos.z - P.z);
  const carAway = Math.hypot(car.pos.x - CAR_PARKS.home.x, car.pos.z - CAR_PARKS.home.z) > 8;
  const note = driving ? 'You’re in the car.' : !onFoot ? 'You’re in the boat. It stays where you leave it.' : atHome ? 'You’re at home.' : ownHere ? `You’re at ${ownHere.name}.` : atCamp ? 'You’re at the old camp.' : atHaven ? 'You’re in Willowhaven.' : stuckT > 2.5 ? 'Stuck? Any of these gets you out.' : '';
  return {
    camp, boat, camps: true, here: atHome ? 'home' : atCamp ? 'camp' : ownHere ? 'own' : atHaven ? 'haven' : box ? box.place : null, note,
    own: !!state.camps.length && !ownHere && !south, haven: !!state.places.haven && !atHaven && !south,
    home: !atHome && !south, car: carAway && carD > 25 && onFoot && !south, carAway, carWords: state.car.at && DESTS[state.car.at] ? `parked at ${DESTS[state.car.at].name}` : 'parked by the lane',
  };
}

// The walk (or row) back happens off-screen: a short fade, a little time passes, and
// you arrive somewhere safe. Catches, gear and the creel all come with you.
let traveling = null;
function travel(dest) {
  // (Out of the water first: back where you went in.)
  if (dive) endDive(null, true);
  if (dest === 'home' && carCloseBy() && !atHomeNow() && !carHome()) return driveTo('home');
  const info = travelInfo();
  const far = !['camp', 'boat', 'own', 'haven', 'home', 'car'].includes(dest);
  if (far ? !info.camps || !campAt(dest) || info.here === dest : !info[dest]) return;
  if (placement.isOn) placement.stop();
  if (fishing.lineOut) fishing.cancel();
  if (modal === 'pack') closePack();
  else if (modal === 'camp') closeCamp();
  else if (modal === 'map') closeMap();
  if (modal) return;
  modal = 'travel';
  if (driving) exitCar(true);
  const name = far ? PLACES.find((p) => p.id === dest)?.name : dest === 'own' ? state.camps[0].name : dest === 'haven' ? 'Willowhaven' : dest === 'home' ? 'Home' : dest === 'car' ? 'Your car' : '';
  hud.sleep(true, far || dest === 'haven' ? `You make your way to ${name}…` : dest === 'own' ? `You head back to ${name}…` : dest === 'camp' ? 'You head back to the old camp…' : dest === 'home' ? 'You make your way home…' : dest === 'car' ? 'You walk back to the car…' : 'You make your way back to the boat…');
  traveling = { dest, name, t: 0, done: false };
}

function passTime(hours) {
  if (moored(BOATS.bass)) chargeBattery(tanks(), hours);
  if (moored(BOATS.kayak)) chargeBattery(tanks(), hours, 'kayak');
  // (A while gone by: you feel it, as if you'd been here the while; the long passage is its own.)
  if (needsMode() !== 'off' && !passage) stepComfort(state.comfort, Math.min(hours, 3), comfortEnv());
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
  if (traveling.drive) {
    if (!traveling.done && traveling.t > 1.1) {
      traveling.done = true;
      arrive(traveling.to, traveling.aim);
    }
    if (traveling.t > 2.4) {
      hud.sleep(false);
      modal = null;
      const to = traveling.to, fuel = traveling.fuel, aim = traveling.aim;
      traveling = null;
      arrivalWords(to, fuel?.short ? ` You ran dry on the way and walked for a can: an hour gone, and ${litres(tanks().car)} in the tank.` : '', aim);
    }
    return;
  }
  if (!traveling.done && traveling.t > 0.9) {
    traveling.done = true;
    const from = player().pos.clone();
    const box = campAt(traveling.dest);
    const own = traveling.dest === 'own' ? state.camps[0] : null;
    const spot = traveling.dest === 'camp' ? campSpot() : own ? ownCampSpot(own) : traveling.dest === 'haven' ? standNear(HAVEN_SPOT.x, HAVEN_SPOT.z, 0.2)
      : traveling.dest === 'home' ? standNear(HOME_GATE.x, HOME_GATE.z, 0.2) : traveling.dest === 'car' ? carExitSpot() : box ? standNear(box.x, box.z) : null;
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
    passTime(clamp(from.distanceTo(player().pos) / 400, 0.05, box || own || ['haven', 'home', 'car'].includes(traveling.dest) ? 2.5 : 0.5));
    stuckT = 0;
    save();
  }
  if (traveling.t > 1.9) {
    hud.sleep(false);
    modal = null;
    hud.toast(traveling.dest === 'home' ? `Home. ${carAwayWords()}` : traveling.dest === 'car' ? 'Back at the car.' : traveling.name ? `${traveling.name}. Your boat is where you left it.` : traveling.dest === 'camp' ? 'Back at the old camp. The boat is where you left it.' : 'Back in the boat.', 4);
    traveling = null;
  }
}

/* ---------------- the long passage: Willow Bay and Las Brasas ---------------- */

// Las Brasas lies four days' sail to the south (see world/brasa.js). The sailing boat makes the
// passage, or the sport-fishing yacht under power (it takes half her tank): a few lines of the log while
// the days go by, and she comes in off Puerto Brasa (or, coming home, to her berth at Willowhaven),
// ready to go in. Your gear and creel come too; the other boats and the car stay where you left
// them.
const PASSAGE_DAYS = 4;
const PASSAGE_LOG_MOTOR = {
  south: [
    'Day 1 · You clear Gannet Light at first light and settle her at an easy cruising speed, the twin diesels droning steadily. By noon the coast is a grey line astern.',
    'Day 2 · Long seas on the quarter, and shearwaters skimming the troughs at dusk. You sleep in snatches in the cabin, an eye on the compass.',
    'Day 3 · The trade wind fills in from the north-east, warm in the cockpit. Flying fish skitter away from the bow, and the sea turns a deeper blue.',
    'Day 4 · At dawn a smudge on the horizon becomes a mountain with a cloud caught on its top: Pico Brasa. Black cliffs, a white village, the smell of land.',
  ],
  home: [
    'Day 1 · Brasa drops astern in the morning, the cloud on the volcano the last of it you see. North into the trade wind, spray rattling on the hardtop.',
    'Day 2 · The wind eases and the sea turns from blue to green-grey. Dolphins ride the bow wave for an hour.',
    'Day 3 · Cooler air and a long swell from the west; gannets diving far off. You find a jumper for the night watch.',
    'Day 4 · Gannet Light at dawn, then the hills behind Willow Bay. You throttle back off Willowhaven and bring her in to her berth on the pontoon.',
  ],
};
const PASSAGE_LOG = {
  south: [
    'Day 1 · You clear Gannet Light at first light and stand out into the Atlantic on a fresh northerly. By noon the coast is a grey line astern.',
    'Day 2 · Long seas on the quarter, and shearwaters skimming the troughs at dusk. You sleep in snatches, an eye on the compass.',
    'Day 3 · The trade wind fills in from the north-east, steady and warm. Flying fish skitter away from the bow, and the sea turns a deeper blue.',
    'Day 4 · At dawn a smudge on the horizon becomes a mountain with a cloud caught on its top: Pico Brasa. Black cliffs, a white village, the smell of land.',
  ],
  home: [
    'Day 1 · Brasa drops astern in the morning, the cloud on the volcano the last of it you see. The trade wind carries you north.',
    'Day 2 · The wind backs and freshens, and the sea turns from blue to green-grey. Dolphins ride the bow wave for an hour.',
    'Day 3 · Cooler air and a long swell from the west; gannets diving far off. You find a jumper for the night watch.',
    'Day 4 · Gannet Light at dawn, then the hills behind Willow Bay. You lower the sail off Willowhaven and bring her in alongside.',
  ],
};
let passage = null; // { to, kind, t, line, moved }
const LINE_T = 3.4; // seconds each line of the log stays up

// Why the passage can't be made just now in this boat (the sailing boat or the yacht), or null.
function passageWhy(S = BOATS.sail) {
  if (fishing.state === 'reeling' || fishing.state === 'landing' || fishing.state === 'caught' || fishing.state === 'keeping') return 'Land or let go of the fish first.';
  if (dive) return 'Out of the water first.';
  if (driving) return 'Out of the car first.';
  if (sleeping || traveling || passage) return 'Not now.';
  if (tow && (tow.lead === S || tow.towed === S)) return 'Let go of the tow first.';
  if (S.hull.passage && fuelLevel(tanks(), S.kind) < PASSAGE_FUEL) {
    return `The passage takes half her tank: she needs ${litres(PASSAGE_FUEL)} aboard, and has ${litres(fuelLevel(tanks(), S.kind))}. Fill up first (${S.pos.z > SOUTH_Z ? 'the pump on Puerto Brasa quay' : 'the fuel point on Willowhaven’s pontoon'}).`;
  }
  return null;
}

function offerPassage(to, S = boat) {
  const why = passageWhy(S);
  if (why) {
    hud.flash(why, t, 4);
    return;
  }
  const motor = !!S.hull.passage;
  const first = to === 'south' && !state.places.brasa;
  const along = motor ? ['jetski', 'windsurf'].filter((k) => Math.hypot(BOATS[k].pos.x - S.pos.x, BOATS[k].pos.z - S.pos.z) < 45) : [];
  const deck = along.length ? ` The ${along.map((k) => BOATS[k].name).join(' and the ')} ${along.length > 1 ? 'come' : 'comes'} too, lashed on her deck.` : '';
  ask(to === 'south' ? 'The long passage south' : 'The passage home', to === 'south'
    ? `${first ? 'Far to the south, four days’ sail down the Atlantic, lies Las Brasas: a volcanic island in the trade wind, with warm clear water, black lava reefs and fish you never see at home. ' : ''}${motor
      ? `Make the passage in the sport-fishing yacht? Four days at sea under power (you eat and sleep aboard), and it takes half her tank (${litres(PASSAGE_FUEL)}): fill up again at the pump on Puerto Brasa quay.`
      : 'Make the passage in the sailing boat? Four days at sea (you eat and sleep aboard), and you come in off Puerto Brasa with the sail down.'}${deck} Your gear and your creel come with you; the other boats and the car stay here.`
    : motor ? `Head home to Willow Bay? Four days at sea under power (half her tank, ${litres(PASSAGE_FUEL)}), and you come in to her berth on Willowhaven’s pontoon.${deck} Your gear and your creel come with you.`
      : 'Sail home to Willow Bay? Four days at sea, and you come in alongside Willowhaven quay. Your gear and your creel come with you.',
  [
    { text: 'Not now', cls: 'quiet' },
    { text: to === 'south' ? (motor ? 'Set off for Las Brasas' : 'Set sail for Las Brasas') : motor ? 'Set off for home' : 'Set sail for home', run: () => startPassage(to, S) },
  ]);
}

function startPassage(to, S = boat) {
  if (passageWhy(S) || modal) return;
  if (placement.isOn) placement.stop();
  if (fishing.lineOut) fishing.cancel();
  if (cabinIn) leaveCabin(true);
  modal = 'travel';
  // (The cruiser takes the jet ski and the windsurf board along, lashed on deck, if they're by her.)
  const carry = S.hull.passage ? ['jetski', 'windsurf'].filter((k) => Math.hypot(BOATS[k].pos.x - S.pos.x, BOATS[k].pos.z - S.pos.z) < 45 && !(tow && (tow.lead === BOATS[k] || tow.towed === BOATS[k]))) : [];
  passage = { to, kind: S.kind, t: 0, line: -1, moved: false, carry };
  hud.sleep(true, to === 'south' ? `You stow the gear, take on water and stores${S.hull.passage ? ', check the oil' : ''}, and cast off…` : 'You stow the gear and cast off for the long run north…');
}

function updatePassage(dt) {
  const P = passage;
  if (!P) return;
  const motor = !!BOATS[P.kind]?.hull.passage;
  const log = (motor ? PASSAGE_LOG_MOTOR : PASSAGE_LOG)[P.to];
  P.t += dt;
  const line = Math.min(log.length - 1, Math.floor((P.t - 1.6) / LINE_T));
  if (line >= 0 && line !== P.line) {
    P.line = line;
    hud.sleep(true, log[line]);
  }
  // (Out of sight: the boat and you to the other end, and the days gone by.)
  if (!P.moved && P.t > 2) {
    P.moved = true;
    arrivePassage(P.to);
  }
  if (P.t > 1.6 + log.length * LINE_T + 0.4) {
    hud.sleep(false);
    modal = null;
    passage = null;
    if (P.to === 'south') {
      const first = !state.tips.brasa;
      state.tips.brasa = true;
      // (The first arrival's word mentions El Bajón already.)
      if (first) state.tips.bajonNews = true;
      const how = motor ? 'motor in' : `row in (or raise the sail, ${input.keyLabel('motor')})`;
      hud.toast(first
        ? `Las Brasas. Puerto Brasa lies ahead behind its breakwater: ${how} and tie up at the quay or the pontoon (${input.keyLabel('anchor')}). Bar El Muelle on the waterfront has a room, a stove and a shelf of tackle, and the fuel pump is on the quay. The water here is clear and warm: just west of the harbour mouth a yellow buoy marks El Bajón, a reef of lava pinnacles with sea fans and sponges, parrotfish, wrasse and morays (dive it, or look down from a boat over it); groupers live down the drop-off.`
        : `Las Brasas, and Puerto Brasa ahead behind its breakwater${motor ? ` (the fuel pump is on the quay: ${tankWords(tanks(), P.kind)} left)` : ''}.`, first ? 14 : 6);
    } else hud.toast(motor ? `Home: Willow Bay, and the yacht at her berth on the pontoon (${tankWords(tanks(), P.kind)} left: the fuel point is on the pontoon).` : 'Home: Willow Bay, and the sailing boat alongside Willowhaven quay.', 6);
    save();
  }
}

function arrivePassage(to) {
  const S = BOATS[passage?.kind] || BOATS.sail;
  if (dive) endDive(null, true);
  // Free of any mooring, the sail down (the cruiser's motor in neutral, half her tank gone).
  S.tie = null;
  S.shove = null;
  S.anchor = null;
  S.anchored = false;
  S.lever = 0;
  S.power = 0;
  if (S.sailUp) S.setSail(false);
  if (S.hull.passage) tanks().boats[S.kind] = Math.max(0, fuelLevel(tanks(), S.kind) - PASSAGE_FUEL);
  const at = to === 'south' ? LANDFALL : mooring(S.kind);
  // (Off Puerto Brasa, clear of a boat you left lying there.)
  const busy = to === 'south' && boats.some((o) => o !== S && Math.hypot(o.pos.x - at.x, o.pos.z - at.z) < 12);
  S.place(at.x + (busy ? -18 : 0), at.z, at.heading);
  // (The jet ski and the board come off her deck beside her, or back to their berths at home.)
  (passage?.carry || []).forEach((k, i) => {
    const c = BOATS[k];
    c.tie = null;
    c.anchor = null;
    c.anchored = false;
    c.lever = 0;
    c.power = 0;
    const p = to === 'south' ? { x: S.pos.x + 7 + i * 5, z: S.pos.z + 3, heading: at.heading } : mooring(k);
    c.place(p.x, p.z, p.heading);
    const B = to === 'home' ? berthFor(c, boats, { reach: 3 }) : null;
    if (B) {
      c.place(B.x, B.z, B.heading);
      c.tieTo({ ...B, t: 9 });
    }
  });
  switchBoat(S);
  if (onFoot) setFoot(false, true);
  rig.reset(boat, t);
  if (to === 'home') {
    const B = berthFor(S, boats, { reach: 3 }) || pontoonBerth(S);
    if (B) {
      S.place(B.x, B.z, B.heading);
      S.tieTo({ ...B, t: 9 });
    }
  }
  // The days at sea: you arrive mid-morning (south) or late afternoon (home), fed and rested.
  const arrive = to === 'south' ? 10 : 17;
  const hours = PASSAGE_DAYS * 24 - 24 + (((arrive - state.hour) % 24) + 24) % 24;
  passTime(hours);
  state.food = { ...(state.food || {}), full: 100 };
  Object.assign(state.comfort, { warm: 18, wet: 0 });
  refill(state.comfort);
  // The weather where you land: fine, in the trade wind down south.
  if (skyMode() === 'auto') {
    weather.state = to === 'south' ? 'clear' : 'partly';
    weather.timer = rand(200, 320);
  }
  conditions.region = to === 'south' ? 'south' : 'home';
  if (to === 'south') {
    conditions.wind.from = 0.8;
    conditions.wind.target = 7;
  }
  setRegion(conditions.region);
  stuckT = 0;
}

/* ---------------- home, the garage and the car ---------------- */

// The garden gate, where you arrive home on foot.
const HOME_GATE = { x: HOUSE.door, z: -59.5 };
const homeSpotNear = () => {
  if (!onFoot || driving || !insideHome(walker.pos.x, walker.pos.z)) return null;
  let best = null, bd = Infinity;
  for (const sp of HOME_SPOTS) {
    const d = Math.hypot(walker.pos.x - sp.x, walker.pos.z - sp.z);
    if (d < sp.r && d < bd) { bd = d; best = sp; }
  }
  return best;
};
const HOME_ACTS = {
  bed: { text: 'Your bed: sleep until…', run: () => openCamp('sleep', 'house') },
  desk: { text: 'The desk: your journal and records', run: () => openJournal() },
  display: { text: 'The wall: photographs, a keepsake, a catch', run: () => openOutSheet('wall') },
  kitchen: { text: 'The kitchen: cook and eat', run: () => openCamp('cook', 'house') },
  bench: { text: 'The workbench: plan an outing', run: () => openBench() },
  tackle: { text: 'The tackle wall: rods, lines and tackle', run: () => openPack('tackle wall') },
  rack: { text: 'The rod rack', run: () => openPack('tackle wall') },
  shelf: { text: 'The camping shelf', run: () => openOutSheet('shelf') },
};
const atHomeNow = () => Math.hypot(player().pos.x - HOME.x, player().pos.z - HOME.z) < 40;
const carHome = () => Math.hypot(car.pos.x - CAR_PARKS.home.x, car.pos.z - CAR_PARKS.home.z) < 8;
const carCloseBy = () => onFoot && Math.hypot(car.pos.x - player().pos.x, car.pos.z - player().pos.z) < 60;
const carWhere = () => (carHome() ? 'on the drive at home' : state.car.at && DESTS[state.car.at] ? `at ${DESTS[state.car.at].name}` : 'parked by the lane');
const carAwayWords = () => (carHome() ? 'The car is on the drive.' : `The car is still ${carWhere()}.`);

// Where you stand when you get out: the driver's door, or the other side, or the back.
// Out of the car at home you face the house, and at the water the water (the camera behind you).
function exitHeading(sp, at) {
  const look = at === 'home' ? HOME : FISH_SPOTS[at];
  return look ? Math.atan2(look.x - sp.x, look.z - sp.z) : sp.heading;
}

function carExitSpot() {
  refreshCarSolids();
  for (const [lx, lz] of [[1.6, 0.2], [-1.6, 0.2], [0, -3.3], [0, 3.3]]) {
    const p = car.local(lx, lz), sp = standNear(p.x, p.z, 0);
    if (sp && Math.hypot(sp.x - p.x, sp.z - p.z) < 2.5) return { ...sp, heading: car.heading };
  }
  return standNear(car.pos.x, car.pos.z, 2.6);
}

function enterCar() {
  if (driving || !onFoot || modal) return;
  if (fishing.state === 'reeling' || fishing.state === 'landing' || fishing.state === 'caught' || fishing.state === 'keeping') {
    hud.flash('Land or let go of the fish first.', t, 3);
    return;
  }
  if (fishing.lineOut || fishing.aiming) {
    fishing.cancel();
    hud.flash('You reel in and lay the rod in the back.', t, 2);
  }
  if (placement.isOn) placement.stop();
  driving = true;
  walker.group.visible = false;
  car.wantGate = false;
  rig.car = car;
  rig.views.car.yaw = car.heading;
  rig.setMode(rig.firstPerson ? 'eye' : 'car', t);
  rig.settleUntil = t + 1.2;
  audio.carDoor?.();
  teach('driving', scheme() === 'touch'
    ? 'Driving: the stick drives and steers, the button brakes. Stop, then tap the prompt to get out or go somewhere.'
    : scheme() === 'pad'
      ? `Driving: ${kbd('RT')} to go, ${kbd('LT')} to brake (hold it to reverse), ${kbd('L-stick')} to steer. Stop, then ${K('interact')} to get out or go somewhere (or ${K('tackle')}: where to?).`
      : `Driving: ${K('forward')}${K('back')} to go and reverse, ${K('left')}${K('right')} to steer, ${K('cast')} to brake. ${K('view')} changes the view. Stop, then ${K('interact')} to get out or go somewhere (or ${K('tackle')}: where to?).`, 11);
  save();
}

// Out of the car (it must be stopped, unless you're travelling on without it).
function exitCar(force = false) {
  if (!driving) return;
  if (Math.abs(car.speed) > 0.6 && !force) {
    hud.flash(`Stop first (${{ touch: 'the button brakes', pad: `${kbd('LT')} brakes` }[scheme()] || `${K('cast')} brakes`}).`, t, 2);
    return;
  }
  car.speed = 0;
  driving = false;
  rig.car = null;
  walker.group.visible = true;
  const sp = carExitSpot();
  if (sp) walker.place(sp.x, sp.z, exitHeading(sp, parkNear(car.pos.x, car.pos.z, 9)));
  rig.setHome(true, t);
  rig.reset(walker, t);
  parkedAt();
  audio.carDoor?.();
  save();
}

// Where the car is now (a car park, or by the lane), kept in the save.
function parkedAt() {
  const id = parkNear(car.pos.x, car.pos.z, 9);
  state.car = { x: Math.round(car.pos.x * 100) / 100, z: Math.round(car.pos.z * 100) / 100, yaw: Math.round(car.heading * 1000) / 1000, at: id };
  return id;
}

// Stopped at the wheel: get out, or go somewhere.
function carChoices() {
  const dry = tanks().car <= 0, f = tanks();
  const acts = [{ text: 'Stay in', cls: 'quiet', run: () => {} }];
  if (dry && canHere(12) && f.can.litres >= 0.5) acts.push({ text: `Pour in the jerry can (${litres(f.can.litres)})`, cls: 'quiet', run: () => pourCan('car') });
  if (dry) acts.push({ text: 'Walk for a can (about an hour)', cls: 'quiet', run: () => rescueCar() });
  acts.push({ text: 'Where to?', cls: 'quiet', run: () => openOutSheet('drive') }, { text: 'Get out', run: () => exitCar() });
  // (Where the car is now, not where it last parked.)
  const at = parkNear(car.pos.x, car.pos.z, 9);
  ask('In the car', `${at === 'home' ? 'Parked on the drive at home.' : at ? `Parked at ${DESTS[at].name}.` : 'Stopped by the lane.'}${dry ? ` The tank is dry${canHere(12) && f.can.litres >= 0.5 ? ', but the jerry can is with you' : ''}.` : ` ${cap(fuelHint('car'))}.`} Get out here, or go somewhere?`, acts);
}

/* ---- fuel: the car, the motorboats, the battery and the jerry can (see fuel.js) ---- */

// (state.fuel, for short.)
const tanks = () => state.fuel;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fuelName = (what) => (what === 'car' ? 'the car' : `the ${BOATS[what].name}`);
// Within reach of a jetty or quay (where a boat ties up, and the battery charges).
const pierNear = (b, reach = 4) => PIERS.some((P) => Math.hypot(b.pos.x - clamp(b.pos.x, P.x0, P.x1), b.pos.z - clamp(b.pos.z, P.z0, P.z1)) < reach);
const moored = (b) => !!b.tie || (b.speed < 0.4 && pierNear(b));
const pumpNear = () => (onFoot && !driving ? Object.keys(FUEL_PUMPS).find((id) => Math.hypot(walker.pos.x - FUEL_PUMPS[id].x, walker.pos.z - FUEL_PUMPS[id].z) < 1.9) || null : null);
// The jerry can within reach: carried, or in the boot of a car close by.
const canHere = (reach = 8) => tanks().can.at === 'pack' || (tanks().can.at === 'car' && Math.hypot(car.pos.x - player().pos.x, car.pos.z - player().pos.z) < reach);

// What a tank says, for the hints: "fuel 31 of 45 L" (and the bass boat's battery).
function fuelHint(what) {
  const f = tanks();
  const fuel = fuelLevel(f, what) <= 0 ? 'out of fuel' : `fuel ${tankWords(f, what)}`;
  return what === 'bass' ? `${fuel} · ${f.battery <= 0 ? 'battery flat' : batteryWords(f)}` : fuel;
}

// A word as a tank passes a fifth (once, until it's filled again).
const fuelWarned = {};
function watchTank(what) {
  const lowNow = fuelLow(tanks(), what) && fuelLevel(tanks(), what) > 0;
  if (lowNow && !fuelWarned[what]) {
    hud.toast(`${cap(fuelName(what))} is low on fuel: ${tankWords(tanks(), what)}. ${what === 'car' ? 'The pump by the garage fills it (or the jerry can).' : what === 'bass' ? 'Longmere has no pump: the jerry can fills it.' : player().pos.z > SOUTH_Z ? 'The pump on Puerto Brasa quay fills it.' : 'The harbour pump on Willowhaven quay fills it.'}`, 6);
  }
  fuelWarned[what] = lowNow || fuelLevel(tanks(), what) <= 0;
}

// Fill up at a pump: whatever of yours is in reach (the car, the boats alongside or at the nearest
// pontoon berths, the jerry can).
const PUMP_REACH = 25;
function openPump(id) {
  const P = FUEL_PUMPS[id], f = tanks(), here = [];
  if (Math.hypot(car.pos.x - P.x, car.pos.z - P.z) < (id === 'home' ? 12 : 32)) here.push('car');
  if (id !== 'home') for (const b of boats) if (isPetrol(b.kind) && Math.hypot(b.pos.x - P.x, b.pos.z - P.z) < PUMP_REACH) here.push(b.kind);
  const can = f.can.at === 'pack' || (f.can.at === 'car' && here.includes('car')) || (id === 'home' && f.can.at === 'home');
  const lines = here.map((w) => `${cap(fuelName(w))}: ${tankWords(f, w)}.`);
  if (can) lines.push(`The jerry can: ${canWords(f)}.`);
  if (!here.length && !can) lines.push(id === 'home' ? 'The car isn’t here, and nor is the jerry can.' : 'None of your boats is alongside, and the car and the jerry can aren’t here.');
  const needs = [...here.filter((w) => fuelRoom(f, w) > 0.05), ...(can && f.can.litres < 9.95 ? ['can'] : [])];
  const name = id === 'home' ? 'The fuel pump' : id === 'brasa' ? 'The fuel pump on the quay' : 'The harbour fuel pump';
  if (!needs.length) {
    ask(name, `${lines.join(' ')}${here.length || can ? ' Everything here is full.' : ''}`, [{ text: 'OK' }]);
    return;
  }
  ask(name, lines.join(' '), [
    { text: 'Not now', cls: 'quiet' },
    ...needs.map((w) => ({ text: w === 'can' ? 'Fill the jerry can' : `Fill ${fuelName(w)}`, cls: needs.length > 1 ? 'quiet' : '', run: () => fillUp([w]) })),
    ...(needs.length > 1 ? [{ text: 'Fill everything', run: () => fillUp(needs) }] : []),
  ]);
}

function fillUp(list) {
  const f = tanks();
  let total = 0;
  for (const w of list) total += fill(f, w);
  // (A few minutes at the pump, a quarter of an hour for a big fill.)
  passTime(clamp(total / 120, 0.05, 0.25));
  audio.knock?.(0.3);
  for (const w of list) if (w !== 'can') fuelWarned[w] = false;
  hud.toast(`${litres(total)} of petrol: ${list.map((w) => (w === 'can' ? 'the jerry can' : fuelName(w))).join(', ').replace(/, ([^,]*)$/, ' and $1')} ${list.length > 1 ? 'are' : 'is'} full.`, 4);
  save();
}

// The jerry can into a tank: as much as fits.
function pourCan(into) {
  const f = tanks(), got = pour(f, into);
  if (!got) {
    hud.flash(f.can.litres < 0.5 ? 'The jerry can is empty: fill it at a pump.' : `${cap(fuelName(into))} is full already.`, t, 2.5);
    return;
  }
  audio.knock?.(0.25);
  fuelWarned[into] = fuelLow(f, into);
  hud.toast(`You pour ${litres(got)} into ${fuelName(into)}: ${tankWords(f, into)} now, ${litres(f.can.litres)} left in the can.`, 5);
  save();
}

// Run dry in the car: someone up the lane lends you a can (it takes an hour).
function rescueCar() {
  passTime(rescue(tanks(), 'car'));
  fuelWarned.car = true;
  hud.toast(`You walk up the lane to the nearest farm. An hour later you’re back with a borrowed can: ${litres(tanks().car)} in the tank. The pumps are at home and on Willowhaven quay.`, 7);
  save();
}

// Run dry in a boat: the jerry can, a tow in, or the oar.
function boatChoices() {
  const f = tanks(), kind = boat.kind;
  const acts = [{ text: 'Paddle on with the oar', cls: 'quiet', run: () => {} }];
  if (f.can.at === 'pack' && f.can.litres >= 0.5) acts.push({ text: `Pour in the jerry can (${litres(f.can.litres)})`, cls: 'quiet', run: () => pourCan(kind) });
  acts.push({ text: kind === 'bass' ? 'A tow to the boathouse (about an hour)' : boat.pos.z > SOUTH_Z ? 'A tow in to Puerto Brasa (about an hour)' : 'A tow to Willowhaven quay (about an hour)', run: () => towBoat() });
  ask(`The ${boat.name}: out of fuel`, `The tank is dry. An oar moves her along, slowly${kind === 'bass' && f.battery > 0 ? ', and the electric motor still runs on its battery' : ''}.${f.can.at === 'pack' ? '' : ' (The jerry can isn’t with you.)'}`, acts);
}

function towBoat() {
  if (fishing.lineOut || fishing.aiming) fishing.cancel();
  // (Down south, into Puerto Brasa: a berth on the pontoon.)
  const south = boat.pos.z > SOUTH_Z, berth = south ? pontoonBerth(boat, true) : null;
  const p = berth || (south ? { x: PONTOON_S.x1 + 6, z: PONTOON_S.z1 + 6, heading: 0 } : boat.kind === 'bass' ? mooring('bass') : quayMooring(boat) || mooring(boat.kind));
  boat.place(p.x, p.z, p.heading);
  if (berth) boat.tieTo({ ...berth, t: 9 });
  else boat.setAnchor(true);
  passTime(rescue(tanks(), boat.kind));
  rig.reset(boat, t);
  audio.knock?.(0.4);
  hud.toast(boat.kind === 'bass'
    ? `The boathouse keeper tows you back to the jetty, an hour gone, and leaves you ${litres(fuelLevel(tanks(), 'bass'))} to potter with. The jerry can fills at home or at Willowhaven.`
    : south ? `A fishing boat tows you in to Puerto Brasa, an hour gone, and they leave you ${litres(fuelLevel(tanks(), boat.kind))}. The pump is on the quay.`
      : `A boat from the harbour tows you in to Willowhaven quay, an hour gone, and they leave you ${litres(fuelLevel(tanks(), boat.kind))}. The pump is at the root of the quay.`, 8);
  save();
}

function resetCar() {
  if (car.resetToLane(carWorld)) {
    hud.flash('Back on the lane.', t, 2);
    rig.views.car.yaw = car.heading;
    refreshCarSolids();
  } else hud.flash('There’s no room on the lane just here: try a little further on.', t, 3);
}

let parkT = 0;
function watchParking(dt) {
  if (!driving) return;
  if (Math.abs(car.speed) > 0.3) {
    parkT = 0;
    return;
  }
  parkT += dt;
  if (parkT < 1.2 || parkT > 1.3) return;
  const was = state.car.at, id = parkedAt();
  if (id && id !== was) {
    hud.place(id === 'home' ? 'Home' : DESTS[id].name, id === 'home' ? 'on the drive' : 'parked');
    if (id !== 'home') state.outing.lastDest = id;
    save();
  }
}

let bumpWordT = 0;
function carBumped(b) {
  audio.knock?.(clamp(b.speed / 8, 0.15, 0.6));
  if (t < bumpWordT) return;
  bumpWordT = t + 3;
  hud.flash(b.kind === 'water' ? 'The car won’t go any nearer the water.' : b.kind === 'steep' ? 'Too steep for the car.' : `The car stops: ${b.name || 'something'} in the way.`, t, 2.2);
}

// Drive somewhere with the time passing (a short fade): to a destination, or home. aim: where the
// outing is for, if that's somewhere you go on to by boat from here (the Calf, from Willowhaven).
function driveTo(to, how = 'skip', aim = to) {
  if (!started || traveling || sleeping) return;
  if (fishing.state === 'reeling' || fishing.state === 'landing' || fishing.state === 'caught' || fishing.state === 'keeping') {
    hud.flash('Land or let go of the fish first.', t, 3);
    return;
  }
  if (!driving && !carCloseBy()) {
    hud.toast(`The car is ${carWhere()}: you’ll need to be with it to drive.`, 4);
    return;
  }
  if (fishing.lineOut || fishing.aiming) fishing.cancel();
  if (placement.isOn) placement.stop();
  for (const close of [closePack, closeMap, closeOut, closeBench, closeCamp]) if (modal) close();
  if (modal) return;
  const from = state.car.at;
  if (to !== 'home') {
    state.outing.last = snapshot(state, 'Last time');
    state.outing.lastDest = aim;
    state.outing.plan.dest = aim;
  }
  if (how === 'drive' && DESTS[to]?.drive) {
    // Drive yourself: into the driver's seat, with the way pointed out.
    if (!driving) {
      if (Math.hypot(car.pos.x - walker.pos.x, car.pos.z - walker.pos.z) > 6) {
        hud.toast(`The car is ${carWhere()}: get in at the driver’s door, and follow the lane to ${DESTS[to].name}.`, 7);
        save();
        return;
      }
      enterCar();
    }
    hud.toast(`Follow the lane to ${DESTS[to].name}: the car park is at its end. Stop, then ${scheme() === 'touch' ? 'tap the prompt' : input.keyLabel('interact')} to get out.`, 7);
    save();
    return;
  }
  state.outing.travel = { to, from };
  const fuel = driveBy(tanks(), from, to);
  if (fuel.short) fuelWarned.car = true;
  save();
  modal = 'travel';
  hud.sleep(true, to === 'home' ? 'You drive home…' : `You drive to ${DESTS[to].name}…`);
  audio.carDoor?.();
  traveling = { drive: true, to, aim, t: 0, done: false, fuel };
}

// Arriving: the car parked at the car park, you beside it; the drive's time gone by. Finished
// even if the game closed partway (see the load, below), so nothing is ever left half-way.
function arrive(to, aim = to) {
  const P = CAR_PARKS[to];
  const from = state.car.at;
  if (driving) {
    driving = false;
    rig.car = null;
    walker.group.visible = true;
  }
  if (!onFoot) setFoot(true, true);
  car.place(P.x, P.z, P.yaw);
  refreshCarSolids();
  const sp = carExitSpot();
  if (sp) walker.place(sp.x, sp.z, exitHeading(sp, to));
  rig.setHome(true, t);
  rig.reset(walker, t);
  passTime(driveMinutes(from || 'home', to) / 60 + (traveling?.fuel?.short ? traveling.fuel.hours : 0));
  state.car = { x: P.x, z: P.z, yaw: P.yaw, at: to };
  state.outing.travel = null;
  stuckT = 0;
  if (to !== 'home') guideEvent('drive', aim);
  save();
}

function arrivalWords(to, note = '', aim = to) {
  const inBoot = [...KIT_IDS.filter((k) => state.equip.kit[k] === 'car').map((k) => KIT[k].short), ...(state.equip.car.rods.length || state.equip.car.items.length ? ['spare tackle'] : [])];
  if (to === 'home') {
    hud.place('Home', 'on the drive');
    hud.toast(`Home.${note} ${inBoot.length ? `In the boot: ${inBoot.join(', ')}. Unload it at the boot, or leave it for next time.` : 'The boot is empty.'} The garage door is open.`, 7);
    return;
  }
  const D = DESTS[to], A = DESTS[aim];
  hud.place(D.name, 'the car park');
  // (On to somewhere by boat from here: the crossing, in a word.)
  const on = A?.boat && A.launch === to ? ` For ${A.name}: walk down to the head of the quay and have a boat brought round, then out of the bay and west along the coast to the island just off Heron Point.` : ` ${D.access}`;
  hud.toast(`${D.name}.${note}${on}${inBoot.length ? ` In the boot: ${inBoot.join(', ')} (open it at the back of the car).` : ''}`, 9);
}

/* ---- the workbench and the outing sheet ---- */

const bench = new Workbench(state, {
  carHome, carWhere: () => carWhere(),
  campDest: (c) => parkNear(c.x, c.z, 160),
  boatsNear: (id) => {
    const D = DESTS[id];
    return boats.map((b) => {
      const d = Math.round(Math.hypot(b.pos.x - D.at.x, b.pos.z - D.at.z));
      return d < 220 ? `Your ${b.name} is about ${Math.round(d / 10) * 10} m from here.` : null;
    }).filter(Boolean);
  },
  weather: (id) => {
    const D = DESTS[id], w = windAt(D.at.x, D.at.z), sea = waveHeightHere(D.at.x, D.at.z);
    const sky = weather.rain > 0.6 ? 'Heavy rain' : weather.rain > 0.15 ? 'Light rain' : weather.cloud > 0.7 ? 'Overcast' : weather.cloud > 0.3 ? 'Some cloud' : 'Clear';
    return [
      `${formatClock(state.hour)}, ${phaseName(state.hour).toLowerCase()}. ${sky}.`,
      w.speed < 0.6 ? 'Wind: flat calm.' : `Wind: ${windWords(w.speed).toLowerCase()} from the ${compass(conditions.wind.from, true)}, about ${Math.round(w.speed * 3.6)} km/h there.`,
      D.water === 'fresh' ? 'A lake: the water is calm whatever the sea does.' : `Sea: ${seaWords(sea).toLowerCase()} (about ${sea < 0.1 ? 'nothing' : `${sea.toFixed(1)} m`}).`,
    ];
  },
  openGuide: (id) => {
    closeBench();
    backTo = 'bench';
    openGuide(id);
  },
  openPack: () => {
    closeBench();
    backTo = 'bench';
    openPack('tackle wall');
  },
  openMap: (id) => {
    closeBench();
    backTo = 'bench';
    const P = CAR_PARKS[id] || DESTS[id].at;
    openMapAt(P.x, P.z);
  },
  changed: () => {
    gearDirty = true;
    save();
    refreshHomeGear(true);
  },
  depart: (id, how) => {
    closeBench();
    guideEvent('plan', id);
    // (A place by boat: the car goes to its harbour, and the plan stays the place.)
    driveTo(launchOf(id), how, id);
  },
  close: () => closeBench(),
  eco, habitat,
});
// After a look at the field guide, the tackle wall or the map from the workbench, back to it.
let backTo = null;
function returnToBench() {
  if (backTo !== 'bench' || modal) return;
  backTo = null;
  // (Back on the step you were on.)
  setTimeout(() => { if (!modal) openBench(bench.step); }, 0);
}

function openBench(step = null) {
  if (modal) return;
  bench.open(step);
  modal = 'bench';
  audio.page();
  teach('bench', 'The workbench: choose what you’re going for and where, see what’s there, and pack. Or skip all that: “Same again”, or just get in the car and go.', 9);
}
function closeBench() {
  if (!bench.isOpen) return;
  bench.close();
  if (modal === 'bench') modal = null;
  audio.page();
  if (state.outing.plan.dest) guideEvent('plan', state.outing.plan.dest);
}

/* ---- the first trip: an optional guide (see firstTrip.js) ---- */

// Offered once, to a new player standing at home.
function offerGuide(wait = 3.2) {
  setTimeout(() => {
    if (state.guide.offered || !started) return;
    if (modal || !$('confirm').hidden || traveling) {
      offerGuide(2);
      return;
    }
    state.guide.offered = true;
    save();
    ask('Your first fishing trip', 'This is your home: the cottage, the garage with your rods and tackle, and the car on the drive. Would you like a short guide to your first outing? Plan it at the workbench, drive to the water, cast, and land a fish. You can end it whenever you like, and find it again in the journal.', [
      { text: 'No thanks', cls: 'quiet', run: () => hud.toast('Explore as you like. The guide is in your journal, under Memories, if you want it later.', 6) },
      { text: 'Guide me', run: () => beginGuide() },
    ]);
  }, wait * 1000);
}

function beginGuide() {
  startGuide(state.guide);
  if (modal === 'journal') closeJournal();
  guideText = '';
  save();
}

function endGuide() {
  state.guide.on = false;
  guideTarget = null;
  save();
  hud.toast('Guide ended. It’s in your journal, under Memories, whenever you want it again.', 5);
  if (modal === 'journal') renderGuideRow();
}

// Something the game did that finishes a step (and any before it).
function guideEvent(id, dest = null) {
  const g = state.guide;
  if (!g.on) return;
  // (Reaching the harbour on the way to a place by boat keeps that place as the aim.)
  if (dest && DESTS[dest] && DESTS[g.dest]?.launch !== dest) g.dest = dest;
  if (completeStep(g, id)) guideMoved();
}

function guideMoved() {
  const g = state.guide;
  save();
  guideText = '';
  const card = $('guide');
  card.classList.remove('fresh');
  void card.offsetWidth;
  card.classList.add('fresh');
  if (g.finished) {
    guideTarget = null;
    guideEnd = true; // (the card comes once nothing else is open: see updateGuide)
  }
}

// Each moment: is a step done (by what's actually happening), and what does the card say?
let guideT = 0, guideText = '', guideTarget = null, guideH = 0, guideEnd = false;
function updateGuide(dt) {
  const g = state.guide, card = $('guide');
  const show = started && g.on && !hudOff && (!modal || modal === 'catch') && !placement.isOn && !sleeping && !traveling;
  if (card.hidden === show) {
    card.hidden = !show;
    // (Toasts make room for it: see style.css.)
    document.body.classList.toggle('guiding', show);
    if (show) measureGuide();
  }
  // The end of the first trip: a card to say so, once you're back and nothing else is open.
  if (guideEnd && started && !modal && !traveling && !sleeping && $('confirm').hidden) {
    guideEnd = false;
    const n = state.log.filter((e) => e.at >= g.since).length;
    showNote('Your first trip', `${n ? `${n === 1 ? 'One fish' : `${n} fish`} in your journal from it.` : 'Done.'} Anywhere the car or the boats can take you is yours to go now: the workbench plans any outing, and the map shows where. (The guide is in the journal, under Memories, if you’d like it again.)`, 'trip');
    audio.chime();
  }
  if (!g.on || !started || traveling || sleeping) return;
  if ((guideT -= dt) > 0) return;
  guideT = 0.25;
  const step = stepOf(g), P = player().pos, F = fishing.state;
  // At the water: one of the places the car goes, however you got there.
  if (onFoot && !driving && (step === 'plan' || step === 'drive')) {
    const here = placeAt(P.x, P.z);
    if (here) guideEvent('drive', here);
  }
  // Fishing: each stage counts the ones before it.
  if (modal === 'catch' || F === 'caught' || F === 'keeping' || F === 'releasing') guideEvent('land');
  else if (F === 'bite' || F === 'reeling' || F === 'landing' || fishing.baitInWater) guideEvent('cast');
  else if (onFoot && (fishing.aiming && fishing.aimValid)) guideEvent('spot');
  else if (onFoot && g.dest && Math.hypot(P.x - FISH_SPOTS[g.dest].x, P.z - FISH_SPOTS[g.dest].z) < 9) guideEvent('spot');
  // The catch card closed: kept or let go, it's in the journal.
  if (g.done.land && !g.done.record && modal !== 'catch' && F !== 'caught' && F !== 'keeping' && F !== 'releasing') guideEvent('record');
  // Home again.
  if (stepOf(g) === 'back' && onFoot && !driving && atHomeNow()) guideEvent('back');
  if (!g.on) return;
  const { rod, item } = currentRig(state.gear);
  const w = guideWords(g, {
    key: (a) => K(a), touch: scheme() === 'touch', pad: scheme() === 'pad',
    at: atHomeNow() ? 'home' : null, carAt: state.car.at, driving,
    nearCar: onFoot && Math.hypot(car.pos.x - P.x, car.pos.z - P.z) < 12,
    plan: state.outing.plan, rig: item && rod ? `${item.on} on the ${rod.short.toLowerCase()}` : '', kind: fishing.kind,
    caught: state.log.filter((e) => e.at >= g.since).length, car: { x: car.pos.x, z: car.pos.z }, tent: state.equip.kit.tent,
    here: placeAt(P.x, P.z), afloat: !onFoot && !driving,
  });
  guideTarget = w?.target || null;
  if (guideTarget && $('guide-label').textContent !== guideTarget.label) $('guide-label').textContent = guideTarget.label;
  if (!w) return;
  const text = `${w.n}|${w.title}|${w.text}|${g.min}`;
  if (text === guideText) return;
  guideText = text;
  $('gd-step').textContent = g.min ? `First trip · ${w.n}/${w.of} · ${w.title}` : `First trip · step ${w.n} of ${w.of}`;
  $('gd-title').textContent = w.title;
  $('gd-text').innerHTML = w.text;
  $('gd-body').hidden = g.min;
  $('gd-fold').textContent = g.min ? '+' : '–';
  $('gd-fold').setAttribute('aria-label', g.min ? 'Open the guide' : 'Fold the guide away');
  $('gd-fold').setAttribute('aria-expanded', String(!g.min));
  $('gd-dots').replaceChildren(...TRIP_STEPS.map((s, i) => {
    const li = document.createElement('li');
    li.className = g.done[s.id] ? 'done' : i === w.n - 1 ? 'now' : '';
    li.title = s.title;
    return li;
  }));
  measureGuide();
}

// How tall the card is, for what makes room for it (the toasts; on a phone, the hint too).
function measureGuide() {
  const card = $('guide');
  if (card.hidden || card.offsetHeight === guideH) return;
  guideH = card.offsetHeight;
  document.body.style.setProperty('--guide-h', `${guideH}px`);
}

// The journal's line about it (Memories): where it's got to, and a button to start or end it.
function renderGuideRow() {
  const g = state.guide;
  const n = stepNumber(g);
  $('mem-guide').textContent = g.on ? `Under way: step ${n} of ${TRIP_STEPS.length}, ${TRIP_STEPS[n - 1].title.toLowerCase()}.`
    : g.finished ? 'Done. You can follow it again any time: it starts from wherever you are.'
      : 'A short guide to an outing: plan it at the workbench, drive to the water, cast, land a fish, and home again.';
  $('mem-guide-btn').textContent = g.on ? 'End the guide' : g.finished ? 'Follow the guide again' : 'Start the guide';
}

const outSheet = new OutingSheet(state, {
  close: () => closeOut(),
  changed: () => {
    gearDirty = true;
    save();
    refreshHomeGear(true);
    refreshCarCargo();
  },
  carHome, atHome: () => atHomeNow(),
  openPack: (box) => {
    closeOut();
    openPack(box);
  },
  drive: (id, how) => {
    closeOut();
    driveTo(id, how);
  },
  driveHome: () => {
    closeOut();
    driveTo('home');
  },
  photos: null,
  keepsakes: () => Object.keys(state.keepsakes || {}).filter((k) => KEEPSAKES[k]).map((k) => [k, KEEPSAKES[k].name]),
  records: () => bestCatches(),
  photoList: () => state.photos,
});
function openOutSheet(mode) {
  if (modal) return;
  if (!outSheet.h.photos) outSheet.h.photos = photos;
  outSheet.open(mode);
  modal = 'outsheet';
  if (mode === 'boot') {
    car.wantGate = true;
    audio.boot?.();
  } else audio.page();
}
function closeOut() {
  if (!outSheet.isOpen) return;
  outSheet.close();
  if (modal === 'outsheet') modal = null;
  car.wantGate = false;
  refreshHomeWall();
}

// Your best catches (heaviest of each kind, the biggest first), for the wall at home.
function bestCatches() {
  const best = {};
  for (const e of state.log) {
    const sp = fishById[e.sp];
    if (!sp) continue;
    if (!best[e.sp] || e.size > best[e.sp].size) best[e.sp] = e;
  }
  return Object.values(best).map((e) => ({ id: e.id, e, kg: weightOf(fishById[e.sp], e.size) }))
    .sort((a, b) => b.kg - a.kg)
    .map(({ id, e, kg }) => ({ id, title: `${fishById[e.sp].name}, ${e.size} cm`, sub: `${kg >= 1 ? `${kg.toFixed(1)} kg` : `${Math.round(kg * 1000)} g`} · day ${e.day}${e.place ? `, ${e.place}` : ''}`, e, kg }));
}

/* ---- what the garage, the car and the wall show ---- */

let gearKey = '';
function refreshHomeGear(force = false) {
  const g = state.gear, car_ = state.equip.car;
  const key = JSON.stringify([g.pack.rods, car_.rods, state.equip.kit]);
  if (key === gearKey && !force) return;
  gearKey = key;
  const home = new Set(ROD_IDS.filter((r) => !g.pack.rods.includes(r) && !car_.rods.includes(r)));
  world.home.showGear(home, Object.fromEntries(KIT_IDS.map((k) => [k, state.equip.kit[k] === 'home'])));
  refreshCarCargo();
}
function refreshCarCargo() {
  const e = state.equip;
  car.showCargo({ bag: e.car.items.length > 0, rods: e.car.rods.length > 0, tent: e.kit.tent === 'car', stove: e.kit.stove === 'car', coolbox: e.kit.coolbox === 'car' });
}
// The wall at home: what you chose, or the house's pick from what you've done (never anything
// you haven't): your latest photographs, your best catch, your newest keepsake.
let wallKey = '';
async function refreshHomeWall() {
  const H = state.home;
  const ids = H.auto ? state.photos.slice(-3).reverse().map((p) => p.id) : H.photos;
  const keeps = Object.entries(state.keepsakes || {}).filter(([k]) => KEEPSAKES[k]).sort((a, b) => (b[1].day - a[1].day) || (b[1].hour - a[1].hour));
  const keepsake = H.auto ? keeps[0]?.[0] : H.keepsake;
  const best = bestCatches();
  // The chalkboard by the front door: what you've caught, all told.
  const total = Object.values(state.fish).reduce((a, f) => a + f.count, 0), kinds = Object.keys(state.fish).length;
  world.home.showTally(total ? [`${total} fish, ${kinds} kind${kinds === 1 ? '' : 's'}`, best[0] ? `Best: ${best[0].title}` : '', `Day ${state.day}`] : null);
  const rec = H.auto ? best[0] : best.find((b) => b.id === H.catchId);
  const key = JSON.stringify([ids, keepsake, rec?.id]);
  if (key === wallKey) return;
  wallKey = key;
  world.home.showKeepsakes(keepsake ? { [keepsake]: true } : {});
  world.home.showRecord(rec ? [H.auto ? 'Best catch' : 'A catch to remember', rec.title, rec.sub.split(' · ')[0], rec.sub.split(' · ')[1] || ''] : null);
  const imgs = await Promise.all(ids.map(async (id) => {
    const u = await photos.url(id, 'thumb');
    if (!u) return null;
    const img = new Image();
    img.src = u;
    try { await img.decode(); } catch { return null; }
    return img;
  }));
  world.home.showPictures(imgs);
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
  // In the water: something to climb out onto, at the surface.
  if (dive) return diveExit();
  // Inside the cabin: what's where you stand.
  if (cabinIn) return cabinAction();
  // At the wheel: get out when you've stopped (or back on the lane if you're stuck).
  if (driving) {
    if (car.stuckT > 1.5) return { text: 'Back on the lane', run: () => resetCar() };
    if (Math.abs(car.speed) < 0.6) return { text: tanks().car <= 0 ? 'Out of fuel: what now?' : 'Get out, or go somewhere', run: () => carChoices() };
    return null;
  }
  if (lanternReach()) return { text: 'Look closer at the driftwood', run: takeLantern };
  if (onFoot) {
    // The fuel pumps (at home, and on Willowhaven quay).
    const pump = pumpNear();
    if (pump) return { text: 'The fuel pump: fill up', run: () => openPump(pump) };
    // The car: the boot at the back, the driver's door at the side.
    const P = walker.pos, boot = car.bootSpot(), door = car.doorSpot();
    if (Math.hypot(P.x - boot.x, P.z - boot.z) < 1.8) return { text: 'Open the boot', run: () => openOutSheet('boot') };
    if (Math.hypot(P.x - door.x, P.z - door.z) < 1.6 || Math.hypot(P.x - car.pos.x, P.z - car.pos.z) < 2.4) return { text: 'Get in and drive', run: () => enterCar() };
    // Home and the garage.
    const hs = homeSpotNear();
    if (hs) return HOME_ACTS[hs.id];
    const near = boatNear();
    // A boat with a cabin made fast: aboard to the helm, or straight into the cabin (and the
    // cruiser: the long passage too).
    if (near && near.hull.cabin && canEnterCabin(near)) {
      const long = !!near.hull.passage, to = walker.pos.z > SOUTH_Z ? 'home' : 'south';
      return { text: long ? `The ${near.name}: the helm, the cabin, or the passage ${to}` : `The ${near.name}: the helm or the cabin`, run: () => ask(boatTitle(near), long
        ? `She’s made fast here. Take the helm, go into the cabin (the galley and the bunks), or make the long passage ${to === 'south' ? 'south to Las Brasas' : 'home to Willow Bay'} under power (four days at sea)?`
        : 'She’s made fast here. Take the helm, or go straight into the cabin (the galley and the bunk)?', [
        ...(long ? [{ text: to === 'south' ? 'The passage south' : 'The passage home', cls: 'quiet', run: () => offerPassage(to, near) }] : []),
        { text: 'The helm', cls: 'quiet', run: () => board(near) },
        { text: 'Into the cabin', run: () => enterCabin(near) },
      ]) };
    }
    // The sailing boat: get in, or the long passage (to Las Brasas, or home from there).
    if (near && near.hull.sail) {
      const to = walker.pos.z > SOUTH_Z ? 'home' : 'south';
      return { text: `The ${near.name}: get in, or the long passage ${to}`, run: () => ask(boatTitle(near), to === 'south' ? 'Get in and sail her here, or make the long passage south to Las Brasas (four days at sea)?' : 'Get in and sail her here, or make the passage home to Willow Bay (four days at sea)?', [
        { text: to === 'south' ? 'The passage south' : 'The passage home', cls: 'quiet', run: () => offerPassage(to, near) },
        { text: 'Get in', run: () => board(near) },
      ]) };
    }
    if (near) return { text: `Get in the ${near.name}`, run: () => board(near) };
    const own = ownCampNear();
    if (own) return { text: `${own.name}: rest, cook, cool box and tackle`, run: () => openCamp('cook', own) };
    if (nearCamp()) return { text: 'Camp: fire, food, sleep and tackle box', run: () => openCamp() };
    // Up the Coldwater: the bothy (a stove, a bunk and a shelf of tackle), the fingerpost, the cairn.
    if (coastSpot('bothy')) return { text: 'The bothy: stove, bunk and tackle shelf', run: () => openCamp('cook', 'bothy') };
    // Puerto Brasa: your room over the bar, its kitchen and a shelf of tackle.
    if (coastSpot('posada')) return { text: 'Bar El Muelle: Paco’s bar, his kitchen, and your room', run: () => openHarbour('muelle') };
    if (coastSpot('fingerpost')) return { text: 'Read the fingerpost', run: () => readFingerpost() };
    if (coastSpot('cairn')) return { text: 'Add a stone to the cairn', run: () => addToCairn() };
    const box = regionBox();
    if (box) return { text: `${PLACES.find((p) => p.id === box.place)?.name || 'Camp'}: the tackle box`, run: () => openPack('tackle box') };
    // Willowhaven, and the pages round the cove.
    const page = pageNear();
    if (page) return { text: PAGES[page].where.startsWith('tucked') ? 'Look at the paper tucked under the seat' : PAGES[page].where.startsWith('folded') ? 'Look at the paper in the crack' : 'Look at the paper in the driftwood', run: () => readPage(page) };
    if (coastSpot('board')) return { text: 'Read the notice board', run: () => openBoard() };
    if (coastSpot('market')) return { text: 'The fish market: sell your catch', run: () => openHarbour('market') };
    if (innNear()) return { text: 'The Lobster Pot: the bar and the kitchen', run: () => openHarbour('inn') };
    if (coastSpot('tower')) return { text: 'The watch tower', run: () => climbTower() };
    if (chandleryNear()) return { text: 'The chandlery: tackle, the counter, mending and air', run: () => { fillTank(); openHarbour('chandlery'); } };
    // Someone to talk to: the harbour's people (and Paco).
    const folk = town.near(walker.pos.x, walker.pos.z, 1.9);
    if (folk) return { text: `Talk to ${FOLK[folk.id].short}`, run: () => talkTo(folk) };
    if (coastSpot('bench')) return { text: 'Sit on the bench a while', run: () => sitOnBench() };
    if (quayHeadNear()) return { text: boats.some((b) => b.kind !== 'bass' && regionOf(b) === 'south') ? 'Have a boat brought round, or shipped from Las Brasas' : 'Have a boat brought round to the quay', run: () => boatsRound('home') };
    if (coastSpot('office')) return { text: 'The harbour office: your boats, brought round or shipped from Willowhaven', run: () => boatsRound('south') };
    // Clear running water beside you, and room in your bottle.
    if (needsMode() !== 'off' && state.comfort.bottle < BOTTLE && streamHere()) return { text: 'Fill your water bottle', run: () => fillBottle() };
    if (stuckT > 2.5) return { text: 'Stuck? Head back to camp or the boat', run: () => openPack() };
    // Deep water a stride away: in you go.
    const entry = diveEntry();
    if (entry) return { text: 'Go diving', run: () => chooseDive(entry) };
    return null;
  }
  const spot = cachedShoreSpot();
  const ashore = spot && (spot.landing ? 'Step ashore at the landing' : spot.quay ? 'Step up onto the quay' : spot.pier ? 'Step onto the jetty' : 'Step ashore');
  // The cabin boat, anchored or tied up by the shore: the cabin, or ashore.
  if (spot && boat.hull.cabin && canEnterCabin(boat) && !fishing.lineOut) {
    return { text: 'Into the cabin, or ashore', run: () => ask(boatTitle(boat), 'Tied up here. Into the cabin (the galley and the bunk), or ashore?', [
      { text: ashore, cls: 'quiet', run: () => stepAshore(spot) },
      { text: 'Into the cabin', run: () => enterCabin() },
    ]) };
  }
  if (spot) return { text: ashore, run: () => stepAshore(spot) };
  const other = boat.speed < 1 ? otherBoat(tow && (tow.lead === boat || tow.towed === boat) ? 9 : 4.5) : null;
  if (other) {
    const towing = tow && ((tow.lead === boat && tow.towed === other) || (tow.towed === boat && tow.lead === other));
    return { text: `The ${other.name}: step across${towing ? ', or let her go' : ', or take her in tow'}`, run: () => ask(boatTitle(other), towing ? 'She’s on your towline. Step across into her, or let her go?' : 'Step across into her, or take her in tow? (A line from your stern to her bow: she follows where you go.)', [
      { text: towing ? 'Let go the tow' : 'Take her in tow', cls: 'quiet', run: () => (towing ? letGoTow() : takeInTow(other)) },
      { text: 'Step across', run: () => stepAcross(other) },
    ]) };
  }
  // A dry tank: the jerry can, a tow, or an oar.
  if (isPetrol(boat.kind) && boat.motor && fuelLevel(tanks(), boat.kind) <= 0 && boat.speed < 1) return { text: 'Out of fuel: what now?', run: () => boatChoices() };
  // The cabin boat, stopped: its galley and bunk (or over the side for a dive).
  const entry = !fishing.lineOut ? diveEntry() : null;
  if (boat.hull.cabin && !fishing.lineOut && canEnterCabin(boat)) {
    if (entry) {
      return { text: 'The cabin, or go diving', run: () => ask(boatTitle(boat), 'Into the cabin (the galley and the bunk), or over the side for a dive?', [
        { text: 'Go diving', cls: 'quiet', run: () => chooseDive(entry) },
        { text: 'Into the cabin', run: () => enterCabin() },
      ]) };
    }
    return { text: 'Into the cabin: galley and bunk', run: () => enterCabin() };
  }
  // Stopped over deep water: over the side.
  if (entry) return { text: 'Go diving', run: () => chooseDive(entry) };
  // In the sailing boat or the cruiser, out on open water: the long passage.
  if ((boat.hull.sail || boat.hull.passage) && !fishing.lineOut && passageWaters()) {
    const to = boat.pos.z > SOUTH_Z ? 'home' : 'south';
    return { text: to === 'south' ? 'The long passage south: four days' : 'The passage home: four days', run: () => offerPassage(to) };
  }

  return null;
}
// Open water to set out from: out of the bays and the harbour (at home, the open sea and the coast;
// at Las Brasas, anywhere outside Puerto Brasa's basin).
function passageWaters() {
  const z = zoneAt(boat.pos.x, boat.pos.z);
  return boat.pos.z > SOUTH_Z ? z !== 'harbor' : z === 'open' || z === 'coast' || z === 'deep';
}

// The chandlery fills your dive tank.
function fillTank() {
  if (state.dive.tank >= SCUBA.full - 0.5) return;
  state.dive.tank = SCUBA.full;
  hud.flash(`They fill your dive tank: ${SCUBA.full} bar.`, t, 3);
  save();
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
  } else if (kind === 'trip') {
    // A rod bending over a fish on the line, and a line of water.
    ctx.beginPath(); ctx.moveTo(cx - 70, cy + 50); ctx.quadraticCurveTo(cx - 30, cy - 70, cx + 30, cy - 52); ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx + 30, cy - 52); ctx.lineTo(cx + 30, cy - 8); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx + 30, cy + 14, 11, 22, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 30, cy + 34); ctx.lineTo(cx + 20, cy + 46); ctx.lineTo(cx + 40, cy + 46); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 30, cy + 2, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, cy + 58); for (let x = 10; x < w - 10; x += 12) ctx.quadraticCurveTo(x + 3, cy + 54, x + 6, cy + 58); ctx.stroke();
  } else if (kind === 'watch' || kind === 'tower') {
    // The watch tower on its hump of an island, broken at the top; seals on the skerry below.
    ctx.beginPath(); ctx.moveTo(14, cy + 30); ctx.quadraticCurveTo(cx - 40, cy - 6, cx + 6, cy - 4); ctx.quadraticCurveTo(cx + 46, cy, cx + 70, cy + 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 22, cy - 2); ctx.lineTo(cx - 22, cy - 62); ctx.lineTo(cx - 14, cy - 56); ctx.lineTo(cx - 8, cy - 66); ctx.lineTo(cx, cy - 52); ctx.lineTo(cx + 8, cy - 48); ctx.lineTo(cx + 8, cy - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 8, cy - 2); ctx.lineTo(cx + 8, cy - 18); ctx.quadraticCurveTo(cx + 2, cy - 26, cx - 4, cy - 18); ctx.lineTo(cx - 4, cy - 2); ctx.stroke();
    ctx.fillRect(cx - 15, cy - 40, 3, 8);
    ctx.beginPath(); ctx.ellipse(w - 46, cy + 34, 24, 6, 0, Math.PI, 0); ctx.stroke();
    for (const [x, s] of [[w - 58, 1], [w - 38, 0.8]]) { ctx.beginPath(); ctx.ellipse(x, cy + 26, 8 * s, 3.5 * s, -0.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(10, cy + 40); for (let x = 10; x < w - 10; x += 12) ctx.quadraticCurveTo(x + 3, cy + 36, x + 6, cy + 40); ctx.stroke();
  } else if (kind === 'sign') {
    // A fingerpost: the post, three pointed arms, a tuft of grass at its foot.
    ctx.beginPath(); ctx.moveTo(cx, cy + 60); ctx.lineTo(cx, cy - 64); ctx.stroke();
    for (const [y, dir, len] of [[-50, 1, 70], [-26, -1, 60], [-4, 1, 52]]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + y - 7); ctx.lineTo(cx + dir * len, cy + y - 7); ctx.lineTo(cx + dir * (len + 10), cy + y); ctx.lineTo(cx + dir * len, cy + y + 7); ctx.lineTo(cx, cy + y + 7);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(cx - 24, cy + 60); for (let x = -24; x <= 24; x += 6) ctx.lineTo(cx + x, cy + 60 - (x % 12 ? 10 : 4)); ctx.stroke();
  } else if (kind === 'cairn') {
    // The fell's top, a cairn on it, and the sea far below.
    ctx.beginPath(); ctx.moveTo(10, cy + 34); ctx.quadraticCurveTo(cx - 40, cy - 30, cx, cy - 34); ctx.quadraticCurveTo(cx + 50, cy - 30, w - 10, cy + 44); ctx.stroke();
    for (const [x, y, r] of [[0, -40, 9], [-8, -50, 7], [6, -51, 6], [-1, -60, 5], [0, -68, 4]]) { ctx.beginPath(); ctx.ellipse(cx + x, cy + y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(14, cy + 56); for (let x = 14; x < w - 14; x += 12) ctx.quadraticCurveTo(x + 3, cy + 52, x + 6, cy + 56); ctx.stroke();
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
// Tam's slate lies in the watch tower on the Calf until you take it.
world.calf.showSlate(!state.adventures.watch?.steps?.slate);

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
      // (Done already, before you read it: its ending was waiting behind the board.)
      else if (noteQueue.length && !modal) showNote(...noteQueue.shift());
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
  world.coast.paintBoard((ctx, w, h) => paintBoard(ctx, w, h, { photo: img, seen: { kittiwake: adventures.status('kittiwake') === 'done', watch: adventures.status('watch') === 'done' } }));
}

function pinWall(id) {
  state.wallPhoto = id;
  adventures.step('wall', 'pinned');
  paintHavenBoard();
  save();
}

/* ---- the Calf: the watch tower ---- */

// Up the tower's broken stair: the view (the map fills in for miles round), and Tam's slate on the
// ledge inside the door, until you take it.
function climbTower() {
  const taken = !!state.adventures.watch?.steps?.slate;
  explored.reveal(CALF_TOWER.x, CALF_TOWER.z, 420);
  audio.rustle?.();
  if (taken) {
    showNote('The watch tower', 'Up the broken stair again: Heron Point, the white water in the Sound, the seals on the skerry, and far off to the east, the light on Willowhaven quay.', 'tower');
    return;
  }
  showNote('The watch tower', 'Up the broken stair to where the floor once was: the whole coast laid out, Heron Point and the white water in the Sound, the seals on the skerry, Willowhaven far off to the east. Coming down, on a ledge inside the door, a roofing slate scratched all over with tally marks. You take it with you.', 'tower');
  world.calf.showSlate(false);
  adventures.step('watch', 'slate');
  if (adventures.status('watch') === 'done') paintHavenBoard();
}

/* ---- up the Coldwater: the fingerpost and the cairn ---- */

const km = (v) => `${v.toFixed(1)} km`;
function readFingerpost() {
  audio.rustle?.();
  showNote('The fingerpost', `Three arms, the paint weathered grey. Up the river: “Hoarfell by the Coldwater, ${km(FELL_SIGN.summit)} · Bothy at Spout Force, ${km(FELL_SIGN.bothy)}”. West over the footbridge: “Coast path · The Landing”. East: “Willowhaven”. Someone has scratched underneath: “allow an hour to the top”.`, 'sign');
}

function addToCairn() {
  audio.rustle?.();
  exploredAt(player().pos.z).reveal(player().pos.x, player().pos.z, 900);
  const first = !state.tips.cairn;
  state.tips.cairn = true;
  const sky = weather.rain > 0.15 ? 'Cloud drags across the top, and the coast comes and goes through it.' : state.hour < 6 || state.hour > 21 ? 'Below, the lights: Willowhaven’s quay, the lighthouse turning out on Gannet Isle.' : 'The whole coast is laid out below: Willow Bay and the Coldwater winding down to it, the Wend estuary, Longmere among its hills, Gannet Isle and the deep water beyond.';
  showNote('Hoarfell', `${first ? 'You pick up a stone on the way to the top, as walkers do, and add it to the cairn.' : 'Another stone on the cairn.'} ${sky}`, 'cairn');
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
// A free berth for her alongside a pontoon finger (Willowhaven's at home, Puerto Brasa's in the
// south), bow out, nearest the walkway first; or null.
function pontoonBerth(b, south = b.pos.z > SOUTH_Z) {
  const others = boats.filter((o) => o !== b);
  const P = south ? PONTOON_S : HAVEN_PONTOON;
  for (const F of south ? FINGERS_S : HAVEN_FINGERS) {
    const out = F.x0 >= P.x1 ? 1 : -1;
    for (const side of [1, -1]) {
      const x = out > 0 ? F.x0 + 0.5 + b.hull.L * 0.5 : F.x1 - 0.5 - b.hull.L * 0.5, z = side > 0 ? F.z1 + 2 : F.z0 - 2;
      const B = berthFor({ hull: b.hull, pos: { x, z }, heading: out * Math.PI / 2 }, others);
      if (B) return B;
    }
  }
  return null;
}
function quayMooring(b) {
  for (const [dx, dz] of [[2.4, -3], [-2.4, -3], [2.4, -7], [-2.4, -7]]) {
    const p = { x: (dx > 0 ? HAVEN_QUAY.x1 : HAVEN_QUAY.x0) + dx * 0.9, z: HAVEN_QUAY.z1 + dz, heading: 0 };
    const taken = boats.some((o) => o !== b && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 3);
    if (!taken && floats(b, p)) return p;
  }
  return null;
}
// Your boats, from either harbour's quay (Willowhaven's quay head, Puerto Brasa's harbour
// office): one in this sea is brought round for you now; one in the other goes on the supply
// ship overnight and is at the pontoon here the next morning at eight. (The bass boat lives on
// Longmere.)
const regionOf = (b) => (b.pos.z > SOUTH_Z ? 'south' : 'home');
const PONTOON_BOATS = ['cruiser', 'console', 'jetski', 'windsurf']; // (their own berths on Willowhaven's pontoon)
function boatsRound(here = regionOf(player())) {
  const south = here === 'south';
  const atHand = (b) => (south ? Math.hypot(b.pos.x - PONTOON_S.x0, b.pos.z - 6320) < 45
    : Math.hypot(b.pos.x - QUAY_HEAD.x, b.pos.z - HAVEN_QUAY.z1) < 14 || (PONTOON_BOATS.includes(b.kind) && Math.hypot(b.pos.x - mooring(b.kind).x, b.pos.z - mooring(b.kind).z) < 6));
  const coming = new Set((state.shipping || []).filter((s) => s.to === here).map((s) => s.kind));
  const near = boats.filter((b) => b.kind !== 'bass' && regionOf(b) === here && !atHand(b) && !coming.has(b.kind));
  const far = boats.filter((b) => b.kind !== 'bass' && regionOf(b) !== here && !coming.has(b.kind) && b !== boat);
  const otherName = south ? 'Willowhaven' : 'Puerto Brasa';
  const onShip = [...coming].map((k) => BOATS[k].name);
  const shipNote = onShip.length ? ` On the supply ship already: the ${onShip.join(' and the ')}, here tomorrow morning.` : '';
  if (!near.length && !far.length) {
    hud.toast(`Your boats are all here already.${shipNote} (The bass boat lives on Longmere.)`, 5);
    return;
  }
  ask(south ? 'The harbour office' : 'Bring a boat round?', `${near.length ? 'A boat in this sea is brought round to the pontoon or the quay for you now.' : ''}${far.length ? ` A boat at ${otherName} goes on the supply ship tonight, and is at the pontoon here at eight tomorrow morning.` : ''}${shipNote}`.trim(), [
    { text: 'Never mind', cls: 'quiet' },
    ...near.map((b) => ({ text: `The ${b.name}`, run: () => bringRound(b, here) })),
    ...far.map((b) => ({ text: `Ship the ${b.name} from ${otherName}`, cls: 'quiet', run: () => shipBoat(b, here) })),
  ]);
}

// A boat in this sea brought round to the pontoon (or Willowhaven's quay).
function bringRound(b, here) {
  const south = here === 'south';
  const p = south || b.hull.passage ? pontoonBerth(b, south) || (south ? null : quayMooring(b)) : quayMooring(b) || pontoonBerth(b, false);
  if (!p) {
    hud.toast('There’s no room alongside just now.', 3);
    return;
  }
  const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
  if (tow && (tow.lead === b || tow.towed === b)) letGoTow(true);
  // (Brought round, her anchor comes up with her.)
  b.anchor = null;
  b.anchored = false;
  b.place(p.x, p.z, p.heading);
  // (Tied up alongside, so she's still there when you come down the steps.)
  const B = berthFor(b, boats, { reach: 4 });
  if (B) {
    b.place(B.x, B.z, B.heading);
    b.tieTo({ ...B, t: 9 });
  }
  passTime(clamp(d / 300, 0.15, 1.5));
  audio.knock(0.4);
  save();
  const pontoon = south || b.hull.passage || (B && PIERS[B.pier] !== HAVEN_QUAY);
  hud.toast(pontoon ? `The ${b.name} is tied up at the pontoon. Down the gangway, step aboard, and cast off (${scheme() === 'touch' ? 'the Cast off prompt' : input.keyLabel('anchor')}) to go.`
    : `The ${b.name} is tied up alongside the quay. Step down into her from the quay steps, and cast off (${scheme() === 'touch' ? 'the Cast off prompt' : input.keyLabel('anchor')}) to go.`, 6);
}

// On the supply ship: she leaves where she is tonight and is at the pontoon in the other
// harbour at eight tomorrow morning.
function shipBoat(b, to) {
  const due = (state.hour < 3 ? state.day : state.day + 1) * 24 + 8;
  state.shipping = [...(state.shipping || []).filter((s) => s.kind !== b.kind), { kind: b.kind, to, due }];
  audio.knock?.(0.3);
  hud.toast(`The ${b.name} goes on the supply ship tonight: she’ll be tied up at the pontoon in ${to === 'south' ? 'Puerto Brasa' : 'Willowhaven'} at eight tomorrow morning. (Sleep, or rest a while.)`, 7);
  save();
}
function deliverShipping() {
  const list = state.shipping || [];
  if (!list.length) return;
  const now = state.day * 24 + state.hour;
  for (const s of [...list]) {
    if (now < s.due) continue;
    const b = BOATS[s.kind];
    state.shipping = state.shipping.filter((x) => x !== s);
    // (Not the boat you're in: she stays with you, and the order's cancelled.)
    if (!b || (b === boat && !onFoot)) continue;
    if (tow && (tow.lead === b || tow.towed === b)) letGoTow(true);
    Object.assign(b, { tie: null, shove: null, anchor: null, anchored: false, lever: 0, power: 0 });
    const south = s.to === 'south';
    const B = pontoonBerth(b, south);
    if (B) {
      b.place(B.x, B.z, B.heading);
      b.tieTo({ ...B, t: 9 });
    } else {
      const p = south ? { x: PONTOON_S.x1 + 9, z: PONTOON_S.z1 + 6, heading: 0 } : mooring(b.kind);
      b.place(p.x, p.z, p.heading);
      b.setAnchor(true, { instant: true });
    }
    if (regionOf(player()) === s.to) hud.toast(`The supply ship is in: the ${b.name} is at the pontoon.`, 5);
    save();
  }
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
    const ay = a.y + (a.lvl || 0);
    const d = Math.hypot(a.x - c.x, ay - c.y, a.z - c.z);
    if (d > (under ? 13 : 5) || (!under && a.y < -0.9)) continue;
    if (_frustum.containsPoint(_pv.set(a.x, ay, a.z))) species.add(a.sp.id);
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
  // The Kittiwake's bell, close enough to make out, under the water.
  const by = heightAt(WRECK_BELL.x, WRECK_BELL.z) + 0.2;
  const bell = under && Math.hypot(WRECK_BELL.x - c.x, by - c.y, WRECK_BELL.z - c.z) < 7 && _frustum.containsPoint(_pv.set(WRECK_BELL.x, by, WRECK_BELL.z));
  return { species: [...species].slice(0, 12), places: places.slice(0, 12), birds, ...(bell ? { bell: true } : {}) };
}

function openPhoto() {
  if (modal || !started) return;
  if (fishing.aiming) fishing.cancel();
  modal = 'photo';
  photoFov = camera.fov;
  hud.hidden(true);
  $('photo-frame').hidden = false;
  $('pf-hint').textContent = { touch: 'Drag to look, pinch to zoom', pad: 'R-stick to look · D-pad ↑ ↓ to zoom · A takes it · B puts the camera away' }[scheme()]
    || `Drag to look · mouse wheel to zoom · ${input.keyLabel('cast')} or ${input.keyLabel('photo')} takes it · Esc puts the camera away`;
  teach('photoMode', `Photo mode: frame your picture and take it. Under the water (${scheme() === 'touch' ? 'the eye button, from a boat' : input.keyLabel('view')}) you can photograph the fish themselves. Your album is in the journal, under Memories.`, 8);
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
  $('pc-text').textContent = [subjects.bell ? 'The Kittiwake’s bell, where it lies.' : '', sp.length ? `In the picture: ${sp.join(', ')}.` : '', pl.length ? `${pl.slice(0, 4).join(', ')}.` : '', subjects.birds ? 'Gulls diving.' : ''].filter(Boolean).join(' ') || 'A quiet moment.';
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
const advCtx = { onFoot: false, player: null, boat: null, underwater: false, cam: null, flocks: [], diving: false, depth: 0 };
function watchAdventures(dt) {
  advT -= dt;
  if (advT > 0) return;
  advT = 0.5;
  advCtx.onFoot = onFoot;
  advCtx.player = player().pos;
  advCtx.boat = boat.pos;
  advCtx.underwater = (rig.underwaterView || underwater.submerge > 0.5) && camera.position.y < -0.05;
  advCtx.cam = camera.position;
  advCtx.flocks = world.flocks;
  advCtx.diving = !!dive;
  advCtx.depth = dive ? diver.depth : 0;
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
  if (observeT > 0 || !(rig.underwaterView || underwater.submerge > 0.5)) return;
  observeT = 0.5;
  camera.getWorldDirection(_fwd);
  const c = camera.position;
  for (const a of eco.agents) {
    if (!a.active || a.state === 'gone' || a.state === 'caught') continue;
    const dx = a.x - c.x, dy = a.y + (a.lvl || 0) - c.y, dz = a.z - c.z, d = Math.hypot(dx, dy, dz);
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
  exploredAt(p.z).reveal(p.x, p.z, onFoot ? 90 : 150);
  for (const pl of PLACES) {
    if (state.places[pl.id] || !pl.test(p.x, p.z)) continue;
    state.places[pl.id] = { day: state.day, hour: state.hour };
    hud.place(pl.name, pl.sub);
    audio.chime();
    hud.toast(`${pl.name} is in your journal now`);
    hud.pulseJournal();
    if (pl.id === 'landing' && !onFoot) teach('landingTip', `Tie up here: ${scheme() === 'touch' ? 'tap the prompt' : `press ${input.keyLabel('interact')}`} to step ashore. Camp is just up the path.`, 6);
    if (pl.id === 'camp') teach('campTip', 'Camp: grill and eat what you catch, swap rods and tackle from the tackle box, and sleep until morning.', 7);
    if (pl.id === 'stream') teach('streamTip', 'Fernbeck’s trout hold in the pools. They’re shy: walk softly, and bring the fly rod from camp.', 7);
    if (pl.id === 'lake') teach('lakeTip', 'Reedmere: perch and pike take lures, carp graze the bottom, rudd sip near the lily pads.', 7);
    if (pl.id === 'quay') teach('quayTip', 'Wend Quay: a camp with a tackle box. Mullet cruise the estuary, flounder lie on the sand, and sea bass hunt the channel at dawn and dusk. The trail inland leads to Longmere.', 9);
    if (pl.id === 'boathouse') teach('boathouseTip', 'The Mere Boathouse: a bass boat at the jetty and a tackle box. Largemouth bass lurk by the pads and the drowned oaks; pike lie in the weed.', 8);
    if (pl.id === 'puffin') teach('puffinTip', 'Puffin Cove: a sheltered camp with a tackle box. After dark, squid gather under the lamp light; wrasse live in the kelp by the rocks.', 8);
    if (pl.id === 'deep') teach('deepTip', 'The Blue Water. Watch for seabirds diving and the sea boiling white: tuna chase the sprat shoals out here.', 8);
    if (pl.id === 'bajon') teach('bajonTip', `El Bajón: lava pinnacles from twenty metres down to three, the shallowest under the yellow buoy. Look down from a boat in this clear water, or dive it (${scheme() === 'touch' ? 'tap the prompt' : input.keyLabel('interact')} over deep water with the boat stopped): sea fans, sponges and orange sun coral, parrotfish and ornate wrasse over the tops, triggerfish, morays in the cracks, a grouper in the cave at its foot, barracuda hanging over it.`, 12);
    if (pl.id === 'haven') teach('havenTip', `Willowhaven: read the notice board for what’s about today, find all your tackle in the chandlery, sit on the bench a while, or have a boat brought round to the quay (${scheme() === 'touch' ? 'tap the prompts' : input.keyLabel('interact')}).`, 10);
    if (pl.id === 'strand') teach('strandTip', 'Shell Strand: bass come into the surf at dusk, and flatfish up the sand after dark. The shelf above the beach is a dry, level place for a tent.', 9);
    if (pl.id === 'head') teach('headTip', 'Cove Head takes the swell: bass and white bream in the wash below the ledges. You can see the Kittiwake’s buoy from the daymark.', 8);
    if (pl.id === 'reach') teach('reachTip', 'The cove channel is sheltered from every wind: a calm place for a float at dusk, and for watching cuttlefish under the water.', 8);
    if (pl.id === 'calf') teach('calfTip', `The Calf: tie up at the landing in its lee and step ashore. Pollack and wrasse live over the kelp under the cliffs, bass hunt the white water off the Nose, and the watch tower looks out over the whole coast (${scheme() === 'touch' ? 'tap the prompt' : input.keyLabel('interact')} at its door).`, 10);
    if (pl.id === 'sound') teach('soundTip', 'Calf Sound: the tide pours through here, the fastest water on the coast. Mackerel, garfish and bluefish hunt sandeels in it: cast a metal or a soft sandeel across the current and let it swing round, or drift through with it. It sets a boat east as it goes.', 10);
    if (pl.id === 'coldfoot') teach('coldfootTip', 'Coldwater Foot: the fingerpost points up the river to the bothy and the top of Hoarfell. The path follows the Coldwater all the way: an hour’s walk to the top, past waterfalls and pools full of trout.', 9);
    if (pl.id === 'bothy') teach('bothyTip', `The bothy: cook, sleep and swap tackle here (${scheme() === 'touch' ? 'tap the prompt' : input.keyLabel('interact')} at the door). Now you’ve walked here, you can come straight back from the map.`, 9);
    if (pl.id === 'tarn') teach('tarnTip', 'Hoar Tarn: small, wild trout rise at dusk in the cold water. Cast a fly or a little spinner along the edge where the shelf drops away.', 8);
    if (pl.id === 'summit') teach('summitTip', `The top of Hoarfell. ${scheme() === 'touch' ? 'Tap the prompt' : `Press ${input.keyLabel('interact')}`} at the cairn to add a stone and look out over the coast.`, 8);
    if (pl.id === 'wreck') teach('wreckTip', `The Kittiwake lies below you. Look under the water (${scheme() === 'touch' ? 'the view button' : input.keyLabel('view')}) to see her, or fish over her: a bottom rig for the conger, a shad for the pollack.`, 9);
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
// Under sail: the boom comes across in a tack, or slams across in a gybe.
// The windsurf board: catapulted in, back up, the rig flipping across; and planing, the first
// time. The jet ski landing off a wave.
BOATS.windsurf.onFall = (b) => {
  if (b !== boat || onFoot) return;
  fx.splash(b.pos.x, 0.05, b.pos.z, 26, 3, 1.6);
  audio.splashBig?.();
  hud.flash(state.tips.catapult ? 'Catapulted in!' : 'Catapulted in! Too much power in the sail for too long. Ease the sheet out in the gusts (or set Sail trim to Helped), and you’ll hold it. You climb back on in a moment.', t, state.tips.catapult ? 2 : 6);
  state.tips.catapult = true;
};
BOATS.windsurf.onUp = (b) => { if (b === boat && !onFoot) hud.flash('Back on the board, the rig up. Sheet in and away.', t, 2.2); };
BOATS.windsurf.onGybe = (b) => {
  if (b !== boat || onFoot) return;
  audio.rustle?.();
  hud.flash('Gybed: the rig flipped across, and away the other way.', t, 1.6);
};
BOATS.windsurf.onTack = (b) => { if (b === boat && !onFoot && b.speed > 0.3) audio.rustle?.(); };
BOATS.jetski.onLand = (b, hit) => {
  if (b !== boat || onFoot) return;
  fx.splash(b.pos.x, 0.05, b.pos.z, Math.round(10 + hit * 8), 1.5 + hit, 1.4);
  audio.knock(clamp(hit / 3, 0.3, 1));
  if (!settings.controls.reducedMotion) rig.shake = Math.max(rig.shake, Math.min(0.22, hit * 0.07));
};
let jetSprayT = 0;

// Sea life: how loud and from which side a sound from (x, z) is, where you are.
function heardFrom(x, z, range) {
  const cp = camera.position, dx = x - cp.x, dz = z - cp.z, d = Math.hypot(dx, dz);
  const fx_ = Math.sin(rig.yaw), fz_ = Math.cos(rig.yaw);
  return { vol: clamp(1 - d / range, 0, 1), pan: clamp(((-fz_ * dx + fx_ * dz) / (d || 1)) * -0.8, -0.8, 0.8) };
}
sealife.onBlow = (x, z, size) => {
  const h = heardFrom(x, z, size > 0.6 ? 700 : 120);
  if (h.vol > 0) audio.blow?.(0.09 * h.vol * (0.5 + size), h.pan, size);
};
sealife.onWhistle = (x, z) => {
  const h = heardFrom(x, z, 45);
  if (h.vol > 0) audio.whistle?.(0.02 * h.vol, h.pan);
};
sealife.onPlunge = (x, z) => {
  fx.splash(x, 0.05, z, 16, 3.4, 0.7);
  fx.ripple(x, z, 1.6, 1.5, 0.6);
  const h = heardFrom(x, z, 260);
  if (h.vol > 0) audio.plunge?.(0.08 * h.vol, h.pan);
};
sealife.onSplash = (x, z, len) => {
  fx.splash(x, 0.05, z, 12 + Math.round(len * 4), 2.2, 0.9);
  fx.ripple(x, z, 1.2 + len * 0.4, 1.4, 0.5);
  const h = heardFrom(x, z, 120);
  if (h.vol > 0) audio.splashSmall?.(0.25 * h.vol, h.pan);
};
// What you've seen goes in the journal; the first time, a word about it.
const seaLifeSeenAt = {};
function seeSeaLife(kind, x, z) {
  const now = performance.now() / 1000;
  if (seaLifeSeenAt[kind] && now - seaLifeSeenAt[kind] < 600) return;
  seaLifeSeenAt[kind] = now;
  const S = (state.seaLife ||= {});
  if (S[kind]) S[kind].n++;
  else {
    S[kind] = { n: 1, day: state.day, hour: state.hour, where: region === 'south' ? 'off Las Brasas' : placeName(x, z) || '' };
    hud.toast(`${SEA_LIFE[kind].note} (The journal keeps the sea life you’ve seen, under Memories.)`, 9);
  }
  save();
}
sealife.onSighting = seeSeaLife;
let glowFishT = 0;
BOATS.sail.onTack = (b) => {
  if (b !== boat || onFoot || b.speed < 0.3) return;
  audio.rustle?.();
  if (!state.tips.tacked) {
    state.tips.tacked = true;
    hud.flash('Tacked: the bow went through the wind and the boom came across. Sail on, close-hauled the other way.', t, 4);
  }
};
BOATS.sail.onGybe = (b) => {
  if (b !== boat || onFoot) return;
  audio.knock(0.9);
  // (A jolt as the boom slams over: the camera's shake is an amount, as for a strike.)
  if (!settings.controls.reducedMotion) rig.shake = Math.max(rig.shake, 0.25);
  hud.flash(state.tips.gybed ? 'Gybe!' : 'Gybe! The wind crossed the stern and the boom slammed across. Haul the sheet in a little before you turn the stern through the wind, and it comes over gently.', t, state.tips.gybed ? 1.4 : 5);
  state.tips.gybed = true;
};
for (const b of boats) {
  if (b.motor) b.onShallow = () => hud.flash(b.kind === 'bass' ? 'Shallow water: the outboard tips up. Ease back to the first notches to creep on with the electric motor.'
    : b.hull.motor?.inboard ? 'Shallow water: her propellers are touching the bottom, so you can only creep along. Steer for deeper water.'
      : `Shallow water: the ${b.hull.motor?.twin ? 'motors tip' : 'motor tips'} up, so you can only creep along. Steer for deeper water.`, t, 3.4);
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
  // (Driven slantwise by the wind: hard across in a gale.)
  const w = windAt(rig.focus.x, rig.focus.z), sx = w.x * 0.045, sz = w.z * 0.045;
  for (let i = 0; i < RAIN_N; i++) {
    const o = i * 6;
    let y = rainPos[o + 1] - 21 * dt;
    let x = rainPos[o] + w.x * 0.8 * dt, z = rainPos[o + 2] + w.z * 0.8 * dt;
    if (y < -1) y += 27;
    if (x > 26) x -= 52; else if (x < -26) x += 52;
    if (z > 26) z -= 52; else if (z < -26) z += 52;
    rainPos[o] = x;
    rainPos[o + 1] = y;
    rainPos[o + 2] = z;
    rainPos[o + 3] = x - sx;
    rainPos[o + 4] = y + 0.75;
    rainPos[o + 5] = z - sz;
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
      weather.state = pick((region === 'south' ? NEXT_SKY_SOUTH : NEXT_SKY)[weather.state]);
      weather.timer = weather.state === 'storm' ? rand(130, 220) : weather.state === 'heavy' ? rand(60, 110) : weather.state === 'light' ? rand(80, 150) : rand(150, 300);
    }
  }
  const sky = SKIES[weather.state];
  // A change you choose settles in about ten seconds; a change by itself drifts in more slowly.
  const rate = (mode === 'auto' ? 0.08 : 0.3) * Math.min(speed, 6);
  weather.rain = damp(weather.rain, weather.override ?? sky.rain, rate, dt);
  weather.cloud = damp(weather.cloud, Math.max(sky.cloud, weather.override ?? 0), rate, dt);
  weather.storm = damp(weather.storm, sky.storm || 0, rate * 0.8, dt);
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
  shadowSpan: 55,
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
  // (Ultra and Cinematic draw more pixels than an ordinary screen has, and smooth them down.)
  const pr = Math.max(0.5, Math.max(q.minRatio, Math.min(window.devicePixelRatio, q.pixelRatio)) * q.scale);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  env.setShadows(q.shadows, q.shadowSize);
  quality.shadowSpan = q.shadowSpan;
  env.air = q.air;
  water.setSegments(q.waterSegments);
  water.setDetail(q.waterDetail);
  reflection.setQuality(q.reflection, q.reflectEvery);
  mist.setLayers(q.mist);
  surfaceUniforms.uDetail.value = q.surfaceDetail;
  ripples.setQuality(q.ripples, q.rippleSpan, renderer);
  water.uniforms.uRippleTexel.value = 1 / Math.max(1, ripples.size);
  rainDrawn = q.rain;
  world.setPixelRatio(pr);
  glow.setPixelRatio(pr);
  world.setQuality(q);
  world.drawDistance = q.drawDistance;
  // Fewer distant fish are drawn on lower settings, but every one of them is still there:
  // simulated, able to bite, and on the fish finder.
  fishRenderer.density = q.fishDensity;
  fishRenderer.near = q.fishNear;
  eco.simRadius = q.simRadius;
  underwater.setQuality(q);
  underwater.setPixelRatio(pr);
  quality.caustics = q.caustics;
  post.setMode(q.post);
  const text = `Graphics: ${qualityText()}`;
  $('title-quality').textContent = text;
}

function applyDifficulty() {
  const d = DIFFICULTY[state.difficulty] || DIFFICULTY.standard;
  fishing.diff = d;
  eco.biteScale = d.bite;
  $('title-difficulty').textContent = `Difficulty: ${d.label}`;
}

// How fussy the fish are, and whether a hooked one can come off (Settings: Fish behaviour).
function applyBehaviour() {
  const B = BEHAVIOUR[state.behaviour] || BEHAVIOUR.relaxed;
  fishing.level = B;
  eco.level = B;
}

function setBehaviour(id) {
  if (fishing.fight) {
    hud.flash('Land this fish first, then change how the fish behave', t, 2.4);
    return;
  }
  state.behaviour = id;
  applyBehaviour();
  save();
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
  labelKeys();
  showControls();
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
  behaviour: () => state.behaviour,
  setBehaviour,
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
  const T = scheme() === 'touch', P = scheme() === 'pad';
  if (dive) {
    hud.chip(rig.mode === 'eye' ? '<b>Through your mask</b> · look straight up or down' : '<b>Diving</b> · just behind you', 2.5);
    return;
  }
  const back = onFoot ? 'back over your shoulder' : 'back to the boat';
  if (rig.mode === 'under') {
    hud.chip(T
      ? '<b>Underwater</b> · drag to look around · pinch to zoom · the view button switches back'
      : `<b>Underwater</b> · ${LOOK()}${P ? '' : ' · scroll to zoom'} · ${K('view')} next view · ${K('reset')} ${back}`, 6);
  } else if (rig.mode === 'bait') {
    hud.chip(T
      ? '<b>Watching your bait</b> · drag to look around · the view button switches back'
      : `<b>Watching your bait</b> · ${LOOK()} · ${K('view')} next view · ${K('reset')} ${back}`, 6);
  } else if (rig.mode === 'eye' && cabinIn) {
    hud.chip(`<b>First person</b> · ${T ? 'drag' : LOOK().replace(/ \(.*\)/, '')} to look round the cabin`, 3);
  } else if (rig.mode === 'eye') {
    hud.chip(T
      ? '<b>First person</b> · drag to look around · the view button switches'
      : `<b>First person</b> · ${LOOK()} · ${P ? `${K('view')} next view` : `${K('eye')} ${back}`}`, 4);
  } else if (rig.mode === 'foot') {
    hud.chip(fishing.baitInWater || T ? '<b>On foot</b>' : `<b>On foot</b> · cast first, then ${K('view')} watches your bait underwater`, 3);
  } else if (rig.mode === 'cabin') hud.chip('<b>The cabin</b> · the roof lifted away', 2);
  else hud.chip('<b>Boat view</b>', 2);
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
  rig.reset(driving ? car : player(), t);
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
  if (dive) {
    // Through the mask: your own body out of the way, the gun out in front (see gunStep).
    diver.setSelfHidden(rig.eyeBlend > 0.5);
    fishing.viewer = null;
    const near = rig.eyeBlend > 0.5 ? 0.05 : 0.1;
    if (camera.near !== near) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    return;
  }
  diver.setSelfHidden(false);
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
    bendRod(A.active, lerp(A.pose.bend, rodView.bend, w), A.pose.bendTo);
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
  tap: 'Tap! Something nipped the lure: strike now',
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

// What the controller's buttons do just now (see gamepad.js).
function padContext() {
  if (!started) return settingsUI.isOpen ? 'menu' : 'title';
  if (modal === 'sleep' || modal === 'travel') return 'off';
  if (!$('confirm').hidden || !$('photo-card').hidden) return 'menu';
  if (modal === 'catch') return 'catch';
  if (modal === 'photo') return 'photo';
  if (modal) return 'menu';
  if (dive) return 'dive';
  if (placement.isOn) return 'place';
  if (driving) return 'drive';
  if (fishing.state === 'reeling') return 'fight';
  // (A line out from a boat under power: the D-pad works the throttle.)
  if (fishing.busy) return leverKind() ? 'troll' : 'fish';
  if (!onFoot && !cabinIn && (boat.motor || boat.hull.emotor || boat.hull.sail || boat.hull.rig)) return 'helm';
  return 'play';
}

function currentHint() {
  if (!started || modal) return '';
  const T = scheme() === 'touch', P = scheme() === 'pad';
  // The movement keys, or the controller's left stick (up and down, or across).
  const UD = P ? `${kbd('L-stick')} ↕` : `${K('forward')}${K('back')}`;
  const LR = P ? `${kbd('L-stick')} ↔` : `${K('left')}${K('right')}`;
  if (driving) {
    if (car.stuckT > 1.5) return T ? 'Stuck? Tap Back on the lane' : `Stuck? ${K('interact')} puts the car back on the lane`;
    if (tanks().car <= 0) return `Out of fuel · ${T ? 'tap the prompt' : K('interact')} for what next (the jerry can, or a can from the farm up the lane)`;
    if (T) return `The stick drives and steers · the button brakes · stop to get out · ${fuelHint('car')}`;
    if (P) return `${kbd('RT')} drive · ${kbd('LT')} brake, hold to reverse · ${LR} steer · stop, then ${K('interact')} to get out · ${fuelHint('car')}`;
    return `${K('forward')}${K('back')} drive and reverse · ${K('left')}${K('right')} steer · hold ${K('cast')} to brake · ${K('view')} view · stop, then ${K('interact')} to get out · ${fuelHint('car')}`;
  }
  if (dive) {
    const tool = dive.kit === 'free' ? 'shoot' : 'photograph';
    if (T) return `The stick swims where you look · drag to look · ▲ ▼ up and down · the button to ${tool}`;
    if (P) return `${kbd('L-stick')} swim where you look · ${kbd('R-stick')} look · ${K('interact')} up · ${K('tackle')} down · ${K('jog')} kick hard · ${K('cast')} ${tool}`;
    return `${UD} swim where you look · ${LR} turn · drag to look · ${K('interact')} up · ${K('tackle')} down · hold ${K('jog')} to kick hard · ${K('cast')} ${tool} · ${K('view')} view`;
  }
  if (cabinIn) {
    return T ? 'In the cabin · the stick walks between the galley and the bunk · tap the prompt to use them'
      : `In the cabin · ${UD} the galley and the bunk · ${K('interact')} use · ${K('cancel')} back out on deck · ${K('eye')} through your eyes`;
  }
  const space = K('cast');
  const cancel = T ? '✕ cancels' : `${K('cancel')} cancel`;
  const info = fishing.info;
  switch (fishing.state) {
    case 'aiming': {
      // Holding loads the rod and the ring moves out; let go when it's where you want it.
      if (fishing.kind === 'fly') {
        const when = fishing.flyForward ? 'let go now, as the rod comes forward' : fishing.deliver ? 'it goes out on the next forward stroke' : 'false casting: each stroke shoots more line';
        return `${T ? 'Hold to false cast' : `Hold ${space} to false cast`} · ${when} · ${T ? 'stick left/right aims' : `${LR} aim`}${windHint()} · ${cancel}`;
      }
      const how = T ? 'Let go when the ring is where you want it' : `Let go of ${space} when the ring is where you want it`;
      const clean = fishing.assist ? 'the wind is allowed for' : fishing.overload > 0 ? 'overloading: let go now' : fishing.sweet ? 'fully loaded: let go for a perfect cast' : 'let go before it overloads';
      const extra = fishing.kind === 'lure' ? (T ? 'up/down: reeling speed' : `${UD} reeling speed`)
        : fishing.kind === 'float' ? (T ? 'up/down: bait depth' : `${UD} bait depth`) : '';
      return `${how} (${clean}) · ${T ? 'stick left/right aims' : `${LR} aim`}${extra ? ` · ${extra}` : ''}${windHint()} · ${cancel}`;
    }
    case 'drifting':
      // Trolling: the boat under power, the lure swimming along behind it.
      if (leverKind() && boat.power > 0.01 && fishing.kind === 'lure' && fishing.status !== 'follow') {
        const words = leverWords(leverKind(), boat.lever);
        return T ? `Trolling at ${words}: the lure swims along behind the boat · the lever changes speed · hold the button to reel in`
          : `Trolling at ${words}: the lure swims along behind the boat · ${K('throttleUp')}${K('throttleDown')} speed · ${LR} steer · hold ${space} to reel in`;
      }
      if (fishing.status === 'curious') return 'Something is curious about your bait. Keep still…';
      if (fishing.status === 'nibble') return 'Nibbling… wait for the float to go under';
      if (fishing.status === 'follow') return T ? 'It’s following! Tap to twitch, or let go to pause' : `It’s following! Tap ${space} to twitch, or let go to pause`;
      if (fishing.status === 'rising') return 'A fish is coming up to look. Let the fly drift…';
      if (fishing.kind === 'lure') {
        if (info.fouled) return T ? 'Weed on the lure: hold to reel in, or tap to flick it' : `Weed on the lure: hold ${space} to reel in, or tap to flick it`;
        return T
          ? `Hold to reel (${info.retrieve}; stick up/down changes speed) · tap to twitch · let go to pause`
          : `Hold ${space} to reel · ${UD} speed: ${info.retrieve} · tap to twitch · let go to pause`;
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
      if (T) return `Stick up/down: bait depth · hold the button to reel in · tap to twitch${state.tips.under ? '' : ' · drag the view up to sink it under the water'}`;
      return `${UD} bait depth · hold ${space} to reel in · tap to twitch${state.tips.under ? '' : ` · ${P ? `${kbd('R-stick')} up` : 'drag up'} to sink the view under the water`}`;
    case 'bite': {
      const k = fishing.biteKind;
      const what = k === 'strike' ? 'It hit the lure!' : k === 'tap' ? 'A tap on the lure!' : k === 'run' ? 'A run!' : k === 'sip' ? 'It took the fly!' : k === 'take' ? 'The indicator dipped!' : 'Bite! The float went under.';
      return T ? `${what} Tap the button to strike` : `${what} Press ${space} to strike`;
    }
    case 'reeling': {
      const F = fishing.fight;
      const drag = `${T ? 'stick up/down' : UD} drag: ${DRAG_NAMES[F?.drag ?? 2]}${P ? ` (${kbd('LT')} eases it)` : ''}`;
      if (F?.selfHooked && !F.pickedUp) return T ? 'Fish on! It hooked itself on the rig. Hold the button to pick up the rod and play it' : `Fish on! It hooked itself on the rig. Hold ${space} to pick up the rod and play it`;
      if (F && F.tension > 0.97) return T ? 'The line is straining! Let go of the button' : `The line is straining! Let go of ${space}`;
      if (F?.surgeT > 0) return T ? 'It’s surging! Let go of the button' : `It’s surging! Let go of ${space}`;
      if (F && !F.pulling && F.warned) return 'A flick on the surface: it’s about to run. Ease off';
      if (F?.jumping > 0) return T ? 'It’s leaping! Keep holding: keep the line tight' : `It’s leaping! Keep holding ${space}: keep the line tight`;
      // (Side pressure: the rod swung low against its run.)
      const side = T ? '' : ` · ${LR} swing the rod against its run`;
      if (F?.pulling) return `${F.slipping ? 'It’s taking line against the drag.' : F.style?.words || 'It’s pulling.'} ${T ? 'Hold' : `Hold ${space}`} to keep pressure on and tire it${side} · ${drag}`;
      return `${T ? 'Hold the button' : `Hold ${space}`} to reel it in · ease off when it surges · ${drag}`;
    }
    case 'casting': case 'landing': case 'caught': case 'releasing': case 'keeping': case 'retrieving': return '';
    default:
  }
  if (placement.isOn) return '';
  if (onFoot) {
    if (!state.tips.walked) return T ? 'Drag on the left to walk · drag on the right to look around' : `${MOVE()} to walk · ${K('jog')} jog · ${LOOK()}`;
    if (!state.places.camp && Math.hypot(walker.pos.x - world.camp.firePos.x, walker.pos.z - world.camp.firePos.z) < 60) return 'Follow the path up to camp';
    return '';
  }
  if (leverKind()) {
    const kind = leverKind(), lv = boat.lever;
    const dead = kind === 'kayak' ? boat.kflat : boat.trolling ? boat.flat : boat.dry && Math.abs(lv) >= 0.03;
    const word = boat.anchored ? 'at anchor' : dead ? (kind === 'kayak' ? 'battery flat' : 'the motor’s dead: an oar, slowly') : leverWords(kind, lv);
    const fuel = kind === 'kayak' ? batteryWords(tanks(), 'kayak') : fuelHint(boat.kind);
    const motor = kind === 'kayak' ? ` · ${T ? 'Raise motor to paddle' : `${K('motor')} raise it and paddle`}` : kind === 'sail' ? ` · ${T ? 'Raise the outboard on the lever' : `${K('outboard')} outboard up`}` : '';
    if (T) return `${kind === 'kayak' ? 'Motor' : 'Throttle'}: ${word} · the stick: up or down a notch, across to steer · Stop on the lever · ${fuel}`;
    if (P) return `${kind === 'kayak' ? 'Motor' : 'Throttle'}: ${word} · ${kbd('L-stick')} ↕ a notch, ↔ steer · ${K('neutral')} stop · ${K('anchor')} anchor${motor} · ${fuel}`;
    return `${kind === 'kayak' ? 'Motor' : 'Throttle'}: ${word} · ${UD} a notch · ${LR} steer · ${K('neutral')} stop · ${K('anchor')} anchor${motor} · ${fuel}`;
  }
  // The windsurf board: the sheet and leaning the rig to steer; ease out in the gusts.
  if (boat.hull.rig) {
    if (boat.fallen > 0) return 'In the water: you climb back on and pull the rig up in a moment';
    if (T) return 'The stick: up sheets in, down eases out, across steers · ease out in the gusts';
    if (P) return `${kbd('L-stick')} ↕ sheet in and out, ↔ steer · ease out in the gusts · ${K('anchor')} tie up`;
    return `${K('forward')} sheet in · ${K('back')} ease · ${LR} steer · ease out in the gusts or you'll be catapulted in · ${K('anchor')} tie up`;
  }
  // The sailing boat: the sheet and the helm, and the sail up or down.
  if (boat.hull.sail) {
    if (!boat.sailUp) return T ? 'Row with the stick · Raise sail or the outboard on the panel' : `${MOVE()} row · ${K('motor')} raise the sail · ${K('outboard')} the outboard`;
    if (T) return 'The stick: up hauls the sheet in, down eases it, across steers · Haul in and Ease on the panel';
    if (P) return `${kbd('L-stick')} ↕ sheet in and out, ↔ steer · ${K('motor')} lower the sail · ${K('anchor')} anchor`;
    return `${K('forward')} haul in · ${K('back')} ease · ${LR} steer · ${K('motor')} lower the sail · ${K('anchor')} anchor`;
  }
  // The kayak, paddling: a word on its motor, until you've tried it.
  if (boat.hull.emotor && !state.tips.kayakMotor) {
    return T ? 'Paddle with the stick · the Lower motor button gives you a quiet electric motor' : `${MOVE()} paddle · ${K('motor')} lowers the quiet electric motor`;
  }
  if (!state.tips.rowed) return T ? 'Drag on the left to row · drag on the right to look around' : `${MOVE()} to row · ${LOOK()}`;
  if (!state.tips.cast) return T ? 'Hold the button to aim and cast your line' : `Hold ${space} to aim and cast your line`;
  if (state.tips.caught && !state.tips.journal) return T ? 'Tap Journal to see what you’ve found' : `${K('journal')} to open your journal`;
  if (state.tips.caught && !state.places.camp) return 'Your camp is on the west shore of the bay: row to the landing (follow the Camp marker)';
  if (state.tips.caught && !state.tips.under) return T ? 'Drag the view up and it sinks beneath the water' : `${P ? `${kbd('R-stick')} up` : 'Drag the view up'} and it sinks beneath the water (${K('view')} for a fixed underwater view)`;
  if (state.tips.caught && !state.tips.sonar) return T ? 'The sonar button shows a fish finder' : `${K('finder')} for the fish finder`;
  return '';
}

const ACTION_LABELS = {
  idle: 'Cast', aiming: 'Let go', casting: '', drifting: 'Twitch', bite: 'Strike!', reeling: 'Reel',
  landing: '', caught: 'Let go', releasing: '', keeping: '', retrieving: '',
};

function actionLabel() {
  if (modal === 'note') return 'OK';
  if (dive) return dive.kit === 'scuba' ? 'Photo' : shot.loaded ? 'Shoot' : '…';
  if (driving) return 'Brake';
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
  const w = weather.storm > 0.5 ? 'Storm' : weather.rain > 0.6 ? 'Heavy rain' : weather.rain > 0.15 ? 'Light rain' : weather.cloud > 0.7 ? 'Overcast' : '';
  hud.clock(formatClock(h), phaseName(h), w, night);
  // How you feel, in a word or two by the clock (the worst first), and well fed when you are.
  const needs = needsMode() === 'off' ? [] : needsOf(state.comfort, state.food);
  const words = needs.slice(0, 2).map((n) => n.word);
  if (camp.wellFed && !needs.some((n) => n.id === 'hungry' || n.id === 'peckish')) words.push('Well fed');
  hud.food(words.join(' · '), needs.some((n) => n.low) ? 'hungry' : camp.wellFed ? 'fed' : '');
  hud.hint(currentHint(), t);
  updateLever();
  updateSailPanel();
  const act = interaction();
  hud.prompt(act ? (scheme() === 'touch' ? `Tap: ${act.text}` : `${K('interact')} ${act.text}`) : '');
  // Beside it, the mooring prompt (anchor, tie up, cast off, let go a tow), on its own key.
  const moor = mooringAction();
  hud.prompt2(moor ? (scheme() === 'touch' || moor.busy ? moor.text : `${K('anchor')} ${moor.text}`) : '');
  const F = fishing.fight;
  // Ease off: the flick before a run, and the surge as it starts.
  const easy = fishing.state === 'reeling' && !!F && (F.surgeT > 0 || (F.warned && !F.pulling));
  if (touch.active) hud.action(actionLabel(), fishing.state === 'bite' || easy);
  $('cancel-btn').hidden = !(touch.active && fishing.aiming);
  updateDiveHud();

  if (fishing.aiming) {
    // Outer ring: how far it will go. Inner ring: the rod's load (amber in the sweet spot, red
    // when it's overloading); for the fly rod, the stroke (amber as it comes forward).
    const fly = fishing.kind === 'fly';
    const load = fly ? (fishing.flyForward ? 1 : 0.35) : fishing.power;
    const warm = fly ? (fishing.flyForward ? 0.6 : 0.2) : fishing.overload > 0 ? 1 : fishing.sweet ? 0.6 : 0.2;
    const sub_ = fishing.overload > 0 ? 'overload' : fishing.sweet ? 'sweet spot' : wind.strength > 0.15 ? `wind ${Math.round(wind.strength * FRESH * 3.6)} km/h ${windArrow()}` : '';
    hud.meter(true, fishing.power, load, warm, fishing.aimValid ? `<span>${Math.round(fishing.castDist)} m</span>${sub_ ? `<span class="ml-sub">${sub_}</span>` : ''}` : '—', -1, fishing.sweet || (fly && fishing.flyForward));
  }
  else if (fishing.state === 'reeling' && F) {
    // The ring: how near you are to landing it, and the load on the line (red and shaking near
    // breaking). The word: what to do now, and under it what the fish is doing and the line out.
    const word = F.surgeT > 0 ? 'easy!' : easy ? 'flick!' : F.tension > 0.9 ? 'ease off!' : F.slipping ? 'line out' : F.pulling ? 'hold' : 'reel';
    const doing = F.wordT > 0 ? F.word : fishing.side && F.pulling ? `side strain ${fishing.side < 0 ? '←' : '→'}` : F.stage !== 'fresh' ? F.stage : '';
    const out = Math.round(fishing.tip.distanceTo(fishing.fishPos));
    hud.meter(true, F.progress, F.tension, F.tension, `<span>${word}</span>${doing ? `<span class="ml-sub">${doing}</span>` : ''}<span class="ml-sub">${out} m out</span>`, DRAG_LEVELS[F.drag], easy, F.tension > 0.86);
  }
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
    const text = fishOn ? 'Fish on!' : k === 'float' ? 'Bite — strike!' : k === 'tip' ? 'Tip pulls — strike!' : k === 'grab' ? 'Squid — strike!' : k === 'sip' ? 'Rise — strike!' : k === 'tap' ? 'Tap — strike!' : 'Strike!';
    hud.bite((_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight, _p.z < 1, text, fishOn);
  } else hud.bite(0, 0, false);

  // Where the boat is while you're ashore; where camp is until you've found it.
  const cp = world.camp.firePos;
  placed.length = 0;
  // (On the first trip only the guide's marker and the car's: one thing to look for at a time.)
  const guiding = state.guide.on;
  placeMarker($('boat-marker'), boat.pos.x, boat.heave + 1.6, boat.pos.z, started && onFoot && !driving && !modal && !nearBoat() && !(insideHome(walker.pos.x, walker.pos.z)) && !guiding);
  const carD = Math.hypot(car.pos.x - player().pos.x, car.pos.z - player().pos.z);
  // (Not twice over: when the guide is pointing at the car, its marker is the one.)
  const guideOnCar = guiding && guideTarget?.label === 'Car';
  placeMarker($('car-marker'), car.pos.x, car.pos.y + 2.2, car.pos.z, started && onFoot && !driving && !dive && !modal && carD > 18 && carD < 600 && !carHome() && !guideOnCar);
  const campD = Math.hypot(player().pos.x - cp.x, player().pos.z - cp.z);
  placeMarker($('camp-marker'), cp.x, cp.y + 2.4, cp.z, started && !modal && !dive && campD > 14 && !guiding && !(onFoot && insideHome(walker.pos.x, walker.pos.z)) && (onFoot ? campD < 400 : !state.places.camp && !!state.tips.caught));
  const gt = guideTarget, gd = gt ? Math.hypot(gt.x - player().pos.x, gt.z - player().pos.z) : 0;
  placeMarker($('guide-marker'), gt?.x ?? 0, (gt?.y ?? heightAt(gt?.x ?? 0, gt?.z ?? 0)) + 1.8, gt?.z ?? 0, !!gt && guiding && started && !modal && gd > 3.5);
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

// The dive computer (depth, breath or air, the way up), and what's in the speargun's sights.
let diveShown = false;
function updateDiveHud() {
  const on = !!dive && started && !modal && !hudOff;
  if (on !== diveShown) {
    diveShown = on;
    $('dive').hidden = !on;
    if (!on) {
      $('dive-aim').hidden = true;
      diveVeil.style.setProperty('--low', '0');
      diveVeil.style.setProperty('--black', '0');
    }
  }
  if (!on) return;
  const d = dive, depth = diver.depth, free = d.kit === 'free';
  hud.setHTML('dvKind', $('dv-kind'), free ? 'Freediving' : 'Scuba');
  hud.setHTML('dvDepth', $('dv-depth'), `${depth.toFixed(1)} m`);
  const bottom = Math.max(0, -heightAt(diver.pos.x, diver.pos.z));
  let info = `bottom ${bottom.toFixed(0)} m`;
  let fill, mark = -1, warn = false;
  if (free) {
    fill = d.o2;
    mark = depth > 1 ? Math.min(1, breathToSurface(depth)) : -1;
    const surf = diver.atSurface(t);
    hud.setHTML('dvGas', $('dv-gas'), surf ? (d.o2 < 0.98 ? 'Breathing up' : 'Breath') : `Breath · ${Math.round(d.hold)} s`);
    warn = !surf && d.o2 < mark;
  } else {
    const bar = state.dive.tank;
    fill = bar / SCUBA.full;
    mark = SCUBA.reserve / SCUBA.full;
    warn = bar <= SCUBA.reserve;
    hud.setHTML('dvGas', $('dv-gas'), `Air · ${Math.round(bar)} bar`);
    if (!diver.atSurface(t)) info = `${Math.floor(minutesLeft(bar, depth))} min to reserve · ${info}`;
    if (d.rate > SCUBA.maxAscent && depth > 0.8) info = 'SLOW · up too fast';
    else if (d.stop.need && !d.stop.done && depth < 9) info = depth >= SCUBA.stopAt[0] && depth <= SCUBA.stopAt[1] ? `safety stop · ${Math.ceil(d.stop.left)} s` : `safety stop at ${SCUBA.stopAt[0]}–${SCUBA.stopAt[1]} m`;
  }
  hud.setHTML('dvInfo', $('dv-info'), info);
  $('dv-fill').style.width = `${(clamp(fill, 0, 1) * 100).toFixed(1)}%`;
  $('dv-turn').style.left = `${(clamp(mark, 0, 1) * 100).toFixed(1)}%`;
  $('dv-turn').hidden = mark < 0;
  $('dive').classList.toggle('warn', warn);
  // The gun, or the camera.
  hud.setHTML('dvTool', $('dv-tool'), free
    ? `${d.fresh ? 'No spearfishing in fresh water' : shot.loaded ? 'Speargun loaded' : shot.state === 'loading' ? 'Loading the bands…' : 'Shaft out…'} · creel ${state.keep.length}/${creelSize(state)}`
    : `Camera ready · ${state.photos.length}/${PHOTO_MAX} photos`);
  // The sights: what's there, roughly how big, and whether to take it.
  const A = free && !d.fresh ? aim : null;
  $('dive-aim').hidden = !free || d.fresh;
  $('dive-aim').classList.toggle('on', !!A);
  $('dive-aim').classList.toggle('bad', !!A && !A.ok);
  $('dive-aim').classList.toggle('far', !!A && A.ok && A.far);
  hud.setHTML('daText', $('da-text'), A
    ? `${A.known ? A.sp.name : 'A fish'} · ${sizeGuess(A.size)}${!A.ok ? ` · ${A.small ? 'too small' : 'not this one'}` : A.far ? ' · closer' : A.quality === 'poor' ? ' · aim further forward' : ''}`
    : '');
}

/* ---------------- input ---------------- */

let saveWarned = false;
function save() {
  for (const [k, b] of Object.entries(BOATS)) {
    state.boats[k] = { x: b.pos.x, z: b.pos.z, heading: b.heading, anchored: b.anchored && b.anchor?.phase !== 'haul', ...(b.emotorDown || b.outboardDown ? { motor: true } : {}), ...(b.sailUp ? { sail: Math.round(b.sheet * 100) / 100 } : {}) };
    // (Where her anchor lies, or the berth she's tied up at, so she's found just as she was left.)
    if (b.anchor && b.anchor.phase !== 'haul') state.boats[k].anchor = { x: b.anchor.x, z: b.anchor.z };
    if (b.tie) state.boats[k].tie = { pier: b.tie.pier, side: b.tie.side, along: b.tie.along, heading: b.tie.heading };
  }
  const kindOf = (b) => Object.keys(BOATS).find((k) => BOATS[k] === b);
  state.tow = tow ? { lead: kindOf(tow.lead), towed: kindOf(tow.towed) } : null;
  state.vessel = boat.kind;
  state.mode = onFoot ? 'foot' : 'boat';
  state.walker = onFoot ? { x: walker.pos.x, z: walker.pos.z, heading: walker.heading } : null;
  // In the water, you're saved where you went in: aboard, or on the bank.
  if (dive) {
    if (dive.boat) {
      state.mode = 'boat';
      state.vessel = dive.boat.kind;
      state.walker = null;
    } else state.walker = { ...dive.back };
  }
  // The car where it is; at the wheel, you're saved standing by its door (you get out on loading).
  const at = state.car.at;
  state.car = { x: Math.round(car.pos.x * 100) / 100, z: Math.round(car.pos.z * 100) / 100, yaw: Math.round(car.heading * 1000) / 1000, at: driving ? parkNear(car.pos.x, car.pos.z, 9) : at };
  if (driving) {
    const sp = carExitSpot();
    if (sp) state.walker = { x: sp.x, z: sp.z, heading: car.heading };
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  state.sky = { cloud: r3(weather.cloud), rain: r3(weather.rain), storm: r3(weather.storm), state: weather.state, timer: r3(weather.timer) };
  state.seen = explored.toString();
  state.seenSouth = exploredSouth.toString();
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
        newGame({ quality: state.quality, volumes: state.volumes, music: state.music, difficulty: state.difficulty, behaviour: state.behaviour, settings: state.settings });
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
  const home = onFoot && atHomeNow();
  // (At Las Brasas: the island, or its harbour.)
  const south = player().pos.z > SOUTH_Z, puerto = south && Math.hypot(player().pos.x - PUERTO_AT.x, player().pos.z - PUERTO_AT.z) < 160;
  setTimeout(() => hud.place(south ? (puerto ? 'Puerto Brasa' : 'Las Brasas') : home ? 'Home' : onFoot ? (names[zone] || 'The west shore') : 'Willow Bay', returning ? 'welcome back' : home ? 'the cottage and the garage' : onFoot ? 'by the camp' : 'home waters'), 900);
  if (newPlayer) offerGuide();
  rig.settleUntil = t + 2.5;
  if (state.sonar) toggleFinder(true);
  if (cloudStart?.note) setTimeout(() => hud.toast(cloudStart.note, 8), 2600);
  else if (LOAD_NOTES[loaded.outcome]) setTimeout(() => hud.toast(LOAD_NOTES[loaded.outcome], 9), 2600);
  // A camp whose ground changed with an update: what happened to it (nothing in it is lost).
  campNotes.forEach((n, i) => setTimeout(() => hud.toast(n, 10), 12000 + i * 11000));
  // A drive that was under way when the game closed: finished now (you're there, with the car).
  if (state.outing.travel) {
    const to = state.outing.travel.to;
    arrive(to);
    setTimeout(() => hud.toast(`${to === 'home' ? 'Home' : DESTS[to].name}: the drive finished while the game was closed. Everything you packed is with you.`, 8), 2400);
  }
  refreshHomeGear(true);
  refreshHomeWall();
  // Home and the garage: offered (never forced) to anyone who was already playing, and to new
  // players once they've found their feet.
  if (!state.outing.intro) {
    const offer = () => {
      if (state.outing.intro || modal || !started) return;
      state.outing.intro = true;
      save();
      ask('Home & the garage', `You have a home now: a cottage and its garage on the east arm, up the lane above Shell Strand. The garage keeps your rods, tackle and camping gear, with a workbench for planning an outing, and the car is on the drive. Nothing changes where you are: go whenever you like (the map, or your backpack’s “Head back to”).`, [
        { text: 'Later', cls: 'quiet', run: () => hud.toast('Home is on the map whenever you want it.', 4) },
        { text: 'Go home now', run: () => travel('home') },
      ]);
    };
    if (returning && (state.log.length || state.camps.length)) setTimeout(offer, 7000 + campNotes.length * 11000);
    else homeIntroAt = 150;
  }
  // Las Brasas, new: a word about it (and how to get there), once.
  if (returning && state.log.length && !state.tips.brasaIntro && !state.tips.brasa) {
    setTimeout(() => {
      if (state.tips.brasaIntro || state.tips.brasa) return;
      state.tips.brasaIntro = true;
      hud.toast(`New: Las Brasas, a volcanic island four days’ sail to the south, with warm clear water and fish you never see at home. Take the sailing boat out of the bay and ${scheme() === 'touch' ? 'tap the prompt' : `press ${input.keyLabel('interact')}`} for the long passage (or stand beside her at Willowhaven quay).`, 13);
      save();
    }, 15000 + campNotes.length * 11000);
  }
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

// Las Brasas' chart: its heights from the island's own water map, baked when first needed.
mapSheet.addSheet('south', SOUTH_MAP, exploredSouth, () => {
  const W = southWater();
  return { data: W.tex.image.data, width: 560, height: 560, rect: SOUTH_WATER };
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
  photoHint: () => (scheme() === 'touch'
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
  returnToBench();
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
  renderGuideRow();
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
  returnToBench();
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
    else if (is('pack') || is('map') || is('journal')) hud.flash(`Pitch the camp or cancel (${input.keyLabel('cancel')}) first.`, t, 2);
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
  if (modal === 'harbour') {
    if (code === 'Escape' || is('interact')) closeHarbour();
    return;
  }
  if (modal === 'bench') {
    if (code === 'Escape') closeBench();
    return;
  }
  if (modal === 'outsheet') {
    if (code === 'Escape' || (is('interact') && outSheet.mode !== 'drive')) closeOut();
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
  // At the wheel: the car's own keys (the movement keys drive; Space brakes, held).
  if (driving && !modal) {
    const act = interaction();
    if (is('interact') && act) act.run();
    else if (is('tackle')) { if (Math.abs(car.speed) < 0.6) openOutSheet('drive'); else hud.flash('Stop first.', t, 1.5); }
    else if (is('view')) cycleView();
    else if (is('eye')) toggleFirstPerson();
    else if (is('reset')) resetView();
    else if (is('map')) openMap();
    else if (is('pack')) openPack();
    else if (is('settings')) openSettings();
    else if (is('photo') && Math.abs(car.speed) < 0.6) openPhoto();
    else if (is('hide')) {
      hudOff = !hudOff;
      hud.hidden(hudOff);
    }
    return;
  }
  // Inside the cabin: its own few keys (the prompt, back out, the views and the panels).
  if (cabinIn && !modal) {
    const act = interaction();
    if (is('interact') && act) act.run();
    else if (code === 'Escape' || is('cancel')) leaveCabin();
    else if (is('eye') || is('view')) toggleFirstPerson();
    else if (is('reset')) resetView();
    else if (is('pack')) openPack();
    else if (is('map')) openMap();
    else if (is('settings')) openSettings();
    else if (is('photo')) openPhoto();
    else if (is('finder')) toggleFinder();
    else if (is('hide')) {
      hudOff = !hudOff;
      hud.hidden(hudOff);
    }
    return;
  }
  // In the water: its own few keys.
  if (dive && !modal) {
    if (is('cast')) diveAction();
    else if (is('interact')) interaction()?.run();
    else if (is('view')) cycleView();
    else if (is('eye')) toggleFirstPerson();
    else if (is('reset')) resetView();
    else if (is('photo')) openPhoto();
    else if (is('map')) openMap();
    else if (is('settings')) openSettings();
    else if (is('finder') || is('pack')) hud.flash('Out of the water first', t, 1.4);
    else if (is('hide')) {
      hudOff = !hudOff;
      hud.hidden(hudOff);
    } else if (code === 'Escape' && rig.mode !== rig.third) resetView();
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
  else if (is('drink')) takeDrink();
  else if (is('feed')) looseFeed();
  else if (is('advice')) giveAdvice(true);
  else if (is('conditions')) {
    settings.weather.panel = !settings.weather.panel;
    hud.flash(settings.weather.panel ? 'Conditions panel shown' : 'Conditions panel hidden', t, 1.4);
    save();
  }
  else if (is('anchor')) mooringAction()?.run();
  else if (is('neutral') && leverKind()) leverNeutral(true);
  else if (is('throttleUp') && leverKind()) stepLever(1);
  else if (is('throttleDown') && leverKind()) stepLever(-1);
  else if (is('motor')) {
    // (On a controller, the sailing boat's one button goes round sail, outboard and oars.)
    if (!onFoot && !driving && !cabinIn && boat.hull.sail) {
      if (pads.active && boat.sailUp) toggleOutboard();
      else if (pads.active && boat.outboardDown) toggleOutboard();
      else toggleSail();
    } else toggleKayakMotor();
  } else if (is('outboard')) toggleOutboard();
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
  if (acts.includes('cast') && !dive) fishing.onUp();
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
$('prompt2').addEventListener('click', () => mooringAction()?.run());
$('j-settings-open').addEventListener('click', () => openSettings());
$('gd-fold').addEventListener('click', () => {
  state.guide.min = !state.guide.min;
  guideText = '';
  guideT = 0;
  save();
});
$('gd-end').addEventListener('click', endGuide);
$('mem-guide-btn').addEventListener('click', () => {
  if (state.guide.on) endGuide();
  else {
    beginGuide();
    hud.toast('The guide is on: the card at the top of the screen shows the way.', 5);
  }
});
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
applyBehaviour();
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
  measureGuide();
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
let fuelCheckT = 0;
let last = performance.now();

// A brand-new game begins at home: in front of the cottage, with the car on the drive. (Nobody
// needs telling about a home they're standing in.)
const newPlayer = isNewGame(state) && !state.guide.offered;
if (newPlayer) {
  state.mode = 'foot';
  state.walker = { ...HOME_START };
  state.outing.intro = true;
}

// Back where you left off: on foot if that's where you were (and somewhere you can stand:
// otherwise you're back in your boat).
const W0 = state.walker;
if (state.mode === 'foot' && W0 && inWorld(W0.x, W0.z) && walkHeight(W0.x, W0.z) > -0.55) {
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
  ecoCtx.env.storm = Math.max(weather.storm, conditions.sea.storm);
  ecoCtx.env.daylight = env.daylight;
  ecoCtx.env.night = env.night;
  ecoCtx.env.hatch = hatchLevel();
  const lanternLit = boat.hasLantern && boat.lanternLevel > 0.3;
  ecoCtx.env.lanternNear = lanternLit && Math.hypot(boat.pos.x - COVE.x, boat.pos.z - COVE.z) < COVE.r + 30;
  // After dark the old jetty's lamp and the lamp at Puffin Cove's camp draw squid too.
  ecoLights.length = 0;
  if (lanternLit) ecoLights.push({ x: boat.pos.x, z: boat.pos.z });
  if (env.lantern > 0.3) ecoLights.push({ x: world.lampPos.x, z: world.lampPos.z }, { x: GANNET_CAMP.x, z: GANNET_CAMP.z - 14 });
  // (Puerto Brasa's lights after dark: the bar's terrace and the harbour light.)
  if (env.lantern > 0.3 && world.brasa) ecoLights.push(...world.brasa.lights);
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
  ecoCtx.walker = onFoot && !dive ? walkerCtx : null;
  ecoCtx.diver = dive ? diverCtx : null;
  ecoCtx.lantern = lanternLit ? ecoCtx.boat : null;
  eco.update(dt, ecoCtx);
}

function tick(now, manual = false) {
  const rawDt = Math.max(0, (now - last) / 1000);
  const dt = Math.min(rawDt, 0.05);
  last = now;
  t += dt;
  conditions.time = t;
  watchRegion();
  deliverShipping();
  // (At Las Brasas before El Bajón was there to find: a word about it, once, a moment after you
  // start.)
  if (started && region === 'south' && !modal && !passage && !state.places.bajon && state.tips.brasa && t > 8) {
    teach('bajonNews', 'New at Las Brasas: El Bajón, a reef of lava pinnacles just west of the harbour mouth, under a yellow buoy. Sea fans, sponges and the island’s own fish: parrotfish, wrasse, triggerfish, morays and a grouper. The water is clear enough to see it from a boat; better still, dive it.', 12);
  }
  if (!manual) watchFrameRate(rawDt);
  pads.poll(dt);

  // (Not in the water: time can't drift by on one breath, or a tank.)
  const resting = started && (!modal || modal === 'camp') && input.resting && !dive;
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
  updatePassage(dt);
  updateWaiting(dt);
  camp.update(dt, hours);
  updateComfort(dt, hours);
  if (gearDirty && !fishing.busy) applyGear();

  // The movement keys row the boat or walk you along the shore; while aiming they swing
  // the cast and set the bait depth (or lure speed), and while the line is out up/down does that.
  let throttle = 0, steer = 0;
  move.x = 0;
  move.z = 0;
  fishing.side = 0;
  carIn.throttle = 0;
  carIn.steer = 0;
  if (started && (!modal || mapAboard())) {
    const ti = input.throttle, si = input.steer;
    if (fishing.aiming) {
      // In first person the keys turn your head (and the cast with it); otherwise they swing the cast.
      if (rig.mode === 'eye') rig.turn(si, dt, t);
      else fishing.aimBy(si, dt);
      fishing.depthBy(ti, dt);
      if (leverKind()) throttle = boat.lever;
    } else if (fishing.lineOut) {
      // (On a controller, LT eases the drag off while a fish is on.)
      fishing.depthBy(pads.active && fishing.state === 'reeling' && pads.lt > 0.4 ? -1 : ti, dt);
      // With a fish on, across swings the rod low to that side (side pressure, to turn it);
      // otherwise in a boat it steers.
      // (The steer keys give +1 for left; side pressure counts left as −1.)
      if (fishing.state === 'reeling') fishing.side = -si;
      else if (!onFoot) steer = si;
      // (Under power the motor runs on at its notch while you fish: trolling.)
      if (leverKind()) throttle = boat.lever;
    } else if (dive) {
      // In the water: forward and back swim where you look, across turns you, and the
      // interact and tackle keys (E and Q) swim straight up and down.
      diveIn.fwd = ti;
      diveIn.up = (input.holding('interact') ? 1 : 0) - (input.holding('tackle') ? 1 : 0);
      diveIn.kick = input.jogging || (pads.active && pads.jog);
      if (si) rig.turn(si, dt, t);
    } else if (driving) {
      // On a controller the triggers drive: RT to go, LT to brake and then reverse.
      carIn.throttle = pads.active ? pads.rt - pads.lt : ti;
      carIn.steer = si;
    } else if (onFoot) {
      // Camera-relative: W walks away from the camera, A/D to the sides.
      const yaw = rig.yaw, fx_ = Math.sin(yaw), fz_ = Math.cos(yaw);
      move.x = fx_ * ti + fz_ * si;
      move.z = fz_ * ti - fx_ * si;
    } else if (cabinIn) {
      // Inside the cabin: forward and back walk between the doorway, the galley and the bunk.
      cabinInput(ti);
    } else if ((boat.hull.sail || boat.hull.rig) && boat.sailUp) {
      // Under sail (or on the windsurf board): forward and back haul in and ease the sheet (it
      // stays where you leave it), across steers.
      sailInput(ti, dt);
      steer = si;
    } else if (leverKind()) {
      // At the helm: the throttle lever moves a notch at a time (the keys, or the stick pushed
      // and let go) and stays where you leave it; steering is the stick or keys across.
      helmInput(ti, dt);
      throttle = boat.lever;
      steer = si;
    } else {
      throttle = ti;
      steer = si;
      // (Tied up, the oars or the paddle can't take her anywhere: a word on casting off.)
      if (boat.tie && (ti || si) && t > tieWordT) {
        tieWordT = t + 4;
        hud.flash(`Tied up alongside: cast off first (${scheme() === 'touch' ? 'the Cast off prompt' : K('anchor')})`, t, 2.4);
      }
    }
  }
  if (boat.motor && (onFoot || (modal && !mapAboard()) || cabinIn)) throttle = 0;
  // What's allowed with a line out or a fish on (a lever left higher comes back).
  if (leverKind()) {
    watchHookup();
    const v = within(leverKind(), boat.lever, leverSituation());
    if (v !== boat.lever) changeLever(v);
    if (throttle) throttle = boat.lever;
  } else fishWas = fishing.state;
  if (throttle !== 0) {
    rowTime += dt;
    if (rowTime > 3 && !state.tips.rowed) {
      state.tips.rowed = true;
      save();
    }
  }
  watchStuck(dt, !driving && !dive && !!(move.x || move.z));
  if (onFoot && (move.x || move.z)) {
    walkTime += dt;
    if (walkTime > 3 && !state.tips.walked) {
      state.tips.walked = true;
      save();
    }
  }

  // Petrol for the motor you're running (or the bass boat's battery); a dry tank or a flat
  // battery leaves the motor dead and an oar to row with. The battery charges at a jetty.
  {
    const f = tanks();
    for (const b of boats) {
      b.dry = isPetrol(b.kind) && fuelLevel(f, b.kind) <= 0;
      b.flat = b.kind === 'bass' && f.battery <= 0;
    }
    BOATS.kayak.kflat = f.kayak <= 0;
    // The kayak's motor on its battery; flat, it comes up and you paddle (never stranded).
    if (boat.kind === 'kayak' && boat.emotorDown && throttle && !onFoot && burnKayak(f, boat.power || throttle, dt) === 'flat') {
      boat.setEMotor(false);
      hud.flash('The kayak’s battery is flat: the motor’s up, paddle on. It charges at a jetty, and overnight.', t, 5);
    }
    if (boat.motor && throttle && !onFoot) {
      // (The sailing boat's outboard has no electric notches: it's hull.outboard, not hull.motor.)
      const ran = burnBoat(f, boat.kind, throttle, dt, boat.hull.motor?.troll || 0);
      const what = scheme() === 'touch' ? 'tap the prompt' : K('interact');
      if (ran === 'dry') hud.flash(`The outboard splutters and stops: the tank is dry. An oar moves her along, slowly; stop, then ${what} for the jerry can or a tow.`, t, 6);
      if (ran === 'flat') hud.flash('The electric motor whines down: the battery is flat. It charges at a jetty, and overnight; the outboard still runs.', t, 5);
    }
    if (hours && moored(BOATS.bass)) chargeBattery(f, hours);
    if (hours && moored(BOATS.kayak)) chargeBattery(f, hours, 'kayak');
    fuelCheckT -= dt;
    if (fuelCheckT <= 0) {
      fuelCheckT = 1;
      if (!onFoot && isPetrol(boat.kind) && boat.motor) watchTank(boat.kind);
      if (driving) watchTank('car');
    }
  }
  boat.update(dt, t, throttle, steer, env.lantern);
  for (const b of boats) if (b !== boat) b.update(dt, t, 0, 0, env.lantern);
  // The wind lines: round the boat while you sail (or wherever you are, if you like them always).
  {
    const L = settings.weather.windLines, sailing = !onFoot && !driving && !dive && (boat.hull.sail || boat.hull.rig) && boat.sailUp;
    const P = onFoot ? walker.pos : boat.pos;
    _wl.set(P.x, onFoot ? walker.pos.y : boat.heave, P.z);
    windLines.update(dt, t, _wl, started && !modal && (L === 'always' ? !dive : L === 'sailing' && sailing), camera);
  }
  updateTow(dt);
  keepBoatsApart();
  if (cabinIn) placeInCabin(dt);
  if (dive) {
    if (!modal) updateDive(dt);
  } else {
    diveIn.fwd = diveIn.up = 0;
    diveIn.kick = false;
  }
  for (const b of boats) if (b.hull.cabin) b.setCabinLight(env.night, !!cabinIn && b === boat);
  // The motor: a putter at idle when you're aboard, rising with the throttle. Fish nearby
  // hear it, so slow down (or anchor) before you fish. (The bass boat's electric motor is
  // almost silent, and doesn't bother them.)
  // (The kayak's motor is electric too: a faint hum.)
  const kayakOn = !onFoot && boat.kind === 'kayak' && boat.emotorDown && !boat.kflat;
  const motorOn = !onFoot && ((boat.motor && !(boat.trolling ? boat.flat : boat.dry)) || kayakOn);
  const outboard = motorOn && boat.motor && !boat.trolling;
  const voice = onFoot ? '' : boat.hull.motor?.jet ? 'jet' : boat.hull.motor?.inboard ? 'inboard' : '';
  audio.engine?.(motorOn ? (outboard ? Math.max(0.12, Math.abs(boat.power) * (boat.tilted ? 0.5 : 1)) : 0.03 + Math.abs(boat.power) * 0.02) : 0, voice);
  // The windsurf board up on the plane for the first time: a word.
  if (!onFoot && boat.hull.rig && boat.planing > 0.8) teach('planing', 'Planing! The board’s up on the water and flying. Keep the sheet just in, and ease out in the gusts.', 6);
  // The jet ski's plume: spray thrown up behind it at speed (none while it's in the air).
  if (!onFoot && boat.kind === 'jetski' && Math.abs(boat.forwardSpeed) > 4 && !boat.air) {
    jetSprayT -= dt;
    if (jetSprayT <= 0) {
      jetSprayT = 0.06;
      const k = clamp((Math.abs(boat.forwardSpeed) - 4) / 12, 0, 1);
      fx.splash(boat.pos.x - boat.fwd.x * 1.8, 0.1, boat.pos.z - boat.fwd.z * 1.8, Math.round(2 + 4 * k), 1.6 + 3 * k, 0.35);
    }
  }
  motorNoiseT -= dt;
  if (outboard && Math.abs(boat.power) > 0.25 && motorNoiseT <= 0) {
    motorNoiseT = 0.5;
    eco.startle(boat.pos.x, -0.6, boat.pos.z, 5 + boat.speed * 1.4, 0.7);
  }
  // First person: you face where you look.
  if (rig.mode === 'eye' && onFoot && !(move.x || move.z)) walker.heading = dampAngle(walker.heading, rig.yaw, 10, dt);
  if (onFoot && !driving && !dive) walker.update(dt, t, move, { jog: input.jogging || (pads.active && pads.jog), locked: fishing.busy, obstacles: solids });
  // The car: driven while you're at the wheel (a menu open puts the brake on); otherwise parked.
  {
    const live = driving && started;
    // (A dry tank: the engine's dead, though the brakes and the steering still work.)
    const dry = tanks().car <= 0;
    const bump = car.update(dt, t, { throttle: modal || dry ? 0 : carIn.throttle, steer: modal ? 0 : carIn.steer, brake: live && (modal || input.holding('cast')) ? 1 : 0 }, carWorld, { live, night: env.night, still: settings.controls.reducedMotion });
    if (bump) carBumped(bump);
    if (live && !dry && carIn.throttle && burnCar(tanks(), Math.abs(car.speed) * dt)) {
      hud.flash(`The engine coughs and dies: the tank is dry. Roll to a stop, then ${scheme() === 'touch' ? 'tap the prompt' : K('interact')}.`, t, 5);
    }
    if (driving) {
      walker.pos.set(car.pos.x, car.pos.y, car.pos.z);
      walker.ground = car.pos.y;
      refreshCarSolids();
      watchParking(dt);
      audio.car?.(Math.min(1, Math.abs(car.speed) / 12), started && !modal && !dry ? Math.abs(carIn.throttle) : 0, !dry);
    } else audio.car?.(0, 0, false);
  }
  fishing.update(dt, t, rig.yaw, started && !modal && !placement.isOn && !driving && !cabinIn && !dive && input.action);
  // (On the open map, you move across it as you go.)
  if (modal === 'map') mapSheet.follow(player());

  ecoTick(dt);
  handleClues();
  fx.update(dt, t, boat);
  // The sea life round you, and (after dark, some nights more than others) the sea glowing
  // wherever it's stirred: fish darting near the surface, a moving lure, a diver's kicks.
  {
    const P = player().pos, aboard = !onFoot && !driving && !dive && !cabinIn;
    sealife.update(dt, t, { from: P, boat: aboard ? boat : null, boatSpeed: aboard ? Math.abs(boat.forwardSpeed) : 0, daylight: env.daylight, region, eco, diving: !!dive });
    // The harbour's people going about their day, and Dougie's boat.
    town.update(state.day * 24 + state.hour, folkCtx(dt));
    folkView.update(dt, t, town, { from: P, south: region === 'south', fx, glow, night: env.lantern });
    glow.update(t, nightGlow(state.day) * smoothstep(0.35, 0.85, env.night) * (1 - 0.5 * (weather.rain ?? 0)));
    glow.foamColor(fx.wake.material.color, env.daylight);
    glowFishT -= dt;
    if (glow.level > 0.04 && glowFishT <= 0) {
      glowFishT = 0.2;
      for (const a of eco.agents) {
        if (!a.active || a.state === 'gone' || a.y < -2 || a.speed < 0.35 || Math.abs(a.x - P.x) > 30 || Math.abs(a.z - P.z) > 30) continue;
        glow.spawn(a.x, a.z, a.speed > 1.2 ? 3 : 1, 0.2 + a.scale * 0.3, 0.6, t);
      }
      if (fishing.lineOut && (fishing.relSpeed ?? 0) > 0.3) glow.spawn(fishing.hook.x, fishing.hook.z, 2, 0.25, 0.6, t);
      if (dive && diver.pos.y > -3) glow.spawn(diver.pos.x, diver.pos.z, 4, 0.8, 0.9, t);
      // (Your own wake or oars alight: you've seen the sea glow.)
      if (glow.level > 0.2 && !onFoot && !driving && boat.speed > 0.8) seeSeaLife('glow', boat.pos.x, boat.pos.z);
    }
  }

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
  if (driving) car.eyePoint(_eye);
  else if (dive) diver.eyePoint(_eye);
  else if (onFoot || cabinIn) walker.eyePoint(_eye);
  else boat.eyePoint(_eye, steadyCam);
  if (!onFoot && steadyCam) _eye.y = eyeY = Math.abs(eyeY - _eye.y) > 1 ? _eye.y : damp(eyeY, _eye.y, 0.3, dt);
  else eyeY = _eye.y;
  // Indoors (with the roof lifted), the camera comes in closer and looks down a little more.
  rig.indoor = onFoot && !driving && !!insideHome(walker.pos.x, walker.pos.z);
  rig.update(dt, t, { boat, walker, started, fishing, baitFocus: fishing.watchPoint, eye: _eye, roll: onFoot || steadyCam || cabinIn ? 0 : boat.roll * 0.45 });
  // The first time the view dips under the water by itself: a word on how it works.
  if (rig.below && started && !state.tips.under) {
    state.tips.under = true;
    hud.chip(`<b>Under the water</b> · ${scheme() === 'pad' ? `${kbd('R-stick')} down` : 'drag down'} to come back up`, 3.5);
    save();
  }
  updateFirstPerson(dt);
  const P = player().pos;
  // In first person the shadows gather in front of you, finer, where you're looking.
  const fpShadow = rig.eyeBlend > 0.5;
  env.setShadowSpan(Math.round(quality.shadowSpan * (fpShadow ? 0.55 : 1)));
  if (fpShadow) {
    camera.getWorldDirection(_shadowAt).setY(0).normalize();
    _shadowAt.multiplyScalar(12).add(P);
  }
  // A storm's lightning (and its thunder, arriving later) and the spray off the seas.
  stormFx.update(dt, t, { storm: Math.max(weather.storm, conditions.sea.storm * 0.8), camera, env, onThunder: (d, loud) => audio.thunder?.(d, loud), flashes: !settings.controls.reducedMotion });
  watchStorm(dt);
  env.update(dt, t, state.hour, weather.rain, fpShadow ? _shadowAt : P, camera, renderer, weather.cloud);
  const sub = underwater.updateMedium(t, camera, env, scene, water, weather.rain);
  postLook.under = sub;
  audio.setUnderwater(sub);
  underwater.update(dt, t, camera, env, weather.rain);
  fishRenderer.update(dt, camera, env.night, sub > 0.5);
  updateWind(dt * Math.min(speed, 10));
  world.update(dt, t, env, { fireLevel: camp.fireLevel, hatchLevel: hatchLevel(), hour: state.hour, wind: 0.5 + Math.min(1, windAt(camera.position.x, camera.position.z).speed / FRESH) * 1.3, camera, fog: scene.fog.color, hurry: !!(traveling || sleeping) });
  {
    const abs = state.day * 24 + state.hour;
    campView.update(dt, t, env, state.camps, player().pos, {
      wind: Math.min(1, windAt(player().pos.x, player().pos.z).speed / FRESH),
      still: settings.controls.reducedMotion,
      cooking: (c) => (c.cooking ? { fish: c.cooking, done: clamp((abs - c.cooking.start) / c.cooking.dur, 0, 1) } : c.store.meals[0] ? { fish: c.store.meals[0], done: 1 } : null),
    });
  }
  world.home.update(dt, t, { from: player().pos, cam: camera.position, night: env.night, cutaway: rig.mode !== 'eye', onDoor: (open) => audio.door?.(open) });
  homeT -= dt;
  if (homeT <= 0) {
    homeT = 0.5;
    if (Math.hypot(player().pos.x - HOME.x, player().pos.z - HOME.z) < 120) {
      refreshHomeGear();
      refreshHomeWall();
    }
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
  zoneW.open = damp(zoneW.open, (zone === 'open' || zone === 'coast' || zone === 'deep' || zone === 'veril' || zone === 'ocean' || zone === 'lava') && !onFoot ? 1 : 0, 0.5, dt);
  zoneW.cove = damp(zoneW.cove, zone === 'cove' ? 1 : 0, 0.5, dt);
  const seaD = landSDF(P.x, P.z);
  const fireD = P.distanceTo(world.camp.firePos);
  // (Your own camp's stove, while something's in the pan.)
  let ownCookD = Infinity;
  for (const c of state.camps) if (c.cooking) ownCookD = Math.min(ownCookD, Math.hypot(P.x - c.x, P.z - c.z));
  const windHere = windAt(P.x, P.z);
  // Up the Coldwater: the beck running beside you (louder in the quick, steep runs), the roar of
  // the falls, and the stillness of the tarn.
  const cold = coldInfo(P.x, P.z);
  const beck = cold.l > 0.05 ? (1 - smoothstep(2, 30, cold.d - cold.w)) * clamp(0.55 + cold.steep * 3, 0, 1) : 0;
  const falls = Math.max(...FALLS.map((F) => {
    const a = COLDWATER[F.top], b = COLDWATER[F.foot], big = a.l - b.l > 20;
    return (1 - smoothstep(8, big ? 170 : 110, Math.hypot(P.x - b.x, P.z - b.z))) * (big ? 1 : 0.7);
  }));
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
      (1 - smoothstep(30, 120, Math.hypot(P.x - PUERTO_AT.x, P.z - PUERTO_AT.z))) * 0.7,
      1 - smoothstep(25, 110, Math.hypot(P.x - STACKS[0].x, P.z - STACKS[0].z)),
      1 - smoothstep(25, 120, Math.hypot(P.x - SKELLIG.x, P.z - SKELLIG.z)),
      1 - smoothstep(25, 100, Math.hypot(P.x - SKERRIES[0].x, P.z - SKERRIES[0].z)),
      ...world.flocks.map((f) => 1 - smoothstep(20, 160, Math.hypot(P.x - f.x, P.z - f.z))),
    ),
    water: onFoot ? Math.max(1 - smoothstep(3, 30, -seaD), 1 - smoothstep(3, 30, Math.min(mereSDF(P.x, P.z), riverSDF(P.x, P.z)))) : 1,
    stream: Math.max(1 - smoothstep(1.5, 24, streamSDF(P.x, P.z)), beck),
    lake: Math.max(1 - smoothstep(2, 35, lakeSDF(P.x, P.z)), 1 - smoothstep(2, 45, mereSDF(P.x, P.z)), (1 - smoothstep(2, 30, riverSDF(P.x, P.z))) * 0.6, (1 - smoothstep(2, 40, tarnSDF(P.x, P.z))) * 0.7),
    fire: camp.fireLevel * (1 - smoothstep(2, 18, fireD)),
    sizzle: Math.max(camp.cooking ? 1 - smoothstep(2, 12, fireD) : 0, 1 - smoothstep(2, 12, ownCookD)),
    stove: 1 - smoothstep(1.5, 9, ownCookD),
    harbour: Math.max(1 - smoothstep(15, 70, Math.hypot(P.x - HAVEN.x, P.z - HAVEN.z)), 1 - smoothstep(20, 90, Math.hypot(P.x - PUERTO_AT.x, P.z - PUERTO_AT.z))),
    inlet: 1 - smoothstep(10, 60, Math.min(...CHANNEL.map((c) => Math.hypot(P.x - (c[0] + c[2]) / 2, P.z - (c[1] + c[3]) / 2)), Math.hypot(P.x - COVE.x, P.z - COVE.z))),
    head: Math.max(1 - smoothstep(15, 90, Math.hypot(P.x - DAYMARK.x, P.z - (DAYMARK.z + 20))), 1 - smoothstep(15, 80, Math.hypot(P.x - (CALF.x - CALF.rx), P.z - CALF.z))),
    race: Math.max(1 - smoothstep(10, 110, Math.hypot(P.x - (CALF_SOUND.x0 + CALF_SOUND.x1) / 2, P.z - (CALF_SOUND.z0 + CALF_SOUND.z1) / 2)), falls),
    seals: 1 - smoothstep(15, 70, Math.hypot(P.x - CALF_SKERRY.x, P.z - CALF_SKERRY.z)),
    flap: !onFoot && boat.sailUp ? boat.flutter * smoothstep(1, 6, windHere.speed) : 0,
    gale: smoothstep(11, 18, windHere.speed),
    tent: state.camps.reduce((m, c) => Math.max(m, 1 - smoothstep(3, 18, Math.hypot(P.x - c.x, P.z - c.z))), 0),
    // (Las Brasas: shearwaters calling over the island after dark.)
    shearwaters: region === 'south' ? 1 - smoothstep(150, 700, Math.abs(landSDF(P.x, P.z))) : 0,
  });

  if (started && homeIntroAt > 0 && !modal && !state.outing.intro) {
    homeIntroAt -= dt;
    if (homeIntroAt <= 0) {
      homeIntroAt = 0;
      state.outing.intro = true;
      hud.toast('There’s a home for you up the lane above Shell Strand: a cottage and a garage with the camping gear, a workbench and a car. It’s on the map.', 10);
      save();
    }
  }
  if (started) {
    checkPlaces(dt);
    updateGuide(dt);
    watchCamps();
    watchBirds(dt);
    // An open board keeps up with the hour: it's read off the water as it is now.
    if (modal === 'board' && $('board-sub').textContent !== `${formatClock(state.hour)} · day ${state.day}`) renderBoard();
    if (slateDay !== state.day) chalkSlate();
    // The fish in your creel: on ice, or in a cool-lined creel, their freshness keeps.
    const nowH = state.day * 24 + state.hour;
    if (chilledTo < nowH) chill(state, chilledTo, nowH);
    chilledTo = nowH;
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
  if (onFoot && !dive && walker.wading > 0.05 && (move.x || move.z) && !fishing.busy) {
    wadeT -= dt;
    if (wadeT <= 0) {
      wadeT = walker.jogging ? 0.18 : 0.3;
      fx.ripple(walker.pos.x + rand(-0.15, 0.15), walker.pos.z + rand(-0.15, 0.15), 0.6 + walker.wading * 0.6, 1.4, 0.3 + walker.wading * 0.25);
    }
  }

  if (!manual) draw();
}

let homeT = 0;
let homeIntroAt = 0; // seconds of play before a new player hears about home (0: not waiting)
const carIn = { throttle: 0, steer: 0 };
let wadeT = 0;
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
  if (post.on) post.finish(camera, lookOfTheHour());
}

// The colour of the hour for the finishing pass: warm at sunrise and in the golden hour, a little
// cool by moonlight, plain in rain and underwater (where the water has its own colour).
const postLook = { sunDir: env.sunDir, sunColor: new THREE.Color(), low: 0, night: 0, tint: new THREE.Color(), sat: 1, under: 0 };
const _warm = new THREE.Color(1.045, 1.0, 0.93), _cool = new THREE.Color(0.95, 0.98, 1.05), _rose = new THREE.Color(1.035, 0.985, 0.985);
function lookOfTheHour() {
  const L = postLook, h = state.hour, clear = (1 - weather.rain) * (1 - weather.cloud * 0.6) * (1 - L.under);
  L.sunColor.copy(env.sunColor).convertLinearToSRGB();
  // How low and strong the sun is: the shafts come with it.
  L.low = smoothstep(-0.03, 0.05, env.sunDir.y) * (1 - smoothstep(0.22, 0.5, env.sunDir.y)) * clear;
  const golden = smoothstep(16.8, 18.4, h) * (1 - smoothstep(19.6, 20.6, h));
  const dawn = smoothstep(5.2, 6, h) * (1 - smoothstep(7.2, 8.6, h));
  L.tint.setRGB(1, 1, 1).lerp(_warm, golden * clear).lerp(_rose, dawn * clear).lerp(_cool, env.night * (1 - L.under));
  L.sat = 1 - weather.rain * 0.06 - L.under * 0.03;
  L.night = env.night * (1 - L.under);
  return L;
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
  car, travel: (d) => travel(d), driveTo: (d, how) => driveTo(d, how), enterCar: () => enterCar(), exitCar: () => exitCar(),
  openBench: (st) => openBench(st), get driving() { return driving; }, get modalName() { return modal; },
  state, walker, fishing, env, weather, renderer, post, scene, camera, quality, eco, habitat, rig, finder, underwater, camp, world, explored, stormFx,
  get boat() { return boat; }, // the boat you're in (or last used)
  reflection, ripples, mist, fx, rodView, audio, settingsUI, input, packUI, pads, sealife, glow,
  // The first-trip guide as it stands: the step, its words and where it points.
  guideNow: () => ({ step: stepOf(state.guide), title: $('gd-title').textContent, text: $('gd-text').textContent, target: guideTarget, shown: !$('guide').hidden }),
  firstPerson: (on = true) => rig.setFirstPerson(on, t),
  setHour: (h) => { state.hour = ((h % 24) + 24) % 24; },
  // Diving: start here (kit 'free' or 'scuba', where there's water deep enough), and look inside.
  diving: {
    get state() { return dive; }, diver, shot, get aim() { return aim; },
    entry: () => diveEntry(), start: (kit = 'free') => { diveSpotCache.t = -1; const e = diveEntry(); if (e) startDive(kit, e); return !!e; },
    end: (to) => endDive(to), exit: () => diveExit(), fire: () => fireSpear(),
  },
  setRain: (r) => { weather.override = r; weather.rain = r; },
  setWeather: (id) => { settings.weather.mode = id; if (id !== 'auto') weather.state = id; },
  // Graphics preset: 'auto', 'high', 'medium' or 'low'.
  setGraphics: (preset) => { settings.graphics.preset = preset; applyQuality(); },
  teleport: (x, z, heading = boat.heading) => boat.place(x, z, heading),
  // The long passage: slowTide.passage('south') to Las Brasas, ('home') back; which sea you're in.
  passage: (to = 'south') => startPassage(to),
  get region() { return region; },
  // Put yourself ashore at (x, z), e.g. slowTide.walkTo(-99, -2) for camp.
  walkTo: (x, z, heading = walker.heading) => {
    walker.place(x, z, heading);
    if (!onFoot) setFoot(true);
  },
  board: () => board(),
  // The field guide open at a species, e.g. slowTide.openGuide('bluemarlin').
  openGuide: (id) => openGuide(id),
  rowboat, skiff, boats: BOATS, wind, town, folkView,
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
