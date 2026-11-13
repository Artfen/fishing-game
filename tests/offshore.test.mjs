// The offshore day (E3). E3a: fighting a fish together, a friend at the helm chasing it while
// you play it: where the fish is from her bow, the line out and what's left on the spool, carried
// in your pose to their game, and the words their helm gives them.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { fishFromHelm, helmWords, FOLLOW_AT, SPOOL_LOW } = await import('../src/crew.js');
const { cleanPose } = await import('../src/together.js');

test('where the fish is from her bow: dead ahead, off the bow, on the beam, off the quarter, astern; port to the left as she heads', () => {
  // (Heading 0 points her along +z; her starboard side is to −x, her port side to +x: boat.js.)
  const at = (fx, fz, h = 0) => fishFromHelm(0, 0, h, fx, fz);
  assert.equal(at(0, 50).where, 'dead ahead');
  assert.equal(at(30, 40).where, 'off the port bow');
  assert.equal(at(-30, 40).where, 'off the starboard bow');
  assert.equal(at(50, 0).where, 'on the port beam');
  assert.equal(at(-50, 0).where, 'on the starboard beam');
  assert.equal(at(30, -40).where, 'off the port quarter');
  assert.equal(at(0, -50).where, 'astern');
  assert.equal(Math.round(at(30, 40).d), 50);
  // Turned to head along +x, her starboard side faces +z (her right: boat.js), so a fish there is
  // on her starboard beam.
  assert.equal(at(0, 50, Math.PI / 2).where, 'on the starboard beam');
  assert.equal(at(50, 0, Math.PI / 2).where, 'dead ahead');
});

test('the helm’s words: follow it while it takes line, after it as the spool empties, steady while it’s played, stop as it’s landed', () => {
  const near = fishFromHelm(0, 0, 0, 20, 30), far = fishFromHelm(0, 0, 0, 0, 1400);
  assert.match(helmWords('Mags', near, { xl: 0, sl: 90 }), /^Mags has a fish on, 36 m off the port bow · spool 90%: keep her steady and let Mags play it$/);
  assert.match(helmWords('Mags', near, { xl: FOLLOW_AT + 20, sl: 60 }), /taking line.*follow it at a trolling pace/);
  assert.match(helmWords('Mags', near, { xl: 80, sl: SPOOL_LOW - 5 }), /emptying the spool.*after it, now!/);
  assert.match(helmWords('Mags', far, { xl: 0 }), /1\.4 km dead ahead/);
  assert.match(helmWords('Mags', near, { nt: 1 }), /beaten, off the port bow: stop her and keep her still/);
  assert.match(helmWords('Mags', near, { nt: 2 }), /beaten/, 'landed another way, too big for the net: the same');
  assert.doesNotMatch(helmWords('Mags', near, {}), /spool/, 'an older game sends no spool: none said');
});

test('the pose carries the line out and the spool, with a fish on; junk is dropped or clamped', () => {
  const base = { m: 'boat', k: 'skiff', x: 0, z: 0, h: 0, o: true, r: 'biggame', i: 'skirt', ex: 30, ez: 40, hk: 7 };
  const p = cleanPose({ ...base, xl: 123.4, sl: 47.6 });
  assert.equal(p.xl, 123);
  assert.equal(p.sl, 48);
  assert.equal(cleanPose({ ...base, xl: -5, sl: 140 }).xl, 0, 'negative line clamped to none');
  assert.equal(cleanPose({ ...base, xl: 10, sl: 140 }).sl, 100, 'over 100% clamped');
  const junk = cleanPose({ ...base, xl: 'lots', sl: NaN });
  assert.equal(junk.xl, undefined);
  assert.equal(junk.sl, undefined);
  // (Without a fish on, neither is kept.)
  const off = cleanPose({ ...base, o: false, xl: 50, sl: 40 });
  assert.equal(off.xl, undefined);
  assert.equal(off.sl, undefined);
});

/* ---------- E3b: planning a run offshore, and the way home ---------- */

const { CRUISE, runOf, openSea, seaFor, turnForHome, offshorePlan, HOUR_S, OFFSHORE_AT } = await import('../src/offshore.js');
const { BOAT_PER_S, TANKS } = await import('../src/fuel.js');

test('her cruising pace is the one her physics gives in calm water', async () => {
  const THREE = await import('three');
  const { Boat } = await import('../src/boat.js');
  const scene = new THREE.Scene();
  for (const kind of ['skiff', 'console', 'rib', 'cruiser']) {
    const b = new Boat(scene, { kind });
    b.place(60, 300, 0);
    for (let i = 0; i < 40 * 30; i++) b.update(1 / 30, i / 30, CRUISE[kind].lever, 0, 0);
    const v = Math.hypot(b.vel.x, b.vel.z);
    assert.ok(Math.abs(v - CRUISE[kind].v) / CRUISE[kind].v < 0.12, `${kind}: ${v.toFixed(1)} m/s against ${CRUISE[kind].v}`);
  }
});

test('a run offshore: hours each way and litres there, from her pace and her burn', () => {
  const skiff = runOf('skiff', 1000), rib = runOf('rib', 1000);
  assert.ok(Math.abs(skiff.hours - 1000 / 6.9 / HOUR_S) < 1e-9, 'a kilometre in the skiff: over three and a half hours of the game’s day');
  assert.ok(skiff.hours > 3 && rib.hours < 2.5, `skiff ${skiff.hours.toFixed(1)} h, RIB ${rib.hours.toFixed(1)} h`);
  assert.ok(Math.abs(skiff.litres - BOAT_PER_S.skiff * (1000 / 6.9)) < 1e-9);
  assert.ok(rib.litres < TANKS.rib && skiff.litres * 2 < TANKS.skiff, 'either has the fuel for the Blue Water and back, full');
  assert.equal(runOf('row', 1000).litres, 0, 'oars burn nothing');
});

test('boats for the open sea, and the sea for each', () => {
  for (const k of ['rib', 'console', 'cabin', 'cruiser', 'sail']) assert.ok(openSea(k), k);
  for (const k of ['row', 'skiff', 'kayak', 'bass', 'jetski']) assert.ok(!openSea(k), k);
  assert.equal(seaFor('skiff', 0.3), 'fine');
  assert.equal(seaFor('skiff', 0.8), 'lively');
  assert.equal(seaFor('skiff', 1.2), 'rough');
  assert.equal(seaFor('skiff', 1.5), 'dangerous');
  assert.equal(seaFor('cruiser', 1.5), 'fine', 'the yacht shrugs off what swamps the skiff');
});

test('time to turn for home: fuel for the way back and half again, home an hour before the gale, an open boat home before dark', () => {
  const far = { kind: 'skiff', distHome: 1000 };
  assert.equal(turnForHome({ ...far, litres: 15, toGale: null, toDark: 10 }), null, 'plenty of everything');
  const fuel = turnForHome({ ...far, litres: 3 });
  assert.equal(fuel.why, 'fuel');
  assert.match(fuel.words, /about 3 L back to Willowhaven in the motor skiff, and you have 3 L: too little to spare/);
  assert.match(turnForHome({ ...far, litres: 4 }).words, /about 3 L back .* you have 4 L: too little to spare/, 'half as much again as the way home is the margin');
  const gale = turnForHome({ ...far, litres: 15, toGale: 4 });
  assert.equal(gale.why, 'gale', 'three and a half hours home with four to go: not the hour to spare');
  assert.match(gale.words, /gale’s due in 4 hours, and it’s 3\.5 hours back/);
  assert.equal(turnForHome({ ...far, litres: 15, toGale: 6 }), null);
  assert.equal(turnForHome({ ...far, litres: 15, toDark: 3 }).why, 'dark');
  assert.equal(turnForHome({ kind: 'cabin', distHome: 1000, litres: 30, toDark: 3 })?.why ?? null, null, 'a boat with a cabin and lights can stay out after dark');
  assert.equal(turnForHome({ kind: 'row', distHome: 1000, litres: null, toGale: 1.2 }).why, 'gale', 'oars: no fuel to run out of, but the gale still counts');
});

test('the planner on the Blue Water: the run, the boat, the gale and the season, each a tick or a warning', () => {
  const plan = offshorePlan({ placeName: 'The Blue Water', dist: 1100, kind: 'skiff', litres: 20, toGale: 5, season: 0.05, seasonName: 'winter', fish: 'albacore' });
  const text = plan.map((p) => `${p.ok ? '✓' : '!'} ${p.text}`).join('\n');
  assert.match(text, /✓ The Blue Water is 1\.1 km away: about 4 hours each way in the motor skiff, 7 L of fuel there and back \(20 L aboard\)/);
  assert.match(text, /! The motor skiff is an inshore boat/);
  assert.match(text, /! A gale is due in 5 hours: not long enough/);
  assert.match(text, /! The albacore is scarce in winter/);
  const good = offshorePlan({ placeName: 'The Blue Water', dist: 1100, kind: 'console', litres: 180, toGale: null, season: 1.3, fish: 'albacore' });
  assert.ok(good.every((p) => p.ok), good.map((p) => p.text).join(' | '));
  assert.ok(OFFSHORE_AT >= 400 && OFFSHORE_AT <= 900);
});

test('the field guide says when a fish is about, from the same year the game plays by', async () => {
  const { seasonsOf } = await import('../src/guide.js');
  const { fishById } = await import('../src/fish.js');
  assert.equal(seasonsOf(fishById.albacore), 'most about in summer; scarce in spring and winter');
  assert.equal(seasonsOf(fishById.mackerel), 'most about in summer; scarce in winter');
  assert.equal(seasonsOf(fishById.squid), 'most about in autumn and winter');
  assert.equal(seasonsOf(fishById.goldsinny ?? { id: 'nothing-listed' }), 'about all year round');
});

/* ---------- E3c: home again, the day book, the badges ---------- */

const { backHome, HOME_R, startTrip, endTrip, summaryText } = await import('../src/trip.js');
const { sanitizeLogEntry, sanitize } = await import('../src/save.js');
const { noteTrip, dayPage, dayText, cleanToday, cleanDays, newToday, CHALLENGES, checkChallenges } = await import('../src/daybook.js');

test('a trip ends back where you set off, once you have fished its water and been away; not where it began', () => {
  const trip = { arrived: false, from: { x: 4, z: -97 } };
  assert.equal(backHome(trip, 5, -95), false, 'not yet on the water');
  trip.arrived = true;
  assert.equal(backHome(trip, 5, -95), false, 'on its water from the start, and never away: not over');
  assert.equal(backHome(trip, 4, -97 + HOME_R * 3), false, 'away now');
  assert.equal(trip.left, true);
  assert.equal(backHome(trip, 4 + HOME_R - 5, -97), true, 'and back');
  assert.equal(backHome({ arrived: true, left: true }, 0, 0), false, 'an older trip with no starting point ends by hand');
});

test('the trip remembers where it set off from and in what, through a save', () => {
  const s = sanitize({});
  startTrip(s, { sp: 'albacore', place: { x: 100, z: 1000, r: 40, name: 'The Blue Water' }, setup: { rod: 'biggame', item: 'skirt', term: 'none', line: 'm50' }, from: { x: 4.4, z: -97.2 }, boat: 'console' });
  s.trip.left = true;
  const back = sanitize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.trip?.from, { x: 4, z: -97 });
  assert.equal(back.trip.boat, 'console');
  assert.equal(back.trip.left, true);
  const junk = sanitize({ ...JSON.parse(JSON.stringify(s)), trip: { ...s.trip, from: { x: 'a' }, boat: 'Console Boat!' } });
  assert.equal(junk.trip.from, undefined);
  assert.equal(junk.trip.boat, undefined);
});

test('the catch log keeps how long the fight was, the boat and the friend who helped; the journal says so', async () => {
  const e = sanitizeLogEntry({ sp: 'albacore', size: 95, day: 3, hour: 11, zone: 'deep', kind: 'lure', rod: 'biggame', from: 'boat', fight: 263.4, boat: 'console', helper: ' Tris ', helped: 'helm' });
  assert.equal(e.fight, 263);
  assert.equal(e.boat, 'console');
  assert.deepEqual([e.helper, e.helped], ['Tris', 'helm']);
  const old = sanitizeLogEntry({ sp: 'albacore', size: 95, day: 3, hour: 11 });
  assert.equal('fight' in old || 'boat' in old || 'helper' in old, false, 'an older entry has none of them');
  const bad = sanitizeLogEntry({ sp: 'albacore', size: 95, fight: 'long', boat: '<b>', helper: 'Tris', helped: 'cheered' });
  assert.equal('fight' in bad || 'boat' in bad || 'helper' in bad, false, 'junk dropped');
  // (A stand-in page for the journal's module.)
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }), fonts: null };
  const { Journal } = await import('../src/journal.js');
  assert.match(Journal.howText(e), /from the centre-console boat · fought 4 minutes · Tris at the helm$/);
  assert.match(Journal.howText({ ...e, helped: 'net', fight: 40 }), /fought 40 seconds · netted by Tris$/);
  assert.match(Journal.howText(old), /from the boat$/);
  // A crewmate rides a friend's boat on foot: still that boat, not the shore.
  assert.match(Journal.howText({ ...e, from: 'shore', helper: undefined, helped: undefined }), /from the centre-console boat · fought 4 minutes$/);
  assert.match(Journal.howText({ ...old, from: 'shore' }), /from the shore$/);
});

test('the trip goes into the day book, and keeps through a save', () => {
  const s = sanitize({});
  s.day = 4;
  s.today = newToday(4);
  noteTrip(s.today, { name: 'The Blue Water', sp: 'albacore', boat: 'console', target: 2, total: 5, hours: 6.47 });
  const page = dayPage(s);
  assert.ok(page, 'a day with a trip has a page');
  assert.match(dayText(page), /A trip to The Blue Water in the centre-console boat for albacore: 2 caught \(and 3 other fish\), 6\.5 hours out\./);
  noteTrip(s.today, { name: 'Wend estuary', sp: 'seabass', target: 0, total: 0, hours: 0.5 });
  assert.match(dayText(dayPage(s)), /A trip to Wend estuary for european seabass: none this time, 30 minutes out\./);
  const kept = cleanToday(JSON.parse(JSON.stringify(s.today)), 4);
  assert.equal(kept.trips.length, 2);
  // The same minutes as the trip's own summary, through a save (27, not 24 from a rounded 0.4 h).
  const t = newToday(4);
  noteTrip(t, { name: 'the outer coast', sp: 'mackerel', boat: 'skiff', target: 1, total: 1, hours: 0.452 });
  noteTrip(t, { name: 'the outer coast', sp: 'mackerel', target: 1, total: 1, hours: 1.02 });
  const words = dayText(dayPage({ ...s, today: cleanToday(JSON.parse(JSON.stringify(t)), 4) }, cleanToday(JSON.parse(JSON.stringify(t)), 4)));
  assert.match(words, /1 caught, 27 minutes out\./);
  assert.match(summaryText('mackerel', { hours: 0.452, target: 1, total: 1, best: { size: 41 }, others: {} }), /^27 minutes out/);
  assert.match(words, /1 caught, 1 hour out\./);
  assert.equal(cleanDays([JSON.parse(JSON.stringify(dayPage(s)))])[0].trips.length, 2);
  assert.equal(cleanToday({ ...s.today, trips: [{ sp: 'nothing' }, 'x'] }, 4).trips.length, 0, 'junk dropped');
});

test('two new badges: a big fish from the Blue Water, and one landed with a friend at your helm', () => {
  const ids = CHALLENGES.map((c) => c.id);
  assert.ok(ids.includes('bluewater') && ids.includes('crewed'));
  const s = sanitize({});
  s.log = [{ sp: 'mackerel', zone: 'deep', day: 1, hour: 10 }, { sp: 'albacore', zone: 'open', day: 1, hour: 11 }];
  assert.deepEqual(checkChallenges(s).map((c) => c.id).filter((id) => id === 'bluewater' || id === 'crewed'), [], 'a mackerel out there, or an albacore inshore, isn’t it');
  s.log.push({ sp: 'albacore', zone: 'deep', day: 2, hour: 9, helper: 'Tris', helped: 'helm' });
  const got = checkChallenges(s).map((c) => c.id);
  assert.ok(got.includes('bluewater') && got.includes('crewed'), got.join(', '));
});
