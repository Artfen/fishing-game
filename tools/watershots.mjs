// The sea, close up, in the same views every time (docs/WATER.md), on a spring day (sunrise about
// 05:10, sunset 20:15): a calm morning, a breeze at noon, a fresh breeze in the afternoon, dusk and a storm, looking towards the sun, away from it,
// across and down, on Ultra graphics with Ocean: Full. For before-and-after pictures of the water.
//
//   python3 -m http.server 8676 &
//   PLAYWRIGHT=/path/to/playwright node tools/watershots.mjs [url=http://127.0.0.1:8676/] [outdir=.] [only=regex]
//
// Software rendering here: the pictures say how it looks, not how fast it runs.
const PW = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = PW.chromium ? PW : PW.default;
const URL0 = process.argv[2] || 'http://127.0.0.1:8676/';
const OUT = process.argv[3] || '.';
const ONLY = process.argv[4] ? new RegExp(process.argv[4]) : null;
const SCENES = [
  // name, wind m/s, wind from (deg), hour, weather, camera spot [x,z], camera height, view: 'sun' | 'away' | 'cross' | 'down', pitch down (rad)
  { name: 'calm-morning-sun', wind: 1.5, hour: 6.4, x: -60, z: 450, h: 2.2, view: 'sun', pitch: 0.05 },
  { name: 'calm-morning-away', wind: 1.5, hour: 6.4, x: -60, z: 450, h: 2.2, view: 'away', pitch: 0.08 },
  { name: 'breeze-noon-cross', wind: 7, hour: 12.5, x: -60, z: 450, h: 2.6, view: 'cross', pitch: 0.12 },
  { name: 'breeze-noon-down', wind: 7, hour: 12.5, x: -60, z: 450, h: 1.6, view: 'cross', pitch: 0.55 },
  { name: 'fresh-sunset-sun', wind: 11, hour: 19.5, x: -60, z: 450, h: 2.6, view: 'sun', pitch: 0.04 },
  { name: 'fresh-afternoon-away', wind: 11, hour: 15.5, x: -60, z: 450, h: 3, view: 'away', pitch: 0.1 },
  { name: 'fresh-afternoon-down', wind: 11, hour: 15.5, x: -60, z: 450, h: 2.4, view: 'cross', pitch: 0.42 },
  { name: 'storm', wind: 20, hour: 13, weather: 'storm', x: -60, z: 450, h: 4, view: 'cross', pitch: 0.08 },
  // (W6) A gale and a near gale with no storm in the sky: looking across the wind (blowing towards
  // −x −z here), low over the water, at the crests breaking and what the wind tears off them, and
  // down at the whitecaps on the crests and the foam streaks on the water.
  // (atCam: from where the game's own camera is, which is what the spray forms round: [height,
  // how far off it looks across the wind, and down to what height].)
  { name: 'gale-across', wind: 18.5, hour: 13, x: -60, z: 450, atCam: [2.6, 20, 0.8] },
  { name: 'neargale-across', wind: 15, hour: 13, x: -60, z: 450, atCam: [2.6, 20, 0.8] },
  { name: 'gale-down', wind: 18.5, hour: 13, x: -60, z: 450, atCam: [6, 14, -1] },
  // (W4) The shallows off the beach east of the camp (dry at z 32, 8 m down by z 58): looking down
  // into a metre or three of water, and in from 9 m over the sand to the beach. at: the camera
  // and what it looks at, in place of the view.
  { name: 'shallows-noon-down', wind: 3, hour: 12.5, x: 100, z: 52, at: [96, 3.2, 47, 100, -1.6, 37] },
  { name: 'shallows-noon-in', wind: 3, hour: 12.5, x: 100, z: 76, at: [100, 4.2, 74, 100, -0.4, 34] },
  { name: 'shallows-evening-in', wind: 3, hour: 18.5, x: 100, z: 76, at: [100, 4.2, 74, 100, -0.4, 34] },
  // (The same shallows as clear as Las Brasas' water: clear, its clarity on.)
  { name: 'shallows-clear-down', wind: 3, hour: 12.5, x: 100, z: 52, clear: 1, at: [96, 3.2, 47, 100, -1.6, 37] },
];
const save = { game: 'slow-tide', version: 6, savedAt: 1, data: {
  quality: 'high', vessel: 'rib', mode: 'boat', day: 200, hour: 12, money: 4000,
  tips: { rowed: true, cast: true, caught: true, journal: true, ashore: true, style: true, pack: true, walked: true, binoculars: true, photoMode: true, favours: true },
  places: { camp: { day: 1, hour: 10 } }, yard: { owned: ['row', 'skiff', 'kayak', 'rib'] },
  settings: { player: { name: 'Mags' }, graphics: { preset: 'ultra', ocean: 'full' }, weather: { mode: 'clear', sea: 'auto', windMode: 'manual', windSpeed: 4, windFrom: 225 } } } };
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
    slowTide.setWeather(S.weather || 'clear');
    slowTide.setRain(S.weather === 'storm' ? 0.6 : 0);
    slowTide.teleport(S.x, S.z, 0);
    slowTide.scene.traverse((o) => { if (o.material?.uniforms?.uClear) o.material.uniforms.uClear.value = S.clear || 0; });
    // (Manual wind, and the sea let build to it; then the hour, straight to it.)
    slowTide.setWind(S.wind / 12, 225 * Math.PI / 180);
    slowTide.advance(70, 20, false);
    slowTide.setHour(S.hour);
    slowTide.clock.shown = null;
    slowTide.clock.sweeping = false;
    slowTide.advance(3, 20, false);
    // (A frame drawn, so the sky and the light catch up with the hour: they move as it's drawn.)
    slowTide.advance(0.1, 20, true);
    const L = slowTide.env.lightDir;
    const sunYaw = Math.atan2(L.x, L.z);
    const yaw = S.view === 'sun' ? sunYaw : S.view === 'away' ? sunYaw + Math.PI : sunYaw + Math.PI / 2;
    const cx = S.x + 6, cz = S.z + 6;
    const y = S.h, tx = cx + Math.sin(yaw) * 20, tz = cz + Math.cos(yaw) * 20, ty = y - 20 * Math.tan(S.pitch);
    // (Across the wind, which blows towards −x −z here.)
    const C = slowTide.camera.position, A = S.atCam;
    window.__view = A ? [C.x, A[0], C.z, C.x + A[1] * 0.707, A[2], C.z - A[1] * 0.707] : S.at || [cx, y, cz, tx, ty, tz];
    slowTide.look(cx, y, cz, tx, ty, tz);
    return { hour: +slowTide.clock.hour.toFixed(2), wind: +slowTide.conditions.wind.speed.toFixed(1), sea: Object.fromEntries(Object.entries(slowTide.conditions.sea).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(2) : v])), sun: [+L.x.toFixed(2), +L.y.toFixed(2), +L.z.toFixed(2)] };
  }, S);
  await page.waitForTimeout(1300);
  await page.evaluate(() => { slowTide.advance(0.05, 20, false); slowTide.look(...window.__view); });
  // (Close in to the shore a frame takes long in software rendering.)
  await page.screenshot({ path: `${OUT}/${S.name}.png`, timeout: 180000 });
  console.log(S.name, JSON.stringify(info));
}
console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no page errors');
await br.close();
