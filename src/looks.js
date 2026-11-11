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
// state.look: { skin, coat, jumper, shirt, legs, boots, hat, hatColor, hair, beard, glasses }.

// The choices (colours as hex; a broad, even range of skin tones).
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
};
// As you've always looked: the yellow raincoat and the teal sun hat.
export const DEFAULT_LOOK = {
  skin: '#f1c7a1', coat: '#e8b440', jumper: '#5f7486', shirt: '#d8ccb0', legs: '#3b4a68', boots: '#2d2a28',
  hat: 'sun', hatColor: '#35676b', hair: '#4a2f22', beard: 'none', glasses: 'none',
};
// The words for the choices that aren't colours.
export const LOOK_WORDS = {
  hat: { sun: 'Sun hat', cap: 'Cap', beanie: 'Beanie', bucket: 'Bucket hat', flatcap: 'Flat cap', hair: 'No hat', bun: 'No hat, hair up' },
  beard: { none: 'Clean-shaven', short: 'Short beard', full: 'Full beard' },
  glasses: { none: 'No glasses', glasses: 'Glasses', shades: 'Sunglasses' },
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

// The look a friend's figure takes (world/folk.js Figure: the sun hat is drawn as a bucket hat;
// no hat shows the hair).
export function figureLook(look) {
  const L = cleanLook(look);
  const hat = L.hat === 'sun' ? 'bucket' : L.hat;
  return { coat: L.coat, legs: L.legs, boots: L.boots, skin: L.skin, hat, hatColor: hat === 'hair' || hat === 'bun' ? L.hair : L.hatColor, hair: L.hair };
}
