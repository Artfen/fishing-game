// How the angler feels on a long day out (src/comfort.js): cold at night and up the fell, warm at
// Las Brasas, clothes that help (and a raincoat too hot in the sun), rain that soaks and sun and a
// fire that dry, thirst that builds slowly, a bottle and rolls in the pack, and effects that are
// small, only when a need is very low, and never at all unless you want them; and the figure
// dressed to match (dress.js). Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const C = await import('../src/comfort.js');

const dressed = (wear) => ({ ...C.newComfort(), wear: { coat: false, jumper: false, hat: false, ...wear } });
const NOON = { hour: 13, wind: 3, sun: 0.8, cloud: 0.2 };
const NIGHT = { hour: 2, wind: 6, sun: 0, cloud: 0.3 };
const RAIN = { hour: 11, wind: 7, sun: 0, cloud: 1, rain: 0.9 };
const run = (c, hours, env, step = 1 / 60) => {
  for (let h = 0; h < hours; h += step) C.stepComfort(c, step, env);
  return c;
};

test('the air: colder at night, in rain and up the fell; warm at Las Brasas', () => {
  assert.ok(C.airTemp(NIGHT) < C.airTemp(NOON) - 5);
  assert.ok(C.airTemp(RAIN) < C.airTemp({ ...RAIN, rain: 0 }));
  assert.ok(C.airTemp({ ...NOON, height: 570 }) < C.airTemp(NOON) - 3, 'about 6.5° a kilometre');
  assert.ok(C.airTemp({ ...NOON, south: true }) > C.airTemp(NOON) + 5);
  assert.ok(C.airTemp({ ...NIGHT, south: true }) > 15, 'warm nights in the south');
});

test('clothes help, the raincoat keeps the wind and rain off, and too much in the heat is hot', () => {
  const bare = dressed({}), all = dressed({ coat: true, jumper: true, hat: true });
  assert.ok(C.feelsLike(all, NIGHT) > C.feelsLike(bare, NIGHT) + 6);
  assert.ok(C.needsOf(run(dressed({}), 2, NIGHT)).some((n) => n.id === 'chilly' || n.id === 'cold'), 'a cold night with nothing on');
  assert.equal(C.needsOf(run(dressed({ coat: true, jumper: true, hat: true }), 2, NIGHT)).length, 0, 'comfortable dressed for it');
  // Rain: soaked without the raincoat, nearly dry with it.
  const wet = run(dressed({}), 1, RAIN), dry = run(dressed({ coat: true }), 1, RAIN);
  assert.ok(wet.wet > 0.5 && dry.wet < 0.15, `${wet.wet.toFixed(2)} vs ${dry.wet.toFixed(2)}`);
  assert.ok(wet.warm < dry.warm - 2, 'wet clothes feel cold');
  // Las Brasas at noon, working at the oars in the jumper and raincoat: hot.
  const south = { ...NOON, south: true, sun: 0.95, moving: 0.8, wind: 5 };
  const over = run(dressed({ coat: true, jumper: true }), 1.5, south);
  assert.ok(C.needsOf(over).some((n) => n.id === 'hot' || n.id === 'warm'), `${over.warm.toFixed(1)}°`);
  assert.equal(C.needsOf(run(dressed({}), 1.5, south)).filter((n) => n.id === 'hot').length, 0);
  // What to wear: the raincoat in rain, layers on a cold night, nothing extra in the heat.
  assert.ok(C.dressFor(C.newComfort(), RAIN).coat);
  assert.deepEqual(C.dressFor(C.newComfort(), NIGHT), { coat: true, jumper: true, hat: true });
  assert.deepEqual(C.dressFor(C.newComfort(), south), { coat: false, jumper: false, hat: false });
});

test('clothes dry in the sun and the wind, and quickly by a fire or indoors; wading soaks them', () => {
  const sunny = run(Object.assign(dressed({}), { wet: 1 }), 1, NOON);
  const fire = run(Object.assign(dressed({}), { wet: 1 }), 0.3, { ...NIGHT, fire: 0.9 });
  const indoors = run(Object.assign(dressed({}), { wet: 1 }), 0.4, { ...RAIN, shelter: 1 });
  assert.ok(sunny.wet < 0.2 && fire.wet < 0.2 && indoors.wet < 0.2, `${sunny.wet.toFixed(2)} ${fire.wet.toFixed(2)} ${indoors.wet.toFixed(2)}`);
  const cold = run(Object.assign(dressed({}), { wet: 1 }), 0.3, NIGHT);
  assert.ok(fire.warm > cold.warm + 4 && indoors.warm > 16, `and warm you up: ${fire.warm.toFixed(1)}° by the fire, ${cold.warm.toFixed(1)}° without, ${indoors.warm.toFixed(1)}° indoors`);
  assert.ok(run(dressed({ coat: true }), 0.2, { ...NOON, wading: 0.8 }).wet > 0.3, 'wading');
  // Asleep, indoors or in the tent: you wake warm and dry.
  const night = C.stepComfort(Object.assign(dressed({}), { wet: 1, warm: 4 }), 8, { ...RAIN, asleep: true });
  assert.ok(night.wet === 0 && night.warm > 15);
});

test('thirst builds slowly over a day out, faster in the heat; the bottle and the rolls', () => {
  const day = run(C.newComfort(), 6, NOON);
  assert.ok(day.drink > 50 && day.drink < 75, `${day.drink.toFixed(0)} after six hours`);
  const hot = run(dressed({ coat: true, jumper: true }), 6, { ...NOON, south: true, sun: 1, moving: 1 });
  assert.ok(hot.drink < day.drink - 10, 'thirstier in the heat');
  const c = Object.assign(C.newComfort(), { drink: 10 });
  assert.ok(C.needsOf(c).some((n) => n.id === 'parched' && n.low));
  for (let i = 0; i < C.BOTTLE; i++) assert.ok(C.drink(c));
  assert.equal(C.drink(c), false, 'empty');
  assert.equal(c.drink, 100);
  C.refill(c);
  assert.equal(c.bottle, C.BOTTLE);
  const food = { full: 20 };
  c.rolls = 1;
  assert.ok(C.eatRoll(c, food) && food.full > 30 && c.rolls === 0);
  assert.equal(C.eatRoll(c, food), false);
  assert.equal(C.packRolls(c), C.ROLLS);
});

test('the effects are small, only when a need is very low, and only on Gentle', () => {
  const fine = C.newComfort();
  assert.deepEqual(C.effectsOf(fine, { full: 80 }), { pace: 1, shake: 1, breath: 1 });
  // Merely chilly, damp, thirsty and peckish: shown, but no effect at all.
  const meh = Object.assign(C.newComfort(), { warm: 10, wet: 0.4, drink: 30 });
  assert.deepEqual(C.effectsOf(meh, { full: 30 }), { pace: 1, shake: 1, breath: 1 });
  // Very cold and parched: a little slower and shakier, never stopped.
  const low = Object.assign(C.newComfort(), { warm: 0, drink: 0 });
  const e = C.effectsOf(low, { full: 0 });
  assert.ok(e.pace < 1 && e.pace >= 0.8 && e.shake > 1 && e.shake <= 1.15 && e.breath < 1 && e.breath >= 0.8, JSON.stringify(e));
  for (const mode of ['off', 'shown']) assert.deepEqual(C.effectsOf(low, { full: 0 }, mode), { pace: 1, shake: 1, breath: 1 });
  assert.deepEqual(C.NEEDS_IDS, ['off', 'shown', 'gentle']);
});

test('the figure wears what you wear: the raincoat, the jumper or a shirt, the sun hat or the woolly one, darker when wet', async () => {
  const THREE = await import('three');
  const { Dress } = await import('../src/dress.js');
  const coat = new THREE.MeshLambertMaterial(), pants = new THREE.MeshLambertMaterial(), head = new THREE.Group(), sunHat = new THREE.Group(), mats = [];
  const d = new Dress({ coat, pants, head, sunHat, mats });
  assert.equal(mats.length, 1, 'the woolly hat hides with the rest in first person');
  d.set({ coat: true, jumper: false, hat: false });
  const yellow = coat.color.getHexString();
  assert.ok(sunHat.visible && !d.woolly.visible);
  d.set({ coat: false, jumper: true, hat: true });
  assert.notEqual(coat.color.getHexString(), yellow, 'the jumper shows with the coat off');
  assert.ok(!sunHat.visible && d.woolly.visible, 'the woolly hat on');
  const dry = coat.color.getHSL({}).l;
  d.set({ coat: false, jumper: true, hat: true }, 1);
  assert.ok(coat.color.getHSL({}).l < dry * 0.8, 'darker soaked');
  // The drink has a key of its own, and nothing else uses it.
  const { ACTIONS } = await import('../src/input.js');
  const drink = ACTIONS.find((a) => a.id === 'drink');
  assert.ok(drink && ACTIONS.every((a) => a === drink || !a.keys.some((k) => drink.keys.includes(k))));
});

test('the record is kept in the save, cleaned of anything strange', async () => {
  const back = C.cleanComfort({ warm: 99, wet: -3, drink: 'x', bottle: 9, rolls: 2.4, wear: { coat: false, jumper: 1 } });
  assert.deepEqual(back, { warm: 45, wet: 0, drink: 85, bottle: C.BOTTLE, rolls: 2, wear: { coat: false, jumper: true, hat: false } });
  assert.equal(C.cleanComfort(null).wear.coat, true, 'the raincoat on, as ever');
  const { parseSave, SAVE_VERSION } = await import('../src/save.js');
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1000, data: { day: 2, comfort: { warm: 9, wet: 0.5, drink: 33, bottle: 1, rolls: 0, wear: { coat: true, jumper: true, hat: true } } } })).state;
  assert.equal(s.comfort.wet, 0.5);
  assert.equal(s.comfort.bottle, 1);
  assert.equal(s.comfort.wear.hat, true);
  const { cleanSettings, DEFAULT_SETTINGS } = await import('../src/settings.js');
  assert.equal(DEFAULT_SETTINGS.controls.needs, 'gentle');
  assert.equal(cleanSettings({ controls: { needs: 'off' } }).controls.needs, 'off');
  assert.equal(cleanSettings({ controls: { needs: 'hardcore' } }).controls.needs, 'gentle');
});
