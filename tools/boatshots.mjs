// The boat studio's pictures and figures (tools/boatstudio.html): for each boat of the fleet, a
// sheet of the six standard views (three-quarter front and rear, abeam, from above, at the helm,
// at the waterline) under the same light, the fleet side by side at one scale, and what each boat
// costs to draw. The before-and-after record for the fleet's art (docs/FLEET-AUDIT.md).
//
//   node tools/boatshots.mjs                       every boat, into docs/fleet/now/
//   node tools/boatshots.mjs --out docs/fleet/before --kinds bass,cabin
//   node tools/boatshots.mjs --light evening       (day, evening, overcast)
//   node tools/boatshots.mjs --stats               the figures only, printed
//
// Needs Playwright's Chromium (in this project's cloud sessions it's at the path below; elsewhere
// PLAYWRIGHT=… points at a playwright module). Software rendering: the pictures are faithful, the
// timings are not a real machine's (see docs/FLEET-AUDIT.md).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const arg = (name, d = null) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : d);
const out = join(root, arg('out', 'docs/fleet/now'));
const lightId = arg('light', 'day');
const statsOnly = process.argv.includes('--stats');
const pw = await import(process.env.PLAYWRIGHT ? pathToFileURL(process.env.PLAYWRIGHT).href : '/opt/node22/lib/node_modules/playwright/index.mjs');

// A plain static server over the repository (the studio imports the game's own modules).
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;

const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/tools/boatstudio.html`);
await page.waitForFunction(() => window.studio?.ready, null, { timeout: 120000 });
const all = await page.evaluate(() => window.studio.kinds);
const kinds = arg('kinds') ? arg('kinds').split(',') : all;

const stats = [];
if (!statsOnly) await mkdir(out, { recursive: true });
const jpeg = (url) => Buffer.from(url.split(',')[1], 'base64');
for (const k of kinds) {
  stats.push(await page.evaluate((k) => window.studio.stats(k), k));
  if (statsOnly) continue;
  const url = await page.evaluate(([k, l]) => window.studio.sheet(k, l), [k, lightId]);
  await writeFile(join(out, `${k}${lightId === 'day' ? '' : `-${lightId}`}.jpg`), jpeg(url));
}
if (!statsOnly && !arg('kinds')) {
  const order = ['kayak', 'windsurf', 'jetski', 'row', 'skiff', 'sail', 'bass', 'cabin', 'rib', 'console', 'cruiser'].filter((k) => all.includes(k));
  await writeFile(join(out, `fleet${lightId === 'day' ? '' : `-${lightId}`}.jpg`), jpeg(await page.evaluate(([o, l]) => window.studio.lineup(o, l), [order, lightId])));
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('boat', 22), pad('meshes', 7), pad('calls', 6), pad('tris', 7), pad('verts', 7), pad('mats', 5), pad('geos', 5), 'build ms');
for (const s of stats) console.log(pad(s.name, 22), pad(s.meshes, 7), pad(s.calls, 6), pad(s.tris, 7), pad(s.verts, 7), pad(s.materials, 5), pad(s.geometries, 5), s.buildMs);
if (!statsOnly) await writeFile(join(out, 'stats.json'), JSON.stringify(stats, null, 1) + '\n');
if (errors.length) console.log('page errors:', errors.slice(0, 5));
await browser.close();
server.close();
if (errors.length) process.exit(1);
