// Crewing for a friend (src/crew.js through src/together.js): standing in their boat clear of her
// sides and the helm, asking for the helm and being handed it only by the boat's own skipper, the
// wheel and lever going to their game, going slack when the word stops, taken back at a touch,
// strangers and anyone not aboard ignored, and a crew's pose naming the boat. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { HULLS } = await import('../src/boat.js');
const { Crew, crewSpot, WHEEL_STALE } = await import('../src/crew.js');
const { Together, cleanPose } = await import('../src/together.js');
const { Hub } = await import('./fakeRealtime.mjs');

test('crew stand inside every boat, clear of her sides, her ends and the helm, and walk about her without leaving her', () => {
  for (const [kind, H] of Object.entries(HULLS)) {
    const s = crewSpot(H);
    assert.ok(Math.abs(s.x) <= Math.max(0.05, H.B - 0.35) + 1e-9, `${kind}: across`);
    assert.ok(Math.abs(s.z) <= H.L / 2 - 0.5 + 1e-9, `${kind}: fore and aft`);
    if (H.L > 4) assert.ok(Math.abs(s.z - (H.seatZ ?? 0)) >= 1, `${kind}: clear of the helm`);
  }
  const T = { clock: 0, id: 'me', peers: new Map(), crewWord: () => true };
  const C = new Crew({ together: T }), H = HULLS.console;
  C.board('skipper', H);
  for (let i = 0; i < 300; i++) C.walk(1, 1, H, 1 / 30);
  assert.ok(C.on.x <= H.B - 0.35 + 1e-9 && C.on.z <= H.L / 2 - 0.5 + 1e-9, 'walking stops at her side and her bow');
  for (let i = 0; i < 600; i++) C.walk(-1, -1, H, 1 / 30);
  assert.ok(C.on.x >= -(H.B - 0.35) - 1e-9 && C.on.z >= -(H.L / 2 - 0.5) - 1e-9, 'and at her other side and her stern');
});

test('a crew’s pose names the boat and where in her; junk is dropped', () => {
  const P = cleanPose({ m: 'foot', x: 10, z: 20, h: 0, a: 'stand', cr: 'abc-123', cx: 0.4, cz: -2.1 });
  assert.deepEqual([P.cr, P.cx, P.cz], ['abc-123', 0.4, -2.1]);
  assert.equal(cleanPose({ m: 'foot', x: 10, z: 20, h: 0, cr: '<b>', cx: 0, cz: 0 }).cr, undefined);
  assert.equal(cleanPose({ m: 'foot', x: 10, z: 20, h: 0, cr: 'abc', cx: 'x', cz: 0 }).cr, undefined);
  assert.equal(cleanPose({ m: 'boat', k: 'row', x: 10, z: 20, h: 0, cr: 'abc', cx: 0, cz: 0 }).cr, undefined, 'only someone on foot crews');
  assert.equal(cleanPose({ m: 'foot', x: 10, z: 20, h: 0, cr: 'abc', cx: 99, cz: 0 }).cx, 3, 'held inside a boat’s size');
});

/* ---------- through a session (a stand-in for Supabase Realtime) ---------- */

const CFG = { url: 'https://example.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await wait(5);
  }
}

test('the helm: asked of the skipper, handed over, the wheel going to their game, slack when the word stops, taken back at a touch; strangers ignored', async () => {
  const hub = new Hub();
  const clock = { t: 100 };
  const mk = (name, extra = {}) => new Together({ config: () => CFG, name: () => name, kinds: ['row', 'skiff', 'console'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const T = [mk('Mags', { newCode: () => '9191' }), mk('Bert'), mk('Cass')];
  const K = T.map((t) => new Crew({ together: t }));
  const said = T.map(() => []);
  T.forEach((t, i) => { t.onEvent = (kind, p, d) => { if (kind === 'crew') said[i].push(K[i].heard(p, d)); }; });
  await T[0].host();
  await T[1].join('9191');
  await T[2].join('9191');
  await until(() => T.every((t) => t.others.length === 2));
  // Mags in her centre console; Bert steps aboard and crews; Cass is in her own boat nearby.
  K[1].board(T[0].id, HULLS.console);
  const poses = () => [
    { m: 'boat', k: 'console', x: 50, z: 60, h: 0, f: true },
    { m: 'foot', x: 50.3, z: 58, h: 0, a: 'stand', ...(K[1].on ? { cr: T[0].id, cx: K[1].on.x, cz: K[1].on.z } : {}) },
    { m: 'boat', k: 'row', x: 60, z: 60, h: 0 },
  ];
  const step = async (secs, each = null) => {
    for (let i = 0; i < secs * 30; i++) {
      clock.t += 1 / 30;
      const P = poses();
      T.forEach((t, k) => t.update(1 / 30, P[k]));
      each?.();
      if (i % 10 === 0) await wait(2);
    }
    await wait(20);
  };
  await step(1);
  const bert = T[0].peers.get(T[1].id), cass = T[0].peers.get(T[2].id);
  assert.equal(K[0].aboard(bert), true, 'Bert’s pose says he’s aboard Mags’s boat');
  assert.equal(K[0].aboard(cass), false);
  // Cass, not aboard, asks for Mags's helm: nothing comes of it.
  T[2].crewWord(T[0].id, 'helm');
  await step(0.4);
  assert.equal(said[0].filter((r) => r === 'asked').length, 0, 'not from someone who isn’t aboard');
  // Bert asks; Mags's game hands it over.
  assert.ok(K[1].askHelm());
  await until(() => said[0].includes('asked'));
  K[0].grant(bert);
  await until(() => said[1].includes('granted'));
  assert.equal(K[1].on.helm, true);
  // Bert's wheel and lever go to Mags's game.
  await step(0.6, () => K[1].sendWheel(1 / 30, 1, -0.5));
  const w = K[0].wheel();
  assert.deepEqual([w.ti, w.si], [1, -0.5], 'his wheel and lever, in her game');
  // Cass tries to steer: ignored.
  T[2].crewWord(T[0].id, 'wheel', { ti: -1, si: 1 });
  await step(0.3);
  assert.deepEqual([K[0].wheel().ti, K[0].wheel().si], [1, -0.5]);
  // Bert's word stops coming (his game's paused): the wheel goes slack.
  await step(WHEEL_STALE + 0.4);
  assert.equal(K[0].wheel().slack, true);
  assert.deepEqual([K[0].wheel().ti, K[0].wheel().si], [0, 0]);
  // Mags touches the controls at the wheel: hers again, and Bert's told.
  K[0].takeBack();
  await until(() => said[1].includes('returned'));
  assert.equal(K[1].on.helm, false);
  assert.equal(K[0].wheel(), null);
  // Asked and given again, then handed back by Bert.
  await step(0.4);
  K[1].askHelm();
  await until(() => said[0].filter((r) => r === 'asked').length === 2);
  K[0].grant(bert);
  await until(() => K[1].on.helm);
  K[1].handBack();
  await until(() => said[0].includes('handed'));
  assert.equal(K[0].wheel(), null);
  // Given once more, and Bert steps off: the helm is hers again without a word.
  await step(0.4); // (asking again takes a moment)
  K[1].askHelm();
  await until(() => said[0].filter((r) => r === 'asked').length === 3);
  K[0].grant(bert);
  await until(() => K[1].on.helm);
  K[1].on.helm = false; // (stepping off: the pose no longer names her boat)
  K[1].on = null;
  await step(0.6);
  assert.equal(K[0].wheel(), null, 'nobody aboard, nobody at the helm');
  // A word from the skipper to someone not crewing for them changes nothing.
  K[0].grant(T[0].peers.get(T[2].id));
  await step(0.4);
  assert.equal(said[2].includes('granted'), false);
  T.forEach((t) => t.leave());
  await until(() => hub.sockets.size === 0);
});
