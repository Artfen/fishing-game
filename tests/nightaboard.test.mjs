// A night aboard an open boat (Part J3: src/nightaboard.js, cargo.js's bivvy roll, comfort.js's
// `open` night, together.js's asleep word). Found playing the brief's two-friends day through
// (docs/PLAYTHROUGH.md, finding 3): only the cabin boat and the yacht had anywhere to sleep, and
// the brief has them "remain overnight aboard their vessel", the RIB. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { turnIn, wakeOnDeck, turningIn } = await import('../src/nightaboard.js');
const { CARGO, SOLD, newCargo, cleanCargo, buy, putAboard, hasAboard, weightOf } = await import('../src/cargo.js');
const { stepComfort, newComfort, OPEN_WAKE } = await import('../src/comfort.js');
const { cleanPose } = await import('../src/together.js');

test('the chandlery sells a bivvy roll: aboard her it stays aboard, in the save too', () => {
  assert.ok(SOLD.includes('bivvy'));
  assert.equal(CARGO.bivvy.name, 'Bivvy roll');
  const c = newCargo();
  const r = buy(c, 'bivvy');
  assert.ok(r.ok);
  assert.equal(buy(c, 'bivvy').ok, false, 'one is enough: it holds two bags');
  assert.equal(hasAboard(c, 'rib', 'bivvy'), false, 'bought, it waits ashore');
  assert.ok(putAboard(c, r.item.uid, 'rib', { x: 0.3, z: -1.2 }).ok);
  assert.equal(hasAboard(c, 'rib', 'bivvy'), true);
  assert.equal(hasAboard(c, 'console', 'bivvy'), false, 'aboard her, not another');
  assert.equal(weightOf(r.item), 7, 'its weight goes into her load');
  const back = cleanCargo(JSON.parse(JSON.stringify(c)));
  assert.equal(hasAboard(back, 'rib', 'bivvy'), true, 'still aboard after a save and load');
  // (A second RIB by her own id: G8c.)
  const d = newCargo(), it = buy(d, 'bivvy').item;
  putAboard(d, it.uid, 'rib~2', { x: 0, z: 0 });
  assert.equal(hasAboard(cleanCargo(JSON.parse(JSON.stringify(d))), 'rib~2', 'bivvy'), true);
});

test('turning in: on an open deck, at anchor or tied up and still, with the roll aboard', () => {
  const rib = { cabin: false, deck: true, settled: true, bivvy: true, following: false };
  assert.deepEqual(turnIn(rib), { ok: true });
  // (Nothing to offer: the cabin boat has her bunk; a small boat no room to lie down; under way.)
  assert.equal(turnIn({ ...rib, cabin: true }), null);
  assert.equal(turnIn({ ...rib, deck: false }), null);
  assert.equal(turnIn({ ...rib, settled: false }), null);
  // (No roll aboard: says where to get one, rather than seeming to work.)
  const none = turnIn({ ...rib, bivvy: false });
  assert.equal(none.ok, false);
  assert.match(none.why, /bivvy roll from the chandlery in Willowhaven/);
  // (Playing together in a friend's world, time is theirs to pass.)
  assert.deepEqual(turnIn({ ...rib, following: true }), { ok: false, host: true });
});

test('a night in a bivvy: warm in the bag, but waking to the chill, and damp clothes stay damp', () => {
  const bunk = stepComfort({ ...newComfort(), warm: 6, wet: 0.6 }, 9, { asleep: true });
  const deck = stepComfort({ ...newComfort(), warm: 6, wet: 0.6 }, 9, { asleep: true, open: true });
  assert.ok(Math.abs(bunk.warm - 18) < 0.01);
  assert.ok(Math.abs(deck.warm - OPEN_WAKE) < 0.01, `woke at ${deck.warm}`);
  assert.ok(deck.warm < bunk.warm, 'cooler than a bunk');
  assert.equal(bunk.wet, 0, 'dry in a bunk');
  assert.ok(deck.wet > 0 && deck.wet < 0.6, `half dry at most: ${deck.wet}`);
  assert.ok(deck.drink < 85, 'thirsty in the morning all the same');
});

test('waking on her deck says so, and names the friend in the other bag', () => {
  for (const h of [5, 9, 13, 18, 23]) {
    const w = wakeOnDeck(h, false);
    assert.ok(w.length > 20 && !/cabin|bunk|tent/i.test(w), w);
  }
  assert.match(wakeOnDeck(6, true), /rain pattering on the bivvy bag/);
  assert.match(wakeOnDeck(6, false, 'Bert'), /Bert is stirring in the other bag\.$/);
  assert.match(turningIn('Bert'), /Bert in the other bag/);
  assert.doesNotMatch(turningIn(), /other bag/);
});

test('a skipper asleep aboard is said so to friends; nothing else makes it so', () => {
  const P = cleanPose({ m: 'boat', k: 'rib', x: 1, z: 2, h: 0, n: true, zz: 1 }, ['rib']);
  assert.equal(P.zz, true);
  assert.equal(cleanPose({ m: 'boat', k: 'rib', x: 1, z: 2, h: 0 }, ['rib']).zz, undefined);
  assert.equal(cleanPose({ m: 'boat', k: 'rib', x: 1, z: 2, h: 0, zz: 0 }, ['rib']).zz, undefined);
  assert.equal(cleanPose({ m: 'foot', x: 1, z: 2, h: 0, zz: 1 }).zz, undefined, 'only aboard');
  // (A fish on the line's own numbers aren't it: see the fight's words.)
  assert.equal(cleanPose({ m: 'boat', k: 'rib', x: 1, z: 2, h: 0, f: 1, o: 1, sl: 40 }, ['rib']).zz, undefined);
});

test('through a session: her skipper turning in reaches the crewmate, and waking does too', async () => {
  const { Together: T } = await import('../src/together.js');
  const { Hub } = await import('./fakeRealtime.mjs');
  const CFG = { url: 'https://example.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln' };
  const hub = new Hub(), clock = { t: 100 };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mk = (name, extra = {}) => new T({ config: () => CFG, name: () => name, kinds: ['rib'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const mags = mk('Mags', { newCode: () => '4242' }), bert = mk('Bert');
  await mags.host();
  await bert.join('4242');
  for (let i = 0; i < 300 && !(mags.others.length && bert.others.length); i++) await wait(5);
  let asleep = false;
  const step = async (secs) => {
    for (let i = 0; i < secs * 30; i++) {
      clock.t += 1 / 30;
      mags.update(1 / 30, { m: 'boat', k: 'rib', x: 50, z: 60, h: 0, n: true, ...(asleep ? { zz: 1 } : {}) });
      bert.update(1 / 30, { m: 'foot', x: 50.3, z: 59, h: 0, a: 'stand', cr: mags.id, cx: 0.3, cz: -1 });
      if (i % 10 === 0) await wait(2);
    }
    await wait(20);
  };
  // (The session ended either way, so a failure here doesn't leave it running.)
  try {
    await step(1);
    const seen = () => bert.peers.get(mags.id)?.pose?.zz;
    assert.equal(seen(), undefined, 'awake');
    // (She's lying still at anchor: nothing else about her pose changes, and the word still goes.)
    asleep = true;
    await step(0.5);
    assert.equal(seen(), true, 'asleep, in Bert’s game, within half a second');
    asleep = false;
    await step(0.5);
    assert.equal(seen(), undefined, 'and awake again');
  } finally {
    mags.leave();
    bert.leave();
  }
});
