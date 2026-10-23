// Fishes the real ecosystem (src/world/ecosystem.js) headless: a bait, lure or jig in a chosen
// spot, moved the way the game moves it, and reports which species come, how soon they bite,
// and what they took. For tuning and for checking that fish keep to their own waters.
//   node --import ./tests/setup.mjs tools/ecosim.mjs [scenario-name]
import { createHabitat } from '../src/world/habitat.js';
import { Ecosystem } from '../src/world/ecosystem.js';
import { heightAt, zoneAt } from '../src/world/terrain.js';
import { TACKLE } from '../src/tackle.js';

const habitat = createHabitat();
const STEP = 1 / 30;

// Run one scenario n times (fresh fish each time is costly, so the same world; fish recover).
export function fish(sc, { tries = 6, limit = 240 } = {}) {
  const eco = sc.eco || new Ecosystem(habitat);
  const results = [];
  for (let k = 0; k < tries; k++) {
    let bite = null, follows = 0, nibbles = 0;
    eco.listener = {
      onBite: (a, kind) => { if (!bite) bite = { sp: a.sp.id, kind }; },
      onFollow: () => follows++,
      onNibble: () => nibbles++,
      onCurious() {}, onLeave() {}, onSpooked() {},
    };
    const it = TACKLE[sc.item];
    const b = eco.bait;
    const bottom = Math.max(0.3, -heightAt(sc.x, sc.z));
    let x = sc.x, z = sc.z, depth = sc.kind === 'float' ? Math.min(sc.depth ?? 1.2, bottom - 0.15) : 0;
    Object.assign(b, {
      active: true, kind: sc.kind, item: it.id, size: it.size, fly: it.fly || null, thick: sc.thick ?? 0.4, fresh: 4, owner: null, held: false,
      twitch: 0, speed: 0, motion: 'still', pause: false, drag: false, fouled: false, natural: it.type === 'bait', sinking: false, darted: 0,
      anglerX: sc.ax, anglerZ: sc.az,
    });
    let t = 0, phase = 0, dartT = 0;
    const env = { hour: sc.hour ?? 10, rain: sc.rain ?? 0, cloud: sc.cloud ?? 0.3, daylight: sc.hour >= 7 && sc.hour < 19 ? 1 : 0.1, night: sc.hour >= 21 || sc.hour < 5 ? 1 : 0, lanternNear: !!sc.light, hatch: 0.3 };
    const ctx = { env, focus: { x, z }, boat: { x: sc.ax, z: sc.az, speed: 0 }, walker: null, lantern: null, lights: sc.light ? [{ x: sc.x, z: sc.z }] : [] };
    while (t < limit && !bite) {
      // How the rig moves: bottom rigs and floats sit; lures are reeled with pauses and twitches;
      // a jig sinks, is darted up, and glides down again.
      let speed = 0;
      b.twitch = Math.max(0, b.twitch - STEP);
      b.pause = false;
      if (sc.kind === 'lure') {
        phase = (phase + STEP) % 6;
        const reeling = phase < 4.5;
        speed = reeling ? sc.retrieve ?? 1 : 0;
        b.pause = !reeling && phase < 5.6;
        if (Math.abs(phase - 2.2) < STEP / 2) b.twitch = 1.2;
        const want = it.action === 'pop' || it.action === 'walk' ? 0 : it.dive ? it.dive : it.suspend ?? Math.min(bottom - 0.2, 1.2);
        depth += Math.sign(want - depth) * Math.min(Math.abs(want - depth), 0.6 * STEP);
        const dx = sc.ax - x, dz = sc.az - z, l = Math.hypot(dx, dz);
        if (l < 4) { x = sc.x; z = sc.z; } else { x += (dx / l) * speed * STEP; z += (dz / l) * speed * STEP; }
      } else if (sc.kind === 'jig') {
        dartT -= STEP;
        if (dartT <= 0 && depth >= bottom - 0.5) { dartT = 4.5; b.twitch = 1.4; b.darted = 4; }
        if (b.twitch > 1.0) depth = Math.max(0.3, depth - 2.6 * STEP);
        else depth = Math.min(bottom - 0.3, depth + it.sink * STEP);
        b.sinking = depth < bottom - 0.31;
        b.darted = Math.max(0, b.darted - STEP);
      } else if (sc.kind === 'bottom' || sc.kind === 'ledger') depth = bottom - 0.03;
      b.vx = (x - b.x) / STEP; b.vz = (z - b.z) / STEP;
      if (Math.abs(b.vx) > 4 || Math.abs(b.vz) > 4) b.vx = b.vz = 0; // (a recast, not movement)
      b.x = x; b.y = -depth; b.z = z;
      b.speed = speed;
      b.motion = b.twitch > 0 ? 'twitch' : speed > 1.15 ? 'fast' : speed > 0.15 ? 'slow' : 'still';
      b.nearBottom = depth >= bottom - 0.7;
      b.fresh = Math.max(0, b.fresh - STEP);
      ctx.focus.x = x; ctx.focus.z = z;
      eco.update(STEP, ctx);
      t += STEP;
    }
    results.push(bite ? `${bite.sp} in ${t.toFixed(0)}s` : `nothing in ${limit}s`);
    // let it go again, and let the fish settle
    if (b.owner) eco.disengage(b.owner, 'gone', 30);
    b.active = false;
    for (let i = 0; i < 300; i++) eco.update(STEP, ctx);
    b.active = true;
  }
  return results;
}

const near = (sp, idx = 0) => {
  const eco = new Ecosystem(habitat);
  const a = eco.bySpecies[sp][idx];
  return { x: a.home.x, z: a.home.z, zone: zoneAt(a.home.x, a.home.z) };
};

const SCENARIOS = {
  flounder: () => { const h = near('flounder', 2); return { kind: 'bottom', item: 'lug', x: h.x, z: h.z, ax: h.x + 12, az: h.z + 12 }; },
  mullet: () => { const h = near('mullet'); return { kind: 'float', item: 'bread', depth: 0.5, x: h.x, z: h.z, ax: h.x + 10, az: h.z + 10, thick: 0.35 }; },
  seabass: () => { const h = near('seabass'); return { kind: 'lure', item: 'sandeel', x: h.x, z: h.z, ax: h.x + 25, az: h.z, hour: 6.5, thick: 0.25 }; },
  wrasse: () => { const h = near('wrasse'); return { kind: 'bottom', item: 'crab', x: h.x, z: h.z, ax: h.x + 12, az: h.z + 8 }; },
  mackerel: () => { const h = near('mackerel'); return { kind: 'lure', item: 'metal', retrieve: 1.8, x: h.x, z: h.z, ax: h.x + 30, az: h.z }; },
  plaice: () => { const h = near('plaice'); return { kind: 'bottom', item: 'lug', x: h.x, z: h.z, ax: h.x + 12, az: h.z + 12 }; },
  squidNight: () => { const h = near('squid'); return { kind: 'jig', item: 'egi25', x: h.x, z: h.z, ax: h.x + 15, az: h.z, hour: 22, light: true }; },
  squidDay: () => { const h = near('squid'); return { kind: 'jig', item: 'egi25', x: h.x, z: h.z, ax: h.x + 15, az: h.z, hour: 12 }; },
  // Tuna roam after the bait shoals: cast where a school is right now (as you would at a boil).
  tuna: () => {
    const eco = new Ecosystem(habitat);
    const ctx = { env: { hour: 8, rain: 0, cloud: 0.3, daylight: 1, night: 0, hatch: 0 }, focus: { x: 0, z: 1000 }, boat: { x: 0, z: 0, speed: 0 }, walker: null, lights: [] };
    const sc = eco.schools.find((s) => s.sp.id === 'tuna');
    for (let i = 0; i < 600; i++) { ctx.focus.x = sc.x; ctx.focus.z = sc.z; eco.update(1 / 30, ctx); }
    // Wait for a boil (the school on a bait ball), then cast into it.
    for (let i = 0; i < 30 * 300 && !(sc.frenzy > 0); i++) { ctx.focus.x = sc.x; ctx.focus.z = sc.z; eco.update(1 / 30, ctx); }
    return { kind: 'lure', item: 'stickbait', retrieve: 1.9, x: sc.x, z: sc.z, ax: sc.x + 35, az: sc.z, hour: 8, eco };
  },
  lmbass: () => { const h = near('lmbass'); return { kind: 'lure', item: 'creature', retrieve: 0.5, x: h.x, z: h.z, ax: h.x + 18, az: h.z + 8, hour: 7 }; },
  tench: () => { const h = near('tench'); return { kind: 'float', item: 'worm', depth: 1.4, x: h.x, z: h.z, ax: h.x + 8, az: h.z + 8, hour: 6 }; },
  roach: () => { const h = near('roach', 30); return { kind: 'float', item: 'maggot', depth: 1, x: h.x, z: h.z, ax: h.x + 8, az: h.z + 8 }; },
  // (This pike lies off the Holm: cast to the island from a boat out in the deep water.)
  pikeMere: () => { const h = near('pike', 4); return { kind: 'lure', item: 'jerk', x: h.x, z: h.z, ax: h.x - 18, az: h.z, hour: 7 }; },
  carp: () => { const h = near('carp'); return { kind: 'ledger', item: 'boilie', x: h.x, z: h.z, ax: h.x + 15, az: h.z, hour: 18 }; },
  // Wrong tackle in the right place should not catch the target.
  wrongBottomLure: () => { const h = near('flounder', 2); return { kind: 'lure', item: 'popper', x: h.x, z: h.z, ax: h.x + 20, az: h.z }; },
};

const only = process.argv[2];
for (const [name, make] of Object.entries(SCENARIOS)) {
  if (only && name !== only) continue;
  const sc = make();
  console.log(`${name.padEnd(16)} (${sc.item}, ${zoneAt(sc.x, sc.z)} ${sc.x.toFixed(0)},${sc.z.toFixed(0)}): ${fish(sc).join(', ')}`);
}
