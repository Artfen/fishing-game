// One question instead of several: how do you like to play? Each answer sets the fight's
// difficulty, how the fish behave, casting, starting the engine, the throttle, the sail's trim and
// the economy together (each can still be changed on its own in Settings, which then calls it
// your own mix).

export const STYLES = {
  easy: {
    name: 'Easy-going',
    desc: 'Forgiving fish, casts land where you aim, the engine starts itself, the sail trims itself, cheap fuel. Just fishing.',
    set: { difficulty: 'relaxed', behaviour: 'relaxed', cast: 'assisted', technique: 'assisted', start: 'go', throttle: 'notches', sailTrim: 'helped', economy: 'gentle' },
  },
  angler: {
    name: 'Angler',
    desc: 'Slow Tide as it’s meant to be: fish as they are, one button to start, trim the leg yourself.',
    set: { difficulty: 'standard', behaviour: 'natural', cast: 'assisted', technique: 'assisted', start: 'simple', throttle: 'notches', sailTrim: 'hand', economy: 'gentle' },
  },
  salt: {
    name: 'Old salt',
    desc: 'Everything real: demanding fish, timed casts, the rod in your hands, the full start-up, a throttle lever, real fuel prices.',
    set: { difficulty: 'realistic', behaviour: 'demanding', cast: 'manual', technique: 'expert', start: 'full', throttle: 'lever', sailTrim: 'hand', economy: 'authentic' },
  },
};
export const STYLE_IDS = Object.keys(STYLES);

// Which style the settings as they are amount to (null: your own mix). now: the same fields.
export function styleOf(now) {
  return STYLE_IDS.find((id) => Object.entries(STYLES[id].set).every(([k, v]) => now[k] === v)) || null;
}
