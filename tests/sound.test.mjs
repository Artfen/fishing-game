// The sound's connection to the speakers (src/audio.js): a roomy buffer so a busy computer doesn't
// break the sound up, and a restart that connects it afresh (Settings → Sound, and whenever the
// speakers or headphones change), as minimising the window and bringing it back does. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// A stand-in for the browser's AudioContext: every node and setting it's asked for, and what was done.
const param = () => ({ value: 0, setValueAtTime() { return this; }, linearRampToValueAtTime() { return this; }, exponentialRampToValueAtTime() { return this; }, setTargetAtTime() { return this; }, cancelScheduledValues() { return this; }, cancelAndHoldAtTime() { return this; } });
// (Each node remembers what it's plugged into, so the tests can follow the sound's wiring.)
const node = (kind = 'node') => new Proxy({ kind, outs: [] }, {
  get: (o, k) => {
    if (k in o) return o[k];
    if (typeof k === 'symbol' || k === 'then') return undefined;
    if (k === 'connect') return (t) => { o.outs.push(t); return t; };
    if (k === 'disconnect') return () => { o.outs = []; };
    if (['start', 'stop', 'setPeriodicWave', 'setPosition', 'setOrientation'].includes(k)) return () => {};
    return (o[k] = param());
  },
  set: (o, k, v) => { o[k] = v; return true; },
});
let made = [];
class FakeContext {
  constructor(opts) {
    if (FakeContext.refuseOptions && opts) throw new TypeError('no options here');
    if (FakeContext.refuseRate && opts?.sampleRate) throw new TypeError('not that rate');
    made.push(this);
    this.nodes = [];
    this.opts = opts;
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.baseLatency = 0.04;
    this.outputLatency = 0.045;
    this.destination = node();
    this.done = [];
    this.listener = node();
    return new Proxy(this, {
      get: (o, k) => {
        if (k in o) return o[k];
        if (typeof k === 'string' && k.startsWith('create')) {
          if (k === 'createBuffer') return (ch, len, sr) => ({ numberOfChannels: ch, length: len, sampleRate: sr, getChannelData: () => new Float32Array(len) });
          if (k === 'createPeriodicWave') return () => ({});
          return () => { const n = node(k.slice(6)); o.nodes.push(n); return n; };
        }
        return undefined;
      },
    });
  }
  async suspend() { this.done.push('suspend'); this.state = 'suspended'; }
  async resume() { this.done.push('resume'); this.state = 'running'; }
}
globalThis.window ??= globalThis;
window.AudioContext = FakeContext;

const { AudioScape } = await import('../src/audio.js');

test('the sound asks for a roomy buffer, so a busy computer doesn’t break it up; a browser that won’t take the request still gets sound', () => {
  made = [];
  const A = new AudioScape();
  A.start();
  assert.equal(made.length, 1);
  assert.equal(made[0].opts?.latencyHint, 'playback');
  // At 48,000 a second whatever the sound card is set to; a browser that won't take the rate still
  // gets the roomy buffer.
  assert.equal(made[0].opts?.sampleRate, 48000);
  FakeContext.refuseRate = true;
  try {
    made = [];
    new AudioScape().start();
    assert.equal(made.length, 1);
    assert.equal(made[0].opts?.latencyHint, 'playback');
    assert.equal(made[0].opts?.sampleRate, undefined);
  } finally {
    FakeContext.refuseRate = false;
  }
  // A limiter last of all, so nothing can go past full scale and crackle.
  made = [];
  new AudioScape().start();
  const comps = made[0].nodes.filter((n) => n.kind === 'DynamicsCompressor');
  assert.equal(comps.length, 2);
  assert.ok(comps.some((c) => c.ratio.value >= 20 && c.threshold.value > -3 && c.outs.includes(made[0].destination)), 'the limiter feeds the speakers');
  FakeContext.refuseOptions = true;
  try {
    made = [];
    const B = new AudioScape();
    B.start();
    assert.equal(made.length, 1, 'made without the request');
    assert.ok(B.ctx);
  } finally {
    FakeContext.refuseOptions = false;
  }
});

test('Restart sound connects it afresh (paused, then started again, as minimising the window does), and says how it is; never starts sound that hasn’t started', async () => {
  const none = new AudioScape();
  assert.deepEqual(await none.restart(), { on: false, state: 'off', ms: 0 });
  assert.ok(!none.ctx, 'no sound started by a restart');
  made = [];
  const A = new AudioScape();
  A.start();
  const ctx = made[0];
  const st = await A.restart();
  assert.deepEqual(ctx.done, ['suspend', 'resume']);
  assert.deepEqual(st, { on: true, state: 'running', ms: 85 });
  // Paused (the window was hidden): only started again.
  ctx.done = [];
  ctx.state = 'suspended';
  await A.restart();
  assert.deepEqual(ctx.done, ['resume']);
  // A browser that won't start it yet (no click so far): no harm, and the status says so.
  ctx.state = 'suspended';
  ctx.resume = async () => { throw new Error('not allowed'); };
  const st2 = await A.restart();
  assert.equal(st2.on, false);
  assert.equal(st2.state, 'suspended');
});

test('Light sound swaps the long echo for a cheap one, with the long one taken out altogether; and back', () => {
  made = [];
  const A = new AudioScape();
  A.start();
  const conv = A.reverb;
  // Full by default: the sends go into the convolution, and it into the sound.
  assert.ok(A.verbIn.outs.includes(conv) && conv.outs.includes(A.rv));
  assert.ok(!A.verbIn.outs.includes(A.echo));
  A.setVolumes({ light: true });
  assert.ok(A.verbIn.outs.includes(A.echo), 'into the light echo');
  assert.ok(!A.verbIn.outs.includes(conv) && conv.outs.length === 0, 'the long echo out of the sound');
  A.setVolumes({ light: false });
  assert.ok(A.verbIn.outs.includes(conv) && conv.outs.includes(A.rv) && !A.verbIn.outs.includes(A.echo));
  // Chosen before the sound starts: it starts light.
  const B = new AudioScape();
  B.setVolumes({ light: true });
  B.start();
  assert.ok(B.verbIn.outs.includes(B.echo) && B.reverb.outs.length === 0);
});

test('a layer of sound that’s been silent a couple of seconds is unplugged (no work at all), and plugged back the moment it’s wanted', () => {
  made = [];
  const A = new AudioScape();
  A.start();
  assert.ok(A.beds.length > 10, `${A.beds.length} layers`);
  const fire = A.fireBed, b = A.beds.find((x) => x.g === fire.g);
  // Silent: still plugged in for a moment, then not (by the sound's clock, in seconds).
  A.parkBeds(10);
  A.parkBeds(11);
  assert.equal(b.parked, false);
  A.parkBeds(12.5);
  assert.equal(b.parked, true);
  assert.equal(b.src.outs.length, 0, 'its source unplugged');
  // Wanted (by the fire coming up): back in at once, through its own filters.
  A.set(fire.g.gain, 0.2, 0.5);
  A.parkBeds(12.52);
  assert.equal(b.parked, false);
  assert.ok(b.src.outs.includes(b.first));
  // And one that's audible is never touched.
  A.parkBeds(20);
  assert.equal(b.parked, false);
});
