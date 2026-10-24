import { rand, clamp } from './util.js';

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
// D major pentatonic, the gentlest scale there is.
const MELODY = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86];
const CHORDS = [[50, 57, 62], [47, 54, 62], [43, 50, 59], [45, 52, 61]];

// Everything you hear is synthesised: filtered noise for water, wind and rain,
// tiny oscillator gestures for birds, and a slow generative pentatonic tune.
//
// Every sound reaches the speakers through one master gain, so muting silences all of it,
// including sounds that start after you mute. Under the master there are separate volumes
// for the surroundings (water, wind, birds), rain, fishing effects, bite alerts and music.
export const VOLUME_KEYS = ['master', 'music', 'ambient', 'wind', 'waves', 'rain', 'effects', 'alerts'];
export class AudioScape {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.t = 0;
    this.under = 0;
    this.volumes = { master: 1, mute: false, music: 0.8, ambient: 1, wind: 0.8, waves: 0.9, rain: 1, effects: 1, alerts: 0.8 };
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
    // out (fade-in) → master volume → underwater muffle → compressor → speakers
    this.master = ctx.createGain();
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.muffle.Q.value = 0.4;
    this.out.connect(this.master);
    this.master.connect(this.muffle);
    this.muffle.connect(comp);
    comp.connect(ctx.destination);
    // Separate volume buses: surroundings, rain, fishing effects, bite alerts and music.
    const bus = () => {
      const g = ctx.createGain();
      g.connect(this.out);
      return g;
    };
    this.nature = bus();
    this.windBus = bus();
    this.wavesBus = bus();
    this.rainBus = bus();
    this.alerts = bus();
    this.musicVol = bus();
    this.effects = bus();

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.4, 2.4);
    const rv = ctx.createGain();
    rv.gain.value = 0.55;
    this.reverb.connect(rv);
    rv.connect(this.out);

    this.sfx = ctx.createGain();
    this.sfx.connect(this.effects);
    const sfxSend = ctx.createGain();
    sfxSend.gain.value = 0.15;
    // The reverb sends are taken after each bus's volume, so turning a bus down quietens its echo too.
    this.effects.connect(sfxSend);
    sfxSend.connect(this.reverb);

    this.music = ctx.createGain();
    this.music.gain.value = 0;
    this.music.connect(this.musicVol);
    const musicSend = ctx.createGain();
    musicSend.gain.value = 0.8;
    this.musicVol.connect(musicSend);
    musicSend.connect(this.reverb);

    this.white = this.noise(3, 'white');
    this.brown = this.noise(5, 'brown');
    this.pink = this.noise(4, 'pink');

    this.waterBed = this.bed(this.brown, [['lowpass', 380, 0.6]], this.wavesBus);
    this.surfBed = this.bed(this.pink, [['bandpass', 520, 0.5]], this.wavesBus);
    this.windBed = this.bed(this.pink, [['bandpass', 700, 0.8]], this.windBus);
    // A higher whistle that only rises in the gusts.
    this.gustBed = this.bed(this.white, [['bandpass', 1500, 2.2]], this.windBus);
    this.rainBed = this.bed(this.white, [['highpass', 1100, 0.5], ['lowpass', 7500, 0.5]], this.rainBus);
    this.rainLow = this.bed(this.brown, [['lowpass', 900, 0.5]], this.rainBus);
    this.underBed = this.bed(this.brown, [['lowpass', 260, 0.7]]);
    // Running water, a crackling fire and a sizzling grill, faded in by how close you are.
    this.streamBed = this.bed(this.white, [['bandpass', 1800, 0.6], ['lowpass', 5200, 0.4]]);
    this.streamLow = this.bed(this.pink, [['bandpass', 420, 0.8]]);
    this.fireBed = this.bed(this.brown, [['lowpass', 500, 0.6]]);
    this.sizzleBed = this.bed(this.white, [['highpass', 3200, 0.5]]);
    this.alarmOsc = null;
    this.setVolumes(this.volumes);

    this.next = { lap: 1, bird: 3, gull: 8, cricket: 2, owl: 25, note: 5, chord: 1, drop: 0, crackle: 0.5, frog: 8, bloop: 1 };
    this.lastNote = 5;
    this.chordIdx = 0;
  }

  get ready() { return !!this.ctx; }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    if (!this.ctx) return;
    const now = this.ctx.currentTime, V = this.volumes;
    // Muted means silent: straight to zero, not a slow fade.
    if (V.mute) this.master.gain.setValueAtTime(0, now);
    else this.master.gain.setTargetAtTime(V.master, now, 0.05);
    this.nature.gain.setTargetAtTime(V.ambient, now, 0.05);
    this.windBus.gain.setTargetAtTime(V.wind ?? 0.8, now, 0.05);
    this.wavesBus.gain.setTargetAtTime(V.waves ?? 0.9, now, 0.05);
    this.rainBus.gain.setTargetAtTime(V.rain, now, 0.05);
    this.effects.gain.setTargetAtTime(V.effects, now, 0.05);
    this.alerts.gain.setTargetAtTime(V.alerts, now, 0.05);
    this.musicVol.gain.setTargetAtTime(V.music, now, 0.05);
  }

  get muted() { return !!this.volumes.mute; }

  // 0 above water, 1 fully under: everything goes soft and low, with a quiet hum.
  setUnderwater(amount) {
    this.under = amount;
    if (!this.ctx) return;
    const f = 20000 * Math.pow(650 / 20000, amount);
    this.muffle.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.12);
  }

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

  bed(buffer, filters, dest = this.nature) {
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
    g.connect(dest);
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
    this.burst({ buf: this.brown, type: 'lowpass', freq: rand(350, 600), q: 0.8, dur: rand(0.5, 0.9), gain: vol, attack: rand(0.1, 0.2), pan, dest: this.wavesBus });
    this.burst({ buf: this.pink, type: 'bandpass', freq: rand(600, 900), q: 1.2, dur: 0.4, gain: vol * 0.25, attack: 0.08, pan, when: 0.1, dest: this.wavesBus });
  }

  bird(vol, pan) {
    const base = rand(2200, 3600);
    const n = 2 + Math.floor(rand(0, 5));
    const up = Math.random() < 0.5;
    let t = 0;
    for (let i = 0; i < n; i++) {
      const f = base * rand(0.85, 1.2);
      this.tone({ freq: f, freqEnd: f * (up ? rand(1.2, 1.5) : rand(0.6, 0.8)), dur: rand(0.06, 0.14), gain: vol * rand(0.6, 1), attack: 0.01, pan, when: t, dest: this.nature });
      t += rand(0.08, 0.2);
    }
  }

  gull(vol, pan) {
    let t = 0;
    const n = 2 + Math.floor(rand(0, 3));
    for (let i = 0; i < n; i++) {
      this.tone({ type: 'sawtooth', freq: rand(1050, 1250), freqEnd: rand(700, 820), dur: rand(0.28, 0.42), gain: vol, attack: 0.03, pan, when: t, filter: ['bandpass', 1500, 2.5], dest: this.nature });
      t += rand(0.35, 0.5);
    }
  }

  cricket(vol, pan) {
    const f = rand(4200, 4800);
    for (let k = 0; k < 3; k++) this.tone({ freq: f, dur: 0.03, gain: vol, attack: 0.004, pan, when: k * 0.055, dest: this.nature });
  }

  owl(vol, pan) {
    this.tone({ freq: 400, freqEnd: 370, dur: 0.5, gain: vol, attack: 0.09, pan, dest: this.nature });
    this.tone({ freq: 390, freqEnd: 355, dur: 0.7, gain: vol * 0.9, attack: 0.1, pan, when: 0.7, dest: this.nature });
  }

  drop(vol) {
    this.tone({ freq: rand(1800, 3800), freqEnd: rand(900, 1500), dur: 0.035, gain: vol, attack: 0.001, pan: rand(-0.6, 0.6), dest: this.rainBus });
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

  cast(vol = 1) {
    this.burst({ type: 'bandpass', freq: 2400, freqEnd: 500, q: 1.2, dur: 0.42, gain: 0.07 * vol, attack: 0.06 });
    this.tickRun(10, 0.03, 0.025 * vol);
  }

  // The bite alarm on a bottom rig: a single soft bleep when something moves the line. It is
  // not a bite yet, so it stays small.
  alarm(vol = 1) {
    this.tone({ type: 'triangle', freq: 1760, dur: 0.09, gain: 0.03 * vol, attack: 0.004, filter: ['lowpass', 3500, 0.7], dest: this.alerts });
  }

  // A short, pleasant ring when there is something to do. 'strike': a fish has taken a bait
  // that needs striking (float fishing); 'fishon': a self-hooking rig has hooked a fish that is
  // running with it. Never a continuous alarm.
  biteAlert(kind = 'strike') {
    if (!this.ctx) return;
    const bell = (m, when, vol) => {
      const f = midi(m);
      this.tone({ freq: f, dur: 1.4, gain: vol, attack: 0.004, when, dest: this.alerts });
      this.tone({ freq: f * 2.76, dur: 0.5, gain: vol * 0.18, attack: 0.002, when, dest: this.alerts });
      this.tone({ freq: f * 5.4, dur: 0.18, gain: vol * 0.05, attack: 0.001, when, dest: this.alerts });
    };
    if (kind === 'fishon') {
      [81, 85, 88].forEach((m, i) => bell(m, i * 0.12, 0.085));
    } else {
      bell(86, 0, 0.08);
      bell(81, 0.16, 0.06);
    }
  }

  // Kept for older callers: the run is announced once by biteAlert('fishon').
  alarmRun() {}

  // The skiff's outboard: a low putter at idle that rises in pitch and loudness with the
  // throttle. level 0 is off.
  engine(level) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.eng && level > 0) {
      const t0 = ctx.currentTime;
      const o1 = ctx.createOscillator();
      o1.type = 'sawtooth';
      const o2 = ctx.createOscillator();
      o2.type = 'square';
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 2;
      const g = ctx.createGain();
      g.gain.value = 0;
      const putter = ctx.createGain();
      putter.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.45;
      lfo.connect(lfoDepth);
      lfoDepth.connect(putter.gain);
      const mix2 = ctx.createGain();
      mix2.gain.value = 0.25;
      o1.connect(f);
      o2.connect(mix2);
      mix2.connect(f);
      f.connect(putter);
      putter.connect(g);
      g.connect(this.sfx);
      o1.start(t0);
      o2.start(t0);
      lfo.start(t0);
      this.eng = { o1, o2, f, g, lfo };
    }
    if (!this.eng) return;
    const e = this.eng, on = level > 0.001;
    const rpm = 34 + level * 58;
    this.set(e.o1.frequency, rpm, 0.25);
    this.set(e.o2.frequency, rpm * 2.02, 0.25);
    this.set(e.lfo.frequency, rpm / 2.2, 0.25);
    this.set(e.f.frequency, 260 + level * 900, 0.3);
    this.set(e.g.gain, on ? 0.035 + level * 0.07 : 0, on ? 0.3 : 0.6);
  }

  // A predator hitting a lure: a solid thump through the rod.
  strike() {
    this.tone({ freq: 140, freqEnd: 70, dur: 0.18, gain: 0.2, attack: 0.002 });
    this.burst({ type: 'bandpass', freq: 1400, freqEnd: 500, q: 0.7, dur: 0.3, gain: 0.08, attack: 0.004 });
  }

  // A trout sipping a fly from the surface.
  sip() {
    this.tone({ freq: 900, freqEnd: 300, dur: 0.09, gain: 0.07, attack: 0.002 });
    this.burst({ buf: this.brown, type: 'lowpass', freq: 700, dur: 0.15, gain: 0.06, attack: 0.004 });
  }

  step(jog = false, pan = 0) {
    this.burst({ buf: this.pink, type: 'bandpass', freq: rand(500, 800), q: 0.9, dur: 0.09, gain: (jog ? 0.035 : 0.022), attack: 0.004, pan });
    this.burst({ buf: this.white, type: 'highpass', freq: 3000, q: 0.6, dur: 0.05, gain: 0.006, attack: 0.002, pan });
  }

  wade(vol = 1) {
    this.burst({ type: 'bandpass', freq: rand(900, 1400), freqEnd: 500, q: 0.7, dur: 0.25, gain: 0.05 * vol, attack: 0.01 });
    this.burst({ buf: this.brown, type: 'lowpass', freq: 500, dur: 0.3, gain: 0.06 * vol, attack: 0.01 });
  }

  crackle(vol) {
    for (let i = 0; i < 1 + Math.floor(rand(0, 3)); i++) {
      this.burst({ type: 'highpass', freq: rand(2000, 5000), q: 0.8, dur: rand(0.01, 0.03), gain: vol * rand(0.4, 1), attack: 0.001, when: rand(0, 0.15), pan: rand(-0.3, 0.3), dest: this.nature });
    }
  }

  frog(vol, pan) {
    const f = rand(160, 230);
    for (let k = 0; k < 2 + Math.floor(rand(0, 2)); k++) {
      this.tone({ type: 'sawtooth', freq: f, freqEnd: f * 0.85, dur: 0.11, gain: vol, attack: 0.01, pan, when: k * 0.17, filter: ['bandpass', 600, 2], dest: this.nature });
    }
  }

  rustle() {
    this.burst({ buf: this.pink, type: 'bandpass', freq: 1800, freqEnd: 900, q: 0.5, dur: 0.6, gain: 0.06, attack: 0.1 });
  }

  plop(scale = 1) {
    this.tone({ freq: 600 / scale, freqEnd: 150 / scale, dur: 0.16, gain: 0.16, attack: 0.004 });
    this.burst({ buf: this.brown, type: 'lowpass', freq: 900, dur: 0.25, gain: 0.1, attack: 0.005 });
  }

  nibble(vol = 1) {
    this.tone({ freq: 520, freqEnd: 380, dur: 0.07, gain: 0.05 * vol, attack: 0.003 });
  }

  // A soft "plop" as the float goes under; never a startling sound.
  bite() {
    this.tone({ freq: 300, freqEnd: 130, dur: 0.26, gain: 0.12, attack: 0.01 });
    this.burst({ type: 'bandpass', freq: 1200, q: 0.8, dur: 0.3, gain: 0.05, attack: 0.01 });
  }

  bubble(vol = 0.02, pan = 0) {
    this.tone({ freq: rand(380, 620), freqEnd: rand(800, 1300), dur: 0.08, gain: vol, attack: 0.004, pan });
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
    const { speed, rain, day, night, land, open, cove, gulls, stream = 0, fire = 0, sizzle = 0, lake = 0, water = 1, wind = 0.3, gust = 1, sea = 0.2 } = s;

    // The sea's wash grows with the waves where you are; the surf with the swell on the shore.
    this.set(this.waterBed.g.gain, (0.08 + 0.05 * Math.min(speed / 5, 1) + 0.12 * Math.min(sea, 1)) * (0.25 + 0.75 * water), 1);
    const above = 1 - this.under * 0.75;
    this.set(this.surfBed.g.gain, (0.008 + land * (0.02 + 0.05 * Math.min(sea, 1)) * (1 - cove * 0.5)) * above, 1.5);
    // The wind: its strength where you are (0 … 1 at a fresh breeze), louder and brighter in gusts.
    this.set(this.windBed.g.gain, (0.006 + 0.07 * wind * wind + 0.02 * rain) * above, 1.2);
    this.set(this.gustBed.g.gain, 0.012 * Math.max(0, gust - 1.1) * wind * above, 0.6);
    this.set(this.underBed.g.gain, 0.16 * this.under, 0.4);
    this.windBed.f[0].frequency.setTargetAtTime(500 + wind * 400 + (gust - 1) * 500 + Math.sin(this.t * 0.11) * 120, now, 0.8);
    this.set(this.rainBed.g.gain, 0.085 * rain, 1.5);
    this.set(this.rainLow.g.gain, 0.08 * rain, 1.5);
    this.set(this.music.gain, this.musicOn ? 0.9 * (1 - rain * 0.3) : 0, 1.5);
    this.set(this.streamBed.g.gain, 0.05 * stream * above, 0.8);
    this.set(this.streamLow.g.gain, 0.06 * stream * above, 0.8);
    this.set(this.fireBed.g.gain, 0.05 * fire, 0.8);
    this.set(this.sizzleBed.g.gain, 0.02 * sizzle, 0.5);

    const n = this.next;
    for (const k in n) n[k] -= dt;

    if (n.lap <= 0) {
      if (water > 0.08) this.lap((0.1 + 0.08 * Math.min(sea, 1) + Math.min(speed, 5) * 0.02) * water, rand(-0.5, 0.5));
      n.lap = rand(0.8, 2.4) / (1 + speed * 0.2 + sea);
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
    if (n.crackle <= 0) {
      if (fire > 0.05) this.crackle(0.05 * fire);
      n.crackle = rand(0.08, 0.5);
    }
    if (n.frog <= 0) {
      if (lake > 0.2 && (night > 0.3 || rain > 0.4)) this.frog(0.02 * lake, rand(-0.7, 0.7));
      n.frog = rand(3, 9);
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
