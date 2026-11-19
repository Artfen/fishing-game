// The downloadable build (docs/WORLD.md, W4): the desktop app's updates (desktop/updates.cjs)
// against a stand-in feed, the page's side of them (src/offline.js: the same Update button), the
// saves folder, and the installers' configuration, the CI workflow and the download page agreeing
// on every file's name. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { setupUpdates, localFeed, RELEASES } = require('../desktop/updates.cjs');
const root = new URL('..', import.meta.url).pathname;
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// A stand-in for electron-updater's autoUpdater: says what it's told to, counts what it's asked.
class FakeUpdater extends EventEmitter {
  constructor(feed) {
    super();
    this.feed = feed;       // { version } of the newest on the feed, or an Error to throw
    this.installs = [];
    this.checks = 0;
    this.feedURL = null;
  }
  setFeedURL(o) { this.feedURL = o; }
  async checkForUpdates() {
    this.checks++;
    this.emit('checking-for-update');
    if (this.feed instanceof Error) { this.emit('error', this.feed); throw this.feed; }
    const newer = this.feed.version !== '0.1.0';
    if (!newer) { this.emit('update-not-available', { version: '0.1.0' }); return { isUpdateAvailable: false, updateInfo: { version: '0.1.0' } }; }
    this.emit('update-available', { version: this.feed.version });
    if (this.autoDownload) {
      // (Coming down, then checked and kept, a moment later.)
      setTimeout(() => {
        this.emit('download-progress', { percent: 42.4 });
        this.emit('update-downloaded', { version: this.feed.version });
      }, 5);
    }
    return { isUpdateAvailable: true, updateInfo: { version: this.feed.version } };
  }
  quitAndInstall(silent, runAfter) { this.installs.push([silent, runAfter]); }
}

function rig({ packaged = true, platform = 'linux', env = { APPIMAGE: '/apps/Slow-Tide.AppImage' }, signed = true, feed = { version: '0.2.0' } } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slow-tide-updates-'));
  const handlers = {};
  const sent = [];
  const opened = [];
  const timers = [];
  const updater = new FakeUpdater(feed);
  let loaded = 0;
  const app = { isPackaged: packaged, getPath: () => dir, getVersion: () => '0.1.0' };
  const u = setupUpdates({
    app, platform, env, signed,
    ipcMain: { on: (ch, fn) => { handlers[ch] = fn; }, handle: (ch, fn) => { handlers[ch] = fn; } },
    shell: { openExternal: (url) => opened.push(url) },
    send: (ch, s) => sent.push([ch, s]),
    load: () => { loaded++; return updater; },
    later: (fn, ms) => timers.push([fn, ms]),
  });
  const ask = (ch, arg) => { const e = {}; handlers[ch](e, arg); return e.returnValue; };
  return { u, dir, handlers, sent, opened, timers, updater, ask, loaded: () => loaded, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
const settle = () => new Promise((r) => setTimeout(r, 20));

test('a copy that isn’t installed never looks: run from the repository, or a Linux copy that isn’t the AppImage', async () => {
  for (const r of [rig({ packaged: false }), rig({ env: {} })]) {
    assert.equal(r.loaded(), 0, 'the updater isn’t even loaded');
    assert.equal(r.u.start(), false);
    assert.equal(r.timers.length, 0);
    assert.equal(await r.handlers['updates:check'](), 'off');
    assert.equal(r.ask('updates:status').state, 'off');
    assert.equal(r.u.install(), 'nothing');
    r.done();
  }
  // A stand-in feed is only ever one on this computer.
  assert.equal(localFeed('http://127.0.0.1:8899/'), 'http://127.0.0.1:8899/');
  assert.equal(localFeed('http://localhost:5000/feed/'), 'http://localhost:5000/feed/');
  for (const bad of ['https://example.com/', 'http://10.0.0.2/', 'file:///tmp/feed', 'ftp://127.0.0.1/', 'not a url']) assert.equal(localFeed(bad), null, bad);
  const far = rig({ packaged: false, env: { SLOW_TIDE_UPDATE_FEED: 'https://elsewhere.example/' } });
  assert.equal(far.loaded(), 0, 'a feed elsewhere doesn’t switch it on');
  far.done();
  const near = rig({ packaged: false, env: { SLOW_TIDE_UPDATE_FEED: 'http://127.0.0.1:8899/', APPIMAGE: '/a', SLOW_TIDE_UPDATE_DELAY: '1' } });
  assert.deepEqual(near.updater.feedURL, { provider: 'generic', url: 'http://127.0.0.1:8899/' });
  assert.equal(near.u.start(), true);
  assert.equal(near.timers[0][1], 1000, 'the stand-in feed’s own wait');
  near.done();
});

test('installed: looks once it’s started, brings a new version down, and waits to be told', async () => {
  const r = rig();
  assert.equal(r.updater.autoDownload, true);
  assert.equal(r.updater.autoInstallOnAppQuit, true, 'not taken: installed when the app is quit');
  assert.equal(r.updater.allowDowngrade, false);
  assert.equal(r.u.start(), true);
  assert.equal(r.timers.length, 1);
  assert.equal(r.timers[0][1], 20000, 'a while after the game has loaded');
  assert.equal(r.updater.checks, 0, 'not straight away');
  r.timers[0][0]();
  await settle();
  const states = r.sent.map(([ch, s]) => (assert.equal(ch, 'updates:status'), s.state));
  assert.deepEqual(states, ['checking', 'downloading', 'downloading', 'ready']);
  assert.deepEqual(r.sent.at(-1)[1], { state: 'ready', version: '0.2.0' });
  assert.equal(r.sent[2][1].percent, 42);
  assert.deepEqual(r.updater.installs, [], 'never restarts by itself');
  // Asked again: it says what's so, without looking twice.
  assert.equal(await r.handlers['updates:check'](), 'ready');
  assert.equal(r.updater.checks, 1);
  // A late error doesn't take back a downloaded version.
  r.updater.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED'));
  assert.equal(r.ask('updates:status').state, 'ready');
  // Told to: restarts into it, quietly, and starts the game again after.
  r.handlers['updates:install']();
  assert.deepEqual(r.updater.installs, [[true, true]]);
  assert.deepEqual(r.opened, []);
  r.done();
});

test('nothing new, no connection, or something wrong: each said as it is', async () => {
  const latest = rig({ feed: { version: '0.1.0' } });
  assert.equal(await latest.handlers['updates:check'](), 'latest');
  assert.deepEqual(latest.ask('updates:status'), { state: 'latest', version: '0.1.0' });
  latest.handlers['updates:install']();
  assert.deepEqual(latest.updater.installs, [], 'nothing to install');
  latest.done();
  const away = rig({ feed: new Error('getaddrinfo ENOTFOUND github.com') });
  assert.equal(await away.handlers['updates:check'](), 'offline');
  assert.equal(away.ask('updates:status').state, 'offline');
  away.done();
  const broken = rig({ feed: new Error('HttpError: 404 Not Found') });
  assert.equal(await broken.handlers['updates:check'](), 'error');
  assert.equal(broken.ask('updates:status').state, 'error');
  // (It can look again.)
  broken.updater.feed = { version: '0.3.0' };
  assert.equal(await broken.handlers['updates:check'](), 'downloading');
  broken.done();
});

test('a Mac copy without a Developer ID: says a new version is out, and Update opens the download page', async () => {
  const r = rig({ platform: 'darwin', env: {}, signed: false });
  assert.equal(r.updater.autoDownload, false, 'nothing downloaded it couldn’t install');
  assert.equal(r.updater.autoInstallOnAppQuit, false);
  assert.equal(await r.handlers['updates:check'](), 'out');
  await settle();
  assert.deepEqual(r.ask('updates:status'), { state: 'out', version: '0.2.0' });
  r.handlers['updates:install']();
  assert.deepEqual(r.updater.installs, []);
  assert.deepEqual(r.opened, [RELEASES]);
  r.done();
  // Signed, it updates itself like the others.
  const s = rig({ platform: 'darwin', env: {}, signed: true });
  assert.equal(s.updater.autoDownload, true);
  s.done();
});

test('switched off, it doesn’t look when it starts (and remembers); Check for updates still looks', async () => {
  const r = rig();
  assert.equal(r.ask('updates:auto', null), true, 'on unless switched off');
  assert.equal(r.ask('updates:auto', false), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(r.dir, 'settings.json'), 'utf8')), { updates: false });
  assert.equal(r.ask('updates:auto', 'yes'), false, 'only true or false changes it');
  assert.equal(r.u.start(), false);
  assert.equal(r.timers.length, 0);
  assert.equal(await r.handlers['updates:check'](), 'downloading', 'asked for, it looks');
  // The next run reads the same file.
  const again = setupUpdates({
    app: { isPackaged: true, getPath: () => r.dir, getVersion: () => '0.1.0' }, platform: 'linux', env: { APPIMAGE: '/a' },
    ipcMain: { on() {}, handle() {} }, load: () => new FakeUpdater({ version: '0.1.0' }), later: () => assert.fail('switched off'),
  });
  assert.equal(again.auto(), false);
  assert.equal(again.start(), false);
  assert.equal(again.setAuto(true), true);
  // A damaged settings file reads as the default.
  fs.writeFileSync(path.join(r.dir, 'settings.json'), '{not json');
  assert.equal(again.auto(), true);
  r.done();
});

test('the app opens the saves folder, and its updates are off when run from the repository', async () => {
  const Module = (await import('node:module')).default;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slow-tide-desktop-'));
  const handlers = {};
  const opened = [];
  const fake = {
    app: { getPath: () => dir, whenReady: () => new Promise(() => {}), on() {}, commandLine: { appendSwitch() {} }, isPackaged: false, getVersion: () => '0.1.0' },
    BrowserWindow: class { static getAllWindows() { return []; } }, protocol: { registerSchemesAsPrivileged() {}, handle() {} }, net: {},
    ipcMain: { on: (ch, fn) => { handlers[ch] = fn; }, handle: (ch, fn) => { handlers[ch] = fn; } },
    shell: { openPath: (p) => opened.push(p), openExternal() {} },
  };
  const load = Module._load;
  Module._load = function (req, ...rest) { return req === 'electron' ? fake : load.call(this, req, ...rest); };
  try {
    delete require.cache[require.resolve('../desktop/main.cjs')];
    require('../desktop/main.cjs');
  } finally {
    Module._load = load;
  }
  handlers['saves:open']();
  assert.deepEqual(opened, [path.join(dir, 'saves')]);
  assert.ok(fs.statSync(path.join(dir, 'saves')).isDirectory(), 'made if it isn’t there yet');
  assert.equal(await handlers['updates:check'](), 'off');
  const e = {};
  handlers['updates:status'](e);
  assert.equal(e.returnValue.state, 'off');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the game’s side: the app’s news on the same Update button, and Update restarts into it', async () => {
  // (A browser with the desktop app's bridge: src/offline.js keeps no service worker there.)
  const calls = { install: 0, check: 0, registered: 0 };
  let watcher = null;
  let now = { state: 'idle' };
  globalThis.slowTideDesktop = {
    updates: {
      status: () => now,
      check: async () => { calls.check++; return 'latest'; },
      install: () => { calls.install++; },
      auto: () => true,
      watch: (fn) => { watcher = fn; },
    },
  };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true, serviceWorker: { register: async () => { calls.registered++; } } }, configurable: true });
  globalThis.location = { hostname: 'slow-tide', search: '', reload: () => assert.fail('the app never reloads to update') };
  globalThis.addEventListener ??= () => {};
  const { setupOffline, offline, checkForUpdate, applyUpdate } = await import('../src/offline.js');
  const events = [];
  setupOffline((e) => events.push(e));
  assert.equal(offline.desktop, true);
  assert.equal(offline.enabled, false, 'no offline copy to keep: the files are on the computer');
  assert.equal(calls.registered, 0);
  assert.ok(watcher, 'listening to the app');
  assert.equal(await checkForUpdate(), 'latest');
  assert.equal(applyUpdate(), false, 'nothing to take yet');
  // Coming down: shown as a version on its way.
  watcher({ state: 'downloading', version: '0.2.0', percent: 37 });
  assert.deepEqual(offline.downloading, { cached: 37, total: 100 });
  assert.equal(offline.updateReady, false);
  assert.equal(events.at(-1), 'progress');
  // Downloaded: ready to take, said once.
  watcher({ state: 'ready', version: '0.2.0' });
  assert.equal(offline.downloading, null);
  assert.equal(offline.updateReady, true);
  assert.equal(events.at(-1), 'update');
  watcher({ state: 'ready', version: '0.2.0' });
  assert.equal(events.filter((e) => e === 'update').length, 1);
  // Junk from the bridge changes nothing.
  for (const junk of [null, 'ready', { state: 'reboot' }]) watcher(junk);
  assert.equal(offline.app.state, 'ready');
  // Update: the app restarts into it.
  assert.equal(applyUpdate(), true);
  assert.equal(calls.install, 1);
  assert.equal(offline.updating, true);
  // Where the app can't install itself: Update opens the page, nothing restarting.
  offline.updating = false;
  watcher({ state: 'out', version: '0.3.0' });
  assert.equal(offline.updateReady, true);
  assert.equal(applyUpdate(), true);
  assert.equal(calls.install, 2);
  assert.equal(offline.updating, false);
  // Offline, it doesn't ask.
  navigator.onLine = false;
  assert.equal(await checkForUpdate(), 'offline');
  assert.equal(calls.check, 1);
  delete globalThis.slowTideDesktop;
});

test('the installers, the workflow and the download page agree on every file', () => {
  const pkg = JSON.parse(read('desktop/package.json'));
  const b = pkg.build;
  // What the app is made of: everything main.cjs needs, and the game.
  for (const f of ['main.cjs', 'preload.cjs', 'updates.cjs', 'package.json', 'game/**/*']) assert.ok(b.files.includes(f), f);
  assert.ok(pkg.dependencies['electron-updater'], 'the updater ships with the app');
  assert.ok(pkg.devDependencies.electron && pkg.devDependencies['electron-builder']);
  for (const v of [pkg.dependencies['electron-updater'], pkg.devDependencies.electron, pkg.devDependencies['electron-builder']]) assert.match(v, /^\d+\.\d+\.\d+$/, 'exact versions');
  assert.equal(pkg.productName, 'Slow Tide', 'the saves folder’s name (the download page says where)');
  // One target per computer, and the names the download page links to.
  assert.deepEqual(b.win.target.map((t) => t.target), ['nsis']);
  assert.deepEqual(b.mac.target.map((t) => t.target), ['dmg', 'zip'], 'the zip is what a Mac updates from');
  assert.deepEqual(b.linux.target.map((t) => t.target), ['AppImage']);
  const names = {
    'Slow-Tide-Setup-x64.exe': b.nsis.artifactName.replace('${arch}', 'x64').replace('${ext}', 'exe'),
    'Slow-Tide-arm64.dmg': b.dmg.artifactName.replace('${arch}', 'arm64').replace('${ext}', 'dmg'),
    'Slow-Tide-x64.dmg': b.dmg.artifactName.replace('${arch}', 'x64').replace('${ext}', 'dmg'),
    'Slow-Tide-x86_64.AppImage': b.linux.artifactName.replace('${arch}', 'x86_64').replace('${ext}', 'AppImage'),
  };
  for (const [want, got] of Object.entries(names)) assert.equal(got, want);
  const page = read('download.html');
  const links = [...page.matchAll(/href="(https:\/\/github\.com\/[^"]+)"/g)].map((m) => m[1]);
  const pub = b.publish[0];
  assert.equal(pub.provider, 'github');
  const repo = `https://github.com/${pub.owner}/${pub.repo}`;
  assert.equal(RELEASES, `${repo}/releases/latest`, 'the app’s download page link is the release feed’s own');
  for (const file of Object.keys(names)) assert.ok(links.includes(`${repo}/releases/latest/download/${file}`), `download.html links ${file}`);
  for (const l of links) assert.ok(l.startsWith(repo), l);
  // Where saves go, as the page says, is the app's own folder.
  for (const where of ['%APPDATA%\\Slow Tide\\saves', '~/Library/Application Support/Slow Tide/saves', '~/.config/Slow Tide/saves']) assert.ok(page.includes(where), where);
  // The page fetches nothing from anywhere else.
  assert.doesNotMatch(page, /fetch\(|<script[^>]+src=|<link[^>]+href="https?:/);
  // The workflow: on a version's tag (or by hand), each platform on its own runner, every
  // installer and the update feed on the release, signing only from secrets.
  const wf = read('.github/workflows/desktop.yml');
  assert.match(wf, /tags: \['v\*'\]/);
  assert.match(wf, /workflow_dispatch/);
  for (const os of ['windows-latest', 'macos-latest', 'ubuntu-latest']) assert.ok(wf.includes(`os: ${os}`), os);
  for (const glob of ['*.exe', '*.dmg', '*.zip', '*.AppImage', '*.blockmap', 'latest*.yml']) assert.ok(wf.includes(`desktop/dist/${glob}`), glob);
  assert.match(wf, /npm run pack/);
  assert.match(wf, /node tools\/build-sw\.mjs/);
  assert.match(wf, /--publish never/);
  assert.match(wf, /gh release create/);
  for (const s of ['WIN_CSC_LINK', 'MAC_CSC_LINK', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) assert.ok(wf.includes(`secrets.${s}`), s);
  assert.match(wf, /p\.unsigned=true/, 'an unsigned Mac build is told so');
  assert.doesNotMatch(wf, /pull_request_target/);
  // The lockfile is there for `npm ci`, and agrees with package.json.
  const lock = JSON.parse(read('desktop/package-lock.json'));
  assert.equal(lock.packages[''].dependencies['electron-updater'], pkg.dependencies['electron-updater']);
  assert.equal(lock.packages[''].devDependencies['electron-builder'], pkg.devDependencies['electron-builder']);
  assert.equal(lock.packages[''].devDependencies.electron, pkg.devDependencies.electron);
  // Built files never go in the repository.
  const ignore = read('.gitignore');
  for (const d of ['desktop/node_modules/', 'desktop/game/', 'desktop/dist/']) assert.ok(ignore.includes(d), d);
});
