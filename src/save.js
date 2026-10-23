import { fishById } from './fish.js';
import { RODS, TACKLE, PACK, cleanGear } from './tackle.js';

// Saving your progress in this browser, with nobody to sign in to.
//
// The save is a small envelope { game, version, savedAt, data } in local storage. Every load
// checks it carefully: anything missing, odd or out of range is quietly replaced with a
// sensible default, so a damaged save can never crash the game. If the save can't be read
// at all, it is set aside (never overwritten) and the backup from the previous session is
// used instead. A save made by a newer version of the game is never written over.
//
// To change the save format later: bump SAVE_VERSION and add a step to MIGRATIONS that turns
// the previous version's data into the new shape.

export const SAVE_VERSION = 3;
const KEY = 'slow-tide-save';
const BACKUP = 'slow-tide-save-backup';          // the save as it was when this session began
const LEGACY = 'slow-tide-save-v1';              // the format before versioning
const UNREADABLE = 'slow-tide-save-unreadable';  // raw text of a save that couldn't be read, kept aside
const BEFORE_RESET = 'slow-tide-save-before-new-game';
const LOG_MAX = 1000;

export const DEFAULT_STATE = {
  hour: 14.5,
  day: 1,
  fish: {},      // id -> { count, best, firstDay, firstHour, firstZone, firstRain }
  places: {},    // id -> { day, hour }
  items: {},     // lantern: true
  tips: {},      // which gentle hints have already been shown
  boat: null,    // the rowing boat: { x, z, heading, anchored }
  skiff: null,   // the motor skiff: { x, z, heading, anchored }
  vessel: 'row', // which boat you're in, or last used: 'row' or 'skiff'
  mode: 'boat',  // 'boat' or 'foot'
  walker: null,  // { x, z, heading } while on foot
  gear: null,    // rods and tackle in the backpack, and what's tied on (see tackle.js)
  keep: [],      // fish in the creel: { id, size, logId }
  food: null,    // { full, wellFedUntil }
  camp: null,    // { fireUntil, cooking, ready }
  caughtOn: {},  // species id -> { tackle id: count }
  log: [],       // every catch: see sanitizeLogEntry
  meals: 0,
  finder: null,  // { x, y } as fractions of the screen, and { size }
  music: true,
  quality: 'auto', // 'auto' | 'high' | 'medium' | 'low'
  difficulty: 'standard', // 'relaxed' | 'standard' | 'realistic'
  sonar: false,    // fish finder shown
  volumes: { master: 1, nature: 1, music: 0.8 },
};

const fresh = () => JSON.parse(JSON.stringify(DEFAULT_STATE));

/* ---------------- checking what we read ---------------- */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, lo = -Infinity, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v, d, lo, hi) => Math.round(num(v, d, lo, hi));
const str = (v, d, max = 60) => (typeof v === 'string' ? v.slice(0, max) : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const ZONES = ['bay', 'cove', 'open', 'lake', 'stream'];
const KINDS = ['float', 'lure', 'ledger', 'fly'];
export const OUTCOMES = ['released', 'kept', 'cooked', 'eaten'];

function pos(v) {
  if (!isObj(v)) return null;
  const x = num(v.x, NaN), z = num(v.z, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 2000 || Math.abs(z) > 2000) return null;
  return { x, z, heading: num(v.heading, 0), anchored: !!v.anchored };
}

export function sanitizeLogEntry(e) {
  if (!isObj(e) || !fishById[e.sp]) return null;
  const sp = fishById[e.sp];
  return {
    id: str(e.id, `c${Math.random().toString(36).slice(2, 10)}`, 24),
    at: num(e.at, 0, 0),
    sp: e.sp,
    size: int(e.size, sp.size[0], 1, 300),
    day: int(e.day, 1, 1, 1e6),
    hour: num(e.hour, 12, 0, 24),
    zone: oneOf(e.zone, ZONES, 'bay'),
    place: str(e.place, ''),
    water: oneOf(e.water, ['salt', 'fresh'], sp.water === 'fresh' ? 'fresh' : 'salt'),
    kind: oneOf(e.kind, KINDS, 'float'),
    rod: RODS[e.rod] ? e.rod : 'float',
    item: TACKLE[e.item] ? e.item : null,
    from: oneOf(e.from, ['boat', 'shore'], 'boat'),
    rain: int(e.rain, 0, 0, 2),
    hatch: num(e.hatch, 0, 0, 2),
    depth: num(e.depth, 0, 0, 60),
    bottom: num(e.bottom, 0, 0, 60),
    outcome: oneOf(e.outcome, OUTCOMES, 'released'),
  };
}

// Turn whatever was stored into a complete, well-formed game state.
export function sanitize(raw) {
  const s = fresh();
  if (!isObj(raw)) return s;
  s.hour = num(raw.hour, s.hour, 0, 23.999);
  s.day = int(raw.day, 1, 1, 1e6);
  if (isObj(raw.fish)) {
    for (const [id, r] of Object.entries(raw.fish)) {
      if (!fishById[id] || !isObj(r)) continue;
      s.fish[id] = {
        count: int(r.count, 1, 0, 1e6), best: num(r.best, 0, 0, 300),
        firstDay: int(r.firstDay, 1, 1, 1e6), firstHour: num(r.firstHour, 12, 0, 24),
        firstZone: oneOf(r.firstZone, ZONES, 'bay'), firstRain: !!r.firstRain,
      };
    }
  }
  if (isObj(raw.places)) {
    for (const [id, r] of Object.entries(raw.places)) {
      if (typeof id === 'string' && id.length < 30) s.places[id] = { day: int(r?.day, 1, 1, 1e6), hour: num(r?.hour, 12, 0, 24) };
    }
  }
  s.items = { lantern: !!raw.items?.lantern };
  if (isObj(raw.tips)) for (const [k, v] of Object.entries(raw.tips)) if (k.length < 30) s.tips[k] = !!v;
  s.boat = pos(raw.boat);
  s.skiff = pos(raw.skiff);
  s.vessel = oneOf(raw.vessel, ['row', 'skiff'], 'row');
  s.mode = oneOf(raw.mode, ['boat', 'foot'], 'boat');
  s.walker = pos(raw.walker);
  if (s.mode === 'foot' && !s.walker) s.mode = 'boat';
  s.gear = cleanGear(isObj(raw.gear) ? raw.gear : null);
  s.keep = (Array.isArray(raw.keep) ? raw.keep : [])
    .filter((f) => isObj(f) && fishById[f.id]?.meal)
    .slice(0, PACK.fish)
    .map((f) => ({ id: f.id, size: int(f.size, fishById[f.id].size[0], 1, 300), logId: str(f.logId, null, 24) }));
  s.food = isObj(raw.food) ? { full: num(raw.food.full, 80, 0, 100), wellFedUntil: num(raw.food.wellFedUntil, 0, 0) } : null;
  if (isObj(raw.camp)) {
    const c = raw.camp;
    const meal = (m) => (isObj(m) && fishById[m.id]?.meal ? { id: m.id, size: int(m.size, 20, 1, 300), logId: str(m.logId, null, 24) } : null);
    const cooking = meal(c.cooking);
    if (cooking) Object.assign(cooking, { start: num(c.cooking.start, 0, 0), dur: num(c.cooking.dur, 0.5, 0.05, 2) });
    s.camp = {
      fireUntil: num(c.fireUntil, 0, 0),
      cooking,
      ready: (Array.isArray(c.ready) ? c.ready : []).map(meal).filter(Boolean).slice(0, 8),
    };
  }
  if (isObj(raw.caughtOn)) {
    for (const [id, on] of Object.entries(raw.caughtOn)) {
      if (!fishById[id] || !isObj(on)) continue;
      s.caughtOn[id] = {};
      for (const [t, n] of Object.entries(on)) if (TACKLE[t]) s.caughtOn[id][t] = int(n, 1, 0, 1e6);
    }
  }
  s.log = (Array.isArray(raw.log) ? raw.log : []).map(sanitizeLogEntry).filter(Boolean).slice(-LOG_MAX);
  s.meals = int(raw.meals, 0, 0, 1e6);
  if (isObj(raw.finder)) {
    const f = raw.finder;
    s.finder = { x: f.x == null ? null : num(f.x, null, 0, 1), y: f.y == null ? null : num(f.y, null, 0, 1), size: int(f.size, 1, 0, 2) };
  }
  s.music = raw.music !== false;
  s.quality = oneOf(raw.quality, ['auto', 'high', 'medium', 'low'], 'auto');
  s.difficulty = oneOf(raw.difficulty, ['relaxed', 'standard', 'realistic'], 'standard');
  s.sonar = !!raw.sonar;
  if (isObj(raw.volumes)) {
    for (const k of ['master', 'nature', 'music']) s.volumes[k] = num(raw.volumes[k], s.volumes[k], 0, 1);
  }
  return s;
}

/* ---------------- migrations ---------------- */

// MIGRATIONS[n] turns version n data into version n + 1.
const MIGRATIONS = {
  // Version 1 had no envelope and no catch log; its fields carry straight over.
  1: (d) => ({ ...d, log: [] }),
  // Version 2 had one boat; the motor skiff arrives at its mooring and you're in the rowing boat.
  2: (d) => ({ ...d, vessel: 'row', skiff: null }),
};

function migrate(data, from) {
  let d = data, v = from;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No migration from save version ${v}`);
    d = step(d);
    v++;
  }
  return d;
}

/* ---------------- storage ---------------- */

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { localStorage.setItem(k, v); },
  remove(k) { try { localStorage.removeItem(k); } catch { /* nothing to remove */ } },
};

function storageWorks() {
  try {
    localStorage.setItem('slow-tide-test', '1');
    localStorage.removeItem('slow-tide-test');
    return true;
  } catch {
    return false;
  }
}

// Read an envelope from text. Returns { state, version, savedAt } or throws with a reason.
export function parseSave(text) {
  const env = JSON.parse(text);
  if (!isObj(env)) throw new Error('not a save');
  // A bare state object is the old, unversioned format.
  if (env.game !== 'slow-tide') {
    if (typeof env.hour === 'number' || isObj(env.fish)) return { state: sanitize(migrate(env, 1)), version: 1, savedAt: 0 };
    throw new Error('not a Slow Tide save');
  }
  const version = int(env.version, 0, 0, 1e6);
  if (version < 1) throw new Error('unknown version');
  if (version > SAVE_VERSION) return { newer: true, version, savedAt: num(env.savedAt, 0) };
  if (!isObj(env.data)) throw new Error('no data');
  return { state: sanitize(migrate(env.data, version)), version, savedAt: num(env.savedAt, 0) };
}

export function envelope(state) {
  return { game: 'slow-tide', version: SAVE_VERSION, savedAt: Date.now(), data: state };
}

const status = {
  canSave: true,     // false when storage is unavailable or the save is from a newer version
  lastSaved: 0,
  firstSave: true,
  lastBackup: 0,
};
export const saveStatus = status;

// Load the game. Always returns a usable state, plus what happened (for a gentle notice).
export function loadGame() {
  if (!storageWorks()) {
    status.canSave = false;
    return { state: fresh(), outcome: 'nostorage' };
  }
  const tryKey = (k) => {
    const text = store.get(k);
    if (text == null) return null;
    try {
      return { text, ...parseSave(text) };
    } catch (err) {
      return { text, error: err };
    }
  };
  const main = tryKey(KEY);
  if (main && main.newer) {
    // Never overwrite progress made in a newer version of the game.
    status.canSave = false;
    return { state: fresh(), outcome: 'newer' };
  }
  if (main && main.state) {
    status.lastSaved = main.savedAt;
    return { state: main.state, outcome: 'loaded' };
  }
  if (main && main.error) {
    // Keep the unreadable text aside (unless an earlier one is already kept), then fall back.
    if (store.get(UNREADABLE) == null) {
      try { store.set(UNREADABLE, main.text); } catch { /* storage full: leave it where it is */ }
    }
    const backup = tryKey(BACKUP);
    if (backup && backup.state) {
      status.firstSave = false; // the backup is already the safe copy; don't replace it with the broken save
      return { state: backup.state, outcome: 'backup' };
    }
    status.firstSave = false;
    return { state: fresh(), outcome: 'unreadable' };
  }
  const legacy = tryKey(LEGACY);
  if (legacy && legacy.state) return { state: legacy.state, outcome: 'migrated' };
  return { state: fresh(), outcome: 'new' };
}

// Write the save. The first save of each session (and one every ten minutes) also keeps
// the previous save as a backup.
export function saveGame(state) {
  if (!status.canSave) return false;
  try {
    const now = Date.now();
    if (status.firstSave || now - status.lastBackup > 10 * 60 * 1000) {
      const prev = store.get(KEY);
      if (prev) {
        try {
          parseSave(prev);
          store.set(BACKUP, prev);
        } catch { /* the previous save is unreadable: keep the older backup */ }
      }
      status.firstSave = false;
      status.lastBackup = now;
    }
    store.set(KEY, JSON.stringify(envelope(state)));
    status.lastSaved = now;
    return true;
  } catch {
    // Full or blocked storage: try again next time.
    return false;
  }
}

// Start over. The old save is kept to one side (and can be downloaded first from the journal).
// `keep` carries settings over (sound, graphics) into the new game.
export function newGame(keep = null) {
  const prev = store.get(KEY);
  if (prev) {
    try { store.set(BEFORE_RESET, prev); } catch { /* not enough room: it goes */ }
  }
  store.remove(KEY);
  store.remove(BACKUP);
  store.remove(LEGACY);
  if (keep) {
    try { store.set(KEY, JSON.stringify(envelope(sanitize(keep)))); } catch { /* starts with defaults */ }
  }
  status.canSave = false; // stop the leaving-the-page save from writing the old game back
}

// Another tab wrote the save: stop saving here so the two don't overwrite each other.
export function stopSaving() {
  status.canSave = false;
  status.otherTab = true;
}
export const SAVE_KEY = KEY;

// Replace the save with one loaded from a file (already checked with parseSave).
export function importSave(state) {
  const prev = store.get(KEY);
  if (prev) {
    try { store.set(BACKUP, prev); } catch { /* no room for a backup */ }
  }
  store.set(KEY, JSON.stringify(envelope(state)));
  status.canSave = false; // the page reloads straight away; don't let the old state overwrite it
}

export function exportText(state) {
  return JSON.stringify(envelope(state), null, 1);
}

/* ---------------- combining two saves (for cloud sync) ---------------- */

// True once a save holds anything worth keeping.
export function hasProgress(s) {
  return !!(s && (Object.keys(s.fish).length || Object.keys(s.places).length || s.log.length || s.items.lantern || s.day > 1 || s.meals));
}

const JOURNAL_KEYS = ['fish', 'places', 'items', 'tips', 'caughtOn', 'log', 'meals'];
const SETTINGS_KEYS = ['quality', 'volumes', 'music', 'sonar', 'finder', 'difficulty'];

// Combine two saves so nothing discovered in either is lost: every logged catch (matched by
// id), each fish's count and best, places, keepsakes and hints. Where you are, the time,
// your gear, creel and camp come from `world` ('a' or 'b'), normally whichever was saved
// last. Settings like volume and graphics always stay with `a` (this device).
export function mergeStates(a, b, world = 'a') {
  const w = world === 'b' ? b : a;
  const out = sanitize(JSON.parse(JSON.stringify(w)));
  for (const k of SETTINGS_KEYS) out[k] = JSON.parse(JSON.stringify(a[k]));

  const ids = new Set();
  const log = [];
  for (const e of [...a.log, ...b.log]) {
    if (ids.has(e.id)) continue;
    ids.add(e.id);
    log.push({ ...e });
  }
  log.sort((x, y) => x.at - y.at);
  out.log = log.slice(-LOG_MAX);
  const loggedCount = {};
  for (const e of log) loggedCount[e.sp] = (loggedCount[e.sp] || 0) + 1;

  const earlier = (x, y) => (x.firstDay < y.firstDay || (x.firstDay === y.firstDay && x.firstHour <= y.firstHour) ? x : y);
  out.fish = {};
  for (const id of new Set([...Object.keys(a.fish), ...Object.keys(b.fish)])) {
    const x = a.fish[id], y = b.fish[id];
    if (!x || !y) {
      out.fish[id] = { ...(x || y), count: Math.max((x || y).count, loggedCount[id] || 0) };
      continue;
    }
    const first = earlier(x, y);
    out.fish[id] = {
      count: Math.max(x.count, y.count, loggedCount[id] || 0),
      best: Math.max(x.best, y.best),
      firstDay: first.firstDay, firstHour: first.firstHour, firstZone: first.firstZone, firstRain: first.firstRain,
    };
  }
  out.places = {};
  for (const id of new Set([...Object.keys(a.places), ...Object.keys(b.places)])) {
    const x = a.places[id], y = b.places[id];
    out.places[id] = !x ? { ...y } : !y ? { ...x } : (x.day < y.day || (x.day === y.day && x.hour <= y.hour) ? { ...x } : { ...y });
  }
  out.items = { lantern: !!(a.items.lantern || b.items.lantern) };
  out.tips = { ...b.tips, ...a.tips };
  for (const k of Object.keys(out.tips)) out.tips[k] = !!(a.tips[k] || b.tips[k]);
  out.caughtOn = {};
  for (const id of new Set([...Object.keys(a.caughtOn), ...Object.keys(b.caughtOn)])) {
    const on = (out.caughtOn[id] = {});
    for (const src of [a.caughtOn[id], b.caughtOn[id]]) {
      if (src) for (const [t, n] of Object.entries(src)) on[t] = Math.max(on[t] || 0, n);
    }
  }
  out.meals = Math.max(a.meals, b.meals);
  return out;
}

// Copy only the journal (catches, places, keepsakes) from `merged` into a live game state,
// leaving where you are, the time and your gear alone.
export function adoptJournal(live, merged) {
  for (const k of JOURNAL_KEYS) live[k] = merged[k];
}
