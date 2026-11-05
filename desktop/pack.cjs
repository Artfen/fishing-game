// Copies the game's files into desktop/game/ (what the desktop app serves): the same list the
// service worker caches for offline play (sw.js), so the desktop build is exactly the web game.
const fs = require('node:fs');
const path = require('node:path');

const repo = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');
const block = sw.match(/const FILES = \[([\s\S]*?)\];/)[1];
const list = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
const out = path.join(__dirname, 'game');
fs.rmSync(out, { recursive: true, force: true });
let n = 0;
for (const f of list) {
  const rel = f.replace(/^\.\//, '').replace(/^\//, '') || 'index.html';
  if (rel.endsWith('/')) continue;
  const from = path.join(repo, rel), to = path.join(out, rel);
  if (!fs.existsSync(from)) continue;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  n++;
}
console.log(`desktop/game: ${n} files`);
