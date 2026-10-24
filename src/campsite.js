import { fishById } from './fish.js';
import { PACK } from './tackle.js';

// Your own camp, pitched wherever the ground allows: a tent, a lantern, a bedroll, a little
// stove, a camp chair, a tackle box and a cool box. The rules for where it can go look at the
// whole footprint, not just the middle of the tent: dry ground above where the waves wash, level
// enough to sleep on, clear of trees, rocks and buildings, off piers, paths and doorways, and
// inside the world. Nothing here draws anything; the game passes in a `world` that answers
// questions about the ground (see siteWorld in main.js), so the same rules run in the tests.

export const CAMP_KITS = 1;   // camping kits you own (and so camps you can have pitched at once)
export const COOLBOX = 6;     // fish the cool box holds (on ice)
export const MEALS_MAX = 4;   // cooked fish waiting at camp
export const COOK_HOURS = 0.5;
export const TENTS = {
  green: { name: 'Moss green', fly: '#7f9a6a', canvas: '#d9c39a', dark: '#c4ab80' },
  sand: { name: 'Sand', fly: '#cdb88f', canvas: '#e6d6b2', dark: '#c9b48c' },
  rust: { name: 'Rust', fly: '#b0663f', canvas: '#ead8b8', dark: '#cbb38d' },
  blue: { name: 'Harbour blue', fly: '#4f7486', canvas: '#dfd6c2', dark: '#c4b89c' },
};
export const DECOR = { bunting: 'Bunting', rug: 'Rag rug', chimes: 'Wind chimes', deckchair: 'Striped deckchair' };
// Decorations you have to earn first (see adventures.js): the key in state.unlocks.
export const DECOR_UNLOCK = { deckchair: 'deckchair' };
export const LANTERN_MODES = ['auto', 'on', 'off'];

// Where everything stands, in the camp's own frame: +z is the way the door faces, x to its left.
export const LAYOUT = {
  tent: { x: 0, z: -1.25, w: 1.9, d: 2.5 },
  lantern: { x: -1.3, z: 0.55 },
  stove: { x: 1.35, z: 0.85 },
  cooler: { x: 2.05, z: -0.45 },
  tackle: { x: -2.05, z: -0.45 },
  chair: { x: 0.45, z: 1.9 },
  rug: { x: 0, z: 0.55 },
};
// The ground it needs: the tent and its guy ropes, the furniture round the door, and a little
// room to walk round. (Local frame, metres.)
export const FOOTPRINT = { x0: -2.6, x1: 2.6, z0: -3.3, z1: 2.7 };
const TENT_AREA = { x0: -1.2, x1: 1.2, z0: -2.6, z1: 0.1 };

// Local (lx, lz) → world, for a camp at (x, z) turned by yaw (a heading: 0 faces +z).
export function toWorld(x, z, yaw, lx, lz) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: x + lx * c + lz * s, z: z - lx * s + lz * c };
}

const STEP = 0.55;
const SAMPLES = (() => {
  const out = [];
  for (let lz = FOOTPRINT.z0; lz <= FOOTPRINT.z1 + 1e-6; lz += STEP) {
    for (let lx = FOOTPRINT.x0; lx <= FOOTPRINT.x1 + 1e-6; lx += STEP) {
      out.push({ lx, lz, tent: lx >= TENT_AREA.x0 && lx <= TENT_AREA.x1 && lz >= TENT_AREA.z0 && lz <= TENT_AREA.z1 });
    }
  }
  return out;
})();
const COLS = Math.round((FOOTPRINT.x1 - FOOTPRINT.x0) / STEP) + 1;

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// What the ground at a footprint is like, and whether a camp can go there.
// world: {
//   height(x, z)        ground height (0 = the sea's still level)
//   walk(x, z)          height you'd stand at (decks and piers included)
//   inBounds(x, z)      inside the world you can reach
//   obstacles(x, z, pad) things standing within pad of the point: [{ kind, name }]
//   keepOut(x, z)       a place to keep clear (a doorway, the quay, a tackle box…): { why } or null
//   path(x, z)          distance to the nearest path or trail
//   exposure(x, z)      0 sheltered … 1 open to the swell (the nearby sea)
//   treesNear(x, z), waterNear(x, z)  for describing a good spot (optional)
// }
// Returns { ok, code, reason, warn, words, bad: [{ x, z }], rise }.
export function checkSite(x, z, yaw, world, { others = [], ignore = null } = {}) {
  const res = { ok: false, code: '', reason: '', warn: '', words: '', bad: [], rise: 0 };
  const fail = (code, reason) => {
    res.code = code;
    res.reason = reason;
    return res;
  };
  if (!world.inBounds(x, z)) return fail('bounds', 'That’s beyond where you can go.');
  const hs = new Float32Array(SAMPLES.length);
  let lo = Infinity, hi = -Infinity, tlo = Infinity, thi = -Infinity, wet = 0, deck = false, obstacle = null, keep = null, path = false;
  for (let i = 0; i < SAMPLES.length; i++) {
    const S = SAMPLES[i], p = toWorld(x, z, yaw, S.lx, S.lz);
    const h = world.height(p.x, p.z);
    hs[i] = h;
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
    if (S.tent) {
      tlo = Math.min(tlo, h);
      thi = Math.max(thi, h);
    }
    let bad = false;
    if (h < (S.tent ? 0.45 : 0.3)) { wet++; bad = true; }
    if (!world.inBounds(p.x, p.z)) bad = true;
    if (world.walk(p.x, p.z) > h + 0.25) { deck = true; bad = true; }
    const ob = world.obstacles(p.x, p.z, S.tent ? 0.2 : 0.1).find((o) => o.kind !== 'reeds' || h > 0.6);
    if (ob) { obstacle = obstacle || ob; bad = true; }
    const k = world.keepOut(p.x, p.z);
    if (k) { keep = keep || k; bad = true; }
    if (world.path(p.x, p.z) < 0.9) { path = true; bad = true; }
    if (bad) res.bad.push(p);
  }
  res.rise = Math.round((thi - tlo) * 100) / 100;
  const h0 = world.height(x, z);
  if (h0 < 0.05) return fail('water', 'That’s in the water.');
  if (wet) return fail('wet', wet > SAMPLES.length / 3 ? 'Too wet: that’s where the water reaches.' : 'Part of it would be at the water’s edge, where the waves wash up. Try a little higher up.');
  if (deck) return fail('deck', 'That’s on a pier or jetty: a tent needs ground under it.');
  if (!res.bad.every((p) => world.inBounds(p.x, p.z))) return fail('bounds', 'That’s beyond where you can go.');
  if (keep) return fail('keep', keep.why);
  if (path) return fail('path', 'That’s across a path: keep the way clear for walking.');
  if (obstacle) {
    const what = obstacle.name || ({ tree: 'a tree', rock: 'rocks', building: 'a building', reeds: 'reeds' }[obstacle.kind] || 'something');
    return fail('blocked', obstacle.kind === 'building' ? `Too close to ${what}.` : obstacle.kind === 'rock' ? 'Rocks in the way: the tent needs clear ground.' : `${cap(what)} ${what.endsWith('s') && !what.startsWith('a ') ? 'are' : 'is'} in the way.`);
  }
  // Level enough to sleep on: a gentle slope is fine (the tent takes up a little).
  if (thi - tlo > 0.75) return fail('steep', `Too steep to sleep on: the ground falls ${Math.round((thi - tlo) * 100)} cm across the tent. Find flatter ground.`);
  if (hi - lo > 1.6) return fail('steep', 'Too steep here: the stove and chair wouldn’t stand. Find flatter ground.');
  // A step or a drop across it (a bank's edge, a ledge): the ground isn't one piece.
  for (let i = 0; i < SAMPLES.length; i++) {
    const right = (i % COLS) < COLS - 1 ? i + 1 : -1, down = i + COLS < SAMPLES.length ? i + COLS : -1;
    for (const j of [right, down]) {
      if (j >= 0 && Math.abs(hs[i] - hs[j]) > 0.42) return fail('ledge', 'There’s a drop across it, like a bank’s edge. Find unbroken ground.');
    }
  }
  for (const o of others) {
    if (o.id !== ignore && Math.hypot(o.x - x, o.z - z) < 10) return fail('camp', `Too close to your camp, ${o.name}.`);
  }
  res.ok = true;
  // Low ground facing the open sea: fine on a calm night, but the spray reaches it in a swell.
  const exposure = world.exposure ? world.exposure(x, z) : 0;
  if (lo < 0.95 && exposure > 0.4) res.warn = 'Low ground facing the open sea: in a big swell the spray reaches about here.';
  else if (lo < 0.7) res.warn = 'Low ground, close to the water: fine in calm weather.';
  res.words = describe(x, z, h0, hi - lo, world);
  return res;
}

function describe(x, z, h, rise, world) {
  const ground = world.ground?.(x, z, h) || (h < 1.7 ? 'sand' : 'grass');
  const level = rise < 0.25 ? 'Level' : 'Gently sloping';
  const parts = [`${level} ${ground}`];
  if (world.treesNear?.(x, z)) parts.push('among the trees');
  const water = world.waterNear?.(x, z);
  if (water) parts.push(`looking out over ${water}`);
  return `${parts.join(', ')}.`;
}

// The nearest spot within reach where it does fit, so you never have to be pixel-perfect: a
// little this way or that, or turned a touch. Returns { x, z, yaw, check, moved } or null.
const NUDGES = (() => {
  const out = [];
  for (const r of [0.6, 1.2, 1.8]) for (let k = 0; k < 8; k++) out.push([Math.cos((k / 8) * Math.PI * 2) * r, Math.sin((k / 8) * Math.PI * 2) * r]);
  return out;
})();
export function findSite(x, z, yaw, world, opts = {}) {
  const first = checkSite(x, z, yaw, world, opts);
  if (first.ok) return { x, z, yaw, check: first, moved: false };
  // Nothing nearby can help in open water or off the world's edge.
  if (first.code === 'water' || first.code === 'bounds') return { x, z, yaw, check: first, moved: false, none: true };
  // Turned a touch where it stands (a slope or a tree's edge), then nudged this way and that.
  const tries = [[0, 0, -0.26], [0, 0, 0.26], ...NUDGES.map(([dx, dz]) => [dx, dz, 0])];
  for (const [dx, dz, dy] of tries) {
    const c = checkSite(x + dx, z + dz, yaw + dy, world, opts);
    if (c.ok) return { x: x + dx, z: z + dz, yaw: yaw + dy, check: c, moved: true };
  }
  return { x, z, yaw, check: first, moved: false, none: true };
}

// Further afield, for a saved camp whose ground has changed: the nearest good spot within
// `max` metres, searching outwards in rings.
export function nearestSite(x, z, yaw, world, max = 60, opts = {}) {
  for (let r = 0; r <= max; r += 2) {
    const n = Math.max(1, Math.round((r * Math.PI * 2) / 3));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      for (const dy of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const c = checkSite(px, pz, yaw + dy, world, opts);
        if (c.ok) return { x: px, z: pz, yaw: yaw + dy, check: c, dist: r };
      }
    }
  }
  return null;
}

/* ---------------- the camp itself, as saved ---------------- */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, lo = -Infinity, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function newCamp({ x, z, yaw, name, day = 1, hour = 12 }) {
  return {
    id: `camp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName(name) || 'My camp',
    x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, yaw: Math.round(yaw * 1000) / 1000,
    tent: 'green', deco: { bunting: false, rug: false, chimes: false, deckchair: false }, lantern: 'auto',
    store: { fish: [], meals: [] }, cooking: null,
    pitched: { day, hour: Math.round(hour * 100) / 100 }, visits: 0, marked: true, note: '',
  };
}

export function cleanName(v) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) : '';
}

const fishEntry = (f) => (isObj(f) && fishById[f.id]?.meal
  ? { id: f.id, size: Math.round(num(f.size, fishById[f.id].size[0], 1, 300)), logId: typeof f.logId === 'string' ? f.logId.slice(0, 24) : null }
  : null);

// A saved camp, made safe: anything odd is put right, and a camp that can't be read is dropped
// (its kit comes home: see cleanCamps).
export function cleanCamp(c) {
  if (!isObj(c)) return null;
  const x = num(c.x, NaN), z = num(c.z, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 3000 || Math.abs(z) > 3000) return null;
  const id = typeof c.id === 'string' && /^[a-z0-9-]{3,40}$/.test(c.id) ? c.id : `camp-${Math.round(Math.abs(x * 7 + z * 13)).toString(36)}`;
  const store = isObj(c.store) ? c.store : {};
  const cook = isObj(c.cooking) ? fishEntry(c.cooking) : null;
  if (cook) Object.assign(cook, { start: num(c.cooking.start, 0, 0), dur: num(c.cooking.dur, COOK_HOURS, 0.05, 2) });
  return {
    id, name: cleanName(c.name) || 'My camp',
    x, z, yaw: num(c.yaw, 0, -100, 100),
    tent: TENTS[c.tent] ? c.tent : 'green',
    deco: Object.fromEntries(Object.keys(DECOR).map((k) => [k, !!c.deco?.[k]])),
    lantern: LANTERN_MODES.includes(c.lantern) ? c.lantern : 'auto',
    store: {
      fish: (Array.isArray(store.fish) ? store.fish : []).map((f) => fishEntry(f)).filter(Boolean).slice(0, COOLBOX),
      meals: (Array.isArray(store.meals) ? store.meals : []).map((f) => fishEntry(f)).filter(Boolean).slice(0, MEALS_MAX),
    },
    cooking: cook,
    pitched: { day: Math.round(num(c.pitched?.day, 1, 1, 1e6)), hour: num(c.pitched?.hour, 12, 0, 24) },
    visits: Math.round(num(c.visits, 0, 0, 1e6)),
    marked: c.marked !== false,
    note: typeof c.note === 'string' ? c.note.slice(0, 200) : '',
    moved: typeof c.moved === 'string' ? c.moved.slice(0, 200) : undefined,
  };
}

export function cleanCamps(raw) {
  const out = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    const k = cleanCamp(c);
    if (!k || out.some((o) => o.id === k.id)) continue;
    if (k.moved === undefined) delete k.moved;
    out.push(k);
    if (out.length >= CAMP_KITS) break;
  }
  return out;
}

// Kits in your backpack: the ones not pitched somewhere.
export const kitsFree = (state) => Math.max(0, CAMP_KITS - (state.camps?.length || 0));

/* ---------------- what's in it ---------------- */

const creelFree = (state) => PACK.fish - state.keep.length;

// From your creel into the cool box.
export function stow(state, camp, i) {
  const f = state.keep[i];
  if (!f) return { ok: false, why: 'Nothing there.' };
  if (f.cooked) {
    if (camp.store.meals.length >= MEALS_MAX) return { ok: false, why: `There’s no more room for cooked fish here (${MEALS_MAX}).` };
    state.keep.splice(i, 1);
    camp.store.meals.push({ id: f.id, size: f.size, logId: f.logId || null });
    return { ok: true };
  }
  if (camp.store.fish.length >= COOLBOX) return { ok: false, why: `The cool box is full (${COOLBOX} fish). Cook some, or keep them in your creel.` };
  state.keep.splice(i, 1);
  camp.store.fish.push({ id: f.id, size: f.size, logId: f.logId || null });
  return { ok: true };
}

// From the cool box (or the cooked fish) into your creel.
export function take(state, camp, i, meal = false) {
  const list = meal ? camp.store.meals : camp.store.fish;
  const f = list[i];
  if (!f) return { ok: false, why: 'Nothing there.' };
  if (creelFree(state) <= 0) return { ok: false, why: `Your creel is full (${PACK.fish} fish).` };
  list.splice(i, 1);
  state.keep.push({ id: f.id, size: f.size, logId: f.logId || null, ...(meal ? { cooked: true } : {}) });
  return { ok: true };
}

// Packing up: the tent, stove and the rest go in your backpack; the cool box is emptied into
// your creel (a full cool box is too heavy to carry with a tent), cooked fish wrapped in paper.
// Returns what that would take, so the game can explain and offer a way out if it doesn't fit.
export function packPlan(state, camp) {
  const fish = camp.store.fish.length, meals = camp.store.meals.length, free = creelFree(state);
  return { fish, meals, free, over: Math.max(0, fish + meals - free), cooking: !!camp.cooking, fits: !camp.cooking && fish + meals <= free };
}

// Pack it up. `release`: indices into the cool box of fish to let go first (chosen by you).
// Never drops anything you didn't choose to release: returns { ok: false, why } if it won't fit.
export function packUp(state, camp, { release = [] } = {}) {
  if (camp.cooking) return { ok: false, why: 'Something is still on the stove: let it finish, or take it off first.' };
  const keepFish = camp.store.fish.filter((f, i) => !release.includes(i));
  const released = camp.store.fish.filter((f, i) => release.includes(i));
  if (keepFish.length + camp.store.meals.length > creelFree(state)) {
    return { ok: false, why: `Your creel has room for ${creelFree(state)} more; the cool box has ${camp.store.fish.length + camp.store.meals.length}.` };
  }
  for (const f of keepFish) state.keep.push({ id: f.id, size: f.size, logId: f.logId || null });
  for (const f of camp.store.meals) state.keep.push({ id: f.id, size: f.size, logId: f.logId || null, cooked: true });
  const i = state.camps.indexOf(camp);
  if (i >= 0) state.camps.splice(i, 1);
  return { ok: true, released, carried: keepFish.length + camp.store.meals.length };
}

// Moving camp: the same camp (its id, name, cool box and everything in it) on new ground.
export function moveCamp(camp, x, z, yaw, day, hour) {
  camp.x = Math.round(x * 100) / 100;
  camp.z = Math.round(z * 100) / 100;
  camp.yaw = Math.round(yaw * 1000) / 1000;
  camp.pitched = { day, hour: Math.round(hour * 100) / 100 };
  return camp;
}

// Cooking on the camp stove: done when its half hour has passed (checked whenever we look,
// so a camp you're nowhere near keeps no timer of its own).
export function settleCooking(camp, abs) {
  const c = camp.cooking;
  if (!c || abs < c.start + c.dur) return null;
  camp.cooking = null;
  const meal = { id: c.id, size: c.size, logId: c.logId || null };
  if (camp.store.meals.length < MEALS_MAX) camp.store.meals.push(meal);
  else camp.store.fish.unshift(meal); // (never lost: back in the cool box, uncooked)
  return meal;
}

export function startCooking(state, camp, from, i, abs) {
  if (camp.cooking) return { ok: false, why: 'The pan is busy.' };
  const list = from === 'cooler' ? camp.store.fish : state.keep;
  const f = list[i];
  if (!f || f.cooked) return { ok: false, why: 'Nothing to cook there.' };
  list.splice(i, 1);
  camp.cooking = { id: f.id, size: f.size, logId: f.logId || null, start: abs, dur: COOK_HOURS };
  return { ok: true, fish: f };
}

// A default name from the nearest place you know.
export function defaultName(x, z, places, known) {
  let best = null, bd = Infinity;
  for (const p of places) {
    if (p.area || !known[p.id]) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) { bd = d; best = p; }
  }
  if (!best || bd > 160) return 'My camp';
  const on = { strand: 'on', head: 'on', haven: 'above', landing: 'by', camp: 'near', cove: 'by', reach: 'by', jetty: 'facing', gull: 'facing' }[best.id] || (bd < 40 ? 'at' : 'near');
  return `Camp ${on} ${best.name}`;
}
