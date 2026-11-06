// What the game page may ask of the desktop app (src/desktop.js uses it): nothing more than these
// three. The page itself stays sandboxed, with no Node and no file access of its own.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('slowTideDesktop', {
  // The save, mirrored to a file in the app's data folder (Steam Auto-Cloud carries that folder).
  mirror: (text) => ipcRenderer.send('save:mirror', String(text)),
  // The mirrored save, when this computer's storage has none (or null).
  mirrored: () => ipcRenderer.sendSync('save:read'),
  // An achievement earned (achievements.js): passed to Steamworks if the app has it.
  achieve: (id) => ipcRenderer.send('steam:achieve', String(id)),
});
