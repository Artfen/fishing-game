import * as THREE from 'three';
import { Input, defaultBindings } from './input.js';
import { SettingsUI, WEATHER_MODES } from './settings.js';
import { loadGame, saveGame, newGame, saveStatus, parseSave, importSave, exportText, stopSaving, SAVE_KEY, adoptJournal } from './save.js';
import { Cloud } from './cloud.js';
import { Together, cleanName, suggestName, NAME_MAX, CALLS, PAID_MAX } from './together.js';
import { setupOffline, offline, applyUpdate, checkForUpdate } from './offline.js';
import { RELEASE, BUILD, BUILT } from './version.js';
import { DIFFICULTY, DIFFICULTY_IDS, DRAG_LEVELS, DRAG_NAMES, breakReason } from './fight.js';
import { BEHAVIOUR, conditionWords } from './behaviour.js';
import { HUD, kbd } from './ui.js';
import { AudioScape } from './audio.js';
import { Environment, phaseName, formatClock } from './world/sky.js';
import { WorldClock, advance as advanceClock, HOUR_SECONDS, rateAt } from './world/clock.js';
import { SKIES, createWeather, stepWeather, skyOf } from './world/weather.js';
import { createWater } from './world/water.js';
import { conditions, updateConditions, windAt, currentAt, currentScale, waveHeight, waveHeightHere, compass, bearingOf, windWords, seaWords, shelterAt, bakeShelter, shelterRect, TIDE, tidalTexture } from './world/conditions.js';
import { SOUTH_WATER, SOUTH_MAP, LANDFALL, POSADA, PUERTO as PUERTO_AT, PONTOON_S, FINGERS_S } from './world/brasa.js';
import { buildWorld } from './world/world.js';
import { createHabitat } from './world/habitat.js';
import { HEAVY as PRESSURE_HEAVY, CELL as PRESSURE_CELL } from './world/pressure.js';
import { seaTemp, tempWords } from './world/seatemp.js';
import { Ecosystem } from './world/ecosystem.js';
import { FishRenderer } from './world/fishRender.js';
import { Underwater } from './world/underwater.js';
import { Seabed } from './world/seabed.js';
import { Drifters } from './world/drifters.js';
import { siteAt, siteById, pushOut, detailsNear, SITE_DETAILS } from './world/divesites.js';
import { Reflection, RippleField, NO_REFLECT, hideFromReflection } from './world/waterfx.js';
import { createMist } from './world/mist.js';
import { surfaceUniforms } from './world/surface.js';
import { causticUniforms } from './world/caustics.js';
import {
  bakeHeightTexture, heightAt, walkHeight, solidHeight, landSDF, lakeSDF, streamSDF, zoneAt, waterOf, riverSDF, mereSDF, waterLevel, depthAt,
  PLACES, START, WATER_RECT, SHORE_RECT, STACKS, COVE, LANDING, PIERS, BOATHOUSE_PIER, WORLD, SEA, inSeas, inWorld, SOUTH_Z, CROSSING,
  PEGS, POOLS, STREAM, SNAG, LILIES, JETTY, ISLAND, GANNET_CAMP, SKERRIES, SKELLIG, DEEP_Z,
  HAVEN, HAVEN_QUAY, HAVEN_BENCH, DAYMARK, STRAND, WRECK, WRECK_BUOY, WRECK_BELL, CHANNEL,
  HOME, HOME_START, HOUSE, GARAGE, CAR_PARKS, FUEL_PUMPS, HAVEN_PONTOON, HAVEN_FINGERS, OWN_FINGER, VISITOR_FINGERS, HARBOUR_OFFICE, laneInfo,
  CALF, CALF_TOWER, CALF_SKERRY, CALF_SOUND, CALF_LANDING,
} from './world/terrain.js';
import { Car } from './car.js';
import { TRAILABLE, TRAILER_HOME, launchSpot, loadable } from './trailer.js';
import { MAX_AFLOAT, homeOf, STORE_WORDS, LAUNCH_WORDS, NEW_AFLOAT, chooseAfloat, ownBerths, cleanStored } from './fleet.js';
import { Workbench, OutingSheet } from './workbench.js';
import { KIT, KIT_IDS, DESTS, launchOf, parkNear, driveMinutes, moveKit, reconcile, campOfKit, campHas, statusOf, snapshot } from './outing.js';
import { insideHome, HOME_SPOTS } from './world/home.js';
import { insideHaven, HAVEN_ROOMS, ROOM_SPOTS } from './world/havenHouses.js';
import { ENDS, CROSS_M, crossProgress, onCrossing, inOcean, arrived, tradeAt, oceanAt, seaKindly, LONG_RANGE, crossSeconds, crossHours, CROSS_FUEL, bearingTo, pointWords, steerFor, planCrossing, ISLAND_SEEN, cleanPassages } from './crossing.js';
import { buildCrossingLife } from './world/crossingLife.js';
import { BOTHY_DOOR, FELL_SIGN } from './world/fell.js';
import { trimAdvice, bestSheet, SAIL } from './sailing.js';
import { SailUI } from './sailui.js';
import { WindLines } from './world/windlines.js';
import { Storm } from './world/storm.js';
import { coldInfo, COLDWATER, FALLS, tarnSDF } from './world/coldwater.js';
import { Boat, BOAT_KINDS, boatDetail } from './boat.js';
import { wakes } from './world/wakes.js';
import { Walker } from './walker.js';
import { Effects } from './effects.js';
import { sprayPoints, sprayRate, sprayVelocity } from './spray.js';
import { FoamTracks, FoamTrailView } from './world/foamTrails.js';
import { buildSeaLife, SEA_LIFE } from './world/sealife.js';
import { buildBirds } from './world/birds.js';
import { species as allSpecies } from './taxonomy.js';
import { CatchInspector } from './inspect.js';
import { buildWildlife } from './world/wildlife.js';
import { seeSign, readSign, SIGNS, SEEN_AT, stepColour, colourKey, colourWords, NATURE, noteNature, groundsOf, groundWords } from './grounds.js';
import { newToday, notePlace, noteMove, noteBoat, noteDive, noteSeen, noteSky, noteGale, noteRecord, closeDay, dayLine, checkChallenges, isSheltered, CHALLENGES, challengeById, dayPage, dayText, noteSat, noteCrossing, careerOf } from './daybook.js';
import { SeaGlow, nightGlow } from './world/seaglow.js';
import { Fishing } from './fishing.js';
import { drawFishSketch, drawLanternSketch, fishById, weightOf } from './fish.js';
import { RODS, TACKLE, ROD_IDS, PACK, cleanGear, currentRig, carriedItems, fits, termOf, lineInUse } from './tackle.js';
import { LIVE, isLiveBait, addLive, takeLive, liveCount, stepBucket, freshen, waterWords, capOf, STALE } from './livebait.js';
import { PackUI } from './pack.js';
import { Camp, WAKE_TIMES } from './camp.js';
import { kitsFree, newCamp, moveCamp, packUp, checkSite, nearestSite, defaultName, toWorld, LAYOUT } from './campsite.js';
import { makeSiteWorld } from './siteWorld.js';
import { CampView, campObstacles } from './campView.js';
import { Placement } from './placement.js';
import { Adventures, ADVENTURE_BY_ID, PAGES, KEEPSAKES } from './adventures.js';
import { PhotoStore, capture, photoId, albumPage, download } from './photos.js';
import { Haptics, STRENGTHS, engineFeel, lineFeel, slamFeel, knockFeel } from './haptics.js';
import { PROFILES as ENGINES, WOT, setElectric, START_MODES, hasEngine, cleanEngine, engineSave, act as engineDo, assist as engineAssist, stepEngine, running as engineRunning, cranking as engineCranking, revs as engineRevs, rpmOf, trimBy, TRIM, tiltToggle, tiltedUp, stepTilt, HOLE, cutOut } from './engine.js';
import { HelmUI } from './helm.js';
import { STYLES, STYLE_IDS, styleOf } from './playstyle.js';
import { pay as payOut, earn as earnIn, fuelPrice, fuelQuote, goodwillDue, GOODWILL_L, ECONOMY } from './economy.js';
import { PRICES as BOAT_PRICES, PAINTS, FITS, usable as usableBoat, owns as ownsBoat, buyBoat, hireBoat, hiredToday, paintBoat, nameBoat, fitBoat, unfitBoat, fitEffect, engineOf, repowerBoat, repropBoat, trimBoat } from './shipyard.js';
import { BIRD_KINDS } from './birdData.js';
import { cleanLook } from './looks.js';
import { dressFigure } from './dress.js';
import { flagById, logLine, addRun, addFish } from './papers.js';
import { follow as followLeg, courseWords, rangeWords } from './routes.js';
import { TRIALS as ENGINE_TRIALS } from './engineTrials.js';
import { engineSpec, hasCatalogue, MODELS, CATALOGUE as ENGINE_BOATS, propName, fittedName } from './engines.js';
const CATALOGUE_COUNT = (kind) => ENGINE_BOATS[kind]?.count || 1;
import { BoatPreview } from './boatPreview.js';
import { Memories } from './memories.js';
import { whatsAbout, birdsWorking, weatherLines, notices, paintBoard } from './harbour.js';
import { HarbourSheet, paintSlate, paintKitchenBoard } from './harbourView.js';
import { Townsfolk, FOLK, sayTo } from './townsfolk.js';
import { earOf, quayNear, nearestOf } from './earshot.js';
import { redeemGift, giftWords } from './giftcodes.js';
import { HOLD as REVEAL_HOLD, COUNT as REVEAL_COUNT, needle, verdictOf } from './reveal.js';
import { requestById, businessWith, accept as acceptFavour, decline as declineFavour, complete as completeFavour, caught as favourCaught, saw as favourSaw, photographed as favourPhotographed, buoyAt, pickUpBuoy, fishFor, remember, cleanFavours } from './requests.js';
import { lower } from './innTalk.js';
import { tideAt, tideWords, turns } from './world/tide.js';
import { Rockpools, poolNear, poolOpen, visibleLife, turnStone, settle, netIn, letGo, POOL_LIFE, POOL_SITES } from './world/rockpools.js';
import { seasonOf, seasonWords, sunTimes, sunHour, seasonWarmth, riverFlow, leafTint, seasonLine } from './world/season.js';
import { galeSky, galeNear, hoursToGale, outlook, galeFor } from './world/forecast.js';
import { FolkView } from './world/folk.js';
import { Passersby } from './world/passersby.js';
import { VisitorView } from './world/visitors.js';
import { SharedWorld } from './sharedworld.js';
import { Teamwork } from './teamwork.js';
import { Crew, CREW_REACH, CREW_SLOW } from './crew.js';
import { DashControl } from './dashcontrol.js';
import { keyStep } from './dashboard.js';
import { TrollMotor, canTroll } from './trolling.js';
import { trollWire, deckY } from './trollmount.js';
import * as Con from './contracts.js';
import { Passengers } from './passengers.js';
import * as Story from './story.js';
import { onDesktop, seedSave, mirrorSave, reportAchievements } from './desktop.js';
import { vesselOf } from './vessels.js';
import { PickupView } from './world/pickups.js';
import { renderWork } from './contractboard.js';
import { demandFor, money, ordersFor, ORDERS_BY } from './market.js';
import { creelFits, creelKg, creelLoad, creelWords, kgWords, chill, wearFrom, addWear, wearOf, wornLine, freshBaitToday, onIce, BAIT, ICE } from './shop.js';
import { PHOTO_MAX } from './save.js';
import { Journal } from './journal.js';
import { MapSheet, Explored, OCEAN_SHEET } from './map.js';
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
import { levers, nearest, step, setIndex, within, capIndex, leverWords, slide, valueAt, positionOf, displayIndex, positionAtIndex, leverPositionWords, GEAR_IN } from './throttle.js';
import { LeverUI } from './lever.js';
import { anchorCheck, berthFor, berthAt, castOffCheck, canTow, towStep, TOW } from './mooring.js';
import { Rope } from './rope.js';
import { BOAT_PER_S, TANKS, addFuel, isPetrol, PASSAGE_FUEL, level as fuelLevel, room as fuelRoom, burnCar, burnBoat, burnKayak, burnElec, chargeElec, elecLevel, elecWords, chargeBattery, BATTERY_PER_HOUR, driveBy, fill, pour, rescue, moveCan, tankWords, batteryWords, canWords, litres, low as fuelLow } from './fuel.js';
import { STEPS as TRIP_STEPS, stepOf, stepNumber, complete as completeStep, start as startGuide, words as guideWords, isNewGame, placeAt, FISH_SPOTS } from './firstTrip.js';
import { PRESETS, CHOICES, FrameWatch, lowerLevel, startingLevel, resolveQuality } from './quality.js';
import { Post } from './post.js';
import { Diver, Shot, buildGun } from './diver.js';
import { stepComfort, effectsOf, needsOf, dressFor, drink as drinkFrom, refill, eatRoll, packRolls, mealDrink, CLOTHES, CLOTHES_IDS, BOTTLE, ROLLS, feelsLike } from './comfort.js';
import { LINES, STRENGTH, loadWords } from './lines.js';
import { modeOf as floodModeOf, PUMP_DRAW, waterWords as floodWords } from './flooding.js';
import { cleanDamage, damageSave, modeOf, stepTubes, pump as pumpTubes, survey, repairs as damageRepairs, mend as mendDamage, sound as hullSound, hullWords, materialOf, tighten, steerWords, plug as plugDamage, pluggable, CHAMBERS, SECTION_NAMES, SURFACES, TUBED, PARTS } from './damage.js';
import { CARGO, buy as buyCargo, putAboard, bringAshore, piecesAboard, storePieces, weightOf as cargoKg, newCargo } from './cargo.js';
import { BREATH, SCUBA, SPEAR, breathUse, breathToSurface, recoverRate, airUse, minutesLeft, canSpear, sizeGuess, spearHit, shotQuality, tearChance, logSite, logFind } from './dive.js';
import { clamp, damp, dampAngle, lerp, smoothstep, rand, pick, seeded, wrapAngle } from './util.js';

// The boats with an electric outboard fitted (applyYard): kind -> the seconds its battery lasts
// flat out (engines.js endure; fuel.js elec).
const ELEC = {};

const REST_SPEED = 30;   // holding T lets time drift by
const $ = (id) => document.getElementById(id);

// The benchmark (bench.html, bench.js): this scenario, in a save of its own (save.js BENCH), never
// signed in, never mirrored.
const BENCH_RUN = new URLSearchParams(location.search).get('bench');
// (The desktop build: on a computer with no save of its own, the one Steam Cloud brought.)
if (!BENCH_RUN) seedSave({ get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => localStorage.setItem(k, v) }, 'slow-tide-save');
const loaded = loadGame();
// Optional cloud saves: only when a backend is configured and you've signed in. Startup waits
// a moment for the cloud (just when signed in, or arriving from a sign-in link), so the game
// begins from the combined save rather than jumping later. Offline, it simply carries on.
const cloud = new Cloud();
const cloudReady = BENCH_RUN ? Promise.resolve() : cloud.init();
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
// The world's clock: the time everyone sees (your own, or the host's when playing together); your
// own clock (state.day, state.hour) keeps time for your own things. See world/clock.js.
// (Your own time, in game hours since day 0: see world/clock.js.)
const ownAbs = () => state.day * 24 + state.hour;
const clock = new WorldClock(ownAbs);
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
  water.uniforms.uTidal.value = tidalTexture(r === 'south' ? 'south' : 'home');
  water.uniforms.uShelterRect.value.set(SR.x, SR.z, SR.w, SR.h);
  for (const [k, c] of Object.entries(SEA_COLOURS[r])) water.uniforms[k].value.set(c);
  underwater.clear = r === 'south' ? 1 : 0;
  fishRenderer.clear = underwater.clear;
  water.uniforms.uClear.value = r === 'south' ? 1 : 0;
  // (At Las Brasas the trade wind blows from the north-east, unless you've set the wind yourself.)
  if (r === 'south' && settings.weather.windMode !== 'manual' && !(conditions.ocean > 0.05)) conditions.wind.from = 0.8;
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
// The small life of the seabed, laid out round you while you're under (see seabed.js).
const seabed = new Seabed(scene, habitat);
// The open water's own life: jellyfish and shoals of fry (see world/drifters.js).
const drifters = new Drifters(scene, habitat);
// The rockpools on the shore, uncovered at low water (see world/rockpools.js and the rockpool view).
const rockpools = new Rockpools(scene);
const eco = new Ecosystem(habitat);
const fishRenderer = new FishRenderer(scene, eco);
const fx = new Effects(scene);
// The long white trails boats leave on the sea (see world/foamTrails.js).
const foamTracks = new FoamTracks(), foamView = new FoamTrailView(scene);
function updateFoamTrails(t) {
  const now = t;
  const lay = (b, churn) => {
    if (!b.group.visible) return;
    const H = b.hull;
    foamTracks.note(b, b.pos.x - b.fwd.x * H.L * 0.5, b.pos.z - b.fwd.z * H.L * 0.5, b.heading, b.speed, H.B * 1.6, H.L, churn, now);
  };
  // (Yours in the water, the harbour's out and about, and any friends' or visitors'.)
  for (const b of boats) if (!isStored(b.kind) && b.kind !== state.trailer?.boat) lay(b, b.motor && !b.dry ? Math.abs(b.power || 0) : 0);
  for (const b of Object.values(folkView.boats)) lay(b, b.speed > 2 ? 0.6 : 0);
  for (const b of visitors.boats()) lay(b, b.speed > 2 ? 0.6 : 0);
  foamTracks.step(now);
  foamView.update(foamTracks, now, t, camera.position.x, camera.position.z, 0.3 + 0.7 * env.daylight);
}
// The water mirrors the world and shows every ripple (both scale with the graphics setting).
const reflection = new Reflection();
const ripples = new RippleField();
// The boats' wakes, drawn into the ripple field with the rings (see wakes.js); and with Ocean:
// Full, into a second, coarser field half a kilometre across, so they're seen a long way off.
const wakeMesh = wakes.buildMesh();
ripples.scene.add(wakeMesh);
ripples.extra = (cx, cz, span) => {
  ripples.scene.add(wakeMesh);
  return wakes.updateMesh(t, cx, cz, span);
};
const farWakes = new RippleField(1);
farWakes.extra = (cx, cz, span) => {
  farWakes.scene.add(wakeMesh);
  return wakes.updateMesh(t, cx, cz, span);
};
fx.setField(ripples);
// The sea glowing at night (splashes, wakes and strokes light it: see seaglow.js), and the
// whales, dolphins, seals and gannets you watch rather than catch (sealife.js).
const glow = new SeaGlow(scene);
fx.glow = glow;
glow.setPixelRatio(renderer.getPixelRatio());
hideFromReflection(glow.points);
const sealife = buildSeaLife(scene, { glow });
// The quieter wildlife at home: otters, herons, cormorants, terns, oystercatchers (wildlife.js).
const wildlife = buildWildlife(scene);
// The birds of the coast (see world/birds.js): to watch, up close or through the binoculars.
const birds = buildBirds(scene);
// Out on the crossing to Las Brasas: the weed rafts and the flying fish (see crossing.js).
const crossingLife = buildCrossingLife(scene);
// The harbour's people (Mags, Bert, Ruth, Dougie and his boat, Hettie, Kit; Paco at Las Brasas).
const town = new Townsfolk({ obstacles: world.coast.obstacles });
// (Your name on the plate at the root of your finger of Willowhaven's pontoon.)
world.coast.ownerSign(settings.player.name);
const folkView = new FolkView(scene);
// Willowhaven's other people, out and about of a fine day (see world/passersby.js).
const passersby = new Passersby(scene, town.paths);
// Playing together (see together.js): friends in a session, drawn where they are.
const together = new Together({ config: () => cloud.cfg, name: () => settings.player.name, look: () => state.look || null, kinds: BOAT_KINDS, skies: Object.keys(SKIES), rods: Object.keys(RODS), items: Object.keys(TACKLE) });
const visitors = new VisitorView(scene);
visitors.audio = audio; // (a friend's fish splashing near you: see fishAtEnd)
// One sea for everyone in a session: the host's sea life and shoals go across, everyone else's
// follow (see sharedworld.js). Alone, nothing changes.
const shared = new SharedWorld({ together, sealife, eco });
shared.items = Object.keys(TACKLE);
// Helping each other: netting a friend's fish, marking a shoal (see teamwork.js).
const teamwork = new Teamwork({ together, eco, lineEnd: (id) => visitors.lineEnd(id) });
const shoalMarkers = new Map();
// Crewing in a friend's boat, and a friend at your helm (see crew.js); and where you stepped
// aboard from (your boat, or a spot ashore), where a save puts you back.
const crew = new Crew({ together });
let crewFrom = null;
const _crewAt = new THREE.Vector3();
// (Everyone the sea answers to this frame, and friends' boats too far off to be drawn: see viewersNow.)
let seaViewers = null;
const _vb = new Map();
// What the people go by: the weather, and what the fish near the harbour are up to (looked at every
// few seconds, not every frame).
let folkAbout = [], folkAboutT = 0;
function folkCtx(dt) {
  folkAboutT -= dt;
  if (folkAboutT <= 0) {
    folkAboutT = 5;
    folkAbout = whatsAbout(eco).map((a) => ({ id: a.sp.id, name: a.sp.name, act: a.act }));
  }
  return { storm: Math.max(weather.storm, conditions.sea.storm), rain: weather.rain, wind: conditions.wind.speed, about: folkAbout, activity: eco.activity, season: seasonOf(clock.day).name };
}
// You, hearing: where you are, facing the way the camera looks (see earshot.js).
const _earDir = new THREE.Vector3();
function earFrom(P) {
  camera.getWorldDirection(_earDir);
  return earOf(P.x, P.z, _earDir.x, _earDir.z, onFoot ? walker.heading ?? 0 : boat.heading);
}
// What's round you that makes a sound of its own, where it is (gathered a few times a second):
// the water's edge along a quay or a pontoon, the boats lying near (yours and the harbour's), any
// boat out with her engine running, where the gulls are, and the inn's door with talk inside.
let aroundT = 0, around = {};
const UNPOWERED = new Set(['row', 'kayak', 'sail', 'windsurf']); // (no engine heard: oars, a paddle, a sail)
function aroundEar(P, dt) {
  aroundT -= dt;
  if (aroundT > 0) return around;
  aroundT = 0.2;
  const mine = boats.filter((b) => (onFoot || b !== boat) && !isStored(b.kind) && b.kind !== state.trailer?.boat && b.speed < 0.6);
  const lying = [
    ...mine.map((b) => ({ x: b.pos.x, z: b.pos.z, mast: b.kind === 'sail' })),
    ...Object.entries(town.boats).filter(([id, b]) => b.present && (b.moored || b.speed < 0.3) && !id.startsWith('kay')).map(([id, b]) => ({ x: b.x, z: b.z, mast: id === 'marigold' || id === 'puffin' })),
  ];
  const motors = Object.entries(town.boats)
    .filter(([id, b]) => b.present && !b.moored && (b.speed > 0.3 || b.hauling) && !id.startsWith('kay') && !(id === 'puffin' && b.sails))
    .map(([id, b]) => ({ x: b.x, z: b.z, level: clamp(b.speed / 7, 0.08, 1), voice: id === 'halcyon' || id === 'star' ? 'inboard' : '' }));
  // (Friends' boats under power too, playing together: the one you're crewing on among them, so a
  // planing RIB you're riding in isn't silent.)
  if (together.active) {
    for (const b of visitors.boats()) {
      if (b.speed > 0.3 && !UNPOWERED.has(b.kind)) motors.push({ x: b.pos.x, z: b.pos.z, level: clamp(b.speed / 7, 0.08, 1), voice: b.kind === 'cruiser' || b.kind === 'cabin' ? 'inboard' : '' });
    }
  }
  const inn = HAVEN_ROOMS.inn, inside = town.inside('inn');
  around = {
    quay: quayNear(PIERS, P.x, P.z, 45),
    moored: nearestOf(lying, P.x, P.z, 6, 45),
    motors: nearestOf(motors, P.x, P.z, 1, 160),
    gulls: [
      { x: (HAVEN_QUAY.x0 + HAVEN_QUAY.x1) / 2, z: (HAVEN_QUAY.z0 + HAVEN_QUAY.z1) / 2, k: 0.7 },
      { x: PUERTO_AT.x, z: PUERTO_AT.z, k: 0.7 },
      { x: STACKS[0].x, z: STACKS[0].z, k: 1 }, { x: SKELLIG.x, z: SKELLIG.z, k: 1 }, { x: SKERRIES[0].x, z: SKERRIES[0].z, k: 1 },
      ...world.flocks.map((f) => ({ x: f.x, z: f.z, k: 1 })),
    ],
    inn: inside > 0 ? { x: inn.doorX, z: inn.front + 0.3, busy: Math.min(1, 0.3 + 0.2 * inside) } : null,
  };
  return around;
}
// A word with someone you walk up to.
function talkTo(p) {
  // A favour to ask, to hand over or to tell them about comes first.
  const f = favourFor(p.id);
  if (f) {
    ask(f.title, f.text, f.acts);
    audio.page?.();
    return;
  }
  // The first word of the day, if there's something of yours they've heard about; then the usual.
  const r = talkedToday[p.id] === state.day ? '' : remember(p.id, memoryCtx());
  talkedToday[p.id] = state.day;
  const wanted = demandFor(state.day, 'haven').wanted.map((id) => fishById[id].name);
  hud.toast(`${FOLK[p.id].short}: ${r ? `“${r}”` : sayTo(p, { hour: clock.hour, storm: Math.max(weather.storm, conditions.sea.storm), wanted, caught: Math.floor(state.hour) % 3, landed: town.landed })}`, 8);
  audio.page?.();
}
const talkedToday = {};

// The tide (see world/tide.js): the sea's level and the tidal streams, set every frame for the
// currents, the water and the fish.
let tideNow = tideAt(clock.abs);
// The year: the rivers' flow (fuller after rain), the leaves' colour, a word when a season turns.
let seasonWas = seasonOf(clock.day).name;
function updateSeason() {
  const abs = clock.abs;
  conditions.riverScale = riverFlow(abs) * (1 + 0.5 * weather.rain);
  world.setLeaves(leafTint(abs));
  const S = seasonOf(clock.day);
  if (S.name !== seasonWas) {
    seasonWas = S.name;
    // (Not while the world's time sweeps to a friend's, or back: that's not the season turning.)
    if (started && !clock.sweeping) hud.toast(SEASON_NEWS[S.name], 10);
  }
}
const SEASON_NEWS = {
  spring: 'Spring comes to Willow Bay: the light coming back, the leaves breaking, the cuttlefish in to spawn on the eelgrass and the garfish arriving. The first mackerel aren’t far off.',
  summer: 'Summer: long light evenings, the mackerel shoaling in the bay, bass in the surf, the tunas and blue sharks out in the Blue Water, and cruising boats calling in.',
  autumn: 'Autumn: the leaves turning, the bass at their best before they go, squid crowding in under the lights at night, and the bluefin out past the shelf. The days shorten.',
  winter: 'Winter: short days and long nights, the rivers in spate, the summer fish gone south. Pike and grayling come into their own, the pollack are on the wrecks, and the squid stay.',
};
// When you can choose to wake: dawn and the golden hour by the sun.
function wakeTimes() {
  const t = sunTimes(clock.abs + 12);
  const q = (h) => Math.round(h * 4) / 4;
  return [
    { h: q(t.rise - 0.25), name: 'Dawn' }, { h: Math.max(8, q(t.rise + 1)), name: 'Morning' }, { h: 12, name: 'Midday' },
    { h: 15, name: 'Afternoon' }, { h: q(t.set - 1.25), name: 'Golden hour' }, { h: Math.min(23.5, q(t.set + 1.5)), name: 'Night' },
  ];
}
function updateTide() {
  updateSeason();
  tideNow = tideAt(clock.abs);
  TIDE.flow = tideNow.flow;
  TIDE.level = tideNow.level;
  water.uniforms.uTideFlow.value = tideNow.flow;
  water.uniforms.uTideLevel.value = tideNow.level;
}

/* ---- the favours the harbour's people ask of you (see requests.js) ---- */

state.favours = cleanFavours(state.favours);
state.contracts = Con.cleanContracts(state.contracts);
state.story = Story.cleanStory(state.story, BOAT_KINDS);
const NAMES = Object.fromEntries(Object.entries(FOLK).map(([id, F]) => [id, F.short]));
// What someone has for you just now: { title, text, acts } for the dialog (or the harbour's sheet),
// or null.
function favourFor(who) {
  const F = state.favours, b = businessWith(who, F, state.keep, state.day);
  if (!b) return null;
  const R = b.R, name = NAMES[who];
  if (b.act === 'ask') {
    return { title: name, text: R.ask, acts: [
      { text: 'Not now', cls: 'quiet', run: () => { declineFavour(F, R.id, state.day); hud.toast(`${name}: “Another day, then.”`, 3); save(); } },
      { text: 'I’ll do it', run: () => takeFavour(R) },
    ] };
  }
  if (b.act === 'give') {
    const idx = fishFor(state.keep, R), f = state.keep[idx[0]], sp = fishById[R.species];
    const what = idx.length > 1 ? `${idx.length} ${lower(sp.name)}` : `your ${f.size} cm ${lower(sp.name)}`;
    return { title: name, text: `${R.short}. Give ${name} ${what}?`, acts: [
      { text: 'Not yet', cls: 'quiet', run: () => {} },
      { text: 'Give it', run: () => {
        for (const i of [...idx].sort((a, z) => z - a)) {
          setOutcome(state.keep[i].logId, 'sold');
          state.keep.splice(i, 1);
        }
        finishFavour(R);
      } },
    ] };
  }
  if (b.act === 'deliver') return { title: name, text: `You have ${R.item} from ${NAMES[R.who]} for ${name}.`, acts: [{ text: 'Hand it over', run: () => finishFavour(R) }] };
  return { title: name, text: `${R.short}: done.`, acts: [{ text: R.kind === 'find' ? 'Hand over the buoy' : `Tell ${name}`, run: () => finishFavour(R) }] };
}
function takeFavour(R) {
  const e = acceptFavour(state.favours, R.id, state.day);
  if (!e) return;
  // Dougie's buoy: roughly where it was lost goes on your map.
  if (R.kind === 'find' && state.pins.length < 60) state.pins.push({ id: 'fav-buoy', x: Math.round(e.pos.x), z: Math.round(e.pos.z), title: 'Dougie’s buoy?', note: 'Somewhere about here, drifting: an orange float with a flag.', fav: false, day: state.day, hour: state.hour });
  hud.toast(`${NAMES[R.who]} is counting on you: ${R.short.charAt(0).toLowerCase()}${R.short.slice(1)}.${R.kind === 'deliver' ? ` (You have ${R.item}.)` : ''}`, 6);
  teach('favours', 'Favours you’ve agreed to are listed in your journal, under Memories. Nothing is timed: take as long as you like.', 7);
  save();
}
function finishFavour(R) {
  const who = R.kind === 'deliver' ? R.to : R.who;
  const rw = completeFavour(state.favours, R.id, state.day) || {};
  const gave = [];
  if (rw.money) {
    earnIn(state, rw.money, 'A favour');
    gave.push(`${money(rw.money)} into your purse`);
  }
  if (rw.keepsake && !state.keepsakes[rw.keepsake]) {
    state.keepsakes[rw.keepsake] = { day: state.day, hour: state.hour };
    gave.push(`${KEEPSAKES[rw.keepsake].name.toLowerCase()} for the shelf at home`);
  }
  if (rw.pin && state.pins.length < 60) {
    state.pins.push({ id: `fav-${R.id}`, x: rw.pin.x, z: rw.pin.z, title: rw.pin.title, note: rw.pin.note, fav: true, day: state.day, hour: state.hour });
    gave.push(`a mark on your map: ${rw.pin.title}`);
  }
  if (R.kind === 'find') state.pins = state.pins.filter((p) => p.id !== 'fav-buoy');
  if (rw.dish) {
    camp.eatDish(rw.dish.text, rw.dish.fill, true);
    gave.push(`${rw.dish.text.charAt(0).toLowerCase()}${rw.dish.text.slice(1).replace(/\.$/, '')}: well fed`);
  }
  audio.chime?.();
  hud.toast(`${NAMES[who]}: ${R.thanks}${gave.length ? ` (${gave.join(' · ')}.)` : ''}`, 12);
  harbourSheet.render();
  save();
}
// Something that does a favour you're doing: say so, and who to tell.
function favoursReady(list) {
  for (const R of list) hud.toast(`That’s ${R.short.charAt(0).toLowerCase()}${R.short.slice(1)}: go and tell ${NAMES[R.who]}.`, 6);
  if (list.length) save();
}
// What they might remember of you: your best fish of the last day or so, the place you found last,
// your last trip.
function memoryCtx() {
  let notable = null;
  for (let i = state.log.length - 1; i >= 0 && state.log[i].day >= state.day - 1; i--) {
    const e = state.log[i], sp = fishById[e.sp];
    if (!sp) continue;
    const k = (e.size - sp.size[0]) / Math.max(1, sp.size[1] - sp.size[0]);
    if (k > 0.75 && (!notable || k > notable.k)) notable = { k, name: sp.name, size: e.size, day: e.day };
  }
  let place = null;
  for (const [id, r] of Object.entries(state.places || {})) {
    const P = PLACES.find((q) => q.id === id);
    if (P && !P.area && r.day >= state.day - 1 && (!place || r.day * 24 + r.hour > place.day * 24 + place.hour)) place = { name: P.name, day: r.day, hour: r.hour };
  }
  const tr = state.trips[state.trips.length - 1];
  // Your latest dive at a site (today's or yesterday's), and your latest badge.
  let dive = null;
  for (const pg of [state.days[state.days.length - 1], state.today]) {
    for (const d of pg?.dives || []) if (d.site && pg.day >= state.day - 1) dive = { site: siteById[d.site].name.replace(/^The /, 'the '), day: pg.day };
  }
  const bid = Object.keys(state.badges || {}).sort((a, b) => (state.badges[b].day - state.badges[a].day) || (state.badges[b].hour - state.badges[a].hour))[0];
  const badge = bid && challengeById[bid] ? { name: challengeById[bid].name, day: state.badges[bid].day } : null;
  return { day: state.day, notable, place, dive, badge, trip: tr && tr.day >= state.day - 1 ? { name: tr.name, total: tr.total, day: tr.day } : null };
}
// Dougie's buoy adrift: an orange float and a little flag, riding the swell where it's got to.
const lostBuoy = (() => {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshLambertMaterial({ color: '#e8742a' }));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 5), new THREE.MeshLambertMaterial({ color: '#2a2d30' }));
  stick.position.y = 0.55;
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.16, 0.24), new THREE.MeshLambertMaterial({ color: '#2a2d30' }));
  flag.position.set(0, 1.0, 0.12);
  g.add(ball, stick, flag);
  g.visible = false;
  scene.add(g);
  return g;
})();
function lostBuoyNear() {
  const B = buoyAt(state.favours, state.day * 24 + state.hour);
  return B && !onFoot && Math.hypot(boat.pos.x - B.x, boat.pos.z - B.z) < 5 ? B : null;
}
function pickUpLostBuoy() {
  const R = pickUpBuoy(state.favours);
  if (!R) return;
  audio.splashSmall?.();
  hud.toast('You lean out and haul Dougie’s buoy aboard, its rope trailing. Take it in to him.', 5);
  save();
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
// Each motorboat's engine room (see engine.js): its switches, battery and trim, kept in the save.
const engines = Object.fromEntries(BOAT_KINDS.filter(hasEngine).map((k) => [k, cleanEngine(k, state.engines?.[k])]));
for (const [k, E] of Object.entries(engines)) BOATS[k].engine = E;
// What knocks have done to each of your boats (see damage.js): her hull, a RIB's tubes. Kept in the
// save. (Rock on the seabed, for what a grounding does: the habitat's map.)
const damages = Object.fromEntries(BOAT_KINDS.map((k) => [k, cleanDamage(state.damage?.[k], TUBED.has(k))]));
for (const [k, D] of Object.entries(damages)) BOATS[k].damage = D;
{
  const hs = {};
  Boat.rockAt = (x, z) => habitat.sample(x, z, hs).rock || 0;
}
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
  rodStick: () => fishing.expert && fishing.lineOut && !modal,
});
input.padLabel = (a) => pads.label(a);
// What you feel through the controller (see haptics.js): the engine, the sea, the fish.
const haptics = new Haptics((strong, weak, lt, rt, ms) => pads.feel(strong, weak, lt, rt, ms));
haptics.setStrength(settings.controls.vibration);
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
rig.solid = pushOut;
const rodView = new RodView();
const finder = new FishFinder(eco, habitat, state, {
  say: (text) => hud.toast(text, 5),
  // The unit's Mark key: a waypoint on your map where the sonar is reading, with what it read.
  mark: (r) => {
    if (!r) return hud.toast('Nothing under the sonar to mark yet.', 3);
    if (state.pins.length >= 60) return hud.toast('Your map is full of marks: clear a few first (the map, or the journal’s Your marks).', 5);
    const fish = r.fish.length ? ` · fish at ${r.fish.slice(0, 3).map((d) => d.toFixed(1)).join(', ')} m` : '';
    state.pins.push({ id: `sn-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, x: Math.round(r.x * 10) / 10, z: Math.round(r.z * 10) / 10, title: `Sonar mark · ${r.depth.toFixed(1)} m`, note: `${r.depth.toFixed(1)} m over ${r.type}${r.temp != null ? `, ${r.temp.toFixed(1)}°C` : ''}${fish}${r.ball ? ' · bait below' : ''}.`, fav: false, day: state.day, hour: Math.round(state.hour * 100) / 100 });
    save();
    audio.chime?.();
    hud.toast(`Marked on your map: ${r.depth.toFixed(1)} m over ${r.type}.`, 4);
  },
  // (E1) What the screen has just shown: an arch noted as a sign (a catch soon after near it tells
  // you what it was: see grounds.js), and the first of each kind of mark explained once.
  sighted: (kind, i) => {
    if (kind === 'arch' && i.mode === 'boat') seeSign(state.grounds, recentSigns, { type: 'arch', x: i.x, z: i.z, sp: i.sp }, clock.abs, state.day);
    const words = SONAR_MARKS[kind];
    if (words) teach(`sonar-${kind}`, typeof words === 'function' ? words(i) : words, 8);
  },
});
// (E1) The first time the fish finder shows each kind of mark, a word on how to read it.
const SONAR_MARKS = {
  arch: (i) => `An arch on the sonar at ${i.depth.toFixed(1)} m: a fish crossing the beam. A thicker arch is a bigger fish; a long flat line is one holding still under you. Fish at that depth.`,
  ball: 'A cloud on the sonar: a shoal of small fish. Look for arches under and round it: that’s where the hunters wait.',
  cline: (i) => `A faint band across the sonar at ${Math.round(i.depth)} m: the thermocline, where the warm top water (${Math.round(i.top)}°C) meets the cold below (${Math.round(i.bottom)}°C). In summer the cool-water fish keep under it.`,
  rock: 'A thick, bright bottom with a second echo under it: hard rock. Fish hold over it, and a lure dragged along it snags.',
  drop: (i) => `The bottom falling away on the sonar, ${i.from.toFixed(0)} m to ${i.to.toFixed(0)} m: a drop-off. Hunters hang along edges like this.`,
};

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
  // The boats that live at Willowhaven: alongside your own finger of the pontoon (where, depends
  // on which of them are in the water: see fleet.js).
  if (homeOf(kind) === 'harbour') return ownBerth(kind);
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

// Which of your boats are laid up ashore (see fleet.js). A game from before there was a boat
// store keeps the three you'd most want in the water (the one you were in first) and lays up
// the rest; a new game starts with the camp's three boats in the water.
const KINDS = Object.keys(BOATS);
// (A boat on the trailer is out of the water but not laid up: she's left out of the count.)
const FLEET = KINDS.filter((k) => k !== state.trailer?.boat);
const fleetNews = (() => {
  if (cleanStored(state.stored, FLEET)) return null;
  const saved = state.boats || {}, fresh = !Object.keys(saved).length;
  const homes = { harbour: { x: 11, z: -70 }, camp: { x: LANDING.x, z: LANDING.z }, lake: BOATHOUSE_PIER.end };
  const away = KINDS.filter((k) => saved[k] && Math.hypot(saved[k].x - homes[homeOf(k)].x, saved[k].z - homes[homeOf(k)].z) > 60);
  const afloat = fresh ? NEW_AFLOAT : chooseAfloat(FLEET, { vessel: state.vessel, away });
  state.stored = FLEET.filter((k) => !afloat.includes(k));
  return fresh ? null : afloat;
})();
const isStored = (k) => state.stored.includes(k);
const LENGTHS = Object.fromEntries(KINDS.map((k) => [k, BOATS[k].hull.L]));
const BEAMS = Object.fromEntries(KINDS.map((k) => [k, BOATS[k].hull.B]));
// Where your Willowhaven boats lie: your own finger; or, a guest in a friend's session (it's their
// harbour), the visitors' row at the end of the pontoon, each guest a finger or a side of their
// own (by their place among the guests: see together.js guestSlot).
function homeBerths() {
  const g = together.guestSlot;
  if (g < 0) return { F: OWN_FINGER, sides: [1, -1], east: true };
  const V = VISITOR_FINGERS;
  return [{ F: V[1], sides: [1, -1], east: false }, { F: V[0], sides: [-1], east: true }][g] || { F: V[1], sides: [1, -1], east: false, extra: true };
}
// Her berth there, alongside the others of yours in the water.
function ownBerth(kind) {
  const H = homeBerths(), set = KINDS.filter((k) => homeOf(k) === 'harbour' && (!isStored(k) || k === kind));
  const B = H.extra ? null : ownBerths(H.F, set, LENGTHS, BEAMS, H.sides, H.east)[kind];
  return B ? { x: B.x, z: B.z, heading: B.heading } : { x: H.F.x1 + 8, z: (H.F.z0 + H.F.z1) / 2, heading: Math.PI / 2 };
}
// In among the berths at Willowhaven (where a harbour boat left lying is moved to her own).
const inMarina = (p) => !!p && p.x > -12 && p.x < 34 && p.z > -92 && p.z < -38;
// Laid up: out of the water, out of sight, and out of everything that goes on afloat.
function stow(b, loading = false) {
  if (!loading && tow && (tow.lead === b || tow.towed === b)) letGoTow(true);
  Object.assign(b, { tie: null, shove: null, anchor: null, anchored: false, lever: 0, power: 0, stowed: true });
  b.group.visible = false;
  const i = boats.indexOf(b);
  if (i >= 0) boats.splice(i, 1);
  wakes.forget(b);
}
// Back in the water, at home (her berth, the camp's landing, the boathouse jetty), tied up.
function unstow(b) {
  b.stowed = false;
  b.group.visible = true;
  // (Nobody aboard her; and the lantern, if you have one.)
  if (b !== boat || onFoot) b.setRower(false);
  if (state.items.lantern) b.setLantern(true);
  if (!boats.includes(b)) {
    boats.length = 0;
    for (const o of Object.values(BOATS)) if (!o.stowed) boats.push(o);
  }
  const p = homeOf(b.kind) === 'harbour' ? freeOwnBerth(b) : mooring(b.kind);
  b.place(p.x, p.z, p.heading);
  const B = berthFor(b, boats, { reach: 3 });
  if (B) {
    b.place(B.x, B.z, B.heading);
    b.tieTo({ ...B, t: 9 });
  }
}
// Her place on your finger now, clear of your other boats lying there (along whichever side has
// room); or off the end of it, if there's none.
function freeOwnBerth(b) {
  const want = ownBerth(b.kind), { F, sides, east } = homeBerths(), L = b.hull.L, others = [...boats.filter((o) => o !== b), ...(together.active ? visitors.boats() : [])];
  const clear = (x, z) => others.every((o) => Math.abs(o.pos.z - z) > (o.hull.B + b.hull.B) * 1.05 || Math.abs(o.pos.x - x) > (o.hull.L + L) / 2 + 0.4);
  if (clear(want.x, want.z)) return want;
  for (const side of sides) {
    const z = side > 0 ? F.z1 + b.hull.B + 0.25 : F.z0 - b.hull.B - 0.25;
    for (let u = 0.6 + L / 2; u + L / 2 <= F.x1 - F.x0 + 0.4; u += 0.5) {
      const x = east ? F.x0 + u : F.x1 - u;
      if (clear(x, z)) return { x, z, heading: east ? Math.PI / 2 : -Math.PI / 2 };
    }
  }
  return east ? { x: F.x1 + L / 2 + 3, z: (F.z0 + F.z1) / 2, heading: Math.PI / 2 } : { x: F.x0 - L / 2 - 3, z: (F.z0 + F.z1) / 2, heading: -Math.PI / 2 };
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
  // (One of the Willowhaven boats left in among the berths goes to hers on your finger.)
  const at = floats(b, saved) && !(homeOf(kind) === 'harbour' && inMarina(saved)) ? saved : mooring(kind);
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
// (The ones laid up ashore, out of the way first; and one on the trailer.)
for (const k of state.stored) stow(BOATS[k], true);
if (state.trailer?.boat) stow(BOATS[state.trailer.boat], true);
// How each boat was left: tied up alongside (made fast again where she lies, held firm from the
// start), at anchor (the anchor already on the bottom where it was), or free. A boat at her home
// mooring starts tied up there; an older save's boat "anchored" right alongside a pier (how boats
// brought round to the quay used to be left) is tied up instead.
for (const [kind, b] of Object.entries(BOATS)) {
  if (b.stowed) continue;
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
boat = BOATS[state.vessel] && !BOATS[state.vessel].stowed ? BOATS[state.vessel] : boats[0];
for (const b of boats) if (b !== boat) b.setRower(false);
if (state.items.lantern) {
  for (const b of boats) b.setLantern(true);
  world.takeLantern();
}
rig.init(boat);

// The weather: how cloudy the sky is and how hard it rains (each 0–1), drifting smoothly
// towards the sky of the moment. Choose one in Settings, or let it change by itself.
// The sky (see world/weather.js): yours, or the host's when playing together.
const skyMode = () => settings.weather.mode;
const weather = createWeather(state.sky, { mode: skyMode(), rained: !!state.tips.rained });
let restRefused = false; // (told already that resting is the host's, this press of the key)
let ownSky = null;       // your own sky, waiting while you follow the host's
let worldSpeed = 1;      // how fast your time runs just now (resting, sitting): shared when hosting

/* ---------------- playing together: one world ---------------- */

// Hosting, the world you share: your time and how fast it's running, your sky and wind, the sea
// you've chosen, the water's colour. (Your own things, the day book, favours, the creel, aren't in it.)
function worldToShare() {
  const abs = state.day * 24 + state.hour;
  return {
    abs, rate: started && !sleeping && !waiting ? rateAt(abs, worldSpeed) : 0,
    sky: { state: weather.state, cloud: weather.cloud, rain: weather.rain, storm: weather.storm },
    wind: { from: conditions.wind.from, speed: conditions.wind.speed },
    sea: settings.weather.sea || 'auto', colour: state.seaColour,
  };
}

// Joining, the host's world is followed while there is one: their time (the clock sweeps to it),
// their sky and wind and sea. Your own sky waits (ownSky) and comes back when you leave.
function followWorld() {
  const H = together.hostWorld();
  if (H) {
    if (!clock.following) {
      ownSky = skyOf(weather);
      hud.toast(`You’re sharing ${together.hostLabel}’s world now: their time of day, weather and tide. Your own come back when you leave the session.`, 8);
    }
    clock.hear(H.abs, H.rate, H.heard);
    conditions.follow = { speed: H.wind.speed, from: H.wind.from };
  } else if (clock.following) {
    clock.release();
    conditions.follow = null;
    if (ownSky) {
      weather.state = ownSky.state;
      weather.timer = ownSky.timer;
      ownSky = null;
    }
  }
}
// The water's colour as you see it: the host's, playing together.
const seaColourNow = () => (clock.following ? together.hostWorld()?.colour ?? state.seaColour : state.seaColour);
// What a joiner is told when they try to rest, sleep or wait: the world's time is the host's.
const timeIsHosts = () => `Playing together, time is ${together.hostLabel}’s to pass: they can rest or sleep the night through, and you’ll see it go by.`;
// The wind, the sea and the currents live in conditions.js, shared by the water, the boats, the
// rig, the trees and the sound. `wind` is a small view of it for the HUD and the console.
const FRESH = 12; // m/s: a fresh breeze, strength 1 for the casting maths
const wind = {
  // The way it blows towards (as atan2(x, z) of its vector) and how strong (0 … 1), where you are.
  get dir() { const w = windAt(player().pos.x, player().pos.z); return Math.atan2(w.x, w.z); },
  get strength() { return Math.min(1, windAt(player().pos.x, player().pos.z).speed / FRESH); },
};
function updateWind(dt) {
  const H = clock.following ? together.hostWorld() : null;
  conditions.preset = H ? H.sea : settings.weather.sea || 'auto';
  conditions.manual = !H && settings.weather.windMode === 'manual' ? { speed: settings.weather.windSpeed, from: settings.weather.windFrom * Math.PI / 180 } : null;
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
// (No messages over the title or a question waiting for an answer: they wait their turn.)
// (Messages wait while a question or a full-screen menu would hide them: they come when it closes.
// The map is left out: you can steer with it open.)
hud.quiet = () => !started || !$('confirm').hidden || (!!modal && modal !== 'map');
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
  // (Plain words: a key's label comes as a <kbd>, which the toast would show as it is.)
  hud.toast(text.replace(/<[^>]+>/g, ''), secs);
  save();
}

// (Followed by the shared sea's fish: see placeFriendsFish and shared.onNoHook below.)
const fishing = new Fishing(scene, boat, fx, audio, eco, {
  flash: (text, secs) => hud.flash(text, t, secs),
  key: (a) => K(a),
  canopyAt: (x, y, z) => world.canopyAt(x, y, z),
  teach,
  shake: (s) => shake(s),
  // The flick before a run, and the run itself: felt as well as seen (a buzz on phones that
  // can, a jolt through your hands in first person).
  cue: (kind) => {
    if (touch.active && settings.controls.vibration !== 'off') navigator.vibrate?.(kind === 'warn' ? 35 : 70);
    haptics.pulse(kind === 'warn' ? 'warn' : 'run');
    if (kind === 'run' && rig.mode === 'eye') shake(0.25);
  },
  // Every other sign and turn of a catch, felt through the controller (see haptics.js).
  feel: (name, k) => haptics.pulse(name, k),
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
  // (A live bait taken by the fish: gone from the bucket. See livebait.js.)
  onHook: () => {
    const it = fishing.item;
    if (!it?.live) return;
    takeLive(state.gear.bucket, it.id);
    if (!liveCount(state.gear.bucket, it.id)) applyGear(`That was your last ${it.short.toLowerCase()}: something else goes on next`);
    gearChip(fishing.rod, it);
    save();
  },
  onCatch: showCatch,
  onRelease: hideCatch,
  canKeep: () => {
    const F = fishing.fight, kg = F ? weightOf(F.sp, F.size) : 0;
    if (creelFits(state, kg)) return true;
    hud.flash(`No room in your creel for this one (${creelWords(state)}). Cook or sell some, or let it go.`, t, 3.5);
    return false;
  },
  onKeep: (sp, size) => {
    notePressure(player().pos.x, player().pos.z);
    state.keep.push({ id: sp.id, size, logId: lastCatchId, at: state.day * 24 + state.hour });
    setOutcome(lastCatchId, 'kept');
    document.body.classList.remove('reveal');
    $('catch-card').hidden = true;
    modal = null;
    const kg = weightOf(sp, size);
    hud.flash(kg > creelKg(state) ? `It fills your creel on its own: ${sp.name.toLowerCase()}, ${kgWords(kg)}. Sell it or cook it before you keep anything else.` : `Into the creel: ${sp.name.toLowerCase()}, ${size} cm (${creelWords(state)}). Cook it at camp, or sell it at the market.`, t, 3.5);
    teach('kept', 'Fish you keep go in the creel on your backpack (by weight: thirty-odd mackerel, or one big tuna). Grill them at camp, or sell them at the market.', 7);
    save();
  },
  // Into the bait bucket (see livebait.js): a small fish, alive, for bait.
  canBait: (sp, size) => {
    const r = baitRoom(sp.id, size);
    if (!r.ok) hud.flash(r.why, t, 3);
    return r.ok;
  },
  onBait: (sp, size) => {
    addLive(state.gear.bucket, sp.id, size, livewellHere());
    setOutcome(lastCatchId, 'bait');
    document.body.classList.remove('reveal');
    $('catch-card').hidden = true;
    modal = null;
    hud.flash(`Into the ${livewellHere() ? 'livewell' : 'bait bucket'}: ${sp.name.toLowerCase()}, ${size} cm (${bucketWords()}).`, t, 3.5);
    teach('livebait', `Live bait: ${K('tackle')} puts it on the hook (the live fish comes round with your baits), on a float or bottom rig. Bass, pollack, pike and perch can’t leave a live one. Change the bucket’s water now and then at the water’s edge, or the bait dies; a boat’s livewell keeps them lively.`, 10);
    gearChip();
    save();
  },
  // Every break has a reason you can see and do something about (see fight.js).
  // A fish thrown or pulled free has the line whole: it says so.
  onSnap: (why, sp, rod, F = null) => {
    hud.flash(why === 'teeth' ? 'Snip! The line is cut.' : why === 'snag' ? 'Snagged! The line parted in the weed.' : why === 'rock' ? 'Cut on the rocks!' : why === 'thrown' ? 'It threw the hook!' : why === 'pulled' || why === 'lifted' ? 'The hook pulled free.' : why === 'kicked' ? 'It kicked free at the net!' : why === 'spat' ? 'It let go!' : 'Snap! The line broke.', t, 3);
    hud.toast(breakReason(why, sp, rod, { by: F?.thrownBy, loosened: !!F?.loosened, loosen: pads.active ? 'LT' : scheme() === 'touch' ? 'the stick down' : 'S' }), 9);
  },
  // The line as it is (worn by hard fights, see shop.js); and the wear a fight just ended leaves.
  line: (rod) => wornLine(rod.line, wearOf(state, rod.id)),
  fought: (F, rod) => {
    const w = addWear(state, rod.id, wearFrom(F));
    // (E2: chafed on rock or nicked by teeth: said, as it's the end of the line that's weak now.)
    if ((F.chafe || 0) >= 0.15) teach('chafed', `The end of the line on your ${rod.short.toLowerCase()} is chafed where it rubbed on the ${F.coverKind === 'rock' ? 'rock' : F.teeth ? 'fish’s teeth' : 'weed'}: it’ll break more easily now. Fresh line at the chandlery puts it right.`, 9);
    else if (w.was < 0.6 && w.now >= 0.6) teach('frayed', `That fight has left the line on your ${rod.short.toLowerCase()} frayed: it’s a little weaker now. Old Bert at the chandlery will put fresh line on for a few pounds.`, 9);
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
// The host says the fish you struck had already let go: the hook comes back empty.
shared.onNoHook = (id) => {
  if (fishing.fight?.agent?.id === id) fishing.lose('spat');
};

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

// (The fish finder's thermometer reads the surface, a few times a second.)
let finderTempT = 0, finderTempV = null;
function finderTemp(x, z, dt) {
  if ((finderTempT -= dt) <= 0 || finderTempV == null) {
    finderTempT = 0.5;
    finderTempV = waterTempAt(x, z);
  }
  return finderTempV;
}
// The water's temperature at (x, z), depth metres down (see world/seatemp.js).
function waterTempAt(x, z, depth = 0) {
  const south = z > SOUTH_Z ? 1 : inOcean(x, z) ? clamp(crossProgress(x, z), 0, 1) : 0;
  return seaTemp({ abs: clock.abs, zone: zoneAt(x, z), depth, south, hour: clock.hour });
}

// A spot fished hard (see world/pressure.js): a word, once a day for each, when you've kept enough
// from it that the rest have turned wary and the newcomers will be a while.
const pressureSaid = new Set();
function notePressure(x, z) {
  if (eco.pressureAt(x, z) < PRESSURE_HEAVY) return;
  const key = `${Math.floor(x / PRESSURE_CELL)},${Math.floor(z / PRESSURE_CELL)}:${clock.day}`;
  if (pressureSaid.has(key)) return;
  pressureSaid.add(key);
  later('You’ve taken a fair few from this spot today. The fish left here are warier now, and the ones that move in to replace them will be a while: try somewhere else, and come back to it later, or tomorrow.');
}
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
    hour: Math.round(clock.hour * 100) / 100,
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
    tide: tideAt(clock.abs).phase,
    // (The water's colour, at sea: see grounds.js.)
    ...(waterOf(zoneAt(agent.x, agent.z)) !== 'fresh' && colourKey(seaColourNow()) !== 'clear' ? { colour: colourKey(seaColourNow()) } : {}),
    season: seasonOf(clock.day).name,
    hatch: Math.round(hatchLevel() * 10) / 10,
    depth: Math.round(Math.max(0, -at.y) * 10) / 10,
    bottom: Math.round(Math.max(0, -solidHeight(at.x, at.z)) * 10) / 10,
    temp: waterTempAt(at.x, at.z, Math.max(0, -at.y)),
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
      count: 0, best: 0, firstDay: state.day, firstHour: clock.hour,
      firstZone: zoneAt(agent.x, agent.z), firstRain: weather.rain > 0.4,
    };
  }
  const rec = state.fish[sp.id];
  const record = !isNew && size > rec.best;
  if (record) noteRecord(state.today, sp.id, size);
  // (Caught aboard one of your boats: in her papers, and her best fish in her log.)
  const V = !onFoot && boat ? state.yard.vessels?.[boat.kind] : null;
  if (V && !how) {
    const kg = agent?.weight ?? weightOf(sp, size);
    if (addFish(V, sp.id, kg, size, state.day) && kg >= 1) logLine(V, state.day, `Her best fish yet: a ${size} cm ${sp.name.toLowerCase()}, ${kg.toFixed(1)} kg.`);
  }
  // Was it under a sign you saw just now? Then you know what that sign was (see grounds.js).
  const read = agent ? readSign(state.grounds, recentSigns, sp.id, agent.x, agent.z, clock.abs) : null;
  if (read) later(read.first ? SIGNS[read.kind].lesson(sp.id) : `${SIGNS[read.kind].name}: ${read.kind === 'birds' ? 'under the birds again' : 'you read it right again'}.`);
  rec.count++;
  rec.best = Math.max(rec.best, size);
  if (rigUsed?.item) {
    const on = (state.caughtOn[sp.id] = state.caughtOn[sp.id] || {});
    on[rigUsed.item.id] = (on[rigUsed.item.id] || 0) + 1;
  }
  logCatch(sp, size, agent, rigUsed, how);
  together.caught(sp.id, agent?.weight ?? weightOf(sp, size), { best: record, first: isNew });
  // A first of its kind: how it was caught, for your friends (a tip, on their map where you were).
  if (isNew) {
    const e = logById(lastCatchId);
    if (e) shareFind('fish', e.x ?? agent.x, e.z ?? agent.z, sp.name, tipWords(e));
  }
  adventures.caught(sp.id, agent.x, agent.z, world.flocks);
  favoursReady(favourCaught(state.favours, { id: sp.id, size, night: clock.hour >= 20.5 || clock.hour < 5, shore: onFoot }));
  catchShot = false;
  jobsDone(Con.caught(state.contracts, { sp: sp.id, size, method: rigUsed?.kind || fishing.kind, sea: sp.water !== 'fresh', phase: 'landed', boat: !onFoot && !driving ? boat.kind : null }));
  markObserved(sp.id, agent);
  state.tips.caught = true;
  // (Checked once the catch card's closed, when you've kept it or let it go.)
  challengesDue = true;
  save();
  return { isNew, record };
}

function showCatch(sp, size, agent, rigUsed) {
  // (The catch card's moment first: a discovery card this catch brings waits until it's done.)
  modal = 'catch';
  const bestBefore = state.fish[sp.id]?.best || 0;
  const { isNew, record } = recordCatch(sp, size, agent, rigUsed);
  const verdict = verdictOf(sp, size, { isNew, record, count: state.fish[sp.id]?.count || 1, best: record ? bestBefore : state.fish[sp.id]?.best || size });

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
  // The stamp: a fish of a lifetime, new in your journal, or your biggest yet (see reveal.js).
  const stampEl = $('cc-new');
  stampEl.hidden = !verdict.stamp;
  stampEl.className = `stamp ${verdict.stamp || ''}`.trim();
  stampEl.textContent = verdict.stamp === 'lifetime' ? 'A fish of a lifetime!' : verdict.stamp === 'record' ? 'Your biggest yet!' : 'New in your journal';
  $('cc-name').textContent = sp.name;
  $('cc-tally').textContent = verdict.tally;
  // (Its own weight: a fish in fine condition is heavier for its length than a lean one.) It comes
  // up on the spring balance, the needle swinging past and settling.
  const kg = agent?.weight ?? weightOf(sp, size);
  const wtText = (w) => (kg < 1 ? `${Math.round(w * 1000 / 10) * 10} g` : `${w.toFixed(kg < 10 ? 1 : 0)} kg`);
  const build = agent?.condition && !sp.creature ? ` · ${conditionWords(agent.condition)}` : '';
  const kgEl = document.createElement('span');
  kgEl.id = 'cc-kg';
  $('cc-size').replaceChildren(`${size} cm${sp.creature ? ' mantle' : ''} · `, kgEl, build);
  weighIn(kgEl, kg, wtText, verdict, isNew);
  $('cc-note').textContent = isNew ? sp.note : agent.caught > 0 ? 'This one has met your hook before.' : sp.creature ? pick(['It flushes pale and dark, and squirts a last jet of ink.', 'Its great eyes look you over.', 'It wraps an arm round your finger, then lets go.']) : pick(REPEAT_LINES);
  // (A venomous fish, a weever: unhooked with pliers and a cloth, never a bare hand.)
  if (sp.venom) hud.flash('Careful: venomous spines. Pliers and a wet cloth to unhook it, and keep your fingers clear of that black fin.', t, 4.5);
  $('cc-rig').textContent = (rigUsed?.item ? `Caught on ${rigUsed.item.on}, with the ${rigUsed.rod.short.toLowerCase()}` : '') + (state.trip?.sp === sp.id ? ' · the fish your trip is for' : '');
  const keepBtn = $('cc-keep');
  keepBtn.hidden = !sp.meal;
  const room = creelFits(state, weightOf(sp, size));
  keepBtn.disabled = !room;
  keepBtn.lastChild.textContent = room ? (state.keep.length && creelLoad(state) + weightOf(sp, size) > creelKg(state) * 0.75 ? 'Keep it (the creel’s nearly full)' : 'Keep for the pot') : 'No room in the creel';
  // (A small fish that makes a live bait: into the bait bucket, see livebait.js.)
  const baitBtn = $('cc-bait'), baitOk = baitRoom(sp.id, size);
  baitBtn.hidden = !isLiveBait(sp.id, size);
  baitBtn.disabled = !baitOk.ok;
  baitBtn.lastChild.textContent = baitOk.ok ? `Into the ${livewellHere() ? 'livewell' : 'bait bucket'}` : `The ${livewellHere() ? 'livewell' : 'bait bucket'} is full`;
  $('catch-card').hidden = false;
  document.body.classList.add('reveal');
  modal = 'catch';
  lastCatch = { sp, size, kg, best: bestBefore, condition: agent?.condition && !sp.creature ? conditionWords(agent.condition) : '' };
  if (isNew) hud.pulseJournal();
}

// Looking closer at the catch (see inspect.js): the card steps aside, and back.
let lastCatch = null;
const inspector = new CatchInspector({ onClose: () => closeInspect() });
function openInspect() {
  if (modal !== 'catch' || !lastCatch) return;
  $('catch-card').hidden = true;
  modal = 'inspect';
  inspector.open(lastCatch.sp, lastCatch.size, lastCatch);
}
function closeInspect() {
  inspector.close();
  if (modal !== 'inspect') return;
  if (inspectFrom === 'rockpool') {
    inspectFrom = null;
    $('rockpool').hidden = false;
    modal = 'rockpool';
    return;
  }
  $('catch-card').hidden = false;
  modal = 'catch';
}
let inspectFrom = null;

// The weight on the balance: the needle swings up past it, back, and settles; as it settles, the
// news (a fanfare for a first of its kind, a record or a fish of a lifetime, a chime for the rest)
// and a heave felt in your hands.
let weighing = 0;
function weighIn(el, kg, words, verdict, isNew) {
  const id = ++weighing, start = performance.now();
  let lastTick = 0;
  const step = (now) => {
    if (id !== weighing || $('catch-card').hidden) return;
    const s = (now - start) / 1000, w = needle(kg, s);
    el.textContent = `${s >= REVEAL_COUNT ? '' : '~'}${words(Math.max(0, w))}`;
    if (s < REVEAL_COUNT) {
      if (s - lastTick > 0.07 && s < REVEAL_COUNT * 0.7) {
        lastTick = s;
        audio.tick(0.25);
      }
      requestAnimationFrame(step);
      return;
    }
    el.classList.add('settled');
    if (isNew || verdict.stamp) audio.fanfare();
    else audio.chime();
    haptics.pulse('netted', verdict.lifetime ? 1.4 : verdict.stamp ? 1.1 : 0.7);
  };
  el.textContent = words(0);
  requestAnimationFrame(step);
}

function hideCatch() {
  document.body.classList.remove('reveal');
  $('catch-card').hidden = true;
  modal = null;
  // (Let go: a job wanting a fish photographed and released counts it now.)
  const e = state.log[state.log.length - 1], sp = fishById[e?.sp];
  if (sp) jobsDone(Con.caught(state.contracts, { sp: sp.id, size: e.size, sea: sp.water !== 'fresh', phase: 'released', photo: catchShot }));
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
  gearChip(rod, item);
  world.camp.setRackRods(ROD_IDS.filter((r) => !state.gear.pack.rods.includes(r)));
  save();
}

// The gear chip: the rod in hand and what's on it (a live bait with how many are left).
function gearChip(rod = RODS[state.gear.rod], item = currentRig(state.gear).item) {
  if (rod) hud.gear(rod, item, item?.live ? ` (${liveCount(state.gear.bucket, item.id)} left)` : '');
}

// Q: the next bait, lure or fly in your backpack that suits the rod in hand.
function nextTackle() {
  const g = state.gear, rod = RODS[g.rod];
  // (Live bait too, while there's some in the bucket: see livebait.js.)
  const options = carriedItems(g).filter((i) => fits(rod, TACKLE[i]));
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
// (Crewing in a friend's motorboat, her locker's yours to use too.)
const tackleBox = () => (nearCamp() || regionBox() || ownCampNear(4.5) ? 'tackle box' : chandleryNear() ? 'chandlery' : inGarage() ? 'tackle wall' : (!onFoot && boat.motor) || crewLocker() ? 'boat locker' : false);
const crewLocker = () => !!(crew.on && onFoot && visitors.boatOf(crew.on.id)?.hull.motor);
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
    const aboardOf = f.can.at.startsWith('boat:') ? BOATS[f.can.at.slice(5)] : null;
    out.push(p(`Jerry can: ${canWords(f)}, ${f.can.at === 'pack' ? 'in your backpack' : f.can.at === 'car' ? 'in the car' : aboardOf ? `aboard the ${aboardOf.name}` : 'in the garage at home'}.`, 'gx-kit-text'));
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
    // (Aboard a boat you walk about, as cargo on her deck: see cargo.js.)
    const deckBoat = !onFoot ? (cargoBoat(boat) ? boat : null) : boats.find((b) => cargoBoat(b) && Math.hypot(b.pos.x - P.x, b.pos.z - P.z) < 6);
    if (deckBoat && f.can.at === 'pack') row.append(btn(`Put it aboard the ${deckBoat.name}`, () => { canAboard(deckBoat, true); redo(); }, false, 'quiet'));
    if (aboardOf && (aboardOf === deckBoat || (!onFoot && aboardOf === boat))) row.append(btn('Take it off her, into your backpack', () => { canAboard(aboardOf, false); redo(); }, false, 'quiet'));
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
  wakeTimes: () => wakeTimes(),
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
  // (The market's and the kitchen's hours: the world's, which is the host's playing together.)
  worldHour: () => clock.hour,
  playerName: () => settings.player.name,
  sold: (logId) => setOutcome(logId, 'sold'),
  // (Playing together, friends are paid the same for the fish you sell, if you've chosen it.)
  shared: (v, kind) => shareSale(v, kind),
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
  favour: (who) => favourFor(who),
  // The rods Bert looks over: the ones you carry, and any other with worn line.
  rods: () => ROD_IDS.filter((id) => state.gear.pack.rods.includes(id) || wearOf(state, id) > 0)
    .map((id) => ({ id, name: RODS[id].name, line: lineInUse(state.gear, RODS[id]) })),
  trip: () => tripChecklist(),
  // Things for the boat (cargo.js): yours, where each is, the boats lying here to load, and
  // putting them aboard, ashore, refilled and charged.
  cargo: {
    items: () => state.cargo.items,
    boatsHere: () => cargoBoatsHere().map((b) => ({ kind: b.kind, name: b.name })),
    nameOf: (kind) => BOATS[kind]?.name || kind,
    buy: (id) => buyCargo(state.cargo, id),
    aboard: (uid, kind) => {
      const b = BOATS[kind], it = state.cargo.items.find((i) => i.uid === uid);
      if (!b || !it) return { ok: false, why: 'Not here.' };
      syncCargo(kind);
      const r = putAboard(state.cargo, uid, kind, cargoSpot(b, it.id));
      if (r.ok) syncCargo(kind);
      return r;
    },
    ashore: (uid) => {
      const it = state.cargo.items.find((i) => i.uid === uid), kind = it?.at.startsWith('boat:') ? it.at.slice(5) : null;
      if (kind) syncCargo(kind);
      if (carrying?.key === uid) carrying = null;
      const r = bringAshore(state.cargo, uid);
      if (kind) syncCargo(kind);
      return r;
    },
    renew: (uid) => {
      const it = state.cargo.items.find((i) => i.uid === uid);
      if (!it) return;
      it.full = true;
      if (it.at.startsWith('boat:')) syncCargo(it.at.slice(5));
    },
  },
  // Willowhaven Marine Works (see shipyard.js).
  yardKinds: () => KINDS.filter((k) => k !== 'row' && k !== 'kayak'),
  boatName: (kind) => BOATS[kind]?.name || kind,
  // Her stripe, tubes or flag (see papers.js), and what she can take.
  trimOf: (kind) => ({ stripes: !!BOATS[kind]?.hull && BOATS[kind].hull.stripe !== BOATS[kind].hull.paint && !BOATS[kind].hull.tubes, tubes: !!BOATS[kind]?.hull.tubes }),
  yardTrim: (kind, what, id) => {
    const T = { stripes: BOATS[kind].hull.stripe !== BOATS[kind].hull.paint && !BOATS[kind].hull.tubes, tubes: !!BOATS[kind].hull.tubes };
    yardDo(trimBoat(state, kind, what, id, T), () => {
      // (A flag's name as it reads in a sentence: "the Willowhaven Sailing Club burgee", "a plain
      // swallowtail", "code flag A".)
      const flagWords = (n) => (/^A /.test(n) ? n.replace(/^A /, 'a ') : /^Code /.test(n) ? n.replace(/^Code /, 'code ') : `the ${n}`);
      hud.toast(what === 'flag' ? (id ? `${flagById[id].name}: flying at her stern.` : 'The flag’s down and folded.') : what === 'tubes' ? 'New covers on her tubes.' : 'Her new stripe, fresh from the brush.', 3);
      vesselLog(kind, what === 'flag' ? (id ? `Flying ${flagWords(flagById[id].name)}.` : 'Her flag taken down.') : what === 'tubes' ? `New tube covers: ${PAINTS.find((p) => p.id === id).name.toLowerCase()}.` : `A new stripe: ${PAINTS.find((p) => p.id === id).name.toLowerCase()}.`);
    });
  },
  fishName: (id) => fishById[id]?.name.toLowerCase() || id,
  yardBuy: (kind) => yardDo(buyBoat(state, kind), () => {
    hud.toast(`The ${BOATS[kind].name} is yours. ${BOATS[kind].stowed ? 'She’s laid up at the yard: the harbour office puts her in the water whenever you like.' : ''}`, 6);
    audio.fanfare?.();
  }),
  yardHire: (kind) => yardDo(hireBoat(state, kind), () => {
    closeHarbour();
    hud.toast(`The ${BOATS[kind].name} is yours for a day: she goes back to the yard at ${formatClock((state.yard.hired?.until ?? ownAbs() + 24) % 24)} tomorrow.`, 6);
    if (BOATS[kind].stowed) launchBoat(BOATS[kind]);
    // (The board, written again for a boat you have now: jobs taken or done stay as they are.)
    state.contracts.board = null;
  }),
  yardPaint: (kind, paint) => yardDo(paintBoat(state, kind, paint), () => {
    hud.toast(`A fresh coat on the ${BOATS[kind].name}.`, 3);
    vesselLog(kind, `Painted ${PAINTS.find((p) => p.id === paint).name.toLowerCase()}.`);
  }),
  yardName: (kind, name) => yardDo(nameBoat(state, kind, name), () => {
    hud.toast(`“${state.yard.looks[kind].name}”, sign-written on her bow.`, 4);
    vesselLog(kind, `Named “${state.yard.looks[kind].name}”.`);
  }),
  yardFit: (kind, id) => {
    const r = fitBoat(state, kind, id);
    yardDo(r, () => {
      hud.toast(r.swapped ? `Fitted, in place of the ${FITS[r.swapped].name.toLowerCase()}.` : 'Fitted.', 3);
      vesselLog(kind, `Fitted: ${FITS[id].name.toLowerCase()}.`);
    });
  },
  yardUnfit: (kind, id) => yardDo(unfitBoat(state, kind, id), () => hud.toast('Taken off: back in the store.', 2)),
  // Her engine and propeller (see engines.js): what's on her, and a new one fitted while you
  // wait; her tank and the spec of any choice, for the comparison's figures.
  yardEngine: (kind) => engineOf(state.yard, kind),
  yardRepower: (kind, model) => yardDo(repowerBoat(state, kind, model), () => vesselLog(kind, `Re-engined: ${fittedName(kind, model)}.`) || hud.toast(`The ${fittedName(kind, model)} ${MODELS[model].inboard ? 'are in her engine room' : CATALOGUE_COUNT(kind) > 1 ? 'are on her transom' : 'is on her transom'}, the old taken in.`, 4)),
  // A propeller bent on the bottom (boat.js propStrike): how bad, and a new one of the same.
  propDamage: (kind) => engines[kind]?.dmg || 0,
  yardMendProp: (kind) => {
    if (engines[kind]) engines[kind].dmg = 0;
    BOATS[kind]._strikeBand = -1;
    audio.chime?.();
    vesselLog(kind, 'A new propeller, for the one bent on the bottom.');
    hud.toast('The yard fits a new propeller: she’s herself again.', 3);
    save();
  },
  // Her knocks (damage.js): what the yard would do to put each right, and doing it.
  repairsFor: (kind) => (damages[kind] ? damageRepairs(damages[kind], kind, BOAT_PRICES[kind]) : []),
  yardRepair: (kind, id) => {
    const D = damages[kind];
    if (!D || !mendDamage(D, id)) return;
    BOATS[kind]._dmgBand = null;
    BOATS[kind].sagTubes?.();
    audio.chime?.();
    const [part, key] = id.split(':');
    const PART = { steer: 'Her steering', mount: 'The engine’s bracket', wiring: 'The battery terminal', water: 'Her bilge (pumped out)' };
    vesselLog(kind, id === 'all' ? 'Her knocks put right at the Marine Works.' : part === 'tube' ? `The ${CHAMBERS[+key]} tube patched at the Marine Works.` : part === 'hull' ? `${SECTION_NAMES[key].replace(/^her /, 'Her ')} put right at the Marine Works.` : `${PART[part] || 'She'} put right at the Marine Works.`);
    hud.toast(id === 'all' ? 'The yard puts her right: she’s herself again.' : 'Done: the yard puts it right.', 3);
    save();
  },
  yardReprop: (kind, prop) => yardDo(repropBoat(state, kind, prop), () => (engines[kind] && (engines[kind].dmg = 0)) || vesselLog(kind, `New propeller${CATALOGUE_COUNT(kind) > 1 ? 's' : ''}: ${propName(kind, prop).toLowerCase()}.`) || hud.toast(`New propeller${CATALOGUE_COUNT(kind) > 1 ? 's' : ''} on: ${propName(kind, prop).toLowerCase()}.`, 3)),
  tankOf: (kind) => TANKS[kind] || 0,
  engineSpecFor: (kind, choice) => engineSpec(kind, BOATS[kind].hull, choice),
  // The look at a boat at the Marine Works (see boatPreview.js).
  preview: (want) => boatPreview.show({ ...want, motor: BOATS[want.kind]?.motorSpec || null }),
  previewTurn: (dx) => boatPreview.turn(dx),
  previewStop: () => boatPreview.stop(),
});
const boatPreview = new BoatPreview((scene, kind) => new Boat(scene, { kind }));
// Something done at the Marine Works: paid for and done, or why not.
// A line in a boat's log (her papers: see papers.js), if she's yours.
function vesselLog(kind, text) {
  logLine(state.yard.vessels?.[kind], state.day, text);
}
// What she's done under her own power, while you're in her: engine hours, sea miles, fuel.
function vesselRun(dt, hours, litres) {
  if (onFoot || !boat || !state.yard.vessels?.[boat.kind]) return;
  const E = engines[boat.kind];
  addRun(state.yard.vessels[boat.kind], { hours: boat.motor && (!E || engineRunning(E)) ? hours : 0, metres: Math.abs(boat.speed) * dt, litres });
}

function yardDo(r, then) {
  if (!r.ok) {
    hud.toast(r.why, 4);
    return;
  }
  audio.chime?.();
  applyYard();
  then?.();
  save();
  harbourSheet.render();
}
// where: 'market' (Willowhaven's fish market), 'inn' (The Lobster Pot), 'muelle' (Bar El Muelle),
// 'chandlery' (its counter: creels, ice, fresh bait, mending, ready for a trip) or 'kaigan' (the
// Nikkei kitchen's door, buying fish fit to eat raw: see kaigan.js).
function openHarbour(where, tab = null) {
  if (modal) return;
  modal = 'harbour';
  harbourSheet.open(where, tab);
  audio.page();
  if (where === 'chandlery') teach('counter', 'The chandlery’s tackle is free, as always. At the counter Old Bert sells a bigger creel, ice and fresh bait, and puts new line on a worn rod.', 10);
  else if (where === 'market') teach('market', 'The fish market buys what you keep, by weight: more for the kinds wanted today, and best while it’s fresh.', 9);
  else if (where === 'kaigan') teach('kaigan', 'Kaigan pays well over the market for sea fish fit to eat raw: caught within twelve hours (ice stops the clock). A whole bluefin is the best price on the coast.', 10);
  else if (where === 'works') teach('works', 'Willowhaven Marine Works: buy or hire a boat, paint her and name her, fit a bigger tank or outboard. Money buys range, speed and looks, never a better bite.', 10);
  else teach('inn', 'The inn: a pint and a story, what’s biting, and the talk of the sea. The kitchen asks for particular fish each day, and pays well.', 9);
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
    advice: { place, hour: clock.hour, rain: weather.rain, wind: conditions.wind.speed, storm, tide: tideNow, about: home ? whatsAbout(eco) : whatsAbout(eco, { south: true, x: PUERTO_AT.x, z: PUERTO_AT.z, reach: 900, max: 2 }), caught: new Set(Object.keys(state.fish)) },
    rumours: {
      place, hour: clock.hour, nameOf, storm, rain: weather.rain,
      birds: home ? birdsWorking(world.flocks, state.places) : [],
      gannets: home && F ? { x: F.school.x, z: F.school.z } : null,
      boil: tuna ? { x: tuna.x, z: tuna.z } : null,
      // (Dolphins only when they're somewhere with a name: close in, worth going to look for.)
      pods: clock.hour > 6 && clock.hour < 21 ? sealife.pods.filter((p) => p.sea === (home ? 'home' : 'south') && (!home || placeName(p.x, p.z))).slice(0, 1).map((p) => ({ kind: p.kind, x: p.x, z: p.z })) : [],
      whales: sealife.whales.filter((w) => w.sea === (home ? 'home' : 'south') && w.state !== 'down').slice(0, 1).map((w) => ({ kind: w.kind, x: w.x, z: w.z, up: w.state === 'breathe' })),
      glow: nightGlow(clock.day),
      news: home ? town.news(clock.hour) : town.newsSouth(clock.hour),
      yours,
    },
  };
}
// Ready for a trip: what Bert runs through with you at the counter.
function tripChecklist() {
  const out = [];
  const now = state.day * 24 + state.hour, cap = creelKg(state), free = Math.max(0, cap - creelLoad(state));
  out.push({ ok: free >= cap * 0.3, text: free > 0.05 ? `Room in your creel for ${kgWords(free)} more fish (it holds ${cap} kg).` : `Your creel is full (${cap} kg). Sell some at the market, or cook them.` });
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
  // (An electric outboard: its battery, charged at a jetty and overnight.)
  if (ELEC[v] && BOATS[v]) {
    const low = elecLevel(tanks(), v) < 0.4;
    out.push({ ok: !low, text: `${boatTitle(BOATS[v])}: ${elecWords(tanks(), v)}${low ? '. Leave her tied up at a jetty or the pontoon a while and it charges.' : '.'}` });
  } else if (isPetrol(v) && BOATS[v]) {
    const low = fuelLow(tanks(), v);
    out.push({ ok: !low, text: `${boatTitle(BOATS[v])}: ${tankWords(tanks(), v)}${low ? '. Fill up at the fuel point on the pontoon, or the pump by the quay.' : '.'}` });
  }
  out.push(freshBaitToday(state) ? { ok: true, text: 'Fresh bait for today.' } : { ok: true, text: 'No fresh bait today (a help with worms and crab, never a need).' });
  const storm = Math.max(weather.storm, conditions.sea.storm);
  out.push({ ok: storm < 0.4, text: storm >= 0.4 ? 'A storm is blowing: stay in the bay and the sheltered water today.' : weatherLines(weather.rain > 0.6 ? 'Heavy rain' : weather.rain > 0.15 ? 'Light rain' : weather.cloud > 0.7 ? 'Overcast' : weather.cloud > 0.3 ? 'Some cloud' : 'Clear')[0] });
  out.push({ ok: true, text: `Tide: ${tideWords(clock.abs)}.` });
  {
    const abs = clock.abs, h = hoursToGale(abs), g = h != null ? galeNear(abs) : null;
    if (g && h < 14) out.push({ ok: false, text: `Gale due about ${formatClock(g.start % 24)}: plan to be in sheltered water by then (the estuary, the coves, the bay or the lakes fish well in a blow).` });
  }
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
  payOut(state, ICE.price, 'Ice');
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
const innNear = () => onFoot && !driving && insideHaven(walker.pos.x, walker.pos.z) === 'inn';
// The kitchen's board by the pass, chalked up with what Ruth wants tonight (crossed off as it comes).
let kitchenChalk = '';
function chalkKitchen() {
  const orders = ordersFor(state.day, 'haven').map((o) => ({ name: fishById[o.id].name, min: o.min > fishById[o.id].size[0] ? o.min : 0, done: (state.harbour?.filled || []).includes(o.key) }));
  const closed = clock.hour < 6 || clock.hour >= ORDERS_BY, key = JSON.stringify([orders, closed]);
  if (key === kitchenChalk) return;
  kitchenChalk = key;
  world.coast.paintKitchen((ctx, w, h) => paintKitchenBoard(ctx, w, h, { orders, closed }));
}

let sleeping = null;
function sleepUntil(h) {
  if (sleeping) return;
  if (clock.following) {
    hud.toast(timeIsHosts(), 6);
    return;
  }
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
  const w = wakeTimes().find((x) => x.h === h);
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
  if (skyMode() === 'auto' && !clock.following) {
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
  // (Overnight, the bass boat's battery charges wherever you sleep, and an electric outboard's.)
  tanks().battery = 1;
  tanks().kayak = 1;
  for (const k of Object.keys(ELEC)) if (ELEC[k]) chargeElec(tanks(), k, 24);
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
// (b: where from; your boat, unless you're crewing in a friend's: see crew.js.)
function shoreSpot(b = boat.pos) {
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
  const notch = settings.controls.throttle === 'lever' ? '' : ' a notch';
  const lever = T ? `the stick up or down moves the throttle${notch} (it stays where you leave it), across steers; Stop knocks it into neutral.`
    : S ? `${stick} up or down moves the throttle${notch} (it stays where you leave it), across steers; ${key('neutral')} stops, ${key('anchor')} anchors.`
      : `${key('forward')} and ${key('back')} move the throttle${notch} (it stays where you leave it), ${key('left')} and ${key('right')} steer, ${key('neutral')} stops, ${key('anchor')} anchors.`;
  const use = T ? 'tap the prompt' : `press ${key('interact')}`;
  const text = {
    skiff: `The motor skiff, for the open coast: ${lever} Near a shore, slow down and ${use} to step off.`,
    kayak: `The kayak: slow, silent, and it floats in a hand’s depth, so you can creep up on fish in the shallows and reeds. ${S ? `${T ? 'The stick' : 'The left stick'} paddles and steers.` : `${key('forward')}${key('left')}${key('back')}${key('right')} paddle and steer.`} Its little electric motor: ${T ? 'the Lower motor button' : key('motor')}.`,
    bass: `The bass boat: ${lever} The first notches run the quiet electric motor at the bow, for creeping along the weed; push on for the outboard. Longmere has no pump: bring the jerry can.`,
    windsurf: `The windsurf board: ${T ? 'the stick up sheets in, down eases out, across steers' : S ? `${stick} up and down sheets in and out, across steers` : `${key('forward')} sheets in, ${key('back')} eases out, ${key('left')} and ${key('right')} steer`}. In a good breeze it planes and flies; ease out in the gusts or you’re catapulted in. No fishing, no anchor.`,
    console: `The centre console: twin outboards, about twenty-six knots on the pair she came with (the Marine Works has others). ${lever} To fish, just cast: you step back into the cockpit to face your line.`,
    rib: `The RIB: a deep-V hull with tubes for sides, one big outboard, about thirty-five knots on the engine she came with (the Marine Works has others). ${lever} Her tubes keep her steady and dry in a sea. To fish, just cast: you step back to face your line.`,
    jetski: `The jet ski: over thirty knots. ${lever} It steers by its jet, so it only turns with the throttle on. Hold on over the crests. No fishing from it.`,
    cruiser: `The sport-fishing yacht: twin diesels, a cabin with bunks and a galley, and an open cockpit to fish from. ${lever} About nineteen knots on her own diesels (the Marine Works has bigger), slow to turn at speed. Anchor or tie up, then ${use} for the cabin. She can cross to Las Brasas (${use} out on open water).`,
    cabin: `The cabin boat: slow and steady, with a bunk and a galley stove. ${lever} Anchor or tie up, then ${use} for the cabin: cook, and sleep aboard.`,
    sail: `The sailing boat: ${T ? 'raise the sail on the panel' : `raise the sail (${key('motor')})`}, then ${T ? 'the stick up hauls the sheet in, down eases it, across steers' : S ? `${stick} up and down haul the sheet in and ease it, across steers` : `${key('forward')} hauls the sheet in, ${key('back')} eases it, ${key('left')} and ${key('right')} steer`}. Flapping: haul in. Slow and heeling: ease out. Nothing drives her straight into the wind: zigzag upwind. She can cross to Las Brasas (${use} out on open water).`,
  }[k];
  hud.toast(text, 9);
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
// The towline parted (snatched past its breaking load: see lines.js): the towed boat's adrift
// where she is, with what's left of the line trailing.
function partTow() {
  const { lead, towed } = tow, name = towed.name;
  tow = null;
  towRope.hide();
  audio.knock?.(1);
  audio.thud?.();
  haptics.pulse('snap', 1);
  if (!settings.controls.reducedMotion) rig.shake = Math.max(rig.shake, 0.2);
  vesselLog(lead.kind, `The towline parted, towing the ${name}.`);
  hud.flash(`Crack: the towline’s parted, snatched past what it holds (${Math.round((LINES.towline.mbl * (STRENGTH[state.difficulty] ?? 1)) / 1000)} kN). The ${name} is adrift where she is: come back alongside, slowly, and take her in tow again, then open up gently once it’s taken the strain.`, t, 7);
  save();
}
function updateTow(dt) {
  if (!tow) return;
  const { lead, towed } = tow;
  // (Anything that parts them, a journey by map, say, or one of them made fast, lets the tow go.)
  if (Math.hypot(lead.pos.x - towed.pos.x, lead.pos.z - towed.pos.z) > 30 || towed.tie || towed.anchored) {
    letGoTow(true);
    return;
  }
  // (The line's pull, and whether it's parted: see lines.js. On Relaxed it never parts.)
  const out = (tow.out ||= {});
  const strength = STRENGTH[state.difficulty] ?? 1;
  tow.tight = towStep(lead, towed, dt, TOW.len, out, strength);
  tow.T = out.T || 0;
  tow.peak = Math.max((tow.peak || 0) * Math.exp(-dt / 3), out.load || 0);
  if (out.parted) return partTow();
  // (Near its breaking load: a word, now and then, before it goes.)
  if (out.load > 0.6 && lead === boat && t > (tow.warnT || 0)) {
    tow.warnT = t + 6;
    haptics.pulse('creak', Math.min(1, out.load));
    audio.creak?.(0.045 * Math.min(1, out.load), 0);
    hud.flash(`The towline’s ${loadWords(out.T, LINES.towline)}: ease off${strength === Infinity ? '' : ', or it’ll part'}. Take up the slack slowly before you open her up.`, t, 3);
  }
  lead.body.localToWorld(_ts.copy(lead.cleats[1]));
  towed.body.localToWorld(_tb.copy(towed.cleats[0]));
  towRope.lay(_ts, _tb, { tension: tow.tight, sag: 0.9 });
}
// (A tow kept from last time, if the two boats are still together.)
{
  const T = state.tow, L = T && BOATS[T.lead], W = T && BOATS[T.towed];
  if (L && W && L !== W && !L.stowed && !W.stowed && !W.tie && !W.anchored && Math.hypot(L.pos.x - W.pos.x, L.pos.z - W.pos.z) < TOW.len * 3) tow = { lead: L, towed: W, tight: 0 };
}

// The mooring prompt (the anchor key, X on a controller, or a tap): what holding her still means
// here and now. Tied up: cast off. Beside a pier: tie up. Towing: let the tow go. Out on the
// water: the anchor, down or up.
function mooringAction() {
  if (!started || modal || onFoot || driving || cabinIn || placement.isOn) return null;
  if (boat.tie) return { text: 'Cast off', run: castOff };
  if (fishing.state === 'reeling' || fishing.state === 'landing') return null;
  const sp = boat._avgSpeed ?? boat.speed;
  if (!boat.anchored && sp < 3) {
    const B = berthFor(boat, boats);
    // (Beside a berth but still moving: say so, rather than the prompt simply not being there.)
    if (B && sp < 0.9) return { text: 'Tie up alongside', run: () => tieUp(B) };
    if (B) return { text: `Slow down to tie up (${sp.toFixed(1)} m/s)`, run: () => {}, busy: true };
  }
  if (tow && (tow.lead === boat || tow.towed === boat)) return { text: `Let go the tow (the ${tow.lead === boat ? tow.towed.name : tow.lead.name})`, run: () => letGoTow() };
  if (boat.anchored) return boat.anchor?.phase === 'haul' ? { text: 'Hauling in the anchor…', run: () => {}, busy: true } : { text: 'Raise the anchor', run: toggleAnchor };
  if (sp < 1) return { text: 'Drop the anchor', run: toggleAnchor };
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
  boat.setDeck?.(false);
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

// Stepping aboard from the bank or a jetty, or ashore from her, when you choose to: a moment's step
// up and over her side (see walker.stepTo), the keys doing nothing till you're there. (Anything
// else that puts you in a boat or ashore, a crossing, a dive, crewing, does it at once.)
const _stepV = new THREE.Vector3();
// A place on her deck (her own space) near a point in the world: inside her sides, clear of her ends.
function deckNear(b, from) {
  const H = b.hull, L = b.body.worldToLocal(_stepV.copy(from));
  const z = clamp(L.z, -H.L / 2 + H.L * 0.18, H.L / 2 - H.L * 0.22);
  const half = H.B * H.hw((z + H.L / 2) / H.L);
  return { x: clamp(L.x, -half * 0.4, half * 0.4), y: deckY(H, z) + 0.02, z };
}
function climbAboard(b) {
  if (!onFoot || walker.stepping || driving || dive || Math.hypot(walker.pos.x - b.pos.x, walker.pos.z - b.pos.z) > b.hull.L + 3) return board(b);
  const D = deckNear(b, walker.pos), v = new THREE.Vector3();
  const target = () => b.body.localToWorld(v.set(D.x, D.y, D.z));
  const p1 = target().clone(), far = Math.hypot(p1.x - walker.pos.x, p1.z - walker.pos.z);
  audio.step(false);
  walker.stepTo(target, { dur: clamp(far / 1.5, 0.55, 1.1), lift: 0.22 + Math.max(0, p1.y - walker.pos.y) * 0.35 }, () => board(b));
}
function climbOff(spot) {
  if (onFoot || walker.stepping) return stepAshore(spot);
  const b = boat, H = b.hull, at = b.fromYou(new THREE.Vector3(), 0, 0, 0);
  const from = b.body.localToWorld(new THREE.Vector3(at.x, deckY(H, at.z) + 0.02, at.z));
  stepAshore(spot);
  const end = new THREE.Vector3(spot.x, walkHeight(spot.x, spot.z), spot.z), far = Math.hypot(end.x - from.x, end.z - from.z);
  walker.heading = Math.atan2(end.x - from.x, end.z - from.z);
  walker.stepTo(() => end, { from, dur: clamp(far / 1.5, 0.55, 1.2), lift: 0.22 + Math.max(0, end.y - from.y) * 0.35 }, () => audio.step(false));
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
diver.solid = pushOut;
const shot = new Shot(scene, new Rope(scene, { segments: 10, radius: 0.0035, color: '#e9e4d6' }));
const fpGun = buildGun();
fpGun.scale.setScalar(0.85);
fpGun.visible = false;
scene.add(fpGun);
const diveIn = { fwd: 0, up: 0, kick: false, dir: new THREE.Vector3(0, 0, 1) };
const diverCtx = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, speed: 0, kicking: false, still: 0 };
const UP_Y = new THREE.Vector3(0, 1, 0);
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
  } else if (!driving && !indoorsAt(walker.pos.x, walker.pos.z)) {
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
    : P ? `<b>Diving</b> · ${kbd('L-stick')} swim where you look · ${kbd('R-stick')} look · hold ${kbd('LT')} to look about · ${K('interact')} up · ${K('tackle')} down`
      : `<b>Diving</b> · ${K('forward')}${K('back')} swim where you look · ${K('left')}${K('right')} turn · drag to look · hold the right mouse button to look about · ${K('interact')} up · ${K('tackle')} down`, 7);
  if (kit === 'free') {
    teach('freedive', `Freediving: one breath. Turn for the surface at the mark on the gauge, and swim slowly to make it last. ${T ? 'The action button' : K('cast')} fires the speargun: aim just behind the head.`, 10);
  } else {
    teach('scuba', `Scuba: air goes faster the deeper you are. Head up at ${SCUBA.reserve} bar, slowly, with a stop at five metres after a dive below ${SCUBA.stopFrom} m. ${T ? 'The action button' : K('cast')} takes a photo.`, 10);
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
  if (d.maxDepth > 1.5) noteDive(state.today, d.site?.id || null, d.maxDepth);
  challengesDone();
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
    hud.toast(`${d.kit === 'free' ? 'Freedive' : 'Scuba dive'}${d.site ? ` at ${d.site.name.replace(/^The /, 'the ')}` : ''}: ${mins} min in the water, down to ${d.maxDepth.toFixed(1)} m${d.kit === 'free' && d.longest > 5 ? `, longest breath-hold ${Math.round(d.longest)} s` : ''}${d.kit === 'scuba' ? `, ${Math.round(S.tank)} bar left` : ''}${fish}.`, 6);
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
  // (Looking about, the right mouse button or LT held: you swim on the way you were going.)
  if (!rig.looking) camera.getWorldDirection(diveIn.dir);
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
  diveSiteStep(depth);
  noteLife(dt);
  findStep(dt);
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

// At a dive site: the first time you're down there, what it is (and, at the Hound, what the tide's
// doing: it runs hard over it); every dive there goes in the log, and the deepest you've been.
function diveSiteStep(depth) {
  const d = dive, P = diver.pos;
  if (depth < 2.5) return;
  const S = d.site || siteAt(P.x, P.z);
  if (!S) return;
  if (!d.site) {
    d.site = S;
    const first = logSite(state.dive, S.id, state.day, depth);
    hud.place(S.name, S.sub);
    // How far you can see today (the clearest you've had here goes in the log).
    const vis = underwater.visibility(weather.rain, env.night), rec = state.dive.sites[S.id];
    rec.vis = Math.max(rec.vis || 0, vis);
    if (first) {
      audio.chime();
      const c = currentAt(S.x, S.z, 0), slack = turns(clock.abs, 1)[0];
      const tide = S.id === 'hound' ? (Math.hypot(c.x, c.z) > 0.18 ? ` The tide’s running across it: hard work down here. Slack water about ${formatClock(slack.at % 24)}.` : ' The tide’s slack: a good time to be here.') : '';
      const look = SITE_DETAILS[S.id] ? ` Visibility about ${vis} m today. Look around: there’s more here to find.` : ` Visibility about ${vis} m today.`;
      hud.toast(`${S.first}${tide}${look}`, 11);
      shareFind('site', S.x, S.z, S.name, `Dived to ${depth.toFixed(0)} m, visibility about ${vis} m.`, S.id);
      hud.pulseJournal();
    }
  }
  const rec = state.dive.sites[S.id];
  if (rec && depth > rec.deepest && Math.hypot(P.x - S.x, P.z - S.z) < S.r + 12) rec.deepest = Math.round(depth * 10) / 10;
}

// What there is to find at a site (see divesites.js SITE_DETAILS): within reach and in view, it
// goes in the log (and the journal), and to your friends if you're sharing what you find.
let findT = 0;
const _ff = new THREE.Frustum(), _fm = new THREE.Matrix4(), _fv = new THREE.Vector3();
function findStep(dt) {
  if ((findT -= dt) > 0 || !dive?.site || dive.black || diver.depth < 1) return;
  findT = 0.3;
  const S = dive.site, rec = state.dive.sites[S.id];
  // (Within reach of you, the diver; in view of the camera behind you.)
  const near = detailsNear(S.id, diver.pos, rec?.found || []);
  if (!near.length) return;
  _fm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _ff.setFromProjectionMatrix(_fm);
  const F = near.find((d) => _ff.containsPoint(_fv.set(d.x, d.y, d.z)));
  if (!F || !logFind(state.dive, S.id, F.id, state.day)) return;
  jobsDone(Con.found(state.contracts, S.id));
  const all = SITE_DETAILS[S.id], n = state.dive.sites[S.id].found.filter((id) => all.some((d) => d.id === id)).length;
  audio.chime();
  laterT = Math.max(laterT, 9); // (the field notes can wait their turn)
  hud.toast(`${F.note}${all.length > 1 ? ` (${n} of ${all.length} found on ${S.name === 'The Kittiwake' ? 'her' : S.name}.)` : ''}`, 10);
  hud.pulseJournal();
  const what = `${F.name[0].toUpperCase()}${F.name.slice(1)}`;
  shareFind('detail', F.x, F.z, S.id === 'wreck' ? `The Kittiwake: ${F.name}` : what, F.note);
  save();
}

// The naturalist's notes (see grounds.js): what lives within reach of you on the bottom, the reef
// or the wreck, the first time you meet it (and once a dive after that).
let lifeT = 0;
function noteLife(dt) {
  if ((lifeT -= dt) > 0 || diver.depth < 0.8) return;
  lifeT = 0.5;
  const d = dive, P = diver.pos;
  d.met ||= new Set();
  const near = seabed.kindsNear(P, 2.6);
  world.dives.kindsNear(P, 2.8, near);
  drifters.kindsNear(P, 4, near);
  const fresh = [];
  for (const k of near) {
    if (!NATURE[k] || d.met.has(k)) continue;
    d.met.add(k);
    if (noteNature(state.grounds, k, { day: state.day, hour: state.hour, where: placeName(P.x, P.z) || '' })) fresh.push(k);
  }
  if (!fresh.length) return;
  // (One at a time, with its note; several at once, by name: the journal has the rest.)
  const names = fresh.map((k) => `the ${NATURE[k].name.toLowerCase()}`);
  later(fresh.length === 1 ? `Your field notes: ${names[0]}. ${NATURE[fresh[0]].note}` : `Your field notes: ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}. (Notes, in the journal.)`);
  hud.pulseJournal();
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
  hud.toast('You blacked out. That’s how freedivers drown: never dive alone, and turn back with breath to spare. Here, you come to at the surface.', 10);
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
    if (!creelFits(state, weightOf(a.sp, a.size))) {
      hud.flash(`No room in your creel for it (${creelWords(state)}): take only what you’ll eat. Cook some at camp first.`, t, 3.2);
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
  notePressure(a.x, a.z);
  state.keep.push({ id: sp.id, size, logId: lastCatchId, at: state.day * 24 + state.hour });
  setOutcome(lastCatchId, 'kept');
  state.dive.speared++;
  dive.catches.push(`${sp.name.toLowerCase()} ${size} cm`);
  hud.flash(`${isNew ? 'A first! ' : ''}${sp.name}, ${size} cm: on the stringer`, t, 3);
  if (isNew) {
    audio.fanfare();
    hud.pulseJournal();
  } else audio.chime();
  teach('speared', `Speared fish go in your creel (it holds ${creelKg(state)} kg of fish), to cook at camp: a speargun only takes what you keep, so take only what you'll eat.`, 7);
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
// (Following a running fish, she may go at a trolling pace: see followAction.)
const leverSituation = () => (fishing.state === 'reeling' || fishing.state === 'landing' ? (following ? 'line' : 'fight') : fishing.busy ? (fitsAboard()?.holders ? 'line+' : 'line') : 'free');
// What the boat you're in has fitted (see shipyard.js), or null ashore. (Worked out once a frame.)
let fitsCache = { t: -1, e: null };
function fitsAboard() {
  if (fitsCache.t === t) return fitsCache.e;
  fitsCache = { t, e: !onFoot && !driving && boat ? fitEffect(state.yard, boat.kind) : null };
  return fitsCache.e;
}
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
  // (Twin engines, the levers apart: the one picked, or both.)
  if (boat.split) return setSplit(() => r.v);
  changeLever(r.v);
}

/* ---------------- twin engines: the levers together, or apart ---------------- */

// At the helm of twin engines (the centre console's outboards, the yacht's diesels) the throttle
// keys work both levers, the port one or the starboard one (the levers action: ; or the D-pad on a
// controller, each press the next; or the lever panel's buttons). Apart (boat.split: [port,
// starboard]: see boat.js), each engine pushes with its own, so one ahead and one astern turn her
// on the spot. Neutral joins them, and so do both levers at the same notch with both picked.
let leverSel = 'both';
const twinHelm = () => !!leverKind() && boat.engine?.engines?.length === 2 && !!(boat.hull.motor?.twin || boat.hull.motor?.inboard);
const SIDE = { port: 'port', stbd: 'starboard' };
function cycleLevers() {
  if (twinHelm()) selectLevers({ both: 'port', port: 'stbd', stbd: 'both' }[leverSel]);
}
function selectLevers(sel) {
  if (!twinHelm()) return;
  leverSel = sel;
  if (sel !== 'both' && !boat.split) boat.split = [boat.lever, boat.lever];
  if (sel === 'both') joinLevers(false);
  audio.tick?.(0.2);
  haptics.pulse('notch');
  hud.flash(sel === 'both' ? (boat.split ? 'Both levers: they move together, apart as they are. Neutral joins them.' : 'Both levers, together.') : `The ${SIDE[sel]} lever: the throttle works it alone.`, t, 2.2);
  teach('twinLevers', `Twin engines: ${scheme() === 'pad' ? kbd('D-pad →') : K('levers')} picks the lever the throttle works: both, the port one, the starboard one. One ahead and one astern turns her on the spot; neutral joins them again.`, 7);
}
function joinLevers(neutral) {
  if (!boat.split) return;
  if (neutral || boat.split[0] === boat.split[1]) {
    boat.lever = neutral ? 0 : boat.split[0];
    boat.split = null;
    leverSel = 'both';
  }
}
// The picked lever(s) to a new value (f: from the old), clicking into their notches; both picked
// and now level, one lever again. boat.lever keeps their mean, for what reads it (the words).
function setSplit(f) {
  const S = boat.split, idx = leverSel === 'port' ? [0] : leverSel === 'stbd' ? [1] : [0, 1];
  let moved = false;
  for (const i of idx) {
    const v = f(S[i]);
    if (v !== S[i]) moved = true;
    S[i] = v;
  }
  if (moved) {
    audio.tick?.(0.35);
    haptics.pulse(idx.some((i) => S[i] === 0) ? 'detent' : 'notch');
  }
  if (leverSel === 'both') joinLevers(false);
  if (boat.split) boat.lever = (S[0] + S[1]) / 2;
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
  if (boat.split) {
    let capped = false;
    setSplit((v) => {
      const r = step(kind, v, dir, leverSituation());
      capped ||= r.capped;
      return r.v;
    });
    if (capped && fresh) hud.flash(CAP_WORDS[leverSituation()], t, 2.6);
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
  // (The lever clicking into its notch, and the firmer detent at neutral.)
  haptics.pulse(v === 0 ? 'detent' : 'notch');
}
function leverNeutral(say = false) {
  if (!leverKind()) return;
  if ((boat.lever || boat.split) && say) hud.flash('Neutral: the motor idles, and she coasts on', t, 1.6);
  joinLevers(true);
  changeLever(0);
}
// The tilt button (\, or the button on the throttle panel): the outboard's leg (both, on twins)
// right up out of the water at rest or near it, or back down to run; the leg travels by itself
// (see updateEngine). Tilting up knocks her into neutral: the propeller's coming out of the
// water. (The sailing boat's little outboard comes up on its bracket, as its own button does.)
function tiltOutboards() {
  if (!started || modal || onFoot || driving) return;
  if (boat.hull.outboard) return toggleOutboard();
  const k = leverKind(), E = k && boat.motor ? engines[k] : null;
  if (!E) return;
  const r = tiltToggle(E, boat.forwardSpeed);
  if (r.why === 'none') return hud.flash('There’s no outboard leg to tilt on her.', t, 2);
  if (r.why === 'fast') return hud.flash('Slow down first: under way the leg only trims, it won’t tilt right up.', t, 2.4);
  if (r.to === 'up' && boat.lever) changeLever(0);
  const two = ENGINES[E.kind].engines > 1;
  hud.flash(r.to === 'up' ? `Tilting the ${two ? 'outboards' : 'outboard'} up, the ${two ? 'propellers' : 'propeller'} out of the water` : `Tilting the ${two ? 'outboards' : 'outboard'} down to run`, t, 2);
  audio.tick?.(0.3);
}

// Held forward or back (the keys, or the stick pushed well over): one notch now, and more
// while held, pausing at neutral. Or, with the smooth lever (Settings → Controls → Throttle),
// the lever moves as long as it's pushed, faster the further, and stays where it's left.
let leverHeld = 0, leverRepeat = 0;
let tieWordT = 0;
function helmInput(raw, dt, across = 0) {
  // (On a controller, the stick pushed mostly sideways steers without touching the throttle.)
  const up = pads.active && Math.abs(across) > Math.abs(raw) * 1.2 ? 0 : raw;
  if (settings.controls.throttle === 'lever') {
    slideLever(up, dt);
    return;
  }
  const dir = Math.abs(up) > 0.55 ? Math.sign(up) : 0;
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

// The smooth lever's place along its travel (see throttle.js), kept in step with boat.lever
// (which other things set too: a notch tapped on screen, neutral when a fish takes).
const leverS = { pos: 0, stopped: false, v: 0, kind: null };
let leverWordT = 0;
function leverPos(kind) {
  if (leverS.kind !== kind || leverS.v !== boat.lever) {
    leverS.pos = positionOf(kind, boat.lever);
    leverS.v = boat.lever;
    leverS.kind = kind;
  }
  return leverS.pos;
}
function slideLever(push, dt) {
  const kind = leverKind();
  if (!kind) return;
  const pos = leverPos(kind);
  const p = Math.abs(push) < 0.12 ? 0 : push;
  if (p && boat.tie) {
    if (t > leverWordT) {
      leverWordT = t + 3;
      hud.flash(`Tied up alongside: cast off first (${scheme() === 'touch' ? 'the Cast off prompt' : K('anchor')})`, t, 2.2);
    }
    return;
  }
  if (p > 0 && boat.anchored && pos >= 0) {
    if (t > leverWordT) {
      leverWordT = t + 3;
      hud.flash(`The anchor is down: raise it first (${K('anchor')})`, t, 2);
    }
    return;
  }
  const r = slide(kind, leverS, push, dt, leverSituation());
  if (r.capped && t > leverWordT) {
    leverWordT = t + 3;
    hud.flash(CAP_WORDS[leverSituation()], t, 2.6);
  }
  if (r.detent) {
    audio.tick?.(0.4);
    haptics.pulse('detent');
  }
  if (leverS.pos !== pos) {
    boat.lever = valueAt(kind, leverS.pos);
    leverS.v = boat.lever;
  }
}

// Casting from a boat under power: if she's going faster than trolling speed, the throttle comes
// back to slow ahead and you aim while she slows (a word says so; the lever goes up again once
// your line's in). Says whether a cast may start.
function easeForCast() {
  const kind = leverKind();
  if (!kind) return false;
  const v = within(kind, boat.lever, fitsAboard()?.holders ? 'line+' : 'line');
  if (v !== boat.lever) {
    changeLever(v);
    hud.flash(`Throttle eased back to ${leverWords(kind, v)} for the cast. ${scheme() === 'touch' ? 'The lever' : K('throttleUp')} opens it up again (to trolling speed while your line’s out).`, t, 4);
  }
  return true;
}

/* ---------------- the engine room (see engine.js) ---------------- */

// How much of starting and stopping you do (Settings → Controls → Engine start-up).
const startMode = () => settings.controls.start;
// The engine room of the boat whose helm you're at (her engine runs only while you're there).
const engineHere = () => {
  const k = leverKind();
  return k && boat.motor ? engines[k] || null : null;
};
const fuelOf = (kind) => (ELEC[kind] ? elecLevel(tanks(), kind) : isPetrol(kind) ? fuelLevel(tanks(), kind) : 99);
let helmKind = null, engineSay = '', engineSayUntil = 0, offWordT = 0, hotBeepT = 0, trimWordT = 0, trimming = false, legWordT = 0;
const helmSay = (text, secs = 2.6, flash = true) => {
  engineSay = text;
  engineSayUntil = t + 6;
  if (flash) hud.flash(text, t, secs);
};

// Something happened in the engine room: heard, felt and (where it matters) said.
function engineEvent(e, E, kind) {
  const P = ENGINES[kind], diesel = !!P.diesel;
  if (e && typeof e === 'object') {
    // The assisted start, one step at a time.
    if (e.step === 'neutral') changeLever(0);
    const words = { battery: 'Battery switch on', cord: 'Kill cord clipped on', neutral: 'Into neutral', key: 'Key on', glow: 'Warming the glow plugs', start: P.starter === 'pull' ? 'Pulling the cord' : P.electric ? 'Switching on' : 'Starting' };
    if (e.ok === false && e.why) helmSay(e.why);
    else if (words[e.step]) helmSay(`${words[e.step]}…`, 1.2, false);
    return;
  }
  switch (e) {
    case 'switch':
      audio.tick?.(0.5);
      haptics.pulse('switch');
      break;
    case 'selftest':
      audio.beep?.();
      break;
    case 'glow':
      audio.tick?.(0.4);
      break;
    case 'glowed':
      audio.beep?.();
      helmSay('The glow lamp goes out: start her now.', 2.4, startMode() === 'full');
      break;
    case 'pull':
      audio.oar?.(0, 0.8);
      haptics.pulse({ strong: 0.5, weak: 0.35, ms: 320, shape: 'swell' });
      break;
    case 'catch':
      // (An electric wakes with a beep, and stays silent until the throttle's opened.)
      if (P.electric) {
        audio.beep?.();
        haptics.pulse('switch');
        if (startMode() !== 'go') helmSay('The motor’s on: silent until you open the throttle.', 2, false);
        break;
      }
      audio.knock?.(diesel ? 0.5 : 0.35);
      haptics.pulse('catch');
      if (startMode() !== 'go') helmSay(P.engines > 1 && !E.engines.every((x) => x.run) ? 'One running…' : 'She’s running.', 1.6, false);
      if (startMode() === 'full') teach('engineRunning', `She’s running: water from the telltale says the cooling’s working. Into gear gently, then trim the leg out a little (${scheme() === 'pad' ? 'RB' : K('trimUp')}) once she’s up and flying.`, 7);
      break;
    case 'stop':
      audio.knock?.(0.2);
      haptics.pulse('stall', 0.5);
      break;
    case 'cordStop':
      helmSay('The kill cord is off: the engine stops.');
      break;
    case 'stall':
      haptics.pulse('stall');
      break;
    case 'dry':
      helmSay('She turns over but won’t catch: the tank is dry.');
      break;
    case 'click':
    case 'flat':
      haptics.pulse('switch');
      audio.tick?.(0.7);
      flatBattery(kind);
      break;
    case 'hot':
      haptics.pulse('warn');
      helmSay(P.cooling === 'telltale' ? 'Overheat alarm! No water through the engine: trim the leg down into the water.' : 'Overheat alarm! Ease off and let her cool.', 4);
      break;
    case 'cool':
      helmSay('The alarm stops: water’s coming through again.');
      break;
    case 'refuse':
      audio.tick?.(0.3);
      break;
    default:
  }
}

// A flat battery is never the end of a trip: an outboard has its emergency starter rope, the
// diesels a second battery to switch over to.
let flatAsked = 0;
function flatBattery(kind) {
  const E = engines[kind], P = ENGINES[kind];
  if (t < flatAsked + 4 || !$('confirm').hidden) return;
  flatAsked = t;
  // (An electric outboard's battery is what drives her: flat, the oars, or a tow.)
  if (P.electric) {
    helmSay('Its battery is flat: it charges at a jetty or a quay, and overnight. The oars for now, or a tow.', 4);
    return;
  }
  const inboard = P.drive === 'inboard';
  ask('The battery is flat', inboard
    ? 'The starter only clicks: the engine battery is flat. The house battery will turn her over: switch across, start her, and the engines will charge both again.'
    : 'The starter only clicks: the battery is flat. Under the cowling there’s an emergency starter rope: wind it round the flywheel and pull. Once she’s running, she charges the battery again.', [
    { text: 'Not now', cls: 'quiet' },
    {
      text: inboard ? 'Switch to the house battery' : 'Pull the emergency rope',
      run: () => {
        if (inboard) {
          E.charge = Math.max(E.charge, 0.6);
          engineEvent('switch', E, kind);
          helmSay('The house battery is on: try her now.');
        } else {
          for (const x of E.engines) x.run = true;
          engineEvent('pull', E, kind);
          engineEvent('catch', E, kind);
        }
      },
    },
  ]);
}

// Something done at the helm (a switch, the key, the starter): done, or why not.
function engineAct(action, which = null) {
  const k = leverKind(), E = k ? engines[k] : null;
  if (!E || !boat.motor) return;
  const r = engineDo(E, action, { lever: boat.lever, fuel: fuelOf(k) }, which);
  for (const e of r.events) engineEvent(e, E, k);
  if (!r.ok && r.why) helmSay(r.why);
}

// The engine key (U, or L3): the helm panel on the full procedure; on the one-button start, it
// starts her (the same steps, done for you) or stops her.
function engineKey() {
  const k = leverKind(), E = k ? engines[k] : null;
  if (!E) return;
  const mode = startMode();
  if (mode === 'go') {
    hud.flash('She runs whenever you’re at the helm. (Settings → Controls: Engine start-up, for the key and the switches.)', t, 3.5);
    return;
  }
  if (mode === 'full') {
    openHelm();
    return;
  }
  if (engineRunning(E) || engineCranking(E) || E.auto) {
    E.auto = null;
    engineAct('stop');
    helmSay('Engine off.', 1.4);
  } else {
    engineAssist(E, { lever: boat.lever });
    engineSay = '';
  }
}

const helmUI = new HelmUI($('helm'), {
  act: (a, w) => { if (modal === 'helm') engineAct(a, w); },
  assist: () => {
    const E = engineHere();
    if (E && modal === 'helm') engineAssist(E, { lever: boat.lever });
  },
  trim: (d) => {
    const E = engineHere();
    if (!E || modal !== 'helm') return;
    // (A press: a couple of degrees of trim, or most of the way up or down in the tilt range.)
    const why = trimBy(E, d, E.trim >= TRIM.max || ENGINES[E.kind].trim === 'tilt' ? 1.2 : 0.35, boat.forwardSpeed);
    audio.tick?.(0.3);
    if (why === 'fast') helmSay('Slow down to tilt her right up: under way the trim stops at the top of its range.');
  },
  close: () => closeHelm(),
});
function openHelm() {
  const k = leverKind();
  if (modal || !k || !engines[k]) return;
  helmUI.open(k, BOATS[k].hull.name || cap(k));
  modal = 'helm';
  audio.page?.();
  teach('helmPanel', 'The helm: battery on, kill cord on, neutral, then the key. Assisted start does it all for you. B or Esc closes it.', 9);
}
function closeHelm() {
  if (!helmUI.isOpen) return;
  helmUI.close();
  if (modal === 'helm') modal = null;
}

/* ---------- the dashboard (see dashboard.js and dashcontrol.js) ---------- */
// In first person at the helm of a boat with a dashboard (the RIB, the centre console), her
// switches, key, throttle and trim rocker are worked where they are, and her gauges and screen
// show the engine room as it is. The helm panel does the same from anywhere (U in third person,
// or Settings → Controls: Helm, the panel).
let dashTrim = 0, dashHorn = 0, dashKeyWas = false, keySelftest = 0, trimDirNow = 0, dashEase = 0, dashLean = 0;
const _dashAt = new THREE.Vector3();
const DASH_PITCH = 0.95;
function dashHere() {
  if (!started || modal || onFoot || cabinIn || !boat.dash || rig.mode !== 'eye' || settings.controls.helm === 'panel') return null;
  if (boat.deck && !boat.atHelm) return null;
  return boat.dash;
}
const dashCtl = new DashControl({ canvas: renderer.domElement, camera, input, hooks: {
  dash: () => dashHere(),
  act: (c, phase) => dashAct(c, phase),
  lever: (n) => {
    for (let i = 0; i < Math.abs(n); i++) stepLever(Math.sign(n));
    audio.tick?.(0.25);
  },
  state: (c) => dashWords(c),
} });
function dashAct(c, phase) {
  const down = phase === 'down';
  switch (c.base) {
    case 'battery':
    case 'cord':
    case 'glow':
      if (down) {
        engineAct(c.base);
        audio.tick?.(0.5);
        haptics.pulse?.(0.15, 0.06);
      }
      return;
    case 'key':
      if (down) dashKey(c.which);
      return;
    case 'lights':
      if (down) {
        boat.navLights = !boat.navLights;
        audio.tick?.(0.4);
      }
      return;
    case 'horn':
      dashHorn = down ? 1 : 0;
      if (down) audio.horn?.(0.9);
      return;
    case 'screen':
      if (down) {
        toggleFinder();
        audio.tick?.(0.3);
      }
      return;
    case 'trimUp':
      dashTrim = down ? 1 : 0;
      return;
    case 'trimDown':
      dashTrim = down ? -1 : 0;
      return;
    case 'troll':
      if (down) trollDeploy();
      return;
    case 'lock':
      if (down) trollLock();
      return;
    default:
  }
}
// The key: on the full procedure, on (the gauges wake and test their lamps), then turned again to
// start, and once she runs, off; otherwise the one-button start (or a word, if she runs herself).
function dashKey(which) {
  const E = engineHere();
  if (!E) return;
  const step = keyStep(E, which, startMode());
  if (step === 'go' || step === 'assist' || (step === 'stop' && startMode() === 'simple')) return engineKey();
  audio.tick?.(0.5);
  engineAct(step, which);
}
function dashWords(c) {
  const E = engineHere();
  if (!E) return '';
  const on = (b) => (b ? 'on' : 'off'), mode = startMode();
  switch (c.base) {
    case 'battery': return on(E.battery);
    case 'cord': return E.cord ? 'clipped on' : 'off: she won’t start';
    case 'key': {
      if (mode === 'go') return 'she runs whenever you’re at the helm';
      const e = c.which == null ? null : E.engines[c.which];
      const run = e ? e.run : engineRunning(E), crank = e ? e.crank > 0 : engineCranking(E);
      if (mode === 'simple') return run ? 'running: press to stop' : crank || E.auto ? 'starting…' : 'press to start';
      return run ? 'running: turn off to stop' : crank ? 'starting…' : E.key ? 'on: turn again to start' : 'off';
    }
    case 'glow': return E.glowing > 0 ? 'warming' : E.glow >= 1 ? 'ready' : 'cold';
    case 'lights': return on(boat.navLights);
    case 'horn': return 'press to sound';
    case 'screen': return finder.visible ? 'fish finder: tap for the chart' : 'chart: tap for the fish finder';
    case 'throttle': return `${leverWords(leverKind(), boat.lever)} · drag it, or scroll`;
    case 'troll': {
      const M = boat.troll;
      return !M ? 'none fitted' : M.deployed ? `down · ${M.depthId} · battery ${Math.round((tanks().troll[boat.kind] ?? 1) * 100)}%` : M.want ? 'going down…' : !M.mech.stowed ? 'stowing…' : M.powered || startMode() !== 'full' ? 'stowed · press to deploy' : 'stowed · deployed by hand at the bow';
    }
    case 'lock': {
      const M = boat.troll;
      return M?.mode === 'lock' ? `holding · ${M.off.toFixed(1)} m off` : M?.mode === 'heading' ? 'holding a heading' : M?.deployed ? 'press to hold her here' : 'lower the motor first';
    }
    case 'trimUp':
    case 'trimDown': {
      const a = boat.trimAuto ? boat.legAngle || 0 : E.trim;
      return a > TRIM.max ? (a >= TRIM.out ? 'leg up, clear of the water' : 'tilted for the shallows') : `trim ${Math.round(a)}°${boat.trimAuto ? ' (she trims herself)' : ''}`;
    }
    default: return '';
  }
}
// What the dashboard shows: the engine room and the boat as they are.
function dashState() {
  const k = leverKind(), E = k ? engines[k] : null, P = E && ENGINES[k];
  if (!E || !P) return null;
  if (E.key && !dashKeyWas) keySelftest = 1.4;
  dashKeyWas = E.key;
  const run = engineRunning(E), cap = TANKS[k] || 1;
  const T = state.track || [], P0 = boat.pos;
  return {
    powered: E.battery || !P.battery, battery: E.battery, key: E.key || P.starter !== 'key', cord: E.cord, hasCord: P.cord,
    glow: E.glowing > 0, glowReady: E.glow >= 1, crank: E.engines.map((e) => e.crank > 0), running: run, rpm: E.engines.map((e) => e.rpm),
    knots: Math.abs(boat.forwardSpeed || 0) * 1.9438, fuel: ELEC[k] ? fuelOf(k) : isPetrol(k) ? clamp(fuelOf(k) / cap, 0, 1) : 1,
    volts: 11.3 + E.charge * 1.5 + (run ? 1.5 : 0), temp: E.temp,
    trim: boat.trimAuto ? boat.legAngle || 0 : E.trim, trimDir: trimDirNow, lever: positionOf(boat.kind, boat.lever || 0),
    lights: !!boat.navLights, horn: dashHorn > 0, selftest: keySelftest, night: env.night,
    heading: boat.heading, depth: habitat.depth(P0.x, P0.z), track: T.slice(-60).map((p) => [p[0] - P0.x, p[1] - P0.z]),
    page: finder.visible ? 'sonar' : 'chart', sonar: finder.canvas,
    troll: boat.troll ? { fitted: true, gps: boat.troll.gps, down: boat.troll.deployed, lock: boat.troll.mode === 'lock' || boat.troll.mode === 'heading' } : null,
  };
}
// Once a frame: the dashboard of the boat you're in, and working it.
function updateDash(dt) {
  keySelftest = Math.max(0, keySelftest - dt);
  const tip = dashCtl.update();
  const el = $('dash-tip');
  if (el) {
    const text = tip ? `${tip.name}${tip.state ? ` · ${tip.state}` : ''}` : '';
    if (el.textContent !== text) el.textContent = text;
    el.hidden = !text || hudOff;
  }
  if (dashCtl.focused && !dashHere()) dashCtl.focus(false);
  // (Looking down at the dashboard: the eyes ease onto it for a moment, then they're yours.)
  if (dashEase > 0 && dashCtl.focused) {
    dashEase -= dt;
    const v = rig.views.eye, k = 1 - Math.exp(-7 * dt);
    v.yaw += wrapAngle(boat.heading - v.yaw) * k;
    v.pitch += (DASH_PITCH - v.pitch) * k;
  }
  if (onFoot || !boat.dash) return;
  const S = dashState();
  if (!S) return;
  // (The one-button start, guided: the ring goes to each step as it's done, then to the key.)
  const E = engineHere();
  boat.dash.guide = startMode() === 'simple' && E && !engineRunning(E) ? (E.auto?.steps?.[0] && boat.dash.controls.has(E.auto.steps[0]) ? E.auto.steps[0] : boat.dash.controls.has('key') ? 'key' : 'key0') : null;
  boat.dash.update(dt, S, t);
  // (The navigation lights draw on the battery with the engine stopped.)
  if (boat.navLights && E && !engineRunning(E) && S.powered) E.charge = Math.max(0, E.charge - dt * 0.0004);
}
/* ---------- work on the water: contracts (see contracts.js) ---------- */
// Posted on Willowhaven's notice board, chosen from the world as it is today; done out there; paid
// back at the board (a delivery, on arrival). One job's next mark has a marker; all are on the map.
let catchShot = false, jobT = 0, jobDt = 0, jobBumps = 0, jobBumpHooked = null;
// What the people and freight of your jobs weigh in each boat (see Con.aboardKg): into her payload,
// so a boat full of people is heavier, sits lower and is slower.
function jobWeight() {
  for (const k of KINDS) {
    const kg = Con.aboardKg(state.contracts, k) + Story.storyKg(state.story, k);
    if ((BOATS[k]._jobKg || 0) === kg) continue;
    BOATS[k]._jobKg = kg;
    BOATS[k].setLoads(loadsOf(k));
  }
  // (And the charters' people, sat in the boat they're aboard: see passengers.js.)
  const people = (a) => (a.obj.kind === 'charter' && a.progress.aboard ? a.obj.pax : a.obj.kind === 'pickup' && a.obj.what === 'person' && a.progress.picked ? 1 : 0);
  const aboard = state.contracts.active.filter((a) => !a.ready && people(a) && BOATS[a.progress.boat]);
  // (Wenna, for the story's last scene, in the boat she's in.)
  const wenna = !Story.finished(state.story) && state.story.wenna && BOATS[state.story.wenna] ? state.story.wenna : null;
  const kind = aboard[0]?.progress.boat || wenna;
  const groups = aboard.filter((a) => a.progress.boat === kind).map((a) => ({ id: a.id, n: people(a), divers: !!a.obj.divers }));
  if (wenna && wenna === kind) groups.unshift({ id: 'wenna', n: 1, folk: 'wenna' });
  passengers.set(kind ? BOATS[kind] : null, groups);
  syncStrays();
  // (And what the radio's calls sent you out to, waiting on the water.)
  pickups.sync(state.contracts.active.filter((a) => a.obj.kind === 'pickup' && !a.progress.picked).map((a) => ({ id: a.id, what: a.obj.what, x: a.obj.at.x, z: a.obj.at.z })));
}
const passengers = new Passengers();
const pickups = new PickupView(scene);
// The boats the radio's tow jobs send you to (one for each, a real hull on the water: towStep pulls
// her like any boat), with nobody at her helm and her engine dead. Not one of your fleet: never
// saved as a boat, never stepped into; she lies where you left her (kept in the job's progress).
const strays = new Map(); // job id -> Boat
const strayCache = {};
function syncStrays() {
  const want = new Map(state.contracts.active.filter((a) => a.obj.kind === 'tow' && !a.ready).map((a) => [a.id, a]));
  for (const [id, b] of strays) {
    if (want.has(id)) continue;
    if (tow && tow.towed === b) letGoTow(true);
    b.group.visible = false;
    strays.delete(id);
  }
  for (const [id, a] of want) {
    if (strays.has(id)) continue;
    const k = `${a.obj.boat}:${a.obj.name}`;
    const b = (strayCache[k] ||= new Boat(scene, { kind: a.obj.boat, look: { name: a.obj.name, paint: '#efe9dc', stripe: '#7a2430', bottom: '#3a4a5a' } }));
    b.setRower(false);
    const p = a.progress.at || a.obj.at;
    b.place(p.x, p.z, b.heading || 0);
    b.group.visible = true;
    strays.set(id, b);
  }
}
// (A stray within reach of you, slow, for the mooring prompt.)
function strayNear(reach = 4.5) {
  let best = null;
  for (const b of strays.values()) {
    const d = Math.hypot(b.pos.x - boat.pos.x, b.pos.z - boat.pos.z);
    if (d < reach && b.speed < 1.2) { reach = d; best = b; }
  }
  return best;
}

// The harbour office on the radio, now and then: someone to pick up, a buoy adrift (see
// contracts.js callDue/callFor). By day, afloat, in fair weather, with room for another job; said
// yes to, it's on your list (and marked); said no to, nothing's lost.
let callT = 0;
function updateCalls(dt) {
  if ((callT -= dt) > 0) return;
  callT = 5;
  const C = state.contracts;
  // (Not while the first trip's guide is running: one thing at a time for someone new; nor with
  // Wenna aboard for the story's last scene.)
  if (onFoot || driving || dive || modal || state.guide?.on || state.story?.wenna || together.guestSlot >= 0 || clock.hour < 7.5 || clock.hour > 19) return;
  // (Nor with a line out or a fish on, another question open, a placement or the dashboard in
  // hand, or under way: it waits for a quiet moment.)
  if (fishing.busy || !$('confirm').hidden || placement.isOn || dashCtl.focused || boat.speed > 2.5) return;
  if (Math.max(weather.storm, conditions.sea.storm) > 0.2 || !Con.callDue(C, clock.abs)) return;
  const spot = callSpot();
  const o = spot && Con.callFor(C, { ...jobWorld(), callSpot: spot });
  Con.callMade(C, clock.abs);
  if (!o) return;
  audio.chime?.();
  ask(o.cat === 'rescue' ? 'The harbour office, on the radio' : o.title, `${o.story} (${o.goal}: pays ${money(o.pay)}.)`, [
    { text: 'Not now', cls: 'quiet', run: () => { hud.toast('“No bother: someone else will go.”', 4); save(); } },
    { text: 'On my way', run: () => {
      if (Con.acceptCall(C, o, t)) hud.toast(`${o.title}: it’s marked, and on your map.`, 5);
      jobWeight();
      save();
    } },
  ]);
}
// Somewhere out on the water a few hundred metres off (deep enough, at home), in words.
function callSpot() {
  const P = boat.pos;
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2, d = 220 + Math.random() * 480;
    const x = P.x + Math.sin(a) * d, z = P.z + Math.cos(a) * d;
    if (z > 2600 || solidHeight(x, z) > -2.5 || solidHeight(x + 8, z) > -2 || solidHeight(x, z + 8) > -2) continue;
    const near = placeName(x, z) || PLACES.find((p) => !p.area && Math.hypot(p.x - x, p.z - z) < 160)?.name;
    const H = HARBOUR_OFFICE, km = Math.round(Math.hypot(x - H.x, z - H.z) / 100) / 10;
    return { x, z, where: near ? `off ${near}` : `${km} km ${compass(bearingOf(x - H.x, z - H.z))} of the harbour` };
  }
  return null;
}
// The water points the Trust's surveys and the Sailing Club's course use (open water in the bay).
const JOB_WATER = { a: { x: 60, z: 140 }, b: { x: -20, z: 230 }, c: { x: 150, z: 200 }, d: { x: -60, z: 180 }, e: { x: 150, z: 330 }, f: { x: 60, z: 400 } };
const markOf = (k, name) => ({ ...JOB_WATER[k], name });
const placeOf = (id) => {
  const p = PLACES.find((q) => q.id === id);
  return p ? { x: p.x, z: p.z, name: p.name } : null;
};
// The dive sites where the club won't have an anchor down (a charter there holds her on the spot).
const DIVE_RULES = { reef: 'a protected reef', wreck: 'a protected wreck', hound: 'its sea fans are protected' };
const LIFE_NAME = { finwhale: 'Fin whale', minkewhale: 'Minke whale', spermwhale: 'Sperm whale', pilotwhale: 'Pilot whales' };
// The world as the board reads it.
function jobWorld() {
  const H = { x: HARBOUR_OFFICE.x, z: HARBOUR_OFFICE.z };
  const where = (x, z) => `${Math.round(Math.hypot(x - H.x, z - H.z) / 100) / 10} km ${compass(bearingOf(x - H.x, z - H.z))} of the harbour`;
  const busy = whatsAbout(eco).map((a) => ({ id: a.sp.id, name: a.sp.name, where: a.where, at: null, min: a.sp.size[0], max: a.sp.size[1], sea: a.sp.water !== 'fresh' }));
  const whales = sealife.whales.filter((w) => w.sea === 'home').map((w) => ({ kind: w.kind, name: LIFE_NAME[w.kind] || 'Whale', where: where(w.x, w.z), at: { x: w.x, z: w.z, name: LIFE_NAME[w.kind] || 'Whale' } }));
  const near = (x, z, r) => Math.hypot(x - H.x, z - H.z) < r;
  const usable = (k) => usableBoat(state.yard, k, state.day, ownAbs());
  const mo = Math.floor((((clock.abs / 24) % 360) + 360) % 360 / 30);
  return {
    day: state.day, region: 'home', busy, whales,
    // (The boats you can take out today, and the ones there are to hire, for a charter's "take".)
    usable: KINDS.filter(usable), kinds: KINDS.filter((k) => usable(k) || BOAT_PRICES[k]),
    diveSites: PLACES.filter((p) => p.dive).map((p) => ({ id: p.id, name: p.name, x: p.x, z: p.z, noAnchor: DIVE_RULES[p.id] || null })),
    // (What's left to find at each dive site, for the Trust's surveys.)
    diveUnfound: PLACES.filter((p) => p.dive && SITE_DETAILS[p.id]).map((p) => {
      const got = state.dive.sites[p.id]?.found || [];
      return { id: p.id, name: p.name, x: p.x, z: p.z, deep: p.id === 'hound' || p.id === 'sands', left: SITE_DETAILS[p.id].filter((d) => !got.includes(d.id)).length };
    }),
    dolphins: sealife.pods.some((p) => p.sea === 'home' && p.bow && near(p.x, p.z, 1600)),
    birds: world.flocks.length > 0 || (clock.hour > 5 && clock.hour < 8.5) || (clock.hour > 18 && clock.hour < 21),
    // (A gale today keeps the deliveries and the racing off the board, but for the one that has to
    // get there before it; the crossing wants tomorrow clear as well.)
    // (The gales and the time to check them against both from the world's clock: the host's,
    // playing together, so a "before the gale" job neither lapses at once nor never.)
    storm: weather.storm > 0.25 || !!galeFor(clock.day) || !!(galeFor(clock.day - 1) && clock.abs < galeFor(clock.day - 1).end),
    forecastStorm: !!galeFor(clock.day) || !!galeFor(clock.day + 1), wind: conditions.wind.speed, abs: clock.abs,
    galeAt: galeFor(clock.day) && clock.abs < galeFor(clock.day).start ? galeFor(clock.day).start : null,
    galeWords: galeFor(clock.day) ? formatClock(galeFor(clock.day).start % 24) : '',
    summer: mo >= 4 && mo <= 7, canCross: usable('cruiser') || usable('sail'), ownsSail: usable('sail'), beenSouth: !!state.tips.brasa,
    places: { quay: placeOf('quay'), puerto: placeOf('puerto'), stream: placeOf('stream'), puffin: placeOf('puffin'), landing: placeOf('landing'), light: placeOf('light'), hound: placeOf('hound'), reef: placeOf('reef'),
      // (The nearest rocky shore with pools, for the Trust's rockpool work.)
      pools: POOL_SITES[0] ? { x: POOL_SITES[0].x, z: POOL_SITES[0].z, name: POOL_SITES[0].name } : null, visitors: { x: (VISITOR_FINGERS[0].x0 + VISITOR_FINGERS[0].x1) / 2, z: (VISITOR_FINGERS[0].z0 + VISITOR_FINGERS[0].z1) / 2, name: 'the visitors’ pontoon' } },
    surveyLines: [{ name: 'the bay mouth', marks: [markOf('d', 'mark 1'), markOf('b', 'mark 2'), markOf('a', 'mark 3')] }, { name: 'off the bay', marks: [markOf('c', 'mark 1'), markOf('e', 'mark 2'), markOf('f', 'mark 3')] }],
    tempMarks: [markOf('a', 'buoy A'), markOf('e', 'buoy B'), markOf('f', 'buoy C'), markOf('b', 'buoy D')],
    courses: [{ name: 'the bay', marks: [markOf('a', 'mark 1'), markOf('c', 'mark 2'), markOf('b', 'mark 3'), markOf('d', 'mark 4')], minutes: 8 }],
  };
}
// Jobs just finished: a word, and a delivery paid there and then.
function jobsDone(list) {
  for (const a of list || []) {
    if (a.onSpot) payJob(a.id, true);
    else {
      hud.toast(`Job done: ${a.title}. Back to the notice board at Willowhaven to be paid.`, 6);
      audio.chime?.();
    }
  }
  if (list?.length) save();
}
function payJob(id, onSpot = false) {
  const was = Con.career(state.contracts).rank;
  const job = state.contracts.active.find((a) => a.id === id);
  const r = Con.claim(state.contracts, id, state.day, { imaging: !!job?.progress?.imaging || !!fitsAboard()?.sonar || !!fitEffect(state.yard, boat.kind)?.sonar });
  if (!r) return false;
  const now = Con.career(state.contracts).rank;
  // (A step up: a new kind of work on the board from tomorrow.)
  if (now !== was) setTimeout(() => hud.toast(`You’re a ${now.name} now: ${now.says}. Tomorrow’s board will have the work for it.`, 8), 6500);
  earnIn(state, r.pay, `${r.contract.title} (${Con.GIVERS[r.contract.giver]})`);
  const rough = r.contract.obj.kind === 'charter' && r.pay < r.contract.pay ? ' A rough trip in an open boat: they didn’t tip.' : '';
  hud.toast(`${onSpot ? `${r.contract.title}: ${r.contract.cat === 'rescue' ? 'safely in' : 'delivered'}. ` : ''}Paid ${money(r.pay)} for ${r.contract.title.toLowerCase()}.${rough}${r.rep ? ` ${Con.GIVERS[r.contract.giver].split(',')[0]} will remember it.` : ''}`, 6);
  audio.coins?.();
  save();
  return true;
}
function renderJobs() {
  const el = $('board-work');
  if (!el) return;
  Con.prune(state.contracts, state.day);
  renderWork(el, {
    offers: Con.offers(state.contracts, jobWorld()), active: state.contracts.active, money, career: Con.career(state.contracts), done: state.contracts.count,
    payOf: (a) => Con.payFor(a, { imaging: !!a.progress?.imaging || !!fitEffect(state.yard, boat.kind)?.sonar }),
    hooks: {
      take: (id) => {
        const r = Con.accept(state.contracts, id, t);
        if (r.why) hud.flash(r.why, t, 2.6);
        else hud.toast(`Taken: ${r.contract.title}. It’s on your map, and in the journal (Memories).`, 5);
        save();
        renderJobs();
      },
      drop: (id) => ask('Give it up?', 'Nothing’s lost but the job: you can always take another.', [
        { text: 'Keep it', cls: 'quiet', run: () => {} },
        { text: 'Give it up', run: () => { Con.abandon(state.contracts, id); jobWeight(); save(); renderJobs(); } },
      ]),
      claim: (id) => {
        payJob(id);
        renderJobs();
      },
    },
  });
}
// Twice a second: what you're doing out there, for the jobs you've taken.
function updateJobs(dt) {
  if (!state.contracts.active.length) return;
  if (jobBumpHooked !== boat) {
    if (jobBumpHooked) jobBumpHooked.onBump = jobBumpHooked._jobBumpWas || null;
    boat._jobBumpWas = boat.onBump;
    boat.onBump = (impact) => {
      boat._jobBumpWas?.(impact);
      if (impact > 0.4) jobBumps++;
    };
    jobBumpHooked = boat;
  }
  jobT -= dt;
  jobDt += dt;
  if (jobT > 0) return;
  jobT = 0.5;
  const step = Math.min(2, jobDt);
  jobDt = 0;
  const P = player().pos, afloat = !onFoot && !driving && !dive;
  // A whale at the surface just now, and birds working, how far off.
  let whale = null, frenzy = null;
  for (const w of sealife.whales) if (w.state === 'breathe' && w.y > -3) whale = Math.min(whale ?? Infinity, Math.hypot(w.x - P.x, w.z - P.z));
  for (const f of world.flocks) if (f.t >= 1) frenzy = Math.min(frenzy ?? Infinity, Math.hypot(f.x - P.x, f.z - P.z));
  // A place you're at and stopped (for a delivery).
  let at = null;
  if (afloat ? boat.speed < 0.8 : true) for (const id of ['quay', 'puerto', 'puffin', 'landing']) {
    const p = PLACES.find((q) => q.id === id);
    if (p && Math.hypot(P.x - p.x, P.z - p.z) < 40) at = id;
  }
  // Home: afloat and stopped in Willowhaven's harbour (for charters' passengers and freight).
  const haven = PLACES.find((q) => q.id === 'haven');
  const home = afloat && boat.speed < 0.8 && Math.hypot(P.x - haven.x, P.z - haven.z) < 90;
  const me = together.active ? together.id : 'me';
  const strayInfo = {};
  for (const [id, b] of strays) {
    const a = state.contracts.active.find((c) => c.id === id);
    if (a) a.progress.at = { x: Math.round(b.pos.x * 10) / 10, z: Math.round(b.pos.z * 10) / 10 };
    strayInfo[id] = { towed: !!tow && tow.towed === b, home: Math.hypot(b.pos.x - haven.x, b.pos.z - haven.z) < 90 && b.speed < 1 };
  }
  const tied = afloat && boat.tie ? (VISITOR_FINGERS.includes(PIERS[boat.tie.pier]) ? 'visitors' : 'other') : null;
  const r = Con.tick(state.contracts, {
    x: P.x, z: P.z, now: t, abs: clock.abs, night: env.night > 0.5, sonar: afloat && finder.visible,
    sailing: afloat && !!boat.sailUp && !motorRunning(), whale, frenzy, at, tied, bumps: afloat ? jobBumps : 0,
    home, boat: afloat ? boat.kind : null, dt: step, speed: afloat ? boat.speed : 0, anchored: afloat && !!boat.anchored,
    strays: strayInfo, sea: afloat ? waveHeightHere(P.x, P.z) : null, bow: afloat && sealife.pods.some((p) => p.mode === 'bow' && (p.owner == null || p.owner === me)),
  });
  jobBumps = 0;
  for (const a of r.boarded) {
    const o = a.obj;
    hud.toast(o.kind === 'charter' ? `${a.title}: ${o.pax} aboard${o.divers ? ' with their kit' : ''}. ${Con.standing(a)}`
      : o.kind === 'tow' ? `${a.title}: she’s on your line. Gently now: into Willowhaven.`
      : o.kind === 'pickup' ? (o.what === 'person' ? `${a.title}: aboard, cold and grateful. Home to Willowhaven.` : `${a.title}: hauled aboard. Home to Willowhaven with it.`)
        : `${a.title}: loaded, ${o.cargo} kg. She sits lower for it: take her to ${a.where?.name || 'it'}.`, 6);
    audio.chime?.();
  }
  // (A survey run with imaging sonar aboard keeps its bonus, whatever boat you're in to be paid.)
  if (afloat && fitEffect(state.yard, boat.kind)?.sonar) for (const a of state.contracts.active) if (a.cat === 'survey' && !a.ready) a.progress.imaging = true;
  for (const a of r.stepped) {
    hud.toast(`${a.title}: done. ${Con.standing(a)}`, 6);
    audio.chime?.();
  }
  for (const s of r.said) hud.toast(s.text, 6);
  for (const a of r.seen) {
    hud.toast(`${a.title}: ${a.obj.dive ? 'all back aboard, and happy.' : a.obj.fish ? 'that’s their fish.' : 'they saw it, and loved it.'} Home to Willowhaven.`, 6);
    audio.chime?.();
  }
  if (r.boarded.length || r.done.length || r.stepped.length) jobWeight();
  for (const a of r.missed) hud.toast(`${a.title}: too late, the job’s gone. Nothing lost but the job.`, 5);
  if (r.missed.length) {
    jobWeight();
    save();
  }
  for (const a of r.reset) hud.flash(a.obj.kind === 'dock' ? `${a.title}: a bump. Come in again, gently.` : `${a.title}: out of time. Back to the first mark to try again.`, t, 3);
  jobsDone(r.done);
}
// The jobs on the map: each one's next mark.
function jobsOnMap() {
  const out = state.contracts.active.map((a) => ({ a, at: jobAt(a) })).filter((j) => j.at && !j.at.board).map((j) => ({ x: j.at.x, z: j.at.z, name: j.at.name, ready: j.a.ready }));
  const s = storyAt();
  if (s) out.push(s);
  return out;
}
// Where the story wants you next, if it marks it itself (see story.js aim).
function storyAt() {
  const A = Story.aim(state.story);
  if (!A) return null;
  const P = { light: placeOf('light'), puerto: placeOf('puerto'), office: { x: HARBOUR_OFFICE.x, z: HARBOUR_OFFICE.z }, haven: { x: HAVEN.x, z: HAVEN.z }, buoy: WRECK_BUOY }[A];
  return P ? { x: P.x, z: P.z, name: `${Story.STORY_TITLE}: ${Story.todo(state.story)}`, story: true } : null;
}
// (A job's next place, with "home" put where Willowhaven is.)
function jobAt(a) {
  const at = Con.target(a);
  if (!at?.home) return at;
  const h = PLACES.find((q) => q.id === 'haven');
  return { x: h.x, z: h.z, name: at.name };
}
// (For the marker: the first job with somewhere to go.)
function jobTarget() {
  for (const a of state.contracts.active) {
    const at = jobAt(a);
    if (at && !at.board) return at;
  }
  // (Then the story's next place: shorter words for the marker.)
  const s = storyAt();
  return s ? { ...s, name: Story.STORY_TITLE } : null;
}

/* ---------- the trolling motor and Spot-Lock (see trolling.js, trollmount.js) ---------- */
// Each boat with a bow trolling motor (Willowhaven Marine Works fits one; the bass boat has her
// own) carries it on her bow mount, stowed or deployed. The basic and GPS motors are worked by
// hand at the bow (, deploys or stows, / sets the depth: go forward to it on the boats you can walk
// about; in the small boats it's within reach); the high-thrust motor stows, deploys and trims
// itself from its remote or the dashboard, anywhere aboard. On the simpler start-up settings any of
// them can be worked from anywhere. Deployed, the keys work it while the main engine's in neutral,
// and on the GPS motors . holds her on a spot (or, creeping along under its push, on a heading).
let trollPush = 0, trollShortT = 0, trollWas = null, trollBowSaid = 0, trollActOn = false;
const trollMotors = {};
// The boat's trolling motor, as fitted now (a new one when the fitting changes), or none.
function trollOf(b) {
  const e = fitEffect(state.yard, b.kind), tier = canTroll(b.kind) ? e.trollMotor : null;
  if (!tier) {
    if (b.troll) b.troll = null;
    delete trollMotors[b.kind];
    return null;
  }
  const M = trollMotors[b.kind];
  if (!M || M.tier !== tier || M.wh !== (e.trollBank ? 2400 : 1200)) {
    const m = new TrollMotor(tier, { bank: e.trollBank, mount: b.trollMount });
    // (The bass boat's own bow motor starts down, where it's always been; one newly fitted, stowed.)
    if (e.trollStandard && !M) m.down = 1;
    trollMotors[b.kind] = m;
  }
  b.troll = trollMotors[b.kind];
  return b.troll;
}
// Standing by the motor on her bow (walking her deck), within reach of its bracket.
function nearTroll(b = boat) {
  const M = b.trollMount;
  if (!M || !b.deck) return false;
  return Math.hypot(b.deck.x - M.hinge[0], b.deck.z - M.hinge[2]) < 1.5;
}
// Whether it can be worked from where you are (see above).
function trollReach(M) {
  if (M.powered || startMode() !== 'full' || !boat.hull.standing) return true;
  return nearTroll();
}
const trollHow = (M) => (M.powered ? 'from its remote' : nearTroll() || !boat.hull.standing ? 'by hand' : 'by hand (the game walks you to it)');
function trollDeploy() {
  if (onFoot || driving || dive) return;
  const M = trollOf(boat);
  if (!M) return hud.flash(canTroll(boat.kind) ? 'No trolling motor on her: Willowhaven Marine Works fits one on her bow (the GPS model has Spot-Lock).' : `The ${boat.hull.name} won’t take a bow trolling motor.`, t, 3.5);
  const down = !M.want;
  if (!trollReach(M)) return hud.flash(`This motor’s worked by hand at the bow: go forward to it (${K('interact')} leaves the helm to walk the deck) and ${down ? 'swing it down' : 'stow it'} there. (On the Simple start-up setting, it’s done from the helm.)`, t, 4);
  if (down && Math.abs(boat.forwardSpeed) > 1.6) return hud.flash('Slow down first: it only goes down with her barely moving.', t, 2.4);
  const flat = (tanks().troll[boat.kind] ?? 1) <= 0.03;
  if (M.powered && flat) {
    if (!down && (nearTroll() || !boat.hull.standing || startMode() !== 'full')) {
      M.handStow();
      return hud.flash('The trolling battery’s flat, so the actuator won’t stow it: you lift it out and swing it up onto the mount by hand.', t, 3.5);
    }
    return hud.flash(down ? 'The trolling battery’s flat: the actuator can’t deploy it. Charge it at a jetty.' : `The trolling battery’s flat: stow it by hand at the bow.`, t, 3.2);
  }
  M.deploy(down);
  trollPush = 0;
  hud.flash(down
    ? (M.powered ? 'The trolling motor deploys itself: the latch lets go, it swings out over the bow and down, locks, and trims down to depth.' : `You release the latch, slide the motor forward off its ramps and swing it down over the bow until it locks${M.spec.deploy === 'assist' ? ' (the lift-assist taking its weight)' : ''}, then set it to depth.`)
    : (M.powered ? 'The trolling motor stows itself: up out of the water, the lower unit turned, swung up onto its ramps and latched.' : 'You turn the lower unit, lift it out, unlock it and swing it up onto the mount, back onto its ramps, and latch it.'), t, 4);
  teach('trolling', `The trolling motor: quiet, slow, on its own battery (it charges at a jetty and overnight). It pushes only once it’s down, locked and at depth; ${K('trollDepth')} sets the depth (shallow, normal, deep). ${M.gps ? 'Spot-Lock holds her on a spot in deep water, pushing back against the wind and tide; too strong a drift and she drags. ' : ''}Putting the main engine in gear stops it.`, 10);
}
// Its depth: shallow, normal, deep (by hand on its collar, the prop stopped while it's moved; or
// the high-thrust motor's power trim, from anywhere).
function trollDepth() {
  if (onFoot || driving || dive) return;
  const M = trollOf(boat);
  if (!M) return trollDeploy();
  if (!trollReach(M)) return hud.flash(`Its depth’s set by hand on its collar: go forward to it on the bow.`, t, 3);
  const order = ['shallow', 'normal', 'deep'], next = order[(order.indexOf(M.depthId) + 1) % order.length];
  M.setDepth(next);
  const under = { shallow: '30 cm', normal: 'half a metre', deep: '75 cm' }[next];
  hud.flash(`Trolling motor depth: ${next}, the propeller about ${under} down${M.want ? (M.spec.trim === 'powered' ? ' (power trim)' : ' (loosening the collar, sliding the shaft, tightening it again)') : ': it goes down to that when it’s deployed'}.`, t, 3);
}
// Standing by it at the bow: what to do with it.
function trollAtBow() {
  const M = trollOf(boat);
  if (!M) return;
  const opts = [{ text: 'Not now', cls: 'quiet', cancel: true }];
  if (M.want) opts.push({ text: 'Shallower / deeper', cls: 'quiet', run: () => trollDepth() }, { text: 'Stow it', run: () => trollDeploy() });
  else opts.push({ text: 'Deploy it', run: () => trollDeploy() });
  ask('The trolling motor', M.want
    ? `${M.deployed ? `Down and locked, its depth ${M.depthId}.` : 'On its way down.'} Stow it (lifted out, turned, swung up onto its ramps and latched), or set its depth?`
    : `Stowed on its mount, the lower unit lying across its ramps. ${M.powered ? 'It deploys itself' : 'Release the latch, slide it forward and swing it down over the bow until it locks'}?`, opts);
}
function trollLock() {
  if (onFoot || driving || dive) return;
  const M = trollOf(boat);
  if (!M) return trollDeploy();
  if (!M.gps) return hud.flash('This trolling motor has no GPS: the GPS model has Spot-Lock and heading hold.', t, 3);
  if (M.mode === 'lock' || M.mode === 'heading') {
    M.stop();
    trollPush = 0;
    return hud.flash(M.mode === 'lock' ? 'Spot-Lock off.' : 'Hold off: she’s yours again.', t, 2);
  }
  if (boat.anchored || boat.tie) return hud.flash(boat.tie ? 'She’s tied up.' : `The anchor’s down: raise it first (${K('anchor')}) to hold her on the motor instead.`, t, 2.6);
  if (!M.deployed) return hud.flash(M.want ? 'Not yet: it’s still going down. Spot-Lock once it’s locked at depth.' : `Deploy the trolling motor first (${K('trolling')}).`, t, 2.4);
  // (Creeping along under its push: hold this heading. Otherwise: hold this spot.)
  if (Math.abs(trollPush) > 0.05) {
    M.holdHeading(true, boat.heading);
    return hud.flash(`Heading hold: she keeps her bow on ${Math.round((((boat.heading * 180) / Math.PI) % 360 + 360) % 360)}° at this push. ${K('spotlock')} again to let go.`, t, 3);
  }
  M.spotLock(true, boat.pos);
  hud.flash(`Spot-Lock on: she holds here, the motor pushing back against the wind and tide. ${K('spotlock')} again to let go.`, t, 3.4);
}
// What its mechanism did this frame, heard (and the moments said).
function trollHeard(M, ev) {
  for (const e of ev) {
    if (e.type === 'start') {
      if (M.powered && !M.byHand) continue;
      if (e.step === 'latch') audio.trollLatch?.(false);
      else if (e.step === 'slide' || e.step === 'ext') audio.trollSlide?.(e.step === 'ext' ? 0.6 : 0.3);
      else if (e.step === 'pivot') audio.trollSwing?.(M.spec.deploy === 'assist');
      else if (e.step === 'turn') audio.tick?.(0.4);
    } else if (e.type === 'unlatched' && M.powered && !M.byHand) audio.trollLatch?.(false);
    else if (e.type === 'locked' || e.type === 'onRamps') audio.trollLock?.();
    else if (e.type === 'latched') {
      audio.trollLatch?.(true);
      hud.flash('The trolling motor’s stowed and latched.', t, 2);
    } else if (e.type === 'straight') hud.flash(`The trolling motor’s down and locked at depth (${M.depthId}): it’ll push now.`, t, 2.4);
    else if (e.type === 'depth') audio.trollLock?.();
  }
  // (The high-thrust motor's actuator, whining while it works.)
  const act = M.powered && !M.byHand && M.mech.moving;
  if (act !== trollActOn) {
    trollActOn = act;
    audio.trollActuator?.(act);
  }
}
// Once a frame: the motor of the boat you're aboard at work, on its battery (and the others'
// mechanisms finishing what they were doing).
function updateTroll(dt) {
  for (const b of boats) {
    if (b === boat && !onFoot) continue;
    const T = b.troll;
    if (!T) continue;
    if (T.mode !== 'off') T.stop();
    if (T.mech.moving || (T.want ? !T.deployed : !T.mech.stowed)) T.mech.step(dt, { aligned: true });
  }
  if (onFoot || driving || dive) {
    if (trollActOn) audio.trollActuator?.((trollActOn = false));
    audio.trollHum?.(0);
    return;
  }
  const M = trollOf(boat);
  if (!M) return;
  const f = tanks(), k = boat.kind;
  if (f.troll[k] == null) f.troll[k] = 1;
  if (M.mode !== 'off' && (boat.anchored || boat.tie)) {
    M.stop();
    hud.flash(boat.tie ? 'Tied up: the trolling motor stops.' : 'The anchor’s down: Spot-Lock off.', t, 2.4);
  }
  // The bass boat's first notches run her bow motor: it has to be down. (On the simpler start-up
  // settings it goes down by itself; otherwise, a word.)
  const mo = boat.hull.motor, notch = mo?.troll && leverKind() && boat.lever > 0 && boat.lever <= mo.troll;
  if (notch && !M.want) {
    if (startMode() !== 'full') {
      M.deploy(true);
      hud.flash('The bow motor goes down for the electric notches.', t, 2.2);
    } else if (t > trollBowSaid) {
      trollBowSaid = t + 6;
      hud.flash(`The bow motor’s stowed: deploy it (${K('trolling')}) to run on the electric notches.`, t, 3);
    }
  }
  const r = M.step(dt, { boat: { x: boat.pos.x, z: boat.pos.z, vx: boat.vel.x, vz: boat.vel.z, heading: boat.heading, mass: boat._phys?.m || 1000 }, battery: f.troll[k], sea: waveHeightHere(boat.pos.x, boat.pos.z), lever: leverKind() ? boat.lever : 0 });
  f.troll[k] = Math.max(0, f.troll[k] - r.drawn);
  trollHeard(M, r.ev);
  if (r.why === 'gear') {
    trollPush = 0;
    hud.flash('Into gear: the trolling motor stops.', t, 2.2);
  } else if (r.why === 'flat') hud.flash('The trolling motor’s battery is flat: it charges at a jetty, and overnight.', t, 4);
  else if (r.why === 'noPower' && t > trollBowSaid) {
    trollBowSaid = t + 6;
    hud.flash('The trolling battery’s too flat for the actuator: stow it by hand at the bow.', t, 3.4);
  }
  // Spot-Lock losing the fight: said once in a while.
  trollShortT = M.mode === 'lock' && M.short > 0.5 && M.off > 4 ? trollShortT + dt : 0;
  if (trollShortT > 6) {
    trollShortT = -20;
    hud.flash(`Spot-Lock can’t hold her in this: she’s ${Math.round(M.off)} m off her spot and dragging. Anchor if it’s shallow enough, or motor back.`, t, 4.5);
  }
  // (Its hum under the water while it pushes, the lever's electric notches on the bass boat too.)
  const push = Math.max(M.f / M.spec.push, boat.bowNotch && M.deployed ? boat.bowNotch * 0.5 : 0);
  const on = push > 0.05;
  if (on !== trollWas) trollWas = on;
  audio.trollHum?.(push);
}
// A few words for the gauges by the lever.
function trollWords() {
  const M = boat.troll;
  if (!M || onFoot) return '';
  if (!M.deployed) return M.want ? 'trolling motor going down…' : M.mech.stowed ? '' : 'trolling motor stowing…';
  const pc = Math.round((tanks().troll[boat.kind] ?? 1) * 100);
  return M.mode === 'lock' ? `Spot-Lock ${M.off.toFixed(1)} m · ${pc}%` : M.mode === 'heading' ? `heading hold · ${pc}%` : `trolling motor ${pc}%`;
}

function toggleDashFocus() {
  const on = !dashCtl.focused && dashCtl.focus(true);
  if (!on) dashCtl.focus(false);
  dashEase = on ? 0.7 : 0;
  if (on) teach('dash', `The dashboard: ${scheme() === 'pad' ? 'the D-pad moves round it, A works a switch (hold it for the key, the trim and the horn), B looks up again' : 'point and click (hold for the key, the trim rocker and the horn), drag or scroll the throttle; Tab moves round it, Enter works it, Esc looks up again'}.`, 9);
  return on;
}

// Once a frame: the engine of the boat whose helm you're at runs (and stops when you leave it),
// the starter turns her over, the revs follow the throttle, the alarm sounds if she overheats,
// and you trim the leg.
function updateEngine(dt) {
  const k = leverKind(), E = k && boat.motor ? engines[k] : null;
  const mode = startMode();
  // Left the helm: her engine stops (switched off as you go).
  if (helmKind && helmKind !== (E ? k : null)) {
    const L = engines[helmKind];
    if (L && (engineRunning(L) || engineCranking(L) || L.auto)) {
      L.auto = null;
      engineDo(L, 'stop');
    }
    closeHelm();
  }
  helmKind = E ? k : null;
  for (const [kind, B] of Object.entries(BOATS)) if (B.engine) B.trimAuto = mode === 'go' || !ENGINES[kind].trim;
  audio.starter?.(!!E && engineCranking(E) && !ENGINES[k].electric, !!E && !!ENGINES[k].diesel);
  if (!E) {
    trimming && audio.trimWhine?.(false);
    trimming = false;
    return;
  }
  const P = ENGINES[k], fuel = fuelOf(k);
  // Get in and go (and the sailing boat's little outboard, lowered, on the one-button start):
  // running as soon as you take the helm.
  // (Her battery terminal shaken loose (damage.js): the starter only clicks until it's done up.)
  E.loose = !!damages[k]?.wiring?.loose;
  E.drowned = !!BOATS[k]?._drowned;
  if (E.loose && mode === 'go' && !engineRunning(E) && !engineCranking(E) && !looseSaid) {
    looseSaid = true;
    hud.flash('She won’t start: a click, and nothing. The battery terminal’s loose: stopped, look her over and do it up.', t, 5);
  }
  if (!E.loose) looseSaid = false;
  if ((mode === 'go' || (mode === 'simple' && k === 'sail')) && !E.loose && !E.drowned && !engineRunning(E) && !engineCranking(E) && fuel > 0) {
    E.battery = true;
    E.cord = true;
    if (P.starter === 'key') E.key = true;
    E.warm = Math.max(E.warm, 0.6);
    for (const x of E.engines) if (!x.run) { x.crank = 1e-6; x.need = 0.35; }
  }
  const pos = boat.power ? Math.abs(positionOf(k, boat.power)) : 0;
  const opening = clamp((pos - GEAR_IN) / (1 - GEAR_IN), 0, 1);
  // (What her propeller's pitched for, and how well it grips, for the revs under load: see
  // engine.js loadRpm and propBite. A lower pitch lets the engine rev higher off the mark.)
  const spec = boat.motorSpec, hole = spec ? Math.min(0.8, HOLE + 0.4 * ((spec.effort || 1) - 1)) : HOLE;
  const ev = stepEngine(E, dt, { lever: boat.lever, power: boat.power, opening, fuel, wet: boat.intakeWet !== false, speed: boat.forwardSpeed, vd: spec?.vd || 0, hole, bite: boat.propBite ?? 1, inGear: pos > GEAR_IN });
  for (const e of ev) engineEvent(e, E, k);
  if (engineCranking(E)) haptics.hold('crank', P.diesel ? 0.45 : 0.35, 0.3, { buzz: P.diesel ? 5 : 7 });
  // (A bent propeller: a judder through her, the harder she's driven.)
  if (engineRunning(E) && E.dmg > 0.1 && Math.abs(boat.power) > 0.05) haptics.hold('bentProp', 0.08 + 0.3 * E.dmg * Math.abs(boat.power), 0.05, { buzz: 11 });
  // (Her bracket worked loose: the engine shifting on the transom, the harder she's driven.)
  const mt = damages[k]?.mount || 0;
  if (engineRunning(E) && mt > 0.1 && Math.abs(boat.power) > 0.1) haptics.hold('looseMount', 0.06 + 0.3 * mt * Math.abs(boat.power), 0.05, { buzz: 6 });
  // The overheat alarm, beeping while she's hot.
  if (engineRunning(E) && E.temp >= 0.6) {
    hotBeepT -= dt;
    if (hotBeepT <= 0) {
      hotBeepT = 1.4;
      audio.beep?.();
    }
  }
  // Trim: held up or down (the bumpers, or ] and [).
  const dir = modal ? 0 : (input.holding('trimUp') || dashTrim > 0 ? 1 : 0) - (input.holding('trimDown') || dashTrim < 0 ? 1 : 0);
  trimDirNow = dir;
  // (The tilt button's leg on its way up or down, unless the trim switch is held: that takes over.)
  if (dir) E.tiltTo = null;
  const tilting = !dir && stepTilt(E, dt);
  if (dir && P.trim) {
    const why = trimBy(E, dir, dt, boat.forwardSpeed);
    haptics.hold('trim', 0, why ? 0.03 : 0.1);
    if (why === 'fast' && t > trimWordT) {
      trimWordT = t + 4;
      hud.flash('Slow down to tilt her right up: under way the trim stops at the top of its range.', t, 2.6);
    }
    if (!trimming) teach('trim', 'Trim in to get onto the plane, then out a little once she’s flying for her best speed. Too far and the propeller draws air.', 9);
  }
  if (!!(dir || tilting) !== trimming) audio.trimWhine?.(!!(dir || tilting));
  trimming = (!!dir || tilting) && !!P.trim;
  // In gear with the leg tilted right up, the propeller's out of the water and pushes nothing:
  // said once in a while, with how to put it right.
  if (P.trim && engineRunning(E) && boat.lever && (boat.legAngle || 0) >= TRIM.out && t > legWordT) {
    legWordT = t + 6;
    hud.flash(`The leg’s tilted right up: the propeller’s out of the water. Trim it down (${scheme() === 'pad' ? 'LB' : K('trimDown')}, or the rocker on the throttle) to get going.`, t, 3.2);
  }
  // A word when the throttle's pushed with the engine off.
  // (Not when she's stopped for want of fuel or charge: that's said where it runs out.)
  if (!engineRunning(E) && !engineCranking(E) && !E.auto && boat.lever && !boat.dry && fuelOf(k) > 0 && t > offWordT + 4 && mode !== 'go' && !modal) {
    offWordT = t;
    hud.flash(`The engine’s off: ${mode === 'full' ? `${K('motor')} for the helm panel` : `${K('motor')} starts her`}.`, t, 2.4);
  }
  if (t > engineSayUntil) engineSay = '';
  helmUI.update(E, { lever: boat.lever, fuel, gear: boat.lever > 0 ? 'F' : boat.lever < 0 ? 'R' : 'N', message: engineSay });
}

// The gauges beside the throttle lever: the revs, the trim and anything wrong.
function helmGauges() {
  const E = engineHere();
  if (!E) return '';
  const P = ENGINES[E.kind], on = engineRunning(E);
  if (!on && !engineCranking(E)) return `<span class="lv-off">Engine off</span>${waterBit() ? ` · ${waterBit()}` : ''}`;
  const bits = [`<b>${Math.round(rpmOf(E) / 50) * 50}</b> rpm`];
  // (Trimming herself, the angle she's at.)
  const tr = boat.trimAuto ? boat.legAngle || 0 : E.trim;
  if (P.trim) bits.push(tr > TRIM.max ? 'tilted' : `trim ${Math.round(tr)}°${boat.trimAuto && tr <= TRIM.max ? ' (auto)' : ''}`);
  if (E.temp >= 0.6) bits.push('<span class="lv-warn">HOT</span>');
  if (P.engines > 1 && !E.engines.every((x) => x.run)) bits.push('<span class="lv-warn">one engine</span>');
  const nav = plotterNav();
  if (nav) bits.push(nav);
  const tw = trollWords();
  if (tw) bits.push(tw);
  // (A towline from her stern, or her anchor's rode: the pull on it. See lines.js.)
  if (tow?.lead === boat && tow.T > 50) bits.push(`${(tow.peak || 0) > 0.5 ? '<span class="lv-warn">' : ''}tow ${loadWords(tow.T, LINES.towline)}${(tow.peak || 0) > 0.5 ? '</span>' : ''}`);
  // (A RIB's tube gone soft: see damage.js.)
  const tubes = damages[boat.kind]?.tubes;
  if (tubes) {
    let w = -1;
    tubes.forEach((c, i) => { if (c.air < 0.55 && (w < 0 || c.air < tubes[w].air)) w = i; });
    if (w >= 0) bits.push(`<span class="lv-warn">${CHAMBERS[w]} tube ${tubes[w].air < 0.2 ? 'flat' : 'soft'}</span>`);
  }
  // (Water in her: see flooding.js.)
  const wb = waterBit();
  if (wb) bits.push(wb);
  // (Her working parts, as hurt: see damage.js.)
  const DD = damages[boat.kind];
  if (DD?.wiring?.loose) bits.push('<span class="lv-warn">terminal loose</span>');
  if (DD && Math.abs(DD.steer.bend) > 0.01) bits.push(`<span class="lv-warn">pulls to ${DD.steer.bend > 0 ? 'starboard' : 'port'}</span>`);
  // (Whatever judders through her and your hands says so: the bracket from as loose as you feel it,
  // and a propeller bent on the bottom. See updateEngine, where you feel them.)
  if (DD && DD.mount > 0.1) bits.push(`<span class="lv-warn">engine ${DD.mount > 0.3 ? 'loose' : 'a little loose'} on its bracket</span>`);
  if (E.dmg > 0.1) bits.push(`<span class="lv-warn">propeller ${E.dmg > 0.5 ? 'badly bent' : 'bent'}</span>`);
  return bits.join(' · ');
}
// Each frame, the fittings of the boat you're in at work (see shipyard.js): the sonar's imaging
// on the head unit, the deck lights after dark, the chartplotter's track, the radio's chatter,
// and what they all draw on her starting battery with the engine off.
let radioT = 90, batteryWarned = false;
function updateFittings(dt) {
  const e = fitsAboard();
  finder.imaging = !!e?.sonar;
  for (const b of boats) b.setDeckLights?.(!!(e?.lights && b === boat && env.night > 0.35));
  if (!e) return;
  // The chartplotter: a point on your track every fifteen metres or so (kept for the chart).
  if (e.plotter) {
    const T = (state.track ||= []), P = boat.pos, last = T[T.length - 1];
    if (!last || Math.hypot(last[0] - P.x, last[1] - P.z) > 15) {
      T.push([Math.round(P.x), Math.round(P.z)]);
      if (T.length > TRACK_MAX) T.splice(0, T.length - TRACK_MAX);
    }
  }
  // The radio: now and then, out on the water, what the harbour's saying.
  if (e.vhf) {
    radioT -= dt;
    const P = boat.pos, home = Math.min(Math.hypot(P.x - HAVEN.x, P.z - HAVEN.z), Math.hypot(P.x - PUERTO_AT.x, P.z - PUERTO_AT.z));
    if (radioT <= 0 && home > 200 && !modal) {
      radioT = 150 + Math.random() * 120;
      const line = radioLine();
      if (line) {
        hud.toast(`VHF · ${line}`, 7);
        audio.page?.();
      }
    }
  }
  // What they draw, engine off (with the engine running, the alternator keeps up; a house
  // battery takes it all; on Get in and go, nobody's counting).
  const E = engines[boat.kind];
  if (E && !e.house && startMode() !== 'go' && !engineRunning(E)) {
    const amps = (e.sonar && finder.visible ? 1.2 : 0) + (e.plotter ? 1 : 0) + (e.vhf ? 0.5 : 0) + (e.livewell && state.keep.length ? 0.5 : 0) + (e.lights && env.night > 0.35 ? 6 : 0);
    // (A hundred amp-hours, an hour of the game's clock every forty seconds.)
    E.charge = Math.max(0, E.charge - amps * 0.00025 * dt);
    if (amps && E.charge < 0.35 && !batteryWarned) {
      batteryWarned = true;
      hud.toast('The starting battery’s running down: the electronics and lights are on with the engine off. Start her for a while, or fit dual batteries at the Marine Works.', 8);
    }
  }
  if (E && E.charge > 0.6) batteryWarned = false;
}
const TRACK_MAX = 600;
// A line on the radio: birds working, what's about, or the forecast.
function radioLine() {
  const P = boat.pos, south = region === 'south';
  const birds = south ? [] : birdsWorking(world.flocks, state.places);
  const about = whatsAbout(eco, { x: P.x, z: P.z, reach: 600, max: 3, south });
  const picks = [];
  if (birds.length) picks.push(`“${birds[0]}”`);
  if (about.length) picks.push(`“${about[0].sp.name} showing ${about[0].where || 'about'}.”`);
  const sky = weather.rain > 0.6 ? 'Heavy rain' : weather.rain > 0.15 ? 'Light rain' : weather.cloud > 0.7 ? 'Overcast' : weather.cloud > 0.3 ? 'Some cloud' : 'Clear';
  if (!south) picks.push(`Harbour office: ${weatherLines(sky, clock.abs)[0]}`);
  // (Work going: the board at Willowhaven has a job worth the trip; see contracts.js.)
  if (!south) {
    const o = Con.offers(state.contracts, jobWorld())[0];
    if (o) picks.push(`Harbour office: “${Con.GIVERS[o.giver].split(',')[0]} has work on the board at Willowhaven: ${o.title.toLowerCase()}, ${money(o.pay)}.”`);
  }
  return picks.length ? picks[Math.floor(Math.random() * picks.length)] : '';
}

// The chartplotter at the helm: the nearest of your marks, its bearing and how far.
function plotterNav() {
  // (Following a route: the next mark, its course and how far.)
  const F = routeNow;
  if (F && fitsAboard()?.plotter) return `⌖ mark ${F.leg + 1} of ${F.R.pts.length}: ${courseWords(F.course)} ${rangeWords(F.m)}`;
  if (!fitsAboard()?.plotter || !state.pins.length) return '';
  const P = boat.pos;
  let best = null, bd = Infinity;
  for (const pin of state.pins) {
    const d = Math.hypot(pin.x - P.x, pin.z - P.z);
    if (d < bd) { bd = d; best = pin; }
  }
  if (!best) return '';
  const deg = (Math.round((Math.atan2(best.x - P.x, -(best.z - P.z)) * 180) / Math.PI) + 360) % 360;
  return `⌖ ${bd < 1000 ? `${Math.round(bd / 10) * 10} m` : `${(bd / 1000).toFixed(1)} km`} ${String(deg).padStart(3, '0')}°`;
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
    const n = settings.controls.throttle === 'lever' ? 'moves the lever' : 'moves it a notch';
    const how = scheme() === 'touch' ? `the stick up or down (or the lever) ${n}` : scheme() === 'pad' ? `${kbd('L-stick')} up or down ${n}, ${K('neutral')} stops` : `${K('forward')}${K('back')} ${n.replace('moves', 'move')}, ${K('neutral')} stops`;
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
    const n = settings.controls.throttle === 'lever' ? 'the throttle' : 'the throttle a notch';
    const how = scheme() === 'touch' ? `the stick up or down (or the lever) moves ${n}` : scheme() === 'pad' ? `${kbd('L-stick')} up or down moves ${n}, ${K('neutral')} stops` : `${K('forward')}${K('back')} move ${n}, ${K('neutral')} stops`;
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
  // (On the Helped trim, a hand besides yours eases it in the gusts; by hand, it's all yours.)
  boat.sheetHelp = settings.controls.sailTrim === 'helped';
  // Laid over and rounding up into the wind: say so, once a while, and feel her gripe.
  if (boat.overpowered > 0.5 && boat.sailUp) {
    if (t - overWarnT > 25) {
      overWarnT = t;
      hud.flash(state.tips.overpowered ? 'Overpowered: ease the sheet.' : `Overpowered! She’s laid right over and rounding up into the wind. Ease the sheet (${scheme() === 'touch' ? 'the stick down' : scheme() === 'pad' ? 'the stick down' : K('back')}) in the gusts, and she’ll stand up and answer her helm.`, t, state.tips.overpowered ? 2.5 : 6);
      state.tips.overpowered = true;
      haptics.pulse('warn', 0.7);
    }
  }
  const ui = sailUI.hold;
  const want = ui || (Math.abs(raw) > 0.2 ? -raw : 0);
  if (want) {
    boat.sheet = clamp(boat.sheet + want * SAIL.sheetRate * dt * (Math.abs(raw) > 0.2 ? Math.abs(raw) : 1), 0, 1);
    sheetTouched = t;
  } else if (settings.controls.sailTrim === 'helped' && boat.sailing && t - sheetTouched > 2.5) {
    let best = bestSheet(boat.sailing.awa);
    // (Pressed in a gust, laid over: it eases out past its best, spilling it, as a good hand would.)
    best = Math.min(1, best + smoothstep(0.35, 0.6, Math.abs(boat.roll)) * 0.25);
    // (On a windsurf board in a strong wind it eases out past its best, spilling the gusts.)
    if (boat.hull.rig && boat.sailing.pull > 5.5) best = Math.min(1, best + (boat.sailing.pull - 5.5) * 0.09);
    boat.sheet += clamp(best - boat.sheet, -0.25 * dt, 0.25 * dt);
  }
}
let sheetTouched = -10, overWarnT = -99;

const windLines = new WindLines(scene);
const stormFx = new Storm(scene);
hideFromReflection(stormFx.spray);
// A storm coming in: a word when it starts, and now and then a warning for a small boat caught out
// in the open; spray off her bow as she plunges into the seas.
let stormWas = 0, stormWarnT = 0, lastPitch = 0, slamT = 0;
function watchStorm(dt) {
  const st = conditions.sea.storm;
  if (weather.storm > 0.4 && stormWas <= 0.4 && started) {
    hud.toast('A storm is coming in: a gale and big seas outside. The bay and the coves stay calmer, a good place to sit it out.', 8);
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
  const advice = up ? trimAdvice(A, boat.overpowered) : null;
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
  // (Twin engines: the lever the throttle works: 'both', 'port' or 'stbd'.)
  levers: (sel) => { if (started && !modal) selectLevers(sel); },
  stop: () => { if (started && !modal) leverNeutral(true); },
  motor: () => { if (started && !modal) (boat.hull.outboard ? toggleOutboard() : toggleKayakMotor()); },
  tilt: () => tiltOutboards(),
  // (The smooth lever, dragged: right where the finger is, within what's allowed.)
  slideTo: (f) => {
    const kind = leverKind();
    if (!started || modal || !kind) return;
    // (Twin levers apart work notch by notch.)
    if (boat.split) return setLever(Math.round(f));
    let pos = positionAtIndex(kind, f);
    if (boat.tie || (boat.anchored && pos > 0)) return setLever(nearest(kind, valueAt(kind, pos)));
    const capV = levers(kind)[capIndex(kind, leverSituation())].v;
    if (valueAt(kind, pos) > capV) pos = positionOf(kind, capV);
    leverPos(kind);
    if (pos === leverS.pos) return;
    if ((pos === 0) !== (leverS.pos === 0)) haptics.pulse(pos === 0 ? 'detent' : 'gear');
    leverS.pos = pos;
    boat.lever = leverS.v = valueAt(kind, pos);
  },
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
  const smooth = !!kind && settings.controls.throttle === 'lever';
  if (kind && !T) {
    if (smooth) keys = P ? (line ? `${K('throttleUp')} ${K('throttleDown')} a notch` : `${kbd('L-stick')} ↕ throttle · ${K('neutral')} stop`) : `${line ? `${K('throttleUp')}${K('throttleDown')}` : `${K('forward')}${K('back')}`} throttle · ${K('neutral')} stop`;
    else keys = P ? (line ? `${K('throttleUp')} ${K('throttleDown')} a notch` : `${kbd('L-stick')} ↕ a notch · ${K('neutral')} stop`) : `${line ? `${K('throttleUp')}${K('throttleDown')}` : `${K('forward')}${K('back')}`} a notch · ${K('neutral')} stop`;
  }
  // (The trolling motor down and the engine in neutral: the movement keys drive it instead.)
  if (kind && !T && boat.troll?.deployed && boat.troll.mode !== 'lock' && !boat.lever) keys = `${P ? kbd('L-stick') : `${K('forward')}${K('back')}`} trolling motor · ${P ? `${K('throttleUp')} ${K('throttleDown')}` : `${K('throttleUp')}${K('throttleDown')}`} engine`;
  if (kayak && !T) keys += `${keys ? ' · ' : ''}${K('motor')} motor`;
  // (The sailing boat's outboard: its own button raises it again.)
  const outboard = kind === 'sail';
  if (outboard && !T) keys += ` · ${K('outboard')} outboard up`;
  const dead = kind && (kind === 'kayak' ? boat.kflat : boat.trolling ? boat.flat : boat.dry);
  // (An outboard with a leg to tilt: the tilt button, and its key.)
  const EL = kind && boat.motor ? engines[kind] : null, tiltable = !!EL && !!ENGINES[EL.kind]?.trim;
  if (tiltable && !T) keys += `${keys ? ' · ' : ''}${K('tilt')} tilt`;
  // (Twin engines: which lever the throttle works, and with them apart, each one's notch.)
  const twins = twinHelm() ? { sel: leverSel, split: boat.split ? boat.split.map((v) => nearest(kind, v)) : null } : null;
  if (twins && !T) keys += ` · ${P ? kbd('D-pad →') : K('levers')} levers`;
  const S2 = boat.split;
  leverUI.update({
    show: true, kind, smooth: smooth && !S2, index: kind ? (S2 ? nearest(kind, S2[leverSel === 'stbd' ? 1 : 0]) : smooth ? displayIndex(kind, leverPos(kind)) : nearest(kind, boat.lever)) : 0, power: boat.power, cap: kind ? capIndex(kind, sit) : 0, twins,
    words: !kind ? 'paddling' : boat.anchored ? 'at anchor' : dead ? (kind === 'kayak' ? 'battery flat' : 'motor dead') : S2 ? `port ${leverWords(kind, S2[0])} · starboard ${leverWords(kind, S2[1])}` : cap(smooth ? leverPositionWords(leverPos(kind)) : leverWords(kind, boat.lever)),
    title: kind === 'kayak' ? 'Kayak motor' : kayak ? 'Kayak' : outboard ? 'Outboard' : 'Throttle',
    motor: kayak ? (boat.emotorDown ? 'down' : 'up') : outboard ? 'outboard' : null, keys,
    tilt: tiltable ? (tiltedUp(EL) ? 'up' : 'down') : null, twin: tiltable && ENGINES[EL.kind].engines > 1,
    gauges: helmGauges(),
  });
}

/* ---------------- walking about: with a line out, and on deck ---------------- */

// Walking with a line out (L3, or the jog key, while it's out): along the bank or about the deck,
// the line paying out behind you or coming in as you walk towards it. Off again the same way, and
// whenever the line comes in.
let walkLine = false;
function toggleWalkLine() {
  if (!onFoot && !boat.hull.standing) {
    hud.flash('There’s no room to walk about in this boat: fish from where you sit.', t, 2.4);
    return;
  }
  walkLine = !walkLine;
  if (walkLine && !onFoot) boat.setDeck(true);
  hud.flash(walkLine ? `Walking with your line out: ${scheme() === 'pad' ? kbd('L-stick') : MOVE()} to walk, the line pays out as you go · ${scheme() === 'pad' ? 'L3' : K('jog')} to stand and work it again` : 'Standing to fish again: the movement keys work the line', t, 3.4);
}

// Off the helm to walk her deck, or back to it (a boat you stand in: the RIB, the console, the yacht).
function takeHelm(on) {
  if (!boat.hull.standing) return;
  boat.setDeck(!on);
  audio.step?.(false, 0, 'wood');
  if (!on) teach('deck', `Walking the deck: ${scheme() === 'pad' ? kbd('L-stick') : MOVE()} walks you about her. She keeps on as she was (the throttle stays where you left it). Back at the wheel, ${scheme() === 'touch' ? 'the prompt' : K('interact')} takes the helm again.`, 8);
}

// A step on foot, or about the deck, the way the stick points from where the camera looks.
function walkWith(ti, si, dt) {
  const yaw = rig.yaw, fx_ = Math.sin(yaw), fz_ = Math.cos(yaw);
  const wx = fx_ * ti + fz_ * si, wz = fz_ * ti - fx_ * si;
  if (onFoot) {
    // (Slowly with a fish on: following it along the bank, not running.)
    const k = fishing.state === 'reeling' ? 0.45 : 1;
    move.x = wx * k;
    move.z = wz * k;
    return;
  }
  if (!boat.deck) return;
  // Into her own space: across (her right) and ahead.
  const hx = Math.sin(boat.heading), hz = Math.cos(boat.heading);
  const ahead = wx * hx + wz * hz, across = wx * hz - wz * hx;
  const m = Math.min(1, Math.hypot(ahead, across)), sp = (fishing.state === 'reeling' ? 0.6 : 1.3) * dt;
  if (m > 0.05) {
    const went = boat.walkDeck((across / Math.max(m, 1)) * sp * m, (ahead / Math.max(m, 1)) * sp * m, dt);
    deckStepT -= went;
    if (deckStepT <= 0) {
      deckStepT = 0.55;
      audio.step?.(false, 0, 'wood');
    }
  } else boat.walkDeck(0, 0, dt);
}
let deckStepT = 0;

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
  const indoors = driving || !!cabinIn || (modal === 'camp' && camp.house) || modal === 'bench' || sitting?.kind === 'home' || (onFoot && !!insideHaven(P.x, P.z));
  const F = world.camp.firePos;
  let fire = onFoot ? camp.fireLevel * smoothstep(5, 1.5, Math.hypot(P.x - F.x, P.z - F.z)) : 0;
  if (modal === 'camp' && camp.own) fire = Math.max(fire, 0.5);
  if (sitting?.kind === 'chair' || sitting?.kind === 'home') fire = Math.max(fire, 0.55);
  if (onFoot && insideHaven(P.x, P.z) === 'inn') fire = Math.max(fire, sitting?.spot === 'fire' ? 0.7 : 0.3);
  const afloat = !onFoot && !driving;
  const rowing = afloat && !boat.motor && !boat.sailUp && boat.speed > 0.6;
  const spray = afloat ? smoothstep(4, 8, boat.speed) * smoothstep(0.2, 1, waveHeightHere(P.x, P.z)) + weather.storm * 0.4 : 0;
  // (Under a bimini top: shade from the sun, and most of the rain off you.)
  const shade = afloat && fitsAboard()?.bimini ? 1 : 0;
  return {
    hour: clock.hour, south: conditions.region === 'south', height: onFoot ? Math.max(0, walker.pos.y) : 0, warmth: seasonWarmth(clock.abs),
    cloud: weather.cloud, rain: weather.rain * (1 - 0.65 * shade), storm: weather.storm,
    wind: w.speed * (onFoot ? 0.75 : 1), sun: (1 - env.night) * (1 - 0.85 * weather.cloud) * (1 - weather.rain) * (1 - 0.75 * shade),
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
  // (Only in the sea you're in: Las Brasas and home are a crossing of the open sea apart.)
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
  // (Out on the open sea, crossing: nowhere to go but on, or back.)
  if (state.crossing || inOcean(player().pos.x, player().pos.z)) return { camp: false, boat: false, camps: false, own: false, haven: false, note: 'Out on the open sea: the only way from here is on across, or back.' };
  const atCamp = onFoot && nearCampSpot();
  const box = regionBox(10);
  // (At Las Brasas, home's places are across the open sea: only the crossing takes you there.)
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

/* ---------------- the fast passage: Willow Bay and Las Brasas ---------------- */

// The crossing (see crossing.js and above) made without taking the helm: a few lines of the log
// while the hours go by (the same hours the crossing takes at the helm, and for the yacht the same
// fuel), and she comes in off Puerto Brasa (or, coming home, to her berth at Willowhaven), ready
// to go in. Your gear and creel come too; the other boats and the car stay where you left them.
const PASSAGE_LOG_MOTOR = {
  south: [
    'Morning · You clear Gannet Light and settle her at her ocean speed, the twin diesels droning steadily. By noon the coast is a grey line astern.',
    'Afternoon · The long Atlantic swell under her, and shearwaters skimming the troughs. The trade wind fills in from the north-east, warm in the cockpit.',
    'Night · A watch at the wheel under more stars than you knew there were, the wake glowing. Flying fish thump onto the foredeck in the dark.',
    'Landfall · A smudge on the horizon becomes a mountain with a cloud caught on its top: Pico Brasa. Round Punta del Faro, and the smell of land.',
  ],
  home: [
    'Morning · Brasa drops astern, the cloud on the volcano the last of it you see. North into the trade wind, spray rattling on the hardtop.',
    'Afternoon · The wind eases and the sea turns from blue to green-grey. Dolphins ride the bow wave for an hour.',
    'Night · Cooler air and a long swell from the west. You find a jumper for the night watch.',
    'Landfall · Gannet Light ahead, then the hills behind Willow Bay. You throttle back off Willowhaven and bring her in to her berth on the pontoon.',
  ],
};
const PASSAGE_LOG = {
  south: [
    'Morning · You clear Gannet Light and stand out into the Atlantic, the boat leaning into it. By noon the coast is a grey line astern.',
    'Afternoon · The wind backs into the north-east trade, steady and warm on the quarter. Flying fish skitter away from the bow, and the sea turns a deeper blue.',
    'Night · A night at the tiller under the stars, the sea glowing in the wake, shearwaters wailing somewhere out in the dark.',
    'Landfall · A smudge on the horizon becomes a mountain with a cloud caught on its top: Pico Brasa. Black cliffs, a white village, the smell of land.',
  ],
  home: [
    'Morning · Brasa drops astern, the cloud on the volcano the last of it you see. The trade wind carries you north.',
    'Afternoon · The wind backs and freshens, and the sea turns from blue to green-grey. Dolphins ride the bow wave for an hour.',
    'Night · Cooler air and a long swell from the west; you find a jumper for the night watch.',
    'Landfall · Gannet Light ahead, then the hills behind Willow Bay. You lower the sail off Willowhaven and bring her in alongside.',
  ],
};
let passage = null; // { to, kind, t, line, moved }
const LINE_T = 3.4; // seconds each line of the log stays up

// Why the passage can't be made just now in this boat (the sailing boat or the yacht), or null.
// (part: how much of the crossing is left to make.)
function passageWhy(S = BOATS.sail, part = 1) {
  if (fishing.state === 'reeling' || fishing.state === 'landing' || fishing.state === 'caught' || fishing.state === 'keeping') return 'Land or let go of the fish first.';
  if (dive) return 'Out of the water first.';
  if (driving) return 'Out of the car first.';
  if (sleeping || traveling || passage) return 'Not now.';
  if (tow && (tow.lead === S || tow.towed === S)) return 'Let go of the tow first.';
  const need = Math.round(PASSAGE_FUEL * part);
  if (S.hull.passage && fuelLevel(tanks(), S.kind) < need) {
    return `She needs ${litres(need)} aboard for the crossing, and has ${litres(fuelLevel(tanks(), S.kind))}. Fill up first (${S.pos.z > SOUTH_Z ? 'the pump on Puerto Brasa quay' : 'the fuel point on Willowhaven’s pontoon'}).`;
  }
  return null;
}

// (The old offer of the passage: now the crossing's card, at the helm or the fast passage.)
function offerPassage(to, S = boat) {
  offerCrossing(to, S);
}

// Partway across at the helm: the rest of the way by the fast passage (the hours and the fuel for
// what's left of it).
function restOfTheWay(to) {
  const C = state.crossing;
  if (!C) return;
  const left = to === 'south' ? 1 - crossProgress(boat.pos.x, boat.pos.z) : crossProgress(boat.pos.x, boat.pos.z);
  ask(to === 'south' ? 'The rest of the way south' : 'The rest of the way home', `${(CROSS_M * left / 1000).toFixed(1)} km of open sea still to go: about ${Math.round(crossSeconds(C.kind) * left / 60)} minutes at the helm. Make the rest of it by the fast passage (the same hours go by, and you're there)?`, [
    { text: 'Carry on at the helm', cls: 'quiet' },
    { text: 'The fast passage', run: () => {
      state.crossing = null;
      startPassage(to, boat, Math.max(0.05, left));
    } },
  ]);
}

function startPassage(to, S = boat, part = 1) {
  if (passageWhy(S, part) || modal) return;
  if (placement.isOn) placement.stop();
  if (fishing.lineOut) fishing.cancel();
  if (cabinIn) leaveCabin(true);
  modal = 'travel';
  // (The cruiser takes the jet ski and the windsurf board along, lashed on deck, if they're by her.)
  const carry = S.hull.passage ? ['jetski', 'windsurf'].filter((k) => !BOATS[k].stowed && Math.hypot(BOATS[k].pos.x - S.pos.x, BOATS[k].pos.z - S.pos.z) < 45 && !(tow && (tow.lead === BOATS[k] || tow.towed === BOATS[k]))) : [];
  passage = { to, kind: S.kind, t: 0, line: -1, moved: false, carry, part };
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
    // (In the day book: the passage made, on the day you arrive.)
    noteCrossing(state.today, { to: P.to, stage: 'in', how: 'fast', boat: BOATS[P.kind]?.name || '' });
    state.passages = cleanPassages(state.passages);
    state.passages.fast++;
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
  // Free of any mooring, the sail down (the cruiser's motor in neutral).
  S.tie = null;
  S.shove = null;
  S.anchor = null;
  S.anchored = false;
  S.lever = 0;
  S.power = 0;
  if (S.sailUp) S.setSail(false);
  // (The yacht burns what she'd burn at the helm, the lever down the whole way, and a little for
  // the harbours each end.)
  const part = passage?.part ?? 1;
  if (S.hull.passage) tanks().boats[S.kind] = Math.max(0, fuelLevel(tanks(), S.kind) - CROSS_FUEL(BOAT_PER_S.cruiser) * part - 6);
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
  // The hours at sea: as many as the crossing takes at the helm (see crossing.js), and a couple
  // more for the coast at each end; you arrive fed and rested.
  const hours = Math.round(crossHours(S.kind) * part + 2.5);
  passTime(hours);
  state.food = { ...(state.food || {}), full: 100 };
  Object.assign(state.comfort, { warm: 18, wet: 0 });
  refill(state.comfort);
  // The weather where you land: fine, in the trade wind down south (your own sky: playing
  // together, the sky is the host's).
  if (skyMode() === 'auto' && !clock.following) {
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
  if (ELEC[what]) return elecLevel(f, what) <= 0 ? 'battery flat' : elecWords(f, what);
  const fuel = fuelLevel(f, what) <= 0 ? 'out of fuel' : `fuel ${tankWords(f, what)}`;
  return what === 'bass' ? `${fuel} · ${f.battery <= 0 ? 'battery flat' : batteryWords(f)}` : fuel;
}

// A word as a tank passes a fifth (once, until it's filled again).
const fuelWarned = {};
function watchTank(what) {
  // (An electric outboard's battery: a word at a fifth, once until it's charged again.)
  if (ELEC[what]) {
    const v = elecLevel(tanks(), what), lowNow = v < 0.2 && v > 0;
    if (lowNow && !fuelWarned[what]) hud.toast(`${cap(fuelName(what))}’s battery is low: ${elecWords(tanks(), what)}. Ease back and it lasts far longer; it charges at a jetty or a quay, and overnight.`, 6);
    fuelWarned[what] = lowNow || v <= 0;
    return;
  }
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
  if (id !== 'home') for (const b of boats) if (isPetrol(b.kind) && !ELEC[b.kind] && Math.hypot(b.pos.x - P.x, b.pos.z - P.z) < PUMP_REACH) here.push(b.kind);
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
  // (The pump at home is the farm's: theirs to give. The harbour's and the quay's are paid for.)
  const free = id === 'home';
  const each = fuelPrice(state.economy);
  const room = (w) => (w === 'can' ? 10 - f.can.litres : fuelRoom(f, w));
  const what = (w) => (w === 'can' ? 'the jerry can' : fuelName(w));
  const opts = needs.map((w) => {
    const q = free ? { litres: room(w), price: 0, short: false } : fuelQuote(room(w), state.economy, state.money);
    const text = free ? `Fill ${what(w)}` : !q.short ? `Fill ${what(w)}: ${litres(q.litres)}, ${money(q.price)}` : q.litres >= 0.5 ? `${money(q.price)} worth in ${what(w)} (${litres(q.litres)})` : null;
    return text && { text, cls: needs.length > 1 ? 'quiet' : '', run: () => fillUp([w], free) };
  }).filter(Boolean);
  const all = needs.reduce((sum, w) => sum + room(w), 0);
  if (needs.length > 1 && (free || state.money >= all * each - 1e-6)) opts.push({ text: free ? 'Fill everything' : `Fill everything: ${money(all * each)}`, run: () => fillUp(needs, free) });
  // Broke, and nearly dry: the harbour sees you home (once a day).
  const dry = here.filter((w) => w !== 'car');
  if (!free && dry.length && goodwillDue(state, state.economy, Math.min(...dry.map((w) => fuelLevel(f, w))))) {
    opts.push({ text: `Ask Wenna to see you home (${GOODWILL_L} L, on the harbour)`, run: () => goodwillFuel(dry[0]) });
  }
  const price = free ? '' : ` Fuel is ${money(each)} a litre; you’ve ${money(state.money)} in your purse.`;
  ask(name, `${lines.join(' ')}${price}`, [{ text: 'Not now', cls: 'quiet' }, ...opts]);
}

function fillUp(list, free = false) {
  const f = tanks();
  let total = 0, paid = 0;
  for (const w of list) {
    const room = w === 'can' ? 10 - f.can.litres : fuelRoom(f, w);
    const q = free ? { litres: room, price: 0 } : fuelQuote(room, state.economy, state.money);
    if (q.litres <= 0.05) continue;
    if (q.price > 0 && !payOut(state, q.price, `Fuel: ${litres(q.litres)}`).ok) continue;
    if (w === 'can') f.can.litres = Math.min(10, f.can.litres + q.litres);
    else addFuel(f, w, q.litres);
    total += q.litres;
    paid += q.price;
    if (w !== 'can') fuelWarned[w] = false;
  }
  if (!total) return;
  // (A few minutes at the pump, a quarter of an hour for a big fill.)
  passTime(clamp(total / 120, 0.05, 0.25));
  audio.knock?.(0.3);
  hud.toast(`${litres(total)} of fuel${paid ? ` for ${money(paid)}` : ''}: ${list.map((w) => (w === 'can' ? 'the jerry can' : fuelName(w))).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`, 4);
  save();
}

// The harbour's goodwill: enough to get home on, once a day, when the purse is empty.
function goodwillFuel(w) {
  const f = tanks();
  addFuel(f, w, Math.min(GOODWILL_L, fuelRoom(f, w)));
  state.goodwillDay = state.day;
  fuelWarned[w] = false;
  audio.knock?.(0.3);
  hud.toast(`Wenna fills a can and tips it in: “${GOODWILL_L} litres, to see you home. Pay me back in mackerel.”`, 6);
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

/* ---------------- cargo (cargo.js): aboard her, where you put it ---------------- */

// The boats that take cargo on deck so far: the ones you walk about (the RIB, the centre console
// and the yacht).
const cargoBoat = (b) => !!b?.hull.standing;
// What you're carrying about her deck: { kind, key }.
let carrying = null;
state.cargo ??= newCargo();
// Her deck's things back into the save (where her loose ones have slid to), then handed to her
// again from it, and her loads with them.
function syncCargo(k) {
  const b = BOATS[k];
  if (!b) return;
  if (b.cargo) storePieces(state.cargo, k, b.cargo.filter((pc) => !pc.carried));
  b.setCargo(piecesAboard(state.cargo, k, tanks().can.at).map((p) => ({ ...p, carried: carrying?.kind === k && carrying.key === p.key })));
  b.setLoads(loadsOf(k));
}
function cargoSave() {
  for (const k of KINDS) if (BOATS[k].cargo?.length) storePieces(state.cargo, k, BOATS[k].cargo.map((pc) => (pc.carried ? { ...pc, x: pc.p[0], z: pc.p[2] } : pc)));
}
// A clear place on her floor for a piece coming aboard: from aft forward, the middle then each
// side, the first spot clear of what's there already.
function cargoSpot(b, id) {
  const H = b.hull, C = CARGO[id], others = b.cargo || [];
  for (let t = 0.14; t < 0.8; t += 0.05) {
    for (const sd of [0, -1, 1]) {
      const at = b.cargoFit({ id }, sd * 0.6, -H.L / 2 + H.L * t);
      const clear = others.every((o) => Math.abs(o.x - at.x) > (CARGO[o.id].size[0] + C.size[0]) / 2 + 0.04 || Math.abs(o.z - at.z) > (CARGO[o.id].size[2] + C.size[2]) / 2 + 0.04);
      if (clear) return at;
    }
  }
  return null;
}
// The boats lying at Willowhaven that you could load from the chandlery.
const cargoBoatsHere = () => boats.filter((b) => cargoBoat(b) && ownsBoat(state.yard, b.kind) && b.speed < 0.8 && Math.hypot(b.pos.x - HAVEN.x, b.pos.z - HAVEN.z) < 90);
// A piece's words: what it is, what it weighs, how it's stowed.
const cargoWords = (pc) => `${CARGO[pc.id].name}, ${Math.round(cargoKg(pc, tanks().can.litres) * 10) / 10} kg${pc.id === 'cylinder' ? (pc.full ? ', full' : ', breathed') : pc.id === 'battery' ? (pc.full ? ', charged' : ', flat') : ''}: ${pc.secured ? 'strapped down' : 'loose'}.`;

// Each frame: her loose things move only while she's the boat you're in or near (boat.js
// slideCargo); a knock as one fetches up; and what you carry is set down if you leave her deck.
function cargoTick() {
  const P = player().pos;
  for (const b of boats) {
    if (!b.cargo?.length) continue;
    b.cargoAwake = (!onFoot && b === boat) || Math.hypot(b.pos.x - P.x, b.pos.z - P.z) < 40;
    if (b.cargoHit > 0.6 && b.cargoAwake) {
      audio.knock?.(Math.min(0.9, b.cargoHit / 3));
      if (b === boat && !onFoot) teach('cargoLoose', 'Something loose just slid across her deck and fetched up against her side. Walk to it (off the helm) to strap it down, or move it.', 6);
    }
  }
  if (carrying && (onFoot || boat.kind !== carrying.kind || !boat.deck)) setDown(true);
}

// On her deck: what you're carrying, set down; or the piece at your feet.
function cargoAction() {
  if (!boat.deck || !boat.cargo?.length || fishing.busy) return null;
  const D = boat.deck;
  if (carrying) return { text: `Set the ${CARGO[carrying.id].short} down here`, run: () => setDown() };
  let best = null, bd = 0.85;
  for (const pc of boat.cargo) {
    const d = Math.hypot(pc.x - D.x, pc.z - D.z);
    if (d < bd) [bd, best] = [d, pc];
  }
  if (!best) return null;
  return { text: `The ${CARGO[best.id].short}: ${best.secured ? 'unstrap it' : 'pick it up, or strap it down'}${cargoUse(best) ? ', or use it' : ''}`, run: () => cargoMenu(best) };
}
function cargoMenu(pc) {
  const acts = [], use = cargoUse(pc);
  if (use) acts.push({ text: use.text, cls: 'quiet', run: use.run });
  if (pc.secured) acts.push({ text: 'Undo the straps', cls: 'quiet', run: () => strapCargo(pc, false) });
  else {
    acts.push({ text: 'Strap it down', cls: 'quiet', run: () => strapCargo(pc, true) });
    acts.push({ text: 'Pick it up', run: () => pickUpCargo(pc) });
  }
  acts.push({ text: 'Leave it', cls: 'quiet', run: () => {} });
  ask(CARGO[pc.id].name, cargoWords(pc), acts);
}
function strapCargo(pc, on) {
  boat.strapCargo(pc, on);
  audio.step?.(false, 0, 'wood');
  hud.flash(on ? `Strapped down: the ${CARGO[pc.id].short} stays where it is now.` : `Unstrapped: the ${CARGO[pc.id].short} is loose, and slides if she heels or lurches.`, t, 2.6);
  syncCargo(boat.kind);
  save();
}
function pickUpCargo(pc) {
  carrying = { kind: boat.kind, key: pc.key, id: pc.id };
  pc.carried = true;
  boat.strapCargo(pc, false);
  audio.step?.(false, 0, 'wood');
  hud.flash(`You pick up the ${CARGO[pc.id].short} (${Math.round(cargoKg(pc, tanks().can.litres))} kg). Walk it where you want it, and set it down.`, t, 3);
}
// Set it down in front of you (or, leaving her deck with it, where you stand): loose, until you
// strap it.
function setDown(quiet = false) {
  const b = BOATS[carrying?.kind], pc = b?.cargo?.find((p) => p.key === carrying.key);
  carrying = null;
  if (!pc) return;
  const D = b.deck, x = D ? D.x + Math.sin(D.yaw) * 0.45 : pc.p[0], z = D ? D.z + Math.cos(D.yaw) * 0.45 : pc.p[2];
  pc.carried = false;
  const at = b.cargoClear(pc, x, z);
  Object.assign(pc, { x: at.x, z: at.z, vx: 0, vz: 0 });
  b.strapCargo(pc, false);
  b.placeCargo(pc);
  audio.knock?.(0.3);
  if (!quiet) teach('cargoDown', `Set down loose. Strapped, a thing stays put; loose, it slides about her deck when she heels, lurches or turns hard, and its weight goes with it.`, 6);
  syncCargo(b.kind);
  save();
}
// What a piece is for, out here: a full cylinder for a breathed tank, a charged battery for a
// flat one, the jerry can into her tank.
function cargoUse(pc) {
  const k = boat.kind, f = tanks();
  if (pc.id === 'cylinder' && pc.full && state.dive.tank < SCUBA.full - 10) {
    return { text: `Swap your dive tank (${Math.round(state.dive.tank)} bar) for it`, run: () => {
      state.dive.tank = SCUBA.full;
      pc.full = false;
      audio.knock?.(0.3);
      hud.toast(`You swap your breathed tank for the full cylinder: ${SCUBA.full} bar for the next dive. The chandlery fills the empty one.`, 5);
      syncCargo(k);
      save();
    } };
  }
  if (pc.id === 'battery' && pc.full) {
    const flat = [['troll', f.troll?.[k]], ['elec', ELEC[k] ? elecLevel(f, k) : undefined]].filter(([, v]) => v != null && v < 0.6).sort((a, b) => a[1] - b[1])[0];
    if (flat) return { text: `Swap in the spare battery (${flat[0] === 'troll' ? 'the trolling motor’s' : 'the motor’s'} is at ${Math.round(flat[1] * 100)}%)`, run: () => {
      if (flat[0] === 'troll') f.troll[k] = 1;
      else f.elec[k] = 1;
      pc.full = false;
      audio.knock?.(0.3);
      hud.toast('The spare battery’s in and the flat one’s on deck: charge it at a jetty, a quay or the chandlery.', 5);
      syncCargo(k);
      save();
    } };
  }
  if (pc.id === 'can' && f.can.litres >= 0.5 && isPetrol(k) && fuelRoom(f, k) >= 0.05) {
    return { text: `Pour it into her tank (${litres(f.can.litres)})`, run: () => {
      pourCan(k);
      syncCargo(k);
    } };
  }
  return null;
}
// The jerry can aboard a boat, or back in your backpack.
function canAboard(b, on) {
  const f = tanks();
  if (on) {
    const spot = cargoSpot(b, 'can');
    if (!spot) return hud.flash('There’s no clear space on her deck for it.', t, 2.5);
    moveCan(f, `boat:${b.kind}`);
    state.cargo.can = { x: spot.x, z: spot.z, secured: true };
  } else {
    if (carrying?.key === 'can') carrying = null;
    moveCan(f, 'pack');
  }
  syncCargo(b.kind);
  save();
}

// Run dry in the car: someone up the lane lends you a can (it takes an hour).
function rescueCar() {
  passTime(rescue(tanks(), 'car'));
  fuelWarned.car = true;
  hud.toast(`An hour’s walk to the nearest farm and back with a borrowed can: ${litres(tanks().car)} in the tank. The pumps are at home and on Willowhaven quay.`, 7);
  save();
}

// Run dry in a boat: the jerry can, a tow in, or the oar.
function boatChoices() {
  const f = tanks(), kind = boat.kind;
  const acts = [{ text: 'Paddle on with the oar', cls: 'quiet', run: () => {} }];
  // (An electric outboard's battery flat: no can will help, a tow will.)
  if (ELEC[kind]) {
    acts.push({ text: boat.pos.z > SOUTH_Z ? 'A tow in to Puerto Brasa (about an hour)' : 'A tow to Willowhaven quay (about an hour)', run: () => towBoat() });
    ask(`The ${boat.name}: battery flat`, 'The motor’s battery is flat. An oar moves her along, slowly; tied up at a jetty or a quay it charges again (half an hour’s worth an hour), and overnight.', acts);
    return;
  }
  // (The jerry can in your backpack, or aboard her as cargo: see cargo.js.)
  const canWith = f.can.at === 'pack' || f.can.at === `boat:${kind}`;
  if (canWith && f.can.litres >= 0.5) acts.push({ text: `Pour in the jerry can (${litres(f.can.litres)})`, cls: 'quiet', run: () => { pourCan(kind); if (f.can.at !== 'pack') syncCargo(kind); } });
  acts.push({ text: kind === 'bass' ? 'A tow to the boathouse (about an hour)' : boat.pos.z > SOUTH_Z ? 'A tow in to Puerto Brasa (about an hour)' : 'A tow to Willowhaven quay (about an hour)', run: () => towBoat() });
  ask(`The ${boat.name}: out of fuel`, `The tank is dry. An oar moves her along, slowly${kind === 'bass' && f.battery > 0 ? ', and the electric motor still runs on its battery' : ''}.${canWith ? '' : ' (The jerry can isn’t with you.)'}`, acts);
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
  // (An electric: tied up the while, its battery's had an hour's charge.)
  if (ELEC[boat.kind]) {
    chargeElec(tanks(), boat.kind, 1);
    hud.toast(`${south ? 'A fishing boat tows you in to Puerto Brasa' : 'A boat from the harbour tows you in to Willowhaven quay'}, an hour gone, and the motor’s battery has had an hour on charge: ${elecWords(tanks(), boat.kind)}.`, 8);
    save();
    return;
  }
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
  haptics.pulse({ strong: 0.9, weak: 0.5, ms: 200, shape: 'thump' }, clamp(b.speed / 6, 0.3, 1));
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
      `${formatClock(clock.hour)}, ${phaseName(clock.hour).toLowerCase()}. ${sky}.`,
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
    ask('Your first fishing trip', 'This is home: the cottage, the garage with your tackle, and the car. Like a short guide to your first trip? Stop it any time; it’s in the journal.', [
      { text: 'No thanks', cls: 'quiet', run: () => hud.toast('Explore as you like. The guide is in the journal (Memories) if you want it.', 5) },
      // (For someone who'd rather be on the water than fish: where the work is.)
      { text: 'Not fishing: boats and work', cls: 'quiet', run: () => hud.toast('Then Willowhaven’s notice board is for you: paid work on the water, a new board each day (a parcel to deliver, dolphins to find, a course to sail, people to take out later on), and the harbour office calls on the radio when someone needs a hand. Drive to the harbour: the first job’s an easy one.', 12) },
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
    showNote('Your first trip', `${n ? `${n === 1 ? 'One fish' : `${n} fish`} in your journal from it.` : 'Done.'} Go anywhere the car or the boats can take you: the workbench plans an outing, the map shows where.`, 'trip');
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
  refreshBadges();
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
// A long run from a boat with her engine running: follow the fish with her at a trolling pace,
// winning the line back (and stop following again).
let following = false;
const motorRunning = () => {
  if (onFoot || !boat.motor) return false;
  const Eh = engines[boat.kind];
  return boat.trolling ? !boat.flat : !boat.dry && (!Eh || engineRunning(Eh));
};
function followAction() {
  const F = fishing.fight;
  if (onFoot || !F || fishing.state !== 'reeling' || F.atNet || !motorRunning() || !(following || F.extra > 3)) return null;
  return {
    text: following ? 'Stop following the fish' : 'Follow the fish with the boat',
    run: () => {
      following = !following;
      if (following && leverKind()) changeLever(levers(leverKind())[capIndex(leverKind(), 'line')]?.v ?? 0);
      else leverNeutral();
      hud.flash(following ? 'You put her ahead at a trolling pace and follow the fish: the line comes back onto the reel.' : 'You knock her back into neutral.', t, 2.4);
    },
  };
}
// (Done following: back into neutral.)
function stopFollowing() {
  if (!following) return;
  following = false;
  leverNeutral();
}

function interaction() {
  if (!started || modal || placement.isOn || walker.stepping) return null;
  // A friend's fish beaten and lying alongside, within reach: net it for them (see teamwork.js).
  const helpNet = together.active && !fishing.fight && !dive && !driving ? teamwork.netTarget(player().pos, onFoot ? 0 : boat.hull.L * 0.5) : null;
  if (helpNet) return { text: `Net ${helpNet.p.name}’s fish`, run: () => { if (teamwork.net(helpNet)) hud.flash(`You reach out with the net for ${helpNet.p.name}’s fish…`, t, 2); } };
  if (fishing.busy) return followAction();
  // Crewing in a friend's boat: the helm, or stepping off (see crew.js).
  if (crew.on) return { text: crew.on.helm ? 'At the helm: hand it back, or step off' : 'Crewing: take the helm, or step off', run: () => crewChoices() };
  // In the water: something to climb out onto, at the surface.
  if (dive) return diveExit();
  // Inside the cabin: what's where you stand.
  if (cabinIn) return cabinAction();
  // Sitting a while: up again.
  if (sitting) return { text: sitting.kind === 'boat' ? 'Sit up' : 'Get up', run: () => standUp() };
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
    // The boat trailer, hitched behind or standing by the garage.
    const tr = trailerAct(P);
    if (tr) return tr;
    // Somewhere to sit a while (see sitDown).
    const seat = seatNear();
    if (seat) return { text: seat.kind === 'fire' ? 'Sit by the fire' : seat.kind === 'chair' ? 'Sit in your camp chair' : 'Sit by the stove', run: () => sitDown(seat) };
    // Home and the garage.
    const hs = homeSpotNear();
    if (hs) return HOME_ACTS[hs.id];
    // Inside the chandlery or The Lobster Pot: what's where you stand; at their doors, in.
    const rs = roomSpotNear();
    if (rs) return ROOM_ACTS[rs.id](rs);
    if (insideHaven(walker.pos.x, walker.pos.z)) {
      const folk = town.near(walker.pos.x, walker.pos.z, 1.9);
      return folk ? { text: `Talk to ${FOLK[folk.id].short}`, run: () => talkTo(folk) } : null;
    }
    const hd = havenDoorNear();
    if (hd) return { text: hd.id === 'inn' ? 'Go into The Lobster Pot' : 'Go into the chandlery', run: () => goIn(hd) };
    const near = boatNear();
    // A boat with a cabin made fast: aboard to the helm, or straight into the cabin (and the
    // cruiser: the long passage too).
    if (near && near.hull.cabin && canEnterCabin(near)) {
      const long = !!near.hull.passage, to = walker.pos.z > SOUTH_Z ? 'home' : 'south';
      return { text: long ? `The ${near.name}: the helm, the cabin, or the crossing ${to}` : `The ${near.name}: the helm or the cabin`, run: () => ask(boatTitle(near), long
        ? `She’s made fast here. Take the helm, go into the cabin (the galley and the bunks), or set out on the crossing ${to === 'south' ? 'south to Las Brasas' : 'home to Willow Bay'} (at the helm, or the fast passage)?`
        : 'She’s made fast here. Take the helm, or go straight into the cabin (the galley and the bunk)?', [
        ...(long ? [{ text: to === 'south' ? 'The crossing south' : 'The crossing home', cls: 'quiet', run: () => offerPassage(to, near) }] : []),
        { text: 'The helm', cls: 'quiet', run: () => climbAboard(near) },
        { text: 'Into the cabin', run: () => enterCabin(near) },
      ]) };
    }
    // The sailing boat: get in, or the long passage (to Las Brasas, or home from there).
    if (near && near.hull.sail) {
      const to = walker.pos.z > SOUTH_Z ? 'home' : 'south';
      return { text: `The ${near.name}: get in, or the crossing ${to}`, run: () => ask(boatTitle(near), to === 'south' ? 'Get in and sail her here, or set out on the crossing south to Las Brasas (at the helm, or the fast passage)?' : 'Get in and sail her here, or set out on the crossing home to Willow Bay (at the helm, or the fast passage)?', [
        { text: to === 'south' ? 'The crossing south' : 'The crossing home', cls: 'quiet', run: () => offerPassage(to, near) },
        { text: 'Get in', run: () => climbAboard(near) },
      ]) };
    }
    if (near) return { text: `Get in the ${near.name}`, run: () => climbAboard(near) };
    // A friend's boat alongside, stopped: step aboard and crew for them.
    const fb = crewBoatNear();
    if (fb) return { text: `Step aboard ${fb.p.name}’s ${fb.b.hull.name}`, run: () => stepAboard(fb) };
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
    if (coastSpot('kaigan')) return { text: 'Kaigan’s kitchen door: fish for sushi, sashimi and ceviche', run: () => openHarbour('kaigan') };
    if (coastSpot('tower')) return { text: 'The watch tower', run: () => climbTower() };
    // Someone to talk to: the harbour's people (and Paco).
    const folk = town.near(walker.pos.x, walker.pos.z, 1.9);
    if (folk) return { text: `Talk to ${FOLK[folk.id].short}`, run: () => talkTo(folk) };
    if (coastSpot('bench')) return { text: 'Sit on the bench a while', run: () => sitOnBench() };
    if (officeNear()) return { text: 'The harbour office: your boats', run: () => harbourOffice() };
    if (coastSpot('office')) return { text: 'The harbour office: your boats, brought round or shipped from Willowhaven', run: () => boatsRound('south') };
    // Clear running water beside you, and room in your bottle.
    if (needsMode() !== 'off' && state.comfort.bottle < BOTTLE && streamHere()) return { text: 'Fill your water bottle', run: () => fillBottle() };
    if (stuckT > 2.5) return { text: 'Stuck? Head back to camp or the boat', run: () => openPack() };
    // A rockpool at your feet, the tide out: look in. (Under the tide: when it'll be out again.)
    const pool = poolNear(walker.pos.x, walker.pos.z, TIDE.level, { open: false });
    if (pool && poolOpen(pool, TIDE.level)) return { text: 'Look in the rockpool', run: () => openPool(pool) };
    if (pool) return { text: 'A rockpool, under the tide', run: () => hud.flash(`The tide’s over this pool: ${tideWords(clock.abs)}. The lowest pools come out only at the bottom of the ebb, and at springs.`, t, 4) };
    // The bait bucket's water going stale, and the water at your feet: change it.
    const fresh = bucketAction();
    if (fresh) return fresh;
    // Deep water a stride away: in you go.
    const entry = diveEntry();
    if (entry) return { text: 'Go diving', run: () => chooseDive(entry) };
    return null;
  }
  // On her deck: what you're carrying, or the piece of cargo at your feet (see cargoAction), even
  // lying alongside (step ashore from anywhere else on her deck).
  {
    const ca = cargoAction();
    if (ca) return ca;
  }
  const spot = cachedShoreSpot();
  const ashore = spot && (spot.landing ? 'Step ashore at the landing' : spot.quay ? 'Step up onto the quay' : spot.pier ? 'Step onto the jetty' : 'Step ashore');
  // Lying alongside a friend's boat, both stopped (yours anchored, tied up or still): step across.
  if (!fishing.busy && (boat.anchored || boat.tie || boat.speed < 0.3)) {
    const fb = crewBoatNear(boat.hull.L * 0.5);
    if (fb) return { text: `Step across to ${fb.p.name}’s ${fb.b.hull.name}`, run: () => stepAboard(fb) };
  }
  // The cabin boat, anchored or tied up by the shore: the cabin, or ashore.
  if (spot && boat.hull.cabin && canEnterCabin(boat) && !fishing.lineOut) {
    return { text: 'Into the cabin, or ashore', run: () => ask(boatTitle(boat), 'Tied up here. Into the cabin (the galley and the bunk), or ashore?', [
      { text: ashore, cls: 'quiet', run: () => climbOff(spot) },
      { text: 'Into the cabin', run: () => enterCabin() },
    ]) };
  }
  if (lostBuoyNear()) return { text: 'Pick up Dougie’s buoy', run: () => pickUpLostBuoy() };
  if (spot) return { text: ashore, run: () => climbOff(spot) };
  // A boat out there with a dead engine (a tow job): take her in tow, or let her go.
  {
    const S = !onFoot && boat.speed < 1.2 ? strayNear(tow && tow.lead === boat ? 9 : 5) : null;
    if (S) {
      const towing = tow && tow.lead === boat && tow.towed === S;
      return { text: towing ? `Let go the ${S.name}` : `Take the ${S.boatName || S.name} in tow`, run: () => (towing ? letGoTow() : takeInTow(S)) };
    }
  }
  // A boat you stand in, walking her deck: back at the wheel, take the helm again.
  if (boat.hull.standing && !fishing.busy && boat.deck && boat.atHelm) return { text: 'Take the helm', run: () => takeHelm(true) };
  // By the trolling motor on her bow: deploy it, stow it, set its depth.
  if (boat.deck && boat.troll && nearTroll() && !fishing.busy) return { text: boat.troll.want ? 'The trolling motor: stow it, or its depth' : 'Deploy the trolling motor', run: () => trollAtBow() };
  const other = boat.speed < 1 ? otherBoat(tow && (tow.lead === boat || tow.towed === boat) ? 9 : 4.5) : null;
  if (other) {
    const towing = tow && ((tow.lead === boat && tow.towed === other) || (tow.towed === boat && tow.lead === other));
    return { text: `The ${other.name}: step across${towing ? ', or let her go' : ', or take her in tow'}`, run: () => ask(boatTitle(other), towing ? 'She’s on your towline. Step across into her, or let her go?' : 'Step across into her, or take her in tow? (A line from your stern to her bow: she follows where you go.)', [
      { text: towing ? 'Let go the tow' : 'Take her in tow', cls: 'quiet', run: () => (towing ? letGoTow() : takeInTow(other)) },
      { text: 'Step across', run: () => stepAcross(other) },
    ]) };
  }
  // A dry tank: the jerry can, a tow, or an oar.
  if (ELEC[boat.kind] && boat.motor && elecLevel(tanks(), boat.kind) <= 0 && boat.speed < 1) return { text: 'Battery flat: what now?', run: () => boatChoices() };
  if (isPetrol(boat.kind) && !ELEC[boat.kind] && boat.motor && fuelLevel(tanks(), boat.kind) <= 0 && boat.speed < 1) return { text: 'Out of fuel: what now?', run: () => boatChoices() };
  // Walking her deck, knocked about: look her over (see damageAction).
  if (boat.deck && !boat.atHelm) {
    const da = damageAction();
    if (da) return da;
  }
  // At the helm with the engine off: start her (or the helm panel, on the full procedure).
  {
    const E = engineHere();
    // (Her battery terminal shaken loose: she won't start till it's done up, at the console.)
    if (E && E.loose && !engineRunning(E) && !engineCranking(E) && !fishing.busy) return { text: 'She won’t start: look her over', run: () => lookHerOver() };
    if (E && startMode() !== 'go' && !engineRunning(E) && !engineCranking(E) && !E.auto && !fishing.lineOut) {
      const P = ENGINES[E.kind];
      // (With a controller, the trolling motor's menu from here too: L3 starts her, and the motor's
      // for quiet work with the engine off.)
      if (scheme() === 'pad' && boat.troll) return { text: 'The helm, or the trolling motor…', run: () => ask(boatTitle(boat), 'The helm panel (to start her up), or the trolling motor?', [
        { text: 'Not now', cls: 'quiet', cancel: true },
        { text: 'The trolling motor…', cls: 'quiet', run: () => trollMenu() },
        { text: 'The helm', run: () => (startMode() === 'full' ? openHelm() : engineKey()) },
      ]) };
      if (startMode() === 'full') return { text: 'The helm: start her up', run: () => openHelm() };
      return { text: P.starter === 'pull' ? 'Pull the starter cord' : 'Start the engine', run: () => engineKey() };
    }
  }
  // A boat you stand in: off the helm to walk her deck (slow, or held still).
  if (boat.hull.standing && !fishing.busy && !boat.deck && (boat.speed < 2.5 || boat.anchored || boat.tie)) return { text: 'Leave the helm: walk the deck', run: () => takeHelm(false) };
  // Water in her, sitting in a boat you don't walk about: bailing comes before anything else.
  if (!boat.hull.standing && (boat.flooding?.litres || 0) > 5) {
    const da = damageAction();
    if (da) return da;
  }
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
  // At anchor or made fast, and still: sit back a while (or over the side, over deep water).
  const settled = (boat.anchored || boat.tie) && Math.abs(boat.speed) < 0.3 && !fishing.lineOut;
  const sitBoat = () => sitDown({ kind: 'boat', name: `back in the ${boat.name}` });
  if (settled && entry) {
    return { text: 'Sit back a while, or go diving', run: () => ask(boatTitle(boat), 'At anchor, and all quiet. Sit back a while and watch the water, or over the side for a dive?', [
      { text: 'Go diving', cls: 'quiet', run: () => chooseDive(entry) },
      { text: 'Sit back a while', run: sitBoat },
    ]) };
  }
  if (settled) return { text: 'Sit back a while', run: sitBoat };
  // Stopped over deep water: over the side.
  if (entry) return { text: 'Go diving', run: () => chooseDive(entry) };
  // In the sailing boat or the cruiser, out on open water: the crossing (at the helm, or fast).
  if ((boat.hull.sail || boat.hull.passage) && !fishing.lineOut && passageWaters()) {
    const C = state.crossing;
    if (C && BOATS[C.kind] === boat) {
      const going = C.back ? (C.to === 'south' ? 'home' : 'south') : C.to;
      return { text: 'The rest of the way by the fast passage', run: () => restOfTheWay(going) };
    }
    const to = boat.pos.z > SOUTH_Z ? 'home' : 'south';
    return { text: to === 'south' ? 'The crossing to Las Brasas' : 'The crossing home', run: () => offerPassage(to) };
  }
  // At the helm with a bow trolling motor and nothing else to do: its menu (deploy or stow it, its
  // depth, Spot-Lock), so it can be worked with a controller from any boat, dashboard or not.
  if (!onFoot && !boat.deck && boat.troll && !fishing.busy && leverKind()) return { text: 'The trolling motor…', run: () => trollMenu() };
  return bucketAction() || damageAction();
}
// Live bait in a bucket whose water is going stale, and water to hand: change it (see livebait.js).
function bucketAction() {
  const B = state.gear.bucket;
  if (!B.fish.length || B.water > 0.7 || livewellHere() || !bucketWater()) return null;
  return { text: `Change the bait bucket’s water (${waterWords(B)})`, run: () => {
    freshen(B);
    hud.flash(`Fresh water in the bait bucket: ${B.fish.length} live bait${B.fish.length > 1 ? 's' : ''}, lively again.`, t, 3);
    save();
  } };
}
// The trolling motor's menu (see above): what can be done with it from here.
function trollMenu() {
  const M = trollOf(boat);
  if (!M) return;
  const opts = [{ text: 'Not now', cls: 'quiet', cancel: true }];
  if (M.want) opts.push({ text: `Depth (${M.depthId})`, cls: 'quiet', run: () => trollDepth() });
  if (M.gps && M.deployed) opts.push({ text: M.mode === 'lock' || M.mode === 'heading' ? 'Let go (Spot-Lock off)' : 'Spot-Lock: hold her here', cls: 'quiet', run: () => trollLock() });
  opts.push({ text: M.want ? 'Stow it' : 'Deploy it', run: () => trollDeploy() });
  const where = M.deployed ? `down at depth (${M.depthId})${M.mode === 'lock' ? ', holding her on Spot-Lock' : ''}` : M.want ? 'on its way down' : M.mech.stowed ? 'stowed on its mount' : 'on its way up';
  ask('The trolling motor', `The ${M.spec.name.toLowerCase()} is ${where}. ${M.powered ? 'It stows and deploys itself from its remote.' : trollReach(M) ? 'It’s worked by hand: within reach.' : 'It’s worked by hand at the bow: go forward to it.'}`, opts);
}
// Open water to set out from: out of the bays and the harbour (at home, the open sea and the coast;
// at Las Brasas, anywhere outside Puerto Brasa's basin).
function passageWaters() {
  const z = zoneAt(boat.pos.x, boat.pos.z);
  return boat.pos.z > SOUTH_Z ? z !== 'harbor' : z === 'open' || z === 'coast' || z === 'deep';
}

/* ---------------- the crossing, at the helm ---------------- */

// Across the open Atlantic between Willow Bay and Las Brasas, the whole way, in the sailing boat or
// the yacht (see crossing.js): the crossing under way is state.crossing; the marker points where
// to steer; what's met along the way is seeded by the day you set out.
const CROSS_KM = (CROSS_M / 1000).toFixed(1);
let crossAim = null, crossAfter = null, edgeAsked = false, edgeToastT = 0, crossSaid = {};
const hoursWords = (h) => (h < 30 ? `about a day (${Math.round(h)} hours)` : `a day and a half (${Math.round(h)} hours)`);

// What setting out needs, and how it looks: the lines for the card, and what (if anything) stops you.
function crossingChecks(to, S) {
  const list = [];
  let stop = null;
  if (!LONG_RANGE.includes(S.kind)) stop = `The ${S.name} is no boat for the open Atlantic: the crossing is for the sailing boat or the sport-fishing yacht.`;
  const why = passageWhy(S);
  if (why) stop = stop || why;
  const secs = crossSeconds(S.kind), hrs = crossHours(S.kind);
  list.push({ ok: true, text: `${S.kind === 'sail' ? 'The sailing boat' : 'The yacht'}: about ${Math.round(secs / 60)} minutes at the helm across ${CROSS_KM} km of open sea (${hoursWords(hrs)} go by, through a night), then ${to === 'south' ? 'round Punta del Faro into Puerto Brasa' : 'in past Gannet Light to Willow Bay'}.` });
  if (S.kind === 'cruiser') {
    const have = fuelLevel(tanks(), 'cruiser');
    list.push(have >= PASSAGE_FUEL
      ? { ok: true, text: `Fuel: ${litres(have)} aboard. The crossing takes about ${litres(CROSS_FUEL(BOAT_PER_S.cruiser))} with the lever down the whole way.` }
      : { ok: false, text: `Fuel: she needs ${litres(PASSAGE_FUEL)} aboard for the crossing, and has ${litres(have)}. Fill up first (${S.pos.z > SOUTH_Z ? 'the pump on Puerto Brasa quay' : 'the fuel point on Willowhaven’s pontoon'}).` });
    list.push({ ok: true, text: 'Out in the ocean’s long swell she makes about six knots: drive her harder and she slams, so you hold her there.' });
  } else {
    list.push({ ok: true, text: to === 'south' ? 'The wind: home’s own weather this side, then backing into the north-east trade halfway over, on the quarter: fast going. Ease the sheet as it comes aft.' : 'The wind: the north-east trade on the quarter going north, then home’s own weather the far side.' });
  }
  list.push({ ok: true, text: 'Water and stores for the crossing, taken aboard as you set out.' });
  const abs = clock.abs, h = hoursToGale(abs), storm = Math.max(weather.storm, conditions.sea.storm);
  if (storm > 0.35) list.push({ ok: false, text: 'It’s blowing a gale: no weather to be out on the open sea. Wait for it to pass, or take the fast passage.' });
  else if (h != null && h < crossHours(S.kind) + 3) list.push({ ok: false, text: `A gale is due in about ${Math.max(1, Math.round(h))} hours, before you'd be across. Wait for it to pass, or take the fast passage.` });
  else list.push({ ok: true, text: 'No gale due before you’re across.' });
  const T = to === 'south' ? ENDS.south : ENDS.home;
  list.push({ ok: true, text: `Steer ${pointWords(bearingTo(S.pos.x, S.pos.z, T.x, T.z))}: the marker shows the way, and the chart (${input.keyLabel('map')}) has the open sea on it.` });
  return { list, stop };
}

// The card: sail her across yourself, or the fast passage (the same hours, the same fuel). At the
// edge of the chart, turning back is the first choice.
function offerCrossing(to, S = boat, atEdge = false) {
  const { list, stop } = crossingChecks(to, S);
  const first = to === 'south' && !state.places.brasa;
  const intro = first ? 'Across the open Atlantic to the south lies Las Brasas: a volcanic island in the trade wind, with warm clear water, black lava reefs and fish you never see at home. ' : '';
  const text = `${intro}${atEdge ? 'Beyond here is the open Atlantic. ' : ''}${to === 'south' ? 'The crossing to Las Brasas' : 'The crossing home to Willow Bay'}: sail her across yourself, or take the fast passage (the same hours go by${S.kind === 'cruiser' ? ', the same fuel' : ''}, and you're there).`;
  const buttons = [{ text: atEdge ? 'Turn back' : 'Not now', cls: 'quiet', run: () => { if (atEdge) hud.toast('You put her about for home waters.', 3); } }];
  if (!stop) {
    buttons.push({ text: 'Fast passage', cls: 'quiet', run: () => startPassage(to, S) });
    buttons.push({ text: S.kind === 'sail' ? 'Sail her across' : 'Take her across', run: () => startCrossing(to, S) });
  } else list.unshift({ ok: false, text: stop });
  ask(to === 'south' ? 'The crossing south' : 'The crossing home', text, buttons, { list });
}

function startCrossing(to, S = boat) {
  if (crossingChecks(to, S).stop || modal) return;
  if (onFoot || boat !== S) board(S);
  state.crossing = { to, kind: S.kind, day: state.day, abs: state.day * 24 + state.hour, secs: 0, events: planCrossing(state.day, to), weather: null, eased: false, back: false };
  crossSaid = {};
  noteCrossing(state.today, { to, stage: 'out', boat: S.name });
  // Water and stores aboard for the crossing.
  state.food = { ...(state.food || {}), full: Math.max(state.food?.full ?? 0, 90) };
  refill(state.comfort);
  const T = to === 'south' ? ENDS.south : ENDS.home;
  hud.toast(`You take on water and stores and set your course: ${pointWords(bearingTo(S.pos.x, S.pos.z, T.x, T.z))} for ${to === 'south' ? 'Las Brasas' : 'Gannet Light and home'}. The marker shows the way; the chart (${input.keyLabel('map')}) has the open sea on it.${S.kind === 'sail' ? (to === 'south' ? ' The wind will back into the trade halfway over: ease the sheet as it comes aft.' : '') : ' Out in the swell, hold her at about six knots.'}`, 10);
  save();
}

// Out past the edge of the chart without a crossing set: a boat fit for it is offered it (and held
// at the edge till you choose); anything smaller is turned back.
function holdOff() {
  const z = boat.pos.z, fromHome = z < (CROSSING.z0 + CROSSING.z1) / 2;
  if (LONG_RANGE.includes(boat.kind) && !edgeAsked && !modal && $('confirm').hidden && !fishing.busy) {
    edgeAsked = true;
    offerCrossing(fromHome ? 'south' : 'home', boat, true);
  }
  const lim = fromHome ? CROSSING.z0 + 40 : CROSSING.z1 - 40;
  if (fromHome ? z > lim : z < lim) {
    boat.vel.z = fromHome ? Math.min(boat.vel.z, -0.3) : Math.max(boat.vel.z, 0.3);
    if (edgeToastT <= 0) {
      edgeToastT = 40;
      hud.toast(LONG_RANGE.includes(boat.kind) ? 'The open Atlantic: set out on the crossing to go on (or turn back).' : `Beyond here it's the open Atlantic, days from anywhere: no place for the ${boat.name}. Las Brasas is a crossing for the sailing boat or the sport-fishing yacht.`, 6);
    }
  }
}

// Every frame: the weather over the open sea where you are, a motor boat held to what the swell
// allows, and the crossing itself (the way, what's met, the weather turning, arriving).
function updateCrossing(dt) {
  const P = player().pos;
  const C = state.crossing;
  conditions.trade = P.z > CROSSING.z0 - 400 && P.z < CROSSING.z1 + 400 ? tradeAt(P.z) : null;
  conditions.ocean = oceanAt(P.z, !!C);
  for (const b of boats) b.vmax = b.hull.sail && b.sailUp ? Infinity : seaKindly(oceanAt(b.pos.z, C?.kind === b.kind), conditions.sea.swell, !!(C?.eased && C.kind === b.kind));
  BOATS.sail.reef = C?.eased && C.kind === 'sail' ? 0.72 : 1;
  edgeToastT -= dt;
  crossAim = null;
  if (!started || sleeping || traveling || passage) return;
  const afloat = !onFoot && !driving && !dive;
  if (afloat && !inOcean(boat.pos.x, boat.pos.z)) edgeAsked = false;
  if (!C) {
    if (afloat && inOcean(boat.pos.x, boat.pos.z)) holdOff();
    // (Just across: the way on in to the harbour, for a while.)
    if (crossAfter && (t > crossAfter.until || Math.hypot(P.x - crossAfter.x, P.z - crossAfter.z) < 160)) crossAfter = null;
    if (crossAfter) crossAim = crossAfter.to === 'south' ? steerFor('south', P.x, P.z) : null;
    return;
  }
  const B = BOATS[C.kind];
  const going = C.back ? (C.to === 'south' ? 'home' : 'south') : C.to;
  crossAim = steerFor(going, B.pos.x, B.pos.z);
  // (Only while you're aboard her: ashore, or in another boat, the crossing waits for you.)
  const aboard = afloat && boat === B;
  if (!aboard) return;
  if (!modal) C.secs += dt;
  // (The stores: a meal and a drink from them every few hours at sea.)
  C.storesT = (C.storesT ?? 0) + dt;
  if (C.storesT > 6 * HOUR_SECONDS) {
    C.storesT = 0;
    state.food = { ...(state.food || {}), full: Math.max(state.food?.full ?? 0, 75) };
    if (state.comfort) state.comfort.drink = Math.max(state.comfort.drink, 75);
  }
  const z = B.pos.z, south = going === 'south';
  // What's met along the way, in order.
  for (const ev of C.events) {
    if (ev.done) continue;
    if (south ? z >= ev.z : z <= ev.z) {
      ev.done = true;
      meet(ev, B);
    }
    break;
  }
  // The landmarks: the island coming up over the horizon, halfway, the home coast.
  const p = crossProgress(B.pos.x, B.pos.z), done = south ? p : 1 - p;
  const say = (k, text) => {
    if (crossSaid[k]) return;
    crossSaid[k] = true;
    hud.toast(text, 8);
  };
  if (south && z > ISLAND_SEEN) say('island', 'Land ho: a mountain on the horizon dead ahead, a cloud caught on its top. Pico Brasa.');
  if (done > 0.5 && done < 0.6) say('half', `Halfway across: ${(CROSS_M * (1 - done) / 1000).toFixed(1)} km to go, nothing but sea all round, and the ${south ? 'trade wind filling in from the north-east' : 'trade wind dropping astern'}.`);
  if (!south && done > 0.85) say('home', 'Gannet Light on the horizon ahead, and the hills behind Willow Bay: home waters.');
  // The weather turning: a gale due, or blowing up now.
  const abs = clock.abs, h = hoursToGale(abs), storm = Math.max(weather.storm, conditions.sea.storm);
  if (!C.weather && onCrossing(B.pos.x, B.pos.z) && (storm > 0.3 || (h != null && h < 4)) && !modal && $('confirm').hidden) weatherTurns(C, B, h, storm, done);
  // Across.
  if (arrived(going, B.pos.x, B.pos.z)) finishCrossing(C, going);
}

// What's met along the way, brought to just off the bow where you'll see it.
function meet(ev, B) {
  const side = Math.random() < 0.5 ? 1 : -1, sideWord = side > 0 ? 'starboard' : 'port';
  const at = (ahead, across) => ({ x: B.pos.x + B.fwd.x * ahead + B.right.x * across * side, z: B.pos.z + B.fwd.z * ahead + B.right.z * across * side });
  const heading = Math.atan2(B.fwd.x, B.fwd.z);
  switch (ev.kind) {
    case 'dolphins': {
      const q = at(260, 170);
      shared.summon('commondolphin', q.x, q.z, Math.atan2(B.pos.x - q.x, B.pos.z - q.z));
      hud.toast(`Dolphins! A big pod of common dolphins racing in from off the ${sideWord} bow, leaping as they come. Keep her going and they'll ride the bow.`, 8);
      break;
    }
    case 'whale': {
      const q = at(380, 260), kind = B.pos.z > SOUTH_Z ? 'spermwhale' : 'finwhale';
      shared.summon(kind, q.x, q.z, heading + side * 0.6);
      hud.toast(kind === 'finwhale' ? `A blow, tall and narrow, off the ${sideWord} bow: a fin whale, travelling. Watch for it to come up again.` : `A bushy blow slanting forward off the ${sideWord} bow: a sperm whale, lying at the surface, breathing. It'll lift its flukes when it dives.`, 9);
      break;
    }
    case 'flyingfish':
      crossingLife.flyingFish(240);
      hud.toast('Flying fish! They burst out ahead of the bow and glide away over the waves. The water’s warm and blue now.', 8);
      break;
    case 'turtle': {
      if (region !== 'south') break;
      const q = at(70, 22);
      shared.summon('turtle', q.x, q.z);
      hud.toast(`A loggerhead turtle at the surface off the ${sideWord} bow, its head up for a breath. Ease her down and you'll see it close.`, 8);
      break;
    }
    case 'squall':
      if (skyMode() === 'auto' && !clock.following && !weather.storm) {
        weather.state = 'heavy';
        weather.timer = rand(60, 110);
        conditions.wind.target = Math.min(18, conditions.wind.target + 4);
        conditions.wind.timer = 80;
        hud.toast('A squall: hard gusts and rain for a minute or two. Ease the sheet (or the throttle) and let it blow through.', 9);
      }
      break;
    case 'boil':
      boilAhead(B, sideWord);
      break;
    case 'ship': {
      crossingLife.sendShip(B, side, (Math.random() - 0.5) * 0.5);
      hud.toast(env.night > 0.4
        ? `Lights off the ${sideWord} bow: a white light over a white light, and a ${side > 0 ? 'red' : 'green'} one. A ship, crossing ahead of you. Keep well clear: she won’t turn for you.`
        : `A ship off the ${sideWord} bow: a little container ship, deep-laden, crossing ahead on her way between the Channel and the islands. Keep well clear: she won’t turn for you.`, 9);
      break;
    }
    default:
  }
}

// Birds over tuna on the bait, ahead: the crossing's own fish (see habitat.js CROSSING_HOMES),
// the hunters set on the bait just as they'd find it themselves.
function boilAhead(B, sideWord) {
  if (env.daylight < 0.3) return;
  // (The nearest ahead with hunters and their bait both living there.)
  let best = null, bait = null, bd = 1300;
  for (const S of eco.schools) {
    if (!S.home.crossing) continue;
    const prey = S.home.south ? S.L.hunterSouth || S.L.hunter : S.L.hunter;
    if (!prey) continue;
    const dx = S.home.x - B.pos.x, dz = S.home.z - B.pos.z, d = Math.hypot(dx, dz);
    if (dx * B.fwd.x + dz * B.fwd.z < 0 || d > bd) continue;
    const on = eco.schools.find((o) => o.home === S.home && [].concat(prey).includes(o.sp.id));
    if (!on) continue;
    bd = d;
    best = S;
    bait = on;
  }
  if (!best) return;
  Object.assign(best, { x: bait.x + 30, z: bait.z, rest: 0, frenzy: 0, prey: bait, huntT: 4 });
  eco.activity[best.sp.id] = Math.max(eco.activity[best.sp.id] ?? 0, 0.8);
  hud.toast(`Birds working off the ${sideWord} bow: ${best.home.south ? 'shearwaters' : 'gannets'} diving. ${lower(best.sp.name).replace(/^./, (c) => c.toUpperCase())} on the bait: troll past the edge, or stop short and cast in.`, 9);
}

// The weather turning out on the open sea: shorten sail (or ease her back) and carry on, turn back
// while you're less than halfway, or heave to and let it pass.
function weatherTurns(C, B, h, storm, done) {
  C.weather = 'asked';
  const back = C.to === 'south' ? 'Willow Bay' : 'Las Brasas';
  const text = storm > 0.3 ? 'It’s blowing up hard: white water everywhere, the seas building, spray coming over green.' : `The glass is falling: a gale is due in about ${Math.max(1, Math.round(h))} hours, and you're ${Math.round(done * 100)}% of the way across.`;
  ask('The weather’s turning', `${text} What now?`, [
    { text: 'Heave to, let it pass', cls: 'quiet', run: () => heaveTo(C, B) },
    ...(done < 0.5 ? [{ text: `Turn back for ${back}`, cls: 'quiet', run: () => {
      C.back = !C.back;
      C.weather = 'back';
      noteCrossing(state.today, { to: C.to, stage: 'back', boat: B.name });
      hud.toast(`You put her about for ${back}: better a day lost than the boat. The marker shows the way back.`, 7);
      save();
    } }] : []),
    { text: C.kind === 'sail' ? 'Reef and carry on' : 'Ease back, carry on', run: () => {
      C.eased = true;
      C.weather = 'carry';
      hud.toast(C.kind === 'sail' ? 'You tie in a reef: less sail, less heel, slower but easier on her. On you go.' : 'You ease her back to take the seas on the shoulder: slower, and kinder to her. On you go.', 7);
      save();
    } },
  ]);
}
function heaveTo(C, B) {
  C.weather = 'wait';
  const abs = clock.abs, g = galeNear(abs);
  const hours = g && abs < g.end + 2 ? Math.max(2, g.end + 1.5 - abs) : 4;
  if (B.sailUp) B.setSail(false);
  B.lever = 0;
  B.power = 0;
  waitAWhile(hours, 'You heave to: the sail down to a scrap, her head held up to the seas, and you ride it out wedged in the cockpit, an eye on the compass…');
}

// Across: your time at the helm in the record, the page in the day book, and the way on in.
function finishCrossing(C, going) {
  state.crossing = null;
  crossSaid = {};
  const mins = Math.round(C.secs / 6) / 10;
  const P = (state.passages ||= cleanPassages(null));
  if (going !== C.to) {
    hud.toast(`Back in ${going === 'home' ? 'home waters, Gannet Light ahead' : 'Las Brasas’ waters'}. The crossing will keep for a better day.`, 7);
    save();
    return;
  }
  P[going]++;
  const was = P.best[C.kind];
  if (!was || mins < was) P.best[C.kind] = mins;
  noteCrossing(state.today, { to: going, stage: 'in', boat: BOATS[C.kind].name, mins });
  if (going === 'south') {
    const first = !state.tips.brasa;
    state.tips.brasa = true;
    if (first) state.tips.bajonNews = true;
    hud.toast(first
      ? `Landfall: Las Brasas, after ${mins} minutes at the helm. Puerto Brasa is on the island's south side, behind its breakwater: round Punta del Faro, the low point with the lighthouse, and in (the marker shows the way). Bar El Muelle on the waterfront has a room, a stove and a shelf of tackle; the fuel pump is on the quay. The water here is clear and warm: just west of the harbour mouth a yellow buoy marks El Bajón, a reef of lava pinnacles to dive, or look down on from a boat.`
      : `Landfall: Las Brasas, ${mins} minutes at the helm${was && mins < was ? ': your quickest crossing yet' : ''}. Round Punta del Faro for Puerto Brasa.`, first ? 18 : 8);
    crossAfter = { to: 'south', x: HARBOUR_AT.x, z: HARBOUR_AT.z, until: t + 900 };
  } else hud.toast(`Home waters: Gannet Light ahead, ${mins} minutes at the helm across the open sea${was && mins < was ? ': your quickest crossing yet' : ''}. Willowhaven is in past the Skerries.`, 8);
  save();
}
const HARBOUR_AT = { x: PUERTO_AT.x, z: PUERTO_AT.z };

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
const chandleryNear = () => onFoot && !driving && insideHaven(walker.pos.x, walker.pos.z) === 'chandlery';
// Indoors on foot: the house at home, or the chandlery or the inn at Willowhaven.
const indoorsAt = (x, z) => !!(insideHome(x, z) || insideHaven(x, z));
// The chandlery's and the inn's things you use, where you stand at them (see world/havenHouses.js).
const roomSpotNear = () => {
  if (!onFoot || driving) return null;
  const P = walker.pos, room = insideHaven(P.x, P.z);
  if (!room) return null;
  let best = null, bd = Infinity;
  for (const sp of ROOM_SPOTS) {
    if (sp.room !== room) continue;
    const d = Math.hypot(P.x - sp.x, P.z - sp.z);
    if (d < sp.r && d < bd) { bd = d; best = sp; }
  }
  // (Just inside the door: the way out.)
  const R = HAVEN_ROOMS[room];
  if (!best && Math.abs(P.x - R.doorX) < 0.9 && P.z > R.z1 - 1.3) best = { id: 'out', room };
  return best;
};
// The door from the quay, for whichever of the two you're standing at.
const havenDoorNear = () => {
  if (!onFoot || driving) return null;
  for (const R of Object.values(HAVEN_ROOMS)) if (Math.abs(walker.pos.x - R.doorX) < 1.1 && walker.pos.z > R.front + 0.15 && walker.pos.z < R.front + 2.2) return R;
  return null;
};
function goIn(R) {
  walker.place(R.doorX, R.z1 - 0.9, Math.PI);
  audio.door?.(true);
  if (R.id === 'inn') teach('innIn', 'The Lobster Pot: Ruth at the bar (a pint, a story, what’s biting), tonight’s wanted fish on the kitchen board, a seat by the fire.', 9);
  else teach('chandleryIn', 'The chandlery: Bert’s counter at the back (ice, bait, creels, mending), free tackle along the left wall, and the dive compressor by the window.', 9);
}
function goOut(R) {
  walker.place(R.doorX, R.front + 1.0, 0);
  audio.door?.(true);
}
// (Behind the counter or the bar, or not: if not, the bell on it brings them down.)
const atPost = (id, spot) => town.people[id]?.block?.spot === spot && town.people[id].act !== 'walk';
function ringFor(id, where, tab = null) {
  audio.tone?.({ type: 'triangle', freq: 2350, dur: 0.6, gain: 0.05, attack: 0.001 });
  hud.toast(id === 'bert' ? 'You ring the bell on the counter. Bert comes down the stairs in his slippers: “Now then. What can I do you for?”' : 'You ring the bell on the bar. Ruth comes through from the back, drying her hands: “Sorry, love. What’ll it be?”', 5);
  openHarbour(where, tab);
}
const ROOM_ACTS = {
  counter: () => (atPost('bert', 'shopCounter') ? { text: 'Bert’s counter: ice, bait, creels, mending, advice', run: () => openHarbour('chandlery') } : { text: 'Ring the bell on the counter for Bert', run: () => ringFor('bert', 'chandlery') }),
  tackle: () => ({ text: 'The tackle: help yourself (free)', run: () => openPack('chandlery') }),
  air: () => ({ text: state.dive.tank >= SCUBA.full - 0.5 ? 'The dive compressor: your tank is full' : 'The dive compressor: fill your tank', run: () => (state.dive.tank >= SCUBA.full - 0.5 ? hud.flash(`Your tank is full: ${SCUBA.full} bar.`, t, 2.5) : fillTank()) }),
  bar: () => (atPost('ruth', 'innBar') ? { text: 'The bar: a pint, a story, what’s biting', run: () => openHarbour('inn') } : { text: 'Ring the bell on the bar for Ruth', run: () => ringFor('ruth', 'inn') }),
  pass: () => ({ text: 'The kitchen pass: what Ruth wants tonight, and a meal', run: () => (atPost('ruth', 'innBar') ? openHarbour('inn', 'kitchen') : ringFor('ruth', 'inn', 'kitchen')) }),
  tableW: () => ({ text: 'Sit at the table by the window', run: () => sitDown(innSeat('tableW')) }),
  fire: () => ({ text: 'Sit on the settle by the fire', run: () => sitDown(innSeat('fire')) }),
  out: (sp) => ({ text: sp.room === 'inn' ? 'Out onto the quay' : 'Out of the shop, onto the quay', run: () => goOut(HAVEN_ROOMS[sp.room]) }),
};
// (Each with its own view: down over the settle and the fire from the front, the roof lifted;
// from the bar across your table to the window.)
function innSeat(id) {
  const sp = ROOM_SPOTS.find((q) => q.id === id), R = HAVEN_ROOMS.inn;
  const look = id === 'fire' ? [R.x0 + 1.0, R.y + 0.7, R.z0 + 1.6] : [R.x0 + 1.3, R.y + 0.9, R.z1 - 0.5];
  const cam = id === 'fire' ? [R.x0 + 1.4, R.y + 3.6, R.z1 + 1.0] : [R.x0 + 3.7, R.y + 1.85, R.z1 - 2.0];
  return { kind: 'inn', spot: id, x: sp.seat.x, z: sp.seat.z, heading: sp.seat.heading, h: 0.45, look, cam, name: id === 'fire' ? 'by the fire in The Lobster Pot' : 'at a table in The Lobster Pot' };
}
// The head of the quay, where a boat can be brought round to.
const QUAY_HEAD = { x: (HAVEN_QUAY.x0 + HAVEN_QUAY.x1) / 2, z: HAVEN_QUAY.z0 + 3 };
const quayHeadNear = () => onFoot && Math.hypot(walker.pos.x - QUAY_HEAD.x, walker.pos.z - QUAY_HEAD.z) < 3;
// At the harbour office's hatch (or the head of the quay beside it).
const OFFICE_HATCH = { x: HARBOUR_OFFICE.x, z: HARBOUR_OFFICE.z + HARBOUR_OFFICE.d / 2 + 0.7 };
const officeNear = () => onFoot && (Math.hypot(walker.pos.x - OFFICE_HATCH.x, walker.pos.z - OFFICE_HATCH.z) < 2.4 || quayHeadNear());

/* ---- the notice board ---- */

function openBoard() {
  if (modal) return;
  modal = 'board';
  $('board').hidden = false;
  audio.page();
  renderBoard();
  teach('board', 'The board reads the water itself: the wind and sea, which fish are busy round the harbour, where gulls are diving. Under it, Work: jobs for the harbour’s people, a new board each day, and plenty that isn’t fishing.', 9);
}
function closeBoard() {
  $('board').hidden = true;
  if (modal === 'board') modal = null;
}
function renderBoard() {
  const sky = weather.rain > 0.6 ? 'Heavy rain' : weather.rain > 0.15 ? 'Light rain' : weather.cloud > 0.7 ? 'Overcast' : weather.cloud > 0.3 ? 'Some cloud' : 'Clear';
  $('board-sub').textContent = `${formatClock(clock.hour)} · day ${state.day}`;
  renderJobs();
  const p = (text, cls = '') => {
    const e = document.createElement('p');
    if (cls) e.className = cls;
    e.textContent = text;
    return e;
  };
  $('board-weather').replaceChildren(...[seasonLine(clock.abs), ...outlook(clock.abs), ...weatherLines(sky, clock.abs)].map((l) => p(l)));
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
  const sky = weather.rain > 0.15 ? 'Cloud drags across the top, and the coast comes and goes through it.' : clock.hour < 6 || clock.hour > 21 ? 'Below, the lights: Willowhaven’s quay, the lighthouse turning out on Gannet Isle.' : 'The whole coast is laid out below: Willow Bay and the Coldwater winding down to it, the Wend estuary, Longmere among its hills, Gannet Isle and the deep water beyond.';
  showNote('Hoarfell', `${first ? 'You pick up a stone on the way to the top, as walkers do, and add it to the cairn.' : 'Another stone on the cairn.'} ${sky}`, 'cairn');
  save();
}

/* ---- the bench, and boats brought round ---- */

/* ---------------- a quiet moment: sitting a while ---------------- */

// Somewhere to sit: the log by the camp fire, your own camp's chair, the armchair at home, the
// bench under the lamp on Willowhaven quay, or back in the boat at anchor. You sit down, the view
// settles on what's in front of you, time drifts by four times as fast, a fire (or the stove)
// warms you through, and now and then a quiet thought: weather on its way, the tide turning, the
// sun going down, the stars, a bird, the day so far, what you've learned. Any key, the stick or a
// tap on the prompt gets you up.
const SIT_SPEED = 4;
let sitting = null;
const _sitPos = new THREE.Vector3(), _sitLook = new THREE.Vector3(), _sitAim = new THREE.Vector3();
// The seat you're standing at, if any: { kind, x, z, heading, h (its height), look: [x, y, z],
// name }.
function seatNear() {
  if (!onFoot || driving || dive) return null;
  const P = walker.pos;
  const S = world.camp.seat, F = world.camp.firePos;
  if (S && Math.hypot(P.x - S.x, P.z - S.z) < 1.3) return { kind: 'fire', x: S.x, z: S.z, heading: Math.atan2(F.x - S.x, F.z - S.z), h: 0.42, look: [F.x, F.y + 0.5, F.z], name: 'by the fire' };
  for (const c of state.camps) {
    const ch = toWorld(c.x, c.z, c.yaw, LAYOUT.chair.x, LAYOUT.chair.z);
    if (Math.hypot(P.x - ch.x, P.z - ch.z) < 0.65) {
      const ahead = toWorld(c.x, c.z, c.yaw, LAYOUT.chair.x, LAYOUT.chair.z + 30);
      return { kind: 'chair', x: ch.x, z: ch.z, heading: c.yaw, h: 0.42, look: [ahead.x, walkHeight(ch.x, ch.z) + 1, ahead.z], name: 'in your camp chair' };
    }
  }
  // (The armchair by the stove faces the south window.)
  if (insideHome(P.x, P.z) === 'house' && Math.hypot(P.x - 121.8, P.z + 77.8) < 1.25) return { kind: 'home', x: 121.8, z: -77.75, heading: 0, h: 0.44, look: [121.5, walker.pos.y + 1.3, -71.5], name: 'in the armchair by the stove' };
  return null;
}
function sitDown(seat) {
  if (sitting || modal || fishing.busy) return;
  if (fishing.lineOut) fishing.cancel();
  if (seat.kind !== 'boat') {
    walker.place(seat.x, seat.z, seat.heading);
    walker.seatH = seat.h;
  }
  if (seat.kind === 'fire' && camp.fireLevel < 0.35) camp.lightFire(2.5);
  sitting = { ...seat, t: 0, next: 5, said: new Set(), sat: 0, tea: false };
  document.body.classList.add('sitting');
  noteSat(state.today, seat.kind, state.hour);
  _sitPos.copy(camera.position);
  camera.getWorldDirection(_sitAim);
  _sitLook.copy(camera.position).addScaledVector(_sitAim, 10);
  hud.chip(`<b>Sitting ${seat.name}</b> · time drifts by · ${scheme() === 'touch' ? 'tap the prompt' : `${K('interact')}, or move,`} to get up`, 6);
}
function standUp() {
  if (!sitting) return;
  sitting = null;
  walker.warmHands = false;
  document.body.classList.remove('sitting');
}
// Each frame while you sit: the pose, the fire kept going, a mug of tea, and a quiet thought now
// and then.
function updateSitting(dt) {
  walker.seat = damp(walker.seat, sitting && sitting.kind !== 'boat' ? 1 : 0, 4, dt);
  if (!sitting) return;
  const S = sitting;
  // (Moved off it, or the boat's under way: you're up.)
  if (S.kind === 'boat' ? (onFoot || Math.abs(boat.speed) > 0.6) : !onFoot) return standUp();
  S.t += dt;
  S.sat += dt / HOUR_SECONDS * SIT_SPEED;
  walker.warmHands = S.kind === 'fire' && state.comfort.warm < 15;
  // (You keep the fire going: a log on now and then, without a word.)
  if (S.kind === 'fire' && camp.fireLevel < 0.6) state.camp.fireUntil = Math.max(state.camp.fireUntil, state.day * 24 + state.hour) + 1;
  if (!S.tea && S.sat > 0.8 && S.kind !== 'boat') {
    S.tea = true;
    mealDrink(state.comfort);
    state.comfort.warm = Math.min(state.comfort.warm + 1.5, 24);
    hud.toast(S.kind === 'home' ? 'The kettle on the stove sings: a mug of tea, hot in your hands.' : S.kind === 'inn' ? 'Ruth brings over a mug of tea and sets it down by you. “On the house.”' : 'The kettle boils on the stove: a mug of tea, hot in your hands.', 6);
    return;
  }
  if ((S.next -= dt) > 0) return;
  S.next = 14 + Math.random() * 8;
  const line = sitThought(S);
  if (line) hud.toast(line, 8);
}
// A quiet thought: the first of these that fits and hasn't come yet this sitting.
function sitThought(S) {
  const abs = clock.abs, h = clock.hour, sun = sunTimes(abs);
  const T = tideAt(abs), was = tideAt(abs - 0.6), toGale = hoursToGale(abs);
  const night = h > sun.set + 0.7 || h < sun.rise - 0.4;
  const page = state.today ? dayPage(state, state.today) : null;
  const known = groundsOf(state.log).flatMap((g) => g.kinds.filter((K) => K.n >= 3).map((K) => ({ place: g.place, K })));
  const tip = known.length ? known[Math.floor(Math.random() * known.length)] : null;
  const where = S.kind === 'boat' ? 'the boat' : S.kind === 'home' ? 'the house' : S.kind === 'inn' ? 'the inn' : 'camp';
  const C = [
    toGale != null && toGale < 8 && ['gale', toGale < 3 ? 'The wind is getting up in gusts, and the sky to the south-west has gone the colour of a bruise. The gale won’t be long.' : 'A long, oily swell has come in from the south-west, and high thin cloud is fanning out across the sky: weather on its way.'],
    weather.rain > 0.3 && ['rain', S.kind === 'fire' ? 'Rain hisses in the fire. You pull your collar up and edge closer.' : S.kind === 'boat' ? 'Rain patters on the boat and rings the water all round.' : 'Rain drums on the roof and runs down the window.'],
    was.phase !== T.phase && (T.phase === 'flood' || T.phase === 'ebb') && ['tide', T.phase === 'flood' ? 'The tide’s turned: it’s making now, creeping back up the shore. The bass and the flatfish will be on the move.' : 'The tide’s turned and started to ebb: the water’s slipping away down the shore.'],
    (T.phase === 'high' || T.phase === 'low') && ['slack', 'Slack water: for a while everything holds still, the boats swinging slowly on their moorings.'],
    Math.abs(h - sun.set) < 0.7 && ['sunset', 'The sun goes down: the water turns copper, then pewter, and the first lamps come on round the bay.'],
    Math.abs(h - sun.rise) < 0.7 && ['dawn', 'First light: the birds start up one by one, and a mist lifts off the water.'],
    night && weather.cloud < 0.4 && ['stars', 'The stars are out: more of them every minute you look, and the Milky Way right across the sky.'],
    night && ['owl', 'An owl calls somewhere up the hill, and another answers from across the water.'],
    !night && S.kind !== 'home' && S.kind !== 'inn' && ['birds', S.kind === 'boat' ? 'A gull drifts down and settles on the water nearby, watching you with one yellow eye.' : 'A curlew calls from the shore, that long, bubbling cry.'],
    page && page.caught + page.dives.length > 0 && ['day', `You think back over the day. ${dayText(page).split('. ').slice(0, 3).join('. ').replace(/\.?$/, '.')}`],
    tip && ['learned', `You go over what you’ve learned. At ${tip.place}: ${groundWords(tip.K).toLowerCase()}`],
    S.kind === 'fire' && ['fire', 'A log shifts and settles in the fire, and a stream of sparks goes up into the dark.'],
    S.kind === 'inn' && ['pub', clock.hour >= 17 || clock.hour < 1 ? 'The bar fills up: boots on the flagstones, the door going, a laugh from the old boys’ corner by the window.' : 'Quiet in here at this hour: Ruth polishing glasses, the clock ticking, someone’s dog asleep under a table.'],
    S.kind === 'inn' && S.spot === 'fire' && ['coal', 'The coal settles in the grate with a soft crunch, and the heat comes up into your face.'],
    S.kind === 'inn' && ['kitchen', 'Something good is going on in the kitchen: onions, butter, the sea smell of fish in a hot pan.'],
    state.comfort.wet > 0.3 && ['drying', 'Your clothes steam gently as they dry.'],
    ['season', { spring: 'There’s a softness in the air: spring, the green coming back.', summer: 'A warm evening: midges dancing over the water, the smell of salt and cut grass.', autumn: 'Leaves blow across the ground: autumn coming on, the evenings drawing in.', winter: 'A cold, clear stillness: winter, and the year asleep.' }[seasonOf(state.day).name]],
    ['quiet', `Nothing to do and nowhere to be. The ${where === 'camp' ? 'water laps at the shore' : where === 'the boat' ? 'water knocks softly at the hull' : where === 'the inn' ? 'clock over the bar ticks on' : 'stove ticks as it warms'}.`],
  ].filter(Boolean);
  const pickOne = C.find(([id]) => !S.said.has(id));
  if (!pickOne) return null;
  S.said.add(pickOne[0]);
  if (pickOne[0] === 'owl') audio.owl?.(0.5, 0.3);
  if (pickOne[0] === 'birds' && S.kind !== 'boat') audio.curlew?.(0.4, -0.3);
  return pickOne[1];
}
// The view while you sit: over your shoulder at what's in front of you, drifting slowly round.
function sitCamera(dt) {
  const S = sitting;
  let cx, cy, cz, lx, ly, lz;
  const drift = Math.sin(S.t * 0.045) * 0.35;
  if (S.kind === 'boat') {
    const a = boat.heading + Math.PI + 0.2 + drift * 0.5;
    cx = boat.pos.x + Math.sin(a) * 6.5;
    cz = boat.pos.z + Math.cos(a) * 6.5;
    cy = 2.4;
    lx = boat.pos.x + Math.sin(boat.heading) * 30;
    lz = boat.pos.z + Math.cos(boat.heading) * 30;
    ly = -0.5;
  } else if (S.cam) {
    [cx, cy, cz] = S.cam;
    cx += drift * 0.6;
    [lx, ly, lz] = S.look;
  } else {
    const a = S.heading + Math.PI + 0.6 + drift, d = S.kind === 'home' || S.kind === 'inn' ? 1.9 : 3.3;
    cx = S.x + Math.sin(a) * d;
    cz = S.z + Math.cos(a) * d;
    cy = walker.pos.y + (S.kind === 'home' || S.kind === 'inn' ? 1.45 : 1.85);
    [lx, ly, lz] = S.look;
  }
  cy = Math.max(cy, heightAt(cx, cz) + 0.5, waveHeight(cx, cz, t) + 0.5);
  const k = 1 - Math.exp(-1.6 * dt);
  _sitPos.lerp(_sitAim.set(cx, cy, cz), k);
  _sitLook.lerp(_sitAim.set(lx, ly, lz), k);
  camera.position.copy(_sitPos);
  camera.lookAt(_sitLook);
}

function sitOnBench() {
  const h = state.hour;
  const line = h < 6 ? 'The harbour is asleep: just the lamp, and the water knocking at the quay.' : h < 11 ? 'Gulls on the quay wall, and the smell of tar and rope.' : h < 17 ? 'The boats nod at their moorings; someone has left a coil of rope drying on the wall.' : h < 21 ? 'The light goes gold over the bay, and the lamp comes on behind you.' : 'Stars over the bay, and the lamp’s circle of light round the bench.';
  const opts = [{ text: 'An hour', hours: 1 }];
  if (h < 17.5) opts.push({ text: 'Until golden hour', to: 18.5 });
  if (h < 20.5 && h > 4) opts.push({ text: 'Until dark', to: 21.5 });
  if (h >= 20 || h < 4.5) opts.push({ text: 'Until first light', to: 5.2 });
  ask('The bench by the lamp', `${line} Sit a while?`, [
    { text: 'Get up again', cls: 'quiet' },
    { text: 'Just sit and watch', cls: 'quiet', run: () => sitDown({ kind: 'bench', x: HAVEN_BENCH.x, z: HAVEN_BENCH.z + 0.1, heading: HAVEN_BENCH.yaw, h: 0.45, look: [HAVEN_BENCH.x + 6, 0.5, HAVEN_BENCH.z + 60], name: 'on the bench' }) },
    ...opts.map((o) => ({ text: o.text, run: () => waitAWhile(o.hours ?? ((o.to - state.hour + 24) % 24), 'You sit and watch the harbour…') })),
  ]);
}

let waiting = null;
function waitAWhile(hours, text) {
  if (modal || fishing.busy) return;
  if (clock.following) {
    hud.toast(timeIsHosts(), 6);
    return;
  }
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
  // (At home, one of the Willowhaven boats goes to your own finger.)
  if (!south && homeOf(b.kind) === 'harbour') {
    const p = freeOwnBerth(b), B = berthFor({ hull: b.hull, pos: { x: p.x, z: p.z }, heading: p.heading }, others);
    if (B) return B;
  }
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
function boatsRound(here = regionOf(player())) {
  const south = here === 'south';
  const atHand = (b) => (south ? Math.hypot(b.pos.x - PONTOON_S.x0, b.pos.z - 6320) < 45
    : Math.hypot(b.pos.x - QUAY_HEAD.x, b.pos.z - HAVEN_QUAY.z1) < 14 || (homeOf(b.kind) === 'harbour' && inMarina(b.pos)));
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

// The harbour office at Willowhaven: your boats, which are in the water and where, and which are
// laid up (see fleet.js); one put in the water, or laid up, or brought round.
function whereWords(b) {
  if (regionOf(b) === 'south') return 'at Las Brasas';
  if (b.tie && PIERS[b.tie.pier] === OWN_FINGER) return 'on your finger';
  if (b.tie && VISITOR_FINGERS.includes(PIERS[b.tie.pier])) return 'at the visitors’ pontoon';
  if (inMarina(b.pos)) return 'in the harbour';
  if (Math.hypot(b.pos.x - LANDING.x, b.pos.z - LANDING.z) < 40) return 'at the camp';
  if (b.kind === 'bass') return 'on Longmere';
  return 'out on the water';
}
const canStore = (b) => !(b === boat && !onFoot) && regionOf(b) === 'home' && !(tow && (tow.lead === b || tow.towed === b)) && !(state.shipping || []).some((s) => s.kind === b.kind);
function harbourOffice() {
  const laid = KINDS.filter(isStored).filter((k) => usableBoat(state.yard, k, state.day, ownAbs())).map((k) => BOATS[k]);
  const south = boats.some((b) => b.kind !== 'bass' && regionOf(b) === 'south');
  // (Wenna at the hatch in office hours; out of them, the yard's board beside it does as well.)
  const W = town.people.wenna, inOffice = W?.block?.spot === 'office' && W.act === 'inside';
  const greet = inOffice ? 'Wenna Penhallow, the harbourmaster, looks up from her ledger. ' : W?.block?.spot === 'gangway' ? 'Wenna’s down at the gangway looking over the pontoon; the board by the hatch does as well. ' : 'The hatch is shut for the night, but the yard’s board beside it sees to your boats all the same. ';
  ask('The harbour office', `${greet}In the water (${boats.length} of ${MAX_AFLOAT}): ${boats.map((b) => `the ${b.name}, ${whereWords(b)}`).join('; ')}.${laid.length ? ` Laid up: ${laid.map((b) => `the ${b.name}`).join(', ')}.` : ''}${state.trailer.boat ? ` On your trailer: the ${BOATS[state.trailer.boat].name}.` : ''}`, [
    { text: 'Never mind', cls: 'quiet' },
    ...(laid.length ? [{ text: 'Put a boat in the water…', run: () => chooseLaunch() }] : []),
    ...(boats.length > 1 ? [{ text: 'Lay a boat up…', run: () => chooseStore() }] : []),
    { text: south ? 'Bring one round, or ship one from Las Brasas…' : 'Bring a boat round…', cls: 'quiet', run: () => boatsRound('home') },
    { text: 'Willowhaven Marine Works: buy, hire, paint, fit out…', run: () => openHarbour('works') },
  ]);
}
function chooseStore() {
  const can = boats.filter(canStore);
  if (!can.length) {
    hud.toast('None of your boats can be laid up just now: not one at Las Brasas, on the supply ship, on a towline, or the one you’re in.', 5);
    return;
  }
  ask('Lay a boat up', 'Which one comes out of the water? She’s fetched if she’s lying somewhere else, and kept where she lives until you want her.', [
    { text: 'Never mind', cls: 'quiet' },
    ...can.map((b) => ({ text: `The ${b.name} (${whereWords(b)})`, run: () => storeBoat(b) })),
  ]);
}
function chooseLaunch() {
  const laid = KINDS.filter(isStored).filter((k) => usableBoat(state.yard, k, state.day, ownAbs())).map((k) => BOATS[k]);
  ask('Put a boat in the water', boats.length >= MAX_AFLOAT ? `Three of your boats are in the water already, so one of them is laid up in her place.` : 'Which one?', [
    { text: 'Never mind', cls: 'quiet' },
    ...laid.map((b) => ({ text: `The ${b.name}`, run: () => launchBoat(b) })),
  ]);
}
// What the Marine Works has done to your boats (see shipyard.js): fittings (a long-range tank, a
// bigger outboard), paint, and her name on her bow.
const YARD_BASE = { tanks: { ...TANKS }, burn: { ...BOAT_PER_S }, thrust: Object.fromEntries(KINDS.map((k) => [k, BOATS[k].hull.motor?.thrust])) };
function applyYard() {
  const f = tanks();
  for (const k of KINDS) {
    const e = fitEffect(state.yard, k), b = BOATS[k];
    if (YARD_BASE.tanks[k]) TANKS[k] = Math.round(YARD_BASE.tanks[k] * e.tank);
    if (YARD_BASE.burn[k]) BOAT_PER_S[k] = YARD_BASE.burn[k] * e.burn;
    const M = b.hull.motor;
    if (M && YARD_BASE.thrust[k]) M.thrust = YARD_BASE.thrust[k] * e.thrust;
    // (A boat with an engine catalogue, the RIB: the engine and propeller chosen for her, on her
    // alone: her push, the outboard drawn, its revs, its sound and its fuel. See engines.js.)
    if (hasCatalogue(k)) {
      const S = engineSpec(k, b.hull, engineOf(state.yard, k));
      b.setMotor(S);
      BOAT_PER_S[k] = YARD_BASE.burn[k] * e.burn * S.burn;
      WOT[k] = S.rpm;
      // (An electric outboard: a button to start it, its own battery for fuel. See engine.js and
      // fuel.js elec.)
      setElectric(k, S.electric ? S.rpm : 0);
      ELEC[k] = S.electric ? S.endure : 0;
    }
    if (isPetrol(k) && fuelLevel(f, k) > TANKS[k]) addFuel(f, k, TANKS[k] - fuelLevel(f, k));
    const L = state.yard.looks[k] || {}, hex = (id) => (id ? PAINTS.find((p) => p.id === id)?.hex : null);
    b.repaint(hex(L.paint));
    if ((L.name || '') !== (b.boatName || '')) b.setName(L.name || '');
    // (Her stripe or a RIB's tubes, and a flag at her stern: see papers.js.)
    b.restripe?.(hex(L.stripe));
    b.retube?.(hex(L.tubes));
    if ((b.flagId || null) !== (L.flag || null) || L.flag === 'own') b.setFlag?.(flagById[L.flag] || null, { paint: hex(L.paint), stripe: hex(L.stripe) });
    // (Her cargo as the save has it: see cargo.js. Then what she carries, how hard her anchor
    // holds, and her fittings to see.)
    b.setCargo(piecesAboard(state.cargo ||= newCargo(), k, tanks().can.at).map((p) => ({ ...p, carried: carrying?.kind === k && carrying.key === p.key })));
    b.setLoads(loadsOf(k, e));
    b.anchorHold = e.hold;
    b.setFits?.(e.list);
    trollOf(b);
  }
}
// What a boat carries beyond her own weight as built, and where (boat.js setLoads, loadPlace):
// each of her fittings where it's fitted; an engine from the catalogue at her transom (lighter or
// heavier than her own); her fuel at her tank (past what her standard tank holds full, heavier;
// with less than that in it, lighter); passengers, freight and anything else aboard for a job or
// the story, in her cockpit. She trims and heels to it all.
function loadsOf(k, e = fitEffect(state.yard, k)) {
  const b = BOATS[k], L = [], fuelKg = ENGINES[k]?.diesel ? 0.84 : 0.74;
  for (const id of e.list) if (FITS[id]?.kg) L.push({ what: id, kg: FITS[id].kg, p: b.loadPlace(id) });
  if (b.motorSpec?.kg) L.push({ what: 'engine', kg: b.motorSpec.kg, p: b.loadPlace('engine') });
  if (YARD_BASE.tanks[k]) L.push({ what: 'fuel', kg: (fuelLevel(tanks(), k) - YARD_BASE.tanks[k]) * fuelKg, p: b.loadPlace('fuel') });
  const aboard = Con.aboardKg(state.contracts, k) + Story.storyKg(state.story, k);
  if (aboard) L.push({ what: 'aboard', kg: aboard, p: b.loadPlace('cockpit') });
  // (Her cargo, each piece where it sits on her deck, or in your hands: see cargo.js. Its `p` is
  // the boat's own, moving as it slides.)
  for (const pc of b.cargo || []) L.push({ what: pc.id, kg: cargoKg(pc, tanks().can.litres), p: pc.p });
  return L;
}
applyYard();
jobWeight();
wearLook();

// A day's hire over: she goes back to the yard (once you're out of her).
function watchHire() {
  const H = state.yard.hired;
  if (!H || hiredToday(state.yard, H.kind, state.day, ownAbs())) return;
  const b = BOATS[H.kind];
  if (!onFoot && boat === b) return;
  state.yard.hired = null;
  if (!b.stowed) {
    if (boats.length <= 1) launchBoat(BOATS.row, { quiet: true });
    stow(b);
    state.stored = [...new Set([...state.stored, b.kind])];
  }
  hud.toast(`The ${b.name} has gone back to the Marine Works: your day’s hire is up. Buy her there whenever you like.`, 6);
  save();
}

/* ---------- the boat trailer (see trailer.js) ---------- */

// Hitched, or standing by the garage; and a boat on it sits on its bunks wherever it goes.
car.setTrailer(state.trailer.hitched ? true : TRAILER_HOME);
const _trailerAt = { x: 0, z: 0, y: 0, yaw: 0, pitch: 0 };
function trailerBoatStep() {
  const k = state.trailer.boat;
  if (!k) return;
  const b = BOATS[k], T = car.trailerSpot(_trailerAt);
  b.group.visible = car.trailer.visible;
  b.group.position.set(T.x, T.y + 0.6, T.z);
  b.group.rotation.set(T.pitch, T.yaw, 0, 'YXZ');
}
trailerBoatStep();
// What you can do at the trailer, standing beside it.
function trailerAct(P) {
  if (!car.trailer.visible || driving) return null;
  const T = car.trailerSpot(_trailerAt);
  if (Math.hypot(P.x - T.x, P.z - T.z) > 2.6) return null;
  if (!state.trailer.hitched) {
    const close = Math.hypot(car.pos.x - TRAILER_HOME.x, car.pos.z - TRAILER_HOME.z) < 20;
    return close ? { text: 'Hitch the trailer to the car', run: () => hitchTrailer(true) }
      : { text: 'The boat trailer', run: () => hud.toast('Bring the car round to hitch it up. It takes a small boat (kayak, rowing boat, skiff, bass boat or jet ski) to any water the car can reach.', 6) };
  }
  const b = state.trailer.boat ? BOATS[state.trailer.boat] : null;
  return { text: b ? `The trailer: the ${b.name}` : 'The trailer', run: () => trailerChoices() };
}
function hitchTrailer(on) {
  state.trailer.hitched = on;
  car.setTrailer(on ? true : TRAILER_HOME);
  audio.knock(0.3);
  hud.toast(on ? 'The trailer’s hitched on. Back it down to the water with a boat to launch, or bring one in to load: from the slipway at Willowhaven, the strand, Wend Quay or the Mere Boathouse.' : 'The trailer’s unhitched, back by the garage.', 6);
  save();
}
function trailerChoices() {
  const T = car.trailerSpot(_trailerAt), k = state.trailer.boat, b = k ? BOATS[k] : null;
  const home = Math.hypot(T.x - TRAILER_HOME.x, T.z - TRAILER_HOME.z) < 25;
  const opts = [{ text: 'Never mind', cls: 'quiet' }];
  let text;
  if (b) {
    const spot = launchSpot(depthAt, T.x, T.z, T.yaw);
    if (!spot) text = `The ${b.name} is on the trailer. There’s no water close enough to launch her here: back the trailer down to the water’s edge (a slipway, a beach, a quay).`;
    else if (boats.length >= MAX_AFLOAT) text = `The ${b.name} is on the trailer, but three of your boats are in the water already: bring one in onto the trailer, or lay one up at the harbour office, first.`;
    else {
      text = `The ${b.name} is on the trailer, and there’s water to launch her ${spot.r < 8 ? 'right behind it' : `${Math.round(spot.r)} metres off`}.`;
      opts.push({ text: `Launch the ${b.name}`, run: () => launchOffTrailer(b, spot) });
    }
  } else {
    const near = loadable(boats.map((o) => ({ kind: o.kind, pos: o.pos, aboard: o === boat && !onFoot, towing: !!(tow && (tow.lead === o || tow.towed === o)), o })), T.x, T.z);
    const shown = near.filter((n) => regionOf(n.o) === 'home');
    text = shown.length ? 'Which boat comes out onto it? (She’s brought in to the bank and winched up.)' : `Nothing to load here: bring a small boat (${TRAILABLE.map((t) => BOATS[t]?.name).filter(Boolean).join(', ')}) in close to the trailer, and step ashore.`;
    if (shown.length && boats.length <= 1) text = 'She’s your only boat in the water: put another in first.';
    else for (const n of shown) opts.push({ text: `The ${n.o.name}`, run: () => loadOnTrailer(n.o) });
    if (home) opts.push({ text: 'Unhitch it here', cls: 'quiet', run: () => hitchTrailer(false) });
  }
  ask('The boat trailer', text, opts);
}
function loadOnTrailer(b) {
  if (state.trailer.boat || boats.length <= 1) return;
  stow(b);
  state.trailer.boat = b.kind;
  // (Not the boat you'd go back to any more: the nearest of the others in the water is.)
  if (boat === b) switchBoat(boats.reduce((best, o) => (!best || Math.hypot(o.pos.x - walker.pos.x, o.pos.z - walker.pos.z) < Math.hypot(best.pos.x - walker.pos.x, best.pos.z - walker.pos.z) ? o : best), null));
  passTime(0.25);
  audio.knock(0.4);
  trailerBoatStep();
  hud.toast(`The ${b.name} is out of the water and on the trailer, strapped down. She goes where the car goes.`, 6);
  save();
}
function launchOffTrailer(b, spot) {
  if (boats.length >= MAX_AFLOAT) return;
  state.trailer.boat = null;
  unstow(b);
  b.group.rotation.set(0, b.heading, 0, 'XYZ');
  b.tie = null;
  b.place(spot.x, spot.z, spot.heading);
  passTime(0.25);
  audio.knock(0.4);
  hud.toast(`The ${b.name} is in the water, off the trailer: step aboard and away.`, 6);
  save();
}

// Out of the water: fetched by the yard if she's lying somewhere else, then kept where she lives.
function storeBoat(b, { quiet = false } = {}) {
  if (!canStore(b) || boats.length <= 1) return false;
  const home = homeOf(b.kind) === 'harbour' ? OWN_FINGER : mooring(b.kind);
  const far = Math.hypot(b.pos.x - (home.x ?? (home.x0 + home.x1) / 2), b.pos.z - (home.z ?? (home.z0 + home.z1) / 2));
  stow(b);
  state.stored = [...new Set([...state.stored, b.kind])];
  // (Not the boat you'd go back to any more: the nearest of the others in the water is.)
  if (boat === b) switchBoat(boats.reduce((best, o) => (!best || Math.hypot(o.pos.x - walker.pos.x, o.pos.z - walker.pos.z) < Math.hypot(best.pos.x - walker.pos.x, best.pos.z - walker.pos.z) ? o : best), null));
  if (!quiet) {
    passTime(clamp(0.3 + far / 600, 0.3, 1.5));
    audio.knock(0.35);
    hud.toast(`The ${b.name} is out of the water, ${STORE_WORDS[homeOf(b.kind)]}.`, 5);
  }
  save();
  return true;
}
// Back in the water: hers is a berth on your finger (or the camp's landing, or the boathouse
// jetty). With three in the water already, one goes ashore in her place.
function launchBoat(b, { quiet = false } = {}) {
  if (!b.stowed) return false;
  if (boats.length >= MAX_AFLOAT) {
    if (quiet) return false;
    const can = boats.filter(canStore);
    if (!can.length) {
      hud.toast('Three of your boats are in the water, and none of them can be laid up just now.', 5);
      return false;
    }
    ask(`The ${b.name} in the water`, 'Three of your boats are in the water already. Which one is laid up in her place?', [
      { text: 'Never mind', cls: 'quiet' },
      ...can.map((o) => ({ text: `Lay up the ${o.name} (${whereWords(o)})`, run: () => storeBoat(o, { quiet: true }) && launchBoat(b) })),
    ]);
    return false;
  }
  state.stored = state.stored.filter((k) => k !== b.kind);
  unstow(b);
  if (!quiet) {
    passTime(0.4);
    audio.knock(0.4);
    const where = homeOf(b.kind) === 'harbour' ? 'tied up on your finger of the pontoon (the second out, with your name on it): down the gangway and out along it' : LAUNCH_WORDS[homeOf(b.kind)];
    hud.toast(`The ${b.name} is in the water, ${where}.`, 7);
  }
  save();
  return true;
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
    // (Not the boat you're in: she stays with you, and the order's cancelled; nor one laid up.)
    if (!b || b.stowed || (b === boat && !onFoot)) continue;
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
  // (Gulls diving on a shoal in the picture. Not called birds: that's the birds of the coast, below.)
  const gulls = world.flocks.some((f) => Math.hypot(f.x - c.x, f.z - c.z) < 320 && _frustum.containsPoint(_pv.set(f.x, 12, f.z)));
  // The Kittiwake's bell, close enough to make out, under the water.
  const by = heightAt(WRECK_BELL.x, WRECK_BELL.z) + 0.2;
  const bell = under && Math.hypot(WRECK_BELL.x - c.x, by - c.y, WRECK_BELL.z - c.z) < 7 && _frustum.containsPoint(_pv.set(WRECK_BELL.x, by, WRECK_BELL.z));
  // The wildlife in the picture (see wildlife.js).
  const life = [...wildlife.inFrame(_frustum, c), ...birds.inFrame(_frustum, c)];
  // (And the sea's: dolphins, whales, seals and turtles near enough, and a pod on your own bow.)
  const sea = sealife.inFrame(_frustum, c, together.active ? [together.id, crew.on?.id].filter(Boolean) : 'me');
  // (The rockpools' life, in a picture of one: the naturalist's notes' kinds.)
  const pooled = rockpools.inFrame(_frustum, c, clock.abs);
  for (const id of pooled.fish) species.add(id);
  const nature = [...new Set([...(extra?.nature || []), ...pooled.nature])].slice(0, 12);
  return { species: [...species].slice(0, 12), places: places.slice(0, 12), birds: gulls, ...(nature.length ? { nature } : {}), ...(bell ? { bell: true } : {}), ...(life.length ? { life } : {}), ...(sea.life.length ? { sea: sea.life } : {}), ...(sea.bow ? { bow: true } : {}) };
}

function openPhoto() {
  if (modal || !started) return;
  if (fishing.aiming) fishing.cancel();
  modal = 'photo';
  photoFov = camera.fov;
  hud.hidden(true);
  $('photo-frame').hidden = false;
  $('pf-hint').textContent = { touch: 'Drag to look, pinch to zoom', pad: 'R-stick to look · D-pad ↑ ↓ to zoom · A takes it · Y binoculars · B puts the camera away' }[scheme()]
    || `Drag to look · mouse wheel to zoom · ${input.keyLabel('cast')} or ${input.keyLabel('photo')} takes it · ${input.keyLabel('binoculars')} binoculars · Esc puts the camera away`;
  teach('photoMode', `Photo mode: frame your picture and take it. Under the water (${scheme() === 'touch' ? 'the eye button, from a boat' : input.keyLabel('view')}) you can photograph the fish themselves. Your album is in the journal, under Memories.`, 8);
}
function closePhoto() {
  $('photo-frame').hidden = true;
  camera.fov = photoFov;
  camera.updateProjectionMatrix();
  hud.hidden(hudOff);
  if (modal === 'photo') modal = null;
}
// The binoculars (U, or from photo mode): a narrow view through your own eyes, two circles, and
// whatever bird or animal you hold steady in the middle named, and noted.
let binocs = null;
const SPECIES = new Map(allSpecies().map((e) => [e.key, e]));
function openBinoculars() {
  if (modal === 'photo') closePhoto();
  if (modal || !started || dive || driving) return;
  if (fishing.aiming) fishing.cancel();
  modal = 'binocs';
  binocs = { fov: camera.fov, zoom: 7, first: rig.mode === 'eye', on: null, held: 0, shown: null, t: 0, idT: 0 };
  if (!binocs.first) rig.setFirstPerson(true, t);
  rig.binocs = true; // (you can look right up, for the birds overhead)
  hud.hidden(true);
  $('binocs').hidden = false;
  $('bn-name').textContent = $('bn-sci').textContent = $('bn-new').textContent = '';
  $('binocs').classList.remove('named');
  $('bn-hint').textContent = { touch: 'Drag to look · pinch to focus further · hold something steady in the middle to name it', pad: 'R-stick to look · Y or B to lower them · hold a bird steady in the middle to name it' }[scheme()]
    || `Drag or ${input.keyLabel('forward')}${input.keyLabel('left')}${input.keyLabel('back')}${input.keyLabel('right')} to look · mouse wheel to focus further · hold a bird steady in the middle to name it · ${input.keyLabel('binoculars')} or Esc to lower them`;
  teach('binoculars', 'Binoculars: hold a bird (or a whale, a dolphin, a seal) steady in the middle and it’s named, and goes in the journal’s Species pages.', 7);
}
function closeBinoculars() {
  $('binocs').hidden = true;
  if (binocs) {
    camera.fov = binocs.fov;
    camera.updateProjectionMatrix();
    if (!binocs.first) rig.setFirstPerson(false, t);
  }
  rig.binocs = false;
  binocs = null;
  hud.hidden(hudOff);
  if (modal === 'binocs') modal = null;
}
function binocularsLook(dt, drag, wheel) {
  const k = camera.fov / Math.max(1, binocs.fov);
  rig.input({ x: drag.x * k, y: drag.y * k }, 0, t);
  // (The keys look too: across, and up and down.)
  if (input.steer) rig.turn(input.steer * k * 0.9, dt, t);
  const v = rig.views.eye;
  if (input.throttle && v) v.pitch = clamp(v.pitch - input.throttle * 0.9 * k * dt, -1.2, 1.2);
  // (Wheel up, or pinch out: further in.)
  if (wheel) binocs.zoom = clamp(binocs.zoom - wheel * 0.004, 4, 14);
}
const _bnDir = new THREE.Vector3();
function binocularsStep(dt) {
  const B = binocs;
  // (Steady at their own magnification, whatever the window does.)
  const fov = clamp(binocs.fov / B.zoom, 3.5, 14);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  if ((B.t -= dt) > 0) return;
  B.t = 0.12;
  camera.getWorldDirection(_bnDir);
  const c = camera.position;
  const best = [birds.spot(c, _bnDir), sealife.spot?.(c, _bnDir), wildlife.spot?.(c, _bnDir), world.gullSpot?.(c, _bnDir)].filter(Boolean).sort((a, b) => a.off / (a.tol || 1) - b.off / (b.tol || 1))[0] || null;
  const kind = best?.kind || null;
  if (kind && kind === B.on) B.held += 0.12;
  else {
    B.on = kind;
    B.held = 0;
  }
  $('binocs').classList.toggle('focus', !!kind);
  // Held steady half a second: named, and noted.
  if (kind && B.held >= 0.45 && B.shown !== kind) {
    B.shown = kind;
    B.idT = 3;
    const e = SPECIES.get(`sea:${kind}`), fresh = !state.seaLife?.[kind] || state.seaLife[kind].heard;
    $('bn-name').textContent = e?.name || SEA_LIFE[kind]?.name || kind;
    $('bn-sci').textContent = e?.sci || '';
    $('bn-new').textContent = fresh ? 'New to your journal' : `${Math.round(best.d)} m off`;
    $('binocs').classList.add('named');
    seeSeaLife(kind, c.x + _bnDir.x * best.d, c.z + _bnDir.z * best.d);
    if (fresh) audio.chime?.();
    // (A seabird count for the Trust: each kind named counts. See contracts.js noted.)
    jobsDone(Con.noted(state.contracts, 'binoculars', kind, BIRD_KINDS.includes(kind)));
  }
  // (The name stays a moment after it's gone from the middle.)
  if (!kind) {
    B.idT -= 0.12;
    if (B.idT <= 0 && B.shown) {
      B.shown = null;
      $('binocs').classList.remove('named');
    }
  }
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
  const life = [...(subjects.life || []).map((k) => SEA_LIFE[k]?.name.toLowerCase()), ...(subjects.nature || []).map((k) => NATURE[k]?.name.toLowerCase())].filter(Boolean);
  $('pc-text').textContent = [subjects.bell ? 'The Kittiwake’s bell, where it lies.' : '', sp.length ? `In the picture: ${sp.join(', ')}.` : '', life.length ? `Wildlife: ${life.join(', ')}.` : '', pl.length ? `${pl.slice(0, 4).join(', ')}.` : '', subjects.birds ? 'Gulls diving.' : ''].filter(Boolean).join(' ') || 'A quiet moment.';
  photoReturn = from === 'rockpool' ? 'rockpool' : null;
  if (from !== 'catch') modal = 'photocard';
  $('photo-card').hidden = false;
}
// (A photograph of a rockpool: back to the pool after.)
let photoReturn = null;
function afterPhotoCard() {
  if (modal === 'photocard') modal = photoReturn;
  if (photoReturn === 'rockpool' && poolOpenNow) {
    $('rockpool').hidden = false;
    renderPool();
  }
  photoReturn = null;
}
async function keepPhoto() {
  const pp = pendingPhoto;
  if (!pp) return;
  pendingPhoto = null;
  $('photo-card').hidden = true;
  afterPhotoCard();
  const id = photoId();
  await photos.put(id, pp.shot.blob, pp.shot.thumb);
  const meta = { id, title: $('pc-title').value.replace(/[<>]/g, '').trim().slice(0, 60), at: Date.now(), day: state.day, hour: Math.round(state.hour * 100) / 100, ...pp.meta, sky: weather.state, subjects: pp.subjects };
  state.photos.push(meta);
  adventures.photographed(meta);
  favoursReady(favourPhotographed(state.favours, meta.subjects));
  jobsDone(Con.photographed(state.contracts, { life: meta.subjects?.sea || [], bow: !!meta.subjects?.bow, species: meta.subjects?.species || [], nature: meta.subjects?.nature || [], wild: meta.subjects?.life || [] }));
  save();
  hud.toast(`Kept in your album (${state.photos.length} of ${PHOTO_MAX}).${photos.persistent ? '' : ' This browser won’t keep it after you close the tab: download it from the journal.'}`, 4);
}
function discardPhoto() {
  pendingPhoto = null;
  $('photo-card').hidden = true;
  afterPhotoCard();
}
$('pf-take').addEventListener('click', () => takePhoto());
$('rp-turn').addEventListener('click', () => poolTurn());
$('rp-net').addEventListener('click', () => poolNet());
$('rp-photo').addEventListener('click', () => poolPhoto());
$('rp-leave').addEventListener('click', () => closePool());
$('pf-binocs').addEventListener('click', () => openBinoculars());
$('bn-close').addEventListener('click', () => closeBinoculars());
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
  const abs = clock.abs, P = player().pos;
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
  watchStory();
}
// The Fifth Name (see story.js): what it reads of the world, and what it says back.
function watchStory() {
  const S = state.story;
  if (Story.finished(S)) return;
  const P = player().pos, afloat = !onFoot && !driving && !dive;
  const pu = placeOf('puerto'), lt = placeOf('light'), sun = sunTimes(clock.abs);
  const r = Story.tick(S, {
    adv: state.adventures, when: { day: state.day, hour: Math.round(state.hour * 100) / 100 },
    near: {
      light: lt ? Math.hypot(P.x - lt.x, P.z - lt.z) : Infinity, puerto: pu ? Math.hypot(P.x - pu.x, P.z - pu.z) : Infinity,
      office: Math.hypot(P.x - HARBOUR_OFFICE.x, P.z - HARBOUR_OFFICE.z), buoy: Math.hypot(P.x - WRECK_BUOY.x, P.z - WRECK_BUOY.z),
    },
    home: afloat && boat.speed < 0.8 && Math.hypot(P.x - HAVEN.x, P.z - HAVEN.z) < 90,
    boat: afloat ? boat.kind : null, seats: afloat ? vesselOf(boat.kind).seats : 0, slow: afloat && boat.speed < 1.5,
    dusk: clock.hour >= sun.set - 1 && clock.hour <= sun.set + 1.6,
  }, t);
  if (!r) return;
  if (r.toast) hud.toast(r.toast, 7);
  if (r.card) {
    showNote(r.card.title, r.card.text, r.card.kind);
    if (r.keepsake) {
      state.keepsakes[r.keepsake] = { day: state.day, hour: Math.round(state.hour * 100) / 100 };
      hud.toast(`Kept in your journal: ${KEEPSAKES[r.keepsake].name}.`, 5);
    }
  }
  if (r.aboard || r.laid || r.card) jobWeight();
  save();
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

/* ---------------- the rockpools (see world/rockpools.js) ---------------- */

// Crouched over a rockpool at low water: what's in it, named in your notes as you see it; turn
// a stone over (and put it back) for what hides under it; sweep the hand net for a prawn, a crab
// or a fish, look it over and let it go; photograph the pool. The camera looks down into it.
let poolOpenNow = null;
const _poolAt = new THREE.Vector3(), _poolLook = new THREE.Vector3(), _poolAim = new THREE.Vector3();
const poolSite = (p) => POOL_SITES.find((s) => s.id === p.site);
const poolName = (k) => (POOL_LIFE[k].fish ? fishById[k].name.charAt(0) + fishById[k].name.slice(1).toLowerCase() : NATURE[k].name);
function openPool(p) {
  if (modal || !started) return;
  if (fishing.aiming) fishing.cancel();
  poolOpenNow = { p, said: '', met: new Set() };
  modal = 'rockpool';
  hud.hidden(true);
  $('rockpool').hidden = false;
  // (The camera starts where it is and drops down over the pool.)
  _poolAt.copy(camera.position);
  _poolLook.set(p.x, p.ground, p.z);
  notePool();
  renderPool();
  teach('rockpool', 'A rockpool: look in, turn a stone over (and put it back as you found it), and sweep the net for a prawn, a crab or a fish to look at before you let it go. The tide comes back over it: watch the time.', 8);
}
function closePool() {
  if (!poolOpenNow) return;
  settle(poolOpenNow.p);
  poolOpenNow = null;
  $('rockpool').hidden = true;
  if (modal === 'rockpool') modal = null;
  hud.hidden(hudOff);
}
// Everything you can see in the pool that you haven't yet noted this visit: into your notes (the
// fish as seen, the rest in the naturalist's notes), and a word on the first of each.
function notePool() {
  const V = poolOpenNow, p = V.p, where = poolSite(p)?.name.replace(/^the /, 'The ') || '';
  const fresh = [];
  for (const c of visibleLife(p, clock.abs)) {
    const key = `${c.kind}`;
    if (V.met.has(key)) continue;
    V.met.add(key);
    // (A rockpool count for the Trust: each kind you see counts. See contracts.js noted.)
    jobsDone(Con.noted(state.contracts, 'pool', c.kind));
    if (POOL_LIFE[c.kind].fish) {
      const before = !!state.observed?.[c.kind] || !!state.fish[c.kind];
      markObserved(c.kind, { id: `pool-${p.id}-${p.life.indexOf(c)}`, x: c.x, z: c.z });
      if (!before) fresh.push(c.kind);
    } else if (noteNature(state.grounds, c.kind, { day: state.day, hour: state.hour, where })) fresh.push(c.kind);
  }
  if (!fresh.length) return;
  const names = fresh.map((k) => `the ${poolName(k).toLowerCase()}`);
  V.said = fresh.length === 1
    ? `New in your notes: ${names[0]}. ${POOL_LIFE[fresh[0]].fish ? fishById[fresh[0]].note : NATURE[fresh[0]].note}`
    : `New in your notes: ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`;
  hud.pulseJournal();
  save();
}
function renderPool() {
  const V = poolOpenNow;
  if (!V) return;
  const p = V.p, site = poolSite(p);
  $('rp-title').textContent = `A rockpool · ${site ? site.name.replace(/^the /, 'The ') : ''}`;
  const out = turns(clock.abs, 2).find((x) => x.kind === 'high');
  const covered = poolOpen(p, TIDE.level) ? '' : ' The sea’s coming over it now.';
  $('rp-tide').textContent = `${p.low > 0.6 ? 'A low pool, out only at the bottom of the tide.' : p.low > 0.3 ? 'A pool halfway down the shore.' : 'A pool high on the shore.'} High water ${out ? formatClock(out.at % 24) : ''}.${covered}`;
  $('rp-say').textContent = V.said || 'You crouch at the edge and look in. Things move when you keep still.';
  const seen = {};
  for (const c of visibleLife(p, clock.abs)) seen[c.kind] = (seen[c.kind] || 0) + 1;
  $('rp-list').replaceChildren(...Object.entries(seen).map(([k, n]) => {
    const li = document.createElement('li');
    li.textContent = `${poolName(k)}${n > 1 ? ` × ${n}` : ''}`;
    return li;
  }));
  const left = p.stones.filter((s) => !s.turned).length;
  $('rp-turn').disabled = !left;
  $('rp-turn').lastChild.textContent = left ? ` Turn a stone (${left} left)` : ' Every stone turned';
  $('rp-net').disabled = !visibleLife(p, clock.abs).some((c) => POOL_LIFE[c.kind].net);
  $('rp-bait').hidden = !V.bait;
}
function poolTurn() {
  const V = poolOpenNow;
  if (!V) return;
  const r = turnStone(V.p);
  if (!r) return;
  audio.tick?.(0.4);
  const what = r.found.map((c) => poolName(c.kind).toLowerCase());
  V.said = what.length ? `Under the stone: ${[...new Set(what)].join(', ')}. (You’ll put it back as you found it.)` : 'Nothing under this one but a few sand-hoppers, gone in a flash.';
  notePool();
  renderPool();
}
function poolNet() {
  const V = poolOpenNow;
  if (!V) return;
  const r = netIn(V.p, clock.abs);
  if (!r.creature) return;
  const c = r.creature, name = poolName(c.kind).toLowerCase();
  if (!r.ok) {
    V.said = `A sweep of the net, and the ${name} is away${c.kind === 'prawn' ? ', flicking backwards into the weed' : c.kind === 'shorecrab' ? ', sideways under the rock' : ' into a crack'}.`;
    renderPool();
    return;
  }
  letGo(c, clock.abs);
  // (A prawn can go in the bait bucket: see poolBait.)
  V.bait = isLiveBait(c.kind, c.size ?? 5) ? { kind: c.kind, size: c.size ?? 5 } : null;
  if (POOL_LIFE[c.kind].fish) {
    // A fish in the net: a close look (see inspect.js), then back in the pool.
    const sp = fishById[c.kind];
    V.said = `In the net: a ${c.size} cm ${sp.name.toLowerCase()}. You looked it over and let it slip back in.`;
    $('rockpool').hidden = true;
    inspectFrom = 'rockpool';
    modal = 'inspect';
    inspector.open(sp, c.size, { condition: 'in the net, about to go back' });
  } else V.said = `In the net: a ${name}. ${c.kind === 'prawn' ? 'See-through, its insides showing; you tip it back.' : 'It waves its claws at you; you tip it back by its stone.'}`;
  renderPool();
}
// The bait bucket (see livebait.js). Aboard a boat with a livewell, that holds them instead: more
// room, and its pump keeps the water sweet.
const livewellHere = () => !onFoot && !!fitsAboard()?.livewell;
function baitRoom(id, size) {
  if (!isLiveBait(id, size)) return { ok: false, why: 'Too big for a bait: let it go.' };
  if (state.gear.bucket.fish.length >= capOf(livewellHere())) return { ok: false, why: livewellHere() ? 'The livewell is full.' : 'The bait bucket is full: six is plenty, any more and they use the water up.' };
  return { ok: true };
}
function bucketWords() {
  const B = state.gear.bucket, n = B.fish.length;
  return `${n} in the ${livewellHere() ? 'livewell' : 'bucket'}, the water ${waterWords(B)}`;
}
// The hours go by (however they went: fishing, sleeping, travelling) and the bucket's water with
// them; in stale water the bait starts to die.
let bucketAt = null;
let routeNow = null;
let burnedNow = 0;
function bucketTick() {
  const B = state.gear.bucket, now = ownAbs();
  if (bucketAt == null || !B.fish.length) {
    bucketAt = now;
    if (!B.fish.length) B.water = 1;
    return;
  }
  const h = Math.min(48, Math.max(0, now - bucketAt));
  if (h < 0.05) return;
  bucketAt = now;
  const was = B.water;
  const warm = { summer: 1, spring: 0.4, autumn: 0.4, winter: 0 }[seasonOf(clock.day).name] ?? 0.4;
  const dead = stepBucket(B, h, { aerated: livewellHere(), warm });
  if (dead.length) {
    const names = [...new Set(dead.map((f) => LIVE[f.id].name || fishById[f.id]?.name.toLowerCase() || f.id))].join(' and ');
    hud.flash(`${dead.length > 1 ? `${dead.length} of your live baits have` : `Your live ${names} has`} died: the bucket’s water is stale. Change it at the water’s edge.`, t, 5);
    gearChip();
    if (TACKLE[state.gear.rig[state.gear.rod]]?.live && !liveCount(B, state.gear.rig[state.gear.rod])) applyGear();
    save();
  } else if (was >= 0.6 && B.water < 0.6) hud.flash('The bait bucket’s water is going stale: change it at the water’s edge, or aboard.', t, 4);
}
// Somewhere to change the bucket's water: aboard, or standing by the water.
function bucketWater() {
  if (!onFoot) return !boat.hull.cabin || !cabinIn;
  const P = walker.pos;
  for (let a = 0; a < 8; a++) {
    const x = P.x + Math.sin(a * 0.785) * 2.5, z = P.z + Math.cos(a * 0.785) * 2.5;
    if (depthAt(x, z) > 0.15) return true;
  }
  return false;
}
// A netted prawn (or a small fish) into the bait bucket, for live bait, instead of back in the pool.
function poolBait() {
  const V = poolOpenNow;
  if (!V?.bait) return;
  const r = baitRoom(V.bait.kind, V.bait.size);
  if (!r.ok) {
    V.said = r.why;
  } else {
    addLive(state.gear.bucket, V.bait.kind, V.bait.size, livewellHere());
    const name = LIVE[V.bait.kind].name || fishById[V.bait.kind]?.name.toLowerCase() || V.bait.kind;
    V.said = `Into the bait bucket: a ${name} (${bucketWords()}). Hooked lightly through the tail, a live prawn is the best bait on the rocks.`;
    gearChip();
    save();
  }
  V.bait = null;
  renderPool();
}
function poolPhoto() {
  const V = poolOpenNow;
  if (!V) return;
  const seen = visibleLife(V.p, clock.abs);
  $('rockpool').hidden = true;
  takePhoto({ species: [...new Set(seen.filter((c) => POOL_LIFE[c.kind].fish).map((c) => c.kind))], nature: [...new Set(seen.filter((c) => !POOL_LIFE[c.kind].fish).map((c) => c.kind))] }, `A rockpool, ${poolSite(V.p)?.name.replace(/^the rocks /, '') || ''}`);
}
// The camera crouched at the pool's edge on your side, looking down into it.
function poolCamera(dt) {
  const V = poolOpenNow;
  if (!V) return;
  const p = V.p, P = walker.pos;
  let dx = P.x - p.x, dz = P.z - p.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d;
  dz /= d;
  const k = 1 - Math.exp(-3 * dt);
  // (Close, as you'd crouch: a goby or a cushion star a few centimetres long is plain to see.)
  _poolAt.lerp(_poolAim.set(p.x + dx * (p.r + 0.25), p.rim + 0.8, p.z + dz * (p.r + 0.25)), k);
  _poolLook.lerp(_poolAim.set(p.x - dx * p.r * 0.2, p.ground, p.z - dz * p.r * 0.2), k);
  camera.position.copy(_poolAt);
  camera.lookAt(_poolLook);
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
// The day book (see daybook.js): every couple of seconds, where you are and how you're getting
// about, the boat you're in, the sky, and where you are if a gale's blowing; when the day turns
// (asleep, or at midnight), its page is written up, and in the morning you hear so.
let dayTimer = 0, dayLast = null, dayNews = null, challengesDue = true;
// Things to say once the card in front of you is closed, one at a time.
const laterLines = [];
let laterT = 0, colourAbs = null;
const later = (text) => laterLines.length < 6 && laterLines.push(text);
const recentSigns = [];
function noteTheDay(dt) {
  laterT -= dt;
  if (laterLines.length && laterT <= 0 && !modal && !sleeping && !traveling) {
    hud.toast(laterLines.shift(), 9);
    laterT = 7;
  }
  dayTimer -= dt;
  if (dayTimer > 0) return;
  dayTimer = 2;
  // The water's colour (see grounds.js): stirred up by rain and a blow, settling over a day.
  const abs = state.day * 24 + state.hour;
  // (Playing together it's the host's water you see, and your own waits as it was.)
  if (colourAbs != null && !clock.following) state.seaColour = stepColour(state.seaColour, { rain: weather.rain, storm: Math.max(weather.storm, conditions.sea.storm) }, Math.max(0, abs - colourAbs));
  colourAbs = abs;
  water.uniforms.uColour.value = seaColourNow();
  underwater.colour = seaColourNow();
  if (!state.today || state.today.day !== state.day) closeTheDay();
  if (challengesDue && !modal) {
    challengesDue = false;
    challengesDone();
  }
  if (dayNews && !sleeping && !traveling && !modal) {
    hud.toast(dayNews, 7);
    hud.pulseJournal();
    dayNews = null;
  }
  const T = state.today, h = state.hour, p = player().pos;
  const mode = traveling ? null : driving ? 'car' : dive ? 'swim' : onFoot ? 'foot' : 'boat';
  // (Not the jumps: travel from the map, a passage south, being put somewhere.)
  if (dayLast && mode) {
    const d = Math.hypot(p.x - dayLast.x, p.z - dayLast.z);
    if (d < 120) noteMove(T, mode, d, h);
  }
  dayLast = { x: p.x, z: p.z };
  const pl = PLACES.find((q) => !q.area && q.test(p.x, p.z));
  if (pl) notePlace(T, pl.id, h);
  if (mode === 'boat' && Math.abs(boat.speed) > 0.5) noteBoat(T, boat.name);
  noteSky(T, weather.state);
  if (Math.max(weather.storm, conditions.sea.storm) > 0.3) noteGale(T, mode === 'boat' || mode === 'swim' ? (isSheltered(zoneAt(p.x, p.z)) ? 'shelter' : 'out') : 'ashore');
}
function closeTheDay() {
  const page = closeDay(state, state.day);
  if (page) dayNews = dayLine(page);
  save();
}
// The harbour's challenges: any newly done puts a badge on the board at home.
function challengesDone() {
  for (const c of checkChallenges(state)) {
    hud.toast(`Done: ${c.name}. ${c.text} A cloth badge for the board at home.`, 8);
    audio.chime();
    hud.pulseJournal();
  }
  refreshBadges();
}
function refreshBadges() {
  world.home.showBadges(CHALLENGES.map((c) => ({ id: c.id, name: c.name, color: c.color, mark: c.mark, done: !!state.badges?.[c.id] })));
}

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
    shareFind('place', pl.x ?? p.x, pl.z ?? p.z, pl.name, pl.sub || '', pl.id);
    audio.chime();
    hud.toast(`${pl.name} is in your journal now`);
    hud.pulseJournal();
    if (pl.id === 'landing' && !onFoot) teach('landingTip', `Tie up here: ${scheme() === 'touch' ? 'tap the prompt' : `press ${input.keyLabel('interact')}`} to step ashore. Camp is just up the path.`, 6);
    if (pl.id === 'camp') teach('campTip', 'Camp: grill and eat what you catch, swap rods and tackle from the tackle box, and sleep until morning.', 7);
    if (pl.id === 'stream') teach('streamTip', 'Fernbeck’s trout hold in the pools. They’re shy: walk softly, and bring the fly rod from camp.', 7);
    if (pl.id === 'lake') teach('lakeTip', 'Reedmere: perch and pike take lures, carp graze the bottom, rudd sip near the lily pads.', 7);
    if (pl.id === 'quay') teach('quayTip', 'Wend Quay: a camp and a tackle box. Mullet in the estuary, flounder on the sand, bass in the channel at dawn and dusk.', 9);
    if (pl.id === 'boathouse') teach('boathouseTip', 'The Mere Boathouse: a bass boat at the jetty and a tackle box. Largemouth bass lurk by the pads and the drowned oaks; pike lie in the weed.', 8);
    if (pl.id === 'puffin') teach('puffinTip', 'Puffin Cove: a sheltered camp with a tackle box. After dark, squid gather under the lamp light; wrasse live in the kelp by the rocks.', 8);
    if (pl.id === 'deep') teach('deepTip', 'The Blue Water. Watch for seabirds diving and the sea boiling white: tuna chase the sprat shoals out here.', 8);
    if (pl.id === 'bajon') teach('bajonTip', `El Bajón: lava pinnacles under the yellow buoy, sea fans, parrotfish, morays and a grouper. Look down from the boat, or dive it (${scheme() === 'touch' ? 'tap the prompt' : input.keyLabel('interact')} with the boat stopped).`, 12);
    if (pl.dive && pl.id !== 'wreck') teach('diveSiteTip', `${pl.name}: a dive site under the yellow buoy. Stop close by, anchor, and go in (${scheme() === 'touch' ? 'tap the prompt' : input.keyLabel('interact')}). Each site you dive is ticked on your map.`, 11);
    if (pl.id === 'hound') teach('houndTip', 'The Hound: ten metres at its top, thirty at its foot. Dive it on a tank at slack water (high or low: see the notice board), and watch your air.', 11);
    if (pl.id === 'haven') teach('havenTip', `Willowhaven: the notice board (paid work on the water, and not all of it fishing), tackle in the chandlery, the bench, and your boats at the harbour office by the quay (${scheme() === 'touch' ? 'tap the prompts' : input.keyLabel('interact')}).`, 10);
    if (pl.id === 'strand') teach('strandTip', 'Shell Strand: bass come into the surf at dusk, and flatfish up the sand after dark. The shelf above the beach is a dry, level place for a tent.', 9);
    if (pl.id === 'head') teach('headTip', 'Cove Head takes the swell: bass and white bream in the wash below the ledges. You can see the Kittiwake’s buoy from the daymark.', 8);
    if (pl.id === 'reach') teach('reachTip', 'The cove channel is sheltered from every wind: a calm place for a float at dusk, and for watching cuttlefish under the water.', 8);
    if (pl.id === 'calf') teach('calfTip', `The Calf: tie up at the landing in its lee. Pollack and wrasse under the cliffs, bass off the Nose, and a watch tower over the whole coast (${scheme() === 'touch' ? 'tap the prompt' : input.keyLabel('interact')} at its door).`, 10);
    if (pl.id === 'sound') teach('soundTip', 'Calf Sound: the fastest tide on the coast. Mackerel, garfish and bluefish hunt sandeels here: cast a metal across the current and let it swing round.', 10);
    if (pl.id === 'coldfoot') teach('coldfootTip', 'Coldwater Foot: the path follows the river up to the bothy and Hoarfell’s top, past waterfalls and trout pools.', 9);
    if (pl.id === 'bothy') teach('bothyTip', `The bothy: cook, sleep and swap tackle here (${scheme() === 'touch' ? 'tap the prompt' : input.keyLabel('interact')} at the door). Now you’ve walked here, you can come straight back from the map.`, 9);
    if (pl.id === 'tarn') teach('tarnTip', 'Hoar Tarn: small, wild trout rise at dusk in the cold water. Cast a fly or a little spinner along the edge where the shelf drops away.', 8);
    if (pl.id === 'summit') teach('summitTip', `The top of Hoarfell. ${scheme() === 'touch' ? 'Tap the prompt' : `Press ${input.keyLabel('interact')}`} at the cairn to add a stone and look out over the coast.`, 8);
    if (pl.id === 'wreck') teach('wreckTip', `The Kittiwake lies below you. Look under the water (${scheme() === 'touch' ? 'the view button' : input.keyLabel('view')}) to see her, or fish over her: a bottom rig for the conger, a shad for the pollack.`, 9);
    save();
  }
}

function moments() {
  const h = clock.hour;
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
    // (The birds over a feed, D4, are seen from most of a kilometre: see feeding.js.)
    if (d > (c.type === 'birds' ? (c.big ? 900 : 400) : c.type === 'boil' ? 220 : 90)) continue;
    // Seen, if it's near enough and light enough to see: noted (see grounds.js).
    if (SEEN_AT[c.type] && d < SEEN_AT[c.type] && (env.daylight > 0.2 || c.type === 'rise' || c.type === 'jump')) seeSign(state.grounds, recentSigns, c, clock.abs, state.day);
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
        world.birdsAt(c.x, c.z, c.big ? 10 : 6);
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
for (const b of boats) {
  b.onBump = (v) => {
    audio.knock(clamp(v / 3, 0.4, 1));
    // (A knock you're aboard for comes up through your hands.)
    if (b === boat && !onFoot) haptics.pulse({ strong: 1, weak: 0.55, ms: 220, shape: 'thump' }, knockFeel(v));
  };
}
// Running aground, or dragged up a beach: the hull grinding on the bottom (yours, a few times a second).
let scrapeT = 0;
for (const b of boats) b.onScrape = (v, on) => {
  if (b !== boat || t - scrapeT < 0.28) return;
  scrapeT = t;
  audio.scrape(clamp(v / 1.5, 0.2, 1) * clamp(on * 2, 0.3, 1));
};
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
// (k: how big a splash: a gannet's dart is 1, a shearwater dropping onto the water much less.)
sealife.onPlunge = (x, z, k = 1) => {
  fx.splash(x, 0.05, z, Math.round(16 * k) + 2, 3.4 * k, 0.7 * k);
  fx.ripple(x, z, 1.6 * k, 1.5, 0.6 * k);
  const h = heardFrom(x, z, 260 * k);
  if (h.vol > 0) audio.plunge?.(0.08 * h.vol * k, h.pan);
};
sealife.onSplash = (x, z, len) => {
  fx.splash(x, 0.05, z, 12 + Math.round(len * 4), 2.2, 0.9);
  fx.ripple(x, z, 1.2 + len * 0.4, 1.4, 0.5);
  const h = heardFrom(x, z, 120);
  if (h.vol > 0) audio.splashSmall?.(0.25 * h.vol, h.pan);
};
// What you've seen goes in the journal; the first time, a word about it.
const seaLifeSeenAt = {};
// (Seconds between words about a new sighting.)
const SIGHTING_GAP = 90;
let lastSightingWord = -Infinity;
function seeSeaLife(kind, x, z) {
  // (Not behind the title: nobody's looking yet.)
  if (!started) return;
  favoursReady(favourSaw(state.favours, kind));
  noteSeen(state.today, kind);
  const now = performance.now() / 1000;
  if (seaLifeSeenAt[kind] && now - seaLifeSeenAt[kind] < 600) return;
  seaLifeSeenAt[kind] = now;
  const S = (state.seaLife ||= {});
  if (S[kind]) {
    S[kind].n++;
    delete S[kind].heard; // (heard before, seen now)
  } else {
    S[kind] = { n: 1, day: state.day, hour: state.hour, where: region === 'south' ? 'off Las Brasas' : placeName(x, z) || '' };
    // A word the first time (and where the notes are, the very first time): one at a time, so a
    // busy shore doesn't bury you in birds; the rest go quietly into the notes.
    if (now - lastSightingWord > SIGHTING_GAP) {
      lastSightingWord = now;
      const first = Object.keys(S).length === 1;
      hud.toast(`${SEA_LIFE[kind].note}${first ? ' (The journal’s Notes keep what you’ve seen.)' : ''}`, 8);
    }
  }
  save();
}
sealife.onSighting = seeSeaLife;
// Heard, not seen: a curlew, an owl, frogs (see audio.js), into the notes as heard (only with the
// sound on, of course).
audio.onHeard = (kind) => hearLife(kind);
function hearLife(kind) {
  const A = settings.audio;
  if (!started || !SEA_LIFE[kind]?.heard || A.mute || !(A.master > 0) || !(A.ambient > 0)) return;
  const now = performance.now() / 1000;
  if (seaLifeSeenAt[kind] && now - seaLifeSeenAt[kind] < 600) return;
  seaLifeSeenAt[kind] = now;
  const S = (state.seaLife ||= {}), P = player().pos;
  if (S[kind]) S[kind].n++;
  else {
    S[kind] = { n: 1, day: state.day, hour: state.hour, where: region === 'south' ? 'off Las Brasas' : placeName(P.x, P.z) || '', heard: true };
    if (now - lastSightingWord > SIGHTING_GAP) {
      lastSightingWord = now;
      hud.toast(SEA_LIFE[kind].heard, 8);
    }
  }
  save();
}
// The gulls round Gull Rock and over the bay, by day: close enough to know them for herring gulls.
let gullT = 0;
function lookForGulls(dt) {
  if ((gullT -= dt) > 0) return;
  gullT = 1.5;
  if (!started || modal || dive) return;
  const P = player().pos;
  if (region === 'home' && env.daylight > 0.25 && world.gullNear(camera.position, 70)) seeSeaLife('herringgull', P.x, P.z);
  // (And the coast's other birds, up close and in view: see world/birds.js.)
  camera.updateMatrixWorld();
  _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_pm);
  for (const k of birds.seenNear(_frustum, camera.position)) seeSeaLife(k, P.x, P.z);
}
crossingLife.events.onSighting = seeSeaLife;
// The ship's horn (a long blast, heard a long way off), and the white water at her bow and stern.
crossingLife.events.onHorn = (x, z) => {
  const h = heardFrom(x, z, 2500);
  audio.horn?.(Math.max(0.3, h.vol), h.pan);
  hud.toast('One long blast from the ship’s horn: you’re close. Turn away and let her by.', 6);
};
crossingLife.events.onWake = (x, z, k = 1) => fx.ripple(x, z, 2.5 * k, 3.5 * k, 0.4 * k);
crossingLife.events.onPlop = (x, z, k = 0.4) => {
  fx.splash(x, 0.05, z, 3 + Math.round(k * 6), 0.9 * k, 0.3 * k);
  fx.ripple(x, z, 0.4 + k * 0.6, 0.9, 0.25);
};
sealife.onSnort = (x, z) => {
  const h = heardFrom(x, z, 60);
  if (h.vol > 0) audio.snort?.(0.07 * h.vol, h.pan);
};
// Wildlife moments: a word when something worth watching happens near you (one at a time, and
// not the same thing again for a good while).
const momentAt = {};
let lastMoment = -1e9;
function wildMoment(kind, text) {
  const now = performance.now() / 1000;
  if (now - lastMoment < 90 || now - (momentAt[kind] ?? -1e9) < 1200 || sleeping || traveling) return;
  momentAt[kind] = lastMoment = now;
  later(text);
}
sealife.onMoment = wildMoment;
wildlife.onSighting = seeSeaLife;
wildlife.onMoment = wildMoment;
wildlife.onCall = (kind, x, z) => {
  const h = heardFrom(x, z, kind === 'heron' ? 220 : 160);
  if (h.vol <= 0) return;
  if (kind === 'oystercatcher') audio.piping?.(0.05 * h.vol, h.pan);
  else if (kind === 'tern') audio.tern?.(0.04 * h.vol, h.pan);
  else if (kind === 'heron') audio.croak?.(0.06 * h.vol, h.pan);
  else if (kind === 'otter') audio.otterWhistle?.(0.02 * h.vol, h.pan);
};
wildlife.onRipple = (x, z) => fx.ripple(x, z, 0.4, 1.0, 0.3);
wildlife.onSplash = (x, z, size) => {
  fx.splash(x, 0.05, z, 6, 1.0 + size * 2, 0.4);
  fx.ripple(x, z, 0.6 + size * 2, 1.2, 0.4);
  const h = heardFrom(x, z, 60);
  if (h.vol > 0) audio.splashSmall?.(0.12 * h.vol, h.pan);
};
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
// A propeller on the bottom (boat.js propStrike): only for a leg you trim yourself, and not on
// Relaxed. A touch creeping; a bent blade at speed (she's slower, the engine races and she
// judders), put right with a new propeller at the Marine Works.
const strikesFor = () => (state.difficulty === 'relaxed' ? null : state.difficulty === 'realistic' ? 'hard' : 'on');
for (const b of Object.values(BOATS)) {
  b.propStrikes = strikesFor();
  b.onStrike = (bt, s) => {
    if (bt !== boat || onFoot) return;
    audio.knock?.(Math.min(1, 0.4 + s.speed / 8));
    audio.scrape?.(Math.min(1, s.speed / 6));
    haptics.pulse('snap', Math.min(1, 0.5 + s.speed / 10));
    if (!settings.controls.reducedMotion) rig.shake = Math.max(rig.shake, Math.min(0.35, 0.1 + s.speed / 40));
    // (Words once for a touch, and again only as it gets worse: dragging her propeller over a
    // bank knocks it again and again.)
    const band = s.dmg >= 0.9 ? 3 : s.dmg >= 0.5 ? 2 : s.dmg >= 0.15 ? 1 : 0, was = bt._strikeBand ?? -1;
    bt._strikeBand = band;
    if (band <= was) return;
    hud.flash(band ? `A bang from the stern: her propeller’s hit the bottom${band >= 2 ? ' hard' : ''}. She’s ${band >= 3 ? 'barely making way' : 'down on speed'} and the engine runs rough. Trim the leg right up into its shallow-water range before you run over shallows; the Marine Works can fit a new propeller.` : 'The propeller ticks the bottom. Trim the leg up (into its shallow-water range) or find deeper water.', t, band ? 6 : 3.5);
    if (band) vesselLog(bt.kind, `Propeller damaged on the bottom (${Math.round(s.dmg * 100)}%).`);
    save();
  };
}
// What a knock did (boat.js takeDamage, damage.js): only what she hit, how hard and square on, and
// what it was; on Relaxed, scuffs only. The words once for each part of her as it gets worse; a
// tube punctured, the bang and the hiss; a line in her log.
const KN_PER = 1.944;
// Water coming in, her engine room flooded, pumped dry (boat.js flood).
const FLOOD_WHERE = { bottom: 'her bottom', bow: 'her bow', port: 'her port side', stbd: 'her starboard side', stern: 'her stern' };
for (const b of Object.values(BOATS)) {
  b.floodMode = floodModeOf(state.difficulty);
  b.onFlood = (bt, what) => {
    const mine = bt === boat && !onFoot, D = damages[bt.kind];
    if (what === 'breach') {
      const holed = Object.keys(FLOOD_WHERE).filter((s) => D.hull[s] >= 0.85).map((s) => FLOOD_WHERE[s]);
      if (mine) {
        const has = bt.kind in PUMP_NAMES, live = has && (bt.pumpPower ?? 1) > 0;
        const next = live ? 'Her bilge pump’s on its float switch and will take what it can; bail too if it can’t keep up (look her over), and get her in to the Marine Works.' : `${has ? 'Her battery’s too flat for the bilge pump: bail' : 'Bail'} (look her over), and get her to the Marine Works.`;
        hud.flash(`Water’s coming in: ${holed.join(' and ') || 'her hull'} ${holed.length > 1 ? 'are' : 'is'} holed below the waterline. ${next}`, t, 7);
        audio.splashSmall?.(0.4);
      }
      vesselLog(bt.kind, 'Holed below the waterline: taking water.');
      save();
    } else if (what === 'engine') {
      const E = engines[bt.kind], inboard = !!bt.hull.motor?.inboard, stopped = !!E && cutOut(E);
      if (mine) {
        if (inboard) hud.flash(`Her engine room’s flooded${stopped ? ': the engines have stopped' : ''}. Pump her out (her bilge pump’s at it), and she’ll start again.`, t, 6);
        else hud.flash(`Swamped, her outboard’s powerhead ${stopped ? 'went under and it’s stopped' : 'is under: it won’t start'}. Bail her out below a third and it’ll start again; or radio the harbour (look her over).`, t, 6);
      }
      vesselLog(bt.kind, inboard ? 'Her engine room flooded.' : 'Swamped: her outboard drowned.');
      save();
    } else if (what === 'swamped') {
      if (mine) {
        hud.flash('She’s swamped: awash, heavy and barely making way. Bail or pump her out; or look her over to radio the harbour for a tow.', t, 7);
        haptics.pulse('snap', 0.5);
      }
      vesselLog(bt.kind, 'Swamped.');
      save();
    } else if (what === 'dry' && mine) hud.flash('Pumped dry.', t, 2);
  };
}
const PUMP_NAMES = { bass: 1, cabin: 1, console: 1, rib: 1, cruiser: 1 };
// (In words for the throttle panel: water in the boat you're in, if any to speak of.)
function waterBit() {
  const F = boat?.flooding;
  if (!F || F.litres < 5) return '';
  return `<span class="lv-warn">${F.swamped ? 'swamped · ' : ''}${floodWords(F.litres)}${F.gaining ? ', gaining' : ''}${boat.pumpRunning ? ' · pump on' : ''}</span>`;
}
for (const b of Object.values(BOATS)) {
  b.damageMode = modeOf(state.difficulty);
  b.onDamage = (bt, r, ev) => {
    const mine = bt === boat && !onFoot, name = bt.kind;
    const what = SURFACES[ev.surface]?.name || 'something';
    if (r.parts) return partsDamaged(bt, r, mine);
    if (r.chamber >= 0) {
      if (!r.punctured && !r.torn) return;
      if (mine) {
        audio.hiss?.(r.torn ? 1 : 0.6, r.torn ? 2.4 : 1.4);
        haptics.pulse('snap', 0.7);
      }
      const side = CHAMBERS[r.chamber];
      if (mine) hud.flash(`A bang and a hiss: the ${side} tube’s ${r.torn ? 'torn open' : 'punctured'} on ${what}. ${r.torn ? 'It’s going soft fast' : 'It’ll go soft over a few minutes'}, and she’ll sit lower on that side; the other chambers hold her up. On her deck, look her over to pump it up; the Marine Works can patch it.`, t, 7);
      vesselLog(name, `The ${side} tube ${r.torn ? 'torn' : 'punctured'} on ${what}.`);
      save();
      return;
    }
    // (Each part's word, worst so far: said only as it gets worse.)
    const mat = materialOf(name), word = hullWords(mat, r.now), band = mat.words.indexOf(word);
    const B = (bt._dmgBand ||= {});
    if (band <= (B[r.section] ?? -1)) return;
    B[r.section] = band;
    if (mine) {
      const how = ev.slid ? `dragged over ${what}` : `into ${what} at ${Math.max(1, Math.round(ev.vn * KN_PER))} knots`;
      const after = band === 0 ? 'Only the paint, for now.' : band === 1 ? 'Worth the yard’s eye when you’re in.' : 'She’s slower for it; the Marine Works can put it right.';
      hud.flash(`${ev.slid ? 'A grinding' : 'A crunch'}: ${how}. ${SECTION_NAMES[r.section][0].toUpperCase() + SECTION_NAMES[r.section].slice(1)} is ${word}. ${after}`, t, band >= 2 ? 6 : 4);
    }
    vesselLog(name, `${SECTION_NAMES[r.section][0].toUpperCase() + SECTION_NAMES[r.section].slice(1)} ${word} on ${what}.`);
    save();
  };
}
// Her working parts hurt (damage.js legStrike, rudderStrike, shake): the words once for each as it
// gets worse; the engine cut by a jolt with her terminal loose; her log.
let looseSaid = false;
function partsDamaged(bt, r, mine) {
  const D = damages[bt.kind], B = (bt._dmgBand ||= {});
  if (r.parts.includes('wiring')) {
    if (r.wiring === 'cut') {
      const E = engines[bt.kind];
      if (E && cutOut(E) && mine) {
        audio.knock?.(0.5);
        haptics.pulse('snap', 0.6);
        hud.flash('The engine cut out on that jolt: the battery terminal’s loose. Stopped, look her over and do it up, then start her again.', t, 6);
      }
      return;
    }
    if (mine) hud.flash('The instruments flickered on that landing: her battery terminal’s been shaken loose. Another hard jolt and the engine will cut out. Ease off, and do it up (stopped: look her over).', t, 6);
    vesselLog(bt.kind, 'Her battery terminal shaken loose by hard landings.');
    save();
    return;
  }
  const said = [];
  if (r.parts.includes('steer')) {
    const band = Math.min(3, Math.floor((Math.abs(D.steer.bend) / PARTS.steer.most + D.steer.loss) * 4));
    if (band > (B.steer ?? -1)) {
      B.steer = band;
      said.push(`her steering’s ${steerWords(D)}${Math.abs(D.steer.bend) > 0.003 ? ' (hold her against it)' : ''}`);
      vesselLog(bt.kind, `Steering ${steerWords(D)}, on the bottom.`);
    }
  }
  if (r.parts.includes('mount')) {
    const band = Math.min(3, Math.floor(D.mount * 4));
    if (band > (B.mount ?? -1)) {
      B.mount = band;
      said.push(`the engine shifted on her transom: the bracket’s bolts ${D.mount > 0.6 ? 'are badly loose' : 'have worked loose'}, and she’s down on push`);
      vesselLog(bt.kind, 'The engine’s bracket worked loose, on the bottom.');
    }
  }
  if (!said.length) return;
  if (mine) hud.flash(`A jolt through the helm: ${said.join('; and ')}. ${r.parts.includes('mount') ? 'Stopped, look her over to do up the bolts; ' : ''}the Marine Works can put it right.`, t, 6);
  save();
}
// Each frame: every punctured tube letting go (yours, wherever she lies); the one you're in, a word
// as a chamber goes soft; and the foot pump while you work it.
let pumping = null, bailing = null;
function damageTick(dt) {
  // The rain on every boat, and each pump's battery: running with the engine off, it draws on it;
  // flat, it stops. (See flooding.js.)
  for (const [k, b] of Object.entries(BOATS)) {
    b.rain = weather.rain || 0;
    const E = engines[k];
    if (!E) continue;
    if (b.pumpRunning && !engineRunning(E)) E.charge = Math.max(0, E.charge - PUMP_DRAW * dt);
    b.pumpPower = E.charge > 0.05 ? 1 : 0;
  }
  // Bailing her out, while you keep still at it.
  if (bailing) {
    const b = BOATS[bailing.kind], F = b.flooding;
    const moved = boat.deck ? Math.hypot(boat.deck.x - bailing.x, boat.deck.z - bailing.z) > 0.4 : false;
    if (boat !== b || onFoot || moved || Math.abs(boat.speed) > 1.5) {
      b.bailing = false;
      bailing = null;
      hud.flash('You stop bailing.', t, 1.6);
    } else {
      b.bailing = true;
      bailing.t += dt;
      if (bailing.t >= bailing.next) {
        bailing.next = bailing.t + 1.3;
        audio.splashSmall?.(0.25);
      }
      if (!F || F.litres < 1) {
        b.bailing = false;
        bailing = null;
        hud.flash('Bailed dry.', t, 2);
        save();
      } else if (Math.floor(bailing.t / 4) !== Math.floor((bailing.t - dt) / 4)) hud.flash(`Bailing: ${floodWords(F.litres)}${F.gaining ? ', and still coming in' : ''}. Keep still to keep at it.`, t, 1.6);
    }
  }
  for (const [k, D] of Object.entries(damages)) {
    if (!D.tubes?.some((c) => c.leak && c.air > 0)) continue;
    const was = D.tubes.map((c) => c.air);
    stepTubes(D, dt);
    if (BOATS[k] !== boat || onFoot) continue;
    D.tubes.forEach((c, i) => {
      if (was[i] >= 0.55 && c.air < 0.55) hud.flash(`The ${CHAMBERS[i]} tube’s gone soft: she’s sitting lower on that side${i % 2 ? ' and her bow’s heavier in a sea' : ''}. Walk her deck and look her over to pump it up, or bring her in to the Marine Works.`, t, 6);
    });
  }
  if (!pumping) return;
  const P = pumping, D = damages[P.kind];
  const moved = !boat.deck || Math.hypot(boat.deck.x - P.x, boat.deck.z - P.z) > 0.4;
  if (boat.kind !== P.kind || onFoot || moved || Math.abs(boat.speed) > 1.5 || !D?.tubes) {
    pumping = null;
    hud.flash('You leave the pump.', t, 1.6);
    return;
  }
  pumpTubes(D, dt);
  P.t += dt;
  if (P.t >= P.next) {
    P.next = P.t + 1.1;
    audio.pump?.(0.7);
  }
  const low = Math.min(...D.tubes.map((c) => c.air));
  if (low >= 0.999) {
    pumping = null;
    const leaking = D.tubes.filter((c) => c.leak).length;
    hud.flash(`Pumped up: the tubes are firm${leaking ? `. The puncture${leaking > 1 ? 's are' : ' is'} still letting go, slowly: bring her in to the Marine Works to have ${leaking > 1 ? 'them' : 'it'} patched` : ''}.`, t, 5);
    save();
  } else if (Math.floor(P.t) !== Math.floor(P.t - dt)) hud.flash(`Pumping: the softest chamber at ${Math.round(low * 100)}%. Stand still to keep at it.`, t, 1.2);
}
// Knocked about, and stopped: look her over (from her deck, on a boat you walk; sitting in her
// otherwise). What each part of her is like, and the foot pump for a RIB's tubes.
function damageAction() {
  if (onFoot || fishing.busy || pumping || Math.abs(boat.speed) > 1.2) return null;
  const D = damages[boat.kind], wet = (boat.flooding?.litres || 0) > 5;
  if (!D || (hullSound(D) && !wet)) return null;
  if (boat.hull.standing && (!boat.deck || boat.atHelm)) return null;
  return { text: wet && hullSound(D) ? 'Bail her out' : 'Look her over', run: () => lookHerOver() };
}
function lookHerOver() {
  const D = damages[boat.kind], rows = survey(D, boat.kind).filter((r) => r.bad > 0.02);
  const F = boat.flooding, wet = (F?.litres || 0) > 5;
  const say = [...rows.map((r) => `${r.what[0].toUpperCase() + r.what.slice(1)}: ${r.words}.`), wet ? `Water in her: ${Math.round(F.litres)} litres${F.gaining ? ', and coming in' : ''}${boat.pumpRunning ? ' (her pump’s at it)' : ''}.` : ''].filter(Boolean).join(' ');
  const soft = D.tubes?.some((c) => c.air < 0.97), leaking = D.tubes?.some((c) => c.leak);
  const acts = [{ text: 'Leave it', cls: 'quiet', cancel: true, run: () => {} }];
  if (soft) acts.push({ text: 'Pump up the tubes', run: () => startPumping() });
  if (wet) acts.push({ text: boat.hull.cabin || boat.kind === 'cruiser' ? 'Work the hand pump' : 'Bail her out', run: () => startBailing() });
  // (Plugged at sea: a softwood plug or the collision mat in a breach, a leak-stopper in a tube.)
  for (const id of pluggable(D).slice(0, 2)) {
    const [what, key] = id.split(':');
    acts.push({ text: what === 'hull' ? `Plug the hole in ${SECTION_NAMES[key]}` : `Stop the ${CHAMBERS[+key]} tube’s puncture`, run: () => plugIt(id) });
  }
  // (Help from the harbour: anywhere out of it.)
  if (!inMarina(boat.pos) && (!hullSound(D) || wet)) acts.push({ text: 'Radio the harbour for a tow', cls: 'quiet', run: () => askTow() });
  // (Done up at sea with the spanner from her locker: see damage.js tighten.)
  if (D.wiring?.loose) acts.push({ text: 'Do up the battery terminal', run: () => doUp('terminal') });
  if (D.mount > PARTS.mount.tight && !D.tightened) acts.push({ text: 'Do up the bracket bolts', run: () => doUp('mount') });
  ask(boatTitle(boat), `${say} ${leaking ? 'A punctured chamber keeps letting go: the foot pump gets you home, and the Marine Works patches it.' : hullSound(D) ? '' : 'The Marine Works can put it right.'}`.trim(), acts);
}
function doUp(what) {
  const D = damages[boat.kind];
  if (!D || !tighten(D, what)) return;
  audio.clink?.(0.5, 0);
  if (what === 'terminal') {
    BOATS[boat.kind]._dmgBand && (BOATS[boat.kind]._dmgBand.wiring = -1);
    hud.flash('You find the battery terminal hanging by its clamp, clean it and do it up tight with the spanner. Start her again.', t, 4);
    vesselLog(boat.kind, 'Battery terminal done up at sea.');
  } else {
    hud.flash('You do up the bracket’s bolts as tight as the spanner goes: she’ll hold, and push nearly as she should. The yard should still see to it.', t, 5);
    vesselLog(boat.kind, 'The engine’s bracket bolts done up at sea.');
  }
  save();
}
function plugIt(id) {
  const D = damages[boat.kind];
  if (!D || !plugDamage(D, id)) return;
  audio.knock?.(0.35);
  const [what] = id.split(':');
  hud.flash(what === 'hull' ? 'You hammer a softwood plug into the hole and lash the collision mat over it: it still weeps, but a fraction of what it did. It’ll hold till the yard.' : 'You screw a leak-stopper into the puncture: the hiss drops to a whisper. Pump her up, and it’ll hold till the yard.', t, 5);
  vesselLog(boat.kind, what === 'hull' ? 'A breach plugged at sea.' : 'A tube’s puncture stopped at sea.');
  save();
}
// The harbour's help (C6b): the launch comes out, puts their pump and their plugs in her and
// tows her in (to Willowhaven quay; Puerto Brasa down south; the bass boat to the boathouse). How
// long it takes and what they ask go by difficulty; short of money, they take what you have.
const HARBOUR_TOW = { relaxed: { fee: 0, hours: 0.5 }, standard: { fee: 30, hours: 1 }, realistic: { fee: 60, hours: 2 } };
function askTow() {
  const T = HARBOUR_TOW[state.difficulty] || HARBOUR_TOW.standard;
  ask('The harbour office, on the radio', `“We’ll send the launch out with a pump. ${T.hours < 1 ? 'Half an hour' : T.hours > 1 ? 'Two hours, mind' : 'About an hour'}${T.fee ? `, and it’s £${T.fee} for the trouble` : ', and no charge'}.”`, [
    { text: 'Not now', cls: 'quiet', cancel: true, run: () => {} },
    { text: 'Send the launch', run: () => harbourTow() },
  ]);
}
function harbourTow() {
  const T = HARBOUR_TOW[state.difficulty] || HARBOUR_TOW.standard, kind = boat.kind, D = damages[kind];
  if (fishing.lineOut || fishing.aiming) fishing.cancel();
  if (bailing) { BOATS[bailing.kind].bailing = false; bailing = null; }
  pumping = null;
  const south = boat.pos.z > SOUTH_Z, berth = south ? pontoonBerth(boat, true) : null;
  const p = berth || (south ? { x: PONTOON_S.x1 + 6, z: PONTOON_S.z1 + 6, heading: 0 } : kind === 'bass' ? mooring('bass') : quayMooring(boat) || mooring(kind));
  boat.place(p.x, p.z, p.heading);
  if (berth) boat.tieTo({ ...berth, t: 9 });
  else boat.setAnchor(true);
  // (Their pump and their plugs: dry, the holes stopped, the tubes pumped up.)
  if (D) {
    D.water?.fill(0);
    for (const id of pluggable(D)) plugDamage(D, id);
    for (const c of D.tubes || []) c.air = 1;
  }
  passTime(T.hours);
  rig.reset(boat, t);
  const fee = Math.min(T.fee, Math.max(0, state.money || 0));
  if (fee > 0) payOut(state, fee, 'The harbour launch: a tow in');
  audio.knock?.(0.4);
  hud.toast(`The harbour launch comes out, puts a pump and a plug in her and tows you in to ${south ? 'Puerto Brasa' : kind === 'bass' ? 'the boathouse' : 'Willowhaven quay'}: ${T.hours < 1 ? 'half an hour' : T.hours > 1 ? 'two hours' : 'an hour'} gone${fee ? `, £${fee} for their trouble` : T.fee ? ', and they’ll not take your last penny' : ''}. The Marine Works can put her right.`, 8);
  vesselLog(kind, 'Towed in by the harbour launch.');
  save();
}
function startBailing() {
  bailing = { kind: boat.kind, x: boat.deck?.x ?? 0, z: boat.deck?.z ?? 0, t: 0, next: 0 };
  hud.flash('You get the bailer going, a scoop at a time over the side. Keep still to keep at it.', t, 2.5);
}
function startPumping() {
  if (!boat.deck) return;
  pumping = { kind: boat.kind, x: boat.deck.x, z: boat.deck.z, t: 0, next: 0 };
  hud.flash('You get the foot pump out and set to. Stand still to keep at it.', t, 2.5);
}
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
  const host = clock.following ? together.hostWorld()?.sky : null;
  const how = stepWeather(weather, dt, { mode: skyMode(), region, abs: clock.abs, speed, host });
  if (how === 'auto' || how === 'host') galeWarnings();
}
// Warnings of a gale coming: six hours out (time to think about shelter), and an hour and a half
// (time to be in it). Each once.
const galeWarned = new Set();
function galeWarnings() {
  if (!started || region !== 'home') return;
  const abs = clock.abs, h = hoursToGale(abs), g = h != null ? galeNear(abs) : null;
  if (!g) return;
  if (h <= 6 && h > 1.5 && !galeWarned.has(`${g.day}:6`)) {
    galeWarned.add(`${g.day}:6`);
    hud.toast(`Gale warning: a storm about ${formatClock(g.start % 24)} until ${formatClock(g.end % 24)}. Time to finish up and make for shelter.`, 10);
    audio.chime?.();
  }
  if (h <= 1.5 && !galeWarned.has(`${g.day}:1`)) {
    galeWarned.add(`${g.day}:1`);
    hud.toast('The sky’s blackening to the south-west and the wind is rising: the gale’s an hour or so off. If you’re out past the bay, come in now.', 9);
  }
}
// After a blow: what's left of it (1 just as it ends, fading over eight hours), for the fish.
let lastBlow = -1e9;
function blowAfter() {
  const abs = clock.abs;
  if (weather.storm > 0.5) lastBlow = abs;
  return weather.storm > 0.3 ? 0 : clamp(1 - (abs - lastBlow) / 8, 0, 1);
}
// How dull the light is: overcast skies and rain both grey the day.
const gloom = () => Math.max(weather.rain, weather.cloud * 0.72);

// Flies hatch over the stream and lake in the morning and (most of all) the evening;
// a light shower helps, heavy rain stops it.
function hatchLevel() {
  const h = clock.hour;
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

// What the Ocean setting is doing just now, for Settings.
let oceanMode = 'simple';
const oceanText = () => {
  const G = settings.graphics, auto = G.ocean === 'auto';
  if (oceanMode === 'full') return auto ? 'Auto: Full on this device.' : 'Full.';
  if (G.ocean === 'full') return 'This browser can’t work the short waves out on its graphics card, so it’s Simple.';
  return auto ? 'Auto: Simple on this device.' : 'Simple.';
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
  // The Ocean: Full (the short waves worked out on the graphics card) or Simple. Auto: Full on a
  // computer at Medium or above, Simple on a phone or tablet or on Low.
  const oceanWant = G.ocean === 'auto' ? (touch.active || qualityLevel() === 'low' ? 'simple' : 'full') : G.ocean;
  oceanMode = water.setOcean(oceanWant, renderer);
  // (Ocean: Full also draws the wakes far off.)
  farWakes.setQuality(oceanMode === 'full' && q.ripples ? 512 : 0, 512, renderer);
  rainDrawn = q.rain;
  world.setPixelRatio(pr);
  glow.setPixelRatio(pr);
  world.setQuality(q);
  world.drawDistance = q.drawDistance;
  // Fewer distant fish are drawn on lower settings, but every one of them is still there:
  // simulated, able to bite, and on the fish finder.
  fishRenderer.density = q.fishDensity;
  // (The reef's small fish are cheap, one draw a kind, so lower settings thin them less; laid out
  // again at once.)
  drifters.density = 0.4 + 0.6 * q.fishDensity;
  drifters.cx = Infinity;
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
  // (Propeller strikes on the bottom: none on Relaxed. See strikesFor.)
  for (const b of Object.values(BOATS)) {
    b.propStrikes = strikesFor();
    // (What a knock does: on Relaxed, scuffs only. See damage.js MODES.)
    b.damageMode = modeOf(state.difficulty);
    b.floodMode = floodModeOf(state.difficulty);
  }
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
  fishing.expert = C.technique === 'expert';
  haptics.setStrength(C.vibration);
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
  restartSound: () => audio.restart(),
  soundStatus: () => audio.status(),
  qualityText,
  oceanText,
  difficulty: () => state.difficulty,
  setDifficulty,
  behaviour: () => state.behaviour,
  setBehaviour,
  keyLabel: (code) => input.label(code),
  following: () => (clock.following ? together.hostLabel : null),
  together: () => together,
  // (Settings → Play together → Network details: see sharedworld.js.)
  netDiagnostics: () => netDiagnostics(),
  setName: (name) => setName(name),
  // How you look (see looks.js): worn on foot and in every boat, sent to friends.
  look: () => state.look,
  setLook: (L) => setLook(L),
  // A friend code: boats, money or both, each once per game (see giftcodes.js).
  redeem: async (code) => {
    const r = await redeemGift(state, code, KINDS);
    if (r.ok) {
      applyYard();
      save();
      audio.fanfare?.();
      hud.toast(`A friend’s gift: ${giftWords(r.gift)}.`, 6);
    }
    return r;
  },
  boatName: (kind) => BOATS[kind]?.name || 'boat',
  gearName: (pose) => gearWords(pose),
  economy: () => state.economy,
  playStyle: () => styleOf(playStyleNow()),
  setPlayStyle: (id) => applyStyle(id),
  setEconomy: (id) => {
    state.economy = id;
    save();
  },
  // (A taste of the new strength, straight away.)
  feltVibration: (id) => {
    const k = STRENGTHS[id] ?? 0;
    if (k) pads.feel(Math.min(1, 0.9 * k), Math.min(1, 0.5 * k), 0, Math.min(1, 0.7 * k), 260);
  },
});

// The name you go by when playing together (kept with the settings, so a new game keeps it).
function setLook(L) {
  state.look = cleanLook(L);
  wearLook();
  together.renamed();
  save();
}
// Your look on your figure on foot and at the helm of every boat (see looks.js, dress.js).
function wearLook() {
  dressFigure(walker, state.look);
  for (const k of KINDS) dressFigure(BOATS[k], state.look);
}

function setName(name) {
  const n = cleanName(name);
  if (!n || n === settings.player.name) return;
  settings.player.name = n;
  world.coast.ownerSign(n);
  together.renamed();
  save();
}

// The first time you play (or the first time since playing together came along): what should
// friends call you? A name is suggested, so Enter (or the button) is enough.
// One question instead of six (see playstyle.js): the fight, the fish, casting, the engine, the
// throttle and the economy set together.
function playStyleNow() {
  return { difficulty: state.difficulty, behaviour: state.behaviour, cast: settings.controls.cast, technique: settings.controls.technique, start: settings.controls.start, throttle: settings.controls.throttle, sailTrim: settings.controls.sailTrim, economy: state.economy };
}
function applyStyle(id) {
  const S = STYLES[id]?.set;
  if (!S) return;
  setDifficulty(S.difficulty);
  setBehaviour(S.behaviour);
  Object.assign(settings.controls, { cast: S.cast, technique: S.technique, start: S.start, throttle: S.throttle, sailTrim: S.sailTrim });
  state.economy = S.economy;
  applyControls();
  save();
}
function askStyle(then = null, returning = false) {
  state.tips.style = true;
  save();
  setTimeout(() => {
    if (!$('confirm').hidden) {
      then?.();
      return;
    }
    ask('How do you like to play?', `${STYLE_IDS.map((id) => `${STYLES[id].name}: ${STYLES[id].desc}`).join('\n\n')}\n\nChange any of it later in Settings.`, [
      ...(returning ? [{ text: 'Keep my settings as they are', cls: 'quiet', run: () => then?.() }] : []),
      ...STYLE_IDS.map((id) => ({ text: STYLES[id].name, cls: id === 'angler' ? '' : 'quiet', cancel: id === 'angler', run: () => { applyStyle(id); hud.toast(`${STYLES[id].name} it is. Change any of it in Settings → Controls & comfort.`, 5); then?.(); } })),
    ]);
  }, 1800);
}

function askName(then) {
  ask('What should we call you?', 'Friends see it over you when you play together. You can change it in Settings.', [
    {
      text: 'That’s me', keepOpen: true, cancel: true, run: (v) => {
        const n = cleanName(v);
        if (!n) {
          $('confirm-input').focus();
          return;
        }
        $('confirm').hidden = true;
        setName(n);
        then?.();
      },
    },
  ], { input: suggestName(), placeholder: 'Your name', maxLength: NAME_MAX });
  // (With a controller, the suggested name is ready to take with A.)
  if (scheme() === 'pad') $('confirm-acts').lastChild?.focus();
}

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
  // (A moment to see it held up before the card comes: in your hands, or the camera coming round
  // for a look; see reveal.js.)
  fishing.admire = fp ? 1.1 : REVEAL_HOLD;
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

// The finder button (D-pad down, F, the pill): on the head unit it steps through its pages (2D
// sonar, the down view, the two split) and then puts it away; otherwise it opens and closes it.
function finderButton() {
  const F = state.finder;
  if (finder.visible && finder.unit && finder.nextPage) return finder.key('page');
  if (finder.visible && finder.unit) F.page = 'sonar';
  toggleFinder();
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
  // (A question open before the game's begun, the name or how you like to play: the controller
  // answers it, rather than being pulled back to the title's buttons.)
  if (!started) return settingsUI.isOpen || !$('confirm').hidden ? 'menu' : 'title';
  if (modal === 'sleep' || modal === 'travel') return 'off';
  if (!$('confirm').hidden || !$('photo-card').hidden) return 'menu';
  if (modal === 'catch') return 'catch';
  if (modal === 'photo') return 'photo';
  if (modal === 'binocs') return 'binocs';
  if (modal === 'inspect') return 'inspect';
  if (modal === 'rockpool') return 'pool';
  if (modal) return 'menu';
  if (dive) return 'dive';
  if (placement.isOn) return 'place';
  if (driving) return 'drive';
  if (fishing.state === 'reeling') return 'fight';
  // (A line out from a boat under power: the D-pad works the throttle.)
  if (fishing.busy) return leverKind() ? 'troll' : 'fish';
  if (dashCtl.focused) return 'dash';
  if (!onFoot && !cabinIn && boat.motor && twinHelm()) return 'helmtwin';
  if (!onFoot && !cabinIn && boat.motor && ENGINES[boat.kind]?.trim) return 'helmtrim';
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
    if (P) return `${kbd('L-stick')} swim where you look · ${kbd('R-stick')} look · hold ${kbd('LT')} look about · ${K('interact')} up · ${K('tackle')} down · ${K('jog')} kick hard · ${K('cast')} ${tool}`;
    return `${UD} swim where you look · ${LR} turn · drag to look · hold right mouse to look about · ${K('interact')} up · ${K('tackle')} down · hold ${K('jog')} to kick hard · ${K('cast')} ${tool} · ${K('view')} view`;
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
      // (Expert: the lure's depth and speed, and how to work it, from the rod.)
      if (fishing.expert && (fishing.kind === 'lure' || fishing.kind === 'jig')) {
        const d = fishing.baitDepth, v = fishing.relSpeed || 0;
        const read = `Lure ${d < 0.1 ? 'on the top' : `${d.toFixed(1)} m down`} · ${v.toFixed(1)} m/s${fishing.r?.rhythm > 0.3 ? ` · walking the dog ${'●'.repeat(Math.round(fishing.r.rhythm * 6))}` : ''}`;
        const how = P ? `${kbd('R-stick')} the rod (up lifts, down drops, across sweeps) · ${kbd('RT')} reel` : `${UD} the rod · hold ${space} to reel`;
        return `${read} · ${how}`;
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
      // (Beaten and alongside: winding now tears the hook out. The one thing to do is net it.)
      if (F?.atNet) return T ? 'Beaten and alongside: let go, and tap the button to net it' : `Beaten and alongside: let go of ${space}, and tap it to net it`;
      if (F && F.tension > 0.97) return T ? 'The line is straining! Let go of the button' : `The line is straining! Let go of ${space}`;
      if (F?.surgeT > 0) return T ? 'It’s surging! Let go of the button' : `It’s surging! Let go of ${space}`;
      if (F && !F.pulling && F.warned) return 'A flick on the surface: it’s about to run. Ease off';
      if (F?.jumping > 0) return T ? 'It’s leaping! Keep holding: keep the line tight' : `It’s leaping! Keep holding ${space}: keep the line tight`;
      // Its signature move (see fight.js): what it's doing, and the answer.
      const hold = T ? 'Hold the button' : `Hold ${space}`, swing = T ? 'swing the rod low to one side with the stick' : `${LR} swing the rod low to one side`;
      if (F?.move === 'charge') return `It’s coming straight at you! ${hold}: wind fast to keep the line tight`;
      if (F?.shakeT > 0) return `Head-shaking at the top! ${swing}: keep its head down and the line steady`;
      if (F?.pulling && F.move === 'dive') return `It’s diving${F.cover ? ` for the ${F.coverKind === 'rock' ? 'rocks' : 'weed'}` : ' deep'}! ${swing} against it: side strain turns its head · ${drag}`;
      if (F?.pulling && F.move === 'longrun') {
        const follow = followAction() && !following ? ` · ${T ? 'tap the prompt' : K('interact')} to follow it with the boat` : '';
        return `A long run: let it go, rod up, and don’t wind into it${F.extra > 0.5 ? ' · a click more drag slows it' : ''}${follow} · ${drag}`;
      }
      if (F?.move === 'sound') return fishing.expert
        ? 'It’s sounded, a dead weight: pump it up. Lift the rod slowly, then wind down as you lower it'
        : `It’s sounded, a dead weight: pump it up in strokes. ${hold} a moment, let go, and again`;
      if (F?.move === 'circle' && !F.pulling) return F.coming ? `Circling below: it’s coming up the near side. ${hold}: wind!` : 'Circling below: it’s going round the far side. Hold off winding';
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
  // Walking the deck: how to walk, and how to take her again.
  if (!onFoot && boat.deck) {
    const how = T ? 'the stick walks you about her' : `${P ? kbd('L-stick') : MOVE()} walk`;
    return boat.atHelm ? `At the wheel · ${T ? 'tap the prompt' : K('interact')} to take the helm · ${how}` : `Walking the deck · ${how} · back at the wheel to take the helm`;
  }
  // The trolling motor down (see trolling.js): the keys are its push and its head.
  if (leverKind() && boat.troll?.deployed && !boat.lever) {
    const M = boat.troll, pc = Math.round((tanks().troll[boat.kind] ?? 1) * 100);
    if (M.mode === 'lock') return `Spot-Lock: holding her, ${M.off.toFixed(1)} m off her spot · ${K('spotlock')} let go · ${K('trolling')} stow the motor · battery ${pc}%`;
    if (T) return `Trolling motor: the stick up or down for its push, across to turn its head · battery ${pc}%`;
    return `Trolling motor: ${P ? `${kbd('L-stick')} ↕` : UD} push · ${P ? '↔' : LR} turn its head${M.gps ? ` · ${K('spotlock')} ${Math.abs(trollPush) > 0.05 ? 'hold this heading' : 'Spot-Lock'}` : ''} · ${K('trollDepth')} depth · ${K('trolling')} stow · ${K('throttleUp')} main engine (stops it) · battery ${pc}%`;
  }
  if (leverKind()) {
    const kind = leverKind(), lv = boat.lever;
    const dead = kind === 'kayak' ? boat.kflat : boat.trolling ? boat.flat : boat.dry && Math.abs(lv) >= 0.03;
    const smooth = settings.controls.throttle === 'lever';
    const word = boat.anchored ? 'at anchor' : dead ? (kind === 'kayak' ? 'battery flat' : 'the motor’s dead: an oar, slowly') : smooth ? leverPositionWords(leverPos(kind)) : leverWords(kind, lv);
    const notch = smooth ? 'throttle' : 'a notch';
    const fuel = kind === 'kayak' ? batteryWords(tanks(), 'kayak') : fuelHint(boat.kind);
    // (The engine off, on the one-button start or the full procedure: how to start her.)
    const Eo = engineHere();
    if (Eo && !engineRunning(Eo) && !engineCranking(Eo) && !Eo.auto && startMode() !== 'go' && !boat.dry) {
      const how = startMode() === 'full' ? 'the helm panel' : ENGINES[Eo.kind].starter === 'pull' ? 'pull the starter cord' : 'start the engine';
      return T ? `Engine off · tap the prompt to ${how}` : `Engine off · ${K('motor')} ${how} · ${fuel}`;
    }
    const motor = kind === 'kayak' ? ` · ${T ? 'Raise motor to paddle' : `${K('motor')} raise it and paddle`}` : kind === 'sail' ? ` · ${T ? 'Raise the outboard on the lever' : `${K('outboard')} outboard up`}` : '';
    if (T) return `${kind === 'kayak' ? 'Motor' : 'Throttle'}: ${word} · the stick: up or down ${smooth ? 'for the throttle' : 'a notch'}, across to steer · Stop on the lever · ${fuel}`;
    if (P) return `${kind === 'kayak' ? 'Motor' : 'Throttle'}: ${word} · ${kbd('L-stick')} ↕ ${notch}, ↔ steer · ${K('neutral')} stop · ${K('anchor')} anchor${motor} · ${fuel}`;
    return `${kind === 'kayak' ? 'Motor' : 'Throttle'}: ${word} · ${UD} ${notch} · ${LR} steer · ${K('neutral')} stop · ${K('anchor')} anchor${motor} · ${fuel}`;
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
  if (fishing.state === 'reeling' && fishing.fight?.atNet) return 'Net it';
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
    if (!el.hidden) el.hidden = true;
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
  const mx = Math.max(m, markerWidth(el) / 2 + 10);
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
// A marker's width, measured again only when what it says (or how it's styled) has changed, or
// the fonts or the window have: reading it makes the browser lay the page out there and then,
// after this frame's moving of the other markers. (Hidden, it has none.)
let markerLayout = 0;
document.fonts?.addEventListener?.('loadingdone', () => markerLayout++);
addEventListener('resize', () => markerLayout++);
function markerWidth(el) {
  if (el.hidden) return 0;
  const key = `${markerLayout}|${el.className}|${el.textContent}`;
  if (el._wKey !== key) {
    el._w = el.offsetWidth || 0;
    el._wKey = key;
  }
  return el._w;
}

// The conditions panel: the wind and sea where you are, and the current at your rig if it's in
// the water (or under you). Directions are arrows as you see them, with the compass in words.
let condT = 0;
function updateConditionsPanel(dt) {
  const el = $('conditions');
  // The clean screen (Settings, Graphics): the panel while it matters (a line out, the sail up);
  // the rod pill out of the way while you're going somewhere.
  const clean = settings.graphics.screen === 'clean', afloat = !onFoot && !driving && !dive;
  const busy = fishing.state !== 'idle' || (afloat && !!boat.sailUp);
  document.body.classList.toggle('screen-clean', clean);
  document.body.classList.toggle('underway', clean && ((afloat && boat.speed > 2 && fishing.state === 'idle') || driving));
  const show = started && !hudOff && !modal && settings.weather.panel && (!clean || busy);
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
  $('cd-tide').textContent = tideWords(clock.abs);
  const wz = waterOf(zoneAt(P.x, P.z));
  $('cd-water').textContent = `${tempWords(waterTempAt(P.x, P.z))}, ${wz === 'fresh' ? 'fresh' : `${wz === 'brackish' ? 'brackish, ' : ''}${colourWords(seaColourNow())}`}`;
}

function updateHud() {
  const h = clock.hour, sh = sunHour(h, clock.abs);
  const night = sh >= 20.5 || sh < 5.5;
  const w = weather.storm > 0.5 ? 'Storm' : weather.rain > 0.6 ? 'Heavy rain' : weather.rain > 0.15 ? 'Light rain' : weather.cloud > 0.7 ? 'Overcast' : '';
  hud.clock(formatClock(h), `${phaseName(sh)} · ${seasonWords(clock.day).toLowerCase()}`, w, night);
  // How you feel, in a word or two by the clock (the worst first), and well fed when you are.
  const needs = needsMode() === 'off' ? [] : needsOf(state.comfort, state.food);
  const words = needs.slice(0, 2).map((n) => n.word);
  if (camp.wellFed && !needs.some((n) => n.id === 'hungry' || n.id === 'peckish')) words.push('Well fed');
  hud.food(words.join(' · '), needs.some((n) => n.low) ? 'hungry' : camp.wellFed ? 'fed' : '');
  const FF = fishing.state === 'reeling' ? fishing.fight : null;
  hud.hint(currentHint(), t, !!FF && (FF.tension > 0.9 || FF.surgeT > 0 || FF.atNet || FF.move === 'charge' || FF.shakeT > 0 || (FF.jumping ?? 0) > 0));
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
    // (Each signature move has its own answer: see fight.js.)
    const move = F.move === 'charge' ? 'wind!' : F.shakeT > 0 ? (fishing.side ? 'steady' : 'rod low!') : F.pulling && F.move === 'dive' ? (fishing.side ? 'turn it' : 'side strain!')
      : F.pulling && F.move === 'longrun' ? 'let it run' : F.move === 'sound' ? 'pump!' : F.move === 'circle' && !F.pulling ? (F.coming ? 'wind' : 'hold') : '';
    const word = F.atNet ? `net it: tap ${K('cast')}` : F.surgeT > 0 ? 'easy!' : easy ? 'flick!' : F.tension > 0.9 ? 'ease off!' : move || (F.slipping ? 'line out' : F.pulling ? 'hold' : 'reel');
    const doing = F.wordT > 0 ? F.word : fishing.side && F.pulling ? `side strain ${fishing.side < 0 ? '←' : '→'}` : F.stage !== 'fresh' ? F.stage : '';
    const out = Math.round(fishing.tip.distanceTo(fishing.fishPos));
    // (On a long run, how much is left on the spool.)
    const left = F.extra > 0.5 ? Math.max(0, Math.round(100 * (1 - (F.dist * (1 - F.progress) + F.extra) / F.spool))) : null;
    const outText = `${out} m out${left != null ? ` · spool ${left}%` : ''}${following ? ' · following' : ''}`;
    // (The word itself goes at the top of the screen, where you're looking while a fish is on: the
    // ring keeps the line out and the spool.)
    const danger = F.tension > 0.86 || (left != null && left < 20);
    hud.meter(true, F.progress, F.tension, F.tension, `<span class="ml-sub">${outText}</span>`, DRAG_LEVELS[F.drag], easy, danger);
    hud.coach(word, doing, easy, danger);
  }
  else hud.meter(false);
  if (!(fishing.state === 'reeling' && F)) hud.coach('');

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
  placeMarker($('boat-marker'), boat.pos.x, boat.heave + 1.6, boat.pos.z, started && onFoot && !driving && !modal && !nearBoat() && !indoorsAt(walker.pos.x, walker.pos.z) && !guiding);
  const carD = Math.hypot(car.pos.x - player().pos.x, car.pos.z - player().pos.z);
  // (Not twice over: when the guide is pointing at the car, its marker is the one.)
  const guideOnCar = guiding && guideTarget?.label === 'Car';
  placeMarker($('car-marker'), car.pos.x, car.pos.y + 2.2, car.pos.z, started && onFoot && !driving && !dive && !modal && carD > 18 && carD < 600 && !carHome() && !guideOnCar);
  const campD = Math.hypot(player().pos.x - cp.x, player().pos.z - cp.z);
  placeMarker($('camp-marker'), cp.x, cp.y + 2.4, cp.z, started && !modal && !dive && campD > 14 && !guiding && !(onFoot && indoorsAt(walker.pos.x, walker.pos.z)) && (onFoot ? campD < 400 : !state.places.camp && !!state.tips.caught));
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
    const tn = fishById[trip.sp].name;
    if ($('trip-name').textContent !== tn) $('trip-name').textContent = tn;
  }
  // The crossing: where to steer for now (across, round the point, into the harbour).
  if (crossAim && $('cross-name').textContent !== crossAim.name) $('cross-name').textContent = crossAim.name;
  placeMarker($('cross-marker'), crossAim?.x ?? 0, 6, crossAim?.z ?? 0, !!crossAim && started && !modal && !dive);
  placeMarker($('trip-marker'), trip?.x ?? 0, 1.2, trip?.z ?? 0, !!trip && started && !modal && Math.hypot((trip?.x ?? 0) - player().pos.x, (trip?.z ?? 0) - player().pos.z) > (trip?.r ?? 0));
  // The next mark of a job you've taken (one marker, not one for each).
  const job = jobTarget();
  if (job && $('job-name').textContent !== job.name) $('job-name').textContent = job.name;
  // (The story's next place says so, not "Job".)
  if (job && $('job-kind').textContent !== (job.story ? 'Story' : 'Job')) $('job-kind').textContent = job.story ? 'Story' : 'Job';
  placeMarker($('job-marker'), job?.x ?? 0, 1.5, job?.z ?? 0, !!job && started && !modal && !dive && Math.hypot((job?.x ?? 0) - player().pos.x, (job?.z ?? 0) - player().pos.z) > 15);
  placeFriendMarkers();
  placeShoalMarkers();
}

// Friends you're playing with: their name over them, or pinned to the edge of the screen pointing
// the way to them (with how far), so you can always find each other.
const friendMarkers = new Map();
let friendsKey = '';
function placeFriendMarkers() {
  // (Settings → Play together lists who's where: kept up to date while it's open.)
  if (settingsUI.isOpen && settingsUI.tab === 'together' && together.active) {
    const key = together.others.map((p) => `${p.name}:${p.pose?.m}:${p.pose?.k}:${p.pose?.f}:${p.pose?.a}:${p.pose?.o}:${p.pose?.r}:${p.pose?.i}`).join('|');
    if (key !== friendsKey) {
      friendsKey = key;
      settingsUI.render();
    }
  }
  for (const [id, el] of friendMarkers) {
    if (together.peers.has(id)) continue;
    el.remove();
    friendMarkers.delete(id);
  }
  for (const p of together.peers.values()) {
    if (!p.name || !p.pose || !p.at) continue;
    let el = friendMarkers.get(p.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'marker friend';
      el.dataset.km = 'exact';
      el.setAttribute('aria-hidden', 'true');
      const arrow = document.createElement('span'), label = document.createElement('span'), name = document.createElement('span');
      arrow.className = 'm-arrow';
      label.className = 'm-label';
      name.className = 'm-name';
      label.append(name, ' · ', document.createElement('b'));
      el.append(arrow, label);
      $('boat-marker').before(el);
      friendMarkers.set(p.id, el);
    }
    const P = p.view || p.pose, A = p.at;
    // (Their latest call shows with their name for a few seconds; a fish on, while it's on, with
    // what it's doing; a catch, what it was, for a few seconds after.)
    const call = p.call && together.clock - p.call.at < 7 ? p.call.text : P.o ? FISH_MOVE_WORDS[P.mv] || 'fish on!' : p.landed && together.clock - p.landed.at < 8 ? p.landed.text : '';
    const text = P.m === 'dive' ? `${p.name} (diving)` : P.m === 'car' ? `${p.name} (driving)` : p.name;
    const nameEl = el.querySelector('.m-name');
    if (nameEl.textContent !== text) nameEl.textContent = text;
    let callEl = el.querySelector('.m-call');
    if (call && !callEl) {
      callEl = document.createElement('span');
      callEl.className = 'm-call';
      nameEl.after(callEl);
    }
    if (callEl) {
      const words = call ? `: ${call}` : '';
      if (callEl.textContent !== words) callEl.textContent = words;
    }
    el.classList.toggle('calling', !!call);
    // (Under their name, what they're fishing with.)
    const gear = P.m === 'foot' || P.m === 'boat' ? gearWords(P) : '';
    let gearEl = el.querySelector('.m-gear');
    if (gear && !gearEl) {
      gearEl = document.createElement('span');
      gearEl.className = 'm-gear';
      el.querySelector('.m-label').append(gearEl);
    }
    if (gearEl && gearEl.textContent !== gear) gearEl.textContent = gear;
    // (Crewing in a boat: over them where they stand in her.)
    const C = P.cr ? visitors.crewAt(P, together.id, onFoot ? null : boat) : null;
    // (Diving: over their diver, under the water with them.)
    const Dv = P.m === 'dive' ? visitors.diverAt(p.id) : null;
    const y = C ? C.y + 2.2 : Dv ? Dv.y + 0.8 : P.m === 'boat' ? waveHeight(A.x, A.z, t) + 3 : P.m === 'foot' ? walkHeight(A.x, A.z) + 2.4 : P.m === 'car' ? heightAt(A.x, A.z) + 2.6 : 1.2;
    placeMarker(el, C ? C.x : A.x, y, C ? C.z : A.z, started && !modal);
  }
}

const fishOnSaid = {};
let friendMapT = 0;
// Friends for the map: where they are, in what, in their own colour.
function friendsOnMap() {
  return together.others.filter((p) => p.at && (p.view || p.pose)).map((p) => {
    const P = p.view || p.pose;
    return { name: p.name, x: p.at.x, z: p.at.z, heading: p.at.h, mode: P.m, boat: P.m === 'boat' ? BOATS[P.k]?.name : null, colour: visitors.colourOf(p.name), on: !!P.o };
  });
}
// How far and which way a friend is, in a few words, for the news of them.
function friendWhere(p) {
  if (!p.at) return '';
  const P = player().pos, d = Math.hypot(p.at.x - P.x, p.at.z - P.z);
  if (d < 25) return '(right by you)';
  return `(${d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d / 10) * 10} m`} ${compass(bearingOf(p.at.x - P.x, p.at.z - P.z))})`;
}

/* ---------- quick calls ---------- */

function renderCalls() {
  const button = (key, text, run) => {
    const b = document.createElement('button');
    b.type = 'button';
    const k = document.createElement('kbd');
    k.textContent = key;
    b.append(k, text);
    b.addEventListener('click', run);
    return b;
  };
  const list = CALLS.map((text, i) => button(String(i + 1), text, () => sendCall(i)));
  // A shoal near you: mark it, and your friends' screens follow it (see teamwork.js).
  const s = teamwork.shoalNear(player().pos);
  if (s) list.push(button(String(CALLS.length + 1), `Mark this shoal (${s.sp.name.toLowerCase()})`, () => markShoal()));
  $('calls-list').replaceChildren(...list);
}
function markShoal() {
  closeCalls();
  const s = teamwork.shoalNear(player().pos);
  if (!s) return hud.flash('No shoal near enough to mark.', t, 2);
  if (teamwork.mark(s)) hud.toast(`You mark the shoal of ${s.sp.name.toLowerCase()} for your friends: the mark goes with it.`, 4);
  else hud.flash('A moment between marks.', t, 2);
}
// Marked shoals, each a label over where its shoal is now (the same shoal on every screen).
function placeShoalMarkers() {
  const live = together.active ? teamwork.live() : [];
  const keep = new Set();
  for (const m of live) {
    keep.add(m.key);
    let el = shoalMarkers.get(m.key);
    if (!el) {
      el = document.createElement('div');
      el.className = 'marker shoal';
      el.dataset.km = 'round';
      el.setAttribute('aria-hidden', 'true');
      const arrow = document.createElement('span'), label = document.createElement('span');
      arrow.className = 'm-arrow';
      label.className = 'm-label';
      label.append(document.createElement('span'), ' · ', document.createElement('b'));
      el.append(arrow, label);
      $('boat-marker').before(el);
      shoalMarkers.set(m.key, el);
    }
    const words = `${m.name} shoal: ${m.sp.toLowerCase()}`, name = el.querySelector('.m-label span');
    if (name.textContent !== words) name.textContent = words;
    placeMarker(el, m.x, waveHeight(m.x, m.z, t) + 1.5, m.z, started && !modal);
  }
  for (const [key, el] of shoalMarkers) {
    if (keep.has(key)) continue;
    el.remove();
    shoalMarkers.delete(key);
  }
}
/* ---------- crewing (see crew.js) ---------- */

// A friend's boat you could step aboard from where you are (extra: half your own boat's length,
// stepping across from her): drawn here, stopped, within reach. { p, b } or null.
function crewBoatNear(extra = 0) {
  if (!together.active || crew.on || dive || driving || sitting) return null;
  const P = player().pos;
  let best = null, bd = Infinity;
  for (const p of together.peers.values()) {
    const Q = p.view || p.pose;
    if (!p.name || Q?.m !== 'boat' || !p.at || (p.at.v || 0) > CREW_SLOW) continue;
    const b = visitors.boatOf(p.id);
    if (!b) continue;
    const d = Math.hypot(b.pos.x - P.x, b.pos.z - P.z);
    if (d < b.hull.L * 0.5 + CREW_REACH + extra && d < bd) {
      bd = d;
      best = { p, b };
    }
  }
  return best;
}

function stepAboard({ p, b }) {
  if (fishing.busy) fishing.cancel();
  crewFrom = onFoot ? { spot: { x: walker.pos.x, z: walker.pos.z, heading: walker.heading } } : { boat };
  if (!onFoot) {
    boat.setDeck?.(false);
    walker.place(b.pos.x, b.pos.z, b.heading);
    setFoot(true, true);
  }
  // (Clear of the skipper at the helm and anyone crewing in her already.)
  const others = [{ x: b.hull.seatX ?? 0, z: b.hull.seatZ ?? 0 }];
  for (const q of together.peers.values()) {
    const Q = q.view || q.pose;
    if (q.id !== p.id && Q?.cr === p.id) others.push({ x: Q.cx, z: Q.cz });
  }
  crew.board(p.id, b.hull, others);
  audio.knock(0.4);
  hud.toast(`You step aboard ${p.name}’s ${b.hull.name}. Walk about her, fish from her, net their fish for them; ${scheme() === 'touch' ? 'the prompt' : K('interact')} to take the helm while they fish, or to step off.`, 8);
}

// Each frame while crewing: stood in her where you are, going with her; the keys walk you about her.
function rideCrew(dt) {
  const O = crew.on, p = together.peers.get(O.id), b = visitors.boatOf(O.id), Q = p && (p.view || p.pose);
  if (!together.active || !p || !b || Q?.m !== 'boat' || !onFoot || dive || driving) return crewLost(p);
  // (The keys are camera-relative: turned into her own across, and fore and aft.)
  const moving = !O.helm && (move.x || move.z);
  if (moving) crew.walk(-(move.x * b.right.x + move.z * b.right.z), move.x * b.fwd.x + move.z * b.fwd.z, b.hull, dt);
  const C = visitors.crewAt({ cr: O.id, cx: O.x, cz: O.z });
  if (!C) return crewLost(p);
  _crewAt.set(C.x, C.y, C.z);
  walker.ride(dt, t, _crewAt, moving ? Math.atan2(move.x, move.z) : walker.heading, b.vel, !!moving);
}

// Off a friend's boat: back where you came from if you can, or straight into your own boat.
function leaveCrew(to = null) {
  crew.leave();
  const from = crewFrom;
  crewFrom = null;
  if (to?.boat || (!to && from?.boat)) {
    const B = to?.boat || from.boat;
    walker.place(B.pos.x, B.pos.z, B.heading);
    board(B);
  } else {
    const S = to?.spot || from?.spot;
    if (S) walker.place(S.x, S.z, S.heading);
    save();
  }
}

// The boat you were crewing in has gone (your friend left, went ashore, or the session ended).
function crewLost(p) {
  const name = p?.name || 'your friend';
  const from = crewFrom;
  leaveCrew(from?.boat ? { boat: from.boat } : null);
  hud.toast(from?.boat ? `${name}’s boat has gone: you’re back in your own.` : `${name}’s boat has gone: you’re back where you stepped aboard.`, 6);
}

// What you can do from here: the helm, or step off (onto your own boat alongside, or ashore).
function crewChoices() {
  const O = crew.on, p = together.peers.get(O.id), name = p?.name || 'your friend';
  const opts = [];
  if (O.helm) opts.push({ text: 'Hand back the helm', run: () => { crew.handBack(); hud.flash(`You hand the helm back to ${name}.`, t, 2); } });
  else opts.push({ text: 'Take the helm', run: () => { if (crew.askHelm()) hud.flash(`You ask ${name} for the helm…`, t, 2); } });
  const P = walker.pos;
  const mine = boats.find((B) => Math.hypot(B.pos.x - P.x, B.pos.z - P.z) < B.hull.L * 0.5 + 4);
  if (mine) opts.push({ text: `Step back into your ${mine.name}`, cls: 'quiet', run: () => leaveCrew({ boat: mine }) });
  const spot = (p?.at?.v || 0) < CREW_SLOW ? shoreSpot(P) : null;
  if (spot) opts.push({ text: spot.pier ? 'Step onto the jetty' : 'Step ashore', cls: 'quiet', run: () => leaveCrew({ spot }) });
  if (!mine && !spot) opts.push({ text: 'Back to your own boat (off the session’s map)', cls: 'quiet', run: () => leaveCrew(crewFrom?.boat ? { boat: crewFrom.boat } : null) });
  ask(`${name}’s boat`, O.helm ? 'You have the helm: the keys steer her and work her throttle.' : 'Crewing for them: fish, watch the sonar, net their fish.', opts);
}

// Why you won't hand over your helm just now, or null.
function helmRefusal() {
  if (onFoot) return 'they’re not aboard';
  if (boat.sailUp && (boat.hull.sail || boat.hull.rig)) return 'she’s under sail';
  if (cabinIn) return 'they’re in the cabin';
  return null;
}

// A crew word from a friend: your helm asked for, given, handed back or taken back.
function crewWord(p, d) {
  const r = crew.heard(p, d);
  if (r === 'granted') hud.toast(`${p.name} hands you the helm: steer and work her throttle as if she were yours. ${scheme() === 'touch' ? 'The prompt' : K('interact')} to hand it back.`, 6);
  else if (r === 'refused') hud.toast(`${p.name} keeps the helm${d.w ? `: ${d.w}` : ''}.`, 4);
  else if (r === 'returned') hud.flash(`${p.name} has the helm back.`, t, 3);
  else if (r === 'handed') hud.flash(`${p.name} hands the helm back to you.`, t, 3);
  else if (r === 'asked') {
    const why = helmRefusal() || (crew.given && crew.given.id !== p.id ? 'someone else has it' : null);
    if (why) crew.deny(p, why);
    else if (crew.grant(p)) hud.toast(`${p.name} has the helm. Touch the controls at the wheel to take it back.`, 6);
  }
}

// A friend netting your fish for you, or thanking you for netting theirs.
function friendHelp(p, d) {
  if (d.e === 'net') {
    const F = fishing.fight;
    if (!teamwork.mayNet(p, d.f, F, fishing.fishPos)) return;
    const kg = F.agent?.weight ?? weightOf(F.sp, F.size);
    fishing.netFish();
    hud.flash(`${p.name} nets it for you!`, t, 3);
    teamwork.thank(p, d.f, F.sp.name, kg);
  } else if (d.e === 'thanks') hud.toast(`You netted ${p.name}’s ${d.sp ? d.sp.toLowerCase() : 'fish'}${d.kg ? `, ${kgWords(d.kg)}` : ''}. Nice work.`, 5);
}
function openCalls() {
  if (!together.active) return;
  renderCalls();
  $('calls').hidden = false;
  $('calls-list').firstElementChild?.focus();
}
function closeCalls() {
  $('calls').hidden = true;
}
const callsOpen = () => !$('calls').hidden;
function sendCall(i) {
  closeCalls();
  if (together.call(i)) hud.toast(`You call: “${CALLS[i]}”`, 3);
  else hud.flash('A moment between calls.', t, 2);
}
$('call-btn').addEventListener('click', () => (callsOpen() ? closeCalls() : openCalls()));
addEventListener('pointerdown', (e) => {
  if (callsOpen() && !e.target.closest?.('#calls, #call-btn')) closeCalls();
});

// Where you are and what you're doing, for the friends you're playing with.
// Everyone the sea answers to (see sharedworld.js and sealife.js): you first, then (in a session)
// each friend, where they are, their boat if they're afloat (the one drawn here, so a pod on its
// bow is on the bow you see), and which sea they're in.
// What the session's doing on the wire, for Settings: each kind of message's rate and size, the
// shared sea's delay and what it covers.
// A friend's fish, fighting at the end of their line: the very fish from the shared sea, on every
// screen (the host's water says whose it is: see sharedworld.js), where their line meets the water,
// deep while it dives or sounds, out of the water as it leaps.
function placeFriendsFish(t) {
  if (shared.role === 'off') return;
  for (const p of together.peers.values()) {
    const P = p.view || p.pose;
    if (!P?.o || P.hk == null || !p.at) continue;
    const a = eco.agents[P.hk];
    if (!a || a === fishing.fight?.agent || a.state !== 'hooked') continue;
    // (Theirs if the host's water says so: hosting, a strike you've checked; following, the host's word.)
    if (shared.role === 'host' ? a.hookedBy !== p.id : a.remoteHook !== (p.id === together.hostId ? 'host' : p.id)) continue;
    const e = visitors.lineEnd(p.id) || (P.ex != null ? { x: P.ex, z: P.ez } : null);
    if (!e) continue;
    const mv = P.mv || 'run', lv = waveHeight(e.x, e.z, t);
    const y = mv === 'jump' ? lv + 0.35 + Math.abs(Math.sin(t * 3.1)) * 0.5 : mv === 'dive' || mv === 'sound' ? lv - 2.5 : mv === 'circle' ? lv - 1.6 : lv - 0.35;
    const away = Math.atan2(e.x - p.at.x, e.z - p.at.z);
    eco.placeHooked(a, e.x, y, e.z, away + Math.sin(t * (mv === 'shake' ? 14 : 2.2)) * (mv === 'shake' ? 0.5 : 0.25), mv === 'run' || mv === 'longrun' || mv === 'charge' ? 1 : 0.5);
  }
}

function netDiagnostics() {
  if (!together.active) return null;
  const U = together.stats, secs = Math.max(1, (Date.now() - U.since) / 1000), S = shared.stats;
  const NAMES = { pose: 'where everyone is', eco: 'the shared sea', world: 'time and weather', fleet: 'boats in the water', presence_diff: 'joining and leaving', presence_state: 'who’s here', ask: 'asked of the host', fish: 'fish news to a guest', crew: 'crewing and the helm', help: 'netting for a friend', shoal: 'marked shoals' };
  const kinds = Object.entries(U.kinds || {}).filter(([, k]) => k.in + k.out > 0).sort((a, b) => (b[1].bytesIn + b[1].bytesOut) - (a[1].bytesIn + a[1].bytesOut)).slice(0, 6);
  const lines = kinds.map(([k, v]) => `${NAMES[k] || k}: ${((v.in + v.out) / secs * 60).toFixed(0)} messages a minute, ${((v.bytesIn + v.bytesOut) / secs / 1024).toFixed(1)} KB/s`);
  if (shared.role === 'host') lines.push(`The shared sea: you’re keeping it for everyone. ${S.sent} snapshots sent, the last covering ${S.animals} groups of sea life and ${S.schools} shoals near someone; ${S.rigs ? `${S.rigs} of your friends’ rigs in your water, ` : ''}${S.fish} fish going for a rig or hooked.`);
  else if (shared.role === 'follower') lines.push(`The shared sea: following the host’s. ${S.got} snapshots heard${S.heardAt != null ? `, the last ${Math.max(0, together.now() - S.heardAt).toFixed(1)} s ago, ${S.delay.toFixed(2)} s on the way` : ''}; ${S.schools} shoals, ${S.animals} groups of sea life and ${S.fish} fish being fished for in it${S.rejected ? `; ${S.rejected} turned away` : ''}${S.stale ? `, ${S.stale} out of date` : ''}.`);
  // Supabase counts every message sent from or delivered to each player, a second at a time, against
  // the project's plan (100 a second on the Free plan, 500 on Pro): the whole session's, about.
  const players = together.others.length + 1, mine = (U.in + U.out) / secs;
  lines.push(`The whole session: about ${Math.round(mine * players)} messages a second sent and delivered across all ${players} of you (Supabase allows 100 a second on the Free plan, 500 on Pro).`);
  return lines;
}

function viewersNow() {
  const P = player().pos, aboard = !onFoot && !driving && !dive && !cabinIn;
  const out = [{ id: together.active ? together.id : 'me', from: P, boat: aboard ? boat : null, boatSpeed: aboard ? Math.abs(boat.forwardSpeed) : 0, diving: !!dive, region, crossing: !!state.crossing || inOcean(P.x, P.z) }];
  if (!together.active) return out;
  for (const p of together.peers.values()) {
    if (!p.at || !p.pose || !p.name) continue;
    const Q = p.view || p.pose, A = p.at;
    let b = null;
    if (Q.m === 'boat') {
      b = visitors.boatOf(p.id);
      if (!b) {
        // (Too far off to be drawn here: where their pose says, as much of a boat as the sea needs.)
        b = _vb.get(p.id) || { pos: { x: 0, z: 0 }, fwd: { x: 0, z: 1 }, right: { x: -1, z: 0 }, heading: 0, hull: { L: 4 } };
        _vb.set(p.id, b);
        b.pos.x = A.x;
        b.pos.z = A.z;
        b.heading = A.h;
        b.fwd.x = Math.sin(A.h);
        b.fwd.z = Math.cos(A.h);
        b.right.x = -Math.cos(A.h);
        b.right.z = Math.sin(A.h);
        b.hull.L = BOATS[Q.k]?.hull?.L ?? 4;
      }
    }
    out.push({ id: p.id, from: { x: A.x, z: A.z }, boat: b, boatSpeed: b ? A.v || 0 : 0, diving: Q.m === 'dive', region: A.z > SOUTH_Z ? 'south' : 'home', crossing: inOcean(A.x, A.z) });
  }
  return out;
}

function whereIAm() {
  if (dive) return { m: 'dive', x: diver.pos.x, z: diver.pos.z, h: diver.heading, y: diver.pos.y, pt: diver.bodyPitch, kt: diver.kit === 'scuba' ? 's' : 'f', kk: diver.kicking };
  if (driving) return { m: 'car', x: car.pos.x, z: car.pos.z, h: car.heading };
  const on = fishing.state === 'reeling' || fishing.state === 'landing';
  // (Fishing, your friends see your rod, what's on it, and your line out to where it meets the
  // water, or to the fish.)
  const landing = fishing.state === 'landing' && !!fishing.fight;
  const gear = fishing.lineOut || landing ? { r: fishing.rod?.id, i: fishing.item?.id } : null;
  if (gear && (fishing.baitInWater || landing)) {
    const e = fishing.state === 'reeling' || landing ? fishing.fishPos : fishing.bob, F = fishing.fight;
    Object.assign(gear, { ex: e.x, ez: e.z, tn: F?.tension, hk: F?.agent?.id, nt: F?.atNet ? 1 : 0 });
    // (What the fish is doing, so they can see it at the end of your line; what it is, and how
    // big, so they see it leap and crash back in as itself.)
    if (F && landing) gear.mv = 'land';
    else if (F && !F.atNet) gear.mv = F.jumping > 0 ? 'jump' : F.shakeT > 0 ? 'shake' : F.move === 'charge' ? 'charge' : F.move === 'sound' ? 'sound' : F.move === 'circle' && !F.pulling ? 'circle' : F.pulling ? (F.move === 'dive' || F.move === 'longrun' ? F.move : 'run') : undefined;
    if (F) Object.assign(gear, { sp: F.sp.id, sz: Math.round(F.size) });
  }
  if (onFoot && crew.on) return { m: 'foot', x: walker.pos.x, z: walker.pos.z, h: walker.heading, a: fishing.lineOut ? 'fish' : walker.moving ? 'walk' : 'stand', o: on, cr: crew.on.id, cx: crew.on.x, cz: crew.on.z, ...gear };
  if (onFoot) return { m: 'foot', x: walker.pos.x, z: walker.pos.z, h: walker.heading, a: sitting ? 'sit' : fishing.lineOut ? 'fish' : walker.speed > 0.4 ? 'walk' : 'stand', o: on, ...gear };
  // (Her bow trolling motor, where it is: friends see it stowed, swinging down, or at work.)
  const T = boat.troll, tr = T ? trollWire(T.tier, T.mech, T.angle, T.f > 20 || (boat.bowNotch > 0 && T.deployed)) : undefined;
  return { m: 'boat', k: boat.kind, x: boat.pos.x, z: boat.pos.z, h: boat.heading, f: fishing.lineOut, s: !!boat.sailUp, n: !!(boat.anchored || boat.tie), o: on, ...(tr ? { tr } : {}), ...gear };
}
// A friend's fish, as it fights at the end of their line.
const FISH_MOVE_WORDS = { run: 'fish on! it’s running', jump: 'fish on! it’s leaping', shake: 'fish on! head-shaking', charge: 'fish on! it’s charging', dive: 'fish on! it’s diving', longrun: 'fish on! a long run', sound: 'fish on! it’s sounding', circle: 'fish on! it’s circling' };
// What a friend is fishing with, in a few words: "light rod, spinner".
const gearWords = (P) => {
  const R = RODS[P?.r], I = TACKLE[P?.i];
  return R ? `${R.short.toLowerCase()}${I ? `, ${(I.short || I.name).toLowerCase()}` : ''}` : '';
};

// Your boats in the water as your friends see them: where each is lying (but the one you're in).
together.fleetSource = () => boats.filter((b) => !(b === boat && !onFoot)).map((b) => ({ k: b.kind, x: b.pos.x, z: b.pos.z, h: b.heading }));
// Playing in a friend's session you're a visitor in their harbour: your Willowhaven boats lying at
// Willowhaven go to the visitors' row (theirs is the finger with their name on it); leaving it,
// back to your own finger.
let homeSlot = -1, platedName = settings.player.name;
function rehome() {
  const was = homeSlot;
  homeSlot = together.guestSlot;
  let moved = 0;
  for (const b of boats) {
    if (homeOf(b.kind) !== 'harbour' || (b === boat && !onFoot) || !b.tie) continue;
    const P = PIERS[b.tie.pier];
    if (P !== OWN_FINGER && !VISITOR_FINGERS.includes(P)) continue;
    b.tie = null;
    const p = freeOwnBerth(b);
    b.place(p.x, p.z, p.heading);
    const B = berthFor(b, boats, { reach: 3 });
    if (B) {
      b.place(B.x, B.z, B.heading);
      b.tieTo({ ...B, t: 9 });
    }
    moved++;
  }
  if (moved && homeSlot >= 0 && was < 0) hud.toast(`You’re a visitor in ${together.hostLabel}’s harbour while you play together: your boats at Willowhaven are lying at the visitors’ pontoon, the end row.`, 7);
  else if (moved && homeSlot < 0) hud.toast('Your boats are back on your own finger of the pontoon.', 5);
  if (moved) save();
}

// Sharing what you find (Settings → Play together → Share what you find): a place or dive site,
// something found on a dive, a first fish and how it was caught, or a mark sent from the map. It
// goes to your friends' maps as a mark with your name on it. Returns whether it went.
function shareFind(k, x, z, t, n = '', id = null) {
  if (!together.active || settings.player.share === false || !together.others.length) return false;
  return together.share({ k, x, z, t, n, ...(id ? { id } : {}) });
}
// A first fish, as a tip: where, on what, when, and the tide.
function tipWords(e) {
  const item = e.item && TACKLE[e.item] ? TACKLE[e.item].name : null, rod = RODS[e.rod]?.name;
  const h = e.hour, when = h < 5 || h >= 21.5 ? 'after dark' : h < 8 ? 'at dawn' : h < 11.5 ? 'in the morning' : h < 14 ? 'around midday' : h < 17.5 ? 'in the afternoon' : 'in the evening';
  const tide = { high: 'at high water', low: 'at low water', flood: 'on the flood', ebb: 'on the ebb' }[e.tide];
  const on = item ? `on ${/^[aeiou]/i.test(item) ? 'an' : 'a'} ${item[0].toLowerCase()}${item.slice(1)}${rod ? ` (${rod.toLowerCase()})` : ''}` : rod ? `on the ${rod.toLowerCase()}` : '';
  const bits = [e.place, on, when, e.water === 'fresh' ? null : tide, e.depth >= 1 ? `${Math.round(e.depth)} m down` : null].filter(Boolean);
  return `${bits.join(', ')}.`.replace(/^./, (c) => c.toUpperCase());
}
// Your fish sold, playing together: friends paid the same (Settings → Play together, "Fish you
// sell"), gathered for a moment so a creel sold in one go goes as one word.
let saleBuf = null;
function shareSale(v, w) {
  if (!together.active || settings.player.paid === false || !(v > 0)) return;
  if (saleBuf && saleBuf.w !== w) flushSale(true);
  saleBuf ??= { a: 0, n: 0, w, at: 0 };
  saleBuf.a += v;
  saleBuf.n++;
  saleBuf.at = performance.now() / 1000;
}
function flushSale(now = false) {
  const B = saleBuf;
  if (!B || (!now && performance.now() / 1000 - B.at < 0.6)) return;
  saleBuf = null;
  const a = Math.min(PAID_MAX, Math.round(B.a * 100) / 100);
  if (!together.paid(a, B.w, Math.min(99, B.n))) return;
  const names = [...together.peers.values()].filter((p) => p.name).map((p) => p.name);
  const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `Your ${names.length} friends`;
  hud.toast(`${who} ${names.length === 1 ? 'is' : 'are'} paid ${money(a)} too: you’re out together.`, 4);
}
// A friend's fish sold, playing together: paid the same (their choice), into your purse.
function friendPaid(p, d) {
  earnIn(state, d.a, `Shared by ${p.name}`);
  const where = d.w === 'kaigan' ? 'to Kaigan' : d.w === 'kitchen' ? 'to a kitchen' : 'at the market';
  hud.toast(`${p.name} sold ${d.n === 1 ? 'a fish' : `${d.n} fish`} ${where}: ${money(d.a)} into your purse too.`, 5);
  audio.chime?.();
  save();
}

// Your boat, friends crewing her: you're told as each steps aboard, and off.
let crewAboard = new Set();
function watchCrew() {
  if (!together.active || onFoot || driving || dive) {
    crewAboard.clear();
    return;
  }
  const now = new Set();
  for (const p of together.peers.values()) if (p.name && crew.aboard(p)) now.add(p.id);
  for (const id of now) {
    if (crewAboard.has(id)) continue;
    const p = together.peers.get(id);
    hud.toast(`${p.name} steps aboard. They can fish from her${boat.hull.motor ? ', use her locker' : ''} and net your fish, and take the helm while you’re away from it.`, 6);
  }
  for (const id of crewAboard) {
    const p = together.peers.get(id);
    if (!now.has(id) && p?.name) hud.toast(`${p.name} steps off.`, 3);
  }
  crewAboard = now;
}

// A friend's find, onto your map: once (found again, it's brought up to date), and not for a place
// you know already (just the news). If your map's full of marks, just the news.
function friendFind(p, F) {
  const the = (t) => t.replace(/^The /, 'the ');
  const wreck = F.t.startsWith('The Kittiwake: ');
  const news = {
    place: `${p.name} found ${the(F.t)}`, site: `${p.name} dived ${the(F.t)}`,
    detail: wreck ? `${p.name} found something on the Kittiwake: ${F.t.slice(15)}` : `${p.name} found ${the(F.t)}`,
    fish: `${p.name}’s tip for ${F.t.toLowerCase()}`, mark: `${p.name} sent you a mark: ${F.t}`,
  }[F.k];
  if ((F.k === 'place' || F.k === 'site') && F.id && state.places[F.id] && (F.k === 'place' || state.dive.sites[F.id])) {
    hud.toast(`${news}.`, 5);
    return;
  }
  const same = state.pins.find((q) => q.from === p.name && q.title === F.t && Math.hypot(q.x - F.x, q.z - F.z) < 60);
  let where = 'it’s on your map';
  if (same) Object.assign(same, { x: F.x, z: F.z, note: F.n || same.note });
  else if (state.pins.length < 60) state.pins.push({ id: `fr-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, x: F.x, z: F.z, title: F.t, note: F.n, fav: false, from: p.name, day: state.day, hour: Math.round(state.hour * 100) / 100 });
  else where = 'your map has no room for another mark';
  const text = `${news}${F.k === 'fish' && F.n ? `: ${F.n}` : ''} (${where}).`;
  // (A first fish's tip comes after the news of the catch, not over it.)
  if (F.k === 'fish') later(text);
  else hud.toast(text, 6);
  if (mapSheet.isOpen) {
    mapSheet.renderSide();
    mapSheet.draw();
  }
  save();
}

// Toasts for what happens in a session (the details are in Settings → Play together).
together.onEvent = (kind, p, data) => {
  if (kind === 'join') hud.toast(`${p.name} has joined you.`, 5);
  else if (kind === 'leave') hud.toast(data?.host && !together.hosting ? `${p.name} has left. If they’re back within a minute (a reload, a dropped connection), the session carries on; otherwise it ends.` : `${p.name} has left the session.`, data?.host ? 7 : 4);
  else if (kind === 'fishOn') {
    // (Once in a while for each friend: a lost fish and another straight after is one moment.)
    if (t - (fishOnSaid[p.id] ?? -99) > 20) {
      fishOnSaid[p.id] = t;
      hud.toast(`${p.name} has a fish on! ${friendWhere(p)}`, 5);
      audio.chime?.();
    }
  } else if (kind === 'call') {
    hud.toast(`${p.name}: “${data.text}” ${friendWhere(p)}`, 5);
    audio.chime?.();
  }
  else if (kind === 'joined') hud.toast(`You’re playing with ${p?.name || 'your friend'}. Look for their name on the screen: it points the way to them.`, 7);
  else if (kind === 'catch') {
    const sp = fishById[data.sp];
    if (sp) {
      hud.toast(`${p.name} caught ${data.first ? 'their first' : 'a'} ${sp.name.toLowerCase()}, ${kgWords(data.kg)}${data.best ? ': their best yet' : ''}.`, 5);
      // (Over them for a few seconds; and on foot, they hold it up for you to see.)
      p.landed = { text: `${sp.name.toLowerCase()}, ${kgWords(data.kg)}!`, at: together.clock };
      visitors.holdUp(p.id, data.kg);
      // (Landed by a friend crewing your boat, close aboard: it counts for your fishing charter,
      // their guests' fish brought in with them aboard. Nothing else of yours: it's their fish.)
      const Q = p.view || p.pose;
      if (crew.aboard(p) && !onFoot && !driving && Q && Math.hypot(Q.x - boat.pos.x, Q.z - boat.pos.z) < boat.hull.L + 4) {
        jobsDone(Con.caught(state.contracts, { sp: sp.id, sea: sp.water !== 'fresh', phase: 'landed', boat: boat.kind, crew: true }));
      }
    }
  } else if (kind === 'ended') hud.toast(p ? `${p.name} ended the session.` : data?.hostGone ? `${data.name[0].toUpperCase()}${data.name.slice(1)} didn’t come back, so the session has ended. Your own time and weather are back.` : 'The connection to your session was lost, so you’ve left it.', 7);
  else if (kind === 'find') friendFind(p, data);
  else if (kind === 'paid') friendPaid(p, data);
  else if (kind === 'help') friendHelp(p, data);
  else if (kind === 'crew') crewWord(p, data);
  else if (kind === 'shoal') {
    const s = teamwork.heard(p, data);
    if (s) hud.toast(`${p.name} marked a shoal of ${s.sp.name.toLowerCase()} ${friendWhere(p)}: the mark goes with it.`, 6);
  }
  else if (kind === 'lost') hud.toast('Lost the connection to your session. Trying again…', 4);
  else if (kind === 'back') hud.toast('Back in your session.', 3);
};
together.onChange = () => {
  if (settingsUI.isOpen && settingsUI.tab === 'together') settingsUI.render();
};
// Leaving the game leaves the session (and ends it, if it's yours).
// Leaving the page (a reload, Update, closing the tab) steps out quietly: a reload of this tab
// picks the session up again (resume), and the others wait a minute for a host who's reloading.
addEventListener('pagehide', () => together.suspend());
together.worldSource = worldToShare;

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
  let info = `bottom ${bottom.toFixed(0)} m · visibility ${underwater.visibility(weather.rain, env.night)} m`;
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
    ? `${d.fresh ? 'No spearfishing in fresh water' : shot.loaded ? 'Speargun loaded' : shot.state === 'loading' ? 'Loading the bands…' : 'Shaft out…'} · creel ${creelWords(state)}`
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
  cargoSave();
  for (const [k, b] of Object.entries(BOATS)) {
    state.boats[k] = { x: b.pos.x, z: b.pos.z, heading: b.heading, anchored: b.anchored && b.anchor?.phase !== 'haul', ...(b.emotorDown || b.outboardDown ? { motor: true } : {}), ...(b.sailUp ? { sail: Math.round(b.sheet * 100) / 100 } : {}) };
    // (Where her anchor lies, or the berth she's tied up at, so she's found just as she was left.)
    if (b.anchor && b.anchor.phase !== 'haul') state.boats[k].anchor = { x: b.anchor.x, z: b.anchor.z };
    if (b.tie) state.boats[k].tie = { pier: b.tie.pier, side: b.tie.side, along: b.tie.along, heading: b.tie.heading };
  }
  const kindOf = (b) => Object.keys(BOATS).find((k) => BOATS[k] === b);
  state.tow = tow ? { lead: kindOf(tow.lead), towed: kindOf(tow.towed) } : null;
  state.engines = Object.fromEntries(Object.entries(engines).map(([k, E]) => [k, engineSave(E)]));
  state.damage = Object.fromEntries(Object.entries(damages).map(([k, D]) => [k, damageSave(D)]).filter(([, v]) => v));
  state.vessel = boat.kind;
  state.mode = onFoot ? 'foot' : 'boat';
  state.walker = onFoot ? { x: walker.pos.x, z: walker.pos.z, heading: walker.heading } : null;
  // Crewing in a friend's boat, you're saved where you stepped aboard from (never on the sea).
  if (crew.on && crewFrom) {
    if (crewFrom.boat) {
      state.mode = 'boat';
      state.vessel = crewFrom.boat.kind;
      state.walker = null;
    } else state.walker = { ...crewFrom.spot };
  }
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
  // (Your own sky, even while you're following the host's.)
  state.sky = ownSky || skyOf(weather);
  state.seen = explored.toString();
  state.seenSouth = exploredSouth.toString();
  const ok = saveGame(state);
  if (ok) cloud.queue(state, saveStatus.lastSaved);
  // (The desktop build: the same save to a file, for Steam Cloud; and achievements earned.)
  if (ok && onDesktop()) {
    if (!BENCH_RUN) try { mirrorSave(localStorage.getItem('slow-tide-save')); } catch { /* next time */ }
    const C = careerOf(state);
    reportAchievements(state, { places: [C.places, C.placesOf] });
  }
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
  // Back after a reload (or Update) in the middle of a session: into it again.
  together.resume().then((back) => {
    if (back && together.hosting) hud.toast(`Back in your session, ${together.code}.`, 5);
  });
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
  renderUpdate();
  $('clock-net').hidden = offline.online;
  const t = $('title-offline');
  t.hidden = !offline.enabled || (!offline.ready && !offline.error);
  t.classList.toggle('ok', offline.ready);
  t.textContent = offline.ready ? 'Ready to play offline' : offline.error;
}

// Which version this is, on the title screen: the release, the build (the same as the offline
// copy's, so two copies showing the same build are the same game) and the day it was built.
{
  const d = BUILT ? new Date(`${BUILT}T12:00:00Z`) : null;
  const day = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
  $('title-version').textContent = `Version ${RELEASE}${BUILD ? ` · build ${BUILD.slice(0, 8)}` : ''}${day ? ` · ${day}` : ''}`;
}

function updateNow() {
  save();
  if (!applyUpdate()) location.reload();
}

// The Update button, on the title screen and in the journal: looks for a new version there and
// then, shows it coming down and switches over by itself when it's all here (or says this is the
// newest), so nobody needs to refresh again and again. What it's doing is said beside it.
let updateNote = '', checkingUpdate = false;
function renderUpdate() {
  const dl = offline.downloading;
  const busy = checkingUpdate || !!dl || !!offline.updating;
  const pct = dl?.total ? Math.min(100, Math.round((100 * dl.cached) / dl.total)) : null;
  const note = offline.updating ? 'Switching to the new version…'
    : dl ? `Downloading the new version${pct != null ? ` (${pct}%)` : '…'} It switches over by itself.`
    : updateNote;
  $('title-update').disabled = $('update-now').disabled = busy;
  $('title-update').textContent = busy ? 'Updating…' : 'Update';
  $('update-now').textContent = offline.updateReady && !busy ? 'Update to the new version' : busy ? 'Updating…' : 'Check for updates';
  $('title-update-note').textContent = note;
  $('update-note').textContent = note;
  $('update-note').hidden = !note;
}

async function runUpdate() {
  if (checkingUpdate || offline.updating) return;
  if (started) save();
  checkingUpdate = true;
  updateNote = 'Looking for a new version…';
  renderUpdate();
  let found = 'error';
  try {
    found = await checkForUpdate();
  } catch { /* said below */ }
  checkingUpdate = false;
  updateNote = {
    latest: `You have the newest version (Version ${RELEASE}).`,
    offline: 'You’re offline: connect to the internet to update.',
    updating: 'Switching to the new version…',
    fresh: 'Fetching a fresh copy of the game…',
  }[found] || 'Couldn’t check just now. Try again in a moment.';
  renderUpdate();
}

setupOffline((event) => {
  renderOffline();
  if (event === 'ready') hud.toast('Ready to play offline: the whole game is stored on this device, so it starts and plays even without a connection.', 7);
  if (event === 'update') {
    // On the title screen, take the new version straight away; mid-game, ask first.
    // (Not when it was the Update button that asked for it: that switches over by itself.)
    if (!started) updateNow();
    else if (!checkingUpdate) hud.toast('A new version of Slow Tide is ready. Open the journal (J) and choose Update; your progress is kept.', 8);
  }
  if (event === 'offline') hud.toast(`You’re offline. Everything keeps working and saving on this device.${cloud.signedIn ? ' Cloud sync is paused until you’re back online.' : ''}`, 6);
  if (event === 'online') {
    if (cloud.signedIn && cloud.pending) hud.toast('Back online. Syncing your progress…', 4);
    cloud.reconnected(state, saveStatus.lastSaved);
    together.nudge();
  }
  if (modal === 'journal') renderCloud();
});
renderOffline();
$('update-now').addEventListener('click', () => (offline.updateReady ? updateNow() : runUpdate()));
$('title-update').addEventListener('click', (e) => {
  e.stopPropagation();
  runUpdate();
});

// A small "are you sure?" with any buttons we need.
// A question with buttons; { input } adds a text box (its value goes to the button's run).
// (list: lines to set out below the words, each { ok, text }: ready, or a warning.)
// What Esc or B answers on an open question: its button marked cancel, or one that plainly does
// nothing (never an action: "Go diving" and "Take her in tow" are quiet buttons too). None: Esc just
// closes it, as before.
const SAFE_CANCEL = /^(Never mind|Not now|Not yet|No thanks|Later|Cancel|Keep it|Keep playing|Stay in)$/;
let confirmCancel = null;
const confirmQueue = [];
// (A question asked while another is open waits its turn, rather than replacing it and losing its
// answers.)
function confirmClosed() {
  if ($('confirm').hidden && confirmQueue.length) setTimeout(() => { if ($('confirm').hidden) ask(...confirmQueue.shift()); }, 200);
}
function cancelConfirm() {
  const c = confirmCancel, v = $('confirm-input').value;
  confirmCancel = null;
  if (c?.keepOpen) c.run?.(v);
  else {
    $('confirm').hidden = true;
    c?.run?.(v);
  }
  confirmClosed();
}
function ask(title, text, buttons, opts = {}) {
  if (!$('confirm').hidden) {
    confirmQueue.push([title, text, buttons, opts]);
    return;
  }
  const { input = null, list = null, placeholder = '', maxLength = 40 } = opts;
  confirmCancel = buttons.find((b) => b.cancel) || buttons.find((b) => SAFE_CANCEL.test(b.text)) || null;
  // (A message up just now waits until it's answered.)
  hud.hush();
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  let ul = $('confirm-list');
  if (!ul) {
    ul = document.createElement('ul');
    ul.id = 'confirm-list';
    ul.className = 'cf-list';
    $('confirm-text').after(ul);
  }
  ul.hidden = !list?.length;
  ul.replaceChildren(...(list || []).map((l) => {
    const li = document.createElement('li');
    li.className = l.ok ? 'ok' : 'warn';
    li.textContent = l.text;
    return li;
  }));
  const box = $('confirm-input');
  box.hidden = input == null;
  box.value = input ?? '';
  box.placeholder = placeholder;
  box.maxLength = maxLength;
  const acts = $('confirm-acts');
  acts.replaceChildren(...buttons.map((b) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `pk-btn ${b.cls || ''}`;
    el.textContent = b.text;
    el.addEventListener('click', () => {
      if (!b.keepOpen) $('confirm').hidden = true;
      b.run?.(box.value);
      confirmClosed();
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
  // (A name first, the very first time: see askName. Any key or click while it's asked waits.)
  if (!settings.player.name) {
    if ($('confirm').hidden) askName(begin);
    return;
  }
  started = true;
  audio.start();
  // (A game from before there was a boat store: which of your boats are still in the water.)
  if (fleetNews) {
    ask('Your boats', `Willowhaven has a harbour office now, by the head of the quay, and you have a finger of the pontoon of your own. No more than ${MAX_AFLOAT} of your boats are in the water at a time: the ${fleetNews.map((k) => BOATS[k].name).join(', the ')}. The rest are laid up, safe, each where she lives; the harbour office puts any of them back in the water whenever you like.`, [{ text: 'OK' }]);
  }
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
  // How do you like to play? Asked once (a new player first, then the guide).
  if (!state.tips.style) askStyle(newPlayer ? () => offerGuide() : null, !newPlayer);
  else if (newPlayer) offerGuide();
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
      hud.toast(`New: Las Brasas, a warm volcanic island across the sea to the south. Take the sailing boat out of the bay and ${scheme() === 'touch' ? 'tap the prompt' : `press ${input.keyLabel('interact')}`} for the crossing.`, 10);
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
  showAll: () => settings.controls.map !== 'explore',
  // Playing together: send a mark to your friends.
  canShare: () => together.active && together.others.length > 0,
  sharePin: (p) => {
    if (!together.active || !together.others.length) return 'There’s no one in your session to send it to.';
    return together.share({ k: 'mark', x: p.x, z: p.z, t: p.title || 'A mark', n: p.note }) ? `Sent to ${together.others.map((o) => o.name).join(', ')}.` : 'Not sent: wait a moment and try again.';
  },
  birds: () => {
    const abs = clock.abs;
    return birdSightings.map((b) => ({ x: b.x, z: b.z, age: (abs - b.at) / 1.5 }));
  },
  // Routes (see routes.js): the boat you'd take (the one you're in or last used) and what she does
  // at her cruise; following one, and stopping.
  routeBoat: () => routeBoat(),
  followRoute: (id) => {
    state.route = { id, leg: 1 };
    routeSaid = null;
    const R = state.routes.find((r) => r.id === id);
    hud.toast(!onFoot && fitsAboard()?.plotter ? `Following ${R.name}: the plotter gives the course and distance to each mark, and moves on as you round it.` : `Following ${R.name}: a chartplotter (the Marine Works fits them) steers you round it; without one, steer by the chart.`, 6);
    save();
  },
  stopRoute: () => {
    state.route = null;
    save();
  },
});

// The boat a route's figures are for: the one you're in, or the one you last used. Her cruise and
// what she burns there come from the yard's trials (engineTrials.js) for her engine; a boat with
// no engine choice is quoted at an easy pace of her own.
const EASY_KN = { row: 2.5, kayak: 3, sail: 5, windsurf: 8, jetski: 25 };
function routeBoat() {
  const b = !onFoot ? boat : BOATS[state.vessel] || boat;
  if (!b) return null;
  const k = b.kind, C = ENGINE_BOATS[k], at = !onFoot ? b.pos : walker.pos;
  if (C) {
    const e = engineOf(state.yard, k), T = ENGINE_TRIALS[k]?.[`${e.model}/${e.prop}`];
    // (An electric outboard: at its own easy pace, in hundredths of its battery.)
    if (MODELS[e.model]?.electric) return { name: b.name, knots: T?.kn || MODELS[e.model].cruise, lph: (T?.bph || 0) * 100, tank: 100, battery: true, at };
    return { name: b.name, knots: C.cruise, lph: T?.lph || 0, tank: TANKS[k] || 0, at };
  }
  return { name: b.name, knots: EASY_KN[k] ?? 4, lph: 0, tank: TANKS[k] || 0, at };
}
// Following a route at the helm: on to the next mark as each is rounded (see routes.js).
let routeSaid = null;
function routeTick() {
  if (!state.route || onFoot || !boat) return null;
  const R = state.routes.find((r) => r.id === state.route.id);
  if (!R) {
    state.route = null;
    return null;
  }
  const f = followLeg(R, state.route.leg, boat.pos.x, boat.pos.z);
  if (f.done) {
    hud.flash(`${R.name}: the last mark. Route complete.`, t, 4);
    audio.chime?.();
    state.route = null;
    save();
    return null;
  }
  if (f.rounded || f.leg !== state.route.leg) {
    state.route.leg = f.leg;
    hud.flash(`Mark ${f.leg} rounded: steer ${courseWords(f.course)} for mark ${f.leg + 1}, ${rangeWords(f.m)} off.`, t, 3.5);
    save();
  }
  return { R, ...f };
}

// Las Brasas' chart: its heights from the island's own water map, baked when first needed.
mapSheet.addSheet('south', SOUTH_MAP, exploredSouth, () => {
  const W = southWater();
  return { data: W.tex.image.data, width: 560, height: 560, rect: SOUTH_WATER };
});
// The open sea's, between them (see crossing.js): all charted, its heights worked out as needed.
{
  const all = new Explored('', OCEAN_SHEET);
  all.bits.fill(255);
  mapSheet.addSheet('ocean', OCEAN_SHEET, all, () => ({ data: new Uint16Array(16), width: 2, height: 2, rect: { x: 1e9, z: 1e9, w: 1, h: 1 } }));
}

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
  catchShot = true;
  if (!was) rig.setFirstPerson(false, t);
}

function openMap(highlight = null) {
  if (modal) return;
  if (fishing.aiming) fishing.cancel();
  const p = player();
  mapSheet.open({ player: { x: p.pos.x, z: p.pos.z, heading: p.heading }, onFoot, boats, boat, friends: friendsOnMap, jobs: jobsOnMap }, typeof highlight === 'string' ? highlight : null);
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
    // (The opening questions, the name and how you like to play: Esc or B answers them.)
    if (!$('confirm').hidden) {
      if (code === 'Escape') cancelConfirm();
      return;
    }
    if (settingsUI.isOpen) {
      if (code === 'Escape' || is('settings')) closeSettings();
    } else if (is('settings')) openSettings();
    else if (!is('journal')) begin();
    return;
  }
  audio.start();
  if (modal === 'sleep' || modal === 'travel') return;
  // Looking down at the dashboard: Tab (or the D-pad) moves round it, Enter or Space (or A) works
  // the ringed control, Esc (or B) looks up again (see dashcontrol.js).
  if (dashCtl.focused) {
    const dir = is('dashUp') ? 'up' : is('dashDown') ? 'down' : is('dashLeft') ? 'left' : is('dashRight') ? 'right' : null;
    if (dir) return dashCtl.step(dir);
    if (code === 'Tab') return dashCtl.step(input.codes.has('ShiftLeft') || input.codes.has('ShiftRight') ? 'left' : 'right');
    if (is('dashPress') || code === 'NumpadEnter' || code === 'Space') return dashCtl.press();
    if (code === 'Escape') return toggleDashFocus();
  }
  // The quick calls: their numbers send them, Esc (or the key again) closes.
  if (callsOpen()) {
    const n = /^(Digit|Numpad)([1-9])$/.exec(code);
    if (n && Number(n[2]) <= CALLS.length) sendCall(Number(n[2]) - 1);
    else if (n && Number(n[2]) === CALLS.length + 1 && teamwork.shoalNear(player().pos)) markShoal();
    else if (code === 'Escape' || is('call')) closeCalls();
    return;
  }
  if (!$('confirm').hidden) {
    if (code === 'Escape') cancelConfirm();
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
    else if (is('binoculars')) openBinoculars();
    else if (is('cast') || is('photo')) takePhoto();
    return;
  }
  if (modal === 'inspect') {
    if (code === 'Escape' || is('cancel') || is('interact')) closeInspect();
    return;
  }
  if (modal === 'rockpool') {
    if (code === 'Escape' || is('cancel')) closePool();
    else if (is('interact')) poolTurn();
    else if (is('cast') || is('keep')) poolNet();
    else if (is('tackle')) poolBait();
    else if (is('photo')) poolPhoto();
    return;
  }
  if (modal === 'binocs') {
    if (code === 'Escape' || is('binoculars') || is('cancel')) closeBinoculars();
    else if (is('photo')) {
      // (A photograph through them: photo mode, the lens as far out as it goes.)
      closeBinoculars();
      openPhoto();
      camera.fov = 18;
      camera.updateProjectionMatrix();
    }
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
  if (modal === 'helm') {
    if (code === 'Escape' || is('motor')) closeHelm();
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
    else if (is('finder')) finderButton();
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
  // Sitting a while: casting, the prompt's key or Escape get you up first.
  if (sitting && !modal && (is('cast') || is('interact') || code === 'Escape')) {
    standUp();
    return;
  }
  if (is('cast')) {
    fishing.onDown();
    return;
  }
  if (modal === 'catch') {
    if (is('keep')) fishing.keep();
    else if (is('tackle') && !$('cc-bait').hidden) fishing.keepForBait();
    else if (is('photo') && $('photo-card').hidden) photographCatch();
    else if (is('interact') && $('photo-card').hidden) openInspect();
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
  else if (is('tilt')) tiltOutboards();
  else if (is('levers') && leverKind()) (twinHelm() ? cycleLevers() : hud.flash('One engine, one lever: the levers split only on twin engines (the centre console, the yacht).', t, 2.4));
  else if (is('neutral') && leverKind()) leverNeutral(true);
  else if (is('throttleUp') && leverKind()) stepLever(1);
  else if (is('throttleDown') && leverKind()) stepLever(-1);
  else if (is('trolling')) trollDeploy();
  else if (is('spotlock')) trollLock();
  else if (is('trollDepth')) trollDepth();
  else if (is('motor')) {
    // (At a motorboat's helm: the engine.)
    if (!onFoot && !driving && !cabinIn && boat.hull.motor && engines[boat.kind]) {
      if (dashCtl.focused || (rig.mode === 'eye' && dashHere())) toggleDashFocus();
      else engineKey();
    }
    // (On a controller, the sailing boat's one button goes round sail, outboard and oars.)
    else if (!onFoot && !driving && !cabinIn && boat.hull.sail) {
      if (pads.active && boat.sailUp) toggleOutboard();
      else if (pads.active && boat.outboardDown) toggleOutboard();
      else toggleSail();
    } else toggleKayakMotor();
  } else if (is('outboard')) toggleOutboard();
  else if ((is('walkline') || is('jog')) && fishing.lineOut && fishing.state !== 'casting') toggleWalkLine();
  else if (is('photo')) openPhoto();
  else if (is('binoculars')) openBinoculars();
  else if (is('view')) cycleView();
  else if (is('eye')) toggleFirstPerson();
  else if (is('reset')) resetView();
  else if (is('finder')) finderButton();
  else if (is('map')) openMap();
  else if (is('settings')) openSettings();
  else if (is('call')) {
    if (together.active) openCalls();
    else hud.flash('Quick calls are for playing together (Settings → Play together).', t, 2.5);
  } else if (is('hide')) {
    hudOff = !hudOff;
    hud.hidden(hudOff);
  } else if (code === 'Escape') {
    if (!fishing.playerCancel() && rig.mode !== rig.third) resetView();
  }
});
input.on('release', (code, acts) => {
  if (dashCtl.focused && (acts.includes('dashPress') || code === 'NumpadEnter' || code === 'Space')) return dashCtl.release();
  if (acts.includes('cast') && !dive) fishing.onUp();
});
input.on('pointer', () => {
  if (!started) {
    if (!settingsUI.isOpen) begin();
  } else audio.start();
});
input.on('cancel', () => {
  if (started && !modal && placement.isOn) placement.cancel();
  else if (started && !modal) fishing.playerCancel();
});

$('start-btn').addEventListener('click', begin);
$('journal-btn').addEventListener('click', () => {
  if (modal === 'journal') closeJournal();
  else if (!modal) openJournal();
});
$('view-btn').addEventListener('click', () => { if (started && !modal) cycleView(); });
$('finder-btn').addEventListener('click', () => { if (started && !modal) finderButton(); });
$('pack-btn').addEventListener('click', () => {
  if (modal === 'pack') closePack();
  else if (started && !modal) openPack();
});
$('gear').addEventListener('click', () => { if (started && !modal) openPack(); });
$('cancel-btn').addEventListener('click', () => fishing.playerCancel());
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
$('cc-bait').addEventListener('click', (e) => {
  e.stopPropagation();
  if (modal === 'catch') fishing.keepForBait();
});
$('rp-bait').addEventListener('click', () => poolBait());
$('note-card').addEventListener('click', closeNote);
$('cc-look').addEventListener('click', (e) => {
  e.stopPropagation();
  openInspect();
});
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

// The computer's speakers or headphones change (plugged in, unplugged, Bluetooth ones switching
// mode for a call): connect the sound to them afresh, as the Restart sound button does.
navigator.mediaDevices?.addEventListener?.('devicechange', () => {
  if (!document.hidden) audio.restart();
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
  // (The fish go by the sun: dawn and dusk move with the season. And the year itself: see season.js.)
  ecoCtx.env.hour = sunHour(clock.hour, clock.abs);
  ecoCtx.env.abs = clock.abs;
  ecoCtx.env.tide = tideNow;
  // (In a blow the fish of sheltered water feed hard, the open sea's go quiet; after it too.)
  ecoCtx.env.storming = Math.max(weather.storm, conditions.sea.storm);
  ecoCtx.env.after = blowAfter();
  ecoCtx.env.colour = seaColourNow();
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
  // (In a session, the shared sea: the host keeps the fish going round everyone; see sharedworld.js.)
  seaViewers = viewersNow();
  shared.update(dt, seaViewers);
  ecoCtx.foci = shared.role === 'host' ? seaViewers.map((v) => v.from) : null;
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
    teach('bajonNews', 'New at Las Brasas: El Bajón, a lava reef under a yellow buoy west of the harbour mouth. See it from the boat, or dive it.', 12);
  }
  if (!manual) watchFrameRate(rawDt);
  pads.poll(dt);
  feelFrame(dt);

  // (Not in the water: time can't drift by on one breath, or a tank.)
  const wantsRest = started && (!modal || modal === 'camp') && input.resting && !dive;
  // (Playing together, time is the host's to pass: see timeIsHosts.)
  if (wantsRest && clock.following && !restRefused) {
    restRefused = true;
    hud.flash(timeIsHosts(), t, 3.5);
  }
  if (!input.resting) restRefused = false;
  const resting = wantsRest && !clock.following;
  const speed = resting ? REST_SPEED : sitting && !modal ? SIT_SPEED : 1;
  hud.rest(resting);
  let hours = 0;
  if (started && !sleeping) hours = advanceClock(state, dt, speed);
  followWorld();
  clock.update(dt, performance.now() / 1000);
  worldSpeed = speed;
  updateWeather(dt, speed);
  updateTide();
  updateSleep(dt);
  updateTravel(dt);
  updatePassage(dt);
  updateCrossing(dt);
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
    if (walkLine && !fishing.lineOut) walkLine = false;
    if (sitting && (Math.abs(ti) > 0.3 || Math.abs(si) > 0.3)) standUp();
    if (fishing.aiming) {
      // In first person the keys turn your head (and the cast with it); otherwise they swing the cast.
      if (rig.mode === 'eye') rig.turn(si, dt, t);
      else fishing.aimBy(si, dt);
      fishing.depthBy(ti, dt);
      if (leverKind()) throttle = boat.lever;
    } else if (fishing.lineOut && walkLine && (onFoot || boat.deck)) {
      // Walking with a line out: along the bank, or about the deck; the line pays out or comes in.
      walkWith(ti, si, dt);
      if (!onFoot && leverKind()) throttle = boat.lever;
    } else if (fishing.lineOut) {
      // Expert: the rod in your hands (the right stick, or forward and back), the reel on the trigger.
      if (fishing.expert) {
        const vr = input.virtual;
        fishing.rodInput.up = pads.active ? vr.rodUp || 0 : ti;
        fishing.rodInput.across = pads.active ? vr.rodAcross || 0 : onFoot || fishing.state === 'reeling' ? -si : 0;
        fishing.reelInput = pads.active ? pads.rt : input.holding('cast') ? 1 : 0;
      }
      // (On a controller, LT eases the drag off while a fish is on.)
      const dragTi = pads.active && fishing.state === 'reeling' && Math.abs(ti) < 1.5 * Math.abs(si) ? 0 : ti;
      if (!fishing.expert || pads.active || fishing.state === 'reeling') fishing.depthBy(pads.active && fishing.state === 'reeling' && pads.lt > 0.4 ? -1 : fishing.expert && !pads.active ? 0 : dragTi, dt);
      // With a fish on, across swings the rod low to that side (side pressure, to turn it);
      // otherwise in a boat it steers.
      // (The steer keys give +1 for left; side pressure counts left as −1.)
      if (fishing.state === 'reeling') fishing.side = -si;
      else if (!onFoot) steer = si;
      // (Under power the motor runs on at its notch while you fish: trolling.)
      if (leverKind()) throttle = boat.lever;
      // Following a fish: she heads for it at a trolling pace (until the run's line is back).
      if (following && fishing.state === 'reeling' && !onFoot && motorRunning() && fishing.fight) {
        const fx = fishing.fishPos.x - boat.pos.x, fz = fishing.fishPos.z - boat.pos.z;
        steer = clamp(wrapAngle(Math.atan2(fx, fz) - boat.heading) * 2.2, -1, 1);
        if (fishing.fight.extra <= 0.5) stopFollowing();
      }
      if (following && (fishing.state !== 'reeling' || onFoot || !motorRunning())) stopFollowing();
    } else if (dive) {
      // In the water: forward and back swim where you look, across turns you, and the
      // interact and tackle keys (E and Q) swim straight up and down.
      diveIn.fwd = ti;
      diveIn.up = (input.holding('interact') ? 1 : 0) - (input.holding('tackle') ? 1 : 0);
      diveIn.kick = input.jogging || (pads.active && pads.jog);
      // Holding the right mouse button (or LT) looks about without turning you; let go and the
      // view swings back behind you. The turn keys still turn the way you swim.
      rig.holdLook(input.lookHeld || (pads.active && pads.lt > 0.35));
      if (si) {
        const a = rig.turn(si, dt, t);
        if (rig.looking && a) diveIn.dir.applyAxisAngle(UP_Y, a);
      }
    } else if (driving) {
      // On a controller the triggers drive: RT to go, LT to brake and then reverse.
      carIn.throttle = pads.active ? pads.rt - pads.lt : ti;
      carIn.steer = si;
    } else if (crew.on?.helm) {
      // Crewing at a friend's helm: the keys are their wheel and lever (see crew.js).
      crew.sendWheel(dt, ti, si);
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
    } else if (boat.deck && !boat.atHelm) {
      // Away from the wheel, walking the deck: the stick walks you; she keeps on as she was.
      walkWith(ti, si, dt);
      throttle = boat.lever;
      steer = 0;
    } else if (boat.deck) {
      // At the wheel but off the helm: walk on, or take her (the prompt).
      walkWith(ti, si, dt);
      throttle = boat.lever;
      steer = 0;
    } else if (leverKind() && boat.troll?.deployed && boat.troll.mode !== 'lock' && !boat.lever) {
      // The trolling motor down and the main engine in neutral: the keys are its push (it stays
      // where you leave it, like a lever) and its head (back to straight when you let go). The
      // main throttle's still on its own keys (+ and −), and putting her in gear stops the motor.
      trollPush = clamp(trollPush + ti * dt * 0.9, -1, 1);
      if (Math.abs(trollPush) < 0.04 && !ti) trollPush = 0;
      boat.troll.drive(trollPush, si);
      throttle = 0;
      steer = 0;
    } else if (leverKind()) {
      // At the helm: the throttle lever moves a notch at a time (the keys, or the stick pushed
      // and let go) and stays where you leave it; steering is the stick or keys across.
      helmInput(ti, dt, si);
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
  // A friend crewing has your helm (see crew.js): touching the controls at the wheel takes it back;
  // otherwise their wheel and lever steer her, while you fish or walk her deck.
  if (crew.given && started && !onFoot && !modal && !fishing.lineOut && !(boat.deck && !boat.atHelm) && (Math.abs(input.throttle) > 0.3 || Math.abs(input.steer) > 0.3)) {
    crew.takeBack();
    hud.flash('You take the helm back.', t, 2);
  }
  const cw = !onFoot && !cabinIn && !(boat.sailUp && (boat.hull.sail || boat.hull.rig)) ? crew.wheel() : null;
  if (cw) {
    if (leverKind()) {
      // (A friend at your helm works the levers together.)
      if (boat.split) joinLevers(true);
      helmInput(cw.ti, dt, cw.si);
      throttle = boat.lever;
    } else throttle = cw.ti;
    if (!(following && fishing.state === 'reeling')) steer = cw.si;
  }
  if (boat.motor && (onFoot || (modal && !mapAboard()) || cabinIn)) throttle = 0;
  // What's allowed with a line out or a fish on (a lever left higher comes back).
  if (leverKind()) {
    watchHookup();
    // (Twin levers apart: each within what's allowed, and their mean for the rest. Away from the
    // helm, or a single-engined boat, they're joined at neutral.)
    if (boat.split && !twinHelm()) joinLevers(true);
    if (boat.split) setSplit((v) => within(leverKind(), v, leverSituation()));
    const v = boat.split ? boat.lever : within(leverKind(), boat.lever, leverSituation());
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
      b.dry = ELEC[b.kind] ? elecLevel(f, b.kind) <= 0 : isPetrol(b.kind) && fuelLevel(f, b.kind) <= 0;
      b.flat = b.kind === 'bass' && f.battery <= 0;
    }
    BOATS.kayak.kflat = f.kayak <= 0;
    // The kayak's motor on its battery; flat, it comes up and you paddle (never stranded).
    if (boat.kind === 'kayak' && boat.emotorDown && throttle && !onFoot && burnKayak(f, boat.power || throttle, dt) === 'flat') {
      boat.setEMotor(false);
      hud.flash('The kayak’s battery is flat: the motor’s up, paddle on. It charges at a jetty, and overnight.', t, 5);
    }
    // (Only while her engine runs: a little at idle, more with the throttle. The bass boat's
    // electric notches run on its battery, engine or no.)
    const Eb = engines[boat.kind], troll = boat.hull.motor?.troll || 0;
    const electric = troll && throttle > 0 && throttle <= troll;
    if (boat.motor && !onFoot && (electric || ((!Eb || engineRunning(Eb)) && (throttle || Eb)))) {
      // (The sailing boat's outboard has no electric notches: it's hull.outboard, not hull.motor.)
      // (The bass boat's trolling battery: a second one fitted, it lasts half as long again.)
      // (An engine from the catalogue works as hard as its propeller makes it: see engines.js.)
      const work = !electric && boat.motorSpec ? boat.motorSpec.effort : 1;
      const had = fuelLevel(f, boat.kind);
      // (An electric outboard: its own battery, nothing at all in neutral. See fuel.js burnElec.)
      // (Twin levers apart: what both engines are doing, whichever way.)
      const open = boat.split ? (Math.abs(boat.split[0]) + Math.abs(boat.split[1])) / 2 : throttle;
      const ran = ELEC[boat.kind] ? burnElec(f, boat.kind, throttle * work, dt, ELEC[boat.kind]) : burnBoat(f, boat.kind, (open || 0.06) * work, electric ? dt / (fitsAboard()?.troll || 1) : dt, throttle ? troll : 0);
      burnedNow = Math.max(0, had - fuelLevel(f, boat.kind));
      const what = scheme() === 'touch' ? 'tap the prompt' : K('interact');
      if (ran === 'flat' && ELEC[boat.kind]) hud.flash(`The motor whines down and stops: its battery is flat. The oars move her along; stop, then ${what} for a tow. It charges at a jetty or a quay, and overnight.`, t, 6);
      else if (ran === 'dry') hud.flash(`The outboard splutters and stops: the tank is dry. An oar moves her along, slowly; stop, then ${what} for the jerry can or a tow.`, t, 6);
      if (ran === 'flat' && !ELEC[boat.kind]) hud.flash('The electric motor whines down: the battery is flat. It charges at a jetty, and overnight; the outboard still runs.', t, 5);
    }
    if (hours && moored(BOATS.bass)) chargeBattery(f, hours);
    // (Each trolling motor's battery charges at a jetty, and overnight, the same way.)
    if (hours) for (const k of Object.keys(f.troll || {})) if (BOATS[k] && moored(BOATS[k])) f.troll[k] = Math.min(1, f.troll[k] + hours * BATTERY_PER_HOUR);
    if (hours && moored(BOATS.kayak)) chargeBattery(f, hours, 'kayak');
    // (An electric outboard's battery too.)
    if (hours) for (const k of Object.keys(ELEC)) if (ELEC[k] && BOATS[k] && moored(BOATS[k])) chargeElec(f, k, hours);
    bucketTick();
    // (A route you're following: on round its marks, see routes.js.)
    routeNow = routeTick();
    // (Her papers: what she's done, see papers.js.)
    vesselRun(dt, hours, burnedNow);
    burnedNow = 0;
    cargoTick();
    damageTick(dt);
    fuelCheckT -= dt;
    if (fuelCheckT <= 0) {
      fuelCheckT = 1;
      for (const k of KINDS) BOATS[k].setLoads(loadsOf(k));
      if (!onFoot && (isPetrol(boat.kind) || ELEC[boat.kind]) && boat.motor) watchTank(boat.kind);
      if (driving) watchTank('car');
    }
  }
  if (started) {
    // (A card that waited behind a menu or the catch card: now, once the screen's free.)
    if (noteQueue.length && !modal && $('confirm').hidden) showNote(...noteQueue.shift());
    updateJobs(dt);
    updateCalls(dt);
    passengers.update(dt, t);
    pickups.update(dt, t);
    updateEngine(dt);
    updateTroll(dt);
    updateDash(dt);
    updateFittings(dt);
    watchHire();
  }
  boat.update(dt, t, throttle, steer, env.lantern);
  // (Her speed over a second or so: the waves' own to-and-fro averaged out, so the tie-up and
  // anchor prompts don't flicker in a swell.)
  boat._avgSpeed = damp(boat._avgSpeed ?? boat.speed, boat.speed, 1.5, dt);
  // (The others: any lying still a long way from you rest; so do any tied up or at anchor out of
  // your way, thirty metres from you and from where you're looking (a little nearer before they
  // wake, so they don't flicker between the two at the edge). See Boat.update.)
  const me = player().pos;
  for (const b of boats) {
    if (b === boat) continue;
    const towed = !!tow && (tow.lead === b || tow.towed === b);
    const d = Math.hypot(b.pos.x - camera.position.x, b.pos.z - camera.position.z), r = b._resting ? 26 : 30;
    const aside = !towed && d > r && Math.hypot(b.pos.x - me.x, b.pos.z - me.z) > r;
    b.update(dt, t, 0, 0, env.lantern, d > 140 && !towed ? true : aside ? 'moored' : false);
  }
  for (const b of strays.values()) b.update(dt, t, 0, 0, env.lantern, !(tow && tow.towed === b) && Math.hypot(b.pos.x - camera.position.x, b.pos.z - camera.position.z) > 140);
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
  // (With an engine room, only while her engine runs: see engine.js.)
  const Eh = !onFoot ? engines[boat.kind] : null;
  const motorOn = !onFoot && ((boat.motor && (boat.trolling ? !boat.flat : !boat.dry && (!Eh || engineRunning(Eh)))) || kayakOn);
  const outboard = motorOn && boat.motor && !boat.trolling;
  const voice = onFoot ? '' : boat.hull.motor?.jet ? 'jet' : boat.hull.motor?.inboard ? 'inboard' : '';
  // (An engine from the catalogue has its own note: a V6 deeper and smoother than a four.)
  audio.engine?.(motorOn ? (outboard ? Math.max(boat.motorSpec?.electric ? 0 : 0.12, Eh ? engineRevs(Eh) : Math.abs(boat.power) * (boat.tilted ? 0.5 : 1)) : 0.03 + Math.abs(boat.power) * 0.02) : 0, voice, !onFoot && outboard ? boat.motorSpec?.voice : null);
  feelBoat(motorOn, outboard, voice);
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
  // Spray, where each hull meets the water (see spray.js): off your boat, and your others under way
  // near you. Sheets off her chines at speed, white water off her shoulders, a burst as she drops
  // into a sea, the lee side of a heeled sailing boat shouldering through the waves.
  for (const b of boats) {
    if (!b._phys?.P || b.speed < 1 || !b.group.visible || b._resting) continue;
    if (b !== boat && Math.hypot(b.pos.x - camera.position.x, b.pos.z - camera.position.z) > 160) continue;
    for (const p of sprayPoints(b._phys)) {
      const n = Math.floor(sprayRate(p) * dt + Math.random());
      for (let i = 0; i < n; i++) {
        const v = sprayVelocity(p, b.vel.x, b.vel.z, Math.random(), Math.random());
        fx.spray(p.x + (Math.random() - 0.5) * 0.2, p.y + 0.04, p.z + (Math.random() - 0.5) * 0.2, v[0], v[1], v[2], p.y - 0.35);
      }
    }
  }
  motorNoiseT -= dt;
  if (outboard && Math.abs(boat.power) > 0.25 && motorNoiseT <= 0) {
    motorNoiseT = 0.5;
    eco.startle(boat.pos.x, -0.6, boat.pos.z, 5 + boat.speed * 1.4, 0.7);
  }
  // First person: you face where you look.
  if (rig.mode === 'eye' && onFoot && !(move.x || move.z)) walker.heading = dampAngle(walker.heading, rig.yaw, 10, dt);
  if (crew.on) rideCrew(dt);
  else if (onFoot && !driving && !dive) walker.update(dt, t, move, { jog: !fishing.busy && (input.jogging || (pads.active && pads.jog)), locked: fishing.busy && !(walkLine && fishing.lineOut), obstacles: solids });
  // The car: driven while you're at the wheel (a menu open puts the brake on); otherwise parked.
  {
    const live = driving && started;
    // (A dry tank: the engine's dead, though the brakes and the steering still work.)
    const dry = tanks().car <= 0;
    const bump = car.update(dt, t, { throttle: modal || dry ? 0 : carIn.throttle, steer: modal ? 0 : carIn.steer, brake: live && (modal || input.holding('cast')) ? 1 : 0 }, carWorld, { live, night: env.night, still: settings.controls.reducedMotion });
    if (bump) carBumped(bump);
    trailerBoatStep();
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
  // (No casting indoors: not through the chandlery's window, nor across the inn.)
  fishing.update(dt, t, rig.yaw, started && !modal && !placement.isOn && !driving && !cabinIn && !dive && !(onFoot && insideHaven(walker.pos.x, walker.pos.z)) && input.action);
  // (On the open map, you move across it as you go.)
  if (modal === 'map') mapSheet.follow(player());

  ecoTick(dt);
  handleClues();
  fx.update(dt, t, boat);
  updateFoamTrails(t);
  // The sea life round you, and (after dark, some nights more than others) the sea glowing
  // wherever it's stirred: fish darting near the surface, a moving lure, a diver's kicks.
  {
    const P = player().pos, aboard = !onFoot && !driving && !dive && !cabinIn;
    const crossingNow = !!state.crossing || inOcean(P.x, P.z);
    sealife.update(dt, t, { from: P, boat: aboard ? boat : null, boatSpeed: aboard ? Math.abs(boat.forwardSpeed) : 0, daylight: env.daylight, hour: clock.hour, region, eco, diving: !!dive, crossing: crossingNow, viewers: seaViewers });
    crossingLife.update(dt, t, { from: P, boat: aboard ? boat : null, boatSpeed: aboard ? Math.abs(boat.forwardSpeed) : 0, crossing: crossingNow, night: env.night });
    // (How fast you're coming: walking, the boat, swimming; sitting still is stillest of all.)
    const pace = sitting ? 0 : dive ? diver.speed : onFoot ? walker.speed : driving ? 10 : Math.abs(boat.forwardSpeed) + (boat.motor && boat.lever > 0 ? 1 : 0);
    wildlife.update(dt, t, { from: P, onFoot: onFoot && !dive && !driving, speed: pace, daylight: env.daylight, hour: clock.hour, season: seasonOf(clock.day).name, tideLevel: tideNow.level, region });
    birds.update(dt, t, { from: P, daylight: env.daylight, season: seasonOf(clock.day).name, region, near: !dive });
    // The harbour's people going about their day, and Dougie's boat.
    town.update(clock.abs, folkCtx(dt));
    {
      const B = region === 'home' ? buoyAt(state.favours, state.day * 24 + state.hour) : null;
      lostBuoy.visible = !!B;
      if (B) {
        lostBuoy.position.set(B.x, waveHeight(B.x, B.z, t) + 0.05, B.z);
        lostBuoy.rotation.z = Math.sin(t * 1.3) * 0.15;
      }
    }
    folkView.update(dt, t, town, { from: P, south: region === 'south', fx, glow, night: env.lantern, boats, more: visitors.boats() });
    {
      const W = folkCtx(0);
      passersby.update(dt, t, { day: clock.day, hour: clock.hour, season: W.season, rain: W.rain, storm: W.storm, wind: W.wind, from: P, home: region === 'home' });
    }
    // Friends you're playing with: where you are goes to them, and they're drawn where they are.
    together.update(dt, started ? whereIAm() : null);
    flushSale();
    watchCrew();
    lookForGulls(dt);
    // (Under water the right mouse button, held, looks about: see input.js.)
    input.rightLooks = !!dive;
    // (A guest in a friend's harbour, or back from one: your Willowhaven boats to where yours lie.)
    if (together.guestSlot !== homeSlot) rehome();
    {
      const plate = together.guestSlot >= 0 ? together.hostName || '' : settings.player.name;
      if (plate !== platedName) {
        platedName = plate;
        world.coast.ownerSign(plate);
      }
    }
    visitors.update(dt, t, together.peers, { from: P, fx, glow, night: env.lantern, me: together.id, mine: onFoot ? null : boat });
    placeFriendsFish(t);
    // A boat of yours lying where a friend's boat is (boats from the same jetty start in the same
    // spot) steps out of sight while theirs is there, rather than two hulls drawn in one.
    for (const b of boats) {
      if (!onFoot && b === boat) {
        b.group.visible = true;
        continue;
      }
      b.group.visible = !(together.active && b.speed < 0.3 && visitors.boatNear(b.pos.x, b.pos.z, b.hull.L * 0.35));
    }
    const callBtn = $('call-btn'), noCall = !(started && together.active);
    if (callBtn.hidden !== noCall) callBtn.hidden = noCall;
    if (!together.active && callsOpen()) closeCalls();
    if (modal === 'map' && together.active && (friendMapT -= dt) <= 0) {
      friendMapT = 0.5;
      mapSheet.draw();
    }
    glow.update(t, nightGlow(clock.day) * smoothstep(0.35, 0.85, env.night) * (1 - 0.5 * (weather.rain ?? 0)));
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
  // The binoculars: look about slowly (the narrower the view, the slower), and focus further.
  if (modal === 'binocs') binocularsLook(dt, drag, wheel);
  if (modal === 'inspect') {
    if (drag.x || drag.y) inspector.turn(drag.x, drag.y);
    if (input.steer || input.throttle) inspector.turn(-input.steer * 150 * dt, -input.throttle * 150 * dt);
    if (wheel) inspector.zoomBy(Math.exp(-wheel * 0.0015));
  }
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
  // (The steady camera: the eye eased against the boat's rise and fall, but never more than 15 cm
  // from where it is in her: no sinking through the console, no snap back.)
  if (!onFoot && steadyCam) _eye.y = eyeY = clamp(damp(eyeY, _eye.y, 0.6, dt), _eye.y - 0.15, _eye.y + 0.15);
  else eyeY = _eye.y;
  // Looking down at the dashboard, you lean in over it.
  dashLean = damp(dashLean, dashCtl.focused ? 1 : 0, 5, dt);
  if (dashLean > 0.01 && !onFoot && boat.dash && rig.mode === 'eye') _eye.lerp(boat.dash.centre(_dashAt), dashLean * 0.3);
  // Indoors (with the roof lifted), the camera comes in closer and looks down a little more.
  rig.indoor = onFoot && !driving && indoorsAt(walker.pos.x, walker.pos.z);
  // (The catch card beside the fish on a wide screen: the camera keeps the fish clear of it.)
  rig.heroShift = modal === 'catch' && innerWidth >= 900 ? 1 : 0;
  rig.update(dt, t, { boat, walker, started, fishing, baitFocus: fishing.watchPoint, eye: _eye, roll: onFoot || steadyCam || cabinIn ? 0 : boat.roll * 0.45 });
  if (modal === 'binocs') binocularsStep(dt);
  updateSitting(dt);
  if (sitting && !modal) sitCamera(dt);
  if (modal === 'rockpool' || (modal === 'inspect' && inspectFrom === 'rockpool') || (modal === 'photocard' && photoReturn === 'rockpool')) poolCamera(dt);
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
  stormFx.update(dt, t, { storm: Math.max(weather.storm, conditions.sea.storm * 0.8), camera, env, onThunder: (d, loud) => { audio.thunder?.(d, loud); haptics.pulse('thunder', clamp(loud, 0.15, 1)); }, flashes: !settings.controls.reducedMotion });
  watchStorm(dt);
  env.update(dt, t, sunHour(clock.hour, clock.abs), weather.rain, fpShadow ? _shadowAt : P, camera, renderer, weather.cloud);
  // Down among the Kelp Forest's stalks, under its canopy: the light dims and greens (see underwater.js).
  {
    const K = siteById.kelp, cp = camera.position;
    underwater.shade = cp.y < -1.2 ? smoothstep(K.r + 6, K.r * 0.55, Math.hypot(cp.x - K.x, cp.z - K.z)) * smoothstep(-1.2, -4, cp.y) : 0;
  }
  const sub = underwater.updateMedium(t, camera, env, scene, water, weather.rain);
  postLook.under = sub;
  audio.setUnderwater(sub);
  underwater.update(dt, t, camera, env, weather.rain);
  seabed.update(camera, sub);
  drifters.update(dt, t, camera, sub, clock.abs, dive ? diver.pos : null);
  rockpools.update(dt, t, player().pos, TIDE.level, clock.abs);
  fishRenderer.update(dt, camera, env.night, sub > 0.5);
  updateWind(dt * Math.min(speed, 10));
  world.update(dt, t, env, { fireLevel: camp.fireLevel, hatchLevel: hatchLevel(), hour: clock.hour, wind: 0.5 + Math.min(1, windAt(camera.position.x, camera.position.z).speed / FRESH) * 1.3, camera, fog: scene.fog.color, hurry: !!(traveling || sleeping), haven: { from: started ? player().pos : null, cam: camera.position, cutaway: rig.mode !== 'eye', onDoor: (open) => audio.door?.(open) } });
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
  mist.update(t, clock.hour, env, camera);
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
  // (E1: and the water's warmth at each depth there, for its layers: see sonarRead.js.)
  if (onFoot) finder.update(dt, fishing.baitInWater ? { x: fishing.hook.x, z: fishing.hook.z, mode: 'rig', moving: fishing.reelSpeed, temp: finderTemp(fishing.hook.x, fishing.hook.z, dt), tempAt: (d) => waterTempAt(fishing.hook.x, fishing.hook.z, d) } : { mode: 'none' }, eco.bait);
  else finder.update(dt, { x: boat.pos.x, z: boat.pos.z, mode: 'boat', moving: boat.speed, temp: finderTemp(boat.pos.x, boat.pos.z, dt), tempAt: (d) => waterTempAt(boat.pos.x, boat.pos.z, d) }, eco.bait);

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
  const room = onFoot && !driving ? insideHaven(P.x, P.z) : null;
  audio.update(dt, {
    // (Where the harbour's sounds come from, and you, hearing them: see earshot.js.)
    ear: earFrom(P),
    around: aroundEar(P, dt),
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
    fire: Math.max(camp.fireLevel * (1 - smoothstep(2, 18, fireD)), room === 'inn' ? 0.45 : 0),
    // Indoors: the outside muffled; at the inn, the talk at the bar (busier with more in).
    indoor: onFoot && indoorsAt(P.x, P.z) ? 1 : 0,
    pub: room === 'inn' ? Math.min(1, 0.25 + 0.2 * town.inside('inn')) : 0,
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
    noteTheDay(dt);
    updateGuide(dt);
    watchCamps();
    watchBirds(dt);
    // An open board keeps up with the hour: it's read off the water as it is now.
    if (modal === 'board' && $('board-sub').textContent !== `${formatClock(clock.hour)} · day ${state.day}`) renderBoard();
    if (slateDay !== state.day) chalkSlate();
    if (Math.hypot(player().pos.x - HAVEN_ROOMS.inn.doorX, player().pos.z - HAVEN_ROOMS.inn.front) < 40) chalkKitchen();
    // The fish in your creel: on ice, or in a cool-lined creel, their freshness keeps.
    const nowH = state.day * 24 + state.hour;
    // (Aboard a boat with a livewell, they're alive in it: no older for the market at all.)
    if (chilledTo < nowH && fitsAboard()?.livewell) {
      for (const f of state.keep) if (Number.isFinite(f.at) && !f.cooked) f.at = Math.min(nowH, f.at + (nowH - chilledTo));
    } else if (chilledTo < nowH) chill(state, chilledTo, nowH);
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
let slamFelt = 0, gearFelt = 0, powerFelt = 0;

// Once a frame: what's felt through the controller goes out (nothing in a menu, or when the
// controller isn't what you're playing with): a fish's weight on the line and the drag's buzz,
// the car's engine, and whatever else happened (see haptics.js).
function feelFrame(dt) {
  haptics.live = started && (!modal || modal === 'catch') && pads.active && !document.hidden;
  const F = fishing.fight;
  if (F && !F.atNet) {
    const f = lineFeel(F.tension, F.slipping, F.pulling ? clamp((F.ratio ?? 1) / Math.max(0.3, DRAG_LEVELS[F.drag] ?? 0.55) - 1, 0, 1) : 0);
    haptics.hold('line', f.weight.strong, f.weight.weak, { rt: f.weight.rt });
    if (f.drag) haptics.hold('drag', 0, f.drag.weak, { rt: f.drag.rt, buzz: f.drag.buzz });
  }
  // The car: a swell as you put your foot down, not a hum all the while you drive.
  if (driving && tanks().car > 0) {
    const th = Math.max(0, carIn.throttle || 0);
    if (th > carFelt + 0.35) {
      haptics.pulse({ strong: 0.3, weak: 0.25, ms: 380, shape: 'swell' }, 0.6 + 0.4 * th);
      carFelt = th;
    } else if (th < carFelt) carFelt = th;
  } else carFelt = 0;
  haptics.update(dt);
}
let carFelt = 0;

// The boat through your hands (see haptics.js): not a hum all the while you're aboard, only what
// you'd notice: the clunk into gear, the engine digging in as you open her up (heavier on the big
// inboards, next to nothing from an electric motor), and a sea slamming under her bow at speed.
// (The engine firing as it starts is felt too: see engineEvent.)
function feelBoat(motorOn, outboard, voice) {
  if (onFoot || dive || driving) return;
  // (The clunk of going into gear, ahead or astern.)
  const g = Math.sign(boat.power);
  if (motorOn && outboard && g && g !== gearFelt) haptics.pulse('gear');
  gearFelt = g;
  // Opening her up: one swell as she digs in, for each push of the lever (by how far it went up).
  const p = motorOn ? Math.abs(boat.lever || 0) : 0;
  if (p > powerFelt + 0.2) {
    const e = engineFeel(p, { inboard: voice === 'inboard', jet: voice === 'jet', electric: !outboard, running: true });
    haptics.pulse({ strong: 1.6 * e.strong + 0.1, weak: 1.4 * e.weak, ms: 480, shape: 'swell' }, clamp(p - powerFelt, 0.3, 1));
    powerFelt = p;
  } else if (p < powerFelt) powerFelt = p;
  // (Each slam once, as she comes down into the sea, not all the while she's in it.)
  const k = slamFeel(boat.slam);
  if (k > 0.05 && k > slamFelt + 0.15) haptics.pulse({ strong: 1, weak: 0.4, ms: 240, shape: 'thump' }, k);
  slamFelt = k > slamFelt ? k : Math.max(0, slamFelt - 0.016 * 3);
}

// The boats bump gently instead of sailing through each other.
function keepBoatsApart() {
  const all = strays.size ? [...boats, ...strays.values()] : boats;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const A = all[i], B = all[j], a = A.pos, b = B.pos;
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
  if (farWakes.on) farWakes.render(renderer, camera.position.x, camera.position.z);
  ripples.render(renderer, _rf.x, _rf.z);
  // (Boats far off without their small parts: see boat.js boatDetail. Before the reflection, so
  // it's spared them too.)
  boatDetail(camera.position, scene);
  reflection.render(renderer, scene, camera);
  const wu = water.uniforms;
  wu.uReflOn.value = reflection.active ? 1 : 0;
  wu.uRefl.value = reflection.target.texture;
  wu.uReflMatrix.value.copy(reflection.matrix);
  wu.uReflTexel.value.set(1 / reflection.target.width, 1 / reflection.target.height);
  wu.uRippleOn.value = ripples.on ? 1 : 0;
  wu.uRipple.value = ripples.target?.texture || null;
  wu.uRippleRect.value.copy(ripples.rect);
  wu.uFarOn.value = farWakes.on ? 1 : 0;
  wu.uFarRipple.value = farWakes.target?.texture || null;
  wu.uFarRect.value.copy(farWakes.rect);
  renderer.render(scene, camera);
  if (post.on) post.finish(camera, lookOfTheHour());
}

// The colour of the hour for the finishing pass: warm at sunrise and in the golden hour, a little
// cool by moonlight, plain in rain and underwater (where the water has its own colour).
const postLook = { sunDir: env.sunDir, sunColor: new THREE.Color(), low: 0, night: 0, tint: new THREE.Color(), sat: 1, under: 0 };
const _warm = new THREE.Color(1.045, 1.0, 0.93), _cool = new THREE.Color(0.95, 0.98, 1.05), _rose = new THREE.Color(1.035, 0.985, 0.985);
function lookOfTheHour() {
  const L = postLook, h = clock.hour, clear = (1 - weather.rain) * (1 - weather.cloud * 0.6) * (1 - L.under);
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
  state, walker, fishing, env, weather, renderer, post, scene, camera, quality, eco, habitat, rig, finder, underwater, camp, world, explored, stormFx, mapSheet,
  get boat() { return boat; }, // the boat you're in (or last used)
  reflection, ripples, mist, fx, rodView, audio, settingsUI, input, packUI, pads, sealife, wildlife, crossingLife, glow,
  // What the harbour's placed sounds come from just now (see earshot.js), and the town's boats.
  get around() { return around; }, town,
  openHarbour: (where, tab) => openHarbour(where, tab), fitsAboard: () => fitsAboard(),
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
  // The fast passage: slowTide.passage('south') to Las Brasas, ('home') back; which sea you're in.
  // The crossing at the helm: slowTide.cross('south'), and where it's at (slowTide.crossing()).
  passage: (to = 'south') => startPassage(to),
  cross: (to = 'south') => startCrossing(to),
  crossing: () => state.crossing,
  get region() { return region; },
  // Put yourself ashore at (x, z), e.g. slowTide.walkTo(-99, -2) for camp.
  walkTo: (x, z, heading = walker.heading) => {
    walker.place(x, z, heading);
    if (!onFoot) setFoot(true);
  },
  board: () => board(),
  // The field guide open at a species, e.g. slowTide.openGuide('bluemarlin').
  openGuide: (id) => openGuide(id),
  rowboat, skiff, boats: BOATS, wind, town, folkView, passersby, together, visitors, clock, drifters, seabed, shared, teamwork, crew, birds, binoculars: { open: () => openBinoculars(), close: () => closeBinoculars() }, catchCard: (id, size) => showCatch(fishById[id], size, eco.bySpecies[id]?.[0] || { x: 0, z: 0, caught: 0 }, null), inspect: { open: () => openInspect(), close: () => closeInspect(), get on() { return inspector.isOpen; } }, interaction: () => interaction(), engineHere: () => engineHere(), openBoard: () => openBoard(), closeBoard: () => closeBoard(), payJobTwice: (id) => payJob(id), get passengers() { return passengers.count; }, get pickupsShown() { return pickups.count; }, padContext: () => padContext(), jobsChanged: () => jobWeight(), strays, get towing() { return tow ? { lead: tow.lead.kind, towed: tow.towed.boatName || tow.towed.name, tight: tow.tight, T: tow.T || 0 } : null; }, takeInTow: (kind) => takeInTow(BOATS[kind]), seaHere: (x, z) => waveHeightHere(x, z), save: () => save(), hideHud: (on = true) => { hudOff = on; hud.hidden(on); }, get crewFrom() { return crewFrom; },
  // The harbour's sheets: slowTide.harbour('market'), ('inn', 'kitchen'), ('chandlery').
  harbour: (where, tab) => openHarbour(where, tab),
  pump: (id = 'haven') => openPump(id),
  get yard() { return state.yard; },
  get money() { return state.money; },
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
    if (b.stowed) {
      if (boats.length >= MAX_AFLOAT) storeBoat(boats.find((o) => o !== boat && o !== b) || boats[0], { quiet: true });
      launchBoat(b, { quiet: true });
    }
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
    water.follow(camera.position);
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
// The benchmark: bench.html opened this page to measure one scenario (see bench.js), once the
// game has loaded.
if (BENCH_RUN) setTimeout(() => import('./bench.js').then((m) => m.benchRun(BENCH_RUN, window.slowTide)), 3000);
