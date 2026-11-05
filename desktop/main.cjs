// Slow Tide as a desktop app: the game's own files (the folder above this one, copied in as
// `game/` by pack.cjs, or read straight from the repository while developing), served from a
// private `app://` address so nothing is fetched from the internet, in a window of its own.
//
// What a desktop build needs that a browser tab doesn't: the game must keep running at full speed
// when the window is behind another (no background throttling), WebGL must use the real graphics
// card, a controller works at once, and F11 goes full screen. Steam's overlay, achievements and
// cloud saves come with a Steamworks binding (steamworks.js, MIT) once there's a Steam app id: see
// README.md in this folder. Nothing here talks to any service.

const { app, BrowserWindow, protocol, net } = require('electron');
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

app.whenReady().then(() => {
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
