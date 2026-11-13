// The tow, together (F4b): a crewmate tending the towline surges a snatch round the cleat (see
// lines.js TEND, mooring.js towStep's hold) and takes it back in after; a tow goes out with the
// skipper's position (together.js cleanPose tw) so friends see her come along on the line; and the
// word to tend it goes to the skipper's game from a crewmate aboard, from nobody else. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { LINES, STRENGTH, TEND, tendHold, tendLine } = await import('../src/lines.js');
const { Together, cleanPose, TOW_REACH } = await import('../src/together.js');
const { Crew } = await import('../src/crew.js');
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

test('tending a towline: a snatch that parts a worn line is held at what the tender lets it take, line let run, and taken back in once it’s slack', async () => {
  const THREE = await import('three');
  const { Boat } = await import('../src/boat.js');
  const M = await import('../src/mooring.js');
  const scene = new THREE.Scene();
  let clock = 0, lane = 0;
  // The RIB snatching the centre console flat out from a slack line, as in lines.test.mjs, then
  // `after` seconds with her throttle closed; `extra0`, line already let run to start with.
  const run = (strength, tended, { secs = 12, after = 0, extra0 = 0 } = {}) => {
    const lead = new Boat(scene, { kind: 'rib' }), towed = new Boat(scene, { kind: 'console' }), z = 2400 + 60 * lane++;
    lead.place(400, z, Math.PI / 2);
    towed.place(400 - lead.hull.L / 2 - towed.hull.L / 2 - 0.4, z, Math.PI / 2);
    const out = {};
    let parted = false, peakT = 0, extra = extra0, most = extra0, slipped = false;
    for (let i = 0; i < (secs + after) * 30 && !parted; i++) {
      clock += 1 / 30;
      const lever = i < secs * 30 ? 1 : 0;
      lead.motor = true;
      lead.lever = lever;
      lead.update(1 / 30, clock, lever, 0, 0);
      towed.update(1 / 30, clock, 0, 0, 0);
      M.towStep(lead, towed, 1 / 30, M.TOW.len + extra, out, strength, tendHold(LINES.towline, tended, extra));
      slipped ||= out.slip > 0;
      extra = tendLine(extra, out, LINES.towline, tended, 1 / 30);
      most = Math.max(most, extra);
      parted = out.parted;
      peakT = Math.max(peakT, out.T || 0);
    }
    return { parted, peakT, extra, most, slipped, towed };
  };
  const worn = STRENGTH.realistic;
  assert.equal(run(worn, false).parted, true, 'untended, a worn line parts');
  const held = run(worn, true);
  assert.equal(held.parted, false, 'tended, it holds');
  assert.ok(held.slipped, 'surged round the cleat');
  assert.ok(Math.abs(held.peakT - LINES.towline.mbl * TEND.hold) < 1, `held at what the tender lets it take: ${(held.peakT / 1000).toFixed(1)} kN`);
  assert.ok(held.most > 0.3 && held.most <= TEND.spare, `${held.most.toFixed(2)} m let run`);
  assert.ok(held.towed.speed > 2, 'and she comes along');
  const back = run(worn, true, { after: 30 });
  assert.ok(back.most > 0.3 && back.extra === 0, `taken back in once it’s slack (${back.most.toFixed(2)} m out, then ${back.extra} m)`);
  // With all the spare line run out, the bitter end's made fast: it takes what comes.
  assert.equal(tendHold(LINES.towline, true, TEND.spare), Infinity);
  assert.equal(run(worn, true, { extra0: TEND.spare }).parted, true, 'no more line to let run: it parts');
  // Nobody tending: nothing let run or taken back.
  assert.equal(tendLine(3, { slip: 1, T: 0 }, LINES.towline, false, 1), 3);
  assert.equal(tendLine(3, { slip: 0, T: 0 }, LINES.towline, true, 1), 3 - TEND.back);
  assert.equal(tendLine(3, { slip: 0, T: LINES.towline.mbl * 0.2 }, LINES.towline, true, 1), 3, 'under strain it stays out');
});

test('a tow in the skipper’s position: her boat, near enough to be on a towline, the pull and the line let run, and who’s tending it', () => {
  const kinds = ['row', 'skiff', 'console', 'rib'];
  const base = { m: 'boat', k: 'rib', x: 100, z: 200, h: 1.2 };
  const tw = { k: 'console', x: 100, z: 208, h: 1.1, t: 4.7, l: 1.5, e: 'peer-1' };
  assert.deepEqual(cleanPose({ ...base, tw }, kinds).tw, tw);
  assert.equal(cleanPose({ ...base, tw: { ...tw, k: 'yacht' } }, kinds).tw, undefined, 'a boat that isn’t one');
  assert.equal(cleanPose({ ...base, tw: { ...tw, k: 'rib' } }, kinds).tw, undefined, 'not the one they’re in');
  assert.equal(cleanPose({ ...base, tw: { ...tw, z: 200 + TOW_REACH + 5 } }, kinds).tw, undefined, 'further off than a towline reaches');
  assert.equal(cleanPose({ ...base, tw: { ...tw, x: 'here' } }, kinds).tw, undefined);
  assert.equal(cleanPose({ ...base, tw: { ...tw, t: 1e6 } }, kinds).tw.t, 60, 'the pull held to what a towline takes');
  assert.equal(cleanPose({ ...base, tw: { ...tw, e: '<b>' } }, kinds).tw.e, undefined, 'a tender that isn’t an id');
  assert.equal(cleanPose({ m: 'foot', x: 1, z: 2, h: 0, tw }, kinds).tw, undefined, 'only from a boat');
});

test('the tow goes out with the skipper, and the word to tend it reaches her game from a crewmate aboard, from nobody else', async () => {
  const hub = new Hub();
  const clock = { t: 100 };
  const mk = (name, extra = {}) => new Together({ config: () => CFG, name: () => name, kinds: ['row', 'skiff', 'console', 'rib'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const T = [mk('Mags', { newCode: () => '7272' }), mk('Bert'), mk('Cass')];
  const K = T.map((t) => new Crew({ together: t }));
  const said = T.map(() => []);
  T.forEach((t, i) => { t.onEvent = (kind, p, d) => { if (kind === 'crew') said[i].push(K[i].heard(p, d)); }; });
  try {
    await T[0].host();
    await T[1].join('7272');
    await T[2].join('7272');
    await until(() => T.every((t) => t.others.length === 2));
    // Mags in the RIB towing her console; Bert crewing with her; Cass in her own boat.
    K[1].on = { id: T[0].id, x: 0.3, z: -0.8, helm: false };
    let towing = { k: 'console', x: 50, z: 52, h: 0, t: 2.4, l: 0 };
    const poses = () => [
      { m: 'boat', k: 'rib', x: 50, z: 60, h: 0, ...(towing ? { tw: towing } : {}) },
      { m: 'foot', x: 50.3, z: 59.2, h: 0, a: 'stand', cr: T[0].id, cx: 0.3, cz: -0.8 },
      { m: 'boat', k: 'row', x: 70, z: 60, h: 0 },
    ];
    const step = async (secs) => {
      for (let i = 0; i < secs * 30; i++) {
        clock.t += 1 / 30;
        const P = poses();
        T.forEach((t, k) => t.update(1 / 30, P[k]));
        if (i % 10 === 0) await wait(2);
      }
      await wait(20);
    };
    await step(1);
    const seen = (t) => (t.peers.get(T[0].id).view || t.peers.get(T[0].id).pose).tw;
    assert.deepEqual(seen(T[2]), { k: 'console', x: 50, z: 52, h: 0, t: 2.4, l: 0 }, 'Cass sees the tow');
    // The console coming along, the line taking the strain: everyone sees it.
    towing = { ...towing, z: 50, t: 9, l: 1.4, e: T[1].id };
    await step(1);
    assert.deepEqual(seen(T[2]), { k: 'console', x: 50, z: 50, h: 0, t: 9, l: 1.4, e: T[1].id });
    // Bert asks to tend it: Mags's game hears; Cass, not aboard, asking, is not heard.
    assert.ok(T[1].crewWord(T[0].id, 'tend'));
    T[2].crewWord(T[0].id, 'tend');
    await step(0.3);
    assert.deepEqual(said[0].filter(Boolean), ['tend'], 'from Bert, aboard; not from Cass');
    assert.ok(T[1].crewWord(T[0].id, 'untend'));
    await step(0.3);
    assert.deepEqual(said[0].filter(Boolean), ['tend', 'untend']);
    // The tow let go: it's gone from everyone's view of her.
    towing = null;
    await step(1);
    assert.equal(seen(T[2]), undefined);
  } finally {
    T.forEach((t) => t.leave());
  }
});
