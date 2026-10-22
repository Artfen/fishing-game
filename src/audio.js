import { rand, clamp } from './util.js';

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
// D major pentatonic, the gentlest scale there is.
const MELODY = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86];
const CHORDS = [[50, 57, 62], [47, 54, 62], [43, 50, 59], [45, 52, 61]];

// Everything you hear is synthesised: filtered noise for water, wind and rain,
// tiny oscillator gestures for birds, and a slow generative pentatonic tune.
export class AudioScape {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.t = 0;
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const now = ctx.currentTime;

    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, now);
    this.out.gain.exponentialRampToValueAtTime(1, now + 4);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    this.out.connect(comp);
    comp.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.4, 2.4);
    const rv = ctx.createGain();
    rv.gain.value = 0.55;
    this.reverb.connect(rv);
    rv.connect(this.out);

    this.sfx = ctx.createGain();
    this.sfx.connect(this.out);
    const sfxSend = ctx.createGain();
    sfxSend.gain.value = 0.15;
    this.sfx.connect(sfxSend);
    sfxSend.connect(this.reverb);

    this.music = ctx.createGain();
    this.music.gain.value = 0;
    this.music.connect(this.out);
    const musicSend = ctx.createGain();
    musicSend.gain.value = 0.8;
    this.music.connect(musicSend);
    musicSend.connect(this.reverb);

    this.white = this.noise(3, 'white');
    this.brown = this.noise(5, 'brown');
    this.pink = this.noise(4, 'pink');

    this.waterBed = this.bed(this.brown, [['lowpass', 380, 0.6]]);
    this.surfBed = this.bed(this.pink, [['bandpass', 520, 0.5]]);
    this.windBed = this.bed(this.pink, [['bandpass', 700, 0.8]]);
    this.rainBed = this.bed(this.white, [['highpass', 1100, 0.5], ['lowpass', 7500, 0.5]]);
    this.rainLow = this.bed(this.brown, [['lowpass', 900, 0.5]]);

    this.next = { lap: 1, bird: 3, gull: 8, cricket: 2, owl: 25, note: 5, chord: 1, drop: 0 };
    this.lastNote = 5;
    this.chordIdx = 0;
  }

  get ready() { return !!this.ctx; }

  // Go quiet while the tab is hidden, and pick up again when it returns.
  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  noise(sec, type) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else if (type === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
      } else d[i] = w;
    }
    return buf;
  }

  impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  bed(buffer, filters) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    let node = src;
    const f = [];
    for (const [type, freq, q] of filters) {
      const bq = ctx.createBiquadFilter();
      bq.type = type;
      bq.frequency.value = freq;
      bq.Q.value = q;
      node.connect(bq);
      node = bq;
      f.push(bq);
    }
    const g = ctx.createGain();
    g.gain.value = 0;
    node.connect(g);
    g.connect(this.out);
    src.start(0, Math.random() * buffer.duration);
    return { g, f };
  }

  set(param, v, tc = 0.5) {
    param.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  envelope(g, t0, gain, attack, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  burst({ buf = this.white, dur = 0.3, type = 'bandpass', freq = 1000, freqEnd, q = 1, gain = 0.2, attack = 0.01, pan = 0, when = 0, dest = this.sfx }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    this.envelope(g, t0, gain, attack, dur);
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    src.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(dest);
    src.start(t0, Math.random() * Math.max(0, buf.duration - dur - 0.1));
    src.stop(t0 + dur + 0.05);
  }

  tone({ freq = 440, freqEnd, type = 'sine', dur = 0.3, gain = 0.1, attack = 0.005, pan = 0, when = 0, dest = this.sfx, filter, vib = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    if (vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 7;
      lg.gain.value = vib;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    const g = ctx.createGain();
    this.envelope(g, t0, gain, attack, dur);
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter[0];
      f.frequency.value = filter[1];
      f.Q.value = filter[2];
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(p);
    p.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /* ---------- nature ---------- */

  lap(vol, pan) {
    this.burst({ buf: this.brown, type: 'lowpass', freq: rand(350, 600), q: 0.8, dur: rand(0.5, 0.9), gain: vol, attack: rand(0.1, 0.2), pan });
    this.burst({ buf: this.pink, type: 'bandpass', freq: rand(600, 900), q: 1.2, dur: 0.4, gain: vol * 0.25, attack: 0.08, pan, when: 0.1 });
  }

  bird(vol, pan) {
    const base = rand(2200, 3600);
    const n = 2 + Math.floor(rand(0, 5));
    const up = Math.random() < 0.5;
    let t = 0;
    for (let i = 0; i < n; i++) {
      const f = base * rand(0.85, 1.2);
      this.tone({ freq: f, freqEnd: f * (up ? rand(1.2, 1.5) : rand(0.6, 0.8)), dur: rand(0.06, 0.14), gain: vol * rand(0.6, 1), attack: 0.01, pan, when: t });
      t += rand(0.08, 0.2);
    }
  }

  gull(vol, pan) {
    let t = 0;
    const n = 2 + Math.floor(rand(0, 3));
    for (let i = 0; i < n; i++) {
      this.tone({ type: 'sawtooth', freq: rand(1050, 1250), freqEnd: rand(700, 820), dur: rand(0.28, 0.42), gain: vol, attack: 0.03, pan, when: t, filter: ['bandpass', 1500, 2.5] });
      t += rand(0.35, 0.5);
    }
  }

  cricket(vol, pan) {
    const f = rand(4200, 4800);
    for (let k = 0; k < 3; k++) this.tone({ freq: f, dur: 0.03, gain: vol, attack: 0.004, pan, when: k * 0.055 });
  }

  owl(vol, pan) {
    this.tone({ freq: 400, freqEnd: 370, dur: 0.5, gain: vol, attack: 0.09, pan });
    this.tone({ freq: 390, freqEnd: 355, dur: 0.7, gain: vol * 0.9, attack: 0.1, pan, when: 0.7 });
  }

  drop(vol) {
    this.tone({ freq: rand(1800, 3800), freqEnd: rand(900, 1500), dur: 0.035, gain: vol, attack: 0.001, pan: rand(-0.6, 0.6) });
  }

  /* ---------- boat & fishing ---------- */

  oar(pan = 0, vol = 1) {
    this.burst({ buf: this.white, type: 'bandpass', freq: 1100, freqEnd: 500, q: 0.7, dur: 0.32, gain: 0.06 * vol, attack: 0.02, pan });
    this.burst({ buf: this.brown, type: 'lowpass', freq: 500, q: 0.5, dur: 0.5, gain: 0.16 * vol, attack: 0.04, pan });
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: rand(1500, 2600), freqEnd: rand(2600, 3400), dur: 0.05, gain: 0.012 * vol, when: 0.35 + i * rand(0.08, 0.2), pan });
    }
  }

  knock(vol = 1) {
    this.tone({ freq: 160, freqEnd: 90, dur: 0.22, gain: 0.22 * vol, attack: 0.003 });
    this.burst({ buf: this.brown, type: 'lowpass', freq: 400, dur: 0.14, gain: 0.15 * vol, attack: 0.003 });
  }

  cast() {
    this.burst({ type: 'bandpass', freq: 2400, freqEnd: 500, q: 1.2, dur: 0.42, gain: 0.07, attack: 0.06 });
    this.tickRun(10, 0.03, 0.025);
  }

  plop(scale = 1) {
    this.tone({ freq: 600 / scale, freqEnd: 150 / scale, dur: 0.16, gain: 0.16, attack: 0.004 });
    this.burst({ buf: this.brown, type: 'lowpass', freq: 900, dur: 0.25, gain: 0.1, attack: 0.005 });
  }

  nibble(vol = 1) {
    this.tone({ freq: 520, freqEnd: 380, dur: 0.07, gain: 0.05 * vol, attack: 0.003 });
  }

  bite() {
    this.tone({ freq: 340, freqEnd: 110, dur: 0.28, gain: 0.22, attack: 0.004 });
    this.burst({ type: 'bandpass', freq: 1400, q: 0.8, dur: 0.35, gain: 0.1, attack: 0.005 });
  }

  hookSet() {
    this.tone({ type: 'triangle', freq: 900, freqEnd: 1300, dur: 0.12, gain: 0.05, attack: 0.003 });
    this.splashSmall();
  }

  flick() {
    this.burst({ type: 'bandpass', freq: 1800, freqEnd: 900, q: 0.9, dur: 0.18, gain: 0.07, attack: 0.004 });
  }

  splashSmall(vol = 1, pan = 0) {
    this.burst({ type: 'bandpass', freq: 1300, freqEnd: 600, q: 0.7, dur: 0.3, gain: 0.08 * vol, attack: 0.005, pan });
  }

  splashBig() {
    this.burst({ type: 'bandpass', freq: 1000, freqEnd: 400, q: 0.6, dur: 0.8, gain: 0.2, attack: 0.008 });
    this.burst({ buf: this.brown, type: 'lowpass', freq: 600, dur: 0.9, gain: 0.22, attack: 0.01 });
  }

  tick(vol = 1) {
    this.burst({ type: 'highpass', freq: 3500, q: 0.7, dur: 0.018, gain: 0.035 * vol, attack: 0.001 });
  }

  tickRun(n, gap, vol) {
    for (let i = 0; i < n; i++) this.burst({ type: 'highpass', freq: 3800, q: 0.7, dur: 0.015, gain: vol, attack: 0.001, when: i * gap });
  }

  reelIn() {
    this.tickRun(9, 0.045, 0.03);
  }

  strain() {
    this.tone({ type: 'triangle', freq: 1200, freqEnd: 1500, dur: 0.45, gain: 0.035, attack: 0.02, vib: 20, filter: ['bandpass', 1400, 1.5] });
  }

  page() {
    this.burst({ buf: this.pink, type: 'bandpass', freq: 2200, freqEnd: 1400, q: 0.6, dur: 0.3, gain: 0.08, attack: 0.06 });
  }

  pluck(m, when = 0, vol = 0.05, dest = this.music) {
    const f = midi(m);
    this.tone({ freq: f, dur: 2.8, gain: vol, attack: 0.006, when, dest });
    this.tone({ freq: f * 2, type: 'triangle', dur: 1.2, gain: vol * 0.22, attack: 0.004, when, dest });
    this.tone({ freq: f * 3.01, dur: 0.5, gain: vol * 0.07, attack: 0.002, when, dest });
  }

  chime() {
    [74, 78, 81, 86].forEach((m, i) => this.pluck(m, i * 0.13, 0.07, this.sfx));
  }

  fanfare() {
    [69, 74, 78, 81, 86, 90].forEach((m, i) => this.pluck(m, i * 0.11, 0.065, this.sfx));
    this.pluck(93, 0.8, 0.04, this.sfx);
  }

  pad(notes, dur) {
    const ctx = this.ctx, t0 = ctx.currentTime;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 650;
    f.Q.value = 0.3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.02, t0 + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    f.connect(g);
    g.connect(this.music);
    for (const m of notes) {
      for (const det of [-6, 5]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = midi(m);
        o.detune.value = det;
        o.connect(f);
        o.start(t0);
        o.stop(t0 + dur + 0.1);
      }
    }
  }

  /* ---------- per-frame ---------- */

  update(dt, s) {
    if (!this.ctx) return;
    this.t += dt;
    const now = this.ctx.currentTime;
    const { speed, rain, day, night, land, open, cove, gulls } = s;

    this.set(this.waterBed.g.gain, 0.1 + 0.05 * Math.min(speed / 5, 1) + 0.04 * open, 1);
    this.set(this.surfBed.g.gain, 0.012 + land * 0.035 * (1 - cove * 0.5), 1.5);
    this.set(this.windBed.g.gain, 0.012 + 0.03 * open + 0.035 * rain, 2);
    this.windBed.f[0].frequency.setTargetAtTime(600 + Math.sin(this.t * 0.11) * 220 + Math.sin(this.t * 0.37) * 80, now, 0.8);
    this.set(this.rainBed.g.gain, 0.085 * rain, 1.5);
    this.set(this.rainLow.g.gain, 0.08 * rain, 1.5);
    this.set(this.music.gain, this.musicOn ? 0.9 * (1 - rain * 0.3) : 0, 1.5);

    const n = this.next;
    for (const k in n) n[k] -= dt;

    if (n.lap <= 0) {
      this.lap(0.12 + 0.06 * open + Math.min(speed, 5) * 0.02, rand(-0.5, 0.5));
      n.lap = rand(0.8, 2.4) / (1 + speed * 0.2);
    }
    if (n.drop <= 0) {
      if (rain > 0.05) this.drop(rand(0.01, 0.035) * rain);
      n.drop = rain > 0.05 ? rand(0.02, 0.09) / rain : 0.5;
    }
    if (n.bird <= 0) {
      if (day > 0.3 && land > 0.15 && rain < 0.5) this.bird(0.03 * land * day, rand(-0.8, 0.8));
      n.bird = rand(2.5, 8);
    }
    if (n.gull <= 0) {
      const g = Math.max(gulls, open * 0.4);
      if (g > 0.1 && day > 0.3) this.gull(0.022 * g, rand(-0.7, 0.7));
      n.gull = rand(5, 14);
    }
    if (n.cricket <= 0) {
      if (night > 0.4 && land > 0.2 && rain < 0.4) this.cricket(0.007 * land * night, rand(-0.8, 0.8));
      n.cricket = rand(0.4, 1.2);
    }
    if (n.owl <= 0) {
      if (night > 0.6 && land > 0.3) this.owl(0.03 * land, rand(-0.8, 0.8));
      n.owl = rand(25, 60);
    }

    if (this.musicOn && n.chord <= 0) {
      this.pad(CHORDS[this.chordIdx++ % CHORDS.length].map((m) => m - (night > 0.5 ? 12 : 0)), 16);
      n.chord = 12;
    }
    if (this.musicOn && n.note <= 0) {
      const count = Math.random() < 0.35 ? 3 : Math.random() < 0.5 ? 2 : 1;
      let when = 0;
      for (let i = 0; i < count; i++) {
        this.lastNote = clamp(this.lastNote + Math.round(rand(-2.4, 2.4)), 2, MELODY.length - 1);
        this.pluck(MELODY[this.lastNote] - (night > 0.5 ? 12 : 0), when, 0.045 * rand(0.7, 1));
        when += rand(0.35, 0.8);
      }
      n.note = rand(3, 7) * (night > 0.5 ? 1.5 : 1) * (1 + rain * 0.4);
    }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }
}
