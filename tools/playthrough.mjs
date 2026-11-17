// The day the brief describes (its Part J), played through by two real game clients together over
// the local relay: two friends, Mags (hosting) and Bert, from Willowhaven out to sea and back. It
// is a check that the systems work together, not a scripted mission: each step uses the game as a
// player would (its sheets, its keys, its interactions), with the clock run on where the day would
// take its time.
//
//   node tools/local-realtime.mjs 8643 &           (the stand-in for playing together)
//   python3 -m http.server 8676 &                  (the game, served from the repository)
//   PLAYWRIGHT=/path/to/playwright node tools/playthrough.mjs [url=http://127.0.0.1:8676/] [out=dir]
//
// Each step prints PASS or FAIL with what it saw; screenshots go to `out` if given. Software
// rendering here, so the frame times mean nothing: what's checked is what happens.

const PW = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = PW.chromium ? PW : PW.default;
const args = process.argv.slice(2);
const URL0 = args.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8676/';
const OUT = args.find((a) => !a.startsWith('http')) || '';
const RELAY = process.env.RELAY || 'http://127.0.0.1:8643';

const browsers = [], errors = [];
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); if (!ok) fails++; };
const note = (...a) => console.log('  ·', ...a);

// A day in early summer, fine; Mags owns the RIB (and money for an engine and kit), Bert his skiff.
const DAY = 6;
const saveFor = (name, extra = {}) => ({ game: 'slow-tide', version: 6, savedAt: 1, data: {
  quality: 'low', vessel: 'row', mode: 'boat', day: DAY, hour: 6.5, money: 4000,
  tips: { rowed: true, cast: true, caught: true, journal: true, ashore: true, style: true, pack: true, walked: true, binoculars: true, photoMode: true, favours: true },
  places: { camp: { day: 1, hour: 10 } }, settings: { player: { name } }, ...extra } });

async function client(name, save) {
  const br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  browsers.push(br);
  const page = await (await br.newContext({ viewport: { width: 1000, height: 640 } })).newPage();
  page.on('pageerror', (e) => errors.push(`${name} PAGEERROR ${e.message} ${(e.stack || '').split('\n').slice(0, 3).join(' | ')}`));
  page.on('console', (m) => {
    // (Errors, and the game's own word that it put something right that shouldn't have gone wrong.)
    if ((m.type() === 'error' && !/cloud-config|404|favicon/.test(m.text())) || (m.type() === 'warning' && /^Slow Tide:/.test(m.text()))) errors.push(`${name} ${m.text().slice(0, 200)}`);
  });
  await page.route('**/api/cloud-config', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, url: RELAY, anonKey: 'local' }) }));
  await page.goto(new URL('README.md', URL0).href);
  await page.evaluate((s) => localStorage.setItem('slow-tide-save', JSON.stringify(s)), save);
  await page.goto(URL0, { timeout: 180000 });
  await page.waitForFunction(() => window.slowTide && document.getElementById('start-btn'), null, { timeout: 180000 });
  await page.evaluate(() => document.getElementById('start-btn').click());
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    slowTide.paused = true;
    slowTide.setWeather('clear');
    slowTide.setRain(0);
    // (No radio calls in the middle of it.)
    slowTide.state.contracts.callAt = 1e9;
    const H = slowTide.hud, said = (window.__said = []);
    for (const k of ['toast', 'flash']) { const f = H[k].bind(H); H[k] = (m, ...r) => { said.push(m); return f(m, ...r); }; }
  });
  return page;
}
// (A second of frames drawn first: between shots the games run without drawing, to save time.)
const shot = async (P, name) => { if (OUT) { await P.evaluate(() => slowTide.advance(1, 30, true)); await P.screenshot({ path: `${OUT}/${name}.png` }); } };
const said = (P) => P.evaluate(() => window.__said.splice(0));

const A = await client('Mags', saveFor('Mags', { yard: { owned: ['row', 'skiff', 'kayak', 'rib'] } }));
const B = await client('Bert', saveFor('Bert'));
const both = [A, B];
// Both games run on together, a quarter-second at a time. (If either game throws, what it was
// doing is written out before the day stops: the game's own state, not the script's.)
const names = ['Mags', 'Bert'];
const dumpState = (P) => P.evaluate(() => {
  const v = (o) => (o ? [o.x, o.y, o.z].map((n) => (Number.isFinite(n) ? +n.toFixed(3) : String(n))) : null);
  const b = slowTide.boat, out = { camera: v(slowTide.camera.position), walker: v(slowTide.walker.pos), heading: slowTide.walker.heading, mode: slowTide.state.mode, rig: slowTide.rig.mode, crew: slowTide.crew.on, boat: b && { id: b.id, pos: v(b.pos), vel: v(b.vel), heading: b.heading, speed: b.speed, lever: b.lever, deck: b.deck }, peers: [] };
  for (const p of slowTide.together.peers.values()) {
    const vb = slowTide.visitors.boatOf(p.id);
    out.peers.push({ name: p.name, at: p.at, pose: p.pose && Object.fromEntries(Object.entries(p.pose).filter(([k]) => 'mkxzhvxvzcrcxcz'.includes(k) || ['vx', 'vz', 'cr', 'cx', 'cz'].includes(k))), drawn: vb && { pos: v(vb.pos), vel: v(vb.vel), heading: vb.heading } });
  }
  return out;
}).catch((e) => `no state: ${e.message}`);
const step = async (secs, render = false) => {
  for (let i = 0; i < secs * 4; i++) {
    await Promise.all(both.map((P, k) => P.evaluate((r) => slowTide.advance(0.25, 30, r), render).catch(async (e) => {
      console.log(`FAIL the game threw (${names[k]}): ${e.message.split('\n').slice(0, 4).join(' | ')}`);
      console.log('  · state', names[k], JSON.stringify(await dumpState(P)));
      console.log('  · state', names[1 - k], JSON.stringify(await dumpState(both[1 - k])));
      throw e;
    })));
  }
};

/* ---------- 1. A morning at Willowhaven ---------- */
const code = await A.evaluate(async () => { await slowTide.together.host(); return slowTide.together.code; });
await B.evaluate(async (c) => { await slowTide.together.join(c); }, code);
await step(3);
const joined = await Promise.all([A.evaluate(() => slowTide.together.peers.size), B.evaluate(() => slowTide.together.peers.size)]);
check('1 · playing together: Bert joins Mags’s game', joined[0] === 1 && joined[1] === 1, JSON.stringify(joined));
// Her RIB is laid up (three of her boats are in the water already): the harbour office puts her in.
const office = await A.evaluate(() => {
  const laid = slowTide.boats.rib.stowed;
  slowTide.harbourOffice();
  slowTide.advance(0.1, 30, false);
  const press = (re) => { const b = [...document.querySelectorAll('#confirm-acts button')].find((x) => re.test(x.textContent)); b?.click(); slowTide.advance(0.2, 30, false); return b?.textContent || null; };
  // (Three in the water already: the kayak's laid up in her place.)
  const a = press(/^Put a boat in the water/), b = press(/^The RIB/), c = press(/^Lay up the kayak/);
  slowTide.advance(1, 30, false);
  const R = slowTide.boats.rib;
  return { laid, pressed: [a, b, c], stowed: R.stowed, at: [+R.pos.x.toFixed(1), +R.pos.z.toFixed(1)], said: window.__said.slice(-2) };
});
note('harbour office', JSON.stringify(office));
check('1 · the harbour office puts her RIB in the water, at her berth', office.laid && !office.stowed && Math.hypot(office.at[0] - 10, office.at[1] + 65) < 40, JSON.stringify(office));

/* ---------- 2. A different outboard, at the Marine Works ---------- */
const engine = await A.evaluate(() => {
  slowTide.walkTo(18, -104, 0);
  slowTide.advance(0.3, 30, false);
  slowTide.harbour('works', 'fit');
  slowTide.advance(0.1, 30, false);
  [...document.querySelectorAll('.hb-picks button')].find((b) => /^The RIB/.test(b.textContent))?.click();
  slowTide.advance(0.1, 30, false);
  const fit = [...document.querySelectorAll('button')].find((b) => /^Fit it: /.test(b.textContent) && b.closest('.hb-fit')?.textContent.includes('225'));
  const was = slowTide.yard.engines?.rib?.model || 'stock';
  const m0 = slowTide.money;
  fit?.click();
  slowTide.advance(0.1, 30, false);
  return { found: !!fit, was, now: slowTide.yard.engines?.rib?.model, paid: m0 - slowTide.money, said: window.__said.slice(-2) };
});
note('engine', JSON.stringify(engine));
check('2 · at the Marine Works, a bigger outboard on her transom', engine.found && engine.now === 's225' && engine.paid > 0, JSON.stringify(engine));
await A.keyboard.press('Escape');

/* ---------- 3. Diving and fishing kit aboard: she sits differently ---------- */
// (Her sit, measured: how far down she floats and her trim, settled on calm water, alongside.)
const sit = () => A.evaluate(() => {
  const b = slowTide.boats.rib;
  let dy = 0, pitch = 0;
  for (let i = 0; i < 40; i++) { slowTide.advance(0.25, 30, false); dy += (b.pos.y - slowTide.seaHere(b.pos.x, b.pos.z)) / 40; pitch += (b.pitch || 0) / 40; }
  return { dy: +dy.toFixed(3), pitch: +(pitch * 57.3).toFixed(2), payload: Math.round(b.payload || 0) };
});
const before = await sit();
const kit = await A.evaluate(() => {
  const P = slowTide.boats.rib.pos;
  // (On the pontoon beside her: it runs x 9.8 to 12.2, she lies a few metres east of it.)
  slowTide.walkTo(11.4, P.z, Math.PI / 2);
  slowTide.advance(0.3, 30, false);
  slowTide.harbour('chandlery', 'boat');
  slowTide.advance(0.1, 30, false);
  const rows = () => [...document.querySelectorAll('.cp-row')];
  const buyRow = (n) => rows().find((r) => r.textContent.startsWith(`${n},`))?.querySelector('button');
  const bought = [];
  for (const n of ['Dive cylinder', 'Dive cylinder', 'Stores crate', 'Fish box', 'Bivvy roll']) { const b = buyRow(n); if (b) { b.click(); bought.push(n); } }
  let aboard = 0;
  for (let i = 0; i < 6; i++) { const b = [...document.querySelectorAll('button')].find((x) => /^Aboard the /.test(x.textContent)); if (!b) break; b.click(); aboard++; }
  return { bought, aboard, items: slowTide.state.cargo.items.map((i) => i.id), onDeck: slowTide.boats.rib.cargo.map((c) => c.id) };
});
note('kit', JSON.stringify(kit));
await A.keyboard.press('Escape');
const after = await sit();
note('her sit before', JSON.stringify(before), 'after', JSON.stringify(after));
check('3 · the kit aboard her deck', kit.onDeck.length >= 3, JSON.stringify(kit.onDeck));
// (65 kg on a hull her size: some millimetres lower, as it should be.)
check('3 · with it aboard she sits lower in the water', after.payload > before.payload && after.dy < before.dy - 0.002, `${before.dy} → ${after.dy} m, payload ${before.payload} → ${after.payload} kg, trim ${before.pitch}° → ${after.pitch}°`);
// (Her kit aboard, seen from the pontoon: a fixed view, for one frame.)
if (OUT) {
  await A.evaluate(() => { const R = slowTide.boats.rib; slowTide.look(11.2, 2.3, R.pos.z - 4.5, R.pos.x, 0.2, R.pos.z); });
  await A.screenshot({ path: `${OUT}/j1-rib-loaded.png` });
  await A.evaluate(() => { slowTide.paused = true; });
}

/* ---------- 4. Aboard, a route, and away ---------- */
// Mags walks down to her RIB and gets in; Bert walks out along the pontoon and steps aboard.
const board = await A.evaluate(() => {
  const R = slowTide.boats.rib;
  slowTide.walkTo(R.pos.x - Math.cos(R.heading) * 1.6, R.pos.z + Math.sin(R.heading) * 1.6, R.heading);
  slowTide.advance(0.3, 30, false);
  const I = slowTide.interaction();
  const text = I?.text;
  I?.run?.();
  // (Stepping aboard takes a moment.)
  slowTide.advance(1.5, 30, false);
  const box = document.getElementById('confirm');
  return { text, inRib: slowTide.boat === R && slowTide.state.mode === 'boat', boat: slowTide.boat?.id, mode: slowTide.state.mode, vessel: slowTide.state.vessel, dlg: box.hidden ? null : box.textContent.replace(/\s+/g, ' ').slice(0, 200), eng: JSON.stringify(R.engine && { on: R.engine.on, running: R.engine.running, state: R.engine.state }), startup: slowTide.state.settings?.startup ?? slowTide.state.settings?.engineStart ?? null, said: window.__said.slice(-2), at: [+R.pos.x.toFixed(1), +R.pos.z.toFixed(1)] };
});
check('4 · Mags gets in her RIB at the pontoon', board.inRib, JSON.stringify(board));
await step(2);
const crewOn = await B.evaluate(([x, z]) => {
  slowTide.walkTo(x - 1.6, z, 0);
  slowTide.advance(0.5, 30, false);
  const I = slowTide.interaction();
  const text = I?.text;
  if (/^Step aboard Mags’s /.test(text || '')) I.run();
  slowTide.advance(0.5, 30, false);
  return { text, crew: !!slowTide.crew.on };
}, board.at);
check('4 · Bert walks out and steps aboard Mags’s RIB as her crew', crewOn.crew, JSON.stringify(crewOn));
await step(1);
// Her route, drawn on the map: out of the bay, offshore, and on to the Hound.
const MARKS = [[2, 140], [-60, 450], [-190, 728]];
const route = await A.evaluate((pts) => {
  const M = slowTide.mapSheet;
  M.setPlanning(true);
  M.plan = pts.map((p) => [...p]);
  M.renderPlan?.();
  const card = document.querySelector('.mp-plan, #map-plan')?.textContent?.replace(/\s+/g, ' ').slice(0, 300) || null;
  M.saveRoute();
  const R = slowTide.state.routes[slowTide.state.routes.length - 1];
  M.hooks.followRoute(R.id);
  return { id: R.id, name: R.name, pts: R.pts.length, following: slowTide.state.route, card, said: window.__said.slice(-1) };
}, MARKS);
note('route', JSON.stringify(route));
check('4 · her route drawn on the map, saved and followed', route.pts === 3 && route.following?.id === route.id, JSON.stringify(route));
await A.keyboard.press('Escape');
// Away: the throttle up, steering for each mark in turn (as a helmsman would, by the keys: which
// way each key turns her is found by trying it, as anyone new to a boat does).
let leftUp = true;
const where = () => A.evaluate(() => [Math.round(slowTide.boat.pos.x), Math.round(slowTide.boat.pos.z)]);
// What comes up at sea that a skipper deals with as it comes: the cooling intake fouled (weed or a
// bag, now and then under way: engine.js foul), the alarm sounding. Stop, off the helm, look her
// over, clear it, back to the helm.
const tendHer = async () => {
  const hot = await A.evaluate(() => {
    const E = slowTide.boat.engine;
    if (!(E?.blocked > 0 && E.temp >= 0.6)) return false;
    [...document.querySelectorAll('#confirm-acts button')].find((x) => /^Stop and clear it/.test(x.textContent))?.click();
    slowTide.boat.lever = 0;
    return true;
  });
  if (!hot) return false;
  for (let i = 0; i < 20 && (await A.evaluate(() => slowTide.boat.speed)) > 0.5; i++) await step(1);
  const off = await A.evaluate(() => { const I = slowTide.interaction(); if (/^Leave the helm/.test(I?.text || '')) I.run(); slowTide.advance(0.6, 30, false); return I?.text || null; });
  await A.keyboard.down('KeyW');
  await step(1);
  await A.keyboard.up('KeyW');
  const cleared = await A.evaluate(() => {
    const I = slowTide.interaction(), text = I?.text || null;
    if (/^Look her over/.test(text || '')) I.run();
    slowTide.advance(0.2, 30, false);
    const b = [...document.querySelectorAll('#confirm-acts button')].find((x) => /^Clear the (cooling intake|raw-water strainer)/.test(x.textContent));
    b?.click();
    slowTide.advance(0.5, 30, false);
    const B = slowTide.boat, S = B.hull.standing;
    if (B.deck) { B.deck.x = S.helm[0]; B.deck.z = S.helm[1]; }
    slowTide.advance(0.3, 30, false);
    const H = slowTide.interaction();
    if (H?.text === 'Take the helm') H.run();
    slowTide.advance(0.5, 30, false);
    return { text, cleared: !!b && !(B.engine?.blocked > 0), atHelm: !B.deck, said: window.__said.filter((m) => /intake|telltale|strainer/.test(m)).slice(-1) };
  });
  note('the alarm: her intake fouled', JSON.stringify({ off, ...cleared }));
  events.push({ what: 'intake', ...cleared });
  return true;
};
const events = [];
const helmsman = async (to, secs, lever = 0.7, near = 25) => {
  let key = null, last = null;
  // (Only from the helm: walking her deck, the keys walk you, not her.)
  if (await A.evaluate(() => !!slowTide.boat.deck)) { note('not at the helm: she can’t be steered'); return null; }
  for (let i = 0; i < secs * 2; i++) {
    const s = await A.evaluate(([x, z, lever]) => {
      const b = slowTide.boat;
      b.lever = lever;
      const want = Math.atan2(x - b.pos.x, z - b.pos.z);
      let d = want - b.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      return { d, dist: Math.hypot(x - b.pos.x, z - b.pos.z), x: b.pos.x, z: b.pos.z, v: b.speed };
    }, [to[0], to[1], lever]);
    last = s;
    if (s.dist < near) break;
    if (await tendHer()) { if (key) await A.keyboard.up(key); key = null; continue; }
    const want = Math.abs(s.d) < 0.06 ? null : (s.d > 0) === leftUp ? 'KeyA' : 'KeyD';
    if (want !== key) {
      if (key) await A.keyboard.up(key);
      if (want) await A.keyboard.down(want);
      key = want;
    }
    await step(0.5);
  }
  if (key) await A.keyboard.up(key);
  return last;
};
// Cast off (the mooring key, Z), then out of the marina at a walking pace, then along her route.
await A.keyboard.press('KeyZ');
await step(1);
const free = await A.evaluate(() => ({ tied: !!slowTide.boat.tie, said: window.__said.slice(-1) }));
check('4 · cast off: lines in, she’s free of the pontoon', !free.tied, JSON.stringify(free));
// (Straight out along the slot between the fingers, as she lies, to the open water east of them.)
await A.evaluate(() => { slowTide.boat.lever = 0.15; });
for (let i = 0; i < 60 && (await A.evaluate(() => slowTide.boat.pos.x)) < 32; i++) await step(0.5);
// (Which way the left key turns her, tried gently out there.)
const h0 = await A.evaluate(() => { slowTide.boat.lever = 0.12; return slowTide.boat.heading; });
await A.keyboard.down('KeyA');
await step(1.5);
await A.keyboard.up('KeyA');
const h1 = await A.evaluate(() => slowTide.boat.heading);
leftUp = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)) > 0;
note('the left key turns her', leftUp ? 'to a larger heading' : 'to a smaller heading', h0.toFixed(2), '→', h1.toFixed(2));
// (Then north up the open water into the bay.)
await helmsman([34, -12], 40, 0.4, 8);
const knocks = await A.evaluate(() => (slowTide.state.yard.vessels?.rib?.log || []).filter((l) => /quay|pontoon|jetty|scuff|scor|dent|knock/i.test(l.text)).map((l) => l.text));
check('4 · out of the marina without a knock', knocks.length === 0, JSON.stringify(knocks));
const motion = [];
let reached = await helmsman(MARKS[0], 60);
note('mark 1', JSON.stringify(reached));
const sea = await A.evaluate(() => {
  const b = slowTide.boat, out = { pitch: [], roll: [], heave: [] };
  for (let i = 0; i < 40; i++) {
    slowTide.advance(0.25, 30, false);
    out.pitch.push(b.pitch || 0);
    out.roll.push(b.roll || 0);
    out.heave.push(b.phys?.x?.[1] ?? b.pos.y);
  }
  const range = (a) => +((Math.max(...a) - Math.min(...a))).toFixed(3);
  return { speed: +b.speed.toFixed(1), pitch: +(range(out.pitch) * 57.3).toFixed(1), roll: +(range(out.roll) * 57.3).toFixed(1), heave: range(out.heave), sea: slowTide.conditions?.sea?.hs ?? null, wind: +(slowTide.conditions?.wind?.speed ?? 0).toFixed(1) };
});
note('at sea', JSON.stringify(sea));
check('5 · at sea she moves with the waves (pitch, roll and heave)', sea.pitch > 0.3 && sea.heave > 0.05 && sea.speed > 5, JSON.stringify(sea));
const crewSees = await B.evaluate(() => {
  const id = slowTide.crew.on?.id, b = id && slowTide.visitors.boatOf(id), w = slowTide.walker.pos;
  return { crew: !!id, d: b ? +Math.hypot(w.x - b.pos.x, w.z - b.pos.z).toFixed(2) : null, v: b ? +(b.speed || 0).toFixed(1) : null };
});
check('5 · Bert is still aboard with her, at sea', crewSees.crew && crewSees.d != null && crewSees.d < 4, JSON.stringify(crewSees));
const clocks = await Promise.all([A.evaluate(() => +slowTide.clock.abs.toFixed(3)), B.evaluate(() => ({ abs: +slowTide.clock.abs.toFixed(3), following: !!slowTide.clock.following }))]);
note('clocks', JSON.stringify(clocks), 'apart', ((clocks[0] - clocks[1].abs) * 60).toFixed(1), 'min');
await shot(A, 'j1-at-sea');
await shot(B, 'j1-at-sea-bert');

/* ---------- 6. Seabirds diving offshore, over a real feed ---------- */
// On along her route, looking out: a feed where the birds are working (the host's sea decides it,
// the bait shoal driven up by fish hunting it, the birds coming down on it).
// (The birds as each game shows them: world.birdsAt, called where a feed's birds come down.)
for (const P of both) await P.evaluate(() => { const w = slowTide.world, f = w.birdsAt.bind(w); window.__birdsAt = []; w.birdsAt = (x, z, n) => { window.__birdsAt.push([x, z, n]); return f(x, z, n); }; });
const birdsNear = (P, x, z) => P.evaluate(([x, z]) => window.__birdsAt.filter(([bx, bz]) => Math.hypot(bx - x, bz - z) < 60).length, [x, z]);
const findFeed = () => A.evaluate(() => {
  const b = slowTide.boat, F = slowTide.eco.feeding;
  // (Offshore: well out of Willowhaven's harbour and the bay's shallows.)
  const live = (F?.events || []).filter((e) => e.phase !== 2 && !e.done && Math.hypot(e.x - 4, e.z + 97) > 400).map((e) => ({ id: e.id, x: e.x, z: e.z, phase: e.phase, hunters: e.hunters, d: Math.hypot(e.x - b.pos.x, e.z - b.pos.z), bait: e.s?.sp?.name, alive: e.s?.members?.filter((m) => m.active && m.state === 'school').length ?? 0, hunter: e.sp >= 0 ? slowTide.species?.[e.sp]?.name ?? e.sp : null }));
  live.sort((p, q) => p.d - q.d);
  return live[0] || null;
});
let feed = await findFeed();
for (let leg = 0; leg < 30 && !(feed && feed.phase === 1 && feed.d < 900); leg++) {
  if (leg < 12) await helmsman(MARKS[1], 10);
  else { await A.evaluate(() => { slowTide.boat.lever = 0; }); await step(10); }
  feed = await findFeed();
}
// (A few seconds watching it: the birds coming down.)
await step(10);
const birds = feed ? await Promise.all(both.map((P) => birdsNear(P, feed.x, feed.z))) : [0, 0];
note('feed', JSON.stringify(feed), 'birds diving there, on each screen:', JSON.stringify(birds));
check('6 · offshore, a real feed: bait driven up by hunting fish', !!feed && feed.phase === 1 && feed.hunters > 0 && feed.alive > 0, JSON.stringify(feed));
check('6 · and the birds diving on it, on both screens', birds[0] > 0 && birds[1] > 0, JSON.stringify(birds));
const feedB = feed && await B.evaluate((id) => (slowTide.eco.feeding?.events || []).some((e) => e.id === id), feed.id);
check('6 · the same feed in Bert’s sea (the host’s, shared)', !!feedB);

/* ---------- 7. One steers, the other on the fish finder ---------- */
// Mags runs down to it and stops short; Bert has the finder on, under her.
// (As the game advises: motor up gently and stop well short. A boat run through a feed breaks it
// up, and the noise of one close by makes the fish wary.)
const short = (m) => A.evaluate(([x, z, m]) => {
  const b = slowTide.boat, d = Math.hypot(x - b.pos.x, z - b.pos.z);
  return [x - ((x - b.pos.x) / d) * m, z - ((z - b.pos.z) / d) * m];
}, [feed.x, feed.z, m]);
if (feed) {
  await helmsman(await short(80), 60, 0.45, 12);
  // (Off the throttle, and let her come down off the plane before creeping in.)
  await A.evaluate(() => { slowTide.boat.lever = 0; });
  for (let i = 0; i < 20 && (await A.evaluate(() => slowTide.boat.speed)) > 1.5; i++) await step(1);
  await helmsman(await short(24), 40, 0.12, 4);
  await A.evaluate(() => { slowTide.boat.lever = 0; });
  for (let i = 0; i < 12 && (await A.evaluate(() => slowTide.boat.speed)) > 0.5; i++) await step(2);
}
await B.keyboard.press('KeyF');
await step(1);
const finder = await B.evaluate(() => ({ visible: slowTide.finder.visible, where: slowTide.finder.whereEl?.textContent, read: slowTide.finder.read && { depth: +slowTide.finder.read.depth.toFixed(1), x: Math.round(slowTide.finder.read.x), z: Math.round(slowTide.finder.read.z) } }));
const herNow = await A.evaluate(() => ({ x: Math.round(slowTide.boat.pos.x), z: Math.round(slowTide.boat.pos.z), v: +slowTide.boat.speed.toFixed(1) }));
check('7 · Mags at the helm, stopped short of the feed; Bert’s fish finder reads under her', finder.visible && finder.where === 'below you' && finder.read && Math.hypot(finder.read.x - herNow.x, finder.read.z - herNow.z) < 5, JSON.stringify({ finder, herNow }));
await shot(B, 'j1-finder');

/* ---------- 8. A cast into it, and a powerful fish ---------- */
const castInto = async () => {
  // (Where the feed is now: the shoal drifts, and the birds with it.)
  const now = await A.evaluate((id) => { const e = (slowTide.eco.feeding?.events || []).find((f) => f.id === id); return e ? [e.x, e.z] : null; }, feed.id);
  if (now) [feed.x, feed.z] = now;
  await B.evaluate(([x, z]) => {
    slowTide.gear('spin', 'metal');
    const P = slowTide.walker.pos, yaw = Math.atan2(x - P.x, z - P.z);
    slowTide.rig.views[slowTide.rig.mode].yaw = yaw;
  }, feed ? [feed.x, feed.z] : [0, 0]);
  await B.keyboard.down('Space');
  await step(1);
  await B.keyboard.up('Space');
  await step(3);
};
let fish = null, tries = 0, states = [];
if (feed) {
  for (; tries < 10 && !fish; tries++) {
    // (Three casts and nothing: the feed has moved on, so after it again, and stop short.)
    if (tries && tries % 3 === 0) {
      const now = await A.evaluate((id) => { const e = (slowTide.eco.feeding?.events || []).find((f) => f.id === id && f.phase !== 2 && !f.done); return e ? [e.x, e.z] : null; }, feed.id);
      const next = now ? { ...feed, x: now[0], z: now[1] } : await findFeed();
      if (next) {
        feed = next;
        const off = await A.evaluate(([x, z]) => { const b = slowTide.boat, d = Math.hypot(x - b.pos.x, z - b.pos.z); return d < 30 ? null : [x - ((x - b.pos.x) / d) * 24, z - ((z - b.pos.z) / d) * 24]; }, [feed.x, feed.z]);
        if (off) {
          // (Far: run down to it, ease off, then creep in.)
          const far = await A.evaluate(([x, z]) => Math.hypot(x - slowTide.boat.pos.x, z - slowTide.boat.pos.z), off);
          if (far > 80) {
            await helmsman(await short(80), 60, 0.45, 12);
            await A.evaluate(() => { slowTide.boat.lever = 0; });
            for (let i = 0; i < 20 && (await A.evaluate(() => slowTide.boat.speed)) > 1.5; i++) await step(1);
          }
          await helmsman(await short(24), 40, 0.12, 4);
          await A.evaluate(() => { slowTide.boat.lever = 0; });
          await step(6);
        }
        note('after the feed again', JSON.stringify({ id: feed.id, x: Math.round(feed.x), z: Math.round(feed.z) }));
      }
    }
    await castInto();
    // Working the metal back: held (cranked) a second, let go half a second, again.
    for (let i = 0; i < 40 && !fish; i++) {
      const st = await B.evaluate(() => slowTide.fishing.state);
      states.push(st);
      // (A take: struck, or the game strikes as it takes on assisted technique.)
      if (st === 'bite' || st === 'reeling') {
        await B.keyboard.up('Space');
        if (st === 'bite') { await B.keyboard.press('Space'); await step(1); }
        fish = await B.evaluate(() => ({ state: slowTide.fishing.state, sp: slowTide.fishing.fight?.agent?.sp?.name || slowTide.fishing.agent?.sp?.name }));
        break;
      }
      if (st === 'idle') break;
      await B.keyboard.down('Space');
      await step(1);
      await B.keyboard.up('Space');
      await step(0.5);
    }
  }
}
note('casts', tries, 'states seen', [...new Set(states)].join(','));
check('8 · cast into the feed, and a fish takes the metal: hooked', fish?.state === 'reeling', JSON.stringify(fish));
// The fight: reel (held) while the line will take it, ease off when it's tight.
let fought = null;
if (fish?.state === 'reeling') {
  let held = false, peak = 0, seconds = 0;
  for (; seconds < 240; seconds += 0.5) {
    const f = await B.evaluate(() => ({ state: slowTide.fishing.state, tension: slowTide.fishing.fight?.tension ?? 0, atNet: !!slowTide.fishing.fight?.atNet, out: +(slowTide.fishing.fight?.out ?? slowTide.fishing.fight?.dist ?? 0).toFixed(1) }));
    if (f.state !== 'reeling') { fought = f; break; }
    peak = Math.max(peak, f.tension);
    if (f.atNet) { await B.keyboard.up('Space'); held = false; await B.keyboard.press('Space'); }
    else if (f.tension > 0.8 && held) { await B.keyboard.up('Space'); held = false; }
    else if (f.tension < 0.6 && !held) { await B.keyboard.down('Space'); held = true; }
    await step(0.5);
  }
  if (held) await B.keyboard.up('Space');
  fought = { ...(fought || {}), seconds, peak: +peak.toFixed(2) };
  await step(3);
  fought.after = await B.evaluate(() => ({ state: slowTide.fishing.state, caught: slowTide.fishing.caughtFish?.sp?.name || slowTide.fishing.shown?.sp?.name || null }));
  // (Kept: K on the catch card.)
  await B.keyboard.press('KeyK');
  await step(1.5);
  fought.kept = await B.evaluate(() => ({ state: slowTide.fishing.state, said: window.__said.slice(-1) }));
}
note('fight', JSON.stringify(fought));
check('8 · played and landed', fought?.after?.state === 'caught' || fought?.after?.state === 'keeping', JSON.stringify(fought));
await shot(B, 'j1-landed');

/* ---------- 9. On to a remote reef, and the anchor down ---------- */
// The rest of her route: on round to the Hound, the reef out past Gannet Isle.
await B.keyboard.press('KeyF');
await helmsman(MARKS[2], 90);
// (The Hound itself is 30 m down, too deep for her anchor's 30 m of rope (the game says so, and
// suggests a shoal): a skipper anchors on its north edge, in 16 m. Spot-Lock, a Marine Works
// fitting, would hold her over the deep part.)
const HOUND = [-196, 696];
// (Off the plane at the reef's mark, then slowly on to where she'll lie.)
await A.evaluate(() => { slowTide.boat.lever = 0; });
for (let i = 0; i < 20 && (await A.evaluate(() => slowTide.boat.speed)) > 1.5; i++) await step(1);
// (At a walking pace: she carries her way a long way off the plane, and would be off the shelf.)
await helmsman(HOUND, 80, 0.1, 4);
note('at the Hound', JSON.stringify(await where()));
await A.evaluate(() => { slowTide.boat.lever = 0; });
for (let i = 0; i < 20 && (await A.evaluate(() => slowTide.boat.speed)) > 0.6; i++) await step(1);
await A.keyboard.press('KeyZ');
await step(4);
const anchor0 = await A.evaluate(() => ({ anchored: !!slowTide.boat.anchored, x: slowTide.boat.pos.x, z: slowTide.boat.pos.z, said: window.__said.slice(-2) }));
await step(30);
const anchor1 = await A.evaluate(([x, z]) => ({ anchored: !!slowTide.boat.anchored, moved: +Math.hypot(slowTide.boat.pos.x - x, slowTide.boat.pos.z - z).toFixed(1), to: +Math.hypot(slowTide.boat.pos.x + 196, slowTide.boat.pos.z - 744).toFixed(0) }), [anchor0.x, anchor0.z]);
note('anchored', JSON.stringify(anchor0), JSON.stringify(anchor1));
check('9 · on the Hound’s edge, the anchor down, and holding', anchor0.anchored && anchor1.anchored && anchor1.moved < 25, JSON.stringify({ ...anchor1, said: anchor0.said }));

/* ---------- 10. Over the side: a dive on the reef ---------- */
// Mags off the helm, a step along her deck, and over the side on a tank with the camera.
const goDiving = (P) => P.evaluate(() => {
  const acts = () => [...document.querySelectorAll('#confirm-acts button')];
  let I = slowTide.interaction();
  const seen = [I?.text || null];
  if (/^Leave the helm/.test(I?.text || '')) { I.run(); slowTide.advance(0.6, 30, false); }
  return seen;
}).then(async (seen) => {
  // (A stride forward along her deck, off the wheel.)
  await P.keyboard.down('KeyW');
  await P.evaluate(() => slowTide.advance(1, 30, false));
  await P.keyboard.up('KeyW');
  return P.evaluate((seen) => {
    slowTide.advance(0.3, 30, false);
    const acts = () => [...document.querySelectorAll('#confirm-acts button')];
    let I = slowTide.interaction();
    seen.push(I?.text || null);
    // (Something to look at first: looked over, and whatever can be put right at sea, put right.)
    if (/^Look her over/.test(I?.text || '')) {
      I.run();
      slowTide.advance(0.2, 30, false);
      seen.push(document.getElementById('confirm-text')?.textContent || document.getElementById('confirm')?.textContent.replace(/\s+/g, ' ').slice(0, 200));
      const fix = acts().find((x) => /^(Clear the|Pump up|Bail her|Do up)/.test(x.textContent));
      (fix || acts().find((x) => /^Leave it/.test(x.textContent)))?.click();
      seen.push(fix?.textContent || 'left it');
      slowTide.advance(0.6, 30, false);
      I = slowTide.interaction();
      seen.push(I?.text || null);
    }
    if (/go diving/i.test(I?.text || '')) I.run();
    slowTide.advance(0.2, 30, false);
    acts().find((x) => /^Go diving/.test(x.textContent))?.click();
    slowTide.advance(0.3, 30, false);
    const b = acts().find((x) => /^Scuba, with the camera/.test(x.textContent));
    b?.click();
    slowTide.advance(1.5, 30, false);
    return { seen, scuba: b?.textContent || null, diving: slowTide.diving.state?.kit || null };
  }, seen);
});
const dA = await goDiving(A);
note('in', JSON.stringify(dA));
check('10 · Mags over the side on scuba, with the camera', dA.diving === 'scuba', JSON.stringify(dA));
let bertDived = false;
if (dA.diving === 'scuba') {
  // Down, and over to the reef: face it, head down, swim (forward swims where you look).
  const REEF = [-196, 735];
  const swimTo = async (P, [x, z], pitch, secs, near = 4) => {
    for (let i = 0; i < secs; i++) {
      await P.evaluate(([x, z, pitch]) => { const d = slowTide.diving.diver.pos, V = slowTide.rig.views.dive; V.yaw = Math.atan2(x - d.x, z - d.z); V.pitch = pitch; }, [x, z, pitch]);
      await P.keyboard.down('KeyW');
      await step(1);
      await P.keyboard.up('KeyW');
      if (await P.evaluate(([x, z]) => { const d = slowTide.diving.diver.pos; return Math.hypot(x - d.x, z - d.z); }, [x, z]) < near) break;
    }
  };
  // (Down a few metres, then along gently downhill: onto the reef's top, ten to fifteen metres.)
  await swimTo(A, REEF, 1.1, 5);
  await swimTo(A, REEF, 0.12, 60);
  const under = await A.evaluate(() => {
    const d = slowTide.diving.diver, e = slowTide.eco;
    return { depth: +d.depth.toFixed(1), near: e.agents.filter((a) => a.active && a.state !== 'gone' && Math.hypot(a.x - d.pos.x, a.z - d.pos.z) < 15).length, air: Math.round(slowTide.state.dive.tank) };
  });
  note('on the reef', JSON.stringify(under));
  check('10 · down on the reef, fish about her', under.depth > 5 && under.near > 0, JSON.stringify(under));

  const bertWhile = await B.evaluate(() => ({ crew: !!slowTide.crew.on, at: [Math.round(slowTide.walker.pos.x), Math.round(slowTide.walker.pos.z)], said: window.__said.filter((m) => /boat has gone/.test(m)).slice(-1) }));
  const ribNow = await A.evaluate(() => [Math.round(slowTide.boats.rib.pos.x), Math.round(slowTide.boats.rib.pos.z)]);
  check('10 · Bert still aboard her while Mags is down', bertWhile.crew && Math.hypot(bertWhile.at[0] - ribNow[0], bertWhile.at[1] - ribNow[1]) < 4, JSON.stringify({ ...bertWhile, rib: ribNow }));
  // Bert, crewing: over the side after her (the crew menu's Go diving, on scuba), a few metres down.
  const bertDive = await B.evaluate(() => {
    const I = slowTide.interaction();
    const text = I?.text;
    I?.run?.();
    slowTide.advance(0.2, 30, false);
    const acts = [...document.querySelectorAll('#confirm-acts button')].map((x) => x.textContent);
    [...document.querySelectorAll('#confirm-acts button')].find((x) => /^Go diving/.test(x.textContent))?.click();
    slowTide.advance(0.3, 30, false);
    [...document.querySelectorAll('#confirm-acts button')].find((x) => /^Scuba, with the camera/.test(x.textContent))?.click();
    slowTide.advance(1.5, 30, false);
    return { text, acts, diving: slowTide.diving.state?.kit || null, crew: !!slowTide.crew.on };
  });
  note('Bert, crewing', JSON.stringify(bertDive));
  check('10 · Bert, crewing, over the side after her', bertDive.diving === 'scuba', JSON.stringify(bertDive));
  bertDived = bertDive.diving === 'scuba';
  if (bertDive.diving) {
    await B.evaluate(() => { slowTide.rig.views.dive.pitch = 1.1; });
    await B.keyboard.down('KeyW');
    await step(3);
    await B.keyboard.up('KeyW');
    await B.evaluate(() => { slowTide.rig.views.dive.pitch = 0; });
    // (Both in the water now: each sees the other diving.)
    const ids = await Promise.all(both.map((P) => P.evaluate(() => slowTide.together.id)));
    const seeEach = [await A.evaluate((id) => { const p = slowTide.together.peers.get(id); return (p?.view || p?.pose)?.m || null; }, ids[1]), await B.evaluate((id) => { const p = slowTide.together.peers.get(id); return (p?.view || p?.pose)?.m || null; }, ids[0])];
    check('10 · each sees the other diving', seeEach.every((m) => m === 'dive'), JSON.stringify(seeEach));
  }
  // A photograph: the camera on the nearest fish (Space underwater), kept (Enter).
  const photos0 = await A.evaluate(() => slowTide.state.photos.length);
  const aim = await A.evaluate(() => {
    const d = slowTide.diving.diver.pos, V = slowTide.rig.views.dive;
    const f = slowTide.eco.agents.filter((a) => a.active && a.state !== 'gone').map((a) => ({ a, d: Math.hypot(a.x - d.x, a.z - d.z) })).filter((q) => q.d > 1.5).sort((p, q) => p.d - q.d)[0];
    if (!f) return null;
    V.yaw = Math.atan2(f.a.x - d.x, f.a.z - d.z);
    V.pitch = Math.atan2(d.y - f.a.y, f.d);
    slowTide.advance(0.1, 30, true);
    return { sp: f.a.sp?.id, d: +f.d.toFixed(1) };
  });
  await shot(A, 'j1-dive');
  await A.keyboard.press('Space');
  await step(1.5);
  await A.keyboard.press('Enter');
  await step(0.5);
  const photo = await A.evaluate(() => { const p = slowTide.state.photos[slowTide.state.photos.length - 1]; return { n: slowTide.state.photos.length, species: p?.subjects?.species || [], said: window.__said.slice(-1) }; });
  note('photo', JSON.stringify(aim), JSON.stringify(photo));
  check('10 · a photograph on the reef, kept', photo.n > photos0, JSON.stringify(photo));
  // Up slowly to five metres, the safety stop there (after a dive below ten), then the surface.
  const depthA = () => A.evaluate(() => slowTide.diving.diver.depth);
  const rise = async (to, pitch) => {
    for (let i = 0; i < 100 && (await depthA()) > to; i++) {
      await A.evaluate((p) => { slowTide.rig.views.dive.pitch = p; }, pitch);
      await A.keyboard.down('KeyW');
      await step(0.5);
      await A.keyboard.up('KeyW');
      await step(0.5);
    }
  };
  await rise(4.6, -0.45);
  await A.evaluate(() => { slowTide.rig.views.dive.pitch = 0; });
  await step(34);
  const stop = await A.evaluate(() => ({ depth: +slowTide.diving.diver.depth.toFixed(1), said: window.__said.slice(-2) }));
  note('safety stop', JSON.stringify(stop));
  check('10 · her safety stop at five metres, done', stop.said.some((m) => /^Safety stop done/.test(m)), JSON.stringify(stop));
  await rise(0.6, -0.5);
  // Back to the boat on the surface (she's swung on her anchor), and aboard.
  for (let k = 0; k < 8; k++) {
    const bp = await A.evaluate(() => [slowTide.boat.pos.x, slowTide.boat.pos.z]);
    await swimTo(A, bp, 0, 15);
    if (await A.evaluate(() => Math.hypot(slowTide.diving.diver.pos.x - slowTide.boat.pos.x, slowTide.diving.diver.pos.z - slowTide.boat.pos.z)) < 4) break;
  }
  const aboard = await A.evaluate(() => {
    const out = [];
    for (let i = 0; i < 6; i++) {
      const I = slowTide.interaction();
      out.push(I?.text || null);
      if (/^Climb aboard/.test(I?.text || '')) { I.run(); slowTide.advance(1.5, 30, false); break; }
      slowTide.advance(0.5, 30, false);
    }
    return { prompts: out, diving: !!slowTide.diving.state, said: window.__said.filter((m) => /^Scuba dive/.test(m)) };
  });
  note('back aboard', JSON.stringify(aboard));
  check('10 · back aboard after the dive, written up', !aboard.diving && aboard.said.length > 0, JSON.stringify(aboard));
} else {
  // (Not in the water: why, and on with the day from her helm.)
  console.log(`SKIP 10 · the dive itself: Mags never went in (her deck offered ${JSON.stringify(dA.seen)})`);
  await A.keyboard.press('Escape');
  await A.evaluate(() => slowTide.fishing.cancel?.());
  await step(0.5);
}
// Aft along her deck to the wheel, and the helm again.
const helmBack = await A.evaluate(() => {
  const b = slowTide.boat, S = b.hull.standing;
  if (b.deck) { b.deck.x = S.helm[0]; b.deck.z = S.helm[1]; }
  slowTide.advance(0.3, 30, false);
  const I = slowTide.interaction();
  const text = I?.text;
  if (text === 'Take the helm') I.run();
  slowTide.advance(0.5, 30, false);
  return { text, atHelm: !b.deck };
});
check('10 · Mags back at the helm', helmBack.atHelm, JSON.stringify(helmBack));
// Bert up, and back aboard her (as he sees her, lying at anchor): crewing again.
if (await B.evaluate(() => !!slowTide.diving.state)) {
  await B.evaluate(() => { slowTide.rig.views.dive.pitch = -0.6; });
  await B.keyboard.down('KeyW');
  await step(6);
  await B.keyboard.up('KeyW');
  const magsId = await A.evaluate(() => slowTide.together.id);
  for (let k = 0; k < 25; k++) {
    const bp = await B.evaluate((id) => { const b = slowTide.visitors.crewBoat(id, slowTide.diving.diver.pos); return b ? [b.pos.x, b.pos.z] : null; }, magsId) || await A.evaluate(() => [slowTide.boats.rib.pos.x, slowTide.boats.rib.pos.z]);
    await B.evaluate(([x, z]) => { const d = slowTide.diving.diver.pos, V = slowTide.rig.views.dive; V.yaw = Math.atan2(x - d.x, z - d.z); V.pitch = 0; }, bp);
    await B.keyboard.down('KeyW');
    await step(1);
    await B.keyboard.up('KeyW');
    if (await B.evaluate(([x, z]) => Math.hypot(slowTide.diving.diver.pos.x - x, slowTide.diving.diver.pos.z - z), bp) < 2.5) break;
  }
  const bertBack = await B.evaluate(() => {
    const out = [];
    for (let i = 0; i < 12; i++) {
      const I = slowTide.interaction();
      out.push(I?.text || null);
      if (/^Climb aboard/.test(I?.text || '')) { I.run(); slowTide.advance(1.5, 30, false); break; }
      slowTide.advance(0.5, 30, false);
    }
    return { prompts: out.filter(Boolean), diving: !!slowTide.diving.state, crew: !!slowTide.crew.on };
  });
  await step(2);
  bertBack.still = await B.evaluate(() => !!slowTide.crew.on);
  note('Bert back aboard', JSON.stringify(bertBack));
  check('10 · Bert climbs back aboard Mags’s RIB, her crew again', bertBack.crew && bertBack.still && bertBack.prompts.some((p) => /^Climb aboard Mags’s RIB/.test(p)), JSON.stringify(bertBack));
}

/* ---------- 11. The night ---------- */
// (J3) The brief has them stay the night aboard. At anchor on the Hound's shelf: Mags off the helm,
// a stride along her deck, and she turns in on it in the bivvy roll from the chandlery, till dawn.
// Bert, crewing aboard, sleeps it through with her: his game shows the night go by (the host's
// time), and he wakes beside her.
const clockOf = (P) => P.evaluate(() => +slowTide.clock.abs.toFixed(2));
const night0 = { mags: await clockOf(A), bert: await clockOf(B), hour: await A.evaluate(() => +slowTide.state.hour.toFixed(2)) };
await said(A);
await said(B);
await A.evaluate(() => { const I = slowTide.interaction(); if (/^Leave the helm/.test(I?.text || '')) { I.run(); slowTide.advance(0.6, 30, false); } });
await A.keyboard.down('KeyW');
await A.evaluate(() => slowTide.advance(1, 30, false));
await A.keyboard.up('KeyW');
const turned = await A.evaluate(() => {
  slowTide.advance(0.3, 30, false);
  const acts = () => [...document.querySelectorAll('#confirm-acts button')], text = () => document.getElementById('confirm-text')?.textContent || null;
  const seen = [];
  // (Swinging on her anchor in a breeze she isn't still every moment: the settled prompt, waited
  // for as a player would.)
  for (let i = 0; i < 40 && !/^(Sit back a while|Look her over)/.test(slowTide.interaction()?.text || ''); i++) slowTide.advance(0.5, 30, false);
  let I = slowTide.interaction();
  seen.push(I?.text || null);
  // (Something to put right first, as before the dive.)
  if (/^Look her over/.test(I?.text || '')) {
    I.run();
    slowTide.advance(0.2, 30, false);
    (acts().find((x) => /^(Clear the|Pump up|Bail her|Do up)/.test(x.textContent)) || acts().find((x) => /^Leave it/.test(x.textContent)))?.click();
    slowTide.advance(0.6, 30, false);
    I = slowTide.interaction();
    seen.push(I?.text || null);
  }
  if (/^Sit back a while/.test(I?.text || '')) I.run();
  slowTide.advance(0.2, 30, false);
  seen.push(text());
  const bed = acts().find((x) => /^Turn in for the night/.test(x.textContent));
  bed?.click();
  slowTide.advance(0.2, 30, false);
  seen.push(text());
  const dawn = acts().find((x) => /^Dawn/.test(x.textContent));
  seen.push(dawn?.textContent || null);
  dawn?.click();
  return { seen, bed: !!bed, dawn: !!dawn };
});
note('turning in', JSON.stringify(turned));
// (Each game's sleep screen, and what it says.)
const sleepScreen = (P) => P.evaluate(() => { const H = slowTide.hud.el; return H.sleep.classList.contains('show') ? H.sleepText.textContent : null; });
const bertNight = { saw: null };
for (let i = 0; i < 40; i++) {
  await step(0.5);
  const [a, b] = [await sleepScreen(A), await sleepScreen(B)];
  if (b && !bertNight.saw) bertNight.saw = b;
  if (i > 8 && !a && !b) break;
}
const morning = { mags: await clockOf(A), bert: await clockOf(B), hour: await A.evaluate(() => +slowTide.state.hour.toFixed(2)), anchored: await A.evaluate(() => !!slowTide.boat.anchored), saidA: await said(A), saidB: await said(B), crew: await B.evaluate(() => !!slowTide.crew.on) };
note('the night', JSON.stringify({ night0, morning, bertNight }));
// (However late she turns in, she sleeps till the dawn she chose: the clock on to it.)
check('11 · Mags turns in on her deck in the bivvy roll, till dawn', turned.bed && turned.dawn && morning.mags - night0.mags > 2 && morning.hour < 8, JSON.stringify({ seen: turned.seen, from: night0.hour, to: morning.hour }));
check('11 · she wakes aboard, at anchor still, Bert in the other bag', morning.anchored && morning.saidA.some((t) => /^You wake/.test(t) && /Bert is stirring in the other bag/.test(t)), JSON.stringify(morning.saidA));
check('11 · Bert sleeps the night through with her, and wakes aboard beside her', /^Mags turns in/.test(bertNight.saw || '') && morning.crew && morning.bert - night0.bert > 2 && morning.saidB.some((t) => /^You wake/.test(t) && /Mags is stirring/.test(t)), JSON.stringify({ saw: bertNight.saw, bert: [night0.bert, morning.bert], said: morning.saidB, crew: morning.crew }));
await shot(A, 'j3-morning');
// Aft to the wheel again, and the helm.
await A.evaluate(() => {
  const b = slowTide.boat, S = b.hull.standing;
  if (b.deck) { b.deck.x = S.helm[0]; b.deck.z = S.helm[1]; }
  slowTide.advance(0.3, 30, false);
  const I = slowTide.interaction();
  if (I?.text === 'Take the helm') I.run();
  slowTide.advance(0.5, 30, false);
});

/* ---------- 12. Home, in rougher weather ---------- */
const outbound = sea;
await A.evaluate(() => { slowTide.setWeather('overcast'); slowTide.setWind(0.9, Math.PI * 0.25); });
await step(20);
await A.keyboard.press('KeyZ');
// (Hauled in hand over hand: a few seconds for 16 m of rope.)
for (let i = 0; i < 30 && (await A.evaluate(() => !!slowTide.boat.anchored)); i++) await step(1);
const weighed = await A.evaluate(() => ({ anchored: !!slowTide.boat.anchored, said: window.__said.slice(-1) }));
await helmsman([-60, 450], 80);
const rough = await A.evaluate(() => {
  const b = slowTide.boat, out = { pitch: [], roll: [], heave: [] };
  for (let i = 0; i < 40; i++) {
    slowTide.advance(0.25, 30, false);
    out.pitch.push(b.pitch || 0);
    out.roll.push(b.roll || 0);
    out.heave.push(b.phys?.x?.[1] ?? b.pos.y);
  }
  const range = (a) => +((Math.max(...a) - Math.min(...a))).toFixed(3);
  return { speed: +b.speed.toFixed(1), pitch: +(range(out.pitch) * 57.3).toFixed(1), roll: +(range(out.roll) * 57.3).toFixed(1), heave: range(out.heave), wind: +(slowTide.conditions?.wind?.speed ?? 0).toFixed(1), said: window.__said.slice(-3) };
});
note('outbound', JSON.stringify(outbound), 'homeward', JSON.stringify(rough));
check('12 · the anchor up, and homeward in a stiffer blow: she works harder in it', !weighed.anchored && rough.heave > outbound.heave, JSON.stringify({ outbound: [outbound.heave, outbound.pitch], home: [rough.heave, rough.pitch], wind: rough.wind }));
await shot(A, 'j1-home-rough');
// (Into the marina: down the open water east of the fingers, then in along her slot to her berth,
// slow.)
for (const [to, secs, lever, near] of [[MARKS[0], 80, 0.7, 25], [[34, -12], 60, 0.5, 8], [[36, -51.7], 50, 0.2, 3], [[19, -53.8], 40, 0.1, 2.5]]) {
  await helmsman(to, secs, lever, near);
  note('home leg to', JSON.stringify(to), 'she is at', JSON.stringify(await where()));
}
await A.evaluate(() => { slowTide.boat.lever = 0; });
for (let i = 0; i < 10 && (await A.evaluate(() => slowTide.boat.speed)) > 0.3; i++) await step(1);

/* ---------- 13. Back in Willowhaven: what they bring home ---------- */
await A.keyboard.press('KeyZ');
await step(4);
const home = await A.evaluate(() => {
  const S = slowTide.state, V = (S.voyages || [])[S.voyages.length - 1];
  const log = S.yard.vessels?.rib?.log || [];
  return { tied: !!slowTide.boat.tie, voyage: V && { title: V.title, nm: V.nm, hours: V.hours, places: V.places, fish: V.fish, kept: V.kept, best: V.best, boats: V.boats, crew: V.crew, crewFish: V.crewFish, dives: V.dives, photos: V.photos, crewPhotos: V.crewPhotos, snaps: V.snaps }, papers: log.slice(-2).map((l) => `day ${l.day}: ${l.text}`), allPapers: log.filter((l) => l.day >= 6).map((l) => `day ${l.day}: ${l.text}`), photos: S.photos.length, said: window.__said.slice(-3) };
});
note('home', JSON.stringify(home));
check('13 · tied up at her berth', home.tied, JSON.stringify(home.said));
check('13 · the voyage written up in the journal', !!home.voyage, JSON.stringify(home.voyage));
check('13 · and in her papers', home.papers.length > 0, JSON.stringify(home.papers));
// (Everything in her papers that day: a knock names what she hit.)
note('her papers, all the day', JSON.stringify(home.allPapers));
const bertHome = await B.evaluate(() => ({ log: slowTide.state.log.slice(-2).map((e) => [e.sp, e.size, e.boat || null, e.helper || null]), voyages: (slowTide.state.voyages || []).length }));
note('Bert', JSON.stringify(bertHome));
check('13 · Bert’s catch in his log', bertHome.log.length > 0, JSON.stringify(bertHome));
// (J4) And in her voyage: Bert aboard for it, his fish counted as his.
// (J5) And the dives from her (hers, and Bert's if he went in), and her photograph.
const dives = home.voyage?.dives || [];
check('13 · the dives from her and her photograph in her voyage', dives.some((d) => !d.by && d.m > 5) && (!bertDived || dives.some((d) => d.by === 'Bert')) && (home.voyage?.photos || 0) >= 1, JSON.stringify({ dives, photos: home.voyage?.photos, crewPhotos: home.voyage?.crewPhotos, snaps: home.voyage?.snaps, bertDived }));
check('13 · Bert in her voyage, and his catch in it, as his', (home.voyage?.crew || []).includes('Bert') && home.voyage.crewFish >= bertHome.log.filter((e) => e[2] === 'rib').length && home.voyage.fish >= home.voyage.crewFish, JSON.stringify({ crew: home.voyage?.crew, fish: home.voyage?.fish, crewFish: home.voyage?.crewFish, bert: bertHome.log }));

console.log(errors.slice(0, 12).join('\n') || 'no errors');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
for (const b of browsers) await b.close();
process.exit(0);
