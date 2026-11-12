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
// Difficulty: on Relaxed, knocks scuff the paint and no more (and a tube never punctures); on
// Standard, the full account; on Realistic, a little less takes a little more, and a punctured
// tube goes soft sooner.

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
  relaxed: { cap: 0.2, v: 1.3, k: 0.6, tubes: false, leak: 0 },
  standard: { cap: 1, v: 1, k: 1, tubes: true, leak: 1 },
  realistic: { cap: 1, v: 0.85, k: 1.3, tubes: true, leak: 1.8 },
};
export const modeOf = (difficulty) => MODES[difficulty] || MODES.standard;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

export function newDamage(tubes = false) {
  return { hull: Object.fromEntries(SECTIONS.map((s) => [s, 0])), tubes: tubes ? CHAMBERS.map(() => ({ air: 1, leak: 0 })) : null };
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
    });
  }
  return D;
}
// For the save: only what isn't sound.
export function damageSave(D) {
  const out = {};
  const hull = Object.fromEntries(SECTIONS.filter((s) => D.hull[s] > 0).map((s) => [s, Math.round(D.hull[s] * 1000) / 1000]));
  if (Object.keys(hull).length) out.hull = hull;
  if (D.tubes?.some((c) => c.air < 1 || c.leak > 0)) out.tubes = D.tubes.map((c) => ({ air: Math.round(c.air * 1000) / 1000, leak: Math.round(c.leak * 10000) / 10000 }));
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
export const sound = (D) => !D || (SECTIONS.every((s) => D.hull[s] < 0.005) && !(D.tubes || []).some((c) => c.air < 0.995 || c.leak > 0));

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
  return out.sort((a, b) => b.bad - a.bad);
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
  return out;
}
// The yard's work done (an id from repairs; 'all': everything).
export function mend(D, id) {
  if (id === 'all') {
    for (const s of SECTIONS) D.hull[s] = 0;
    for (const c of D.tubes || []) { c.air = 1; c.leak = 0; }
    return true;
  }
  const [what, key] = String(id).split(':');
  if (what === 'hull' && key in D.hull) { D.hull[key] = 0; return true; }
  if (what === 'tube' && D.tubes?.[+key]) { D.tubes[+key].air = 1; D.tubes[+key].leak = 0; return true; }
  return false;
}
