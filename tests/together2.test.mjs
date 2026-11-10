// Playing together, out on the water as a crew (src/together.js, src/crew.js, src/world/visitors.js,
// src/camera.js, src/input.js, src/harbourView.js): friends diving see each other in the water,
// swimming in their own kit, as deep as they are; each crew stepping aboard a friend's boat
// finds a place of their own in her; looking about under water leaves the way you swim alone;
// and the fish one of you sells pays everyone in the session the same (if the seller chooses),
// checked, capped and never a flood. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Together, cleanPose, cleanPaid, PAID_MAX, PAID_TEN } = await import('../src/together.js');
const { HULLS } = await import('../src/boat.js');
const { Crew, crewSpots, freeSpot, CREW_ROOM } = await import('../src/crew.js');
const { VisitorView } = await import('../src/world/visitors.js');
const { Diver } = await import('../src/diver.js');
const { CameraRig } = await import('../src/camera.js');
const { cleanSettings } = await import('../src/settings.js');
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
const clock = { t: 100 };
function player(hub, name, extra = {}) {
  const T = new Together({ config: () => CFG, name: () => name, kinds: ['row', 'skiff', 'console'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const update = T.update.bind(T);
  T.update = (dt, me) => {
    clock.t += dt;
    update(dt, me);
  };
  T.events = [];
  T.onEvent = (kind, p, data) => T.events.push([kind, p?.name ?? null, data ?? null]);
  return T;
}

/* ---------- diving together ---------- */

test('a friend diving: how deep, head up or down, kicking, and their kit go across, checked', async () => {
  const P = cleanPose({ m: 'dive', x: 5, z: 6, h: 1, y: -7.25, pt: -0.4, kt: 's', kk: 1 });
  assert.deepEqual([P.y, P.pt, P.kt, P.kk], [-7.25, -0.4, 's', true]);
  // Junk: thrown out or held to what a diver could be doing.
  const J = cleanPose({ m: 'dive', x: 5, z: 6, h: 1, y: -1e9, pt: 'up', kt: '<scuba>', kk: 0 });
  assert.deepEqual([J.y, J.pt, J.kt, J.kk], [-150, 0, 'f', false]);
  assert.equal(cleanPose({ m: 'dive', x: 5, z: 6, h: 1, y: NaN }).y, 0);
  // (Only a diver has a depth.)
  assert.equal(cleanPose({ m: 'foot', x: 5, z: 6, h: 1, y: -7 }).y, undefined);

  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '3131' }), b = player(hub, 'Bert');
  await a.host();
  await b.join('3131');
  await until(() => a.others.length === 1 && b.others.length === 1);
  const dive = (y, pt = 0) => ({ m: 'dive', x: 40, z: 50, h: 0.5, y, pt, kt: 's', kk: true });
  a.update(0.3, dive(-4));
  b.update(0.3, { m: 'foot', x: 0, z: 0, h: 0, a: 'stand' });
  await until(() => b.others[0].pose?.m === 'dive');
  assert.deepEqual([b.others[0].pose.y, b.others[0].pose.kt, b.others[0].pose.kk], [-4, 's', true]);
  // Going straight down, not along: still news (not held back as keeping still).
  a.update(0.3, dive(-6.5, -1.2));
  await until(() => b.others[0].pose.y === -6.5);
  assert.equal(b.others[0].pose.pt, -1.2);
  a.leave();
  b.leave();
});

test('a friend diving is drawn: a diver in their kit, as deep as they are, swimming; gone when they’re out, far off or have left', () => {
  const scene = new THREE.Scene(), view = new VisitorView(scene);
  const peers = (pose, x = pose.x) => new Map([['sam', { id: 'sam', name: 'Sam', pose, view: pose, at: { x, z: pose.z, h: pose.h, v: 0.8 } }]]);
  const play = (pose, secs, x) => {
    const P = peers(pose, x);
    for (let i = 0; i < secs * 30; i++) view.update(1 / 30, i / 30, P, { from: { x: 0, z: 0 } });
  };
  const scuba = { m: 'dive', x: 10, z: 12, h: 0.3, vx: 0, vz: 0, y: -8, pt: -0.5, kt: 's', kk: true };
  play(scuba, 2);
  const d = view.drawn.get('sam'), D = d.diver;
  assert.ok(D && D.group.visible, 'drawn');
  assert.ok(Math.abs(D.pos.y + 8) < 0.05 && D.pos.x === 10, `at ${D.pos.y.toFixed(2)} m`);
  assert.ok(Math.abs(D.bodyPitch + 0.5) < 0.05, 'head down as they swim down');
  assert.equal(D.kit, 'scuba');
  assert.ok(D.tank.visible && !D.gun.visible, 'their tank on, no gun');
  // The stripe on their suit: their own colour, the same as their coat ashore.
  assert.equal(`#${D.panelMat.color.getHexString()}`, d.look.coat.toLowerCase());
  const ph = D.phase;
  play(scuba, 0.5);
  assert.ok(D.phase > ph, 'kicking');
  // Spearfishing: breath-hold kit and their speargun.
  play({ ...scuba, kt: 'f' }, 0.2);
  assert.equal(D.kit, 'free');
  assert.ok(D.gun.visible && !D.tank.visible);
  // A name over them, under the water with them.
  assert.ok(Math.abs(view.diverAt('sam').y - D.pos.y) < 1e-9);
  // Far off (you can't see far under water): not drawn.
  play({ ...scuba, x: 400 }, 0.1, 400);
  assert.equal(D.group.visible, false);
  assert.equal(view.diverAt('sam'), null);
  // Out of the water: the diver's gone, and they're on foot.
  play(scuba, 0.1);
  assert.equal(D.group.visible, true);
  play({ m: 'foot', x: 10, z: 12, h: 0, vx: 0, vz: 0, a: 'stand' }, 0.1);
  assert.equal(D.group.visible, false);
  // Left the session: their diver taken out of the scene.
  view.update(1 / 30, 0, new Map(), { from: { x: 0, z: 0 } });
  assert.ok(!scene.children.includes(D.group));
});

/* ---------- looking about under water ---------- */

test('under water, holding to look about turns the view, not the way you swim; let go and it swings back behind you', async () => {
  const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 2000);
  const rig = new CameraRig(cam);
  const { Boat } = await import('../src/boat.js');
  const scene = new THREE.Scene();
  const boat = new Boat(scene, { kind: 'rib' });
  boat.place(30, 40, 0);
  const diver = new Diver(scene);
  diver.enter('scuba', 30, -5, 40, 0);
  const fishing = { busy: false, lineOut: false, state: 'idle', bob: new THREE.Vector3() };
  rig.init(boat);
  rig.setDive(diver, false, 0);
  let t = 0;
  const step = (secs) => {
    for (let i = 0; i < secs * 60; i++) {
      t += 1 / 60;
      rig.update(1 / 60, t, { boat, walker: null, started: true, fishing, baitFocus: null });
    }
  };
  step(1.5);
  assert.equal(rig.mode, 'dive');
  const v = rig.views.dive, yaw0 = v.yaw, pitch0 = v.pitch;
  rig.holdLook(true);
  assert.ok(rig.looking, 'looking about');
  rig.input({ x: 400, y: 120 }, 0, t);
  step(0.2);
  assert.ok(Math.abs(v.yaw - yaw0) > 1, 'the view turned');
  // (Turning while you look about turns the way you'll swim with it.)
  const a = rig.turn(1, 0.25, t);
  assert.ok(a > 0 && Math.abs(rig.looking.yaw - (yaw0 + a)) < 1e-9);
  rig.holdLook(false);
  assert.ok(!rig.looking && rig.lookBack, 'swinging back');
  step(1.5);
  assert.ok(Math.abs(v.yaw - (yaw0 + a)) < 0.01 && Math.abs(v.pitch - pitch0) < 0.01, `back behind you: ${v.yaw.toFixed(3)} / ${(yaw0 + a).toFixed(3)}`);
  assert.equal(rig.lookBack, null);
  // Out of the water: nothing held over.
  rig.holdLook(true);
  rig.setDive(null, false, t);
  step(0.5);
  assert.equal(rig.looking, null);
});

test('the right mouse button still cancels; under water, held, it drags the view and says it’s held', async () => {
  const listeners = {}, on = (k, f) => { (listeners[k] ??= []).push(f); };
  globalThis.matchMedia ??= () => ({ matches: false });
  globalThis.addEventListener ??= () => {};
  globalThis.navigator ??= {};
  const canvas = { addEventListener: on, setPointerCapture() {}, classList: { add() {}, remove() {} } };
  const { Input } = await import('../src/input.js');
  const I = new Input(canvas);
  let cancels = 0;
  I.on('cancel', () => cancels++);
  const fire = (k, e) => { for (const f of listeners[k] || []) f({ pointerType: 'mouse', pointerId: 1, preventDefault() {}, ...e }); };
  // On the boat: a cancel, and no drag.
  fire('pointerdown', { button: 2, clientX: 100, clientY: 100 });
  fire('pointermove', { clientX: 160, clientY: 100 });
  fire('pointerup', {});
  assert.equal(cancels, 1);
  assert.deepEqual(I.takeDrag(), { x: 0, y: 0 });
  assert.equal(I.lookHeld, false);
  // Under water: a cancel (harmless there), held, and it drags.
  I.rightLooks = true;
  fire('pointerdown', { button: 2, clientX: 100, clientY: 100 });
  assert.equal(I.lookHeld, true);
  fire('pointermove', { clientX: 160, clientY: 90 });
  assert.deepEqual(I.takeDrag(), { x: 60, y: -10 });
  fire('pointerup', {});
  assert.equal(I.lookHeld, false);
  assert.equal(cancels, 2);
  // (The window losing focus lets go of it too.)
  fire('pointerdown', { button: 2, clientX: 0, clientY: 0 });
  I.releaseAll();
  assert.equal(I.lookHeld, false);
});

/* ---------- several aboard ---------- */

test('several crew stepping aboard each find a place of their own in her, clear of the skipper at the helm and each other', () => {
  for (const [kind, H] of Object.entries(HULLS)) {
    const xs = Math.max(0.05, H.B - 0.35) + 1e-9, zs = Math.max(0.2, H.L / 2 - 0.5) + 1e-9;
    for (const s of crewSpots(H)) assert.ok(Math.abs(s.x) <= xs && Math.abs(s.z) <= zs, `${kind}: inside her`);
    // Friends stepping aboard one after another, as many as she has room for (one in a dinghy, two
    // in a bass boat, three in anything bigger): each clear of the helm and the others.
    const T = { clock: 0, id: 'x', peers: new Map(), crewWord: () => true };
    const taken = [{ x: 0, z: H.seatZ ?? 0 }];
    for (let i = 0; i < (H.L >= 6 ? 3 : H.L >= 4.5 ? 2 : 1); i++) {
      const C = new Crew({ together: T });
      C.board('skipper', H, taken);
      const near = Math.min(...taken.map((o) => Math.hypot(o.x - C.on.x, o.z - C.on.z)));
      assert.ok(near >= CREW_ROOM - 1e-9, `${kind}: crew ${i + 1} ${near.toFixed(2)} m from the nearest`);
      taken.push({ x: C.on.x, z: C.on.z });
    }
  }
  // The first aboard stands where crew always have; a crowded boat still finds the roomiest place.
  const H = HULLS.console;
  assert.deepEqual(freeSpot(H, [{ x: 0, z: H.seatZ ?? 0 }]), crewSpots(H)[0]);
  const all = crewSpots(H);
  const s = freeSpot(H, all);
  assert.ok(all.some((o) => o.x === s.x && o.z === s.z));
});

/* ---------- a fish sold, everyone paid ---------- */

test('a fish sold pays friends the same: checked, capped, and never a flood', async () => {
  assert.deepEqual(cleanPaid({ a: 12.345, w: 'kaigan', n: 2 }), { a: 12.35, w: 'kaigan', n: 2 });
  assert.equal(cleanPaid({ a: 12, w: 'bank' }), null);
  assert.equal(cleanPaid({ a: -5, w: 'market' }), null);
  assert.equal(cleanPaid({ a: '50', w: 'market' }), null);
  assert.equal(cleanPaid({ a: 1e9, w: 'market' }).a, PAID_MAX, 'held to the most one word can carry');
  assert.equal(cleanPaid({ a: 5, w: 'market', n: 1e6 }).n, 1);

  const hub = new Hub();
  const a = player(hub, 'Mags', { newCode: () => '5150' }), b = player(hub, 'Bert'), c = player(hub, 'Cass');
  // On your own: nobody to pay.
  await a.host();
  assert.equal(a.paid(10, 'market', 1), false);
  await b.join('5150');
  await c.join('5150');
  await until(() => a.others.length === 2 && b.others.length === 2 && c.others.length === 2);
  assert.equal(a.paid(24.6, 'kaigan', 3), true);
  await until(() => b.events.some((e) => e[0] === 'paid') && c.events.some((e) => e[0] === 'paid'));
  assert.deepEqual(b.events.find((e) => e[0] === 'paid'), ['paid', 'Mags', { a: 24.6, w: 'kaigan', n: 3 }]);
  assert.ok(!a.events.some((e) => e[0] === 'paid'), 'not paid for your own fish twice');
  // A flood from one friend: only so many a minute are sent, or heard.
  let sent = 1;
  for (let i = 0; i < 20; i++) if (a.paid(1, 'market')) sent++;
  assert.equal(sent, 8);
  const rt = c.rt;
  for (let i = 0; i < 20; i++) rt.send('paid', { id: c.id, a: 1, w: 'market', n: 1 });
  await wait(80);
  const fromCass = b.events.filter((e) => e[0] === 'paid' && e[1] === 'Cass').length;
  assert.equal(fromCass, 8);
  // And only so much in ten minutes from anyone: past that it's clipped, then nothing.
  for (let k = 0; k < 6; k++) {
    for (const T of [a, b, c]) T.update(61, { m: 'foot', x: 0, z: 0, h: 0, a: 'stand' });
    for (let i = 0; i < 2; i++) rt.send('paid', { id: c.id, a: PAID_MAX, w: 'market', n: 9 });
    await wait(40);
  }
  const total = b.events.filter((e) => e[0] === 'paid' && e[1] === 'Cass').reduce((s, e) => s + e[2].a, 0);
  assert.ok(total <= PAID_TEN + 1e-6 && total > PAID_TEN - 1, `£${total} in ten minutes`);
  a.leave();
  b.leave();
  c.leave();
});

test('Settings: friends paid for the fish you sell, unless you keep it to yourself; the harbour says what was sold, and where', async () => {
  assert.equal(cleanSettings({}).player.paid, true);
  assert.equal(cleanSettings({ player: { paid: false } }).player.paid, false);
  assert.equal(cleanSettings({ player: { paid: 'no' } }).player.paid, true);

  // The harbour's sheet tells the game each sale (what it fetched, and where) for friends to be paid.
  const byId = new Map();
  class El {
    constructor(tag) { Object.assign(this, { tag, children: [], className: '', textContent: '', hidden: false, disabled: false, listeners: {} }); }
    addEventListener(k, f) { (this.listeners[k] ??= []).push(f); }
    append(...c) { this.children.push(...c); }
    replaceChildren(...c) { this.children = c; }
    click() { for (const f of this.listeners.click || []) f({ stopPropagation() {}, target: this }); }
    getContext() { return ctx2d; }
  }
  const was = globalThis.document;
  globalThis.document = { createElement: (t) => new El(t), getElementById: (id) => (byId.has(id) ? byId.get(id) : byId.set(id, new El('div')).get(id)), fonts: null };
  try {
    const { HarbourSheet } = await import('../src/harbourView.js');
    const now = 10 * 24 + 14;
    const state = { day: 10, hour: 14, money: 0, keep: [{ id: 'seabass', size: 60, logId: 'a', at: now - 1 }, { id: 'mackerel', size: 34, logId: 'b', at: now - 1 }], harbour: null, fish: {}, shop: null };
    const shared = [];
    const sheet = new HarbourSheet(state, { toast() {}, chime() {}, changed() {}, close: () => sheet.close(), now: () => now, sold() {}, shared: (v, w) => shared.push([v, w]) });
    sheet.open('market');
    sheet.sell(0);
    sheet.close();
    sheet.open('kaigan');
    sheet.sellKaigan(0);
    assert.deepEqual(shared.map((s) => s[1]), ['market', 'kaigan']);
    assert.ok(shared.every((s) => s[0] > 0));
    assert.equal(Math.round(shared.reduce((s, x) => s + x[0], 0) * 100) / 100, state.money, 'what you were paid, no more');
  } finally {
    globalThis.document = was;
  }
});
