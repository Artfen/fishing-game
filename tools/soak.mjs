// A long session (docs/PERFORMANCE.md): an hour of varied play run through the game's own
// clock, in a real browser, with the memory and the graphics resources it holds sampled after
// every lap, so a leak shows as a line that keeps climbing rather than a level that settles.
//
//   PLAYWRIGHT=/path/to/playwright node tools/soak.mjs [url=http://127.0.0.1:8642/] [laps=10]
//
// A lap is about six minutes of the game's time: ashore in Willowhaven, the RIB flat out round
// the bay, a dive on the wreck, south to Las Brasas and a dive on its arches, home again, the
// hours moving on (day and night) and the weather turning (a storm every third lap). Each lap
// samples, after a garbage collection: the JS heap, the geometries, textures and shader
// programs the renderer holds, the distinct geometries the scene itself has (inScene), the objects
// in the scene and the page's elements. The first lap warms up; after it, the figures should
// settle. The renderer uploads a geometry the first time it's drawn, so its count climbs for a
// while as play reaches more of the world (other hours, other weather, folk walking into view):
// that's only a leak if it passes what the scene has, or if the scene's own count keeps climbing.
// It ends with the growth from lap 2 to the last, per lap, and fails (exit 1) on a leak (the
// heap, the scene's objects or its geometries rising every lap; the renderer holding more
// geometries than the scene has) or a page error.
//
// Software rendering here, so wall time is long (about four minutes a lap) and frame times mean
// nothing; what's measured is what the game holds on to, which doesn't depend on the graphics card.

const PW = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = PW.chromium ? PW : PW.default;
const args = process.argv.slice(2);
const URL0 = args.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8642/';
const LAPS = +(args.find((a) => /^\d+$/.test(a)) || 10);
const { benchSave } = await import(new globalThis.URL('../src/bench.js', import.meta.url).href);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.setDefaultTimeout(0); // (a lap is a long evaluate)
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
await page.evaluate((data) => localStorage.setItem('slow-tide-save', JSON.stringify({ game: 'slow-tide', version: 6, savedAt: 1, data })), benchSave({}, 'low'));
await page.reload({ waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.slowTide && document.getElementById('start-btn'), null, { timeout: 120000 });
await page.evaluate(() => {
  document.getElementById('start-btn').click();
  slowTide.paused = true;
  slowTide.state.yard.owned.push('rib');
});

// Run the game for `s` seconds of its time at 30 Hz, a frame drawn every `every` seconds (what's
// drawn is what makes the renderer build geometries, textures and programs).
const run = (s, every = 5) => page.evaluate(([s, every]) => {
  for (let t = 0; t < s; t += every) slowTide.advance(Math.min(every, s - t), 30, true);
}, [s, every]);
const step = (fn, arg) => page.evaluate(fn, arg);

// One lap of play.
async function lap(i) {
  const storm = i % 3 === 2;
  await step((storm) => { slowTide.setWeather(storm ? 'storm' : 'auto'); slowTide.setHour((slowTide.state.hour + 4) % 24); }, storm);
  // Ashore in the harbour.
  await step(() => slowTide.walkTo(6, -96, Math.PI));
  await run(45);
  // The RIB flat out round the bay, turning.
  await step(() => { slowTide.useSkiffAt(150, 420, 0.3, 'rib'); slowTide.boat.lever = 1; });
  for (let k = 0; k < 4; k++) {
    await step((k) => { slowTide.input.virtual.steer = k % 2 ? 0.5 : -0.4; }, k);
    await run(25);
  }
  await step(() => { slowTide.boat.lever = 0; slowTide.input.virtual.steer = 0; });
  // A dive on the wreck.
  await step(() => { slowTide.useSkiffAt(98, 82, 0, 'skiff'); slowTide.boat.setAnchor(true); slowTide.diving.start('scuba'); });
  await run(45);
  await step(() => slowTide.diving.end());
  await run(5);
  // South: Las Brasas, a dive on the arches.
  await step(() => { slowTide.useSkiffAt(-446, 6522, 0, 'skiff'); slowTide.boat.setAnchor(true); });
  await run(20);
  await step(() => slowTide.diving.start('scuba'));
  await run(40);
  await step(() => slowTide.diving.end());
  // Home, under way.
  await step(() => { slowTide.boat.setAnchor(false); slowTide.useSkiffAt(150, 420, 0.3, 'rib'); slowTide.boat.lever = 0.6; });
  await run(60);
  await step(() => { slowTide.boat.lever = 0; });
}

// What the game holds now, after a garbage collection.
const sample = () => page.evaluate(() => {
  globalThis.gc?.();
  const R = slowTide.renderer, M = R.info.memory;
  let objects = 0;
  const geos = new Set();
  slowTide.scene.traverse((o) => {
    objects++;
    if (o.geometry) geos.add(o.geometry);
  });
  return {
    heapMB: +((performance.memory?.usedJSHeapSize || 0) / 1048576).toFixed(1),
    geometries: M.geometries,
    inScene: geos.size,
    textures: M.textures,
    programs: R.info.programs?.length ?? 0,
    objects,
    elements: document.getElementsByTagName('*').length,
    hour: +slowTide.state.hour.toFixed(1),
    region: slowTide.region?.id ?? slowTide.region ?? '',
  };
});

const rows = [];
const t0 = Date.now();
for (let i = 0; i < LAPS; i++) {
  await lap(i);
  const s = { lap: i + 1, ...(await sample()), wallS: Math.round((Date.now() - t0) / 1000) };
  rows.push(s);
  console.log(JSON.stringify(s));
}
await browser.close();

// Growth from lap 2 (warmed up) to the last, per lap; and whether it grew every lap.
const keys = ['heapMB', 'geometries', 'inScene', 'textures', 'programs', 'objects', 'elements'];
const from = rows[Math.min(1, rows.length - 1)], to = rows[rows.length - 1], laps = Math.max(1, to.lap - from.lap);
const report = {};
let bad = false;
for (const k of keys) {
  const per = (to[k] - from[k]) / laps;
  const tail = rows.slice(1);
  const always = tail.length > 3 && tail.every((r, j) => j === 0 || r[k] > tail[j - 1][k]);
  // (A heap's figure wanders a few MB; the scene's objects or its own geometries rising every lap
  // are a leak. The renderer's geometries and programs climb as more of the world is first drawn,
  // and textures with them: judged against what the scene has, below.)
  const leak = k === 'heapMB' ? always && per > 1 : (k === 'objects' || k === 'inScene') && always;
  report[k] = { first: from[k], last: to[k], perLap: +per.toFixed(2), climbing: always };
  if (leak) bad = true;
}
// (Uploaded more geometries than the scene has: some are held on to after they've left it.)
const over = rows.some((r) => r.geometries > r.inScene);
if (over) bad = true;
console.log(JSON.stringify({ laps: rows.length, report, uploadedPastScene: over, leak: bad, errors: errors.length, firstErrors: errors.slice(0, 5) }, null, 1));
if (bad || errors.length) process.exitCode = 1;
