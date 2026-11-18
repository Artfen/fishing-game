// Playing together aboard the liveaboard (L7 of docs/LIVEABOARD.md), through the real sending path
// (src/together.js, over a stand-in for Supabase Realtime): a second boat of a kind sent by her own
// id, fishing or not; the skipper's place on her deck; her platform and the tender on it; a
// crewmate's height aboard (the cabins lie under the pilothouse); and a word when two games differ.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { Together, cleanPose, POSE_V } = await import('../src/together.js');
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
const KINDS = ['row', 'skiff', 'rib', 'tender', 'trawler'];
function player(hub, name, extra = {}) {
  const T = new Together({ config: () => CFG, name: () => name, kinds: KINDS, gear: { rods: ['spin'], items: ['spinner'] }, WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const update = T.update.bind(T);
  T.update = (dt, me) => {
    clock.t += dt;
    update(dt, me);
  };
  T.events = [];
  T.onEvent = (kind, p, data) => T.events.push([kind, p?.name ?? null, data ?? null]);
  return T;
}
async function pair() {
  const hub = new Hub(), a = player(hub, 'Mags', { newCode: () => '4821' }), b = player(hub, 'Bert');
  await a.host();
  await b.join('4821');
  await until(() => a.others.length === 1 && b.others.length === 1);
  return { a, b };
}
// Mags sends a pose; what Bert sees of it, once it's come across.
async function across(a, b, pose, until_ = (p) => p) {
  for (let i = 0; i < 40; i++) {
    a.update(0.3, pose);
    b.update(0.3, { m: 'foot', x: 0, z: 0, h: 0, a: 'stand' });
    await wait(5);
    const P = b.others[0]?.pose;
    if (P && until_(P)) return P;
  }
  throw new Error('never came across');
}

test('a second boat of a kind is sent by her own id, fishing or not (the tackle never taken for her)', async () => {
  const { a, b } = await pair();
  // Not fishing: her id comes across.
  let P = await across(a, b, { m: 'boat', k: 'rib', bi: 'rib~2', x: 10, z: 20, h: 1, f: false }, (p) => p.bi === 'rib~2');
  assert.equal(P.k, 'rib');
  // Fishing: still her id, and the tackle on the line as itself.
  P = await across(a, b, { m: 'boat', k: 'rib', bi: 'rib~2', x: 10, z: 20, h: 1, f: true, r: 'spin', i: 'spinner', ex: 14, ez: 22 }, (p) => p.f && p.i === 'spinner');
  assert.equal(P.bi, 'rib~2');
  // The first of a kind sends none; an id not of her kind is dropped.
  assert.equal(cleanPose({ m: 'boat', k: 'rib', x: 1, z: 1, h: 0 }, KINDS).bi, undefined);
  assert.equal(cleanPose({ m: 'boat', k: 'rib', bi: 'skiff~2', x: 1, z: 1, h: 0 }, KINDS).bi, undefined);
  a.leave();
  b.leave();
});

test('the skipper walking her deck, her platform, the tender on it, and a crewmate\'s height aboard', async () => {
  const { a, b } = await pair();
  const P = await across(a, b, { m: 'boat', k: 'trawler', x: 50, z: 60, h: 0.5, f: false, n: true, dk: [0.4, -5.3, 3.1, 1.71], pf: 0.5, tc: 'tender' }, (p) => p.dk && p.pf === 0.5);
  assert.deepEqual(P.dk, [0.4, -5.3, 3.1, 1.71]);
  assert.equal(P.tc, 'tender');
  // A crewmate below, under the pilothouse: their height comes with them.
  const C = await across(a, b, { m: 'foot', x: 50, z: 61, h: 0, a: 'stand', cr: 'someone', cx: 0.65, cz: 2.0, cy: 0.4 }, (p) => p.cr);
  assert.deepEqual([C.cx, C.cz, C.cy], [0.65, 2.0, 0.4]);
  // Out of range, it's kept within her (as every pose's numbers are); not what they say, dropped.
  const bad = cleanPose({ m: 'boat', k: 'trawler', x: 1, z: 1, h: 0, dk: [9, 1, 0], pf: 3, tc: 'trawler' }, KINDS);
  assert.deepEqual(bad.dk, [3, 1, 0]);
  assert.equal(bad.pf, 1);
  assert.equal(bad.tc, undefined, 'a tender of her own kind is no tender');
  assert.equal(cleanPose({ m: 'boat', k: 'trawler', x: 1, z: 1, h: 0, dk: 'here', tc: 'spinner' }, KINDS).dk, undefined);
  // (Her platform stands past her transom: a crewmate there is still aboard.)
  assert.equal(cleanPose({ m: 'foot', x: 1, z: 1, h: 0, cr: 'x', cx: 0, cz: -8.3 }, KINDS).cz, -8.3);
  a.leave();
  b.leave();
});

test('two games of different versions: a word to each, once', async () => {
  const { a, b } = await pair();
  const said = new Map([[a, []], [b, []]]);
  for (const T of [a, b]) {
    const changed = T.changed.bind(T);
    T.changed = (m) => (m && said.get(T).push(m), changed(m));
  }
  // Bert's game is older: its poses carry the old version (or none).
  const send = b.rt.send.bind(b.rt);
  b.rt.send = (kind, data) => send(kind, kind === 'pose' ? { ...data, v: POSE_V - 1 } : data);
  for (let i = 0; i < 10; i++) {
    a.update(0.3, { m: 'foot', x: 0, z: 0, h: 0, a: 'stand' });
    b.update(0.3, { m: 'foot', x: 3, z: 0, h: 0, a: 'walk' });
    await wait(5);
  }
  assert.equal(said.get(a).filter((m) => /older version/.test(m)).length, 1, 'once');
  // And a game meeting a newer one is told to reload (Mags's, as Bert's older game sees it).
  const sendA = a.rt.send.bind(a.rt);
  a.rt.send = (kind, data) => sendA(kind, kind === 'pose' ? { ...data, v: POSE_V + 1 } : data);
  for (let i = 0; i < 10; i++) {
    a.update(0.3, { m: 'foot', x: 1, z: 0, h: 0, a: 'walk' });
    b.update(0.3, { m: 'foot', x: 3, z: 0, h: 0, a: 'walk' });
    await wait(5);
  }
  await until(() => said.get(b).some((m) => /newer version/.test(m)));
  assert.ok(b.newer);
  a.leave();
  b.leave();
});

test('drawn as they are: the friend\'s skipper on her deck, her platform down, their tender on its chocks', async () => {
  const THREE = await import('three');
  const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
  globalThis.innerHeight ??= 800;
  const { VisitorView } = await import('../src/world/visitors.js');
  const view = new VisitorView(new THREE.Scene());
  const pose = cleanPose({ m: 'boat', k: 'trawler', x: 0, z: 2300, h: 0.4, n: true, dk: [0.3, -5.4, 3.1, 1.7], pf: 1, tc: 'tender' }, KINDS);
  const p = { id: 'mags', name: 'Mags', pose, view: pose, at: { x: 0, z: 2300, h: 0.4, v: 0 }, fleet: [] };
  for (let i = 0; i < 3; i++) view.update(1 / 30, i / 30, new Map([['mags', p]]), { from: { x: 0, z: 2290 } });
  const d = view.drawn.get('mags'), T = Object.values(d.boats).find((b) => b.kind === 'trawler'), tender = d.moored.tender;
  assert.ok(T?.group.visible, 'her');
  assert.ok(T.deck && Math.abs(T.deck.z + 5.4) < 1e-9 && T.deck.floor === 'aft', 'Mags on her aft deck, not at the wheel');
  assert.equal(T.platformDrop, 1, 'her platform down');
  assert.ok(tender?.group.visible, 'their tender');
  const local = T.body.worldToLocal(tender.group.position.clone());
  assert.ok(Math.abs(local.z - T.chocksAt()[2]) < 0.05 && Math.abs(local.x) < 0.05, 'on her chocks');
  // Back at the wheel: the deck's done with.
  const atWheel = cleanPose({ m: 'boat', k: 'trawler', x: 0, z: 2300, h: 0.4, n: true, pf: 0 }, KINDS);
  Object.assign(p, { pose: atWheel, view: atWheel });
  view.update(1 / 30, 0.2, new Map([['mags', p]]), { from: { x: 0, z: 2290 } });
  assert.equal(T.deck, null);
  assert.ok(!tender.group.visible, 'no tender on her chocks now');
});
