// The sonar watch (F4d): crewing in a friend's boat, your fish finder reads the sonar under her; a
// mark you make goes on your skipper's chart, and fish or bait coming under her are called to
// them (together.js seen/cleanSeen 'mark' and 'fish'; main.js seenHeard, sonarCall). Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { Together, cleanSeen } = await import('../src/together.js');
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

test('a sonar mark and a call as they come over the wire: on the charts, depths a sea has, plain words for the bottom', () => {
  assert.deepEqual(cleanSeen({ w: 'mark', x: 120.04, z: -40.66, d: 14.04, f: [12.51, 13.2, 9, 30], t: 'rock' }), { w: 'mark', x: 120, z: -40.7, d: 14, f: [12.5, 13.2, 9], t: 'rock' }, 'three fish at most');
  assert.equal(cleanSeen({ w: 'mark', x: 1, z: 2, d: 14, t: '<script>' }).t, 'the bottom', 'plain words for the bottom');
  assert.equal(cleanSeen({ w: 'mark', x: 1, z: 2, d: 14, t: 'weed over gravel' }).t, 'weed over gravel');
  assert.deepEqual(cleanSeen({ w: 'mark', x: 1, z: 2, d: 14, f: ['deep', null, 5] }).f, [5], 'only depths');
  assert.equal(cleanSeen({ w: 'mark', x: 1, z: 2 }), null, 'no depth, no mark');
  assert.equal(cleanSeen({ w: 'mark', x: 1, z: 2, d: 1e6 }).d, 400, 'no deeper than a sea');
  assert.deepEqual(cleanSeen({ w: 'fish', d: 13.96 }), { w: 'fish', d: 14, b: false });
  assert.deepEqual(cleanSeen({ w: 'fish', d: 6, b: 1 }), { w: 'fish', d: 6, b: true }, 'bait');
  assert.equal(cleanSeen({ w: 'fish' }), null);
});

test('the crewmate’s sonar mark and call reach their skipper and nobody else; a mark isn’t held up by a call', async () => {
  const hub = new Hub();
  const clock = { t: 100 };
  const mk = (name, extra = {}) => new Together({ config: () => CFG, name: () => name, kinds: ['row', 'skiff', 'console'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const T = [mk('Mags', { newCode: () => '5151' }), mk('Bert'), mk('Cass')];
  const heard = T.map(() => []);
  T.forEach((t, i) => { t.onEvent = (kind, p, d) => { if (kind === 'seen') heard[i].push([p.name, d]); }; });
  try {
    await T[0].host();
    await T[1].join('5151');
    await T[2].join('5151');
    await until(() => T.every((t) => t.others.length === 2));
    assert.ok(T[1].seen(T[0].id, { w: 'fish', d: 14 }));
    assert.ok(T[1].seen(T[0].id, { w: 'mark', x: 50, z: 60, d: 14, f: [12.5], t: 'rock' }), 'not held up by the call');
    assert.equal(T[1].seen(T[0].id, { w: 'fish', d: 15 }), false, 'not another call at once');
    await until(() => heard[0].length === 2);
    assert.deepEqual(heard[0], [['Bert', { w: 'fish', d: 14, b: false }], ['Bert', { w: 'mark', x: 50, z: 60, d: 14, f: [12.5], t: 'rock' }]]);
    await wait(30);
    assert.equal(heard[2].length, 0, 'only the skipper');
  } finally {
    T.forEach((t) => t.leave());
  }
});
