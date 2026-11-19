// Updates for the installed desktop app: when it starts it looks at the releases (the GitHub release
// feed electron-builder publishes beside the installers), and if there's a newer version it brings
// it down in the background and says so. It never restarts on its own: the game offers "Restart
// into the new version" (src/offline.js, the same Update button as the web version's), and a
// version that's downloaded and not taken is installed the next time the app is quit.
//
// What it won't do: look at all when it's switched off (settings.json in the app's data folder, from
// the journal or the macOS menu); look from a copy run straight from the repository (`npm start`);
// replace a Linux copy that isn't the AppImage. And a macOS build that isn't signed with a Developer
// ID can't install an update over itself (macOS checks the new app's signature against the old):
// there it only says a new version is out, and Update opens the download page.
//
// A stand-in feed for testing (SLOW_TIDE_UPDATE_FEED): only an address on this computer, never one
// elsewhere, so nothing outside can point the app at another feed. Every download is checked
// against the size and SHA-512 in the feed's own latest*.yml before anything is replaced.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RELEASES = 'https://github.com/Artfen/fishing-game/releases/latest';

function localFeed(url) {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) && /^(127\.0\.0\.1|localhost|\[::1\])$/.test(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}

// What a failed check says to the player: no connection, or something else.
const OFFLINE = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NETWORK_CHANGED|ERR_CONNECTION/;

function setupUpdates({
  app, ipcMain, shell,
  send = () => {},                 // (channel, data) to the game's window
  signed = true,                    // (a macOS build without a Developer ID can't update itself)
  env = process.env,
  platform = process.platform,
  load = () => require('electron-updater').autoUpdater,
  later = (fn, ms) => setTimeout(fn, ms),
  onChange = () => {},              // the switch changed (the macOS menu shows it)
} = {}) {
  const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
  const readSettings = () => {
    try {
      const s = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
      return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
    } catch {
      return {};
    }
  };
  const writeSettings = (s) => {
    try {
      fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
      const tmp = `${settingsFile()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
      fs.renameSync(tmp, settingsFile());
    } catch { /* stays as it was */ }
  };
  const auto = () => readSettings().updates !== false;
  const setAuto = (on) => {
    if (typeof on !== 'boolean') return auto();
    writeSettings({ ...readSettings(), updates: on });
    onChange(on);
    return auto();
  };

  // Whether this copy can update at all, and why not.
  const feed = env.SLOW_TIDE_UPDATE_FEED ? localFeed(env.SLOW_TIDE_UPDATE_FEED) : null;
  let updater = null, why = '';
  if (!app.isPackaged && !feed) why = 'not installed';
  else if (platform === 'linux' && !env.APPIMAGE) why = 'not the AppImage';
  else {
    try {
      updater = load();
    } catch {
      why = 'no updater';
    }
  }
  const installs = !(platform === 'darwin' && !signed);

  let status = updater ? { state: 'idle' } : { state: 'off', why };
  const tell = (s) => {
    status = s;
    try {
      send('updates:status', { ...status });
    } catch { /* the window's gone */ }
  };

  // A short log beside the save (updates.log, started afresh each run): what was found and done.
  const logFile = () => path.join(app.getPath('userData'), 'updates.log');
  let logged = 0;
  const log = (level) => (...parts) => {
    try {
      const line = `${new Date().toISOString()} ${level} ${parts.map((p) => (p instanceof Error ? p.message : typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
      if (logged++ === 0) fs.writeFileSync(logFile(), line);
      else if (logged < 400) fs.appendFileSync(logFile(), line);
    } catch { /* no log, no matter */ }
  };

  if (updater) {
    updater.autoDownload = installs;
    updater.autoInstallOnAppQuit = installs;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.logger = { info: log('info'), warn: log('warn'), error: log('error'), debug() {} };
    if (feed) {
      updater.setFeedURL({ provider: 'generic', url: feed });
      if (!app.isPackaged) updater.forceDevUpdateConfig = true;
    }
    let version = '';
    updater.on('checking-for-update', () => { if (!['downloading', 'ready', 'out'].includes(status.state)) tell({ state: 'checking' }); });
    updater.on('update-available', (info) => {
      version = String(info?.version || '');
      tell(installs ? { state: 'downloading', version, percent: 0 } : { state: 'out', version });
    });
    updater.on('update-not-available', () => tell({ state: 'latest', version: app.getVersion() }));
    updater.on('download-progress', (p) => {
      if (status.state === 'ready') return;
      tell({ state: 'downloading', version, percent: Math.max(0, Math.min(100, Math.round(Number(p?.percent) || 0))) });
    });
    updater.on('update-downloaded', (info) => tell({ state: 'ready', version: String(info?.version || version) }));
    updater.on('error', (err) => {
      if (status.state === 'ready' || status.state === 'out') return;
      tell({ state: OFFLINE.test(String(err?.message || err)) ? 'offline' : 'error', version });
    });
  }

  // Look now. Resolves with what's so: 'latest', 'downloading', 'ready', 'out', 'offline', 'error'
  // or 'off' (this copy doesn't update itself).
  let looking = null;
  function check() {
    if (!updater) return Promise.resolve('off');
    if (['downloading', 'ready', 'out'].includes(status.state)) return Promise.resolve(status.state);
    if (looking) return looking;
    looking = Promise.resolve()
      .then(() => updater.checkForUpdates())
      .then((r) => {
        if (!r) return 'off';
        const newer = r.isUpdateAvailable ?? (r.updateInfo?.version && r.updateInfo.version !== app.getVersion());
        if (!newer) return 'latest';
        return installs ? status.state === 'ready' ? 'ready' : 'downloading' : 'out';
      })
      .catch((err) => {
        const st = OFFLINE.test(String(err?.message || err)) ? 'offline' : 'error';
        if (!['downloading', 'ready', 'out'].includes(status.state)) tell({ state: st });
        return st;
      })
      .finally(() => { looking = null; });
    return looking;
  }

  // Take it: restart into the downloaded version (installed quietly, the game started again after),
  // or, where it can't install itself, the download page in the browser.
  function install() {
    if (status.state === 'ready' && updater) {
      try {
        updater.quitAndInstall(true, true);
        return 'restarting';
      } catch {
        return 'error';
      }
    }
    if (status.state === 'out') {
      try {
        shell?.openExternal(RELEASES);
      } catch { /* nothing to open with */ }
      return 'page';
    }
    return 'nothing';
  }

  // When the app starts (and only if it's switched on): a look after the game has loaded.
  function start() {
    if (!updater || !auto()) return false;
    const wait = feed && Number(env.SLOW_TIDE_UPDATE_DELAY) >= 0 ? Number(env.SLOW_TIDE_UPDATE_DELAY) * 1000 : 20000;
    later(() => { check(); }, wait);
    return true;
  }

  ipcMain.handle('updates:check', () => check());
  ipcMain.on('updates:status', (e) => { e.returnValue = { ...status }; });
  ipcMain.on('updates:install', () => { install(); });
  ipcMain.on('updates:auto', (e, on) => { e.returnValue = setAuto(on); });

  return { check, install, start, auto, setAuto, status: () => ({ ...status }), installs, updater, RELEASES };
}

module.exports = { setupUpdates, localFeed, RELEASES };
