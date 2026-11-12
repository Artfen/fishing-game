// The benchmark: the same scenarios, set up the same way every time, measured the same way, for
// two harnesses:
//  · tools/perf.mjs: a headless browser on a development machine (software rendering there: the
//    simulation's cost carries over, the frame rate doesn't), before and after each change;
//  · bench.html: your own browser on your own computer and graphics card, the numbers that matter
//    (docs/PERFORMANCE.md). It runs the game with ?bench=<scenario> in a save of its own, so it
//    never reads or writes yours, and never signs in.
//
// Each scenario: what it is, the save it starts from (its data: see benchSave), a setup run in the
// game once it has started (the global slowTide, the game's own handle), and anything after it.
// (The setups are self-contained functions, no closures: tools/perf.mjs hands them to the page.)

const TIPS = { rowed: true, cast: true, caught: true, journal: true, ashore: true, style: true, pack: true, walked: true, board: true, havenTip: true };

// A save to start a scenario from, at a graphics preset.
export function benchSave(over = {}, preset = 'low') {
  const settings = { player: { name: 'Bench' }, graphics: { preset }, ...(over.settings || {}) };
  return { quality: preset, vessel: 'row', mode: 'boat', day: 13, tips: TIPS, places: { camp: { day: 1, hour: 10 } }, ...over, settings };
}

export const BENCH_SCENARIOS = {
  harbour: {
    label: 'Willowhaven harbour, on foot',
    save: { mode: 'foot', walker: { x: 6, z: -96, heading: Math.PI } },
    setup: () => { slowTide.setHour(10.5); slowTide.walkTo(6, -96, Math.PI); },
  },
  harbour_off: {
    label: 'Off Willowhaven, its boats a hundred metres away',
    save: {},
    setup: () => { slowTide.setHour(10.5); slowTide.useSkiffAt(30, 20, Math.PI, 'skiff'); },
  },
  rib_rough: {
    label: 'The RIB flat out in a lively sea',
    save: { settings: { weather: { sea: 'lively', windMode: 'manual', windSpeed: 11, windFrom: 225 } } },
    setup: () => { slowTide.state.yard.owned.push('rib'); slowTide.setHour(12); slowTide.useSkiffAt(150, 420, 0.3, 'rib'); slowTide.boat.lever = 1; },
  },
  storm: {
    label: 'A storm: the RIB in the gale off the Calf',
    save: { settings: { weather: { sea: 'rough', windMode: 'manual', windSpeed: 20, windFrom: 225 } } },
    setup: () => { slowTide.state.yard.owned.push('rib'); slowTide.setWeather('storm'); slowTide.setHour(15); slowTide.useSkiffAt(-60, 120, 0.4, 'rib'); slowTide.boat.lever = 0.6; },
  },
  shoal: {
    label: 'Beside the biggest school of fish',
    save: {},
    setup: () => {
      slowTide.setHour(9);
      const S = slowTide.eco.schools.filter((s) => s.members?.length).sort((a, b) => b.members.length - a.members.length)[0];
      slowTide.useSkiffAt((S?.x ?? 60) + 12, (S?.z ?? 160) + 12, 0, 'skiff');
    },
  },
  wildlife: {
    label: 'Near a dolphin pod, in the RIB',
    save: {},
    setup: () => {
      slowTide.state.yard.owned.push('rib');
      slowTide.setHour(11);
      const p = slowTide.sealife.pods.find((q) => q.sea === 'home') || { x: 200, z: 600 };
      slowTide.useSkiffAt(p.x + 25, p.z + 25, 0, 'rib');
    },
  },
  sonar: {
    label: 'Fishing with the sonar: the RIB’s electronics in first person',
    save: {},
    setup: () => { slowTide.state.yard.owned.push('rib'); slowTide.setHour(11); slowTide.useSkiffAt(60, 160, 0, 'rib'); slowTide.firstPerson(true); if (slowTide.finder && !slowTide.finder.visible) slowTide.finder.toggle?.(); },
  },
  underwater: {
    label: 'Diving the wreck',
    save: {},
    setup: () => { slowTide.setHour(12); slowTide.useSkiffAt(98, 82, 0, 'skiff'); slowTide.boat.setAnchor(true); },
    after: () => slowTide.diving.start('scuba'),
  },
  dive_reef: {
    label: 'Diving Skerries Reef',
    save: {},
    setup: () => { slowTide.setHour(12); slowTide.useSkiffAt(-122, 371, 0, 'skiff'); slowTide.boat.setAnchor(true); },
    after: () => slowTide.diving.start('scuba'),
  },
  dive_brasas: {
    label: 'Diving the arches at Las Brasas',
    save: {},
    setup: () => { slowTide.setHour(12); slowTide.useSkiffAt(-446, 6522, 0, 'skiff'); slowTide.boat.setAnchor(true); },
    after: () => slowTide.diving.start('scuba'),
  },
  voyage: {
    label: 'The crossing south, under way at the helm',
    save: {},
    setup: () => { slowTide.state.yard.owned.push('cruiser'); slowTide.setHour(9); slowTide.useSkiffAt(150, 420, 0.4, 'cruiser'); slowTide.cross('south'); slowTide.boat.lever = 1; },
  },
};

// (The worst p of a list: 0.99 the 1% low's frame time.)
const pct = (xs, p) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fix = (v, n = 2) => (Number.isFinite(v) ? +v.toFixed(n) : null);

// What computer this is (graphics card and browser): for your own record; nothing is sent anywhere.
export function benchDevice(renderer) {
  const gl = renderer?.getContext?.(), dbg = gl?.getExtension?.('WEBGL_debug_renderer_info');
  return {
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl?.getParameter?.(gl.RENDERER) || 'unknown',
    browser: globalThis.navigator?.userAgent || '',
    screen: globalThis.screen ? `${screen.width}×${screen.height}` : '',
    window: globalThis.innerWidth ? `${innerWidth}×${innerHeight}` : '',
    pixelRatio: globalThis.devicePixelRatio || 1,
    cores: globalThis.navigator?.hardwareConcurrency || null,
  };
}

// Measure the scenario now running (in the page: the game started, paused, set up): the
// simulation alone; a frame's draw calls; real frames running free for `seconds`, and on until
// there are at least `minFrames` of them (a slow machine: up to `maxSeconds`), the first few
// dropped as it warms up (and the graphics card's own time on them, where the browser lets us
// ask); the heap. G: the game's handle (slowTide).
export async function benchMeasure(G, { seconds = 6, minFrames = 30, maxSeconds = 45, simFrames = 240 } = {}) {
  const sim = [];
  for (let i = 0; i < simFrames; i++) {
    const t0 = performance.now();
    G.advance(1 / 30, 30, false);
    sim.push(performance.now() - t0);
  }
  const R = G.renderer;
  R.info.autoReset = false;
  R.info.reset();
  G.advance(1 / 30, 30, true);
  const info = { calls: R.info.render.calls, tris: R.info.render.triangles, geometries: R.info.memory.geometries, textures: R.info.memory.textures, programs: R.info.programs?.length || 0 };
  R.info.autoReset = true;
  // (The graphics card's time per frame: a timer query round each frame, where WebGL 2 has the
  // extension; null otherwise.)
  const gl = R.getContext(), timer = gl.getExtension?.('EXT_disjoint_timer_query_webgl2'), gpu = [];
  const frames = await new Promise((res) => {
    const xs = [], t0 = performance.now(), warm = 5;
    let last = performance.now(), q = null;
    G.paused = false;
    const step = (now) => {
      if (timer && q) {
        gl.endQuery(timer.TIME_ELAPSED_EXT);
        const done = q;
        setTimeout(() => {
          if (gl.getQueryParameter(done, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(timer.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(done, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(done);
        }, 200);
        q = null;
      }
      xs.push(now - last);
      last = now;
      const t = now - t0;
      if (t < maxSeconds * 1000 && (t < seconds * 1000 || xs.length < minFrames + warm)) {
        if (timer) {
          q = gl.createQuery();
          gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
        }
        requestAnimationFrame(step);
      } else {
        G.paused = true;
        res(xs.slice(Math.min(warm, Math.floor(xs.length / 6))));
      }
    };
    requestAnimationFrame(step);
  });
  await new Promise((r) => setTimeout(r, 300));
  const heap = globalThis.performance?.memory?.usedJSHeapSize || 0;
  return {
    fps: fix(1000 / mean(frames), 1), fps1Low: fix(1000 / pct(frames, 0.99), 1),
    frameMs: fix(mean(frames)), frameP99: fix(pct(frames, 0.99)), frames: frames.length,
    gpuMs: fix(mean(gpu)),
    simMs: fix(mean(sim)), simP99: fix(pct(sim, 0.99)),
    ...info, heapMB: heap ? fix(heap / 1048576, 1) : null,
  };
}

// In the game with ?bench=<name> (see main.js): start it, set the scenario up, let it settle,
// measure, keep the result (in this browser, under its own key), and go back to bench.html for
// the next. G: slowTide.
export async function benchRun(name, G) {
  const S = BENCH_SCENARIOS[name];
  const out = { name, label: S?.label || name, at: new Date().toISOString() };
  try {
    if (!S) throw new Error('no such scenario');
    document.getElementById('start-btn')?.click();
    G.paused = true;
    S.setup();
    G.advance(2, 30, false);
    if (S.after) {
      S.after();
      G.advance(2, 30, false);
    }
    G.advance(3, 30, true);
    Object.assign(out, await benchMeasure(G), { preset: G.settings?.graphics?.preset ?? null, device: benchDevice(G.renderer) });
  } catch (e) {
    out.error = String(e?.message || e);
  }
  try {
    const all = JSON.parse(localStorage.getItem('slow-tide-bench-results') || '{}');
    all[name] = out;
    localStorage.setItem('slow-tide-bench-results', JSON.stringify(all));
  } catch { /* nowhere to keep it */ }
  location.href = `bench.html?done=${encodeURIComponent(name)}`;
}
