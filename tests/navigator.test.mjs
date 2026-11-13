// The navigator (F4a, see together.js navigate/cleanNav and main.js navTick): a crewmate's route as it
// comes over the wire, checked and held to the charts; sent to the skipper they're crewing for (and
// only them), stopped, and never in a flood. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { Together, cleanNav, NAV_POINTS } = await import('../src/together.js');
const { follow } = await import('../src/routes.js');
const { Hub } = await import('./fakeRealtime.mjs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 2000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await wait(5);
  }
}
const CFG = { url: 'https://example.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln' };
const clock = { t: 100 };
function player(hub, name, extra = {}) {
  const T = new Together({ config: () => CFG, name: () => name, kinds: ['row', 'skiff', 'console'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const update = T.update.bind(T);
  T.update = (dt, me) => {
    clock.t += dt;
    update(dt, me);
  };
  T.events = [];
  T.onEvent = (kind, p, data) => T.events.push([kind, p?.name ?? null, data ?? null]);
  return T;
}

test('a navigator’s route as it comes over the wire: checked, held to the charts, a few marks at most', () => {
  assert.deepEqual(cleanNav({ name: 'Round the Calf', pts: [[10.4, 20.6], [300, 400], [-50, 900]], leg: 2 }), { name: 'Round the Calf', pts: [[10, 21], [300, 400], [-50, 900]], leg: 2 });
  assert.equal(cleanNav({ pts: [[1, 2]] }), null, 'one mark is no route');
  assert.equal(cleanNav({ pts: [[1, 2], ['x', 3]] }), null, 'a mark that isn’t one');
  assert.equal(cleanNav({ pts: [[1, 2], { x: 3, z: 4 }] }), null);
  assert.equal(cleanNav({ off: true, pts: [[1, 2], [3, 4]] }), null, 'stopped');
  assert.equal(cleanNav('route'), null);
  const long = cleanNav({ pts: Array.from({ length: 40 }, (_, i) => [i, i]), leg: 30 });
  assert.equal(long.pts.length, NAV_POINTS, 'no more marks than a route holds');
  assert.equal(long.leg, 1, 'a leg that isn’t one of them goes back to the first');
  assert.deepEqual(cleanNav({ name: '<b>Out</b>', pts: [[1e9, -1e9], [0, 0]] }).pts[0], [3000, -3000], 'held to the charts');
  assert.equal(cleanNav({ name: '<b>Out</b>', pts: [[0, 0], [1, 1]] }).name, 'b Out /b', 'plain words only');
  assert.equal(cleanNav({ pts: [[0, 0], [1, 1]] }).name, 'their route');
});

test('navigating for your skipper: they hear your route, then that you’ve stopped; nobody else does; never a flood', async () => {
  const hub = new Hub();
  const a = player(hub, 'Tristan', { newCode: () => '4141' }), b = player(hub, 'Robin'), c = player(hub, 'Mags');
  try {
    await a.host();
    await b.join('4141');
    await c.join('4141');
    await until(() => a.others.length === 2 && b.others.length === 2 && c.others.length === 2);
    const navs = (T) => T.events.filter((e) => e[0] === 'nav');
    const route = { name: 'Round the Calf', pts: [[0, 0], [200, 0], [200, -200]], leg: 1 };
    assert.equal(a.navigate(b.id, route), true);
    await until(() => navs(b).length === 1);
    assert.deepEqual(navs(b)[0], ['nav', 'Tristan', { name: 'Round the Calf', pts: [[0, 0], [200, 0], [200, -200]], leg: 1 }]);
    assert.equal(a.navigate(b.id, route), false, 'not again at once');
    // Stopping goes at once, however soon after.
    assert.equal(a.navigate(b.id, null), true);
    await until(() => navs(b).length === 2);
    assert.deepEqual(navs(b)[1], ['nav', 'Tristan', null], 'stopped');
    // A flood of routes (a game that ignores the gap) is heard once.
    b.update(2, { m: 'foot', x: 0, z: 0, h: 0, a: 'stand' });
    for (let i = 0; i < 5; i++) {
      a.navSent = -99;
      a.navigate(b.id, { ...route, leg: 2 });
    }
    await until(() => navs(b).length === 3);
    await wait(30);
    assert.equal(navs(b).length, 3, 'one of the flood');
    assert.equal(navs(c).length, 0, 'only the skipper they’re navigating for');
    assert.equal(a.navigate('nobody', route), false, 'not to someone who isn’t here');
  } finally {
    a.leave();
    b.leave();
    c.leave();
  }
});

test('both games follow her round the marks the same way, from where her boat is', () => {
  const R = { pts: [[0, 0], [200, 0], [200, -200]] };
  // (The skipper's game and the navigator's both follow the one boat, each carrying the leg it's on:
  // the same leg from the same place. A mark counts as rounded within ROUND_M of it.)
  let leg = 1;
  for (const [x, z, want] of [[100, 0, 1], [150, -60, 1], [190, 0, 2], [200, -100, 2]]) {
    leg = follow(R, leg, x, z).leg;
    assert.equal(leg, want, `at ${x}, ${z}`);
  }
  assert.equal(follow(R, 2, 200, -190).done, true, 'the last mark');
  assert.equal(follow(R, 1, 200, -100).leg, 1, 'not on to the next until this one’s rounded');
});
