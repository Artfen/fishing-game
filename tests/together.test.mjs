// Playing together (src/together.js): names and codes, what's accepted over the wire, and whole
// sessions (start, join, see each other, catches, leaving, a dropped connection) played between
// two or three players through a stand-in for Supabase Realtime.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  Together, Realtime, cleanName, cleanCode, validCode, makeCode, topicFor, cleanPose, poseWords, suggestName, NAME_MAX, MAX_PLAYERS,
} = await import('../src/together.js');
const { cleanSettings } = await import('../src/settings.js');
const { lookFor, nameHash } = await import('../src/world/visitors.js');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 2000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await wait(5);
  }
}

/* ---------- a stand-in for Supabase Realtime (tests/fakeRealtime.mjs) ---------- */

const { Hub } = await import('./fakeRealtime.mjs');

const CFG = { url: 'https://example.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln' };
// (One clock for everyone in a test, moved on by each step of the game.)
const clock = { t: 100 };
function player(hub, name, extra = {}) {
  const me = { name };
  const T = new Together({ config: () => CFG, name: () => me.name, kinds: ['row', 'skiff', 'sail'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const update = T.update.bind(T);
  T.update = (dt, me) => {
    clock.t += dt;
    update(dt, me);
  };
  T.events = [];
  T.onEvent = (kind, p, data) => T.events.push([kind, p?.name ?? null, data ?? null]);
  T.who = me;
  return T;
}
const tick = (players, me = { m: 'foot', x: 0, z: 0, h: 0, a: 'stand' }) => {
  for (const T of players) T.update(0.3, typeof me === 'function' ? me(T) : me);
};

/* ---------- names, codes and poses ---------- */

test('names are tidied: one line, printable, trimmed, at most 16 characters', () => {
  assert.equal(cleanName('  Old   Salt  '), 'Old Salt');
  assert.equal(cleanName('Line\nbreak\ttab'), 'Line break tab');
  assert.equal(cleanName('bell\u0007​zero'), 'bellzero');
  assert.equal(cleanName('x'.repeat(40)).length, NAME_MAX);
  assert.equal([...cleanName('🎣'.repeat(30))].length, NAME_MAX);
  assert.equal(cleanName(''), '');
  assert.equal(cleanName('   '), '');
  assert.equal(cleanName(42), '');
  assert.equal(cleanName(null), '');
  for (let i = 0; i < 20; i++) {
    const s = suggestName();
    assert.equal(cleanName(s), s);
    assert.ok(s.length > 3);
  }
});

test('the name lives with the settings, checked on loading, empty until chosen', () => {
  assert.equal(cleanSettings(null).player.name, '');
  assert.equal(cleanSettings({ player: { name: '  Mags  ' } }).player.name, 'Mags');
  assert.equal(cleanSettings({ player: { name: { evil: true } } }).player.name, '');
  assert.equal(cleanSettings({ player: 'nope' }).player.name, '');
  // (The rest of the settings are untouched by it.)
  assert.equal(cleanSettings({ player: { name: 'Kit' }, audio: { reel: 0.3 } }).audio.reel, 0.3);
});

test('codes are four digits', () => {
  for (let i = 0; i < 200; i++) assert.ok(validCode(makeCode()));
  assert.equal(makeCode(() => 0), '0000');
  assert.equal(makeCode(() => 0.0427), '0427');
  assert.equal(makeCode(() => 0.99999), '9999');
  assert.equal(cleanCode(' 48-21 '), '4821');
  assert.equal(cleanCode('123456'), '1234');
  assert.ok(!validCode('123'));
  assert.ok(!validCode('12a4'));
  assert.ok(!validCode(1234));
  assert.equal(topicFor('0427'), 'slow-tide-0427');
});

test('poses from others are checked: bad numbers, modes or boats are dropped', () => {
  const kinds = ['row', 'skiff'];
  assert.deepEqual(cleanPose({ m: 'boat', k: 'skiff', x: 1, z: 2, h: 0.5, vx: 1, vz: 0, f: 1, s: 0, n: 0 }, kinds), { m: 'boat', k: 'skiff', x: 1, z: 2, h: 0.5, vx: 1, vz: 0, f: true, s: false, n: false, o: false });
  assert.equal(cleanPose({ m: 'boat', k: 'battleship', x: 1, z: 2, h: 0 }, kinds), null);
  assert.equal(cleanPose({ m: 'foot', x: NaN, z: 2, h: 0 }), null);
  assert.equal(cleanPose({ m: 'foot', x: '1', z: 2, h: 0 }), null);
  assert.equal(cleanPose(null), null);
  assert.equal(cleanPose('pose'), null);
  const far = cleanPose({ m: 'foot', x: 1e9, z: -1e9, h: 0, vx: 900, a: 'moonwalk' });
  assert.equal(far.x, 1e5);
  assert.equal(far.z, -1e5);
  assert.equal(far.vx, 60);
  assert.equal(far.a, 'stand');
  assert.equal(cleanPose({ m: 'spaceship', x: 0, z: 0, h: 0 }).m, 'foot');
  assert.equal(poseWords(cleanPose({ m: 'boat', k: 'row', x: 0, z: 0, h: 0, f: 1 }, kinds), () => 'rowing boat'), 'in the rowing boat, fishing');
  assert.equal(poseWords(null), 'on their way');
  assert.equal(poseWords({ m: 'dive' }), 'diving');
});

test('a friend’s look comes from their name alone', () => {
  assert.equal(nameHash('Mags'), nameHash('Mags'));
  assert.notEqual(nameHash('Mags'), nameHash('Bert'));
  assert.deepEqual(lookFor('Mags'), lookFor('Mags'));
  const looks = new Set(['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fin', 'Gus', 'Hal'].map((n) => JSON.stringify(lookFor(n))));
  assert.ok(looks.size >= 6, 'different names mostly look different');
  for (const v of Object.values(lookFor('Kit'))) assert.match(v, /^(#[0-9a-f]{6}|beanie|flatcap|bucket|cap|hair|bun)$/);
});

/* ---------- the Realtime connection ---------- */

test('Realtime joins a public channel with presence, broadcasts, and answers heartbeats', async () => {
  const hub = new Hub();
  const rt = new Realtime({ url: 'https://abc.supabase.co/', key: CFG.anonKey, WS: hub.WS });
  assert.equal(rt.endpoint, `wss://abc.supabase.co/realtime/v1/websocket?apikey=${encodeURIComponent(CFG.anonKey)}&vsn=1.0.0`);
  await rt.connect();
  await rt.join('slow-tide-1234', 'me');
  const join = hub.log.find((m) => m.event === 'phx_join');
  assert.equal(join.topic, 'realtime:slow-tide-1234');
  assert.equal(join.join_ref, join.ref);
  assert.deepEqual(join.payload.config.broadcast, { ack: false, self: false });
  assert.deepEqual(join.payload.config.presence, { key: 'me', enabled: true });
  assert.equal(join.payload.config.private, false);
  assert.equal(join.payload.access_token, CFG.anonKey); // (a legacy anon key is a JWT)
  rt.track({ name: 'Mags' });
  rt.send('pose', { x: 1 });
  rt.beat();
  await wait(10);
  const track = hub.log.find((m) => m.event === 'presence');
  assert.deepEqual(track.payload, { type: 'presence', event: 'track', payload: { name: 'Mags' } });
  assert.equal(track.join_ref, join.ref);
  const cast = hub.log.find((m) => m.event === 'broadcast');
  assert.deepEqual(cast.payload, { type: 'broadcast', event: 'pose', payload: { x: 1 } });
  assert.equal(rt.beatRef, null, 'the heartbeat was answered');
  rt.close();
  assert.equal(rt.open, false);
  assert.ok(hub.log.some((m) => m.event === 'phx_leave'));

  // A publishable key goes the same way (as Supabase's own client sends it), and as the apikey.
  const rt2 = new Realtime({ url: CFG.url, key: 'sb_publishable_abc', WS: hub.WS });
  assert.match(rt2.endpoint, /\?apikey=sb_publishable_abc&vsn=1\.0\.0$/);
  await rt2.connect();
  await rt2.join('slow-tide-9', 'me');
  assert.equal(hub.log.filter((m) => m.event === 'phx_join').at(-1).payload.access_token, 'sb_publishable_abc');
  rt2.close();
});

test('an unanswered heartbeat closes the connection', async () => {
  const hub = new Hub();
  const rt = new Realtime({ url: CFG.url, key: CFG.anonKey, WS: hub.WS });
  let closed = false;
  rt.onClose = () => { closed = true; };
  await rt.connect();
  rt.beatRef = 'still waiting';
  rt.beat();
  await until(() => closed);
  assert.equal(rt.open, false);
});

/* ---------- sessions ---------- */

test('no backend, no session: it says why and changes nothing', async () => {
  const T = new Together({ config: () => null, name: () => 'Mags', WS: class {} });
  assert.match(T.why(), /isn’t set up/);
  assert.equal(await T.host(), false);
  assert.equal(T.status, 'off');
  assert.match(T.message, /isn’t set up/);
  const T2 = new Together({ config: () => CFG, name: () => 'Mags', WS: class {}, online: () => false });
  assert.match(T2.why(), /offline/);
  const T3 = new Together({ config: () => CFG, name: () => 'Mags', WS: null });
  assert.match(T3.why(), /browser/);
});

test('start a session, a friend joins with the code, and each sees the other', async () => {
  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '4821' });
  const b = player(hub, 'Bert');
  assert.equal(await a.host(), true);
  assert.equal(a.status, 'hosting');
  assert.equal(a.code, '4821');
  assert.match(a.message, /4821/);

  assert.equal(await b.join('48 21'), true);
  assert.equal(b.status, 'joined');
  assert.equal(b.code, '4821');
  await until(() => a.others.length === 1 && b.others.length === 1);
  assert.equal(a.others[0].name, 'Bert');
  assert.equal(b.others[0].name, 'Mags');
  assert.equal(b.others[0].host, true, 'the joiner knows who the host is');
  assert.equal(b.hostId, a.id);
  assert.deepEqual(a.events.find((e) => e[0] === 'join'), ['join', 'Bert', null]);
  assert.deepEqual(b.events.find((e) => e[0] === 'joined'), ['joined', 'Mags', null]);

  // Where each of them is goes across, and is eased towards.
  tick([a, b], (T) => (T === a ? { m: 'boat', k: 'skiff', x: 10, z: 20, h: 1, f: true, n: true } : { m: 'foot', x: -5, z: 3, h: 0.2, a: 'walk' }));
  await until(() => b.others[0].pose && a.others[0].pose);
  const seenByB = b.others[0];
  assert.deepEqual([seenByB.pose.m, seenByB.pose.k, seenByB.pose.x, seenByB.pose.z, seenByB.pose.f, seenByB.pose.n], ['boat', 'skiff', 10, 20, true, true]);
  assert.deepEqual([seenByB.at.x, seenByB.at.z], [10, 20]);
  assert.equal(a.others[0].pose.a, 'walk');

  // A catch is news.
  a.caught('seabass', 2.345, { best: true });
  await until(() => b.events.some((e) => e[0] === 'catch'));
  assert.deepEqual(b.events.find((e) => e[0] === 'catch'), ['catch', 'Mags', { sp: 'seabass', kg: 2.35, best: true, first: false }]);

  // A new name goes across.
  b.who.name = 'Bertie';
  b.renamed();
  await until(() => a.others[0]?.name === 'Bertie');

  // The host ends it: the friend is told, and is out of it.
  a.leave();
  assert.equal(a.status, 'off');
  await until(() => b.status === 'off');
  assert.match(b.message, /Mags ended the session/);
  assert.ok(b.events.some((e) => e[0] === 'ended' && e[1] === 'Mags'));
  assert.equal(b.peers.size, 0);
  await until(() => hub.sockets.size === 0);
});

test('a friend leaving is noticed, and the session carries on', async () => {
  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '1111' });
  const b = player(hub, 'Bert');
  const c = player(hub, 'Ruth');
  await a.host();
  await b.join('1111');
  await c.join('1111');
  await until(() => a.others.length === 2 && b.others.length === 2 && c.others.length === 2);
  b.leave();
  await until(() => a.others.length === 1 && c.others.length === 1);
  assert.ok(a.events.some((e) => e[0] === 'leave' && e[1] === 'Bert'));
  assert.equal(a.status, 'hosting');
  assert.equal(c.status, 'joined');
  a.leave();
  await until(() => c.status === 'off');
  await until(() => hub.sockets.size === 0);
});

test('a code nobody is using finds no one, and says so', async () => {
  const hub = new Hub();
  const b = player(hub, 'Bert');
  assert.equal(await b.join('0000'), false);
  assert.equal(b.status, 'off');
  assert.match(b.message, /No one is in a session with the code 0000/);
  assert.equal(await b.join('12'), false);
  assert.match(b.message, /four digits/);
  await until(() => hub.sockets.size === 0);
});

test('starting a session never takes a code someone else is using', async () => {
  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '5555' });
  await a.host();
  const codes = ['5555', '5555', '6666'];
  const z = player(hub, 'Hettie', { newCode: () => codes.shift() });
  assert.equal(await z.host(), true);
  assert.equal(z.code, '6666');
  assert.equal(a.others.length, 0, 'the other session never saw them');
  a.leave();
  z.leave();
});

test('a full session turns a newcomer away', async () => {
  const hub = new Hub();
  const host = player(hub, 'Host', { newCode: () => '7777' });
  await host.host();
  const crowd = [];
  for (let i = 1; i < MAX_PLAYERS; i++) {
    const p = player(hub, `P${i}`);
    assert.equal(await p.join('7777'), true);
    crowd.push(p);
  }
  await until(() => host.others.length === MAX_PLAYERS - 1);
  const late = player(hub, 'Late');
  assert.equal(await late.join('7777'), false);
  assert.match(late.message, /full/);
  host.leave();
  await until(() => crowd.every((p) => p.status === 'off'));
});

test('a dropped connection is got back, and the session goes on', async () => {
  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '2468' });
  const b = player(hub, 'Bert');
  await a.host();
  await b.join('2468');
  await until(() => a.others.length === 1 && b.others.length === 1);
  hub.drop(b.rt.ws);
  await until(() => b.events.some((e) => e[0] === 'lost'));
  assert.equal(b.status, 'joined', 'still in the session while it tries');
  await until(() => b.events.some((e) => e[0] === 'back'));
  assert.equal(b.reconnecting, false);
  await until(() => a.others.length === 1 && a.others[0].name === 'Bert');
  // (Where they are carries on going across.)
  tick([b], { m: 'foot', x: 7, z: 7, h: 0, a: 'stand' });
  await until(() => a.others[0].pose?.x === 7);
  a.leave();
  await until(() => b.status === 'off');
});

test('if the connection can’t be got back, you leave the session and are told', async () => {
  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '1357' });
  let up = true;
  const b = player(hub, 'Bert', { online: () => up });
  await a.host();
  await b.join('1357');
  up = false;
  hub.drop(b.rt.ws);
  await until(() => b.status === 'off', 4000);
  assert.ok(b.events.some((e) => e[0] === 'ended' && e[2]?.lost));
  assert.match(b.message, /lost/);
  a.leave();
});

test('what others send is checked: junk is ignored, and catches don’t flood', async () => {
  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '3141' });
  await a.host();
  const rogue = new Realtime({ url: CFG.url, key: CFG.anonKey, WS: hub.WS });
  await rogue.connect();
  await rogue.join(topicFor('3141'), 'rogue');
  rogue.track({ name: 'Rogue\u0000Name that is far too long to show' });
  rogue.send('pose', { id: 'rogue', p: { m: 'boat', k: 'submarine', x: 1, z: 1, h: 0 } });
  rogue.send('pose', { id: a.id, n: 'Impostor', p: { m: 'foot', x: 1, z: 1, h: 0 } });
  rogue.send('pose', 'not an object');
  rogue.send('catch', { id: 'rogue', sp: 'seabass', kg: 'heavy' });
  for (let i = 0; i < 5; i++) rogue.send('catch', { id: 'rogue', sp: 'mackerel', kg: 0.4 });
  rogue.send('end', { id: 'rogue' }); // (only the host ends a session)
  await wait(40);
  const r = a.peers.get('rogue');
  assert.equal(r.name, 'RogueName that i');
  assert.equal(r.pose, null, 'a boat that isn’t one is dropped');
  assert.equal(a.peers.has(a.id), false, 'nobody can be you');
  // (Junk dropped, and a flood cut short: two or three fish close together are news, five aren't.)
  assert.equal(a.events.filter((e) => e[0] === 'catch').length, 3);
  assert.equal(a.status, 'hosting');
  rogue.close();
  await until(() => !a.peers.has('rogue'));
  a.leave();
});

test('cancelling while it connects leaves nothing behind', async () => {
  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '8080' });
  const going = a.host();
  assert.equal(a.status, 'connecting');
  a.leave(true);
  assert.equal(await going, false);
  assert.equal(a.status, 'off');
  await wait(20);
  assert.equal(hub.sockets.size, 0);
});

test('you send where you are often while moving, rarely while still', async () => {
  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '9090' });
  await a.host();
  const poses = () => hub.log.filter((m) => m.event === 'broadcast' && m.payload.event === 'pose').length;
  const before = poses();
  // Ten seconds standing still: a pose now and then.
  for (let i = 0; i < 100; i++) a.update(0.1, { m: 'foot', x: 0, z: 0, h: 0, a: 'stand' });
  const still = poses() - before;
  assert.ok(still >= 3 && still <= 5, `still: ${still}`);
  // Ten seconds walking: about four a second.
  const b2 = poses();
  for (let i = 0; i < 100; i++) a.update(0.1, { m: 'foot', x: i * 0.15, z: 0, h: 0, a: 'walk' });
  const moving = poses() - b2;
  assert.ok(moving >= 30 && moving <= 42, `moving: ${moving}`);
  // (And how fast you're going goes with it, so others can carry you on between messages.)
  const last = hub.log.filter((m) => m.event === 'broadcast' && m.payload.event === 'pose').at(-1).payload.payload.p;
  assert.ok(Math.abs(last.vx - 1.5) < 0.2, `vx ${last.vx}`);
  a.leave();
});

test('a jump (stepping ashore, a passage) isn’t speed: nobody is carried on past where you are', async () => {
  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '4242' });
  const b = player(hub, 'Bert');
  await a.host();
  await b.join('4242');
  const sent = () => hub.log.filter((m) => m.event === 'broadcast' && m.payload.event === 'pose').at(-1).payload.payload.p;
  for (let i = 0; i < 10; i++) a.update(0.1, { m: 'foot', x: 0, z: 0, h: 0, a: 'stand' });
  a.update(0.1, { m: 'foot', x: 5, z: 3, h: 0, a: 'stand' }); // (stepped ashore)
  assert.deepEqual([sent().vx, sent().vz], [0, 0]);
  // Walking, then stopping: the stop is sent promptly, with no speed left in it.
  for (let i = 0; i < 20; i++) a.update(0.1, { m: 'foot', x: 5 + i * 0.15, z: 3, h: 0, a: 'walk' });
  assert.ok(sent().vx > 1);
  for (let i = 0; i < 15; i++) a.update(0.1, { m: 'foot', x: 5 + 19 * 0.15, z: 3, h: 0, a: 'stand' });
  assert.ok(Math.abs(sent().vx) < 0.3, `still sending ${sent().vx}`);
  await until(() => b.others[0]?.pose && Math.abs(b.others[0].pose.vx) < 0.3);
  for (let i = 0; i < 30; i++) b.update(0.1, null);
  assert.ok(Math.abs(b.others[0].at.x - (5 + 19 * 0.15)) < 0.5, `seen at ${b.others[0].at.x}`);
  a.leave();
  await until(() => b.status === 'off');
});

test('someone who left while your connection was down is let go after a while', async () => {
  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '5150' });
  const b = player(hub, 'Bert');
  const c = player(hub, 'Ruth');
  await a.host();
  await b.join('5150');
  await c.join('5150');
  await until(() => b.others.length === 2);
  // Bert's connection drops; while it's down, Ruth leaves (Bert never hears).
  const ws = b.rt.ws;
  b.rt.onClose = () => {};
  hub.drop(ws);
  c.leave();
  await wait(20);
  b.lost();
  await until(() => b.events.some((e) => e[0] === 'back'));
  await until(() => b.peers.get(a.id)?.present);
  assert.equal(b.others.length, 2, 'Ruth is still remembered for now');
  for (let i = 0; i < 50; i++) b.update(1, null);
  assert.deepEqual(b.others.map((p) => p.name), ['Mags'], 'Ruth is gone; Mags, still here, stays');
  a.leave();
  await until(() => b.status === 'off');
});

/* ---------- drawing friends smoothly ---------- */

// A friend's positions as they arrive: sent every `every` seconds by their clock, each delivered
// after `lag` plus up to `wobble` seconds more. Returns the frames as drawn here at 60 fps.
function watch(path, { seconds = 6, every = 0.25, lag = 0.08, wobble = 0.15, seed = 7 } = {}) {
  let r = seed;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let now = 50;
  const T = new Together({ config: () => null, name: () => 'Me', now: () => now });
  const pending = [];
  for (let t = 0; t <= seconds; t += every) {
    const P = path(t);
    pending.push({ at: 1000 + t + lag + rand() * wobble, msg: { id: 'friend', n: 'Mags', t: 1000 + t, p: { m: 'boat', k: 'row', ...P } } });
  }
  const frames = [];
  for (now = 1000; now < 1000 + seconds; now += 1 / 60) {
    for (const m of pending.filter((q) => !q.done && q.at <= now)) {
      m.done = true;
      T.receive('broadcast', { type: 'broadcast', event: 'pose', payload: m.msg });
    }
    T.update(1 / 60, null);
    const p = T.peers.get('friend');
    if (p?.at) frames.push({ x: p.at.x, z: p.at.z, v: p.at.v });
  }
  return frames;
}

test('a friend glides at an even speed, however unevenly their messages arrive', () => {
  // Rowing along a straight line at 3 m/s, messages arriving with up to 150 ms of wobble.
  const frames = watch((t) => ({ x: 3 * t, z: 0, h: Math.PI / 2, vx: 3, vz: 0 })).slice(90, -45);
  assert.ok(frames.length > 100);
  for (let i = 1; i < frames.length; i++) {
    const step = (frames[i].x - frames[i - 1].x) * 60;
    assert.ok(Math.abs(step - 3) < 0.15, `frame ${i}: ${step.toFixed(2)} m/s`);
  }
  // (And about half a second behind, not more.)
  const last = frames[frames.length - 1];
  assert.ok(last.x > 3 * (6 - 0.75 - 0.75) && last.x < 3 * (6 - 0.75), `at ${last.x}`);
});

test('turning, a friend follows a smooth curve, without corners or wobbles', () => {
  // A circle of 20 m at 4 m/s.
  const R = 20, w = 4 / R;
  const path = (t) => ({ x: R * Math.sin(w * t), z: R - R * Math.cos(w * t), h: w * t, vx: 4 * Math.cos(w * t), vz: 4 * Math.sin(w * t) });
  const frames = watch(path, { seconds: 8 }).slice(90, -45);
  for (let i = 2; i < frames.length; i++) {
    const v1 = [(frames[i - 1].x - frames[i - 2].x) * 60, (frames[i - 1].z - frames[i - 2].z) * 60];
    const v2 = [(frames[i].x - frames[i - 1].x) * 60, (frames[i].z - frames[i - 1].z) * 60];
    const speed = Math.hypot(...v2);
    const accel = Math.hypot(v2[0] - v1[0], v2[1] - v1[1]) * 60;
    assert.ok(Math.abs(speed - 4) < 0.25, `frame ${i}: ${speed.toFixed(2)} m/s`);
    assert.ok(accel < 4 * 4 / R * 2, `frame ${i}: a jerk of ${accel.toFixed(2)} m/s²`); // (the turn itself is 0.8)
  }
});

test('a friend who stops stays stopped, and one who goes somewhere new is there at once', () => {
  const stopAt = 3;
  const frames = watch((t) => (t < stopAt ? { x: 2 * t, z: 0, h: 0, vx: 2, vz: 0 } : { x: 2 * stopAt, z: 0, h: 0, vx: 0, vz: 0 }));
  const end = frames.slice(-60);
  for (const f of end) assert.ok(Math.abs(f.x - 2 * stopAt) < 0.02 && f.v < 0.01, `still moving at ${f.x}`);
  const xs = frames.map((f) => f.x);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] >= xs[i - 1] - 1e-9, 'never steps back');
  // A passage: 5 km in an instant (a new place, not a slide across the map).
  const far = watch((t) => (t < 2 ? { x: 0, z: 0, h: 0, vx: 0, vz: 0 } : { x: 0, z: 5000, h: 0, vx: 0, vz: 0 }), { seconds: 3 });
  const jumpAt = far.findIndex((f) => f.z > 1);
  assert.ok(jumpAt > 0);
  assert.ok(far[jumpAt].z > 4999, 'there at once');
});

test('your boats in the water go across to your friends, and a guest has a place of their own on the visitors’ row', async () => {
  const { cleanFleet } = await import('../src/together.js');
  // What comes over the wire is checked: known kinds, numbers that make sense, each kind once, a few.
  assert.deepEqual(cleanFleet([{ k: 'skiff', x: 1, z: 2, h: 0 }, { k: 'skiff', x: 9, z: 9, h: 0 }, { k: 'yacht', x: 1, z: 1, h: 0 }, { k: 'row', x: 'x', z: 1, h: 0 }, null], ['row', 'skiff']), [{ k: 'skiff', x: 1, z: 2, h: 0 }]);
  assert.deepEqual(cleanFleet('junk'), []);
  assert.equal(cleanFleet(Array.from({ length: 9 }, (_, i) => ({ k: `k${i}`, x: 0, z: 0, h: 0 }))).length, 4);

  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '5150' });
  const b = player(hub, 'Bert'), c = player(hub, 'Hettie');
  a.fleetSource = () => [{ k: 'sail', x: 17.4, z: -55.05, h: 1.57 }, { k: 'row', x: -70, z: -5, h: 0 }];
  b.fleetSource = () => [{ k: 'skiff', x: 0, z: -48, h: -1.57 }];
  assert.equal(await a.host(), true);
  assert.equal(a.guestSlot, -1, 'the host is at home');
  assert.equal(b.guestSlot, -1, 'on your own, at home');
  await b.join('5150');
  await c.join('5150');
  await until(() => a.others.length === 2 && b.others.length === 2 && c.others.length === 2);
  for (let i = 0; i < 6; i++) tick([a, b, c]);
  await until(() => b.others.find((p) => p.name === 'Mags')?.fleet?.length === 2 && a.others.find((p) => p.name === 'Bert')?.fleet?.length === 1);
  assert.deepEqual(b.others.find((p) => p.name === 'Mags').fleet[0], { k: 'sail', x: 17.4, z: -55.05, h: 1.57 });
  // Two guests: a place each on the visitors' row, the same on every screen.
  assert.deepEqual([b.guestSlot, c.guestSlot].sort(), [0, 1]);
  assert.equal(a.guestSlot, -1);
  // A boat of Mags's moves: word of it goes across soon after.
  a.fleetSource = () => [{ k: 'sail', x: 30, z: -40, h: 0.5 }];
  for (let i = 0; i < 25; i++) tick([a, b, c]);
  await until(() => b.others.find((p) => p.name === 'Mags')?.fleet?.[0]?.x === 30);
  for (const T of [a, b, c]) T.leave();
  await until(() => hub.sockets.size === 0);
});

test('a friend fishing: their rod, what’s on it, where their line meets the water and the load on it go across, checked', async () => {
  const gear = { rods: ['float', 'spin', 'sea'], items: ['corn', 'spinner', 'crankS'] };
  const kinds = ['row', 'skiff'];
  // Fishing from the shore with a float: the rod, the bait and where the float lies.
  assert.deepEqual(cleanPose({ m: 'foot', x: 1, z: 2, h: 0, a: 'fish', r: 'float', i: 'corn', ex: 12.5, ez: 20 }, kinds, gear),
    { m: 'foot', x: 1, z: 2, h: 0, vx: 0, vz: 0, a: 'fish', o: false, r: 'float', i: 'corn', ex: 12.5, ez: 20 });
  // A fish on from a boat: the load on the line too (and item ids with capitals are fine).
  const on = cleanPose({ m: 'boat', k: 'skiff', x: 0, z: 0, h: 0, f: 1, o: 1, r: 'spin', i: 'crankS', ex: 30, ez: 5, tn: 0.7 }, kinds, gear);
  assert.deepEqual([on.r, on.i, on.ex, on.ez, on.tn], ['spin', 'crankS', 30, 5, 0.7]);
  // Rods and tackle the game doesn't have, a line end far off, markup, and a load with no fish on are dropped.
  const junk = cleanPose({ m: 'foot', x: 0, z: 0, h: 0, a: 'fish', r: 'bazooka', i: '<b>x</b>', ex: 900, ez: 0, tn: 0.9 }, kinds, gear);
  assert.deepEqual([junk.r, junk.i, junk.ex, junk.tn], [undefined, undefined, undefined, undefined]);
  // Not fishing, none of it is kept.
  const walking = cleanPose({ m: 'foot', x: 0, z: 0, h: 0, a: 'walk', r: 'float', i: 'corn', ex: 5, ez: 5 }, kinds, gear);
  assert.deepEqual([walking.r, walking.ex], [undefined, undefined]);
  // Said in Settings with what they're fishing with.
  const words = (P) => (P.r ? `${P.r} rod, ${P.i}` : '');
  assert.equal(poseWords(cleanPose({ m: 'foot', x: 0, z: 0, h: 0, a: 'fish', r: 'float', i: 'corn' }, kinds, gear), undefined, words), 'fishing from the shore (float rod, corn)');
  assert.equal(poseWords(on, () => 'motor skiff', words), 'in the motor skiff, playing a fish (spin rod, crankS)');

  // Over a real session: a lure coming in is sent as it moves, even while you stand still.
  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '5150', ...gear });
  const b = player(hub, 'Bert', gear);
  await a.host();
  await b.join('5150');
  await until(() => a.others.length === 1 && b.others.length === 1);
  let lure = 30;
  const me = () => ({ m: 'foot', x: 0, z: 0, h: 0, a: 'fish', r: 'spin', i: 'spinner', ex: lure, ez: 0 });
  tick([a, b], (T) => (T === a ? me() : { m: 'foot', x: 5, z: 5, h: 0, a: 'stand' }));
  await until(() => b.others[0].pose?.ex === 30);
  assert.deepEqual([b.others[0].pose.r, b.others[0].pose.i], ['spin', 'spinner']);
  for (let k = 0; k < 8; k++) {
    lure -= 1.5;
    tick([a, b], (T) => (T === a ? me() : { m: 'foot', x: 5, z: 5, h: 0, a: 'stand' }));
  }
  await until(() => b.others[0].pose?.ex === lure);
  a.leave();
  b.leave();
  await until(() => hub.sockets.size === 0);
});

test('a friend’s fish fights where you can see it, and a catch is held up', async () => {
  const THREE = await import('three');
  const { VisitorView } = await import('../src/world/visitors.js');
  const kinds = ['row', 'skiff'];
  // What the fish is doing goes across only with a fish on, and only as one of the moves.
  assert.equal(cleanPose({ m: 'foot', x: 0, z: 0, h: 0, a: 'fish', o: 1, mv: 'jump' }, kinds).mv, 'jump');
  assert.equal(cleanPose({ m: 'foot', x: 0, z: 0, h: 0, a: 'fish', o: 1, mv: 'teleport' }, kinds).mv, undefined);
  assert.equal(cleanPose({ m: 'foot', x: 0, z: 0, h: 0, a: 'fish', mv: 'jump' }, kinds).mv, undefined);

  const scene = new THREE.Scene(), view = new VisitorView(scene);
  const fx = { splashes: 0, ripples: 0, splash() { this.splashes++; }, ripple() { this.ripples++; } };
  const peer = (pose) => {
    const p = { id: 'sam', name: 'Sam', pose, view: pose, at: { x: pose.x, z: pose.z, h: pose.h, v: 0 } };
    return new Map([['sam', p]]);
  };
  const play = (pose, secs) => {
    const peers = peer(pose);
    for (let i = 0; i < secs * 30; i++) view.update(1 / 30, i / 30, peers, { from: { x: 0, z: 0 }, fx });
  };
  // On a pier-like spot at the origin, a line out 15 m with a fish on: a leap is a crash of spray.
  const base = { m: 'foot', x: 0, z: 0, h: 0, vx: 0, vz: 0, a: 'fish', o: true, r: 'spin', i: 'spinner', ex: 0, ez: 15, tn: 0.6 };
  play({ ...base, mv: 'run' }, 1);
  const s0 = fx.splashes;
  play({ ...base, mv: 'jump' }, 0.5);
  assert.ok(fx.splashes > s0, 'a leap throws up spray');
  // Sounding deep, nothing shows at the top.
  const s1 = fx.splashes, r1 = fx.ripples;
  play({ ...base, mv: 'sound' }, 3);
  assert.equal(fx.splashes, s1);
  assert.ok(fx.ripples - r1 <= 1, `${fx.ripples - r1} ripples while it's deep`);
  // Their line is drawn while it's on, and gone when they reel in.
  const d = view.drawn.get('sam');
  assert.equal(d.line.visible, true);
  play({ ...base, a: 'stand', o: false, ex: undefined, ez: undefined }, 0.2);
  assert.equal(d.line.visible, false);
  // Landed: on foot they hold it up for you, a bigger fish held up bigger.
  view.holdUp('sam', 4);
  play({ ...base, a: 'stand', o: false }, 0.5);
  assert.equal(d.figure.fish.visible, true);
  const big = d.figure.fish.scale.z;
  play({ ...base, a: 'stand', o: false }, 6);
  assert.equal(d.figure.fish.visible, false, 'and puts it away after a few seconds');
  view.holdUp('sam', 0.3);
  play({ ...base, a: 'stand', o: false }, 0.5);
  assert.ok(d.figure.fish.scale.z < big);
});

test('a friend who leaves and comes back has the same boats, and their figure is given back', async () => {
  const THREE = await import('three');
  const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : () => {}), set: () => true });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
  const { VisitorView } = await import('../src/world/visitors.js');
  const scene = new THREE.Scene(), view = new VisitorView(scene);
  const at = (pose, fleet = []) => new Map([['sam', { id: 'sam', name: 'Sam', pose, view: pose, at: { x: pose.x, z: pose.z, h: pose.h, v: 0 }, fleet }]]);
  const play = (peers, secs) => {
    for (let i = 0; i < secs * 30; i++) view.update(1 / 30, i / 30, peers, { from: { x: 0, z: 0 } });
  };
  const afloat = at({ m: 'boat', k: 'skiff', x: 150, z: 330, h: 0, vx: 0, vz: 0, a: 'sit' }, [{ k: 'row', x: 160, z: 340, h: 1 }]);
  // On foot first: a figure, its own shapes and colours.
  play(at({ m: 'foot', x: 0, z: 0, h: 0, vx: 0, vz: 0, a: 'stand' }), 0.2);
  let given = 0, made = 0;
  view.drawn.get('sam').figure.group.traverse((o) => {
    for (const x of [o.geometry, o.material]) if (x) { made++; x.addEventListener('dispose', () => given++); }
  });
  play(afloat, 0.2);
  const d = view.drawn.get('sam'), skiff = d.boats.skiff, row = d.moored.row;
  assert.ok(skiff?.group.visible && row?.group.visible);
  const n = scene.children.length;
  // Gone: hidden, their figure given back; back again: the same boats, nothing new in the scene.
  play(new Map(), 0.1);
  assert.ok(!view.drawn.has('sam') && !skiff.group.visible && !row.group.visible);
  assert.ok(made > 10 && given >= made - 2, `${given} of ${made} given back`);
  play(afloat, 0.2);
  assert.equal(view.drawn.get('sam').boats.skiff, skiff);
  assert.equal(view.drawn.get('sam').moored.row, row);
  assert.ok(skiff.group.visible && row.group.visible);
  assert.ok(scene.children.length <= n, `${scene.children.length} in the scene, ${n} before`);
});
