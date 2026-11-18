// (W7) Rings on the water by a boat and the jetty, from above: a bobber twitching between them
// and a fish rising, played on for a few seconds, then pictured. On W7's code the rings are
// simulated (src/world/ripplegpu.js) and come back off her hull and the jetty; before it they
// were drawn, and ran through both. Calm water, noon, Ultra with Ocean: Full.
//
//   python3 -m http.server 8676 &
//   PLAYWRIGHT=/path/to/playwright node tools/rippleshots.mjs [url=http://127.0.0.1:8676/] [outdir=.] [only=regex]
//
// Software rendering here: the pictures say how it looks, not how fast it runs.
const PW = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = PW.chromium ? PW : PW.default;
const URL0 = process.argv[2] || 'http://127.0.0.1:8676/';
const OUT = process.argv[3] || '.';
const ONLY = process.argv[4] ? new RegExp(process.argv[4]) : null;
// The jetty runs north–south, its west face at x = 2.8, in 4 m of water; the boat lies 2.6 m west
// of it, heading north. bob: the bobber's spot, between them; rise: a fish rising (x, z, when, s);
// at: seconds played on before the picture; cam: the camera and what it looks at, from the
// bobber [x, height, z, x, height, z]. A low afternoon sun, so the sky's mirrored in the rings.
const SCENES = [
  { name: 'rings-jetty-3s', bob: [1.1, -1], rise: [0.6, 2.6, 0.5], at: 3, cam: [-1.5, 5.5, -6, 0.4, 0, 0.2] },
  { name: 'rings-jetty-9s', bob: [1.1, -1], rise: [0.6, 2.6, 0.5], at: 9, cam: [-1.5, 5.5, -6, 0.4, 0, 0.2] },
  { name: 'rings-jetty-low', bob: [1.1, -1], rise: [0.6, 2.6, 0.5], at: 9, cam: [-3, 1.6, -8.5, 1.2, 0, 1] },
];
const save = { game: 'slow-tide', version: 6, savedAt: 1, data: {
  quality: 'high', vessel: 'rib', mode: 'boat', day: 200, hour: 12, money: 4000,
  tips: { rowed: true, cast: true, caught: true, journal: true, ashore: true, style: true, pack: true, walked: true, binoculars: true, photoMode: true, favours: true },
  places: { camp: { day: 1, hour: 10 } }, yard: { owned: ['row', 'skiff', 'kayak', 'rib'] },
  settings: { player: { name: 'Mags' }, graphics: { preset: 'ultra', ocean: 'full' }, weather: { mode: 'clear', sea: 'auto', windMode: 'manual', windSpeed: 0.3, windFrom: 225 } } } };
const br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await br.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(new URL('README.md', URL0).href);
await page.evaluate((s) => localStorage.setItem('slow-tide-save', JSON.stringify(s)), save);
await page.goto(URL0, { timeout: 180000 });
await page.waitForFunction(() => window.slowTide && document.getElementById('start-btn'), null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('start-btn').click());
await page.waitForTimeout(1500);
await page.evaluate(() => { slowTide.paused = true; slowTide.state.contracts.callAt = 1e9; slowTide.hideHud(true); });
for (const S of SCENES) {
  if (ONLY && !ONLY.test(S.name)) continue;
  const info = await page.evaluate((S) => {
    slowTide.setWeather('clear');
    slowTide.setRain(0);
    slowTide.setWind(0.3 / 12, 225 * Math.PI / 180);
    slowTide.advance(30, 20, false);
    slowTide.setHour(16.5);
    // (Put there after the sea's settled, so she hasn't drifted onto the jetty.)
    slowTide.teleport(-1.2, -1, 0);
    slowTide.advance(2, 20, false);
    slowTide.clock.shown = null;
    slowTide.clock.sweeping = false;
    slowTide.advance(0.1, 20, true);
    const [bx, bz] = S.bob, sim = slowTide.rippleSim;
    const B = slowTide.boat.pos;
    // (The simulated square round the bobber, then the rings: the bobber twitched every 1.4 s,
    // the fish rising once.)
    const focus = () => sim?.on && sim.update(slowTide.renderer, bx, bz, slowTide.rippleHulls());
    focus();
    let t = 0, nextBob = 0, rose = false;
    while (t < S.at) {
      if (t >= nextBob) {
        slowTide.fx.ripple(bx, bz, 0.7, 1.2, 0.45);
        nextBob += 1.4;
      }
      if (!rose && t >= S.rise[2]) {
        slowTide.fx.ripple(S.rise[0], S.rise[1], 2.4, 1.8, 0.6);
        rose = true;
      }
      slowTide.advance(0.05, 20, false);
      focus();
      t += 0.05;
    }
    const C = S.cam;
    window.__view = [bx + C[0], C[1], bz + C[2], bx + C[3], C[4], bz + C[5]];
    slowTide.look(...window.__view);
    return { boat: [+B.x.toFixed(2), +B.z.toFixed(2)], sim: !!sim?.on, wind: +slowTide.conditions.wind.speed.toFixed(2) };
  }, S);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${S.name}.png`, timeout: 180000 });
  console.log(S.name, JSON.stringify(info));
}
console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no page errors');
await br.close();
