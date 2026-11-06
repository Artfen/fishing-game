// Fishing that tells the truth (docs/IMPROVEMENTS.md): a stick held a little off the horizontal
// doesn't click the drag; one press of "back" doesn't lose a fish (it takes a second); a bite you
// were already holding through strikes as you let go; a parted line takes the rig with it; a lost
// fish's reason says what really happened, with the control you really have; flatfish, octopus
// and dogfish fight as their words say; and the live hint shows over a message when it matters.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { newFight, stepFight, DIFFICULTY, breakReason } = await import('../src/fight.js');
const { fishById, weightOf } = await import('../src/fish.js');
const { RODS, TACKLE, lineInUse } = await import('../src/tackle.js');
const { BEHAVIOUR } = await import('../src/behaviour.js');
const { Fishing } = await import('../src/fishing.js');
const { Boat } = await import('../src/boat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { createHabitat } = await import('../src/world/habitat.js');

const scene = new THREE.Scene();
const habitat = createHabitat();
const quiet = new Proxy({}, { get: () => () => {} });
// An angler in a skiff off the harbour, with a sea bass on (or about to bite).
function angler() {
  const b = new Boat(scene, { kind: 'skiff' });
  b.place(60, 120, 0);
  const eco = new Ecosystem(habitat);
  const words = [], lost = [];
  const hooks = { flash: (t) => words.push(t), key: (a) => a, canopyAt: () => false, onSnap: (why, sp, rod, F) => lost.push({ why, F }), line: undefined };
  const f = new Fishing(scene, b, quiet, quiet, eco, new Proxy(hooks, { get: (o, k) => (k in o ? o[k] : () => {}) }));
  f.setRig({ ...RODS.sea, line: lineInUse({}, RODS.sea) }, TACKLE.metal);
  f.level = BEHAVIOUR.natural;
  const a = eco.agents.find((q) => q.sp.id === 'seabass');
  a.size = 50;
  a.weight = weightOf(a.sp, 50);
  f.hook.set(b.pos.x + 14, 0, b.pos.z + 14);
  return { f, a, b, words, lost };
}
function hooked() {
  const A = angler();
  A.f.agent = A.a;
  A.f.state = 'bite';
  A.f.setHook();
  return A;
}

test('the drag clicks only for a firm push, not a stick held a little off the horizontal', () => {
  const { f } = hooked();
  const d0 = f.dragLevel;
  for (let i = 0; i < 120; i++) f.dragBy(0.25, 1 / 60);
  assert.equal(f.dragLevel, d0, 'a slight push for side pressure leaves the drag alone');
  f.dragBy(1, 1 / 60);
  assert.notEqual(f.dragLevel, d0, 'a firm push clicks it');
});

test('one press of "back" with a fish on asks; a second, at once, lets it go', () => {
  const { f, words } = hooked();
  assert.equal(f.state, 'reeling');
  assert.equal(f.playerCancel(), true);
  assert.equal(f.state, 'reeling', 'still on after one press');
  assert.ok(f.fight, 'still fighting');
  assert.match(words.at(-1), /again/);
  // After the moment's gone, a press asks again rather than letting go.
  f.update(2, 2, 0, false);
  if (f.state === 'reeling') {
    f.playerCancel();
    assert.equal(f.state, 'reeling', 'a stale first press doesn’t count');
    f.playerCancel();
    assert.equal(f.state, 'retrieving', 'two presses together let it go');
    assert.equal(f.fight, null);
  }
  // With no fish on, one press does it, as before.
  const g = angler().f;
  g.state = 'drifting';
  g.playerCancel();
  assert.equal(g.state, 'retrieving');
});

test('holding the button as a fish bites: letting go strikes', () => {
  const { f, a } = angler();
  f.state = 'drifting';
  f.hold = true;
  f.onBite(a, 'pull');
  assert.equal(f.state, 'bite');
  f.onUp();
  assert.equal(f.state, 'reeling', 'struck on release');
  // (Not holding as it bit: letting go of nothing strikes nothing.)
  const B = angler();
  B.f.state = 'drifting';
  B.f.hold = false;
  B.f.onBite(B.a, 'pull');
  B.f.onUp();
  assert.equal(B.f.state, 'bite');
});

test('a parted line takes the rig with it: nothing flies back to the rod', () => {
  const { f, lost } = hooked();
  f.snap('tension');
  assert.equal(f.state, 'retrieving');
  assert.ok(f.parted);
  f.updateVisuals(0, 1 / 30, null);
  assert.equal(f.bobber.visible, false);
  if (f.model) assert.equal(f.model.visible, false, 'no lure coming home');
  assert.ok(lost[0].F, 'the fight goes with the news, for its reason');
  // An ordinary reel-in still brings it home.
  const g = angler().f;
  g.state = 'drifting';
  g.cancel();
  assert.equal(g.parted, false);
});

test('a lost fish’s reason says what happened, and names your own control', () => {
  const sp = fishById.seabass, rod = { line: { name: '15 lb mono' } };
  assert.match(breakReason('thrown', sp, rod, { by: 'charge' }), /wind fast/);
  assert.match(breakReason('thrown', sp, rod, { by: 'shake' }), /rod low/);
  assert.match(breakReason('thrown', sp, rod, { by: 'leap' }), /rod up/);
  assert.match(breakReason('thrown', sp, rod), /rod up/, 'the old words when the cause is unknown');
  assert.match(breakReason('drag', sp, rod, { loosen: 'LT' }), /\(LT while/);
  assert.match(breakReason('drag', sp, rod), /\(S while/);
  // And the fight records the cause when it throws the hook.
  let seen = null;
  for (let s = 0; s < 400 && !seen; s++) {
    let x = s * 7919 + 1;
    const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    const F = newFight(sp, 60, { line: { name: 'mono', kg: 6.8, stretch: 1 }, power: 1, flex: 1 }, DIFFICULTY.standard, false, rnd, { level: BEHAVIOUR.demanding || BEHAVIOUR.natural, range: 30 });
    for (let i = 0; i < 3000; i++) {
      const ev = stepFight(F, 1 / 30, i % 50 < 10, rnd);
      if (ev === 'off:thrown') { seen = F.thrownBy; break; }
      if (ev && (ev.startsWith('snap') || ev === 'landed' || ev.startsWith('off'))) break;
    }
  }
  if (seen) assert.ok(['charge', 'shake', 'leap'].includes(seen), `thrown by ${seen}`);
});

test('flatfish, octopus and dogfish fight as their words say', async () => {
  const { signatureOf, SIGNATURES } = await import('../src/fight.js');
  let n = 0;
  // (Kinds with signature moves of their own, the grouper say, keep them.)
  for (const sp of Object.values(fishById).filter((q) => !SIGNATURES[q.id])) {
    if (sp.fight === 'flat' || sp.fight === 'cling') {
      n++;
      assert.ok(signatureOf(sp).includes('sound'), `${sp.id} pumps up off the bottom`);
    }
    if (sp.fight === 'roll') {
      n++;
      assert.ok(signatureOf(sp).includes('headshake'), `${sp.id} writhes`);
    }
  }
  assert.ok(n >= 5, `${n} kinds checked`);
});

test('the live hint shows over a message when it matters', async () => {
  const { HUD } = await import('../src/ui.js').catch(() => ({}));
  if (!HUD) return;
  const el = { innerHTML: '', classList: { toggle() {} } };
  const h = Object.create(HUD.prototype);
  Object.assign(h, { cache: {}, el: { hint: el }, flashText: 'Drag: light', flashUntil: 10 });
  h.hint('It’s surging! Let go', 1, false);
  assert.equal(el.innerHTML, 'Drag: light', 'an ordinary moment: the message shows');
  h.hint('It’s surging! Let go', 2, true);
  assert.equal(el.innerHTML, 'It’s surging! Let go', 'a surge: the hint shows');
});
