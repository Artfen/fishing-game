// The Update button (src/offline.js checkForUpdate, freshCopy): against a stand-in for the
// browser's service worker, it says when this is the newest version, takes a new one the moment
// it's all down (and shows it coming), fetches a clean copy when an update can't be stored or
// something's stuck, and does nothing offline. Saved games are never touched.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

class Worker extends EventTarget {
  constructor(state) { super(); this.state = state; this.posted = []; }
  postMessage(m) { this.posted.push(m); }
  set(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
}
const reg = new EventTarget();
Object.assign(reg, { active: new Worker('activated'), installing: null, waiting: null, unregistered: 0 });
reg.unregister = async () => { reg.unregistered++; return true; };
let onUpdate = async () => {};
reg.update = () => onUpdate();
const sw = new EventTarget();
Object.assign(sw, { controller: reg.active, register: async () => reg, ready: Promise.resolve(reg), getRegistration: async () => reg, getRegistrations: async () => [reg] });
const net = { onLine: true, serviceWorker: sw };
Object.defineProperty(globalThis, 'navigator', { value: net, configurable: true });
const page = { reloads: 0 };
globalThis.location = { hostname: 'slowtide.example', search: '', reload: () => { page.reloads++; } };
globalThis.addEventListener ??= () => {};
const deleted = [];
globalThis.caches = { keys: async () => ['slow-tide-aaa', 'slow-tide-runtime', 'someone-else'], delete: async (k) => { deleted.push(k); return true; } };
let onSite = 'aaa';
globalThis.fetch = async () => ({ ok: true, text: async () => `const VERSION = '${onSite}';` });

const { setupOffline, offline, checkForUpdate } = await import('../src/offline.js');
const events = [];
{
  const was = globalThis.setInterval;
  globalThis.setInterval = () => 0; // (its look for a new version every half hour, set once registered)
  setupOffline((e) => events.push(e));
  await new Promise((r) => setTimeout(r, 0));
  globalThis.setInterval = was;
}
// The running version tells the page which it is.
sw.dispatchEvent(Object.assign(new Event('message'), { data: { type: 'status', version: 'aaa', cached: 3, total: 3 } }));
const tick = () => new Promise((r) => setTimeout(r, 0));

test('nothing new on the site: it says this is the newest, and leaves everything be', async () => {
  localStorage.setItem('slow-tide-save', '{"kept":true}');
  assert.equal(await checkForUpdate(), 'latest');
  assert.equal(page.reloads, 0);
  assert.equal(reg.unregistered, 0);
  // Offline: nothing to look for, and certainly nothing thrown away.
  net.onLine = false;
  assert.equal(await checkForUpdate(), 'offline');
  net.onLine = true;
});

test('a new version on the site: shown coming down, and taken the moment it’s all here', async () => {
  const w = new Worker('installing');
  onUpdate = async () => { reg.installing = w; reg.dispatchEvent(new Event('updatefound')); };
  const result = checkForUpdate();
  await tick();
  await tick();
  assert.ok(offline.downloading, 'coming down');
  // (The new copy says how far it's got, file by file.)
  sw.dispatchEvent(Object.assign(new Event('message'), { data: { type: 'progress', version: 'bbb', cached: 60, total: 120 } }));
  assert.deepEqual(offline.downloading, { cached: 60, total: 120 });
  assert.ok(events.includes('progress'));
  reg.installing = null;
  reg.waiting = w;
  w.set('installed');
  assert.equal(await result, 'updating');
  assert.equal(offline.downloading, null);
  assert.deepEqual(w.posted.at(-1), { type: 'update' }, 'told to take over');
  assert.equal(reg.unregistered, 0);
  reg.waiting = null;
  offline.updating = false;
  offline.updateReady = false;
});

test('an update that can’t be stored, or a stuck one: a clean copy from the site, saves untouched', async () => {
  // The new version fails to store (a file missing on the site, the connection dropping).
  const w = new Worker('installing');
  onUpdate = async () => { reg.installing = w; };
  const result = checkForUpdate();
  await tick();
  w.set('redundant');
  assert.equal(await result, 'fresh');
  assert.equal(reg.unregistered, 1, 'the offline copy dropped');
  assert.deepEqual(deleted.sort(), ['slow-tide-aaa', 'slow-tide-runtime'], 'only the game’s own stored files');
  assert.equal(page.reloads, 1, 'and loaded fresh');
  assert.equal(localStorage.getItem('slow-tide-save'), '{"kept":true}', 'the saved game kept');
  // The browser sees nothing new, but the site has moved on: stuck, so the same.
  reg.installing = null;
  offline.updating = false;
  onUpdate = async () => {};
  onSite = 'ccc';
  assert.equal(await checkForUpdate(), 'fresh');
  assert.equal(page.reloads, 2);
  // And when the browser can't even check.
  offline.updating = false;
  onUpdate = async () => { throw new Error('network'); };
  assert.equal(await checkForUpdate(), 'fresh');
});

test('the progress of the game first being stored on a device isn’t taken for an update', () => {
  const was = reg.active;
  reg.active = null;
  reg.installing = new Worker('installing');
  offline.downloading = null;
  sw.dispatchEvent(Object.assign(new Event('message'), { data: { type: 'progress', version: 'ddd', cached: 10, total: 120 } }));
  assert.equal(offline.downloading, null);
  reg.active = was;
  reg.installing = null;
});
