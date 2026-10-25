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
// for the surroundings (water, wind, birds), rain, fishing effects, the reel and line, bite
// alerts and music.
export const VOLUME_KEYS = ['master', 'music', 'ambient', 'wind', 'waves', 'rain', 'effects', 'reel', 'alerts'];
export class AudioScape {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.t = 0;
    this.under = 0;
    this.volumes = { master: 1, mute: false, music: 0.8, ambient: 1, wind: 0.8, waves: 0.9, rain: 1, effects: 1, reel: 0.9, alerts: 0.8 };
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
    this.reelBus = bus();

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
    // A camping stove's soft roar while something cooks.
    this.stoveBed = this.bed(this.white, [['bandpass', 2400, 0.6], ['lowpass', 5000, 0.5]]);
    // The race in Calf Sound: a deep, restless roar of water going somewhere in a hurry.
    this.raceBed = this.bed(this.pink, [['bandpass', 360, 0.45], ['lowpass', 1500, 0.5]], this.wavesBus);
    // A sail flogging in the wind: a ragged, fluttering rustle of cloth.
    this.flapBed = this.bed(this.white, [['bandpass', 950, 0.7], ['highpass', 280, 0.5]]);
    // A gale: the wind howling, whistling in rigging and round rocks.
    this.howlBed = this.bed(this.pink, [['bandpass', 640, 7], ['lowpass', 2400, 0.5]], this.windBus);
    // The reel and the line (see reel()): the drag's ratchet clicking as a fish takes line, the
    // gears whirring as you wind, and the line singing taut near its breaking strain. Each click
    // train is noise gated by a train of short pulses, so its rate can follow the line smoothly.
    this.ratchet = this.clicker(this.white, [['bandpass', 3200, 1.4]]);
    this.whirr = this.clicker(this.pink, [['bandpass', 1500, 1.1]], 0.3);
    this.whirrBed = this.bed(this.pink, [['bandpass', 650, 1.2]], this.reelBus);
    this.singOsc = ctx.createOscillator();
    this.singOsc.type = 'triangle';
    this.singOsc.frequency.value = 1500;
    const sv = ctx.createOscillator(), svg = ctx.createGain();
    sv.frequency.value = 11;
    svg.gain.value = 14;
    sv.connect(svg);
    svg.connect(this.singOsc.frequency);
    const sf = ctx.createBiquadFilter();
    sf.type = 'bandpass';
    sf.frequency.value = 1700;
    sf.Q.value = 2;
    this.singGain = ctx.createGain();
    this.singGain.gain.value = 0;
    this.singOsc.connect(sf);
    sf.connect(this.singGain);
    this.singGain.connect(this.reelBus);
    this.singOsc.start();
    sv.start();
    this.alarmOsc = null;
    this.setVolumes(this.volumes);

    this.next = { lap: 1, bird: 3, gull: 8, cricket: 2, owl: 25, note: 5, chord: 1, drop: 0, crackle: 0.5, frog: 8, bloop: 1, clink: 2, curlew: 12, boom: 4, flap: 2, seal: 6, shear: 4 };
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
    this.reelBus.gain.setTargetAtTime(V.reel ?? 0.9, now, 0.05);
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

  // A train of clicks: looped noise through filters, gated by a pulse wave whose frequency is the
  // click rate (0 = silent). duty: how long each click is, as a share of the gap.
  clicker(buffer, filters, duty = 0.14) {
    const ctx = this.ctx, b = this.bed(buffer, filters, this.reelBus);
    // A narrow pulse from its harmonics (a pulse wave has no steady part here: see the offset).
    const N = 40, real = new Float32Array(N), imag = new Float32Array(N);
    for (let n = 1; n < N; n++) {
      // (Softened towards the top, so it doesn't ring.)
      real[n] = ((2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)) * Math.exp(-n / 26);
    }
    const lfo = ctx.createOscillator();
    lfo.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    lfo.frequency.value = 1;
    const depth = ctx.createGain();
    depth.gain.value = 0;
    lfo.connect(depth);
    depth.connect(b.g.gain);
    lfo.start();
    return { ...b, lfo, depth, duty };
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

  // Thunder from a strike `dist` metres off: close, a sharp crack and then the roll; far off,
  // only a long low rumble that swells and fades.
  thunder(dist = 1000, loud = 0.6) {
    if (!this.ctx) return;
    const near = clamp(1 - dist / 900, 0, 1);
    if (near > 0.2) this.burst({ buf: this.white, type: 'highpass', freq: 1800, dur: 0.18, gain: 0.12 * near * loud, attack: 0.002, dest: this.nature });
    const rolls = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < rolls; i++) {
      const when = (i ? 0.25 + Math.random() * 1.6 : 0) + (1 - near) * 0.2;
      this.burst({ buf: this.brown, type: 'lowpass', freq: 380 + near * 500, freqEnd: 90, q: 0.7, dur: 2.2 + Math.random() * 2.5, gain: (0.32 - i * 0.04) * loud, attack: 0.05 + (1 - near) * 0.5, when, dest: this.nature });
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
  // throttle. level 0 is off. (jet: the jet ski's, a higher, harder whine that climbs further.)
  engine(level, jet = false) {
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
    const rpm = jet ? 55 + level * 165 : 34 + level * 58;
    this.set(e.o1.frequency, rpm, 0.25);
    this.set(e.o2.frequency, rpm * 2.02, 0.25);
    this.set(e.lfo.frequency, rpm / 2.2, 0.25);
    this.set(e.f.frequency, jet ? 480 + level * 2400 : 260 + level * 900, 0.3);
    this.set(e.g.gain, on ? (jet ? 0.03 + level * 0.08 : 0.035 + level * 0.07) : 0, on ? 0.3 : 0.6);
  }

  // The car: a soft four-cylinder hum that rises with the revs, and gravel under the tyres with
  // the speed. level 0…1 (speed), throttle 0…1 (how hard you're pressing); running: the engine
  // is on (it idles while you sit at the wheel).
  car(level, throttle = 0, running = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.carEng && running) {
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(f);
      f.connect(g);
      g.connect(this.sfx);
      o.start(t0);
      const tyres = this.bed(this.white, [['bandpass', 900, 0.5], ['lowpass', 2600, 0.4]], this.sfx);
      this.carEng = { o, f, g, tyres, on: false };
    }
    if (!this.carEng) return;
    const e = this.carEng, on = running;
    const rev = Math.min(1, level * 0.8 + throttle * 0.35);
    this.set(e.o.frequency, 38 + rev * 70, 0.2);
    this.set(e.f.frequency, 180 + rev * 520, 0.25);
    this.set(e.g.gain, on ? 0.02 + rev * 0.045 : 0, on ? 0.25 : 0.5);
    this.set(e.tyres.g.gain, level * 0.03, 0.2);
  }

  // A car door: the latch and a solid thunk.
  carDoor() {
    this.tone({ freq: 120, freqEnd: 70, dur: 0.16, gain: 0.16, attack: 0.002 });
    this.burst({ buf: this.brown, type: 'lowpass', freq: 600, dur: 0.12, gain: 0.12, attack: 0.002 });
    this.tone({ type: 'square', freq: 1800, dur: 0.02, gain: 0.015, attack: 0.001, when: 0.05 });
  }

  // The boot lifting: a gas strut's sigh and the lid settling.
  boot() {
    this.burst({ type: 'bandpass', freq: 1200, freqEnd: 700, q: 0.8, dur: 0.5, gain: 0.04, attack: 0.08 });
    this.tone({ freq: 140, freqEnd: 110, dur: 0.12, gain: 0.08, attack: 0.004, when: 0.45 });
  }

  // A house door: a short creak, and the latch as it closes.
  door(open) {
    if (open) this.burst({ type: 'bandpass', freq: 520, freqEnd: 760, q: 6, dur: 0.35, gain: 0.025, attack: 0.05 });
    else this.tone({ freq: 220, freqEnd: 150, dur: 0.1, gain: 0.07, attack: 0.002, when: 0.3 });
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

  // A footstep, by what's underfoot: grass, sand (soft and dull), stone (a crisp tap) or planks
  // (a hollow knock).
  step(jog = false, pan = 0, surface = 'grass') {
    const k = jog ? 1.5 : 1;
    if (surface === 'sand') {
      this.burst({ buf: this.brown, type: 'lowpass', freq: rand(380, 520), q: 0.6, dur: 0.14, gain: 0.03 * k, attack: 0.01, pan });
      this.burst({ buf: this.white, type: 'bandpass', freq: rand(1800, 2600), q: 0.8, dur: 0.08, gain: 0.004 * k, attack: 0.01, pan });
    } else if (surface === 'stone') {
      this.burst({ buf: this.white, type: 'bandpass', freq: rand(2200, 3200), q: 1.4, dur: 0.035, gain: 0.018 * k, attack: 0.001, pan });
      this.burst({ buf: this.pink, type: 'bandpass', freq: rand(600, 900), q: 1.2, dur: 0.05, gain: 0.014 * k, attack: 0.002, pan });
    } else if (surface === 'wood') {
      this.tone({ freq: rand(170, 210), freqEnd: 120, dur: 0.09, gain: 0.03 * k, attack: 0.002, pan });
      this.burst({ buf: this.pink, type: 'bandpass', freq: rand(700, 1000), q: 1, dur: 0.05, gain: 0.012 * k, attack: 0.002, pan });
    } else {
      this.burst({ buf: this.pink, type: 'bandpass', freq: rand(500, 800), q: 0.9, dur: 0.09, gain: 0.022 * k, attack: 0.004, pan });
      this.burst({ buf: this.white, type: 'highpass', freq: 3000, q: 0.6, dur: 0.05, gain: 0.006, attack: 0.002, pan });
    }
  }

  // The camera's shutter: a small mechanical click.
  shutter() {
    this.burst({ buf: this.white, type: 'bandpass', freq: 3800, q: 1.2, dur: 0.025, gain: 0.05, attack: 0.001 });
    this.burst({ buf: this.white, type: 'bandpass', freq: 2600, q: 1.2, dur: 0.03, gain: 0.04, attack: 0.001, when: 0.07 });
  }

  /* ---- diving ---- */

  // A breath through the regulator: the hiss in, then the rumble of bubbles going out.
  regulator(vol = 1) {
    this.burst({ type: 'bandpass', freq: 1500, freqEnd: 2100, q: 1.4, dur: 0.95, gain: 0.03 * vol, attack: 0.3 });
    this.burst({ buf: this.brown, type: 'lowpass', freq: 380, dur: 1.1, gain: 0.08 * vol, attack: 0.05, when: 1.3 });
    for (let i = 0; i < 6; i++) this.tone({ freq: rand(160, 320), freqEnd: rand(420, 700), dur: 0.07, gain: 0.025 * vol, attack: 0.004, when: 1.35 + i * rand(0.07, 0.16) });
  }

  // The heart, louder and quicker as the breath runs out (call every frame; 0 is quiet).
  heart(level) {
    if (!this.ctx || level < 0.05) return;
    const now = this.ctx.currentTime;
    if (now < (this.heartAt || 0)) return;
    this.heartAt = now + 1.15 - level * 0.45;
    this.tone({ freq: 58, freqEnd: 42, dur: 0.16, gain: 0.08 + level * 0.12, attack: 0.01 });
    this.tone({ freq: 52, freqEnd: 40, dur: 0.14, gain: 0.05 + level * 0.08, attack: 0.01, when: 0.24 });
  }

  // Back at the surface: the first breath, a gasp after a long one.
  gasp(k = 0.5) {
    this.burst({ type: 'bandpass', freq: 900, freqEnd: 1500, q: 1.1, dur: 0.45, gain: 0.03 + k * 0.05, attack: 0.04 });
  }

  // The dive computer's warning: two quick beeps.
  beep() {
    this.tone({ type: 'square', freq: 2300, dur: 0.07, gain: 0.025, attack: 0.002 });
    this.tone({ type: 'square', freq: 2300, dur: 0.07, gain: 0.025, attack: 0.002, when: 0.13 });
  }

  // The speargun: the bands' twang, the shaft away.
  spear() {
    this.tone({ type: 'triangle', freq: 190, freqEnd: 85, dur: 0.32, gain: 0.08, attack: 0.002 });
    this.burst({ type: 'bandpass', freq: 2600, freqEnd: 900, q: 1, dur: 0.07, gain: 0.05, attack: 0.001 });
  }

  // The shaft striking home.
  thud() {
    this.burst({ buf: this.brown, type: 'lowpass', freq: 320, dur: 0.14, gain: 0.14, attack: 0.002 });
  }

  // Rigging against a mast in the harbour: a bright, thin clink or two.
  clink(vol, pan) {
    const f = rand(2500, 3400);
    for (let i = 0; i < 1 + Math.floor(rand(0, 3)); i++) {
      this.tone({ type: 'triangle', freq: f * rand(0.98, 1.02), dur: 0.35, gain: vol, attack: 0.001, pan, when: i * rand(0.12, 0.3), dest: this.nature });
      this.tone({ freq: f * 2.76, dur: 0.12, gain: vol * 0.25, attack: 0.001, pan, when: i * 0.2, dest: this.nature });
    }
  }

  // A curlew over the cove channel: a rising, bubbling "cur-lee".
  curlew(vol, pan) {
    let t = 0;
    for (let i = 0; i < 2 + Math.floor(rand(0, 3)); i++) {
      this.tone({ freq: rand(1500, 1700), freqEnd: rand(2300, 2600), dur: 0.42, gain: vol, attack: 0.06, pan, when: t, vib: 6, dest: this.nature });
      t += rand(0.5, 0.7);
    }
  }

  // A Cory's shearwater at night: a hoarse, nasal wail, rising and falling, two or three times.
  shearwater(vol, pan) {
    let t = 0;
    for (let i = 0; i < 2 + Math.floor(rand(0, 2)); i++) {
      this.tone({ type: 'sawtooth', freq: rand(380, 430), freqEnd: rand(640, 720), dur: 0.3, gain: vol, attack: 0.05, pan, when: t, vib: 9, filter: ['bandpass', 1150, 2.2], dest: this.nature });
      this.tone({ type: 'sawtooth', freq: rand(620, 680), freqEnd: rand(330, 380), dur: 0.42, gain: vol * 0.9, attack: 0.04, pan, when: t + 0.3, vib: 7, filter: ['bandpass', 1000, 2], dest: this.nature });
      t += rand(0.85, 1.1);
    }
  }

  // The swell breaking on the ledges under Cove Head: a low, slow boom.
  boom(vol, pan) {
    this.burst({ buf: this.brown, type: 'lowpass', freq: 260, q: 0.5, dur: 1.6, gain: vol, attack: 0.18, pan, dest: this.wavesBus });
    this.burst({ buf: this.pink, type: 'bandpass', freq: 700, q: 0.6, dur: 1.2, gain: vol * 0.35, attack: 0.3, pan, when: 0.15, dest: this.wavesBus });
  }

  // A grey seal hauled out on the skerry: a long, wavering moan, half song.
  seal(vol, pan) {
    const f = rand(190, 260);
    this.tone({ freq: f, freqEnd: f * rand(0.7, 0.82), dur: rand(1.4, 2.2), gain: vol, attack: 0.35, pan, vib: 4, dest: this.nature });
    this.tone({ type: 'triangle', freq: f * 2, freqEnd: f * 1.5, dur: 1.2, gain: vol * 0.18, attack: 0.4, pan, when: 0.1, dest: this.nature });
  }

  // The tent's fly flapping in a gust.
  flap(vol) {
    this.burst({ buf: this.pink, type: 'bandpass', freq: rand(700, 1100), q: 0.7, dur: rand(0.12, 0.25), gain: vol, attack: 0.01, pan: rand(-0.4, 0.4), dest: this.windBus });
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

  // The reel and the line, each frame while there's line out. r: { payout: line going out
  // against the drag (m/s), wind: line wound in (m/s), load: 0 … 1 of the breaking strain,
  // drag: the drag setting 0 … 1, sing: the line singing near breaking 0 … 1, free: line
  // pouring off an open bail (no clicks) }.
  //  · The drag's ratchet clicks faster the faster line goes, from a slow tick-tick as a fish
  //    leans on it to a scream on a long run; brighter and louder with the drag set tighter and
  //    the load heavier.
  //  · The gears whirr as you wind, lower and grinding under load.
  //  · Near breaking the line sings: a thin, rising whine you can't mistake.
  reel(r) {
    if (!this.ctx || !this.ratchet) return;
    const now = this.ctx.currentTime;
    const click = r.free ? 0 : r.payout;
    const rate = Math.min(70, click * 16);
    const on = rate > 0.5 ? 1 : 0;
    const vol = on * (0.035 + 0.05 * r.load + 0.03 * r.drag) * Math.min(1, click / 0.4);
    this.setClicks(this.ratchet, rate, vol, now);
    this.ratchet.f[0].frequency.setTargetAtTime(2600 + 1400 * r.drag + 600 * r.load, now, 0.05);
    // Winding: a fine gear rattle and a soft hum.
    const w = Math.min(r.wind, 6);
    this.setClicks(this.whirr, w > 0.05 ? 22 + w * 26 : 0, w > 0.05 ? (0.012 + 0.02 * r.load) * Math.min(1, w / 0.6) : 0, now);
    this.whirr.f[0].frequency.setTargetAtTime(1700 - 700 * r.load, now, 0.08);
    this.set(this.whirrBed.g.gain, w > 0.05 ? (0.008 + 0.025 * r.load) * Math.min(1, w / 0.6) : 0, 0.06);
    this.whirrBed.f[0].frequency.setTargetAtTime(520 + w * 60 - 200 * r.load, now, 0.1);
    // The line singing.
    this.set(this.singGain.gain, 0.03 * r.sing * r.sing, 0.05);
    this.singOsc.frequency.setTargetAtTime(1250 + 900 * r.sing, now, 0.08);
  }

  setClicks(c, rate, vol, now) {
    // (Gain = offset + depth × pulse: the pulse wave's floor is lifted to silence between clicks.)
    const floor = c.duty / (1 - c.duty);
    c.lfo.frequency.setTargetAtTime(Math.max(rate, 0.5), now, 0.03);
    c.depth.gain.setTargetAtTime(vol, now, 0.03);
    c.g.gain.setTargetAtTime(vol * floor, now, 0.03);
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
    const { speed, rain, day, night, land, open, cove, gulls, stream = 0, fire = 0, sizzle = 0, lake = 0, water = 1, wind = 0.3, gust = 1, sea = 0.2, stove = 0, harbour = 0, inlet = 0, head = 0, tent = 0, race = 0, seals = 0, flap = 0, gale = 0, shearwaters = 0 } = s;

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
    this.set(this.stoveBed.g.gain, 0.012 * stove, 0.5);
    this.set(this.raceBed.g.gain, 0.07 * race * above, 1.5);
    this.set(this.howlBed.g.gain, 0.06 * gale * (0.6 + 0.4 * Math.sin(this.t * 0.7) * Math.sin(this.t * 0.23)) * above, 0.8);
    this.howlBed.f[0].frequency.setTargetAtTime(560 + gale * 220 + Math.sin(this.t * 0.31) * 140 + (gust - 1) * 300, now, 0.5);
    this.set(this.flapBed.g.gain, 0.055 * flap * (0.35 + 0.65 * Math.abs(Math.sin(this.t * 21 + Math.sin(this.t * 3.1) * 2))) * above, 0.03);
    this.raceBed.f[0].frequency.setTargetAtTime(320 + Math.sin(this.t * 0.37) * 60 + Math.sin(this.t * 1.3) * 25, now, 0.6);

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
    // The cove shore: rigging in the harbour (busier in a breeze), a curlew in the channel at the
    // turn of the light, the swell booming under Cove Head, and your tent's fly in the wind.
    if (n.clink <= 0) {
      if (harbour > 0.15) this.clink(0.012 * harbour * (0.4 + wind), rand(-0.7, 0.7));
      n.clink = rand(1.2, 5) / (0.5 + wind);
    }
    if (n.curlew <= 0) {
      const dusk = day > 0.05 && day < 0.7 ? 1 : 0.3;
      if (inlet > 0.2 && rain < 0.6) this.curlew(0.016 * inlet * dusk, rand(-0.8, 0.8));
      n.curlew = rand(14, 40);
    }
    if (n.boom <= 0) {
      if (head > 0.15 && sea > 0.25) this.boom(0.09 * head * Math.min(1.5, sea), rand(-0.5, 0.5));
      n.boom = rand(5, 11);
    }
    if (n.seal <= 0) {
      if (seals > 0.15 && rain < 0.7) this.seal(0.02 * seals, rand(-0.6, 0.6));
      n.seal = rand(9, 28);
    }
    if (n.flap <= 0) {
      if (tent > 0.1 && wind > 0.25) this.flap(0.02 * tent * wind * Math.max(1, gust));
      n.flap = rand(0.4, 2.2) / (0.4 + wind);
    }
    if (n.owl <= 0) {
      if (night > 0.6 && land > 0.3 && !shearwaters) this.owl(0.03 * land, rand(-0.8, 0.8));
      n.owl = rand(25, 60);
    }
    // Las Brasas after dark: shearwaters coming in to their burrows in the cliffs, wailing.
    if (n.shear <= 0) {
      if (shearwaters > 0.1 && night > 0.5) this.shearwater(0.03 * shearwaters, rand(-0.9, 0.9));
      n.shear = rand(3, 11);
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
