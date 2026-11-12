// Every one of the game's modules parses as the browser parses it (an ES module), including the ones
// no other test loads because they need a page (main.js, the panels): a slip there (two imports
// bound to one name, a stray bracket) would only show as a game that never starts. Checked with
// Node's own parser, module by module, nothing run.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../src/', import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js')) files.push(p);
  }
})(root);

test('every module in src/ parses as an ES module', () => {
  assert.ok(files.length > 50);
  const bad = [];
  for (const f of files) {
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: readFileSync(f), encoding: 'utf8' });
    if (r.status !== 0) bad.push(`${f.slice(root.length)}: ${(r.stderr.match(/SyntaxError[^\n]*/) || [r.stderr.trim().split('\n').pop()])[0]}`);
  }
  assert.deepEqual(bad, []);
});
