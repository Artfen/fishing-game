// Offline play depends on sw.js listing every file the game loads: a module added without
// rebuilding the list would be missing offline. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = join(fileURLToPath(import.meta.url), '..', '..');

test('every game module is in the offline file list', () => {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));
  for (const f of walk('src')) assert.ok(sw.includes(`'./${f}'`), `${f} is missing from sw.js`);
});

test('sw.js is up to date with the files (run node tools/build-sw.mjs if not)', () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, [join(root, 'tools/build-sw.mjs'), '--check'], { stdio: 'pipe' }));
});
