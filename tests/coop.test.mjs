// One world when playing together (R1): the world clock (world/clock.js), the weather
// (world/weather.js), the world the host shares (together.js), and two players through a stand-in
// for Supabase Realtime seeing the same dusk, rain, tide and season, through a host's sleep, a
// reload and a leave, while each keeps their own day.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { WorldClock, advance, rateAt, HOUR_SECONDS, NIGHT_RATE } = await import('../src/world/clock.js');
const { SKIES, SKY_IDS, createWeather, stepWeather, skyOf } = await import('../src/world/weather.js');
const { Together, cleanWorld, explain, WORLD_V } = await import('../src/together.js');
const { tideAt } = await import('../src/world/tide.js');
const { seasonOf, sunTimes } = await import('../src/world/season.js');
const { Hub } = await import('./fakeRealtime.mjs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 2000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await wait(5);
  }
}

/* ---------- the clocks ---------- */

test('your own clock runs as it always has: an hour each 40 seconds, faster at night, a new day at midnight', () => {
  const noon = 5 * 24 + 12, night = 5 * 24 + sunTimes(5 * 24).set + 2;
  assert.equal(rateAt(noon), 1 / HOUR_SECONDS);
  assert.equal(rateAt(night), NIGHT_RATE / HOUR_SECONDS);
  assert.equal(rateAt(noon, 30), 30 / HOUR_SECONDS);
  // (The same night as the sun sets it, through the year.)
  const sun = sunTimes(200 * 24);
  assert.equal(rateAt(200 * 24 + sun.set + 2), NIGHT_RATE / HOUR_SECONDS);
  assert.equal(rateAt(200 * 24 + sun.set + 0.5), 1 / HOUR_SECONDS);
  const C = { day: 5, hour: 23.99 };
  const h = advance(C, 1);
  assert.equal(C.day, 6);
  assert.ok(Math.abs(C.hour - (23.99 + h - 24)) < 1e-9);
  const D = { day: 5, hour: 12 };
  advance(D, 40);
  assert.ok(Math.abs(D.hour - 13) < 1e-9);
});

test('on your own, the world clock is your clock exactly, every frame', () => {
  const own = { day: 7, hour: 9 };
  const W = new WorldClock(() => own.day * 24 + own.hour);
  for (let i = 0; i < 200; i++) {
    advance(own, 1 / 60, i > 100 ? 30 : 1);
    W.update(1 / 60, i / 60);
    assert.equal(W.abs, own.day * 24 + own.hour);
  }
  assert.equal(W.following, false);
  assert.equal(W.day, 7);
});

// Frames of the world clock: the host at `host(now)`, running at `rate`, heard every `every` seconds.
function follow(W, seconds, host, rate, { every = 2, t0 = 0 } = {}) {
  const shown = [];
  let heardAt = -1e9;
  for (let now = t0; now < t0 + seconds; now += 1 / 60) {
    if (now - heardAt >= every) {
      W.hear(host(now), rate, now);
      heardAt = now;
    }
    W.update(1 / 60, now);
    shown.push(W.abs);
  }
  return shown;
}

test('joining, the world clock sweeps to the host’s time in a few seconds, then keeps it', () => {
  const own = 3 * 24 + 11; // day 3, 11 am
  const W = new WorldClock(() => own);
  const rate = 1 / HOUR_SECONDS;
  const host = (now) => 12 * 24 + 19.6 + rate * now; // day 12, 7.36 pm
  const shown = follow(W, 6, host, rate);
  assert.equal(W.following, true);
  // Days apart: the calendar goes at once, the hours sweep (no frame jumps more than a few hours,
  // after the first).
  for (let i = 2; i < shown.length; i++) assert.ok(shown[i] - shown[i - 1] < 0.6, `frame ${i}: ${(shown[i] - shown[i - 1]).toFixed(2)} h`);
  assert.ok(Math.abs(W.abs - host(6)) < 0.01, `${W.abs} vs ${host(6)}`);
  assert.equal(W.day, 12);
  // Kept, between the host's words, at the host's own pace.
  const later = follow(W, 10, host, rate, { t0: 6 });
  for (let i = 1; i < later.length; i++) assert.ok(later[i] >= later[i - 1], 'never runs backwards');
  assert.ok(Math.abs(W.abs - host(16)) < 0.005);
});

test('the host sleeping the night sweeps past for everyone; leaving, your own time comes back', () => {
  let own = 3 * 24 + 11;
  const W = new WorldClock(() => own);
  const rate = 1 / HOUR_SECONDS;
  let slept = 0;
  const host = (now) => 12 * 24 + 22 + rate * now + slept;
  follow(W, 5, host, rate);
  slept = 8.5; // to 6.30 the next morning
  const shown = follow(W, 5, host, rate, { t0: 5 });
  assert.ok(Math.abs(W.abs - host(10)) < 0.01);
  for (let i = 1; i < shown.length; i++) assert.ok(shown[i] - shown[i - 1] < 0.6, 'a sweep, not a jump');
  // Leaving: back to your own (which ran on meanwhile), sweeping, then exactly yours again.
  W.release();
  for (let i = 0; i < 300; i++) {
    own += rate / 60;
    W.update(1 / 60, 10 + i / 60);
  }
  assert.equal(W.following, false);
  assert.equal(W.sweeping, false);
  assert.equal(W.abs, own);
});

/* ---------- the weather ---------- */

test('the weather module: saved skies come back, a chosen sky holds, and the host’s is followed', () => {
  const W = createWeather({ state: 'light', cloud: 0.8, rain: 0.3, storm: 0, timer: 99 });
  assert.deepEqual([W.state, W.cloud, W.rain, W.timer], ['light', 0.8, 0.3, 99]);
  assert.equal(W.target, SKIES.light.rain);
  assert.equal(createWeather({ state: 'nonsense' }).state, 'partly');
  assert.equal(createWeather(null, { mode: 'storm' }).state, 'storm');
  for (let i = 0; i < 600; i++) assert.equal(stepWeather(W, 1 / 30, { mode: 'clear' }), 'chosen');
  assert.equal(W.state, 'clear');
  assert.ok(W.rain < 0.01);
  // Following the host: their sky, whatever you chose.
  const host = { state: 'heavy', cloud: 1, rain: 0.92, storm: 0 };
  for (let i = 0; i < 300; i++) assert.equal(stepWeather(W, 1 / 30, { mode: 'clear', host }), 'host');
  assert.equal(W.state, 'heavy');
  assert.ok(Math.abs(W.rain - 0.92) < 0.01);
  // Left to itself, it wanders (and says so).
  const A = createWeather(null);
  A.timer = 0;
  assert.equal(stepWeather(A, 1, { mode: 'auto', abs: 30 * 24 + 12 }), 'auto');
  assert.ok(SKY_IDS.includes(A.state));
  assert.deepEqual(Object.keys(skyOf(A)).sort(), ['cloud', 'rain', 'state', 'storm', 'timer']);
});

/* ---------- the shared world, as sent ---------- */

const WORLD = { v: WORLD_V, abs: 300.5, rate: 0.025, sky: { state: 'heavy', cloud: 1, rain: 0.9, storm: 0 }, wind: { from: 3.9, speed: 9 }, sea: 'auto', colour: 0.4 };

test('the shared world is checked: a newer one, junk or a sky that isn’t one are refused', () => {
  assert.deepEqual(cleanWorld(WORLD, SKY_IDS), { ...WORLD });
  assert.equal(cleanWorld({ ...WORLD, v: WORLD_V + 1 }), null);
  assert.equal(cleanWorld({ ...WORLD, abs: NaN }), null);
  assert.equal(cleanWorld({ ...WORLD, rate: '1' }), null);
  assert.equal(cleanWorld({ ...WORLD, sky: { ...WORLD.sky, state: 'blizzard' } }, SKY_IDS), null);
  assert.equal(cleanWorld({ ...WORLD, wind: null }), null);
  assert.equal(cleanWorld(null), null);
  const odd = cleanWorld({ ...WORLD, sea: '<b>rough</b>', colour: 9, rate: 400, sky: { ...WORLD.sky, rain: -3 } }, SKY_IDS);
  assert.equal(odd.sea, 'auto');
  assert.equal(odd.colour, 1);
  assert.equal(odd.rate, 5);
  assert.equal(odd.sky.rain, 0);
});

test('when the online service can’t be reached or says no, the words say what to do', () => {
  assert.match(explain(new Error('couldn’t connect')), /paused.*Supabase dashboard/);
  assert.match(explain(new Error('the connection timed out')), /restore it/);
  assert.match(explain(new Error('Too many joins per second')), /allowance may be used up/);
  assert.match(explain(new Error('UnableToConnectToProject')), /said no \(UnableToConnectToProject\)/);
});

/* ---------- two players, one world ---------- */

const CFG = { url: 'https://example.supabase.co', anonKey: 'a.b.c' };
// A player: their own clock and sky, the world clock and the session, all on a shared fake time.
function player(hub, name, time, { day, hour, sky, store = null, code = null }) {
  const own = { day, hour };
  const P = {
    own, name,
    weather: createWeather(null, { mode: sky }),
    mode: sky,
    T: new Together({ config: () => CFG, name: () => name, skies: SKY_IDS, WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => time.now, store, newCode: () => code }),
  };
  P.clock = new WorldClock(() => P.own.day * 24 + P.own.hour);
  P.wind = { from: 1, speed: 4 };
  P.T.worldSource = () => ({ abs: P.own.day * 24 + P.own.hour, rate: rateAt(P.own.day * 24 + P.own.hour), sky: { ...P.weather }, wind: P.wind, sea: 'auto', colour: 0.2 });
  P.events = [];
  P.T.onEvent = (kind, p, data) => P.events.push([kind, p?.name ?? null, data ?? null]);
  return P;
}
// One frame for everyone: time runs, the world is shared and followed, the sky follows it.
function frame(players, time, dt = 1 / 30) {
  time.now += dt;
  for (const P of players) {
    advance(P.own, dt);
    P.T.update(dt, null);
    const H = P.T.hostWorld();
    if (H) P.clock.hear(H.abs, H.rate, H.heard);
    else if (P.clock.following) P.clock.release();
    P.clock.update(dt, time.now);
    stepWeather(P.weather, dt, { mode: P.mode, abs: P.clock.abs, host: H?.sky ?? null });
  }
}
async function run(players, time, seconds, dt = 1 / 30) {
  for (let i = 0; i < seconds / dt; i++) {
    frame(players, time, dt);
    if (i % 3 === 0) await wait(1); // (the stand-in delivers between frames)
  }
}
const same = (A, B) => {
  assert.ok(Math.abs(A.clock.abs - B.clock.abs) < 0.02, `time: ${A.clock.abs.toFixed(3)} vs ${B.clock.abs.toFixed(3)}`);
  assert.equal(tideAt(A.clock.abs).phase, tideAt(B.clock.abs).phase);
  assert.equal(seasonOf(A.clock.day).name, seasonOf(B.clock.day).name);
  assert.equal(A.weather.state, B.weather.state);
  assert.ok(Math.abs(A.weather.rain - B.weather.rain) < 0.05, `rain: ${A.weather.rain} vs ${B.weather.rain}`);
};

test('two players share one dusk, one rain, one tide, while each keeps their own day', async () => {
  const hub = new Hub(), time = { now: 1000 };
  const mags = player(hub, 'Mags', time, { day: 40, hour: 19.6, sky: 'heavy', code: '4821' });
  const bert = player(hub, 'Bert', time, { day: 3, hour: 11, sky: 'clear' });
  for (let i = 0; i < 300; i++) stepWeather(mags.weather, 1 / 30, { mode: 'heavy' });
  assert.equal(await mags.T.host(), true);
  assert.equal(await bert.T.join('4821'), true);
  await run([mags, bert], time, 6);
  assert.equal(bert.clock.following, true);
  assert.equal(mags.clock.following, false, 'the host keeps their own time');
  same(mags, bert);
  assert.equal(bert.clock.day, 40);
  assert.equal(bert.own.day, 3, 'Bert’s own day carries on beneath it');

  // Mags sleeps the night: Bert sees it go.
  mags.own.hour = 6.5;
  mags.own.day += 1;
  mags.mode = 'partly';
  await run([mags, bert], time, 12);
  same(mags, bert);

  // Bert leaves: his own time and sky come back.
  bert.T.leave();
  await run([mags, bert], time, 5);
  assert.equal(bert.clock.following, false);
  assert.equal(bert.clock.abs, bert.own.day * 24 + bert.own.hour);
  assert.equal(bert.weather.state, 'clear');
  assert.equal(bert.own.day, 3);
  mags.T.leave();
});

test('a host who reloads is back in their own session, and the others follow again', async () => {
  const hub = new Hub(), time = { now: 2000 };
  const store = new MemoryStorage();
  const mags = player(hub, 'Mags', time, { day: 10, hour: 20, sky: 'light', store, code: '1357' });
  const bert = player(hub, 'Bert', time, { day: 2, hour: 9, sky: 'clear' });
  for (let i = 0; i < 600; i++) stepWeather(mags.weather, 1 / 30, { mode: 'light' });
  await mags.T.host();
  await bert.T.join('1357');
  await run([mags, bert], time, 4);
  same(mags, bert);
  // The page reloads: the host steps out quietly (no "ended"), and Bert waits.
  mags.T.suspend();
  await run([bert], time, 10, 0.5);
  assert.equal(bert.T.status, 'joined');
  assert.ok(bert.events.some((e) => e[0] === 'leave' && e[2]?.host));
  assert.equal(bert.clock.following, false, 'his own sky while the host is away');
  // Back after the reload: the same code, hosting again, and Bert follows.
  const again = player(hub, 'Mags', time, { day: 10, hour: 20.2, sky: 'light', store });
  again.own = mags.own;
  again.weather = mags.weather;
  again.mode = mags.mode;
  again.T.worldSource = mags.T.worldSource;
  assert.equal(await again.T.resume(), true);
  assert.equal(again.T.status, 'hosting');
  assert.equal(again.T.code, '1357');
  await run([again, bert], time, 8);
  assert.equal(bert.clock.following, true);
  same(again, bert);
  // A reload of nothing in particular resumes nothing.
  assert.equal(await again.T.resume(), false);
  again.T.leave();
  await until(() => bert.T.status === 'off');
});

test('a host who doesn’t come back: after a minute the session ends, and your own world is back', async () => {
  const hub = new Hub(), time = { now: 3000 };
  const mags = player(hub, 'Mags', time, { day: 10, hour: 20, sky: 'heavy', code: '2468' });
  const bert = player(hub, 'Bert', time, { day: 2, hour: 9, sky: 'clear' });
  await mags.T.host();
  await bert.T.join('2468');
  await run([mags, bert], time, 3);
  mags.T.suspend();
  await run([bert], time, 30, 0.5);
  assert.equal(bert.T.status, 'joined', 'still waiting at 30 s');
  await run([bert], time, 40, 0.5);
  assert.equal(bert.T.status, 'off');
  assert.match(bert.T.message, /Mags has gone/);
  assert.ok(bert.events.some((e) => e[0] === 'ended' && e[2]?.hostGone));
  await run([bert], time, 5);
  assert.equal(bert.clock.following, false);
  assert.equal(bert.weather.state, 'clear');
});

test('only the host’s world counts, and a newer game’s world asks for a reload', async () => {
  const hub = new Hub(), time = { now: 4000 };
  const mags = player(hub, 'Mags', time, { day: 10, hour: 12, sky: 'clear', code: '1111' });
  const bert = player(hub, 'Bert', time, { day: 2, hour: 9, sky: 'clear' });
  const ruth = player(hub, 'Ruth', time, { day: 5, hour: 3, sky: 'storm' });
  await mags.T.host();
  await bert.T.join('1111');
  await ruth.T.join('1111');
  await run([mags, bert, ruth], time, 3);
  // Ruth (not the host) sends a world: nobody takes it.
  ruth.T.rt.send('world', { id: ruth.T.id, w: { ...WORLD, abs: 5 } });
  await run([mags, bert, ruth], time, 2);
  assert.ok(Math.abs(bert.clock.abs - (mags.own.day * 24 + mags.own.hour)) < 0.05);
  // The host on a newer version: kept clear of, with a word.
  mags.T.rt.send('world', { id: mags.T.id, w: { ...WORLD, v: WORLD_V + 1 } });
  await run([bert], time, 0.5);
  assert.equal(bert.T.newer, true);
  assert.match(bert.T.message, /newer version/);
  mags.T.leave();
  await until(() => bert.T.status === 'off' && ruth.T.status === 'off');
});
