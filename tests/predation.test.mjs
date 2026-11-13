// The living ocean D3 (docs/ECOLOGY.md): the hunters strike. A fish-eater at a shoal of small fish
// (D1) dashes through it, an ambusher in cover goes for one that comes by; the shoal bulges away,
// a small fish is taken now and then (never more than a third of the shoal, and back in time), and at
// the top there's a slash and a flicker of silver. A shoal of mackerel drives the sprat up when it's
// keenest. The host decides it all, and everyone sees the same.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { seeded } = await import('../src/util.js');

const habitat = createHabitat();
const withDice = (fn, seed = 5) => {
  const r = Math.random;
  Math.random = seeded(seed);
  try {
    return fn();
  } finally {
    Math.random = r;
  }
};
const settle = (eco) => {
  Object.assign(eco.ctx, { hour: 12, daylight: 1, night: 0, cloud: 0, rain: 0, tide: { flow: 0.5 } });
  eco.update(0, { env: {}, focus: { x: 0, z: 0 }, boat: { x: 0, z: 1e5, speed: 0 } });
};
// A hunter set at a shoal, a few metres off it at its depth.
const atShoal = (a, s, d = 5) => {
  Object.assign(a, { x: s.x + d, z: s.z, y: s.y, state: 'cruise', shoal: s, atPrey: true, strikeT: 0 });
};
const alive = (s) => s.members.filter((m) => m.state === 'school' && m.active).length;
const fresh = (s) => {
  for (const m of s.members) if (m.state === 'gone') m.state = 'school';
  Object.assign(s, { scatterT: 0, threat: 0, threatT: -1e9 });
};

test('a hunter at a shoal strikes through it: the shoal bulges away, its fear rises, a splash at the top', () => {
  const eco = new Ecosystem(habitat);
  settle(eco);
  const s = eco.forage.find((f) => f.sp.id === 'sandsmelt');
  const bass = eco.bySpecies.seabass[0];
  assert.ok(bass.eater && !eco.bySpecies.mullet?.[0]?.eater);
  withDice(() => {
    eco.activity.seabass = 0.9;
    s.y = -1.2;
    atShoal(bass, s);
    eco.clues.length = 0;
    eco.stalk(bass, 1 / 30);
  });
  assert.ok(s.scatterT >= 0.9 && s.sx === bass.x - 0 && Math.abs(s.sz - s.z) < 1e-9 + Math.abs(bass.z - s.z), 'the shoal bulges away from it');
  assert.ok(eco.fearOf(s) >= 0.45, `fear ${eco.fearOf(s).toFixed(2)}`);
  assert.ok(bass.wantSpeed > bass.L.speed * 1.5, 'a dash');
  assert.ok(bass.strikeT > 5, `and a wait before the next: ${bass.strikeT.toFixed(1)} s`);
  assert.ok(eco.clues.some((c) => c.type === 'splash'), 'a slash at the top');
  // Deep, no splash; not keen, no strike; out of reach, no strike.
  fresh(s);
  withDice(() => {
    s.y = -5;
    atShoal(bass, s);
    bass.y = -5;
    eco.clues.length = 0;
    eco.stalk(bass, 1 / 30);
  });
  assert.ok(s.scatterT > 0 && !eco.clues.some((c) => c.type === 'splash'), 'deep: no splash');
  fresh(s);
  eco.activity.seabass = 0.2;
  atShoal(bass, s);
  eco.stalk(bass, 1 / 30);
  assert.equal(s.scatterT, 0, 'not keen: no strike');
  fresh(s);
  eco.activity.seabass = 0.9;
  atShoal(bass, s, 20);
  eco.stalk(bass, 1 / 30);
  assert.equal(s.scatterT, 0, '20 m off: no strike');
});

test('small fish are taken, never more than a third of the shoal, and come back in time', () => {
  const eco = new Ecosystem(habitat);
  settle(eco);
  const s = eco.forage.find((f) => f.sp.id === 'sprat');
  const bass = eco.bySpecies.pollack[0];
  const n = s.members.length;
  let taken = 0;
  withDice(() => {
    eco.activity.pollack = 0.9;
    for (let i = 0; i < 200; i++) {
      s.scatterT = 0;
      atShoal(bass, s);
      eco.onStrike = (a, sh, m) => { if (m) taken++; };
      eco.stalk(bass, 1 / 30);
    }
  });
  assert.ok(taken > 0, `${taken} taken`);
  assert.ok(alive(s) >= Math.ceil((n * 2) / 3), `${alive(s)} of ${n} left`);
  assert.equal(alive(s) + taken, n);
  // Back in time, away from anyone: the taken rejoin the shoal.
  const gone = s.members.filter((m) => m.state === 'gone');
  assert.ok(gone.every((m) => m.backAt > eco.time + 200 && m.backAt < eco.time + 500));
  eco.focus = { x: s.home.x + 5000, z: s.home.z };
  eco.time = Math.max(...gone.map((m) => m.backAt)) + 1;
  eco.stepWorld(1 / 30);
  assert.ok(gone.every((m) => m.state === 'school'), 'back in the shoal');
});

test('an ambusher lying up in cover goes for a shoal that comes by within a few metres', () => {
  const eco = new Ecosystem(habitat);
  settle(eco);
  const pike = eco.bySpecies.pike[0];
  const s = eco.forage.find((f) => f.sp.id === 'roach' || f.sp.id === 'rudd');
  eco.activity.pike = 0.9;
  const lie = (d) => withDice(() => {
    fresh(s);
    Object.assign(pike, { x: s.x + d, z: s.z, y: s.y, state: 'rest', shoal: null, strikeT: 0 });
    eco.stalk(pike, 1 / 30);
    return s.scatterT > 0;
  });
  assert.ok(lie(5), 'by within 5 m: it goes');
  assert.ok(!lie(14), '14 m off: it lies still');
  // (Not a hunter of small fish: never.)
  const mullet = eco.schools.find((f) => f.sp.id === 'mullet').members[0];
  assert.ok(!mullet.eater);
});

test('the host decides the strikes; a guest sees the shoal bulge and the fish taken', () => {
  const host = new Ecosystem(habitat), guest = new Ecosystem(habitat);
  guest.follower = true;
  settle(host);
  settle(guest);
  const s = host.forage.find((f) => f.sp.id === 'sandsmelt');
  const bass = host.bySpecies.seabass[0];
  // A guest's own fish never strike.
  const gs = guest.schools[s.id], gb = guest.bySpecies.seabass[0];
  guest.activity.seabass = 0.9;
  Object.assign(gb, { x: gs.x + 5, z: gs.z, y: gs.y, state: 'cruise', shoal: gs, atPrey: true, strikeT: 0 });
  guest.stepAgent(gb, 1 / 30, false);
  assert.equal(gs.scatterT, 0, 'the guest’s own bass didn’t strike');
  // The host's does, and takes some.
  host.activity.seabass = 0.9;
  let n = 0;
  withDice(() => {
    for (let i = 0; i < 40 && !s.members.some((m) => m.state === 'gone'); i++) {
      s.scatterT = 0;
      atShoal(bass, s);
      host.stalk(bass, 1 / 30);
      n++;
    }
  });
  const goneIds = s.members.filter((m) => m.state === 'gone').map((m) => m.id);
  assert.ok(goneIds.length > 0, `taken after ${n} strikes`);
  const focus = { x: s.x, z: s.z };
  guest.applySchools(JSON.parse(JSON.stringify(host.captureSchools([focus]))), 0.1);
  const snap = JSON.parse(JSON.stringify(host.captureAgents([focus])));
  guest.applyAgents(snap, 'guest');
  assert.ok(gs.scatterT > 0.5 && Math.abs(gs.sx - s.sx) < 0.2, 'the guest’s shoal bulges away from the same place');
  for (const id of goneIds) assert.equal(guest.agents[id].state, 'gone', 'and the same fish are gone');
});

test('a shoal of mackerel drives the sprat up when it’s keenest, in short frenzies with long rests', () => {
  const eco = new Ecosystem(habitat);
  settle(eco);
  const mk = eco.schools.find((f) => f.sp.id === 'mackerel');
  const H = mk.L.hunt;
  assert.deepEqual(mk.L.hunter, ['sprat', 'sandsmelt']);
  // A sprat shoal brought close.
  const sp = eco.forage.find((f) => f.sp.id === 'sprat' && mk.L.zones.includes(f.home.zone));
  Object.assign(sp, { x: mk.x + 30, z: mk.z, y: -3 });
  withDice(() => {
    eco.activity.mackerel = 1;
    for (let i = 0; i < 30 * 30 && !(mk.frenzy > 0); i++) {
      eco.activity.mackerel = 1;
      eco.stepSchool(mk, 1 / 30, false);
      sp.x = mk.x + 10;
      sp.z = mk.z;
    }
  });
  assert.ok(mk.frenzy >= H.frenzy[0] - 1 && mk.frenzy <= H.frenzy[1], `a frenzy of ${mk.frenzy.toFixed(0)} s`);
  assert.equal(mk.prey, sp);
  // At the end, a long rest.
  withDice(() => {
    for (let i = 0; i < 30 * 50 && mk.frenzy > 0; i++) {
      eco.activity.mackerel = 1;
      eco.stepSchool(mk, 1 / 30, false);
      sp.x = mk.x + 10;
      sp.z = mk.z;
    }
  });
  assert.ok(mk.rest >= H.rest[0] - 1 && mk.rest <= H.rest[1], `then rests ${mk.rest.toFixed(0)} s`);
  // Not keen enough (dusk, or a cold spring): it doesn't hunt.
  Object.assign(mk, { rest: 0, frenzy: 0, prey: null, huntT: 0 });
  eco.activity.mackerel = 0.6;
  eco.stepSchool(mk, 1 / 30, false);
  assert.ok(!mk.prey && !(mk.frenzy > 0));
  // And never in water it doesn't keep to: a sand smelt shoal in the harbour isn't its.
  const harbour = eco.forage.find((f) => f.sp.id === 'sandsmelt' && !mk.L.zones.includes(f.home.zone));
  if (harbour) {
    Object.assign(mk, { rest: 0, frenzy: 0, prey: null, huntT: 0 });
    for (const o of eco.forage) if (o !== harbour) { o.x += 1e5; }
    Object.assign(harbour, { x: mk.x + 20, z: mk.z });
    eco.activity.mackerel = 1;
    eco.stepSchool(mk, 1 / 30, false);
    assert.notEqual(mk.prey, harbour);
  }
});
