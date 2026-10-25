// Fishes the real ecosystem (src/world/ecosystem.js) headless: a bait, lure or jig in a chosen
// spot, moved the way the game moves it, and reports which species come, how soon they bite,
// and what they took. For tuning and for checking that fish keep to their own waters.
//   node --import ./tests/setup.mjs tools/ecosim.mjs [scenario-name]
import { createHabitat } from '../src/world/habitat.js';
import { Ecosystem } from '../src/world/ecosystem.js';
import { heightAt, zoneAt } from '../src/world/terrain.js';
import { TACKLE, RODS } from '../src/tackle.js';
import { fishById } from '../src/fish.js';
import { setupsFor, habitsOf } from '../src/guide.js';

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
        // The lure's depth as fishing.js moves it: sinking lures go down while you pause and
        // climb as you reel; floating plugs dive as you reel; surface lures stay on top.
        const moving = speed > 0.12, act = it.action;
        let want, rate = 0.6;
        if (act === 'pop' || act === 'walk') want = 0;
        else if (act === 'wobble') [want, rate] = moving ? [it.dive, 0.9] : [0, 0.22];
        else if (act === 'flash') [want, rate] = moving ? [Math.min(1.6, Math.max(0.25, 1.8 - speed * 0.8)), 0.6] : [bottom, it.sink];
        else if (act === 'swim') [want, rate] = moving ? [Math.min(bottom, Math.max(0.3, depth - (speed - 0.6) * 0.6)), 0.3] : [bottom, it.sink];
        else if (act === 'flutter') [want, rate] = moving ? [Math.min(3, Math.max(0.4, 2.6 - speed * 1.2)), 0.8] : [bottom, it.sink];
        else if (act === 'crawl') [want, rate] = [bottom, it.sink];
        else want = it.suspend ?? Math.min(bottom - 0.2, 1.2);
        want = Math.min(want, bottom - 0.08);
        depth += Math.sign(want - depth) * Math.min(Math.abs(want - depth), rate * STEP);
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

// Fish one species with the field guide's first choice, rigged as the guide says, where it lives
// and at the hour it is keenest. Shoaling fish are found where their shoal is now.
export function fishWithGuide(eco, id, { tries = 2, homes = [0, 5] } = {}) {
  const sp = fishById[id], s = setupsFor(sp)[0], rod = RODS[s.rod], d = habitsOf(sp).depth, L = sp.life;
  const env = (h) => ({ hour: h, rain: 0, cloud: 0.3, daylight: h >= 7 && h < 19 ? 1 : 0.1, night: h >= 21 || h < 5 ? 1 : 0, lanternNear: false, hatch: 0.5 });
  const hour = [7, 12, 20, 23].reduce((a, h) => (L.activity(env(h)) > L.activity(env(a)) ? h : a), 12);
  const depth = rod.kind === 'float' ? Math.max(1, Math.round(d[0])) + 1 : 0;
  const fast = (L.likes.fast ?? 0) > (L.likes.slow ?? 0);
  const results = [];
  // (Where it lives at home, or at Las Brasas for the island's own fish.)
  const all = eco.bySpecies[id], home = all.filter((a) => !a.home.south), list = home.length ? home : all;
  for (const idx of homes) {
    const a = list[idx % list.length];
    const at = a.school ? { x: a.school.x, z: a.school.z } : a.home;
    results.push(...fish({ kind: rod.kind, item: s.item, depth, x: at.x, z: at.z, ax: at.x + 14, az: at.z + 10, hour, thick: 0.3, retrieve: fast ? 1.8 : 0.8, light: L.lantern, eco }, { tries, limit: 200 }));
  }
  return { setup: s, hour, results, hits: results.filter((r) => r.startsWith(`${id} `)).length };
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
  // The field guide's reference species, with the setups it recommends.
  meagreShad: () => { const h = near('meagre'); return { kind: 'lure', item: 'shad', retrieve: 0.7, x: h.x, z: h.z, ax: h.x + 25, az: h.z, hour: 20, thick: 0.6 }; },
  meagreStrip: () => { const h = near('meagre', 3); return { kind: 'bottom', item: 'strip', x: h.x, z: h.z, ax: h.x + 15, az: h.z, hour: 21 }; },
  gilthead: () => { const h = near('gilthead'); return { kind: 'bottom', item: 'crab', x: h.x, z: h.z, ax: h.x + 14, az: h.z + 6, hour: 11, thick: 0.45 }; },
  giltheadBay: () => { const h = near('gilthead', 20); return { kind: 'bottom', item: 'crab', x: h.x, z: h.z, ax: h.x + 14, az: h.z + 6, hour: 11, thick: 0.45 }; },
  soleNight: () => { const h = near('sole', 4); return { kind: 'bottom', item: 'rag', x: h.x, z: h.z, ax: h.x + 12, az: h.z + 12, hour: 23 }; },
  soleDay: () => { const h = near('sole', 4); return { kind: 'bottom', item: 'rag', x: h.x, z: h.z, ax: h.x + 12, az: h.z + 12, hour: 12 }; },
  cuttlefish: () => { const h = near('cuttlefish', 2); return { kind: 'jig', item: 'egi25', x: h.x, z: h.z, ax: h.x + 15, az: h.z, hour: 10 }; },
  // Wrong tackle in the right place should not catch the target.
  wrongBottomLure: () => { const h = near('flounder', 2); return { kind: 'lure', item: 'popper', x: h.x, z: h.z, ax: h.x + 20, az: h.z }; },
};

export { SCENARIOS };
const MAIN = !import.meta.url.includes('nomain');
const only = process.argv[2];
// `ecosim.mjs guide:<species>` fishes a species with the field guide's first choice.
if (MAIN && only?.startsWith('guide:')) {
  const eco = new Ecosystem(habitat);
  for (const id of only.slice(6).split(',')) {
    const r = fishWithGuide(eco, id, { homes: [0, 3, 5, 7], tries: 3 });
    console.log(`${id.padEnd(14)} ${r.setup.rod}/${r.setup.item} at ${r.hour}h: ${r.hits}/${r.results.length} — ${r.results.join(', ')}`);
  }
}
for (const [name, make] of MAIN && !only?.startsWith('guide:') ? Object.entries(SCENARIOS) : []) {
  if (only && name !== only) continue;
  const sc = make();
  console.log(`${name.padEnd(16)} (${sc.item}, ${zoneAt(sc.x, sc.z)} ${sc.x.toFixed(0)},${sc.z.toFixed(0)}): ${fish(sc).join(', ')}`);
}
