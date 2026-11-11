// Offline play: registers the service worker (sw.js) that keeps the whole game on the
// device, reports when it is ready to play offline, watches the connection, and lets a
// new version take over safely.
//
// Saved games live in local storage, which the service worker never touches, so updating
// the game can't lose progress.

const READY_KEY = 'slow-tide-offline-ready';

export const offline = {
  supported: 'serviceWorker' in navigator,
  enabled: false,       // the service worker is in use on this site
  ready: false,         // every game file is stored on this device
  version: '',
  cached: 0,
  total: 0,
  online: navigator.onLine !== false,
  updateReady: false,   // a new version is downloaded and waiting
  downloading: null,    // a new version coming down: { cached, total } (total 0 until it says)
  error: '',
};

let listeners = [];
let registration = null;
let reloading = false;

function changed(event) {
  for (const f of listeners) f(event);
}

// On your own computer (localhost) the game skips the service worker so edits show up on
// refresh; add ?sw to the address to try offline play there.
function allowedHere() {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  return !local || new URLSearchParams(location.search).has('sw');
}

function ask(worker) {
  worker?.postMessage({ type: 'status' });
}

const watched = new WeakSet();
function watchInstalling(worker) {
  if (!worker || watched.has(worker)) return;
  watched.add(worker);
  // (A new version coming down while an older one runs this page: say so, so nobody needs to
  // keep refreshing to find out.)
  if (navigator.serviceWorker.controller && worker.state === 'installing' && !offline.downloading) {
    offline.downloading = { cached: 0, total: 0 };
    changed('downloading');
  }
  worker.addEventListener('statechange', () => {
    if (worker.state !== 'installing') offline.downloading = null;
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      // A new version is ready, while the old one is still running this page.
      offline.updateReady = true;
      changed('update');
    }
    if (worker.state === 'activated') ask(worker);
    if (worker.state === 'redundant' && !offline.ready) {
      offline.error = 'Couldn’t store the game for offline play (the connection may have dropped). It will try again next time.';
      changed('error');
    } else if (worker.state === 'redundant' && !offline.updating) changed('status');
  });
}

// (A promise, or a failure after ms.)
function within(p, ms) {
  let timer;
  return Promise.race([p, new Promise((_, no) => { timer = setTimeout(() => no(new Error('timed out')), ms); })]).finally(() => clearTimeout(timer));
}

// onChange(event) is called with 'ready', 'update', 'online', 'offline', 'error' or 'status'.
export function setupOffline(onChange) {
  listeners.push(onChange);
  addEventListener('online', () => { offline.online = true; changed('online'); });
  addEventListener('offline', () => { offline.online = false; changed('offline'); });
  if (!offline.supported || !allowedHere()) return;
  offline.enabled = true;

  navigator.serviceWorker.addEventListener('message', (e) => {
    const m = e.data || {};
    // (How far a new version has come down: sent by the new copy as it stores each file. Only
    // while another version is running, not when the game is first stored on this device.)
    if (m.type === 'progress') {
      if (!registration?.active || !registration.installing || m.version === offline.version || offline.updateReady) return;
      offline.downloading = { cached: m.cached, total: m.total };
      changed('progress');
      return;
    }
    if (m.type !== 'status') return;
    offline.version = m.version;
    offline.cached = m.cached;
    offline.total = m.total;
    const wasReady = offline.ready;
    offline.ready = m.total > 0 && m.cached >= m.total;
    if (offline.ready && !wasReady) {
      let first = false;
      try {
        first = !localStorage.getItem(READY_KEY);
        localStorage.setItem(READY_KEY, m.version);
      } catch { /* storage blocked: say it every time */ first = true; }
      changed(first ? 'ready' : 'status');
    } else changed('status');
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (offline.updating && !reloading) {
      reloading = true;
      location.reload();
    } else ask(navigator.serviceWorker.controller);
  });

  navigator.serviceWorker.register('sw.js').then((reg) => {
    registration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) {
      offline.updateReady = true;
      changed('update');
    }
    watchInstalling(reg.installing);
    reg.addEventListener('updatefound', () => watchInstalling(reg.installing));
    navigator.serviceWorker.ready.then((r) => ask(r.active));
    // Look for a new version now and then while playing (only does anything when online).
    setInterval(() => { if (navigator.onLine) reg.update().catch(() => {}); }, 30 * 60 * 1000);
  }).catch((err) => {
    offline.error = `Offline play isn’t available here (${err.message}).`;
    changed('error');
  });
}

// Switch to the waiting version: the page reloads once it has taken over.
export function applyUpdate() {
  if (!registration?.waiting) return false;
  offline.updating = true;
  registration.waiting.postMessage({ type: 'update' });
  return true;
}

// The Update button (on the title screen, and in the journal): look for a new version now and
// take it as soon as it's all down, or say this is the newest. Resolves with what it found:
// 'latest', 'offline', 'updating' (about to reload into the new version) or 'fresh' (fetching a
// clean copy of the game from the site). Saved games are never touched: they're in local
// storage and the photo album, not the offline copy.
export async function checkForUpdate() {
  // (No offline copy here: an ordinary reload is the newest there is.)
  if (!offline.enabled) {
    location.reload();
    return 'updating';
  }
  if (navigator.onLine === false) return 'offline';
  const reg = registration || (await navigator.serviceWorker.getRegistration().catch(() => null));
  if (!reg) return freshCopy();
  registration = reg;
  if (reg.waiting) return applyUpdate() ? 'updating' : freshCopy();
  try {
    await within(reg.update(), 20000);
  } catch {
    return freshCopy();
  }
  const w = reg.installing || reg.waiting;
  if (w) {
    // Coming down: switch over the moment it's all here (or, if it fails, fetch a clean copy).
    watchInstalling(w);
    const ok = w.state === 'installed' || (await within(new Promise((done) => {
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' || w.state === 'activated') done(true);
        if (w.state === 'redundant') done(false);
      });
    }), 180000).catch(() => false));
    if (!ok) return freshCopy();
    return applyUpdate() || reg.active === w ? 'updating' : freshCopy();
  }
  // Nothing new, by the browser's look. (Asking the site which version it has, to be sure: if
  // it isn't the one running, something's stuck, and a clean copy fixes it.)
  try {
    const res = await within(fetch('sw.js', { cache: 'no-store' }), 15000);
    const v = res.ok ? (await res.text()).match(/const VERSION = '([0-9a-f]+)'/)?.[1] : null;
    if (v && offline.version && v !== offline.version) return freshCopy();
  } catch { /* can't tell: say what we know */ }
  return 'latest';
}

// A clean copy: drop the offline copy and load the game straight from the site (it stores
// itself for offline play again afterwards). Only when online, or there'd be nothing to load.
export async function freshCopy() {
  if (navigator.onLine === false) return 'offline';
  offline.updating = true;
  try {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  } catch { /* carry on: the reload still asks the site */ }
  try {
    for (const k of await caches.keys()) if (k.startsWith('slow-tide-')) await caches.delete(k);
  } catch { /* the same */ }
  reloading = true;
  location.reload();
  return 'fresh';
}
