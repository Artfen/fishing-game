import { clamp, lerp, smoothstep } from './util.js';

// How the angler feels on a long day out: warm or cold, dry or damp, thirsty or not (hunger is
// the camp's: see camp.js). Light on purpose: it makes the character answer the weather and the
// trip, and never stops you fishing or does you any harm.
//
//  · Warmth: how warm it feels to you, in °C: the air (cooler at night, under cloud and rain, and
//    higher up the fell; warm at Las Brasas), the wind on you, the sun, what you're wearing, how
//    hard you're moving, damp clothes, and shelter or a fire. Your body follows it over a little
//    while (half an hour of the game's time), so you warm up and cool down rather than jump.
//  · Wet: rain soaks you (the raincoat keeps most of it off), wading and spray too; clothes dry in
//    the air, faster in sun and wind, and quickly by a fire or indoors. Damp clothes feel cold.
//  · Thirst: it builds slowly over a day out (faster in the heat or working hard). A water bottle
//    in your pack holds four drinks; fill it wherever there's water to be had.
//  · Packed food: a few rolls in your pack for when you're far from a kitchen.
//
// The Character needs setting decides how much of this you see and feel: Off (nothing), Shown
// (the character and the hints, no effects), Gentle (the default: as Shown, and only when a need
// gets very low, a slightly slower walk, a little shake in the hands, slower to catch your breath).

export const NEEDS_MODES = {
  off: { label: 'Off', desc: 'No warmth, wet, thirst or hunger: the angler never feels the weather.' },
  shown: { label: 'Shown only', desc: 'The angler shivers, sweats, drips and takes a drink, and the hints say what would help, but nothing ever slows you down.' },
  gentle: { label: 'Gentle', desc: 'As Shown, and only when a need gets very low: a slightly slower walk, a little shake in the hands, slower to get your breath back. It never stops you fishing.' },
};
export const NEEDS_IDS = Object.keys(NEEDS_MODES);

// What you can wear: how much warmer it keeps you (°C), how much rain it keeps off, and how much
// of the wind (a raincoat is windproof too).
export const CLOTHES = {
  coat: { name: 'Raincoat', note: 'A yellow oilskin: keeps the rain and the wind off, but hot in the sun.', warm: 1.5, rain: 0.85, wind: 0.5 },
  jumper: { name: 'Wool jumper', note: 'Thick and warm, even a little damp. No good in the rain on its own.', warm: 4, rain: 0, wind: 0.15 },
  hat: { name: 'Woolly hat', note: 'Keeps your head warm on a cold night or up the fell (instead of the sun hat).', warm: 1.5, rain: 0, wind: 0.1 },
};
export const CLOTHES_IDS = Object.keys(CLOTHES);
export const BOTTLE = 4; // drinks in a full water bottle
export const ROLLS = 4;  // packed rolls you can carry
const DRINK = 30;        // how much one drink (or a roll) does
const ROLL_FILL = 18;

// A fresh record: the raincoat on (it's what you've always worn), dry, not thirsty, a full
// bottle and a couple of rolls.
export const newComfort = () => ({ warm: 16, wet: 0, drink: 85, bottle: BOTTLE, rolls: 2, wear: { coat: true, jumper: false, hat: false } });

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
export function cleanComfort(raw) {
  const d = newComfort();
  if (!isObj(raw)) return d;
  const w = isObj(raw.wear) ? raw.wear : {};
  return {
    warm: num(raw.warm, d.warm, -10, 45),
    wet: num(raw.wet, 0, 0, 1),
    drink: num(raw.drink, d.drink, 0, 100),
    bottle: Math.round(num(raw.bottle, BOTTLE, 0, BOTTLE)),
    rolls: Math.round(num(raw.rolls, d.rolls, 0, ROLLS)),
    wear: { coat: w.coat === undefined ? true : !!w.coat, jumper: !!w.jumper, hat: !!w.hat },
  };
}

/* ---------------- the weather on you ---------------- */

// The air's temperature (°C). env: { hour, south (at Las Brasas), height (m above the sea),
// cloud, rain, storm }.
export function airTemp({ hour, south = false, height = 0, cloud = 0.3, rain = 0, storm = 0 }) {
  // Coolest just before dawn, warmest mid-afternoon.
  const day = 0.5 + 0.5 * Math.cos(((hour - 15) / 24) * Math.PI * 2);
  let t = south ? lerp(18.5, 25, day) : lerp(8, 17, day);
  // Cloud keeps the night warmer and the day cooler; rain and a storm chill it.
  t -= (day - 0.4) * 4 * cloud;
  t -= rain * 2 + storm * 3;
  // About six and a half degrees colder for every kilometre up.
  return t - 0.0065 * Math.max(0, height);
}

// How warm it feels to you just now (°C). c: the comfort record (what you wear, how wet you are);
// env: as for airTemp, and wind (m/s where you are), sun (0 … 1: the sun on you), moving (0 … 1:
// how hard you're working: walking, jogging, rowing), shelter (0 … 1: indoors, the car, a cabin),
// fire (0 … 1: how close you are to a fire or a stove).
export function feelsLike(c, env) {
  const W = c.wear;
  let t = airTemp(env);
  const block = clamp((W.coat ? CLOTHES.coat.wind : 0) + (W.jumper ? CLOTHES.jumper.wind : 0) + (W.hat ? CLOTHES.hat.wind : 0), 0, 0.8);
  t -= 0.55 * Math.max(0, (env.wind ?? 0) - 1) * (1 - block) * (1 + 0.6 * c.wet) * (1 - (env.shelter ?? 0));
  // The sun on you: less under the sun hat (the woolly hat lets it through).
  t += 4.5 * (env.sun ?? 0) * (W.hat ? 1 : 0.6) * (1 - (env.shelter ?? 0));
  for (const id of CLOTHES_IDS) if (W[id]) t += CLOTHES[id].warm * (id === 'jumper' ? 1 - 0.4 * c.wet : 1);
  t += 3 * (env.moving ?? 0);
  t -= 7 * c.wet;
  // Shelter: a roof, walls and the heating on; a fire's warmth when you're close to it.
  t = lerp(t, Math.max(t, 21), env.shelter ?? 0);
  t += 11 * (env.fire ?? 0);
  return t;
}

// One step of the day: hours of the game's time gone by. env: as for feelsLike, and wading (0 …
// 1: how deep you're standing in the water), spray (0 … 1: a boat throwing spray over you),
// asleep (indoors or in a tent: you wake warm and dry).
export function stepComfort(c, hours, env) {
  if (hours <= 0) return c;
  const W = c.wear;
  if (env.asleep) {
    c.warm = lerp(c.warm, 18, 1 - Math.exp(-hours * 2));
    c.wet = Math.max(0, c.wet - hours * 0.8);
    c.drink = clamp(c.drink - hours * 1.2, 0, 100);
    return c;
  }
  // Getting wet: rain (mostly kept off by the raincoat), wading, spray. Drying: in the air, faster
  // in the sun and the wind, and quickly by a fire or indoors.
  const keep = W.coat ? CLOTHES.coat.rain : 0;
  const shelter = env.shelter ?? 0;
  const soak = (env.rain ?? 0) * 0.9 * (1 - keep) * (1 - shelter) + (env.wading ?? 0) * 5 + (env.spray ?? 0) * 0.8 * (1 - keep * 0.6);
  const dry = (0.35 + 0.6 * (env.sun ?? 0) + 0.04 * Math.min(env.wind ?? 0, 10)) * (1 - 0.8 * (env.rain ?? 0)) + 3 * (env.fire ?? 0) + 2.5 * shelter;
  c.wet = clamp(c.wet + (soak - dry * (c.wet > 0 ? 1 : 0)) * hours, 0, 1);
  // Your warmth follows how warm it feels, over half an hour or so.
  const f = feelsLike(c, env);
  c.warm = lerp(c.warm, f, 1 - Math.exp(-hours * 2.2));
  // Thirst: faster in the heat and working hard.
  const heat = smoothstep(24, 32, c.warm);
  c.drink = clamp(c.drink - hours * 3.4 * (1 + 1.2 * heat + 0.5 * (env.moving ?? 0)), 0, 100);
  return c;
}

/* ---------------- what you do about it ---------------- */

export function drink(c) {
  if (c.bottle <= 0) return false;
  c.bottle--;
  c.drink = Math.min(100, c.drink + DRINK);
  return true;
}
// Fill up: the bottle, and drink your fill while you're at it.
export function refill(c) {
  c.bottle = BOTTLE;
  c.drink = Math.max(c.drink, 90);
}
export function eatRoll(c, food) {
  if (c.rolls <= 0) return false;
  c.rolls--;
  food.full = Math.min(100, food.full + ROLL_FILL);
  return true;
}
export function packRolls(c) {
  const had = c.rolls;
  c.rolls = ROLLS;
  return ROLLS - had;
}
// A hot meal at a camp or a kitchen comes with a mug of tea.
export const mealDrink = (c) => { c.drink = Math.min(100, c.drink + 20); };

// What to wear for the weather just now: the raincoat in rain (or a cold wind), the jumper when
// it's cool, the woolly hat when it's cold; nothing extra in the heat.
export function dressFor(c, env) {
  const bare = { ...c, wet: 0, wear: { coat: false, jumper: false, hat: false } };
  const t = feelsLike(bare, env);
  const wear = { coat: (env.rain ?? 0) > 0.15 || (env.spray ?? 0) > 0.2 || t < 9, jumper: t < 14, hat: t < 8 };
  // (Too much in the warm makes you hot: only what keeps you comfortable.)
  if (t > 22 && (env.rain ?? 0) < 0.4) wear.coat = false;
  return wear;
}

/* ---------------- in words ---------------- */

// How you feel, for the HUD: the warmth word, then the others, worst first. Each { id, word, low }
// (low: very low, so it shows in colour and, on Gentle, has its small effect).
export function needsOf(c, food) {
  const out = [];
  const w = c.warm;
  if (w < 6) out.push({ id: 'cold', word: 'Cold', low: true });
  else if (w < 12) out.push({ id: 'chilly', word: 'Chilly', low: false });
  else if (w > 32) out.push({ id: 'hot', word: 'Hot', low: true });
  else if (w > 28) out.push({ id: 'warm', word: 'Warm', low: false });
  if (c.wet > 0.6) out.push({ id: 'soaked', word: 'Soaked', low: false });
  else if (c.wet > 0.2) out.push({ id: 'damp', word: 'Damp', low: false });
  if (c.drink < 15) out.push({ id: 'parched', word: 'Parched', low: true });
  else if (c.drink < 40) out.push({ id: 'thirsty', word: 'Thirsty', low: false });
  if (food) {
    if (food.full < 15) out.push({ id: 'hungry', word: 'Hungry', low: true });
    else if (food.full < 40) out.push({ id: 'peckish', word: 'Peckish', low: false });
  }
  return out.sort((a, b) => b.low - a.low);
}

// The small effects, on Gentle only, and only when a need is very low: how fast you walk (a share),
// how steady your hands are in a fight (over 1 is a little shakier), and how fast you get your
// breath back after a dive (a share).
export function effectsOf(c, food, mode = 'gentle') {
  const out = { pace: 1, shake: 1, breath: 1 };
  if (mode !== 'gentle') return out;
  const cold = smoothstep(6, 2, c.warm), hot = smoothstep(32, 36, c.warm);
  const parched = smoothstep(15, 0, c.drink), hungry = smoothstep(15, 0, food?.full ?? 100);
  out.pace = 1 - 0.1 * Math.max(cold, hot, parched, hungry * 1.8);
  out.shake = 1 + 0.15 * Math.max(cold, parched * 0.6);
  out.breath = 1 - 0.18 * Math.max(cold, parched, hungry);
  return out;
}
