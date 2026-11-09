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

test('the title screen’s version: the same build as the offline copy, and a release number', async () => {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const { RELEASE, BUILD, BUILT } = await import('../src/version.js');
  assert.equal(sw.match(/const VERSION = '([0-9a-f]+)'/)[1], BUILD);
  assert.ok(Number.isInteger(RELEASE) && RELEASE > 0);
  assert.match(BUILT, /^\d{4}-\d{2}-\d{2}$/);
});
