// Add (or correct) words in the game's books of Spanish and French (docs/LANGUAGES.md): from a
// JSON file of { "<English key>": ["<Spanish>", "<French>"] }, each checked as the tests check them
// (its parts {0}…, its HTML tags and the spaces at its ends kept), written into src/i18n/es.js and
// fr.js in place. The keys the game doesn't have are refused (tools/i18n-keys.mjs --missing lists
// those it needs).
//
//   node tools/i18n-add.mjs words.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allKeys } from './i18n-keys.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file) {
  console.log('node tools/i18n-add.mjs words.json  (a JSON object: "English key": ["Spanish", "French"])');
  process.exit(1);
}
const add = JSON.parse(fs.readFileSync(file, 'utf8'));
const keys = allKeys(ROOT);
const parts = (s) => (s.match(/\{\d+\}/g) || []).sort().join();
const tags = (s) => (s.match(/<\/?[a-z][a-z0-9]*/gi) || []).map((t) => t.toLowerCase()).sort().join();
const ends = (s) => `${s.match(/^\s*/)[0]}|${s.match(/\s*$/)[0]}`;
const ok = (k, s) => typeof s === 'string' && s.trim() && parts(s) === parts(k) && tags(s) === tags(k) && ends(s) === ends(k);

const books = {};
for (const l of ['es', 'fr']) books[l] = { ...(await import(path.join(ROOT, 'src/i18n', `${l}.js`))).default };
let n = 0;
for (const [k, v] of Object.entries(add)) {
  if (!keys.has(k)) { console.log(`not a key the game has: ${JSON.stringify(k)}`); continue; }
  if (!Array.isArray(v) || !ok(k, v[0]) || !ok(k, v[1])) { console.log(`refused (parts, tags or ends): ${JSON.stringify(k)}`); continue; }
  books.es[k] = v[0];
  books.fr[k] = v[1];
  n++;
}
const NAME = { es: 'Spanish', fr: 'French' };
for (const l of ['es', 'fr']) {
  const entries = Object.entries(books[l]).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  fs.writeFileSync(path.join(ROOT, 'src/i18n', `${l}.js`), `// The game's words in ${NAME[l]} (docs/LANGUAGES.md): each English key, as src/i18n.js looks it up,
// and its translation, its parts {0}, {1}… where ${NAME[l]} puts them. A key not here shows in English.
// tools/i18n-keys.mjs lists the keys missing; tests/i18n.test.mjs checks every entry.
export default {
${entries.join(',\n')},
};
`);
}
console.log(`${n} added or corrected in both books`);
