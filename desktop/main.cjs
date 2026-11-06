// Slow Tide as a desktop app: the game's own files (the folder above this one, copied in as
// `game/` by pack.cjs, or read straight from the repository while developing), served from a
// private `app://` address so nothing is fetched from the internet, in a window of its own.
//
// What a desktop build needs that a browser tab doesn't: the game must keep running at full speed
// when the window is behind another (no background throttling), WebGL must use the real graphics
// card, a controller works at once, and F11 goes full screen.
//
// The save is mirrored to a file in the app's data folder (saves/slow-tide-save.json), which Steam
// Auto-Cloud can carry between computers (set up in Steamworks: nothing to build). Achievements
// (src/achievements.js) go to Steamworks only if the optional steamworks.js binding is installed
// and the app id is given (STEAM_APP_ID, or a steam_appid.txt beside the app, as Steam provides):
// without both, they're simply dropped. Nothing here talks to any service by itself.

const { app, BrowserWindow, protocol, net, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

// The game's files: packed beside this file, or the repository while developing.
const packed = path.join(__dirname, 'game');
const ROOT = fs.existsSync(path.join(packed, 'index.html')) ? packed : path.join(__dirname, '..');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#16202b',
    autoHideMenuBar: true,
    title: 'Slow Tide',
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  // (Links out of the game open in the browser, never inside it.)
  win.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL('app://slow-tide/index.html');
}

// The save's file: written whole to a temporary file and then put in place, so a crash mid-write
// never leaves half a save; only text that reads as a save, and never anything huge.
const SAVE_DIR = () => path.join(app.getPath('userData'), 'saves');
const SAVE_FILE = () => path.join(SAVE_DIR(), 'slow-tide-save.json');
ipcMain.on('save:mirror', (e, text) => {
  try {
    if (typeof text !== 'string' || text.length > 20e6 || !text.startsWith('{')) return;
    JSON.parse(text);
    fs.mkdirSync(SAVE_DIR(), { recursive: true });
    const tmp = `${SAVE_FILE()}.tmp`;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, SAVE_FILE());
  } catch { /* the next save tries again */ }
});
ipcMain.on('save:read', (e) => {
  try {
    e.returnValue = fs.existsSync(SAVE_FILE()) ? fs.readFileSync(SAVE_FILE(), 'utf8') : null;
  } catch {
    e.returnValue = null;
  }
});

// Steamworks, only if it's there and there's an app id; otherwise achievements go nowhere.
let steam = null;
function startSteam() {
  try {
    const idFile = path.join(path.dirname(app.getPath('exe')), 'steam_appid.txt');
    const id = Number(process.env.STEAM_APP_ID || (fs.existsSync(idFile) ? fs.readFileSync(idFile, 'utf8').trim() : ''));
    if (!id) return;
    steam = require('steamworks.js').init(id);
  } catch {
    steam = null;
  }
}
ipcMain.on('steam:achieve', (e, id) => {
  try {
    if (steam && /^[A-Z0-9_]{2,40}$/.test(id)) steam.achievement.activate(id);
  } catch { /* not set up in Steamworks yet */ }
});

app.whenReady().then(() => {
  startSteam();
  // Files from the game folder only: anything outside it is refused.
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
