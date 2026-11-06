// Helping each other at sea (src/teamwork.js through src/together.js): netting a friend's fish
// beaten alongside (only when it's waiting for the net, only that fish, only by someone really there,
// the catch staying the angler's and the thanks going back), and a shoal marked for friends that
// follows the same shoal on every screen until it's fished out or ten minutes are up. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { Ecosystem } = await import('../src/world/ecosystem.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Teamwork, NET_REACH, MARK_LIFE } = await import('../src/teamwork.js');
const { Together } = await import('../src/together.js');
const { Hub } = await import('./fakeRealtime.mjs');

const habitat = createHabitat();
const freshEco = () => {
  const e = new Ecosystem(habitat);
  e.populate();
  return e;
};
const CFG = { url: 'https://example.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await wait(5);
  }
}

// Three friends in a session (Mags hosting), each with their own Teamwork, and a way to step time.
async function session() {
  const hub = new Hub();
  const clock = { t: 100 };
  const mk = (name, extra = {}) => new Together({ config: () => CFG, name: () => name, kinds: ['row', 'skiff'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const T = [mk('Mags', { newCode: () => '8181' }), mk('Bert'), mk('Cass')];
  const eco = freshEco();
  const W = T.map((t) => new Teamwork({ together: t, eco, lineEnd: () => null }));
  const heard = T.map(() => []);
  T.forEach((t, i) => { t.onEvent = (kind, p, data) => heard[i].push({ kind, p, data }); });
  await T[0].host();
  await T[1].join('8181');
  await T[2].join('8181');
  await until(() => T.every((t) => t.others.length === 2));
  const poses = [{ m: 'boat', k: 'row', x: 50, z: 60, h: 0 }, { m: 'boat', k: 'skiff', x: 54, z: 60, h: 0 }, { m: 'boat', k: 'row', x: 90, z: 60, h: 0 }];
  const step = async (secs) => {
    for (let i = 0; i < secs * 30; i++) {
      clock.t += 1 / 30;
      T.forEach((t, k) => t.update(1 / 30, poses[k]));
      if (i % 10 === 0) await wait(2);
    }
    await wait(20);
  };
  const end = async () => {
    T.forEach((t) => t.leave());
    await until(() => hub.sockets.size === 0);
  };
  return { T, W, eco, heard, poses, step, end, clock };
}

test('netting a friend’s fish: only when it’s beaten alongside, only by someone by it; the catch stays theirs and the thanks come back', async () => {
  const { T, W, heard, poses, step, end } = await session();
  // Mags is playing a fish (fish 42) close by her boat; it isn't beaten yet.
  poses[0] = { ...poses[0], f: true, o: true, r: 'float', i: 'worm', ex: 52, ez: 62, tn: 0.5, mv: 'run', hk: 42 };
  await step(1);
  assert.equal(W[1].netTarget({ x: 54, z: 60 }), null, 'nothing to net while it’s still fighting');
  // Beaten and alongside: Bert, a couple of metres off, can net it for her; Cass, far off, can't.
  poses[0] = { ...poses[0], mv: undefined, nt: 1 };
  await step(1);
  const target = W[1].netTarget({ x: 53, z: 61 });
  assert.ok(target, 'Bert can reach it');
  assert.equal(target.p.id, T[0].id);
  assert.equal(target.f, 42);
  assert.equal(W[2].netTarget({ x: 90, z: 60 }), null, 'Cass is too far off');
  assert.equal(W[1].netTarget({ x: 52 + NET_REACH + 1, z: 62 }), null, 'just out of reach is out of reach');
  // Bert nets it: the word reaches Mags alone.
  assert.ok(W[1].net(target));
  await until(() => heard[0].some((h) => h.kind === 'help'));
  const h = heard[0].find((x) => x.kind === 'help');
  assert.equal(h.p.id, T[1].id);
  assert.deepEqual([h.data.e, h.data.f], ['net', 42]);
  assert.equal(heard[2].some((x) => x.kind === 'help'), false, 'not to Cass');
  // Mags's game checks: her fish 42, waiting for the net, Bert by it. Then into the net, and thanks.
  const fight = { atNet: true, agent: { id: 42 } }, at = { x: 52, z: 62 };
  const bert = T[0].peers.get(T[1].id);
  assert.equal(W[0].mayNet(bert, 42, fight, at), true);
  assert.equal(W[0].mayNet(bert, 43, fight, at), false, 'not some other fish');
  assert.equal(W[0].mayNet(bert, 42, { ...fight, atNet: false }, at), false, 'not while it’s still fighting');
  assert.equal(W[0].mayNet(bert, 42, null, at), false, 'not once it’s gone');
  assert.equal(W[0].mayNet(T[0].peers.get(T[2].id), 42, fight, at), false, 'not by someone nowhere near');
  await step(0.6);
  assert.ok(W[0].thank(bert, 42, 'European seabass', 2.4));
  await until(() => heard[1].some((x) => x.kind === 'help' && x.data.e === 'thanks'));
  const thanks = heard[1].find((x) => x.data?.e === 'thanks');
  assert.equal(thanks.data.sp, 'European seabass');
  assert.equal(thanks.data.kg, 2.4);
  // Words meant for someone else, or junk, are ignored.
  const helps = () => heard[2].filter((x) => x.kind === 'help').length, before = helps();
  T[1].rt.send('help', { id: T[1].id, to: T[0].id, e: 'net', f: 42 });
  T[1].rt.send('help', { id: T[1].id, to: T[2].id, e: 'explode', f: 42 });
  T[1].rt.send('help', { id: T[1].id, to: T[2].id, e: 'net', f: 'x' });
  await step(0.5);
  assert.equal(helps(), before, 'nothing reached Cass');
  await end();
});

test('a shoal marked for friends: the same shoal on every screen, followed as it moves, until it’s fished out or ten minutes are up', async () => {
  const { T, W, eco, heard, step, end, clock } = await session();
  const s = eco.schools.find((q) => q.members.length >= 5);
  // Bert is by it and marks it.
  assert.equal(W[1].shoalNear({ x: s.x + 20, z: s.z }), s);
  assert.equal(W[1].shoalNear({ x: s.x + 500, z: s.z + 500 }) === s, false, 'not from far off');
  assert.ok(W[1].mark(s));
  assert.equal(W[1].mark(s), false, 'a moment between marks');
  await until(() => heard[0].some((h) => h.kind === 'shoal') && heard[2].some((h) => h.kind === 'shoal'));
  for (const i of [0, 2]) {
    const h = heard[i].find((x) => x.kind === 'shoal');
    assert.equal(W[i].heard(h.p, h.data), s, 'the very shoal');
  }
  // It moves: the mark goes with it, on every screen.
  s.x += 30;
  s.z -= 12;
  for (const i of [0, 1, 2]) {
    const m = W[i].live();
    assert.equal(m.length, 1);
    assert.equal(m[0].x, s.x);
    assert.equal(m[0].z, s.z);
    assert.match(m[0].name, i === 1 ? /^Your/ : /^Bert/);
  }
  // A shoal that isn't one is turned away.
  assert.equal(W[0].heard(T[0].peers.get(T[1].id), { s: 999999, x: 0, z: 0 }), null);
  // Fished out: the mark goes.
  const was = s.members.map((a) => a.state);
  for (const a of s.members) a.state = 'gone';
  assert.equal(W[0].live().length, 0, 'every fish in it caught');
  s.members.forEach((a, k) => { a.state = was[k]; });
  // Ten minutes on, a fresh mark from Bert has gone too.
  await step(4.2);
  assert.ok(W[1].mark(s));
  await until(() => heard[2].filter((h) => h.kind === 'shoal').length === 2);
  const h2 = heard[2].filter((x) => x.kind === 'shoal')[1];
  W[2].heard(h2.p, h2.data);
  assert.equal(W[2].live().length, 1);
  clock.t += MARK_LIFE + 1;
  T[2].clock += MARK_LIFE + 1;
  assert.equal(W[2].live().length, 0, 'gone after ten minutes');
  await end();
});
