// The wind sea, as a real one is: thousands of waves of every length, coming from round the
// wind's direction, each with its own height and phase drawn at random from the sea's spectrum
// (fetch-limited JONSWAP: see conditions.js chopSpectrum) and each running at its own speed (deep
// water: ω² = g k). Summed by a fast Fourier transform over a square patch of sea, the way the
// big ocean games do it (Tessendorf, "Simulating Ocean Water", 2001). The crests are sharpened
// as real ones are, by the water's to-and-fro carrying each point along as well as up ("choppy"
// waves), and where they're pinched so tight they'd fold over they break into foam, which lingers
// and fades.
//
// Two bands. The long waves (about 6 m and up, what lifts and rocks a boat) are worked out here,
// on the CPU, a few dozen times a second: the physics samples them exactly as the water shader
// draws them, so a hull always sits on the water you see. The short ones (down to a few
// centimetres, the surface's texture and glitter) are worked out on the graphics card when the
// Ocean setting is Full (see oceangpu.js), and only for the eye.
//
// The long-wave patch is summed twice, the second copy turned and shifted, so the sea never
// repeats across a patch's width. (Two copies of one wave field, turned, are still a wave field:
// it's simply a crossing sea.)

const G = 9.81;
const TAU = Math.PI * 2;

export const PATCH = { N: 64, L: 140 };       // the long waves: cells across, metres across
export const SHORT = { N: 128, L: 23.7 };      // the short ones (GPU): an odd size, so the two never line up
export const CUT = [2 * Math.PI / 8.5, 2 * Math.PI / 6]; // where the long band hands over to the short (k, rad/m)
// (W5) The finest waves (GPU, Ocean: Full): from about 60 cm down to 5 cm, close by. A patch 3.17 m
// across, an odd size against the short one's so the two never line up; the short band hands
// over to it between 75 and 50 cm.
export const FINE = { N: 128, L: 3.17 };
export const CUT2 = [2 * Math.PI / 0.75, 2 * Math.PI / 0.5];
// (W5) Surface tension over density, sea water (m³/s²): at a few centimetres it stiffens the
// surface, and the waves run faster than gravity alone would take them, ω² = g·k + (σ/ρ)·k³ (a
// 5 cm wave 6% faster). The long and short waves are far too long to feel it.
export const SURFACE_TENSION = 7.3e-5;
export const omegaOf = (k) => Math.sqrt(G * k + SURFACE_TENSION * k * k * k);
const COPY = { angle: 0.47, x: 37.3, z: 59.1 };   // the second copy of the long patch: turned and shifted
const STEP = 1 / 20;                               // seconds between worked-out moments (between them, blended)
const FOAM_FADE = 2.8;                             // seconds for foam to fade by e

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A seeded random source (so the same sea every time the game starts), and normal deviates.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r) {
  const u = Math.max(1e-12, r()), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

// The sea's spectrum: its energy at angular frequency w for a wind of u m/s (unnormalised
// JONSWAP, peak from the fetch), and how it spreads round the wind's direction.
const FETCH = 12000;
export const peakFrequency = (u) => 22 * Math.cbrt((G * G) / (Math.max(u, 1.5) * FETCH));
function jonswap(w, wp) {
  if (w <= 0) return 0;
  const sg = w <= wp ? 0.07 : 0.09;
  const r = Math.exp(-((w - wp) ** 2) / (2 * sg * sg * wp * wp));
  return w ** -5 * Math.exp(-1.25 * (wp / w) ** 4) * 3.3 ** r;
}
// (Its whole energy, for normalising: the integral over frequency.)
function jonswapTotal(wp) {
  let m = 0;
  const w0 = wp * 0.35, w1 = wp * 14, n = 600, dw = (w1 - w0) / n;
  for (let i = 0; i < n; i++) m += jonswap(w0 + (i + 0.5) * dw, wp) * dw;
  return m;
}
// (W5) How it spreads round the wind, by each wave's frequency against the peak's: Donelan, Hamilton
// and Hui's (1985) measured spreading, sech²(β·θ), as Horvath ("Empirical directional wave spectra
// for computer graphics", 2015) recommends it for drawing the sea. Narrowest at the spectrum's peak
// (β about 2.4: half its energy within ±21° of the wind), broadening for the waves either side
// of it, the short ones most (β 0.6 for waves four times the peak's frequency, a little of them
// running even against the wind, as measured). Before, cos⁴ for every wave (±33°).
export function spreadBeta(r) {
  if (r < 0.95) return 2.61 * Math.max(r, 0.05) ** 1.3;
  if (r < 1.6) return 2.28 * r ** -1.3;
  return 10 ** (-0.4 + 0.8393 * Math.exp(-0.567 * Math.log(r * r)));
}
// Its share of the energy at angle d off the wind (rad, −π … π), for a wave at r = ω/ωp:
// normalised over the whole circle.
export function spread(d, r) {
  const b = spreadBeta(r), x = b * Math.atan2(Math.sin(d), Math.cos(d)), c = Math.cosh(Math.min(40, x));
  return b / (2 * Math.tanh(b * Math.PI) * c * c);
}

// The energy (m² per (rad/m)²) at wavenumber (kx, kz) for a wind of u m/s blowing towards
// angle `to` (world: 0 = +x... as atan2(z, x)), before normalising.
function spectrum2D(kx, kz, u, to) {
  const k = Math.hypot(kx, kz);
  if (k < 1e-6) return 0;
  const w = Math.sqrt(G * k), wp = peakFrequency(u);
  const sw = jonswap(w, wp), dwdk = G / (2 * w);
  return (sw * dwdk * spread(Math.atan2(kz, kx) - to, w / wp)) / k;
}

// (W5) Shallow water: the wind sea can't hold as much energy where the bottom's near. The TMA
// spectrum (Bouws, Günther, Rosenthal and Vincent 1985, from the Texel, Marsen and Arsloe
// measurements) is JONSWAP times Kitaigorodskii's depth factor Φ(ωh), ωh = ω·√(h/g): ½ωh² up to
// 1, then 1 − ½(2 − ωh)², 1 from 2. For each band, the share of its wave height left at a depth
// (√ of its energy's), for depths 0.25·i² m (i = 0 … TMA_N − 1, to about 30 m), worked out with
// its spectrum (Patch.setSpectrum) and read anywhere by tmaAt: the physics and the water shader
// alike (water.js tmaAt, the same interpolation).
export const TMA_N = 12;
export const tmaDepth = (i) => 0.25 * i * i;
export function kitaigorodskii(w, h) {
  const x = w * Math.sqrt(Math.max(0, h) / G);
  return x <= 1 ? 0.5 * x * x : x < 2 ? 1 - 0.5 * (2 - x) ** 2 : 1;
}
// (A band's table at depth h (m): piecewise linear in i = 2·√h, built up as the shader does it,
// a step at a time.)
export function tmaAt(table, h) {
  const fi = Math.min(TMA_N - 1, 2 * Math.sqrt(Math.max(0, h)));
  let r = table[0];
  for (let i = 0; i < TMA_N - 1; i++) r += (table[i + 1] - r) * Math.min(1, Math.max(0, fi - i));
  return r;
}

/* ---------------- the FFT ---------------- */

// An in-place radix-2 complex transform of every row and then every column of an N×N grid
// (the inverse: e^{+i k·x}, unscaled).
export function makeFFT(N) {
  const bits = Math.log2(N), rev = new Uint16Array(N), cs = new Float64Array(N / 2), sn = new Float64Array(N / 2);
  for (let i = 0; i < N; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < N / 2; i++) {
    cs[i] = Math.cos((TAU * i) / N);
    sn[i] = Math.sin((TAU * i) / N);
  }
  const line = (re, im, off, stride) => {
    for (let i = 0; i < N; i++) {
      const j = rev[i];
      if (j > i) {
        const a = off + i * stride, b = off + j * stride;
        let t = re[a]; re[a] = re[b]; re[b] = t;
        t = im[a]; im[a] = im[b]; im[b] = t;
      }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1, step = N / size;
      for (let s = 0; s < N; s += size) {
        for (let k = 0; k < half; k++) {
          const a = off + (s + k) * stride, b = a + half * stride, wr = cs[k * step], wi = sn[k * step];
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
  };
  return (re, im) => {
    for (let r = 0; r < N; r++) line(re, im, r * N, 1);
    for (let c = 0; c < N; c++) line(re, im, c, N);
  };
}

/* ---------------- a patch of sea ---------------- */

// A patch's wavenumbers, its fixed random draw, and (setSpectrum) each wave's amplitude.
// band: (k) => share of the spectrum this patch carries (the long patch tapers out where the
// short one tapers in).
export class Patch {
  constructor(N, L, seed, band) {
    this.N = N;
    this.L = L;
    this.band = band;
    const n = N * N;
    this.kx = new Float32Array(n);
    this.kz = new Float32Array(n);
    this.w = new Float32Array(n);
    this.mirror = new Uint32Array(n);
    this.xr = new Float32Array(n);
    this.xi = new Float32Array(n);
    this.amp = new Float32Array(n);
    const r = rng(seed);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const q = j * N + i, mi = i < N / 2 ? i : i - N, mj = j < N / 2 ? j : j - N;
        this.kx[q] = (TAU * mi) / L;
        this.kz[q] = (TAU * mj) / L;
        this.w[q] = Math.sqrt(G * Math.hypot(this.kx[q], this.kz[q]));
        this.mirror[q] = ((N - j) % N) * N + ((N - i) % N);
        this.xr[q] = gauss(r);
        this.xi[q] = gauss(r);
      }
    }
    // (And each wave's direction, a unit vector along its k: the same every moment, so worked
    // out once here rather than for every wave of every moment.)
    this.ux = new Float64Array(n);
    this.uz = new Float64Array(n);
    for (let q = 0; q < n; q++) {
      const kx = this.kx[q], kz = this.kz[q], k = Math.hypot(kx, kz) || 1;
      this.ux[q] = kx / k;
      this.uz[q] = kz / k;
    }
    this.key = '';
    // (W5) Its waves' height left by depth (see tmaAt): all of it till a spectrum's set.
    this.tma = new Float32Array(TMA_N).fill(1);
  }

  // Each wave's amplitude for a wind of u m/s blowing towards `to`, the whole wind sea (both
  // bands) carrying energy m0 (m²: (Hs/4)²). Nothing changes suddenly: the same draw, rescaled.
  setSpectrum(u, to, m0) {
    const key = `${u.toFixed(2)}|${to.toFixed(3)}|${m0.toFixed(5)}`;
    if (key === this.key) return false;
    this.key = key;
    const N = this.N, dk = TAU / this.L, norm = m0 / jonswapTotal(peakFrequency(u));
    let m0b = 0, m1b = 0, m2b = 0;
    const tm = (this._tm ||= new Float64Array(TMA_N)).fill(0);
    for (let q = 0; q < N * N; q++) {
      const kx = this.kx[q], kz = this.kz[q], k = Math.hypot(kx, kz);
      const i = q % N, j = (q / N) | 0;
      // (No mean level, and nothing at the grid's own limit, which has no partner.)
      if (k < 1e-6 || i === N / 2 || j === N / 2) {
        this.amp[q] = 0;
        continue;
      }
      const P = Math.max(0, spectrum2D(kx, kz, u, to) * dk * dk * norm * this.band(k));
      this.amp[q] = Math.sqrt(P / 2);
      m0b += P; m1b += P * k; m2b += P * k * k;
      for (let d = 0; d < TMA_N; d++) tm[d] += P * kitaigorodskii(this.w[q], tmaDepth(d));
    }
    for (let d = 0; d < TMA_N; d++) this.tma[d] = m0b > 0 ? Math.sqrt(tm[d] / m0b) : 1;
    // (B2) The band's height variance and its first two moments in wavenumber: how fast, on
    // average, its rise and fall and its orbital motion die away below the surface (see
    // conditions.js waveSampler).
    this.m = [m0b, m1b, m2b];
    return true;
  }
}

/* ---------------- the long waves, worked out here ---------------- */

// One worked-out moment of the long patch: height, displacement, slopes, rate of rise and the
// water's horizontal motion on the grid, and the foam.
function frame(n) {
  return { t: -1e9, h: new Float32Array(n), dx: new Float32Array(n), dz: new Float32Array(n), hx: new Float32Array(n), hz: new Float32Array(n), ht: new Float32Array(n), ux: new Float32Array(n), uz: new Float32Array(n) };
}

export class LongSea {
  constructor() {
    const { N, L } = PATCH;
    this.N = N;
    this.L = L;
    this.patch = new Patch(N, L, 20251104, (k) => 1 - smooth(CUT[0], CUT[1], k));
    this.fft = makeFFT(N);
    const n = N * N;
    this.re = [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)];
    this.im = [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)];
    // (A few worked-out moments kept: every boat's physics steps back over the last frame's
    // fraction of a second, so the moments either side of it are wanted again and again.)
    this.cache = Array.from({ length: 6 }, () => frame(n));
    this.a = this.cache[0];
    this.b = this.cache[1];
    this.latest = -1e9;
    this.specT = -1e9;
    this.foam = new Float32Array(n);
    this.foamT = -1e9;
    this.choppy = 0.8;   // how far the to-and-fro carries the crests along (1: fully, as Tessendorf)
    this.wind = { u: 3, to: 0, m0: 0.0004 };
    this.empty = true;
    // Blended for the moment asked: what the GPU is sent each frame (h, dx, dz, foam | hx, hz).
    this.tex0 = new Float32Array(n * 4);
    this.tex1 = new Float32Array(n * 4);
    const c = Math.cos(COPY.angle), s = Math.sin(COPY.angle);
    this.copy = { c, s, x: COPY.x, z: COPY.z };
  }

  // (W5) The long waves' height left by depth (Patch.tma), for this sea: worked out with its
  // spectrum, which follows the wind a second at a time (compute); set here the first time it's
  // asked for, before any moment has been worked out.
  get tma() {
    if (!this.patch.key) this.patch.setSpectrum(this.wind.u, this.wind.to, this.wind.m0);
    return this.patch.tma;
  }

  // The conditions that shape the sea (from conditions.js each step).
  setWind(u, to, m0, choppy) {
    this.wind.u = u;
    this.wind.to = to;
    this.wind.m0 = m0;
    this.choppy = choppy;
  }

  // Work out the moment t into frame f.
  compute(f, t) {
    const P = this.patch, N = this.N, n = N * N;
    // (The spectrum follows the wind a second at a time: the sea changes far more slowly than
    // that, and between, the moments already worked out stay good.)
    if (!(t <= this.specT + 1 && t >= this.specT - 1) || !P.key) {
      P.setSpectrum(this.wind.u, this.wind.to, this.wind.m0);
      this.specT = t;
    }
    this.empty = this.wind.m0 < 1e-9;
    const [r1, r2, r3, r4] = this.re, [i1, i2, i3, i4] = this.im;
    for (let q = 0; q < n; q++) {
      const a = P.amp[q], m = P.mirror[q], am = P.amp[m];
      if (a === 0 && am === 0) {
        r1[q] = i1[q] = r2[q] = i2[q] = r3[q] = i3[q] = r4[q] = i4[q] = 0;
        continue;
      }
      const w = P.w[q], c = Math.cos(w * t), s = -Math.sin(w * t);
      // h0(k) e^{−iωt} and conj(h0(−k)) e^{+iωt} (so each wave runs along its k)
      const ar = (a * P.xr[q]) / Math.SQRT2, ai = (a * P.xi[q]) / Math.SQRT2;
      const br = (am * P.xr[m]) / Math.SQRT2, bi = -(am * P.xi[m]) / Math.SQRT2;
      const e1r = ar * c - ai * s, e1i = ar * s + ai * c;
      const e2r = br * c + bi * s, e2i = bi * c - br * s;
      const hr = e1r + e2r, hi = e1i + e2i;              // ĥ
      const tr = w * (e1i - e2i), ti = -w * (e1r - e2r); // ∂ĥ/∂t
      const kx = P.kx[q], kz = P.kz[q], ux = P.ux[q], uz = P.uz[q];
      // Real fields two at a time: transform of A + iB comes out A + iB.
      // F1 = h + i·Dx   (Dx = −i k̂x ĥ)
      const dxr = ux * hi, dxi = -ux * hr, dzr = uz * hi, dzi = -uz * hr;
      r1[q] = hr - dxi;
      i1[q] = hi + dxr;
      // F2 = Dz + i·∂h/∂t
      r2[q] = dzr - ti;
      i2[q] = dzi + tr;
      // F3 = ∂h/∂x + i·∂h/∂z   (i kx ĥ, i kz ĥ)
      const sxr = -kx * hi, sxi = kx * hr, szr = -kz * hi, szi = kz * hr;
      r3[q] = sxr - szi;
      i3[q] = sxi + szr;
      // F4 = ∂Dx/∂t + i·∂Dz/∂t: the water's horizontal motion
      const vxr = ux * ti, vxi = -ux * tr, vzr = uz * ti, vzi = -uz * tr;
      r4[q] = vxr - vzi;
      i4[q] = vxi + vzr;
    }
    for (let p = 0; p < 4; p++) this.fft(this.re[p], this.im[p]);
    for (let q = 0; q < n; q++) {
      f.h[q] = r1[q];
      f.dx[q] = i1[q];
      f.dz[q] = r2[q];
      f.ht[q] = i2[q];
      f.hx[q] = r3[q];
      f.hz[q] = i3[q];
      f.ux[q] = r4[q];
      f.uz[q] = i4[q];
    }
    f.t = t;
  }

  // Make sure the two worked-out moments either side of t are ready; returns the blend (0 … 1).
  at(t) {
    const i0 = Math.floor(t / STEP), t0 = i0 * STEP, t1 = t0 + STEP;
    if (this.a.t !== t0 || this.b.t !== t1 || this.dirty) {
      this.dirty = false;
      this.a = this.moment(t0, this.b);
      this.b = this.moment(t1, this.a);
      // (Foam builds and fades going forward in time only.)
      if (t0 > this.latest) {
        this.latest = t0;
        this.ageFoam(t0);
      }
    }
    return Math.min(1, Math.max(0, (t - t0) / STEP));
  }

  // The worked-out moment at time tm from the cache, working it out if it isn't there (into the
  // stalest slot, never the one in use).
  moment(tm, keep) {
    let worst = null;
    for (const f of this.cache) {
      if (f.t === tm && f.key === this.patch.key) return f;
      if (f === keep) continue;
      if (!worst || Math.abs(f.t - tm) > Math.abs(worst.t - tm)) worst = f;
    }
    this.compute(worst, tm);
    worst.key = this.patch.key;
    return worst;
  }

  // Foam: the crests break where they're pinched tightest (the surface's Jacobian lowest), on as
  // much of the sea as a sea breaks at in this wind (Monahan and O'Muircheartaigh's measured
  // whitecap cover: about 1% at 10 m/s, 4% at 15, 10% at 20, none in light air); and everywhere
  // it fades over a few seconds, so each cap leaves a fading patch behind it.
  ageFoam(t) {
    const dt = t - this.foamT;
    this.foamT = t;
    if (!(dt > 0) || dt > 5) {
      this.foam.fill(0);
      if (dt > 5 || !(dt > 0)) return;
    }
    // (Each copy of the patch carries half the sea: its pinch counted at that.)
    const N = this.N, f = this.a, cell = this.L / N, lam = this.choppy / Math.SQRT2, fade = Math.exp(-dt / FOAM_FADE);
    const J = this._J || (this._J = new Float32Array(N * N));
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < N; j++) {
      const jp = ((j + 1) % N) * N, jm = ((j + N - 1) % N) * N, jr = j * N;
      for (let i = 0; i < N; i++) {
        const ip = (i + 1) % N, im = (i + N - 1) % N;
        const dxx = (f.dx[jr + ip] - f.dx[jr + im]) / (2 * cell), dzz = (f.dz[jp + i] - f.dz[jm + i]) / (2 * cell);
        const dxz = (f.dx[jp + i] - f.dx[jm + i]) / (2 * cell);
        const v = (1 + lam * dxx) * (1 + lam * dzz) - lam * lam * dxz * dxz;
        J[jr + i] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    // (The pinch that this share of the sea is tighter than: from a histogram of it.)
    const u = this.wind.u, share = Math.min(0.25, 3.84e-6 * u ** 3.41) * 0.5;
    let th = -Infinity;
    if (share > 1e-4 && hi > lo) {
      const B = 128, hist = this._hist || (this._hist = new Uint32Array(B));
      hist.fill(0);
      for (let q = 0; q < N * N; q++) hist[Math.min(B - 1, Math.floor(((J[q] - lo) / (hi - lo)) * B))]++;
      let acc = 0, b = 0;
      const want = share * N * N;
      for (; b < B && acc + hist[b] < want; b++) acc += hist[b];
      th = lo + ((b + (want - acc) / Math.max(1, hist[b])) / B) * (hi - lo);
    }
    // (Too light a wind for whitecaps, or nothing to go by: what foam there is fades, and none is
    // added. This used to leave the pinch at minus infinity, and the smoothing then made every
    // cell's foam "not a number", which no fading ever clears: from the first light air on, no
    // whitecap was ever drawn again, whatever the wind did.)
    if (!Number.isFinite(th)) {
      for (let q = 0; q < N * N; q++) {
        const old = this.foam[q] * fade;
        this.foam[q] = old > 0 ? old : 0;
      }
      return;
    }
    const soft = Math.max(0.02, (hi - lo) * 0.04);
    for (let q = 0; q < N * N; q++) {
      // (And a cell whose foam has gone wrong takes the new value, rather than keeping it wrong.)
      const old = this.foam[q] * fade, now = smooth(th + soft, th - soft, J[q]);
      this.foam[q] = old > now ? old : now > 0 ? now : 0;
    }
  }

  // The blended fields for the GPU at time t: tex0 (h, dx, dz, foam), tex1 (hx, hz, 0, 0).
  fill(t) {
    const k = this.at(t), A = this.a, B = this.b, n = this.N * this.N, T0 = this.tex0, T1 = this.tex1;
    for (let q = 0; q < n; q++) {
      T0[q * 4] = A.h[q] + (B.h[q] - A.h[q]) * k;
      T0[q * 4 + 1] = A.dx[q] + (B.dx[q] - A.dx[q]) * k;
      T0[q * 4 + 2] = A.dz[q] + (B.dz[q] - A.dz[q]) * k;
      T0[q * 4 + 3] = this.foam[q];
      T1[q * 4] = A.hx[q] + (B.hx[q] - A.hx[q]) * k;
      T1[q * 4 + 1] = A.hz[q] + (B.hz[q] - A.hz[q]) * k;
    }
  }

  // The grid points and Catmull-Rom weights round a point of the patch (tile coordinates, metres).
  stencil(px, pz) {
    const N = this.N, cell = this.L / N;
    const gx = px / cell, gz = pz / cell, ix = Math.floor(gx), iz = Math.floor(gz);
    cr(gx - ix, _wx);
    cr(gz - iz, _wz);
    let n = 0;
    for (let b = 0; b < 4; b++) {
      const row = ((((iz - 1 + b) % N) + N) % N) * N;
      for (let a = 0; a < 4; a++, n++) {
        _sq[n] = row + ((((ix - 1 + a) % N) + N) % N);
        _sw[n] = _wx[a] * _wz[b];
      }
    }
  }

  // One field at the stencil, blended in time (k).
  field(key, k) {
    const A = this.a[key], B = this.b[key];
    let v = 0;
    for (let n = 0; n < 16; n++) {
      const q = _sq[n], va = A[q];
      v += (va + (B[q] - va) * k) * _sw[n];
    }
    return v;
  }

  // The surface at world (x, z), time t, scaled by s (the wind sea's share here: shelter, the
  // shore): out { h, vy, vx, vz }, added to. Both copies of the patch; each point of the surface
  // found where the to-and-fro has carried it (a step of fixed-point iteration).
  add(x, z, t, s, out) {
    if (s <= 0 || this.wind.m0 < 1e-9) return out;
    const k = this.at(t), C = this.copy, f = 1 / Math.SQRT2, lam = this.choppy * s * f;
    for (let copy = 0; copy < 2; copy++) {
      // (Into the copy's own frame.)
      let px = x, pz = z;
      if (copy) {
        const ux = x - C.x, uz = z - C.z;
        px = ux * C.c + uz * C.s;
        pz = -ux * C.s + uz * C.c;
      }
      this.stencil(px, pz);
      this.stencil(px - lam * this.field('dx', k), pz - lam * this.field('dz', k));
      out.h += s * f * this.field('h', k);
      out.vy += s * f * this.field('ht', k);
      // (The horizontal motion back into the world's frame.)
      const vx = s * f * this.field('ux', k), vz = s * f * this.field('uz', k);
      if (copy) {
        out.vx += vx * C.c - vz * C.s;
        out.vz += vx * C.s + vz * C.c;
      } else {
        out.vx += vx;
        out.vz += vz;
      }
    }
    return out;
  }
}
const _sq = new Int32Array(16), _sw = new Float64Array(16);
const _wx = new Float64Array(4), _wz = new Float64Array(4);
// Catmull-Rom weights for the four grid points round a fraction f.
function cr(f, w) {
  const f2 = f * f, f3 = f2 * f;
  w[0] = -0.5 * f3 + f2 - 0.5 * f;
  w[1] = 1.5 * f3 - 2.5 * f2 + 1;
  w[2] = -1.5 * f3 + 2 * f2 + 0.5 * f;
  w[3] = 0.5 * f3 - 0.5 * f2;
  return w;
}

export const longSea = new LongSea();
export const SEA_COPY = COPY;

// The short waves' spectrum, for the GPU patch: each wave's amplitude and fixed draw, packed for
// a texture (r, i of h0(k); r, i of conj h0(−k)), and the wavenumbers.
export class ShortSpectrum {
  // (W5) Any of the GPU's bands: the short waves by default, or (FineSpectrum) the finest. The
  // short ones now hand over to the finest below 75 cm.
  constructor(size = SHORT, seed = 777, band = (k) => smooth(CUT[0], CUT[1], k) * (1 - smooth(CUT2[0], CUT2[1], k))) {
    this.size = size;
    this.patch = new Patch(size.N, size.L, seed, band);
    this.data = new Float32Array(size.N * size.N * 4);
  }

  // Returns true when the amplitudes changed (and data was refilled).
  update(u, to, m0) {
    const P = this.patch;
    if (!P.setSpectrum(u, to, m0)) return false;
    const n = this.size.N * this.size.N, d = this.data;
    for (let q = 0; q < n; q++) {
      const m = P.mirror[q], a = P.amp[q] / Math.SQRT2, am = P.amp[m] / Math.SQRT2;
      d[q * 4] = a * P.xr[q];
      d[q * 4 + 1] = a * P.xi[q];
      d[q * 4 + 2] = am * P.xr[m];
      d[q * 4 + 3] = -am * P.xi[m];
    }
    return true;
  }
}

// (W5) Ripples are raised by the wind's stress on the water, and in light air viscosity smooths
// them away: Elfouhaily, Chapron, Katsaros and Vandemark's (1997) unified spectrum puts the
// capillary-gravity range's level at α_m = 0.01·(1 + ln(u*/c_m)) below u* = c_m, c_m = 0.23 m/s
// (the slowest a ripple runs), u* the wind's friction velocity (√Cd·U, Cd 1.2·10⁻³ in a light
// wind). As a share of its full level: none in a wind under about 2.4 m/s, a fifth at 3, all of it
// from about 6.6. (JONSWAP's tail carried on down to centimetres would keep them in a calm.)
export const RIPPLE_C = 0.23;
export const rippleShare = (u) => Math.min(1, Math.max(0, 1 + Math.log(Math.max(1e-9, Math.sqrt(1.2e-3) * u) / RIPPLE_C)));

// (W5) The finest waves' spectrum, for the GPU: JONSWAP's tail, as the wind raises it.
export class FineSpectrum extends ShortSpectrum {
  constructor() {
    super(FINE, 4242, (k) => smooth(CUT2[0], CUT2[1], k));
  }

  update(u, to, m0) {
    return super.update(u, to, m0 * rippleShare(u));
  }
}

// (W5) The share of the sea's whole mean square slope (Cox and Munk's, for this wind: up + across)
// that each band draws, from its own spectrum (Patch.m[2] = Σ k²·E): what the glitter's spread
// leaves out is the rest.
export const slopeShare = (patch, cm) => (cm > 0 && patch?.m ? patch.m[2] / cm : 0);

// A patch's energy (m²) in bands of wavelength between `edges` (metres, rising): what each band
// of the sea carries on average.
export function bandEnergy(patch, edges, out = new Array(edges.length - 1).fill(0)) {
  for (let q = 0; q < patch.amp.length; q++) {
    const a = patch.amp[q];
    if (!a) continue;
    const len = TAU / Math.hypot(patch.kx[q], patch.kz[q]);
    for (let b = 0; b < edges.length - 1; b++) {
      if (len >= edges[b] && len < edges[b + 1]) {
        out[b] += a * a;
        break;
      }
    }
  }
  return out;
}
