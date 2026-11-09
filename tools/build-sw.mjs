// Writes the list of files the game needs (and a version made from their contents) into
// sw.js, so the service worker can store the whole game for offline play and knows when a
// new version has been deployed; and the same version into src/version.js, for the title
// screen.
//
//   node tools/build-sw.mjs          update sw.js
//   node tools/build-sw.mjs --check  exit with an error if sw.js is out of date
//
// Vercel runs this on every deploy (see vercel.json). Run it yourself before uploading the
// game anywhere else.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');

// Everything the game loads while it runs. (The link-preview image, docs, the server
// function and the database script are not needed to play.)
const INCLUDE = [
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'src',
  'vendor/three/three.module.min.js',
  'assets/fonts',
  'assets/icons',
];
const SKIP = /\.(txt|md)$/;

function walk(path, out) {
  const full = join(root, path);
  if (statSync(full).isDirectory()) {
    for (const name of readdirSync(full).sort()) walk(join(path, name), out);
  } else if (!SKIP.test(path)) out.push(path.split(sep).join('/'));
  return out;
}

const files = INCLUDE.flatMap((p) => walk(p, []));
// (src/version.js carries the version itself, so it's left out of what the version is made from.)
const VERSION_FILE = 'src/version.js';
const hash = createHash('sha256');
for (const f of files) if (f !== VERSION_FILE) hash.update(f).update(readFileSync(join(root, f)));
const version = hash.digest('hex').slice(0, 12);

// The title screen's version (src/version.js): the build, and the day it was first built (kept
// while the build stays the same, so running this again changes nothing).
const vPath = join(root, VERSION_FILE);
const vSrc = readFileSync(vPath, 'utf8');
const was = vSrc.match(/BUILD = '([^']*)'[\s\S]*?BUILT = '([^']*)'/);
const built = was && was[1] === version && was[2] ? was[2] : new Date().toISOString().slice(0, 10);
const vBlock = [
  '// <build> Written by tools/build-sw.mjs: do not edit by hand.',
  `export const BUILD = '${version}';`,
  `export const BUILT = '${built}';`,
  '// </build>',
].join('\n');
const vNext = vSrc.replace(/\/\/ <build>[\s\S]*?\/\/ <\/build>/, vBlock);
if (!vNext.includes(vBlock)) throw new Error('src/version.js has no <build> block');

const block = [
  '// <precache> Written by tools/build-sw.mjs: do not edit by hand.',
  `const VERSION = '${version}';`,
  'const FILES = [',
  ...files.map((f) => `  './${f}',`),
  '];',
  '// </precache>',
].join('\n');

const swPath = join(root, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
const next = sw.replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, block);
if (!next.includes(block)) throw new Error('sw.js has no <precache> block');

if (process.argv.includes('--check')) {
  if (next !== sw || !vSrc.includes(`BUILD = '${version}'`)) {
    console.error('sw.js or src/version.js is out of date: run node tools/build-sw.mjs');
    process.exit(1);
  }
  console.log(`sw.js is up to date (version ${version}, ${files.length} files)`);
} else {
  if (next !== sw) writeFileSync(swPath, next);
  if (vNext !== vSrc) writeFileSync(vPath, vNext);
  console.log(`sw.js: version ${version}, ${files.length} files (${relative(root, swPath)})`);
}
