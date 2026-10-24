// Compiles the species research (research/register/*.json) into src/registerData.js, the
// Atlantic register's entries as the game loads them, checking each entry's shape on the way.
//
//   node tools/build-register.mjs          update src/registerData.js
//   node tools/build-register.mjs --check  exit with an error if it is out of date
//
// Each research file is a list of species records: id, scientific name (with its author),
// names (en, fr, es, pt), habitat, depth, size, diet, behaviour, seasonal notes, a status and
// confidence for each of the six regions with what it rests on, identification features,
// look-alikes, angling methods, conservation, sources and what is uncertain.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const dir = join(root, 'research', 'register');
const out = join(root, 'src', 'registerData.js');

const REGIONS = ['gironde', 'biscay', 'cantabria', 'galicia', 'portugal', 'cadiz'];
const STATUSES = new Set(['resident', 'seasonal', 'occasional', 'absent', 'unknown']);
const CONF = new Set(['high', 'medium', 'low']);
const KIND = { squid: 'cephalopod', cuttlefish: 'cephalopod', octopus: 'cephalopod', catshark: 'shark', blueshark: 'shark', thornback: 'ray', stingray: 'ray' };
// Common names in lower case, as in running text, except for words from proper names.
const PROPER = /^(European|Atlantic|Mediterranean|Moroccan|Senegalese|Portuguese|Spanish|French|Bay|Canary|John)\b/;

const entries = [];
const problems = [];
const seenIds = new Set();
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  let list;
  try {
    list = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  } catch (e) {
    problems.push(`${f}: not valid JSON (${e.message})`);
    continue;
  }
  for (const r of list) {
    const p = (m) => problems.push(`${f} ${r.id}: ${m}`);
    if (!r.id || !r.scientific) {
      p('no id or scientific name');
      continue;
    }
    if (seenIds.has(r.id)) p('id used twice');
    seenIds.add(r.id);
    const names = {};
    for (const k of ['en', 'fr', 'es', 'pt']) {
      if (!r.names?.[k]) continue;
      const n = String(r.names[k]).trim();
      names[k] = PROPER.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1);
    }
    // The binomial apart from its author and year ("Diplodus cadenati de la Paz, … 1974").
    const sm = String(r.scientific).trim().match(/^([A-Z][a-z]+ [a-z]+(?: (?!de |da |van |von |du |la |le )[a-z]+)?)\s*(.*)$/);
    if (!sm) p(`scientific name "${r.scientific}" is not a binomial`);
    const regions = {};
    for (const g of REGIONS) {
      const d = r.regions?.[g];
      if (!d) {
        p(`no ${g}`);
        regions[g] = { status: 'unknown', confidence: 'low', basis: 'not researched' };
        continue;
      }
      if (!STATUSES.has(d.status)) p(`${g} status ${d.status}`);
      regions[g] = { status: STATUSES.has(d.status) ? d.status : 'unknown', confidence: CONF.has(d.confidence) ? d.confidence : 'low', basis: d.basis || '' };
    }
    const sources = [];
    const seen = new Set();
    for (const s of [...(r.sources || []), ...(r.nameSources || []).map((u) => ({ title: 'Names', url: u }))]) {
      const url = typeof s === 'string' ? s : s?.url;
      if (!url || !/^https?:\/\//.test(url) || seen.has(url)) continue;
      seen.add(url);
      sources.push({ title: (typeof s === 'object' && s.title) || url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], url });
    }
    if (!sources.length) p('no sources');
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const pair = (v) => (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number') ? v : null);
    entries.push({
      id: r.id,
      kind: KIND[r.id] || 'fish',
      scientific: sm ? sm[1] : String(r.scientific).trim(),
      authority: sm?.[2] || null,
      family: r.family || null,
      synonyms: Array.isArray(r.synonyms) ? r.synonyms : [],
      names,
      habitat: r.habitat || null,
      depth: r.depth ? { usual: pair(r.depth.usual), range: pair(r.depth.range), source: r.depth.source || null } : null,
      size: r.size ? { common: num(r.size.common), max: num(r.size.max), maxNote: r.size.maxNote || null, source: r.size.source || null } : null,
      diet: r.diet || null,
      behaviour: r.behaviour || null,
      seasonal: r.seasonal || null,
      regions,
      identification: Array.isArray(r.identification) ? r.identification : [],
      similar: Array.isArray(r.similar) ? r.similar : [],
      methods: Array.isArray(r.anglingMethods) ? r.anglingMethods : [],
      conservation: r.conservation || null,
      sources,
      uncertain: r.uncertain || null,
    });
  }
}

const text = `// The Atlantic species register's researched entries, compiled by tools/build-register.mjs from
// research/register/*.json. Generated: edit the research and rebuild, not this file.
//
// The research is web research of FishBase, SeaLifeBase, DORIS, WoRMS and the Catalog of
// Fishes, regional checklists and papers (Portugal, Galicia, Andalusia, Ifremer, AZTI, ICES),
// and French, Spanish and Portuguese official documents. Every entry lists the pages it came
// from, and every regional status says what it rests on. Values are as the sources give them;
// null means not found. A range statement alone ("Morocco to Norway") gives at most medium
// confidence; a regional source, high. See register.js for how the game uses it.
export const REGISTER_DATA = [
${entries.map((e) => JSON.stringify(e)).join(',\n')},
];
`;

if (problems.length) console.log(`problems:\n  ${problems.join('\n  ')}`);
if (process.argv.includes('--check')) {
  let old = '';
  try {
    old = readFileSync(out, 'utf8');
  } catch {}
  if (old !== text) {
    console.error('src/registerData.js is out of date: run node tools/build-register.mjs');
    process.exit(1);
  }
  console.log(`src/registerData.js is up to date (${entries.length} entries)`);
} else {
  writeFileSync(out, text);
  console.log(`src/registerData.js: ${entries.length} entries`);
}
if (problems.length) process.exitCode = 1;
