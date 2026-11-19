// The desktop build's bridge, from the game's side: window.slowTideDesktop, put there by the
// desktop app's preload (desktop/preload.cjs). In a browser it isn't there and all of this does
// nothing.
//
//  · The save, mirrored to a file in the app's data folder on every save (the journal opens that
//    folder). Starting on a computer with no save in its storage, the mirrored file is used.
//  · Its updates (desktop/updates.cjs): the switch for looking when it starts. (Looking, and taking
//    a new version, go through the Update button: src/offline.js.)
//  · Achievements (achievements.js), handed over as they're earned; the app passes them to
//    Steamworks only if it has it and an app id.

import { earned } from './achievements.js';

const bridge = () => globalThis.slowTideDesktop || null;
export const onDesktop = () => !!bridge();

// Before the game loads: a save from the mirrored file if this computer has none of its own.
// store: { get(key), set(key, value) }. Returns true if it put one there.
export function seedSave(store, key) {
  const D = bridge();
  if (!D?.mirrored) return false;
  try {
    if (store.get(key)) return false;
    const text = D.mirrored();
    if (typeof text !== 'string' || !text.startsWith('{')) return false;
    JSON.parse(text);
    store.set(key, text);
    return true;
  } catch {
    return false;
  }
}

// After a save: the same text to the file.
export function mirrorSave(text) {
  const D = bridge();
  if (!D?.mirror || typeof text !== 'string') return false;
  try {
    D.mirror(text);
    return true;
  } catch {
    return false;
  }
}

// Now and then: any achievement earned and not yet handed over this session.
const told = new Set();
export function reportAchievements(state, extra = {}) {
  const D = bridge();
  if (!D?.achieve) return [];
  const fresh = earned(state, extra).filter((id) => !told.has(id));
  for (const id of fresh) {
    told.add(id);
    try {
      D.achieve(id);
    } catch { /* the app will be told again next session */ }
  }
  return fresh;
}
export const _resetTold = () => told.clear();

// The saves folder, opened on the computer (the journal's button). False where there's none.
export function openSavesFolder() {
  const D = bridge();
  if (!D?.openSaves) return false;
  try {
    D.openSaves();
    return true;
  } catch {
    return false;
  }
}

// Whether the app looks for a new version when it starts; with true or false, sets it first.
// Null in a browser (or an app without updates).
export function updatesWhenStarting(on) {
  const D = bridge();
  if (typeof D?.updates?.auto !== 'function') return null;
  try {
    const r = D.updates.auto(typeof on === 'boolean' ? on : null);
    return typeof r === 'boolean' ? r : null;
  } catch {
    return null;
  }
}
