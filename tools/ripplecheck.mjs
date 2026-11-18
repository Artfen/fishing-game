// (W7) The simulated rings on the graphics card against the reference they're built from
// (src/world/ripplesim.js): the same ring, the same quay wall, pier on posts and boat, the square
// moved part way,
// stepped on both; their heights should agree to float rounding. And the walls the graphics card
// makes: the quay, a boat's hull, the shore.
//
//   python3 -m http.server 8676 &
//   PLAYWRIGHT=/path/to/playwright node tools/ripplecheck.mjs [url=http://127.0.0.1:8676/]
//
// Software rendering (swiftshader) here: this checks the sums, not the speed.
const PW = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = PW.chromium ? PW : PW.default;
const URL0 = process.argv[2] || 'http://127.0.0.1:8676/';
const br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await br.newContext()).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(new URL('README.md', URL0).href);
const out = await page.evaluate(async () => {
  const map = document.createElement('script');
  map.type = 'importmap';
  map.textContent = JSON.stringify({ imports: { three: '/vendor/three/three.module.min.js' } });
  document.head.append(map);
  const THREE = await import('three');
  const R = await import('/src/world/ripplesim.js');
  const { RippleSim } = await import('/src/world/ripplegpu.js');
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
  // Deep water everywhere but the shore north of z = 8, the map's way:
  // r the ground's height, g fresh water. 64 texels over 64 m, from (-32, -32).
  const M = 64, data = new Float32Array(M * M * 4);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) data[(j * M + i) * 4] = j >= 40 ? 1.5 : -10;
  const tex = new THREE.DataTexture(data, M, M, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  const far = new THREE.Vector4(1e5, 1e5, 1, 1);
  const uniforms = { uHeight: { value: tex }, uRect: { value: new THREE.Vector4(-32, -32, 64, 64) }, uHeight2: { value: tex }, uRect2: { value: far } };
  const N = 160, DX = 0.15, SPAN = N * DX;
  // (Their faces between cells' middles, so float rounding can't put a cell either side.)
  const quay = { x0: 3.07, x1: 5.57, z0: -12.03, z1: 6.03 };
  // And a timber pier on posts south of the start, running east–west: the water runs under it.
  const pier = { x0: -9.03, x1: 1.53, z0: -5.97, z1: -4.07, posts: { first: 0.6, step: 2.2, inset: 0.1, r: 0.13 } };
  const onPost = (px, pz, r, q) => {
    const alongX = r.x1 - r.x0 > r.z1 - r.z0, len = alongX ? r.x1 - r.x0 : r.z1 - r.z0, w = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
    const u = alongX ? px - r.x0 : pz - r.z0, v = Math.abs(alongX ? pz - (r.z0 + r.z1) / 2 : px - (r.x0 + r.x1) / 2) - (w / 2 - q.inset);
    const k = Math.min(Math.max(Math.floor((u - q.first) / q.step + 0.5), 0), Math.floor((len - q.first) / q.step));
    const du = u - (q.first + k * q.step);
    return du * du + v * v < q.r * q.r;
  };
  const sim = new RippleSim(uniforms, { value: 0 }, { N, SPAN, piers: [quay, pier] });
  if (!sim.setOn(true, renderer)) return { error: 'no float targets' };
  const S = sim.s;
  // A boat lying north–south west of the start.
  const H = { L: 4.5, B: 1.8, hw: (t) => 0.5 * Math.sin(Math.PI * Math.min(1, 0.15 + t)) };
  const boat = { pos: { x: -4, z: -1 }, fwd: { x: 0.6, z: 0.8 }, hull: H };
  let cx = 0.3, cz = 0.2;
  sim.update(renderer, cx, cz, [boat]); // (starts it)
  const step = () => {
    sim.pending = S.DT;
    sim.update(renderer, cx, cz, [boat]);
  };
  // The CPU's square: the same cells, walls and ring.
  const x0 = () => sim.i0 * sim.dx, z0 = () => sim.j0 * sim.dx;
  const hullAt = (px, pz) => {
    const w = H._rippleHalf, f = boat.fwd, dx = px - boat.pos.x, dz = pz - boat.pos.z;
    const t = (dx * f.x + dz * f.z) / H.L + 0.5;
    if (!(t > 0 && t < 1)) return false;
    const T = [0.02, 0.2, 0.4, 0.6, 0.8, 0.98];
    let half;
    if (t < T[0]) half = (w[0] * t) / T[0];
    else if (t >= T[5]) half = (w[5] * (1 - t)) / (1 - T[5]);
    else for (let k = 1; k < 6; k++) if (t < T[k]) { half = w[k - 1] + ((w[k] - w[k - 1]) * (t - T[k - 1])) / (T[k] - T[k - 1]); break; }
    return Math.abs(f.x * dz - f.z * dx) < half;
  };
  const walls = () => {
    const w = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const px = x0() + i * DX, pz = z0() + j * DX;
      if (px > quay.x0 && px < quay.x1 && pz > quay.z0 && pz < quay.z1) w[j * N + i] = 1;
      else if (onPost(px, pz, pier, pier.posts)) w[j * N + i] = 1;
      else if (hullAt(px, pz)) w[j * N + i] = 1;
      else if (pz > 8) w[j * N + i] = 1; // (the shore)
    }
    return w;
  };
  // The mask the card made, against the CPU's: away from the shore's edge they should match.
  const readMask = () => {
    const px = new Uint8Array(N * N * 4);
    renderer.readRenderTargetPixels(sim.mask, 0, 0, N, N, px);
    return px;
  };
  const S0 = { ...R.SIM, ...S };
  const cpu = { h0: new Float32Array(N * N), h1: new Float32Array(N * N), t: new Float32Array(N * N) };
  const ring = { x: 0.8, z: -0.4, h: R.ringBump(1.7, 0.5, S) };
  sim.bumps.push(ring);
  R.bump(cpu.h0, cpu.h1, N, DX, ring.x - x0(), ring.z - z0(), S.BUMP, ring.h);
  const res = { steps: [], mask: [], posts: 0 };
  let wall = null;
  for (let k = 1; k <= 900; k++) {
    if (k === 300) {
      // The square moves 7 cells east, 4 north.
      cx += 7 * DX;
      cz += 4 * DX;
      const di = Math.round((cx - SPAN / 2) / DX) - sim.i0, dj = Math.round((cz - SPAN / 2) / DX) - sim.j0;
      R.scroll(cpu.h0, N, di, dj);
      R.scroll(cpu.h1, N, di, dj);
      wall = null;
    }
    step();
    if (!wall) {
      wall = walls();
      const m = readMask();
      let diff = 0, near = 0, solid = 0;
      const where = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const pz = z0() + j * DX;
        if (Math.abs(pz - 8) < 0.2) { near++; continue; } // (right on the shore's edge, either side by rounding)
        const g = m[(j * N + i) * 4] > 127 ? 0 : 1;
        if (g !== wall[j * N + i]) {
          diff++;
          if (where.length < 6) where.push([i, j, g, +(x0() + i * DX).toFixed(3), +(z0() + j * DX).toFixed(3)]);
        }
        solid += g;
        if (onPost(x0() + i * DX, pz, pier, pier.posts)) res.posts++;
      }
      res.mask.push({ diff, solid, skipped: near, where });
      // (Then step the CPU's on the card's walls, so a cell on a hull's edge, put either side by
      // float rounding, doesn't count against the steps.)
      for (let q = 0; q < N * N; q++) wall[q] = m[q * 4] > 127 ? 0 : 1;
    }
    R.step(cpu.h0, cpu.h1, cpu.t, wall, N, DX, S.DT, S.C, S0);
    [cpu.h0, cpu.h1, cpu.t] = [cpu.h1, cpu.t, cpu.h0];
    if (k % 150 === 0) {
      const g = sim.read(renderer).h;
      let worst = 0, top = 0;
      for (let q = 0; q < N * N; q++) {
        worst = Math.max(worst, Math.abs(g[q] - cpu.h1[q]));
        top = Math.max(top, Math.abs(cpu.h1[q]));
      }
      res.steps.push({ k, worst, top, rel: worst / top });
    }
  }
  res.float = renderer.extensions.has('EXT_color_buffer_float');
  return res;
});
console.log(JSON.stringify(out, null, 1));
console.log('errors:', errs.length ? errs : 'none');
await br.close();
