// Under way on her autopilot, a menu open (the map, the pack, the journal): she keeps on at her
// notch, on her course; and on a controller, no mouse pointer on the screen (docs/LIVEABOARD.md,
// "A menu open"; docs/IMPROVEMENTS.md). Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');

test('her autopilot steering her, a menu leaves her engine at its notch and her helm alone', () => {
  // (Her own autopilot, at her helm: not ashore, in the cabin, driving or diving.)
  assert.match(main, /const autoHelm = !!\(pilot\.on && pilot\.id === boat\.id && !onFoot && !cabinIn && !driving && !dive && leverKind\(\)\);/);
  // The keys and stick go to the menu, not the helm (no notch stepped down by them).
  assert.match(main, /if \(started && \(!modal \|\| \(mapAboard\(\) && !autoHelm\)\)\) \{/);
  // Her throttle stays where it is; only travelling (you leave her) or sleeping (anchored) stops it.
  assert.match(main, /if \(modal && autoHelm && modal !== 'travel' && modal !== 'sleep'\) throttle = boat\.lever;\n\s*else if \(boat\.motor && \(onFoot \|\| \(modal && !mapAboard\(\)\) \|\| cabinIn\)\) throttle = 0;/);
});

test('on a controller the mouse pointer goes; a real move of the mouse brings it back', () => {
  assert.match(main, /pads\.onActive = \(\) => hidePointer\(true\);/);
  assert.match(main, /hidePointer\(m === 'pad'\);/);
  assert.match(main, /addEventListener\('mousemove', \(e\) => \{\s*if \(pointerHidden && Math\.abs\(e\.movementX\) \+ Math\.abs\(e\.movementY\) > 4\) hidePointer\(false\);/);
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /body\.no-pointer, body\.no-pointer \* \{ cursor: none !important; \}/);
  const pad = fs.readFileSync(path.join(root, 'src/gamepad.js'), 'utf8');
  assert.match(pad, /if \(any\) this\.onActive\?\.\(\);/);
});
