// Before-and-after measurements in a real browser (see docs/IMPROVEMENTS.md): the game served
// locally (python3 serve.py, or any static server), each scenario set up the same way every time,
// and for each:
//   sim      the game's simulation alone, ms a frame (mean and the worst 1%), 240 frames at 30 Hz
//   frames   real frames running free for a few seconds: mean fps and the 1% low
//   draws    draw calls and triangles in a frame
//   heap     JS heap after a garbage collection, and how much it grew over the scenario
//
//   PLAYWRIGHT=/path/to/playwright node tools/perf.mjs [url=http://127.0.0.1:8642/] [scenario…]
//
// On a machine without a graphics card (software rendering) the frame rate is far below a real
// computer's: compare runs on the same machine only. The simulation numbers are CPU work and carry
// over better.

// (Playwright's CommonJS entry, imported from here, may put everything under default.)
const PW = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = PW.chromium ? PW : PW.default;
const args = process.argv.slice(2);
const URL = args.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8642/';
const only = args.filter((a) => !a.startsWith('http'));

const TIPS = { rowed: true, cast: true, caught: true, journal: true, ashore: true, style: true, pack: true, walked: true, board: true, havenTip: true };
// (The Low preset and a small window by default: software rendering is slow, and the simulation's
// cost doesn't depend on them. PERF_PRESET and PERF_SIZE=WxH to change.)
const PRESET = process.env.PERF_PRESET || 'low';
const [VW, VH] = (process.env.PERF_SIZE || '800x450').split('x').map(Number);
const base = (over = {}) => {
  const settings = { player: { name: 'Perf' }, graphics: { preset: PRESET }, ...(over.settings || {}) };
  return { quality: PRESET, vessel: 'row', mode: 'boat', day: 13, tips: TIPS, places: { camp: { day: 1, hour: 10 } }, ...over, settings };
};

// Each: the save to start from, and what to do once started (in the page).
const SCENARIOS = {
  harbour: { save: base({ mode: 'foot', walker: { x: 6, z: -96, heading: Math.PI } }), setup: () => { slowTide.setHour(10.5); slowTide.walkTo(6, -96, Math.PI); } },
  rib_rough: {
    save: base({ settings: { weather: { sea: 'lively', windMode: 'manual', windSpeed: 11, windFrom: 225 } } }),
    setup: () => { slowTide.state.yard.owned.push('rib'); slowTide.setHour(12); slowTide.useSkiffAt(150, 420, 0.3, 'rib'); slowTide.boat.lever = 1; },
  },
  // The bass boat under way in open water on a fair day (the fleet's art: docs/FLEET-AUDIT.md).
  bass: {
    save: base(),
    setup: () => { slowTide.state.yard.owned.push('bass'); slowTide.setHour(12); slowTide.useSkiffAt(150, 420, 0.3, 'bass'); slowTide.boat.lever = 1; },
  },
  // The cabin boat under way, the same; her old cuddy for comparison by the address's
  // ?classic=cabin (see boat.js CLASSIC).
  cabin: {
    save: base(),
    setup: () => { slowTide.state.yard.owned.push('cabin'); slowTide.setHour(12); slowTide.useSkiffAt(150, 420, 0.3, 'cabin'); slowTide.boat.lever = 1; },
  },
  shoal: {
    save: base(),
    setup: () => {
      slowTide.setHour(9);
      const S = slowTide.eco.schools.filter((s) => s.members?.length).sort((a, b) => b.members.length - a.members.length)[0];
      slowTide.useSkiffAt((S?.x ?? 60) + 12, (S?.z ?? 160) + 12, 0, 'skiff');
    },
  },
  wildlife: {
    save: base(),
    setup: () => {
      slowTide.state.yard.owned.push('rib');
      slowTide.setHour(11);
      const p = slowTide.sealife.pods.find((q) => q.sea === 'home') || { x: 200, z: 600 };
      slowTide.useSkiffAt(p.x + 25, p.z + 25, 0, 'rib');
    },
  },
  electronics: {
    save: base(),
    setup: () => { slowTide.state.yard.owned.push('rib'); slowTide.setHour(11); slowTide.useSkiffAt(60, 160, 0, 'rib'); slowTide.firstPerson(true); if (slowTide.finder && !slowTide.finder.visible) slowTide.finder.toggle?.(); },
  },
  underwater: {
    save: base(),
    setup: () => { slowTide.setHour(12); slowTide.useSkiffAt(98, 82, 0, 'skiff'); slowTide.boat.setAnchor(true); },
    after: () => slowTide.diving.start('scuba'),
  },
};

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'] });
const out = {};
for (const [name, S] of Object.entries(SCENARIOS)) {
  if (only.length && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(new globalThis.URL('README.md', URL).href);
  await page.evaluate((data) => localStorage.setItem('slow-tide-save', JSON.stringify({ game: 'slow-tide', version: 6, savedAt: 1, data })), S.save);
  await page.goto(URL, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { document.getElementById('start-btn').click(); slowTide.paused = true; });
  await page.evaluate(S.setup);
  await page.evaluate(() => slowTide.advance(2, 30, false));
  if (S.after) { await page.evaluate(S.after); await page.evaluate(() => slowTide.advance(2, 30, false)); }
  // Let anything that loads lazily settle, then the heap.
  await page.evaluate(() => slowTide.advance(3, 30, true));
  const heap0 = await page.evaluate(() => { globalThis.gc?.(); return performance.memory?.usedJSHeapSize || 0; });
  // The simulation alone.
  const sim = await page.evaluate(() => {
    const xs = [];
    for (let i = 0; i < 240; i++) {
      const t0 = performance.now();
      slowTide.advance(1 / 30, 30, false);
      xs.push(performance.now() - t0);
    }
    return xs;
  });
  // A frame's draw calls.
  const info = await page.evaluate(() => {
    const R = slowTide.renderer;
    R.info.autoReset = false;
    R.info.reset();
    slowTide.advance(1 / 30, 30, true);
    const r = { calls: R.info.render.calls, triangles: R.info.render.triangles, geometries: R.info.memory.geometries, textures: R.info.memory.textures, programs: R.info.programs?.length || 0 };
    R.info.autoReset = true;
    return r;
  });
  // Real frames, running free.
  const frames = await page.evaluate(() => new Promise((res) => {
    const xs = [];
    let last = performance.now();
    slowTide.paused = false;
    const step = (now) => {
      xs.push(now - last);
      last = now;
      if (xs.length < 45) requestAnimationFrame(step);
      else { slowTide.paused = true; res(xs.slice(5)); }
    };
    requestAnimationFrame(step);
  }));
  const heap1 = await page.evaluate(() => { globalThis.gc?.(); return performance.memory?.usedJSHeapSize || 0; });
  out[name] = {
    simMs: +mean(sim).toFixed(2), simP99: +pct(sim, 0.99).toFixed(2),
    fps: +(1000 / mean(frames)).toFixed(1), fps1Low: +(1000 / pct(frames, 0.99)).toFixed(1),
    calls: info.calls, tris: info.triangles, geometries: info.geometries, textures: info.textures, programs: info.programs,
    heapMB: +(heap0 / 1048576).toFixed(1), heapGrowMB: +((heap1 - heap0) / 1048576).toFixed(2),
    errors: errors.length,
  };
  console.log(name, JSON.stringify(out[name]));
  await page.close();
}
await browser.close();
if (process.env.PERF_OUT) (await import('node:fs')).writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 2));
