// Slow Tide as a desktop app: the game's own files (the folder above this one, copied in as
// `game/` by pack.cjs, or read straight from the repository while developing), served from a
// private `app://` address so nothing is fetched from the internet, in a window of its own.
//
// What a desktop build needs that a browser tab doesn't: the game must keep running at full speed
// when the window is behind another (no background throttling), WebGL must use the real graphics
// card, a controller works at once, and F11 goes full screen.
//
// The save is mirrored to a file in the app's data folder (saves/slow-tide-save.json): the journal's
// "Open the saves folder" (and the macOS menu) shows it. Updates come from the release feed beside
// the installers (updates.cjs): looked for when the app starts unless that's switched off, never
// installed without asking. Achievements (src/achievements.js) go to Steamworks only if the
// optional steamworks.js binding is installed and the app id is given (STEAM_APP_ID, or a
// steam_appid.txt beside the app): without both, they're simply dropped.

const { app, BrowserWindow, protocol, net, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { setupUpdates } = require('./updates.cjs');

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
    icon: path.join(ROOT, 'assets', 'icons', 'icon-512.png'),
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
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // (Nor does the page ever leave the game's own files.)
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://slow-tide/')) {
      e.preventDefault();
      if (/^https:\/\//.test(url)) shell.openExternal(url);
    }
  });
  win.loadURL('app://slow-tide/index.html');
}

// The save's file: written whole to a temporary file and then put in place, so a crash mid-write
// never leaves half a save; only text that reads as a save, and never anything huge.
const SAVE_DIR = () => path.join(app.getPath('userData'), 'saves');
// (Each of the game's save slots to its own file: Game 1's is slow-tide-save.json, the others
// slow-tide-save-2.json and -3.json. Only Game 1's starts a computer with no save of its own.)
const SAVE_FILE = (slot = 1) => path.join(SAVE_DIR(), slot > 1 ? `slow-tide-save-${slot}.json` : 'slow-tide-save.json');
ipcMain.on('save:mirror', (e, text, slot = 1) => {
  try {
    if (typeof text !== 'string' || text.length > 20e6 || !text.startsWith('{')) return;
    if (![1, 2, 3].includes(slot)) return;
    const n = slot;
    JSON.parse(text);
    fs.mkdirSync(SAVE_DIR(), { recursive: true });
    const tmp = `${SAVE_FILE(n)}.tmp`;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, SAVE_FILE(n));
  } catch { /* the next save tries again */ }
});
ipcMain.on('save:read', (e) => {
  try {
    e.returnValue = fs.existsSync(SAVE_FILE()) ? fs.readFileSync(SAVE_FILE(), 'utf8') : null;
  } catch {
    e.returnValue = null;
  }
});
// The saves folder, opened in the computer's own file browser.
function openSaves() {
  try {
    fs.mkdirSync(SAVE_DIR(), { recursive: true });
    shell.openPath(SAVE_DIR());
  } catch { /* nothing to open with */ }
}
ipcMain.on('saves:open', () => openSaves());

// Updates (updates.cjs). A macOS build made without a Developer ID says so in its package.json
// (`unsigned`, set by the build), and only points at the download page.
let meta = {};
try { meta = require('./package.json'); } catch { /* none */ }
const updates = setupUpdates({
  app, ipcMain, shell,
  signed: meta.unsigned !== true,
  send: (ch, data) => { for (const w of BrowserWindow.getAllWindows()) w.webContents.send(ch, data); },
  onChange: () => buildMenu(),
});

// The menu: on macOS the app's own (About, updates, the saves folder, and the usual Edit and
// Window menus so copy and paste work in the game's text boxes); on Windows and Linux none at
// all, so no key the game uses opens a menu or reloads the page. (The journal has the same
// things: the saves folder and the updates switch.)
function buildMenu() {
  if (!Menu) return;
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Check for Updates…', click: () => updates.check() },
        { label: 'Look for Updates When It Starts', type: 'checkbox', checked: updates.auto(), click: (item) => updates.setAuto(item.checked) },
        { label: 'Open the Saves Folder', click: openSaves },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
  ]));
}

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
  buildMenu();
  // Files from the game folder only: anything outside it is refused.
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    // (A file the game asks for and doesn't have, like the web version's cloud-save settings, is
    // simply not there: the game carries on without it.)
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  updates.start();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
