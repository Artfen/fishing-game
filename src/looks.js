// You, as you'd like to look (D of docs/WORLD-DEPTH.md): your skin, your raincoat, the jumper
// under it and the shirt under that, your trousers and boots, a hat (the sun hat, or a cap, a
// beanie, a bucket hat, a flat cap, or just your hair) and its colour, your hair, a beard, glasses.
// Chosen in Settings → You, worn on foot and in every boat (dress.js dressFigure: walker.js and
// boat.js both dress the same figure), and sent to friends with your name (together.js), so they see you as you made
// yourself rather than as their game guessed from your name.
//
// What you wear still keeps you warm and dry as before (comfort.js): the raincoat keeps the rain
// off whatever its colour, the woolly hat comes out when it's cold whatever hat you chose.
//
// state.look: { skin, coat, jumper, shirt, legs, boots, hat, hatColor, hair, beard, glasses, outfit }.

// The choices (colours as hex; a broad, even range of skin tones).
import { $t } from './i18n.js';
export const LOOK_OPTIONS = {
  skin: ['#f6d9c2', '#f1c7a1', '#e3b48e', '#d2a07a', '#b98863', '#a0704b', '#7d5236', '#5c3a24'],
  coat: ['#e8b440', '#c8452f', '#24354f', '#2f5a43', '#e2662a', '#5f6b74', '#6f3a5a', '#2c7c7a'],
  jumper: ['#5f7486', '#8a3a2f', '#3d5a3a', '#d8ccb0', '#2b2f3a', '#a88a5a'],
  shirt: ['#d8ccb0', '#e9e5dc', '#7fa8c9', '#c97a6a', '#8a9a6a'],
  legs: ['#3b4a68', '#2f3a2a', '#3b3b3b', '#6b5a44', '#5a5f66', '#2a2a2e'],
  boots: ['#2d2a28', '#3d5a3a', '#d8b440', '#6b4429', '#24354f'],
  hat: ['sun', 'cap', 'beanie', 'bucket', 'flatcap', 'hair', 'bun'],
  hatColor: ['#35676b', '#c8452f', '#24354f', '#d8ccb0', '#2f5a43', '#e2662a', '#2b2f3a', '#8a7a52'],
  hair: ['#2a211c', '#4a2f22', '#8a4a2a', '#b06a3a', '#d8b46a', '#a9a59e', '#e9e5dc'],
  beard: ['none', 'short', 'full'],
  glasses: ['none', 'glasses', 'shades'],
  // (H4b) What you wear over it all: as the weather has it (the raincoat, the jumper or the shirt),
  // or oilskins, a fishing vest, a life jacket, a hoodie, waders, a wetsuit (body.js OUTFITS).
  outfit: ['weather', 'oilskins', 'vest', 'lifejacket', 'hoodie', 'waders', 'wetsuit'],
};
// As you've always looked: the yellow raincoat and the teal sun hat.
export const DEFAULT_LOOK = {
  skin: '#f1c7a1', coat: '#e8b440', jumper: '#5f7486', shirt: '#d8ccb0', legs: '#3b4a68', boots: '#2d2a28',
  hat: 'sun', hatColor: '#35676b', hair: '#4a2f22', beard: 'none', glasses: 'none', outfit: 'weather',
};
// The words for the choices that aren't colours.
export const LOOK_WORDS = {
  hat: { sun: $t('Sun hat'), cap: $t('Cap'), beanie: $t('Beanie'), bucket: $t('Bucket hat'), flatcap: $t('Flat cap'), hair: $t('No hat'), bun: $t('No hat, hair up') },
  beard: { none: $t('Clean-shaven'), short: $t('Short beard'), full: $t('Full beard') },
  glasses: { none: $t('No glasses'), glasses: $t('Glasses'), shades: $t('Sunglasses') },
  outfit: { weather: $t('As the weather has it'), oilskins: $t('Oilskins'), vest: $t('Fishing vest'), lifejacket: $t('Life jacket'), hoodie: $t('Hoodie'), waders: $t('Waders'), wetsuit: $t('Wetsuit') },
};

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// A look from a save or a friend, made sensible: anything not on the lists is as you came.
export function cleanLook(raw) {
  const r = isObj(raw) ? raw : {};
  const out = {};
  for (const [k, opts] of Object.entries(LOOK_OPTIONS)) out[k] = opts.includes(r[k]) ? r[k] : DEFAULT_LOOK[k];
  return out;
}
export const isDefault = (look) => Object.keys(DEFAULT_LOOK).every((k) => look[k] === DEFAULT_LOOK[k]);

// The look a friend's figure takes (world/folk.js Figure, hats.js: the sun hat as yours is; no hat
// shows the hair). (H1a) With the rest of it, for what the folk figure doesn't make itself: the
// jumper and shirt (worn as the weather has them: see visitors.js), the beard and glasses.
export function figureLook(look) {
  const L = cleanLook(look);
  return { coat: L.coat, legs: L.legs, boots: L.boots, skin: L.skin, hat: L.hat, hatColor: L.hat === 'hair' || L.hat === 'bun' ? L.hair : L.hatColor, hair: L.hair, jumper: L.jumper, shirt: L.shirt, beard: L.beard, glasses: L.glasses, outfit: L.outfit };
}
