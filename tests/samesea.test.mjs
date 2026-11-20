// The Human Touch, H1 (docs/HUMAN-TOUCH.md): playing together, everyone as they are. Your look is
// always sent (a new game's default too), and friends are drawn in all of it (the sun hat, the
// beard, the glasses, the jumper or shirt they're wearing); your boats' looks (paint, stripe,
// tubes, flag, name, fittings) are sent by each boat's id and put on their boats, again when they
// change, on boats given back from before as well; a boat at anchor shows her rode to where her
// anchor lies, a boat tied up her lines and none. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const THREE = await import('three');
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
const T = await import('../src/together.js');
const BL = await import('../src/boatlooks.js');
const { LOOK_OPTIONS, DEFAULT_LOOK, cleanLook } = await import('../src/looks.js');
const { VisitorView } = await import('../src/world/visitors.js');
const { BOAT_KINDS } = await import('../src/boat.js');
const { PAINTS } = await import('../src/shipyard.js');
const hexOf = (id) => PAINTS.find((p) => p.id === id).hex;

test('what goes over the wire: an anchor within its reach, tied up apart from it, what you wear; your boats\' looks, checked', () => {
  const kinds = BOAT_KINDS;
  const boat = { m: 'boat', k: 'rib', x: 100, z: 200, h: 0, n: 1 };
  assert.deepEqual(T.cleanPose({ ...boat, an: [110, 230, 32, 1] }, kinds).an, [110, 230, 32, 1]);
  assert.equal(T.cleanPose({ ...boat, an: [900, 900, 32, 1] }, kinds).an, undefined, 'an anchor no rode could reach');
  assert.equal(T.cleanPose({ ...boat, an: [110, 230, 32, 7] }, kinds).an, undefined);
  const tied = T.cleanPose({ ...boat, ty: 1, an: [110, 230, 32, 1] }, kinds);
  assert.ok(tied.ty && !tied.an, 'tied up, no anchor');
  assert.equal(T.cleanPose({ m: 'foot', x: 0, z: 0, h: 0, wr: 0 }).wr, 0, 'a shirt, nothing over it');
  assert.equal(T.cleanPose({ m: 'foot', x: 0, z: 0, h: 0, wr: 5, wt: 0.5 }).wt, 0.5);
  assert.equal(T.cleanPose({ m: 'foot', x: 0, z: 0, h: 0, wr: 12 }).wr, undefined);
  const fl = T.cleanFleet([{ k: 'row', x: 0, z: 0, h: 0, an: [5, 12, 20, 1] }, { k: 'skiff', x: 50, z: 0, h: 0, ty: 1 }], kinds);
  assert.deepEqual(fl[0].an, [5, 12, 20, 1]);
  assert.ok(fl[1].ty && !fl[1].an);
  // Your boats' looks: only what's set, by id; a friend's, only what the yard has.
  const yard = { looks: { rib: { paint: 'navy', tubes: 'red', name: 'Kestrel', flag: 'alpha' }, 'rib~2': { paint: 'red' }, row: {} } };
  const mine = BL.boatLooksOf(yard, ['rib', 'rib~2', 'row'], (id) => (id === 'rib' ? ['vhf', 'nonsense'] : []));
  assert.deepEqual(mine, { rib: { p: 'navy', t: 'red', f: 'alpha', n: 'Kestrel', ft: ['vhf'] }, 'rib~2': { p: 'red' } });
  const theirs = BL.cleanBoatLooks({ ...mine, 'rib~2': { p: 'chartreuse', n: '<b>Hi</b>' }, spaceship: { p: 'navy' }, kayak: 'x' }, kinds);
  assert.deepEqual(theirs.rib, mine.rib);
  assert.deepEqual(theirs['rib~2'], { n: 'bHib' });
  assert.ok(!('spaceship' in theirs) && !('kayak' in theirs));
});

// A stand-in for the realtime channel: what's tracked and sent.
function session(look, yd) {
  const tracked = [], sent = [];
  const t = new T.Together({ config: () => ({ url: 'x', anonKey: 'y' }), name: () => 'Mags', look, boatLooks: yd, kinds: BOAT_KINDS, WS: null });
  t.status = 'hosting';
  t.rt = { open: true, track: (m) => tracked.push(m), send: (e, p) => sent.push([e, p]) };
  Object.defineProperty(t, 'active', { get: () => true });
  return { t, tracked, sent };
}

test('your look and your boats\' go with your name: always (a new game\'s default too), again only when they change', () => {
  let look = cleanLook(null), yd = {};
  const { t, tracked } = session(() => look, () => yd);
  assert.deepEqual(t.meta().look, DEFAULT_LOOK, 'a new game: the default look, as you\'re drawn');
  assert.ok(!('yd' in t.meta()), 'boats as built: nothing to send');
  t.renamed();
  t.renamed();
  assert.equal(tracked.length, 1, 'nothing changed: told once');
  yd = { rib: { p: 'navy' } };
  t.renamed();
  assert.equal(tracked.length, 2);
  assert.deepEqual(tracked[1].yd, { rib: { p: 'navy' } });
  look = cleanLook({ ...DEFAULT_LOOK, beard: 'full' });
  t.renamed();
  assert.equal(tracked[2].look.beard, 'full');
  assert.deepEqual(t.helloMsg().yd, yd);
  // Coming in: their look and their boats', checked.
  const p = t.peer('bert');
  t.named(p, 'Bert', false, { ...DEFAULT_LOOK, glasses: 'shades', coat: 'chartreuse' }, { rib: { p: 'red', n: 'Puffin' }, ufo: {} });
  assert.equal(p.look.glasses, 'shades');
  assert.equal(p.look.coat, DEFAULT_LOOK.coat);
  assert.deepEqual(p.yard, { rib: { p: 'red', n: 'Puffin' } });
});

test('a friend drawn as they made themselves: on foot and at the helm, hat, beard and glasses; their boat in her own paint and name, kept apart from another of her kind', () => {
  const scene = new THREE.Scene(), view = new VisitorView(scene);
  const look = cleanLook({ coat: LOOK_OPTIONS.coat[2], jumper: LOOK_OPTIONS.jumper[1], shirt: LOOK_OPTIONS.shirt[3], hat: 'sun', hatColor: LOOK_OPTIONS.hatColor[1], beard: 'full', glasses: 'glasses' });
  const peer = (pose, extra = {}) => new Map([['sam', { id: 'sam', name: 'Sam', look, pose, view: pose, at: { x: pose.x, z: pose.z, h: pose.h, v: 0 }, ...extra }]]);
  const play = (peers, secs = 0.1) => { for (let i = 0; i < secs * 30; i++) view.update(1 / 30, i / 30, peers, { from: { x: 0, z: 0 } }); };
  // On foot, in a jumper (coat off): their jumper's colour; a beard and glasses on their figure.
  play(peer({ m: 'foot', x: 0, z: 0, h: 0, vx: 0, vz: 0, a: 'stand', wr: 2 }));
  const f = view.drawn.get('sam').figure;
  assert.equal(`#${f.coatMat.color.getHexString()}`, look.jumper);
  let beard = 0;
  f.head.traverse((o) => { if (o.isMesh && o.geometry?.parameters?.radius === 0.105) beard++; });
  assert.ok(beard >= 1, 'a full beard');
  // In the raincoat: the coat's colour.
  play(peer({ m: 'foot', x: 0, z: 0, h: 0, vx: 0, vz: 0, a: 'stand', wr: 1 }));
  assert.equal(`#${f.coatMat.color.getHexString()}`, look.coat);
  // At the helm of their RIB, painted navy with red tubes and named; their other RIB lying red.
  const yard = { rib: { p: 'navy', t: 'red', n: 'Kestrel', f: 'alpha' }, 'rib~2': { p: 'red' } };
  const afloat = peer({ m: 'boat', k: 'rib', x: 150, z: 330, h: 0, vx: 0, vz: 0 }, { yard, fleet: [{ k: 'rib', i: 'rib~2', x: 170, z: 330, h: 1 }] });
  play(afloat);
  const d = view.drawn.get('sam'), rib = d.boats.rib, rib2 = d.moored['rib~2'];
  assert.equal(`#${rib.paintNow.getHexString()}`, hexOf('navy'));
  assert.equal(rib.boatName, 'Kestrel');
  assert.equal(rib.flagId, 'alpha');
  assert.equal(`#${rib2.paintNow.getHexString()}`, hexOf('red'), 'the other RIB: her own paint');
  // The skipper wears their hat, beard and glasses (dressFigure's parts on her figure).
  assert.ok(rib.lookParts?.length >= 2, 'beard and glasses at the helm');
  // A repaint while you watch: seen at once, without them rejoining.
  play(peer({ m: 'boat', k: 'rib', x: 150, z: 330, h: 0, vx: 0, vz: 0 }, { yard: { ...yard, rib: { ...yard.rib, p: 'green', n: 'Wren' } } }));
  assert.equal(`#${rib.paintNow.getHexString()}`, hexOf('green'));
  assert.equal(rib.boatName, 'Wren');
  // Gone and back (their game reloaded): the same boats given back, dressed as they are now.
  play(new Map());
  play(peer({ m: 'boat', k: 'rib', x: 150, z: 330, h: 0, vx: 0, vz: 0 }, { yard: { rib: { p: 'teal' } } }));
  assert.equal(view.drawn.get('sam').boats.rib, rib);
  assert.equal(`#${rib.paintNow.getHexString()}`, hexOf('teal'));
  assert.equal(rib.boatName, '');
});

test('a friend\'s boat at anchor shows her rode from her bow down to her anchor; hauling it; none tied up or far off; and her other boats left at anchor', () => {
  const scene = new THREE.Scene(), view = new VisitorView(scene);
  const peer = (pose, fleet = []) => new Map([['sam', { id: 'sam', name: 'Sam', look: DEFAULT_LOOK, pose, view: pose, at: { x: pose.x, z: pose.z, h: pose.h, v: 0 }, fleet }]]);
  const play = (peers, from = { x: 150, z: 330 }) => { for (let i = 0; i < 4; i++) view.update(1 / 30, i / 30, peers, { from }); };
  const at = { m: 'boat', k: 'skiff', x: 150, z: 330, h: 0, vx: 0, vz: 0, n: 1 };
  play(peer({ ...at, an: [150, 352, 25, 1] }));
  const b = view.drawn.get('sam').boats.skiff;
  assert.ok(b.anchored && b.anchor && b.rode.mesh.visible && b.anchorOut.visible, 'her rode and anchor out');
  assert.ok(!b.anchorStowed.visible, 'not on her foredeck');
  // The rode runs from her bow to the anchor.
  const m = new THREE.Matrix4(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  b.rode.mesh.getMatrixAt(0, m);
  p0.setFromMatrixPosition(m);
  b.rode.mesh.getMatrixAt(b.rode.n - 1, m);
  p1.setFromMatrixPosition(m);
  const ends = [p0, p1].map((p) => Math.hypot(p.x - 150, p.z - 352)).sort((a, c) => a - c);
  assert.ok(ends[0] < 4 && ends[1] > 15, `ends ${ends.map((e) => e.toFixed(1))}`);
  // Hauling it in: still drawn, shorter; up: stowed again.
  play(peer({ ...at, an: [150, 352, 10, 2] }));
  assert.equal(b.anchor.phase, 'haul');
  assert.ok(b.rode.mesh.visible);
  play(peer({ ...at, n: 0 }));
  assert.ok(!b.anchor && !b.rode.mesh.visible && b.anchorStowed.visible);
  // Tied up: no rode (her lines, if there's a pier to make fast to).
  play(peer({ ...at, ty: 1, an: [150, 352, 25, 1] }));
  assert.ok(!b.anchor && !b.rode.mesh.visible);
  // Too far off to make out: not drawn.
  play(peer({ ...at, an: [150, 352, 25, 1] }), { x: 150, z: 1200 });
  assert.ok(!b.rode.mesh.visible);
  // A boat of theirs left at anchor while they're ashore: her rode too.
  play(peer({ m: 'foot', x: 140, z: 320, h: 0, vx: 0, vz: 0, a: 'stand' }, [{ k: 'row', x: 160, z: 330, h: 0, an: [160, 350, 22, 1] }]));
  const row = view.drawn.get('sam').moored.row;
  assert.ok(row.anchored && row.rode.mesh.visible);
});
