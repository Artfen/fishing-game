import { ACTIONS, ACTION_BY_ID, cleanBindings, defaultBindings } from './input.js';
import { GROUPS, LEVELS, CHOICES, PRESETS } from './quality.js';
import { DIFFICULTY, DIFFICULTY_IDS } from './fight.js';
import { SEA_PRESETS, SEA_IDS, compass } from './world/conditions.js';
import { buttonFor } from './gamepad.js';

// Preferences: sound, graphics, weather, controls and comfort. They live with the save
// (state.settings), survive "New game", and every value is checked when loading.

export const WEATHER_MODES = [
  { id: 'auto', name: 'Changing', note: 'The weather comes and goes by itself: clear spells, cloud, now and then a shower.' },
  { id: 'clear', name: 'Clear', note: 'Sunshine and blue sky. Fish keep a little deeper and shyer in bright light.' },
  { id: 'partly', name: 'Partly cloudy', note: 'Sun and cloud. A comfortable day for anything.' },
  { id: 'overcast', name: 'Overcast', note: 'Soft grey light. Predators like pike and bass roam more under cloud.' },
  { id: 'light', name: 'Light rain', note: 'A gentle shower dimples the water. Some sea fish rise in it, and flies hatch a little better.' },
  { id: 'heavy', name: 'Heavy rain', note: 'Steady rain and a darker sky. The fish don’t mind; insects stop hatching.' },
];
export const WEATHER_IDS = WEATHER_MODES.map((w) => w.id);
export const CAST_MODES = {
  assisted: { name: 'Assisted', note: 'Hold to choose the distance; let go whenever you like and the cast lands where the marker shows (the wind is allowed for).' },
  manual: { name: 'Manual', note: 'Hold to load the rod; let go before it overloads. A release in the sweet spot near the top flies furthest; hold too long and the cast collapses short. You allow for the wind yourself.' },
};

export const DEFAULT_SETTINGS = {
  audio: { master: 1, mute: false, music: 0.8, ambient: 1, wind: 0.8, waves: 0.9, rain: 0.8, effects: 1, alerts: 0.8 },
  graphics: { preset: 'auto', scale: 1, shadows: 'auto', water: 'auto', plants: 'auto', particles: 'auto', underwater: 'auto', life: 'auto', fps: 0 },
  // sea: 'auto' (with the weather) or a SEA_PRESETS id; wind 'auto' or 'manual' (windSpeed m/s,
  // windFrom compass degrees); currents: natural, gentle or still (on your rig and boat).
  weather: { mode: 'auto', rainFx: 1, sea: 'auto', windMode: 'auto', windSpeed: 4, windFrom: 225, currents: 'natural', panel: true },
  controls: { sensitivity: 1, invertX: false, invertY: false, reducedMotion: false, boatCam: 'swell', cast: 'assisted', hints: 'gentle', keys: null, rumble: true },
};

// The controller's buttons, as Settings lists them: [where, action, what it does]. The buttons
// themselves come from gamepad.js, so this list can't drift from what they really do.
export const PAD_HELP = [
  ['Walking, rowing and fishing', [
    ['play', 'forward', 'walk, row, steer'], ['play', 'look', 'look around (push up to sink the view under the water)'], ['play', 'jog', 'jog (press; stop to walk again)'],
    ['play', 'cast', 'hold to aim, let go to cast · hold to reel'], ['play', 'interact', 'whatever the prompt says'],
    ['play', 'cancel', 'cancel a cast · reel in · back'], ['play', 'pack', 'backpack'], ['play', 'rod1', 'the other rod'],
    ['play', 'tackle', 'next bait, lure or fly'], ['play', 'anchor', 'mooring: anchor down or up, tie up, cast off, let go a tow'], ['play', 'rest', 'let time drift (hold)'],
  ]],
  ['Views and panels', [
    ['play', 'view', 'next view'], ['play', 'reset', 'reset the camera'], ['play', 'photo', 'photo mode'],
    ['play', 'journal', 'journal'], ['play', 'finder', 'fish finder'], ['play', 'map', 'map'], ['play', 'settings', 'settings'],
  ]],
  ['At the helm', [
    ['helm', 'forward', 'throttle a notch up or down (push and let go), and steer'], ['helm', 'neutral', 'stop: the motor to neutral'],
    ['helm', 'motor', 'kayak: lower or raise the electric motor'],
    ['troll', 'throttleUp', 'with a line out: throttle up a notch'], ['troll', 'throttleDown', 'with a line out: throttle down a notch'],
  ]],
  ['A line in the water', [['fish', 'advice', 'why aren’t they biting?'], ['fish', 'feed', 'throw loose bait']]],
  ['A fish on', [['fight', 'cast', 'reel (let go when it surges)'], ['fight', 'ease', 'ease the drag off'], ['fight', 'forward', 'tighten or ease the drag']]],
  ['The catch card', [['catch', 'cast', 'let it go'], ['catch', 'keep', 'keep it'], ['catch', 'photo', 'photograph it']]],
  ['Driving', [['drive', 'throttle', 'go'], ['drive', 'brake', 'brake, then reverse'], ['drive', 'left', 'steer'], ['drive', 'interact', 'get out'], ['drive', 'tackle', 'where to?']]],
];

const num = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// legacy: an older save's top-level { quality, volumes } carry over into the new settings.
export function cleanSettings(raw, legacy = {}) {
  const d = DEFAULT_SETTINGS;
  const r = isObj(raw) ? raw : {};
  const a = isObj(r.audio) ? r.audio : {};
  const lv = isObj(legacy.volumes) ? legacy.volumes : {};
  const audio = {
    master: num(a.master, num(lv.master, d.audio.master, 0, 1), 0, 1),
    mute: !!a.mute,
    music: num(a.music, num(lv.music, d.audio.music, 0, 1), 0, 1),
    ambient: num(a.ambient, num(lv.nature, d.audio.ambient, 0, 1), 0, 1),
    wind: num(a.wind, d.audio.wind, 0, 1),
    waves: num(a.waves, d.audio.waves, 0, 1),
    rain: num(a.rain, d.audio.rain, 0, 1),
    effects: num(a.effects, num(lv.nature, d.audio.effects, 0, 1), 0, 1),
    alerts: num(a.alerts, d.audio.alerts, 0, 1),
  };
  const g = isObj(r.graphics) ? r.graphics : {};
  const graphics = {
    preset: oneOf(g.preset, CHOICES, oneOf(legacy.quality, CHOICES, 'auto')),
    scale: num(g.scale, 1, 0.5, 1),
    shadows: oneOf(g.shadows, ['auto', 'on', 'off'], 'auto'),
    fps: oneOf(g.fps, [0, 30, 60], 0),
  };
  for (const k of Object.keys(GROUPS)) graphics[k] = oneOf(g[k], ['auto', ...LEVELS], 'auto');
  const w = isObj(r.weather) ? r.weather : {};
  const weather = {
    mode: oneOf(w.mode, WEATHER_IDS, 'auto'), rainFx: num(w.rainFx, 1, 0, 1),
    sea: oneOf(w.sea, ['auto', ...SEA_IDS], 'auto'), windMode: oneOf(w.windMode, ['auto', 'manual'], 'auto'),
    windSpeed: num(w.windSpeed, 4, 0, 13), windFrom: num(w.windFrom, 225, 0, 360) % 360,
    currents: oneOf(w.currents, ['natural', 'gentle', 'still'], 'natural'), panel: w.panel !== false,
  };
  const c = isObj(r.controls) ? r.controls : {};
  const controls = {
    sensitivity: num(c.sensitivity, 1, 0.3, 2.5),
    invertX: !!c.invertX,
    invertY: !!c.invertY,
    reducedMotion: !!c.reducedMotion,
    boatCam: oneOf(c.boatCam, ['swell', 'steady'], 'swell'),
    cast: oneOf(c.cast, Object.keys(CAST_MODES), 'assisted'),
    hints: oneOf(c.hints, ['gentle', 'more', 'off'], 'gentle'),
    keys: c.keys ? cleanBindings(c.keys) : null,
    rumble: c.rumble !== false,
  };
  return { audio, graphics, weather, controls };
}

/* ---------------- the Settings panel ---------------- */

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const TABS = [['audio', 'Sound'], ['graphics', 'Graphics'], ['weather', 'Weather & sea'], ['controls', 'Controls & comfort']];
const LEVEL_NAMES = { auto: 'With the preset', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' };

// hooks: { changed(section, key, value), close(), playAlert(), qualityText(), difficulty(), setDifficulty(id), keyLabel(code) }
export class SettingsUI {
  constructor(state, hooks) {
    this.state = state;
    this.hooks = hooks;
    this.root = $('settings');
    this.body = $('settings-body');
    this.tab = 'audio';
    this.capturing = null;
    $('settings-close').addEventListener('click', () => hooks.close());
    this.root.addEventListener('click', (e) => { if (e.target === this.root) hooks.close(); });
    this.tabs = $('settings-tabs');
    for (const [id, name] of TABS) {
      const b = el('button', null, name);
      b.type = 'button';
      b.dataset.tab = id;
      b.addEventListener('click', () => {
        this.tab = id;
        this.render();
      });
      this.tabs.append(b);
    }
    // Rebinding: the next key pressed goes to the action, and nothing else hears it.
    addEventListener('keydown', (e) => {
      if (!this.capturing) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') this.capturing = null;
      else this.bind(this.capturing, e.code);
      this.render();
    }, true);
  }

  get isOpen() { return !this.root.hidden; }
  get S() { return this.state.settings; }

  open(tab) {
    if (tab) this.tab = tab;
    this.root.hidden = false;
    this.render();
    this.tabs.querySelector(`[data-tab="${this.tab}"]`)?.focus();
  }

  close() {
    this.capturing = null;
    this.root.hidden = true;
  }

  set(section, key, value) {
    this.S[section][key] = value;
    this.hooks.changed(section, key, value);
  }

  bind(action, code) {
    const def = ACTION_BY_ID[action];
    this.capturing = null;
    if (!def || def.fixed || code === 'Escape') return;
    const keys = JSON.parse(JSON.stringify(this.S.controls.keys || defaultBindings()));
    const old = keys[action][0];
    if (old === code) return;
    // A key can only do one thing: whoever had it gets this action's old key instead.
    for (const [id, list] of Object.entries(keys)) {
      if (id === action) continue;
      const i = list.indexOf(code);
      if (i < 0) continue;
      if (i === 0 && old && !list.includes(old)) list[0] = old;
      else list.splice(i, 1);
    }
    keys[action] = [code, ...keys[action].slice(1).filter((c) => c !== code)];
    this.set('controls', 'keys', cleanBindings(keys));
  }

  render() {
    for (const b of this.tabs.children) b.classList.toggle('on', b.dataset.tab === this.tab);
    const kids = [];
    if (this.tab === 'audio') kids.push(...this.audioPane());
    else if (this.tab === 'graphics') kids.push(...this.graphicsPane());
    else if (this.tab === 'weather') kids.push(...this.weatherPane());
    else kids.push(...this.controlsPane());
    this.body.replaceChildren(...kids);
  }

  /* ---------- controls ---------- */

  row(label, desc, control) {
    const r = el('div', 'st-row');
    const t = el('div', 'st-text');
    t.append(el('span', 'st-label', label));
    if (desc) t.append(el('span', 'st-desc', desc));
    r.append(t, control);
    return r;
  }

  slider(section, key, { min = 0, max = 1, step = 0.05, pct = true, onInput } = {}) {
    const wrap = el('div', 'st-slider');
    const i = el('input');
    Object.assign(i, { type: 'range', min, max, step, value: this.S[section][key] });
    const out = el('output', null, '');
    const show = () => { out.textContent = pct ? `${Math.round(Number(i.value) * 100)}%` : `${Number(i.value).toFixed(1)}×`; };
    show();
    i.addEventListener('input', () => {
      show();
      this.S[section][key] = Number(i.value);
      onInput ? onInput(Number(i.value)) : this.hooks.changed(section, key, Number(i.value), true);
    });
    i.addEventListener('change', () => this.hooks.changed(section, key, Number(i.value)));
    wrap.append(i, out);
    return wrap;
  }

  choice(options, current, pick) {
    const g = el('div', 'st-choice');
    g.setAttribute('role', 'radiogroup');
    for (const [value, name] of options) {
      const b = el('button', value === current ? 'on' : '', name);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(value === current));
      b.addEventListener('click', () => {
        pick(value);
        this.render();
      });
      g.append(b);
    }
    return g;
  }

  toggle(section, key, on = 'On', off = 'Off') {
    return this.choice([[true, on], [false, off]], !!this.S[section][key], (v) => this.set(section, key, v));
  }

  audioPane() {
    const A = this.S.audio;
    const out = [];
    out.push(this.row('Mute', 'Silences every sound in the game straight away, including anything that starts while muted.',
      this.choice([[true, 'Muted'], [false, 'Sound on']], A.mute, (v) => this.set('audio', 'mute', v))));
    const vol = (key, label, desc) => out.push(this.row(label, desc, this.slider('audio', key)));
    vol('master', 'Master volume', 'Everything together.');
    vol('music', 'Music', 'The slow tune that comes and goes.');
    vol('ambient', 'Surroundings', 'Birds, the stream, frogs, the campfire and the water lapping.');
    vol('wind', 'Wind', 'The wind in your ears: louder in gusts and out in the open.');
    vol('waves', 'Waves', 'The wash of the sea and surf on the shore, with the sea state.');
    vol('rain', 'Rain', 'The patter and hiss of rain.');
    vol('effects', 'Fishing and boat sounds', 'Oars, the motor, casts, splashes, the reel and the line.');
    const test = el('button', 'pk-btn quiet', 'Play the ring');
    test.type = 'button';
    test.addEventListener('click', () => this.hooks.playAlert());
    const alerts = el('div', 'st-stack');
    alerts.append(this.slider('audio', 'alerts'), test);
    out.push(this.row('Bite alerts', 'A short, gentle ring when a fish takes a float bait or runs off with a carp rig. It rings once, never on and on.', alerts));
    return out;
  }

  graphicsPane() {
    const G = this.S.graphics;
    const out = [];
    out.push(this.row('Preset', `${this.hooks.qualityText()}. Auto starts at High on computers and Medium on phones, and steps down by itself if the game runs slowly; it never picks Ultra or Cinematic for you. Ultra is the best that still plays smoothly on a computer with a good graphics card.`,
      this.choice(CHOICES.map((c) => [c, c === 'auto' ? 'Auto' : PRESETS[c].label]), G.preset, (v) => this.set('graphics', 'preset', v))));
    if (G.preset === 'cinematic') {
      out.push(el('p', 'st-note st-warn', 'Cinematic draws the richest picture the game has: sharper, clearer and further, with glowing light and shafts from a low sun. It is made for powerful computers and photographs, and can run at a lower frame rate, especially on laptops and phones. Ultra keeps most of the look and plays more smoothly.'));
    }
    const reset = el('button', 'pk-btn quiet', 'Restore recommended settings');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      Object.assign(G, { preset: 'auto', scale: 1, shadows: 'auto', fps: 0 });
      for (const id of Object.keys(GROUPS)) G[id] = 'auto';
      this.hooks.changed('graphics', 'preset', 'auto');
      this.render();
    });
    out.push(this.row('Recommended', 'Back to Auto, with every part below following it: the game picks what suits this device.', reset));
    out.push(this.row('Render resolution', 'Lower draws fewer pixels and runs faster, a little softer. 100% is sharpest.',
      this.slider('graphics', 'scale', { min: 0.5, max: 1, step: 0.05 })));
    out.push(this.row('Shadows', 'Soft shadows from the sun and the lantern. Off is quicker.',
      this.choice([['auto', 'With the preset'], ['on', 'On'], ['off', 'Off']], G.shadows, (v) => this.set('graphics', 'shadows', v))));
    for (const [id, grp] of Object.entries(GROUPS)) {
      out.push(this.row(grp.label, grp.desc, this.choice(['auto', ...LEVELS].map((l) => [l, LEVEL_NAMES[l]]), G[id], (v) => this.set('graphics', id, v))));
    }
    out.push(this.row('Frame-rate cap', 'Limit how often the screen is drawn: saves battery and keeps fans quiet.',
      this.choice([[0, 'None'], [60, '60 fps'], [30, '30 fps']], G.fps, (v) => this.set('graphics', 'fps', v))));
    const note = el('p', 'st-note', 'Lower settings only change what you see and how often distant fish move. Every fish is still there to be caught, the fish finder still reads them all, and fish near you behave the same.');
    out.push(note);
    return out;
  }

  weatherPane() {
    const W = this.S.weather;
    const out = [];
    const grid = el('div', 'st-weather');
    for (const w of WEATHER_MODES) {
      const b = el('button', `st-wcard${W.mode === w.id ? ' on' : ''}`);
      b.type = 'button';
      b.append(el('strong', null, w.name), el('small', null, w.note));
      b.addEventListener('click', () => {
        this.set('weather', 'mode', w.id);
        this.render();
      });
      grid.append(b);
    }
    out.push(el('p', 'st-note', 'Choose the weather you like: it changes smoothly, and stays as you leave it. Weather nudges what the fish do, but every choice is a good day out.'));
    out.push(grid);
    out.push(this.row('Rain effects', 'How much rain you see on screen and on the water. Turn it down if the drops get in the way; rain still counts for the fish. (Rain volume is under Sound.)',
      this.slider('weather', 'rainFx')));
    // The sea, the wind and the currents: gameplay, not graphics (every graphics setting plays
    // the same water).
    out.push(el('h3', 'st-sub', 'Sea, wind and currents'));
    out.push(this.row('Sea', W.sea === 'auto' ? 'Follows the weather: calmer in fine spells, livelier in rain and cloud.' : SEA_PRESETS[W.sea].note,
      this.choice([['auto', 'With the weather'], ...SEA_IDS.map((id) => [id, SEA_PRESETS[id].name])], W.sea, (v) => this.set('weather', 'sea', v))));
    out.push(this.row('Wind', W.windMode === 'auto' ? 'Shifts and freshens by itself, with the sea setting above.' : `Steady from the ${compass(W.windFrom * Math.PI / 180, true)}, ${Math.round(W.windSpeed * 3.6)} km/h, with its gusts.`,
      this.choice([['auto', 'Automatic'], ['manual', 'Set it yourself']], W.windMode, (v) => this.set('weather', 'windMode', v))));
    if (W.windMode === 'manual') {
      const dirs = el('div', 'st-choice st-compass');
      dirs.setAttribute('role', 'radiogroup');
      dirs.setAttribute('aria-label', 'Wind from');
      for (let d = 0; d < 360; d += 45) {
        const b = el('button', Math.round(W.windFrom) === d ? 'on' : '', compass(d * Math.PI / 180));
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(Math.round(W.windFrom) === d));
        b.setAttribute('aria-label', `from the ${compass(d * Math.PI / 180, true)}`);
        b.addEventListener('click', () => { this.set('weather', 'windFrom', d); this.render(); });
        dirs.append(b);
      }
      out.push(this.row('Wind from', 'Where it blows from, as in a forecast.', dirs));
      const sp = el('div', 'st-slider');
      const i = el('input');
      Object.assign(i, { type: 'range', min: 0, max: 13, step: 0.5, value: W.windSpeed });
      const o = el('output', null, `${Math.round(W.windSpeed * 3.6)} km/h`);
      i.addEventListener('input', () => { o.textContent = `${Math.round(Number(i.value) * 3.6)} km/h`; this.S.weather.windSpeed = Number(i.value); });
      i.addEventListener('change', () => this.set('weather', 'windSpeed', Number(i.value)));
      sp.append(i, o);
      out.push(this.row('Wind strength', 'From still air to a fresh breeze.', sp));
    }
    out.push(this.row('Currents', { natural: 'Currents carry your boat, float and rig as they run: strongest in the river, the estuary channel, off Gannet Isle and over Long Shoal.', gentle: 'Currents carry your boat and rig at half strength.', still: 'Your boat and rig stay where you put them (the fish still know where the water runs).' }[W.currents],
      this.choice([['natural', 'Natural'], ['gentle', 'Gentle'], ['still', 'Still']], W.currents, (v) => this.set('weather', 'currents', v))));
    out.push(this.row('Conditions panel', 'A small panel with the wind, the current and the sea where you are. (Its key is under Controls.)', this.toggle('weather', 'panel', 'Shown', 'Hidden')));
    out.push(el('p', 'st-note', 'Calm days are a full way to play: every fish can be found in calm water. Wind and waves change how you fish, not what you can catch.'));
    return out;
  }

  controlsPane() {
    const C = this.S.controls;
    const out = [];
    out.push(this.row('Casting', CAST_MODES[C.cast].note,
      this.choice(Object.entries(CAST_MODES).map(([k, v]) => [k, v.name]), C.cast, (v) => this.set('controls', 'cast', v))));
    const d = this.hooks.difficulty();
    out.push(this.row('Difficulty', `${DIFFICULTY[d].desc} Change it whenever you like: nothing is lost.`,
      this.choice(DIFFICULTY_IDS.map((id) => [id, DIFFICULTY[id].label]), d, (v) => this.hooks.setDifficulty(v))));
    out.push(this.row('Camera sensitivity', 'How far the view turns as you drag.', this.slider('controls', 'sensitivity', { min: 0.3, max: 2.5, step: 0.1, pct: false })));
    out.push(this.row('Invert left and right', 'Dragging moves the view the other way across.', this.toggle('controls', 'invertX')));
    out.push(this.row('Invert up and down', 'Dragging up looks down, like a flight stick.', this.toggle('controls', 'invertY')));
    out.push(this.row('Reduced camera motion', 'No camera shake, no boat roll in first person, and the view never turns by itself to follow a running fish.', this.toggle('controls', 'reducedMotion')));
    out.push(this.row('Boat camera', C.boatCam === 'steady' ? 'The view keeps a level horizon and only drifts gently up and down while the boat rides the waves beneath you.' : 'The view rises and rolls a little with the boat on the swell.',
      this.choice([['swell', 'Moves with the boat'], ['steady', 'Steady horizon']], C.boatCam, (v) => this.set('controls', 'boatCam', v))));
    out.push(this.row('Fishing hints', { gentle: 'When nothing has come for a while, one word from the field guide on what the fish make of your rig.', more: 'A word whenever a cast stays quiet, and again if it stays quiet.', off: 'No hints by themselves. You can still ask (the key for “Why aren’t they biting?”).' }[C.hints],
      this.choice([['gentle', 'Gentle'], ['more', 'More'], ['off', 'Off']], C.hints, (v) => this.set('controls', 'hints', v))));
    // Key bindings
    const keys = this.S.controls.keys || defaultBindings();
    const list = el('div', 'st-keys');
    let group = '';
    for (const a of ACTIONS) {
      if (a.group !== group) {
        group = a.group;
        list.append(el('h4', null, group));
      }
      const r = el('div', 'st-key');
      r.append(el('span', null, a.label));
      const codes = keys[a.id] || [];
      const k = el('span', 'st-keycaps');
      for (const c of codes) k.append(el('kbd', null, this.hooks.keyLabel(c)));
      r.append(k);
      if (!a.fixed) {
        const b = el('button', `pk-btn quiet${this.capturing === a.id ? ' waiting' : ''}`, this.capturing === a.id ? 'Press a key…' : 'Change');
        b.type = 'button';
        b.addEventListener('click', () => {
          this.capturing = this.capturing === a.id ? null : a.id;
          this.render();
        });
        r.append(b);
      } else r.append(el('span', 'st-fixed', 'fixed'));
      list.append(r);
    }
    const head = el('div', 'st-keyhead');
    head.append(el('h3', null, 'Keys'));
    const reset = el('button', 'pk-btn quiet', 'Reset keys');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      this.capturing = null;
      this.set('controls', 'keys', null);
      this.render();
    });
    head.append(reset);
    out.push(head);
    out.push(el('p', 'st-note', 'Choose Change, then press the key you want. If another action had that key, it takes this action’s old key. Esc stops waiting. Touch screens use the on-screen controls.'));
    // How the boats, the cabin and the camera work, whatever the controls.
    out.push(el('h3', null, 'Boats, the cabin and the camera'));
    for (const line of [
      'The throttle: the motor skiff, the bass boat and the cabin boat have a lever with notches (astern, neutral, dead slow, slow, half, full). Forward and back move it a notch at a time and it stays where you leave it; you can also click or drag the lever on screen (bottom right), or tap a notch. Neutral (or the big Stop under the lever) stops the motor, and the boat coasts on. The motor takes a moment to build up and ease off, and pauses in neutral between ahead and astern.',
      'Fishing under way: you can cast at up to trolling speed, and the boat carries the cast along as it flies. A moving boat tows your line behind it (trolling). With a line out the throttle goes no higher than slow ahead (+ and − move it, or the D-pad on a controller); when a fish takes, the motor goes to neutral.',
      'The kayak’s electric motor: lower it (or raise it again) with its key, L3, or the Motor button by the lever. Lowered, the lever drives it, quietly and slowly, hands free for the rod; raised, you paddle. Its battery charges at a jetty and overnight, and when it runs flat you simply paddle.',
      'The cabin boat: anchored or tied up, the prompt takes you into the cabin (from the helm, or straight from the quay). Inside, forward and back move between the doorway, the galley and the bunk; the prompt cooks or sleeps; cancel (Esc or B) takes you back on deck.',
      'Mooring: a second prompt (on the anchor key, X on a controller, or a tap) says what holding her still means where you are. Out on the water it drops the anchor: it goes down to the seabed, and she drifts back on her rope and lies head to the anchor, riding the waves; again, and you haul it in. Too shallow or too deep (deeper than its 30 m rope) and it says so. Beside a jetty or quay it ties her up alongside instead (lines and fenders); tied up, it casts off, pushing her clear if there’s room. Stepping ashore at a jetty makes her fast for you.',
      'Towing: alongside another boat, the prompt offers to step across or take her in tow. She follows on a line from your stern; the mooring prompt (or the same prompt beside her) lets her go. A small boat can’t tow a much bigger one.',
      'The camera turns all the way round you or your boat. Drag upwards (or push the right stick up) and the view sinks past the waterline to look beneath it, at the hull or the fish below; drag down again and you’re back in the air. The view key still steps through first person, a fixed underwater view and your bait.',
    ]) out.push(el('p', 'st-note', line));
    out.push(list);
    // A controller: what its buttons do (they can't be changed), and whether it buzzes.
    out.push(el('h3', null, 'Controller'));
    out.push(el('p', 'st-note', 'An Xbox controller (or any the browser recognises) works as soon as you press a button on it; the hints follow whichever you used last. In menus: the D-pad or left stick moves, A chooses, B goes back, LB and RB change tabs, the right stick scrolls.'));
    out.push(this.row('Controller vibration', 'A short buzz when something bites or runs, if your controller and browser can.', this.toggle('controls', 'rumble')));
    const pads = el('div', 'st-keys');
    for (const [group, rows] of PAD_HELP) {
      pads.append(el('h4', null, group));
      for (const [ctx, action, words] of rows) {
        const r = el('div', 'st-key st-pad');
        const k = el('span', 'st-keycaps');
        k.append(el('kbd', null, buttonFor(ctx, action)));
        r.append(el('span', null, words), k);
        pads.append(r);
      }
    }
    out.push(pads);
    return out;
  }
}
