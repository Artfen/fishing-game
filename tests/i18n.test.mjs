// Languages (docs/LANGUAGES.md): the game in English, Spanish or French. $t gives the words in the
// language chosen, parts put where that language wants them, English where its book has nothing;
// the language is chosen before the game loads, kept, and picked from the browser for a new player;
// every key the game has is in both books, and every translation keeps its parts, its tags and the
// spaces at its ends; and nothing the game goes by (a hull's physics, a box, a line's kind) is words
// that change with the language. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const I = await import('../src/i18n.js');
const K = await import('../tools/i18n-keys.mjs');
const root = new URL('..', import.meta.url).pathname;

test('$t: the English as it is with no book; the book\'s words with one, parts where that language puts them, English where it has nothing', () => {
  const n = 3, where = 'Gannet Light';
  try {
    assert.equal(I.$t('Pack'), 'Pack');
    assert.equal(I.$t`${n} fish off ${where}`, '3 fish off Gannet Light');
    I.setBook('es', { Pack: 'Mochila', '{0} fish off {1}': '{0} peces frente a {1}', 'Off {0}, {1} fish': '{1} peces frente a {0}' });
    assert.equal(I.langNow(), 'es');
    assert.equal(I.$t('Pack'), 'Mochila');
    assert.equal(I.$t`${n} fish off ${where}`, '3 peces frente a Gannet Light');
    // (Parts moved: each still the right one.)
    assert.equal(I.$t`Off ${where}, ${n} fish`, '3 peces frente a Gannet Light');
    // Not in the book: the English.
    assert.equal(I.$t('Settings'), 'Settings');
    assert.equal(I.$t`${n} more`, '3 more');
    // The same place written twice gives the same words (its key worked out once).
    const f = (x) => I.$t`${x} fish off ${where}`;
    assert.equal(f(1), '1 peces frente a Gannet Light');
    assert.equal(f(2), '2 peces frente a Gannet Light');
    // Anything but words passes through.
    assert.equal(I.$t(null), null);
  } finally {
    I.setBook('en', null);
  }
  assert.equal(I.langNow(), 'en');
  assert.equal(I.$t('Pack'), 'Pack');
});

test('the language to start in: the one chosen; a new player, the browser\'s own if the game has it; someone already playing, English', () => {
  const store = (o) => ({ getItem: (k) => o[k] ?? null, setItem: (k, v) => { o[k] = v; } });
  const nav = (...languages) => ({ languages, language: languages[0] });
  assert.equal(I.pickLang(store({ 'slow-tide-lang': 'fr' }), nav('es-ES')), 'fr');
  assert.equal(I.pickLang(store({}), nav('es-MX', 'en')), 'es');
  assert.equal(I.pickLang(store({}), nav('de-DE', 'fr-BE')), 'fr');
  assert.equal(I.pickLang(store({}), nav('de-DE')), 'en');
  assert.equal(I.pickLang(store({ 'slow-tide-save': '{}' }), nav('es-ES')), 'en', 'a game already going stays as it was');
  assert.equal(I.pickLang(store({ 'slow-tide-lang': 'xx' }), nav('fr')), 'fr');
  const kept = {};
  I.keepLang('es', store(kept));
  assert.equal(kept['slow-tide-lang'], 'es');
  assert.deepEqual(I.LANGS.map(([id]) => id), ['en', 'es', 'fr']);
});

test('the keys found in the source are the keys $t looks up: a plain string, a template with parts and nested templates, escapes', () => {
  const src = "x = $t('Drop the anchor first.'); y = $t`Off ${a ? `${b} m` : 'the point'}, ${n} fish`; z = $t(\"It\\u2019s here\"); w = $t`Line one\\nline two`;";
  assert.deepEqual(K.keysIn(src), ['Drop the anchor first.', 'Off {0}, {1} fish', '{0} m', 'It’s here', 'Line one\nline two']);
  assert.equal(I.keyOf(['Off ', ', ', ' fish']), 'Off {0}, {1} fish');
});

const books = {};
for (const l of ['es', 'fr']) books[l] = (await import(`../src/i18n/${l}.js`)).default;
const keys = K.allKeys();

test('every word the game has, in Spanish and in French', () => {
  assert.ok(keys.size > 8000, `${keys.size} keys`);
  for (const l of ['es', 'fr']) {
    const missing = [...keys.keys()].filter((k) => typeof books[l][k] !== 'string');
    assert.deepEqual(missing.slice(0, 10), [], `${l}: ${missing.length} keys missing (node tools/i18n-keys.mjs --missing lists them)`);
  }
});

test('every translation keeps its parts, its tags and the spaces at its ends, and is never empty', () => {
  const parts = (s) => (s.match(/\{\d+\}/g) || []).sort().join();
  const tags = (s) => (s.match(/<\/?[a-z][a-z0-9]*/gi) || []).map((t) => t.toLowerCase()).sort().join();
  const ends = (s) => `${s.match(/^\s*/)[0]}|${s.match(/\s*$/)[0]}`;
  for (const l of ['es', 'fr']) {
    const bad = Object.entries(books[l]).filter(([k, v]) => typeof v !== 'string' || !v.trim() || parts(v) !== parts(k) || tags(v) !== tags(k) || ends(v) !== ends(k));
    assert.deepEqual(bad.slice(0, 5), [], `${l}: ${bad.length} entries wrong`);
  }
  // A few that have to be right, by hand.
  assert.equal(books.es.Settings, 'Ajustes');
  assert.equal(books.fr.Settings, 'Paramètres');
  assert.equal(books.es.Language, 'Idioma');
  assert.equal(books.fr.Language, 'Langue');
});

test('the language comes before the game: the page loads boot.js, which loads the book, then the game; chosen on the title screen or in Settings', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<script type="module" src="src\/boot\.js"><\/script>/);
  assert.doesNotMatch(html, /src="src\/main\.js"/);
  assert.match(html, /<select id="title-lang" data-i18n-skip><option value="en">English<\/option><option value="es">Español<\/option><option value="fr">Français<\/option><\/select>/);
  const boot = fs.readFileSync(path.join(root, 'src/boot.js'), 'utf8');
  assert.ok(boot.indexOf("import(`./i18n/${lang}.js`)") < boot.indexOf("import('./main.js')"));
  assert.match(boot, /translatePage\(\);/);
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  assert.match(main, /keepLang\(code\);\s*if \(started\) save\(\);\s*location\.reload\(\);/);
  assert.match(main, /setLanguage: \(code\) => switchLanguage\(code\),/);
  const settings = fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8');
  assert.match(settings, /this\.choice\(LANGS, langNow\(\), \(v\) => this\.hooks\.setLanguage\?\.\(v\)\)/);
});

test('nothing the game goes by changes with the language: a hull\'s physics by her kind, boxes and line kinds as names', async () => {
  const { BOAT_KINDS } = await import('../src/boat.js');
  const hydro = fs.readFileSync(path.join(root, 'src/hydro.js'), 'utf8');
  assert.match(hydro, /switch \(H\.kindId \?\? KIND_OF_NAME\[H\.name\]\) \{/);
  assert.doesNotMatch(hydro, /case 'rowing boat'/);
  const boat = fs.readFileSync(path.join(root, 'src/boat.js'), 'utf8');
  assert.match(boat, /for \(const k of BOAT_KINDS\) HULLS\[k\]\.kindId = k;/);
  assert.ok(BOAT_KINDS.includes('trawler'));
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  for (const name of ['tackle box', 'tackle wall', 'boat locker', 'car boot']) assert.doesNotMatch(main, new RegExp(`\\$t\\('${name}'\\)`), name);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/gearArt.js'), 'utf8'), /\$t\('fly line'\)/);
  // (The notice board's jobs found by where they're pinned, the same words either side.)
  assert.match(fs.readFileSync(path.join(root, 'src/harbour.js'), 'utf8'), /A\.where === \$t\('The notice board at Willowhaven'\)/);
});
