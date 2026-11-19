// What the game page may ask of the desktop app (src/desktop.js and src/offline.js use it): nothing
// more than these. The page itself stays sandboxed, with no Node and no file access of its own.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('slowTideDesktop', {
  // The save, mirrored to a file in the app's data folder.
  mirror: (text) => ipcRenderer.send('save:mirror', String(text)),
  // The mirrored save, when this computer's storage has none (or null).
  mirrored: () => ipcRenderer.sendSync('save:read'),
  // An achievement earned (achievements.js): passed to Steamworks if the app has it.
  achieve: (id) => ipcRenderer.send('steam:achieve', String(id)),
  // The saves folder, opened in the computer's file browser.
  openSaves: () => ipcRenderer.send('saves:open'),
  // Updates (desktop/updates.cjs): what's so now, look now, take the new version, the switch for
  // looking when the app starts, and word of each change.
  updates: {
    status: () => ipcRenderer.sendSync('updates:status'),
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.send('updates:install'),
    auto: (on) => ipcRenderer.sendSync('updates:auto', typeof on === 'boolean' ? on : null),
    watch: (fn) => {
      ipcRenderer.removeAllListeners('updates:status');
      ipcRenderer.on('updates:status', (e, s) => fn(s));
    },
  },
});
