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

function watchInstalling(worker) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      // A new version is ready, while the old one is still running this page.
      offline.updateReady = true;
      changed('update');
    }
    if (worker.state === 'activated') ask(worker);
    if (worker.state === 'redundant' && !offline.ready) {
      offline.error = 'Couldn’t store the game for offline play (the connection may have dropped). It will try again next time.';
      changed('error');
    }
  });
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
