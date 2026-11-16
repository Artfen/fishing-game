// G9b of docs/PROGRESSION.md (item 12, harbours and people): people at the small harbours, which had
// no one (src/townsfolk.js, src/world/folk.js, src/world/regions.js, src/requests.js). Bryn Tregear
// keeps Wend Quay: sweeps the quay, fishes for the mullet off the end of it (and now and then has
// one), puts the camp to rights, sits on its bench, and lives in a hut above it. Fen Hollis is the
// Marine Trust's seabird warden on Gannet Isle for the season: counts the colony from the clifftop
// over Puffin Cove with her binoculars, watches from the landing stage, writes up in the bivouac,
// eats on the driftwood log, and counts the shearwaters gathering at dusk; in autumn and winter
// she's gone. Each has a day round the clock and the weather, words of their own, and a favour.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const F = await import('../src/townsfolk.js');
const T = await import('../src/world/terrain.js');
const Q = await import('../src/requests.js');
const { buildCoast } = await import('../src/world/coast.js');
const { buildRegions } = await import('../src/world/regions.js');
const { seeded } = await import('../src/util.js');
const { FolkView } = await import('../src/world/folk.js');
const { fishById } = await import('../src/fish.js');
const { BIRDS } = await import('../src/birdData.js');

const coast = buildCoast(new THREE.Scene(), seeded(20261024));
const regions = buildRegions(new THREE.Scene(), seeded(7));
const SOLID = [...coast.obstacles, ...regions.obstacles];
const FAIR = { storm: 0, rain: 0, wind: 4, about: [], activity: { mullet: 0.9 }, season: 'summer' };
const WET = { storm: 0.1, rain: 0.8, wind: 9, about: [], activity: {}, season: 'summer' };
const GALE = { storm: 0.75, rain: 0.6, wind: 17, about: [], activity: {}, season: 'summer' };
const DAY = 5;
const block = (id, h, ctx) => F.blockFor(id, h, ctx, DAY);
const PLACES = {
  bryn: ['brynHut', 'quayTop', 'mulletEnd', 'wendBench', 'pitch'],
  fen: ['bivouac', 'fenLog', 'stage', 'cliff', 'headland'],
};
const HOME = { bryn: T.WEND_CAMP, fen: T.GANNET_CAMP };

test('the small harbours’ people: Bryn at Wend Quay, Fen on Gannet Isle, each with places of their own there', () => {
  for (const id of ['bryn', 'fen']) {
    assert.ok(F.FOLK[id].remote && !F.FOLK[id].south, `${id}: at a small harbour, walked to straight`);
    assert.ok(F.FOLK_IDS.includes(id));
    assert.ok(PLACES[id].includes(F.FOLK[id].home));
    for (const k of PLACES[id]) {
      const S = F.SPOTS[k];
      assert.ok(S.remote, `${k}: marked`);
      // Ashore (the quay's and the landing stage's decks count), and near their harbour.
      assert.ok(T.walkHeight(S.x, S.z) > 0.6, `${k}: ashore (${T.walkHeight(S.x, S.z).toFixed(2)} m)`);
      assert.ok(Math.hypot(S.x - HOME[id].x, S.z - HOME[id].z) < 45, `${k}: at their harbour`);
      // Not stood inside anything: the tent, the tackle box, the hut, the quay's bollards.
      for (const o of SOLID) assert.ok(Math.hypot(S.x - o.x, S.z - o.z) > o.r + 0.2, `${k} is inside something at ${o.x.toFixed(1)}, ${o.z.toFixed(1)}`);
    }
  }
  assert.match(F.FOLK.bryn.role, /Wend Quay/);
  assert.match(F.FOLK.fen.role, /Marine Trust’s seabird warden/);
  // Bryn's hut is built above the camp, and his door is in front of it.
  const H = T.WEND_HUT;
  assert.ok(regions.obstacles.filter((o) => Math.hypot(o.x - H.x, o.z - H.z) < 1).length === 2, 'the hut is solid');
  assert.ok(Math.abs(F.SPOTS.brynHut.z - (H.z - H.d / 2)) < 1 && Math.abs(F.SPOTS.brynHut.x - H.x) < H.w / 2);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const g = T.heightAt(H.x + (dx * H.w) / 2, H.z + (dz * H.d) / 2);
    assert.ok(g > 0.8 && Math.abs(g - T.heightAt(H.x, H.z)) < 0.5, `the hut stands on level, dry ground (${g.toFixed(2)} m)`);
  }
  // The quay's places are on its deck; the stage's is at the end of the landing stage.
  for (const k of ['quayTop', 'mulletEnd']) {
    const S = F.SPOTS[k], Qy = T.QUAY;
    assert.ok(S.x > Qy.x0 && S.x < Qy.x1 && S.z > Qy.z0 && S.z < Qy.z1, `${k}: on the quay`);
  }
  const P = T.COVE_PIER, S = F.SPOTS.stage;
  assert.ok(S.x > P.x0 && S.x < P.x1 && S.z > P.z0 && S.z < P.z0 + 2, 'the end of the landing stage');
  // Fen's clifftop: up over the cove, among the puffins (world/birds.js perches them 15–70 m from it).
  const C = F.SPOTS.cliff, d = Math.hypot(C.x - T.PUFFIN_COVE.x, C.z - T.PUFFIN_COVE.z);
  assert.ok(T.heightAt(C.x, C.z) > 4 && d > 15 && d < 70, `the clifftop, ${T.heightAt(C.x, C.z).toFixed(1)} m up, ${d.toFixed(0)} m from the cove`);
});

test('what’s built: Bryn’s hut and the Longmere boathouse pitched up to the ridge, the camp’s bench stood on its ground', () => {
  // (Every vertex of the merged meshes beyond the bay, in world space: the group sits at the origin.)
  const pts = [];
  regions.group.traverse((o) => {
    const P = o.isMesh && !o.isInstancedMesh && o.parent === regions.group ? o.geometry?.attributes?.position : null;
    if (P) for (let i = 0; i < P.count; i++) pts.push([P.getX(i), P.getY(i), P.getZ(i)]);
  });
  // (A roof's slabs are boxes, so their vertices are all at their corners, out at the gable ends
  // just past the walls: look there, which leaves out anything on the roof, like the stove pipe.)
  const roof = (cx, cz, hw, hd, above) => {
    const near = pts.filter(([x, y, z]) => Math.abs(x - cx) > hw - 0.05 && Math.abs(x - cx) < hw + 0.35 && Math.abs(z - cz) < hd && y > above);
    const ridge = Math.max(...near.filter(([, , z]) => Math.abs(z - cz) < 0.3).map(([, y]) => y));
    const eaves = Math.max(...near.filter(([, , z]) => Math.abs(z - cz) > hd - 0.5).map(([, y]) => y));
    return { ridge, eaves };
  };
  const H = T.WEND_HUT, hy = T.heightAt(H.x, H.z);
  const h = roof(H.x, H.z, H.w / 2, H.d / 2 + 0.3, hy + 1.6);
  assert.ok(h.ridge > h.eaves + 0.4, `the hut's ridge ${h.ridge.toFixed(2)} above its eaves ${h.eaves.toFixed(2)}`);
  // (The boathouse: a shed on the bank beside the jetty, its roof 3.4 m deep across the ridge.)
  const B = T.BOATHOUSE, bx = B.x + 4.5, bz = B.z + 4, by = T.heightAt(B.x + 3, B.z);
  const b = roof(bx, bz, 2.1, 1.9, by + 2.2);
  assert.ok(b.ridge > b.eaves + 0.5, `the boathouse's ridge ${b.ridge.toFixed(2)} above its eaves ${b.eaves.toFixed(2)}`);
  // The bench at Wend Quay's camp: its seat half a metre up off the ground under it, where Bryn
  // sits (his hips go to the usual seat height above the ground).
  const C = T.WEND_CAMP, g = T.heightAt(C.x + 1, C.z - 2.4);
  const seat = Math.max(...pts.filter(([x, y, z]) => Math.abs(x - (C.x + 1)) < 0.65 && Math.abs(z - (C.z - 2.4)) < 0.18 && y < g + 1).map(([, y]) => y));
  assert.ok(Math.abs(seat - g - 0.48) < 0.03, `the bench's seat ${(seat - g).toFixed(2)} m off the ground`);
  assert.ok(Math.abs(T.walkHeight(F.SPOTS.wendBench.x, F.SPOTS.wendBench.z) + 0.47 - seat) < 0.06, 'Bryn sits on it');
});

test('the ways between their places: onto the quay at its foot, round the camp’s things; ashore and clear all the way', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  for (const id of ['bryn', 'fen']) {
    const p = town.people[id];
    for (const a of PLACES[id]) {
      for (const b of PLACES[id]) {
        if (a === b) continue;
        const A = F.SPOTS[a], B = F.SPOTS[b];
        p.pos = { x: A.x, z: A.z };
        p.block = { key: 'from', spot: a, act: 'stand' };
        town.begin(p, { key: 'to', spot: b, act: 'stand' }, 0, FAIR);
        assert.ok(p.path, `${a} → ${b}`);
        const L = F.pathLength(p.path);
        for (let s = 0; s <= L; s += 0.2) {
          const q = F.along(p.path, s);
          // (Above the highest tide, half a metre at springs; the quay and the landing stage are
          // decks. The last strides of the bank onto the quay, at its root, are lapped by the top
          // of the highest springs, as they are for anyone.)
          const root = Math.hypot(q.x - T.QUAY.land.x, q.z - T.QUAY.land.z) < 1.6;
          assert.ok(T.walkHeight(q.x, q.z) > (root ? 0.42 : 0.5), `${a} → ${b} goes into the water at ${q.x.toFixed(1)}, ${q.z.toFixed(1)} (${T.walkHeight(q.x, q.z).toFixed(2)} m)`);
          for (const o of SOLID) assert.ok(Math.hypot(q.x - o.x, q.z - o.z) > o.r + 0.15, `${a} → ${b} runs through something at ${o.x.toFixed(1)}, ${o.z.toFixed(1)}`);
          // (Nor over the driftwood log Fen sits on: only onto it, at her seat.)
          if (id === 'fen' && b !== 'fenLog' && a !== 'fenLog') assert.ok(Math.hypot(q.x - (T.GANNET_CAMP.x), q.z - (T.GANNET_CAMP.z + 4.5)) > 1.5, `${a} → ${b} climbs over the log`);
        }
        assert.ok(L < Math.hypot(A.x - B.x, A.z - B.z) * 2.2 + 8, `${a} → ${b}: ${L.toFixed(0)} m is a long way round`);
      }
    }
  }
  // (Along the quay: straight, not back to its foot.)
  const p = town.people.bryn;
  p.pos = { ...F.SPOTS.quayTop };
  p.block = { key: 'from', spot: 'quayTop', act: 'work' };
  town.begin(p, { key: 'to', spot: 'mulletEnd', act: 'fish' }, 0, FAIR);
  assert.equal(p.path.length, 2);
});

test('Bryn’s day: the quay swept, the mullet off the end of it, the bench and the camp, the hut by night', () => {
  assert.deepEqual([block('bryn', 7, FAIR).spot, block('bryn', 7, FAIR).act], ['quayTop', 'work']);
  const m = block('bryn', 9, FAIR);
  assert.deepEqual([m.spot, m.act, m.target], ['mulletEnd', 'fish', 'mullet']);
  assert.deepEqual([block('bryn', 13, FAIR).spot, block('bryn', 13, FAIR).act], ['wendBench', 'sit']);
  assert.deepEqual([block('bryn', 14, FAIR).spot, block('bryn', 14, FAIR).act], ['pitch', 'work']);
  assert.deepEqual([block('bryn', 18, FAIR).spot, block('bryn', 18, FAIR).act], ['mulletEnd', 'fish']);
  assert.deepEqual([block('bryn', 20, FAIR).spot, block('bryn', 20, FAIR).act], ['wendBench', 'sit']);
  for (const h of [3, 12, 16, 23]) assert.deepEqual([block('bryn', h, FAIR).spot, block('bryn', h, FAIR).act], ['brynHut', 'inside'], `${h}:00 in the hut`);
  // The weather: no mullet in the pouring rain or a blow (they keep away from rough water), nor
  // sweeping in a gale; the evening's fishing and the bench only when it's fair.
  assert.equal(block('bryn', 9, WET).act, 'inside');
  assert.equal(block('bryn', 7, WET).spot, 'quayTop', 'a broom doesn’t mind the rain');
  assert.equal(block('bryn', 7, GALE).act, 'inside');
  assert.equal(block('bryn', 9, GALE).act, 'inside');
  assert.equal(block('bryn', 18, WET).act, 'inside');
  assert.equal(block('bryn', 20, WET).act, 'inside');
  // (Each time in the hut lasts until the next time something could take him out again.)
  for (let h = 0; h < 24; h += 0.25) {
    const b = block('bryn', h, GALE);
    assert.ok(b.until > h && b.until <= h + 12, `${h}: until ${b.until}`);
  }
});

test('Fen’s day: the clifftop at dawn and through the afternoon, the landing stage, the bivouac and the log, the dusk count; gone in autumn and winter', () => {
  for (const season of ['spring', 'summer']) {
    const C = { ...FAIR, season };
    assert.deepEqual([block('fen', 6, C).spot, block('fen', 6, C).act], ['cliff', 'work']);
    assert.deepEqual([block('fen', 8.5, C).spot, block('fen', 8.5, C).act], ['fenLog', 'sit']);
    assert.deepEqual([block('fen', 10, C).spot, block('fen', 10, C).act], ['stage', 'stand']);
    assert.deepEqual([block('fen', 12, C).spot, block('fen', 12, C).act], ['bivouac', 'inside'], 'writing up her counts');
    assert.deepEqual([block('fen', 14, C).spot, block('fen', 14, C).act], ['fenLog', 'sit']);
    assert.deepEqual([block('fen', 15.5, C).spot, block('fen', 15.5, C).act], ['cliff', 'work']);
    assert.deepEqual([block('fen', 17.5, C).spot, block('fen', 17.5, C).act], ['fenLog', 'sit']);
    assert.deepEqual([block('fen', 19.5, C).spot, block('fen', 19.5, C).act], ['headland', 'work']);
    for (const h of [2, 22.5]) assert.equal(block('fen', h, C).act, 'inside');
  }
  // Not counting in the pouring rain, nor out on the stage in a gale.
  assert.equal(block('fen', 6, WET).act, 'inside');
  assert.equal(block('fen', 15.5, WET).act, 'inside');
  assert.equal(block('fen', 10, WET).spot, 'stage');
  assert.equal(block('fen', 10, GALE).act, 'inside');
  // The birds gone, and so is she.
  for (const season of ['autumn', 'winter']) {
    for (let h = 0; h < 24; h += 0.5) {
      const b = block('fen', h, { ...FAIR, season });
      assert.ok(b.act === 'inside' && b.away, `${season} ${h}:00`);
    }
  }
  // (Her season is the seabirds’: the puffins she counts and the shearwaters of her favour.)
  assert.deepEqual(BIRDS.puffin.when, ['spring', 'summer']);
  assert.deepEqual(BIRDS.manx.when, ['spring', 'summer']);
});

test('their days aren’t spent walking: most of each time out is spent where they were going', () => {
  for (const ctx of [FAIR, { ...FAIR, season: 'spring' }]) {
    const town = new F.Townsfolk({ obstacles: coast.obstacles });
    const there = {}, all = {};
    for (let h = 0; h < 24; h += 0.02) {
      town.update(DAY * 24 + h, ctx);
      for (const id of ['bryn', 'fen']) {
        const p = town.people[id], b = p.block;
        if (b.act === 'inside') continue;
        const k = `${id} ${b.key}`;
        all[k] = (all[k] || 0) + 0.02;
        if (p.act !== 'walk') there[k] = (there[k] || 0) + 0.02;
      }
    }
    assert.ok(Object.keys(all).length >= 12);
    for (const k in all) assert.ok((there[k] || 0) > all[k] * 0.5, `${k}: ${(there[k] || 0).toFixed(2)} h there of ${all[k].toFixed(2)}`);
  }
});

test('out there: they go about their days, can be talked to, Bryn lands a mullet now and then, and Willowhaven’s bar knows Fen’s out', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  for (let h = 5; h < 9.5; h += 0.05) town.update(DAY * 24 + h, FAIR);
  const B = town.people.bryn, N = town.people.fen;
  assert.ok(['fish', 'lift'].includes(B.act), B.act);
  assert.ok(Math.hypot(B.pos.x - F.SPOTS.mulletEnd.x, B.pos.z - F.SPOTS.mulletEnd.z) < 0.3, 'off the end of the quay');
  assert.equal(town.near(B.pos.x - 1, B.pos.z)?.id, 'bryn');
  assert.equal(N.act, 'stand');
  assert.ok(Math.hypot(N.pos.x - F.SPOTS.stage.x, N.pos.z - F.SPOTS.stage.z) < 0.3, 'on the landing stage');
  assert.equal(town.near(N.pos.x, N.pos.z + 1)?.id, 'fen');
  assert.ok(town.news(9.5).some((l) => /Fen Hollis is out on Gannet Isle for the Trust/.test(l)));
  // Over a few fair days, Bryn has a mullet or two, and says so; the bar hears of a good one.
  let had = null;
  for (let d = DAY; d < DAY + 4 && !had; d++) {
    for (let h = 7.8; h < 11 && !had; h += 0.05) {
      town.update(d * 24 + h, FAIR);
      had = town.landed.find((l) => l.who === 'Bryn');
    }
  }
  assert.ok(had, 'a mullet in four mornings');
  assert.equal(had.name, fishById.mullet.name);
  assert.equal(had.where, 'off Wend Quay');
  assert.match(F.sayTo({ id: 'bryn', act: 'fish', block: { spot: 'mulletEnd' } }, { landed: town.landed }), new RegExp(`Had one! ${had.size} centimetres`));
  // Autumn: no Fen, and no word of her.
  const fall = new F.Townsfolk({ obstacles: coast.obstacles });
  fall.update(DAY * 24 + 10, { ...FAIR, season: 'autumn' });
  assert.equal(fall.people.fen.act, 'inside');
  assert.equal(fall.near(F.SPOTS.stage.x, F.SPOTS.stage.z), null);
  assert.ok(!fall.news(10).some((l) => /Fen Hollis/.test(l)));
});

test('their words: what they’re at, and they know you if you’ve worked for the harbour office or the Trust', () => {
  const say = (id, act, spot, extra = {}) => F.sayTo({ id, act, block: { spot } }, extra);
  // Bryn.
  assert.match(say('bryn', 'work', 'quayTop'), /keep the old quay/);
  assert.match(say('bryn', 'work', 'quayTop', { rep: { wenna: 2 } }), /Wenna speaks well of you/);
  assert.match(say('bryn', 'fish', 'mulletEnd'), /thirty years they’ve laughed at me/);
  assert.match(say('bryn', 'work', 'pitch'), /tent pegs/);
  assert.match(say('bryn', 'sit', 'wendBench', { hour: 13 }), /tide comes up the Wend/);
  assert.match(say('bryn', 'sit', 'wendBench', { hour: 13, rep: { wenna: 1 } }), /Wenna’s friends are mine/);
  assert.match(say('bryn', 'sit', 'wendBench', { hour: 20 }), /curlews/);
  // Fen.
  assert.match(say('fen', 'work', 'cliff'), /Puffins.*beak full of sandeels/);
  assert.match(say('fen', 'work', 'cliff', { rep: { trust: 2 } }), /Your counts are in the Trust’s records/);
  assert.match(say('fen', 'work', 'headland'), /shearwaters/);
  assert.match(say('fen', 'stand', 'stage'), /once a week, with water and the post/);
  assert.match(say('fen', 'stand', 'stage', { rep: { trust: 1 } }), /done counts for us/);
  assert.match(say('fen', 'sit', 'fenLog'), /Ruth’s fish pie/);
  // (Never nothing to say, whatever they're at.)
  for (const id of ['bryn', 'fen']) for (const act of ['walk', 'stand', 'sit', 'work', 'fish', 'lift']) for (const spot of PLACES[id]) assert.ok(say(id, act, spot).length > 20, `${id} ${act} ${spot}`);
});

test('a favour each: a big mullet from the shore for Bryn, the shearwaters at sea for Fen', () => {
  const M = Q.requestById.bigmullet, S = Q.requestById.shearwaters;
  assert.equal(M.who, 'bryn');
  assert.deepEqual([M.kind, M.species, M.shore], ['catch', 'mullet', true]);
  const sz = fishById.mullet.size;
  assert.ok(M.min > sz[0] && M.min < sz[1], `a mullet that size exists (${sz.join('–')} cm)`);
  // (Made ready by one of fifty or more, from the shore: not a smaller one, nor one from a boat.)
  const Fv = Q.newFavours();
  assert.equal(Q.offerFor('bryn', Fv, 3)?.id, 'bigmullet');
  Q.accept(Fv, 'bigmullet', 3);
  assert.deepEqual(Q.caught(Fv, { id: 'mullet', size: 47, shore: true }), []);
  assert.deepEqual(Q.caught(Fv, { id: 'mullet', size: 55, shore: false }), []);
  assert.equal(Q.caught(Fv, { id: 'mullet', size: 52, shore: true })[0]?.id, 'bigmullet');
  // His thanks: a channel in the Saltings, in the water.
  const mh = T.heightAt(M.reward.pin.x, M.reward.pin.z), m0 = T.MARSH[0];
  assert.ok(mh < 0 && mh > -5 && Math.hypot(M.reward.pin.x - m0.x, M.reward.pin.z - m0.z) < m0.r + 12, `Bryn’s mullet: ${mh.toFixed(1)} m, by the first marsh island`);
  assert.equal(S.who, 'fen');
  assert.deepEqual([S.kind, S.what], ['see', ['manx']]);
  const Fs = Q.newFavours();
  Q.accept(Fs, 'shearwaters', 3);
  assert.deepEqual(Q.saw(Fs, 'shearwater'), [], 'Cory’s, at Las Brasas, aren’t hers');
  assert.equal(Q.saw(Fs, 'manx')[0]?.id, 'shearwaters');
  // Her thanks: the tide rip off Gannet Isle's west point, in deep water off the island.
  const G = T.GANNET, sh = T.heightAt(S.reward.pin.x, S.reward.pin.z), sd = Math.hypot(S.reward.pin.x - G.x, S.reward.pin.z - G.z);
  assert.ok(sh < -3 && sh > -15 && S.reward.pin.x < G.x - G.r && sd < G.r + 40, `Fen’s tide rip: ${sh.toFixed(1)} m, ${sd.toFixed(0)} m from the island`);
});

test('the figures: drawn at their harbours, not from Willowhaven; Bryn sweeping, Fen with her binoculars, sat on her log', () => {
  const view = new FolkView(new THREE.Scene());
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  for (let h = 5; h < 7.2; h += 0.05) town.update(DAY * 24 + h, FAIR);
  view.update(1 / 30, 1, town, { from: { x: 10, z: -95 } });
  assert.ok(!view.figures.bryn.group.visible && !view.figures.fen.group.visible, 'too far from Willowhaven to see');
  // Wend Quay, first thing: Bryn sweeping, the broom out.
  for (let i = 0; i < 20; i++) view.update(1 / 30, 1 + i / 30, town, { from: { x: 530, z: -172 } });
  const b = view.figures.bryn;
  assert.ok(b.group.visible);
  assert.ok(Math.abs(b.group.position.x - F.SPOTS.quayTop.x) < 0.05);
  assert.ok(b.props?.broom?.visible, 'his broom');
  assert.ok(!view.figures.fen.group.visible, 'Gannet Isle is a long way off');
  // Gannet Isle at dawn: Fen on the clifftop with her binoculars up (a few seconds to raise them).
  let up = false;
  for (let i = 0; i < 300 && !up; i++) {
    view.update(1 / 30, 2 + i / 30, town, { from: { x: -250, z: 520 } });
    up = !!view.figures.fen.props?.glasses?.visible;
  }
  assert.ok(view.figures.fen.group.visible && up, 'counting, binoculars up');
  assert.ok(Math.abs(view.figures.fen.group.position.z - F.SPOTS.cliff.z) < 0.05);
  // Breakfast on the driftwood log: sat lower than on a chair (its own seat height).
  for (let h = 7.2; h < 8.8; h += 0.05) town.update(DAY * 24 + h, FAIR);
  for (let i = 0; i < 120; i++) view.update(1 / 30, 20 + i / 30, town, { from: { x: -250, z: 520 } });
  const f = view.figures.fen;
  assert.equal(town.people.fen.act, 'sit');
  const hips = f.group.position.y + 0.9 * f.group.scale.y - T.walkHeight(F.SPOTS.fenLog.x, F.SPOTS.fenLog.z);
  assert.ok(F.SPOTS.fenLog.seat < 0.47 && Math.abs(hips - F.SPOTS.fenLog.seat) < 0.04, `hips ${hips.toFixed(2)} m up, on the log`);
  // (Their work by where they are: Bryn sweeps the quay as Ruth sweeps her step; the count.)
  const src = readFileSync(new URL('../src/world/folk.js', import.meta.url), 'utf8');
  assert.match(src, /spot === 'innFront' \|\| spot === 'quayTop' \? 'sweep'/);
  assert.match(src, /spot === 'cliff' \|\| spot === 'headland' \? 'count'/);
  assert.match(src, /SPOTS\[p\.block\?\.spot\]\?\.seat \?\? 0\.47/);
  // And a word with them before the camp's tackle box, which is within reach of most of their camp.
  assert.match(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /if \(keeper && FOLK\[keeper\.id\]\.remote\) return \{ text: `Talk to \$\{FOLK\[keeper\.id\]\.short\}`/);
});
