// The spotter and the photographer (F4c): a crewmate's eye counts for the skipper. Wildlife named
// through their binoculars aboard, and what's in a photograph they take aboard, go to the skipper
// they're crewing for (together.js seen/cleanSeen), and count for the skipper's Trust count and
// photo jobs (main.js seenHeard, contracts.js). Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { Together, cleanSeen } = await import('../src/together.js');
const K = await import('../src/contracts.js');
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

test('a sighting or a photograph as it comes over the wire: plain kinds only, a dozen of each at most, and something in it', () => {
  assert.deepEqual(cleanSeen({ w: 'spot', k: 'gannet', x: 120.6, z: -40.2 }), { w: 'spot', k: 'gannet', x: 121, z: -40 });
  assert.equal(cleanSeen({ w: 'spot', k: 'Gannet!', x: 1, z: 2 }), null, 'a kind that isn’t one');
  assert.equal(cleanSeen({ w: 'spot', k: 'gannet' }), null, 'nowhere');
  assert.deepEqual(cleanSeen({ w: 'spot', k: 'gannet', x: 1e9, z: -1e9 }), { w: 'spot', k: 'gannet', x: 3000, z: -3000 }, 'held to the charts');
  assert.deepEqual(cleanSeen({ w: 'snap', sea: ['commondolphin'], bow: 1, extra: 'x' }), { w: 'snap', sea: ['commondolphin'], life: [], nature: [], species: [], bow: true });
  const many = cleanSeen({ w: 'snap', species: Array.from({ length: 40 }, (_, i) => `fish${i}`), life: ['<b>', 7, 'heron'] });
  assert.equal(many.species.length, 12, 'a dozen at most');
  assert.deepEqual(many.life, ['heron'], 'plain kinds only');
  assert.equal(cleanSeen({ w: 'snap', bow: true }), null, 'nothing in it');
  assert.equal(cleanSeen({ w: 'look', k: 'gannet' }), null);
  assert.equal(cleanSeen('gannet'), null);
});

test('a crewmate’s sighting and photograph reach their skipper, nobody else, each sort once a second at most', async () => {
  const hub = new Hub();
  const clock = { t: 100 };
  const mk = (name, extra = {}) => new Together({ config: () => CFG, name: () => name, kinds: ['row', 'skiff', 'console'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const T = [mk('Mags', { newCode: () => '6363' }), mk('Bert'), mk('Cass')];
  const heard = T.map(() => []);
  T.forEach((t, i) => { t.onEvent = (kind, p, d) => { if (kind === 'seen') heard[i].push([p.name, d]); }; });
  try {
    await T[0].host();
    await T[1].join('6363');
    await T[2].join('6363');
    await until(() => T.every((t) => t.others.length === 2));
    // Bert names a gannet and, the same moment, keeps a photograph of dolphins on her bow.
    assert.ok(T[1].seen(T[0].id, { w: 'spot', k: 'gannet', x: 120, z: -40 }));
    assert.ok(T[1].seen(T[0].id, { w: 'snap', sea: ['commondolphin'], bow: true }), 'a photograph isn’t held up by a sighting');
    assert.equal(T[1].seen(T[0].id, { w: 'spot', k: 'tern', x: 1, z: 1 }), false, 'not another sighting at once');
    assert.equal(T[1].seen(T[0].id, { w: 'snap' }), false, 'nothing in it');
    assert.equal(T[1].seen('nobody', { w: 'spot', k: 'tern', x: 1, z: 1 }), false, 'not to someone who isn’t here');
    await until(() => heard[0].length === 2);
    assert.deepEqual(heard[0], [['Bert', { w: 'spot', k: 'gannet', x: 120, z: -40 }], ['Bert', { w: 'snap', sea: ['commondolphin'], life: [], nature: [], species: [], bow: true }]]);
    // A flood from a game that ignores the gap: Mags's hears one.
    for (let i = 0; i < 5; i++) {
      T[1].seen_spot_Sent = -99;
      T[1].seen(T[0].id, { w: 'spot', k: 'puffin', x: 5, z: 5 });
    }
    await wait(40);
    assert.equal(heard[0].length, 2, 'not within the second');
    T[0].update(1.2, { m: 'boat', k: 'console', x: 50, z: 60, h: 0 });
    T[1].seen_spot_Sent = -99;
    assert.ok(T[1].seen(T[0].id, { w: 'spot', k: 'puffin', x: 5, z: 5 }));
    await until(() => heard[0].length === 3);
    assert.equal(heard[2].length, 0, 'only the skipper they’re crewing for');
  } finally {
    T.forEach((t) => t.leave());
  }
});

test('what the photographer’s picture holds does the skipper’s job: dolphins on her bow for the Trust', () => {
  const take = (obj) => {
    const C = K.newContracts();
    C.board = { day: 1, region: 'home', offers: [{ id: 'job', tpl: 'special', cat: 'research', giver: 'ruth', title: 'T', story: 'S', goal: 'G', pay: 20, rep: 1, difficulty: 1, minutes: 10, coop: false, obj }] };
    K.accept(C, 'job', 0);
    return C;
  };
  // (As main.js seenHeard passes a crewmate's photograph on: its sea life, and the bow.)
  const snap = cleanSeen({ w: 'snap', sea: ['commondolphin'], bow: true });
  const C = take({ kind: 'photo', life: ['bottlenose', 'commondolphin', 'spotteddolphin'], bow: true });
  assert.equal(K.photographed(C, { life: snap.sea, bow: snap.bow, species: snap.species, nature: snap.nature, wild: snap.life }).length, 1);
  // A seabird count, from the spotter's binoculars: each kind once.
  const N = take({ kind: 'notes', where: 'binoculars', birds: true, n: 2 });
  assert.deepEqual(K.noted(N, 'binoculars', 'gannet', true), []);
  assert.deepEqual(K.noted(N, 'binoculars', 'gannet', true), [], 'the same kind again doesn’t count twice');
  assert.equal(K.noted(N, 'binoculars', 'puffin', true).length, 1);
});
