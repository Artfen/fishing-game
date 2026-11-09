// The sound's connection to the speakers (src/audio.js): a roomy buffer so a busy computer doesn't
// break the sound up, and a restart that connects it afresh (Settings → Sound, and whenever the
// speakers or headphones change), as minimising the window and bringing it back does. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// A stand-in for the browser's AudioContext: every node and setting it's asked for, and what was done.
const param = () => ({ value: 0, setValueAtTime() { return this; }, linearRampToValueAtTime() { return this; }, exponentialRampToValueAtTime() { return this; }, setTargetAtTime() { return this; }, cancelScheduledValues() { return this; }, cancelAndHoldAtTime() { return this; } });
const node = () => new Proxy({}, {
  get: (o, k) => {
    if (k in o) return o[k];
    if (typeof k === 'symbol' || k === 'then') return undefined;
    if (['connect', 'disconnect', 'start', 'stop', 'setPeriodicWave', 'setPosition', 'setOrientation'].includes(k)) return () => {};
    return (o[k] = param());
  },
  set: (o, k, v) => { o[k] = v; return true; },
});
let made = [];
class FakeContext {
  constructor(opts) {
    if (FakeContext.refuseOptions && opts) throw new TypeError('no options here');
    made.push(this);
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
          return () => node();
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
