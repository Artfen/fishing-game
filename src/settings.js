import { ACTIONS, ACTION_BY_ID, cleanBindings, defaultBindings } from './input.js';
import { LOOK_OPTIONS, LOOK_WORDS, DEFAULT_LOOK, cleanLook } from './looks.js';
import { GROUPS, LEVELS, CHOICES, PRESETS } from './quality.js';
import { DIFFICULTY, DIFFICULTY_IDS } from './fight.js';
import { BEHAVIOUR, BEHAVIOUR_IDS } from './behaviour.js';
import { SEA_PRESETS, SEA_IDS, compass } from './world/conditions.js';
import { buttonFor, padName, PAD_STYLES, learnWords, LEARN, cleanLayout } from './gamepad.js';
import { NEEDS_MODES, NEEDS_IDS } from './comfort.js';
import { STRENGTH_IDS } from './haptics.js';
import { START_MODES, START_IDS } from './engine.js';
import { ECONOMY, ECONOMY_IDS } from './economy.js';
import { STYLES, STYLE_IDS } from './playstyle.js';
import { TECHNIQUES, TECHNIQUE_IDS } from './technique.js';
import { cleanName, cleanCode, validCode, poseWords, NAME_MAX, MAX_PLAYERS } from './together.js';
import { $t, LANGS, langNow } from './i18n.js';

// Preferences: sound, graphics, weather, controls and comfort, and the name you go by when
// playing together. They live with the save (state.settings), survive "New game", and every
// value is checked when loading.

export const WEATHER_MODES = [
  { id: 'auto', name: $t('Changing'), note: $t('The weather comes and goes by itself: clear spells, cloud, now and then a shower.') },
  { id: 'clear', name: $t('Clear'), note: $t('Sunshine and blue sky. Fish keep a little deeper and shyer in bright light.') },
  { id: 'partly', name: $t('Partly cloudy'), note: $t('Sun and cloud. A comfortable day for anything.') },
  { id: 'overcast', name: $t('Overcast'), note: $t('Soft grey light. Predators like pike and bass roam more under cloud.') },
  { id: 'light', name: $t('Light rain'), note: $t('A gentle shower dimples the water. Some sea fish rise in it, and flies hatch a little better.') },
  { id: 'heavy', name: $t('Heavy rain'), note: $t('Steady rain and a darker sky. The fish don’t mind; insects stop hatching.') },
  { id: 'storm', name: $t('Storm'), note: $t('A gale off the Atlantic: big seas breaking white outside, sheets of rain, thunder and lightning. The bay and the coves stay calmer: a refuge.') },
];
export const WEATHER_IDS = WEATHER_MODES.map((w) => w.id);
export const CAST_MODES = {
  assisted: { name: $t('Assisted'), note: $t('Hold to choose the distance; let go whenever you like and the cast lands where the marker shows (the wind is allowed for).') },
  manual: { name: $t('Manual'), note: $t('Hold to load the rod; let go before it overloads. A release in the sweet spot near the top flies furthest; hold too long and the cast collapses short. You allow for the wind yourself.') },
};

export const DEFAULT_SETTINGS = {
  audio: { master: 1, mute: false, music: 0.8, ambient: 1, wind: 0.8, waves: 0.9, rain: 0.8, effects: 1, reel: 0.9, alerts: 0.8, light: false },
  graphics: { preset: 'auto', scale: 1, shadows: 'auto', ocean: 'auto', water: 'auto', plants: 'auto', particles: 'auto', underwater: 'auto', life: 'auto', fps: 0, screen: 'full' },
  // sea: 'auto' (with the weather) or a SEA_PRESETS id; wind 'auto' or 'manual' (windSpeed m/s,
  // windFrom compass degrees); currents: natural, gentle or still (on your rig and boat).
  // windLines: the white wind lines in the air (when sailing, always, or never).
  weather: { mode: 'auto', rainFx: 1, sea: 'auto', windMode: 'auto', windSpeed: 4, windFrom: 225, currents: 'natural', panel: true, windLines: 'sailing' },
  // sailTrim: the sailing boat's mainsheet by hand, or helped (it trims itself when left alone).
  // needs: how much the angler feels the weather and the day (see comfort.js): off, shown, gentle.
  // map: the whole chart from the start ('all'), or blank paper until you've been there ('explore').
  controls: { sensitivity: 1, invertX: false, invertY: false, reducedMotion: false, boatCam: 'swell', cast: 'assisted', hints: 'gentle', keys: null, vibration: 'normal', padNames: 'auto', padLayouts: {}, throttle: 'notches', start: 'go', technique: 'assisted', sailTrim: 'hand', needs: 'gentle', map: 'all' },
  // name: what friends see over you when playing together ('' until you've chosen one).
  // share: whether what you find (places, dive sites, a wreck's details, first fish) goes to them.
  // paid: whether friends in the session are paid the same as you for the fish you sell.
  player: { name: '', share: true, paid: true },
};

// The controller's buttons, as Settings lists them: [where, action, what it does]. The buttons
// themselves come from gamepad.js, so this list can't drift from what they really do.
export const PAD_HELP = [
  [$t('Walking, rowing and fishing'), [
    ['play', 'forward', $t('walk, row, steer')], ['play', 'look', $t('look around (push up to sink the view under the water)')], ['play', 'jog', $t('jog (press; stop to walk again)')],
    ['play', 'cast', $t('hold to aim, let go to cast · hold to reel')], ['play', 'interact', $t('whatever the prompt says')],
    ['play', 'cancel', $t('cancel a cast · reel in · back')], ['play', 'pack', 'backpack'], ['play', 'rod1', $t('the other rod')],
    ['play', 'tackle', $t('next bait, lure or fly')], ['play', 'anchor', $t('mooring: anchor down or up, tie up, cast off, let go a tow')], ['play', 'rest', $t('let time drift (hold)')],
  ]],
  [$t('Views and panels'), [
    ['play', 'view', $t('next view')], ['play', 'reset', $t('reset the camera')], ['play', 'photo', $t('photo mode')],
    ['play', 'journal', 'journal'], ['play', 'finder', $t('fish finder')], ['play', 'map', 'map'], ['play', 'settings', 'settings'],
  ]],
  [$t('At the helm'), [
    ['helm', 'forward', $t('throttle up or down (a notch, or the smooth lever), and steer')], ['helm', 'neutral', $t('stop: the motor to neutral')],
    ['helm', 'motor', $t('the engine: start or stop (or the helm panel) · kayak: the electric motor · sailing boat: the sail')],
    ['helmtrim', 'trimUp', $t('trim the outboard out (hold; at rest it tilts right up)')], ['helmtrim', 'trimDown', $t('trim the outboard in (hold)')],
    ['helmtwin', 'levers', $t('twin engines: both levers, the port one, or the starboard one')],
    ['troll', 'throttleUp', $t('with a line out: throttle up a notch')], ['troll', 'throttleDown', $t('with a line out: throttle down a notch')],
  ]],
  [$t('A line in the water'), [['fish', 'advice', $t('why aren’t they biting?')], ['fish', 'feed', $t('throw loose bait')], ['fish', 'walkline', $t('walk with the line out (along the bank, or about the deck), or stand to fish again')]]],
  [$t('A fish on'), [['fight', 'cast', $t('reel (let go when it surges)')], ['fight', 'ease', $t('ease the drag off')], ['fight', 'forward', $t('tighten or ease the drag')]]],
  [$t('The catch card'), [['catch', 'cast', $t('let it go')], ['catch', 'keep', $t('keep it')], ['catch', 'photo', $t('photograph it')]]],
  [$t('Driving'), [['drive', 'throttle', 'go'], ['drive', 'brake', $t('brake, then reverse')], ['drive', 'left', 'steer'], ['drive', 'interact', $t('get out')], ['drive', 'tackle', $t('where to?')]]],
];

// (The learned layouts kept: each checked, its name a sensible length, the last eight.)
function cleanLayouts(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [id, L] of Object.entries(v).slice(-8)) {
    const c = cleanLayout(L);
    if (c && id && id.length <= 200) out[id] = c;
  }
  return out;
}

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
    reel: num(a.reel, d.audio.reel, 0, 1),
    alerts: num(a.alerts, d.audio.alerts, 0, 1),
    light: a.light === true,
  };
  const g = isObj(r.graphics) ? r.graphics : {};
  const graphics = {
    preset: oneOf(g.preset, CHOICES, oneOf(legacy.quality, CHOICES, 'auto')),
    scale: num(g.scale, 1, 0.5, 1),
    shadows: oneOf(g.shadows, ['auto', 'on', 'off'], 'auto'),
    ocean: oneOf(g.ocean, ['auto', 'full', 'simple'], 'auto'),
    fps: oneOf(g.fps, [0, 30, 60], 0),
    screen: oneOf(g.screen, ['full', 'clean'], 'full'),
  };
  for (const k of Object.keys(GROUPS)) graphics[k] = oneOf(g[k], ['auto', ...LEVELS], 'auto');
  const w = isObj(r.weather) ? r.weather : {};
  const weather = {
    mode: oneOf(w.mode, WEATHER_IDS, 'auto'), rainFx: num(w.rainFx, 1, 0, 1),
    sea: oneOf(w.sea, ['auto', ...SEA_IDS], 'auto'), windMode: oneOf(w.windMode, ['auto', 'manual'], 'auto'),
    windSpeed: num(w.windSpeed, 4, 0, 13), windFrom: num(w.windFrom, 225, 0, 360) % 360,
    currents: oneOf(w.currents, ['natural', 'gentle', 'still'], 'natural'), panel: w.panel !== false,
    windLines: oneOf(w.windLines, ['sailing', 'always', 'off'], 'sailing'),
  };
  const c = isObj(r.controls) ? r.controls : {};
  const controls = {
    sensitivity: num(c.sensitivity, 1, 0.3, 2.5),
    invertX: !!c.invertX,
    invertY: !!c.invertY,
    // (New settings follow the system's own "reduce motion"; a choice made here stands.)
    reducedMotion: c.reducedMotion == null ? typeof matchMedia === 'function' && !!matchMedia($t('(prefers-reduced-motion: reduce)')).matches : !!c.reducedMotion,
    boatCam: oneOf(c.boatCam, ['swell', 'steady'], 'swell'),
    sailTrim: oneOf(c.sailTrim, ['hand', 'helped'], 'hand'),
    needs: oneOf(c.needs, NEEDS_IDS, 'gentle'),
    map: oneOf(c.map, ['all', 'explore'], 'all'),
    cast: oneOf(c.cast, Object.keys(CAST_MODES), 'assisted'),
    hints: oneOf(c.hints, ['gentle', 'more', 'off'], 'gentle'),
    keys: c.keys ? cleanBindings(c.keys) : null,
    throttle: oneOf(c.throttle, ['notches', 'lever'], 'notches'),
    start: oneOf(c.start, START_IDS, 'go'),
    helm: oneOf(c.helm, ['dash', 'panel'], 'dash'),
    technique: oneOf(c.technique, TECHNIQUE_IDS, 'assisted'),
    // (Vibration was once only on or off.)
    vibration: oneOf(c.vibration, STRENGTH_IDS, c.rumble === false ? 'off' : 'normal'),
    // (The controller's buttons: the names shown, and those learned for a controller the browser
    // doesn't know, by its name. A few at most.)
    padNames: oneOf(c.padNames, PAD_STYLES, 'auto'),
    padLayouts: cleanLayouts(c.padLayouts),
  };
  const p = isObj(r.player) ? r.player : {};
  const player = { name: cleanName(p.name), share: p.share !== false, paid: p.paid !== false };
  return { audio, graphics, weather, controls, player };
}

/* ---------------- the Settings panel ---------------- */

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const TABS = [['audio', $t('Sound')], ['graphics', $t('Graphics')], ['weather', $t('Weather & sea')], ['controls', $t('Controls & comfort')], ['you', $t('You')], ['together', $t('Play together')]];
const LEVEL_NAMES = { auto: $t('With the preset'), low: $t('Low'), medium: $t('Medium'), high: $t('High'), ultra: $t('Ultra') };

// hooks: { changed(section, key, value), close(), playAlert(), restartSound() → status, soundStatus(), qualityText(), difficulty(), setDifficulty(id),
//   behaviour(), setBehaviour(id), keyLabel(code), together() (the Together session), setName(name),
//   netDiagnostics() (lines about the session's traffic and the shared sea, or null),
//   boatName(kind), following() (the host's name while their world is followed, or null) }
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
    // (A box being typed in keeps its focus when the pane is drawn again, e.g. as a friend joins.)
    const typing = this.body.contains(document.activeElement) && document.activeElement.id ? document.activeElement.id : null;
    const kids = [];
    if (this.tab === 'audio') kids.push(...this.audioPane());
    else if (this.tab === 'graphics') kids.push(...this.graphicsPane());
    else if (this.tab === 'weather') kids.push(...this.weatherPane());
    else if (this.tab === 'together') kids.push(...this.togetherPane());
    else if (this.tab === 'you') kids.push(...this.youPane());
    else kids.push(...this.controlsPane());
    this.body.replaceChildren(...kids);
    if (typing) {
      const e = $(typing);
      e?.focus();
      if (e?.setSelectionRange && typeof e.value === 'string') e.setSelectionRange(e.value.length, e.value.length);
    }
  }

  /* ---------- you ---------- */

  // How you look (see looks.js): your skin, clothes, hat, hair, a beard, glasses. Worn on foot and
  // in every boat, and what friends see of you. (What you wear still keeps you warm and dry as it
  // always did: the colours are yours to choose.)
  youPane() {
    const L = cleanLook(this.hooks.look?.()), out = [];
    // The language the game's words are in (src/i18n.js): changing it saves and starts again.
    out.push(this.row($t('Language'), $t('The game’s words: English, Spanish or French. Changing it saves your game and starts it again in that language.'),
      this.choice(LANGS, langNow(), (v) => this.hooks.setLanguage?.(v))));
    const put = (k, v) => {
      this.hooks.setLook?.({ ...L, [k]: v });
      this.render();
    };
    const swatches = (k, label) => {
      const wrap = el('div', 'st-swatches');
      LOOK_OPTIONS[k].forEach((hex, i) => {
        const b = el('button', `pk-btn hb-swatch${L[k] === hex ? '' : ' quiet'}`, '');
        b.type = 'button';
        b.style.setProperty('--sw', hex);
        b.setAttribute('aria-label', $t`${label}: ${i + 1} of ${LOOK_OPTIONS[k].length}`);
        b.setAttribute('aria-pressed', String(L[k] === hex));
        b.addEventListener('click', () => put(k, hex));
        wrap.append(b);
      });
      return wrap;
    };
    const words = (k) => this.choice(LOOK_OPTIONS[k].map((v) => [v, LOOK_WORDS[k][v]]), L[k], (v) => put(k, v));
    out.push(el('p', 'st-note', $t('How you look, on foot and at the helm, and to friends playing with you. Your clothes keep you warm and dry whatever their colour (the woolly hat still comes out when it’s cold).')));
    out.push(this.row($t('Skin'), null, swatches('skin', $t('Skin'))));
    out.push(this.row($t('Raincoat'), $t('When it’s on.'), swatches('coat', $t('Raincoat'))));
    out.push(this.row($t('Jumper'), $t('With the coat off on a cool day.'), swatches('jumper', $t('Jumper'))));
    out.push(this.row($t('Shirt'), $t('On a warm one.'), swatches('shirt', $t('Shirt'))));
    out.push(this.row($t('Trousers'), null, swatches('legs', $t('Trousers'))));
    out.push(this.row($t('Boots'), null, swatches('boots', $t('Boots'))));
    out.push(this.row($t('Hat'), null, words('hat')));
    if (L.hat !== 'hair' && L.hat !== 'bun') out.push(this.row($t('Hat colour'), null, swatches('hatColor', $t('Hat colour'))));
    out.push(this.row($t('Hair'), $t('Shows with no hat on, and in a beard.'), swatches('hair', $t('Hair'))));
    out.push(this.row($t('Beard'), null, words('beard')));
    out.push(this.row($t('Glasses'), null, words('glasses')));
    const reset = el('button', 'pk-btn quiet', $t('As you were: the yellow raincoat and the teal sun hat'));
    reset.type = 'button';
    reset.addEventListener('click', () => {
      this.hooks.setLook?.({ ...DEFAULT_LOOK });
      this.render();
    });
    out.push(reset);
    return out;
  }

  /* ---------- playing together ---------- */

  // A text box and a button, as a form (Enter submits); the box's draft survives redraws.
  field(id, { value, placeholder, max, mode = 'text', button, label, run, draft }) {
    const f = el('form', 'st-field');
    const i = el('input');
    Object.assign(i, { id, type: 'text', value, placeholder, maxLength: max, autocomplete: 'off', spellcheck: false });
    if (mode === 'numeric') Object.assign(i, { inputMode: 'numeric', pattern: '[0-9]*' });
    i.setAttribute('aria-label', label);
    i.addEventListener('input', () => draft(i.value));
    const b = el('button', 'pk-btn', button);
    b.type = 'submit';
    f.append(i, b);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      run(i.value);
    });
    return f;
  }

  togetherPane() {
    const T = this.hooks.together(), out = [];
    this.drafts ||= { name: null, code: '' };
    const name = this.S.player.name;
    out.push(el('p', 'st-note', $t`Play alongside friends: each of you in your own game, in the same waters. You see each other (on foot, or in whichever boat you’re in, with your name over you) and hear about each other’s catches. Up to ${MAX_PLAYERS} can play together. While you do, everyone shares the host’s time of day, weather and tide; your fish, gear and progress stay your own.`));
    out.push(this.row($t('Your name'), $t('What friends see over you, and in their news of your catches.'), this.field('tg-name', {
      value: this.drafts.name ?? name, placeholder: $t('Your name'), max: NAME_MAX, button: $t('Save'), label: $t('Your name'),
      draft: (v) => { this.drafts.name = v; },
      run: (v) => {
        const n = cleanName(v);
        if (!n) return;
        this.drafts.name = null;
        this.hooks.setName(n);
        this.render();
      },
    })));
    out.push(this.row($t('Share what you find'), $t('Places and dive sites you find, what you find on a wreck, and how you caught a new kind of fish go to your friends’ maps as marks with your name on them. You can also send any of your own marks from the map.'), this.toggle('player', 'share', 'Share', 'Keep to myself')));
    out.push(this.row($t('Fish you sell'), $t('Sell fish at the market, at Kaigan or to a kitchen while you’re playing together, and everyone in the session is paid the same as you, so you all earn from a good day out. Theirs pay you too, whichever way they’ve chosen this.'), this.toggle('player', 'paid', 'Everyone’s paid', 'Keep it to myself')));
    // A friend code (see giftcodes.js): for friends and testers.
    out.push(this.row($t('Friend code'), $t('Got a code from a friend? Codes give boats at Willowhaven Marine Works, money for your purse, or both (most work once for each game; the money code as often as you like).'), this.field('tg-gift', {
      value: this.drafts.gift ?? '', placeholder: 'FRIEND-CODE', max: 40, button: $t('Redeem'), label: $t('Friend code'),
      draft: (v) => { this.drafts.gift = v; },
      run: async (v) => {
        const r = await this.hooks.redeem(v);
        this.giftNote = r.ok ? (r.gift.boats ? $t`Welcome aboard! Every boat at the Marine Works is yours${r.gift.money ? $t`, and £${r.gift.money.toLocaleString('en-GB')} is in your purse` : ''}.` : $t`£${r.gift.money.toLocaleString('en-GB')} is in your purse.`) : r.why;
        if (r.ok) this.drafts.gift = '';
        this.render();
      },
    })));
    if (this.giftNote) out.push(el('p', 'st-note', this.giftNote));
    const why = T.why();
    if (why && !T.active) {
      out.push(el('p', 'st-note st-warn', why));
      if (T.message && T.message !== why) out.push(el('p', 'st-note', T.message));
      return out;
    }
    if (T.status === 'connecting') {
      out.push(el('p', 'st-tg-status', T.message || $t('Connecting…')));
      const stop = el('button', 'pk-btn quiet', $t('Cancel'));
      stop.type = 'button';
      stop.addEventListener('click', () => { T.leave(true); T.changed(''); });
      out.push(stop);
      return out;
    }
    if (T.active) {
      this.drafts.code = '';
      const box = el('div', 'st-tg-session');
      if (T.hosting) {
        box.append(el('span', 'st-label', $t('Your session code')));
        const code = el('div', 'st-tg-code', T.code);
        code.setAttribute('aria-label', $t`Session code ${T.code.split('').join(' ')}`);
        box.append(code, el('p', 'st-note', $t('Your friend opens Settings → Play together and types this code under “Join a session”. It works while you’re in the game; anyone with the code can join.')));
      } else {
        box.append(el('span', 'st-label', $t`Session ${T.code}`));
      }
      if (T.reconnecting) box.append(el('p', 'st-note st-warn', T.message));
      const list = el('ul', 'st-tg-list');
      const me = el('li', 'me');
      me.append(el('strong', null, name || $t('You')), el('span', null, $t` (you${T.hosting ? $t(', host') : ''})`));
      list.append(me);
      const others = T.others;
      for (const p of others) {
        const li = el('li');
        li.append(el('strong', null, p.name), el('span', null, `${p.host ? ' (host)' : ''} · ${poseWords(p.pose, this.hooks.boatName, this.hooks.gearName)}`));
        list.append(li);
      }
      box.append(list);
      if (!others.length) box.append(el('p', 'st-note', T.hosting ? $t('Waiting for someone to join…') : $t('Everyone else has left.')));
      else box.append(el('p', 'st-note', $t`Quick calls: the Call button at the top, or ${this.hooks.keyLabel(this.S.controls.keys?.call?.[0] || 'Digit4')}. Friends are on the map too.`));
      // What the session has cost in messages (Supabase counts them against its monthly allowance).
      const U = T.stats;
      if (U) {
        const mins = Math.max(1, Math.round((Date.now() - U.since) / 60000));
        const kb = Math.round((U.bytesOut + U.bytesIn) / 1024);
        const again = U.reconnects ? $t`, and the connection was got back ${U.reconnects === 1 ? $t('once') : $t`${U.reconnects} times`}` : '';
        box.append(el('p', 'st-note st-tg-usage', (mins === 1 ? $t`This session so far: ${U.out.toLocaleString()} messages sent and ${U.in.toLocaleString()} received (about ${kb.toLocaleString()} KB) in ${mins} minute${again}. Supabase counts messages against its monthly Realtime allowance.` : $t`This session so far: ${U.out.toLocaleString()} messages sent and ${U.in.toLocaleString()} received (about ${kb.toLocaleString()} KB) in ${mins} minutes${again}. Supabase counts messages against its monthly Realtime allowance.`)));
        // The shared sea and the rest, by kind: for anyone checking how the session is doing.
        const D = this.hooks.netDiagnostics?.();
        if (D) {
          const det = el('details', 'st-tg-diag');
          det.append(el('summary', null, $t('Network details')));
          for (const line of D) det.append(el('p', 'st-note', line));
          box.append(det);
        }
      }
      const leave = el('button', 'pk-btn quiet', T.hosting ? $t('End the session') : $t('Leave the session'));
      leave.type = 'button';
      leave.addEventListener('click', () => {
        T.leave();
        this.render();
      });
      box.append(leave);
      out.push(box);
      return out;
    }
    if (!name) {
      out.push(el('p', 'st-note st-warn', $t('Choose a name first: it’s what your friends will see.')));
      return out;
    }
    const start = el('button', 'pk-btn', $t('Start a session'));
    start.type = 'button';
    start.addEventListener('click', () => T.host());
    out.push(this.row($t('Start a session'), $t('You get a four-digit code to give a friend.'), start));
    out.push(this.row($t('Join a session'), $t('Type the code your friend got when they started theirs.'), this.field('tg-code', {
      value: this.drafts.code, placeholder: '1234', max: 4, mode: 'numeric', button: $t('Join'), label: $t('Session code'),
      draft: (v) => { this.drafts.code = cleanCode(v); },
      run: (v) => {
        const code = cleanCode(v);
        if (!validCode(code)) {
          T.changed($t('A session code is four digits, like 4821.'));
          return;
        }
        T.join(code);
      },
    })));
    if (T.message) out.push(el('p', 'st-note', T.message));
    return out;
  }

  /* ---------- controls ---------- */

  // Setting up a controller's buttons (see gamepad.js, learn), for one the browser doesn't know:
  // each button asked for in turn, pressed on it; the mouse or keyboard skips one or stops.
  padSetup() {
    const P = this.hooks.pad?.();
    const btn = (text, run, cls = 'pk-btn') => {
      const b = el('button', cls, text);
      b.type = 'button';
      b.addEventListener('click', run);
      return b;
    };
    if (!P) return [this.row($t('Set up the buttons'), $t('For a controller whose buttons come out mixed up: press a button on it first, then come back here.'), el('span', 'st-fixed', $t('no controller')))];
    if (P.step != null) {
      const box = el('div', 'st-padlearn');
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      const words = el('div', 'st-text');
      words.append(el('span', 'st-label', learnWords(P.step)), el('span', 'st-desc', $t`${P.step + 1} of ${LEARN.length} · on the controller, then let go`));
      const g = el('div', 'st-choice');
      g.append(btn($t('Skip'), () => this.hooks.padSkip?.(), 'pk-btn quiet'), btn($t('Stop'), () => this.hooks.padStop?.(), 'pk-btn quiet'));
      box.append(words, g);
      return [box];
    }
    const name = String(P.name || $t('this controller')).replace(/\s*\(.*\)\s*$/, '').slice(0, 60);
    const desc = P.learned ? $t`Set up for this one (${name}). Set it up again, or go back to the layout the browser reports.`
      : P.standard ? $t`The browser knows this one’s layout (${name}). If its buttons still come out mixed up, press each as it’s asked for and the game learns which is which.`
        : $t`The browser doesn’t know this one’s layout (${name}), so its buttons may be mixed up: press each as it’s asked for (half a minute) and the game learns which is which.`;
    const g = el('div', 'st-choice');
    g.append(btn(P.learned ? $t('Set up again') : $t('Set up…'), () => this.hooks.padLearn?.()));
    if (P.learned) g.append(btn($t('As reported'), () => this.hooks.padForget?.(), 'pk-btn quiet'));
    return [this.row($t('Set up the buttons'), desc, g)];
  }

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

  toggle(section, key, on = $t('On'), off = $t('Off')) {
    return this.choice([[true, on], [false, off]], !!this.S[section][key], (v) => this.set(section, key, v));
  }

  audioPane() {
    const A = this.S.audio;
    const out = [];
    out.push(this.row($t('Mute'), $t('Silences every sound in the game straight away, including anything that starts while muted.'),
      this.choice([[true, $t('Muted')], [false, $t('Sound on')]], A.mute, (v) => this.set('audio', 'mute', v))));
    const vol = (key, label, desc) => out.push(this.row(label, desc, this.slider('audio', key)));
    vol('master', $t('Master volume'), $t('Everything together.'));
    vol('music', $t('Music'), $t('The slow tune that comes and goes.'));
    vol('ambient', $t('Surroundings'), $t('Birds, the stream, frogs, the campfire and the water lapping.'));
    vol('wind', $t('Wind'), $t('The wind in your ears: louder in gusts and out in the open.'));
    vol('waves', $t('Waves'), $t('The wash of the sea and surf on the shore, with the sea state.'));
    vol('rain', $t('Rain'), $t('The patter and hiss of rain.'));
    vol('effects', $t('Fishing and boat sounds'), $t('Oars, the motor, casts and splashes.'));
    vol('reel', $t('Reel and line'), $t('The drag clicking as a fish takes line (faster the faster it runs), the reel whirring as you wind, and the line singing as it nears breaking. Turn it down for a quieter fight.'));
    const test = el('button', 'pk-btn quiet', $t('Play the ring'));
    test.type = 'button';
    test.addEventListener('click', () => this.hooks.playAlert());
    const alerts = el('div', 'st-stack');
    alerts.append(this.slider('audio', 'alerts'), test);
    out.push(this.row($t('Bite alerts'), $t('A short, gentle ring when a fish takes a float bait or runs off with a carp rig. It rings once, never on and on.'), alerts));
    // If the sound cuts out or comes and goes: connect it to the speakers afresh.
    const fix = el('div', 'st-stack');
    const note = el('p', 'st-note', this.soundWords(this.hooks.soundStatus?.()));
    const again = el('button', 'pk-btn quiet', $t('Restart sound'));
    again.type = 'button';
    again.addEventListener('click', async () => {
      note.textContent = $t('Reconnecting…');
      note.textContent = this.soundWords(await this.hooks.restartSound?.());
    });
    fix.append(again, note);
    out.push(this.row($t('Sound quality'), $t('Light swaps the long, rich echo for a simple one: a fraction of the work for the computer. Choose it if the sound crackles, hisses or breaks up (it happens on some computers while the game is busy drawing); few people can hear the difference.'),
      this.choice([[false, $t('Full')], [true, $t('Light')]], !!A.light, (v) => this.set('audio', 'light', v))));
    out.push(this.row($t('Sound cutting out?'), $t('If the sound drops out, comes and goes or stutters (often headphones, Bluetooth or a voice call taking the speakers), this connects it to your speakers again. The game also does it by itself when your speakers or headphones change.'), fix));
    return out;
  }

  // The sound as it is, in words.
  soundWords(st) {
    if (!st || st.state === 'off') return $t('The sound starts with your first click or key press.');
    if (st.state === 'running') return $t`Sound on${st.ms ? $t`, running about ${st.ms} ms behind (a roomy buffer, so it doesn’t break up)` : ''}.`;
    return $t('The sound is paused: click anywhere in the game, or press a key, to start it.');
  }

  graphicsPane() {
    const G = this.S.graphics;
    const out = [];
    out.push(this.row($t('Screen'), G.screen === 'clean'
      ? $t('Clean: the buttons along the top show just their icons (and keys), the weather panel comes up while you’re fishing or sailing, and the rod pill tucks away while you’re under way. More sea, less screen.')
      : $t('Full: every button labelled, the weather panel and your rod always on screen.'),
    this.choice([['full', $t('Full')], ['clean', $t('Clean')]], G.screen, (v) => this.set('graphics', 'screen', v))));
    out.push(this.row($t('Preset'), $t`${this.hooks.qualityText()}. Auto starts at High on computers and Medium on phones, and steps down by itself if the game runs slowly; it never picks Ultra or Cinematic for you. Ultra is the best that still plays smoothly on a computer with a good graphics card.`,
      this.choice(CHOICES.map((c) => [c, c === 'auto' ? $t('Auto') : PRESETS[c].label]), G.preset, (v) => this.set('graphics', 'preset', v))));
    if (G.preset === 'cinematic') {
      out.push(el('p', 'st-note st-warn', $t('Cinematic draws the richest picture the game has: sharper, clearer and further, with glowing light and shafts from a low sun. It is made for powerful computers and photographs, and can run at a lower frame rate, especially on laptops and phones. Ultra keeps most of the look and plays more smoothly.')));
    }
    const reset = el('button', 'pk-btn quiet', $t('Restore recommended settings'));
    reset.type = 'button';
    reset.addEventListener('click', () => {
      Object.assign(G, { preset: 'auto', scale: 1, shadows: 'auto', ocean: 'auto', fps: 0 });
      for (const id of Object.keys(GROUPS)) G[id] = 'auto';
      this.hooks.changed('graphics', 'preset', 'auto');
      this.render();
    });
    out.push(this.row($t('Recommended'), $t('Back to Auto, with every part below following it: the game picks what suits this device.'), reset));
    out.push(this.row($t('Render resolution'), $t('Lower draws fewer pixels and runs faster, a little softer. 100% is sharpest.'),
      this.slider('graphics', 'scale', { min: 0.5, max: 1, step: 0.05 })));
    out.push(this.row($t('Shadows'), $t('Soft shadows from the sun and the lantern. Off is quicker.'),
      this.choice([['auto', $t('With the preset')], ['on', $t('On')], ['off', $t('Off')]], G.shadows, (v) => this.set('graphics', 'shadows', v))));
    out.push(this.row($t('Ocean'), $t`${this.hooks.oceanText?.() || ''} Full works out the sea's short waves on the graphics card, every frame: its texture and glitter close by, lacy foam on the breaking crests, and wakes you can see a long way off. Simple leaves them to the shading, for phones and slower computers. The waves your boat rides are the same either way. Auto picks Full on a computer that can run it.`,
      this.choice([['auto', $t('Auto')], ['full', $t('Full')], ['simple', $t('Simple')]], G.ocean, (v) => this.set('graphics', 'ocean', v))));
    for (const [id, grp] of Object.entries(GROUPS)) {
      out.push(this.row(grp.label, grp.desc, this.choice(['auto', ...LEVELS].map((l) => [l, LEVEL_NAMES[l]]), G[id], (v) => this.set('graphics', id, v))));
    }
    out.push(this.row($t('Frame-rate cap'), $t('Limit how often the screen is drawn: saves battery and keeps fans quiet.'),
      this.choice([[0, $t('None')], [60, $t('60 fps')], [30, $t('30 fps')]], G.fps, (v) => this.set('graphics', 'fps', v))));
    const note = el('p', 'st-note', $t('Lower settings only change what you see and how often distant fish move. Every fish is still there to be caught, the fish finder still reads them all, and fish near you behave the same.'));
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
    const host = this.hooks.following?.();
    if (host) out.push(el('p', 'st-note st-warn', $t`Playing together, the weather, wind and sea are ${host}’s, so you both see the same. Your own choices here come back when you leave the session.`));
    out.push(el('p', 'st-note', $t('Choose the weather you like: it changes smoothly, and stays as you leave it. Weather nudges what the fish do, but every choice is a good day out.')));
    out.push(grid);
    out.push(this.row($t('Rain effects'), $t('How much rain you see on screen and on the water. Turn it down if the drops get in the way; rain still counts for the fish. (Rain volume is under Sound.)'),
      this.slider('weather', 'rainFx')));
    // The sea, the wind and the currents: gameplay, not graphics (every graphics setting plays
    // the same water).
    out.push(el('h3', 'st-sub', $t('Sea, wind and currents')));
    out.push(this.row($t('Sea'), W.sea === 'auto' ? $t('Follows the weather: calmer in fine spells, livelier in rain and cloud.') : SEA_PRESETS[W.sea].note,
      this.choice([['auto', $t('With the weather')], ...SEA_IDS.map((id) => [id, SEA_PRESETS[id].name])], W.sea, (v) => this.set('weather', 'sea', v))));
    out.push(this.row($t('Wind'), W.windMode === 'auto' ? $t('Shifts and freshens by itself, with the sea setting above.') : $t`Steady from the ${compass(W.windFrom * Math.PI / 180, true)}, ${Math.round(W.windSpeed * 3.6)} km/h, with its gusts.`,
      this.choice([['auto', $t('Automatic')], ['manual', $t('Set it yourself')]], W.windMode, (v) => this.set('weather', 'windMode', v))));
    if (W.windMode === 'manual') {
      const dirs = el('div', 'st-choice st-compass');
      dirs.setAttribute('role', 'radiogroup');
      dirs.setAttribute('aria-label', $t('Wind from'));
      for (let d = 0; d < 360; d += 45) {
        const b = el('button', Math.round(W.windFrom) === d ? 'on' : '', compass(d * Math.PI / 180));
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(Math.round(W.windFrom) === d));
        b.setAttribute('aria-label', $t`from the ${compass(d * Math.PI / 180, true)}`);
        b.addEventListener('click', () => { this.set('weather', 'windFrom', d); this.render(); });
        dirs.append(b);
      }
      out.push(this.row($t('Wind from'), $t('Where it blows from, as in a forecast.'), dirs));
      const sp = el('div', 'st-slider');
      const i = el('input');
      Object.assign(i, { type: 'range', min: 0, max: 13, step: 0.5, value: W.windSpeed });
      const o = el('output', null, $t`${Math.round(W.windSpeed * 3.6)} km/h`);
      i.addEventListener('input', () => { o.textContent = $t`${Math.round(Number(i.value) * 3.6)} km/h`; this.S.weather.windSpeed = Number(i.value); });
      i.addEventListener('change', () => this.set('weather', 'windSpeed', Number(i.value)));
      sp.append(i, o);
      out.push(this.row($t('Wind strength'), $t('From still air to a fresh breeze.'), sp));
    }
    out.push(this.row($t('Currents'), { natural: $t('Currents carry your boat, float and rig as they run: strongest in the river, the estuary channel, off Gannet Isle and over Long Shoal.'), gentle: $t('Currents carry your boat and rig at half strength.'), still: $t('Your boat and rig stay where you put them (the fish still know where the water runs).') }[W.currents],
      this.choice([['natural', $t('Natural')], ['gentle', $t('Gentle')], ['still', $t('Still')]], W.currents, (v) => this.set('weather', 'currents', v))));
    out.push(this.row($t('Wind lines'), { sailing: $t('White lines drift through the air with the wind while you sail, showing where it blows from and how hard (the gusts too).'), always: $t('The wind lines show wherever you are: on foot, rowing or under motor too.'), off: $t('No wind lines: read the wind from the water, the flag at the masthead and the panel.') }[W.windLines],
      this.choice([['sailing', $t('When sailing')], ['always', $t('Always')], ['off', $t('Off')]], W.windLines, (v) => this.set('weather', 'windLines', v))));
    out.push(this.row($t('Conditions panel'), $t('A small panel with the wind, the current and the sea where you are. (Its key is under Controls.)'), this.toggle('weather', 'panel', 'Shown', 'Hidden')));
    out.push(el('p', 'st-note', $t('Calm days are a full way to play: every fish can be found in calm water. Wind and waves change how you fish, not what you can catch.')));
    return out;
  }

  controlsPane() {
    const C = this.S.controls;
    const out = [];
    const ps = this.hooks.playStyle?.();
    out.push(this.row($t('Play style'), ps ? STYLES[ps].desc : $t('Your own mix of the settings below. Choose a style to set them all together.'),
      this.choice(STYLE_IDS.map((id) => [id, STYLES[id].name]), ps, (v) => { this.hooks.setPlayStyle?.(v); this.render(); })));
    out.push(this.row($t('Technique'), TECHNIQUES[C.technique].desc,
      this.choice(TECHNIQUE_IDS.map((id) => [id, TECHNIQUES[id].name]), C.technique, (v) => this.set('controls', 'technique', v))));
    out.push(this.row($t('Casting'), CAST_MODES[C.cast].note,
      this.choice(Object.entries(CAST_MODES).map(([k, v]) => [k, v.name]), C.cast, (v) => this.set('controls', 'cast', v))));
    const d = this.hooks.difficulty();
    out.push(this.row($t('Difficulty'), $t`${DIFFICULTY[d].desc} Change it whenever you like: nothing is lost.`,
      this.choice(DIFFICULTY_IDS.map((id) => [id, DIFFICULTY[id].label]), d, (v) => this.hooks.setDifficulty(v))));
    const b = this.hooks.behaviour?.() || 'relaxed';
    out.push(this.row($t('Fish behaviour'), `${BEHAVIOUR[b].desc}`,
      this.choice(BEHAVIOUR_IDS.map((id) => [id, BEHAVIOUR[id].label]), b, (v) => this.hooks.setBehaviour?.(v))));
    const e = this.hooks.economy?.() || 'gentle';
    out.push(this.row($t('Economy'), ECONOMY[e].desc,
      this.choice(ECONOMY_IDS.map((id) => [id, ECONOMY[id].name]), e, (v) => { this.hooks.setEconomy?.(v); this.render(); })));
    out.push(this.row($t('Camera sensitivity'), $t('How far the view turns as you drag.'), this.slider('controls', 'sensitivity', { min: 0.3, max: 2.5, step: 0.1, pct: false })));
    out.push(this.row($t('Invert left and right'), $t('Dragging moves the view the other way across.'), this.toggle('controls', 'invertX')));
    out.push(this.row($t('Invert up and down'), $t('Dragging up looks down, like a flight stick.'), this.toggle('controls', 'invertY')));
    out.push(this.row($t('Reduced camera motion'), $t('No camera shake, no boat roll in first person, and the view never turns by itself to follow a running fish.'), this.toggle('controls', 'reducedMotion')));
    out.push(this.row($t('Boat camera'), C.boatCam === 'steady' ? $t('The view keeps a level horizon and only drifts gently up and down while the boat rides the waves beneath you.') : $t('The view rises and rolls a little with the boat on the swell.'),
      this.choice([['swell', $t('Moves with the boat')], ['steady', $t('Steady horizon')]], C.boatCam, (v) => this.set('controls', 'boatCam', v))));
    out.push(this.row($t('Sail trim'), C.sailTrim === 'helped' ? $t('The sailing boat’s mainsheet trims itself to the wind whenever you leave it alone for a moment: you steer, and haul in or ease to take over.') : $t('You trim the sailing boat’s mainsheet yourself: haul in when the sail flaps, ease out when she’s pressed and slow.'),
      this.choice([['hand', $t('By hand')], ['helped', $t('Helped')]], C.sailTrim, (v) => this.set('controls', 'sailTrim', v))));
    out.push(this.row($t('Character needs'), $t`${NEEDS_MODES[C.needs].desc} Warmth, wet clothes, thirst and hunger.`,
      this.choice(NEEDS_IDS.map((id) => [id, NEEDS_MODES[id].label]), C.needs, (v) => this.set('controls', 'needs', v))));
    out.push(this.row($t('The map'), $t('The whole chart: every shore, path and place name from the start (places you haven’t been yet in fainter ink). Explore it yourself: blank paper until you’ve been there, and places named once you find them.'),
      this.choice([['all', $t('The whole chart')], ['explore', $t('Explore it yourself')]], C.map || 'all', (v) => this.set('controls', 'map', v))));
    out.push(this.row($t('Fishing hints'), { gentle: $t('When nothing has come for a while, one word from the field guide on what the fish make of your rig.'), more: $t('A word whenever a cast stays quiet, and again if it stays quiet.'), off: $t('No hints by themselves. You can still ask (the key for “Why aren’t they biting?”).') }[C.hints],
      this.choice([['gentle', $t('Gentle')], ['more', $t('More')], ['off', $t('Off')]], C.hints, (v) => this.set('controls', 'hints', v))));
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
        const b = el('button', `pk-btn quiet${this.capturing === a.id ? ' waiting' : ''}`, this.capturing === a.id ? $t('Press a key…') : $t('Change'));
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
    head.append(el('h3', null, $t('Keys')));
    const reset = el('button', 'pk-btn quiet', $t('Reset keys'));
    reset.type = 'button';
    reset.addEventListener('click', () => {
      this.capturing = null;
      this.set('controls', 'keys', null);
      this.render();
    });
    head.append(reset);
    out.push(head);
    out.push(el('p', 'st-note', $t('Choose Change, then press the key you want. If another action had that key, it takes this action’s old key. Esc stops waiting. Touch screens use the on-screen controls.')));
    // How the boats, the cabin and the camera work, whatever the controls.
    out.push(el('h3', null, $t('Boats, the cabin and the camera')));
    out.push(this.row($t('Throttle'), C.throttle === 'lever'
      ? $t('A real lever: push it forward or pull it back and it stays where you leave it, the revs following smoothly. The first bit of travel puts her into gear at idle; back through neutral it stops there: let go, and push again for astern. The notches are still marked along it, and the D-pad (or + and −) jumps to the next one.')
      : $t('Clear notches: astern, neutral, dead slow, slow, trolling, half and full. Forward and back move it a notch at a time and it stays where you leave it; held, it goes on, pausing at neutral.'),
      this.choice([['notches', $t('Notches')], ['lever', $t('Smooth lever')]], C.throttle, (v) => this.set('controls', 'throttle', v))));
    out.push(this.row($t('Engine start-up'), START_MODES[C.start].desc,
      this.choice(START_IDS.map((id) => [id, START_MODES[id].name]), C.start, (v) => this.set('controls', 'start', v))));
    out.push(this.row($t('Helm'), C.helm === 'dash'
      ? $t('The dashboard: in first person at the helm of the RIB or the centre console, the switches, key, throttle and trim are on the console itself. Point and click (or tap); with a controller or the keyboard, the engine key looks down at it to move round it. In third person the engine key opens the helm panel.')
      : $t('The helm panel: the engine key opens a panel with every switch, gauge and the start-up checklist, wherever you look from.'),
      this.choice([['dash', $t('Dashboard')], ['panel', $t('Panel')]], C.helm, (v) => this.set('controls', 'helm', v))));
    for (const line of [
      $t('The throttle: the motor skiff, the tender, the bass boat, the cabin boat, the yacht, the trawler, the centre console and the jet ski have a lever with notches (astern, neutral, dead slow, slow, half, full), and the sailing boat’s outboard a smaller one. Forward and back move it a notch at a time and it stays where you leave it; you can also click or drag the lever on screen (bottom right), or tap a notch. Neutral (or the big Stop under the lever) stops the motor, and the boat coasts on. The motor takes a moment to build up and ease off, and pauses in neutral between ahead and astern.'),
      $t('Fishing under way: you can cast at up to trolling speed, and the boat carries the cast along as it flies. A moving boat tows your line behind it (trolling). With a line out the throttle goes no higher than slow ahead (+ and − move it, or the D-pad on a controller); when a fish takes, the motor goes to neutral.'),
      $t`The kayak’s electric motor: lower it (or raise it again) with its key, ${padName('L3')}, or the Motor button by the lever. Lowered, the lever drives it, quietly and slowly, hands free for the rod; raised, you paddle. Its battery charges at a jetty and overnight, and when it runs flat you simply paddle.`,
      $t`The cabin boat: anchored or tied up, the prompt takes you into the cabin (from the helm, or straight from the quay). Inside, forward and back move between the doorway, the galley and the bunk; the prompt cooks or sleeps; cancel (Esc or ${padName('B')}) takes you back on deck.`,
      $t`Mooring: a second prompt (on the anchor key, ${padName('X')} on a controller, or a tap) says what holding her still means where you are. Out on the water it drops the anchor: it goes down to the seabed, and she drifts back on her rope and lies head to the anchor, riding the waves; again, and you haul it in. Too shallow or too deep (deeper than its 30 m rope) and it says so. Beside a jetty or quay it ties her up alongside instead (lines and fenders); tied up, it casts off, pushing her clear if there’s room. Stepping ashore at a jetty makes her fast for you.`,
      $t('Towing: alongside another boat, the prompt offers to step across or take her in tow. She follows on a line from your stern; the mooring prompt (or the same prompt beside her) lets her go. A small boat can’t tow a much bigger one.'),
      $t('The camera turns all the way round you or your boat. Drag upwards (or push the right stick up) and the view sinks past the waterline to look beneath it, at the hull or the fish below; drag down again and you’re back in the air. The view key still steps through first person, a fixed underwater view and your bait.'),
    ]) out.push(el('p', 'st-note', line));
    out.push(list);
    // A controller: what its buttons do (they can't be changed), and whether it buzzes.
    out.push(el('h3', null, $t('Controller')));
    // (H2) The drawing of it, each button named: the guide shown the first time you use one.
    const guide = el('button', 'pk-btn quiet st-guide', $t('Show the controller guide'));
    guide.type = 'button';
    guide.addEventListener('click', () => this.hooks.padGuide?.());
    out.push(guide);
    out.push(el('p', 'st-note', $t`An Xbox, PlayStation or Nintendo controller (or any the browser recognises) works as soon as you press a button on it; the hints follow whichever you used last, and name its buttons as they're printed on it. In menus: the D-pad or left stick moves, ${padName('A')} chooses, ${padName('B')} goes back, ${padName('LB')} and ${padName('RB')} change tabs, the right stick scrolls.`));
    out.push(this.row($t('Button names'), $t('Automatic: as printed on the controller you’re using, from the name it gives the browser. Choose one if the hints name the wrong buttons: a PlayStation controller through Steam or DS4Windows passes itself off as an Xbox one.'),
      this.choice([['auto', $t('Automatic')], ['xbox', $t('Xbox')], ['playstation', $t('PlayStation')], ['nintendo', $t('Nintendo')]], C.padNames, (v) => this.set('controls', 'padNames', v))));
    out.push(...this.padSetup());
    out.push(this.row($t('Controller vibration'), $t('Feel the game through your hands: the engine through the hull, a sea slamming under the bow, a knock, the starter, the bite, the hook going in, a fish running and the drag giving line (in the reel trigger too, where the browser can reach it). Best in Chrome or Edge, on an Xbox or PlayStation controller.'),
      this.choice([['off', $t('Off')], ['light', $t('Light')], ['normal', $t('Normal')], ['strong', $t('Strong')]], C.vibration, (v) => { this.set('controls', 'vibration', v); this.hooks.feltVibration?.(v); })));
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
