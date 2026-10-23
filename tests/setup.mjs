// Lets the game's modules run under Node's test runner with nothing installed: `three` comes
// from vendor/, and the game's .js files load as ES modules. Used as `node --import ./tests/setup.mjs`.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);

// A stand-in for the browser's local storage (each test can swap in a fresh one).
class MemoryStorage {
  constructor() { this.map = new Map(); this.full = false; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    if (this.full) throw new Error('QuotaExceededError');
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
globalThis.MemoryStorage = MemoryStorage;
globalThis.localStorage = new MemoryStorage();
