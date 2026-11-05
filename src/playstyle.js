// One question instead of six: how do you like to play? Each answer sets the fight's difficulty,
// how the fish behave, casting, starting the engine, the throttle and the economy together (each
// can still be changed on its own in Settings, which then calls it your own mix).

export const STYLES = {
  easy: {
    name: 'Easy-going',
    desc: 'Fish give you longer and forgive more, casts land where you aim, the engine’s running when you take the helm, and fuel is cheap. Just fishing.',
    set: { difficulty: 'relaxed', behaviour: 'relaxed', cast: 'assisted', technique: 'assisted', start: 'go', throttle: 'notches', economy: 'gentle' },
  },
  angler: {
    name: 'Angler',
    desc: 'The way Slow Tide is meant to be played: fish as they are, a little care to land them, one button to start the engine, and trim the leg yourself.',
    set: { difficulty: 'standard', behaviour: 'natural', cast: 'assisted', technique: 'assisted', start: 'simple', throttle: 'notches', economy: 'gentle' },
  },
  salt: {
    name: 'Old salt',
    desc: 'Everything as it really is: demanding fish, casts you time yourself, the rod in your own hands (Expert technique), the full start-up at the helm, a real throttle lever, and fuel at about real prices.',
    set: { difficulty: 'realistic', behaviour: 'demanding', cast: 'manual', technique: 'expert', start: 'full', throttle: 'lever', economy: 'authentic' },
  },
};
export const STYLE_IDS = Object.keys(STYLES);

// Which style the settings as they are amount to (null: your own mix). now: the same fields.
export function styleOf(now) {
  return STYLE_IDS.find((id) => Object.entries(STYLES[id].set).every(([k, v]) => now[k] === v)) || null;
}
