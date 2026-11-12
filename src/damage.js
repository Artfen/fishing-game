// Damage (marine physics C5a): what a knock does to her hull, and to a RIB's tubes.
//
// Nothing breaks on its own. A hull is hurt by what she hits and how hard: the speed she meets it
// at, square on (a glancing touch along a quay does nothing a square bump does), and what it is
// (rock is unforgiving; a quay's timbers a little less so; another boat's side gives; sand and mud
// hardly hurt at all), against what she's built of. Driven along hard rock she's scored as she
// slides. Below a material's own threshold she takes no harm at all; above it, more for each
// metre a second. Each part of her keeps its own record (her bow, either side, her stern, her
// bottom): a gouge in her bottom slows her a little (rough water round it), and the yard puts it
// right. A RIB's tubes are her buoyancy and her fenders both: in five chambers in real boats, four
// here (each side, fore and aft), each sealed from the next. Rock, or a quay's bolts and barnacles
// met hard enough, punctures one: it goes soft as the air hisses out, and she sits lower on that
// side; the others hold her up. The foot pump puts the air back for a while; the yard patches the
// hole. (Water coming in, through a hull holed or cracked through, is C6: flooding.)
//
// And (C5b) her working parts, each hurt only by what can hurt it:
// - Her steering: an outboard's leg driven onto the bottom fast (the strike that bends its
//   propeller, harder: its swivel and the steering cable take it), or a rudder's foot hitting it.
//   It's bent (she pulls to one side, the way the blow pushed it) and stiff (less lock).
// - Her outboard's mounting: the same strike, harder still, works the bracket's bolts loose: she
//   loses push and judders. The bolts can be done up at sea, most of the way; the yard does the
//   rest.
// - Her electrics: the battery terminal, shaken by hard landings off waves and slams into them,
//   each worse than the last past a jolt a boat's built for, works loose. Loose, the next hard
//   jolt cuts the engine and the instruments, and the starter only clicks until it's done up (at
//   sea, with a spanner, for good).
//
// Difficulty: on Relaxed, knocks scuff the paint and no more (a tube never punctures, and her
// working parts take no harm); on Standard, the full account; on Realistic, a little less takes a
// little more, and a punctured tube goes soft sooner.

export const SECTIONS = ['bow', 'port', 'stbd', 'stern', 'bottom'];
export const SECTION_NAMES = { bow: 'her bow', port: 'her port side', stbd: 'her starboard side', stern: 'her stern', bottom: 'her bottom' };
// A RIB's tube chambers (port is her local +x): 0 port aft, 1 port fore, 2 starboard aft, 3
// starboard fore.
export const CHAMBERS = ['port aft', 'port fore', 'starboard aft', 'starboard fore'];
// (Where along her the fore chambers begin: share of her length from the stern.)
export const CHAMBER_SPLIT = 0.46;

// What each is built of. v0: the speed (m/s, square on, against rock) she takes without harm;
// per: the damage (share of the way to cracked through) for each m/s past it; scrape: the damage
// for each metre slid along rock; words: what a knock does to it, worst last; touch: what the
// yard does for a scuff or a score; mend: for worse.
export const MATERIALS = {
  grp: { name: 'glassfibre', v0: 1.5, per: 0.16, scrape: 0.012, words: ['scuffed', 'gouged through the gelcoat', 'cracked', 'cracked right through'], touch: 'filled and the gelcoat made good', mend: 'ground out, glassed and faired' },
  aluminium: { name: 'aluminium', v0: 2.1, per: 0.12, scrape: 0.006, words: ['scuffed', 'scored', 'dented', 'split at a weld'], touch: 'faired and painted', mend: 'beaten out and welded' },
  wood: { name: 'planking', v0: 1.2, per: 0.2, scrape: 0.016, words: ['scuffed', 'scored', 'a plank sprung', 'a plank stove in'], touch: 'planed, filled and painted', mend: 'a new length of plank let in' },
  pe: { name: 'polyethylene', v0: 3, per: 0.08, scrape: 0.004, words: ['scuffed', 'scored', 'dented', 'split'], touch: 'faired smooth', mend: 'welded with a hot-air gun' },
  epoxy: { name: 'epoxy sandwich', v0: 1.2, per: 0.2, scrape: 0.02, words: ['scuffed', 'dinged', 'cracked', 'crushed'], touch: 'filled and sealed', mend: 'cut out, filled and glassed over' },
};
export const MATERIAL_OF = { row: 'wood', skiff: 'wood', kayak: 'pe', bass: 'grp', sail: 'grp', cabin: 'grp', cruiser: 'grp', console: 'grp', rib: 'aluminium', windsurf: 'epoxy', jetski: 'grp' };
export const materialOf = (kind) => MATERIALS[MATERIAL_OF[kind]] || MATERIALS.grp;
// The tubes: Hypalon over a woven base. Punctured by `sharp` contact past `v0` (m/s), torn past
// `tear`; scored along rock. leak: how fast the air goes from a small hole (the chamber's soft, at
// 55 % of its working pressure, in about four minutes: see stepTubes); torn, in about thirty seconds.
export const TUBE = { name: 'Hypalon', v0: 2.6, tear: 5.5, scrape: 3.2, leak: 0.0022, torn: 0.018 };

// What she hits: how hard it is, and how sharp (for a tube).
export const SURFACES = {
  rock: { name: 'rock', hard: 1, sharp: 1 },
  pier: { name: 'the quay', hard: 0.8, sharp: 0.55 },
  boat: { name: 'another boat', hard: 0.6, sharp: 0.2 },
  fender: { name: 'her fenders', hard: 0.15, sharp: 0 },
  sand: { name: 'the bottom', hard: 0.3, sharp: 0 },
};
export const surfaceAt = (rock) => (rock > 0.45 ? 'rock' : 'sand');

// By difficulty. cap: the worst a knock can do to her hull; v: her thresholds' share; k: damage's;
// tubes: whether they puncture; leak: how fast a puncture lets go.
export const MODES = {
  relaxed: { cap: 0.2, v: 1.3, k: 0.6, tubes: false, leak: 0, parts: false },
  standard: { cap: 1, v: 1, k: 1, tubes: true, leak: 1, parts: true },
  realistic: { cap: 1, v: 0.85, k: 1.3, tubes: true, leak: 1.8, parts: true },
};
// Her working parts (C5b). steer: a leg's strike bends it past v0 (m/s over the ground), a
// rudder's foot past rudder (m/s square on); bend: rad of pull for each m/s past it, up to most;
// stiff: lock lost for each. mount: a strike past v0 works the bracket loose, per m/s past it;
// tight: what doing up the bolts at sea brings it back to. shock: a jolt (m/s, landing or slam)
// past j0 adds its excess squared times k; past 1, the terminal's loose.
export const PARTS = {
  steer: { v0: 6, rudder: 1.6, bend: 0.012, most: 0.09, stiff: 0.05 },
  mount: { v0: 8, per: 0.07, tight: 0.25 },
  shock: { j0: 2.6, k: 0.09 },
};
export const modeOf = (difficulty) => MODES[difficulty] || MODES.standard;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

export function newDamage(tubes = false) {
  return {
    hull: Object.fromEntries(SECTIONS.map((s) => [s, 0])), tubes: tubes ? CHAMBERS.map(() => ({ air: 1, leak: 0 })) : null,
    steer: { bend: 0, loss: 0 }, mount: 0, tightened: false, wiring: { loose: false, shock: 0 },
    // (C6b: a breach plugged at sea, by the part of her hull it's in: see plug.)
    plugs: {},
  };
}

// What the save holds, made sensible (anything odd: sound).
export function cleanDamage(raw, tubes = false) {
  const D = newDamage(tubes);
  if (!raw || typeof raw !== 'object') return D;
  const n = (v, lo, hi, d) => (Number.isFinite(v) ? clamp(v, lo, hi) : d);
  if (raw.hull && typeof raw.hull === 'object') for (const s of SECTIONS) D.hull[s] = n(raw.hull[s], 0, 1, 0);
  if (D.tubes && Array.isArray(raw.tubes)) {
    D.tubes.forEach((c, i) => {
      const r = raw.tubes[i];
      if (!r || typeof r !== 'object') return;
      c.air = n(r.air, 0, 1, 1);
      c.leak = n(r.leak, 0, 0.1, 0);
      c.plugged = r.plugged === true && c.leak > 0;
    });
  }
  if (raw.plugs && typeof raw.plugs === 'object') for (const s of SECTIONS) if (raw.plugs[s] === true && D.hull[s] >= 0.85) D.plugs[s] = true;
  if (raw.steer && typeof raw.steer === 'object') {
    D.steer.bend = n(raw.steer.bend, -PARTS.steer.most, PARTS.steer.most, 0);
    D.steer.loss = n(raw.steer.loss, 0, 0.8, 0);
  }
  D.mount = n(raw.mount, 0, 1, 0);
  D.tightened = raw.tightened === true && D.mount > 0;
  if (raw.wiring && typeof raw.wiring === 'object') {
    D.wiring.loose = raw.wiring.loose === true;
    D.wiring.shock = n(raw.wiring.shock, 0, 1, 0);
  }
  // (The water in each of her compartments, litres: see flooding.js. Held within each one's size
  // when she's next afloat.)
  if (Array.isArray(raw.water)) D.water = raw.water.slice(0, 6).map((l) => n(l, 0, 20000, 0));
  return D;
}
// For the save: only what isn't sound.
export function damageSave(D) {
  const out = {};
  const hull = Object.fromEntries(SECTIONS.filter((s) => D.hull[s] > 0).map((s) => [s, Math.round(D.hull[s] * 1000) / 1000]));
  if (Object.keys(hull).length) out.hull = hull;
  if (D.tubes?.some((c) => c.air < 1 || c.leak > 0)) out.tubes = D.tubes.map((c) => ({ air: Math.round(c.air * 1000) / 1000, leak: Math.round(c.leak * 100000) / 100000, ...(c.plugged ? { plugged: true } : {}) }));
  const plugs = Object.keys(D.plugs || {}).filter((s) => D.plugs[s]);
  if (plugs.length) out.plugs = Object.fromEntries(plugs.map((s) => [s, true]));
  const r4 = (v) => Math.round(v * 10000) / 10000;
  if (D.steer && (D.steer.bend || D.steer.loss)) out.steer = { bend: r4(D.steer.bend), loss: r4(D.steer.loss) };
  if (D.mount > 0) out.mount = r4(D.mount);
  if (D.tightened && D.mount > 0) out.tightened = true;
  if (D.wiring && (D.wiring.loose || D.wiring.shock > 0)) out.wiring = { loose: D.wiring.loose, shock: r4(D.wiring.shock) };
  if (D.water?.some((l) => l > 0.05)) out.water = D.water.map((l) => Math.round(l * 10) / 10);
  return Object.keys(out).length ? out : null;
}
// The boats with tubes (a RIB's chambers are kept with her hull's record).
export const TUBED = new Set(['rib']);
// Every boat's record from the save, made sensible: { kind: what damageSave wrote }, only boats
// that aren't sound; anything not a boat's, dropped.
export function cleanDamages(raw, kinds) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of kinds) {
    const v = damageSave(cleanDamage(raw[k], TUBED.has(k)));
    if (v) out[k] = v;
  }
  return out;
}
export const sound = (D) => !D || (SECTIONS.every((s) => D.hull[s] < 0.005) && !(D.tubes || []).some((c) => c.air < 0.995 || c.leak > 0) && !partsHurt(D));
// Anything wrong with her working parts that a look would find (a shock not yet loosened anything:
// no).
export const partsHurt = (D) => !!D && (Math.abs(D.steer?.bend || 0) > 0.003 || (D.steer?.loss || 0) > 0.02 || (D.mount || 0) > 0.03 || !!D.wiring?.loose);

// An outboard's leg against the bottom (boat.js propStrike): at `speed` (m/s over the ground) and
// going sideways at `side` (m/s, + to port) as it struck. Past PARTS.steer.v0 the steering's bent
// (the way the blow pushed the leg: against her sideways way) and stiffened; past PARTS.mount.v0
// her bracket's worked loose. Returns what it did: { part: 'steer' | 'mount' | both in parts, ... }
// or null.
export function legStrike(D, ev, mode = MODES.standard) {
  if (!mode.parts || !D.steer) return null;
  const S = PARTS.steer, M = PARTS.mount, out = { parts: [], speed: ev.speed };
  const vs = ev.speed - S.v0 * mode.v;
  if (vs > 0) {
    const dir = -Math.sign(ev.side || 1);
    D.steer.bend = clamp(D.steer.bend + dir * vs * S.bend * mode.k, -S.most, S.most);
    D.steer.loss = clamp(D.steer.loss + vs * S.stiff * mode.k, 0, 0.8);
    out.parts.push('steer');
  }
  const vm = ev.speed - M.v0 * mode.v;
  if (vm > 0) {
    D.mount = clamp(D.mount + vm * M.per * mode.k, 0, 1);
    D.tightened = false;
    out.parts.push('mount');
  }
  return out.parts.length ? out : null;
}
// A rudder's foot on the bottom (boat.js takeDamage): vn m/s square on, going sideways at `side`.
export function rudderStrike(D, ev, mode = MODES.standard) {
  if (!mode.parts || !D.steer) return null;
  const S = PARTS.steer, v = ev.vn - S.rudder * mode.v;
  if (v <= 0) return null;
  D.steer.bend = clamp(D.steer.bend - Math.sign(ev.side || 1) * v * S.bend * 2 * mode.k, -S.most, S.most);
  D.steer.loss = clamp(D.steer.loss + v * S.stiff * 2 * mode.k, 0, 0.8);
  return { parts: ['steer'], vn: ev.vn };
}
// A jolt through her (a landing off a wave, or her bow slamming into one: m/s, down): past
// PARTS.shock.j0, it works at her battery terminal, each harder one more (the excess squared); past
// a full measure, it's loose. Returns 'loose' the moment it goes, 'cut' for a hard jolt while it's
// loose already (the engine and the instruments cut out), else null.
export function shake(D, jolt, mode = MODES.standard) {
  if (!mode.parts || !D.wiring) return null;
  const J = PARTS.shock, x = jolt - J.j0 * mode.v;
  if (x <= 0) return null;
  if (D.wiring.loose) return jolt > J.j0 * 0.8 ? 'cut' : null;
  D.wiring.shock = Math.min(1, D.wiring.shock + x * x * J.k * mode.k);
  if (D.wiring.shock < 1) return null;
  D.wiring.loose = true;
  return 'loose';
}
// Plugged at sea (C6b): a breach in a part of her hull ('hull:bottom' …), a softwood plug or the
// collision mat over it, letting in a fifth of what it did (see flooding.js holeArea's use in
// boat.js flood); a punctured tube chamber ('tube:2' …), a leak-stopper screwed into it, a fifth
// of its leak. Until the yard. Returns true if there was something to plug.
export const PLUGGED = 0.2;
export function plug(D, id) {
  const [what, key] = String(id).split(':');
  if (what === 'hull' && D.hull[key] >= 0.85 && !D.plugs?.[key]) {
    (D.plugs ||= {})[key] = true;
    return true;
  }
  const c = what === 'tube' ? D.tubes?.[+key] : null;
  if (c && c.leak > 0 && !c.plugged) {
    c.leak *= PLUGGED;
    c.plugged = true;
    return true;
  }
  return false;
}
// What could be plugged at sea: ids for plug.
export const pluggable = (D) => [
  ...SECTIONS.filter((s) => D.hull[s] >= 0.85 && !D.plugs?.[s]).map((s) => `hull:${s}`),
  ...(D.tubes || []).map((c, i) => (c.leak > 0 && !c.plugged ? `tube:${i}` : null)).filter(Boolean),
];

// Her steering as damaged: the helm's angle (rad) as the leg or rudder actually takes it.
export const steered = (D, r) => (D?.steer ? r * (1 - 0.5 * D.steer.loss) + D.steer.bend : r);
// Her outboard's push as her bracket allows (1: sound).
export const mountPush = (D) => (D ? 1 - 0.35 * (D.mount || 0) : 1);
// Done up at sea (look her over): the battery terminal, for good; the bracket's bolts, most of the
// way (the yard does the rest). Returns true if there was anything to do.
export function tighten(D, what) {
  if (what === 'terminal' && D.wiring?.loose) {
    D.wiring.loose = false;
    D.wiring.shock = 0;
    return true;
  }
  if (what === 'mount' && D.mount > PARTS.mount.tight && !D.tightened) {
    D.mount = PARTS.mount.tight;
    D.tightened = true;
    return true;
  }
  return false;
}

// Which part of her a local point is on (x, y, z in her own frame: +x port, +z forward), for a
// hull of length L, half-beam B, draft d: her bottom below her waterline (but her stem forward),
// her bow at the fore end, her stern at the after end, else her side.
export function sectionAt(x, y, z, L, B, d) {
  const t = (z + L / 2) / L;
  if (t > 0.86) return 'bow';
  if (y < d * 0.75 && Math.abs(x) < B * 0.75) return 'bottom';
  if (t < 0.08) return 'stern';
  return x >= 0 ? 'port' : 'stbd';
}
// Which tube chamber a local point is in (t: share of her length from the stern; x: + port).
export const chamberAt = (x, t) => (x >= 0 ? 0 : 2) + (t >= CHAMBER_SPLIT ? 1 : 0);

// A knock: ev { section, vn (m/s, square on), surface (SURFACES key), chamber (index, or -1: her
// hull) }. Returns what it did: { section, add, was, now, chamber, punctured, torn } or null if
// nothing.
export function knock(D, mat, ev, mode = MODES.standard) {
  const S = SURFACES[ev.surface] || SURFACES.sand;
  if (ev.chamber >= 0 && D.tubes) {
    const c = D.tubes[ev.chamber], v = ev.vn * S.sharp;
    if (!mode.tubes || v < TUBE.v0 * mode.v) return null;
    const torn = v >= TUBE.tear * mode.v, rate = (torn ? TUBE.torn : TUBE.leak) * mode.leak;
    if (c.leak >= rate) return null;
    const first = c.leak === 0;
    c.leak = rate;
    return { chamber: ev.chamber, punctured: first, torn, add: 0 };
  }
  const v = ev.vn * S.hard - mat.v0 * mode.v;
  if (v <= 0) return null;
  return hurt(D, ev.section, v * mat.per * mode.k, mode);
}

// Sliding along the bottom (m/s, for dt s): on rock she's scored; on sand, nothing. A tube dragged
// over rock fast enough is opened up. Same return as knock.
export function scrape(D, mat, ev, dt, mode = MODES.standard) {
  if (ev.surface !== 'rock' || ev.speed < 0.6) return null;
  if (ev.chamber >= 0 && D.tubes) return ev.speed >= TUBE.scrape * mode.v ? knock(D, mat, { chamber: ev.chamber, vn: TUBE.v0 * mode.v + 0.01, surface: 'rock' }, mode) : null;
  return hurt(D, ev.section, ev.speed * dt * mat.scrape * mode.k, mode);
}

function hurt(D, section, add, mode) {
  const was = D.hull[section];
  if (!(section in D.hull) || was >= mode.cap) return null;
  const now = Math.min(mode.cap, was + add);
  if (now - was < 1e-4) return null;
  D.hull[section] = now;
  return { section, add: now - was, was, now, chamber: -1 };
}

// The tubes' air, over dt seconds: a punctured chamber going soft (faster while it's firm, pushed
// out harder: as the square root of what's left). Returns true if any chamber's changed enough to
// see.
export function stepTubes(D, dt) {
  if (!D.tubes) return false;
  let moved = false;
  for (const c of D.tubes) {
    if (!c.leak || c.air <= 0) continue;
    const was = c.air;
    c.air = Math.max(0, c.air - c.leak * dt * Math.sqrt(Math.max(0.05, c.air)));
    if (Math.floor(was * 50) !== Math.floor(c.air * 50)) moved = true;
  }
  return moved;
}
// How firm a chamber is at its air (share of working pressure): a tube holds its shape until it's
// well down, then slumps.
export const firmness = (air) => smooth(0.06, 0.45, air);
// The foot pump: air back in (a chamber from flat to firm in about forty seconds' pumping).
export function pump(D, dt) {
  if (!D.tubes) return false;
  let any = false;
  for (const c of D.tubes) if (c.air < 1) { c.air = Math.min(1, c.air + dt / 40); any = true; }
  return any;
}

// Her hull's resistance for her damage: a gouged or cracked bottom roughens the water round it
// (up to a tenth more), her bow a little. 1: sound.
export const roughness = (D) => (D ? 1 + 0.1 * smooth(0.05, 0.9, D.hull.bottom) + 0.03 * smooth(0.1, 0.9, D.hull.bow) : 1);

// In words.
export function hullWords(mat, v) {
  if (v < 0.03) return 'sound';
  return mat.words[v < 0.25 ? 0 : v < 0.55 ? 1 : v < 0.85 ? 2 : 3];
}
export function tubeWords(c) {
  const f = c.air;
  const state = f > 0.9 ? 'firm' : f > 0.55 ? 'a little soft' : f > 0.2 ? 'soft' : 'flat';
  return c.leak ? `${state}, ${c.leak >= TUBE.torn * 0.9 ? 'torn open' : 'punctured: a slow hiss'}` : state;
}

// What looking her over finds: [{ what, words, bad }], worst first.
export function survey(D, kind) {
  const mat = materialOf(kind), out = [];
  for (const s of SECTIONS) out.push({ what: SECTION_NAMES[s].replace(/^her /, ''), words: hullWords(mat, D.hull[s]), bad: D.hull[s] });
  (D.tubes || []).forEach((c, i) => out.push({ what: `${CHAMBERS[i]} tube`, words: tubeWords(c), bad: Math.max(1 - c.air, c.leak ? 0.5 : 0) }));
  if (D.steer) out.push({ what: 'steering', words: steerWords(D), bad: Math.abs(D.steer.bend) * 8 + D.steer.loss });
  if (D.mount > 0.03) out.push({ what: 'the engine’s bracket', words: D.tightened ? 'its bolts done up at sea: holding, but not right' : D.mount > 0.6 ? 'badly loose: the engine shifts on the transom' : 'its bolts working loose', bad: D.mount });
  if (D.wiring?.loose) out.push({ what: 'the battery terminal', words: 'shaken loose', bad: 0.6 });
  return out.sort((a, b) => b.bad - a.bad);
}
export function steerWords(D) {
  const S = D.steer, b = Math.abs(S.bend);
  if (b < 0.003 && S.loss < 0.02) return 'sound';
  const pull = b >= 0.003 ? `bent (she pulls to ${S.bend > 0 ? 'starboard' : 'port'})` : 'stiff';
  return `${pull}${b >= 0.003 && S.loss >= 0.15 ? ' and stiff' : ''}`;
}

// The yard's bill for each repair: [{ id, what, price }]. base: what she cost new (the yard's
// work is a share of it, the worse the more).
export function repairs(D, kind, base) {
  const mat = materialOf(kind), out = [], b = Math.max(150, base || 0);
  for (const s of SECTIONS) {
    const v = D.hull[s];
    if (v < 0.03) continue;
    const share = v < 0.25 ? 0.02 : v < 0.55 ? 0.06 : v < 0.85 ? 0.14 : 0.24;
    const job = v < 0.55 ? mat.touch : mat.mend;
    out.push({ id: `hull:${s}`, what: `${SECTION_NAMES[s].replace(/^her /, 'Her ')}: ${hullWords(mat, v)}. ${job[0].toUpperCase() + job.slice(1)}.`, price: Math.max(10, Math.round((b * share) / 5) * 5) });
  }
  (D.tubes || []).forEach((c, i) => {
    if (!c.leak && c.air >= 0.995) return;
    out.push({ id: `tube:${i}`, what: c.leak ? `The ${CHAMBERS[i]} tube: ${c.leak >= TUBE.torn * 0.9 ? 'torn' : 'punctured'}. Patched, the glue left to cure, and pumped up.` : `The ${CHAMBERS[i]} tube: soft. Pumped up.`, price: c.leak ? Math.max(20, Math.round((b * (c.leak >= TUBE.torn * 0.9 ? 0.09 : 0.04)) / 5) * 5) : 0 });
  });
  const price = (share) => Math.max(10, Math.round((b * share) / 5) * 5);
  if (D.steer && (Math.abs(D.steer.bend) > 0.003 || D.steer.loss > 0.02)) out.push({ id: 'steer', what: `Her steering: ${steerWords(D)}. ${MATERIAL_OF[kind] === 'wood' || kind === 'sail' ? 'The rudder straightened and rehung' : 'The leg lined up again, a new steering cable'}.`, price: price(0.03 + 0.08 * Math.min(1, Math.abs(D.steer.bend) / PARTS.steer.most + D.steer.loss)) });
  if (D.mount > 0.03) out.push({ id: 'mount', what: `The engine’s bracket: ${D.tightened ? 'done up at sea' : 'loose'}. Lifted, the bolts and the transom checked, new bolts and backing plates.`, price: price(0.03 + 0.05 * D.mount) });
  if (D.wiring?.loose) out.push({ id: 'wiring', what: 'The battery terminal: loose. Cleaned and done up.', price: 5 });
  // (Water in her: hauled out, it drains; done with any job on her hull, free.)
  const litres = (D.water || []).reduce((n, l) => n + l, 0);
  if (litres > 5 && !out.some((r) => r.id.startsWith('hull:'))) out.push({ id: 'water', what: `Her bilge: ${Math.round(litres)} litres of water. Pumped out and left to dry.`, price: 5 });
  return out;
}
// The yard's work done (an id from repairs; 'all': everything).
export function mend(D, id) {
  if (id === 'all') {
    for (const s of SECTIONS) D.hull[s] = 0;
    for (const c of D.tubes || []) { c.air = 1; c.leak = 0; }
    for (const x of ['steer', 'mount', 'wiring']) mend(D, x);
    if (D.water) D.water.fill(0);
    D.plugs = {};
    for (const c of D.tubes || []) c.plugged = false;
    return true;
  }
  const [what, key] = String(id).split(':');
  // (Hauled out to be mended, she drains.)
  if (what === 'hull' && key in D.hull) { D.hull[key] = 0; if (D.plugs) delete D.plugs[key]; if (D.water) D.water.fill(0); return true; }
  if (what === 'tube' && D.tubes?.[+key]) { Object.assign(D.tubes[+key], { air: 1, leak: 0, plugged: false }); return true; }
  if (what === 'steer' && D.steer) { D.steer.bend = 0; D.steer.loss = 0; return true; }
  if (what === 'mount') { D.mount = 0; D.tightened = false; return true; }
  if (what === 'wiring' && D.wiring) { D.wiring.loose = false; D.wiring.shock = 0; return true; }
  if (what === 'water' && D.water) { D.water.fill(0); return true; }
  return false;
}
