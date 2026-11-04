// Discovery (R6): what there is to find on a dive (the Kittiwake's bell, boiler, propeller,
// capstan, name and bottles; the reef's arch, the kelp's boulder, the old anchor, the Hound's crown
// and the Pup), how far you can see down there, and sharing what you find with friends while you
// play together (places, dive sites, finds, a first fish's tip, a mark from the map), as marks on
// their map with your name on them.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { SITE_DETAILS, detailsNear, foundWords, siteById, HOME_SITES } = await import('../src/world/divesites.js');
const { heightAt, WRECK } = await import('../src/world/terrain.js');
const { cleanDive, logFind, logSite } = await import('../src/dive.js');
const { Underwater } = await import('../src/world/underwater.js');
const { Together, cleanFind, FIND_KINDS } = await import('../src/together.js');
const { sanitize } = await import('../src/save.js');
const { Hub } = await import('./fakeRealtime.mjs');

/* ---------- what there is to find ---------- */

test('every dive site at home has something to find, the Kittiwake six things, each where a diver can reach it', () => {
  for (const S of HOME_SITES) assert.ok(SITE_DETAILS[S.id]?.length, `${S.id} has something to find`);
  assert.deepEqual(SITE_DETAILS.wreck.map((d) => d.id), ['bell', 'boiler', 'propeller', 'capstan', 'name', 'bottles']);
  const ids = new Set();
  for (const [site, list] of Object.entries(SITE_DETAILS)) {
    const S = siteById[site];
    for (const d of list) {
      assert.ok(!ids.has(`${site}.${d.id}`) && /^[a-z]{2,12}$/.test(d.id), d.id);
      ids.add(`${site}.${d.id}`);
      assert.ok(Math.hypot(d.x - S.x, d.z - S.z) < S.r + 6, `${site}.${d.id} is at the site`);
      assert.ok(d.y >= heightAt(d.x, d.z) - 0.05, `${site}.${d.id} is not under the sand`);
      assert.ok(d.y < -1.5, `${site}.${d.id} is under the water`);
      assert.ok(d.note.length > 60 && d.name && d.r >= 2, `${site}.${d.id} has its words`);
    }
  }
  // The wreck's are on her, not scattered over the reef.
  for (const d of SITE_DETAILS.wreck) assert.ok(Math.hypot(d.x - WRECK.x, d.z - WRECK.z) < WRECK.len / 2 + 3, d.id);
});

test('a find is within reach, not from across the site, and only once', () => {
  const bell = SITE_DETAILS.wreck.find((d) => d.id === 'bell');
  assert.deepEqual(detailsNear('wreck', { x: bell.x + 1, y: bell.y + 1, z: bell.z }).map((d) => d.id), ['bell']);
  assert.equal(detailsNear('wreck', { x: bell.x + 1, y: bell.y + 1, z: bell.z }, ['bell']).length, 0);
  assert.equal(detailsNear('wreck', { x: bell.x, y: bell.y + 8, z: bell.z }).length, 0, 'not from the surface');
  assert.equal(detailsNear('nowhere', bell).length, 0);
  const D = cleanDive(null);
  logSite(D, 'wreck', 3, 9);
  assert.equal(logFind(D, 'wreck', 'bell', 3), true);
  assert.equal(logFind(D, 'wreck', 'bell', 4), false);
  assert.equal(logFind(D, 'wreck', 'boiler', 4), true);
  assert.equal(foundWords('wreck', D.sites.wreck.found), 'her bell and her boiler (2 of 6)');
  assert.equal(foundWords('sands', ['anchor']), 'the old anchor');
  assert.equal(foundWords('wreck', []), '');
});

test('the dive log keeps what you found and the clearest water, and nothing else', () => {
  const D = cleanDive({ sites: { wreck: { first: 2, dives: 3, deepest: 9.6, found: ['bell', 'bell', 'boiler', '<b>', 7], vis: 9.4 }, sands: { first: 4, dives: 1, deepest: 17, vis: 'clear' } } });
  assert.deepEqual(D.sites.wreck.found, ['bell', 'boiler']);
  assert.equal(D.sites.wreck.vis, 9);
  assert.equal(D.sites.sands.found, undefined);
  assert.equal(D.sites.sands.vis, undefined);
  // (Older saves, with no finds, load as before.)
  assert.deepEqual(cleanDive({ sites: { reef: { first: 1, dives: 1, deepest: 5 } } }).sites.reef, { first: 1, dives: 1, deepest: 5 });
});

test('how far you can see: nine metres or so at home, less after a blow or in the rain or the dark, twenty at Las Brasas', () => {
  const U = (clear, colour) => Object.assign(Object.create(Underwater.prototype), { clear, colour });
  const home = U(0, 0).visibility(), stirred = U(0, 1).visibility(), south = U(1, 0).visibility();
  assert.ok(home >= 8 && home <= 10, `home ${home}`);
  assert.ok(stirred < home - 3, `stirred ${stirred}`);
  assert.ok(south >= 18, `south ${south}`);
  assert.ok(U(0, 0).visibility(1, 0) < home && U(0, 0).visibility(0, 1) < home, 'rain and the dark');
  assert.equal(U(1, 1).visibility(), south, 'clear blue water doesn’t silt up');
});

/* ---------- sharing what you find ---------- */

test('a shared find is words and a place, nothing more', () => {
  assert.deepEqual(FIND_KINDS, ['place', 'site', 'detail', 'fish', 'mark']);
  assert.deepEqual(cleanFind({ k: 'mark', x: 10.4, z: 6500.2, t: ' Bass <i>here</i> ', n: 'at dusk\n on a sandeel' }), { k: 'mark', x: 10, z: 6500, t: 'Bass i here /i', n: 'at dusk on a sandeel' });
  assert.equal(cleanFind({ k: 'mark', x: 1, z: 1, t: '   ' }), null, 'a title');
  assert.equal(cleanFind({ k: 'spam', x: 1, z: 1, t: 'a' }), null);
  assert.equal(cleanFind({ k: 'mark', x: 'a', z: 1, t: 'a' }), null);
  assert.equal(cleanFind({ k: 'place', x: 1, z: 1, t: 'a', id: 'gannet' }).id, 'gannet');
  assert.equal(cleanFind({ k: 'place', x: 1, z: 1, t: 'a', id: '../x' }).id, undefined);
  assert.equal(cleanFind({ k: 'mark', x: 1, z: 1, t: 'x'.repeat(90), n: 'y'.repeat(900) }).t.length, 40);
  assert.equal(cleanFind({ k: 'mark', x: 1e9, z: -1e9, t: 'far' }).x, 3000);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CFG = { url: 'https://example.supabase.co', anonKey: 'a.b.c' };
function friend(hub, name, time, code = null) {
  const T = new Together({ config: () => CFG, name: () => name, WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => time.now, store: null, newCode: () => code });
  T.events = [];
  T.onEvent = (kind, p, data) => T.events.push([kind, p?.name ?? null, data ?? null]);
  return T;
}
async function run(all, time, seconds) {
  for (let i = 0; i < seconds * 30; i++) {
    time.now += 1 / 30;
    for (const T of all) T.update(1 / 30, null);
    if (i % 3 === 0) await wait(1);
  }
}

test('playing together, what you find reaches your friends, a few at a time', async () => {
  const hub = new Hub(), time = { now: 1000 };
  const kit = friend(hub, 'Kit', time, '5150'), ann = friend(hub, 'Ann', time);
  assert.equal(kit.share({ k: 'place', x: 1, z: 2, t: 'Gannet Isle' }), false, 'not in a session: nothing goes');
  await kit.host();
  await ann.join('5150');
  await run([kit, ann], time, 2);
  assert.equal(kit.share({ k: 'place', x: 300, z: 400, t: 'Gannet Isle', n: 'the lighthouse', id: 'gannet' }), true);
  assert.equal(kit.share({ k: 'fish', x: 170, z: -10, t: 'European Seabass', n: 'Cove Head, on a sandeel, at dusk.' }), true);
  assert.equal(kit.share({ k: 'nonsense', x: 0, z: 0, t: 'x' }), false);
  await run([kit, ann], time, 1);
  const finds = ann.events.filter((e) => e[0] === 'find');
  assert.equal(finds.length, 2);
  assert.deepEqual(finds[0], ['find', 'Kit', { k: 'place', x: 300, z: 400, t: 'Gannet Isle', n: 'the lighthouse', id: 'gannet' }]);
  assert.equal(finds[1][2].k, 'fish');
  assert.equal(kit.events.filter((e) => e[0] === 'find').length, 0, 'not to yourself');
  // A burst is held to six in half a minute, each way.
  let sent = 0;
  for (let i = 0; i < 10; i++) if (kit.share({ k: 'mark', x: i, z: i, t: `Mark ${i}` })) sent++;
  assert.equal(sent, 4, 'six in the half-minute, two already gone');
  await run([kit, ann], time, 1);
  assert.equal(ann.events.filter((e) => e[0] === 'find').length, 6);
  // (And a friend who sends more than that, by whatever means, is heard six times, no more.)
  for (let i = 0; i < 10; i++) ann.rt.send('find', { id: ann.id, f: { k: 'mark', x: i, z: i, t: `Flood ${i}` } });
  await run([kit, ann], time, 1);
  assert.equal(kit.events.filter((e) => e[0] === 'find').length, 6);
  ann.leave();
  kit.leave();
  await run([kit, ann], time, 1);
});

test('marks a friend shared are kept with their name, and marks at Las Brasas are kept where they are', () => {
  const s = sanitize({
    pins: [
      { id: 'fr-abc', x: 300, z: 400, title: 'Gannet Isle', note: '', from: 'Kit', day: 3, hour: 9 },
      { id: 'pin-south', x: -20, z: 6100, title: 'Grouper cave', note: '', day: 5, hour: 9 },
      { id: 'pin-mine', x: 1, z: 2, title: 'Mine', note: '', from: 42, day: 5, hour: 9 },
    ],
    log: [{ id: 'c1', sp: 'parrotfish', size: 30, day: 6, hour: 10, zone: 'lee', place: 'Puerto Brasa', kind: 'float', rod: 'float', from: 'boat', outcome: 'released', x: 10, z: 6050 }],
  });
  assert.equal(s.pins[0].from, 'Kit');
  assert.equal(s.pins[1].z, 6100, 'a mark at Las Brasas stays at Las Brasas');
  assert.equal(s.pins[2].from, undefined);
  assert.equal(s.log[0]?.z, 6050, 'and so does where a fish was caught there');
});
