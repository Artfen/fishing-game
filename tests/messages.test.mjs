// Messages and menus that don't get in the way (docs/IMPROVEMENTS.md): every sound the game asks
// for exists (being paid for a job was silent); a message stays up long enough to read; new
// settings follow the system's "reduce motion"; and a boat on hire counts as one you can use.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

test('every optional sound the game asks for exists (audio.X?.() never silently does nothing)', () => {
  const src = readFileSync('src/audio.js', 'utf8');
  const methods = new Set([...src.matchAll(/^ {2}(?:get |set |async )?([a-zA-Z_]\w*)\s*\(/gm)].map((m) => m[1]));
  for (const m of src.matchAll(/this\.([a-zA-Z_]\w*)\s*=/g)) methods.add(m[1]);
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js') && !p.endsWith('audio.js')) files.push(p); } };
  walk('src');
  const missing = [];
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\baudio\.([a-zA-Z_]\w*)\?\.\(/g)) if (!methods.has(m[1])) missing.push(`${m[1]} (${f})`);
  assert.deepEqual(missing, []);
});

test('a message stays up long enough to read it', async () => {
  globalThis.document ??= { getElementById: () => null };
  const { HUD } = await import('../src/ui.js');
  const h = Object.create(HUD.prototype);
  Object.assign(h, { toastQ: [], toastUp: null, quiet: () => false, toastShow(text, secs) { this.shown = secs; } });
  h.toast('Short.', 4);
  assert.equal(h.shown, 4, 'a short one keeps its time');
  h.toastUp = null;
  h.toast('x'.repeat(280), 12);
  assert.ok(h.shown >= 20, `280 characters: ${h.shown} s`);
  h.toastUp = null;
  h.toast('y'.repeat(140), 5);
  assert.ok(h.shown >= 10, `140 characters: ${h.shown} s`);
});

test('a night’s sleep drops the evening’s messages still waiting (a gale warning isn’t true by morning)', async () => {
  globalThis.document ??= { getElementById: () => null };
  const { HUD } = await import('../src/ui.js');
  const h = Object.create(HUD.prototype);
  const el = { toast: { classList: { remove() {} } } };
  Object.assign(h, { el, toastQ: [], toastUp: null, quiet: () => true, toastLater() {} });
  h.toast('The sky’s blackening to the south-west and the wind is rising: the gale’s an hour or so off.', 9);
  h.toast('The cabin boat: slow and steady.', 9);
  h.toast('The light turns gold. Some fish only stir after sundown.', 6);
  const src = readFileSync('src/main.js', 'utf8');
  const stale = new Function(`return ${src.match(/const STALE_BY_MORNING = (\(t\) => .*);/)[1]}`)();
  const gone = h.forget(stale);
  assert.equal(gone.length, 2, 'the warning and the dusk words');
  assert.deepEqual(h.toastQ.map((q) => q.text), ['The cabin boat: slow and steady.'], 'the tip still waits its turn');
  // The one up goes too, if it's out of date.
  h.toastUp = { text: 'Gale warning: a storm about 8 pm until 2 am.', at: 0, until: 1e9 };
  assert.deepEqual(h.forget(stale), ['Gale warning: a storm about 8 pm until 2 am.']);
  assert.equal(h.toastUp, null);
  assert.match(src, /for \(const t of hud\.forget\(STALE_BY_MORNING\)\)/, 'turning in forgets them');
});

test('new settings follow the system’s reduce-motion; a choice made stands', async () => {
  const { cleanSettings } = await import('../src/settings.js');
  const was = globalThis.matchMedia;
  try {
    globalThis.matchMedia = () => ({ matches: true });
    assert.equal(cleanSettings({}).controls.reducedMotion, true);
    assert.equal(cleanSettings({ controls: { reducedMotion: false } }).controls.reducedMotion, false);
    globalThis.matchMedia = () => ({ matches: false });
    assert.equal(cleanSettings({}).controls.reducedMotion, false);
  } finally {
    globalThis.matchMedia = was;
  }
});

test('a boat on hire today counts as one you can take (the board names it)', async () => {
  const { usable } = await import('../src/shipyard.js');
  const yard = { owned: ['row', 'skiff', 'kayak'], hired: { kind: 'cruiser', day: 7 }, looks: {}, fits: {} };
  assert.equal(usable(yard, 'cruiser', 7), true, 'hired today');
  assert.equal(usable(yard, 'cruiser', 8), false, 'not tomorrow');
  assert.equal(usable(yard, 'cruiser'), false, 'without the day it can’t know: the board must pass it');
  const src = readFileSync('src/main.js', 'utf8');
  assert.match(src, /usableBoat\(state\.yard, k, state\.day, ownAbs\(\)\)/, 'the board passes the day and the time (a hire runs 24 hours)');
});
