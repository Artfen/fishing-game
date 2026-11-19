// The recorded sounds (docs/SOUND.md, src/soundFiles.js, src/audio.js): every file in
// assets/sounds/ listed with where it came from, who recorded it, and a licence that lets anyone use
// it for anything (public domain or CC0); the files what the list says (mono MP3s, loops the length
// the engine loops); small; and in the game, each laid under the made sound where it belongs (the
// calm shore, the rough one, a harbour, the rain), a gull's call from a recording, and the made sound
// alone, unharmed, when the files can't be had. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const F = await import('../src/soundFiles.js');
const dir = path.join(root, F.SOUND_DIR);

// An MP3's first frame: MPEG version, layer, sample rate, channels; and from its LAME "Info"
// header, how many frames, and so how long it is.
function mp3Info(buf) {
  let i = 0;
  if (buf.toString('latin1', 0, 3) === 'ID3') i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  while (i < buf.length - 4 && !(buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0)) i++;
  const h = buf.readUInt32BE(i);
  const version = (h >> 19) & 3, layer = (h >> 17) & 3, rateIdx = (h >> 10) & 3, mode = (h >> 6) & 3;
  const rates = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000] };
  const sr = rates[version]?.[rateIdx];
  const side = version === 3 ? (mode === 3 ? 17 : 32) : (mode === 3 ? 9 : 17);
  const tag = buf.toString('latin1', i + 4 + side, i + 8 + side);
  let frames = null;
  if (tag === 'Info' || tag === 'Xing') {
    const flags = buf.readUInt32BE(i + 8 + side);
    if (flags & 1) frames = buf.readUInt32BE(i + 12 + side);
  }
  return { mpeg1: version === 3, layer3: layer === 1, sr, mono: mode === 3, frames, secs: frames ? (frames * 1152) / sr : null };
}

test('every file is listed with its source, its recordist and a licence that lets anyone use it for anything', () => {
  const ALLOWED = new Set(['pdm', 'cc0', 'usgov']);
  const onDisk = fs.readdirSync(dir).filter((f) => !f.endsWith('.md'));
  const listed = Object.values(F.SOUNDS).map((s) => s.file);
  assert.deepEqual([...onDisk].sort(), [...listed].sort(), 'the files and the list agree, nothing unlisted');
  for (const [id, s] of Object.entries(F.SOUNDS)) {
    const S = s.source;
    assert.ok(ALLOWED.has(S.licence), `${id}: public domain or CC0 (${S.licence})`);
    assert.ok(F.LICENCES[S.licence], `${id}: the licence written out`);
    assert.ok(S.title && S.by && s.what, `${id}: what it is, and who recorded it`);
    assert.match(S.page, /^https:\/\//, `${id}: its source's page`);
    assert.match(S.file, /^https:\/\//, `${id}: the file it was made from`);
  }
  // SOURCES.md beside them says the same, file by file.
  const md = fs.readFileSync(path.join(dir, 'SOURCES.md'), 'utf8');
  for (const s of Object.values(F.SOUNDS)) {
    assert.ok(md.includes(`\`${s.file}\``) && md.includes(s.source.page) && md.includes(F.LICENCES[s.source.licence]), s.file);
  }
});

test('the files are what the list says: mono MP3s, each loop the length the game loops, all of it small', () => {
  let total = 0;
  for (const [id, s] of Object.entries(F.SOUNDS)) {
    const buf = fs.readFileSync(path.join(dir, s.file));
    total += buf.length;
    const I = mp3Info(buf);
    assert.ok(I.mpeg1 && I.layer3 && I.mono && I.sr === 44100, `${id}: a mono MP3 at 44.1 kHz`);
    if (s.loop) {
      // (The loop and its padding either side; the encoder's own frame or two on top.)
      const want = s.loop + 2 * F.LOOP_PAD;
      assert.ok(Math.abs(I.secs - want) < 0.1, `${id}: ${I.secs?.toFixed(2)} s, for a ${s.loop} s loop`);
      assert.ok(s.loop >= 20 && s.loop <= 40, `${id}: long enough not to be heard repeating, short enough to keep`);
      assert.ok(buf.length < 400e3, `${id}: ${buf.length} bytes`);
    } else {
      assert.ok(I.secs < 1.2 && buf.length < 30e3, `${id}: a single call`);
    }
  }
  assert.ok(total < 2e6, `${total} bytes in all`);
  // (And the offline copy carries them: tools/build-sw.mjs.)
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  for (const s of Object.values(F.SOUNDS)) assert.ok(sw.includes(`${F.SOUND_DIR}${s.file}`), `${s.file} stored for offline play`);
});

// A stand-in for the browser's sound, enough for the recordings: nodes that remember their settings
// and wiring, buffers that "decode" to their length, and the files served from disk.
const param = () => ({ value: 0, __target: undefined, setValueAtTime() { return this; }, linearRampToValueAtTime() { return this; }, exponentialRampToValueAtTime() { return this; }, setTargetAtTime(v) { this.value = v; return this; }, cancelScheduledValues() { return this; }, cancelAndHoldAtTime() { return this; } });
const node = (kind) => new Proxy({ kind, outs: [], started: 0 }, {
  get: (o, k) => {
    if (k in o) return o[k];
    if (typeof k === 'symbol' || k === 'then') return undefined;
    if (k === 'connect') return (t) => { o.outs.push(t); return t; };
    if (k === 'disconnect') return () => { o.outs = []; };
    if (k === 'start') return () => { o.started++; };
    if (['stop', 'setPeriodicWave', 'setPosition', 'setOrientation'].includes(k)) return () => {};
    return (o[k] = param());
  },
  set: (o, k, v) => { o[k] = v; return true; },
});
class Ctx {
  constructor() {
    this.nodes = [];
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.destination = node('destination');
    this.listener = node('listener');
    return new Proxy(this, {
      get: (o, k) => {
        if (k in o) return o[k];
        if (typeof k === 'string' && k.startsWith('create')) {
          if (k === 'createBuffer') return (ch, len, sr) => ({ numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => new Float32Array(len) });
          if (k === 'createPeriodicWave') return () => ({});
          return () => { const n = node(k.slice(6)); o.nodes.push(n); return n; };
        }
        return undefined;
      },
    });
  }
  async decodeAudioData(ab) { return { duration: mp3Info(Buffer.from(ab)).secs, length: 1, numberOfChannels: 1, sampleRate: 48000 }; }
  async suspend() {}
  async resume() {}
}
globalThis.window ??= globalThis;
window.AudioContext = Ctx;
let serve = true;
globalThis.fetch = async (url) => {
  const f = path.join(root, String(url));
  if (!serve || !fs.existsSync(f)) return { ok: false, status: 404 };
  const b = fs.readFileSync(f);
  return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
};
const { AudioScape } = await import('../src/audio.js');
const at = (over = {}) => ({ speed: 0, rain: 0, day: 1, night: 0, land: 0, open: 0, cove: 0, gulls: 0, sea: 0.2, wind: 0.3, gust: 1, harbour: 0, ...over });

test('in the game: each recording under the made sound where it belongs, and silent where it doesn’t', async () => {
  serve = true;
  const A = new AudioScape();
  A.start();
  const R = await A.loadRecordings();
  assert.deepEqual(Object.keys(R.loops).sort(), [...F.LOOPS].sort(), 'every loop loaded');
  assert.equal(R.calls.length, F.GULL_CALLS.length, 'every call');
  // Looped between their padding, from somewhere in the loop.
  for (const id of F.LOOPS) {
    const src = A.beds.find((b) => b.g === R.loops[id].g).src;
    assert.equal(src.loop, true);
    assert.equal(src.loopStart, F.LOOP_PAD);
    assert.ok(Math.abs(src.loopEnd - (F.LOOP_PAD + F.SOUNDS[id].loop)) < 1e-9, id);
  }
  const level = (id) => R.loops[id].g.gain.__target ?? 0;
  const mix = (over) => { A.update(1 / 30, at(over)); return Object.fromEntries(F.LOOPS.map((id) => [id, level(id)])); };
  // Out at sea, dry, away from any harbour: none of them.
  let m = mix({ land: 0 });
  assert.deepEqual(Object.values(m).map((v) => +v.toFixed(4)), F.LOOPS.map(() => 0));
  // On a calm shore: the small waves, not the big ones.
  m = mix({ land: 1, sea: 0.2 });
  assert.ok(m.shoreCalm > 0.1 && m.shoreRough === 0, JSON.stringify(m));
  // The sea up: the strong waves, and the small ones gone.
  m = mix({ land: 1, sea: 1.5 });
  assert.ok(m.shoreRough > 0.2 && m.shoreCalm < 0.01, JSON.stringify(m));
  // In a cove, quieter.
  const cove = mix({ land: 1, sea: 1.5, cove: 1 });
  assert.ok(cove.shoreRough < m.shoreRough);
  // In a harbour; in the rain (and indoors, the rain still heard, less).
  assert.ok(mix({ harbour: 1 }).harbour > 0.1);
  const rain = mix({ rain: 1 }).rain, inside = mix({ rain: 1, indoor: 1 }).rain;
  assert.ok(rain > 0.2 && inside > 0 && inside < rain);
  // A gull: a recorded call (or two), not the made one.
  const before = A.ctx.nodes.length;
  A.gull(0.05, 0.3, 2000);
  const made = A.ctx.nodes.slice(before);
  assert.ok(made.some((n) => n.kind === 'BufferSource' && R.calls.includes(n.buffer)), 'a recorded call');
  assert.ok(!made.some((n) => n.kind === 'Oscillator'), 'not the made one');
});

test('without the files (offline before they were stored, or missing): the made sound, as it was', async () => {
  serve = false;
  const A = new AudioScape();
  A.start();
  const R = await A.loadRecordings();
  assert.deepEqual(R.loops, {});
  assert.equal(R.calls.length, 0);
  assert.doesNotThrow(() => A.update(1 / 30, at({ land: 1, sea: 1, harbour: 1, rain: 1 })));
  const before = A.ctx.nodes.length;
  A.gull(0.05, 0, 0);
  assert.ok(A.ctx.nodes.slice(before).some((n) => n.kind === 'Oscillator'), 'the made gull');
  serve = true;
});
